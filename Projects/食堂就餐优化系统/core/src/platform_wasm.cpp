// 模块说明：WebAssembly（wasm32-freestanding -nostdlib）底层线性内存页扩容适配层与编译器内置符号（memcpy/memset）实现。
// 工程约束：不导入任何宿主环境函数（imports === []），仅通过 __builtin_wasm_memory_grow 按 64KiB 页粒度向后线性扩展。
// platform_wasm.cpp — WASM 目标的原始分配后端
//
// 设计：自下而上（bump）分配 + 全部释放后整体回收。
// 这样 mp_free 之后指针不会被再次分发（“mp_free 不复用指针”），
// 单次请求的输入/输出缓冲释放完即把 break 复位，跨请求不无限增长。
#include "mp/base.h"

#if MP_WASM

// 由 wasm-ld 提供，标记栈区之后的堆起点
extern "C" unsigned char __heap_base;

extern "C" __attribute__((import_module("env"), import_name("mp_monotonic_ms")))
double mp_host_monotonic_ms();

namespace mp {
double MonotonicMilliseconds() { return mp_host_monotonic_ms(); }


namespace {

constexpr usize kPageBytes = 65536;
constexpr u32 kBlockMagic = 0x4D50424Bu;  // 'MPBK'
constexpr usize kHeaderBytes = 16;

// 块头（16 字节前置）：size+magic+live。释放只翻 live 位并清 magic，指针立即退役
//（地址永不复用，double-free 无害）；全部块释放后把 break 复位到堆起点，
// 保证跨请求数组内存页数不单调增长（heap-growth 检查依赖该性质）。
struct BlockHeader {
  usize size;     // 用户字节数
  u32 magic;
  u32 live;       // 1=已分配，0=已释放
};

bool g_initialized = false;
usize g_heapStart = 0;
usize g_break = 0;
usize g_liveBlocks = 0;

usize MemoryBytes() { return static_cast<usize>(__builtin_wasm_memory_size(0)) * kPageBytes; }

// 初始化：__heap_base（wasm-ld 符号）对齐到 16 字节作为堆起点，仅执行一次。
void Initialize() {
  if (g_initialized) {
    return;
  }
  usize base = reinterpret_cast<usize>(&__heap_base);
  base = (base + 15u) & ~static_cast<usize>(15u);
  g_heapStart = base;
  g_break = base;
  g_initialized = true;
}

// 页扩容：按 64KiB 页逐页 grow 直至覆盖所需字节；grow 失败（返回 -1）即分配失败，
// 不做部分提交假设。
bool EnsureCapacity(usize required) {
  while (MemoryBytes() < required) {
    const usize previous = static_cast<usize>(__builtin_wasm_memory_grow(0, 1));
    if (previous == static_cast<usize>(-1)) {
      return false;
    }
  }
  return true;
}

// 由用户指针回溯前置块头（偏移 kHeaderBytes）。
BlockHeader* HeaderOf(void* pointer) {
  return reinterpret_cast<BlockHeader*>(static_cast<byte*>(pointer) - kHeaderBytes);
}

}  // namespace

// bump 分配：16 字节对齐 + 块头前置；容量不足整页扩容，失败返回 nullptr。
void* RawAlloc(usize bytes) {
  Initialize();
  if (bytes == 0) {
    bytes = 1;
  }
  const usize alignedSize = (bytes + 15u) & ~static_cast<usize>(15u);
  const usize total = kHeaderBytes + alignedSize;
  if (!EnsureCapacity(g_break + total)) {
    return nullptr;
  }
  BlockHeader* header = reinterpret_cast<BlockHeader*>(g_break);
  header->size = bytes;
  header->magic = kBlockMagic;
  header->live = 1;
  g_break += total;
  ++g_liveBlocks;
  return reinterpret_cast<byte*>(header) + kHeaderBytes;
}

// 释放：magic/live 双重校验后退役指针（清 magic 防旧指针再次释放）；
// 全部块退役时把 break 复位到堆起点——地址不复用 + 整体回收是双端内存语义一致的关键。
void RawFree(void* pointer) {
  if (pointer == nullptr) {
    return;
  }
  BlockHeader* header = HeaderOf(pointer);
  if (header->magic != kBlockMagic) {
    return;  // 非本分配器发出的指针：忽略，不破坏堆
  }
  if (header->live == 0) {
    return;  // 重复释放：忽略，不破坏堆
  }
  header->live = 0;
  header->magic = 0;  // 防止再次通过旧指针释放
  if (g_liveBlocks != 0) {
    --g_liveBlocks;
  }
  if (g_liveBlocks == 0) {
    // 全部释放：整体回收，保证跨请求不增长，也保证旧指针不会被重新分发
    g_break = g_heapStart;
  }
}

usize WasmHeapBreak() { return g_break; }
usize WasmHeapStart() { return g_heapStart; }
usize WasmMemoryBytes() { return MemoryBytes(); }

}  // namespace mp

#endif  // MP_WASM

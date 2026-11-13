// 模块说明：核心库对外导出的稳定 C ABI 边界实现（mp_api_version / mp_contract_version / mp_alloc / mp_free / mp_*）。
// 工程约束：
//   1. 所有跨宿主边界调用均收敛为单进单出的字节块协议，任何契约错误均封装为 ResultEnvelope JSON，绝不向宿主抛出异常或 trap；
//   2. 每次 API 请求独立构造 ExecContext 与线性 Arena，保证多次调用之间零残留状态、零内存泄漏；
//   3. 版本号指针返回静态只读常量字符串，宿主无需也不得对其调用 mp_free。
#include "mp/api.h"

#include "mp/contract.h"

namespace {

using EntryFunction = bool (*)(mp::ExecContext&, const char*, mp::usize, mp::TextBuffer*);

// 统一出口：任何内部状态都转成可见的 ResultEnvelope，异常不外泄
// 统一出口：独立 ExecContext/Arena 跑完整请求后，把信封 JSON 拷进结果块
//（[u32 payload 长度][u32 保留] 头 + payload + '\0'，RawAlloc 分配）。
// 内部错误一律转成 ok=false 信封；分配失败返回 nullptr，绝不向宿主抛异常或 trap。
void* BuildResultBlock(const char* input, mp::u32 length, EntryFunction entry) {
  mp::ExecContext context;
  mp::TextBuffer envelope;
  envelope.Init(&context.Memory());
  entry(context, input, static_cast<mp::usize>(length), &envelope);

  const mp::u32 payload = static_cast<mp::u32>(envelope.size);
  const mp::usize total = mp::kResultBlockHeaderBytes + static_cast<mp::usize>(payload) + 1;
  mp::byte* block = static_cast<mp::byte*>(mp::RawAlloc(total));
  if (block == nullptr) {
    return nullptr;
  }
  block[0] = static_cast<mp::byte>(payload & 0xFFu);
  block[1] = static_cast<mp::byte>((payload >> 8) & 0xFFu);
  block[2] = static_cast<mp::byte>((payload >> 16) & 0xFFu);
  block[3] = static_cast<mp::byte>((payload >> 24) & 0xFFu);
  block[4] = 0;
  block[5] = 0;
  block[6] = 0;
  block[7] = 0;
  if (payload != 0 && envelope.data != nullptr) {
    mp::MemCopy(block + mp::kResultBlockHeaderBytes, envelope.data, payload);
  }
  block[mp::kResultBlockHeaderBytes + payload] = 0;
  return block;
}

}  // namespace

extern "C" {

uint32_t mp_api_version(void) { return mp::kApiVersion; }

const char* mp_contract_version(void) { return mp::kContractVersionText; }

// 宿主内存入口：mp_alloc/mp_free 与内部 RawAlloc/RawFree 同源；版本函数返回静态只读
// 常量，宿主无需也不得对其调用 mp_free。
void* mp_alloc(uint32_t size) { return mp::RawAlloc(static_cast<mp::usize>(size)); }

void mp_free(void* pointer) { mp::RawFree(pointer); }

  // 命令导出：plan（三算法全天规划；与 WASM 宿主共用同一实现，双端逐字节一致）。
void* mp_plan(const char* input, uint32_t length) {
  return BuildResultBlock(input, length, &mp::PlanDayEntry);
}

  // 命令导出：nutrition-target（营养目标计算）。
void* mp_nutrition_target(const char* input, uint32_t length) {
  return BuildResultBlock(input, length, &mp::ComputeNutritionTargetEntry);
}

  // 命令导出：validate-menu（目录校验与规模计数）。
void* mp_validate_menu(const char* input, uint32_t length) {
  return BuildResultBlock(input, length, &mp::ValidateMenuCatalogEntry);
}

  // 命令导出：offer-nutrition（指定报价营养查询，含半份缩放）。
void* mp_offer_nutrition(const char* input, uint32_t length) {
  return BuildResultBlock(input, length, &mp::OfferNutritionEntry);
}

}  // extern "C"

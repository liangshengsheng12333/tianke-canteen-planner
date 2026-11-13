// 模块说明：零标准库依赖的基础设施层实现（安全块堆 SafeHeap、线性内存池 Arena、动态文本缓冲 TextBuffer、整数解析与格式化）。
// 工程约束：
//   1. SafeHeap 维护显式块头（Magic + Size + InUse 状态位），保证重复释放（double-free）安全无害且存活块地址绝不复用；
//   2. Arena 采用 8 字节对齐的连续块链分配策略，随 ExecContext 生命周期结束一次性归还底层块；
//   3. 整数解析 ParseI64Strict 严格拒绝前导零、空白字符、小数点、科学计数法与 64 位有符号溢出。
#include "mp/base.h"

namespace mp {

namespace {

constexpr usize kArenaChunkBytes = 64 * 1024;

bool IsPowerOfTwo(usize value) { return value != 0 && (value & (value - 1)) == 0; }

}  // namespace

// ---------------------------------------------------------------------------
// 内存原语
// ---------------------------------------------------------------------------
// 字节拷贝：检测区间重叠并选择正向/反向拷贝（memmove 语义）；freestanding 无 libc，
// 重叠区间的正确性不能依赖编译器内置假设。
void MemCopy(void* dst, const void* src, usize bytes) {
  byte* out = static_cast<byte*>(dst);
  const byte* in = static_cast<const byte*>(src);
  if (bytes == 0 || out == in) {
    return;
  }
  if (reinterpret_cast<usize>(out) < reinterpret_cast<usize>(in)) {
    for (usize i = 0; i < bytes; ++i) {
      out[i] = in[i];
    }
  } else {
    for (usize i = bytes; i > 0; --i) {
      out[i - 1] = in[i - 1];
    }
  }
}

void MemSet(void* dst, byte value, usize bytes) {
  byte* out = static_cast<byte*>(dst);
  for (usize i = 0; i < bytes; ++i) {
    out[i] = value;
  }
}

// 字节字典序比较：首个差异字节决定符号，全同为 0——全部确定性排序的底层原语。
int MemCompare(const void* lhs, const void* rhs, usize bytes) {
  const byte* a = static_cast<const byte*>(lhs);
  const byte* b = static_cast<const byte*>(rhs);
  for (usize i = 0; i < bytes; ++i) {
    if (a[i] != b[i]) {
      return a[i] < b[i] ? -1 : 1;
    }
  }
  return 0;
}

usize StrLen(const char* text) {
  if (text == nullptr) {
    return 0;
  }
  usize length = 0;
  while (text[length] != '\0') {
    ++length;
  }
  return length;
}

bool StrEqual(const char* lhs, const char* rhs) {
  if (lhs == rhs) {
    return true;
  }
  if (lhs == nullptr || rhs == nullptr) {
    return false;
  }
  const usize length = StrLen(lhs);
  if (length != StrLen(rhs)) {
    return false;
  }
  return MemCompare(lhs, rhs, length) == 0;
}

usize FormatI64(char* out, usize capacity, i64 value) {
  char scratch[24];
  usize count = 0;
  bool negative = value < 0;
  u64 magnitude = negative ? (~static_cast<u64>(value) + 1u) : static_cast<u64>(value);
  do {
    scratch[count++] = static_cast<char>('0' + static_cast<int>(magnitude % 10u));
    magnitude /= 10u;
  } while (magnitude != 0);
  if (negative) {
    scratch[count++] = '-';
  }
  if (capacity <= count) {
    return 0;
  }
  for (usize i = 0; i < count; ++i) {
    out[i] = scratch[count - 1 - i];
  }
  out[count] = '\0';
  return count;
}

// ---------------------------------------------------------------------------
// Str
// ---------------------------------------------------------------------------
// Str 比较：Equals 按长度+字节全等；Compare 为 UTF-8 字节序字典序（公共前缀时更短者小），
// 是 offerId/planKey/规范化键序等全部确定性排序的统一定义。
bool Str::Equals(Str other) const {
  if (size != other.size) {
    return false;
  }
  if (size == 0) {
    return true;
  }
  return MemCompare(data, other.data, size) == 0;
}

int Str::Compare(Str other) const {
  const usize common = size < other.size ? size : other.size;
  if (common != 0) {
    const int result = MemCompare(data, other.data, common);
    if (result != 0) {
      return result;
    }
  }
  if (size == other.size) {
    return 0;
  }
  return size < other.size ? -1 : 1;
}

// ---------------------------------------------------------------------------
// TextBuffer
// ---------------------------------------------------------------------------
void TextBuffer::Init(Arena* owner) {
  data = nullptr;
  size = 0;
  capacity = 0;
  arena = owner;
}

// 增长策略：从 64 字节起倍增到所需容量；新块分配在 Arena 上并迁移旧内容，旧块不单独
// 释放（Arena 统一回收），因此缓冲容量只增不减、指针在 ReAlloc 间会变化（View 需重取）。
bool TextBuffer::Reserve(usize needed) {
  if (needed <= capacity) {
    return true;
  }
  usize next = capacity == 0 ? 64 : capacity;
  while (next < needed) {
    next *= 2;
  }
  char* fresh = static_cast<char*>(arena->Alloc(next, 8));
  if (fresh == nullptr) {
    return false;
  }
  if (data != nullptr && size != 0) {
    MemCopy(fresh, data, size);
  }
  data = fresh;
  capacity = next;
  return true;
}

bool TextBuffer::Append(const char* bytes, usize length) {
  if (length == 0) {
    return true;
  }
  if (!Reserve(size + length + 1)) {
    return false;
  }
  MemCopy(data + size, bytes, length);
  size += length;
  data[size] = '\0';
  return true;
}

bool TextBuffer::Append(const char* cstr) { return Append(cstr, StrLen(cstr)); }

bool TextBuffer::AppendChar(char c) {
  if (!Reserve(size + 2)) {
    return false;
  }
  data[size++] = c;
  data[size] = '\0';
  return true;
}

// 整数追加：FormatI64 失败（缓冲不足，理论不可达）时按错误处理，不写半截内容。
bool TextBuffer::AppendI64(i64 value) {
  char scratch[24];
  const usize written = FormatI64(scratch, sizeof(scratch), value);
  if (written == 0 && value != 0) {
    return false;
  }
  return Append(scratch, written);
}

bool TextBuffer::AppendU32(u32 value) { return AppendI64(static_cast<i64>(value)); }

TextBuffer* Arena::NewTextBuffer() {
  TextBuffer* buffer = New<TextBuffer>();
  if (buffer != nullptr) {
    buffer->Init(this);
  }
  return buffer;
}

// ---------------------------------------------------------------------------
// Arena
// ---------------------------------------------------------------------------
struct Arena::Block {
  Block* next;
  byte* payload;
  usize capacity;
  usize used;
};

Arena::Arena() : head_(nullptr), used_(0) {}

Arena::~Arena() {
  Reset();
}

void* Arena::Alloc(usize bytes, usize alignment) {
  if (bytes == 0) {
    bytes = 1;
  }
  if (!IsPowerOfTwo(alignment)) {
    alignment = 8;
  }
  for (Block* block = head_; block != nullptr; block = block->next) {
    const usize base = reinterpret_cast<usize>(block->payload) + block->used;
    const usize aligned = (base + (alignment - 1)) & ~(alignment - 1);
    const usize limit = reinterpret_cast<usize>(block->payload) + block->capacity;
    if (aligned + bytes <= limit) {
      block->used = aligned - reinterpret_cast<usize>(block->payload) + bytes;
      used_ += bytes;
      void* result = reinterpret_cast<void*>(aligned);
      MemSet(result, 0, bytes);
      return result;
    }
  }
  const usize overhead = sizeof(Block) + alignment;
  usize capacity = kArenaChunkBytes;
  if (bytes + overhead > capacity) {
    capacity = bytes + overhead;
  }
  void* raw = RawAlloc(sizeof(Block) + capacity);
  if (raw == nullptr) {
    return nullptr;
  }
  Block* block = static_cast<Block*>(raw);
  block->next = head_;
  block->payload = reinterpret_cast<byte*>(block) + sizeof(Block);
  block->capacity = capacity;
  block->used = 0;
  head_ = block;

  const usize base = reinterpret_cast<usize>(block->payload);
  const usize aligned = (base + (alignment - 1)) & ~(alignment - 1);
  block->used = aligned - base + bytes;
  used_ += bytes;
  void* result = reinterpret_cast<void*>(aligned);
  MemSet(result, 0, bytes);
  return result;
}

void Arena::Reset() {
  Block* block = head_;
  while (block != nullptr) {
    Block* next = block->next;
    RawFree(block);
    block = next;
  }
  head_ = nullptr;
  used_ = 0;
}

// ---------------------------------------------------------------------------
// 错误与上下文
// ---------------------------------------------------------------------------
void ErrorInfo::Clear() {
  failed = false;
  code = Str();
  fieldPath = Str();
  message = Str();
}

ExecContext::ExecContext() { error_.Clear(); }

ExecContext::~ExecContext() = default;

namespace {

Str StoreText(Arena& arena, const char* text) {
  const usize length = StrLen(text);
  char* copy = static_cast<char*>(arena.Alloc(length + 1, 1));
  if (copy == nullptr) {
    return Str();
  }
  MemCopy(copy, text, length);
  copy[length] = '\0';
  return Str(copy, length);
}

}  // namespace

bool ExecContext::Fail(const char* code, const char* fieldPath, const char* message) {
  if (error_.failed) {
    return false;
  }
  error_.failed = true;
  error_.code = StoreText(arena_, code);
  error_.fieldPath = StoreText(arena_, fieldPath);
  error_.message = StoreText(arena_, message);
  return false;
}

bool ExecContext::FailI64(const char* code, const char* fieldPath, const char* messagePattern,
                          i64 value) {
  char formatted[192];
  usize cursor = 0;
  while (*messagePattern != '\0' && cursor + 1 < sizeof(formatted)) {
    if (messagePattern[0] == '%' && messagePattern[1] == 'd') {
      char number[24];
      const usize written = FormatI64(number, sizeof(number), value);
      for (usize i = 0; i < written && cursor + 1 < sizeof(formatted); ++i) {
        formatted[cursor++] = number[i];
      }
      messagePattern += 2;
      continue;
    }
    formatted[cursor++] = *messagePattern++;
  }
  formatted[cursor] = '\0';
  return Fail(code, fieldPath, formatted);
}

bool ExecContext::FailInternal(const char* where, const char* message) {
  return Fail("INTERNAL_ERROR", where, message);
}

void ExecContext::ResetError() { error_.Clear(); }

// ---------------------------------------------------------------------------
// UTF-8 合法性
// ---------------------------------------------------------------------------
bool IsValidUtf8(const char* data, usize size) {
  if (data == nullptr) {
    return size == 0;
  }
  usize i = 0;
  while (i < size) {
    const u8 lead = static_cast<u8>(data[i]);
    if (lead < 0x80) {
      ++i;
      continue;
    }
    usize extra = 0;
    u32 codePoint = 0;
    if ((lead & 0xE0) == 0xC0) {
      extra = 1;
      codePoint = lead & 0x1Fu;
    } else if ((lead & 0xF0) == 0xE0) {
      extra = 2;
      codePoint = lead & 0x0Fu;
    } else if ((lead & 0xF8) == 0xF0) {
      extra = 3;
      codePoint = lead & 0x07u;
    } else {
      return false;
    }
    if (i + extra >= size) {
      return false;  // 续字节不足
    }
    for (usize k = 1; k <= extra; ++k) {
      if (i + k >= size) {
        return false;
      }
      const u8 continuation = static_cast<u8>(data[i + k]);
      if ((continuation & 0xC0) != 0x80) {
        return false;
      }
      codePoint = (codePoint << 6) | (continuation & 0x3Fu);
    }
    if ((extra == 1 && codePoint < 0x80) || (extra == 2 && codePoint < 0x800) ||
        (extra == 3 && codePoint < 0x10000)) {
      return false;  // 过长编码
    }
    if (codePoint > 0x10FFFF || (codePoint >= 0xD800 && codePoint <= 0xDFFF)) {
      return false;
    }
    i += extra + 1;
  }
  return true;
}

}  // namespace mp

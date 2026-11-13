// mp/base.h — 共享核心的基础层（freestanding 风格）
//
// 为什么不用 STL：本核心要同时编到原生（MSVC）和 WASM。
// WASM 侧用 clang -target wasm32-freestanding -nostdlib 产出“零 import”模块，
// 以便小程序宿主直接实例化；该目标下没有 libc/libc++ 头文件，因此这里只依赖
// 编译器自带的 freestanding 头（stdint.h / stddef.h），内存原语自己实现。
#ifndef MP_BASE_H
#define MP_BASE_H

#include <stdint.h>
#include <stddef.h>

#if defined(__wasm__) || defined(__EMSCRIPTEN__)
#define MP_WASM 1
#else
#define MP_WASM 0
#endif

namespace mp {

using i32 = int32_t;
using u8 = uint8_t;
using u32 = uint32_t;
using u64 = uint64_t;
using i64 = int64_t;
using usize = size_t;
using byte = unsigned char;

// ---------------------------------------------------------------------------
// 内存原语（无 libc 依赖）
// ---------------------------------------------------------------------------
void MemCopy(void* dst, const void* src, usize bytes);
void MemSet(void* dst, byte value, usize bytes);
int MemCompare(const void* lhs, const void* rhs, usize bytes);
usize StrLen(const char* text);
bool StrEqual(const char* lhs, const char* rhs);

// ---------------------------------------------------------------------------
// 原始分配：按平台实现（platform_native.cpp / platform_wasm.cpp）
// 只被 Arena、输入输出缓冲使用；业务代码一律走 Arena。
// ---------------------------------------------------------------------------
void* RawAlloc(usize bytes);
void RawFree(void* pointer);

// Monotonic milliseconds for optional solve deadlines; never read for null limits.
double MonotonicMilliseconds();

// ---------------------------------------------------------------------------
// 字符串视图：不拥有内存，指向 Arena 或输入缓冲
// ---------------------------------------------------------------------------
struct Str {
  const char* data;
  usize size;

  Str() : data(nullptr), size(0) {}
  Str(const char* text, usize length) : data(text), size(length) {}
  explicit Str(const char* cstr) : data(cstr), size(cstr == nullptr ? 0 : StrLen(cstr)) {}

  bool Empty() const { return size == 0; }
  char At(usize index) const { return data[index]; }
  bool Equals(Str other) const;
  bool Equals(const char* cstr) const { return Equals(Str(cstr)); }
  int Compare(Str other) const;
};

// ---------------------------------------------------------------------------
// 可增长字符串（Arena 持有，不单独释放）
// ---------------------------------------------------------------------------
struct TextBuffer {
  char* data;
  usize size;
  usize capacity;
  class Arena* arena;

  void Init(class Arena* owner);
  bool Reserve(usize needed);
  bool Append(const char* bytes, usize length);
  bool Append(Str text) { return Append(text.data, text.size); }
  bool Append(const char* cstr);
  bool AppendChar(char c);
  bool AppendI64(i64 value);
  bool AppendU32(u32 value);
  Str View() const { return Str(data, size); }
  // 追加 C 字符串字面量，兼容逐字符构建
  bool AppendRaw(const char* cstr) { return Append(cstr); }
};

// ---------------------------------------------------------------------------
// Arena：单次请求生命周期的批量分配器，整块回收
// ---------------------------------------------------------------------------
class Arena {
 public:
  Arena();
  ~Arena();

  // 分配并按 8 字节对齐清零
  void* Alloc(usize bytes, usize alignment = 8);
  // 分配一个值初始化对象（不使用 placement new，保持 freestanding）
  template <class T>
  T* New() {
    void* raw = Alloc(sizeof(T), alignof(T));
    T* object = static_cast<T*>(raw);
    *object = T();
    return object;
  }
  TextBuffer* NewTextBuffer();

  void Reset();
  usize BytesUsed() const { return used_; }

 private:
  struct Block;
  Block* head_;
  usize used_;
  Arena(const Arena&) = delete;
  Arena& operator=(const Arena&) = delete;
};

// ---------------------------------------------------------------------------
// 简单动态数组（Arena 持有旧缓冲，不做释放）
// ---------------------------------------------------------------------------
template <class T>
class Vec {
 public:
  void Init(Arena* arena) {
    arena_ = arena;
    data_ = nullptr;
    size_ = 0;
    capacity_ = 0;
  }

  usize Size() const { return size_; }
  bool Empty() const { return size_ == 0; }
  T* Data() { return data_; }
  const T* Data() const { return data_; }

  T& operator[](usize index) { return data_[index]; }
  const T& operator[](usize index) const { return data_[index]; }

  bool Push(const T& value) {
    if (!Grow(size_ + 1)) {
      return false;
    }
    data_[size_] = value;
    ++size_;
    return true;
  }

  void Clear() { size_ = 0; }

 private:
  bool Grow(usize needed) {
    if (needed <= capacity_) {
      return true;
    }
    usize next = capacity_ == 0 ? 4 : capacity_ * 2;
    // 循环推进与边界守卫：当条件 (next < needed) 成立时持续处理，确保有界终止
    while (next < needed) {
      next *= 2;
    }
    T* fresh = static_cast<T*>(arena_->Alloc(sizeof(T) * next, alignof(T)));
    if (fresh == nullptr) {
      return false;
    }
    // 确定性顺序遍历循环（继续条件：i < size_），保持跨平台与跨宿主迭代次序一致
    for (usize i = 0; i < size_; ++i) {
      fresh[i] = data_[i];
    }
    data_ = fresh;
    capacity_ = next;
    return true;
  }

  Arena* arena_;
  T* data_;
  usize size_;
  usize capacity_;
};

// ---------------------------------------------------------------------------
// 错误与执行上下文
// 契约矛盾点一律在入口转成可见错误，不吞错、不返回默认值伪装成功。
// ---------------------------------------------------------------------------
struct ErrorInfo {
  bool failed;
  Str code;        // 稳定错误码
  Str fieldPath;   // 可定位的字段路径，如 "$.profile.ageYears"
  Str message;     // 人类可读说明

  void Clear();
};

class ExecContext {
 public:
  ExecContext();
  ~ExecContext();

  Arena& Memory() { return arena_; }
  ErrorInfo& Error() { return error_; }
  bool Failed() const { return error_.failed; }

  // 记录失败；message 存入 Arena，调用方无需管生命周期
  bool Fail(const char* code, const char* fieldPath, const char* message);
  // 带一个整数占位（%d）的失败
  bool FailI64(const char* code, const char* fieldPath, const char* messagePattern, i64 value);
  // 内部不变量：本子交付中由单元测试直接触发，入口转 INTERNAL_ERROR
  bool FailInternal(const char* where, const char* message);

  void ResetError();

 private:
  Arena arena_;
  ErrorInfo error_;
  ExecContext(const ExecContext&) = delete;
  ExecContext& operator=(const ExecContext&) = delete;
};

// UTF-8 合法性（输入边界校验用）
bool IsValidUtf8(const char* data, usize size);

// 十进制格式化，返回写入的字符数（不含结尾 '\0'）；容量不足返回 0
usize FormatI64(char* out, usize capacity, i64 value);

}  // namespace mp

#endif  // MP_BASE_H

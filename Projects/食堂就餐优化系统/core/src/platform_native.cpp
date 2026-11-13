// 模块说明：原生平台（Windows / POSIX CLI 与单测）底层页分配适配层，基于标准 malloc/free 提供宿主堆块支持。
// platform_native.cpp — 原生目标（MSVC）的原始分配后端
#include "mp/base.h"

#if !MP_WASM

#include <stdlib.h>
#include <chrono>

namespace mp {
#if !defined(MP_TEST_CLOCK)
double MonotonicMilliseconds() {
  return std::chrono::duration<double, std::milli>(
      std::chrono::steady_clock::now().time_since_epoch()).count();
}
#endif


// 原生后端：直接 malloc/free（0 字节按 1 处理）；MonotonicMilliseconds 用 steady_clock，
// 测试可用 MP_TEST_CLOCK 宏注入确定时钟（WASM 侧则来自宿主 env.mp_monotonic_ms 导入）。
void* RawAlloc(usize bytes) {
  if (bytes == 0) {
    bytes = 1;
  }
  return malloc(bytes);
}

void RawFree(void* pointer) { free(pointer); }

}  // namespace mp

#endif  // !MP_WASM

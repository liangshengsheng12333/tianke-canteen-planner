// mp/api.h — C ABI（原生 CLI 与 WASM 宿主共用同一组入口）
//
// 结果块内存布局（由本核心分配，调用方用 mp_free 释放恰好一次）：
//   [0..3]  u32 小端：载荷 UTF-8 字节数
//   [4..7]  u32 小端：保留，恒为 0
//   [8..]   载荷：完整 ResultEnvelope JSON（未包含结尾 '\0'，第 8+len 字节补了一个便利的 '\0'）
//
// 生命周期约定：
//   * 输入缓冲由调用方用 mp_alloc 分配并写入，调用 mp_* 入口后由调用方 mp_free 释放；
//   * 输出块由核心分配，调用方先把字节复制到宿主内存，再 mp_free 释放恰好一次；
//   * mp_contract_version 返回静态只读字符串，不得释放；
//   * mp_free 之后该指针不会被再次分发（WASM 后端为 bump + 全部释放后整体回收）。
#ifndef MP_API_H
#define MP_API_H

#include <stdint.h>

#if defined(__wasm__) || defined(__EMSCRIPTEN__)
#define MP_API_EXPORT(name) __attribute__((export_name(name)))
#else
#define MP_API_EXPORT(name)
#endif

#ifdef __cplusplus
extern "C" {
#endif

// 接口版本：本实现为 1
MP_API_EXPORT("mp_api_version") uint32_t mp_api_version(void);

// 契约版本字符串，静态只读，不释放
MP_API_EXPORT("mp_contract_version") const char* mp_contract_version(void);

// 从核心分配器取内存；返回 0 表示真实分配失败
MP_API_EXPORT("mp_alloc") void* mp_alloc(uint32_t size);

// 释放恰好一次；对已释放指针重复调用是安全的空操作
MP_API_EXPORT("mp_free") void mp_free(void* pointer);

// 以下四个入口返回结果块指针；返回 0 仅表示真实分配失败
MP_API_EXPORT("mp_plan") void* mp_plan(const char* input, uint32_t length);
MP_API_EXPORT("mp_nutrition_target") void* mp_nutrition_target(const char* input, uint32_t length);
MP_API_EXPORT("mp_validate_menu") void* mp_validate_menu(const char* input, uint32_t length);
MP_API_EXPORT("mp_offer_nutrition") void* mp_offer_nutrition(const char* input, uint32_t length);

#ifdef __cplusplus
}
#endif

#endif  // MP_API_H

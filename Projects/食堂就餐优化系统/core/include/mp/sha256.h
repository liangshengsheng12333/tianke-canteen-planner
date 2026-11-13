// mp/sha256.h — SHA-256（用于 nutritionConfig 快照哈希与 catalogHash）
//
// 只依赖 freestanding 头，可在原生与 WASM 两个目标下编译。
#ifndef MP_SHA256_H
#define MP_SHA256_H

#include <stddef.h>
#include <stdint.h>

namespace mp {

constexpr size_t kSha256Bytes = 32;
constexpr size_t kSha256HexChars = 64;

struct Sha256Digest {
  uint8_t bytes[kSha256Bytes];
};

// 计算 data[0..length) 的 SHA-256
void Sha256(const void* data, size_t length, Sha256Digest* digest);

// 转小写十六进制，outHex 需至少 65 字节（含结尾 '\0'）
void Sha256ToHexLower(const Sha256Digest& digest, char* outHex);

// 便捷函数：直接写出 "sha256:<64 hex>"，out 至少 72 字节
void Sha256PrefixedHexLower(const void* data, size_t length, char* out);

}  // namespace mp

#endif  // MP_SHA256_H

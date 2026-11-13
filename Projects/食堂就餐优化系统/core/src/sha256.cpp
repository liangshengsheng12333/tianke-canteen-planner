// 模块说明：FIPS 180-4 标准 SHA-256 密码学哈希算法纯手写无依赖实现。
// 用途：用于计算 catalogHash（sha256:<64位小写hex>）、nutritionConfigHash 以及全天规划方案稳定键 planKey（plan:<64位小写hex>）。
// mp/sha256.cpp — SHA-256 实现（FIPS 180-4），freestanding 风格。
//
// 为什么不用 STL：本核心同时编到原生（MSVC）和 wasm32-freestanding -nostdlib，
// 该目标没有 libc/libc++ 头文件。这里只用到编译器自带的 freestanding 头，
// 全部状态放在栈上，不抛异常、不做动态分配，字节读写自己循环完成。
#include "mp/sha256.h"

namespace mp {

namespace {

// 64 轮常量：前 64 个素数立方根小数部分的前 32 位（FIPS 180-4 §4.2.2）。
constexpr uint32_t kRoundConstants[64] = {
    0x428a2f98u, 0x71374491u, 0xb5c0fbcfu, 0xe9b5dba5u, 0x3956c25bu, 0x59f111f1u,
    0x923f82a4u, 0xab1c5ed5u, 0xd807aa98u, 0x12835b01u, 0x243185beu, 0x550c7dc3u,
    0x72be5d74u, 0x80deb1feu, 0x9bdc06a7u, 0xc19bf174u, 0xe49b69c1u, 0xefbe4786u,
    0x0fc19dc6u, 0x240ca1ccu, 0x2de92c6fu, 0x4a7484aau, 0x5cb0a9dcu, 0x76f988dau,
    0x983e5152u, 0xa831c66du, 0xb00327c8u, 0xbf597fc7u, 0xc6e00bf3u, 0xd5a79147u,
    0x06ca6351u, 0x14292967u, 0x27b70a85u, 0x2e1b2138u, 0x4d2c6dfcu, 0x53380d13u,
    0x650a7354u, 0x766a0abbu, 0x81c2c92eu, 0x92722c85u, 0xa2bfe8a1u, 0xa81a664bu,
    0xc24b8b70u, 0xc76c51a3u, 0xd192e819u, 0xd6990624u, 0xf40e3585u, 0x106aa070u,
    0x19a4c116u, 0x1e376c08u, 0x2748774cu, 0x34b0bcb5u, 0x391c0cb3u, 0x4ed8aa4au,
    0x5b9cca4fu, 0x682e6ff3u, 0x748f82eeu, 0x78a5636fu, 0x84c87814u, 0x8cc70208u,
    0x90befffau, 0xa4506cebu, 0xbef9a3f7u, 0xc67178f2u,
};

// 初始哈希值：前 8 个素数平方根小数部分的前 32 位（FIPS 180-4 §5.3.3）。
constexpr uint32_t kInitialState[8] = {
    0x6a09e667u, 0xbb67ae85u, 0x3c6ef372u, 0xa54ff53au,
    0x510e527fu, 0x9b05688cu, 0x1f83d9abu, 0x5be0cd19u,
};

// 压缩函数的 32 位循环右移。
inline uint32_t RotateRight(uint32_t value, uint32_t bits) {
  return (value >> bits) | (value << (32u - bits));
}

// FIPS 180-4 §4.1.2 布尔函数：Ch 选择、Maj 多数表决、Σ/σ 用于轮更新与消息扩展。
inline uint32_t Ch(uint32_t x, uint32_t y, uint32_t z) {
  return (x & y) ^ (~x & z);
}

inline uint32_t Maj(uint32_t x, uint32_t y, uint32_t z) {
  return (x & y) ^ (x & z) ^ (y & z);
}

// Σ0 / Σ1：小写 sigma，用于消息扩展（FIPS 180-4 §4.1.2）。
inline uint32_t SmallSigma0(uint32_t x) {
  return RotateRight(x, 7u) ^ RotateRight(x, 18u) ^ (x >> 3);
}

inline uint32_t SmallSigma1(uint32_t x) {
  return RotateRight(x, 17u) ^ RotateRight(x, 19u) ^ (x >> 10);
}

// 大写 Sigma，用于轮函数状态更新。
inline uint32_t BigSigma0(uint32_t x) {
  return RotateRight(x, 2u) ^ RotateRight(x, 13u) ^ RotateRight(x, 22u);
}

inline uint32_t BigSigma1(uint32_t x) {
  return RotateRight(x, 6u) ^ RotateRight(x, 11u) ^ RotateRight(x, 25u);
}

// 处理一个 512 位块：块内字节按大端解释成 16 个 32 位字。
// 压缩函数：64 字节块按大端解释为 16 字，扩展到 64 字后跑 64 轮（FIPS 180-4 §6.2）。
void CompressBlock(uint32_t state[8], const uint8_t block[64]) {
  uint32_t words[64];
  for (uint32_t i = 0; i < 16u; ++i) {
    const uint32_t base = i * 4u;
    words[i] = (static_cast<uint32_t>(block[base]) << 24) |
               (static_cast<uint32_t>(block[base + 1u]) << 16) |
               (static_cast<uint32_t>(block[base + 2u]) << 8) |
               static_cast<uint32_t>(block[base + 3u]);
  }
  for (uint32_t i = 16u; i < 64u; ++i) {
    words[i] = words[i - 16u] + SmallSigma0(words[i - 15u]) + words[i - 7u] +
               SmallSigma1(words[i - 2u]);
  }

  uint32_t a = state[0];
  uint32_t b = state[1];
  uint32_t c = state[2];
  uint32_t d = state[3];
  uint32_t e = state[4];
  uint32_t f = state[5];
  uint32_t g = state[6];
  uint32_t h = state[7];

  for (uint32_t i = 0; i < 64u; ++i) {
    const uint32_t temp1 = h + BigSigma1(e) + Ch(e, f, g) + kRoundConstants[i] + words[i];
    const uint32_t temp2 = BigSigma0(a) + Maj(a, b, c);
    h = g;
    g = f;
    f = e;
    e = d + temp1;
    d = c;
    c = b;
    b = a;
    a = temp1 + temp2;
  }

  state[0] += a;
  state[1] += b;
  state[2] += c;
  state[3] += d;
  state[4] += e;
  state[5] += f;
  state[6] += g;
  state[7] += h;
}

}  // namespace

// 单次摘要：0x80 补位 + 64 位大端长度，整块逐个压缩；无动态分配，全部状态在栈上。
void Sha256(const void* data, size_t length, Sha256Digest* digest) {
  if (digest == nullptr) {
    return;
  }

  uint32_t state[8];
  for (size_t i = 0; i < 8u; ++i) {
    state[i] = kInitialState[i];
  }

  // 1) 逐块消化完整输入。
  const uint8_t* input = static_cast<const uint8_t*>(data);
  size_t offset = 0;
  while (length - offset >= 64u) {
    CompressBlock(state, input + offset);
    offset += 64u;
  }

  // 2) 长度填充：追加 0x80，补 0 到 56 mod 64，末尾 8 字节写大端 bit 长度。
  const size_t remaining = length - offset;
  uint8_t block[64];
  for (size_t i = 0; i < remaining; ++i) {
    block[i] = input[offset + i];
  }
  block[remaining] = 0x80u;
  if (remaining >= 56u) {
    for (size_t i = remaining + 1u; i < 64u; ++i) {
      block[i] = 0u;
    }
    CompressBlock(state, block);
    for (size_t i = 0; i < 56u; ++i) {
      block[i] = 0u;
    }
  } else {
    for (size_t i = remaining + 1u; i < 56u; ++i) {
      block[i] = 0u;
    }
  }

  const uint64_t bitLength = static_cast<uint64_t>(length) * 8u;
  for (size_t i = 0; i < 8u; ++i) {
    block[56u + i] = static_cast<uint8_t>(bitLength >> ((7u - i) * 8u));
  }
  CompressBlock(state, block);

  // 3) 输出 8 个大端 32 位字。
  for (size_t i = 0; i < 8u; ++i) {
    const uint32_t word = state[i];
    const size_t base = i * 4u;
    digest->bytes[base] = static_cast<uint8_t>(word >> 24);
    digest->bytes[base + 1u] = static_cast<uint8_t>(word >> 16);
    digest->bytes[base + 2u] = static_cast<uint8_t>(word >> 8);
    digest->bytes[base + 3u] = static_cast<uint8_t>(word);
  }
}

// 摘要转 64 字符小写 hex（不含前缀，调用方缓冲需 ≥ kSha256HexChars+1）。
void Sha256ToHexLower(const Sha256Digest& digest, char* outHex) {
  if (outHex == nullptr) {
    return;
  }
  constexpr char kHexDigits[17] = "0123456789abcdef";
  for (size_t i = 0; i < kSha256Bytes; ++i) {
    const uint8_t value = digest.bytes[i];
    outHex[i * 2u] = kHexDigits[value >> 4];
    outHex[i * 2u + 1u] = kHexDigits[value & 0x0fu];
  }
  outHex[kSha256HexChars] = '\0';
}

// 一步输出 "sha256:<64hex>" 前缀形式，与 catalogHash 等声明格式直接可比。
void Sha256PrefixedHexLower(const void* data, size_t length, char* out) {
  if (out == nullptr) {
    return;
  }
  constexpr char kPrefix[] = "sha256:";
  constexpr size_t kPrefixChars = 7u;
  Sha256Digest digest;
  Sha256(data, length, &digest);
  for (size_t i = 0; i < kPrefixChars; ++i) {
    out[i] = kPrefix[i];
  }
  Sha256ToHexLower(digest, out + kPrefixChars);
}

}  // namespace mp

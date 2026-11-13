// 模块说明：原生命令行宿主入口（mp_cli），用于驱动与 WASM 完全同源的 C ABI 接口。
// 工程约束：
//   1. CLI 层严禁实现任何业务计算、默认填充或入参修补逻辑，仅负责二进制文件读写与缓冲区桥接；
//   2. 输入缓冲区必须通过 mp_alloc 申请并在调用 mp_* 后立即调用 mp_free 释放恰好一次；
//   3. 输出结果块由核心分配，宿主按 [u32 length][u32 reserved][UTF-8 payload] 协议拷贝后调用 mp_free 释放。
// 原生 CLI：读一份真实 JSON 请求，经与 WASM 宿主相同的 C ABI 调用同一份核心，
// 把 ResultEnvelope 原样输出。CLI 不实现任何计算或校验规则。
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "mp/api.h"

namespace {

// 整文件读取：缓冲按文件大小精确分配，读到的字节数与期望不符即失败。
bool ReadWholeFile(const char* path, unsigned char** data, size_t* size) {
  FILE* file = nullptr;
  if (fopen_s(&file, path, "rb") != 0 || file == nullptr) {
    return false;
  }
  if (fseek(file, 0, SEEK_END) != 0) {
    fclose(file);
    return false;
  }
  const long length = ftell(file);
  if (length < 0) {
    fclose(file);
    return false;
  }
  rewind(file);
  const size_t expected = static_cast<size_t>(length);
  unsigned char* buffer = static_cast<unsigned char*>(malloc(expected == 0 ? 1 : expected));
  if (buffer == nullptr) {
    fclose(file);
    return false;
  }
  const size_t read = expected > 0 ? fread(buffer, 1, expected, file) : 0;
  fclose(file);
  if (read != expected) {
    free(buffer);
    return false;
  }
  *data = buffer;
  *size = expected;
  return true;
}

// 整文件写出：flush 成功且写入字节数一致才算成功（避免静默截断）。
bool WriteWholeFile(const char* path, const unsigned char* data, size_t size) {
  FILE* file = nullptr;
  if (fopen_s(&file, path, "wb") != 0 || file == nullptr) {
    return false;
  }
  const size_t written = size > 0 ? fwrite(data, 1, size, file) : 0;
  const bool flushed = fflush(file) == 0;
  fclose(file);
  return flushed && written == size;
}

}  // namespace

// CLI 主流程：读请求文件 → mp_alloc 输入缓冲 → 按命令分发到与 WASM 同源的 C ABI →
// 按 [u32 长度][保留] 头拷贝结果 → mp_free 释放输入与结果块（各恰好一次）。
// 退出码区分错误类别（用法/IO/分配），业务错误一律体现在 ok=false 信封内而非退出码。
int main(int argc, char** argv) {
  if (argc < 3) {
    fprintf(stderr,
            "用法: mp_cli <nutrition-target|plan|validate-menu|offer-nutrition> <request.json> [--out <result.json>]\n");
    return 2;
  }
  const char* command = argv[1];
  const char* inputPath = argv[2];
  const char* outputPath = nullptr;
  for (int i = 3; i < argc; ++i) {
    if (strcmp(argv[i], "--out") == 0 && i + 1 < argc) {
      outputPath = argv[i + 1];
      ++i;
    }
  }

  unsigned char* fileBytes = nullptr;
  size_t fileSize = 0;
  if (!ReadWholeFile(inputPath, &fileBytes, &fileSize)) {
    fprintf(stderr, "mp_cli: 无法读取输入文件: %s\n", inputPath);
    return 3;
  }

  // 与 WASM 宿主完全相同的内存所有权协议：输入由 mp_alloc 取、调用后 mp_free 释放恰好一次
  void* input = mp_alloc(static_cast<uint32_t>(fileSize));
  if (input == nullptr) {
    free(fileBytes);
    fprintf(stderr, "mp_cli: 输入缓冲分配失败\n");
    return 4;
  }
  if (fileSize > 0) {
    memcpy(input, fileBytes, fileSize);
  }
  free(fileBytes);

  void* block = nullptr;
  if (strcmp(command, "plan") == 0) {
    block = mp_plan(static_cast<const char*>(input), static_cast<uint32_t>(fileSize));
  } else if (strcmp(command, "nutrition-target") == 0) {
    block = mp_nutrition_target(static_cast<const char*>(input), static_cast<uint32_t>(fileSize));
  } else if (strcmp(command, "validate-menu") == 0) {
    block = mp_validate_menu(static_cast<const char*>(input), static_cast<uint32_t>(fileSize));
  } else if (strcmp(command, "offer-nutrition") == 0) {
    block = mp_offer_nutrition(static_cast<const char*>(input), static_cast<uint32_t>(fileSize));
  } else {
    mp_free(input);
    fprintf(stderr, "mp_cli: 未知命令: %s\n", command);
    return 2;
  }
  mp_free(input);

  if (block == nullptr) {
    fprintf(stderr, "mp_cli: 核心返回空结果块（真实分配失败）\n");
    return 4;
  }

  const unsigned char* bytes = static_cast<const unsigned char*>(block);
  const uint32_t payload = static_cast<uint32_t>(bytes[0]) |
                           (static_cast<uint32_t>(bytes[1]) << 8) |
                           (static_cast<uint32_t>(bytes[2]) << 16) |
                           (static_cast<uint32_t>(bytes[3]) << 24);

  int exitCode = 0;
  if (outputPath != nullptr) {
    if (!WriteWholeFile(outputPath, bytes + 8, static_cast<size_t>(payload))) {
      exitCode = 5;
    }
  } else {
    if (payload > 0) {
      fwrite(bytes + 8, 1, static_cast<size_t>(payload), stdout);
    }
    fputc('\n', stdout);
  }
  mp_free(block);  // 输出块恰好释放一次
  return exitCode;
}

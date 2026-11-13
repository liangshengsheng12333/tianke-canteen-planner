// 模块说明：SHA-256 哈希算法标准向量（FIPS 180-4 空串、abc、多块长消息、增量流式更新）单元测试套件。
// 单元测试：mp::Sha256 / Sha256ToHexLower / Sha256PrefixedHexLower
//
// 覆盖：FIPS 180-4 / NIST 标准向量、真实只读输入文件摘要、长度填充边界
// （55/56/63/64/65 字节）与输出缓冲契约。测试程序允许依赖 C 运行库。
//
// 运行方式：在项目根目录执行 mp_test_sha256.exe（输入文件按相对路径读取）。
// 输入文件是冻结的 T01 v1.2 营养配置候选，只读核对，本测试不写任何文件。
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "mp/sha256.h"

namespace {

int g_failures = 0;
int g_checks = 0;

void ReportFailure(const char* label, const char* expected, const char* actual) {
  ++g_failures;
  // 执行单元测试章节：[FAIL] %s\n  期望: %s\n  实际: %s\n
  printf("[FAIL] %s\n  期望: %s\n  实际: %s\n", label, expected, actual);
}

void ReportTrueFailure(const char* label, const char* detail) {
  ++g_failures;
  // 执行单元测试章节：[FAIL] %s%s%s\n
  printf("[FAIL] %s%s%s\n", label, (detail == nullptr) ? "" : "：", (detail == nullptr) ? "" : detail);
}

// 用 SHA-256 计算输入，转小写 hex 后与期望字符串比对。
void CheckHexEquals(const char* label, const void* data, size_t length, const char* expectedHex) {
  ++g_checks;
  mp::Sha256Digest digest;
  char actualHex[mp::kSha256HexChars + 1];
  mp::Sha256(data, length, &digest);
  mp::Sha256ToHexLower(digest, actualHex);
  if (strcmp(actualHex, expectedHex) != 0) {
    ReportFailure(label, expectedHex, actualHex);
  }
}

// 生成确定性的边界测试输入：byte[i] = 'a' + (i % 26)。
void FillBoundaryPattern(unsigned char* bytes, size_t length) {
  for (size_t i = 0; i < length; ++i) {
    bytes[i] = static_cast<unsigned char>('a' + (i % 26u));
  }
}

// 边界长度向量：期望值由独立实现（Python 3.12 hashlib）计算后写死，
// 见交付反馈中记录的交叉验证命令。
void CheckBoundaryLengths() {
  const size_t kLengths[5] = {55u, 56u, 63u, 64u, 65u};
  const char* const kExpected[5] = {
      "595615dbe4f0f407ae397d08b4c2cb870cb9b0e11937416f950c5160acf9c005",
      "784f623b787495078e93ff28a25b581df0584055a7e71d8cd90c454716b92f51",
      "5ca3e1ef5207490eac01a795e5cc94d59582a5118bf9534665c8668d87aa647c",
      "2fcd5a0d60e4c941381fcc4e00a4bf8be422c3ddfafb93c809e8d1e2bfffae8e",
      "1b3cd1877ab2f2f19f7be001722554f336cb799df0329de0bb4c118dc6abc06d",
  };
  unsigned char bytes[65];
  FillBoundaryPattern(bytes, sizeof(bytes));
  for (size_t i = 0; i < 5u; ++i) {
    char label[64];
    snprintf(label, sizeof(label), "边界长度 %zu 字节", kLengths[i]);
    CheckHexEquals(label, bytes, kLengths[i], kExpected[i]);
  }
}

// 路径含中文，用宽字符打开，避免窄字符 fopen 受当前 ANSI 代码页影响。
bool ReadWholeFile(const wchar_t* path, unsigned char** outBytes, size_t* outLength) {
  *outBytes = nullptr;
  *outLength = 0;
  FILE* file = nullptr;
  if (_wfopen_s(&file, path, L"rb") != 0 || file == nullptr) {
    return false;
  }
  if (fseek(file, 0, SEEK_END) != 0) {
    fclose(file);
    return false;
  }
  const long end = ftell(file);
  if (end < 0) {
    fclose(file);
    return false;
  }
  if (fseek(file, 0, SEEK_SET) != 0) {
    fclose(file);
    return false;
  }
  const size_t length = static_cast<size_t>(end);
  unsigned char* bytes = static_cast<unsigned char*>(malloc(length == 0u ? 1u : length));
  if (bytes == nullptr) {
    fclose(file);
    return false;
  }
  size_t readLength = 0;
  if (length != 0u) {
    readLength = fread(bytes, 1, length, file);
  }
  fclose(file);
  if (readLength != length) {
    free(bytes);
    return false;
  }
  *outBytes = bytes;
  *outLength = length;
  return true;
}

// 真实只读输入文件：T01 v1.2 营养配置候选的原字节摘要。
//
// 期望值由独立工具现场复算（见交付反馈中的 Get-FileHash / certutil 证据）：
//   Resources\契约\T01-v1.2-candidate\nutrition-v1-candidate.json
//   SHA256 8254AB22DCA9CEEA1E41F575373442781AE7184DE40169041FD02B2E8308D191（19077 字节）
// 这条同时验证“一次性哈希与分块无关”和 hex 输出格式（输出为小写、带 sha256: 前缀）。
void CheckRealInputFile() {
  const wchar_t* path = L"Resources/契约/T01-v1.2-candidate/nutrition-v1-candidate.json";
  const char* expected = "sha256:8254ab22dca9ceea1e41f575373442781ae7184de40169041fd02b2e8308d191";
  ++g_checks;
  unsigned char* bytes = nullptr;
  size_t length = 0;
  if (!ReadWholeFile(path, &bytes, &length)) {
    ReportTrueFailure("营养配置候选文件读取失败", "Resources/契约/T01-v1.2-candidate/nutrition-v1-candidate.json");
    return;
  }
  char actual[72];
  memset(actual, 0, sizeof(actual));
  mp::Sha256PrefixedHexLower(bytes, length, actual);
  if (strcmp(actual, expected) != 0) {
    printf("  文件长度: %zu 字节\n", length);
    ReportFailure("nutrition-v1-candidate.json 原字节摘要", expected, actual);
  }
  ++g_checks;
  if (length != 19077u) {
    printf("  实际文件长度: %zu 字节（期望 19077）\n", length);
    ReportTrueFailure("nutrition-v1-candidate.json 长度", "疑似文件已被改动");
  }
  free(bytes);
}

// 输出缓冲契约：hex 写 64 字符 + '\0'，prefixed 写 "sha256:" + 64 hex + '\0'。
void CheckOutputContracts() {
  mp::Sha256Digest digest;
  mp::Sha256("abc", 3u, &digest);

  char hex[66];
  memset(hex, '#', sizeof(hex));
  mp::Sha256ToHexLower(digest, hex);
  ++g_checks;
  if (hex[mp::kSha256HexChars] != '\0') {
    ReportTrueFailure("Sha256ToHexLower 未写结尾 '\\0'", nullptr);
  }
  ++g_checks;
  if (hex[mp::kSha256HexChars + 1u] != '#') {
    ReportTrueFailure("Sha256ToHexLower 越界写入", nullptr);
  }
  ++g_checks;
  {
    bool lower = true;
    for (size_t i = 0; i < mp::kSha256HexChars; ++i) {
      const char c = hex[i];
      const bool ok = (c >= '0' && c <= '9') || (c >= 'a' && c <= 'f');
      if (!ok) {
        lower = false;
        break;
      }
    }
    if (!lower) {
      ReportTrueFailure("Sha256ToHexLower 输出了非小写 hex 字符", hex);
    }
  }

  char prefixed[73];
  memset(prefixed, '#', sizeof(prefixed));
  mp::Sha256PrefixedHexLower("abc", 3u, prefixed);
  ++g_checks;
  if (strncmp(prefixed, "sha256:", 7u) != 0) {
    ReportTrueFailure("Sha256PrefixedHexLower 前缀错误", prefixed);
  }
  ++g_checks;
  if (prefixed[71] != '\0') {
    ReportTrueFailure("Sha256PrefixedHexLower 未写结尾 '\\0'", nullptr);
  }
  ++g_checks;
  if (prefixed[72] != '#') {
    ReportTrueFailure("Sha256PrefixedHexLower 越界写入", nullptr);
  }
  ++g_checks;
  if (strcmp(prefixed + 7, hex) != 0) {
    ReportTrueFailure("prefixed 摘要主体与 Sha256ToHexLower 不一致", prefixed);
  }
}

}  // namespace

int main(int argc, char** argv) {
  (void)argc;
  (void)argv;

  // 1) NIST 标准向量（期望小写 hex）。
  CheckHexEquals("空串",
                 "",
                 0u,
                 "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  CheckHexEquals("abc",
                 "abc",
                 3u,
                 "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
  {
    const char* message = "abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq";
    CheckHexEquals("两个 448 位块（56 字节）消息",
                   message,
                   strlen(message),
                   "248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1");
  }
  {
    const size_t kOneMillion = 1000000u;
    unsigned char* millionA = static_cast<unsigned char*>(malloc(kOneMillion));
    ++g_checks;
    if (millionA == nullptr) {
      ReportTrueFailure("1,000,000 个 'a'：内存分配失败", nullptr);
    } else {
      memset(millionA, 'a', kOneMillion);
      CheckHexEquals("1,000,000 个 'a'",
                     millionA,
                     kOneMillion,
                     "cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0");
      free(millionA);
    }
  }

  // 2) 全零长度且 data 为空指针：应等价于空串摘要（防御性调用）。
  {
    ++g_checks;
    mp::Sha256Digest digest;
    char actualHex[mp::kSha256HexChars + 1];
    mp::Sha256(nullptr, 0u, &digest);
    mp::Sha256ToHexLower(digest, actualHex);
    const char* expected = "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
    if (strcmp(actualHex, expected) != 0) {
      ReportFailure("data=nullptr, length=0", expected, actualHex);
    }
  }

  // 3) 长度填充边界：55/56/63/64/65 字节。
  CheckBoundaryLengths();

  // 4) 真实只读输入文件摘要（T01 v1.2 营养配置候选）。
  CheckRealInputFile();

  // 5) 输出缓冲契约。
  CheckOutputContracts();

  if (g_failures == 0) {
    printf("ALL PASS (%d checks)\n", g_checks);
    return 0;
  }
  printf("FAILED: %d of %d checks failed\n", g_failures, g_checks);
  return 1;
}

// 模块说明：JSON 解析器、规范化排序写出器（Canonical JSON）、UTF-8 边界与非法的确定性单元测试套件。
// test_json_main.cpp — mp/json.h 的单元测试
//
// 必须在项目根目录运行（夹具用相对路径；含中文目录，走 _wfopen 宽字符路径，
// 避免窄字符 fopen 受系统 ANSI 代码页影响）。
// 全部通过打印 ALL PASS 并返回 0；否则打印失败项并返回 1。
#include <stdio.h>

#include "mp/json.h"

namespace {

int g_checks = 0;
int g_failures = 0;

// 断言辅助：只计数与打印，不中断流程，便于一次运行暴露全部失败项。
void Check(bool condition, const char* label) {
  ++g_checks;
  if (!condition) {
    ++g_failures;
    printf("FAIL: %s\n", label);
  }
}

void PrintByteWindow(const char* label, const char* data, mp::usize size, mp::usize from,
                     mp::usize to) {
  printf("  %s[%llu..]: ", label, static_cast<unsigned long long>(from));
  for (mp::usize i = from; i < to && i < size; ++i) {
    const unsigned char c = static_cast<unsigned char>(data[i]);
    if (c >= 0x20 && c < 0x7F) {
      printf("%c", static_cast<char>(c));
    } else {
      printf("\\x%02x", static_cast<unsigned int>(c));
    }
  }
  printf("\n");
}

// 逐字节比较；不一致时打印首个差异位置与前后各 24 字节上下文。
bool ExpectBytesEqual(const char* label, const char* actual, mp::usize actualSize,
                      const char* expected, mp::usize expectedSize) {
  ++g_checks;
  bool equal = actualSize == expectedSize;
  if (equal) {
    for (mp::usize i = 0; i < actualSize; ++i) {
      if (actual[i] != expected[i]) {
        equal = false;
        break;
      }
    }
  }
  if (equal) {
    return true;
  }
  ++g_failures;
  printf("FAIL: %s (actual %llu bytes, expected %llu bytes)\n", label,
         static_cast<unsigned long long>(actualSize),
         static_cast<unsigned long long>(expectedSize));
  const mp::usize common = actualSize < expectedSize ? actualSize : expectedSize;
  mp::usize diff = 0;
  while (diff < common && actual[diff] == expected[diff]) {
    ++diff;
  }
  printf("  first difference at byte %llu\n", static_cast<unsigned long long>(diff));
  const mp::usize windowBegin = diff > 24 ? diff - 24 : 0;
  const mp::usize windowEnd = diff + 24;
  PrintByteWindow("actual  ", actual, actualSize, windowBegin, windowEnd);
  PrintByteWindow("expected", expected, expectedSize, windowBegin, windowEnd);
  return false;
}

bool ReadFileBytes(mp::Arena* arena, const wchar_t* path, char** outData, mp::usize* outSize) {
  FILE* file = nullptr;
  if (_wfopen_s(&file, path, L"rb") != 0 || file == nullptr) {
    printf("ERROR: cannot open %ls (run the test from the project root)\n", path);
    return false;
  }
  if (_fseeki64(file, 0, SEEK_END) != 0) {
    fclose(file);
    printf("ERROR: seek failed for %ls\n", path);
    return false;
  }
  const long long fileSize = _ftelli64(file);
  if (fileSize < 0) {
    fclose(file);
    printf("ERROR: size failed for %ls\n", path);
    return false;
  }
  if (_fseeki64(file, 0, SEEK_SET) != 0) {
    fclose(file);
    printf("ERROR: rewind failed for %ls\n", path);
    return false;
  }
  const mp::usize expectedSize = static_cast<mp::usize>(fileSize);
  char* buffer = static_cast<char*>(arena->Alloc(expectedSize + 1, 1));
  if (buffer == nullptr) {
    fclose(file);
    printf("ERROR: out of memory reading %ls\n", path);
    return false;
  }
  const mp::usize readSize = fread(buffer, 1, expectedSize, file);
  fclose(file);
  if (readSize != expectedSize) {
    printf("ERROR: short read for %ls\n", path);
    return false;
  }
  buffer[readSize] = '\0';
  *outData = buffer;
  *outSize = readSize;
  return true;
}

bool HasErrorPrefix(const char* err) {
  const char* prefix = "at byte ";
  for (mp::usize i = 0; i < 8; ++i) {
    if (err[i] != prefix[i]) {
      return false;
    }
  }
  return mp::StrLen(err) > 8;
}

// ---------------------------------------------------------------------------
// 1. 关键验收：snapshot 规范化序列化 vs 夹具逐字节一致
// ---------------------------------------------------------------------------
void TestCanonicalSnapshot() {
  printf("[case] canonical snapshot\n");
  mp::Arena arena;
  char* jsonBytes = nullptr;
  mp::usize jsonSize = 0;
  if (!ReadFileBytes(&arena, L"Resources\\契约\\T01-v1.2-candidate\\nutrition-v1-candidate.json",
                     &jsonBytes, &jsonSize)) {
    Check(false, "read nutrition-v1-candidate.json");
    return;
  }
  char err[256];
  err[0] = '\0';
  mp::JsonValue* root = mp::JsonParse(&arena, jsonBytes, jsonSize, err, sizeof(err));
  Check(root != nullptr, "parse nutrition-v1-candidate.json");
  if (root == nullptr) {
    printf("  parse error: %s\n", err);
    return;
  }
  const mp::JsonValue* snapshot = mp::JsonFind(root, "snapshot");
  Check(snapshot != nullptr, "find root.snapshot");
  if (snapshot == nullptr) {
    return;
  }
  mp::TextBuffer* out = arena.NewTextBuffer();
  Check(out != nullptr, "allocate canonical buffer");
  if (out == nullptr) {
    return;
  }
  Check(mp::JsonSerializeCanonical(snapshot, out), "serialize snapshot canonically");
  printf("  snapshot canonical length = %llu bytes\n",
         static_cast<unsigned long long>(out->size));

  char* expectedBytes = nullptr;
  mp::usize expectedSize = 0;
  if (!ReadFileBytes(&arena, L"core\\tests\\data\\nutrition-snapshot.canonical.txt",
                     &expectedBytes, &expectedSize)) {
    Check(false, "read nutrition-snapshot.canonical.txt");
    return;
  }
  printf("  fixture length           = %llu bytes\n",
         static_cast<unsigned long long>(expectedSize));
  ExpectBytesEqual("snapshot canonical vs fixture", out->data, out->size, expectedBytes,
                   expectedSize);
}

// ---------------------------------------------------------------------------
// 2. 9 组配对：request 规范化 → 重解析 → 再规范化，往返稳定
// ---------------------------------------------------------------------------
void TestPairRoundTrip() {
  printf("[case] request/result pair round trip\n");
  mp::Arena arena;
  char* jsonBytes = nullptr;
  mp::usize jsonSize = 0;
  if (!ReadFileBytes(&arena, L"Resources\\契约\\T01-v1.2-candidate\\request-result-pair.json",
                     &jsonBytes, &jsonSize)) {
    Check(false, "read request-result-pair.json");
    return;
  }
  char err[256];
  err[0] = '\0';
  mp::JsonValue* root = mp::JsonParse(&arena, jsonBytes, jsonSize, err, sizeof(err));
  Check(root != nullptr, "parse request-result-pair.json");
  if (root == nullptr) {
    printf("  parse error: %s\n", err);
    return;
  }
  const mp::JsonValue* pairs = mp::JsonFind(root, "pairs");
  Check(pairs != nullptr, "find root.pairs");
  if (pairs == nullptr) {
    return;
  }
  Check(pairs->kind == mp::JsonKind::Array, "pairs is array");
  Check(pairs->count == 9, "pairs length is 9");
  printf("  pairs length = %llu\n", static_cast<unsigned long long>(pairs->count));

  mp::usize index = 0;
  for (const mp::JsonValue* pair = pairs->child; pair != nullptr; pair = pair->next, ++index) {
    char label[64];
    snprintf(label, sizeof(label), "pair #%llu request exists",
             static_cast<unsigned long long>(index));
    const mp::JsonValue* request = mp::JsonFind(pair, "request");
    Check(request != nullptr, label);
    if (request == nullptr) {
      continue;
    }
    mp::TextBuffer* firstPass = arena.NewTextBuffer();
    Check(mp::JsonSerializeCanonical(request, firstPass), "serialize pair request");
    snprintf(label, sizeof(label), "pair #%llu reparse",
             static_cast<unsigned long long>(index));
    mp::Arena secondArena;
    char reparseErr[256];
    reparseErr[0] = '\0';
    mp::JsonValue* reparsed =
        mp::JsonParse(&secondArena, firstPass->data, firstPass->size, reparseErr,
                      sizeof(reparseErr));
    Check(reparsed != nullptr, label);
    if (reparsed == nullptr) {
      printf("  reparse error: %s\n", reparseErr);
      continue;
    }
    mp::TextBuffer* secondPass = secondArena.NewTextBuffer();
    Check(mp::JsonSerializeCanonical(reparsed, secondPass), "serialize reparsed request");
    snprintf(label, sizeof(label), "pair #%llu round trip stable",
             static_cast<unsigned long long>(index));
    ExpectBytesEqual(label, secondPass->data, secondPass->size, firstPass->data,
                     firstPass->size);
  }
}

// ---------------------------------------------------------------------------
// 3. 字符串与转义
// ---------------------------------------------------------------------------
struct StringCase {
  const char* input;
  const char* expected;
  const char* label;
};

void TestStringsAndEscapes() {
  printf("[case] strings and escapes\n");
  const StringCase cases[] = {
      {"\"a\\\"b\\\\c\\/d\\b\\f\\n\\r\\t\"",
       "\"a\\\"b\\\\c/d\\u0008\\u000c\\u000a\\u000d\\u0009\"", "short escapes"},
      {"\"\\u00e9\"", "\"\xC3\xA9\"", "\\u00e9 to 2-byte UTF-8"},
      {"\"\\u4e2d\\u6587\"", "\"\xE4\xB8\xAD\xE6\x96\x87\"", "BMP CJK to 3-byte UTF-8"},
      {"\"\\ud83d\\ude00\"", "\"\xF0\x9F\x98\x80\"", "surrogate pair to 4-byte UTF-8"},
      {"\"\\u001F\"", "\"\\u001f\"", "control escaped as lowercase hex"},
      {"\"\xE4\xB8\xAD\"", "\"\xE4\xB8\xAD\"", "raw UTF-8 printed as-is"},
  };
  for (mp::usize c = 0; c < sizeof(cases) / sizeof(cases[0]); ++c) {
    const StringCase& item = cases[c];
    mp::Arena arena;
    char err[256];
    err[0] = '\0';
    mp::JsonValue* root = mp::JsonParse(&arena, item.input, mp::StrLen(item.input), err,
                                       sizeof(err));
    Check(root != nullptr, item.label);
    if (root == nullptr) {
      printf("  %s parse error: %s\n", item.label, err);
      continue;
    }
    mp::TextBuffer* out = arena.NewTextBuffer();
    Check(mp::JsonSerializeCanonical(root, out), item.label);
    ExpectBytesEqual(item.label, out->data, out->size, item.expected,
                     mp::StrLen(item.expected));
  }
}

// ---------------------------------------------------------------------------
// 4. 必须失败的用例
// ---------------------------------------------------------------------------
void TestParseFailures() {
  printf("[case] parse failures\n");
  const char* cases[] = {
      "{\"a\":1.5}",
      "{\"a\":1e3}",
      "{\"a\":1E+3}",
      "{\"a\":01}",
      "{\"a\":-}",
      "{\"a\":}",
      "{\"a\":1,}",
      "{\"a\" 1}",
      "[1,2",
      "[1,]",
      "\"abc",
      "{\"a\":\"\\q\"}",
      "{\"a\":1} x",
      "{\"a\":1,\"a\":2}",
      "",
      "   ",
      "{\"a\":9223372036854775808}",
      "{\"a\":-9223372036854775809}",
      "tru",
      "{a:1}",
  };
  for (mp::usize c = 0; c < sizeof(cases) / sizeof(cases[0]); ++c) {
    mp::Arena arena;
    char err[256];
    err[0] = '\0';
    const char* text = cases[c];
    const mp::JsonValue* root =
        mp::JsonParse(&arena, text, mp::StrLen(text), err, sizeof(err));
    Check(root == nullptr, "invalid input rejected");
    Check(HasErrorPrefix(err), "error message has 'at byte N: ' prefix");
    if (root != nullptr) {
      printf("  unexpectedly accepted: %s\n", text);
    }
  }

  // 无效 UTF-8 字节序列：直接构造字节数组，避免源码里出现非法 UTF-8。
  {
    const char invalidUtf8[] = {'{', '"', 'a', '"', ':', '"',
                                static_cast<char>(0xC3), '(', '"', '}'};
    mp::Arena arena;
    char err[256];
    err[0] = '\0';
    Check(mp::JsonParse(&arena, invalidUtf8, sizeof(invalidUtf8), err, sizeof(err)) == nullptr,
          "invalid UTF-8 bytes rejected");
    Check(HasErrorPrefix(err), "invalid UTF-8 error prefix");
  }

  // 深度 40 层嵌套：必须失败而不是爆栈。
  {
    char nested[96];
    mp::usize cursor = 0;
    for (mp::usize i = 0; i < 40; ++i) {
      nested[cursor++] = '[';
    }
    nested[cursor++] = '1';
    for (mp::usize i = 0; i < 40; ++i) {
      nested[cursor++] = ']';
    }
    mp::Arena arena;
    char err[256];
    err[0] = '\0';
    Check(mp::JsonParse(&arena, nested, cursor, err, sizeof(err)) == nullptr,
          "40-level nesting rejected");
  }

  // 边界：32 层嵌套允许，33 层拒绝。
  {
    char allowed[96];
    mp::usize cursor = 0;
    for (mp::usize i = 0; i < 32; ++i) {
      allowed[cursor++] = '[';
    }
    allowed[cursor++] = '1';
    for (mp::usize i = 0; i < 32; ++i) {
      allowed[cursor++] = ']';
    }
    mp::Arena arena;
    char err[256];
    err[0] = '\0';
    Check(mp::JsonParse(&arena, allowed, cursor, err, sizeof(err)) != nullptr,
          "32-level nesting accepted");

    char refused[96];
    cursor = 0;
    for (mp::usize i = 0; i < 33; ++i) {
      refused[cursor++] = '[';
    }
    refused[cursor++] = '1';
    for (mp::usize i = 0; i < 33; ++i) {
      refused[cursor++] = ']';
    }
    mp::Arena secondArena;
    err[0] = '\0';
    Check(mp::JsonParse(&secondArena, refused, cursor, err, sizeof(err)) == nullptr,
          "33-level nesting rejected");
  }
}

// ---------------------------------------------------------------------------
// 5. 整数边界、offset、空容器、Excluding
// ---------------------------------------------------------------------------
void TestDomDetails() {
  printf("[case] DOM details\n");
  {
    const char* text = "[-9223372036854775808,9223372036854775807]";
    mp::Arena arena;
    char err[256];
    err[0] = '\0';
    mp::JsonValue* root = mp::JsonParse(&arena, text, mp::StrLen(text), err, sizeof(err));
    Check(root != nullptr, "int64 boundary parses");
    if (root != nullptr) {
      mp::TextBuffer* out = arena.NewTextBuffer();
      Check(mp::JsonSerializeCanonical(root, out), "int64 boundary serializes");
      ExpectBytesEqual("int64 boundary round trip", out->data, out->size, text,
                       mp::StrLen(text));
    }
  }
  {
    const char* text = "{}";
    mp::Arena arena;
    mp::JsonValue* root = mp::JsonParse(&arena, text, 2, nullptr, 0);
    Check(root != nullptr && root->kind == mp::JsonKind::Object && root->count == 0,
          "empty object");
    mp::TextBuffer* out = arena.NewTextBuffer();
    Check(mp::JsonSerializeCanonical(root, out), "serialize empty object");
    ExpectBytesEqual("empty object output", out->data, out->size, "{}", 2);
  }
  {
    const char* text = "[ ]";
    mp::Arena arena;
    mp::JsonValue* root = mp::JsonParse(&arena, text, 3, nullptr, 0);
    Check(root != nullptr && root->kind == mp::JsonKind::Array && root->count == 0,
          "empty array with whitespace");
    mp::TextBuffer* out = arena.NewTextBuffer();
    Check(mp::JsonSerializeCanonical(root, out), "serialize empty array");
    ExpectBytesEqual("empty array output", out->data, out->size, "[]", 2);
  }
  {
    // offset：根对象 0，"a" 的数组值 5，数组元素 6/8。
    const char* text = "{\"a\":[1,2]}";
    mp::Arena arena;
    mp::JsonValue* root = mp::JsonParse(&arena, text, mp::StrLen(text), nullptr, 0);
    Check(root != nullptr, "offset fixture parses");
    if (root != nullptr) {
      Check(root->offset == 0, "root offset 0");
      const mp::JsonValue* array = mp::JsonFind(root, "a");
      Check(array != nullptr && array->offset == 5, "array member offset 5");
      if (array != nullptr) {
        Check(array->child != nullptr && array->child->offset == 6, "first element offset 6");
        Check(array->child != nullptr && array->child->next != nullptr &&
                  array->child->next->offset == 8,
              "second element offset 8");
      }
    }
  }
  {
    // 排除根对象指定键
    const char* text = "{\"b\":2,\"hash\":\"deadbeef\",\"a\":1}";
    mp::Arena arena;
    mp::JsonValue* root = mp::JsonParse(&arena, text, mp::StrLen(text), nullptr, 0);
    Check(root != nullptr, "excluding fixture parses");
    if (root != nullptr) {
      mp::TextBuffer* out = arena.NewTextBuffer();
      Check(mp::JsonSerializeCanonicalExcluding(root, "hash", out),
            "serialize excluding hash");
      ExpectBytesEqual("excluding hash output", out->data, out->size, "{\"a\":1,\"b\":2}", 13);
    }
  }
  {
    // 键排序：前缀相同短的在前；非 ASCII 键按字节序（等价 ordinal）。
    const char* text = "{\"ab\":1,\"a\":2,\"A\":3,\"z\":4}";
    mp::Arena arena;
    mp::JsonValue* root = mp::JsonParse(&arena, text, mp::StrLen(text), nullptr, 0);
    Check(root != nullptr, "key order fixture parses");
    if (root != nullptr) {
      mp::TextBuffer* out = arena.NewTextBuffer();
      Check(mp::JsonSerializeCanonical(root, out), "serialize key order");
      ExpectBytesEqual("key order output", out->data, out->size,
                       "{\"A\":3,\"a\":2,\"ab\":1,\"z\":4}", 26);
    }
  }
}

// ---------------------------------------------------------------------------
// 6. JsonOut 流式写出
// ---------------------------------------------------------------------------
void TestJsonOut() {
  printf("[case] JsonOut\n");
  {
    mp::Arena arena;
    mp::TextBuffer* out = arena.NewTextBuffer();
    mp::JsonOut writer(out);
    Check(writer.BeginObject(), "writer begin object");
    Check(writer.WriteKey("a"), "writer key a");
    Check(writer.WriteNumber(static_cast<mp::i64>(1)), "writer number 1");
    Check(writer.WriteKey("b"), "writer key b");
    Check(writer.BeginArray(), "writer begin array");
    Check(writer.WriteString("x"), "writer string x");
    Check(writer.WriteBool(true), "writer bool true");
    Check(writer.WriteNull(), "writer null");
    Check(writer.EndArray(), "writer end array");
    Check(writer.WriteKey("c"), "writer key c");
    Check(writer.BeginObject(), "writer nested empty object");
    Check(writer.EndObject(), "writer nested empty object end");
    Check(writer.WriteKey("d"), "writer key d");
    Check(writer.BeginArray(), "writer nested array");
    Check(writer.BeginArray(), "writer nested array inner");
    Check(writer.EndArray(), "writer nested array inner end");
    Check(writer.EndArray(), "writer nested array end");
    Check(writer.WriteKey("e"), "writer key e");
    Check(writer.WriteNumber(static_cast<mp::u32>(42u)), "writer u32 number");
    Check(writer.EndObject(), "writer end object");
    Check(writer.Ok(), "writer remains ok");
    const char* expected = "{\"a\":1,\"b\":[\"x\",true,null],\"c\":{},\"d\":[[]],\"e\":42}";
    ExpectBytesEqual("JsonOut nested output", out->data, out->size, expected,
                     mp::StrLen(expected));
  }
  {
    // 空的根对象/数组
    mp::Arena arena;
    mp::TextBuffer* objectBuffer = arena.NewTextBuffer();
    mp::JsonOut objectWriter(objectBuffer);
    Check(objectWriter.BeginObject(), "root empty object begin");
    Check(objectWriter.EndObject(), "root empty object end");
    ExpectBytesEqual("root empty object output", objectBuffer->data, objectBuffer->size, "{}",
                     2);

    mp::TextBuffer* arrayBuffer = arena.NewTextBuffer();
    mp::JsonOut arrayWriter(arrayBuffer);
    Check(arrayWriter.BeginArray(), "root empty array begin");
    Check(arrayWriter.EndArray(), "root empty array end");
    ExpectBytesEqual("root empty array output", arrayBuffer->data, arrayBuffer->size, "[]", 2);
  }
  {
    // WriteRaw：按调用方已知逗号规则原样嵌入
    mp::Arena arena;
    mp::TextBuffer* out = arena.NewTextBuffer();
    mp::JsonOut writer(out);
    Check(writer.BeginObject(), "raw object begin");
    Check(writer.WriteKey("a"), "raw key a");
    Check(writer.WriteRaw("{\"k\":1}", 7), "raw embed object");
    Check(writer.WriteKey("b"), "raw key b");
    Check(writer.BeginArray(), "raw array begin");
    Check(writer.WriteRaw("[2,3]", 5), "raw array element 1");
    Check(writer.WriteRaw(mp::Str("{\"z\":null}", 10)), "raw array element 2");
    Check(writer.EndArray(), "raw array end");
    Check(writer.EndObject(), "raw object end");
    ExpectBytesEqual("JsonOut WriteRaw output", out->data, out->size,
                     "{\"a\":{\"k\":1},\"b\":[[2,3],{\"z\":null}]}", 36);
  }
  {
    // 深度上限 16：第 17 层失败，且失败后各方法安全返回 false
    mp::Arena arena;
    mp::TextBuffer* out = arena.NewTextBuffer();
    mp::JsonOut writer(out);
    bool opened = true;
    for (int level = 0; level < 16; ++level) {
      if (!writer.BeginObject()) {
        opened = false;
        break;
      }
    }
    Check(opened, "writer opens 16 levels");
    Check(!writer.BeginObject(), "writer rejects 17th level");
    Check(!writer.Ok(), "writer sticky failure flag");
    Check(!writer.WriteNumber(static_cast<mp::i64>(1)), "writer safe after failure (number)");
    Check(!writer.EndObject(), "writer safe after failure (end object)");
    Check(!writer.WriteKey("x"), "writer safe after failure (key)");
  }
}

// ---------------------------------------------------------------------------
// 7. JsonFind
// ---------------------------------------------------------------------------
void TestJsonFind() {
  printf("[case] JsonFind\n");
  mp::Arena arena;
  const char* text = "{\"a\":1,\"b\":{\"c\":2},\"d\":[1,2]}";
  char err[256];
  err[0] = '\0';
  mp::JsonValue* root = mp::JsonParse(&arena, text, mp::StrLen(text), err, sizeof(err));
  Check(root != nullptr, "JsonFind fixture parses");
  if (root == nullptr) {
    return;
  }
  const mp::JsonValue* a = mp::JsonFind(root, "a");
  Check(a != nullptr && a->kind == mp::JsonKind::Number && a->number == 1, "find hit number");
  const mp::JsonValue* b = mp::JsonFind(root, "b");
  Check(b != nullptr && b->kind == mp::JsonKind::Object, "find hit object");
  const mp::JsonValue* c = b == nullptr ? nullptr : mp::JsonFind(b, "c");
  Check(c != nullptr && c->number == 2, "find nested hit");
  Check(mp::JsonFind(root, "missing") == nullptr, "find miss");
  Check(mp::JsonFind(a, "x") == nullptr, "find on number returns null");
  const mp::JsonValue* d = mp::JsonFind(root, "d");
  Check(mp::JsonFind(d, "x") == nullptr, "find on array returns null");
  Check(mp::JsonFind(nullptr, "a") == nullptr, "find on null returns null");
}

}  // namespace

int main(int argc, char** argv) {
  (void)argc;
  (void)argv;

  TestCanonicalSnapshot();
  TestPairRoundTrip();
  TestStringsAndEscapes();
  TestParseFailures();
  TestDomDetails();
  TestJsonOut();
  TestJsonFind();

  if (g_failures == 0) {
    printf("ALL PASS (%d checks)\n", g_checks);
    return 0;
  }
  printf("FAILED: %d of %d checks failed\n", g_failures, g_checks);
  return 1;
}

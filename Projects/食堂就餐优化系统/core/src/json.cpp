// 模块说明：手写确定性 UTF-8 JSON 解析器（DOM 构建）、紧凑流式写出器（JsonOut）与契约规范化序列化器（JsonWriteCanonical）。
// 工程约束：
//   1. 严格校验 UTF-8 字节序列合法性（拒绝过长编码、代理项半区 U+D800..U+DFFF 及超出 U+10FFFF 的码点）；
//   2. 严格拒绝尾随逗号、注释、NaN/Infinity、浮点或指数数值（核心契约仅接受 64 位有符号整数）；
//   3. 规范化 JSON（Canonical JSON）对所有 Object 成员按键名的 UTF-8 字节序升序重排，用于计算确定性 SHA-256 摘要。
// mp/json.cpp — 最小 JSON DOM 解析、规范化序列化与流式写出器
//
// 约束（与 base.h 一致）：freestanding 风格，只依赖 mp/json.h 带入的
// stdint.h / stddef.h；不用 STL、异常、new/delete、libc 字符串/格式化函数。
//
// 契约口径（contract §0.3）：对象键递归按 Unicode ordinal（等价于合法 UTF-8
// 的字节序）排序、数组保序、紧凑 JSON、无结尾换行。数值只允许整数。
#include "mp/json.h"

namespace mp {

namespace {

// 嵌套深度上限：契约输入规模远小于此值，超过视为恶意/错误输入。
constexpr usize kMaxNestingDepth = 32;
// JsonOut 的流式写出深度上限（needComma_ 固定 16 层）。
constexpr u8 kJsonOutMaxDepth = 16;

constexpr char kHexLower[] = "0123456789abcdef";

bool IsDigit(char c) { return c >= '0' && c <= '9'; }

bool IsWhitespace(char c) { return c == ' ' || c == '\t' || c == '\n' || c == '\r'; }

// 十六进制数字值；非法返回 -1
int HexDigitValue(char c) {
  if (c >= '0' && c <= '9') {
    return static_cast<int>(c - '0');
  }
  if (c >= 'a' && c <= 'f') {
    return static_cast<int>(c - 'a') + 10;
  }
  if (c >= 'A' && c <= 'F') {
    return static_cast<int>(c - 'A') + 10;
  }
  return -1;
}

// 把 "at byte N: reason" 写入 errBuf；容量不足时截断并保证 '\0' 结尾。
void WriteParseError(char* errBuf, usize errCap, usize offset, const char* reason) {
  if (errBuf == nullptr || errCap == 0) {
    return;
  }
  char scratch[192];
  usize cursor = 0;
  const char* prefix = "at byte ";
  while (*prefix != '\0' && cursor + 1 < sizeof(scratch)) {
    scratch[cursor++] = *prefix++;
  }
  char digits[24];
  const usize digitCount = FormatI64(digits, sizeof(digits), static_cast<i64>(offset));
  for (usize i = 0; i < digitCount && cursor + 1 < sizeof(scratch); ++i) {
    scratch[cursor++] = digits[i];
  }
  if (cursor + 1 < sizeof(scratch)) {
    scratch[cursor++] = ':';
  }
  if (cursor + 1 < sizeof(scratch)) {
    scratch[cursor++] = ' ';
  }
  while (*reason != '\0' && cursor + 1 < sizeof(scratch)) {
    scratch[cursor++] = *reason++;
  }
  scratch[cursor] = '\0';
  const usize copyCount = cursor + 1 < errCap ? cursor : errCap - 1;
  for (usize i = 0; i < copyCount; ++i) {
    errBuf[i] = scratch[i];
  }
  errBuf[copyCount] = '\0';
}

// 解析器：所有读取都以 (pos < length) 为界，不假设输入以 '\0' 结尾。
struct Parser {
  Arena* arena;
  const char* data;
  usize length;
  usize pos;
  char* errBuf;
  usize errCap;
  bool failed;

  void Fail(const char* reason) {
    // 错误粘滞：只保留首个错误（"at byte N: reason"），后续失败不再覆盖。
    if (failed) {
      return;
    }
    failed = true;
    WriteParseError(errBuf, errCap, pos, reason);
  }

  void FailAt(usize offset, const char* reason) {
    if (failed) {
      return;
    }
    failed = true;
    WriteParseError(errBuf, errCap, offset, reason);
  }

  void SkipWhitespace() {
    while (pos < length && IsWhitespace(data[pos])) {
      ++pos;
    }
  }

  bool ParseValue(usize depth, JsonValue** out);
  bool ParseObject(usize depth, JsonValue* value);
  bool ParseArray(usize depth, JsonValue* value);
  bool ParseString(Str* out);
  bool ScanString(usize start, usize bodyStart, usize* decodedBytes, usize* bodyEnd);
  bool ParseNumber(JsonValue* value);
  bool ParseLiteral(const char* literal, usize literalLength, JsonValue** out);
};

// 按码点写 UTF-8；调用方保证缓冲足够（最多 4 字节）。返回写入字节数。
usize EncodeUtf8(u32 codePoint, char* out) {
  if (codePoint < 0x80) {
    out[0] = static_cast<char>(codePoint);
    return 1;
  }
  if (codePoint < 0x800) {
    out[0] = static_cast<char>(0xC0u | (codePoint >> 6));
    out[1] = static_cast<char>(0x80u | (codePoint & 0x3Fu));
    return 2;
  }
  if (codePoint < 0x10000) {
    out[0] = static_cast<char>(0xE0u | (codePoint >> 12));
    out[1] = static_cast<char>(0x80u | ((codePoint >> 6) & 0x3Fu));
    out[2] = static_cast<char>(0x80u | (codePoint & 0x3Fu));
    return 3;
  }
  out[0] = static_cast<char>(0xF0u | (codePoint >> 18));
  out[1] = static_cast<char>(0x80u | ((codePoint >> 12) & 0x3Fu));
  out[2] = static_cast<char>(0x80u | ((codePoint >> 6) & 0x3Fu));
  out[3] = static_cast<char>(0x80u | (codePoint & 0x3Fu));
  return 4;
}

// 第一遍字符串扫描：定位结束引号并计算解码后字节数，同时完成全部转义语法与
// 结构校验（含 \u 代理对规则），使第二遍解码不会中途失败。
// 所有错误都在“当前扫描偏移”或“起始引号偏移”上报，与逐字符单遍实现的错误
// 定位完全一致。修复要点：解析器先按精确解码长度一次性分配，不再按
// “整份文档剩余长度”为每个字符串预留容量。
bool Parser::ScanString(usize start, usize bodyStart, usize* decodedBytes, usize* bodyEnd) {
  usize p = bodyStart;
  usize size = 0;
  for (;;) {
    if (p >= length) {
      FailAt(start, "unterminated string");
      return false;
    }
    const u8 c = static_cast<u8>(data[p]);
    if (c == '"') {
      break;
    }
    if (c == '\\') {
      ++p;
      if (p >= length) {
        FailAt(start, "unterminated string");
        return false;
      }
      const char escape = data[p];
      // 简单转义均解码为 1 字节。
      if (escape == '"' || escape == '\\' || escape == '/' || escape == 'b' ||
          escape == 'f' || escape == 'n' || escape == 'r' || escape == 't') {
        ++p;
        size += 1;
        continue;
      }
      if (escape != 'u') {
        FailAt(p, "invalid escape sequence");
        return false;
      }
      ++p;
      if (p + 4 > length) {
        FailAt(p, "incomplete \\u escape");
        return false;
      }
      u32 codePoint = 0;
      for (usize i = 0; i < 4; ++i) {
        const int digit = HexDigitValue(data[p + i]);
        if (digit < 0) {
          FailAt(p, "invalid \\u hex digit");
          return false;
        }
        codePoint = (codePoint << 4) | static_cast<u32>(digit);
      }
      p += 4;
      if (codePoint >= 0xD800 && codePoint <= 0xDBFF) {
        // 高代理必须紧跟 \uDC00-\uDFFF 低代理，合成为一个补充平面码点。
        if (p + 1 >= length || data[p] != '\\' || data[p + 1] != 'u') {
          FailAt(p, "lone surrogate");
          return false;
        }
        p += 2;
        if (p + 4 > length) {
          FailAt(p, "incomplete \\u escape");
          return false;
        }
        u32 low = 0;
        for (usize i = 0; i < 4; ++i) {
          const int digit = HexDigitValue(data[p + i]);
          if (digit < 0) {
            FailAt(p, "invalid \\u hex digit");
            return false;
          }
          low = (low << 4) | static_cast<u32>(digit);
        }
        p += 4;
        if (low < 0xDC00 || low > 0xDFFF) {
          FailAt(p, "invalid surrogate pair");
          return false;
        }
        codePoint = 0x10000u + ((codePoint - 0xD800u) << 10) + (low - 0xDC00u);
      } else if (codePoint >= 0xDC00 && codePoint <= 0xDFFF) {
        FailAt(p, "lone surrogate");
        return false;
      }
      // \uXXXX 解码后最多 4 字节；借用 EncodeUtf8 求精确长度。
      char scratch[4];
      size += EncodeUtf8(codePoint, scratch);
      continue;
    }
    if (c < 0x20) {
      FailAt(p, "raw control character in string");
      return false;
    }
    ++p;
    size += 1;
  }
  *decodedBytes = size;
  *bodyEnd = p;
  return true;
}

bool Parser::ParseString(Str* out) {
  const usize start = pos;
  ++pos;  // 跳过开引号
  // 第一遍：校验转义/控制字符/代理对并求出解码后精确字节数。
  usize decodedBytes = 0;
  usize bodyEnd = 0;
  if (!ScanString(start, pos, &decodedBytes, &bodyEnd)) {
    return false;
  }
  // 第二遍：只按解码结果精确分配（decodedBytes + 1 存结尾 '\0'）。
  // 解码后字节数不超过字符串自身源字节跨度，与文档其余部分长度无关。
  char* buffer = static_cast<char*>(arena->Alloc(decodedBytes + 1, 1));
  if (buffer == nullptr) {
    Fail("out of memory");
    return false;
  }
  usize written = 0;
  // ScanString 已保证转义全部合法，此处解码不会失败。
  for (usize p = start + 1; p < bodyEnd;) {
    const u8 c = static_cast<u8>(data[p]);
    if (c != '\\') {
      buffer[written++] = static_cast<char>(c);
      ++p;
      continue;
    }
    const char escape = data[p + 1];
    ++p;
    if (escape == '"') {
      buffer[written++] = '"';
      ++p;
    } else if (escape == '\\') {
      buffer[written++] = '\\';
      ++p;
    } else if (escape == '/') {
      buffer[written++] = '/';
      ++p;
    } else if (escape == 'b') {
      buffer[written++] = '\b';
      ++p;
    } else if (escape == 'f') {
      buffer[written++] = '\f';
      ++p;
    } else if (escape == 'n') {
      buffer[written++] = '\n';
      ++p;
    } else if (escape == 'r') {
      buffer[written++] = '\r';
      ++p;
    } else if (escape == 't') {
      buffer[written++] = '\t';
      ++p;
    } else {
      // \u 转义（合法性已在第一遍确认）；高代理必带合法低代理。
      ++p;  // 跳过 'u'
      u32 codePoint = 0;
      for (usize i = 0; i < 4; ++i) {
        codePoint = (codePoint << 4) | static_cast<u32>(HexDigitValue(data[p + i]));
      }
      p += 4;
      if (codePoint >= 0xD800 && codePoint <= 0xDBFF) {
        p += 2;  // 跳过 "\u"
        u32 low = 0;
        for (usize i = 0; i < 4; ++i) {
          low = (low << 4) | static_cast<u32>(HexDigitValue(data[p + i]));
        }
        p += 4;
        codePoint = 0x10000u + ((codePoint - 0xD800u) << 10) + (low - 0xDC00u);
      }
      written += EncodeUtf8(codePoint, buffer + written);
    }
  }
  buffer[written] = '\0';
  if (!IsValidUtf8(buffer, written)) {
    FailAt(start, "invalid UTF-8 in string");
    return false;
  }
  pos = bodyEnd + 1;  // 越过结束引号
  out->data = buffer;
  out->size = written;
  return true;
}

// 数值模型：契约只接受 64 位有符号整数（金额=分、营养=kcal/dg 全为整数）；
// 浮点/指数显式拒绝，杜绝隐式精度丢失；逐位累积并显式检查 int64 溢出（负数按 2^63 界）。
bool Parser::ParseNumber(JsonValue* value) {
  const usize start = pos;
  bool negative = false;
  if (data[pos] == '-') {
    negative = true;
    ++pos;
  }
  if (pos >= length || !IsDigit(data[pos])) {
    FailAt(start, "invalid number");
    return false;
  }
  if (data[pos] == '0') {
    ++pos;
    if (pos < length && IsDigit(data[pos])) {
      Fail("leading zero in number");
      return false;
    }
  } else {
    while (pos < length && IsDigit(data[pos])) {
      ++pos;
    }
  }
  // 契约禁止浮点：小数点/指数一律显式失败，绝不静默截断或四舍五入。
  if (pos < length && (data[pos] == '.' || data[pos] == 'e' || data[pos] == 'E')) {
    Fail("floating point numbers are not allowed");
    return false;
  }
  if (pos < length) {
    const char next = data[pos];
    if (!IsWhitespace(next) && next != ',' && next != ']' && next != '}') {
      Fail("invalid number");
      return false;
    }
  }
  // 逐位累积并检查 int64 范围；负数的绝对值上限是 2^63。
  const usize end = pos;
  const u64 limit = negative ? 9223372036854775808ULL : 9223372036854775807ULL;
  u64 magnitude = 0;
  for (usize i = start + (negative ? 1 : 0); i < end; ++i) {
    const u64 digit = static_cast<u64>(static_cast<u8>(data[i]) - static_cast<u8>('0'));
    if (magnitude > (limit - digit) / 10) {
      FailAt(start, "integer out of range");
      return false;
    }
    magnitude = magnitude * 10 + digit;
  }
  if (negative) {
    if (magnitude == 9223372036854775808ULL) {
      value->number = -9223372036854775807LL - 1;
    } else {
      value->number = -static_cast<i64>(magnitude);
    }
  } else {
    value->number = static_cast<i64>(magnitude);
  }
  return true;
}

bool Parser::ParseLiteral(const char* literal, usize literalLength, JsonValue** out) {
  const usize start = pos;
  for (usize i = 0; i < literalLength; ++i) {
    if (pos >= length || data[pos] != literal[i]) {
      FailAt(start, "invalid literal");
      return false;
    }
    ++pos;
  }
  JsonValue* value = arena->New<JsonValue>();
  if (value == nullptr) {
    Fail("out of memory");
    return false;
  }
  value->offset = start;
  if (literalLength == 4 && literal[0] == 'n') {
    value->kind = JsonKind::Null;
  } else {
    value->kind = JsonKind::Bool;
    value->boolean = literal[0] == 't';
  }
  *out = value;
  return true;
}

bool Parser::ParseArray(usize depth, JsonValue* value) {
  if (depth + 1 > kMaxNestingDepth) {
    Fail("nesting depth exceeds limit");
    return false;
  }
  ++pos;  // 跳过 '['
  SkipWhitespace();
  if (pos < length && data[pos] == ']') {
    ++pos;
    return true;
  }
  for (;;) {
    JsonValue* element = nullptr;
    if (!ParseValue(depth + 1, &element)) {
      return false;
    }
    if (value->tail == nullptr) {
      value->child = element;
    } else {
      value->tail->next = element;
    }
    value->tail = element;
    ++value->count;
    SkipWhitespace();
    if (pos >= length) {
      Fail("unterminated array");
      return false;
    }
    if (data[pos] == ',') {
      ++pos;
      continue;
    }
    if (data[pos] == ']') {
      ++pos;
      return true;
    }
    Fail("expected ',' or ']' in array");
    return false;
  }
}

bool Parser::ParseObject(usize depth, JsonValue* value) {
  if (depth + 1 > kMaxNestingDepth) {
    Fail("nesting depth exceeds limit");
    return false;
  }
  ++pos;  // 跳过 '{'
  SkipWhitespace();
  if (pos < length && data[pos] == '}') {
    ++pos;
    return true;
  }
  for (;;) {
    SkipWhitespace();
    if (pos >= length) {
      Fail("unterminated object");
      return false;
    }
    if (data[pos] != '"') {
      Fail("expected object key string");
      return false;
    }
    const usize keyOffset = pos;
    Str key;
    if (!ParseString(&key)) {
      return false;
    }
    // 重复键判失败：规范化哈希要求同一对象内容唯一，不允许静默覆盖。
    for (const JsonMember* existing = value->members; existing != nullptr; existing = existing->next) {
      if (existing->key.Equals(key)) {
        FailAt(keyOffset, "duplicate object key");
        return false;
      }
    }
    SkipWhitespace();
    if (pos >= length || data[pos] != ':') {
      Fail("expected ':' after object key");
      return false;
    }
    ++pos;
    JsonValue* memberValue = nullptr;
    if (!ParseValue(depth + 1, &memberValue)) {
      return false;
    }
    JsonMember* member = arena->New<JsonMember>();
    if (member == nullptr) {
      Fail("out of memory");
      return false;
    }
    member->key = key;
    member->value = memberValue;
    if (value->memberTail == nullptr) {
      value->members = member;
      value->child = memberValue;
    } else {
      value->memberTail->next = member;
    }
    value->memberTail = member;
    ++value->count;
    SkipWhitespace();
    if (pos >= length) {
      Fail("unterminated object");
      return false;
    }
    if (data[pos] == ',') {
      ++pos;
      continue;
    }
    if (data[pos] == '}') {
      ++pos;
      return true;
    }
    Fail("expected ',' or '}' in object");
    return false;
  }
}

bool Parser::ParseValue(usize depth, JsonValue** out) {
  // 全局短路：failed 置位后所有子解析立即返回，避免在半破坏状态上继续消耗输入。
  if (failed) {
    return false;
  }
  SkipWhitespace();
  if (pos >= length) {
    Fail("unexpected end of input");
    return false;
  }
  const usize start = pos;
  const char head = data[pos];
  JsonValue* value = nullptr;
  if (head == '{') {
    value = arena->New<JsonValue>();
    if (value == nullptr) {
      Fail("out of memory");
      return false;
    }
    value->kind = JsonKind::Object;
    value->offset = start;
    if (!ParseObject(depth, value)) {
      return false;
    }
  } else if (head == '[') {
    value = arena->New<JsonValue>();
    if (value == nullptr) {
      Fail("out of memory");
      return false;
    }
    value->kind = JsonKind::Array;
    value->offset = start;
    if (!ParseArray(depth, value)) {
      return false;
    }
  } else if (head == '"') {
    value = arena->New<JsonValue>();
    if (value == nullptr) {
      Fail("out of memory");
      return false;
    }
    value->kind = JsonKind::String;
    value->offset = start;
    if (!ParseString(&value->text)) {
      return false;
    }
  } else if (head == 't') {
    if (!ParseLiteral("true", 4, &value)) {
      return false;
    }
  } else if (head == 'f') {
    if (!ParseLiteral("false", 5, &value)) {
      return false;
    }
  } else if (head == 'n') {
    if (!ParseLiteral("null", 4, &value)) {
      return false;
    }
  } else if (head == '-' || IsDigit(head)) {
    value = arena->New<JsonValue>();
    if (value == nullptr) {
      Fail("out of memory");
      return false;
    }
    value->kind = JsonKind::Number;
    value->offset = start;
    if (!ParseNumber(value)) {
      return false;
    }
  } else {
    Fail("unexpected character");
    return false;
  }
  *out = value;
  return true;
}

// ---------------------------------------------------------------------------
// 规范化序列化辅助
// ---------------------------------------------------------------------------

// 固定转义规则：'"'→\"，'\\'→\\，控制字节（<0x20）→ \u00XX（小写 hex）；
// 其余字节（包括非 ASCII 的 UTF-8 序列）原样输出。
bool SerializeString(Str text, TextBuffer* out) {
  if (!out->AppendChar('"')) {
    return false;
  }
  usize runStart = 0;
  for (usize i = 0; i < text.size; ++i) {
    const u8 c = static_cast<u8>(text.data[i]);
    if (c != '"' && c != '\\' && c >= 0x20) {
      continue;
    }
    if (i > runStart && !out->Append(text.data + runStart, i - runStart)) {
      return false;
    }
    char escape[6];
    usize escapeLength = 0;
    if (c == '"') {
      escape[0] = '\\';
      escape[1] = '"';
      escapeLength = 2;
    } else if (c == '\\') {
      escape[0] = '\\';
      escape[1] = '\\';
      escapeLength = 2;
    } else {
      escape[0] = '\\';
      escape[1] = 'u';
      escape[2] = '0';
      escape[3] = '0';
      escape[4] = kHexLower[c >> 4];
      escape[5] = kHexLower[c & 0x0Fu];
      escapeLength = 6;
    }
    if (!out->Append(escape, escapeLength)) {
      return false;
    }
    runStart = i + 1;
  }
  if (text.size > runStart && !out->Append(text.data + runStart, text.size - runStart)) {
    return false;
  }
  return out->AppendChar('"');
}

bool SerializeValue(const JsonValue* value, TextBuffer* out);
bool SerializeObject(const JsonValue* object, TextBuffer* out, const char* skippedKey);

bool SerializeArray(const JsonValue* value, TextBuffer* out) {
  if (!out->AppendChar('[')) {
    return false;
  }
  usize index = 0;
  for (const JsonValue* element = value->child; element != nullptr && index < value->count;
       element = element->next, ++index) {
    if (index > 0 && !out->AppendChar(',')) {
      return false;
    }
    if (!SerializeValue(element, out)) {
      return false;
    }
  }
  return out->AppendChar(']');
}

bool SerializeObject(const JsonValue* object, TextBuffer* out, const char* skippedKey) {
  if (!out->AppendChar('{')) {
    return false;
  }
  // 不开临时数组：每轮按 UTF-8 字节序选出“比上一个已写键更大的最小键”。
  // 对象键数量有限（契约快照为个位到十几），O(n^2) 足够且省去额外内存。
  Str skipped(skippedKey);
  Str previous;
  bool hasPrevious = false;
  usize written = 0;
  for (usize index = 0; index < object->count; ++index) {
    const JsonMember* best = nullptr;
    for (const JsonMember* member = object->members; member != nullptr; member = member->next) {
      if (hasPrevious && member->key.Compare(previous) <= 0) {
        continue;
      }
      if (best == nullptr || member->key.Compare(best->key) < 0) {
        best = member;
      }
    }
    if (best == nullptr) {
      break;  // 手工构造的非法 DOM（重复键）时安全停止
    }
    previous = best->key;
    hasPrevious = true;
    if (skippedKey != nullptr && best->key.Equals(skipped)) {
      continue;
    }
    if (written > 0 && !out->AppendChar(',')) {
      return false;
    }
    if (!SerializeString(best->key, out)) {
      return false;
    }
    if (!out->AppendChar(':')) {
      return false;
    }
    if (!SerializeValue(best->value, out)) {
      return false;
    }
    ++written;
  }
  return out->AppendChar('}');
}

bool SerializeValue(const JsonValue* value, TextBuffer* out) {
  if (value == nullptr || out == nullptr) {
    return false;
  }
  switch (value->kind) {
    case JsonKind::Null:
      return out->Append("null");
    case JsonKind::Bool:
      return out->Append(value->boolean ? "true" : "false");
    case JsonKind::Number:
      return out->AppendI64(value->number);
    case JsonKind::String:
      return SerializeString(value->text, out);
    case JsonKind::Array:
      return SerializeArray(value, out);
    case JsonKind::Object:
      return SerializeObject(value, out, nullptr);
  }
  return false;
}

}  // namespace

// ---------------------------------------------------------------------------
// 公开接口
// ---------------------------------------------------------------------------
// 解析入口：DOM 节点（JsonValue/JsonMember）与字符串解码缓冲全部分配在传入 Arena 上，
// 随 Arena 整体释放，无逐节点回收路径；失败返回 nullptr，errBuf 带首个错误与字节偏移。
JsonValue* JsonParse(Arena* arena, const char* data, usize length, char* errBuf, usize errCap) {
  if (arena == nullptr || data == nullptr) {
    WriteParseError(errBuf, errCap, 0, "null arena or input");
    return nullptr;
  }
  Parser parser;
  parser.arena = arena;
  parser.data = data;
  parser.length = length;
  parser.pos = 0;
  parser.errBuf = errBuf;
  parser.errCap = errCap;
  parser.failed = false;

  parser.SkipWhitespace();
  if (parser.pos >= length) {
    parser.Fail("empty input");
    return nullptr;
  }
  JsonValue* root = nullptr;
  if (!parser.ParseValue(0, &root)) {
    return nullptr;
  }
  parser.SkipWhitespace();
  if (parser.pos != length) {
    parser.Fail("trailing content after root value");
    return nullptr;
  }
  return root;
}

// 按键名线性查找成员（保持文档顺序）；找不到返回 nullptr，由调用方区分“可选缺省”
// 与“必填缺失”（必填场景配合 RequireMember 报 INVALID_INPUT）。
const JsonValue* JsonFind(const JsonValue* object, const char* key) {
  if (object == nullptr || key == nullptr || object->kind != JsonKind::Object) {
    return nullptr;
  }
  const Str target(key);
  for (const JsonMember* member = object->members; member != nullptr; member = member->next) {
    if (member->key.Equals(target)) {
      return member->value;
    }
  }
  return nullptr;
}

// 规范化序列化（契约 §0.3）：对象键递归按 UTF-8 字节序升序、数组保序、紧凑输出、
// 控制字节 \u00XX 小写转义。catalogHash / nutritionConfig.hash / inputDigests / planKey
// 的 SHA-256 全部以该规范化字节串为输入，是双端逐字节一致的根基。
bool JsonSerializeCanonical(const JsonValue* root, TextBuffer* out) {
  if (out == nullptr) {
    return false;
  }
  return SerializeValue(root, out);
}

// 同 JsonSerializeCanonical，但在根对象层跳过指定键：复算哈希时排除摘要字段自身，
// 否则“摘要覆盖自身”的校验无解。
bool JsonSerializeCanonicalExcluding(const JsonValue* root, const char* skippedKey,
                                     TextBuffer* out) {
  if (root == nullptr || out == nullptr) {
    return false;
  }
  if (root->kind == JsonKind::Object) {
    return SerializeObject(root, out, skippedKey);
  }
  return SerializeValue(root, out);
}

// ---------------------------------------------------------------------------
// JsonOut：流式写出器
// 粘滞错误模型：任一写步骤失败即置 ok_=false，此后所有写操作短路返回 false，
// 调用方只在结尾检查 Ok()；嵌套深度上限 16（needComma_ 定长数组），超限按错误处理。
// ---------------------------------------------------------------------------
JsonOut::JsonOut(TextBuffer* out) : out_(out), ok_(out != nullptr), depth_(0) {
  for (usize i = 0; i < sizeof(needComma_); ++i) {
    needComma_[i] = 0;
  }
}

// 在“当前层”的父层加逗号；根值不加。
bool JsonOut::Separator() {
  if (!ok_ || out_ == nullptr) {
    ok_ = false;
    return false;
  }
  if (depth_ == 0) {
    return true;
  }
  const usize level = static_cast<usize>(depth_) - 1;
  if (needComma_[level] != 0) {
    if (!out_->AppendChar(',')) {
      ok_ = false;
      return false;
    }
  }
  needComma_[level] = 1;
  return true;
}

bool JsonOut::BeginObject() {
  if (!ok_ || out_ == nullptr) {
    ok_ = false;
    return false;
  }
  if (depth_ >= kJsonOutMaxDepth) {
    ok_ = false;
    return false;
  }
  if (!Separator() || !out_->AppendChar('{')) {
    ok_ = false;
    return false;
  }
  needComma_[depth_] = 0;
  ++depth_;
  return true;
}

bool JsonOut::EndObject() {
  if (!ok_ || out_ == nullptr || depth_ == 0) {
    ok_ = false;
    return false;
  }
  if (!out_->AppendChar('}')) {
    ok_ = false;
    return false;
  }
  --depth_;
  return true;
}

bool JsonOut::BeginArray() {
  if (!ok_ || out_ == nullptr) {
    ok_ = false;
    return false;
  }
  if (depth_ >= kJsonOutMaxDepth) {
    ok_ = false;
    return false;
  }
  if (!Separator() || !out_->AppendChar('[')) {
    ok_ = false;
    return false;
  }
  needComma_[depth_] = 0;
  ++depth_;
  return true;
}

bool JsonOut::EndArray() {
  if (!ok_ || out_ == nullptr || depth_ == 0) {
    ok_ = false;
    return false;
  }
  if (!out_->AppendChar(']')) {
    ok_ = false;
    return false;
  }
  --depth_;
  return true;
}

bool JsonOut::WriteKey(Str key) {
  if (!ok_ || out_ == nullptr || depth_ == 0) {
    ok_ = false;
    return false;
  }
  const usize level = static_cast<usize>(depth_) - 1;
  if (needComma_[level] != 0) {
    if (!out_->AppendChar(',')) {
      ok_ = false;
      return false;
    }
  }
  // 键写完后该层尚未有“元素值”，先清标记，由随后的值写入补上。
  needComma_[level] = 0;
  if (!SerializeString(key, out_) || !out_->AppendChar(':')) {
    ok_ = false;
    return false;
  }
  return true;
}

bool JsonOut::WriteKey(const char* key) {
  if (key == nullptr) {
    ok_ = false;
    return false;
  }
  return WriteKey(Str(key));
}

bool JsonOut::WriteString(Str value) {
  if (!Separator()) {
    return false;
  }
  if (!SerializeString(value, out_)) {
    ok_ = false;
    return false;
  }
  return true;
}

bool JsonOut::WriteString(const char* value) {
  if (value == nullptr) {
    ok_ = false;
    return false;
  }
  return WriteString(Str(value));
}

bool JsonOut::WriteNumber(i64 value) {
  if (!Separator()) {
    return false;
  }
  if (!out_->AppendI64(value)) {
    ok_ = false;
    return false;
  }
  return true;
}

bool JsonOut::WriteNumber(u32 value) {
  if (!Separator()) {
    return false;
  }
  if (!out_->AppendU32(value)) {
    ok_ = false;
    return false;
  }
  return true;
}

bool JsonOut::WriteBool(bool value) {
  if (!Separator()) {
    return false;
  }
  if (!out_->Append(value ? "true" : "false")) {
    ok_ = false;
    return false;
  }
  return true;
}

bool JsonOut::WriteNull() {
  if (!Separator()) {
    return false;
  }
  if (!out_->Append("null")) {
    ok_ = false;
    return false;
  }
  return true;
}

bool JsonOut::WriteRaw(const char* raw, usize length) {
  if (raw == nullptr && length != 0) {
    ok_ = false;
    return false;
  }
  if (!Separator()) {
    return false;
  }
  if (!out_->Append(raw, length)) {
    ok_ = false;
    return false;
  }
  return true;
}

}  // namespace mp

// mp/json.h — 最小 JSON DOM、解析与规范化序列化
//
// 契约要求：nutritionConfig.hash / catalogHash 用“对象键递归 ordinal 排序、
// 数组保序、紧凑 JSON”的规范化序列化结果计算，不得用文件原始字节哈希。
// 因此这里把“解析”和“按键排序序列化”分开实现。
//
// 数值只接受整数（契约禁止浮点）；解析到小数/指数一律报错，不做静默截断。
#ifndef MP_JSON_H
#define MP_JSON_H

#include "mp/base.h"

namespace mp {

enum class JsonKind : u8 { Null = 0, Bool, Number, String, Array, Object };

struct JsonValue;
struct JsonMember;

struct JsonMember {
  Str key;
  JsonValue* value;
  JsonMember* next;
};

struct JsonValue {
  JsonKind kind;
  bool boolean;
  i64 number;
  Str text;  // String 值（指向 Arena 内的解码副本）
  JsonValue* child;  // Array 首元素 / Object 首成员值
  JsonMember* members;
  usize count;
  JsonValue* next;
  JsonValue* tail;        // 构建期 O(1) 追加
  JsonMember* memberTail; // 构建期 O(1) 追加
  usize offset;           // 源文偏移，报错定位用
};

// 解析。失败返回 nullptr，并在 errBuf 写入 "at byte N: reason"。
// acceptableDepth 由契约规模约束，超深返回错误而不是栈溢出。
JsonValue* JsonParse(Arena* arena, const char* data, usize length, char* errBuf, usize errCap);

// 对象取成员；非对象或不存在返回 nullptr
const JsonValue* JsonFind(const JsonValue* object, const char* key);

// 规范化序列化：对象键按 UTF-8 字节序递归排序、数组保序、紧凑、无结尾换行。
bool JsonSerializeCanonical(const JsonValue* root, TextBuffer* out);

// 规范化序列化但跳过对象根上的指定键（用于排除 hash 自身再计算摘要）
bool JsonSerializeCanonicalExcluding(const JsonValue* root, const char* skippedKey, TextBuffer* out);

// ---------------------------------------------------------------------------
// 流式写出器：输出字段顺序由调用方代码决定，保证同请求同字节
// ---------------------------------------------------------------------------
class JsonOut {
 public:
  explicit JsonOut(TextBuffer* out);

  bool BeginObject();
  bool EndObject();
  bool BeginArray();
  bool EndArray();
  bool WriteKey(const char* key);
  bool WriteKey(Str key);
  bool WriteString(Str value);
  bool WriteString(const char* value);
  bool WriteNumber(i64 value);
  bool WriteNumber(u32 value);
  bool WriteBool(bool value);
  bool WriteNull();
  // 嵌入一段已经是合法 JSON 的文本（例如先单独序列化好的 result 子树）
  bool WriteRaw(const char* raw, usize length);
  bool WriteRaw(Str raw) { return WriteRaw(raw.data, raw.size); }

  bool Ok() const { return ok_; }

 private:
  bool Separator();
  TextBuffer* out_;
  bool ok_;
  u8 depth_;
  u8 needComma_[16];  // 每层是否已经写过元素
};

}  // namespace mp

#endif  // MP_JSON_H

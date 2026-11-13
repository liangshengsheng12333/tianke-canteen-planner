// 模块说明：契约信封（ResultEnvelope）组装、通用字段读取校验（RequireMember / ReadInt / ReadEnum / ValidateStableId）与顶层分发器。
// 工程约束：
//   1. 严格校验 contractVersion == "1.0"，不匹配时立即返回 UNSUPPORTED_CONTRACT_VERSION；
//   2. 尽可能保留请求中的合法 requestId 至错误响应信封，便于调用方追踪全链路请求；
//   3. 所有字段类型不匹配、越界或缺失均通过 ExecContext::Fail 记录精确的 JSONPath（如 $.profile.ageYears）。
#include "mp/contract.h"

#include "mp/sha256.h"

namespace mp {

namespace {

constexpr const char* kErrorCodeInvalidInput = "INVALID_INPUT";
constexpr const char* kErrorCodeUnsupportedVersion = "UNSUPPORTED_CONTRACT_VERSION";

// 失败信封：ok=false、error{code,fieldPath,message}、result=null；requestId 仅在请求
// 已合法读取时回显，方便调用方对上请求；未显式记录错误码时缺省 INVALID_INPUT。
bool WriteEnvelopeFailure(ExecContext& ctx, Str requestId, bool hasRequestId, TextBuffer* out) {
  JsonOut writer(out);
  writer.BeginObject();
  writer.WriteKey("contractVersion");
  writer.WriteString(kContractVersionText);
  writer.WriteKey("requestId");
  if (hasRequestId) {
    writer.WriteString(requestId);
  } else {
    writer.WriteNull();
  }
  writer.WriteKey("ok");
  writer.WriteBool(false);
  writer.WriteKey("error");
  writer.BeginObject();
  const ErrorInfo& error = ctx.Error();
  writer.WriteKey("code");
  writer.WriteString(error.code.Empty() ? Str(kErrorCodeInvalidInput) : error.code);
  writer.WriteKey("fieldPath");
  writer.WriteString(error.fieldPath);
  writer.WriteKey("message");
  writer.WriteString(error.message);
  writer.WriteKey("details");
  writer.BeginArray();
  writer.EndArray();
  writer.EndObject();
  writer.WriteKey("result");
  writer.WriteNull();
  writer.EndObject();
  return writer.Ok();
}

bool IsLowerAscii(char c) { return c >= 'a' && c <= 'z'; }
bool IsDigitAscii(char c) { return c >= '0' && c <= '9'; }

}  // namespace

// 请求解析：失败（截断/非法 UTF-8/非法数值等）报 INVALID_INPUT，message 带字节偏移定位。
JsonValue* ParseRequestJson(ExecContext& ctx, const char* text, usize length) {
  char errorBuffer[192];
  errorBuffer[0] = '\0';
  JsonValue* root = JsonParse(&ctx.Memory(), text, length, errorBuffer, sizeof(errorBuffer));
  if (root == nullptr) {
    ctx.Fail(kErrorCodeInvalidInput, "$", errorBuffer[0] == '\0' ? "JSON 解析失败" : errorBuffer);
    return nullptr;
  }
  return root;
}

// 请求版本协商：只校验 major（"1.x" 全部接受）；未知 major 返回 UNSUPPORTED_CONTRACT_VERSION。
// minor 向后兼容不拒绝——这是双端契约演进的唯一闸口，禁止在业务层再散布版本判断。
bool CheckContractVersion(ExecContext& ctx, const JsonValue* root, const char* path) {
  const JsonValue* version = JsonFind(root, "contractVersion");
  if (version == nullptr || version->kind != JsonKind::String) {
    return ctx.Fail(kErrorCodeInvalidInput, path, "缺少字符串 contractVersion 或类型不符");
  }
  const Str text = version->text;
  // 只校验 major：未知 major 拒绝，未知 minor 允许
  usize majorEnd = 0;
  while (majorEnd < text.size && text.data[majorEnd] != '.') {
    ++majorEnd;
  }
  if (majorEnd != 1 || text.data[0] != '1') {
    return ctx.Fail(kErrorCodeUnsupportedVersion, path,
                    "不支持的契约 major 版本（本实现只支持 1.x）");
  }
  return true;
}

// 稳定 ID 语法：1..64 字节，[a-z0-9][a-z0-9._-]*；拒绝大写/空白/控制字符，
// 保证双端对该语法的判定完全一致（不允许平台相关的宽松处理）。
bool ValidateStableId(ExecContext& ctx, const JsonValue* value, const char* path) {
  if (value == nullptr || value->kind != JsonKind::String) {
    return ctx.Fail(kErrorCodeInvalidInput, path, "标识必须是字符串");
  }
  const Str id = value->text;
  if (id.size == 0 || id.size > 64) {
    return ctx.Fail(kErrorCodeInvalidInput, path, "标识长度必须在 1..64 之间");
  }
  const char first = id.data[0];
  if (!IsLowerAscii(first) && !IsDigitAscii(first)) {
    return ctx.Fail(kErrorCodeInvalidInput, path,
                    "标识首字符必须是 a-z 或 0-9");
  }
  for (usize i = 0; i < id.size; ++i) {
    const char c = id.data[i];
    const bool allowed = IsLowerAscii(c) || IsDigitAscii(c) || c == '.' || c == '_' || c == '-';
    if (!allowed) {
      return ctx.Fail(kErrorCodeInvalidInput, path,
                      "标识只允许小写字母、数字与 . _ -");
    }
  }
  return true;
}

// 必填成员提取：对象类型不符或缺失即 INVALID_INPUT，fieldPath 由调用方给到字段级。
const JsonValue* RequireMember(ExecContext& ctx, const JsonValue* object, const char* key,
                               const char* path) {
  if (object == nullptr || object->kind != JsonKind::Object) {
    ctx.Fail(kErrorCodeInvalidInput, path, "此处必须是 JSON 对象");
    return nullptr;
  }
  const JsonValue* member = JsonFind(object, key);
  if (member == nullptr) {
    ctx.Fail(kErrorCodeInvalidInput, path, "缺少必需字段");
    return nullptr;
  }
  return member;
}

// 整数读取：本核心数值只有 i64 整数模型（浮点在解析层已拒绝），越界即 INVALID_INPUT。
bool ReadInt(ExecContext& ctx, const JsonValue* value, const char* path, i64 minValue, i64 maxValue,
             i64* out) {
  if (value == nullptr || value->kind != JsonKind::Number) {
    return ctx.Fail(kErrorCodeInvalidInput, path, "必须是整数");
  }
  if (value->number < minValue || value->number > maxValue) {
    return ctx.Fail(kErrorCodeInvalidInput, path, "整数超出允许范围");
  }
  *out = value->number;
  return true;
}

// 可选整数：null/缺失 = 未提供（present=false，语义上区别于 0 值）；提供时走同样范围校验。
bool ReadOptionalInt(ExecContext& ctx, const JsonValue* value, const char* path, i64 minValue,
                     i64 maxValue, bool* present, i64* out) {
  *present = false;
  if (value == nullptr || value->kind == JsonKind::Null) {
    return true;
  }
  if (!ReadInt(ctx, value, path, minValue, maxValue, out)) {
    return false;
  }
  *present = true;
  return true;
}

bool ReadString(ExecContext& ctx, const JsonValue* value, const char* path, Str* out) {
  if (value == nullptr || value->kind != JsonKind::String) {
    return ctx.Fail(kErrorCodeInvalidInput, path, "必须是字符串");
  }
  *out = value->text;
  return true;
}

bool ReadBool(ExecContext& ctx, const JsonValue* value, const char* path, bool* out) {
  if (value == nullptr || value->kind != JsonKind::Bool) {
    return ctx.Fail(kErrorCodeInvalidInput, path, "必须是布尔值");
  }
  *out = value->boolean;
  return true;
}

bool RequireObjectType(ExecContext& ctx, const JsonValue* value, const char* path) {
  if (value == nullptr || value->kind != JsonKind::Object) {
    return ctx.Fail(kErrorCodeInvalidInput, path, "必须是 JSON 对象");
  }
  return true;
}

bool RequireArrayType(ExecContext& ctx, const JsonValue* value, const char* path) {
  if (value == nullptr || value->kind != JsonKind::Array) {
    return ctx.Fail(kErrorCodeInvalidInput, path, "必须是 JSON 数组");
  }
  return true;
}

// 受控枚举：字符串必须严格命中白名单（大小写敏感），不在白名单即 INVALID_INPUT。
bool ReadEnum(ExecContext& ctx, const JsonValue* value, const char* path,
              const char* const* allowed, Str* out) {
  if (!ReadString(ctx, value, path, out)) {
    return false;
  }
  for (usize i = 0; allowed[i] != nullptr; ++i) {
    if (out->Equals(allowed[i])) {
      return true;
    }
  }
  return ctx.Fail(kErrorCodeInvalidInput, path, "取值不在契约允许的枚举内");
}

// 摘要工具：规范化序列化（可排除根层某键）后 SHA-256，输出 "sha256:<64hex>" 前缀形式，
// 与 catalogHash / nutritionConfig.hash 的声明格式逐字节一致。
bool ComputeCanonicalHashPrefixed(Arena* arena, const JsonValue* root, const char* excludedRootKey,
                                  char outHex[72]) {
  TextBuffer canonical;
  canonical.Init(arena);
  if (!JsonSerializeCanonicalExcluding(root, excludedRootKey, &canonical)) {
    return false;
  }
  Sha256PrefixedHexLower(canonical.data, canonical.size, outHex);
  return true;
}

// 通用命令执行器：解析 → 回显 requestId → 契约版本协商 → 业务写入独立缓冲 → 组装信封。
// 结果原子性：result 先落独立缓冲，任一步失败都不会把半截结果混进响应；错误统一经
// WriteEnvelopeFailure 以 ok=false 可见包络返回，绝不向宿主抛出或返回空字节。
bool RunContractEntry(ExecContext& ctx, const char* requestText, usize length,
                      ResultWriter writer, bool echoRequestId, TextBuffer* out) {
  JsonValue* root = ParseRequestJson(ctx, requestText, length);
  if (root == nullptr) {
    return WriteEnvelopeFailure(ctx, Str(), false, out);
  }

  Str requestId;
  bool hasRequestId = false;
  if (echoRequestId) {
    const JsonValue* rid = JsonFind(root, "requestId");
    if (!ValidateStableId(ctx, rid, "$.requestId")) {
      return WriteEnvelopeFailure(ctx, Str(), false, out);
    }
    requestId = rid->text;
    hasRequestId = true;
  }

  if (!CheckContractVersion(ctx, root, "$.contractVersion")) {
    return WriteEnvelopeFailure(ctx, requestId, hasRequestId, out);
  }

  // 结果子树先写进独立缓冲：任一步失败都不会留下半截可见输出
  TextBuffer result;
  result.Init(&ctx.Memory());
  if (!writer(ctx, root, &result)) {
    if (!ctx.Failed()) {
      ctx.FailInternal("$.result", "结果序列化未产生可见错误");
    }
    return WriteEnvelopeFailure(ctx, requestId, hasRequestId, out);
  }

  JsonOut envelope(out);
  envelope.BeginObject();
  envelope.WriteKey("contractVersion");
  envelope.WriteString(kContractVersionText);
  envelope.WriteKey("requestId");
  if (hasRequestId) {
    envelope.WriteString(requestId);
  } else {
    envelope.WriteNull();
  }
  envelope.WriteKey("ok");
  envelope.WriteBool(true);
  envelope.WriteKey("error");
  envelope.WriteNull();
  envelope.WriteKey("result");
  envelope.WriteRaw(result.data, result.size);
  envelope.EndObject();
  return envelope.Ok();
}

}  // namespace mp

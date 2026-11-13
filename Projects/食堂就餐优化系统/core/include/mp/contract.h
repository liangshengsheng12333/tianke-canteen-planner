// mp/contract.h — 契约入口与共用校验/包络工具
//
// 对外的结果一律是 ResultEnvelope 文本；契约级失败（非法输入、版本不支持、
// 内部不变量）走 ok=false + error，业务状态（无解/营养不足/目标不可用）走
// ok=true + result.status，两者不混用。
#ifndef MP_CONTRACT_H
#define MP_CONTRACT_H

#include "mp/base.h"
#include "mp/json.h"

namespace mp {

constexpr const char* kContractVersionText = "1.0";
constexpr u32 kApiVersion = 1;
constexpr const char* kNutritionConfigVersion = "nutrition-v1.2-candidate";

// WASM 结果块：[u32 载荷字节数][u32 保留=0][UTF-8 JSON]
constexpr u32 kResultBlockHeaderBytes = 8;

// 结果子树写出器：先序列化到独立缓冲，再嵌进包络，避免半截输出
using ResultWriter = bool (*)(ExecContext& ctx, const JsonValue* request, TextBuffer* out);

// 契约入口：解析请求 -> 写 result 子树 -> 套 ResultEnvelope
bool RunContractEntry(ExecContext& ctx, const char* requestText, usize length,
                      ResultWriter writer, bool echoRequestId, TextBuffer* out);

// 四个具体入口（供原生 CLI / WASM 共用）
bool ComputeNutritionTargetEntry(ExecContext& ctx, const char* requestText, usize length,
                                 TextBuffer* out);
bool ValidateMenuCatalogEntry(ExecContext& ctx, const char* requestText, usize length,
                              TextBuffer* out);
bool PlanDayEntry(ExecContext& ctx, const char* requestText, usize length, TextBuffer* out);
bool OfferNutritionEntry(ExecContext& ctx, const char* requestText, usize length, TextBuffer* out);

// ---- 共用校验 ----
// 解析请求根；失败时已写入 ctx 错误
JsonValue* ParseRequestJson(ExecContext& ctx, const char* text, usize length);
// 契约版本：未知 major 拒绝；缺失按非法输入
bool CheckContractVersion(ExecContext& ctx, const JsonValue* root, const char* path);
// 稳定 ID：^[a-z0-9][a-z0-9._-]{0,63}$
bool ValidateStableId(ExecContext& ctx, const JsonValue* value, const char* path);
// 取对象成员，缺失/类型不符时写非法输入并返回 nullptr
const JsonValue* RequireMember(ExecContext& ctx, const JsonValue* object, const char* key,
                               const char* path);

// 读整数并校验闭区间 [minValue, maxValue]；非整数/越界都写非法输入
bool ReadInt(ExecContext& ctx, const JsonValue* value, const char* path, i64 minValue,
             i64 maxValue, i64* out);
bool ReadOptionalInt(ExecContext& ctx, const JsonValue* value, const char* path, i64 minValue,
                     i64 maxValue, bool* present, i64* out);
bool ReadString(ExecContext& ctx, const JsonValue* value, const char* path, Str* out);
bool ReadBool(ExecContext& ctx, const JsonValue* value, const char* path, bool* out);
bool RequireObjectType(ExecContext& ctx, const JsonValue* value, const char* path);
bool RequireArrayType(ExecContext& ctx, const JsonValue* value, const char* path);
// 枚举：允许值列表以 nullptr 结尾
bool ReadEnum(ExecContext& ctx, const JsonValue* value, const char* path,
              const char* const* allowed, Str* out);

// 文本 -> 稳定的十六进制小写摘要口径辅助
bool ComputeCanonicalHashPrefixed(Arena* arena, const JsonValue* root, const char* excludedRootKey,
                                  char outHex[72]);

}  // namespace mp

#endif  // MP_CONTRACT_H

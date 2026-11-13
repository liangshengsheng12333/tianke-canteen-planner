# T02-DSH 接入前定点修正 v1

- 指定模型：DeepSeek V4.1 Flash；本单不另指定原生思考档。实际模型/档位按本窗口可核实信息记录，未知照实写未知。
- 本卡须由用户手动转交 DSH 后才开工；收卡前不执行。沿用既有 Zig 和已安装工具，本单不新增安装或下载。不得修改 T01 v1.2 冻结的三份原文件。
- 只修复 T02 当前受支持子集：`algorithm=greedy`、`comboRules=[]`。不缩减最终 PRD/T04 三算法范围。非 greedy/非空 comboRules 继续作为 T04 欠项；不新增错误码/兼容层。本卡不修改页面。
- 手动营养目标不新增派生规则。缺任一宏量且无获批公式时沿用 `MANUAL_TARGET_INCOMPLETE`，保存原值、不应用。

## PlanDay 输出要求

按冻结 `Resources/契约/T01-v1.2-candidate/contract-v1-candidate.md` §5：

- 每个 `meals[]` 补 `nutritionReferenceTarget`。
- 每个方案预算包含契约规定字段和完整性语义，至少核对 `budgetCents`、`remainingBudgetKnownCents`、`withinBudgetKnownAmounts`、`overageCents`。
- 同一方案跨策略去重后，`offeredAs` 合并所有策略；各 `strategyOutcome` 指向同一 `planKey`；不把同一方案在 economy/taste 下记作未应用/丢失；`plans[]` 只保留唯一方案，不凑数。
- 按输入和状态输出已定义 flags/diagnostics。`estimated=true` 的模拟数据必须保留估算标志，不显示为精确数据。
- `planKey` 是不透明稳定键，页面只比较/存储。对无 BOM、无尾换行的规范 JSON UTF-8 元组数组计算 SHA256，以 `plan:` + 小写摘要为值。元组：`[[meal,windowId,[[offerId,quantity],...]],...]`；餐次固定 breakfast/lunch/dinner 顺序，只含该方案餐次；items 按 offerId ordinal 排序，同 offer 合并数量；排除 strategy/价格/营养/计时。仅适用于当前 offer 子集；后续 combo 按 offer 身份统一，页面不得造 key。

## 必需夹具与验证

新增完整 PlanDay 请求/结果夹具至少覆盖：成功、`TargetUnavailable`、`INVALID_INPUT`、`ResourceLimited`。四类均使用同一修订候选原生/WASM实跑并比较结果；`ResourceLimited` 要用合法限额真实触发，不写死状态。另行检查契约字段、预算完整性、策略合并、去重键；仅从输出复制样例不算算法验证。记录准确命令、stdout/stderr/退出码、源码和二进制哈希、字段检查、未测项与实际模型。

- 注释率课程要求为 20%；在 T04 范围补有效注释并按原口径复测，未达标不得标课程合格。完整规模性能和泄漏检测继续后置，不阻塞本轮受支持子集 WX 链路准备/试跑。
- T02可用明确标记的模拟菜单；不得写成真实菜单验收。真实菜单属于 T03/真实实用验收。
- 旧 v1 报告/证据原样保留。新固定反馈写入 `Resources/报告/T02-DSH-接入前定点修正-交付反馈-v2.md`；新证据写入 `Resources/报告/T02-DSH-接入前定点修正-证据-v2/`。
- 允许修改本任务涉及的现有 `core/*`、`tools/core/*` 文件；按需修复，避免无关范围。构建产物需重新生成并记录新源码/二进制哈希。
- 交付时仅在当前 DSH 窗口回复反馈路径和一句状态。交付后停止，不联系其他岗位、不自行派单。后续验收由用户/P01另行要求，不自动轮询。

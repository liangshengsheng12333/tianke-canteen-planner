# T01 P02｜DSH夹具小修 v1.2 查收

更新：2026-10-20（Asia/Shanghai）

## 结论

DSH 的 T01 夹具文档小修 v1.2 按短卡要求查收通过：三份候选文件与固定交付反馈均存在，内容、样例及规范哈希经 P02 独立复核符合本次小修验收项。该结论仅针对文档/夹具交付，不代表 P09 已复核、营养配置已通过或 T01 已冻结。

## 核验依据

- DSH 固定反馈：`Resources/报告/T01-DSH-夹具小修-交付反馈-v4.md`；P02 实测 SHA256：`1F5FE26124F505CC549C5B73D11F6C20E534790F6C9B2ED026FA4503A6618C25`。
- 候选契约：`Resources/契约/T01-v1.2-candidate/contract-v1-candidate.md`；SHA256：`1248398A59BB678A149344098F842F03D9832155AA781EE1B719511601820DB7`。
- 候选营养配置：`Resources/契约/T01-v1.2-candidate/nutrition-v1-candidate.json`；SHA256：`8254AB22DCA9CEEA1E41F575373442781AE7184DE40169041FD02B2E8308D191`。
- 候选请求/结果配对：`Resources/契约/T01-v1.2-candidate/request-result-pair.json`；SHA256：`087A890477BB6272C28885E62E87161AA7AC31AA5DBC878437B2D6241B92D40C`。
- v1.1 原文件保留且哈希未变：契约 `967584E720485821284D4761F64E5F7FB6DF67923DF94EBE62262F5F8E8B4838`；配置 `30BBFE64FB80CCD850DD38CE9122101BE3D5467872DE1C05674DB4325BAE4FA1`；配对样例 `4FEAA3E17BFBEBD8898AA038E16236DCA2B3EEFFDD6478EED8EC54E8666C4DA5`。

## 查收结果

1. 两份 JSON 均可解析，样例数为 9；原 v1.1 的 8 个配对样例均保留，新增 `UNDERWEIGHT_MANUAL_STORAGE_ONLY`。
2. 公共配置快照与 9 份请求内配置字段一致；`energyFloor` 位于顶层，`parameters.energyFloorKcal` 已移除。
3. P02 按契约规则独立重算公共配置快照 SHA256：`sha256:c93d2d91b13e54466e89d7d41ec50b1d93b6566cdee699af0cb81154a72dd288`；9 个请求配置均得到相同摘要，且每个嵌入配置与公共快照内容一致。契约已明确递归排序对象键、数组保序、UTF-8 无 BOM、紧凑 JSON、无末尾换行及排除根 `hash`。
4. 新增过轻 + manual 样例请求使用 `goal.type=manual`、体重 53,349g、身高 1,700mm；结果为 `AUTO_TARGET_DISABLED`、`eligible=false`，原因同时包含 `UNDERWEIGHT` 和 `MANUAL_STORAGE_ONLY`，`targets=null`，manual `stored=true`、`applied=false`，reason 为 `MANUAL_STORAGE_ONLY`。
5. 契约明确 `PlanDay` 对非 `Ok` 目标返回 `TargetUnavailable`，回显 `targetStatus` / `targetReasons[]`，`plans=[]`，并保留手选、记餐及已存证目标。样例和契约均未显示营养阈值被本次小修改变。
6. BMI 恰为 18.5 的比较式说明已修正为 `534,650,000 = 534,650,000`；该条按文本和输入值核对。消费套餐全份/半份同价规则及 18 岁裁定仍保留。
7. 候选状态标注 `pendingReview`。未发现哈希占位文本；本轮未运行业务代码、构建、WASM、算法或设备测试，故不提供此类实现证据。

## 后续门槛

将查收结论交 P01。按既定分工，P01需另行派发 P09 仅复核 v1.2 受影响项；P02收到后续查收指令再核对 P09 报告。P01作出冻结判断前，T01保持未冻结，不据此派发实现。

## PPT 素材

本轮项目过程可作为“契约夹具质量控制”素材：针对哈希占位和配置字段漂移，保留 v1.1 原件并形成 v1.2 候选；通过对同一快照及全部请求输入独立复算 SHA256，降低测试输入不一致风险；过轻 + manual 规则以完整输入/输出样例固定，交由 P09 独立复核后再由 P01决定是否冻结。

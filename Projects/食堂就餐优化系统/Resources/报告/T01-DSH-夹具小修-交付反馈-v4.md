# T01｜DSH｜夹具小修｜交付反馈

- 日期：2026-10-20 Asia/Shanghai
- 执行提示词版本：P01 派单原文《T01 夹具小修》（2026-10-20）；P01 指定请求模型 DeepSeek V4.1 Flash
- 反馈文件版本：v4
- 任务范围：保留旧 v1.1，在 `Resources\契约\T01-v1.2-candidate\` 生成同名三份修订候选（contractVersion 仍 1.0）；执行 P01 四项夹具修改；按模板写本反馈。不改旧 v1/v1.1、P09 报告、P01 裁定、PRD、AGENTS、MEMORY、Todokit、T01 卡；不写业务实现、不安装、不改 ACL、不操作 Git、不派发后续任务。

## 输入与版本（实际读取）

| 输入 | 路径/版本/哈希 |
|---|---|
| 派单 | P01《T01 夹具小修》（2026-10-20），指定模型 DeepSeek V4.1 Flash |
| 旧 v1.1 契约 | `Resources\契约\T01-v1.1-candidate\contract-v1-candidate.md`，SHA256 `967584E720485821284D4761F64E5F7FB6DF67923DF94EBE62262F5F8E8B4838`，只读 |
| 旧 v1.1 营养配置 | `Resources\契约\T01-v1.1-candidate\nutrition-v1-candidate.json`，SHA256 `30BBFE64FB80CCD850DD38CE9122101BE3D5467872DE1C05674DB4325BAE4FA1`，只读 |
| 旧 v1.1 配对样例 | `Resources\契约\T01-v1.1-candidate\request-result-pair.json`，SHA256 `4FEAA3E17BFBEBD8898AA038E16236DCA2B3EEFFDD6478EED8EC54E8666C4DA5`，只读 |
| P09 v1.1 实际候选独立复核 v3 | `Resources\报告\T01-P09-v1.1实际候选独立复核-v3.md`，SHA256 `AD7420DA7C1B773B5019F308F2087950065FC50FAB11E7816FFD9427DE16FD62` |
| P01 18 岁碳水门槛补充裁定 | `Resources\报告\T01-P01-18岁碳水门槛补充裁定-20261020.md`，SHA256 `2197E5B5A41D0D50ECFB3A1EBF978CF5C6FB0A4075F4E7A6C1DDCFA788D0D9EC` |
| 主 PRD | `Resources\主PRD.md` v0.2，SHA256 `D68ECE7218BC076155A0AFB6200788B7608898E9D0CDF6ECEC27C5E49AA58FDD`，只读 |
| 项目规则 | `Projects\食堂就餐优化系统\AGENTS.md`，SHA256 `9EA3F3498C9CB04E6773895BC65DF97BD9308430D77480F671C316484CAB6D21` |
| T01 卡 | `Resources\任务卡\T01-契约与营养配置.md` v0.2，SHA256 `60F086317DBA441DF20D3E7B571D58172ED2F8FA062202D03B0AC92D1B26A244` |
| 项目 MEMORY 四文件 | `MEMORY\MEMORY.md`、`决策点.md`、`待办.md`、`事实.md`（2026-10-20 版本），只读 |

不可读项：无。未读真实菜单/AppID/红米/服务端模型配置；不属于本单。

## 平台与模型

- P01 指定请求模型：**DeepSeek V4.1 Flash**；原生档位未新增指定。
- 平台/会话：DSH Desktop，`DSH_SESSION_ID=session-62cdda45-8c47-4377-8e61-f78fafac952e`，`DSH_PROFILE=desktop`。
- 当前可观察本地配置：`provider=deepseek-account`、`model=deepseek-flash`、`reasoningEffort=high`（`C:\Users\link\.dsh\profiles\desktop\cordis.patch.yml` 第 4–9 行，文件级证据）；服务端实际模型/版本、额度、订阅：**未知**；未切换模型/档位、未新增付费推理。

## 交付文件（绝对路径、版本、SHA256）

1. `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\契约\T01-v1.2-candidate\contract-v1-candidate.md`
   - 版本：`t01-contract-v1.2-candidate`；189 行 / 22,338 字节；SHA256 `1248398A59BB678A149344098F842F03D9832155AA781EE1B719511601820DB7`
2. `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\契约\T01-v1.2-candidate\nutrition-v1-candidate.json`
   - 版本：`nutrition-v1.2-candidate`；19,077 字节；SHA256 `8254AB22DCA9CEEA1E41F575373442781AE7184DE40169041FD02B2E8308D191`
3. `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\契约\T01-v1.2-candidate\request-result-pair.json`
   - 版本：`t01-pairs-v1.2-candidate`；30,456 字节；9 对样例；SHA256 `087A890477BB6272C28885E62E87161AA7AC31AA5DBC878437B2D6241B92D40C`
4. 本反馈文件：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T01-DSH-夹具小修-交付反馈-v4.md`

旧 v1.1 三份哈希保持上表值不变（本次复核）。新目录原先不存在；三份候选均新建，未覆盖任何文件。

## 四项修改落实

1. **energyFloor 位置**：公共配置 `snapshot`/根级 `energyFloor` 与全部 9 个请求的 `nutritionConfig` 均为顶层 `energyFloor{maleKcalPerDay:1500,femaleKcalPerDay:1200}`；已移除 `parameters.energyFloorKcal`。核对其余必填字段与主配置有效值一致：activity/protein/fat/meal/deficit/energyFloor/macroThresholds/population/manualTargetRules/plannerSorting 全部一致（Python 独立比较结果全部 True）。
2. **真实规范哈希**：公共配置、`snapshot` 与 9 个请求快照使用同一摘要 `sha256:c93d2d91b13e54466e89d7d41ec50b1d93b6566cdee699af0cb81154a72dd288`。口径已写入契约 §0.3：完整 `nutritionConfig` 排除根 `hash`；对象键递归按 Unicode ordinal 排序；数组保序；UTF-8 无 BOM；紧凑 JSON（无空白/无末尾换行）；小写 hex 前缀 `sha256:`；不以配置文件原始字节哈希冒充快照内容哈希。公共配置文件提供 `snapshot` 作为可复算对象。
3. **过轻+manual**：契约 §8.3/§8.7 明定 `status=AUTO_TARGET_DISABLED`、`applicability.eligible=false`、`reasons` 含 `UNDERWEIGHT` 和 `MANUAL_STORAGE_ONLY`、`manualTarget.stored=true`、`applied=false`（reason `MANUAL_STORAGE_ONLY`）、无有效 `targets`、不自动规划；`PlanDay` 返回既有 `TargetUnavailable`，在 `targetStatus`/`targetReasons[]` 回显原因。新增完整样例 `UNDERWEIGHT_MANUAL_STORAGE_ONLY`（第 9 对），请求/结果字段与上述一致。
4. **原 8 组样例与说明**：保留原 8 对 ID 与结果；仅更新其请求配置（顶层 energyFloor/真实 hash）与 BMI 恰 18.5 样例的乘法说明为 `534,650,000 = 534,650,000`（不小于右侧，不判过轻）。营养阈值、半份米饭同价规则、18 岁补充裁定行为未改；18 岁旧“待 P01 确认”文字已由补充裁定关闭替换，`carbFloorGPerDay=null`、不另设 130g/day 检查，仍保留适用性/性别能量下限/宏量百分比/4/9/4 约束。

## 运行与验证（实际执行）

- Python 3（DSH 运行时）读取两份 JSON：均可解析；`nutrition-v1-candidate.json` 版本 `nutrition-v1.2-candidate`、`p09ReviewStatus=pendingReview`、`sourceRefs` 6 条；`request-result-pair.json` 9 对。
- 独立复算规范化快照哈希：`sha256(snapshot)` = `c93d2d91…72dd288`；公共配置根 `hash` 与 9 个请求 `hash` 全部匹配；请求配置去掉 `hash` 后与 `snapshot` 完全相等；`EXAMPLE_NOT_COMPUTED` 占位哈希计数 0。
- 校验 energyFloor：9/9 请求均有顶层 `energyFloor`，`parameters.energyFloorKcal` 均为 `None`；公共配置有效值与 `snapshot` 逐项一致。
- 复算样例算术：BMI 两侧（533,490,000<534,650,000、534,650,000=534,650,000）、18 岁 REE/TDEE/目标/宏量、女性 1199 低摄入、女性 1200 宏量冲突、manual 容差 39.2/41.2 kcal 两侧、新增过轻+manual 状态，均与文件标注一致。
- 契约 Markdown 内 JSON 示例解析成功；契约无占位哈希。
- 本次允许的一次性数据修复使用内联 Python 计算/校验哈希与样例算术；未进入项目目录、未写业务实现、未改 ACL；未运行 C++/WASM/构建/算法/真机，未安装工具、未操作 Git。
- 原始证据：本反馈与三份候选文件；内联校验结果未单独落盘，未编造证据路径。

## 未完成/阻塞

1. **P09 对 v1.2 实际文件尚未复核**：`p09ReviewStatus=pendingReview`；P09 v3 报告只针对 v1.1（见输入表），不适用于本文件；需 P09 按本文件路径/哈希独立复核后才能更新该状态。
2. T01 未冻结；无实现、构建、WASM/真机验收；不自动解锁 T02/T04/T05。
3. 无其他阻塞；18 岁补充裁定的旧待确认项已关闭，不重新打开。

## 状态

**完成（本单范围）：v1.2 三份候选与反馈已生成；energyFloor 位置、规范哈希、过轻+manual 样例与 BMI 说明四项修改完成，旧 v1.1 未改；P09 保持 pendingReview，T01 未冻结，无实现/真机验收。**

# T01｜DSH｜营养配置修订｜交付反馈

- 日期：2026-10-20 Asia/Shanghai
- 执行提示词版本：`T01-DSH-营养配置修订-v3`（SHA256 `5D0D708E4C1ABE24C1201B02EFFFECF6F6499402266C4C99280F9A410DEFB3E9`）
- 反馈文件版本：v3
- 任务范围：按 P01 营养配置收口裁定 A–J，在 `Resources\契约\T01-v1.1-candidate\` 新增三份候选；按模板写本反馈。不修改旧 `T01-v1-candidate`、旧提案、P01 裁定、P09 报告、PRD、AGENTS、MEMORY、Todokit、T01 卡或其他文件；不写代码、不安装/不构建/不运行算法或真机、不操作 Git、不派发后续任务。T01 未冻结，P09 复核 pendingReview。

## 输入与版本（实际读取）

| 输入 | 实际路径/版本/哈希 |
|---|---|
| 主 PRD | `Resources\主PRD.md`，v0.2，SHA256 `D68ECE7218BC076155A0AFB6200788B7608898E9D0CDF6ECEC27C5E49AA58FDD`，只读 |
| 项目规则 | `Projects\食堂就餐优化系统\AGENTS.md`，2026-10-20 报告与复核规则更新后版本，SHA256 `9EA3F3498C9CB04E6773895BC65DF97BD9308430D77480F671C316484CAB6D21` |
| T01 卡 | `Resources\任务卡\T01-契约与营养配置.md`，v0.2，SHA256 `60F086317DBA441DF20D3E7B571D58172ED2F8FA062202D03B0AC92D1B26A244` |
| 反馈模板 | `Resources\模板\外部任务交付反馈.md`，SHA256 `50061F5474E04798956BCA5977093CC4CF1C7042F8B8333942FC03C586E9D4D9` |
| 项目 MEMORY 四文件 | `MEMORY\MEMORY.md`、`决策点.md`、`待办.md`、`事实.md`，2026-10-20 版本，只读；未改动 |
| P01 接口裁定 | `Resources\报告\T01-P01-接口裁定-20261020.md`，v1.1，SHA256 `C19E18FF2C01CE3224A1D19185BFC146089B5464C90D447FDAE3A966084DEDAF` |
| P01 营养收口裁定 | `Resources\报告\T01-P01-营养配置收口裁定-20261020.md`，`2026-10-20-t01-nutrition-resolution-v1`，SHA256 `196121CA75EF6750E5DD8E83078CF0DA747AD454378DFA6A114E8627EA794302` |
| 旧 v1 契约候选 | `Resources\契约\T01-v1-candidate\contract-v1-candidate.md`，SHA256 `008C30DD5323044028A6EF86FF778459DE35B02C4D8B02C32755C5E45F49E76C`；只读，未变 |
| 旧 v1 营养配置 | `Resources\契约\T01-v1-candidate\nutrition-v1-candidate.json`，SHA256 `E91D6B079B3F1E82DB36C1491B14CAF58C11B0FB1135EA3996E784F349F38203`；只读，未变 |
| 旧 v1 配对样例 | `Resources\契约\T01-v1-candidate\plan-request-result-sample.json`，SHA256 `085C07D054FD4C852E328DF3F7DBBDD4D76B5966CA4D204EC1BF6A417D4A13E5`；只读，未变 |
| P09 旧提案核验 | `Resources\报告\T01-P09-营养配置独立核验-20261020.md`，SHA256 `1723320E1624E18F7DEDB78EC06CCDA65BF167AE7FD4256E0AC1F5719F269FA7`；历史证据，不适用于本次新候选 |
| P09 当前候选与裁定复核 v2 | `Resources\报告\T01-P09-当前候选与营养裁定复核-v2.md`，SHA256 `BF51E34FCB4F006D7C165FBBA4490250F13AF301B0661B641515D6BA40B6709D`；针对旧 v1 候选与裁定，不适用于本次新候选 |
| P02 三方查收 | `Resources\报告\T01-P02-三方任务查收-20261020.md`，SHA256 `C541A065EDD7686F045D7B798923046671F2BF45C6DB7EED975F9F14B86E66C1` |
| 本单执行提示词 | `Resources\任务提示词\T01-DSH-营养配置修订-v3.md`，SHA256 `5D0D708E4C1ABE24C1201B02EFFFECF6F6499402266C4C99280F9A410DEFB3E9` |

不可读项：无。未读真实菜单、AppID、红米设备、服务端模型/额度；不存在阻塞读取。

## 模型与平台（请求/可观察/未知分开记录）

- P01 指定请求模型：**DeepSeek V4.1 Flash**；原生思考档位未新增指定。
- 平台/会话：DSH Desktop，`DSH_SESSION_ID=session-62cdda45-8c47-4377-8e61-f78fafac952e`，`DSH_PROFILE=desktop`。
- 当前可观察本地配置：`provider=deepseek-account`、`model=deepseek-flash`、`reasoningEffort=high`（读取 `C:\Users\link\.dsh\profiles\desktop\cordis.patch.yml` 第 4–9 行，文件级证据）。这是本地配置证据，不是服务端或账单级证据；本次未切换模型/档位，未新增付费推理。
- 服务端实际模型/版本、额度、订阅、计费：**未知**。既有 P02 报到中的 `deepseek-flash/high` 只是此前本地自述，不代表本次实际服务端配置。

## 交付文件（绝对路径、版本、SHA256）

1. `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\契约\T01-v1.1-candidate\contract-v1-candidate.md`
   - 版本：`t01-contract-v1.1-candidate`；316 行 / 30,162 字节；SHA256 `967584E720485821284D4761F64E5F7FB6DF67923DF94EBE62262F5F8E8B4838`
2. `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\契约\T01-v1.1-candidate\nutrition-v1-candidate.json`
   - 版本：`nutrition-v1.1-candidate`；17,531 字节；SHA256 `30BBFE64FB80CCD850DD38CE9122101BE3D5467872DE1C05674DB4325BAE4FA1`
3. `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\契约\T01-v1.1-candidate\request-result-pair.json`
   - 版本：`t01-pairs-v1.1-candidate`；32,750 字节；SHA256 `4FEAA3E17BFBEBD8898AA038E16236DCA2B3EEFFDD6478EED8EC54E8666C4DA5`
4. 本反馈文件：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T01-DSH-营养配置修订-交付反馈-v3.md`

未交付项：无。新目录原先不存在；三份候选均新建，未覆盖任何文件；旧 v1 三份哈希保持上表值不变（复核结果）。

## A–J 与修订方式逐项核对

- **A REE/公式/BMI**：契约术语统一为估算 REE，Mifflin–St Jeor 原式与整数换算沿用；BMI 用未舍入交叉乘法，显示单独舍入；配对样例覆盖 53,349g/1,700mm（未舍入 18.4599、显示 18.5、拦截过轻）与 53,465g/1,700mm（BMI 恰 18.5、不误拦）。
- **B 自动估算人群**：18–78 岁、健康、非孕哺、无需疾病饮食管理；18 岁可用但默认 `AGE_18_EXTRAPOLATION` 提示，不称 Mifflin 验证 18 岁；<18、>78、孕哺、疾病饮食 → `AUTO_TARGET_DISABLED`，保留档案/手选/记餐/专业目标存证，关闭自动目标与自动配餐，`PlanDay` 返回 `TargetUnavailable`。
- **C 过轻**：未舍入 BMI<18.5 时 fatLoss 不生成自动减脂目标；maintain 仅 `REFERENCE_ONLY`（REE/TDEE 参考、缺口 0、非自动配餐目标）；manual 可存证、手选/记餐，首版不自动规划；不改写已有记录。
- **D 活动系数**：保留 1200/1375/1550/1725/1900‰ 为可调 REE 产品乘数初值；五档文案、按日常主要活动选档、运动与体力工作不重复加成、仅用户显式调整；来源标“P01 产品估算初值”，不称 PAL/指南。
- **E 蛋白质**：普通 1.2 g/kg/day 为可调产品默认（成人 DRI 0.8 是参考基准，不证明 1.2 人人最佳）；训练 1.5 g/kg/day 仅健康规律运动者主动选择，产品分流条件为最近 4 周每周≥3 次、每次约 30 分钟，不称 ISSN 阈值；ISSN 1.4–2.0 仅支持健康运动人群。
- **F 脂肪/碳水/餐次/缺口**：27%、30/40/30、10% 且最多 300 kcal/day 均为可调产品初值，碳水按余能量，不写普适医学处方。
- **G 低摄入门槛**：男 1500、女 1200 kcal/day 为本应用自动目标产品下限；低于下限 → `TARGET_REVIEW_REQUIRED`，不自动抬高/降低蛋白、不生成自动配餐；可存证专业目标与记录摄入，但不应用。
- **H 宏量门槛**：19–78 岁蛋白 10–35%、脂肪 20–35%、碳水 45–65%、碳水≥130g/day；18 岁按 4–18 岁参考表蛋白 10–30%、脂肪 25–35%、碳水 45–65%；超范围 → `TARGET_COMPOSITION_CONFLICT`，回显实际比例与范围、保留可查看值、不应用；判定使用未舍入整数/交叉相乘，显示比例单独舍入。女性 1200 kcal/80kg/训练 1.5g/kg 压力例触发冲突（蛋白 40%、脂肪 27%、碳水 33% 且 99g<130g）；1200 恰为女性下限，故不触发低摄入复核。
- **I manual 目标**：`sourceType=professional|userEntered`，来源说明可选，不验证 professional 真伪；保存原值与专业目标存证≠应用；应用前须满足人群、能量下限、宏量非负且完整或已批准派生（逐项 `derivedFields`，不覆盖原始专业值）、通过 H、且 4/9/4 容差 `max(20kcal,目标能量2%)` 内；超容差/缺宏量无派生规则分别 `MANUAL_TARGET_INCONSISTENT`/`MANUAL_TARGET_INCOMPLETE`，存证不应用；manual 不能绕过 B/C/G/H。
- **J 三种状态分开**：每参数分别记录 confirmed product decision、sourceType/sourceSupport、p09ReviewStatus；修订版级 `p09ReviewStatus=pendingReview`；旧 P09 报告仅作历史证据（verdict=not-passed，适用旧文件），未冒写 P09 通过；已清除已决的“待 P01 决定”项，无 `pendingP01Decision` 字符串。
- **修订方式**：只新增 `T01-v1.1-candidate` 三份文件；旧 v1 目录未动（哈希见上）；`contractVersion` 保持 1.0（未冻结、无旧客户端，非迁移、无兼容层）；营养配置新候选版本 `nutrition-v1.1-candidate`，契约引用、样例与文件名一致；半份米饭与整份同价、营养按半份、套餐含饭只计真实总价规则不变；配对样例 8 对，覆盖要求的边界/状态。

## 运行与验证（实际执行）

- 使用 PowerShell 内联 `ConvertFrom-Json` 解析两份新 JSON：均成功；`nutrition-v1-candidate.json` 版本为 `nutrition-v1.1-candidate`、`p09ReviewStatus=pendingReview`、`sourceRefs` 6 条；`request-result-pair.json` 解析成功，`pairs` 共 8 对，每对请求内嵌完整 `nutritionConfig` 快照。
- 使用内联正则检查契约内 2 个 JSON 示例：均可解析；Markdown fence 配平。
- 使用内联整数算式（未保存脚本）复算样例关键值：BMI 两侧（18.4599/18.5）、年龄 18 的 REE/TDEE/目标/宏量、女性 1199 低摄入、女性 1200 宏量冲突、manual 容差 39.2/41.2 kcal 两侧；结果与候选文件标注一致。
- 复核旧 v1 三份哈希：未变化。
- **未运行**：C++ 编译/构建、业务代码、算法、真实设备、WASM、Git、安装或外部网络；未写临时脚本文件；未改 ACL/权限。
- 原始证据：以上 inline 验证结果未单独落盘；证据为三份候选文件本身及本反馈；无编造证据路径。

## 未完成/阻塞

1. **P09 对新候选尚未复核**：`p09ReviewStatus=pendingReview`；需要 P09 按本实际文件（路径/哈希见上）独立复核后，才能更新该状态；旧报告不能替代。
2. **P01 开放澄清（非已裁定项）**：P09 v2 提出“18 岁是否也执行 130 g/day 碳水产品门槛”，P01 v3 未列明；v1.1 按字面只执行 18 岁百分比范围（不额外套用 130 g/day），待 P01 冻结前确认；如要求执行，需补该分支及样例。
3. T01 未冻结；未实现、未构建、未真机；不自动解锁 T02/T04/T05。

## 状态

**完成（本单范围）：三份 v1.1 候选与反馈已生成，旧 v1 未改，JSON 与样例算术已自含核对；营养配置仍为 P09 pendingReview，T01 未冻结，无实现/真机验收。**

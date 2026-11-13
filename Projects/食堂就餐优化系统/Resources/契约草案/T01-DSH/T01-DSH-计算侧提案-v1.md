# T01 DSH 计算侧提案 v1

| 项目 | 内容 |
|---|---|
| 提案版本 | T01-DSH-计算侧-v1（2026-10-20，Asia/Shanghai） |
| 提案方 | DSH（DeepSeek Harness 桌面版），本会话 `session-62cdda45-8c47-4377-8e61-f78fafac952e` |
| 接收方 | 真实 P01（经用户手动转交）；P09 后续独立核验营养配置；反重力侧待接合 |
| 任务 | T01 契约与营养配置中的**计算侧协作提案**，不做 T04 实现，不冻结共享契约 |
| 交付文件 | `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\契约草案\T01-DSH\T01-DSH-计算侧提案-v1.md` |
| 状态 | 计算侧提案草案 v1.1（2026-10-20 依独立评审修订：补契约版本、配置快照、已吃隔离、适用性错误分层、目标重算模式、排序/位宽/样例等）；未运行代码、未构建、未运行营养计算程序（§4.6 仅手算算例）、未开始 T04；等待 P01 整合与决定 |

**本提案的性质声明**：以下全部为**建议**。字段名、枚举值、状态集合、公式参数、规模分组、文件归属均不是已冻结契约，不得作为 T04 实现依据，直到 P01 明确冻结并登记版本；营养配置未经 P09 独立核验，不能标“通过”。文中样例是契约说明，不代表已运行、已实现或已验收。任何数字（除产品已确认参数与算例外）都不是性能承诺。

---

## 0. 交付状态、依据与环境核对

### 0.1 平台、会话与模型（可观察事实与未知项）

| 类别 | 本会话可观察事实 | 说明 |
|---|---|---|
| 平台/会话 | DSH Desktop，`DSH_SESSION_ID=session-62cdda45-8c47-4377-8e61-f78fafac952e`；`DSH_PROFILE=desktop`；`DSH_HOME=C:\Users\link\.dsh`；Web GUI `http://127.0.0.1:60712` | 与 T00c 报到时记录的 `session-b6d8307a-…` 不是同一会话；本提案以本会话为当前身份 |
| 请求配置 | 请求模型 DeepSeek V4.1 Flash；原生档位未指定 | 沿用已批准配置，本次未切换模型/档位 |
| 本地可观察配置 | 读取 `C:\Users\link\.dsh\profiles\desktop\cordis.patch.yml` 第 4–9 行：`provider: deepseek-account`、`model: deepseek-flash`、`reasoningEffort: high` | 文件级证据，不是服务端或账单级证据 |
| 服务端未知项 | 服务端实际模型/版本与 `deepseek-flash` 的对应关系、额度、订阅、计费状态 | **未知**，未访问凭据文件，未做服务端验证；不宣称已证实 |
| 文件策略 | workspace-write；审批策略 ask | 本会话只写本提案文件（及为写入该文件所需目录），未改其他项目文件 |

### 0.2 工作区与已实读材料

工作区 cwd `D:\项目\cpp`（实测）；项目根 `D:\项目\cpp\Projects\食堂就餐优化系统`。已实读（本地文件，非备用正文）：

| 材料 | 版本/证据 | 结论 |
|---|---|---|
| `Resources\主PRD.md` | v0.2，24044 字节，190 行；SHA256 实算 `D68ECE7218BC076155A0AFB6200788B7608898E9D0CDF6ECEC27C5E49AA58FDD` | 与提示词给定值**一致**；只读，未改 |
| `Resources\任务卡\T01-契约与营养配置.md` | v0.2，48 行 | 已读；T01 出口为后续开发的冻结契约，本提案不冒充冻结 |
| `Projects\…\AGENTS.md`、根 `AGENTS.md` | 项目协作规则、根行为准则 | 已读；遵循“未获授权不写共享文件、不改权限/ACL” |
| 根 `MEMORY` 四文件、项目 `MEMORY` 四文件 | 根：`MEMORY.md`(12)、`事实.md`(9)、`决策点.md`(8)、`待办.md`(3)；项目：`MEMORY.md`(14)、`事实.md`(45)、`决策点.md`(18)、`待办.md`(31)，2026-10-20 | 已读；T01 未冻结，T02/T04/T05 未派发；M01–M13 所列缺项按项目待办处理；全工作区无业务代码/Git 仓库 |
| `Resources\角色卡\DSH-C++算法.md` | 当前入口（3 行，指向项目 AGENTS 与 MEMORY） | 已读 |
| `Resources\报告\T00c-P02-双平台初始化查收-20261020.md` | 2026-10-20 | 已读；DSH 自述 ACL 范围偏差已记录；本任务不复查、不修复权限 |
| `Resources\报告\T00c-DSH-只读报到-20261020.md` | 2026-10-20 | 已读；用于对照上次报到事实；本次会话 ID 已变化 |
| `C:\Users\link\.codex\plugins\cache\liangsheng-share\liangsheng\2.0.0\skills\liangsheng-workflow\references\代码简洁约定.md` | 15 行，可读 | 已读；第 2 节的错误/所有权设计与第 4 节的“无默认值”遵循该约定 |
| `Resources\任务提示词\T01-DSH-契约与计算配置-v1.md` | T01-DSH-计算侧-v1，96 行 | 本次任务输入 |
| `Resources\任务卡\T04-C++三算法.md`、`T07-实验与一致性.md` | v0.2 | 已读；用于确定性能记录项与 T04/T07 边界 |
| `Resources\任务提示词\T01-反重力-页面数据契约-v1.md` | T01-反重力-页面数据-v1 | 已读；用于识别两侧接合边界 |
| `Resources\契约草案\T01-反重力\T01-反重力-页面数据契约提案-v1.md` | T01-反重力-页面数据-v1，36,590 字节，849 行 | 起草期间出现，已只读实读；两侧差异与 DSH 建议见 §9.1.1，未改对方文件 |

**后续实读**：反重力侧 T01 提案文件在本提案起草期间出现并被实读（§9.1.1），本提案主体仍按计算侧独立立场给出，不因其存在而改写未冻结结论。
**未实读**：真实菜单、AppID、红米设备、服务端模型配置。这些不影响本提案的可独立完成部分。

### 0.3 只读工具链核对（只报告命令与原始结果，未安装、未构建）

在 DSH 会话内实际执行以下命令（`cmd /c "<命令> 2>&1"`，取 `$LASTEXITCODE`）：

| 命令 | 原始结果（摘要） | 退出码 | 结论 |
|---|---|---|---|
| `cmake --version` | `'cmake' is not recognized as an internal or external command, operable program or batch file.` | 1 | 当前 PATH 中不可用；是否安装于其他位置**未核实**，未为核实而全盘扫描 |
| `clang++ --version` | `'clang++' is not recognized as an internal or external command, operable program or batch file.` | 1 | 同上 |
| `g++ --version` | `'g++' is not recognized as an internal or external command, operable program or batch file.` | 1 | 同上 |
| `emcc --version` | `'emcc' is not recognized as an internal or external command, operable program or batch file.` | 1 | 同上；WASM 工具链可用性阻塞 T02，不阻塞本提案 |

结论：本机 PATH 内未发现上述工具；不能据此断言“未安装”，只能记“当前命令不可用/未核实”。本提案不依赖工具链，未运行构建、测试或业务计算。

### 0.4 环境事件与写入路径（如实记录）

- 实测：本会话受限 shell 中 `New-Item` 创建目录、`Remove-Item` 删除文件均被拒绝（`UnauthorizedAccessException: 对路径…的访问被拒绝`；`cmd /c del` 同样 Access denied），根目录 `[System.IO.File]::WriteAllText` 可写。为完成交付，改用 DSH 文件写工具创建了 `Resources\契约草案\T01-DSH\` 目录并写本文件（成功）。
- 由此留下一个探测文件 `Resources\契约草案\T01-DSH\_write_probe.md`：当前沙箱拒绝删除操作，DSH 无法自行清理；该文件不是交付物，请 P01 或用户删除。未因此调整 ACL 或权限。
- 未经批准不修 ACL、不扩写目录、不安装任何工具；上述事件只作事实记录，交 P01 判断是否需要处理。

### 0.5 记号与单位约定（全文通用）

- `待 P01`：需 P01 决策或冻结；`待 P09`：营养来源/算例待独立核验；`待 T02/T07`：需真机或完整规模证据；`未知`：确实没有可核实证据，不猜测。
- JSON 数值：金额一律**整数分**；能量**整数 kcal**；蛋白质/脂肪/碳水以**分克（dg，0.1 g）**存整数；体重**整数 g**；身高**整数 mm**；体脂率**千分比整数**；`null` 表示**未知**，`0` 表示**已知为零**。
- 时间：业务日期 `YYYY-MM-DD`；时刻 ISO 8601 含偏移；`tzOffsetMinutes` 记录记录生成时的本地偏移。
- 哈希：`sha256:` 小写十六进制；样例中的 `sha256:EXAMPLE_NOT_COMPUTED` 是**占位符**，未计算。

---

## 1. 版本化数据契约建议

### 1.1 通用规则（先定边界，再谈字段）

1. **契约版本**：每个顶层对象必带 `contractVersion: "1.0"`（`major.minor`）。这里的“顶层对象”指任一独立入口的完整输入/输出：`Profile`（`ComputeNutritionTarget` 输入）、`MenuCatalog`（`ValidateMenuCatalog` 输入）、`PlanRequest`、`ResultEnvelope`、`MealLog` 均须带版本；嵌套引用不重复带。读取方遇到**未知 major** 必须拒绝并给出可见错误；未知 minor 的附加可选字段允许忽略（前向兼容），但未知**枚举值**必须拒绝——语义型枚举不能猜。
2. **规范性表示**：UTF-8、无 BOM；金额/营养/计数只用 JSON 整数，**禁止浮点**（避免原生/WASM 不一致与累积误差）。哈希覆盖规范化序列化（键排序、无空白、LF）；**哈希对象排除自身的 `hash`/`catalogHash` 字段**（否则自引用无法计算），并排除 `plannerConfigHash` 所指对象之外的字段；哈希由生成方计算、接收方复算，不一致即拒绝。
3. **标识稳定**：ID 为小写字符串，建议 `^[a-z0-9][a-z0-9._-]{0,63}$`；**不得用数组下标**。`dishId` 跨菜单版本稳定；`offerId` 表示可购买的最小售卖单位（同一菜的整份/半份是两个 offer）；`menuVersion` 单调、含日期和序号；请求/记录 ID 由调用方生成且唯一。
4. **未知与零**：营养四项、实付价格、预算允许 `null`。`null` 不参与求和、不得当 0；`0` 是真实已知值（如白水能量 0）。估算值必须带来源与份量假定，且 `estimated=true`；不能把估算改写成实测。
5. **无静默默认值**：营养配置参数、分数权重、限额等缺失或非法时返回可见配置错误，不采用代码内默认值（对齐《代码简洁约定》：默认值必须对应真实业务要求）。
6. **快照优先**：`PlanRequest` 内嵌档案、菜单、营养配置的**完整快照**（或经 P01 批准的内容寻址引用），不让核心读取可变的文件/存储句柄；同一请求字节应产生同一结果字节（§2.1）。
7. **校验边界**：只在核心入口做一次结构/语义校验；内部各层信任已校验对象，内部不变量被破坏时抛出可定位异常，由入口转成可见错误，绝不吞错返回空方案。
8. **迁移策略**：v1.0 是首个契约版本，**当前没有已支持旧版本，不写迁移代码**（不为不存在的旧格式预留兼容层）。未来变更：字段增删走 minor 并加可选字段；语义变更走 major，另发 `v2` 文件 + 明确迁移说明与样例；历史 `MealLog` 快照不迁移、不重写，只用其自带版本解释。

### 1.2 `Profile`（身体档案、目标、偏好）

| 字段 | 类型 | 单位/取值 | 必填 | 说明 |
|---|---|---|---|---|
| `contractVersion` | string | `"1.0"` | 是 | 独立作为 `ComputeNutritionTarget` 输入时也必带 |
| `profileId` | string | 稳定 ID | 是 | 同名档案跨会话稳定 |
| `revision` | int | ≥1 | 是 | 每次用户保存递增；用于判断请求是否用旧快照 |
| `sex` | enum | `male`/`female` | 是 | 公式所需；不推断 |
| `ageYears` | int | 岁，建议 10–100 | 是 | 边界待 P01 定；适用性另判（§4.3） |
| `heightMm` | int | mm，建议 1000–2500 | 是 | 显示可换算 cm |
| `weightGrams` | int | g，建议 25000–250000 | 是 | 精度 1 g；用户按 0.1 kg 录入也可 |
| `bodyFatPermille` | int/null | 千分比，20–600 | 否 | 选填 |
| `weightRecordedOn` | string/null | `YYYY-MM-DD` | 否 | 体重记录业务日期 |
| `activityLevel` | enum | `sedentary`/`light`/`moderate`/`active`/`veryActive` | 是 | 系数映射在营养配置（§4.1） |
| `goal.type` | enum | `maintain`/`fatLoss`/`manual` | 是 | `manual` 指已有专业目标/用户手填目标 |
| `goal.manualTargets` | object/null | 见下 | 条件必填 | `goal.type=manual` 时必填；须通过适用性检查与能量一致性检查（§4.3 A5） |
| `goal.manualTargets.energyKcal` | int | kcal | 是（manual 时） | 手动目标能量 |
| `goal.manualTargets.proteinDg`/`fatDg`/`carbDg` | int/null | dg | 否 | 手动宏观目标；提供时须与能量换算一致；缺失项可按配置比例派生，但必须在结果中标记 `derived`，不得静默补齐 |
| `trainingPreference` | bool | — | 是 | 仅影响蛋白质参数选择 |
| `dietaryFlags.pregnancyOrLactation` | bool | — | 是 | 适用性拦截输入 |
| `dietaryFlags.medicalDietManagement` | bool | — | 是 | 适用性拦截输入 |
| `tastes[]` | array | `{dishId, preference: like/neutral/dislike}` | 否 | 口味偏好；作用于评分与“口味”策略 |

`Profile` 的必填边界：计算目标与方案所需字段全部必填；体脂率、口味、体重记录日期可缺省。档案保存失败/校验失败由调用方（反重力）处理，本提案只定义数据。

### 1.3 `MenuCatalog`（带版本的真实菜单）

设计要点：**菜品主数据（dish）**与**售卖单位（offer）**分离；套餐作为原子售卖单位，价格只记真实总价；售罄/锁定是**按业务日期的外部状态**，不进菜单本体（否则每天改菜单、历史快照失真）。

| 对象 | 字段 | 类型 | 单位/取值 | 必填 | 说明 |
|---|---|---|---|---|---|
| Catalog | `contractVersion` | string | `"1.0"` | 是 | 独立作为 `ValidateMenuCatalog` 输入时也必带 |
| | `menuVersion` | string | 单调版本号 | 是 | 如 `canteen1-20261021-v3` |
| | `catalogHash` | string | `sha256:…` | 是 | 规范化内容哈希（计算时排除本字段，§1.1）；导入时计算、使用时复算 |
| | `canteen` | object | `{id,name}` | 是 | 首批单食堂 |
| | `windows[]` | array | `{windowId,name,mealWindows[]}` | 是 | `mealWindows ⊆ {breakfast,lunch,dinner}` |
| | `dishes[]` | array | 见下 | 是 | 菜品/套餐主数据 |
| | `offers[]` | array | 见下 | 是 | 可购买售卖单位 |
| Dish | `dishId` | string | 稳定 ID | 是 | 跨菜单版本稳定；售罄/锁定/口味引用它 |
| | `name` | string | — | 是 | 显示名 |
| | `kind` | enum | `single`/`combo` | 是 | `combo` 为套餐 |
| | `category` | enum | `staple`/`protein`/`vegetable`/`soup`/`drink`/`other` | 否 | 供“食物类别与多样性”展示/评分（PRD §4）；枚举与是否纳入 v1 评分待 P01 定 |
| | `riceDish` | bool | — | 是 | 只有米饭可为 true；仅它有半份 offer |
| | `components[]` | array | `{dishId,count}` | combo 必填 | 套餐组成，**用于展示与离线核对，不用于核心自动拆价** |
| | `riceIncluded` | bool | — | combo 必填 | 套餐含米饭时，不再重复收米饭费 |
| | `nutrition` | object | `{energyKcal,proteinDg,fatDg,carbDg}`，各 int/null | 是 | null=未知；按“标准售卖份量” |
| | `nutritionBasis` | object | `{source, portionAssumption, estimated, note}` | 是 | `source ∈ label/recipe/referenceTable/estimate/unknown`；估算必须写明份量假定；`unknown` 时四项应为 null |
| | `portionBasis` | string | 文本 | dish 级 | 如“1 碗约 200 g 熟重” |
| Offer | `offerId` | string | 稳定 ID | 是 | 如 `o-rice-half` |
| | `dishId` | string | 存在性校验 | 是 | 指向 dish |
| | `windowId` | string | 存在性校验 | 是 | 所属窗口 |
| | `mealWindows[]` | array | 子集 | 是 | 该 offer 的供应餐次；与窗口供应取交集 |
| | `portionCode` | enum | `full`/`half`/其他扩展 | 是 | `half` 只允许 `riceDish=true` 的 dish |
| | `portionRatioNum/Den` | int | 正数 | 是 | 半份=1/2；营养按比例派生：四舍五入（§4.2），有实测半份数据时用 `nutritionOverride` |
| | `priceCents` | int/null | 分 | 是 | `null`=价格未知（导入不完整时）；不得猜；`null ⇔ priceBasis=unknown` |
| | `priceBasis` | enum | `unitPrice`/`comboTotal`/`unknown` | 是 | 套餐真实总价必须 `comboTotal` 且价格非空；禁止拆成虚构单菜价；未知价格必须 `unknown` |
| | `nutritionOverride` | object/null | `{nutrition, nutritionBasis}` | 否 | 明确实测/标签的售卖单位营养，**必须自带来源、份量假定与估算标识**；优先于比例派生 |

校验规则（语义校验，供菜单导入与核心共用）：
- `offer.dishId`、`offer.windowId` 必须存在；`offer.mealWindows` 必须 ⊆ 所属窗口的 `mealWindows`；
- `portionCode=half` 仅允许 `riceDish=true`；一个菜可有 full/half 两个 offer，也可只有 full；
- `kind=combo`：`priceBasis=comboTotal`，`priceCents` 是套餐真实总价；`components` 只做展示/核对，**核心不按组件价求和、不从组件推断套餐营养**（避免重复计米饭、重复计价）；套餐营养必须由菜单导入给出并写明来源；
- **套餐“可选数量”搭配（待 P01 与反重力侧确认，见 §9.1.1）**：若真实套餐允许“从候选荤/素中自选并满足数量”（PRD “可选数量”），本提案建议在**菜单导入时**把可售组合展平为若干原子 offer（每个组合一个真实总价、一份营养与来源），核心仍只选原子 offer；替代方案是核心内置套餐规则（`comboRules`）展开，灵活但让核心承担更多菜单规则与验收面。未确认前不实现；本提案的 dish/offer 结构对两种方案都可承载。
- `nutritionBasis.source` 与四项 null 状态必须自洽：`source=unknown` ⇒ 四项均 null；`estimated=true` ⇒ `portionAssumption` 非空；
- 价格一致性：`priceCents=null ⇔ priceBasis=unknown`；`priceBasis=comboTotal` 时价格必须非空且按真实总价；`nutritionOverride` 必须带自己的 `nutritionBasis` 且与四项 null 状态自洽；
- 同一菜单版本内 `offerId`、`dishId` 唯一；`menuVersion` 与 `catalogHash` 由导入方生成，失败导入保留旧版本（产品语义在反重力侧实现，本提案只要求核心入口复算并拒绝不一致）。

### 1.4 `PlanRequest`（一次求解请求，无隐藏状态）

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `contractVersion` | string | 是 | `"1.0"` |
| `requestId` | string | 是 | 调用方生成；用于丢弃过期结果、串联日志 |
| `businessDate` | string | 是 | 业务日期；跨日重算由调用方发起新请求 |
| `tzOffsetMinutes` | int | 是 | 生成请求时的本地偏移，记录进结果与日志 |
| `profile` | Profile | 是 | **完整快照**（含 revision） |
| `catalog` | MenuCatalog | 是 | **完整快照**（含 menuVersion/catalogHash） |
| `nutritionConfig` | object | 是 | `{version, hash, formula, sourceRefs, parameters}` 完整快照（§4.1）；不由核心读文件，**不假设默认公式**；`hash` 计算时排除自身 |
| `plannerConfig.algorithm` | enum | 是 | `greedy`/`dp`/`branchAndBound` |
| `plannerConfig.strategies[]` | array | 是 | 子集/全量：`primary`/`economy`/`taste`；顺序固定 |
| `plannerConfig.budgetCents` | int/null | 是 | `null`=不施加预算；`0`=显式零预算（与未设置不同） |
| `plannerConfig.targetMode` | enum | 是 | `referenceShares`（按餐次比例参考）或 `remainingAfterKnownIntake`（按已知已吃扣减后分配，PRD R07）；**无默认值**，不完整摄入时按 §4.2 第 7 条退回并标记 |
| `plannerConfig.maxItemsPerMeal` | int | 是 | 单餐最多可购买单位数（1–8 建议）；候选规模维度 |
| `plannerConfig.limits` | object | 是 | `{maxMealCandidatesPerMeal, maxDpStates, maxSearchNodes, wallClockMs}`；`wallClockMs=null` 表示不限时（用于原生/WASM 结果一致性测试） |
| `plannerConfig.scoringWeightsPermille` | object | 是 | 营养偏差权重（能量/蛋白/脂肪/碳水）与口味权重；缺失=配置错误（§3.3） |
| `planningMeals[]` | array | 是 | 本次要规划的餐次（1–3 个，枚举 breakfast/lunch/dinner）；**不得含 `endedMeals`，也不得含 `activeLogs` 中已有 active 记录的餐次**（已吃餐不得再次规划，PRD R07） |
| `state.soldOut[]` | array | 是 | 业务日期作用域：`{windowId, meal, dishId}`；可空数组 |
| `state.windowLocks[]` | array | 是 | `{meal, windowId}`；锁定后该餐只能在该窗口选 |
| `state.itemLocks[]` | array | 是 | `{meal, offerId, quantity}`；锁定**售卖单位**（offer 唯一确定窗口/份量/套餐），避免 dish+portion 在多窗口/多 offer 场景歧义；`dishId` 只用于展示 |
| `state.endedMeals[]` | array | 是 | 用户明确结束的餐次；不规划、不自动补推 |
| `state.activeLogs[]` | array | 是 | `MealLog[]`，只含**当前业务日期且 status=active** 的记录；只用于已吃与预算核算，**不能作为规划对象** |

校验要点：`activeLogs` 的 `businessDate` 与请求不一致 → 拒绝（`INVALID_INPUT`，调用方应过滤）；`planningMeals ∩ {activeLogs.meal}` 非空 → `INVALID_INPUT`（已吃餐不得再次规划；调用方应排除后再请求，补负例）；锁定 offer 必须存在于当前菜单且供应匹配；锁定项售罄/停售/被新菜单移除 → `LockConflict`（不静默去锁、不返回假合法方案）。请求只描述“这一次求解”，重复规划、跨日由调用方新建请求。

### 1.5 `PlanResult`（一次求解的结果）

外层统一为 **ResultEnvelope**：

```json
{ "contractVersion": "1.0", "requestId": "…", "ok": true, "error": null, "result": { } }
```

- `ok=false` 只用于**契约级失败**：`error.code ∈ { INVALID_INPUT, UNSUPPORTED_CONTRACT_VERSION, INTERNAL_ERROR }`，以及**用户请求的目标本身被适用性拦截**（`APPLICABILITY_BLOCKED`，仅当请求的 `goal` 在 `blockedGoals` 内；maintain/manual 不因过轻/孕哺/疾病饮食被整体拒绝，warning 走 `result.targets.applicability`，§4.3）。此时 `result=null`，错误带 `fieldPath` 与 `details[]`（可定位字段）。
- `ok=true` 表示请求被理解并执行完，业务结论在 `result.status`；**不能把“无解/预算无解/数据不足/锁定冲突”写成 error 或空方案**。

`result.status` 语义（七种，互斥）：

| status | 含义 | 是否返回方案 |
|---|---|---|
| `Ok` | 至少一套合法方案，无近似、无已知不完整性 | 是 |
| `OkPartial` | 返回合法方案，但带明确限制：锁定/已吃导致营养不完整、价格/预算核算不完整、候选截断/超时近似、少于三套不同方案 | 是，且每项限制进 `diagnostics`/`plans[].flags` |
| `NoFeasible` | 在**未截断**的候选空间内穷尽仍无合法组合（仅当 `search.searchComplete=true` 且无候选截断时允许） | 否 |
| `NoFeasibleWithinBudget` | 存在合法组合，但设了预算且剩余预算内没有任何合法组合；同时给出**明确标注加价**的备选（PRD 3.2） | 是（备选标 `overBudget=true`） |
| `NutritionDataInsufficient` | 菜单候选因关键营养未知而无法自动新增，导致无方案；与“预算无解”“搜索限额”分别表达（PRD 3.1） | 否（保留手选入口由调用方实现） |
| `ResourceLimited` | 达到时间/状态/节点限额仍无合法方案；不得称已证明无解（PRD 6.1） | 否 |
| `LockConflict` | 锁定项失效（售罄/停售/新菜单移除/供应不匹配），须用户先解决 | 否 |

`result` 主要字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `status` | enum | 上表 |
| `businessDate` | string | 回显请求业务日期，便于判断过期/跨日结果（PRD 3.3） |
| `tzOffsetMinutes` | int | 回显请求的本地偏移 |
| `mealOutcomes[]` | array | `{meal, status, planIndex?, reason?}`；多餐请求逐餐表达成功/数据不足/无解/锁定冲突，日级 `status` 取最严重者；单餐请求也必须有且仅一条 |
| `inputDigests` | object | `catalogHash/menuVersion/profileHash/nutritionConfigVersion/nutritionConfigHash/plannerConfigHash`；用于发现混版本 |
| `targets` | object | `{daily, mealReference{meal:…}, source{formula,bmrKcal,tdeeKcal,activityFactorPermille,goal,deficitKcal,deficitCapKcal,applicability}, pendingVerification[]}`；由核心按 §4 计算，调用方不另算 |
| `strategyOutcome[]` | array | `{strategy, planIndex, selectedBecause}`；`selectedBecause ∈ BEST_SCORE/ONLY_LEGAL_PLAN/SAME_AS_OTHER_STRATEGY/NO_COMPARABLE_PLAN` |
| `plans[]` | array | 去重后的不同合法方案（见 §3.4），最多 3 个不同方案；每项结构见下 |
| `intakeSummary` | object | 仅由 `activeLogs` 汇总：`totals{4项已知和}`, `incompleteNutrients[]`, `unknownNutritionItemRefs[]`, `priceIncomplete`, `unknownPriceItemRefs[]`, `activeLogCount`；跨日志引用统一写 `logId#itemKey`（§1.6）；不把推荐计入摄入 |
| `budgetSummary` | object | `{budgetCents, actualSpendKnownCents, actualSpendUnknownItemCount, actualSpendUnknownPriceItemRefs[], budgetAccountingComplete, remainingKnownCents}`；未知实付时 `remainingKnownCents` 只是已知口径，不得称“预算内”；`remainingKnownCents = budgetCents − actualSpendKnownCents`（仅在预算已设置时非 null） |
| `distinctPlanCount` | int | 去重后方案数 |
| `fewerThanThreeReason` | object/null | `{code,message}`；少于 3 套不同方案时必须给出原因，不得复制凑数 |
| `diagnostics[]` | array | `{code,severity(info/warning/blocking),message,fieldPath?,meal?,dishIds?,itemRefs?}`；跨日志引用用 `logId#itemKey`；稳定码见附录 A |
| `search` | object | `{algorithm, searchComplete:boolean, candidatesEnumerated:{meal:int}, nodesEvaluated:int/null, statesEvaluated:int/null, capsHit:[{limit:enum, limitValue:int, observed:int, meal?}], approximations:[{kind:enum, scope, value?, limit?, detail?}]}`；**不含耗时**；限额/近似枚举与附录 A 对齐 |

`plans[]` 元素：

| 字段 | 类型 | 说明 |
|---|---|---|
| `offeredAs[]` | array | 该方案被作为哪些策略的答案提供（去重后可能多个） |
| `nutritionComparable` | bool | 四项营养是否完整可比较；false 时不得给出营养偏差、不得声称达标 |
| `score` | object | `{nutritionDeviationBp:int/null, preferenceScore:int, priceCents:int/null, basis:"complete"/"knownOnlyIncomplete"}`；整数，无浮点 |
| `meals[]` | array | `{meal, windowId, items[], nutrition{knownSums,incompleteNutrients,unknownItemCount,unknownDishIds}, nutritionReferenceTarget{4项}, windowLocked:bool}` |
| `meals[].items[]` | array | `{offerId,dishId,name,portionCode,quantity,unitPriceCents,priceKnown,nutrition{4项/null},nutritionBasis,locked:bool,unknownNutrition:bool,estimated:bool,combo:bool}` |
| `budget` | object | `{budgetCents, remainingBudgetKnownCents:int/null, plannedTotalCents:int/null, plannedTotalKnownCents:int, priceIncomplete:bool, overBudget:bool, withinBudgetKnownAmounts:bool/null, overageCents:int/null, checkBasis:"complete"/"knownActualsOnly"}`；`plannedTotalCents` 仅价格完整时非 null，`plannedTotalKnownCents` 始终为已知和；`overageCents=max(0, plannedTotalKnownCents − remainingBudgetKnownCents)`，预算未设置或价格不完整时为 null |
| `flags[]` | array | 本方案的限制码（附录 A） |

**时间不进 `PlanResult`**：原生/WASM 一致性要求同请求同字节结果；耗时、设备、内存等由性能测量单独记录（§5），避免“结果相同但计时不同”污染契约。同理，**输出顺序必须固定**：`plans[]` 按策略顺序（primary→economy→taste）再按 `planKey`；`strategyOutcome[]` 按策略顺序；`offeredAs[]` 按策略顺序；`diagnostics[]` 按 `(code, fieldPath, meal, dishIds)` 排序；`mealOutcomes[]` 按 `planningMeals` 顺序。排序规则是契约的一部分，用于字节级一致性（§3.4）。

### 1.6 `MealLog`（实际吃了什么，不可变快照）

产品语义：推荐≠已吃；一键确认才计入；重复确认不重复累计；改撤只影响对应实际记录；菜单/价格/营养用**当时快照**（PRD 3.1、3.3、R06/R08）。

| 字段 | 类型 | 说明 |
|---|---|---|
| `contractVersion` | string | `"1.0"` |
| `logId` | string | 记录稳定 ID |
| `confirmationId` | string | 调用方生成的幂等键；同键重复确认返回既有记录、不新增 |
| `businessDate` | string | 记录的业务日期 |
| `tzOffsetMinutes` | int | 记录生成时本地偏移（跨时区/时钟变更不改历史日期） |
| `meal` | enum | `breakfast`/`lunch`/`dinner`/`other`（补记饮料零食可归 `other`） |
| `status` | enum | `active`/`superseded`/`revoked`；仅 `active` 计入汇总 |
| `revision` | int | 从 1 起；由存储层在改撤时维护 |
| `replacesLogId` | string/null | 编辑产生的新记录指向被替换记录 |
| `supersededByLogId` | string/null | 被替换指向新记录 |
| `revokedAt` | string/null | 撤销时刻 |
| `confirmedAt` | string | 确认时刻（ISO 8601 带偏移） |
| `menuVersion` | string/null | 记餐时的菜单版本快照；手录为 null |
| `items[]` | array | 见下；记录内容是快照，不随后续菜单/推荐变化 |
| `items[].itemKey` | string | 记录内唯一键；跨记录引用必须写 `logId#itemKey`（`itemRef`），不得只写 `itemKey` |
| `items[].source` | enum | `menuOffer`/`manual` |
| `items[].offerId`/`dishId` | string/null | `menuOffer` 必填；`manual` 为 null |
| `items[].menuVersion` | string/null | 快照版本 |
| `items[].nameSnapshot` | string | 当时名称 |
| `items[].portionCode` | string | 当时售卖单位 |
| `items[].quantity` | int | ≥1 |
| `items[].unitPriceCents` | int/null | 实付单价（分）；null=未知 |
| `items[].priceKnown` | bool | 与 null 一致；用户可修正实付 |
| `items[].nutrition` | object | 四项 int/null，**当时快照** |
| `items[].nutritionBasis` | object | 来源/份量假定/估算标识/备注 |
| `items[].note` | string | 可选备注 |

幂等/改撤契约（建议，待 P01 与反重力侧共同确认）：
1. 确认：调用方用 `confirmationId` 提交；存储层若已有同键记录则返回既有记录（幂等），核心不重复计入。
2. 编辑：产生**新** `MealLog`（新 `logId`、`revision+1`、`replacesLogId` 指向旧记录），旧记录 `status=superseded`；旧记录内容与快照保留不变。
3. 撤销：旧记录 `status=revoked`、`revokedAt` 写入；不改内容字段。撤销某餐全部有效记录后，该餐回到待处理（PRD 3.3），由用户选择是否结束。
4. 历史 `MealLog` 不因菜单导入、推荐重算而改写；菜单更新只影响未来请求。

### 1.7 版本关系与迁移（建议）

| 版本 | 载体 | 变更方式 | 结果中如何留痕 |
|---|---|---|---|
| 契约 `contractVersion` | 每个顶层对象 | minor 增可选字段；major 新建 v2 文件 + 迁移说明与样例 | envelope 字段 |
| 菜单 `menuVersion`+`catalogHash` | `MenuCatalog` | 导入生成新版本，**不原地改**；失败保留旧版本 | `PlanResult.inputDigests`、`MealLog.menuVersion` |
| 营养配置 `version`+`hash` | `nutritionConfig` | 新配置=新版本；P09 核验后才可用 | `PlanResult.inputDigests.targets` |
| 规划配置/限额 | `plannerConfig` | 与请求一同记录；性能配置由 P01 冻结 | `inputDigests.plannerConfigHash`、`search` |

迁移原则：混版本由 `inputDigests` 暴露，**不猜测兼容**；历史快照只按自带版本解释；不为假想旧格式写兼容分支（《代码简洁约定》第 4 条）。

---

## 2. 统一 C++17 入口与边界

### 2.1 核心 API（草案；非可合入实现）

目标：一个无状态、确定性、JSON 进/JSON 出的核心，原生 CLI 与 WASM 共用同一实现与同一语义；入口只负责“解析→校验→执行→序列化”，不做业务猜补。

```cpp
// 建议公开头文件：include/meal_planner/api.h（草案，未实现）
namespace meal_planner {

// 所有入口返回 ResultEnvelope 的 JSON 文本；不向调用方抛异常。
class ApiResult {
public:
    ApiResult(ApiResult&&) noexcept = default;
    ApiResult& operator=(ApiResult&&) noexcept = default;
    ApiResult(const ApiResult&) = delete;
    ApiResult& operator=(const ApiResult&) = delete;
    const std::string& json() const noexcept;   // 始终是合法 JSON envelope
private:
    std::string json_;
};

ApiResult PlanDay(const std::string& requestJsonUtf8);                 // 全天/剩余餐次规划
ApiResult ComputeNutritionTarget(const std::string& targetRequestJsonUtf8); // 输入 TargetRequest，含 profile+nutritionConfig 快照
ApiResult ValidateMenuCatalog(const std::string& catalogJsonUtf8);     // 菜单导入校验复用
const char* ContractVersion() noexcept;                               // "1.0"，静态存储

} // namespace meal_planner
```

边界规则：

| 情形 | 行为 |
|---|---|
| 输入 JSON 非法 / 版本不支持 / 字段非法 / 配置参数缺失 | 返回 `ok=false` envelope，`error.code` 稳定、`fieldPath` 可定位；**不抛异常给调用方**；不返回部分方案 |
| 业务上无解/预算无解/数据不足/锁定冲突 | `ok=true`，`result.status` 表达；诊断信息完整；不伪装为空方案 |
| 内部不变量被破坏、内存分配失败等 | 入口只在边界捕获并转成 `INTERNAL_ERROR`（含异常类型/消息）；不吞掉、不以默认值继续 |
| 重复调用同一请求 | 结果字节一致（除 OOM 等真实资源失败）；无跨调用状态 |
| 超时/限额 | 结果带 `search.searchComplete=false`、`capsHit[]`、`approximations[]`；已有合法方案时返回并标近似，否则 `ResourceLimited` |

所有权与生命周期（C++）：`ApiResult` 独占 `std::string`；调用方 move 后无需释放；不返回内部缓冲区指针；核心不保留对入参字符串的引用。

异常策略：核心内部允许抛出具体异常（满足课设“异常须抛出并处理”的要求，且内部失败可定位）；**入口是唯一捕获点**，映射为可见错误；不把异常信息丢弃成空结果。具体异常类型/错误码映射在 T04 定，本提案只要求“可定位 + 不吞错 + 不伪装成功”。

另两个入口的结果形态（草案，待 P01 决定是否纳入冻结 API）：

- `ComputeNutritionTarget` 输入为 `TargetRequest = {contractVersion, requestId, profile, nutritionConfig}`（两者均为完整快照，含 `formula`，不由核心默认）；成功：`{contractVersion, requestId, ok:true, error:null, result:{status:"Ok", targets:{daily, mealReference, source, applicability, pendingVerification}, nutritionConfigVersion, nutritionConfigHash}}`；目标被适用性拦截：`ok=false` + `APPLICABILITY_BLOCKED`（含 `blockedGoals[]` 与阈值），**不返回被拦截目标**；可继续但有提示：`ok=true` + `result.targets.applicability.status="passedWithWarnings"`。
- `ValidateMenuCatalog` 成功：`{..., requestId:null, result:{status:"Ok", menuVersion, catalogHash, diagnostics:[]}}`；结构/语义错误：`ok=false` + `INVALID_INPUT`（`details[]` 列出字段与规则），导入方据此保留旧菜单并展示原因。

两个入口与 `PlanDay` 共用同一套错误码与信封规则。信封 `requestId` 定义：`PlanDay` 回显请求 ID；`ComputeNutritionTarget` 回显 `TargetRequest.requestId`；`ValidateMenuCatalog` 为 `null`（无调用方请求 ID）。它们是否进入 T01 冻结范围见 §2.4 第 1 项。

### 2.2 WASM 导出与 JS 侧约定（草案）

```cpp
// 建议导出（extern "C"）：src/wasm/exports.cpp（草案，未实现）
extern "C" {
    unsigned int mp_api_version(void);            // API 结构版本，如 1
    const char*  mp_contract_version(void);       // "1.0"，静态存储，不释放
    char*        mp_alloc(unsigned int bytes);    // 调用方申请入参缓冲区
    void         mp_free(char* p);                // 释放 mp_alloc/mp_plan 返回的指针
    char*        mp_plan(const char* requestJsonUtf8);
    char*        mp_nutrition_target(const char* targetRequestJsonUtf8);
    char*        mp_validate_menu(const char* catalogJsonUtf8);
}
```

复制与释放时机（必须在桥文档与代码注释中写明）：
1. JS 用 `mp_alloc` 申请请求缓冲区，把 UTF-8 请求拷贝进去，调用 `mp_plan`；
2. 返回值是核心用 `malloc` 分配、**调用方负责释放**的 NUL 结尾 envelope；JS 用 `UTF8ToString` 复制成 JS 字符串后**立即 `mp_free`**；
3. 不得在释放后继续使用指针；不得把返回值当静态字符串；`mp_free` 只接受上述分配来源；
4. `mp_plan` 仅在内存分配失败时返回 `nullptr`，此时桥必须显示**可见的资源错误**，不能当作空方案；其他失败全部在 envelope 内；
5. `mp_contract_version`/`mp_api_version` 用于启动时握手：版本不匹配 → 明确提示“WASM 与页面契约不匹配”，不静默降级。
6. 导出函数命名需与反重力侧统一（§9.1.1）：本提案用 `mp_plan/mp_alloc/mp_free`；反重力侧提案用 `SolveMealPlan/FreeMealPlanResult/EvaluateProfileTarget`。命名不改变语义，P01 冻结时选一套即可；DSH 建议保留显式 `mp_alloc/mp_free` 并让返回指针类型为 `char*`（释放需要可写指针），请求缓冲区也由同一对分配/释放函数管理，避免胶水层混用 `_malloc/_free` 与核心分配器。

其他边界约定（待 T02 证据确认）：
- WASM 构建启用 C++ 异常（与核心共用错误路径）会增加体积；若 T02 证明体积/性能不可接受，替代方案必须仍满足“错误可见”，不得吞错；此取舍交 P01/T02 决定。
- 核心无全局可变状态；同一实例串行调用（小程序当前调用方式）。并发调用是否安全**未承诺**，T04 实现时补充说明并验证。
- WASM 内可用 `std::chrono::steady_clock` 做超时判断；但墙钟限额会让原生/WASM 结果可能不同，**一致性测试使用 `wallClockMs=null` + 确定性限额**。

### 2.3 原生 CLI（草案）

```text
mealplanner plan         --request <request.json> [--result <out.json>] [--pretty]
mealplanner target       --profile <profile.json>  [--result <out.json>] [--pretty]
mealplanner validate-menu --catalog <catalog.json> [--result <out.json>] [--pretty]
mealplanner version
```

- 无 `--result` 时 envelope 写到 stdout；机器输出只含 envelope，人类可读提示走 stderr（便于脚本与 T07 重跑）。
- 退出码建议：`0` = `ok=true`（含 OkPartial，方案可用）；`2` = `INVALID_INPUT`/不支持版本；`3` = `INTERNAL_ERROR`；`4` = `ok=true` 但业务无方案/受限（便于批量实验区分）。精确映射 T04 冻结。
- 请求/结果文件路径、相对路径解析、编码（UTF-8 无 BOM）在 T04 说明；CLI 不在契约层添加默认值。

### 2.4 尚未定案的细节（标给 P01/T04）

1. `ValidateMenuCatalog`/`ComputeNutritionTarget` 是否纳入 T01 冻结的正式 API（本提案建议纳入：菜单导入与目标展示都需要“同一实现”，否则两侧会各写一套）。
2. `mp_api_version` 的兼容策略（新增导出函数是否算兼容；建议只增不改签名）。
3. WASM 异常构建策略与体积上限（待 T02 实测）。
4. 核心并发/重入承诺（建议首版明确“单实例串行”）。
5. 结果 envelope 是否包含 `requestId` 回显（建议必须回显；用于丢弃过期结果）。
6. 错误 `details[]` 的最大条数与截断标记（建议带 `truncated` 标志，避免 UI 被超长错误拖垮）。

---

## 3. 合法性、评分与结果排序

### 3.1 硬约束检查顺序（建议冻结）

顺序决定错误呈现优先级；同一层内尽量一次收集多个字段错误，不因第一个错误掩盖其他明显错误。

| 层 | 检查 | 失败表达 |
|---|---|---|
| L1 | JSON 可解析、`contractVersion` 支持 | `UNSUPPORTED_CONTRACT_VERSION` / `INVALID_INPUT` |
| L2 | 结构/类型/枚举/整数范围/必填/ID 格式/日期格式 | `INVALID_INPUT` + `fieldPath[]` |
| L3 | 引用完整性：dish/offer/window/meal 存在；版本哈希匹配；`activeLogs` 属于同一业务日期；限额与权重非负 | `INVALID_INPUT` |
| L4 | 日期/餐次状态：`planningMeals` 不含 `endedMeals`、不含 `activeLogs` 已有 active 记录的餐次；餐次合法 | `INVALID_INPUT`（调用逻辑错误，不是业务无解） |
| L5 | 供应：offer 的 `mealWindows` 含该餐；窗口供应含该餐 | `NoFeasible`（若穷尽）/诊断列出原因 |
| L6 | 售罄：`state.soldOut` 命中的 dish 从自动候选中排除（用户已锁定的售罄项→`LockConflict`，不静默去锁；已吃餐不在 `planningMeals`） | `LockConflict` / 诊断 |
| L7 | 套餐/份量：套餐原子、不拆价；`riceIncluded` 不重复收费；仅米饭半份；数量范围 | `INVALID_INPUT`（菜单数据错误） |
| L8 | 单窗口：每餐默认一个窗口；窗口锁定优先；不得跨窗口拼餐 | `NoFeasible`/诊断 |
| L9 | 营养资格：自动新增候选项四项营养须“已知或带来源与份量假定的估算”；否则不得自动新增 | 若因此无候选 → `NutritionDataInsufficient`；已锁定项保留 |
| L10 | 预算（**策略层约束，不是候选合法性**）：主推荐不得超出剩余可用预算；预算内无解 → `NoFeasibleWithinBudget` + 加价备选 | 上表状态 |
| L11 | 搜索限额：节点/状态/候选/墙钟到限 | 有方案→`OkPartial` 近似；无方案→`ResourceLimited` |

说明：L9 的“锁定项例外”严格按 PRD 3.1——用户手选/锁定未知营养菜可以保留为固定内容，整体营养标不完整，其他菜仍按同一规则求解；不能为凑方案补造数值。

### 3.2 候选生成（三算法共享的基础）

- **粒度**：算法选择的单位是 `offer`（整份/半份/套餐），不是 dish；套餐是原子项，不拆价、不从组件重算营养。
- **单餐**：在指定窗口内选 1..`maxItemsPerMeal` 个不同 offer（同 dish 不同 portion 视为不同 offer）；锁定项必须包含；售罄 dish 排除；未知营养且未锁定的 dish 排除；同窗口约束由 L8 保证。
- **报价**：单餐已知价 = 各 offer 价之和（价格未知则整餐价格不完整）；套餐按 `comboTotal` 整价；米饭半份按半份价。
- **全天**：各餐候选组合的笛卡尔组合受预算、营养与限额约束；`planningMeals` 之外不生成（已结束/不规划餐次不补推）。
- **候选规模记录**：每餐枚举出的合法组合数写入 `search.candidatesEnumerated`；截断/预筛选写 `approximations[]` 与 `capsHit[]`，包含限额值，供 T07 复现。
- **允许的精确剪枝**：若评分指标单调，Pareto/支配剪枝可不损最优性，但必须在 T04 报告中论证并写进实现注释；任何未论证的预筛选一律标近似。**默认建议：先不剪枝，靠限额与分组测规模**（符合“完成版本优先”，不提前做未证明的优化）。

### 3.3 评分（整数、确定性、可比较）

目标值来自 `PlanResult.targets`（核心计算，调用方不得另算）。对一套方案的“计划餐次”计算：

1. **营养偏差**（仅当四项都完整、且 `targets` 有效时）：
   `nutritionDeviationBp = Σ_n round_half_up( |knownSum_n − target_n| × 10000 × w_n / (target_n × 1000) )`
   其中 `n ∈ {energy,protein,fat,carb}`，`w_n` 为千分比权重（`scoringWeightsPermille`）；整数运算、逐步四舍五入（§4.2 的取整规则）；`target_n>0` 由配置校验保证，否则配置错误。
   不完整方案：`nutritionDeviationBp=null`、`nutritionComparable=false`、`basis="knownOnlyIncomplete"`；**不得与完整方案比较排名，不得声称达标**。
2. **口味**：`preferenceScore = Σ_items prefWeight(item)`，`like=+w_like`、`neutral=0`、`dislike=w_dislike`（负数），权重来自配置；整数。
3. **价格**：`priceCents = Σ unitPriceCents`（仅当全部价格已知）；价格不完整时 `priceCents=null`，不得按已知部分当总价。

策略比较键（**字典序**，不是加权和；PRD 3 节：“先比较营养目标满足程度，再比较口味和价格”）：

| 策略 | 比较键（从主到次） | 说明 |
|---|---|---|
| `primary` | 营养偏差 ↑、口味 ↓、价格 ↑、`planKey` ↑（字符串字典序） | 营养优先 |
| `economy` | 价格 ↑、营养偏差 ↑、口味 ↓、`planKey` ↑ | 经济优先，但仍须合法且（价格完整时）预算内 |
| `taste` | 口味 ↓、营养偏差 ↑、价格 ↑、`planKey` ↑ | 口味优先 |

- 上标 ↑=越小越好、↓=越大越好；不可比较项（null）在同策略内排后，并标 `NO_COMPARABLE_PLAN`，不作为“最优”宣称。
- `planKey` 规范化：按餐次、窗口、`offerId:quantity` 排序后拼接；用于**确定性并列排序**与去重。禁止依赖哈希表遍历顺序、指针值、浮点误差或随机数。
- **关于 PRD“先比较营养目标满足程度，再比较口味和价格”**：本提案把该句解释为 **primary 的主次顺序**；`economy`/`taste` 是 PRD R04 明确要求“排序策略有区别”的备选方案，因此允许以价格/口味为主键。若 P01 认定该句约束全部三套方案，则退化为三套共用同一字典序、仅在权重/搜索剪枝上区分（**需 P01 裁定**）；无论哪种，三套都共用硬合法性与完整性门槛，且策略差异必须在界面/结果中显示。
- **食物类别与多样性（PRD §4）**：建议可选评分项 `diversityScore`（按 `dish.category` 的类别覆盖度、重复菜惩罚计算），权重待 P01；若 v1 不启用，必须在界面/报告中明示“未考虑食物类别多样性”，不得暗示已纳入。它与 §3.4 第 3 条的“方案去重/差异度”是两件事，不能混为一谈。
- 所有分数在 `PlanResult` 中给出实际使用值与 `basis`，便于 P09/T09 复核。

### 3.4 排序、去重、多样性、截断与近似

1. **去重**：`planKey` 相同的方案只保留一套；不同策略命中同一方案时合并 `offeredAs`，用 `strategyOutcome.selectedBecause="SAME_AS_OTHER_STRATEGY"` 说明，不复制凑数（PRD R04）。`selectedBecause` 优先级固定为 `ONLY_LEGAL_PLAN`（全局只有一套不同合法方案）> `SAME_AS_OTHER_STRATEGY`（该方案已被前一策略选中）> `BEST_SCORE`；样例中三策略同落一套方案且全局唯一合法，故均为 `ONLY_LEGAL_PLAN`。
2. **方案数不足 3**：给出 `fewerThanThreeReason`，原因至少区分：只有一种不同合法组合 / 预算限制 / 营养数据不足 / 搜索限额 / 锁定过多。不得为凑 3 套造重复或非法方案。
3. **多样性**：v1 只要求“不同合法方案”（`planKey` 不同）；更严格的差异度（如至少换 1 道菜）作为可选策略，默认关闭——避免在候选很少时人为压低方案数。待 P01 决定是否启用。食物类别多样性见 §3.3 的 `diversityScore`（与方案去重不是同一概念）。
4. **输出顺序**：`plans[]` 按策略顺序（primary→economy→taste）再按 `planKey` 排序；`strategyOutcome[]`、`mealOutcomes[]`、`offeredAs[]`、`diagnostics[]` 顺序同 §1.5 规定，保证同请求字节一致。
4. **截断**：候选预筛选、单餐候选上限、DP 桶宽、B&B 节点上限、墙钟上限，全部在 `search.approximations[]`/`capsHit[]` 中可见，字段含类型、实际值、限额值；UI 必须能展示“近似/受限”。
5. **超时**：墙钟到限时若有合法方案则返回（`OkPartial` + `approximation=timeout`），若无则 `ResourceLimited`；**不得声称“已证明无解/最优”**。
6. **最优性声明**：仅当 (a) 候选生成无截断，(b) 无墙钟/节点/状态限额触发，(c) 算法本身在候选空间内是精确的（B&B 且界限可证不漏解；DP 若存在离散化桶，则除非桶宽为 0 否则按近似处理），才可在报告/界面写“已证明该候选空间内最优”；greedy 永不声明最优；全局最优（相对真实可行空间）在候选生成被截断时一律不成立。
7. **预算**：设置预算时，所有返回方案必须满足“已知价格合计 ≤ 剩余可用预算”；若实际支出含未知价，只能称“已知口径内不超”，并标 `budgetAccountingComplete=false`；预算内无解时按 `NoFeasibleWithinBudget` 返回加价备选（`overBudget=true`、`overageCents` 明确），由用户选择或调整预算，不自动放宽。
8. **锁定/售罄**：锁定项参与固定内容；锁定失效 → `LockConflict` 并列出具体项与原因（售罄/移除/供应不匹配）；售罄只作用于请求给定的业务日期，历史摄入不变（PRD 3.3）。
9. **三算法共享基础**：合法性、候选定义、评分键、去重/排序、结果结构完全共享；差异只在搜索策略与限额表现。DP 的状态定义/等价条件/离散化桶宽、B&B 的界限与剪枝、贪心的启发式顺序，须在 T04 源码与报告中可定位并论证；DRAFT 阶段不预写实现。

---

## 4. 营养配置提案

范围：成年学生日常饮食估算，输出为估算，不构成医学处方；产品行为以 PRD 为准。本节给出**公式、单位、参数槽位、取整、拦截与算例**；参数值除“PRD 已确定”外均标待 P01/P09，不预填成结论。

### 4.1 配置结构（版本化、无默认值）

建议独立文件 `config/nutrition/nutrition-v1.json`（P01 组织、DSH 实现、P09 核验；放置路径见 §6）：

```json
{
  "version": "nutrition-20261020-v1",
  "hash": "sha256:<P01 冻结时计算>",
  "formula": "mifflin-st-jeor",
  "sourceRefs": ["<P09 核验后的来源列表>"],
  "parameters": {
    "activityFactorPermille": {"sedentary": 1200, "light": 1375, "moderate": 1550, "active": 1725, "veryActive": 1900},
    "fatLossDeficitPermille": 100,
    "fatLossDeficitCapKcal": 300,
    "proteinMgPerKgNormal": 1200,
    "proteinMgPerKgTrainingPreference": 1500,
    "fatEnergyPermille": 270,
    "mealSharePermille": {"breakfast": 300, "lunch": 400, "dinner": 300},
    "applicability": {
      "adultAgeMin": 18, "adultAgeMax": 65,
      "bmiUnderweightThresholdTenths": 185,
      "lowIntakeFloorKcalMale": 1500, "lowIntakeFloorKcalFemale": 1200
    }
  }
}
```

`formula` 必须随快照传入；**v1 只接受 `mifflin-st-jeor`**，其他值拒绝（`INVALID_INPUT`，`fieldPath="nutritionConfig.formula"`），核心不内置默认公式；`sourceRefs` 为 P09 核验后的来源编号/链接列表，缺失=配置错误。

参数状态表：

| 参数 | 单位 | 当前状态 | 说明 |
|---|---|---|---|
| Mifflin–St Jeor 公式与项 | — | PRD 已确定 | 具体项、单位、边界样例由本提案给出，P09 独立核验 |
| `activityFactorPermille` | 千分比 | 待 P01 定值、待 P09 核验来源 | 上述 1200–1900 是**常规参考位**，不是已核验配置；不得当医学建议 |
| `fatLossDeficitPermille`（10% = 100） | 千分比 | **PRD 已确定** 10%，作为配置值由 P01 冻结；公式读取参数，不写死 | 产品初始参数，标记可校正 |
| 缺口上限 300 kcal/日 | kcal | **PRD 已确定** | 同一初始参数 |
| 普通/训练蛋白质参数（配置文件用 mg/kg，展示可换算 g/kg） | mg/kg | 待 P01/P09 | 槽位必需；示例 1200/1500 mg/kg 仅为算例演示，**不是建议值** |
| 脂肪供能比 | 千分比 | 待 P01/P09 | 示例 270‰ 仅为算例演示 |
| 餐次分配 | 千分比 | 待 P01/P09 | 示例 300/400/300 仅为算例演示 |
| 成人年龄范围 | 岁 | 待 P01 定 | 当前示例 18–65，边界与提示行为未冻结 |
| 体重过轻 BMI 阈值 | 十分位 BMI | 待 P01 定 | 示例 18.5（`185`）；`bmiTenths < 185` 判过轻 |
| 低摄入拦截阈值 | kcal/日 | 待 P01/P09 | 示例 1200/1500 仅占位；手动目标须检查 |
| 评分权重 `w_n`、口味权重 | 千分比 | 待 P01 定 | 属于评分契约，不在营养配置文件；缺省=配置错误 |

原则：**参数缺失或非法 → 配置错误（`INVALID_INPUT`/`INTERNAL_ERROR` 可见），不取代码内默认值**；配置版本与哈希随请求传入，结果回显。

### 4.2 计算链（全整数、单次取整、可复算）

约定：`w10`=体重（0.1 kg 整数），`h10`=身高（0.1 cm 整数），`a`=年龄整数；`mkcal`=千分之一 kcal；`dg`=0.1 g。取整统一为**非负整数四舍五入**：`round_half_up(x, d) = (2x + d) / (2d)` 的整数除法（`x,d` 非负）。

**位宽**：所有中间量用 `int64_t` 计算（如 `bmr_mkcal×activityFactorPermille ≈ 2.6×10⁹`、`weightGrams×10000 ≤ 2.5×10⁹`、偏差公式乘积更大，均超 `int32`）；输出到 JSON 的整数须在 ±(2⁵³−1) 内并在入口校验，越界 = `INVALID_INPUT`；禁止用浮点中转。

1. **BMR（基础代谢）**
   `bmr_mkcal = 1000·w10 + 625·h10 − 5000·a + sexTerm`，其中 `sexTerm = +5000`（男）/ `−161000`（女）。
2. **TDEE（估算消耗）**
   `tdee_mkcal = round_half_up(bmr_mkcal × activityFactorPermille, 1000)`。
3. **目标能量**
   - `maintain`：`targetEnergy_mkcal = tdee_mkcal`；
   - `fatLoss`：`deficit_mkcal = min( round_half_up(tdee_mkcal × fatLossDeficitPermille, 1000), fatLossDeficitCapKcal×1000 )`，`targetEnergy_mkcal = tdee_mkcal − deficit_mkcal`；缺口比例必须从配置读取，不得写死 10%；
   - `manual`：使用用户/专业目标，须通过 §4.3 检查。
   `targetEnergyKcal = round_half_up(targetEnergy_mkcal, 1000)`。
4. **蛋白质目标**
   `proteinDg = round_half_up(proteinMgPerKg × w10, 1000)`（普通/训练偏好二选一）。
5. **脂肪目标**
   `fatKcal = round_half_up(targetEnergyKcal × fatEnergyPermille, 1000)`；`fatDg = round_half_up(fatKcal × 10, 9)`。
6. **碳水目标（余量）**
   `proteinKcal = round_half_up(proteinDg × 4, 10)`；`carbKcal = targetEnergyKcal − proteinKcal − fatKcal`（若 ≤0 → 配置/目标错误，可见）；`carbDg = round_half_up(carbKcal × 10, 4)`。
7. **计划餐次参考目标**（由 `plannerConfig.targetMode` 决定，无默认值）：
   - `referenceShares`：`mealTarget_n(meal) = round_half_up(dailyTarget_n × mealSharePermille(meal), 1000)`，按营养素分别取整；
   - `remainingAfterKnownIntake`（PRD R07）：先由 `activeLogs` 求四项目标的已知摄入和；**四项摄入均完整**时，`remaining_n = max(0, dailyTarget_n − intakeKnown_n)`，再按剩余餐次（`planningMeals ∪ 未结束未吃餐次`）的 `mealSharePermille` 重新归一化分配；任一项不完整时退回 `referenceShares` 并标 `NUTRITION_INCOMPLETE`，不得把未知按零扣减。日目标仍为权威展示值，餐次参考仅用于评分与单餐展示。
8. **菜单售卖单位营养**：`offer.nutrition = dish.nutrition × portionRatioNum/Den`（逐项 `round_half_up`）；有 `nutritionOverride` 时以 override 的 nutrition+basis 为准。

规则：同一输入链上只允许在**契约边界**取整一次/每步一次，中间用 mkcal/dg 保留精度；结果 `targets` 回显 `bmrKcal/tdeeKcal/deficitKcal` 等整数值，便于 P09 手算核对。

### 4.3 适用性与拦截（建议顺序）

| 顺序 | 检查 | 触发结果 |
|---|---|---|
| A1 | 年龄在成人范围（建议 18–65，待 P01） | 超出 → `blockedGoals` 含 `fatLoss`；请求 `goal=fatLoss` 时 `ok=false` + `APPLICABILITY_BLOCKED`；`maintain`/`manual` 允许但返回 `APPLICABILITY_WARNING`，提示需专业评估 |
| A2 | BMI：`bmiTenths = round_half_up(weightGrams × 10000, heightMm²)`；`< bmiUnderweightThresholdTenths` 判过轻 | 过轻 → 同上（只拦截自动减脂目标）；维持/手动仍可，须提示 |
| A3 | `pregnancyOrLactation=true` | `blockedGoals` 含 `fatLoss`；fatLoss 请求 blocked，maintain/manual 仅 warning |
| A4 | `medicalDietManagement=true` | 同上；并提示咨询专业人员 |
| A5 | `goal.type=manual`：能量目标低于低摄入阈值、或提供的蛋白/脂肪/碳水目标与能量换算明显不一致（4/9/4） | 拒绝手动目标并给出具体超限项，不静默接受 |
| A6 | 训练偏好：仅切换蛋白质参数 | 不影响适用性判定 |
| A7 | 其他字段范围（身高/体重/年龄/体脂率） | `INVALID_INPUT`，不进入计算 |

`blockedGoals` 与状态（建议）：`blockedGoals` 为本次被拦截的目标列表（v1 只有 `fatLoss`）；请求目标若在列表内 → `ok=false` + `APPLICABILITY_BLOCKED`（`details[]` 含阈值与实测值）；请求目标不在列表内 → `ok=true`，`targets.applicability = {status:"passedWithWarnings", blockedGoals:[...], warnings:[{code:"APPLICABILITY_WARNING", message, detail}]}`（无拦截时为 `{status:"passed", blockedGoals:[], warnings:[]}`）。maintain/manual 不因过轻/孕哺/疾病饮食被整体拒绝（PRD 只要求不自动生成减脂目标）。所有提示文案由反重力侧实现，本提案只定义状态与数值口径。

### 4.4 四项营养各自的完整性语义

| 维度 | 完整（complete） | 不完整（incomplete） | 已知零（0） |
|---|---|---|---|
| 能量 `energyKcal` | 计划/摄入中所有相关项均有已知或带依据的估算能量 | 至少一项为 `null` | 合法值（如白水 0 kcal），不计为不完整 |
| 蛋白质 `proteinDg` | 同上 | 同上 | 同上（极少数食物可为 0） |
| 脂肪 `fatDg` | 同上 | 同上 | 同上 |
| 碳水 `carbDg` | 同上 | 同上 | 同上 |

规则（对应 PRD 3.1）：
- 四项**任一未知**的菜不得被算法自动新增；用户手选/锁定后可保留为固定项；整体营养标“不完整”，不得声称达标。
- 汇总只累加**已知值**：`knownSum` + `incompleteNutrients[]` + `unknownItemIds[]`；未知项不计 0、不进分母；已知零正常参与求和且不触发不完整。
- 显示：每个营养素分别显示“已知小计”与“不完整”标记；不得只给一个总数掩盖缺口；不得把未知当零后说“已满足”。
- 已吃记录含未知项时，按营养素分别标不完整；剩余餐次可参考已知摄入，但明确是“不完整数据下的参考”，不据此加码补偿或宣称全天达标（PRD 3.1）。
- 价格与预算完整性是**独立维度**，不得与营养完整性混为一个“不完整”标志（§1.5 的 `flags` 分开表达）。

### 4.5 来源与核验状态

- 公式依据（PRD 第 4 节列出的入口，本次**未重新打开核验**）：Mifflin–St Jeor（PubMed 2305711）、NIH Body Weight Planner 适用范围、WHO 健康膳食原则、ISSN 运动营养立场声明。上述链接只是来源入口，**不等于本轮已验证**。
- 需要 P09 独立核对：公式各项与单位、活动系数适用性、蛋白质与脂肪/碳水分配依据、餐次分配、低摄入阈值、适用人群边界、边界算例复算。
- 本提案明确：不把估算写成实测；不把产品参数写成指南或医学处方；不因缺失数据补造营养值；无证据的数值不标“已核验”。

### 4.6 边界算例（整数链，供 P09 手算复核）

以下参数值仅用于演示计算链（**非建议取值**），配置版本在 P01 冻结后替换。

**算例 N1：男，20 岁，175.0 cm，70.0 kg，moderate，fatLoss，普通蛋白参数 1200 mg/kg，脂肪 270‰，餐次 300/400/300**

- `w10=700, h10=1750, a=20`；`bmr_mkcal = 1000·700 + 625·1750 − 5000·20 + 5000 = 700000 + 1093750 − 100000 + 5000 = 1,698,750`（1698.75 kcal）
- `tdee_mkcal = round_half_up(1698750×1550, 1000) = round(2,633,062.5) = 2,633,063`（2633.063 kcal）
- 缺口：`round_half_up(2633063×100, 1000) = 263,306`（263.306 kcal）≤ 上限 300 kcal ⇒ 采用；`targetEnergy_mkcal = 2,369,757` ⇒ `targetEnergyKcal = 2370`
- 蛋白质：`round_half_up(1200×700, 1000) = 840 dg`（84.0 g）；蛋白质能量 `round(840×4/10) = 336 kcal`
- 脂肪：`fatKcal = round(2370×270/1000) = round(639.9) = 640`；`fatDg = round(640×10/9) = 711 dg`（71.1 g）
- 碳水：`carbKcal = 2370 − 336 − 640 = 1394`；`carbDg = round(1394×10/4) = 3485 dg`（348.5 g）
- 午餐参考（400‰，`targetMode=referenceShares` 时）：能量 `round(2370×0.4)=948`；蛋白质 `336`；脂肪 `round(711×0.4)=284`；碳水 `1394`（各餐独立取整，和日目标可能有 ±个位数差；`remainingAfterKnownIntake` 的算法与样例见 §4.2 第 7 条、§7.2）

**算例 N2：女，22 岁，162.0 cm，50.0 kg，light，maintain**

- `bmr_mkcal = 1000·500 + 625·1620 − 5000·22 − 161000 = 500000 + 1012500 − 110000 − 161000 = 1,241,500`
- `tdee_mkcal = round(1241500×1375/1000) = round(1,707,062.5) = 1,707,063` ⇒ 目标能量 `1707 kcal`
- 蛋白质（普通 1200 mg/kg）：`round(1200×500/1000) = 600 dg`（60.0 g）；蛋白质能量 240 kcal
- 脂肪：`round(1707×0.27)=round(460.89)=461` kcal；`fatDg = round(4610/9)=512 dg`（51.2 g）
- 碳水：`1707 − 240 − 461 = 1006` kcal；`carbDg = round(10060/4) = 2515 dg`（251.5 g）

**算例 N3：过轻拦截**：男，20 岁，175.0 cm，52.0 kg ⇒ `bmiTenths = round(52000×10000 / 1750²) = round(169.79) = 170`（17.0）< 185 ⇒ `blockedGoals=["fatLoss"]`；请求 `goal=fatLoss` → `ok=false` + `APPLICABILITY_BLOCKED`；请求 `goal=maintain` → 允许维持目标，仅返回 `APPLICABILITY_WARNING`；手动目标仍检查低摄入阈值。

**算例 N4：已知零与未知并存**（食材示例，仅演示汇总口径）：
- 白水：`energyKcal=0, proteinDg=0, fatDg=0, carbDg=0`，来源 label，`estimated=false` → 参与求和，**不算不完整**。
- 麻婆豆腐：`energyKcal=320, proteinDg=null, fatDg=220, carbDg=120` → 能量/脂肪/碳水可计入已知和，蛋白质进入 `incompleteNutrients`，`unknownItemCount=1`；不得把蛋白质按 0 计入后说“达标”。
- 若某方案仅因锁定麻婆豆腐而含未知项：`nutritionComparable=false`，`nutritionDeviationBp=null`，状态 `OkPartial`，提示“营养不完整、不承诺达标”。

**算例 N5：适用性边界（过轻 + maintain 可用，fatLoss 被拦）**：男，20 岁，175.0 cm，52.0 kg，BMI 17.0 < 18.5：
- `goal=maintain` → `ok=true`，`targets.applicability={status:"passedWithWarnings", blockedGoals:["fatLoss"], warnings:[{code:"APPLICABILITY_WARNING", message:"BMI 低于阈值，减脂目标不自动生成"}]}`，目标按 TDEE 计算；
- `goal=fatLoss` → `ok=false`，`error.code="APPLICABILITY_BLOCKED"`，`details[]` 含 `bmiTenths=170`、`threshold=185`；**不返回减脂目标**。

### 4.7 待确认参数（交 P01/P09）

见 §4.1 表格；另包括：`targetMode` 的默认值与 UI 呈现（本提案提供两种模式；`remainingAfterKnownIntake` 符合 PRD R07，但默认由 P01 决定）、低摄入阈值适用性别/体重口径、活动系数的适用条件（如疾病/极高活动）、训练偏好的具体 g/kg、脂肪/碳水上下界、`diversityScore` 是否纳入 v1。以上未确认前，界面不得显示为“已核验营养方案”。

---

## 5. 性能测量约定建议

前提：当前**没有任何性能证据**；本节只冻结“怎么测、记什么、谁负责”，不填响应目标或已有结果（PRD 6.1；A10 待 T02/T07）。数字与上限由 T02 初测、T07 复测后由 P01 冻结为版本化性能验收配置。

### 5.1 规模维度与分组口径

| 维度 | 符号 | 口径 | 说明 |
|---|---|---|---|
| 餐次 | `M` | 本次 `planningMeals` 数（1–3） | |
| 窗口/餐 | `W` | 每餐参与窗口数（含锁定窗口） | 默认单窗口；多窗口用于对比 |
| 售卖单位/窗口/餐 | `D` | 该窗口该餐合法 offer 数（含整/半份、套餐） | 菜品数不等于候选数 |
| 单餐上限 | `K` | `maxItemsPerMeal` | 组合规模 ∝ `C(D,K)` |
| 单餐候选 | `C` | 该餐枚举出的合法组合数 | 记录实际值 |
| 套餐展开 | `P` | combo offer 数及其组件数 | 套餐原子，不拆价；展开只影响校验/展示 |
| DP 状态 | `S` | 状态元组数（含预算/营养桶） | 桶宽同时记录 |
| B&B 节点 | `N` | 搜索节点数 | |
| 全天规模 | — | `M` 餐候选的笛卡尔规模 | 记录乘积而不是只记单餐 |

分组建议（值为**初始测量分组**，成员规模待 T03 真实菜单与 P01 确认；不得当成已达成能力）：

| 组 | 构造 | 用途 |
|---|---|---|
| G0 极小 | `M=1, W=1, D=3–5, K=2` | T02 最小链路；可与手工枚举对照 |
| G1 小 | `M=3, W=1, D=8–12, K=3` | 首批单窗口真实规模 |
| G2 中 | `M=3, W=2, D=12–20, K=3` | 多窗口（锁定对比） |
| G3 完整规模 | 以 T03 真实菜单最大规模为准，结构化记录 `(M,W,D,K)` | T07 复测；上限由 P01 冻结 |
| G4 压力（可选） | 在 G3 上倍增，仅用于找瓶颈 | 不据此宣称支持 |

### 5.2 计时起止边界（必须写进 T04/T07 报告）

| 测量点 | 起点 | 终点 | 说明 |
|---|---|---|---|
| 原生核心（分阶段） | 进入 `PlanDay` 入口前 | 返回 envelope 后 | 记录 parse/validate、候选生成、求解、序列化各阶段；`steady_clock` 单调时钟 |
| 原生 CLI 端到端 | 进程参数解析后 | 结果写盘完成 | 额外记录文件 IO |
| 核心-only（实验构建） | 核心解析前（内部计数器） | 序列化完成（内部计数器） | 分段：parse/verify、candidate、solve、serialize；仅实验构建启用，不进入 `PlanResult`，不得含 JS/桥开销 |
| JS 调用往返 | 调用 `mp_plan` 前 | `mp_plan` 返回后（不含拷贝/释放） | 含 WASM 调用本身；与设备、版本相关 |
| 拷贝与释放 | 返回后开始 `UTF8ToString` | `mp_free` 完成 | 单独记录，不并入核心或往返 |
| 小程序端到端 | 用户操作/页面发起请求 | 结果渲染完成前 | 由反重力侧记录；含加载（如适用）与 UI 更新，不混入算法耗时 |

要求：冷启动单独记录（WASM 加载/编译）；预热与正式测量分开；每次运行记录请求字节数、菜单规模、限额配置、工具/设备版本；**算法耗时与页面端到端耗时不得合并成一个数**。

### 5.3 重复与统计方法

- 预跑：至少 1 次预热（结果丢弃），确认输出正确（与原生对照或已知样例）。
- 正式：同一输入重复 **≥5 次**（G0/G1 建议 10 次），全部原始值保留；报告 **median、min、max**（必要时 p90），并记录离散程度；不得只报最好一次。
- 异常值：工具/环境错误（崩溃、超时、GC 抖动）单独标注并重测，原始记录保留，不删除。
- 跨算法对比：同一菜单、同一目标、同一约束、同一限额、同一计时口径；不同候选规模必须写清；不预设某算法必胜（PRD 5 节）。
- T02 与 T07 的测量脚本、随机种子、样例数据路径与版本一并记录，保证可复现。

### 5.4 资源记录

- 原生：进程峰值工作集/私有字节（Windows 任务管理器/API 或 VS 诊断工具，写明工具与版本）；分配次数（可在实验构建埋点，不计入发布构建）。
- WASM：`WebAssembly.Memory` 增长页数、峰值字节；模块 `.wasm` 大小（原始与 gzip）；实例创建耗时。
- 结构规模：实际 `C/S/N` 计数、候选截断值、状态桶宽、限额命中标志。
- 其他：编译警告数（自有代码 0 warning，A09）、二进制/产物大小、测试用例规模；内存泄漏检查工具与范围（T04 完成条件）。

### 5.5 T02 最小链路与 T07 完整复测各自记录什么

| 项 | T02 最小链路（初测） | T07 完整规模复测 |
|---|---|---|
| 范围 | 1 算法（建议 greedy）、`M=1, W=1, D≤5`、G0 | 3 算法 × G1–G3（含真实菜单），必要时 G4 |
| 正确性 | 原生与 WASM 同一请求结果一致性（字节级，`wallClockMs=null`）；与手工可核对样例一致 | 同核心原生/WASM 一致性扩大；极小原始菜单独立核对单餐候选完整性；全天穷举对照 |
| 计时 | 核心-only 分段、JS 调用往返、拷贝/释放、冷启动、原生核心；各 ≥5 次 | 各规模/算法 ≥5 次，median/min/max，全部原始值 |
| 资源 | WASM 大小、内存页、设备内存；原生内存 | 同左 + 峰值/分配、节点/状态计数 |
| 环境 | 工具链版本、微信开发者工具/基础库版本、红米设备型号、系统版本 | 同左 + 完整实验环境与复现命令 |
| 冻结输出 | 初测值交 P01 写版本化性能配置 | 完整规模值 + 近似/限额行为；不达标先整改，范围/目标变更交用户 |
| 明确不做 | 不把最小链路当完整规模证明 | 不把未测规模写成已达标 |

### 5.6 待冻结字段（T01 只定“字段与方法”，数值待 T02/T07）

建议性能配置字段：`perfVersion`、`platform`（native-cli/wasm/miniprogram/device）、`deviceModel`、`toolchainVersions`、`scaleGroup`、`M/W/D/K`、`menuVersion`、`algorithm`、`limits`、`timingBoundaries`、`repeats`、`aggregation`（median/min/max）、`coldStartMs`、`callMs`、`memory`、`wasmSizeBytes`、`correctnessPass`、`rawDataPath`。`capsHit[]`/`approximations[]` 元素 schema 见 §1.5 的 `search`（`limit/limitValue/observed/meal` 与 `kind/scope/value/limit/detail`）；T07 原始数据必须能映射到这些字段，不得只写自由文本。禁止在本提案中填任何实测数字；未测值写“未测”。

---

## 6. 模块与文件归属建议

前提：目录尚不存在（非 Git 仓库，无分支）；以下全部为**提案**，P01 决定后才建目录/派实现；DSH 本次未创建任何源码目录。

| 建议路径 | 内容 | 建议负责人 | 交接/变更边界 |
|---|---|---|---|
| `contracts/t01/contract-v1.md` + `contracts/t01/schema/*.json` | 冻结后的字段/枚举/状态/错误码与 JSON Schema | P01（DSH 提供计算侧草案与 schema 建议） | 共享契约由 P01 单一协调；字段变更先升 minor 并同步两侧，再集成 |
| `config/nutrition/nutrition-v1.json` + `docs/nutrition/sources.md` | 营养配置、参数、来源与算例 | DSH 起草/实现；P01 组织；P09 核验后冻结 | 版本化、只增不改；P09 未核验不得标通过 |
| `src/core/`（`contract/`、`nutrition/`、`legality/`、`scoring/`、`algorithms/`、`planner/`） | C++17 核心：契约类型、营养、合法性、评分、三算法、结果组装 | DSH | 仅 DSH 写；对外只暴露 `include/meal_planner/api.h` |
| `include/meal_planner/api.h` | 统一入口/类型/错误语义（§2.1） | DSH | 与 P01 冻结的契约版本绑定；变更需两侧同步 |
| `src/cli/` | 原生 CLI（§2.3） | DSH | 只依赖公共 API；供 T07 重跑 |
| `src/wasm/` | WASM 导出与 C ABI（§2.2） | DSH | 产物交反重力；桥接调用文档随产物交付 |
| `miniprogram/**`（页面、交互、存储、菜单导入、WASM 加载/胶水） | 小程序侧 | 反重力 | 不写正式营养公式/算法；只消费 WASM 与契约；DSH 不改页面 |
| `samples/calc/` | 计算侧样例请求/结果、极小原始菜单 | DSH | 与反重力的页面样例分目录，避免互相覆盖 |
| `tests/core/`、`tests/reference/` | 核心单元/边界测试；独立单餐枚举与全天穷举参照 | DSH | 参照实现不复用被测剪枝逻辑（PRD 5 节） |
| `tests/bridge/` | 原生/WASM 一致性、桥错误与内存释放测试 | P01 集成（T02/T06），DSH/反重力协作 | 结果绑定同一候选 |
| `bench/` + `config/performance/perf-v1.json` | 实验脚本、原始数据、性能配置 | DSH 测；P01 冻结 | 数值待 T02/T07；实验数据路径入报告 |
| `CMakeLists.txt`、`cmake/`、`scripts/build-*.ps1` | 原生/WASM 构建 | DSH | 反重力不改进构建；只消费产物 |
| 注释率统计口径（提案） | 自有源码（`src/core`、`src/cli`、`src/wasm`、`miniprogram/src` 中自写文件） | DSH 统计；P01 冻结口径 | 工具：`cloc` 或随仓库脚本；排除第三方/生成物/`node_modules`/WASM 产物/样例数据；分母=非空代码行，分子=有效注释行（排除空白、纯分隔线、无意义填充）；报告原始计数与排除清单（A09） |
| `Resources/报告/` | 各任务报告、环境与原始结果 | 各岗位写自己的；P02 查收；P01 汇总 | MEMORY 仅 P01/P02 维护，DSH 不写 MEMORY/AGENTS/PRD |
| `MEMORY/*`、`AGENTS.md`、主 PRD、T01 卡、共享契约 | 规则/状态/冻结文件 | P01/P02 | DSH 本次未改；后续也不自行改写 |

接口接合边界（建议）：`contract-v1` 的 JSON 与 `api.h` 的 envelope 是唯一跨模块语言；WASM 二进制由 DSH 产出、反重力加载，启动时 `mp_contract_version` 握手；任何字段增删由 P01 在契约文件落版后再进实现。注释率统计口径已在上表给出提案（A09），P01 冻结后 DSH 按该口径执行并报告原始计数。

---

## 7. 必要样例：PlanRequest / PlanResult 配对

说明：样例用于展示契约如何表达“未知营养 + 锁定 + 售罄 + 已吃未知实付 + 预算不完整”；**不是已运行结果，不代表验收**。哈希为占位符；为缩短篇幅只列相关字段（省略处已在字段表中定义）。样例中 `maxItemsPerMeal=2` 且锁定 2 道菜，使合法方案唯一；这不是产品建议。

### 7.1 `PlanRequest` 样例

```json
{
  "contractVersion": "1.0",
  "requestId": "req-20261021-lunch-0001",
  "businessDate": "2026-10-21",
  "tzOffsetMinutes": 480,
  "profile": {
    "contractVersion": "1.0",
    "profileId": "p-local-0001",
    "revision": 3,
    "sex": "male",
    "ageYears": 20,
    "heightMm": 1750,
    "weightGrams": 70000,
    "bodyFatPermille": null,
    "weightRecordedOn": null,
    "activityLevel": "moderate",
    "goal": {"type": "fatLoss", "manualTargets": null},
    "trainingPreference": false,
    "dietaryFlags": {"pregnancyOrLactation": false, "medicalDietManagement": false},
    "tastes": [{"dishId": "d-ck", "preference": "like"}]
  },
  "catalog": {
    "contractVersion": "1.0",
    "menuVersion": "canteen1-20261021-v3",
    "catalogHash": "sha256:EXAMPLE_NOT_COMPUTED",
    "canteen": {"id": "c1", "name": "示例食堂"},
    "windows": [
      {"windowId": "w1", "name": "A窗口", "mealWindows": ["breakfast", "lunch", "dinner"]}
    ],
    "dishes": [
      {"dishId": "d-rice", "name": "米饭", "kind": "single", "riceDish": true,
       "components": [], "riceIncluded": false, "portionBasis": "1碗约200g熟重",
       "nutrition": {"energyKcal": 230, "proteinDg": 40, "fatDg": 5, "carbDg": 500},
       "nutritionBasis": {"source": "referenceTable", "portionAssumption": "1碗约200g熟重", "estimated": true, "note": ""}},
      {"dishId": "d-tofu", "name": "麻婆豆腐", "kind": "single", "riceDish": false,
       "components": [], "riceIncluded": false, "portionBasis": "1份约150g",
       "nutrition": {"energyKcal": 320, "proteinDg": null, "fatDg": 220, "carbDg": 120},
       "nutritionBasis": {"source": "referenceTable", "portionAssumption": "1份约150g", "estimated": true, "note": "蛋白质未知，待补"}},
      {"dishId": "d-greens", "name": "清炒时蔬", "kind": "single", "riceDish": false,
       "components": [], "riceIncluded": false, "portionBasis": "1份约120g",
       "nutrition": {"energyKcal": 90, "proteinDg": 30, "fatDg": 60, "carbDg": 60},
       "nutritionBasis": {"source": "referenceTable", "portionAssumption": "1份约120g", "estimated": true, "note": ""}},
      {"dishId": "d-ck", "name": "宫保鸡丁", "kind": "single", "riceDish": false,
       "components": [], "riceIncluded": false, "portionBasis": "1份约150g",
       "nutrition": {"energyKcal": 450, "proteinDg": 250, "fatDg": 300, "carbDg": 200},
       "nutritionBasis": {"source": "referenceTable", "portionAssumption": "1份约150g", "estimated": true, "note": ""}},
      {"dishId": "d-bun", "name": "肉包", "kind": "single", "riceDish": false,
       "components": [], "riceIncluded": false, "portionBasis": "1个约80g",
       "nutrition": {"energyKcal": 260, "proteinDg": 90, "fatDg": 100, "carbDg": 320},
       "nutritionBasis": {"source": "referenceTable", "portionAssumption": "1个约80g", "estimated": true, "note": ""}}
    ],
    "offers": [
      {"offerId": "o-rice-full", "dishId": "d-rice", "windowId": "w1", "mealWindows": ["lunch", "dinner"],
       "portionCode": "full", "portionRatioNum": 1, "portionRatioDen": 1,
       "priceCents": 150, "priceBasis": "unitPrice", "nutritionOverride": null},
      {"offerId": "o-rice-half", "dishId": "d-rice", "windowId": "w1", "mealWindows": ["lunch", "dinner"],
       "portionCode": "half", "portionRatioNum": 1, "portionRatioDen": 2,
       "priceCents": 80, "priceBasis": "unitPrice", "nutritionOverride": null},
      {"offerId": "o-tofu-full", "dishId": "d-tofu", "windowId": "w1", "mealWindows": ["lunch", "dinner"],
       "portionCode": "full", "portionRatioNum": 1, "portionRatioDen": 1,
       "priceCents": 700, "priceBasis": "unitPrice", "nutritionOverride": null},
      {"offerId": "o-greens-full", "dishId": "d-greens", "windowId": "w1", "mealWindows": ["lunch", "dinner"],
       "portionCode": "full", "portionRatioNum": 1, "portionRatioDen": 1,
       "priceCents": 500, "priceBasis": "unitPrice", "nutritionOverride": null},
      {"offerId": "o-ck-full", "dishId": "d-ck", "windowId": "w1", "mealWindows": ["lunch", "dinner"],
       "portionCode": "full", "portionRatioNum": 1, "portionRatioDen": 1,
       "priceCents": 1200, "priceBasis": "unitPrice", "nutritionOverride": null},
      {"offerId": "o-bun-full", "dishId": "d-bun", "windowId": "w1", "mealWindows": ["breakfast"],
       "portionCode": "full", "portionRatioNum": 1, "portionRatioDen": 1,
       "priceCents": 250, "priceBasis": "unitPrice", "nutritionOverride": null}
    ]
  },
  "nutritionConfig": {
    "version": "nutrition-20261020-v1",
    "hash": "sha256:EXAMPLE_NOT_COMPUTED",
    "formula": "mifflin-st-jeor",
    "sourceRefs": ["<P09 核验后填充>"],
    "parameters": {
      "activityFactorPermille": {"sedentary": 1200, "light": 1375, "moderate": 1550, "active": 1725, "veryActive": 1900},
      "fatLossDeficitPermille": 100,
      "fatLossDeficitCapKcal": 300,
      "proteinMgPerKgNormal": 1200,
      "proteinMgPerKgTrainingPreference": 1500,
      "fatEnergyPermille": 270,
      "mealSharePermille": {"breakfast": 300, "lunch": 400, "dinner": 300},
      "applicability": {
        "adultAgeMin": 18, "adultAgeMax": 65,
        "bmiUnderweightThresholdTenths": 185,
        "lowIntakeFloorKcalMale": 1500, "lowIntakeFloorKcalFemale": 1200
      }
    }
  },
  "plannerConfig": {
    "algorithm": "greedy",
    "strategies": ["primary", "economy", "taste"],
    "budgetCents": 2200,
    "targetMode": "remainingAfterKnownIntake",
    "maxItemsPerMeal": 2,
    "limits": {
      "maxMealCandidatesPerMeal": 64,
      "maxDpStates": 20000,
      "maxSearchNodes": 200000,
      "wallClockMs": null
    },
    "scoringWeightsPermille": {
      "energy": 1000, "protein": 1000, "fat": 1000, "carb": 1000,
      "like": 1000, "dislike": -1000
    }
  },
  "planningMeals": ["lunch"],
  "state": {
    "soldOut": [{"windowId": "w1", "meal": "lunch", "dishId": "d-ck"}],
    "windowLocks": [],
    "itemLocks": [
      {"meal": "lunch", "offerId": "o-tofu-full", "quantity": 1},
      {"meal": "lunch", "offerId": "o-greens-full", "quantity": 1}
    ],
    "endedMeals": [],
    "activeLogs": [
      {
        "contractVersion": "1.0",
        "logId": "log-20261021-b-01",
        "confirmationId": "confirm-20261021-b-01",
        "businessDate": "2026-10-21",
        "tzOffsetMinutes": 480,
        "meal": "breakfast",
        "status": "active",
        "revision": 1,
        "replacesLogId": null,
        "supersededByLogId": null,
        "revokedAt": null,
        "confirmedAt": "2026-10-21T08:05:00+08:00",
        "menuVersion": "canteen1-20261021-v3",
        "items": [
          {"itemKey": "i1", "source": "menuOffer", "offerId": "o-bun-full", "dishId": "d-bun",
           "menuVersion": "canteen1-20261021-v3", "nameSnapshot": "肉包", "portionCode": "full", "quantity": 1,
           "unitPriceCents": 250, "priceKnown": true,
           "nutrition": {"energyKcal": 260, "proteinDg": 90, "fatDg": 100, "carbDg": 320},
           "nutritionBasis": {"source": "referenceTable", "portionAssumption": "1个约80g", "estimated": true, "note": ""},
           "note": ""},
          {"itemKey": "i2", "source": "manual", "offerId": null, "dishId": null,
           "menuVersion": null, "nameSnapshot": "豆浆（手录）", "portionCode": "cup", "quantity": 1,
           "unitPriceCents": null, "priceKnown": false,
           "nutrition": {"energyKcal": 120, "proteinDg": 60, "fatDg": 40, "carbDg": 100},
           "nutritionBasis": {"source": "estimate", "portionAssumption": "中杯约300ml", "estimated": true, "note": "用户手录，实付未知"},
           "note": ""}
        ]
      }
    ]
  }
}
```

### 7.2 `PlanResult` 样例（对上述请求）

```json
{
  "contractVersion": "1.0",
  "requestId": "req-20261021-lunch-0001",
  "ok": true,
  "error": null,
  "result": {
    "status": "OkPartial",
    "businessDate": "2026-10-21",
    "tzOffsetMinutes": 480,
    "mealOutcomes": [
      {"meal": "lunch", "status": "Ok", "planIndex": 0}
    ],
    "inputDigests": {
      "catalogHash": "sha256:EXAMPLE_NOT_COMPUTED",
      "menuVersion": "canteen1-20261021-v3",
      "profileHash": "sha256:EXAMPLE_NOT_COMPUTED",
      "nutritionConfigVersion": "nutrition-20261020-v1",
      "nutritionConfigHash": "sha256:EXAMPLE_NOT_COMPUTED",
      "plannerConfigHash": "sha256:EXAMPLE_NOT_COMPUTED"
    },
    "targets": {
      "daily": {"energyKcal": 2370, "proteinDg": 840, "fatDg": 711, "carbDg": 3485},
      "mealReference": {"lunch": {"energyKcal": 1137, "proteinDg": 394, "fatDg": 326, "carbDg": 1751}},
      "source": {
        "formula": "mifflin-st-jeor",
        "targetMode": "remainingAfterKnownIntake",
        "bmrKcal": 1699,
        "tdeeKcal": 2633,
        "activityFactorPermille": 1550,
        "goal": "fatLoss",
        "deficitKcal": 263,
        "deficitCapKcal": 300
      },
      "applicability": {"status": "passed", "blockedGoals": [], "warnings": []},
      "pendingVerification": ["activityFactorPermille", "proteinMgPerKgNormal", "fatEnergyPermille", "mealSharePermille", "applicability.adultAgeMin", "applicability.adultAgeMax", "applicability.bmiUnderweightThresholdTenths", "applicability.lowIntakeFloorKcalMale", "applicability.lowIntakeFloorKcalFemale"]
    },
    "strategyOutcome": [
      {"strategy": "primary", "planIndex": 0, "selectedBecause": "ONLY_LEGAL_PLAN"},
      {"strategy": "economy", "planIndex": 0, "selectedBecause": "ONLY_LEGAL_PLAN"},
      {"strategy": "taste", "planIndex": 0, "selectedBecause": "ONLY_LEGAL_PLAN"}
    ],
    "plans": [
      {
        "offeredAs": ["primary", "economy", "taste"],
        "nutritionComparable": false,
        "score": {
          "nutritionDeviationBp": null,
          "preferenceScore": 0,
          "priceCents": 1200,
          "basis": "knownOnlyIncomplete"
        },
        "meals": [
          {
            "meal": "lunch",
            "windowId": "w1",
            "windowLocked": false,
            "items": [
              {"offerId": "o-tofu-full", "dishId": "d-tofu", "name": "麻婆豆腐", "portionCode": "full", "quantity": 1,
               "unitPriceCents": 700, "priceKnown": true,
               "nutrition": {"energyKcal": 320, "proteinDg": null, "fatDg": 220, "carbDg": 120},
               "nutritionBasis": {"source": "referenceTable", "portionAssumption": "1份约150g", "estimated": true, "note": "蛋白质未知，待补"},
               "locked": true, "unknownNutrition": true, "estimated": true, "combo": false},
              {"offerId": "o-greens-full", "dishId": "d-greens", "name": "清炒时蔬", "portionCode": "full", "quantity": 1,
               "unitPriceCents": 500, "priceKnown": true,
               "nutrition": {"energyKcal": 90, "proteinDg": 30, "fatDg": 60, "carbDg": 60},
               "nutritionBasis": {"source": "referenceTable", "portionAssumption": "1份约120g", "estimated": true, "note": ""},
               "locked": true, "unknownNutrition": false, "estimated": true, "combo": false}
            ],
            "nutrition": {
              "knownSums": {"energyKcal": 410, "proteinDg": 30, "fatDg": 280, "carbDg": 180},
              "incompleteNutrients": ["proteinDg"],
              "unknownItemCount": 1,
              "unknownDishIds": ["d-tofu"]
            },
            "nutritionReferenceTarget": {"energyKcal": 1137, "proteinDg": 394, "fatDg": 326, "carbDg": 1751}
          }
        ],
        "budget": {
          "budgetCents": 2200,
          "remainingBudgetKnownCents": 1950,
          "plannedTotalCents": 1200,
          "plannedTotalKnownCents": 1200,
          "priceIncomplete": false,
          "overBudget": false,
          "withinBudgetKnownAmounts": true,
          "overageCents": 0,
          "checkBasis": "knownActualsOnly"
        },
        "flags": ["NUTRITION_INCOMPLETE", "BUDGET_ACCOUNTING_INCOMPLETE", "FEWER_THAN_THREE_PLANS"]
      }
    ],
    "intakeSummary": {
      "totals": {"energyKcal": 380, "proteinDg": 150, "fatDg": 140, "carbDg": 420},
      "incompleteNutrients": [],
      "unknownNutritionItemRefs": [],
      "priceIncomplete": true,
      "unknownPriceItemRefs": ["log-20261021-b-01#i2"],
      "activeLogCount": 1
    },
    "budgetSummary": {
      "budgetCents": 2200,
      "actualSpendKnownCents": 250,
      "actualSpendUnknownItemCount": 1,
      "actualSpendUnknownPriceItemRefs": ["log-20261021-b-01#i2"],
      "budgetAccountingComplete": false,
      "remainingKnownCents": 1950
    },
    "distinctPlanCount": 1,
    "fewerThanThreeReason": {
      "code": "NO_DISTINCT_ALTERNATIVE",
      "message": "午餐锁定了 2/2 道菜且宫保鸡丁已售罄，只有 1 套不同合法方案；经济/口味方案与主推荐相同，未复制凑数。"
    },
    "search": {
      "algorithm": "greedy",
      "searchComplete": true,
      "candidatesEnumerated": {"lunch": 1},
      "nodesEvaluated": null,
      "statesEvaluated": null,
      "capsHit": [],
      "approximations": []
    },
    "diagnostics": [
      {"code": "LOCKED_UNKNOWN_NUTRITION", "severity": "warning",
       "message": "已锁定菜品 d-tofu 的蛋白质数据未知；按 PRD 3.1 保留为固定项，整体营养标记不完整，不承诺达标。",
       "dishIds": ["d-tofu"]},
      {"code": "BUDGET_ACCOUNTING_INCOMPLETE", "severity": "warning",
       "message": "早餐存在未知实付记录（豆浆 log-20261021-b-01#i2）；预算核算不完整，剩余预算仅为已知口径。",
       "itemRefs": ["log-20261021-b-01#i2"]},
      {"code": "SOLD_OUT_EXCLUDED", "severity": "info",
       "message": "宫保鸡丁在 2026-10-21 午餐已售罄，未参与自动新增。",
       "dishIds": ["d-ck"]}
    ]
  }
}
```

### 7.3 样例覆盖的状态

| 状态 | 样例中的表达 |
|---|---|
| 已知零与未知 | 样例未出现营养零值；契约用 `0` 表已知零、`null` 表未知（算例 N4 演示），汇总只加已知值 |
| 未知营养 + 锁定 | `d-tofu` 蛋白质 `null`；`itemLocks`（offer 级）固定保留；`incompleteNutrients=["proteinDg"]`、`nutritionComparable=false` |
| 售罄 | `soldOut` 排除 `d-ck`；诊断 `SOLD_OUT_EXCLUDED` |
| 已吃快照 | `activeLogs[0]` 含当时菜单版本、名称、价格、营养快照；手录豆浆 `menuVersion=null` |
| 未知实付 | 豆浆 `unitPriceCents=null`、`priceKnown=false` → `budgetAccountingComplete=false`、`remainingKnownCents` 仅已知口径；跨日志引用写 `log-20261021-b-01#i2` |
| 预算 | 计划 1200 分 ≤ `remainingBudgetKnownCents=1950`；`checkBasis=knownActualsOnly`，不称“预算内”绝对成立 |
| 目标模式 | `targetMode=remainingAfterKnownIntake`：早餐已吃 380 kcal，午餐参考目标按剩余 1990 kcal 的 4/7 分配为 1137 kcal（与固定 948 不同） |
| 适用性 | `targets.applicability={status:"passed",blockedGoals:[],warnings:[]}`；适用性阈值列入 `pendingVerification`（未核验不得当已核验） |
| 少于三套方案 | `distinctPlanCount=1` + `fewerThanThreeReason`，三策略合并为同一方案 |
| 多餐请求 | `mealOutcomes` 单条 `lunch=Ok`；多餐部分失败的最小表达见 §7.4 |
| 无解/限额/锁定冲突 | 本完整样例不出现，最小信封见 §7.4；完整输入/输出配对待 P01 决定是否要求（§8 第 15 项） |
| 时间/性能 | 不在结果中；由 §5 单独测量 |

### 7.4 其余状态的最小输出信封（补充样例）

以下为**最小片段**（省略菜单/档案等完整输入，只示状态与关键字段），使 T01 各业务状态都有可核对样例；完整输入/输出配对在 P01 冻结前按需补齐。均为示例，未运行。

- `Ok`（完整可比较）：`{"ok":true,"error":null,"result":{"status":"Ok","plans":[{"offeredAs":["primary"],"nutritionComparable":true}],"distinctPlanCount":1}}`
- `ComputeNutritionTarget` 成功：`{"ok":true,"error":null,"result":{"status":"Ok","targets":{"daily":{...},"applicability":{"status":"passed"}},"nutritionConfigVersion":"…"}}`
- `NoFeasible`（未截断穷尽）：`{"ok":true,"result":{"status":"NoFeasible","plans":[],"search":{"searchComplete":true,"capsHit":[]},"diagnostics":[{"code":"NO_LEGAL_COMBINATION"}]}}`
- `NoFeasibleWithinBudget`：`{"ok":true,"result":{"status":"NoFeasibleWithinBudget","plans":[{"offeredAs":["primary"],"budget":{"overBudget":true,"plannedTotalKnownCents":2300,"remainingBudgetKnownCents":1950,"overageCents":350}}]}}`
- `ResourceLimited`：`{"ok":true,"result":{"status":"ResourceLimited","plans":[],"search":{"searchComplete":false,"capsHit":[{"limit":"maxSearchNodes","limitValue":200000,"observed":200000}],"approximations":[{"kind":"timeout","scope":"day","limit":300}]}}}`
- `NutritionDataInsufficient`：`{"ok":true,"result":{"status":"NutritionDataInsufficient","plans":[],"diagnostics":[{"code":"NUTRITION_DATA_INSUFFICIENT"}]}}`
- `LockConflict`：`{"ok":true,"result":{"status":"LockConflict","plans":[],"diagnostics":[{"code":"LOCK_INVALID","meal":"lunch","message":"锁定 offer o-tofu-full 已售罄"}]}}`
- `ok=false`（非法输入）：`{"ok":false,"result":null,"error":{"code":"INVALID_INPUT","fieldPath":"plannerConfig.budgetCents","message":"预算须为 ≥0 整数分","details":[]}}`
- `ok=false`（已吃餐被再次规划，负例）：`{"ok":false,"result":null,"error":{"code":"INVALID_INPUT","fieldPath":"planningMeals","message":"planningMeals 不得包含 activeLogs 已有记录的餐次（breakfast）","details":[]}}`
- `ok=false`（适用性拦截）：`{"ok":false,"result":null,"error":{"code":"APPLICABILITY_BLOCKED","fieldPath":"profile.goal","message":"BMI 17.0 低于阈值 18.5，不自动生成减脂目标","details":[{"blockedGoals":["fatLoss"],"bmiTenths":170,"threshold":185}]}}`
- `MealLog` 编辑/撤销：编辑生成新记录 `{"logId":"log-…-02","revision":2,"replacesLogId":"log-…-01","status":"active"}`，旧记录变 `{"logId":"log-…-01","status":"superseded","supersededByLogId":"log-…-02"}`；撤销为 `{"logId":"log-…-02","status":"revoked","revokedAt":"…","revision":3}`，内容快照保持不变。
- 多餐部分失败：`{"ok":true,"result":{"status":"NutritionDataInsufficient","mealOutcomes":[{"meal":"lunch","status":"NutritionDataInsufficient","reason":"NUTRITION_DATA_INSUFFICIENT"},{"meal":"dinner","status":"Ok","planIndex":0}]}}`（日级取最严重；晚餐方案仍返回）

---

## 8. 暂定、待核验与待 P01 决策清单

| # | 事项 | 当前状态 | 负责/阻塞 |
|---|---|---|---|
| 1 | 契约字段名/枚举/状态集合/错误码最终冻结 | 本提案为建议 | P01 决策并与反重力侧对齐；阻塞跨模块实现 |
| 2 | 营养参数：活动系数、蛋白 g/kg、脂肪供能比、餐次分配、成人年龄、BMI 阈值、低摄入阈值 | 仅算例占位 | P01 定值 + P09 独立核验；阻塞 A04 与配置通过版 |
| 3 | 评分权重 `w_n`、口味权重、并列排序的最终键 | 本提案给出字典序结构，权重未定 | P01 定；缺失必须报配置错误 |
| 4 | 餐次参考目标是否按已吃/未知摄入调整 | 已提供 `targetMode` 两种模式；默认由 P01 定 | P01 确认 |
| 5 | DP 离散化桶宽、B&B 界限、候选剪枝策略 | 未实现 | T04 论证 + T07 证据；P01 冻结配置 |
| 6 | 搜索限额默认值与性能验收配置 | 未测 | T02 初测、T07 复测、P01 冻结（A10） |
| 7 | WASM 异常构建策略、体积/内存上限、并发承诺 | 未测 | T02/T04 证据后 P01 定 |
| 8 | `ValidateMenuCatalog`/`ComputeNutritionTarget` 是否正式纳入冻结 API | 建议纳入（输入 `TargetRequest`/`MenuCatalog` 均版本化） | P01 决策（避免两侧各写一套） |
| 9 | `MealLog` 改撤/幂等的实现归属（存储层 vs 核心） | 契约建议：核心只消费 active 日志，幂等在存储层 | P01 与反重力侧共同确认 |
| 10 | 注释率统计口径/工具/排除物（A09，T01 卡要求） | 已在 §6 给出提案 | P01 冻结口径；DSH 按口径报告原始计数 |
| 11 | 真实菜单、套餐规则、AppID、工具链、红米设备 | 缺失/未核实 | M01–M05、M09；不阻塞本提案，阻塞 T02/T03/T04 完成与 A10 |
| 12 | 两侧 T01 提案的字段/枚举/API 冲突 | 反重力提案已出现并已实读，差异清单见 §9.1.1 | P01 组织接合与冻结；DSH 不代改对方文件 |
| 13 | 本会话探针文件 `_write_probe.md`（非交付物） | 已创建，当前沙箱拒绝删除 | 请 P01/用户清理；不影响提案内容 |
| 14 | 服务端模型版本/额度/订阅 | 未知 | 不作为 T01 阻塞；不购买、不切换 |
| 15 | 各业务状态的完整输入/输出配对样例（T01 卡完成条件） | 已给 1 对完整样例 + §7.4 最小信封；完整配对待 P01 决定是否要求 | DSH 在冻结前按需补齐，不冒充已完成 |
| 16 | 食物类别与多样性评分（PRD §4） | 契约已留 `category` 与 `diversityScore` 提案，v1 是否启用待 P01 | P01 定；未启用必须明示 |
| 17 | 适用性错误分层（blocked/warning）与手动目标一致性检查 | 已按评审修改（§4.3） | P01 确认错误码与样例 |

---

## 9. 接合点、未做事项与状态声明

### 9.1 与反重力侧/后续任务的接合点

- **唯一跨模块语言**：契约 JSON（`contracts/t01/contract-v1`，P01 冻结）+ ResultEnvelope；WASM 通过 `mp_plan/mp_free/mp_contract_version` 调用（§2.2）。页面侧只需渲染状态/字段，不另写营养公式或套餐拆价。
- 页面需要的“目标值”应由 `ComputeNutritionTarget` 返回（§2.1），避免页面复算 Mifflin–St Jeor 或蛋白质参数。
- 菜单导入的结构/语义校验可复用 `ValidateMenuCatalog`，导入失败保留旧菜单（产品流程在反重力侧）。
- T02 最小链路需要：本契约冻结版本、原生/WASM 产物、工具链与 AppID/红米；T02 初测值回填性能配置后再由 P01 冻结 A10 相关标准。
- T07 需要 T04/T06 同一候选与本节 §5 的测量口径；本提案不预设任何性能数字。

### 9.1.1 与反重力侧提案的实际差异（实读后，供 P01 决策；非裁决）

反重力提案 `Resources\契约草案\T01-反重力\T01-反重力-页面数据契约提案-v1.md`（T01-反重力-页面数据-v1，849 行）在本提案起草期间出现，已只读实读。以下只列**与计算侧接合直接相关**的差异；两侧均未冻结，最终以 P01 决定为准，DSH 未改对方文件：

| # | 议题 | 反重力提案（实读要点） | 本提案 | DSH 建议/影响 |
|---|---|---|---|---|
| 1 | 营养数值精度 | 克、1 位小数（number，如 `28.5`） | 整数分克 `dg`（如 `285`） | 二进制浮点不参与求和/比较；统一为整数 dg（或十进制字符串），显示层转 g。P01 定 |
| 2 | 策略枚举 | `primary`/`budget_saving`/`taste_first` | `primary`/`economy`/`taste` | 语义一致、命名不同；冻结一套并加映射表，避免两侧各写一套判断 |
| 3 | 状态码 | `SUCCESS`、`PARTIAL_NUTRITION`、`NO_FEASIBLE_SOLUTION`、`BUDGET_EXCEEDED`、`TIMEOUT_APPROXIMATE`、`INPUT_INVALID`、`CORE_EXCEPTION` | envelope `error`（契约级 4 种）+ `result.status`（业务 7 种） | 建议保留“契约错误 vs 业务结论”分层（避免 null/空方案混淆）；对应关系见下表 |
| 4 | 请求边界 | 单餐 `mealType` + `remainingMealTypes`；`todaySpentCents` 由页面汇总；只带 `catalogVersion`，不带菜单快照 | `planningMeals[]`（1–3 餐）+ `catalog/profile/activeLogs` 完整快照；预算与目标由核心算 | 全天预算/跨餐分配需要多餐同请求；页面预汇总会产生第二套预算/营养实现。P01 决定接口形态与快照传递方式 |
| 5 | 档案与目标 | Profile 内嵌 `dailyTarget`、`isApplicableForAutoDeficit`、`mealRatioPreference` | Profile 只存原始身体/偏好；目标由 `ComputeNutritionTarget` 计算并回显 | 存储“算出来的目标”会过期/分叉；建议核心算、页面缓存并带配置版本 |
| 6 | 菜单结构 | 扁平 `dishes`（含 `priceCents`/`halfPriceCents`）+ `combos{rules,candidateDishIds}` | `dishes`（营养主数据）+ `offers`（售卖单位：整/半份、套餐总价） | 套餐“可选数量”是否由核心展开（§1.3）需 P01 定；两种结构都能承载真实总价，但字段需二选一 |
| 7 | 半份米饭 | `halfPriceCents` 缺省时由核心 `round(priceCents/2)` 派生 | 半份是独立 offer，价格必须显式；缺失=价格未知 | 派生价可能造出虚构售价（PRD 要求真实计价）；建议显式缺失即未知，不派生 |
| 8 | 结果中的耗时 | `PlanResult.metrics.elapsedMs`/`statesEvaluated` 在结果内 | 结果不含耗时；由 §5 性能测量单独记录 | 原生/WASM 一致性要求同请求同字节结果；耗时建议放 envelope 非语义字段或独立测量通道，P01 定 |
| 9 | WASM API | `SolveMealPlan(const char*)` 返回 `const char*`；`FreeMealPlanResult(const char*)`；`EvaluateProfileTarget` | `mp_plan` 返回 `char*`；`mp_alloc/mp_free`；`mp_contract_version` 握手 | 命名可统一；返回 `char*`（释放需可写指针）、显式分配/释放、异常不跨边界、版本握手，三点两侧一致 |
| 10 | 确认幂等 | 页面“防重标记”；`MealLog` 无幂等键 | `confirmationId` 幂等键；核心只消费 `active` 日志 | 契约层带幂等键才能被测试（A08）；建议 P01 与反重力确认后纳入 |
| 11 | 餐次状态 | `MealLog.status` 含 `SKIPPED` | 餐次结束在 `state.endedMeals`，不产生虚构摄入记录 | `SKIPPED` 是否入历史由 P01 定；都不得虚构营养/支出 |
| 12 | 文件归属 | `contracts/v1/types.d.ts`、`miniprogram/src/...`、`core/` | `contracts/t01/`、`src/core/`、`src/wasm/`、`bench/` 等（§6） | 均为提案；P01 冻结时统一目录、登记负责人，两侧不并发改同一共享文件 |

状态对应关系（供 P01 写映射表）：`SUCCESS→Ok`；`PARTIAL_NUTRITION→OkPartial`（+ 完整性 flags）；`NO_FEASIBLE_SOLUTION→NoFeasible` 或 `NutritionDataInsufficient`/`LockConflict`（按诊断细分）；`BUDGET_EXCEEDED→NoFeasibleWithinBudget`；`TIMEOUT_APPROXIMATE→OkPartial`（有方案+近似）或 `ResourceLimited`（无方案）；`INPUT_INVALID→envelope INVALID_INPUT`；`CORE_EXCEPTION→envelope INTERNAL_ERROR`。

说明：以上仅比较**接合接口**，不评价反重力侧页面/存储设计；差异数量不影响两侧独立完成度，P01 可按“字段命名、枚举、请求边界、内存契约、文件归属”分组逐项裁定。

### 9.2 本次未做（明确声明）

- 未开始 T04 实现；未写任何可直接合入的 C++ 源码；未创建源码/构建目录。
- 未运行构建、测试、营养计算程序或算法实验（§4.6 仅手算算例）；未取得任何性能数据。
- 未修改 `AGENTS.md`、`MEMORY`、主 PRD、T01 卡、反重力草案或共享契约；未改权限/ACL；未安装工具。
- 未直接联系其他聊天；未提交/推送/发布/产生费用；未宣称服务端模型或营养配置已核验。
- 只新增本提案文件与写入所需目录；另有一个沙箱无法删除的探针文件（§8 第 13 项）。

### 9.3 状态

T01 计算侧提案**已完成（草案）**，等待 P01 整合、决定冻结范围并组织与反重力侧的接合；营养配置等待 P09 独立核验。未冻结共享契约，未开始 T04。

---

## 附录 A：状态码与诊断码（建议，待 P01 冻结）

**ResultEnvelope.error.code**（`ok=false`，契约级失败）：

| code | 含义 | 典型 fieldPath |
|---|---|---|
| `INVALID_INPUT` | 结构/类型/枚举/范围/引用/日期等校验失败 | 具体字段路径 |
| `UNSUPPORTED_CONTRACT_VERSION` | `contractVersion` 不支持 | `contractVersion` |
| `APPLICABILITY_BLOCKED` | 请求的目标在 `blockedGoals` 内，无法生成该目标（§4.3） | `profile.goal` |
| `INTERNAL_ERROR` | 内部不变量/内存等失败，带异常类型与消息，不伪装成功 | — |

**result.status**：`Ok` / `OkPartial` / `NoFeasible` / `NoFeasibleWithinBudget` / `NutritionDataInsufficient` / `ResourceLimited` / `LockConflict`（§1.5）。

**diagnostics/flags 稳定码**：`NUTRITION_INCOMPLETE`、`NUTRITION_DATA_INSUFFICIENT`、`BUDGET_ACCOUNTING_INCOMPLETE`、`PLAN_PRICE_INCOMPLETE`、`OVER_BUDGET_ALTERNATIVE`、`LOCKED_UNKNOWN_NUTRITION`、`LOCK_INVALID`、`SOLD_OUT_EXCLUDED`、`APPROXIMATE_CANDIDATES`、`APPROXIMATE_DISCRETIZATION`、`APPROXIMATE_TIMEOUT`、`SEARCH_LIMIT_REACHED`、`FEWER_THAN_THREE_PLANS`、`NO_DISTINCT_ALTERNATIVE`、`APPLICABILITY_WARNING`。其中 `APPLICABILITY_WARNING` 走 `result.targets.applicability.warnings`（不是 `diagnostics[]`，§4.3）；`capsHit.limit ∈ {maxMealCandidatesPerMeal, maxDpStates, maxSearchNodes, wallClockMs}`；`approximations.kind ∈ {candidateTruncation, dpDiscretization, timeout}`。码值语义在契约冻结时定稿；UI 只按码展示文案，不按文案判语义。

## 附录 B：本提案引用的本地材料（路径与版本）

| 文件 | 版本/证据 | 用途 |
|---|---|---|
| `Resources\主PRD.md` | v0.2，SHA256 `D68ECE…AA58FDD`（实算一致） | 产品语义与约束来源 |
| `Resources\任务卡\T01-契约与营养配置.md` | v0.2 | 任务范围与出口 |
| `Resources\任务卡\T04-C++三算法.md` | v0.2 | 统一入口/导出侧/注释与内存要求 |
| `Resources\任务卡\T07-实验与一致性.md` | v0.2 | 完整规模复测与性能配置 |
| `Projects\食堂就餐优化系统\AGENTS.md`、根 `AGENTS.md` | 当前 | 岗位边界与记录规则 |
| 项目 `MEMORY\MEMORY.md`/`事实.md`/`决策点.md`/`待办.md` | 2026-10-20 | 状态、缺项、模型与授权事实 |
| `Resources\角色卡\DSH-C++算法.md` | 当前入口 | 岗位职责引用 |
| `Resources\报告\T00c-P02-双平台初始化查收-20261020.md`、`T00c-DSH-只读报到-20261020.md` | 2026-10-20 | 平台/模型/权限事实与偏差记录 |
| `Resources\任务提示词\T01-DSH-契约与计算配置-v1.md`、`T01-反重力-页面数据契约-v1.md` | v1 | 任务输入与两侧边界 |
| `…\liangsheng-workflow\references\代码简洁约定.md` | 15 行 | 错误/默认值/兼容层原则 |

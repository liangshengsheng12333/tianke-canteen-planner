# T01 共享契约候选 v1.2（contract-v1-candidate）

| 项 | 内容 |
|---|---|
| 文档版本 | `t01-contract-v1.2-candidate`（2026-10-20） |
| 状态 | **候选草案，未冻结**。P01 判断冻结、P02 登记；本文件不派发 T02/T04/T05，不表示营养已通过或 P09 已复核本文件。 |
| 修订性质 | 夹具小修：修正 `nutritionConfig` 的 `energyFloor` 位置与真实快照哈希，明定过轻+manual 输出并补样例，校正 BMI 恰 18.5 样例说明，收口 18 岁补充裁定文字。营养阈值、半份米饭同价规则、18 岁补充裁定行为不变。旧 `T01-v1-candidate` 与 `T01-v1.1-candidate` 均只读保留。`contractVersion` 仍为 `1.0`：尚未冻结、无已支持旧客户端，不加兼容层。 |
| 依据 | 主 PRD v0.2（SHA256 `D68ECE7218BC076155A0AFB6200788B7608898E9D0CDF6ECEC27C5E49AA58FDD`）；P01 营养收口裁定 v1（`196121CA75EF6750E5DD8E83078CF0DA747AD454378DFA6A114E8627EA794302`）；P01 18 岁碳水门槛补充裁定（`T01-P01-18岁碳水门槛补充裁定-20261020.md`，SHA256 `2197E5B5A41D0D50ECFB3A1EBF978CF5C6FB0A4075F4E7A6C1DDCFA788D0D9EC`）；P09 v1.1 实际候选独立复核 v3（`T01-P09-v1.1实际候选独立复核-v3.md`，SHA256 `AD7420DA7C1B773B5019F308F2087950065FC50FAB11E7816FFD9427DE16FD62`）；旧 v1.1 三份候选（契约 `967584E7…8B4838`、营养配置 `30BBFE64…AE4FA1`、配对样例 `4FEAA3E1…66C4DA5`）；P02 三方查收（`C541A065EDD7686F045D7B798923046671F2BF45C6DB7EED975F9F14B86E66C1`）。 |
| 配套文件 | `nutrition-v1-candidate.json`（`nutrition-v1.2-candidate`）、`request-result-pair.json`（`t01-pairs-v1.2-candidate`） |
| 语言 | JSON 契约。金额整数分；能量整数 kcal；宏量整数 0.1g（`proteinDg`/`fatDg`/`carbDg`）；体重 g；身高 mm；`null`=未知，`0`=已知零。 |

## 0. 通用规则

1. **契约版本**：独立入口输入/输出对象带 `contractVersion: "1.0"`：`Profile`、`MenuCatalog`、`TargetRequest`、`PlanRequest`、`ResultEnvelope`、`MealLog`。未知 major 拒绝；未知 minor 允许可选字段；未知枚举值拒绝。
2. **编码/数值**：UTF-8 无 BOM；金额/营养/计数只用整数，禁止浮点；中间量 `int64_t`；JSON 输出限 ±(2⁵³−1)；越界=`INVALID_INPUT`。输入范围：`heightMm∈[1000,2500]`、`weightGrams∈[25000,250000]`、`ageYears∈[0,120]`，先校验再做 BMI 交叉乘法。
3. **快照哈希（本版新增口径）**：`nutritionConfig.hash` 为 **SHA-256 小写十六进制摘要**，格式 `sha256:<64 hex>`；计算对象是**完整的 `nutritionConfig` 快照**，排除自身根 `hash` 字段；规范化规则：对象键递归按 Unicode ordinal 排序、数组保持原序、UTF-8 无 BOM、紧凑 JSON（无空白、无末尾换行）；摘要由生成方计算、接收方按同一对象复算，不一致即拒绝。**不得用配置文件原始字节哈希冒充快照内容哈希。** 公共配置文件的 `snapshot` 对象即请求 `nutritionConfig` 去掉根 `hash` 后的内容；两者是同一 canonical 内容。
4. **其他哈希**：`catalogHash` 等仍按 v1 规则（规范化序列化、排除自身字段）；未知字段不改变已知语义。
5. **输入范围/标识**：ID 小写稳定字符串 `^[a-z0-9][a-z0-9._-]{0,63}$`，不用数组下标；`dishId` 跨版本稳定；`offerId` 唯一；`recordId`/`confirmationId`/`requestId` 由调用方生成且唯一。
6. **快照与状态**：请求带 `profile`、`catalog`、`nutritionConfig`、当日有效 `mealLogs` 完整快照；核心不读文件/存储，不接受页面预汇总目标或预算；`energyFloor` 位于 `nutritionConfig` 顶层，不在 `parameters` 内。
7. **无静默默认值**：缺失/非法参数→可见错误；不以内置默认值继续。v1 无旧版本，不写兼容/迁移层；历史 `MealLog` 不重写。
8. **校验边界**：只在入口校验一次；内部不变量失败抛可定位异常，入口转可见错误；不吞错、不以空方案伪装成功。
9. **确定性**：同请求同字节（除真实资源失败）；`plans[]` 按策略顺序再 `planKey`；`strategyOutcome[]`/`offeredAs[]` 按策略顺序；`mealOutcomes[]` 按 `planningMeals`；`diagnostics[]` 按 `(code,fieldPath,meal,dishIds)`。耗时/设备不进入结果。

## 1. ResultEnvelope、错误与状态

```json
{ "contractVersion": "1.0", "requestId": "…|null", "ok": true, "error": null, "result": { } }
```

- `ok=false` 仅契约级失败：`INVALID_INPUT`、`UNSUPPORTED_CONTRACT_VERSION`、`INTERNAL_ERROR`；`result=null`；`error` 含 `fieldPath`/`message`/`details[]`。
- 适用性/低摄入/宏量冲突/手动目标问题不是契约错误：`ok=true`，在 `TargetResult.status`/`PlanResult.status` 表达，保留可查看计算值。
- `requestId`：`PlanDay` 回显；`ComputeNutritionTarget` 回显 `TargetRequest.requestId`；`ValidateMenuCatalog` 为 `null`。

`PlanResult.status`：

| status | 含义 | 方案 |
|---|---|---|
| `Ok` | 目标可自动应用、方案完整、无近似 | 是 |
| `OkPartial` | 有方案但存在独立限制标志；不等于营养全缺失或已通过 | 是 |
| `NoFeasible` | 候选未截断且穷尽后无合法组合 | 否 |
| `NoFeasibleWithinBudget` | 有合法组合但剩余预算内无解；返回标加价备选 | 是（`overBudget=true`） |
| `NutritionDataInsufficient` | 关键营养未知导致无自动候选 | 否 |
| `ResourceLimited` | 达限额仍无方案；不得称已证明无解 | 否 |
| `LockConflict` | 锁定 offer 失效，须用户先解决 | 否 |
| `TargetUnavailable` | 营养目标不可用于自动规划：`targetStatus` 为 §8 任一非 `Ok` 状态（含过轻+manual 的 `AUTO_TARGET_DISABLED`）；`targetReasons[]` 回显原因；`plans=[]`，保留手选/记餐/已存证目标 | 否 |

## 2. Profile

字段同 v1.1：`contractVersion`、`profileId`、`revision`、`sex`、`ageYears`、`heightMm`、`weightGrams`、`bodyFatPermille`、`activityLevel`、`goal.type(maintain/fatLoss/manual)`、`goal.manualTargets{energyKcal,proteinDg?,fatDg?,carbDg?,sourceType(professional/userEntered),sourceNote?,derivedFields[]}`、`trainingPreference`、`dietaryFlags{pregnancyOrLactation,medicalDietManagement}`、`tastes[]`。

- `trainingPreference=true` 仅当用户主动确认“最近 4 周每周≥3 次、每次约 30 分钟”的持续规律力量/耐力训练；由调用方按产品分流提问，核心不再追问；风险/超龄人群不应用训练档。
- 输入范围：`heightMm∈[1000,2500]`、`weightGrams∈[25000,250000]`、`ageYears∈[0,120]`；否则 `INVALID_INPUT`。
- Profile 只存输入与手动目标；目标/预算/派生值由核心计算；缓存须带 `revision` + `nutritionConfig.version`。

## 3. MenuCatalog、dishes、offers、comboRules

结构同 v1.1：

- `Catalog{contractVersion,menuVersion,catalogHash,canteen,windows[],dishes[],offers[],comboRules[]}`。
- `Dish{dishId,name,kind(single/combo),category?,riceDish,components[],riceIncluded,nutrition{energyKcal,proteinDg,fatDg,carbDg},nutritionBasis{source,portionAssumption,estimated,note},portionBasis?}`；`category ∈ staple/protein/vegetable/soup/drink/other`，未知类别不计多样性覆盖。
- `Offer{offerId,dishId,windowId,mealWindows[],portionCode(full/half),portionRatioNum/Den,priceCents,priceBasis(unitPrice/comboTotal/unknown),nutritionOverride?}`；`priceCents=null ⇔ priceBasis=unknown`。
- 半份米饭：仅 `riceDish=true` 可有 half offer；`priceCents` 必须等于同窗口同一米饭 dish 的整份 offer 价格（同价，不除以二、不派生）；整份未知则半份未知；营养按比例逐项 `round_half_up`。
- 固定套餐：独立营养优先；否则组件齐全/份量确定/来源完整时汇总，`nutritionBasis.source=comboComponentSum`，不完整则不得自动新增；只按 `comboTotal` 真实总价，不拆价、不重复收饭。
- `comboRules` 最小结构同 v1.1：`{ruleId,name,windowId,mealWindows[],totalPriceCents,includesRice,requiredCounts{category:count},candidateDishIds[],nutritionPolicy:"sumComponents"}`；展开为原子 offer，`offerId=ruleId#<dishId升序>`；示例见 v1.1 §3，未变更。

## 4. PlanRequest 与 nutritionConfig

`PlanRequest` 字段同 v1.1：`contractVersion`、`requestId`、`businessDate`、`tzOffsetMinutes`、`profile`、`catalog`、`nutritionConfig`、`plannerConfig{algorithm,strategies[],budgetCents,maxItemsPerMeal,limits{...}}`、`planningMeals[]`、`state{soldOut[],windowLocks[],itemLocks[{meal,offerId,quantity}],endedMeals[],activeLogs[]}`；校验规则同 v1.1（日志日期、重复 recordId、已吃/已结束餐次不可规划、锁定失效、价格一致性、半份规则）。

`nutritionConfig` 是 canonical 快照，字段固定为：

| 字段 | 说明 |
|---|---|
| `version` | `nutrition-v1.2-candidate` |
| `hash` | 本快照的 `sha256:` 摘要（计算时排除本字段，§0 第 3 条） |
| `formula` | `mifflin-st-jeor` |
| `parameters` | `{fatLossDeficitPermille,fatLossDeficitCapKcal,activityFactorPermille{5档},proteinMgPerKgNormal,proteinMgPerKgTrainingPreference,fatEnergyPermille,mealSharePermille{3餐}}`；**不含 `energyFloorKcal`** |
| `population` | `{ageMinYears,ageMaxYears,pregnancyOrLactationPolicy,medicalDietPolicy}` |
| `macroThresholds` | `{adult19To78{proteinBp,fatBp,carbBp,carbFloorGPerDay},age18{proteinBp,fatBp,carbBp,carbFloorGPerDay}}` |
| `energyFloor` | `{maleKcalPerDay,femaleKcalPerDay}`（顶层；v1.2 起强制位置） |
| `manualTargetRules` | `{sourceTypes[],tolerance,derivedFieldsAllowed}` |
| `plannerSorting` | `{nutritionDeviationWeightsPermille{4},nutritionTierWidthBp}` |

公共配置文件的 `snapshot` 对象就是上述 canonical 内容（不含 `hash`）；请求里的 `nutritionConfig` 为其加上 `hash`。哈希不得以配置文件字节计算。

## 5. PlanResult

`result`：`status`（§1）、`targetStatus`（`TargetUnavailable` 时）、`targetReasons[]`（`TargetUnavailable` 时回显，如 `UNDERWEIGHT`、`MANUAL_STORAGE_ONLY`、`PREGNANCY_OR_LACTATION`）、`businessDate`/`tzOffsetMinutes`、`mealOutcomes[]`、`inputDigests{...nutritionConfigHash}`、`targets`（仅 `Ok`）、`strategyOutcome[]`、`plans[]`、`intakeSummary`、`budgetSummary`、`distinctPlanCount`/`fewerThanThreeReason`、`diagnostics[]`、`search{...}`。

- `TargetUnavailable`：`plans=[]`；`diagnostics[]` 含 `TARGET_NOT_APPLICABLE`（`targetStatus`、`targetReasons[]`）；不伪造方案。
- `plans[]`：`offeredAs[]`；`score{nutritionCompleteness,comparisonBasis,nutritionDeviationBp,nutritionTier,preferenceScore,priceCents,diversity{categoryCoverage,repeatedDishCount,unknownCategoryItemCount}}`；`meals[]{meal,windowId,items[],nutrition{knownSums,incompleteNutrients,unknownItemRefs},nutritionReferenceTarget,windowLocked}`；`budget{budgetCents,remainingBudgetKnownCents,plannedTotalCents,plannedTotalKnownCents,priceIncomplete,overBudget,withinBudgetKnownAmounts,overageCents,checkBasis}`；`flags[]`。
- 报价/预算完整性、`search`、`diagnostics` 规则同 v1.1：自动预算方案仅价格完整且预算核算完整才可标“预算内”；`plannedTotalCents` 仅价格完整非 null；`overageCents=max(0,plannedTotalKnownCents−remainingBudgetKnownCents)`；不完整营养只作参考。

## 6. 独立标志与诊断码

`flags[]`：同 v1.1（`NUTRITION_INCOMPLETE`、`PRICE_INCOMPLETE`、`ESTIMATED_DATA`、`BUDGET_ACCOUNTING_INCOMPLETE`、`APPROXIMATE_*`、`SEARCH_LIMIT_REACHED`、`FEWER_THAN_THREE_PLANS`、`LOCKED_UNKNOWN_NUTRITION`、`OVER_BUDGET_ALTERNATIVE`）。

`diagnostics[].code`：同 v1.1，并保留 `TARGET_NOT_APPLICABLE`（附 `targetStatus`/`targetReasons[]`）。目标/适用性状态不塞进泛型 error。

## 7. MealLog

同 v1.1：`recordId`、`confirmationId`、业务日期/偏移、`meal`、`status(active/superseded/revoked)`、`revision`、改撤关联、`menuVersion`、`items[]{itemKey,source:menuOffer/manual,offerId?,dishId?,menuVersion?,nameSnapshot,portionCode,quantity,unitPriceCents,priceKnown,nutrition{4项/null},nutritionBasis,note}`。核心只消费 `active` 日志并防重复 `recordId`；餐次结束只用 `endedMeals`；确认幂等与改撤由反重力存储层实现；历史快照不改写。

## 8. 营养目标、适用性、手动目标（P01 收口 A–J + 18 岁补充裁定 + 本单小修）

配置版本 `nutrition-v1.2-candidate`；每参数分别记录产品决定状态、来源类型/支持范围、P09 对实际候选复核状态（`pendingReview`）。旧 P09 报告只作历史证据。

### 8.1 公式（沿用）

整数、`int64`、`round_half_up(x,d)=(2x+d)/(2d)`：
1. `ree_mkcal = 10×weightGrams + 625×heightMm − 5000×ageYears + sexTerm`（男 +5000，女 −161000）；估算 REE，不称实测 BMR；Mifflin 样本 19–78 岁，不验证 18 岁。
2. `tdee_mkcal = round_half_up(ree_mkcal×activityFactorPermille,1000)`。
3. `fatLoss`：`deficit_mkcal=min(round_half_up(tdee_mkcal×fatLossDeficitPermille,1000),fatLossDeficitCapKcal×1000)`；`maintain` 无缺口；`manual` 按 8.6。
4. `targetEnergyKcal=round_half_up(targetEnergy_mkcal,1000)`；`proteinDg=round_half_up(proteinMgPerKg×weightGrams,100000)`；`fatDg=round_half_up(fatKcal×10,9)`；碳水取余量且>0；餐次参考按 `mealSharePermille` 分别取整（各餐和日目标可有 ±个位数差，日目标权威）。
5. BMI 比较未舍入：`weightGrams×10000 < 185×heightMm×heightMm`；显示 `bmiTenths=round_half_up(weightGrams×10000,heightMm×heightMm)` 单独计算。

### 8.2 自动目标适用人群

18–78 岁、健康、非孕哺、无需疾病饮食管理。18 岁可用但返回 `AGE_18_EXTRAPOLATION`；<18、>78、孕哺、疾病饮食 → `AUTO_TARGET_DISABLED`，保留档案/手选/记餐/专业目标存证，关闭自动目标与自动配餐（`PlanDay` 返回 `TargetUnavailable`）。

### 8.3 过轻与过轻+manual

未舍入 BMI<18.5：
- `fatLoss` → `AUTO_TARGET_DISABLED`，`reasons:["UNDERWEIGHT"]`；不生成自动减脂目标。
- `maintain` → `REFERENCE_ONLY`，仅返回 `reference{reeMkcal,tdeeMkcal,deficitMkcal:0}` 与适用性提示，不作为自动配餐目标。
- **`manual` → `AUTO_TARGET_DISABLED`**：`applicability.eligible=false`，`reasons` 同时含 `UNDERWEIGHT`、`MANUAL_STORAGE_ONLY`；`manualTarget.stored=true`、`applied=false`（reason `MANUAL_STORAGE_ONLY`）；不返回有效 `targets`、不自动规划；允许手选/记餐、保存专业目标存证；不改写已有真实记录。`PlanDay` 返回 `TargetUnavailable` 并在 `targetReasons[]` 回显 `UNDERWEIGHT`、`MANUAL_STORAGE_ONLY`。

### 8.4 活动、蛋白质、脂肪/碳水/餐次（不变）

活动 1200/1375/1550/1725/1900‰ 为可调 REE 产品乘数初值（五档文案、主要活动选档、不双计、仅显式校准）；普通蛋白 1.2 g/kg/day 为可调产品默认（成人 DRI 0.8 是参考基准）；训练蛋白 1.5 g/kg/day 仅健康规律运动且主动选择，分流条件最近 4 周每周≥3 次、每次约 30 分钟；脂肪 27%、餐次 30/40/30、缺口 10%/最多 300 kcal 均为可调产品初值，碳水按余能量。

### 8.5 能量下限与宏量门槛（含 18 岁补充裁定）

- 能量下限：男 1500、女 1200 kcal/day 为产品下限；低于下限 → `TARGET_REVIEW_REQUIRED`；不自动抬高/降低蛋白、不生成自动配餐；可存证专业目标与记录摄入。
- 宏量门槛：19–78 岁蛋白 10–35%、脂肪 20–35%、碳水 45–65%、碳水≥130g/day；18 岁按 4–18 岁参考表蛋白 10–30%、脂肪 25–35%、碳水 45–65%，**按 P01 18 岁补充裁定 `carbFloorGPerDay=null`，不另设 130g/day 检查**；这不是 130g 参考量不适用，也不是医学安全结论。18 岁仍受适用性、性别能量下限、蛋白/脂肪/碳水百分比与 4/9/4 规则约束。
- 超范围 → `TARGET_COMPOSITION_CONFLICT`；回显实际比例与范围、保留可查看值、不应用、不静默改写。判定用未舍入整数/有理数：`proteinTenthsKcal=4×proteinDg`、`fatTenthsKcal=9×fatDg`、`carbTenthsKcal=4×carbDg`，`totalTenthsKcal` 为和；比例比较用交叉相乘，显示 bp 单独舍入；碳水下限用 `carbDg ≥ carbFloorGPerDay×10`（`null` 则不检查）。
- 压力样例：女性 1200 kcal、80kg、训练蛋白 1.5g/kg → 蛋白 1200 dg（40%）、脂肪 360 dg（27%）、碳水 990 dg（33%，99g<130g）→ `TARGET_COMPOSITION_CONFLICT`；1200 恰为女性下限，不触发低摄入复核。

### 8.6 手动目标（不变）

`sourceType=professional|userEntered`；来源说明可选；不要求私密材料、不验证专业身份。保存原值与专业目标存证≠应用；应用前须满足人群、能量下限、宏量非负且完整或已批准派生（`derivedFields[]`，不改原值）、通过宏量门槛、且 4/9/4 容差 `max(20 kcal,目标能量2%)` 内；超容差/缺宏量无派生规则分别 `MANUAL_TARGET_INCONSISTENT`/`MANUAL_TARGET_INCOMPLETE`，存证不应用；manual 不能绕过 B/C/G/H。

### 8.7 TargetResult

输入 `TargetRequest={contractVersion,requestId,profile,nutritionConfig}`；`result`：

| 字段 | 说明 |
|---|---|
| `status` | `Ok` / `REFERENCE_ONLY` / `TARGET_REVIEW_REQUIRED` / `TARGET_COMPOSITION_CONFLICT` / `MANUAL_TARGET_INCONSISTENT` / `MANUAL_TARGET_INCOMPLETE` / `AUTO_TARGET_DISABLED` |
| `applicability` | `{eligible,reasons[],ageBand,age18Extrapolation,bmiDisplayTenths,underweightByUnrounded}`；过轻+manual 时 `eligible=false`、`reasons=["UNDERWEIGHT","MANUAL_STORAGE_ONLY"]` |
| `targets` | 仅 `Ok`：`{daily,mealReference,source}` |
| `reference` | 仅 `REFERENCE_ONLY`：`{reeMkcal,tdeeMkcal,deficitMkcal:0}` |
| `computed` | 非 `Ok` 可查看时：`{energyKcal,proteinDg,fatDg,carbDg,validForAutoPlanning:false}` |
| `composition` | 计算时：`{ageBand,actualBp{protein,fat,carb},carbDg,rangesBp{...},carbFloorDg:int/null,passed}` |
| `manualTarget` | 有 manual 时：`{sourceType,sourceNote,declared{energyKcal,proteinDg,fatDg,carbDg},stored,applied,reason,energyDiffTenthsKcal,toleranceTenthsKcal,withinTolerance,derivedFields[]}` |
| `warnings[]` | `AGE_18_EXTRAPOLATION`、`PRODUCT_ENERGY_FLOOR`、`MACRO_COMPOSITION`、`ENERGY_MACRO_MISMATCH`、`AUTO_TARGET_DISABLED` 等 |

状态优先级：人群/风险 → 过轻（`maintain`=`REFERENCE_ONLY`；`fatLoss` 或 `manual`=`AUTO_TARGET_DISABLED`，manual 附 `MANUAL_STORAGE_ONLY`）→ 能量下限 → manual 完整性/一致性 → 宏量门槛 → `Ok`。`PlanDay` 遇非 `Ok` 返回 `TargetUnavailable` 并回显 `targetStatus`/`targetReasons[]`；不得用 `OkPartial` 冒充可用目标。

## 9. 合法性与候选生成

同 v1.1：L1 JSON/版本 → L2 结构/枚举/范围 → L3 引用/哈希/日志日期/重复 `recordId` → L4 餐次状态 → L5 供应 → L6 售罄/锁定（失效→`LockConflict`）→ L7 套餐/份量/半份同价/价格一致性 → L8 单窗口 → L9 营养资格 → L10 预算（策略层）→ L11 限额。候选单位 offer；未知营养未锁定不自动新增；锁定项保留但不完整；截断/剪枝标近似。

## 10. 评分与排序

同 v1.1：`nutritionDeviationBp=Σ round_half_up(|known_n−target_n|×10000×250, target_n×1000)`；`nutritionTier=floor(deviationBp/1000)`；`primary` 偏差↑→多样性→口味↓→价格↑→`planKey`；`economy` tier↑→价格↑→多样性→口味↓→`planKey`；`taste` tier↑→口味↓→多样性→价格↑→`planKey`；完整方案先于不完整；不完整仅参考；类别覆盖↑/重复菜↓；`planKey` 破并列；最优性声明条件同 v1.1。

## 11. C++ 入口与 WASM 边界

同 v1.1：`PlanDay`、`ComputeNutritionTarget`、`ValidateMenuCatalog`、`ContractVersion`；WASM 导出 `mp_api_version`、`mp_contract_version`（静态不释放）、`mp_alloc`/`mp_free`、`mp_plan`、`mp_nutrition_target`、`mp_validate_menu`；JS 输入/输出缓冲区在 `finally` 各释放一次、输出先复制再释放、`nullptr` 仅真实分配失败、异常在入口转可见错误、单实例串行。

## 12. 两层独立参照、性能测量与注释率

同 v1.1：层 1 原始菜单→合法单餐候选独立枚举；层 2 单餐候选→全天搜索独立穷举（不复用生产剪枝/评分）。性能维度 `M/W/D/K/C/S/N`，分组 G0–G3，计时四类互斥（核心-only、JS 往返、拷贝/释放、页面端到端），≥5 次 median/min/max，记录内存/WASM/节点状态；一致性用确定性限额且 `wallClockMs=null`；**不填实测数字**。注释率：自写 C++/TS（`core/`、`miniprogram/src/`），排除第三方/生成物/构建产物/样例，`cloc` 或仓库脚本，分母非空代码行、分子有效注释行，报告原始计数与排除清单，按课设要求 ≥20%。

## 13. 模块归属

同 v1.1：`Resources/契约/T01-v1.2-candidate/` DSH 独占写、P01 决策；旧 v1/v1.1 只读；`core/`、`tools/core/` DSH；`miniprogram/`、`tools/miniprogram/` 反重力；`Resources/菜单/` 反重力；`Resources/营养配置/` DSH 起草/P09 核验；`Resources/报告/` 各自命名；`AGENTS.md`/`MEMORY`/PRD/T01 卡 P01/P02。本次不创建代码，不派发 T02/T04/T05。

## 14. 旧页面字段映射

同 v1.1（字段/枚举/API 映射；不做兼容层；半份米饭同价、`recordId`、`mp_*` 命名等）。

## 15. 夹具状态、P09 复核与冻结边界

- **本版修正**：`nutritionConfig` 顶层 `energyFloor` 与 `snapshot` 哈希口径（§0.3/§4）；`parameters.energyFloorKcal` 已移除；过轻+manual 输出明定并补样例（§8.3/§8.7）；BMI 恰 18.5 样例说明按 `534,650,000 = 534,650,000` 校正（不小于阈值）。
- **18 岁补充裁定已关闭旧未决项**：按 `2026-10-20-t01-age18-clarification-v1`，`carbFloorGPerDay=null`，不另设 130g/day 检查；旧候选中的“待 P01 确认”文字由本补充裁定覆盖，不再重开。
- **P09 状态**：新 v1.2 文件尚未由 P09 复核，保持 `p09ReviewStatus=pendingReview`；P09 v3 报告针对 v1.1（SHA256 见依据行）只作历史证据，不适用本文件；不得写成 P09 已通过。
- **冻结边界**：T01 未冻结；本候选不自动解锁 T02/T04/T05，不表示营养通过或实现已开始。

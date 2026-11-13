# T01 共享契约候选 v1.1（contract-v1-candidate）

| 项 | 内容 |
|---|---|
| 文档版本 | `t01-contract-v1.1-candidate`（2026-10-20） |
| 状态 | **候选草案，未冻结**。P01 判断是否冻结、P02 登记；本文件不派发 T02/T04/T05，不表示营养已通过或 P09 已复核本文件。 |
| 修订性质 | 仅修订 P01 营养收口裁定影响的营养目标、适用性、目标状态、手动目标和样例；未受影响结构沿用旧 `T01-v1-candidate` 候选。旧 v1 目录只读保留。`contractVersion` 仍为 `1.0`：尚未冻结、无已支持旧客户端，本次是候选文档修订，不是版本迁移，不加兼容层。 |
| 依据 | 主 PRD v0.2（SHA256 `D68ECE7218BC076155A0AFB6200788B7608898E9D0CDF6ECEC27C5E49AA58FDD`）；T01 卡 v0.2；P01 接口裁定 v1.1（`T01-P01-接口裁定-20261020.md`，SHA256 `C19E18FF2C01CE3224A1D19185BFC146089B5464C90D447FDAE3A966084DEDAF`）；P01 营养配置收口裁定 v1（`T01-P01-营养配置收口裁定-20261020.md`，SHA256 `196121CA75EF6750E5DD8E83078CF0DA747AD454378DFA6A114E8627EA794302`）及 v3 执行提示词（SHA256 `5D0D708E4C1ABE24C1201B02EFFFECF6F6499402266C4C99280F9A410DEFB3E9`）；P09 旧提案核验（SHA256 `1723320E1624E18F7DEDB78EC06CCDA65BF167AE7FD4256E0AC1F5719F269FA7`）；P09 当前候选与裁定复核 v2（SHA256 `BF51E34FCB4F006D7C165FBBA4490250F13AF301B0661B641515D6BA40B6709D`）；P02 三方查收（SHA256 `C541A065EDD7686F045D7B798923046671F2BF45C6DB7EED975F9F14B86E66C1`）。 |
| 配套文件 | `nutrition-v1-candidate.json`（`nutrition-v1.1-candidate`）、`request-result-pair.json`（`t01-pairs-v1.1-candidate`） |
| 语言 | JSON 契约。金额整数分；能量整数 kcal；宏量整数 0.1g（`proteinDg`/`fatDg`/`carbDg`）；体重 g；身高 mm；`null`=未知，`0`=已知零。 |

## 0. 通用规则（沿用 v1，修订处见后文）

1. **契约版本**：独立入口输入/输出对象带 `contractVersion: "1.0"`：`Profile`、`MenuCatalog`、`TargetRequest`、`PlanRequest`、`ResultEnvelope`、`MealLog`。未知 major 拒绝；未知 minor 允许可选字段；未知枚举值拒绝。
2. **编码/数值**：UTF-8 无 BOM；金额/营养/计数只用整数，禁止浮点；中间量 `int64_t`；JSON 输出限 ±(2⁵³−1)；越界=`INVALID_INPUT`。
3. **输入范围**（补充 P09 溢出意见）：`heightMm ∈ [1000,2500]`、`weightGrams ∈ [25000,250000]`、`ageYears ∈ [0,120]`；输入范围先校验，再做 BMI 交叉乘法，保证 int64 不溢出。
4. **哈希**：`sha256:` 小写；规范化序列化（键排序、无空白、LF）；哈希对象排除自身 `hash`/`catalogHash`；生成方计算、接收方复算。
5. **标识**：小写稳定字符串 `^[a-z0-9][a-z0-9._-]{0,63}$`；不用数组下标；`dishId` 跨版本稳定；`offerId` 唯一；`recordId`/`confirmationId`/`requestId` 由调用方生成且唯一。
6. **快照**：请求带 `profile`、`catalog`、`nutritionConfig`、当日有效 `mealLogs` 完整快照；核心不读文件/存储，不接受页面预汇总目标或预算。
7. **无静默默认值**：缺失/非法参数→可见错误；不以内置默认值继续。v1 无旧版本，不写兼容/迁移层；历史 `MealLog` 不重写。
8. **校验边界**：只在入口校验一次；内部不变量失败抛可定位异常，入口转可见错误；不吞错、不以空方案伪装成功。
9. **确定性**：同请求同字节（除真实资源失败）；`plans[]` 按策略顺序再 `planKey`；`strategyOutcome[]`/`offeredAs[]` 按策略顺序；`mealOutcomes[]` 按 `planningMeals`；`diagnostics[]` 按 `(code,fieldPath,meal,dishIds)`。耗时/设备不进入结果。

## 1. ResultEnvelope、错误与状态

```json
{ "contractVersion": "1.0", "requestId": "…|null", "ok": true, "error": null, "result": { } }
```

- `ok=false` 仅契约级失败：`INVALID_INPUT`、`UNSUPPORTED_CONTRACT_VERSION`、`INTERNAL_ERROR`；`result=null`；`error` 含 `fieldPath`/`message`/`details[]`。
- 适用性/低摄入/宏量冲突/手动目标问题**不是**契约错误：`ok=true`，在 `TargetResult.status`/`PlanResult.status` 表达，保留可查看计算值。
- `requestId`：`PlanDay` 回显；`ComputeNutritionTarget` 回显 `TargetRequest.requestId`；`ValidateMenuCatalog` 为 `null`。

`PlanResult.status`：

| status | 含义 | 方案 |
|---|---|---|
| `Ok` | 目标可自动应用、方案完整（营养/价格/预算核算完整）、无近似 | 是 |
| `OkPartial` | 有方案但存在独立限制标志；不等于营养全缺失或已通过 | 是 |
| `NoFeasible` | 候选未截断且穷尽后无合法组合 | 否 |
| `NoFeasibleWithinBudget` | 有合法组合但剩余预算内无解；返回标加价备选 | 是（`overBudget=true`） |
| `NutritionDataInsufficient` | 关键营养未知导致无自动候选 | 否 |
| `ResourceLimited` | 达限额仍无方案；不得称已证明无解 | 否 |
| `LockConflict` | 锁定 offer 失效，须用户先解决 | 否 |
| `TargetUnavailable` | 营养目标不可用于自动规划（`targetStatus` 为 §8 任一非 `Ok` 状态）；`plans=[]`，保留手选/记餐/已存证目标 | 否 |

## 2. Profile

| 字段 | 类型/取值 | 必填 | 说明 |
|---|---|---|---|
| `contractVersion` | `"1.0"` | 是 | |
| `profileId` | string | 是 | |
| `revision` | int ≥1 | 是 | 派生缓存须带它 |
| `sex` | `male`/`female` | 是 | |
| `ageYears` | int 0–120 | 是 | 自动目标适用性见 §8 |
| `heightMm` | int 1000–2500 | 是 | |
| `weightGrams` | int 25000–250000 | 是 | |
| `bodyFatPermille` | int/null | 否 | 选填 |
| `activityLevel` | `sedentary`/`light`/`moderate`/`active`/`veryActive` | 是 | 产品乘数档位；文案见营养 JSON |
| `goal.type` | `maintain`/`fatLoss`/`manual` | 是 | 无 `muscle_gain` |
| `goal.manualTargets` | object/null | `manual` 时必填 | 见下；保存≠应用 |
| `goal.manualTargets.energyKcal` | int | 是（manual） | 原始录入值 |
| `goal.manualTargets.proteinDg`/`fatDg`/`carbDg` | int/null | 否 | 原始专业/用户值；缺项若派生须列 `derivedFields` |
| `goal.manualTargets.sourceType` | `professional`/`userEntered` | 是（manual） | 不验证真伪，不要求上传私密材料 |
| `goal.manualTargets.sourceNote` | string/null | 否 | 来源说明可选 |
| `goal.manualTargets.derivedFields[]` | string[] | 否 | 由已批准配置派生的字段名；保留原始值，不覆盖 |
| `trainingPreference` | bool | 是 | `true` 仅当用户主动确认“最近 4 周每周≥3 次、每次约 30 分钟”的持续规律力量/耐力训练；由调用方按产品分流提问，核心不再追问。非健康/风险人群不应用训练档（§8） |
| `dietaryFlags.pregnancyOrLactation` | bool | 是 | |
| `dietaryFlags.medicalDietManagement` | bool | 是 | |
| `tastes[]` | `{dishId, preference: like/neutral/dislike}` | 否 | 口味策略输入 |

Profile 只存输入与手动目标；目标/预算/派生值由核心计算，页面不另算；缓存须带 `revision` + `nutritionConfig.version`。

## 3. MenuCatalog、dishes、offers、comboRules

| 对象 | 字段 | 类型/取值 | 必填 | 说明 |
|---|---|---|---|---|
| Catalog | `contractVersion` | `"1.0"` | 是 | |
| | `menuVersion` | string | 是 | 单调版本 |
| | `catalogHash` | `sha256:…` | 是 | 排除自身后计算 |
| | `canteen` | `{id,name}` | 是 | |
| | `windows[]` | `{windowId,name,mealWindows[]}` | 是 | `mealWindows ⊆ {breakfast,lunch,dinner}` |
| | `dishes[]` | 见下 | 是 | 营养主数据 |
| | `offers[]` | 见下 | 是 | 售卖单位 |
| | `comboRules[]` | 见下 | 是（可空） | 可选套餐规则 |
| Dish | `dishId` / `name` | string | 是 | |
| | `kind` | `single`/`combo` | 是 | 固定套餐为 `combo` |
| | `category` | `staple`/`protein`/`vegetable`/`soup`/`drink`/`other` | 否 | 多样性排序；未知类别不计覆盖 |
| | `riceDish` / `riceIncluded` | bool | 是 | 仅米饭可为半份；套餐含饭不重复收费 |
| | `components[]` | `{dishId,count}` | combo 必填 | 不用于拆价 |
| | `nutrition` | `{energyKcal,proteinDg,fatDg,carbDg}` 各 int/null | 是 | null=未知 |
| | `nutritionBasis` | `{source,portionAssumption,estimated,note}` | 是 | `source ∈ label/recipe/referenceTable/estimate/comboComponentSum/unknown` |
| Offer | `offerId` / `dishId` / `windowId` | string | 是 | 引用校验 |
| | `mealWindows[]` | string[] | 是 | ⊆ 窗口供应 |
| | `portionCode` | `full`/`half` | 是 | `half` 仅米饭 |
| | `portionRatioNum`/`Den` | int | 是 | 营养比例；半份=1/2 |
| | `priceCents` | int/null | 是 | `null ⇔ priceBasis=unknown` |
| | `priceBasis` | `unitPrice`/`comboTotal`/`unknown` | 是 | 套餐真实总价用 `comboTotal` |
| | `nutritionOverride` | `{nutrition,nutritionBasis}`/null | 否 | 自带来源与份量假定 |

半份米饭：只有 `riceDish=true` 可有 half offer；`priceCents` **必须等于同一窗口同一米饭 dish 的整份 offer 价格**（同价，不除以二、不派生）；整份未知则半份未知；营养按 `portionRatio` 派生（逐项 `round_half_up`），继承来源/估算标记。套餐含饭只按真实套餐总价，不重复收米饭费。

固定套餐：有独立 `nutrition` 时采用；否则仅当 `components` 全部存在、份量确定、组件营养来源完整时由核心汇总（四项均已知才可自动新增，否则营养不完整），`nutritionBasis.source="comboComponentSum"`，`estimated` 为组件估算状态并集；价格只取 `comboTotal`。

可选套餐 `comboRules`（最小结构，不做通用规则引擎）：

| 字段 | 类型 | 说明 |
|---|---|---|
| `ruleId` / `name` | string | 稳定 ID/展示名 |
| `windowId` / `mealWindows[]` | string | 供应范围 |
| `totalPriceCents` | int | 真实套餐总价 |
| `includesRice` | bool | 含饭不另收米饭费 |
| `requiredCounts` | `{category:count}` | 如 `{"protein":2,"vegetable":1}` |
| `candidateDishIds[]` | string[] | 可选组件 |
| `nutritionPolicy` | `sumComponents` | 唯一支持值；组件四项均已知才完整 |

示例：

```json
{
  "ruleId": "r-two-meat-one-veg",
  "name": "两荤一素套餐",
  "windowId": "w1",
  "mealWindows": ["lunch", "dinner"],
  "totalPriceCents": 1500,
  "includesRice": true,
  "requiredCounts": {"protein": 2, "vegetable": 1},
  "candidateDishIds": ["d-ck", "d-tofu", "d-pork", "d-greens", "d-cabbage"],
  "nutritionPolicy": "sumComponents"
}
```

展开：按 `requiredCounts` 选组合（每道至多 1 份），过滤售罄/不供应/窗口不符；生成 `offerId = ruleId#<dishId 升序拼接>`，价格=`totalPriceCents`，营养按组件汇总/标记不完整；不含饭时米饭另选。固定套餐与规则展开 offer 在候选、锁定、售罄、计价中同等对待。

## 4. PlanRequest

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `contractVersion` / `requestId` | string | 是 | |
| `businessDate` / `tzOffsetMinutes` | string/int | 是 | |
| `profile` / `catalog` / `nutritionConfig` | object | 是 | 完整快照；config 含 `version`/`hash`/`formula`/`parameters`/`population`/`macroThresholds`/`energyFloor`/`manualTargetRules`/`plannerSorting` |
| `plannerConfig.algorithm` | `greedy`/`dp`/`branchAndBound` | 是 | |
| `plannerConfig.strategies[]` | `primary`/`economy`/`taste` 子集 | 是 | 固定顺序 |
| `plannerConfig.budgetCents` | int/null | 是 | `null`=无预算；`0`=显式零预算 |
| `plannerConfig.maxItemsPerMeal` | int 1–8 | 是 | |
| `plannerConfig.limits` | `{maxMealCandidatesPerMeal,maxDpStates,maxSearchNodes,wallClockMs}` | 是 | 一致性测试 `wallClockMs=null` |
| `planningMeals[]` | 1–3 餐次 | 是 | 不含 `endedMeals`、不含 `activeLogs` 已有有效记录的餐次 |
| `state.soldOut[]` | `{windowId,meal,dishId}` | 是 | 业务日期作用域 |
| `state.windowLocks[]` | `{meal,windowId}` | 是 | |
| `state.itemLocks[]` | `{meal,offerId,quantity}` | 是 | 锁售卖单位 |
| `state.endedMeals[]` | 餐次数组 | 是 | 不规划、不补推 |
| `state.activeLogs[]` | MealLog[] | 是 | 当前业务日期、`status=active` |

校验：`activeLogs.businessDate` 等于请求日期；重复 `recordId`/`planningMeals` 与 `activeLogs.meal` 或 `endedMeals` 冲突 → `INVALID_INPUT`；锁定 offer 不存在/不供应/售罄 → `LockConflict`；`priceCents=null` 不得配 `priceBasis≠unknown`；半份米饭规则 §3。补记（`source=manual`）可保留并计入已吃/预算。

## 5. PlanResult

`result`：`status`（§1）、`targetStatus`（仅 `TargetUnavailable`，§8）、`businessDate`/`tzOffsetMinutes`、`mealOutcomes[]`、`inputDigests`、`targets`（仅 `Ok`）、`strategyOutcome[]`、`plans[]`、`intakeSummary`、`budgetSummary`、`distinctPlanCount`/`fewerThanThreeReason`、`diagnostics[]`、`search`。

- `targets` 结构同 v1；`source` 用 `reeMkcal`/`tdeeMkcal`/`deficitMkcal`（整数千分之一 kcal，避免显示取整歧义）+ `formula`/`formulaLabel`/`activityFactorPermille`/`goal`/`manualSourceType?`。
- `TargetUnavailable` 时 `plans=[]`，`diagnostics[]` 含 `TARGET_NOT_APPLICABLE`（`targetStatus`、`reasons[]`），仍可返回手选/记餐入口所需信息（由 UI 侧实现）。
- `plans[]`：`offeredAs[]`；`score{nutritionCompleteness,comparisonBasis,nutritionDeviationBp,nutritionTier,preferenceScore,priceCents,diversity{categoryCoverage,repeatedDishCount,unknownCategoryItemCount}}`；`meals[]{meal,windowId,items[],nutrition{knownSums,incompleteNutrients,unknownItemRefs},nutritionReferenceTarget,windowLocked}`；`budget{budgetCents,remainingBudgetKnownCents,plannedTotalCents,plannedTotalKnownCents,priceIncomplete,overBudget,withinBudgetKnownAmounts,overageCents,checkBasis}`；`flags[]`。
- 报价规则：`plannedTotalCents` 仅价格完整非 null；`plannedTotalKnownCents` 恒为已知和；`overageCents=max(0,plannedTotalKnownCents−remainingBudgetKnownCents)`，预算未设/价格不完整为 null；自动预算方案仅价格完整且预算核算完整才可标“预算内”；否则仅“已知口径内不超”。
- 不完整营养只作参考；同未知项集合可标 `incompleteKnownComparable` 并比较价格/口味/多样性，不输出达标。

`search`：`{algorithm,searchComplete,candidatesEnumerated{meal:int},nodesEvaluated:int/null,statesEvaluated:int/null,capsHit:[{limit,limitValue,observed,meal?}],approximations:[{kind,scope,value?,limit?,detail?}]}`；不含耗时。

## 6. 独立标志与诊断码

`flags[]`：`NUTRITION_INCOMPLETE`、`PRICE_INCOMPLETE`、`ESTIMATED_DATA`、`BUDGET_ACCOUNTING_INCOMPLETE`、`APPROXIMATE_CANDIDATES`、`APPROXIMATE_DISCRETIZATION`、`APPROXIMATE_TIMEOUT`、`SEARCH_LIMIT_REACHED`、`FEWER_THAN_THREE_PLANS`、`LOCKED_UNKNOWN_NUTRITION`、`OVER_BUDGET_ALTERNATIVE`。

`diagnostics[].code`：`SOLD_OUT_EXCLUDED`、`LOCK_INVALID`、`NUTRITION_DATA_INSUFFICIENT`、`NO_LEGAL_COMBINATION`、`NO_DISTINCT_ALTERNATIVE`、`TARGET_NOT_APPLICABLE`（附 `targetStatus`/`reasons[]`）。目标/适用性状态另见 §8，不再塞进泛型 error。

## 7. MealLog

字段同 v1：`contractVersion`、`recordId`、`confirmationId`、`businessDate`/`tzOffsetMinutes`、`meal`、`status(active/superseded/revoked)`、`revision`、`replacesRecordId`/`supersededByRecordId`、`revokedAt`/`confirmedAt`、`menuVersion`、`items[]{itemKey,source:menuOffer/manual,offerId?,dishId?,menuVersion?,nameSnapshot,portionCode,quantity,unitPriceCents,priceKnown,nutrition{4项/null},nutritionBasis,note}`。

核心只消费 `active` 日志并防重复 `recordId` 入账；餐次结束只用 `state.endedMeals`，不设 `SKIPPED`、不伪造摄入或零消费；确认幂等与改撤由反重力存储层实现，契约只传结果；历史快照不因菜单/推荐变化改写。

## 8. 营养目标、适用性、手动目标（P01 收口 A–J）

配置版本 `nutrition-v1.1-candidate`；每项参数在 JSON 中分别表达：**产品决定状态**、**来源类型/支持范围**、**P09 对实际候选的复核状态**，三者不混写。修订版级 `p09ReviewStatus=pendingReview`；旧 P09 报告只作历史证据，不得当成对本候选的通过。

### 8.1 公式（沿用 v1，术语 REE）

整数、`int64`、`round_half_up(x,d)=(2x+d)/(2d)`：

1. `ree_mkcal = 10×weightGrams + 625×heightMm − 5000×ageYears + sexTerm`（男 +5000，女 −161000）。这是**估算静息能量消耗（REE）**，不称实测 BMR；Mifflin 原研究样本 19–78 岁，不验证 18 岁。
2. `tdee_mkcal = round_half_up(ree_mkcal × activityFactorPermille, 1000)`。
3. `fatLoss`：`deficit_mkcal = min(round_half_up(tdee_mkcal × fatLossDeficitPermille, 1000), fatLossDeficitCapKcal×1000)`；`maintain`：无缺口；`manual`：用存证目标（见 8.5）。
4. `targetEnergyKcal = round_half_up(targetEnergy_mkcal, 1000)`；`proteinDg = round_half_up(proteinMgPerKg × weightGrams, 100000)`；`fatDg = round_half_up(fatKcal×10, 9)`；碳水取余量且须 >0；餐次参考按 `mealSharePermille` 分配。
5. `BMI`：比较必须未舍入：`weightGrams×10000 < 185×heightMm×heightMm`；显示值 `bmiTenths=round_half_up(weightGrams×10000, heightMm×heightMm)` 单独计算。禁止先舍入再比较。
6. 餐次参考目标按 `mealSharePermille` 对各营养素分别取整；各餐之和与日目标可能有 ±个位数差，**日目标为权威展示值**，餐次参考仅用于评分与单餐展示。

### 8.2 自动目标适用人群（B）

自动估算面向 **18–78 岁、健康、非孕哺、无需疾病饮食管理**的成人：

- 18 岁：可用，但返回警告 `AGE_18_EXTRAPOLATION`（“18岁估算存在外推”）；按 4–18 岁宏量参考表执行 §8.4；不得称 Mifflin 验证 18 岁。
- 19–78 岁：按成人门槛。
- <18 或 >78、`pregnancyOrLactation=true`、`medicalDietManagement=true`：`TargetResult.status=AUTO_TARGET_DISABLED`；保留档案、手选、记餐、已有专业目标存证；**关闭自动目标与依赖自动目标的自动配餐**；`PlanDay` 返回 `TargetUnavailable`。

### 8.3 过轻（C）

未舍入 BMI<18.5：

- `fatLoss`：不生成自动减脂目标，`AUTO_TARGET_DISABLED`（`reasons:["UNDERWEIGHT"]`）。
- `maintain`：`REFERENCE_ONLY`，仅返回 `reference{reeMkcal,tdeeMkcal,deficitMkcal:0}` 与适用性提示；**不得作为自动配餐目标**。
- `manual`：可存证（`sourceType` 必填），允许手选、记餐；首版不自动规划。
- 不得删除/改写已有真实记录。

### 8.4 活动、蛋白质、脂肪/碳水/餐次（D–F）

- 活动系数 1200/1375/1550/1725/1900‰ 为**可调 REE 产品乘数初值**，不称已验证 PAL/指南系数；档位文案见营养 JSON；按日常主要活动选择，不把运动与体力工作重复加成；校准只由用户按体验或已有专业目标显式调整，不自动学习。
- 普通蛋白质 1.2 g/kg/day 为可调产品默认，不称 RDA/普遍需要量；成人 DRI 0.8 g/kg 只是参考基准。
- 训练蛋白质 1.5 g/kg/day，仅健康、规律运动且用户主动选择时；产品分流条件为最近 4 周每周≥3 次、每次约 30 分钟（产品条件，不称 ISSN 阈值）；ISSN 1.4–2.0 g/kg 仅支持健康运动人群，不套用风险人群。
- 脂肪 27%、餐次 30/40/30、减脂缺口 10% 且最多 300 kcal/day 均为可调产品初值；碳水按余能量；不得写成普适医学处方。

### 8.5 能量下限与宏量门槛（G、H）

- 自动目标能量下限：男 1500、女 1200 kcal/day（产品下限，非普遍安全线）。低于下限 → `TARGET_REVIEW_REQUIRED`；不自动抬高/降低蛋白、不生成看似有效自动配餐；可存证专业目标与记录摄入。
- 宏量门槛（自动配餐目标）：
  - 19–78 岁：蛋白质 10–35%、脂肪 20–35%、碳水 45–65%，且碳水 ≥130 g/day；
  - 18 岁：按 4–18 岁参考表，蛋白质 10–30%、脂肪 25–35%、碳水 45–65%（18 岁碳水 130g/day 是否作为产品门槛未在 P01 v3 中列明，见 §15）。
- 任一超范围 → `TARGET_COMPOSITION_CONFLICT`；回显实际比例与参考范围、保留可查看计算值，但不标有效自动目标、不自动派餐、不静默改写用户目标。AMDR/RDA 是参考，不称安全上下限或诊断。
- **判定用未舍入整数**：宏量能量按分克计算 `proteinTenthsKcal=4×proteinDg`、`fatTenthsKcal=9×fatDg`、`carbTenthsKcal=4×carbDg`，`totalTenthsKcal` 为三者之和；比例比较用交叉相乘（如蛋白质在范围内 ⇔ `proteinTenthsKcal×10000` 在 `totalTenthsKcal×minBp` 与 `×maxBp` 之间），不用先舍入的百分比判定。回显比例可用 `round_half_up(component×10000,total)`，仅显示；碳水下限用 `carbDg ≥ carbFloorGPerDay×10` 判断。
- 压力样例（须触发冲突）：女性、1200 kcal、80 kg、训练蛋白 1.5 g/kg → 蛋白 1200 dg（40%）、脂肪 360 dg（27%）、碳水 990 dg（33%，99 g<130 g）→ `TARGET_COMPOSITION_CONFLICT`；1200 kcal 恰为女性产品下限，故不触发 `TARGET_REVIEW_REQUIRED`，冲突由宏量比例/碳水量触发。

### 8.6 手动目标（I）

- `sourceType=professional|userEntered` 必须明确；`sourceNote` 可选；不要求上传私密医学材料、不验证 “professional” 真伪。
- 保存原始输入与专业目标存证；**存证≠应用**。只有同时满足：适用人群、能量不低于对应性别产品下限、宏量非负且完整（或按已批准配置派生并逐项标 `derived`）、通过 §8.5 宏量门槛、且能量与 4/9/4 换算在容差内，才可应用为自动规划目标。
- 4/9/4 一致性容差：`max(20 kcal, 目标能量的 2%)`（产品录入一致性容差，非医学阈值）。计算用十分之一 kcal 整数：`macroTenthsKcal=4×proteinDg+9×fatDg+4×carbDg`，`declaredTenthsKcal=energyKcal×10`，`toleranceTenthsKcal=max(200, floor(declaredTenthsKcal×2/100))`；`|macro−declared| ≤ tolerance` 为容差内。超容差 → `MANUAL_TARGET_INCONSISTENT`，保存原值但不应用，回显差异与容差。
- 缺宏量：若有明确已批准派生规则，按规则派生并逐项标 `derived`，保留原始专业值；无无歧义规则 → `MANUAL_TARGET_INCOMPLETE`，保存原值、不应用。
- 手动目标不能绕过适用人群、过轻、能量下限、宏量门槛；风险状态（孕哺/疾病/超龄）不得因 manual 而自动规划。

### 8.7 TargetResult

`ComputeNutritionTarget` 输入 `TargetRequest={contractVersion,requestId,profile,nutritionConfig}`。`result`：

| 字段 | 说明 |
|---|---|
| `status` | `Ok` / `REFERENCE_ONLY` / `TARGET_REVIEW_REQUIRED` / `TARGET_COMPOSITION_CONFLICT` / `MANUAL_TARGET_INCONSISTENT` / `MANUAL_TARGET_INCOMPLETE` / `AUTO_TARGET_DISABLED` |
| `applicability` | `{eligible,reasons[],ageBand:"18"/"19-78",age18Extrapolation,bmiDisplayTenths,underweightByUnrounded}` |
| `targets` | 仅 `Ok`：`{daily,mealReference,source}` |
| `reference` | 仅 `REFERENCE_ONLY`：`{reeMkcal,tdeeMkcal,deficitMkcal:0}` |
| `computed` | 非 `Ok` 且可查看时：`{energyKcal,proteinDg,fatDg,carbDg,validForAutoPlanning:false}` |
| `composition` | 计算时：`{ageBand,actualBp{protein,fat,carb},carbDg,rangesBp{...},carbFloorDg:int/null,passed}` |
| `manualTarget` | 有 manual 时：`{sourceType,sourceNote,declared{energyKcal,proteinDg,fatDg,carbDg},stored,applied,reason,energyDiffTenthsKcal,toleranceTenthsKcal,withinTolerance,derivedFields[]}` |
| `warnings[]` | `AGE_18_EXTRAPOLATION` 等 |

状态优先级：人群/风险（`AUTO_TARGET_DISABLED`）→ 过轻（`REFERENCE_ONLY`/`AUTO_TARGET_DISABLED`）→ 能量下限（`TARGET_REVIEW_REQUIRED`）→ manual 完整性/一致性（`MANUAL_TARGET_INCOMPLETE`/`MANUAL_TARGET_INCONSISTENT`）→ 宏量门槛（`TARGET_COMPOSITION_CONFLICT`）→ `Ok`。`PlanDay` 遇非 `Ok` 返回 `TargetUnavailable` 并回显 `targetStatus`；不得用 `OkPartial` 冒充可用目标。

## 9. 合法性与候选生成

检查顺序：L1 JSON/版本 → L2 结构/枚举/范围 → L3 引用/哈希/日志日期/重复 `recordId` → L4 餐次状态 → L5 供应 → L6 售罄/锁定（锁定失效→`LockConflict`） → L7 套餐/份量/半份同价/价格一致性 → L8 单窗口 → L9 营养资格（自动新增要求四项已知或带来源/份量估算；锁定项可保留但整体不完整） → L10 预算（策略层） → L11 限额。

候选单位为 offer（含固定/规则展开套餐）；未知营养且未锁定不自动新增；锁定项必须包含；同餐单窗口；单餐数量 ≤ `maxItemsPerMeal`；截断/预筛选/桶宽在 `search` 可见，未论证剪枝标近似。

## 10. 评分与排序

- 营养偏差：`nutritionDeviationBp = Σ_n round_half_up(|known_n−target_n|×10000×w_n, target_n×1000)`，`w_n=250‰`；仅四项完整可算。
- `nutritionTier=floor(nutritionDeviationBp/1000)`；1000bp 为可调排序分组宽度，不是达标阈值；三算法同键。
- 键：`primary` 营养偏差↑→多样性→口味↓→价格↑→`planKey`；`economy` tier↑→价格↑→多样性→口味↓→`planKey`；`taste` tier↑→口味↓→多样性→价格↑→`planKey`。
- 完整方案先于不完整；完整可比 tier；不完整只作参考、不称达标；同未知项集合可标 `incompleteKnownComparable`，不输出达标。
- 多样性：类别覆盖（未知类别不计）↑、重复菜↓；`planKey` 最终破并列。去重/少于三套说明同 v1。
- 最优性仅当未截断、无限额、算法精确时声明；greedy 永不声明最优。

## 11. C++ 入口与 WASM 边界

```cpp
namespace meal_planner {
class ApiResult { public: ApiResult(ApiResult&&) noexcept = default; ApiResult& operator=(ApiResult&&) noexcept = default;
  ApiResult(const ApiResult&) = delete; ApiResult& operator=(const ApiResult&) = delete;
  const std::string& json() const noexcept; private: std::string json_; };
ApiResult PlanDay(const std::string& requestJsonUtf8);
ApiResult ComputeNutritionTarget(const std::string& targetRequestJsonUtf8);
ApiResult ValidateMenuCatalog(const std::string& catalogJsonUtf8);
const char* ContractVersion() noexcept; // "1.0"，静态
}
```

WASM：`mp_api_version`、`mp_contract_version`（静态不释放）、`mp_alloc`/`mp_free`、`mp_plan`、`mp_nutrition_target`、`mp_validate_menu`。JS 输入/输出缓冲区在 `finally` 各释放一次；输出先复制再释放；`nullptr` 仅表示真实分配失败；异常在入口转可见错误；单实例串行，不加并发框架。原生/WASM 同一核心与 JSON 语义。

## 12. 两层独立参照、性能测量与注释率

- 层 1：可人工列全的极小原始菜单（半份同价、固定套餐、可选套餐、售罄/锁定）→ 独立枚举合法单餐候选，核对完整性/价格/未知处理；不复用生产候选生成。
- 层 2：基于层 1 候选独立穷举全天组合，核对评分/排序/去重/预算/完整性；不复用 DP/B&B 剪枝或评分实现；证据入 T04/T07 供 T09。
- 性能：维度 `M/W/D/K/C/S/N`；分组 G0–G3（G3 真实规模待 T03/T02）；计时四类互斥：核心-only（实验构建计数器，不进入结果）、JS 调用往返、拷贝/释放、页面端到端；≥5 次，median/min/max + 全部原始值；记录环境/工具/规模/限额/峰值内存/WASM 页/`.wasm` 大小/节点状态数；一致性用确定性限额且 `wallClockMs=null`；本候选不填任何实测数字。
- 注释率：自写 C++/TS（`core/`、`miniprogram/src/` 自写文件）；排除第三方/生成物/`node_modules`/WASM/构建产物/样例数据；`cloc` 或仓库脚本；分母=非空代码行，分子=有效注释行（排除空白/纯分隔线/无意义填充）；报告原始计数与排除清单；按课设要求 ≥20%。

## 13. 模块归属

| 路径 | 归属 |
|---|---|
| `Resources/契约/T01-v1.1-candidate/` | DSH 独占写、P01 决策；旧 `T01-v1-candidate/` 只读保留 |
| `core/{include,src,cli,wasm,tests}/`、`tools/core/` | DSH |
| `miniprogram/`、`tools/miniprogram/` | 反重力 |
| `Resources/菜单/` | 反重力 |
| `Resources/营养配置/` | DSH 起草、P09 核验 |
| `Resources/报告/` | 各岗位独立命名 |
| `AGENTS.md`、`MEMORY`、主 PRD、T01 卡 | P01/P02，DSH 不写 |

本次不创建代码，不派发 T02/T04/T05。

## 14. 旧页面字段映射（只说明，不兼容）

同 v1：`dishName/dishId→name/dishId`；`priceCents/halfPriceCents→offers[].priceCents`（半份同价、独立 offer）；`proteinG/fatG/carbsG→proteinDg/fatDg/carbDg`（×10）；`gender/heightCm/weightKg→sex/heightMm/weightGrams`；`mealType/catalogVersion→planningMeals[]/catalog.menuVersion`（另带快照）；页面 `todaySpentCents/dailyTarget` 不接受；`budget_saving/taste_first→economy/taste`；`logId/version/CONFIRMED/REVOKED/SKIPPED→recordId/revision/active/superseded/revoked`（不用 SKIPPED）；`SolveMealPlan/FreeMealPlanResult/EvaluateProfileTarget→mp_plan/mp_free/mp_nutrition_target`。

## 15. P09 复核状态、开放澄清与冻结边界

- **P01 产品规则已裁定**：本文件 §8 各项为 confirmed product decision；不再保留“待 P01 决定”的状态字段。
- **来源支持范围**：见 `nutrition-v1-candidate.json` 的 `sourceRefs`，只支持其确切范围；产品初值可无直接科学来源，但标“产品估算/产品默认”与可校正边界。
- **P09 状态**：新候选实际文件尚未由 P09 复核，`p09ReviewStatus=pendingReview`。旧 P09 报告（旧提案、旧 v1 候选/裁定复核）只作历史证据，`verdict=not-passed` 不适用于本文件；不得写成 P09 已通过，也不要求 P09 证明产品初值为医学最佳。
- **开放澄清（非已裁定项）**：P09 v2 提出“18 岁是否也执行 130 g/day 碳水产品门槛”，P01 v3 未列明；本候选 18 岁只执行 §8.5 所列百分比范围，不额外套用 130 g/day，待 P01 冻结前确认。
- **冻结边界**：T01 未冻结；本候选不自动解锁 T02/T04/T05，不表示营养通过或实现已开始。

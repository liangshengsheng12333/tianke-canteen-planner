# T01 共享契约候选 v1（contract-v1-candidate）

| 项 | 内容 |
|---|---|
| 文档版本 | `t01-contract-v1-candidate`（2026-10-20） |
| 状态 | **候选草案，未冻结**。由 P01 判断是否冻结并由 P02 登记；本文件不构成 T02/T04/T05 派工，不表示营养已核验。 |
| 依据 | 主 PRD v0.2（SHA256 `D68ECE7218BC076155A0AFB6200788B7608898E9D0CDF6ECEC27C5E49AA58FDD`）；T01 任务卡 v0.2；P01 接口裁定 `2026-10-20-t01-resolution-v1`（`Resources/报告/T01-P01-接口裁定-20261020.md`）；DSH 计算侧提案 v1.1（SHA256 `1941F1F639AC13BF4AAC78E0A6092109FC69B90D56897C0649EE0F92A406265F`）；反重力页面/存储侧提案；P02 两侧提案查收；P09 营养配置独立核验（`Resources/报告/T01-P09-营养配置独立核验-20261020.md`，SHA256 `1723320E1624E18F7DEDB78EC06CCDA65BF167AE7FD4256E0AC1F5719F269FA7`）。 |
| 配套文件 | `nutrition-v1-candidate.json`（参数与核验状态）、`plan-request-result-sample.json`（一对请求/结果样例） |
| 语言 | JSON 契约。金额整数分；能量整数 kcal；蛋白质/脂肪/碳水整数 0.1 g（`proteinDg`/`fatDg`/`carbDg`）；体重 g；身高 mm；`null`=未知，`0`=已知零。 |

本候选按 P01 已裁定事项收敛；营养数值的已核验/待核验状态以配套 JSON 与 P09 报告为准，本文件不把未核验值当结论。

## 0. 通用规则

1. **契约版本**：任一独立入口的输入/输出对象带 `contractVersion: "1.0"`：`Profile`、`MenuCatalog`、`TargetRequest`、`PlanRequest`、`ResultEnvelope`、`MealLog`。未知 major 拒绝（`UNSUPPORTED_CONTRACT_VERSION`）；未知 minor 允许追加可选字段；未知枚举值拒绝。
2. **编码与数值**：UTF-8、无 BOM；金额/营养/计数只用 JSON 整数，禁止浮点。中间量用 `int64_t`；输出整数须在 ±(2⁵³−1) 内，越界=`INVALID_INPUT`。
3. **哈希**：`sha256:` 小写十六进制；规范化序列化（键排序、无空白、LF）；**哈希对象排除自身 `hash`/`catalogHash` 字段**；生成方计算、接收方复算，不一致拒绝。
4. **稳定标识**：小写字符串 `^[a-z0-9][a-z0-9._-]{0,63}$`；不使用数组下标。`dishId` 跨菜单版本稳定；`offerId` 唯一标识可购买售卖单位；固定套餐 `offerId` 稳定；可选套餐展开后的 `offerId` 由规则生成且确定（`ruleId#排序后的dishId列表`）。`recordId`/`confirmationId`/`requestId` 由调用方生成且唯一。
5. **快照**：请求携带 `profile`、`catalog`、`nutritionConfig` 与当日有效 `mealLogs` 的完整快照；核心不读文件/存储，不接受页面预汇总的目标或预算。
6. **无静默默认值**：参数缺失/非法 → 可见错误；不以内置默认值继续。v1 无旧版本，不写兼容/迁移层；未来语义变更走 major 新文件，历史 `MealLog` 快照不重写。
7. **校验边界**：只在入口校验一次；内部不变量破坏时抛可定位异常，入口转可见错误；不吞错、不以空方案伪装成功。
8. **输出确定性**：同请求同字节（除 OOM 等真实资源失败）：`plans[]` 按策略顺序再按 `planKey`；`strategyOutcome[]`/`offeredAs[]` 按策略顺序；`mealOutcomes[]` 按 `planningMeals` 顺序；`diagnostics[]` 按 `(code, fieldPath, meal, dishIds)` 排序。耗时与设备信息**不进入**结果语义。

## 1. ResultEnvelope、错误与状态

```json
{ "contractVersion": "1.0", "requestId": "…|null", "ok": true, "error": null, "result": { } }
```

- `ok=false` 仅契约级失败：`error.code ∈ {INVALID_INPUT, UNSUPPORTED_CONTRACT_VERSION, INTERNAL_ERROR, APPLICABILITY_BLOCKED}`，`result=null`，`error` 含 `fieldPath`、`message`、`details[]`。`APPLICABILITY_BLOCKED` 仅当请求目标在 `blockedGoals` 内（§8）。
- `ok=true` 表示请求已执行完，业务结论在 `result.status`；无解/预算无解/数据不足/锁定失效/资源受限**不能**写成 error 或空方案。
- `requestId`：`PlanDay` 回显请求 ID；`ComputeNutritionTarget` 回显 `TargetRequest.requestId`；`ValidateMenuCatalog` 为 `null`。

`result.status`：

| status | 含义 | 是否返回方案 |
|---|---|---|
| `Ok` | 方案完整（四项营养、价格、预算核算均完整），无近似 | 是 |
| `OkPartial` | 返回方案，但存在独立限制标志（营养不完整、价格不完整、近似/限额、少于三套方案等）；**不等于营养全缺失，也不等于已通过** | 是 |
| `NoFeasible` | 候选空间未截断且穷尽后无合法组合（须 `search.searchComplete=true` 且无候选截断） | 否 |
| `NoFeasibleWithinBudget` | 有合法组合但剩余预算内无解；返回明确标注加价的备选 | 是（`overBudget=true`） |
| `NutritionDataInsufficient` | 因关键营养未知导致无自动候选；与预算无解/限额分别表达 | 否 |
| `ResourceLimited` | 达到确定性限额/墙钟仍无方案；不得称已证明无解 | 否 |
| `LockConflict` | 锁定 offer 失效（售罄/停售/新菜单移除/供应不匹配），须用户先解决 | 否 |

## 2. Profile

| 字段 | 类型/取值 | 必填 | 说明 |
|---|---|---|---|
| `contractVersion` | `"1.0"` | 是 | |
| `profileId` | string | 是 | 稳定 ID |
| `revision` | int ≥1 | 是 | 输入快照版本；派生缓存必须带它 |
| `sex` | `male`/`female` | 是 | |
| `ageYears` | int | 是 | 输入范围校验；适用性见 §8 |
| `heightMm` | int | 是 | |
| `weightGrams` | int | 是 | |
| `bodyFatPermille` | int/null | 否 | 选填 |
| `activityLevel` | `sedentary`/`light`/`moderate`/`active`/`veryActive` | 是 | 系数在营养配置 |
| `goal.type` | `maintain`/`fatLoss`/`manual` | 是 | 首版不含 `muscle_gain` |
| `goal.manualTargets` | object/null | `manual` 时必填 | `{energyKcal, proteinDg, fatDg, carbDg, source}` |
| `goal.manualTargets.source` | `professional`/`userEntered` | 是（manual 时） | 记录来源；系统只做格式/一致性检查，不背书医学适用性 |
| `trainingPreference` | bool | 是 | 仅影响蛋白质参数选择；定义待 P09/P01（§15） |
| `dietaryFlags.pregnancyOrLactation` | bool | 是 | |
| `dietaryFlags.medicalDietManagement` | bool | 是 | |
| `tastes[]` | `{dishId, preference: like/neutral/dislike}` | 否 | 口味策略输入 |
| `categoryPreferences[]` | `{category, preference}` | 否 | 可选；待 P01 决定是否启用，未启用不得影响结果 |

Profile 只存输入与手动目标；目标、预算、派生值由核心计算/重算，页面不得另算。派生缓存须带 `revision` + `nutritionConfig.version`。

## 3. MenuCatalog：dishes、offers、comboRules

| 对象 | 字段 | 类型/取值 | 必填 | 说明 |
|---|---|---|---|---|
| Catalog | `contractVersion` | `"1.0"` | 是 | |
| | `menuVersion` | string | 是 | 单调版本 |
| | `catalogHash` | `sha256:…` | 是 | 排除自身后计算 |
| | `canteen` | `{id,name}` | 是 | |
| | `windows[]` | `{windowId,name,mealWindows[]}` | 是 | `mealWindows ⊆ {breakfast,lunch,dinner}` |
| | `dishes[]` | 见下 | 是 | 营养主数据 |
| | `offers[]` | 见下 | 是 | 可购买售卖单位 |
| | `comboRules[]` | 见下 | 是（可空） | 可选套餐规则 |
| Dish | `dishId` | string | 是 | |
| | `name` | string | 是 | |
| | `kind` | `single`/`combo` | 是 | 固定套餐为 `combo` |
| | `category` | `staple`/`protein`/`vegetable`/`soup`/`drink`/`other` | 否 | 多样性排序；未知类别不计覆盖 |
| | `riceDish` | bool | 是 | 仅米饭为 true，唯一允许半份 |
| | `components[]` | `{dishId,count}` | combo 必填 | 固定套餐组成；不用于拆价 |
| | `riceIncluded` | bool | combo 必填 | 含饭时不重复收米饭费 |
| | `nutrition` | `{energyKcal,proteinDg,fatDg,carbDg}`，各 int/null | 是 | 标准售卖份量；null=未知 |
| | `nutritionBasis` | `{source, portionAssumption, estimated, note}` | 是 | `source ∈ label/recipe/referenceTable/estimate/comboComponentSum/unknown` |
| | `portionBasis` | string | 否 | 份量假定说明 |
| Offer | `offerId` | string | 是 | |
| | `dishId` | string | 是 | 存在性校验 |
| | `windowId` | string | 是 | |
| | `mealWindows[]` | string[] | 是 | ⊆ 窗口供应 |
| | `portionCode` | `full`/`half` | 是 | `half` 仅米饭 |
| | `portionRatioNum`/`Den` | int | 是 | 营养比例；半份=1/2 |
| | `priceCents` | int/null | 是 | 真实售价；null=未知（`null ⇔ priceBasis=unknown`） |
| | `priceBasis` | `unitPrice`/`comboTotal`/`unknown` | 是 | 套餐真实总价用 `comboTotal` |
| | `nutritionOverride` | `{nutrition,nutritionBasis}` / null | 否 | 明确实测/标签数据，自带来源与份量假定 |

**半份米饭（P01 裁定 6）**：只有 `riceDish=true` 可有 `portionCode=half` offer；其 `priceCents` **必须等于同一窗口、同一米饭 dish 的整份 offer 的 `priceCents`**（同价，不除以二、不派生）；整份价格未知时半份也必须未知（`null`/`unknown`）。营养仍按 `portionRatio` 派生（半份营养 = 整份 × 1/2，逐项 `round_half_up`），并继承来源/估算标记。套餐含饭只按真实套餐总价，不额外收米饭费。

**固定套餐**：`kind=combo`；有独立 `nutrition` 时采用；否则仅当 `components` 全部存在、份量确定且组件营养来源完整时，由核心按组件汇总（四项均已知才可自动新增，否则营养不完整），`nutritionBasis.source="comboComponentSum"`，`estimated` 按组件估算状态取并集。套餐价格只取 `comboTotal` 真实总价，不按组件价拆算。

**可选套餐 `comboRules`（最小结构，不做通用规则引擎）**：

| 字段 | 类型 | 说明 |
|---|---|---|
| `ruleId` | string | 稳定 ID |
| `name` | string | 展示名 |
| `windowId`/`mealWindows[]` | string | 供应范围 |
| `totalPriceCents` | int | 真实套餐总价（必填，不拆价） |
| `includesRice` | bool | 含饭时不另收米饭费 |
| `requiredCounts` | `{category: count}` | 必须满足的类别数量（如 `{protein:2, vegetable:1}`） |
| `candidateDishIds[]` | string[] | 可选组件（按 `category` 归类） |
| `nutritionPolicy` | `sumComponents` | 唯一支持值；组件四项均已知才完整，否则营养不完整 |

最小示例（字段语义见上）：

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

展开规则（核心共用候选生成层实现）：在 `candidateDishIds` 中按 `requiredCounts` 选组合（每道至多 1 份），过滤售罄/不供应/窗口不符；生成原子售卖单位 `offerId = ruleId#<按 dishId 升序拼接>`，价格=`totalPriceCents`，营养按 `sumComponents` 汇总/标记不完整；不含饭时米饭另行选择。固定套餐 offer 与规则展开 offer 在候选生成、锁定、售罄、计价中同等对待。

## 4. PlanRequest

| 字段 | 类型 | 必填 | 说明 |
|---|---|---|---|
| `contractVersion` | string | 是 | `"1.0"` |
| `requestId` | string | 是 | 调用方生成 |
| `businessDate` | `YYYY-MM-DD` | 是 | 业务日期 |
| `tzOffsetMinutes` | int | 是 | 记录时本地偏移 |
| `profile` | Profile | 是 | 完整快照 |
| `catalog` | MenuCatalog | 是 | 完整快照 |
| `nutritionConfig` | object | 是 | §8 配置完整快照（含 `version`/`hash`/`formula`/`parameters`/`applicability`/`plannerSorting`） |
| `plannerConfig.algorithm` | `greedy`/`dp`/`branchAndBound` | 是 | |
| `plannerConfig.strategies[]` | `primary`/`economy`/`taste` 子集 | 是 | 顺序固定按此枚举 |
| `plannerConfig.budgetCents` | int/null | 是 | `null`=无预算；`0`=显式零预算 |
| `plannerConfig.maxItemsPerMeal` | int 1–8 | 是 | 单餐最多购买单位数 |
| `plannerConfig.limits` | `{maxMealCandidatesPerMeal, maxDpStates, maxSearchNodes, wallClockMs}` | 是 | 确定性限额；一致性测试 `wallClockMs=null` |
| `planningMeals[]` | 1–3 个餐次 | 是 | 不得含 `endedMeals`，不得含 `activeLogs` 已有有效记录的餐次 |
| `state.soldOut[]` | `{windowId, meal, dishId}` | 是 | 业务日期作用域；可空 |
| `state.windowLocks[]` | `{meal, windowId}` | 是 | 可空 |
| `state.itemLocks[]` | `{meal, offerId, quantity}` | 是 | 锁定售卖单位；可空 |
| `state.endedMeals[]` | 餐次数组 | 是 | 用户明确结束；不规划、不补推 |
| `state.activeLogs[]` | MealLog[] | 是 | 当前业务日期、`status=active`；只用于已吃/预算核算 |

校验：`activeLogs.businessDate` 必须等于请求日期；重复 `recordId` → `INVALID_INPUT`；`planningMeals ∩ activeLogs.meal ≠ ∅` → `INVALID_INPUT`；锁定 offer 不存在/不供应/售罄 → `LockConflict`；`priceCents=null` 不得配 `priceBasis≠unknown`；半份米饭价格规则见 §3。补记（`source=manual`）可保留并作为有效日志参与已吃/预算汇总，核心只消费、不禁止。`planningMeals` 与 `endedMeals` 冲突也视为 `INVALID_INPUT`（已结束餐次不得再规划）。

## 5. PlanResult

`result` 字段：

| 字段 | 类型 | 说明 |
|---|---|---|
| `status` | enum | §1 |
| `businessDate`/`tzOffsetMinutes` | string/int | 回显请求 |
| `mealOutcomes[]` | `{meal, status, planIndex?, reason?}` | 逐餐结果；日级 status 取最严重 |
| `inputDigests` | object | `catalogHash/menuVersion/profileHash/nutritionConfigVersion/nutritionConfigHash/plannerConfigHash` |
| `targets` | object | `{daily, mealReference, source{formula,formulaLabel,reeKcal,tdeeKcal,deficitKcal,activityFactorPermille,goal}, applicability{status,blockedGoals,warnings}, pendingVerification[]}` |
| `strategyOutcome[]` | `{strategy, planIndex, selectedBecause: BEST_SCORE/ONLY_LEGAL_PLAN/SAME_AS_OTHER_STRATEGY/NO_COMPLETE_PLAN}` | 固定策略顺序 |
| `plans[]` | 见下 | 最多 3 套不同方案；不足时给原因 |
| `intakeSummary` | `{totals, incompleteNutrients[], unknownNutritionItemRefs[], priceIncomplete, unknownPriceItemRefs[], activeLogCount}` | 仅由有效日志汇总；跨日志引用 `recordId#itemKey` |
| `budgetSummary` | `{budgetCents, actualSpendKnownCents, actualSpendUnknownItemCount, actualSpendUnknownPriceItemRefs[], budgetAccountingComplete, remainingKnownCents}` | 未知实付时仅已知口径 |
| `distinctPlanCount`/`fewerThanThreeReason` | int / `{code,message}` | 不复制凑数 |
| `diagnostics[]` | `{code,severity,message,fieldPath?,meal?,dishIds?,itemRefs?}` | 稳定码见 §6 |
| `search` | `{algorithm, searchComplete, candidatesEnumerated{meal:int}, nodesEvaluated:int/null, statesEvaluated:int/null, capsHit:[{limit,limitValue,observed,meal?}], approximations:[{kind,scope,value?,limit?,detail?}]}` | 不含耗时 |

`plans[]`：

| 字段 | 类型 | 说明 |
|---|---|---|
| `offeredAs[]` | 策略数组 | 去重合并 |
| `score` | object | `{nutritionCompleteness: complete/incomplete, comparisonBasis: complete/incompleteKnownComparable/notComparable, nutritionDeviationBp:int/null, nutritionTier:int/null, preferenceScore:int, priceCents:int/null, diversity:{categoryCoverage:int, repeatedDishCount:int, unknownCategoryItemCount:int}}` |
| `meals[]` | object[] | `{meal, windowId, items[], nutrition{knownSums,incompleteNutrients,unknownItemRefs}, nutritionReferenceTarget{4项}, windowLocked}` |
| `meals[].items[]` | object[] | `{offerId,dishId,name,quantity,portionCode,unitPriceCents,priceKnown,nutrition{4项/null},nutritionBasis,locked,estimated,combo}` |
| `budget` | object | `{budgetCents, remainingBudgetKnownCents, plannedTotalCents, plannedTotalKnownCents, priceIncomplete, overBudget, withinBudgetKnownAmounts, overageCents, checkBasis: complete/knownActualsOnly}` |
| `flags[]` | string[] | §6 独立标志 |

规则：`plannedTotalCents` 仅价格完整时非 null；`plannedTotalKnownCents` 恒为已知和；`overageCents = max(0, plannedTotalKnownCents − remainingBudgetKnownCents)`，预算未设/价格不完整时为 null。**自动预算方案只有价格完整且预算核算完整时才可标“预算内”**；否则只能给“已知口径内不超”并标不完整；主推荐不得隐性超预算，预算内无解时按 `NoFeasibleWithinBudget` 返回加价备选。`meals[].nutrition.unknownItemRefs` 在计划内为 `offerId` 列表，在日志汇总中为 `recordId#itemKey`。`nutritionDeviationBp` 仅四项完整时计算；完整方案才可算 `nutritionTier`；不完整方案只作参考，不得比较为已达标；若多个候选的未知项集合相同，可标 `incompleteKnownComparable` 并比较价格/口味/多样性，但不得输出营养达标结论。

## 6. 独立标志与诊断码

`flags[]`（各维度分开，不得合并）：`NUTRITION_INCOMPLETE`、`PRICE_INCOMPLETE`、`ESTIMATED_DATA`、`BUDGET_ACCOUNTING_INCOMPLETE`、`APPROXIMATE_CANDIDATES`、`APPROXIMATE_DISCRETIZATION`、`APPROXIMATE_TIMEOUT`、`SEARCH_LIMIT_REACHED`、`FEWER_THAN_THREE_PLANS`、`LOCKED_UNKNOWN_NUTRITION`、`OVER_BUDGET_ALTERNATIVE`。

`diagnostics[].code`：新增 `SOLD_OUT_EXCLUDED`、`LOCK_INVALID`、`NUTRITION_DATA_INSUFFICIENT`、`NO_LEGAL_COMBINATION`、`NO_DISTINCT_ALTERNATIVE`、`APPLICABILITY_WARNING`（后者走 `targets.applicability.warnings`）。`capsHit.limit ∈ {maxMealCandidatesPerMeal,maxDpStates,maxSearchNodes,wallClockMs}`。UI 按码映射文案，不按文案判语义。

## 7. MealLog

| 字段 | 类型 | 说明 |
|---|---|---|
| `contractVersion` | `"1.0"` | |
| `recordId` | string | 稳定记录 ID |
| `confirmationId` | string | 幂等键，幂等由反重力存储层实现 |
| `businessDate`/`tzOffsetMinutes` | string/int | 业务日期与记录时偏移 |
| `meal` | `breakfast`/`lunch`/`dinner`/`other` | |
| `status` | `active`/`superseded`/`revoked` | 仅 `active` 计入；不设 `SKIPPED` |
| `revision` | int | 修改递增 |
| `replacesRecordId`/`supersededByRecordId` | string/null | 改撤关联，快照保留 |
| `revokedAt` | string/null | |
| `confirmedAt` | string | |
| `menuVersion` | string/null | 记餐时菜单版本 |
| `items[]` | `{itemKey, source: menuOffer/manual, offerId?, dishId?, menuVersion?, nameSnapshot, portionCode, quantity, unitPriceCents, priceKnown, nutrition{4项/null}, nutritionBasis, note}` | 当时快照，不随菜单/推荐变化 |

核心只消费 `active` 日志并防重复 `recordId` 入账；餐次结束只用 `state.endedMeals`，不伪造摄入或零消费；改撤/确认幂等由反重力存储层完成，契约只传结果。

## 8. 营养目标与适用性（公式细则见配套 JSON）

配置版本：`nutrition-v1-candidate`，参数按“已确认产品初值 / 待 P09 核验 / 待 P01 决定”标注；`confirmedProductInitial` 可直接进入实现；其他状态只能以候选占位值参与计算，结果必须回显 `pendingVerification[]`，在 P01/P09 回填前不得标“已核验”。

计算链（整数，取整 `round_half_up(x,d)=(2x+d)/(2d)`，int64）：
1. 估算静息能量消耗（REE，不称实测 BMR）：`ree_mkcal = 1000·w10 + 625·h10 − 5000·a + sexTerm`（男 +5000，女 −161000）。
2. `tdee_mkcal = round_half_up(ree_mkcal × activityFactorPermille, 1000)`。
3. `fatLoss`：`deficit = min(round_half_up(tdee_mkcal × fatLossDeficitPermille, 1000), capKcal×1000)`；`maintain`：无缺口；`manual`：用用户/专业目标并检查。
4. `targetEnergyKcal = round_half_up(targetEnergy_mkcal, 1000)`；蛋白质 `proteinDg = round_half_up(proteinMgPerKg × w10, 1000)`；脂肪 `fatDg = round_half_up(fatKcal×10, 9)`；碳水取余量并校验 >0；餐次参考按 `mealSharePermille` 分配。
5. 目标模式：默认 `remainingAfterKnownIntake`——四项摄入均完整时，按剩余目标在剩余餐次间按份额重新归一化；任一项不完整时退回餐次参考并标 `NUTRITION_INCOMPLETE`，不按未知加码补偿。
6. BMI：**比较必须用未舍入整数**：`weightGrams × 10000 < bmiUnderweightThresholdTenths × heightMm²`（阈值 185 ⇔ BMI<18.5）；显示值可单独四舍五入。禁止先舍入再比较。

适用性（建议，待 P01 确认项见 §15）：
- 年龄 < `adultAgeMinYears`（候选值 18，18 岁为产品外推、待 P01/P09）：**不生成任何自动目标**（fatLoss/maintain）；`manual` 仅可按用户/专业人员来源存储并做格式/一致性检查，返回 warning，不背书医学适用性。
- `pregnancyOrLactation=true` 或 `medicalDietManagement=true`：不生成自动目标（fatLoss 与 maintain）；manual 同上（P09 建议，待 P01 确认）。
- 体重过轻（BMI<18.5，未舍入）：只拦 fatLoss，maintain 可继续并 warning（PRD 只要求不自动生成减脂目标；P09 建议 P01 进一步明确）。
- 手动目标：必须有 `source`；能量低于低摄入阈值或宏观换算不一致 → 拒绝；宏量营养素参考范围校验规则待 P01（§15）。
- `trainingPreference` 只影响蛋白质参数选择；其“规律训练”定义待 P09/P01。

`ComputeNutritionTarget` 输入 `TargetRequest = {contractVersion, requestId, profile, nutritionConfig}`；成功返回 `{targets, applicability, pendingVerification}`；请求目标被拦 → `ok=false` + `APPLICABILITY_BLOCKED`（`details[]` 含 `blockedGoals[]` 与阈值）；可继续但有提示 → `ok=true` + `applicability.status="passedWithWarnings"` + `warnings[]`。

## 9. 合法性与候选生成（三算法共用）

检查顺序：L1 JSON/版本 → L2 结构/枚举/范围 → L3 引用/哈希/日志日期/重复 recordId → L4 餐次状态（planningMeals 排除 endedMeals/已吃餐） → L5 供应（offer/窗口/餐次） → L6 售罄/锁定（锁定失效→`LockConflict`） → L7 套餐/份量/半份同价/价格一致性 → L8 单窗口 → L9 营养资格（自动新增要求四项已知或带来源/份量的估算；锁定项可保留但整体不完整） → L10 预算（策略层，非候选合法性） → L11 限额。

候选单位是 offer（含固定套餐与规则展开套餐）；未知营养且未锁定的菜不进入自动候选；锁定项必须包含；同一餐只能一个窗口；单餐数量 ≤ `maxItemsPerMeal`。所有截断/预筛选/桶宽在 `search` 中可见；未论证的剪枝一律标近似。

## 10. 评分与排序（P01 裁定 10、11）

- 营养偏差：`nutritionDeviationBp = Σ_n round_half_up(|known_n − target_n| × 10000 × w_n, target_n × 1000)`，`w_n=250‰`（四项各 250，来自配置）；`target_n>0` 由配置校验保证。仅四项完整可计算。
- 分组：`nutritionTier = floor(nutritionDeviationBp / 1000)`；1000bp 是可调排序分组宽度，**不是达标阈值或医学指标**。三个算法共用同一排序键。
- 策略键（字典序）：
  - `primary`：营养偏差↑ → 多样性（类别覆盖↓、重复菜↑、未知类别数↑） → 口味↓ → 价格↑ → `planKey`↑；
  - `economy`：`nutritionTier`↑ → 价格↑ → 多样性 → 口味↓ → `planKey`↑；
  - `taste`：`nutritionTier`↑ → 口味↓ → 多样性 → 价格↑ → `planKey`↑。
  （↑越小越好、↓越大越好。）
- 完整性处理：完整方案先于不完整方案；完整方案可比较 tier；不完整方案只作参考，不能标“已达标”；未知项集合相同的候选可标 `incompleteKnownComparable`，按价格/口味/多样性比较，不输出营养达标。
- 多样性（简单版）：类别覆盖=已选 dish 的不同已知类别数（未知类别不计）；重复菜=同一 dishId 出现超过 1 次的次数；按类别覆盖高、重复少排序，不做复杂优化。菜单必须能表达 `category`。
- 去重/并列：`planKey` = 按餐次、窗口、`offerId:quantity` 排序拼接；相同 `planKey` 合并 `offeredAs`；`selectedBecause` 优先级 `ONLY_LEGAL_PLAN` > `SAME_AS_OTHER_STRATEGY` > `BEST_SCORE`；少于三套给 `fewerThanThreeReason`，不复制凑数。
- 最优性：仅当候选未截断、无确定性限额触发、算法在候选空间内精确时才可声明“候选空间内最优”；greedy 永不声明最优；总在近似/限额时标明。

## 11. C++ 入口与 WASM 边界

```cpp
namespace meal_planner {
class ApiResult { public: ApiResult(ApiResult&&) noexcept = default; ApiResult& operator=(ApiResult&&) noexcept = default;
  ApiResult(const ApiResult&) = delete; ApiResult& operator=(const ApiResult&) = delete;
  const std::string& json() const noexcept; private: std::string json_; };
ApiResult PlanDay(const std::string& requestJsonUtf8);
ApiResult ComputeNutritionTarget(const std::string& targetRequestJsonUtf8);
ApiResult ValidateMenuCatalog(const std::string& catalogJsonUtf8);
const char* ContractVersion() noexcept; // "1.0"，静态存储
}
```

WASM 导出（C ABI，与原生共用同一核心）：

```cpp
extern "C" {
  unsigned int mp_api_version(void);
  const char*  mp_contract_version(void);   // 静态，不释放
  char*        mp_alloc(unsigned int bytes);
  void         mp_free(char* p);
  char*        mp_plan(const char* requestJsonUtf8);
  char*        mp_nutrition_target(const char* targetRequestJsonUtf8);
  char*        mp_validate_menu(const char* catalogJsonUtf8);
}
```

边界：JS 输入缓冲区与输出缓冲区在 `finally` 各释放一次；输出先 `UTF8ToString` 复制、再 `mp_free`；版本字符串不释放；`mp_plan` 返回 `nullptr` 仅表示真实分配失败（桥须显示资源错误，不能当空方案），其他失败全部在 envelope；核心异常在入口转可见错误，不越过桥；单实例串行，不加并发框架/线程池。原生与 WASM 使用同一代码与同一 JSON 语义。

## 12. 两层独立参照、性能测量与注释率

**两层独立参照**：
1. 层 1（原始菜单→合法单餐候选）：用可人工列全的极小菜单（含半份米饭同价、固定套餐、可选套餐规则、售罄/锁定），由独立实现枚举合法单餐候选，核对候选完整性、价格（不拆价、不重复收饭）与营养未知处理；独立实现不得复用生产候选生成代码。
2. 层 2（单餐候选→全天搜索）：基于层 1 候选独立穷举全天组合，核对评分、排序、去重、预算与完整性标志；不得复用 DP/B&B 的剪枝或评分内部实现。两层结果与生产核心对照，证据入 T04/T07 报告供 T09 复核。

**性能测量**：维度 `M`（planningMeals 1–3）、`W`（每餐窗口数）、`D`（每窗口每餐合法 offer）、`K`（maxItemsPerMeal）、`C`（单餐候选）、`S`（DP 状态）、`N`（B&B 节点）；分组 G0–G3（G0 极小用于最小链路；G3 真实菜单规模，成员待 T03/T02 冻结）。计时分四类且互斥：核心-only（实验构建计数器，分段 parse/validate、candidate、solve、serialize；不进入结果）、JS 调用往返（不含拷贝/释放）、拷贝与释放、页面端到端。每次 ≥5 次，报 median/min/max 与全部原始值；记录环境/工具版本/菜单规模/限额；资源记录平台峰值内存、WASM 内存页、`.wasm` 大小、节点/状态数。一致性测试用确定性限额且 `wallClockMs=null`；不承诺不同机器限时产出相同字节。**本候选不填响应目标或实测数字**，由 T02/T07 实测后 P01 冻结。

**注释率**：范围=自写 C++/TS 源码（`core/` 与 `miniprogram/src/` 中自写文件）；排除第三方、生成物、`node_modules`、WASM/构建产物与样例数据。工具用 `cloc` 或随仓库脚本；分母=非空代码行，分子=有效注释行（排除空白、纯分隔线、无意义填充）；报告原始计数、排除清单与统计范围；目标按课设要求 ≥20%，不得用无意义注释凑数。

## 13. 模块归属与变更

| 路径 | 归属 | 规则 |
|---|---|---|
| `Resources/契约/T01-v1-candidate/` | DSH 独占写、P01 决策 | 本候选三份文件；共享契约变化交 P01 |
| `core/{include,src,cli,wasm,tests}/`、`tools/core/` | DSH | 构造/实现/测试/性能实验 |
| `miniprogram/`、`tools/miniprogram/` | 反重力 | 页面、存储、菜单导入、WASM 调用侧；不写正式营养公式 |
| `Resources/菜单/` | 反重力 | 菜单包与真实菜单整理 |
| `Resources/营养配置/` | DSH 起草、P09 核验 | 通过版须 P09 核验 |
| `Resources/报告/` | 各岗位独立命名 | 查收/核验/集成报告 |
| `AGENTS.md`、`MEMORY`、主 PRD、T01 卡 | P01/P02 | DSH 不写 |

本次不创建 `core/`/`miniprogram/` 代码，不派发 T02/T04/T05。

## 14. 旧页面字段映射（只作说明，不做兼容层）

| 反重力提案字段 | 本契约 |
|---|---|
| `dishName`/`dishId` | `dishes[].name`/`dishId` |
| `priceCents`/`halfPriceCents` | `offers[].priceCents`（半份米饭同价，独立 offer） |
| `proteinG`/`fatG`/`carbsG`（小数克） | `proteinDg`/`fatDg`/`carbDg`（×10 取整） |
| `gender`/`heightCm`/`weightKg` | `sex`/`heightMm`/`weightGrams` |
| `mealType`/`catalogVersion` | `planningMeals[]`/`catalog.menuVersion`（另带完整快照与哈希） |
| `todaySpentCents`/`dailyTarget`（页面汇总） | 不接受；核心由 `profile`+`nutritionConfig`+`activeLogs` 重算 |
| 策略 `budget_saving`/`taste_first` | `economy`/`taste` |
| 状态 `SUCCESS`/`PARTIAL_NUTRITION`/`NO_FEASIBLE_SOLUTION`/`BUDGET_EXCEEDED`/`TIMEOUT_APPROXIMATE`/`INPUT_INVALID`/`CORE_EXCEPTION` | `Ok`/`OkPartial`/`NoFeasible` 或 `NutritionDataInsufficient`/`NoFeasibleWithinBudget`/`OkPartial`(近似)或 `ResourceLimited`/`INVALID_INPUT`/`INTERNAL_ERROR` |
| `logId`/`version`/`status CONFIRMED/REVOKED/SKIPPED` | `recordId`/`revision`/`active/superseded/revoked`；`SKIPPED` 不用，餐次结束走 `endedMeals` |
| `SolveMealPlan`/`FreeMealPlanResult`/`EvaluateProfileTarget` 命名 | `mp_plan`/`mp_free`/`mp_nutrition_target`（P01 裁定 8） |

## 15. 待决项（真实未解决，交 P01/P09）

1. 活动系数档位定义与来源（P09：现有 1.2–1.9 无一手来源；FAO/NASEM 口径不同，需产品估算定义或校准）。
2. 普通蛋白质 1.2 g/kg 的依据（P09：成人 RDA 0.8 g/kg，1.2 未被支持；P01 选择参考基准或标产品默认）。
3. 训练偏好 1.5 g/kg 与“规律训练”的适用边界。
4. 脂肪 27%、碳水余量及其他宏量组合的有效性提示/拦截规则（P09 要求至少提示异常组合）。
5. 餐次分配 30/40/30 的来源与是否用户可调。
6. 低摄入阈值 1200/1500 的来源与产品 guardrail 定位（P09：非普适安全线）。
7. 年龄下限 18 的外推依据与是否设上限（P09：Mifflin 样本 19–78，65 岁上限无来源）。
8. 过轻状态下 maintain/manual 的精确行为（当前候选：只拦 fatLoss，maintain+warning；P09 建议 P01 明确）。
9. 孕哺/疾病饮食下 manual 目标是否允许“仅存证 + 警告”（候选：允许但需 source，P09 建议排除自动目标；P01 确认）。
10. `categoryPreferences` 是否进入首版口味/多样性排序（当前为可选，未启用不得影响结果）。

上述未决不影响本候选的可实现骨架；相关参数在 `nutrition-v1-candidate.json` 中逐项标注状态，P01 冻结前不得标“已核验”。

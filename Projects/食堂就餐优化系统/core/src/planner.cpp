// planner.cpp — PlanDay 三算法核心实现（greedy / dp / branchAndBound）与层一合法单餐候选生成器
//
// 模块职责与工程不变量：
//   1. 严格遵循冻结 T01 v1.2（继承 v1.1）规范搜索契约：
//      - 请求 plannerConfig.limits 仅接受 maxMealCandidatesPerMeal、maxDpStates、maxSearchNodes、
//        wallClockMs 四个规范字段，不设静默默认值或旧字段别名（maxNodes/maxCandidates 直接报 INVALID_INPUT）。
//      - 响应 result.search 输出 algorithm、searchComplete、candidatesEnumerated{meal:int}、
//        nodesEvaluated:int/null、statesEvaluated:int/null、capsHit:[...]、approximations:[...]。
//   2. 层一（Layer 1）合法单餐候选生成：
//      - 三种手写算法（greedy / dp / branchAndBound）共用同一合法候选语义、窗口约束、锁定校验、
//        售罄过滤（含套餐组件连带售罄）、含饭互斥（riceIncluded / riceDish 不重复收饭）、营养资格检查。
//      - 静态报价（catalog.offers）与规则展开报价（catalog.expandedComboOffers）同等参与候选与锁定。
//   3. 评分与词典序策略（契约 §10）：
//      - 营养完整方案（complete）恒优于营养不完整方案（incomplete）；
//      - 预算启用时，预算内方案（withinBudget）恒优于超预算备选方案（overBudget）；
//      - primary：nutritionDeviationBp↑ -> 多样性(categoryCoverage↓, repeatedDishCount↑, unknownCategoryCount↑)
//                 -> preferenceScore↓ -> priceCents↑ -> planKey↑；
//      - economy：nutritionTier↑ -> priceCents↑ -> 多样性 -> preferenceScore↓ -> planKey↑；
//      - taste：  nutritionTier↑ -> preferenceScore↓ -> 多样性 -> priceCents↑ -> planKey↑。
//   4. 截断与限额透明性：
//      - 任何候选截断（maxMealCandidatesPerMeal）、DP 状态桶化/截断（maxDpStates）、搜索节点上限
//        （maxSearchNodes）或墙钟超时（wallClockMs）均诚实记入 capsHit 与 approximations，绝不伪称
//        NoFeasible（已证明无解）或全局最优。
//      - 全天容器一律按下标顺序遍历、不使用哈希容器；枚举、比较与序列化顺序因此跨平台逐字节一致。
//   5. 内存所有权：planner 全部动态内存（JSON DOM、候选、状态层、工作缓冲）分配在 ExecContext
//      持有的 Arena 上，随请求结束一次性归还；函数间以指针/切片借用，无逐对象释放路径。
#include "mp/catalog.h"
#include "mp/contract.h"
#include "mp/nutrition.h"
#include "mp/sha256.h"

namespace mp {

namespace {

// 单餐最大购买份数硬上限（契约 §4 规定 1..8，此处保留输入校验上界常量）
constexpr i64 kMaxItemsPerMealLimit = 8;

// 菜品分类位掩码映射：用于 O(1) 统计已覆盖的标准已知分类数（staple/protein/vegetable/soup/drink/other）
// 未知或缺失分类不计入位掩码（bit=0），而单独累计 unknownCategoryCount。
u32 CategoryBitFromName(Str hasCatName, bool hasCategory) {
  if (!hasCategory) {
    return 0;
  }
  if (hasCatName.Equals("staple")) return 1u << 0;
  if (hasCatName.Equals("protein")) return 1u << 1;
  if (hasCatName.Equals("vegetable")) return 1u << 2;
  if (hasCatName.Equals("soup")) return 1u << 3;
  if (hasCatName.Equals("drink")) return 1u << 4;
  if (hasCatName.Equals("other")) return 1u << 5;
  return 0;
}

// 统计 32 位无符号整数中置位比特的数量（即不同已知分类覆盖数 categoryCoverage）
i64 PopCountU32(u32 mask) {
  i64 count = 0;
  while (mask != 0) {
    count += static_cast<i64>(mask & 1u);
    mask >>= 1u;
  }
  return count;
}

// 营养偏差计算权重与分档宽度（来自 nutritionConfig.plannerSorting）
struct DeviationWeights {
  i64 energy;
  i64 protein;
  i64 fat;
  i64 carb;
  i64 tierWidthBp;
};

// 规范搜索限额配置（契约 §4 plannerConfig.limits）：
//   * maxMealCandidatesPerMeal: 每餐枚举的合法单餐候选上限（>=1）
//   * maxDpStates: 动态规划每阶段保留的最大状态数（>=1）
//   * maxSearchNodes: 贪心评估步数或分支限界搜索节点数上限（>=1）
//   * hasWallClockMs / wallClockMs: 可选墙钟毫秒上限（一致性测试中必须为 null）
struct PlannerLimits {
  i64 maxMealCandidatesPerMeal;
  i64 maxDpStates;
  i64 maxSearchNodes;
  bool hasWallClockMs;
  i64 wallClockMs;
};

// 规划器配置输入结构（对应 $.plannerConfig）
struct PlannerConfigInput {
  Str algorithm;
  Vec<Str> strategies;
  bool hasBudget;
  i64 budgetCents;
  i64 maxItemsPerMeal;
  PlannerLimits limits;
  DeviationWeights weights;
};

// 售罄规则记录（对应 $.state.soldOut[]）
struct SoldOutRule {
  i64 mealMask;
  bool hasWindow;
  Str windowId;
  bool hasDish;
  Str dishId;
};

// 报价单位锁定记录（对应 $.state.itemLocks[]）
struct ItemLock {
  i64 mealMask;
  Str offerId;
  i64 quantity;
};

// 全天状态锁定与售罄集合（对应 $.state）
struct LockSet {
  bool hasWindowLock[3];
  Str windowLockId[3];
  Vec<ItemLock> itemLocks;
  Vec<SoldOutRule> soldOut;
  bool ended[3];
};

// 选入单餐方案的具体售卖项（包含底层单品组件列表，供跨餐多样性与口味分精确计算）
struct PlannedItem {
  Str offerId;
  Str dishId;
  Str windowId;
  bool isHalf;
  Str portionCode;
  bool priceKnown;
  i64 priceCents;
  NutritionValues nutrition;
  bool hasCategory;
  Str category;
  bool estimated;
  bool locked;
  bool isCombo;
  bool riceDish;
  bool riceIncluded;
  i64 preferenceMatchCount;
  Vec<ComboComponent> components;
};

// 单餐候选方案（由层一生成器枚举，或由贪心构造产生）：
//   * 同一 MealPlan 内所有 items 必须归属同一 windowId；
//   * items 按 offerId 的 UTF-8 字节序升序规范化排列（相同 offerId 展开为多个 quantity=1 项或合并表示）。
struct MealPlan {
  Str mealName;
  i64 mealMask;
  Str windowId;
  bool windowLocked;
  Vec<PlannedItem> items;
  i64 candidateCount;
  i64 incompleteNutritionCount;
  bool limitReached;
  bool nutritionComplete;
  bool priceComplete;
  bool estimatedData;
  bool lockedUnknownNutrition;
  i64 knownPriceCents;
  i64 preferenceScore;
  NutritionValues sums;
  u32 categoryMask;
  i64 categoryCoverage;
  i64 unknownCategoryCount;
  i64 repeatedDishCount;
};

// 全天完整候选方案（涵盖全部 planningMeals 的组合及其全天综合评分）
struct PlanCandidate {
  Str planKey;
  Str strategy;
  Vec<Str> offeredAs;
  Vec<MealPlan> meals;
  i64 deviationBp;
  i64 tier;
  i64 preferenceScore;
  bool nutritionComplete;
  bool priceComplete;
  bool estimatedData;
  bool lockedUnknownNutrition;
  bool approxCandidates;
  bool approxDiscretization;
  bool approxTimeout;
  bool limitReached;
  i64 knownPriceCents;
  bool overBudget;
  i64 categoryCoverage;
  i64 repeatedDishCount;
  i64 unknownCategoryCount;
  bool viable;
};

// 当日已食用有效日志（activeLogs）汇总快照
struct IntakeSummary {
  Vec<Str> consumedMeals;
  i64 activeMealsMask;
  i64 itemCount;
  bool hasEnergy;
  i64 energyKcal;
  bool hasProtein;
  i64 proteinDg;
  bool hasFat;
  i64 fatDg;
  bool hasCarb;
  i64 carbDg;
  bool priceComplete;
  i64 knownPriceCents;
  i64 unknownItemCount;
};

// 触发的搜索限额记录（对应 result.search.capsHit[]）
struct CapHitRecord {
  Str limit;
  i64 limitValue;
  i64 observed;
  bool hasMeal;
  Str meal;
};

// 搜索近似声明记录（对应 result.search.approximations[]）
struct ApproxRecord {
  Str kind;
  Str scope;
  bool hasValue;
  i64 value;
  bool hasLimit;
  i64 limit;
  Str detail;
};

// 规范搜索统计跟踪器（汇总 result.search 所需的全部确定性指标）
struct SearchTracker {
  Str algorithm;
  bool searchComplete;
  bool hasMealEnum[3];
  i64 candidatesEnumerated[3];
  bool hasNodesEvaluated;
  i64 nodesEvaluated;
  bool hasStatesEvaluated;
  i64 statesEvaluated;
  Vec<CapHitRecord> capsHit;
  Vec<ApproxRecord> approximations;
  bool anyCandidateCapHit;
  bool anyDpCapHit;
  bool anyNodeCapHit;
  bool anyWallClockCapHit;
  bool clockEnabled;
  double clockStart;
  double clockLast;
  i64 clockLimit;

  bool StartClock(ExecContext& ctx, const PlannerLimits& limits) {
    clockEnabled = limits.hasWallClockMs;
    clockLimit = limits.wallClockMs;
    if (!clockEnabled) return true;
    clockStart = MonotonicMilliseconds();
    clockLast = clockStart;
    if (!(clockStart >= 0.0 && clockStart <= 9007199254740991.0)) {
      return ctx.FailInternal("$.plannerConfig.limits.wallClockMs", "monotonic clock unavailable or invalid");
    }
    return true;
  }

  bool Stop(ExecContext& ctx) {
    // 协作式时限检查：仅在算法显式调用 Stop() 的离散检查点生效，检查点之间的单步工作可能使
    // 实际耗时超过 wallClockMs（时限是尽早终止的保护，不是精确硬上限，超调不可完全避免）。
    if (!clockEnabled) return false;
    if (ctx.Failed() || anyWallClockCapHit) return true;
    const double now = MonotonicMilliseconds();
    if (!(now >= clockLast && now <= 9007199254740991.0)) {
      ctx.FailInternal("$.plannerConfig.limits.wallClockMs", "monotonic clock invalid or moved backwards");
      return true;
    }
    clockLast = now;
    if (now - clockStart < static_cast<double>(clockLimit)) return false;
    anyWallClockCapHit = true;
    searchComplete = false;
    AddCapHit(Str("wallClockMs"), clockLimit, clockLimit);
    AddApproximation(Str("APPROXIMATE_TIMEOUT"), Str("allMeals"), false, 0, false, 0,
                     Str("monotonic solve deadline reached; optimality not proven"));
    return true;
  }

  void Init(Arena* arena, Str algo) {
    algorithm = algo;
    searchComplete = false;
    for (usize i = 0; i < 3; ++i) {
      hasMealEnum[i] = false;
      candidatesEnumerated[i] = 0;
    }
    hasNodesEvaluated = false;
    nodesEvaluated = 0;
    hasStatesEvaluated = false;
    statesEvaluated = 0;
    capsHit.Init(arena);
    approximations.Init(arena);
    anyCandidateCapHit = false;
    anyDpCapHit = false;
    anyNodeCapHit = false;
    anyWallClockCapHit = false;
    clockEnabled = false;
    clockStart = 0.0;
    clockLast = 0.0;
    clockLimit = 0;
  }

  void AddCapHit(Str limitName, i64 limitVal, i64 obsVal, Str mealName = Str()) {
    for (usize i = 0; i < capsHit.Size(); ++i) {
      if (capsHit[i].limit.Equals(limitName) &&
          ((!capsHit[i].hasMeal && mealName.Empty()) ||
           (capsHit[i].hasMeal && capsHit[i].meal.Equals(mealName)))) {
        if (obsVal > capsHit[i].observed) {
          capsHit[i].observed = obsVal;
        }
        return;
      }
    }
    CapHitRecord rec;
    rec.limit = limitName;
    rec.limitValue = limitVal;
    rec.observed = obsVal;
    rec.hasMeal = !mealName.Empty();
    rec.meal = mealName;
    capsHit.Push(rec);
  }

  void AddApproximation(Str kind, Str scope, bool hasVal, i64 val, bool hasLim, i64 lim,
                        Str detail) {
    for (usize i = 0; i < approximations.Size(); ++i) {
      if (approximations[i].kind.Equals(kind) && approximations[i].scope.Equals(scope)) {
        return;
      }
    }
    ApproxRecord rec;
    rec.kind = kind;
    rec.scope = scope;
    rec.hasValue = hasVal;
    rec.value = val;
    rec.hasLimit = hasLim;
    rec.limit = lim;
    rec.detail = detail;
    approximations.Push(rec);
  }
};

// 拼接 JSON 错误定位路径
const char* SubPath(char* buffer, usize capacity, const char* base, const char* key) {
  usize cursor = 0;
  while (*base != '\0' && cursor + 1 < capacity) {
    buffer[cursor++] = *base++;
  }
  if (cursor + 1 < capacity) {
    buffer[cursor++] = '.';
  }
  while (*key != '\0' && cursor + 1 < capacity) {
    buffer[cursor++] = *key++;
  }
  buffer[cursor] = '\0';
  return buffer;
}

// 非负整数四舍五入除法：round_half_up(value, divisor) = floor((2*value + divisor) / (2*divisor))
i64 RoundHalfUp(i64 value, i64 divisor) { return (2 * value + divisor) / (2 * divisor); }

// 将餐次掩码映射为餐次下标（0=breakfast, 1=lunch, 2=dinner）
i64 MealIndexFromMask(i64 mask) {
  if (mask == kMealBreakfast) {
    return 0;
  }
  if (mask == kMealLunch) {
    return 1;
  }
  return 2;
}

// 获取指定餐次下标的餐次营养参考目标
MacroTargets MealTargetOf(const PlanTargetSnapshot& target, i64 index) {
  if (index == 0) {
    return target.mealBreakfast;
  }
  if (index == 1) {
    return target.mealLunch;
  }
  return target.mealDinner;
}

// 单项营养素加权相对偏差（单位：bp，1 bp = 0.01%）：
//   term = round_half_up(|known - target| * 10000 * weightPermille, target * 1000)
i64 WeightedTerm(i64 known, i64 targetValue, i64 weight) {
  // 目标 <= 0（目标缺失或配置为 0）时该营养素退出偏差考核：缺的是“目标”而非“摄入”，
  // 不把摄入相对 0 的差值计入总分；目标本身是否可用由 target 快照与 TargetUnavailable 负责。
  if (targetValue <= 0) {
    return 0;
  }
  const i64 difference = known >= targetValue ? known - targetValue : targetValue - known;
  return RoundHalfUp(difference * 10000 * weight, targetValue * 1000);
}

// 计算四项核心营养素加权偏差总和（契约 §10 nutritionDeviationBp）
i64 DeviationBp(const MacroTargets& targetValue, const NutritionValues& known,
                const DeviationWeights& weights) {
  // 未知摄入（has*=false）按“无数据”跳过而非当作 0；完整性由 NutritionValues.Complete() 单独
  // 表达，词典序中 incomplete 方案恒劣于 complete 方案（见 IsPlanBetterForStrategy）。
  i64 total = 0;
  if (known.hasEnergy) {
    total += WeightedTerm(known.energyKcal, targetValue.energyKcal, weights.energy);
  }
  if (known.hasProtein) {
    total += WeightedTerm(known.proteinDg, targetValue.proteinDg, weights.protein);
  }
  if (known.hasFat) {
    total += WeightedTerm(known.fatDg, targetValue.fatDg, weights.fat);
  }
  if (known.hasCarb) {
    total += WeightedTerm(known.carbDg, targetValue.carbDg, weights.carb);
  }
  return total;
}

// 累加营养素数值并传播完整性布尔位：完整性按位与（任一分量未知即整体未知），未知分量数值
// 贡献按 0 累加，因此 sums 数值仅在 Complete() 为真时可整体采信（known_sums 比较口径的前提）。
void AddNutrition(NutritionValues* sum, const NutritionValues& value) {
  sum->hasEnergy = sum->hasEnergy && value.hasEnergy;
  sum->hasProtein = sum->hasProtein && value.hasProtein;
  sum->hasFat = sum->hasFat && value.hasFat;
  sum->hasCarb = sum->hasCarb && value.hasCarb;
  sum->energyKcal += value.energyKcal;
  sum->proteinDg += value.proteinDg;
  sum->fatDg += value.fatDg;
  sum->carbDg += value.carbDg;
}

// 初始化全零且完整的营养素累加器
void InitNutritionSum(NutritionValues* sum) {
  sum->hasEnergy = true;
  sum->hasProtein = true;
  sum->hasFat = true;
  sum->hasCarb = true;
  sum->energyKcal = 0;
  sum->proteinDg = 0;
  sum->fatDg = 0;
  sum->carbDg = 0;
}

// 检查单个 dishId 在指定餐次与窗口下是否命中售罄规则
bool IsDishSoldOut(const LockSet& locks, i64 mealMask, Str windowId, Str dishId) {
  for (usize i = 0; i < locks.soldOut.Size(); ++i) {
    const SoldOutRule& rule = locks.soldOut[i];
    if ((rule.mealMask & mealMask) == 0) {
      continue;
    }
    if (rule.hasWindow && !rule.windowId.Equals(windowId)) {
      continue;
    }
    if (rule.hasDish && !rule.dishId.Equals(dishId)) {
      continue;
    }
    return true;
  }
  return false;
}

// 检查报价单位（含单品、固定套餐、规则展开套餐）是否售罄：
//   * 若报价关联的主 dishId 售罄，则该报价不可选；
//   * 若报价为套餐（固定或规则展开），只要其任一子组件单品在该窗口/餐次售罄，整个套餐连带不可选。
bool IsOfferSoldOut(const LockSet& locks, i64 mealMask, const OfferRecord& offer) {
  if (IsDishSoldOut(locks, mealMask, offer.windowId, offer.dishId)) {
    return true;
  }
  for (usize c = 0; c < offer.components.Size(); ++c) {
    if (IsDishSoldOut(locks, mealMask, offer.windowId, offer.components[c].dishId)) {
      return true;
    }
  }
  return false;
}

bool WindowServesMeal(const WindowRecord& window, i64 mealMask) {
  return (window.mealMask & mealMask) != 0;
}

bool OfferServesMeal(const OfferRecord& offer, i64 mealMask) {
  return (offer.mealMask & mealMask) != 0;
}

// 子串匹配辅助函数：用于判断菜品名称是否包含用户偏好口味关键词
bool ContainsText(Str haystack, Str needle) {
  if (needle.size == 0 || needle.size > haystack.size) {
    return false;
  }
  for (usize i = 0; i + needle.size <= haystack.size; ++i) {
    bool equal = true;
    for (usize k = 0; k < needle.size; ++k) {
      if (haystack.data[i + k] != needle.data[k]) {
        equal = false;
        break;
      }
    }
    if (equal) {
      return true;
    }
  }
  return false;
}

// 在静态报价与规则展开报价中按 offerId 查找报价记录
const OfferRecord* FindOfferAnywhere(const Catalog& catalog, Str offerId) {
  for (usize i = 0; i < catalog.offers.Size(); ++i) {
    if (catalog.offers[i].offerId.Equals(offerId)) {
      return &catalog.offers[i];
    }
  }
  for (usize i = 0; i < catalog.expandedComboOffers.Size(); ++i) {
    if (catalog.expandedComboOffers[i].offerId.Equals(offerId)) {
      return &catalog.expandedComboOffers[i];
    }
  }
  return nullptr;
}

// 计算单个报价单位的口味偏好得分：
//   * 对单品或固定套餐：若主 DishRecord 名称命中任一口味词，计 1 分；
//   * 对规则展开套餐（或无直接主菜名的套餐）：遍历其底层单品组件，每个命中任一口味词的组件计其份数分。
i64 ComputeOfferPreferenceScore(const Catalog& catalog, const OfferRecord& offer,
                                const Vec<Str>& tastes) {
  if (tastes.Empty()) {
    return 0;
  }
  if (!offer.isExpandedRule) {
    const DishRecord* dish = FindDish(catalog, offer.dishId);
    if (dish != nullptr) {
      for (usize t = 0; t < tastes.Size(); ++t) {
        if (ContainsText(dish->name, tastes[t])) {
          return 1;
        }
      }
      if (!offer.isCombo) {
        return 0;
      }
    }
  }
  i64 score = 0;
  for (usize c = 0; c < offer.components.Size(); ++c) {
    const DishRecord* compDish = FindDish(catalog, offer.components[c].dishId);
    if (compDish == nullptr) {
      continue;
    }
    for (usize t = 0; t < tastes.Size(); ++t) {
      if (ContainsText(compDish->name, tastes[t])) {
        score += offer.components[c].count;
        break;
      }
    }
  }
  return score;
}

// 将 OfferRecord 转化为选入餐次的 PlannedItem
PlannedItem MakePlannedItem(ExecContext& ctx, const Catalog& catalog, const OfferRecord& offer,
                            const Vec<Str>& tastes, bool locked) {
  PlannedItem item;
  item = PlannedItem{};
  item.offerId = offer.offerId;
  item.dishId = offer.dishId;
  item.windowId = offer.windowId;
  item.isHalf = offer.isHalf;
  item.portionCode = offer.isHalf ? Str("half") : Str("full");
  // 价格/营养取目录快照：priceKnown=false 时 priceCents 不参与任何累计（序列化为 null，
  // “未知价”与“0 元”是不同语义）；estimated 为报价或菜品任一标记估算即置位。
  item.priceKnown = offer.priceKnown;
  item.priceCents = OfferPriceCents(offer);
  item.nutrition = OfferNutrition(catalog, offer);
  const DishRecord* dish = FindDish(catalog, offer.dishId);
  item.hasCategory = dish != nullptr && dish->hasCategory;
  if (item.hasCategory) {
    item.category = dish->category;
  }
  item.estimated = offer.estimated || (dish != nullptr && dish->estimated);
  item.locked = locked;
  item.isCombo = offer.isCombo;
  item.riceDish = offer.riceDish;
  item.riceIncluded = offer.riceIncluded;
  item.preferenceMatchCount = ComputeOfferPreferenceScore(catalog, offer, tastes);
  item.components.Init(&ctx.Memory());
  for (usize c = 0; c < offer.components.Size(); ++c) {
    item.components.Push(offer.components[c]);
  }
  return item;
}

// 对单餐内的 items 按 offerId 的 UTF-8 字节序升序排列（保持输出确定性，并与 T02 v2 回归顺序一致）
void SortMealItemsByOfferId(MealPlan* meal) {
  for (usize i = 1; i < meal->items.Size(); ++i) {
    const PlannedItem value = meal->items[i];
    usize j = i;
    while (j > 0 && meal->items[j - 1].offerId.Compare(value.offerId) > 0) {
      meal->items[j] = meal->items[j - 1];
      --j;
    }
    meal->items[j] = value;
  }
}

// 组件 dishId 已在入口校验为唯一；套餐 count 表示该单品的真实份数。
// 每餐最多 8 个购买项、组件 count<=10，三餐同一单品最多 240 份，使用 i64 保持乘积与和精确。
i64 CountDishInItem(const PlannedItem& item, Str dishId) {
  if (item.components.Empty()) {
    return item.dishId.Equals(dishId) ? 1 : 0;
  }
  for (usize c = 0; c < item.components.Size(); ++c) {
    if (item.components[c].dishId.Equals(dishId)) {
      return item.components[c].count;
    }
  }
  return 0;
}

// 两个购买项间的重复对数 = 各底层单品频次的内积，不展开实例，也不依赖目录顺序。
i64 CrossItemRepeatedPairs(const PlannedItem& lhs, const PlannedItem& rhs) {
  if (lhs.components.Empty()) {
    return CountDishInItem(rhs, lhs.dishId);
  }
  i64 pairs = 0;
  for (usize c = 0; c < lhs.components.Size(); ++c) {
    const ComboComponent& comp = lhs.components[c];
    pairs += comp.count * CountDishInItem(rhs, comp.dishId);
  }
  return pairs;
}

// 项内 C(count,2) 加上每对不同购买项的频次内积，恰好覆盖单餐的全部重复对。
i64 MealRepeatedPairs(const MealPlan& meal) {
  i64 pairs = 0;
  for (usize i = 0; i < meal.items.Size(); ++i) {
    const PlannedItem& item = meal.items[i];
    for (usize c = 0; c < item.components.Size(); ++c) {
      const i64 count = item.components[c].count;
      pairs += count * (count - 1) / 2;
    }
    for (usize j = 0; j < i; ++j) {
      pairs += CrossItemRepeatedPairs(item, meal.items[j]);
    }
  }
  return pairs;
}

i64 CrossMealRepeatedPairs(const MealPlan& lhs, const MealPlan& rhs) {
  i64 pairs = 0;
  for (usize i = 0; i < lhs.items.Size(); ++i) {
    for (usize j = 0; j < rhs.items.Size(); ++j) {
      pairs += CrossItemRepeatedPairs(lhs.items[i], rhs.items[j]);
    }
  }
  return pairs;
}

// 计算单餐的营养总和、价格总和、估算标志与组件级多样性统计
void FinalizeMealPlanMetrics(const Catalog& catalog, MealPlan* meal) {
  SortMealItemsByOfferId(meal);
  InitNutritionSum(&meal->sums);
  meal->nutritionComplete = true;
  meal->priceComplete = true;
  meal->estimatedData = false;
  meal->lockedUnknownNutrition = false;
  meal->knownPriceCents = 0;
  meal->preferenceScore = 0;
  meal->categoryMask = 0;
  meal->categoryCoverage = 0;
  meal->unknownCategoryCount = 0;
  meal->repeatedDishCount = 0;

  for (usize i = 0; i < meal->items.Size(); ++i) {
    const PlannedItem& item = meal->items[i];
    AddNutrition(&meal->sums, item.nutrition);
    if (!item.nutrition.Complete() && item.locked) {
      meal->lockedUnknownNutrition = true;
    }
    if (item.estimated) {
      meal->estimatedData = true;
    }
    if (!item.priceKnown) {
      meal->priceComplete = false;
    } else {
      meal->knownPriceCents += item.priceCents;
    }
    meal->preferenceScore += item.preferenceMatchCount;

    if (item.components.Empty()) {
      const u32 bit = CategoryBitFromName(item.category, item.hasCategory);
      if (bit == 0) {
        ++meal->unknownCategoryCount;
      } else {
        meal->categoryMask |= bit;
      }
    } else {
      for (usize c = 0; c < item.components.Size(); ++c) {
        const ComboComponent& comp = item.components[c];
        const DishRecord* compDish = FindDish(catalog, comp.dishId);
        const bool hasCat = compDish != nullptr && compDish->hasCategory;
        const Str catName = hasCat ? compDish->category : Str();
        const u32 bit = CategoryBitFromName(catName, hasCat);
        for (i64 q = 0; q < comp.count; ++q) {
          if (bit == 0) {
            ++meal->unknownCategoryCount;
          } else {
            meal->categoryMask |= bit;
          }
        }
      }
    }
  }

  meal->repeatedDishCount = MealRepeatedPairs(*meal);
  meal->categoryCoverage = PopCountU32(meal->categoryMask);
  meal->nutritionComplete = meal->sums.Complete();
}

// 检查在当前单餐已选列表 items 中，再加入新报价 candidateOffer 是否满足单餐组合相容性规则：
//   1. 同一自动选购的 offerId 在同一餐内不重复选取（锁定项已在初始阶段按 lock.quantity 放入）；
//   2. 含饭互斥规则（契约 §3 / T04 要求 2）：
//      - 若餐次内已有任一含饭套餐（riceIncluded=true），则不得再加入独立米饭（riceDish=true）或第二个含饭套餐；
//      - 反之，若餐次内已有独立米饭（riceDish=true），则不得再加入含饭套餐（riceIncluded=true）；
//   3. 套餐组件不重复规则：
//      - 当加入套餐（isCombo=true）或已有套餐时，新报价的底层单品组件不得与餐次内已有项目的组件发生单品冲突
//        （注：两个独立单品如整份米饭 offer-rice-full 与半份米饭 offer-rice-half 均非套餐，按 T02 v2 基线允许共存）。
bool IsOfferCompatibleWithMealItems(const Vec<PlannedItem>& currentItems,
                                    const OfferRecord& candidateOffer) {
  for (usize i = 0; i < currentItems.Size(); ++i) {
    const PlannedItem& existing = currentItems[i];
    if (existing.offerId.Equals(candidateOffer.offerId)) {
      return false;
    }
    if (existing.riceIncluded && (candidateOffer.riceDish || candidateOffer.riceIncluded)) {
      return false;
    }
    if (candidateOffer.riceIncluded && (existing.riceDish || existing.riceIncluded)) {
      return false;
    }
    if (existing.isCombo || candidateOffer.isCombo) {
      for (usize c1 = 0; c1 < existing.components.Size(); ++c1) {
        for (usize c2 = 0; c2 < candidateOffer.components.Size(); ++c2) {
          if (existing.components[c1].dishId.Equals(candidateOffer.components[c2].dishId)) {
            return false;
          }
        }
      }
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// 层一（Layer 1）：合法单餐候选集生成与窗口/锁定前置校验
// ---------------------------------------------------------------------------

// 单餐候选集合结构（保存某一规划餐次枚举出的全部合法单餐方案及统计元数据）
struct MealCandidateSet {
  i64 mealMask;
  i64 mealIndex;
  Str mealName;
  bool windowLocked;
  Vec<MealPlan> candidates;
  i64 totalEligibleOffersCount;
  i64 incompleteNutritionOffersCount;
  bool candidateCapHit;
  i64 observedBeforeCap;
};

// 收集某一窗口在指定餐次下可供自动新增的合法报价列表（已按 offerId UTF-8 升序排列）
void CollectWindowEligibleOffers(ExecContext& ctx, const Catalog& catalog, const LockSet& locks,
                                 i64 mealMask, Str windowId,
                                 const Vec<PlannedItem>& lockedItems,
                                 Vec<const OfferRecord*>* outEligible,
                                 i64* totalOfferSeen,
                                 i64* incompleteNutSeen, SearchTracker* tracker) {
  outEligible->Init(&ctx.Memory());
  // 静态报价与规则展开报价合并为同一下标序列遍历（各自保持目录顺序）；资格判定只依赖
  // 目录内容、售罄与已锁定集合，与遍历先后无关。
  const usize staticCount = catalog.offers.Size();
  const usize expandedCount = catalog.expandedComboOffers.Size();
  const usize totalCount = staticCount + expandedCount;

  for (usize idx = 0; idx < totalCount; ++idx) {
    if (tracker->Stop(ctx)) return;
    const OfferRecord& offer = (idx < staticCount)
                                   ? catalog.offers[idx]
                                   : catalog.expandedComboOffers[idx - staticCount];
    if (!OfferServesMeal(offer, mealMask)) {
      continue;
    }
    if (!offer.windowId.Equals(windowId)) {
      continue;
    }
    if (IsOfferSoldOut(locks, mealMask, offer)) {
      continue;
    }
    *totalOfferSeen += 1;
    const NutritionValues nut = OfferNutrition(catalog, offer);
    if (!nut.Complete()) {
      // 契约 §9 L9：未知营养且未锁定的报价不得进入自动新增候选池
      *incompleteNutSeen += 1;
      continue;
    }
    // 已被锁定入餐的同一 offerId 不再作为自由选购项重复加入
    bool alreadyLocked = false;
    for (usize k = 0; k < lockedItems.Size(); ++k) {
      if (tracker->Stop(ctx)) return;
      if (lockedItems[k].offerId.Equals(offer.offerId)) {
        alreadyLocked = true;
        break;
      }
    }
    if (alreadyLocked) {
      continue;
    }
    outEligible->Push(&offer);
  }

  // 按 offerId 的 UTF-8 字节序升序排列，保证跨窗口与套餐展开后的枚举顺序完全确定
  for (usize i = 1; i < outEligible->Size(); ++i) {
    if (tracker->Stop(ctx)) return;
    const OfferRecord* cur = (*outEligible)[i];
    usize j = i;
    while (j > 0 && (*outEligible)[j - 1]->offerId.Compare(cur->offerId) > 0) {
      if (tracker->Stop(ctx)) return;
      (*outEligible)[j] = (*outEligible)[j - 1];
      --j;
    }
    (*outEligible)[j] = cur;
  }
}

// 递归枚举单窗口内固定附加项数 targetExtraCount 的所有相容报价子集
struct SubsetEnumContext {
  ExecContext* ctx;
  const Catalog* catalog;
  const Vec<Str>* tastes;
  i64 mealMask;
  Str mealName;
  Str windowId;
  bool windowLocked;
  i64 windowOfferCount;
  i64 windowIncompleteCount;
  const Vec<PlannedItem>* baseLockedItems;
  const Vec<const OfferRecord*>* eligibleOffers;
  i64 maxCandidatesCap;
  MealCandidateSet* outSet;
  Vec<PlannedItem> workingItems;
  SearchTracker* tracker;
};

// 深度优先组合枚举：从 startIdx 起依次选取 remainingPick 个相容报价，组合按候选序升序天然去重；
// observedBeforeCap 统计截断前完整生成的子集总数，供 capsHit.observed 透明报告真实枚举量。
void RecurseMealOfferSubsets(SubsetEnumContext* env, usize startIdx, i64 remainingPick) {
  if (env->tracker->Stop(*env->ctx)) return;
  if (remainingPick == 0) {
    env->outSet->observedBeforeCap += 1;
    if (static_cast<i64>(env->outSet->candidates.Size()) >= env->maxCandidatesCap) {
      env->outSet->candidateCapHit = true;
      return;
    }
    MealPlan cand = MealPlan{};
    cand.mealName = env->mealName;
    cand.mealMask = env->mealMask;
    cand.windowId = env->windowId;
    cand.windowLocked = env->windowLocked;
    cand.items.Init(&env->ctx->Memory());
    for (usize i = 0; i < env->workingItems.Size(); ++i) {
      if (env->tracker->Stop(*env->ctx)) return;
      cand.items.Push(env->workingItems[i]);
    }
    cand.candidateCount = env->windowOfferCount;
    cand.incompleteNutritionCount = env->windowIncompleteCount;
    cand.limitReached = false;
    FinalizeMealPlanMetrics(*env->catalog, &cand);
    env->outSet->candidates.Push(cand);
    env->tracker->candidatesEnumerated[MealIndexFromMask(env->mealMask)] =
        static_cast<i64>(env->outSet->candidates.Size());
    return;
  }

  const usize totalEligible = env->eligibleOffers->Size();
  const usize need = static_cast<usize>(remainingPick);
  if (startIdx + need > totalEligible) {
    return;
  }

  for (usize i = startIdx; i + need <= totalEligible; ++i) {
    if (env->tracker->Stop(*env->ctx)) return;
    const OfferRecord* offer = (*env->eligibleOffers)[i];
    if (!IsOfferCompatibleWithMealItems(env->workingItems, *offer)) {
      continue;
    }
    PlannedItem item = MakePlannedItem(*env->ctx, *env->catalog, *offer, *env->tastes, false);
    env->workingItems.Push(item);
    RecurseMealOfferSubsets(env, i + 1, remainingPick - 1);
    // 弹出末尾刚加入的元素以回溯
    Vec<PlannedItem> restored;
    restored.Init(&env->ctx->Memory());
    for (usize k = 0; k + 1 < env->workingItems.Size(); ++k) {
      if (env->tracker->Stop(*env->ctx)) return;
      restored.Push(env->workingItems[k]);
    }
    env->workingItems = restored;
  }
}

// 枚举某一餐次（mealMask）下的全部合法单餐候选方案（Layer 1 共用入口）：
//   * 校验该餐次的 windowLocks 与 itemLocks 是否存在失效或冲突（若冲突则置 *lockConflict=true）；
//   * 在每个合法窗口内，以锁定项为必选基底，按选购数量 k = minExtra .. maxExtra 字典序枚举全部合法子集；
//   * 若生成候选总数超过 limits.maxMealCandidatesPerMeal，则截断并记录 capsHit 与 APPROXIMATE_CANDIDATES。
bool EnumerateMealCandidates(ExecContext& ctx, const Catalog& catalog, const LockSet& locks,
                             const PlannerConfigInput& config, const Vec<Str>& tastes,
                             i64 mealMask, SearchTracker* tracker, MealCandidateSet* outSet,
                             bool* lockConflict) {
  const i64 mealIndex = MealIndexFromMask(mealMask);
  outSet->mealMask = mealMask;
  outSet->mealIndex = mealIndex;
  outSet->mealName = MealNameFromMask(mealMask);
  outSet->windowLocked = locks.hasWindowLock[mealIndex];
  outSet->candidates.Init(&ctx.Memory());
  outSet->totalEligibleOffersCount = 0;
  outSet->incompleteNutritionOffersCount = 0;
  outSet->candidateCapHit = false;
  outSet->observedBeforeCap = 0;
  tracker->hasMealEnum[mealIndex] = true;
  tracker->candidatesEnumerated[mealIndex] = 0;

  // 第一步：校验本餐次的 itemLocks 是否全部存在、供应本餐且未售罄，并检查是否锁定在同一窗口。
  // LockConflict 与 NoFeasible 是不同结局：锁定项与目录/售罄/其他锁定的真实矛盾报 LockConflict；
  // 输入自洽但无可行方案才报 NoFeasible，二者不可互换。
  Str requiredItemLockWindow;
  i64 totalLockedQuantity = 0;
  Vec<PlannedItem> lockedItems;
  lockedItems.Init(&ctx.Memory());

  for (usize i = 0; i < locks.itemLocks.Size(); ++i) {
    if (tracker->Stop(ctx)) return !ctx.Failed();
    const ItemLock& lock = locks.itemLocks[i];
    if ((lock.mealMask & mealMask) == 0) {
      continue;
    }
    const OfferRecord* found = FindOfferAnywhere(catalog, lock.offerId);
    if (found == nullptr || !OfferServesMeal(*found, mealMask) ||
        IsOfferSoldOut(locks, mealMask, *found)) {
      *lockConflict = true;
      return true;
    }
    if (requiredItemLockWindow.Empty()) {
      requiredItemLockWindow = found->windowId;
    } else if (!requiredItemLockWindow.Equals(found->windowId)) {
      // 契约 §9 L8：同一餐次只能在一个窗口就餐，跨窗口锁定多个 item 构成锁定冲突
      *lockConflict = true;
      return true;
    }
    totalLockedQuantity += lock.quantity;
    if (totalLockedQuantity > config.maxItemsPerMeal) {
      *lockConflict = true;
      return true;
    }
    PlannedItem item = MakePlannedItem(ctx, catalog, *found, tastes, true);
    // 锁定份数按 quantity 展开为等份数 item（每份 locked=true），份数计入 maxItemsPerMeal 配额。
    for (i64 q = 0; q < lock.quantity; ++q) {
      if (tracker->Stop(ctx)) return !ctx.Failed();
      // 检查多个锁定项之间是否违反含饭互斥规则
      for (usize prev = 0; prev < lockedItems.Size(); ++prev) {
        if (tracker->Stop(ctx)) return !ctx.Failed();
        if ((lockedItems[prev].riceIncluded && (item.riceDish || item.riceIncluded)) ||
            (item.riceIncluded && (lockedItems[prev].riceDish || lockedItems[prev].riceIncluded))) {
          *lockConflict = true;
          return true;
        }
      }
      lockedItems.Push(item);
    }
  }

  // 第二步：确定本餐次允许就餐的窗口列表（结合 windowLocks 与 itemLocks 所在窗口）
  Vec<Str> validWindows;
  validWindows.Init(&ctx.Memory());
  if (locks.hasWindowLock[mealIndex]) {
    const Str lockedWinId = locks.windowLockId[mealIndex];
    const WindowRecord* winRec = FindWindow(catalog, lockedWinId);
    // 若锁定的窗口不存在，或已被整窗售罄（hasDish=false 命中该窗口），则判 LockConflict
    if (winRec == nullptr || IsDishSoldOut(locks, mealMask, lockedWinId, Str())) {
      *lockConflict = true;
      return true;
    }
    if (!requiredItemLockWindow.Empty() && !requiredItemLockWindow.Equals(lockedWinId)) {
      *lockConflict = true;
      return true;
    }
    // 注：若锁定窗口存在但该窗口本身不供应本餐次（如早餐锁了仅午晚餐营业的窗口），
    // 为保持与 T02 v2 单元测试 MutateNoFeasible 的兼容，不置 lockConflict，而令可用窗口为空从而返回 NoFeasible。
    if (WindowServesMeal(*winRec, mealMask)) {
      validWindows.Push(lockedWinId);
    }
  } else if (!requiredItemLockWindow.Empty()) {
    const WindowRecord* winRec = FindWindow(catalog, requiredItemLockWindow);
    if (winRec != nullptr && WindowServesMeal(*winRec, mealMask)) {
      validWindows.Push(requiredItemLockWindow);
    }
  } else {
    for (usize w = 0; w < catalog.windows.Size(); ++w) {
      if (tracker->Stop(ctx)) return !ctx.Failed();
      if (WindowServesMeal(catalog.windows[w], mealMask)) {
        validWindows.Push(catalog.windows[w].windowId);
      }
    }
  }

  // 第三步：遍历每个可用窗口，收集自动候选报价并枚举 1..maxItemsPerMeal 组合
  for (usize w = 0; w < validWindows.Size(); ++w) {
    if (tracker->Stop(ctx)) return !ctx.Failed();
    const Str winId = validWindows[w];
    Vec<const OfferRecord*> eligibleOffers;
    i64 winOfferSeen = 0;
    i64 winIncompleteSeen = 0;
    CollectWindowEligibleOffers(ctx, catalog, locks, mealMask, winId, lockedItems, &eligibleOffers,
                                &winOfferSeen, &winIncompleteSeen, tracker);
    outSet->totalEligibleOffersCount += winOfferSeen;
    outSet->incompleteNutritionOffersCount += winIncompleteSeen;

    const i64 remainingSlots = config.maxItemsPerMeal - static_cast<i64>(lockedItems.Size());
    if (remainingSlots < 0) {
      continue;
    }
    const i64 minExtra = lockedItems.Empty() ? 1 : 0;
    const i64 maxExtra = remainingSlots < static_cast<i64>(eligibleOffers.Size())
                             ? remainingSlots
                             : static_cast<i64>(eligibleOffers.Size());

    SubsetEnumContext subEnv;
    subEnv.ctx = &ctx;
    subEnv.tracker = tracker;
    subEnv.catalog = &catalog;
    subEnv.tastes = &tastes;
    subEnv.mealMask = mealMask;
    subEnv.mealName = outSet->mealName;
    subEnv.windowId = winId;
    subEnv.windowLocked = outSet->windowLocked;
    subEnv.windowOfferCount = winOfferSeen;
    subEnv.windowIncompleteCount = winIncompleteSeen;
    subEnv.baseLockedItems = &lockedItems;
    subEnv.eligibleOffers = &eligibleOffers;
    subEnv.maxCandidatesCap = config.limits.maxMealCandidatesPerMeal;
    subEnv.outSet = outSet;
    subEnv.workingItems.Init(&ctx.Memory());
    for (usize k = 0; k < lockedItems.Size(); ++k) {
      if (tracker->Stop(ctx)) return !ctx.Failed();
      subEnv.workingItems.Push(lockedItems[k]);
    }

    for (i64 extraCount = minExtra; extraCount <= maxExtra; ++extraCount) {
      if (tracker->Stop(ctx)) return !ctx.Failed();
      RecurseMealOfferSubsets(&subEnv, 0, extraCount);
    }
  }

  // 将每餐枚举出的合法单餐候选数同步写入 search 跟踪器（meal.candidateCount 保留该窗口可用报价数）
  const i64 enumeratedCount = static_cast<i64>(outSet->candidates.Size());
  for (usize i = 0; i < outSet->candidates.Size(); ++i) {
    if (tracker->Stop(ctx)) return !ctx.Failed();
    outSet->candidates[i].limitReached = outSet->candidateCapHit;
  }
  tracker->hasMealEnum[mealIndex] = true;
  tracker->candidatesEnumerated[mealIndex] = enumeratedCount;

  if (outSet->candidateCapHit) {
    tracker->anyCandidateCapHit = true;
    tracker->AddCapHit(Str("maxMealCandidatesPerMeal"), config.limits.maxMealCandidatesPerMeal,
                       outSet->observedBeforeCap, outSet->mealName);
    tracker->AddApproximation(Str("APPROXIMATE_CANDIDATES"), outSet->mealName, true,
                              enumeratedCount, true, config.limits.maxMealCandidatesPerMeal,
                              Str("single-meal candidate enumeration truncated at limit"));
  }
  return true;
}

// ---------------------------------------------------------------------------
// 全天方案汇总、planKey 生成与策略词典序比较器（契约 §10）
// ---------------------------------------------------------------------------

// planKey 是不透明稳定键：对规范 JSON 元组数组取 SHA-256，输出 "plan:" + 小写摘要。
// 元组结构：[[meal, windowId, [[offerId, quantity], ...]], ...]
struct PlanKeyItem {
  Str offerId;
  i64 quantity;
};

// 正式方案与 DP 终端共用同一规范元组序列化；仅接受既有合法 MealPlan。
bool WritePlanKeyRows(const Vec<MealPlan>& meals, Vec<PlanKeyItem>* pairs, TextBuffer* json) {
  JsonOut writer(json);
  writer.BeginArray();
  const i64 order[3] = {kMealBreakfast, kMealLunch, kMealDinner};
  for (usize o = 0; o < 3; ++o) {
    const MealPlan* meal = nullptr;
    for (usize m = 0; m < meals.Size(); ++m) {
      if (meals[m].mealMask == order[o]) {
        meal = &meals[m];
        break;
      }
    }
    if (meal == nullptr) {
      continue;
    }
    pairs->Clear();
    for (usize i = 0; i < meal->items.Size(); ++i) {
      bool merged = false;
      for (usize k = 0; k < pairs->Size(); ++k) {
        if ((*pairs)[k].offerId.Equals(meal->items[i].offerId)) {
          (*pairs)[k].quantity += 1;
          merged = true;
          break;
        }
      }
      if (!merged) {
        PlanKeyItem entry;
        entry.offerId = meal->items[i].offerId;
        entry.quantity = 1;
        if (!pairs->Push(entry)) return false;
      }
    }
    for (usize i = 1; i < pairs->Size(); ++i) {
      const PlanKeyItem value = (*pairs)[i];
      usize j = i;
      while (j > 0 && (*pairs)[j - 1].offerId.Compare(value.offerId) > 0) {
        (*pairs)[j] = (*pairs)[j - 1];
        --j;
      }
      (*pairs)[j] = value;
    }
    writer.BeginArray();
    writer.WriteString(meal->mealName);
    writer.WriteString(meal->windowId);
    writer.BeginArray();
    for (usize i = 0; i < pairs->Size(); ++i) {
      writer.BeginArray();
      writer.WriteString((*pairs)[i].offerId);
      writer.WriteNumber((*pairs)[i].quantity);
      writer.EndArray();
    }
    writer.EndArray();
    writer.EndArray();
  }
  writer.EndArray();
  return writer.Ok();
}

struct PlanKeyWorkspace {
  TextBuffer json;
  Vec<PlanKeyItem> pairs;
  TextBuffer key;

  void Init(Arena* arena) {
    json.Init(arena);
    pairs.Init(arena);
    key.Init(arena);
  }
};

bool BuildPlanKey(ExecContext& ctx, PlanCandidate* plan, PlanKeyWorkspace* workspace = nullptr) {
  PlanKeyWorkspace local;
  if (workspace == nullptr) {
    local.Init(&ctx.Memory());
    workspace = &local;
  }
  TextBuffer& json = workspace->json;
  Vec<PlanKeyItem>& pairs = workspace->pairs;
  json.size = 0;
  pairs.Clear();
  if (!WritePlanKeyRows(plan->meals, &pairs, &json)) {
    return false;
  }
  Sha256Digest digest;
  Sha256(json.data, json.size, &digest);
  char hex[65];
  Sha256ToHexLower(digest, hex);
  TextBuffer& key = workspace->key;
  key.size = 0;
  if (!key.Append("plan:") || !key.Append(hex)) {
    return false;
  }
  plan->planKey = key.View();
  return true;
}

// 保存评分结果时只复制小型餐次列表；底层候选只读，planKey 独立持有以免被工作缓冲覆盖。
bool StoreSearchIncumbent(const PlanCandidate& source, Str strategy,
                          PlanCandidate* target, TextBuffer* key) {
  Vec<MealPlan> meals = target->meals;
  Vec<Str> offeredAs = target->offeredAs;
  *target = source;
  target->meals = meals;
  target->meals.Clear();
  for (usize m = 0; m < source.meals.Size(); ++m) {
    if (!target->meals.Push(source.meals[m])) return false;
  }
  target->offeredAs = offeredAs;
  target->offeredAs.Clear();
  if (!target->offeredAs.Push(strategy)) return false;
  key->size = 0;
  if (!key->Append(source.planKey)) return false;
  target->planKey = key->View();
  target->strategy = strategy;
  return true;
}

// 汇总全天方案的营养偏差、分档 tier、价格完整性、预算状态、口味总分与底层单品多样性指标
bool EvaluateFullDayPlan(ExecContext& ctx, const Catalog& catalog, const PlanTargetSnapshot& target,
                         const PlannerConfigInput& config, const IntakeSummary& intake,
                         const SearchTracker& tracker, PlanCandidate* plan,
                         PlanKeyWorkspace* keyWorkspace = nullptr) {
  NutritionValues totalNut;
  InitNutritionSum(&totalNut);
  // 若当日已有 activeLogs 有效已吃记录，且全天目标按日目标考核，则把已知已吃营养并入全天总和
  if (intake.itemCount > 0) {
    totalNut.hasEnergy = intake.hasEnergy;
    totalNut.hasProtein = intake.hasProtein;
    totalNut.hasFat = intake.hasFat;
    totalNut.hasCarb = intake.hasCarb;
    totalNut.energyKcal = intake.energyKcal;
    totalNut.proteinDg = intake.proteinDg;
    totalNut.fatDg = intake.fatDg;
    totalNut.carbDg = intake.carbDg;
  }

  plan->knownPriceCents = 0;
  plan->priceComplete = true;
  plan->estimatedData = false;
  plan->lockedUnknownNutrition = false;
  plan->preferenceScore = 0;
  plan->approxCandidates = tracker.anyCandidateCapHit || tracker.algorithm.Equals("greedy");
  plan->approxDiscretization = tracker.anyDpCapHit;
  plan->approxTimeout = tracker.anyWallClockCapHit;
  plan->limitReached = !tracker.capsHit.Empty();

  bool allMealsNutComplete = totalNut.Complete();
  u32 dayCatMask = 0;
  i64 dayUnknownCat = 0;
  i64 dayRepeated = 0;

  for (usize m = 0; m < plan->meals.Size(); ++m) {
    const MealPlan& meal = plan->meals[m];
    if (!meal.nutritionComplete) {
      allMealsNutComplete = false;
    }
    if (meal.lockedUnknownNutrition) {
      plan->lockedUnknownNutrition = true;
    }
    if (meal.estimatedData) {
      plan->estimatedData = true;
    }
    if (!meal.priceComplete) {
      plan->priceComplete = false;
    }
    plan->knownPriceCents += meal.knownPriceCents;
    plan->preferenceScore += meal.preferenceScore;
    dayRepeated += MealRepeatedPairs(meal);
    for (usize prev = 0; prev < m; ++prev) {
      dayRepeated += CrossMealRepeatedPairs(meal, plan->meals[prev]);
    }
    if (meal.limitReached) {
      plan->limitReached = true;
    }

    for (usize i = 0; i < meal.items.Size(); ++i) {
      const PlannedItem& item = meal.items[i];
      AddNutrition(&totalNut, item.nutrition);
      if (item.components.Empty()) {
        const u32 bit = CategoryBitFromName(item.category, item.hasCategory);
        if (bit == 0) {
          ++dayUnknownCat;
        } else {
          dayCatMask |= bit;
        }
      } else {
        for (usize c = 0; c < item.components.Size(); ++c) {
          const ComboComponent& comp = item.components[c];
          const DishRecord* compDish = FindDish(catalog, comp.dishId);
          const bool hasCat = compDish != nullptr && compDish->hasCategory;
          const Str catName = hasCat ? compDish->category : Str();
          const u32 bit = CategoryBitFromName(catName, hasCat);
          for (i64 q = 0; q < comp.count; ++q) {
            if (bit == 0) {
              ++dayUnknownCat;
            } else {
              dayCatMask |= bit;
            }
          }
        }
      }
    }
  }

  plan->categoryCoverage = PopCountU32(dayCatMask);
  plan->unknownCategoryCount = dayUnknownCat;
  plan->repeatedDishCount = dayRepeated;
  plan->nutritionComplete = allMealsNutComplete && totalNut.Complete();
  plan->deviationBp = DeviationBp(target.daily, totalNut, config.weights);
  plan->tier = config.weights.tierWidthBp > 0 ? (plan->deviationBp / config.weights.tierWidthBp) : 0;

  // 预算判定：以已知总支出（intake 已知支出 + 待选已知总价）与全天预算比较既定业务语义
  plan->overBudget = config.hasBudget &&
                     (!plan->priceComplete || !intake.priceComplete ||
                      (plan->knownPriceCents + intake.knownPriceCents > config.budgetCents));

  bool allMealsFilled = !plan->meals.Empty();
  for (usize m = 0; m < plan->meals.Size(); ++m) {
    if (plan->meals[m].items.Empty()) {
      allMealsFilled = false;
    }
  }
  plan->viable = allMealsFilled;
  return BuildPlanKey(ctx, plan, keyWorkspace);
}

// 比较两个方案的多样性（返回值 <0 表示 lhs 更优，>0 表示 rhs 更优，0 表示并列）：
//   * 类别覆盖数 categoryCoverage 越大越优；
//   * 重复菜对数 repeatedDishCount 越小越优；
//   * 未知类别数 unknownCategoryCount 越小越优。
int CompareDiversity(const PlanCandidate& lhs, const PlanCandidate& rhs) {
  if (lhs.categoryCoverage != rhs.categoryCoverage) {
    return lhs.categoryCoverage > rhs.categoryCoverage ? -1 : 1;
  }
  if (lhs.repeatedDishCount != rhs.repeatedDishCount) {
    return lhs.repeatedDishCount < rhs.repeatedDishCount ? -1 : 1;
  }
  if (lhs.unknownCategoryCount != rhs.unknownCategoryCount) {
    return lhs.unknownCategoryCount < rhs.unknownCategoryCount ? -1 : 1;
  }
  return 0;
}

// 比较两个方案的价格（返回值 <0 表示 lhs 更优）：价格完整优先，随后已知总价越小越优
int ComparePrice(const PlanCandidate& lhs, const PlanCandidate& rhs) {
  if (lhs.priceComplete != rhs.priceComplete) {
    return lhs.priceComplete ? -1 : 1;
  }
  if (lhs.knownPriceCents != rhs.knownPriceCents) {
    return lhs.knownPriceCents < rhs.knownPriceCents ? -1 : 1;
  }
  return 0;
}

// 契约 §10 策略词典序比较器：判断候选方案 lhs 在给定 strategy 下是否严格优于 rhs（返回 true 表示 lhs 更优）
//   优先级层次：
//     1) 预算可行性：若启用了预算，不超预算且价格完整的方案恒优于超预算/价格不完整方案；
//     2) 营养完整性：四项营养素完整的方案恒优于含未知营养的方案；
//     3) 策略主序：
//        - primary: deviationBp↑ -> Diversity -> preferenceScore↓ -> Price↑ -> planKey↑
//        - economy: tier↑ -> Price↑ -> Diversity -> preferenceScore↓ -> planKey↑
//        - taste:   tier↑ -> preferenceScore↓ -> Diversity -> Price↑ -> planKey↑
bool IsPlanBetterForStrategy(const PlanCandidate& lhs, const PlanCandidate& rhs, Str strategy,
                             bool hasBudget) {
  if (!rhs.viable) {
    return lhs.viable;
  }
  if (!lhs.viable) {
    return false;
  }
  if (hasBudget && lhs.overBudget != rhs.overBudget) {
    return !lhs.overBudget;
  }
  if (lhs.nutritionComplete != rhs.nutritionComplete) {
    return lhs.nutritionComplete;
  }

  if (strategy.Equals("economy")) {
    if (lhs.nutritionComplete && lhs.tier != rhs.tier) {
      return lhs.tier < rhs.tier;
    }
    const int priceCmp = ComparePrice(lhs, rhs);
    if (priceCmp != 0) {
      return priceCmp < 0;
    }
    const int divCmp = CompareDiversity(lhs, rhs);
    if (divCmp != 0) {
      return divCmp < 0;
    }
    if (lhs.preferenceScore != rhs.preferenceScore) {
      return lhs.preferenceScore > rhs.preferenceScore;
    }
  } else if (strategy.Equals("taste")) {
    if (lhs.nutritionComplete && lhs.tier != rhs.tier) {
      return lhs.tier < rhs.tier;
    }
    if (lhs.preferenceScore != rhs.preferenceScore) {
      return lhs.preferenceScore > rhs.preferenceScore;
    }
    const int divCmp = CompareDiversity(lhs, rhs);
    if (divCmp != 0) {
      return divCmp < 0;
    }
    const int priceCmp = ComparePrice(lhs, rhs);
    if (priceCmp != 0) {
      return priceCmp < 0;
    }
  } else {
    // primary 策略
    if (lhs.nutritionComplete && lhs.deviationBp != rhs.deviationBp) {
      return lhs.deviationBp < rhs.deviationBp;
    }
    const int divCmp = CompareDiversity(lhs, rhs);
    if (divCmp != 0) {
      return divCmp < 0;
    }
    if (lhs.preferenceScore != rhs.preferenceScore) {
      return lhs.preferenceScore > rhs.preferenceScore;
    }
    const int priceCmp = ComparePrice(lhs, rhs);
    if (priceCmp != 0) {
      return priceCmp < 0;
    }
  }

  return lhs.planKey.Compare(rhs.planKey) < 0;
}

// ---------------------------------------------------------------------------
// 算法一（greedy）：逐餐、逐项局部增益启发式与策略导向单餐选优
// ---------------------------------------------------------------------------
//
// 算法设计与复杂度说明：
//   1. 贪心算法不枚举全天跨餐笛卡尔积（不做 $C_1 \times C_2 \times C_3$ 组合），而是按餐次顺序
//      依次决策每一餐的方案。
//   2. 对每一餐，先尝试在每个可用窗口内从锁定项出发，每次选入一个使当前单餐参考目标营养偏差
//      下降最多的相容报价（与 T02 v2 逐项贪心基线保持一致）；同时在已枚举的层一合法单餐候选中，
//      按当前策略（primary / economy / taste）的局部评估准则挑出单餐最优候选。
//   3. 贪心本质上是局部启发式，无法保证跨餐营养互补或全天全局最优，因此：
//      - result.search.searchComplete 恒为 false；
//      - result.search.approximations 恒记录 APPROXIMATE_CANDIDATES（scope="allMeals",
//        detail="greedy per-meal local selection without full-day exhaustive search"）。

// 在单餐候选集 mealSet 中，按窗口逐项边际增益贪心（Marginal-Gain Item-by-Item Greedy）生成各窗口代表餐次方案：
//   * 对本餐每个出现过的窗口 windowId，先从该窗口包含锁定项的最小基础候选出发；
//   * 每次迭代追加 1 个与当前已选项相容、且使单餐参考目标营养偏差 DeviationBp(mealRef, sums) 下降最多的单品/套餐；
//   * 直至达到 maxItemsPerMeal 或继续加菜不再降低单餐营养偏差为止。
bool BuildWindowGreedyMealPlans(ExecContext& ctx, const Catalog& catalog,
                                const PlanTargetSnapshot& target, const PlannerConfigInput& config,
                                const MealCandidateSet& mealSet, bool enforceMealBudgetCap,
                                i64 mealBudgetCapCents, i64* nodesRemaining,
                                i64* nodesEvaluatedTotal, bool* nodeLimitHit,
                                Vec<MealPlan>* outWinPlans, SearchTracker* tracker) {
  outWinPlans->Init(&ctx.Memory());
  const MacroTargets mealRef = MealTargetOf(target, mealSet.mealIndex);

  // 收集本餐候选集中出现的不同窗口列表（保持枚举顺序）
  Vec<Str> windowIds;
  windowIds.Init(&ctx.Memory());
  for (usize i = 0; i < mealSet.candidates.Size(); ++i) {
    if (tracker->Stop(ctx)) return !ctx.Failed();
    const Str wId = mealSet.candidates[i].windowId;
    bool seen = false;
    for (usize k = 0; k < windowIds.Size(); ++k) {
      if (tracker->Stop(ctx)) return !ctx.Failed();
      if (windowIds[k].Equals(wId)) {
        seen = true;
        break;
      }
    }
    if (!seen) {
      windowIds.Push(wId);
    }
  }

  for (usize w = 0; w < windowIds.Size(); ++w) {
    if (tracker->Stop(ctx)) return !ctx.Failed();
    const Str winId = windowIds[w];
    // 收集该窗口下的单步原子候选（即仅包含锁定项或比锁定项多 1 项的候选），用于模拟逐项贪心加菜
    usize minSize = 999;
    for (usize i = 0; i < mealSet.candidates.Size(); ++i) {
      if (tracker->Stop(ctx)) return !ctx.Failed();
      if (mealSet.candidates[i].windowId.Equals(winId)) {
        if (mealSet.candidates[i].items.Size() < minSize) {
          minSize = mealSet.candidates[i].items.Size();
        }
      }
    }
    if (minSize == 999) {
      continue;
    }

    // 第 1 步：在项数为 minSize 的初始候选中挑出单餐偏差最小且满足预算上限的起点
    MealPlan currentPlan = MealPlan{};
    bool hasCurrent = false;
    i64 currentDev = 0;

    for (usize i = 0; i < mealSet.candidates.Size(); ++i) {
      if (tracker->Stop(ctx)) return !ctx.Failed();
      const MealPlan& cand = mealSet.candidates[i];
      if (!cand.windowId.Equals(winId) || cand.items.Size() != minSize) {
        continue;
      }
      // 节点预算口径：每完整评估一个候选消耗 1（maxSearchNodes 计数）；预算耗尽立即停止，
      // 未评估的候选不假装已评估，实际需求量由调用方汇总后写入 capsHit.observed。
      if (*nodesRemaining <= 0) {
        *nodeLimitHit = true;
        return true;
      }
      *nodesRemaining -= 1;
      *nodesEvaluatedTotal += 1;

      if (enforceMealBudgetCap && (!cand.priceComplete || cand.knownPriceCents > mealBudgetCapCents)) {
        continue;
      }
      const i64 dev = DeviationBp(mealRef, cand.sums, config.weights);
      if (!hasCurrent || dev < currentDev ||
          (dev == currentDev && cand.knownPriceCents < currentPlan.knownPriceCents)) {
        currentPlan = cand;
        currentDev = dev;
        hasCurrent = true;
      }
    }
    if (!hasCurrent) {
      continue;
    }

    // 第 2..maxItemsPerMeal 步：每次在包含当前已选集合且多 1 项的候选中，选能严格降低单餐偏差的最优扩展
    while (static_cast<i64>(currentPlan.items.Size()) < config.maxItemsPerMeal) {
      if (tracker->Stop(ctx)) return !ctx.Failed();
      const usize nextSize = currentPlan.items.Size() + 1;
      MealPlan bestNext = MealPlan{};
      bool foundBetter = false;
      i64 bestNextDev = currentDev;

      for (usize i = 0; i < mealSet.candidates.Size(); ++i) {
        if (tracker->Stop(ctx)) return !ctx.Failed();
        const MealPlan& cand = mealSet.candidates[i];
        if (!cand.windowId.Equals(winId) || cand.items.Size() != nextSize) {
          continue;
        }
        // 检查 cand.items 是否包含 currentPlan.items 的全部已选报价（作为单步增量超集）
        bool isSuperset = true;
        for (usize curIdx = 0; curIdx < currentPlan.items.Size(); ++curIdx) {
          if (tracker->Stop(ctx)) return !ctx.Failed();
          const Str needOffer = currentPlan.items[curIdx].offerId;
          i64 needCount = 0;
          for (usize c = 0; c < currentPlan.items.Size(); ++c) {
            if (tracker->Stop(ctx)) return !ctx.Failed();
            if (currentPlan.items[c].offerId.Equals(needOffer)) ++needCount;
          }
          i64 haveCount = 0;
          for (usize c = 0; c < cand.items.Size(); ++c) {
            if (tracker->Stop(ctx)) return !ctx.Failed();
            if (cand.items[c].offerId.Equals(needOffer)) ++haveCount;
          }
          if (haveCount < needCount) {
            isSuperset = false;
            break;
          }
        }
        if (!isSuperset) {
          continue;
        }

        if (*nodesRemaining <= 0) {
          *nodeLimitHit = true;
          break;
        }
        *nodesRemaining -= 1;
        *nodesEvaluatedTotal += 1;

        if (enforceMealBudgetCap &&
            (!cand.priceComplete || cand.knownPriceCents > mealBudgetCapCents)) {
          continue;
        }
        const i64 dev = DeviationBp(mealRef, cand.sums, config.weights);
        if (dev < bestNextDev ||
            (foundBetter && dev == bestNextDev && cand.knownPriceCents < bestNext.knownPriceCents)) {
          bestNext = cand;
          bestNextDev = dev;
          foundBetter = true;
        }
      }
      if (*nodeLimitHit || !foundBetter) {
        break;
      }
      currentPlan = bestNext;
      currentDev = bestNextDev;
    }

    if (*nodeLimitHit) {
      return true;
    }
    (void)catalog;
    outWinPlans->Push(currentPlan);
  }
  return true;
}

// 递归组合各餐次的窗口级贪心候选，选出各策略下的贪心全天方案
bool EvaluateGreedyWindowCombinations(ExecContext& ctx, const Catalog& catalog,
                                      const PlanTargetSnapshot& target,
                                      const PlannerConfigInput& config,
                                      const IntakeSummary& intake, SearchTracker& tracker,
                                      const Vec<MealPlan>* mealWinPlans, usize mealCount,
                                      usize depth, PlanCandidate* working,
                                      PlanCandidate bestByStrategy[3], bool hasBest[3],
                                      i64* nodesRemaining, i64* nodesEvaluated,
                                      bool* nodeLimitHit) {
  if (depth == mealCount) {
    if (*nodesRemaining <= 0) {
      *nodeLimitHit = true;
      return true;
    }
    *nodesRemaining -= 1;
    *nodesEvaluated += 1;

    PlanCandidate candidate = *working;
    candidate.meals.Init(&ctx.Memory());
    for (usize i = 0; i < working->meals.Size(); ++i) {
      candidate.meals.Push(working->meals[i]);
    }
    if (!EvaluateFullDayPlan(ctx, catalog, target, config, intake, tracker, &candidate)) {
      return false;
    }
    if (!candidate.viable) {
      return true;
    }
    for (usize s = 0; s < config.strategies.Size() && s < 3; ++s) {
      if (!hasBest[s] ||
          IsPlanBetterForStrategy(candidate, bestByStrategy[s], config.strategies[s],
                                  config.hasBudget)) {
        bestByStrategy[s] = candidate;
        bestByStrategy[s].strategy = config.strategies[s];
        bestByStrategy[s].offeredAs.Init(&ctx.Memory());
        bestByStrategy[s].offeredAs.Push(config.strategies[s]);
        hasBest[s] = true;
      }
    }
    return true;
  }

  for (usize i = 0; i < mealWinPlans[depth].Size(); ++i) {
    if (tracker.Stop(ctx)) return !ctx.Failed();
    if (*nodeLimitHit) {
      return true;
    }
    PlanCandidate next = *working;
    next.meals.Init(&ctx.Memory());
    for (usize k = 0; k < working->meals.Size(); ++k) {
      next.meals.Push(working->meals[k]);
    }
    next.meals.Push(mealWinPlans[depth][i]);
    if (!EvaluateGreedyWindowCombinations(ctx, catalog, target, config, intake, tracker,
                                          mealWinPlans, mealCount, depth + 1, &next,
                                          bestByStrategy, hasBest, nodesRemaining, nodesEvaluated,
                                          nodeLimitHit)) {
      return false;
    }
  }
  return true;
}

// 运行贪心算法为所有请求策略生成方案
bool RunGreedyAlgorithm(ExecContext& ctx, const Catalog& catalog, const PlanTargetSnapshot& target,
                        const PlannerConfigInput& config, const IntakeSummary& intake,
                        const Vec<MealCandidateSet>& mealSets, SearchTracker* tracker,
                        Vec<PlanCandidate>* outStrategyPlans) {
  tracker->hasNodesEvaluated = true;
  tracker->hasStatesEvaluated = false;
  tracker->searchComplete = false;
  tracker->AddApproximation(
      Str("APPROXIMATE_CANDIDATES"), Str("allMeals"), false, 0, false, 0,
      Str("greedy per-meal local selection without full-day exhaustive search"));

  i64 nodesRemaining = config.limits.maxSearchNodes;
  i64 nodesEvaluated = 0;
  bool nodeCapTriggered = false;
  i64 observedDemandNodes = 0;
  for (usize m = 0; m < mealSets.Size(); ++m) {
    if (tracker->Stop(ctx)) return !ctx.Failed();
    observedDemandNodes += static_cast<i64>(mealSets[m].candidates.Size());
  }

  i64 totalMealRefEnergy = 0;
  for (usize m = 0; m < mealSets.Size(); ++m) {
    if (tracker->Stop(ctx)) return !ctx.Failed();
    totalMealRefEnergy += MealTargetOf(target, mealSets[m].mealIndex).energyKcal;
  }

  i64 dayRemainingBudget = config.budgetCents;
  if (config.hasBudget && intake.priceComplete) {
    dayRemainingBudget = config.budgetCents - intake.knownPriceCents;
    if (dayRemainingBudget < 0) {
      dayRemainingBudget = 0;
    }
  }

  // 生成每餐各窗口的逐项边际贪心候选（第一趟：不加单餐预算拆分；若启用预算则同步生成按能量占比拆分的受限候选）。
  // 预算拆分口径：按各餐参考能量占全天参考能量的整数比例分配当日剩余预算（整数除法向下截断），
  // 仅作贪心阶段的单餐软上限；全天真实预算判定仍以 EvaluateFullDayPlan 的全天合计为准。
  Vec<MealPlan> mealWinPlans[3];
  for (usize m = 0; m < mealSets.Size() && m < 3; ++m) {
    if (tracker->Stop(ctx)) return !ctx.Failed();
    if (!BuildWindowGreedyMealPlans(ctx, catalog, target, config, mealSets[m], false, 0,
                                    &nodesRemaining, &nodesEvaluated, &nodeCapTriggered,
                                    &mealWinPlans[m], tracker)) {
      return false;
    }
    if (nodeCapTriggered) {
      break;
    }
    if (config.hasBudget) {
      const i64 mealEnergy = MealTargetOf(target, mealSets[m].mealIndex).energyKcal;
      i64 share = static_cast<i64>(mealSets.Size()) > 0
                      ? (dayRemainingBudget / static_cast<i64>(mealSets.Size()))
                      : 0;
      if (totalMealRefEnergy > 0) {
        share = (dayRemainingBudget * mealEnergy) / totalMealRefEnergy;
      }
      Vec<MealPlan> cappedPlans;
      if (!BuildWindowGreedyMealPlans(ctx, catalog, target, config, mealSets[m], true, share,
                                      &nodesRemaining, &nodesEvaluated, &nodeCapTriggered,
                                      &cappedPlans, tracker)) {
        return false;
      }
      for (usize c = 0; c < cappedPlans.Size(); ++c) {
        if (tracker->Stop(ctx)) return !ctx.Failed();
        mealWinPlans[m].Push(cappedPlans[c]);
      }
      if (nodeCapTriggered) {
        break;
      }
    }
  }

  PlanCandidate bestByStrategy[3];
  bool hasBest[3] = {false, false, false};

  if (!nodeCapTriggered && !tracker->Stop(ctx)) {
    bool allMealsHaveWinPlan = true;
    for (usize m = 0; m < mealSets.Size() && m < 3; ++m) {
      if (mealWinPlans[m].Empty()) {
        allMealsHaveWinPlan = false;
      }
    }
    if (allMealsHaveWinPlan) {
      PlanCandidate working = PlanCandidate{};
      working.meals.Init(&ctx.Memory());
      if (!EvaluateGreedyWindowCombinations(ctx, catalog, target, config, intake, *tracker,
                                            mealWinPlans, mealSets.Size(), 0, &working,
                                            bestByStrategy, hasBest, &nodesRemaining,
                                            &nodesEvaluated, &nodeCapTriggered)) {
        return false;
      }
    }
  }

  tracker->nodesEvaluated = nodesEvaluated;
  if (nodeCapTriggered) {
    tracker->anyNodeCapHit = true;
    tracker->AddCapHit(Str("maxSearchNodes"), config.limits.maxSearchNodes,
                       observedDemandNodes > nodesEvaluated ? observedDemandNodes
                                                            : nodesEvaluated + 1);
    // null 保持既有节点截断结果；带时限路径保留已经完成的全天方案。
    if (!tracker->clockEnabled) return true;
  }

  for (usize s = 0; s < config.strategies.Size() && s < 3; ++s) {
    if (hasBest[s]) {
      if (nodeCapTriggered) bestByStrategy[s].limitReached = true;
      outStrategyPlans->Push(bestByStrategy[s]);
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// 算法二（dp）：多阶段动态规划、精确状态等价支配与受限桶化离散化
// ---------------------------------------------------------------------------
//
// 状态定义、无损支配条件与离散化误差上界证明（T04 要求 4）：
//   1. 阶段划分：按 planningMeals 顺序划分为阶段 $t = 1 \dots M$（$M \in \{1,2,3\}$）。
//   2. 状态向量 $S_t$：记录前 $t$ 餐前缀选择序列 $c_1, \dots, c_t$ 所唯一决定的累计量：
//      - 累计四项营养素 $(E, P, F, C)$ 与营养完整位 `nutComplete`；
//      - 累计已知金额 `knownPrice` 与价格完整位 `priceComplete`；
//      - 已覆盖的已知分类位掩码 `catMask`、累计未知分类数 `unknownCat`、累计口味分 `prefScore`；
//      - 前缀选择索引可精确重建全部底层单品频次向量 $\vec{d}$，不按目录前缀或实例容量截断。
//   3. 精确等价与支配定理（Exact Dominance Theorem）：
//      若同一阶段的两个前缀状态 $A, B$ 满足：
//        $(E_A, P_A, F_A, C_A) = (E_B, P_B, F_B, C_B)$，`nutComplete_A = nutComplete_B`，
//        `priceComplete_A = priceComplete_B`，`catMask_A = catMask_B`，$\vec{d}_A = \vec{d}_B$，
//      则对任意后续餐次后缀序列 $R$，$A \oplus R$ 与 $B \oplus R$ 的全天最终营养偏差 `deviationBp`、
//      分档 `tier`、类别覆盖数 `categoryCoverage`、后续新增重复对数均恒等。
//      此时若 $A$ 同时满足：
//        `knownPrice_A <= knownPrice_B`，`repeated_A <= repeated_B`，
//        `unknownCat_A <= unknownCat_B`，`prefScore_A >= prefScore_B`，
//      且当四项指标全相等时 $A$ 的前缀字典序更小，则对 primary / economy / taste 任意策略，
//      $A \oplus R$ 在词典序下恒优于或等于 $B \oplus R$，故剪除 $B$ 是 100% 数学无损的。
//   4. 离散化桶化与启发式截断近似（Bucketed Quantization & Pruning under `maxDpStates`）：
//      当某阶段精确非支配状态数超过 `limits.maxDpStates` 时，启用步长为 $(\Delta_E, \Delta_P, \Delta_F, \Delta_C)$
//      的营养桶化（如 $\Delta_E = 20\text{ kcal}, \Delta_P = \Delta_F = \Delta_C = 50\text{ dg}$）及上限截断：
//      - 纠偏说明（A01/A05 结论）：原注释所称的“$M \cdot \Delta_n$ 全局量化误差界”仅适用于对应代表路径未被丢弃的桶内局部替换；
//        在存在丢桶与状态启发式截断时，尚无覆盖全局丢桶及三策略整体排序损失的统一近似误差上界（F5 反例损失可达 3999 bp）；
//      - DP 桶化/截断后本质为启发式近似（Heuristic Approximation）。新增逐餐最低完整价见证（T04A09）在明确前提下
//        保障已生成单餐候选池内的预算可行性，但不构成全局营养误差上界保证；
//      - 一旦触发 `maxDpStates` 桶化或状态截断，必须在 `search.capsHit` 记录 `maxDpStates`，
//        在 `search.approximations` 记录 `APPROXIMATE_DISCRETIZATION`，在方案 `flags` 打标，
//        且当因状态截断导致非终端阶段被裁剪而未覆盖全空间时，`searchComplete = false`。

// DP 状态：mealChoiceIdx 记录各阶段选中候选下标（-1=未决策），由前缀候选序列可精确重建全部
// 底层单品频次；terminalPlanKey 仅终端阶段计算（规范元组 SHA-256），用于词典序平局决胜。
struct DpState {
  i32 mealChoiceIdx[3];
  usize depth;
  NutritionValues sums;
  bool nutComplete;
  bool priceComplete;
  i64 knownPriceCents;
  u32 catMask;
  i64 unknownCatCount;
  i64 repeatedPairCount;
  i64 prefScore;
  Sha256Digest terminalPlanKey;
};

// 状态已经保留完整餐次选择，直接查询不可变候选即可取得精确频次，无每状态数组复制。
i64 PrefixDishCount(const DpState& state, const Vec<MealCandidateSet>& mealSets, Str dishId) {
  i64 count = 0;
  for (usize m = 0; m < state.depth; ++m) {
    const MealPlan& meal = mealSets[m].candidates[static_cast<usize>(state.mealChoiceIdx[m])];
    for (usize i = 0; i < meal.items.Size(); ++i) {
      count += CountDishInItem(meal.items[i], dishId);
    }
  }
  return count;
}

// 检查两前缀单品 ID 并集的每个频次；重复查询同一 ID 不影响等价性，不遗漏任一侧独有项。
bool SamePrefixDishCounts(const DpState& a, const DpState& b,
                          const Vec<MealCandidateSet>& mealSets) {
  for (usize side = 0; side < 2; ++side) {
    const DpState& source = side == 0 ? a : b;
    for (usize m = 0; m < source.depth; ++m) {
      const MealPlan& meal = mealSets[m].candidates[static_cast<usize>(source.mealChoiceIdx[m])];
      for (usize i = 0; i < meal.items.Size(); ++i) {
        const PlannedItem& item = meal.items[i];
        if (item.components.Empty()) {
          if (PrefixDishCount(a, mealSets, item.dishId) !=
              PrefixDishCount(b, mealSets, item.dishId)) {
            return false;
          }
        } else {
          for (usize c = 0; c < item.components.Size(); ++c) {
            const Str dishId = item.components[c].dishId;
            if (PrefixDishCount(a, mealSets, dishId) != PrefixDishCount(b, mealSets, dishId)) {
              return false;
            }
          }
        }
      }
    }
  }
  return true;
}

// 新增餐次与既有前缀的重复对数；各餐内部重复数由同一个 MealRepeatedPairs 定义。
i64 PrefixCrossMealPairs(const DpState& prefix, const Vec<MealCandidateSet>& mealSets,
                         const MealPlan& candidate) {
  i64 pairs = 0;
  for (usize m = 0; m < prefix.depth; ++m) {
    pairs += CrossMealRepeatedPairs(
        mealSets[m].candidates[static_cast<usize>(prefix.mealChoiceIdx[m])], candidate);
  }
  return pairs;
}

// 每个终端状态仅计算一次完整规范摘要；工作缓冲在同一次 DP 调用中重复使用。
bool ComputeTerminalDpPlanKeyDigest(const DpState& state,
                                    const Vec<MealCandidateSet>& mealSets,
                                    Vec<MealPlan>* meals, Vec<PlanKeyItem>* pairs, TextBuffer* json,
                                    Sha256Digest* digest) {
  meals->Clear();
  for (usize m = 0; m < mealSets.Size(); ++m) {
    if (!meals->Push(mealSets[m].candidates[static_cast<usize>(state.mealChoiceIdx[m])])) {
      return false;
    }
  }
  json->size = 0;
  if (!WritePlanKeyRows(*meals, pairs, json)) {
    return false;
  }
  Sha256(json->data, json->size, digest);
  return true;
}

// 判断精确状态 a 是否在所有策略（primary/economy/taste）下无损支配状态 b
bool DpExactDominates(const DpState& a, const DpState& b,
                      const Vec<MealCandidateSet>& mealSets) {
  if (a.nutComplete != b.nutComplete || a.priceComplete != b.priceComplete) {
    return false;
  }
  if (a.sums.energyKcal != b.sums.energyKcal || a.sums.proteinDg != b.sums.proteinDg ||
      a.sums.fatDg != b.sums.fatDg || a.sums.carbDg != b.sums.carbDg) {
    return false;
  }
  const bool isTerminalStage = (a.depth == mealSets.Size());
  if (!isTerminalStage) {
    // 非终端阶段：必须保证分类位掩码与底层单品频次向量全同，以保证对任意后续餐次增量恒等
    if (a.catMask != b.catMask) {
      return false;
    }
    if (!SamePrefixDishCounts(a, b, mealSets)) {
      return false;
    }
    const bool noWorse = a.knownPriceCents <= b.knownPriceCents &&
                         a.repeatedPairCount <= b.repeatedPairCount &&
                         a.unknownCatCount <= b.unknownCatCount &&
                         a.prefScore >= b.prefScore;
    const bool strictlyBetter = a.knownPriceCents < b.knownPriceCents ||
                                a.repeatedPairCount < b.repeatedPairCount ||
                                a.unknownCatCount < b.unknownCatCount ||
                                a.prefScore > b.prefScore;
    return noWorse && strictlyBetter;
  }

  // 终端阶段（a.depth == mealSets.Size()）：不再有后续餐次转移，
  // 此时仅终端评价指标（营养总和、已知价格、重复菜对数、分类覆盖数 PopCountU32(catMask)、未知分类数、口味分）
  // 以及平局时的规范元组 SHA-256 planKey 参与策略词典序比较。
  const i64 covA = PopCountU32(a.catMask);
  const i64 covB = PopCountU32(b.catMask);
  const bool noWorse = a.knownPriceCents <= b.knownPriceCents &&
                       a.repeatedPairCount <= b.repeatedPairCount &&
                       a.unknownCatCount <= b.unknownCatCount &&
                       covA >= covB &&
                       a.prefScore >= b.prefScore;
  if (!noWorse) {
    return false;
  }
  const bool strictlyBetter = a.knownPriceCents < b.knownPriceCents ||
                              a.repeatedPairCount < b.repeatedPairCount ||
                              a.unknownCatCount < b.unknownCatCount ||
                              covA > covB ||
                              a.prefScore > b.prefScore;
  if (strictlyBetter) {
    return true;
  }
  // 终端五项指标完全相等时，按全天规范元组 SHA-256 planKey 字典序精确无损决胜
  return MemCompare(a.terminalPlanKey.bytes, b.terminalPlanKey.bytes, kSha256Bytes) <= 0;
}

// 计算 DP 状态相对目标前缀的启发式优良度评分（仅在超出 maxDpStates 需桶化/截断保留代表元时使用）
i64 DpStateHeuristicRankScore(const DpState& st, const MacroTargets& prefixTarget,
                              const DeviationWeights& weights) {
  const i64 dev = DeviationBp(prefixTarget, st.sums, weights);
  return dev * 100 + st.knownPriceCents / 10 + st.repeatedPairCount * 50 -
         PopCountU32(st.catMask) * 30 - st.prefScore * 20;
}

// 运行 DP：逐阶段扩展状态层并做精确支配去重；searchComplete=true 表示未触发任何限额，
// 即在层一候选集的笛卡尔积空间内完成完备搜索（候选集本身的截断另行记 APPROXIMATE_CANDIDATES）。
bool RunDpAlgorithm(ExecContext& ctx, const Catalog& catalog, const PlanTargetSnapshot& target,
                    const PlannerConfigInput& config, const IntakeSummary& intake,
                    const Vec<MealCandidateSet>& mealSets, SearchTracker* tracker,
                    Vec<PlanCandidate>* outStrategyPlans) {
  tracker->hasNodesEvaluated = false;
  tracker->hasStatesEvaluated = true;

  Vec<MealPlan> keyMeals;
  keyMeals.Init(&ctx.Memory());
  Vec<PlanKeyItem> keyPairs;
  keyPairs.Init(&ctx.Memory());
  TextBuffer keyJson;
  keyJson.Init(&ctx.Memory());


  // 初始化第 0 阶段基准状态（含当日已食用 activeLogs 的初始营养与价格）
  Vec<DpState> currentLayer;
  currentLayer.Init(&ctx.Memory());
  DpState initSt = DpState{};
  initSt.mealChoiceIdx[0] = -1;
  initSt.mealChoiceIdx[1] = -1;
  initSt.mealChoiceIdx[2] = -1;
  initSt.depth = 0;
  InitNutritionSum(&initSt.sums);
  if (intake.itemCount > 0) {
    initSt.sums.hasEnergy = intake.hasEnergy;
    initSt.sums.hasProtein = intake.hasProtein;
    initSt.sums.hasFat = intake.hasFat;
    initSt.sums.hasCarb = intake.hasCarb;
    initSt.sums.energyKcal = intake.energyKcal;
    initSt.sums.proteinDg = intake.proteinDg;
    initSt.sums.fatDg = intake.fatDg;
    initSt.sums.carbDg = intake.carbDg;
  }
  initSt.nutComplete = initSt.sums.Complete();
  initSt.priceComplete = true;
  initSt.knownPriceCents = 0;
  initSt.catMask = 0;
  initSt.unknownCatCount = 0;
  initSt.repeatedPairCount = 0;
  initSt.prefScore = 0;
  currentLayer.Push(initSt);

  i64 totalStatesEvaluated = 0;
  bool dpCapTriggered = false;
  i64 maxObservedLayerStates = 0;
  MacroTargets runningPrefixTarget = {0, 0, 0, 0};

  for (usize stage = 0; stage < mealSets.Size(); ++stage) {
    if (tracker->Stop(ctx)) { currentLayer.Clear(); break; }
    const MealCandidateSet& mealSet = mealSets[stage];
    const MacroTargets mealRef = MealTargetOf(target, mealSet.mealIndex);
    runningPrefixTarget.energyKcal += mealRef.energyKcal;
    runningPrefixTarget.proteinDg += mealRef.proteinDg;
    runningPrefixTarget.fatDg += mealRef.fatDg;
    runningPrefixTarget.carbDg += mealRef.carbDg;

    Vec<DpState> nextLayer;
    nextLayer.Init(&ctx.Memory());
    i64 rawLayerCount = 0;

    for (usize sIdx = 0; sIdx < currentLayer.Size(); ++sIdx) {
      if (tracker->Stop(ctx)) goto dp_layer_done;
      const DpState& prev = currentLayer[sIdx];
      for (usize cIdx = 0; cIdx < mealSet.candidates.Size(); ++cIdx) {
        if (tracker->Stop(ctx)) goto dp_layer_done;
        const MealPlan& cand = mealSet.candidates[cIdx];
        totalStatesEvaluated += 1;

        DpState next = prev;
        next.mealChoiceIdx[stage] = static_cast<i32>(cIdx);
        next.depth = stage + 1;
        AddNutrition(&next.sums, cand.sums);
        next.nutComplete = prev.nutComplete && cand.nutritionComplete && next.sums.Complete();
        next.priceComplete = prev.priceComplete && cand.priceComplete;
        next.knownPriceCents = prev.knownPriceCents + cand.knownPriceCents;
        next.catMask = prev.catMask | cand.categoryMask;
        next.unknownCatCount = prev.unknownCatCount + cand.unknownCategoryCount;
        next.prefScore = prev.prefScore + cand.preferenceScore;

        next.repeatedPairCount = prev.repeatedPairCount + cand.repeatedDishCount +
                                 PrefixCrossMealPairs(prev, mealSets, cand);

        if (next.depth == mealSets.Size() &&
            !ComputeTerminalDpPlanKeyDigest(next, mealSets, &keyMeals, &keyPairs, &keyJson,
                                            &next.terminalPlanKey)) {
          return ctx.FailInternal("$.plannerConfig.algorithm", "terminal planKey serialization failed");
        }

        // 精确支配去重：若 nextLayer 中已有精确支配 next 的状态则丢弃 next；若 next 支配已有状态则原地替换
        bool dominated = false;
        for (usize k = 0; k < nextLayer.Size(); ++k) {
          if (tracker->Stop(ctx)) goto dp_layer_done;
          if (DpExactDominates(nextLayer[k], next, mealSets)) {
            dominated = true;
            break;
          }
          if (DpExactDominates(next, nextLayer[k], mealSets)) {
            nextLayer[k] = next;
            dominated = true;
            break;
          }
        }
        if (!dominated) {
          nextLayer.Push(next);
        }
      }
    }

    rawLayerCount = static_cast<i64>(nextLayer.Size());
    if (rawLayerCount > maxObservedLayerStates) {
      maxObservedLayerStates = rawLayerCount;
    }

    // 若当前阶段非支配状态数超过 maxDpStates，执行营养量化桶化并截断：桶键=营养素整除步长
    // （20 kcal / 50 dg 向下取整），同桶保留启发式评分最优代表元，按评分升序保留前 maxDpStates 个。
    // 这是启发式近似，不提供全局误差上界；触发后如实记录 capsHit 与 APPROXIMATE_DISCRETIZATION
    // （近似语义的纠偏说明见本文件头部定理 4）。
    if (rawLayerCount > config.limits.maxDpStates) {
      dpCapTriggered = true;
      tracker->anyDpCapHit = true;
      tracker->AddCapHit(Str("maxDpStates"), config.limits.maxDpStates, rawLayerCount,
                         mealSet.mealName);
      tracker->AddApproximation(
          Str("APPROXIMATE_DISCRETIZATION"), mealSet.mealName, true, 20, true,
          config.limits.maxDpStates,
          Str("DP state space quantized (step=20kcal/50dg) and capped at maxDpStates"));

      Vec<DpState> bucketed;
      bucketed.Init(&ctx.Memory());
      for (usize i = 0; i < nextLayer.Size(); ++i) {
        if (tracker->Stop(ctx)) goto dp_layer_done;
        const DpState& candSt = nextLayer[i];
        const i64 bE = candSt.sums.energyKcal / 20;
        const i64 bP = candSt.sums.proteinDg / 50;
        const i64 bF = candSt.sums.fatDg / 50;
        const i64 bC = candSt.sums.carbDg / 50;
        bool mergedInBucket = false;
        for (usize b = 0; b < bucketed.Size(); ++b) {
          if (tracker->Stop(ctx)) goto dp_layer_done;
          const DpState& existSt = bucketed[b];
          if (existSt.nutComplete == candSt.nutComplete &&
              existSt.priceComplete == candSt.priceComplete &&
              (existSt.sums.energyKcal / 20) == bE && (existSt.sums.proteinDg / 50) == bP &&
              (existSt.sums.fatDg / 50) == bF && (existSt.sums.carbDg / 50) == bC) {
            if (DpStateHeuristicRankScore(candSt, runningPrefixTarget, config.weights) <
                DpStateHeuristicRankScore(existSt, runningPrefixTarget, config.weights)) {
              bucketed[b] = candSt;
            }
            mergedInBucket = true;
            break;
          }
        }
        if (!mergedInBucket) {
          bucketed.Push(candSt);
        }
      }

      // 按启发式评分升序排列桶代表元，并严格保留前 maxDpStates 个状态
      for (usize i = 1; i < bucketed.Size(); ++i) {
        if (tracker->Stop(ctx)) goto dp_layer_done;
        const DpState val = bucketed[i];
        const i64 valScore = DpStateHeuristicRankScore(val, runningPrefixTarget, config.weights);
        usize j = i;
        while (j > 0 &&
               DpStateHeuristicRankScore(bucketed[j - 1], runningPrefixTarget, config.weights) >
                   valScore) {
          if (tracker->Stop(ctx)) goto dp_layer_done;
          bucketed[j] = bucketed[j - 1];
          --j;
        }
        bucketed[j] = val;
      }

      currentLayer.Clear();
      const usize keepCount =
          static_cast<i64>(bucketed.Size()) > config.limits.maxDpStates
              ? static_cast<usize>(config.limits.maxDpStates)
              : bucketed.Size();
      for (usize i = 0; i < keepCount; ++i) {
        if (tracker->Stop(ctx)) goto dp_layer_done;
        currentLayer.Push(bucketed[i]);
      }
    } else {
      currentLayer = nextLayer;
    }
  dp_layer_done:
    if (tracker->anyWallClockCapHit || ctx.Failed()) {
      if (stage + 1 == mealSets.Size()) currentLayer = nextLayer;
      else currentLayer.Clear();
      break;
    }
  }

  if (ctx.Failed()) return false;
  tracker->statesEvaluated = totalStatesEvaluated;
  tracker->searchComplete = !tracker->anyCandidateCapHit && !dpCapTriggered &&
                            !tracker->anyWallClockCapHit;

  // 若某个餐次本身无候选或状态转移后为空，则无可行全天方案
  if (currentLayer.Empty()) {
    return true;
  }

  // 在终端状态集合中，对每个请求策略独立应用契约 §10 完整词典序比较器选出最优全天方案
  PlanCandidate bestForStrategy[3];
  TextBuffer bestKeys[3];
  for (usize s = 0; s < 3; ++s) {
    bestForStrategy[s] = PlanCandidate{};
    bestForStrategy[s].meals.Init(&ctx.Memory());
    bestForStrategy[s].offeredAs.Init(&ctx.Memory());
    bestKeys[s].Init(&ctx.Memory());
  }
  PlanKeyWorkspace evaluationKeys;
  evaluationKeys.Init(&ctx.Memory());
  bool hasBestForStrategy[3] = {false, false, false};

  // -------------------------------------------------------------------------
  // T04A09: DP 状态截断且预算适用时，向终端比较器提供一份逐餐价格完整最低价组合见证
  // -------------------------------------------------------------------------
  if (!tracker->Stop(ctx) && dpCapTriggered && config.hasBudget && intake.priceComplete &&
      intake.knownPriceCents <= config.budgetCents) {
    const usize numMeals = mealSets.Size();
    bool allMealsHavePriceComplete = true;
    usize minPriceChoiceIdx[3] = {0, 0, 0};
    i64 totalMinPlannedPriceCents = 0;

    for (usize m = 0; m < numMeals && m < 3; ++m) {
      if (tracker->Stop(ctx)) goto dp_terminals;
      const MealCandidateSet& mSet = mealSets[m];
      bool foundInMeal = false;
      i64 lowestPrice = 0;
      usize bestIdx = 0;

      for (usize c = 0; c < mSet.candidates.Size(); ++c) {
        if (tracker->Stop(ctx)) goto dp_terminals;
        const MealPlan& cand = mSet.candidates[c];
        if (cand.priceComplete) {
          if (!foundInMeal || cand.knownPriceCents < lowestPrice) {
            lowestPrice = cand.knownPriceCents;
            bestIdx = c;
            foundInMeal = true;
          }
        }
      }

      if (!foundInMeal) {
        allMealsHavePriceComplete = false;
        break;
      }
      minPriceChoiceIdx[m] = bestIdx;
      totalMinPlannedPriceCents += lowestPrice;
    }

    if (allMealsHavePriceComplete &&
        totalMinPlannedPriceCents <= (config.budgetCents - intake.knownPriceCents)) {
      PlanCandidate witness = PlanCandidate{};
      witness.meals.Init(&ctx.Memory());
      for (usize m = 0; m < numMeals && m < 3; ++m) {
        if (tracker->Stop(ctx)) goto dp_terminals;
        witness.meals.Push(mealSets[m].candidates[minPriceChoiceIdx[m]]);
      }
      if (!EvaluateFullDayPlan(ctx, catalog, target, config, intake, *tracker, &witness,
                               &evaluationKeys)) {
        return false;
      }
      if (witness.viable) {
        for (usize s = 0; s < config.strategies.Size() && s < 3; ++s) {
          if (!StoreSearchIncumbent(witness, config.strategies[s], &bestForStrategy[s],
                                    &bestKeys[s])) {
            return ctx.FailInternal("$.plannerConfig.algorithm", "DP incumbent allocation failed");
          }
          hasBestForStrategy[s] = true;
        }
      }
    }
  }

dp_terminals:
  PlanCandidate candPlan = PlanCandidate{};
  candPlan.meals.Init(&ctx.Memory());
  for (usize idx = 0; idx < currentLayer.Size(); ++idx) {
    if (tracker->Stop(ctx) && (idx > 0 || hasBestForStrategy[0])) break;
    if (ctx.Failed()) return false;
    const DpState& term = currentLayer[idx];
    candPlan.meals.Clear();
    for (usize m = 0; m < mealSets.Size(); ++m) {
      const i32 choice = term.mealChoiceIdx[m];
      if (choice >= 0 && static_cast<usize>(choice) < mealSets[m].candidates.Size()) {
        candPlan.meals.Push(mealSets[m].candidates[static_cast<usize>(choice)]);
      }
    }
    if (!EvaluateFullDayPlan(ctx, catalog, target, config, intake, *tracker, &candPlan,
                             &evaluationKeys)) {
      return false;
    }
    if (!candPlan.viable) {
      continue;
    }
    for (usize s = 0; s < config.strategies.Size() && s < 3; ++s) {
      if (!hasBestForStrategy[s] ||
          IsPlanBetterForStrategy(candPlan, bestForStrategy[s], config.strategies[s],
                                  config.hasBudget)) {
        if (!StoreSearchIncumbent(candPlan, config.strategies[s], &bestForStrategy[s],
                                  &bestKeys[s])) {
          return ctx.FailInternal("$.plannerConfig.algorithm", "DP incumbent allocation failed");
        }
        hasBestForStrategy[s] = true;
      }
    }
  }

  for (usize s = 0; s < config.strategies.Size() && s < 3; ++s) {
    if (hasBestForStrategy[s]) {
      outStrategyPlans->Push(bestForStrategy[s]);
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// 算法三（branchAndBound）：深度优先分支限界与可证明乐观下界剪枝（Admissible Lower Bounds）
// ---------------------------------------------------------------------------
//
// 乐观界（Admissible Optimistic Bounds）定义与不漏最优解证明（T04 要求 5）：
//   设总规划餐次数为 $M$，当前搜索处于阶段 $d \in [1, M-1]$（已选定前 $d$ 餐，剩余餐次集合为 $R = \{d+1 \dots M\}$）。
//   对剩余每一餐 $r \in R$，预先在层一合法单餐候选集 $C_r$ 上精确计算单餐极值统计量：
//     - 营养素区间：$E_r^{\min} = \min_{c \in C_r} E(c),\ E_r^{\max} = \max_{c \in C_r} E(c)$（对 $P, F, C$ 同理）；
//     - 已知价格下界：$p_r^{\min} = \min_{c \in C_r} \text{price}(c)$，是否存在价格完整候选 $\text{canPriceComp}_r$；
//     - 营养完整性上界：是否存在营养完整候选 $\text{canNutComp}_r$；
//     - 口味得分上界：$\text{pref}_r^{\max} = \max_{c \in C_r} \text{pref}(c)$；
//     - 分类位掩码并集：$\text{mask}_r^{\cup} = \bigcup_{c \in C_r} \text{catMask}(c)$；
//     - 单餐内部最少重复菜对数：$\text{rep}_r^{\min} = \min_{c \in C_r} \text{rep}(c)$；
//     - 单餐最少未知分类数：$\text{unk}_r^{\min} = \min_{c \in C_r} \text{unk}(c)$。
//
//   由此推导从当前前缀状态 $S_d$ 出发所能到达的任意完整全天方案 $X$ 的 7 项乐观界：
//     1) 营养完整性乐观界：$\text{optNutComp} = S_d.\text{nutComplete} \land \bigwedge_{r \in R} \text{canNutComp}_r$。
//        证明：若前缀已含未知营养，或某剩余餐次全部候选均含未知营养，则任意完备化方案必有 $\text{nutComplete}(X) = \text{false}$。
//     2) 价格完整性与总价下界：$\text{optPriceComp} = S_d.\text{priceComplete} \land \bigwedge_{r \in R} \text{canPriceComp}_r$，
//        且任意完备化方案的已知总价满足 $\text{price}(X) \ge \text{lbPrice} = S_d.\text{knownPrice} + \sum_{r \in R} p_r^{\min}$。
//        证明：非负价格逐餐可加，每餐实付不低于该餐最便宜候选 $p_r^{\min}$。
//     3) 预算可行性乐观界：当启用预算且已吃价格完整时，若 $\neg\text{optPriceComp}$ 或 $\text{lbPrice} > B_{\text{rem}}$，
//        则子树内全部方案均必然超预算（$\text{overBudget}(X) = \text{true}$）。
//     4) 营养偏差下界 $\text{lbDeviationBp}$ 与分档下界 $\text{lbTier}$：
//        对每项营养素 $n \in \{E, P, F, C\}$，子树内最终全天摄入量 $V_n(X)$ 必落在闭区间
//        $[L_n, U_n] = [S_d.V_n + \sum_{r \in R} V_{r,n}^{\min},\ S_d.V_n + \sum_{r \in R} V_{r,n}^{\max}]$ 内。
//        因此 $|V_n(X) - T_n| \ge \text{dist}(T_n, [L_n, U_n]) = \max(0, L_n - T_n, T_n - U_n)$。
//        由 `WeightedTerm` 关于绝对差值的单调不减性，必有：
//        $$\text{deviationBp}(X) \ge \text{lbDeviationBp} = \sum_{n} \text{WeightedTerm}(\text{dist}(T_n, [L_n, U_n]))$$
//        进一步由整除单调性得 $\text{tier}(X) = \lfloor \text{deviationBp}(X) / W_{\text{tier}} \rfloor \ge \lfloor \text{lbDeviationBp} / W_{\text{tier}} \rfloor = \text{lbTier}$。
//     5) 多样性乐观界：
//        - 最终分类覆盖满足 $\text{categoryCoverage}(X) \le \text{ubCoverage} = \text{popcount}(S_d.\text{catMask} \cup \bigcup_{r \in R} \text{mask}_r^{\cup})$；
//        - 最终重复菜对数满足 $\text{repeatedDishCount}(X) \ge \text{lbRepeated} = S_d.\text{repeatedPairCount} + \sum_{r \in R} \text{rep}_r^{\min}$（因跨餐新增重复对数 $\ge 0$）；
//        - 最终未知分类数满足 $\text{unknownCategoryCount}(X) \ge \text{lbUnknownCat} = S_d.\text{unknownCatCount} + \sum_{r \in R} \text{unk}_r^{\min}$。
//     6) 口味得分上界：$\text{preferenceScore}(X) \le \text{ubPref} = S_d.\text{prefScore} + \sum_{r \in R} \text{pref}_r^{\max}$。
//
//   剪枝安全性定理（Admissibility & Non-Pruning of Optimal Solutions）：
//     构造虚拟乐观方案 $P_{\text{opt}}$，赋予上述全部乐观极值 $(\text{optNutComp}, \text{optPriceComp}, \text{lbPrice},$
//     $\text{lbDeviationBp}, \text{lbTier}, \text{ubCoverage}, \text{lbRepeated}, \text{lbUnknownCat}, \text{ubPref})$。
//     对子树内任意真实叶节点方案 $X$，在契约 §10 任一策略的每个词典序比较维度上，$P_{\text{opt}}$ 均优于或等于 $X$。
//     当 $P_{\text{opt}}$ 在所有非 `planKey` 维度上均严格劣于当前已找到的最优解 `incumbent`（即连并列都不可能达到）时，
//     由全序传递性可知子树内不存在任何优于或等于 `incumbent` 的方案，安全剪枝且 100% 不漏全局最优解。

struct MealRemainingBounds {
  i64 minEnergy;
  i64 maxEnergy;
  i64 minProtein;
  i64 maxProtein;
  i64 minFat;
  i64 maxFat;
  i64 minCarb;
  i64 maxCarb;
  i64 minKnownPrice;
  bool anyPriceComplete;
  bool anyNutComplete;
  i64 maxPrefScore;
  u32 unionCatMask;
  i64 minRepeatedPairs;
  i64 minUnknownCat;
};

// 预计算从阶段 stage 到末尾 M-1 的后缀累积乐观界
void ComputeSuffixBounds(ExecContext& ctx, SearchTracker* tracker,
                         const Vec<MealCandidateSet>& mealSets,
                         MealRemainingBounds suffixBounds[4]) {
  const usize totalMeals = mealSets.Size();
  suffixBounds[totalMeals] = MealRemainingBounds{};
  suffixBounds[totalMeals].anyPriceComplete = true;
  suffixBounds[totalMeals].anyNutComplete = true;

  for ( usize rev = 0; rev < totalMeals; ++rev) {
    if (tracker->Stop(ctx)) return;
    const usize idx = totalMeals - 1 - rev;
    const MealCandidateSet& set = mealSets[idx];
    const MealRemainingBounds& next = suffixBounds[idx + 1];
    MealRemainingBounds cur = MealRemainingBounds{};

    if (set.candidates.Empty()) {
      cur.anyPriceComplete = false;
      cur.anyNutComplete = false;
      suffixBounds[idx] = cur;
      continue;
    }

    const MealPlan& first = set.candidates[0];
    i64 minE = first.sums.energyKcal, maxE = first.sums.energyKcal;
    i64 minP = first.sums.proteinDg, maxP = first.sums.proteinDg;
    i64 minF = first.sums.fatDg, maxF = first.sums.fatDg;
    i64 minC = first.sums.carbDg, maxC = first.sums.carbDg;
    i64 minPr = first.knownPriceCents;
    bool anyPrComp = first.priceComplete;
    bool anyNuComp = first.nutritionComplete;
    i64 maxPref = first.preferenceScore;
    u32 uMask = first.categoryMask;
    i64 minRep = first.repeatedDishCount;
    i64 minUnk = first.unknownCategoryCount;

    for (usize c = 1; c < set.candidates.Size(); ++c) {
      if (tracker->Stop(ctx)) return;
      const MealPlan& cand = set.candidates[c];
      if (cand.sums.energyKcal < minE) minE = cand.sums.energyKcal;
      if (cand.sums.energyKcal > maxE) maxE = cand.sums.energyKcal;
      if (cand.sums.proteinDg < minP) minP = cand.sums.proteinDg;
      if (cand.sums.proteinDg > maxP) maxP = cand.sums.proteinDg;
      if (cand.sums.fatDg < minF) minF = cand.sums.fatDg;
      if (cand.sums.fatDg > maxF) maxF = cand.sums.fatDg;
      if (cand.sums.carbDg < minC) minC = cand.sums.carbDg;
      if (cand.sums.carbDg > maxC) maxC = cand.sums.carbDg;
      if (cand.knownPriceCents < minPr) minPr = cand.knownPriceCents;
      if (cand.priceComplete) anyPrComp = true;
      if (cand.nutritionComplete) anyNuComp = true;
      if (cand.preferenceScore > maxPref) maxPref = cand.preferenceScore;
      uMask |= cand.categoryMask;
      if (cand.repeatedDishCount < minRep) minRep = cand.repeatedDishCount;
      if (cand.unknownCategoryCount < minUnk) minUnk = cand.unknownCategoryCount;
    }

    cur.minEnergy = minE + next.minEnergy;
    cur.maxEnergy = maxE + next.maxEnergy;
    cur.minProtein = minP + next.minProtein;
    cur.maxProtein = maxP + next.maxProtein;
    cur.minFat = minF + next.minFat;
    cur.maxFat = maxF + next.maxFat;
    cur.minCarb = minC + next.minCarb;
    cur.maxCarb = maxC + next.maxCarb;
    cur.minKnownPrice = minPr + next.minKnownPrice;
    cur.anyPriceComplete = anyPrComp && next.anyPriceComplete;
    cur.anyNutComplete = anyNuComp && next.anyNutComplete;
    cur.maxPrefScore = maxPref + next.maxPrefScore;
    cur.unionCatMask = uMask | next.unionCatMask;
    cur.minRepeatedPairs = minRep + next.minRepeatedPairs;
    cur.minUnknownCat = minUnk + next.minUnknownCat;
    suffixBounds[idx] = cur;
  }
}

// 计算目标值 targetVal 到闭区间 [lowVal, highVal] 的最短距离
i64 DistanceToInterval(i64 targetVal, i64 lowVal, i64 highVal) {
  if (targetVal < lowVal) {
    return lowVal - targetVal;
  }
  if (targetVal > highVal) {
    return targetVal - highVal;
  }
  return 0;
}

// 判断给定前缀状态与剩余后缀界所构成的乐观上界是否严格劣于指定策略的当前最优解 incumbent
bool CanPruneForStrategy(const PlanCandidate& incumbent, bool hasIncumbent, Str strategy,
                         bool hasBudget, i64 remainingBudgetCents, bool intakePriceComplete,
                         const MacroTargets& dailyTarget, const DeviationWeights& weights,
                         const DpState& prefix, const MealRemainingBounds& rem) {
  if (!hasIncumbent || !incumbent.viable) {
    return false;
  }

  const bool optNutComplete = prefix.nutComplete && rem.anyNutComplete;
  const bool optPriceComplete = prefix.priceComplete && rem.anyPriceComplete;
  const i64 lbKnownPrice = prefix.knownPriceCents + rem.minKnownPrice;
  const bool optOverBudget = hasBudget &&
                             (!optPriceComplete || !intakePriceComplete ||
                              lbKnownPrice > remainingBudgetCents);

  // 1) 预算可行性剪枝：若当前 incumbent 在预算内，而子树乐观总价已必超预算，则可安全剪枝
  if (hasBudget && !incumbent.overBudget && optOverBudget) {
    return true;
  }
  if (hasBudget && incumbent.overBudget && !optOverBudget) {
    return false;
  }

  // 2) 营养完整性剪枝：若当前 incumbent 营养完整，而子树不可能营养完整，则可安全剪枝
  if (incumbent.nutritionComplete && !optNutComplete) {
    return true;
  }
  if (!incumbent.nutritionComplete && optNutComplete) {
    return false;
  }

  // 计算营养偏差下界 lbDeviationBp 与分档下界 lbTier
  const i64 distE = DistanceToInterval(dailyTarget.energyKcal,
                                       prefix.sums.energyKcal + rem.minEnergy,
                                       prefix.sums.energyKcal + rem.maxEnergy);
  const i64 distP = DistanceToInterval(dailyTarget.proteinDg,
                                       prefix.sums.proteinDg + rem.minProtein,
                                       prefix.sums.proteinDg + rem.maxProtein);
  const i64 distF = DistanceToInterval(dailyTarget.fatDg,
                                       prefix.sums.fatDg + rem.minFat,
                                       prefix.sums.fatDg + rem.maxFat);
  const i64 distC = DistanceToInterval(dailyTarget.carbDg,
                                       prefix.sums.carbDg + rem.minCarb,
                                       prefix.sums.carbDg + rem.maxCarb);

  i64 lbDeviationBp = 0;
  if (dailyTarget.energyKcal > 0) {
    lbDeviationBp += RoundHalfUp(distE * 10000 * weights.energy, dailyTarget.energyKcal * 1000);
  }
  if (dailyTarget.proteinDg > 0) {
    lbDeviationBp += RoundHalfUp(distP * 10000 * weights.protein, dailyTarget.proteinDg * 1000);
  }
  if (dailyTarget.fatDg > 0) {
    lbDeviationBp += RoundHalfUp(distF * 10000 * weights.fat, dailyTarget.fatDg * 1000);
  }
  if (dailyTarget.carbDg > 0) {
    lbDeviationBp += RoundHalfUp(distC * 10000 * weights.carb, dailyTarget.carbDg * 1000);
  }
  const i64 lbTier = weights.tierWidthBp > 0 ? (lbDeviationBp / weights.tierWidthBp) : 0;

  const i64 ubCategoryCoverage = PopCountU32(prefix.catMask | rem.unionCatMask);
  const i64 lbRepeated = prefix.repeatedPairCount + rem.minRepeatedPairs;
  const i64 lbUnknownCat = prefix.unknownCatCount + rem.minUnknownCat;
  const i64 ubPrefScore = prefix.prefScore + rem.maxPrefScore;

  // 辅助比较：检查乐观多样性是否严格劣于 incumbent（1=严格劣，-1=乐观更优，0=打平）
  auto cmpOptDiversity = [&]() -> int {
    if (ubCategoryCoverage != incumbent.categoryCoverage) {
      return ubCategoryCoverage < incumbent.categoryCoverage ? 1 : -1;
    }
    if (lbRepeated != incumbent.repeatedDishCount) {
      return lbRepeated > incumbent.repeatedDishCount ? 1 : -1;
    }
    if (lbUnknownCat != incumbent.unknownCategoryCount) {
      return lbUnknownCat > incumbent.unknownCategoryCount ? 1 : -1;
    }
    return 0;
  };

  // 辅助比较：检查乐观价格是否严格劣于 incumbent（1=严格劣，-1=乐观更优，0=打平）
  auto cmpOptPrice = [&]() -> int {
    if (optPriceComplete != incumbent.priceComplete) {
      return (!optPriceComplete && incumbent.priceComplete) ? 1 : -1;
    }
    if (lbKnownPrice != incumbent.knownPriceCents) {
      return lbKnownPrice > incumbent.knownPriceCents ? 1 : -1;
    }
    return 0;
  };

  if (strategy.Equals("economy")) {
    if (optNutComplete) {
      if (lbTier > incumbent.tier) return true;
      if (lbTier < incumbent.tier) return false;
    }
    const int pCmp = cmpOptPrice();
    if (pCmp > 0) return true;
    if (pCmp < 0) return false;
    const int dCmp = cmpOptDiversity();
    if (dCmp > 0) return true;
    if (dCmp < 0) return false;
    if (ubPrefScore < incumbent.preferenceScore) return true;
    if (ubPrefScore > incumbent.preferenceScore) return false;
    return false;
  }

  if (strategy.Equals("taste")) {
    if (optNutComplete) {
      if (lbTier > incumbent.tier) return true;
      if (lbTier < incumbent.tier) return false;
    }
    if (ubPrefScore < incumbent.preferenceScore) return true;
    if (ubPrefScore > incumbent.preferenceScore) return false;
    const int dCmp = cmpOptDiversity();
    if (dCmp > 0) return true;
    if (dCmp < 0) return false;
    const int pCmp = cmpOptPrice();
    if (pCmp > 0) return true;
    if (pCmp < 0) return false;
    return false;
  }

  // primary 策略
  if (optNutComplete) {
    if (lbDeviationBp > incumbent.deviationBp) return true;
    if (lbDeviationBp < incumbent.deviationBp) return false;
  }
  const int dCmp = cmpOptDiversity();
  if (dCmp > 0) return true;
  if (dCmp < 0) return false;
  if (ubPrefScore < incumbent.preferenceScore) return true;
  if (ubPrefScore > incumbent.preferenceScore) return false;
  const int pCmp = cmpOptPrice();
  if (pCmp > 0) return true;
  return false;
}

// BnB 搜索环境：suffixBounds 预计算各后缀乐观界；incumbents/hasIncumbent 按请求策略各自维护
// 当前最优；orderedIndices 为每餐候选按单餐偏差升序（平局比价格）的值排序，好分支先扩展。
struct BnBSearchEnv {
  ExecContext* ctx;
  const Catalog* catalog;
  const PlanTargetSnapshot* target;
  const PlannerConfigInput* config;
  const IntakeSummary* intake;
  const Vec<MealCandidateSet>* mealSets;
  SearchTracker* tracker;
  MealRemainingBounds suffixBounds[4];
  i64 remainingBudgetCents;
  i64 nodesRemaining;
  i64 nodesEvaluated;
  bool nodeCapHit;
  i64 observedNodeDemand;
  PlanCandidate incumbents[3];
  TextBuffer incumbentKeys[3];
  PlanCandidate leaf;
  PlanKeyWorkspace evaluationKeys;
  Vec<usize> orderedIndices[3];
  bool hasIncumbent[3];
};

// 深度优先分支限界：每分支先消耗节点预算，再对非叶前缀按各策略乐观界尝试剪枝；叶子完整评估
// 并按策略更新 incumbent。剪枝不漏最优的依据见本文件头部“剪枝安全性定理”。
bool RecurseBranchAndBound(BnBSearchEnv* env, usize stage, const DpState& prefix) {
  const usize totalMeals = env->mealSets->Size();
  if (stage >= totalMeals) {
    PlanCandidate& leaf = env->leaf;
    leaf.meals.Clear();
    for (usize m = 0; m < totalMeals; ++m) {
      const i32 cIdx = prefix.mealChoiceIdx[m];
      leaf.meals.Push((*env->mealSets)[m].candidates[static_cast<usize>(cIdx)]);
    }
    if (!EvaluateFullDayPlan(*env->ctx, *env->catalog, *env->target, *env->config, *env->intake,
                             *env->tracker, &leaf, &env->evaluationKeys)) {
      return false;
    }
    if (!leaf.viable) {
      return true;
    }
    for (usize s = 0; s < env->config->strategies.Size() && s < 3; ++s) {
      if (!env->hasIncumbent[s] ||
          IsPlanBetterForStrategy(leaf, env->incumbents[s], env->config->strategies[s],
                                  env->config->hasBudget)) {
        if (!StoreSearchIncumbent(leaf, env->config->strategies[s], &env->incumbents[s],
                                  &env->incumbentKeys[s])) {
          return env->ctx->FailInternal("$.plannerConfig.algorithm", "BnB incumbent allocation failed");
        }
        env->hasIncumbent[s] = true;
      }
    }
    return true;
  }

  const MealCandidateSet& mealSet = (*env->mealSets)[stage];
  if (env->tracker->Stop(*env->ctx)) return !env->ctx->Failed();
  const Vec<usize>& orderedIndices = env->orderedIndices[stage];

  for (usize k = 0; k < orderedIndices.Size(); ++k) {
    if (env->tracker->Stop(*env->ctx)) return !env->ctx->Failed();
    env->observedNodeDemand += 1;
    if (env->nodesRemaining <= 0) {
      env->nodeCapHit = true;
      return true;
    }
    env->nodesRemaining -= 1;
    env->nodesEvaluated += 1;

    const usize cIdx = orderedIndices[k];
    const MealPlan& cand = mealSet.candidates[cIdx];

    DpState next = prefix;
    next.mealChoiceIdx[stage] = static_cast<i32>(cIdx);
    next.depth = stage + 1;
    AddNutrition(&next.sums, cand.sums);
    next.nutComplete = prefix.nutComplete && cand.nutritionComplete && next.sums.Complete();
    next.priceComplete = prefix.priceComplete && cand.priceComplete;
    next.knownPriceCents = prefix.knownPriceCents + cand.knownPriceCents;
    next.catMask = prefix.catMask | cand.categoryMask;
    next.unknownCatCount = prefix.unknownCatCount + cand.unknownCategoryCount;
    next.prefScore = prefix.prefScore + cand.preferenceScore;

    next.repeatedPairCount = prefix.repeatedPairCount + cand.repeatedDishCount +
                             PrefixCrossMealPairs(prefix, *env->mealSets, cand);

    // 若非叶子阶段，检查该分支在全部请求策略下是否均可被各自 incumbent 乐观界安全剪除
    if (stage + 1 < totalMeals) {
      bool canPruneAllStrategies = true;
      for (usize s = 0; s < env->config->strategies.Size() && s < 3; ++s) {
        if (!CanPruneForStrategy(env->incumbents[s], env->hasIncumbent[s],
                                 env->config->strategies[s], env->config->hasBudget,
                                 env->remainingBudgetCents, env->intake->priceComplete,
                                 env->target->daily, env->config->weights, next,
                                 env->suffixBounds[stage + 1])) {
          canPruneAllStrategies = false;
          break;
        }
      }
      if (canPruneAllStrategies) {
        continue;
      }
    }

    if (!RecurseBranchAndBound(env, stage + 1, next)) {
      return false;
    }
    if (env->nodeCapHit) {
      return true;
    }
  }
  return true;
}

// 运行 BnB：预计算后缀乐观界与每餐值排序后从空根状态 DFS；节点/墙钟任一触发即如实报告
// searchComplete=false 并对 incumbent 标记 limitReached，不把当前最好解冒充已证明的全局最优。
bool RunBranchAndBoundAlgorithm(ExecContext& ctx, const Catalog& catalog,
                                const PlanTargetSnapshot& target, const PlannerConfigInput& config,
                                const IntakeSummary& intake, const Vec<MealCandidateSet>& mealSets,
                                SearchTracker* tracker, Vec<PlanCandidate>* outStrategyPlans) {
  tracker->hasNodesEvaluated = true;
  tracker->hasStatesEvaluated = false;

  for (usize m = 0; m < mealSets.Size(); ++m) {
    if (mealSets[m].candidates.Empty()) {
      tracker->nodesEvaluated = 0;
      tracker->searchComplete = !tracker->anyCandidateCapHit && !tracker->anyWallClockCapHit;
      return true;
    }
  }

  BnBSearchEnv env;
  env.ctx = &ctx;
  env.catalog = &catalog;
  env.target = &target;
  env.config = &config;
  env.intake = &intake;
  env.mealSets = &mealSets;
  env.tracker = tracker;
  ComputeSuffixBounds(ctx, tracker, mealSets, env.suffixBounds);
  if (tracker->Stop(ctx)) return !ctx.Failed();

  env.remainingBudgetCents = config.budgetCents;
  if (config.hasBudget && intake.priceComplete) {
    env.remainingBudgetCents = config.budgetCents - intake.knownPriceCents;
  }
  env.nodesRemaining = config.limits.maxSearchNodes;
  env.nodesEvaluated = 0;
  env.nodeCapHit = false;
  env.observedNodeDemand = 0;
  env.hasIncumbent[0] = false;
  env.hasIncumbent[1] = false;
  env.hasIncumbent[2] = false;

  env.leaf = PlanCandidate{};
  env.leaf.meals.Init(&ctx.Memory());
  env.evaluationKeys.Init(&ctx.Memory());
  for (usize s = 0; s < 3; ++s) {
    env.incumbents[s] = PlanCandidate{};
    env.incumbents[s].meals.Init(&ctx.Memory());
    env.incumbents[s].offeredAs.Init(&ctx.Memory());
    env.incumbentKeys[s].Init(&ctx.Memory());
  }
  // 排序只依赖固定餐次候选与参考目标；所有 DFS 前缀复用相同顺序。
  for (usize m = 0; m < mealSets.Size(); ++m) {
    if (tracker->Stop(ctx)) return !ctx.Failed();
    const MealCandidateSet& mealSet = mealSets[m];
    const MacroTargets mealRef = MealTargetOf(target, mealSet.mealIndex);
  
    // 对当前餐次的候选按单餐参考目标偏差升序（Value Ordering 启发式）排序索引，使好解尽早成为 incumbent 加速剪枝
    Vec<usize>& orderedIndices = env.orderedIndices[m];
    orderedIndices.Init(&ctx.Memory());
    for (usize i = 0; i < mealSet.candidates.Size(); ++i) {
      if (tracker->Stop(ctx)) return !ctx.Failed();
      orderedIndices.Push(i);
    }
    for (usize i = 1; i < orderedIndices.Size(); ++i) {
      if (tracker->Stop(ctx)) return !ctx.Failed();
      const usize valIdx = orderedIndices[i];
      const MealPlan& valMeal = mealSet.candidates[valIdx];
      const i64 valDev = DeviationBp(mealRef, valMeal.sums, config.weights);
      usize j = i;
      while (j > 0) {
        if (tracker->Stop(ctx)) return !ctx.Failed();
        const MealPlan& prevMeal = mealSet.candidates[orderedIndices[j - 1]];
        const i64 prevDev = DeviationBp(mealRef, prevMeal.sums, config.weights);
        if (prevDev < valDev ||
            (prevDev == valDev && prevMeal.knownPriceCents <= valMeal.knownPriceCents)) {
          break;
        }
        orderedIndices[j] = orderedIndices[j - 1];
        --j;
      }
      orderedIndices[j] = valIdx;
    }
  
  }

  DpState rootState = DpState{};
  rootState.mealChoiceIdx[0] = -1;
  rootState.mealChoiceIdx[1] = -1;
  rootState.mealChoiceIdx[2] = -1;
  rootState.depth = 0;
  InitNutritionSum(&rootState.sums);
  if (intake.itemCount > 0) {
    rootState.sums.hasEnergy = intake.hasEnergy;
    rootState.sums.hasProtein = intake.hasProtein;
    rootState.sums.hasFat = intake.hasFat;
    rootState.sums.hasCarb = intake.hasCarb;
    rootState.sums.energyKcal = intake.energyKcal;
    rootState.sums.proteinDg = intake.proteinDg;
    rootState.sums.fatDg = intake.fatDg;
    rootState.sums.carbDg = intake.carbDg;
  }
  rootState.nutComplete = rootState.sums.Complete();
  rootState.priceComplete = true;

  if (!RecurseBranchAndBound(&env, 0, rootState)) {
    return false;
  }

  tracker->nodesEvaluated = env.nodesEvaluated;
  if (env.nodeCapHit) {
    tracker->anyNodeCapHit = true;
    tracker->AddCapHit(Str("maxSearchNodes"), config.limits.maxSearchNodes,
                       env.observedNodeDemand > env.nodesEvaluated ? env.observedNodeDemand
                                                                   : env.nodesEvaluated + 1);
  }
  tracker->searchComplete = !tracker->anyCandidateCapHit && !env.nodeCapHit &&
                            !tracker->anyWallClockCapHit;

  for (usize s = 0; s < config.strategies.Size() && s < 3; ++s) {
    if (env.hasIncumbent[s]) {
      // 若在搜索过程中触发了节点上限，则已找到的 incumbent 未完成全局最优性证明，需同步标记 limitReached
      if (env.nodeCapHit) {
        env.incumbents[s].limitReached = true;
      }
      outStrategyPlans->Push(env.incumbents[s]);
    }
  }
  return true;
}

// ---------------------------------------------------------------------------
// 请求解析与输入边界校验（契约 §4：严格校验 plannerConfig.limits 四字段，拒绝旧别名）
// ---------------------------------------------------------------------------

bool ParseDeviationWeights(ExecContext& ctx, const JsonValue* request, DeviationWeights* out) {
  char buffer[192];
  const JsonValue* config = RequireMember(ctx, request, "nutritionConfig", "$.nutritionConfig");
  if (config == nullptr) {
    return false;
  }
  const JsonValue* sorting = RequireMember(
      ctx, config, "plannerSorting",
      SubPath(buffer, sizeof(buffer), "$.nutritionConfig", "plannerSorting"));
  if (!RequireObjectType(ctx, sorting,
                         SubPath(buffer, sizeof(buffer), "$.nutritionConfig", "plannerSorting"))) {
    return false;
  }
  char sortingPath[192];
  SubPath(sortingPath, sizeof(sortingPath), "$.nutritionConfig", "plannerSorting");
  const JsonValue* weights = RequireMember(
      ctx, sorting, "nutritionDeviationWeightsPermille",
      SubPath(buffer, sizeof(buffer), sortingPath, "nutritionDeviationWeightsPermille"));
  if (!RequireObjectType(
          ctx, weights,
          SubPath(buffer, sizeof(buffer), sortingPath, "nutritionDeviationWeightsPermille"))) {
    return false;
  }
  char weightPath[192];
  SubPath(weightPath, sizeof(weightPath), sortingPath, "nutritionDeviationWeightsPermille");
  struct Entry {
    const char* key;
    i64* target;
  } entries[] = {{"energy", &out->energy},
                 {"protein", &out->protein},
                 {"fat", &out->fat},
                 {"carb", &out->carb}};
  for (usize i = 0; i < 4; ++i) {
    const JsonValue* value = RequireMember(
        ctx, weights, entries[i].key,
        SubPath(buffer, sizeof(buffer), weightPath, entries[i].key));
    if (value == nullptr) {
      return false;
    }
    if (!ReadInt(ctx, value, SubPath(buffer, sizeof(buffer), weightPath, entries[i].key), 0, 10000,
                 entries[i].target)) {
      return false;
    }
  }
  const JsonValue* tier = RequireMember(
      ctx, sorting, "nutritionTierWidthBp",
      SubPath(buffer, sizeof(buffer), sortingPath, "nutritionTierWidthBp"));
  if (tier == nullptr ||
      !ReadInt(ctx, tier, SubPath(buffer, sizeof(buffer), sortingPath, "nutritionTierWidthBp"), 1,
               10000, &out->tierWidthBp)) {
    return false;
  }
  return true;
}

// 解析 $.plannerConfig：
//   * algorithm 仅允许 "greedy" / "dp" / "branchAndBound"；
//   * limits 为必填对象，且仅允许包含 maxMealCandidatesPerMeal、maxDpStates、maxSearchNodes、wallClockMs
//     四个规范字段；任何未知字段（如旧版 maxNodes / maxCandidates）或缺失字段均报 INVALID_INPUT。
bool ParsePlannerConfig(ExecContext& ctx, const JsonValue* request, PlannerConfigInput* out) {
  const char* path = "$.plannerConfig";
  char buffer[192];
  const JsonValue* config = RequireMember(ctx, request, "plannerConfig", path);
  if (!RequireObjectType(ctx, config, path)) {
    return false;
  }
  out->strategies.Init(&ctx.Memory());

  const JsonValue* algorithm = RequireMember(ctx, config, "algorithm",
                                             SubPath(buffer, sizeof(buffer), path, "algorithm"));
  if (algorithm == nullptr) {
    return false;
  }
  const char* allowedAlgorithms[] = {"greedy", "dp", "branchAndBound", nullptr};
  if (!ReadEnum(ctx, algorithm, SubPath(buffer, sizeof(buffer), path, "algorithm"),
                allowedAlgorithms, &out->algorithm)) {
    return false;
  }

  const JsonValue* strategies = RequireMember(ctx, config, "strategies",
                                              SubPath(buffer, sizeof(buffer), path, "strategies"));
  if (strategies == nullptr ||
      !RequireArrayType(ctx, strategies, SubPath(buffer, sizeof(buffer), path, "strategies"))) {
    return false;
  }
  if (strategies->count == 0) {
    return ctx.Fail("INVALID_INPUT", SubPath(buffer, sizeof(buffer), path, "strategies"),
                    "strategies 不能为空");
  }
  const char* allowedStrategies[] = {"primary", "economy", "taste", nullptr};
  for (const JsonValue* item = strategies->child; item != nullptr; item = item->next) {
    Str strategy;
    if (!ReadEnum(ctx, item, SubPath(buffer, sizeof(buffer), path, "strategies"),
                  allowedStrategies, &strategy)) {
      return false;
    }
    for (usize i = 0; i < out->strategies.Size(); ++i) {
      if (out->strategies[i].Equals(strategy)) {
        return ctx.Fail("INVALID_INPUT", SubPath(buffer, sizeof(buffer), path, "strategies"),
                        "strategies 不能重复");
      }
    }
    out->strategies.Push(strategy);
  }

  const JsonValue* budget = RequireMember(ctx, config, "budgetCents",
                                          SubPath(buffer, sizeof(buffer), path, "budgetCents"));
  if (budget == nullptr) {
    return false;
  }
  if (budget->kind == JsonKind::Null) {
    out->hasBudget = false;
    out->budgetCents = 0;
  } else {
    out->hasBudget = true;
    if (!ReadInt(ctx, budget, SubPath(buffer, sizeof(buffer), path, "budgetCents"), 0, 100000000,
                 &out->budgetCents)) {
      return false;
    }
  }

  const JsonValue* maxItems = RequireMember(
      ctx, config, "maxItemsPerMeal", SubPath(buffer, sizeof(buffer), path, "maxItemsPerMeal"));
  if (maxItems == nullptr ||
      !ReadInt(ctx, maxItems, SubPath(buffer, sizeof(buffer), path, "maxItemsPerMeal"), 1,
               kMaxItemsPerMealLimit, &out->maxItemsPerMeal)) {
    return false;
  }

  // 严格校验规范 limits 对象（契约 §4 / P01 T04 裁定）：无默认值兼容层，拒绝旧字段名
  char limitsPath[192];
  SubPath(limitsPath, sizeof(limitsPath), path, "limits");
  const JsonValue* limits = RequireMember(ctx, config, "limits", limitsPath);
  if (limits == nullptr || !RequireObjectType(ctx, limits, limitsPath)) {
    return false;
  }
  for (const JsonMember* member = limits->members; member != nullptr; member = member->next) {
    if (!member->key.Equals("maxMealCandidatesPerMeal") && !member->key.Equals("maxDpStates") &&
        !member->key.Equals("maxSearchNodes") && !member->key.Equals("wallClockMs")) {
      return ctx.Fail("INVALID_INPUT",
                      SubPath(buffer, sizeof(buffer), limitsPath,
                              member->key.data != nullptr ? member->key.data : "unknown"),
                      "plannerConfig.limits 包含未定义的非规范字段（不兼容旧字段别名）");
    }
  }

  const JsonValue* maxCand = RequireMember(
      ctx, limits, "maxMealCandidatesPerMeal",
      SubPath(buffer, sizeof(buffer), limitsPath, "maxMealCandidatesPerMeal"));
  if (maxCand == nullptr ||
      !ReadInt(ctx, maxCand,
               SubPath(buffer, sizeof(buffer), limitsPath, "maxMealCandidatesPerMeal"), 1, 1000000,
               &out->limits.maxMealCandidatesPerMeal)) {
    return false;
  }

  const JsonValue* maxDp = RequireMember(
      ctx, limits, "maxDpStates", SubPath(buffer, sizeof(buffer), limitsPath, "maxDpStates"));
  if (maxDp == nullptr ||
      !ReadInt(ctx, maxDp, SubPath(buffer, sizeof(buffer), limitsPath, "maxDpStates"), 1, 1000000,
               &out->limits.maxDpStates)) {
    return false;
  }

  const JsonValue* maxNodes = RequireMember(
      ctx, limits, "maxSearchNodes", SubPath(buffer, sizeof(buffer), limitsPath, "maxSearchNodes"));
  if (maxNodes == nullptr ||
      !ReadInt(ctx, maxNodes, SubPath(buffer, sizeof(buffer), limitsPath, "maxSearchNodes"), 1,
               10000000, &out->limits.maxSearchNodes)) {
    return false;
  }

  const JsonValue* wallClock = RequireMember(
      ctx, limits, "wallClockMs", SubPath(buffer, sizeof(buffer), limitsPath, "wallClockMs"));
  if (wallClock == nullptr) {
    return false;
  }
  if (wallClock->kind == JsonKind::Null) {
    out->limits.hasWallClockMs = false;
    out->limits.wallClockMs = 0;
  } else {
    out->limits.hasWallClockMs = true;
    if (!ReadInt(ctx, wallClock, SubPath(buffer, sizeof(buffer), limitsPath, "wallClockMs"), 1,
                 600000, &out->limits.wallClockMs)) {
      return false;
    }
  }

  if (!ParseDeviationWeights(ctx, request, &out->weights)) {
    return false;
  }
  return true;
}

bool ParsePlanningMeals(ExecContext& ctx, const JsonValue* request, Vec<i64>* masks) {
  char buffer[192];
  const JsonValue* planning = RequireMember(ctx, request, "planningMeals", "$.planningMeals");
  if (planning == nullptr || !RequireArrayType(ctx, planning, "$.planningMeals")) {
    return false;
  }
  if (planning->count == 0 || planning->count > 3) {
    return ctx.Fail("INVALID_INPUT", "$.planningMeals", "planningMeals 数量必须在 1..3 之间");
  }
  for (const JsonValue* item = planning->child; item != nullptr; item = item->next) {
    Str meal;
    if (item->kind == JsonKind::Object) {
      const JsonValue* mealValue = RequireMember(
          ctx, item, "meal", SubPath(buffer, sizeof(buffer), "$.planningMeals[]", "meal"));
      if (mealValue == nullptr || !ReadString(ctx, mealValue, "$.planningMeals[].meal", &meal)) {
        return false;
      }
    } else {
      if (!ReadString(ctx, item, "$.planningMeals[]", &meal)) {
        return false;
      }
    }
    const i64 mask = MealMaskFromName(meal);
    if (mask == 0) {
      return ctx.Fail("INVALID_INPUT", "$.planningMeals[]", "planningMeals 含未知餐次枚举值");
    }
    for (usize i = 0; i < masks->Size(); ++i) {
      if ((*masks)[i] == mask) {
        return ctx.Fail("INVALID_INPUT", "$.planningMeals[]", "planningMeals 重复");
      }
    }
    masks->Push(mask);
  }
  return true;
}

bool ParseState(ExecContext& ctx, const JsonValue* request, Str requestBusinessDate, LockSet* locks,
                IntakeSummary* intake) {
  char buffer[192];
  locks->itemLocks.Init(&ctx.Memory());
  locks->soldOut.Init(&ctx.Memory());
  for (usize i = 0; i < 3; ++i) {
    locks->hasWindowLock[i] = false;
    locks->ended[i] = false;
  }
  intake->consumedMeals.Init(&ctx.Memory());
  intake->activeMealsMask = 0;
  intake->itemCount = 0;
  intake->hasEnergy = true;
  intake->hasProtein = true;
  intake->hasFat = true;
  intake->hasCarb = true;
  intake->energyKcal = 0;
  intake->proteinDg = 0;
  intake->fatDg = 0;
  intake->carbDg = 0;
  intake->priceComplete = true;
  intake->knownPriceCents = 0;
  intake->unknownItemCount = 0;

  const JsonValue* state = JsonFind(request, "state");
  if (state == nullptr || state->kind == JsonKind::Null) {
    return true;
  }
  if (!RequireObjectType(ctx, state, "$.state")) {
    return false;
  }
  char statePath[192];
  SubPath(statePath, sizeof(statePath), "$", "state");

  const JsonValue* endedMeals = JsonFind(state, "endedMeals");
  if (endedMeals != nullptr && endedMeals->kind != JsonKind::Null) {
    if (!RequireArrayType(ctx, endedMeals,
                          SubPath(buffer, sizeof(buffer), statePath, "endedMeals"))) {
      return false;
    }
    for (const JsonValue* item = endedMeals->child; item != nullptr; item = item->next) {
      Str meal;
      if (!ReadString(ctx, item, SubPath(buffer, sizeof(buffer), statePath, "endedMeals"), &meal)) {
        return false;
      }
      const i64 mask = MealMaskFromName(meal);
      if (mask == 0) {
        return ctx.Fail("INVALID_INPUT", SubPath(buffer, sizeof(buffer), statePath, "endedMeals"),
                        "endedMeals 含未知餐次枚举值");
      }
      locks->ended[MealIndexFromMask(mask)] = true;
    }
  }

  const JsonValue* windowLocks = JsonFind(state, "windowLocks");
  if (windowLocks != nullptr && windowLocks->kind != JsonKind::Null) {
    if (!RequireArrayType(ctx, windowLocks,
                          SubPath(buffer, sizeof(buffer), statePath, "windowLocks"))) {
      return false;
    }
    for (const JsonValue* item = windowLocks->child; item != nullptr; item = item->next) {
      const JsonValue* mealValue = RequireMember(
          ctx, item, "meal", SubPath(buffer, sizeof(buffer), statePath, "windowLocks[].meal"));
      const JsonValue* windowValue = RequireMember(
          ctx, item, "windowId",
          SubPath(buffer, sizeof(buffer), statePath, "windowLocks[].windowId"));
      if (mealValue == nullptr || windowValue == nullptr) {
        return false;
      }
      Str meal;
      Str windowId;
      if (!ReadString(ctx, mealValue,
                      SubPath(buffer, sizeof(buffer), statePath, "windowLocks[].meal"), &meal) ||
          !ReadString(ctx, windowValue,
                      SubPath(buffer, sizeof(buffer), statePath, "windowLocks[].windowId"),
                      &windowId)) {
        return false;
      }
      const i64 mask = MealMaskFromName(meal);
      if (mask == 0) {
        return ctx.Fail("INVALID_INPUT",
                        SubPath(buffer, sizeof(buffer), statePath, "windowLocks[].meal"),
                        "windowLocks 含未知餐次枚举值");
      }
      locks->hasWindowLock[MealIndexFromMask(mask)] = true;
      locks->windowLockId[MealIndexFromMask(mask)] = windowId;
    }
  }

  const JsonValue* soldOut = JsonFind(state, "soldOut");
  if (soldOut != nullptr && soldOut->kind != JsonKind::Null) {
    if (!RequireArrayType(ctx, soldOut, SubPath(buffer, sizeof(buffer), statePath, "soldOut"))) {
      return false;
    }
    for (const JsonValue* item = soldOut->child; item != nullptr; item = item->next) {
      SoldOutRule rule;
      rule.hasWindow = false;
      rule.hasDish = false;
      rule.mealMask = 0;
      const JsonValue* mealValue = JsonFind(item, "meal");
      if (mealValue != nullptr && mealValue->kind != JsonKind::Null) {
        Str meal;
        if (!ReadString(ctx, mealValue,
                        SubPath(buffer, sizeof(buffer), statePath, "soldOut[].meal"), &meal)) {
          return false;
        }
        rule.mealMask = MealMaskFromName(meal);
        if (rule.mealMask == 0) {
          return ctx.Fail("INVALID_INPUT",
                          SubPath(buffer, sizeof(buffer), statePath, "soldOut[].meal"),
                          "soldOut 含未知餐次枚举值");
        }
      } else {
        rule.mealMask = kMealBreakfast | kMealLunch | kMealDinner;
      }
      const JsonValue* windowValue = JsonFind(item, "windowId");
      if (windowValue != nullptr && windowValue->kind == JsonKind::String) {
        rule.hasWindow = true;
        rule.windowId = windowValue->text;
      }
      const JsonValue* dishValue = JsonFind(item, "dishId");
      if (dishValue != nullptr && dishValue->kind == JsonKind::String) {
        rule.hasDish = true;
        rule.dishId = dishValue->text;
      }
      locks->soldOut.Push(rule);
    }
  }

  const JsonValue* itemLocks = JsonFind(state, "itemLocks");
  if (itemLocks != nullptr && itemLocks->kind != JsonKind::Null) {
    if (!RequireArrayType(ctx, itemLocks,
                          SubPath(buffer, sizeof(buffer), statePath, "itemLocks"))) {
      return false;
    }
    for (const JsonValue* item = itemLocks->child; item != nullptr; item = item->next) {
      ItemLock lock;
      lock.mealMask = 0;
      lock.quantity = 1;
      const JsonValue* mealValue = RequireMember(
          ctx, item, "meal", SubPath(buffer, sizeof(buffer), statePath, "itemLocks[].meal"));
      const JsonValue* offerValue = RequireMember(
          ctx, item, "offerId", SubPath(buffer, sizeof(buffer), statePath, "itemLocks[].offerId"));
      if (mealValue == nullptr || offerValue == nullptr) {
        return false;
      }
      Str meal;
      if (!ReadString(ctx, mealValue,
                      SubPath(buffer, sizeof(buffer), statePath, "itemLocks[].meal"), &meal)) {
        return false;
      }
      lock.mealMask = MealMaskFromName(meal);
      if (lock.mealMask == 0) {
        return ctx.Fail("INVALID_INPUT",
                        SubPath(buffer, sizeof(buffer), statePath, "itemLocks[].meal"),
                        "itemLocks 含未知餐次枚举值");
      }
      if (!ReadString(ctx, offerValue,
                      SubPath(buffer, sizeof(buffer), statePath, "itemLocks[].offerId"),
                      &lock.offerId)) {
        return false;
      }
      const JsonValue* quantityValue = JsonFind(item, "quantity");
      if (quantityValue != nullptr && quantityValue->kind != JsonKind::Null) {
        if (!ReadInt(ctx, quantityValue,
                     SubPath(buffer, sizeof(buffer), statePath, "itemLocks[].quantity"), 1, 10,
                     &lock.quantity)) {
          return false;
        }
      }
      locks->itemLocks.Push(lock);
    }
  }

  const JsonValue* activeLogs = JsonFind(state, "activeLogs");
  if (activeLogs != nullptr && activeLogs->kind != JsonKind::Null) {
    if (!RequireArrayType(ctx, activeLogs,
                          SubPath(buffer, sizeof(buffer), statePath, "activeLogs"))) {
      return false;
    }
    Vec<Str> seenRecordIds;
    seenRecordIds.Init(&ctx.Memory());

    for (const JsonValue* log = activeLogs->child; log != nullptr; log = log->next) {
      if (!RequireObjectType(ctx, log,
                             SubPath(buffer, sizeof(buffer), statePath, "activeLogs[]"))) {
        return false;
      }
      // 校验 recordId 唯一性（契约 §4 L3）
      const JsonValue* recIdVal = JsonFind(log, "recordId");
      if (recIdVal != nullptr && recIdVal->kind == JsonKind::String) {
        for (usize r = 0; r < seenRecordIds.Size(); ++r) {
          if (seenRecordIds[r].Equals(recIdVal->text)) {
            return ctx.Fail("INVALID_INPUT",
                            SubPath(buffer, sizeof(buffer), statePath, "activeLogs[].recordId"),
                            "activeLogs 存在重复的 recordId");
          }
        }
        seenRecordIds.Push(recIdVal->text);
      }
      // 校验日志 businessDate 必须等于请求 businessDate（契约 §4 L3）
      const JsonValue* logDateVal = JsonFind(log, "businessDate");
      if (logDateVal != nullptr && logDateVal->kind == JsonKind::String &&
          !logDateVal->text.Equals(requestBusinessDate)) {
        return ctx.Fail("INVALID_INPUT",
                        SubPath(buffer, sizeof(buffer), statePath, "activeLogs[].businessDate"),
                        "activeLogs.businessDate 必须与请求 businessDate 一致");
      }

      const JsonValue* statusValue = JsonFind(log, "status");
      if (statusValue != nullptr && statusValue->kind == JsonKind::String &&
          !statusValue->text.Equals("active")) {
        continue;
      }
      const JsonValue* mealValue = JsonFind(log, "meal");
      if (mealValue != nullptr && mealValue->kind == JsonKind::String) {
        const i64 mask = MealMaskFromName(mealValue->text);
        if (mask != 0) {
          intake->activeMealsMask |= mask;
          bool seen = false;
          for (usize i = 0; i < intake->consumedMeals.Size(); ++i) {
            if (intake->consumedMeals[i].Equals(MealNameFromMask(mask))) {
              seen = true;
              break;
            }
          }
          if (!seen) {
            intake->consumedMeals.Push(MealNameFromMask(mask));
          }
        }
      }
      const JsonValue* items = JsonFind(log, "items");
      if (items == nullptr || items->kind != JsonKind::Array) {
        continue;
      }
      for (const JsonValue* entry = items->child; entry != nullptr; entry = entry->next) {
        i64 quantity = 1;
        const JsonValue* quantityValue = JsonFind(entry, "quantity");
        if (quantityValue != nullptr && quantityValue->kind == JsonKind::Number) {
          quantity = quantityValue->number;
        }
        intake->itemCount += quantity;
        const JsonValue* priceKnown = JsonFind(entry, "priceKnown");
        const JsonValue* unitPrice = JsonFind(entry, "unitPriceCents");
        if (priceKnown != nullptr && priceKnown->kind == JsonKind::Bool && priceKnown->boolean &&
            unitPrice != nullptr && unitPrice->kind == JsonKind::Number) {
          intake->knownPriceCents += unitPrice->number * quantity;
        } else {
          // 未知价处理：该日志不计入已知支出、也不当作 0 元；整体价格记账标记不完整并计数。
          intake->priceComplete = false;
          ++intake->unknownItemCount;
        }
        const JsonValue* nutrition = JsonFind(entry, "nutrition");
        // 整条日志营养缺失：四项全部标记未知（未知 ≠ 0），不再累加任何数值。
        if (nutrition == nullptr || nutrition->kind != JsonKind::Object) {
          intake->hasEnergy = false;
          intake->hasProtein = false;
          intake->hasFat = false;
          intake->hasCarb = false;
          ++intake->unknownItemCount;
          continue;
        }
        struct Field {
          const char* key;
          bool* has;
          i64* target;
        } fields[] = {{"energyKcal", &intake->hasEnergy, &intake->energyKcal},
                      {"proteinDg", &intake->hasProtein, &intake->proteinDg},
                      {"fatDg", &intake->hasFat, &intake->fatDg},
                      {"carbDg", &intake->hasCarb, &intake->carbDg}};
        for (usize f = 0; f < 4; ++f) {
          const JsonValue* value = JsonFind(nutrition, fields[f].key);
          if (value == nullptr || value->kind == JsonKind::Null) {
            // 单分量 null/缺失 = 该营养素未知（而非 0），整体完整性随 AddNutrition 的位与语义传播。
            *fields[f].has = false;
            continue;
          }
          if (value->kind == JsonKind::Number) {
            *fields[f].target += value->number * quantity;
          }
        }
      }
    }
  }
  return true;
}

// 口味词解析：profile 或 tastes 缺失/null 一律按“无偏好”处理（返回空表，不报错）；
// 非空时逐项校验字符串类型，命中计分语义见 ComputeOfferPreferenceScore。
bool ParseTastes(ExecContext& ctx, const JsonValue* request, Vec<Str>* tastes) {
  tastes->Init(&ctx.Memory());
  const JsonValue* profile = JsonFind(request, "profile");
  if (profile == nullptr || profile->kind != JsonKind::Object) {
    return true;
  }
  const JsonValue* value = JsonFind(profile, "tastes");
  if (value == nullptr || value->kind == JsonKind::Null) {
    return true;
  }
  if (!RequireArrayType(ctx, value, "$.profile.tastes")) {
    return false;
  }
  for (const JsonValue* item = value->child; item != nullptr; item = item->next) {
    Str taste;
    if (!ReadString(ctx, item, "$.profile.tastes[]", &taste)) {
      return false;
    }
    tastes->Push(taste);
  }
  return true;
}

// ---------------------------------------------------------------------------
// JSON 响应子树序列化（含契约 §5 规范 search 块与全维度独立 flags）
// ---------------------------------------------------------------------------

// 目标宏量对象：kcal/dg 整数，无 null 分量；目标不可用时整个 targets 块不输出
//（TargetUnavailable 状态下响应不含 targets，见 WritePlanResult）。
void WriteMacrosJson(JsonOut& out, const MacroTargets& macros) {
  out.BeginObject();
  out.WriteKey("energyKcal");
  out.WriteNumber(macros.energyKcal);
  out.WriteKey("proteinDg");
  out.WriteNumber(macros.proteinDg);
  out.WriteKey("fatDg");
  out.WriteNumber(macros.fatDg);
  out.WriteKey("carbDg");
  out.WriteNumber(macros.carbDg);
  out.EndObject();
}

// 已知营养对象序列化：未知分量写 null（语义=无数据，绝不写 0）；能量单位 kcal，
// 蛋白/脂肪/碳水单位 dg（分克）。字段顺序为契约固定顺序，不按字典序重排。
void WriteNutritionKnown(JsonOut& out, const NutritionValues& values) {
  out.BeginObject();
  out.WriteKey("energyKcal");
  if (values.hasEnergy) {
    out.WriteNumber(values.energyKcal);
  } else {
    out.WriteNull();
  }
  out.WriteKey("proteinDg");
  if (values.hasProtein) {
    out.WriteNumber(values.proteinDg);
  } else {
    out.WriteNull();
  }
  out.WriteKey("fatDg");
  if (values.hasFat) {
    out.WriteNumber(values.fatDg);
  } else {
    out.WriteNull();
  }
  out.WriteKey("carbDg");
  if (values.hasCarb) {
    out.WriteNumber(values.carbDg);
  } else {
    out.WriteNull();
  }
  out.EndObject();
}

// 未知分量名列表：与 knownSums 的 null 分量一一对应，供前端逐项提示缺失的营养素。
void WriteIncompleteNutrients(JsonOut& out, const NutritionValues& values) {
  out.BeginArray();
  if (!values.hasEnergy) {
    out.WriteString(Str("energyKcal"));
  }
  if (!values.hasProtein) {
    out.WriteString(Str("proteinDg"));
  }
  if (!values.hasFat) {
    out.WriteString(Str("fatDg"));
  }
  if (!values.hasCarb) {
    out.WriteString(Str("carbDg"));
  }
  out.EndArray();
}

// 单餐对象序列化：items 已按 offerId 升序规范化；priceCents=null 表示价格未知（区别于 0 元）；
// unknownItemRefs 收集营养不完整的 offerId；locked 为生成时快照（见下方 item 循环内说明）。
void WriteMealJson(JsonOut& out, const MealPlan& meal, const MacroTargets& referenceTarget) {
  out.BeginObject();
  out.WriteKey("meal");
  out.WriteString(meal.mealName);
  out.WriteKey("windowId");
  if (meal.windowId.Empty()) {
    out.WriteNull();
  } else {
    out.WriteString(meal.windowId);
  }
  out.WriteKey("items");
  out.BeginArray();
  for (usize i = 0; i < meal.items.Size(); ++i) {
    const PlannedItem& item = meal.items[i];
    out.BeginObject();
    out.WriteKey("offerId");
    out.WriteString(item.offerId);
    out.WriteKey("dishId");
    out.WriteString(item.dishId);
    out.WriteKey("portionCode");
    out.WriteString(item.portionCode);
    out.WriteKey("quantity");
    out.WriteNumber(static_cast<i64>(1));
    out.WriteKey("priceCents");
    if (item.priceKnown) {
      out.WriteNumber(item.priceCents);
    } else {
      out.WriteNull();
    }
    out.WriteKey("nutrition");
    WriteNutritionKnown(out, item.nutrition);
    // T01 v1 §5 meals[].items[] 明列 locked：按 MakePlannedItem 已有的 item.locked 快照原样写出，
    // 不重新计算；false=该 item 由搜索自由选入，true=生成时由 state.itemLocks 固定入选。
    out.WriteKey("locked");
    out.WriteBool(item.locked);
    out.EndObject();
  }
  out.EndArray();
  out.WriteKey("nutrition");
  out.BeginObject();
  out.WriteKey("knownSums");
  WriteNutritionKnown(out, meal.sums);
  out.WriteKey("incompleteNutrients");
  WriteIncompleteNutrients(out, meal.sums);
  out.WriteKey("unknownItemRefs");
  out.BeginArray();
  for (usize i = 0; i < meal.items.Size(); ++i) {
    if (!meal.items[i].nutrition.Complete()) {
      out.WriteString(meal.items[i].offerId);
    }
  }
  out.EndArray();
  out.EndObject();
  out.WriteKey("nutritionReferenceTarget");
  WriteMacrosJson(out, referenceTarget);
  out.WriteKey("windowLocked");
  out.WriteBool(meal.windowLocked);
  out.EndObject();
}

// 写出单方案的独立标志列表（契约 §6）：
//   * 保持与 T02 v2 verify_planday.py 的完全兼容，同时对 DP 离散化、候选限额截断、未知锁定项等打标
void WritePlanFlags(JsonOut& out, const PlanCandidate& plan, const IntakeSummary& intake,
                    bool hasBudget, const SearchTracker& tracker) {
  out.BeginArray();
  if (!plan.nutritionComplete) {
    out.WriteString(Str("NUTRITION_INCOMPLETE"));
  }
  if (plan.lockedUnknownNutrition) {
    out.WriteString(Str("LOCKED_UNKNOWN_NUTRITION"));
  }
  if (!plan.priceComplete) {
    out.WriteString(Str("PRICE_INCOMPLETE"));
  }
  if (hasBudget && (!intake.priceComplete || !plan.priceComplete)) {
    out.WriteString(Str("BUDGET_ACCOUNTING_INCOMPLETE"));
  }
  if (plan.estimatedData) {
    out.WriteString(Str("ESTIMATED_DATA"));
  }
  if (plan.overBudget) {
    out.WriteString(Str("OVER_BUDGET_ALTERNATIVE"));
  }
  if (tracker.anyCandidateCapHit) {
    out.WriteString(Str("APPROXIMATE_CANDIDATES"));
  }
  if (tracker.anyDpCapHit) {
    out.WriteString(Str("APPROXIMATE_DISCRETIZATION"));
  }
  if (tracker.anyWallClockCapHit) {
    out.WriteString(Str("APPROXIMATE_TIMEOUT"));
  }
  if (plan.limitReached) {
    out.WriteString(Str("SEARCH_LIMIT_REACHED"));
  }
  out.EndArray();
}

// 全天方案序列化。预算域口径（known_only）：仅当已吃价格完整时才给出剩余/超额的 known 值，
// 否则 remainingBudgetKnownCents=null（无法可信计算，不冒充 0）；score.priceCents=null 表示
// 方案含未知价；超预算方案以 OVER_BUDGET_ALTERNATIVE 标记，与预算内备选相区分。
void WritePlanJson(JsonOut& out, const PlanCandidate& plan, const PlanTargetSnapshot& target,
                   const PlannerConfigInput& config, const IntakeSummary& intake,
                   const SearchTracker& tracker) {
  i64 remainingKnown = 0;
  bool remainingKnownValid = false;
  if (config.hasBudget && intake.priceComplete) {
    remainingKnown = config.budgetCents - intake.knownPriceCents;
    if (remainingKnown < 0) {
      remainingKnown = 0;
    }
    remainingKnownValid = true;
  }
  const bool withinBudgetKnown =
      remainingKnownValid && plan.priceComplete &&
      (plan.knownPriceCents + intake.knownPriceCents <= config.budgetCents);
  i64 overage = 0;
  if (remainingKnownValid &&
      plan.knownPriceCents + intake.knownPriceCents > config.budgetCents) {
    overage = (plan.knownPriceCents + intake.knownPriceCents) - config.budgetCents;
  }
  const bool overBudget =
      config.hasBudget && remainingKnownValid &&
      (plan.knownPriceCents + intake.knownPriceCents > config.budgetCents);

  out.BeginObject();
  out.WriteKey("planKey");
  out.WriteString(plan.planKey);
  out.WriteKey("strategy");
  out.WriteString(plan.strategy);
  out.WriteKey("offeredAs");
  out.BeginArray();
  for (usize s = 0; s < plan.offeredAs.Size(); ++s) {
    out.WriteString(plan.offeredAs[s]);
  }
  out.EndArray();
  out.WriteKey("meals");
  out.BeginArray();
  for (usize m = 0; m < plan.meals.Size(); ++m) {
    const i64 mealIndex = MealIndexFromMask(plan.meals[m].mealMask);
    WriteMealJson(out, plan.meals[m], MealTargetOf(target, mealIndex));
  }
  out.EndArray();
  out.WriteKey("score");
  out.BeginObject();
  out.WriteKey("nutritionCompleteness");
  out.WriteString(plan.nutritionComplete ? Str("complete") : Str("incomplete"));
  out.WriteKey("comparisonBasis");
  out.WriteString(Str("known_sums"));
  out.WriteKey("nutritionDeviationBp");
  out.WriteNumber(plan.deviationBp);
  out.WriteKey("nutritionTier");
  out.WriteNumber(plan.tier);
  out.WriteKey("preferenceScore");
  out.WriteNumber(plan.preferenceScore);
  out.WriteKey("priceCents");
  if (plan.priceComplete) {
    out.WriteNumber(plan.knownPriceCents);
  } else {
    out.WriteNull();
  }
  out.WriteKey("diversity");
  out.BeginObject();
  out.WriteKey("categoryCoverage");
  out.WriteNumber(plan.categoryCoverage);
  out.WriteKey("repeatedDishCount");
  out.WriteNumber(plan.repeatedDishCount);
  out.WriteKey("unknownCategoryItemCount");
  out.WriteNumber(plan.unknownCategoryCount);
  out.EndObject();
  out.EndObject();
  out.WriteKey("budget");
  out.BeginObject();
  out.WriteKey("budgetCents");
  if (config.hasBudget) {
    out.WriteNumber(config.budgetCents);
  } else {
    out.WriteNull();
  }
  out.WriteKey("remainingBudgetKnownCents");
  if (remainingKnownValid) {
    out.WriteNumber(remainingKnown);
  } else {
    out.WriteNull();
  }
  out.WriteKey("plannedTotalCents");
  if (plan.priceComplete) {
    out.WriteNumber(plan.knownPriceCents);
  } else {
    out.WriteNull();
  }
  out.WriteKey("plannedTotalKnownCents");
  out.WriteNumber(plan.knownPriceCents);
  out.WriteKey("priceIncomplete");
  out.WriteBool(!plan.priceComplete);
  out.WriteKey("overBudget");
  out.WriteBool(overBudget || plan.overBudget);
  out.WriteKey("withinBudgetKnownAmounts");
  out.WriteBool(withinBudgetKnown);
  out.WriteKey("overageCents");
  if (remainingKnownValid) {
    out.WriteNumber(overage);
  } else {
    out.WriteNull();
  }
  out.WriteKey("checkBasis");
  out.WriteString(Str("known_only"));
  out.EndObject();
  out.WriteKey("flags");
  WritePlanFlags(out, plan, intake, config.hasBudget, tracker);
  out.EndObject();
}

void WriteIntakeSummary(JsonOut& out, const IntakeSummary& intake) {
  out.BeginObject();
  out.WriteKey("consumedMeals");
  out.BeginArray();
  for (usize i = 0; i < intake.consumedMeals.Size(); ++i) {
    out.WriteString(intake.consumedMeals[i]);
  }
  out.EndArray();
  out.WriteKey("itemCount");
  out.WriteNumber(intake.itemCount);
  out.WriteKey("knownSums");
  out.BeginObject();
  out.WriteKey("energyKcal");
  if (intake.hasEnergy) {
    out.WriteNumber(intake.energyKcal);
  } else {
    out.WriteNull();
  }
  out.WriteKey("proteinDg");
  if (intake.hasProtein) {
    out.WriteNumber(intake.proteinDg);
  } else {
    out.WriteNull();
  }
  out.WriteKey("fatDg");
  if (intake.hasFat) {
    out.WriteNumber(intake.fatDg);
  } else {
    out.WriteNull();
  }
  out.WriteKey("carbDg");
  if (intake.hasCarb) {
    out.WriteNumber(intake.carbDg);
  } else {
    out.WriteNull();
  }
  out.EndObject();
  out.WriteKey("priceComplete");
  out.WriteBool(intake.priceComplete);
  out.WriteKey("knownPriceCents");
  out.WriteNumber(intake.knownPriceCents);
  out.WriteKey("unknownItemCount");
  out.WriteNumber(intake.unknownItemCount);
  out.EndObject();
}

void WriteInputDigests(JsonOut& out, const Catalog& catalog, const PlanTargetSnapshot& target,
                       i64 profileRevision) {
  out.BeginObject();
  out.WriteKey("menuVersion");
  out.WriteString(catalog.menuVersion);
  out.WriteKey("catalogHash");
  out.WriteString(catalog.catalogHash);
  out.WriteKey("nutritionConfigHash");
  out.WriteString(Str(target.nutritionConfigHash));
  out.WriteKey("profileRevision");
  out.WriteNumber(profileRevision);
  out.EndObject();
}

// 写出契约 §5 / P01 T04 裁定规定的规范 result.search 对象：
//   {
//     "algorithm": "greedy" | "dp" | "branchAndBound",
//     "searchComplete": bool,
//     "candidatesEnumerated": { "breakfast"?: int, "lunch"?: int, "dinner"?: int },
//     "nodesEvaluated": int | null,
//     "statesEvaluated": int | null,
//     "capsHit": [ { "limit", "limitValue", "observed", "meal"? } ],
//     "approximations": [ { "kind", "scope", "value"?, "limit"?, "detail"? } ]
//   }
// 规范 search 块（契约 §5）：candidatesEnumerated 按餐次给出层一枚举数（含候选截断后的值）；
// nodesEvaluated/statesEvaluated 依算法二选一输出（另一项为 null，不是 0）；capsHit 按来源
// 去重取最大 observed；approximations 只记首触。searchComplete=false 时必有对应 capsHit。
// 跟踪器不含任何时序噪声：同一输入在双端产生逐字节相同的 search 块。
void WriteCanonicalSearchBlock(JsonOut& out, const Vec<i64>& planningMasks,
                               const SearchTracker& tracker) {
  out.BeginObject();
  out.WriteKey("algorithm");
  out.WriteString(tracker.algorithm);
  out.WriteKey("searchComplete");
  out.WriteBool(tracker.searchComplete);

  out.WriteKey("candidatesEnumerated");
  out.BeginObject();
  for (usize i = 0; i < planningMasks.Size(); ++i) {
    const i64 mIdx = MealIndexFromMask(planningMasks[i]);
    const Str mName = MealNameFromMask(planningMasks[i]);
    out.WriteKey(mName);
    out.WriteNumber(tracker.hasMealEnum[mIdx] ? tracker.candidatesEnumerated[mIdx] : 0);
  }
  out.EndObject();

  out.WriteKey("nodesEvaluated");
  if (tracker.hasNodesEvaluated) {
    out.WriteNumber(tracker.nodesEvaluated);
  } else {
    out.WriteNull();
  }

  out.WriteKey("statesEvaluated");
  if (tracker.hasStatesEvaluated) {
    out.WriteNumber(tracker.statesEvaluated);
  } else {
    out.WriteNull();
  }

  out.WriteKey("capsHit");
  out.BeginArray();
  for (usize i = 0; i < tracker.capsHit.Size(); ++i) {
    const CapHitRecord& cap = tracker.capsHit[i];
    out.BeginObject();
    out.WriteKey("limit");
    out.WriteString(cap.limit);
    out.WriteKey("limitValue");
    out.WriteNumber(cap.limitValue);
    out.WriteKey("observed");
    out.WriteNumber(cap.observed);
    if (cap.hasMeal) {
      out.WriteKey("meal");
      out.WriteString(cap.meal);
    }
    out.EndObject();
  }
  out.EndArray();

  out.WriteKey("approximations");
  out.BeginArray();
  for (usize i = 0; i < tracker.approximations.Size(); ++i) {
    const ApproxRecord& app = tracker.approximations[i];
    out.BeginObject();
    out.WriteKey("kind");
    out.WriteString(app.kind);
    out.WriteKey("scope");
    out.WriteString(app.scope);
    if (app.hasValue) {
      out.WriteKey("value");
      out.WriteNumber(app.value);
    }
    if (app.hasLimit) {
      out.WriteKey("limit");
      out.WriteNumber(app.limit);
    }
    if (!app.detail.Empty()) {
      out.WriteKey("detail");
      out.WriteString(app.detail);
    }
    out.EndObject();
  }
  out.EndArray();

  out.EndObject();
}

i64 DetectProfileRevision(const JsonValue* request) {
  const JsonValue* profile = JsonFind(request, "profile");
  if (profile == nullptr) {
    return 0;
  }
  const JsonValue* revision = JsonFind(profile, "revision");
  if (revision == nullptr || revision->kind != JsonKind::Number) {
    return 0;
  }
  return revision->number;
}

// PlanDay 主响应生成入口
bool WritePlanResult(ExecContext& ctx, const JsonValue* request, TextBuffer* out) {
  const JsonValue* businessDate = RequireMember(ctx, request, "businessDate", "$.businessDate");
  Str businessDateText;
  if (businessDate == nullptr ||
      !ReadString(ctx, businessDate, "$.businessDate", &businessDateText)) {
    return false;
  }
  const JsonValue* tzValue = RequireMember(ctx, request, "tzOffsetMinutes", "$.tzOffsetMinutes");
  i64 tzOffset = 0;
  if (tzValue == nullptr || !ReadInt(ctx, tzValue, "$.tzOffsetMinutes", -720, 840, &tzOffset)) {
    return false;
  }

  PlanTargetSnapshot target;
  if (!ComputeTargetForPlanning(ctx, request, &target)) {
    return false;
  }

  const JsonValue* catalogValue = RequireMember(ctx, request, "catalog", "$.catalog");
  if (catalogValue == nullptr) {
    return false;
  }
  Catalog catalog;
  if (!ParseCatalog(ctx, catalogValue, "$.catalog", &catalog)) {
    return false;
  }
  if (!ValidateCatalogSemantics(ctx, &catalog, "$.catalog")) {
    return false;
  }

  PlannerConfigInput config;
  config.strategies.Init(&ctx.Memory());
  if (!ParsePlannerConfig(ctx, request, &config)) {
    return false;
  }

  Vec<i64> planningMasks;
  planningMasks.Init(&ctx.Memory());
  if (!ParsePlanningMeals(ctx, request, &planningMasks)) {
    return false;
  }

  LockSet locks;
  IntakeSummary intake;
  if (!ParseState(ctx, request, businessDateText, &locks, &intake)) {
    return false;
  }

  // 契约 §4 L4：已结束餐次（endedMeals）或已有有效日志（activeLogs）的餐次不得出现在 planningMeals 中
  for (usize i = 0; i < planningMasks.Size(); ++i) {
    if (locks.ended[MealIndexFromMask(planningMasks[i])]) {
      return ctx.Fail("INVALID_INPUT", "$.planningMeals",
                      "已结束的餐次（endedMeals）不能出现在 planningMeals 中");
    }
    if ((intake.activeMealsMask & planningMasks[i]) != 0) {
      return ctx.Fail("INVALID_INPUT", "$.planningMeals",
                      "已有有效就餐记录（activeLogs）的餐次不能重复出现在 planningMeals 中");
    }
  }

  Vec<Str> tastes;
  if (!ParseTastes(ctx, request, &tastes)) {
    return false;
  }

  SearchTracker tracker;
  tracker.Init(&ctx.Memory(), config.algorithm);

  // 全局前置检查 itemLocks 中指向非规划餐次的锁定项是否存在/售罄冲突
  bool lockConflict = false;
  for (usize i = 0; i < locks.itemLocks.Size(); ++i) {
    const ItemLock& lock = locks.itemLocks[i];
    const OfferRecord* found = FindOfferAnywhere(catalog, lock.offerId);
    if (found == nullptr || !OfferServesMeal(*found, lock.mealMask) ||
        IsOfferSoldOut(locks, lock.mealMask, *found)) {
      lockConflict = true;
      break;
    }
  }

  const i64 profileRevision = DetectProfileRevision(request);

  Str status;
  Str infeasibleReason;
  Vec<PlanCandidate> strategyPlans;
  strategyPlans.Init(&ctx.Memory());
  Vec<MealCandidateSet> mealSets;
  mealSets.Init(&ctx.Memory());
  bool anyViable = false;

  if (!target.usableForAutoPlanning) {
    status = Str("TargetUnavailable");
  } else {
    if (!tracker.StartClock(ctx, config.limits)) return false;
    // 执行层一（Layer 1）单餐候选生成
    for (usize m = 0; m < planningMasks.Size(); ++m) {
      MealCandidateSet mSet;
      if (!EnumerateMealCandidates(ctx, catalog, locks, config, tastes, planningMasks[m], &tracker,
                                   &mSet, &lockConflict)) {
        return false;
      }
      if (lockConflict) {
        break;
      }
      mealSets.Push(mSet);
      if (tracker.Stop(ctx)) break;
    }

    if (ctx.Failed()) return false;
    if (lockConflict) {
      status = Str("LockConflict");
    } else if (tracker.anyWallClockCapHit) {
      status = Str("ResourceLimited");
      infeasibleReason = Str("search_limit_reached");
    } else {
      // 检查是否存在某餐完全无合法单餐候选的情况
      bool anyMealEmpty = false;
      bool emptyDueToIncompleteNutrition = false;
      bool emptyDueToCandidateCap = false;
      for (usize m = 0; m < mealSets.Size(); ++m) {
        if (mealSets[m].candidates.Empty()) {
          anyMealEmpty = true;
          if (mealSets[m].incompleteNutritionOffersCount > 0 &&
              mealSets[m].totalEligibleOffersCount == mealSets[m].incompleteNutritionOffersCount) {
            emptyDueToIncompleteNutrition = true;
          }
          if (mealSets[m].candidateCapHit) {
            emptyDueToCandidateCap = true;
          }
        }
      }

      if (anyMealEmpty) {
        if (config.algorithm.Equals("dp")) {
          tracker.hasStatesEvaluated = true;
          tracker.statesEvaluated = 0;
        } else {
          tracker.hasNodesEvaluated = true;
          tracker.nodesEvaluated = 0;
        }
        tracker.searchComplete = !tracker.anyCandidateCapHit && !config.algorithm.Equals("greedy");
        if (config.algorithm.Equals("greedy")) {
          tracker.AddApproximation(
              Str("APPROXIMATE_CANDIDATES"), Str("allMeals"), false, 0, false, 0,
              Str("greedy per-meal local selection without full-day exhaustive search"));
        }
        if (emptyDueToCandidateCap) {
          status = Str("ResourceLimited");
          infeasibleReason = Str("search_limit_reached");
        } else if (emptyDueToIncompleteNutrition) {
          status = Str("NutritionDataInsufficient");
        } else {
          status = Str("NoFeasible");
        }
      } else {
        // 按请求的 algorithm 分派给对应的手写算法
        bool algoOk = false;
        if (config.algorithm.Equals("greedy")) {
          algoOk = RunGreedyAlgorithm(ctx, catalog, target, config, intake, mealSets, &tracker,
                                      &strategyPlans);
        } else if (config.algorithm.Equals("dp")) {
          algoOk = RunDpAlgorithm(ctx, catalog, target, config, intake, mealSets, &tracker,
                                  &strategyPlans);
        } else {
          algoOk = RunBranchAndBoundAlgorithm(ctx, catalog, target, config, intake, mealSets,
                                              &tracker, &strategyPlans);
        }
        if (!algoOk) {
          return false;
        }
        tracker.Stop(ctx);
        if (ctx.Failed()) return false;
        if (tracker.anyWallClockCapHit) {
          for (usize i = 0; i < strategyPlans.Size(); ++i) {
            strategyPlans[i].limitReached = true;
            strategyPlans[i].approxTimeout = true;
          }
        }

        anyViable = !strategyPlans.Empty();
        if (!anyViable) {
          // 契约要求：限额耗尽尚未找到解时必须报 ResourceLimited，绝不伪称 NoFeasible
          if (!tracker.capsHit.Empty()) {
            status = Str("ResourceLimited");
            infeasibleReason = Str("search_limit_reached");
          } else {
            status = Str("NoFeasible");
          }
        } else {
          bool anyOverBudget = false;
          bool anyPartialFlag = false;
          for (usize i = 0; i < strategyPlans.Size(); ++i) {
            if (config.hasBudget && strategyPlans[i].overBudget) {
              anyOverBudget = true;
            }
            if (!strategyPlans[i].nutritionComplete || !strategyPlans[i].priceComplete ||
                strategyPlans[i].estimatedData || strategyPlans[i].limitReached ||
                tracker.anyCandidateCapHit || tracker.anyDpCapHit || tracker.anyWallClockCapHit ||
                (config.hasBudget && !intake.priceComplete)) {
              anyPartialFlag = true;
            }
          }
          // 状态分界：任何近似/不完整/限额触发 → OkPartial；全部候选均超预算且无时限触发 →
          // NoFeasibleWithinBudget（预算内无解，区别于 NoFeasible 的全局无解）。
          if (config.hasBudget && anyOverBudget && !tracker.anyWallClockCapHit) {
            status = Str("NoFeasibleWithinBudget");
          } else {
            status = anyPartialFlag ? Str("OkPartial") : Str("Ok");
          }
          if (!tracker.capsHit.Empty()) {
            infeasibleReason = Str("search_limit_reached");
          }
        }
      }
    }
  }

  // 跨策略去重（按 planKey，保持请求策略顺序），并将相同方案的全部归属策略合并进 offeredAs
  Vec<PlanCandidate> distinct;
  distinct.Init(&ctx.Memory());
  for (usize i = 0; i < strategyPlans.Size(); ++i) {
    bool duplicate = false;
    for (usize k = 0; k < distinct.Size(); ++k) {
      if (distinct[k].planKey.Equals(strategyPlans[i].planKey)) {
        duplicate = true;
        break;
      }
    }
    if (!duplicate) {
      distinct.Push(strategyPlans[i]);
    }
  }
  for (usize i = 0; i < distinct.Size(); ++i) {
    Vec<Str> merged;
    merged.Init(&ctx.Memory());
    for (usize s = 0; s < config.strategies.Size(); ++s) {
      bool produced = false;
      for (usize k = 0; k < strategyPlans.Size(); ++k) {
        if (strategyPlans[k].strategy.Equals(config.strategies[s]) &&
            strategyPlans[k].planKey.Equals(distinct[i].planKey)) {
          produced = true;
          break;
        }
      }
      if (produced) {
        merged.Push(config.strategies[s]);
      }
    }
    if (merged.Empty()) {
      merged.Push(distinct[i].strategy);
    }
    distinct[i].offeredAs = merged;
  }

  JsonOut writer(out);
  writer.BeginObject();
  writer.WriteKey("status");
  writer.WriteString(status);
  if (status.Equals("TargetUnavailable")) {
    writer.WriteKey("targetStatus");
    writer.WriteString(target.status);
    writer.WriteKey("targetReasons");
    writer.BeginArray();
    for (usize i = 0; i < target.reasons.Size(); ++i) {
      writer.WriteString(target.reasons[i]);
    }
    writer.EndArray();
  }
  writer.WriteKey("businessDate");
  writer.WriteString(businessDateText);
  writer.WriteKey("tzOffsetMinutes");
  writer.WriteNumber(tzOffset);

  writer.WriteKey("mealOutcomes");
  writer.BeginArray();
  if (!distinct.Empty()) {
    const PlanCandidate& chosen = distinct[0];
    for (usize m = 0; m < chosen.meals.Size(); ++m) {
      const MealPlan& meal = chosen.meals[m];
      writer.BeginObject();
      writer.WriteKey("meal");
      writer.WriteString(meal.mealName);
      writer.WriteKey("windowId");
      if (meal.windowId.Empty()) {
        writer.WriteNull();
      } else {
        writer.WriteString(meal.windowId);
      }
      writer.WriteKey("status");
      writer.WriteString(meal.items.Empty() ? Str("no_candidate") : Str("planned"));
      writer.WriteKey("itemCount");
      writer.WriteNumber(static_cast<i64>(meal.items.Size()));
      writer.WriteKey("candidateCount");
      writer.WriteNumber(meal.candidateCount);
      writer.WriteKey("nutritionComplete");
      writer.WriteBool(meal.nutritionComplete);
      writer.WriteKey("priceComplete");
      writer.WriteBool(meal.priceComplete);
      writer.EndObject();
    }
  } else {
    for (usize i = 0; i < planningMasks.Size(); ++i) {
      writer.BeginObject();
      writer.WriteKey("meal");
      writer.WriteString(MealNameFromMask(planningMasks[i]));
      writer.WriteKey("windowId");
      writer.WriteNull();
      writer.WriteKey("status");
      writer.WriteString(Str("not_planned"));
      writer.WriteKey("itemCount");
      writer.WriteNumber(static_cast<i64>(0));
      writer.WriteKey("candidateCount");
      writer.WriteNumber(static_cast<i64>(0));
      writer.WriteKey("nutritionComplete");
      writer.WriteBool(false);
      writer.WriteKey("priceComplete");
      writer.WriteBool(false);
      writer.EndObject();
    }
  }
  writer.EndArray();

  writer.WriteKey("inputDigests");
  WriteInputDigests(writer, catalog, target, profileRevision);

  if (status.Equals("Ok") || status.Equals("OkPartial") ||
      status.Equals("NoFeasibleWithinBudget")) {
    writer.WriteKey("targets");
    writer.BeginObject();
    writer.WriteKey("daily");
    WriteMacrosJson(writer, target.daily);
    writer.WriteKey("mealReference");
    writer.BeginObject();
    writer.WriteKey("breakfast");
    WriteMacrosJson(writer, target.mealBreakfast);
    writer.WriteKey("lunch");
    WriteMacrosJson(writer, target.mealLunch);
    writer.WriteKey("dinner");
    WriteMacrosJson(writer, target.mealDinner);
    writer.EndObject();
    writer.EndObject();
  }

  writer.WriteKey("strategyOutcome");
  writer.BeginArray();
  for (usize s = 0; s < config.strategies.Size(); ++s) {
    writer.BeginObject();
    writer.WriteKey("strategy");
    writer.WriteString(config.strategies[s]);
    Str planKey;
    bool applied = false;
    for (usize i = 0; i < distinct.Size() && !applied; ++i) {
      for (usize k = 0; k < distinct[i].offeredAs.Size(); ++k) {
        if (distinct[i].offeredAs[k].Equals(config.strategies[s])) {
          planKey = distinct[i].planKey;
          applied = true;
          break;
        }
      }
    }
    writer.WriteKey("applied");
    writer.WriteBool(applied);
    writer.WriteKey("planKey");
    if (applied) {
      writer.WriteString(planKey);
    } else {
      writer.WriteNull();
    }
    writer.WriteKey("status");
    writer.WriteString(applied ? status : (anyViable ? Str("duplicate_plan") : status));
    writer.EndObject();
  }
  writer.EndArray();

  writer.WriteKey("plans");
  writer.BeginArray();
  for (usize i = 0; i < distinct.Size(); ++i) {
    WritePlanJson(writer, distinct[i], target, config, intake, tracker);
  }
  writer.EndArray();

  writer.WriteKey("intakeSummary");
  WriteIntakeSummary(writer, intake);

  writer.WriteKey("budgetSummary");
  writer.BeginObject();
  writer.WriteKey("budgetCents");
  if (config.hasBudget) {
    writer.WriteNumber(config.budgetCents);
  } else {
    writer.WriteNull();
  }
  writer.WriteKey("spentKnownCents");
  writer.WriteNumber(intake.knownPriceCents);
  writer.WriteKey("remainingBudgetKnownCents");
  if (config.hasBudget && intake.priceComplete) {
    i64 remaining = config.budgetCents - intake.knownPriceCents;
    writer.WriteNumber(remaining < 0 ? 0 : remaining);
  } else {
    writer.WriteNull();
  }
  writer.WriteKey("plannedTotalKnownCents");
  writer.WriteNumber(distinct.Empty() ? 0 : distinct[0].knownPriceCents);
  writer.WriteKey("accountingComplete");
  writer.WriteBool(intake.priceComplete && (distinct.Empty() || distinct[0].priceComplete));
  writer.WriteKey("overBudget");
  writer.WriteBool(!distinct.Empty() && distinct[0].overBudget);
  writer.WriteKey("checkBasis");
  writer.WriteString(Str("known_only"));
  writer.EndObject();

  writer.WriteKey("distinctPlanCount");
  writer.WriteNumber(static_cast<i64>(distinct.Size()));
  writer.WriteKey("fewerThanThreeReason");
  if (distinct.Size() < 3) {
    writer.WriteString(Str("INSUFFICIENT_DISTINCT_PLANS"));
  } else {
    writer.WriteNull();
  }

  writer.WriteKey("diagnostics");
  writer.BeginArray();
  if (status.Equals("TargetUnavailable")) {
    writer.BeginObject();
    writer.WriteKey("code");
    writer.WriteString(Str("TARGET_NOT_APPLICABLE"));
    writer.WriteKey("targetStatus");
    writer.WriteString(target.status);
    writer.WriteKey("targetReasons");
    writer.BeginArray();
    for (usize i = 0; i < target.reasons.Size(); ++i) {
      writer.WriteString(target.reasons[i]);
    }
    writer.EndArray();
    writer.EndObject();
  }
  if (status.Equals("LockConflict")) {
    writer.BeginObject();
    writer.WriteKey("code");
    writer.WriteString(Str("LOCK_CONFLICT"));
    writer.WriteKey("fieldPath");
    writer.WriteString(Str("$.state.itemLocks"));
    writer.EndObject();
  }
  if (!infeasibleReason.Empty()) {
    writer.BeginObject();
    writer.WriteKey("code");
    writer.WriteString(Str("SEARCH_LIMIT_REACHED"));
    writer.WriteKey("reason");
    writer.WriteString(infeasibleReason);
    writer.EndObject();
  }
  writer.EndArray();

  writer.WriteKey("search");
  WriteCanonicalSearchBlock(writer, planningMasks, tracker);

  writer.EndObject();
  return writer.Ok();
}

}  // namespace

// Plan 命令入口：绑定命令名后交给通用契约信封执行器（解析→校验→业务→规范化序列化）；
// 请求版本协商与错误信封封装由 contract.cpp 的执行器统一完成。
bool PlanDayEntry(ExecContext& ctx, const char* requestText, usize length, TextBuffer* out) {
  return RunContractEntry(ctx, requestText, length, &WritePlanResult, true, out);
}

}  // namespace mp

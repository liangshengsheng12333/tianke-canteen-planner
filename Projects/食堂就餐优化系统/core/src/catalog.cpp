// catalog.cpp — 菜单快照（MenuCatalog）的语法解析、跨表引用校验与套餐确定性展开实现
//
// 核心工程不变量：
//   1. 任何未知营养值（JSON null）在解析后均以 has*=false 显式表达，绝不静默折算为 0。
//   2. 半份米饭（portionCode="half"）仅限 riceDish=true 单品，且必须与同窗同菜品的整份报价
//      价格状态及金额完全一致（契约 §3 / P01 裁定 6）。
//   3. 固定套餐（kind="combo"）与规则套餐（comboRules[]）在语义校验阶段统一完成组件合法性
//      核查、营养汇总（sumComponents）及估算标志（estimated）传播，确保后续单餐候选生成层
//      能够以统一的 OfferRecord 视图无差别处理单品、固定套餐与规则展开套餐。
#include "mp/catalog.h"

#include "mp/contract.h"

namespace mp {

namespace {

// 拼接 JSON 字段路径（如 base="$.catalog", key="dishes" -> "$.catalog.dishes"），用于定位错误
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

// 非负整数的四舍五入除法：round_half_up(value, divisor) = floor((2*value + divisor) / (2*divisor))
// 调用前提：value >= 0 且 divisor > 0，全程使用 64 位有符号整数避免浮点误差
i64 RoundHalfUp(i64 value, i64 divisor) { return (2 * value + divisor) / (2 * divisor); }

// 解析四项核心营养素对象（energyKcal / proteinDg / fatDg / carbDg）：
//   * JSON 值为 null 时记 has*=false, 值置 0（代表数据缺失，不可自动新增入餐）；
//   * JSON 值为非负整数时记 has*=true（其中 0 代表实测/已知零值）。
bool ParseNutrition(ExecContext& ctx, const JsonValue* value, const char* path,
                    NutritionValues* out) {
  if (!RequireObjectType(ctx, value, path)) {
    return false;
  }
  char buffer[192];
  struct Field {
    const char* key;
    bool* has;
    i64* target;
  } fields[] = {{"energyKcal", &out->hasEnergy, &out->energyKcal},
                {"proteinDg", &out->hasProtein, &out->proteinDg},
                {"fatDg", &out->hasFat, &out->fatDg},
                {"carbDg", &out->hasCarb, &out->carbDg}};
  *out = NutritionValues{};
  for (usize i = 0; i < 4; ++i) {
    const JsonValue* member = RequireMember(ctx, value, fields[i].key,
                                            SubPath(buffer, sizeof(buffer), path, fields[i].key));
    if (member == nullptr) {
      return false;
    }
    if (member->kind == JsonKind::Null) {
      *fields[i].has = false;
      *fields[i].target = 0;
      continue;
    }
    if (!ReadInt(ctx, member, SubPath(buffer, sizeof(buffer), path, fields[i].key), 0, 100000,
                 fields[i].target)) {
      return false;
    }
    *fields[i].has = true;
  }
  return true;
}

// 解析餐次供应窗口数组（mealWindows[]），将其转换为非零餐次位掩码
bool ParseMealWindows(ExecContext& ctx, const JsonValue* value, const char* path, i64* mask) {
  if (!RequireArrayType(ctx, value, path)) {
    return false;
  }
  *mask = 0;
  for (const JsonValue* item = value->child; item != nullptr; item = item->next) {
    Str mealName;
    if (!ReadString(ctx, item, path, &mealName)) {
      return false;
    }
    const i64 bit = MealMaskFromName(mealName);
    if (bit == 0) {
      return ctx.Fail("INVALID_INPUT", path, "mealWindows 含未知餐次枚举值");
    }
    *mask |= bit;
  }
  if (*mask == 0) {
    return ctx.Fail("INVALID_INPUT", path, "mealWindows 不能为空");
  }
  return true;
}

// 校验菜品分类枚举是否属于契约允许的标准分类集合
bool IsAllowedCategoryName(Str category) {
  static const char* const kAllowedCategories[] = {"staple", "protein", "vegetable",
                                                   "soup",   "drink",   "other",
                                                   nullptr};
  for (usize i = 0; kAllowedCategories[i] != nullptr; ++i) {
    if (category.Equals(kAllowedCategories[i])) {
      return true;
    }
  }
  return false;
}

// 解析固定套餐（kind="combo"）的 components[] 数组：
//   * 每个元素必须包含合法的稳定 dishId 与正整数 count（1..10）；
//   * 同一固定套餐内部禁止出现重复的组件 dishId（若同一单品有多份，应通过 count>1 表达）。
bool ParseDishComponents(ExecContext& ctx, const JsonValue* dishJson, const char* basePath,
                         DishRecord* dish) {
  char buffer[192];
  const JsonValue* comps = JsonFind(dishJson, "components");
  if (dish->kind.Equals("single")) {
    if (comps != nullptr && comps->kind != JsonKind::Null) {
      if (!RequireArrayType(ctx, comps,
                            SubPath(buffer, sizeof(buffer), basePath, "dishes[].components"))) {
        return false;
      }
      if (comps->count > 0) {
        return ctx.Fail("INVALID_INPUT",
                        SubPath(buffer, sizeof(buffer), basePath, "dishes[].components"),
                        "single 菜品不得包含非空套餐 components");
      }
    }
    return true;
  }

  // kind == "combo"：必须显式提供 riceIncluded，不得标为 riceDish=true，且 components 非空
  if (!dish->hasRiceIncluded) {
    return ctx.Fail("INVALID_INPUT",
                    SubPath(buffer, sizeof(buffer), basePath, "dishes[].riceIncluded"),
                    "固定套餐必须显式指定布尔字段 riceIncluded");
  }
  if (dish->riceDish) {
    return ctx.Fail("INVALID_INPUT",
                    SubPath(buffer, sizeof(buffer), basePath, "dishes[].riceDish"),
                    "固定套餐（kind=combo）不能同时标记为 riceDish=true");
  }
  if (comps == nullptr ||
      !RequireArrayType(ctx, comps,
                        SubPath(buffer, sizeof(buffer), basePath, "dishes[].components"))) {
    return false;
  }
  if (comps->count == 0) {
    return ctx.Fail("INVALID_INPUT",
                    SubPath(buffer, sizeof(buffer), basePath, "dishes[].components"),
                    "固定套餐 components 不能为空数组");
  }

  for (const JsonValue* entry = comps->child; entry != nullptr; entry = entry->next) {
    if (!RequireObjectType(ctx, entry,
                           SubPath(buffer, sizeof(buffer), basePath, "dishes[].components[]"))) {
      return false;
    }
    const JsonValue* compDishId = RequireMember(
        ctx, entry, "dishId",
        SubPath(buffer, sizeof(buffer), basePath, "dishes[].components[].dishId"));
    if (compDishId == nullptr ||
        !ValidateStableId(
            ctx, compDishId,
            SubPath(buffer, sizeof(buffer), basePath, "dishes[].components[].dishId"))) {
      return false;
    }
    const JsonValue* countVal = RequireMember(
        ctx, entry, "count",
        SubPath(buffer, sizeof(buffer), basePath, "dishes[].components[].count"));
    i64 count = 0;
    if (countVal == nullptr ||
        !ReadInt(ctx, countVal,
                 SubPath(buffer, sizeof(buffer), basePath, "dishes[].components[].count"), 1, 10,
                 &count)) {
      return false;
    }
    for (usize i = 0; i < dish->components.Size(); ++i) {
      if (dish->components[i].dishId.Equals(compDishId->text)) {
        return ctx.Fail(
            "INVALID_INPUT",
            SubPath(buffer, sizeof(buffer), basePath, "dishes[].components[].dishId"),
            "固定套餐 components 中存在重复的组件 dishId");
      }
    }
    ComboComponent comp;
    comp.dishId = compDishId->text;
    comp.count = count;
    dish->components.Push(comp);
  }
  return true;
}

// 解析规则套餐（catalog.comboRules[]）数组：
//   * 校验 ruleId 唯一且不与静态 offerId 冲突；
//   * 校验 requiredCounts 各分类名称合法、份数在 1..6 之间且无重复分类键；
//   * 校验 candidateDishIds 非空、均为合法稳定 ID 且无重复候选单品；
//   * 校验 nutritionPolicy 必须为 "sumComponents"。
bool ParseComboRules(ExecContext& ctx, const JsonValue* comboRulesJson, const char* basePath,
                     Catalog* out) {
  char buffer[192];
  for (const JsonValue* item = comboRulesJson->child; item != nullptr; item = item->next) {
    if (!RequireObjectType(ctx, item,
                           SubPath(buffer, sizeof(buffer), basePath, "comboRules[]"))) {
      return false;
    }
    ComboRuleRecord rule;
    rule = ComboRuleRecord{};
    rule.requiredCounts.Init(&ctx.Memory());
    rule.candidateDishIds.Init(&ctx.Memory());

    const JsonValue* ruleId = RequireMember(
        ctx, item, "ruleId", SubPath(buffer, sizeof(buffer), basePath, "comboRules[].ruleId"));
    if (ruleId == nullptr ||
        !ValidateStableId(ctx, ruleId,
                          SubPath(buffer, sizeof(buffer), basePath, "comboRules[].ruleId"))) {
      return false;
    }
    rule.ruleId = ruleId->text;
    for (usize i = 0; i < out->comboRules.Size(); ++i) {
      if (out->comboRules[i].ruleId.Equals(rule.ruleId)) {
        return ctx.Fail("INVALID_INPUT",
                        SubPath(buffer, sizeof(buffer), basePath, "comboRules[].ruleId"),
                        "comboRules 中存在重复的 ruleId");
      }
    }
    for (usize i = 0; i < out->offers.Size(); ++i) {
      if (out->offers[i].offerId.Equals(rule.ruleId)) {
        return ctx.Fail("INVALID_INPUT",
                        SubPath(buffer, sizeof(buffer), basePath, "comboRules[].ruleId"),
                        "comboRules.ruleId 不能与静态 offers.offerId 重名");
      }
    }

    const JsonValue* name = RequireMember(
        ctx, item, "name", SubPath(buffer, sizeof(buffer), basePath, "comboRules[].name"));
    if (name == nullptr ||
        !ReadString(ctx, name, SubPath(buffer, sizeof(buffer), basePath, "comboRules[].name"),
                    &rule.name) ||
        rule.name.Empty()) {
      return ctx.Fail("INVALID_INPUT",
                      SubPath(buffer, sizeof(buffer), basePath, "comboRules[].name"),
                      "comboRules.name 必须是非空字符串");
    }

    const JsonValue* windowId = RequireMember(
        ctx, item, "windowId",
        SubPath(buffer, sizeof(buffer), basePath, "comboRules[].windowId"));
    if (windowId == nullptr ||
        !ValidateStableId(ctx, windowId,
                          SubPath(buffer, sizeof(buffer), basePath, "comboRules[].windowId"))) {
      return false;
    }
    rule.windowId = windowId->text;

    const JsonValue* mealWindows = RequireMember(
        ctx, item, "mealWindows",
        SubPath(buffer, sizeof(buffer), basePath, "comboRules[].mealWindows"));
    if (mealWindows == nullptr ||
        !ParseMealWindows(ctx, mealWindows,
                          SubPath(buffer, sizeof(buffer), basePath, "comboRules[].mealWindows"),
                          &rule.mealMask)) {
      return false;
    }

    const JsonValue* totalPrice = RequireMember(
        ctx, item, "totalPriceCents",
        SubPath(buffer, sizeof(buffer), basePath, "comboRules[].totalPriceCents"));
    if (totalPrice == nullptr ||
        !ReadInt(ctx, totalPrice,
                 SubPath(buffer, sizeof(buffer), basePath, "comboRules[].totalPriceCents"), 0,
                 1000000, &rule.totalPriceCents)) {
      return false;
    }

    const JsonValue* includesRice = RequireMember(
        ctx, item, "includesRice",
        SubPath(buffer, sizeof(buffer), basePath, "comboRules[].includesRice"));
    if (includesRice == nullptr ||
        !ReadBool(ctx, includesRice,
                  SubPath(buffer, sizeof(buffer), basePath, "comboRules[].includesRice"),
                  &rule.includesRice)) {
      return false;
    }

    const JsonValue* requiredCounts = RequireMember(
        ctx, item, "requiredCounts",
        SubPath(buffer, sizeof(buffer), basePath, "comboRules[].requiredCounts"));
    if (requiredCounts == nullptr ||
        !RequireObjectType(
            ctx, requiredCounts,
            SubPath(buffer, sizeof(buffer), basePath, "comboRules[].requiredCounts"))) {
      return false;
    }
    if (requiredCounts->count == 0) {
      return ctx.Fail("INVALID_INPUT",
                      SubPath(buffer, sizeof(buffer), basePath, "comboRules[].requiredCounts"),
                      "comboRules.requiredCounts 不能为空对象");
    }
    i64 totalRequiredItems = 0;
    for (const JsonMember* member = requiredCounts->members; member != nullptr;
         member = member->next) {
      if (!IsAllowedCategoryName(member->key)) {
        return ctx.Fail("INVALID_INPUT",
                        SubPath(buffer, sizeof(buffer), basePath, "comboRules[].requiredCounts"),
                        "requiredCounts 含未知的菜品类别键");
      }
      for (usize k = 0; k < rule.requiredCounts.Size(); ++k) {
        if (rule.requiredCounts[k].category.Equals(member->key)) {
          return ctx.Fail("INVALID_INPUT",
                          SubPath(buffer, sizeof(buffer), basePath, "comboRules[].requiredCounts"),
                          "requiredCounts 存在重复的类别键");
        }
      }
      i64 reqCount = 0;
      if (!ReadInt(ctx, member->value,
                   SubPath(buffer, sizeof(buffer), basePath, "comboRules[].requiredCounts"), 1, 6,
                   &reqCount)) {
        return false;
      }
      totalRequiredItems += reqCount;
      ComboCategoryCount cc;
      cc.category = member->key;
      cc.count = reqCount;
      rule.requiredCounts.Push(cc);
    }
    if (totalRequiredItems <= 0 || totalRequiredItems > 8) {
      return ctx.Fail("INVALID_INPUT",
                      SubPath(buffer, sizeof(buffer), basePath, "comboRules[].requiredCounts"),
                      "requiredCounts 总组件数必须在 1..8 之间");
    }

    const JsonValue* candidateDishes = RequireMember(
        ctx, item, "candidateDishIds",
        SubPath(buffer, sizeof(buffer), basePath, "comboRules[].candidateDishIds"));
    if (candidateDishes == nullptr ||
        !RequireArrayType(
            ctx, candidateDishes,
            SubPath(buffer, sizeof(buffer), basePath, "comboRules[].candidateDishIds"))) {
      return false;
    }
    if (candidateDishes->count == 0) {
      return ctx.Fail("INVALID_INPUT",
                      SubPath(buffer, sizeof(buffer), basePath, "comboRules[].candidateDishIds"),
                      "comboRules.candidateDishIds 不能为空数组");
    }
    for (const JsonValue* dishEntry = candidateDishes->child; dishEntry != nullptr;
         dishEntry = dishEntry->next) {
      if (!ValidateStableId(
              ctx, dishEntry,
              SubPath(buffer, sizeof(buffer), basePath, "comboRules[].candidateDishIds[]"))) {
        return false;
      }
      for (usize k = 0; k < rule.candidateDishIds.Size(); ++k) {
        if (rule.candidateDishIds[k].Equals(dishEntry->text)) {
          return ctx.Fail(
              "INVALID_INPUT",
              SubPath(buffer, sizeof(buffer), basePath, "comboRules[].candidateDishIds[]"),
              "comboRules.candidateDishIds 存在重复的 dishId");
        }
      }
      rule.candidateDishIds.Push(dishEntry->text);
    }

    const JsonValue* policy = RequireMember(
        ctx, item, "nutritionPolicy",
        SubPath(buffer, sizeof(buffer), basePath, "comboRules[].nutritionPolicy"));
    if (policy == nullptr ||
        !ReadString(ctx, policy,
                    SubPath(buffer, sizeof(buffer), basePath, "comboRules[].nutritionPolicy"),
                    &rule.nutritionPolicy)) {
      return false;
    }
    if (!rule.nutritionPolicy.Equals("sumComponents")) {
      return ctx.Fail("INVALID_INPUT",
                      SubPath(buffer, sizeof(buffer), basePath, "comboRules[].nutritionPolicy"),
                      "nutritionPolicy 仅支持 sumComponents");
    }

    out->comboRules.Push(rule);
  }
  return true;
}

// 判断规则套餐中的候选单品 dishId 在给定窗口 windowId 与餐次 mealBit 下是否处于合法供应范围：
//   * 若该单品在 catalog.offers 中存在静态报价，则必须至少有一条静态报价位于同一 windowId
//     且服务该 mealBit（防止将仅在早餐或他窗供应的菜品混入当前窗口的午晚餐规则套餐）；
//   * 若该单品在 catalog.offers 中无任何独立报价（专供套餐使用的组件菜品），则视为随本规则供应。
bool IsCandidateDishSuppliedAtWindowMeal(const Catalog& catalog, Str dishId, Str windowId,
                                         i64 mealBit) {
  bool hasAnyStandaloneOffer = false;
  bool hasMatchingOffer = false;
  for (usize i = 0; i < catalog.offers.Size(); ++i) {
    const OfferRecord& offer = catalog.offers[i];
    if (offer.dishId.Equals(dishId)) {
      hasAnyStandaloneOffer = true;
      if (offer.windowId.Equals(windowId) && (offer.mealMask & mealBit) != 0) {
        hasMatchingOffer = true;
        break;
      }
    }
  }
  return !hasAnyStandaloneOffer || hasMatchingOffer;
}

// 规则套餐递归展开上下文：用于按 requiredCounts 枚举各分类下的单品无放回组合
struct ComboExpansionEnv {
  ExecContext* ctx;
  Catalog* catalog;
  const ComboRuleRecord* rule;
  i64 mealBit;
  usize groupCount;
  Vec<const DishRecord*> groupDishes[8];
  i64 groupReqCount[8];
  const DishRecord* picked[16];
  usize pickedCount;
};

// 当所有分类均选满所需单品后，生成一条稳定标识为 ruleId#<dishId升序拼接> 的展开报价
void EmitExpandedComboOffer(ComboExpansionEnv* env) {
  const DishRecord* sortedPicked[16];
  for (usize i = 0; i < env->pickedCount; ++i) {
    sortedPicked[i] = env->picked[i];
  }
  // 按 dishId 的 UTF-8 字节序升序排列全部被选组件，确保 offerId 与分类遍历顺序无关
  for (usize i = 1; i < env->pickedCount; ++i) {
    const DishRecord* cur = sortedPicked[i];
    usize j = i;
    while (j > 0 && sortedPicked[j - 1]->dishId.Compare(cur->dishId) > 0) {
      sortedPicked[j] = sortedPicked[j - 1];
      --j;
    }
    sortedPicked[j] = cur;
  }

  TextBuffer idBuf;
  idBuf.Init(&env->ctx->Memory());
  idBuf.Append(env->rule->ruleId);
  idBuf.Append("#");
  for (usize i = 0; i < env->pickedCount; ++i) {
    if (i > 0) {
      idBuf.Append("+");
    }
    idBuf.Append(sortedPicked[i]->dishId);
  }
  const Str offerId = idBuf.View();

  // 若同一 ruleId#<dishIds> 组合已在其他餐次生成，直接合并餐次位掩码（mealMask）
  for (usize i = 0; i < env->catalog->expandedComboOffers.Size(); ++i) {
    if (env->catalog->expandedComboOffers[i].offerId.Equals(offerId)) {
      env->catalog->expandedComboOffers[i].mealMask |= env->mealBit;
      return;
    }
  }

  // 按 sumComponents 规则汇总全部组件营养，并传播未知项（has*=false）与估算标志（estimated）
  NutritionValues sumNut;
  sumNut.hasEnergy = true;
  sumNut.hasProtein = true;
  sumNut.hasFat = true;
  sumNut.hasCarb = true;
  sumNut.energyKcal = 0;
  sumNut.proteinDg = 0;
  sumNut.fatDg = 0;
  sumNut.carbDg = 0;
  bool anyEstimated = false;

  OfferRecord exp;
  exp = OfferRecord{};
  exp.offerId = offerId;
  exp.dishId = env->rule->ruleId;
  exp.dishName = env->rule->name;
  exp.windowId = env->rule->windowId;
  exp.mealMask = env->mealBit;
  exp.isHalf = false;
  exp.ratioNum = 1;
  exp.ratioDen = 1;
  exp.priceKnown = true;
  exp.priceCents = env->rule->totalPriceCents;
  exp.priceBasis = Str("comboTotal");
  exp.isCombo = true;
  exp.isExpandedRule = true;
  exp.riceDish = false;
  exp.riceIncluded = env->rule->includesRice;
  exp.nutritionSource = Str("comboComponentSum");
  exp.components.Init(&env->ctx->Memory());

  for (usize i = 0; i < env->pickedCount; ++i) {
    const DishRecord* compDish = sortedPicked[i];
    if (!compDish->nutrition.hasEnergy) {
      sumNut.hasEnergy = false;
    } else {
      sumNut.energyKcal += compDish->nutrition.energyKcal;
    }
    if (!compDish->nutrition.hasProtein) {
      sumNut.hasProtein = false;
    } else {
      sumNut.proteinDg += compDish->nutrition.proteinDg;
    }
    if (!compDish->nutrition.hasFat) {
      sumNut.hasFat = false;
    } else {
      sumNut.fatDg += compDish->nutrition.fatDg;
    }
    if (!compDish->nutrition.hasCarb) {
      sumNut.hasCarb = false;
    } else {
      sumNut.carbDg += compDish->nutrition.carbDg;
    }
    if (compDish->estimated) {
      anyEstimated = true;
    }
    ComboComponent comp;
    comp.dishId = compDish->dishId;
    comp.count = 1;
    exp.components.Push(comp);
  }
  if (!sumNut.hasEnergy) sumNut.energyKcal = 0;
  if (!sumNut.hasProtein) sumNut.proteinDg = 0;
  if (!sumNut.hasFat) sumNut.fatDg = 0;
  if (!sumNut.hasCarb) sumNut.carbDg = 0;

  exp.hasNutritionOverride = true;
  exp.nutritionOverride = sumNut;
  exp.estimated = anyEstimated;
  env->catalog->expandedComboOffers.Push(exp);
}

// 在第 groupIdx 个分类的候选列表内，从 startIdx 开始递归选取 remainingToPick 道不重复单品
void RecurseComboGroups(ComboExpansionEnv* env, usize groupIdx, usize startIdx,
                        i64 remainingToPick) {
  if (groupIdx >= env->groupCount) {
    EmitExpandedComboOffer(env);
    return;
  }
  if (remainingToPick == 0) {
    const i64 nextReq = (groupIdx + 1 < env->groupCount) ? env->groupReqCount[groupIdx + 1] : 0;
    RecurseComboGroups(env, groupIdx + 1, 0, nextReq);
    return;
  }
  const Vec<const DishRecord*>& candidates = env->groupDishes[groupIdx];
  const usize need = static_cast<usize>(remainingToPick);
  if (startIdx + need > candidates.Size()) {
    return;
  }
  for (usize i = startIdx; i + need <= candidates.Size(); ++i) {
    env->picked[env->pickedCount++] = candidates[i];
    RecurseComboGroups(env, groupIdx, i + 1, remainingToPick - 1);
    --env->pickedCount;
  }
}

// 对某一条规则套餐在指定餐次下执行合法展开
void ExpandRuleForMeal(ExecContext& ctx, Catalog* catalog, const ComboRuleRecord& rule,
                       i64 mealBit) {
  if ((rule.mealMask & mealBit) == 0) {
    return;
  }
  const usize gCount = rule.requiredCounts.Size();
  if (gCount == 0 || gCount > 8) {
    return;
  }

  ComboExpansionEnv env;
  env.ctx = &ctx;
  env.catalog = catalog;
  env.rule = &rule;
  env.mealBit = mealBit;
  env.groupCount = gCount;
  env.pickedCount = 0;

  for (usize g = 0; g < gCount; ++g) {
    env.groupDishes[g].Init(&ctx.Memory());
    env.groupReqCount[g] = rule.requiredCounts[g].count;
    const Str reqCat = rule.requiredCounts[g].category;

    for (usize c = 0; c < rule.candidateDishIds.Size(); ++c) {
      const DishRecord* dish = FindDish(*catalog, rule.candidateDishIds[c]);
      if (dish == nullptr || !dish->hasCategory || !dish->category.Equals(reqCat)) {
        continue;
      }
      if (!IsCandidateDishSuppliedAtWindowMeal(*catalog, dish->dishId, rule.windowId, mealBit)) {
        continue;
      }
      env.groupDishes[g].Push(dish);
    }

    // 对分类内候选单品按 dishId 升序排列，确保递归组合顺序稳定
    for (usize i = 1; i < env.groupDishes[g].Size(); ++i) {
      const DishRecord* val = env.groupDishes[g][i];
      usize j = i;
      while (j > 0 && env.groupDishes[g][j - 1]->dishId.Compare(val->dishId) > 0) {
        env.groupDishes[g][j] = env.groupDishes[g][j - 1];
        --j;
      }
      env.groupDishes[g][j] = val;
    }

    // 若任一必选分类的可用供应单品数不足，则该规则在此餐次下无法组成合法套餐
    if (static_cast<i64>(env.groupDishes[g].Size()) < env.groupReqCount[g]) {
      return;
    }
  }

  RecurseComboGroups(&env, 0, 0, env.groupReqCount[0]);
}

}  // namespace

// 餐次位掩码与契约餐次名互转（bit0=breakfast, bit1=lunch, bit2=dinner）；
// 未知名返回 0/mixed，入口枚举校验保证合法请求不会命中未知分支。
Str MealNameFromMask(i64 mask) {
  if (mask == kMealBreakfast) {
    return Str("breakfast");
  }
  if (mask == kMealLunch) {
    return Str("lunch");
  }
  if (mask == kMealDinner) {
    return Str("dinner");
  }
  return Str("mixed");
}

i64 MealMaskFromName(Str name) {
  if (name.Equals("breakfast")) {
    return kMealBreakfast;
  }
  if (name.Equals("lunch")) {
    return kMealLunch;
  }
  if (name.Equals("dinner")) {
    return kMealDinner;
  }
  return 0;
}

// 目录解析：windows/dishes/offers 逐项做存在性、类型、范围、稳定 ID 与唯一性校验；
// catalogHash 此处只校验形式（sha256:<64hex>），值的一致性在语义校验后由命令层复算。
bool ParseCatalog(ExecContext& ctx, const JsonValue* catalogValue, const char* basePath,
                  Catalog* out) {
  if (!RequireObjectType(ctx, catalogValue, basePath)) {
    return false;
  }
  char buffer[192];
  out->windows.Init(&ctx.Memory());
  out->dishes.Init(&ctx.Memory());
  out->offers.Init(&ctx.Memory());
  out->comboRules.Init(&ctx.Memory());
  out->expandedComboOffers.Init(&ctx.Memory());
  out->comboRuleCount = 0;
  out->halfOfferCount = 0;

  const JsonValue* menuVersion = RequireMember(
      ctx, catalogValue, "menuVersion", SubPath(buffer, sizeof(buffer), basePath, "menuVersion"));
  if (menuVersion == nullptr ||
      !ReadString(ctx, menuVersion, SubPath(buffer, sizeof(buffer), basePath, "menuVersion"),
                  &out->menuVersion)) {
    return false;
  }
  const JsonValue* catalogHash = RequireMember(
      ctx, catalogValue, "catalogHash", SubPath(buffer, sizeof(buffer), basePath, "catalogHash"));
  if (catalogHash == nullptr ||
      !ReadString(ctx, catalogHash, SubPath(buffer, sizeof(buffer), basePath, "catalogHash"),
                  &out->catalogHash)) {
    return false;
  }
  if (out->catalogHash.size < 7 || out->catalogHash.data[0] != 's') {
    return ctx.Fail("INVALID_INPUT", SubPath(buffer, sizeof(buffer), basePath, "catalogHash"),
                    "catalogHash 必须是 sha256:<64 hex> 形式");
  }

  const JsonValue* canteen = RequireMember(ctx, catalogValue, "canteen",
                                           SubPath(buffer, sizeof(buffer), basePath, "canteen"));
  if (!RequireObjectType(ctx, canteen, SubPath(buffer, sizeof(buffer), basePath, "canteen"))) {
    return false;
  }
  {
    char canteenPath[192];
    SubPath(canteenPath, sizeof(canteenPath), basePath, "canteen");
    const JsonValue* canteenId = RequireMember(
        ctx, canteen, "canteenId", SubPath(buffer, sizeof(buffer), canteenPath, "canteenId"));
    if (canteenId == nullptr ||
        !ValidateStableId(ctx, canteenId,
                          SubPath(buffer, sizeof(buffer), canteenPath, "canteenId"))) {
      return false;
    }
    out->canteenId = canteenId->text;
  }

  const JsonValue* windows = RequireMember(ctx, catalogValue, "windows",
                                           SubPath(buffer, sizeof(buffer), basePath, "windows"));
  if (windows == nullptr ||
      !RequireArrayType(ctx, windows, SubPath(buffer, sizeof(buffer), basePath, "windows"))) {
    return false;
  }
  for (const JsonValue* item = windows->child; item != nullptr; item = item->next) {
    WindowRecord window;
    const JsonValue* windowId = RequireMember(
        ctx, item, "windowId", SubPath(buffer, sizeof(buffer), basePath, "windows[].windowId"));
    if (windowId == nullptr ||
        !ValidateStableId(ctx, windowId,
                          SubPath(buffer, sizeof(buffer), basePath, "windows[].windowId"))) {
      return false;
    }
    window.windowId = windowId->text;
    const JsonValue* name = RequireMember(
        ctx, item, "name", SubPath(buffer, sizeof(buffer), basePath, "windows[].name"));
    if (name == nullptr ||
        !ReadString(ctx, name, SubPath(buffer, sizeof(buffer), basePath, "windows[].name"),
                    &window.name)) {
      return false;
    }
    const JsonValue* mealWindows = RequireMember(
        ctx, item, "mealWindows",
        SubPath(buffer, sizeof(buffer), basePath, "windows[].mealWindows"));
    if (mealWindows == nullptr ||
        !ParseMealWindows(ctx, mealWindows,
                          SubPath(buffer, sizeof(buffer), basePath, "windows[].mealWindows"),
                          &window.mealMask)) {
      return false;
    }
    if (FindWindow(*out, window.windowId) != nullptr) {
      return ctx.Fail("INVALID_INPUT",
                      SubPath(buffer, sizeof(buffer), basePath, "windows[].windowId"),
                      "windowId 重复");
    }
    out->windows.Push(window);
  }

  const JsonValue* dishes = RequireMember(ctx, catalogValue, "dishes",
                                          SubPath(buffer, sizeof(buffer), basePath, "dishes"));
  if (dishes == nullptr ||
      !RequireArrayType(ctx, dishes, SubPath(buffer, sizeof(buffer), basePath, "dishes"))) {
    return false;
  }
  for (const JsonValue* item = dishes->child; item != nullptr; item = item->next) {
    DishRecord dish;
    dish = DishRecord{};
    dish.components.Init(&ctx.Memory());
    const JsonValue* dishId = RequireMember(
        ctx, item, "dishId", SubPath(buffer, sizeof(buffer), basePath, "dishes[].dishId"));
    if (dishId == nullptr ||
        !ValidateStableId(ctx, dishId,
                          SubPath(buffer, sizeof(buffer), basePath, "dishes[].dishId"))) {
      return false;
    }
    dish.dishId = dishId->text;
    const JsonValue* name = RequireMember(
        ctx, item, "name", SubPath(buffer, sizeof(buffer), basePath, "dishes[].name"));
    if (name == nullptr ||
        !ReadString(ctx, name, SubPath(buffer, sizeof(buffer), basePath, "dishes[].name"),
                    &dish.name)) {
      return false;
    }
    const JsonValue* kind = RequireMember(
        ctx, item, "kind", SubPath(buffer, sizeof(buffer), basePath, "dishes[].kind"));
    if (kind == nullptr) {
      return false;
    }
    const char* allowedKinds[] = {"single", "combo", nullptr};
    if (!ReadEnum(ctx, kind, SubPath(buffer, sizeof(buffer), basePath, "dishes[].kind"),
                  allowedKinds, &dish.kind)) {
      return false;
    }
    const JsonValue* category = JsonFind(item, "category");
    if (category != nullptr && category->kind == JsonKind::String) {
      dish.hasCategory = true;
      dish.category = category->text;
    }
    const JsonValue* riceDish = RequireMember(
        ctx, item, "riceDish", SubPath(buffer, sizeof(buffer), basePath, "dishes[].riceDish"));
    if (riceDish == nullptr ||
        !ReadBool(ctx, riceDish, SubPath(buffer, sizeof(buffer), basePath, "dishes[].riceDish"),
                  &dish.riceDish)) {
      return false;
    }
    const JsonValue* riceIncluded = JsonFind(item, "riceIncluded");
    dish.riceIncluded = false;
    dish.hasRiceIncluded = false;
    if (riceIncluded != nullptr && riceIncluded->kind != JsonKind::Null) {
      if (!ReadBool(ctx, riceIncluded,
                    SubPath(buffer, sizeof(buffer), basePath, "dishes[].riceIncluded"),
                    &dish.riceIncluded)) {
        return false;
      }
      dish.hasRiceIncluded = true;
    }
    const JsonValue* nutrition = RequireMember(
        ctx, item, "nutrition", SubPath(buffer, sizeof(buffer), basePath, "dishes[].nutrition"));
    if (nutrition == nullptr ||
        !ParseNutrition(ctx, nutrition,
                        SubPath(buffer, sizeof(buffer), basePath, "dishes[].nutrition"),
                        &dish.nutrition)) {
      return false;
    }
    const JsonValue* basis = RequireMember(
        ctx, item, "nutritionBasis",
        SubPath(buffer, sizeof(buffer), basePath, "dishes[].nutritionBasis"));
    if (!RequireObjectType(ctx, basis,
                           SubPath(buffer, sizeof(buffer), basePath, "dishes[].nutritionBasis"))) {
      return false;
    }
    {
      char basisPath[192];
      SubPath(basisPath, sizeof(basisPath), basePath, "dishes[].nutritionBasis");
      const JsonValue* source = RequireMember(ctx, basis, "source",
                                              SubPath(buffer, sizeof(buffer), basisPath, "source"));
      if (source == nullptr ||
          !ReadString(ctx, source, SubPath(buffer, sizeof(buffer), basisPath, "source"),
                      &dish.nutritionSource)) {
        return false;
      }
      const JsonValue* portion = RequireMember(
          ctx, basis, "portionAssumption",
          SubPath(buffer, sizeof(buffer), basisPath, "portionAssumption"));
      if (portion == nullptr) {
        return false;
      }
      const JsonValue* estimated = RequireMember(
          ctx, basis, "estimated", SubPath(buffer, sizeof(buffer), basisPath, "estimated"));
      if (estimated == nullptr ||
          !ReadBool(ctx, estimated, SubPath(buffer, sizeof(buffer), basisPath, "estimated"),
                    &dish.estimated)) {
        return false;
      }
    }
    if (!ParseDishComponents(ctx, item, basePath, &dish)) {
      return false;
    }
    if (FindDish(*out, dish.dishId) != nullptr) {
      return ctx.Fail("INVALID_INPUT",
                      SubPath(buffer, sizeof(buffer), basePath, "dishes[].dishId"), "dishId 重复");
    }
    out->dishes.Push(dish);
  }

  const JsonValue* offers = RequireMember(ctx, catalogValue, "offers",
                                          SubPath(buffer, sizeof(buffer), basePath, "offers"));
  if (offers == nullptr ||
      !RequireArrayType(ctx, offers, SubPath(buffer, sizeof(buffer), basePath, "offers"))) {
    return false;
  }
  for (const JsonValue* item = offers->child; item != nullptr; item = item->next) {
    OfferRecord offer;
    offer = OfferRecord{};
    offer.components.Init(&ctx.Memory());
    const JsonValue* offerId = RequireMember(
        ctx, item, "offerId", SubPath(buffer, sizeof(buffer), basePath, "offers[].offerId"));
    if (offerId == nullptr ||
        !ValidateStableId(ctx, offerId,
                          SubPath(buffer, sizeof(buffer), basePath, "offers[].offerId"))) {
      return false;
    }
    offer.offerId = offerId->text;
    for (usize i = 0; i < out->offers.Size(); ++i) {
      if (out->offers[i].offerId.Equals(offer.offerId)) {
        return ctx.Fail("INVALID_INPUT",
                        SubPath(buffer, sizeof(buffer), basePath, "offers[].offerId"),
                        "offerId 重复");
      }
    }
    const JsonValue* dishId = RequireMember(
        ctx, item, "dishId", SubPath(buffer, sizeof(buffer), basePath, "offers[].dishId"));
    if (dishId == nullptr ||
        !ReadString(ctx, dishId, SubPath(buffer, sizeof(buffer), basePath, "offers[].dishId"),
                    &offer.dishId)) {
      return false;
    }
    const JsonValue* windowId = RequireMember(
        ctx, item, "windowId", SubPath(buffer, sizeof(buffer), basePath, "offers[].windowId"));
    if (windowId == nullptr ||
        !ReadString(ctx, windowId, SubPath(buffer, sizeof(buffer), basePath, "offers[].windowId"),
                    &offer.windowId)) {
      return false;
    }
    const JsonValue* mealWindows = RequireMember(
        ctx, item, "mealWindows",
        SubPath(buffer, sizeof(buffer), basePath, "offers[].mealWindows"));
    if (mealWindows == nullptr ||
        !ParseMealWindows(ctx, mealWindows,
                          SubPath(buffer, sizeof(buffer), basePath, "offers[].mealWindows"),
                          &offer.mealMask)) {
      return false;
    }
    const JsonValue* portionCode = RequireMember(
        ctx, item, "portionCode",
        SubPath(buffer, sizeof(buffer), basePath, "offers[].portionCode"));
    if (portionCode == nullptr) {
      return false;
    }
    Str portion;
    const char* allowedPortions[] = {"full", "half", nullptr};
    if (!ReadEnum(ctx, portionCode,
                  SubPath(buffer, sizeof(buffer), basePath, "offers[].portionCode"),
                  allowedPortions, &portion)) {
      return false;
    }
    offer.isHalf = portion.Equals("half");
    const JsonValue* ratioNum = RequireMember(
        ctx, item, "portionRatioNum",
        SubPath(buffer, sizeof(buffer), basePath, "offers[].portionRatioNum"));
    const JsonValue* ratioDen = RequireMember(
        ctx, item, "portionRatioDen",
        SubPath(buffer, sizeof(buffer), basePath, "offers[].portionRatioDen"));
    if (ratioNum == nullptr || ratioDen == nullptr) {
      return false;
    }
    if (!ReadInt(ctx, ratioNum,
                 SubPath(buffer, sizeof(buffer), basePath, "offers[].portionRatioNum"), 1, 100,
                 &offer.ratioNum)) {
      return false;
    }
    if (!ReadInt(ctx, ratioDen,
                 SubPath(buffer, sizeof(buffer), basePath, "offers[].portionRatioDen"), 1, 100,
                 &offer.ratioDen)) {
      return false;
    }
    const JsonValue* priceBasis = RequireMember(
        ctx, item, "priceBasis", SubPath(buffer, sizeof(buffer), basePath, "offers[].priceBasis"));
    if (priceBasis == nullptr) {
      return false;
    }
    const char* allowedBasis[] = {"unitPrice", "comboTotal", "unknown", nullptr};
    if (!ReadEnum(ctx, priceBasis,
                  SubPath(buffer, sizeof(buffer), basePath, "offers[].priceBasis"), allowedBasis,
                  &offer.priceBasis)) {
      return false;
    }
    const JsonValue* price = RequireMember(
        ctx, item, "priceCents", SubPath(buffer, sizeof(buffer), basePath, "offers[].priceCents"));
    if (price == nullptr) {
      return false;
    }
    const bool basisUnknown = offer.priceBasis.Equals("unknown");
    if (price->kind == JsonKind::Null) {
      offer.priceKnown = false;
      offer.priceCents = 0;
      if (!basisUnknown) {
        return ctx.Fail("INVALID_INPUT",
                        SubPath(buffer, sizeof(buffer), basePath, "offers[].priceCents"),
                        "priceCents=null 必须配 priceBasis=unknown");
      }
    } else {
      offer.priceKnown = true;
      if (!ReadInt(ctx, price, SubPath(buffer, sizeof(buffer), basePath, "offers[].priceCents"), 0,
                   1000000, &offer.priceCents)) {
        return false;
      }
      if (basisUnknown) {
        return ctx.Fail("INVALID_INPUT",
                        SubPath(buffer, sizeof(buffer), basePath, "offers[].priceBasis"),
                        "priceBasis=unknown 时 priceCents 必须是 null");
      }
    }
    const JsonValue* override = JsonFind(item, "nutritionOverride");
    if (override != nullptr && override->kind != JsonKind::Null) {
      if (!ParseNutrition(ctx, override,
                          SubPath(buffer, sizeof(buffer), basePath, "offers[].nutritionOverride"),
                          &offer.nutritionOverride)) {
        return false;
      }
      offer.hasNutritionOverride = true;
    }
    if (offer.isHalf) {
      ++out->halfOfferCount;
    }
    out->offers.Push(offer);
  }

  const JsonValue* comboRules = JsonFind(catalogValue, "comboRules");
  out->comboRuleCount = 0;
  if (comboRules != nullptr && comboRules->kind != JsonKind::Null) {
    if (!RequireArrayType(ctx, comboRules,
                          SubPath(buffer, sizeof(buffer), basePath, "comboRules"))) {
      return false;
    }
    out->comboRuleCount = static_cast<i64>(comboRules->count);
    if (!ParseComboRules(ctx, comboRules, basePath, out)) {
      return false;
    }
  }
  return true;
}

// 按 ID 线性查找（保持目录顺序遍历，结果与顺序无关）；未找到返回 nullptr。
const DishRecord* FindDish(const Catalog& catalog, Str dishId) {
  for (usize i = 0; i < catalog.dishes.Size(); ++i) {
    if (catalog.dishes[i].dishId.Equals(dishId)) {
      return &catalog.dishes[i];
    }
  }
  return nullptr;
}

// 按窗口 ID 线性查找；未找到返回 nullptr（由校验层决定报错语义）。
const WindowRecord* FindWindow(const Catalog& catalog, Str windowId) {
  for (usize i = 0; i < catalog.windows.Size(); ++i) {
    if (catalog.windows[i].windowId.Equals(windowId)) {
      return &catalog.windows[i];
    }
  }
  return nullptr;
}
// 执行语义：在静态报价与规则展开报价中按 offerId 查找报价记录，未找到返回 nullptr
const OfferRecord* FindOffer(const Catalog& catalog, Str offerId) {
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


// 按分子/分母比例缩放整份营养：各分量独立四舍五入到整数 kcal/dg；
// 未知分量保持未知（has*=false）且数值记 0，不把“未知”缩放成“0 值已知”。
NutritionValues ScaleNutrition(const NutritionValues& full, i64 numerator, i64 denominator) {
  NutritionValues scaled;
  scaled.hasEnergy = full.hasEnergy;
  scaled.hasProtein = full.hasProtein;
  scaled.hasFat = full.hasFat;
  scaled.hasCarb = full.hasCarb;
  scaled.energyKcal = full.hasEnergy ? RoundHalfUp(full.energyKcal * numerator, denominator) : 0;
  scaled.proteinDg = full.hasProtein ? RoundHalfUp(full.proteinDg * numerator, denominator) : 0;
  scaled.fatDg = full.hasFat ? RoundHalfUp(full.fatDg * numerator, denominator) : 0;
  scaled.carbDg = full.hasCarb ? RoundHalfUp(full.carbDg * numerator, denominator) : 0;
  return scaled;
}

// 报价营养取值优先级：报价级 nutritionOverride > 所属菜品营养；半份按报价比例缩放
// （本实现仅米饭 1/2）。组件缺失等异常输入返回全未知 NutritionValues{}。
NutritionValues OfferNutrition(const Catalog& catalog, const OfferRecord& offer) {
  if (offer.hasNutritionOverride) {
    NutritionValues values = offer.nutritionOverride;
    if (offer.isHalf) {
      values = ScaleNutrition(values, offer.ratioNum, offer.ratioDen);
    }
    return values;
  }
  const DishRecord* dish = FindDish(catalog, offer.dishId);
  if (dish == nullptr) {
    return NutritionValues{};
  }
  if (offer.isHalf) {
    return ScaleNutrition(dish->nutrition, offer.ratioNum, offer.ratioDen);
  }
  return dish->nutrition;
}

// 报价单价快照：未知价返回 0 仅供求和兼容，调用方必须先看 priceKnown
//（“未知价”与“0 元”是不同语义，序列化层据此写 null 而非 0）。
i64 OfferPriceCents(const OfferRecord& offer) { return offer.priceKnown ? offer.priceCents : 0; }

// 目录语义校验与派生（契约 §3），四步全部通过才可用：
//   1) 固定套餐组件引用完整且禁止嵌套；自身营养不完整时按组件汇总（逐分量：全已知才补）；
//   2) 静态报价引用的 dish/window 必须存在，餐次须与窗口供应范围一致；half 仅限米饭且比例 1/2；
//   3) 半份米饭与同窗同品整份报价严格同价（整份未知则半份未知）——半份价不得折半派生；
//   4) 规则套餐按 requiredCounts 无放回组合确定性展开为原子报价（offerId=ruleId#dishId 升序拼接）。
bool ValidateCatalogSemantics(ExecContext& ctx, Catalog* catalog, const char* basePath) {
  char buffer[192];

  // 第一步：校验固定套餐（kind="combo"）组件引用完整性，并在自身营养未直接完整提供时按组件汇总
  for (usize i = 0; i < catalog->dishes.Size(); ++i) {
    DishRecord& dish = catalog->dishes[i];
    if (!dish.kind.Equals("combo")) {
      continue;
    }
    bool allEnergy = true;
    bool allProtein = true;
    bool allFat = true;
    bool allCarb = true;
    i64 sumEnergy = 0;
    i64 sumProtein = 0;
    i64 sumFat = 0;
    i64 sumCarb = 0;
    bool anyComponentEstimated = false;

    for (usize c = 0; c < dish.components.Size(); ++c) {
      const ComboComponent& comp = dish.components[c];
      const DishRecord* compDish = FindDish(*catalog, comp.dishId);
      if (compDish == nullptr) {
        return ctx.Fail(
            "INVALID_INPUT",
            SubPath(buffer, sizeof(buffer), basePath, "dishes[].components[].dishId"),
            "固定套餐引用了不存在的组件 dishId");
      }
      if (!compDish->kind.Equals("single")) {
        return ctx.Fail(
            "INVALID_INPUT",
            SubPath(buffer, sizeof(buffer), basePath, "dishes[].components[].dishId"),
            "固定套餐组件只能引用 kind=single 的单品菜品，禁止套餐嵌套");
      }
      if (compDish->estimated) {
        anyComponentEstimated = true;
      }
      if (!compDish->nutrition.hasEnergy) {
        allEnergy = false;
      } else {
        sumEnergy += compDish->nutrition.energyKcal * comp.count;
      }
      if (!compDish->nutrition.hasProtein) {
        allProtein = false;
      } else {
        sumProtein += compDish->nutrition.proteinDg * comp.count;
      }
      if (!compDish->nutrition.hasFat) {
        allFat = false;
      } else {
        sumFat += compDish->nutrition.fatDg * comp.count;
      }
      if (!compDish->nutrition.hasCarb) {
        allCarb = false;
      } else {
        sumCarb += compDish->nutrition.carbDg * comp.count;
      }
    }

    // 契约 §3：固定套餐优先采用自身独立营养；若自身营养不完整，则仅在所有组件对应营养素均已知时由组件汇总
    if (!dish.nutrition.Complete()) {
      if (!dish.nutrition.hasEnergy && allEnergy) {
        dish.nutrition.hasEnergy = true;
        dish.nutrition.energyKcal = sumEnergy;
      }
      if (!dish.nutrition.hasProtein && allProtein) {
        dish.nutrition.hasProtein = true;
        dish.nutrition.proteinDg = sumProtein;
      }
      if (!dish.nutrition.hasFat && allFat) {
        dish.nutrition.hasFat = true;
        dish.nutrition.fatDg = sumFat;
      }
      if (!dish.nutrition.hasCarb && allCarb) {
        dish.nutrition.hasCarb = true;
        dish.nutrition.carbDg = sumCarb;
      }
      dish.nutritionSource = Str("comboComponentSum");
    }
    if (anyComponentEstimated) {
      dish.estimated = true;
    }
  }

  // 第二步：校验静态报价（offers[]）对 dishes/windows 的引用完整性与半份约束，并填充报价组件元数据
  for (usize i = 0; i < catalog->offers.Size(); ++i) {
    OfferRecord& offer = catalog->offers[i];
    const DishRecord* dish = FindDish(*catalog, offer.dishId);
    if (dish == nullptr) {
      return ctx.Fail("INVALID_INPUT", SubPath(buffer, sizeof(buffer), basePath, "offers[].dishId"),
                      "offer 引用了不存在的 dishId");
    }
    const WindowRecord* window = FindWindow(*catalog, offer.windowId);
    if (window == nullptr) {
      return ctx.Fail("INVALID_INPUT",
                      SubPath(buffer, sizeof(buffer), basePath, "offers[].windowId"),
                      "offer 引用了不存在的 windowId");
    }
    if ((offer.mealMask & window->mealMask) == 0) {
      return ctx.Fail("INVALID_INPUT",
                      SubPath(buffer, sizeof(buffer), basePath, "offers[].mealWindows"),
                      "offer 的餐次与所属窗口供应的餐次没有交集");
    }
    if ((offer.mealMask & ~window->mealMask) != 0) {
      return ctx.Fail("INVALID_INPUT",
                      SubPath(buffer, sizeof(buffer), basePath, "offers[].mealWindows"),
                      "offer 的餐次超出所属窗口供应的餐次范围");
    }
    // 只有米饭单品允许配置 half 份量，且半份比例固定为 1/2
    if (offer.isHalf && !dish->riceDish) {
      return ctx.Fail("INVALID_INPUT",
                      SubPath(buffer, sizeof(buffer), basePath, "offers[].portionCode"),
                      "仅 riceDish=true 的菜品允许 half 份量");
    }
    if (offer.isHalf && !(offer.ratioNum * 2 == offer.ratioDen)) {
      return ctx.Fail("INVALID_INPUT",
                      SubPath(buffer, sizeof(buffer), basePath, "offers[].portionRatioNum"),
                      "本实现只支持 1/2 的半份比例");
    }

    offer.dishName = dish->name;
    offer.isCombo = dish->kind.Equals("combo");
    offer.isExpandedRule = false;
    offer.riceDish = dish->riceDish;
    offer.riceIncluded = dish->riceIncluded;
    offer.estimated = dish->estimated;
    offer.nutritionSource = dish->nutritionSource;
    offer.components.Init(&ctx.Memory());
    if (offer.isCombo) {
      for (usize c = 0; c < dish->components.Size(); ++c) {
        offer.components.Push(dish->components[c]);
      }
    } else {
      ComboComponent selfComp;
      selfComp.dishId = dish->dishId;
      selfComp.count = 1;
      offer.components.Push(selfComp);
    }
  }

  // 第三步：校验半份米饭与同窗口同米饭单品的整份报价价格严格一致（整份未知则半份未知，已知则同价）
  for (usize i = 0; i < catalog->offers.Size(); ++i) {
    const OfferRecord& half = catalog->offers[i];
    if (!half.isHalf) {
      continue;
    }
    const OfferRecord* full = nullptr;
    for (usize k = 0; k < catalog->offers.Size(); ++k) {
      const OfferRecord& candidate = catalog->offers[k];
      if (!candidate.isHalf && candidate.dishId.Equals(half.dishId) &&
          candidate.windowId.Equals(half.windowId)) {
        full = &candidate;
        break;
      }
    }
    if (full == nullptr) {
      return ctx.Fail("INVALID_INPUT",
                      SubPath(buffer, sizeof(buffer), basePath, "offers[].offerId"),
                      "half 报价缺少同窗口同菜品的 full 报价");
    }
    if (full->priceKnown != half.priceKnown) {
      return ctx.Fail("INVALID_INPUT",
                      SubPath(buffer, sizeof(buffer), basePath, "offers[].priceCents"),
                      "半份米饭价格必须与整份一致（整份未知则半份未知）");
    }
    if (full->priceKnown && full->priceCents != half.priceCents) {
      return ctx.Fail("INVALID_INPUT",
                      SubPath(buffer, sizeof(buffer), basePath, "offers[].priceCents"),
                      "半份米饭价格必须与整份同价，不得折半或另派生");
    }
  }

  // 第四步：校验规则套餐（comboRules[]）的窗口、餐次、候选单品引用，并确定性展开为原子报价
  for (usize r = 0; r < catalog->comboRules.Size(); ++r) {
    const ComboRuleRecord& rule = catalog->comboRules[r];
    const WindowRecord* window = FindWindow(*catalog, rule.windowId);
    if (window == nullptr) {
      return ctx.Fail("INVALID_INPUT",
                      SubPath(buffer, sizeof(buffer), basePath, "comboRules[].windowId"),
                      "comboRule 引用了不存在的 windowId");
    }
    if ((rule.mealMask & window->mealMask) == 0 || (rule.mealMask & ~window->mealMask) != 0) {
      return ctx.Fail("INVALID_INPUT",
                      SubPath(buffer, sizeof(buffer), basePath, "comboRules[].mealWindows"),
                      "comboRule 的 mealWindows 超出所属窗口供应的餐次范围");
    }
    for (usize c = 0; c < rule.candidateDishIds.Size(); ++c) {
      const DishRecord* candDish = FindDish(*catalog, rule.candidateDishIds[c]);
      if (candDish == nullptr) {
        return ctx.Fail(
            "INVALID_INPUT",
            SubPath(buffer, sizeof(buffer), basePath, "comboRules[].candidateDishIds[]"),
            "comboRule 引用了不存在的候选 dishId");
      }
      if (!candDish->kind.Equals("single")) {
        return ctx.Fail(
            "INVALID_INPUT",
            SubPath(buffer, sizeof(buffer), basePath, "comboRules[].candidateDishIds[]"),
            "comboRule 候选组件只能是 kind=single 的单品菜品");
      }
    }

    const usize beforeSize = catalog->expandedComboOffers.Size();
    const i64 mealBits[3] = {kMealBreakfast, kMealLunch, kMealDinner};
    for (usize m = 0; m < 3; ++m) {
      ExpandRuleForMeal(ctx, catalog, rule, mealBits[m]);
    }
    // 对当前规则展开生成的全部报价按 offerId 的 UTF-8 字节序升序排列，保证跨平台确定性
    for (usize i = beforeSize + 1; i < catalog->expandedComboOffers.Size(); ++i) {
      const OfferRecord cur = catalog->expandedComboOffers[i];
      usize j = i;
      while (j > beforeSize &&
             catalog->expandedComboOffers[j - 1].offerId.Compare(cur.offerId) > 0) {
        catalog->expandedComboOffers[j] = catalog->expandedComboOffers[j - 1];
        --j;
      }
      catalog->expandedComboOffers[j] = cur;
    }
  }

  return true;
}

namespace {

// ValidateMenuCatalog 契约入口的响应构造器：校验结构、跨表语义、套餐展开与规范化 catalogHash
// validate-menu 命令实现：解析+语义校验后复算目录规范化摘要（排除 catalogHash 键）与声明值
// 比对，一致才 valid=true；counts 输出窗口/菜品/报价/半份/规则计数，供前端与测试核对规模。
bool WriteCatalogValidationResult(ExecContext& ctx, const JsonValue* request, TextBuffer* out) {
  char buffer[192];
  // 支持两种调用形态：{ catalog: {...} } 包装请求，或直接传入顶层 MenuCatalog 对象
  const JsonValue* catalogValue = JsonFind(request, "catalog");
  const char* basePath = "$.catalog";
  if (catalogValue == nullptr) {
    catalogValue = request;
    basePath = "$";
  }

  Catalog catalog;
  if (!ParseCatalog(ctx, catalogValue, basePath, &catalog)) {
    return false;
  }
  if (!ValidateCatalogSemantics(ctx, &catalog, basePath)) {
    return false;
  }

  char computedHash[72];
  if (!ComputeCanonicalHashPrefixed(&ctx.Memory(), catalogValue, "catalogHash", computedHash)) {
    return ctx.FailInternal("$.catalog.catalogHash", "目录规范化序列化失败");
  }
  if (!catalog.catalogHash.Equals(computedHash)) {
    return ctx.Fail("INVALID_INPUT", SubPath(buffer, sizeof(buffer), basePath, "catalogHash"),
                    "catalogHash 与目录规范化序列化摘要不一致");
  }

  JsonOut writer(out);
  writer.BeginObject();
  writer.WriteKey("valid");
  writer.WriteBool(true);
  writer.WriteKey("menuVersion");
  writer.WriteString(catalog.menuVersion);
  writer.WriteKey("catalogHash");
  writer.WriteString(catalog.catalogHash);
  writer.WriteKey("computedCatalogHash");
  writer.WriteString(Str(computedHash));
  writer.WriteKey("counts");
  writer.BeginObject();
  writer.WriteKey("windows");
  writer.WriteNumber(static_cast<i64>(catalog.windows.Size()));
  writer.WriteKey("dishes");
  writer.WriteNumber(static_cast<i64>(catalog.dishes.Size()));
  writer.WriteKey("offers");
  writer.WriteNumber(static_cast<i64>(catalog.offers.Size()));
  writer.WriteKey("halfOffers");
  writer.WriteNumber(static_cast<i64>(catalog.halfOfferCount));
  writer.WriteKey("comboRules");
  writer.WriteNumber(catalog.comboRuleCount);
  writer.EndObject();
  writer.WriteKey("diagnostics");
  writer.BeginArray();
  writer.EndArray();
  writer.EndObject();
  return writer.Ok();
}

// OfferNutrition 契约入口的响应构造器：校验目录结构、套餐展开、餐次匹配与单份营养导出
// offer-nutrition 命令实现：目录校验同 validate-menu（含 hash 复算），对去重后的 offerIds
// 逐个给出指定餐次下的报价营养（含半份缩放与 sumComponents 汇总口径）。
bool WriteOfferNutritionResult(ExecContext& ctx, const JsonValue* request, TextBuffer* out) {
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

  char computedHash[72];
  if (!ComputeCanonicalHashPrefixed(&ctx.Memory(), catalogValue, "catalogHash", computedHash)) {
    return ctx.FailInternal("$.catalog.catalogHash", "目录规范化序列化失败");
  }
  if (!catalog.catalogHash.Equals(computedHash)) {
    return ctx.Fail("INVALID_INPUT", "$.catalog.catalogHash",
                    "catalogHash 与目录规范化序列化摘要不一致");
  }

  const JsonValue* mealValue = RequireMember(ctx, request, "meal", "$.meal");
  if (mealValue == nullptr) {
    return false;
  }
  Str mealStr;
  const char* allowedMeals[] = {"breakfast", "lunch", "dinner", nullptr};
  if (!ReadEnum(ctx, mealValue, "$.meal", allowedMeals, &mealStr)) {
    return false;
  }
  const i64 mealBit = MealMaskFromName(mealStr);
  if (mealBit == 0) {
    return ctx.Fail("INVALID_INPUT", "$.meal", "未知的供餐餐次枚举值");
  }

  const JsonValue* offerIdsValue = RequireMember(ctx, request, "offerIds", "$.offerIds");
  if (offerIdsValue == nullptr) {
    return false;
  }
  if (!RequireArrayType(ctx, offerIdsValue, "$.offerIds")) {
    return false;
  }
  if (offerIdsValue->child == nullptr) {
    return ctx.Fail("INVALID_INPUT", "$.offerIds", "offerIds 必须非空");
  }

  Vec<Str> seenIds;
  seenIds.Init(&ctx.Memory());
  Vec<const OfferRecord*> matchedOffers;
  matchedOffers.Init(&ctx.Memory());

  for (const JsonValue* item = offerIdsValue->child; item != nullptr; item = item->next) {
    Str id;
    if (!ReadString(ctx, item, "$.offerIds[]", &id)) {
      return false;
    }
    if (id.size == 0) {
      return ctx.Fail("INVALID_INPUT", "$.offerIds[]", "offerId 不能为空字符串");
    }
    for (usize i = 0; i < seenIds.Size(); ++i) {
      if (seenIds[i].Equals(id)) {
        return ctx.Fail("INVALID_INPUT", "$.offerIds", "offerIds 存在重复项");
      }
    }
    const OfferRecord* offer = FindOffer(catalog, id);
    if (offer == nullptr || (offer->mealMask & mealBit) == 0) {
      return ctx.Fail("INVALID_INPUT", "$.offerIds", "offerId 不存在或不属于指定餐次");
    }
    seenIds.Push(id);
    matchedOffers.Push(offer);
  }

  JsonOut writer(out);
  writer.BeginObject();
  writer.WriteKey("menuVersion");
  writer.WriteString(catalog.menuVersion);
  writer.WriteKey("catalogHash");
  writer.WriteString(catalog.catalogHash);
  writer.WriteKey("meal");
  writer.WriteString(mealStr);
  writer.WriteKey("offers");
  writer.BeginArray();
  for (usize i = 0; i < matchedOffers.Size(); ++i) {
    const OfferRecord* offer = matchedOffers[i];
    writer.BeginObject();
    writer.WriteKey("offerId");
    writer.WriteString(offer->offerId);
    writer.WriteKey("dishId");
    writer.WriteString(offer->dishId);
    writer.WriteKey("windowId");
    writer.WriteString(offer->windowId);
    writer.WriteKey("portionCode");
    writer.WriteString(offer->isHalf ? Str("half") : Str("full"));

    NutritionValues nv = OfferNutrition(catalog, *offer);
    writer.WriteKey("nutrition");
    writer.BeginObject();
    writer.WriteKey("energyKcal");
    if (nv.hasEnergy) {
      writer.WriteNumber(nv.energyKcal);
    } else {
      writer.WriteNull();
    }
    writer.WriteKey("proteinDg");
    if (nv.hasProtein) {
      writer.WriteNumber(nv.proteinDg);
    } else {
      writer.WriteNull();
    }
    writer.WriteKey("fatDg");
    if (nv.hasFat) {
      writer.WriteNumber(nv.fatDg);
    } else {
      writer.WriteNull();
    }
    writer.WriteKey("carbDg");
    if (nv.hasCarb) {
      writer.WriteNumber(nv.carbDg);
    } else {
      writer.WriteNull();
    }
    writer.EndObject();

    writer.WriteKey("nutritionComplete");
    writer.WriteBool(nv.Complete());
    writer.WriteKey("estimated");
    writer.WriteBool(offer->estimated);
    writer.EndObject();
  }
  writer.EndArray();
  writer.EndObject();
  return writer.Ok();
}

}  // namespace

// validate-menu 命令入口：交给通用契约信封执行器（版本协商/错误信封统一处理）。
bool ValidateMenuCatalogEntry(ExecContext& ctx, const char* requestText, usize length,
                              TextBuffer* out) {
  return RunContractEntry(ctx, requestText, length, &WriteCatalogValidationResult, false, out);
}

// offer-nutrition 命令入口：交给通用契约信封执行器。
bool OfferNutritionEntry(ExecContext& ctx, const char* requestText, usize length,
                         TextBuffer* out) {
  return RunContractEntry(ctx, requestText, length, &WriteOfferNutritionResult, false, out);
}

}  // namespace mp

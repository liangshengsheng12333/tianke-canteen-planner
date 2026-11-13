// mp/catalog.h — MenuCatalog 的结构定义、语法解析、引用校验与套餐展开接口
//
// 设计职责与模块边界：
//   1. 本头文件服务于 ValidateMenuCatalog 与 PlanDay 两个核心契约入口，提供统一的
//      菜单快照数据结构（WindowRecord / DishRecord / OfferRecord / ComboRuleRecord）。
//   2. 严格区分营养主数据（DishRecord）与售卖报价单位（OfferRecord）：
//      - 单品（kind="single"）直接携带实验室/标准库或估算营养值；
//      - 固定套餐（kind="combo"）优先使用自身完整营养值，若不完整则按显式声明的
//        components[]{dishId, count} 汇总单品组件营养，并一路传播 estimated 标志；
//      - 规则套餐（comboRules[]）在候选生成前按窗口、餐次、分类配比（requiredCounts）
//        与候选单品集合（candidateDishIds）确定性展开为原子报价单位，其稳定标识固定为
//        offerId = ruleId#<按UTF-8字节序升序拼接的dishId列表>。
//   3. 半份米饭规则（契约 §3 / P01 裁定 6）：
//      - 仅允许 riceDish=true 的单品配置 portionCode="half"（比例固定为 1/2）；
//      - 半份米饭与同窗口、同 dishId 的整份米饭必须同价（整份未知则半份未知），不得折半；
//      - 半份营养值按 1/2 比例对四项营养素逐项执行整数 round_half_up 换算。
#ifndef MP_CATALOG_H
#define MP_CATALOG_H

#include "mp/base.h"
#include "mp/json.h"

namespace mp {

// 餐次位掩码常量：支持早餐（1）、午餐（2）、晚餐（4）三个标准正餐及其按位组合
constexpr i64 kMealBreakfast = 1;
constexpr i64 kMealLunch = 2;
constexpr i64 kMealDinner = 4;

// 将单个餐次位掩码转换为规范枚举名（"breakfast" / "lunch" / "dinner"）
Str MealNameFromMask(i64 mask);

// 将餐次枚举名解析为对应的位掩码；未知名称返回 0
i64 MealMaskFromName(Str name);

// 四项核心营养素数值结构：
//   * 能量使用整数千卡（energyKcal）
//   * 蛋白质、脂肪、碳水化合物使用整数分克（0.1g，即 proteinDg / fatDg / carbDg）
//   * has* 布尔位严格区分「已知零（has=true, val=0）」与「数据缺失（has=false, JSON null）」
struct NutritionValues {
  bool hasEnergy;
  bool hasProtein;
  bool hasFat;
  bool hasCarb;
  i64 energyKcal;
  i64 proteinDg;
  i64 fatDg;
  i64 carbDg;

  // 仅当四项营养素全部非 null（即全部已知）时才判定为营养完整
  bool Complete() const { return hasEnergy && hasProtein && hasFat && hasCarb; }
};

// 套餐组件项：用于固定套餐（DishRecord.components）与展开后规则套餐（OfferRecord.components）
// 记录组件单品的 dishId 及其在单个售卖单位内的整数份数（count >= 1）
struct ComboComponent {
  Str dishId;
  i64 count;
};

// 规则套餐对单一菜品分类的必选数量要求（如 protein: 1, vegetable: 1）
struct ComboCategoryCount {
  Str category;
  i64 count;
};

// 规则套餐（catalog.comboRules[]）结构定义：
//   * ruleId: 稳定规则标识，作为展开后 offerId 的前缀
//   * windowId / mealMask: 套餐归属窗口与可供应餐次掩码（必须是窗口供应餐次的子集）
//   * totalPriceCents: 真实套餐总价（整数分），计价时直接使用总价，不按组件拆价
//   * includesRice: 是否含米饭；若为 true 则同餐次候选不再重复选购独立米饭 offer
//   * requiredCounts: 各分类必选单品份数（每个候选单品在同一套餐内至多选 1 份）
//   * candidateDishIds: 允许参与组合的单品 dishId 集合（去重且必须引用合法 single 菜品）
//   * nutritionPolicy: 固定为 "sumComponents"，按组件营养逐项求和并保留估算标志
struct ComboRuleRecord {
  Str ruleId;
  Str name;
  Str windowId;
  i64 mealMask;
  i64 totalPriceCents;
  bool includesRice;
  Vec<ComboCategoryCount> requiredCounts;
  Vec<Str> candidateDishIds;
  Str nutritionPolicy;
};

// 菜品主数据记录（catalog.dishes[]）：
//   * kind 取值为 "single" 或 "combo"
//   * 当 kind="combo" 时，components 非空，且若自身 nutrition 不完整则由组件汇总填充
struct DishRecord {
  Str dishId;
  Str name;
  Str kind;
  bool hasCategory;
  Str category;
  bool riceDish;
  bool riceIncluded;
  bool hasRiceIncluded;
  NutritionValues nutrition;
  bool estimated;
  Str nutritionSource;
  Vec<ComboComponent> components;
};

// 售卖报价单位记录（含 catalog.offers[] 静态报价与 comboRules 展开报价）：
//   * 静态报价与规则展开报价在单餐候选生成、锁定校验、售罄过滤、预算计价与多样性统计中同等对待
//   * components 保存该报价对应的底层单品构成（单品报价含 1 个自身组件，套餐含全部子组件），
//     用于跨餐次重复菜计数、类别覆盖统计、口味词匹配以及组件级售罄连带排除
struct OfferRecord {
  Str offerId;
  Str dishId;
  Str dishName;
  Str windowId;
  i64 mealMask;
  bool isHalf;
  i64 ratioNum;
  i64 ratioDen;
  bool priceKnown;
  i64 priceCents;
  Str priceBasis;
  bool hasNutritionOverride;
  NutritionValues nutritionOverride;
  bool isCombo;
  bool isExpandedRule;
  bool riceDish;
  bool riceIncluded;
  bool estimated;
  Str nutritionSource;
  Vec<ComboComponent> components;
};

// 食堂窗口记录（catalog.windows[]）
struct WindowRecord {
  Str windowId;
  Str name;
  i64 mealMask;
};

// 完整菜单快照结构：
//   * offers 保存输入 JSON 中的原始报价列表（保持原始条数供 ValidateMenuCatalog 统计）
//   * comboRules 保存输入 JSON 中的规则套餐定义
//   * expandedComboOffers 保存由 ValidateCatalogSemantics 确定性展开生成的规则套餐报价
struct Catalog {
  Str menuVersion;
  Str catalogHash;
  Str canteenId;
  i64 comboRuleCount;
  usize halfOfferCount;
  Vec<WindowRecord> windows;
  Vec<DishRecord> dishes;
  Vec<OfferRecord> offers;
  Vec<ComboRuleRecord> comboRules;
  Vec<OfferRecord> expandedComboOffers;
};

// 解析 MenuCatalog JSON 子树并执行字段级结构校验（L2 层）。失败时向 ctx 写入带路径的错误。
bool ParseCatalog(ExecContext& ctx, const JsonValue* catalogValue, const char* basePath,
                  Catalog* out);

// 执行跨表语义校验与套餐展开（L3/L5/L7 层）：
//   1. 校验 offers 对 dishes/windows 的引用完整性及餐次交集；
//   2. 校验半份米饭仅用于 riceDish=true 且与同窗同菜整份报价严格同价；
//   3. 校验固定套餐（kind="combo"）组件存在性、非递归性，并在自身营养缺失时按组件汇总；
//   4. 校验 comboRules 引用合法性，并按窗口供应范围及 requiredCounts 升序展开生成原子报价。
bool ValidateCatalogSemantics(ExecContext& ctx, Catalog* catalog, const char* basePath);

// 在菜单快照中按稳定 ID 线性查找菜品或窗口（未找到返回 nullptr）
const DishRecord* FindDish(const Catalog& catalog, Str dishId);
const WindowRecord* FindWindow(const Catalog& catalog, Str windowId);

// 在静态报价与规则展开报价中按 offerId 查找报价记录（未找到返回 nullptr）
const OfferRecord* FindOffer(const Catalog& catalog, Str offerId);

// 按给定的分子/分母比例对四项营养素执行整数 round_half_up 缩放（用于半份米饭 1/2 换算）
NutritionValues ScaleNutrition(const NutritionValues& full, i64 numerator, i64 denominator);

// 获取报价单位的实际生效营养值（优先使用 nutritionOverride，否则取关联 DishRecord 营养并按份量缩放）
NutritionValues OfferNutrition(const Catalog& catalog, const OfferRecord& offer);

// 获取报价单位的已知整数分价格（当 priceKnown=false 时返回 0，调用方须结合 priceKnown 判断）
i64 OfferPriceCents(const OfferRecord& offer);

}  // namespace mp

#endif  // MP_CATALOG_H

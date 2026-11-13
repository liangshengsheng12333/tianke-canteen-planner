// mp/nutrition.h — 营养目标计算对规划器暴露的规划快照
//
// ComputeNutritionTarget 的完整结果仍以 ResultEnvelope 输出；PlanDay 需要的是
// “目标是否可用于自动规划 + 可用的日目标/餐次参考”，这里单独给一个结构化快照，
// 避免规划器去解析 JSON 文本。
#ifndef MP_NUTRITION_H
#define MP_NUTRITION_H

#include "mp/base.h"
#include "mp/json.h"

namespace mp {

struct MacroTargets {
  i64 energyKcal;
  i64 proteinDg;
  i64 fatDg;
  i64 carbDg;
};

struct PlanTargetSnapshot {
  Str status;  // TargetResult.status，例如 Ok / AUTO_TARGET_DISABLED / TARGET_REVIEW_REQUIRED
  bool usableForAutoPlanning;
  Vec<Str> reasons;      // applicability.reasons
  MacroTargets daily;
  MacroTargets mealBreakfast;
  MacroTargets mealLunch;
  MacroTargets mealDinner;
  char nutritionConfigHash[72];
};

// 从 PlanRequest（含 profile 与 nutritionConfig）算出规划快照；失败表示请求非法
bool ComputeTargetForPlanning(ExecContext& ctx, const JsonValue* request,
                              PlanTargetSnapshot* snapshot);

}  // namespace mp

#endif  // MP_NUTRITION_H

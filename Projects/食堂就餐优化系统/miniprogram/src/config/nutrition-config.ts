/**
 * nutrition-config.ts — T01 v1.2 冻结营养配置快照的只读副本。
 *
 * 来源：Resources/契约/T01-v1.2-candidate/nutrition-v1-candidate.json 的 `snapshot`
 * 对象（canonical 内容，不含 hash）。本文件只做原样复制，供 PlanRequest/TargetRequest
 * 携带；前端不得在此派生、收紧或放宽任何营养阈值。
 *
 * 快照摘要：sha256:c93d2d91b13e54466e89d7d41ec50b1d93b6566cdee699af0cb81154a72dd288
 * 自动测试会按 T01 v1.2 §0.3 口径复算该摘要，不一致即失败（防止手工误改）。
 */

export interface NutritionConfigSnapshot {
  version: string;
  formula: string;
  parameters: {
    fatLossDeficitPermille: number;
    fatLossDeficitCapKcal: number;
    activityFactorPermille: Record<string, number>;
    proteinMgPerKgNormal: number;
    proteinMgPerKgTrainingPreference: number;
    fatEnergyPermille: number;
    mealSharePermille: Record<string, number>;
  };
  population: {
    ageMinYears: number;
    ageMaxYears: number;
    pregnancyOrLactationPolicy: string;
    medicalDietPolicy: string;
  };
  macroThresholds: Record<string, any>;
  energyFloor: { maleKcalPerDay: number; femaleKcalPerDay: number };
  manualTargetRules: { sourceTypes: string[]; tolerance: string; derivedFieldsAllowed: boolean };
  plannerSorting: Record<string, any>;
}

/** 冻结快照正文（不含根 hash 字段）。字段顺序无关紧要，摘要按规范化序列化计算。 */
export const NUTRITION_CONFIG_SNAPSHOT: NutritionConfigSnapshot = {
  version: 'nutrition-v1.2-candidate',
  formula: 'mifflin-st-jeor',
  parameters: {
    fatLossDeficitPermille: 100,
    fatLossDeficitCapKcal: 300,
    activityFactorPermille: {
      sedentary: 1200,
      light: 1375,
      moderate: 1550,
      active: 1725,
      veryActive: 1900,
    },
    proteinMgPerKgNormal: 1200,
    proteinMgPerKgTrainingPreference: 1500,
    fatEnergyPermille: 270,
    mealSharePermille: { breakfast: 300, lunch: 400, dinner: 300 },
  },
  population: {
    ageMinYears: 18,
    ageMaxYears: 78,
    pregnancyOrLactationPolicy: 'disableAutoTargetsAndAutoPlanning',
    medicalDietPolicy: 'disableAutoTargetsAndAutoPlanning',
  },
  macroThresholds: {
    adult19To78: {
      proteinBp: [1000, 3500],
      fatBp: [2000, 3500],
      carbBp: [4500, 6500],
      carbFloorGPerDay: 130,
    },
    age18: {
      proteinBp: [1000, 3000],
      fatBp: [2500, 3500],
      carbBp: [4500, 6500],
      carbFloorGPerDay: null,
    },
  },
  energyFloor: { maleKcalPerDay: 1500, femaleKcalPerDay: 1200 },
  manualTargetRules: {
    sourceTypes: ['professional', 'userEntered'],
    tolerance: 'max(20kcal,2%)',
    derivedFieldsAllowed: true,
  },
  plannerSorting: {
    nutritionDeviationWeightsPermille: { energy: 250, protein: 250, fat: 250, carb: 250 },
    nutritionTierWidthBp: 1000,
  },
};

/** P01 冻结记录中的快照摘要；请求必须携带同一个值。 */
export const NUTRITION_CONFIG_HASH =
  'sha256:c93d2d91b13e54466e89d7d41ec50b1d93b6566cdee699af0cb81154a72dd288';

/** 构造请求里的 nutritionConfig（快照 + 根 hash）。返回副本，避免调用方改到模块常量。 */
export function buildNutritionConfigRequest(): any {
  const snapshot: any = JSON.parse(JSON.stringify(NUTRITION_CONFIG_SNAPSHOT));
  snapshot.hash = NUTRITION_CONFIG_HASH;
  return snapshot;
}

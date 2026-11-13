// 模块说明：营养目标计算核心（ComputeNutritionTarget，契约 §8）全整数实现。
// 数学与工程不变量：
//   1. 全程采用 64 位有符号整数（int64_t）与毫千卡（mkcal）/分克（dg）/基点（bp）/千分比（permille）定点运算，零浮点参与；
//   2. BMI 过轻判定（<18.5 kg/m^2）使用未舍入精确交叉乘法：weightGrams * 10000 < 185 * heightMm * heightMm；
//   3. 状态机严格遵循契约优先级：人群禁用/高风险手动仅存 -> 体重过轻 -> 性别能量下限 -> 手动目标容差核查 -> 宏量营养素占比门槛 -> Ok。
// nutrition.cpp — ComputeNutritionTarget 的实现（契约 §8）
//
// 全程整数运算：中间量 int64_t，禁止浮点；比例判定用交叉相乘，只有展示值才舍入。
// 状态优先级：人群/风险 -> 过轻 -> 能量下限 -> 手动完整性/一致性 -> 宏量门槛 -> Ok。
#include "mp/contract.h"
#include "mp/nutrition.h"
#include "mp/sha256.h"

namespace mp {

namespace {

// ---------------------------------------------------------------------------
// 整数工具
// ---------------------------------------------------------------------------
i64 RoundHalfUp(i64 value, i64 divisor) { return (2 * value + divisor) / (2 * divisor); }

const char* SubKey(char* buffer, usize capacity, const char* base, const char* key) {
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

const char* SubIndex(char* buffer, usize capacity, const char* base, usize index) {
  usize cursor = 0;
  while (*base != '\0' && cursor + 1 < capacity) {
    buffer[cursor++] = *base++;
  }
  if (cursor + 1 < capacity) {
    buffer[cursor++] = '[';
  }
  char number[24];
  const usize written = FormatI64(number, sizeof(number), static_cast<i64>(index));
  for (usize i = 0; i < written && cursor + 1 < capacity; ++i) {
    buffer[cursor++] = number[i];
  }
  if (cursor + 1 < capacity) {
    buffer[cursor++] = ']';
  }
  buffer[cursor] = '\0';
  return buffer;
}

// ---------------------------------------------------------------------------
// 输入模型
// ---------------------------------------------------------------------------
struct MacroBand {
  i64 proteinMinBp;
  i64 proteinMaxBp;
  i64 fatMinBp;
  i64 fatMaxBp;
  i64 carbMinBp;
  i64 carbMaxBp;
  bool hasCarbFloor;
  i64 carbFloorGPerDay;
};

// 营养配置参数（来自请求 nutritionConfig 快照）：缺口/活动系数/脂肪供能比与三餐占比
// 一律为千分比（permille，1‰=0.1%）；蛋白按 mg/kg 体重；缺口上限为 kcal/日。
struct NutritionParameters {
  i64 fatLossDeficitPermille;
  i64 fatLossDeficitCapKcal;
  i64 activityPermilleSedentary;
  i64 activityPermilleLight;
  i64 activityPermilleModerate;
  i64 activityPermilleActive;
  i64 activityPermilleVeryActive;
  i64 proteinMgPerKgNormal;
  i64 proteinMgPerKgTraining;
  i64 fatEnergyPermille;
  i64 sharePermilleBreakfast;
  i64 sharePermilleLunch;
  i64 sharePermilleDinner;
};

// 营养配置快照：version/formula/hash 取自请求；hash 为快照规范化 JSON（排除 hash 键）的
// SHA-256 前缀摘要，复算不一致即拒绝请求，防止参数与声明漂移。
struct NutritionConfig {
  Str version;
  Str formula;
  NutritionParameters parameters;
  i64 ageMinYears;
  i64 ageMaxYears;
  MacroBand adult;
  MacroBand age18;
  i64 energyFloorMale;
  i64 energyFloorFemale;
  bool derivedFieldsAllowed;
};

// 手动目标输入：三大宏量允许缺失（has*=false 表示“未提供”，语义不是 0）；能量必填。
struct ManualTargetInput {
  bool present;
  i64 energyKcal;
  bool hasProtein;
  i64 proteinDg;
  bool hasFat;
  i64 fatDg;
  bool hasCarb;
  i64 carbDg;
  Str sourceType;
  Str sourceNote;
  bool hasSourceNote;
  i64 derivedFieldCount;
};

// 人群画像输入：身高 mm、体重 g 全整数；体脂率（‰）只校验范围不参与计算（预留字段）。
struct ProfileInput {
  Str sex;
  i64 ageYears;
  i64 heightMm;
  i64 weightGrams;
  Str activityLevel;
  Str goalType;
  bool trainingPreference;
  bool pregnancyOrLactation;
  bool medicalDietManagement;
  ManualTargetInput manual;
};

// 宏量构成判定：实际占比与配置区间均以 bp（万分之一）表示；passed=是否全部落入区间。
struct CompositionResult {
  i64 proteinBp;
  i64 fatBp;
  i64 carbBp;
  i64 carbDg;
  MacroBand band;
  bool hasCarbFloor;
  i64 carbFloorDg;
  bool passed;
};

// 手动目标核查报告：能量差与容差以 0.1 kcal（tenths）计；容差 = max(声明能量 2%, 20 kcal)。
struct ManualReport {
  Str sourceType;
  Str sourceNote;
  bool hasSourceNote;
  i64 declaredEnergyKcal;
  bool hasProtein;
  i64 declaredProteinDg;
  bool hasFat;
  i64 declaredFatDg;
  bool hasCarb;
  i64 declaredCarbDg;
  bool hasDifference;
  i64 energyDiffTenthsKcal;
  i64 toleranceTenthsKcal;
  bool withinTolerance;
  bool applied;
  Str reason;
  bool hasReason;
};

// 营养目标总结果：targets 仅在 Ok 时给出；reference 供过轻维持人群仅参考；
// computed 为未通过构成判定时的计算值（validForAutoPlanning=false，不进入自动规划）。
struct TargetOutcome {
  Str status;
  bool eligible;
  Vec<Str> reasons;
  Str ageBand;
  bool age18Extrapolation;
  i64 bmiDisplayTenths;
  bool underweightByUnrounded;

  bool hasTargets;
  MacroTargets daily;
  MacroTargets mealBreakfast;
  MacroTargets mealLunch;
  MacroTargets mealDinner;
  Str sourceGoal;

  bool hasReference;
  i64 referenceReeMkcal;
  i64 referenceTdeeMkcal;

  bool hasComputed;
  MacroTargets computed;

  bool hasComposition;
  CompositionResult composition;

  bool hasManual;
  ManualReport manual;

  Vec<Str> warnings;
};

// ---------------------------------------------------------------------------
// 参数解析
// ---------------------------------------------------------------------------
// 解析宏量区间：蛋白/脂肪/碳水各 [min,max]（bp，0..10000）；碳水下限可空（null=无下限）。
bool ParseBand(ExecContext& ctx, const JsonValue* band, const char* path, MacroBand* out) {
  if (!RequireObjectType(ctx, band, path)) {
    return false;
  }
  char buffer[192];
  const JsonValue* protein = RequireMember(ctx, band, "proteinBp", SubKey(buffer, sizeof(buffer), path, "proteinBp"));
  if (protein == nullptr) {
    return false;
  }
  if (!RequireArrayType(ctx, protein, SubKey(buffer, sizeof(buffer), path, "proteinBp"))) {
    return false;
  }
  if (protein->count != 2) {
    return ctx.Fail("INVALID_INPUT", path, "proteinBp 必须是两个元素");
  }
  const JsonValue* minValue = protein->child;
  const JsonValue* maxValue = minValue->next;
  if (!ReadInt(ctx, minValue, SubIndex(buffer, sizeof(buffer), SubKey(buffer, sizeof(buffer), path, "proteinBp"), 0), 0, 10000, &out->proteinMinBp)) {
    return false;
  }
  if (!ReadInt(ctx, maxValue, SubIndex(buffer, sizeof(buffer), SubKey(buffer, sizeof(buffer), path, "proteinBp"), 1), 0, 10000, &out->proteinMaxBp)) {
    return false;
  }

  const JsonValue* fat = RequireMember(ctx, band, "fatBp", SubKey(buffer, sizeof(buffer), path, "fatBp"));
  if (fat == nullptr || !RequireArrayType(ctx, fat, SubKey(buffer, sizeof(buffer), path, "fatBp"))) {
    return false;
  }
  if (fat->count != 2) {
    return ctx.Fail("INVALID_INPUT", path, "fatBp 必须是两个元素");
  }
  if (!ReadInt(ctx, fat->child, path, 0, 10000, &out->fatMinBp)) {
    return false;
  }
  if (!ReadInt(ctx, fat->child->next, path, 0, 10000, &out->fatMaxBp)) {
    return false;
  }

  const JsonValue* carb = RequireMember(ctx, band, "carbBp", SubKey(buffer, sizeof(buffer), path, "carbBp"));
  if (carb == nullptr || !RequireArrayType(ctx, carb, SubKey(buffer, sizeof(buffer), path, "carbBp"))) {
    return false;
  }
  if (carb->count != 2) {
    return ctx.Fail("INVALID_INPUT", path, "carbBp 必须是两个元素");
  }
  if (!ReadInt(ctx, carb->child, path, 0, 10000, &out->carbMinBp)) {
    return false;
  }
  if (!ReadInt(ctx, carb->child->next, path, 0, 10000, &out->carbMaxBp)) {
    return false;
  }

  const JsonValue* floor = RequireMember(ctx, band, "carbFloorGPerDay", SubKey(buffer, sizeof(buffer), path, "carbFloorGPerDay"));
  if (floor == nullptr) {
    return false;
  }
  if (floor->kind == JsonKind::Null) {
    out->hasCarbFloor = false;
    out->carbFloorGPerDay = 0;
  } else {
    out->hasCarbFloor = true;
    if (!ReadInt(ctx, floor, SubKey(buffer, sizeof(buffer), path, "carbFloorGPerDay"), 0, 100000, &out->carbFloorGPerDay)) {
      return false;
    }
  }
  return true;
}

// 解析 nutritionConfig：先复算快照 hash（排除 hash 键的规范化 SHA-256），再逐段读取
// 参数/人群区间/能量下限/手动目标规则；version 与 formula 白名单不符即拒绝。
bool ParseConfig(ExecContext& ctx, const JsonValue* config, NutritionConfig* out) {
  const char* path = "$.nutritionConfig";
  if (!RequireObjectType(ctx, config, path)) {
    return false;
  }
  char buffer[192];
  const JsonValue* version = RequireMember(ctx, config, "version", SubKey(buffer, sizeof(buffer), path, "version"));
  if (version == nullptr || !ReadString(ctx, version, SubKey(buffer, sizeof(buffer), path, "version"), &out->version)) {
    return false;
  }
  if (!out->version.Equals(kNutritionConfigVersion)) {
    return ctx.Fail("INVALID_INPUT", SubKey(buffer, sizeof(buffer), path, "version"),
                    "nutritionConfig.version 不是本实现支持的营养配置版本");
  }

  const JsonValue* formula = RequireMember(ctx, config, "formula", SubKey(buffer, sizeof(buffer), path, "formula"));
  if (formula == nullptr || !ReadString(ctx, formula, SubKey(buffer, sizeof(buffer), path, "formula"), &out->formula)) {
    return false;
  }
  if (!out->formula.Equals("mifflin-st-jeor")) {
    return ctx.Fail("INVALID_INPUT", SubKey(buffer, sizeof(buffer), path, "formula"),
                    "formula 只支持 mifflin-st-jeor");
  }

  // 快照哈希：按规范化序列化复算，必须与请求内声明的 hash 一致
  const JsonValue* hashValue = RequireMember(ctx, config, "hash",
                                            SubKey(buffer, sizeof(buffer), path, "hash"));
  if (hashValue == nullptr) {
    return false;
  }
  Str declaredHash;
  if (!ReadString(ctx, hashValue, SubKey(buffer, sizeof(buffer), path, "hash"), &declaredHash)) {
    return false;
  }
  char computedHash[72];
  if (!ComputeCanonicalHashPrefixed(&ctx.Memory(), config, "hash", computedHash)) {
    return ctx.FailInternal("$.nutritionConfig.hash", "快照规范化序列化失败");
  }
  if (!declaredHash.Equals(computedHash)) {
    return ctx.Fail("INVALID_INPUT", SubKey(buffer, sizeof(buffer), path, "hash"),
                    "nutritionConfig.hash 与快照规范化序列化摘要不一致");
  }

  const JsonValue* parameters = RequireMember(ctx, config, "parameters", SubKey(buffer, sizeof(buffer), path, "parameters"));
  if (!RequireObjectType(ctx, parameters, SubKey(buffer, sizeof(buffer), path, "parameters"))) {
    return false;
  }
  char paramPath[192];
  SubKey(paramPath, sizeof(paramPath), path, "parameters");
  NutritionParameters& p = out->parameters;
  const char* keys[] = {"fatLossDeficitPermille", "fatLossDeficitCapKcal", "proteinMgPerKgNormal",
                        "proteinMgPerKgTrainingPreference", "fatEnergyPermille"};
  i64* targets[] = {&p.fatLossDeficitPermille, &p.fatLossDeficitCapKcal, &p.proteinMgPerKgNormal,
                    &p.proteinMgPerKgTraining, &p.fatEnergyPermille};
  const i64 minimums[] = {0, 0, 0, 0, 0};
  const i64 maximums[] = {1000, 5000, 5000, 5000, 1000};
  for (usize i = 0; i < 5; ++i) {
    const JsonValue* value = RequireMember(ctx, parameters, keys[i], SubKey(buffer, sizeof(buffer), paramPath, keys[i]));
    if (value == nullptr) {
      return false;
    }
    if (!ReadInt(ctx, value, SubKey(buffer, sizeof(buffer), paramPath, keys[i]), minimums[i], maximums[i], targets[i])) {
      return false;
    }
  }

  const JsonValue* factors = RequireMember(ctx, parameters, "activityFactorPermille",
                                          SubKey(buffer, sizeof(buffer), paramPath, "activityFactorPermille"));
  if (!RequireObjectType(ctx, factors, SubKey(buffer, sizeof(buffer), paramPath, "activityFactorPermille"))) {
    return false;
  }
  char factorPath[192];
  SubKey(factorPath, sizeof(factorPath), paramPath, "activityFactorPermille");
  const char* factorKeys[] = {"sedentary", "light", "moderate", "active", "veryActive"};
  i64* factorTargets[] = {&p.activityPermilleSedentary, &p.activityPermilleLight,
                          &p.activityPermilleModerate, &p.activityPermilleActive,
                          &p.activityPermilleVeryActive};
  for (usize i = 0; i < 5; ++i) {
    const JsonValue* value = RequireMember(ctx, factors, factorKeys[i], SubKey(buffer, sizeof(buffer), factorPath, factorKeys[i]));
    if (value == nullptr) {
      return false;
    }
    if (!ReadInt(ctx, value, SubKey(buffer, sizeof(buffer), factorPath, factorKeys[i]), 500, 5000, factorTargets[i])) {
      return false;
    }
  }

  const JsonValue* shares = RequireMember(ctx, parameters, "mealSharePermille",
                                          SubKey(buffer, sizeof(buffer), paramPath, "mealSharePermille"));
  if (!RequireObjectType(ctx, shares, SubKey(buffer, sizeof(buffer), paramPath, "mealSharePermille"))) {
    return false;
  }
  char sharePath[192];
  SubKey(sharePath, sizeof(sharePath), paramPath, "mealSharePermille");
  i64* shareTargets[] = {&p.sharePermilleBreakfast, &p.sharePermilleLunch, &p.sharePermilleDinner};
  const char* shareKeys[] = {"breakfast", "lunch", "dinner"};
  for (usize i = 0; i < 3; ++i) {
    const JsonValue* value = RequireMember(ctx, shares, shareKeys[i], SubKey(buffer, sizeof(buffer), sharePath, shareKeys[i]));
    if (value == nullptr) {
      return false;
    }
    if (!ReadInt(ctx, value, SubKey(buffer, sizeof(buffer), sharePath, shareKeys[i]), 0, 1000, shareTargets[i])) {
      return false;
    }
  }

  const JsonValue* population = RequireMember(ctx, config, "population", SubKey(buffer, sizeof(buffer), path, "population"));
  if (!RequireObjectType(ctx, population, SubKey(buffer, sizeof(buffer), path, "population"))) {
    return false;
  }
  char populationPath[192];
  SubKey(populationPath, sizeof(populationPath), path, "population");
  const JsonValue* ageMin = RequireMember(ctx, population, "ageMinYears", SubKey(buffer, sizeof(buffer), populationPath, "ageMinYears"));
  const JsonValue* ageMax = RequireMember(ctx, population, "ageMaxYears", SubKey(buffer, sizeof(buffer), populationPath, "ageMaxYears"));
  if (ageMin == nullptr || ageMax == nullptr) {
    return false;
  }
  if (!ReadInt(ctx, ageMin, SubKey(buffer, sizeof(buffer), populationPath, "ageMinYears"), 0, 150, &out->ageMinYears)) {
    return false;
  }
  if (!ReadInt(ctx, ageMax, SubKey(buffer, sizeof(buffer), populationPath, "ageMaxYears"), 0, 150, &out->ageMaxYears)) {
    return false;
  }

  const JsonValue* thresholds = RequireMember(ctx, config, "macroThresholds", SubKey(buffer, sizeof(buffer), path, "macroThresholds"));
  if (!RequireObjectType(ctx, thresholds, SubKey(buffer, sizeof(buffer), path, "macroThresholds"))) {
    return false;
  }
  char thresholdPath[192];
  SubKey(thresholdPath, sizeof(thresholdPath), path, "macroThresholds");
  const JsonValue* adult = RequireMember(ctx, thresholds, "adult19To78", SubKey(buffer, sizeof(buffer), thresholdPath, "adult19To78"));
  const JsonValue* age18 = RequireMember(ctx, thresholds, "age18", SubKey(buffer, sizeof(buffer), thresholdPath, "age18"));
  if (adult == nullptr || age18 == nullptr) {
    return false;
  }
  if (!ParseBand(ctx, adult, SubKey(buffer, sizeof(buffer), thresholdPath, "adult19To78"), &out->adult)) {
    return false;
  }
  if (!ParseBand(ctx, age18, SubKey(buffer, sizeof(buffer), thresholdPath, "age18"), &out->age18)) {
    return false;
  }

  const JsonValue* floor = RequireMember(ctx, config, "energyFloor", SubKey(buffer, sizeof(buffer), path, "energyFloor"));
  if (!RequireObjectType(ctx, floor, SubKey(buffer, sizeof(buffer), path, "energyFloor"))) {
    return false;
  }
  char floorPath[192];
  SubKey(floorPath, sizeof(floorPath), path, "energyFloor");
  const JsonValue* maleFloor = RequireMember(ctx, floor, "maleKcalPerDay", SubKey(buffer, sizeof(buffer), floorPath, "maleKcalPerDay"));
  const JsonValue* femaleFloor = RequireMember(ctx, floor, "femaleKcalPerDay", SubKey(buffer, sizeof(buffer), floorPath, "femaleKcalPerDay"));
  if (maleFloor == nullptr || femaleFloor == nullptr) {
    return false;
  }
  if (!ReadInt(ctx, maleFloor, SubKey(buffer, sizeof(buffer), floorPath, "maleKcalPerDay"), 0, 10000, &out->energyFloorMale)) {
    return false;
  }
  if (!ReadInt(ctx, femaleFloor, SubKey(buffer, sizeof(buffer), floorPath, "femaleKcalPerDay"), 0, 10000, &out->energyFloorFemale)) {
    return false;
  }

  const JsonValue* manualRules = RequireMember(ctx, config, "manualTargetRules", SubKey(buffer, sizeof(buffer), path, "manualTargetRules"));
  if (!RequireObjectType(ctx, manualRules, SubKey(buffer, sizeof(buffer), path, "manualTargetRules"))) {
    return false;
  }
  char manualPath[192];
  SubKey(manualPath, sizeof(manualPath), path, "manualTargetRules");
  const JsonValue* derived = RequireMember(ctx, manualRules, "derivedFieldsAllowed", SubKey(buffer, sizeof(buffer), manualPath, "derivedFieldsAllowed"));
  if (derived == nullptr || !ReadBool(ctx, derived, SubKey(buffer, sizeof(buffer), manualPath, "derivedFieldsAllowed"), &out->derivedFieldsAllowed)) {
    return false;
  }
  return true;
}

// 解析手动目标：三大宏量经 ReadOptionalInt（null/缺失=未提供≠0）；sourceType 受控枚举；
// derivedFields 仅计数存档，不参与任何计算。
bool ParseManualTargets(ExecContext& ctx, const JsonValue* manual, const char* path,
                        ManualTargetInput* out) {
  out->present = true;
  if (!RequireObjectType(ctx, manual, path)) {
    return false;
  }
  char buffer[192];
  const JsonValue* energy = RequireMember(ctx, manual, "energyKcal", SubKey(buffer, sizeof(buffer), path, "energyKcal"));
  if (energy == nullptr || !ReadInt(ctx, energy, SubKey(buffer, sizeof(buffer), path, "energyKcal"), 0, 100000, &out->energyKcal)) {
    return false;
  }
  const JsonValue* protein = RequireMember(ctx, manual, "proteinDg", SubKey(buffer, sizeof(buffer), path, "proteinDg"));
  if (protein == nullptr) {
    return false;
  }
  if (!ReadOptionalInt(ctx, protein, SubKey(buffer, sizeof(buffer), path, "proteinDg"), 0, 100000, &out->hasProtein, &out->proteinDg)) {
    return false;
  }
  const JsonValue* fat = RequireMember(ctx, manual, "fatDg", SubKey(buffer, sizeof(buffer), path, "fatDg"));
  if (fat == nullptr) {
    return false;
  }
  if (!ReadOptionalInt(ctx, fat, SubKey(buffer, sizeof(buffer), path, "fatDg"), 0, 100000, &out->hasFat, &out->fatDg)) {
    return false;
  }
  const JsonValue* carb = RequireMember(ctx, manual, "carbDg", SubKey(buffer, sizeof(buffer), path, "carbDg"));
  if (carb == nullptr) {
    return false;
  }
  if (!ReadOptionalInt(ctx, carb, SubKey(buffer, sizeof(buffer), path, "carbDg"), 0, 100000, &out->hasCarb, &out->carbDg)) {
    return false;
  }
  const JsonValue* sourceType = RequireMember(ctx, manual, "sourceType", SubKey(buffer, sizeof(buffer), path, "sourceType"));
  if (sourceType == nullptr) {
    return false;
  }
  const char* allowedSources[] = {"professional", "userEntered", nullptr};
  if (!ReadEnum(ctx, sourceType, SubKey(buffer, sizeof(buffer), path, "sourceType"), allowedSources, &out->sourceType)) {
    return false;
  }
  const JsonValue* sourceNote = JsonFind(manual, "sourceNote");
  out->hasSourceNote = sourceNote != nullptr && sourceNote->kind == JsonKind::String;
  if (out->hasSourceNote) {
    out->sourceNote = sourceNote->text;
  } else if (sourceNote != nullptr && sourceNote->kind != JsonKind::Null) {
    return ctx.Fail("INVALID_INPUT", SubKey(buffer, sizeof(buffer), path, "sourceNote"), "sourceNote 必须是字符串或 null");
  }
  const JsonValue* derived = JsonFind(manual, "derivedFields");
  if (derived != nullptr) {
    if (!RequireArrayType(ctx, derived, SubKey(buffer, sizeof(buffer), path, "derivedFields"))) {
      return false;
    }
    out->derivedFieldCount = static_cast<i64>(derived->count);
  } else {
    out->derivedFieldCount = 0;
  }
  return true;
}

// 解析画像：年龄 0..120 岁、身高 1000..2500mm、体重 25000..250000g 均为临床合理区间；
// goal=manual 时必须携带 manualTargets 对象。
bool ParseProfile(ExecContext& ctx, const JsonValue* profile, ProfileInput* out) {
  const char* path = "$.profile";
  if (!RequireObjectType(ctx, profile, path)) {
    return false;
  }
  char buffer[192];
  const JsonValue* profileId = RequireMember(ctx, profile, "profileId", SubKey(buffer, sizeof(buffer), path, "profileId"));
  if (profileId == nullptr || !ValidateStableId(ctx, profileId, SubKey(buffer, sizeof(buffer), path, "profileId"))) {
    return false;
  }
  const JsonValue* revision = RequireMember(ctx, profile, "revision", SubKey(buffer, sizeof(buffer), path, "revision"));
  if (revision == nullptr) {
    return false;
  }
  i64 revisionValue = 0;
  if (!ReadInt(ctx, revision, SubKey(buffer, sizeof(buffer), path, "revision"), 1, 1000000000, &revisionValue)) {
    return false;
  }

  const JsonValue* sex = RequireMember(ctx, profile, "sex", SubKey(buffer, sizeof(buffer), path, "sex"));
  if (sex == nullptr) {
    return false;
  }
  const char* allowedSexes[] = {"male", "female", nullptr};
  if (!ReadEnum(ctx, sex, SubKey(buffer, sizeof(buffer), path, "sex"), allowedSexes, &out->sex)) {
    return false;
  }

  const JsonValue* age = RequireMember(ctx, profile, "ageYears", SubKey(buffer, sizeof(buffer), path, "ageYears"));
  if (age == nullptr || !ReadInt(ctx, age, SubKey(buffer, sizeof(buffer), path, "ageYears"), 0, 120, &out->ageYears)) {
    return false;
  }
  const JsonValue* height = RequireMember(ctx, profile, "heightMm", SubKey(buffer, sizeof(buffer), path, "heightMm"));
  if (height == nullptr || !ReadInt(ctx, height, SubKey(buffer, sizeof(buffer), path, "heightMm"), 1000, 2500, &out->heightMm)) {
    return false;
  }
  const JsonValue* weight = RequireMember(ctx, profile, "weightGrams", SubKey(buffer, sizeof(buffer), path, "weightGrams"));
  if (weight == nullptr || !ReadInt(ctx, weight, SubKey(buffer, sizeof(buffer), path, "weightGrams"), 25000, 250000, &out->weightGrams)) {
    return false;
  }

  const JsonValue* bodyFat = JsonFind(profile, "bodyFatPermille");
  if (bodyFat != nullptr && bodyFat->kind != JsonKind::Null) {
    i64 bodyFatValue = 0;
    if (!ReadInt(ctx, bodyFat, SubKey(buffer, sizeof(buffer), path, "bodyFatPermille"), 0, 1000, &bodyFatValue)) {
      return false;
    }
  }

  const JsonValue* activity = RequireMember(ctx, profile, "activityLevel", SubKey(buffer, sizeof(buffer), path, "activityLevel"));
  if (activity == nullptr) {
    return false;
  }
  const char* allowedActivities[] = {"sedentary", "light", "moderate", "active", "veryActive", nullptr};
  if (!ReadEnum(ctx, activity, SubKey(buffer, sizeof(buffer), path, "activityLevel"), allowedActivities, &out->activityLevel)) {
    return false;
  }

  const JsonValue* goal = RequireMember(ctx, profile, "goal", SubKey(buffer, sizeof(buffer), path, "goal"));
  if (!RequireObjectType(ctx, goal, SubKey(buffer, sizeof(buffer), path, "goal"))) {
    return false;
  }
  char goalPath[192];
  SubKey(goalPath, sizeof(goalPath), path, "goal");
  const JsonValue* goalType = RequireMember(ctx, goal, "type", SubKey(buffer, sizeof(buffer), goalPath, "type"));
  if (goalType == nullptr) {
    return false;
  }
  const char* allowedGoals[] = {"maintain", "fatLoss", "manual", nullptr};
  if (!ReadEnum(ctx, goalType, SubKey(buffer, sizeof(buffer), goalPath, "type"), allowedGoals, &out->goalType)) {
    return false;
  }
  out->manual.present = false;
  if (out->goalType.Equals("manual")) {
    const JsonValue* manualTargets = RequireMember(ctx, goal, "manualTargets", SubKey(buffer, sizeof(buffer), goalPath, "manualTargets"));
    if (manualTargets == nullptr) {
      return false;
    }
    if (!ParseManualTargets(ctx, manualTargets, SubKey(buffer, sizeof(buffer), goalPath, "manualTargets"), &out->manual)) {
      return false;
    }
  }

  const JsonValue* training = JsonFind(profile, "trainingPreference");
  out->trainingPreference = false;
  if (training != nullptr && training->kind != JsonKind::Null) {
    if (!ReadBool(ctx, training, SubKey(buffer, sizeof(buffer), path, "trainingPreference"), &out->trainingPreference)) {
      return false;
    }
  }

  const JsonValue* flags = RequireMember(ctx, profile, "dietaryFlags", SubKey(buffer, sizeof(buffer), path, "dietaryFlags"));
  if (!RequireObjectType(ctx, flags, SubKey(buffer, sizeof(buffer), path, "dietaryFlags"))) {
    return false;
  }
  char flagPath[192];
  SubKey(flagPath, sizeof(flagPath), path, "dietaryFlags");
  const JsonValue* pregnancy = RequireMember(ctx, flags, "pregnancyOrLactation", SubKey(buffer, sizeof(buffer), flagPath, "pregnancyOrLactation"));
  if (pregnancy == nullptr || !ReadBool(ctx, pregnancy, SubKey(buffer, sizeof(buffer), flagPath, "pregnancyOrLactation"), &out->pregnancyOrLactation)) {
    return false;
  }
  const JsonValue* medical = RequireMember(ctx, flags, "medicalDietManagement", SubKey(buffer, sizeof(buffer), flagPath, "medicalDietManagement"));
  if (medical == nullptr || !ReadBool(ctx, medical, SubKey(buffer, sizeof(buffer), flagPath, "medicalDietManagement"), &out->medicalDietManagement)) {
    return false;
  }

  const JsonValue* tastes = RequireMember(ctx, profile, "tastes", SubKey(buffer, sizeof(buffer), path, "tastes"));
  if (tastes == nullptr || !RequireArrayType(ctx, tastes, SubKey(buffer, sizeof(buffer), path, "tastes"))) {
    return false;
  }
  return true;
}

// ---------------------------------------------------------------------------
// 计算
// ---------------------------------------------------------------------------
// 活动系数（permille）查表；级别已在入口做枚举校验，default 分支只承接 veryActive。
i64 ActivityPermille(const NutritionConfig& config, Str level) {
  const NutritionParameters& p = config.parameters;
  if (level.Equals("sedentary")) {
    return p.activityPermilleSedentary;
  }
  if (level.Equals("light")) {
    return p.activityPermilleLight;
  }
  if (level.Equals("moderate")) {
    return p.activityPermilleModerate;
  }
  if (level.Equals("active")) {
    return p.activityPermilleActive;
  }
  return p.activityPermilleVeryActive;
}

// 能量链中间量：REE/TDEE/缺口以 mkcal（千分之一 kcal）定点计算，仅最终目标舍入为整数 kcal。
struct EnergyChain {
  i64 reeMkcal;
  i64 tdeeMkcal;
  i64 deficitMkcal;
  i64 targetEnergyKcal;
  i64 activityFactorPermille;
};

// Mifflin-St-Jeor 全整数实现：
//   REE(mkcal) = 10×体重g + 6.25×身高mm - 5×年龄 + 性别项（男 +5000，女 -161000）；
//   TDEE = REE × 活动系数(permille) 四舍五入；减脂缺口 = min(TDEE×缺口‰, 缺口上限)。
// 中间量保持 mkcal 定点避免浮点误差，最终目标 kcal 只舍入一次。
EnergyChain ComputeEnergyChain(const ProfileInput& profile, const NutritionConfig& config) {
  const NutritionParameters& p = config.parameters;
  const i64 sexTerm = profile.sex.Equals("male") ? 5000 : -161000;
  EnergyChain chain;
  chain.reeMkcal = 10 * profile.weightGrams + 625 * profile.heightMm - 5000 * profile.ageYears + sexTerm;
  chain.activityFactorPermille = ActivityPermille(config, profile.activityLevel);
  chain.tdeeMkcal = RoundHalfUp(chain.reeMkcal * chain.activityFactorPermille, 1000);
  if (profile.goalType.Equals("fatLoss")) {
    const i64 raw = RoundHalfUp(chain.tdeeMkcal * p.fatLossDeficitPermille, 1000);
    const i64 cap = p.fatLossDeficitCapKcal * 1000;
    chain.deficitMkcal = raw < cap ? raw : cap;
  } else {
    chain.deficitMkcal = 0;
  }
  chain.targetEnergyKcal = RoundHalfUp(chain.tdeeMkcal - chain.deficitMkcal, 1000);
  return chain;
}

// 由目标能量推宏量：蛋白 = mg/kg × 体重g（舍入到 dg）；脂肪按供能占比 → kcal → dg（9 kcal/g）；
// 碳水取剩余能量按 4 kcal/g 折算，剩余不足时记 0（由构成判定拦截，不静默凑数）。
MacroTargets ComputeMacrosFromEnergy(const ProfileInput& profile, const NutritionConfig& config,
                                     i64 energyKcal) {
  const NutritionParameters& p = config.parameters;
  const i64 proteinMgPerKg = profile.trainingPreference ? p.proteinMgPerKgTraining : p.proteinMgPerKgNormal;
  MacroTargets macros;
  macros.energyKcal = energyKcal;
  macros.proteinDg = RoundHalfUp(proteinMgPerKg * profile.weightGrams, 100000);
  const i64 fatKcal = RoundHalfUp(energyKcal * p.fatEnergyPermille, 1000);
  macros.fatDg = RoundHalfUp(fatKcal * 10, 9);
  const i64 proteinKcal = RoundHalfUp(macros.proteinDg * 4, 10);
  const i64 carbKcal = energyKcal - proteinKcal - fatKcal;
  macros.carbDg = carbKcal > 0 ? RoundHalfUp(carbKcal * 10, 4) : 0;
  return macros;
}

// 手动目标直接采用声明值；未提供的宏量记 0（缺失语义由 has* 表达，构成判定会拦截）。
MacroTargets ComputeManualMacros(const ManualTargetInput& manual) {
  MacroTargets macros;
  macros.energyKcal = manual.energyKcal;
  macros.proteinDg = manual.hasProtein ? manual.proteinDg : 0;
  macros.fatDg = manual.hasFat ? manual.fatDg : 0;
  macros.carbDg = manual.hasCarb ? manual.carbDg : 0;
  return macros;
}

// 宏量构成判定：按 4/9/4 kcal/g 折算十分之一 kcal 后与区间 bp 交叉相乘比较，
// 不先舍入再比较，避免边界误差；总能量为 0 直接不通过；碳水下限按 g→dg（×10）判定。
CompositionResult ComputeComposition(const MacroTargets& macros, const MacroBand& band, bool isAge18) {
  CompositionResult result;
  result.band = band;
  result.carbDg = macros.carbDg;
  const i64 proteinTenths = 4 * macros.proteinDg;
  const i64 fatTenths = 9 * macros.fatDg;
  const i64 carbTenths = 4 * macros.carbDg;
  const i64 totalTenths = proteinTenths + fatTenths + carbTenths;
  if (totalTenths > 0) {
    result.proteinBp = RoundHalfUp(proteinTenths * 10000, totalTenths);
    result.fatBp = RoundHalfUp(fatTenths * 10000, totalTenths);
    result.carbBp = RoundHalfUp(carbTenths * 10000, totalTenths);
  } else {
    result.proteinBp = 0;
    result.fatBp = 0;
    result.carbBp = 0;
  }
  bool passed = totalTenths > 0;
  if (totalTenths > 0) {
    if (proteinTenths * 10000 < totalTenths * band.proteinMinBp ||
        proteinTenths * 10000 > totalTenths * band.proteinMaxBp) {
      passed = false;
    }
    if (fatTenths * 10000 < totalTenths * band.fatMinBp ||
        fatTenths * 10000 > totalTenths * band.fatMaxBp) {
      passed = false;
    }
    if (carbTenths * 10000 < totalTenths * band.carbMinBp ||
        carbTenths * 10000 > totalTenths * band.carbMaxBp) {
      passed = false;
    }
  }
  result.hasCarbFloor = band.hasCarbFloor;
  result.carbFloorDg = band.hasCarbFloor ? band.carbFloorGPerDay * 10 : 0;
  if (band.hasCarbFloor && macros.carbDg < band.carbFloorGPerDay * 10) {
    passed = false;
  }
  result.passed = passed;
  (void)isAge18;
  return result;
}

// 手动目标一致性核查：三大宏量齐全时计算 声明能量与宏量推算能量的差（0.1 kcal 精度），
// 容差 = max(声明能量 2%, 200 tenths)；超差只标记 MANUAL_TARGET_INCONSISTENT，不改数值。
ManualReport BuildManualReport(const ManualTargetInput& manual) {
  ManualReport report;
  report.sourceType = manual.sourceType;
  report.sourceNote = manual.sourceNote;
  report.hasSourceNote = manual.hasSourceNote;
  report.declaredEnergyKcal = manual.energyKcal;
  report.hasProtein = manual.hasProtein;
  report.declaredProteinDg = manual.proteinDg;
  report.hasFat = manual.hasFat;
  report.declaredFatDg = manual.fatDg;
  report.hasCarb = manual.hasCarb;
  report.declaredCarbDg = manual.carbDg;
  report.hasDifference = false;
  report.energyDiffTenthsKcal = 0;
  report.toleranceTenthsKcal = 0;
  report.withinTolerance = false;
  report.applied = false;
  report.hasReason = false;
  if (manual.hasProtein && manual.hasFat && manual.hasCarb) {
    const i64 macroTenths =
        4 * manual.proteinDg + 9 * manual.fatDg + 4 * manual.carbDg;
    const i64 declaredTenths = manual.energyKcal * 10;
    report.hasDifference = true;
    report.energyDiffTenthsKcal = macroTenths - declaredTenths;
    const i64 twoPercent = (declaredTenths * 2) / 100;
    report.toleranceTenthsKcal = twoPercent > 200 ? twoPercent : 200;
    const i64 difference = report.energyDiffTenthsKcal < 0 ? -report.energyDiffTenthsKcal
                                                         : report.energyDiffTenthsKcal;
    report.withinTolerance = difference <= report.toleranceTenthsKcal;
  }
  return report;
}

void SetReasons(TargetOutcome* outcome, const char* first) {
  outcome->reasons.Clear();
  outcome->reasons.Push(Str(first));
}

void AddReason(TargetOutcome* outcome, const char* reason) { outcome->reasons.Push(Str(reason)); }

void AddWarning(TargetOutcome* outcome, const char* warning) { outcome->warnings.Push(Str(warning)); }

// 手动目标问题的 reason 需要与状态码区分（契约里 reason 是更具体的展示码）
const char* ManualReasonForStatus(Str status) {
  if (status.Equals("MANUAL_TARGET_INCONSISTENT")) {
    return "ENERGY_MACRO_MISMATCH";
  }
  if (status.Equals("TARGET_REVIEW_REQUIRED")) {
    return "PRODUCT_ENERGY_FLOOR";
  }
  if (status.Equals("TARGET_COMPOSITION_CONFLICT")) {
    return "MACRO_COMPOSITION";
  }
  if (status.Equals("MANUAL_TARGET_INCOMPLETE")) {
    return "MANUAL_TARGET_INCOMPLETE";
  }
  return "AUTO_TARGET_DISABLED";
}

// 手动报告收尾：仅当整体 Ok 时 applied=true；失败时把状态码映射为更具体的 reason 展示码
// （过轻+manual 固定 MANUAL_STORAGE_ONLY）。
void FinalizeManual(TargetOutcome* outcome) {
  if (!outcome->hasManual) {
    return;
  }
  const bool ok = outcome->status.Equals("Ok");
  outcome->manual.applied = ok;
  if (ok) {
    outcome->manual.hasReason = false;
    return;
  }
  outcome->manual.hasReason = true;
  if (outcome->hasManual && outcome->status.Equals("AUTO_TARGET_DISABLED") &&
      outcome->manual.reason.Equals("MANUAL_STORAGE_ONLY")) {
    return;  // 过轻+manual：reason 固定为 MANUAL_STORAGE_ONLY
  }
  outcome->manual.reason = Str(ManualReasonForStatus(outcome->status));
}

// 目标计算主流程（契约 §8 状态机，顺序即优先级）：人群排除 → 未舍入 BMI 过轻 →
// 能量下限 → 手动完整性/一致性 → 宏量构成 → Ok。reasons/warnings 按触发顺序累积，
// 18 岁外推警告恒在最前；未舍入 BMI 判定（交叉乘法）与 0.1 精度展示值分开输出。
void ComputeOutcome(const ProfileInput& profile, const NutritionConfig& config,
                    TargetOutcome* outcome) {
  // 年龄带与外推提示：先确定，保证 AGE_18_EXTRAPOLATION 排在 warnings 首位
  if (profile.ageYears == 18) {
    outcome->ageBand = Str("18");
    outcome->age18Extrapolation = true;
    AddWarning(outcome, "AGE_18_EXTRAPOLATION");
  } else if (profile.ageYears >= 19 && profile.ageYears <= 78) {
    outcome->ageBand = Str("19-78");
  } else {
    outcome->ageBand = Str("out-of-range");
  }

  // 1. 适用人群 / 风险状态
  const bool ageOutOfRange = profile.ageYears < config.ageMinYears || profile.ageYears > config.ageMaxYears;
  if (ageOutOfRange) {
    AddReason(outcome, "AGE_OUT_OF_RANGE");
  }
  if (profile.pregnancyOrLactation) {
    AddReason(outcome, "PREGNANCY_OR_LACTATION");
  }
  if (profile.medicalDietManagement) {
    AddReason(outcome, "MEDICAL_DIET_MANAGEMENT");
  }
  const bool populationExcluded = ageOutOfRange || profile.pregnancyOrLactation ||
                                 profile.medicalDietManagement;

  // 未舍入 BMI 判定与展示值：所有分支都要填（人群排除分支也要能展示）
  const i64 lhs = profile.weightGrams * 10000;
  const i64 rhs = 185 * profile.heightMm * profile.heightMm;
  outcome->underweightByUnrounded = lhs < rhs;
  outcome->bmiDisplayTenths = RoundHalfUp(lhs, profile.heightMm * profile.heightMm);

  if (populationExcluded) {
    outcome->status = Str("AUTO_TARGET_DISABLED");
    outcome->eligible = false;
    if (profile.manual.present) {
      outcome->hasManual = true;
      outcome->manual = BuildManualReport(profile.manual);
      outcome->manual.hasReason = true;
      outcome->manual.reason = Str("AUTO_TARGET_DISABLED");
      AddWarning(outcome, "AUTO_TARGET_DISABLED");
    }
    return;
  }

  // 2. 过轻（未舍入交叉相乘）
  if (outcome->underweightByUnrounded) {
    if (profile.goalType.Equals("maintain")) {
      const EnergyChain chain = ComputeEnergyChain(profile, config);
      outcome->status = Str("REFERENCE_ONLY");
      outcome->eligible = false;
      AddReason(outcome, "UNDERWEIGHT");
      outcome->hasReference = true;
      outcome->referenceReeMkcal = chain.reeMkcal;
      outcome->referenceTdeeMkcal = chain.tdeeMkcal;
      return;
    }
    outcome->status = Str("AUTO_TARGET_DISABLED");
    outcome->eligible = false;
    if (profile.goalType.Equals("manual")) {
      AddReason(outcome, "UNDERWEIGHT");
      AddReason(outcome, "MANUAL_STORAGE_ONLY");
      outcome->hasManual = true;
      outcome->manual = BuildManualReport(profile.manual);
      outcome->manual.hasReason = true;
      outcome->manual.reason = Str("MANUAL_STORAGE_ONLY");
      AddWarning(outcome, "AUTO_TARGET_DISABLED");
    } else {
      AddReason(outcome, "UNDERWEIGHT");
    }
    return;
  }

  // 3. 能量下限与手动目标预检
  const bool manualGoal = profile.goalType.Equals("manual");
  EnergyChain chain;
  chain.reeMkcal = 0;
  chain.tdeeMkcal = 0;
  chain.deficitMkcal = 0;
  chain.targetEnergyKcal = 0;
  chain.activityFactorPermille = 0;
  if (!manualGoal) {
    chain = ComputeEnergyChain(profile, config);
  }

  const i64 floor = profile.sex.Equals("male") ? config.energyFloorMale : config.energyFloorFemale;
  const i64 effectiveEnergy = manualGoal ? profile.manual.energyKcal : chain.targetEnergyKcal;

  if (manualGoal) {
    outcome->hasManual = true;
    outcome->manual = BuildManualReport(profile.manual);
  }

  if (effectiveEnergy < floor) {
    outcome->status = Str("TARGET_REVIEW_REQUIRED");
    AddReason(outcome, "PRODUCT_ENERGY_FLOOR");
    AddWarning(outcome, "PRODUCT_ENERGY_FLOOR");
  }

  // 4. 手动完整性 / 一致性
  if (manualGoal) {
    const bool complete = profile.manual.hasProtein && profile.manual.hasFat && profile.manual.hasCarb;
    if (!complete) {
      if (!outcome->status.Equals("TARGET_REVIEW_REQUIRED")) {
        outcome->status = Str("MANUAL_TARGET_INCOMPLETE");
        SetReasons(outcome, "MANUAL_TARGET_INCOMPLETE");
        AddWarning(outcome, "MANUAL_TARGET_INCOMPLETE");
      }
      outcome->hasManual = true;
      outcome->manual = BuildManualReport(profile.manual);
      FinalizeManual(outcome);
      return;
    }
    if (outcome->status.Empty() && !outcome->manual.withinTolerance) {
      outcome->status = Str("MANUAL_TARGET_INCONSISTENT");
      AddReason(outcome, "ENERGY_MACRO_MISMATCH");
      AddWarning(outcome, "ENERGY_MACRO_MISMATCH");
    }
  }

  // 5. 宏量构成（仅在实际算出宏量时判定）
  const MacroTargets macros = manualGoal ? ComputeManualMacros(profile.manual)
                                         : ComputeMacrosFromEnergy(profile, config, chain.targetEnergyKcal);
  const bool isAge18 = profile.ageYears == 18;
  const CompositionResult composition =
      ComputeComposition(macros, isAge18 ? config.age18 : config.adult, isAge18);
  outcome->hasComposition = true;
  outcome->composition = composition;

  if (outcome->status.Empty()) {
    if (!composition.passed) {
      outcome->status = Str("TARGET_COMPOSITION_CONFLICT");
      AddReason(outcome, "MACRO_COMPOSITION");
      AddWarning(outcome, "MACRO_COMPOSITION");
    } else {
      outcome->status = Str("Ok");
    }
  }

  if (outcome->status.Equals("Ok")) {
    outcome->hasTargets = true;
    outcome->daily = macros;
    outcome->sourceGoal = profile.goalType;
    const NutritionParameters& p = config.parameters;
    // 三餐拆分：各餐目标 = 全天目标 × 餐次占比(permille) 各自四舍五入；三餐合计与全天值
    // 存在 ±1 kcal/dg 的舍入差属既定口径，规划器按各餐独立目标评估。
    outcome->mealBreakfast = MacroTargets{RoundHalfUp(macros.energyKcal * p.sharePermilleBreakfast, 1000),
                                         RoundHalfUp(macros.proteinDg * p.sharePermilleBreakfast, 1000),
                                         RoundHalfUp(macros.fatDg * p.sharePermilleBreakfast, 1000),
                                         RoundHalfUp(macros.carbDg * p.sharePermilleBreakfast, 1000)};
    outcome->mealLunch = MacroTargets{RoundHalfUp(macros.energyKcal * p.sharePermilleLunch, 1000),
                                     RoundHalfUp(macros.proteinDg * p.sharePermilleLunch, 1000),
                                     RoundHalfUp(macros.fatDg * p.sharePermilleLunch, 1000),
                                     RoundHalfUp(macros.carbDg * p.sharePermilleLunch, 1000)};
    outcome->mealDinner = MacroTargets{RoundHalfUp(macros.energyKcal * p.sharePermilleDinner, 1000),
                                      RoundHalfUp(macros.proteinDg * p.sharePermilleDinner, 1000),
                                      RoundHalfUp(macros.fatDg * p.sharePermilleDinner, 1000),
                                      RoundHalfUp(macros.carbDg * p.sharePermilleDinner, 1000)};
  } else {
    outcome->hasComputed = true;
    outcome->computed = macros;
  }

  FinalizeManual(outcome);
}

// ---------------------------------------------------------------------------
// 输出
// ---------------------------------------------------------------------------
// 宏量对象序列化：energyKcal 单位 kcal，其余三项单位 dg（0.1 g）；字段顺序为契约固定顺序。
void WriteMacros(JsonOut& out, const MacroTargets& macros) {
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

void WriteBand(JsonOut& out, const MacroBand& band) {
  out.BeginObject();
  out.WriteKey("protein");
  out.BeginArray();
  out.WriteNumber(band.proteinMinBp);
  out.WriteNumber(band.proteinMaxBp);
  out.EndArray();
  out.WriteKey("fat");
  out.BeginArray();
  out.WriteNumber(band.fatMinBp);
  out.WriteNumber(band.fatMaxBp);
  out.EndArray();
  out.WriteKey("carb");
  out.BeginArray();
  out.WriteNumber(band.carbMinBp);
  out.WriteNumber(band.carbMaxBp);
  out.EndArray();
  out.EndObject();
}

// 结果序列化：manualGoal 时公式推导链（formula/ree/tdee/deficit/activity）输出 null
// （未使用公式，不冒充估算值）；computed 仅在未过构成判定时输出且 validForAutoPlanning=false；
// bmiDisplayTenths 为 0.1 精度展示值，过轻判定另用未舍入交叉乘法（二者允许不同）。
void WriteOutcome(JsonOut& out, const TargetOutcome& outcome, const ProfileInput& profile,
                  const NutritionConfig& config, const EnergyChain& chain, bool manualGoal) {
  out.BeginObject();

  out.WriteKey("status");
  out.WriteString(outcome.status);

  out.WriteKey("applicability");
  out.BeginObject();
  out.WriteKey("eligible");
  out.WriteBool(outcome.eligible);
  out.WriteKey("reasons");
  out.BeginArray();
  for (usize i = 0; i < outcome.reasons.Size(); ++i) {
    out.WriteString(outcome.reasons[i]);
  }
  out.EndArray();
  out.WriteKey("ageBand");
  out.WriteString(outcome.ageBand);
  out.WriteKey("age18Extrapolation");
  out.WriteBool(outcome.age18Extrapolation);
  out.WriteKey("bmiDisplayTenths");
  out.WriteNumber(outcome.bmiDisplayTenths);
  out.WriteKey("underweightByUnrounded");
  out.WriteBool(outcome.underweightByUnrounded);
  out.EndObject();

  out.WriteKey("targets");
  if (outcome.hasTargets) {
    out.BeginObject();
    out.WriteKey("daily");
    WriteMacros(out, outcome.daily);
    out.WriteKey("mealReference");
    out.BeginObject();
    out.WriteKey("breakfast");
    WriteMacros(out, outcome.mealBreakfast);
    out.WriteKey("lunch");
    WriteMacros(out, outcome.mealLunch);
    out.WriteKey("dinner");
    WriteMacros(out, outcome.mealDinner);
    out.EndObject();
    out.WriteKey("source");
    out.BeginObject();
    if (manualGoal) {
      out.WriteKey("formula");
      out.WriteNull();
      out.WriteKey("formulaLabel");
      out.WriteNull();
      out.WriteKey("reeMkcal");
      out.WriteNull();
      out.WriteKey("tdeeMkcal");
      out.WriteNull();
      out.WriteKey("deficitMkcal");
      out.WriteNull();
      out.WriteKey("activityFactorPermille");
      out.WriteNull();
      out.WriteKey("goal");
      out.WriteString(Str("manual"));
      out.WriteKey("manualSourceType");
      out.WriteString(profile.manual.sourceType);
    } else {
      out.WriteKey("formula");
      out.WriteString(config.formula);
      out.WriteKey("formulaLabel");
      out.WriteString(Str("估算静息能量消耗（REE）"));
      out.WriteKey("reeMkcal");
      out.WriteNumber(chain.reeMkcal);
      out.WriteKey("tdeeMkcal");
      out.WriteNumber(chain.tdeeMkcal);
      out.WriteKey("deficitMkcal");
      out.WriteNumber(chain.deficitMkcal);
      out.WriteKey("activityFactorPermille");
      out.WriteNumber(chain.activityFactorPermille);
      out.WriteKey("goal");
      out.WriteString(profile.goalType);
    }
    out.EndObject();
    out.EndObject();
  } else {
    out.WriteNull();
  }

  out.WriteKey("reference");
  if (outcome.hasReference) {
    out.BeginObject();
    out.WriteKey("reeMkcal");
    out.WriteNumber(outcome.referenceReeMkcal);
    out.WriteKey("tdeeMkcal");
    out.WriteNumber(outcome.referenceTdeeMkcal);
    out.WriteKey("deficitMkcal");
    out.WriteNumber(static_cast<i64>(0));
    out.EndObject();
  } else {
    out.WriteNull();
  }

  out.WriteKey("computed");
  if (outcome.hasComputed) {
    out.BeginObject();
    out.WriteKey("energyKcal");
    out.WriteNumber(outcome.computed.energyKcal);
    out.WriteKey("proteinDg");
    out.WriteNumber(outcome.computed.proteinDg);
    out.WriteKey("fatDg");
    out.WriteNumber(outcome.computed.fatDg);
    out.WriteKey("carbDg");
    out.WriteNumber(outcome.computed.carbDg);
    out.WriteKey("validForAutoPlanning");
    out.WriteBool(false);
    out.EndObject();
  } else {
    out.WriteNull();
  }

  out.WriteKey("composition");
  if (outcome.hasComposition) {
    const CompositionResult& composition = outcome.composition;
    out.BeginObject();
    out.WriteKey("ageBand");
    out.WriteString(outcome.ageBand);
    out.WriteKey("actualBp");
    out.BeginObject();
    out.WriteKey("protein");
    out.WriteNumber(composition.proteinBp);
    out.WriteKey("fat");
    out.WriteNumber(composition.fatBp);
    out.WriteKey("carb");
    out.WriteNumber(composition.carbBp);
    out.EndObject();
    out.WriteKey("carbDg");
    out.WriteNumber(composition.carbDg);
    out.WriteKey("rangesBp");
    WriteBand(out, composition.band);
    out.WriteKey("carbFloorDg");
    if (composition.hasCarbFloor) {
      out.WriteNumber(composition.carbFloorDg);
    } else {
      out.WriteNull();
    }
    out.WriteKey("passed");
    out.WriteBool(composition.passed);
    out.EndObject();
  } else {
    out.WriteNull();
  }

  out.WriteKey("manualTarget");
  if (outcome.hasManual) {
    const ManualReport& manual = outcome.manual;
    out.BeginObject();
    out.WriteKey("sourceType");
    out.WriteString(manual.sourceType);
    out.WriteKey("sourceNote");
    if (manual.hasSourceNote) {
      out.WriteString(manual.sourceNote);
    } else {
      out.WriteNull();
    }
    out.WriteKey("declared");
    out.BeginObject();
    out.WriteKey("energyKcal");
    out.WriteNumber(manual.declaredEnergyKcal);
    out.WriteKey("proteinDg");
    if (manual.hasProtein) {
      out.WriteNumber(manual.declaredProteinDg);
    } else {
      out.WriteNull();
    }
    out.WriteKey("fatDg");
    if (manual.hasFat) {
      out.WriteNumber(manual.declaredFatDg);
    } else {
      out.WriteNull();
    }
    out.WriteKey("carbDg");
    if (manual.hasCarb) {
      out.WriteNumber(manual.declaredCarbDg);
    } else {
      out.WriteNull();
    }
    out.EndObject();
    out.WriteKey("stored");
    out.WriteBool(true);
    out.WriteKey("applied");
    out.WriteBool(manual.applied);
    out.WriteKey("reason");
    if (manual.hasReason) {
      out.WriteString(manual.reason);
    } else {
      out.WriteNull();
    }
    out.WriteKey("energyDiffTenthsKcal");
    if (manual.hasDifference) {
      out.WriteNumber(manual.energyDiffTenthsKcal);
    } else {
      out.WriteNull();
    }
    out.WriteKey("toleranceTenthsKcal");
    if (manual.hasDifference) {
      out.WriteNumber(manual.toleranceTenthsKcal);
    } else {
      out.WriteNull();
    }
    out.WriteKey("withinTolerance");
    if (manual.hasDifference) {
      out.WriteBool(manual.withinTolerance);
    } else {
      out.WriteNull();
    }
    out.WriteKey("derivedFields");
    out.BeginArray();
    out.EndArray();
    out.EndObject();
  } else {
    out.WriteNull();
  }

  out.WriteKey("warnings");
  out.BeginArray();
  for (usize i = 0; i < outcome.warnings.Size(); ++i) {
    out.WriteString(outcome.warnings[i]);
  }
  out.EndArray();

  out.EndObject();
}

// nutrition-target 命令实现：解析 profile+nutritionConfig → 状态机计算 → 规范化序列化。
// 与 ComputeTargetForPlanning 共用解析与计算，保证独立命令与规划内嵌目标完全同源。
bool WriteNutritionTargetResult(ExecContext& ctx, const JsonValue* request, TextBuffer* out) {
  JsonValue* root = const_cast<JsonValue*>(request);
  const JsonValue* profileValue = RequireMember(ctx, root, "profile", "$.profile");
  if (profileValue == nullptr) {
    return false;
  }
  const JsonValue* configValue = RequireMember(ctx, root, "nutritionConfig", "$.nutritionConfig");
  if (configValue == nullptr) {
    return false;
  }

  NutritionConfig config;
  if (!ParseConfig(ctx, configValue, &config)) {
    return false;
  }
  ProfileInput profile;
  if (!ParseProfile(ctx, profileValue, &profile)) {
    return false;
  }

  TargetOutcome outcome;
  outcome.reasons.Init(&ctx.Memory());
  outcome.warnings.Init(&ctx.Memory());
  outcome.eligible = true;
  outcome.age18Extrapolation = false;
  outcome.bmiDisplayTenths = 0;
  outcome.underweightByUnrounded = false;
  outcome.hasTargets = false;
  outcome.hasReference = false;
  outcome.hasComputed = false;
  outcome.hasComposition = false;
  outcome.hasManual = false;

  ComputeOutcome(profile, config, &outcome);
  if (ctx.Failed()) {
    return false;
  }

  const bool manualGoal = profile.goalType.Equals("manual");
  EnergyChain chain;
  chain.reeMkcal = 0;
  chain.tdeeMkcal = 0;
  chain.deficitMkcal = 0;
  chain.targetEnergyKcal = 0;
  chain.activityFactorPermille = 0;
  if (!manualGoal && !outcome.hasReference) {
    chain = ComputeEnergyChain(profile, config);
  }

  JsonOut writer(out);
  WriteOutcome(writer, outcome, profile, config, chain, manualGoal);
  return writer.Ok();
}

}  // namespace

// 规划内嵌目标计算：复用同一状态机，把 Ok 结果（全天+三餐）装入 PlanTargetSnapshot；
// 不可用时置 usableForAutoPlanning=false 并保留 reasons/status，由 plan 命令如实呈现。
bool ComputeTargetForPlanning(ExecContext& ctx, const JsonValue* request,
                              PlanTargetSnapshot* snapshot) {
  snapshot->reasons.Init(&ctx.Memory());
  snapshot->usableForAutoPlanning = false;
  snapshot->daily = MacroTargets{0, 0, 0, 0};
  snapshot->mealBreakfast = MacroTargets{0, 0, 0, 0};
  snapshot->mealLunch = MacroTargets{0, 0, 0, 0};
  snapshot->mealDinner = MacroTargets{0, 0, 0, 0};
  snapshot->nutritionConfigHash[0] = '\0';

  const JsonValue* profileValue = RequireMember(ctx, request, "profile", "$.profile");
  if (profileValue == nullptr) {
    return false;
  }
  const JsonValue* configValue = RequireMember(ctx, request, "nutritionConfig", "$.nutritionConfig");
  if (configValue == nullptr) {
    return false;
  }
  NutritionConfig config;
  if (!ParseConfig(ctx, configValue, &config)) {
    return false;
  }
  ProfileInput profile;
  if (!ParseProfile(ctx, profileValue, &profile)) {
    return false;
  }

  TargetOutcome outcome;
  outcome.reasons.Init(&ctx.Memory());
  outcome.warnings.Init(&ctx.Memory());
  outcome.eligible = true;
  outcome.age18Extrapolation = false;
  outcome.bmiDisplayTenths = 0;
  outcome.underweightByUnrounded = false;
  outcome.hasTargets = false;
  outcome.hasReference = false;
  outcome.hasComputed = false;
  outcome.hasComposition = false;
  outcome.hasManual = false;

  ComputeOutcome(profile, config, &outcome);
  if (ctx.Failed()) {
    return false;
  }

  snapshot->status = outcome.status;
  snapshot->usableForAutoPlanning = outcome.status.Equals("Ok");
  for (usize i = 0; i < outcome.reasons.Size(); ++i) {
    snapshot->reasons.Push(outcome.reasons[i]);
  }
  if (snapshot->usableForAutoPlanning) {
    snapshot->daily = outcome.daily;
    snapshot->mealBreakfast = outcome.mealBreakfast;
    snapshot->mealLunch = outcome.mealLunch;
    snapshot->mealDinner = outcome.mealDinner;
  }

  const JsonValue* hashValue = JsonFind(configValue, "hash");
  if (hashValue != nullptr && hashValue->kind == JsonKind::String) {
    const usize limit = 71;
    const usize count = hashValue->text.size < limit ? hashValue->text.size : limit;
    for (usize i = 0; i < count; ++i) {
      snapshot->nutritionConfigHash[i] = hashValue->text.data[i];
    }
    snapshot->nutritionConfigHash[count] = '\0';
  }
  return true;
}

bool ComputeNutritionTargetEntry(ExecContext& ctx, const char* requestText, usize length,
                                 TextBuffer* out) {
  return RunContractEntry(ctx, requestText, length, &WriteNutritionTargetResult, true, out);
}

}  // namespace mp

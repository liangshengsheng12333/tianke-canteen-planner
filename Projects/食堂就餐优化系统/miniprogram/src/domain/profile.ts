/**
 * profile.ts — 建档草稿校验、Profile 请求构造与 TargetResult 映射。
 *
 * 前端只做输入范围与必填校验、单位换算（页面层）和状态呈现；
 * BMI、REE/TDEE、能量/宏量目标一律由 WASM 的 mp_nutrition_target 返回，
 * 本文件不实现任何营养公式。
 */

import type { FieldError, ProfileDraft, TargetView, Nutrition, Meal } from './types';
import { MEALS } from './types';

// 单位与契约一致：身高毫米、体重克、体脂千分比；页面负责 cm/kg/% 与内部单位互转。
// 边界值本身合法（含端点），越界一律拒绝而不是截断，避免“看起来保存了”却改了用户输入。
// 这些范围只做输入形态校验；生理合理性（如年龄带、是否允许自动目标）由核心规则判定。
export const PROFILE_RANGES = {
  ageYearsMin: 0,
  ageYearsMax: 120,
  heightMmMin: 1000,
  heightMmMax: 2500,
  weightGramsMin: 25000,
  weightGramsMax: 250000,
  bodyFatPermilleMin: 0,
  bodyFatPermilleMax: 1000,
};

// 默认值只是表单起点，不代表已建档；manualTargets=null 表示默认不使用手动目标。
// dietaryFlags 为 false 表示“未声明”，页面需提示这不等同于已确认无相关禁忌。
export function createDefaultProfileDraft(): ProfileDraft {
  return {
    sex: 'male',
    ageYears: 20,
    heightMm: 1750,
    weightGrams: 70000,
    bodyFatPermille: null,
    activityLevel: 'moderate',
    goalType: 'maintain',
    manualTargets: null,
    trainingPreference: false,
    dietaryFlags: { pregnancyOrLactation: false, medicalDietManagement: false },
    tastes: [],
  };
}

// 只接受范围端点内的整数；小数/NaN/字符串一律拒绝，避免页面换算或序列化造成静默截断。
function isIntegerInRange(value: any, min: number, max: number): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

/**
 * 校验草稿；返回字段级错误，空数组表示可以提交给核心再校验。
 * 这里只保证“可提交”，不替代核心的业务校验（BMI、目标可用性、孕哺/疾病禁忌由 WASM 判定）。
 * 返回全部错误而非首个，页面可逐项高亮；本函数不修改草稿，也不写入状态。
 */
export function validateProfileDraft(draft: ProfileDraft): FieldError[] {
  const errors: FieldError[] = [];
  if (!draft || typeof draft !== 'object') {
    return [{ field: 'profile', message: '档案为空' }];
  }
  // 只接受契约里的两种取值；空值/其他字符串直接报错。
  if (draft.sex !== 'male' && draft.sex !== 'female') {
    errors.push({ field: 'sex', message: '性别只能是 male 或 female' });
  }
  // 年龄用整数年，范围含 0；婴幼儿是否适用由核心给出结论，前端不额外设门槛。
  if (!isIntegerInRange(draft.ageYears, PROFILE_RANGES.ageYearsMin, PROFILE_RANGES.ageYearsMax)) {
    errors.push({ field: 'ageYears', message: '年龄必须是 0–120 的整数' });
  }
  // 身高毫米：页面 100–250 cm 对应 1000–2500mm。
  if (!isIntegerInRange(draft.heightMm, PROFILE_RANGES.heightMmMin, PROFILE_RANGES.heightMmMax)) {
    errors.push({ field: 'heightMm', message: '身高必须在 100–250 cm 之间' });
  }
  // 体重克：页面 25–250 kg 对应 25000–250000g。
  if (!isIntegerInRange(draft.weightGrams, PROFILE_RANGES.weightGramsMin, PROFILE_RANGES.weightGramsMax)) {
    errors.push({ field: 'weightGrams', message: '体重必须在 25–250 kg 之间' });
  }
  // 体脂留空合法（null）；0 也是合法值，不能用 falsy 判断跳过校验。
  if (
    draft.bodyFatPermille !== null &&
    !isIntegerInRange(draft.bodyFatPermille, PROFILE_RANGES.bodyFatPermilleMin, PROFILE_RANGES.bodyFatPermilleMax)
  ) {
    errors.push({ field: 'bodyFatPermille', message: '体脂率必须在 0–100% 之间（可留空）' });
  }
  // 活动水平枚举必须与 types.ts 的 ActivityLevel 保持同步，新增档位要同时改核心契约。
  const activities = ['sedentary', 'light', 'moderate', 'active', 'veryActive'];
  if (activities.indexOf(draft.activityLevel) < 0) {
    errors.push({ field: 'activityLevel', message: '活动水平取值非法' });
  }
  // 目标类型只支持维持/减脂/手动；新增类型需同步核心契约与文案表。
  if (['maintain', 'fatLoss', 'manual'].indexOf(draft.goalType) < 0) {
    errors.push({ field: 'goalType', message: '目标类型取值非法' });
  }
  // 手动目标必须自洽：能量必填，宏量可空但空即“未提供”，不能由前端派生。
  if (draft.goalType === 'manual') {
    const manual = draft.manualTargets;
    if (!manual) {
      errors.push({ field: 'manualTargets', message: '手动目标缺少目标值' });
    } else {
      // 来源区分“专业人员给出”与“用户自填”，用于存证与展示，不改变数值校验。
      if (manual.sourceType !== 'professional' && manual.sourceType !== 'userEntered') {
        errors.push({ field: 'manualTargets.sourceType', message: '手动目标来源类型非法' });
      }
      // 手动能量必须为正（1–20000 kcal）：0 或负值无法作为目标。
      if (!isIntegerInRange(manual.energyKcal, 1, 20000)) {
        errors.push({ field: 'manualTargets.energyKcal', message: '手动目标能量必须是 1–20000 kcal 的整数' });
      }
      // 宏量单位 0.1g，可留空；0 表示“设为零摄入”，与空值“未提供”语义不同。
      for (const key of ['proteinDg', 'fatDg', 'carbDg'] as const) {
        const value = manual[key];
        if (value !== null && !isIntegerInRange(value, 0, 100000)) {
          errors.push({ field: `manualTargets.${key}`, message: `手动目标 ${key} 必须是 0 以上的整数（0.1g）或留空` });
        }
      }
      if (Array.isArray(manual.derivedFields) && manual.derivedFields.length > 0) {
        // 前端不派生任何宏量；派生只能来自已批准规则（当前没有），因此这里拒绝。
        // 否则“缺项”会被静默补成看似完整的假目标。
        errors.push({ field: 'manualTargets.derivedFields', message: '前端不允许自行派生手动目标字段' });
      }
    }
  }
  // 口味偏好只影响推荐排序，允许空数组；非数组说明页面绑定出错。
  if (!Array.isArray(draft.tastes)) {
    errors.push({ field: 'tastes', message: '口味偏好必须是数组' });
  }
  return errors;
}

/**
 * 构造契约 Profile 对象（请求里携带，不改写原草稿）。
 * 结构会变：goalType 变成 goal.type、手动目标嵌到 goal.manualTargets；单位保持内部单位。
 * profileId/revision 由 store 提供，核心据此判断请求是否陈旧；手动目标为空时显式传 null。
 */
export function toProfileRequest(draft: ProfileDraft, profileId: string, revision: number): any {
  return {
    contractVersion: '1.0',
    profileId,
    revision,
    // 身体字段与草稿一一对应；bodyFatPermille 的 null 原样传给核心（表示未提供）。
    sex: draft.sex,
    ageYears: draft.ageYears,
    heightMm: draft.heightMm,
    weightGrams: draft.weightGrams,
    bodyFatPermille: draft.bodyFatPermille,
    activityLevel: draft.activityLevel,
    // 字段名不能照抄草稿：目标类型与手动目标在契约里是嵌套结构。
    goal: {
      type: draft.goalType,
      manualTargets:
        draft.goalType === 'manual' && draft.manualTargets
          ? {
              energyKcal: draft.manualTargets.energyKcal,
              proteinDg: draft.manualTargets.proteinDg,
              fatDg: draft.manualTargets.fatDg,
              carbDg: draft.manualTargets.carbDg,
              sourceType: draft.manualTargets.sourceType,
              sourceNote: draft.manualTargets.sourceNote,
              derivedFields: draft.manualTargets.derivedFields,
            }
          : null,
    },
    trainingPreference: draft.trainingPreference,
    // 用 !! 归一成布尔，防止页面传入 undefined 改变契约形状。
    dietaryFlags: {
      pregnancyOrLactation: !!draft.dietaryFlags.pregnancyOrLactation,
      medicalDietManagement: !!draft.dietaryFlags.medicalDietManagement,
    },
    tastes: draft.tastes,
  };
}

// 状态码来自 WASM，前端只翻译不重判；除 Ok 外都表示“自动配餐不可用”，
// 未识别的状态码原样显示，便于诊断而不是伪装成成功。
const TARGET_STATUS_LABELS: Record<string, string> = {
  Ok: '目标可用',
  REFERENCE_ONLY: '仅参考（不适合作自动配餐目标）',
  TARGET_REVIEW_REQUIRED: '低于能量下限，需复核',
  TARGET_COMPOSITION_CONFLICT: '宏量构成超出范围',
  MANUAL_TARGET_INCONSISTENT: '手动目标与能量不一致',
  MANUAL_TARGET_INCOMPLETE: '手动目标缺项',
  AUTO_TARGET_DISABLED: '自动目标已停用',
};

// reasons 解释“为何不自动生成/不应用”，直接展示给用户；包含孕哺、疾病、年龄边界等硬约束。
const REASON_LABELS: Record<string, string> = {
  UNDERWEIGHT: 'BMI 低于 18.5（体重过轻）',
  MANUAL_STORAGE_ONLY: '手动目标只存证、不应用',
  PREGNANCY_OR_LACTATION: '孕哺期不自动生成目标',
  MEDICAL_DIET: '需疾病饮食管理，不自动生成目标',
  AGE_OUT_OF_RANGE: '年龄不在 18–78 岁自动目标范围',
  MANUAL_TARGET_INCOMPLETE: '手动目标宏量不完整',
  MANUAL_TARGET_INCONSISTENT: '手动目标能量与宏量不一致',
};

// warnings 不阻断计算但必须展示（外推/能量下限/宏量构成），避免用户误以为数值是精确值。
const WARNING_LABELS: Record<string, string> = {
  AGE_18_EXTRAPOLATION: '18 岁沿用成人公式，属外推',
  PRODUCT_ENERGY_FLOOR: '触及产品能量下限',
  MACRO_COMPOSITION: '宏量构成接近/超出范围',
  ENERGY_MACRO_MISMATCH: '能量与宏量不一致',
  AUTO_TARGET_DISABLED: '自动目标不可用',
};

// 导出给页面复用，避免页面自造第二套营养文案。
const NUTRIENT_LABELS = ['蛋白质', '脂肪', '碳水'];

// 核心返回的分餐参考可能缺某些餐次：只保留存在且字段齐全的餐次，无任何餐次时返回 null。
function mealReferenceFrom(raw: any): Record<string, Nutrition> | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }
  const out: Record<string, Nutrition> = {};
  for (const meal of MEALS) {
    const item = raw[meal];
    if (item) {
      out[meal] = {
        energyKcal: item.energyKcal,
        proteinDg: item.proteinDg,
        fatDg: item.fatDg,
        carbDg: item.carbDg,
      };
    }
  }
  return Object.keys(out).length > 0 ? out : null;
}

/**
 * 把 TargetResult 包络映射成页面可直接绑定的 TargetView（纯字段映射）。
 * 失败分支也构造完整视图（available=false），页面无需区分“有结果/没结果”两套渲染。
 * manualStored 与 manualApplied 必须分开：手动目标可能已存证但因缺项/不一致而未应用。
 */
export function mapTargetResult(envelope: any): TargetView {
  if (!envelope || envelope.ok === false || !envelope.result) {
    const code = envelope && envelope.error ? envelope.error.code : 'UNKNOWN_ERROR';
    const fieldPath = envelope && envelope.error ? envelope.error.fieldPath : '';
    const detail = envelope && envelope.error ? envelope.error.message : '营养目标计算失败';
    // 错误码与字段路径都保留：页面可同时显示人话与可排查的代码。
    return {
      available: false,
      status: code,
      statusLabel: '目标计算失败',
      eligible: false,
      reasons: [],
      reasonsText: '',
      bmiDisplayTenths: null,
      bmiLabel: '—',
      ageBand: '',
      age18Extrapolation: false,
      daily: null,
      mealReference: null,
      sourceLabel: '',
      componentLabel: '',
      warnings: [],
      message: `${detail}（${fieldPath || code}）`,
      manualStored: false,
      manualApplied: false,
      manualReason: '',
    };
  }

  const r = envelope.result;
  const status: string = r.status;
  const statusLabel = TARGET_STATUS_LABELS[status] || status;
  const applicability = r.applicability || {};
  const reasons: string[] = Array.isArray(applicability.reasons) ? applicability.reasons : [];
  const reasonTexts = reasons.map((reason) => REASON_LABELS[reason] || reason);
  const warnings = Array.isArray(r.warnings)
    ? r.warnings.map((code: string) => WARNING_LABELS[code] || code)
    : [];
  const bmiTenths = typeof applicability.bmiDisplayTenths === 'number' ? applicability.bmiDisplayTenths : null;

  // targets 缺失时 daily=null；不伪造 0 目标，页面显示“无可用目标”。
  const daily: Nutrition | null =
    r.targets && r.targets.daily
      ? {
          energyKcal: r.targets.daily.energyKcal,
          proteinDg: r.targets.daily.proteinDg,
          fatDg: r.targets.daily.fatDg,
          carbDg: r.targets.daily.carbDg,
        }
      : null;
  const mealReference = r.targets ? mealReferenceFrom(r.targets.mealReference) : null;

  // 来源标签交代公式/REE/活动系数/目标类型：营养目标是估算值，来源必须可追溯。
  let sourceLabel = '';
  if (r.targets && r.targets.source) {
    const source = r.targets.source;
    const factor = typeof source.activityFactorPermille === 'number' ? (source.activityFactorPermille / 1000).toFixed(3) : '—';
    sourceLabel = `${source.formulaLabel || source.formula}；REE ${Math.round(source.reeMkcal / 1000)} kcal，活动系数 ×${factor}，目标 ${GOAL_TEXT[source.goal] || source.goal}`;
  }

  // 宏量构成用基点（bp）表达，范围由核心给出；没有 actualBp 时不展示，避免空范围误导。
  let componentLabel = '';
  const composition = r.composition;
  if (composition && composition.actualBp) {
    const bp = composition.actualBp;
    const ranges = composition.rangesBp || {};
    const fmt = (value: number) => `${(value / 100).toFixed(2)}%`;
    componentLabel =
      `蛋白 ${fmt(bp.protein)}（${(ranges.protein || []).join('–')} bp）` +
      `，脂肪 ${fmt(bp.fat)}（${(ranges.fat || []).join('–')} bp）` +
      `，碳水 ${fmt(bp.carb)}（${(ranges.carb || []).join('–')} bp）` +
      `，碳水 ${(composition.carbDg / 10).toFixed(1)}g` +
      (composition.carbFloorDg === null ? '，无碳水下限' : `，下限 ${(composition.carbFloorDg / 10).toFixed(1)}g`) +
      `，${composition.passed ? '构成为范围通过' : '构成未通过'}`;
  }

  // manual 块的 stored/applied 是核心结论：存证不代表应用，未应用必须带原因。
  const manual = r.manualTarget;
  const manualStored = !!(manual && manual.stored);
  const manualApplied = !!(manual && manual.applied);
  const manualReason = manual && manual.reason ? REASON_LABELS[manual.reason] || manual.reason : '';

  // 一句话结论按 状态 → 原因 → 警告 → 手动目标 → 可用性 拼接，保证用户先看到结论。
  const parts: string[] = [statusLabel];
  if (reasonTexts.length > 0) {
    parts.push(reasonTexts.join('；'));
  }
  if (warningTexts(warnings)) {
    parts.push(warningTexts(warnings));
  }
  if (manualStored) {
    parts.push(manualApplied ? '手动目标已存证并应用' : `手动目标已存证但未应用${manualReason ? '（' + manualReason + '）' : ''}`);
  }
  if (status === 'Ok') {
    parts.push('该目标可用于自动规划');
  } else if (status !== 'REFERENCE_ONLY') {
    parts.push('自动配餐不会使用该目标');
  } else {
    parts.push('仅展示参考值，自动配餐不会使用');
  }

  // available 只认 status==='Ok'：REFERENCE_ONLY 等即使有数值也不能用于自动规划。
  return {
    available: status === 'Ok',
    status,
    statusLabel,
    eligible: !!applicability.eligible,
    reasons,
    reasonsText: reasonTexts.join('；'),
    bmiDisplayTenths: bmiTenths,
    bmiLabel: bmiTenths === null ? '—' : (bmiTenths / 10).toFixed(1),
    ageBand: applicability.ageBand || '',
    age18Extrapolation: !!applicability.age18Extrapolation,
    daily,
    mealReference,
    sourceLabel,
    componentLabel,
    warnings,
    message: parts.join('。'),
    manualStored,
    manualApplied,
    manualReason,
  };
}

// 无警告返回空串，拼接时自然跳过，不产生多余标点。
function warningTexts(warnings: string[]): string {
  return warnings.length > 0 ? '提示：' + warnings.join('；') : '';
}

// 目标类型展示文案；未识别值在 sourceLabel 里有原样兜底。
const GOAL_TEXT: Record<string, string> = {
  maintain: '维持',
  fatLoss: '减脂',
  manual: '手动目标',
};

/**
 * 首页/记餐页的档案摘要，只做展示，不参与任何计算。
 * 未建档返回明确文案，不用空串让页面出现空白区块。
 */
export function profileSummary(draft: ProfileDraft | null): string {
  if (!draft) {
    return '尚未建档';
  }
  const sex = draft.sex === 'male' ? '男' : '女';
  const goal = { maintain: '维持', fatLoss: '减脂', manual: '手动目标' }[draft.goalType];
  return `${sex}，${draft.ageYears} 岁，${(draft.heightMm / 10).toFixed(0)} cm，${(draft.weightGrams / 1000).toFixed(1)} kg，${goal}`;
}

// 以导出形式供页面复用，保持与内部标签同一份定义。
export { NUTRIENT_LABELS };

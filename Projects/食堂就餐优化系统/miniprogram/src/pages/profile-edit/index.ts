/**
 * pages/profile-edit/index.ts — 个人资料：先展示已存摘要，点“编辑资料”才展开表单。
 *
 * 输入层职责：表单编辑、单位换算（cm→mm、kg→g、体脂%→permille、宏量 g→0.1g）与数字解析。
 * 校验、保存、BMI/能量/宏量目标计算全部在 AppStore / domain 内完成；页面不实现任何营养公式。
 * U04 收口后本页只负责“个人资料”，预算/口味/训练偏好在 budget 页，外观在 profile 页内联分组。
 */
import type { AppStore } from '../../domain/store';
import type { ActionResult, FieldError, Nutrition, ProfileDraft, ProfileView } from '../../domain/types';
import { ACTIVITY_LABELS, GOAL_LABELS, MEAL_LABELS, MEALS, SEX_LABELS } from '../../domain/types';
import { describeError } from '../../utils/wx-runtime';
import { applyPageAppearance } from '../../utils/appearance';
// 本页是“输入层”：表单用展示单位（cm/kg/%/g/元），store 只接受规范单位（mm/g/千分比/0.1g/分）。
// 换算只发生在 formFromDraft（规范 → 展示）与 buildDraft（展示 → 规范）两个函数，别处不得二次换算。
// 校验、保存、BMI/能量/宏量目标全部由 store/domain 完成；页面不做营养公式，也不缓存目标结果。
// 页面显示的目标数值只能来自 getProfileView().target（WASM 结果的映射）；target 为 null 就显示“未计算”。

// 手动目标来源类型（ManualSourceType）的中文选项；顺序与 form.manualSourceIndex 对应。
const MANUAL_SOURCE_LABELS = ['专业建议（医生/营养师）', '用户自填'];
// 下标 0=专业建议、1=用户自填；与 buildDraft 里 sourceType 的映射一一对应，顺序不能调换。

// store 返回的字段级错误用字段名标识；这里只映射成中文标题，不改变错误本身。
// 映射不到时 errorRows 原样回显字段名，避免“错误被吞掉”或显示成空白。
const FIELD_LABELS: Record<string, string> = {
  profile: '档案',
  sex: '性别',
  ageYears: '年龄',
  heightMm: '身高',
  weightGrams: '体重',
  bodyFatPermille: '体脂率',
  activityLevel: '活动水平',
  goalType: '目标类型',
  manualTargets: '手动目标',
  'manualTargets.sourceType': '手动目标来源',
  'manualTargets.energyKcal': '手动目标能量',
  'manualTargets.proteinDg': '手动目标蛋白质',
  'manualTargets.fatDg': '手动目标脂肪',
  'manualTargets.carbDg': '手动目标碳水',
  'manualTargets.derivedFields': '手动目标派生字段',
  tastes: '口味偏好',
  budgetCents: '全天预算',
};

// 底部导航改为三个主入口（今日 / 记录 / 我的），共用 utils/tabbar.ts 的唯一实现。
// 菜单与备份、诊断不再占主导航，作为“数据管理”的次级入口从本页进入（U04 会继续收口我的页结构）。

/** 空表单（onLoad 前占位；真正值由 getProfileView().draft 回填）。 */
// 占位表单只用于首帧；用户看到与提交的值必须来自 formFromDraft 或用户输入，不能来自过期占位。
function emptyForm() {
  return {
    sexIndex: 0,
    ageYears: '',
    heightCm: '',
    weightKg: '',
    bodyFatPct: '',
    activityIndex: 2, // 与 domain 默认草稿的“中度活动”对应
    goalIndex: 0,
    goalType: 'maintain',
    manualEnergyKcal: '',
    manualProteinG: '',
    manualFatG: '',
    manualCarbG: '',
    manualSourceIndex: 1, // 默认“用户自填”
    manualSourceNote: '',
  };
}

/** 营养量展示：能量 kcal；宏量以 0.1g（dg）存储，仅除以 10 显示成 g。 */
// nutrition 为 null 只代表“没有可展示快照”，不是“营养为 0”；目标不可用时不显示 0 值。
// 宏量按 0.1g 存储，这里只做 /10 展示，不四舍五入到整克，避免展示层改变精度。
function nutritionText(nutrition: Nutrition | null): string {
  if (!nutrition) {
    return '—';
  }
  const grams = (dg: number) => (dg / 10).toFixed(1);
  return `能量 ${Math.round(nutrition.energyKcal)} kcal · 蛋白 ${grams(nutrition.proteinDg)}g · 脂肪 ${grams(nutrition.fatDg)}g · 碳水 ${grams(nutrition.carbDg)}g`;
}

/** 输入框文本 → 数字；空串返回 null，非数字返回 NaN（由调用方给出“请填写数字”）。 */
// 约定：空串 → null（未填写），非数字 → NaN（填写错误）；两者语义不同，调用方分别提示。
// 不在这里做范围校验：范围/必填/一致性由 domain/profile.ts 统一判定，页面只负责解析。
function parseOptionalNumber(text: string): number | null {
  const trimmed = String(text === null || text === undefined ? '' : text).trim();
  if (trimmed === '') {
    return null;
  }
  return Number(trimmed);
}

// 单独封装 NaN 判断，避免各字段各写一份 Number.isNaN 逻辑而产生口径差异。
function isNotANumber(value: number | null): boolean {
  return value !== null && Number.isNaN(value);
}

/** 毫米 → cm 输入框文本（保留 1 位小数，能整除时不带小数）。 */
// 能整除时输出整数字符串（175 而不是 175.0）；回写时仍按 cm→mm 取整。
function mmToCmInput(mm: number): string {
  if (!mm) {
    return '';
  }
  return mm % 10 === 0 ? String(mm / 10) : (mm / 10).toFixed(1);
}

/** 克 → kg 输入框文本（保留 1 位小数，能整除时不带小数）。 */
// 克与千克按 1000 换算（不是 100），与 buildDraft 的 kg×1000 严格互逆。
function gramsToKgInput(grams: number): string {
  if (!grams) {
    return '';
  }
  return grams % 1000 === 0 ? String(grams / 1000) : (grams / 1000).toFixed(1);
}


Page({
  data: {
    view: null as ProfileView | null,
    // 保留 ProfileView 快照：view.draft 是 store 规范化后的草稿，提交与错误提示都以它为准。
    // form 才是可编辑的展示单位副本；view 不随输入变化，避免“输入一半就改业务对象”。
    loadError: '',
    form: emptyForm(),
    errors: [] as any[],
    targetError: '',
    targetBadge: 'badge-info',
    targetStateText: '未计算',
    targetDailyText: '',
    targetMealRows: [] as any[],
    saving: false,
    computing: false,
    sexLabels: [SEX_LABELS.male, SEX_LABELS.female],
    manualSourceLabels: MANUAL_SOURCE_LABELS,
    // U04：已存资料先显示摘要，用户点“编辑资料”后才展开表单；取消编辑恢复为摘要视图。
    editing: false,
    // 编辑态提示：区分“默认示例（还没保存）”和“已保存资料被修改（未提交）”，避免把预填值当已保存。
    editingNote: '',
    summaryRows: [] as { label: string; value: string }[],
    summaryNote: '',
    // 外观 class：onShow 同步，保证本页与外层“我的”页配色一致。
    themeClass: 'tk-light',
  },

  /** 取得全局唯一 AppStore；全局状态缺失时给出可见提示，不用假数据顶替。 */
  // 每次现取 getApp() 而不是模块级缓存：页面实例可能被重建，store 也可能因 onLaunch 失败而不存在。
  // 缺失时只提示、不构造临时 store（假数据会污染真实状态）。
  store(): AppStore | null {
    const app = getApp();
    const store = app && app.globalData ? app.globalData.store : null;
    if (!store) {
      wx.showToast({ title: '全局状态未初始化，请重新打开小程序', icon: 'none' });
      return null;
    }
    return store as AppStore;
  },

  // 每次显示都重读档案：从今日/菜单页返回时，档案可能已被保存更新。
  // 正在编辑时不回填表单，避免覆盖用户未保存的输入；取消编辑或保存成功后才回到摘要视图。
  onShow() {
    this.setData(applyPageAppearance());
    this.reload();
  },

  /** 读取档案与目标视图，并刷新摘要；编辑中不回填表单，防止覆盖未保存输入。 */
  // ensureToday() 先切日，保证读到的是今天档位下的目标。
  reload() {
    const store = this.store();
    if (!store) {
      return;
    }
    try {
      // 先处理跨日：业务日期变化会重置今日桶，档案本身不随日期变化。
      store.ensureToday();
      const view = store.getProfileView();
      // 编辑中保持用户输入；否则用 store 草稿回填（保存后单位可能被规范化取整）。
      this.applyView(view, !this.data.editing);
      this.setData({ summaryRows: this.buildSummaryRows(view), summaryNote: this.buildSummaryNote(view) });
    } catch (error: any) {
      this.setData({ loadError: '读取档案失败：' + describeError(error) });
    }
  },

  /** 写回 ProfileView 与目标展示派生字段；syncForm 为真时按规范化草稿回填表单。 */
  // 目标展示字段只在 target 存在时生成；没有 target 就留空串/空行，由 WXML 显示“未计算”。
  // targetState 区分 loading/error/idle，但页面不改写状态，只映射成徽标与文案。
  applyView(view: ProfileView, syncForm: boolean) {
    const target = view.target;
    // available=false 的目标仍是核心的真实结果（例如不适用/缺数据），照实显示而不是隐藏。
    const targetDailyText = target && target.daily ? nutritionText(target.daily) : '';
    const mealReference = target ? target.mealReference : null;
    const targetMealRows = mealReference
      ? MEALS.filter((meal) => !!mealReference[meal]).map((meal) => ({
          label: MEAL_LABELS[meal],
          text: nutritionText(mealReference[meal]),
        }))
      : [];
    const updates: any = {
      // 徽标优先级：有 target 就按 target.available 判定；没有 target 才回落到 view.targetState。
      view,
      loadError: '',
      targetDailyText,
      targetMealRows,
      targetBadge: target
        ? target.available
          ? 'badge-ok'
          : 'badge-warn'
        : view.targetState === 'error'
          ? 'badge-err'
          : 'badge-info',
      editingNote: this.buildEditingNote(view),
      targetStateText: target
        ? target.statusLabel
        : view.targetState === 'loading'
          ? '计算中'
          : view.targetState === 'error'
            ? '计算失败'
            : '未计算',
    };
      // 只有“重读/保存成功”才回填表单；计算目标后不回填，避免覆盖用户未保存的输入。
    if (syncForm) {
      updates.form = this.formFromDraft(view.draft, view);
    }
    this.setData(updates);
  },

  /** 规范化草稿（mm/g/permille）→ 表单展示单位（cm/kg/%）。 */
  // 规范单位 → 展示单位的唯一入口；所有字段必须能从这里原样 round-trip 回 buildDraft。
  // 找不到匹配选项时回落到 0（而不是 -1），保证 picker 永远有合法下标。
  formFromDraft(draft: ProfileDraft, view: ProfileView) {
    const activityIndex = Math.max(
      0,
      view.activityOptions.findIndex((option) => option.value === draft.activityLevel),
    );
    const goalIndex = Math.max(
      0,
      view.goalOptions.findIndex((option) => option.value === draft.goalType),
    );
    const manual = draft.manualTargets;
    // 手动目标可能为 null（非手动目标）：所有手动输入框保持空串，不预填自动计算出来的值。
    const sourceIndex = manual && manual.sourceType === 'professional' ? 0 : 1;
    return {
      sexIndex: draft.sex === 'female' ? 1 : 0,
      ageYears: String(draft.ageYears),
      heightCm: mmToCmInput(draft.heightMm),
      weightKg: gramsToKgInput(draft.weightGrams),
      bodyFatPct:
        draft.bodyFatPermille === null
          ? ''
          : draft.bodyFatPermille % 10 === 0
            ? String(draft.bodyFatPermille / 10)
            : (draft.bodyFatPermille / 10).toFixed(1),
      activityIndex,
      goalIndex,
      goalType: draft.goalType,
      manualEnergyKcal: manual && manual.energyKcal !== null ? String(manual.energyKcal) : '',
      manualProteinG: manual && manual.proteinDg !== null ? (manual.proteinDg / 10).toFixed(1) : '',
      manualFatG: manual && manual.fatDg !== null ? (manual.fatDg / 10).toFixed(1) : '',
      manualCarbG: manual && manual.carbDg !== null ? (manual.carbDg / 10).toFixed(1) : '',
      manualSourceIndex: sourceIndex,
      manualSourceNote: manual && manual.sourceNote ? manual.sourceNote : '',
    };
  },

  /**
   * 已存资料摘要行：只做展示格式化，数值全部来自 store 的规范化草稿。
   * 未保存时给出明确提示，不把占位默认值冒充成用户资料。
   */
  buildSummaryRows(view: ProfileView): { label: string; value: string }[] {
    const draft = view.draft;
    const rows: { label: string; value: string }[] = [
      { label: '性别', value: SEX_LABELS[draft.sex] || '未知' },
      { label: '年龄', value: draft.ageYears ? draft.ageYears + ' 岁' : '未填写' },
      { label: '身高', value: draft.heightMm ? (draft.heightMm / 10).toFixed(1) + ' cm' : '未填写' },
      { label: '体重', value: draft.weightGrams ? (draft.weightGrams / 1000).toFixed(1) + ' kg' : '未填写' },
      {
        label: '体脂率',
        value: draft.bodyFatPermille === null ? '未填写（未知）' : (draft.bodyFatPermille / 10).toFixed(1) + ' %',
      },
      { label: '活动水平', value: ACTIVITY_LABELS[draft.activityLevel] || '未填写' },
      { label: '目标', value: GOAL_LABELS[draft.goalType] || '未知' },
    ];
    if (draft.goalType === 'manual' && draft.manualTargets) {
      const manual = draft.manualTargets;
      const parts = [] as string[];
      if (manual.energyKcal !== null) {
        parts.push('能量 ' + manual.energyKcal + ' kcal');
      }
      if (manual.proteinDg !== null) {
        parts.push('蛋白 ' + (manual.proteinDg / 10).toFixed(1) + 'g');
      }
      if (manual.fatDg !== null) {
        parts.push('脂肪 ' + (manual.fatDg / 10).toFixed(1) + 'g');
      }
      if (manual.carbDg !== null) {
        parts.push('碳水 ' + (manual.carbDg / 10).toFixed(1) + 'g');
      }
      rows.push({ label: '手动目标', value: parts.length > 0 ? parts.join(' · ') : '已选择手动目标，数值未填写' });
    }
    return rows;
  },

  /**
   * 编辑态提示：表单预填值不是“已保存资料”，必须显式说明默认示例与保存边界。
   * 未保存时给出“默认示例，保存后生效”；已保存时说明改动未提交、计算目标仍用已保存资料。
   */
  buildEditingNote(view: ProfileView): string {
    if (!view.saved) {
      return '下面的数字是默认示例（还没有保存），保存后才会生效；未保存的修改不会用于计算每日目标。';
    }
    return '下面是已保存的资料；改动后要点“保存资料”才生效，未保存的修改不会用于计算每日目标。';
  },

  /** 摘要页说明：区分“资料已保存”与“目标可用于自动应用”，两者不混成一句。 */
  buildSummaryNote(view: ProfileView): string {
    if (!view.saved) {
      return '还没有保存个人资料；填写并保存后才能计算营养目标、用于今日方案。';
    }
    const target = view.target;
    if (!target) {
      return '资料已保存；还没有计算每日营养目标，点下方“计算营养目标”即可。';
    }
    if (!target.available) {
      return '资料已保存，但当前目标不可用于自动规划：' + (target.reasonsText || target.message || '原因见下方目标卡');
    }
    return '资料已保存，目标可用于自动规划；需年满 18 岁，且身体数据与目标方式都在可自动计算的范围内。';
  },

  /** 从摘要进入编辑：用 store 规范化草稿回填表单，开始一次新的编辑。 */
  onStartEdit() {
    const view = this.data.view as ProfileView | null;
    if (!view) {
      wx.showToast({ title: '档案还没加载完成', icon: 'none' });
      return;
    }
    this.setData({
      form: this.formFromDraft(view.draft, view),
      errors: [],
      targetError: '',
      editing: true,
    });
  },

  /** 取消编辑：丢弃未保存输入，回到摘要视图（不写 store，不改档案）。 */
  onCancelEdit() {
    const view = this.data.view as ProfileView | null;
    this.setData({ errors: [], targetError: '', editing: false });
    if (view) {
      this.setData({ form: this.formFromDraft(view.draft, view) });
    }
    this.reload();
  },

  /**
   * 表单 → ProfileDraft：只做输入解析与单位换算。
   * 必填/范围/一致性校验交给 domain/profile.ts（saveProfile 返回的 errors 会在页面展示）。
   * 页面只拦“空值/非数字”这类输入形态错误，范围与跨字段一致性一律交给 domain，避免两套规则。
   * 返回 draft=null 表示输入形态不合法；此时 errors 必不为空，页面逐条展示。
   */
  buildDraft(view: ProfileView): { draft: ProfileDraft | null; errors: FieldError[] } {
    const form = this.data.form;
    // 以表单当前值为准构建草稿；view.draft 只用于回填，不作为提交源，防止把旧值写回去。
    const errors: FieldError[] = [];
    const age = parseOptionalNumber(form.ageYears);
    const heightCm = parseOptionalNumber(form.heightCm);
    const weightKg = parseOptionalNumber(form.weightKg);
    const bodyFatPct = parseOptionalNumber(form.bodyFatPct);

    if (age === null) {
      errors.push({ field: 'ageYears', message: '请填写年龄' });
    } else if (isNotANumber(age)) {
      errors.push({ field: 'ageYears', message: '年龄请填写数字' });
    }
    if (heightCm === null) {
      errors.push({ field: 'heightMm', message: '请填写身高（cm）' });
    } else if (isNotANumber(heightCm)) {
      errors.push({ field: 'heightMm', message: '身高请填写数字（cm）' });
    }
    if (weightKg === null) {
      errors.push({ field: 'weightGrams', message: '请填写体重（kg）' });
    } else if (isNotANumber(weightKg)) {
      errors.push({ field: 'weightGrams', message: '体重请填写数字（kg）' });
    }
    if (isNotANumber(bodyFatPct)) {
      errors.push({ field: 'bodyFatPermille', message: '体脂率请填写数字（%），或留空' });
    }

    const goalOption = view.goalOptions[form.goalIndex] || view.goalOptions[0];
    // 目标类型以 picker 选项的 value 为准（maintain/fatLoss/manual），不信任 form.goalType 的旧值。
    const goalType = goalOption ? goalOption.value : 'maintain';

    // 手动目标：能量必填由 domain 校验；宏量可留空；NaN 属于输入错误，不能带进草稿。
    const manualEnergy = parseOptionalNumber(form.manualEnergyKcal);
    const manualProtein = parseOptionalNumber(form.manualProteinG);
    const manualFat = parseOptionalNumber(form.manualFatG);
    const manualCarb = parseOptionalNumber(form.manualCarbG);
    if (goalType === 'manual') {
      const manualFields: { value: number | null; field: string; label: string }[] = [
        { value: manualEnergy, field: 'manualTargets.energyKcal', label: '手动目标能量' },
        { value: manualProtein, field: 'manualTargets.proteinDg', label: '手动目标蛋白质' },
        { value: manualFat, field: 'manualTargets.fatDg', label: '手动目标脂肪' },
        { value: manualCarb, field: 'manualTargets.carbDg', label: '手动目标碳水' },
      ];
      for (const entry of manualFields) {
        if (isNotANumber(entry.value)) {
          errors.push({ field: entry.field, message: `${entry.label}请填写数字` });
        }
      }
    }
    if (errors.length > 0) {
      return { draft: null, errors };
    }

    const activityOption = view.activityOptions[form.activityIndex] || view.activityOptions[0];
    let manualTargets: ProfileDraft['manualTargets'] = null;
    if (goalType === 'manual') {
      manualTargets = {
        energyKcal: manualEnergy === null ? null : Math.round(manualEnergy),
        proteinDg: manualProtein === null ? null : Math.round(manualProtein * 10),
        fatDg: manualFat === null ? null : Math.round(manualFat * 10),
        carbDg: manualCarb === null ? null : Math.round(manualCarb * 10),
        sourceType: form.manualSourceIndex === 0 ? 'professional' : 'userEntered',
        sourceNote: String(form.manualSourceNote || '').trim() || null,
        derivedFields: [], // 页面不派生任何宏量
      };
    }
    // 页面不派生任何宏量：缺项就存 null，由核心判断手动目标是否适用，绝不用能量×比例反推。
    // 单位在这里一次换算：cm→mm、kg→g、%→千分比、g→0.1g；Math.round 消除浮点误差。
    // 偏好类字段（口味/训练偏好/孕哺/疾病）在“预算与偏好”页维护，随档案一起保存；
    // 本页保存资料时原样带上传入的草稿值，绝不重置用户已保存的偏好。
    const stored = view.draft;
    const draft: ProfileDraft = {
      sex: form.sexIndex === 1 ? 'female' : 'male',
      ageYears: age as number,
      heightMm: Math.round((heightCm as number) * 10), // cm → mm
      weightGrams: Math.round((weightKg as number) * 1000), // kg → g
      bodyFatPermille: bodyFatPct === null ? null : Math.round((bodyFatPct as number) * 10), // % → permille
      activityLevel: activityOption ? activityOption.value : 'moderate',
      goalType,
      manualTargets,
      trainingPreference: !!stored.trainingPreference,
      dietaryFlags: {
        pregnancyOrLactation: !!stored.dietaryFlags.pregnancyOrLactation,
        medicalDietManagement: !!stored.dietaryFlags.medicalDietManagement,
      },
      tastes: Array.isArray(stored.tastes) ? stored.tastes.slice() : [],
    };
    return { draft, errors: [] };
  },

  /** store 返回的 errors → 页面错误列表；没有字段级错误时至少显示总信息，不吞错。 */
  // 字段级错误来自 store 的 validateProfileDraft；没有 errors 时至少给一条总信息，不能静默失败。
  errorRows(result: ActionResult) {
    const raw = result.errors && result.errors.length > 0 ? result.errors : [];
    if (raw.length === 0) {
      return [{ index: 0, label: '保存', message: result.message || '保存失败' }];
    }
    return raw.map((entry, index) => ({
      index,
      label: FIELD_LABELS[entry.field] || entry.field,
      message: entry.message,
    }));
  },

  // 保存流程：页面拦输入形态 → store.saveProfile（业务校验 + 事务写盘）→ 成功才重算目标。
  // 保存失败不回填表单：保留用户刚输入的值，只把字段级错误列出来（见下方 setData）。
  // 保存成功后按 store 规范化草稿回填（单位换算可能取整），再自动调用 computeTarget。
  async onSave() {
    const store = this.store();
    if (!store) {
      return;
    }
    const view = this.data.view as ProfileView | null;
    if (!view) {
      wx.showToast({ title: '档案还没加载完成', icon: 'none' });
      return;
    }
    if (this.data.saving || this.data.computing) {
      return;
    }
    const built = this.buildDraft(view);
    // 页面能判断的只有输入形态；业务校验交给 store，避免页面规则与 domain 漂移。
    if (!built.draft) {
      this.setData({ errors: built.errors });
      wx.showToast({
        title: built.errors.length > 0 ? built.errors[0].message : '请检查输入',
        icon: 'none',
      });
      return;
    }
    this.setData({ saving: true, errors: [] });
    // saving 期间禁用保存/计算按钮，防止重复写盘；所有异常路径都必须复位 saving。
    let result: ActionResult;
    try {
      result = store.saveProfile(built.draft);
      // saveProfile 内部是事务式提交：失败不破坏已有档案，页面无需回滚。
    } catch (error: any) {
      this.setData({ saving: false });
      wx.showToast({ title: '保存异常：' + describeError(error), icon: 'none' });
      return;
    }
    if (!result.ok) {
      // 保存失败不回填表单，避免丢掉用户刚输入的值；逐条展示 store 的校验错误。
      this.setData({ saving: false, errors: this.errorRows(result), view: store.getProfileView() });
      wx.showToast({ title: result.message || '保存失败', icon: 'none' });
      return;
    }
    // 保存成功：按 store 规范化后的草稿回填（单位换算可能取整），回到摘要视图并自动重算目标。
    const savedView = store.getProfileView();
    this.applyView(savedView, true);
    // 保存成功后 re-read store：档案 revision 已递增，store 会清掉旧目标缓存，页面不能复用旧目标。
    this.setData({
      saving: false,
      errors: [],
      editing: false,
      summaryRows: this.buildSummaryRows(savedView),
      summaryNote: this.buildSummaryNote(savedView),
    });
    wx.showToast({ title: '档案已保存', icon: 'none' });
    await this.recomputeTarget();
    this.setData({
      summaryRows: this.buildSummaryRows(store.getProfileView()),
      summaryNote: this.buildSummaryNote(store.getProfileView()),
    });
  },

  /** 计算营养目标：真正数值来自 WASM；失败时保留可见错误，不显示假目标。 */
  // 页面不实现 BMI/能量/宏量公式，也不用默认值填充失败场景；目标只能是 WASM 结果。
  // applyView(..., false)：计算目标后不回填表单，避免覆盖用户尚未保存的编辑。
  // 失败只显示 targetError/toast；目标缓存已由 store 失效，页面不展示上一次的假目标。
  async recomputeTarget() {
    const store = this.store();
    if (!store || this.data.computing) {
      return;
    }
    this.setData({ computing: true, targetError: '' });
    // 每次计算先清 targetError，避免上一次失败信息与新请求结果混在一起。
    try {
      const outcome = await store.computeTarget();
      // store 用 profileRevision + profileSeq 判定过期响应：档案又改了，旧目标结果会被丢弃。
      this.applyView(store.getProfileView(), false); // 不回填表单，避免覆盖未保存的输入
      this.setData({ computing: false });
      if (!outcome.ok) {
        this.setData({ targetError: outcome.message || '目标计算失败' });
        wx.showToast({ title: outcome.message || '目标计算失败', icon: 'none' });
      }
    } catch (error: any) {
      this.setData({ computing: false, targetError: '目标计算异常：' + describeError(error) });
      wx.showToast({ title: '目标计算异常：' + describeError(error), icon: 'none' });
    }
  },

  // 单独入口允许用户手动重算；与保存后自动重算共用 recomputeTarget，并发保护在 computing。
  onComputeTarget() {
    this.recomputeTarget();
  },

  // 输入框统一用 data-field 写 form.<字段>；不做即时校验，保存时统一提示，避免边输边报错。
  onFieldInput(e: any) {
    const field = String(e.currentTarget.dataset.field || '');
    if (field) {
      this.setData({ ['form.' + field]: e.detail.value });
    }
  },

  // 开关值来自 e.detail.value（布尔）；用 !! 归一化，防止 WXML 回传字符串。
  onSwitchChange(e: any) {
    const field = String(e.currentTarget.dataset.field || '');
    if (field) {
      this.setData({ ['form.' + field]: !!e.detail.value });
    }
  },

  onSexChange(e: any) {
    this.setData({ 'form.sexIndex': Number(e.detail.value) });
  },

  onActivityChange(e: any) {
    this.setData({ 'form.activityIndex': Number(e.detail.value) });
  },

  // 目标切换会同步 form.goalType：手动目标区块的显示条件依赖它，不能只改 index。
  onGoalChange(e: any) {
    const view = this.data.view as ProfileView | null;
    if (!view) {
      return;
    }
    const index = Number(e.detail.value);
    const option = view.goalOptions[index];
    if (option) {
      this.setData({ 'form.goalIndex': index, 'form.goalType': option.value });
    }
  },

  onManualSourceChange(e: any) {
    this.setData({ 'form.manualSourceIndex': Number(e.detail.value) });
  },

  /** 返回“我的”：有页面栈则返回，直接打开本页时用 reLaunch 回我的。 */
  onBack() {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }
    wx.reLaunch({ url: '/pages/profile/index' });
  },
});

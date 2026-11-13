/**
 * utils/nutrition-display.ts — 今日页双模式的展示换算（纯函数，无副作用）。
 *
 * 边界（对应 T05U02 卡“营养与文案边界”）：
 * - 只把 store 给出的正式数值换算成“约 ×× 千卡 / 克数 / 供能占比”文案；
 *   不生成营养目标、推荐或补造缺失值，也不读 wx storage。
 * - 热量始终用来源 energyKcal；比例只用契约整数单位（dg）做展示换算：
 *     P = 4 × proteinDg，F = 9 × fatDg，C = 4 × carbDg，T = P + F + C
 *   分母是三种宏量的换算能量总和，不是日目标 composition，也不是克数之和。
 * - 百分比一位小数，用最大余数法分配为合计 100.0%；余数相同按蛋白质、脂肪、碳水顺序。
 *   比例条与表格使用同一组分配结果；三项全已知且 T>0 才给完整比例。
 * - 未知不当 0：缺项返回“待补全”，不画比例条；T=0 时显示已知 0 克与“暂不显示比例”。
 * - 负值/非有限数按无效数据处理，不给比例。
 */

/** 契约宏量字段名（与 T01 v1.2 / store 视图保持一致）。 */
export type MacroKey = 'proteinDg' | 'fatDg' | 'carbDg';

export const MACRO_KEYS: MacroKey[] = ['proteinDg', 'fatDg', 'carbDg'];
export const MACRO_LABELS: Record<MacroKey, string> = {
  proteinDg: '蛋白质',
  fatDg: '脂肪',
  carbDg: '碳水',
};

/** 三种宏量的展示行：克数与供能占比同源同一组分配结果。 */
export interface MacroShareRow {
  key: MacroKey;
  label: string;
  gramsText: string;
  percentText: string;
  /** 比例条宽度百分比（0–100，与 percentText 同源）；无完整比例时为 0。 */
  barPercent: number;
}

export type MacroShareState = 'complete' | 'zero' | 'incomplete' | 'invalid';

export interface MacroShareResult {
  state: MacroShareState;
  rows: MacroShareRow[];
  /** 三项换算热量总和 T（完整/zero 时有意义，其余为 null）。 */
  totalEnergy: number | null;
  /** 是否绘制三段比例条：只有完整比例才画。 */
  showBar: boolean;
  /** 给用户的一句说明（不完整/无效/为零时的原因）。 */
  note: string;
}

/** 热量展示结果：文字、是否未知、是否含估算。 */
export interface EnergyDisplay {
  text: string;
  unknown: boolean;
  estimated: boolean;
}

/** dg（0.1 克）→ 克文案：最多一位小数，去掉无意义的 .0。未知返回“待补全”。 */
export function formatGramsFromDg(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return '待补全';
  }
  return (value / 10).toFixed(1).replace(/\.0$/, '');
}

/** 热量整数 + 估算标记 → “约 600 千卡 / 600 千卡 / 热量待补全”。 */
export function energyDisplay(
  energyKcal: number | null | undefined,
  estimated: boolean,
): EnergyDisplay {
  if (typeof energyKcal !== 'number' || !Number.isFinite(energyKcal) || energyKcal < 0) {
    return { text: '热量待补全', unknown: true, estimated: false };
  }
  const prefix = estimated ? '约 ' : '';
  return { text: `${prefix}${Math.round(energyKcal)} 千卡`, unknown: false, estimated };
}

/** 某餐营养是否含未知项：字段名来自 store 的 incompleteNutrients（如 proteinDg）。 */
export function isMacroIncomplete(incompleteFields: string[], key: MacroKey): boolean {
  return incompleteFields.indexOf(key) >= 0;
}

/**
 * 最大余数法把三项精确占比分配到 0.1% 精度，保证合计 1000 个千分点（=100.0%）。
 * 入参为换算能量（整数或有限小数）；余数相同按传入顺序（蛋白质、脂肪、碳水）。
 * 返回每项千分点（tenths of percent，合计 1000）。
 */
export function allocatePercentTenths(parts: number[]): number[] {
  const total = parts.reduce((sum, part) => sum + part, 0);
  if (!(total > 0)) {
    return parts.map(() => 0);
  }
  // 用整数域计算：p × 1000 / T 的商与余数，避免浮点累加误差影响分配。
  const base = parts.map((part) => Math.floor((part * 1000) / total));
  const remainders = parts.map((part) => (part * 1000) % total);
  let remaining = 1000 - base.reduce((sum, value) => sum + value, 0);
  // 余数从大到小；同余数按原始顺序（蛋白质→脂肪→碳水）。
  const order = parts
    .map((_, index) => index)
    .sort((left, right) => remainders[right] - remainders[left] || left - right);
  let cursor = 0;
  while (remaining > 0) {
    base[order[cursor % order.length]] += 1;
    remaining -= 1;
    cursor += 1;
  }
  return base;
}

/**
 * 完整模式营养区：三项克数 + 一项比例条。
 * knownSums 来自同一份核心餐结果或实际日志汇总；incompleteFields 标明哪些项未知。
 */
export function buildMacroShares(
  knownSums: Record<string, number | null> | null,
  incompleteFields: string[],
): MacroShareResult {
  const fields = Array.isArray(incompleteFields) ? incompleteFields : [];
  const values: Record<MacroKey, number | null> = {
    proteinDg: null,
    fatDg: null,
    carbDg: null,
  };
  let invalid = false;
  for (const key of MACRO_KEYS) {
    const raw = knownSums ? knownSums[key] : null;
    if (fields.indexOf(key) >= 0) {
      // 该项含未知来源，已知小计不能当作完整数值展示（未知不当 0）。
      values[key] = null;
      continue;
    }
    if (typeof raw !== 'number' || !Number.isFinite(raw)) {
      values[key] = null;
      continue;
    }
    if (raw < 0) {
      invalid = true;
      values[key] = null;
      continue;
    }
    values[key] = raw;
  }

  const missing = MACRO_KEYS.filter((key) => values[key] === null);
  const gramsTexts = MACRO_KEYS.map((key) => formatGramsFromDg(values[key]));

  if (invalid) {
    return {
      state: 'invalid',
      rows: MACRO_KEYS.map((key, index) => ({
        key,
        label: MACRO_LABELS[key],
        gramsText: gramsTexts[index],
        percentText: '待补全',
        barPercent: 0,
      })),
      totalEnergy: null,
      showBar: false,
      note: '营养数值异常，暂不显示比例。',
    };
  }

  if (missing.length > 0) {
    return {
      state: 'incomplete',
      rows: MACRO_KEYS.map((key, index) => ({
        key,
        label: MACRO_LABELS[key],
        gramsText: gramsTexts[index],
        percentText: '待补全',
        barPercent: 0,
      })),
      totalEnergy: null,
      showBar: false,
      note: `含未知项（${missing.map((key) => MACRO_LABELS[key]).join('、')}），比例暂不显示。`,
    };
  }

  // 三项全已知：按契约单位换算供能。P=4×proteinDg、F=9×fatDg、C=4×carbDg。
  const parts = [
    values.proteinDg! * 4,
    values.fatDg! * 9,
    values.carbDg! * 4,
  ];
  const total = parts[0] + parts[1] + parts[2];

  if (total === 0) {
    return {
      state: 'zero',
      rows: MACRO_KEYS.map((key, index) => ({
        key,
        label: MACRO_LABELS[key],
        gramsText: gramsTexts[index],
        percentText: '—',
        barPercent: 0,
      })),
      totalEnergy: 0,
      showBar: false,
      note: '三项均为 0 克，暂不显示比例。',
    };
  }

  const tenths = allocatePercentTenths(parts);
  return {
    state: 'complete',
    rows: MACRO_KEYS.map((key, index) => ({
      key,
      label: MACRO_LABELS[key],
      gramsText: gramsTexts[index],
      percentText: `${(tenths[index] / 10).toFixed(1)}%`,
      barPercent: tenths[index] / 10,
    })),
    totalEnergy: total,
    showBar: true,
    note: '比例按三种营养的换算热量计算，可能与标注总热量略有差别。',
  };
}

/**
 * 简易/完整共用的搭配说明，只用已知食物类别（staple/protein/vegetable）。
 * 类别不完整时写“搭配信息待补”，绝不按菜名猜类别，也不给健康分或红绿评级。
 */
export function pairingText(categories: Array<string | null | undefined>): string {
  if (!Array.isArray(categories) || categories.length === 0) {
    return '搭配信息待补';
  }
  const known: Array<'staple' | 'protein' | 'vegetable' | null> = categories.map((category) => {
    if (category === 'staple' || category === 'protein' || category === 'vegetable') {
      return category;
    }
    return null;
  });
  if (known.indexOf(null) >= 0) {
    return '搭配信息待补';
  }
  const set = known as Array<'staple' | 'protein' | 'vegetable'>;
  const hasStaple = set.indexOf('staple') >= 0;
  const hasProtein = set.indexOf('protein') >= 0;
  const hasVegetable = set.indexOf('vegetable') >= 0;
  if (hasStaple && hasProtein && hasVegetable) {
    return '主食、蛋白质食物、蔬菜都有';
  }
  // 设计只点名“缺蔬菜”一种完整情形；其余完整但缺项的事实说明，避免把已知说成待补。
  if (!hasVegetable) {
    return '这份没配蔬菜';
  }
  if (!hasStaple) {
    return '这份没有主食';
  }
  return '这份没有蛋白质食物';
}

/** “自己选菜”入口的已知类别提示（只描述事实，不新增适用性判断）。 */
export function knownCategoriesHint(categories: Array<string | null | undefined>): string {
  if (!Array.isArray(categories) || categories.length === 0) {
    return '当前这餐还没有菜品数据，无法给出搭配提示。';
  }
  const names: string[] = [];
  const seen: Record<string, boolean> = {};
  for (const category of categories) {
    const label =
      category === 'staple' ? '主食' : category === 'protein' ? '蛋白质食物' : category === 'vegetable' ? '蔬菜' : '';
    if (label && !seen[label]) {
      seen[label] = true;
      names.push(label);
    }
  }
  if (names.length === 0) {
    return '当前菜品的食物类别未知，搭配信息待补。';
  }
  return `当前已知：${names.join('、')}。`;
}
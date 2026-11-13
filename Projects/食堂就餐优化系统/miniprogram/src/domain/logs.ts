/**
 * logs.ts — MealLog 汇总、预算核算与记餐视图构造。
 *
 * 规则（PRD 3.1/3.2/3.3、T01 v1.2 §7）：
 *  - 只统计 status=active 的记录；superseded/revoked 仅作历史展示。
 *  - 未知营养按营养素分别显示“不完整”，不用 0 冒充；未知价格同理。
 *  - 计划花费与实际消费分开：actual 只来自当前有效记录。
 *  - 重复确认由 confirmationId 幂等，本文件只负责构造记录，不做去重判断。
 */

import type {
  BudgetView,
  DayRecord,
  IntakeView,
  LogItemView,
  LogView,
  MealLog,
  Meal,
  Nutrition,
  PlannerSettings,
  LogNutrition,
} from './types';
import { MEAL_LABELS, MEALS } from './types';
import { paidSumLabel, plannedSumLabel, paidItemLabel } from '../utils/money-display';

// 读本文件的前提：MealLog 是“已发生的消费事实”，不是推荐方案；方案值来自 PlanResult，
// 这里只把用户确认过的记录汇总成摄入/预算视图，不做推荐或营养公式。

/**
 * 当日有效摄入汇总。knownSums 每项 null 表示“该营养素存在未知项目”，
 * 未知不是 0：后续已知项也不能把 null 变回数字，否则“部分已知”会被误当完整合计。
 * priceKnownCents 只是已知价格小计；priceIncomplete/unknownItemCount 供页面标注“不完整”。
 */
export interface IntakeSummary {
  consumedMeals: Meal[];
  itemCount: number;
  knownSums: {
    energyKcal: number | null;
    proteinDg: number | null;
    fatDg: number | null;
    carbDg: number | null;
  };
  priceKnownCents: number;
  priceIncomplete: boolean;
  unknownItemCount: number;
}

// 四类宏量走同一套“未知即整项 null”的口径；新增营养素需同步字段、页面标签与预算/目标映射。
const NUTRIENT_KEYS: (keyof Nutrition)[] = ['energyKcal', 'proteinDg', 'fatDg', 'carbDg'];

/**
 * 汇总当前有效记录（status=active）；superseded/revoked 仅作历史展示，不计入摄入与消费。
 * quantity<=0 按 1 处理是防御旧数据/手工编辑的兜底，不改变已写入记录。
 * 返回的 consumedMeals 按 MEALS 固定顺序去重，页面不需要再排序。
 */
export function summarizeActiveLogs(day: DayRecord): IntakeSummary {
  const active = day.logs.filter((log) => log.status === 'active');
  const sums: Record<string, number | null> = { energyKcal: 0, proteinDg: 0, fatDg: 0, carbDg: 0 };
  let itemCount = 0;
  let priceKnownCents = 0;
  let priceIncomplete = false;
  let unknownItemCount = 0;
  const consumed: Meal[] = [];

  for (const log of active) {
    // 只记录出现过有效记录的餐次，空餐次不进入摘要。
    if (consumed.indexOf(log.meal) < 0) {
      consumed.push(log.meal);
    }
    for (const item of log.items) {
      const quantity = item.quantity > 0 ? item.quantity : 1;
      itemCount += quantity;
      let itemUnknown = false;
      // 已知价按数量累加；未知价只标记“不完整”，不把缺失值当 0 计入金额。
      if (item.priceKnown && item.unitPriceCents !== null) {
        priceKnownCents += item.unitPriceCents * quantity;
      } else {
        priceIncomplete = true;
        itemUnknown = true;
      }
      // 营养块整体缺失时四项一起置 null，避免只缺一项却仍显示能量合计。
      if (item.nutrition === null) {
        for (const key of NUTRIENT_KEYS) {
          sums[key] = null;
        }
        itemUnknown = true;
      } else {
        for (const key of NUTRIENT_KEYS) {
          const value = item.nutrition[key];
          if (value === null || value === undefined) {
            sums[key] = null;
            itemUnknown = true;
          } else if (sums[key] !== null) {
            sums[key] = (sums[key] as number) + value * quantity;
          }
        }
      }
      // 未知项计数用于页面提示“N 项未知”，不参与金额或营养求和。
      if (itemUnknown) {
        unknownItemCount += 1;
      }
    }
  }

  return {
    consumedMeals: MEALS.filter((meal) => consumed.indexOf(meal) >= 0),
    itemCount,
    knownSums: {
      energyKcal: sums.energyKcal,
      proteinDg: sums.proteinDg,
      fatDg: sums.fatDg,
      carbDg: sums.carbDg,
    },
    priceKnownCents,
    priceIncomplete,
    unknownItemCount,
  };
}

/**
 * 月度汇总（只读视图，不新增持久化）：只统计当前业务日期里 status=active 的实际记录。
 *
 * 口径（P01 定稿 v2 第 11 节）：
 *  - 天数为“有有效记录的不同的业务日期”数量；
 *  - 餐数为“不同的 (businessDate, meal) 组合”数量：同一天同一餐多次补记只算一餐；
 *  - 花费/热量只加已知值，任一未知项把对应行标成“含未填项”，未知不按 0；
 *  - 计划、推荐结果、待吃餐次不进入统计（它们不在 MealLog 里，本函数也只看 logs）。
 * activeDates 同时给月历做“有记录”标记，避免页面另算一份有效日期集合。
 */
export interface MonthLogsSummary {
  month: string;
  activeDates: string[];
  dayCount: number;
  mealCount: number;
  knownPriceCents: number;
  priceIncomplete: boolean;
  knownEnergyKcal: number;
  energyIncomplete: boolean;
  hasRecords: boolean;
}

export function summarizeMonthLogs(
  month: string,
  days: { businessDate: string; day: DayRecord }[],
): MonthLogsSummary {
  const summary: MonthLogsSummary = {
    month,
    activeDates: [],
    dayCount: 0,
    mealCount: 0,
    knownPriceCents: 0,
    priceIncomplete: false,
    knownEnergyKcal: 0,
    energyIncomplete: false,
    hasRecords: false,
  };
  const prefix = `${month}-`;
  for (const entry of days || []) {
    if (!entry || typeof entry.businessDate !== 'string' || entry.businessDate.slice(0, 7) !== month) {
      continue;
    }
    if (entry.businessDate.slice(0, prefix.length) !== prefix) {
      continue;
    }
    const day = entry.day;
    if (!day) {
      continue;
    }
    const intake = summarizeActiveLogs(day);
    if (intake.consumedMeals.length === 0) {
      continue;
    }
    summary.activeDates.push(entry.businessDate);
    summary.dayCount += 1;
    // consumedMeals 已按 MEALS 去重：同一天同一餐的多条补记只贡献 1 个组合。
    summary.mealCount += intake.consumedMeals.length;
    summary.knownPriceCents += intake.priceKnownCents;
    if (intake.priceIncomplete) {
      summary.priceIncomplete = true;
    }
    if (intake.knownSums.energyKcal === null) {
      summary.energyIncomplete = true;
    } else {
      summary.knownEnergyKcal += intake.knownSums.energyKcal;
    }
  }
  summary.activeDates.sort();
  summary.hasRecords = summary.dayCount > 0;
  return summary;
}

// 展示层只把 null 翻成“未知”，绝不做 0 兜底；数值与标签必须来自同一份 null 判定。
function kcalLabel(value: number | null): string {
  return value === null ? '未知' : `${value} kcal`;
}
// 蛋白质/脂肪/碳水内部单位为 0.1g，展示时除 10 保留一位小数，避免页面各自换算。
function gramLabel(value: number | null): string {
  return value === null ? '未知' : `${(value / 10).toFixed(1)} g`;
}

// 把缺失的营养素翻成中文标签列表，页面据此显示“不完整：能量/蛋白质…”。
// 数值字段与展示标签同时返回，避免页面各自格式化导致口径不一致。
export function buildIntakeView(day: DayRecord): IntakeView {
  const summary = summarizeActiveLogs(day);
  const incomplete: string[] = [];
  if (summary.knownSums.energyKcal === null) incomplete.push('能量');
  if (summary.knownSums.proteinDg === null) incomplete.push('蛋白质');
  if (summary.knownSums.fatDg === null) incomplete.push('脂肪');
  if (summary.knownSums.carbDg === null) incomplete.push('碳水');
  return {
    consumedMeals: summary.consumedMeals,
    itemCount: summary.itemCount,
    energyKcal: summary.knownSums.energyKcal,
    proteinDg: summary.knownSums.proteinDg,
    fatDg: summary.knownSums.fatDg,
    carbDg: summary.knownSums.carbDg,
    incompleteNutrients: incomplete,
    priceKnownCents: summary.priceKnownCents,
    priceIncomplete: summary.priceIncomplete,
    unknownItemCount: summary.unknownItemCount,
    energyLabel: kcalLabel(summary.knownSums.energyKcal),
    proteinLabel: gramLabel(summary.knownSums.proteinDg),
    fatLabel: gramLabel(summary.knownSums.fatDg),
    carbLabel: gramLabel(summary.knownSums.carbDg),
  };
}

// 分→元展示（两位小数），只用于标签；所有计算与比较仍在“分”的整数域完成。
function money(cents: number): string {
  return `￥${(cents / 100).toFixed(2)}`;
}

/**
 * 从 PlanResult.plans[selected].budget 摘出的预算事实，不在前端重算：
 * overBudget/withinBudgetKnown 是核心给出的判断，前端只负责与本地消费合并展示。
 * remainingBudgetKnownCents/plannedTotalCents 可能因未知价格而为 null，页面不得补 0。
 * checkBasis 保留核心的校验依据（如 known_only），展示以便排查判断口径。
 */
export interface PlanBudgetInput {
  budgetCents: number | null;
  remainingBudgetKnownCents: number | null;
  plannedTotalCents: number | null;
  plannedTotalKnownCents: number | null;
  priceIncomplete: boolean;
  overBudget: boolean;
  withinBudgetKnownAmounts: boolean;
  overageCents: number | null;
  checkBasis: string;
}

/**
 * 构造预算视图：计划花费（来自核心方案）与实际消费（来自本地 active 记录）分开。
 * 未设置预算时仍展示计划总价与实际消费，但不得声称“预算内”。
 * 数据来自两条独立来源，二者不能混算：计划侧是“将要花”，实际侧是“已经花”。
 * 只有预算已设置、且计划价与实际消费都不含未知价时，才可能给出 withinBudgetKnown；
 * 其余情况只能说“信息不足/不完整”，文案不得暗示“在预算内”。
 * remainingKnown 用 max(0, …) 防止负数展示，超出金额由 overageCents 单独表达。
 */
export function buildBudgetView(
  settings: PlannerSettings,
  day: DayRecord,
  planBudget: PlanBudgetInput | null,
): BudgetView {
  const intake = summarizeActiveLogs(day);
  const budgetSet = settings.budgetCents !== null && settings.budgetCents !== undefined;
  const spentKnown = intake.priceKnownCents;
  const spentIncomplete = intake.priceIncomplete;
  const remainingKnown = budgetSet && !spentIncomplete ? Math.max(0, (settings.budgetCents as number) - spentKnown) : null;

  const plannedKnown = planBudget && typeof planBudget.plannedTotalKnownCents === 'number' ? planBudget.plannedTotalKnownCents : 0;
  const plannedTotal = planBudget ? planBudget.plannedTotalCents : null;
  const plannedIncomplete = planBudget ? !!planBudget.priceIncomplete : false;

  // 任一来源命中超支即为超支：核心判断与实际消费任一超预算都要提示，宁可保守。
  const overBudget =
    (budgetSet && spentKnown > (settings.budgetCents as number)) ||
    (plannedKnown > 0 && (
      (remainingKnown !== null && plannedKnown > remainingKnown) ||
      (!!planBudget && planBudget.overBudget === true)
    ));

  // 必须同时满足“预算已设 + 金额完整 + 计划价 <= 剩余 + 未超支”，否则不得声称预算内。
  const withinBudgetKnown =
    budgetSet &&
    remainingKnown !== null &&
    !plannedIncomplete &&
    plannedTotal !== null &&
    plannedTotal <= remainingKnown &&
    !overBudget;

  const totalKnown = spentKnown + plannedKnown;
  const overageCents = budgetSet && !spentIncomplete && !plannedIncomplete
    ? Math.max(0, totalKnown - (settings.budgetCents as number))
    : remainingKnown !== null
      ? Math.max(0, plannedKnown - remainingKnown)
      : null;
  // 核算完整性只看两侧价格是否都有未知项；与“是否超支”是两个维度。
  const accountingComplete = budgetSet && !spentIncomplete && !plannedIncomplete;

  // 文案按“未设置 → 不完整 → 超支 → 预算内 → 信息不足”的优先级命中，保证任何情况下
  // 都有明确结论；未设预算与金额不完整都不得输出“在预算内”。
  let message: string;
  if (!budgetSet) {
    message = '未设置全天预算；以下只展示计划总价与实际消费，不声称预算内。';
  } else if (spentIncomplete || plannedIncomplete) {
    message = '预算核算不完整：存在未知价格项，已知支出/计划价仅作小计，不能声称在预算内。';
  } else if (overBudget) {
    const spentOver = budgetSet && spentKnown > (settings.budgetCents as number);
    if (spentOver && plannedKnown === 0) {
      message = `已超出预算：实际消费 ${money(spentKnown)} 已超出全天预算 ${money(settings.budgetCents as number)}（超支 ${money(overageCents !== null ? overageCents : spentKnown - (settings.budgetCents as number))}）。`;
    } else if (spentOver) {
      // 已吃本身已超支与待吃计划的额外压力分开说：即使计划为 0，这天也已超支；
      // overageCents 仍是“已吃+计划”的全天预计超额合计，不在这里重算。
      message = `已超出预算：实际消费 ${money(spentKnown)} 已超全天预算（仅已吃即超支 ${money(spentKnown - (settings.budgetCents as number))}）；另有计划 ${money(plannedKnown)} / 剩余可用 ${remainingKnown === null ? '未知' : money(remainingKnown)}，全天预计合计超 ${money(overageCents !== null ? overageCents : spentKnown + plannedKnown - (settings.budgetCents as number))}，请调整或明确接受加价备选。`;
    } else {
      message = `已超出预算：计划 ${money(plannedKnown)} / 剩余可用 ${remainingKnown === null ? '未知' : money(remainingKnown)}，请调整或明确接受加价备选。`;
    }
  } else if (withinBudgetKnown) {
    message = `按已知金额在预算内：计划 ${money(plannedKnown)}，剩余可用 ${remainingKnown === null ? '未知' : money(remainingKnown)}。`;
  } else {
    message = '预算信息不足以判断是否在预算内。';
  }

  return {
    budgetSet,
    budgetCents: settings.budgetCents,
    budgetLabel: budgetSet ? money(settings.budgetCents as number) : '未设置',
    plannedTotalCents: plannedTotal,
    plannedKnownCents: plannedKnown,
    plannedPriceIncomplete: plannedIncomplete,
    spentKnownCents: spentKnown,
    spentPriceIncomplete: spentIncomplete,
    unknownPriceItemCount: intake.unknownItemCount,
    remainingKnownCents: remainingKnown,
    remainingKnown: remainingKnown !== null,
    overBudget,
    withinBudgetKnown,
    overageCents,
    checkBasis: planBudget ? planBudget.checkBasis : 'known_only',
    accountingComplete,
    message,
    plannedLabel: plannedTotal === null ? '无方案' : plannedSumLabel(plannedKnown, plannedIncomplete),
    // 实付汇总走统一文案：部分已知写“已知实付 ￥X（含未填项）”，全未知写“实付待补全”，
    // 真实 0 元仍显示 ￥0.00；不再用“（不完整）”当花费金额。
    spentLabel: paidSumLabel(spentKnown, spentIncomplete),
  };
}

// 三态都保留在 logs 里供审计：active 参与汇总，superseded/revoked 只出现在历史区。
const STATUS_LABELS: Record<string, string> = {
  active: '有效',
  superseded: '已被修改替代',
  revoked: '已撤销',
};

// 单条记录的营养展示：null 项不补 0，缺失项直接省略；四项全缺才显示“营养未知”。
function logNutritionToView(nutrition: LogNutrition | null): string {
  if (!nutrition) {
    return '营养未知';
  }
  const parts: string[] = [];
  if (nutrition.energyKcal !== null) parts.push(`${nutrition.energyKcal} kcal`);
  if (nutrition.proteinDg !== null) parts.push(`蛋白 ${(nutrition.proteinDg / 10).toFixed(1)}g`);
  if (nutrition.fatDg !== null) parts.push(`脂肪 ${(nutrition.fatDg / 10).toFixed(1)}g`);
  if (nutrition.carbDg !== null) parts.push(`碳水 ${(nutrition.carbDg / 10).toFixed(1)}g`);
  return parts.length > 0 ? parts.join('，') : '营养未知';
}

// 记录视图按“当时快照”渲染：名称/价格/营养来自 nameSnapshot 与记录本身，
// 菜单后续改版或方案重算都不会改写历史；knownSums 只对该记录 items 求和，不含其他餐次。
// priceIncomplete/unknownItemCount 随记录保留，页面据此标注“不完整”。
export function buildLogView(log: MealLog): LogView {
  const items: LogItemView[] = log.items.map((item) => ({
    itemKey: item.itemKey,
    name: item.nameSnapshot,
    portionLabel: item.portionCode === 'half' ? '半份' : '整份',
    quantity: item.quantity,
    sourceLabel: item.source === 'manual' ? '手动补记' : '菜单',
    unitPriceCents: item.unitPriceCents,
    priceKnown: item.priceKnown,
    // 已记录项的实付未知写“实付未填”，不再显示成 ￥0.00 或“价格未知”。
    priceLabel: paidItemLabel(item.priceKnown, item.unitPriceCents),
    nutrition: item.nutrition,
    energyLabel: item.nutrition && item.nutrition.energyKcal !== null ? `${item.nutrition.energyKcal} kcal` : '营养未知',
  }));
  const knownSums: LogNutrition = { energyKcal: 0, proteinDg: 0, fatDg: 0, carbDg: 0 };
  let priceKnownCents = 0;
  let priceIncomplete = false;
  let unknownItemCount = 0;
  for (const item of log.items) {
    const quantity = item.quantity > 0 ? item.quantity : 1;
    let itemUnknown = false;
    // 已知价累加、未知价只标记不完整：单条记录内部同样不把未知当 0。
    if (item.priceKnown && item.unitPriceCents !== null) {
      priceKnownCents += item.unitPriceCents * quantity;
    } else {
      priceIncomplete = true;
      itemUnknown = true;
    }
    // 与当日汇总同口径：任一 item 营养未知，则该营养素置 null 且保持 null。
    if (!item.nutrition) {
      for (const key of NUTRIENT_KEYS) {
        knownSums[key] = null;
      }
      itemUnknown = true;
    } else {
      for (const key of NUTRIENT_KEYS) {
        const value = item.nutrition[key];
        if (value === null || value === undefined) {
          knownSums[key] = null;
          itemUnknown = true;
        } else if (knownSums[key] !== null) {
          knownSums[key] = (knownSums[key] as number) + value * quantity;
        }
      }
    }
    if (itemUnknown) {
      unknownItemCount += 1;
    }
  }
  // 只展示已知宏量；未知项在标签中省略，但 knownSums 对应字段保持 null。
  const energyLabel = logNutritionToView(knownSums);
  return {
    recordId: log.recordId,
    confirmationId: log.confirmationId,
    meal: log.meal,
    status: log.status,
    statusLabel: STATUS_LABELS[log.status] || log.status,
    revision: log.revision,
    createdAt: log.createdAt,
    updatedAt: log.updatedAt,
    items,
    knownSums,
    knownEnergyLabel: energyLabel,
    priceKnownCents,
    priceIncomplete,
    unknownItemCount,
    supersedesRecordId: log.supersedesRecordId,
    menuVersion: log.menuVersion,
  };
}

// 未知 meal 原样返回，避免把 undefined 渲染到界面。
export function mealLabel(meal: Meal): string {
  return MEAL_LABELS[meal] || meal;
}

/**
 * 记录 ID 的稳定格式（时间戳 base36 + 后缀），需全局唯一：同毫秒多次确认靠 suffix 区分。
 * 它只是存储标识，不承担幂等；幂等由 confirmationId 负责，不要拿 recordId 当业务键。
 */
export function makeRecordId(now: Date, suffix: string): string {
  return `rec-${now.getTime().toString(36)}-${suffix}`;
}

// 非计划来源（如 UI 重试、手工补记）的幂等键生成器：每次调用都产生新值，
// 调用方必须把同一用户动作绑定到同一个 confirmationId 才能真正去重；
// 查重发生在 store（按 confirmationId 查找已有记录），本函数不查重。
export function makeConfirmationId(now: Date): string {
  return `conf-${now.getTime().toString(36)}-${Math.floor(Math.random() * 1e9).toString(36)}`;
}

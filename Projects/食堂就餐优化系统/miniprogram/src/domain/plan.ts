/**
 * plan.ts — PlanRequest 构造、锁定/售罄前置校验与 PlanResult 字段映射。
 *
 * 关键边界：
 *  - 只发送当前受支持子集：algorithm=设置里的 greedy / dp / branchAndBound、catalog.comboRules=[]；能力检查在 store 层调用。
 *  - 请求使用统一核心（A11）契约 §4 的必填搜索限额 plannerConfig.limits
 *    {maxMealCandidatesPerMeal,maxDpStates,maxSearchNodes,wallClockMs}；旧 T02 别名
 *    maxCandidates/maxNodes 已被核心明确拒绝（T05N02 由用户放行本文件最小改动）。
 *  - 核心不校验“锁定项是否在该餐供应”，因此前端必须在调用前校验锁定有效性；
 *    失效锁定保留记录并返回 LockConflict，不静默解锁。
 *  - 本文件只映射结果字段与状态，不补算营养/预算；未知不当零。
 *
 * 视图层三条不变量（改这个文件时最容易踩）：
 *  1. "售罄"必须带窗口：计划项只有 offerId/dishId，窗口要从报价反查后比 windowId；
 *     只按 dishId 会把 A 窗售罄误标到 B 窗同菜推荐上。
 *  2. "锁定有效"与"锁定项会进方案"是两件事：旧 T02 v2 子集只校验锁定项存在/供应/未售罄，
 *     greedy 不保证把锁定项纳入方案；视图不能假设 locked=true 就一定有该 item。
 *  3. 未知 ≠ 0：价格/营养未知时汇总用 null + 不完整标志表达，不参与精确小计，
 *     也不能在 UI 上显示成"￥0.00"或"0 kcal"。
 */

import type {
  BudgetView,
  Catalog,
  DayRecord,
  IntakeView,
  ItemView,
  Meal,
  MealView,
  Nutrition,
  PlanSummaryView,
  PlannerSettings,
  ProfileDraft,
} from './types';
import { MEALS, MEAL_LABELS, STRATEGY_LABELS, SUPPORTED_ALGORITHMS, isSupportedAlgorithm } from './types';
import type { PlanBudgetInput } from './logs';
import { buildBudgetView, buildIntakeView, summarizeActiveLogs } from './logs';
import { buildNutritionConfigRequest, NUTRITION_CONFIG_HASH } from '../config/nutrition-config';
import { toProfileRequest } from './profile';
import { isMealEnded } from './app-state';
import { priceLabel as planPriceLabel, paidItemLabel, PRICE_PENDING, PAID_PENDING } from '../utils/money-display';

/**
 * 一条失效/冲突锁定。页面用它渲染 LockConflict 的原因，并精确解除：
 * 窗口锁填 windowId、菜品锁填 offerId；reason 是给人看的中文原因（含窗口名），
 * 不直接暴露内部 ID 给用户当唯一信息。
 */
export interface LockIssue {
  kind: 'window' | 'item';
  meal: Meal;
  label: string;
  reason: string;
  /** 便于页面精确解除锁定；窗口锁定填 windowId，菜品锁定填 offerId。 */
  windowId?: string | null;
  offerId?: string | null;
}

/**
 * PlanResult 的完整视图映射。除 envelope/requestId 外都是现算派生值，不持久化：
 * 持久化只存核心原始 rawText，因此换选中备选、锁定变化、售罄变化后都重新 interpret，
 * 不会出现"持久化视图"和"原始响应"两份真相不一致。
 */
export interface PlanInterpretation {
  status: string;
  statusLabel: string;
  message: string;
  envelope: any;
  meals: MealView[];
  plans: PlanSummaryView[];
  selectedIndex: number;
  budgetInput: PlanBudgetInput | null;
  intake: IntakeView;
  budget: BudgetView;
  diagnostics: { code: string; message: string }[];
  flags: string[];
  requestId: string | null;
  planCreatedAt: string | null;
}

/** 核心 status 的中文标签；未收录的新状态按原样展示，不静默吞掉。 */
const STATUS_LABELS: Record<string, string> = {
  Ok: '方案完整',
  OkPartial: '有方案但存在限制标志',
  NoFeasible: '没有合法方案',
  NoFeasibleWithinBudget: '预算内无解（展示加价备选）',
  NutritionDataInsufficient: '营养数据不足',
  ResourceLimited: '触及搜索限额（未证明无解）',
  LockConflict: '锁定失效/冲突，需用户先处理',
  TargetUnavailable: '营养目标不可用，不做自动规划',
};

/** 核心 diagnostics.code 的中文解释；未知 code 原样保留，便于排查新核心的诊断。 */
const DIAGNOSTIC_LABELS: Record<string, string> = {
  TARGET_NOT_APPLICABLE: '营养目标不适用于自动规划',
  LOCK_CONFLICT: '锁定项失效或冲突',
  SEARCH_LIMIT_REACHED: '搜索限额耗尽',
};

/**
 * 核心 flag 的中文标签。flag 是"方案可用但有前提"的提示（估算、未知、限额、不足三方案等），
 * 不是错误；页面必须成组展示，避免用户只看到方案却不知道数据不完整。
 */
const FLAG_LABELS: Record<string, string> = {
  NUTRITION_INCOMPLETE: '含未知营养项（汇总不完整）',
  PRICE_INCOMPLETE: '含未知价格项',
  ESTIMATED_DATA: '含估算数据',
  BUDGET_ACCOUNTING_INCOMPLETE: '预算核算不完整',
  SEARCH_LIMIT_REACHED: '触及搜索限额',
  FEWER_THAN_THREE_PLANS: '不足三套不同合法方案',
  LOCKED_UNKNOWN_NUTRITION: '锁定项营养未知',
  OVER_BUDGET_ALTERNATIVE: '超预算备选',
  // 核心对 DP 状态离散化/候选截断/墙钟超时给出的近似声明码：明确写“未证明最优”，不给假最优。
  APPROXIMATE_CANDIDATES: '近似结果：候选被候选限额截断（未证明最优）',
  APPROXIMATE_DISCRETIZATION: '近似结果：DP 状态被离散化/截断（未证明最优）',
  APPROXIMATE_TIMEOUT: '近似结果：触及时限（未证明最优）',
};

/**
 * flag → 中文标签。APPROXIMATE_* 是前缀族（截断/剪枝产生的近似结果），统一标"近似"；
 * 其余未收录 flag 原样返回，宁可露出英文码也不隐藏信息。
 */
export function flagLabel(code: string): string {
  if (FLAG_LABELS[code]) {
    return FLAG_LABELS[code];
  }
  if (code.indexOf('APPROXIMATE_') === 0) {
    return '近似结果（截断/剪枝）';
  }
  return code;
}

/** 金额显示：null/undefined 显示“—”（未知），绝不显示成 ￥0.00；分转元保留两位。 */
function money(cents: number | null): string {
  if (cents === null || cents === undefined) {
    return '—';
  }
  return `￥${(cents / 100).toFixed(2)}`;
}

/**
 * 当前受支持能力检查：只允许 greedy / dp / branchAndBound + comboRules=[]。
 * 这里只返回原因字符串，不在本文件抛错/降级：是否阻止调用由 store 决定，
 * 这样同一份检查既能用于规划前拦截，也能用于首页"当前不支持"提示。
 */
export function checkCapability(catalog: Catalog, settings: PlannerSettings): string | null {
  if (!isSupportedAlgorithm(settings.algorithm)) {
    return `当前只支持 algorithm=${SUPPORTED_ALGORITHMS.map((value) => `"${value}"`).join(' / ')}，收到 ${String(settings.algorithm)}`;
  }
  if (!catalog || !Array.isArray(catalog.comboRules)) {
    return '菜单缺少 comboRules 数组，无法确认是否为空';
  }
  if (catalog.comboRules.length > 0) {
    return `当前只支持 comboRules=[]，菜单含 ${catalog.comboRules.length} 条套餐规则`;
  }
  return null;
}

/**
 * 菜单是否能供应某餐（至少一个窗口的 mealWindows 包含该餐）。
 * 判断是"窗口级"的：只要还有一个窗口供应，该餐就应参与规划，
 * 不能因为某个窗口不供应就把整餐标成无供应。
 */
export function mealHasSupply(catalog: Catalog, meal: Meal): boolean {
  return (catalog.windows || []).some((window) => window.mealWindows.indexOf(meal) >= 0);
}

/**
 * 参与本轮规划的餐次：有供应、未被用户结束、没有 active 记餐。
 * "已确认"用 logs 里是否有 active 记录判断，而不是看 endedMeals：
 * 确认是"已吃"，结束是"不吃了"，两者都不再规划，但语义和后续操作不同。
 */
export function planningMeals(day: DayRecord, catalog: Catalog): Meal[] {
  return MEALS.filter((meal) => {
    if (!mealHasSupply(catalog, meal)) return false;
    if (isMealEnded(day, meal)) return false;
    return !day.logs.some((log) => log.meal === meal && log.status === 'active');
  });
}

/**
 * 剩余餐次推荐是否已过期（派生标记，不持久化、不自动重算）。
 *
 * 为什么需要它：计划是一次核心调用的结果，只存 rawText；之后用户又确认/自选/补记了
 * 实际摄入，后续餐次的推荐仍是按"当时还没吃"算出来的。此时不能静默重算（用户没点刷新），
 * 也不能让旧推荐冒充最新结果；正确做法是标出"需更新"并复用现有"刷新方案"入口，
 * 由用户主动触发一次新的 PlanDay 调用。
 *
 * needsUpdate 只在三件事同时成立时为 true：有可读的计划原文、仍有待规划餐次、
 * 且计划生成之后又写入过有效记录（用 createdAt 比较，不新增任何持久化字段）。
 */
export interface PlanUpdateState {
  needsUpdate: boolean;
  meals: Meal[];
  message: string;
}

export function planUpdateState(day: DayRecord, catalog: Catalog): PlanUpdateState {
  const remaining = planningMeals(day, catalog);
  if (!day.plan || !day.plan.rawText || remaining.length === 0) {
    return { needsUpdate: false, meals: [], message: '' };
  }
  const planAt = Date.parse(day.plan.createdAt);
  const hasNewerLog = day.logs.some((log) => {
    if (log.status !== 'active') {
      return false;
    }
    const logAt = Date.parse(log.createdAt);
    // 时间戳不可解析时按"更新过"处理：宁可提示刷新，也不把可能过期的推荐当成最新。
    return Number.isFinite(planAt) ? logAt > planAt : true;
  });
  if (!hasNewerLog) {
    return { needsUpdate: false, meals: [], message: '' };
  }
  return {
    needsUpdate: true,
    meals: remaining,
    message: `已有新的实际记录：${remaining.map((meal) => MEAL_LABELS[meal]).join('、')}的推荐需要更新。点击"刷新方案"按实际摄入重算，系统不会在后台静默重算。`,
  };
}

/**
 * 校验窗口锁定与菜品锁定是否仍指向可供应、未售罄的稳定 ID。
 *
 * 为什么必须前端做：旧 T02 v2 核心不校验"锁定项是否在该餐供应"等场景，
 * 直接把失效锁定发过去可能得到无方案或错误占位；这里提前给出 issue，
 * store 据此返回 LockConflict 并保留锁定记录（不静默解锁）。
 *
 * 判断顺序（窗口锁）：
 *   窗口不存在 → 窗口不供应此餐；
 * 判断顺序（菜品锁）：
 *   报价不存在 → 菜品不存在 → 窗口不存在 → 报价不供应此餐 → 报价所属窗口该菜售罄。
 * 售罄键是 (meal, windowId, dishId)：同菜在别的窗口售罄不算本锁定失效。
 */
export function validateLocks(day: DayRecord, catalog: Catalog): LockIssue[] {
  const issues: LockIssue[] = [];
  const offers = new Map<string, any>();
  for (const offer of catalog.offers || []) {
    offers.set(offer.offerId, offer);
  }
  const dishes = new Map<string, any>();
  for (const dish of catalog.dishes || []) {
    dishes.set(dish.dishId, dish);
  }
  const windows = new Map<string, any>();
  for (const window of catalog.windows || []) {
    windows.set(window.windowId, window);
  }
  const soldOutKey = (meal: Meal, windowId: string, dishId: string) => `${meal}|${windowId}|${dishId}`;
  const soldOut = new Set(day.soldOut.map((mark) => soldOutKey(mark.meal, mark.windowId, mark.dishId)));

  for (const lock of day.windowLocks) {
    const window = windows.get(lock.windowId);
    if (!window) {
      issues.push({ kind: 'window', meal: lock.meal, label: lock.windowId, reason: `窗口 ${lock.windowId} 已不在菜单中`, windowId: lock.windowId });
    } else if (window.mealWindows.indexOf(lock.meal) < 0) {
      issues.push({
        kind: 'window',
        meal: lock.meal,
        label: window.name || lock.windowId,
        reason: `${window.name || lock.windowId} 不供应${MEAL_LABELS[lock.meal]}`,
        windowId: lock.windowId,
      });
    }
  }

  for (const lock of day.itemLocks) {
    const offer = offers.get(lock.offerId);
    if (!offer) {
      issues.push({
        kind: 'item',
        meal: lock.meal,
        label: lock.offerId,
        reason: `锁定菜品报价 ${lock.offerId} 已不在菜单中`,
        offerId: lock.offerId,
      });
      continue;
    }
    const dish = dishes.get(offer.dishId);
    const window = windows.get(offer.windowId);
    const name = dish ? dish.name : offer.dishId;
    if (!dish) {
      issues.push({ kind: 'item', meal: lock.meal, label: name, reason: `菜品 ${offer.dishId} 已不在菜单中`, offerId: lock.offerId });
      continue;
    }
    if (!window) {
      issues.push({ kind: 'item', meal: lock.meal, label: name, reason: `窗口 ${offer.windowId} 已不在菜单中`, offerId: lock.offerId });
      continue;
    }
    if (offer.mealWindows.indexOf(lock.meal) < 0) {
      issues.push({
        kind: 'item',
        meal: lock.meal,
        label: name,
        reason: `${MEAL_LABELS[lock.meal]}不供应「${name}」`,
        offerId: lock.offerId,
      });
      continue;
    }
    if (soldOut.has(soldOutKey(lock.meal, offer.windowId, offer.dishId))) {
      // 只把“锁定报价自身窗口”的售罄算作冲突；同一道菜在其他窗口售罄不影响该锁定。
      issues.push({
        kind: 'item',
        meal: lock.meal,
        label: name,
        reason: `「${name}」在窗口「${window.name || offer.windowId}」已标记售罄`,
        offerId: lock.offerId,
      });
    }
  }
  return issues;
}

/**
 * PlanRequest 构造结果。request 是发核心的完整 JSON；其余字段是"构造时的判定快照"，
 * 供 store 在不调用核心时直接返回可读原因，也供测试核对请求与状态一致。
 */
export interface PlanRequestBuild {
  request: any;
  requestId: string;
  planningMeals: Meal[];
  lockIssues: LockIssue[];
  capabilityError: string | null;
  profileRevision: number;
}

/**
 * 构造完整 PlanRequest；不满足前提时返回可读原因而不是抛错。
 *
 * 契约注意（统一核心 A11）：
 *  - algorithm 取 state.settings.algorithm（当前受支持 greedy / dp / branchAndBound）；plannerConfig.limits 为必填对象，只发契约 §4 的四个规范字段
 *    （旧 maxCandidates/maxNodes 别名会被核心拒绝，且与"每餐候选上限"语义不同，不做映射）；
 *  - state 里只放"本轮待规划餐次"的售罄/窗口锁/菜品锁：已确认/已结束餐次不再参与，
 *    把它们发过去会让核心误判冲突或浪费搜索；
 *  - soldOut 逐条重排字段（businessDate/windowId/meal/dishId），不直接传内部对象，
 *    防止以后内部加字段意外进入契约；
 *  - requestId 形如 req-{业务日期}-{seq}，与 store.planSeq 对应，用于日志/证据核对。
 */
export function buildPlanRequest(
  state: { profileDraft: ProfileDraft | null; profileId: string | null; profileRevision: number; settings: PlannerSettings },
  day: DayRecord,
  catalog: Catalog,
  seq: number,
  now: Date,
): PlanRequestBuild {
  const meals = planningMeals(day, catalog);
  const lockIssues = validateLocks(day, catalog);
  const capabilityError = checkCapability(catalog, state.settings);
  // requestId 携带业务日期与递增序号：同一天内不重号，便于日志对账；核心不参与任何业务判定，
  // 仅校验稳定 ID 语法后原样回显在响应信封（RunContractEntry），不做去重或幂等处理。
  const requestId = `req-${day.businessDate}-${seq}`;
  const request: any = {
    contractVersion: '1.0',
    requestId,
    businessDate: day.businessDate,
    tzOffsetMinutes: day.tzOffsetMinutes,
    profile: state.profileDraft
      ? toProfileRequest(state.profileDraft, state.profileId || 'p-local', state.profileRevision)
      : null,
    catalog,
    nutritionConfig: buildNutritionConfigRequest(),
    plannerConfig: {
      algorithm: state.settings.algorithm,
      strategies: state.settings.strategies,
      budgetCents: state.settings.budgetCents,
      maxItemsPerMeal: state.settings.maxItemsPerMeal,
    },
    planningMeals: meals,
    state: {
      // 只把与待规划餐次相关的状态送核心；已确认/已结束餐次不再参与规划。
      soldOut: day.soldOut
        .filter((mark) => meals.indexOf(mark.meal) >= 0)
        .map((mark) => ({
          businessDate: mark.businessDate,
          windowId: mark.windowId,
          meal: mark.meal,
          dishId: mark.dishId,
        })),
      windowLocks: day.windowLocks.filter((lock) => meals.indexOf(lock.meal) >= 0),
      itemLocks: day.itemLocks.filter((lock) => meals.indexOf(lock.meal) >= 0),
      endedMeals: day.endedMeals.slice(),
      activeLogs: day.logs.filter((log) => log.status === 'active'),
    },
  };
  // 统一核心要求 limits 必填且只用规范四字段（契约 §4 样例的确定性限额）；
  // 核心不设默认值，缺字段或旧别名直接 INVALID_INPUT，故这里始终发送。
  request.plannerConfig.limits = {
    maxMealCandidatesPerMeal: 256,
    maxDpStates: meals.length === 3 ? 32 : 20000,
    maxSearchNodes: 200000,
    wallClockMs: null,
  };
  return {
    request,
    requestId,
    planningMeals: meals,
    lockIssues,
    capabilityError,
    profileRevision: state.profileRevision,
  };
}

/** 份量显示码 → 中文；未知码按整份处理（菜单校验会先拦住非法码）。 */
function portionLabel(portionCode: string): string {
  return portionCode === 'half' ? '半份' : '整份';
}

/**
 * 单个推荐项 → 视图。soldOut/locked/未知标记都在这里统一算：
 *  - soldOut 先由 offerId 反查窗口，再比 (meal, windowId, dishId)；
 *  - locked 只表示"当前餐有指向该报价的锁定"，不保证核心方案一定含它；
 *  - 营养/价格未知给 null + unknownLabel，页面据此显示"—/未知"，不显示 0。
 */
function itemViewFromPlanItem(item: any, catalog: Catalog, meal: Meal, day: DayRecord): ItemView {
  const dish = (catalog.dishes || []).find((entry) => entry.dishId === item.dishId);
  const estimated = !!(dish && dish.nutritionBasis && dish.nutritionBasis.estimated);
  const priceKnown = typeof item.priceCents === 'number';
  // 售罄作用域 = 业务日期（day 本身即当日）+ 窗口 + 餐次 + 稳定 dishId。
  // 计划项只带 offerId/dishId，窗口必须由报价反查：否则同一道菜在 A 窗售罄时，
  // B 窗同菜推荐会被误标售罄。
  const offer = (catalog.offers || []).find((entry) => entry.offerId === item.offerId);
  const soldOut = day.soldOut.some((mark) => {
    if (mark.meal !== meal || mark.dishId !== item.dishId) {
      return false;
    }
    // 旧计划残留了当前菜单中不存在的报价时无法判定窗口，保守按 dishId 标记，
    // 提示用户刷新方案（菜单替换后旧计划本就失效）。
    return offer ? mark.windowId === offer.windowId : true;
  });
  const locked = day.itemLocks.some((lock) => lock.meal === meal && lock.offerId === item.offerId);
  const nutrition: Nutrition | null = item.nutrition
    ? {
        energyKcal: item.nutrition.energyKcal,
        proteinDg: item.nutrition.proteinDg,
        fatDg: item.nutrition.fatDg,
        carbDg: item.nutrition.carbDg,
      }
    : null;
  // 逐字段判已知：null（未知）不是 0；四项都是有限数字才算营养完整。
  const nutritionValues = nutrition
    ? [nutrition.energyKcal, nutrition.proteinDg, nutrition.fatDg, nutrition.carbDg]
    : [];
  const nutritionKnown =
    nutritionValues.length === 4 &&
    nutritionValues.every((value) => typeof value === 'number' && Number.isFinite(value));
  const unknown: string[] = [];
  if (!nutritionKnown) unknown.push('营养未知');
  if (!priceKnown) unknown.push(PRICE_PENDING);
  return {
    itemKey: `${meal}:${item.offerId}`,
    offerId: item.offerId,
    dishId: item.dishId,
    // 由报价反查窗口后带出：页面按窗口解除售罄时用它，不靠 meal+菜名猜窗口。
    windowId: offer ? offer.windowId : null,
    name: dish ? dish.name : item.dishId,
    // 食物类别只取菜单里的已知值；菜单缺失或不认识该类别时为 null，页面展示“搭配信息待补”。
    category: dish && typeof dish.category === 'string' ? dish.category : null,
    portionLabel: portionLabel(item.portionCode),
    quantity: item.quantity || 1,
    priceCents: priceKnown ? item.priceCents : null,
    priceKnown,
    priceLabel: planPriceLabel(priceKnown, item.priceCents),
    nutrition,
    nutritionKnown,
    estimated,
    estimatedLabel: estimated ? '估算' : '',
    locked,
    soldOut,
    unknownLabel: unknown.join('、'),
  };
}

/** 已知金额小计。存在未知价格项时 incomplete=true：小计仍给已知部分，但不能当总价。 */
function totalFromItems(items: ItemView[]): { known: number; incomplete: boolean } {
  let known = 0;
  let incomplete = false;
  for (const item of items) {
    if (item.priceKnown && item.priceCents !== null) {
      known += item.priceCents * item.quantity;
    } else {
      incomplete = true;
    }
  }
  return { known, incomplete };
}

/** 只汇总某一餐的有效记录（用于已确认餐次的展示与预算口径）。 */
function summarizeMealLogs(day: DayRecord, meal: Meal) {
  return summarizeActiveLogs({ ...day, logs: day.logs.filter((log) => log.meal === meal && log.status === 'active') });
}

/**
 * 已确认餐次没有推荐时，从真实记录的报价反查窗口，避免把 menuVersion 当窗口。
 * 记录里存的是菜单快照（nameSnapshot/offerId），换菜单后 offerId 可能已不存在，
 * 这时返回 null，由调用方降级为"窗口未知"，不臆造窗口。
 */
function windowIdFromLogs(activeLogs: any[], catalog: Catalog): string | null {
  for (const log of activeLogs) {
    for (const item of log.items) {
      if (!item.offerId) continue;
      const offer = (catalog.offers || []).find((entry) => entry.offerId === item.offerId);
      if (offer) {
        return offer.windowId;
      }
    }
  }
  return null;
}

/** 单餐状态文案优先级：无供应 > 已结束 > 已确认 > 核心给出的规划状态 > 默认待规划。 */
function mealStatusLabel(status: string | undefined, supply: boolean, ended: boolean, confirmed: boolean): string {
  if (!supply) return '无供应';
  if (ended) return '已结束';
  if (confirmed) return '已确认（不参与规划）';
  switch (status) {
    case 'planned':
      return '已生成推荐';
    case 'not_planned':
      return '未规划';
    case 'no_candidate':
      return '无可选组合';
    case 'insufficient_nutrition':
      return '营养数据不足';
    default:
      return status || '待规划';
  }
}

/** 营养完整才返回对象；任一字段缺失返回 null（未知不当 0），由汇总层标记不完整。 */
function nutritionFrom(raw: any): Nutrition | null {
  if (!raw) return null;
  if (typeof raw.energyKcal !== 'number' || typeof raw.proteinDg !== 'number' || typeof raw.fatDg !== 'number' || typeof raw.carbDg !== 'number') {
    return null;
  }
  return { energyKcal: raw.energyKcal, proteinDg: raw.proteinDg, fatDg: raw.fatDg, carbDg: raw.carbDg };
}

/**
 * 把某餐的推荐项映射成视图；已确认餐次改用真实记录展示（推荐与已吃分开）。
 *
 * 分支顺序是语义而不是优化：
 *  1. 已确认且核心不再规划该餐 → 只展示已吃记录，绝不用推荐覆盖快照；
 *  2. 有推荐 → 按推荐项映射；
 *  3. 都没有 → 空 items + statusMessage 解释原因。
 * 窗口来源优先级：推荐窗口 > 窗口锁 > 已吃记录反查 > null。
 * 没有推荐时仍计算 swappableOffers（仅限锁定窗口）供"先换菜再规划"使用；
 * 售罄过滤按 offer.windowId，其他窗口同菜售罄不影响本窗候选。
 */
function buildMealView(
  meal: Meal,
  day: DayRecord,
  catalog: Catalog,
  plan: any,
  result: any,
): MealView {
  const supply = mealHasSupply(catalog, meal);
  const ended = isMealEnded(day, meal);
  const activeLogs = day.logs.filter((log) => log.meal === meal && log.status === 'active');
  const confirmed = activeLogs.length > 0;
  const planMeals: any[] = plan && Array.isArray(plan.meals) ? plan.meals : [];
  const planMeal = planMeals.find((entry) => entry.meal === meal);
  const outcome = result && Array.isArray(result.mealOutcomes) ? result.mealOutcomes.find((entry: any) => entry.meal === meal) : null;
  const planStatus = outcome ? outcome.status : planMeal ? 'planned' : 'not_planned';
  const windowLocks = day.windowLocks.filter((lock) => lock.meal === meal);

  let items: ItemView[] = [];
  let knownSums: Nutrition | null = null;
  let incompleteNutrients: string[] = [];
  let unknownItemCount = 0;
  let plannedKnown = 0;
  let priceIncomplete = false;

  if (confirmed) {
    // 已确认（含自选菜）就用真实记录展示已吃内容，绝不用推荐覆盖快照。
    // 这里不再要求"核心已不再规划该餐"：计划可能是在确认之前生成的（自选菜落账后
    // 不会静默重算），旧推荐此时已经不能代表用户实际吃下的东西，必须让实际记录优先。
    const summary = summarizeMealLogs(day, meal);
    items = activeLogs.flatMap((log) =>
      log.items.map((item, index) => {
        const nutrition = item.nutrition
          ? {
              energyKcal: item.nutrition.energyKcal === null ? NaN : item.nutrition.energyKcal,
              proteinDg: item.nutrition.proteinDg === null ? NaN : item.nutrition.proteinDg,
              fatDg: item.nutrition.fatDg === null ? NaN : item.nutrition.fatDg,
              carbDg: item.nutrition.carbDg === null ? NaN : item.nutrition.carbDg,
            }
          : null;
        const knownNutrition =
          nutrition && [nutrition.energyKcal, nutrition.proteinDg, nutrition.fatDg, nutrition.carbDg].every((value) => !Number.isNaN(value))
            ? nutrition
            : null;
        return {
          itemKey: `${log.recordId}:${item.itemKey}:${index}`,
          offerId: item.offerId || '',
          dishId: item.dishId || '',
          name: item.nameSnapshot,
          // 已吃快照可能来自已替换的菜单：反查不到菜品时类别为 null，不按菜名推断。
          category: (() => {
            const dish = (catalog.dishes || []).find((entry) => entry.dishId === item.dishId);
            return dish && typeof dish.category === 'string' ? dish.category : null;
          })(),
          portionLabel: portionLabel(item.portionCode),
          quantity: item.quantity,
          priceCents: item.unitPriceCents,
          priceKnown: item.priceKnown && item.unitPriceCents !== null,
          // 已吃快照的实付未知写“实付未填”，不按 0 元展示。
          priceLabel: paidItemLabel(item.priceKnown, item.unitPriceCents),
          nutrition: knownNutrition,
          nutritionKnown: !!knownNutrition,
          estimated: false,
          estimatedLabel: '',
          locked: false,
          soldOut: false,
          unknownLabel: !knownNutrition && item.priceKnown ? '营养未知' : !item.priceKnown ? PAID_PENDING : '',
        };
      }),
    );
    knownSums = unknownNutrientsToNull(summary.knownSums);
    incompleteNutrients = ['energyKcal', 'proteinDg', 'fatDg', 'carbDg'].filter((key) => (summary.knownSums as any)[key] === null);
    unknownItemCount = summary.unknownItemCount;
    plannedKnown = summary.priceKnownCents;
    priceIncomplete = summary.priceIncomplete;
  } else if (planMeal) {
    items = (planMeal.items || []).map((item: any) => itemViewFromPlanItem(item, catalog, meal, day));
    knownSums = nutritionFrom(planMeal.nutrition && planMeal.nutrition.knownSums);
    incompleteNutrients = planMeal.nutrition && Array.isArray(planMeal.nutrition.incompleteNutrients) ? planMeal.nutrition.incompleteNutrients.slice() : [];
    unknownItemCount = planMeal.nutrition && Array.isArray(planMeal.nutrition.unknownItemRefs) ? planMeal.nutrition.unknownItemRefs.length : 0;
    const totals = totalFromItems(items);
    plannedKnown = totals.known;
    priceIncomplete = totals.incomplete;
  }

  const windowId = planMeal
    ? planMeal.windowId
    : windowLocks.length > 0
      ? windowLocks[0].windowId
      : windowIdFromLogs(activeLogs, catalog);
  const window = windowId ? (catalog.windows || []).find((entry) => entry.windowId === windowId) : null;

  const swappableOffers = (catalog.offers || [])
    .filter((offer) => offer.mealWindows.indexOf(meal) >= 0)
    .filter((offer) => (planMeal ? offer.windowId === planMeal.windowId : true))
    .filter((offer) => {
      const dish = (catalog.dishes || []).find((entry) => entry.dishId === offer.dishId);
      if (!dish) return false;
      // 候选过滤同样按“窗次 + dishId”判断：只有该报价所属窗口的售罄标记才排除它，
      // 其他窗口对同一道菜的售罄不影响本窗口换菜候选。
      return !day.soldOut.some(
        (mark) => mark.meal === meal && mark.dishId === offer.dishId && mark.windowId === offer.windowId,
      );
    })
    .map((offer) => {
      const dish = (catalog.dishes || []).find((entry) => entry.dishId === offer.dishId);
      return {
        offerId: offer.offerId,
        dishId: offer.dishId,
        name: dish ? dish.name : offer.dishId,
        portionLabel: portionLabel(offer.portionCode),
        priceLabel: money(offer.priceCents),
      };
    });

  let statusMessage = '';
  if (!supply) {
    statusMessage = '当前菜单没有窗口供应这一餐。';
  } else if (ended) {
    statusMessage = '该餐已由用户结束：不虚构摄入，也不自动补推；可重开或补记。';
  } else if (confirmed) {
    statusMessage = '该餐已确认，推荐不再覆盖已吃快照；如需修改请到记餐页。';
  } else if (!planMeal) {
    statusMessage = outcome && outcome.status === 'not_planned' ? '本轮未生成该餐推荐。' : '尚无该餐推荐，请点击“刷新方案”。';
  } else if (priceIncomplete) {
    statusMessage = '含价格待补的菜品：计划总价仅按已知金额小计。';
  } else if (incompleteNutrients.length > 0) {
    statusMessage = '含营养未知项：营养汇总不完整，不承诺达标。';
  }

  return {
    meal,
    label: MEAL_LABELS[meal],
    supply,
    ended,
    confirmed,
    hasPlan: !!planMeal,
    planStatus,
    planStatusLabel: mealStatusLabel(planStatus, supply, ended, confirmed),
    windowId,
    windowName: window ? window.name : windowId,
    windowLocked: !!planMeal && !!planMeal.windowLocked,
    target: planMeal ? nutritionFrom(planMeal.nutritionReferenceTarget) : null,
    items,
    knownSums,
    incompleteNutrients,
    unknownItemCount,
    plannedKnownCents: plannedKnown,
    priceIncomplete,
    flags: plan && Array.isArray(plan.flags) ? plan.flags.map((code: string) => flagLabel(code)) : [],
    statusMessage,
    swappableOffers,
  };
}

/** 记录汇总里的营养：任一字段为 null 就把整组置 null（不完整不能当完整用）。 */
function unknownNutrientsToNull(raw: any): Nutrition | null {
  if (!raw) return null;
  const values = [raw.energyKcal, raw.proteinDg, raw.fatDg, raw.carbDg];
  if (values.some((value) => value === null || value === undefined)) {
    return null;
  }
  return { energyKcal: raw.energyKcal, proteinDg: raw.proteinDg, fatDg: raw.fatDg, carbDg: raw.carbDg };
}

/**
 * 核心预算块 → 视图。undefined 一律转 null（未知），不默认 0；
 * overBudget/priceIncomplete 等布尔标志原样保留，页面据此决定是否显示"超预算/不完整"提示。
 * checkBasis 表示预算是"只按已知金额"还是"完整金额"核算。
 *
 * 若提供 day 与 catalog，则按待规划餐次（planningMeals）计算后续未确认计划开销，
 * 避免已确认/已吃餐次或已结束餐次与已吃记录重复计费（DEFECT-S3-01）。
 */
function planBudgetInput(plan: any, day?: DayRecord, catalog?: Catalog): PlanBudgetInput | null {
  if (!plan || !plan.budget) {
    return null;
  }
  const budget = plan.budget;
  const rawBase: PlanBudgetInput = {
    budgetCents: budget.budgetCents === undefined ? null : budget.budgetCents,
    remainingBudgetKnownCents: budget.remainingBudgetKnownCents === undefined ? null : budget.remainingBudgetKnownCents,
    plannedTotalCents: budget.plannedTotalCents === undefined ? null : budget.plannedTotalCents,
    plannedTotalKnownCents: budget.plannedTotalKnownCents === undefined ? null : budget.plannedTotalKnownCents,
    priceIncomplete: !!budget.priceIncomplete,
    overBudget: !!budget.overBudget,
    withinBudgetKnownAmounts: !!budget.withinBudgetKnownAmounts,
    overageCents: budget.overageCents === undefined ? null : budget.overageCents,
    checkBasis: budget.checkBasis || 'known_only',
  };

  if (!day || !catalog) {
    return rawBase;
  }

  const pendingMeals = planningMeals(day, catalog);
  if (pendingMeals.length === 0) {
    // 所有餐次均已确认或结束：无待规划餐次，未来计划开销为 0，不再参与超支判定
    return {
      ...rawBase,
      plannedTotalCents: 0,
      plannedTotalKnownCents: 0,
      priceIncomplete: false,
      overBudget: false,
      withinBudgetKnownAmounts: true,
      overageCents: 0,
    };
  }

  const planMeals: any[] = Array.isArray(plan.meals) ? plan.meals : [];
  const activePlanMeals = planMeals.filter((pm) => pendingMeals.indexOf(pm.meal) >= 0);

  if (activePlanMeals.length === 0) {
    // 待规划餐次在当前方案中无推荐
    return {
      ...rawBase,
      plannedTotalCents: null,
      plannedTotalKnownCents: 0,
      priceIncomplete: false,
      overBudget: false,
      withinBudgetKnownAmounts: false,
      overageCents: 0,
    };
  }

  let plannedTotalKnownCents = 0;
  let priceIncomplete = false;

  for (const pm of activePlanMeals) {
    for (const item of pm.items || []) {
      if (typeof item.priceCents === 'number') {
        plannedTotalKnownCents += item.priceCents * (item.quantity || 1);
      } else {
        priceIncomplete = true;
      }
    }
  }

  return {
    ...rawBase,
    plannedTotalCents: priceIncomplete ? null : plannedTotalKnownCents,
    plannedTotalKnownCents,
    priceIncomplete,
    overBudget: !!budget.overBudget && activePlanMeals.length === planMeals.length,
    overageCents: budget.overageCents === undefined ? null : budget.overageCents,
  };
}

/**
 * 备选方案摘要。价格展示规则：
 *  - 有明确 plannedTotalCents 用它；
 *  - 否则若价格不完整用"已知小计"，再否则 null（显示"—"）；
 * 策略名翻译成中文；selected 与 store 的 selectedPlanIndex 对齐，页面据此高亮。
 */
function buildPlanSummaries(result: any, selectedIndex: number): PlanSummaryView[] {
  const plans: any[] = result && Array.isArray(result.plans) ? result.plans : [];
  return plans.map((plan, index) => {
    const strategies: string[] = Array.isArray(plan.offeredAs) ? plan.offeredAs : [plan.strategy].filter(Boolean);
    const price = plan.budget
      ? plan.budget.plannedTotalCents === null || plan.budget.plannedTotalCents === undefined
        ? plan.budget.priceIncomplete
          ? plan.budget.plannedTotalKnownCents
          : null
        : plan.budget.plannedTotalCents
      : null;
    return {
      index,
      strategies,
      title: strategies.map((strategy) => STRATEGY_LABELS[strategy] || strategy).join(' / ') || `方案 ${index + 1}`,
      priceCents: price,
      priceLabel: money(price),
      nutritionDeviationBp: plan.score ? plan.score.nutritionDeviationBp : 0,
      nutritionTier: plan.score ? plan.score.nutritionTier : 0,
      nutritionCompleteness: plan.score ? plan.score.nutritionCompleteness : '',
      flags: Array.isArray(plan.flags) ? plan.flags.map((code: string) => flagLabel(code)) : [],
      selected: index === selectedIndex,
    };
  });
}

/** 核心诊断码 → 中文；未知码原样保留，避免新核心诊断在页面上变成"undefined"。 */
function diagnosticsOf(result: any): { code: string; message: string }[] {
  if (!result || !Array.isArray(result.diagnostics)) {
    return [];
  }
  return result.diagnostics.map((entry: any) => ({
    code: entry.code,
    message: DIAGNOSTIC_LABELS[entry.code] || entry.code,
  }));
}

/**
 * 核心 status → 用户可读说明。每个分支都明确"是不是方案、能不能当无解/最优"：
 *  - NoFeasible 只在候选未被截断时才是真无解；ResourceLimited 明确不等于无解；
 *  - NoFeasibleWithinBudget 的方案是超预算备选，不自动抬预算；
 *  - LockConflict 要求用户先处理锁定，系统不静默解锁；
 *  - TargetUnavailable 不生成假方案。
 */
function statusMessageOf(status: string, result: any): string {
  switch (status) {
    case 'Ok':
      return '已生成完整方案。';
    case 'OkPartial':
      return '已生成方案，但存在独立限制标志（如估算数据、价格/营养不完整、近似结果），请查看标志说明。';
    case 'NoFeasible':
      return '在候选未被截断的前提下，当前菜单/约束没有合法组合；这不是营养问题，也不冒充方案。';
    case 'NoFeasibleWithinBudget':
      return '预算内没有合法组合；下方方案是明确标注的超预算备选，保留真实记录，不自动抬高预算。';
    case 'NutritionDataInsufficient':
      return '关键营养未知，无法自动生成候选；可手动选餐/锁定/记餐，汇总会标记不完整。';
    case 'ResourceLimited':
      return '搜索达到合法限额仍未找到方案：这不等于证明无解，也不能声称最优。';
    case 'LockConflict':
      return '存在失效或冲突的锁定：请先在餐次卡中解除/替换锁定，再刷新方案；系统不会静默解锁。';
    case 'TargetUnavailable': {
      const reasons = result && Array.isArray(result.targetReasons) ? result.targetReasons.join('、') : '';
      return `营养目标不可用于自动规划${result && result.targetStatus ? `（${result.targetStatus}）` : ''}${reasons ? '：' + reasons : ''}；不生成假方案。`;
    }
    default:
      return `未知计划状态：${status}`;
  }
}

/**
 * 映射完整 PlanResult 包络为页面视图数据。
 * 三个入口分支都不能省：
 *  - envelope 为空：中性空视图（尚未生成方案），不伪造状态；
 *  - envelope.ok=false 或缺少 result：契约级错误（不是"无解"），展示 code/字段路径；
 *  - 正常结果：selectedPlanIndex 先做区间钳制（删除备选/恢复旧状态后可能越界），
 *    所有餐次都生成视图（没推荐的餐次也要有状态说明），预算视图用当前选中备选重算。
 */
export function interpretPlanResult(
  envelope: any,
  state: { settings: PlannerSettings },
  day: DayRecord,
  catalog: Catalog,
): PlanInterpretation {
  const intake = buildIntakeView(day);
  const emptyBudget = buildBudgetView(state.settings, day, null);
  if (!envelope) {
    // 尚未调用核心/没有当前方案：返回中性空视图，不伪造状态或错误。
    return {
      status: '',
      statusLabel: '尚未生成方案',
      message: '',
      envelope: null,
      meals: MEALS.map((meal) => buildMealView(meal, day, catalog, null, null)),
      plans: [],
      selectedIndex: 0,
      budgetInput: null,
      intake,
      budget: emptyBudget,
      diagnostics: [],
      flags: [],
      requestId: null,
      planCreatedAt: null,
    };
  }
  if (envelope.ok === false || !envelope.result) {
    const code = envelope.error ? envelope.error.code : 'INTERNAL_ERROR';
    const path = envelope.error ? envelope.error.fieldPath : '';
    const detail = envelope.error ? envelope.error.message : '核心返回了无法解析的结果';
    const message = `契约级错误 ${code}：${detail}${path ? `（${path}）` : ''}`;
    return {
      status: code,
      statusLabel: '请求被拒绝',
      message,
      envelope,
      meals: MEALS.map((meal) => buildMealView(meal, day, catalog, null, null)),
      plans: [],
      selectedIndex: 0,
      budgetInput: null,
      intake,
      budget: emptyBudget,
      diagnostics: [{ code, message }],
      flags: [],
      requestId: envelope.requestId ? envelope.requestId : null,
      planCreatedAt: null,
    };
  }

  const result = envelope.result;
  const status: string = result.status;
  const plans: any[] = Array.isArray(result.plans) ? result.plans : [];
  const selectedIndex = Math.min(Math.max(0, day.selectedPlanIndex || 0), Math.max(0, plans.length - 1));
  const selectedPlan = plans[selectedIndex] || null;
  const budgetInput = planBudgetInput(selectedPlan, day, catalog);
  return {
    status,
    statusLabel: STATUS_LABELS[status] || status,
    message: statusMessageOf(status, result),
    envelope,
    meals: MEALS.map((meal) => buildMealView(meal, day, catalog, selectedPlan, result)),
    plans: buildPlanSummaries(result, selectedIndex),
    selectedIndex,
    budgetInput,
    intake,
    budget: buildBudgetView(state.settings, day, budgetInput),
    diagnostics: diagnosticsOf(result),
    flags: selectedPlan && Array.isArray(selectedPlan.flags) ? selectedPlan.flags.slice() : [],
    requestId: envelope.requestId || null,
    planCreatedAt: null,
  };
}

/** 状态码 → 中文标签；供开发页/证据脚本在没有完整 envelope 时也能翻译状态。 */
export function planLabelForCode(code: string): string {
  return STATUS_LABELS[code] || code;
}

/** 从单个 plan 提取预算输入；供开发页/测试复用与 interpretPlanResult 一致的口径。 */
export function budgetFromPlan(plan: any, day?: DayRecord, catalog?: Catalog): PlanBudgetInput | null {
  return planBudgetInput(plan, day, catalog);
}

/** 对外暴露金额格式化（页面/证据脚本共用，避免各处自己拼 ￥ 与未知占位）。 */
export { money };

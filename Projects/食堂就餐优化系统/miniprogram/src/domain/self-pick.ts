/**
 * self-pick.ts — 自选菜（B1）的只读状态、草稿预览与确认项构造规则。
 *
 * 定位：这是"选菜 → 确认吃了"链路里除了持久化写入以外的全部规则，写成纯函数，
 * 页面只读它来渲染，store.confirmSelfPickMeal 只读它来构造 MealLog。这样页面
 * 预览与最终落账永远用同一份口径，不会出现"预览说 9 元、记录里 8 元"。
 *
 * 边界（T05S02 / T05S02a）：
 *  - 全是纯函数/类型：不写持久化、不调用 WASM、不新增算法入口、不碰 C++/契约。
 *  - 选择过程只形成内存草稿；只有用户点"确认吃了"后 store 才 commit 一条 MealLog。
 *  - 金额与营养缺失一律 null/false（未知不当 0），展示文案复用 utils/money-display.ts。
 *  - 菜单营养的份量缩放 / override 优先级 / 舍入属正式菜单营养语义，唯一实现是共享 C++ 核心
 *    （core/src/catalog.cpp 的 OfferNutrition）。T05N01 起，单份营养只来自核心只读出口
 *    `mp_offer_nutrition` 的返回值：本文件只把结果抄进视图/快照，数量变化只做单份值×数量
 *    的既有累加，不在前端重算缩放/舍入/套餐展开。
 *  - 菜单原始来源与 estimated 元数据仍从 Dish.nutritionBasis 透传；一旦拿到核心结果，
 *    estimated 与完整性以核心返回为准（含套餐组件汇总传播）。
 *  - 核心结果按"当前菜单+餐次"复用（SelfPickNutritionSnapshot）；菜单或餐次一变即视为
 *    无结果，旧草稿不会被绑到新来源上。
 *
 * 边界：本文件仍是纯函数/类型；不写持久化、不加载 WASM，也不新造第二套营养计算。
 */

import type {
  ActionResult,
  Catalog,
  DayRecord,
  Dish,
  FieldError,
  LogNutrition,
  Meal,
  Offer,
} from './types';
import { MAX_MONEY_CENTS, MEAL_LABELS } from './types';
import { isMealEnded } from './app-state';
import { mealHasSupply } from './plan';
import { paidItemLabel, paidSumLabel, priceLabel, yuan } from '../utils/money-display';

/** 单行数量上限：与 addManualLog/editLog 的 1–99 保持一致。 */
const MAX_QUANTITY = 99;
/** 草稿标识允许的字符集与长度：只作幂等键的一段，不做业务解释。 */
const DRAFT_TOKEN_PATTERN = /^[A-Za-z0-9_-]{6,64}$/;
/** 自选确认幂等键前缀：与 conf-plan- / conf-manual- 并列，便于在存储里一眼分辨来源。 */
const SELF_PICK_CONFIRMATION_PREFIX = 'conf-selfpick';

/** 营养四项的固定顺序（与 logs.ts、契约一致）：营养未知时四项都标"待补全"。 */
const NUTRIENT_LABELS = ['能量', '蛋白质', '脂肪', '碳水'];
/** 与 NUTRIENT_LABELS 同序的契约字段名（核心结果与 MealLog 都用这套键）。 */
const NUTRIENT_FIELDS: (keyof LogNutrition)[] = ['energyKcal', 'proteinDg', 'fatDg', 'carbDg'];

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

/** 自选被拦住的原因码；页面据此决定是禁用入口还是引导用户走既有路径。 */
export type SelfPickBlockCode = 'no-supply' | 'meal-ended' | 'already-confirmed' | 'no-offer';

/** 草稿里的一行选择。priceEdit 语义与 confirmMeal 的 priceEdits 一致：
 *  不提供=用菜单价；null=用户明确置为"实付未知"；数字=非负整数分。 */
export interface SelfPickSelection {
  offerId: string;
  quantity?: number;
  priceEdit?: number | null;
}

/** 单个可售报价的视图：菜单价/份量/售罄都按当前菜单算，不缓存。
 *  营养来自当前菜单+餐次的核心结果快照；没有结果时 nutrition 为 null + nutritionKnown=false。 */
export interface SelfPickOfferView {
  offerId: string;
  dishId: string;
  windowId: string;
  name: string;
  category: string | null;
  kind: 'single' | 'combo';
  portionCode: 'full' | 'half';
  portionLabel: string;
  priceCents: number | null;
  priceKnown: boolean;
  priceBasis: 'unitPrice' | 'comboTotal' | 'unknown';
  priceLabel: string;
  nutrition: LogNutrition | null;
  nutritionKnown: boolean;
  /** 核心给出的四项完整性（nutritionComplete）；没有核心结果时为 false。 */
  nutritionComplete: boolean;
  estimated: boolean;
  estimatedLabel: string;
  /** 套餐组件展示文案（菜名×份数，仅用于说明"含什么、各几份"，不单独计价、不展开营养）。 */
  comboComponents: string[];
  riceIncluded: boolean;
  soldOut: boolean;
  available: boolean;
  unavailableLabel: string;
}

/** 一个窗口在本餐的可选项；窗口是自选的作用域边界，不允许跨窗混选。 */
export interface SelfPickWindowView {
  windowId: string;
  name: string;
  offers: SelfPickOfferView[];
  availableCount: number;
  soldOutCount: number;
}

/**
 * 自选菜状态视图：只读，不写入任何东西。
 * canPick=false 时 blockCode/blockMessage 说明原因（无供应/已结束/已确认/无报价），
 * 页面必须按 blockMessage 引导到既有路径（重开该餐、记录页改记或撤销），不得绕开校验。
 */
export interface SelfPickView {
  meal: Meal;
  mealLabel: string;
  businessDate: string;
  menuVersion: string;
  simulated: boolean;
  supply: boolean;
  ended: boolean;
  confirmed: boolean;
  confirmedRecordIds: string[];
  canPick: boolean;
  blockCode: SelfPickBlockCode | null;
  blockMessage: string;
  windows: SelfPickWindowView[];
  defaultWindowId: string | null;
  totalOfferCount: number;
}

/** 草稿预览的上下文：只用来生成提示，不参与校验通过/拒绝。 */
export interface SelfPickDraftContext {
  budgetCents: number | null;
  spentKnownCents: number;
  spentPriceIncomplete: boolean;
  mealEnergyTargetKcal: number | null;
}

/** 草稿里已解析的一行：预览与最终 MealLog 快照共用，避免两套字段映射。 */
export interface SelfPickDraftLine {
  offerId: string;
  dishId: string;
  name: string;
  category: string | null;
  portionCode: 'full' | 'half';
  portionLabel: string;
  quantity: number;
  unitPriceCents: number | null;
  priceKnown: boolean;
  priceLabel: string;
  nutrition: LogNutrition | null;
  estimated: boolean;
  /** 记录里的 nutritionBasis 口径（menu/estimated）；没有核心结果时为 null。 */
  nutritionBasis: string | null;
}

/** 草稿预览：ok=false 只表示"还不能确认"，errors 给页面定位；不写任何状态。 */
export interface SelfPickDraftPreview {
  ok: boolean;
  message: string;
  meal: Meal;
  windowId: string;
  windowName: string | null;
  lines: SelfPickDraftLine[];
  errors: FieldError[];
  itemCount: number;
  knownTotalCents: number;
  priceIncomplete: boolean;
  priceLabel: string;
  /** 单份值×数量的已知合计；任一字段含未知即该字段 null。全无已知值时为 null（不补 0）。 */
  nutritionSums: LogNutrition | null;
  /** 营养未知时四项都列出，页面据此显示"营养待补全"。 */
  incompleteNutrients: string[];
  /** 与 logs.ts 同口径：实付未知的项数（营养未知不混入这项）。 */
  unknownItemCount: number;
  estimated: boolean;
  hints: string[];
}

/** 确认输入：windowId 定死单窗边界，draftToken 是草稿的稳定确认标识。 */
export interface SelfPickConfirmInput {
  windowId: string;
  draftToken: string;
  selections: SelfPickSelection[];
}

/** 确认结果：duplicate=true 表示同一草稿的重复提交被幂等吞掉，没有新增记录。 */
export interface SelfPickConfirmResult extends ActionResult {
  meal: Meal;
  businessDate: string;
  recordId: string | null;
  confirmationId: string | null;
  /** 落账后剩余餐次的推荐是否已过期（派生标记，不持久化）。 */
  planNeedsUpdate: boolean;
  affectedMeals: Meal[];
  hints: string[];
}

// ---------------------------------------------------------------------------
// 营养元数据
// ---------------------------------------------------------------------------

/**
 * 估算标记来自菜品，不因 nutritionOverride 改写（与 core offer.estimated = dish->estimated 一致）。
 * 这是菜单原始来源元数据，与"营养数值是否已知"无关：数值未知时仍保留，供页面标注"估算"。
 */
function offerEstimated(dish: Dish | null): boolean {
  return !!(dish && dish.nutritionBasis && dish.nutritionBasis.estimated);
}

function isValidMoney(value: any): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_MONEY_CENTS;
}

function portionLabelOf(portionCode: 'full' | 'half'): string {
  return portionCode === 'half' ? '半份' : '整份';
}

/** 售罄作用域 = 业务日期（day 本身）+ 窗口 + 餐次 + dishId；缺窗口会误伤别的窗口同菜。 */
function isSoldOut(day: DayRecord, meal: Meal, windowId: string, dishId: string): boolean {
  return (day.soldOut || []).some(
    (mark) => mark.meal === meal && mark.windowId === windowId && mark.dishId === dishId,
  );
}

function findDish(catalog: Catalog, dishId: string): Dish | null {
  return (catalog.dishes || []).find((entry) => entry.dishId === dishId) || null;
}

function findWindow(catalog: Catalog, windowId: string) {
  return (catalog.windows || []).find((entry) => entry.windowId === windowId) || null;
}

/** 套餐组件展示文案：真实菜名 + 合同份数（如「清蒸鸡胸×2」），只作展示，不参与营养计算。 */
function comboComponentLabels(catalog: Catalog, dish: Dish): string[] {
  if (!dish.components || dish.components.length === 0) {
    return [];
  }
  return dish.components.map((component) => {
    const componentDish = findDish(catalog, component.dishId);
    const name = componentDish ? componentDish.name : component.dishId;
    return `${name}×${component.count}`;
  });
}

// ---------------------------------------------------------------------------
// 核心单份营养结果快照（唯一来源：WASM mp_offer_nutrition）
// ---------------------------------------------------------------------------

/** 一个报价的单份结果：数值与 estimated/完整性都照抄核心返回，不在前端重算。 */
export interface SelfPickNutritionEntry {
  nutrition: LogNutrition;
  estimated: boolean;
  nutritionComplete: boolean;
}

/**
 * 当前菜单+餐次生命周期内的单份结果复用块（store 持有并按来源键校验）。
 * 数量变化只复用这里的结果累加，不因此重新查询整份菜单；菜单/餐次一变即整体失效。
 */
export interface SelfPickNutritionSnapshot {
  menuVersion: string;
  catalogHash: string;
  meal: Meal;
  byOfferId: Record<string, SelfPickNutritionEntry>;
}

/** 快照只在"当前菜单+餐次"内有效：来源一变立即视为没有结果，旧草稿不会绑错来源。 */
function usableNutritionSnapshot(
  catalog: Catalog,
  meal: Meal,
  snapshot: SelfPickNutritionSnapshot | null | undefined,
): SelfPickNutritionSnapshot | null {
  if (!snapshot) {
    return null;
  }
  if (
    snapshot.catalogHash !== catalog.catalogHash ||
    snapshot.menuVersion !== catalog.menuVersion ||
    snapshot.meal !== meal
  ) {
    return null;
  }
  return snapshot;
}

function nutritionEntryOf(
  snapshot: SelfPickNutritionSnapshot | null,
  offerId: string,
): SelfPickNutritionEntry | null {
  if (!snapshot) {
    return null;
  }
  return snapshot.byOfferId[offerId] || null;
}

/**
 * 核心对"整条营养未知"的报价也会返回一个四项皆 null 的对象；那不等于有值。
 * 这里只做一次语义归一：四项都没有已知数值 → 视为未知（null），未知绝不当 0。
 */
export function knownNutritionOnly(nutrition: LogNutrition | null): LogNutrition | null {
  if (!nutrition) {
    return null;
  }
  const known = NUTRIENT_FIELDS.some((field) => typeof nutrition[field] === 'number');
  return known ? nutrition : null;
}

// ---------------------------------------------------------------------------
// 草稿标识
// ---------------------------------------------------------------------------

/**
 * 新建一个草稿标识。每次调用产生新值：页面必须在"开始一个草稿"时生成一次并存住，
 * 之后所有勾选/取消/重试都复用同一个值，重复确认才能被 confirmationId 幂等吞掉。
 * 它只是幂等键，不是记录 ID；真正的记录 ID 由 store 落账时另生成。
 */
export function createSelfPickDraftToken(now: Date): string {
  const stamp = now.getTime().toString(36);
  const random = Math.floor(Math.random() * 1e9).toString(36);
  return `sp-${stamp}-${random}`;
}

/** 草稿标识合法性：非空字符串且在允许字符集/长度内（防止畸形值拼出跨餐的确认键）。 */
export function isValidSelfPickDraftToken(token: any): boolean {
  return typeof token === 'string' && DRAFT_TOKEN_PATTERN.test(token);
}

/** 自选确认的幂等键：业务日期 + 餐次 + 草稿标识。同一草稿重复提交必然命中同一键。 */
export function selfPickConfirmationId(businessDate: string, meal: Meal, draftToken: string): string {
  return `${SELF_PICK_CONFIRMATION_PREFIX}-${businessDate}-${meal}-${draftToken}`;
}

// ---------------------------------------------------------------------------
// 状态查询
// ---------------------------------------------------------------------------

/** 把一条报价映射成可选项视图；菜品缺失时返回 null（没有名字就无法落快照）。 */
function offerViewOf(
  catalog: Catalog,
  day: DayRecord,
  meal: Meal,
  offer: Offer,
  nutritionSnapshot: SelfPickNutritionSnapshot | null,
): SelfPickOfferView | null {
  const dish = findDish(catalog, offer.dishId);
  if (!dish) {
    return null;
  }
  const soldOut = isSoldOut(day, meal, offer.windowId, offer.dishId);
  // 单份营养只抄核心返回值：null 字段保留未知、已知 0 保留；没有核心结果就是未知。
  const entry = nutritionEntryOf(nutritionSnapshot, offer.offerId);
  const nutrition: LogNutrition | null = entry ? knownNutritionOnly(entry.nutrition) : null;
  const estimated = entry ? entry.estimated : offerEstimated(dish);
  const priceKnown = typeof offer.priceCents === 'number';
  return {
    offerId: offer.offerId,
    dishId: offer.dishId,
    windowId: offer.windowId,
    name: dish.name,
    category: typeof dish.category === 'string' ? dish.category : null,
    kind: dish.kind,
    portionCode: offer.portionCode,
    portionLabel: portionLabelOf(offer.portionCode),
    priceCents: priceKnown ? offer.priceCents : null,
    priceKnown,
    priceBasis: offer.priceBasis,
    priceLabel: priceLabel(priceKnown, offer.priceCents),
    nutrition,
    nutritionKnown: !!nutrition,
    nutritionComplete: entry ? entry.nutritionComplete : false,
    estimated,
    estimatedLabel: estimated ? '估算' : '',
    // 套餐组件只作展示：价格按 offer.priceCents（comboTotal）计一次，不重复计价。
    comboComponents: comboComponentLabels(catalog, dish),
    riceIncluded: !!dish.riceIncluded,
    soldOut,
    available: !soldOut,
    unavailableLabel: soldOut ? '已售罄' : '',
  };
}

/**
 * 某餐的自选状态：窗口列表 + 每个窗口本餐在售的报价（含售罄标记）。
 * 只依赖当前菜单与当日状态，不调用核心、不读计划结果；preferredWindowId 通常来自
 * 当前推荐方案的窗口，让页面默认停在同一个窗口。
 * simulated 由调用方（store）按与菜单页相同的来源判定传入，模拟菜单必须继续醒目标注。
 */
export function buildSelfPickView(
  catalog: Catalog,
  day: DayRecord,
  meal: Meal,
  preferredWindowId: string | null,
  simulated: boolean,
  nutritionSnapshot?: SelfPickNutritionSnapshot | null,
): SelfPickView {
  const snapshot = usableNutritionSnapshot(catalog, meal, nutritionSnapshot);
  const supply = mealHasSupply(catalog, meal);
  const ended = isMealEnded(day, meal);
  const confirmedLogs = (day.logs || []).filter((log) => log.meal === meal && log.status === 'active');

  const windows: SelfPickWindowView[] = (catalog.windows || [])
    .filter((window) => window.mealWindows.indexOf(meal) >= 0)
    .map((window) => {
      const offers = (catalog.offers || [])
        .filter((offer) => offer.windowId === window.windowId && offer.mealWindows.indexOf(meal) >= 0)
        .map((offer) => offerViewOf(catalog, day, meal, offer, snapshot))
        .filter((view): view is SelfPickOfferView => !!view);
      return {
        windowId: window.windowId,
        name: window.name,
        offers,
        availableCount: offers.filter((offer) => offer.available).length,
        soldOutCount: offers.filter((offer) => offer.soldOut).length,
      };
    });

  const totalOfferCount = windows.reduce((sum, window) => sum + window.offers.length, 0);

  let blockCode: SelfPickBlockCode | null = null;
  let blockMessage = '';
  if (!supply) {
    blockCode = 'no-supply';
    blockMessage = `当前菜单没有任何窗口供应${MEAL_LABELS[meal]}，无法自选。`;
  } else if (ended) {
    blockCode = 'meal-ended';
    blockMessage = `${MEAL_LABELS[meal]}已被标记为不吃：请先在今日页用现有"重开该餐"恢复，再自选记餐。`;
  } else if (confirmedLogs.length > 0) {
    blockCode = 'already-confirmed';
    blockMessage = `${MEAL_LABELS[meal]}已有有效记录：如需修改请到记录页改记或撤销，不新增第二条确认入口。`;
  } else if (totalOfferCount === 0) {
    blockCode = 'no-offer';
    blockMessage = `${MEAL_LABELS[meal]}没有任何可售报价（菜单未给该餐提供 Offer）。`;
  }

  const pickable = blockCode === null;
  const candidates = windows.filter((window) => window.offers.length > 0);
  const preferred = preferredWindowId ? candidates.find((window) => window.windowId === preferredWindowId) : undefined;
  const withAvailable = candidates.find((window) => window.availableCount > 0);
  const fallback = preferred || withAvailable || candidates[0] || null;
  const defaultWindowId = pickable && fallback ? fallback.windowId : null;

  return {
    meal,
    mealLabel: MEAL_LABELS[meal],
    businessDate: day.businessDate,
    menuVersion: catalog.menuVersion,
    simulated: !!simulated,
    supply,
    ended,
    confirmed: confirmedLogs.length > 0,
    confirmedRecordIds: confirmedLogs.map((log) => log.recordId),
    canPick: pickable,
    blockCode,
    blockMessage,
    windows,
    defaultWindowId,
    totalOfferCount,
  };
}

// ---------------------------------------------------------------------------
// 草稿预览
// ---------------------------------------------------------------------------

/** 营养未知时的缺项文案：四项都待补全（与 logs.ts / 页面标签一致）。 */
function allNutrientsIncomplete(): string[] {
  return NUTRIENT_LABELS.slice();
}

/**
 * 草稿预览：把页面临时选择解析成"如果确认会记成什么"。
 * 所有校验都在这里做一次，confirmSelfPickMeal 复用同一份结果落账，避免两套规则漂移。
 * 上下文（预算/目标）只生成 hints，不参与 ok 判定：偏离目标不得拒绝保存。
 */
export function buildSelfPickDraftPreview(
  catalog: Catalog,
  day: DayRecord,
  meal: Meal,
  windowId: string,
  selections: SelfPickSelection[],
  context: SelfPickDraftContext | null,
  nutritionSnapshot?: SelfPickNutritionSnapshot | null,
): SelfPickDraftPreview {
  const snapshot = usableNutritionSnapshot(catalog, meal, nutritionSnapshot);
  const errors: FieldError[] = [];
  const window = findWindow(catalog, windowId);
  const windowName = window ? window.name : null;
  if (!window) {
    errors.push({ field: 'windowId', message: '所选窗口不在当前菜单中，请重新选择' });
  } else if (window.mealWindows.indexOf(meal) < 0) {
    errors.push({ field: 'windowId', message: `窗口「${window.name}」不供应${MEAL_LABELS[meal]}` });
  }
  const list = Array.isArray(selections) ? selections : [];
  if (list.length === 0) {
    errors.push({ field: 'selections', message: '还没选任何菜品：至少选 1 项才能确认吃了' });
  }

  const lines: SelfPickDraftLine[] = [];
  const seen: string[] = [];
  let knownTotalCents = 0;
  let priceIncomplete = false;
  let unknownItemCount = 0;
  let itemCount = 0;
  let anyEstimated = false;
  // 单份值×数量的逐字段累加；任一字段未知即该字段 null（未知绝不当 0）。
  const nutrientSums: Record<string, number | null> = {
    energyKcal: 0,
    proteinDg: 0,
    fatDg: 0,
    carbDg: 0,
  };

  for (const selection of list) {
    if (!selection || typeof selection.offerId !== 'string' || selection.offerId === '') {
      errors.push({ field: 'selections', message: '选中的报价缺少 offerId' });
      continue;
    }
    const offer = (catalog.offers || []).find((entry) => entry.offerId === selection.offerId);
    if (!offer) {
      errors.push({ field: 'selections', message: `报价 ${selection.offerId} 已不在当前菜单中，无法记录` });
      continue;
    }
    const dish = findDish(catalog, offer.dishId);
    if (!dish) {
      errors.push({ field: 'selections', message: `报价 ${selection.offerId} 对应的菜品已不在菜单中` });
      continue;
    }
    if (seen.indexOf(selection.offerId) >= 0) {
      errors.push({ field: 'selections', message: `「${dish.name}」重复选择：同一报价只允许一行，请改数量` });
      continue;
    }
    seen.push(selection.offerId);
    if (offer.windowId !== windowId) {
      errors.push({
        field: 'selections',
        message: `「${dish.name}」属于其他窗口（${offer.windowId}）：一次自选只能在一个窗口内`,
      });
      continue;
    }
    if (offer.mealWindows.indexOf(meal) < 0) {
      errors.push({ field: 'selections', message: `「${dish.name}」不供应${MEAL_LABELS[meal]}` });
      continue;
    }
    const quantity = selection.quantity === undefined ? 1 : selection.quantity;
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > MAX_QUANTITY) {
      errors.push({ field: 'selections', message: `「${dish.name}」数量必须是 1–${MAX_QUANTITY} 的整数` });
      continue;
    }
    if (isSoldOut(day, meal, offer.windowId, offer.dishId)) {
      errors.push({ field: 'selections', message: `「${dish.name}」在本窗口已标记售罄，不能记为已吃` });
      continue;
    }
    let unitPriceCents = typeof offer.priceCents === 'number' ? offer.priceCents : null;
    let priceKnown = unitPriceCents !== null;
    if (Object.prototype.hasOwnProperty.call(selection, 'priceEdit')) {
      const edited = selection.priceEdit;
      if (edited === null) {
        // 明确置为"实付未知"：保留 priceKnown=false，绝不补 0。
        unitPriceCents = null;
        priceKnown = false;
      } else if (isValidMoney(edited)) {
        unitPriceCents = edited as number;
        priceKnown = true;
      } else {
        errors.push({ field: 'selections', message: `「${dish.name}」的实付价格必须是非负整数（分），且不超过 ￥1,000,000.00` });
        continue;
      }
    }
    // 营养快照只抄当前菜单+餐次的核心单份结果；没有结果时为 null（未知，不补 0）。
    // estimated 以核心返回为准（含套餐组件汇总传播），没有结果时才回退菜单元数据。
    const entry = nutritionEntryOf(snapshot, offer.offerId);
    const nutrition: LogNutrition | null = entry ? knownNutritionOnly(entry.nutrition) : null;
    const estimated = entry ? entry.estimated : offerEstimated(dish);
    const line: SelfPickDraftLine = {
      offerId: offer.offerId,
      dishId: offer.dishId,
      name: dish.name,
      category: typeof dish.category === 'string' ? dish.category : null,
      portionCode: offer.portionCode,
      portionLabel: portionLabelOf(offer.portionCode),
      quantity,
      unitPriceCents,
      priceKnown,
      priceLabel: paidItemLabel(priceKnown, unitPriceCents),
      nutrition,
      estimated,
      nutritionBasis: nutrition ? (estimated ? 'estimated' : 'menu') : null,
    };
    lines.push(line);
    // 数量变化只累加核心返回的单份值：不在这里重查核心，也不做前端缩放/舍入。
    for (let index = 0; index < NUTRIENT_FIELDS.length; index += 1) {
      const field = NUTRIENT_FIELDS[index];
      const value = nutrition ? nutrition[field] : null;
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        nutrientSums[field] = null;
      } else if (nutrientSums[field] !== null) {
        nutrientSums[field] = (nutrientSums[field] as number) + value * quantity;
      }
    }
    itemCount += quantity;
    if (estimated) {
      anyEstimated = true;
    }
    // unknownItemCount 与 logs.ts 同口径 = "实付未知"的项数（营养未知由 incompleteNutrients 表达，
    // 不混进来，避免页面把"营养待补全"说成"实付未知"）。
    if (priceKnown && unitPriceCents !== null) {
      knownTotalCents += unitPriceCents * quantity;
    } else {
      priceIncomplete = true;
      unknownItemCount += 1;
    }
  }

  // 全无已知值（未选菜或所有行都无核心结果）→ 合计为 null；否则保留逐字段已知合计，
  // 未知字段仍是 null，绝不因其它项已知而被补成 0。
  const summed: LogNutrition = {
    energyKcal: nutrientSums.energyKcal,
    proteinDg: nutrientSums.proteinDg,
    fatDg: nutrientSums.fatDg,
    carbDg: nutrientSums.carbDg,
  };
  const hasKnown = NUTRIENT_FIELDS.some((field) => typeof summed[field] === 'number');
  const nutritionSums: LogNutrition | null = lines.length > 0 && hasKnown ? summed : null;
  const incompleteNutrients: string[] = nutritionSums
    ? NUTRIENT_FIELDS.map((field, index) => (nutritionSums[field] === null ? NUTRIENT_LABELS[index] : '')).filter(
        (label) => label !== '',
      )
    : allNutrientsIncomplete();

  const hints: string[] = [];
  if (context) {
    if (context.budgetCents !== null && context.budgetCents !== undefined && lines.length > 0) {
      if (context.spentPriceIncomplete) {
        hints.push('今日已有未知价格记录：剩余预算无法精确判断，本餐仍按你选的实际内容记录。');
      } else {
        const remaining = Math.max(0, context.budgetCents - context.spentKnownCents);
        if (knownTotalCents > remaining) {
          hints.push(
            `本餐已知金额 ${yuan(knownTotalCents)} 超过今日剩余预算 ${yuan(remaining)}：仅提示，不改写你的实际选择。`,
          );
        }
      }
    }
    if (
      context.mealEnergyTargetKcal !== null &&
      context.mealEnergyTargetKcal !== undefined &&
      nutritionSums &&
      nutritionSums.energyKcal !== null
    ) {
      hints.push(
        `本餐已知热量 ${nutritionSums.energyKcal} kcal，参考目标约 ${context.mealEnergyTargetKcal} kcal：仅提示，不因偏离目标拒绝记录。`,
      );
    }
  }

  const ok = errors.length === 0;
  return {
    ok,
    message: ok
      ? '草稿可用：只有点击"确认吃了"才会写入实际记录，取消/返回/关闭只丢弃草稿。'
      : `${errors[0].message}${errors.length > 1 ? `（共 ${errors.length} 项问题）` : ''}`,
    meal,
    windowId,
    windowName,
    lines,
    errors,
    itemCount,
    knownTotalCents,
    priceIncomplete,
    priceLabel: paidSumLabel(knownTotalCents, priceIncomplete),
    nutritionSums,
    incompleteNutrients,
    unknownItemCount,
    estimated: anyEstimated,
    hints,
  };
}

// ---------------------------------------------------------------------------
// 落账快照
// ---------------------------------------------------------------------------

/**
 * 草稿行 → MealLog 记录项（快照）。只抄当前菜单与核心给出的真实值：
 *  - 名称/份量/价格/营养都在确认瞬间固化，之后换菜单不改写历史；
 *  - 未知价格写 null + priceKnown=false，未知营养写 null，都不补 0；
 *  - 营养与 nutritionBasis 只抄核心单份结果（T05N01）；没有核心结果时为 null，
 *    不在前端重算或补 0；
 *  - 套餐按 comboTotal 计一次（unitPriceCents 就是套餐价），组件不进 items、不重复计价。
 */
export function logItemFromDraftLine(
  meal: Meal,
  line: SelfPickDraftLine,
  menuVersion: string,
): {
  itemKey: string;
  source: 'menuOffer';
  offerId: string;
  dishId: string;
  menuVersion: string;
  nameSnapshot: string;
  portionCode: 'full' | 'half';
  quantity: number;
  unitPriceCents: number | null;
  priceKnown: boolean;
  nutrition: LogNutrition | null;
  nutritionBasis: string | null;
  note: null;
} {
  return {
    // 同一报价在一个草稿里只出现一次（预览已拒绝重复），所以 meal+offerId 足够稳定。
    itemKey: `${meal}:${line.offerId}`,
    source: 'menuOffer',
    offerId: line.offerId,
    dishId: line.dishId,
    menuVersion,
    nameSnapshot: line.name,
    portionCode: line.portionCode,
    quantity: line.quantity,
    unitPriceCents: line.priceKnown ? line.unitPriceCents : null,
    priceKnown: !!line.priceKnown,
    nutrition: line.nutrition
      ? {
          energyKcal: line.nutrition.energyKcal,
          proteinDg: line.nutrition.proteinDg,
          fatDg: line.nutrition.fatDg,
          carbDg: line.nutrition.carbDg,
        }
      : null,
    nutritionBasis: line.nutritionBasis,
    note: null,
  };
}

// ---------------------------------------------------------------------------
// 营养展示文案（页面报价行与已选行共用同一口径）
// ---------------------------------------------------------------------------

/** dg（0.1g）→ 克文案；未知返回 null，由调用方决定写成"待补全"。 */
function gramsText(dg: number | null): string | null {
  if (typeof dg !== 'number' || !Number.isFinite(dg)) {
    return null;
  }
  return `${(dg / 10).toFixed(1).replace(/\.0$/, '')}g`;
}

/**
 * 单份营养文案：只做单位换算和未知文案，不生成、不补齐任何数值。
 * 未知字段显示"待补全"，已知 0 显示 0；estimated 来自核心时在热量前标"约"。
 */
export function selfPickNutritionText(nutrition: LogNutrition | null, estimated: boolean): string {
  if (!nutrition) {
    return '营养待补全（核心没有该报价的已知单份数值）';
  }
  const energy =
    typeof nutrition.energyKcal === 'number' && Number.isFinite(nutrition.energyKcal)
      ? `${estimated ? '约 ' : ''}${Math.round(nutrition.energyKcal)} 千卡`
      : '热量待补全';
  const protein = gramsText(nutrition.proteinDg);
  const fat = gramsText(nutrition.fatDg);
  const carb = gramsText(nutrition.carbDg);
  return [
    energy,
    protein === null ? '蛋白待补全' : `蛋白 ${protein}`,
    fat === null ? '脂肪待补全' : `脂肪 ${fat}`,
    carb === null ? '碳水待补全' : `碳水 ${carb}`,
  ].join(' · ');
}

/**
 * 预览营养合计文案：已知字段显示单份值×数量的合计，未知字段写明待补全；
 * 全无已知值（null）时只说明未知，绝不按 0 展示。
 */
export function selfPickNutritionSumsText(sums: LogNutrition | null): string {
  if (!sums) {
    return '四项均待补全（没有可用的核心单份结果，未知不按 0 计算）';
  }
  const parts: string[] = [];
  let incomplete = false;
  for (let index = 0; index < NUTRIENT_FIELDS.length; index += 1) {
    const field = NUTRIENT_FIELDS[index];
    const label = NUTRIENT_LABELS[index];
    const value = sums[field];
    if (typeof value !== 'number' || !Number.isFinite(value)) {
      incomplete = true;
      parts.push(`${label}待补全`);
      continue;
    }
    parts.push(field === 'energyKcal' ? `${label} ${Math.round(value)} 千卡` : `${label} ${gramsText(value)}`);
  }
  return `已知合计 ${parts.join(' · ')}${incomplete ? '（未知项不按 0 计算）' : ''}`;
}
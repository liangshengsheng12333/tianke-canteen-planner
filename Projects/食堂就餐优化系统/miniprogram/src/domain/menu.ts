/**
 * menu.ts — 菜单导入解析、与核心的预检协作、影响分析与替换后的状态整理。
 *
 * 导入流程（PRD 3.3）：
 *  解析本地 JSON → 计算/校验 catalogHash → 调用 WASM mp_validate_menu →
 *  展示对当前计划/锁定/售罄的影响 → 用户明确确认后才原子替换。
 * 取消、非法文件或写入失败都保留原菜单、锁定和计划；成功替换后旧计划失效。
 */

import type { Catalog, CatalogMeta, DayRecord, MenuDiffView, MenuInfoView, Meal } from './types';
import { MEAL_LABELS } from './types';
import { canonicalSha256 } from '../utils/canonical-json';
import { validateLocks } from './plan';

export interface ParsedMenu {
  ok: boolean;
  message: string;
  errors: { field: string; message: string }[];
  catalog: Catalog | null;
  hashInjected: boolean;
}

export const MAX_MENU_TEXT_BYTES = 1_500_000;

function isObject(value: any): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 解析菜单文本。接受两种形态：
 *  1) 直接是 MenuCatalog 对象；
 *  2) { catalog: MenuCatalog } 包装（便于携带文件头信息）。
 * 只有缺 catalogHash 时才按 T01 v1.2 口径补算；已提供的 hash 原样保留，
 * 由核心复算并拒绝不一致，避免掩盖篡改/截断。
 */
export function parseMenuText(text: string): ParsedMenu {
  const errors: { field: string; message: string }[] = [];
  if (typeof text !== 'string' || text.trim() === '') {
    return { ok: false, message: '菜单内容为空', errors: [{ field: 'text', message: '请粘贴或选择菜单 JSON 文件' }], catalog: null, hashInjected: false };
  }
  if (text.length > MAX_MENU_TEXT_BYTES) {
    return {
      ok: false,
      message: `菜单文件过大（${text.length} 字符，上限 ${MAX_MENU_TEXT_BYTES}）`,
      errors: [{ field: 'text', message: '菜单文件超过前端可处理大小' }],
      catalog: null,
      hashInjected: false,
    };
  }
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch (error: any) {
    return {
      ok: false,
      message: `JSON 解析失败：${error && error.message ? error.message : String(error)}`,
      errors: [{ field: 'text', message: '不是合法 JSON' }],
      catalog: null,
      hashInjected: false,
    };
  }
  let candidate: any = parsed;
  if (isObject(parsed) && parsed.catalog !== undefined) {
    candidate = parsed.catalog;
  }
  if (!isObject(candidate)) {
    return {
      ok: false,
      message: '菜单 JSON 顶层必须是对象（或 {catalog: {...}} 包装）',
      errors: [{ field: 'catalog', message: '顶层类型非法' }],
      catalog: null,
      hashInjected: false,
    };
  }
  if (!Array.isArray(candidate.windows) || !Array.isArray(candidate.dishes) || !Array.isArray(candidate.offers)) {
    return {
      ok: false,
      message: '菜单缺少 windows / dishes / offers 数组，无法进入核心预检',
      errors: [{ field: 'catalog', message: '缺少必需数组' }],
      catalog: null,
      hashInjected: false,
    };
  }
  const catalog = JSON.parse(JSON.stringify(candidate)) as Catalog;
  let hashInjected = false;
  if (!catalog.catalogHash) {
    catalog.catalogHash = canonicalSha256(catalog, 'catalogHash');
    hashInjected = true;
  }
  return {
    ok: true,
    message: hashInjected ? '已按规范化序列化补算 catalogHash，需核心复算确认' : '菜单 JSON 解析成功，待核心校验',
    errors,
    catalog,
    hashInjected,
  };
}

/** 与核心 ValidateMenuCatalog 协作；返回原始包络供上层展示错误。 */
export function requestValidateMenu(callCore: (requestText: string) => string, catalog: Catalog): { envelope: any; rawText: string } {
  const rawText = callCore(JSON.stringify({ contractVersion: '1.0', catalog }));
  let envelope: any;
  try {
    envelope = JSON.parse(rawText);
  } catch (error: any) {
    throw new Error(`ValidateMenuCatalog 返回不是合法 JSON：${error && error.message ? error.message : String(error)}`);
  }
  return { envelope, rawText };
}

function dishName(catalog: Catalog, dishId: string): string {
  const dish = (catalog.dishes || []).find((entry) => entry.dishId === dishId);
  return dish ? dish.name : dishId;
}

function offerKey(offer: any): string {
  return `${offer.dishId}|${offer.portionCode}|${offer.windowId}`;
}

/**
 * 售罄标记在新菜单下是否仍然有意义：菜品存在 + 窗口存在且在当餐供应 +
 * 该窗口当餐确实还有该菜的报价。三者任一不满足，标记就失去作用域含义。
 * 作用域是“窗口+餐次+dishId”，所以不能用 offerId 判断（换一份同菜报价不算变化）。
 */
function soldOutMarkStillServed(
  mark: { meal: Meal; windowId: string; dishId: string },
  dishes: Map<string, any>,
  windows: Map<string, any>,
  offers: any[],
): boolean {
  if (!dishes.has(mark.dishId)) {
    return false;
  }
  const window = windows.get(mark.windowId);
  if (!window || (window.mealWindows || []).indexOf(mark.meal) < 0) {
    return false;
  }
  return offers.some(
    (offer) =>
      offer.dishId === mark.dishId &&
      offer.windowId === mark.windowId &&
      (offer.mealWindows || []).indexOf(mark.meal) >= 0,
  );
}

/**
 * 计算新旧菜单的差异与影响，供预检展示。只做比较，不改动任何状态。
 */
export function buildMenuDiff(oldCatalog: Catalog, newCatalog: Catalog, day: DayRecord | null): MenuDiffView {
  const oldWindows = new Map<string, any>((oldCatalog.windows || []).map((entry) => [entry.windowId, entry]));
  const newWindows = new Map<string, any>((newCatalog.windows || []).map((entry) => [entry.windowId, entry]));
  const oldDishes = new Map<string, any>((oldCatalog.dishes || []).map((entry) => [entry.dishId, entry]));
  const newDishes = new Map<string, any>((newCatalog.dishes || []).map((entry) => [entry.dishId, entry]));
  const oldOffers = new Map<string, any>((oldCatalog.offers || []).map((entry) => [entry.offerId, entry]));
  const newOffers = new Map<string, any>((newCatalog.offers || []).map((entry) => [entry.offerId, entry]));
  // 售罄作用域含窗口+餐次：判断标记是否仍有意义，要看该菜在新菜单里是否真的
  // 还在“这个窗口、这个餐次”有报价，而不是只看窗口/菜品是否还存在。
  const newOfferList: any[] = newCatalog.offers || [];

  const windowsAdded = [...newWindows.keys()].filter((id) => !oldWindows.has(id)).map((id) => newWindows.get(id).name || id);
  const windowsRemoved = [...oldWindows.keys()].filter((id) => !newWindows.has(id)).map((id) => oldWindows.get(id).name || id);
  const dishesAdded = [...newDishes.keys()].filter((id) => !oldDishes.has(id)).map((id) => newDishes.get(id).name || id);
  const dishesRemoved = [...oldDishes.keys()].filter((id) => !newDishes.has(id)).map((id) => oldDishes.get(id).name || id);
  const offersAdded = [...newOffers.keys()].filter((id) => !oldOffers.has(id)).length;
  const offersRemoved = [...oldOffers.keys()].filter((id) => !newOffers.has(id)).length;

  const priceChanges: { name: string; oldCents: number | null; newCents: number | null }[] = [];
  for (const [key, oldOffer] of oldOffers) {
    const newOffer = newOffers.get(key);
    if (!newOffer) continue;
    if (oldOffer.priceCents !== newOffer.priceCents) {
      priceChanges.push({
        name: `${dishName(newCatalog, newOffer.dishId)}（${newOffer.portionCode === 'half' ? '半份' : '整份'}，${newOffer.windowId}）`,
        oldCents: oldOffer.priceCents,
        newCents: newOffer.priceCents,
      });
    }
  }

  // 当前计划中的报价在新菜单里不存在/不可购买时，旧计划必须失效。
  const impactedMeals: Meal[] = [];
  if (day && day.plan && day.plan.rawText) {
    try {
      const envelope = JSON.parse(day.plan.rawText);
      const plans: any[] = envelope && envelope.result && Array.isArray(envelope.result.plans) ? envelope.result.plans : [];
      for (const plan of plans) {
        for (const meal of plan.meals || []) {
          const missing = (meal.items || []).some((item: any) => {
            const offer = newOffers.get(item.offerId);
            if (!offer) return true;
            const window = newWindows.get(offer.windowId);
            return !window || window.mealWindows.indexOf(meal.meal) < 0;
          });
          if (missing && impactedMeals.indexOf(meal.meal) < 0) {
            impactedMeals.push(meal.meal);
          }
        }
      }
    } catch (_e) {
      // 旧计划原文无法解析时按“受影响”处理，提示用户重新规划，不阻断菜单替换。
      for (const meal of ['breakfast', 'lunch', 'dinner'] as Meal[]) {
        impactedMeals.push(meal);
      }
    }
  }

  // 锁定失效：用新菜单重新校验当前锁定；这些记录保留，由用户显式解除/替换。
  const invalidLocks = day
    ? validateLocks(day, newCatalog).map((issue) => ({
        kind: issue.kind,
        meal: issue.meal,
        label: issue.label,
        reason: issue.reason,
      }))
    : [];

  // 售罄标记不是硬约束记录：新菜单里已不存在的菜品/供应会失去意义，替换时清理并在预检中明示。
  // 作用域含窗口，所以同一 dishId 可能在 A 窗保留、B 窗被清理；这里逐条给出窗口信息，
  // 避免用户只看到菜名却不知道删的是哪个窗口的标记。
  const droppedSoldOut = day
    ? day.soldOut
        .filter((mark) => !soldOutMarkStillServed(mark, newDishes, newWindows, newOfferList))
        .map((mark) => {
          const dish = newDishes.get(mark.dishId);
          const window = newWindows.get(mark.windowId);
          const windowName = window ? window.name : null;
          let reason: string;
          if (!dish) {
            reason = '新菜单中已不存在该菜品';
          } else if (!window) {
            reason = `新菜单中已不存在窗口 ${mark.windowId}`;
          } else if (window.mealWindows.indexOf(mark.meal) < 0) {
            reason = `窗口「${windowName || mark.windowId}」不再供应${MEAL_LABELS[mark.meal]}`;
          } else {
            reason = `窗口「${windowName || mark.windowId}」不再为${MEAL_LABELS[mark.meal]}供应「${dish.name}」`;
          }
          return {
            meal: mark.meal,
            label: `${dish ? dish.name : mark.dishId}（${MEAL_LABELS[mark.meal]} · ${windowName || mark.windowId}）`,
            reason,
            windowId: mark.windowId,
            windowName,
          };
        })
    : [];

  return {
    oldMenuVersion: oldCatalog.menuVersion,
    newMenuVersion: newCatalog.menuVersion,
    windowsAdded,
    windowsRemoved,
    dishesAdded,
    dishesRemoved,
    offersAdded,
    offersRemoved,
    priceChanges,
    impactedMeals,
    invalidLocks,
    droppedSoldOut,
    keepsPlan: impactedMeals.length === 0,
  };
}

/**
 * 菜单信息视图（含来源标注）。
 * builtin=内置真实菜单（西一，首次进入的默认来源）；simulated 必须醒目标注“非真实、不可作验收依据”；
 * imported 是用户自己导入的菜单，不改写历史已吃快照。
 */
export function buildMenuInfoView(catalog: Catalog, meta: CatalogMeta): MenuInfoView {
  const simulated = meta.source === 'simulated';
  const builtin = meta.source === 'builtin';
  return {
    source: meta.source,
    simulated,
    menuVersion: catalog.menuVersion,
    catalogHash: catalog.catalogHash,
    canteenName: catalog.canteen ? catalog.canteen.name : '未知食堂',
    importedAt: meta.importedAt,
    importedFileName: meta.importedFileName,
    dishCount: (catalog.dishes || []).length,
    offerCount: (catalog.offers || []).length,
    windowCount: (catalog.windows || []).length,
    comboRuleCount: (catalog.comboRules || []).length,
    banner: simulated
      ? '当前为模拟菜单（非真实菜单）：价格与营养均为开发用估算，不构成真实产品或验收依据。'
      : builtin
        ? `当前为内置真实菜单 ${catalog.canteen ? catalog.canteen.name : '西院西一食堂'}（${catalog.menuVersion}）：价格按菜单数据，营养只含已批准估算项，可在“菜单与备份”页切换。`
        : `当前为导入菜单 ${catalog.menuVersion}；历史已吃快照不会因换菜单而改写。`,
  };
}

/** 替换菜单时对新状态做的纯数据整理（旧计划失效、清理失去意义的售罄标记）。 */
export function prepareCatalogReplacement(
  day: DayRecord,
  newCatalog: Catalog,
): { soldOut: DayRecord['soldOut']; removedSoldOut: number } {
  const windows = new Map<string, any>((newCatalog.windows || []).map((entry) => [entry.windowId, entry]));
  const dishes = new Map<string, any>((newCatalog.dishes || []).map((entry) => [entry.dishId, entry]));
  const offers: any[] = newCatalog.offers || [];
  // 与预检展示共用同一判定，避免“预检说会清理、实际替换后还留着”的不一致。
  const kept = day.soldOut.filter((mark) => soldOutMarkStillServed(mark, dishes, windows, offers));
  return { soldOut: kept, removedSoldOut: day.soldOut.length - kept.length };
}

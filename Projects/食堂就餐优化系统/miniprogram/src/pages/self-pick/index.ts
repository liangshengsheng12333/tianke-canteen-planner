/**
 * pages/self-pick/index.ts — 自己选菜（T05S03）。
 *
 * 职责边界：
 * - 业务规则（能不能选、单窗边界、售罄/结束/已确认、套餐计价、幂等、落账）全部在
 *   domain/store.ts 的自选接口里；本页只做“选择草稿（页面 data）+ 展示映射 + 用户触发的调用编排”。
 * - 草稿（draftToken / windowId / selections）只存页面 data：取消、返回、关闭即丢弃，不写任何存储，
 *   也不产生记录；只有用户点“确认吃了”才调用 confirmSelfPickMeal 写入一条 MealLog。
 * - 营养快照来自核心 mp_offer_nutrition 的当前菜单+餐次结果（T05N01）：页面只显示
 *   store 给出的单份值与合计，未知显示“待补全”，不派生、不缩放、不补 0。
 * - 成功记录通过既有 getHomeView/getLogsView 读模型出现在今日与记录/月历；本页不自动刷新推荐，
 *   只把“剩余推荐需更新”如实提示给用户，刷新仍由用户在今日页主动点击。
 */
import type { AppStore } from '../../domain/store';
import type { Meal } from '../../domain/types';
import { MEAL_LABELS, MEALS } from '../../domain/types';
import type { SelfPickConfirmResult, SelfPickDraftPreview, SelfPickSelection, SelfPickView } from '../../domain/self-pick';
import { selfPickNutritionSumsText, selfPickNutritionText } from '../../domain/self-pick';
import { applyPageAppearance } from '../../utils/appearance';
import { loadDisplayMode, suggestedMealByTime } from '../../utils/display-mode';
import type { DisplayMode } from '../../utils/display-mode';
import { yuan } from '../../utils/money-display';
import { describeError } from '../../utils/wx-runtime';

/** 窗口签：只用于页面切换，窗口本身由 store 的 getSelfPickView 决定。 */
interface WindowChip {
  windowId: string;
  name: string;
  availableCount: number;
  soldOutCount: number;
  active: boolean;
}

/** 菜单行：把 SelfPickOfferView 映射成可绑定结构，不重算价格/份量/营养。 */
interface OfferRow {
  offerId: string;
  name: string;
  portionLabel: string;
  kindLabel: string;
  comboComponentsText: string;
  riceIncludedText: string;
  estimatedLabel: string;
  nutritionText: string;
  priceLabel: string;
  priceKnown: boolean;
  soldOut: boolean;
  canPick: boolean;
  unavailableLabel: string;
  selected: boolean;
  quantity: number;
}

/** 已选行：直接来自 previewSelfPickDraft 的 lines，页面只补“营养待补全”文案。 */
interface SelectionRow {
  offerId: string;
  name: string;
  portionLabel: string;
  quantity: number;
  priceLabel: string;
  priceKnown: boolean;
  nutritionText: string;
}

/** 取全局唯一 AppStore；缺失时提示，不构造临时 store。 */
function getStore(): AppStore | null {
  const app = getApp();
  const store = app && app.globalData ? app.globalData.store : null;
  if (!store) {
    wx.showToast({ title: '全局状态未初始化，请重新打开小程序', icon: 'none' });
    return null;
  }
  return store as AppStore;
}

/** 餐次列表 → 中文串（用于“需更新”提示，只展示不推断业务）。 */
function mealLabels(meals: Meal[]): string {
  if (!Array.isArray(meals) || meals.length === 0) {
    return '';
  }
  return meals.map((meal) => MEAL_LABELS[meal] || String(meal)).join('、');
}

/** 数量只允许 1–99；超出即夹到边界，不采用非法输入。 */
function clampQuantity(value: number): number {
  if (!Number.isFinite(value)) {
    return 1;
  }
  return Math.min(99, Math.max(1, Math.round(value)));
}

/**
 * 底部操作栏摘要：只拼接正式预览 previewSelfPickDraft 已算好的数量与金额，页面不重算价格。
 * 有未知价时只给“已知合计/待补价格”，绝不把未知当成 0 元或写成完整总价。
 */
function buildFooterSummary(preview: SelfPickDraftPreview): string {
  if (preview.lines.length === 0) {
    return '还没选菜 · 至少选 1 项才能确认';
  }
  const count = `已选 ${preview.itemCount} 项`;
  if (!preview.priceIncomplete) {
    return `${count} · 合计 ${yuan(preview.knownTotalCents)}`;
  }
  if (preview.knownTotalCents > 0) {
    return `${count} · 已知合计 ${yuan(preview.knownTotalCents)}（另 ${preview.unknownItemCount} 项待补价格）`;
  }
  return `${count} · 价格待补`;
}

Page({
  data: {
    themeClass: 'tk-light',
    mode: 'simple' as DisplayMode,
    meal: 'lunch' as Meal,
    mealLabel: '午餐',
    dateLabel: '',
    simulated: false,
    loadError: '',

    view: null as SelfPickView | null,
    blocked: false,
    blockCode: '',
    blockMessage: '',
    canReopen: false,
    canGoLogs: false,

    windows: [] as WindowChip[],
    windowId: '',
    offers: [] as OfferRow[],
    selections: [] as SelfPickSelection[],
    draftToken: '',

    preview: null as SelfPickDraftPreview | null,
    previewLines: [] as SelectionRow[],
    knownTotalLabel: '',
    footerSummaryText: '',
    detailOpen: false,
    priceIncomplete: false,
    unknownItemCount: 0,
    incompleteNutrientsText: '',
    nutritionSumsText: '',
    nutritionError: '',
    nutritionSeq: 0,
    hints: [] as string[],
    canConfirm: false,

    confirming: false,
    confirmed: false,
    confirmMessage: '',
    confirmError: '',
    planNeedsUpdate: false,
    planUpdateText: '',
  },

  onLoad(query: any) {
    const requested = query && typeof query.meal === 'string' ? String(query.meal) : '';
    const meal = (MEALS as string[]).indexOf(requested) >= 0 ? (requested as Meal) : suggestedMealByTime(new Date().getHours());
    this.setData({ meal, mealLabel: MEAL_LABELS[meal] });
  },

  onShow() {
    this.setData(applyPageAppearance());
    this.setData({ mode: loadDisplayMode() });
    this.reload();
  },

  /** 重新读取本餐自选状态；已确认成功的页面保留成功态，不退回“不能自选”。 */
  async reload() {
    const store = getStore();
    if (!store) {
      this.setData({ loadError: '全局状态未初始化：请重新打开小程序后再试。' });
      return;
    }
    try {
      store.ensureToday();
      const view = store.getSelfPickView(this.data.meal);
      const head = { loadError: '', view, simulated: view.simulated, dateLabel: view.businessDate };
      if (this.data.confirmed && view.confirmed) {
        this.setData({ ...head, blocked: false, canConfirm: false });
        return;
      }
      if (!view.canPick) {
        this.setData({
          ...head,
          blocked: true,
          blockCode: view.blockCode || '',
          blockMessage: view.blockMessage,
          canReopen: view.blockCode === 'meal-ended',
          canGoLogs: view.blockCode === 'already-confirmed',
          windows: [],
          offers: [],
          preview: null,
          previewLines: [],
          footerSummaryText: '',
          detailOpen: false,
          canConfirm: false,
        });
        return;
      }
      const windowId = this.pickWindowId(view, this.data.windowId);
      const selections = this.filterSelections(view, windowId, this.data.selections);
      this.setData({
        ...head,
        blocked: false,
        blockCode: '',
        blockMessage: '',
        canReopen: false,
        canGoLogs: false,
        windowId,
        draftToken: this.data.draftToken || store.newSelfPickDraftToken(),
        windows: this.buildWindows(view, windowId),
        offers: this.buildOffers(view, windowId, selections),
        selections,
      });
      this.syncPreview();
      // 同步部分先渲染（营养可能先显示未知），再按当前菜单+餐次补一次核心单份结果。
      await this.loadNutrition(this.data.meal);
    } catch (error: any) {
      this.setData({ loadError: '读取自选菜状态失败：' + describeError(error) });
    }
  },

  /**
   * 补当前菜单+餐次的单份营养：结果由 store 按来源复用，数量变化不会重复查询核心。
   * 失败如实提示并保持未知（不补 0）；期间切换餐次/重新加载则丢弃旧响应。
   */
  async loadNutrition(meal: Meal) {
    const store = getStore();
    if (!store) {
      return;
    }
    const seq = (this.data.nutritionSeq as number) + 1;
    this.setData({ nutritionSeq: seq });
    const loaded = await store.ensureSelfPickNutrition(meal);
    if (seq !== this.data.nutritionSeq || this.data.meal !== meal) {
      return;
    }
    if (!loaded.ok) {
      this.setData({ nutritionError: loaded.message });
      return;
    }
    const view = store.getSelfPickView(this.data.meal);
    if (!view.canPick) {
      this.reload();
      return;
    }
    this.setData({
      nutritionError: '',
      view,
      windows: this.buildWindows(view, this.data.windowId),
      offers: this.buildOffers(view, this.data.windowId, this.data.selections),
    });
    this.syncPreview();
  },

  /** 当前窗口仍可用就保留；否则退回默认窗口（无默认时用第一个有可售报价的窗口）。 */
  pickWindowId(view: SelfPickView, current: string): string {
    const windows = view.windows || [];
    const stillValid = windows.some((entry) => entry.windowId === current && entry.availableCount > 0);
    if (stillValid) {
      return current;
    }
    if (view.defaultWindowId) {
      return view.defaultWindowId;
    }
    const first = windows.find((entry) => entry.availableCount > 0) || windows[0];
    return first ? first.windowId : '';
  },

  /** 切窗/重载后过滤草稿：只保留仍在当前窗口且可售的报价，数量夹到 1–99。 */
  filterSelections(view: SelfPickView, windowId: string, selections: SelfPickSelection[]): SelfPickSelection[] {
    const window = (view.windows || []).find((entry) => entry.windowId === windowId);
    if (!window) {
      return [];
    }
    const byId: Record<string, SelfPickSelection> = {};
    for (const selection of selections || []) {
      if (selection && typeof selection.offerId === 'string') {
        byId[selection.offerId] = selection;
      }
    }
    const kept: SelfPickSelection[] = [];
    for (const offer of window.offers) {
      const picked = byId[offer.offerId];
      if (picked && !offer.soldOut) {
        kept.push({ offerId: offer.offerId, quantity: clampQuantity(picked.quantity === undefined ? 1 : (picked.quantity as number)) });
      }
    }
    return kept;
  },

  buildWindows(view: SelfPickView, windowId: string): WindowChip[] {
    return (view.windows || []).map((window) => ({
      windowId: window.windowId,
      name: window.name,
      availableCount: window.availableCount,
      soldOutCount: window.soldOutCount,
      active: window.windowId === windowId,
    }));
  },

  /** 窗口下的菜单行；选中的数量和选中态来自页面草稿，其余字段原样来自 store 视图。 */
  buildOffers(view: SelfPickView, windowId: string, selections: SelfPickSelection[]): OfferRow[] {
    const window = (view.windows || []).find((entry) => entry.windowId === windowId);
    if (!window) {
      return [];
    }
    const picked: Record<string, number> = {};
    for (const selection of selections) {
      picked[selection.offerId] = clampQuantity(selection.quantity === undefined ? 1 : (selection.quantity as number));
    }
    return window.offers.map((offer) => {
      const selected = picked[offer.offerId] !== undefined;
      const canPick = !offer.soldOut && offer.available;
      return {
        offerId: offer.offerId,
        name: offer.name,
        portionLabel: offer.portionLabel,
        kindLabel: offer.kind === 'combo' ? '套餐' : '',
        comboComponentsText: (offer.comboComponents || []).join('、'),
        riceIncludedText: offer.riceIncluded ? '含米饭' : '',
        estimatedLabel: offer.estimated ? offer.estimatedLabel || '估算' : '',
        nutritionText: selfPickNutritionText(offer.nutrition, offer.estimated),
        priceLabel: offer.priceLabel,
        priceKnown: offer.priceKnown,
        soldOut: offer.soldOut,
        canPick,
        unavailableLabel: offer.soldOut ? offer.unavailableLabel || '已售罄' : '当前不可选',
        selected,
        quantity: selected ? picked[offer.offerId] : 0,
      };
    });
  },

  /** 预览由 store 计算；页面只把返回值映射成展示字段，不自行判断 ok 之外的业务。 */
  syncPreview() {
    const store = getStore();
    if (!store) {
      return;
    }
    try {
      const preview = store.previewSelfPickDraft(this.data.meal, this.data.windowId, this.data.selections);
      this.setData({
        preview,
        previewLines: (preview.lines || []).map((line) => ({
          offerId: line.offerId,
          name: line.name,
          portionLabel: line.portionLabel,
          quantity: line.quantity,
          priceLabel: line.priceLabel,
          priceKnown: line.priceKnown,
          nutritionText: selfPickNutritionText(line.nutrition, line.estimated),
        })),
        knownTotalLabel: preview.priceLabel,
        footerSummaryText: buildFooterSummary(preview),
        detailOpen: preview.lines.length > 0 ? this.data.detailOpen : false,
        priceIncomplete: preview.priceIncomplete,
        unknownItemCount: preview.unknownItemCount,
        incompleteNutrientsText: (preview.incompleteNutrients || []).join('、'),
        nutritionSumsText: selfPickNutritionSumsText(preview.nutritionSums),
        hints: preview.hints || [],
        canConfirm: preview.ok,
        confirmError: '',
      });
    } catch (error: any) {
      this.setData({
        preview: null,
        previewLines: [],
        footerSummaryText: '',
        detailOpen: false,
        canConfirm: false,
        confirmError: '预览失败：' + describeError(error),
      });
    }
  },

  onSelectWindow(e: any) {
    const windowId = String(e.currentTarget.dataset.windowId || '');
    if (!windowId || windowId === this.data.windowId || !this.data.view) {
      return;
    }
    // 切窗即清空已选：单窗边界由 store 校验，页面不把跨窗选择带过去。
    this.setData({
      windowId,
      selections: [],
      windows: this.buildWindows(this.data.view, windowId),
      offers: this.buildOffers(this.data.view, windowId, []),
    });
    this.syncPreview();
  },

  onToggleOffer(e: any) {
    const offerId = String(e.currentTarget.dataset.offerId || '');
    const row = (this.data.offers as OfferRow[]).find((entry) => entry.offerId === offerId);
    if (!row) {
      return;
    }
    if (!row.canPick) {
      wx.showToast({ title: row.unavailableLabel, icon: 'none' });
      return;
    }
    const selections = (this.data.selections as SelfPickSelection[]).slice();
    const index = selections.findIndex((entry) => entry.offerId === offerId);
    if (index >= 0) {
      selections.splice(index, 1);
    } else {
      selections.push({ offerId, quantity: 1 });
    }
    this.setData({
      selections,
      offers: this.buildOffers(this.data.view as SelfPickView, this.data.windowId, selections),
    });
    this.syncPreview();
  },

  onQuantity(e: any) {
    const offerId = String(e.currentTarget.dataset.offerId || '');
    const op = String(e.currentTarget.dataset.op || '');
    const selections = (this.data.selections as SelfPickSelection[]).slice();
    const index = selections.findIndex((entry) => entry.offerId === offerId);
    if (index < 0) {
      return;
    }
    const next = clampQuantity((selections[index].quantity || 1) + (op === 'inc' ? 1 : -1));
    selections[index] = { offerId, quantity: next };
    this.setData({
      selections,
      offers: this.buildOffers(this.data.view as SelfPickView, this.data.windowId, selections),
    });
    this.syncPreview();
  },

  /** 底部“明细”只展开/收起页面已有的正式预览行，不重新取数、不改草稿。 */
  onToggleDetail() {
    if ((this.data.previewLines as SelectionRow[]).length === 0) {
      wx.showToast({ title: '还没有选菜', icon: 'none' });
      return;
    }
    this.setData({ detailOpen: !this.data.detailOpen });
  },

  /** 唯一写入动作：用户明确点击“确认吃了”才调用；失败如实展示，不假装成功。 */
  onConfirm() {
    if (this.data.confirming || this.data.confirmed) {
      return;
    }
    const preview = this.data.preview as SelfPickDraftPreview | null;
    if (!preview || !preview.ok) {
      wx.showToast({ title: preview ? preview.message : '还没有选菜', icon: 'none' });
      return;
    }
    const store = getStore();
    if (!store) {
      return;
    }
    this.setData({ confirming: true, confirmError: '' });
    let result: SelfPickConfirmResult;
    try {
      result = store.confirmSelfPickMeal(this.data.meal, {
        windowId: this.data.windowId,
        draftToken: this.data.draftToken,
        selections: this.data.selections,
      });
    } catch (error: any) {
      this.setData({ confirming: false, confirmError: '确认时发生异常：' + describeError(error) });
      wx.showToast({ title: '确认异常，请重试', icon: 'none' });
      return;
    }
    if (!result.ok) {
      this.setData({ confirming: false, confirmError: result.message });
      wx.showToast({ title: result.message || '确认失败', icon: 'none' });
      return;
    }
    const affected = mealLabels(result.affectedMeals);
    this.setData({
      confirming: false,
      confirmed: true,
      canConfirm: false,
      detailOpen: false,
      confirmMessage: result.message,
      planNeedsUpdate: !!result.planNeedsUpdate,
      planUpdateText:
        result.planNeedsUpdate && affected
          ? `${affected}的推荐需更新：可回“今日”页点“刷新方案”，系统不会自动重算。`
          : '',
    });
    wx.showToast({ title: result.duplicate ? '已记录过，未重复累计' : '已记录', icon: 'success' });
  },

  /** 取消：只丢弃草稿（页面 data），不写任何状态；有勾选时先让用户确认放弃。 */
  onCancel() {
    this.leave();
  },

  /** 返回：同取消；已成功记录或草稿为空时直接离开。 */
  onBack() {
    this.leave();
  },

  leave() {
    if (!this.data.confirmed && (this.data.selections as SelfPickSelection[]).length > 0) {
      wx.showModal({
        title: '放弃本次选择？',
        content: '还没有确认；返回只会丢弃草稿，不会产生记录。',
        confirmText: '放弃返回',
        cancelText: '继续选择',
        success: (res: any) => {
          if (res && res.confirm) {
            this.goBack();
          }
        },
      });
      return;
    }
    this.goBack();
  },

  goBack() {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }
    wx.reLaunch({ url: '/pages/home/index' });
  },

  /** 去记录页：已确认记录只能在既有记录页改记/撤销，本页不提供第二条确认路径。 */
  onGoLogs() {
    wx.navigateTo({
      url: `/pages/logs/index?meal=${this.data.meal}`,
      fail: (error: any) => wx.showToast({ title: '打开记录页失败：' + describeError(error), icon: 'none' }),
    });
  },

  /** 已结束的餐次走既有重开入口，本页不自行改状态。 */
  onReopen() {
    const store = getStore();
    if (!store) {
      return;
    }
    const result = store.reopenMeal(this.data.meal);
    wx.showToast({ title: result.message, icon: 'none' });
    if (result.ok) {
      this.reload();
    }
  },

  onRetry() {
    this.reload();
  },
});
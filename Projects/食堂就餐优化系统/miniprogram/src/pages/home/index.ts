/**
 * pages/home/index.ts — 今日页（T05U02 双模式）。
 *
 * 职责边界：页面只从 getApp().globalData.store 取 HomeView 做展示映射与格式化；
 * 计划求解、营养/预算汇总、锁定校验全部由 domain/AppStore 完成。页面不重算业务值、
 * 不直接调用 core-bridge、不读写业务存储。
 *
 * 本卡新增的两组“展示”状态，都与业务无关：
 * - 显示模式（简易/完整）：utils/display-mode.ts 独占读写，切换不触发重新规划/记餐；
 * - 当前餐次：页面内的浏览选择，只决定本餐卡展示哪一餐，不写 store。
 * 外观仍由 utils/appearance.ts 独占，mode 与 theme 互不影响。
 */
import type { AppStore } from '../../domain/store';
import type { ActionResult, HomeView, ItemView, Meal, MealView, MenuInfoView, Nutrition } from '../../domain/types';
import { MEAL_LABELS, MEALS } from '../../domain/types';
import { applyPageAppearance } from '../../utils/appearance';
import {
  DEFAULT_DISPLAY_MODE,
  displayModeLabel,
  loadDisplayMode,
  otherDisplayMode,
  saveDisplayMode,
  suggestedMealByTime,
} from '../../utils/display-mode';
import type { DisplayMode } from '../../utils/display-mode';
import {
  buildMacroShares,
  energyDisplay,
  formatGramsFromDg,
  pairingText,
} from '../../utils/nutrition-display';
import type { MacroShareResult } from '../../utils/nutrition-display';
import { MAIN_TABS, gotoMainTab } from '../../utils/tabbar';
import { paidSumLabel, plannedSumLabel } from '../../utils/money-display';
import { describeError, nowMs } from '../../utils/wx-runtime';

// 计划状态 → 给用户的一行说明。具体状态由 store 判定，页面只补操作引导；
// 算法名、WASM 调用、契约字段等实现细节不写进这一行，统一放进折叠区的“技术信息”。
const PLAN_STATE_HINTS: Record<string, string> = {
  'no-profile': '先完善资料，才能按你的目标生成方案。',
  idle: '今天还没有生成方案，点下方按钮生成今日方案。',
  loading: '正在生成今日方案，请稍候。',
  ok: '方案已就绪；可切换主选 / 备选，或在“本餐详情”里调整。',
  'no-plan': '本轮没有可用方案；仍可换一份、记餐或结束餐次。',
  'all-handled': '今天各餐次都已确认或结束，无需再规划。',
  unsupported: '当前菜单或设置超出受支持范围，不会发起推荐请求。',
  error: '生成方案时出错；可重试，详细原因见“说明”里的技术信息。',
  'lock-conflict': '存在失效/冲突的锁定，需先处理再生成方案。',
};

// 一行状态徽标的短标签：只讲用户能理解的结论，不露核心状态码或算法名。
const PLAN_STATE_LABELS: Record<string, string> = {
  'no-profile': '未建档',
  idle: '待生成',
  loading: '生成中',
  ok: '已就绪',
  'no-plan': '无可用方案',
  'all-handled': '今日已处理',
  unsupported: '暂不支持',
  error: '生成失败',
  'lock-conflict': '需先处理锁定',
};

// 普通页默认不展示的实现细节：调用方式、算法名、契约字段、核心状态码等。
// 命中项不进默认可见区，只进“说明 → 技术信息”，同时保留在页面数据里供诊断。
const INTERNAL_DETAIL_PATTERN =
  /WASM|wasm|greedy|branchAndBound|comboRules|OkPartial|plannerConfig|algorithm|mp_[a-z]|catalog\.|契约级错误|INTERNAL_ERROR|requestId/;

function hasInternalDetail(text: string): boolean {
  return INTERNAL_DETAIL_PATTERN.test(text);
}

// 营养字段名 → 中文。映射不到时原样回显，保证“缺哪一项”仍然可见。
const NUTRIENT_LABELS: Record<string, string> = {
  energyKcal: '能量',
  proteinDg: '蛋白质',
  fatDg: '脂肪',
  carbDg: '碳水',
  energy: '能量',
  protein: '蛋白质',
  fat: '脂肪',
  carb: '碳水',
};

const COMPLETENESS_LABELS: Record<string, string> = {
  complete: '营养完整',
  partial: '营养不完整',
  incomplete: '营养不完整',
  unknown: '营养未知',
  known: '营养完整',
};

/** 金额统一按分 → 元展示；未知价格显示“—”，不按 0 计算。 */
function money(cents: number | null | undefined): string {
  return cents === null || cents === undefined ? '—' : `￥${(cents / 100).toFixed(2)}`;
}

/** 不完整营养字段名 → 中文展示（空数组返回空串，便于 wx:if 判断）。 */
function nutrientText(fields: string[]): string {
  if (!fields || fields.length === 0) {
    return '';
  }
  return fields.map((field) => NUTRIENT_LABELS[field] || field).join('、');
}

/**
 * 完整营养快照 → 一行阅读文案；null 表示没有完整快照，不按 0 展示。
 * 逐字段判空：null（未知）写“X待补全”，0 是真实零，照常显示。
 */
function nutritionSummaryText(nutrition: Nutrition | null): string {
  if (!nutrition) {
    return '待补全';
  }
  const energy =
    typeof nutrition.energyKcal === 'number' && Number.isFinite(nutrition.energyKcal)
      ? `能量 ${Math.round(nutrition.energyKcal)} kcal`
      : '能量待补全';
  const macro = (label: string, dg: number | null): string => {
    const grams = formatGramsFromDg(dg);
    return grams === '待补全' ? `${label}待补全` : `${label} ${grams}g`;
  };
  return [energy, macro('蛋白', nutrition.proteinDg), macro('脂肪', nutrition.fatDg), macro('碳水', nutrition.carbDg)].join(' · ');
}

/** 计划状态徽标样式：错误类红、待处理类橙、就绪类绿。 */
function planStateBadge(state: string): string {
  switch (state) {
    case 'ok':
      return 'badge-ok';
    case 'loading':
    case 'idle':
      return 'badge-info';
    case 'unsupported':
    case 'error':
    case 'lock-conflict':
      return 'badge-err';
    case 'no-profile':
    case 'no-plan':
    case 'all-handled':
      return 'badge-warn';
    default:
      return 'badge-info';
  }
}

/** 餐次签的已记/已结束/待吃状态：只读 meal 视图，不写任何状态。 */
function tabState(view: MealView): { text: string; kind: string } {
  if (view.confirmed) {
    return { text: '已记', kind: 'ok' };
  }
  if (view.ended) {
    return { text: '已结束', kind: 'muted' };
  }
  if (!view.supply) {
    return { text: '无供应', kind: 'muted' };
  }
  if (view.hasPlan) {
    return { text: '待吃', kind: 'plan' };
  }
  return { text: '未记', kind: 'muted' };
}

/** 首次进入的餐次选择：优先按时间提示，其次选第一餐有供应的，最后回退提示餐。 */
function initialMeal(view: HomeView | null, hour: number): Meal {
  const suggested = suggestedMealByTime(hour);
  if (!view) {
    return suggested;
  }
  const suggestedView = view.meals.find((entry) => entry.meal === suggested);
  if (suggestedView && suggestedView.supply) {
    return suggested;
  }
  const withSupply = view.meals.find((entry) => entry.supply);
  return withSupply ? withSupply.meal : suggested;
}

/**
 * 顶部当前菜单的展示名：来源由 store 判定（builtin/simulated/imported），页面只拼一行可读文本。
 * 示例菜单保留“示例菜单”字样，避免把模拟数据说成真实供应；内置与导入菜单都按食堂名展示。
 */
function menuTitleText(menu: MenuInfoView): string {
  if (menu.source === 'simulated') {
    return `示例菜单 · ${menu.canteenName}`;
  }
  if (menu.source === 'builtin') {
    return `${menu.canteenName} · 内置菜单`;
  }
  return menu.canteenName;
}

Page({
  data: {
    view: null as HomeView | null,
    loadError: '',
    refreshing: false,
    // 共用底部导航：三个主入口用同一份 MAIN_TABS 与同一段 WXML。
    tabs: MAIN_TABS,
    tab: 'today',
    themeClass: 'tk-light',
    // 显示模式首帧用已保存值；切换后立即写回并重绘营养区，不重读业务视图。
    mode: DEFAULT_DISPLAY_MODE as DisplayMode,
    modeLabel: displayModeLabel(DEFAULT_DISPLAY_MODE),
    // 当前选中的餐次：页面浏览状态，不写 store，也不因主题/模式切换改变。
    activeMeal: 'lunch' as Meal,
    mealTouched: false,
    // 以下为展示派生字段（只格式化，不重算业务）。
    dateLine: '',
    menuSimulated: false,
    menuBanner: '',
    canteenName: '',
    // 顶部当前菜单名 + “切换”入口的展示文本（来源由 store 判定，页面只格式化）。
    menuTitle: '',
    mealTabs: [] as any[],
    card: null as any,
    summary: null as any,
    profileReady: true,
    planBadge: 'badge-info',
    planHint: '',
    // “其他方案”默认只给一行状态；说明与技术诊断分开折叠，普通页不堆内部细节。
    planStatusShort: '',
    plansOpen: false,
    planNotes: [] as string[],
    planTechNotes: [] as string[],
    sheetError: '',
    plans: [] as any[],
    topFlags: [] as any[],
    lockIssues: [] as any[],
    soldOutMarks: [] as any[],
    targetNote: '',
    detailOpen: false,
    detail: null as any,
    // 剩余推荐需更新提示：来自 HomeView 派生字段，仅展示 + 复用既有“刷新方案”，不自动重算。
    planUpdate: null as any,
  },

  /** 取得全局唯一 AppStore；全局状态缺失时给出可见提示，不用假数据顶替。 */
  store(): AppStore | null {
    const app = getApp();
    const store = app && app.globalData ? app.globalData.store : null;
    if (!store) {
      wx.showToast({ title: '全局状态未初始化，请重新打开小程序', icon: 'none' });
      return null;
    }
    return store as AppStore;
  },

  // 每次显示都重读 store：记录/菜单/我的页会修改同一份状态，返回今日不能用离开前的缓存。
  onShow() {
    // 外观先于业务内容同步；显示模式与外观互不影响，各自读取自己的键。
    this.setData(applyPageAppearance());
    this.syncDisplayMode();
    this.reload(true);
  },

  /** 从本地读取显示模式（另一页修改过也能同步）；只改展示，不触碰业务状态。 */
  syncDisplayMode() {
    const mode = loadDisplayMode();
    if (mode !== this.data.mode) {
      this.setData({ mode, modeLabel: displayModeLabel(mode) });
    }
  },

  /** 读取今日视图；autoPlan 为真且尚未生成方案时自动请求一次核心。 */
  reload(autoPlan: boolean) {
    const store = this.store();
    if (!store) {
      return;
    }
    try {
      // 先处理跨日：业务日期变化时 store 建新空桶，不迁移昨天的摄入/锁定/售罄。
      store.ensureToday();
      const view = store.getHomeView();
      // 首次进入按时间给餐次提示；用户点过餐次后不再自动改变选择。
      if (!this.data.mealTouched) {
        this.setData({ activeMeal: initialMeal(view, new Date().getHours()) });
      }
      this.applyHome(view);
      // 只在“可规划 + 尚未请求过”时自动生成；缺档案、能力不支持、锁定冲突等
      // 交给用户先处理前置问题，页面不擅自调用核心。
      if (autoPlan && view.canPlan && view.planState === 'idle') {
        this.refreshPlan();
      }
    } catch (error: any) {
      this.setData({ loadError: '读取今日数据失败：' + describeError(error) });
    }
  },

  /** 刷新后整份写回 HomeView，并生成只用于展示的派生字段。 */
  applyHome(view: HomeView) {
    const active = this.data.activeMeal;
    const mealView = view.meals.find((entry) => entry.meal === active) || null;
    // 餐次签：三餐固定顺序，带上“已记/已结束/待吃/无供应”状态，切换后仍能看其他餐次是否已记。
    const mealTabs = MEALS.map((meal) => {
      const entry = view.meals.find((item) => item.meal === meal);
      const state = entry ? tabState(entry) : { text: '无供应', kind: 'muted' };
      return {
        key: meal,
        label: MEAL_LABELS[meal],
        stateText: state.text,
        stateKind: state.kind,
        confirmed: !!entry && entry.confirmed,
      };
    });

    const card = this.buildCard(mealView);
    const detail = this.buildDetail(mealView);
    const summary = this.buildSummary(view);
    // “其他方案”默认只给一行状态 + 必要标记：较长说明与内部实现细节放进折叠区。
    // 命中内部细节（算法名/契约字段/核心状态码等）的文案只进技术信息，仍可诊断。
    const planNotes: string[] = [];
    const planTechNotes: string[] = [];
    const pushPlanNote = (text: string, prefix = '') => {
      if (!text) {
        return;
      }
      (hasInternalDetail(text) ? planTechNotes : planNotes).push(prefix + text);
    };
    pushPlanNote(view.planMessage);
    if (view.lastAction) {
      pushPlanNote(view.lastAction, '上次操作：');
    }
    if (!view.canPlan && view.capabilityMessage) {
      planTechNotes.push(view.capabilityMessage);
    }
    const planStatusCodes = [view.planStatus, view.planStatusLabel].filter(Boolean).join(' / ');
    if (planStatusCodes) {
      planTechNotes.push(`推荐状态：${planStatusCodes}`);
    }
    const plans = view.plans.map((plan) => {
      // store 对未知策略会回显原文；普通页只展示可读名，原文放技术信息。
      const rawTitle = plan.title;
      const title = hasInternalDetail(rawTitle) ? `方案 ${plan.index + 1}` : rawTitle;
      if (title !== rawTitle) {
        planTechNotes.push(`方案 ${plan.index + 1} 原始名称：${rawTitle}`);
      }
      return {
        index: plan.index,
        title,
        priceLabel: plan.priceLabel || money(plan.priceCents),
        deviationText: `营养偏差 ${(plan.nutritionDeviationBp / 100).toFixed(1)}%`,
        completenessText:
          COMPLETENESS_LABELS[plan.nutritionCompleteness] || plan.nutritionCompleteness || '',
        flagLabels: plan.flags,
        selected: plan.selected,
      };
    });
    const lockIssues = view.lockIssues.map((issue, index) => ({
      index,
      meal: issue.meal,
      kind: issue.kind,
      kindLabel: issue.kind === 'window' ? '窗口锁定' : '菜品锁定',
      mealLabel: MEAL_LABELS[issue.meal],
      label: issue.label,
      reason: issue.reason,
      windowId: issue.windowId || '',
      offerId: issue.offerId || '',
      resolvable: issue.kind === 'window' ? !!issue.windowId : !!issue.offerId,
    }));
    const soldOutMarks = view.soldOutMarks.map((mark, index) => ({
      index,
      meal: mark.meal,
      mealLabel: MEAL_LABELS[mark.meal],
      dishId: mark.dishId,
      dishName: mark.dishName,
      windowId: mark.windowId || '',
      windowName: mark.windowName || '',
      label: mark.label,
    }));
    // 目标不可用时说明原因与可用入口；可用时不占用今日页空间（目标详情在档案页）。
    const target = view.target;
    const targetNote =
      target && !target.available
        ? `自动营养目标暂不可用（${target.statusLabel}）：${target.message}`
        : '';

    // 顶部总提示与所选方案卡片重复的标签不重复列出，同一屏只保留一处估算/限制提示。
    const selectedPlanFlags = view.plans
      .filter((plan) => plan.selected)
      .reduce((set, plan) => {
        plan.flags.forEach((flag) => set.add(flag));
        return set;
      }, new Set<string>());
    const topFlags = view.flags
      .filter((label) => !selectedPlanFlags.has(label))
      .map((label, index) => ({ label, index }));

    // 先算齐全部派生字段再一次性 setData，避免多次提交造成中间态闪烁。
    // “推荐需更新”只在 store 判定过期时出现：只提示 + 指向既有刷新入口，不自动重算。
    const planUpdate = view.planNeedsUpdate
      ? {
          message: view.planUpdateMessage || '已有新的记录，剩余餐次的推荐可能已过期。',
          mealsLabel: (view.planUpdateMeals || []).map((meal) => MEAL_LABELS[meal]).join('、'),
        }
      : null;
    this.setData({
      view,
      loadError: '',
      planUpdate,
      dateLine: view.dateLabel + ' · ' + view.weekdayLabel,
      menuSimulated: view.menu.simulated,
      menuBanner: view.menu.banner,
      canteenName: view.menu.canteenName,
      menuTitle: menuTitleText(view.menu),
      mealTabs,
      card,
      detail,
      summary,
      profileReady: view.profileReady,
      planBadge: planStateBadge(view.planState),
      planHint: PLAN_STATE_HINTS[view.planState] || '',
      planStatusShort: PLAN_STATE_LABELS[view.planState] || '状态待确认',
      planNotes,
      planTechNotes,
      plans,
      topFlags,
      lockIssues,
      soldOutMarks,
      targetNote,
    }, () => {
      // 冷启动“JS 启动→首页首次渲染完成”时间戳（工具侧观测点，不代表真机达标）。
      const app: any = getApp();
      if (app && app.globalData && !app.globalData.firstHomeAtMs) {
        app.globalData.firstHomeAtMs = nowMs();
      }
    });
  },

  /** 本餐卡：按设计顺序给出 菜名/份量/价格 → 热量 → 搭配 → 完整模式营养区 → 操作。 */
  buildCard(mealView: MealView | null): any {
    if (!mealView) {
      return null;
    }
    const incomplete = mealView.incompleteNutrients || [];
    const energyUnknown = incomplete.indexOf('energyKcal') >= 0 || incomplete.indexOf('energy') >= 0;
    const energyKcal =
      !energyUnknown && mealView.knownSums && typeof mealView.knownSums.energyKcal === 'number'
        ? mealView.knownSums.energyKcal
        : null;
    const estimated = mealView.items.some((item) => item.estimated);
    const heat = energyDisplay(energyKcal, estimated);
    const categories = mealView.items.map((item) => item.category);
    const macro: MacroShareResult =
      this.data.mode === 'full'
        ? buildMacroShares(mealView.knownSums as any, incomplete)
        : { state: 'incomplete', rows: [], totalEnergy: null, showBar: false, note: '' };

    const dishes = mealView.items.map((item: ItemView) => ({
      itemKey: item.itemKey,
      offerId: item.offerId,
      dishId: item.dishId,
      windowId: item.windowId || '',
      name: item.name,
      portionText: item.portionLabel,
      quantity: item.quantity,
      priceLabel: item.priceLabel,
      estimated: item.estimated,
      locked: item.locked,
      soldOut: item.soldOut,
      unknownLabel: item.unknownLabel,
    }));

    // 状态说明只保留“这餐本身”的事实（已确认/已结束/无供应/缺项），
    // 生成进度放在“其他方案”，避免本餐卡堆叠诊断。
    let statusNote = '';
    if (!mealView.supply) {
      statusNote = '当前菜单没有窗口供应这一餐。';
    } else if (mealView.ended) {
      statusNote = '这餐已结束：不虚构摄入，也不自动补推；可重开或去记录页补记。';
    } else if (mealView.confirmed) {
      statusNote = '这餐已记录，推荐不会覆盖已吃快照；如需修改请到记录页。';
    } else if (mealView.priceIncomplete) {
      statusNote = '含价格未填的菜品：计划合计只按已知金额小计。';
    } else if (incomplete.length > 0) {
      statusNote = '含营养未补全的菜品：不承诺达标，详情可看已知小计与缺项。';
    }

    return {
      meal: mealView.meal,
      mealLabel: mealView.label,
      windowText: mealView.windowName ? mealView.windowName : '窗口未确定',
      supply: mealView.supply,
      hasPlan: mealView.hasPlan,
      confirmed: mealView.confirmed,
      ended: mealView.ended,
      dishes,
      emptyText: mealView.supply ? '这餐还没有推荐菜品' : '当前菜单没有窗口供应这一餐',
      plannedPriceText: plannedSumLabel(mealView.plannedKnownCents, mealView.priceIncomplete),
      priceIncomplete: mealView.priceIncomplete,
      heatText: heat.text,
      heatUnknown: heat.unknown,
      heatEstimated: heat.estimated,
      // “估算”已由热量大字旁的 tag 表达，不再重复一行“营养为估算值”。
      pairingText: pairingText(categories),
      macro: {
        show: this.data.mode === 'full',
        state: macro.state,
        rows: macro.rows.map((row) => ({
          key: row.key,
          label: row.label,
          // 克数与“待补全”只在同一个映射里拼单位，WXML 不再做条件格式化。
          gramsText: row.gramsText === '待补全' ? '待补全' : `${row.gramsText} 克`,
          percentText: row.percentText,
          barPercent: row.barPercent,
        })),
        showBar: macro.showBar,
        note: macro.note,
        // 整条 style 由 JS 拼好后一次性绑定：WXML 里写 “width: {{x}}%” 会被 IDE 的
        // WXSS 校验当成残缺声明（css-semicolonexpected / at-rule expected），整串绑定可避开。
        barStyleProtein: this.barStyle(macro, 'proteinDg'),
        barStyleFat: this.barStyle(macro, 'fatDg'),
        barStyleCarb: this.barStyle(macro, 'carbDg'),
      },
      statusNote,
      // “估算”已由热量旁的 tag 表达：去掉重复的“含估算数据”flag，避免同一屏两次估算提示。
      flags: heat.estimated ? mealView.flags.filter((flag) => flag !== '含估算数据') : mealView.flags,
      canConfirm: mealView.supply && !mealView.ended && !mealView.confirmed && mealView.items.length > 0,
      canSwap:
        mealView.hasPlan &&
        mealView.items.length > 0 &&
        mealView.swappableOffers.length > 0 &&
        !mealView.ended &&
        !mealView.confirmed,
      windowLocked: mealView.windowLocked,
      windowActionable: !!mealView.hasPlan && !!mealView.windowId && !mealView.ended && !mealView.confirmed,
      canEnd: mealView.supply && !mealView.confirmed && !mealView.ended,
      canReopen: mealView.ended,
    };
  },

  /**
   * 比例条某一段的完整 style 字符串；没有完整比例时宽度 0（WXML 据此不画条）。
   * 返回整串而不是数字，避免 WXML 里出现内嵌 {{}} 的 CSS 声明触发 IDE 校验误报。
   */
  barStyle(macro: any, key: string): string {
    if (!macro || !macro.showBar) {
      return 'width: 0%;';
    }
    const row = (macro.rows || []).find((entry: any) => entry.key === key);
    const percent = row ? row.barPercent : 0;
    return `width: ${percent}%;`;
  },

  /** 本餐详情：已知小计、缺项、菜品明细与锁定/售罄操作入口。 */
  buildDetail(mealView: MealView | null): any {
    if (!mealView) {
      return null;
    }
    const items = mealView.items.map((item: ItemView) => ({
      itemKey: item.itemKey,
      offerId: item.offerId,
      dishId: item.dishId,
      windowId: item.windowId || '',
      name: item.name,
      portionLabel: item.portionLabel,
      quantity: item.quantity,
      priceLabel: item.priceLabel,
      estimated: item.estimated,
      locked: item.locked,
      soldOut: item.soldOut,
      unknownLabel: item.unknownLabel,
      nutritionText: item.nutrition ? nutritionSummaryText(item.nutrition) : '营养待补全',
    }));
    return {
      mealLabel: mealView.label,
      windowText: mealView.windowName ? mealView.windowName : '窗口未确定',
      planStatusLabel: mealView.planStatusLabel,
      items,
      knownSumsText: nutritionSummaryText(mealView.knownSums),
      incompleteText: nutrientText(mealView.incompleteNutrients),
      targetText: mealView.target ? nutritionSummaryText(mealView.target) : '',
      plannedKnownLabel: money(mealView.plannedKnownCents),
      priceIncomplete: mealView.priceIncomplete,
      actionsEnabled: !mealView.confirmed && !mealView.ended,
      windowActionable: !!mealView.hasPlan && !!mealView.windowId && !mealView.ended && !mealView.confirmed,
      windowLocked: mealView.windowLocked,
      canSwap: mealView.swappableOffers.length > 0 && mealView.items.length > 0 && !mealView.ended && !mealView.confirmed,
    };
  },

  /** 今日小结：只写实际记录（已记餐次/已知摄入/实付），计划与已花分开。 */
  buildSummary(view: HomeView): any {
    const intake = view.intake;
    const budget = view.budget;
    return {
      recordedText:
        view.progress.confirmedMeals > 0
          ? `今天已记 ${view.progress.confirmedMeals} 餐`
          : '今天还没记录',
      progressText: view.progress.text,
      energyText:
        intake.energyKcal === null || intake.energyKcal === undefined
          ? '待补全'
          : `${Math.round(intake.energyKcal)} 千卡`,
      energyIncomplete: intake.incompleteNutrients.length > 0,
      energyIncompleteText: intake.incompleteNutrients.join('、'),
      spentText: paidSumLabel(intake.priceKnownCents, intake.priceIncomplete),
      spentIncomplete: intake.priceIncomplete,
      budgetSet: budget.budgetSet,
      budgetLabel: budget.budgetLabel,
      plannedLabel: budget.plannedLabel,
      plannedIncomplete: budget.plannedPriceIncomplete,
      spentLabel: budget.spentLabel,
      remainingLabel: budget.remainingKnown ? money(budget.remainingKnownCents) : '实付待补全',
      remainingKnown: budget.remainingKnown,
      overBudget: budget.overBudget,
      overageLabel: money(budget.overageCents),
      accountingComplete: budget.accountingComplete,
    };
  },

  /** 生成/刷新方案；stale（旧响应被丢弃）不算失败，静默忽略。 */
  async refreshPlan() {
    const store = this.store();
    if (!store || this.data.refreshing) {
      return;
    }
    this.setData({ refreshing: true });
    try {
      const outcome = await store.refreshPlan();
      this.applyHome(store.getHomeView());
      if (!outcome.ok && !outcome.stale) {
        wx.showToast({ title: outcome.message || '生成方案失败', icon: 'none' });
      }
    } catch (error: any) {
      wx.showToast({ title: '生成方案异常：' + describeError(error), icon: 'none' });
      this.reload(false);
    } finally {
      this.setData({ refreshing: false });
    }
  },

  onRefreshPlan() {
    this.refreshPlan();
  },

  /** 同步 store 动作统一收口：失败必须可见，并总是按最新状态重渲染。 */
  runAction(action: (store: AppStore) => ActionResult) {
    const store = this.store();
    if (!store) {
      return;
    }
    try {
      const result = action(store);
      this.applyHome(store.getHomeView());
      if (!result.ok) {
        wx.showToast({ title: result.message || '操作失败', icon: 'none' });
      }
    } catch (error: any) {
      wx.showToast({ title: '操作异常：' + describeError(error), icon: 'none' });
      this.reload(false);
    }
  },

  /** 从最近一次 HomeView 快照读取稳定 ID 与候选列表；快照为空时放弃动作。 */
  findMeal(meal: Meal): MealView | null {
    const view = this.data.view as HomeView | null;
    if (!view) {
      return null;
    }
    return view.meals.find((entry) => entry.meal === meal) || null;
  },

  // -------------------------------------------------------------------------
  // 今日页交互（只改本地展示状态，不写业务数据）
  // -------------------------------------------------------------------------

  /** 切换当前餐次：只改浏览选择；不写记录、不改计划、不重算。 */
  onSelectMeal(e: any) {
    const meal = String(e.currentTarget.dataset.meal) as Meal;
    if (MEALS.indexOf(meal) < 0 || meal === this.data.activeMeal) {
      return;
    }
    this.setData({ activeMeal: meal, mealTouched: true, detailOpen: false });
    const view = this.data.view as HomeView | null;
    if (view) {
      this.applyHome(view);
    }
  },

  /**
   * 简易 ⇄ 完整：保存成功才切换展示；失败保持原模式并提示，不谎称已保存。
   * 切换只重绘营养区文案，不重读 store，因此不会触发重新规划、记餐或改变当前餐次。
   */
  onToggleMode() {
    const next = otherDisplayMode(this.data.mode);
    if (!saveDisplayMode(next)) {
      wx.showToast({ title: '设置没保存，请重试', icon: 'none' });
      return;
    }
    this.setData({ mode: next, modeLabel: displayModeLabel(next) });
    const view = this.data.view as HomeView | null;
    if (view) {
      this.applyHome(view);
    }
  },

  onOpenDetail() {
    this.setData({ detailOpen: true });
  },

  onCloseDetail() {
    this.setData({ detailOpen: false });
  },

  /** “其他方案”：默认只显示一行状态，说明与技术信息按需展开。 */
  onTogglePlansDetail() {
    this.setData({ plansOpen: !this.data.plansOpen });
  },

  /**
   * “自己选菜”：普通日常入口，进入独立次级页（T05S03）。
   * 草稿、选择与确认都在自选页完成；本页只带当前餐次过去，不预置任何选择。
   */
  onOpenSelfPick() {
    const meal = this.data.activeMeal;
    wx.navigateTo({
      url: `/pages/self-pick/index?meal=${meal}`,
      fail: (error: any) =>
        wx.showToast({ title: '打开自选菜失败：' + describeError(error), icon: 'none' }),
    });
  },

  /**
   * 顶部“当前菜单/切换”入口：直达已有的菜单与备份页导入分区。
   * 切换仍走页面里的既有 preflight → 影响确认 → applyMenu 流程，不在这里自动替换、
   * 不越过确认、锁定处理或已吃保护。
   */
  onOpenMenuSwitch() {
    wx.navigateTo({
      url: '/pages/menu/index?focus=import',
      fail: (error: any) =>
        wx.showToast({ title: '打开菜单页失败：' + describeError(error), icon: 'none' }),
    });
  },

  // -------------------------------------------------------------------------
  // 业务动作（全部复用现有 store 实现）
  // -------------------------------------------------------------------------

  /** 主操作“确认吃了”：先到记录页打开该餐确认区，由用户核对实付后写入。 */
  onConfirmMeal() {
    const meal = this.data.activeMeal;
    wx.navigateTo({
      url: `/pages/logs/index?meal=${meal}`,
      fail: (error: any) =>
        wx.showToast({ title: '打开记录页失败：' + describeError(error), icon: 'none' }),
    });
  },

  /** 查看记录：底部导航外，今日小结也提供入口。 */
  onGoLogs() {
    gotoMainTab('logs', 'today');
  },

  onGoProfile() {
    gotoMainTab('profile', 'today');
  },

  onTab(e: any) {
    gotoMainTab(String(e.currentTarget.dataset.tab || ''), 'today');
  },

  onSelectPlan(e: any) {
    const index = Number(e.currentTarget.dataset.index);
    this.runAction((store) => store.selectPlan(index));
  },

  onToggleWindowLock(e: any) {
    const meal = (e.currentTarget.dataset.meal || this.data.activeMeal) as Meal;
    this.runAction((store) => store.toggleWindowLock(meal));
  },

  onToggleItemLock(e: any) {
    const meal = (e.currentTarget.dataset.meal || this.data.activeMeal) as Meal;
    const offerId = String(e.currentTarget.dataset.offer);
    this.runAction((store) => store.toggleItemLock(meal, offerId));
  },

  /** 标记售罄：窗口取当前餐视图快照，不按菜名猜窗口。 */
  onMarkSoldOut(e: any) {
    const meal = (e.currentTarget.dataset.meal || this.data.activeMeal) as Meal;
    const dishId = String(e.currentTarget.dataset.dish);
    const mealView = this.findMeal(meal);
    const windowId = mealView && mealView.windowId ? mealView.windowId : undefined;
    this.runAction((store) => store.markSoldOut(meal, dishId, windowId));
  },

  onClearSoldOut(e: any) {
    const meal = (e.currentTarget.dataset.meal || this.data.activeMeal) as Meal;
    const dishId = String(e.currentTarget.dataset.dish);
    const windowId = e.currentTarget.dataset.window ? String(e.currentTarget.dataset.window) : undefined;
    this.runAction((store) => store.clearSoldOut(meal, dishId, windowId));
  },

  onEndMeal(e: any) {
    const meal = (e.currentTarget.dataset.meal || this.data.activeMeal) as Meal;
    this.runAction((store) => store.endMeal(meal));
  },

  onReopenMeal(e: any) {
    const meal = (e.currentTarget.dataset.meal || this.data.activeMeal) as Meal;
    this.runAction((store) => store.reopenMeal(meal));
  },

  onClearWindowLockIssue(e: any) {
    const meal = e.currentTarget.dataset.meal as Meal;
    this.runAction((store) => store.toggleWindowLock(meal));
  },

  onClearItemLockIssue(e: any) {
    const meal = e.currentTarget.dataset.meal as Meal;
    const offerId = String(e.currentTarget.dataset.offer);
    this.runAction((store) => store.toggleItemLock(meal, offerId));
  },

  /**
   * 已确认 / 已结束的餐次不能换菜：内容已计入实际消费或用户已明确不吃，
   * 页面先拦截，避免弹出无意义的选择面板（store 侧也有同样约束）。
   */
  swapBlockedHint(mealView: MealView): string | null {
    if (mealView.ended) {
      return '该餐已结束，如需换菜请先重开餐次';
    }
    if (mealView.confirmed) {
      return '该餐已确认，如需调整请到记录页改记或撤销';
    }
    return null;
  },

  /** 餐次级换菜：先选被替换项（锁定项不参与），再从同窗口候选中选替代。 */
  async onSwapMeal() {
    const store = this.store();
    if (!store) {
      return;
    }
    const meal = this.data.activeMeal;
    const mealView = this.findMeal(meal);
    if (!mealView) {
      return;
    }
    const blocked = this.swapBlockedHint(mealView);
    if (blocked) {
      wx.showToast({ title: blocked, icon: 'none' });
      return;
    }
    const replaceable = mealView.items.filter((item) => !item.locked);
    if (replaceable.length === 0) {
      wx.showToast({ title: '没有可替换的菜品（锁定项不能直接换）', icon: 'none' });
      return;
    }
    let removeOfferId = replaceable[0].offerId;
    if (replaceable.length > 1) {
      const labels = replaceable.map(
        (item) => `${item.name}（${item.portionLabel}，${item.priceLabel}）`,
      );
      const picked = await this.chooseIndex('选择要替换的菜品', labels);
      if (picked === null) {
        return;
      }
      removeOfferId = replaceable[picked].offerId;
    }
    await this.pickOfferAndSwap(store, mealView, removeOfferId);
  },

  async onSwapItem(e: any) {
    const store = this.store();
    if (!store) {
      return;
    }
    const meal = (e.currentTarget.dataset.meal || this.data.activeMeal) as Meal;
    const offerId = String(e.currentTarget.dataset.offer);
    const mealView = this.findMeal(meal);
    if (!mealView) {
      return;
    }
    const blocked = this.swapBlockedHint(mealView);
    if (blocked) {
      wx.showToast({ title: blocked, icon: 'none' });
      return;
    }
    await this.pickOfferAndSwap(store, mealView, offerId);
  },

  /** 从 swappableOffers 里选替代菜品，再调用 store.swapOffer 由核心重算整餐。 */
  async pickOfferAndSwap(store: AppStore, mealView: MealView, removeOfferId: string) {
    const currentIds = mealView.items.map((item) => item.offerId).concat([removeOfferId]);
    const candidates = mealView.swappableOffers.filter(
      (offer) => currentIds.indexOf(offer.offerId) < 0,
    );
    if (candidates.length === 0) {
      wx.showToast({ title: '同窗口暂无可替换的其他菜品', icon: 'none' });
      return;
    }
    const labels = candidates.map(
      (offer) => `${offer.name}（${offer.portionLabel}，${offer.priceLabel}）`,
    );
    const picked = await this.chooseIndex('选择替代菜品（同窗口优先）', labels);
    if (picked === null) {
      return;
    }
    this.setData({ refreshing: true });
    try {
      const outcome = await store.swapOffer(mealView.meal, removeOfferId, candidates[picked].offerId);
      this.applyHome(store.getHomeView());
      if (!outcome.ok && !outcome.stale) {
        wx.showToast({ title: outcome.message || '换菜失败', icon: 'none' });
      }
    } catch (error: any) {
      wx.showToast({ title: '换菜异常：' + describeError(error), icon: 'none' });
      this.reload(false);
    } finally {
      this.setData({ refreshing: false });
    }
  },

  /** wx.showActionSheet 最多 6 项：超出的候选截断并明确提示，不假装全部可选。 */
  chooseIndex(title: string, labels: string[]): Promise<number | null> {
    return new Promise((resolve) => {
      const shown = labels.slice(0, 6);
      if (labels.length > shown.length) {
        wx.showToast({ title: `候选较多，仅显示前 ${shown.length} 项`, icon: 'none' });
      }
      wx.showActionSheet({
        alertText: title,
        itemList: shown,
        success: (res: any) => {
          this.setData({ sheetError: '' });
          resolve(res.tapIndex);
        },
        fail: (error: any) => {
          const message = describeError(error);
          // 用户取消原生面板同样走 fail（errMsg 含 cancel）：正常操作，静默返回即可。
          if (/cancel/i.test(message)) {
            resolve(null);
            return;
          }
          // 真正打不开面板：给一句可见提示，并保留底层错误供“技术信息”诊断。
          this.setData({ sheetError: message });
          wx.showToast({ title: '选择面板打不开，请重试', icon: 'none' });
          resolve(null);
        },
      });
    });
  },
});
/**
 * pages/logs/index.ts — 记餐页（当日汇总、确认已吃、改撤记录、补记、结束/重开、近 7 天只读历史）。
 *
 * 边界：业务规则全部在 domain/store.ts（幂等、改撤链、预算核算、未知项处理）。
 * 本页只做三件事：1) 视图模型绑定；2) 输入层单位换算（元→分、克→分克）；
 * 3) 表单校验。页面不计算营养/预算，也不直接读写 wx storage 或 core-bridge。
 */
import type { AppStore, LogEditInput, LogEditItemPatch, ManualLogInput } from '../../domain/store';
import type { ItemView, LogItemView, LogNutrition, LogView, LogsView, Meal } from '../../domain/types';
import { summarizeMonthLogs } from '../../domain/logs';
import type { MonthLogsSummary } from '../../domain/logs';
import { applyPageAppearance } from '../../utils/appearance';
import {
  WEEKDAY_LABELS,
  buildMonthGrid,
  mapDateToMonth,
  monthKeyOf,
  monthOfDate,
  monthTitle,
  parseBusinessDate,
  shiftMonth,
} from '../../utils/calendar';
import type { CalendarCell, CalendarMonth } from '../../utils/calendar';
import { loadDisplayMode } from '../../utils/display-mode';
import type { DisplayMode } from '../../utils/display-mode';
import { MAIN_TABS, gotoMainTab } from '../../utils/tabbar';
import { PRICE_PENDING, paidItemLabel, paidSumLabel } from '../../utils/money-display';
import { suggestedMealByTime } from '../../utils/display-mode';
// 本页把 store 的 LogsView 转成“可编辑绑定结构”：只做展示映射与输入解析，不推断业务状态。
// 三种写操作都必须回到 store：confirmMeal（幂等确认键）/ addManualLog（clientToken 幂等）/ editLog（新记录取代旧记录）。
// 未知语义贯穿全页：价格未知不按 0 计、营养未知不按 0 计、历史日期只读不改写。
// onShow 每次回到“今天”，历史只读由 applyView 依据 businessDate 判定，页面不另存权限状态。
// 餐次标签（早餐/午餐/晚餐）只是“看哪一餐”的浏览范围：切标签不写记录、不改日期、不重算汇总；
// 当日/月度汇总仍按全部有效餐次统计（口径在 domain/logs.ts，页面不随选中标签缩水）。

/** 底部导航（今日 / 记录 / 我的，共用 utils/tabbar.ts 的唯一实现）。 */

// 展示文案与契约枚举必须同序对应：picker 下标 → PORTION_CODES 映射，顺序错了会把半份记成整份。
const PORTION_OPTIONS = ['整份', '半份'];
const PORTION_CODES: ('full' | 'half')[] = ['full', 'half'];

/** 计划菜品行（确认前可改实付单价）。 */
// priceText 是“确认面板里可编辑的元字符串”；priceKnown=false 时 priceText 为空串，留空即“实付未知”。
interface PlanPriceRow {
  itemKey: string;
  name: string;
  portionLabel: string;
  priceLabel: string;
  priceText: string;
  priceKnown: boolean;
}

/** 有效记录的单个菜品行（修改数量/实付价/备注）。 */
// editItems 每次展开修改时由 buildActive 从 store 快照重建；noteText 空串表示“不改原备注”。
interface EditItemRow {
  itemKey: string;
  name: string;
  portionLabel: string;
  quantityText: string;
  priceText: string;
  noteText: string;
}

/** 记录内菜品展示行。 */
// 展示行保留 itemKey：撤销/改记都靠 recordId + itemKey 定位，页面不用名称匹配。
interface LogItemRow {
  itemKey: string;
  name: string;
  portionLabel: string;
  quantity: number;
  sourceLabel: string;
  priceLabel: string;
  priceKnown: boolean;
  energyLabel: string;
  energyUnknown: boolean;
}

/** 有效记录（可改可撤）。 */
// 有效记录才能改/撤；editOpen、editItems 属于页面本地 UI 状态，不写回 store。
interface ActiveRecordView {
  recordId: string;
  statusLabel: string;
  badgeClass: string;
  revision: number;
  createdAtLabel: string;
  items: LogItemRow[];
  knownEnergyLabel: string;
  priceLabel: string;
  priceIncomplete: boolean;
  unknownItemCount: number;
  editOpen: boolean;
  editItems: EditItemRow[];
}

/** 历史记录（superseded / revoked，只读）。 */
// 历史记录只读：superseded（被改记取代）/ revoked（已撤销）都不能再改，只展示状态与快照。
interface HistoryRecordView {
  recordId: string;
  statusLabel: string;
  badgeClass: string;
  revision: number;
  createdAtLabel: string;
  items: LogItemRow[];
  knownEnergyLabel: string;
  priceLabel: string;
  priceIncomplete: boolean;
}

/** 补记表单草稿。 */
// clientToken 在“打开补记表单”时生成一次；同一份表单重复提交复用同一 token，由 store 做幂等去重。
interface ManualDraft {
  name: string;
  portionIndex: number;
  portionLabel: string;
  quantityText: string;
  priceKnown: boolean;
  unitPriceText: string;
  nutritionKnown: boolean;
  energyText: string;
  proteinText: string;
  fatText: string;
  carbText: string;
  note: string;
  clientToken: string;
}

/** 每餐绑定结构（视图模型 + 本地表单状态，全部可序列化）。 */
// 每餐独立持有表单状态，互不干扰；patchSection 只改目标餐的字段，避免整页 setData。
interface MealSectionUI {
  meal: Meal;
  label: string;
  ended: boolean;
  confirmed: boolean;
  canConfirm: boolean;
  confirmHint: string;
  planRows: PlanPriceRow[];
  confirmOpen: boolean;
  active: ActiveRecordView[];
  history: HistoryRecordView[];
  manualOpen: boolean;
  manual: ManualDraft;
  manualError: string;
}

/** 餐次标签绑定结构：只决定“看哪一餐”，不携带任何业务写入语义。 */
interface MealTabUI {
  key: Meal;
  label: string;
  stateText: string;
  stateKind: string;
}

// 标签状态与首页 tabState 同序（已记 → 已结束 → 待确认 → 未记），只读 section 字段，不写状态。
function mealTabState(section: MealSectionUI): { text: string; kind: string } {
  if (section.confirmed) {
    return { text: '已记', kind: 'ok' };
  }
  if (section.ended) {
    return { text: '已结束', kind: 'muted' };
  }
  if (section.planRows.length > 0) {
    return { text: '待确认', kind: 'plan' };
  }
  return { text: '未记', kind: 'muted' };
}

// recentDays 只是可看的日期集合；current 表示正在查看，isToday 表示业务上的今天，两者不可混用。
interface RecentDayUI {
  businessDate: string;
  label: string;
  hasLogs: boolean;
  current: boolean;
  isToday: boolean;
}

/** 月历单元格绑定结构：空位（empty）不可点，其余三个标记互相独立。 */
interface CalendarCellUI extends CalendarCell {
  key: string;
  empty: boolean;
}

// 本页所有入口都假定 store 已存在（app.onLaunch 已 init）；缺失属于启动失败，不在这里兜底假数据。
function store(): AppStore {
  return getApp().globalData.store as AppStore;
}

// 记餐页金额都来自 store 的“分”字段，展示层只做 /100；未知价格不经过这个函数（直接显示“价格未知”）。
function money(cents: number): string {
  return `￥${(cents / 100).toFixed(2)}`;
}

/**
 * 金额输入（元）转换为整数分：空串返回 null（= 未知，不按 0），非法返回 NaN。
 * 最多两位小数，避免 0.005 元这类无法用分表示的值被静默四舍五入。
 */
// 与 store 的 priceKnown 语义配套：null 必须伴随 priceKnown=false，不能既说未知又传 0。
function yuanToCents(text: string): number | null {
  const trimmed = String(text === undefined || text === null ? '' : text).trim();
  if (trimmed === '') {
    return null;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return NaN;
  }
  return Math.round(Number(trimmed) * 100);
}

/** 数量：1–99 整数；非法返回 NaN。 */
// 数量上限 99 与 domain 校验保持一致；页面先拦是为了就地提示，而不是替代 store 校验。
function parseQuantity(text: string): number {
  const trimmed = String(text === undefined || text === null ? '' : text).trim();
  if (!/^\d+$/.test(trimmed)) {
    return NaN;
  }
  const value = Number(trimmed);
  return value >= 1 && value <= 99 ? value : NaN;
}

/** 营养数字输入：空串返回 null（未填写），非法返回 NaN。 */
// 营养输入按“每份”填写；克→分克只在 buildManualInput 一次换算，别处不再缩放。
function parseNutrientText(text: string): number | null {
  const trimmed = String(text === undefined || text === null ? '' : text).trim();
  if (trimmed === '') {
    return null;
  }
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    return NaN;
  }
  return Number(trimmed);
}

// createdAt 是 ISO 字符串；解析失败时原样显示，方便排查而不是显示 Invalid Date。
function timeLabel(iso: string): string {
  const date = new Date(iso);
  if (isNaN(date.getTime())) {
    return iso;
  }
  const pad = (value: number): string => (value < 10 ? `0${value}` : String(value));
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** 业务日期 2026-10-20 → 10-20（近 7 天按钮用短标签）。 */
// 只压缩显示，不改变业务日期字符串本身；点击回传的仍是完整日期。
function shortDateLabel(date: string): string {
  const parts = date.split('-');
  return parts.length === 3 ? `${parts[1]}-${parts[2]}` : date;
}

/** 每次打开补记表单生成一次；同一份表单重复点击提交时复用，实现幂等。 */
// token 只保证“同一次打开的表单”重复提交被去重，跨表单不要求全局唯一。
function makeClientToken(): string {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

// 每次打开/关闭补记面板都重置草稿并换新 token；不复用上一份未提交内容，避免串餐。
function emptyManual(): ManualDraft {
  return {
    name: '',
    portionIndex: 0,
    portionLabel: PORTION_OPTIONS[0],
    quantityText: '1',
    priceKnown: false,
    unitPriceText: '',
    nutritionKnown: false,
    energyText: '',
    proteinText: '',
    fatText: '',
    carbText: '',
    note: '',
    clientToken: makeClientToken(),
  };
}

// 计划菜品行同时给出“显示价”与“可编辑价”：确认面板默认带出计划购买价，用户可改成实付价。
// priceKnown=false 时价格为“价格未知”，priceText 留空，由用户决定是否补价（不预填 0）。
function buildPlanRows(items: ItemView[]): PlanPriceRow[] {
  return items.map((item) => {
    const known = item.priceKnown && item.priceCents !== null;
    return {
      itemKey: item.itemKey,
      name: item.name,
      portionLabel: item.portionLabel,
      priceLabel: known ? money(item.priceCents as number) : PRICE_PENDING,
      priceText: known ? ((item.priceCents as number) / 100).toFixed(2) : '',
      priceKnown: known,
    };
  });
}

// 有效/历史记录行：营养或价格任一未知都要有可见标记，不能默默按 0 汇总。
function buildItemRow(item: LogItemView): LogItemRow {
  const energyUnknown = !(item.nutrition && item.nutrition.energyKcal !== null);
  return {
    itemKey: item.itemKey,
    name: item.name,
    portionLabel: item.portionLabel,
    quantity: item.quantity,
    sourceLabel: item.sourceLabel,
    priceLabel: paidItemLabel(item.priceKnown, item.unitPriceCents),
    priceKnown: item.priceKnown && item.unitPriceCents !== null,
    energyLabel: item.energyLabel,
    energyUnknown,
  };
}

/** 记录已付金额标签：已知小计 + 是否完整（未知绝不按 0 展示成完整金额）。 */
// 统一文案：部分已知写“已知实付 ￥X（含未填项）”，全未知写“实付待补全”，真实 0 元仍显示 ￥0.00。
function recordPriceLabel(record: LogView): string {
  return paidSumLabel(record.priceKnownCents, record.priceIncomplete);
}

// badgeClass 固定 badge-ok（有效记录）；历史记录才区分 superseded/revoked 的颜色。
function buildActive(record: LogView): ActiveRecordView {
  return {
    recordId: record.recordId,
    statusLabel: record.statusLabel,
    badgeClass: 'badge-ok',
    revision: record.revision,
    createdAtLabel: timeLabel(record.createdAt),
    items: record.items.map(buildItemRow),
    knownEnergyLabel: record.knownEnergyLabel,
    priceLabel: recordPriceLabel(record),
    priceIncomplete: record.priceIncomplete,
    unknownItemCount: record.unknownItemCount,
    editOpen: false,
    editItems: record.items.map((item) => ({
      itemKey: item.itemKey,
      name: item.name,
      portionLabel: item.portionLabel,
      quantityText: String(item.quantity),
      priceText: item.priceKnown && item.unitPriceCents !== null ? (item.unitPriceCents / 100).toFixed(2) : '',
      // 视图模型不暴露原备注，留空表示“不修改”，避免把已有备注清空。
      noteText: '',
    })),
  };
}

// revoked 用 warning 色、superseded 用 info 色：两者都是历史，但撤销意味着不计入汇总。
function buildHistory(record: LogView): HistoryRecordView {
  return {
    recordId: record.recordId,
    statusLabel: record.statusLabel,
    badgeClass: record.status === 'revoked' ? 'badge-warn' : 'badge-info',
    revision: record.revision,
    createdAtLabel: timeLabel(record.createdAt),
    items: record.items.map(buildItemRow),
    knownEnergyLabel: record.knownEnergyLabel,
    priceLabel: recordPriceLabel(record),
    priceIncomplete: record.priceIncomplete,
  };
}

// 每餐绑定结构从 store 视图重建；confirmOpen/manualOpen 等本地 UI 状态每次重置为关闭。
function buildSection(section: LogsView['meals'][number]): MealSectionUI {
  return {
    meal: section.meal,
    label: section.label,
    ended: section.ended,
    confirmed: section.confirmed,
    canConfirm: section.canConfirm,
    confirmHint: section.confirmHint,
    planRows: buildPlanRows(section.planItems),
    confirmOpen: false,
    active: section.active.map(buildActive),
    history: section.history.map(buildHistory),
    manualOpen: false,
    manual: emptyManual(),
    manualError: '',
  };
}

// 用餐次键反查下标而不是缓存下标：setData 路径依赖数组顺序，顺序变化后仍能定位。
function sectionIndex(sections: MealSectionUI[], meal: string): number {
  for (let i = 0; i < sections.length; i += 1) {
    if (sections[i].meal === meal) {
      return i;
    }
  }
  return -1;
}

/**
 * 校验补记草稿并转换为 store 输入。营养四项必须齐全：核心存储只接受完整四项
 * （缺项会被记为营养未知），此处先拦截，避免用户已填的数字被静默丢弃。
 * 校验只做输入形态：名称/数量/价格格式/营养四项完整性；业务上限与幂等仍由 store.addManualLog 兜底。
 * 营养四项要么全填要么关闭开关：半填会被存储层当作“未知”，等于把用户输入静默丢弃。
 */
function buildManualInput(draft: ManualDraft): { ok: boolean; message: string; input: ManualLogInput | null } {
  const name = draft.name.trim();
  // 名称先 trim 再判空：全空格不算合法名称。
  if (name === '') {
    return { ok: false, message: '请填写食物名称', input: null };
  }
  if (name.length > 60) {
    return { ok: false, message: '食物名称不能超过 60 字', input: null };
  }
  const quantity = parseQuantity(draft.quantityText);
  // 数量解析失败直接返回，不沿用上一个输入值。
  if (isNaN(quantity)) {
    return { ok: false, message: '数量必须是 1–99 的整数', input: null };
  }
  let unitPriceCents: number | null = null;
  if (draft.priceKnown) {
    // 开关打开但金额留空是输入错误：不能把“已知”与 null 混在一起。
    unitPriceCents = yuanToCents(draft.unitPriceText);
    if (unitPriceCents === null) {
      return { ok: false, message: '价格已知时必须填写金额；价格未知请关闭“价格已知”', input: null };
    }
    if (isNaN(unitPriceCents)) {
      return { ok: false, message: '金额格式不正确（最多两位小数）', input: null };
    }
  }
  let nutrition: LogNutrition | null = null;
  if (draft.nutritionKnown) {
    // 四项齐全才构造 nutrition；缺一项直接报错，不做“部分营养”存证。
    const energy = parseNutrientText(draft.energyText);
    const protein = parseNutrientText(draft.proteinText);
    const fat = parseNutrientText(draft.fatText);
    const carb = parseNutrientText(draft.carbText);
    if (energy === null || protein === null || fat === null || carb === null) {
      return { ok: false, message: '营养四项需全部填写（核心只接受完整四项）；否则请关闭“营养已知”', input: null };
    }
    if (isNaN(energy) || isNaN(protein) || isNaN(fat) || isNaN(carb)) {
      return { ok: false, message: '营养数值必须是非负数字', input: null };
    }
    nutrition = {
      energyKcal: Math.round(energy),
      // 输入层单位换算：克 → 分克（契约字段为 *Dg）。
      proteinDg: Math.round(protein * 10),
      fatDg: Math.round(fat * 10),
      carbDg: Math.round(carb * 10),
    };
  }
  return {
    ok: true,
    message: '',
    input: {
      name,
      portionCode: PORTION_CODES[draft.portionIndex] || 'full',
      quantity,
      unitPriceCents: draft.priceKnown ? unitPriceCents : null,
      priceKnown: draft.priceKnown,
      nutrition,
      note: draft.note.trim() === '' ? null : draft.note.trim(),
      clientToken: draft.clientToken,
    },
  };
}

Page({
  data: {
    tabs: MAIN_TABS,
    tab: 'logs',
    // 外观 class 由 utils/appearance.ts 决定；onShow 同步，页面不自己读写偏好。
    themeClass: 'tk-light',
    portionOptions: PORTION_OPTIONS,
    loaded: false,
    readonly: false,
    todayDate: '',
    viewingDate: '',
    businessDate: '',
    dateLabel: '',
    sections: [] as MealSectionUI[],
    // sections 是页面唯一的餐次绑定来源；所有输入都写回对应 section 的本地字段，不直接改 view。
    // 当前选中餐次是页面浏览状态：只决定渲染哪一份 section，不写 store，也不因日期/主题/操作改变。
    activeMeal: 'lunch' as Meal,
    mealTouched: false,
    // 三张餐次标签的展示状态（已记/已结束/待确认/未记）；切换标签不重读 store。
    mealTabs: [] as MealTabUI[],
    recentDays: [] as RecentDayUI[],
    intake: null as LogsView['intake'] | null,
    budget: null as LogsView['budget'] | null,
    intakeIncompleteText: '',
    spentKnownLabel: '',
    plannedKnownLabel: '',
    remainingLabel: '',
    statusText: '',
    statusKind: 'ok', // ok | error
    // 显示模式只影响本页汇总展示（简易只补热量摘要，完整给已有克数）；切换入口不在本页。
    mode: 'simple' as DisplayMode,
    // 月历：默认收起，展开后才渲染网格；状态与“正在查看的日期”保持一致。
    calendarOpen: false,
    calendarTitle: '',
    calendarWeekdays: WEEKDAY_LABELS,
    // 扁平化网格（每行 7 格由样式控制），空位用 empty=true 占位且不可点。
    calendarCells: [] as CalendarCellUI[],
    // 月度汇总短卡（只读；口径在 domain/logs.summarizeMonthLogs）。
    monthLineText: '',
    monthPriceLabel: '',
    monthEnergyLabel: '',
    monthPriceIncomplete: false,
    monthEnergyIncomplete: false,
    monthNoteText: '只统计有效记录；没有记录的天数不按零摄入计算。',
    // 当天没有任何记录（含历史版本）时的空态，不显示“摄入 0”。
    emptyDay: false,
    // 记录页空态操作：去对应餐次补记（只展开表单，不写记录）。
    emptyActionHint: '',
  },

  // 今日页“确认吃了”会带 ?meal= 打开本页：只记录待展开的餐次，不写任何状态。
  // 真正展开在 onShow 取到视图之后，因为需要知道该餐是否可确认、是否有推荐菜品。
  onLoad(query: any) {
    const meal = query && typeof query.meal === 'string' ? query.meal : '';
    this.pendingMeal = ['breakfast', 'lunch', 'dinner'].indexOf(meal) >= 0 ? meal : '';
  },

  // 每次显示都回到“今天”：不恢复上次查看的历史日期，避免把只读页当成可编辑页操作。
  // ensureToday 先切日，getLogsView 不带参数即取今天桶。
  onShow() {
    this.setData(applyPageAppearance());
    this.setData({ mode: loadDisplayMode() });
    const appStore = store();
    appStore.ensureToday();
    // 每次进入都回到“今天”，避免上次查看的历史日期残留为可编辑状态。
    const today = appStore.getLogsView();
    // 重新进入时收拢月历：默认只显示今天与“查看月历”，不把上次展开的网格带进来。
    this.setData({ todayDate: today.businessDate, calendarOpen: false });
    // 首次进入按当前时段选餐；今日页带 ?meal= 时优先该餐次。用户点过标签后保持其选择。
    this.syncActiveMeal();
    this.applyView(today);
    this.refreshMonth();
    this.openPendingMeal();
  },

  /**
   * 首次进入的餐次选择：今日页带 ?meal= 时优先该餐次，否则按当前时段建议一餐。
   * 只改页面本地浏览状态（activeMeal/mealTouched），不读不写业务数据；
   * 用户手动点过标签后不再自动改选，切日期/切主题/改撤都不会重置。
   */
  syncActiveMeal() {
    if (this.pendingMeal) {
      this.setData({ activeMeal: this.pendingMeal as Meal, mealTouched: true });
      return;
    }
    if (!this.data.mealTouched) {
      this.setData({ activeMeal: suggestedMealByTime(new Date().getHours()) });
    }
  },

  /** 展开今日页带过来的待确认餐次（仅限今天、可确认、有推荐菜品）；其余情况什么也不做。 */
  openPendingMeal() {
    const meal = this.pendingMeal;
    if (!meal) {
      return;
    }
    this.pendingMeal = '';
    const index = sectionIndex(this.data.sections, meal);
    if (index < 0) {
      return;
    }
    const section = this.data.sections[index];
    if (this.data.readonly || !section.canConfirm || section.planRows.length === 0) {
      return;
    }
    this.patchSection(index, { confirmOpen: true });
  },

  /** 把 store 视图模型转换为页面绑定结构（不推断任何业务状态）。 */
  // readonly 由“查看日期 ≠ 今天”推导，不是单独保存的状态；历史日期所有写入口都被 WXML 隐藏。
  // remainingLabel 在核算不完整时显示“未知”而不是数字，避免把未知价格当成 0 剩余。
  applyView(view: LogsView) {
    const todayDate = this.data.todayDate;
    // todayDate 在 onShow/onBackToday 时先写入，这里只读取，不在 applyView 里改“今天”。
    const sections = view.meals.map(buildSection);
    // 整页从 store 视图重建 sections：操作成功后的 reload 会重置所有本地面板状态。
    // 当前餐次标签：sections 里找不到原选择时退回第一餐，避免整页没有可见餐次。
    const activeMeal =
      sectionIndex(sections, this.data.activeMeal) >= 0
        ? this.data.activeMeal
        : sections.length > 0
          ? sections[0].meal
          : this.data.activeMeal;
    const mealTabs: MealTabUI[] = sections.map((section) => {
      const state = mealTabState(section);
      return { key: section.meal, label: section.label, stateText: state.text, stateKind: state.kind };
    });
    const recentDays: RecentDayUI[] = view.recentDays.map((day) => ({
      businessDate: day.businessDate,
      label: shortDateLabel(day.businessDate),
      hasLogs: day.hasLogs,
      current: day.businessDate === view.businessDate,
      isToday: day.businessDate === todayDate,
    }));
    const budget = view.budget;
    // 空态按“有没有有效记录”判断：只剩已撤销/被替代历史的日期也没有真正吃过，
    // 不能让撤销后的 0 合计冒充“0 摄入”，所以历史条目不参与空态判断，空态下也不渲染当日汇总。
    const hasAnyActive = sections.some((section) => section.active.length > 0);
    // intake/budget 都来自 store 的 LogsView；页面只拆成展示字符串，不重算合计。
    this.setData({
      loaded: true,
      readonly: view.businessDate !== todayDate,
      viewingDate: view.businessDate,
      businessDate: view.businessDate,
      dateLabel: view.dateLabel,
      sections,
      activeMeal,
      mealTabs,
      recentDays,
      intake: view.intake,
      budget,
      emptyDay: !hasAnyActive,
      emptyActionHint: view.businessDate === todayDate ? '去对应餐次补记，或回今日页生成方案后再确认。' : '',
      intakeIncompleteText: view.intake.incompleteNutrients.join('、'),
      // 不完整营养只列字段名，页面不计算缺多少；未知不等于 0，汇总口径由 store 保持。
      spentKnownLabel: budget.spentLabel,
      plannedKnownLabel: budget.plannedLabel,
      remainingLabel:
        budget.remainingKnown && budget.remainingKnownCents !== null
          ? money(budget.remainingKnownCents)
          : '实付待补全',
    });
  },

  /** 重新读取当前查看日期的视图（操作成功后调用）。 */
  // 操作成功后调用：重新按“正在查看的日期”取视图；历史页操作本应被 WXML 阻止，这里只是防御。
  // 日视图与月汇总一起刷新：编辑/撤销/补记成功后不会出现“日已变、月未变”的不一致。
  reload() {
    const appStore = store();
    appStore.ensureToday();
    const date = this.data.viewingDate || undefined;
    this.applyView(appStore.getLogsView(date));
    this.refreshMonth();
  },

  /** 统一处理 store 的 ActionResult：失败必须可见（页面文案 + toast），成功后刷新视图。 */
  // duplicate=true 是幂等重复提交：记录已存在，提示“未重复累计”而不是报错。
  // 失败只展示 message、不刷新视图（保留用户正在填的表单）；成功才 reload。
  handleResult(result: { ok: boolean; message: string; duplicate?: boolean }) {
    this.setData({ statusText: result.message, statusKind: result.ok ? 'ok' : 'error' });
    if (!result.ok) {
      wx.showToast({ title: result.message, icon: 'none' });
    } else if (result.duplicate) {
      wx.showToast({ title: '已确认过，未重复累计', icon: 'none' });
    }
    if (result.ok) {
      this.reload();
    }
  },

  /** 局部更新某一餐的绑定字段（表单输入不触发整页刷新）。 */
  // 用 sections[index].field 路径做最小 setData：不重建整页，避免输入框失焦。
  patchSection(index: number, patch: Record<string, any>) {
    const data: Record<string, any> = {};
    Object.keys(patch).forEach((key) => {
      data[`sections[${index}].${key}`] = patch[key];
    });
    this.setData(data);
  },

  // -------------------------------------------------------------------------
  // 确认已吃
  // -------------------------------------------------------------------------

  // 确认面板先打开“核对实付价”，再由 onConfirmMeal 一次性提交；两步之间不写任何状态。
  onOpenConfirm(e: any) {
    const index = sectionIndex(this.data.sections, String(e.currentTarget.dataset.meal));
    if (index < 0) {
      return;
    }
    this.patchSection(index, { confirmOpen: true });
  },

  // 取消只收起面板，不写 store；已填的价格字符串保留，重新打开可继续改。
  onCancelConfirm(e: any) {
    const index = sectionIndex(this.data.sections, String(e.currentTarget.dataset.meal));
    if (index < 0) {
      return;
    }
    this.patchSection(index, { confirmOpen: false });
  },

  // 只改面板里的 priceText 字符串，解析发生在提交时；输入过程中不打断用户。
  onPriceInput(e: any) {
    const index = sectionIndex(this.data.sections, String(e.currentTarget.dataset.meal));
    const rowIndex = Number(e.currentTarget.dataset.index);
    if (index < 0 || isNaN(rowIndex)) {
      return;
    }
    this.setData({ [`sections[${index}].planRows[${rowIndex}].priceText`]: e.detail.value });
  },

  /** 确认已吃：把每道计划菜品的实付单价（分 / null=未知）交给 store 幂等确认。 */
  // priceEdits 语义：null=实付未知（priceKnown=false）、数字=已知分；缺失的 itemKey 沿用计划价。
  // store 用 confirmationId（业务日期+餐次+planKey）做幂等键：重复提交返回 duplicate，不重复累计。
  onConfirmMeal(e: any) {
    const meal = String(e.currentTarget.dataset.meal) as Meal;
    const index = sectionIndex(this.data.sections, meal);
    if (index < 0) {
      return;
    }
    const rows = this.data.sections[index].planRows;
    const priceEdits: Record<string, number | null> = {};
    for (let i = 0; i < rows.length; i += 1) {
      const cents = yuanToCents(rows[i].priceText);
      if (cents !== null && isNaN(cents)) {
        this.setData({ statusText: `“${rows[i].name}”的实付价格式不正确（最多两位小数）`, statusKind: 'error' });
        wx.showToast({ title: '实付价格式不正确', icon: 'none' });
        return;
      }
      priceEdits[rows[i].itemKey] = cents;
    }
    const result = store().confirmMeal(meal, priceEdits);
    if (result.ok) {
      this.patchSection(index, { confirmOpen: false });
    }
    this.handleResult(result);
  },

  // -------------------------------------------------------------------------
  // 改记与撤销
  // -------------------------------------------------------------------------

  /** 修改/取消修改：切换某条有效记录的编辑表单。 */
  // editItems 来自 buildActive 的快照，noteText 为空表示“不改原备注”，不会清空已有备注。
  // 编辑面板开关是本地状态；切换不重读 store，避免闭包里的 active 引用失效。
  onToggleEdit(e: any) {
    const meal = String(e.currentTarget.dataset.meal);
    const recordId = String(e.currentTarget.dataset.record);
    const index = sectionIndex(this.data.sections, meal);
    if (index < 0) {
      return;
    }
    const active = this.data.sections[index].active;
    for (let i = 0; i < active.length; i += 1) {
      if (active[i].recordId === recordId) {
        this.setData({ [`sections[${index}].active[${i}].editOpen`]: !active[i].editOpen });
        return;
      }
    }
  },

  // 修改表单只改本地 editItems；点“保存修改”才提交，取消不会写 store。
  onEditItemInput(e: any) {
    const meal = String(e.currentTarget.dataset.meal);
    const recordId = String(e.currentTarget.dataset.record);
    const itemIndex = Number(e.currentTarget.dataset.index);
    const field = String(e.currentTarget.dataset.field);
    const index = sectionIndex(this.data.sections, meal);
    if (index < 0 || isNaN(itemIndex) || !field) {
      return;
    }
    const active = this.data.sections[index].active;
    for (let i = 0; i < active.length; i += 1) {
      if (active[i].recordId === recordId) {
        this.setData({ [`sections[${index}].active[${i}].editItems[${itemIndex}].${field}`]: e.detail.value });
        return;
      }
    }
  },

  /** 保存修改：为每条菜品生成 LogEditItemPatch，交给 store 生成新的 active 记录。 */
  // 保存修改会生成新记录（revision+1，supersedesRecordId 指向旧记录），旧记录转 superseded 保留历史；
  // 因此“改记”不是覆盖写，页面不能假设 recordId 不变。
  // 每条菜品都要提交 patch：缺 itemKey 的旧数据会被 store 拒绝，页面不静默跳过。
  onSaveEdit(e: any) {
    const meal = String(e.currentTarget.dataset.meal);
    const recordId = String(e.currentTarget.dataset.record);
    const index = sectionIndex(this.data.sections, meal);
    if (index < 0) {
      return;
    }
    const record = this.findActive(index, recordId);
    // 记录可能在别处被撤销，找不到就放弃本次修改（不构造临时记录）。
    if (!record) {
      return;
    }
    const patches: LogEditItemPatch[] = [];
    for (let i = 0; i < record.editItems.length; i += 1) {
      const item = record.editItems[i];
      const quantity = parseQuantity(item.quantityText);
      if (isNaN(quantity)) {
        this.setStatus(`“${item.name}”的数量必须是 1–99 的整数`, 'error');
        return;
      }
      const cents = yuanToCents(item.priceText);
      if (cents !== null && isNaN(cents)) {
        this.setStatus(`“${item.name}”的实付价格式不正确（最多两位小数）`, 'error');
        return;
      }
      const patch: LogEditItemPatch = { itemKey: item.itemKey, quantity };
      if (cents === null) {
        // 实付未知：明确标记 priceKnown=false，不按 0 记账。
        patch.priceKnown = false;
        patch.unitPriceCents = null;
      } else {
        patch.priceKnown = true;
        patch.unitPriceCents = cents;
      }
      const note = item.noteText.trim();
      if (note !== '') {
        patch.note = note;
      }
      patches.push(patch);
    }
    const input: LogEditInput = { items: patches };
    this.handleResult(store().editLog(recordId, input));
  },

  // 只查当前 active 列表：历史记录不能继续编辑。
  findActive(index: number, recordId: string): ActiveRecordView | null {
    const active = this.data.sections[index].active;
    for (let i = 0; i < active.length; i += 1) {
      if (active[i].recordId === recordId) {
        return active[i];
      }
    }
    return null;
  },

  /** 撤销记录属于不可逆操作，先二次确认。 */
  // 撤销不可逆（记录转 revoked、历史保留），所以先 showModal 二次确认再调 store；
  // 确认框 success 回调里才调用 revokeLog，取消不写状态。
  // recordId 来自 WXML 绑定的当前记录；撤销按 recordId 而不是下标，防止列表刷新后误撤。
  onRevoke(e: any) {
    const recordId = String(e.currentTarget.dataset.record);
    wx.showModal({
      title: '撤销记餐记录',
      content: '撤销后该记录不再计入实际消费与营养汇总，历史中保留“已撤销”。确定撤销？',
      confirmText: '撤销',
      confirmColor: '#a63a25',
      success: (res: any) => {
        if (!res.confirm) {
          return;
        }
        this.handleResult(store().revokeLog(recordId));
      },
    });
  },

  // -------------------------------------------------------------------------
  // 补记
  // -------------------------------------------------------------------------

  /** 打开补记表单：此时生成新的 clientToken，重复点击提交不会重复累计。 */
  // 每次打开都 emptyManual() → 新 clientToken；未提交就关闭再打开也换 token，避免旧草稿串入。
  onOpenManual(e: any) {
    const index = sectionIndex(this.data.sections, String(e.currentTarget.dataset.meal));
    if (index < 0) {
      return;
    }
    this.patchSection(index, { manualOpen: true, manual: emptyManual(), manualError: '' });
  },

  // 关闭即丢弃本地草稿，不写 store；已提交的记录不受影响。
  onCloseManual(e: any) {
    const index = sectionIndex(this.data.sections, String(e.currentTarget.dataset.meal));
    if (index < 0) {
      return;
    }
    this.patchSection(index, { manualOpen: false, manual: emptyManual(), manualError: '' });
  },

  // 补记输入统一写 sections[index].manual.<field>；文本字段不做即时校验。
  onManualInput(e: any) {
    const index = sectionIndex(this.data.sections, String(e.currentTarget.dataset.meal));
    const field = String(e.currentTarget.dataset.field);
    if (index < 0 || !field) {
      return;
    }
    this.setData({ [`sections[${index}].manual.${field}`]: e.detail.value });
  },

  // 开关只打开/关闭输入项，不校验已填数字；关闭“营养已知”等于放弃这组数字。
  onManualSwitch(e: any) {
    const index = sectionIndex(this.data.sections, String(e.currentTarget.dataset.meal));
    const field = String(e.currentTarget.dataset.field);
    if (index < 0 || !field) {
      return;
    }
    this.setData({ [`sections[${index}].manual.${field}`]: !!e.detail.value });
  },

  // 同时更新 portionIndex 与 portionLabel：前者用于提交，后者只用于显示。
  onManualPortion(e: any) {
    const index = sectionIndex(this.data.sections, String(e.currentTarget.dataset.meal));
    if (index < 0) {
      return;
    }
    const portionIndex = Number(e.detail.value) || 0;
    this.setData({
      [`sections[${index}].manual.portionIndex`]: portionIndex,
      [`sections[${index}].manual.portionLabel`]: PORTION_OPTIONS[portionIndex] || PORTION_OPTIONS[0],
    });
  },

  // 提交前在页面校验形态，失败只改 manualError（面板内提示），不弹整页错误。
  onManualSubmit(e: any) {
    const meal = String(e.currentTarget.dataset.meal) as Meal;
    const index = sectionIndex(this.data.sections, meal);
    if (index < 0) {
      return;
    }
    const built = buildManualInput(this.data.sections[index].manual);
    if (!built.ok || !built.input) {
      this.patchSection(index, { manualError: built.message });
      return;
    }
    const result = store().addManualLog(meal, built.input);
    if (result.ok) {
      this.patchSection(index, { manualOpen: false, manual: emptyManual(), manualError: '' });
    }
    this.handleResult(result);
  },

  // -------------------------------------------------------------------------
  // 结束 / 重开餐次
  // -------------------------------------------------------------------------

  // 结束餐次不可虚构摄入，先确认再调用 store；重开不需要确认（可逆）。
  onEndMeal(e: any) {
    const meal = String(e.currentTarget.dataset.meal) as Meal;
    const index = sectionIndex(this.data.sections, meal);
    if (index < 0) {
      return;
    }
    const label = this.data.sections[index].label;
    wx.showModal({
      title: `结束${label}`,
      content: '结束餐次不会虚构摄入，该餐不参与后续规划；之后可重开或补记。确定结束？',
      confirmText: '结束',
      success: (res: any) => {
        if (!res.confirm) {
          return;
        }
        this.handleResult(store().endMeal(meal));
      },
    });
  },

  // 重开只移除 ended 标记；已确认的记录不受影响，方案需回今日页重新生成。
  onReopenMeal(e: any) {
    const meal = String(e.currentTarget.dataset.meal) as Meal;
    this.handleResult(store().reopenMeal(meal));
  },

  // -------------------------------------------------------------------------
  // 餐次标签（只换查看范围：不写记录、不改日期、不重算汇总）
  // -------------------------------------------------------------------------

  /** 切换早餐/午餐/晚餐标签：只改页面浏览选择，不写记录、不重读 store、不动日期与月汇总。 */
  // 三张标签都带状态，切走后仍能看到另外两餐已记/未记；各餐本地面板状态按 section 各自保留。
  onSelectMeal(e: any) {
    const meal = String(e.currentTarget.dataset.meal) as Meal;
    if (sectionIndex(this.data.sections, meal) < 0 || meal === this.data.activeMeal) {
      return;
    }
    this.setData({ activeMeal: meal, mealTouched: true });
  },

  // -------------------------------------------------------------------------
  // 日期切换与导航
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // 月历与月度汇总（只读视图；不新增记录、不触发规划）
  // -------------------------------------------------------------------------

  /** 当前查看日期所在月份；日期非法时退回今天所在月份。 */
  viewingMonth(): CalendarMonth {
    return (
      monthOfDate(this.data.viewingDate) ||
      monthOfDate(this.data.todayDate) || { year: 1970, month: 1 }
    );
  },

  /**
   * 刷新月度汇总与“有记录”日期集合。
   * 只读 store.getMonthLogs 的落库日志，用 domain/logs 的有效记录口径汇总；
   * 页面不重算营养或金额，也不为缺失日期补零。
   */
  refreshMonth() {
    const month = this.viewingMonth();
    const key = monthKeyOf(month.year, month.month);
    const entries = store().getMonthLogs(key);
    const summary: MonthLogsSummary = summarizeMonthLogs(key, entries);
    this.recordDates = summary.activeDates.slice();
    // 已知合计本身可能是 0，但只要含未填项就不能写成“0 元”（那等于把未知按 0）。
    // 统一走 paidSumLabel：部分已知 → “已知实付 ￥X（含未填项）”；全未知 → “实付待补全”。
    const energyText = `${summary.knownEnergyKcal} kcal`;
    this.setData({
      monthLineText: `本月已记 ${summary.dayCount} 天 · ${summary.mealCount} 餐`,
      monthPriceLabel: paidSumLabel(summary.knownPriceCents, summary.priceIncomplete),
      monthEnergyLabel: summary.energyIncomplete
        ? summary.knownEnergyKcal === 0
          ? '未知（含未填项）'
          : `${energyText}（含未填项）`
        : energyText,
      monthPriceIncomplete: summary.priceIncomplete,
      monthEnergyIncomplete: summary.energyIncomplete,
    });
    this.buildCalendar(month);
  },

  /** 按给定月份重建网格；选中/今天/有记录三种标记同时给出，选中不只靠颜色区分。 */
  buildCalendar(month: CalendarMonth) {
    const grid = buildMonthGrid(month, {
      selectedDate: this.data.viewingDate,
      todayDate: this.data.todayDate,
      recordDates: this.recordDates || [],
    });
    const cells: CalendarCellUI[] = [];
    grid.forEach((week, weekIndex) => {
      week.forEach((cell, cellIndex) => {
        if (cell) {
          cells.push(Object.assign({ key: cell.date, empty: false }, cell));
        } else {
          // 空位只占网格，不绑定日期：点它不会切换查看日期。
          cells.push({ key: `e-${weekIndex}-${cellIndex}`, empty: true, date: '', day: 0, isToday: false, selected: false, hasRecords: false });
        }
      });
    });
    this.setData({
      calendarTitle: monthTitle(month.year, month.month),
      calendarCells: cells,
    });
  },

  /** 展开/收起月历；展开时按“正在查看的日期”重建网格，不改变业务状态。 */
  onToggleCalendar() {
    const next = !this.data.calendarOpen;
    this.setData({ calendarOpen: next });
    if (next) {
      this.buildCalendar(this.viewingMonth());
    }
  },

  // 前后月份：把原选中日的“日序号”映射到新月份（31 → 30/29/28），并立即刷新该日详情，
  // 保证月历标题、选中格与下方详情始终指向同一天（不跨月沿用无效日期）。
  onPrevMonth() {
    this.switchCalendarMonth(-1);
  },

  onNextMonth() {
    this.switchCalendarMonth(1);
  },

  switchCalendarMonth(delta: number) {
    const target = shiftMonth(this.viewingMonth(), delta);
    const mapped = mapDateToMonth(this.data.viewingDate, target);
    this.loadDate(mapped);
  },

  /**
   * 只读切换查看日期：仅调用 getLogsView(date) 取视图，不写业务状态、不补记、不触发规划。
   * 同时刷新月汇总，使“选中日期 / 月汇总 / 网格标记”同源。
   */
  loadDate(date: string) {
    if (!parseBusinessDate(date)) {
      return;
    }
    const appStore = store();
    appStore.ensureToday();
    this.setData({ readonly: date !== this.data.todayDate });
    this.applyView(appStore.getLogsView(date));
    this.refreshMonth();
  },

  /** 点月历日期：保留展开状态，只切换查看日期。 */
  onSelectCalendarDate(e: any) {
    this.loadDate(String(e.currentTarget.dataset.date));
  },

  // 兼容旧入口：近 7 天按钮已由月历取代，保留方法名以免残留绑定失效。
  onSelectDate(e: any) {
    this.loadDate(String(e.currentTarget.dataset.date));
  },

  // 回到今天时同时刷新 todayDate：跨日后“今天”可能已变化；月历回到今天所在月份。
  onBackToday() {
    const appStore = store();
    appStore.ensureToday();
    const today = appStore.getLogsView();
    this.setData({ todayDate: today.businessDate });
    this.applyView(today);
    this.refreshMonth();
  },

  /** 空态“记一餐”：只展开对应餐次的补记表单（不写记录），让普通用户有明确下一步。 */
  onEmptyRecordTap() {
    if (this.data.readonly) {
      return;
    }
    // 空态“记一餐”进的是当前标签对应的餐次，避免展开一个看不见的补记表单。
    const meal = this.data.activeMeal;
    const index = sectionIndex(this.data.sections, meal);
    if (index < 0) {
      return;
    }
    this.patchSection(index, { manualOpen: true, manual: emptyManual(), manualError: '' });
    wx.pageScrollTo({ selector: `#meal-${meal}`, duration: 200, fail() {} });
  },

  // 共用底部导航：当前入口不重复跳转，其余交给 utils/tabbar.ts 的唯一实现。
  onTab(e: any) {
    gotoMainTab(String(e.currentTarget.dataset.tab || ''), 'logs');
  },

  // 页面内状态行 + toast 双通道：状态行保留最近一次结果，toast 只做即时提示。
  setStatus(message: string, kind: string) {
    this.setData({ statusText: message, statusKind: kind });
    if (kind === 'error') {
      wx.showToast({ title: message, icon: 'none' });
    }
  },
});

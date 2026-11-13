/**
 * types.ts — 天科食客前端领域模型、本地存储结构与页面视图模型。
 *
 * 边界：这里只描述“前端要保存什么、页面要显示什么”；营养目标与推荐结果
 * 的正式值一律来自 WASM（TargetResult / PlanResult），本文件不复制公式。
 * 字段名尽量沿用 T01 v1.2 契约（Profile / MenuCatalog / PlanRequest / MealLog）。
 */

// ---------------------------------------------------------------------------
// 基础枚举
// ---------------------------------------------------------------------------

export type Meal = 'breakfast' | 'lunch' | 'dinner';
export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';
export type GoalType = 'maintain' | 'fatLoss' | 'manual';
export type ManualSourceType = 'professional' | 'userEntered';
export type LogStatus = 'active' | 'superseded' | 'revoked';
// 菜单来源：builtin=内置真实菜单（当前为西院西一食堂首批，首次进入的默认来源）；
// simulated=示例菜单（仅开发/演示，导入后仍按示例标注）；imported=用户导入的菜单。
export type CatalogSource = 'builtin' | 'simulated' | 'imported';

export const MEALS: Meal[] = ['breakfast', 'lunch', 'dinner'];
export const MEAL_LABELS: Record<Meal, string> = {
  breakfast: '早餐',
  lunch: '午餐',
  dinner: '晚餐',
};
/**
 * 金额输入统一上限（分）= 人民币 100 万元（1,000,000 元）。
 * 方案确认/改记/补记/自选/预算共用同一边界：非负整数且不超过该值。
 * 只挡误输与极端值，不设更低的“业务金额上限”——食堂日常金额远低于它。
 */
export const MAX_MONEY_CENTS = 100 * 1000 * 1000;

export const ACTIVITY_LABELS: Record<ActivityLevel, string> = {
  sedentary: '久坐（几乎不运动）',
  light: '轻度活动（每周 1–3 次）',
  moderate: '中度活动（每周 3–5 次）',
  active: '高度活动（每周 6–7 次）',
  veryActive: '极高活动（体力工作/每日训练）',
};
export const SEX_LABELS: Record<Sex, string> = { male: '男', female: '女' };
export const GOAL_LABELS: Record<GoalType, string> = {
  maintain: '维持体重',
  fatLoss: '减脂',
  manual: '手动目标',
};

/** 建档页下拉选项（页面直接绑定，避免页面自己维护第二份枚举文案）。 */
export const PROFILE_VIEW_OPTIONS = {
  activityOptions: [
    { value: 'sedentary' as ActivityLevel, label: ACTIVITY_LABELS.sedentary },
    { value: 'light' as ActivityLevel, label: ACTIVITY_LABELS.light },
    { value: 'moderate' as ActivityLevel, label: ACTIVITY_LABELS.moderate },
    { value: 'active' as ActivityLevel, label: ACTIVITY_LABELS.active },
    { value: 'veryActive' as ActivityLevel, label: ACTIVITY_LABELS.veryActive },
  ],
  goalOptions: [
    { value: 'maintain' as GoalType, label: GOAL_LABELS.maintain },
    { value: 'fatLoss' as GoalType, label: GOAL_LABELS.fatLoss },
    { value: 'manual' as GoalType, label: GOAL_LABELS.manual },
  ],
};
export const STRATEGY_LABELS: Record<string, string> = {
  primary: '主推荐',
  economy: '经济备选',
  taste: '口味备选',
};

/**
 * 当前受支持算法子集：贪心、动态规划、分支限界（核心冻结 WASM 已实现三者）。
 * 扩展时四处必须同步：本常量、app-state 载入校验、store.saveSettings、plan/utils 能力检查。
 */
export const SUPPORTED_ALGORITHMS = ['greedy', 'dp', 'branchAndBound'] as const;
export type SupportedAlgorithm = (typeof SUPPORTED_ALGORITHMS)[number];
/** 默认仍为贪心：新装、旧存储没有该字段时都按贪心规划。 */
export const DEFAULT_ALGORITHM: SupportedAlgorithm = 'greedy';
export const ALGORITHM_LABELS: Record<SupportedAlgorithm, string> = {
  greedy: '贪心',
  dp: '动态规划',
  branchAndBound: '分支限界',
};
/** 设置入口选项（顺序固定：默认贪心在前）；label/desc 供页面直接绑定，页面不维护第二份文案。 */
export const ALGORITHM_OPTIONS: Array<{ value: SupportedAlgorithm; label: string; desc: string }> = [
  { value: 'greedy', label: ALGORITHM_LABELS.greedy, desc: '按窗口局部贪心快速出方案（默认）' },
  { value: 'dp', label: ALGORITHM_LABELS.dp, desc: '全天动态规划；触限时按核心标记近似/未证明最优' },
  { value: 'branchAndBound', label: ALGORITHM_LABELS.branchAndBound, desc: '全天分支限界；触限时按核心标记近似/未证明最优，不称已证明无解' },
];
export const DEFAULT_STRATEGIES = ['primary', 'economy', 'taste'];

/** 判断任意值是否属于当前受支持算法；载入校验与设置门共用，避免两处白名单漂移。 */
export function isSupportedAlgorithm(value: unknown): value is SupportedAlgorithm {
  return (SUPPORTED_ALGORITHMS as readonly unknown[]).indexOf(value) >= 0;
}

// ---------------------------------------------------------------------------
// 菜单（MenuCatalog）
// ---------------------------------------------------------------------------

export interface Nutrition {
  energyKcal: number;
  proteinDg: number;
  fatDg: number;
  carbDg: number;
}

/** 套餐组件：组件单品 dishId + 单个售卖单位内的份数（核心契约 components[]{dishId,count}，count>=1）。 */
export interface ComboComponent {
  dishId: string;
  count: number;
}

export interface Dish {
  dishId: string;
  name: string;
  kind: 'single' | 'combo';
  category?: string;
  riceDish: boolean;
  riceIncluded: boolean;
  components?: ComboComponent[];
  nutrition: Nutrition;
  nutritionBasis: {
    source: string;
    portionAssumption: string;
    estimated: boolean;
    note?: string | null;
  };
  portionBasis?: string | null;
}

export interface Offer {
  offerId: string;
  dishId: string;
  windowId: string;
  mealWindows: Meal[];
  portionCode: 'full' | 'half';
  portionRatioNum: number;
  portionRatioDen: number;
  priceCents: number | null;
  priceBasis: 'unitPrice' | 'comboTotal' | 'unknown';
  nutritionOverride?: Nutrition | null;
}

export interface CatalogWindow {
  windowId: string;
  name: string;
  mealWindows: Meal[];
}

/**
 * 请求版本口径：contractVersion 以字面量类型钉死为 1.0——核心只接受 major=1（minor 向后兼容），
 * 契约升级必须显式修改这里并回归双端一致性；禁止运行时拼接版本串或按响应降级重试。
 */
export interface Catalog {
  contractVersion: '1.0';
  menuVersion: string;
  catalogHash: string;
  canteen: { canteenId: string; name: string };
  windows: CatalogWindow[];
  dishes: Dish[];
  offers: Offer[];
  comboRules: any[];
}

// ---------------------------------------------------------------------------
// Offer 单份营养只读出口（T04A04 契约扩展 v1，WASM 入口 mp_offer_nutrition）
// ---------------------------------------------------------------------------

/** 请求对象：catalog 必须是当前菜单快照，offerIds 有序且唯一。 */
export interface OfferNutritionRequest {
  contractVersion: '1.0';
  catalog: Catalog;
  meal: Meal;
  offerIds: string[];
}

/** 单个报价的单份营养结果；nutrition 各字段 null=未知、0=已知零，均来自核心。 */
export interface OfferNutritionOffer {
  offerId: string;
  dishId: string;
  windowId: string;
  portionCode: 'full' | 'half';
  nutrition: LogNutrition;
  nutritionComplete: boolean;
  estimated: boolean;
}

/** ResultEnvelope.result：offers 与请求 offerIds 同序。 */
export interface OfferNutritionResult {
  menuVersion: string;
  catalogHash: string;
  meal: Meal;
  offers: OfferNutritionOffer[];
}

// ---------------------------------------------------------------------------
// 档案（Profile 的编辑草稿）
// ---------------------------------------------------------------------------

export interface ManualTargetDraft {
  energyKcal: number | null;
  proteinDg: number | null;
  fatDg: number | null;
  carbDg: number | null;
  sourceType: ManualSourceType;
  sourceNote: string | null;
  derivedFields: string[];
}

export interface ProfileDraft {
  sex: Sex;
  ageYears: number;
  heightMm: number;
  weightGrams: number;
  bodyFatPermille: number | null;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  manualTargets: ManualTargetDraft | null;
  trainingPreference: boolean;
  dietaryFlags: { pregnancyOrLactation: boolean; medicalDietManagement: boolean };
  tastes: string[];
}

// ---------------------------------------------------------------------------
// 计划设置
// ---------------------------------------------------------------------------

export interface PlanLimits {
  maxCandidates?: number;
  maxNodes?: number;
}

export interface PlannerSettings {
  /** 全天预算（分）；null 表示未设置预算，0 是“零预算”而非未设置。 */
  budgetCents: number | null;
  /** 规划算法，取值限定在 SUPPORTED_ALGORITHMS 内；默认 greedy。 */
  algorithm: SupportedAlgorithm;
  strategies: string[];
  maxItemsPerMeal: number;
  /**
   * 旧 T02 v2 二进制的真实字段名（limits.maxCandidates / limits.maxNodes）。
   * 不用 T01 新搜索限额字段名，统一迁移留给 T06。
   */
  limits: PlanLimits | null;
}

// ---------------------------------------------------------------------------
// 实际记餐（MealLog）
// ---------------------------------------------------------------------------

export interface LogNutrition {
  energyKcal: number | null;
  proteinDg: number | null;
  fatDg: number | null;
  carbDg: number | null;
}

export interface LogItem {
  itemKey: string;
  source: 'menuOffer' | 'manual';
  offerId: string | null;
  dishId: string | null;
  menuVersion: string | null;
  nameSnapshot: string;
  portionCode: 'full' | 'half';
  quantity: number;
  unitPriceCents: number | null;
  priceKnown: boolean;
  nutrition: LogNutrition | null;
  nutritionBasis: string | null;
  note: string | null;
}

export interface MealLog {
  contractVersion: '1.0';
  recordId: string;
  confirmationId: string;
  businessDate: string;
  tzOffsetMinutes: number;
  meal: Meal;
  status: LogStatus;
  revision: number;
  supersedesRecordId: string | null;
  revokedByRecordId: string | null;
  createdAt: string;
  updatedAt: string;
  menuVersion: string | null;
  items: LogItem[];
}

// ---------------------------------------------------------------------------
// 当日状态
// ---------------------------------------------------------------------------

export interface SoldOutMark {
  businessDate: string;
  windowId: string;
  meal: Meal;
  dishId: string;
  createdAt: string;
}

export interface WindowLock {
  meal: Meal;
  windowId: string;
}

export interface ItemLock {
  meal: Meal;
  offerId: string;
  quantity: number;
}

/** 一次成功 PlanDay 调用的原始记录；用于重启后展示与请求关联核对。 */
export interface PlanRecord {
  requestId: string;
  revision: number;
  profileRevision: number;
  menuVersion: string;
  createdAt: string;
  rawText: string;
}

export interface DayRecord {
  businessDate: string;
  tzOffsetMinutes: number;
  soldOut: SoldOutMark[];
  windowLocks: WindowLock[];
  itemLocks: ItemLock[];
  endedMeals: Meal[];
  logs: MealLog[];
  plan: PlanRecord | null;
  /** 用户在备选方案间的选择，只影响展示；默认 0。 */
  selectedPlanIndex: number;
}

/** 营养目标计算结果缓存（正式值来自 WASM mp_nutrition_target）。 */
export interface TargetCache {
  requestId: string;
  profileRevision: number;
  createdAt: string;
  rawText: string;
}

// ---------------------------------------------------------------------------
// 本地存储根对象
// ---------------------------------------------------------------------------

export interface CatalogMeta {
  source: CatalogSource;
  importedAt: string | null;
  importedFileName: string | null;
}

/** 最近一次导出/恢复的本地记录，用于“菜单与备份”页展示，不参与正式计算。 */
export interface BackupMeta {
  lastExportedAt: string | null;
  lastExportedDigest: string | null;
  lastRestoredAt: string | null;
  lastRestoredDigest: string | null;
  lastFilePath: string | null;
  lastMessage: string;
}

export interface AppState {
  schemaVersion: 1;
  profileId: string | null;
  profileRevision: number;
  profileDraft: ProfileDraft | null;
  /** null 表示使用内置模拟菜单。 */
  catalog: Catalog | null;
  catalogMeta: CatalogMeta;
  settings: PlannerSettings;
  /** 最近一次打开界面的业务日期；用于跨日检测。 */
  activeDate: string;
  days: Record<string, DayRecord>;
  target: TargetCache | null;
  backup: BackupMeta;
}

// ---------------------------------------------------------------------------
// 动作结果与预检
// ---------------------------------------------------------------------------

export interface FieldError {
  field: string;
  message: string;
}

export interface ActionResult {
  ok: boolean;
  message: string;
  errors?: FieldError[];
  duplicate?: boolean;
}

export interface PlanOutcome extends ActionResult {
  status?: string;
  planKey?: string | null;
  stale?: boolean;
}

export interface TargetOutcome extends ActionResult {
  status?: string;
}

export interface MenuDiffView {
  oldMenuVersion: string;
  newMenuVersion: string;
  windowsAdded: string[];
  windowsRemoved: string[];
  dishesAdded: string[];
  dishesRemoved: string[];
  offersAdded: number;
  offersRemoved: number;
  priceChanges: { name: string; oldCents: number | null; newCents: number | null }[];
  impactedMeals: Meal[];
  invalidLocks: { kind: 'window' | 'item'; meal: Meal; label: string; reason: string }[];
  /**
   * 新菜单下失去意义的售罄标记（菜品被删或该窗口不再供应此餐）。
   * 作用域是“窗口 + 餐次 + dishId”，所以同一 dishId 只有部分窗口被清理时，
   * 必须带上 windowId/windowName 才能让用户判断到底哪一条会被删。
   */
  droppedSoldOut: { meal: Meal; label: string; reason: string; windowId: string; windowName: string | null }[];
  keepsPlan: boolean;
}

export interface MenuPreflight {
  ok: boolean;
  stage: 'parse' | 'validate' | 'ready';
  message: string;
  errors: FieldError[];
  fileName: string;
  catalog: Catalog | null;
  diff: MenuDiffView | null;
  token: string | null;
  rawError: string | null;
}

export interface RestorePreflight {
  ok: boolean;
  stage: 'parse' | 'schema' | 'validate' | 'ready';
  message: string;
  errors: FieldError[];
  digest: string | null;
  state: AppState | null;
  summary: string;
  token: string | null;
}

export interface RestoreResult extends ActionResult {
  comparison: { label: string; before: string; after: string; equal: boolean }[];
  digest: string;
}

// ---------------------------------------------------------------------------
// 视图模型
// ---------------------------------------------------------------------------

export interface MenuInfoView {
  source: CatalogSource;
  simulated: boolean;
  menuVersion: string;
  catalogHash: string;
  canteenName: string;
  importedAt: string | null;
  importedFileName: string | null;
  dishCount: number;
  offerCount: number;
  windowCount: number;
  comboRuleCount: number;
  banner: string;
}

export interface ItemView {
  itemKey: string;
  offerId: string;
  dishId: string;
  // 售罄作用域 = 业务日 + 窗口 + 餐次 + dishId；页面解除售罄必须带这个窗口，
  // 否则同一道菜在多个窗口都有标记时 store 只能返回“请指定窗口”的可读失败。
  windowId?: string | null;
  name: string;
  /**
   * 菜品在菜单里的已知食物类别原值（staple/protein/vegetable，未知为 null）。
   * 只用于今日页“搭配说明”；页面不得按菜名猜类别，也不据此生成健康评分。
   */
  category: string | null;
  portionLabel: string;
  quantity: number;
  priceCents: number | null;
  priceKnown: boolean;
  priceLabel: string;
  nutrition: Nutrition | null;
  nutritionKnown: boolean;
  estimated: boolean;
  estimatedLabel: string;
  locked: boolean;
  soldOut: boolean;
  unknownLabel: string;
}

export interface MealView {
  meal: Meal;
  label: string;
  supply: boolean;
  ended: boolean;
  confirmed: boolean;
  hasPlan: boolean;
  planStatus: string;
  planStatusLabel: string;
  windowId: string | null;
  windowName: string | null;
  windowLocked: boolean;
  target: Nutrition | null;
  items: ItemView[];
  knownSums: Nutrition | null;
  incompleteNutrients: string[];
  unknownItemCount: number;
  plannedKnownCents: number;
  priceIncomplete: boolean;
  flags: string[];
  statusMessage: string;
  swappableOffers: { offerId: string; dishId: string; name: string; portionLabel: string; priceLabel: string }[];
}

export interface PlanSummaryView {
  index: number;
  strategies: string[];
  title: string;
  priceCents: number | null;
  priceLabel: string;
  nutritionDeviationBp: number;
  nutritionTier: number;
  nutritionCompleteness: string;
  flags: string[];
  selected: boolean;
}

export interface BudgetView {
  budgetSet: boolean;
  budgetCents: number | null;
  budgetLabel: string;
  plannedTotalCents: number | null;
  plannedKnownCents: number;
  plannedPriceIncomplete: boolean;
  spentKnownCents: number | null;
  spentPriceIncomplete: boolean;
  unknownPriceItemCount: number;
  remainingKnownCents: number | null;
  remainingKnown: boolean;
  overBudget: boolean;
  withinBudgetKnown: boolean;
  overageCents: number | null;
  checkBasis: string;
  accountingComplete: boolean;
  message: string;
  plannedLabel: string;
  spentLabel: string;
}

export interface IntakeView {
  consumedMeals: Meal[];
  itemCount: number;
  energyKcal: number | null;
  proteinDg: number | null;
  fatDg: number | null;
  carbDg: number | null;
  incompleteNutrients: string[];
  priceKnownCents: number;
  priceIncomplete: boolean;
  unknownItemCount: number;
  energyLabel: string;
  proteinLabel: string;
  fatLabel: string;
  carbLabel: string;
}

export interface TargetView {
  available: boolean;
  status: string;
  statusLabel: string;
  eligible: boolean;
  reasons: string[];
  reasonsText: string;
  bmiDisplayTenths: number | null;
  bmiLabel: string;
  ageBand: string;
  age18Extrapolation: boolean;
  daily: Nutrition | null;
  mealReference: Record<string, Nutrition> | null;
  sourceLabel: string;
  componentLabel: string;
  warnings: string[];
  message: string;
  manualStored: boolean;
  manualApplied: boolean;
  manualReason: string;
}

export interface HomeView {
  businessDate: string;
  dateLabel: string;
  weekdayLabel: string;
  tzOffsetMinutes: number;
  menu: MenuInfoView;
  profileReady: boolean;
  profileSummary: string;
  target: TargetView | null;
  planState: 'no-profile' | 'idle' | 'loading' | 'unsupported' | 'error' | 'ok' | 'no-plan' | 'all-handled' | 'lock-conflict';
  planStatus: string;
  planStatusLabel: string;
  planMessage: string;
  plans: PlanSummaryView[];
  selectedPlanIndex: number;
  meals: MealView[];
  intake: IntakeView;
  budget: BudgetView;
  diagnostics: { code: string; message: string }[];
  flags: string[];
  requestId: string | null;
  planCreatedAt: string | null;
  /**
   * 计划生成后又有实际记录写入（确认/自选/补记/改记）时，剩余餐次的推荐已过期。
   * 这是读取时现算的派生标记，不持久化；刷新仍由用户主动"刷新方案"触发，不静默重算。
   */
  planNeedsUpdate: boolean;
  planUpdateMeals: Meal[];
  planUpdateMessage: string;
  canPlan: boolean;
  capabilityMessage: string;
  lockIssues: { kind: 'window' | 'item'; meal: Meal; label: string; reason: string; windowId?: string | null; offerId?: string | null }[];
  /**
   * 当前业务日期的临时售罄标记。windowId/windowName 让页面能区分“同一道菜在不同
   * 窗口售罄”，解除时也能精确到窗口；label 在多窗口菜单下附加窗口名以便人读。
   */
  soldOutMarks: { meal: Meal; label: string; dishId: string; dishName: string; windowId: string; windowName: string | null }[];
  progress: { confirmedMeals: number; totalMeals: number; text: string };
  lastAction: string;
}

export interface LogItemView {
  itemKey: string;
  name: string;
  portionLabel: string;
  quantity: number;
  sourceLabel: string;
  unitPriceCents: number | null;
  priceKnown: boolean;
  priceLabel: string;
  nutrition: LogNutrition | null;
  energyLabel: string;
}

export interface LogView {
  recordId: string;
  confirmationId: string;
  meal: Meal;
  status: LogStatus;
  statusLabel: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  items: LogItemView[];
  knownSums: LogNutrition | null;
  knownEnergyLabel: string;
  priceKnownCents: number;
  priceIncomplete: boolean;
  unknownItemCount: number;
  supersedesRecordId: string | null;
  menuVersion: string | null;
}

export interface MealLogSectionView {
  meal: Meal;
  label: string;
  ended: boolean;
  confirmed: boolean;
  canConfirm: boolean;
  active: LogView[];
  history: LogView[];
  planItems: ItemView[];
  confirmHint: string;
}

export interface LogsView {
  businessDate: string;
  dateLabel: string;
  meals: MealLogSectionView[];
  intake: IntakeView;
  budget: BudgetView;
  recentDays: { businessDate: string; hasLogs: boolean }[];
}

export interface ProfileView {
  draft: ProfileDraft;
  saved: boolean;
  profileRevision: number;
  validationErrors: FieldError[];
  bmiDisplayTenths: number | null;
  bmiLabel: string;
  target: TargetView | null;
  targetState: 'idle' | 'loading' | 'ok' | 'error';
  targetError: string;
  activityOptions: { value: ActivityLevel; label: string }[];
  goalOptions: { value: GoalType; label: string }[];
}

/** 开发诊断页的只读快照；不进入正式首页。 */
export interface DevView {
  appName: string;
  wasmPath: string;
  expectedWasmBytes: number;
  expectedWasmSha256: string;
  storageKey: string;
  storageBytes: number;
  schemaVersion: number;
  /** 当前规划算法（取值受 SUPPORTED_ALGORITHMS 约束）；诊断页据此显示与切换。 */
  algorithm: string;
  businessDate: string;
  catalogSource: CatalogSource;
  menuVersion: string;
  logCount: number;
  lockCount: number;
  soldOutCount: number;
  envRows: { label: string; value: string }[];
}

export interface BackupInfoView {
  lastExportedAt: string | null;
  lastExportedDigest: string | null;
  lastRestoredAt: string | null;
  lastRestoredDigest: string | null;
  lastFilePath: string | null;
  lastMessage: string;
}

export interface ImportRecordView {
  ok: boolean;
  fileName: string;
  message: string;
  at: string;
}

export interface MenuView {
  info: MenuInfoView;
  simulated: boolean;
  importHint: string;
  backup: BackupInfoView;
  lastImport: ImportRecordView | null;
}

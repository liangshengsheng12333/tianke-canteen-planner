/**
 * store.ts — 天科食客前端唯一状态门面（页面与测试只通过这里改数据）。
 *
 * 职责：
 *  1. 本地状态加载/跨日/原子写入（写入失败不改动当前内存状态）；
 *  2. 组装 PlanRequest / TargetRequest 并串行调用 WASM（旧 T02 v2 二进制口径）；
 *  3. 请求修订与过期响应丢弃（requestId/revision 关联）；
 *  4. 建档、锁定/售罄、换菜、记餐改撤补记、结束/重开、菜单导入、导出恢复；
 *  5. 把领域状态映射成页面视图模型。
 *
 * 不在这里实现营养/推荐公式；所有正式值来自 WASM。
 */

import type {
  ActionResult,
  AppState,
  BackupInfoView,
  Catalog,
  CatalogSource,
  DayRecord,
  DevView,
  HomeView,
  ImportRecordView,
  ItemLock,
  LogNutrition,
  LogsView,
  Meal,
  MealLog,
  MealLogSectionView,
  MenuPreflight,
  MenuView,
  PlanOutcome,
  PlannerSettings,
  ProfileDraft,
  ProfileView,
  RestorePreflight,
  RestoreResult,
  TargetOutcome,
  TargetView,
  MenuDiffView,
  MealView,
  MenuInfoView,
  OfferNutritionRequest,
  OfferNutritionResult,
} from './types';
import { MEAL_LABELS, MEALS, MAX_MONEY_CENTS, PROFILE_VIEW_OPTIONS, SUPPORTED_ALGORITHMS, isSupportedAlgorithm } from './types';
import {
  STORAGE_KEY,
  clearState,
  createDayRecord,
  createInitialState,
  ensureDay,
  estimateStateBytes,
  getDay,
  isMealEnded,
  loadState,
  saveState,
  todayState,
  validateState,
} from './app-state';
import { createDefaultProfileDraft, mapTargetResult, profileSummary, toProfileRequest, validateProfileDraft } from './profile';
import { buildPlanRequest, checkCapability, interpretPlanResult, mealHasSupply, planningMeals, planUpdateState, validateLocks, flagLabel } from './plan';
import { buildBudgetView, buildIntakeView, buildLogView, makeRecordId, mealLabel, summarizeActiveLogs } from './logs';
import {
  buildSelfPickDraftPreview,
  buildSelfPickView,
  createSelfPickDraftToken,
  isValidSelfPickDraftToken,
  logItemFromDraftLine,
  selfPickConfirmationId,
} from './self-pick';
import type {
  SelfPickConfirmInput,
  SelfPickConfirmResult,
  SelfPickDraftContext,
  SelfPickDraftPreview,
  SelfPickNutritionEntry,
  SelfPickNutritionSnapshot,
  SelfPickSelection,
  SelfPickView,
} from './self-pick';
import { buildMenuDiff, buildMenuInfoView, parseMenuText, prepareCatalogReplacement, requestValidateMenu } from './menu';
import { compareStates, parseBackupText, serializeBackup, summarizeBackup } from './backup';
import { SIMULATED_CATALOG } from '../config/simulated-menu';
import { WEST1_MENU_CATALOG } from '../config/west1-menu';
import { NUTRITION_CONFIG_HASH, buildNutritionConfigRequest } from '../config/nutrition-config';
import { configureCore, ensureCore as ensureCoreRuntime, getWasmPath, measureCoreCall, resetCore, runAbiProbe, callCore, WASM_IDENTITY } from '../utils/core-runtime';
import { describeError, localBusinessDate, localTzOffsetMinutes, nowMs, readEnvironmentRows, getWx, hasWx } from '../utils/wx-runtime';
import { canonicalSha256 } from '../utils/canonical-json';
import { FIXTURE_CASES } from '../mock/simulated-inputs';

// 状态生命周期约定（改本文件前先读这一节，所有方法都受它约束）：
//  1. 任何持久化写操作必须走 commit()：克隆 → mutate → validateState → saveState → 替换内存引用。
//     任一步失败都保留旧内存状态，页面不会看到"改了一半"的数据；失败信息原样给页面展示。
//  2. 异步核心调用（refreshPlan/computeTarget/preflightMenu/applyRestore 等）返回后，先比对
//     dataSeq / planSeq / profileSeq 等修订号再落状态：期间只要发生过本地写入或更新的请求，
//     就丢弃旧响应，避免慢响应覆盖新输入（典型场景：请求中用户又改了档案或锁定）。
//  3. 业务日期由 ensureDay 统一维护；跨日只新建空日期桶，不迁移昨天的摄入/锁定/售罄，
//     昨天的记录保留但不再参与今天规划（历史可查、今日不继承）。
//  4. 锁定/售罄作用域都含餐次+窗口：windowLocks 是整餐窗口锁，itemLocks 是整餐菜品锁，
//     soldOut 是 (业务日期, 窗口, 餐次, dishId)。判断"某报价是否售罄"必须同时比 windowId，
//     只比 dishId 会把 A 窗售罄误当成 B 窗同菜也售罄。
//  5. 计划只持久化核心原始响应 rawText 与 requestId/menuVersion/profileRevision；视图由
//     interpretPlanResult 在读取时现算，避免"视图与原始响应"两份真相互相漂移。
export interface AppStoreOptions {
  instantiate?: (path: string, imports: object) => Promise<{ instance: { exports: any } }>;
  now?: () => Date;
  wasmPath?: string;
}

/**
 * 手动补记一餐的输入。价格/营养允许未知（null/false），未知不等同 0：
 * 未知价格不参与预算"已消费"的精确核算，未知营养不参与营养汇总的确定性部分。
 */
export interface ManualLogInput {
  name: string;
  portionCode: 'full' | 'half';
  quantity: number;
  unitPriceCents: number | null;
  priceKnown: boolean;
  nutrition?: LogNutrition | null;
  note?: string | null;
  clientToken: string;
}

/**
 * 改记时的逐项补丁：只针对一条有效记录里的 itemKey。
 * 未提供的字段保持原值；unitPriceCents=null 表示明确改为"价格未知"，
 * 与"不提供"（保持原值）语义不同，页面必须区分这两种操作。
 */
export interface LogEditItemPatch {
  itemKey: string;
  quantity?: number;
  unitPriceCents?: number | null;
  priceKnown?: boolean;
  note?: string | null;
}

export interface LogEditInput {
  items: LogEditItemPatch[];
}

export interface BackupExport {
  ok: boolean;
  message: string;
  text: string;
  digest: string;
  filePath: string | null;
  exportedAt: string;
}

/** 开发页计时结果（core=入口函数自身，bridge=完整桥接含复制/释放）。 */
export interface PerformanceSample {
  kind: 'core' | 'bridge';
  runs: number;
  raw: number[];
  min: number;
  max: number;
  median: number;
  mean: number;
  message: string;
}

const DEFAULT_PROFILE_ID_PREFIX = 'p-';

interface PendingMenu {
  token: string;
  catalog: Catalog;
  diff: MenuDiffView;
  fileName: string;
}

interface PendingRestore {
  token: string;
  digest: string;
  state: AppState;
  summary: string;
}

function clone<T>(value: T): T {
  return JSON.parse(JSON.stringify(value));
}

function nowIso(now: Date): string {
  return now.toISOString();
}

// 金额统一边界（分）：与 self-pick 等路径共用 types.ts 的 MAX_MONEY_CENTS（1,000,000 元）。
function isValidMoney(value: any): boolean {
  return typeof value === 'number' && Number.isInteger(value) && value >= 0 && value <= MAX_MONEY_CENTS;
}

/**
 * 菜品锁定来源（前端内部标记，不进核心契约）：
 *  - 'user'（缺省）：用户手动点“锁定”的硬约束，换菜不能直接换掉；
 *  - 'swap'：换菜时把“最新主动选择”交给核心重算而写入的选择锁。它不是用户锁定，
 *    视图不显示“已锁定”，也不阻止用户继续换菜；发请求前会剥离该字段。
 * 旧版本数据没有 source，按 'user' 处理（与升级前语义一致，可手动解除）。
 */
interface SwapSelectionLock extends ItemLock {
  source: 'swap';
}

function isSwapSelectionLock(lock: ItemLock): boolean {
  return (lock as SwapSelectionLock).source === 'swap';
}

export class AppStore {
  /** 唯一持久化真相：只在 commit() 成功后整体替换，外部只能通过 peekState 只读观察。 */
  private state: AppState;
  /** 注入时钟：测试用固定/推进时间，真机默认系统时间；跨日与 createdAt 都依赖它。 */
  private now: () => Date;
  private initialized = false;
  /** 本地存储处于故障态时阻止任何写入，避免用新数据覆盖可恢复的旧数据。 */
  private storageFault = false;
  private initMessage = '';
  /** 方案请求序号：每次 refreshPlan 递增，晚到的旧响应据此丢弃。 */
  private planSeq = 0;
  /** 档案请求序号：computeTarget 用，档案更新后旧目标结果不得落库。 */
  private profileSeq = 0;
  /** 任何成功写入都会递增；用于在异步核心调用返回时判断输入是否已变化。 */
  private dataSeq = 0;
  /** 菜单预检的一次性凭证：只有 confirm token 才能 applyMenu，防止预检后菜单被绕过。 */
  private pendingMenu: PendingMenu | null = null;
  /** 恢复预检的一次性凭证：摘要 + 待恢复状态，确认后原子替换。 */
  private pendingRestore: PendingRestore | null = null;
  /** 最近一次真正发给核心的 PlanRequest 原文：开发页计时/诊断、以及证明"未调用核心"用。 */
  private lastPlanRequestText = '';
  /**
   * 当前菜单+餐次的单份 Offer 营养结果（唯一来源 mp_offer_nutrition）。
   * 只缓一个来源键：菜单或餐次一变，旧结果自然不匹配、不被复用；不新造通用缓存。
   */
  private selfPickNutrition: SelfPickNutritionSnapshot | null = null;
  private lastAction = '';
  private lastImport: ImportRecordView | null = null;

  /**
   * 依赖（WASM 实例化方式、时钟、WASM 路径）全部从这里注入：
   *  - 真机/小程序用默认实现（wx 环境 + 包内 wasm + 系统时间）；
   *  - Node 测试注入 createRealInstantiate 与推进时钟，才能稳定复现跨日、过期响应。
   */
  constructor(options: AppStoreOptions = {}) {
    this.now = options.now || (() => new Date());
    this.state = createInitialState(this.now());
    configureCore({ instantiate: options.instantiate, wasmPath: options.wasmPath });
  }

  // -------------------------------------------------------------------------
  // 初始化与跨日
  // -------------------------------------------------------------------------

  /**
   * 冷启动入口：加载本地状态 → 记录存储故障 → 按注入时钟做一次跨日检查。
   * 跨日发生且存储可写时立刻落盘，保证"日期已切换"这件事在退出后仍成立；
   * 若首次写入失败，把 storageFault 置位并阻止后续写入，而不是继续用内存假象。
   */
  init(): { ok: boolean; message: string; businessDate: string } {
    const now = this.now();
    const result = loadState(now);
    this.state = result.state;
    this.storageFault = !result.ok;
    this.initMessage = result.message;
    const rolled = ensureDay(this.state, now);
    this.initialized = true;
    if (rolled && !this.storageFault) {
      try {
        saveState(this.state);
      } catch (error: any) {
        this.storageFault = true;
        this.initMessage = `初始化写入失败：${describeError(error)}`;
      }
    }
    return { ok: result.ok && !this.storageFault, message: this.initMessage, businessDate: this.state.activeDate };
  }

  /**
   * 启动/回到前台时检查跨日：为新日期建空桶，不迁移昨天摄入/锁定/售罄。
   * 与 init 分开是为了页面 onShow 能低成本重复调用；只有真正跨日才写盘。
   * 返回 true 表示页面需要重新拉取视图（日期桶已切换）。
   */
  ensureToday(): boolean {
    const now = this.now();
    this.ensureInitialized();
    const rolled = ensureDay(this.state, now);
    if (rolled) {
      this.lastAction = `业务日期已切换到 ${this.state.activeDate}`;
      if (!this.storageFault) {
        try {
          saveState(this.state);
        } catch (error: any) {
          this.storageFault = true;
          this.initMessage = `跨日写入失败：${describeError(error)}`;
        }
      }
    }
    return rolled;
  }

  /** 惰性初始化：页面可能先读视图再调 init，任何入口都要能自愈到"已加载"状态。 */
  private ensureInitialized(): void {
    if (!this.initialized) {
      this.init();
    }
  }

  /**
   * 当前业务日的日期桶。用 todayState（内部按注入时钟 ensureDay）而不是直接读
   * activeDate：页面长时间挂着跨过零点后，下一笔操作/视图必须落在新日期，不能写进昨天。
   */
  private currentDay(): DayRecord {
    return todayState(this.state, this.now());
  }

  /** 当前生效菜单：从未导入过菜单时使用内置真实菜单（西院西一食堂首批），保证首屏有真实数据可看。 */
  private catalog(): Catalog {
    return this.state.catalog || (WEST1_MENU_CATALOG as Catalog);
  }

  /**
   * 当前菜单来源（视图与警示共用同一判定，避免多处各写一套）：
   *  1) state.catalog === null：从未导入过菜单，生效的是内置真实菜单（西一）。
   *     旧版本这里默认内置示例菜单，历史存储里 catalogMeta.source 可能仍是 'simulated'；
   *     以 catalog=null 为准按内置真实菜单解释，升级后不误标示例。
   *  2) 已导入：来源属性 simulated 优先；把“冻结示例菜单文件”重新导入时 source 会变成
   *     imported，但 catalogHash 仍等于冻结示例内容的摘要，此时继续标注“示例菜单”。
   * 也就是说：来源属性不被“已导入”这一动作覆盖；内容摘要只作为同文件重导入的补充依据，
   * 不用文件名/菜单版本猜来源，也不把 imported 本身当真实菜单证明。
   */
  private catalogSource(): CatalogSource {
    if (this.state.catalog === null) {
      return 'builtin';
    }
    if (this.state.catalogMeta.source === 'simulated' || this.state.catalog.catalogHash === (SIMULATED_CATALOG as Catalog).catalogHash) {
      return 'simulated';
    }
    return 'imported';
  }

  /** 是否为示例菜单（仅开发/演示）：默认西一菜单与用户导入的真实菜单都不算。 */
  private catalogIsSimulated(): boolean {
    return this.catalogSource() === 'simulated';
  }

  /** 菜单信息视图：示例菜单保持“模拟/估算”警示，内置真实菜单给出可切换说明。 */
  private menuInfo(): MenuInfoView {
    return buildMenuInfoView(this.catalog(), { ...this.state.catalogMeta, source: this.catalogSource() });
  }

  /**
   * 事务式提交：克隆当前状态 → 修改 → 结构校验 → 一次写入。
   * 顺序是有意的：先校验后写盘，绝不把非法状态写进存储；写盘失败时不替换 this.state，
   * 因此调用方看到的失败是"完全没变"，不会出现内存已改、磁盘未改的分裂状态。
   * 成功后 dataSeq 递增，所有异步核心调用都据此判断自己的响应是否已过期。
   */
  private commit(mutate: (draft: AppState) => void): ActionResult {
    if (this.storageFault) {
      return { ok: false, message: `本地数据处于故障状态，已阻止写入：${this.initMessage}` };
    }
    let draft: AppState;
    try {
      draft = clone(this.state);
    } catch (error: any) {
      return { ok: false, message: `状态克隆失败：${describeError(error)}` };
    }
    try {
      mutate(draft);
      const validation = validateState(draft);
      if (!validation.ok) {
        return { ok: false, message: `写入前状态校验失败：${validation.message}` };
      }
      saveState(draft);
    } catch (error: any) {
      return { ok: false, message: `保存失败，已保留原数据：${describeError(error)}` };
    }
    this.state = draft;
    this.dataSeq += 1;
    return { ok: true, message: '已保存' };
  }

  /** 业务失败统一出口：只记录 lastAction 供页面提示，不写状态、不抛异常。 */
  private fail(message: string): ActionResult {
    this.lastAction = message;
    return { ok: false, message };
  }

  /** 业务成功统一出口：与 fail 对称，lastAction 供页面"最近操作"展示。 */
  private succeed(message: string): ActionResult {
    this.lastAction = message;
    return { ok: true, message };
  }

  // -------------------------------------------------------------------------
  // 档案与目标
  // -------------------------------------------------------------------------

  /**
   * 保存档案。档案是目标与计划的共同输入，所以这里同时使旧目标、旧计划失效：
   *  - target=null：BMR/TDEE 依赖身高体重年龄等，档案一变旧目标就不再可信；
   *  - plan=null：请求里的 profileRevision 已变化，旧方案不能继续冒充当前输入的结果。
   * 档案校验先于 commit，校验失败不产生任何写入；profileRevision 只在成功提交时递增。
   */
  saveProfile(draft: ProfileDraft): ActionResult {
    this.ensureInitialized();
    const errors = validateProfileDraft(draft);
    if (errors.length > 0) {
      return { ok: false, message: `档案校验未通过：${errors[0].message}`, errors };
    }
    this.profileSeq += 1;
    const day = this.currentDay();
    const result = this.commit((next) => {
      if (!next.profileId) {
        next.profileId = DEFAULT_PROFILE_ID_PREFIX + Date.now().toString(36);
      }
      next.profileDraft = clone(draft);
      next.profileRevision += 1;
      next.target = null;
      const nextDay = next.days[day.businessDate] || day;
      nextDay.plan = null;
      nextDay.selectedPlanIndex = 0;
    });
    if (!result.ok) {
      return result;
    }
    return this.succeed('档案已保存在本机，可计算营养目标');
  }

  /**
   * 调核心计算营养目标。契约要点：
   *  - 请求带 profileRevision，核心结果与"哪一版档案"绑定；落库前再次比对 profileSeq，
   *    防止"请求中用户又改了档案"时把旧目标写成新目标；
   *  - 目标结果只存原始 envelope 文本 + requestId/profileRevision，视图由 mapTargetResult 现算；
   *  - 失败不写 target，保留上一次成功目标，避免界面出现半截数据。
   */
  async computeTarget(): Promise<TargetOutcome> {
    this.ensureInitialized();
    if (!this.state.profileDraft) {
      return { ok: false, message: '尚未建档，无法计算营养目标' };
    }
    const profileRevision = this.state.profileRevision;
    const seq = this.profileSeq;
    const requestId = `target-${this.state.activeDate}-${profileRevision}-${seq + 1}`;
    const request = {
      contractVersion: '1.0',
      requestId,
      profile: toProfileRequest(this.state.profileDraft, this.state.profileId || 'p-local', profileRevision),
      nutritionConfig: buildNutritionConfigRequest(),
    };
    try {
      await ensureCoreRuntime();
      const rawText = callCore('nutrition-target', JSON.stringify(request));
      if (seq !== this.profileSeq) {
        return { ok: false, message: '档案已更新，已忽略过期的目标结果' };
      }
      const envelope = JSON.parse(rawText);
      const mapped = mapTargetResult(envelope);
      this.commit((next) => {
        next.target = {
          requestId: envelope.requestId || requestId,
          profileRevision,
          createdAt: nowIso(this.now()),
          rawText,
        };
      });
      return { ok: true, message: mapped.message, status: mapped.status };
    } catch (error: any) {
      return { ok: false, message: `营养目标计算失败：${describeError(error)}` };
    }
  }

  /**
   * 保存规划设置（预算/每餐菜品数/搜索限额/算法）。
   * 校验先于写入：算法必须是当前受支持子集（greedy / dp / branchAndBound），预算必须是非负整数分，
   * 每餐菜品数与 limits 必须是正整数；任何一项非法都整体拒绝，不做部分保存。
   * 设置变化会让旧计划失去输入前提，因此提交时顺带把当天 plan 置空（保留历史诊断文本另存）。
   */
  saveSettings(patch: Partial<PlannerSettings>): ActionResult {
    this.ensureInitialized();
    if (patch.algorithm !== undefined && !isSupportedAlgorithm(patch.algorithm)) {
      return this.fail(`当前只支持 ${SUPPORTED_ALGORITHMS.join(' / ')} 算法，不能切换到 ${String(patch.algorithm)}`);
    }
    if (patch.budgetCents !== undefined && patch.budgetCents !== null && !isValidMoney(patch.budgetCents)) {
      return this.fail('预算必须是非负整数（分）');
    }
    if (patch.maxItemsPerMeal !== undefined) {
      if (!Number.isInteger(patch.maxItemsPerMeal) || patch.maxItemsPerMeal < 1 || patch.maxItemsPerMeal > 20) {
        return this.fail('每餐最多菜品数必须是 1–20 的整数');
      }
    }
    if (patch.limits !== undefined && patch.limits !== null) {
      const limits = patch.limits;
      for (const key of ['maxCandidates', 'maxNodes'] as const) {
        const value = (limits as any)[key];
        if (value !== undefined && (!Number.isInteger(value) || value < 1)) {
          return this.fail(`${key} 必须是正整数`);
        }
      }
    }
    const day = this.currentDay();
    const result = this.commit((next) => {
      next.settings = { ...next.settings, ...clone(patch) };
      // 预算/限额变化后旧计划不再代表当前输入，失效但保留历史诊断记录。
      const nextDay = next.days[day.businessDate] || day;
      nextDay.plan = null;
    });
    return result.ok ? this.succeed('设置已保存，请刷新今日方案') : result;
  }

  // -------------------------------------------------------------------------
  // 方案
  // -------------------------------------------------------------------------

  /**
   * 生成/刷新今日方案（核心唯一算法入口）。执行顺序不能随意调换：
   *  1. 前置门：未建档 → 能力门（comboRules/算法）→ 锁定有效性。能力不满足或锁定
   *     失效时返回可读原因，绝不带着无效输入调用核心。
   *     锁定失效返回 status='LockConflict'，且此时不调用核心、不写状态、不自动解锁。
   *  2. 只规划"还没确认/未结束"的餐次；全部结束时直接成功返回，不产生空请求。
   *  3. 组装 PlanRequest 并记下 text（页面计时/诊断用），随后记录 planSeq 与 dataSeq 快照。
   *  4. await 核心后再次比对序号：期间只要发生任何本地写入或被更新的请求取代，
   *     就把这次响应整体丢弃（stale=true），防止旧结果覆盖用户新输入。
   *  5. 先 commit 原始 rawText（带 requestId/revision/menuVersion），再按 envelope 解析
   *     状态返回；核心返回 ok=false 时也要先落 rawText 吗？不——只在合法 JSON 时才落，
   *     解析失败直接返回，不写半成品。
   *  6. 返回 ok=plans.length>0，status 用核心原文，供页面区分 OkPartial/NoFeasible 等。
   */
  async refreshPlan(): Promise<PlanOutcome> {
    this.ensureInitialized();
    if (!this.state.profileDraft) {
      return { ok: false, message: '尚未建档，无法生成今日方案' };
    }
    const catalog = this.catalog();
    const day = this.currentDay();
    const capabilityError = checkCapability(catalog, this.state.settings);
    if (capabilityError) {
      return { ok: false, message: `当前受支持能力不允许该请求：${capabilityError}` };
    }
    const lockIssues = validateLocks(day, catalog);
    if (lockIssues.length > 0) {
      return {
        ok: false,
        status: 'LockConflict',
        message: `锁定失效/冲突，需先处理：${lockIssues.map((issue) => issue.reason).join('；')}`,
      };
    }
    const meals = planningMeals(day, catalog);
    if (meals.length === 0) {
      this.planSeq += 1;
      this.lastAction = '所有餐次都已确认或结束，无需规划';
      return this.succeed('所有餐次都已确认或结束，本轮没有需要规划的餐次');
    }

    this.planSeq += 1;
    const seq = this.planSeq;
    const build = buildPlanRequest(
      {
        profileDraft: this.state.profileDraft,
        profileId: this.state.profileId,
        profileRevision: this.state.profileRevision,
        settings: this.state.settings,
      },
      day,
      catalog,
      seq,
      this.now(),
    );
    // 选择锁的 source 是前端内部标记：核心契约 itemLocks 只接受 {meal, offerId, quantity}，
    // 发送前剥离，避免内部字段混进 PlanRequest（也不改变核心的锁定语义）。
    build.request.state.itemLocks = build.request.state.itemLocks.map((lock: any) => ({
      meal: lock.meal,
      offerId: lock.offerId,
      quantity: lock.quantity,
    }));
    this.lastPlanRequestText = JSON.stringify(build.request);
    const dataSeqAtStart = this.dataSeq;
    let rawText: string;
    try {
      await ensureCoreRuntime();
      rawText = callCore('plan', this.lastPlanRequestText);
    } catch (error: any) {
      return { ok: false, message: `核心调用失败：${describeError(error)}` };
    }
    if (seq !== this.planSeq || dataSeqAtStart !== this.dataSeq) {
      // 旧响应不能覆盖新输入：期间只要发生过任何本地写入（改档案/锁定/记餐/菜单等），
      // 或已经被更新的方案请求取代，就只丢弃本响应，不写任何状态。
      return { ok: false, stale: true, message: '已忽略过期方案响应（期间输入已变化）' };
    }
    let envelope: any;
    try {
      envelope = JSON.parse(rawText);
    } catch (error: any) {
      return { ok: false, message: `核心返回不是合法 JSON：${describeError(error)}` };
    }
    const result = this.commit((next) => {
      const nextDay = next.days[day.businessDate] || day;
      nextDay.businessDate = day.businessDate;
      nextDay.tzOffsetMinutes = day.tzOffsetMinutes;
      nextDay.plan = {
        requestId: build.requestId,
        revision: seq,
        profileRevision: next.profileRevision,
        menuVersion: catalog.menuVersion,
        createdAt: nowIso(this.now()),
        rawText,
      };
      nextDay.selectedPlanIndex = 0;
    });
    if (!result.ok) {
      return { ok: false, message: result.message };
    }
    if (envelope.ok === false) {
      const error = envelope.error || {};
      return {
        ok: false,
        status: error.code || 'INVALID_INPUT',
        message: `核心拒绝请求 ${error.code || ''}：${error.message || ''}`,
      };
    }
    const status = envelope.result ? envelope.result.status : 'Unknown';
    const plans = envelope.result && Array.isArray(envelope.result.plans) ? envelope.result.plans : [];
    const planKey = plans.length > 0 ? plans[0].planKey : null;
    const ok = plans.length > 0;
    this.lastAction = ok ? `方案已更新（${status}）` : `方案状态：${status}`;
    return { ok, status, planKey, message: ok ? `方案已更新（${status}）` : `未生成方案：${status}` };
  }

  /**
   * 切换备选方案（核心可能返回多个 plans）。只改 selectedPlanIndex，不动 rawText；
   * 索引来自当前持久化的原始响应，因此接入/恢复后仍保持一致。
   */
  selectPlan(index: number): ActionResult {
    this.ensureInitialized();
    const day = this.currentDay();
    if (!day.plan || !day.plan.rawText) {
      return this.fail('当前没有可选方案');
    }
    const envelope = this.parsePlanEnvelope(day.plan.rawText);
    const plans = envelope && envelope.result && Array.isArray(envelope.result.plans) ? envelope.result.plans : [];
    if (!plans[index]) {
      return this.fail('所选备选不存在');
    }
    const result = this.commit((next) => {
      const nextDay = next.days[day.businessDate] || day;
      nextDay.selectedPlanIndex = index;
    });
    return result.ok ? this.succeed(`已切换到${plans[index].offeredAs ? plans[index].offeredAs.join('/') : '备选'}方案`) : result;
  }

  /** 解析持久化的核心原始响应。历史上可能残留损坏文本，解析失败返回 null，由调用方降级。 */
  private parsePlanEnvelope(rawText: string): any {
    try {
      return JSON.parse(rawText);
    } catch (_e) {
      return null;
    }
  }

  // -------------------------------------------------------------------------
  // 锁定 / 售罄 / 换菜 / 结束重开
  // -------------------------------------------------------------------------

  /**
   * 切换/解除整餐窗口锁（L8：同餐只允许一个窗口）。
   * 已锁 → 解除；未锁 → 优先锁"当前计划该餐所在窗口"，没有计划时退回第一个供应窗口。
   * 锁记录只存 {meal, windowId}；窗口是否供应此餐由 validateLocks 在规划前统一复核。
   */
  toggleWindowLock(meal: Meal): ActionResult {
    this.ensureInitialized();
    const catalog = this.catalog();
    const day = this.currentDay();
    const existingIndex = day.windowLocks.findIndex((lock) => lock.meal === meal);
    if (existingIndex >= 0) {
      const result = this.commit((next) => {
        const nextDay = next.days[day.businessDate] || day;
        nextDay.windowLocks = nextDay.windowLocks.filter((lock) => lock.meal !== meal);
      });
      return result.ok ? this.succeed(`${mealLabel(meal)}窗口锁定已解除`) : result;
    }
    const planMeal = this.planMealView(meal);
    const supplyWindows = (catalog.windows || []).filter((window) => window.mealWindows.indexOf(meal) >= 0);
    const chosen = planMeal && planMeal.windowId
      ? supplyWindows.find((window) => window.windowId === planMeal.windowId)
      : supplyWindows[0];
    if (!chosen) {
      return this.fail(`${mealLabel(meal)}没有任何窗口供应，无法锁定窗口`);
    }
    const result = this.commit((next) => {
      const nextDay = next.days[day.businessDate] || day;
      nextDay.windowLocks = nextDay.windowLocks.concat([{ meal, windowId: chosen.windowId }]);
    });
    return result.ok ? this.succeed(`已锁定${mealLabel(meal)}窗口：${chosen.name}`) : result;
  }

  /**
   * 切换/解除菜品锁。顺序有意：
   *  1. 已显式锁定则直接解除（幂等、不校验菜单，保证用户总能解开）；
   *  2. 未显式锁定（换菜选择锁不算已锁）时依次校验：报价仍在菜单 → 该餐供应 → 报价所属窗口未售罄；
   *  3. 售罄判断必须带 offer.windowId：同菜在别窗售罄不影响本窗锁定。
   * 锁定只存 offerId+quantity，不存菜品/窗口快照；核心与视图都按 offerId 回查当前菜单。
   */
  toggleItemLock(meal: Meal, offerId: string): ActionResult {
    this.ensureInitialized();
    const catalog = this.catalog();
    const day = this.currentDay();
    // 换菜选择锁（source='swap'）不是用户锁定：点“锁定”应当把它转成用户锁，而不是当成解锁。
    const existing = day.itemLocks.findIndex((lock) => lock.meal === meal && lock.offerId === offerId && !isSwapSelectionLock(lock));
    if (existing >= 0) {
      const result = this.commit((next) => {
        const nextDay = next.days[day.businessDate] || day;
        nextDay.itemLocks = nextDay.itemLocks.filter((lock) => !(lock.meal === meal && lock.offerId === offerId));
      });
      return result.ok ? this.succeed('已解除菜品锁定') : result;
    }
    const offer = (catalog.offers || []).find((entry) => entry.offerId === offerId);
    if (!offer) {
      return this.fail('该报价已不在菜单中，无法锁定');
    }
    if (offer.mealWindows.indexOf(meal) < 0) {
      return this.fail(`${mealLabel(meal)}不供应该菜品，无法锁定`);
    }
    const soldOut = day.soldOut.some(
      (mark) => mark.meal === meal && mark.dishId === offer.dishId && mark.windowId === offer.windowId,
    );
    if (soldOut) {
      return this.fail('该菜品在所属窗口已标记售罄，不能同时锁定');
    }
    const result = this.commit((next) => {
      const nextDay = next.days[day.businessDate] || day;
      // 同一菜品只保留一条用户锁：先移除该菜可能存在的换菜选择锁，再写入用户锁。
      nextDay.itemLocks = nextDay.itemLocks
        .filter((lock) => !(lock.meal === meal && lock.offerId === offerId && isSwapSelectionLock(lock)))
        .concat([{ meal, offerId, quantity: 1 }]);
    });
    return result.ok ? this.succeed('已锁定菜品，刷新方案后生效') : result;
  }

  /**
   * 换菜：从当前方案里移除一项、加入一项，然后调核心重算。
   * 校验顺序（先便宜后昂贵，且都必须在写状态之前）：
   *  1. 当前必须有方案、该餐必须有推荐（否则没有"被替换的整餐"可言）；
   *  2. 目标报价必须存在且供应此餐；
   *  3. 目标报价在"它自己的窗口"未售罄——只比 dishId 会误伤跨窗换入同菜；
   *  4. 目标不能已经在当前推荐里（否则是重复项而非替换）。
   * 锁语义分两种（写入的都是 source='swap' 的“换菜选择锁”，与用户手动锁定区分）：
   *  - 同窗替换：把替换后的整餐 offerId 集合写成选择锁（核心按整餐子集重算），
   *    窗口锁不变，避免只锁新菜导致核心自由组合出其他菜；
   *  - 跨窗替换：等于整餐换窗口，选择锁只写目标菜、windowLocks 移到目标窗口，
   *    并清掉该餐旧窗口锁；旧窗报价不再进入请求，避免旧窗售罄/供应变化造成假冲突。
   * 已确认/已结束餐次、被手动锁定的被替换项、带手动锁定却要整餐跨窗，都在写状态前直接拒绝。
   * commit 里先把 plan 置空：即使随后核心失败，也不会继续展示与锁定不匹配的旧方案。
   */
  async swapOffer(meal: Meal, removeOfferId: string, addOfferId: string): Promise<PlanOutcome> {
    this.ensureInitialized();
    const catalog = this.catalog();
    const day = this.currentDay();
    // 已确认 = 已计入实际消费，已结束 = 用户明确不吃：两者都不能被换菜静默改写。
    if (day.logs.some((log) => log.meal === meal && log.status === 'active')) {
      return { ok: false, message: '该餐已确认并计入实际消费，不能直接换菜；如需修改请到记录页改记或撤销' };
    }
    if (isMealEnded(day, meal)) {
      return { ok: false, message: '该餐已结束，不能换菜；如需调整请先重开餐次' };
    }
    if (!day.plan || !day.plan.rawText) {
      return { ok: false, message: '当前没有方案可换菜，请先生成今日方案' };
    }
    const interpretation = interpretPlanResult(this.parsePlanEnvelope(day.plan.rawText), this.state, day, catalog);
    const mealView = interpretation.meals.find((entry) => entry.meal === meal);
    if (!mealView || !mealView.hasPlan) {
      return { ok: false, message: '该餐没有可替换的推荐' };
    }
    // 用户手动锁定的菜品是硬约束，不能通过换菜绕过：先解锁再换。
    const explicitLocks = day.itemLocks.filter((lock) => lock.meal === meal && !isSwapSelectionLock(lock));
    if (explicitLocks.some((lock) => lock.offerId === removeOfferId)) {
      return { ok: false, message: '该菜品已手动锁定，不能直接换掉；请先解除菜品锁定' };
    }
    const addOffer = (catalog.offers || []).find((entry) => entry.offerId === addOfferId);
    if (!addOffer) {
      return { ok: false, message: '目标报价不存在' };
    }
    if (addOffer.mealWindows.indexOf(meal) < 0) {
      return { ok: false, message: '目标菜品不供应此餐' };
    }
    // 目标售罄只按目标报价自身窗口判断；其他窗口同菜售罄不能阻止跨窗换入。
    if (day.soldOut.some((mark) => mark.meal === meal && mark.dishId === addOffer.dishId && mark.windowId === addOffer.windowId)) {
      return { ok: false, message: '目标菜品在目标窗口已标记售罄' };
    }
    if (mealView.items.some((item) => item.offerId === addOfferId)) {
      return { ok: false, message: '目标菜品已在当前推荐中' };
    }
    // 同窗替换优先：把替换后的整餐菜品作为选择锁交给核心重算；
    // 跨窗口替换属于“整餐换窗口”，只锁定目标菜并把该餐窗口锁到目标窗口，避免旧窗口菜品造成失效锁定。
    const crossWindow = !!mealView.windowId && addOffer.windowId !== mealView.windowId;
    if (crossWindow && explicitLocks.length > 0) {
      return { ok: false, message: '该餐有手动锁定的菜品，不能整餐换窗口；请先解除菜品锁定' };
    }
    const desiredOfferIds = crossWindow
      ? [addOfferId]
      : mealView.items
          .map((item) => item.offerId)
          .filter((offerId) => offerId && offerId !== removeOfferId)
          .concat([addOfferId]);
    // 只替换该餐的换菜选择锁；用户显式锁定（无 source）原样保留，不在换菜时被顺带清掉。
    const explicitOfferIds = explicitLocks.map((lock) => lock.offerId);
    const selectionLocks: ItemLock[] = desiredOfferIds
      .filter((offerId) => explicitOfferIds.indexOf(offerId) < 0)
      .map((offerId) => ({ meal, offerId, quantity: 1, source: 'swap' } as SwapSelectionLock));
    const result = this.commit((next) => {
      const nextDay = next.days[day.businessDate] || day;
      const otherMeals = nextDay.itemLocks.filter((lock) => lock.meal !== meal);
      const keptExplicit = nextDay.itemLocks.filter((lock) => lock.meal === meal && !isSwapSelectionLock(lock));
      nextDay.itemLocks = otherMeals.concat(keptExplicit, selectionLocks);
      if (crossWindow) {
        const otherWindows = nextDay.windowLocks.filter((lock) => lock.meal !== meal);
        nextDay.windowLocks = otherWindows.concat([{ meal, windowId: addOffer.windowId }]);
      }
      nextDay.plan = null;
    });
    if (!result.ok) {
      return { ok: false, message: result.message };
    }
    const outcome = await this.refreshPlan();
    return {
      ...outcome,
      message: outcome.ok
        ? `已${crossWindow ? '换窗口并' : '按同窗口'}替换重算：${outcome.message}`
        : outcome.message,
    };
  }

  /**
   * 标记临时售罄。作用域 = 业务日期 + 窗口 + 餐次 + 稳定 dishId，缺一不可：
   *  - 指定 windowId 时必须是该菜在该餐的真实供应窗口。核心会忽略不存在的 windowId，
   *    前端若不校验就会写出永远不生效的脏标记（页面上"标记了却没反应"）。
   *  - 未指定窗口时沿用当前计划窗口，其次取该菜在本餐的第一个供应窗口（兼容旧页面）。
   *  - 重复标记同一作用域返回成功但不再追加记录（幂等，避免刷新后重复点击堆积）。
   * 售罄只是"今天这个窗口这道菜卖完了"，不是硬约束：跨日不会继承（日期桶隔离）。
   */
  markSoldOut(meal: Meal, dishId: string, windowId?: string): ActionResult {
    this.ensureInitialized();
    const catalog = this.catalog();
    const day = this.currentDay();
    const offers = (catalog.offers || []).filter((offer) => offer.dishId === dishId && offer.mealWindows.indexOf(meal) >= 0);
    if (offers.length === 0) {
      return this.fail('该菜品不在本餐供应范围，无法标记售罄');
    }
    // 售罄作用域 = 业务日期 + 窗口 + 餐次 + 稳定 dishId。窗口必须是该菜在该餐的真实
    // 供应窗口：核心会忽略不存在的 windowId，静默写入只会产生一条永远不生效的脏标记。
    let chosenWindow: string;
    if (windowId !== undefined && windowId !== null && windowId !== '') {
      if (!offers.some((offer) => offer.windowId === windowId)) {
        const dish = (catalog.dishes || []).find((entry) => entry.dishId === dishId);
        return this.fail(
          `${mealLabel(meal)}的「${dish ? dish.name : dishId}」不在窗口 ${windowId} 供应，无法标记售罄`,
        );
      }
      chosenWindow = windowId;
    } else {
      // 未指定窗口时沿用计划窗口，其次取该菜在本餐的第一个供应窗口。
      const planWindowId = (this.planMealView(meal) || {}).windowId;
      chosenWindow = (offers.find((offer) => offer.windowId === planWindowId) || offers[0]).windowId;
    }
    if (day.soldOut.some((mark) => mark.meal === meal && mark.dishId === dishId && mark.windowId === chosenWindow)) {
      return this.succeed('该菜品在本窗本餐已标记售罄，无需重复标记');
    }
    const result = this.commit((next) => {
      const nextDay = next.days[day.businessDate] || day;
      nextDay.soldOut = nextDay.soldOut.concat([
        {
          businessDate: day.businessDate,
          windowId: chosenWindow,
          meal,
          dishId,
          createdAt: nowIso(this.now()),
        },
      ]);
    });
    return result.ok ? this.succeed('已标记临时售罄，刷新方案后生效；跨日不继承') : result;
  }

  /**
   * 解除临时售罄。作用域含窗口，所以支持按窗口精确解除：
   *  - 指定 windowId：只解除该窗口的标记，其他窗口同菜标记保留；
   *  - 不指定：仅当该菜本餐只有一个窗口标记时解除（兼容旧页面调用），
   *    多个窗口同时标记时返回可读失败，避免一次静默清掉所有窗口。
   * 歧义时选择"失败+提示"而不是"全清"，因为多窗口下静默全清会让另一个窗口的
   * 用户以为菜又有了，实际是错误恢复。
   */
  clearSoldOut(meal: Meal, dishId: string, windowId?: string): ActionResult {
    this.ensureInitialized();
    const day = this.currentDay();
    const matching = day.soldOut.filter((mark) => mark.meal === meal && mark.dishId === dishId);
    let targetWindowId: string;
    if (windowId !== undefined && windowId !== null && windowId !== '') {
      if (!matching.some((mark) => mark.windowId === windowId)) {
        return this.fail(`没有找到窗口 ${windowId} 下该餐次的售罄标记`);
      }
      targetWindowId = windowId;
    } else if (matching.length === 0) {
      return this.fail('没有找到对应的售罄标记');
    } else if (matching.length > 1) {
      return this.fail(`该菜品在 ${matching.length} 个窗口都有售罄标记，请指定窗口后解除`);
    } else {
      targetWindowId = matching[0].windowId;
    }
    const result = this.commit((next) => {
      const nextDay = next.days[day.businessDate] || day;
      nextDay.soldOut = nextDay.soldOut.filter(
        (mark) => !(mark.meal === meal && mark.dishId === dishId && mark.windowId === targetWindowId),
      );
    });
    return result.ok ? this.succeed('已解除该窗口的售罄标记') : result;
  }

  /**
   * 结束一餐：只写 endedMeals 标记，不生成"已吃"记录——没吃就是没吃，
   * 不能为了报表完整性虚构摄入。结束后该餐不再进入 planningMeals；
   * 用户仍可通过 reopenMeal 重开或 addManualLog 补记真实吃过的内容。
   */
  endMeal(meal: Meal): ActionResult {
    this.ensureInitialized();
    const day = this.currentDay();
    if (day.endedMeals.indexOf(meal) >= 0) {
      return this.succeed('该餐已结束');
    }
    const result = this.commit((next) => {
      const nextDay = next.days[day.businessDate] || day;
      nextDay.endedMeals = nextDay.endedMeals.concat([meal]);
    });
    return result.ok ? this.succeed(`${mealLabel(meal)}已结束：不虚构摄入，可重开或补记`) : result;
  }

  /** 重开一餐：撤销 endedMeals 标记，使其重新进入规划范围；已确认的记录不受影响。 */
  reopenMeal(meal: Meal): ActionResult {
    this.ensureInitialized();
    const day = this.currentDay();
    if (day.endedMeals.indexOf(meal) < 0) {
      return this.fail('该餐未处于结束状态');
    }
    const result = this.commit((next) => {
      const nextDay = next.days[day.businessDate] || day;
      nextDay.endedMeals = nextDay.endedMeals.filter((entry) => entry !== meal);
    });
    return result.ok ? this.succeed(`${mealLabel(meal)}已重开，可重新规划或补记`) : result;
  }

  // -------------------------------------------------------------------------
  // 记餐
  // -------------------------------------------------------------------------

  /**
   * 取某餐的视图模型（含 hasPlan/items/windowId/swappableOffers/soldOut 标记）。
   * 每次都从持久化 rawText 现算，保证锁定、售罄、选中的备选变化后视图立即一致；
   * 没有计划或解析失败时返回 null，调用方按"该餐无推荐"处理。
   */
  private planMealView(meal: Meal): MealView | null {
    const day = this.currentDay();
    if (!day.plan || !day.plan.rawText) {
      return null;
    }
    const envelope = this.parsePlanEnvelope(day.plan.rawText);
    const interpretation = interpretPlanResult(envelope, this.state, day, this.catalog());
    return interpretation.meals.find((entry) => entry.meal === meal) || null;
  }

  /**
   * 确认一餐：把方案项落成一条 active 记餐记录（含菜单快照与价格/营养未知标记）。
   * 幂等有三重保证，防止重复点击/弱网重试翻倍累计：
   *  1. 该餐已有 active 记录 → 直接返回 duplicate，不再新增；
   *  2. 用 businessDate+meal+planKey 生成 confirmationId，命中已有记录也返回 duplicate；
   *  3. 最终仍走 commit 单事务写入，不会出现半条记录。
   * 价格编辑在输入边界统一校验：null 表示"明确未知"；数字必须过 isValidMoney，
   * 非法金额直接拒绝（不静默回退菜单价、不部分写入）；未知价格不参与精确预算，
   * 但会把 priceKnown=false 一并持久化，视图层据此展示"未知"而不是 0。
   * 记录里保存菜单版本与名称快照：之后换菜单不得改写历史已吃记录。
   */
  confirmMeal(meal: Meal, priceEdits: Record<string, number | null>): ActionResult {
    this.ensureInitialized();
    const day = this.currentDay();
    const view = this.planMealView(meal);
    if (!view || !view.hasPlan) {
      return this.fail('该餐没有可确认的推荐，请先生成方案');
    }
    const active = day.logs.filter((log) => log.meal === meal && log.status === 'active');
    if (active.length > 0) {
      // 已经确认过的餐次不再新增记录（重复点击/重复提交不重复累计），返回幂等成功。
      return { ok: true, message: '该餐已确认过，本次点击未重复累计', duplicate: true };
    }
    const envelope = this.parsePlanEnvelope(day.plan!.rawText);
    const plans: any[] = envelope && envelope.result && Array.isArray(envelope.result.plans) ? envelope.result.plans : [];
    const selected = plans[Math.min(day.selectedPlanIndex, plans.length - 1)] || plans[0];
    if (!selected) {
      return this.fail('当前方案缺少 planKey，无法生成幂等确认键');
    }
    const confirmationId = `conf-plan-${day.businessDate}-${meal}-${selected.planKey}`;
    const existing = day.logs.find((log) => log.confirmationId === confirmationId);
    if (existing) {
      return { ok: true, message: '该餐已确认过，本次点击未重复累计', duplicate: true };
    }
    // 价格编辑输入边界：非法金额在这里整体拒绝，保证不部分写入、不静默回退菜单价。
    for (const itemKey of Object.keys(priceEdits || {})) {
      const edited = (priceEdits as Record<string, number | null>)[itemKey];
      if (edited !== undefined && edited !== null && !isValidMoney(edited)) {
        const item = view.items.find((entry) => entry.itemKey === itemKey);
        return this.fail(`“${item ? item.name : itemKey}”的实付金额无效：必须是非负整数（分），且不超过 ￥1,000,000.00`);
      }
    }
    const items = view.items.map((item) => {
      const edited = priceEdits && Object.prototype.hasOwnProperty.call(priceEdits, item.itemKey) ? priceEdits[item.itemKey] : undefined;
      let unitPriceCents = item.priceCents;
      let priceKnown = item.priceKnown;
      if (edited !== undefined) {
        if (edited === null) {
          unitPriceCents = null;
          priceKnown = false;
        } else {
          unitPriceCents = edited;
          priceKnown = true;
        }
      }
      return {
        itemKey: item.itemKey,
        source: 'menuOffer' as const,
        offerId: item.offerId,
        dishId: item.dishId,
        menuVersion: day.plan!.menuVersion,
        nameSnapshot: item.name,
        portionCode: (item.portionLabel === '半份' ? 'half' : 'full') as 'full' | 'half',
        quantity: item.quantity,
        unitPriceCents,
        priceKnown,
        nutrition: item.nutrition
          ? {
              energyKcal: item.nutrition.energyKcal,
              proteinDg: item.nutrition.proteinDg,
              fatDg: item.nutrition.fatDg,
              carbDg: item.nutrition.carbDg,
            }
          : null,
        nutritionBasis: item.estimated ? 'estimated' : 'menu',
        note: null,
      };
    });
    const now = this.now();
    const record: MealLog = {
      contractVersion: '1.0',
      recordId: makeRecordId(now, 'confirm'),
      confirmationId,
      businessDate: day.businessDate,
      tzOffsetMinutes: day.tzOffsetMinutes,
      meal,
      status: 'active',
      revision: 1,
      supersedesRecordId: null,
      revokedByRecordId: null,
      createdAt: nowIso(now),
      updatedAt: nowIso(now),
      menuVersion: day.plan!.menuVersion,
      items,
    };
    const result = this.commit((next) => {
      const nextDay = next.days[day.businessDate] || day;
      nextDay.logs = nextDay.logs.concat([record]);
    });
    return result.ok ? this.succeed(`${mealLabel(meal)}已确认 ${items.length} 项，计入实际消费`) : result;
  }

  /**
   * 手动补记（没走方案确认的餐）。与 confirmMeal 的区别：
   *  - 不依赖方案/planKey，来源是用户输入；
   *  - 价格与营养允许未知：未知价格记 priceKnown=false、未知营养记 null，绝不补 0；
   *  - clientToken 用于幂等：同一 token 重复提交只落一条，覆盖小程序重试/双击场景。
   */
  addManualLog(meal: Meal, input: ManualLogInput): ActionResult {
    this.ensureInitialized();
    const day = this.currentDay();
    if (!input || typeof input.name !== 'string' || input.name.trim() === '') {
      return this.fail('补记食物名称不能为空');
    }
    if (input.name.length > 60) {
      return this.fail('补记食物名称过长（上限 60 字）');
    }
    if (!Number.isInteger(input.quantity) || input.quantity < 1 || input.quantity > 99) {
      return this.fail('数量必须是 1–99 的整数');
    }
    if (input.portionCode !== 'full' && input.portionCode !== 'half') {
      return this.fail('份量只能是整份或半份');
    }
    if (input.priceKnown && !isValidMoney(input.unitPriceCents)) {
      return this.fail('已知价格无效：必须是非负整数（分），且不超过 ￥1,000,000.00');
    }
    const confirmationId = `conf-manual-${day.businessDate}-${meal}-${String(input.clientToken)}`;
    const existing = day.logs.find((log) => log.confirmationId === confirmationId);
    if (existing) {
      return { ok: true, message: '该补记已提交过，本次点击未重复累计', duplicate: true };
    }
    const nutrition = input.nutrition
      ? {
          energyKcal: input.nutrition.energyKcal,
          proteinDg: input.nutrition.proteinDg,
          fatDg: input.nutrition.fatDg,
          carbDg: input.nutrition.carbDg,
        }
      : null;
    const complete = !!nutrition && [nutrition.energyKcal, nutrition.proteinDg, nutrition.fatDg, nutrition.carbDg].every((value) => typeof value === 'number');
    const now = this.now();
    const record: MealLog = {
      contractVersion: '1.0',
      recordId: makeRecordId(now, 'manual'),
      confirmationId,
      businessDate: day.businessDate,
      tzOffsetMinutes: day.tzOffsetMinutes,
      meal,
      status: 'active',
      revision: 1,
      supersedesRecordId: null,
      revokedByRecordId: null,
      createdAt: nowIso(now),
      updatedAt: nowIso(now),
      menuVersion: this.catalog().menuVersion,
      items: [
        {
          itemKey: `${meal}:manual:${input.clientToken}`,
          source: 'manual',
          offerId: null,
          dishId: null,
          menuVersion: null,
          nameSnapshot: input.name.trim(),
          portionCode: input.portionCode,
          quantity: input.quantity,
          unitPriceCents: input.priceKnown ? input.unitPriceCents : null,
          priceKnown: !!input.priceKnown,
          nutrition: complete ? nutrition : null,
          nutritionBasis: complete ? 'userEntered' : null,
          note: input.note || null,
        },
      ],
    };
    const result = this.commit((next) => {
      const nextDay = next.days[day.businessDate] || day;
      nextDay.logs = nextDay.logs.concat([record]);
    });
    return result.ok ? this.succeed('补记已记录；未知营养/价格不会被当作 0') : result;
  }

  // -------------------------------------------------------------------------
  // 自选菜（B1）：草稿状态查询 → 明确确认落账
  // -------------------------------------------------------------------------

  /**
   * 自选菜状态查询（只读）：本餐能不能自选、有哪些窗口与可售报价、售罄/未知如何标记。
   * 不写任何状态、不调用核心、不读日志以外的持久化事实。
   * "已结束/已确认/无供应/无报价"都在这里给出原因码，页面据此引导到既有路径
   * （reopenMeal 重开、记录页改记或撤销），不提供第二条重复确认入口。
   * 默认窗口优先取当前推荐方案的窗口，让用户停在同一个窗口里选。
   */
  getSelfPickView(meal: Meal): SelfPickView {
    this.ensureInitialized();
    const day = this.currentDay();
    const catalog = this.catalog();
    if (MEALS.indexOf(meal) < 0) {
      // 非法餐次不给窗口数据：避免页面拿一个不存在的餐次去构造记录。
      return {
        meal,
        mealLabel: String(meal),
        businessDate: day.businessDate,
        menuVersion: catalog.menuVersion,
        simulated: this.catalogIsSimulated(),
        supply: false,
        ended: false,
        confirmed: false,
        confirmedRecordIds: [],
        canPick: false,
        blockCode: 'no-supply',
        blockMessage: '餐次不合法：只能是早餐/午餐/晚餐。',
        windows: [],
        defaultWindowId: null,
        totalOfferCount: 0,
      };
    }
    const planView = this.planMealView(meal);
    return buildSelfPickView(
      catalog,
      day,
      meal,
      planView ? planView.windowId : null,
      this.catalogIsSimulated(),
      this.selfPickNutritionFor(catalog, meal),
    );
  }

  /**
   * 取当前菜单+餐次的单份营养结果：唯一来源是核心 mp_offer_nutrition。
   * 已有同来源结果时直接复用（数量变化/重复进页不再查核心）；菜单或餐次变化后重新查询，
   * 旧结果因来源键不符不会被带入。核心不可用或返回不一致时如实报错，不补 0、不派生。
   */
  async ensureSelfPickNutrition(meal: Meal): Promise<{ ok: boolean; message: string; offerCount: number }> {
    this.ensureInitialized();
    const catalog = this.catalog();
    const reused = this.selfPickNutritionFor(catalog, meal);
    if (reused) {
      return { ok: true, message: '当前菜单/餐次的单份营养结果已就绪（复用，不重复查询核心）', offerCount: Object.keys(reused.byOfferId).length };
    }
    const offerIds = (catalog.offers || [])
      .filter((offer) => (offer.mealWindows || []).indexOf(meal) >= 0)
      .map((offer) => offer.offerId);
    if (offerIds.length === 0) {
      this.selfPickNutrition = { menuVersion: catalog.menuVersion, catalogHash: catalog.catalogHash, meal, byOfferId: {} };
      return { ok: true, message: '本餐没有可售报价：无单份营养可查', offerCount: 0 };
    }
    try {
      await ensureCoreRuntime();
      const request: OfferNutritionRequest = { contractVersion: '1.0', catalog, meal, offerIds };
      const rawText = callCore('offer-nutrition', JSON.stringify(request));
      const envelope = JSON.parse(rawText);
      if (!envelope || envelope.ok !== true || !envelope.result) {
        const error = envelope && envelope.error ? envelope.error : null;
        return {
          ok: false,
          message: `核心未返回可用营养：${error ? `${error.code} ${error.message}` : '响应缺少 result'}`,
          offerCount: 0,
        };
      }
      const result = envelope.result as OfferNutritionResult;
      // 来源绑定：核心回显的菜单/餐次必须与当前来源一致，否则整批不采用。
      if (result.menuVersion !== catalog.menuVersion || result.catalogHash !== catalog.catalogHash || result.meal !== meal) {
        return { ok: false, message: '核心返回的菜单/餐次与当前来源不一致：不采用该结果', offerCount: 0 };
      }
      const offers = Array.isArray(result.offers) ? result.offers : [];
      if (offers.length !== offerIds.length || offers.some((entry, index) => entry.offerId !== offerIds[index])) {
        return { ok: false, message: '核心返回的报价数量/顺序与请求不一致：不采用该结果', offerCount: 0 };
      }
      const byOfferId: Record<string, SelfPickNutritionEntry> = {};
      for (const entry of offers) {
        byOfferId[entry.offerId] = {
          nutrition: entry.nutrition,
          estimated: !!entry.estimated,
          nutritionComplete: !!entry.nutritionComplete,
        };
      }
      this.selfPickNutrition = { menuVersion: catalog.menuVersion, catalogHash: catalog.catalogHash, meal, byOfferId };
      return { ok: true, message: `核心已返回 ${offers.length} 个报价的单份营养`, offerCount: offers.length };
    } catch (error: any) {
      return { ok: false, message: `核心 Offer 营养调用失败：${describeError(error)}`, offerCount: 0 };
    }
  }

  /** 只返回与当前菜单+餐次同来源的结果；来源不符视为没有结果（不把旧草稿绑到新来源）。 */
  private selfPickNutritionFor(catalog: Catalog, meal: Meal): SelfPickNutritionSnapshot | null {
    const snapshot = this.selfPickNutrition;
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

  /**
   * 新建草稿标识：页面在"开始一个草稿"时调用一次并存住，之后所有勾选/重试都复用它。
   * 草稿标识只用于幂等键，不写入持久化状态；取消/返回只丢弃它，不产生任何记录。
   */
  newSelfPickDraftToken(): string {
    return createSelfPickDraftToken(this.now());
  }

  /**
   * 草稿预览（只读）：把页面临时选择解析成"确认后会记成什么"。
   * 与 confirmSelfPickMeal 复用同一份规则，避免预览和落账两套口径。
   * 预算/营养目标只形成 hints（提示），不参与 ok 判定——偏离目标不得拒绝保存。
   */
  previewSelfPickDraft(meal: Meal, windowId: string, selections: SelfPickSelection[]): SelfPickDraftPreview {
    this.ensureInitialized();
    const day = this.currentDay();
    const catalog = this.catalog();
    return buildSelfPickDraftPreview(
      catalog,
      day,
      meal,
      windowId,
      selections,
      this.selfPickDraftContext(day, meal),
      this.selfPickNutritionFor(catalog, meal),
    );
  }

  /** 自选预览的提示上下文：只取当前既有的预算设置、摄入汇总与目标单餐参考值。 */
  private selfPickDraftContext(day: DayRecord, meal: Meal): SelfPickDraftContext {
    const intake = summarizeActiveLogs(day);
    const target = this.currentTargetView();
    const reference = target && target.mealReference ? (target.mealReference as any)[meal] : null;
    return {
      budgetCents: this.state.settings.budgetCents,
      spentKnownCents: intake.priceKnownCents,
      spentPriceIncomplete: intake.priceIncomplete,
      mealEnergyTargetKcal: reference && typeof reference.energyKcal === 'number' ? reference.energyKcal : null,
    };
  }

  /**
   * 确认自选菜：整个功能唯一的写入点，只有用户明确执行"确认吃了"后才调用。
   *
   * 校验顺序（先状态、再幂等、后内容）：
   *  1. 餐次合法；有窗口供应；该餐未被结束；该餐当前没有 active 记录。
   *     已结束只能走系统已有的 reopenMeal，已确认只能走记录页改记/撤销，不绕开状态校验。
   *  2. 同一草稿标识的重复提交：命中同一 confirmationId 直接返回 duplicate，
   *     不新增、不累计（覆盖双击/重试/重复提交）。
   *  3. 内容沿用 buildSelfPickDraftPreview：单窗口边界、报价存在且供应本餐、未售罄、
   *     份量来自菜单真实 Offer、数量 1–99、实付金额合法。
   *  4. 构造带菜单快照（名称/份量/价格/营养/估算标记）的 MealLog，走 commit 单事务写入。
   *
   * 落账后只做派生标记（planNeedsUpdate/affectedMeals），不在后台静默重算推荐；
   * 刷新仍是用户主动点现有"刷新方案"入口。提示（hints）只展示，不影响是否保存。
   */
  confirmSelfPickMeal(meal: Meal, input: SelfPickConfirmInput): SelfPickConfirmResult {
    this.ensureInitialized();
    const day = this.currentDay();
    const catalog = this.catalog();
    const base: SelfPickConfirmResult = {
      ok: false,
      message: '',
      meal,
      businessDate: day.businessDate,
      recordId: null,
      confirmationId: null,
      planNeedsUpdate: false,
      affectedMeals: [],
      hints: [],
    };
    if (MEALS.indexOf(meal) < 0) {
      return { ...base, message: '餐次不合法：只能是早餐/午餐/晚餐' };
    }
    if (!input || typeof input !== 'object') {
      return { ...base, message: '确认参数缺失' };
    }
    if (!isValidSelfPickDraftToken(input.draftToken)) {
      return { ...base, message: '草稿确认标识无效：请重新开始一个草稿再确认' };
    }
    const confirmationId = selfPickConfirmationId(day.businessDate, meal, input.draftToken);
    const existing = (day.logs || []).find((log) => log.confirmationId === confirmationId);
    if (existing) {
      // 同一草稿的重复提交：幂等成功，不新增记录、不累计摄入。
      return {
        ...base,
        ok: true,
        duplicate: true,
        recordId: existing.recordId,
        confirmationId,
        message: existing.status === 'active' ? '这一餐已记录过，本次点击未重复累计' : '该草稿已处理过，本次点击未重复累计',
      };
    }
    const active = (day.logs || []).filter((log) => log.meal === meal && log.status === 'active');
    if (active.length > 0) {
      return { ...base, message: `${mealLabel(meal)}已有有效记录：如需修改请到记录页改记或撤销` };
    }
    if (isMealEnded(day, meal)) {
      return { ...base, message: `${mealLabel(meal)}已被标记为不吃：请先在今日页用"重开该餐"恢复，再自选记餐` };
    }
    if (!mealHasSupply(catalog, meal)) {
      return { ...base, message: `当前菜单没有任何窗口供应${mealLabel(meal)}，无法自选记餐` };
    }
    const window = (catalog.windows || []).find((entry) => entry.windowId === input.windowId);
    if (!window) {
      return { ...base, message: '所选窗口不在当前菜单中，请重新选择' };
    }
    const preview = buildSelfPickDraftPreview(
      catalog,
      day,
      meal,
      input.windowId,
      input.selections,
      this.selfPickDraftContext(day, meal),
      this.selfPickNutritionFor(catalog, meal),
    );
    if (!preview.ok) {
      return { ...base, message: preview.message, errors: preview.errors };
    }
    const now = this.now();
    const record: MealLog = {
      contractVersion: '1.0',
      recordId: makeRecordId(now, 'selfpick'),
      confirmationId,
      businessDate: day.businessDate,
      tzOffsetMinutes: day.tzOffsetMinutes,
      meal,
      status: 'active',
      revision: 1,
      supersedesRecordId: null,
      revokedByRecordId: null,
      createdAt: nowIso(now),
      updatedAt: nowIso(now),
      menuVersion: catalog.menuVersion,
      items: preview.lines.map((line) => logItemFromDraftLine(meal, line, catalog.menuVersion)),
    };
    const result = this.commit((next) => {
      const nextDay = next.days[day.businessDate] || day;
      nextDay.logs = nextDay.logs.concat([record]);
    });
    if (!result.ok) {
      return { ...base, message: result.message };
    }
    // 只标记受影响推荐需要更新；不在这里调用核心重算，刷新仍由用户主动触发。
    const update = planUpdateState(this.currentDay(), catalog);
    return {
      ...base,
      ok: true,
      message: `${mealLabel(meal)}已确认 ${preview.lines.length} 项（${preview.priceLabel}），已计入实际消费`,
      recordId: record.recordId,
      confirmationId,
      planNeedsUpdate: update.needsUpdate,
      affectedMeals: update.meals,
      hints: preview.hints,
    };
  }

  /**
   * 剩余餐次推荐是否已过期（派生，不持久化）。
   * 计划生成后又有有效记录写入时，后续餐次推荐是按"当时还没吃"算出来的；
   * 页面据此提示"需更新"并复用现有"刷新方案"入口，系统不静默重算。
   */
  getPlanUpdateState(): { needsUpdate: boolean; meals: Meal[]; message: string } {
    this.ensureInitialized();
    return planUpdateState(this.currentDay(), this.catalog());
  }

  /**
   * 改记一条有效记录。不原地改历史，而是"旧记录标 superseded + 追加新 revision 记录"，
   * 旧记录保留可追溯；新记录 revision+1 并指向 supersedesRecordId。
   * 只允许改价格/数量/备注等消费事实，不允许借此改写营养算法或菜单快照。
   */
  editLog(recordId: string, patch: LogEditInput): ActionResult {
    this.ensureInitialized();
    const day = this.currentDay();
    const target = day.logs.find((log) => log.recordId === recordId && log.status === 'active');
    if (!target) {
      return this.fail('只能修改当前有效的记餐记录');
    }
    if (!patch || !Array.isArray(patch.items) || patch.items.length === 0) {
      return this.fail('修改内容为空');
    }
    const patches = new Map<string, LogEditItemPatch>();
    for (const itemPatch of patch.items) {
      if (!itemPatch.itemKey) {
        return this.fail('修改项缺少 itemKey');
      }
      if (itemPatch.quantity !== undefined && (!Number.isInteger(itemPatch.quantity) || itemPatch.quantity < 1 || itemPatch.quantity > 99)) {
        return this.fail('数量必须是 1–99 的整数');
      }
      if (itemPatch.priceKnown === true && !isValidMoney(itemPatch.unitPriceCents)) {
        return this.fail('已知价格无效：必须是非负整数（分），且不超过 ￥1,000,000.00');
      }
      // 与确认/补记同一金额边界：显式给的数字必须合法；null=明确置未知，不落成"已知 null"。
      if (itemPatch.unitPriceCents !== undefined && itemPatch.unitPriceCents !== null && !isValidMoney(itemPatch.unitPriceCents)) {
        return this.fail('已知价格无效：必须是非负整数（分），且不超过 ￥1,000,000.00');
      }
      patches.set(itemPatch.itemKey, itemPatch);
    }
    const now = this.now();
    const nextItems = target.items.map((item) => {
      const itemPatch = patches.get(item.itemKey);
      if (!itemPatch) {
        return item;
      }
      let unitPriceCents = item.unitPriceCents;
      let priceKnown = item.priceKnown;
      if (itemPatch.priceKnown === false) {
        unitPriceCents = null;
        priceKnown = false;
      } else if (itemPatch.unitPriceCents !== undefined) {
        unitPriceCents = itemPatch.unitPriceCents;
        priceKnown = itemPatch.unitPriceCents !== null;
      }
      return {
        ...item,
        quantity: itemPatch.quantity !== undefined ? itemPatch.quantity : item.quantity,
        unitPriceCents,
        priceKnown,
        note: itemPatch.note !== undefined ? itemPatch.note : item.note,
      };
    });
    const record: MealLog = {
      ...target,
      recordId: makeRecordId(now, 'edit'),
      confirmationId: `${target.confirmationId}-rev${target.revision + 1}`,
      status: 'active',
      revision: target.revision + 1,
      supersedesRecordId: target.recordId,
      revokedByRecordId: null,
      createdAt: nowIso(now),
      updatedAt: nowIso(now),
      items: nextItems,
    };
    const result = this.commit((next) => {
      const nextDay = next.days[day.businessDate] || day;
      nextDay.logs = nextDay.logs
        .map((log) =>
          log.recordId === recordId
            ? { ...log, status: 'superseded' as const, updatedAt: nowIso(now) }
            : log,
        )
        .concat([record]);
    });
    return result.ok ? this.succeed('已改记为新的有效记录，旧记录保留为历史') : result;
  }

  /**
   * 撤销记录：只把 active 记录改成 revoked，不物理删除。
   * 保留历史用于"误操作可查"，同时实际消费/营养汇总按 active 状态重算自然回落。
   */
  revokeLog(recordId: string): ActionResult {
    this.ensureInitialized();
    const day = this.currentDay();
    const target = day.logs.find((log) => log.recordId === recordId && log.status === 'active');
    if (!target) {
      return this.fail('只能撤销当前有效的记餐记录');
    }
    const now = this.now();
    const result = this.commit((next) => {
      const nextDay = next.days[day.businessDate] || day;
      nextDay.logs = nextDay.logs.map((log) =>
        log.recordId === recordId
          ? { ...log, status: 'revoked' as const, updatedAt: nowIso(now) }
          : log,
      );
    });
    return result.ok ? this.succeed('已撤销该记录，实际消费与营养汇总同步回落') : result;
  }

  // -------------------------------------------------------------------------
  // 菜单导入
  // -------------------------------------------------------------------------

  /**
   * 菜单导入第一步：本地解析 → 核心 ValidateMenuCatalog 结构/语义预检 → 计算差异。
   * 本方法绝不修改当前状态：只把"通过预检的菜单 + 一次性 token + 差异视图"挂到 pendingMenu，
   * 用户明确确认后 applyMenu 才替换。差异用于提前告知影响：旧计划是否失效、
   * 哪些锁定在新菜单下无效、哪些售罄标记将被按窗口清理。
   * 预检失败要保留可读的 stage（parse/validate）与字段路径，页面才能定位到具体字段。
   */
  async preflightMenu(text: string, fileName: string): Promise<MenuPreflight> {
    this.ensureInitialized();
    const parsed = parseMenuText(text);
    const base: MenuPreflight = {
      ok: false,
      stage: 'parse',
      message: parsed.message,
      errors: parsed.errors,
      fileName,
      catalog: null,
      diff: null,
      token: null,
      rawError: null,
    };
    if (!parsed.ok || !parsed.catalog) {
      this.pendingMenu = null;
      return base;
    }
    try {
      await ensureCoreRuntime();
      const { envelope } = requestValidateMenu(
        (requestText) => callCore('validate-menu', requestText),
        parsed.catalog,
      );
      if (envelope.ok === false) {
        const error = envelope.error || {};
        this.pendingMenu = null;
        return {
          ...base,
          stage: 'validate',
          ok: false,
          message: `核心预检拒绝：${error.message || error.code || 'INVALID_INPUT'}${error.fieldPath ? `（${error.fieldPath}）` : ''}`,
          errors: [{ field: error.fieldPath || 'catalog', message: error.message || '预检失败' }],
          rawError: JSON.stringify(error),
        };
      }
      const result = envelope.result || {};
      if (result.valid !== true) {
        this.pendingMenu = null;
        return {
          ...base,
          stage: 'validate',
          ok: false,
          message: '核心预检未通过：菜单不合法',
          errors: [{ field: 'catalog', message: 'valid=false' }],
        };
      }
      // 换菜选择锁只约束“换菜后这次重算”，旧计划会在替换时一并失效（applyMenu 置空 plan），
      // 选择锁不保留（否则会成为解除路径无法处理的失效项）。预检的“失效锁定”提示只算用户锁定，
      // 与替换后的实际状态保持一致（T08f05 四补丁组合验证）。
      const day = this.currentDay();
      const dayForDiff = { ...day, itemLocks: day.itemLocks.filter((lock) => !isSwapSelectionLock(lock)) };
      const diff = buildMenuDiff(this.catalog(), parsed.catalog, dayForDiff);
      const token = `menu-${parsed.catalog.catalogHash}-${Date.now().toString(36)}`;
      this.pendingMenu = { token, catalog: parsed.catalog, diff, fileName };
      return {
        ...base,
        ok: true,
        stage: 'ready',
        message: `预检通过：${result.menuVersion}（窗口 ${result.counts.windows}，菜品 ${result.counts.dishes}，报价 ${result.counts.offers}）；确认后才会替换。`,
        catalog: parsed.catalog,
        diff,
        token,
      };
    } catch (error: any) {
      this.pendingMenu = null;
      return {
        ...base,
        stage: 'validate',
        ok: false,
        message: `核心预检失败：${describeError(error)}`,
        errors: [{ field: 'core', message: describeError(error) }],
      };
    }
  }

  /**
   * 菜单导入第二步：校验一次性凭证后原子替换菜单。
   * 一次性语义：apply 成功即清空 pendingMenu，旧 token 不能二次替换（防止页面缓存重放）。
   * 替换时保留用户锁定（由用户显式解除/替换），但旧计划直接置空：
   * 它绑定的是旧 menuVersion，继续展示会给出"菜单里已经不存在的菜"。
   * 换菜选择锁只约束旧计划那次重算，随旧计划一并作废（见 commit 内注释）。
   * 售罄标记按 prepareCatalogReplacement 的作用域判定清理，且提示文案列出被清理的
   * 具体窗口/餐次/菜名，避免用户只看到一句"清理了 N 条"。
   */
  applyMenu(preflight: MenuPreflight): ActionResult {
    this.ensureInitialized();
    const pending = this.pendingMenu;
    if (!pending || !preflight || preflight.token !== pending.token) {
      return this.fail('预检凭证已失效，请重新预检');
    }
    const day = this.currentDay();
    const prepared = prepareCatalogReplacement(day, pending.catalog);
    const now = this.now();
    const result = this.commit((next) => {
      next.catalog = pending.catalog;
      next.catalogMeta = {
        source: 'imported',
        importedAt: nowIso(now),
        importedFileName: pending.fileName,
      };
      const nextDay = next.days[day.businessDate] || day;
      nextDay.soldOut = prepared.soldOut;
      // 旧计划失效；用户锁定记录保留，由用户显式解除/替换。
      // 换菜选择锁随旧计划一并作废：它只约束“换菜后这次重算”，plan 已置空；
      // 若保留，换菜单后会变成 validateLocks 的失效项，而解除路径只认用户锁，
      // 首页会卡在 lock-conflict 无法自救（T08f05 四补丁组合验证发现）。
      nextDay.itemLocks = nextDay.itemLocks.filter((lock) => !isSwapSelectionLock(lock));
      nextDay.plan = null;
      nextDay.selectedPlanIndex = 0;
    });
    if (!result.ok) {
      return result;
    }
    this.pendingMenu = null;
    this.lastImport = {
      ok: true,
      fileName: pending.fileName,
      message: `菜单已替换为 ${pending.catalog.menuVersion}`,
      at: nowIso(now),
    };
    const notes: string[] = [`菜单已替换为 ${pending.catalog.menuVersion}`];
    if (pending.diff.impactedMeals.length > 0) {
      notes.push(`旧计划已失效（受影响餐次：${pending.diff.impactedMeals.map((meal) => MEAL_LABELS[meal]).join('、')}）`);
    }
    if (pending.diff.invalidLocks.length > 0) {
      notes.push(`保留 ${pending.diff.invalidLocks.length} 条失效锁定，需你显式解除或替换`);
    }
    if (prepared.removedSoldOut > 0) {
      const dropped = pending.diff.droppedSoldOut.map((entry) => entry.label).join('、');
      notes.push(`清理 ${prepared.removedSoldOut} 条新菜单中无意义的售罄标记${dropped ? `（${dropped}）` : ''}`);
    }
    return this.succeed(notes.join('；'));
  }

  /** 菜单页视图：信息 + 导入提示 + 备份状态 + 最近一次导入结果。不导出也无需重新计算差异。 */
  getMenuView(): MenuView {
    this.ensureInitialized();
    return {
      info: this.menuInfo(),
      simulated: this.catalogIsSimulated(),
      importHint:
        '导入前会先调用核心 ValidateMenuCatalog 做结构/语义预检，并展示对当前计划、锁定与售罄的影响；只有明确确认后才替换。',
      backup: this.buildBackupView(),
      lastImport: this.lastImport,
    };
  }

  // -------------------------------------------------------------------------
  // 导出 / 恢复
  // -------------------------------------------------------------------------

  /** 备份元数据视图：只读展示，不触发任何文件/存储操作。 */
  private buildBackupView(): BackupInfoView {
    const backup = this.state.backup;
    return {
      lastExportedAt: backup.lastExportedAt,
      lastExportedDigest: backup.lastExportedDigest,
      lastRestoredAt: backup.lastRestoredAt,
      lastRestoredDigest: backup.lastRestoredDigest,
      lastFilePath: backup.lastFilePath,
      lastMessage: backup.lastMessage,
    };
  }

  /**
   * 导出备份：序列化当前状态 → 计算稳定摘要 → 尝试写本地文件 → 记录导出元数据。
   * 文件写入失败不视为导出失败：文本已经生成，页面仍可复制文本，只是 filePath=null；
   * 这样在文件系统受限（如开发者工具/只读沙箱）时仍能保住用户数据。
   * 元数据写入走 commit，因此导出动作本身也会递增 dataSeq（异步响应据此判定过期）。
   */
  async exportBackup(): Promise<BackupExport> {
    this.ensureInitialized();
    const now = this.now();
    let serialized: { text: string; digest: string };
    try {
      serialized = serializeBackup(this.state, now);
    } catch (error: any) {
      return { ok: false, message: `导出序列化失败：${describeError(error)}`, text: '', digest: '', filePath: null, exportedAt: nowIso(now) };
    }
    let filePath: string | null = null;
    try {
      if (hasWx()) {
        const wx = getWx();
        if (typeof wx.getFileSystemManager === 'function' && wx.env && wx.env.USER_DATA_PATH) {
          filePath = `${wx.env.USER_DATA_PATH}/tiankeshike-backup-${this.state.activeDate}.json`;
          wx.getFileSystemManager().writeFileSync(filePath, serialized.text, 'utf8');
        }
      }
    } catch (error: any) {
      filePath = null;
      this.lastAction = `备份已生成，但写本地文件失败：${describeError(error)}`;
    }
    const result = this.commit((next) => {
      next.backup = {
        ...next.backup,
        lastExportedAt: nowIso(now),
        lastExportedDigest: serialized.digest,
        lastFilePath: filePath,
        lastMessage: filePath ? '已生成备份并写入本地文件' : '已生成备份文本（未写入文件）',
      };
    });
    if (!result.ok) {
      return { ok: false, message: result.message, text: serialized.text, digest: serialized.digest, filePath, exportedAt: nowIso(now) };
    }
    return {
      ok: true,
      message: filePath ? `备份已生成并写入：${filePath}` : '备份已生成；可复制文本或稍后重试写文件',
      text: serialized.text,
      digest: serialized.digest,
      filePath,
      exportedAt: nowIso(now),
    };
  }

  /**
   * 恢复预检：解析备份文本 → 校验格式/版本/摘要/状态结构 → 挂一次性 token。
   * 本方法不写任何状态；真正的原子替换在 applyRestore。摘要校验失败必须在这一步
   * 就阻断（比对文件摘要与内容摘要），不能等用户确认后才提示备份已被篡改。
   */
  async preflightRestore(text: string): Promise<RestorePreflight> {
    this.ensureInitialized();
    const parsed = parseBackupText(text);
    const base: RestorePreflight = {
      ok: false,
      stage: 'parse',
      message: parsed.message,
      errors: parsed.errors,
      digest: parsed.digest,
      state: null,
      summary: '',
      token: null,
    };
    if (!parsed.ok || !parsed.bundle) {
      this.pendingRestore = null;
      return base;
    }
    const token = `restore-${parsed.digest}-${Date.now().toString(36)}`;
    this.pendingRestore = { token, digest: parsed.digest as string, state: parsed.bundle.state, summary: summarizeBackup(parsed.bundle.state) };
    return {
      ...base,
      ok: true,
      stage: 'ready',
      message: '备份格式、版本、摘要与状态结构校验通过；确认后将原子替换本机数据。',
      state: parsed.bundle.state,
      summary: this.pendingRestore.summary,
      token,
    };
  }

  /**
   * 恢复执行：核对一次性 token → 在"补今天空桶"之前先算文件内容摘要（保证与导出文件一致）
   * → 用 ensureDay 为今天补空桶（恢复文件可能是昨天的，不迁移旧摄入）→ 单事务整体替换。
   * 恢复后保留贴身的 backup 操作历史字段（lastRestoredAt/Digest/Message），但内容摘要
   * 比对仍以"恢复文件本身"为准，所以第 8 行对照不会因为本次恢复时间而变化。
   * 返回 comparison 前 7 行比对业务数据、第 8 行比对内容摘要，便于用户逐项核对。
   */
  async applyRestore(preflight: RestorePreflight): Promise<RestoreResult> {
    this.ensureInitialized();
    const pending = this.pendingRestore;
    if (!pending || !preflight || preflight.token !== pending.token) {
      return { ok: false, message: '恢复预检凭证已失效，请重新预检', comparison: [], digest: '' };
    }
    const before = clone(this.state);
    const restoredFileState = clone(pending.state);
    // 恢复文件的摘要必须在补“今天空桶”之前核对，保证与导出文件一致。
    const digestOfFile = canonicalStateDigest(restoredFileState);
    // 恢复文件可能是昨天的数据：保留恢复内容，同时为今天补一个空桶（不迁移旧摄入）。
    const rolled = ensureDay(restoredFileState, this.now());
    const result = this.commit((next) => {
      // 保留本机最近一次导出/恢复记录，便于界面展示操作历史；其余字段整体恢复。
      const previousBackup = next.backup;
      const restoredBackup = restoredFileState.backup || previousBackup;
      Object.assign(next, clone(restoredFileState));
      next.backup = {
        ...restoredBackup,
        lastRestoredAt: nowIso(this.now()),
        lastRestoredDigest: pending.digest,
        lastMessage: '已从备份恢复',
      };
    });
    if (!result.ok) {
      return { ok: false, message: result.message, comparison: [], digest: pending.digest };
    }
    this.pendingRestore = null;
    // 逐项对照：前 7 行比较业务数据；第 8 行确认恢复内容摘要与备份文件一致
    // （backup 元数据会记录本次恢复时间，属于预期变化，不参与“内容是否一致”的判定）。
    const comparison = compareStates(before, this.state).slice(0, 7);
    comparison.push({
      label: '恢复内容摘要与备份文件一致',
      before: pending.digest,
      after: digestOfFile,
      equal: pending.digest === digestOfFile,
    });
    const mismatched = comparison.filter((row, index) => !row.equal && index < 7);
    const digestMatched = pending.digest === digestOfFile;
    const message = !digestMatched
      ? '恢复内容摘要复核失败：请勿继续使用该备份'
      : mismatched.length === 0
        ? `恢复完成，摘要 ${pending.digest.slice(0, 20)}… 与恢复前逐项一致${rolled ? '（已为今天补空记录桶）' : ''}`
        : `恢复完成；${mismatched.length} 项与本机恢复前状态不同（属正常覆盖，见对照表）${rolled ? '，并已为今天补空记录桶' : ''}`;
    this.lastAction = message;
    return {
      ok: digestMatched,
      message,
      comparison,
      digest: pending.digest,
    };
  }

  // -------------------------------------------------------------------------
  // 视图
  // -------------------------------------------------------------------------

  /**
   * 首页视图：把持久化状态投影成页面可直接渲染的结构。
   * 状态优先级是固定的，页面不要自己再推断：
   *   no-profile（未建档）→ unsupported（能力门）→ lock-conflict（锁定失效/冲突）
   *   → idle（没有计划，区分"今天已无餐次"与"还没生成"）→ ok/no-feasible。
   * 售罄/锁定/计划全部由领域函数现算：soldOutMarks 带窗口信息（多窗口下可区分同菜），
   * lockIssues 决定 LockConflict 的可见原因，计划项 soldOut 由 plan.ts 按窗口判定。
   */
  getHomeView(): HomeView {
    this.ensureInitialized();
    const now = this.now();
    const day = this.currentDay();
    const catalog = this.catalog();
    const menu = this.menuInfo();
    const capabilityError = checkCapability(catalog, this.state.settings);
    const lockIssues = validateLocks(day, catalog);
    const targetView = this.currentTargetView();
    const planEnvelope = day.plan && day.plan.rawText ? this.parsePlanEnvelope(day.plan.rawText) : null;
    // 视图里的“已锁定”只代表用户手动锁定：换菜选择锁只约束本次核心重算，
    // 若也画成“已锁定”，用户会以为自己刚换的菜被锁住、无法再换（DEFECT-T08A1-02）。
    // 计划/预算/摄入仍用同一份 day 数据，这里只过滤锁定来源，不动其它字段。
    const viewDay: DayRecord = { ...day, itemLocks: day.itemLocks.filter((lock) => !isSwapSelectionLock(lock)) };
    const interpretation = interpretPlanResult(planEnvelope, this.state, viewDay, catalog);

    let planState: HomeView['planState'];
    let planMessage = '';
    if (!this.state.profileDraft) {
      planState = 'no-profile';
      planMessage = '尚未建档：请先在“档案”页填写身体档案与目标，再生成今日方案。';
    } else if (capabilityError) {
      planState = 'unsupported';
      planMessage = `当前受支持能力不允许规划：${capabilityError}`;
    } else if (lockIssues.length > 0) {
      planState = 'lock-conflict';
      planMessage = `存在失效/冲突锁定，需先处理：${lockIssues.map((issue) => issue.reason).join('；')}`;
    } else if (!planEnvelope) {
      if (planningMeals(day, catalog).length === 0) {
        planState = 'all-handled';
        planMessage = '所有餐次都已确认或结束，本轮没有需要规划的餐次。';
      } else {
        planState = 'idle';
        planMessage = '尚未生成今天的方案；点击“刷新方案”调用 WASM 生成。';
      }
    } else if (planEnvelope.ok === false) {
      planState = 'error';
      planMessage = interpretation.message;
    } else {
      const status = interpretation.status;
      if (status === 'LockConflict') {
        planState = 'lock-conflict';
      } else if (planningMeals(day, catalog).length === 0) {
        planState = 'all-handled';
        planMessage = '所有餐次都已确认或结束，本轮没有需要规划的餐次。';
      } else if (interpretation.plans.length > 0) {
        planState = 'ok';
        planMessage = interpretation.message;
      } else {
        planState = 'no-plan';
        planMessage = interpretation.message;
      }
    }

    const spentMeals = MEALS.filter((meal) => day.logs.some((log) => log.meal === meal && log.status === 'active'));
    const totalMeals = MEALS.filter((meal) => mealHasSupply(catalog, meal)).length;
    // 计划生成后若又有实际记录写入，剩余推荐已过期：只标记"需更新"，不在这里重算。
    const planUpdate = planUpdateState(day, catalog);
    const target = targetView;
    const soldOutMarks = day.soldOut.map((mark) => {
      const dish = (catalog.dishes || []).find((entry) => entry.dishId === mark.dishId);
      const window = (catalog.windows || []).find((entry) => entry.windowId === mark.windowId);
      const dishName = dish ? dish.name : mark.dishId;
      const windowName = window ? window.name : null;
      // 多窗口菜单下同一道菜可能在不同窗口分别售罄，标签必须带窗口名；单窗口保持旧文案。
      const multiWindow = (catalog.windows || []).length > 1;
      return {
        meal: mark.meal,
        label: `${MEAL_LABELS[mark.meal]} · ${dishName}${multiWindow ? `（${windowName || mark.windowId}）` : ''}`,
        dishId: mark.dishId,
        dishName,
        windowId: mark.windowId,
        windowName,
      };
    });

    return {
      businessDate: day.businessDate,
      dateLabel: formatDateLabel(day.businessDate),
      weekdayLabel: weekdayLabel(now),
      tzOffsetMinutes: day.tzOffsetMinutes,
      menu,
      profileReady: !!this.state.profileDraft,
      profileSummary: profileSummary(this.state.profileDraft),
      target,
      planState,
      planStatus: interpretation.status,
      planStatusLabel: interpretation.statusLabel,
      planMessage,
      plans: interpretation.plans,
      selectedPlanIndex: interpretation.selectedIndex,
      meals: interpretation.meals,
      intake: interpretation.intake,
      budget: interpretation.budget,
      diagnostics: interpretation.diagnostics,
      flags: interpretation.flags.map((code) => flagLabel(code)),
      requestId: day.plan ? day.plan.requestId : null,
      planCreatedAt: day.plan ? day.plan.createdAt : null,
      planNeedsUpdate: planUpdate.needsUpdate,
      planUpdateMeals: planUpdate.meals,
      planUpdateMessage: planUpdate.message,
      canPlan: !!this.state.profileDraft && !capabilityError && planningMeals(day, catalog).length > 0,
      capabilityMessage: capabilityError ? `不受支持：${capabilityError}` : `当前受支持子集：${SUPPORTED_ALGORITHMS.join(' / ')} + comboRules=[]`,
      lockIssues: lockIssues.map((issue) => ({
        kind: issue.kind,
        meal: issue.meal,
        label: issue.label,
        reason: issue.reason,
        windowId: issue.windowId || null,
        offerId: issue.offerId || null,
      })),
      soldOutMarks,
      progress: {
        confirmedMeals: spentMeals.length,
        totalMeals,
        text: `${spentMeals.length} / ${totalMeals} 餐已确认`,
      },
      lastAction: this.lastAction,
    };
  }

  /**
   * 当前目标视图。目标与档案修订号绑定：profileRevision 不一致时返回 null，
   * 页面展示"未计算/需重算"，而不是继续展示基于旧档案算出的目标。
   */
  private currentTargetView(): TargetView | null {
    const target = this.state.target;
    if (!target || target.profileRevision !== this.state.profileRevision) {
      return null;
    }
    try {
      return mapTargetResult(JSON.parse(target.rawText));
    } catch (_e) {
      return null;
    }
  }

  /** 档案页视图：草稿 + 是否已保存 + 校验错误 + 当前目标/BMI。未建档时给默认草稿便于首次填写。 */
  getProfileView(): ProfileView {
    this.ensureInitialized();
    const draft = this.state.profileDraft ? clone(this.state.profileDraft) : createDefaultProfileDraft();
    const target = this.currentTargetView();
    return {
      draft,
      saved: !!this.state.profileDraft,
      profileRevision: this.state.profileRevision,
      validationErrors: [],
      bmiDisplayTenths: target ? target.bmiDisplayTenths : null,
      bmiLabel: target ? target.bmiLabel : '—',
      target,
      targetState: target ? 'ok' : 'idle',
      targetError: '',
      activityOptions: PROFILE_VIEW_OPTIONS.activityOptions,
      goalOptions: PROFILE_VIEW_OPTIONS.goalOptions,
    };
  }

  /**
   * 记录页视图。date 缺省为当前业务日，允许回看历史日期：
   * 历史视图只读（已结束/已撤销的餐次不能再确认），但改/撤历史记录仍按原日期桶操作，
   * 保证"补录昨天"不会把数据写进今天。
   */
  getLogsView(date?: string): LogsView {
    this.ensureInitialized();
    const today = this.currentDay();
    const businessDate = date || today.businessDate;
    const day = getDay(this.state, businessDate);
    const isToday = businessDate === today.businessDate;
    const catalog = this.catalog();
    const interpretation = isToday ? interpretPlanResult(this.parsePlanEnvelope(today.plan && today.plan.rawText ? today.plan.rawText : ''), this.state, today, catalog) : null;
    const meals: MealLogSectionView[] = MEALS.map((meal) => {
      const logs = day ? day.logs.filter((log) => log.meal === meal) : [];
      const active = logs.filter((log) => log.status === 'active').map((log) => buildLogView(log));
      const history = logs.filter((log) => log.status !== 'active').map((log) => buildLogView(log));
      const view = interpretation ? interpretation.meals.find((entry) => entry.meal === meal) : null;
      const planItems = view && view.hasPlan ? view.items : [];
      const ended = day ? day.endedMeals.indexOf(meal) >= 0 : false;
      const supply = mealHasSupply(catalog, meal);
      let confirmHint = '';
      if (!supply) confirmHint = '当前菜单没有窗口供应这一餐。';
      else if (ended) confirmHint = '该餐已结束；可重开或补记。';
      else if (active.length > 0) confirmHint = '该餐已确认；推荐不会覆盖已吃快照。';
      else if (planItems.length === 0) confirmHint = '尚无推荐菜品；可先生成方案或直接补记。';
      else confirmHint = '核对实付价格后确认，推荐不等于已吃。';
      return {
        meal,
        label: mealLabel(meal),
        ended,
        confirmed: active.length > 0,
        canConfirm: isToday && supply && !ended && active.length === 0 && planItems.length > 0,
        active,
        history,
        planItems,
        confirmHint,
      };
    });
    const dayForBudget = day || createDayRecord(businessDate, localTzOffsetMinutes(this.now()));
    return {
      businessDate,
      dateLabel: formatDateLabel(businessDate),
      meals,
      intake: buildIntakeView(dayForBudget),
      budget: buildBudgetView(this.state.settings, dayForBudget, interpretation ? interpretation.budgetInput : null),
      recentDays: this.recentDays(),
    };
  }

  /**
   * 只读：某月已落库的业务日（YYYY-MM 前缀），供记录页月历标记与月度汇总使用。
   * 不新增持久化结构、不做迁移、不写状态；返回原始 DayRecord 引用，调用方只读。
   */
  getMonthLogs(monthKey: string): { businessDate: string; day: DayRecord }[] {
    this.ensureInitialized();
    if (typeof monthKey !== 'string' || !/^\d{4}-\d{2}$/.test(monthKey)) {
      return [];
    }
    return Object.keys(this.state.days)
      .filter((key) => key.slice(0, 7) === monthKey)
      .sort()
      .map((key) => ({ businessDate: key, day: this.state.days[key] }));
  }

  /** 记录页顶部"最近几天"入口：按日期倒序，标记哪些天有记录可点。 */
  private recentDays(): { businessDate: string; hasLogs: boolean }[] {
    const keys = Object.keys(this.state.days).sort().reverse().slice(0, 7);
    return keys.map((key) => ({ businessDate: key, hasLogs: this.state.days[key].logs.length > 0 }));
  }

  /**
   * 开发/自检页视图：WASM 身份、存储键与大小、环境行、数据计数。
   * 只读聚合，不触发核心调用，也不暴露用户隐私字段（只给计数）。
   */
  getDevView(): DevView {
    this.ensureInitialized();
    const day = this.currentDay();
    return {
      appName: '天科食客',
      wasmPath: getWasmPath(),
      expectedWasmBytes: WASM_IDENTITY.bytes,
      expectedWasmSha256: WASM_IDENTITY.sha256,
      storageKey: STORAGE_KEY,
      storageBytes: estimateStateBytes(this.state),
      schemaVersion: this.state.schemaVersion,
      algorithm: this.state.settings.algorithm,
      businessDate: day.businessDate,
      catalogSource: this.catalogSource(),
      menuVersion: this.catalog().menuVersion,
      logCount: day.logs.length,
      lockCount: day.windowLocks.length + day.itemLocks.length,
      soldOutCount: day.soldOut.length,
      envRows: hasWx() ? readEnvironmentRows() : [{ label: '环境', value: 'Node 测试宿主（非微信环境）' }],
    };
  }

  // -------------------------------------------------------------------------
  // 开发诊断 / 运维
  // -------------------------------------------------------------------------

  /** 显式加载 WASM（开发页/首屏预热用）：与业务调用共用 core-runtime 单例，重复调用安全。 */
  async ensureCoreLoaded(): Promise<{ ok: boolean; message: string }> {
    try {
      await ensureCoreRuntime();
      return { ok: true, message: 'WASM 核心已加载' };
    } catch (error: any) {
      return { ok: false, message: `WASM 加载失败：${describeError(error)}` };
    }
  }

  /**
   * ABI 探针：验证真实二进制可加载、导出符号可用、mp_alloc→写入→读回→mp_free 生命周期
   * 与结果块协议正常。返回原始探针文本，便于开发页复制比对；不做任何业务计算。
   */
  async probeAbi(): Promise<{ ok: boolean; message: string; rows: { label: string; value: string }[]; rawProbeText: string }> {
    try {
      await ensureCoreRuntime();
      const probe = runAbiProbe();
      return {
        ok: true,
        message: 'ABI 探针完成：加载、导出、生命周期与结果块协议正常',
        rawProbeText: probe.resultBlockProbeText,
        rows: [
          { label: 'mp_api_version', value: String(probe.apiVersion) },
          { label: 'mp_contract_version', value: probe.contractVersion },
          { label: '线性内存（探针前 → 后，字节）', value: `${probe.memoryBytesBefore} → ${probe.memoryBytesAfter}` },
          { label: 'mp_alloc → 写入读回 → mp_free', value: `ptr=${probe.allocPtr}，读回${probe.allocWriteReadOk ? '一致' : '不一致'}` },
          { label: '结果块探针（validate-menu 传入 {}）', value: probe.resultBlockProbeText.slice(0, 160) },
        ],
      };
    } catch (error: any) {
      return { ok: false, message: `ABI 探针失败：${describeError(error)}`, rows: [], rawProbeText: '' };
    }
  }

  /**
   * 运行 T02 夹具（success/targetUnavailable/invalid/resourceLimited）：
   * 直接把夹具请求发给真实核心，返回状态与原始文本，用于开发页验证核心行为未被宿主影响。
   * 夹具请求是冻结数据，不读取也不修改当前用户状态。
   */
  async runFixture(key: 'success' | 'targetUnavailable' | 'invalid' | 'resourceLimited'): Promise<{ ok: boolean; message: string; status: string; durationMs: number; rawText: string }> {
    const fixture = (FIXTURE_CASES as any)[key];
    if (!fixture) {
      return { ok: false, message: `未知夹具 ${key}`, status: '', durationMs: 0, rawText: '' };
    }
    try {
      await ensureCoreRuntime();
      const start = Date.now();
      const rawText = callCore('plan', JSON.stringify(fixture.request));
      const durationMs = Date.now() - start;
      const envelope = JSON.parse(rawText);
      const status = envelope.ok === false ? (envelope.error ? envelope.error.code : 'ERROR') : envelope.result.status;
      return { ok: envelope.ok !== false, message: `夹具 ${key}：${status}（${durationMs} ms）`, status, durationMs, rawText };
    } catch (error: any) {
      return { ok: false, message: `夹具 ${key} 执行失败：${describeError(error)}`, status: 'ERROR', durationMs: 0, rawText: '' };
    }
  }

  /** 最近一次持久化的核心方案原始响应（开发页/证据脚本使用）；没有方案时返回 null。 */
  getLastPlanRaw(): string | null {
    this.ensureInitialized();
    const day = this.currentDay();
    return day.plan && day.plan.rawText ? day.plan.rawText : null;
  }

  /**
   * 开发页/真机计时：对同一份 Plan 请求重复调用真实 WASM。
   *  kind='core'   只计 mp_plan 入口函数自身耗时；
   *  kind='bridge' 计完整桥接：UTF-8 编解码 + 输入/结果块复制 + 两次释放。
   * 返回原始数组与 min/max/median/mean；调用方负责补页面端到端口径。
   */
  async measurePerformance(kind: 'core' | 'bridge', runs = 5): Promise<PerformanceSample> {
    this.ensureInitialized();
    const requestText = this.lastPlanRequestText || JSON.stringify(FIXTURE_CASES.success.request);
    await ensureCoreRuntime();
    const raw: number[] = [];
    for (let i = 0; i < runs; i += 1) {
      const timed = measureCoreCall('plan', requestText, nowMs);
      raw.push(kind === 'core' ? timed.coreMs : timed.totalMs);
    }
    const sorted = raw.slice().sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const median = sorted[Math.floor(sorted.length / 2)];
    const mean = raw.reduce((sum, value) => sum + value, 0) / raw.length;
    const label = kind === 'core' ? 'WASM 核心-only' : '桥接+复制/释放';
    return {
      kind,
      runs,
      raw,
      min,
      max,
      median,
      mean,
      message: `${label} ${runs} 次：median ${median.toFixed(3)} ms（min ${min.toFixed(3)} / max ${max.toFixed(3)}）`,
    };
  }

  /**
   * 最近一次真正发给核心的 PlanRequest 原文（含请求时的 state 快照）。
   * 关键用途：LockConflict 等前端拦截场景下，页面/测试能证明"没有调用核心"
   * （文本与拦截前完全一致）；没有任何请求时返回 null。
   */
  getLastPlanRequest(): string | null {
    return this.lastPlanRequestText || null;
  }

  /**
   * 清除本机数据（用户明确选择的恢复动作）。
   * 存储故障态下也允许清除：这是唯一能摆脱"故障态-禁止写入"死锁的入口。
   * 清除后内存状态重建为初始状态，并一并清空预检凭证/请求缓存，避免旧 token 残留。
   */
  resetLocalData(): ActionResult {
    if (this.storageFault) {
      // 存储故障时允许清除，这是用户明确选择的恢复动作。
      try {
        clearState();
      } catch (error: any) {
        return { ok: false, message: `清除本地数据失败：${describeError(error)}` };
      }
      this.storageFault = false;
      this.initMessage = '';
      this.state = createInitialState(this.now());
      this.initialized = true;
      return this.succeed('本地数据已清除');
    }
    try {
      clearState();
    } catch (error: any) {
      return { ok: false, message: `清除本地数据失败：${describeError(error)}` };
    }
    this.state = createInitialState(this.now());
    this.pendingMenu = null;
    this.pendingRestore = null;
    this.lastImport = null;
    this.lastPlanRequestText = '';
    this.lastAction = '本地数据已清除';
    return { ok: true, message: '本地数据已清除' };
  }

  /** 测试/诊断：当前状态引用（只读语义，调用方不要直接改）。 */
  peekState(): AppState {
    return this.state;
  }

  /** 测试：模拟进程退出时清空 WASM 实例（真实小程序由进程结束）。 */
  resetCoreForTest(): void {
    resetCore();
  }

  /** 营养配置摘要（开发页核对用）：证明当前宿主用的是冻结营养配置。 */
  nutritionConfigHash(): string {
    return NUTRITION_CONFIG_HASH;
  }
}

/**
 * 与 backup.ts 相同的稳定摘要口径（规范化序列化 + SHA-256）。
 * 用于恢复时核对"文件内容摘要"，因此必须在补"今天空桶"之前计算。
 */
function canonicalStateDigest(state: AppState): string {
  return canonicalSha256(state);
}

/** 日期显示：2026-10-20 → 2026年10月20日；异常格式原样返回，不抛错。 */
function formatDateLabel(date: string): string {  const parts = date.split('-');
  if (parts.length !== 3) return date;
  return `${Number(parts[0])}年${Number(parts[1])}月${Number(parts[2])}日`;
}

/** 星期显示：用于首页"今天周几"提示，与业务日期分开（业务日期已含时区偏移）。 */
function weekdayLabel(now: Date): string {
  const names = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];
  return names[now.getDay()];
}

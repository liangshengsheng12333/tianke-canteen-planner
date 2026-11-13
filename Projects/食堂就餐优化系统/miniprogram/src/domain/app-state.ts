/**
 * app-state.ts — 本地状态结构、校验、加载/保存与跨日切换。
 *
 * 存储策略：整个 AppState 存在一个版本化键里，写入是“先构造完整新对象、校验、
 * 再一次 setStorageSync”。任一环节失败都不改动内存中的当前状态，从而保证
 * 菜单替换/导入恢复等操作不会破坏已有数据。历史按业务日期分桶，跨日不迁移。
 */

import type { AppState, DayRecord, Meal, ProfileDraft, CatalogMeta, BackupMeta } from './types';
import { DEFAULT_ALGORITHM, MEALS, SUPPORTED_ALGORITHMS, isSupportedAlgorithm } from './types';
import { getWx, localBusinessDate, localTzOffsetMinutes, readStorage, removeStorage, writeStorage } from '../utils/wx-runtime';
import { hasWx } from '../utils/wx-runtime';

// 键后缀与状态内 schemaVersion 是两道路径的版本门槛：键被改名、或字段不兼容，都要显式处理。
export const STORAGE_KEY = 'tiankeshike:state:v1';
export const STATE_SCHEMA_VERSION = 1;
/**
 * 保留最近 62 个业务日期，至少容纳当前自然月＋前一个完整自然月（两月最多 31+31=62 天），
 * 月历回看与“本月已记 N 天”月汇总在整月范围内都成立；更早的记录不再进入本地状态，
 * 导出也只包含当前保留范围。清理由 ensureDay 按业务日期字符串排序删除，不按写入时间。
 * 原始计划大响应的回收不受此影响：KEEP_PLAN_RAW_DAYS=3 仍单独控制 plan.rawText。
 */
export const MAX_KEPT_DAYS = 62;
// 计划 rawText 是单键里最大的字段；超过 3 天只清空原文，保留 requestId 等诊断信息。
export const KEEP_PLAN_RAW_DAYS = 3;

/**
 * 加载结果。ok=false 表示读到的东西不可用（宿主异常或结构损坏），但 state 一定是可启动的
 * 新状态；recoveredFromCorruption=true 才说明“旧数据确实坏了”，用于提示而不是自动覆盖。
 */
export interface LoadResult {
  ok: boolean;
  message: string;
  state: AppState;
  recoveredFromCorruption: boolean;
}

// 内置真实菜单是默认来源（catalog=null 时生效，见 store.catalog）；示例菜单只在开发/演示导入后出现。
// importedAt/importedFileName 记录用户导入动作，不等于菜单数据的生产时间。
export function emptyCatalogMeta(): CatalogMeta {
  return { source: 'builtin', importedAt: null, importedFileName: null };
}

// 仅服务“菜单与备份”页展示；该块本身也参与状态整体摘要，因此导出后写回元数据会改变摘要。
export function emptyBackupMeta(): BackupMeta {
  return {
    lastExportedAt: null,
    lastExportedDigest: null,
    lastRestoredAt: null,
    lastRestoredDigest: null,
    lastFilePath: null,
    lastMessage: '',
  };
}

// 新业务日期一律建空桶：摄入/锁定/售罄/计划都不迁移；tzOffsetMinutes 记录当时的本地偏移。
export function createDayRecord(businessDate: string, tzOffsetMinutes: number): DayRecord {
  return {
    businessDate,
    tzOffsetMinutes,
    soldOut: [],
    windowLocks: [],
    itemLocks: [],
    endedMeals: [],
    logs: [],
    plan: null,
    selectedPlanIndex: 0,
  };
}

// budgetCents 的 null 是“未设置”，0 是“零预算”，语义不同；algorithm 默认 greedy，可选值受 SUPPORTED_ALGORITHMS 约束。
export function defaultSettings(): AppState['settings'] {
  return {
    budgetCents: null,
    algorithm: DEFAULT_ALGORITHM,
    strategies: ['primary', 'economy', 'taste'],
    maxItemsPerMeal: 3,
    limits: null,
  };
}

// 初次使用与损坏降级共用此构造器；activeDate 必须有对应日期桶，这是 validateState 的硬约束。
export function createInitialState(now: Date): AppState {
  const date = localBusinessDate(now);
  const tz = localTzOffsetMinutes(now);
  return {
    schemaVersion: STATE_SCHEMA_VERSION,
    profileId: null,
    profileRevision: 0,
    profileDraft: null,
    catalog: null,
    catalogMeta: emptyCatalogMeta(),
    settings: defaultSettings(),
    activeDate: date,
    days: { [date]: createDayRecord(date, tz) },
    target: null,
    backup: emptyBackupMeta(),
  };
}

// 数组也是 object，必须显式排除，否则 [] 会被当成合法的状态对象。
function isPlainObject(value: any): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// 枚举白名单：防止任意字符串进入 endedMeals，让“该餐已结束”的判断失真。
function isMealList(value: any): boolean {
  return Array.isArray(value) && value.every((item) => MEALS.indexOf(item) >= 0);
}

/**
 * 校验从存储读出的状态。只检查恢复所需的结构不变量，不重复深层业务校验。
 * 顺序固定为 版本 → 关键字段 → 每日桶结构；业务一致性（锁定/售罄是否仍指向现存报价）
 * 由读取方再跑 validateLocks，这里不越权。schemaVersion 要求严格相等、不做自动迁移：
 * 旧结构宁可拒绝恢复，也不半兼容地写入。
 */
export function validateState(value: any): { ok: boolean; message: string } {
  if (!isPlainObject(value)) {
    return { ok: false, message: '本地状态不是对象' };
  }
  if (value.schemaVersion !== STATE_SCHEMA_VERSION) {
    return { ok: false, message: `本地状态版本 ${String(value.schemaVersion)} 与当前 ${STATE_SCHEMA_VERSION} 不匹配` };
  }
  if (typeof value.activeDate !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value.activeDate)) {
    return { ok: false, message: 'activeDate 缺失或格式非法' };
  }
  if (!isPlainObject(value.days) || !isPlainObject(value.days[value.activeDate])) {
    return { ok: false, message: '缺少当前业务日期的记录桶' };
  }
  if (value.profileDraft !== null && !isPlainObject(value.profileDraft)) {
    return { ok: false, message: 'profileDraft 结构非法' };
  }
  if (typeof value.profileRevision !== 'number' || value.profileRevision < 0) {
    return { ok: false, message: 'profileRevision 非法' };
  }
  if (!isPlainObject(value.settings)) {
    return { ok: false, message: 'settings 缺失' };
  }
  if (!isSupportedAlgorithm(value.settings.algorithm)) {
    return {
      ok: false,
      message: `settings.algorithm 只能是 ${SUPPORTED_ALGORITHMS.join(' / ')}，实际 ${String(value.settings.algorithm)}`,
    };
  }
  if (typeof value.settings.maxItemsPerMeal !== 'number') {
    return { ok: false, message: 'settings.maxItemsPerMeal 非法' };
  }
  if (value.catalog !== null && !isPlainObject(value.catalog)) {
    return { ok: false, message: 'catalog 结构非法' };
  }
  if (!isPlainObject(value.catalogMeta)) {
    return { ok: false, message: 'catalogMeta 缺失' };
  }
  for (const date of Object.keys(value.days)) {
    const day = value.days[date];
    if (!isPlainObject(day) || day.businessDate !== date) {
      return { ok: false, message: `日期桶 ${date} 结构非法` };
    }
    if (!Array.isArray(day.logs) || !Array.isArray(day.soldOut) || !Array.isArray(day.windowLocks) || !Array.isArray(day.itemLocks)) {
      return { ok: false, message: `日期桶 ${date} 缺少状态数组` };
    }
    if (!isMealList(day.endedMeals)) {
      return { ok: false, message: `日期桶 ${date} endedMeals 非法` };
    }
  }
  if (value.target !== null && !isPlainObject(value.target)) {
    return { ok: false, message: 'target 缓存结构非法' };
  }
  return { ok: true, message: '' };
}

/**
 * 读取本地状态。损坏时返回初始状态并保留错误信息，由页面/开发页提示用户，
 * 不静默把坏数据当成空数据继续写入。
 * 读取失败分两类：宿主 API 异常时 recoveredFromCorruption=false（还没读到内容），
 * JSON/结构损坏时 true（旧数据确实坏了）。两者都返回可启动的初始状态，
 * 但 ok=false 会让 store 进入写入保护态，避免用空状态覆盖可能还能人工恢复的坏数据。
 */
export function loadState(now: Date): LoadResult {
  let raw: string | null;
  try {
    raw = readStorage(STORAGE_KEY);
  } catch (error: any) {
    return {
      ok: false,
      message: `读取本地存储失败：${error && error.message ? error.message : String(error)}`,
      state: createInitialState(now),
      recoveredFromCorruption: false,
    };
  }
  if (raw === null || raw === '') {
    return { ok: true, message: '首次使用，已创建本地数据', state: createInitialState(now), recoveredFromCorruption: false };
  }
  let parsed: any;
  try {
    parsed = JSON.parse(raw);
  } catch (error: any) {
    return {
      ok: false,
      message: `本地存储不是合法 JSON：${error && error.message ? error.message : String(error)}`,
      state: createInitialState(now),
      recoveredFromCorruption: true,
    };
  }
  const validation = validateState(parsed);
  if (!validation.ok) {
    return {
      ok: false,
      message: `本地存储结构校验失败：${validation.message}`,
      state: createInitialState(now),
      recoveredFromCorruption: true,
    };
  }
  // 兼容字段：早期版本没有 backup 块时补空值，不改变已有业务数据。
  if (!isPlainObject(parsed.backup)) {
    parsed.backup = emptyBackupMeta();
  }
  return { ok: true, message: '已恢复本地数据', state: parsed as AppState, recoveredFromCorruption: false };
}

/**
 * 保存状态；写入失败时抛出，调用方保留原内存状态。
 * 整个对象一次序列化、一次写入，不做字段级增量：用写入成本换“存储里不存在半新半旧状态”。
 * 返回值是文本长度，只用于开发页占用估算，不等于宿主实际占用的字节数。
 */
export function saveState(state: AppState): number {
  const text = JSON.stringify(state);
  writeStorage(STORAGE_KEY, text);
  return text.length;
}

// 仅开发页重置或致命故障时使用；清空后 loadState 会把下次启动当作首次使用。
export function clearState(): void {
  removeStorage(STORAGE_KEY);
}

// 内存级补桶，供提交前取“当前业务日”；真正落盘由调用方 commit/ensureDay 统一完成。
export function todayState(state: AppState, now: Date): DayRecord {
  const date = localBusinessDate(now);
  const day = state.days[date];
  if (day) {
    return day;
  }
  const created = createDayRecord(date, localTzOffsetMinutes(now));
  state.days[date] = created;
  return created;
}

/**
 * 跨日检查：为新的业务日期创建空桶（不迁移昨天摄入/锁定/售罄），
 * 清理过期日期；返回是否发生了跨日。
 * 本函数只增删桶、裁剪旧计划原文，不改已有桶的业务内容，因此启动/回到前台可反复调用；
 * 清理按业务日期字符串排序（YYYY-MM-DD 可字典序比较），不受设备时区变化影响。
 */
export function ensureDay(state: AppState, now: Date): boolean {
  const date = localBusinessDate(now);
  const tz = localTzOffsetMinutes(now);
  let rolled = false;
  if (!state.days[date]) {
    state.days[date] = createDayRecord(date, tz);
    rolled = true;
  }
  if (state.activeDate !== date) {
    state.activeDate = date;
    rolled = true;
  }

  const dates = Object.keys(state.days).sort();
  const excess = dates.length - MAX_KEPT_DAYS;
  for (let i = 0; i < excess; i += 1) {
    delete state.days[dates[i]];
  }
  // 旧计划原文占用大，保留最近 3 天即可；历史摄入记录本身保留。
  const keepRawFrom = new Date(now.getTime() - KEEP_PLAN_RAW_DAYS * 24 * 3600 * 1000);
  for (const key of Object.keys(state.days)) {
    const day = state.days[key];
    if (key === date || !day.plan) {
      continue;
    }
    const created = Date.parse(day.plan.createdAt);
    if (!Number.isFinite(created) || created < keepRawFrom.getTime()) {
      day.plan = { ...day.plan, rawText: '' };
    }
  }
  return rolled;
}

/** 只读取得某业务日期；不存在返回 null（历史页不创建空桶）。 */
export function getDay(state: AppState, date: string): DayRecord | null {
  return state.days[date] || null;
}

// 只有 active 计入当前摄入；superseded/revoked 保留为审计历史但不再消费。
// meal 维度过滤、不判断日期：调用方传哪个 day，就按那天的记录算。
export function activeLogsForMeal(day: DayRecord, meal: Meal) {
  return day.logs.filter((log) => log.meal === meal && log.status === 'active');
}

// 规划跳过已确认餐次的判断依据；与“已结束”是两种独立状态。
export function hasActiveLog(day: DayRecord, meal: Meal): boolean {
  return day.logs.some((log) => log.meal === meal && log.status === 'active');
}

// 结束不等于“已吃”：不虚构摄入；重开只是把该餐从 endedMeals 移除，状态可逆。
export function isMealEnded(day: DayRecord, meal: Meal): boolean {
  return day.endedMeals.indexOf(meal) >= 0;
}

// 供开发页展示存储占用；不改变数据。序列化是 O(n)，只用于诊断，不放进渲染热路径。
export function estimateStateBytes(state: AppState): number {
  try {
    return JSON.stringify(state).length;
  } catch (_e) {
    return -1;
  }
}

// 页面据此禁用依赖宿主的能力；这里只探测 wx 是否存在，不保证具体 API 齐全。
export function currentWxAvailable(): boolean {
  return hasWx();
}

// 微信 getStorageSync 对不存在的键返回空串，因此空串与缺失都按“不存在”处理；
// 宿主异常也返回 false，避免页面因为探测本身而崩溃。
export function storageKeyExists(): boolean {
  try {
    return getWx().getStorageSync(STORAGE_KEY) !== '';
  } catch (_e) {
    return false;
  }
}

// 保留“无草稿”的统一入口，当前返回 null 表示由 createDefaultProfileDraft 作为表单起点。
export function defaultProfileDraftPlaceholder(): ProfileDraft | null {
  return null;
}

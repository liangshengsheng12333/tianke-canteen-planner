/**
 * backup.ts — 本地导出/恢复的格式、摘要与逐项对照。
 *
 * 导出由用户主动触发；恢复前校验格式/版本/完整性/引用，确认后原子应用。
 * 摘要是对 state 的规范化序列化算 SHA-256（稳定摘要），恢复后再次计算并与
 * 导出的摘要比较，同时逐项比对关键行/状态/快照，不用“文件存在”冒充恢复成功。
 */

import type { AppState } from './types';
import { validateState, STATE_SCHEMA_VERSION } from './app-state';
import { canonicalSha256 } from '../utils/canonical-json';

// format 是“这份文件是不是本应用备份”的第一道门：别的产品导出的 JSON 不能被误吞进恢复流程。
export const BACKUP_FORMAT = 'tiankeshike-backup';
// bundleVersion 描述包络格式，state.schemaVersion 描述内部状态结构；两者独立演进，必须分别校验。
export const BACKUP_VERSION = 1;
// appVersion 仅用于溯源与排查，不参与“能否恢复”的判定。
export const APP_VERSION = 't05-v1';

/**
 * 备份包络。digest 只对 state 内容做规范化摘要；exportedAt/appVersion 是溯源信息，
 * 改动它们不改变 digest，因此不能用“包络看起来对”代替完整性校验。
 */
export interface BackupBundle {
  format: typeof BACKUP_FORMAT;
  bundleVersion: number;
  appVersion: string;
  exportedAt: string;
  state: AppState;
  digest: string;
}

/**
 * 解析结果。errors 提供字段级原因给页面逐项显示；digest 在格式正确但状态/摘要
 * 校验失败时仍回填文件声明值，便于用户核对，而不是只看到一句“失败”。
 */
export interface ParsedBackup {
  ok: boolean;
  message: string;
  errors: { field: string; message: string }[];
  bundle: BackupBundle | null;
  digest: string | null;
}

// equal 必须来自逐字段实际比较；页面按它显示“一致/不同”，不得把“文件已读取”当成一致。
export interface ComparisonRow {
  label: string;
  before: string;
  after: string;
  equal: boolean;
}

// 摘要在规范化序列化上计算（键序稳定、只接受安全整数），而不是 JSON.stringify 的字段顺序，
// 因此同一状态在不同端/不同写入路径下得到同一摘要。state 内含 backup 元数据，
// 导出后写回“最近导出时间”会改变下一次摘要，这是预期变化。
export function backupDigest(state: AppState): string {
  return canonicalSha256(state);
}

// 导出内容边界：只含本地 AppState（档案草稿/设置/当日状态/计划原文），不含 WASM、
// 设备信息或任何账号凭据；摘要构造时一次算好，序列化阶段不再改动 state。
export function buildBackupBundle(state: AppState, now: Date): BackupBundle {
  const digest = backupDigest(state);
  return {
    format: BACKUP_FORMAT,
    bundleVersion: BACKUP_VERSION,
    appVersion: APP_VERSION,
    exportedAt: now.toISOString(),
    state,
    digest,
  };
}

// 包络用 JSON.stringify 传输；校验用的 digest 仍由规范化 state 计算，两种序列化差异不影响校验。
export function serializeBackup(state: AppState, now: Date): { text: string; digest: string; bundle: BackupBundle } {
  const bundle = buildBackupBundle(state, now);
  return { text: JSON.stringify(bundle), digest: bundle.digest, bundle };
}

// 数组不算对象：防止 [] 被当作合法包络继续往后解析。
function isObject(value: any): boolean {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/**
 * 解析并校验导入文本；全部通过才返回可应用状态。
 * 校验顺序固定：空文本 → JSON → 顶层对象 → format → bundleVersion → digest 形态
 * → state 结构 → 摘要复算 → state 版本。前一步失败立即返回，避免错误归因混在一起。
 * 任何失败都不返回 bundle；调用方不得自行取 parsed.state 绕过校验。
 */
export function parseBackupText(text: string): ParsedBackup {
  if (typeof text !== 'string' || text.trim() === '') {
    return { ok: false, message: '恢复内容为空', errors: [{ field: 'text', message: '请粘贴或选择导出文件' }], bundle: null, digest: null };
  }
  let parsed: any;
  try {
    parsed = JSON.parse(text);
  } catch (error: any) {
    return {
      ok: false,
      message: `恢复文件不是合法 JSON：${error && error.message ? error.message : String(error)}`,
      errors: [{ field: 'text', message: 'JSON 解析失败' }],
      bundle: null,
      digest: null,
    };
  }
  if (!isObject(parsed)) {
    return { ok: false, message: '恢复文件顶层不是对象', errors: [{ field: 'root', message: '顶层类型非法' }], bundle: null, digest: null };
  }
  if (parsed.format !== BACKUP_FORMAT) {
    return {
      ok: false,
      message: `不是天科食客备份文件（format=${String(parsed.format)}）`,
      errors: [{ field: 'format', message: '备份格式标识不匹配' }],
      bundle: null,
      digest: null,
    };
  }
  if (parsed.bundleVersion !== BACKUP_VERSION) {
    return {
      ok: false,
      message: `备份版本 ${String(parsed.bundleVersion)} 与当前 ${BACKUP_VERSION} 不兼容`,
      errors: [{ field: 'bundleVersion', message: '版本不匹配' }],
      bundle: null,
      digest: null,
    };
  }
  // 先检查摘要形态再复算：非法字符串不能当比对基准，也避免把格式错误报成“内容被篡改”。
  if (typeof parsed.digest !== 'string' || !/^sha256:[0-9a-f]{64}$/.test(parsed.digest)) {
    return { ok: false, message: '备份缺少合法摘要（sha256:<64 hex>）', errors: [{ field: 'digest', message: '摘要格式非法' }], bundle: null, digest: null };
  }
  // 先结构后摘要：结构不合法时复算摘要没有意义，错误信息也更容易定位。
  const stateValidation = validateState(parsed.state);
  if (!stateValidation.ok) {
    return {
      ok: false,
      message: `备份内状态校验失败：${stateValidation.message}`,
      errors: [{ field: 'state', message: stateValidation.message }],
      bundle: null,
      digest: parsed.digest,
    };
  }
  const recomputed = backupDigest(parsed.state);
  if (recomputed !== parsed.digest) {
    return {
      ok: false,
      message: '备份摘要不一致：文件内容可能被修改或损坏，已拒绝恢复',
      errors: [{ field: 'digest', message: `期望 ${parsed.digest}，复算 ${recomputed}` }],
      bundle: null,
      digest: parsed.digest,
    };
  }
  // validateState 已查过版本；这里再查一次，防御包络与 state 的版本字段被分别改写的情况。
  if (parsed.state.schemaVersion !== STATE_SCHEMA_VERSION) {
    return { ok: false, message: `备份状态版本 ${parsed.state.schemaVersion} 不匹配`, errors: [{ field: 'state.schemaVersion', message: '版本不匹配' }], bundle: null, digest: parsed.digest };
  }
  return {
    ok: true,
    message: '备份格式、版本、摘要与状态结构校验通过',
    errors: [],
    bundle: parsed as BackupBundle,
    digest: parsed.digest,
  };
}

// 只统计当前业务日，作为对照表的轻量指纹；数字取自状态本身而非页面视图，
// 避免 UI 缓存/格式化影响“是否一致”的结论。
function stateSummary(state: AppState, date: string): { logs: number; activeLogs: number; locks: number; soldOut: number; planRequestId: string } {
  const day = state.days[date];
  if (!day) {
    return { logs: 0, activeLogs: 0, locks: 0, soldOut: 0, planRequestId: '—' };
  }
  return {
    logs: day.logs.length,
    activeLogs: day.logs.filter((log) => log.status === 'active').length,
    locks: day.windowLocks.length + day.itemLocks.length,
    soldOut: day.soldOut.length,
    // 计划只取 requestId 作指纹：rawText 可能因跨日裁剪被清空，拿原文比较会误报不一致。
    planRequestId: day.plan ? day.plan.requestId : '—',
  };
}

/**
 * 恢复前后逐项对照。比较的是导出前状态（当前）与恢复后状态；业务日期取当前状态
 * 的 activeDate，导出文件里的 activeDate 会随状态一起恢复。
 * 返回行顺序是契约：前 7 行业务数据 + 第 8 行状态整体摘要，store 恢复流程按序 slice/追加；
 * 调整顺序或用页面视图代替会破坏对照含义。equal=false 是“被覆盖”的预期结果，不是恢复失败。
 */
export function compareStates(before: AppState, after: AppState): ComparisonRow[] {
  const date = before.activeDate;
  const beforeSummary = stateSummary(before, date);
  const afterSummary = stateSummary(after, date);
  const rows: ComparisonRow[] = [
    {
      label: '业务日期',
      before: before.activeDate,
      after: after.activeDate,
      equal: before.activeDate === after.activeDate,
    },
    {
      label: '档案 revision',
      before: String(before.profileRevision),
      after: String(after.profileRevision),
      equal: before.profileRevision === after.profileRevision,
    },
    {
      label: '档案内容摘要',
      before: before.profileDraft ? canonicalSha256(before.profileDraft) : '无档案',
      after: after.profileDraft ? canonicalSha256(after.profileDraft) : '无档案',
      equal: (before.profileDraft ? canonicalSha256(before.profileDraft) : '') === (after.profileDraft ? canonicalSha256(after.profileDraft) : ''),
    },
    {
      label: '菜单版本',
      before: before.catalog ? before.catalog.menuVersion : '内置菜单',
      after: after.catalog ? after.catalog.menuVersion : '内置菜单',
      equal: (before.catalog ? before.catalog.menuVersion : '内置菜单') === (after.catalog ? after.catalog.menuVersion : '内置菜单'),
    },
    {
      label: '当日日志条数 / 有效',
      before: `${beforeSummary.logs} / ${beforeSummary.activeLogs}`,
      after: `${afterSummary.logs} / ${afterSummary.activeLogs}`,
      equal: beforeSummary.logs === afterSummary.logs && beforeSummary.activeLogs === afterSummary.activeLogs,
    },
    {
      label: '锁定 / 售罄条数',
      before: `${beforeSummary.locks} / ${beforeSummary.soldOut}`,
      after: `${afterSummary.locks} / ${afterSummary.soldOut}`,
      equal: beforeSummary.locks === afterSummary.locks && beforeSummary.soldOut === afterSummary.soldOut,
    },
    {
      label: '计划 requestId',
      before: beforeSummary.planRequestId,
      after: afterSummary.planRequestId,
      equal: beforeSummary.planRequestId === afterSummary.planRequestId,
    },
    {
      label: '状态整体摘要',
      before: backupDigest(before),
      after: backupDigest(after),
      equal: backupDigest(before) === backupDigest(after),
    },
  ];
  return rows;
}

// 只读摘要、不做校验：能否恢复由 parseBackupText 决定，这里显示得再完整也不能当“已验证”。
// 取数口径与恢复后对照表一致（当前 activeDate），避免两处展示互相矛盾。
export function summarizeBackup(state: AppState): string {
  const date = state.activeDate;
  const summary = stateSummary(state, date);
  return (
    `业务日期 ${date}；档案 revision ${state.profileRevision}；` +
    `菜单 ${state.catalog ? state.catalog.menuVersion : '内置菜单'}；` +
    `当日日志 ${summary.logs} 条（有效 ${summary.activeLogs}）；锁定 ${summary.locks} 条；售罄 ${summary.soldOut} 条`
  );
}

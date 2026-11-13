/**
 * utils/display-mode.ts — 显示模式（简易 / 完整）的唯一读写入口（T05U02）。
 *
 * 边界：
 * - 只保存用户对“营养信息多少”的选择，单独存放在 UI 设置键，不写入档案、记餐、菜单、计划或营养数据；
 * - 与 utils/appearance.ts 的浅色/深色/跟随系统完全独立：两个键互不读写，切换一个不影响另一个；
 * - 切换显示模式不触发重新规划、不写记录、不清空输入、不改变当前餐次/日期；
 * - 保存必须回读校验：写失败或回读不一致都返回 false，由调用方回滚选中态并提示。
 *
 * 本模块不做展示计算：营养区数值文案由 utils/nutrition-display.ts 提供，页面只负责绑定。
 */

/** 用户可选的显示模式。 */
export type DisplayMode = 'simple' | 'full';

/** 显示模式的本地存储键。升级键名需同时迁移旧值，否则用户选择会丢失。 */
export const DISPLAY_MODE_STORAGE_KEY = 'tk.ui.displayMode.v1';
/** 无有效设置（新装/旧版本）时的默认模式：简易。 */
export const DEFAULT_DISPLAY_MODE: DisplayMode = 'simple';

/** 两项显示模式；label/desc 供今日页胶囊与后续“我的→显示与外观”使用，顺序固定简易→完整。 */
export const DISPLAY_MODE_OPTIONS: Array<{ value: DisplayMode; label: string; desc: string }> = [
  { value: 'simple', label: '简易', desc: '先看这顿怎么吃' },
  { value: 'full', label: '完整', desc: '多看营养数值' },
];

/** 把任意值收窄为合法模式；不合法返回 null（调用方使用默认值，不猜测用户意图）。 */
export function normalizeDisplayMode(value: unknown): DisplayMode | null {
  if (value === 'simple' || value === 'full') {
    return value;
  }
  return null;
}

/** 读取原始存储值；读取异常不抛出，返回 ok=false 由调用方按默认值处理。 */
function readStoredMode(): { value: unknown; ok: boolean } {
  try {
    return { value: wx.getStorageSync(DISPLAY_MODE_STORAGE_KEY), ok: true };
  } catch (error) {
    // 读取失败（存储不可用/损坏）按默认简易继续，不因偏好读取失败阻断页面。
    console.warn('显示模式读取失败，暂用默认简易：', error);
    return { value: '', ok: false };
  }
}

/** 已保存的模式；无值或值不合法时返回默认简易（旧版本没有该设置时的行为）。 */
export function loadDisplayMode(): DisplayMode {
  return normalizeDisplayMode(readStoredMode().value) || DEFAULT_DISPLAY_MODE;
}

/**
 * 保存模式。先写入再回读，只有回读一致才算成功；任何异常返回 false 且不改动已保存值。
 * 调用方必须在 false 时保持旧选中态并提示“设置没保存，请重试”。
 */
export function saveDisplayMode(mode: DisplayMode): boolean {
  const normalized = normalizeDisplayMode(mode);
  if (!normalized) {
    return false;
  }
  try {
    wx.setStorageSync(DISPLAY_MODE_STORAGE_KEY, normalized);
  } catch (error) {
    console.warn('显示模式写入失败：', error);
    return false;
  }
  const stored = readStoredMode();
  return stored.ok && normalizeDisplayMode(stored.value) === normalized;
}

/** 模式 → 中文名，用于今日页胶囊与设置摘要。 */
export function displayModeLabel(mode: DisplayMode): string {
  const option = DISPLAY_MODE_OPTIONS.find((entry) => entry.value === mode);
  return option ? option.label : DISPLAY_MODE_OPTIONS[0].label;
}

/** 模式 → 切换后的另一项（胶囊只做简易⇄完整两态切换）。 */
export function otherDisplayMode(mode: DisplayMode): DisplayMode {
  return mode === 'full' ? 'simple' : 'full';
}

/**
 * 按当前时间给出首次进入的餐次提示。只返回“建议查看哪一餐”，
 * 不确认/结束/补记任何一餐，也不写任何业务状态。
 * 边界取常见三餐时段：10:00 前早餐、10:00–15:00 午餐、其余晚餐。
 */
export function suggestedMealByTime(hour: number): 'breakfast' | 'lunch' | 'dinner' {
  if (hour < 10) {
    return 'breakfast';
  }
  if (hour < 15) {
    return 'lunch';
  }
  return 'dinner';
}
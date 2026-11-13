/**
 * utils/appearance.ts — 界面外观（浅色 / 深色 / 跟随系统）的唯一读写与解析入口。
 *
 * 边界（对应 T05U01 卡片）：
 * - 只保存用户的外观选择，单独存放在 UI 设置键，不写入档案、记餐、菜单、计划或营养数据；
 * - 切换外观不触发重新规划、不写业务数据、不改变显示模式或页面业务状态；
 * - 读不到系统主题或读取失败时按浅色呈现，但保留已保存的“跟随系统”选择，
 *   绝不把解析后的浅/深色写回存储（否则用户选项会被悄悄覆盖）；
 * - 保存必须回读校验：写失败或回读不一致都返回 false，由调用方回滚并提示。
 *
 * 外观状态只保存在本模块内（冷启动时同步解析），页面通过 pageThemeData() 取 class，
 * 通过 refreshAppearance() 触发可见页面刷新；不建立第二份页面级外观状态。
 */

/** 用户可选的外观偏好。 */
export type AppearancePreference = 'light' | 'dark' | 'system';
/** 解析后的实际外观，只可能是浅色或深色。 */
export type ResolvedTheme = 'light' | 'dark';

/** 外观偏好的本地存储键。升级键名需同时迁移旧值，否则用户选择会丢失。 */
export const APPEARANCE_STORAGE_KEY = 'tk.ui.appearance.v1';
/** 无有效设置（新装/旧版本）时的默认外观：浅色。 */
export const DEFAULT_APPEARANCE: AppearancePreference = 'light';

/** 三项外观选项；label/desc 供设置文案使用，顺序固定为浅色→深色→跟随系统。 */
export const APPEARANCE_OPTIONS: Array<{ value: AppearancePreference; label: string; desc: string }> = [
  { value: 'light', label: '浅色', desc: '始终使用雾白浅色界面' },
  { value: 'dark', label: '深色', desc: '始终使用深灰深色界面' },
  { value: 'system', label: '跟随系统', desc: '随手机系统主题切换' },
];

/** 外观快照：偏好（用户选项）、解析结果（实际呈现）、系统主题是否可读。 */
export interface AppearanceSnapshot {
  preference: AppearancePreference;
  resolved: ResolvedTheme;
  /** 系统主题是否读到；false 时“跟随系统”会暂用浅色，文案需说明这一限制。 */
  systemReadable: boolean;
}

/** 把任意值收窄为合法偏好；不合法返回 null（调用方使用默认值，不猜测用户意图）。 */
export function normalizePreference(value: unknown): AppearancePreference | null {
  if (value === 'light' || value === 'dark' || value === 'system') {
    return value;
  }
  return null;
}

/** 读取原始存储值；读取异常不抛出，返回 ok=false 由调用方按默认值处理。 */
function readStoredPreference(): { value: unknown; ok: boolean } {
  try {
    return { value: wx.getStorageSync(APPEARANCE_STORAGE_KEY), ok: true };
  } catch (error) {
    // 读取失败（存储不可用/损坏）按默认外观继续，不能因偏好读取失败阻断启动。
    console.warn('外观偏好读取失败，暂用默认浅色：', error);
    return { value: '', ok: false };
  }
}

/** 已保存的偏好；无值或值不合法时返回默认浅色（旧版本没有该设置时的行为）。 */
export function loadPreference(): AppearancePreference {
  const stored = readStoredPreference();
  return normalizePreference(stored.value) || DEFAULT_APPEARANCE;
}

/**
 * 保存偏好。先写入再回读，只有回读一致才算成功；任何异常返回 false 且不改动已保存值。
 * 调用方必须在 false 时回滚界面选中态并提示“设置没保存，请重试”。
 */
export function savePreference(preference: AppearancePreference): boolean {
  try {
    wx.setStorageSync(APPEARANCE_STORAGE_KEY, preference);
  } catch (error) {
    console.warn('外观偏好写入失败：', error);
    return false;
  }
  const stored = readStoredPreference();
  return stored.ok && normalizePreference(stored.value) === preference;
}

/**
 * 读取当前系统主题。优先用基础库的 getAppBaseInfo().theme，其次 getSystemInfoSync().theme；
 * 接口不存在、返回非 light/dark 或调用抛错时返回 null（调用方暂用浅色）。
 */
export function readSystemTheme(): ResolvedTheme | null {
  try {
    const appBase = typeof wx.getAppBaseInfo === 'function' ? wx.getAppBaseInfo() : null;
    const appBaseTheme = appBase ? appBase.theme : null;
    if (appBaseTheme === 'light' || appBaseTheme === 'dark') {
      return appBaseTheme;
    }
  } catch (error) {
    // 新接口不可用时继续尝试旧接口，不因一次调用失败当成“系统就是浅色”。
  }
  try {
    const info = typeof wx.getSystemInfoSync === 'function' ? wx.getSystemInfoSync() : null;
    const theme = info ? info.theme : null;
    if (theme === 'light' || theme === 'dark') {
      return theme;
    }
  } catch (error) {
    // 两者都不可读：返回 null，由上层保持用户选择并暂用浅色。
  }
  return null;
}

/** 由用户偏好解析实际外观；“跟随系统”读不到系统主题时暂用浅色。 */
export function resolveTheme(preference: AppearancePreference): ResolvedTheme {
  if (preference === 'light' || preference === 'dark') {
    return preference;
  }
  return readSystemTheme() || 'light';
}

/** 解析后的主题 → 页面根节点的 class（与 app.wxss 中的令牌类一一对应）。 */
export function themeClass(theme: ResolvedTheme): string {
  return theme === 'dark' ? 'tk-dark' : 'tk-light';
}

/** 偏好 → 中文名，用于设置入口的当前值摘要。 */
export function appearanceLabel(preference: AppearancePreference): string {
  const option = APPEARANCE_OPTIONS.find((entry) => entry.value === preference);
  return option ? option.label : APPEARANCE_OPTIONS[0].label;
}

// 当前外观快照。模块求值发生在 App()/Page() 之前，此时同步读存储即可确定首帧外观。
let current: AppearanceSnapshot = buildSnapshot();

function buildSnapshot(preference: AppearancePreference = loadPreference()): AppearanceSnapshot {
  const systemTheme = preference === 'system' ? readSystemTheme() : null;
  return {
    preference,
    resolved: preference === 'system' ? systemTheme || 'light' : preference,
    systemReadable: preference === 'system' ? systemTheme !== null : false,
  };
}

/** 当前外观快照（只读）。页面不得自行缓存第二份偏好。 */
export function getAppearance(): AppearanceSnapshot {
  return current;
}

/** 外观快照对应的页面数据（WXML 根节点写 class="page {{themeClass}}"）。 */
export function pageThemeData(): { themeClass: string; theme: ResolvedTheme } {
  return { themeClass: themeClass(current.resolved), theme: current.resolved };
}

/**
 * 页面 onShow 用：先按当前外观设置导航栏与窗口底色，再返回页面主题数据。
 * 微信的导航栏颜色是按页面生效的，新页面不会继承上一页的深浅色，
 * 因此每个页面显示时都要重新应用一次，否则深色下会出现浅色导航栏。
 */
export function applyPageAppearance(): { themeClass: string; theme: ResolvedTheme } {
  applyWindowTheme(current.resolved);
  return pageThemeData();
}

/** 导航栏与窗口底色：浅色白底黑字、深色深灰底白字，减少深色用户的整屏白闪。 */
function applyWindowTheme(theme: ResolvedTheme): void {
  const dark = theme === 'dark';
  const backgroundColor = dark ? '#111416' : '#f5f6f8';
  try {
    if (typeof wx.setNavigationBarColor === 'function') {
      wx.setNavigationBarColor({
        frontColor: dark ? '#ffffff' : '#000000',
        backgroundColor,
        animation: { duration: 160, timingFunc: 'easeInOut' },
      });
    }
  } catch (error) {
    // 导航栏能力不可用（例如部分基础库）不阻断页面，内容区主题仍然生效。
  }
  try {
    if (typeof wx.setBackgroundColor === 'function') {
      wx.setBackgroundColor({
        backgroundColor,
        backgroundColorTop: backgroundColor,
        backgroundColorBottom: backgroundColor,
      });
    }
  } catch (error) {
    // 窗口背景色为可选增强，失败只影响下拉回弹区域，不影响正文。
  }
}

/**
 * 通知可见页面重绘外观。页面自身不订阅事件，统一由本模块刷新：
 * 只更新 data 中带有 themeClass 的页面，避免触碰业务页面实例的其他字段。
 */
function notifyPages(): void {
  if (typeof getCurrentPages !== 'function') {
    return;
  }
  const klass = themeClass(current.resolved);
  for (const page of getCurrentPages()) {
    try {
      if (page && page.data && Object.prototype.hasOwnProperty.call(page.data, 'themeClass')) {
        page.setData({ themeClass: klass });
      }
    } catch (error) {
      // 页面正在卸载时 setData 可能失败，忽略即可；下次 onShow 会重新同步。
    }
  }
}

/**
 * 把当前快照同步到 App.globalData.appearance（若已存在 App 实例）。
 * 页面不依赖这份副本，它只是给“当前外观”提供一个全局只读入口；
 * 不更新的话，切换后 globalData 里会留下旧值，等于第二份过期状态。
 */
function publishToGlobal(): void {
  try {
    if (typeof getApp !== 'function') {
      return;
    }
    const app = getApp();
    if (app && app.globalData) {
      app.globalData.appearance = current;
    }
  } catch (error) {
    // App 尚未创建（模块初始化阶段）或测试桩无 getApp：忽略，页面仍以模块快照为准。
  }
}

/**
 * 重新解析并应用外观（冷启动、回到前台、系统主题变化时调用）。
 * 返回最新快照；解析结果没变也会重设一次导航栏，保证从后台返回时颜色一致。
 */
export function refreshAppearance(): AppearanceSnapshot {
  const next = buildSnapshot();
  const resolvedChanged = next.resolved !== current.resolved;
  current = next;
  applyWindowTheme(current.resolved);
  publishToGlobal();
  if (resolvedChanged) {
    notifyPages();
  }
  return current;
}

/**
 * 切换外观偏好：保存成功才更新内存状态并通知页面；失败保持旧状态并返回 false。
 * 保存失败时界面选中态必须保持旧值（调用方据此提示），不能先切后补。
 */
export function setAppearancePreference(preference: AppearancePreference): boolean {
  if (!savePreference(preference)) {
    return false;
  }
  const next = buildSnapshot(preference);
  const resolvedChanged = next.resolved !== current.resolved;
  current = next;
  applyWindowTheme(current.resolved);
  publishToGlobal();
  if (resolvedChanged) {
    notifyPages();
  }
  return true;
}

// 是否已注册系统主题监听，避免 onLaunch 多次触发时重复注册。
let themeListenerReady = false;

/**
 * 注册系统主题变化监听（仅“跟随系统”需要）。基础库不支持时静默跳过，
 * 此时动态跟随列为受限项，回到前台仍会通过 refreshAppearance() 同步一次。
 */
export function initAppearance(): void {
  if (themeListenerReady) {
    return;
  }
  themeListenerReady = true;
  try {
    if (typeof wx.onThemeChange === 'function') {
      wx.onThemeChange(() => {
        // 只有“跟随系统”才需要响应；浅色/深色固定值不受系统主题影响。
        if (current.preference === 'system') {
          refreshAppearance();
        }
      });
    }
  } catch (error) {
    console.warn('系统主题监听注册失败，动态跟随列为受限项：', error);
  }
}
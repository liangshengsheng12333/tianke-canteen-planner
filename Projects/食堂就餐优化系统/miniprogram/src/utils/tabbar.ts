/**
 * utils/tabbar.ts — 三个主入口（今日 / 记录 / 我的）共用底部导航的唯一实现（T05U02）。
 *
 * 边界：只负责“三个入口的顺序、文案、目标路由和切换动作”，不承载任何业务状态。
 * 三个页面使用同一份 MAIN_TABS 与同一段 WXML 结构（app.wxss 的 .tabbar），
 * 因此选中态、图标和点击行为不会各页一套。
 *
 * 用 wx.reLaunch 切换：清空页面栈，避免“今日→我的→今日→我的”无限叠栈；
 * 重复点击当前入口直接忽略。
 */

/** 底部导航入口顺序固定：今日 → 记录 → 我的。 */
export type MainTabKey = 'today' | 'logs' | 'profile';

export interface MainTab {
  key: MainTabKey;
  label: string;
  url: string;
  /** 图标 class（app.wxss 中 .icon-*），选中态由 currentColor 与底色共同表达。 */
  icon: string;
}

/** 顺序、文案与路由固定；新增主入口必须先改这里和 app.json pages。 */
export const MAIN_TABS: MainTab[] = [
  { key: 'today', label: '今日', url: '/pages/home/index', icon: 'icon-today' },
  { key: 'logs', label: '记录', url: '/pages/logs/index', icon: 'icon-logs' },
  { key: 'profile', label: '我的', url: '/pages/profile/index', icon: 'icon-profile' },
];

/** 点击底部入口：当前入口不重复跳转；失败给出可读提示，不静默吞掉。 */
export function gotoMainTab(key: string, current: string): void {
  const target = MAIN_TABS.find((entry) => entry.key === key);
  if (!target || target.key === current) {
    return;
  }
  wx.reLaunch({
    url: target.url,
    fail: (error: any) => {
      console.error('切换底部入口失败：', error);
      wx.showToast({ title: '打开页面失败，请重试', icon: 'none' });
    },
  });
}
/**
 * pages/appearance/index.ts — 显示与外观（本卡只做外观：浅色 / 深色 / 跟随系统）。
 *
 * 边界：偏好的读取、保存、回读校验、解析与页面刷新全部在 utils/appearance.ts；
 * 本页只负责三项展示、调用保存、以及保存失败时回滚选中态并提示。
 * 不改档案、记餐、菜单、计划或营养数据，也不实现“简易/完整”显示模式（留给后续卡）。
 */
import type { AppearancePreference } from '../../utils/appearance';
import {
  APPEARANCE_OPTIONS,
  appearanceLabel,
  applyPageAppearance,
  getAppearance,
  setAppearancePreference,
} from '../../utils/appearance';

/** 跟随系统时给用户的补充说明；读不到系统主题必须如实说明，不能宣称已经在跟随。 */
function systemNoteOf(preference: AppearancePreference, systemReadable: boolean): string {
  if (preference !== 'system') {
    return '';
  }
  if (!systemReadable) {
    return '当前环境读不到系统主题，暂按浅色显示；“跟随系统”的选择已保存，环境支持后按系统主题呈现。';
  }
  return '系统切换浅色/深色后界面会自动跟随；从后台返回时也会重新同步一次。';
}

Page({
  data: {
    options: APPEARANCE_OPTIONS,
    preference: 'light' as AppearancePreference,
    currentLabel: '浅色',
    // 跟随系统的补充说明（仅当选择“跟随系统”时非空）。
    systemNote: '',
    themeClass: 'tk-light',
    // 保存过程中禁用重复点按，避免连续两次写入产生竞态。
    saving: false,
  },

  // 每次显示都从模块快照重新同步：用户可能从别的入口回来，或系统主题已变化。
  onShow() {
    this.syncFromAppearance();
  },

  /** 把外观模块快照同步到页面绑定；不改存储，只读。 */
  syncFromAppearance() {
    const snapshot = getAppearance();
    this.setData({
      ...applyPageAppearance(),
      preference: snapshot.preference,
      currentLabel: appearanceLabel(snapshot.preference),
      systemNote: systemNoteOf(snapshot.preference, snapshot.systemReadable),
    });
  },

  /** 点选一项外观：保存成功才切换选中态；失败保留原选择并提示重试。 */
  onSelect(e: any) {
    if (this.data.saving) {
      return;
    }
    const value = String(e.currentTarget.dataset.value || '');
    if (value !== 'light' && value !== 'dark' && value !== 'system') {
      return;
    }
    if (value === this.data.preference) {
      return;
    }
    this.setData({ saving: true });
    const saved = setAppearancePreference(value);
    if (!saved) {
      // 保存失败：存储与内存都没变，重新同步回旧值，明确提示“没保存”，不显示为已保存。
      this.setData({ saving: false });
      this.syncFromAppearance();
      wx.showToast({ title: '设置没保存，请重试', icon: 'none' });
      return;
    }
    this.setData({ saving: false });
    this.syncFromAppearance();
    wx.showToast({ title: '已切换为' + appearanceLabel(value), icon: 'none' });
  },

  /** 返回“我的档案”；直接打开本页（无页面栈）时用 reLaunch 兜底。 */
  onBack() {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }
    wx.reLaunch({ url: '/pages/profile/index' });
  },
});
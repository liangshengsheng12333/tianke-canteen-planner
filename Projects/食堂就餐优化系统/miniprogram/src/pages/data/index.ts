/**
 * pages/data/index.ts — 数据管理（T05U04）。
 *
 * 边界：只做“当前菜单 + 更新菜单 / 导出备份 / 恢复备份 / 诊断”的入口编排；
 * 导入、导出、恢复、摘要与诊断全部复用 pages/menu 与 pages/dev 的既有实现，
 * 本页不复制菜单、备份或诊断逻辑，也不直接读写业务存储。
 */
import type { AppStore } from '../../domain/store';
import type { MenuView } from '../../domain/types';
import { describeError } from '../../utils/wx-runtime';
import { applyPageAppearance } from '../../utils/appearance';

/** 取得全局唯一 AppStore；缺失时提示，不构造临时 store。 */
function getStore(): AppStore | null {
  const app = getApp();
  const store = app && app.globalData ? app.globalData.store : null;
  if (!store) {
    wx.showToast({ title: '全局状态未初始化，请重新打开小程序', icon: 'none' });
    return null;
  }
  return store as AppStore;
}

Page({
  data: {
    themeClass: 'tk-light',
    loadError: '',
    view: null as MenuView | null,
    simulated: false,
    menuRows: [] as { label: string; value: string }[],
  },

  onShow() {
    this.setData(applyPageAppearance());
    this.reload();
  },

  reload() {
    const store = getStore();
    if (!store) {
      return;
    }
    try {
      store.ensureToday();
      const view = store.getMenuView();
      const info = view.info;
      const rows = [
        { label: '菜单版本', value: info.menuVersion },
        // 来源属性与“判定依据”分开写：imported 只说明走过导入动作，不证明菜单真实。
        {
          label: '来源属性',
          value:
            info.source === 'builtin'
              ? '内置真实菜单（西一，未导入）'
              : info.source === 'simulated'
                ? '示例菜单（开发/演示）'
                : '导入文件',
        },
        { label: '示例判定', value: this.simulatedBasis(info.simulated, info.source) },
        { label: '内容', value: info.dishCount + ' 道菜 · ' + info.windowCount + ' 个窗口' },
        { label: '导入时间', value: info.importedAt || (info.source === 'builtin' ? '内置真实菜单（未导入）' : '内置示例菜单') },
      ];
      if (info.importedFileName) {
        rows.push({ label: '导入文件', value: info.importedFileName });
      }
      this.setData({ loadError: '', view, simulated: info.simulated, menuRows: rows });
    } catch (error: any) {
      this.setData({ loadError: '读取数据管理信息失败：' + describeError(error) });
    }
  },

  /** 示例判定的依据文案：区分“来源属性”和“同内容重导入”，不发明来源证明。 */
  simulatedBasis(simulated: boolean, source: string): string {
    if (source === 'builtin') {
      return '来源属性=内置真实菜单（西一），未命中示例特征';
    }
    if (!simulated) {
      return '未命中示例特征（按导入菜单显示）';
    }
    return source === 'simulated'
      ? '来源属性=示例，非真实菜单'
      : '来源属性=已导入；内容与冻结示例菜单一致，仍按示例标注';
  },

  /** 打开菜单页指定分区：focus 由菜单页自己的 onLoad 处理，本页不复制其逻辑。 */
  openMenu(focus: string) {
    wx.navigateTo({
      url: '/pages/menu/index?focus=' + focus,
      fail: (error: any) =>
        wx.showToast({ title: '打开菜单页失败：' + describeError(error), icon: 'none' }),
    });
  },

  onOpenImport() {
    this.openMenu('import');
  },

  onOpenExport() {
    this.openMenu('export');
  },

  onOpenRestore() {
    this.openMenu('restore');
  },

  /** 原始 JSON、哈希、备份摘要与逐项对照：次级入口，不放在数据管理首层。 */
  onOpenTech() {
    this.openMenu('raw');
  },

  /** 诊断：环境、存储键、版本等只读信息。 */
  onOpenDev() {
    wx.navigateTo({
      url: '/pages/dev/index',
      fail: (error: any) =>
        wx.showToast({ title: '打开诊断页失败：' + describeError(error), icon: 'none' }),
    });
  },

  /** 返回“我的”：有页面栈则返回，直接打开本页时用 reLaunch。 */
  onBack() {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }
    wx.reLaunch({ url: '/pages/profile/index' });
  },
});
/**
 * pages/profile/index.ts — “我的”摘要入口（T05U04 收口）。
 *
 * 边界：本页只做摘要、分组入口与两组界面设置（显示模式 / 外观）的展示；
 * 资料、预算、偏好的读写全部复用 AppStore 与 utils 中的既有唯一实现，本页不建第二份真值，
 * 也不重写营养目标、预算或偏好领域逻辑。
 */
import type { AppStore } from '../../domain/store';
import type { BudgetView, MenuView, ProfileView } from '../../domain/types';
import { ACTIVITY_LABELS, GOAL_LABELS, SEX_LABELS } from '../../domain/types';
import { describeError } from '../../utils/wx-runtime';
import {
  APPEARANCE_OPTIONS,
  appearanceLabel,
  applyPageAppearance,
  getAppearance,
  setAppearancePreference,
} from '../../utils/appearance';
import type { AppearancePreference } from '../../utils/appearance';
import {
  DISPLAY_MODE_OPTIONS,
  displayModeLabel,
  loadDisplayMode,
  saveDisplayMode,
} from '../../utils/display-mode';
import type { DisplayMode } from '../../utils/display-mode';
import { MAIN_TABS, gotoMainTab } from '../../utils/tabbar';

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

/** 分 → 元展示；未设置预算显示“未设置”，不冒充 ￥0.00。 */
function money(cents: number | null): string {
  return cents === null ? '未设置' : `￥${(cents / 100).toFixed(2)}`;
}

/** 跟随系统但读不到系统主题时的说明；不宣称已在跟随。 */
function appearanceNoteOf(preference: AppearancePreference, systemReadable: boolean): string {
  if (preference !== 'system') {
    return '浅色/深色固定生效；与显示模式互不影响，均不改餐次、日期或业务记录。';
  }
  if (!systemReadable) {
    return '当前环境读不到系统主题，暂按浅色显示；“跟随系统”的选择已保存。';
  }
  return '系统切换浅色/深色后界面会自动跟随；从后台返回时也会重新同步一次。';
}

Page({
  data: {
    themeClass: 'tk-light',
    theme: 'light',
    loadError: '',
    view: null as ProfileView | null,
    menu: null as MenuView | null,

    // 目标摘要
    targetBadge: 'badge-info',
    targetBadgeText: '未计算',
    targetTitle: '还没有保存个人资料',
    targetSub: '填完资料并保存后，就能计算每日营养目标。',

    // 个人资料入口摘要
    profileBadge: 'badge-warn',
    profileBadgeText: '未保存',
    profileRows: [] as { label: string; value: string }[],

    // 预算与偏好入口摘要
    budgetRows: [] as { label: string; value: string }[],

    // 显示与外观
    mode: 'simple' as DisplayMode,
    modeLabel: '简易',
    modeOptions: DISPLAY_MODE_OPTIONS,
    preference: 'light' as AppearancePreference,
    appearanceLabelText: '浅色',
    appearanceOptions: APPEARANCE_OPTIONS,
    appearanceNote: appearanceNoteOf('light', false),
    savingMode: false,
    savingAppearance: false,

    // 数据管理入口摘要
    dataRows: [] as { label: string; value: string }[],
    simulatedMenu: false,

    tabs: MAIN_TABS,
    tab: 'profile',
  },

  onShow() {
    this.setData(applyPageAppearance());
    this.syncSettings();
    this.reload();
  },

  /** 重新读取档案/菜单摘要；只读，不触发任何写操作。 */
  reload() {
    const store = getStore();
    if (!store) {
      return;
    }
    try {
      store.ensureToday();
      const view = store.getProfileView();
      const home = store.getHomeView();
      const menu = store.getMenuView();
      this.setData({
        loadError: '',
        view,
        menu,
        ...this.buildTargetSummary(view),
        ...this.buildProfileSummary(view),
        budgetRows: this.buildBudgetRows(view, home.budget),
        dataRows: this.buildDataRows(menu),
        simulatedMenu: menu.simulated,
      });
    } catch (error: any) {
      this.setData({ loadError: '读取我的页摘要失败：' + describeError(error) });
    }
  },

  /** 把 UI 设置模块快照同步到页面；不改存储，不缓存第二份真值。 */
  syncSettings() {
    const snapshot = getAppearance();
    const mode = loadDisplayMode();
    this.setData({
      mode,
      modeLabel: displayModeLabel(mode),
      preference: snapshot.preference,
      appearanceLabelText: appearanceLabel(snapshot.preference),
      appearanceNote: appearanceNoteOf(snapshot.preference, snapshot.systemReadable),
    });
  },

  /** 顶部目标摘要：资料是否保存、目标是否可用分开表达。 */
  buildTargetSummary(view: ProfileView) {
    const target = view.target;
    if (!view.saved) {
      return {
        targetBadge: 'badge-warn',
        targetBadgeText: '资料未保存',
        targetTitle: '还没有保存个人资料',
        targetSub: '填完资料后才能计算营养目标、用于今日方案。',
      };
    }
    if (!target) {
      return {
        targetBadge: 'badge-info',
        targetBadgeText: '目标未计算',
        targetTitle: '资料已保存 · 目标未计算',
        targetSub: '点“计算营养目标”，会用已保存的资料计算。',
      };
    }
    return {
      targetBadge: target.available ? 'badge-ok' : 'badge-warn',
      targetBadgeText: target.statusLabel,
      // 首层只给短目标摘要：目标类型 + 每日能量；REE、活动系数、公式与来源留在个人资料/目标详情，
      // 不再把内部计算字段平铺给普通用户（定稿 §6 / U05 卡末段）。
      targetTitle: this.shortGoalTitle(view),
      targetSub: target.available
        ? (target.daily
          ? `每日目标约 ${Math.round(target.daily.energyKcal)} 千卡（估算，详见个人资料）`
          : '目标已就绪；数值与来源见个人资料')
        : '当前目标不用于自动规划：' + (target.reasonsText || target.message || '原因见个人资料页'),
    };
  },

  /** 目标类型短标题；资料未填目标时退化为状态文案，不暴露内部来源字段。 */
  shortGoalTitle(view: ProfileView): string {
    const goal = GOAL_LABELS[view.draft.goalType] || '当前目标';
    return goal;
  },

  /** 个人资料入口摘要：只展示已存草稿的关键字段。 */
  buildProfileSummary(view: ProfileView) {
    const draft = view.draft;
    const rows = [
      { label: '性别', value: SEX_LABELS[draft.sex] || '未填写' },
      { label: '年龄', value: draft.ageYears ? draft.ageYears + ' 岁' : '未填写' },
      { label: '身高', value: draft.heightMm ? (draft.heightMm / 10).toFixed(1) + ' cm' : '未填写' },
      { label: '体重', value: draft.weightGrams ? (draft.weightGrams / 1000).toFixed(1) + ' kg' : '未填写' },
      { label: '活动水平', value: ACTIVITY_LABELS[draft.activityLevel] || '未填写' },
      { label: '目标', value: GOAL_LABELS[draft.goalType] || '未填写' },
    ];
    return {
      profileBadge: view.saved ? 'badge-ok' : 'badge-warn',
      profileBadgeText: view.saved ? '已保存' : '未保存',
      profileRows: rows,
    };
  },

  /** 预算与偏好入口摘要：预算、口味、训练偏好、特殊饮食。 */
  buildBudgetRows(view: ProfileView, budget: BudgetView) {
    const draft = view.draft;
    const tastes = Array.isArray(draft.tastes) && draft.tastes.length > 0 ? draft.tastes.join('、') : '未填写';
    const rows = [
      { label: '全天预算', value: budget.budgetSet ? money(budget.budgetCents) : '未设置' },
      { label: '口味偏好', value: tastes },
      { label: '规律训练偏好', value: draft.trainingPreference ? '开' : '关' },
    ];
    if (draft.dietaryFlags.pregnancyOrLactation || draft.dietaryFlags.medicalDietManagement) {
      const flags = [] as string[];
      if (draft.dietaryFlags.pregnancyOrLactation) {
        flags.push('孕哺期');
      }
      if (draft.dietaryFlags.medicalDietManagement) {
        flags.push('需疾病饮食管理');
      }
      rows.push({ label: '特殊饮食', value: flags.join('、') });
    }
    return rows;
  },

  /** 数据管理入口摘要：当前菜单来源与最近备份；哈希/诊断留在次级页。 */
  buildDataRows(menu: MenuView) {
    const info = menu.info;
    const rows = [
      { label: '当前菜单', value: info.menuVersion + ' · ' + (info.simulated ? '示例菜单（模拟数据）' : '已导入菜单') },
      { label: '菜品/窗口', value: info.dishCount + ' 道 / ' + info.windowCount + ' 个窗口' },
      {
        label: '最近导出',
        value: menu.backup.lastExportedAt ? menu.backup.lastExportedAt : '还没有导出备份',
      },
    ];
    return rows;
  },

  /** 显示模式：保存成功才更新选中态；失败保留原值并提示。 */
  onSelectMode(e: any) {
    if (this.data.savingMode) {
      return;
    }
    const value = String(e.currentTarget.dataset.value || '');
    if (value !== 'simple' && value !== 'full') {
      return;
    }
    if (value === this.data.mode) {
      return;
    }
    this.setData({ savingMode: true });
    const saved = saveDisplayMode(value as DisplayMode);
    if (!saved) {
      this.setData({ savingMode: false });
      this.syncSettings();
      wx.showToast({ title: '设置没保存，请重试', icon: 'none' });
      return;
    }
    this.setData({ savingMode: false });
    this.syncSettings();
    wx.showToast({ title: '显示模式：' + displayModeLabel(value as DisplayMode), icon: 'none' });
  },

  /** 外观：保存成功才更新选中态；失败保留原值并提示。 */
  onSelectAppearance(e: any) {
    if (this.data.savingAppearance) {
      return;
    }
    const value = String(e.currentTarget.dataset.value || '');
    if (value !== 'light' && value !== 'dark' && value !== 'system') {
      return;
    }
    if (value === this.data.preference) {
      return;
    }
    this.setData({ savingAppearance: true });
    const saved = setAppearancePreference(value as AppearancePreference);
    if (!saved) {
      this.setData({ savingAppearance: false });
      this.syncSettings();
      wx.showToast({ title: '设置没保存，请重试', icon: 'none' });
      return;
    }
    this.setData({ savingAppearance: false, ...applyPageAppearance() });
    this.syncSettings();
    wx.showToast({ title: '外观：' + appearanceLabel(value as AppearancePreference), icon: 'none' });
  },

  /** 个人资料：进入摘要/编辑页。 */
  onOpenProfileEdit() {
    wx.navigateTo({
      url: '/pages/profile-edit/index',
      fail: (error: any) =>
        wx.showToast({ title: '打开个人资料失败：' + describeError(error), icon: 'none' }),
    });
  },

  /** 预算与偏好：复用既有预算/偏好字段，不新建数据。 */
  onOpenBudget() {
    wx.navigateTo({
      url: '/pages/budget/index',
      fail: (error: any) =>
        wx.showToast({ title: '打开预算与偏好失败：' + describeError(error), icon: 'none' }),
    });
  },

  /** 数据管理：更新菜单、导出/恢复备份与诊断的入口页。 */
  onOpenData() {
    wx.navigateTo({
      url: '/pages/data/index',
      fail: (error: any) =>
        wx.showToast({ title: '打开数据管理失败：' + describeError(error), icon: 'none' }),
    });
  },

  /** 外观说明页：保留原有独立页面入口，不重复实现。 */
  onOpenAppearanceDetail() {
    wx.navigateTo({
      url: '/pages/appearance/index',
      fail: (error: any) =>
        wx.showToast({ title: '打开外观说明失败：' + describeError(error), icon: 'none' }),
    });
  },

  // 共用底部导航：当前入口不重复跳转，其余交给 utils/tabbar.ts 的唯一实现。
  onTab(e: any) {
    gotoMainTab(String(e.currentTarget.dataset.tab || ''), 'profile');
  },
});
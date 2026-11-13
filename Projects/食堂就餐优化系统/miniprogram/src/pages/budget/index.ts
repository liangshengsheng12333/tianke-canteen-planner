/**
 * pages/budget/index.ts — 预算与偏好（T05U04）。
 *
 * 边界：全天预算属于 PlannerSettings，口味/训练偏好/孕哺/疾病属于档案草稿，两者都通过
 * AppStore 既有接口读写；本页只做展示单位换算与“读→改→写”编排，不重算营养目标、不改核心规则。
 * 训练偏好只是档案字段，不是“增肌目标”或新目标入口。
 */
import type { AppStore } from '../../domain/store';
import type { ActionResult, ProfileDraft, ProfileView } from '../../domain/types';
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

/** 分 → 元输入框文本（未设置显示空串，0 显示 0，两者不能混）。 */
function centsToYuanInput(cents: number | null): string {
  if (cents === null || cents === undefined) {
    return '';
  }
  return cents % 100 === 0 ? String(cents / 100) : (cents / 100).toFixed(2);
}

/** 元输入 → 分；留空表示不设预算（null），0 是合法的“零预算”。 */
function parseBudgetYuan(text: string): { ok: boolean; cents: number | null; message: string } {
  const trimmed = String(text === null || text === undefined ? '' : text).trim();
  if (trimmed === '') {
    return { ok: true, cents: null, message: '' };
  }
  const value = Number(trimmed);
  if (!Number.isFinite(value)) {
    return { ok: false, cents: null, message: '预算请填写数字（元）' };
  }
  if (value < 0) {
    return { ok: false, cents: null, message: '预算不能为负数' };
  }
  return { ok: true, cents: Math.round(value * 100), message: '' };
}

/** 分 → 元展示；未设置预算显示“未设置”，不冒充 ￥0.00。 */
function money(cents: number | null): string {
  return cents === null ? '未设置' : `￥${(cents / 100).toFixed(2)}`;
}

/** 口味偏好按中英文逗号切分并去空项；空数组表示“无偏好”。 */
function splitTastes(text: string): string[] {
  return String(text || '')
    .split(/[,，]/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

Page({
  data: {
    themeClass: 'tk-light',
    loadError: '',
    view: null as ProfileView | null,

    // 全天预算（今日设置）
    budgetYuan: '',
    budgetSaving: false,
    budgetNote: '',
    budgetRows: [] as { label: string; value: string }[],

    // 档案偏好
    tastesText: '',
    trainingPreference: false,
    pregnancyOrLactation: false,
    medicalDietManagement: false,
    prefSaving: false,
    prefNote: '',
    prefErrors: [] as string[],
  },

  onShow() {
    this.setData(applyPageAppearance());
    this.reload();
  },

  /** 重读档案与预算；编辑中的偏好输入不回填，避免覆盖未保存内容。 */
  reload() {
    const store = getStore();
    if (!store) {
      return;
    }
    try {
      store.ensureToday();
      const view = store.getProfileView();
      const home = store.getHomeView();
      const budget = home.budget;
      const updates: any = {
        loadError: '',
        view,
        budgetYuan: centsToYuanInput(budget.budgetSet ? budget.budgetCents : null),
        budgetRows: this.buildBudgetRows(budget),
      };
      // 只在没有未保存偏好输入时回填偏好字段：本页没有“脏检查”抽象，用编辑状态兜底。
      if (!this.data.prefSaving) {
        updates.tastesText = (view.draft.tastes || []).join('，');
        updates.trainingPreference = !!view.draft.trainingPreference;
        updates.pregnancyOrLactation = !!view.draft.dietaryFlags.pregnancyOrLactation;
        updates.medicalDietManagement = !!view.draft.dietaryFlags.medicalDietManagement;
      }
      this.setData(updates);
    } catch (error: any) {
      this.setData({ loadError: '读取预算与偏好失败：' + describeError(error) });
    }
  },

  /** 预算状态摘要：预算、计划合计、实际花费与未知金额口径都来自 HomeView。
 *  标签本身已带“已知 …（含未填项）/实付待补全”，这里不再追加后缀，避免重复。 */
  buildBudgetRows(budget: any) {
    const rows = [
      { label: '全天预算', value: budget.budgetSet ? money(budget.budgetCents) : '未设置（不约束）' },
      { label: '计划合计', value: budget.plannedLabel },
      { label: '实际花费', value: budget.spentLabel },
    ];
    return rows;
  },

  /** 保存全天预算：留空 = 取消预算约束，0 = 零预算；失败保留原预算。 */
  onSaveBudget() {
    const store = getStore();
    if (!store || this.data.budgetSaving) {
      return;
    }
    const parsed = parseBudgetYuan(this.data.budgetYuan);
    if (!parsed.ok) {
      wx.showToast({ title: parsed.message, icon: 'none' });
      return;
    }
    this.setData({ budgetSaving: true });
    let result: ActionResult;
    try {
      result = store.saveSettings({ budgetCents: parsed.cents });
    } catch (error: any) {
      this.setData({ budgetSaving: false });
      wx.showToast({ title: '保存预算异常：' + describeError(error), icon: 'none' });
      return;
    }
    if (result.ok) {
      const budget = store.getHomeView().budget;
      this.setData({
        budgetSaving: false,
        budgetYuan: centsToYuanInput(budget.budgetSet ? budget.budgetCents : null),
        budgetRows: this.buildBudgetRows(budget),
        budgetNote: result.message + '；请回“今日”页刷新方案。',
      });
    } else {
      this.setData({ budgetSaving: false, budgetNote: result.message });
    }
    wx.showToast({ title: result.message || '预算保存失败', icon: 'none' });
  },

  onBudgetInput(e: any) {
    this.setData({ budgetYuan: e.detail.value });
  },

  onTastesInput(e: any) {
    this.setData({ tastesText: e.detail.value });
  },

  onPrefSwitch(e: any) {
    const field = String(e.currentTarget.dataset.field || '');
    if (field) {
      this.setData({ [field]: !!e.detail.value });
    }
  },

  /**
   * 保存偏好：以 store 当前草稿为底稿，只替换口味/训练/孕哺/疾病四项，再交给
   * store.saveProfile 校验与事务写盘；保存成功后自动重算目标，不在这里套任何公式。
   */
  async onSavePreferences() {
    const store = getStore();
    if (!store || this.data.prefSaving) {
      return;
    }
    const view = this.data.view as ProfileView | null;
    if (!view) {
      wx.showToast({ title: '档案还没加载完成', icon: 'none' });
      return;
    }
    if (!view.saved) {
      wx.showToast({ title: '请先在“个人资料”里保存身体档案', icon: 'none' });
      return;
    }
    const base = view.draft;
    const draft: ProfileDraft = {
      sex: base.sex,
      ageYears: base.ageYears,
      heightMm: base.heightMm,
      weightGrams: base.weightGrams,
      bodyFatPermille: base.bodyFatPermille,
      activityLevel: base.activityLevel,
      goalType: base.goalType,
      manualTargets: base.manualTargets,
      trainingPreference: !!this.data.trainingPreference,
      dietaryFlags: {
        pregnancyOrLactation: !!this.data.pregnancyOrLactation,
        medicalDietManagement: !!this.data.medicalDietManagement,
      },
      tastes: splitTastes(this.data.tastesText),
    };
    this.setData({ prefSaving: true, prefErrors: [], prefNote: '' });
    let result: ActionResult;
    try {
      result = store.saveProfile(draft);
    } catch (error: any) {
      this.setData({ prefSaving: false, prefNote: '保存异常：' + describeError(error) });
      wx.showToast({ title: '保存偏好异常', icon: 'none' });
      return;
    }
    if (!result.ok) {
      const errors = result.errors && result.errors.length > 0 ? result.errors : [];
      this.setData({
        prefSaving: false,
        prefNote: result.message || '保存失败',
        prefErrors: errors.length > 0 ? errors.map((entry) => entry.field + '：' + entry.message) : [result.message || '保存失败'],
      });
      wx.showToast({ title: result.message || '保存失败', icon: 'none' });
      return;
    }
    this.setData({ prefSaving: false, prefNote: result.message || '偏好已保存' });
    this.reload();
    // 训练/孕哺会影响目标适用性：保存后按既有流程重算，失败时如实展示。
    try {
      const outcome = await store.computeTarget();
      if (outcome.ok) {
        this.setData({ prefNote: (result.message || '偏好已保存') + '；营养目标已按新档案重算。' });
      } else {
        this.setData({ prefNote: (result.message || '偏好已保存') + '；目标重算失败：' + (outcome.message || '未知原因') });
      }
    } catch (error: any) {
      this.setData({ prefNote: (result.message || '偏好已保存') + '；目标重算异常：' + describeError(error) });
    }
    wx.showToast({ title: '偏好已保存', icon: 'none' });
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
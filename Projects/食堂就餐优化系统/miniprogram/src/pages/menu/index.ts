/**
 * pages/menu/index.ts — 菜单与备份页（导入预检/确认替换、导出、恢复）。
 *
 * 边界：解析、核心校验、影响分析、备份摘要与逐项对照都在 domain/store.ts；
 * 本页只负责选择/读取文件、展示 report 与调用 store，不自行判断菜单合法性，
 * 也不直接读写 wx storage（导出文件写入同样由 store 完成）。
 */
import { MEAL_LABELS } from '../../domain/types';
import { WEST1_MENU_CATALOG } from '../../config/west1-menu';
import { describeError } from '../../utils/wx-runtime';
import { applyPageAppearance } from '../../utils/appearance';
import type { AppStore, BackupExport } from '../../domain/store';
import type { FieldError, Meal, MenuDiffView, MenuPreflight, MenuView, RestorePreflight, RestoreResult } from '../../domain/types';
// 本页只做“选择/读取文件 → 展示 store 预检报告 → 用户确认后调用 apply”三段，不解析菜单、不判断合法性。
// 导入与恢复都遵循“预检 token 一次有效”：内容一变就作废旧 token，应用成功/失败后也立即作废，必须重新预检。
// 页面不直接读写 wx storage；导出文本、文件落盘与摘要校验都由 store 完成，页面只展示结果。
// 模拟菜单的警示文案来自 store（MenuView.info.banner），页面只负责显示“模拟”标签。

// 本页是“我的 → 数据管理”的次级页面，不再占主导航；返回路径优先用页面栈，直接打开时回“我的”。

/** 预检阶段的中文名（stage 值来自 store，不在页面推断）。 */
// 只翻译 stage 值；未知 stage 由 stageLabel 原样显示，页面不猜测预检失败原因。
const STAGE_LABELS: Record<string, string> = {
  parse: '文件解析',
  schema: '结构校验',
  validate: '核心校验',
  ready: '预检通过',
};

/** 导入影响展示结构（由 MenuDiffView 映射，只做格式化）。 */
// DiffDisplay 是纯展示结构：列表、计数与“改价前后”都已由 store 转成可读值，页面不再推断。
interface DiffDisplay {
  oldMenuVersion: string;
  newMenuVersion: string;
  windowsAdded: string[];
  windowsRemoved: string[];
  dishesAdded: string[];
  dishesRemoved: string[];
  offersAdded: number;
  offersRemoved: number;
  priceChanges: { name: string; before: string; after: string }[];
  impactedMeals: string[];
  keepsPlan: boolean;
  invalidLocks: { label: string; reason: string }[];
  droppedSoldOut: { label: string; reason: string }[];
}

// 本页假定 store 已存在；缺失属于启动失败，不在这里兜底假数据。
function store(): AppStore {
  return getApp().globalData.store as AppStore;
}

// 改价对比里 null 表示“未知”而不是 0：未知价不能显示成 ￥0.00。
function money(cents: number | null): string {
  return cents === null ? '未知' : `￥${(cents / 100).toFixed(2)}`;
}

// 未识别的 stage 原样回显，便于排查新增阶段，而不是显示空白。
function stageLabel(stage: string): string {
  return STAGE_LABELS[stage] || stage || '—';
}

/**
 * offersAdded / offersRemoved 在 domain/menu.ts 里是数量，而 types.ts 的 MenuDiffView
 * 当前声明为 string[]（Lead 侧待统一）。这里对两种形态都取数量，保证页面展示正确。
 * 类型统一后可删掉这层兼容；页面展示始终是数量，不关心底层是数组还是数字。
 */
function offerCount(value: string[] | number): number {
  return typeof value === 'number' ? value : value.length;
}

/** 把 store 的菜单差异映射为页面展示结构（菜品/窗口名已由 store 换成可读名称）。 */
// impactedMeals 用中文餐次名展示；文字来自 MEAL_LABELS，不改变 store 给的餐次枚举。
function buildDiffDisplay(diff: MenuDiffView): DiffDisplay {
  return {
    oldMenuVersion: diff.oldMenuVersion,
    newMenuVersion: diff.newMenuVersion,
    windowsAdded: diff.windowsAdded,
    windowsRemoved: diff.windowsRemoved,
    dishesAdded: diff.dishesAdded,
    dishesRemoved: diff.dishesRemoved,
    offersAdded: offerCount(diff.offersAdded),
    offersRemoved: offerCount(diff.offersRemoved),
    priceChanges: diff.priceChanges.map((change) => ({
      name: change.name,
      before: money(change.oldCents),
      after: money(change.newCents),
    })),
    impactedMeals: diff.impactedMeals.map((meal: Meal) => MEAL_LABELS[meal] || meal),
    keepsPlan: diff.keepsPlan,
    invalidLocks: diff.invalidLocks.map((lock) => ({ label: lock.label, reason: lock.reason })),
    droppedSoldOut: diff.droppedSoldOut.map((mark) => ({ label: mark.label, reason: mark.reason })),
  };
}

// 导入状态整体重置：预检文本/阶段/错误/影响分析都清空，避免把上一次报告挂在新内容上。
function emptyImportState() {
  return {
    importStage: '',
    importStageLabel: '',
    importMessage: '',
    importErrors: [] as FieldError[],
    importDiff: null as DiffDisplay | null,
    importReady: false,
    importRawError: '',
  };
}

// 恢复状态同理；restoreComparison 只在应用成功后填充，预检阶段显式清空。
function emptyRestoreState() {
  return {
    restoreStage: '',
    restoreStageLabel: '',
    restoreMessage: '',
    restoreErrors: [] as FieldError[],
    restoreSummary: '',
    restoreDigest: '',
    restoreReady: false,
    restoreComparison: [] as RestoreResult['comparison'],
    restoreResultMessage: '',
    restoreDigestAfter: '',
  };
}

Page({
  data: {
    // 外观 class 由 utils/appearance.ts 决定；本页不读写偏好。
    themeClass: 'tk-light',
    view: null as MenuView | null,
    loaded: false,

    // 导入
    // 导入/导出/恢复三块各自持有 busy 与阶段字段，互不复用，避免一块忙时把另一块也锁住。
    importText: '',
    importFileName: '',
    importBusy: false,
    // 内置真实菜单入口：只多一种读取来源，预检/确认/取消仍复用下面的 import 状态与凭证。
    west1Busy: false,
    west1Applied: false,
    west1Pending: false,
    ...emptyImportState(),
    // import 区字段用展开合并：emptyImportState 是唯一重置口径，避免漏清某个字段。

    // 导出
    exportBusy: false,
    backupReady: false,
    backupDigest: '',
    backupTime: '',
    backupPath: '',
    backupMessage: '',
    backupTextLength: 0,
    // 备份展示字段来自 store 的导出结果；backupPath 为空时 WXML 隐藏“分享文件”。

    // 恢复
    restoreText: '',
    restoreFileName: '',
    restoreBusy: false,
    ...emptyRestoreState(),
    // 恢复区同样用展开合并；restoreComparison 只在应用成功后才有内容。

    statusText: '',
    statusKind: 'ok', // ok | warn | error
  },

  // 非 data 内部状态：预检对象含完整 catalog，体积大且只用于 apply，不放进 data。
  // 预检对象只用于 apply（一次性凭证），放页面实例而不是 data：不进 WXML、不参与渲染 diff。
  pendingMenu: null as MenuPreflight | null,
  pendingRestore: null as RestorePreflight | null,
  backupText: '',

  // U04 数据管理入口通过 ?focus=import|export|restore|raw 打开本页；只在首次加载后滚动一次。
  pendingFocus: '' as string,

  // 每次显示先 ensureToday 再取 MenuView：跨日后最近 7 天/计划等展示可能变化。
  // 页面不缓存 MenuView；导入/导出/恢复成功后统一 reload。
  onLoad(options: any) {
    this.pendingFocus = options && options.focus ? String(options.focus) : '';
  },

  onShow() {
    this.setData(applyPageAppearance());
    store().ensureToday();
    this.reload();
  },

  // 只重读 store 的 MenuView；不触发任何写操作。
  reload() {
    const view = store().getMenuView();
    // “当前已启用”只按 catalogHash 判定：内置副本保留原摘要，重新导入同一菜单也会命中。
    this.setData({
      view,
      loaded: true,
      west1Applied: view.info.catalogHash === WEST1_MENU_CATALOG.catalogHash,
    });
    this.scrollToFocus();
  },

  /** 滚动到指定分区（用于内置菜单预检后把结果面板带到用户眼前）。 */
  scrollToSelector(selector: string) {
    const scroll = () => wx.pageScrollTo({ selector, duration: 200, fail: () => {} });
    if (typeof wx.nextTick === 'function') {
      wx.nextTick(scroll);
      return;
    }
    scroll();
  },

  /** 按 ?focus 参数滚动到对应分区；一次有效，避免用户自己滚动后被强制拉回。 */
  scrollToFocus() {
    const focus = this.pendingFocus;
    if (!focus) {
      return;
    }
    this.pendingFocus = '';
    const anchors: Record<string, string> = {
      import: '#data-import',
      export: '#data-export',
      restore: '#data-restore',
      raw: '#data-export',
    };
    const selector = anchors[focus];
    if (!selector) {
      return;
    }
    if (typeof wx.nextTick === 'function') {
      wx.nextTick(() => {
        wx.pageScrollTo({ selector, duration: 200, fail: () => {} });
      });
      return;
    }
    wx.pageScrollTo({ selector, duration: 200, fail: () => {} });
  },

  // 状态行 + toast 双通道；只有 error 才弹 toast，warn（如“恢复后仍有不同项”）只留在页面。
  setStatus(message: string, kind: string) {
    this.setData({ statusText: message, statusKind: kind });
    if (kind === 'error') {
      wx.showToast({ title: message, icon: 'none' });
    }
  },

  // -------------------------------------------------------------------------
  // 导入菜单：粘贴 / 选文件 → 预检 → 确认替换
  // -------------------------------------------------------------------------

  /** 内容一变化就作废旧预检 token，避免用旧凭证应用新内容。 */
  // 作废 pendingMenu 后立刻清空 import 状态：旧预检 diff 不能继续显示在新文本旁。
  onImportInput(e: any) {
    this.pendingMenu = null;
    this.setData({
      importText: e.detail.value,
      importFileName: '',
      west1Pending: false,
      ...emptyImportState(),
    });
  },

  // 文件名只作为来源记录，不参与解析；输入文件名不影响预检结论。
  onImportFileNameInput(e: any) {
    this.setData({ importFileName: e.detail.value });
  },

  /** 从聊天记录中选择 JSON 文件并读取文本（读取失败可见，不静默）。 */
  // 用户取消选择不当作错误（fail 里过滤 cancel），避免误报。
  onChooseMenuFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json', 'txt'],
      success: (res: any) => {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file) {
          this.setStatus('未选择文件', 'error');
          return;
        }
        try {
          const content = String(wx.getFileSystemManager().readFileSync(file.path, 'utf8'));
          this.pendingMenu = null;
          this.setData({
            importText: content,
            importFileName: file.name || 'menu.json',
            west1Pending: false,
            ...emptyImportState(),
          });
          this.setStatus(`已读取 ${file.name || '菜单文件'}（${content.length} 字符），请点击“预检”。`, 'ok');
        } catch (error: any) {
          this.setStatus(`读取菜单文件失败：${describeError(error)}`, 'error');
        }
      },
      fail: (error: any) => {
        const message = describeError(error);
        if (message.indexOf('cancel') >= 0) {
          return;
        }
        this.setStatus(`选择菜单文件失败：${message}`, 'error');
      },
    });
  },

  /** 预检：调用核心 ValidateMenuCatalog 并展示 stage/message/errors/diff。 */
  // 空文本先拦，避免把空内容送进核心预检；非空才置 importBusy 并调用 store。
  // preflight.ok 才把结果放进 pendingMenu；失败只展示 stage/message/errors，不留下可用凭证。
  async onPreflightMenu() {
    const text = this.data.importText;
    if (text.trim() === '') {
      this.setStatus('请先粘贴菜单 JSON 或选择菜单文件', 'error');
      return;
    }
    this.setData({ importBusy: true });
    const fileName = this.data.importFileName || 'pasted-menu.json';
    const preflight = await store().preflightMenu(text, fileName);
    this.pendingMenu = preflight.ok ? preflight : null;
    this.setData({
      importBusy: false,
      importStage: preflight.stage,
      importStageLabel: stageLabel(preflight.stage),
      importMessage: preflight.message,
      importErrors: preflight.errors,
      importDiff: preflight.diff ? buildDiffDisplay(preflight.diff) : null,
      importReady: preflight.ok,
      importRawError: preflight.rawError || '',
    });
    this.setStatus(preflight.message, preflight.ok ? 'ok' : 'error');
  },

  /**
   * 使用内置“西院西一食堂 · 首批菜单”：只把读取来源换成内置副本，
   * 预检、影响分析、一次性凭证与确认替换全部复用 onPreflightMenu/onApplyMenu 的既有路径。
   * 不自动替换、不自动刷新推荐、不清空历史；营养 null 原样交给既有“待补全”显示。
   */
  async onUseWest1Menu() {
    if (this.data.importBusy) {
      return;
    }
    this.setData({ importBusy: true, west1Busy: true });
    const fileName = '西院西一食堂-首批菜单.json';
    const preflight = await store().preflightMenu(JSON.stringify(WEST1_MENU_CATALOG), fileName);
    this.pendingMenu = preflight.ok ? preflight : null;
    this.setData({
      importBusy: false,
      west1Busy: false,
      west1Pending: preflight.ok,
      // 内置来源不经过文本框：清空手动内容，避免旧文本与本次预检结果混淆。
      importText: '',
      importFileName: preflight.ok ? fileName : '',
      importStage: preflight.stage,
      importStageLabel: stageLabel(preflight.stage),
      importMessage: preflight.message,
      importErrors: preflight.errors,
      importDiff: preflight.diff ? buildDiffDisplay(preflight.diff) : null,
      importReady: preflight.ok,
      importRawError: preflight.rawError || '',
    });
    this.setStatus(preflight.message, preflight.ok ? 'ok' : 'error');
    if (preflight.ok) {
      this.scrollToSelector('#data-import-preflight');
    }
  },

  /** 确认替换：只用同一份成功预检的 token 应用一次。 */
  // pendingMenu 是“预检成功”的一次性凭证，页面不重新解析 importText，避免预检内容与替换内容不一致。
  // 应用成功或失败都立即作废本地凭证并要求重新预检（token 一次有效）。
  onApplyMenu() {
    const pending = this.pendingMenu;
    if (!pending || !this.data.importReady) {
      this.setStatus('没有可应用的预检结果，请先预检', 'error');
      return;
    }
    const result = store().applyMenu(pending);
    // 成功或失败都作废本地凭证，需重新预检才能再次替换（token 一次有效）。
    this.pendingMenu = null;
    this.setData({ importReady: false, west1Pending: false });
    if (result.ok) {
      this.reload();
      this.setData({ importMessage: result.message, importDiff: null });
    }
    this.setStatus(result.message, result.ok ? 'ok' : 'error');
  },

  // 取消只清本地状态与凭证；当前菜单、锁定与计划不会被触碰（真正的写盘只在 apply 里）。
  onCancelImport() {
    this.pendingMenu = null;
    this.setData({ importText: '', importFileName: '', west1Pending: false, ...emptyImportState() });
    this.setStatus('已取消导入；当前菜单、锁定与计划保持不变。', 'ok');
  },

  // -------------------------------------------------------------------------
  // 导出备份
  // -------------------------------------------------------------------------

  /** 导出由用户主动触发；文本保存在页面内部，界面只展示摘要、时间与文件路径。 */
  // 导出文本保存在页面实例 backupText 里，data 只放摘要/时间/路径/长度，避免大文本进 setData。
  // 导出成功后 reload 刷新“最近导出”记录；失败保留旧展示。
  async onExportBackup() {
    this.setData({ exportBusy: true });
    const result: BackupExport = await store().exportBackup();
    this.backupText = result.text || '';
    this.setData({
      exportBusy: false,
      backupReady: result.ok,
      backupDigest: result.digest,
      backupTime: result.exportedAt,
      backupPath: result.filePath || '',
      backupMessage: result.message,
      backupTextLength: result.text ? result.text.length : 0,
    });
    if (result.ok) {
      this.reload();
    }
    this.setStatus(result.message, result.ok ? 'ok' : 'error');
  },

  // 复制的是最近一次导出的原文；没导出过就提示，不临时生成备份（备份必须由 store 产出）。
  onCopyBackup() {
    if (!this.backupText) {
      this.setStatus('请先导出备份，再复制文本', 'error');
      return;
    }
    wx.setClipboardData({
      data: this.backupText,
      success: () => {
        this.setStatus('备份文本已复制到剪贴板，可粘贴到聊天或笔记保存。', 'ok');
      },
      fail: (error: any) => {
        this.setStatus(`复制失败：${describeError(error)}`, 'error');
      },
    });
  },

  // 分享依赖本地文件路径；基础库不支持 shareFileMessage 时降级提示用剪贴板。
  onShareBackup() {
    const filePath = this.data.backupPath;
    if (!filePath) {
      this.setStatus('本次导出没有本地文件路径，无法分享；可改用“复制到剪贴板”。', 'error');
      return;
    }
    if (typeof wx.shareFileMessage !== 'function') {
      this.setStatus('当前基础库不支持分享文件，请改用“复制到剪贴板”。', 'error');
      return;
    }
    wx.shareFileMessage({
      filePath,
      success: () => {
        this.setStatus('已发起文件分享', 'ok');
      },
      fail: (error: any) => {
        this.setStatus(`分享文件失败：${describeError(error)}`, 'error');
      },
    });
  },

  // -------------------------------------------------------------------------
  // 恢复备份：粘贴 / 选文件 → 预检 → 确认恢复 → 逐项对照
  // -------------------------------------------------------------------------

  // 与导入相同：内容一变就作废 pendingRestore 与旧报告。
  onRestoreInput(e: any) {
    this.pendingRestore = null;
    this.setData({ restoreText: e.detail.value, ...emptyRestoreState() });
  },

  // 恢复文件同样从聊天记录读取；取消选择不算失败。
  onChooseRestoreFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json', 'txt'],
      success: (res: any) => {
        const file = res.tempFiles && res.tempFiles[0];
        if (!file) {
          this.setStatus('未选择恢复文件', 'error');
          return;
        }
        try {
          const content = String(wx.getFileSystemManager().readFileSync(file.path, 'utf8'));
          this.pendingRestore = null;
          this.setData({
            restoreText: content,
            restoreFileName: file.name || 'backup.json',
            ...emptyRestoreState(),
          });
          this.setStatus(`已读取 ${file.name || '备份文件'}（${content.length} 字符），请点击“预检”。`, 'ok');
        } catch (error: any) {
          this.setStatus(`读取恢复文件失败：${describeError(error)}`, 'error');
        }
      },
      fail: (error: any) => {
        const message = describeError(error);
        if (message.indexOf('cancel') >= 0) {
          return;
        }
        this.setStatus(`选择恢复文件失败：${message}`, 'error');
      },
    });
  },

  /** 恢复预检：校验格式/版本/摘要/结构，展示摘要与错误。 */
  // 预检负责格式/版本/摘要/结构校验；页面不比对摘要，只展示 store 的 digest 与 summary。
  // 预检成功才保留凭证；同时清空上一次的对照结果，避免新旧恢复混在一起。
  async onPreflightRestore() {
    const text = this.data.restoreText;
    if (text.trim() === '') {
      this.setStatus('请先粘贴备份 JSON 或选择备份文件', 'error');
      return;
    }
    this.setData({ restoreBusy: true });
    const preflight = await store().preflightRestore(text);
    this.pendingRestore = preflight.ok ? preflight : null;
    this.setData({
      restoreBusy: false,
      restoreStage: preflight.stage,
      restoreStageLabel: stageLabel(preflight.stage),
      restoreMessage: preflight.message,
      restoreErrors: preflight.errors,
      restoreSummary: preflight.summary,
      restoreDigest: preflight.digest || '',
      restoreReady: preflight.ok,
      restoreComparison: [],
      restoreResultMessage: '',
      restoreDigestAfter: '',
    });
    this.setStatus(preflight.message, preflight.ok ? 'ok' : 'error');
  },

  /** 确认恢复：原子替换本机数据，并展示逐项对照（取消/失败保留当前数据）。 */
  // 恢复是原子替换：store 内部先校验最终状态再一次性写盘，取消/失败都保留当前数据。
  // comparison 非空表示“恢复已应用”，只是存在与导出前不同的项（例如跨日导致的展示差异）。
  // 因此失败但已应用时用 warn 提示而不是 error；真正未应用（凭证失效等）才报错。
  async onApplyRestore() {
    const pending = this.pendingRestore;
    if (!pending || !this.data.restoreReady) {
      this.setStatus('没有可应用的恢复预检结果，请先预检', 'error');
      return;
    }
    this.setData({ restoreBusy: true });
    const result = await store().applyRestore(pending);
    // 无论结果如何都先作废凭证：一次预检只能应用一次。
    this.pendingRestore = null;
    const applied = result.comparison.length > 0;
    this.setData({
      restoreBusy: false,
      restoreReady: false,
      restoreComparison: result.comparison,
      restoreResultMessage: result.message,
      restoreDigestAfter: result.digest || '',
      restoreMessage: result.message,
    });
    this.reload();
    if (!result.ok && !applied) {
      // 凭证失效等真正未应用的情况：错误必须醒目。
      this.setStatus(result.message, 'error');
      return;
    }
    // 恢复已应用时允许存在“与导出前不同的项”，用 warn 提示而不是谎称一致。
    this.setStatus(result.message, result.ok ? 'ok' : 'warn');
  },

  // 取消恢复只清本地状态与凭证，本机数据保持不变。
  onCancelRestore() {
    this.pendingRestore = null;
    this.setData({ restoreText: '', restoreFileName: '', ...emptyRestoreState() });
    this.setStatus('已取消恢复；当前本机数据保持不变。', 'ok');
  },

  // -------------------------------------------------------------------------
  // 返回“我的”
  // -------------------------------------------------------------------------

  // 次级页不占主导航：有页面栈时返回来路，被直接打开时回“我的”。
  onBack() {
    const pages = typeof getCurrentPages === 'function' ? getCurrentPages() : [];
    if (pages.length > 1) {
      wx.navigateBack();
      return;
    }
    wx.reLaunch({ url: '/pages/profile/index' });
  },
});

/**
 * pages/dev/index.ts — 开发诊断页（技术字段集中展示，不进入正式首页）。
 *
 * 本页只调用 store 的诊断方法并把结果原样展示：环境行、WASM 身份、存储占用、规划算法、
 * ABI 探针、T02 四夹具的 status/耗时/原始 JSON、最近一次 Plan 请求与响应、清库。
 * 规划算法是“设置写入”：只调 store.saveSettings({algorithm})，默认仍 greedy；不在这里调用核心或自行判定最优。
 */
import type { AppStore, PerformanceSample } from '../../domain/store';
import type { DevView, SupportedAlgorithm } from '../../domain/types';
import { ALGORITHM_LABELS, ALGORITHM_OPTIONS } from '../../domain/types';
import { nowMs } from '../../utils/wx-runtime';
import { applyPageAppearance } from '../../utils/appearance';
// 本页是诊断页：只调用 store 的诊断方法并原样展示结果，不做业务判断、不触发规划/记餐写操作（清库除外）。
// WASM 身份（预期字节 + SHA256）与页面展示值对照，用于确认打包的是冻结二进制而不是重建产物。
// 计时是“工具侧观测”：开发者工具/真机数值与 Node 宿主数值分开记录，门槛未冻结时只报数值、不宣布达标。
// 技术字段（planKey/requestId/原始 JSON）只在此页出现，正式页面不展示。

// 本页是“我的 → 数据管理 → 诊断”的次级页面，不再占主导航；返回路径优先用页面栈，直接打开时回“我的”。

type FixtureKey = 'success' | 'targetUnavailable' | 'invalid' | 'resourceLimited';

// 每个夹具的 UI 状态：hasRun=false 表示还没跑过，不能用默认 0 耗时冒充结果。
interface FixtureUI {
  key: FixtureKey;
  label: string;
  desc: string;
  hasRun: boolean;
  ok: boolean;
  status: string;
  durationMs: number;
  message: string;
  rawText: string;
  expanded: boolean;
}

/** T02 四个计划夹具（展示用标签，实际请求由 store 从 mock 夹具取）。 */
// 四个夹具对应 T02 冻结用例：success / targetUnavailable / invalid / resourceLimited；
// 夹具数据来自 store 的 mock 夹具（开发用），不是真实菜单；展示的 status/耗时/JSON 是核心真实执行结果。
const FIXTURE_DEFS: { key: FixtureKey; label: string; desc: string }[] = [
  { key: 'success', label: '成功方案（OkPartial）', desc: '常规贪心规划成功；模拟数据带 ESTIMATED_DATA。' },
  { key: 'targetUnavailable', label: '目标不可用（TargetUnavailable）', desc: 'BMI 过轻且无手动目标，自动目标停用。' },
  { key: 'invalid', label: '非法输入（INVALID_INPUT）', desc: 'maxItemsPerMeal 超限，返回契约错误包络。' },
  { key: 'resourceLimited', label: '资源受限（ResourceLimited）', desc: '合法限额耗尽，搜索预算真实用尽。' },
];

// 本页假定 store 已存在；缺失属于启动失败，不兜底假数据。
function store(): AppStore {
  return getApp().globalData.store as AppStore;
}

// 汇总只做统计（排序取 min/median/max/mean），不改原始值；原始数组也展示，便于复核统计口径。
// median 取排序后中位下标；样本固定 5 次，奇数个样本下 median 就是第 3 个值。
function summarize(raw: number[], label: string): { rows: { label: string; value: string }[]; message: string } {
  const sorted = raw.slice().sort((a, b) => a - b);
  const min = sorted[0];
  const max = sorted[sorted.length - 1];
  const median = sorted[Math.floor(sorted.length / 2)];
  const mean = raw.reduce((sum, value) => sum + value, 0) / raw.length;
  const label3 = (value: number) => `${value.toFixed(3)} ms`;
  return {
    rows: [
      { label: `${label} 原始值（${raw.length} 次）`, value: raw.map((value) => value.toFixed(3)).join(', ') },
      { label: '最小值 min', value: label3(min) },
      { label: '中位数 median', value: label3(median) },
      { label: '最大值 max', value: label3(max) },
      { label: '平均值 mean', value: label3(mean) },
    ],
    message: `${label} ${raw.length} 次：median ${label3(median)}（min ${label3(min)} / max ${label3(max)}）`,
  };
}

// 每次重跑夹具或清库都重建夹具状态，避免把上一次结果当成当前结果。
function buildFixtures(): FixtureUI[] {
  return FIXTURE_DEFS.map((def) => ({
    key: def.key,
    label: def.label,
    desc: def.desc,
    hasRun: false,
    ok: false,
    status: '',
    durationMs: 0,
    message: '',
    rawText: '',
    expanded: false,
  }));
}

/** 开发页技术字段（只做字符串化，不判断业务状态）。 */
// catalogSource 只映射成“内置真实/示例/导入”；其余字段原样展示，页面不判断业务状态。
function buildDevRows(view: DevView) {
  return [
    { label: 'WASM 路径', value: view.wasmPath },
    { label: 'WASM 预期字节', value: String(view.expectedWasmBytes) },
    { label: 'WASM 预期 SHA256', value: view.expectedWasmSha256 },
    { label: '存储键', value: view.storageKey },
    { label: '存储字节（估算）', value: String(view.storageBytes) },
    { label: 'schemaVersion', value: String(view.schemaVersion) },
    { label: '业务日期', value: view.businessDate },
    {
      label: '菜单来源',
      value: view.catalogSource === 'builtin' ? '内置真实菜单' : view.catalogSource === 'simulated' ? '示例菜单（开发/演示）' : '导入菜单',
    },
    { label: '菜单版本', value: view.menuVersion },
    { label: '日志条数', value: String(view.logCount) },
    { label: '锁定条数', value: String(view.lockCount) },
    { label: '售罄标记', value: String(view.soldOutCount) },
    { label: '规划算法', value: view.algorithm },
  ];
}

Page({
  data: {
    // 外观 class 由 utils/appearance.ts 决定；诊断页也要跟随主题，避免深色下白底刺眼。
    themeClass: 'tk-light',
    loaded: false,
    appName: '',
    envRows: [] as { label: string; value: string }[],
    devRows: [] as { label: string; value: string }[],

    // 规划算法（写入 PlannerSettings；默认贪心，保存后回“今日”刷新方案才调用核心）
    algorithm: 'greedy' as SupportedAlgorithm,
    algorithmLabel: ALGORITHM_LABELS.greedy,
    algorithmOptions: ALGORITHM_OPTIONS,
    algorithmSaving: false,

    // ABI 探针
    // 探针结果保留原始文本与展开状态；展开状态只是 UI，不影响再次运行。
    probeBusy: false,
    probeOk: false,
    probeMessage: '',
    probeRows: [] as { label: string; value: string }[],
    probeRaw: '',
    probeExpanded: false,

    // T02 夹具
    fixtures: buildFixtures(),
    fixtureBusyKey: '',
    // fixtureBusyKey 是“哪个夹具在跑”的字符串；非空时所有夹具按钮都禁用，避免并发调 WASM。

    // 最近一次 Plan 请求 / 响应原文
    // 请求原文来自内存（重启可能为空），响应原文来自本地存储的当前业务日计划；两者语义不同。
    planRequestText: '',
    planResponseText: '',
    planRequestExpanded: false,
    planResponseExpanded: false,

    // 计时（开发者工具/真机四口径；Node 侧四口径见证据 03）
    // 计时四口径：冷启动（本页展示）、核心-only、桥接+复制/释放、页面端到端；Node 四口径在证据 03。
    coldStartText: '—',
    perfBusy: '',
    perfRows: [] as { label: string; value: string }[],
    endToEndProbe: null as any,

    // 清除本机数据
    resetBusy: false,
    // 清库是唯一会写业务数据的入口，仍需二次确认后才调用 store。

    statusText: '',
    statusKind: 'ok', // ok | error
  },

  // 每次显示都重读：得到最新业务日期/日志计数/存储占用，同时刷新“最近一次 Plan”原文。
  // 先 ensureToday 再 getDevView，保证展示的是今天桶的统计。
  onShow() {
    this.setData(applyPageAppearance());
    store().ensureToday();
    this.reload();
    this.loadLastPlanRaw();
  },

  // 冷启动耗时 = launchAtMs（app 模块求值）→ firstHomeAtMs（首页首次 setData 渲染回调）。
  // 两者缺一则显示“未记录”，不拿 0 或本页进入时间冒充冷启动。
  reload() {
    const view = store().getDevView();
    const app: any = getApp();
    const globalData = app && app.globalData ? app.globalData : {};
    const coldStart =
      globalData.firstHomeAtMs && globalData.launchAtMs
        ? `${(globalData.firstHomeAtMs - globalData.launchAtMs).toFixed(2)} ms（JS 启动→首页首次渲染完成）`
        : '未记录（需冷启动后先经过首页再进入本页）';
    this.setData({
      loaded: true,
      appName: view.appName,
      envRows: view.envRows,
      devRows: buildDevRows(view),
      algorithm: view.algorithm as SupportedAlgorithm,
      algorithmLabel: ALGORITHM_LABELS[view.algorithm as SupportedAlgorithm] || view.algorithm,
      coldStartText: coldStart,
    });
  },

  // 保存规划算法：走既有 store.saveSettings（唯一写入路径），非法值仍由 store 明确拒绝。
  // 保存成功会清空当天旧方案；本页只提示，不自动刷新方案，也不判断哪个算法更优。
  onSelectAlgorithm(e: any) {
    if (this.data.algorithmSaving) {
      return;
    }
    const value = String(e.currentTarget.dataset.value) as SupportedAlgorithm;
    const option = ALGORITHM_OPTIONS.find((entry) => entry.value === value);
    if (!option) {
      this.setStatus(`未知算法选项：${value}`, 'error');
      return;
    }
    if (value === this.data.algorithm) {
      this.setStatus(`当前已经是${option.label}算法`, 'ok');
      return;
    }
    this.setData({ algorithmSaving: true });
    const result = store().saveSettings({ algorithm: value });
    this.setData({ algorithmSaving: false });
    if (!result.ok) {
      this.setStatus(result.message, 'error');
      return;
    }
    this.reload();
    this.loadLastPlanRaw();
    this.setStatus(`${result.message}；当前算法：${option.label}`, 'ok');
  },

  /** Plan 请求/响应原文只在内存中保存一份；重启后请求原文可能为空。 */
  // 请求原文只在本次进程内保存（lastPlanRequestText）；响应原文来自本地存储，跨重启仍在。
  loadLastPlanRaw() {
    const appStore = store();
    const requestText = appStore.getLastPlanRequest() || '';
    const responseText = appStore.getLastPlanRaw() || '';
    this.setData({ planRequestText: requestText, planResponseText: responseText });
  },

  // 状态行 + toast；error 才弹 toast，成功只更新状态行，避免频繁打扰。
  setStatus(message: string, kind: string) {
    this.setData({ statusText: message, statusKind: kind });
    if (kind === 'error') {
      wx.showToast({ title: message, icon: 'none' });
    }
  },

  // -------------------------------------------------------------------------
  // ABI 探针
  // -------------------------------------------------------------------------

  // 探针会真实加载 WASM 并执行生命周期/结果块检查；耗时不计入四口径，只作功能验证。
  async onProbe() {
    this.setData({ probeBusy: true, probeMessage: '' });
    const result = await store().probeAbi();
    this.setData({
      probeBusy: false,
      probeOk: result.ok,
      probeMessage: result.message,
      probeRows: result.rows,
      probeRaw: result.rawProbeText,
      probeExpanded: false,
    });
    this.reload();
    this.setStatus(result.message, result.ok ? 'ok' : 'error');
  },

  // 展开/收起只改 UI 状态，不重新请求；原始文本保留用于复制留证。
  onToggleProbeRaw() {
    this.setData({ probeExpanded: !this.data.probeExpanded });
  },

  // 复制走统一 copyText：空内容提示而不是复制空串。
  onCopyProbeRaw() {
    this.copyText(this.data.probeRaw, 'ABI 探针原始结果');
  },

  // -------------------------------------------------------------------------
  // T02 夹具
  // -------------------------------------------------------------------------

  // 同一时间只允许一个夹具运行：fixtureBusyKey 非空时全部按钮禁用（WASM 调用串行）。
  async onRunFixture(e: any) {
    const key = String(e.currentTarget.dataset.key) as FixtureKey;
    const index = this.fixtureIndex(key);
    if (index < 0 || this.data.fixtureBusyKey) {
      return;
    }
    this.setData({ fixtureBusyKey: key });
    const result = await store().runFixture(key);
    this.setData({
      fixtureBusyKey: '',
      [`fixtures[${index}].hasRun`]: true,
      [`fixtures[${index}].ok`]: result.ok,
      [`fixtures[${index}].status`]: result.status,
      [`fixtures[${index}].durationMs`]: result.durationMs,
      [`fixtures[${index}].message`]: result.message,
      [`fixtures[${index}].rawText`]: result.rawText,
      [`fixtures[${index}].expanded`]: false,
    });
    this.setStatus(result.message, result.ok ? 'ok' : 'error');
  },

  // 用 key 反查下标，WXML 只传 key；找不到时返回 -1，调用方放弃操作。
  fixtureIndex(key: string): number {
    const fixtures = this.data.fixtures;
    for (let i = 0; i < fixtures.length; i += 1) {
      if (fixtures[i].key === key) {
        return i;
      }
    }
    return -1;
  },

  // 展开状态按夹具独立保存，展开一个不影响其他夹具。
  onToggleFixtureRaw(e: any) {
    const index = this.fixtureIndex(String(e.currentTarget.dataset.key));
    if (index < 0) {
      return;
    }
    this.setData({ [`fixtures[${index}].expanded`]: !this.data.fixtures[index].expanded });
  },

  // 复制的是该夹具最近一次运行的原始 JSON；未运行过时 rawText 为空，copyText 会提示。
  onCopyFixtureRaw(e: any) {
    const index = this.fixtureIndex(String(e.currentTarget.dataset.key));
    if (index < 0) {
      return;
    }
    this.copyText(this.data.fixtures[index].rawText, `夹具 ${this.data.fixtures[index].key} 原始 JSON`);
  },

  // -------------------------------------------------------------------------
  // 最近一次 Plan 请求 / 响应
  // -------------------------------------------------------------------------

  // 请求/响应共用 data-kind 区分，展开状态互不影响。
  onTogglePlanRaw(e: any) {
    const kind = String(e.currentTarget.dataset.kind);
    if (kind === 'request') {
      this.setData({ planRequestExpanded: !this.data.planRequestExpanded });
      return;
    }
    this.setData({ planResponseExpanded: !this.data.planResponseExpanded });
  },

  // 按 kind 选择复制内容；空内容提示“没有可复制的内容”。
  onCopyPlanRaw(e: any) {
    const kind = String(e.currentTarget.dataset.kind);
    this.copyText(kind === 'request' ? this.data.planRequestText : this.data.planResponseText, kind === 'request' ? 'Plan 请求原文' : 'Plan 响应原文');
  },

  // 统一复制入口：只做剪贴板写入与提示，不改变任何业务状态。
  copyText(text: string, label: string) {
    if (!text) {
      this.setStatus(`${label}为空，没有可复制的内容`, 'error');
      return;
    }
    wx.setClipboardData({
      data: text,
      success: () => {
        this.setStatus(`${label}已复制到剪贴板`, 'ok');
      },
      fail: (error: any) => {
        this.setStatus(`复制失败：${error && error.errMsg ? error.errMsg : String(error)}`, 'error');
      },
    });
  },

  // -------------------------------------------------------------------------
  // 计时（开发者工具 / 真机四口径；Node 侧四口径另存证据 03）
  // -------------------------------------------------------------------------

  // 页面端到端口径：refreshPlan（含核心调用）→ getHomeView → setData 回调（渲染层接收）为结束点；共 5 次。
  // core/bridge 口径交给 store.measurePerformance：前者只计 mp_plan 自身，后者含 UTF-8 编解码与结果块复制/释放。
  // 所有口径都只是测量，不构成“达到性能门槛”的结论；真机/开发者工具证据需另存。
  async onMeasurePerf(e: any) {
    const kind = String(e.currentTarget.dataset.kind);
    if (this.data.perfBusy) {
      return;
    }
    this.setData({ perfBusy: kind });
    try {
      if (kind === 'page') {
        const raw: number[] = [];
        for (let i = 0; i < 5; i += 1) {
          const start = nowMs();
          // 起点在 refreshPlan 之前：包含 store 组装请求与核心调用，代表用户点击“刷新方案”的体感。
          await store().refreshPlan();
          // refreshPlan 可能因 stale 被丢弃；页面端到端仍把这次耗时计入（用户等待真实发生）。
          const view = store().getHomeView();
          // setData 回调表示渲染层已接收本次数据；用它作为“页面端到端”的结束点。
          await new Promise<void>((resolve) => this.setData({ endToEndProbe: view }, () => resolve()));
          raw.push(nowMs() - start);
        }
        const summary = summarize(raw, '页面端到端（refreshPlan+setData 渲染回调）');
        this.setData({ perfRows: summary.rows });
        this.setStatus(summary.message, 'ok');
      } else {
        const isCore = kind === 'core';
        const sample: PerformanceSample = await store().measurePerformance(isCore ? 'core' : 'bridge', 5);
        // 每组固定 5 次；sample 同时返回原始数组，页面只展示统计行与原始值。
        const summary = summarize(sample.raw, isCore ? 'WASM 核心-only' : '桥接+复制/释放');
        this.setData({ perfRows: summary.rows });
        this.setStatus(summary.message, 'ok');
      }
      this.loadLastPlanRaw();
    } catch (error: any) {
      this.setStatus(`计时失败：${error && error.message ? error.message : String(error)}`, 'error');
    } finally {
      this.setData({ perfBusy: '' });
    }
  },

  // -------------------------------------------------------------------------
  // 清除本机数据（二次确认）
  // -------------------------------------------------------------------------

  // 清库不可恢复：先 showModal 二次确认，确认后才调用 store.resetLocalData。
  // 完成后重置本页所有诊断结果（探针/夹具/Plan 原文），避免展示清库前的旧数据。
  onResetLocalData() {
    if (this.data.resetBusy) {
      return;
    }
    wx.showModal({
      title: '清除本机数据',
      content: '将删除本机保存的档案、菜单、日志、锁定与备份记录，且不可恢复。确定清除？',
      confirmText: '清除',
      confirmColor: '#a63a25',
      success: (res: any) => {
        if (!res.confirm) {
          return;
        }
        this.setData({ resetBusy: true });
        const result = store().resetLocalData();
        this.setData({
          resetBusy: false,
          probeOk: false,
          probeMessage: '',
          probeRows: [],
          probeRaw: '',
          fixtures: buildFixtures(),
          planRequestText: '',
          planResponseText: '',
          planRequestExpanded: false,
          planResponseExpanded: false,
        });
        this.reload();
        // reload 重新读空状态；冷启动文本来自 globalData，不因清库重置（只反映本次启动）。
        this.setStatus(result.message, result.ok ? 'ok' : 'error');
      },
    });
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

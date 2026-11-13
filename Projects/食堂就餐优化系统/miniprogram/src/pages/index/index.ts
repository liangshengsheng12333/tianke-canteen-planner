/**
 * pages/index/index.ts — T02 时期的 WASM 联调探针页（历史页，未在 app.json 注册）。
 *
 * 现状：正式入口已迁移到 pages/home；本页保留用于回看 T02 的“夹具 → WASM → 契约包络”联调路径与证据，
 * 不参与 T05 页面口径，也不应作为业务实现参考：它直接调用 core-bridge / mock 夹具，绕过 AppStore。
 * 保留边界：只补注释、不改代码；本页 mock 数据全部为模拟，不构成真实菜单/营养/验收依据。
 */
import { loadCore, probeAbi, callApi } from '../../utils/core-bridge';
import type { Core, Instantiate } from '../../utils/core-bridge';
import { checkPlanCapability } from '../../utils/capability';
import { FIXTURE_CASES, FixtureCase } from '../../mock/simulated-inputs';
// 本页是“直连核心”的历史路径：selectCase → 读 mock 夹具 → 手动检查调用侧子集 → callApi('plan') → 展示原始包络。
// 与正式页面不同，这里没有 AppStore：没有状态持久化/事务/幂等/锁定语义，只用于 ABI 与契约联调。
// 本页所有数据来自 mock/simulated-inputs（模拟夹具），不是真实菜单；页面不得据此宣称营养或预算结论。
// 页面只做字段映射与格式化（extractPlanSummary），不补算任何营养/规划/预算逻辑。

// 代码包内路径
// 固定使用代码包内 WASM 路径；T05 冻结身份（字节/SHA256）由 store 侧核对，本页不做身份校验。
const WASM_PATH = '/assets/wasm/mp_core.wasm';
const MISSING_WASM_PATH = '/assets/wasm/__missing__.wasm';
// 故意不存在的路径：用于验证“加载失败必须显式报错”，不是可用的降级路径。

// 同一份 instantiate 适配器交给 loadCore：小程序用 WXWebAssembly，Node 测试宿主另有注入，页面不写死。
const instantiate: Instantiate = (path, imports) => WXWebAssembly.instantiate(path, imports);

// 默认串行使用同一个 WASM 实例：加载成功后复用
// 若加载失败 core 保持 null，下次点击会重新尝试，避免把一次性失败固化成永久状态。
let core: Core | null = null;

// 统一错误文本：Error.message / errMsg / JSON 三档；本页要把原始错误原样展示给联调者。
function describeError(error: any): string {
  if (error instanceof Error) {
    return error.message;
  }
  if (error && error.errMsg) {
    return error.errMsg;
  }
  return JSON.stringify(error);
}

// 环境行只读展示；wx.getAppBaseInfo/getDeviceInfo 在旧基础库或 Node 宿主可能不存在，统一降级为“未知”。
function readEnvironment() {
  try {
    const app = wx.getAppBaseInfo ? wx.getAppBaseInfo() : {};
    const device = wx.getDeviceInfo ? wx.getDeviceInfo() : {};
    return [
      { label: '基础库 SDKVersion', value: app.SDKVersion || '未知' },
      { label: '微信版本', value: app.version || '未知' },
      { label: '平台', value: device.platform || 'devtools/unknown' },
      { label: '设备型号', value: device.model || '未知' },
      { label: '系统', value: device.system || '未知' },
    ];
  } catch (_e) {
    return [{ label: '环境获取', value: '在模拟测试环境运行' }];
  }
}

Page({
  data: {
    state: 'idle', // idle | loading | ready | error
    // state/stateText 同时驱动状态徽标与按钮禁用；ready 表示 WASM 已加载且探针通过。
    stateText: '未加载',
    errorText: '',
    envRows: [] as object[],

    // 夹具选择
    // 夹具来自 T02 mock 生成物（gen-sim-inputs），四份输入对应四种核心结果分支。
    caseKeys: ['success', 'targetUnavailable', 'invalid', 'resourceLimited'],
    // 夹具 key 顺序必须与 FIXTURE_CASES 的键一致：picker 下标映射到 key，不按夹具名称匹配。
    caseLabels: [
      '成功方案 (OkPartial)',
      '目标不可用 (TargetUnavailable)',
      '非法输入 (INVALID_INPUT)',
      '资源受限 (ResourceLimited)',
    ],
    selectedCaseIndex: 0,
    currentCaseName: '',
    currentCaseDesc: '',
    simRows: [] as object[],
    capabilityText: '',
    capabilityOk: false,

    // ABI 探针
    probeRows: [] as object[],
    probeNote: '',
    // 探针行只做展示；note 为空表示还没跑过，不显示“正常”避免误导。

    // PlanDay 业务执行状态
    planState: 'idle', // idle | running | success | error
    // planState 与上面的 WASM state 分离：加载成功 ≠ 业务请求成功，两个状态不能复用。
    planDurationMs: 0,
    // 成功后才写入耗时；失败/恢复场景保留 0，WXML 只在 success 状态展示。
    planRawText: '',
    planResultEnvelope: null as any,
    planSummary: null as any,
    isRestoredFromStorage: false,
    // isRestoredFromStorage=true 表示展示的是本地快照（旧结果），WXML 会明确标注“已恢复”。
    storageTimestamp: '',
  },

  // onLoad 顺序：环境行 → 默认夹具 → 尝试恢复快照；恢复失败不阻塞页面。
  // 注意：这里不自动加载 WASM，加载/探针/PlanDay 都由用户显式触发。
  onLoad() {
    this.setData({ envRows: readEnvironment() });
    this.applySelectedCase(0);
    // 默认夹具 success：页面一打开就有可运行输入，但不自动请求核心。
    this.tryRestoreFromStorage();
  },

  // 从本地存储恢复上次请求与结果快照（满足重开恢复要求）
  // 快照键名 PLAN_DAY_LAST_SNAPSHOT 是 T02 时期固定键；恢复只用于展示，不写回任何业务状态。
  // 快照损坏/JSON 解析失败时静默忽略：历史页不应因缓存问题挡住页面。
  tryRestoreFromStorage() {
    try {
      if (typeof wx !== 'undefined' && wx.getStorageSync) {
        const snapshot = wx.getStorageSync('PLAN_DAY_LAST_SNAPSHOT');
        if (snapshot && snapshot.respText) {
          const envelope = JSON.parse(snapshot.respText);
          const summary = this.extractPlanSummary(envelope);
          this.setData({
            planState: 'success',
            planDurationMs: snapshot.durationMs || 0,
            planRawText: snapshot.respText,
            planResultEnvelope: envelope,
            planSummary: summary,
            isRestoredFromStorage: true,
            storageTimestamp: snapshot.timestamp || '',
          });
        }
      }
    } catch (_e) {
      // 存储读取失败时不影响正常使用
    }
  },

  // 清除本地快照
  // 清除快照只动 PLAN_DAY_LAST_SNAPSHOT，不影响正式页面的 AppStore 存储键。
  onClearStorage() {
    try {
      if (typeof wx !== 'undefined' && wx.removeStorageSync) {
        wx.removeStorageSync('PLAN_DAY_LAST_SNAPSHOT');
      }
      this.setData({
        isRestoredFromStorage: false,
        storageTimestamp: '',
        planState: 'idle',
        planResultEnvelope: null,
        planSummary: null,
      });
    } catch (_e) {}
  },

  // 切换夹具只重置展示状态，不触发 WASM；真正调用发生在 onRunPlan。
  onCaseChange(e: any) {
    const index = Number(e.detail.value);
    this.applySelectedCase(index);
  },

  // 从 mock 夹具读取请求并做调用侧子集检查（greedy / dp / branchAndBound + comboRules=[]）；检查失败仍可展示，但不应发送。
  // simRows 只展示夹具元信息（文件名/哈希/规模），用于联调时确认选的是哪份输入。
  applySelectedCase(index: number) {
    const key = this.data.caseKeys[index];
    const fixture: FixtureCase = (FIXTURE_CASES as any)[key];
    const req = fixture.request;
    const reason = checkPlanCapability(req);
    // 调用侧先做能力检查（与 store 的 checkCapability 同源），避免把不支持请求发给核心。

    const rows = [
      { label: '夹具文件名', value: fixture.file },
      { label: '夹具哈希', value: fixture.sha256.slice(0, 16) + '…' },
      { label: '菜单版本', value: req.catalog ? req.catalog.menuVersion : '无' },
      {
        label: '菜品 / 报价 / 窗口',
        value: req.catalog ? `${req.catalog.dishes.length} / ${req.catalog.offers.length} / ${req.catalog.windows.length}` : '无',
      },
      { label: '预算（分）', value: req.plannerConfig ? String(req.plannerConfig.budgetCents) : '无' },
      { label: 'algorithm', value: req.plannerConfig ? req.plannerConfig.algorithm : '无' },
      { label: 'maxItemsPerMeal', value: req.plannerConfig ? String(req.plannerConfig.maxItemsPerMeal) : '无' },
      { label: 'comboRules 条数', value: req.catalog && req.catalog.comboRules ? String(req.catalog.comboRules.length) : '0' },
    ];

    this.setData({
      selectedCaseIndex: index,
      currentCaseName: fixture.name,
      currentCaseDesc: fixture.description,
      simRows: rows,
      capabilityText: reason === null ? '符合当前受支持子集（greedy / dp / branchAndBound + comboRules=[]）' : `不受支持：${reason}`,
      capabilityOk: reason === null,
      planState: 'idle',
      planResultEnvelope: null,
      planSummary: null,
    });
  },

  // 首次调用加载并缓存 Core；失败向上抛，由 onProbe/onRunPlan 的 catch 展示错误文本。
  async ensureCore(): Promise<Core> {
    if (core === null) {
      core = await loadCore(instantiate, WASM_PATH);
    }
    return core;
  },

  // 探针只验证 ABI（加载/导出/生命周期/结果块），不执行业务规划；耗时不计入四口径。
  async onProbe() {
    this.setData({ state: 'loading', stateText: '加载中…', errorText: '', probeRows: [], probeNote: '' });
    try {
      const c = await this.ensureCore();
      const probe = probeAbi(c);
      this.setData({
        state: 'ready',
        stateText: 'WASM 已加载，ABI 探针完成',
        probeRows: [
          { label: 'mp_api_version', value: String(probe.apiVersion) },
          { label: 'mp_contract_version（静态指针，不释放）', value: probe.contractVersion },
          { label: '线性内存（探针前 → 后，字节）', value: `${probe.memoryBytesBefore} → ${probe.memoryBytesAfter}` },
          { label: 'mp_alloc → 写入读回 → mp_free', value: `ptr=${probe.allocPtr}，读回${probe.allocWriteReadOk ? '一致' : '不一致'}` },
          { label: '结果块探针（validate-menu 传入 {}）', value: probe.resultBlockProbeText.slice(0, 160) + '…' },
        ],
        probeNote: '探针验证完成：加载、导出、生命周期及结果块协议均正常。',
      });
    } catch (error) {
      this.setData({
        state: 'error',
        stateText: '加载或探针失败',
        errorText: `${describeError(error)}（路径 ${WASM_PATH}）`,
      });
    }
  },

  // 反向用例：用不存在的 WASM 路径验证错误路径必须可见，不能静默降级。
  async onTriggerLoadError() {
    this.setData({ state: 'loading', stateText: '加载中…', errorText: '', probeRows: [], probeNote: '' });
    try {
      await loadCore(instantiate, MISSING_WASM_PATH);
      this.setData({ state: 'error', stateText: '异常：不存在的 WASM 竟然加载成功', errorText: MISSING_WASM_PATH });
    } catch (error) {
      this.setData({
        state: 'error',
        stateText: '已触发预期的加载错误',
        errorText: `${describeError(error)}（路径 ${MISSING_WASM_PATH}）`,
      });
    }
  },

  // 运行 PlanDay 业务请求（阶段 B）
  // PlanDay 直连 core-bridge：JSON 序列化请求 → callApi → 解析包络 → 展示；不经过 store 的预检/修订/幂等。
  // 计时只包住 callApi 本身（不含序列化/渲染），与正式页面的端到端口径不同，不能混用。
  // 结果会写入历史快照方便重开对照；写存储失败不影响本次展示。
  async onRunPlan() {
    const key = this.data.caseKeys[this.data.selectedCaseIndex];
    const fixture: FixtureCase = (FIXTURE_CASES as any)[key];
    this.setData({ planState: 'running', errorText: '', planResultEnvelope: null, planSummary: null });

    try {
      const c = await this.ensureCore();
      const reqText = JSON.stringify(fixture.request);

      const startTime = Date.now();
      // 起点紧贴 callApi：本页耗时是“核心调用耗时”，不是页面端到端。
      const respText = callApi(c, 'plan', reqText);
      const durationMs = Date.now() - startTime;

      const envelope = JSON.parse(respText);
      // 解析失败会进 catch：原始文本已在 planRawText 展示，联调时可对照。
      const summary = this.extractPlanSummary(envelope);
      const nowIso = new Date().toISOString();

      // 持久化存储快照
      // 快照只是联调便利，不属于正式备份格式；清库/换机后不保证存在。
      try {
        if (typeof wx !== 'undefined' && wx.setStorageSync) {
          wx.setStorageSync('PLAN_DAY_LAST_SNAPSHOT', {
            caseKey: key,
            reqText,
            respText,
            durationMs,
            timestamp: nowIso,
          });
        }
      } catch (_e) {}

      this.setData({
        planState: 'success',
        planDurationMs: durationMs,
        planRawText: respText,
        planResultEnvelope: envelope,
        planSummary: summary,
        isRestoredFromStorage: false,
        storageTimestamp: nowIso,
      });
    } catch (error) {
      this.setData({
        planState: 'error',
        errorText: `PlanDay 执行失败: ${describeError(error)}`,
      });
    }
  },

  // 将 C++ WASM 返回的原始包络映射为前端展示结构（仅字段映射与格式化，不补算业务逻辑）
  // 只做字段映射与格式化：isOk/status/预算九字段/三餐条目/参考目标都原样取核心返回值。
  // 契约错误（ok=false）与业务状态（status=TargetUnavailable/ResourceLimited/Ok…）是两个层次，分开展示。
  // 本页不校验营养数值，也不把估算数据（ESTIMATED_DATA）当成真实营养；flags 只展示。
  extractPlanSummary(envelope: any) {
    if (!envelope) return null;
    // 空包络直接返回 null，由 WXML 不渲染结果区，避免显示半截数据。
    if (envelope.ok === false) {
      return {
        isOk: false,
        errorCode: envelope.error ? envelope.error.code : 'UNKNOWN_ERROR',
        fieldPath: envelope.error ? envelope.error.fieldPath : '',
        message: envelope.error ? envelope.error.message : '',
      };
    }

    const r = envelope.result;
    const status = r.status;
    const distinctPlanCount = r.distinctPlanCount || 0;
    const plans = r.plans || [];
    // 只展示第一套方案；distinctPlanCount 明确“不凑三套”，数量不匹配属于核心真实结果。
    const firstPlan = plans[0] || null;

    let budgetSummary: any = null;
    let mealsSummary: any[] = [];
    let flags: string[] = [];
    let planKey = '';
    let offeredAs: string[] = [];

    if (firstPlan) {
    // 以下字段全部来自核心返回；缺字段就留空/“无”，页面不补默认值代替业务结论。
      planKey = firstPlan.planKey || '';
      offeredAs = firstPlan.offeredAs || [];
      flags = firstPlan.flags || [];

      if (firstPlan.budget) {
        const b = firstPlan.budget;
        budgetSummary = {
          budgetCents: b.budgetCents,
          remainingBudgetKnownCents: b.remainingBudgetKnownCents,
          plannedTotalCents: b.plannedTotalCents,
          plannedTotalKnownCents: b.plannedTotalKnownCents,
          priceIncomplete: b.priceIncomplete,
          overBudget: b.overBudget,
          withinBudgetKnownAmounts: b.withinBudgetKnownAmounts,
          overageCents: b.overageCents,
          checkBasis: b.checkBasis,
        };
      }

      if (Array.isArray(firstPlan.meals)) {
      // 三餐条目做扁平字符串展示（dishId/份量/单价），仅为联调可读，不参与任何计算。
        mealsSummary = firstPlan.meals.map((m: any) => ({
          meal: m.meal,
          windowId: m.windowId,
          itemCount: Array.isArray(m.items) ? m.items.length : 0,
          items: Array.isArray(m.items)
            ? m.items.map((it: any) => `${it.dishId} (${it.portionCode}, ￥${(it.priceCents / 100).toFixed(2)})`).join(', ')
            : '',
          refTarget: m.nutritionReferenceTarget
            ? `${m.nutritionReferenceTarget.energyKcal}kcal, 蛋${(m.nutritionReferenceTarget.proteinDg / 10).toFixed(1)}g, 脂${(m.nutritionReferenceTarget.fatDg / 10).toFixed(1)}g, 碳${(m.nutritionReferenceTarget.carbDg / 10).toFixed(1)}g`
            : '无',
        }));
      }
    }

    return {
      isOk: true,
      status,
      distinctPlanCount,
      planKey,
      offeredAs: offeredAs.join(', '),
      flags: flags.join(', ') || '无',
      hasEstimatedFlag: flags.includes('ESTIMATED_DATA'),
      // 估算标志必须保留可见：模拟/估算数据要能被一眼认出，不能伪装成真实营养。
      budgetSummary,
      mealsSummary,
      targetStatus: r.targetStatus || '',
      targetReasons: Array.isArray(r.targetReasons) ? r.targetReasons.join(', ') : '',
      diagnostics: Array.isArray(r.diagnostics) ? r.diagnostics.map((d: any) => d.code).join(', ') : '',
      searchNodesVisited: r.search ? r.search.nodesVisited : null,
      searchLimitReached: r.search ? r.search.limitReached : false,
    };
  },
});

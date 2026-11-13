// test-t05a01b-bnb-chain.mjs — T05A01b「分支限界端到端接入」Node 侧受影响验证。
//
// 输入来源（不猜摘要）：A01a 隔离候选 `Resources\报告\T05A01a-DSH-动态规划接入-证据-v1\candidate\`
//   digest sha256:6fc1c582c3814444d7a918ce0480ef23c85698e052428d4d30eeaa63737e36fc
//   （75 源文件 / 887,403 B；39 工具 / 485,401 B；manifest 由 A01a 卡生成）。
//   本卡复制后、修改前复核 digest 与上述一致；改动仅在本卡 candidate 内。
//
// 边界（先读）：
//   * WASM 是包内冻结的 A18 真实时限核心（111,554 B / B0098453…F3A4AD8），本脚本只加载、不重建；
//   * wx 存储是 mock（Map + 字符串），Node 宿主 + 真实 WASM ≠ 微信开发者工具 / 真机证据；
//   * 只验证本卡受影响链路：设置写入/持久化/备份往返、三算法同输入实发、切换失效与已吃不变、
//     诊断页设置入口、分支限界触限的“未证明最优/未证明无解”语义、前端不复制算法。
//     未覆盖：微信运行时 UI/WXML 渲染、模拟器与真机。
//
// 运行（candidate 根）：
//   node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-t05a01b-bnb-chain.mjs --out <证据目录>
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {
  createMockWx,
  createRealInstantiate,
  environmentInfo,
  importTs,
  readWasmChecked,
  wasmPath,
  WASM_EXPECTED_BYTES,
  WASM_EXPECTED_SHA256,
} from './t05-test-helpers.mjs';

const { AppStore } = await importTs('domain', 'store.ts');
const { interpretPlanResult, flagLabel } = await importTs('domain', 'plan.ts');
const { validateState } = await importTs('domain', 'app-state.ts');
const { canonicalSha256 } = await importTs('utils', 'canonical-json.ts');
const { ALGORITHM_OPTIONS, SUPPORTED_ALGORITHMS, isSupportedAlgorithm } = await importTs('domain', 'types.ts');
const { SIMULATED_CATALOG } = await importTs('config', 'simulated-menu.ts');
const { loadDisplayMode, saveDisplayMode } = await importTs('utils', 'display-mode.ts');
const coreRuntime = await importTs('utils', 'core-runtime.ts');

const STORAGE_KEY = 'tiankeshike:state:v1';
const DATE = '2026-10-24';
const ALGORITHMS = ['greedy', 'dp', 'branchAndBound'];
const A01A_SOURCE = {
  evidenceDir: 'D:\\项目\\cpp\\Projects\\食堂就餐优化系统\\Resources\\报告\\T05A01a-DSH-动态规划接入-证据-v1',
  candidateDigest: 'sha256:6fc1c582c3814444d7a918ce0480ef23c85698e052428d4d30eeaa63737e36fc',
  sourceFileCount: 75,
  sourceBytes: 887403,
  toolFileCount: 39,
  toolBytes: 485401,
};
const wasm = readWasmChecked();
const environment = environmentInfo();

const outIndex = process.argv.indexOf('--out');
const outDir = outIndex >= 0 ? path.resolve(process.argv[outIndex + 1]) : null;
const requestsDir = outDir ? path.join(outDir, 'requests') : null;
if (outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.mkdirSync(requestsDir, { recursive: true });
}
const logLines = [];
function log(line) {
  console.log(line);
  logLines.push(line);
}

function makeClock() {
  let current = new Date(`${DATE}T12:00:00+08:00`).getTime();
  return () => {
    current += 1000;
    return new Date(current);
  };
}

function profileDraft(overrides = {}) {
  return {
    sex: 'male',
    ageYears: 20,
    heightMm: 1750,
    weightGrams: 70000,
    bodyFatPermille: null,
    activityLevel: 'moderate',
    goalType: 'fatLoss',
    manualTargets: null,
    trainingPreference: false,
    dietaryFlags: { pregnancyOrLactation: false, medicalDietManagement: false },
    tastes: [],
    ...overrides,
  };
}

function openStore(mock = createMockWx()) {
  const uninstall = mock.install();
  const store = new AppStore({ instantiate: createRealInstantiate(), wasmPath, now: makeClock() });
  coreRuntime.resetCore();
  const init = store.init();
  return {
    store,
    mock,
    init,
    close() {
      coreRuntime.resetCore();
      uninstall();
    },
  };
}

const currentDay = (store) => {
  const state = store.peekState();
  return state.days[state.activeDate];
};
const currentCatalog = (store) => store.peekState().catalog || SIMULATED_CATALOG;
const planRequestOf = (store) => JSON.parse(store.getLastPlanRequest());

function workspaceFiles(root) {
  const out = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) out.push(full);
    }
  }
  return out;
}

const captures = [];
function writeCaptureFiles(label, requestText, responseText) {
  if (!outDir) return;
  fs.writeFileSync(path.join(requestsDir, `${label}.request.json`), requestText, 'utf8');
  fs.writeFileSync(path.join(requestsDir, `${label}.response.json`), responseText, 'utf8');
}

function capture(label, meta, store) {
  const requestText = store.getLastPlanRequest() || '';
  const responseText = store.getLastPlanRaw() || '';
  const envelope = responseText ? JSON.parse(responseText) : null;
  const state = store.peekState();
  const home = store.getHomeView();
  const search = envelope && envelope.result && envelope.result.search ? envelope.result.search : null;
  const summary = {
    label,
    ...meta,
    requestLength: requestText.length,
    responseLength: responseText.length,
    requestAlgorithm: requestText ? JSON.parse(requestText).plannerConfig.algorithm : null,
    responseAlgorithm: search ? search.algorithm : null,
    responseStatus: envelope && envelope.result ? envelope.result.status : envelope && envelope.error ? envelope.error.code : null,
    searchComplete: search ? search.searchComplete : null,
    candidatesEnumerated: search ? search.candidatesEnumerated : null,
    nodesEvaluated: search ? search.nodesEvaluated : null,
    statesEvaluated: search ? search.statesEvaluated : null,
    capsHit: search ? search.capsHit : null,
    approximations: search ? search.approximations : null,
    planCount: envelope && envelope.result && Array.isArray(envelope.result.plans) ? envelope.result.plans.length : 0,
    requestId: home.requestId,
    home: {
      planState: home.planState,
      planStatus: home.planStatus,
      planStatusLabel: home.planStatusLabel,
      planMessage: home.planMessage,
      plans: home.plans.length,
      flags: home.flags,
      capabilityMessage: home.capabilityMessage,
      meals: home.meals.map((meal) => ({
        meal: meal.meal,
        hasPlan: meal.hasPlan,
        items: meal.items.length,
        confirmed: meal.confirmed,
        planStatus: meal.planStatus,
        windowLocked: meal.windowLocked,
      })),
    },
    settingsAlgorithm: state.settings.algorithm,
  };
  writeCaptureFiles(label, requestText, responseText);
  captures.push(summary);
  return summary;
}

const rows = [];
async function scenario(id, title, fn) {
  const start = performance.now();
  try {
    const detail = await fn();
    rows.push({ id, title, ok: true, detail: detail || {}, durationMs: Number((performance.now() - start).toFixed(3)) });
    log(`[PASS] ${id} ${title}`);
  } catch (error) {
    rows.push({
      id,
      title,
      ok: false,
      error: error && error.message ? error.message : String(error),
      durationMs: Number((performance.now() - start).toFixed(3)),
    });
    log(`[FAIL] ${id} ${title}\n       → ${error && error.message ? error.message : String(error)}`);
  }
}

log('T05A01b 分支限界端到端接入 · Node 侧受影响验证');
log('宿主：Node.js + mock wx 存储 + 包内冻结 WASM；不是微信开发者工具或真机。');
log(`输入候选：A01a ${A01A_SOURCE.candidateDigest}`);
log(`Node ${process.version} / WASM ${wasm.bytesLength} B / ${wasm.sha256}`);
log('');

// ---------------------------------------------------------------------------
// 01 冻结输入、三算法白名单、默认仍贪心
// ---------------------------------------------------------------------------
await scenario('01', '冻结 WASM 身份、三算法白名单（greedy/dp/branchAndBound）、默认仍为 greedy', async () => {
  assert.equal(wasm.bytesLength, WASM_EXPECTED_BYTES, 'WASM 字节数应为冻结值');
  assert.equal(wasm.sha256, WASM_EXPECTED_SHA256, 'WASM SHA256 应为冻结值');
  assert.deepEqual([...SUPPORTED_ALGORITHMS], ALGORITHMS, '当前受支持算法应为 greedy / dp / branchAndBound');
  assert.deepEqual(ALGORITHM_OPTIONS.map((option) => option.value), ALGORITHMS, '设置入口选项顺序应为贪心 → 动态规划 → 分支限界');
  assert.deepEqual(ALGORITHM_OPTIONS.map((option) => option.label), ['贪心', '动态规划', '分支限界'], '选项中文标签应齐备');
  for (const algorithm of ALGORITHMS) {
    assert.equal(isSupportedAlgorithm(algorithm), true, `${algorithm} 应被白名单接受`);
  }
  assert.equal(isSupportedAlgorithm('greedy2'), false, '未知算法应被白名单拒绝');
  const ctx = openStore();
  try {
    assert.equal(ctx.init.ok, true, '首次 init 应成功');
    assert.equal(ctx.store.peekState().settings.algorithm, 'greedy', '默认算法必须是 greedy');
    return {
      wasm: wasm.sha256,
      supported: [...SUPPORTED_ALGORITHMS],
      options: ALGORITHM_OPTIONS,
      defaultAlgorithm: ctx.store.peekState().settings.algorithm,
    };
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 02 设置保存 + 杀进程重开持久化（branchAndBound）
// ---------------------------------------------------------------------------
await scenario('02', '设置保存：saveSettings(branchAndBound) 落盘，杀进程重开后仍为 branchAndBound', async () => {
  const mock = createMockWx();
  const first = openStore(mock);
  let planCleared;
  try {
    first.store.saveProfile(profileDraft());
    assert.equal((await first.store.refreshPlan()).ok, true, '先按默认 greedy 生成一份方案');
    assert.ok(currentDay(first.store).plan, 'greedy 方案应写入当天状态');
    const saved = first.store.saveSettings({ algorithm: 'branchAndBound' });
    assert.equal(saved.ok, true, 'saveSettings({algorithm:"branchAndBound"}) 应成功');
    const state = first.store.peekState();
    assert.equal(state.settings.algorithm, 'branchAndBound', '内存状态应切换为 branchAndBound');
    planCleared = currentDay(first.store).plan === null;
    assert.equal(planCleared, true, '算法变化后旧计划应失效（当天 plan 置空）');
    const raw = mock.raw(STORAGE_KEY);
    assert.match(raw, /"algorithm":"branchAndBound"/, '持久化文本应包含 algorithm":"branchAndBound');
  } finally {
    first.close();
  }
  const second = openStore(mock);
  try {
    assert.equal(second.init.ok, true, '重开 init 应成功');
    assert.match(second.init.message, /已恢复本地数据/, '重开应恢复本地数据');
    assert.equal(second.store.peekState().settings.algorithm, 'branchAndBound', '重开后算法应仍为 branchAndBound');
    assert.equal(second.store.getDevView().algorithm, 'branchAndBound', '诊断视图应回显 branchAndBound');
    return { persisted: 'branchAndBound', initMessage: second.init.message, planCleared };
  } finally {
    second.close();
  }
});

// ---------------------------------------------------------------------------
// 03 备份导出 → 恢复往返不丢已选算法
// ---------------------------------------------------------------------------
await scenario('03', '备份往返：branchAndBound 设置与已吃记录经导出→预检→恢复后逐项一致', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    ctx.store.saveSettings({ algorithm: 'branchAndBound' });
    assert.equal((await ctx.store.refreshPlan()).ok, true, 'branchAndBound 规划应成功');
    ctx.store.confirmMeal('breakfast', {});
    const exported = await ctx.store.exportBackup();
    assert.equal(exported.ok, true, '导出应成功');
    const pre = await ctx.store.preflightRestore(exported.text);
    assert.equal(pre.ok, true, '备份应通过预检（含 branchAndBound 算法值）');
    const applied = await ctx.store.applyRestore(pre);
    assert.equal(applied.ok, true, '恢复应成功');
    assert.equal(applied.comparison.length, 8, '对照应为 8 行');
    assert.equal(applied.comparison.filter((row) => !row.equal).length, 0, '8 行对照应全部相等（不丢数据）');
    assert.equal(applied.digest, exported.digest, '恢复摘要应等于导出摘要');
    assert.equal(ctx.store.peekState().settings.algorithm, 'branchAndBound', '恢复后算法应仍为 branchAndBound');
    assert.equal(ctx.store.getLogsView().meals[0].active.length, 1, '恢复后已吃记录应在');
    return { digest: exported.digest, comparisonRows: applied.comparison.length, algorithm: ctx.store.peekState().settings.algorithm };
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 04 非法算法明确拒绝（保存 / 载入 / 备份三条边界）
// ---------------------------------------------------------------------------
await scenario('04', '非法算法明确拒绝：saveSettings、状态载入、备份恢复都不静默降级', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    for (const algorithm of ['dynamicProgramming', 'greedy2']) {
      const result = ctx.store.saveSettings({ algorithm });
      assert.equal(result.ok, false, `${algorithm} 应被 saveSettings 拒绝`);
      assert.match(result.message, /只支持 greedy \/ dp \/ branchAndBound/, '拒绝原因应写明三算法范围');
      assert.ok(result.message.includes(algorithm), '拒绝原因应回显实际值');
    }
    assert.equal(ctx.store.peekState().settings.algorithm, 'greedy', '被拒绝后设置不得改变');

    const mock = createMockWx();
    const seed = openStore(mock);
    const corrupt = seed.store.peekState();
    seed.close();
    corrupt.settings.algorithm = 'dynamicProgramming';
    mock.storage.set(STORAGE_KEY, JSON.stringify(corrupt));
    const validated = validateState(corrupt);
    assert.equal(validated.ok, false, 'validateState 应拒绝非法 algorithm');
    assert.match(validated.message, /settings\.algorithm 只能是 greedy \/ dp \/ branchAndBound/, '拒绝原因应可读');
    const reboot = openStore(mock);
    try {
      assert.equal(reboot.init.ok, false, '含非法算法的本地状态不得被当成正常数据恢复');
      assert.match(reboot.init.message, /algorithm 只能是 greedy \/ dp \/ branchAndBound/, '冷启动消息应指向 algorithm 字段');
    } finally {
      reboot.close();
    }

    const backupCtx = openStore();
    try {
      backupCtx.store.saveProfile(profileDraft());
      backupCtx.store.saveSettings({ algorithm: 'branchAndBound' });
      const exported = await backupCtx.store.exportBackup();
      const tampered = JSON.parse(exported.text);
      tampered.state.settings.algorithm = 'dynamicProgramming';
      tampered.digest = canonicalSha256(tampered.state);
      const pre = await backupCtx.store.preflightRestore(JSON.stringify(tampered));
      assert.equal(pre.ok, false, '含非法 algorithm 的备份不得通过预检');
      assert.match(pre.message, /algorithm 只能是 greedy \/ dp \/ branchAndBound/, '备份预检消息应指向 algorithm 字段');
      assert.equal(backupCtx.store.peekState().settings.algorithm, 'branchAndBound', '被拒绝的备份不得改动当前设置');
    } finally {
      backupCtx.close();
    }
    return { rejected: ['dynamicProgramming', 'greedy2'], rebootInitOk: false, backupRejected: true };
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 05 三算法同输入实发：同一份基础状态，仅 algorithm 不同
// ---------------------------------------------------------------------------
await scenario('05', '三算法同输入实发：greedy / dp / branchAndBound 各发一单，真实 WASM 回显对应算法', async () => {
  const base = openStore();
  let baseText;
  try {
    base.store.saveProfile(profileDraft());
    const exported = await base.store.exportBackup();
    assert.equal(exported.ok, true, '基础状态应可导出');
    baseText = exported.text;
  } finally {
    base.close();
  }

  const perAlgorithm = [];
  const requestTexts = {};
  for (const algorithm of ALGORITHMS) {
    const ctx = openStore();
    try {
      const pre = await ctx.store.preflightRestore(baseText);
      assert.equal(pre.ok, true, `三算法同输入：${algorithm} 前恢复基础状态应通过预检`);
      assert.equal((await ctx.store.applyRestore(pre)).ok, true, `三算法同输入：${algorithm} 前恢复基础状态应成功`);
      assert.equal(ctx.store.peekState().settings.algorithm, 'greedy', '基础状态默认算法应为 greedy（随后仅切算法）');
      assert.equal(ctx.store.saveSettings({ algorithm }).ok, true, `应能保存 ${algorithm}`);
      const outcome = await ctx.store.refreshPlan();
      assert.equal(outcome.ok, true, `${algorithm} 规划应成功`);
      const request = planRequestOf(ctx.store);
      assert.equal(request.plannerConfig.algorithm, algorithm, `请求应携带 algorithm=${algorithm}`);
      requestTexts[algorithm] = ctx.store.getLastPlanRequest();
      // 结果必须来自冻结 WASM：同一请求原文重放，响应逐字节一致。
      await ctx.store.ensureCoreLoaded();
      const replay = coreRuntime.callCore('plan', ctx.store.getLastPlanRequest());
      assert.equal(replay, ctx.store.getLastPlanRaw(), `重放同一 ${algorithm} 请求的响应应与已落盘响应逐字节一致`);
      const captured = capture(
        `${algorithm}-same-input`,
        {
          entry: 'store.refreshPlan（首页“刷新方案”同一路径；三份请求来自同一份基础状态，仅 algorithm 不同）',
          input: '内置模拟菜单 menu-simulated-v2 + 同一档案/日期',
          algorithmOption: algorithm,
        },
        ctx.store,
      );
      assert.equal(captured.responseAlgorithm, algorithm, `核心响应 search.algorithm 应为 ${algorithm}（真实执行）`);
      assert.ok(captured.planCount > 0, `${algorithm} 首页应展示方案`);
      assert.ok(captured.home.plans > 0, `${algorithm} 首页视图应有方案摘要`);
      perAlgorithm.push({
        algorithm,
        status: captured.responseStatus,
        searchComplete: captured.searchComplete,
        statesEvaluated: captured.statesEvaluated,
        nodesEvaluated: captured.nodesEvaluated,
        planCount: captured.planCount,
        requestId: captured.requestId,
      });
    } finally {
      ctx.close();
    }
  }
  assert.equal(perAlgorithm.length, 3, '三算法应各有一份请求/响应');
  // 三份请求除 algorithm 字段外必须完全一致（同输入证明）。
  const normalize = (text) => {
    const value = JSON.parse(text);
    value.plannerConfig.algorithm = 'ALGORITHM';
    return JSON.stringify(value);
  };
  const greedyText = requestTexts.greedy;
  const dpText = requestTexts.dp;
  const bnbText = requestTexts.branchAndBound;
  assert.equal(normalize(dpText), normalize(greedyText), 'dp 与 greedy 请求除 algorithm 外应完全一致');
  assert.equal(normalize(bnbText), normalize(greedyText), 'branchAndBound 与 greedy 请求除 algorithm 外应完全一致');
  return { perAlgorithm, sameInputBeyondAlgorithm: true };
});

// ---------------------------------------------------------------------------
// 06 切换设置：旧推荐按既有规则失效，已吃记录不变
// ---------------------------------------------------------------------------
await scenario('06', '切换算法：旧推荐失效（当天 plan 置空），已吃记录原样保留，重算跳过已吃餐次', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    assert.equal((await ctx.store.refreshPlan()).ok, true, '先按 greedy 生成方案');
    assert.equal(ctx.store.confirmMeal('breakfast', {}).ok, true, '早餐确认应成功');
    const logsBefore = currentDay(ctx.store).logs.map((entry) => entry.recordId);
    assert.equal(logsBefore.length, 1, '已吃记录应有 1 条');
    const activeBefore = ctx.store.getLogsView().meals[0].active.length;

    for (const algorithm of ['branchAndBound', 'dp']) {
      const saved = ctx.store.saveSettings({ algorithm });
      assert.equal(saved.ok, true, `切换到 ${algorithm} 应成功`);
      assert.equal(ctx.store.peekState().settings.algorithm, algorithm, `设置应为 ${algorithm}`);
      assert.equal(currentDay(ctx.store).plan, null, `切换到 ${algorithm} 后旧推荐应失效（当天 plan 置空）`);
      const logsAfter = currentDay(ctx.store).logs.map((entry) => entry.recordId);
      assert.deepEqual(logsAfter, logsBefore, `切换到 ${algorithm} 不得改动已吃记录`);
      assert.equal(ctx.store.getLogsView().meals[0].active.length, activeBefore, '已吃记录条数应不变');
      assert.equal(ctx.store.getHomeView().meals[0].confirmed, true, '首页早餐应保持已确认');
    }

    assert.equal((await ctx.store.refreshPlan()).ok, true, '切到 dp 后重算应成功');
    const request = planRequestOf(ctx.store);
    assert.equal(request.plannerConfig.algorithm, 'dp', '重算请求应为 dp');
    assert.deepEqual(request.planningMeals, ['lunch', 'dinner'], '已吃早餐不得再次列入 planningMeals');
    assert.ok(request.state.activeLogs.some((entry) => entry.meal === 'breakfast'), '已吃记录必须随 activeLogs 发给核心');
    const envelope = JSON.parse(ctx.store.getLastPlanRaw());
    assert.ok(!envelope.result.plans[0].meals.some((meal) => meal.meal === 'breakfast'), '重算响应不得给已吃早餐出推荐');
    const captured = capture('dp-after-algorithm-switch', { entry: '切换 greedy→branchAndBound→dp 后重算', input: '内置模拟菜单 menu-simulated-v2', algorithmOption: 'dp' }, ctx.store);
    return { logsKept: logsBefore, planningMeals: request.planningMeals, status: captured.responseStatus };
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 07 诊断页设置入口（真实 Page 处理器）：3 个选项，简易/完整模式共用
// ---------------------------------------------------------------------------
await scenario('07', '诊断页设置入口：3 个算法选项，onSelectAlgorithm 写设置，简易/完整模式互不覆盖', async () => {
  const ctx = openStore();
  const prevPage = globalThis.Page;
  const prevGetApp = globalThis.getApp;
  const pageOptions = [];
  globalThis.Page = (options) => pageOptions.push(options);
  globalThis.getApp = () => ({ globalData: { store: ctx.store } });
  try {
    await importTs('pages', 'dev', 'index.ts');
    const options = pageOptions[pageOptions.length - 1];
    assert.ok(options && typeof options.onSelectAlgorithm === 'function', '诊断页应注册 onSelectAlgorithm');
    assert.equal(options.data.algorithmOptions.length, 3, '诊断页应有 3 个算法选项');
    const page = {
      ...options,
      data: structuredClone(options.data),
      setData(update, callback) {
        for (const [key, value] of Object.entries(update)) {
          this.data[key] = value;
        }
        if (typeof callback === 'function') callback();
      },
    };
    page.reload();
    assert.equal(page.data.algorithm, 'greedy', '重读后算法应为 greedy');

    assert.equal(saveDisplayMode('full'), true, '完整模式应可保存');
    page.onSelectAlgorithm({ currentTarget: { dataset: { value: 'branchAndBound' } } });
    assert.equal(ctx.store.peekState().settings.algorithm, 'branchAndBound', '页面入口应把 branchAndBound 写入设置');
    assert.equal(page.data.algorithm, 'branchAndBound', '页面状态应刷新为 branchAndBound');
    assert.match(page.data.statusText, /设置已保存/, '页面应提示设置已保存');
    assert.equal(loadDisplayMode(), 'full', '保存算法不得改变显示模式');

    assert.equal(saveDisplayMode('simple'), true, '简易模式应可保存');
    page.onSelectAlgorithm({ currentTarget: { dataset: { value: 'greedy' } } });
    assert.equal(ctx.store.peekState().settings.algorithm, 'greedy', '页面入口应可切回贪心');
    assert.equal(loadDisplayMode(), 'simple', '切换算法不得改变显示模式');

    page.onSelectAlgorithm({ currentTarget: { dataset: { value: 'dynamicProgramming' } } });
    assert.equal(ctx.store.peekState().settings.algorithm, 'greedy', '非法算法不得写入设置');
    assert.match(page.data.statusText, /未知算法选项/, '非法选项应给出可见提示');
    return { pageEntry: 'onSelectAlgorithm', optionCount: 3, selectedBranchAndBound: true, displayModePreserved: true };
  } finally {
    globalThis.Page = prevPage;
    globalThis.getApp = prevGetApp;
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 08 分支限界触搜索限额：不称全局最优，也不称已证明无解
// ---------------------------------------------------------------------------
await scenario('08', '分支限界触限：压低真实请求 limits 触发 maxSearchNodes，前端只标限额/未证明，不称最优或证明无解', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    assert.equal(ctx.store.saveSettings({ algorithm: 'branchAndBound' }).ok, true, '应能保存 branchAndBound');
    assert.equal((await ctx.store.refreshPlan()).ok, true, 'branchAndBound 规划应成功');
    const liveRequest = JSON.parse(ctx.store.getLastPlanRequest());
    assert.equal(liveRequest.plannerConfig.algorithm, 'branchAndBound', '用于触限的请求必须是 branchAndBound 真实请求');
    // 只改限额（其余字段与生产构造逐字一致），用于观察核心的限额标记；生产请求构造不变。
    const limitedRequest = structuredClone(liveRequest);
    limitedRequest.plannerConfig.limits = {
      maxMealCandidatesPerMeal: 64,
      maxDpStates: 1,
      maxSearchNodes: 3,
      wallClockMs: null,
    };
    await ctx.store.ensureCoreLoaded();
    const rawLimited = coreRuntime.callCore('plan', JSON.stringify(limitedRequest));
    const envelope = JSON.parse(rawLimited);
    assert.equal(envelope.ok, true, '压低限额的合法请求不应被契约层拒绝');
    const search = envelope.result.search;
    assert.equal(search.algorithm, 'branchAndBound', '核心回显 algorithm 应为 branchAndBound');
    assert.ok(Array.isArray(search.capsHit) && search.capsHit.some((entry) => entry.limit === 'maxSearchNodes'), '核心应记录 maxSearchNodes 限额命中');
    assert.equal(search.searchComplete, false, '触限时 searchComplete 必须为 false（未完成全局最优性证明）');
    const interpretation = interpretPlanResult(envelope, ctx.store.peekState(), currentDay(ctx.store), currentCatalog(ctx.store));
    const status = envelope.result.status;
    const mappedFlags = interpretation.plans.flatMap((plan) => plan.flags).concat(interpretation.flags);
    const mappedText = JSON.stringify({ label: interpretation.statusLabel, message: interpretation.message, flags: mappedFlags });
    assert.equal(flagLabel('SEARCH_LIMIT_REACHED'), '触及搜索限额', '前端应把 SEARCH_LIMIT_REACHED 映射为可读限额提示');
    assert.ok(!/已证明最优|证明全局最优|保证最优/.test(mappedText), '触限时前端不得声称已证明最优');
    if (status === 'ResourceLimited') {
      assert.match(interpretation.statusLabel, /触及搜索限额/, 'ResourceLimited 应标“触及搜索限额”');
      assert.match(interpretation.message, /不能声称最优/, '前端必须说明不能声称最优');
      assert.match(interpretation.message, /不等于证明无解/, '前端必须说明不等于证明无解');
    } else {
      assert.ok(mappedFlags.includes('触及搜索限额'), '有方案时应显示“触及搜索限额”标志');
      assert.match(interpretation.message, /限制标志/, '有方案时应提示查看限制标志');
      assert.ok(!/已证明无解/.test(interpretation.message), '有方案时不得声称已证明无解');
    }
    writeCaptureFiles('branchAndBound-limit', JSON.stringify(limitedRequest), rawLimited);
    captures.push({
      label: 'branchAndBound-limit',
      entry: 'store.refreshPlan 的真实 branchAndBound 请求 + 验证脚本仅压低 plannerConfig.limits 后经同一 core-runtime 桥调用',
      input: '内置模拟菜单 menu-simulated-v2（limits: maxSearchNodes=3 / maxDpStates=1）',
      requestAlgorithm: 'branchAndBound',
      responseAlgorithm: search.algorithm,
      responseStatus: status,
      searchComplete: search.searchComplete,
      candidatesEnumerated: search.candidatesEnumerated,
      nodesEvaluated: search.nodesEvaluated,
      statesEvaluated: search.statesEvaluated,
      capsHit: search.capsHit,
      approximations: search.approximations,
      planCount: interpretation.plans.length,
      mappedStatusLabel: interpretation.statusLabel,
      mappedFlags,
      mappedMessage: interpretation.message,
    });
    return { status, searchComplete: search.searchComplete, capsHit: search.capsHit, mappedStatusLabel: interpretation.statusLabel };
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 09 前端不复制算法：src 无 C++ 算法符号/无新增业务文件
// ---------------------------------------------------------------------------
await scenario('09', '前端不复制算法：src 无 C++ 算法符号/无新增业务文件，结果仅来自 WASM 原文', async () => {
  const srcRoot = path.resolve('miniprogram', 'src');
  const files = workspaceFiles(srcRoot);
  assert.equal(files.length, 75, 'candidate 源码文件数应与基线 75 一致（未新增业务文件）');
  const tsFiles = files.filter((file) => file.endsWith('.ts'));
  const markers = ['RunDpAlgorithm', 'RunBranchAndBound', 'RecurseBranchAndBound', 'DpExactDominates', 'EnumerateMealCandidates', 'BranchAndBoundNode'];
  const hits = [];
  for (const file of tsFiles) {
    const text = fs.readFileSync(file, 'utf8');
    for (const marker of markers) {
      if (text.includes(marker)) {
        hits.push(`${path.relative(srcRoot, file).split(path.sep).join('/')}:${marker}`);
      }
    }
  }
  assert.deepEqual(hits, [], '前端源码不得出现核心算法实现符号');
  const planFields = tsFiles.filter((file) => fs.readFileSync(file, 'utf8').includes('plannerConfig'));
  return {
    srcFileCount: files.length,
    algorithmImplementationHits: hits,
    filesMentioningPlannerConfig: planFields.map((file) => path.relative(srcRoot, file).split(path.sep).join('/')),
  };
});

// ---------------------------------------------------------------------------
// 10 分支限界触限且无方案：明确“触及搜索限额/未证明无解”，不冒充无解
// ---------------------------------------------------------------------------
await scenario('10', '分支限界触限无方案：ResourceLimited 标“触及搜索限额（未证明无解）”，不称已证明无解', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    assert.equal(ctx.store.saveSettings({ algorithm: 'branchAndBound' }).ok, true, '应能保存 branchAndBound');
    assert.equal((await ctx.store.refreshPlan()).ok, true, 'branchAndBound 规划应成功');
    const liveRequest = JSON.parse(ctx.store.getLastPlanRequest());
    const limitedRequest = structuredClone(liveRequest);
    limitedRequest.plannerConfig.limits = {
      maxMealCandidatesPerMeal: 64,
      maxDpStates: 1,
      maxSearchNodes: 2,
      wallClockMs: null,
    };
    await ctx.store.ensureCoreLoaded();
    const rawLimited = coreRuntime.callCore('plan', JSON.stringify(limitedRequest));
    const envelope = JSON.parse(rawLimited);
    assert.equal(envelope.ok, true, '合法请求不应被契约层拒绝');
    const search = envelope.result.search;
    assert.equal(search.algorithm, 'branchAndBound', '核心回显 algorithm 应为 branchAndBound');
    assert.equal(envelope.result.status, 'ResourceLimited', '节点限额极小且无 incumbent 时应为 ResourceLimited');
    assert.equal(envelope.result.plans.length, 0, 'ResourceLimited 不应产生方案');
    assert.equal(search.searchComplete, false, '触限时 searchComplete 必须为 false');
    assert.ok(search.capsHit.some((entry) => entry.limit === 'maxSearchNodes'), '核心应记录 maxSearchNodes 限额命中');
    const interpretation = interpretPlanResult(envelope, ctx.store.peekState(), currentDay(ctx.store), currentCatalog(ctx.store));
    assert.match(interpretation.statusLabel, /触及搜索限额/, '状态标签应指明触及搜索限额');
    assert.match(interpretation.statusLabel, /未证明无解/, '状态标签必须写明未证明无解');
    assert.match(interpretation.message, /不能声称最优/, '消息必须说明不能声称最优');
    assert.match(interpretation.message, /不等于证明无解/, '消息必须说明不等于证明无解');
    assert.ok(!/已证明无解|确实无解|保证最优/.test(interpretation.message), '不得冒充已证明无解或保证最优');
    writeCaptureFiles('branchAndBound-resource-limited', JSON.stringify(limitedRequest), rawLimited);
    captures.push({
      label: 'branchAndBound-resource-limited',
      entry: 'store.refreshPlan 的真实 branchAndBound 请求 + 验证脚本仅压低 plannerConfig.limits 后经同一 core-runtime 桥调用',
      input: '内置模拟菜单 menu-simulated-v2（limits: maxSearchNodes=2 / maxDpStates=1）',
      requestAlgorithm: 'branchAndBound',
      responseAlgorithm: search.algorithm,
      responseStatus: envelope.result.status,
      searchComplete: search.searchComplete,
      capsHit: search.capsHit,
      planCount: 0,
      mappedStatusLabel: interpretation.statusLabel,
      mappedMessage: interpretation.message,
    });
    return { status: envelope.result.status, searchComplete: search.searchComplete, capsHit: search.capsHit, mappedStatusLabel: interpretation.statusLabel };
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 汇总与证据落盘
// ---------------------------------------------------------------------------
const passed = rows.filter((row) => row.ok).length;
const failed = rows.length - passed;
log('');
log('='.repeat(92));
log(`T05A01b 受影响验证（Node ${process.version} 宿主 + 冻结 WASM；非微信/非真机）`);
log('='.repeat(92));
for (const row of rows) {
  log(`${row.id.padEnd(4)}${(row.ok ? 'PASS' : 'FAIL').padEnd(8)}${String(row.durationMs).padEnd(12)}${row.title}`);
}
log('-'.repeat(92));
log(`合计：${passed} / ${rows.length} 通过，${failed} 失败`);
if (failed > 0) {
  log('');
  log('失败明细：');
  for (const row of rows.filter((entry) => !entry.ok)) {
    log(`  ${row.id} ${row.title}\n     ${row.error}`);
  }
}

if (outDir) {
  fs.writeFileSync(path.join(outDir, 'test-run.log'), logLines.join('\n') + '\n', 'utf8');
  fs.writeFileSync(
    path.join(outDir, 'result.json'),
    JSON.stringify(
      {
        tool: 'test-t05a01b-bnb-chain.mjs',
        scope: 'Node.js 宿主 + mock wx 存储 + 包内冻结 WASM；不代表微信开发者工具/真机',
        card: 'T05A01b-DSH-分支限界端到端接入小卡-v1',
        provenance: {
          sourceAntecedent: 'T05A01a DSH 动态规划端到端接入（Lead 已核）',
          sourceEvidenceDir: A01A_SOURCE.evidenceDir,
          sourceCandidateDigest: A01A_SOURCE.candidateDigest,
          sourceCounts: { sourceFileCount: A01A_SOURCE.sourceFileCount, sourceBytes: A01A_SOURCE.sourceBytes, toolFileCount: A01A_SOURCE.toolFileCount, toolBytes: A01A_SOURCE.toolBytes },
          copyCheck: '复制到本卡 candidate 后、修改前复核 digest 与 A01a manifest 一致（本卡反馈第 2 节记录）',
        },
        environment,
        wasm: { path: wasmPath, bytes: wasm.bytesLength, sha256: wasm.sha256, expectedBytes: WASM_EXPECTED_BYTES, expectedSha256: WASM_EXPECTED_SHA256 },
        scenarios: rows,
        captures,
        passed,
        failed,
        total: rows.length,
        timestamp: new Date().toISOString(),
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );
}
process.exit(failed === 0 ? 0 : 1);
// test-t05a01a-dp-chain.mjs — T05A01a「动态规划端到端接入」Node 侧受影响验证。
//
// 边界（先读）：
//   * WASM 是包内冻结的 A18 真实时限核心（111,554 字节 / B0098453…F3A4AD8），本脚本只加载、不重建；
//   * wx 存储是 mock（Map + 字符串），Node 宿主 + 真实 WASM ≠ 微信开发者工具 / 真机证据；
//   * 只验证本卡受影响链路：设置写入/持久化/备份往返、非法算法拒绝、greedy 与 dp 的真实
//     请求与响应、DP 触限的前端标记、已吃与锁定保护、诊断页设置入口、前端不复制算法。
//     未覆盖：微信运行时 UI、WXML 渲染、模拟器与真机。
//
// 运行（candidate 根）：
//   node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-t05a01a-dp-chain.mjs --out <证据目录>
//
// 证据落盘（--out 目录下）：test-run.log / result.json / requests/*.request.json|*.response.json
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
const { checkPlanCapability } = await importTs('utils', 'capability.ts');
const { ALGORITHM_OPTIONS, SUPPORTED_ALGORITHMS, isSupportedAlgorithm } = await importTs('domain', 'types.ts');
const { WEST1_MENU_CATALOG } = await importTs('config', 'west1-menu.ts');
const { SIMULATED_CATALOG } = await importTs('config', 'simulated-menu.ts');
const { loadDisplayMode, saveDisplayMode } = await importTs('utils', 'display-mode.ts');
const coreRuntime = await importTs('utils', 'core-runtime.ts');

const STORAGE_KEY = 'tiankeshike:state:v1';
const DATE = '2026-10-24';
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
function capture(label, meta, store, extra = {}) {
  const requestText = store.getLastPlanRequest() || '';
  const responseText = store.getLastPlanRaw() || '';
  const envelope = responseText ? JSON.parse(responseText) : null;
  const state = store.peekState();
  const day = currentDay(store);
  const home = store.getHomeView();
  const summary = {
    label,
    ...meta,
    requestLength: requestText.length,
    responseLength: responseText.length,
    requestAlgorithm: requestText ? JSON.parse(requestText).plannerConfig.algorithm : null,
    responseAlgorithm: envelope && envelope.result && envelope.result.search ? envelope.result.search.algorithm : null,
    responseStatus: envelope && envelope.result ? envelope.result.status : envelope && envelope.error ? envelope.error.code : null,
    searchComplete: envelope && envelope.result && envelope.result.search ? envelope.result.search.searchComplete : null,
    capsHit: envelope && envelope.result && envelope.result.search ? envelope.result.search.capsHit : null,
    approximations: envelope && envelope.result && envelope.result.search ? envelope.result.search.approximations : null,
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
    ...extra,
  };
  if (outDir) {
    fs.writeFileSync(path.join(requestsDir, `${label}.request.json`), requestText, 'utf8');
    fs.writeFileSync(path.join(requestsDir, `${label}.response.json`), responseText, 'utf8');
  }
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

log('T05A01a 动态规划端到端接入 · Node 侧受影响验证');
log('宿主：Node.js + mock wx 存储 + 包内冻结 WASM；不是微信开发者工具或真机。');
log(`Node ${process.version} / WASM ${wasm.bytesLength} B / ${wasm.sha256}`);
log('');

// ---------------------------------------------------------------------------
// 01 冻结输入与默认设置
// ---------------------------------------------------------------------------
await scenario('01', '冻结 WASM 身份、当前受支持三算法白名单、默认仍为 greedy', async () => {
  assert.equal(wasm.bytesLength, WASM_EXPECTED_BYTES, 'WASM 字节数应为冻结值');
  assert.equal(wasm.sha256, WASM_EXPECTED_SHA256, 'WASM SHA256 应为冻结值');
  assert.deepEqual([...SUPPORTED_ALGORITHMS], ['greedy', 'dp', 'branchAndBound'], '当前受支持算法应为 greedy / dp / branchAndBound');
  assert.deepEqual(ALGORITHM_OPTIONS.map((option) => option.value), ['greedy', 'dp', 'branchAndBound'], '设置入口选项顺序应为贪心 → 动态规划 → 分支限界');
  assert.equal(isSupportedAlgorithm('dp'), true, 'dp 应被白名单接受');
  assert.equal(isSupportedAlgorithm('branchAndBound'), true, 'branchAndBound 应被白名单接受');
  assert.equal(isSupportedAlgorithm('greedy2'), false, '未知算法应被白名单拒绝');
  const ctx = openStore();
  try {
    assert.equal(ctx.init.ok, true, '首次 init 应成功');
    assert.equal(ctx.store.peekState().settings.algorithm, 'greedy', '默认算法必须是 greedy');
    const options = { algorithmOptions: ALGORITHM_OPTIONS, labels: ALGORITHM_OPTIONS.map((option) => option.label) };
    return { wasm: wasm.sha256, supported: [...SUPPORTED_ALGORITHMS], defaultAlgorithm: ctx.store.peekState().settings.algorithm, options };
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 02 设置保存 + 杀进程重开持久化
// ---------------------------------------------------------------------------
await scenario('02', '设置保存：saveSettings(dp) 落盘，杀进程重开后仍为 dp', async () => {
  const mock = createMockWx();
  const first = openStore(mock);
  let firstState;
  try {
    first.store.saveProfile(profileDraft());
    assert.equal((await first.store.refreshPlan()).ok, true, '先按默认 greedy 生成一份方案');
    assert.ok(currentDay(first.store).plan, 'greedy 方案应写入当天状态');
    const saved = first.store.saveSettings({ algorithm: 'dp' });
    assert.equal(saved.ok, true, 'saveSettings({algorithm:"dp"}) 应成功');
    firstState = first.store.peekState();
    assert.equal(firstState.settings.algorithm, 'dp', '内存状态应切换为 dp');
    assert.equal(currentDay(first.store).plan, null, '算法变化后旧计划应失效（当天 plan 置空）');
    const raw = mock.raw(STORAGE_KEY);
    assert.match(raw, /"algorithm":"dp"/, '持久化文本应包含 algorithm":"dp');
  } finally {
    first.close();
  }
  const second = openStore(mock);
  try {
    assert.equal(second.init.ok, true, '重开 init 应成功');
    assert.match(second.init.message, /已恢复本地数据/, '重开应恢复本地数据');
    assert.equal(second.store.peekState().settings.algorithm, 'dp', '重开后算法应仍为 dp');
    return { persisted: 'dp', initMessage: second.init.message, planCleared: firstState.days[firstState.activeDate].plan === null };
  } finally {
    second.close();
  }
});

// ---------------------------------------------------------------------------
// 03 备份导出 → 恢复往返不丢
// ---------------------------------------------------------------------------
await scenario('03', '备份往返：dp 设置与已吃/锁定数据经导出→预检→恢复后逐项一致', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    ctx.store.saveSettings({ algorithm: 'dp' });
    await ctx.store.refreshPlan();
    ctx.store.confirmMeal('breakfast', {});
    const exported = await ctx.store.exportBackup();
    assert.equal(exported.ok, true, '导出应成功');
    const before = ctx.store.peekState();
    const pre = await ctx.store.preflightRestore(exported.text);
    assert.equal(pre.ok, true, '备份应通过预检（含 dp 算法值）');
    const applied = await ctx.store.applyRestore(pre);
    assert.equal(applied.ok, true, '恢复应成功');
    assert.equal(applied.comparison.length, 8, '对照应为 8 行');
    assert.equal(applied.comparison.filter((row) => !row.equal).length, 0, '8 行对照应全部相等（不丢数据）');
    assert.equal(applied.digest, exported.digest, '恢复摘要应等于导出摘要');
    assert.equal(ctx.store.peekState().settings.algorithm, 'dp', '恢复后算法应仍为 dp');
    assert.equal(ctx.store.getLogsView().meals[0].active.length, 1, '恢复后已吃记录应在');
    assert.equal(currentDay(ctx.store).logs.length, before.days[before.activeDate].logs.length, '恢复后日志条数应一致');
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
    const bogus = ctx.store.saveSettings({ algorithm: 'dynamicProgramming' });
    assert.equal(bogus.ok, false, 'dynamicProgramming 应被 saveSettings 拒绝');
    assert.match(bogus.message, /只支持 greedy \/ dp/, '拒绝原因应写明受支持范围');
    assert.match(bogus.message, /dynamicProgramming/, '拒绝原因应回显实际值');
    const bogus2 = ctx.store.saveSettings({ algorithm: 'greedy2' });
    assert.equal(bogus2.ok, false, 'greedy2 应被拒绝');
    assert.equal(ctx.store.peekState().settings.algorithm, 'greedy', '被拒绝后设置不得改变');

    // 载入校验：手工构造一份 algorithm 非法的状态文本，再交给下一次冷启动。
    const mock = createMockWx();
    const seed = openStore(mock);
    const corrupt = seed.store.peekState();
    seed.close();
    corrupt.settings.algorithm = 'dynamicProgramming';
    mock.storage.set(STORAGE_KEY, JSON.stringify(corrupt));
    const validated = validateState(corrupt);
    assert.equal(validated.ok, false, 'validateState 应拒绝非法 algorithm');
    assert.match(validated.message, /settings\.algorithm 只能是 greedy \/ dp/, '拒绝原因应可读');
    const reboot = openStore(mock);
    try {
      assert.equal(reboot.init.ok, false, '含非法算法的本地状态不得被当成正常数据恢复');
      assert.match(reboot.init.message, /algorithm 只能是 greedy \/ dp/, '冷启动消息应指向 algorithm 字段');
    } finally {
      reboot.close();
    }

    // 备份恢复边界：文件里带的 algorithm 非法时，必须在校验阶段明确拒绝，不半兼容写入。
    const backupCtx = openStore();
    try {
      backupCtx.store.saveProfile(profileDraft());
      backupCtx.store.saveSettings({ algorithm: 'dp' });
      const exported = await backupCtx.store.exportBackup();
      const tampered = JSON.parse(exported.text);
      tampered.state.settings.algorithm = 'dynamicProgramming';
      tampered.digest = canonicalSha256(tampered.state);
      const pre = await backupCtx.store.preflightRestore(JSON.stringify(tampered));
      assert.equal(pre.ok, false, '含非法 algorithm 的备份不得通过预检');
      assert.match(pre.message, /algorithm 只能是 greedy \/ dp/, '备份预检消息应指向 algorithm 字段');
      assert.equal(backupCtx.store.peekState().settings.algorithm, 'dp', '被拒绝的备份不得改动当前设置');
    } finally {
      backupCtx.close();
    }
    return { saveSettingsMessage: bogus.message, validateMessage: validated.message, rebootInitOk: false, backupRejected: true };
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 05 贪心：真实冻结 WASM 请求/响应 + 首页展示（模拟菜单输入）
// ---------------------------------------------------------------------------
await scenario('05', '贪心真实请求/响应（模拟菜单）：algorithm=greedy，首页方案正常展示', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    const outcome = await ctx.store.refreshPlan();
    assert.equal(outcome.ok, true, 'greedy 规划应成功');
    assert.equal(planRequestOf(ctx.store).plannerConfig.algorithm, 'greedy', '请求应携带 algorithm=greedy');
    const captured = capture('greedy-simulated', { entry: 'store.refreshPlan（首页“刷新方案”同一路径）', input: '内置模拟菜单 menu-simulated-v2', algorithmOption: 'greedy' }, ctx.store);
    assert.equal(captured.responseAlgorithm, 'greedy', '响应 search.algorithm 应为 greedy');
    assert.ok(captured.planCount > 0, '首页应展示方案');
    assert.ok(captured.home.plans > 0, '首页视图应有方案摘要');
    assert.ok(captured.home.meals.every((meal) => meal.hasPlan && meal.items > 0), '三餐都应有推荐项');
    return { status: captured.responseStatus, planCount: captured.planCount, requestId: captured.requestId };
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 06 动态规划：真实冻结 WASM 请求/响应 + 首页展示（模拟菜单输入）
// ---------------------------------------------------------------------------
await scenario('06', '动态规划真实请求/响应（模拟菜单）：algorithm=dp，首页方案正常展示', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    assert.equal(ctx.store.saveSettings({ algorithm: 'dp' }).ok, true, '应能保存 dp');
    const outcome = await ctx.store.refreshPlan();
    assert.equal(outcome.ok, true, 'dp 规划应成功');
    const request = planRequestOf(ctx.store);
    assert.equal(request.plannerConfig.algorithm, 'dp', '请求应携带 algorithm=dp');
    const captured = capture('dp-simulated', { entry: 'store.refreshPlan（首页“刷新方案”同一路径）', input: '内置模拟菜单 menu-simulated-v2', algorithmOption: 'dp' }, ctx.store);
    assert.equal(captured.responseAlgorithm, 'dp', '核心响应 search.algorithm 应为 dp（真实执行，不是前端伪造）');
    assert.ok(captured.planCount > 0, '首页应展示 dp 方案');
    assert.ok(captured.home.plans > 0, '首页视图应有 dp 方案摘要');
    assert.ok(captured.home.capabilityMessage.includes('dp'), '首页能力说明应包含 dp');
    // 结果必须来自冻结 WASM：同一请求原文重放，响应逐字节一致（前端不补算、不伪造）。
    await ctx.store.ensureCoreLoaded();
    const replay = coreRuntime.callCore('plan', ctx.store.getLastPlanRequest());
    assert.equal(replay, ctx.store.getLastPlanRaw(), '重放同一 dp 请求的响应应与已落盘响应逐字节一致');
    return { status: captured.responseStatus, planCount: captured.planCount, searchComplete: captured.searchComplete, replayIdentical: true };
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 07/08 真实菜单输入（内置西一食堂首批真实菜单）
// ---------------------------------------------------------------------------
async function useWest1Menu(store) {
  const pre = await store.preflightMenu(JSON.stringify(WEST1_MENU_CATALOG), 'config/west1-menu.ts（内置真实菜单）');
  assert.equal(pre.ok, true, '西一真实菜单应通过核心预检');
  assert.equal(store.applyMenu(pre).ok, true, '确认后应替换为西一真实菜单');
}

await scenario('07', '贪心真实请求/响应（西一真实菜单）：algorithm=greedy，真实菜单数据可规划', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    await useWest1Menu(ctx.store);
    const outcome = await ctx.store.refreshPlan();
    assert.equal(outcome.ok, true, '真实菜单下 greedy 规划应成功');
    const captured = capture('greedy-west1', { entry: 'store.refreshPlan（首页“刷新方案”同一路径）', input: '内置西一食堂六窗口统一菜单 west1-canteen-batch1-nutrition35-chuanxiang6-20261024（T03f 35 道估算 + 川湘 27 报价）', algorithmOption: 'greedy' }, ctx.store);
    assert.equal(captured.requestAlgorithm, 'greedy');
    assert.equal(captured.responseAlgorithm, 'greedy');
    assert.ok(captured.planCount > 0, '真实菜单下应有方案');
    return { status: captured.responseStatus, planCount: captured.planCount };
  } finally {
    ctx.close();
  }
});

await scenario('08', '动态规划真实请求/响应（西一真实菜单）：algorithm=dp，真实菜单数据可规划', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    await useWest1Menu(ctx.store);
    assert.equal(ctx.store.saveSettings({ algorithm: 'dp' }).ok, true, '应能保存 dp');
    const outcome = await ctx.store.refreshPlan();
    assert.equal(outcome.ok, true, '真实菜单下 dp 规划应成功');
    const captured = capture('dp-west1', { entry: 'store.refreshPlan（首页“刷新方案”同一路径）', input: '内置西一食堂六窗口统一菜单 west1-canteen-batch1-nutrition35-chuanxiang6-20261024（T03f 35 道估算 + 川湘 27 报价）', algorithmOption: 'dp' }, ctx.store);
    assert.equal(captured.requestAlgorithm, 'dp');
    assert.equal(captured.responseAlgorithm, 'dp');
    assert.ok(captured.planCount > 0, '真实菜单下 dp 应有方案');
    return { status: captured.responseStatus, planCount: captured.planCount };
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 09 DP 触限：真实 WASM 执行被压低的真实请求，前端按核心标记显示近似/未证明最优
// ---------------------------------------------------------------------------
await scenario('09', 'DP 触限：压低真实请求的 limits 触发核心 capsHit，前端标“近似/未证明最优”', async () => {
  const ctx = openStore();
  let captured;
  try {
    ctx.store.saveProfile(profileDraft());
    ctx.store.saveSettings({ algorithm: 'dp' });
    await ctx.store.refreshPlan();
    const liveRequest = JSON.parse(ctx.store.getLastPlanRequest());
    assert.equal(liveRequest.plannerConfig.algorithm, 'dp', '用于触限的请求必须是 dp 真实请求');
    // 只改限额（其余字段与生产构造逐字一致），用于观察核心的限额标记；生产请求构造不变。
    const limitedRequest = structuredClone(liveRequest);
    limitedRequest.plannerConfig.limits = {
      maxMealCandidatesPerMeal: 64,
      maxDpStates: 1,
      maxSearchNodes: 1,
      wallClockMs: null,
    };
    await ctx.store.ensureCoreLoaded();
    const rawLimited = coreRuntime.callCore('plan', JSON.stringify(limitedRequest));
    const envelope = JSON.parse(rawLimited);
    assert.equal(envelope.ok, true, '压低限额的合法请求不应被契约层拒绝');
    const search = envelope.result.search;
    assert.equal(search.algorithm, 'dp', '核心回显 algorithm 应为 dp');
    assert.ok(Array.isArray(search.capsHit) && search.capsHit.length > 0, '核心应记录 capsHit');
    assert.equal(search.searchComplete, false, '触限时 searchComplete 必须为 false（未证明最优）');
    assert.ok(
      Array.isArray(search.approximations) && search.approximations.some((entry) => String(entry.kind).indexOf('APPROXIMATE_') === 0),
      '核心应给出 APPROXIMATE_* 近似声明',
    );
    const interpretation = interpretPlanResult(envelope, ctx.store.peekState(), currentDay(ctx.store), currentCatalog(ctx.store));
    const mappedFlags = interpretation.plans.flatMap((plan) => plan.flags).concat(interpretation.flags);
    const status = envelope.result.status;
    if (status === 'ResourceLimited') {
      assert.match(interpretation.statusLabel, /触及搜索限额/, 'ResourceLimited 应标“触及搜索限额”');
      assert.match(interpretation.message, /不能声称最优/, '前端必须说明未证明最优');
    } else {
      assert.ok(mappedFlags.some((label) => /近似结果/.test(label) && /未证明最优/.test(label)), '有方案时必须按核心标记显示“近似/未证明最优”');
    }
    assert.equal(flagLabel('APPROXIMATE_DISCRETIZATION'), '近似结果：DP 状态被离散化/截断（未证明最优）', '前端 flag 映射应为未证明最优');
    if (outDir) {
      fs.writeFileSync(path.join(requestsDir, 'dp-limit.request.json'), JSON.stringify(limitedRequest), 'utf8');
      fs.writeFileSync(path.join(requestsDir, 'dp-limit.response.json'), rawLimited, 'utf8');
    }
    captured = {
      label: 'dp-limit',
      entry: 'store.refreshPlan 的真实 dp 请求 + 验证脚本仅压低 plannerConfig.limits 后经同一 core-runtime 桥调用',
      input: '内置模拟菜单 menu-simulated-v2（limits: maxDpStates=1 / maxSearchNodes=1）',
      requestAlgorithm: 'dp',
      responseAlgorithm: search.algorithm,
      responseStatus: status,
      searchComplete: search.searchComplete,
      capsHit: search.capsHit,
      approximations: search.approximations,
      planCount: interpretation.plans.length,
      mappedStatusLabel: interpretation.statusLabel,
      mappedFlags,
    };
    captures.push(captured);
    return { status, searchComplete: search.searchComplete, capsHit: search.capsHit, mappedFlags };
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 10 DP + 已吃保护不回退
// ---------------------------------------------------------------------------
await scenario('10', 'DP + 已吃保护：已确认餐次不进 planningMeals，activeLogs 照发，推荐不覆盖已吃', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    ctx.store.saveSettings({ algorithm: 'dp' });
    await ctx.store.refreshPlan();
    assert.equal(ctx.store.confirmMeal('breakfast', {}).ok, true, '早餐确认应成功');
    const outcome = await ctx.store.refreshPlan();
    assert.equal(outcome.ok, true, '确认后 dp 重算应成功');
    const request = planRequestOf(ctx.store);
    assert.equal(request.plannerConfig.algorithm, 'dp', '请求应仍为 dp');
    assert.ok(!request.planningMeals.includes('breakfast'), '已吃餐次不得再次列入 planningMeals');
    assert.deepEqual(request.planningMeals, ['lunch', 'dinner'], '只规划剩余午餐/晚餐');
    assert.ok(
      request.state.activeLogs.some((entry) => entry.meal === 'breakfast'),
      '已吃记录必须随 activeLogs 发给核心（核心据此不重复规划）',
    );
    const envelope = JSON.parse(ctx.store.getLastPlanRaw());
    assert.ok(!envelope.result.plans[0].meals.some((meal) => meal.meal === 'breakfast'), 'dp 响应不得给已吃餐次出推荐');
    const home = ctx.store.getHomeView();
    const breakfast = home.meals.find((meal) => meal.meal === 'breakfast');
    assert.equal(breakfast.confirmed, true, '首页早餐应保持“已确认”');
    assert.ok(breakfast.items.length > 0, '首页应展示已吃记录而不是旧推荐');
    const captured = capture('dp-after-eaten', { entry: 'store.refreshPlan（已确认早餐后）', input: '内置模拟菜单 menu-simulated-v2', algorithmOption: 'dp' }, ctx.store);
    return { planningMeals: request.planningMeals, activeLogs: request.state.activeLogs.length, breakfastItems: breakfast.items.length, status: captured.responseStatus };
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 11 DP + 锁定保护不回退（菜品锁 / 窗口锁仍生效；失效锁定仍拦截且不静默解锁）
// ---------------------------------------------------------------------------
await scenario('11', 'DP + 锁定保护：菜品锁/窗口锁照发并生效；失效锁仍 LockConflict 且不解锁', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    ctx.store.saveSettings({ algorithm: 'dp' });
    await ctx.store.refreshPlan();
    const firstEnvelope = JSON.parse(ctx.store.getLastPlanRaw());
    const lunchPlan = firstEnvelope.result.plans[0].meals.find((meal) => meal.meal === 'lunch');
    const dinnerPlan = firstEnvelope.result.plans[0].meals.find((meal) => meal.meal === 'dinner');
    assert.ok(lunchPlan && lunchPlan.items.length > 0, '首轮 dp 应有午餐推荐用于加锁');
    const lockedOfferId = lunchPlan.items[0].offerId;
    const lockedDishId = lunchPlan.items[0].dishId;
    assert.equal(ctx.store.toggleItemLock('lunch', lockedOfferId).ok, true, '菜品锁应成功');
    assert.equal(ctx.store.toggleWindowLock('dinner').ok, true, '窗口锁应成功');
    const lockedWindowId = currentDay(ctx.store).windowLocks.find((lock) => lock.meal === 'dinner').windowId;
    const outcome = await ctx.store.refreshPlan();
    assert.equal(outcome.ok, true, '带锁 dp 重算应成功');
    const request = planRequestOf(ctx.store);
    assert.ok(request.state.itemLocks.some((lock) => lock.meal === 'lunch' && lock.offerId === lockedOfferId), '菜品锁必须进入请求');
    assert.ok(request.state.windowLocks.some((lock) => lock.meal === 'dinner' && lock.windowId === lockedWindowId), '窗口锁必须进入请求');
    const envelope = JSON.parse(ctx.store.getLastPlanRaw());
    const lockedLunch = envelope.result.plans[0].meals.find((meal) => meal.meal === 'lunch');
    assert.ok(lockedLunch.items.some((item) => item.offerId === lockedOfferId), 'dp 方案必须包含被锁菜品');
    const lockedDinner = envelope.result.plans[0].meals.find((meal) => meal.meal === 'dinner');
    assert.equal(lockedDinner.windowId, lockedWindowId, 'dp 方案必须遵守窗口锁');
    assert.equal(lockedDinner.windowLocked, true, 'dp 响应应回显 windowLocked');
    const captureLocked = capture('dp-locks', { entry: 'store.refreshPlan（菜品锁 + 窗口锁）', input: '内置模拟菜单 menu-simulated-v2', algorithmOption: 'dp' }, ctx.store);
    // 失效锁定：把被锁菜品在本窗口标售罄，前端必须拦截且不调用核心、不自动解锁。
    const requestBefore = ctx.store.getLastPlanRequest();
    assert.equal(ctx.store.markSoldOut('lunch', lockedDishId, lunchPlan.windowId).ok, true, '标记售罄应成功');
    const conflict = await ctx.store.refreshPlan();
    assert.equal(conflict.status, 'LockConflict', '失效锁定应返回 LockConflict');
    assert.equal(ctx.store.getLastPlanRequest(), requestBefore, 'LockConflict 时不得再调用核心');
    assert.equal(currentDay(ctx.store).itemLocks.length, 1, '锁定记录必须保留（不静默解锁）');
    assert.equal(currentDay(ctx.store).windowLocks.length, 1, '窗口锁定记录必须保留');
    assert.ok(conflict.message.includes('锁定'), 'LockConflict 消息应可读');
    return { lockedOfferId, lockedWindowId, status: captureLocked.responseStatus, conflictStatus: conflict.status };
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 12 诊断页设置入口（真实 Page 处理器）+ 简易/完整模式互不影响
// ---------------------------------------------------------------------------
await scenario('12', '诊断页设置入口：onSelectAlgorithm 走 saveSettings，简易/完整模式都能用且互不覆盖', async () => {
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
    assert.equal(Array.isArray(options.data.algorithmOptions) && options.data.algorithmOptions.length, 3, '诊断页应有 3 个算法选项');
    assert.equal(options.data.algorithm, 'greedy', '诊断页初始算法应为 greedy');
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
    // 完整模式下落盘 dp：设置入口与显示模式无耦合。
    assert.equal(saveDisplayMode('full'), true, '完整模式应可保存');
    page.onSelectAlgorithm({ currentTarget: { dataset: { value: 'dp' } } });
    assert.equal(ctx.store.peekState().settings.algorithm, 'dp', '页面入口应把 dp 写入设置');
    assert.equal(page.data.algorithm, 'dp', '页面状态应刷新为 dp');
    assert.match(page.data.statusText, /设置已保存/, '页面应提示设置已保存');
    assert.equal(loadDisplayMode(), 'full', '保存算法不得改变显示模式');
    // 简易模式下切回贪心：同一个设置入口。
    assert.equal(saveDisplayMode('simple'), true, '简易模式应可保存');
    page.onSelectAlgorithm({ currentTarget: { dataset: { value: 'greedy' } } });
    assert.equal(ctx.store.peekState().settings.algorithm, 'greedy', '页面入口应可切回贪心');
    assert.equal(loadDisplayMode(), 'simple', '切换算法不得改变显示模式');
    // 非法选项仍由页面/store 明确拒绝，不写入。
    page.onSelectAlgorithm({ currentTarget: { dataset: { value: 'dynamicProgramming' } } });
    assert.equal(ctx.store.peekState().settings.algorithm, 'greedy', '非法算法不得写入设置');
    assert.match(page.data.statusText, /未知算法选项/, '非法选项应给出可见提示');
    return { pageEntry: 'onSelectAlgorithm', algorithmAfterDp: 'dp', algorithmAfterGreedy: 'greedy', displayModePreserved: true };
  } finally {
    globalThis.Page = prevPage;
    globalThis.getApp = prevGetApp;
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 13 前端不复制算法：唯一 mp_plan 调用点在 core-bridge，src 文件集合未扩张
// ---------------------------------------------------------------------------
await scenario('13', '前端不复制算法：src 无 C++ 算法符号/无新增业务文件，结果仅来自 WASM 原文', async () => {
  const srcRoot = path.resolve('miniprogram', 'src');
  const files = workspaceFiles(srcRoot);
  assert.equal(files.length, 75, 'candidate 源码文件数应与基线 75 一致（未新增业务文件）');
  const tsFiles = files.filter((file) => file.endsWith('.ts'));
  const markers = ['RunDpAlgorithm', 'RunBranchAndBound', 'RecurseBranchAndBound', 'DpExactDominates', 'EnumerateMealCandidates'];
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
// 汇总与证据落盘
// ---------------------------------------------------------------------------
const passed = rows.filter((row) => row.ok).length;
const failed = rows.length - passed;
log('');
log('='.repeat(92));
log(`T05A01a 受影响验证（Node ${process.version} 宿主 + 冻结 WASM；非微信/非真机）`);
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
        tool: 'test-t05a01a-dp-chain.mjs',
        scope: 'Node.js 宿主 + mock wx 存储 + 包内冻结 WASM；不代表微信开发者工具/真机',
        card: 'T05A01a-DSH-动态规划端到端接入小卡-v1',
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
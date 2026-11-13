// verify-t05-integration.mjs — T05 真实 WASM 关键场景集成验证（PASS/FAIL 表）。
//
// 与 test-t05-store.mjs 的分工：本脚本用真实包内 mp_core.wasm 串跑产品关键路径，
// 打印一张可粘贴进报告的 PASS/FAIL 表，并把结构化结果写入
// D:\项目\cpp\.toolchain\tmp\t05\；测试文件负责更细的行为断言。
//
// 场景：WASM 身份、ABI 探针、核心加载、目标 Ok、计划 OkPartial、请求口径（四字段 limits/哈希/修订）、
// 重复确认幂等、四类夹具、预算 0、搜索限额、TargetUnavailable、LockConflict、导出→恢复、
// 杀进程重开恢复、菜单预检/替换、售罄跨日隔离、补记未知价格/营养。
//
// 证据边界：WASM 是包内真实二进制；wx 存储是 mock（Map + 字符串），不是微信运行时/真机。
//
// 运行（项目根）：
//   node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/verify-t05-integration.mjs
import assert from 'node:assert/strict';
import {
  createMockWx,
  createRealInstantiate,
  environmentInfo,
  importTs,
  loadFixtures,
  readWasmChecked,
  wasmPath,
  WASM_EXPECTED_BYTES,
  WASM_EXPECTED_SHA256,
  writeEvidenceJson,
} from './t05-test-helpers.mjs';

const { AppStore } = await importTs('domain', 'store.ts');
const { createInitialState } = await importTs('domain', 'app-state.ts');
const { SIMULATED_CATALOG } = await importTs('config', 'simulated-menu.ts');
const { loadCore, probeAbi } = await importTs('utils', 'core-bridge.ts');
const { NUTRITION_CONFIG_HASH } = await importTs('config', 'nutrition-config.ts');
const coreRuntime = await importTs('utils', 'core-runtime.ts');
const FIXTURE_CASES = await loadFixtures();
const STORAGE_KEY = 'tiankeshike:state:v1';
const DATE_A = '2026-10-20';
const DATE_B = '2026-10-21';

function makeClock(iso = `${DATE_A}T12:00:00+08:00`) {
  let current = new Date(iso).getTime();
  const clock = () => {
    current += 1000;
    return new Date(current);
  };
  clock.set = (nextIso) => {
    current = new Date(nextIso).getTime();
  };
  return clock;
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

function manualTargets(overrides = {}) {
  return {
    energyKcal: 2000,
    proteinDg: 800,
    fatDg: 600,
    carbDg: 2500,
    sourceType: 'userEntered',
    sourceNote: null,
    derivedFields: [],
    ...overrides,
  };
}

/**
 * T05M02 后空存储的默认菜单改为内置西一真实菜单。本脚本固定验证 T05 既有链路，
 * 因此把冻结示例菜单作为已保存的当前菜单写进 mock 持久化，保证旧版 menuVersion 口径不变。
 */
function seedSimulatedMenu(mock, now) {
  const state = createInitialState(now);
  state.catalog = JSON.parse(JSON.stringify(SIMULATED_CATALOG));
  state.catalogMeta = { source: 'simulated', importedAt: null, importedFileName: null };
  mock.storage.set(STORAGE_KEY, JSON.stringify(state));
}

function openStore({ clock = makeClock(), mock = createMockWx() } = {}) {
  const uninstall = mock.install();
  if (mock.raw(STORAGE_KEY) === '') {
    seedSimulatedMenu(mock, clock());
  }
  const store = new AppStore({ instantiate: createRealInstantiate(), wasmPath, now: clock });
  coreRuntime.resetCore();
  const init = store.init();
  return {
    store,
    mock,
    clock,
    init,
    close() {
      coreRuntime.resetCore();
      uninstall();
    },
  };
}

const dayOf = (store) => {
  const state = store.peekState();
  return state.days[state.activeDate];
};
const requestOf = (store) => JSON.parse(store.getLastPlanRequest());

// ---------------------------------------------------------------------------
// 场景执行框架：每个场景独立存储/实例，失败不阻断后续场景。
// ---------------------------------------------------------------------------

const rows = [];

async function scenario(id, title, fn) {
  const start = performance.now();
  try {
    const detail = await fn();
    rows.push({ id, title, ok: true, detail: detail || {}, durationMs: Number((performance.now() - start).toFixed(3)) });
    console.log(`[PASS] ${id} ${title}`);
  } catch (error) {
    rows.push({
      id,
      title,
      ok: false,
      error: error && error.message ? error.message : String(error),
      durationMs: Number((performance.now() - start).toFixed(3)),
    });
    console.log(`[FAIL] ${id} ${title}\n       → ${error && error.message ? error.message : String(error)}`);
  }
}

const wasm = readWasmChecked();
const environment = environmentInfo();

// 01 WASM 身份
await scenario('01', '包内 WASM 身份（A18 真实时限核心 111,554 字节 / SHA256 B0098453…）', () => {
  assert.equal(wasm.bytesLength, WASM_EXPECTED_BYTES, 'WASM 字节数应为冻结值');
  assert.equal(wasm.sha256, WASM_EXPECTED_SHA256, 'WASM SHA256 应为冻结值');
  const ctx = openStore();
  try {
    const dev = ctx.store.getDevView();
    assert.equal(dev.expectedWasmBytes, WASM_EXPECTED_BYTES, 'dev 视图字节数一致');
    assert.equal(dev.expectedWasmSha256, WASM_EXPECTED_SHA256, 'dev 视图哈希一致');
    assert.equal(dev.wasmPath, wasmPath, 'dev 视图路径为包内 WASM');
    return { bytes: wasm.bytesLength, sha256: wasm.sha256 };
  } finally {
    ctx.close();
  }
});

// 02 ABI 探针
await scenario('02', 'ABI 探针：mp_api_version=1、contract=1.0、分配/释放生命周期', async () => {
  const loaded = await loadCore(createRealInstantiate(), wasmPath);
  const probe = probeAbi(loaded);
  assert.equal(probe.apiVersion, 1, 'mp_api_version 应为 1');
  assert.equal(probe.contractVersion, '1.0', 'mp_contract_version 应为 1.0');
  assert.equal(probe.allocWriteReadOk, true, 'mp_alloc 写入读回应一致');
  assert.match(probe.resultBlockProbeText, /INVALID_INPUT/, '空请求结果块探针应返回 INVALID_INPUT');
  return { apiVersion: probe.apiVersion, contractVersion: probe.contractVersion };
});

// 03 核心加载（store 门面）
await scenario('03', 'store.ensureCoreLoaded：真实 WASM 单例加载', async () => {
  const ctx = openStore();
  try {
    const loaded = await ctx.store.ensureCoreLoaded();
    assert.equal(loaded.ok, true, 'ensureCoreLoaded 应成功');
    return { message: loaded.message };
  } finally {
    ctx.close();
  }
});

// 04 目标 Ok
await scenario('04', '建档 + computeTarget：状态 Ok、daily 来自核心', async () => {
  const ctx = openStore();
  try {
    assert.equal(ctx.store.saveProfile(profileDraft()).ok, true, '建档应成功');
    const outcome = await ctx.store.computeTarget();
    assert.equal(outcome.status, 'Ok', '目标状态应为 Ok');
    const target = ctx.store.getProfileView().target;
    assert.deepEqual(target.daily, { energyKcal: 2370, proteinDg: 840, fatDg: 711, carbDg: 3485 }, 'daily 目标值应来自 WASM');
    assert.equal(target.bmiLabel, '22.9', 'BMI 展示应来自核心');
    return { status: outcome.status, daily: target.daily, bmiLabel: target.bmiLabel };
  } finally {
    ctx.close();
  }
});

// 05 计划 OkPartial
await scenario('05', 'refreshPlan：OkPartial、planKey、预算 2300、三餐推荐', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    const outcome = await ctx.store.refreshPlan();
    assert.equal(outcome.ok, true, '应生成方案');
    assert.equal(outcome.status, 'OkPartial', '模拟数据方案状态应为 OkPartial');
    assert.match(outcome.planKey, /^plan:[0-9a-f]{64}$/, 'planKey 格式应为 plan:<64 hex>');
    const home = ctx.store.getHomeView();
    assert.equal(home.plans.length, 1, '应去重为 1 套方案');
    assert.equal(home.budget.plannedTotalCents, 2300, '计划总价应为 2300 分');
    assert.equal(home.meals.length, 3, '应有三餐');
    assert.ok(home.meals.every((meal) => meal.hasPlan && meal.items.length > 0), '三餐都应有推荐项');
    assert.ok(dayOf(ctx.store).plan, 'plan 记录应写入');
    return { status: outcome.status, planKey: outcome.planKey, plannedTotalCents: home.budget.plannedTotalCents };
  } finally {
    ctx.close();
  }
});

// 06 请求口径
await scenario('06', 'PlanRequest 口径：requestId/revision/哈希/tz/menuVersion，limits 为契约四字段', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    await ctx.store.refreshPlan();
    const request = requestOf(ctx.store);
    const day = dayOf(ctx.store);
    assert.equal(request.contractVersion, '1.0', '契约版本应为 1.0');
    assert.equal(request.requestId, `req-${DATE_A}-1`, 'requestId 应为 req-<date>-1');
    assert.equal(request.tzOffsetMinutes, day.tzOffsetMinutes, '时区偏移应与状态一致');
    assert.equal(request.profile.revision, 1, 'profile revision 应为 1');
    assert.equal(request.nutritionConfig.hash, NUTRITION_CONFIG_HASH, '营养配置哈希应为冻结值');
    assert.equal(request.catalog.menuVersion, 'menu-simulated-v2', '菜单版本应为模拟菜单');
    assert.equal(day.plan.requestId, request.requestId, 'plan 记录 requestId 应与请求一致');
    assert.equal(day.plan.menuVersion, request.catalog.menuVersion, 'plan 记录 menuVersion 应与请求一致');
    const serialized = JSON.stringify(request);
    for (const field of ['maxMealCandidatesPerMeal', 'maxDpStates', 'maxSearchNodes', 'wallClockMs']) {
      assert.equal(serialized.includes(field), true, `应发送契约搜索字段 ${field}`);
    }
    assert.equal(request.plannerConfig.limits.wallClockMs, null, 'wallClockMs 应为确定性限额 null');
    return { requestId: request.requestId, tzOffsetMinutes: request.tzOffsetMinutes, menuVersion: request.catalog.menuVersion };
  } finally {
    ctx.close();
  }
});

// 07 重复确认幂等
await scenario('07', 'confirmMeal 幂等：重复确认不新增、不翻倍', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    await ctx.store.refreshPlan();
    assert.equal(ctx.store.confirmMeal('lunch', {}).ok, true, '首次确认应成功');
    const second = ctx.store.confirmMeal('lunch', {});
    assert.equal(second.duplicate, true, '重复确认应返回 duplicate');
    assert.equal(dayOf(ctx.store).logs.length, 1, '重复确认不得新增记录');
    assert.equal(ctx.store.getLogsView().intake.priceKnownCents, 1000, '实际消费不得翻倍');
    return { duplicate: second.duplicate };
  } finally {
    ctx.close();
  }
});

// 08 四类 T02 夹具
await scenario('08', '四类 T02 夹具：success/targetUnavailable/invalid/resourceLimited', async () => {
  const ctx = openStore();
  try {
    const expected = {
      success: 'OkPartial',
      targetUnavailable: 'TargetUnavailable',
      invalid: 'INVALID_INPUT',
      resourceLimited: 'ResourceLimited',
    };
    const actual = {};
    for (const [key, status] of Object.entries(expected)) {
      const result = await ctx.store.runFixture(key);
      actual[key] = result.status;
      assert.equal(result.status, status, `夹具 ${key} 状态应为 ${status}`);
    }
    return actual;
  } finally {
    ctx.close();
  }
});

// 09 预算 0
await scenario('09', '预算 0：NoFeasibleWithinBudget + overBudget + 超预算备选', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    assert.equal(ctx.store.saveSettings({ budgetCents: 0 }).ok, true, '零预算设置应合法');
    const outcome = await ctx.store.refreshPlan();
    assert.equal(outcome.status, 'NoFeasibleWithinBudget', '零预算应为 NoFeasibleWithinBudget');
    const home = ctx.store.getHomeView();
    assert.equal(home.budget.overBudget, true, '应标记超预算');
    assert.equal(home.budget.overageCents, 2300, '超支金额应为 2300 分');
    assert.ok(home.flags.includes('超预算备选'), 'flags 应含超预算备选');
    return { status: outcome.status, overBudget: home.budget.overBudget, overageCents: home.budget.overageCents };
  } finally {
    ctx.close();
  }
});

// 10 搜索限额口径（契约四字段）
await scenario('10', 'plannerConfig.limits 只发契约四字段，旧 limits 别名不进入请求', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    // 旧 T02 设置仍可写入（types.ts 旧 limits 清理属 T06），但 plan.ts 固定发契约四字段，不得泄漏旧别名。
    ctx.store.saveSettings({ limits: { maxNodes: 3 } });
    const outcome = await ctx.store.refreshPlan();
    const request = requestOf(ctx.store);
    assert.deepEqual(
      request.plannerConfig.limits,
      { maxMealCandidatesPerMeal: 256, maxDpStates: 32, maxSearchNodes: 200000, wallClockMs: null },
      '请求应携带契约四字段限额（三餐默认走 A14 有界 DP32）',
    );
    const serialized = JSON.stringify(request);
    for (const oldField of ['maxNodes', 'maxCandidates']) {
      assert.equal(serialized.includes(oldField), false, `不得发送旧 T02 限额字段 ${oldField}`);
    }
    assert.equal(outcome.status, 'OkPartial', '四字段限额下真实核心应正常返回方案');
    return { status: outcome.status, limits: request.plannerConfig.limits };
  } finally {
    ctx.close();
  }
});

// 11 TargetUnavailable
await scenario('11', 'TargetUnavailable：过轻+手动目标不产生假方案', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft({ weightGrams: 50000, goalType: 'manual', manualTargets: manualTargets() }));
    await ctx.store.computeTarget();
    const outcome = await ctx.store.refreshPlan();
    assert.equal(outcome.status, 'TargetUnavailable', '目标不可用应返回 TargetUnavailable');
    const home = ctx.store.getHomeView();
    assert.equal(home.plans.length, 0, '不得显示任何方案');
    assert.ok(home.meals.every((meal) => !meal.hasPlan), '不得出现假推荐');
    return { status: outcome.status, plans: home.plans.length };
  } finally {
    ctx.close();
  }
});

// 12 LockConflict
await scenario('12', 'LockConflict：锁定项售罄时前端拦截、不调用核心、不静默解锁', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    await ctx.store.refreshPlan();
    ctx.store.toggleItemLock('lunch', 'offer-chicken');
    ctx.store.markSoldOut('lunch', 'dish-chicken');
    const requestBefore = ctx.store.getLastPlanRequest();
    const outcome = await ctx.store.refreshPlan();
    assert.equal(outcome.status, 'LockConflict', '锁定失效应返回 LockConflict');
    assert.equal(ctx.store.getLastPlanRequest(), requestBefore, 'LockConflict 不应再调用核心');
    assert.equal(dayOf(ctx.store).itemLocks.length, 1, '锁定记录必须保留');
    return { status: outcome.status, lockIssues: ctx.store.getHomeView().lockIssues.length };
  } finally {
    ctx.close();
  }
});

// 13 导出→恢复
await scenario('13', '导出→恢复：摘要一致、8 行对照全 equal、关键状态恢复', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    await ctx.store.refreshPlan();
    ctx.store.confirmMeal('breakfast', {});
    const requestId = ctx.store.getHomeView().requestId;
    const exported = await ctx.store.exportBackup();
    assert.equal(exported.ok, true, '导出应成功');
    const pre = await ctx.store.preflightRestore(exported.text);
    assert.equal(pre.ok, true, '备份应通过预检');
    const applied = await ctx.store.applyRestore(pre);
    assert.equal(applied.ok, true, '往返恢复应成功');
    assert.equal(applied.comparison.length, 8, '对照应为 8 行');
    assert.equal(applied.comparison.filter((row) => !row.equal).length, 0, '8 行对照应全部相等');
    assert.equal(applied.digest, exported.digest, '恢复摘要应与导出一致');
    assert.equal(ctx.store.getHomeView().requestId, requestId, '恢复后 plan requestId 应一致');
    assert.equal(ctx.store.getLogsView().meals[0].active.length, 1, '恢复后记餐应恢复');
    return { digest: exported.digest, comparisonRows: applied.comparison.length };
  } finally {
    ctx.close();
  }
});

// 14 杀进程重开恢复
await scenario('14', '杀进程重开：新 AppStore 在同 mock 存储恢复档案/计划/记餐/幂等键', async () => {
  const mock = createMockWx();
  const clock = makeClock();
  const first = openStore({ clock, mock });
  let before;
  try {
    first.store.saveProfile(profileDraft());
    await first.store.refreshPlan();
    first.store.confirmMeal('lunch', {});
    before = {
      requestId: first.store.getHomeView().requestId,
      recordId: first.store.getLogsView().meals[1].active[0].recordId,
    };
  } finally {
    first.close();
  }
  const second = openStore({ clock, mock });
  try {
    assert.equal(second.init.ok, true, '重开 init 应成功');
    assert.match(second.init.message, /已恢复本地数据/, '重开应提示已恢复本地数据');
    assert.equal(second.store.getHomeView().requestId, before.requestId, '重开后 plan requestId 应恢复');
    assert.equal(second.store.getLogsView().meals[1].active[0].recordId, before.recordId, '重开后 recordId 应恢复');
    const duplicate = second.store.confirmMeal('lunch', {});
    assert.equal(duplicate.duplicate, true, '重开后重复确认应幂等');
    return { requestId: before.requestId, initMessage: second.init.message };
  } finally {
    second.close();
  }
});

// 15 菜单预检与替换
await scenario('15', '菜单导入：非法拒绝、成功替换后旧计划失效并绑定新 menuVersion', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    await ctx.store.refreshPlan();
    const invalid = await ctx.store.preflightMenu('{"windows":[]}', 'bad.json');
    assert.equal(invalid.ok, false, '非法菜单应被拒绝');
    const catalog = structuredClone(FIXTURE_CASES.success.request.catalog);
    catalog.menuVersion = 'menu-verify-v1';
    const { canonicalSha256 } = await importTs('utils', 'canonical-json.ts');
    catalog.catalogHash = canonicalSha256(catalog, 'catalogHash');
    const pre = await ctx.store.preflightMenu(JSON.stringify(catalog), 'verify-menu.json');
    assert.equal(pre.ok, true, '合法菜单应通过核心预检');
    assert.equal(ctx.store.applyMenu(pre).ok, true, '确认后应原子替换');
    assert.equal(dayOf(ctx.store).plan, null, '替换后旧计划应失效');
    const outcome = await ctx.store.refreshPlan();
    assert.equal(outcome.ok, true, '新菜单应可重新规划');
    assert.equal(dayOf(ctx.store).plan.menuVersion, 'menu-verify-v1', 'plan 记录应绑定新 menuVersion');
    return { menuVersion: ctx.store.getMenuView().info.menuVersion };
  } finally {
    ctx.close();
  }
});

// 16 售罄跨日隔离
await scenario('16', '售罄跨日隔离：新的一天不继承、旧日记录保留', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    await ctx.store.refreshPlan();
    ctx.store.markSoldOut('lunch', 'dish-chicken');
    ctx.store.toggleWindowLock('lunch');
    ctx.clock.set(`${DATE_B}T12:00:00+08:00`);
    assert.equal(ctx.store.ensureToday(), true, '跨日应创建新桶');
    const home = ctx.store.getHomeView();
    assert.equal(home.businessDate, DATE_B, '业务日期应切到新的一天');
    assert.deepEqual(home.soldOutMarks, [], '新的一天不得继承售罄');
    assert.deepEqual(dayOf(ctx.store).windowLocks, [], '新的一天不得继承锁定');
    const old = ctx.store.peekState().days[DATE_A];
    assert.equal(old.soldOut.length, 1, '旧日售罄记录应保留');
    assert.equal(old.windowLocks.length, 1, '旧日锁定记录应保留');
    return { today: home.businessDate, oldSoldOut: old.soldOut.length };
  } finally {
    ctx.close();
  }
});

// 17 补记未知价格/营养
await scenario('17', '补记未知价格/营养：未知不当 0、预算核算不完整', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    ctx.store.saveSettings({ budgetCents: 3000 });
    const added = ctx.store.addManualLog('dinner', {
      name: '未知小吃',
      portionCode: 'full',
      quantity: 1,
      unitPriceCents: null,
      priceKnown: false,
      nutrition: null,
      clientToken: 'verify-tok-1',
    });
    assert.equal(added.ok, true, '未知项补记应允许');
    const logs = ctx.store.getLogsView();
    assert.equal(logs.intake.energyKcal, null, '未知营养汇总应为 null');
    assert.equal(logs.budget.spentKnownCents, 0, '未知价格不计入已知支出');
    assert.equal(logs.budget.accountingComplete, false, '预算核算应不完整');
    assert.match(logs.budget.message, /预算核算不完整/, '预算区应显示核算不完整');
    return { energyKcal: logs.intake.energyKcal, accountingComplete: logs.budget.accountingComplete };
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 汇总表与证据
// ---------------------------------------------------------------------------

const passed = rows.filter((row) => row.ok).length;
const failed = rows.length - passed;
console.log(`\n${'='.repeat(92)}`);
console.log(`T05 真实 WASM 集成验证（Node ${process.version} 宿主，非微信/非真机）`);
console.log(`${'='.repeat(92)}`);
console.log(`${'ID'.padEnd(4)}${'结果'.padEnd(8)}${'耗时(ms)'.padEnd(12)}场景`);
for (const row of rows) {
  console.log(`${row.id.padEnd(4)}${(row.ok ? 'PASS' : 'FAIL').padEnd(8)}${String(row.durationMs).padEnd(12)}${row.title}`);
}
console.log(`${'-'.repeat(92)}`);
console.log(`合计：${passed} / ${rows.length} 通过，${failed} 失败`);
if (failed > 0) {
  console.log('\n失败明细：');
  for (const row of rows.filter((entry) => !entry.ok)) {
    console.log(`  ${row.id} ${row.title}\n     ${row.error}`);
  }
}

const evidence = {
  tool: 'verify-t05-integration.mjs',
  scope: 'Node.js 宿主（真实包内 mp_core.wasm）；mock wx 存储不代表微信运行时或真机',
  environment,
  wasm: {
    path: wasmPath,
    bytes: wasm.bytesLength,
    sha256: wasm.sha256,
    expectedBytes: WASM_EXPECTED_BYTES,
    expectedSha256: WASM_EXPECTED_SHA256,
  },
  scenarios: rows,
  passed,
  failed,
  total: rows.length,
  timestamp: new Date().toISOString(),
};
const evidencePath = writeEvidenceJson(`verify-t05-integration-${evidence.timestamp.replace(/[:.]/g, '-')}.json`, evidence);
console.log(`\n证据 JSON：${evidencePath}`);
process.exit(failed === 0 ? 0 : 1);

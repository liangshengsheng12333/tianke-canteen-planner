// test-t05-store.mjs — T05 阶段 2：AppStore 行为测试（真实 mp_core.wasm + mock wx 存储）。
//
// 覆盖任务要求 22 项：
//   1 存储往返与损坏处理；2 档案校验/单位字段/profileRevision；3 目标状态映射；
//   4 真 WASM 计划成功与 plan 记录；5 重复确认幂等；6 改记录 superseded 与汇总同步；
//   7 撤销汇总回落 + 跨餐计划只算未吃餐；8 补记未知价格/营养；9 结束/重开影响 planningMeals；
//   10 预算 0/极小；11 TargetUnavailable 不产生假方案；12 搜索限额口径（契约四字段 limits）；
//   13 能力门（comboRules 非空不发送）；14 售罄作用域与跨日隔离；15 锁定失效 LockConflict；
//   16 同窗换菜 swapOffer；17 菜单预检/取消/写入失败/成功替换；18 写入失败不破坏数据；
//   19 导出→恢复；20 旧响应不覆盖新输入；21 请求一致性/revision；22 新实例重开恢复。
//
// 证据边界：WASM 是包内真实二进制（Node 宿主实例化），但 mock wx 只模拟持久化文本，
// 不是微信运行时、不是真机；mock instantiate 延迟只用于乱序响应测试。
//
// 运行（项目根）：
//   node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-t05-store.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  createMockWx,
  createRealInstantiate,
  importTs,
  loadFixtures,
  wasmPath,
  WASM_EXPECTED_BYTES,
  WASM_EXPECTED_SHA256,
} from './t05-test-helpers.mjs';

const { AppStore } = await importTs('domain', 'store.ts');
const { interpretPlanResult } = await importTs('domain', 'plan.ts');
const { STORAGE_KEY, createInitialState } = await importTs('domain', 'app-state.ts');
const { SIMULATED_CATALOG } = await importTs('config', 'simulated-menu.ts');
const { canonicalSha256 } = await importTs('utils', 'canonical-json.ts');
const { NUTRITION_CONFIG_HASH } = await importTs('config', 'nutrition-config.ts');
const coreRuntime = await importTs('utils', 'core-runtime.ts');
const FIXTURE_CASES = await loadFixtures();

const DATE_A = '2026-10-20';
const DATE_B = '2026-10-21';

// ---------------------------------------------------------------------------
// 公共夹具与工具
// ---------------------------------------------------------------------------

/** 每次调用前进 1 秒的注入时钟：保证记录 ID 唯一，又让业务日期稳定。 */
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
 * T05M02 后空存储的默认菜单改为内置西一真实菜单。本文件验证的是“已有菜单下的 store 行为”，
 * 所以默认把冻结示例菜单作为**已保存**的当前菜单写进 mock 持久化（等价于升级前用户的示例菜单状态），
 * 被测 store 代码与断言口径不变；空存储首开默认西一由 test-menu-default.mjs 单独覆盖。
 */
function seedSimulatedMenu(mock, now) {
  const state = createInitialState(now);
  state.catalog = JSON.parse(JSON.stringify(SIMULATED_CATALOG));
  state.catalogMeta = { source: 'simulated', importedAt: null, importedFileName: null };
  mock.storage.set(STORAGE_KEY, JSON.stringify(state));
}

/**
 * 在 mock wx + 一份真实 WASM 实例上打开 AppStore；测试结束务必 close()。
 * 每次都 resetCore，等价于“进程刚启动、核心尚未加载”。
 * menu='simulated'（默认）预置已保存示例菜单；menu='none' 保留真正空存储（首次使用路径）。
 */
function openStore({ clock = makeClock(), mock = createMockWx(), init = true, instantiate = createRealInstantiate(), menu = 'simulated' } = {}) {
  const uninstall = mock.install();
  if (menu === 'simulated' && mock.raw(STORAGE_KEY) === '') {
    seedSimulatedMenu(mock, clock());
  }
  const store = new AppStore({ instantiate, wasmPath, now: clock });
  coreRuntime.resetCore();
  const initResult = init ? store.init() : null;
  return {
    store,
    mock,
    clock,
    init: initResult,
    close() {
      coreRuntime.resetCore();
      uninstall();
    },
  };
}

function currentDay(store) {
  const state = store.peekState();
  return state.days[state.activeDate];
}

function planRequest(store) {
  const text = store.getLastPlanRequest();
  assert.ok(typeof text === 'string' && text.length > 0, '应已记录最近一次 PlanRequest 文本');
  return JSON.parse(text);
}

function newCatalogFromFixture(mutate) {
  const catalog = structuredClone(FIXTURE_CASES.success.request.catalog);
  mutate(catalog);
  catalog.catalogHash = canonicalSha256(catalog, 'catalogHash');
  return catalog;
}

// ---------------------------------------------------------------------------
// 1) 存储往返与损坏数据处理
// ---------------------------------------------------------------------------

test('1 存储往返：首次使用创建状态、写档后重开逐项恢复；损坏 JSON/版本不符被拒并阻止写入', () => {
  // 1a 首次使用（真正的空存储：menu='none'，不预置示例菜单）
  const first = openStore({ menu: 'none' });
  try {
    assert.equal(first.init.ok, true, '空存储首次 init 应成功');
    assert.match(first.init.message, /首次使用/, '首次使用应有可读提示');
    assert.equal(first.init.businessDate, DATE_A, '业务日期应取自注入时钟');
    const saved = first.store.saveProfile(profileDraft());
    assert.equal(saved.ok, true, '首次建档应写入成功');
    const raw = first.mock.raw(STORAGE_KEY);
    assert.equal(typeof raw, 'string', '本地存储值必须是字符串（与真实 wx 一致）');
    const parsed = JSON.parse(raw);
    assert.equal(parsed.schemaVersion, 1, '存储根对象 schemaVersion 应为 1');
    assert.equal(parsed.profileRevision, 1, '首次建档后 profileRevision 应为 1');
    assert.ok(parsed.profileId, '首次建档应生成 profileId');
    assert.deepEqual(parsed.profileDraft, profileDraft(), '存储中的档案草稿应与提交内容一致');
    first.close();

    // 1b 同一份持久化文本重开
    const reopened = openStore({ mock: first.mock });
    try {
      assert.equal(reopened.init.ok, true, '同一份持久化文本重开 init 应成功');
      assert.match(reopened.init.message, /已恢复本地数据/, '重开应提示已恢复本地数据');
      const home = reopened.store.getHomeView();
      assert.equal(home.profileReady, true, '重开后档案应可用');
      assert.equal(home.profileSummary, '男，20 岁，175 cm，70.0 kg，减脂', '重开后档案摘要应与写入时一致');
      assert.equal(reopened.store.peekState().profileRevision, 1, '重开后 profileRevision 应保持 1');
    } finally {
      reopened.close();
    }
  } finally {
    // first.close 已调用；这里兜底避免异常路径遗留全局 wx
    coreRuntime.resetCore();
  }

  // 1c 损坏 JSON：拒绝并阻止写入，resetLocalData 后可恢复
  const corruptMock = createMockWx({ seed: { [STORAGE_KEY]: 'not-json{{' } });
  const corrupt = openStore({ mock: corruptMock });
  try {
    assert.equal(corrupt.init.ok, false, '损坏 JSON 的 init 必须返回失败');
    assert.match(corrupt.init.message, /不是合法 JSON/, '损坏 JSON 应给出可定位原因');
    const blocked = corrupt.store.saveProfile(profileDraft());
    assert.equal(blocked.ok, false, '存储损坏后必须阻止写入');
    assert.match(blocked.message, /本地数据处于故障状态/, '阻止写入的原因应可见');
    assert.equal(corrupt.store.resetLocalData().ok, true, 'resetLocalData 应清除故障存储');
    assert.equal(corrupt.store.saveProfile(profileDraft()).ok, true, '清除后应可重新写入');
  } finally {
    corrupt.close();
  }

  // 1d schemaVersion 不符
  const versionMock = createMockWx({ seed: { [STORAGE_KEY]: JSON.stringify({ schemaVersion: 2 }) } });
  const version = openStore({ mock: versionMock });
  try {
    assert.equal(version.init.ok, false, 'schemaVersion 不符必须拒绝');
    assert.match(version.init.message, /版本 2 与当前 1 不匹配/, '版本错误应可定位');
    assert.equal(version.store.saveProfile(profileDraft()).ok, false, '结构损坏同样应阻止写入');
  } finally {
    version.close();
  }

  // 1e 存储值类型异常（读取抛错）：同样进入故障态并阻止写入，resetLocalData 可恢复
  const typeMock = createMockWx();
  typeMock.storage.set(STORAGE_KEY, 12345);
  const typeCtx = openStore({ mock: typeMock });
  try {
    assert.equal(typeCtx.init.ok, false, '存储值非字符串时 init 必须失败');
    assert.match(typeCtx.init.message, /不是字符串/, '读取异常原因应可定位');
    const blocked = typeCtx.store.saveProfile(profileDraft());
    assert.equal(blocked.ok, false, '读取异常后必须阻止写入，避免覆盖坏数据');
    assert.match(blocked.message, /本地数据处于故障状态/, '阻止写入原因应可见');
    assert.equal(typeCtx.store.resetLocalData().ok, true, 'resetLocalData 应可清除故障状态');
    assert.equal(typeCtx.store.saveProfile(profileDraft()).ok, true, '清除故障后应可正常写入');
  } finally {
    typeCtx.close();
  }
});

// ---------------------------------------------------------------------------
// 2) 档案校验 / 单位换算字段 / profileRevision 递增
// ---------------------------------------------------------------------------

test('2 档案：非法单位拒绝并给字段错误；合法保存 profileRevision 递增且保留 mm/g/permille 原始字段', () => {
  const ctx = openStore();
  try {
    const invalid = ctx.store.saveProfile(
      profileDraft({ ageYears: 121, heightMm: 900, weightGrams: 20000, bodyFatPermille: 1001 }),
    );
    assert.equal(invalid.ok, false, '越界档案必须被拒绝');
    const fields = invalid.errors.map((entry) => entry.field);
    assert.deepEqual(fields, ['ageYears', 'heightMm', 'weightGrams', 'bodyFatPermille'], '应逐字段给出校验错误');
    assert.equal(ctx.store.peekState().profileRevision, 0, '非法档案不得递增 profileRevision');

    const derived = ctx.store.saveProfile(
      profileDraft({ goalType: 'manual', manualTargets: manualTargets({ derivedFields: ['proteinDg'] }) }),
    );
    assert.equal(derived.ok, false, '前端不得派生手动目标字段');
    assert.match(derived.message, /不允许自行派生/, '派生拒绝原因应可见');

    assert.equal(ctx.store.saveProfile(profileDraft()).ok, true, '合法档案应保存成功');
    assert.equal(ctx.store.peekState().profileRevision, 1, '首次合法保存后 revision 应为 1');
    assert.equal(ctx.store.peekState().profileDraft.heightMm, 1750, '档案必须以 mm 保存（输入层负责换算）');
    assert.equal(ctx.store.saveProfile(profileDraft({ weightGrams: 71000 })).ok, true, '第二次保存应成功');
    assert.equal(ctx.store.peekState().profileRevision, 2, '每次合法保存 profileRevision 递增');
    assert.equal(ctx.store.peekState().profileDraft.weightGrams, 71000, '第二次保存应覆盖体重（g）');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 3) 目标状态映射
// ---------------------------------------------------------------------------

test('3a 目标映射 Ok：daily/mealReference 来自真实 WASM，状态可用', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    const outcome = await ctx.store.computeTarget();
    assert.equal(outcome.ok, true, '正常档案目标计算应成功');
    assert.equal(outcome.status, 'Ok', '正常成年男性减脂目标状态应为 Ok');
    const target = ctx.store.getProfileView().target;
    assert.equal(target.available, true, 'Ok 目标应标记 available');
    assert.deepEqual(target.daily, { energyKcal: 2370, proteinDg: 840, fatDg: 711, carbDg: 3485 }, 'daily 目标值必须来自包内 WASM');
    assert.equal(target.bmiLabel, '22.9', 'BMI 展示值必须来自核心（前端不计算）');
    assert.ok(target.mealReference && target.mealReference.breakfast && target.mealReference.dinner, '应有三餐参考目标');
    assert.match(target.sourceLabel, /REE 1699 kcal/, '目标来源应给出核心 REE');
    assert.match(target.sourceLabel, /活动系数 ×1\.550/, '目标来源应给出活动系数');
    assert.equal(target.manualStored, false, '非手动目标不应标记手动存证');
    assert.equal(ctx.store.peekState().target.profileRevision, 1, '目标缓存应绑定 profileRevision');
  } finally {
    ctx.close();
  }
});

test('3b 目标映射 MANUAL_TARGET_INCOMPLETE：保存手动目标但不应用、不生成 daily', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft({ goalType: 'manual', manualTargets: manualTargets({ proteinDg: null, fatDg: null, carbDg: null }) }));
    const outcome = await ctx.store.computeTarget();
    assert.equal(outcome.status, 'MANUAL_TARGET_INCOMPLETE', '手动目标缺宏量时状态应为 MANUAL_TARGET_INCOMPLETE');
    const target = ctx.store.getProfileView().target;
    assert.equal(target.available, false, '不完整手动目标不可用于自动规划');
    assert.equal(target.manualStored, true, '用户输入的手动目标应原样保存（存证）');
    assert.equal(target.manualApplied, false, '不完整手动目标不得应用');
    assert.equal(target.daily, null, '缺项时不得给出 daily 目标');
    assert.match(target.message, /手动目标已存证但未应用/, '页面必须能看到未应用原因');
  } finally {
    ctx.close();
  }
});

test('3c 目标映射 TargetUnavailable：过轻 + 手动完整 → UNDERWEIGHT/MANUAL_STORAGE_ONLY，不应用', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft({ weightGrams: 50000, goalType: 'manual', manualTargets: manualTargets() }));
    const outcome = await ctx.store.computeTarget();
    assert.equal(outcome.ok, true, '目标计算本身应成功返回状态');
    assert.equal(outcome.status, 'AUTO_TARGET_DISABLED', '过轻且手动目标只存证时状态应为 AUTO_TARGET_DISABLED');
    const target = ctx.store.getProfileView().target;
    assert.equal(target.available, false, '目标不可用');
    assert.deepEqual(target.reasons, ['UNDERWEIGHT', 'MANUAL_STORAGE_ONLY'], '适用性原因应为 UNDERWEIGHT + MANUAL_STORAGE_ONLY');
    assert.equal(target.manualStored, true, '手动目标应存证');
    assert.equal(target.manualApplied, false, '手动目标不得应用');
    assert.equal(target.bmiLabel, '16.3', 'BMI 必须来自核心（过轻判定依据）');
    assert.equal(target.daily, null, '目标不可用时不得给出 daily');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 4) 真 WASM 计划成功 + plan 记录
// ---------------------------------------------------------------------------

test('4 真 WASM 计划成功：状态/planKey/flags/三餐/预算正确，并写入 plan 记录', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    await ctx.store.computeTarget();
    const outcome = await ctx.store.refreshPlan();
    assert.equal(outcome.ok, true, '真实 WASM 应返回可展示方案');
    assert.equal(outcome.status, 'OkPartial', '模拟估算数据应返回 OkPartial');
    assert.match(outcome.planKey, /^plan:[0-9a-f]{64}$/, 'planKey 必须是规范 sha256 稳定键');
    assert.equal(outcome.stale, undefined, '正常返回不应标记 stale');

    const home = ctx.store.getHomeView();
    assert.equal(home.planState, 'ok', '首页计划状态应为 ok');
    assert.equal(home.plans.length, 1, '三策略收敛后应去重为 1 套方案');
    assert.deepEqual(home.plans[0].strategies, ['primary', 'economy', 'taste'], '方案应覆盖三种策略');
    assert.equal(home.plans[0].priceCents, 2300, '计划总价应为核心给出的 2300 分');
    assert.equal(home.plans[0].priceLabel, '￥23.00', '价格展示应由分换算');
    assert.ok(home.plans[0].flags.includes('含估算数据'), '方案 flags 必须展示估算数据');
    assert.equal(home.budget.plannedTotalCents, 2300, '预算计划总价应来自核心');
    assert.equal(home.budget.plannedKnownCents, 2300, '已知计划金额应来自核心');
    assert.equal(home.budget.plannedPriceIncomplete, false, '本方案价格完整');
    assert.equal(home.meals.length, 3, '应展示三餐');
    for (const meal of home.meals) {
      assert.equal(meal.hasPlan, true, `${meal.meal} 应有推荐`);
      assert.equal(meal.windowName, '模拟主窗口', `${meal.meal} 应展示窗口名`);
      assert.equal(meal.items.length, 3, `${meal.meal} 应展示 3 个推荐项`);
      assert.ok(meal.flags.includes('含估算数据'), `${meal.meal} flags 应展示估算数据`);
      assert.ok(meal.items.every((item) => item.estimated === true), `${meal.meal} 每项都应标记估算`);
    }
    assert.ok(
      JSON.parse(currentDay(ctx.store).plan.rawText).result.plans[0].flags.includes('ESTIMATED_DATA'),
      '核心原始 flags 应含 ESTIMATED_DATA（页面展示为中文标签）',
    );
    assert.deepEqual(
      home.meals[1].items.map((item) => item.offerId),
      ['offer-chicken', 'offer-rice-full', 'offer-rice-half'],
      '午餐推荐应与核心结果一致',
    );

    const record = currentDay(ctx.store).plan;
    assert.ok(record, '成功计划必须写入 plan 记录');
    assert.equal(record.requestId, `req-${DATE_A}-1`, 'plan 记录 requestId 应与请求一致');
    assert.equal(record.profileRevision, 1, 'plan 记录应绑定 profileRevision');
    assert.equal(record.menuVersion, 'menu-simulated-v2', 'plan 记录应绑定 menuVersion');
    assert.ok(record.rawText.includes('"planKey"'), 'plan 记录应保留原始响应文本');
    assert.equal(ctx.store.getLastPlanRaw(), record.rawText, 'getLastPlanRaw 应返回同一份原始响应');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 5) 重复确认幂等
// ---------------------------------------------------------------------------

test('5 重复确认幂等：只保留 1 条 active，汇总不翻倍', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    await ctx.store.refreshPlan();
    const first = ctx.store.confirmMeal('lunch', {});
    assert.equal(first.ok, true, '首次确认应成功');
    assert.equal(first.duplicate, undefined, '首次确认不应标记 duplicate');
    assert.equal(currentDay(ctx.store).logs.length, 1, '首次确认只写入 1 条记录');
    const log = currentDay(ctx.store).logs[0];
    const planKey = JSON.parse(currentDay(ctx.store).plan.rawText).result.plans[0].planKey;
    assert.equal(log.confirmationId, `conf-plan-${DATE_A}-lunch-${planKey}`, '确认幂等键应为 conf-plan-<date>-<meal>-<planKey>');
    assert.equal(log.items.length, 3, '确认记录应包含方案中的 3 项');
    assert.equal(log.businessDate, DATE_A, '记录业务日期应为当前业务日期');

    const second = ctx.store.confirmMeal('lunch', {});
    assert.equal(second.ok, true, '重复确认应幂等成功');
    assert.equal(second.duplicate, true, '重复确认必须标记 duplicate');
    assert.equal(currentDay(ctx.store).logs.length, 1, '重复确认不得新增记录');
    const intake = ctx.store.getLogsView().intake;
    assert.equal(intake.priceKnownCents, 1000, '重复确认后实际消费不得翻倍');
    assert.equal(intake.itemCount, 3, '重复确认后条目数不得翻倍');
    assert.equal(intake.energyKcal, 513, '重复确认后能量汇总不得翻倍');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 6) 改记录
// ---------------------------------------------------------------------------

test('6 改记录：新 active 记录 supersedes 旧记录、旧记录变 superseded、汇总同步', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    await ctx.store.refreshPlan();
    ctx.store.confirmMeal('lunch', {});
    const oldRecordId = currentDay(ctx.store).logs[0].recordId;
    const oldItemKey = currentDay(ctx.store).logs[0].items[0].itemKey;

    const edited = ctx.store.editLog(oldRecordId, { items: [{ itemKey: oldItemKey, quantity: 2 }] });
    assert.equal(edited.ok, true, '改记录应成功');
    const logs = currentDay(ctx.store).logs;
    assert.equal(logs.length, 2, '改记录应追加新记录、保留旧记录');
    const oldLog = logs.find((entry) => entry.recordId === oldRecordId);
    assert.equal(oldLog.status, 'superseded', '旧记录必须标记 superseded');
    const active = logs.filter((entry) => entry.status === 'active');
    assert.equal(active.length, 1, '同一餐只能有 1 条 active 记录');
    const newRecord = active[0];
    assert.equal(newRecord.revision, 2, '新记录 revision 应为 2');
    assert.equal(newRecord.supersedesRecordId, oldRecordId, '新记录应指向被替代记录');
    assert.equal(newRecord.confirmationId, oldLog.confirmationId + '-rev2', '新确认键应带修订号');
    assert.notEqual(newRecord.recordId, oldRecordId, '新记录必须有新 recordId');

    const view = ctx.store.getLogsView();
    assert.equal(view.meals[1].active.length, 1, '记餐页应只有 1 条有效记录');
    assert.equal(view.meals[1].history.length, 1, '记餐页应展示 1 条历史记录');
    assert.equal(view.meals[1].history[0].status, 'superseded', '历史记录状态应为 superseded');
    assert.equal(view.intake.itemCount, 4, '数量翻倍后条目数应为 4');
    assert.deepEqual(
      { energyKcal: view.intake.energyKcal, proteinDg: view.intake.proteinDg, fatDg: view.intake.fatDg, carbDg: view.intake.carbDg },
      { energyKcal: 678, proteinDg: 686, fatDg: 81, carbDg: 774 },
      '改记录后营养汇总必须同步为 2 份鸡胸 + 米饭',
    );
    assert.equal(view.intake.priceKnownCents, 1800, '改记录后实际消费应同步为 18.00 元');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 7) 撤销 + 跨餐计划只算未吃餐
// ---------------------------------------------------------------------------

test('7 撤销后汇总回落；已确认餐次不再进入 planningMeals', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    await ctx.store.refreshPlan();
    ctx.store.confirmMeal('lunch', {});
    const active = currentDay(ctx.store).logs[0];
    assert.equal(ctx.store.revokeLog(active.recordId).ok, true, '撤销 active 记录应成功');
    const logs = ctx.store.getLogsView();
    assert.equal(logs.meals[1].active.length, 0, '撤销后该餐不应有 active 记录');
    assert.equal(logs.meals[1].history[0].status, 'revoked', '撤销记录应保留为 revoked 历史');
    assert.equal(logs.intake.energyKcal, 0, '撤销后能量汇总回落到 0（不回显旧值）');
    assert.equal(logs.intake.priceKnownCents, 0, '撤销后实际消费回落到 0');
    assert.equal(ctx.store.getHomeView().progress.confirmedMeals, 0, '撤销后已确认餐次计数应回落');

    // 已确认餐次不参与规划
    ctx.store.confirmMeal('breakfast', {});
    const outcome = await ctx.store.refreshPlan();
    assert.equal(outcome.ok, true, '确认早餐后仍应为其余餐次生成方案');
    assert.deepEqual(planRequest(ctx.store).planningMeals, ['lunch', 'dinner'], 'planningMeals 只能包含未确认/未结束的餐次');
    assert.equal(ctx.store.getHomeView().progress.confirmedMeals, 1, '进度应为 1 / 3 餐已确认');
    assert.equal(ctx.store.getHomeView().progress.text, '1 / 3 餐已确认', '进度文案应一致');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 8) 补记未知价格/未知营养
// ---------------------------------------------------------------------------

test('8 补记未知价格/营养：标不完整、未知不当 0、预算核算不完整', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    ctx.store.saveSettings({ budgetCents: 3000 });
    const unknown = ctx.store.addManualLog('dinner', {
      name: '未知小吃',
      portionCode: 'full',
      quantity: 1,
      unitPriceCents: null,
      priceKnown: false,
      nutrition: null,
      note: null,
      clientToken: 'tok-unknown',
    });
    assert.equal(unknown.ok, true, '未知价格/营养的补记应允许记录');
    const duplicate = ctx.store.addManualLog('dinner', {
      name: '未知小吃',
      portionCode: 'full',
      quantity: 1,
      unitPriceCents: null,
      priceKnown: false,
      nutrition: null,
      clientToken: 'tok-unknown',
    });
    assert.equal(duplicate.duplicate, true, '同一 clientToken 重复提交必须幂等');
    assert.equal(currentDay(ctx.store).logs.length, 1, '重复提交不得新增补记');

    const logs = ctx.store.getLogsView();
    const dinner = logs.meals[2].active[0];
    assert.equal(dinner.items[0].priceKnown, false, '未知价格项必须标记 priceKnown=false');
    assert.equal(dinner.items[0].unitPriceCents, null, '未知价格不得写 0');
    // U05 起未知实付统一显示“实付未填”（utils/money-display.ts 的 PRICE_PENDING）；此处按现文案断言。
    assert.equal(dinner.items[0].priceLabel, '实付未填', '未知实付必须显示“实付未填”');
    assert.equal(dinner.items[0].nutrition, null, '未知营养不得伪造数值');
    assert.equal(dinner.items[0].energyLabel, '营养未知', '未知营养必须显示“营养未知”');
    assert.equal(dinner.unknownItemCount, 1, '应统计 1 个未知项');
    assert.equal(logs.intake.energyKcal, null, '未知营养汇总必须为 null 而不是 0');
    assert.deepEqual(logs.intake.incompleteNutrients, ['能量', '蛋白质', '脂肪', '碳水'], '四项营养都应标不完整');
    assert.equal(logs.intake.energyLabel, '未知', '未知能量标签应为“未知”');
    assert.equal(logs.intake.priceIncomplete, true, '实际消费应标价格不完整');
    assert.equal(logs.budget.spentKnownCents, 0, '未知价格不计入已知支出（也不当 0 断言完整）');
    assert.equal(logs.budget.spentPriceIncomplete, true, '预算视图应标出实际消费价格不完整');
    assert.equal(logs.budget.accountingComplete, false, '存在未知价格时预算核算必须不完整');
    assert.equal(logs.budget.withinBudgetKnown, false, '预算核算不完整时不得声称在预算内');
    assert.match(logs.budget.message, /预算核算不完整/, '预算区必须显示核算不完整');
    // U05 起用“实付待补全/含未填项”表达未知实付，不再用“（不完整）”冒充真实花费。
    assert.equal(logs.budget.spentLabel, '实付待补全', '未知且无已知金额时应显示“实付待补全”，不得显示 ￥0.00');

    // 已知补记（数量 2、价格 250 分、营养完整）参与汇总
    const known = ctx.store.addManualLog('breakfast', {
      name: '自带面包',
      portionCode: 'full',
      quantity: 2,
      unitPriceCents: 250,
      priceKnown: true,
      nutrition: { energyKcal: 300, proteinDg: 80, fatDg: 40, carbDg: 500 },
      clientToken: 'tok-known',
    });
    assert.equal(known.ok, true, '已知补记应成功');
    const after = ctx.store.getLogsView();
    assert.equal(after.intake.priceKnownCents, 500, '已知补记应按 2 × 250 分累计');
    assert.equal(after.meals[0].active[0].knownSums.energyKcal, 600, '已知营养应按数量翻倍');
    assert.equal(after.intake.energyKcal, null, '仍存在未知营养项时全天汇总保持不完整（null）');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 9) 结束/重开餐次
// ---------------------------------------------------------------------------

test('9 结束/重开餐次影响 planningMeals', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    assert.equal(ctx.store.endMeal('dinner').ok, true, '结束晚餐应成功');
    assert.equal(ctx.store.endMeal('dinner').ok, true, '重复结束应幂等');
    await ctx.store.refreshPlan();
    assert.deepEqual(planRequest(ctx.store).planningMeals, ['breakfast', 'lunch'], '结束后晚餐不得进入 planningMeals');
    const home = ctx.store.getHomeView();
    assert.equal(home.meals[2].ended, true, '首页应标记晚餐已结束');
    assert.equal(home.meals[2].hasPlan, false, '已结束餐次不应有推荐');
    assert.match(home.meals[2].statusMessage, /已由用户结束/, '已结束状态应有可见说明');

    assert.equal(ctx.store.reopenMeal('dinner').ok, true, '重开晚餐应成功');
    assert.equal(ctx.store.reopenMeal('dinner').ok, false, '未结束的餐次不能重开');
    await ctx.store.refreshPlan();
    assert.deepEqual(planRequest(ctx.store).planningMeals, ['breakfast', 'lunch', 'dinner'], '重开后晚餐重新进入 planningMeals');
    assert.equal(ctx.store.getHomeView().meals[2].ended, false, '重开后应清除结束标记');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 10) 预算 0 / 极小
// ---------------------------------------------------------------------------

test('10 预算 0/极小：NoFeasibleWithinBudget + overBudget，超预算备选明确标注', async () => {
  for (const budget of [0, 1]) {
    const ctx = openStore();
    try {
      ctx.store.saveProfile(profileDraft());
      assert.equal(ctx.store.saveSettings({ budgetCents: budget }).ok, true, `预算 ${budget} 分是合法设置（0 表示零预算）`);
      const outcome = await ctx.store.refreshPlan();
      assert.equal(outcome.status, 'NoFeasibleWithinBudget', `预算 ${budget} 分应返回 NoFeasibleWithinBudget`);
      const home = ctx.store.getHomeView();
      assert.equal(home.budget.budgetSet, true, '预算应标记为已设置');
      assert.equal(home.budget.budgetCents, budget, '预算视图应回显设置值');
      assert.equal(home.budget.overBudget, true, `预算 ${budget} 分方案应标记超预算`);
      assert.equal(home.budget.withinBudgetKnown, false, '超预算时不得声称在预算内');
      assert.match(home.budget.message, /已超出预算/, '预算区必须醒目提示超预算');
      assert.ok(home.flags.includes('超预算备选'), '首页 flags 应显示超预算备选');
      assert.equal(home.budget.accountingComplete, true, '价格已知时预算核算应完整');
      if (budget === 0) {
        assert.equal(home.budget.remainingKnownCents, 0, '零预算剩余可用应为 0');
        assert.equal(home.budget.overageCents, 2300, '超支金额应等于计划总价');
        assert.equal(home.plans.length, 1, '仍应展示明确标注的超预算备选方案');
      }
    } finally {
      ctx.close();
    }
  }
});

// ---------------------------------------------------------------------------
// 11) TargetUnavailable 不产生假方案
// ---------------------------------------------------------------------------

test('11 TargetUnavailable：不生成假方案，plans 为空、首页提示不可规划', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft({ weightGrams: 50000, goalType: 'manual', manualTargets: manualTargets() }));
    await ctx.store.computeTarget();
    const outcome = await ctx.store.refreshPlan();
    assert.equal(outcome.ok, false, 'TargetUnavailable 不应返回可展示方案');
    assert.equal(outcome.status, 'TargetUnavailable', '计划状态应为 TargetUnavailable');
    assert.equal(outcome.planKey, null, 'TargetUnavailable 不得产生 planKey');
    const home = ctx.store.getHomeView();
    assert.equal(home.plans.length, 0, 'TargetUnavailable 时不得显示任何方案');
    assert.equal(home.planState, 'no-plan', '首页计划状态应为 no-plan');
    assert.ok(home.meals.every((meal) => meal.hasPlan === false), '所有餐次都不得出现假推荐');
    assert.match(home.planMessage, /营养目标不可用于自动规划/, '首页必须解释为何没有方案');
    assert.equal(home.budget.plannedTotalCents, null, '没有方案时不得显示计划总价');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 12) 搜索限额口径：请求固定发契约四字段；ResourceLimited 不冒充无解
// ---------------------------------------------------------------------------

test('12 搜索限额：请求只发契约四字段 limits，旧 settings.limits 不进入请求；ResourceLimited 不产生方案也不冒充无解', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    // 现行 saveSettings 仍接受旧 T02 形状（types.ts 旧 limits 清理属 T06），
    // 但 domain/plan.ts 已固定发送契约 §4 四字段，旧设置不得再影响请求或截断搜索。
    assert.equal(ctx.store.saveSettings({ limits: { maxNodes: 3 } }).ok, true, '当前 saveSettings 仍接受旧 T02 limits 形状');
    const outcome = await ctx.store.refreshPlan();

    const request = planRequest(ctx.store);
    assert.deepEqual(
      request.plannerConfig.limits,
      { maxMealCandidatesPerMeal: 256, maxDpStates: 32, maxSearchNodes: 200000, wallClockMs: null },
      '请求必须携带现行契约四字段（plan.ts 固定值；三餐默认走 A14 有界 DP32）',
    );
    assert.equal(Object.keys(request.plannerConfig.limits).length, 4, 'limits 只允许契约四字段');
    const serialized = JSON.stringify(request);
    for (const oldField of ['maxNodes', 'maxCandidates']) {
      assert.equal(serialized.includes(oldField), false, `不得向 A11 核心发送旧 T02 限额字段 ${oldField}`);
    }
    // 旧 limits 已不再截断搜索：真实核心照常给出方案，不产生假 ResourceLimited。
    assert.equal(outcome.ok, true, '四字段限额下真实核心应正常给出方案');
    assert.equal(outcome.status, 'OkPartial', '不得因旧 settings.limits 返回 ResourceLimited');

    // ResourceLimited 的展示语义仍要检查：用合法但极小的 maxSearchNodes=3 夹具请求驱动真实核心，
    // 再走与首页相同的 interpretPlanResult 映射，确认"限额耗尽≠无解、也不给假方案"。
    const fixture = await ctx.store.runFixture('resourceLimited');
    assert.equal(fixture.status, 'ResourceLimited', 'maxSearchNodes=3 的真实核心响应应为 ResourceLimited');
    const envelope = JSON.parse(fixture.rawText);
    assert.equal(envelope.result.plans.length, 0, 'ResourceLimited 不得返回任何方案');
    const interpretation = interpretPlanResult(
      envelope,
      ctx.store.peekState(),
      currentDay(ctx.store),
      FIXTURE_CASES.success.request.catalog,
    );
    assert.equal(interpretation.status, 'ResourceLimited', '首页映射状态应为 ResourceLimited');
    assert.equal(interpretation.plans.length, 0, '限额耗尽后首页不得显示假方案');
    assert.ok(
      interpretation.diagnostics.some((entry) => entry.code === 'SEARCH_LIMIT_REACHED'),
      '诊断应包含 SEARCH_LIMIT_REACHED',
    );
    assert.match(interpretation.message, /搜索达到合法限额/, '首页必须说明限额耗尽不等于无解');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 13) 能力门：comboRules 非空不发送给核心
// ---------------------------------------------------------------------------

test('13 能力门：greedy / dp / branchAndBound 可保存，其他算法与 comboRules 非空不发送；comboRules 非空菜单只显示不可规划', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    const rejectAlgorithm = ctx.store.saveSettings({ algorithm: 'dynamicProgramming' });
    assert.equal(rejectAlgorithm.ok, false, 'saveSettings 必须拒绝非受支持算法');
    assert.match(rejectAlgorithm.message, /只支持 greedy \/ dp/, '拒绝原因应可见');
    const acceptDp = ctx.store.saveSettings({ algorithm: 'dp' });
    assert.equal(acceptDp.ok, true, 'saveSettings 必须接受受支持的 dp');
    assert.equal(ctx.store.peekState().settings.algorithm, 'dp', 'dp 设置应写入状态');
    const acceptBnb = ctx.store.saveSettings({ algorithm: 'branchAndBound' });
    assert.equal(acceptBnb.ok, true, 'saveSettings 必须接受受支持的 branchAndBound');
    assert.equal(ctx.store.peekState().settings.algorithm, 'branchAndBound', 'branchAndBound 设置应写入状态');
    assert.equal(ctx.store.saveSettings({ algorithm: 'greedy' }).ok, true, '应可切回默认贪心');

    // 通过“恢复”注入 comboRules 非空的菜单（模拟导入到旧版本数据），再验证调用前能力门
    ctx.store.saveSettings({ budgetCents: 3000 });
    const exported = await ctx.store.exportBackup();
    const bundle = JSON.parse(exported.text);
    bundle.state.catalog = structuredClone(FIXTURE_CASES.success.request.catalog);
    bundle.state.catalog.comboRules = [{ ruleId: 'combo-r1' }];
    bundle.state.catalog.catalogHash = canonicalSha256(bundle.state.catalog, 'catalogHash');
    bundle.digest = canonicalSha256(bundle.state);
    const pre = await ctx.store.preflightRestore(JSON.stringify(bundle));
    assert.equal(pre.ok, true, '带 comboRules 的备份应通过格式/摘要校验（结构本身合法）');
    await ctx.store.applyRestore(pre);

    const home = ctx.store.getHomeView();
    assert.equal(home.planState, 'unsupported', 'comboRules 非空时首页应为 unsupported');
    assert.match(home.planMessage, /comboRules=\[\]/, '首页必须说明只支持空套餐规则');
    assert.equal(home.canPlan, false, '不受支持时不得允许规划');
    assert.equal(ctx.store.getLastPlanRequest(), null, '尚未发送任何 PlanRequest');
    const outcome = await ctx.store.refreshPlan();
    assert.equal(outcome.ok, false, '能力门应在调用核心前拒绝');
    assert.match(outcome.message, /受支持能力不允许/, '拒绝原因应可见');
    assert.equal(ctx.store.getLastPlanRequest(), null, '被能力门拒绝时不得向核心发送请求');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 14) 售罄作用域与跨日隔离
// ---------------------------------------------------------------------------

test('14 售罄作用域：按餐次+窗口+dishId，跨日不继承、不静默影响其他餐', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    await ctx.store.refreshPlan();
    assert.equal(ctx.store.markSoldOut('lunch', 'dish-chicken').ok, true, '标记午餐鸡胸售罄应成功');
    assert.equal(ctx.store.markSoldOut('lunch', 'dish-chicken').ok, true, '重复标记应幂等成功');
    assert.equal(currentDay(ctx.store).soldOut.length, 1, '重复标记不得产生第二条记录');
    const mark = currentDay(ctx.store).soldOut[0];
    assert.equal(mark.businessDate, DATE_A, '售罄标记必须绑定业务日期');
    assert.equal(mark.windowId, 'w-main', '售罄标记必须绑定窗口');
    assert.equal(mark.meal, 'lunch', '售罄标记必须绑定餐次');
    assert.equal(mark.dishId, 'dish-chicken', '售罄标记必须绑定稳定 dishId');
    assert.equal(ctx.store.markSoldOut('breakfast', 'dish-chicken').ok, false, '不供应此餐的菜品不得标记售罄');
    assert.equal(ctx.store.markSoldOut('lunch', 'dish-unknown').ok, false, '未知菜品不得标记售罄');
    assert.deepEqual(ctx.store.getHomeView().soldOutMarks.map((entry) => entry.label), ['午餐 · 清蒸鸡胸'], '首页应展示售罄标记');

    await ctx.store.refreshPlan();
    const lunch = ctx.store.getHomeView().meals[1];
    assert.equal(lunch.items.some((item) => item.dishId === 'dish-chicken'), false, '售罄菜品不得出现在新方案中');
    const breakfast = ctx.store.getHomeView().meals[0];
    assert.equal(breakfast.items.some((item) => item.dishId === 'dish-chicken'), false, '早餐本就不供应鸡胸');

    // 跨日隔离
    ctx.store.toggleWindowLock('lunch');
    const oldDayBefore = JSON.parse(JSON.stringify(currentDay(ctx.store)));
    ctx.clock.set(`${DATE_B}T12:00:00+08:00`);
    assert.equal(ctx.store.ensureToday(), true, '跨日应创建新的一天');
    const home = ctx.store.getHomeView();
    assert.equal(home.businessDate, DATE_B, '首页业务日期应切到新的一天');
    assert.deepEqual(home.soldOutMarks, [], '新的一天不得继承昨天售罄');
    assert.deepEqual(currentDay(ctx.store).windowLocks, [], '新的一天不得继承昨天锁定');
    assert.equal(currentDay(ctx.store).logs.length, 0, '新的一天不得迁移昨天摄入');
    const oldDay = ctx.store.peekState().days[DATE_A];
    assert.deepEqual(oldDay.soldOut, oldDayBefore.soldOut, '旧日售罄记录必须保留');
    assert.deepEqual(oldDay.windowLocks, oldDayBefore.windowLocks, '旧日锁定记录必须保留');
    assert.equal(ctx.store.getLogsView(DATE_A).meals.some((meal) => meal.canConfirm), false, '历史日期只读，不得提供确认入口');

    // 解除售罄（回到今天前先切回旧日无法操作，改为新的一天重新标记后解除）
    assert.equal(ctx.store.clearSoldOut('lunch', 'dish-chicken').ok, false, '今天没有该售罄标记，解除应失败');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 15) 锁定失效 LockConflict
// ---------------------------------------------------------------------------

test('15 锁定失效：导入删除被锁定报价的菜单后保留锁定，refreshPlan 返回 LockConflict 不静默解锁', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    await ctx.store.refreshPlan();
    assert.equal(ctx.store.toggleItemLock('lunch', 'offer-greens').ok, true, '锁定午餐青菜应成功');
    const requestBefore = ctx.store.getLastPlanRequest();

    const catalog = newCatalogFromFixture((next) => {
      next.menuVersion = 'menu-imported-v2';
      next.offers = next.offers.filter((offer) => offer.offerId !== 'offer-greens');
      next.dishes = next.dishes.filter((dish) => dish.dishId !== 'dish-greens');
    });
    const preflight = await ctx.store.preflightMenu(JSON.stringify(catalog), 'menu-v2.json');
    assert.equal(preflight.ok, true, '新菜单应通过核心预检');
    assert.equal(preflight.diff.invalidLocks.length, 1, '预检必须列出 1 条将失效的锁定');
    assert.equal(preflight.diff.invalidLocks[0].meal, 'lunch', '失效锁定应标明餐次');
    assert.equal(ctx.store.applyMenu(preflight).ok, true, '用户确认后应替换菜单');

    const day = currentDay(ctx.store);
    assert.equal(day.plan, null, '菜单替换后旧计划必须失效');
    assert.deepEqual(day.itemLocks.map((lock) => lock.offerId), ['offer-greens'], '失效锁定必须保留记录，不能静默解锁');
    assert.equal(ctx.store.getMenuView().info.menuVersion, 'menu-imported-v2', '菜单版本应已替换');

    const outcome = await ctx.store.refreshPlan();
    assert.equal(outcome.ok, false, '锁定失效时不得生成方案');
    assert.equal(outcome.status, 'LockConflict', '锁定失效应返回 LockConflict');
    assert.ok(outcome.planKey === undefined || outcome.planKey === null, 'LockConflict 不得产生 planKey');
    assert.match(outcome.message, /锁定失效/, '失败原因应可见');
    assert.equal(ctx.store.getLastPlanRequest(), requestBefore, 'LockConflict 必须在前端拦截，不调用核心');
    const home = ctx.store.getHomeView();
    assert.equal(home.planState, 'lock-conflict', '首页应为 lock-conflict 状态');
    assert.equal(home.lockIssues.length, 1, '首页应列出 1 条失效锁定');
    assert.match(home.lockIssues[0].reason, /已不在菜单中/, '失效锁定应给出可定位原因');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 16) 同窗换菜
// ---------------------------------------------------------------------------

test('16 同窗换菜：swapOffer 重算后含新菜、不含被换菜、锁定同步', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    await ctx.store.refreshPlan();
    const lunch = ctx.store.getHomeView().meals[1];
    const removeOfferId = lunch.items.find((item) => item.offerId === 'offer-chicken').offerId;
    const addOfferId = lunch.swappableOffers.find((offer) => offer.offerId === 'offer-greens').offerId;
    const beforePlanKey = JSON.parse(currentDay(ctx.store).plan.rawText).result.plans[0].planKey;

    const outcome = await ctx.store.swapOffer('lunch', removeOfferId, addOfferId);
    assert.equal(outcome.ok, true, '同窗换菜应成功重算');
    assert.equal(outcome.status, 'OkPartial', '换菜后方案状态仍应为 OkPartial');
    assert.notEqual(outcome.planKey, beforePlanKey, '换菜后应绑定新方案');
    const after = ctx.store.getHomeView().meals[1];
    assert.ok(after.items.some((item) => item.offerId === 'offer-greens'), '换菜后应包含新菜');
    assert.equal(after.items.some((item) => item.offerId === removeOfferId), false, '换菜后不得包含被换掉的菜');
    const locks = currentDay(ctx.store).itemLocks.filter((lock) => lock.meal === 'lunch');
    assert.deepEqual(locks.map((lock) => lock.offerId).sort(), ['offer-greens', 'offer-rice-full', 'offer-rice-half'], '换菜应把整餐锁定同步到核心');

    assert.equal((await ctx.store.swapOffer('lunch', 'offer-not-exist', 'offer-greens')).ok, false, '不存在的报价应被拒绝');
    const breakfastSwap = await ctx.store.swapOffer('breakfast', 'offer-mantou', 'offer-greens');
    assert.equal(breakfastSwap.ok, false, '目标菜不供应早餐时应拒绝');
    assert.match(breakfastSwap.message, /不供应此餐/, '拒绝原因应可见');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 17) 菜单预检 / 取消 / 写入失败 / 成功替换
// ---------------------------------------------------------------------------

test('17 菜单导入：非法/取消/写入失败保留原数据；成功替换后旧计划失效并绑定新 menuVersion', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    await ctx.store.refreshPlan();

    // 17a 非法菜单
    const invalid = await ctx.store.preflightMenu('{"windows":[]}', 'bad.json');
    assert.equal(invalid.ok, false, '非法菜单预检必须失败');
    assert.equal(invalid.stage, 'parse', '结构缺失应在 parse 阶段失败');
    assert.equal(invalid.token, null, '失败预检不得签发 token');
    assert.equal(ctx.store.getMenuView().info.menuVersion, 'menu-simulated-v2', '失败预检不得改变菜单');

    // 17b 合法预检 + 取消（不调用 applyMenu）
    const catalog = newCatalogFromFixture((next) => {
      next.menuVersion = 'menu-imported-v3';
      next.canteen = { canteenId: 'canteen-imported', name: '导入测试食堂' };
      next.offers = next.offers.filter((offer) => offer.offerId !== 'offer-greens');
      next.dishes = next.dishes.filter((dish) => dish.dishId !== 'dish-greens');
    });
    const preflight = await ctx.store.preflightMenu(JSON.stringify(catalog), 'menu-v3.json');
    assert.equal(preflight.ok, true, '合法菜单预检应通过真实 WASM');
    assert.equal(preflight.stage, 'ready', '预检成功应为 ready');
    assert.match(preflight.message, /预检通过/, '预检结果应可读');
    assert.equal(typeof preflight.token, 'string', '成功预检必须签发 token');
    assert.equal(preflight.diff.oldMenuVersion, 'menu-simulated-v2', '差异应列出旧版本');
    assert.equal(preflight.diff.newMenuVersion, 'menu-imported-v3', '差异应列出新版本');
    assert.deepEqual(preflight.diff.dishesRemoved, ['清炒青菜'], '差异应列出被删菜品');
    // 取消：不应用 → 菜单/计划保持
    assert.equal(ctx.store.getMenuView().info.menuVersion, 'menu-simulated-v2', '取消后菜单不得改变');
    assert.ok(currentDay(ctx.store).plan, '取消后旧计划必须保留');

    // 17c 伪造/过期 token 被拒
    const forged = await ctx.store.applyMenu({ ...preflight, token: 'menu-forged' });
    assert.equal(forged.ok, false, '伪造 token 必须被拒绝');
    assert.match(forged.message, /预检凭证已失效/, '拒绝原因应可见');
    assert.equal(ctx.store.getMenuView().info.menuVersion, 'menu-simulated-v2', '凭证失效不得改变菜单');

    // 17d 写入失败：保留原菜单与计划
    ctx.mock.control.failuresAfter = ctx.mock.control.writeCount;
    const failedApply = ctx.store.applyMenu(preflight);
    assert.equal(failedApply.ok, false, '写入失败时 applyMenu 应失败');
    assert.match(failedApply.message, /保存失败，已保留原数据/, '写入失败原因应可见');
    assert.equal(ctx.store.getMenuView().info.menuVersion, 'menu-simulated-v2', '写入失败不得替换菜单');
    assert.ok(currentDay(ctx.store).plan, '写入失败不得清空旧计划');
    ctx.mock.control.failuresAfter = Infinity;

    // 17e 成功后：旧计划失效、菜单元信息更新、token 单次使用
    const applied = ctx.store.applyMenu(preflight);
    assert.equal(applied.ok, true, '恢复写入后应能替换菜单');
    const menuView = ctx.store.getMenuView();
    assert.equal(menuView.info.menuVersion, 'menu-imported-v3', '菜单版本应为新版本');
    assert.equal(menuView.info.source, 'imported', '菜单来源应为 imported');
    assert.equal(menuView.info.importedFileName, 'menu-v3.json', '应记录导入文件名');
    assert.equal(menuView.info.catalogHash, catalog.catalogHash, '菜单摘要应与导入内容一致');
    assert.equal(menuView.info.simulated, false, '导入菜单不应再标模拟');
    assert.equal(currentDay(ctx.store).plan, null, '成功替换后旧计划必须失效');
    assert.equal(ctx.store.applyMenu(preflight).ok, false, '预检 token 只能使用一次');

    // 17f 重新规划绑定新 menuVersion
    const outcome = await ctx.store.refreshPlan();
    assert.equal(outcome.ok, true, '新菜单应能生成方案');
    assert.equal(currentDay(ctx.store).plan.menuVersion, 'menu-imported-v3', 'plan 记录必须绑定新 menuVersion');
    assert.equal(planRequest(ctx.store).catalog.menuVersion, 'menu-imported-v3', 'PlanRequest 必须携带新 menuVersion');

    // 17g 缺少 catalogHash 时按规范补算
    const noHashCatalog = structuredClone(FIXTURE_CASES.success.request.catalog);
    delete noHashCatalog.catalogHash;
    noHashCatalog.menuVersion = 'menu-nohash-v1';
    const injected = await ctx.store.preflightMenu(JSON.stringify(noHashCatalog), 'nohash.json');
    assert.equal(injected.ok, true, '缺 catalogHash 的菜单应补算后通过预检');
    assert.equal(injected.catalog.catalogHash, canonicalSha256(noHashCatalog, 'catalogHash'), '补算摘要必须符合 T01 §0.3 口径');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 18) 写入失败不破坏内存与已存数据
// ---------------------------------------------------------------------------

test('18 写入失败：内存状态与已持久化数据均保持原样', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    ctx.store.saveSettings({ budgetCents: 3000 });
    const rawBefore = ctx.mock.raw(STORAGE_KEY);
    const stateBefore = JSON.stringify(ctx.store.peekState());

    ctx.mock.control.failuresAfter = ctx.mock.control.writeCount;
    const result = ctx.store.saveSettings({ maxItemsPerMeal: 5 });
    assert.equal(result.ok, false, '存储写入失败时保存必须失败');
    assert.match(result.message, /保存失败，已保留原数据/, '失败信息应说明数据已保留');
    assert.equal(JSON.stringify(ctx.store.peekState()), stateBefore, '写入失败不得改动内存状态');
    assert.equal(ctx.store.peekState().settings.maxItemsPerMeal, 3, '写入失败后内存设置保持原值');
    assert.equal(ctx.mock.raw(STORAGE_KEY), rawBefore, '写入失败不得改动已持久化数据');

    // 失败后恢复写入仍可继续
    ctx.mock.control.failuresAfter = Infinity;
    assert.equal(ctx.store.saveSettings({ maxItemsPerMeal: 5 }).ok, true, '恢复写入后应可继续保存');
    assert.equal(ctx.store.peekState().settings.maxItemsPerMeal, 5, '恢复后设置应更新');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 19) 导出 → 恢复
// ---------------------------------------------------------------------------

test('19a 导出→恢复：摘要一致、关键状态逐项恢复、backup 恢复记录更新', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    await ctx.store.refreshPlan();
    ctx.store.confirmMeal('breakfast', {});
    const beforeHome = ctx.store.getHomeView();
    const exported = await ctx.store.exportBackup();
    assert.equal(exported.ok, true, '导出应成功');
    assert.match(exported.digest, /^sha256:[0-9a-f]{64}$/, '导出摘要必须是规范 sha256 前缀格式');
    assert.ok(exported.filePath, '有 wx 宿主时应写入本地文件');
    const bundle = JSON.parse(exported.text);
    assert.equal(bundle.format, 'tiankeshike-backup', '备份格式标识应固定');
    assert.equal(bundle.bundleVersion, 1, '备份 bundleVersion 应为 1');
    assert.equal(bundle.digest, exported.digest, '文本内摘要应与返回摘要一致');

    const pre = await ctx.store.preflightRestore(exported.text);
    assert.equal(pre.ok, true, '合法备份应通过预检');
    assert.equal(pre.stage, 'ready', '预检成功应为 ready');
    assert.equal(pre.digest, exported.digest, '预检摘要应与导出摘要一致');
    assert.match(pre.summary, /业务日期 2026-10-20/, '预检摘要应包含业务日期');
    assert.ok(pre.token, '预检应签发 token');

    const applied = await ctx.store.applyRestore(pre);
    assert.equal(applied.ok, true, '同一份备份往返恢复必须成功');
    assert.equal(applied.digest, exported.digest, '恢复返回摘要应与导出摘要一致');
    assert.equal(applied.comparison.length, 8, '恢复对照应固定 8 行');
    assert.equal(
      applied.comparison.filter((row) => !row.equal).length,
      0,
      '往返恢复后 8 行对照必须全部相等（ok 只取决于恢复内容摘要与备份文件摘要一致）',
    );
    const rows = Object.fromEntries(applied.comparison.map((row) => [row.label, row]));
    for (const label of ['业务日期', '档案 revision', '档案内容摘要', '菜单版本', '当日日志条数 / 有效', '锁定 / 售罄条数', '计划 requestId']) {
      assert.equal(rows[label].equal, true, `恢复对照“${label}”应逐项相等`);
    }
    assert.equal(rows['恢复内容摘要与备份文件一致'].equal, true, '对照第 8 行必须确认恢复内容摘要与备份文件一致');

    const restoredHome = ctx.store.getHomeView();
    assert.equal(restoredHome.requestId, beforeHome.requestId, '恢复后 plan requestId 应保持一致');
    assert.equal(restoredHome.profileSummary, beforeHome.profileSummary, '恢复后档案摘要应一致');
    assert.equal(ctx.store.getLogsView().meals[0].active.length, 1, '恢复后早餐有效记录应恢复');
    assert.equal(ctx.store.peekState().backup.lastRestoredDigest, exported.digest, '恢复后应记录 lastRestoredDigest');
    assert.ok(ctx.store.peekState().backup.lastRestoredAt, '恢复后应记录 lastRestoredAt');
  } finally {
    ctx.close();
  }
});

test('19b 恢复拒绝：损坏摘要/版本不符/缺引用被拒，失败保留当前数据', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    await ctx.store.refreshPlan();
    ctx.store.confirmMeal('lunch', {});
    const exported = await ctx.store.exportBackup();
    const rawBefore = ctx.mock.raw(STORAGE_KEY);

    const tampered = JSON.parse(exported.text);
    tampered.state.settings.budgetCents = 1234;
    const tamperedPre = await ctx.store.preflightRestore(JSON.stringify(tampered));
    assert.equal(tamperedPre.ok, false, '内容被篡改（摘要不符）必须拒绝');
    assert.match(tamperedPre.message, /摘要不一致/, '摘要错误应可定位');
    assert.equal(tamperedPre.token, null, '拒绝时不得签发 token');

    const badVersion = JSON.parse(exported.text);
    badVersion.bundleVersion = 2;
    const versionPre = await ctx.store.preflightRestore(JSON.stringify(badVersion));
    assert.equal(versionPre.ok, false, '版本不符必须拒绝');
    assert.match(versionPre.message, /版本 2 与当前 1 不兼容/, '版本错误应可定位');

    const missingRef = JSON.parse(exported.text);
    delete missingRef.state.days[missingRef.state.activeDate];
    const missingPre = await ctx.store.preflightRestore(JSON.stringify(missingRef));
    assert.equal(missingPre.ok, false, '缺少当前业务日期记录桶必须拒绝');
    assert.match(missingPre.message, /记录桶/, '缺引用原因应可定位');

    const wrongFormat = JSON.parse(exported.text);
    wrongFormat.format = 'other-app';
    const formatPre = await ctx.store.preflightRestore(JSON.stringify(wrongFormat));
    assert.equal(formatPre.ok, false, '格式标识不符必须拒绝');
    assert.match(formatPre.message, /不是天科食客备份文件/, '格式错误应可定位');

    // 失败后当前数据保持不变
    assert.equal(ctx.mock.raw(STORAGE_KEY), rawBefore, '恢复被拒后持久化数据不得改变');
    assert.equal(ctx.store.peekState().profileRevision, 1, '恢复被拒后内存档案 revision 不变');
    assert.equal(ctx.store.getLogsView().meals[1].active.length, 1, '恢复被拒后记餐记录保持');

    // token 失效的 applyRestore 必须失败且不改数据
    const validPre = await ctx.store.preflightRestore(exported.text);
    assert.equal(validPre.ok, true, '合法备份应可预检');
    const tamperedToken = await ctx.store.applyRestore({ ...validPre, token: 'restore-forged' });
    assert.equal(tamperedToken.ok, false, '伪造恢复 token 必须被拒绝');
    assert.match(tamperedToken.message, /预检凭证已失效/, '拒绝原因应可见');
    assert.equal(ctx.store.peekState().profileRevision, 1, '伪造 token 不得改变数据');
  } finally {
    ctx.close();
  }
});

test('19c 恢复不同状态备份：ok:true，前 7 行可显示差异，第 8 行确认摘要一致', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    await ctx.store.refreshPlan();
    ctx.store.confirmMeal('breakfast', {});
    const exported = await ctx.store.exportBackup();
    // 导出后本机继续改状态：多确认一餐 + 改预算
    ctx.store.confirmMeal('lunch', {});
    ctx.store.saveSettings({ budgetCents: 5000 });

    const pre = await ctx.store.preflightRestore(exported.text);
    assert.equal(pre.ok, true, '合法备份应可预检');
    const applied = await ctx.store.applyRestore(pre);
    assert.equal(applied.ok, true, '恢复内容摘要与备份文件一致时必须成功（即使覆盖本机新数据）');
    const rows = Object.fromEntries(applied.comparison.map((row) => [row.label, row]));
    assert.equal(rows['恢复内容摘要与备份文件一致'].equal, true, '第 8 行必须确认摘要一致');
    const mismatched = applied.comparison.filter((row, index) => !row.equal && index < 7);
    assert.ok(mismatched.length > 0, '本机恢复前已有不同数据，前 7 行应能看出差异');
    assert.match(applied.message, /与本机恢复前状态不同/, 'message 应说明差异属于正常覆盖');
    assert.equal(ctx.store.getLogsView().meals[1].active.length, 0, '恢复后午餐应回到备份时的无记录状态');
    assert.equal(ctx.store.peekState().settings.budgetCents, null, '恢复后预算应回到备份时的未设置状态');
  } finally {
    ctx.close();
  }
});

test('19d 恢复旧日期备份：整体恢复旧数据并为今天补空桶，不迁移旧摄入', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    await ctx.store.refreshPlan();
    ctx.store.confirmMeal('breakfast', {});
    const exported = await ctx.store.exportBackup();
    ctx.clock.set(`${DATE_B}T12:00:00+08:00`);
    ctx.store.ensureToday();

    const pre = await ctx.store.preflightRestore(exported.text);
    assert.equal(pre.ok, true, '旧日期备份应可预检');
    const applied = await ctx.store.applyRestore(pre);
    assert.equal(applied.ok, true, '旧日期备份摘要一致，恢复应成功');
    const comparisonRows = Object.fromEntries(applied.comparison.map((row) => [row.label, row]));
    assert.equal(comparisonRows['恢复内容摘要与备份文件一致'].equal, true, '第 8 行必须确认摘要一致');
    assert.match(applied.message, /已为今天补空记录桶/, 'message 应提示为今天补了空桶');
    const state = ctx.store.peekState();
    assert.equal(state.activeDate, DATE_B, '恢复后应把当前业务日期切到今天');
    assert.ok(state.days[DATE_B], '恢复后必须为今天补一个空桶');
    assert.equal(state.days[DATE_B].logs.length, 0, '今天空桶不得迁移旧摄入');
    assert.equal(state.days[DATE_A].logs.filter((log) => log.status === 'active').length, 1, '旧日期记录应整体恢复');
    assert.ok(applied.comparison.some((row) => row.label === '当日日志条数 / 有效'), '对照表应能看出日期桶变化');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 20) 旧响应不覆盖新输入
// ---------------------------------------------------------------------------

test('20 旧响应：连续两次 refreshPlan 与期间本地写入都使旧结果 stale，不覆盖新输入', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    const p1 = ctx.store.refreshPlan();
    const p2 = ctx.store.refreshPlan();
    const [r1, r2] = await Promise.all([p1, p2]);
    assert.equal(r1.ok, false, '先发出的方案请求结果应被丢弃');
    assert.equal(r1.stale, true, '先发出的请求应标记 stale');
    assert.equal(r2.ok, true, '最后发出的请求应生效');
    assert.equal(r2.stale, undefined, '最新请求不应标记 stale');
    const plan = currentDay(ctx.store).plan;
    assert.equal(plan.requestId, `req-${DATE_A}-2`, '只有最新一次请求（seq=2）可写 plan 记录');
    assert.equal(plan.revision, 2, 'plan 记录 revision 应为 2');

    const p3 = ctx.store.refreshPlan();
    const writeResult = ctx.store.saveSettings({ maxItemsPerMeal: 2 });
    assert.equal(writeResult.ok, true, '期间本地写入本身应成功');
    const r3 = await p3;
    assert.equal(r3.ok, false, '期间发生过本地写入，方案结果必须丢弃');
    assert.equal(r3.stale, true, '期间写入后的响应应标记 stale');
    assert.equal(currentDay(ctx.store).plan, null, '期间设置变更已使旧计划失效，过期响应不得写回 plan 记录');
    assert.equal(ctx.store.peekState().settings.maxItemsPerMeal, 2, '新设置应保留在状态中');
    assert.equal(ctx.store.getHomeView().planState, 'idle', '旧响应被丢弃后首页应回到未生成方案状态');
  } finally {
    ctx.close();
  }

  // 注入延迟 instantiate：核心首次加载被拖慢时，仍按请求序号丢弃旧结果（不依赖加载顺序）。
  const delayed = openStore({ instantiate: createRealInstantiate([80, 0]) });
  try {
    delayed.store.saveProfile(profileDraft());
    const p1 = delayed.store.refreshPlan();
    const p2 = delayed.store.refreshPlan();
    const [r1, r2] = await Promise.all([p1, p2]);
    assert.equal(r1.stale, true, '延迟加载核心时先发出的请求也应被丢弃');
    assert.equal(r2.ok, true, '延迟加载核心时最后发出的请求应生效');
    assert.equal(currentDay(delayed.store).plan.requestId, `req-${DATE_A}-2`, '延迟加载场景也只写最新 seq 的 plan 记录');
  } finally {
    delayed.close();
  }
});

// ---------------------------------------------------------------------------
// 21) 请求一致性 / revision 递增
// ---------------------------------------------------------------------------

test('21 请求一致性：requestId/profileRevision/menuVersion/tzOffsetMinutes 一致，revision 随请求递增', async () => {
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    ctx.store.saveProfile(profileDraft({ weightGrams: 71000 }));
    assert.equal(ctx.store.peekState().profileRevision, 2, '两次保存后 profileRevision 应为 2');

    const first = await ctx.store.refreshPlan();
    assert.equal(first.ok, true, '应生成方案');
    const request = planRequest(ctx.store);
    const day = currentDay(ctx.store);
    assert.equal(request.contractVersion, '1.0', '请求契约版本应为 1.0');
    assert.equal(request.requestId, `req-${DATE_A}-1`, 'requestId 应为 req-<业务日期>-<序号>');
    assert.equal(request.businessDate, DATE_A, '请求业务日期应与当日一致');
    assert.equal(request.tzOffsetMinutes, day.tzOffsetMinutes, '请求时区偏移应与状态一致');
    assert.equal(request.profile.revision, 2, '请求档案 revision 应为 2');
    assert.equal(request.profile.weightGrams, 71000, '请求档案应携带最新体重');
    assert.equal(request.nutritionConfig.hash, NUTRITION_CONFIG_HASH, '请求必须携带冻结的 nutritionConfig.hash');
    assert.equal(request.nutritionConfig.version, 'nutrition-v1.2-candidate', '请求营养配置版本应为冻结版本');
    assert.equal(request.catalog.menuVersion, 'menu-simulated-v2', '请求菜单版本应一致');
    assert.equal(request.plannerConfig.algorithm, 'greedy', '只发送 greedy');
    assert.deepEqual(request.planningMeals, ['breakfast', 'lunch', 'dinner'], '请求应规划全部供应餐次');
    assert.equal(day.plan.requestId, request.requestId, 'plan 记录 requestId 必须等于请求 requestId');
    assert.equal(day.plan.profileRevision, 2, 'plan 记录 profileRevision 必须等于请求档案 revision');
    assert.equal(day.plan.menuVersion, request.catalog.menuVersion, 'plan 记录 menuVersion 必须等于请求菜单版本');

    const second = await ctx.store.refreshPlan();
    assert.equal(second.ok, true, '第二次方案请求应成功');
    assert.equal(planRequest(ctx.store).requestId, `req-${DATE_A}-2`, 'requestId 序号应递增');
    assert.equal(currentDay(ctx.store).plan.revision, 2, 'plan 记录 revision 应递增');
    assert.equal(currentDay(ctx.store).plan.profileRevision, 2, 'plan 记录应继续绑定当前 profileRevision');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 22) 新实例重开恢复（模拟杀进程）
// ---------------------------------------------------------------------------

test('22 杀进程重开：新 AppStore 在同一持久化存储上恢复档案/计划/记餐，重复确认仍幂等', async () => {
  const clock = makeClock();
  const mock = createMockWx();
  const first = openStore({ clock, mock });
  let before = null;
  try {
    first.store.saveProfile(profileDraft());
    await first.store.computeTarget();
    await first.store.refreshPlan();
    first.store.confirmMeal('lunch', {});
    before = {
      home: first.store.getHomeView(),
      logs: first.store.getLogsView(),
      revision: first.store.peekState().profileRevision,
    };
    assert.ok(before.home.requestId, '重开前应已有计划');
  } finally {
    // 模拟进程退出：销毁核心实例与全局 wx（持久化文本留在 mock 存储里）
    first.close();
  }

  const second = openStore({ clock, mock });
  try {
    assert.equal(second.init.ok, true, '重开 init 应成功');
    assert.match(second.init.message, /已恢复本地数据/, '重开应提示从本地恢复');
    const home = second.store.getHomeView();
    assert.equal(home.businessDate, DATE_A, '重开后业务日期应保持');
    assert.equal(home.requestId, before.home.requestId, '重开后 plan requestId 应恢复');
    assert.equal(home.planState, 'ok', '重开后计划状态应为 ok');
    assert.equal(home.plans.length, before.home.plans.length, '重开后方案数量应一致');
    assert.equal(home.plans[0].priceCents, before.home.plans[0].priceCents, '重开后方案价格应一致');
    assert.equal(home.profileSummary, before.home.profileSummary, '重开后档案摘要应一致');
    assert.equal(second.store.peekState().profileRevision, before.revision, '重开后 profileRevision 应一致');
    const logs = second.store.getLogsView();
    assert.equal(logs.meals[1].active.length, 1, '重开后午餐有效记录应恢复');
    assert.equal(logs.meals[1].active[0].recordId, before.logs.meals[1].active[0].recordId, '重开后 recordId 应一致');
    assert.deepEqual(logs.intake, before.logs.intake, '重开后摄入汇总应逐字段一致');
    assert.equal(home.target.status, 'Ok', '重开后目标缓存应恢复（绑定 profileRevision）');

    const duplicate = second.store.confirmMeal('lunch', {});
    assert.equal(duplicate.ok, true, '重开后再次确认应幂等成功');
    assert.equal(duplicate.duplicate, true, '重开后重复确认必须标记 duplicate（幂等键来自持久化计划）');
    assert.equal(second.store.getLogsView().meals[1].active.length, 1, '重开后重复确认不得新增记录');
    assert.equal(second.store.getLogsView().intake.priceKnownCents, before.logs.intake.priceKnownCents, '重开后实际消费不得翻倍');
  } finally {
    second.close();
  }
});

// ---------------------------------------------------------------------------
// 附加：WASM 身份与真实核心证据（防止误用 mock 核心）
// ---------------------------------------------------------------------------

test('附加 真实 WASM 身份：dev 视图暴露包内 WASM 路径/字节/哈希，与冻结身份一致', () => {
  const ctx = openStore();
  try {
    const dev = ctx.store.getDevView();
    assert.equal(dev.wasmPath, wasmPath, 'dev 视图应暴露实际加载的 WASM 路径');
    assert.equal(dev.expectedWasmBytes, WASM_EXPECTED_BYTES, 'WASM 字节数应为冻结值（包内 A18 真实时限核心 111,554）');
    assert.equal(dev.expectedWasmSha256, WASM_EXPECTED_SHA256, 'WASM 哈希应为冻结值（包内 A18 真实时限核心 B0098453…）');
    assert.equal(dev.storageKey, STORAGE_KEY, 'dev 视图应暴露存储键');
    assert.equal(dev.schemaVersion, 1, 'dev 视图应暴露 schemaVersion');
    assert.ok(dev.envRows.length >= 1, 'dev 视图应展示环境行');
  } finally {
    ctx.close();
  }
});

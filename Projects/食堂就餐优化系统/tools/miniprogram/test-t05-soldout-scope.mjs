// test-t05-soldout-scope.mjs — T05 补测：多窗口 / 同菜多报价的售罄作用域 + 换菜分支。
//
// 证据边界：
//  * 使用包内冻结的真实 mp_core.wasm（A18 真实时限核心包内 111,554 字节 / SHA256 B0098453…），
//    readWasmChecked() 在文件开头校验身份；不 mock 核心结论。
//  * 使用真实 AppStore：preflightMenu(JSON) → 核心 mp_validate_menu 预检 → applyMenu
//    替换菜单，再走 markSoldOut / clearSoldOut / toggleItemLock / swapOffer /
//    refreshPlan / getHomeView / getMenuView 等公开 API，断言全部来自真实返回值。
//  * 菜单是**模拟多窗口菜单（非真实菜单）**（tools/miniprogram/t05-simulated-multi-window-menu.mjs），
//    食堂名/窗口名/菜品名都带“模拟/非真实菜单”标注；不是 T03 真实菜单，也不作为
//    真实价格/营养/验收依据。
//  * mock wx 只模拟持久化文本，不是微信运行时、不是真机；本文件不冒充真机证据。
//
// 覆盖（与任务卡逐项对应）：
//   A1 模拟多窗口菜单经真实核心预检通过、成功替换；每餐计划只来自单窗口（L8）。
//   A2 售罄只作用于“业务日期+窗口+餐次+dishId”：A 窗售罄不误伤 B 窗同菜报价的锁定与规划，
//      方案里 A 窗同菜项被标售罄、同窗其他餐次不被误标。
//   A3 跨窗换菜后 B 窗推荐项不被 A 窗同菜售罄误标；B 窗换菜候选保留。
//   A4 clearSoldOut 按窗口解除；多窗口标记未指定窗口时给出可读失败，不静默全清。
//   A5 锁定项所在窗售罄 → LockConflict（保留锁定、不静默解锁）；仅他窗售罄不冲突。
//   A6 同窗换菜：整餐 itemLocks 更新、不新增 windowLock、旧计划被新计划替换、重算 ok。
//   A7 跨窗换菜：windowLock 移到目标窗、旧窗 itemLocks 清理、旧窗售罄不误伤、目标窗售罄拒绝。
//   A8 售罄+锁定+计划跨 AppStore 重载按作用域恢复；跨日不继承昨日售罄/锁定。
//   A9 菜单替换：窗口/菜品仍在但该菜不再供应此餐次 → 按窗口清理售罄标记。
//   A10 菜单替换：删除窗口/菜品 → 按窗口清理售罄标记，diff.droppedSoldOut 带窗口信息，旧计划失效。
//
// 运行（项目根）：
//   node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-t05-soldout-scope.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  WASM_EXPECTED_BYTES,
  WASM_EXPECTED_SHA256,
  createMockWx,
  createRealInstantiate,
  importTs,
  readWasmChecked,
  wasmPath,
} from './t05-test-helpers.mjs';

const { AppStore } = await importTs('domain', 'store.ts');
const { STORAGE_KEY, createInitialState } = await importTs('domain', 'app-state.ts');
const { SIMULATED_CATALOG } = await importTs('config', 'simulated-menu.ts');
const coreRuntime = await importTs('utils', 'core-runtime.ts');
const { canonicalSha256 } = await importTs('utils', 'canonical-json.ts');
import {
  SIMULATED_MULTI_WINDOW_CATALOG,
  SIMULATED_MULTI_WINDOW_HASH,
  SIMULATED_MULTI_WINDOW_MENU_VERSION,
} from './t05-simulated-multi-window-menu.mjs';

const DATE_A = '2026-10-20';
const DATE_B = '2026-10-21';
const WINDOW_A = 'w-sim-a';
const WINDOW_B = 'w-sim-b';

// ---------------------------------------------------------------------------
// 模拟菜单身份与 WASM 身份（先核对，再开始行为断言）
// ---------------------------------------------------------------------------

const wasmIdentity = readWasmChecked();
const menuCanonicalText = JSON.stringify(SIMULATED_MULTI_WINDOW_CATALOG);
const menuCanonicalRecalculated = canonicalSha256(SIMULATED_MULTI_WINDOW_CATALOG, 'catalogHash');
const menuByteLength = Buffer.byteLength(menuCanonicalText, 'utf8');
const menuTextSha256 = canonicalSha256(SIMULATED_MULTI_WINDOW_CATALOG);

console.log('='.repeat(78));
console.log('【模拟（非真实菜单）】多窗口 / 同菜多报价售罄作用域测试');
console.log(`WASM：${wasmPath}`);
console.log(`WASM 身份：${wasmIdentity.bytesLength} 字节 / SHA256 ${wasmIdentity.sha256}`);
console.log(`冻结预期：${WASM_EXPECTED_BYTES} 字节 / SHA256 ${WASM_EXPECTED_SHA256}`);
console.log(`模拟菜单：${SIMULATED_MULTI_WINDOW_MENU_VERSION}`);
console.log(`模拟菜单 catalogHash（复算）：${menuCanonicalRecalculated}`);
console.log(`模拟菜单规范化 JSON：${menuByteLength} 字节 / SHA256 ${menuTextSha256}`);
console.log('菜单内容为开发用模拟数据（非真实菜单）：食堂/窗口/菜品/营养/价格均不可作为真实依据。');
console.log('='.repeat(78));

test('A0 身份核对：真实 WASM 与模拟多窗口菜单摘要均与预期一致', () => {
  assert.equal(wasmIdentity.bytesLength, WASM_EXPECTED_BYTES, '包内 WASM 字节数必须等于冻结值');
  assert.equal(wasmIdentity.sha256, WASM_EXPECTED_SHA256, '包内 WASM SHA256 必须等于冻结值');
  assert.equal(SIMULATED_MULTI_WINDOW_HASH, menuCanonicalRecalculated, '模拟菜单导出的摘要应与规范化复算一致');
  assert.match(SIMULATED_MULTI_WINDOW_HASH, /^sha256:[0-9a-f]{64}$/, 'catalogHash 应为 sha256:<64 hex>');
  assert.match(SIMULATED_MULTI_WINDOW_CATALOG.canteen.name, /非真实菜单/, '模拟食堂名必须醒目标注“非真实菜单”');
  assert.match(SIMULATED_MULTI_WINDOW_CATALOG.menuVersion, /simulated/, '模拟菜单版本号应包含 simulated 标识');
  for (const window of SIMULATED_MULTI_WINDOW_CATALOG.windows) {
    assert.match(window.name, /非真实菜单/, `窗口 ${window.windowId} 名称必须标注模拟身份`);
  }
  for (const dish of SIMULATED_MULTI_WINDOW_CATALOG.dishes) {
    assert.match(dish.name, /非真实菜品/, `菜品 ${dish.dishId} 名称必须标注模拟身份`);
    assert.equal(dish.nutritionBasis.estimated, true, `菜品 ${dish.dishId} 营养必须标记估算`);
    assert.equal(dish.nutritionBasis.note, 'SIMULATED', `菜品 ${dish.dishId} 来源必须是 SIMULATED`);
  }
  // 同菜多报价：两个窗口对同一 dishId 各有独立 offerId，这是本组测试的核心结构。
  for (const dishId of ['dish-rice', 'dish-chicken', 'dish-greens']) {
    const windows = new Set(
      SIMULATED_MULTI_WINDOW_CATALOG.offers.filter((offer) => offer.dishId === dishId).map((offer) => offer.windowId),
    );
    assert.deepEqual([...windows].sort(), [WINDOW_A, WINDOW_B], `菜品 ${dishId} 必须在两个窗口都有报价`);
  }
});

// ---------------------------------------------------------------------------
// 公共夹具与工具
// ---------------------------------------------------------------------------

/** 每次调用前进 1 秒的注入时钟：记录 ID 唯一，业务日期稳定。 */
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

/**
 * T05M02 后空存储的默认菜单改为内置西一真实菜单。本文件要验证“替换成多窗口模拟菜单”的影响，
 * 所以先把冻结示例菜单作为已保存的当前菜单写进 mock 持久化，保证预检差异的旧版本口径不变。
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
  store.init();
  return {
    store,
    mock,
    clock,
    close() {
      coreRuntime.resetCore();
      uninstall();
    },
  };
}

function dayOf(store) {
  const state = store.peekState();
  return state.days[state.activeDate];
}

/** 真实核心预检 + 原子替换模拟多窗口菜单；返回预检/替换结果供断言。 */
async function loadMultiWindowMenu(store) {
  store.saveProfile(profileDraft());
  const preflight = await store.preflightMenu(JSON.stringify(SIMULATED_MULTI_WINDOW_CATALOG), 'simulated-multi-window.json');
  const applied = store.applyMenu(preflight);
  return { preflight, applied };
}

/** offerId → 所属窗口；用于核对计划项的窗口作用域。 */
function offerWindowMap(catalog) {
  const map = new Map();
  for (const offer of catalog.offers || []) {
    map.set(offer.offerId, offer.windowId);
  }
  return map;
}

function cloneCatalog(catalog) {
  return JSON.parse(JSON.stringify(catalog));
}

function withCatalogHash(catalog) {
  delete catalog.catalogHash;
  catalog.catalogHash = canonicalSha256(catalog, 'catalogHash');
  return catalog;
}

function plannedMeal(home, meal) {
  return home.meals.find((entry) => entry.meal === meal);
}

function nonBreakfast(home) {
  return home.meals.filter((entry) => entry.meal !== 'breakfast');
}

// ---------------------------------------------------------------------------
// A1 模拟多窗口菜单预检/替换 + 每餐单窗口（L8）
// ---------------------------------------------------------------------------

test('A1 模拟多窗口菜单：真实核心预检通过、原子替换、每餐计划只来自一个窗口（L8）', async () => {
  const ctx = openStore();
  try {
    const { preflight, applied } = await loadMultiWindowMenu(ctx.store);
    assert.equal(preflight.ok, true, '模拟多窗口菜单必须通过真实核心 mp_validate_menu');
    assert.equal(preflight.stage, 'ready', '预检成功应为 ready');
    assert.equal(typeof preflight.token, 'string', '预检成功必须签发一次性 token');
    assert.match(preflight.message, /窗口 2/, '预检消息应来自核心统计（窗口 2）');
    assert.match(preflight.message, /菜品 3/, '预检消息应来自核心统计（菜品 3）');
    assert.match(preflight.message, /报价 8/, '预检消息应来自核心统计（报价 8）');
    assert.equal(preflight.diff.oldMenuVersion, 'menu-simulated-v2', '差异应记录旧菜单版本');
    assert.equal(preflight.diff.newMenuVersion, SIMULATED_MULTI_WINDOW_MENU_VERSION, '差异应记录新菜单版本');
    assert.equal(preflight.diff.windowsAdded.length, 2, '差异应列出两个新增模拟窗口');
    assert.deepEqual(preflight.diff.windowsRemoved, ['模拟主窗口'], '差异应列出被替换掉的单窗口');
    assert.equal(applied.ok, true, '用户确认后应原子替换菜单');

    const menuView = ctx.store.getMenuView();
    assert.equal(menuView.info.menuVersion, SIMULATED_MULTI_WINDOW_MENU_VERSION, '菜单版本应已替换');
    assert.equal(menuView.info.windowCount, 2, '菜单信息应显示两个窗口');
    assert.equal(menuView.info.offerCount, 8, '菜单信息应显示 8 条报价');
    assert.match(menuView.info.canteenName, /非真实菜单/, '替换后仍须醒目标注模拟身份');
    assert.equal(dayOf(ctx.store).plan, null, '替换菜单后旧计划失效');

    const outcome = await ctx.store.refreshPlan();
    assert.equal(outcome.ok, true, '新菜单应能生成方案');
    assert.equal(outcome.status, 'OkPartial', '模拟数据应带估算标志（OkPartial）');
    const request = JSON.parse(ctx.store.getLastPlanRequest());
    assert.equal(request.catalog.menuVersion, SIMULATED_MULTI_WINDOW_MENU_VERSION, 'PlanRequest 必须携带新菜单版本');
    assert.deepEqual(request.state.soldOut, [], '新一天初始不应有售罄标记');

    const catalog = SIMULATED_MULTI_WINDOW_CATALOG;
    const windows = offerWindowMap(catalog);
    const home = ctx.store.getHomeView();
    const planned = nonBreakfast(home).filter((entry) => entry.hasPlan);
    assert.ok(planned.length >= 2, '午餐/晚餐都应生成推荐');
    for (const meal of planned) {
      assert.ok(meal.windowId, `${meal.meal} 方案必须给出窗口`);
      for (const item of meal.items) {
        // L8：同餐单窗口。真实核心返回的每个报价都必须属于该餐选定窗口。
        assert.equal(windows.get(item.offerId), meal.windowId, `${meal.meal} 的报价 ${item.offerId} 必须属于窗口 ${meal.windowId}`);
      }
      assert.equal(new Set(meal.items.map((item) => windows.get(item.offerId))).size, 1, `${meal.meal} 只能来自一个窗口`);
    }
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// A2 售罄只作用于本窗口：不误伤 B 窗同菜报价
// ---------------------------------------------------------------------------

test('A2 A 窗售罄不误伤 B 窗同菜：锁定/规划正常，方案标记按窗口区分', async () => {
  const ctx = openStore();
  try {
    await loadMultiWindowMenu(ctx.store);
    const first = await ctx.store.refreshPlan();
    assert.equal(first.ok, true, '初始方案应生成成功');
    let home = ctx.store.getHomeView();
    const lunchBefore = plannedMeal(home, 'lunch');
    assert.equal(lunchBefore.windowId, WINDOW_A, 'T02 v2 冻结二进制初始方案应选第一个供应窗口（模拟数据确定性结果）');

    // 只有在 A 窗供应范围内标记午餐鸡胸售罄；B 窗同菜报价不受影响。
    const marked = ctx.store.markSoldOut('lunch', 'dish-chicken', WINDOW_A);
    assert.equal(marked.ok, true, '本窗供应范围内标记售罄应成功');
    const duplicate = ctx.store.markSoldOut('lunch', 'dish-chicken', WINDOW_A);
    assert.equal(duplicate.ok, true, '重复标记应幂等成功');
    const day = dayOf(ctx.store);
    assert.equal(day.soldOut.length, 1, '重复标记不得产生第二条记录');
    const mark = day.soldOut[0];
    assert.equal(mark.businessDate, DATE_A, '售罄标记必须绑定业务日期');
    assert.equal(mark.windowId, WINDOW_A, '售罄标记必须绑定窗口');
    assert.equal(mark.meal, 'lunch', '售罄标记必须绑定餐次');
    assert.equal(mark.dishId, 'dish-chicken', '售罄标记必须绑定稳定 dishId');

    // 不存在/不供应此菜的窗口不能写入无意义标记（核心会忽略未知 windowId）。
    const invalidWindow = ctx.store.markSoldOut('lunch', 'dish-chicken', 'w-sim-nope');
    assert.equal(invalidWindow.ok, false, '不在该窗口供应的菜品不得标记售罄');
    assert.match(invalidWindow.message, /不在窗口/, '拒绝原因应可读');
    assert.equal(dayOf(ctx.store).soldOut.length, 1, '非法窗口不得写入标记');

    // 已售罄窗口的报价不能锁定；另一窗口的同菜报价仍可锁定。
    const lockSoldOutWindow = ctx.store.toggleItemLock('lunch', 'offer-chicken-a');
    assert.equal(lockSoldOutWindow.ok, false, '本窗已售罄的报价不得锁定');
    assert.match(lockSoldOutWindow.message, /所属窗口/, '拒绝原因应指出窗口作用域');
    const lockOtherWindow = ctx.store.toggleItemLock('lunch', 'offer-chicken-b');
    assert.equal(lockOtherWindow.ok, true, 'B 窗同菜报价仍可锁定（A 窗售罄不得误伤）');

    // 旧方案里 A 窗同菜项应按窗口被标售罄；同窗其他餐次不被误标。
    home = ctx.store.getHomeView();
    assert.equal(plannedMeal(home, 'lunch').windowId, WINDOW_A, '未刷新前仍展示旧方案窗口');
    assert.equal(
      plannedMeal(home, 'lunch').items.find((item) => item.offerId === 'offer-chicken-a').soldOut,
      true,
      '方案中 A 窗同菜项应标记售罄',
    );
    assert.equal(
      plannedMeal(home, 'dinner').items.find((item) => item.offerId === 'offer-chicken-a').soldOut,
      false,
      '同窗口其他餐次的同菜项不得被误标售罄',
    );

    // 真实核心实测：以 B 窗鸡胸报价为锁定项 + A 窗同菜售罄，核心不返回 LockConflict。
    const outcome = await ctx.store.refreshPlan();
    assert.notEqual(outcome.status, 'LockConflict', 'A 窗售罄不得让 B 窗锁定失效');
    assert.equal(outcome.ok, true, '锁定有效时应能重算方案');
    assert.equal(outcome.status, 'OkPartial', '重算状态应为 OkPartial');
    home = ctx.store.getHomeView();
    assert.deepEqual(home.lockIssues, [], '仅他窗售罄不应产生锁定失效 issue');
    const lunch = plannedMeal(home, 'lunch');
    assert.equal(lunch.windowId, WINDOW_B, '重算会把该餐落到锁定项所在窗口（T02 v2 确定性结果）');
    assert.equal(lunch.items.every((item) => !item.soldOut), true, 'B 窗推荐项不得被 A 窗同菜售罄误标');
    assert.equal(lunch.items.some((item) => item.offerId === 'offer-chicken-b'), true, 'B 窗同菜报价应出现在方案中');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// A3 跨窗换菜后：B 窗推荐/候选不被 A 窗同菜售罄误标
// ---------------------------------------------------------------------------

test('A3 跨窗换菜后 B 窗同菜推荐与候选不被 A 窗售罄误标', async () => {
  const ctx = openStore();
  try {
    await loadMultiWindowMenu(ctx.store);
    await ctx.store.refreshPlan();
    assert.equal(plannedMeal(ctx.store.getHomeView(), 'lunch').windowId, WINDOW_A, '初始午餐应在 A 窗');

    // 跨窗换菜把午餐整体落到 B 窗（窗口锁 + 目标菜锁）。
    const swapped = await ctx.store.swapOffer('lunch', 'offer-rice-half-a', 'offer-greens-b');
    assert.equal(swapped.ok, true, '跨窗换菜应成功');
    const lunchAfterSwap = plannedMeal(ctx.store.getHomeView(), 'lunch');
    assert.equal(lunchAfterSwap.windowId, WINDOW_B, '跨窗换菜后该餐窗口应移到 B 窗');

    // 只在旧窗口 A 标记同菜（鸡胸）售罄。
    assert.equal(ctx.store.markSoldOut('lunch', 'dish-chicken', WINDOW_A).ok, true, '旧窗口售罄标记应成功');

    const home = ctx.store.getHomeView();
    const lunch = plannedMeal(home, 'lunch');
    assert.equal(lunch.windowId, WINDOW_B, '计划窗口仍是 B 窗');
    assert.equal(lunch.items.every((item) => !item.soldOut), true, 'B 窗方案项不得因 A 窗同菜售罄被误标');
    const chickenItem = lunch.items.find((item) => item.dishId === 'dish-chicken');
    assert.ok(chickenItem, 'B 窗方案应包含同菜鸡胸报价');
    assert.equal(chickenItem.offerId, 'offer-chicken-b', '同菜鸡胸应来自 B 窗报价');
    // 换菜候选按报价窗口过滤：A 窗同菜售罄不得从 B 窗候选中移除鸡胸。
    const candidateIds = lunch.swappableOffers.map((offer) => offer.offerId);
    assert.ok(candidateIds.includes('offer-chicken-b'), 'B 窗同菜报价必须保留在换菜候选里');
    assert.equal(candidateIds.some((offerId) => offerId.endsWith('-a')), false, '候选只应来自计划窗口 B');
    assert.deepEqual(home.lockIssues, [], '跨窗换菜后不应出现锁定失效');
    assert.equal(home.soldOutMarks.length, 1, '售罄标记仍保留');
    assert.equal(home.soldOutMarks[0].windowId, WINDOW_A, '售罄标记的窗口应可读');
    assert.match(home.soldOutMarks[0].label, /模拟A窗口/, '多窗口菜单下售罄标签应带窗口名');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// A4 clearSoldOut 按窗口解除
// ---------------------------------------------------------------------------

test('A4 clearSoldOut 按窗口解除：A 窗解除后 B 窗仍在；未指定窗口不做静默全清', async () => {
  const ctx = openStore();
  try {
    await loadMultiWindowMenu(ctx.store);
    await ctx.store.refreshPlan();

    // 同一道菜在 A/B 两个窗口分别标记售罄。
    assert.equal(ctx.store.markSoldOut('lunch', 'dish-chicken', WINDOW_A).ok, true, 'A 窗售罄标记应成功');
    assert.equal(ctx.store.markSoldOut('lunch', 'dish-chicken', WINDOW_B).ok, true, 'B 窗售罄标记应成功');
    let marks = ctx.store.getHomeView().soldOutMarks;
    assert.equal(marks.length, 2, '两个窗口应各有一条售罄标记');
    assert.deepEqual(marks.map((entry) => entry.windowId).sort(), [WINDOW_A, WINDOW_B], '标记必须能区分窗口');

    // 未指定窗口且存在多个窗口标记 → 可读失败，不静默清掉所有窗口。
    const ambiguous = ctx.store.clearSoldOut('lunch', 'dish-chicken');
    assert.equal(ambiguous.ok, false, '多窗口标记未指定窗口时解除应失败');
    assert.match(ambiguous.message, /2 个窗口/, '失败信息应说明存在多个窗口标记');
    assert.equal(dayOf(ctx.store).soldOut.length, 2, '歧义解除不得改动任何标记');

    // 按窗口精确解除：只删 A 窗，B 窗保留。
    assert.equal(ctx.store.clearSoldOut('lunch', 'dish-chicken', WINDOW_A).ok, true, '按窗口解除应成功');
    assert.deepEqual(
      dayOf(ctx.store).soldOut.map((entry) => entry.windowId),
      [WINDOW_B],
      '解除 A 窗后 B 窗标记必须仍在',
    );
    assert.equal(ctx.store.getHomeView().soldOutMarks[0].windowId, WINDOW_B, '首页仍显示 B 窗标记');
    assert.equal(ctx.store.clearSoldOut('lunch', 'dish-chicken', WINDOW_B).ok, true, '再解除 B 窗应成功');
    assert.deepEqual(dayOf(ctx.store).soldOut, [], '两个窗口都解除后应为空');

    // 不存在的窗口标记返回可读失败。
    const missing = ctx.store.clearSoldOut('lunch', 'dish-chicken', WINDOW_A);
    assert.equal(missing.ok, false, '没有标记时解除应失败');
    assert.match(missing.message, /没有找到窗口/, '失败信息应指出窗口');

    // 单窗口标记（模拟旧页面只传 meal+dishId）仍可解除，保持向后兼容。
    assert.equal(ctx.store.markSoldOut('lunch', 'dish-greens', WINDOW_A).ok, true, '单窗口标记应成功');
    assert.equal(ctx.store.clearSoldOut('lunch', 'dish-greens').ok, true, '只有一个窗口标记时允许按菜名解除');
    assert.deepEqual(dayOf(ctx.store).soldOut, [], '兼容解除后应为空');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// A5 锁定失效：本窗售罄 → LockConflict；仅他窗售罄不冲突
// ---------------------------------------------------------------------------

test('A5 锁定项所在窗售罄 → LockConflict 且不静默解锁；仅他窗售罄规划正常', async () => {
  const ctx = openStore();
  try {
    await loadMultiWindowMenu(ctx.store);
    await ctx.store.refreshPlan();
    assert.equal(ctx.store.toggleItemLock('lunch', 'offer-chicken-a').ok, true, '锁定 A 窗鸡胸应成功');
    const requestBefore = ctx.store.getLastPlanRequest();

    // 本窗售罄 → 锁定失效，前端拦截（不调用核心）、保留锁定记录。
    assert.equal(ctx.store.markSoldOut('lunch', 'dish-chicken', WINDOW_A).ok, true, 'A 窗售罄标记应成功');
    const conflict = await ctx.store.refreshPlan();
    assert.equal(conflict.ok, false, '锁定项售罄时不得生成方案');
    assert.equal(conflict.status, 'LockConflict', '锁定失效应返回 LockConflict');
    assert.match(conflict.message, /锁定失效/, '失败原因应可见');
    assert.equal(ctx.store.getLastPlanRequest(), requestBefore, 'LockConflict 必须在前端拦截，不调用核心');
    const home = ctx.store.getHomeView();
    assert.equal(home.planState, 'lock-conflict', '首页应显示锁定冲突状态');
    assert.equal(home.lockIssues.length, 1, '首页应列出 1 条失效锁定');
    assert.equal(home.lockIssues[0].kind, 'item', '失效锁定类型应为菜品锁定');
    assert.equal(home.lockIssues[0].offerId, 'offer-chicken-a', '失效锁定应带 offerId 供页面精确解除');
    assert.match(home.lockIssues[0].reason, /售罄/, '失效原因应说明售罄');
    assert.match(home.lockIssues[0].reason, /模拟A窗口/, '失效原因应指出具体窗口');
    assert.deepEqual(
      dayOf(ctx.store).itemLocks.map((lock) => lock.offerId),
      ['offer-chicken-a'],
      '锁定记录必须保留，不能静默解锁',
    );

    // 解除本窗售罄后锁定恢复有效，规划正常。
    assert.equal(ctx.store.clearSoldOut('lunch', 'dish-chicken', WINDOW_A).ok, true, '解除售罄应成功');
    const recovered = await ctx.store.refreshPlan();
    assert.equal(recovered.ok, true, '解除售罄后应能重新规划');
    assert.notEqual(recovered.status, 'LockConflict', '解除后不应再是 LockConflict');
    assert.deepEqual(ctx.store.getHomeView().lockIssues, [], '解除后不应再有锁定 issue');
  } finally {
    ctx.close();
  }

  // 另一实例：只有他窗售罄时，锁定有效、规划正常。
  const other = openStore();
  try {
    await loadMultiWindowMenu(other.store);
    await other.store.refreshPlan();
    assert.equal(other.store.toggleItemLock('lunch', 'offer-chicken-a').ok, true, '锁定 A 窗鸡胸应成功');
    assert.equal(other.store.markSoldOut('lunch', 'dish-chicken', WINDOW_B).ok, true, '只在 B 窗标记同菜售罄应成功');
    const outcome = await other.store.refreshPlan();
    assert.equal(outcome.ok, true, '仅他窗售罄时应能正常规划');
    assert.notEqual(outcome.status, 'LockConflict', '仅他窗售罄不得产生锁定冲突');
    const home = other.store.getHomeView();
    assert.deepEqual(home.lockIssues, [], '仅他窗售罄不应产生锁定 issue');
    assert.deepEqual(
      dayOf(other.store).itemLocks.map((lock) => lock.offerId),
      ['offer-chicken-a'],
      '锁定记录应保持',
    );
    const lunch = plannedMeal(home, 'lunch');
    assert.equal(lunch.windowId, WINDOW_A, '锁定项所在窗口应可正常规划');
    assert.equal(lunch.items.some((item) => item.offerId === 'offer-chicken-a'), true, '锁定项应出现在方案中');
  } finally {
    other.close();
  }
});

// ---------------------------------------------------------------------------
// A6 同窗换菜
// ---------------------------------------------------------------------------

test('A6 同窗换菜：整餐 itemLocks 更新、不新增 windowLock、旧计划被新计划替换、重算 ok', async () => {
  const ctx = openStore();
  try {
    await loadMultiWindowMenu(ctx.store);
    assert.equal((await ctx.store.refreshPlan()).ok, true, '初始方案应生成');
    const planBefore = dayOf(ctx.store).plan;
    assert.ok(planBefore, '应有旧计划记录');
    const windowLocksBefore = JSON.stringify(dayOf(ctx.store).windowLocks);
    assert.deepEqual(dayOf(ctx.store).itemLocks, [], '初始不应有菜品锁定');

    const outcome = await ctx.store.swapOffer('lunch', 'offer-rice-full-a', 'offer-greens-a');
    assert.equal(outcome.ok, true, '同窗换菜应成功重算');
    assert.equal(outcome.status, 'OkPartial', '换菜后方案状态仍应为 OkPartial');
    assert.match(outcome.message, /同窗口/, '结果消息应说明是同窗替换');

    const day = dayOf(ctx.store);
    // 整餐菜品锁：替换后的整餐集合（去掉被换项、加入新项），而不是只锁新菜。
    assert.deepEqual(
      day.itemLocks.filter((lock) => lock.meal === 'lunch').map((lock) => lock.offerId).sort(),
      ['offer-chicken-a', 'offer-greens-a', 'offer-rice-half-a'],
      '同窗换菜后 itemLocks 应变为替换后的整餐项集合',
    );
    assert.deepEqual(day.windowLocks, [], '同窗换菜不得新增/改变窗口锁定');
    assert.equal(JSON.stringify(day.windowLocks), windowLocksBefore, '窗口锁定应与换菜前一致');
    assert.equal(day.itemLocks.filter((lock) => lock.meal !== 'lunch').length, 0, '不得影响其他餐次的锁定');

    // 旧计划被新计划替换（requestId 更新、绑定同一菜单版本），刷新后仍可重算。
    assert.ok(day.plan, '换菜重算后应有新计划');
    assert.notEqual(day.plan.requestId, planBefore.requestId, '换菜后应生成新的计划 requestId');
    assert.equal(day.plan.menuVersion, SIMULATED_MULTI_WINDOW_MENU_VERSION, '新计划必须绑定当前菜单版本');
    assert.equal(day.plan.revision, planBefore.revision + 1, '计划 revision 应递增');
    const home = ctx.store.getHomeView();
    assert.equal(plannedMeal(home, 'lunch').hasPlan, true, '换菜后该餐仍应有推荐');
    assert.deepEqual(home.lockIssues, [], '同窗换菜后不应出现锁定失效');
    assert.equal((await ctx.store.refreshPlan()).ok, true, '换菜后手动刷新仍应成功');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// A7 跨窗换菜
// ---------------------------------------------------------------------------

test('A7 跨窗换菜：整餐移到目标窗、旧窗 itemLocks 清理、旧窗售罄不误伤、目标窗售罄拒绝', async () => {
  const ctx = openStore();
  try {
    await loadMultiWindowMenu(ctx.store);
    await ctx.store.refreshPlan();
    assert.equal(plannedMeal(ctx.store.getHomeView(), 'lunch').windowId, WINDOW_A, '初始午餐应在 A 窗');
    const planBefore = dayOf(ctx.store).plan;

    const outcome = await ctx.store.swapOffer('lunch', 'offer-rice-half-a', 'offer-greens-b');
    assert.equal(outcome.ok, true, '跨窗换菜应成功重算');
    assert.match(outcome.message, /换窗口/, '结果消息应说明是整餐换窗口');
    const day = dayOf(ctx.store);
    assert.deepEqual(day.windowLocks, [{ meal: 'lunch', windowId: WINDOW_B }], '该餐窗口锁定应移到目标窗口 B');
    assert.deepEqual(
      day.itemLocks.filter((lock) => lock.meal === 'lunch').map((lock) => lock.offerId),
      ['offer-greens-b'],
      '跨窗换菜只锁目标菜，旧窗 A 的整餐 itemLocks 必须清理',
    );
    assert.notEqual(day.plan.requestId, planBefore.requestId, '跨窗换菜后应生成新计划');
    const lunch = plannedMeal(ctx.store.getHomeView(), 'lunch');
    assert.equal(lunch.windowId, WINDOW_B, '重算后该餐计划窗口应为目标窗口 B');
    assert.equal(lunch.items.every((item) => item.offerId.endsWith('-b')), true, '换窗后整餐报价应来自目标窗口');
  } finally {
    ctx.close();
  }

  // 旧窗售罄不误伤：A 窗同菜售罄时，仍可跨窗换入 B 窗同菜。
  const oldWindowSoldOut = openStore();
  try {
    await loadMultiWindowMenu(oldWindowSoldOut.store);
    await oldWindowSoldOut.store.refreshPlan();
    assert.equal(oldWindowSoldOut.store.markSoldOut('lunch', 'dish-chicken', WINDOW_A).ok, true, '旧窗同菜售罄标记应成功');
    const outcome = await oldWindowSoldOut.store.swapOffer('lunch', 'offer-rice-half-a', 'offer-chicken-b');
    assert.equal(outcome.ok, true, '旧窗售罄不得阻止跨窗换入 B 窗同菜');
    const day = dayOf(oldWindowSoldOut.store);
    assert.deepEqual(day.windowLocks, [{ meal: 'lunch', windowId: WINDOW_B }], '换入后窗口锁定应在 B 窗');
    assert.deepEqual(
      day.itemLocks.filter((lock) => lock.meal === 'lunch').map((lock) => lock.offerId),
      ['offer-chicken-b'],
      '换入后只锁目标窗口的同菜报价',
    );
    const lunch = plannedMeal(oldWindowSoldOut.store.getHomeView(), 'lunch');
    assert.equal(lunch.windowId, WINDOW_B, '重算后窗口应为 B');
    assert.equal(lunch.items.some((item) => item.offerId === 'offer-chicken-b'), true, 'B 窗同菜报价应进入方案');
    assert.deepEqual(oldWindowSoldOut.store.getHomeView().lockIssues, [], '旧窗售罄不应造成锁定失效');
  } finally {
    oldWindowSoldOut.close();
  }

  // 目标窗售罄拒绝：B 窗同菜售罄时不得跨窗换入该报价，且状态保持不变。
  const targetSoldOut = openStore();
  try {
    await loadMultiWindowMenu(targetSoldOut.store);
    await targetSoldOut.store.refreshPlan();
    const planBeforeReject = dayOf(targetSoldOut.store).plan;
    assert.equal(targetSoldOut.store.markSoldOut('lunch', 'dish-chicken', WINDOW_B).ok, true, '目标窗售罄标记应成功');
    const rejected = await targetSoldOut.store.swapOffer('lunch', 'offer-rice-half-a', 'offer-chicken-b');
    assert.equal(rejected.ok, false, '目标窗口该菜售罄时应拒绝跨窗换入');
    assert.match(rejected.message, /目标窗口已标记售罄/, '拒绝原因应指出目标窗口售罄');
    const day = dayOf(targetSoldOut.store);
    assert.deepEqual(day.windowLocks, [], '被拒绝的换菜不得改动窗口锁定');
    assert.deepEqual(day.itemLocks, [], '被拒绝的换菜不得改动菜品锁定');
    assert.equal(day.plan.requestId, planBeforeReject.requestId, '被拒绝的换菜不得让旧计划失效');
  } finally {
    targetSoldOut.close();
  }
});

// ---------------------------------------------------------------------------
// A8 跨 AppStore 重载 + 跨日隔离
// ---------------------------------------------------------------------------

test('A8 售罄/锁定/计划跨 AppStore 重载按作用域恢复；跨日不继承昨日售罄与锁定', async () => {
  const mock = createMockWx();
  const clock = makeClock();
  const first = openStore({ mock, clock });
  let before;
  try {
    const { preflight } = await loadMultiWindowMenu(first.store);
    assert.equal(preflight.ok, true, '模拟菜单应通过真实核心预检');
    assert.equal((await first.store.refreshPlan()).ok, true, '初始方案应生成');
    assert.equal(first.store.toggleItemLock('lunch', 'offer-chicken-a').ok, true, '锁定应成功');
    assert.equal(first.store.markSoldOut('lunch', 'dish-chicken', WINDOW_A).ok, true, '售罄标记应成功');
    before = {
      soldOut: JSON.parse(JSON.stringify(dayOf(first.store).soldOut)),
      itemLocks: JSON.parse(JSON.stringify(dayOf(first.store).itemLocks)),
      requestId: dayOf(first.store).plan.requestId,
      menuVersion: dayOf(first.store).plan.menuVersion,
    };
  } finally {
    first.close();
  }

  // 模拟杀进程后重开：新的 AppStore 从同一持久化文本恢复。
  const second = openStore({ mock, clock });
  try {
    const day = dayOf(second.store);
    assert.equal(day.businessDate, DATE_A, '重开后业务日期应恢复');
    assert.deepEqual(day.soldOut, before.soldOut, '售罄标记（含窗口作用域）应逐项恢复');
    assert.deepEqual(day.itemLocks, before.itemLocks, '锁定应逐项恢复');
    assert.equal(day.plan.requestId, before.requestId, '计划 requestId 应恢复');
    assert.equal(day.plan.menuVersion, before.menuVersion, '计划绑定菜单版本应恢复');
    const home = second.store.getHomeView();
    assert.equal(home.businessDate, DATE_A, '首页业务日期应恢复');
    assert.equal(home.soldOutMarks.length, 1, '首页应恢复 1 条售罄标记');
    assert.equal(home.soldOutMarks[0].windowId, WINDOW_A, '恢复的售罄标记应保留窗口');
    assert.match(home.soldOutMarks[0].windowName, /模拟A窗口/, '恢复的售罄标记应保留窗口名');
    const lunch = plannedMeal(home, 'lunch');
    assert.equal(lunch.items.find((item) => item.offerId === 'offer-chicken-a').soldOut, true, '重开后方案项售罄标记应按窗口恢复');

    // 跨日：新的一天不继承昨日售罄/锁定，旧日记录保留。
    clock.set(`${DATE_B}T12:00:00+08:00`);
    assert.equal(second.store.ensureToday(), true, '跨日应创建新的日期桶');
    const newDay = dayOf(second.store);
    assert.equal(newDay.businessDate, DATE_B, '当前业务日期应切到新一天');
    assert.deepEqual(newDay.soldOut, [], '新的一天不得继承昨日售罄');
    assert.deepEqual(newDay.itemLocks, [], '新的一天不得继承昨日锁定');
    assert.deepEqual(newDay.windowLocks, [], '新的一天不得继承昨日窗口锁定');
    assert.equal(newDay.plan, null, '新的一天不应有昨天的计划');
    const oldDay = second.store.peekState().days[DATE_A];
    assert.deepEqual(oldDay.soldOut, before.soldOut, '旧日售罄记录必须原样保留');
    assert.deepEqual(oldDay.itemLocks, before.itemLocks, '旧日锁定记录必须原样保留');
    assert.deepEqual(second.store.getHomeView().soldOutMarks, [], '新一天首页不应显示昨日售罄');
    const planning = second.store.getHomeView();
    assert.equal(planning.businessDate, DATE_B, '首页业务日期应为新一天');
  } finally {
    second.close();
  }
});

// ---------------------------------------------------------------------------
// A9 菜单替换：窗口/菜品仍在，但该菜不再为该窗口该餐次供应时也要清理
// ---------------------------------------------------------------------------

test('A9 菜单替换：窗口与菜品都在、但该菜不再供应此餐次时按作用域清理售罄标记', async () => {
  const ctx = openStore();
  try {
    await loadMultiWindowMenu(ctx.store);
    assert.equal((await ctx.store.refreshPlan()).ok, true, '初始方案应生成');
    assert.equal(ctx.store.markSoldOut('lunch', 'dish-chicken', WINDOW_A).ok, true, 'A 窗午餐售罄标记应成功');
    assert.equal(ctx.store.markSoldOut('lunch', 'dish-chicken', WINDOW_B).ok, true, 'B 窗午餐售罄标记应成功');

    // 新菜单 v4：两个窗口、鸡胸菜品都保留，但鸡胸不再供应午餐（只剩晚餐报价）。
    const menuV4 = cloneCatalog(SIMULATED_MULTI_WINDOW_CATALOG);
    menuV4.menuVersion = 'menu-simulated-multi-window-v4';
    for (const offer of menuV4.offers) {
      if (offer.dishId === 'dish-chicken') {
        offer.mealWindows = ['dinner'];
      }
    }
    withCatalogHash(menuV4);

    const preflight = await ctx.store.preflightMenu(JSON.stringify(menuV4), 'simulated-multi-window-v4.json');
    assert.equal(preflight.ok, true, '仅调整报价餐次的新菜单应通过核心预检');
    assert.deepEqual(preflight.diff.windowsRemoved, [], '窗口没有被删除');
    assert.deepEqual(preflight.diff.dishesRemoved, [], '菜品没有被删除');
    assert.equal(preflight.diff.droppedSoldOut.length, 2, '两个窗口的午餐鸡胸标记都应失去意义');
    assert.deepEqual(
      preflight.diff.droppedSoldOut.map((entry) => entry.windowId).sort(),
      [WINDOW_A, WINDOW_B],
      '被清理标记必须逐条带窗口 ID',
    );
    for (const entry of preflight.diff.droppedSoldOut) {
      assert.equal(entry.meal, 'lunch', '被清理标记应带餐次');
      assert.match(entry.reason, /不再为午餐供应/, '原因应说明该菜不再供应这一餐');
      assert.match(entry.label, /模拟A窗口|模拟B窗口/, '标签应带窗口名便于用户区分');
    }

    const applied = ctx.store.applyMenu(preflight);
    assert.equal(applied.ok, true, '确认后应原子替换菜单');
    assert.deepEqual(dayOf(ctx.store).soldOut, [], '失去供应作用域的售罄标记必须被清理');
    assert.equal(dayOf(ctx.store).plan, null, '菜单替换后旧计划必须失效');
    assert.match(applied.message, /清理 2 条/, '替换结果应说明清理条数');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// A10 菜单替换：删除窗口/菜品后按窗口清理售罄标记
// ---------------------------------------------------------------------------

test('A10 菜单替换：删除窗口/菜品后按窗口清理售罄标记，diff.droppedSoldOut 带窗口信息，旧计划失效', async () => {
  const ctx = openStore();
  try {
    await loadMultiWindowMenu(ctx.store);
    assert.equal((await ctx.store.refreshPlan()).ok, true, '初始方案应生成');
    // 同一道菜在两个窗口分别售罄，另有晚餐标记用于确认不该被误删。
    assert.equal(ctx.store.markSoldOut('lunch', 'dish-chicken', WINDOW_A).ok, true, 'A 窗售罄标记应成功');
    assert.equal(ctx.store.markSoldOut('lunch', 'dish-chicken', WINDOW_B).ok, true, 'B 窗售罄标记应成功');
    assert.equal(ctx.store.markSoldOut('dinner', 'dish-greens', WINDOW_A).ok, true, '晚餐售罄标记应成功');

    // 新菜单 v2：删除 B 窗及其报价，A 窗保留。
    const menuV2 = cloneCatalog(SIMULATED_MULTI_WINDOW_CATALOG);
    menuV2.menuVersion = 'menu-simulated-multi-window-v2';
    menuV2.windows = menuV2.windows.filter((window) => window.windowId !== WINDOW_B);
    menuV2.offers = menuV2.offers.filter((offer) => offer.windowId !== WINDOW_B);
    withCatalogHash(menuV2);

    const preflight = await ctx.store.preflightMenu(JSON.stringify(menuV2), 'simulated-multi-window-v2.json');
    assert.equal(preflight.ok, true, '删除窗口后的新菜单应通过核心预检');
    assert.deepEqual(preflight.diff.windowsRemoved, ['模拟B窗口（非真实菜单）'], '差异应列出被删窗口名称');
    assert.equal(preflight.diff.droppedSoldOut.length, 1, '只应清理 B 窗那条失去意义的售罄标记');
    const dropped = preflight.diff.droppedSoldOut[0];
    assert.equal(dropped.meal, 'lunch', '被清理标记应带餐次');
    assert.equal(dropped.windowId, WINDOW_B, '被清理标记必须带窗口 ID');
    assert.match(dropped.label, /模拟B窗口|w-sim-b/, '被清理标记的可读标签应包含窗口信息');
    assert.match(dropped.reason, /不存在窗口|不再供应/, '被清理原因应说明窗口/供应变化');
    assert.deepEqual(preflight.diff.impactedMeals, [], '旧计划引用的 A 窗报价仍存在，不构成 plan 影响');

    const applied = ctx.store.applyMenu(preflight);
    assert.equal(applied.ok, true, '确认后应原子替换菜单');
    assert.match(applied.message, /清理 1 条/, '替换结果应说明清理条数');
    assert.match(applied.message, /w-sim-b|模拟B窗口/, '替换结果应带被清理标记的窗口信息');
    assert.equal(dayOf(ctx.store).plan, null, '菜单替换后旧计划必须失效');
    assert.deepEqual(
      dayOf(ctx.store).soldOut.map((mark) => `${mark.meal}:${mark.windowId}:${mark.dishId}`).sort(),
      ['dinner:w-sim-a:dish-greens', 'lunch:w-sim-a:dish-chicken'],
      '只清理 B 窗标记，A 窗标记必须保留',
    );

    // 再导入删除鸡胸菜品的菜单 v3：两份鸡胸标记都失去意义，按窗口逐条清理。
    const menuV3 = cloneCatalog(menuV2);
    menuV3.menuVersion = 'menu-simulated-multi-window-v3';
    menuV3.dishes = menuV3.dishes.filter((dish) => dish.dishId !== 'dish-chicken');
    menuV3.offers = menuV3.offers.filter((offer) => offer.dishId !== 'dish-chicken');
    withCatalogHash(menuV3);
    const preflightV3 = await ctx.store.preflightMenu(JSON.stringify(menuV3), 'simulated-multi-window-v3.json');
    assert.equal(preflightV3.ok, true, '删除菜品后的新菜单应通过核心预检');
    assert.equal(preflightV3.diff.droppedSoldOut.length, 1, '只剩 A 窗鸡胸标记需要清理');
    assert.match(preflightV3.diff.droppedSoldOut[0].reason, /已不存在该菜品/, '原因应说明菜品被删除');
    assert.equal(preflightV3.diff.droppedSoldOut[0].windowId, WINDOW_A, '被清理标记的窗口应可读');
    assert.equal(ctx.store.applyMenu(preflightV3).ok, true, '确认后应替换为 v3');
    assert.deepEqual(
      dayOf(ctx.store).soldOut.map((mark) => `${mark.meal}:${mark.windowId}:${mark.dishId}`),
      ['dinner:w-sim-a:dish-greens'],
      '删除鸡胸菜品后只保留仍有意义的晚餐青菜标记',
    );
    assert.equal(ctx.store.getHomeView().soldOutMarks.length, 1, '首页售罄区应只剩 1 条');
  } finally {
    ctx.close();
  }
});
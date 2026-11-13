// test-t06c-unified.mjs — T06c v3「六窗口与功能统一开发候选」冒烟脚本（取代 T06c01 预整合冒烟）。
//
// 覆盖任务卡 §执行边界 5 的必要冒烟（Node 宿主 + 真实冻结 WASM，不是微信/真机证据）：
//   1) 内置菜单身份：T03f 35 道全估算 + 川湘 27 报价 → menuVersion/catalogHash 按最终内容重算；
//      菜单目录版本/hash 与核心 mp_validate_menu 回显一致（valid=true, counts 6/91/62/0）；
//   1b) 川湘六窗口闭环（仅午/晚）：25 款 11/12/13 元招牌套餐 + 两素 7 元/三素 9 元参考组合，
//      套餐营养按核心组件口径一次合计（米饭只计一次），9/14 元荤素组合隔离不可售，35 项照片参考不伪造可售；
//   2) 空存储首开默认真实菜单（source=builtin，首开 0 次业务写入）；
//   3) 三算法（greedy/dp/branchAndBound）各保存设置并各发一单真实冻结 WASM，
//      请求 plannerConfig.algorithm 与响应 search.algorithm 一致，且都能出方案；
//   4) 91 道估算值按既有“约 X 千卡/估算”口径显示（不按 0、不宣称实测）；
//   5) 首页“当前菜单 + 切换”入口视图与跳转目标（/pages/menu/index?focus=import）；
//   6) 记录页早/午/晚三标签可切换，切换不写业务数据；
//   7) 保留语义：旧内置菜单存储升级按内置真实菜单解释；已吃记录与用户锁重开保留；
//      用户导入的自定义菜单重开不被内置菜单覆盖。
//
// 运行（candidate 根）：
//   node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-t06c-unified.mjs [--out <dir>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createMockWx, createRealInstantiate, importTs, readWasmChecked, wasmPath } from './t05-test-helpers.mjs';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(toolsDir, '..', '..');
const srcRoot = path.join(projectRoot, 'miniprogram', 'src');

const { AppStore } = await importTs('domain', 'store.ts');
const { STORAGE_KEY, createInitialState } = await importTs('domain', 'app-state.ts');
const { WEST1_MENU_CATALOG, WEST1_MENU_SOURCE } = await importTs('config', 'west1-menu.ts');
const { canonicalSha256 } = await importTs('utils', 'canonical-json.ts');
const { energyDisplay } = await importTs('utils', 'nutrition-display.ts');
const coreRuntime = await importTs('utils', 'core-runtime.ts');
const { FIXTURE_CASES } = await importTs('mock', 'simulated-inputs.ts');

const EXPECTED_MENU_VERSION = 'west1-canteen-batch1-nutrition35-chuanxiang6-20261024';
const EXPECTED_CATALOG_HASH = 'sha256:23c0eda554226f9ecda0d4b973e57eabc697abe9e5ca34b7058fd45b30ff44ea';
const EXPECTED_SOURCE_BYTES = 123646;
const EXPECTED_SOURCE_SHA256 = '54B77216777590A12BE036E92191DD3D446DDA344C97E9FBEB53ABEF0DA032E7';
const EXPECTED_WINDOWS = 6;
const EXPECTED_DISHES = 91;
const EXPECTED_OFFERS = 62;
const CX_WINDOW_ID = 'w-chuanxiang-xiaochu';
const CX_SIGNATURE_PRICES = [1100, 1200, 1300];
const CX_REFERENCE_PRICES = { 'offer-chuanxiang-set-2veg-rice': 700, 'offer-chuanxiang-set-3veg-rice': 900 };
const ISOLATED_OFFER_IDS = ['offer-chuanxiang-set-1meat-1veg-rice', 'offer-chuanxiang-set-2meat-1veg-rice'];
const ALGORITHMS = ['greedy', 'dp', 'branchAndBound'];
const DATE_A = '2026-10-24';

const outIndex = process.argv.indexOf('--out');
const outDir = outIndex >= 0 ? process.argv[outIndex + 1] : null;
if (outDir) {
  fs.mkdirSync(path.join(outDir, 'requests'), { recursive: true });
}

let passed = 0;
const failures = [];
const dump = { tool: 'test-t06c-unified.mjs', task: 'T06c-v3', generatedAt: new Date().toISOString(), sections: {} };
function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`[PASS] ${name}`);
  } else {
    failures.push(name);
    console.log(`[FAIL] ${name}${detail === undefined ? '' : ` — ${detail}`}`);
  }
  return !!condition;
}

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

function profileDraft() {
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
  };
}

/** 装好 mock wx 后按真实 AppStore 打开（与生产页面同一 store 实现）。 */
function openStore({ mock = createMockWx(), seed, instantiate = createRealInstantiate(), init = true } = {}) {
  const uninstall = mock.install();
  patchWx(mock);
  if (seed) {
    mock.storage.set(STORAGE_KEY, JSON.stringify(seed));
  }
  const store = new AppStore({ instantiate, wasmPath, now: makeClock() });
  coreRuntime.resetCore();
  const initResult = init ? store.init() : null;
  return {
    store,
    mock,
    init: initResult,
    close() {
      coreRuntime.resetCore();
      uninstall();
    },
  };
}

/** mock wx 补齐页面会调用、但测试帮助函数未提供的宿主 API（只记录调用，不实现业务）。 */
function patchWx(mock) {
  const calls = { navigateTo: [], pageScrollTo: [] };
  mock.calls.navigation = calls;
  mock.wx.navigateTo = (options) => {
    calls.navigateTo.push(options.url);
    if (options && typeof options.success === 'function') options.success({});
  };
  mock.wx.redirectTo = () => {};
  mock.wx.switchTab = () => {};
  mock.wx.pageScrollTo = (options) => calls.pageScrollTo.push(options);
  mock.wx.setNavigationBarColor = () => {};
  mock.wx.setBackgroundColor = () => {};
  mock.wx.stopPullDownRefresh = () => {};
  mock.wx.nextTick = (fn) => fn && fn();
  return calls;
}

// ===========================================================================
// 0. 内置菜单身份 + 核心 mp_validate_menu 一致
// ===========================================================================
console.log('\n===== 0. 内置菜单身份与核心校验 =====');
{
  const wasm = readWasmChecked();
  check('包内 WASM 仍为冻结身份（111,554 B / B0098453…）', wasm.bytesLength === 111554 && wasm.sha256 === 'B0098453B7251C2FF39C65B3DF932E7E15975E4252A036196EBF63638A3DC5DD');
  check('内置菜单 menuVersion 已重赋为营养 35 版', WEST1_MENU_CATALOG.menuVersion === EXPECTED_MENU_VERSION, WEST1_MENU_CATALOG.menuVersion);
  check('内置菜单 catalogHash = 重算值', WEST1_MENU_CATALOG.catalogHash === EXPECTED_CATALOG_HASH, WEST1_MENU_CATALOG.catalogHash);
  check('catalogHash 可由 canonicalSha256 复算', canonicalSha256(WEST1_MENU_CATALOG, 'catalogHash') === WEST1_MENU_CATALOG.catalogHash);
  check('内置来源常量 = 统一候选目录 123646 B / 54B77216…', WEST1_MENU_SOURCE.fileBytes === EXPECTED_SOURCE_BYTES && WEST1_MENU_SOURCE.fileSha256 === EXPECTED_SOURCE_SHA256);
  check('内置来源常量营养覆盖 = 91 已知 / 0 未知', WEST1_MENU_SOURCE.nutritionKnownDishCount === EXPECTED_DISHES && WEST1_MENU_SOURCE.nutritionUnknownDishCount === 0);
  check('规模 = 6 窗口 / 91 菜 / 62 报价', WEST1_MENU_CATALOG.windows.length === EXPECTED_WINDOWS && WEST1_MENU_CATALOG.dishes.length === EXPECTED_DISHES && WEST1_MENU_CATALOG.offers.length === EXPECTED_OFFERS);
  const allKnown = WEST1_MENU_CATALOG.dishes.every(
    (dish) => dish.nutritionBasis && dish.nutritionBasis.estimated === true && Number.isSafeInteger(dish.nutrition.energyKcal) && dish.nutrition.energyKcal >= 0,
  );
  check('91 道均有 estimated 营养（非负整数）', allKnown);
  check('内置对象不带 T03f metadata/旧版本痕迹', !('metadata' in WEST1_MENU_CATALOG) && WEST1_MENU_CATALOG.menuVersion.indexOf('nutrition4') < 0);

  const ctx = openStore();
  try {
    await ctx.store.ensureCoreLoaded();
    const raw = coreRuntime.callCore('validate-menu', JSON.stringify(WEST1_MENU_CATALOG));
    const envelope = JSON.parse(raw);
    const result = envelope.result || {};
    check('核心 mp_validate_menu 接受内置菜单', envelope.ok === true && result.valid === true, raw.slice(0, 200));
    check('核心回显 menuVersion 与内置菜单一致', result.menuVersion === WEST1_MENU_CATALOG.menuVersion, result.menuVersion);
    check('核心回显 catalogHash / computedCatalogHash 与内置一致', result.catalogHash === WEST1_MENU_CATALOG.catalogHash && result.computedCatalogHash === WEST1_MENU_CATALOG.catalogHash);
    check('核心计数 = 6 窗口 / 91 菜 / 62 offer / 0 combo', result.counts && result.counts.windows === EXPECTED_WINDOWS && result.counts.dishes === EXPECTED_DISHES && result.counts.offers === EXPECTED_OFFERS && result.counts.comboRules === 0, JSON.stringify(result.counts));
  } finally {
    ctx.close();
  }
  dump.sections.identity = {
    menuVersion: WEST1_MENU_CATALOG.menuVersion,
    catalogHash: WEST1_MENU_CATALOG.catalogHash,
    source: WEST1_MENU_SOURCE,
    wasm: { bytes: wasm.bytesLength, sha256: wasm.sha256, path: wasmPath },
  };
}

// ===========================================================================
// 1. 空存储首开：默认真实菜单、不写业务数据
// ===========================================================================
console.log('\n===== 1. 空存储首开默认内置真实菜单 =====');
{
  const ctx = openStore();
  try {
    const writes = ctx.mock.control.writeCount;
    const menu = ctx.store.getMenuView().info;
    const state = ctx.store.peekState();
    check('首开来源 = builtin', menu.source === 'builtin', menu.source);
    check('首开不标示例菜单', menu.simulated === false);
    check('首开菜单版本 = 新内置版本', menu.menuVersion === EXPECTED_MENU_VERSION, menu.menuVersion);
    check('首开 catalogHash = 新内置摘要', menu.catalogHash === EXPECTED_CATALOG_HASH, menu.catalogHash);
    check('首开规模 = 6 窗口 / 91 菜 / 62 报价', menu.windowCount === EXPECTED_WINDOWS && menu.dishCount === EXPECTED_DISHES && menu.offerCount === EXPECTED_OFFERS, `${menu.windowCount}/${menu.dishCount}/${menu.offerCount}`);
    check('首开提示语说明内置真实菜单且可切换', /内置真实菜单/.test(menu.banner) && /切换/.test(menu.banner), menu.banner);
    check('内置菜单不写入本地存储（catalog 仍为 null）', state.catalog === null);
    check('首开 0 次业务写入', writes === 0, `writes=${writes}`);
  } finally {
    ctx.close();
  }
}

// ===========================================================================
// 2. 三算法各保存设置 + 各发一单真实冻结 WASM
// ===========================================================================
console.log('\n===== 2. 三算法真实 WASM 请求/响应 =====');
const algorithmResults = {};
let requestCatalogs = null;
{
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    for (const algorithm of ALGORITHMS) {
      const saved = ctx.store.saveSettings({ algorithm });
      check(`[${algorithm}] 设置可保存`, saved.ok === true, saved.message);
      const outcome = await ctx.store.refreshPlan();
      check(`[${algorithm}] 真实菜单下规划成功`, outcome.ok === true, outcome.message);
      const requestText = ctx.store.getLastPlanRequest();
      const responseText = ctx.store.getLastPlanRaw();
      const request = JSON.parse(requestText);
      const envelope = JSON.parse(responseText);
      const search = envelope.result && envelope.result.search ? envelope.result.search : {};
      check(`[${algorithm}] 请求 plannerConfig.algorithm 回显正确`, request.plannerConfig.algorithm === algorithm, request.plannerConfig.algorithm);
      check(`[${algorithm}] 响应 search.algorithm 回显正确`, search.algorithm === algorithm, search.algorithm);
      check(`[${algorithm}] 响应 ok 且有方案`, envelope.ok === true && Array.isArray(envelope.result.plans) && envelope.result.plans.length > 0, `ok=${envelope.ok} plans=${envelope.result && envelope.result.plans ? envelope.result.plans.length : 'n/a'}`);
      check(`[${algorithm}] 请求 catalog 为六窗口统一内置菜单（91 道全估算）`, request.catalog.menuVersion === EXPECTED_MENU_VERSION && request.catalog.catalogHash === EXPECTED_CATALOG_HASH);
      requestCatalogs = requestCatalogs || [];
      requestCatalogs.push({ algorithm, request });
      algorithmResults[algorithm] = {
        status: envelope.result.status,
        planCount: envelope.result.plans.length,
        search: {
          algorithm: search.algorithm,
          nodesEvaluated: search.nodesEvaluated,
          statesEvaluated: search.statesEvaluated,
          plansFound: search.plansFound,
          searchComplete: search.searchComplete,
        },
      };
      if (outDir) {
        fs.writeFileSync(path.join(outDir, 'requests', `${algorithm}.request.json`), requestText, 'utf8');
        fs.writeFileSync(path.join(outDir, 'requests', `${algorithm}.response.json`), responseText, 'utf8');
      }
    }
    // 同输入校验：三份请求除 requestId（每次调用唯一）与 plannerConfig.algorithm 外逐字一致。
    // 不构造不同业务状态：profile/catalog/nutritionConfig/planningMeals/state 三算法完全同源。
    const normalized = requestCatalogs.map(({ request }) => {
      const copy = JSON.parse(JSON.stringify(request));
      copy.requestId = '__requestId__';
      copy.plannerConfig.algorithm = '__algorithm__';
      return JSON.stringify(copy);
    });
    check('三算法请求除 requestId/algorithm 外逐字一致（同输入）', normalized.every((text) => text === normalized[0]));
  } finally {
    ctx.close();
  }
  dump.sections.algorithms = algorithmResults;
}

// ===========================================================================
// 3. 91 道估算值显示口径（沿用“约 X 千卡 / 估算”）
// ===========================================================================
console.log('\n===== 3. 估算值显示口径 =====');
{
  const labels = WEST1_MENU_CATALOG.dishes.map((dish) => energyDisplay(dish.nutrition.energyKcal, dish.nutritionBasis.estimated));
  check('91 道热量展示均为“约 X 千卡”', labels.every((entry) => /^约 \d+ 千卡$/.test(entry.text)), labels.slice(0, 3).map((entry) => entry.text).join(' | '));
  check('91 道热量展示均标记 estimated', labels.every((entry) => entry.estimated === true && entry.unknown === false));

  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    ctx.store.saveSettings({ algorithm: 'greedy' });
    await ctx.store.refreshPlan();
    const home = ctx.store.getHomeView();
    const planItems = home.meals.flatMap((meal) => meal.items);
    check('首页方案项来自 91 道菜单且全部营养已知', planItems.length > 0 && planItems.every((item) => item.nutritionKnown === true), `items=${planItems.length}`);
    check('方案项均带“估算”标记', planItems.length > 0 && planItems.every((item) => item.estimated === true && item.estimatedLabel === '估算'));
    check('方案项无“营养未知/价格待补全”未知标签', planItems.every((item) => item.unknownLabel === ''), planItems.map((item) => item.unknownLabel).filter(Boolean).join(','));
    check('方案项营养数值非空且为整数', planItems.every((item) => item.nutrition && Number.isSafeInteger(item.nutrition.energyKcal)));
  } finally {
    ctx.close();
  }
}

// ===========================================================================
// 4. 首页“当前菜单 + 切换”入口（真实页面模块 + 真实 store）
// ===========================================================================
console.log('\n===== 4. 首页菜单切换入口 =====');
const pageBootstrap = (pagePath) => {
  let captured = null;
  globalThis.Page = (options) => {
    captured = options;
  };
  return import(pathToFileURL(pagePath).href).then(() => {
    if (!captured) throw new Error(`页面模块没有调用 Page()：${pagePath}`);
    const options = captured;
    const page = Object.assign({}, options);
    page.data = JSON.parse(JSON.stringify(options.data || {}));
    page.setData = function setData(patch, callback) {
      Object.keys(patch).forEach((key) => {
        this.data[key] = patch[key];
      });
      if (callback) callback();
    };
    return page;
  });
};
globalThis.getCurrentPages = () => [];
{
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    ctx.store.saveSettings({ algorithm: 'greedy' });
    await ctx.store.refreshPlan();
    globalThis.getApp = () => ({ globalData: { store: ctx.store } });
    const page = await pageBootstrap(path.join(srcRoot, 'pages', 'home', 'index.ts'));
    page.onShow();
    check('首页视图加载成功', page.data.view !== null);
    check('首页顶部显示当前菜单（内置西一）', typeof page.data.menuTitle === 'string' && page.data.menuTitle.indexOf('西院西一食堂') >= 0, page.data.menuTitle);
    check('首页菜单行提示内置真实菜单', /内置真实菜单/.test(String(page.data.menuBanner || '')), page.data.menuBanner);
    check('首页视图菜单版本 = 新内置版本', page.data.view && page.data.view.menu.menuVersion === EXPECTED_MENU_VERSION, page.data.view && page.data.view.menu.menuVersion);
    page.onOpenMenuSwitch();
    const urls = ctx.mock.calls.navigation.navigateTo;
    check('点击切换直达菜单页导入分区', urls.length > 0 && urls[urls.length - 1] === '/pages/menu/index?focus=import', urls.join(','));
  } finally {
    ctx.close();
  }
}

// ===========================================================================
// 5. 记录页早/午/晚三标签可切换且不写数据
// ===========================================================================
console.log('\n===== 5. 记录页三餐标签 =====');
{
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    globalThis.getApp = () => ({ globalData: { store: ctx.store } });
    const page = await pageBootstrap(path.join(srcRoot, 'pages', 'logs', 'index.ts'));
    page.onShow();
    check('记录页加载成功', page.data.loaded === true);
    check('三标签数量 = 3', Array.isArray(page.data.mealTabs) && page.data.mealTabs.length === 3, JSON.stringify(page.data.mealTabs));
    check('三标签键 = breakfast/lunch/dinner', page.data.mealTabs.map((tab) => tab.key).join(',') === 'breakfast,lunch,dinner');
    check('三标签均带中文名与状态文案', page.data.mealTabs.every((tab) => !!tab.label && typeof tab.stateText === 'string'));
    check('默认选中餐次在早/午/晚内', ['breakfast', 'lunch', 'dinner'].indexOf(page.data.activeMeal) >= 0, page.data.activeMeal);
    const before = ctx.mock.raw(STORAGE_KEY);
    const switches = ['breakfast', 'lunch', 'dinner'].filter((meal) => meal !== page.data.activeMeal);
    for (const meal of switches) {
      page.onSelectMeal({ currentTarget: { dataset: { meal } } });
      check(`切换到 ${meal} 生效`, page.data.activeMeal === meal, page.data.activeMeal);
      check(`切换到 ${meal} 后 3 餐区块仍在`, page.data.sections.length === 3);
    }
    check('切标签不写业务数据', ctx.mock.raw(STORAGE_KEY) === before);
  } finally {
    ctx.close();
  }
}

// ===========================================================================
// 6. 保留语义：旧内置升级 / 已吃与锁 / 自定义菜单不被覆盖
// ===========================================================================
console.log('\n===== 6. 保留语义 =====');
{
  // 6a. 旧版本存储（catalog=null + source=simulated）升级后按内置真实菜单解释。
  const clock = makeClock();
  const legacy = createInitialState(clock());
  legacy.catalog = null;
  legacy.catalogMeta = { source: 'simulated', importedAt: null, importedFileName: null };
  const ctx = openStore({ seed: legacy });
  try {
    const menu = ctx.store.getMenuView().info;
    check('旧存储升级后按内置真实菜单解释', menu.source === 'builtin' && menu.simulated === false, menu.source);
    check('旧存储升级后菜单版本 = 新内置版本', menu.menuVersion === EXPECTED_MENU_VERSION, menu.menuVersion);
  } finally {
    ctx.close();
  }
}
{
  // 6b. 已吃记录与用户锁在重开后保留（真实规划 + 确认 + 锁）。
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    ctx.store.saveSettings({ algorithm: 'greedy' });
    await ctx.store.refreshPlan();
    const home = ctx.store.getHomeView();
    const plannedMeal = home.meals.find((meal) => meal.items.length > 0);
    check('存在可确认的推荐餐次', !!plannedMeal, 'no planned meal');
    if (plannedMeal) {
      const locked = ctx.store.toggleItemLock(plannedMeal.meal, plannedMeal.items[0].offerId);
      check('用户锁可写入', locked.ok === true, locked.message);
      const confirmed = ctx.store.confirmMeal(plannedMeal.meal, {});
      check('确认已吃成功', confirmed.ok === true, confirmed.message);
    }
    const before = ctx.store.peekState();
    const logsBefore = before.days[before.activeDate].logs.length;
    const locksBefore = before.days[before.activeDate].itemLocks.length;
    // 模拟杀进程重开：同一持久化存储上新 AppStore。
    const reopened = new AppStore({ instantiate: createRealInstantiate(), wasmPath, now: makeClock() });
    coreRuntime.resetCore();
    reopened.init();
    const after = reopened.peekState();
    check('重开后已吃记录保留', after.days[after.activeDate].logs.length === logsBefore && logsBefore > 0, `${after.days[after.activeDate].logs.length}/${logsBefore}`);
    check('重开后用户锁保留', after.days[after.activeDate].itemLocks.length === locksBefore && locksBefore > 0, `${after.days[after.activeDate].itemLocks.length}/${locksBefore}`);
    check('重开后菜单仍为内置真实菜单（未写死自定义菜单）', after.catalog === null);
  } finally {
    ctx.close();
  }
}
{
  // 6c. 用户导入的自定义菜单重开不被内置菜单覆盖。
  const ctx = openStore();
  try {
    const custom = JSON.parse(JSON.stringify(FIXTURE_CASES.success.request.catalog));
    custom.menuVersion = 'menu-t06c01-user-custom-v1';
    custom.canteen = { canteenId: 'canteen-t06c01-custom', name: '用户自定义食堂' };
    custom.catalogHash = canonicalSha256(custom, 'catalogHash');
    const preflight = await ctx.store.preflightMenu(JSON.stringify(custom), 'user-menu.json');
    check('自定义菜单预检通过', preflight.ok === true, preflight.stage);
    const applied = ctx.store.applyMenu(preflight);
    check('自定义菜单可应用', applied.ok === true, applied.message);
    const reopened = new AppStore({ instantiate: createRealInstantiate(), wasmPath, now: makeClock() });
    coreRuntime.resetCore();
    reopened.init();
    const menu = reopened.getMenuView().info;
    check('重开后仍是用户自定义菜单', menu.menuVersion === custom.menuVersion && menu.catalogHash === custom.catalogHash, menu.menuVersion);
    check('重开后来源 = imported（不被内置覆盖）', menu.source === 'imported', menu.source);
  } finally {
    ctx.close();
  }
}

// ===========================================================================
// 7. 川湘六窗口闭环（仅午/晚）：可售、整套价、营养一次合计、隔离与照片参考
// ===========================================================================
console.log('\n===== 7. 川湘六窗口闭环 =====');
const cxDishById = new Map(WEST1_MENU_CATALOG.dishes.map((dish) => [dish.dishId, dish]));
const cxOffers = WEST1_MENU_CATALOG.offers.filter((offer) => offer.windowId === CX_WINDOW_ID);
const cxWindow = WEST1_MENU_CATALOG.windows.find((window) => window.windowId === CX_WINDOW_ID);
const cxSignature = cxOffers.filter((offer) => CX_SIGNATURE_PRICES.indexOf(offer.priceCents) >= 0);
const cxReference = cxOffers.filter((offer) => CX_REFERENCE_PRICES[offer.offerId] !== undefined);
function componentIntSum(dish) {
  const sum = { energyKcal: 0, proteinDg: 0, fatDg: 0, carbDg: 0 };
  for (const component of dish.components || []) {
    const compDish = cxDishById.get(component.dishId);
    for (const field of ['energyKcal', 'proteinDg', 'fatDg', 'carbDg']) sum[field] += compDish.nutrition[field] * component.count;
  }
  return sum;
}
{
  check('川湘为第 6 窗口且仅午/晚', !!cxWindow && cxWindow.mealWindows.join(',') === 'lunch,dinner', cxWindow && cxWindow.mealWindows.join(','));
  check('川湘可售 offer = 27（25 招牌 + 2 参考组合）', cxOffers.length === 27 && cxSignature.length === 25 && cxReference.length === 2, `${cxOffers.length}/${cxSignature.length}/${cxReference.length}`);
  const priceCounts = {};
  cxSignature.forEach((offer) => { priceCounts[offer.priceCents] = (priceCounts[offer.priceCents] || 0) + 1; });
  check('25 款招牌整套价 = 11/12/13 元（10/10/5）', priceCounts[1100] === 10 && priceCounts[1200] === 10 && priceCounts[1300] === 5, JSON.stringify(priceCounts));
  check('招牌均为 comboTotal 整套计价', cxSignature.every((offer) => offer.priceBasis === 'comboTotal'));
  cxReference.forEach((offer) => {
    check(`参考组合 ${offer.offerId} = 标牌实价 ${CX_REFERENCE_PRICES[offer.offerId] / 100} 元`, offer.priceCents === CX_REFERENCE_PRICES[offer.offerId], offer.priceCents);
  });
  check('两款 9/14 元荤素组合不在可售报价内', cxOffers.every((offer) => ISOLATED_OFFER_IDS.indexOf(offer.offerId) < 0));
  check('川湘全部菜品营养已知且为估算', cxOffers.every((offer) => {
    const dish = cxDishById.get(offer.dishId);
    return dish && ['energyKcal', 'proteinDg', 'fatDg', 'carbDg'].every((field) => Number.isSafeInteger(dish.nutrition[field])) && dish.nutritionBasis.estimated === true;
  }));
  check('35 项照片参考未进入菜单目录（不伪造 0 元可售）', WEST1_MENU_SOURCE.photoReferenceCount === 35 && WEST1_MENU_CATALOG.dishes.every((dish) => !dish.dishId.startsWith('photo-')));
  check('套餐组件引用均指向目录内菜品', cxSignature.every((offer) => {
    const dish = cxDishById.get(offer.dishId);
    return dish.kind === 'combo' && Array.isArray(dish.components) && dish.components.length > 0 && dish.components.every((component) => cxDishById.has(component.dishId));
  }));
  check('每份套餐只见一次米饭组件（不重复计饭）', cxOffers.every((offer) => {
    const dish = cxDishById.get(offer.dishId);
    return (dish.components || []).filter((component) => component.dishId === 'dish-cx-rice').length === 1;
  }));
}
{
  // 7a. 自选页：川湘 27 项可售、营养来自核心、整套价一次计入、实付可改。
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    ctx.store.saveSettings({ algorithm: 'greedy' });
    const nutrient = await ctx.store.ensureSelfPickNutrition('lunch');
    check('自选营养快照：核心返回 62 个报价单份营养', nutrient.ok === true && nutrient.offerCount === 62, `${nutrient.ok}/${nutrient.offerCount}`);
    const view = ctx.store.getSelfPickView('lunch');
    const cx = view.windows.find((window) => window.windowId === CX_WINDOW_ID);
    check('自选页出现 6 个窗口且含川湘', view.windows.length === 6 && !!cx, view.windows.map((window) => window.windowId).join(','));
    check('川湘自选 27 项全部可用', !!cx && cx.availableCount === 27 && cx.offers.length === 27, cx && `${cx.availableCount}/${cx.offers.length}`);
    const set11 = cx.offers.find((offer) => offer.offerId === 'offer-chuanxiang-set-yuxiang-rousi');
    check('11 元套餐自选项：整套价 ￥11.00 + 营养已知+估算', set11.priceCents === 1100 && set11.priceBasis === 'comboTotal' && set11.nutritionKnown === true && set11.nutritionComplete === true && set11.estimated === true, JSON.stringify({ price: set11.priceCents, known: set11.nutritionKnown }));
    check('11 元套餐组件文案含主菜/两素/米饭且米饭只一次', set11.comboComponents.length === 4 && set11.comboComponents.filter((text) => text.indexOf('米饭') >= 0).length === 1 && set11.riceIncluded === true, set11.comboComponents.join(' | '));
    const dish = cxDishById.get(set11.dishId);
    const componentSum = componentIntSum(dish);
    const setDelta = ['energyKcal', 'proteinDg', 'fatDg', 'carbDg'].map((field) => Math.abs(set11.nutrition[field] - componentSum[field]));
    check('套餐营养 = 核心组件口径一次合计（招牌偏差 ≤2 单位）', Math.max.apply(null, setDelta) <= 2, `delta=${setDelta.join(',')}`);
    check('参考组合营养 = 组件整数合计（逐字段相等）', cxReference.every((offer) => {
      const refDish = cxDishById.get(offer.dishId);
      const sum = componentIntSum(refDish);
      const viewOffer = cx.offers.find((entry) => entry.offerId === offer.offerId);
      return ['energyKcal', 'proteinDg', 'fatDg', 'carbDg'].every((field) => viewOffer.nutrition[field] === sum[field]);
    }));
    const token = ctx.store.newSelfPickDraftToken();
    const selections = [{ offerId: set11.offerId, quantity: 1, priceEdit: 650 }];
    const preview = ctx.store.previewSelfPickDraft('lunch', CX_WINDOW_ID, selections);
    check('川湘套餐草稿预览通过（不写入）', preview.ok === true && preview.itemCount === 1, preview.message);
    check('预览按实付 ￥6.50 合计，不按菜单价', preview.knownTotalCents === 650 && preview.priceLabel === '￥6.50', `${preview.knownTotalCents}/${preview.priceLabel}`);
    check('预览营养 = 套餐一次合计值（不拆组件另算）', JSON.stringify(preview.nutritionSums) === JSON.stringify(set11.nutrition), JSON.stringify(preview.nutritionSums));
    const confirmed = ctx.store.confirmSelfPickMeal('lunch', { windowId: CX_WINDOW_ID, draftToken: token, selections });
    check('川湘套餐确认落账成功', confirmed.ok === true && !!confirmed.recordId, confirmed.message);
    const state = ctx.store.peekState();
    const log = state.days[state.activeDate].logs.filter((entry) => entry.meal === 'lunch').slice(-1)[0];
    check('记录绑定当前 menuVersion 快照', log.menuVersion === EXPECTED_MENU_VERSION && log.items[0].menuVersion === EXPECTED_MENU_VERSION, log.menuVersion);
    check('记录实付 = 650 分（菜单原价 1100 不被覆盖）', log.items[0].unitPriceCents === 650 && log.items[0].priceKnown === true, log.items[0].unitPriceCents);
    check('记录营养 = 套餐值且 basis=estimated', JSON.stringify(log.items[0].nutrition) === JSON.stringify(set11.nutrition) && log.items[0].nutritionBasis === 'estimated', JSON.stringify(log.items[0].nutrition));
    check('同草稿重复提交幂等（不重复计入）', ctx.store.confirmSelfPickMeal('lunch', { windowId: CX_WINDOW_ID, draftToken: token, selections }).duplicate === true);
  } finally {
    ctx.close();
  }
}
{
  // 7b. 推荐链：换菜可换入川湘套餐并重算，确认后进入实际消费。
  const ctx = openStore();
  try {
    ctx.store.saveProfile(profileDraft());
    ctx.store.saveSettings({ algorithm: 'greedy' });
    await ctx.store.refreshPlan();
    const home = ctx.store.getHomeView();
    const lunch = home.meals.find((meal) => meal.meal === 'lunch');
    check('午餐有可换菜的推荐', !!lunch && lunch.items.length > 0, lunch ? `items=${lunch.items.length}` : 'none');
    const swap = await ctx.store.swapOffer('lunch', lunch.items[0].offerId, 'offer-chuanxiang-set-yuxiang-rousi');
    const meal = ctx.store.getHomeView().meals.find((entry) => entry.meal === 'lunch');
    check('换菜可把川湘套餐换入推荐（跨窗重算）', swap.ok === true && meal.items.some((item) => String(item.offerId).indexOf('offer-chuanxiang-') === 0), swap.message);
    const cxItem = meal.items.find((item) => String(item.offerId).indexOf('offer-chuanxiang-') === 0);
    check('换入的川湘项营养已知/估算/整套价', !!cxItem && cxItem.nutritionKnown === true && cxItem.estimated === true && cxItem.priceCents === 1100, cxItem && `${cxItem.priceCents}/${cxItem.nutritionKnown}`);
    const confirmed = ctx.store.confirmMeal('lunch', {});
    check('换入后确认计入实际消费', confirmed.ok === true, confirmed.message);
    const state = ctx.store.peekState();
    const log = state.days[state.activeDate].logs.filter((entry) => entry.meal === 'lunch').slice(-1)[0];
    check('确认记录含川湘套餐与当前菜单版本', log.items.some((item) => String(item.offerId).indexOf('offer-chuanxiang-') === 0) && log.menuVersion === EXPECTED_MENU_VERSION, log.menuVersion);
  } finally {
    ctx.close();
  }
}
{
  // 7c. 菜单页：六窗口可见 + 当前菜单身份为统一候选。
  const ctx = openStore();
  try {
    globalThis.getApp = () => ({ globalData: { store: ctx.store } });
    const page = await pageBootstrap(path.join(srcRoot, 'pages', 'menu', 'index.ts'));
    if (typeof page.onLoad === 'function') page.onLoad({ focus: 'import' });
    page.onShow();
    check('菜单页显示 6 窗口', page.data.loaded === true && page.data.view.info.windowCount === EXPECTED_WINDOWS, page.data.view && page.data.view.info.windowCount);
    check('菜单页当前菜单版本 = 统一候选版本', page.data.view.info.menuVersion === EXPECTED_MENU_VERSION, page.data.view && page.data.view.info.menuVersion);
    check('菜单页不把内置六窗口菜单标为示例', page.data.view.info.simulated === false && page.data.view.info.source === 'builtin', `${page.data.view.info.source}/${page.data.view.info.simulated}`);
    check('菜单页保留浅层切换入口提示', /内置真实菜单/.test(page.data.view.info.banner) && /切换/.test(page.data.view.info.banner), page.data.view.info.banner);
    check('菜单页可售报价数 = 62', page.data.view.info.offerCount === EXPECTED_OFFERS, page.data.view && page.data.view.info.offerCount);
  } finally {
    ctx.close();
  }
}

// ===========================================================================
// 汇总
// ===========================================================================
console.log('\n' + '='.repeat(70));
console.log(`合计：${passed} / ${passed + failures.length} 通过，${failures.length} 失败`);
if (failures.length > 0) {
  console.log('失败项：');
  failures.forEach((name) => console.log(` - ${name}`));
}
if (outDir) {
  dump.summary = { passed, total: passed + failures.length, failures };
  const target = path.join(outDir, 't06c-unified-smoke-result.json');
  fs.writeFileSync(target, JSON.stringify(dump, null, 2) + '\n', 'utf8');
  console.log(`结构化结果：${target}`);
}
console.log('说明：Node 宿主 + 真实冻结 WASM 冒烟，不等同微信开发者工具/真机验证。');
process.exitCode = failures.length === 0 ? 0 : 1;
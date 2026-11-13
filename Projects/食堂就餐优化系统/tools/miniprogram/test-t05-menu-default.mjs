// test-t05-menu-default.mjs — T05M02「默认真实菜单与首页快捷切换」任务局部验收脚本。
//
// 覆盖任务卡验收口径：
//   1) 空存储首开即为内置西一真实菜单（来源 builtin、示例菜单不再作默认）；
//   2) 旧版本存储（catalog=null + catalogMeta.source='simulated'）升级后按内置真实菜单解释，不误标示例；
//   3) 示例菜单仍可按内容摘要标注（只作开发/演示来源，不再作默认）；
//   4) 用户导入的自定义菜单重开不被覆盖，真实就餐记录保留；
//   5) 首页「当前菜单 + 切换」入口直达菜单与备份页的导入分区，切换仍走 preflight→确认→apply；
//   6) 取消不变、写入失败不破坏旧数据；
//   7) 深浅色两套主题令牌下的对比度可核对，新样式只引用 --tk-* 变量；
//   8) 简易/完整两种显示模式下当前菜单行文本一致。
//
// 证据边界：真实包内 WASM + mock wx（Node 宿主）；不是微信开发者工具、不是模拟器/真机证据。
// 运行（候选/项目根）：
//   node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-t05-menu-default.mjs [--out <dumpDir>]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import {
  createMockWx,
  createRealInstantiate,
  importTs,
  readWasmChecked,
  wasmPath,
} from './t05-test-helpers.mjs';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(toolsDir, '..', '..');
const srcRoot = path.join(projectRoot, 'miniprogram', 'src');

const { AppStore } = await importTs('domain', 'store.ts');
const { STORAGE_KEY, createInitialState } = await importTs('domain', 'app-state.ts');
const { WEST1_MENU_CATALOG, WEST1_MENU_SOURCE } = await importTs('config', 'west1-menu.ts');
const { SIMULATED_CATALOG } = await importTs('config', 'simulated-menu.ts');
const { canonicalSha256 } = await importTs('utils', 'canonical-json.ts');
const coreRuntime = await importTs('utils', 'core-runtime.ts');
const { FIXTURE_CASES } = await importTs('mock', 'simulated-inputs.ts');
const appearance = await importTs('utils', 'appearance.ts');

const DATE_A = '2026-10-20';
// T06c v3 统一：内置菜单为六窗口（T03f 35 道全估算 + 川湘 27 报价），menuVersion/catalogHash 按最终内容重算。
const WEST1_MENU_VERSION = 'west1-canteen-batch1-nutrition35-chuanxiang6-20261024';
const WEST1_CATALOG_HASH = 'sha256:23c0eda554226f9ecda0d4b973e57eabc697abe9e5ca34b7058fd45b30ff44ea';

let passed = 0;
const failures = [];
const dump = { tool: 'test-t05-menu-default.mjs', task: 'T05M02', generatedAt: new Date().toISOString(), sections: {} };

function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`[PASS] ${name}`);
  } else {
    failures.push(name);
    console.log(`[FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
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

/** 自定义（非示例、非西一）菜单：从冻结 T02 夹具派生并重算 catalogHash，避免手写假摘要。 */
function customCatalog() {
  const catalog = JSON.parse(JSON.stringify(FIXTURE_CASES.success.request.catalog));
  catalog.menuVersion = 'menu-t05m02-custom-v1';
  catalog.canteen = { canteenId: 'canteen-t05m02-custom', name: '自定义测试食堂' };
  catalog.catalogHash = canonicalSha256(catalog, 'catalogHash');
  return catalog;
}

/**
 * 打开 AppStore。seed：
 *   'default'               —— 真正空存储（首次使用路径）；
 *   'legacy-simulated-null' —— 旧版本默认形态：catalog=null + catalogMeta.source='simulated'。
 */
function openStore({ clock = makeClock(), mock = createMockWx(), seed = 'default', instantiate = createRealInstantiate(), init = true } = {}) {
  const uninstall = mock.install();
  if (seed === 'legacy-simulated-null') {
    const state = createInitialState(clock());
    state.catalog = null;
    state.catalogMeta = { source: 'simulated', importedAt: null, importedFileName: null };
    mock.storage.set(STORAGE_KEY, JSON.stringify(state));
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

function manualLunchLog(store, token) {
  return store.addManualLog('lunch', {
    name: '校外盒饭',
    portionCode: 'full',
    quantity: 1,
    unitPriceCents: 1200,
    priceKnown: true,
    nutrition: null,
    note: null,
    clientToken: token,
  });
}

/** 页面级测试桩：真实页面模块 + 受控 setData + 单一 mock wx。ESM 只执行一次 Page()，故缓存 options。 */
const pageOptionsCache = new Map();
async function loadPage(pageRelativePath) {
  if (pageOptionsCache.has(pageRelativePath)) {
    return pageOptionsCache.get(pageRelativePath);
  }
  let captured = null;
  globalThis.Page = (options) => {
    captured = options;
  };
  await import(pathToFileURL(path.join(srcRoot, pageRelativePath)).href);
  if (!captured) {
    throw new Error(`${pageRelativePath} 未调用 Page()`);
  }
  pageOptionsCache.set(pageRelativePath, captured);
  return captured;
}

function makePage(pageOptions) {
  const page = Object.assign({}, pageOptions);
  page.data = JSON.parse(JSON.stringify(pageOptions.data));
  page.setData = function setData(patch, callback) {
    Object.keys(patch).forEach((key) => {
      this.data[key] = patch[key];
    });
    if (callback) {
      callback();
    }
  };
  return page;
}

function augmentWxForPages(mock) {
  const calls = { navigateTo: [], pageScrollTo: [], toast: [] };
  mock.wx.navigateTo = (options) => {
    calls.navigateTo.push(options);
    if (typeof options.success === 'function') {
      options.success({});
    }
  };
  mock.wx.pageScrollTo = (options) => {
    calls.pageScrollTo.push(options);
  };
  mock.wx.showToast = (options) => {
    calls.toast.push(options);
  };
  mock.wx.showModal = () => {};
  mock.wx.setNavigationBarColor = () => {};
  mock.wx.setBackgroundColor = () => {};
  mock.wx.nextTick = (callback) => callback();
  if (typeof globalThis.getCurrentPages !== 'function') {
    globalThis.getCurrentPages = () => [];
  }
  return calls;
}

// WCAG 2.x 相对亮度/对比度：用 app.wxss 里的真实令牌值核对，不手填评价结论。
function relativeLuminance(hex) {
  const channels = [0, 2, 4].map((start) => parseInt(hex.slice(start, start + 2), 16) / 255);
  const linear = channels.map((value) => (value <= 0.03928 ? value / 12.92 : Math.pow((value + 0.055) / 1.055, 2.4)));
  return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2];
}
function contrastRatio(foregroundHex, backgroundHex) {
  const first = relativeLuminance(foregroundHex);
  const second = relativeLuminance(backgroundHex);
  const ratio = (Math.max(first, second) + 0.05) / (Math.min(first, second) + 0.05);
  return Number(ratio.toFixed(2));
}

function themeTokens(cssText, themeClass) {
  const startIndex = cssText.indexOf(`.${themeClass} {`);
  if (startIndex < 0) {
    return {};
  }
  const endIndex = cssText.indexOf('}', startIndex);
  const block = cssText.slice(startIndex, endIndex);
  const tokens = {};
  for (const match of block.matchAll(/--tk-([a-z0-9-]+):\s*#([0-9a-fA-F]{6})/g)) {
    tokens[`--tk-${match[1]}`] = match[2].toLowerCase();
  }
  return tokens;
}

/** 取 home wxss 中前缀匹配的规则块（用于确认新样式只引用 --tk-* 颜色变量）。 */
function cssRuleBlocks(cssText, selectorPrefix) {
  const blocks = [];
  for (const match of cssText.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const selector = match[1].trim();
    if (selector.split(',').some((part) => part.trim().startsWith(selectorPrefix))) {
      blocks.push({ selector, body: match[2] });
    }
  }
  return blocks;
}

// ===========================================================================
// 0. 内置西一菜单身份
// ===========================================================================
console.log('\n===== 0. 内置西一菜单身份（正式菜单只读副本） =====');
check('内置菜单版本 = 正式菜单 menuVersion', WEST1_MENU_CATALOG.menuVersion === WEST1_MENU_VERSION, WEST1_MENU_CATALOG.menuVersion);
check('内置菜单 catalogHash = 正式菜单摘要', WEST1_MENU_CATALOG.catalogHash === WEST1_CATALOG_HASH, WEST1_MENU_CATALOG.catalogHash);
check(
  '内置菜单规范化摘要可复算一致（未篡改）',
  canonicalSha256(WEST1_MENU_CATALOG, 'catalogHash') === WEST1_MENU_CATALOG.catalogHash,
  canonicalSha256(WEST1_MENU_CATALOG, 'catalogHash'),
);
check('内置副本来源常量 = 统一候选目录 123646 B / 54B77216…32E7', WEST1_MENU_SOURCE.fileBytes === 123646 && WEST1_MENU_SOURCE.fileSha256 === '54B77216777590A12BE036E92191DD3D446DDA344C97E9FBEB53ABEF0DA032E7');
const wasmIdentity = readWasmChecked();
check('包内 WASM 身份未变（111,554 B / B0098453…）', wasmIdentity.bytesLength === 111554 && wasmIdentity.sha256 === 'B0098453B7251C2FF39C65B3DF932E7E15975E4252A036196EBF63638A3DC5DD');
dump.sections.identity = {
  menuVersion: WEST1_MENU_CATALOG.menuVersion,
  catalogHash: WEST1_MENU_CATALOG.catalogHash,
  canonicalHashRecomputed: canonicalSha256(WEST1_MENU_CATALOG, 'catalogHash'),
  sourceConstants: {
    catalogPath: WEST1_MENU_SOURCE.catalogPath,
    fileBytes: WEST1_MENU_SOURCE.fileBytes,
    fileSha256: WEST1_MENU_SOURCE.fileSha256,
    dishCount: WEST1_MENU_SOURCE.dishCount,
    windowCount: WEST1_MENU_SOURCE.windowCount,
    offerCount: WEST1_MENU_SOURCE.offerCount,
  },
  wasm: { bytes: wasmIdentity.bytesLength, sha256: wasmIdentity.sha256, path: wasmPath },
};

// ===========================================================================
// 1. 空存储首开：默认即内置西一真实菜单
// ===========================================================================
console.log('\n===== 1. 空存储首开默认西一 =====');
{
  const ctx = openStore();
  try {
    const writesDuringInit = ctx.mock.control.writeCount;
    const menu = ctx.store.getMenuView().info;
    const home = ctx.store.getHomeView();
    const dev = ctx.store.getDevView();
    const state = ctx.store.peekState();

    check('空存储 init 成功且提示首次使用', ctx.init.ok === true && /首次使用/.test(ctx.init.message), ctx.init.message);
    check('首开菜单来源 = builtin（不再是 simulated）', menu.source === 'builtin', menu.source);
    check('首开不再标注示例菜单', menu.simulated === false);
    check('首开菜单版本 = 西一正式菜单', menu.menuVersion === WEST1_MENU_VERSION, menu.menuVersion);
    check('首开 catalogHash = 西一正式菜单摘要', menu.catalogHash === WEST1_CATALOG_HASH, menu.catalogHash);
    check('首开食堂名 = 西院西一食堂', menu.canteenName === '西院西一食堂', menu.canteenName);
    check('首开规模 = 6 窗口 / 91 菜 / 62 报价', menu.windowCount === 6 && menu.dishCount === 91 && menu.offerCount === 62, `${menu.windowCount}/${menu.dishCount}/${menu.offerCount}`);
    check('首开提示语说明是内置真实菜单且可切换', /内置真实菜单/.test(menu.banner) && /切换/.test(menu.banner), menu.banner);
    check('首页视图使用同一份内置菜单', home.menu.menuVersion === menu.menuVersion && home.menu.source === 'builtin' && home.menu.simulated === false);
    check('开发视图来源 = builtin', dev.catalogSource === 'builtin', dev.catalogSource);
    check('内置菜单不写入本地存储（catalog 仍为 null）', state.catalog === null);
    check('新状态 catalogMeta.source = builtin', state.catalogMeta.source === 'builtin', state.catalogMeta.source);
    check('首开不产生业务写入（只读默认来源）', writesDuringInit === 0, `writes=${writesDuringInit}`);

    dump.sections.firstOpen = {
      initMessage: ctx.init.message,
      menu,
      homeMenu: home.menu,
      devCatalogSource: dev.catalogSource,
      catalogIsNull: state.catalog === null,
      catalogMeta: state.catalogMeta,
      writesDuringInit,
    };
  } finally {
    ctx.close();
  }
}

// ===========================================================================
// 2. 旧版本存储升级：catalog=null + source='simulated' 按内置真实菜单解释
// ===========================================================================
console.log('\n===== 2. 旧版本存储升级（不误标示例） =====');
{
  const ctx = openStore({ seed: 'legacy-simulated-null' });
  try {
    const menu = ctx.store.getMenuView().info;
    const state = ctx.store.peekState();
    check('旧存储 init 恢复成功', ctx.init.ok === true && /已恢复本地数据/.test(ctx.init.message), ctx.init.message);
    check('旧 catalog=null + source=simulated → 生效来源为 builtin', menu.source === 'builtin', menu.source);
    check('旧存储不再被标成示例菜单', menu.simulated === false);
    check('旧存储生效菜单 = 西一正式菜单', menu.menuVersion === WEST1_MENU_VERSION && menu.catalogHash === WEST1_CATALOG_HASH, menu.menuVersion);
    check('历史 catalogMeta 未被改写（保留原值，按 catalog=null 解释）', state.catalogMeta.source === 'simulated' && state.catalog === null);
    dump.sections.legacyUpgrade = { menu, catalog: state.catalog, catalogMeta: state.catalogMeta };
  } finally {
    ctx.close();
  }
}

// ===========================================================================
// 3. 示例菜单只作开发/演示来源：导入后仍按内容摘要标注
// ===========================================================================
console.log('\n===== 3. 示例菜单仍按内容标注（不再作默认） =====');
{
  const ctx = openStore();
  try {
    const preflight = await ctx.store.preflightMenu(JSON.stringify(SIMULATED_CATALOG), 'menu-simulated.json');
    check('导入冻结示例菜单预检通过', preflight.ok === true && preflight.stage === 'ready', `${preflight.stage}: ${preflight.message}`);
    const applied = ctx.store.applyMenu(preflight);
    const menu = ctx.store.getMenuView().info;
    const home = ctx.store.getHomeView();
    check('示例菜单可显式导入（保留开发/演示用途）', applied.ok === true, applied.message);
    check('导入示例菜单后仍标 simulated', menu.source === 'simulated' && menu.simulated === true, menu.source);
    check('示例菜单提示语强调非真实', /模拟菜单（非真实菜单）/.test(menu.banner), menu.banner);
    check('示例菜单来源不被当成内置真实菜单', menu.catalogHash === SIMULATED_CATALOG.catalogHash && menu.catalogHash !== WEST1_CATALOG_HASH);
    check('首页视图同步示例标注', home.menu.simulated === true);
    dump.sections.simulatedImport = { preflight: { ok: preflight.ok, stage: preflight.stage }, apply: applied, menu, homeSimulated: home.menu.simulated };
  } finally {
    ctx.close();
  }
}

// ===========================================================================
// 4. 自定义菜单重开不被覆盖，真实就餐记录保留
// ===========================================================================
console.log('\n===== 4. 自定义菜单重开不被覆盖 =====');
{
  const ctx = openStore();
  const catalog = customCatalog();
  let menuAfterApply = null;
  let logsBefore = null;
  try {
    const logResult = manualLunchLog(ctx.store, 't05m02-log-1');
    check('先写入一条真实就餐记录', logResult.ok === true, logResult.message);
    const preflight = await ctx.store.preflightMenu(JSON.stringify(catalog), 't05m02-custom-menu.json');
    check('自定义菜单预检通过（旧版本差异 = 西一菜单）', preflight.ok === true && preflight.diff.oldMenuVersion === WEST1_MENU_VERSION, `${preflight.stage}:${preflight.diff ? preflight.diff.oldMenuVersion : 'no-diff'}`);
    const applied = ctx.store.applyMenu(preflight);
    check('自定义菜单应用成功', applied.ok === true, applied.message);
    menuAfterApply = ctx.store.getMenuView().info;
    logsBefore = ctx.store.getLogsView().meals[1].active.length;
    check('应用后菜单 = 自定义菜单', menuAfterApply.menuVersion === 'menu-t05m02-custom-v1' && menuAfterApply.catalogHash === catalog.catalogHash, menuAfterApply.menuVersion);
    check('自定义菜单来源 = imported 且不标示例', menuAfterApply.source === 'imported' && menuAfterApply.simulated === false, menuAfterApply.source);
    check('就餐记录在换菜单后保留', logsBefore === 1, `active=${logsBefore}`);
  } finally {
    ctx.close();
  }

  // 模拟杀进程重开：同一份持久化文本
  const reopened = openStore({ mock: ctx.mock });
  try {
    const menu = reopened.store.getMenuView().info;
    const home = reopened.store.getHomeView();
    const logs = reopened.store.getLogsView().meals[1].active;
    check('重开 init 从本地恢复', reopened.init.ok === true && /已恢复本地数据/.test(reopened.init.message), reopened.init.message);
    check('重开菜单仍为自定义菜单（未被默认西一覆盖）', menu.menuVersion === 'menu-t05m02-custom-v1' && menu.catalogHash === customCatalog().catalogHash, menu.menuVersion);
    check('重开菜单来源仍为 imported', menu.source === 'imported' && menu.simulated === false, menu.source);
    check('重开后就餐记录仍保留', logs.length === 1 && logs[0].items[0].name === '校外盒饭' && logs[0].status === 'active', `active=${logs.length}`);
    check('重开首页视图绑定自定义菜单', home.menu.menuVersion === 'menu-t05m02-custom-v1' && home.menu.canteenName === '自定义测试食堂');
    dump.sections.customMenuPersistence = {
      menuAfterApply,
      menuAfterReopen: menu,
      homeMenuVersion: home.menu.menuVersion,
      logsAfterReopen: logs.map((log) => ({ recordId: log.recordId, status: log.status, items: log.items.map((item) => item.name) })),
    };
  } finally {
    reopened.close();
  }
}

// ===========================================================================
// 5. 首页入口 + 菜单页切换/确认（页面级 data 装配）
// ===========================================================================
console.log('\n===== 5. 首页入口可到切换/确认 =====');
{
  const ctx = openStore();
  const calls = augmentWxForPages(ctx.mock);
  globalThis.getApp = () => ({ globalData: { store: ctx.store } });
  try {
    const homeOptions = await loadPage(path.join('pages', 'home', 'index.ts'));
    const home = makePage(homeOptions);
    home.onShow();
    check('首页显示当前菜单名（内置西一）', home.data.menuTitle === '西院西一食堂 · 内置菜单', home.data.menuTitle);
    check('首页不再显示示例菜单标记', home.data.menuSimulated === false);
    home.onOpenMenuSwitch();
    const navigate = calls.navigateTo[calls.navigateTo.length - 1];
    check('首页“切换”直达菜单与备份页（focus=import）', !!navigate && navigate.url === '/pages/menu/index?focus=import', navigate ? navigate.url : 'no navigateTo');

    const menuBefore = ctx.store.getMenuView().info;
    const menuOptions = await loadPage(path.join('pages', 'menu', 'index.ts'));
    const menuPage = makePage(menuOptions);
    menuPage.onLoad({ focus: 'import' });
    menuPage.onShow();
    check('菜单页加载并显示当前菜单', menuPage.data.loaded === true && menuPage.data.view.info.menuVersion === WEST1_MENU_VERSION, menuPage.data.view ? menuPage.data.view.info.menuVersion : 'no-view');
    check('菜单页识别“西一菜单当前已启用”', menuPage.data.west1Applied === true);
    const scrolledTo = calls.pageScrollTo.map((entry) => entry.selector);
    check('菜单页按 focus=import 滚动到导入分区', scrolledTo.indexOf('#data-import') >= 0, JSON.stringify(scrolledTo));

    // 5a 取消：只清本地导入状态，菜单/锁定/计划不变
    await menuPage.onUseWest1Menu();
    check('菜单页预检西一菜单通过且给出可确认凭证', menuPage.data.west1Pending === true && menuPage.data.importReady === true && /预检通过/.test(menuPage.data.importMessage), menuPage.data.importMessage);
    menuPage.onCancelImport();
    const afterCancel = ctx.store.getMenuView().info;
    check('取消后页面导入状态清空', menuPage.data.west1Pending === false && menuPage.data.importReady === false);
    check('取消后菜单不变（仍为默认内置西一）', afterCancel.menuVersion === menuBefore.menuVersion && afterCancel.catalogHash === menuBefore.catalogHash && ctx.store.peekState().catalog === null, afterCancel.menuVersion);

    // 5b 确认：走既有 preflight → apply，替换为同一份西一菜单
    await menuPage.onUseWest1Menu();
    menuPage.onApplyMenu();
    const applied = ctx.store.getMenuView().info;
    const stateAfterApply = ctx.store.peekState();
    check('确认应用后菜单仍为西一正式菜单', applied.menuVersion === WEST1_MENU_VERSION && applied.catalogHash === WEST1_CATALOG_HASH, applied.menuVersion);
    check('确认应用后记录导入来源/文件（走既有 applyMenu）', stateAfterApply.catalogMeta.source === 'imported' && stateAfterApply.catalogMeta.importedFileName === '西院西一食堂-首批菜单.json', JSON.stringify(stateAfterApply.catalogMeta));
    check('确认应用后状态行给出成功提示', /已替换|已保存|预检/.test(menuPage.data.statusText), menuPage.data.statusText);

    home.onShow();
    check('菜单替换后首页当前菜单行随之更新且不标示例', home.data.menuSimulated === false && home.data.menuTitle === '西院西一食堂', home.data.menuTitle);

    dump.sections.homeEntry = {
      homePageData: {
        menuTitle: home.data.menuTitle,
        menuSimulated: home.data.menuSimulated,
        activeMeal: home.data.activeMeal,
        mode: home.data.mode,
        themeClass: home.data.themeClass,
      },
      navigateUrl: navigate ? navigate.url : null,
      menuPageAfterShow: {
        west1Applied: menuPage.data.west1Applied,
        importStage: menuPage.data.importStage,
        importMessage: menuPage.data.importMessage,
        pageScrollSelectors: scrolledTo,
      },
      afterApply: { menu: applied, catalogMeta: stateAfterApply.catalogMeta, statusText: menuPage.data.statusText },
      afterApplyHomeMenuTitle: home.data.menuTitle,
    };
  } finally {
    ctx.close();
    delete globalThis.getApp;
  }
}

// ===========================================================================
// 6. 取消不变、失败不破坏旧数据
// ===========================================================================
console.log('\n===== 6. 取消/失败不动旧数据 =====');
{
  // 6a 非法菜单预检失败：菜单不变
  const ctx = openStore();
  try {
    manualLunchLog(ctx.store, 't05m02-log-2');
    const beforeMenu = ctx.store.getMenuView().info;
    const beforeLogs = ctx.store.getLogsView().meals[1].active.length;
    const invalid = await ctx.store.preflightMenu('{"windows":[]}', 'bad.json');
    check('非法菜单预检失败且不签发凭证', invalid.ok === false && invalid.token === null && invalid.stage === 'parse', `${invalid.stage}: ${invalid.message}`);
    const afterInvalid = ctx.store.getMenuView().info;
    check('非法预检后菜单不变', afterInvalid.menuVersion === beforeMenu.menuVersion && afterInvalid.catalogHash === beforeMenu.catalogHash);

    // 6b 合法预检但取消（不 apply）：菜单、记录、计划均不变
    const custom = customCatalog();
    const preflight = await ctx.store.preflightMenu(JSON.stringify(custom), 't05m02-custom-menu.json');
    check('合法自定义菜单预检通过', preflight.ok === true, preflight.message);
    const afterCancelMenu = ctx.store.getMenuView().info;
    check('取消（未 apply）后菜单不变', afterCancelMenu.menuVersion === beforeMenu.menuVersion && ctx.store.peekState().catalog === null);

    // 6c 写入失败：保留原菜单与已有数据
    ctx.mock.control.failuresAfter = ctx.mock.control.writeCount;
    const failed = ctx.store.applyMenu(preflight);
    ctx.mock.control.failuresAfter = Infinity;
    const afterFailMenu = ctx.store.getMenuView().info;
    const afterFailState = ctx.store.peekState();
    const afterFailLogs = ctx.store.getLogsView().meals[1].active.length;
    check('写入失败时 applyMenu 返回失败且原因可读', failed.ok === false && /保存失败，已保留原数据/.test(failed.message), failed.message);
    check('写入失败后菜单仍为默认内置西一', afterFailMenu.menuVersion === WEST1_MENU_VERSION && afterFailMenu.catalogHash === WEST1_CATALOG_HASH, afterFailMenu.menuVersion);
    check('写入失败后 catalog 仍为 null（未写入半截状态）', afterFailState.catalog === null && afterFailState.catalogMeta.source === 'builtin', JSON.stringify(afterFailState.catalogMeta));
    check('写入失败后就餐记录保留', afterFailLogs === beforeLogs && afterFailLogs === 1, `active=${afterFailLogs}`);

    dump.sections.cancelAndFailure = {
      invalidPreflight: { stage: invalid.stage, message: invalid.message, token: invalid.token },
      cancelKeptMenu: afterCancelMenu.menuVersion,
      writeFailure: { message: failed.message, catalogIsNull: afterFailState.catalog === null, catalogMeta: afterFailState.catalogMeta, menuVersion: afterFailMenu.menuVersion, activeLogs: afterFailLogs },
    };
  } finally {
    ctx.close();
  }
}

// ===========================================================================
// 7. 深浅色/双模式可读（结构化依据）
// ===========================================================================
console.log('\n===== 7. 深浅色/双模式可读 =====');
{
  const appWxss = fs.readFileSync(path.join(srcRoot, 'app.wxss'), 'utf8');
  const homeWxss = fs.readFileSync(path.join(srcRoot, 'pages', 'home', 'index.wxss'), 'utf8');
  const light = themeTokens(appWxss, 'tk-light');
  const dark = themeTokens(appWxss, 'tk-dark');
  const mustHave = ['--tk-bg', '--tk-muted', '--tk-accent', '--tk-warn-text', '--tk-warn-bg'];
  check('浅色主题定义当前菜单行所需令牌', mustHave.every((key) => !!light[key]), JSON.stringify(mustHave.filter((key) => !light[key])));
  check('深色主题定义当前菜单行所需令牌', mustHave.every((key) => !!dark[key]), JSON.stringify(mustHave.filter((key) => !dark[key])));

  const ratios = {
    lightMutedOnBg: contrastRatio(light['--tk-muted'], light['--tk-bg']),
    lightAccentOnBg: contrastRatio(light['--tk-accent'], light['--tk-bg']),
    lightWarnTextOnWarnBg: contrastRatio(light['--tk-warn-text'], light['--tk-warn-bg']),
    darkMutedOnBg: contrastRatio(dark['--tk-muted'], dark['--tk-bg']),
    darkAccentOnBg: contrastRatio(dark['--tk-accent'], dark['--tk-bg']),
    darkWarnTextOnWarnBg: contrastRatio(dark['--tk-warn-text'], dark['--tk-warn-bg']),
  };
  const ratioOk = Object.keys(ratios).every((key) => ratios[key] >= 4.5);
  check('浅/深色下当前菜单行与切换链接对比度均 ≥ 4.5:1', ratioOk, JSON.stringify(ratios));

  const rules = cssRuleBlocks(homeWxss, '.menu-line');
  const usesHex = rules.filter((rule) => /#[0-9a-fA-F]{3,6}\b/.test(rule.body));
  const colorProps = rules.flatMap((rule) => (rule.body.match(/(?:^|;)\s*(color|background|border)\s*:\s*([^;]+)/g) || []).map((entry) => entry.trim()));
  const nonTokenColors = colorProps.filter((entry) => !/var\(--tk-/.test(entry) && !/^\s*(color|background|border)\s*:\s*(none|transparent|0)\b/.test(entry));
  check('当前菜单行样式只使用主题变量（无硬编码颜色）', usesHex.length === 0 && nonTokenColors.length === 0, JSON.stringify({ usesHex: usesHex.map((rule) => rule.selector), nonTokenColors }));

  // 双模式（简易/完整）：当前菜单行文本与主题无关，两种模式一致
  const ctx = openStore();
  try {
    const calls = augmentWxForPages(ctx.mock);
    globalThis.getApp = () => ({ globalData: { store: ctx.store } });
    const homeOptions = await loadPage(path.join('pages', 'home', 'index.ts'));
    const home = makePage(homeOptions);
    ctx.mock.wx.setStorageSync('tk.ui.displayMode.v1', 'simple');
    home.data.mode = 'simple';
    home.data.modeLabel = '简易';
    home.onShow();
    const simpleTitle = home.data.menuTitle;
    const simpleMode = home.data.mode;
    ctx.mock.wx.setStorageSync('tk.ui.displayMode.v1', 'full');
    home.data.mode = 'full';
    home.data.modeLabel = '完整';
    home.onShow();
    const fullTitle = home.data.menuTitle;
    check('简易/完整模式下当前菜单行文本一致', simpleTitle === fullTitle && simpleTitle === '西院西一食堂 · 内置菜单', `${simpleMode}/${simpleTitle} vs ${home.data.mode}/${fullTitle}`);
    check('两种模式下都不标示例菜单', home.data.menuSimulated === false);

    // 深浅色页面根 class：分别切换外观后重读页面 data
    appearance.setAppearancePreference('light');
    home.onShow();
    const lightClass = home.data.themeClass;
    appearance.setAppearancePreference('dark');
    home.onShow();
    const darkClass = home.data.themeClass;
    check('浅色偏好下页面根 class = tk-light', lightClass === 'tk-light', lightClass);
    check('深色偏好下页面根 class = tk-dark', darkClass === 'tk-dark', darkClass);
    appearance.setAppearancePreference('light');
    dump.sections.themeAndMode = {
      tokens: { light, dark },
      contrastRatios: ratios,
      menuLineRules: rules.map((rule) => rule.selector),
      modes: { simpleTitle, fullTitle, simpleMode, fullMode: home.data.mode },
      themeClasses: { lightClass, darkClass },
      calls: { navigateTo: calls.navigateTo.length },
    };
    globalThis.getApp = () => ({ globalData: { store: ctx.store } });
  } finally {
    ctx.close();
    delete globalThis.getApp;
  }
}

// ===========================================================================
// 汇总
// ===========================================================================
dump.passed = passed;
dump.failed = failures.length;
dump.failures = failures;
if (process.argv.indexOf('--out') >= 0) {
  const outDir = process.argv[process.argv.indexOf('--out') + 1];
  fs.mkdirSync(outDir, { recursive: true });
  const target = path.join(outDir, 'T05M02-页面与数据结果.json');
  fs.writeFileSync(target, JSON.stringify(dump, null, 2) + '\n', 'utf8');
  console.log(`\n结构化结果：${target}`);
}
console.log(`\n结果：${passed} PASS / ${failures.length} FAIL${failures.length ? `（${failures.join('；')}）` : ''}`);
process.exitCode = failures.length === 0 ? 0 : 1;
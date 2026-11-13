// test-home-swap-sheet.mjs — T05U09a 原生 ActionSheet 换菜/换一份路径（Node mock wx，非微信/真机证据）。
//
// 用真实页面模块 + 可操作的 wx.showActionSheet 桩，覆盖三条路径：
//  1) 成功：详情单菜“换菜”和餐次“换一份”都通过原生选择面板选完并调用 store.swapOffer；
//  2) 用户取消：errMsg 含 cancel → 静默返回，不换菜、不弹失败提示；
//  3) 真实打开失败：errMsg 不含 cancel → 一句可见提示 + 保留底层错误（sheetError）供诊断，不换菜。
// 另验证候选超过 6 项时只展示前 6 项并明确提示（wx.showActionSheet 上限）。
//
// 运行（candidate 根）：
//   node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-home-swap-sheet.mjs
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pagePath = path.join(projectRoot, 'miniprogram', 'src', 'pages', 'home', 'index.ts');

let passed = 0;
const failures = [];
function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`[PASS] ${name}`);
  } else {
    failures.push(name);
    console.log(`[FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

// ===== 受控 wx 桩：ActionSheet 可按场景成功/取消/失败 =====
const storage = new Map();
const calls = { toast: [], navigateTo: [], actionSheet: [] };
const sheet = { mode: 'success', queue: [], failMsg: 'showActionSheet:fail internal error' };
globalThis.wx = {
  getStorageSync: (key) => (storage.has(key) ? storage.get(key) : ''),
  setStorageSync: (key, value) => storage.set(key, value),
  setNavigationBarColor() {},
  setBackgroundColor() {},
  showToast(options) {
    calls.toast.push(options.title || '');
  },
  showActionSheet(options) {
    calls.actionSheet.push({ alertText: options.alertText, itemList: options.itemList.slice() });
    if (sheet.mode === 'success') {
      const tapIndex = sheet.queue.length > 0 ? sheet.queue.shift() : 0;
      options.success && options.success({ tapIndex });
      return;
    }
    options.fail && options.fail({ errMsg: sheet.mode === 'cancel' ? 'showActionSheet:fail cancel' : sheet.failMsg });
  },
  navigateTo(options) {
    calls.navigateTo.push(options);
  },
  navigateBack() {},
  reLaunch() {},
  getAppBaseInfo: () => ({}),
  getSystemInfoSync: () => ({}),
};
globalThis.getCurrentPages = () => [];

function item(offerId, name, overrides = {}) {
  return Object.assign(
    {
      itemKey: `lunch:${offerId}`,
      offerId,
      dishId: `dish-${offerId}`,
      windowId: 'w-main',
      name,
      category: 'protein',
      portionLabel: '整份',
      quantity: 1,
      priceCents: 500,
      priceKnown: true,
      priceLabel: '￥5.00',
      nutrition: { energyKcal: 300, proteinDg: 100, fatDg: 50, carbDg: 200 },
      nutritionKnown: true,
      estimated: false,
      estimatedLabel: '',
      locked: false,
      soldOut: false,
      unknownLabel: '',
    },
    overrides,
  );
}

function offer(offerId, name) {
  return { offerId, name, portionLabel: '整份', priceLabel: '￥5.00' };
}

function homeView(overrides = {}) {
  const lunch = Object.assign(
    {
      meal: 'lunch',
      label: '午餐',
      supply: true,
      ended: false,
      confirmed: false,
      hasPlan: true,
      planStatus: 'planned',
      planStatusLabel: '已生成',
      windowId: 'w-main',
      windowName: '模拟主窗口',
      windowLocked: false,
      target: null,
      items: [item('offer-rice-full', '米饭')],
      knownSums: { energyKcal: 300, proteinDg: 100, fatDg: 50, carbDg: 200 },
      incompleteNutrients: [],
      unknownItemCount: 0,
      plannedKnownCents: 500,
      priceIncomplete: false,
      flags: [],
      statusMessage: '',
      swappableOffers: [offer('offer-rice-half', '米饭'), offer('offer-fish', '清蒸鱼')],
    },
    overrides,
  );
  return {
    businessDate: '2026-10-24',
    dateLabel: '10月24日',
    weekdayLabel: '周六',
    menu: { simulated: false, banner: '内置真实菜单', canteenName: '西院西一食堂' },
    profileReady: true,
    profileSummary: '已建档',
    target: null,
    planState: 'ok',
    planStatus: 'OkPartial',
    planStatusLabel: '有方案但存在限制标志',
    planMessage: '已生成方案。',
    plans: [],
    flags: [],
    lockIssues: [],
    soldOutMarks: [],
    canPlan: true,
    capabilityMessage: '',
    lastAction: '',
    progress: { confirmedMeals: 0, text: '0 / 3 餐已确认' },
    intake: { energyKcal: null, incompleteNutrients: [], priceKnownCents: 0, priceIncomplete: false, energyLabel: '待补全' },
    budget: {
      budgetSet: false,
      budgetLabel: '',
      plannedLabel: '',
      plannedPriceIncomplete: false,
      spentLabel: '',
      remainingKnown: false,
      remainingKnownCents: null,
      overBudget: false,
      overageCents: null,
      accountingComplete: false,
    },
    meals: [
      Object.assign({}, lunch, { meal: 'breakfast', label: '早餐', hasPlan: false, items: [], swappableOffers: [] }),
      lunch,
      Object.assign({}, lunch, { meal: 'dinner', label: '晚餐', hasPlan: false, items: [], swappableOffers: [] }),
    ],
  };
}

let swapCalls = [];
function makeStore(view) {
  return {
    ensureToday: () => false,
    getHomeView: () => view,
    refreshPlan: () => Promise.resolve({ ok: true, message: '' }),
    swapOffer(meal, removeOfferId, pickOfferId) {
      swapCalls.push({ meal, removeOfferId, pickOfferId });
      return Promise.resolve({ ok: true, message: '' });
    },
  };
}

let pageOptions = null;
globalThis.Page = (options) => {
  pageOptions = options;
};
await import(pathToFileURL(pagePath).href);
if (!pageOptions) {
  console.error('页面模块没有调用 Page()');
  process.exit(1);
}

function makePage(storeView) {
  const page = Object.assign({}, pageOptions);
  page.data = JSON.parse(JSON.stringify(pageOptions.data));
  page.setData = function setData(patch, callback) {
    Object.keys(patch).forEach((key) => {
      this.data[key] = patch[key];
    });
    if (callback) callback();
  };
  globalThis.getApp = () => ({ globalData: { store: makeStore(storeView), firstHomeAtMs: 0 } });
  page.data.activeMeal = 'lunch';
  page.data.view = storeView;
  calls.toast.length = 0;
  calls.actionSheet.length = 0;
  sheet.queue.length = 0;
  sheet.mode = 'success';
  swapCalls = [];
  return page;
}

// ===== 1. 详情单菜“换菜”成功（用户真的能用原生面板选完） =====
{
  const view = homeView();
  const page = makePage(view);
  sheet.queue.push(0);
  await page.onSwapItem({ currentTarget: { dataset: { meal: 'lunch', offer: 'offer-rice-full' } } });
  check('详情换菜：弹出原生选择面板', calls.actionSheet.length === 1 && calls.actionSheet[0].alertText === '选择替代菜品（同窗口优先）');
  check(
    '详情换菜：面板列出同窗口候选（排除当前菜）',
    calls.actionSheet[0].itemList.join('|').indexOf('米饭（整份，￥5.00）') >= 0 &&
      calls.actionSheet[0].itemList.join('|').indexOf('清蒸鱼（整份，￥5.00）') >= 0,
    JSON.stringify(calls.actionSheet[0].itemList),
  );
  check(
    '详情换菜：选中后调用 store.swapOffer',
    swapCalls.length === 1 && swapCalls[0].meal === 'lunch' && swapCalls[0].removeOfferId === 'offer-rice-full' && swapCalls[0].pickOfferId === 'offer-rice-half',
    JSON.stringify(swapCalls),
  );
  check('详情换菜：成功后无失败 Toast、无错误留存', calls.toast.length === 0 && page.data.sheetError === '' && page.data.refreshing === false);
}

// ===== 2. 餐次“换一份”成功（单可换项直接进替代选择） =====
{
  const view = homeView();
  const page = makePage(view);
  sheet.queue.push(0);
  await page.onSwapMeal();
  check('换一份：弹出原生选择面板', calls.actionSheet.length === 1 && calls.actionSheet[0].alertText === '选择替代菜品（同窗口优先）');
  check('换一份：选中后调用 store.swapOffer', swapCalls.length === 1 && swapCalls[0].removeOfferId === 'offer-rice-full' && swapCalls[0].pickOfferId === 'offer-rice-half', JSON.stringify(swapCalls));
  check('换一份：成功后无失败 Toast', calls.toast.length === 0);
}

// ===== 3. 餐次“换一份”多菜：先选被替换项，再选替代 =====
{
  const view = homeView({
    items: [item('offer-rice-full', '米饭'), item('offer-chicken', '清蒸鸡胸'), item('offer-greens', '清炒青菜')],
    swappableOffers: [offer('offer-rice-half', '米饭'), offer('offer-fish', '清蒸鱼')],
  });
  const page = makePage(view);
  sheet.queue.push(1, 0);
  await page.onSwapMeal();
  check('多菜换一份：两次原生面板', calls.actionSheet.length === 2);
  check('多菜换一份：第一次选被替换菜', calls.actionSheet[0].alertText === '选择要替换的菜品' && calls.actionSheet[0].itemList.length === 3);
  check('多菜换一份：第二次选替代菜', calls.actionSheet[1].alertText === '选择替代菜品（同窗口优先）');
  check(
    '多菜换一份：按用户选择调用 store.swapOffer',
    swapCalls.length === 1 && swapCalls[0].removeOfferId === 'offer-chicken' && swapCalls[0].pickOfferId === 'offer-rice-half',
    JSON.stringify(swapCalls),
  );
}

// ===== 4. 用户取消：正常操作，静默返回 =====
{
  const view = homeView();
  const page = makePage(view);
  sheet.mode = 'cancel';
  await page.onSwapItem({ currentTarget: { dataset: { meal: 'lunch', offer: 'offer-rice-full' } } });
  check('取消：不换菜', swapCalls.length === 0 && calls.actionSheet.length === 1);
  check('取消：不弹失败提示', calls.toast.length === 0, JSON.stringify(calls.toast));
  check('取消：不残留错误', page.data.sheetError === '');
  check('取消：不进入生成中状态', page.data.refreshing === false);
}

// ===== 5. 真实打开失败：一句可见提示 + 保留底层错误 =====
{
  const view = homeView();
  const page = makePage(view);
  sheet.mode = 'fail';
  sheet.failMsg = 'showActionSheet:fail internal error 1001';
  await page.onSwapItem({ currentTarget: { dataset: { meal: 'lunch', offer: 'offer-rice-full' } } });
  check('打开失败：不换菜', swapCalls.length === 0);
  check('打开失败：给一句可见提示', calls.toast.length === 1 && calls.toast[0] === '选择面板打不开，请重试', JSON.stringify(calls.toast));
  check('打开失败：保留底层错误供诊断', page.data.sheetError === 'showActionSheet:fail internal error 1001', page.data.sheetError);
}

// ===== 6. 候选超过 6 项：只展示前 6 项并明确提示 =====
{
  const manyOffers = [];
  for (let index = 0; index < 8; index += 1) {
    manyOffers.push(offer(`offer-extra-${index}`, `候选菜${index + 1}`));
  }
  const view = homeView({ swappableOffers: manyOffers });
  const page = makePage(view);
  sheet.queue.push(2);
  await page.onSwapItem({ currentTarget: { dataset: { meal: 'lunch', offer: 'offer-rice-full' } } });
  check('候选截断：面板只给 6 项', calls.actionSheet.length === 1 && calls.actionSheet[0].itemList.length === 6);
  check('候选截断：明确提示只显示前 6 项', calls.toast.indexOf('候选较多，仅显示前 6 项') >= 0, JSON.stringify(calls.toast));
  check('候选截断：仍按用户点击项换菜', swapCalls.length === 1 && swapCalls[0].pickOfferId === 'offer-extra-2', JSON.stringify(swapCalls));
}

console.log('');
if (failures.length === 0) {
  console.log(`全部通过：${passed} 项（Node mock wx 验证，不能替代微信开发者工具/真机原生面板）`);
} else {
  console.log(`失败 ${failures.length} 项：${failures.join('、')}`);
}
process.exitCode = failures.length === 0 ? 0 : 1;
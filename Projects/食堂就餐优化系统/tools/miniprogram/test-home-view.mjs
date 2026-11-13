// test-home-view.mjs — T05U02 今日页展示映射的本地集成验证（Node 直跑页面 TS，不是微信运行时证据）。
//
// 用真实页面模块 + 受控的假 store/HomeView 快照，验证：
//  - 默认浅色 + 简易：主卡不出现营养区；简易与完整共享同一张卡与阅读顺序；
//  - 完整模式：三项克数 + 一项比例条；未知项写待补全、不画条、不显示 0；
//  - 热量“约/待补全”；搭配说明用已知类别；今日小结只算已记录；
//  - 餐次切换/模式切换不调用 store 的业务写方法、不改变业务状态；
//  - “确认吃了”打开记录页并带餐次参数；“自己选菜”打开独立次级页并带当前餐次参数（T05S03a 收口）；
// 运行：node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-home-view.mjs
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pagePath = path.join(projectRoot, 'miniprogram', 'src', 'pages', 'home', 'index.ts');
// 页面模板一起读：断言“用户真能看到的标识/同源绑定”，而不是只验 JS 字段存在。
const homeWxml = readFileSync(path.join(projectRoot, 'miniprogram', 'src', 'pages', 'home', 'index.wxml'), 'utf8');

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

// ===== 受控 wx / App / Page 桩 =====
const storage = new Map();
const calls = { navigateTo: [], reLaunch: [], toast: [], modal: [], actionSheet: [] };
globalThis.wx = {
  getStorageSync: (key) => (storage.has(key) ? storage.get(key) : ''),
  setStorageSync: (key, value) => storage.set(key, value),
  setNavigationBarColor() {},
  setBackgroundColor() {},
  showToast(options) {
    calls.toast.push(options);
  },
  showModal(options) {
    calls.modal.push(options);
  },
  showActionSheet(options) {
    calls.actionSheet.push(options);
  },
  navigateTo(options) {
    calls.navigateTo.push(options);
    if (options.success) options.success({});
  },
  navigateBack() {},
  reLaunch(options) {
    calls.reLaunch.push(options);
  },
  getAppBaseInfo: () => ({}),
  getSystemInfoSync: () => ({}),
};
globalThis.getCurrentPages = () => [];

function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
}

function item(overrides = {}) {
  return Object.assign(
    {
      itemKey: 'lunch:offer-rice-full',
      offerId: 'offer-rice-full',
      dishId: 'dish-rice',
      windowId: 'w-main',
      name: '米饭',
      category: 'staple',
      portionLabel: '整份',
      quantity: 1,
      priceCents: 100,
      priceKnown: true,
      priceLabel: '￥1.00',
      nutrition: { energyKcal: 232, proteinDg: 44, fatDg: 6, carbDg: 516 },
      nutritionKnown: true,
      estimated: true,
      estimatedLabel: '估算',
      locked: false,
      soldOut: false,
      unknownLabel: '',
    },
    overrides,
  );
}

function mealView(overrides = {}) {
  return Object.assign(
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
      items: [
        item(),
        item({ itemKey: 'lunch:offer-chicken', offerId: 'offer-chicken', dishId: 'dish-chicken', name: '清蒸鸡胸', category: 'protein', priceCents: 800, priceLabel: '￥8.00' }),
        item({ itemKey: 'lunch:offer-greens', offerId: 'offer-greens', dishId: 'dish-greens', name: '清炒青菜', category: 'vegetable', priceCents: 400, priceLabel: '￥4.00' }),
      ],
      knownSums: { energyKcal: 600, proteinDg: 300, fatDg: 200, carbDg: 750 },
      incompleteNutrients: [],
      unknownItemCount: 0,
      plannedKnownCents: 1300,
      priceIncomplete: false,
      flags: [],
      statusMessage: '',
      swappableOffers: [],
    },
    overrides,
  );
}

function homeView(overrides = {}) {
  return Object.assign(
    {
      businessDate: '2026-10-21',
      dateLabel: '10月21日',
      weekdayLabel: '周三',
      menu: { simulated: true, banner: '当前为模拟菜单（非真实菜单）', canteenName: '模拟食堂（非真实菜单）' },
      profileReady: true,
      profileSummary: '已建档',
      target: null,
      planState: 'ok',
      planStatusLabel: '方案已就绪',
      planMessage: '',
      plans: [],
      flags: [],
      lockIssues: [],
      soldOutMarks: [],
      canPlan: true,
      capabilityMessage: '',
      lastAction: '',
      progress: { confirmedMeals: 1, text: '已记 1 / 3 餐' },
      intake: {
        energyKcal: null,
        incompleteNutrients: ['能量'],
        priceKnownCents: 0,
        priceIncomplete: true,
        energyLabel: '未知',
      },
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
        mealView({ meal: 'breakfast', label: '早餐', confirmed: true, planStatusLabel: '已确认', hasPlan: false, items: [], knownSums: null, plannedKnownCents: 0 }),
        mealView(),
        mealView({ meal: 'dinner', label: '晚餐', hasPlan: false, items: [], knownSums: null, plannedKnownCents: 0 }),
      ],
    },
    overrides,
  );
}

const storeCalls = [];
function makeStore(view) {
  return {
    ensureToday() {
      storeCalls.push('ensureToday');
      return false;
    },
    getHomeView() {
      storeCalls.push('getHomeView');
      return view;
    },
    refreshPlan() {
      storeCalls.push('refreshPlan');
      return Promise.resolve({ ok: true, message: '' });
    },
    selectPlan() {
      storeCalls.push('selectPlan');
      return { ok: true, message: '' };
    },
    toggleWindowLock() {
      storeCalls.push('toggleWindowLock');
      return { ok: true, message: '' };
    },
    toggleItemLock() {
      storeCalls.push('toggleItemLock');
      return { ok: true, message: '' };
    },
    markSoldOut() {
      storeCalls.push('markSoldOut');
      return { ok: true, message: '' };
    },
    clearSoldOut() {
      storeCalls.push('clearSoldOut');
      return { ok: true, message: '' };
    },
    endMeal() {
      storeCalls.push('endMeal');
      return { ok: true, message: '' };
    },
    reopenMeal() {
      storeCalls.push('reopenMeal');
      return { ok: true, message: '' };
    },
    swapOffer() {
      storeCalls.push('swapOffer');
      return Promise.resolve({ ok: true, message: '' });
    },
  };
}

globalThis.getApp = () => ({ globalData: { store: makeStore(homeView()), firstHomeAtMs: 0 } });
let pageOptions = null;
globalThis.Page = (options) => {
  pageOptions = options;
};

const pageModule = await import(pathToFileURL(pagePath).href);
if (!pageOptions) {
  console.error('页面模块没有调用 Page()');
  process.exit(1);
}

function makePage(storeView) {
  const page = Object.assign({}, pageOptions);
  page.data = deepCopy(pageOptions.data);
  page.setData = function setData(patch, callback) {
    Object.keys(patch).forEach((key) => {
      this.data[key] = patch[key];
    });
    if (callback) callback();
  };
  globalThis.getApp = () => ({ globalData: { store: makeStore(storeView), firstHomeAtMs: 0 } });
  return page;
}

// ===== 1. 默认浅色 + 简易 =====
{
  storage.clear();
  const view = homeView();
  const page = makePage(view);
  page.onShow();
  check('默认模式为简易', page.data.mode === 'simple' && page.data.modeLabel === '简易');
  check('按时间/供应选中一餐', ['breakfast', 'lunch', 'dinner'].indexOf(page.data.activeMeal) >= 0);
  // 固定到午餐再看卡片，避免测试受本机当前小时影响。
  page.data.activeMeal = 'lunch';
  page.applyHome(view);
  check('餐次签含已记状态', page.data.mealTabs.some((tab) => tab.stateText === '已记') === true);
  check('本餐卡已生成', !!page.data.card && page.data.card.mealLabel === '午餐');
  check('简易模式不显示营养区', page.data.card.macro.show === false);
  check('热量显示“约 600 千卡”', page.data.card.heatText === '约 600 千卡' && page.data.card.heatEstimated === true);
  // U05 起“估算”只由热量大字旁的 tag 表达（模板绑定 card.heatEstimated），
  // 重复的“营养为估算值”说明行已删除；这里验实际字段 + 模板里用户可见的标识。
  check(
    '估算提示可见',
    page.data.card.heatEstimated === true &&
      homeWxml.indexOf('<text class="tag tag-warn" wx:if="{{card.heatEstimated}}">估算</text>') >= 0 &&
      homeWxml.indexOf('estimateNote') < 0,
    JSON.stringify({ heatEstimated: page.data.card.heatEstimated }),
  );
  check('搭配说明用已知类别', page.data.card.pairingText === '主食、蛋白质食物、蔬菜都有');
  check('本餐计划合计按已知价', page.data.card.plannedPriceText === '￥13.00');
  check('今日小结用已记录口径', page.data.summary.recordedText === '今天已记 1 餐');
  check('今日小结未知热量写待补全', page.data.summary.energyText === '待补全' && page.data.summary.energyIncomplete === true);
  check('未设预算不渲染预算行', page.data.summary.budgetSet === false);
  check('默认底部入口为今日', page.data.tab === 'today' && page.data.tabs.map((tab) => tab.label).join('/') === '今日/记录/我的');
}

// ===== 2. 完整模式：共享布局 + 紧凑营养区 =====
{
  const page = makePage(homeView());
  page.onShow();
  page.data.mode = 'full';
  const view = homeView();
  page.data.view = view;
  page.data.activeMeal = 'lunch';
  page.applyHome(view);
  check('完整模式显示营养区', page.data.card.macro.show === true);
  check('完整模式状态 complete', page.data.card.macro.state === 'complete');
  check(
    '三项克数与比例',
    page.data.card.macro.rows.map((row) => `${row.label}${row.gramsText}${row.percentText}`).join('|') ===
      '蛋白质30 克20.0%|脂肪20 克30.0%|碳水75 克50.0%',
  );
  // 比例条与表格同源：先用夹具 knownSums 独立算期望（P=4×300dg=1200、F=9×200dg=1800、C=4×750dg=3000，
  // T=6000 → 20.0%/30.0%/50.0%），再核对“表格克数/占比、barPercent、模板实际绑定的 style 串”三者一致，
  // 不是只验字段存在或用模板取不到的值。
  const expectedMacro = [
    { key: 'proteinDg', grams: '30 克', percent: '20.0%', binding: 'card.macro.barStyleProtein' },
    { key: 'fatDg', grams: '20 克', percent: '30.0%', binding: 'card.macro.barStyleFat' },
    { key: 'carbDg', grams: '75 克', percent: '50.0%', binding: 'card.macro.barStyleCarb' },
  ];
  const macroRows = page.data.card.macro.rows;
  const barStyles = {
    proteinDg: page.data.card.macro.barStyleProtein,
    fatDg: page.data.card.macro.barStyleFat,
    carbDg: page.data.card.macro.barStyleCarb,
  };
  const rowsMatchShares =
    macroRows.length === expectedMacro.length &&
    expectedMacro.every((want, index) => {
      const row = macroRows[index];
      return (
        row.key === want.key &&
        row.gramsText === want.grams &&
        row.percentText === want.percent &&
        row.barPercent === parseFloat(want.percent) &&
        barStyles[want.key] === `width: ${row.barPercent}%;`
      );
    });
  const templateBindsSameSource = expectedMacro.every(
    (want) => homeWxml.indexOf(`style="{{${want.binding}}}"`) >= 0,
  );
  check(
    '比例条与表格同源',
    rowsMatchShares && templateBindsSameSource,
    JSON.stringify({ macroRows, barStyles, templateBindsSameSource }),
  );
  check('简易/完整共享同一张卡与操作', page.data.card.canConfirm === true && page.data.card.dishes.length === 3);
}

// ===== 3. 未知数据：待补全，不按 0，不画条 =====
{
  const unknownItems = [
    item({
      itemKey: 'lunch:manual:lunch:manual-x:0',
      offerId: '',
      dishId: '',
      windowId: '',
      name: '手工补充的未知食物',
      category: null,
      priceCents: null,
      priceKnown: false,
      priceLabel: '实付未填',
      nutrition: null,
      nutritionKnown: false,
      estimated: false,
      estimatedLabel: '',
      unknownLabel: '营养未知、价格未知',
    }),
  ];
  const view = homeView({
    meals: [
      mealView({ meal: 'breakfast', label: '早餐', hasPlan: false, items: [], knownSums: null, plannedKnownCents: 0 }),
      mealView({
        items: unknownItems,
        knownSums: null,
        incompleteNutrients: ['energyKcal', 'proteinDg', 'fatDg', 'carbDg'],
        unknownItemCount: 1,
        plannedKnownCents: 0,
        priceIncomplete: true,
        confirmed: true,
        planStatusLabel: '已确认',
      }),
      mealView({ meal: 'dinner', label: '晚餐', hasPlan: false, items: [], knownSums: null, plannedKnownCents: 0 }),
    ],
  });
  const page = makePage(view);
  page.onShow();
  page.data.activeMeal = 'lunch';
  page.data.mode = 'full';
  page.applyHome(view);
  check('未知热量写“热量待补全”', page.data.card.heatText === '热量待补全' && page.data.card.heatUnknown === true);
  check('未知不显示 0 千卡', page.data.card.heatText.indexOf('0 千卡') < 0);
  check('未知类别写搭配待补', page.data.card.pairingText === '搭配信息待补');
  check('未知营养四项待补全', page.data.card.macro.state === 'incomplete' && page.data.card.macro.showBar === false);
  check(
    '未知项不给百分比',
    page.data.card.macro.rows.every((row) => row.percentText === '待补全' && row.gramsText === '待补全'),
  );
  check('已确认餐次可回来查看', page.data.card.confirmed === true && page.data.card.canConfirm === false);
}

// ===== 4. 切换餐次与模式：不写业务数据 =====
{
  const view = homeView();
  const page = makePage(view);
  page.onShow();
  storeCalls.length = 0;
  const beforeMeal = page.data.activeMeal;
  const targetMeal = beforeMeal === 'lunch' ? 'dinner' : 'lunch';
  page.onSelectMeal({ currentTarget: { dataset: { meal: targetMeal } } });
  check('切换餐次只改展示', page.data.activeMeal === targetMeal);
  check('切换餐次不写业务数据', storeCalls.length === 0);
  const beforeMode = page.data.mode;
  page.onToggleMode();
  check('模式切换成功并保存', page.data.mode !== beforeMode && storage.get('tk.ui.displayMode.v1') === page.data.mode);
  check('模式切换不写业务数据', storeCalls.length === 0);
  check('模式切换不改变当前餐次', page.data.activeMeal === targetMeal);
  check('模式切换不影响外观键', storage.has('tk.ui.appearance.v1') === false);
}

// ===== 5. 确认吃了 / 自己选菜入口 / 导航 =====
{
  const page = makePage(homeView());
  page.onShow();
  page.data.activeMeal = 'lunch';
  page.applyHome(homeView());
  calls.navigateTo.length = 0;
  page.onConfirmMeal();
  check('确认吃了打开记录页并带餐次', calls.navigateTo.length === 1 && calls.navigateTo[0].url === '/pages/logs/index?meal=lunch');
  // T05S03 起“自己选菜”是独立次级页入口：断言获批的跳转目标与当前餐次参数，
  // 不再断言已移除的缺能力弹层（selfPickOpen/selfPick.missing/selfPick.hint）。
  calls.navigateTo.length = 0;
  page.onOpenSelfPick();
  check(
    '自己选菜打开独立次级页并带当前餐次',
    calls.navigateTo.length === 1 && calls.navigateTo[0].url === '/pages/self-pick/index?meal=lunch',
  );
  calls.reLaunch.length = 0;
  page.onTab({ currentTarget: { dataset: { tab: 'profile' } } });
  check('底部导航切到我的', calls.reLaunch.length === 1 && calls.reLaunch[0].url === '/pages/profile/index');
  calls.reLaunch.length = 0;
  page.onTab({ currentTarget: { dataset: { tab: 'today' } } });
  check('重复点击当前入口不跳转', calls.reLaunch.length === 0);
}

console.log('');
if (failures.length === 0) {
  console.log(`全部通过：${passed} 项（本地 Node 验证，不能替代微信开发者工具/真机）`);
} else {
  console.log(`失败 ${failures.length} 项：${failures.join('、')}`);
}
process.exitCode = failures.length === 0 ? 0 : 1;
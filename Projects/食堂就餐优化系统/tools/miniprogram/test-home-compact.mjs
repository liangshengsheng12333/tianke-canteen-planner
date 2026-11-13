// test-home-compact.mjs — T05U09a 首页“其他方案”精简与“供能占比”标注（Node 直跑页面 TS，非微信/真机证据）。
//
// 覆盖：
//  - “其他方案”默认只给一行状态 + 必要标记，说明/技术信息默认折叠；
//  - WASM、greedy、comboRules、OkPartial 等内部实现细节不进默认可见区，但仍保留在技术信息里可诊断；
//  - 估算、未知价/营养、预算受限等业务标记保留；
//  - 完整模式宏量百分比旁标注“供能占比”，简易模式不渲染营养区。
//
// 运行（candidate 根）：
//   node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-home-compact.mjs
import path from 'node:path';
import { readFileSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pagePath = path.join(projectRoot, 'miniprogram', 'src', 'pages', 'home', 'index.ts');
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

const INTERNAL_TERMS = ['WASM', 'greedy', 'comboRules', 'OkPartial', 'branchAndBound', 'plannerConfig'];
function containsInternal(text) {
  return INTERNAL_TERMS.some((term) => String(text || '').indexOf(term) >= 0);
}

// ===== 受控 wx / App / Page 桩 =====
const storage = new Map();
const calls = { navigateTo: [], reLaunch: [], toast: [], actionSheet: [] };
globalThis.wx = {
  getStorageSync: (key) => (storage.has(key) ? storage.get(key) : ''),
  setStorageSync: (key, value) => storage.set(key, value),
  setNavigationBarColor() {},
  setBackgroundColor() {},
  showToast(options) {
    calls.toast.push(options);
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
      items: [item()],
      knownSums: { energyKcal: 600, proteinDg: 300, fatDg: 200, carbDg: 750 },
      incompleteNutrients: [],
      unknownItemCount: 0,
      plannedKnownCents: 100,
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
      planMessage: '已生成方案，但存在独立限制标志（如估算数据、价格/营养不完整、近似结果），请查看标志说明。',
      plans: [],
      flags: [],
      lockIssues: [],
      soldOutMarks: [],
      canPlan: true,
      capabilityMessage: '当前受支持子集：greedy / dp / branchAndBound + comboRules=[]',
      lastAction: '',
      progress: { confirmedMeals: 1, text: '1 / 3 餐已确认' },
      intake: {
        energyKcal: 600,
        incompleteNutrients: [],
        priceKnownCents: 100,
        priceIncomplete: false,
        energyLabel: '约 600 千卡',
      },
      budget: {
        budgetSet: true,
        budgetLabel: '￥30.00',
        plannedLabel: '￥11.00',
        plannedPriceIncomplete: false,
        spentLabel: '￥1.00',
        remainingKnown: true,
        remainingKnownCents: 2900,
        overBudget: false,
        overageCents: null,
        accountingComplete: true,
      },
      meals: [
        mealView({ meal: 'breakfast', label: '早餐', hasPlan: false, items: [], knownSums: null, plannedKnownCents: 0 }),
        mealView(),
        mealView({ meal: 'dinner', label: '晚餐', hasPlan: false, items: [], knownSums: null, plannedKnownCents: 0 }),
      ],
    },
    overrides,
  );
}

function makeStore(view) {
  return {
    ensureToday: () => false,
    getHomeView: () => view,
    refreshPlan: () => Promise.resolve({ ok: true, message: '' }),
    selectPlan: () => ({ ok: true, message: '' }),
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
  return page;
}

function planFixture(overrides = {}) {
  return Object.assign(
    {
      index: 0,
      title: '主推荐',
      priceCents: 1100,
      priceLabel: '￥11.00',
      nutritionDeviationBp: 120,
      nutritionCompleteness: 'complete',
      flags: [],
      selected: true,
    },
    overrides,
  );
}

// ===== 1. 默认折叠：一行状态 + 必要标记，内部细节不进默认可见区 =====
{
  const view = homeView({
    planState: 'unsupported',
    canPlan: false,
    planMessage: '当前受支持能力不允许规划：当前只支持 algorithm="greedy" / "dp" / "branchAndBound"，收到 "x"',
    lastAction: 'WASM 核心已加载',
    flags: ['含估算数据', '含未知价格项', '预算核算不完整'],
    plans: [
      planFixture({ title: 'greedy' }),
      planFixture({ index: 1, title: '经济备选', priceLabel: '￥9.00', selected: false, flags: ['含未知价格项'] }),
    ],
  });
  const page = makePage(view);
  page.onShow();
  page.data.activeMeal = 'lunch';
  page.applyHome(view);

  check('默认不展开说明', page.data.plansOpen === false);
  check('一行状态短标签可读', page.data.planStatusShort === '暂不支持', page.data.planStatusShort);
  check('一行说明给出业务结论', page.data.planHint.indexOf('超出受支持范围') >= 0 && !containsInternal(page.data.planHint), page.data.planHint);
  check('默认可见区不出现内部细节（数据层）', !containsInternal([page.data.planHint, page.data.planStatusShort].join('|')));
  check(
    '默认可见区不绑定内部字段（模板层）',
    homeWxml.indexOf('{{planMessage}}') < 0 &&
      homeWxml.indexOf('{{view.capabilityMessage}}') < 0 &&
      homeWxml.indexOf('{{view.planStatusLabel}}') < 0 &&
      homeWxml.indexOf('{{view.lastAction}}') < 0,
  );
  check('说明与技术信息都在折叠块内', homeWxml.indexOf('wx:if="{{plansOpen}}"') >= 0 && homeWxml.indexOf('<block wx:if="{{plansOpen}}">') >= 0);
  check(
    '内部实现细节保留在技术信息（可诊断）',
    ['WASM', 'greedy', 'comboRules', 'OkPartial'].every((term) => page.data.planTechNotes.join('|').indexOf(term) >= 0),
    JSON.stringify(page.data.planTechNotes),
  );
  check('方案名兜底为可读名', page.data.plans[0].title === '方案 1' && page.data.plans[1].title === '经济备选', JSON.stringify(page.data.plans.map((plan) => plan.title)));
  check(
    '原始策略名保留在技术信息',
    page.data.planTechNotes.some((note) => note.indexOf('原始名称：greedy') >= 0),
    JSON.stringify(page.data.planTechNotes),
  );
  check('技术信息不进入默认说明', page.data.planNotes.every((note) => !containsInternal(note)), JSON.stringify(page.data.planNotes));

  // 业务标记（估算 / 未知价格 / 预算核算）仍作为可见 tag 保留。
  const topLabels = page.data.topFlags.map((entry) => entry.label);
  check(
    '估算/未知价/预算标记保留',
    topLabels.indexOf('含估算数据') >= 0 && topLabels.indexOf('含未知价格项') >= 0 && topLabels.indexOf('预算核算不完整') >= 0,
    JSON.stringify(topLabels),
  );
  // 顶部总提示去重后不应重复方案卡已有的 tag；内部实现细节不进入业务 tag。
  check('业务 tag 不含内部实现细节', topLabels.every((label) => !containsInternal(label)), JSON.stringify(topLabels));
  check('预算受限信息仍可见', page.data.summary.budgetSet === true && page.data.summary.overBudget === false && page.data.summary.budgetLabel === '￥30.00');
}

// ===== 2. 展开/收起只改展示，不写业务数据 =====
{
  const view = homeView();
  const page = makePage(view);
  page.onShow();
  const before = JSON.stringify(page.data.plansOpen);
  page.onTogglePlansDetail();
  check('展开说明', page.data.plansOpen === true);
  page.onTogglePlansDetail();
  check('收起说明', page.data.plansOpen === false && before === 'false');
}

// ===== 3. 正常业务说明仍进可展开区 =====
{
  const view = homeView({
    planState: 'no-plan',
    planStatus: 'NoFeasible',
    planStatusLabel: '没有合法方案',
    planMessage: '在候选未被截断的前提下，当前菜单/约束没有合法组合；这不是营养问题，也不冒充方案。',
  });
  const page = makePage(view);
  page.onShow();
  page.applyHome(view);
  check('业务说明保留在展开区', page.data.planNotes.some((note) => note.indexOf('没有合法组合') >= 0), JSON.stringify(page.data.planNotes));
  check('业务说明与状态码分开', page.data.planTechNotes.some((note) => note.indexOf('NoFeasible') >= 0));
}

// ===== 4. 完整模式标注“供能占比”，简易模式不渲染营养区 =====
{
  const view = homeView();
  const page = makePage(view);
  page.onShow();
  page.data.activeMeal = 'lunch';
  page.data.mode = 'full';
  page.applyHome(view);
  check('完整模式显示营养区', page.data.card.macro.show === true);
  check(
    '营养区标注“供能占比”',
    homeWxml.indexOf('<text class="macro-share-label">供能占比</text>') >= 0 &&
      homeWxml.indexOf('<view class="macro-title-row">') >= 0,
  );
  check('百分比本身未被改写（仍是百分比文案）', page.data.card.macro.rows.map((row) => row.percentText).join(',') === '20.0%,30.0%,50.0%');
  page.data.mode = 'simple';
  page.applyHome(view);
  check('简易模式不显示营养区', page.data.card.macro.show === false && page.data.card.macro.rows.length === 0);
}

console.log('');
if (failures.length === 0) {
  console.log(`全部通过：${passed} 项（本地 Node 验证，不能替代微信开发者工具/真机）`);
} else {
  console.log(`失败 ${failures.length} 项：${failures.join('、')}`);
}
process.exitCode = failures.length === 0 ? 0 : 1;
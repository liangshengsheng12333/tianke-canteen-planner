// test-logs-meal-tabs.mjs — T05U07 记录页早/中/晚标签切换的页面级验证（Node 直跑页面 TS，不是微信运行时证据）。
//
// 用真实页面模块 + 受控 store 视图，验证任务卡验收项：
//  - 三个餐次标签存在、首次进入按当前时段选餐（8 点早餐 / 12 点午餐 / 20 点晚餐）、用户手选后保持；
//  - 切标签只换查看范围：不写业务数据、不重读 store、不改日期/月汇总，页面只渲染选中那一餐；
//  - 标签状态（已记/未结束/待确认/未记）来自同一份 section 视图；
//  - 选中餐次下的确认、修改、撤销、补记都带正确的餐次与 recordId；
//  - 历史日期只读：切标签照常可用但不出现写入口、不写数据；
//  - 当日已知/月度汇总在切标签前后完全不变（仍统计全部有效餐次，不随标签缩水）；
//  - 浅色/深色两主题：themeClass 由外观模块给出，标签样式只走 --tk-* 令牌。
//
// 运行（候选根，API 与现有测试一致）：
//   node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-logs-meal-tabs.mjs \
//     [--theme light|dark] [--dump-dir <dir>]
// 注意：--theme 需要在导入页面模块前写入存储（appearance 模块在求值时读取偏好）。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pagePath = path.join(projectRoot, 'miniprogram', 'src', 'pages', 'logs', 'index.ts');
const logsPath = path.join(projectRoot, 'miniprogram', 'src', 'domain', 'logs.ts');
const wxmlPath = path.join(projectRoot, 'miniprogram', 'src', 'pages', 'logs', 'index.wxml');
const wxssPath = path.join(projectRoot, 'miniprogram', 'src', 'pages', 'logs', 'index.wxss');
const appWxssPath = path.join(projectRoot, 'miniprogram', 'src', 'app.wxss');

function argValue(name, fallback) {
  const index = process.argv.indexOf(name);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}
const THEME = argValue('--theme', 'light') === 'dark' ? 'dark' : 'light';
const DUMP_DIR = argValue('--dump-dir', '');

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

// ===== 受控 wx 桩（存储先于页面模块导入写入外观偏好） =====
const storage = new Map();
const calls = { toast: [], modal: [], scroll: [] };
let modalConfirm = true;
globalThis.wx = {
  getStorageSync: (key) => (storage.has(key) ? storage.get(key) : ''),
  setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: (key) => storage.delete(key),
  setNavigationBarColor() {},
  setBackgroundColor() {},
  showToast(options) {
    calls.toast.push(options);
  },
  showModal(options) {
    calls.modal.push(options);
    if (options && typeof options.success === 'function') {
      options.success({ confirm: modalConfirm, cancel: !modalConfirm });
    }
  },
  pageScrollTo(options) {
    calls.scroll.push(options);
  },
  getAppBaseInfo: () => ({}),
  getSystemInfoSync: () => ({}),
};
globalThis.getCurrentPages = () => [];
storage.set('tk.ui.appearance.v1', THEME);
storage.set('tk.ui.displayMode.v1', 'simple');

const logsDomain = await import(pathToFileURL(logsPath).href);

// ===== 模拟记录/视图构造（显式模拟数据，不来自真实菜单或真实消费） =====
function logItem(overrides = {}) {
  return Object.assign(
    {
      itemKey: '模拟-item',
      source: 'manual',
      offerId: null,
      dishId: null,
      menuVersion: null,
      nameSnapshot: '模拟米饭',
      portionCode: 'full',
      quantity: 1,
      unitPriceCents: 100,
      priceKnown: true,
      nutrition: { energyKcal: 232, proteinDg: 44, fatDg: 6, carbDg: 516 },
      nutritionBasis: null,
      note: null,
    },
    overrides,
  );
}
function mealLog(overrides = {}) {
  return Object.assign(
    {
      contractVersion: '1.0',
      recordId: 'rec-1',
      confirmationId: 'conf-1',
      businessDate: '2026-10-21',
      tzOffsetMinutes: 480,
      meal: 'lunch',
      status: 'active',
      revision: 1,
      supersedesRecordId: null,
      revokedByRecordId: null,
      createdAt: '2026-10-21T12:00:00.000+08:00',
      updatedAt: '2026-10-21T12:00:00.000+08:00',
      menuVersion: null,
      items: [logItem()],
    },
    overrides,
  );
}
function dayRecord(businessDate, records, endedMeals = []) {
  return {
    businessDate,
    tzOffsetMinutes: 480,
    soldOut: [],
    windowLocks: [],
    itemLocks: [],
    endedMeals,
    logs: records,
    plan: null,
    selectedPlanIndex: 0,
  };
}
function planItem(overrides = {}) {
  return Object.assign(
    { itemKey: 'plan-米饭', name: '模拟米饭', portionLabel: '整份', priceKnown: true, priceCents: 100 },
    overrides,
  );
}

const SETTINGS = { budgetCents: 3000, algorithm: 'greedy', strategies: [], maxItemsPerMeal: 2, limits: null };
const MEAL_LABELS = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' };
const MEALS = ['breakfast', 'lunch', 'dinner'];

/** 由记录数组构造 store 的 LogsView（复用 domain/logs 的真实视图构造，避免手写错误口径）。 */
function makeView(date, records, endedMeals = [], plans = {}) {
  const day = dayRecord(date, records, endedMeals);
  const meals = MEALS.map((meal) => {
    const mealLogs = records.filter((log) => log.meal === meal);
    const active = mealLogs.filter((log) => log.status === 'active').map(logsDomain.buildLogView);
    const history = mealLogs.filter((log) => log.status !== 'active').map(logsDomain.buildLogView);
    const planItems = plans[meal] || [];
    return {
      meal,
      label: MEAL_LABELS[meal],
      ended: endedMeals.indexOf(meal) >= 0,
      confirmed: active.length > 0,
      canConfirm: planItems.length > 0 && active.length === 0 && endedMeals.indexOf(meal) < 0,
      active,
      history,
      planItems,
      confirmHint: active.length > 0 ? '该餐已确认；推荐不会覆盖已吃快照。' : '尚无推荐菜品；可先生成方案或直接补记。',
    };
  });
  return {
    businessDate: date,
    dateLabel: date,
    meals,
    intake: logsDomain.buildIntakeView(day),
    budget: logsDomain.buildBudgetView(SETTINGS, day, null),
    recentDays: [],
  };
}

// ===== 受控 store：world 可在每个用例前替换；写方法记录参数，不静默吞掉 =====
let world = { records: {}, ended: {}, plans: {} };
const writeCalls = [];
const readCalls = [];
function resetWorld(next) {
  world = next || { records: {}, ended: {}, plans: {} };
  writeCalls.length = 0;
  readCalls.length = 0;
}
const TODAY = '2026-10-21';

function makeStore() {
  return {
    ensureToday() {
      readCalls.push('ensureToday');
      return false;
    },
    getLogsView(date) {
      const key = date || TODAY;
      readCalls.push(`getLogsView:${key}`);
      return makeView(key, world.records[key] || [], world.ended[key] || [], world.plans[key] || {});
    },
    getMonthLogs(monthKey) {
      readCalls.push(`getMonthLogs:${monthKey}`);
      return Object.keys(world.records)
        .filter((date) => date.slice(0, 7) === monthKey)
        .sort()
        .map((date) => ({ businessDate: date, day: dayRecord(date, world.records[date], world.ended[date] || []) }));
    },
    confirmMeal(meal, priceEdits) {
      writeCalls.push({ method: 'confirmMeal', meal, priceEdits });
      return { ok: true, message: '已确认' };
    },
    addManualLog(meal, input) {
      writeCalls.push({ method: 'addManualLog', meal, input });
      return { ok: true, message: '补记已保存' };
    },
    editLog(recordId, input) {
      writeCalls.push({ method: 'editLog', recordId, input });
      return { ok: true, message: '修改已保存' };
    },
    revokeLog(recordId) {
      writeCalls.push({ method: 'revokeLog', recordId });
      return { ok: true, message: '已撤销' };
    },
    endMeal(meal) {
      writeCalls.push({ method: 'endMeal', meal });
      return { ok: true, message: '已结束' };
    },
    reopenMeal(meal) {
      writeCalls.push({ method: 'reopenMeal', meal });
      return { ok: true, message: '已重开' };
    },
    refreshPlan() {
      writeCalls.push({ method: 'refreshPlan' });
      return { ok: true, message: '已刷新' };
    },
  };
}
globalThis.getApp = () => ({ globalData: { store: makeStore() } });

let pageOptions = null;
globalThis.Page = (options) => {
  pageOptions = options;
};
await import(pathToFileURL(pagePath).href);
if (!pageOptions) {
  console.error('页面模块没有调用 Page()');
  process.exit(1);
}

function deepCopy(value) {
  return JSON.parse(JSON.stringify(value));
}
/** 支持 setData 的多级路径写法（"a[0].b[1].c"），页面 patchSection/表单输入依赖它。 */
function setByPath(target, key, value) {
  const parts = [];
  const pattern = /([A-Za-z0-9_$]+)|\[(\d+)\]/g;
  let match;
  while ((match = pattern.exec(key)) !== null) {
    parts.push(match[2] !== undefined ? Number(match[2]) : match[1]);
  }
  if (parts.length === 0) {
    target[key] = value;
    return;
  }
  let node = target;
  for (let i = 0; i < parts.length - 1; i += 1) {
    node = node[parts[i]];
    if (node === undefined || node === null) {
      return;
    }
  }
  node[parts[parts.length - 1]] = value;
}
function makePage() {
  const page = Object.assign({}, pageOptions);
  page.data = deepCopy(pageOptions.data);
  page.setData = function setData(patch, callback) {
    Object.keys(patch).forEach((key) => {
      if (key.indexOf('[') >= 0) {
        setByPath(this.data, key, patch[key]);
      } else {
        this.data[key] = patch[key];
      }
    });
    if (callback) callback();
  };
  return page;
}
/** 固定“当前时间”到指定小时，只影响页面里 new Date() 的取时，不改任何源码。 */
function withFixedHour(hour, fn) {
  const RealDate = globalThis.Date;
  class FixedDate extends RealDate {
    constructor(...args) {
      if (args.length === 0) {
        super(2026, 9, 24, hour, 0, 0, 0);
      } else {
        super(...args);
      }
    }
    static now() {
      return new RealDate(2026, 9, 24, hour, 0, 0, 0).getTime();
    }
  }
  globalThis.Date = FixedDate;
  try {
    return fn();
  } finally {
    globalThis.Date = RealDate;
  }
}
function openPage(hour) {
  const page = makePage();
  withFixedHour(hour, () => page.onShow());
  return page;
}
function tabOf(page, meal) {
  return page.data.mealTabs.filter((tab) => tab.key === meal)[0] || null;
}
function sectionOf(page, meal) {
  return page.data.sections.filter((section) => section.meal === meal)[0] || null;
}
function visibleSections(page) {
  return page.data.sections.filter((section) => section.meal === page.data.activeMeal);
}
function tap(tapHandler, dataset) {
  return { currentTarget: { dataset } };
}
function dayTotals(page) {
  return {
    energy: page.data.intake ? page.data.intake.energyLabel : null,
    protein: page.data.intake ? page.data.intake.proteinLabel : null,
    itemCount: page.data.intake ? page.data.intake.itemCount : null,
    unknownCount: page.data.intake ? page.data.intake.unknownItemCount : null,
    spent: page.data.spentKnownLabel,
    planned: page.data.plannedKnownLabel,
    remaining: page.data.remainingLabel,
    monthLine: page.data.monthLineText,
    monthPrice: page.data.monthPriceLabel,
    monthEnergy: page.data.monthEnergyLabel,
  };
}
function snapshot(page, label) {
  const visible = visibleSections(page);
  return {
    label,
    theme: THEME,
    themeClass: page.data.themeClass,
    viewingDate: page.data.viewingDate,
    readonly: page.data.readonly,
    activeMeal: page.data.activeMeal,
    mealTouched: page.data.mealTouched,
    mealTabs: page.data.mealTabs,
    renderedSectionCount: visible.length,
    sectionsInData: page.data.sections.map((section) => ({
      meal: section.meal,
      label: section.label,
      ended: section.ended,
      confirmed: section.confirmed,
      activeRecords: section.active.length,
      historyRecords: section.history.length,
      planRows: section.planRows.length,
      manualOpen: section.manualOpen,
      confirmOpen: section.confirmOpen,
    })),
    visibleSection: visible[0]
      ? {
          meal: visible[0].meal,
          activeRecordIds: visible[0].active.map((record) => record.recordId),
          historyRecordIds: visible[0].history.map((record) => record.recordId),
          planItemKeys: visible[0].planRows.map((row) => row.itemKey),
        }
      : null,
    dayTotals: dayTotals(page),
    month: {
      line: page.data.monthLineText,
      price: page.data.monthPriceLabel,
      energy: page.data.monthEnergyLabel,
      note: page.data.monthNoteText,
    },
    emptyDay: page.data.emptyDay,
    emptyActionHint: page.data.emptyActionHint,
  };
}
const dumps = [];
function dump(page, label) {
  dumps.push(snapshot(page, label));
}

// 世界：今天早餐/午餐/晚餐各一条有效记录，便于验证“切标签不缩水”和改撤归属。
function baseWorld() {
  return {
    records: {
      [TODAY]: [
        mealLog({ recordId: 'rec-b', confirmationId: 'conf-b', businessDate: TODAY, meal: 'breakfast', items: [logItem({ unitPriceCents: 100 })] }),
        mealLog({ recordId: 'rec-l', confirmationId: 'conf-l', businessDate: TODAY, meal: 'lunch', items: [logItem({ unitPriceCents: 200, nutrition: { energyKcal: 116, proteinDg: 22, fatDg: 2, carbDg: 300 } })] }),
        mealLog({ recordId: 'rec-d', confirmationId: 'conf-d', businessDate: TODAY, meal: 'dinner', items: [logItem({ unitPriceCents: 300 })] }),
      ],
      '2026-10-20': [mealLog({ recordId: 'rec-20', confirmationId: 'conf-20', businessDate: '2026-10-20', meal: 'lunch' })],
      '2026-10-18': [],
    },
    ended: {},
    plans: {},
  };
}

// ===== 1. 首次进入按当前时段选餐 =====
{
  const hours = [
    [8, 'breakfast', '早餐'],
    [12, 'lunch', '午餐'],
    [20, 'dinner', '晚餐'],
  ];
  for (const [hour, meal, label] of hours) {
    resetWorld(baseWorld());
    const page = openPage(hour);
    check(`首次进入 ${hour} 点选${label}（suggestedMealByTime）`, page.data.activeMeal === meal, `实际 ${page.data.activeMeal}`);
    check(`${hour} 点进入未写业务数据`, writeCalls.length === 0, JSON.stringify(writeCalls));
    check(`${hour} 点进入标签三张且顺序固定`, page.data.mealTabs.map((tab) => tab.key).join(',') === 'breakfast,lunch,dinner');
  }
}

// ===== 2. 三标签切换：只换查看范围（不写、不重读、不改日期/汇总） =====
{
  resetWorld(baseWorld());
  const page = openPage(8);
  check('三张标签文案为早餐/午餐/晚餐', page.data.mealTabs.map((tab) => tab.label).join('/') === '早餐/午餐/晚餐');
  check('默认只渲染选中餐次（早餐）的 section', visibleSections(page).length === 1 && visibleSections(page)[0].meal === 'breakfast');
  const before = dayTotals(page);
  const readsBefore = readCalls.length;
  const dateBefore = page.data.viewingDate;
  writeCalls.length = 0;

  page.onSelectMeal(tap(null, { meal: 'lunch' }));
  check('切到午餐后 activeMeal=lunch', page.data.activeMeal === 'lunch');
  check('切标签不写任何业务数据', writeCalls.length === 0, JSON.stringify(writeCalls));
  check('切标签不重读 store（只用已有 sections）', readCalls.length === readsBefore, `reads ${readCalls.length - readsBefore}`);
  check('切标签不改查看日期', page.data.viewingDate === dateBefore);
  check('切标签后当日已知/月度汇总不变', JSON.stringify(dayTotals(page)) === JSON.stringify(before));
  check('切标签后只渲染午餐 section', visibleSections(page).length === 1 && visibleSections(page)[0].meal === 'lunch');
  check('未选中的两餐数据仍在 page.data（供标签状态与切回使用）', page.data.sections.length === 3);

  page.onSelectMeal(tap(null, { meal: 'dinner' }));
  check('再切到晚餐', page.data.activeMeal === 'dinner' && visibleSections(page)[0].meal === 'dinner');
  page.onSelectMeal(tap(null, { meal: 'dinner' }));
  check('重复点当前标签不改变状态、不写数据', page.data.activeMeal === 'dinner' && writeCalls.length === 0);
  page.onSelectMeal(tap(null, { meal: 'unknown-meal' }));
  check('非法餐次标签被忽略', page.data.activeMeal === 'dinner');
  check('切换后用户选择被标记（mealTouched）', page.data.mealTouched === true);
  dump(page, '切标签-晚餐');

  // 静态：模板只渲染选中餐次，且标签绑定到页面方法。
  const wxml = fs.readFileSync(wxmlPath, 'utf8');
  check('WXML 餐次区带 sec.meal === activeMeal 条件', wxml.indexOf('wx:if="{{sec.meal === activeMeal}}"') >= 0);
  check('WXML 只有一个 sections 渲染循环', (wxml.match(/wx:for="\{\{sections\}\}"/g) || []).length === 1);
  check('WXML 标签绑定 onSelectMeal', wxml.indexOf('bindtap="onSelectMeal"') >= 0);
  check('WXML 标签循环来自 mealTabs', wxml.indexOf('wx:for="{{mealTabs}}"') >= 0);
}

// ===== 3. 用户手选后保持；今日页 ?meal= 优先；新进页面才回到按时段 =====
{
  resetWorld(baseWorld());
  const page = openPage(8);
  page.onSelectMeal(tap(null, { meal: 'dinner' }));
  withFixedHour(9, () => page.onShow());
  check('再次 onShow 保持用户手选（不回到时段建议）', page.data.activeMeal === 'dinner');
  page.onSelectCalendarDate(tap(null, { date: '2026-10-20' }));
  check('切日期保持餐次选择', page.data.activeMeal === 'dinner' && page.data.viewingDate === '2026-10-20');
  page.onBackToday();
  check('回到今天仍保持餐次选择', page.data.activeMeal === 'dinner' && page.data.viewingDate === TODAY);

  // 新页面实例：没有被用户点过的标签，回到当前时段建议。
  const fresh = openPage(8);
  check('新进页面按时段重新选餐（早餐）', fresh.data.activeMeal === 'breakfast' && fresh.data.mealTouched === false);

  // 今日页“确认吃了”带 ?meal=dinner 进来：标签与确认面板都落到晚餐。
  resetWorld({
    records: { [TODAY]: [], '2026-10-20': [] },
    ended: {},
    plans: { [TODAY]: { dinner: [planItem()] } },
  });
  const pending = makePage();
  withFixedHour(8, () => {
    pending.onLoad({ meal: 'dinner' });
    pending.onShow();
  });
  check('?meal= 进来优先选中该餐次', pending.data.activeMeal === 'dinner');
  check('?meal= 进来展开该餐次确认面板', sectionOf(pending, 'dinner').confirmOpen === true && sectionOf(pending, 'breakfast').confirmOpen === false);
  check('?meal= 只改浏览选择、不写业务数据', writeCalls.length === 0);
  check('?meal= 后交还控制权：再次 onShow 保持该餐', (withFixedHour(9, () => pending.onShow()), pending.data.activeMeal === 'dinner'));
}

// ===== 4. 标签状态：已记 / 已结束 / 待确认 / 未记 =====
{
  resetWorld({
    records: {
      [TODAY]: [mealLog({ recordId: 'rec-b', confirmationId: 'conf-b', businessDate: TODAY, meal: 'breakfast' })],
    },
    ended: { [TODAY]: ['dinner'] },
    plans: { [TODAY]: { lunch: [planItem()] } },
  });
  const page = openPage(12);
  check('早餐标签状态=已记/ok', tabOf(page, 'breakfast').stateText === '已记' && tabOf(page, 'breakfast').stateKind === 'ok');
  check('午餐有推荐未确认=待确认/plan', tabOf(page, 'lunch').stateText === '待确认' && tabOf(page, 'lunch').stateKind === 'plan');
  check('晚餐已结束=已结束/muted', tabOf(page, 'dinner').stateText === '已结束' && tabOf(page, 'dinner').stateKind === 'muted');
  check('标签状态来自 section 视图、无额外写操作', writeCalls.length === 0);
  dump(page, '标签状态-午餐');
}

// ===== 5. 选中餐次的确认：餐次与价格改动归属正确 =====
{
  resetWorld({
    records: { [TODAY]: [], '2026-10-20': [], '2026-10-18': [] },
    ended: {},
    plans: { [TODAY]: { breakfast: [planItem({ itemKey: 'plan-粥', name: '模拟粥', priceCents: 100 })] } },
  });
  const page = openPage(12); // 时段建议午餐，但确认的是早餐：先切标签
  page.onSelectMeal(tap(null, { meal: 'breakfast' }));
  page.onOpenConfirm(tap(null, { meal: 'breakfast' }));
  check('确认面板只在选中餐次展开', sectionOf(page, 'breakfast').confirmOpen === true && sectionOf(page, 'lunch').confirmOpen === false);
  page.onPriceInput({ currentTarget: { dataset: { meal: 'breakfast', index: 0 } }, detail: { value: '1.50' } });
  page.onConfirmMeal(tap(null, { meal: 'breakfast' }));
  check('确认已吃写到早餐', writeCalls.length === 1 && writeCalls[0].method === 'confirmMeal' && writeCalls[0].meal === 'breakfast', JSON.stringify(writeCalls));
  check('确认时实付 1.50 元转 150 分、itemKey 对应计划行', writeCalls[0].priceEdits['plan-粥'] === 150, JSON.stringify(writeCalls[0] && writeCalls[0].priceEdits));
}

// ===== 6. 选中餐次的修改：只改该餐 recordId，生成 edit 输入 =====
{
  resetWorld(baseWorld());
  const page = openPage(20); // 时段建议晚餐
  check('20 点进入选中晚餐', page.data.activeMeal === 'dinner');
  page.onToggleEdit(tap(null, { meal: 'dinner', record: 'rec-d' }));
  check('修改面板只在晚餐记录上展开', sectionOf(page, 'dinner').active[0].editOpen === true && sectionOf(page, 'breakfast').active[0].editOpen === false);
  page.onEditItemInput({ currentTarget: { dataset: { meal: 'dinner', record: 'rec-d', index: 0, field: 'quantityText' } }, detail: { value: '2' } });
  page.onSaveEdit(tap(null, { meal: 'dinner', record: 'rec-d' }));
  check('保存修改只提交晚餐 recordId', writeCalls.length === 1 && writeCalls[0].method === 'editLog' && writeCalls[0].recordId === 'rec-d', JSON.stringify(writeCalls));
  check('修改数量进入 patch（2）', writeCalls[0].input.items[0].quantity === 2);
  check('修改仍标记实付已知 3.00 元=300 分', writeCalls[0].input.items[0].priceKnown === true && writeCalls[0].input.items[0].unitPriceCents === 300);
  dump(page, '晚餐-修改');
}

// ===== 7. 选中餐次的撤销：recordId 正确、二次确认后才写 =====
{
  resetWorld(baseWorld());
  const page = openPage(20);
  calls.modal.length = 0;
  modalConfirm = false;
  page.onRevoke(tap(null, { meal: 'dinner', record: 'rec-d' }));
  check('撤销先弹二次确认', calls.modal.length === 1 && calls.modal[0].title === '撤销记餐记录');
  check('取消二次确认不写数据', writeCalls.length === 0);
  modalConfirm = true;
  page.onRevoke(tap(null, { meal: 'dinner', record: 'rec-d' }));
  check('确认撤销提交晚餐 recordId', writeCalls.length === 1 && writeCalls[0].method === 'revokeLog' && writeCalls[0].recordId === 'rec-d', JSON.stringify(writeCalls));
}

// ===== 8. 选中餐次的补记：meal 归属正确、输入形态校验 =====
{
  resetWorld(baseWorld());
  const page = openPage(12); // 午餐
  page.onOpenManual(tap(null, { meal: 'lunch' }));
  check('补记面板只在午餐展开', sectionOf(page, 'lunch').manualOpen === true && sectionOf(page, 'breakfast').manualOpen === false);
  page.onManualInput({ currentTarget: { dataset: { meal: 'lunch', field: 'name' } }, detail: { value: '模拟番茄炒蛋' } });
  page.onManualSubmit(tap(null, { meal: 'lunch' }));
  check('补记名称/餐次正确提交', writeCalls.length === 1 && writeCalls[0].method === 'addManualLog' && writeCalls[0].meal === 'lunch', JSON.stringify(writeCalls));
  check(
    '补记输入为整份 ×1、价格未知不按 0',
    !!writeCalls[0] &&
      writeCalls[0].input.portionCode === 'full' &&
      writeCalls[0].input.quantity === 1 &&
      writeCalls[0].input.priceKnown === false &&
      writeCalls[0].input.unitPriceCents === null,
  );
  check('补记成功后收起该餐面板', sectionOf(page, 'lunch').manualOpen === false);

  // 空菜名：只在这个面板报错，不写数据、不改其他餐。
  page.onOpenManual(tap(null, { meal: 'lunch' }));
  writeCalls.length = 0;
  page.onManualSubmit(tap(null, { meal: 'lunch' }));
  check('空菜名在面板内报错且不写数据', sectionOf(page, 'lunch').manualError === '请填写食物名称' && writeCalls.length === 0);
}

// ===== 9. 历史日期只读：标签可切、不出现写入口、不写数据 =====
{
  resetWorld(baseWorld());
  const page = openPage(8);
  page.onSelectCalendarDate(tap(null, { date: '2026-10-20' }));
  check('历史日期进入只读', page.data.readonly === true && page.data.viewingDate === '2026-10-20');
  check('历史日期读取的是该日视图', readCalls.indexOf('getLogsView:2026-10-20') >= 0);
  writeCalls.length = 0;
  const readsBefore = readCalls.length;
  page.onSelectMeal(tap(null, { meal: 'dinner' }));
  check('历史日期仍可切标签查看', page.data.activeMeal === 'dinner' && visibleSections(page)[0].meal === 'dinner');
  check('历史日期切标签不写数据、不重读 store', writeCalls.length === 0 && readCalls.length === readsBefore);
  check('历史日期标签状态可见（午餐已记）', page.data.mealTabs.filter((tab) => tab.key === 'lunch')[0].stateText === '已记');
  const wxml = fs.readFileSync(wxmlPath, 'utf8');
  check('历史只读写入口仍由 !readonly 守卫（模板保留）', (wxml.match(/!readonly/g) || []).length >= 7, `count=${(wxml.match(/!readonly/g) || []).length}`);
  check('餐次标签不受只读限制（可查看历史各餐）', wxml.indexOf('class="meal-tabs"') >= 0 && wxml.slice(wxml.indexOf('class="meal-tabs"'), wxml.indexOf('empty-card')).indexOf('readonly') < 0);
  dump(page, '历史日期-晚餐只读');
}

// ===== 10. 汇总不变：当日已知与月度汇总统计全部有效餐次 =====
{
  resetWorld(baseWorld());
  const page = openPage(8);
  const totals = dayTotals(page);
  const mealsInDay = 3;
  check('当日已记录菜品数为全部餐次（3 项）', totals.itemCount === mealsInDay, `实际 ${totals.itemCount}`);
  check('当日热量含全部餐次（已知小计非零）', typeof totals.energy === 'string' && totals.energy.indexOf('580') >= 0, totals.energy);
  const monthSummaries = dayTotals(page).monthLine;
  check('月度汇总统计 2 天 4 餐（不因选中早餐缩水）', monthSummaries === '本月已记 2 天 · 4 餐', monthSummaries);
  const baseline = JSON.stringify(dayTotals(page));
  for (const meal of MEALS) {
    page.onSelectMeal(tap(null, { meal }));
    check(`切到${MEAL_LABELS[meal]}后当日汇总/月度汇总逐字节不变`, JSON.stringify(dayTotals(page)) === baseline);
    check(`切到${MEAL_LABELS[meal]}后只有该餐渲染`, visibleSections(page).length === 1 && visibleSections(page)[0].meal === meal);
  }

  // 空日：只渲染选中餐次的紧凑卡，汇总仍为空态，不出现“摄入 0”。
  resetWorld({ records: { [TODAY]: [], '2026-10-20': [] }, ended: {}, plans: {} });
  const emptyPage = openPage(12);
  check('空日进入空态且选中午餐', emptyPage.data.emptyDay === true && emptyPage.data.activeMeal === 'lunch');
  check('空日只渲染 lunch section', visibleSections(emptyPage).length === 1);
  calls.scroll.length = 0;
  emptyPage.onEmptyRecordTap();
  check('空日“记一餐”展开的是选中餐次（午餐）', sectionOf(emptyPage, 'lunch').manualOpen === true && sectionOf(emptyPage, 'breakfast').manualOpen === false);
  check('空日“记一餐”滚动到选中餐次', calls.scroll.length === 1 && calls.scroll[0].selector === '#meal-lunch');
  check('空日“记一餐”不写记录', writeCalls.length === 0);
  dump(emptyPage, '空日-午餐');
}

// ===== 10b. 显示模式（简易/完整）与标签切换互不影响 =====
{
  resetWorld(baseWorld());
  storage.set('tk.ui.displayMode.v1', 'full');
  const page = makePage();
  withFixedHour(8, () => page.onShow());
  check('完整模式下页面读取到 mode=full', page.data.mode === 'full');
  const fullTotals = dayTotals(page);
  check('完整模式当日已知包含三大营养素', typeof fullTotals.protein === 'string' && fullTotals.protein.indexOf('g') >= 0 && fullTotals.energy.indexOf('kcal') >= 0, `${fullTotals.energy} / ${fullTotals.protein}`);
  page.onSelectMeal(tap(null, { meal: 'dinner' }));
  check('切标签不改变显示模式', page.data.mode === 'full' && JSON.stringify(dayTotals(page)) === JSON.stringify(fullTotals));
  const wxmlMode = fs.readFileSync(wxmlPath, 'utf8');
  check('完整模式营养区仍由 mode === full 守卫渲染', wxmlMode.indexOf("wx:if=\"{{mode === 'full'}}\"") >= 0);
  storage.set('tk.ui.displayMode.v1', 'simple');
  const simplePage = openPage(8);
  check('简易模式下完整营养区关闭（同一条数据显示口径）', simplePage.data.mode === 'simple' && dayTotals(simplePage).itemCount === fullTotals.itemCount);
}

// ===== 11. 两主题：themeClass 与 --tk-* 令牌（Node 侧数据，不是微信截图） =====
{
  resetWorld(baseWorld());
  const page = openPage(12);
  check(`主题 ${THEME} 下页面主题 class 正确`, page.data.themeClass === (THEME === 'dark' ? 'tk-dark' : 'tk-light'), page.data.themeClass);
  check('切标签不改变主题 class', (page.onSelectMeal(tap(null, { meal: 'dinner' })), page.data.themeClass === (THEME === 'dark' ? 'tk-dark' : 'tk-light')));
  check('本页不写外观键（主题由设置页/系统决定）', storage.get('tk.ui.appearance.v1') === THEME);

  const wxss = fs.readFileSync(wxssPath, 'utf8');
  const tabBlock = wxss.slice(wxss.indexOf('.meal-tabs'), wxss.indexOf('/* 月历'));
  check('标签样式只用 --tk-* 令牌（无写死颜色）', tabBlock.length > 0 && /var\(--tk-/.test(tabBlock) && tabBlock.indexOf('#') < 0 && tabBlock.indexOf('rgb(') < 0);
  const appWxss = fs.readFileSync(appWxssPath, 'utf8');
  const lightBlock = appWxss.slice(appWxss.indexOf('.tk-light {'), appWxss.indexOf('.tk-dark {'));
  const darkBlock = appWxss.slice(appWxss.indexOf('.tk-dark {'), appWxss.indexOf('\n.page {'));
  const usedTokens = ['--tk-card', '--tk-accent', '--tk-accent-soft', '--tk-text', '--tk-muted', '--tk-info', '--tk-shadow'];
  const tokenPairs = {};
  for (const token of usedTokens) {
    const lightMatch = new RegExp(`${token}:\\s*([^;]+);`).exec(lightBlock);
    const darkMatch = new RegExp(`${token}:\\s*([^;]+);`).exec(darkBlock);
    tokenPairs[token] = { light: lightMatch ? lightMatch[1].trim() : null, dark: darkMatch ? darkMatch[1].trim() : null };
  }
  check('标签用到的 7 个令牌在浅色/深色都定义', Object.keys(tokenPairs).every((token) => tokenPairs[token].light && tokenPairs[token].dark), JSON.stringify(tokenPairs));
  console.log('');
  console.log(`[信息] ${THEME} 主题下标签令牌解析值：`);
  console.log(JSON.stringify(tokenPairs, null, 2));
  dumps.push({ label: '主题令牌', theme: THEME, tokenPairs });
  dump(page, `${THEME}-标签`);
}

// ===== 12. 结构化 dump =====
if (DUMP_DIR) {
  fs.mkdirSync(DUMP_DIR, { recursive: true });
  const outFile = path.join(DUMP_DIR, `logs-meal-tabs-${THEME}.json`);
  fs.writeFileSync(
    outFile,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        theme: THEME,
        today: TODAY,
        note: 'Node 侧页面装配 dump（受控 store 模拟数据），不是微信模拟器/真机截图',
        dumps,
      },
      null,
      2,
    ) + '\n',
    'utf8',
  );
  console.log(`[信息] dump 已写入 ${outFile}`);
}

console.log('');
if (failures.length === 0) {
  console.log(`全部通过：${passed} 项（${THEME} 主题；本地 Node 验证，不能替代微信开发者工具/真机）`);
} else {
  console.log(`失败 ${failures.length} 项：${failures.join('、')}`);
}
process.exitCode = failures.length === 0 ? 0 : 1;
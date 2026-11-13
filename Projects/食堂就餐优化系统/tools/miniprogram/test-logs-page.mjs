// test-logs-page.mjs — T05U03 记录页月历/月汇总的页面级验证（Node 直跑页面 TS，不是微信运行时证据）。
//
// 用真实页面模块 + 受控 store 视图，验证：
//  - 默认收起月历、默认今天、简易/完整模式读取；
//  - 月历周一起始、今天/选中/有记录标记同源、点选只切换查看日期；
//  - 前后月按日序号映射并夹取月末（10-31 → 9-30 等），月标题与选中格一致；
//  - 回到今天、空白日空态、月度汇总口径与“含未填项”；
//  - 切日期/切月不调用任何业务写方法；保存成功后日/月同步刷新，取消/失败不改统计。
// 运行：node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-logs-page.mjs
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const pagePath = path.join(projectRoot, 'miniprogram', 'src', 'pages', 'logs', 'index.ts');
const logsPath = path.join(projectRoot, 'miniprogram', 'src', 'domain', 'logs.ts');

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

// ===== 受控 wx 桩 =====
const storage = new Map();
const calls = { toast: [], modal: [], scroll: [] };
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
  },
  pageScrollTo(options) {
    calls.scroll.push(options);
  },
  getAppBaseInfo: () => ({}),
  getSystemInfoSync: () => ({}),
};
globalThis.getCurrentPages = () => [];

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
function dayRecord(businessDate, records) {
  return {
    businessDate,
    tzOffsetMinutes: 480,
    soldOut: [],
    windowLocks: [],
    itemLocks: [],
    endedMeals: [],
    logs: records,
    plan: null,
    selectedPlanIndex: 0,
  };
}

const SETTINGS = { budgetCents: 3000, algorithm: 'greedy', strategies: [], maxItemsPerMeal: 2, limits: null };
const MEAL_LABELS = { breakfast: '早餐', lunch: '午餐', dinner: '晚餐' };

/** 由记录数组构造 store 的 LogsView（复用 domain/logs 的真实视图构造，避免手写错误口径）。 */
function makeView(date, records) {
  const day = dayRecord(date, records);
  const meals = ['breakfast', 'lunch', 'dinner'].map((meal) => {
    const mealLogs = records.filter((log) => log.meal === meal);
    const active = mealLogs.filter((log) => log.status === 'active').map(logsDomain.buildLogView);
    const history = mealLogs.filter((log) => log.status !== 'active').map(logsDomain.buildLogView);
    return {
      meal,
      label: MEAL_LABELS[meal],
      ended: false,
      confirmed: active.length > 0,
      canConfirm: false,
      active,
      history,
      planItems: [],
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

// ===== 受控 store：可随时替换某日记录与某月条目，写方法一调用即失败 =====
const writeCalls = [];
const readCalls = [];
const recordsByDate = {
  '2026-09-30': [mealLog({ recordId: 'r-sep', confirmationId: 'c-sep', businessDate: '2026-09-30', meal: 'dinner' })],
  '2026-10-19': [mealLog({ recordId: 'r-19', confirmationId: 'c-19', businessDate: '2026-10-19', meal: 'breakfast' })],
  '2026-10-20': [
    mealLog({ recordId: 'r-20a', confirmationId: 'c-20a', businessDate: '2026-10-20', meal: 'lunch' }),
    mealLog({ recordId: 'r-20b', confirmationId: 'c-20b', businessDate: '2026-10-20', meal: 'dinner', items: [logItem({ unitPriceCents: 800 })] }),
  ],
  '2026-10-21': [
    mealLog({ recordId: 'r-21', confirmationId: 'c-21', businessDate: '2026-10-21', meal: 'breakfast', items: [logItem({ priceKnown: false, unitPriceCents: null })] }),
  ],
  '2026-10-18': [],
};
const TODAY = '2026-10-21';

function makeStore() {
  const store = {
    ensureToday() {
      readCalls.push('ensureToday');
      return false;
    },
    getLogsView(date) {
      const key = date || TODAY;
      readCalls.push(`getLogsView:${key}`);
      return makeView(key, recordsByDate[key] || []);
    },
    getMonthLogs(monthKey) {
      readCalls.push(`getMonthLogs:${monthKey}`);
      return Object.keys(recordsByDate)
        .filter((date) => date.slice(0, 7) === monthKey)
        .sort()
        .map((date) => ({ businessDate: date, day: dayRecord(date, recordsByDate[date]) }));
    },
    confirmMeal() {
      writeCalls.push('confirmMeal');
      throw new Error('切日期/月历不应写业务数据');
    },
    addManualLog() {
      writeCalls.push('addManualLog');
      throw new Error('切日期/月历不应写业务数据');
    },
    editLog() {
      writeCalls.push('editLog');
      throw new Error('切日期/月历不应写业务数据');
    },
    revokeLog() {
      writeCalls.push('revokeLog');
      throw new Error('切日期/月历不应写业务数据');
    },
    endMeal() {
      writeCalls.push('endMeal');
      throw new Error('切日期/月历不应写业务数据');
    },
    reopenMeal() {
      writeCalls.push('reopenMeal');
      throw new Error('切日期/月历不应写业务数据');
    },
    refreshPlan() {
      writeCalls.push('refreshPlan');
      throw new Error('切日期/月历不应写业务数据');
    },
  };
  return store;
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
/** 支持 setData 的 "a[0].b" 路径写法（页面 patchSection 依赖它）。 */
function setByPath(target, key, value) {
  const match = /^([A-Za-z0-9_$]+)\[(\d+)\](?:\.(.+))?$/.exec(key);
  if (!match) {
    target[key] = value;
    return;
  }
  const list = target[match[1]];
  if (!Array.isArray(list) || !list[Number(match[2])]) {
    return;
  }
  if (match[3]) {
    list[Number(match[2])][match[3]] = value;
  } else {
    list[Number(match[2])] = value;
  }
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
function cellOf(page, date) {
  return page.data.calendarCells.filter((cell) => !cell.empty && cell.date === date)[0] || null;
}

// ===== 1. 默认：简易模式、月历收起、今天、月汇总口径 =====
{
  storage.clear();
  const page = makePage();
  page.onShow();
  check('默认显示模式来自存储（无值为简易）', page.data.mode === 'simple');
  check('默认月历收起', page.data.calendarOpen === false);
  check('默认查看今天', page.data.viewingDate === TODAY && page.data.readonly === false);
  check('默认今天不是空态', page.data.emptyDay === false);
  check('月汇总天数/餐数口径', page.data.monthLineText === '本月已记 3 天 · 4 餐');
  check('月汇总只算本月已知花费', page.data.monthPriceLabel === '已知实付 ￥10.00（含未填项）');
  check('月汇总已知热量', page.data.monthEnergyLabel === '928 kcal');
  check('月汇总价格含未填项', page.data.monthPriceIncomplete === true);
  check('月汇总热量完整（价格未知不影响已知热量）', page.data.monthEnergyIncomplete === false);
  check('月历网格已生成但未展开', page.data.calendarCells.length === 35 && page.data.calendarTitle === '2026年10月');
}

// ===== 1b. 已知合计为 0 但含未填项时，不把未知写成“0 元 / 0 kcal” =====
{
  storage.clear();
  recordsByDate['2026-11-05'] = [mealLog({ recordId: 'r-nov', confirmationId: 'c-nov', businessDate: '2026-11-05', meal: 'lunch', items: [logItem({ priceKnown: false, unitPriceCents: null, nutrition: null })] })];
  const page = makePage();
  page.onShow();
  page.onSelectCalendarDate({ currentTarget: { dataset: { date: '2026-11-05' } } });
  check('11 月只有未知项：天数/餐数仍统计', page.data.monthLineText === '本月已记 1 天 · 1 餐');
  check('只有未知价格时写“实付待补全”', page.data.monthPriceLabel === '实付待补全');
  check('只有未知热量时写“未知（含未填项）”', page.data.monthEnergyLabel === '未知（含未填项）');
  check('未知项不显示 0 kcal', page.data.monthEnergyLabel.indexOf('0 kcal') < 0);
  delete recordsByDate['2026-11-05'];
}

// ===== 2. 完整模式：从存储读取（切换入口不在本页） =====
{
  storage.clear();
  storage.set('tk.ui.displayMode.v1', 'full');
  const page = makePage();
  page.onShow();
  check('完整模式被页面读取', page.data.mode === 'full');
  check('本页不改写显示模式', storage.get('tk.ui.displayMode.v1') === 'full');
  check('本页不写外观键', storage.has('tk.ui.appearance.v1') === false);
}

// ===== 3. 展开月历：周一起始、三标记同源 =====
{
  storage.clear();
  const page = makePage();
  page.onShow();
  page.onToggleCalendar();
  check('展开后可见月历', page.data.calendarOpen === true);
  const cells = page.data.calendarCells;
  check('网格为整周结构', cells.length % 7 === 0 && cells.length === 35);
  check('首行前 3 格为空位', cells[0].empty && cells[1].empty && cells[2].empty && cells[3].empty === false);
  check('10-05 落在每周第一格', cells[7].date === '2026-10-05' && cells[7].empty === false);
  const todayCell = cellOf(page, TODAY);
  check('今天格同时标记今天与选中', todayCell.isToday === true && todayCell.selected === true);
  check('有记录日期三点都标', ['2026-10-19', '2026-10-20', '2026-10-21'].every((date) => cellOf(page, date).hasRecords === true));
  check('空白日无记录标记', cellOf(page, '2026-10-18').hasRecords === false);
  check('展开月历不写业务数据', writeCalls.length === 0);
}

// ===== 4. 点选日期：只切查看日期，月历保持展开 =====
{
  storage.clear();
  const page = makePage();
  page.onShow();
  page.onToggleCalendar();
  readCalls.length = 0;
  page.onSelectCalendarDate({ currentTarget: { dataset: { date: '2026-10-20' } } });
  check('点选日期刷新当日详情', readCalls.indexOf('getLogsView:2026-10-20') >= 0);
  check('点选日期后查看日期变化', page.data.viewingDate === '2026-10-20');
  check('点选历史日期进入只读', page.data.readonly === true);
  check('点选日期保留月历展开', page.data.calendarOpen === true);
  check('选中格跟随点选日期', cellOf(page, '2026-10-20').selected === true && cellOf(page, TODAY).selected === false);
  check('今天标记不随选中移动', cellOf(page, TODAY).isToday === true);
  check('点选日期不写业务数据', writeCalls.length === 0);
  check('点选日期未重算月汇总', page.data.monthLineText === '本月已记 3 天 · 4 餐');
}

// ===== 5. 前后月：日序号映射 + 月末夹取 =====
{
  storage.clear();
  const page = makePage();
  page.onShow();
  page.onToggleCalendar();
  page.onSelectCalendarDate({ currentTarget: { dataset: { date: '2026-10-31' } } });
  check('先选中 10-31', page.data.viewingDate === '2026-10-31');
  readCalls.length = 0;
  page.onPrevMonth();
  check('上月把 31 映射为 9-30', page.data.viewingDate === '2026-09-30');
  check('上月请求了 9-30 的详情', readCalls.indexOf('getLogsView:2026-09-30') >= 0);
  check('月标题切到 9 月', page.data.calendarTitle === '2026年9月');
  check('月汇总切到 9 月口径', page.data.monthLineText === '本月已记 1 天 · 1 餐');
  check('9 月选中格为 30 号', cellOf(page, '2026-09-30').selected === true);
  check('切月不写业务数据', writeCalls.length === 0);
  page.onNextMonth();
  check('下月按 9-30 的日序号回到 10-30', page.data.viewingDate === '2026-10-30');
  check('回到 10 月后月汇总恢复', page.data.monthLineText === '本月已记 3 天 · 4 餐');

  // 跨年：2026-01-31 → 上月 2025-12-31 → 下月回到 2026-01-31
  page.onSelectCalendarDate({ currentTarget: { dataset: { date: '2026-01-31' } } });
  page.onPrevMonth();
  check('跨年上月为 2025-12-31', page.data.viewingDate === '2025-12-31' && page.data.calendarTitle === '2025年12月');
  page.onNextMonth();
  check('跨年下月回到 2026-01-31', page.data.viewingDate === '2026-01-31' && page.data.calendarTitle === '2026年1月');
  check('空月份汇总为 0 天 0 餐', page.data.monthLineText === '本月已记 0 天 · 0 餐');
}

// ===== 6. 空白日空态：不显示“摄入 0”；历史空白日不给写入口，今天空白日给“记一餐” =====
{
  storage.clear();
  const page = makePage();
  page.onShow();
  page.onSelectCalendarDate({ currentTarget: { dataset: { date: '2026-10-18' } } });
  check('空白日进入空态', page.data.emptyDay === true);
  check('空白日不显示零摄入文案', JSON.stringify(page.data.sections).indexOf('摄入 0') < 0);
  check('历史空白日不给“记一餐”提示', page.data.emptyActionHint === '' && page.data.readonly === true);
  calls.scroll.length = 0;
  page.onEmptyRecordTap();
  check('历史空白日不展开补记面板', page.data.sections.every((section) => section.manualOpen === false));
  check('历史空白日不写记录、不滚动', writeCalls.length === 0 && calls.scroll.length === 0);

  // 今天没有任何记录时：空态 + “记一餐”只展开补记表单（不写记录）
  const savedToday = recordsByDate[TODAY];
  recordsByDate[TODAY] = [];
  const todayPage = makePage();
  todayPage.onShow();
  check('今天无记录进入空态', todayPage.data.emptyDay === true && todayPage.data.readonly === false);
  check('今天空态给出“记一餐”提示', todayPage.data.emptyActionHint.indexOf('补记') >= 0);
  calls.scroll.length = 0;
  todayPage.onEmptyRecordTap();
  const opened = todayPage.data.sections.filter((section) => section.manualOpen === true);
  check('“记一餐”只展开一个补记面板', opened.length === 1);
  check('“记一餐”不写记录', writeCalls.length === 0);
  check('“记一餐”滚动到对应餐次', calls.scroll.length === 1 && String(calls.scroll[0].selector).indexOf('#meal-') === 0);
  check('今天空态月汇总为 0 天 0 餐', todayPage.data.monthLineText === '本月已记 2 天 · 3 餐');
  recordsByDate[TODAY] = savedToday;
}

// ===== 6b. 只剩撤销/被替代历史的日期也算空态：撤销后的 0 合计不能冒充“0 摄入” =====
{
  storage.clear();
  recordsByDate['2026-10-17'] = [
    mealLog({ recordId: 'r-17', confirmationId: 'c-17', businessDate: '2026-10-17', meal: 'lunch', status: 'revoked', revokedByRecordId: 'r-17b' }),
  ];
  const page = makePage();
  page.onShow();
  page.onSelectCalendarDate({ currentTarget: { dataset: { date: '2026-10-17' } } });
  check('只有撤销历史的日期进入空态', page.data.emptyDay === true);
  check('撤销历史仍按历史条目展示', page.data.sections[1].history.length === 1 && page.data.sections[1].active.length === 0);
  check('撤销历史的空态不改月汇总', page.data.monthLineText === '本月已记 3 天 · 4 餐');
  check('撤销历史的空态不写业务数据', writeCalls.length === 0);

  // 今天只剩撤销记录：空态 + “记一餐”，月汇总不计该餐
  const savedToday = recordsByDate[TODAY];
  recordsByDate[TODAY] = [
    mealLog({ recordId: 'r-21-rev', confirmationId: 'c-21-rev', businessDate: TODAY, meal: 'breakfast', status: 'revoked', revokedByRecordId: 'r-21' }),
  ];
  const todayPage = makePage();
  todayPage.onShow();
  check('今天只剩撤销记录也算空态', todayPage.data.emptyDay === true && todayPage.data.readonly === false);
  check('今天只剩撤销记录仍给“记一餐”提示', todayPage.data.emptyActionHint.indexOf('补记') >= 0);
  check('今天只剩撤销记录时月汇总不计该餐', todayPage.data.monthLineText === '本月已记 2 天 · 3 餐');
  recordsByDate[TODAY] = savedToday;
  delete recordsByDate['2026-10-17'];
}

// ===== 7. 回到今天 =====
{
  storage.clear();
  const page = makePage();
  page.onShow();
  page.onToggleCalendar();
  page.onSelectCalendarDate({ currentTarget: { dataset: { date: '2026-09-30' } } });
  page.onBackToday();
  check('回到今天恢复可编辑', page.data.viewingDate === TODAY && page.data.readonly === false);
  check('回到今天恢复 10 月汇总', page.data.monthLineText === '本月已记 3 天 · 4 餐');
  check('回到今天月历选中今天', cellOf(page, TODAY).selected === true);
  check('回到今天不写业务数据', writeCalls.length === 0);
}

// ===== 8. 保存成功刷新日/月；取消与失败不改统计 =====
{
  storage.clear();
  const page = makePage();
  page.onShow();
  const beforeLine = page.data.monthLineText;
  const beforeReads = readCalls.length;

  // 取消补记：只关本地面板，不写 store、不刷新统计
  page.onOpenManual({ currentTarget: { dataset: { meal: 'lunch' } } });
  page.onCloseManual({ currentTarget: { dataset: { meal: 'lunch' } } });
  check('取消补记不写业务数据', writeCalls.length === 0);
  check('取消补记不刷新月汇总', page.data.monthLineText === beforeLine);

  // 失败：空菜名提交，只在面板内报错，不写 store、不刷新视图
  page.onOpenManual({ currentTarget: { dataset: { meal: 'lunch' } } });
  const readBeforeSubmit = readCalls.length;
  page.onManualSubmit({ currentTarget: { dataset: { meal: 'lunch' } } });
  check('补记失败在面板内提示', page.data.sections[1].manualError === '请填写食物名称');
  check('补记失败不写业务数据', writeCalls.length === 0);
  check('补记失败不刷新视图', readCalls.length === readBeforeSubmit);

  // 成功：模拟 store 写入成功后新的日/月数据，handleResult 应同时刷新两者
  recordsByDate['2026-10-21'].push(mealLog({ recordId: 'r-new-lunch', confirmationId: 'c-new-lunch', businessDate: TODAY, meal: 'lunch', items: [logItem({ unitPriceCents: 1200 })] }));
  page.handleResult({ ok: true, message: '补记已保存' });
  check('保存成功后日视图带新记录', page.data.sections[1].active.length === 1);
  check('保存成功后月汇总同步', page.data.monthLineText === '本月已记 3 天 · 5 餐');
  check('保存成功后状态行提示', page.data.statusText === '补记已保存' && page.data.statusKind === 'ok');

  // 失败结果不刷新视图
  readCalls.length = 0;
  page.handleResult({ ok: false, message: '保存失败：模拟' });
  check('失败结果不刷新视图', readCalls.length === 0);
  check('失败结果提示错误', page.data.statusKind === 'error' && page.data.statusText === '保存失败：模拟');
  check('失败结果不改统计', page.data.monthLineText === '本月已记 3 天 · 5 餐');
}

console.log('');
if (failures.length === 0) {
  console.log(`全部通过：${passed} 项（本地 Node 验证，不能替代微信开发者工具/真机）`);
} else {
  console.log(`失败 ${failures.length} 项：${failures.join('、')}`);
}
process.exitCode = failures.length === 0 ? 0 : 1;
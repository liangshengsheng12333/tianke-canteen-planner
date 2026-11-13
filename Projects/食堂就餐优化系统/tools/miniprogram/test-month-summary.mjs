// test-month-summary.mjs — T05U03 月度汇总口径验证（Node 直跑 TS，不是微信运行时证据）。
//
// 覆盖：天数=有有效记录的日期数、餐数=不同 (businessDate, meal) 组合、同日同餐多条只算一餐、
//       superseded/revoked 不计、未知价格/热量标“含未填项”且不按 0、跨月数据不混入、空月为 0。
// 运行：node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-month-summary.mjs
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const modulePath = path.join(projectRoot, 'miniprogram', 'src', 'domain', 'logs.ts');

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
function equal(name, actual, expected) {
  check(name, JSON.stringify(actual) === JSON.stringify(expected), `期望 ${JSON.stringify(expected)}，实际 ${JSON.stringify(actual)}`);
}

const logs = await import(pathToFileURL(modulePath).href);

// ===== 模拟记录构造（全部为显式模拟数据，不来自真实菜单/真实消费） =====
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
      businessDate: '2026-10-20',
      tzOffsetMinutes: 480,
      meal: 'lunch',
      status: 'active',
      revision: 1,
      supersedesRecordId: null,
      revokedByRecordId: null,
      createdAt: '2026-10-20T12:00:00.000+08:00',
      updatedAt: '2026-10-20T12:00:00.000+08:00',
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

// ===== 空月 =====
const empty = logs.summarizeMonthLogs('2026-10', []);
equal('空月天数 0', empty.dayCount, 0);
equal('空月餐数 0', empty.mealCount, 0);
equal('空月无记录', empty.hasRecords, false);
equal('空月不算不完整', [empty.priceIncomplete, empty.energyIncomplete], [false, false]);
equal('空月日期集合为空', empty.activeDates, []);

// ===== 单日两餐 =====
const oneDay = logs.summarizeMonthLogs('2026-10', [
  {
    businessDate: '2026-10-20',
    day: dayRecord('2026-10-20', [
      mealLog({ recordId: 'r-lunch', confirmationId: 'c-lunch', meal: 'lunch' }),
      mealLog({ recordId: 'r-dinner', confirmationId: 'c-dinner', meal: 'dinner', items: [logItem({ unitPriceCents: 800, nutrition: { energyKcal: 500, proteinDg: 300, fatDg: 100, carbDg: 400 } })] }),
    ]),
  },
]);
equal('单日两餐：天数 1', oneDay.dayCount, 1);
equal('单日两餐：餐数 2', oneDay.mealCount, 2);
equal('单日两餐：已知花费 900', oneDay.knownPriceCents, 900);
equal('单日两餐：已知热量 732', oneDay.knownEnergyKcal, 732);
equal('单日两餐：不完全标记均为 false', [oneDay.priceIncomplete, oneDay.energyIncomplete], [false, false]);
equal('单日两餐：有记录日期集合', oneDay.activeDates, ['2026-10-20']);

// ===== 多日 + 跨月数据不混入 + 日期排序 =====
const multi = logs.summarizeMonthLogs('2026-10', [
  { businessDate: '2026-10-19', day: dayRecord('2026-10-19', [mealLog({ recordId: 'r19', confirmationId: 'c19', meal: 'breakfast', businessDate: '2026-10-19' })]) },
  { businessDate: '2026-09-30', day: dayRecord('2026-09-30', [mealLog({ recordId: 'r09', confirmationId: 'c09', businessDate: '2026-09-30' })]) },
  { businessDate: '2026-10-21', day: dayRecord('2026-10-21', [mealLog({ recordId: 'r21', confirmationId: 'c21', businessDate: '2026-10-21' })]) },
  { businessDate: '2026-11-01', day: dayRecord('2026-11-01', [mealLog({ recordId: 'r11', confirmationId: 'c11', businessDate: '2026-11-01' })]) },
]);
equal('跨月只统计本月：天数 2', multi.dayCount, 2);
equal('跨月只统计本月：餐数 2', multi.mealCount, 2);
equal('跨月只统计本月：日期集合按升序', multi.activeDates, ['2026-10-19', '2026-10-21']);
equal('跨月只统计本月：花费不含 9/11 月', multi.knownPriceCents, 200);

// ===== superseded / revoked 不计入 =====
const inactiveOnly = logs.summarizeMonthLogs('2026-10', [
  {
    businessDate: '2026-10-18',
    day: dayRecord('2026-10-18', [
      mealLog({ recordId: 'r-old', confirmationId: 'c-old', status: 'superseded', supersedesRecordId: null }),
      mealLog({ recordId: 'r-revoked', confirmationId: 'c-revoked', status: 'revoked', revokedByRecordId: 'r-new' }),
    ]),
  },
]);
equal('只有历史版本时不计天数', [inactiveOnly.dayCount, inactiveOnly.mealCount], [0, 0]);
equal('只有历史版本时不算有记录', inactiveOnly.hasRecords, false);
equal('只有历史版本时不影响金额', inactiveOnly.knownPriceCents, 0);

const withHistory = logs.summarizeMonthLogs('2026-10', [
  {
    businessDate: '2026-10-18',
    day: dayRecord('2026-10-18', [
      mealLog({ recordId: 'r-old', confirmationId: 'c-old', status: 'superseded' }),
      mealLog({ recordId: 'r-active', confirmationId: 'c-active', status: 'active', quantity: 1 }),
    ]),
  },
]);
equal('同日有历史+有效：只算 1 天 1 餐', [withHistory.dayCount, withHistory.mealCount], [1, 1]);
equal('同日有历史+有效：只累计有效记录金额', withHistory.knownPriceCents, 100);

// ===== 同一天同一餐多条有效记录：餐数只算 1，金额/热量按实际累计 =====
const sameMealTwice = logs.summarizeMonthLogs('2026-10', [
  {
    businessDate: '2026-10-20',
    day: dayRecord('2026-10-20', [
      mealLog({ recordId: 'r-plan', confirmationId: 'c-plan', meal: 'lunch', items: [logItem({ unitPriceCents: 300 })] }),
      mealLog({ recordId: 'r-manual', confirmationId: 'c-manual', meal: 'lunch', items: [logItem({ unitPriceCents: 200 })] }),
    ]),
  },
]);
equal('同日同餐两条：天数 1', sameMealTwice.dayCount, 1);
equal('同日同餐两条：餐数仍为 1', sameMealTwice.mealCount, 1);
equal('同日同餐两条：金额按两条记录累计', sameMealTwice.knownPriceCents, 500);
equal('同日同餐两条：热量按两条记录累计', sameMealTwice.knownEnergyKcal, 464);

// ===== 未知价格：标“含未填项”，未知项不按 0 计入已知合计 =====
const unknownPrice = logs.summarizeMonthLogs('2026-10', [
  {
    businessDate: '2026-10-21',
    day: dayRecord('2026-10-21', [
      mealLog({
        recordId: 'r-unknown-price',
        confirmationId: 'c-unknown-price',
        items: [logItem({ priceKnown: false, unitPriceCents: null, nameSnapshot: '模拟价格未知菜' })],
      }),
    ]),
  },
]);
equal('未知价格：天数仍计 1', unknownPrice.dayCount, 1);
equal('未知价格：已知花费 0（不把未知当 0 之外的额外猜测）', unknownPrice.knownPriceCents, 0);
equal('未知价格：标价格含未填项', unknownPrice.priceIncomplete, true);
equal('未知价格：热量已知仍可累计', [unknownPrice.knownEnergyKcal, unknownPrice.energyIncomplete], [232, false]);

// ===== 未知营养：能量行标“含未填项”，不把该记录的热量按 0 加 =====
const unknownEnergy = logs.summarizeMonthLogs('2026-10', [
  {
    businessDate: '2026-10-20',
    day: dayRecord('2026-10-20', [mealLog({ recordId: 'r-e1', confirmationId: 'c-e1' })]),
  },
  {
    businessDate: '2026-10-21',
    day: dayRecord('2026-10-21', [
      mealLog({ recordId: 'r-e2', confirmationId: 'c-e2', items: [logItem({ nutrition: null })] }),
    ]),
  },
]);
equal('未知营养：两天两餐', [unknownEnergy.dayCount, unknownEnergy.mealCount], [2, 2]);
equal('未知营养：只加已知那天的热量', unknownEnergy.knownEnergyKcal, 232);
equal('未知营养：热量含未填项', unknownEnergy.energyIncomplete, true);
equal('未知营养：价格仍完整', unknownEnergy.priceIncomplete, false);

// ===== 没有日志的日子/缺失 day 不参与统计 =====
const gaps = logs.summarizeMonthLogs('2026-10', [
  { businessDate: '2026-10-01', day: dayRecord('2026-10-01', []) },
  { businessDate: '2026-10-02', day: null },
  { businessDate: '2026-10-03', day: dayRecord('2026-10-03', [mealLog({ recordId: 'r3', confirmationId: 'c3', businessDate: '2026-10-03' })]) },
]);
equal('空日期不计数：只有 10-03', gaps.activeDates, ['2026-10-03']);
equal('空日期不计数：天数/餐数', [gaps.dayCount, gaps.mealCount], [1, 1]);

// ===== 非法输入不抛错 =====
const badInput = logs.summarizeMonthLogs('2026-10', [null, {}, { businessDate: 'x', day: null }]);
equal('非法条目被忽略', [badInput.dayCount, badInput.hasRecords], [0, false]);

console.log(failures.length === 0 ? `\n月度汇总口径验证通过（${passed} 项）` : `\n失败 ${failures.length} 项：${failures.join(', ')}`);
process.exitCode = failures.length === 0 ? 0 : 1;
// P01 定向核对：没有待吃推荐不等于有一份 0 元推荐。仅 Node 边界证据。
import assert from 'node:assert/strict';
import { budgetFromPlan } from '../../../miniprogram/src/domain/plan.ts';
import { buildBudgetView } from '../../../miniprogram/src/domain/logs.ts';
import { createDayRecord, defaultSettings } from '../../../miniprogram/src/domain/app-state.ts';
import { SIMULATED_CATALOG } from '../../../miniprogram/src/config/simulated-menu.ts';

const settings = { ...defaultSettings(), budgetCents: 5000 };
const makePlan = (meals) => ({
  budget: { budgetCents: 5000, plannedTotalCents: 1000, plannedTotalKnownCents: 1000,
    priceIncomplete: false, overBudget: false, withinBudgetKnownAmounts: true },
  meals,
});
const day = createDayRecord('2026-10-24', 480);
const absent = buildBudgetView(settings, day, budgetFromPlan(makePlan([]), day, SIMULATED_CATALOG));
assert.equal(absent.plannedTotalCents, null);
assert.equal(absent.withinBudgetKnown, false);
assert.match(absent.message, /不足/);
console.log('PASS pending meals without a recommendation: unknown total, no within-budget claim');

const reopened = { ...day, endedMeals: ['breakfast'] };
const stale = buildBudgetView(settings, reopened, budgetFromPlan(makePlan([
  { meal: 'breakfast', items: [{ priceCents: 1000, quantity: 1 }] },
]), reopened, SIMULATED_CATALOG));
assert.equal(stale.plannedTotalCents, null);
assert.equal(stale.withinBudgetKnown, false);
console.log('PASS stale plan only covers handled meal: no future zero-price recommendation invented');

const ended = { ...day, endedMeals: ['breakfast', 'lunch', 'dinner'] };
const handled = buildBudgetView(settings, ended, budgetFromPlan(makePlan([]), ended, SIMULATED_CATALOG));
assert.equal(handled.plannedTotalCents, 0);
assert.equal(handled.withinBudgetKnown, true);
console.log('PASS all meals handled: future cost is genuinely zero');

const free = buildBudgetView(settings, day, budgetFromPlan(makePlan([
  { meal: 'lunch', items: [{ priceCents: 0, quantity: 1 }] },
]), day, SIMULATED_CATALOG));
assert.equal(free.plannedTotalCents, 0);
assert.equal(free.withinBudgetKnown, true);
console.log('PASS explicit zero-price recommendation remains zero');
console.log('SUMMARY 4 cases passed; synthetic domain boundary, no UI reachability claim');

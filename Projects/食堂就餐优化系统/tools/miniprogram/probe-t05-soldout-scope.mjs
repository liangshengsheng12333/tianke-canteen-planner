// probe-t05-soldout-scope.mjs — 诊断脚本（不参与 run-t05-all 自动测试）：
// 直接对包内真实 mp_core.wasm 发送 PlanRequest，实测 T02 v2 二进制对
// state.soldOut[].windowId 的真实作用域，以及 itemLocks 的实际约束强度。
//
// 为什么需要它：automated 测试（test-t05-soldout-scope.mjs）走的是公开 store API，
// 前端 validateLocks 会先拦截一部分锁定冲突，无法单独观察核心行为；本脚本直接
// 调用核心 plan 命令，结论写入 01-实现与缺陷说明.md，避免对核心行为做假设。
//
// 边界：使用**模拟多窗口菜单（非真实菜单）**；Node 宿主真实 WASM；mock wx 只用于
// 让 AppStore 生成与产品一致的 PlanRequest。不是微信运行时、不是真机证据。
//
// 运行（项目根）：
//   node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/probe-t05-soldout-scope.mjs
import {
  createMockWx,
  createRealInstantiate,
  importTs,
  readWasmChecked,
  wasmPath,
} from './t05-test-helpers.mjs';
import { SIMULATED_MULTI_WINDOW_CATALOG, SIMULATED_MULTI_WINDOW_MENU_VERSION } from './t05-simulated-multi-window-menu.mjs';

const { AppStore } = await importTs('domain', 'store.ts');
const coreRuntime = await importTs('utils', 'core-runtime.ts');

const DATE_A = '2026-10-20';
const WINDOW_A = 'w-sim-a';
const WINDOW_B = 'w-sim-b';

const wasm = readWasmChecked();
console.log('='.repeat(78));
console.log('【模拟（非真实菜单）】T02 v2 核心 soldOut.windowId 作用域直接探针');
console.log(`WASM：${wasmPath}`);
console.log(`WASM 身份：${wasm.bytesLength} 字节 / SHA256 ${wasm.sha256}`);
console.log(`模拟菜单：${SIMULATED_MULTI_WINDOW_MENU_VERSION}（非真实菜单）`);
console.log('='.repeat(78));

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

function makeClock() {
  let current = new Date(`${DATE_A}T12:00:00+08:00`).getTime();
  return () => {
    current += 1000;
    return new Date(current);
  };
}

const mock = createMockWx();
const uninstall = mock.install();
const store = new AppStore({ instantiate: createRealInstantiate(), wasmPath, now: makeClock() });
coreRuntime.resetCore();
store.init();
store.saveProfile(profileDraft());
const preflight = await store.preflightMenu(JSON.stringify(SIMULATED_MULTI_WINDOW_CATALOG), 'simulated-multi-window.json');
if (!preflight.ok) {
  console.error('模拟菜单未通过真实核心预检：', preflight.message);
  process.exit(1);
}
store.applyMenu(preflight);
await store.refreshPlan();
const baseRequest = JSON.parse(store.getLastPlanRequest());
baseRequest.state.soldOut = [];
baseRequest.state.windowLocks = [];
baseRequest.state.itemLocks = [];

const soldOutA = { businessDate: DATE_A, windowId: WINDOW_A, meal: 'lunch', dishId: 'dish-chicken' };
const soldOutB = { businessDate: DATE_A, windowId: WINDOW_B, meal: 'lunch', dishId: 'dish-chicken' };

function callPlan(label, mutate) {
  const request = JSON.parse(JSON.stringify(baseRequest));
  mutate(request);
  const envelope = JSON.parse(coreRuntime.callCore('plan', JSON.stringify(request)));
  const status = envelope.ok === false ? `ERROR(${JSON.stringify(envelope.error)})` : envelope.result.status;
  let detail = '';
  if (envelope.ok !== false && envelope.result.plans && envelope.result.plans[0]) {
    detail = envelope.result.plans[0].meals
      .filter((meal) => meal.meal !== 'breakfast')
      .map((meal) => `${meal.meal}:${meal.windowId}:[${meal.items.map((item) => item.offerId).join(',')}]`)
      .join(' | ');
  }
  console.log(`${label}\n    状态=${status}${detail ? `\n    方案=${detail}` : ''}`);
  return envelope;
}

// 0) 基准：无售罄、无锁定。
callPlan('0 基准（无售罄无锁定）', () => {});

// 1) 只在 A 窗标记午餐鸡胸售罄；晚餐（同窗同菜）与 B 窗同菜报价都应可行。
callPlan('1 仅 A 窗午餐鸡胸售罄（期望：不波及其他窗口/其他餐次）', (request) => {
  request.state.soldOut = [soldOutA];
});

// 2) A 窗售罄 + 锁定 B 窗同菜报价：若核心按窗口作用域校验，应不是 LockConflict。
callPlan('2 A 窗售罄 + 锁定 B 窗同菜（期望：锁定有效，非 LockConflict）', (request) => {
  request.state.soldOut = [soldOutA];
  request.state.itemLocks = [{ meal: 'lunch', offerId: 'offer-chicken-b', quantity: 1 }];
});

// 3) A 窗售罄 + 锁定 A 窗同菜报价：本窗报价已售罄 → LockConflict。
callPlan('3 A 窗售罄 + 锁定 A 窗同菜（期望：LockConflict）', (request) => {
  request.state.soldOut = [soldOutA];
  request.state.itemLocks = [{ meal: 'lunch', offerId: 'offer-chicken-a', quantity: 1 }];
});

// 4) 对照：B 窗售罄 + 锁定 B 窗同菜 → LockConflict（证明校验的是报价自身窗口）。
callPlan('4 B 窗售罄 + 锁定 B 窗同菜（期望：LockConflict）', (request) => {
  request.state.soldOut = [soldOutB];
  request.state.itemLocks = [{ meal: 'lunch', offerId: 'offer-chicken-b', quantity: 1 }];
});

// 5) 售罄标记写不存在的窗口：核心静默忽略（前端必须自行校验窗口，避免脏标记）。
callPlan('5 售罄标记 windowId=w-nope（期望：核心忽略、方案不变）', (request) => {
  request.state.soldOut = [{ ...soldOutA, windowId: 'w-nope' }];
});

// 6) itemLocks 实际约束强度：T02 v2 子集只校验锁定有效性，不保证把锁定项纳入方案
//    （锁 B 窗鸡胸时可能仍给出 A 窗方案）。这里记录真实行为，测试断言不依赖“锁定必入方案”。
callPlan('6 仅锁 B 窗鸡胸（观察 T02 v2 是否强制纳入；当前子集实测不强制）', (request) => {
  request.state.itemLocks = [{ meal: 'lunch', offerId: 'offer-chicken-b', quantity: 1 }];
});

coreRuntime.resetCore();
uninstall();
console.log('\n探针完成：以上状态/方案均为真实核心返回值，结论见 01-实现与缺陷说明.md。');
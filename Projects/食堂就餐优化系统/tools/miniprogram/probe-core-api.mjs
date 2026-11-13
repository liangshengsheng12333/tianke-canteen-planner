// probe-core-api.mjs — T05 开发期探测：读取当前 T02 固定 WASM 的
// ValidateMenuCatalog / ComputeNutritionTarget 实际返回结构，供页面映射使用。
//
// 只做只读探测，不修改任何冻结输入，不重新构建或复制 WASM。
// 运行：node tools/miniprogram/probe-core-api.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const miniprogramSrc = path.join(projectRoot, 'miniprogram', 'src');
const importTs = (...segments) => import(pathToFileURL(path.join(miniprogramSrc, ...segments)).href);

const { callApi, loadCore } = await importTs('utils', 'core-bridge.ts');
const { FIXTURE_CASES } = await importTs('mock', 'simulated-inputs.ts');

const wasmPath = path.join(miniprogramSrc, 'assets', 'wasm', 'mp_core.wasm');
const nodeInstantiate = async (p, imports) => {
  const bytes = fs.readFileSync(p);
  return { instance: new WebAssembly.Instance(new WebAssembly.Module(bytes), imports) };
};

const core = await loadCore(nodeInstantiate, wasmPath);
const show = (label, text) => {
  console.log(`\n### ${label}\n${text}`);
};

const success = FIXTURE_CASES.success.request;

// 1. ValidateMenuCatalog：合法菜单
show('validate-menu 合法菜单', callApi(core, 'validate-menu', JSON.stringify({
  contractVersion: '1.0',
  catalog: success.catalog,
})));

// 2. ValidateMenuCatalog：结构错误（缺 dishes、未知枚举、负价格）
const badCatalog = structuredClone(success.catalog);
badCatalog.dishes[0].category = 'unknown-category';
badCatalog.offers[0].priceCents = -1;
badCatalog.menuVersion = '';
show('validate-menu 非法菜单', callApi(core, 'validate-menu', JSON.stringify({
  contractVersion: '1.0',
  catalog: badCatalog,
})));

// 3. ComputeNutritionTarget：自动目标可用档案
show('nutrition-target 自动目标', callApi(core, 'nutrition-target', JSON.stringify({
  contractVersion: '1.0',
  requestId: 'probe-target-auto',
  profile: success.profile,
  nutritionConfig: success.nutritionConfig,
})));

// 4. ComputeNutritionTarget：manual 目标不完整
const manualProfile = structuredClone(success.profile);
manualProfile.goal = {
  type: 'manual',
  manualTargets: {
    energyKcal: 2000,
    proteinDg: null,
    fatDg: null,
    carbDg: null,
    sourceType: 'userEntered',
    sourceNote: null,
    derivedFields: [],
  },
};
show('nutrition-target manual 不完整', callApi(core, 'nutrition-target', JSON.stringify({
  contractVersion: '1.0',
  requestId: 'probe-target-manual',
  profile: manualProfile,
  nutritionConfig: success.nutritionConfig,
})));

// 5. PlanDay：带 1 条 active 记录与锁定/售罄，观察回传结构
const stateReq = structuredClone(success);
stateReq.requestId = 'probe-plan-state';
stateReq.plannerConfig.budgetCents = 3000;
stateReq.planningMeals = ['breakfast', 'lunch'];
stateReq.state.soldOut = [{ businessDate: '2026-10-20', windowId: 'w-main', meal: 'lunch', dishId: 'dish-chicken' }];
stateReq.state.windowLocks = [{ meal: 'breakfast', windowId: 'w-main' }];
stateReq.state.itemLocks = [{ meal: 'lunch', offerId: 'offer-rice-full', quantity: 1 }];
stateReq.state.activeLogs = [{
  contractVersion: '1.0',
  recordId: 'rec-probe-1',
  confirmationId: 'conf-probe-1',
  businessDate: '2026-10-20',
  tzOffsetMinutes: 480,
  meal: 'breakfast',
  status: 'active',
  revision: 1,
  supersedesRecordId: null,
  revokedByRecordId: null,
  createdAt: '2026-10-20T00:10:00.000Z',
  updatedAt: '2026-10-20T00:10:00.000Z',
  menuVersion: success.catalog.menuVersion,
  items: [{
    itemKey: 'item-1',
    source: 'menuOffer',
    offerId: 'offer-mantou',
    dishId: 'dish-mantou',
    menuVersion: success.catalog.menuVersion,
    nameSnapshot: '馒头',
    portionCode: 'full',
    quantity: 1,
    unitPriceCents: 100,
    priceKnown: true,
    nutrition: { energyKcal: 220, proteinDg: 70, fatDg: 10, carbDg: 470 },
    nutritionBasis: 'simulated-reference',
    note: null,
  }],
}];
show('plan 带状态与 active 记录', callApi(core, 'plan', JSON.stringify(stateReq)));

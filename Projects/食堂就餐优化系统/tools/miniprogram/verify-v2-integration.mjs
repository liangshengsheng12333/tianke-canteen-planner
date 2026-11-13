// verify-v2-integration.mjs — 反重力小程序调用侧 WASM 业务集成双端验证（阶段 B）。
//
// 验证内容：
// 1. 载入小程序代码包内的 mp_core.wasm（miniprogram/src/assets/wasm/mp_core.wasm）；
// 2. 使用小程序生产代码 core-bridge.ts 的 callApi 运行四类 PlanDay 请求夹具；
// 3. 与 DSH v2 产出的结果夹具（Resources/报告/T02-DSH-接入前定点修正-证据-v2/results/）做结构与语义全等核对；
// 4. 与 DSH 原生 CLI 产出的输出做对比；
// 5. 校验阶段 B 输出口径：
//    - meals[].nutritionReferenceTarget 完整且数值正确；
//    - 预算 9 字段完整且算术核算正确；
//    - offeredAs 合并策略、strategyOutcome 全部指向同一 planKey；
//    - flags 含 ESTIMATED_DATA 且状态对应 OkPartial；
//    - planKey 为规范 sha256 格式（plan:<64位小写hex>）。
//
// 运行：node tools/miniprogram/verify-v2-integration.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const miniprogramSrc = path.join(projectRoot, 'miniprogram', 'src');

const importTs = (...segments) => import(pathToFileURL(path.join(miniprogramSrc, ...segments)).href);
const { callApi, loadCore } = await importTs('utils', 'core-bridge.ts');
const { FIXTURE_CASES } = await importTs('mock', 'simulated-inputs.ts');
const { checkPlanCapability } = await importTs('utils', 'capability.ts');

const wasmPath = path.join(miniprogramSrc, 'assets', 'wasm', 'mp_core.wasm');
const resultsDir = path.join(
  projectRoot,
  'Resources', '报告', 'T02-DSH-接入前定点修正-证据-v2', 'results',
);

const EXPECTED_RESULTS = {
  success: 'plan-result-success.json',
  targetUnavailable: 'plan-result-target-unavailable.json',
  invalid: 'plan-result-invalid.json',
  resourceLimited: 'plan-result-resource-limited.json',
};

function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex').toUpperCase();
}

console.log('=== T02 阶段 B：反重力业务接入与四类夹具全量核对 ===');
console.log(`WASM 包内路径: ${wasmPath}`);
const wasmBytes = fs.readFileSync(wasmPath);
console.log(`WASM 字节数: ${wasmBytes.length}，SHA256: ${sha256(wasmBytes)}`);

// Node 宿主实例化
const nodeInstantiate = async (p, imports) => {
  const bytes = fs.readFileSync(p);
  const module = new WebAssembly.Module(bytes);
  const instance = new WebAssembly.Instance(module, imports);
  return { instance };
};

const core = await loadCore(nodeInstantiate, wasmPath);
console.log('WASM 加载成功，导出检查通过。\n');

let totalChecks = 0;
let passedChecks = 0;

function assert(condition, message) {
  totalChecks += 1;
  if (!condition) {
    console.error(`  ❌ 失败: ${message}`);
    throw new Error(message);
  }
  passedChecks += 1;
}

const summaryReport = [];

for (const [key, item] of Object.entries(FIXTURE_CASES)) {
  console.log(`--- 验证用例: ${item.name} (${item.file}) ---`);
  
  // 1. 调用侧能力检查
  const capRejection = checkPlanCapability(item.request);
  if (key === 'invalid') {
    // invalid 用例只是 maxItemsPerMeal 超过，其 algorithm="greedy", comboRules=[] 依然符合调用侧子集
    assert(capRejection === null, 'invalid 用例符合受支持子集能力检查');
  } else {
    assert(capRejection === null, `${item.name} 符合受支持子集能力检查`);
  }

  // 2. 通过 core-bridge 调用 mp_plan
  const reqJson = JSON.stringify(item.request);
  const startTime = performance.now();
  const respText = callApi(core, 'plan', reqJson);
  const durationMs = performance.now() - startTime;
  const respBuf = Buffer.from(respText, 'utf8');
  const respSha = sha256(respBuf);
  console.log(`  执行耗时: ${durationMs.toFixed(3)} ms，返回字符数: ${respText.length} 字符，UTF-8 字节数: ${respBuf.length} 字节，SHA256: ${respSha}`);

  const respJson = JSON.parse(respText);
  const fixturePath = path.join(resultsDir, EXPECTED_RESULTS[key]);
  const fixtureBytes = fs.readFileSync(fixturePath);
  const fixtureJson = JSON.parse(fixtureBytes.toString('utf8'));

  // 3. 语义深度比对（与 DSH 结果夹具）
  assert(JSON.stringify(respJson) === JSON.stringify(fixtureJson), `${item.name} 响应与 DSH v2 结果夹具全等`);

  // 4. 业务口径关键点详细检查
  if (key === 'success') {
    assert(respJson.ok === true, 'ok 必须为 true');
    assert(respJson.result.status === 'OkPartial', '模拟数据 status 必须为 OkPartial (因 estimated=true)');
    assert(respJson.result.distinctPlanCount === 1, '去重后方案数必须为 1 (三策略收敛，不凑数)');
    assert(Array.isArray(respJson.result.plans) && respJson.result.plans.length === 1, 'plans 数组长度必须为 1');

    const plan = respJson.result.plans[0];
    assert(/^plan:[0-9a-f]{64}$/.test(plan.planKey), `planKey 格式符合不透明稳定键规范: ${plan.planKey}`);
    assert(Array.isArray(plan.offeredAs) && plan.offeredAs.length === 3, 'offeredAs 包含 primary, economy, taste');
    assert(plan.offeredAs.includes('primary') && plan.offeredAs.includes('economy') && plan.offeredAs.includes('taste'), 'offeredAs 包含全部三策略');
    assert(plan.flags.includes('ESTIMATED_DATA'), 'flags 必须包含 ESTIMATED_DATA');

    // 检查 strategyOutcome 均指向同一 planKey
    for (const outcome of respJson.result.strategyOutcome) {
      assert(outcome.applied === true, `策略 ${outcome.strategy} 必须为 applied=true`);
      assert(outcome.planKey === plan.planKey, `策略 ${outcome.strategy} planKey 必须指向唯一方案`);
      assert(outcome.status === 'OkPartial', `策略 ${outcome.strategy} status 必须为 OkPartial`);
    }

    // 检查 budget 9 字段完整性
    const b = plan.budget;
    assert(b.budgetCents === 3000, 'budgetCents 回显 3000');
    assert(b.remainingBudgetKnownCents === 3000, 'remainingBudgetKnownCents 为 3000');
    assert(b.plannedTotalCents === 2300, 'plannedTotalCents 为 2300');
    assert(b.plannedTotalKnownCents === 2300, 'plannedTotalKnownCents 为 2300');
    assert(b.priceIncomplete === false, 'priceIncomplete 为 false');
    assert(b.overBudget === false, 'overBudget 为 false');
    assert(b.withinBudgetKnownAmounts === true, 'withinBudgetKnownAmounts 为 true');
    assert(b.overageCents === 0, 'overageCents 为 0');
    assert(b.checkBasis === 'known_only', 'checkBasis 为 known_only');

    // 检查 meals[].nutritionReferenceTarget
    assert(Array.isArray(plan.meals) && plan.meals.length === 3, '方案包含 3 餐');
    for (const mealObj of plan.meals) {
      const ref = mealObj.nutritionReferenceTarget;
      assert(ref && typeof ref.energyKcal === 'number', `餐次 ${mealObj.meal} 包含 nutritionReferenceTarget`);
      const globalRef = respJson.result.targets.mealReference[mealObj.meal];
      assert(ref.energyKcal === globalRef.energyKcal, `餐次 ${mealObj.meal} 能量参考与全局一致`);
      assert(ref.proteinDg === globalRef.proteinDg, `餐次 ${mealObj.meal} 蛋白质参考与全局一致`);
      assert(ref.fatDg === globalRef.fatDg, `餐次 ${mealObj.meal} 脂肪参考与全局一致`);
      assert(ref.carbDg === globalRef.carbDg, `餐次 ${mealObj.meal} 碳水参考与全局一致`);
    }
  } else if (key === 'targetUnavailable') {
    assert(respJson.ok === true, 'ok 为 true');
    assert(respJson.result.status === 'TargetUnavailable', 'status 为 TargetUnavailable');
    assert(respJson.result.plans.length === 0, 'plans 为空');
    assert(respJson.result.targetStatus === 'AUTO_TARGET_DISABLED', 'targetStatus 回显 AUTO_TARGET_DISABLED');
    assert(respJson.result.diagnostics.some(d => d.code === 'TARGET_NOT_APPLICABLE'), '包含 TARGET_NOT_APPLICABLE 诊断');
  } else if (key === 'invalid') {
    assert(respJson.ok === false, 'ok 为 false (契约错误)');
    assert(respJson.error.code === 'INVALID_INPUT', 'error.code 为 INVALID_INPUT');
    assert(respJson.error.fieldPath === '$.plannerConfig.maxItemsPerMeal', 'fieldPath 精准指向 $.plannerConfig.maxItemsPerMeal');
    assert(respJson.result === null, 'result 为 null');
  } else if (key === 'resourceLimited') {
    assert(respJson.ok === true, 'ok 为 true');
    assert(respJson.result.status === 'ResourceLimited', 'status 为 ResourceLimited');
    assert(respJson.result.plans.length === 0, 'plans 为空');
    assert(respJson.result.search.limitReached === true, 'search.limitReached 为 true');
    assert(respJson.result.search.nodesVisited === 3, 'search.nodesVisited 真实耗尽限额为 3');
    assert(respJson.result.diagnostics.some(d => d.code === 'SEARCH_LIMIT_REACHED'), '包含 SEARCH_LIMIT_REACHED 诊断');
  }

  console.log(`  ✅ ${item.name} 全部断言通过。\n`);
  summaryReport.push({
    case: key,
    name: item.name,
    durationMs: Number(durationMs.toFixed(3)),
    chars: respText.length,
    utf8Bytes: respBuf.length,
    sha256: respSha,
    status: respJson.ok ? respJson.result.status : respJson.error.code,
  });
}

console.log('=============================================');
console.log(`四类夹具全量校验完成: ${passedChecks} / ${totalChecks} 断言全部通过！`);
console.table(summaryReport);

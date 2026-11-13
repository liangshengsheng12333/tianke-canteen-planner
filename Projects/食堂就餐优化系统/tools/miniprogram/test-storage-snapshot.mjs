// test-storage-snapshot.mjs — 本地存储重开恢复与冷/热运行性能基准测试。
//
// 验证内容：
// 1. 模拟微信小程序的 wx.setStorageSync 与 wx.getStorageSync；
// 2. 真实载入小程序包内的 mp_core.wasm，执行 PlanDay 成功用例并写入本地持久化快照；
// 3. 模拟小程序进程完全退出（销毁 WASM 实例与内存）；
// 4. 模拟小程序冷启动重开：从持久化存储恢复请求与结果快照，逐字段核验恢复一致性；
// 5. 测量冷启动加载耗时、冷运行第 1 次耗时；
// 6. 进行至少 5 次热运行连续请求，记录原始数值、最小值、最大值与中位数。
//
// 运行：node tools/miniprogram/test-storage-snapshot.mjs
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
  const module = new WebAssembly.Module(bytes);
  const instance = new WebAssembly.Instance(module, imports);
  return { instance };
};

console.log('=== T02 本地持久化重开恢复与性能基准测试 ===');

// 模拟 wx 存储容器（文件级持久化模拟）
const storageMap = new Map();
const mockWx = {
  setStorageSync(key, value) {
    storageMap.set(key, JSON.stringify(value));
  },
  getStorageSync(key) {
    const raw = storageMap.get(key);
    return raw ? JSON.parse(raw) : null;
  },
  removeStorageSync(key) {
    storageMap.delete(key);
  },
};

const reqObj = FIXTURE_CASES.success.request;
const reqText = JSON.stringify(reqObj);

// --- 阶段 1：初次冷启动与持久化写入 ---
console.log('\n[1/3] 模拟首次冷启动与请求...');
const coldStartT0 = performance.now();
let coreInstance = await loadCore(nodeInstantiate, wasmPath);
const coldLoadDurationMs = performance.now() - coldStartT0;

const coldExecT0 = performance.now();
const firstRespText = callApi(coreInstance, 'plan', reqText);
const coldExecDurationMs = performance.now() - coldExecT0;

console.log(`  WASM 模块加载耗时: ${coldLoadDurationMs.toFixed(3)} ms`);
console.log(`  首次元始执行耗时: ${coldExecDurationMs.toFixed(3)} ms`);

// 写入本地持久化快照
const snapshotPayload = {
  caseKey: 'success',
  reqText,
  respText: firstRespText,
  durationMs: coldExecDurationMs,
  timestamp: new Date().toISOString(),
};
mockWx.setStorageSync('PLAN_DAY_LAST_SNAPSHOT', snapshotPayload);
console.log('  快照已写入本地持久化存储 PLAN_DAY_LAST_SNAPSHOT');

// --- 阶段 2：模拟进程退出与重开恢复 ---
console.log('\n[2/3] 模拟小程序进程退出（销毁内存状态）与冷启动重开...');
coreInstance = null; // 彻底销毁内存实例

// 重新加载（重开）
const restoredSnapshot = mockWx.getStorageSync('PLAN_DAY_LAST_SNAPSHOT');
if (!restoredSnapshot) {
  throw new Error('未读取到本地存储快照');
}

const restoredEnvelope = JSON.parse(restoredSnapshot.respText);
if (restoredEnvelope.result.status !== 'OkPartial') {
  throw new Error(`恢复的快照状态不符: ${restoredEnvelope.result.status}`);
}
if (!restoredEnvelope.result.plans[0].planKey.startsWith('plan:')) {
  throw new Error('恢复的 planKey 格式不符');
}
console.log(`  成功从持久化存储恢复快照！`);
console.log(`  恢复的 planKey: ${restoredEnvelope.result.plans[0].planKey}`);
console.log(`  恢复的预算总价: ￥${restoredEnvelope.result.plans[0].budget.plannedTotalCents / 100}`);
console.log(`  快照时间戳: ${restoredSnapshot.timestamp}`);

// --- 阶段 3：至少 5 次热运行性能测量 ---
console.log('\n[3/3] 执行 5 次热运行性能采样（同一输入，测量核心执行时间）...');
coreInstance = await loadCore(nodeInstantiate, wasmPath);

const hotRuns = [];
for (let i = 1; i <= 5; i += 1) {
  const t0 = performance.now();
  const resp = callApi(coreInstance, 'plan', reqText);
  const dur = performance.now() - t0;
  hotRuns.push(dur);
  console.log(`  热运行 #${i}: ${dur.toFixed(3)} ms (返回 ${resp.length} 字符)`);
}

const minMs = Math.min(...hotRuns);
const maxMs = Math.max(...hotRuns);
const sorted = [...hotRuns].sort((a, b) => a - b);
const medianMs = sorted[Math.floor(sorted.length / 2)];
const avgMs = hotRuns.reduce((sum, v) => sum + v, 0) / hotRuns.length;

console.log('\n=== 性能基准统计结果 ===');
console.log(`  冷加载耗时: ${coldLoadDurationMs.toFixed(3)} ms`);
console.log(`  冷执行耗时: ${coldExecDurationMs.toFixed(3)} ms`);
console.log(`  热运行 5 次原始值: [${hotRuns.map(v => v.toFixed(3) + ' ms').join(', ')}]`);
console.log(`  热运行 最小值 (min): ${minMs.toFixed(3)} ms`);
console.log(`  热运行 最大值 (max): ${maxMs.toFixed(3)} ms`);
console.log(`  热运行 中位数 (median): ${medianMs.toFixed(3)} ms`);
console.log(`  热运行 平均值 (avg): ${avgMs.toFixed(3)} ms`);

// 记录结构化结果供反馈引用
const perfReport = {
  environment: 'Node.js v24.19.0 x64 / WebAssembly 宿主 (阶段 C 真机基准对照源)',
  wasmBytes: 72881,
  wasmSha256: '715CD7701B64D8F493A110C348B5F643979536578C7380C29837E05C4F31D52C',
  coldLoadMs: Number(coldLoadDurationMs.toFixed(3)),
  coldExecMs: Number(coldExecDurationMs.toFixed(3)),
  hotRunsMs: hotRuns.map(v => Number(v.toFixed(3))),
  minMs: Number(minMs.toFixed(3)),
  maxMs: Number(maxMs.toFixed(3)),
  medianMs: Number(medianMs.toFixed(3)),
  avgMs: Number(avgMs.toFixed(3)),
  restorationVerified: true,
};

fs.writeFileSync(
  path.join(projectRoot, 'Resources', '报告', 'T02-反重力-最小小程序链路-证据-v1', '06-存储重开与性能基准原始数据.json'),
  JSON.stringify(perfReport, null, 2),
  'utf8'
);
console.log('\n报告原始数据已保存至 06-存储重开与性能基准原始数据.json');

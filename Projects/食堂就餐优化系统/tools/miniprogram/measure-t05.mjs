// measure-t05.mjs — T05 四口径计时（Node 宿主，真实包内 mp_core.wasm）。
//
// 口径定义（与报告措辞一致，勿混用）：
//   1) 冷启动/首次加载 coldStartLoad：新建 AppStore（读本地状态）+ init() + ensureCoreLoaded()
//      （读取 WASM 文件字节 → WebAssembly.Module 编译 → Instance 实例化 → 导出核对）。
//   2) WASM 核心-only wasmCoreOnly：预分配输入后只对 exports.mp_plan 调用计时
//      （不含 JS 编解码、结果复制、释放；这些在计时窗口外完成）。
//   3) 桥接+复制/释放 bridgeCopyRelease：core-bridge.callApi 全流程
//      （UTF-8 编码输入 → mp_alloc/写入 → mp_plan → 结果块复制+解码 → 两次 mp_free）。
//   4) 页面端到端 pageEndToEndHot：store.refreshPlan() 全流程（能力门/构建请求/桥接调用/解析/
//      事务写入 mock 存储），核心已热加载；另附 pageEndToEndCold（含冷启动与首次方案）。
//
// 每组同一输入跑 5 次热运行（热组先预热 1 次且不计入），保留原始毫秒数组与 median/min/max/mean。
// 证据边界：这是 Node.js 宿主 + Node WebAssembly 的数据，不是微信运行时、不是红米真机；
// 不能用于宣称真机冷启动或性能门槛达标（门槛未冻结）。
//
// 运行（项目根）：
//   node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/measure-t05.mjs
// 结果：JSON 写 D:\项目\cpp\.toolchain\tmp\t05\，同时把完整 JSON 打印到 stdout。
import { performance } from 'node:perf_hooks';
import {
  createMockWx,
  createRealInstantiate,
  environmentInfo,
  importTs,
  loadFixtures,
  readWasmChecked,
  summarize,
  wasmPath,
  WASM_EXPECTED_BYTES,
  WASM_EXPECTED_SHA256,
  writeEvidenceJson,
} from './t05-test-helpers.mjs';

const { AppStore } = await importTs('domain', 'store.ts');
const { callApi, utf8Encode } = await importTs('utils', 'core-bridge.ts');
const coreRuntime = await importTs('utils', 'core-runtime.ts');
const FIXTURE_CASES = await loadFixtures();

const HOT_RUNS = 15; // 要求 ≥5；15 次用于压低亚毫秒计时噪声
const COLD_RUNS = 10; // 冷启动组每次都要新建存储/核心，取 10 次
const COLD_WARMUP_RUNS = 1;
const DATE = '2026-10-20';

function makeClock(iso = `${DATE}T12:00:00+08:00`) {
  let current = new Date(iso).getTime();
  return () => {
    current += 1000;
    return new Date(current);
  };
}

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

function nowMs() {
  return performance.now();
}

// ---------------------------------------------------------------------------
// 身份与环境
// ---------------------------------------------------------------------------

const scriptStartedAt = new Date().toISOString();
const wasm = readWasmChecked();
const environment = environmentInfo();
const requestText = JSON.stringify(FIXTURE_CASES.success.request);
const requestBytes = utf8Encode(requestText);

// ---------------------------------------------------------------------------
// 口径 3 用的桥接结果（也作为口径 2 的响应校验基准）
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 口径 1：冷启动/首次加载（每次全新的存储 + 核心单例）
// ---------------------------------------------------------------------------

const coldStartSamples = [];
const coldStartDetail = [];
for (let run = 0; run < COLD_RUNS + 1; run += 1) {
  const mock = createMockWx();
  const uninstall = mock.install();
  const store = new AppStore({ instantiate: createRealInstantiate(), wasmPath, now: makeClock() });
  coreRuntime.resetCore();
  const t0 = nowMs();
  const initResult = store.init();
  const coreResult = await store.ensureCoreLoaded();
  const elapsed = nowMs() - t0;
  if (!initResult.ok) {
    throw new Error(`冷启动口径：init 失败：${initResult.message}`);
  }
  if (!coreResult.ok) {
    throw new Error(`冷启动口径：WASM 加载失败：${coreResult.message}`);
  }
  // 校验核心真的加载的是包内冻结 WASM（另取 dev 视图的哈希常量，避免只是“能跑”）。
  const dev = store.getDevView();
  if (dev.expectedWasmSha256 !== wasm.sha256 || dev.expectedWasmBytes !== wasm.bytesLength) {
    throw new Error('冷启动口径：store 暴露的 WASM 身份与包内文件不一致');
  }
  if (run >= COLD_WARMUP_RUNS) {
    coldStartSamples.push(elapsed);
    coldStartDetail.push({
      initMessage: initResult.message,
      coreMessage: coreResult.message,
      initOk: initResult.ok,
    });
  }
  coreRuntime.resetCore();
  uninstall();
}

// ---------------------------------------------------------------------------
// 加载一次核心，供口径 2 / 3 使用
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 加载一次核心，供口径 2 / 3 使用
// ---------------------------------------------------------------------------

const { loadCore } = await importTs('utils', 'core-bridge.ts');
coreRuntime.resetCore();
const core = await loadCore(createRealInstantiate(), wasmPath);

// 口径 3 基准：桥接调用（先跑一次作为预热 + 结果校验）
const bridgeWarmupText = callApi(core, 'plan', requestText);
const bridgeWarmup = JSON.parse(bridgeWarmupText);
if (bridgeWarmup.ok !== true || bridgeWarmup.result.status !== 'OkPartial') {
  throw new Error(`桥接口径预热返回不符：${bridgeWarmupText.slice(0, 200)}`);
}
const responseChars = bridgeWarmupText.length;
const responseBytes = Buffer.byteLength(bridgeWarmupText, 'utf8');

// ---------------------------------------------------------------------------
// 口径 2：WASM 核心-only（只对 mp_plan 入口计时）
// ---------------------------------------------------------------------------

const exports = core.exports;
const inputPtr = exports.mp_alloc(requestBytes.length);
if (inputPtr === 0) {
  throw new Error('WASM 核心-only 口径：mp_alloc 返回 0');
}
new Uint8Array(exports.memory.buffer, inputPtr, requestBytes.length).set(requestBytes);

/** 在计时窗口外解码结果块长度并释放，返回 [长度, 原始文本]。 */
function readAndFreeBlock(block) {
  const buffer = exports.memory.buffer;
  const view = new DataView(buffer);
  const payloadLength = view.getUint32(block, true);
  const bytes = new Uint8Array(buffer, block + 8, payloadLength);
  const text = Buffer.from(bytes).toString('utf8');
  exports.mp_free(block);
  return { payloadLength, text };
}

// 预热一次并校验原始入口返回与桥接结果一致。
const warmBlock = exports.mp_plan(inputPtr, requestBytes.length);
const warm = readAndFreeBlock(warmBlock);
const warmEnvelope = JSON.parse(warm.text);
if (warmEnvelope.ok !== true || warmEnvelope.result.status !== 'OkPartial') {
  throw new Error(`WASM 核心-only 预热返回不符：${warm.text.slice(0, 200)}`);
}
if (warm.text !== bridgeWarmupText) {
  throw new Error('WASM 核心-only 与桥接调用返回文本不一致，不能用于同一口径对比');
}

const coreOnlySamples = [];
const bridgeSamples = [];
const pairedDeltas = [];
// 交替测量核心-only 与桥接，避免“先测的一组吃 V8 预热/GC 抖动”造成系统性偏差。
for (let run = 0; run < HOT_RUNS; run += 1) {
  const coreStart = nowMs();
  const block = exports.mp_plan(inputPtr, requestBytes.length);
  const coreElapsed = nowMs() - coreStart;
  coreOnlySamples.push(coreElapsed);
  readAndFreeBlock(block); // 复制+释放放在计时窗口外，只保留“核心计算”时间

  const bridgeStart = nowMs();
  const bridgeText = callApi(core, 'plan', requestText);
  const bridgeElapsed = nowMs() - bridgeStart;
  bridgeSamples.push(bridgeElapsed);
  if (bridgeText.length !== responseChars) {
    throw new Error('桥接口径：每次返回文本长度应一致');
  }
  pairedDeltas.push(bridgeElapsed - coreElapsed);
}
exports.mp_free(inputPtr);

// ---------------------------------------------------------------------------
// 口径 4：页面端到端（store.refreshPlan 热运行；另附冷到首方案）
// ---------------------------------------------------------------------------

const pageMock = createMockWx();
const pageUninstall = pageMock.install();
const pageStore = new AppStore({ instantiate: createRealInstantiate(), wasmPath, now: makeClock() });
coreRuntime.resetCore();
const pageInit = pageStore.init();
const pageProfile = pageStore.saveProfile(profileDraft());
const pageCore = await pageStore.ensureCoreLoaded();
if (!pageInit.ok || !pageProfile.ok || !pageCore.ok) {
  throw new Error(`页面端到端口径准备失败：init=${pageInit.message} profile=${pageProfile.message} core=${pageCore.message}`);
}
const pageWarmupOutcome = await pageStore.refreshPlan();
if (!pageWarmupOutcome.ok || pageWarmupOutcome.status !== 'OkPartial') {
  throw new Error(`页面端到端口径预热 refreshPlan 失败：${pageWarmupOutcome.message}`);
}
const pageHotSamples = [];
for (let run = 0; run < HOT_RUNS; run += 1) {
  const t0 = nowMs();
  const outcome = await pageStore.refreshPlan();
  const elapsed = nowMs() - t0;
  if (!outcome.ok || outcome.status !== 'OkPartial') {
    throw new Error(`页面端到端口径第 ${run + 1} 次 refreshPlan 失败：${outcome.message}`);
  }
  pageHotSamples.push(elapsed);
}
const pageStateBytes = pageMock.raw('tiankeshike:state:v1').length;
pageUninstall();
coreRuntime.resetCore();

// 补充口径：冷到首方案（新存储→init→建档→核心加载→首次 refreshPlan 全流程）。
const pageColdSamples = [];
for (let run = 0; run < COLD_RUNS; run += 1) {
  const mock = createMockWx();
  const uninstall = mock.install();
  const store = new AppStore({ instantiate: createRealInstantiate(), wasmPath, now: makeClock() });
  coreRuntime.resetCore();
  const t0 = nowMs();
  const initResult = store.init();
  const saved = store.saveProfile(profileDraft());
  const loaded = await store.ensureCoreLoaded();
  const outcome = await store.refreshPlan();
  const elapsed = nowMs() - t0;
  if (!initResult.ok || !saved.ok || !loaded.ok || !outcome.ok) {
    throw new Error(`冷到首方案口径失败：init=${initResult.message} profile=${saved.message} core=${loaded.message} plan=${outcome.message}`);
  }
  pageColdSamples.push(elapsed);
  coreRuntime.resetCore();
  uninstall();
}

// ---------------------------------------------------------------------------
// 汇总输出
// ---------------------------------------------------------------------------

const definitions = {
  coldStartLoad: '新建 AppStore + init()（读本地状态）+ ensureCoreLoaded()（读 WASM 字节→编译 Module→实例化→导出核对）',
  wasmCoreOnly: '预分配输入后仅 exports.mp_plan(inputPtr, len) 调用耗时；结果块复制/解码与 mp_free 在计时窗口外',
  bridgeCopyRelease: 'core-bridge.callApi：UTF-8 编码 + mp_alloc/写入 + mp_plan + 结果块复制解码 + 输入/结果两次 mp_free',
  pageEndToEndHot: 'store.refreshPlan() 全流程（能力门 + PlanRequest 构建 + callApi + JSON 解析 + 事务写入 mock 存储），核心已热加载',
  pageEndToEndCold: '补充口径：新存储 → init → saveProfile → ensureCoreLoaded → 首次 refreshPlan 全流程（含冷启动与首方案）',
};

const report = {
  tool: 'measure-t05.mjs',
  task: 'T05 天科食客页面与本地数据',
  scope: 'Node.js 宿主（Node WebAssembly），非微信运行时、非红米真机',
  disclaimer:
    '本文件是 Node 宿主数据，仅用于与真机/开发者工具分项对照；不得作为微信冷启动、真机性能或任何未冻结门槛达标的证据。',
  environment,
  wasm: {
    path: wasmPath,
    bytes: wasm.bytesLength,
    sha256: wasm.sha256,
    expectedBytes: WASM_EXPECTED_BYTES,
    expectedSha256: WASM_EXPECTED_SHA256,
    identityMatched: wasm.bytesLength === WASM_EXPECTED_BYTES && wasm.sha256 === WASM_EXPECTED_SHA256,
  },
  input: {
    fixture: 'success (T02 v2 plan-request-success.json)',
    note: '模拟菜单（SIMULATED），非真实菜单/营养验收数据',
    requestChars: requestText.length,
    requestUtf8Bytes: requestBytes.length,
    responseChars,
    responseUtf8Bytes: responseBytes,
    responseStatus: warmEnvelope.result.status,
    planKey: warmEnvelope.result.plans[0].planKey,
  },
  methodology: {
    hotRuns: HOT_RUNS,
    warmupRuns: { coldStartLoad: COLD_WARMUP_RUNS, wasmCoreOnly: 1, bridgeCopyRelease: 1, pageEndToEndHot: 1 },
    coldStartRuns: COLD_RUNS,
    measurementOrder:
      'WASM 核心-only 与桥接交替测量（同一迭代内先 core-only 后 bridge），冷启动与页面口径各自独立新建实例；热组预热不计入样本',
    timer: 'node:perf_hooks performance.now()',
    samplesNote: '原始毫秒数组为完整精度；统计值四舍五入到 3 位小数；偶数样本 median 取中间两值平均',
  },
  results: {
    coldStartLoad: { definition: definitions.coldStartLoad, ...summarize(coldStartSamples), detail: coldStartDetail },
    wasmCoreOnly: { definition: definitions.wasmCoreOnly, ...summarize(coreOnlySamples) },
    bridgeCopyRelease: { definition: definitions.bridgeCopyRelease, ...summarize(bridgeSamples) },
    pageEndToEndHot: { definition: definitions.pageEndToEndHot, ...summarize(pageHotSamples), storageStateBytes: pageStateBytes },
    pageEndToEndCold: { definition: definitions.pageEndToEndCold, ...summarize(pageColdSamples) },
  },
  comparisons: {
    bridgeMinusCoreMedianMs: Number((summarize(bridgeSamples).median - summarize(coreOnlySamples).median).toFixed(3)),
    pairedDeltaBridgeMinusCore: summarize(pairedDeltas),
    bridgeOverheadNote:
      '桥接层（UTF-8 编解码 + 输入/结果块复制 + 显式释放）开销用同一迭代的 bridge − core-only 配对差衡量；亚毫秒级噪声下以配对差中位数为准，绝对组间中位数差仅供参考',
  },
  limitations: [
    'Node/V8 对同一份 WASM 字节码有内部编译缓存，本口径每次迭代重新读文件并重新编译，但无法清除 V8 缓存；冷启动数值是 Node 宿主下界估计。',
    'mock wx 用 Map + JSON 字符串模拟持久化，写入耗时不代表微信真机存储耗时。',
    '各口径在同一 Node 进程内顺序测量，单次耗时在亚毫秒级，受 V8 JIT/GC/CPU 频率与测量顺序影响；组间中位数排序不能当作严格因果结论，桥接层开销以同迭代配对差为准。',
    '页面端到端不包含真实 setData/WXML 渲染；页面渲染需开发者工具/真机另测。',
    '未测项：红米 K90 Pro Max 冷启动/首次加载、真机 WXWebAssembly 加载、手机杀进程重开、断网离线读取。',
  ],
  timestamp: new Date().toISOString(),
  startedAt: scriptStartedAt,
};

const evidencePath = writeEvidenceJson(`measure-t05-${report.timestamp.replace(/[:.]/g, '-')}.json`, report);
console.error(`证据 JSON 已写入：${evidencePath}`);
// stdout 只打印完整 JSON，便于重定向/后续处理。
console.log(JSON.stringify(report, null, 2));

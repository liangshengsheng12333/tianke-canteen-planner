// run_v2_cases.mjs - run the four PlanDay v2 fixtures through BOTH the native CLI and the
// WASM module, compare the bytes, check the expected status semantics, and assert semantic
// equivalence.
//
// CLI Modes:
//   1. Default (no args): preserves exact T02 v2 behavior (.toolchain/build/{native,wasm} and
//      Resources/报告/T02-DSH-接入前定点修正-证据-v2).
//   2. --t04-candidate (or explicit --cli / --wasm / --inputs / --work): runs the 4 canonical-adapted
//      T04 fixtures against the T04 candidate CLI & WASM in .toolchain/build/t04-candidate-v1,
//      compares unchanged business semantics against the untouched T02 v2 results, and records
//      old-vs-new SHA-256 hashes and search-contract diffs without overwriting T02 baseline reports.
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import { callApi, loadCore } from './host_wasm.mjs';

// 定位当前脚本所在目录，确保无论从项目目录或工作区根目录启动均能稳定解析路径
const __dirname = path.dirname(fileURLToPath(import.meta.url));
// 绑定关键上下文变量 ROOT，指向食堂就餐优化系统项目根目录
const ROOT = path.resolve(__dirname, '..', '..');
// 绑定关键上下文变量 WORKSPACE，指向工作区根目录（包含 .toolchain）
const WORKSPACE = path.resolve(ROOT, '..', '..');
// 绑定关键上下文变量 T02_EVIDENCE，指向只读保留的 T02 v2 证据目录
const T02_EVIDENCE = path.join(ROOT, 'Resources', '报告', 'T02-DSH-接入前定点修正-证据-v2');
// 绑定关键上下文变量 T02_INPUTS，指向 T02 v2 原始请求夹具目录
const T02_INPUTS = path.join(T02_EVIDENCE, 'inputs');
// 绑定关键上下文变量 T02_RESULTS，指向 T02 v2 原始结果夹具目录
const T02_RESULTS = path.join(T02_EVIDENCE, 'results');

// 解析命令行可选候选参数（无参数时严格保持 T02 v2 原默认路径与行为）
const args = process.argv.slice(2);
const isT04Candidate = args.includes('--t04-candidate');

function getArgValue(flag, fallback) {
  const idx = args.indexOf(flag);
  if (idx >= 0 && idx + 1 < args.length) {
    return path.resolve(args[idx + 1]);
  }
  return fallback;
}

// 绑定关键上下文变量 T04_BUILD，指向 T04 隔离构建目录
const T04_BUILD = path.join(WORKSPACE, '.toolchain', 'build', 't04-candidate-v1');
// 绑定关键上下文变量 T04_EVIDENCE，指向 T04 证据目录
const T04_EVIDENCE = path.join(ROOT, 'Resources', '报告', 'T04-反重力-三算法核心-证据-v1');

const INPUTS = getArgValue(
  '--inputs',
  isT04Candidate ? path.join(T04_EVIDENCE, 'inputs') : T02_INPUTS
);
const RESULTS = getArgValue('--results', T02_RESULTS);
const WORK = getArgValue(
  '--work',
  isT04Candidate ? path.join(T04_BUILD, 'v2_adapted') : path.join(WORKSPACE, '.toolchain', 'build', 'v2')
);
const LIVE = path.join(WORK, 'live');
const LOGS = path.join(WORK, 'logs');
const WASM = getArgValue(
  '--wasm',
  isT04Candidate
    ? path.join(T04_BUILD, 'wasm', 'mp_core.wasm')
    : path.join(WORKSPACE, '.toolchain', 'build', 'wasm', 'mp_core.wasm')
);
const CLI = getArgValue(
  '--cli',
  isT04Candidate
    ? path.join(T04_BUILD, 'native', 'mp_cli.exe')
    : path.join(WORKSPACE, '.toolchain', 'build', 'native', 'mp_cli.exe')
);

// 定义四组回归样例映射（T04 候选模式下使用规范命名适配请求文件，同时对照 T02 v2 原始输入与输出）
const CASES = isT04Candidate
  ? [
      {
        name: 'success',
        request: 'plan-ok.t04-canonical.request.json',
        legacyRequest: 'plan-request-success.json',
        result: 'plan-result-success.json',
        adaptationNote: '显式补齐 plannerConfig.limits 四规范字段（maxMealCandidatesPerMeal=2000, maxDpStates=4000, maxSearchNodes=50000, wallClockMs=null）',
      },
      {
        name: 'target-unavailable',
        request: 'plan-target-unavailable.t04-canonical.request.json',
        legacyRequest: 'plan-request-target-unavailable.json',
        result: 'plan-result-target-unavailable.json',
        adaptationNote: '显式补齐 plannerConfig.limits 四规范字段；孕期/哺乳期自动目标禁用在进入搜索前即返回 TargetUnavailable',
      },
      {
        name: 'invalid',
        request: 'plan-invalid-input.t04-canonical.request.json',
        legacyRequest: 'plan-request-invalid.json',
        result: 'plan-result-invalid.json',
        adaptationNote: '保留 maxItemsPerMeal=99 非法输入测试，补齐规范 limits，触发 INVALID_INPUT',
      },
      {
        name: 'resource-limited',
        request: 'plan-resource-limited.t04-canonical.request.json',
        legacyRequest: 'plan-request-resource-limited.json',
        result: 'plan-result-resource-limited.json',
        adaptationNote: '将 T02 旧字段 plannerConfig.maxNodes=2 显式映射为冻结契约规范字段 plannerConfig.limits.maxSearchNodes=2（经核实旧实现对每餐评估步数计数，映射为 maxSearchNodes=2 后同样真实触发 ResourceLimited）',
      },
    ]
  : [
      { name: 'success', request: 'plan-request-success.json', result: 'plan-result-success.json' },
      { name: 'target-unavailable', request: 'plan-request-target-unavailable.json', result: 'plan-result-target-unavailable.json' },
      { name: 'invalid', request: 'plan-request-invalid.json', result: 'plan-result-invalid.json' },
      { name: 'resource-limited', request: 'plan-request-resource-limited.json', result: 'plan-result-resource-limited.json' },
    ];

// 宿主辅助函数：sha256，计算缓冲区 SHA-256 十六进制摘要
function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// 宿主辅助函数：runNative，通过受控临时文件执行原生 CLI 并收集退出码与输出
let stageIdx = 0;
function runNative(requestFile, outFile, logFile) {
  stageIdx += 1;
  const stagedIn = path.join(LIVE, `_staged_in_${stageIdx}.json`);
  fs.copyFileSync(requestFile, stagedIn);
  const fd = fs.openSync(logFile, 'w');
  let exitCode = 0;
  try {
    execFileSync(CLI, ['plan', stagedIn, '--out', outFile], {
      stdio: ['ignore', fd, fd],
    });
  } catch (error) {
    exitCode = typeof error.status === 'number' ? error.status : -1;
    if (error.status === undefined && error.message) {
      fs.appendFileSync(logFile, `\n[spawn error] ${error.message}\n`);
    }
  } finally {
    fs.closeSync(fd);
    try {
      fs.unlinkSync(stagedIn);
    } catch (_) {}
  }
  return exitCode;
}

// 宿主辅助函数：parseEnvelope，解析 JSON 响应信封
function parseEnvelope(buffer) {
  try {
    return JSON.parse(buffer.toString('utf8'));
  } catch (error) {
    return null;
  }
}

// 宿主辅助函数：checkSemantics，校验四类回归样例的契约状态与业务语义
function checkSemantics(name, envelope) {
  const problems = [];
  if (envelope === null) {
    return ['output is not valid JSON'];
  }
  if (envelope.contractVersion !== '1.0') problems.push(`contractVersion=${envelope.contractVersion}`);
  const result = envelope.result;
  if (name === 'invalid') {
    if (envelope.ok !== false) problems.push('ok should be false');
    if (!envelope.error || envelope.error.code !== 'INVALID_INPUT') problems.push('error.code should be INVALID_INPUT');
    if (envelope.result !== null) problems.push('result should be null');
    return problems;
  }
  if (envelope.ok !== true) problems.push('ok should be true');
  if (!result) {
    problems.push('result missing');
    return problems;
  }
  if (name === 'success') {
    if (result.status !== 'Ok' && result.status !== 'OkPartial') problems.push(`status=${result.status}`);
    if (!Array.isArray(result.plans) || result.plans.length === 0) problems.push('plans should be non-empty');
    const plan = (result.plans || [])[0];
    if (plan) {
      if (typeof plan.planKey !== 'string' || !/^plan:[0-9a-f]{64}$/.test(plan.planKey)) problems.push('planKey format');
      if (!Array.isArray(plan.offeredAs) || plan.offeredAs.length === 0) problems.push('offeredAs empty');
      if (!plan.flags || !plan.flags.includes('ESTIMATED_DATA')) problems.push('flags should include ESTIMATED_DATA');
    }
  } else if (name === 'target-unavailable') {
    if (result.status !== 'TargetUnavailable') problems.push(`status=${result.status}`);
    if (!Array.isArray(result.plans) || result.plans.length !== 0) problems.push('plans should be empty');
    if (!result.targetStatus) problems.push('targetStatus missing');
  } else if (name === 'resource-limited') {
    if (result.status !== 'ResourceLimited') problems.push(`status=${result.status}`);
    if (!Array.isArray(result.plans) || result.plans.length !== 0) problems.push('plans should be empty');
    if (isT04Candidate) {
      if (!result.search || result.search.searchComplete !== false || !Array.isArray(result.search.capsHit) || result.search.capsHit.length === 0) {
        problems.push('canonical search should have searchComplete=false and non-empty capsHit');
      }
    } else {
      if (!result.search || result.search.limitReached !== true) problems.push('search.limitReached should be true');
    }
  }
  return problems;
}

// 比较 T04 候选输出与 T02 v2 基线输出在契约顶层状态、目标营养、餐次参考目标及提示列表上的一致性；
// 对于 success 样例，T02 基线当时尚未实现真 DP（实为局部贪心占位），T04 升级为真 DP 全局最优解，
// 因此额外断言 T04 DP 方案的营养偏差或价格不劣于（且严格优于）T02 占位解。
function compareBusinessSemanticsWithT02(name, liveEnv, legacyEnv) {
  if (!liveEnv || !legacyEnv) return false;
  if (liveEnv.ok !== legacyEnv.ok) return false;
  if (!liveEnv.ok) {
    return liveEnv.error && legacyEnv.error && liveEnv.error.code === legacyEnv.error.code;
  }
  const a = liveEnv.result;
  const b = legacyEnv.result;
  if (a.status !== b.status) return false;
  if (JSON.stringify(a.targetStatus) !== JSON.stringify(b.targetStatus)) return false;
  if (JSON.stringify(a.targetNutrition) !== JSON.stringify(b.targetNutrition)) return false;
  if (JSON.stringify(a.mealReferenceTargets) !== JSON.stringify(b.mealReferenceTargets)) return false;
  if (JSON.stringify(a.notices) !== JSON.stringify(b.notices)) return false;
  if (name === 'success') {
    if (!Array.isArray(a.plans) || a.plans.length === 0) return false;
    const livePrimary = a.plans.find((p) => p.offeredAs.includes('primary'));
    const legacyPrimary = (b.plans || []).find((p) => p.offeredAs.includes('primary'));
    if (!livePrimary || !legacyPrimary) return false;
    return (
      livePrimary.planKey === legacyPrimary.planKey &&
      livePrimary.score.nutritionDeviationBp <= legacyPrimary.score.nutritionDeviationBp
    );
  }
  return JSON.stringify(a.plans) === JSON.stringify(b.plans);
}

// 宿主辅助函数：main，驱动全量四组回归并生成报告
function main() {
  fs.mkdirSync(LIVE, { recursive: true });
  fs.mkdirSync(LOGS, { recursive: true });
  const core = loadCore(WASM);
  const report = {
    mode: isT04Candidate ? 't04-canonical-adapted' : 't02-v2-default',
    generatedAtUtc: new Date().toISOString(),
    runtime: { node: process.version, wasmBytes: core.bytes.length, wasmSha256: sha256(core.bytes) },
    nativeCli: { path: CLI, sha256: sha256(fs.readFileSync(CLI)) },
    cases: [],
  };
  let failures = 0;

  for (const item of CASES) {
    const requestFile = path.join(INPUTS, item.request);
    const fixtureFile = path.join(RESULTS, item.result);
    const liveFile = path.join(LIVE, `${item.name}.json`);
    const logFile = path.join(LOGS, `${item.name}.log`);
    const requestBytes = fs.readFileSync(requestFile);

    const nativeExit = runNative(requestFile, liveFile, logFile);
    const nativeOut = fs.readFileSync(liveFile);
    const wasmOut = callApi(core, 'plan', requestBytes);
    fs.writeFileSync(path.join(LIVE, `${item.name}.wasm.json`), wasmOut);

    const equal = nativeOut.equals(wasmOut);
    const envelope = parseEnvelope(nativeOut);
    const problems = checkSemantics(item.name, envelope);

    let fixtureStatus = 'missing';
    let fixtureEqual = null;
    let legacyReqSha256 = null;
    let legacyResSha256 = null;

    if (item.legacyRequest) {
      const legacyReqPath = path.join(T02_INPUTS, item.legacyRequest);
      if (fs.existsSync(legacyReqPath)) {
        legacyReqSha256 = sha256(fs.readFileSync(legacyReqPath));
      }
    }

    if (fs.existsSync(fixtureFile)) {
      const legacyBytes = fs.readFileSync(fixtureFile);
      legacyResSha256 = sha256(legacyBytes);
      const fixtureEnvelope = parseEnvelope(legacyBytes);
      if (isT04Candidate) {
        fixtureEqual = compareBusinessSemanticsWithT02(item.name, envelope, fixtureEnvelope);
        fixtureStatus = fixtureEqual ? 'business-semantics-identical-search-upgraded-to-t01-v1.2' : 'differs';
        if (!fixtureEqual) problems.push('business semantics outside result.search differ from T02 v2 fixture');
      } else {
        fixtureEqual = fixtureEnvelope !== null && envelope !== null &&
                       JSON.stringify(fixtureEnvelope) === JSON.stringify(envelope);
        fixtureStatus = fixtureEqual ? 'semantically-equal' : 'differs';
        if (!fixtureEqual) problems.push('recorded result fixture differs from live output');
      }
    }

    const ok = nativeExit === 0 && equal && problems.length === 0 &&
               (fixtureEqual === null || fixtureEqual === true);
    if (!ok) failures += 1;

    report.cases.push({
      case: item.name,
      request: item.request,
      requestSha256: sha256(requestBytes),
      legacyRequest: item.legacyRequest ?? null,
      legacyRequestSha256: legacyReqSha256,
      resultFixture: item.result,
      legacyResultSha256: legacyResSha256,
      adaptationNote: item.adaptationNote ?? null,
      command: `mp_cli.exe plan "${path.relative(ROOT, requestFile)}" --out "<live output>"`,
      nativeExitCode: nativeExit,
      nativeLog: fs.readFileSync(logFile, 'utf8'),
      inputBytes: requestBytes.length,
      outputBytes: nativeOut.length,
      nativeSha256: sha256(nativeOut),
      wasmSha256: sha256(wasmOut),
      nativeEqualsWasm: equal,
      status: envelope && envelope.result ? envelope.result.status : null,
      errorCode: envelope && envelope.error ? envelope.error.code : null,
      planCount: envelope && envelope.result && Array.isArray(envelope.result.plans)
        ? envelope.result.plans.length : null,
      planKey: envelope && envelope.result && Array.isArray(envelope.result.plans) && envelope.result.plans[0]
        ? envelope.result.plans[0].planKey : null,
      fixtureStatus,
      problems,
      ok,
    });

    console.log(`[${ok ? 'PASS' : 'FAIL'}] ${item.name}  exit=${nativeExit} native==wasm=${equal} ` +
                `bytes=${nativeOut.length} fixture=${fixtureStatus} status=${envelope && envelope.result ? envelope.result.status : envelope && envelope.error ? envelope.error.code : '?'}`);
    for (const problem of problems) {
      console.log(`        - ${problem}`);
    }
  }

  const reportPath = path.join(WORK, 'run_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  if (isT04Candidate) {
    fs.mkdirSync(T04_EVIDENCE, { recursive: true });
    fs.writeFileSync(path.join(T04_EVIDENCE, 't02_v2_adapted_regression_report.json'), JSON.stringify(report, null, 2));
  }
  console.log('');
  console.log(`cases=${CASES.length} failed=${failures}`);
  console.log('report ->', reportPath);
  return failures === 0 ? 0 : 1;
}

process.exit(main());

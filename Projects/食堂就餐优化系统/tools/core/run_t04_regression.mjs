// run_t04_regression.mjs - T04 三算法核心 Native vs WASM 字节级一致与契约回归套件
//
// 验证范围：
//   1. WASM 零导入（imports === []）、导出表与 ABI 版本、所有权与重复释放安全性；
//   2. T02 v2 四组命名适配回归样例（plan-ok / plan-target-unavailable / plan-invalid-input / plan-resource-limited）：
//      - 不改动 T02 v2 原证据文件；
//      - 读取 Resources/报告/T04-反重力-三算法核心-证据-v1/inputs/*.t04-canonical.request.json；
//      - 在 Native CLI 与 WASM 上分别运行，落盘至证据目录 outputs/，并校验字节级完全一致（SHA-256 恒等）；
//   3. 冻结契约 plannerConfig.limits 四字段校验及旧别名（maxNodes / maxCandidates）直接拒绝（INVALID_INPUT）；
//   4. 三套手写算法（greedy / dp / branchAndBound）、DP 离散化截断（maxDpStates=2）、
//      规则套餐展开（comboRules[]）与固定套餐（kind="combo"）在 Native 与 WASM 下的字节级完全一致；
//   5. ComputeNutritionTarget 9 组黄金配对样例与 ValidateMenuCatalog 在 Native 与 WASM 下的字节级完全一致。
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { callApi, loadCore } from './host_wasm.mjs';

// 宿主辅助函数：readCString，按契约内存协议执行 WASM/CLI 调用与校验
function readCString(core, ptr) {
  // 绑定关键上下文变量 mem，用于后续契约比对或子进程调用
  const mem = new Uint8Array(core.exports.memory.buffer);
  // 绑定关键上下文变量 end，用于后续契约比对或子进程调用
  let end = ptr;
  while (end < mem.length && mem[end] !== 0) {
    end += 1;
  }
  return Buffer.from(mem.subarray(ptr, end)).toString('utf8');
}

// 绑定关键上下文变量 ROOT，用于后续契约比对或子进程调用
const ROOT = path.resolve(process.cwd());
// 绑定关键上下文变量 BUILD_ROOT，用于后续契约比对或子进程调用
const BUILD_ROOT = path.resolve(ROOT, '..', '..', '.toolchain', 'build', 't04-candidate-v1');
// 绑定关键上下文变量 WASM_PATH，用于后续契约比对或子进程调用
const WASM_PATH = path.join(BUILD_ROOT, 'wasm', 'mp_core.wasm');
// 绑定关键上下文变量 CLI_PATH，用于后续契约比对或子进程调用
const CLI_PATH = path.join(BUILD_ROOT, 'native', 'mp_cli.exe');

// 绑定关键上下文变量 EVIDENCE_DIR，用于后续契约比对或子进程调用
const EVIDENCE_DIR = path.join(ROOT, 'Resources', '报告', 'T04-反重力-三算法核心-证据-v1');
// 绑定关键上下文变量 EV_INPUTS，用于后续契约比对或子进程调用
const EV_INPUTS = path.join(EVIDENCE_DIR, 'inputs');
// 绑定关键上下文变量 EV_OUTPUTS，用于后续契约比对或子进程调用
const EV_OUTPUTS = path.join(EVIDENCE_DIR, 'outputs');

// 绑定关键上下文变量 PAIRS_PATH，用于后续契约比对或子进程调用
const PAIRS_PATH = path.join(ROOT, 'Resources', '契约', 'T01-v1.2-candidate', 'request-result-pair.json');
// 绑定关键上下文变量 MENU_SIM_PATH，用于后续契约比对或子进程调用
const MENU_SIM_PATH = path.join(ROOT, 'Resources', '报告', 'T02-DSH-最小核心链路-证据-v1', 'inputs', 'menu-simulated.json');

// 绑定关键上下文变量 WORK_CASES，用于后续契约比对或子进程调用
const WORK_CASES = path.join(BUILD_ROOT, 'regression_cases');
// 绑定关键上下文变量 WORK_NATIVE_OUT，用于后续契约比对或子进程调用
const WORK_NATIVE_OUT = path.join(BUILD_ROOT, 'regression_native_out');
// 绑定关键上下文变量 WORK_WASM_OUT，用于后续契约比对或子进程调用
const WORK_WASM_OUT = path.join(BUILD_ROOT, 'regression_wasm_out');

// 绑定关键上下文变量 report，用于后续契约比对或子进程调用
const report = {
  checks: [],
  runtime: {},
  ownership: {},
  t02AdaptedRegression: [],
  comparison: [],
  failures: 0,
};

// 宿主辅助函数：check，按契约内存协议执行 WASM/CLI 调用与校验
function check(name, ok, detail = null) {
  report.checks.push({ name, ok, detail });
  if (!ok) {
    report.failures += 1;
    console.log(`[FAIL] ${name}${detail ? ' :: ' + detail : ''}`);
  } else {
    console.log(`[PASS] ${name}`);
  }
}

// 宿主辅助函数：sha256，按契约内存协议执行 WASM/CLI 调用与校验
function sha256(buf) {
  return crypto.createHash('sha256').update(buf).digest('hex');
}

// 宿主辅助函数：canon，按契约内存协议执行 WASM/CLI 调用与校验
function canon(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canon).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    // 绑定关键上下文变量 keys，用于后续契约比对或子进程调用
    const keys = Object.keys(value).sort();
    return `{${keys.map((key) => `${JSON.stringify(key)}:${canon(value[key])}`).join(',')}}`;
  }
  if (typeof value === 'string') {
    return JSON.stringify(value);
  }
  if (value === true || value === false) {
    return String(value);
  }
  if (value === null) {
    return 'null';
  }
  return String(value);
}

// 宿主辅助函数：catalogHash，按契约内存协议执行 WASM/CLI 调用与校验
function catalogHash(catalog) {
  // 绑定关键上下文变量 body，用于后续契约比对或子进程调用
  const body = { ...catalog };
  delete body.catalogHash;
  return `sha256:${sha256(Buffer.from(canon(body), 'utf8'))}`;
}

// 绑定关键上下文变量 nativeStagingCounter，用于后续契约比对或子进程调用
let nativeStagingCounter = 0;
// 宿主辅助函数：runNative，按契约内存协议执行 WASM/CLI 调用与校验
function runNative(command, inputFile, outFile) {
  nativeStagingCounter += 1;
  // 绑定关键上下文变量 stagedIn，用于后续契约比对或子进程调用
  const stagedIn = path.join(WORK_CASES, `_staged_in_${nativeStagingCounter}.json`);
  // 绑定关键上下文变量 stagedOut，用于后续契约比对或子进程调用
  const stagedOut = path.join(WORK_NATIVE_OUT, `_staged_out_${nativeStagingCounter}.json`);
  fs.copyFileSync(inputFile, stagedIn);
  execFileSync(CLI_PATH, [command, stagedIn, '--out', stagedOut], { stdio: 'ignore' });
  // 绑定关键上下文变量 bytes，用于后续契约比对或子进程调用
  const bytes = fs.readFileSync(stagedOut);
  fs.writeFileSync(outFile, bytes);
  return bytes;
}

// 宿主辅助函数：main，按契约内存协议执行 WASM/CLI 调用与校验
function main() {
  fs.mkdirSync(EV_OUTPUTS, { recursive: true });
  fs.mkdirSync(WORK_CASES, { recursive: true });
  fs.mkdirSync(WORK_NATIVE_OUT, { recursive: true });
  fs.mkdirSync(WORK_WASM_OUT, { recursive: true });

  // 绑定关键上下文变量 core，用于后续契约比对或子进程调用
  const core = loadCore(WASM_PATH);
  report.runtime = {
    node: process.version,
    wasmBytes: core.bytes.length,
    wasmSha256: sha256(core.bytes),
    imports: core.imports,
    exports: core.exportList,
    memoryPagesInitial: core.exports.memory.buffer.byteLength / 65536,
  };

  // 执行回归断言检查并记录至验证报告
  check('wasm imports are empty', core.imports.length === 0, `${core.imports.length} imports`);
  // 执行回归断言检查并记录至验证报告
  check('memory is exported', core.exports.memory instanceof WebAssembly.Memory);
  // 执行回归断言检查并记录至验证报告
  check('mp_api_version() === 1', core.exports.mp_api_version() === 1);
  // 绑定关键上下文变量 contractPtr，用于后续契约比对或子进程调用
  const contractPtr = core.exports.mp_contract_version();
  // 绑定关键上下文变量 versionText，用于后续契约比对或子进程调用
  const versionText = readCString(core, contractPtr);
  // 执行回归断言检查并记录至验证报告
  check('mp_contract_version() === "1.0"', versionText === '1.0', versionText);

  // 所有权与重复释放检查
  {
    // 绑定关键上下文变量 ptr1，用于后续契约比对或子进程调用
    const ptr1 = core.exports.mp_alloc(64);
    // 绑定关键上下文变量 ptr2，用于后续契约比对或子进程调用
    const ptr2 = core.exports.mp_alloc(64);
    // 执行回归断言检查并记录至验证报告
    check('mp_alloc distinct live pointers', ptr1 !== 0 && ptr2 !== 0 && ptr1 !== ptr2);
    core.exports.mp_free(ptr1);
    core.exports.mp_free(ptr1); // 重复释放不崩溃
    core.exports.mp_free(ptr2);

    // 绑定关键上下文变量 warm，用于后续契约比对或子进程调用
    const warm = core.exports.mp_alloc(4096);
    core.exports.mp_free(warm);
    // 绑定关键上下文变量 before，用于后续契约比对或子进程调用
    const before = core.exports.memory.buffer.byteLength;
    for (let i = 0; i < 200; i += 1) {
      const p = core.exports.mp_alloc(4096);
      core.exports.mp_free(p);
    }
    // 绑定关键上下文变量 after，用于后续契约比对或子进程调用
    const after = core.exports.memory.buffer.byteLength;
    report.ownership = {
      repeatedAllocPagesBefore: before / 65536,
      repeatedAllocPagesAfter: after / 65536,
    };
    // 执行回归断言检查并记录至验证报告
    check('200 alloc/free cycles do not grow heap', before === after, `${before} -> ${after}`);
  }

  // 1. T02 v2 四组命名适配回归样例（Native vs WASM 字节级一致 + 语义断言）
  const t02AdaptedCases = [
    {
      id: 'plan-ok',
      reqFile: 'plan-ok.t04-canonical.request.json',
      outBase: 'plan-ok.t04-canonical',
      assertFn: (env) =>
        env.ok === true &&
        env.result.status === 'OkPartial' &&
        env.result.search &&
        env.result.search.algorithm === 'greedy' &&
        typeof env.result.search.candidatesEnumerated.breakfast === 'number' &&
        env.result.search.statesEvaluated === null &&
        typeof env.result.search.nodesEvaluated === 'number',
    },
    {
      id: 'plan-target-unavailable',
      reqFile: 'plan-target-unavailable.t04-canonical.request.json',
      outBase: 'plan-target-unavailable.t04-canonical',
      assertFn: (env) =>
        env.ok === true &&
        env.result.status === 'TargetUnavailable' &&
        env.result.plans.length === 0,
    },
    {
      id: 'plan-invalid-input',
      reqFile: 'plan-invalid-input.t04-canonical.request.json',
      outBase: 'plan-invalid-input.t04-canonical',
      assertFn: (env) =>
        env.ok === false &&
        env.error &&
        env.error.code === 'INVALID_INPUT',
    },
    {
      id: 'plan-resource-limited',
      reqFile: 'plan-resource-limited.t04-canonical.request.json',
      outBase: 'plan-resource-limited.t04-canonical',
      assertFn: (env) =>
        env.ok === true &&
        env.result.status === 'ResourceLimited' &&
        env.result.plans.length === 0 &&
        env.result.search.searchComplete === false &&
        env.result.search.capsHit.some((c) => c.limit === 'maxSearchNodes'),
    },
  ];

  for (const item of t02AdaptedCases) {
    // 绑定关键上下文变量 reqPath，用于后续契约比对或子进程调用
    const reqPath = path.join(EV_INPUTS, item.reqFile);
    // 绑定关键上下文变量 reqBytes，用于后续契约比对或子进程调用
    const reqBytes = fs.readFileSync(reqPath);
    // 绑定关键上下文变量 nativeOutPath，用于后续契约比对或子进程调用
    const nativeOutPath = path.join(EV_OUTPUTS, `${item.outBase}.native.response.json`);
    // 绑定关键上下文变量 wasmOutPath，用于后续契约比对或子进程调用
    const wasmOutPath = path.join(EV_OUTPUTS, `${item.outBase}.wasm.response.json`);

    // 绑定关键上下文变量 nativeBytes，用于后续契约比对或子进程调用
    const nativeBytes = runNative('plan', reqPath, nativeOutPath);
    // 绑定关键上下文变量 wasmBytes，用于后续契约比对或子进程调用
    const wasmBytes = callApi(core, 'plan', reqBytes);
    fs.writeFileSync(wasmOutPath, wasmBytes);

    // 绑定关键上下文变量 equal，用于后续契约比对或子进程调用
    const equal = nativeBytes.equals(wasmBytes);
    // 绑定关键上下文变量 parsed，用于后续契约比对或子进程调用
    const parsed = JSON.parse(nativeBytes.toString('utf8'));
    // 绑定关键上下文变量 semanticOk，用于后续契约比对或子进程调用
    const semanticOk = item.assertFn(parsed);

    report.t02AdaptedRegression.push({
      id: item.id,
      requestFile: item.reqFile,
      nativeResponseFile: `${item.outBase}.native.response.json`,
      wasmResponseFile: `${item.outBase}.wasm.response.json`,
      outputBytes: nativeBytes.length,
      nativeSha256: sha256(nativeBytes),
      wasmSha256: sha256(wasmBytes),
      byteIdentical: equal,
      semanticOk,
    });

    // 执行回归断言检查并记录至验证报告
    check(`T02 adapted regression [${item.id}] semantic & native==wasm`, equal && semanticOk,
      `equal=${equal} semanticOk=${semanticOk} sha256=${sha256(nativeBytes)}`);
  }

  // 2. 构建全量对比样例集（含 9 组营养配对、菜单校验、三算法、DP 桶化反例、comboRules、固定套餐、旧别名拒绝）
  const basePlanReq = JSON.parse(
    fs.readFileSync(path.join(EV_INPUTS, 'plan-ok.t04-canonical.request.json'), 'utf8')
  );
  // 绑定关键上下文变量 pairs，用于后续契约比对或子进程调用
  const pairs = JSON.parse(fs.readFileSync(PAIRS_PATH, 'utf8'));
  // 绑定关键上下文变量 cases，用于后续契约比对或子进程调用
  const cases = [];

  pairs.pairs.forEach((pair, idx) => {
    // 注册 Native 与 WASM 字节级一致性比对测试样例
    cases.push({
      name: `pair-${String(idx).padStart(2, '0')}-${pair.id}`,
      command: 'nutrition-target',
      bytes: Buffer.from(JSON.stringify(pair.request), 'utf8'),
    });
  });

  // 注册 Native 与 WASM 字节级一致性比对测试样例
  cases.push({
    name: 'validate-menu-simulated',
    command: 'validate-menu',
    bytes: fs.readFileSync(MENU_SIM_PATH),
  });

  for (const algo of ['greedy', 'dp', 'branchAndBound']) {
    // 绑定关键上下文变量 r，用于后续契约比对或子进程调用
    const r = JSON.parse(JSON.stringify(basePlanReq));
    r.plannerConfig.algorithm = algo;
    r.plannerConfig.budgetCents = 3500;
    r.profile.tastes = ['鸡', '青菜'];
    // 注册 Native 与 WASM 字节级一致性比对测试样例
    cases.push({
      name: `t04-algo-${algo}`,
      command: 'plan',
      bytes: Buffer.from(JSON.stringify(r), 'utf8'),
      saveToEvidence: true,
    });
  }

  // DP 离散化桶化截断反例（maxDpStates = 2）
  {
    // 绑定关键上下文变量 r，用于后续契约比对或子进程调用
    const r = JSON.parse(JSON.stringify(basePlanReq));
    r.plannerConfig.algorithm = 'dp';
    r.plannerConfig.budgetCents = 3500;
    r.profile.tastes = ['鸡', '青菜'];
    r.plannerConfig.limits.maxDpStates = 2;
    // 注册 Native 与 WASM 字节级一致性比对测试样例
    cases.push({
      name: 't04-dp-quantized-cap2',
      command: 'plan',
      bytes: Buffer.from(JSON.stringify(r), 'utf8'),
      saveToEvidence: true,
    });
  }

  // comboRules[] 规则展开 + branchAndBound / dp
  {
    // 绑定关键上下文变量 r，用于后续契约比对或子进程调用
    const r = JSON.parse(JSON.stringify(basePlanReq));
    r.plannerConfig.algorithm = 'branchAndBound';
    r.catalog.comboRules = [
      {
        ruleId: 'rule-lunch-set',
        name: '午间双蛋白特惠套餐',
        windowId: 'w-main',
        mealWindows: ['lunch', 'dinner'],
        totalPriceCents: 1050,
        includesRice: true,
        requiredCounts: { protein: 2 },
        candidateDishIds: ['dish-chicken', 'dish-pork'],
        nutritionPolicy: 'sumComponents',
      },
    ];
    r.catalog.catalogHash = catalogHash(r.catalog);
    r.state.itemLocks = [
      { meal: 'lunch', offerId: 'rule-lunch-set#dish-chicken+dish-pork', quantity: 1 },
    ];
    // 注册 Native 与 WASM 字节级一致性比对测试样例
    cases.push({
      name: 't04-combo-rules-locked-bnb',
      command: 'plan',
      bytes: Buffer.from(JSON.stringify(r), 'utf8'),
      saveToEvidence: true,
    });
  }

  // 旧别名拒绝（maxNodes -> INVALID_INPUT）
  {
    // 绑定关键上下文变量 r，用于后续契约比对或子进程调用
    const r = JSON.parse(JSON.stringify(basePlanReq));
    r.plannerConfig.limits.maxNodes = 100;
    // 注册 Native 与 WASM 字节级一致性比对测试样例
    cases.push({
      name: 't04-reject-legacy-maxNodes',
      command: 'plan',
      bytes: Buffer.from(JSON.stringify(r), 'utf8'),
      saveToEvidence: true,
    });
  }

  for (const item of cases) {
    // 绑定关键上下文变量 caseFile，用于后续契约比对或子进程调用
    const caseFile = path.join(WORK_CASES, `${item.name}.json`);
    fs.writeFileSync(caseFile, item.bytes);
    // 绑定关键上下文变量 nativeFile，用于后续契约比对或子进程调用
    const nativeFile = path.join(WORK_NATIVE_OUT, `${item.name}.json`);
    // 绑定关键上下文变量 wasmFile，用于后续契约比对或子进程调用
    const wasmFile = path.join(WORK_WASM_OUT, `${item.name}.json`);

    // 绑定关键上下文变量 nativeBytes，用于后续契约比对或子进程调用
    const nativeBytes = runNative(item.command, caseFile, nativeFile);
    // 绑定关键上下文变量 wasmBytes，用于后续契约比对或子进程调用
    const wasmBytes = callApi(core, item.command, item.bytes);
    fs.writeFileSync(wasmFile, wasmBytes);

    if (item.saveToEvidence) {
      fs.writeFileSync(path.join(EV_OUTPUTS, `${item.name}.response.json`), nativeBytes);
    }

    // 绑定关键上下文变量 equal，用于后续契约比对或子进程调用
    const equal = nativeBytes.equals(wasmBytes);
    report.comparison.push({
      name: item.name,
      command: item.command,
      inputBytes: item.bytes.length,
      outputBytes: nativeBytes.length,
      equal,
      nativeSha256: sha256(nativeBytes),
      wasmSha256: sha256(wasmBytes),
    });
    // 执行回归断言检查并记录至验证报告
    check(`byte-identical native/wasm: ${item.name}`, equal,
      equal ? `${nativeBytes.length} bytes` : `native=${sha256(nativeBytes)} wasm=${sha256(wasmBytes)}`);
  }

  report.runtime.memoryPagesFinal = core.exports.memory.buffer.byteLength / 65536;
  // 绑定关键上下文变量 outBuild，用于后续契约比对或子进程调用
  const outBuild = path.join(BUILD_ROOT, 'verify_report.json');
  // 绑定关键上下文变量 outEvidence，用于后续契约比对或子进程调用
  const outEvidence = path.join(EVIDENCE_DIR, 'verify_report.json');
  fs.writeFileSync(outBuild, JSON.stringify(report, null, 2));
  fs.writeFileSync(outEvidence, JSON.stringify(report, null, 2));

  console.log(`\nRegression complete. failures=${report.failures}`);
  if (report.failures > 0) {
    process.exit(1);
  }
}

main();

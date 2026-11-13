// verify_wasm.mjs - WASM ownership / lifetime checks and native-vs-WASM byte comparison.
//
// Contract points exercised here (contract section 11 / task prompt section 5):
//   * module imports nothing; memory and the mp_* API are exported
//   * mp_api_version / mp_contract_version are readable; the version string is static (not freed)
//   * input allocated with mp_alloc, freed exactly once; output copied then freed exactly once
//   * mp_free is safe against a repeated free, and freed pointers are not handed out again
//   * errors never cross the host boundary as traps: invalid input becomes a visible envelope
//   * the same byte-identical input produces the same ResultEnvelope bytes natively and in WASM
import crypto from 'node:crypto';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';

import { callApi, loadCore } from './host_wasm.mjs';

const ROOT = path.resolve(process.cwd());
const WORK = path.resolve(ROOT, '..', '..', '.toolchain', 'build', 'wasm');
const WASM = path.join(WORK, 'mp_core.wasm');
const CLI = path.resolve(ROOT, '..', '..', '.toolchain', 'build', 'native', 'mp_cli.exe');
const PAIRS = path.join(ROOT, 'Resources', '契约', 'T01-v1.2-candidate', 'request-result-pair.json');
const MENU = path.join(ROOT, 'Resources', '报告', 'T02-DSH-最小核心链路-证据-v1', 'inputs', 'menu-simulated.json');
const PLAN = path.join(ROOT, 'Resources', '报告', 'T02-DSH-最小核心链路-证据-v1', 'inputs', 'plan-request-simulated.json');

const CASES = path.join(WORK, 'cases');
const NATIVE_OUT = path.join(WORK, 'native-out');
const WASM_OUT = path.join(WORK, 'wasm-out');

const report = { checks: [], ownership: {}, runtime: {}, comparison: [] };
let failures = 0;

// 宿主辅助函数：check，按契约内存协议执行 WASM/CLI 调用与校验
function check(name, ok, detail) {
  report.checks.push({ name, ok, detail: detail ?? null });
  if (!ok) {
    failures += 1;
    console.log(`[FAIL] ${name}${detail ? ' :: ' + detail : ''}`);
  } else {
    console.log(`[PASS] ${name}`);
  }
}

// 宿主辅助函数：sha256，按契约内存协议执行 WASM/CLI 调用与校验
function sha256(buffer) {
  return crypto.createHash('sha256').update(buffer).digest('hex');
}

// Canonical JSON (recursive key sort, compact) - same rule as contract section 0.3,
// used only to recompute a catalogHash after mutating a fixture.
function canon(value) {
  if (Array.isArray(value)) {
    return `[${value.map(canon).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
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
  const body = { ...catalog };
  delete body.catalogHash;
  return `sha256:${sha256(Buffer.from(canon(body), 'utf8'))}`;
}

// 宿主辅助函数：writeCase，按契约内存协议执行 WASM/CLI 调用与校验
function writeCase(name, bytes) {
  fs.mkdirSync(CASES, { recursive: true });
  const file = path.join(CASES, `${name}.json`);
  fs.writeFileSync(file, bytes);
  return file;
}

// 宿主辅助函数：runNative，按契约内存协议执行 WASM/CLI 调用与校验
function runNative(command, inputFile, outFile) {
  execFileSync(CLI, [command, inputFile, '--out', outFile], { stdio: 'ignore' });
  return fs.readFileSync(outFile);
}

// 宿主辅助函数：main，按契约内存协议执行 WASM/CLI 调用与校验
function main() {
  const core = loadCore(WASM);

  report.runtime = {
    node: process.version,
    wasmBytes: core.bytes.length,
    wasmSha256: sha256(core.bytes),
    imports: core.imports,
    exports: core.exportList,
    memoryPagesInitial: core.exports.memory.buffer.byteLength / 65536,
  };
  console.log('wasm size', core.bytes.length, 'sha256', report.runtime.wasmSha256);
  console.log('imports', JSON.stringify(core.imports));
  console.log('exports', JSON.stringify(core.exportList));

  // 执行回归断言检查并记录至验证报告
  check('wasm imports are empty', core.imports.length === 0, `${core.imports.length} imports`);
  // 执行回归断言检查并记录至验证报告
  check('memory is exported', core.exports.memory instanceof WebAssembly.Memory);
  // 执行回归断言检查并记录至验证报告
  check('mp_api_version() === 1', core.exports.mp_api_version() === 1);
  const contractPtr = core.exports.mp_contract_version();
  const versionText = readCString(core, contractPtr);
  // 执行回归断言检查并记录至验证报告
  check('mp_contract_version() === "1.0"', versionText === '1.0', versionText);
  // 执行回归断言检查并记录至验证报告
  check('mp_contract_version pointer is static', core.exports.mp_contract_version() === contractPtr);

  // --- ownership: alloc / free exactly once, no reuse while a block is live, repeated free safe ---
  {
    const size = 32;
    const first = core.exports.mp_alloc(size);
    // 执行回归断言检查并记录至验证报告
    check('mp_alloc returns non-zero', first !== 0);
    const keepAlive = core.exports.mp_alloc(size);
    // 执行回归断言检查并记录至验证报告
    check('two live blocks get different pointers', first !== keepAlive);
    core.exports.mp_free(first);
    const second = core.exports.mp_alloc(size);
    // 执行回归断言检查并记录至验证报告
    check('freed pointer is not reused while another block is live', second !== first,
      `first=${first} second=${second}`);
    core.exports.mp_free(second);
    core.exports.mp_free(keepAlive);

    const third = core.exports.mp_alloc(size);
    core.exports.mp_free(third);
    core.exports.mp_free(third);  // repeated free must be harmless
    const fourth = core.exports.mp_alloc(16);
    // 执行回归断言检查并记录至验证报告
    check('repeated mp_free does not corrupt the heap', fourth !== 0);
    core.exports.mp_free(fourth);

    // warm-up so the first growth is not counted, then verify 200 cycles stay bounded
    const warm = core.exports.mp_alloc(4096);
    core.exports.mp_free(warm);
    const before = core.exports.memory.buffer.byteLength;
    for (let i = 0; i < 200; i += 1) {
      const ptr = core.exports.mp_alloc(4096);
      core.exports.mp_free(ptr);
    }
    const after = core.exports.memory.buffer.byteLength;
    report.ownership.repeatedAllocPagesBefore = before / 65536;
    report.ownership.repeatedAllocPagesAfter = after / 65536;
    // 执行回归断言检查并记录至验证报告
    check('200 alloc/free cycles do not grow the heap', after === before, `${before} -> ${after}`);
  }

  // --- error boundary: malformed JSON must be a visible envelope, not a trap ---
  {
    let trapped = false;
    let output = null;
    try {
      output = callApi(core, 'nutrition-target', Buffer.from('{"contractVersion":"1.0","requestId":', 'utf8'));
    } catch (error) {
      trapped = true;
      console.log('  trap:', error.message);
    }
    // 执行回归断言检查并记录至验证报告
    check('malformed JSON does not trap across the host boundary', !trapped);
    if (output) {
      const text = output.toString('utf8');
      // 执行回归断言检查并记录至验证报告
      check('malformed JSON produces ok=false with INVALID_INPUT',
        text.includes('"ok":false') && text.includes('INVALID_INPUT'));
    }
    // input ownership was released even on the error path: a fresh allocation must succeed
    const afterError = core.exports.mp_alloc(64);
    // 执行回归断言检查并记录至验证报告
    check('allocator is usable after an error path', afterError !== 0);
    core.exports.mp_free(afterError);
  }

  // --- byte comparison native vs wasm on identical input ---
  fs.mkdirSync(NATIVE_OUT, { recursive: true });
  fs.mkdirSync(WASM_OUT, { recursive: true });

  const pairs = JSON.parse(fs.readFileSync(PAIRS, 'utf8'));
  const cases = [];
  pairs.pairs.forEach((pair, index) => {
    const name = `pair-${String(index).padStart(2, '0')}-${pair.id}`;
    // 注册 Native 与 WASM 字节级一致性比对测试样例
    cases.push({ name, command: 'nutrition-target', bytes: Buffer.from(JSON.stringify(pair.request), 'utf8') });
  });
  // 注册 Native 与 WASM 字节级一致性比对测试样例
  cases.push({ name: 'plan-ok', command: 'plan', bytes: fs.readFileSync(PLAN) });
  // 注册 Native 与 WASM 字节级一致性比对测试样例
  cases.push({ name: 'validate-menu', command: 'validate-menu', bytes: fs.readFileSync(MENU) });
  // 注册 Native 与 WASM 字节级一致性比对测试样例
  cases.push({ name: 'invalid-json', command: 'nutrition-target', bytes: Buffer.from('{"contractVersion":', 'utf8') });

  const ageCase = JSON.parse(JSON.stringify(pairs.pairs[0].request));
  ageCase.profile.ageYears = 200;
  // 注册 Native 与 WASM 字节级一致性比对测试样例
  cases.push({ name: 'invalid-ageYears', command: 'nutrition-target', bytes: Buffer.from(JSON.stringify(ageCase), 'utf8') });

  // PlanDay status paths: derived from the base request so the compared set covers
  // NoFeasible / NoFeasibleWithinBudget / LockConflict / NutritionDataInsufficient too.
  const planBase = JSON.parse(fs.readFileSync(PLAN, 'utf8'));

  const noFeasible = JSON.parse(JSON.stringify(planBase));
  noFeasible.state.windowLocks = [{ meal: 'breakfast', windowId: 'w-veg' }];
  // 注册 Native 与 WASM 字节级一致性比对测试样例
  cases.push({ name: 'plan-no-feasible', command: 'plan', bytes: Buffer.from(JSON.stringify(noFeasible), 'utf8') });

  const overBudget = JSON.parse(JSON.stringify(planBase));
  overBudget.plannerConfig.budgetCents = 1;
  // 注册 Native 与 WASM 字节级一致性比对测试样例
  cases.push({ name: 'plan-over-budget', command: 'plan', bytes: Buffer.from(JSON.stringify(overBudget), 'utf8') });

  const lockConflict = JSON.parse(JSON.stringify(planBase));
  lockConflict.state.itemLocks = [{ meal: 'lunch', offerId: 'offer-does-not-exist', quantity: 1 }];
  // 注册 Native 与 WASM 字节级一致性比对测试样例
  cases.push({ name: 'plan-lock-conflict', command: 'plan', bytes: Buffer.from(JSON.stringify(lockConflict), 'utf8') });

  const noNutrition = JSON.parse(JSON.stringify(planBase));
  for (const dish of noNutrition.catalog.dishes) {
    for (const key of ['energyKcal', 'proteinDg', 'fatDg', 'carbDg']) {
      dish.nutrition[key] = null;
    }
  }
  noNutrition.catalog.catalogHash = catalogHash(noNutrition.catalog);
  // 注册 Native 与 WASM 字节级一致性比对测试样例
  cases.push({ name: 'plan-nutrition-insufficient', command: 'plan', bytes: Buffer.from(JSON.stringify(noNutrition), 'utf8') });

  // OkPartial: lock a dish whose nutrition is unknown -> plan usable but incomplete
  const partial = JSON.parse(JSON.stringify(planBase));
  for (const dish of partial.catalog.dishes) {
    if (dish.dishId === 'dish-soup') {
      for (const key of ['energyKcal', 'proteinDg', 'fatDg', 'carbDg']) {
        dish.nutrition[key] = null;
      }
    }
  }
  partial.catalog.catalogHash = catalogHash(partial.catalog);
  partial.state.itemLocks = [{ meal: 'dinner', offerId: 'offer-soup', quantity: 1 }];
  // 注册 Native 与 WASM 字节级一致性比对测试样例
  cases.push({ name: 'plan-ok-partial', command: 'plan', bytes: Buffer.from(JSON.stringify(partial), 'utf8') });

  for (const item of cases) {
    const inputFile = writeCase(item.name, item.bytes);
    const nativeFile = path.join(NATIVE_OUT, `${item.name}.json`);
    const wasmFile = path.join(WASM_OUT, `${item.name}.json`);
    const nativeBytes = runNative(item.command, inputFile, nativeFile);
    const wasmBytes = callApi(core, item.command, item.bytes);
    fs.writeFileSync(wasmFile, wasmBytes);
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
  report.failures = failures;
  const reportPath = path.join(WORK, 'verify_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
  console.log('');
  console.log(`checks failed: ${failures}`);
  console.log('report ->', reportPath);
  return failures === 0 ? 0 : 1;
}

// 宿主辅助函数：readCString，按契约内存协议执行 WASM/CLI 调用与校验
function readCString(core, pointer) {
  const bytes = new Uint8Array(core.exports.memory.buffer);
  let end = pointer;
  while (end < bytes.length && bytes[end] !== 0) {
    end += 1;
  }
  return Buffer.from(bytes.slice(pointer, end)).toString('utf8');
}

process.exit(main());

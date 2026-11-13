// check_heap_growth.mjs - diagnostic: does repeated plan/nutrition calls grow the WASM heap?
//
// The core frees every per-request buffer, and the WASM allocator resets its break when the
// last live block is released. This script calls the API repeatedly in one instance and prints
// the memory size, so a true leak (monotonic growth) can be told apart from a one-time
// high-water mark (wasm memory never shrinks).
import fs from 'node:fs';
import path from 'node:path';

import { callApi, loadCore } from './host_wasm.mjs';

// 绑定关键上下文变量 ROOT，用于后续契约比对或子进程调用
const ROOT = path.resolve(process.cwd());
// 绑定关键上下文变量 WASM，用于后续契约比对或子进程调用
const WASM = path.resolve(ROOT, '..', '..', '.toolchain', 'build', 'wasm', 'mp_core.wasm');
// 绑定关键上下文变量 PAIRS，用于后续契约比对或子进程调用
const PAIRS = path.join(ROOT, 'Resources', '契约', 'T01-v1.2-candidate', 'request-result-pair.json');
// 绑定关键上下文变量 PLAN，用于后续契约比对或子进程调用
const PLAN = path.join(ROOT, 'Resources', '报告', 'T02-DSH-最小核心链路-证据-v1', 'inputs', 'plan-request-simulated.json');

// 绑定关键上下文变量 core，用于后续契约比对或子进程调用
const core = loadCore(WASM);
// 绑定关键上下文变量 pair，用于后续契约比对或子进程调用
const pair = JSON.parse(fs.readFileSync(PAIRS, 'utf8')).pairs[1].request;
// 绑定关键上下文变量 nutritionInput，用于后续契约比对或子进程调用
const nutritionInput = Buffer.from(JSON.stringify(pair), 'utf8');
// 绑定关键上下文变量 planInput，用于后续契约比对或子进程调用
const planInput = fs.readFileSync(PLAN);

// 宿主辅助函数：pages，按契约内存协议执行 WASM/CLI 调用与校验
function pages() {
  return core.exports.memory.buffer.byteLength / 65536;
}

// 宿主辅助函数：loop，按契约内存协议执行 WASM/CLI 调用与校验
function loop(label, command, input, times) {
  // 绑定关键上下文变量 seen，用于后续契约比对或子进程调用
  const seen = [];
  for (let i = 1; i <= times; i += 1) {
    callApi(core, command, input);
    if (i % 10 === 0) {
      seen.push(`${i}:${pages()}`);
    }
  }
  console.log(`${label}: ${seen.join(' ')}`);
  return { label, samples: seen, finalPages: pages() };
}

// 绑定关键上下文变量 results，用于后续契约比对或子进程调用
const results = [];
results.push(loop('nutrition-target x50', 'nutrition-target', nutritionInput, 50));
results.push(loop('plan x50', 'plan', planInput, 50));

// 绑定关键上下文变量 report，用于后续契约比对或子进程调用
const report = {
  node: process.version,
  wasm: WASM,
  results,
  verdict: 'see samples: flat tail means no per-call leak, only a high-water mark',
};
// 绑定关键上下文变量 out，用于后续契约比对或子进程调用
const out = path.resolve(ROOT, '..', '..', '.toolchain', 'build', 'wasm', 'heap_growth.json');
fs.writeFileSync(out, JSON.stringify(report, null, 2));
console.log('report ->', out);

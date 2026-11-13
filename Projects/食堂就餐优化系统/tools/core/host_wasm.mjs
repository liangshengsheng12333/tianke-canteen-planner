// host_wasm.mjs - minimal loader / caller for the mp_core.wasm module.
//
// The module is built with -target wasm32-freestanding -nostdlib, so it imports
// env.mp_monotonic_ms from the host: bind a monotonic millisecond clock.
//
// Memory ownership protocol (same as the native CLI):
//   input  : host calls mp_alloc(len) -> writes bytes -> calls mp_* -> mp_free(ptr) exactly once
//   output : core returns a result block; host reads the u32 length at +0,
//            COPIES the payload out, then calls mp_free(block) exactly once
//   mp_contract_version returns a static read-only pointer that must NOT be freed
//
// Result block layout: [u32 payloadLen][u32 reserved=0][UTF-8 JSON payload][NUL]
//
// CLI usage:
//   node tools/core/host_wasm.mjs <nutrition-target|plan|validate-menu> <input.json> [--out out.json]
import fs from 'node:fs';
import {performance} from 'node:perf_hooks';
import path from 'node:path';
import process from 'node:process';

export const API_NAMES = [
  'mp_api_version',
  'mp_contract_version',
  'mp_alloc',
  'mp_free',
  'mp_plan',
  'mp_nutrition_target',
  'mp_validate_menu',
];

// 宿主辅助函数：loadCore，按契约内存协议执行 WASM/CLI 调用与校验
export function loadCore(wasmPath) {
  // 绑定关键上下文变量 bytes，用于后续契约比对或子进程调用
  const bytes = fs.readFileSync(wasmPath);
  // 绑定关键上下文变量 module，用于后续契约比对或子进程调用
  const module = new WebAssembly.Module(bytes);
  // 绑定关键上下文变量 imports，用于后续契约比对或子进程调用
  const imports = WebAssembly.Module.imports(module);
  // 绑定关键上下文变量 exportList，用于后续契约比对或子进程调用
  const exportList = WebAssembly.Module.exports(module).map((entry) => `${entry.name}:${entry.kind}`);
  // 绑定关键上下文变量 instance，用于后续契约比对或子进程调用
  const instance = new WebAssembly.Instance(module, { env: { mp_monotonic_ms: () => performance.now() } });
  // 绑定关键上下文变量 exports，用于后续契约比对或子进程调用
  const exports = instance.exports;
  for (const name of API_NAMES) {
    if (typeof exports[name] !== 'function') {
      throw new Error(`missing export: ${name}`);
    }
  }
  if (!exports.memory) {
    throw new Error('module does not export memory');
  }
  return { bytes, module, instance, exports, imports, exportList };
}

// 绑定关键上下文变量 ENTRY_BY_COMMAND，用于后续契约比对或子进程调用
const ENTRY_BY_COMMAND = {
  'nutrition-target': 'mp_nutrition_target',
  plan: 'mp_plan',
  'validate-menu': 'mp_validate_menu',
};

// Runs one request through the module and returns the copied output bytes.
// Frees the input buffer and the result block exactly once.
export function callApi(core, command, inputBytes) {
  // 绑定关键上下文变量 entryName，用于后续契约比对或子进程调用
  const entryName = ENTRY_BY_COMMAND[command];
  if (!entryName) {
    throw new Error(`unknown command: ${command}`);
  }
  const { exports } = core;
  // 绑定关键上下文变量 input，用于后续契约比对或子进程调用
  const input = new Uint8Array(inputBytes);
  // 绑定关键上下文变量 inputPtr，用于后续契约比对或子进程调用
  const inputPtr = exports.mp_alloc(input.length);
  if (inputPtr === 0) {
    throw new Error('mp_alloc returned 0 for input buffer (real allocation failure)');
  }
  try {
    new Uint8Array(exports.memory.buffer, inputPtr, input.length).set(input);
    // 绑定关键上下文变量 block，用于后续契约比对或子进程调用
    const block = exports[entryName](inputPtr, input.length);
    if (block === 0) {
      throw new Error('core returned 0 result block (real allocation failure)');
    }
    try {
      const view = new DataView(exports.memory.buffer);
      const payloadLength = view.getUint32(block, true);
      const payload = new Uint8Array(exports.memory.buffer, block + 8, payloadLength);
      return Buffer.from(payload);  // copy into host memory before freeing
    } finally {
      exports.mp_free(block);        // output freed exactly once
    }
  } finally {
    exports.mp_free(inputPtr);       // input freed exactly once
  }
}

// 宿主辅助函数：main，按契约内存协议执行 WASM/CLI 调用与校验
export function main(argv) {
  // 绑定关键上下文变量 args，用于后续契约比对或子进程调用
  const args = argv.slice(2);
  if (args.length < 2) {
    console.error('usage: node tools/core/host_wasm.mjs <nutrition-target|plan|validate-menu> <input.json> [--out out.json]');
    return 2;
  }
  // 绑定关键上下文变量 command，用于后续契约比对或子进程调用
  const command = args[0];
  // 绑定关键上下文变量 inputPath，用于后续契约比对或子进程调用
  const inputPath = args[1];
  // 绑定关键上下文变量 outputPath，用于后续契约比对或子进程调用
  let outputPath = null;
  for (let i = 2; i < args.length; i += 1) {
    if (args[i] === '--out' && i + 1 < args.length) {
      outputPath = args[i + 1];
      i += 1;
    }
  }
  // 绑定关键上下文变量 wasmPath，用于后续契约比对或子进程调用
  const wasmPath = process.env.MP_WASM_PATH ??
    path.resolve(process.cwd(), '..', '..', '.toolchain', 'build', 'wasm', 'mp_core.wasm');
  // 绑定关键上下文变量 core，用于后续契约比对或子进程调用
  const core = loadCore(wasmPath);
  // 绑定关键上下文变量 output，用于后续契约比对或子进程调用
  const output = callApi(core, command, fs.readFileSync(inputPath));
  if (outputPath) {
    fs.writeFileSync(outputPath, output);
  } else {
    process.stdout.write(output);
    process.stdout.write('\n');
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]?.replace(/\\/g, '/')}` || process.argv[1]?.endsWith('host_wasm.mjs')) {
  process.exit(main(process.argv));
}

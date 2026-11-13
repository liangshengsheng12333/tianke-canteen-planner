// probe-wasm-real.mjs — 在本地 Node 环境对小程序包内的真实 mp_core.wasm 进行加载与 ABI 探针。
//
// 依据提示词阶段 A 要求：验证 WASM 加载、导出核对、mp_alloc/mp_free 生命周期、静态版本串不释放、
// 线性内存增长后视图刷新，以及用 validate-menu 传入 {} 探测结果块布局。
//
// 注意：本脚本运行在 Node.js 环境，用于验证调用侧 bridge 与真实 WASM 字节之间的 ABI 契约兼容，
// 不代表微信开发者工具或真机实测（阶段 C 仍受工具/设备前置约束）。
//
// 运行：node tools/miniprogram/probe-wasm-real.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const miniprogram = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'miniprogram', 'src');
const importTs = (...segments) => import(pathToFileURL(path.join(miniprogram, ...segments)).href);
const { loadCore, probeAbi, REQUIRED_EXPORTS } = await importTs('utils', 'core-bridge.ts');

const wasmPath = path.join(miniprogram, 'assets', 'wasm', 'mp_core.wasm');
const wasmBytes = fs.readFileSync(wasmPath);

console.log('=== mp_core.wasm 实际载入与 ABI 探针 ===');
console.log(`文件路径: ${wasmPath}`);
console.log(`文件大小: ${wasmBytes.length} 字节`);

// 适配 loadCore 的 instantiate 接口：Node 下使用 WebAssembly.instantiate
const nodeInstantiate = async (p, imports) => {
  const bytes = fs.readFileSync(p);
  const module = new WebAssembly.Module(bytes);
  const instance = new WebAssembly.Instance(module, imports);
  return { instance };
};

const startTime = performance.now();
const core = await loadCore(nodeInstantiate, wasmPath);
const loadDurationMs = performance.now() - startTime;
console.log(`加载与导出核对耗时: ${loadDurationMs.toFixed(3)} ms`);

// 检查所有必需导出
for (const name of REQUIRED_EXPORTS) {
  if (typeof core.exports[name] !== 'function') {
    throw new Error(`缺少函数导出: ${name}`);
  }
}
if (!core.exports.memory || !core.exports.memory.buffer) {
  throw new Error('缺少线性内存导出 memory');
}
console.log(`必需导出检查通过: ${REQUIRED_EXPORTS.join(', ')}, memory`);

// 运行 ABI 探针
const probe = probeAbi(core);
console.log('ABI 探针结果:');
console.log(`  mp_api_version: ${probe.apiVersion}`);
console.log(`  mp_contract_version: ${probe.contractVersion}`);
console.log(`  内存探测前: ${probe.memoryBytesBefore} 字节 (${probe.memoryBytesBefore / 65536} 页)`);
console.log(`  内存探测后: ${probe.memoryBytesAfter} 字节 (${probe.memoryBytesAfter / 65536} 页)`);
console.log(`  探针缓冲区指针: ${probe.allocPtr}`);
console.log(`  写入并读回一致: ${probe.allocWriteReadOk}`);
console.log(`  结果块探测响应 (前 200 字节): ${probe.resultBlockProbeText.slice(0, 200)}`);

if (probe.apiVersion !== 1) {
  throw new Error(`API 版本不符预期: 期望 1，实际 ${probe.apiVersion}`);
}
if (probe.contractVersion !== '1.0') {
  throw new Error(`契约版本不符预期: 期望 1.0，实际 ${probe.contractVersion}`);
}
if (!probe.allocWriteReadOk) {
  throw new Error('探针内存写入并读回不一致');
}

console.log('=== 阶段 A 真实 WASM ABI 探针全部通过 ===');

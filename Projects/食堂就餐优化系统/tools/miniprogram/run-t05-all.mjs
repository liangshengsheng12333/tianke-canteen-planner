// run-t05-all.mjs — T05 测试总入口：串行运行 tools/miniprogram/test-t05-*.mjs。
//
// 为什么不用 `node --test`：本机沙箱禁止 node:test 用管道 spawn 子进程（spawn EPERM），
// 而 `--test` 的默认行为正是为每个测试文件起子进程。这里改为本脚本自己按文件顺序
// spawnSync(process.execPath, ...)，stdio 用 'inherit'（沙箱允许继承式 stdio，不允许管道），
// 这样每个测试文件仍是独立进程（互不污染 globalThis.wx / WASM 单例），输出直接进终端，
// 退出码汇总：任一文件失败 → 整体退出码 1。
//
// 单文件运行方式（调试用）同样保留：
//   node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-t05-modules.mjs
//   node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-t05-store.mjs
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { writeEvidenceJson } from './t05-test-helpers.mjs';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(toolsDir, '..', '..');
const registerPath = path.join(toolsDir, 'register-ts.mjs');
// Windows 绝对路径必须转成 file:// URL 才能作为 --import / 入口传给 ESM 加载器。
const registerUrl = pathToFileURL(registerPath).href;

const files = fs
  .readdirSync(toolsDir)
  .filter((name) => /^test-t05-.+\.mjs$/.test(name))
  .sort();

if (files.length === 0) {
  console.error('未找到任何 test-t05-*.mjs 测试文件');
  process.exit(1);
}

const summary = [];
const startedAt = new Date().toISOString();
for (const file of files) {
  console.log(`\n${'='.repeat(78)}\n▶ ${file}\n${'='.repeat(78)}`);
  const start = Date.now();
  // 入口用相对路径（相对 projectRoot cwd）；--import 用 file:// URL（ESM 加载器要求）。
  const entry = path.join('tools', 'miniprogram', file);
  const result = spawnSync(process.execPath, ['--import', registerUrl, entry], {
    cwd: projectRoot,
    stdio: 'inherit',
  });
  const durationMs = Date.now() - start;
  const ok = result.status === 0;
  summary.push({ file, ok, status: result.status, durationMs });
}

console.log(`\n${'='.repeat(78)}\n=== T05 测试文件汇总（Node ${process.version}，单进程入口串行调度）===\n${'='.repeat(78)}`);
for (const row of summary) {
  console.log(`${row.ok ? 'PASS' : 'FAIL'}  ${row.file.padEnd(28)}  ${String(row.durationMs).padStart(6)} ms  (exit ${row.status})`);
}
const failed = summary.filter((row) => !row.ok).length;
console.log(`\n结果：${summary.length - failed} / ${summary.length} 个测试文件通过`);

const evidencePath = writeEvidenceJson(`run-t05-all-${startedAt.replace(/[:.]/g, '-')}.json`, {
  tool: 'run-t05-all.mjs',
  startedAt,
  finishedAt: new Date().toISOString(),
  nodeVersion: process.version,
  files: summary,
  passedFiles: summary.length - failed,
  failedFiles: failed,
});
console.log(`汇总 JSON：${evidencePath}`);

process.exit(failed === 0 ? 0 : 1);

// candidate-manifest.mjs — 冻结候选清单：逐文件 SHA256 + 文件数/字节数统计 + WASM 身份。
//
// 用途：交付反馈里“源码/工具/WASM 哈希”可复核，且不依赖 git（本项目未用 git 管理）。
// 口径：
//   1) miniprogram/src 下所有文件（含 wxml/wxss/json/ts/wasm/assets），逐文件 sha256；
//   2) tools/miniprogram 下所有文件（测试/证据工具，含本脚本自身）；
//   3) 包内 WASM 单独校验固定身份（111,554 字节 / 固定 SHA256）。
// 输出：JSON（机器可读）+ 排序后的 "sha256␣␣相对路径" 文本清单。
//
// 运行：node tools/miniprogram/candidate-manifest.mjs [--out <dir>]
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(here, '..', '..');
const srcRoot = path.join(projectRoot, 'miniprogram', 'src');
const toolsRoot = path.join(projectRoot, 'tools', 'miniprogram');

const FROZEN_WASM = {
  relPath: 'miniprogram/src/assets/wasm/mp_core.wasm',
  bytes: 111554,
  sha256: 'B0098453B7251C2FF39C65B3DF932E7E15975E4252A036196EBF63638A3DC5DD',
};

function walk(root) {
  const out = [];
  const stack = [root];
  while (stack.length > 0) {
    const dir = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) stack.push(full);
      else if (entry.isFile()) out.push(full);
    }
  }
  return out.sort();
}

function hashFile(file) {
  const bytes = fs.readFileSync(file);
  return {
    relPath: path.relative(projectRoot, file).split(path.sep).join('/'),
    bytes: bytes.length,
    sha256: createHash('sha256').update(bytes).digest('hex'),
  };
}

const srcFiles = walk(srcRoot).map(hashFile);
const toolFiles = walk(toolsRoot).map(hashFile);
const wasm = srcFiles.find((file) => file.relPath === FROZEN_WASM.relPath);
const wasmOk = !!wasm && wasm.bytes === FROZEN_WASM.bytes && wasm.sha256.toUpperCase() === FROZEN_WASM.sha256;

// 候选标识：源码树整体摘要（按相对路径排序后，对 "sha256 path" 行再取 sha256）。
const treeDigestInput = srcFiles.map((file) => `${file.sha256}  ${file.relPath}`).join('\n') + '\n';
const treeDigest = createHash('sha256').update(treeDigestInput).digest('hex');

const manifest = {
  generatedAt: new Date().toISOString(),
  projectRoot,
  candidate: {
    sourceTreeDigest: `sha256:${treeDigest}`,
    sourceFileCount: srcFiles.length,
    sourceBytes: srcFiles.reduce((sum, file) => sum + file.bytes, 0),
    toolFileCount: toolFiles.length,
    toolBytes: toolFiles.reduce((sum, file) => sum + file.bytes, 0),
  },
  frozenWasm: { ...FROZEN_WASM, observed: wasm || null, matchesFrozen: wasmOk },
  files: { miniprogramSrc: srcFiles, toolsMiniprogram: toolFiles },
};
if (!wasmOk) {
  console.error('FROZEN WASM IDENTITY MISMATCH — do not freeze this candidate');
}

const outIndex = process.argv.indexOf('--out');
const outDir = outIndex >= 0 ? process.argv[outIndex + 1] : null;
const text = [
  `# candidate sourceTreeDigest: sha256:${treeDigest}`,
  `# generatedAt: ${manifest.generatedAt}`,
  `# miniprogram/src files: ${srcFiles.length} (${manifest.candidate.sourceBytes} bytes)`,
  `# tools/miniprogram files: ${toolFiles.length} (${manifest.candidate.toolBytes} bytes)`,
  `# frozen WASM: ${FROZEN_WASM.relPath} ${FROZEN_WASM.bytes} bytes ${FROZEN_WASM.sha256} matches=${wasmOk}`,
  ...srcFiles.map((file) => `${file.sha256}  ${file.relPath}`),
  ...toolFiles.map((file) => `${file.sha256}  ${file.relPath}`),
].join('\n') + '\n';

if (outDir) {
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(path.join(outDir, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', 'utf8');
  fs.writeFileSync(path.join(outDir, 'hashes.sha256'), text, 'utf8');
  console.log(`manifest written: ${path.join(outDir, 'manifest.json')}`);
}
console.log(JSON.stringify({ candidate: manifest.candidate, frozenWasmMatches: wasmOk, outDir }, null, 2));
if (!wasmOk) process.exitCode = 1;
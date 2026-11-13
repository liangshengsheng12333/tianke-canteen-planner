// typecheck-src.mjs — 用本机已安装的 TypeScript（微信开发者工具自带 4.1.2 /
// Antigravity IDE 自带 5.x）对 miniprogram/src 做 noEmit 类型检查，作为微信编译之外的
// 静态证据。不安装依赖、不写 tsconfig、不影响开发者工具构建。
//
// 运行：node tools/miniprogram/typecheck-src.mjs
// 说明：这不是微信 WXML/WXSS 编译，也不能替代开发者工具/真机验证。
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const srcRoot = path.join(projectRoot, 'miniprogram', 'src');

const compilers = {
  'wechat-devtools': 'D:\\微信小程序\\微信web开发者工具\\resources\\vsextensions\\node_modules\\typescript\\lib\\typescript.js',
  'antigravity-ide': path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Antigravity IDE', 'resources', 'app', 'extensions', 'node_modules', 'typescript', 'lib', 'typescript.js'),
};

function collect(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      collect(full, out);
    } else if (entry.name.endsWith('.ts')) {
      out.push(full);
    }
  }
  return out;
}

const files = collect(srcRoot, []);
const options = {
  target: 7, // ES2020
  module: 99, // ESNext
  moduleResolution: 2, // Node（微信工具自带 TS 4.1 不支持 Bundler）
  strict: false,
  noImplicitThis: false,
  skipLibCheck: true,
  noEmit: true,
  allowJs: false,
  lib: ['lib.es2020.d.ts', 'lib.dom.d.ts'],
  types: [],
  baseUrl: srcRoot,
};

let failed = 0;
for (const [label, compilerPath] of Object.entries(compilers)) {
  if (!fs.existsSync(compilerPath)) {
    console.log(`[skip] ${label}: 找不到 ${compilerPath}`);
    continue;
  }
  const ts = require(compilerPath);
  console.log(`=== ${label} (TypeScript ${ts.version}) ===`);
  const program = ts.createProgram(files, options);
  const diagnostics = ts.getPreEmitDiagnostics(program);
  for (const diagnostic of diagnostics) {
    const message = ts.flattenDiagnosticMessageText(diagnostic.messageText, ' ');
    if (diagnostic.file && diagnostic.start !== undefined) {
      const position = diagnostic.file.getLineAndCharacterOfPosition(diagnostic.start);
      const fileLabel = path.relative(projectRoot, diagnostic.file.fileName);
      console.log(`${fileLabel}:${position.line + 1}:${position.character + 1} TS${diagnostic.code}: ${message}`);
    } else {
      console.log(`TS${diagnostic.code}: ${message}`);
    }
  }
  console.log(diagnostics.length === 0 ? `0 errors across ${files.length} files` : `${diagnostics.length} diagnostics`);
  failed += diagnostics.length;
}
process.exitCode = failed === 0 ? 0 : 1;

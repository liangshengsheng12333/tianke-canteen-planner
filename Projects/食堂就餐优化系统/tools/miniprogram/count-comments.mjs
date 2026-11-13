// count-comments.mjs — T01 v1.2 §12 注释率口径的本地计数（自写 TS，排除生成物/复制数据）。
//
// 口径：分母 = 非空且非注释的代码行；分子 = 有效注释行（// 与 /* */ 内的行）。
// 排除：src/mock/simulated-inputs.ts（gen-sim-inputs.mjs 生成）、
//       src/config/*（nutrition-config.ts 为 T01 冻结快照副本、simulated-menu.ts 为 T02 夹具数据）、
//       src/types.d.ts（环境声明）、assets/wasm（二进制）。
// 运行：node tools/miniprogram/count-comments.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const srcRoot = path.join(projectRoot, 'miniprogram', 'src');

const EXCLUDED = new Set([
  'mock/simulated-inputs.ts',
  'types.d.ts',
]);
const EXCLUDED_DIRS = ['config', 'assets', 'mock'];

function collect(dir, out) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const relative = path.relative(srcRoot, full).split(path.sep).join('/');
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.indexOf(relative.split('/')[0]) >= 0) continue;
      collect(full, out);
    } else if (entry.name.endsWith('.ts') && !EXCLUDED.has(relative)) {
      out.push(full);
    }
  }
  return out;
}

function countFile(file) {
  const text = fs.readFileSync(file, 'utf8');
  const lines = text.split(/\r?\n/);
  let comment = 0;
  let code = 0;
  let blank = 0;
  let inBlock = false;
  for (const raw of lines) {
    const line = raw.trim();
    if (line === '') {
      blank += 1;
      continue;
    }
    if (inBlock) {
      comment += 1;
      if (line.indexOf('*/') >= 0) inBlock = false;
      continue;
    }
    if (line.startsWith('//')) {
      comment += 1;
      continue;
    }
    if (line.startsWith('/*')) {
      comment += 1;
      if (line.indexOf('*/') < 0) inBlock = true;
      continue;
    }
    // 行尾注释不把整行算成注释（保守口径：只有整行注释计入分子）。
    code += 1;
  }
  return { comment, code, blank };
}

const files = collect(srcRoot, []).sort();
const rows = [];
let totalComment = 0;
let totalCode = 0;
for (const file of files) {
  const counts = countFile(file);
  totalComment += counts.comment;
  totalCode += counts.code;
  rows.push({
    file: path.relative(projectRoot, file),
    comment: counts.comment,
    code: counts.code,
    blank: counts.blank,
    ratio: counts.code === 0 ? 0 : (counts.comment / counts.code) * 100,
  });
}
console.log('| 文件 | 注释行 | 代码行 | 空行 | 注释率(注释/代码) |');
console.log('|---|---|---|---|---|');
for (const row of rows) {
  console.log(`| ${row.file} | ${row.comment} | ${row.code} | ${row.blank} | ${row.ratio.toFixed(1)}% |`);
}
const totalRatio = totalCode === 0 ? 0 : (totalComment / totalCode) * 100;
console.log(`\n合计：注释 ${totalComment} 行，代码 ${totalCode} 行，注释率 ${totalRatio.toFixed(1)}%（口径：整行注释 / 非空非注释代码行）`);
console.log('排除：src/mock/**（生成夹具）、src/config/**（冻结快照副本与模拟菜单数据）、src/types.d.ts（环境声明）、src/assets/wasm（二进制）。');

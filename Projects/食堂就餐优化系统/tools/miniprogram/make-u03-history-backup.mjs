// make-u03-history-backup.mjs — 生成 T05U03 月历/回看用的“模拟多日数据”备份文件。
//
// 为什么用备份恢复：记录页的历史日期只读，没法在界面上补录过去几天；
// 而“恢复备份”是应用已有的真实入口，恢复后会走 parseBackupText / validateState 全套校验，
// 比直接改内存状态更接近真实数据路径，也能顺便验证历史快照的只读回看。
//
// 数据全部为显式模拟：菜名快照来自模拟菜单；其中“黑椒土豆泥盖饭（模拟历史快照）”故意使用
// 当前菜单里不存在的名字，用来证明历史详情读的是记录快照而不是当前菜单。
//
// 运行：node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/make-u03-history-backup.mjs
//   可选：--state <input.json> --out <backup.json> --args-out <args.json>
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const canonical = await import(pathToFileURL(path.join(projectRoot, 'miniprogram', 'src', 'utils', 'canonical-json.ts')).href);

function argOf(flag, fallback) {
  const index = process.argv.indexOf(flag);
  return index >= 0 && process.argv[index + 1] ? process.argv[index + 1] : fallback;
}

const evidenceDir = path.join(projectRoot, 'Resources', '报告', 'T05U03-DSH-记录月历与回看-证据-v1', '03-原始数据');
const statePath = argOf('--state', path.join(evidenceDir, '01-模拟数据生成前-state.json'));
const backupPath = argOf('--out', path.join(evidenceDir, '02-模拟多日备份.json'));
const argsOutPath = argOf('--args-out', path.join(evidenceDir, '03-恢复粘贴参数.json'));

const state = JSON.parse(fs.readFileSync(statePath, 'utf8').replace(/^\uFEFF/, ''));

// ===== 模拟记录构造 =====
function item(name, priceCents, nutrition, overrides = {}) {
  return Object.assign(
    {
      itemKey: `manual:${name}`,
      source: 'manual',
      offerId: null,
      dishId: null,
      menuVersion: null,
      nameSnapshot: name,
      portionCode: 'full',
      quantity: 1,
      unitPriceCents: priceCents,
      priceKnown: priceCents !== null,
      nutrition,
      nutritionBasis: null,
      note: null,
    },
    overrides,
  );
}
function log(recordId, date, meal, items, overrides = {}) {
  const stamp = `${date}T04:10:00.000Z`;
  return Object.assign(
    {
      contractVersion: '1.0',
      recordId,
      confirmationId: `conf-manual-${date}-${meal}-${recordId}`,
      businessDate: date,
      tzOffsetMinutes: 480,
      meal,
      status: 'active',
      revision: 1,
      supersedesRecordId: null,
      revokedByRecordId: null,
      createdAt: stamp,
      updatedAt: stamp,
      menuVersion: 'menu-simulated-v1',
      items,
    },
    overrides,
  );
}
function emptyDay(date) {
  return { businessDate: date, tzOffsetMinutes: 480, soldOut: [], windowLocks: [], itemLocks: [], endedMeals: [], logs: [], plan: null, selectedPlanIndex: 0 };
}

const RICE = { energyKcal: 232, proteinDg: 44, fatDg: 6, carbDg: 516 };
const SOYMILK = { energyKcal: 140, proteinDg: 60, fatDg: 50, carbDg: 110 };
const MANTOU = { energyKcal: 220, proteinDg: 70, fatDg: 10, carbDg: 470 };
const SOUP = { energyKcal: 60, proteinDg: 30, fatDg: 25, carbDg: 40 };
const CHICKEN = { energyKcal: 165, proteinDg: 310, fatDg: 36, carbDg: 0 };
const GREENS = { energyKcal: 80, proteinDg: 20, fatDg: 50, carbDg: 60 };
const MASH = { energyKcal: 350, proteinDg: 90, fatDg: 120, carbDg: 420 };

// 10-19：早餐（一条已撤销 + 一条有效）+ 晚餐，共 2 餐；已撤销那条不得计入统计。
state.days['2026-10-19'] = emptyDay('2026-10-19');
state.days['2026-10-19'].logs = [
  log('rec-u03-1019-b-revoked', '2026-10-19', 'breakfast', [item('米饭', 100, RICE)], { status: 'revoked', revokedByRecordId: 'rec-u03-1019-b' }),
  log('rec-u03-1019-b', '2026-10-19', 'breakfast', [item('豆浆', 150, SOYMILK), item('馒头', 100, MANTOU)]),
  log('rec-u03-1019-d', '2026-10-19', 'dinner', [item('米饭', 100, RICE), item('番茄蛋汤', 200, SOUP)]),
];

// 10-20：午餐（含当前菜单没有的历史快照菜名）+ 晚餐，共 2 餐。
state.days['2026-10-20'] = emptyDay('2026-10-20');
state.days['2026-10-20'].logs = [
  log('rec-u03-1020-l', '2026-10-20', 'lunch', [
    item('清蒸鸡胸', 800, CHICKEN),
    item('米饭', 100, RICE),
    item('黑椒土豆泥盖饭（模拟历史快照）', 300, MASH),
  ]),
  log('rec-u03-1020-d', '2026-10-20', 'dinner', [item('清炒青菜', 400, GREENS), item('米饭', 100, RICE)]),
];

// 10-21（今天）保持应用里真实产生的“酸奶（营养未知）”记录，不虚构已知值。
const today = state.days['2026-10-21'];
if (!today) {
  throw new Error('输入状态里没有今天 2026-10-21 的日期桶，脚本假定与证据采集时一致');
}

// ===== 组装备份包络（digest 必须按应用自己的规范化摘要算法计算） =====
const digest = canonical.canonicalSha256(state);
const bundle = {
  format: 'tiankeshike-backup',
  bundleVersion: 1,
  appVersion: 't05-v1',
  exportedAt: new Date().toISOString(),
  state,
  digest,
};
const text = JSON.stringify(bundle);

fs.writeFileSync(backupPath, text, 'utf8');
// callMethod 的参数是“方法实参数组”；onRestoreInput 只接收一个事件对象。
fs.writeFileSync(argsOutPath, JSON.stringify([{ detail: { value: text } }]), 'utf8');

const dayCount = Object.keys(state.days).filter((date) => date.slice(0, 7) === '2026-10').length;
let meals = 0;
let knownPrice = 0;
let knownEnergy = 0;
for (const date of Object.keys(state.days).sort()) {
  if (date.slice(0, 7) !== '2026-10') continue;
  const seen = new Set();
  for (const record of state.days[date].logs) {
    if (record.status !== 'active') continue;
    seen.add(record.meal);
    for (const it of record.items) {
      if (it.priceKnown && it.unitPriceCents !== null) knownPrice += it.unitPriceCents * it.quantity;
      if (it.nutrition) knownEnergy += it.nutrition.energyKcal * it.quantity;
    }
  }
  meals += seen.size;
}

console.log(`state=${statePath}`);
console.log(`backup=${backupPath} (${text.length} chars, digest=${digest})`);
console.log(`args=${argsOutPath} (${fs.statSync(argsOutPath).size} bytes)`);
console.log(`预期月汇总：${dayCount} 天 · ${meals} 餐；已知花费 ${knownPrice} 分；已知热量 ${knownEnergy} kcal（10-21 酸奶营养未知 → 含未填项）`);
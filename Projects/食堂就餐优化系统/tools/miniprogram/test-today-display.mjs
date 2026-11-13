// test-today-display.mjs — T05U02 今日页展示层的本地单元验证（Node 直跑 TS，不是微信运行时证据）。
//
// 覆盖：显示模式默认值/保存/写入失败/回读不一致、时间→餐次提示边界、
// 热量“约/未知/待补全”、搭配说明的已知类别规则、完整模式比例（契约单位、最大余数法、
// 合计 100.0%、T=0、缺项、负值）与克数格式化。
// 运行：node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-today-display.mjs
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const utilsRoot = path.join(projectRoot, 'miniprogram', 'src', 'utils');

let passed = 0;
const failures = [];
function check(name, condition, detail) {
  if (condition) {
    passed += 1;
    console.log(`[PASS] ${name}`);
  } else {
    failures.push(name);
    console.log(`[FAIL] ${name}${detail ? ` — ${detail}` : ''}`);
  }
}

/** 每个用例用独立模块实例（查询串绕过 ESM 缓存），避免存储桩状态串味。 */
let instanceSeq = 0;
async function loadModule(file) {
  instanceSeq += 1;
  return import(`${pathToFileURL(path.join(utilsRoot, file)).href}?case=${instanceSeq}`);
}

/** 安装可控 wx 存储桩：记录写入、支持写入抛错与“回读值被篡改”。 */
function installWxStub() {
  const storage = new Map();
  const control = { storage, writeThrows: false, tamperValue: null, writes: [] };
  globalThis.wx = {
    getStorageSync(key) {
      return storage.has(key) ? storage.get(key) : '';
    },
    setStorageSync(key, value) {
      control.writes.push({ key, value });
      if (control.writeThrows) {
        throw new Error('storage full');
      }
      storage.set(key, control.tamperValue === null ? value : control.tamperValue);
    },
    showToast() {},
  };
  return control;
}

// ===== 1. 显示模式：默认、非法值、保存、失败、回读不一致 =====
{
  installWxStub();
  const mode = await loadModule('display-mode.ts');
  check('显示模式默认简易', mode.loadDisplayMode() === 'simple');
  check('非法显示模式回退简易', mode.normalizeDisplayMode('dev') === null);
  check('时间 9 点提示早餐', mode.suggestedMealByTime(9) === 'breakfast');
  check('时间 10 点提示午餐', mode.suggestedMealByTime(10) === 'lunch');
  check('时间 14 点提示午餐', mode.suggestedMealByTime(14) === 'lunch');
  check('时间 15 点提示晚餐', mode.suggestedMealByTime(15) === 'dinner');

  const control = installWxStub();
  check('保存完整模式成功', mode.saveDisplayMode('full') === true);
  check('保存后回读为完整', mode.loadDisplayMode() === 'full');
  check('未写入外观键', control.storage.has('tk.ui.appearance.v1') === false);
  check('显示模式键独立', control.storage.has('tk.ui.displayMode.v1') === true);
  check('简易/完整互转', mode.otherDisplayMode('simple') === 'full' && mode.otherDisplayMode('full') === 'simple');

  installWxStub().writeThrows = true;
  check('写入失败返回 false', mode.saveDisplayMode('simple') === false);

  const tamper = installWxStub();
  tamper.tamperValue = 'simple';
  check('回读不一致返回 false', mode.saveDisplayMode('full') === false);
  check('回读不一致不谎称已保存', mode.loadDisplayMode() === 'simple');

  installWxStub();
  wx.setStorageSync('tk.ui.displayMode.v1', 'bogus');
  check('存储中非法值回退简易', mode.loadDisplayMode() === 'simple');
}

// ===== 2. 热量展示 =====
{
  const nutrition = await loadModule('nutrition-display.ts');
  const known = nutrition.energyDisplay(600, false);
  check('已知热量无“约”', known.text === '600 千卡' && known.unknown === false);
  const estimated = nutrition.energyDisplay(600, true);
  check('估算热量标“约”', estimated.text === '约 600 千卡' && estimated.estimated === true);
  const unknown = nutrition.energyDisplay(null, false);
  check('未知热量写待补全', unknown.text === '热量待补全' && unknown.unknown === true);
  const negative = nutrition.energyDisplay(-5, false);
  check('负热量不显示 0', negative.text === '热量待补全' && negative.unknown === true);
  check('克数格式化去掉 .0', nutrition.formatGramsFromDg(300) === '30');
  check('克数格式化保留一位小数', nutrition.formatGramsFromDg(315) === '31.5');
  check('克数未知写待补全', nutrition.formatGramsFromDg(null) === '待补全');
}

// ===== 3. 搭配说明只按已知类别 =====
{
  const nutrition = await loadModule('nutrition-display.ts');
  check(
    '三类已知：都有',
    nutrition.pairingText(['staple', 'protein', 'vegetable']) === '主食、蛋白质食物、蔬菜都有',
  );
  check(
    '数据完整缺蔬菜',
    nutrition.pairingText(['staple', 'protein']) === '这份没配蔬菜',
  );
  check(
    '类别不完整写待补',
    nutrition.pairingText(['staple', null, 'vegetable']) === '搭配信息待补',
  );
  check('无菜品写待补', nutrition.pairingText([]) === '搭配信息待补');
  check(
    '未知类别不猜',
    nutrition.pairingText(['dessert', 'staple', 'protein']) === '搭配信息待补',
  );
  check(
    '已知类别提示',
    nutrition.knownCategoriesHint(['staple', 'protein', null]).indexOf('主食') >= 0,
  );
}

// ===== 4. 完整模式比例：契约单位 + 最大余数 + 边界 =====
{
  const nutrition = await loadModule('nutrition-display.ts');
  // 4×30 + 9×20 + 4×75 = 600 → 20% / 30% / 50%
  // 注意契约单位是 dg（0.1g）：300dg=30g → P=4×300=1200；合计 6000（即 600 千卡的 10 倍单位）。
  const complete = nutrition.buildMacroShares(
    { energyKcal: 600, proteinDg: 300, fatDg: 200, carbDg: 750 },
    [],
  );
  check('三项全已知状态 complete', complete.state === 'complete');
  check('比例按契约单位 4/9/4 换算', complete.totalEnergy === 6000);
  check(
    '比例 20.0/30.0/50.0',
    complete.rows.map((row) => row.percentText).join(',') === '20.0%,30.0%,50.0%',
  );
  check(
    '比例条与表格同源',
    complete.rows.map((row) => row.barPercent).join(',') === '20,30,50' && complete.showBar === true,
  );

  // 三项均等（P=4×9=36、F=9×4=36、C=4×9=36）：1000 个千分点无法三等分，
  // 最大余数法按“蛋白质→脂肪→碳水”优先 → 33.4/33.3/33.3
  const tie = nutrition.buildMacroShares(
    { energyKcal: 0, proteinDg: 9, fatDg: 4, carbDg: 9 },
    [],
  );
  check('合计恒为 100.0%', tie.rows.reduce((sum, row) => sum + row.barPercent, 0).toFixed(1) === '100.0');
  check('均等三项为 33.4/33.3/33.3', tie.rows.map((row) => row.percentText).join(',') === '33.4%,33.3%,33.3%');
  const tenths = nutrition.allocatePercentTenths([1, 1, 1]);
  check('同余数按蛋白质优先', tenths.join(',') === '334,333,333');

  // 朴素四舍五入会得到 33.3+33.3+33.4 这类合计问题；这里必须仍为 100.0%
  const rounded = nutrition.allocatePercentTenths([120, 180, 300]);
  check('换算热量 120/180/300 分配合计 1000', rounded.reduce((a, b) => a + b, 0) === 1000);
  check('换算能量占比 20/30/50', rounded.join(',') === '200,300,500');

  // T=0：三项已知 0 克，不给比例
  const zero = nutrition.buildMacroShares(
    { energyKcal: 0, proteinDg: 0, fatDg: 0, carbDg: 0 },
    [],
  );
  check('T=0 状态 zero', zero.state === 'zero' && zero.showBar === false);
  check('T=0 仍显示 0 克', zero.rows.map((row) => row.gramsText).join(',') === '0,0,0');
  check('T=0 不显示比例文字', zero.note.indexOf('暂不显示比例') >= 0);

  // 缺项：已知值保留，缺项写待补全，不画满比例
  const incomplete = nutrition.buildMacroShares(
    { energyKcal: 600, proteinDg: 300, fatDg: 200, carbDg: 0 },
    ['carbDg'],
  );
  check('缺项状态 incomplete', incomplete.state === 'incomplete' && incomplete.showBar === false);
  check(
    '缺项保留已知、缺项待补全',
    incomplete.rows.map((row) => `${row.gramsText}/${row.percentText}`).join(',') ===
      '30/待补全,20/待补全,待补全/待补全',
  );

  // 负值/非有限数按无效处理
  const invalid = nutrition.buildMacroShares(
    { energyKcal: 600, proteinDg: -1, fatDg: 200, carbDg: 750 },
    [],
  );
  check('负值状态 invalid', invalid.state === 'invalid' && invalid.showBar === false);
  check('负值不给比例', invalid.rows.every((row) => row.percentText === '待补全'));

  const nan = nutrition.buildMacroShares(
    { energyKcal: 600, proteinDg: Number.NaN, fatDg: 200, carbDg: 750 },
    [],
  );
  check('非有限数按缺项处理', nan.state === 'incomplete' && nan.showBar === false);

  // 极端不整除：三项 1/1/2 换算后 4/9/8 → 合计 100.0%
  const uneven = nutrition.buildMacroShares(
    { energyKcal: 0, proteinDg: 1, fatDg: 1, carbDg: 2 },
    [],
  );
  check(
    '不整除场景合计 100.0%',
    uneven.rows.reduce((sum, row) => sum + Number(row.percentText.replace('%', '')), 0).toFixed(1) === '100.0',
  );
}

console.log('');
if (failures.length === 0) {
  console.log(`全部通过：${passed} 项（本地 Node 验证，不能替代微信开发者工具/真机）`);
} else {
  console.log(`失败 ${failures.length} 项：${failures.join('、')}`);
}
process.exitCode = failures.length === 0 ? 0 : 1;
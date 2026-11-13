// make-longname-menu.mjs — 生成本地验收用的“长菜名”模拟菜单（不修改官方/冻结模拟菜单）。
//
// 输入：Resources/报告/T02-DSH-最小核心链路-证据-v1/inputs/menu-simulated.json（冻结模拟菜单的影子快照）。
// 处理：只改菜名（dish-mantou / dish-greens）与 menuVersion，重新计算 catalogHash，
//       保留 canteen.name“模拟食堂（非真实菜单）”与 nutritionBasis.note=SIMULATED 的模拟标注。
// 输出：Resources/报告/T05U02-DSH-今日页双模式-证据-v1/03-原始数据/menu-longname-simulated.json
// 运行：node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/make-longname-menu.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const canonical = await import(
  pathToFileURL(path.join(projectRoot, 'miniprogram', 'src', 'utils', 'canonical-json.ts')).href
);

const inputPath = path.join(
  projectRoot,
  'Resources',
  '报告',
  'T02-DSH-最小核心链路-证据-v1',
  'inputs',
  'menu-simulated.json',
);
const outPath = path.join(
  projectRoot,
  'Resources',
  '报告',
  'T05U02-DSH-今日页双模式-证据-v1',
  '03-原始数据',
  'menu-longname-simulated.json',
);

const catalog = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
catalog.menuVersion = 'menu-simulated-longname-v1';
delete catalog.catalogHash;

const longName = '黑椒土豆炖牛腩配时令青菜和紫菜蛋花汤加量不加价超值套餐';
for (const dish of catalog.dishes) {
  if (dish.dishId === 'dish-mantou') {
    dish.name = '黑椒土豆炖牛腩配时令青菜（早餐大份）';
  }
  if (dish.dishId === 'dish-greens') {
    dish.name = longName;
  }
  // 模拟标注必须保留：写入 fileNote 便于人工核对来源。
  dish.nutritionBasis.note = 'SIMULATED';
}
catalog.fileNote = 'SIMULATED：本文件仅用于长菜名排版自查，不是真实食堂菜单。';

catalog.catalogHash = canonical.canonicalSha256(catalog, 'catalogHash');
fs.writeFileSync(outPath, JSON.stringify(catalog, null, 2) + '\n', 'utf8');
console.log(`written ${outPath}`);
console.log(`catalogHash ${catalog.catalogHash}`);
console.log(`bytes ${fs.statSync(outPath).size}`);

// 精简版：只保留一餐规划所需的三类菜（主食/蛋白质/蔬菜），用于命令行参数长度受限时
// 通过菜单页“粘贴 → 预检 → 替换”的正式入口导入；仍是显式模拟数据。
const miniPath = path.join(path.dirname(outPath), 'menu-longname-mini-simulated.json');
const nutritionBasis = (portionAssumption) => ({
  source: 'simulated-reference',
  portionAssumption,
  estimated: true,
  note: 'SIMULATED',
});
const mini = {
  contractVersion: '1.0',
  menuVersion: 'menu-simulated-longname-mini-v1',
  canteen: { canteenId: 'canteen-sim', name: '模拟食堂（非真实菜单）' },
  windows: [{ windowId: 'w-main', name: '模拟主窗口', mealWindows: ['breakfast', 'lunch', 'dinner'] }],
  dishes: [
    {
      dishId: 'dish-rice',
      name: '米饭',
      kind: 'single',
      category: 'staple',
      riceDish: true,
      riceIncluded: false,
      nutrition: { energyKcal: 232, proteinDg: 44, fatDg: 6, carbDg: 516 },
      nutritionBasis: nutritionBasis('模拟 200g 熟米饭'),
    },
    {
      dishId: 'dish-chicken',
      name: '清蒸鸡胸',
      kind: 'single',
      category: 'protein',
      riceDish: false,
      riceIncluded: false,
      nutrition: { energyKcal: 165, proteinDg: 310, fatDg: 36, carbDg: 0 },
      nutritionBasis: nutritionBasis('模拟 100g 熟鸡胸'),
    },
    {
      dishId: 'dish-greens',
      name: longName,
      kind: 'single',
      category: 'vegetable',
      riceDish: false,
      riceIncluded: false,
      nutrition: { energyKcal: 80, proteinDg: 20, fatDg: 50, carbDg: 60 },
      nutritionBasis: nutritionBasis('模拟 150g 炒青菜'),
    },
  ],
  offers: [
    { offerId: 'offer-rice-full', dishId: 'dish-rice', windowId: 'w-main', mealWindows: ['breakfast', 'lunch', 'dinner'], portionCode: 'full', portionRatioNum: 1, portionRatioDen: 1, priceCents: 100, priceBasis: 'unitPrice' },
    { offerId: 'offer-chicken', dishId: 'dish-chicken', windowId: 'w-main', mealWindows: ['breakfast', 'lunch', 'dinner'], portionCode: 'full', portionRatioNum: 1, portionRatioDen: 1, priceCents: 800, priceBasis: 'unitPrice' },
    { offerId: 'offer-greens', dishId: 'dish-greens', windowId: 'w-main', mealWindows: ['breakfast', 'lunch', 'dinner'], portionCode: 'full', portionRatioNum: 1, portionRatioDen: 1, priceCents: 400, priceBasis: 'unitPrice' },
  ],
  comboRules: [],
  fileNote: 'SIMULATED：本文件仅用于长菜名排版自查，不是真实食堂菜单。',
};
mini.catalogHash = canonical.canonicalSha256(mini, 'catalogHash');
fs.writeFileSync(miniPath, JSON.stringify(mini, null, 2) + '\n', 'utf8');
console.log(`written ${miniPath}`);
console.log(`catalogHash ${mini.catalogHash}`);
console.log(`bytes ${fs.statSync(miniPath).size}`);
// make-choosefile-fixtures.mjs — 生成“选择文件→导入/恢复”真机/GUI 取证用的本地输入文件。
//
// 为什么需要：微信开发者工具的 wx.chooseMessageFile 会弹本机系统文件对话框，无法直接把
// 字符串喂给页面；必须先在磁盘上准备真实文件，再由对话框选中。文件放在纯 ASCII 路径，
// 避免 SendKeys 在中文路径上输入失败。
//
// 产物（默认 C:\Users\link\AppData\Local\Temp\t05v2-files\）：
//   menu-valid-multiwindow.json  —— 合法菜单，2 个窗口、同菜多报价；醒目标注“模拟（非真实菜单）”
//   menu-invalid.json            —— 非法 JSON（截断），用于验证失败不破坏原菜单
//   menu-bad-hash.json           —— 结构合法但 catalogHash 被篡改，用于核心校验失败
// 说明：menu-valid-multiwindow.json 缺省 catalogHash，由小程序按 T01 v1.2 规范补算；
//       不写真实菜名/价格，canteen 名称明确写“模拟（非真实菜单）”。
//
// 运行：node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/make-choosefile-fixtures.mjs
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { importTs, sha256Lower } from './t05-test-helpers.mjs';

const outDir = process.env.T05_FIXTURE_DIR || path.join(os.tmpdir(), 't05v2-files');
fs.mkdirSync(outDir, { recursive: true });

const { SIMULATED_CATALOG } = await importTs('config', 'simulated-menu.ts');

const catalog = JSON.parse(JSON.stringify(SIMULATED_CATALOG));
catalog.menuVersion = 'menu-simulated-v2-t05v2-import';
catalog.canteen = { canteenId: 'canteen-sim-t05v2', name: '模拟食堂（T05 选文件取证夹具·非真实菜单）' };
// 第二个窗口：只供应午/晚，给同一道菜另一份报价，用于同菜多报价/跨窗取证。
catalog.windows.push({ windowId: 'w-second', name: '模拟第二窗口（非真实菜单）', mealWindows: ['lunch', 'dinner'] });
catalog.offers.push(
  { offerId: 'offer-chicken-2f', dishId: 'dish-chicken', windowId: 'w-second', mealWindows: ['lunch', 'dinner'], portionCode: 'full', portionRatioNum: 1, portionRatioDen: 1, priceCents: 900, priceBasis: 'unitPrice' },
  { offerId: 'offer-greens-2f', dishId: 'dish-greens', windowId: 'w-second', mealWindows: ['lunch', 'dinner'], portionCode: 'full', portionRatioNum: 1, portionRatioDen: 1, priceCents: 350, priceBasis: 'unitPrice' },
);
// 故意不写 catalogHash：导入侧会按 T01 v1.2 规范化序列化补算，再由核心复算确认。
delete catalog.catalogHash;
catalog.comboRules = [];

const validPath = path.join(outDir, 'menu-valid-multiwindow.json');
fs.writeFileSync(validPath, JSON.stringify({ catalog, fileNote: 'SIMULATED menu fixture for T05 file-picker evidence; not a real canteen menu.' }, null, 2), 'utf8');

// 第二版夹具：与第一版结构相同但版本号/一条价格不同，用于“确认替换”前后有可见差异
// （同一版本号替换时界面版本不变，证据上无法区分“已替换”和“未替换”）。
const catalogV2 = JSON.parse(JSON.stringify(catalog));
catalogV2.menuVersion = 'menu-simulated-v2-t05v2-import-b';
catalogV2.offers = catalogV2.offers.map((offer) => (
  offer.offerId === 'offer-greens-2f' ? { ...offer, priceCents: 380 } : offer
));
const validV2Path = path.join(outDir, 'menu-valid-multiwindow-v2.json');
fs.writeFileSync(validV2Path, JSON.stringify({ catalog: catalogV2, fileNote: 'SIMULATED menu fixture v2 for T05 file-picker evidence; not a real canteen menu.' }, null, 2), 'utf8');

const invalidPath = path.join(outDir, 'menu-invalid.json');
fs.writeFileSync(invalidPath, '{"catalog": {"contractVersion": "1.0", "windows": [', 'utf8');

const badHash = JSON.parse(JSON.stringify(catalog));
badHash.catalogHash = 'sha256:' + '0'.repeat(64);
const badHashPath = path.join(outDir, 'menu-bad-hash.json');
fs.writeFileSync(badHashPath, JSON.stringify({ catalog: badHash }, null, 2), 'utf8');

for (const file of [validPath, validV2Path, invalidPath, badHashPath]) {
  const bytes = fs.readFileSync(file);
  console.log(`${file}\t${bytes.length} bytes\tsha256:${sha256Lower(bytes)}`);
}
console.log(JSON.stringify({ outDir, validPath, validV2Path, invalidPath, badHashPath, windowCount: catalog.windows.length, offerCount: catalog.offers.length }, null, 2));
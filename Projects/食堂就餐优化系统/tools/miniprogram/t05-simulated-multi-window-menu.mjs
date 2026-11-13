// t05-simulated-multi-window-menu.mjs — T05 补测专用“多窗口 / 同菜多报价”模拟菜单（SIMULATED）。
//
// 为什么放在 tools/miniprogram 而不是 miniprogram/src/config：
//  任务卡 writeScopes 只授权 config/simulated-menu.ts（冻结的 T02 夹具），本文件是测试专用
//  数据，放在测试工具目录既满足授权范围，也不会进入小程序运行包。
//
// 用途：验证售罄作用域（业务日期 + 窗口 + 餐次 + 稳定 dishId）与换菜分支。
// 真实 T03 菜单尚未提供，因此这里使用**明确标注的模拟菜单**：食堂名、窗口名、菜品名、
// 份量假定与营养来源全部带“模拟/非真实菜单”标记，不允许被当作真实价格/菜品/验收依据。
//
// 结构特征（测试依赖这些特征）：
//  - 两个窗口 w-sim-a / w-sim-b 都供应午餐、晚餐；
//  - 同一批 dishId（dish-rice / dish-chicken / dish-greens）在两个窗口各有独立 offerId，
//    也就是“同一道菜在多个窗口有报价”；
//  - 两个窗口价格、营养完全相同，避免窗口差异掩盖售罄作用域问题；
//  - 米饭同窗口整份/半份同价（契约 §3 半份米饭规则），comboRules 为空（当前能力门）。
//
// catalogHash 在模块加载时用冻结实现 canonical-json.ts 按 T01 v1.2 §0.3 规范化口径复算，
// 不手写常量，避免复制出错；测试会再次复算并核对身份。
import { importTs } from './t05-test-helpers.mjs';

const { canonicalSha256 } = await importTs('utils', 'canonical-json.ts');

/** 模拟菜单版本号；带 simulated 标识，避免与真实/导入菜单混淆。 */
export const SIMULATED_MULTI_WINDOW_MENU_VERSION = 'menu-simulated-multi-window-v1';

const SIMULATED_NUTRITION_BASIS = {
  source: 'simulated-reference',
  portionAssumption: '模拟份量（非真实菜单，不可作为营养依据）',
  estimated: true,
  note: 'SIMULATED',
};

function simulatedDish(dishId, name, category, nutrition, riceDish) {
  return {
    dishId,
    name,
    kind: 'single',
    category,
    riceDish,
    riceIncluded: false,
    nutrition,
    nutritionBasis: { ...SIMULATED_NUTRITION_BASIS },
  };
}

function simulatedOffersForWindow(windowId) {
  const suffix = windowId === 'w-sim-a' ? 'a' : 'b';
  return [
    {
      offerId: `offer-rice-full-${suffix}`,
      dishId: 'dish-rice',
      windowId,
      mealWindows: ['lunch', 'dinner'],
      portionCode: 'full',
      portionRatioNum: 1,
      portionRatioDen: 1,
      priceCents: 100,
      priceBasis: 'unitPrice',
    },
    {
      offerId: `offer-rice-half-${suffix}`,
      dishId: 'dish-rice',
      windowId,
      mealWindows: ['lunch', 'dinner'],
      portionCode: 'half',
      portionRatioNum: 1,
      portionRatioDen: 2,
      // 契约 §3：同窗口同一米饭 dish 的半份价格必须等于整份价格（不除以二）。
      priceCents: 100,
      priceBasis: 'unitPrice',
    },
    {
      offerId: `offer-chicken-${suffix}`,
      dishId: 'dish-chicken',
      windowId,
      mealWindows: ['lunch', 'dinner'],
      portionCode: 'full',
      portionRatioNum: 1,
      portionRatioDen: 1,
      priceCents: 800,
      priceBasis: 'unitPrice',
    },
    {
      offerId: `offer-greens-${suffix}`,
      dishId: 'dish-greens',
      windowId,
      mealWindows: ['lunch', 'dinner'],
      portionCode: 'full',
      portionRatioNum: 1,
      portionRatioDen: 1,
      priceCents: 400,
      priceBasis: 'unitPrice',
    },
  ];
}

function buildSimulatedMultiWindowCatalog() {
  const catalog = {
    contractVersion: '1.0',
    menuVersion: SIMULATED_MULTI_WINDOW_MENU_VERSION,
    catalogHash: '',
    canteen: { canteenId: 'canteen-sim-multi-window', name: '模拟双窗口食堂（非真实菜单）' },
    windows: [
      { windowId: 'w-sim-a', name: '模拟A窗口（非真实菜单）', mealWindows: ['lunch', 'dinner'] },
      { windowId: 'w-sim-b', name: '模拟B窗口（非真实菜单）', mealWindows: ['lunch', 'dinner'] },
    ],
    dishes: [
      simulatedDish('dish-rice', '模拟米饭（非真实菜品）', 'staple', { energyKcal: 232, proteinDg: 44, fatDg: 6, carbDg: 516 }, true),
      simulatedDish('dish-chicken', '模拟鸡胸（非真实菜品）', 'protein', { energyKcal: 165, proteinDg: 310, fatDg: 36, carbDg: 0 }, false),
      simulatedDish('dish-greens', '模拟青菜（非真实菜品）', 'vegetable', { energyKcal: 80, proteinDg: 20, fatDg: 50, carbDg: 60 }, false),
    ],
    offers: [...simulatedOffersForWindow('w-sim-a'), ...simulatedOffersForWindow('w-sim-b')],
    comboRules: [],
  };
  catalog.catalogHash = canonicalSha256(catalog, 'catalogHash');
  return catalog;
}

/** 冻结的模拟多窗口菜单对象；只用于测试与开发，不是真实菜单。 */
export const SIMULATED_MULTI_WINDOW_CATALOG = buildSimulatedMultiWindowCatalog();

/** 便于测试与证据核对：模拟菜单按规范化口径复算出的 catalogHash。 */
export const SIMULATED_MULTI_WINDOW_HASH = SIMULATED_MULTI_WINDOW_CATALOG.catalogHash;
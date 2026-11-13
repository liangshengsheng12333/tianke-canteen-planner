/**
 * simulated-menu.ts — 内置模拟菜单（SIMULATED）。
 *
 * 内容逐字段复制自 T02 已接受夹具 plan-request-success.json 的 catalog，
 * 摘要 sha256:40f2bd13ef5b91317e4cfcbbd868c82e208cb1347773a60e238bfea5c6cfba76。
 * 它只用于开发者工具/真机联调，不是真实菜单；页面对模拟菜单必须醒目标注。
 * 真实菜单由 T03 提供、用户在“菜单与备份”页导入后替换本菜单。
 */

export const SIMULATED_CATALOG: any = {
  contractVersion: '1.0',
  menuVersion: 'menu-simulated-v2',
  catalogHash: 'sha256:40f2bd13ef5b91317e4cfcbbd868c82e208cb1347773a60e238bfea5c6cfba76',
  canteen: { canteenId: 'canteen-sim', name: '模拟食堂（非真实菜单）' },
  windows: [
    { windowId: 'w-main', name: '模拟主窗口', mealWindows: ['breakfast', 'lunch', 'dinner'] },
  ],
  dishes: [
    {
      dishId: 'dish-rice',
      name: '米饭',
      kind: 'single',
      category: 'staple',
      riceDish: true,
      riceIncluded: false,
      nutrition: { energyKcal: 232, proteinDg: 44, fatDg: 6, carbDg: 516 },
      nutritionBasis: {
        source: 'simulated-reference',
        portionAssumption: '模拟 200g 熟米饭',
        estimated: true,
        note: 'SIMULATED',
      },
    },
    {
      dishId: 'dish-mantou',
      name: '馒头',
      kind: 'single',
      category: 'staple',
      riceDish: false,
      riceIncluded: false,
      nutrition: { energyKcal: 220, proteinDg: 70, fatDg: 10, carbDg: 470 },
      nutritionBasis: {
        source: 'simulated-reference',
        portionAssumption: '模拟 100g 馒头',
        estimated: true,
        note: 'SIMULATED',
      },
    },
    {
      dishId: 'dish-chicken',
      name: '清蒸鸡胸',
      kind: 'single',
      category: 'protein',
      riceDish: false,
      riceIncluded: false,
      nutrition: { energyKcal: 165, proteinDg: 310, fatDg: 36, carbDg: 0 },
      nutritionBasis: {
        source: 'simulated-reference',
        portionAssumption: '模拟 100g 熟鸡胸',
        estimated: true,
        note: 'SIMULATED',
      },
    },
    {
      dishId: 'dish-greens',
      name: '清炒青菜',
      kind: 'single',
      category: 'vegetable',
      riceDish: false,
      riceIncluded: false,
      nutrition: { energyKcal: 80, proteinDg: 20, fatDg: 50, carbDg: 60 },
      nutritionBasis: {
        source: 'simulated-reference',
        portionAssumption: '模拟 150g 炒青菜',
        estimated: true,
        note: 'SIMULATED',
      },
    },
  ],
  offers: [
    {
      offerId: 'offer-rice-full',
      dishId: 'dish-rice',
      windowId: 'w-main',
      mealWindows: ['breakfast', 'lunch', 'dinner'],
      portionCode: 'full',
      portionRatioNum: 1,
      portionRatioDen: 1,
      priceCents: 100,
      priceBasis: 'unitPrice',
    },
    {
      offerId: 'offer-rice-half',
      dishId: 'dish-rice',
      windowId: 'w-main',
      mealWindows: ['breakfast', 'lunch', 'dinner'],
      portionCode: 'half',
      portionRatioNum: 1,
      portionRatioDen: 2,
      priceCents: 100,
      priceBasis: 'unitPrice',
    },
    {
      offerId: 'offer-mantou',
      dishId: 'dish-mantou',
      windowId: 'w-main',
      mealWindows: ['breakfast'],
      portionCode: 'full',
      portionRatioNum: 1,
      portionRatioDen: 1,
      priceCents: 100,
      priceBasis: 'unitPrice',
    },
    {
      offerId: 'offer-chicken',
      dishId: 'dish-chicken',
      windowId: 'w-main',
      mealWindows: ['lunch', 'dinner'],
      portionCode: 'full',
      portionRatioNum: 1,
      portionRatioDen: 1,
      priceCents: 800,
      priceBasis: 'unitPrice',
    },
    {
      offerId: 'offer-greens',
      dishId: 'dish-greens',
      windowId: 'w-main',
      mealWindows: ['lunch', 'dinner'],
      portionCode: 'full',
      portionRatioNum: 1,
      portionRatioDen: 1,
      priceCents: 400,
      priceBasis: 'unitPrice',
    },
  ],
  comboRules: [],
};

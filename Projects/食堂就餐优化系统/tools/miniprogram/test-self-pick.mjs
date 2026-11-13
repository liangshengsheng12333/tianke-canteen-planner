// test-self-pick.mjs — T05S02（B1：自选菜状态与确认接口）的任务局部检查。
//
// 只测本卡新增/接合的东西，不重跑 T05 全量回归：
//   * 状态查询 getSelfPickView：可售报价/份量来自菜单真实 Offer、售罄带窗口、阻塞原因码；
//   * 草稿预览 previewSelfPickDraft：不写任何持久化、未知不补 0、套餐只计一次、偏离预算只提示；
//   * 确认 confirmSelfPickMeal：菜单快照落账、同一草稿幂等、已结束/已确认/售罄/跨窗/伪造报价被拒；
//   * 既有读模型接合：已确认餐次以实际记录为准、剩余推荐标记需更新且不静默重算。
//
// 证据边界：mock wx 只模拟持久化文本；"不调用核心"用抛错实例化器证明；
// 这不是微信运行时、不是真机，也不替代 S03 页面与真机验收。
// T06a：测试 11–13 用真实包内 A11 WASM 覆盖自选营养三类语义（完整已知/部分未知/全未知），
// 旧“营养恒为 null”断言已按“未取核心结果时才保持未知”改写，未知仍为 null、不当 0。
//
// 运行（项目根 D:\项目\cpp\Projects\食堂就餐优化系统）：
//   node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-self-pick.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { createMockWx, createRealInstantiate, importTs, wasmPath } from './t05-test-helpers.mjs';

const { AppStore } = await importTs('domain', 'store.ts');
const { STORAGE_KEY, createInitialState } = await importTs('domain', 'app-state.ts');
const { SIMULATED_CATALOG } = await importTs('config', 'simulated-menu.ts');
const { canonicalSha256 } = await importTs('utils', 'canonical-json.ts');
const coreRuntime = await importTs('utils', 'core-runtime.ts');

const DATE_A = '2026-10-20';
const LUNCH = 'lunch';

/** 每次调用前进 1 秒的注入时钟：记录 ID 唯一，业务日期稳定。 */
function makeClock(iso = `${DATE_A}T12:00:00+08:00`) {
  let current = new Date(iso).getTime();
  const clock = () => {
    current += 1000;
    return new Date(current);
  };
  clock.set = (nextIso) => {
    current = new Date(nextIso).getTime();
  };
  return clock;
}

function profileDraft() {
  return {
    sex: 'male',
    ageYears: 20,
    heightMm: 1750,
    weightGrams: 70000,
    bodyFatPermille: null,
    activityLevel: 'moderate',
    goalType: 'fatLoss',
    manualTargets: null,
    trainingPreference: false,
    dietaryFlags: { pregnancyOrLactation: false, medicalDietManagement: false },
    tastes: [],
  };
}

/**
 * T05M02 后空存储的默认菜单改为内置西一真实菜单。本文件验证“已有菜单下的自选链路”，
 * 所以默认把冻结示例菜单作为已保存的当前菜单写进 mock 持久化，被测 store 代码与断言不变。
 */
function seedSimulatedMenu(mock, now) {
  const state = createInitialState(now);
  state.catalog = JSON.parse(JSON.stringify(SIMULATED_CATALOG));
  state.catalogMeta = { source: 'simulated', importedAt: null, importedFileName: null };
  mock.storage.set(STORAGE_KEY, JSON.stringify(state));
}

/** 打开 AppStore；instantiate 默认抛错，用来证明自选链路不碰核心。 */
function openStore({ clock = makeClock(), mock = createMockWx(), instantiate = null } = {}) {
  const uninstall = mock.install();
  if (mock.raw(STORAGE_KEY) === '') {
    seedSimulatedMenu(mock, clock());
  }
  const noCoreInstantiate = async () => {
    throw new Error('本卡自选链路不得调用核心：请检查是否走了 PlanDay/ValidateMenu');
  };
  const store = new AppStore({ instantiate: instantiate || noCoreInstantiate, wasmPath, now: clock });
  coreRuntime.resetCore();
  const initResult = store.init();
  return {
    store,
    mock,
    clock,
    init: initResult,
    close() {
      coreRuntime.resetCore();
      uninstall();
    },
  };
}

function currentDay(store) {
  const state = store.peekState();
  return state.days[state.activeDate];
}

/** 两窗口 + 套餐的测试菜单：只有它才能覆盖单窗边界与套餐不重复计价。 */
function customCatalog() {
  return {
    contractVersion: '1.0',
    menuVersion: 'menu-selfpick-test-v1',
    catalogHash: 'sha256:selfpick-test',
    canteen: { canteenId: 'canteen-test', name: '自选测试食堂' },
    windows: [
      { windowId: 'w-a', name: 'A 窗口', mealWindows: ['lunch', 'dinner'] },
      { windowId: 'w-b', name: 'B 窗口', mealWindows: ['lunch'] },
    ],
    dishes: [
      {
        dishId: 'dish-a-rice',
        name: '米饭',
        kind: 'single',
        category: 'staple',
        riceDish: true,
        riceIncluded: false,
        nutrition: { energyKcal: 232, proteinDg: 44, fatDg: 6, carbDg: 516 },
        nutritionBasis: { source: 'test', portionAssumption: '200g', estimated: true, note: 'TEST' },
      },
      {
        dishId: 'dish-a-chicken',
        name: '鸡胸',
        kind: 'single',
        category: 'protein',
        riceDish: false,
        riceIncluded: false,
        nutrition: { energyKcal: 165, proteinDg: 310, fatDg: 36, carbDg: 0 },
        nutritionBasis: { source: 'test', portionAssumption: '100g', estimated: false, note: null },
      },
      {
        dishId: 'dish-b-greens',
        name: 'B 窗青菜',
        kind: 'single',
        category: 'vegetable',
        riceDish: false,
        riceIncluded: false,
        nutrition: { energyKcal: 80, proteinDg: 20, fatDg: 50, carbDg: 60 },
        nutritionBasis: { source: 'test', portionAssumption: '150g', estimated: false, note: null },
      },
      {
        dishId: 'dish-set-a',
        name: '一荤一素套餐',
        kind: 'combo',
        category: 'combo',
        riceDish: false,
        riceIncluded: true,
        components: ['dish-a-chicken', 'dish-b-greens'],
        nutrition: { energyKcal: 600, proteinDg: 330, fatDg: 86, carbDg: 60 },
        nutritionBasis: { source: 'test', portionAssumption: '套餐', estimated: false, note: null },
      },
    ],
    offers: [
      {
        offerId: 'offer-a-rice-full',
        dishId: 'dish-a-rice',
        windowId: 'w-a',
        mealWindows: ['lunch', 'dinner'],
        portionCode: 'full',
        portionRatioNum: 1,
        portionRatioDen: 1,
        priceCents: 100,
        priceBasis: 'unitPrice',
      },
      {
        offerId: 'offer-a-rice-half',
        dishId: 'dish-a-rice',
        windowId: 'w-a',
        mealWindows: ['lunch', 'dinner'],
        portionCode: 'half',
        portionRatioNum: 1,
        portionRatioDen: 2,
        priceCents: 100,
        priceBasis: 'unitPrice',
      },
      {
        offerId: 'offer-a-chicken',
        dishId: 'dish-a-chicken',
        windowId: 'w-a',
        mealWindows: ['lunch'],
        portionCode: 'full',
        portionRatioNum: 1,
        portionRatioDen: 1,
        priceCents: 800,
        priceBasis: 'unitPrice',
      },
      {
        offerId: 'offer-b-greens',
        dishId: 'dish-b-greens',
        windowId: 'w-b',
        mealWindows: ['lunch'],
        portionCode: 'full',
        portionRatioNum: 1,
        portionRatioDen: 1,
        priceCents: 400,
        priceBasis: 'unitPrice',
      },
      {
        offerId: 'offer-a-combo',
        dishId: 'dish-set-a',
        windowId: 'w-a',
        mealWindows: ['lunch'],
        portionCode: 'full',
        portionRatioNum: 1,
        portionRatioDen: 1,
        priceCents: 1200,
        priceBasis: 'comboTotal',
      },
    ],
    comboRules: [],
  };
}

/**
 * T06a：构造带合法 catalogHash 的营养用例菜单。统一核心的 offer-nutrition 会复算摘要，
 * 所以这里用与 C++ 一致的规范化序列化（canonicalSha256）生成 hash，而不是随手写一个假的。
 * 窗口只有一个且供应午餐，报价都是整份、价格已知，便于聚焦营养语义。
 */
function nutritionCatalog(dishes) {
  const catalog = {
    contractVersion: '1.0',
    menuVersion: 'menu-selfpick-nutrition-test-v1',
    catalogHash: '',
    canteen: { canteenId: 'canteen-nutrition-test', name: '营养用例测试食堂' },
    windows: [{ windowId: 'w-nutrition', name: '营养窗口', mealWindows: ['lunch'] }],
    dishes,
    offers: dishes.map((dish) => ({
      offerId: `offer-${dish.dishId}`,
      dishId: dish.dishId,
      windowId: 'w-nutrition',
      mealWindows: ['lunch'],
      portionCode: 'full',
      portionRatioNum: 1,
      portionRatioDen: 1,
      priceCents: 500,
      priceBasis: 'unitPrice',
    })),
    comboRules: [],
  };
  catalog.catalogHash = canonicalSha256(catalog, 'catalogHash');
  return catalog;
}

/** 单道测试菜；营养/估算标记由用例直接给出，用来覆盖完整已知、部分未知、全未知三类。 */
function nutritionDish(dishId, name, nutrition, estimated) {
  return {
    dishId,
    name,
    kind: 'single',
    category: 'staple',
    riceDish: false,
    riceIncluded: false,
    nutrition,
    nutritionBasis: { source: 'test', portionAssumption: 'test', estimated, note: 'SIMULATED TEST' },
  };
}

/** 用营养用例菜单 + 真实核心打开 store：ensureSelfPickNutrition 必须真的走统一核心。 */
function openNutritionStore(catalog) {
  return openStoreWithState(
    (state) => {
      state.catalog = catalog;
      state.catalogMeta = { source: 'imported', importedAt: '2026-10-20T00:00:00.000Z', importedFileName: 'selfpick-nutrition-test-menu.json' };
    },
    { instantiate: createRealInstantiate() },
  );
}

/** 先在默认状态上打补丁（例如换成自定义菜单），再重新加载，避免直接改内存状态。 */
function openStoreWithState(mutateState, options = {}) {
  const clock = makeClock();
  const mock = createMockWx();
  const bootstrap = openStore({ clock, mock });
  try {
    const state = JSON.parse(JSON.stringify(bootstrap.store.peekState()));
    mutateState(state);
    mock.wx.setStorageSync(STORAGE_KEY, JSON.stringify(state));
  } finally {
    coreRuntime.resetCore();
  }
  // 重新装载：此时读的是上面写入的持久化文本。
  const uninstall = mock.install();
  const store = new AppStore({
    instantiate:
      options.instantiate ||
      (async () => {
        throw new Error('本卡自选链路不得调用核心');
      }),
    wasmPath,
    now: clock,
  });
  coreRuntime.resetCore();
  store.init();
  return {
    store,
    mock,
    clock,
    close() {
      coreRuntime.resetCore();
      uninstall();
    },
  };
}

// ---------------------------------------------------------------------------
// 1) 状态查询
// ---------------------------------------------------------------------------

test('1 getSelfPickView：报价/份量来自菜单真实 Offer，售罄带窗口，不伪造 Offer', () => {
  const ctx = openStore();
  try {
    const view = ctx.store.getSelfPickView(LUNCH);
    assert.equal(view.canPick, true, '模拟菜单午餐应可自选');
    assert.equal(view.blockCode, null, '可自选时不应有阻塞原因');
    assert.equal(view.defaultWindowId, 'w-main', '默认窗口应落在供应午餐的窗口');
    assert.equal(view.simulated, true, '模拟菜单必须继续标注 simulated=true');
    const offers = view.windows[0].offers;
    assert.deepEqual(
      offers.map((offer) => offer.offerId),
      ['offer-rice-full', 'offer-rice-half', 'offer-chicken', 'offer-greens'],
      '午餐只应列出菜单里真实存在且供应午餐的报价',
    );
    // 份量只认菜单 Offer：米饭有 half，鸡胸没有 half。
    const riceHalf = offers.find((offer) => offer.offerId === 'offer-rice-half');
    const chicken = offers.find((offer) => offer.offerId === 'offer-chicken');
    assert.equal(riceHalf.portionCode, 'half', '半份只能来自菜单里的 half Offer');
    assert.equal(riceHalf.priceCents, 100, '半份米饭与整份同价（不除以二）');
    assert.equal(chicken.portionCode, 'full', '鸡胸菜单只有整份');
    assert.ok(
      offers.every((offer) => ['offer-rice-full', 'offer-rice-half', 'offer-chicken', 'offer-greens'].includes(offer.offerId)),
      '不得出现菜单里不存在的 Offer',
    );
    assert.equal(chicken.estimated, true, '模拟菜单营养带估算标记');
    // T06a：本测试注入的实例化器会抛错（证明自选视图不调用核心），因此没有核心单份结果时
    // 视图营养必须保持未知（null），不能由前端派生；核心返回值进入视图/预览的语义见测试 11–13。
    assert.equal(chicken.nutrition, null, '没有核心结果时视图营养不得由前端派生');
    assert.equal(chicken.nutritionKnown, false, '营养未知必须标记 nutritionKnown=false');
    assert.equal(chicken.estimatedLabel, '估算', '无核心结果时菜单估算元数据仍透传给页面');
    assert.equal(view.windows[0].soldOutCount, 0, '未标记售罄时应为 0');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 2) 草稿不写持久化 + 预览口径
// ---------------------------------------------------------------------------

test('2 草稿预览：不写存储、金额未知不补 0、营养保持未知待核心快照', () => {
  const ctx = openStore();
  try {
    const rawBefore = ctx.mock.raw(STORAGE_KEY);
    const before = currentDay(ctx.store).logs.length;
    const preview = ctx.store.previewSelfPickDraft(LUNCH, 'w-main', [
      { offerId: 'offer-rice-half' },
      { offerId: 'offer-chicken', quantity: 1 },
    ]);
    assert.equal(preview.ok, true, '合法草稿应可确认');
    assert.equal(preview.lines.length, 2, '两行选择');
    assert.equal(preview.knownTotalCents, 900, '100 + 800 = 900 分');
    assert.equal(preview.priceLabel, '￥9.00', '全已知时应给出完整金额');
    // T06a：本测试没有取核心单份营养结果，行与汇总都必须保持 null（未知，不补 0、不派生）；
    // 从统一核心取到值后的累加语义见测试 11–13。
    assert.equal(preview.lines[0].nutrition, null, '没有核心结果时草稿行营养不得由前端派生');
    assert.equal(preview.lines[0].nutritionBasis, null, '营养未知时不得伪造 nutritionBasis');
    assert.equal(preview.lines[0].portionCode, 'half', '草稿行保留真实份量码');
    assert.equal(preview.nutritionSums, null, '营养未知时合计必须为 null，不能补 0');
    assert.deepEqual(preview.incompleteNutrients, ['能量', '蛋白质', '脂肪', '碳水'], '四项营养都应标待补全');
    assert.equal(preview.unknownItemCount, 0, '价格全已知时"实付未知项数"为 0（营养未知不混入该项）');
    assert.equal(preview.estimated, true, '菜单估算元数据仍透传');
    assert.equal(ctx.mock.raw(STORAGE_KEY), rawBefore, '预览不得写任何持久化数据');
    assert.equal(currentDay(ctx.store).logs.length, before, '预览不得写入记录');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 3) 明确确认 → 落账快照
// ---------------------------------------------------------------------------

test('3 confirmSelfPickMeal：一条 MealLog + 菜单快照，可被记餐/月历读模型读到', () => {
  const ctx = openStore();
  try {
    const token = ctx.store.newSelfPickDraftToken();
    const outcome = ctx.store.confirmSelfPickMeal(LUNCH, {
      windowId: 'w-main',
      draftToken: token,
      selections: [{ offerId: 'offer-rice-half' }, { offerId: 'offer-chicken' }],
    });
    assert.equal(outcome.ok, true, `确认应成功：${outcome.message}`);
    assert.equal(outcome.duplicate, undefined, '首次确认不应标记 duplicate');
    assert.match(outcome.confirmationId, /^conf-selfpick-\d{4}-\d{2}-\d{2}-lunch-sp-/, '确认键应为 conf-selfpick-<date>-<meal>-<草稿标识>');

    const logs = currentDay(ctx.store).logs;
    assert.equal(logs.length, 1, '确认只写 1 条记录');
    const record = logs[0];
    assert.equal(record.status, 'active', '记录必须是 active');
    assert.equal(record.meal, LUNCH, '餐次正确');
    assert.equal(record.businessDate, DATE_A, '业务日期正确');
    assert.equal(record.menuVersion, 'menu-simulated-v2', '记录保存确认时的菜单版本');
    assert.equal(record.items.length, 2, '两项快照');
    const half = record.items.find((item) => item.offerId === 'offer-rice-half');
    assert.equal(half.source, 'menuOffer', '来源必须是菜单报价');
    assert.equal(half.nameSnapshot, '米饭', '记录保存菜名快照');
    assert.equal(half.portionCode, 'half', '记录保存真实份量');
    assert.equal(half.unitPriceCents, 100, '记录保存菜单价');
    assert.equal(half.priceKnown, true, '已知价格标记');
    // T06a：本测试未先调用 ensureSelfPickNutrition，确认快照保持未知（null），不得把前端派生值写进正式记录；
    // 从统一核心取到值后的记录快照语义见测试 11。
    assert.equal(half.nutrition, null, '未取核心单份结果时，记录营养快照为 null');
    assert.equal(half.nutritionBasis, null, '营养未知时不得伪造来源口径');
    assert.equal(half.menuVersion, 'menu-simulated-v2', '每项也带菜单版本');

    const logsView = ctx.store.getLogsView();
    assert.equal(logsView.meals[1].active.length, 1, '记餐页能读到这条自选记录');
    assert.equal(logsView.intake.priceKnownCents, 900, '实际消费计入 9.00 元');
    assert.equal(logsView.intake.energyKcal, null, '营养未知时摄入能量必须为 null，不能补 0');
    assert.ok(logsView.intake.incompleteNutrients.indexOf('能量') >= 0, '应标注能量待补全');
    const month = ctx.store.getMonthLogs(DATE_A.slice(0, 7));
    assert.equal(month.length, 1, '月历读模型能读到当天记录');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 4) 同一草稿幂等 + 不同草稿不叠加
// ---------------------------------------------------------------------------

test('4 幂等：同一草稿重复提交不新增；已确认后新草稿不得叠加第二条事实', () => {
  const ctx = openStore();
  try {
    const token = ctx.store.newSelfPickDraftToken();
    const input = { windowId: 'w-main', draftToken: token, selections: [{ offerId: 'offer-greens' }] };
    assert.equal(ctx.store.confirmSelfPickMeal(LUNCH, input).ok, true, '首次确认成功');
    const second = ctx.store.confirmSelfPickMeal(LUNCH, input);
    assert.equal(second.ok, true, '同一草稿重复提交应幂等成功');
    assert.equal(second.duplicate, true, '必须标记 duplicate');
    assert.equal(currentDay(ctx.store).logs.length, 1, '重复提交不得新增记录');
    assert.equal(ctx.store.getLogsView().intake.priceKnownCents, 400, '重复提交不得累计金额');

    const otherToken = ctx.store.newSelfPickDraftToken();
    const collide = ctx.store.confirmSelfPickMeal(LUNCH, {
      windowId: 'w-main',
      draftToken: otherToken,
      selections: [{ offerId: 'offer-chicken' }],
    });
    assert.equal(collide.ok, false, '该餐已有有效记录时，新草稿不得再写第二条');
    assert.match(collide.message, /已有有效记录/, '失败原因应指向记录页改记/撤销');
    assert.equal(currentDay(ctx.store).logs.length, 1, '冲突时不得新增记录');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 5) 已结束餐次不绕过状态校验
// ---------------------------------------------------------------------------

test('5 已结束：不直接自选记餐，必须先走既有重开入口', () => {
  const ctx = openStore();
  try {
    assert.equal(ctx.store.endMeal('dinner').ok, true, '先结束晚餐');
    const view = ctx.store.getSelfPickView('dinner');
    assert.equal(view.canPick, false, '已结束不得自选');
    assert.equal(view.blockCode, 'meal-ended', '阻塞原因应为 meal-ended');
    assert.match(view.blockMessage, /重开该餐/, '文案应指向既有重开入口');

    const blocked = ctx.store.confirmSelfPickMeal('dinner', {
      windowId: 'w-main',
      draftToken: ctx.store.newSelfPickDraftToken(),
      selections: [{ offerId: 'offer-greens' }],
    });
    assert.equal(blocked.ok, false, '已结束餐次不得写入实际记录');
    assert.match(blocked.message, /重开该餐/, '失败原因应给出恢复路径');
    assert.equal(currentDay(ctx.store).logs.length, 0, '被拒绝时不得写记录');

    assert.equal(ctx.store.reopenMeal('dinner').ok, true, '走既有重开');
    const after = ctx.store.confirmSelfPickMeal('dinner', {
      windowId: 'w-main',
      draftToken: ctx.store.newSelfPickDraftToken(),
      selections: [{ offerId: 'offer-greens' }],
    });
    assert.equal(after.ok, true, '重开后可以自选记餐');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 6) 售罄带窗口拦截
// ---------------------------------------------------------------------------

test('6 售罄：本窗本餐售罄的报价不得记为已吃', () => {
  const ctx = openStore();
  try {
    assert.equal(ctx.store.markSoldOut(LUNCH, 'dish-chicken', 'w-main').ok, true, '标记鸡胸售罄');
    const view = ctx.store.getSelfPickView(LUNCH);
    const chicken = view.windows[0].offers.find((offer) => offer.offerId === 'offer-chicken');
    assert.equal(chicken.soldOut, true, '视图中该报价应标记售罄');
    assert.equal(chicken.available, false, '售罄报价不可选');

    const preview = ctx.store.previewSelfPickDraft(LUNCH, 'w-main', [{ offerId: 'offer-chicken' }]);
    assert.equal(preview.ok, false, '含售罄项的草稿不可确认');
    assert.match(preview.message, /售罄/, '应指出售罄');

    const outcome = ctx.store.confirmSelfPickMeal(LUNCH, {
      windowId: 'w-main',
      draftToken: ctx.store.newSelfPickDraftToken(),
      selections: [{ offerId: 'offer-chicken' }],
    });
    assert.equal(outcome.ok, false, '售罄项不得落账');
    assert.equal(currentDay(ctx.store).logs.length, 0, '被拒绝时不得写记录');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 7) 单窗口边界 / 伪造报价 / 餐次非法 / 草稿标识非法
// ---------------------------------------------------------------------------

test('7 边界：跨窗混选、伪造报价、非法餐次、非法草稿标识全部拒绝', () => {
  const ctx = openStoreWithState((state) => {
    state.catalog = customCatalog();
    state.catalogMeta = { source: 'imported', importedAt: '2026-10-20T00:00:00.000Z', importedFileName: 'selfpick-test-menu.json' };
  });
  try {
    const view = ctx.store.getSelfPickView(LUNCH);
    assert.equal(view.windows.length, 2, '两个窗口都供应午餐');
    assert.equal(view.defaultWindowId, 'w-a', '默认应落第一个有可售报价的窗口');

    const cross = ctx.store.confirmSelfPickMeal(LUNCH, {
      windowId: 'w-a',
      draftToken: ctx.store.newSelfPickDraftToken(),
      selections: [{ offerId: 'offer-a-chicken' }, { offerId: 'offer-b-greens' }],
    });
    assert.equal(cross.ok, false, '跨窗混选必须拒绝');
    assert.match(cross.message, /其他窗口/, '应指出跨窗口');
    assert.equal(currentDay(ctx.store).logs.length, 0, '拒绝时不写记录');

    const fake = ctx.store.confirmSelfPickMeal(LUNCH, {
      windowId: 'w-a',
      draftToken: ctx.store.newSelfPickDraftToken(),
      selections: [{ offerId: 'offer-not-exist' }],
    });
    assert.equal(fake.ok, false, '伪造报价必须拒绝');
    assert.match(fake.message, /已不在当前菜单/, '应指出报价不存在');

    const badMeal = ctx.store.confirmSelfPickMeal('brunch', {
      windowId: 'w-a',
      draftToken: ctx.store.newSelfPickDraftToken(),
      selections: [{ offerId: 'offer-a-chicken' }],
    });
    assert.equal(badMeal.ok, false, '非法餐次必须拒绝');
    assert.match(badMeal.message, /餐次不合法/, '应指出餐次非法');

    const badToken = ctx.store.confirmSelfPickMeal(LUNCH, {
      windowId: 'w-a',
      draftToken: 'x',
      selections: [{ offerId: 'offer-a-chicken' }],
    });
    assert.equal(badToken.ok, false, '非法草稿标识必须拒绝（防止拼出跨餐幂等键）');
    assert.match(badToken.message, /草稿确认标识无效/, '应指出草稿标识非法');
    assert.equal(currentDay(ctx.store).logs.length, 0, '以上全部拒绝后不得有记录');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 8) 套餐只计一次 + 未知实付不补 0
// ---------------------------------------------------------------------------

test('8 套餐按 comboTotal 计一次；实付改为未知时保持 null 不补 0', () => {
  const ctx = openStoreWithState((state) => {
    state.catalog = customCatalog();
    state.catalogMeta = { source: 'imported', importedAt: '2026-10-20T00:00:00.000Z', importedFileName: 'selfpick-test-menu.json' };
  });
  try {
    const combo = ctx.store.confirmSelfPickMeal(LUNCH, {
      windowId: 'w-a',
      draftToken: ctx.store.newSelfPickDraftToken(),
      selections: [{ offerId: 'offer-a-combo' }],
    });
    assert.equal(combo.ok, true, `套餐确认应成功：${combo.message}`);
    const record = currentDay(ctx.store).logs[0];
    assert.equal(record.items.length, 1, '套餐只记 1 项，组件不重复成行');
    assert.equal(record.items[0].unitPriceCents, 1200, '套餐按 comboTotal 计一次');
    assert.equal(ctx.store.getLogsView().intake.priceKnownCents, 1200, '实际消费只计 1200 分');
    assert.equal(record.menuVersion, 'menu-selfpick-test-v1', '记录菜单版本来自当前导入菜单');
  } finally {
    ctx.close();
  }

  const ctx2 = openStore();
  try {
    const outcome = ctx2.store.confirmSelfPickMeal('dinner', {
      windowId: 'w-main',
      draftToken: ctx2.store.newSelfPickDraftToken(),
      // 用户明确把实付改为"不知道"：不得补 0。
      selections: [{ offerId: 'offer-greens', priceEdit: null }],
    });
    assert.equal(outcome.ok, true, '未知实付仍应允许记录');
    const item = currentDay(ctx2.store).logs[0].items[0];
    assert.equal(item.unitPriceCents, null, '未知实付必须保持 null');
    assert.equal(item.priceKnown, false, '未知实付 priceKnown=false');
    const logsView = ctx2.store.getLogsView();
    assert.equal(logsView.intake.priceKnownCents, 0, '未知不参与已知金额');
    assert.equal(logsView.intake.priceIncomplete, true, '应标记金额不完整');
    assert.match(logsView.budget.spentLabel, /实付待补全|含未填项/, '未知实付不得显示成 ￥0.00');
  } finally {
    ctx2.close();
  }
});

// ---------------------------------------------------------------------------
// 9) 偏离预算只提示，不改写选择、不拒绝保存
// ---------------------------------------------------------------------------

test('9 预算偏离：只形成提示，选择与落账保持不变', () => {
  const ctx = openStore();
  try {
    assert.equal(ctx.store.saveSettings({ budgetCents: 500 }).ok, true, '设置 5 元预算');
    const preview = ctx.store.previewSelfPickDraft(LUNCH, 'w-main', [{ offerId: 'offer-chicken' }]);
    assert.equal(preview.ok, true, '超预算不影响草稿可确认');
    assert.ok(preview.hints.some((hint) => /超过今日剩余预算/.test(hint)), '应给出预算偏离提示');
    const outcome = ctx.store.confirmSelfPickMeal(LUNCH, {
      windowId: 'w-main',
      draftToken: ctx.store.newSelfPickDraftToken(),
      selections: [{ offerId: 'offer-chicken' }],
    });
    assert.equal(outcome.ok, true, '不得仅因偏离预算拒绝保存');
    assert.ok(outcome.hints.length > 0, '确认结果应带回提示');
    const record = currentDay(ctx.store).logs[0];
    assert.equal(record.items[0].offerId, 'offer-chicken', '记录必须保留用户实际选择，不被改写');
    assert.equal(ctx.store.getLogsView().intake.priceKnownCents, 800, '实际消费按用户真实选择计入');
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 10) 与既有读模型接合：实际记录优先、推荐标记需更新、不静默重算
// ---------------------------------------------------------------------------

test('10 接合：已确认餐次展示实际记录；剩余推荐标记需更新且不自动重算', async () => {
  const clock = makeClock();
  const mock = createMockWx();
  const ctx = openStore({ clock, mock, instantiate: createRealInstantiate() });
  try {
    assert.equal(ctx.store.saveProfile(profileDraft()).ok, true, '建档');
    const planned = await ctx.store.refreshPlan();
    assert.equal(planned.ok, true, `生成今日方案应成功：${planned.message}`);
    const planBefore = JSON.parse(JSON.stringify(currentDay(ctx.store).plan));
    const homeBefore = ctx.store.getHomeView();
    assert.equal(homeBefore.meals[1].hasPlan, true, '午餐原本有推荐');
    assert.equal(homeBefore.planNeedsUpdate, false, '刚生成的方案不应标记需更新');

    const outcome = ctx.store.confirmSelfPickMeal(LUNCH, {
      windowId: 'w-main',
      draftToken: ctx.store.newSelfPickDraftToken(),
      selections: [{ offerId: 'offer-rice-half' }, { offerId: 'offer-greens' }],
    });
    assert.equal(outcome.ok, true, `自选确认应成功：${outcome.message}`);
    assert.equal(outcome.planNeedsUpdate, true, '确认后应标记剩余推荐需更新');
    assert.deepEqual(outcome.affectedMeals, ['breakfast', 'dinner'], '受影响的是仍未规划的餐次');

    const home = ctx.store.getHomeView();
    const lunch = home.meals[1];
    assert.equal(lunch.confirmed, true, '午餐应为已确认');
    assert.equal(lunch.hasPlan, true, '旧方案原文仍在（不静默清空）');
    assert.deepEqual(
      lunch.items.map((item) => item.name),
      ['米饭', '清炒青菜'],
      '已确认餐次必须展示实际记录的快照，而不是旧推荐',
    );
    assert.deepEqual(lunch.items.map((item) => item.portionLabel), ['半份', '整份'], '份量取记录快照');
    // T06a：本流程未先调用 ensureSelfPickNutrition，正式记录的营养快照保持未知；
    // 今日页必须按未知显示（null），不能补 0 也不能编造。核心营养快照语义见测试 11–13。
    assert.ok(lunch.items.every((item) => item.nutrition === null), '未取核心结果时已确认餐次的营养保持未知（null）');
    assert.equal(home.planNeedsUpdate, true, '今日视图应暴露"推荐需更新"标记');
    assert.deepEqual(home.planUpdateMeals, ['breakfast', 'dinner'], '需更新的餐次');
    assert.match(home.planUpdateMessage, /刷新方案/, '提示应指向既有刷新入口');

    // 不静默重算：计划原文与 requestId 都没有被改写。
    assert.deepEqual(JSON.parse(JSON.stringify(currentDay(ctx.store).plan)), planBefore, '不得在后台改写已保存的方案');
    assert.equal(home.requestId, homeBefore.requestId, '不得在后台静默重新规划');
    assert.equal(home.canPlan, true, '仍保留用户主动刷新入口');

    // 用户主动刷新仍可用：自选记录的营养是 null，不得让方案刷新失败；
    // 刷新后已吃餐次仍以实际记录为准，不回到旧推荐。
    const refreshed = await ctx.store.refreshPlan();
    assert.equal(refreshed.ok, true, `营养未知的自选记录不应让用户主动刷新失败：${refreshed.message}`);
    const homeAfterRefresh = ctx.store.getHomeView();
    assert.equal(homeAfterRefresh.planNeedsUpdate, false, '用户主动刷新后推荐过期标记应清除');
    assert.deepEqual(
      homeAfterRefresh.meals[1].items.map((item) => item.name),
      ['米饭', '清炒青菜'],
      '刷新方案不得把已吃餐次改回推荐',
    );
  } finally {
    ctx.close();
  }
});

// ---------------------------------------------------------------------------
// 11–13) T06a：自选营养唯一来源是统一核心（mp_offer_nutrition）
//   * 完整已知：核心单份值进入视图、按数量累加进预览、并落入记录快照；
//   * 部分未知：核心逐字段 null 原样保留，未知字段不当 0，合计只对全已知字段求和；
//   * 全未知：视图/预览保持未知（null），estimated 标记仍按核心透传。
// 三类都走真实包内 A11 WASM；不是前端派生，也不是测试假值。
// ---------------------------------------------------------------------------

test('11 完整已知：核心单份值进入自选视图、预览累加与记录快照', async () => {
  const catalog = nutritionCatalog([
    nutritionDish('dish-rice', '米饭', { energyKcal: 232, proteinDg: 44, fatDg: 6, carbDg: 516 }, true),
    nutritionDish('dish-chicken', '鸡胸', { energyKcal: 165, proteinDg: 310, fatDg: 36, carbDg: 0 }, false),
  ]);
  const ctx = openNutritionStore(catalog);
  try {
    const prep = await ctx.store.ensureSelfPickNutrition(LUNCH);
    assert.equal(prep.ok, true, `应能从统一核心取到单份营养：${prep.message}`);
    assert.equal(prep.offerCount, 2, '本餐两个报价各一条结果');

    const view = ctx.store.getSelfPickView(LUNCH);
    const rice = view.windows[0].offers.find((offer) => offer.offerId === 'offer-dish-rice');
    const chicken = view.windows[0].offers.find((offer) => offer.offerId === 'offer-dish-chicken');
    assert.deepEqual(rice.nutrition, { energyKcal: 232, proteinDg: 44, fatDg: 6, carbDg: 516 }, '已知整份值来自统一核心');
    assert.equal(rice.nutritionKnown, true);
    assert.equal(rice.nutritionComplete, true);
    assert.equal(rice.estimated, true, '核心返回的 estimated 透传到视图');
    assert.equal(chicken.estimated, false, '非估算项 estimated=false');
    assert.deepEqual(chicken.nutrition, { energyKcal: 165, proteinDg: 310, fatDg: 36, carbDg: 0 }, '已知 0 保留为 0');

    const preview = ctx.store.previewSelfPickDraft(LUNCH, 'w-nutrition', [
      { offerId: 'offer-dish-rice' },
      { offerId: 'offer-dish-chicken', quantity: 2 },
    ]);
    assert.equal(preview.ok, true, `预览应可用：${preview.message}`);
    assert.deepEqual(
      preview.nutritionSums,
      { energyKcal: 562, proteinDg: 664, fatDg: 78, carbDg: 516 },
      '按核心单份值×数量累加（232+165×2 / 44+310×2 / 6+36×2 / 516+0×2）',
    );
    assert.deepEqual(preview.incompleteNutrients, [], '四项全已知时无待补全');
    assert.equal(preview.estimated, true, '含估算项时预览标 estimated');

    const outcome = ctx.store.confirmSelfPickMeal(LUNCH, {
      windowId: 'w-nutrition',
      draftToken: ctx.store.newSelfPickDraftToken(),
      selections: [{ offerId: 'offer-dish-chicken' }],
    });
    assert.equal(outcome.ok, true, `确认应成功：${outcome.message}`);
    const item = currentDay(ctx.store).logs[0].items[0];
    assert.deepEqual(item.nutrition, { energyKcal: 165, proteinDg: 310, fatDg: 36, carbDg: 0 }, '正式记录快照保留核心单份营养');
    assert.equal(item.nutritionBasis, 'menu', '非估算来源记 menu');
  } finally {
    ctx.close();
  }
});

test('12 部分未知：核心逐字段 null 原样保留，未知不当 0，合计只对全已知字段求和', async () => {
  const catalog = nutritionCatalog([
    nutritionDish('dish-partial-a', '部分未知A', { energyKcal: 0, proteinDg: null, fatDg: 0, carbDg: null }, true),
    nutritionDish('dish-partial-b', '部分未知B', { energyKcal: 120, proteinDg: 10, fatDg: null, carbDg: 30 }, true),
  ]);
  const ctx = openNutritionStore(catalog);
  try {
    const prep = await ctx.store.ensureSelfPickNutrition(LUNCH);
    assert.equal(prep.ok, true, `核心应返回部分未知结果：${prep.message}`);

    const view = ctx.store.getSelfPickView(LUNCH);
    const a = view.windows[0].offers.find((offer) => offer.offerId === 'offer-dish-partial-a');
    const b = view.windows[0].offers.find((offer) => offer.offerId === 'offer-dish-partial-b');
    assert.deepEqual(a.nutrition, { energyKcal: 0, proteinDg: null, fatDg: 0, carbDg: null }, '已知 0 保留，未知仍为 null');
    assert.equal(a.nutritionKnown, true, '至少一项已知即不是全未知');
    assert.equal(a.nutritionComplete, false, '部分未知 nutritionComplete=false');
    assert.deepEqual(b.nutrition, { energyKcal: 120, proteinDg: 10, fatDg: null, carbDg: 30 }, '逐字段照抄核心结果');

    const preview = ctx.store.previewSelfPickDraft(LUNCH, 'w-nutrition', [
      { offerId: 'offer-dish-partial-a' },
      { offerId: 'offer-dish-partial-b' },
    ]);
    assert.equal(preview.ok, true, `预览应可用：${preview.message}`);
    assert.deepEqual(
      preview.nutritionSums,
      { energyKcal: 120, proteinDg: null, fatDg: null, carbDg: null },
      '有未知项的字段合计为 null，不补 0；蛋白质/脂肪有未知项，碳水也因一侧未知而为 null',
    );
    assert.deepEqual(preview.incompleteNutrients, ['蛋白质', '脂肪', '碳水'], '未完整字段逐项列出');
    assert.equal(preview.lines[0].nutrition.proteinDg, null, '草稿行逐字段保留 null');
    assert.equal(preview.lines[0].nutrition.energyKcal, 0, '已知 0 不写成未知');
    assert.equal(preview.lines[1].nutrition.fatDg, null, '另一行的未知字段同样保持 null');
  } finally {
    ctx.close();
  }
});

test('13 全未知：核心四项 null → 视图/预览保持未知（null），estimated 仍按核心透传', async () => {
  const catalog = nutritionCatalog([
    nutritionDish('dish-unknown-est', '全未知估算', { energyKcal: null, proteinDg: null, fatDg: null, carbDg: null }, true),
    nutritionDish('dish-unknown-plain', '全未知非估算', { energyKcal: null, proteinDg: null, fatDg: null, carbDg: null }, false),
  ]);
  const ctx = openNutritionStore(catalog);
  try {
    const prep = await ctx.store.ensureSelfPickNutrition(LUNCH);
    assert.equal(prep.ok, true, `核心应正常返回全未知结果：${prep.message}`);

    const view = ctx.store.getSelfPickView(LUNCH);
    const est = view.windows[0].offers.find((offer) => offer.offerId === 'offer-dish-unknown-est');
    const plain = view.windows[0].offers.find((offer) => offer.offerId === 'offer-dish-unknown-plain');
    assert.equal(est.nutrition, null, '核心四项 null → 视图未知（null），不是 0');
    assert.equal(est.nutritionKnown, false);
    assert.equal(est.nutritionComplete, false);
    assert.equal(est.estimated, true, '估算标记与营养值无关，仍按核心透传');
    assert.equal(plain.estimated, false);

    const preview = ctx.store.previewSelfPickDraft(LUNCH, 'w-nutrition', [
      { offerId: 'offer-dish-unknown-est' },
      { offerId: 'offer-dish-unknown-plain' },
    ]);
    assert.equal(preview.ok, true, `预览应可用：${preview.message}`);
    assert.equal(preview.nutritionSums, null, '全未知时合计必须为 null，不能补 0');
    assert.deepEqual(preview.incompleteNutrients, ['能量', '蛋白质', '脂肪', '碳水']);
    assert.ok(
      preview.lines.every((line) => line.nutrition === null && line.nutritionBasis === null),
      '全未知行不得伪造数值或营养来源',
    );
    assert.equal(preview.estimated, true, '含估算项时预览标 estimated');
  } finally {
    ctx.close();
  }
});
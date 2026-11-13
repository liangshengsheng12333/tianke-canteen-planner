// demo-storage-trace.mjs — T05 存储前后 / 请求关联 / 菜单原子替换 / 导出恢复 对照证据生成器。
//
// 输出 Markdown 到 stdout（Lead 转存到证据目录）。使用真实包内 WASM 与 mock wx 存储；
// 这是 Node 宿主证据，不是微信工具或红米真机证据。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = path.join(projectRoot, 'miniprogram', 'src');
const imp = (...segments) => import(pathToFileURL(path.join(src, ...segments)).href);

const { AppStore } = await imp('domain', 'store.ts');
const { createDefaultProfileDraft } = await imp('domain', 'profile.ts');
const { SIMULATED_CATALOG } = await imp('config', 'simulated-menu.ts');
const { canonicalSha256 } = await imp('utils', 'canonical-json.ts');
const { sha256Hex } = await imp('utils', 'sha256.ts');

const wasmPath = path.join(src, 'assets', 'wasm', 'mp_core.wasm');
const wasmBytes = fs.readFileSync(wasmPath);
const instantiate = async (p, imports) => ({ instance: new WebAssembly.Instance(new WebAssembly.Module(fs.readFileSync(wasmPath)), imports) });
const storage = new Map();
globalThis.wx = {
  getStorageSync: (key) => (storage.has(key) ? storage.get(key) : ''),
  setStorageSync: (key, value) => storage.set(key, value),
  removeStorageSync: (key) => storage.delete(key),
};

let clock = new Date('2026-10-20T19:00:00+08:00');
const now = () => clock;
const out = [];
const line = (text = '') => out.push(text);
const section = (title) => line(`\n## ${title}\n`);
const table = (rows) => {
  if (rows.length === 0) return;
  line('');
  const header = Object.keys(rows[0]);
  line('| ' + header.join(' | ') + ' |');
  line('|' + header.map(() => '---').join('|') + '|');
  for (const row of rows) line('| ' + header.map((key) => String(row[key]).replace(/\|/g, '\\|')).join(' | ') + ' |');
};

const day = (store) => store.peekState().days[store.peekState().activeDate];
const store = new AppStore({ instantiate, now, wasmPath });
store.init();

line('# T05 存储前后 / 请求关联 / 菜单替换 / 导出恢复 对照证据');
line('');
line(`- 生成时间：${new Date().toISOString()}`);
line(`- 宿主：Node ${process.version} / ${process.platform} ${process.arch}（**非微信运行时、非红米真机**）`);
line(`- WASM：${path.relative(projectRoot, wasmPath)}，${wasmBytes.length} 字节，SHA256 ${sha256Hex(wasmBytes).toUpperCase()}`);
line('- mock wx 存储：Map + JSON 字符串（模拟 setStorageSync/getStorageSync 持久化）');
line(`- 固定业务日期：2026-10-20（+08:00，tzOffsetMinutes=480）`);

// --- 1. 建档与存储 ---
section('1. 建档前后：本地存储与档案 revision');
const beforeProfile = store.getProfileView();
line(`- 建档前：saved=${beforeProfile.saved}，profileRevision=${beforeProfile.profileRevision}，存储键数=${storage.size}`);
const profileResult = store.saveProfile(createDefaultProfileDraft());
line(`- saveProfile：ok=${profileResult.ok}；message=${profileResult.message}`);
const afterProfile = store.getProfileView();
line(`- 建档后：saved=${afterProfile.saved}，profileRevision=${afterProfile.profileRevision}，档案摘要=${canonicalSha256(afterProfile.draft)}，存储字节=${store.getDevView().storageBytes}`);
line(`- 本地存储键：${[...storage.keys()].join(', ')}`);

// --- 2. 目标 ---
section('2. 营养目标（WASM 唯一计算）');
const target = await store.computeTarget();
const targetView = store.getProfileView().target;
table([
  { 项目: 'computeTarget.ok', 值: target.ok },
  { 项目: 'TargetResult.status', 值: targetView ? targetView.status : '-' },
  { 项目: 'daily', 值: targetView && targetView.daily ? JSON.stringify(targetView.daily) : '-' },
  { 项目: 'bmiLabel', 值: targetView ? targetView.bmiLabel : '-' },
  { 项目: '来源', 值: targetView ? targetView.sourceLabel : '-' },
]);

// --- 3. 方案与请求关联 ---
section('3. PlanRequest 关联口径（旧 T02 v2 字段）与方案结果');
const plan = await store.refreshPlan();
const requestText = store.getLastPlanRequest();
const request = JSON.parse(requestText);
table([
  { 字段: 'requestId', 值: request.requestId },
  { 字段: 'businessDate / tzOffsetMinutes', 值: `${request.businessDate} / ${request.tzOffsetMinutes}` },
  { 字段: 'profile.profileId / revision', 值: `${request.profile.profileId} / ${request.profile.revision}` },
  { 字段: 'catalog.menuVersion / catalogHash', 值: `${request.catalog.menuVersion} / ${request.catalog.catalogHash.slice(0, 24)}…` },
  { 字段: 'nutritionConfig.version / hash', 值: `${request.nutritionConfig.version} / ${request.nutritionConfig.hash.slice(0, 24)}…` },
  { 字段: 'plannerConfig.algorithm / strategies', 值: `${request.plannerConfig.algorithm} / ${request.plannerConfig.strategies.join(',')}` },
  { 字段: 'plannerConfig.limits', 值: request.plannerConfig.limits === undefined ? '未发送（默认限额）' : JSON.stringify(request.plannerConfig.limits) },
  { 字段: '是否含新 T01 搜索字段', 值: ['maxSearchNodes', 'maxDpStates', 'maxMealCandidatesPerMeal', 'wallClockMs'].filter((key) => requestText.includes(key)).join(',') || '无' },
  { 字段: 'planningMeals', 值: request.planningMeals.join(',') },
]);
const home = store.getHomeView();
const dayPlan = day(store).plan;
table([
  { 项目: 'refreshPlan.ok', 值: plan.ok },
  { 项目: 'PlanResult.status', 值: home.planStatus },
  { 项目: '方案数 / 选中', 值: `${home.plans.length} / ${home.selectedPlanIndex}` },
  { 项目: 'planKey', 值: home.plans.length > 0 ? JSON.parse(dayPlan.rawText).result.plans[0].planKey : '-' },
  { 项目: 'PlanRecord.revision / requestId', 值: `${dayPlan.revision} / ${dayPlan.requestId}` },
  { 项目: '每日餐次', 值: home.meals.map((m) => `${m.meal}:${m.items.map((i) => i.name).join('+') || '—'}`).join('；') },
  { 项目: '计划总价（已知）', 值: home.budget.plannedLabel },
]);

// --- 4. 确认幂等 ---
section('4. 实际记餐：确认幂等与汇总');
const beforeLogs = store.getLogsView().meals.map((m) => m.active.length).join('/');
const confirm1 = store.confirmMeal('breakfast', {});
const confirm2 = store.confirmMeal('breakfast', {});
const logsAfter = store.getLogsView();
const breakfastLog = logsAfter.meals.find((m) => m.meal === 'breakfast').active[0];
table([
  { 项目: '确认前各餐 active 条数', 值: beforeLogs },
  { 项目: '首次确认', 值: `${confirm1.ok} / duplicate=${!!confirm1.duplicate}` },
  { 项目: '重复确认', 值: `${confirm2.ok} / duplicate=${!!confirm2.duplicate}` },
  { 项目: '确认后各餐 active 条数', 值: logsAfter.meals.map((m) => m.active.length).join('/') },
  { 项目: 'confirmationId（幂等键）', 值: breakfastLog.confirmationId },
  { 项目: 'recordId / revision', 值: `${breakfastLog.recordId} / ${breakfastLog.revision}` },
  { 项目: '已知营养小计', 值: breakfastLog.knownEnergyLabel },
  { 项目: '已知实付', 值: `￥${(breakfastLog.priceKnownCents / 100).toFixed(2)}，价格不完整=${breakfastLog.priceIncomplete}` },
]);

// --- 5. 改记与撤销 ---
section('5. 改记 / 撤销：历史保留与汇总同步');
const editResult = store.editLog(breakfastLog.recordId, { items: [{ itemKey: breakfastLog.items[0].itemKey, unitPriceCents: 150 }] });
const afterEdit = store.getLogsView().meals.find((m) => m.meal === 'breakfast');
table([
  { 项目: 'editLog.ok', 值: editResult.ok },
  { 项目: 'active 条数', 值: afterEdit.active.length },
  { 项目: '历史（superseded）条数', 值: afterEdit.history.length },
  { 项目: '新记录 revision / supersedes', 值: `${afterEdit.active[0].revision} / ${afterEdit.active[0].supersedesRecordId}` },
  { 项目: '改后已知实付', 值: `￥${(afterEdit.active[0].priceKnownCents / 100).toFixed(2)}` },
]);
const revokeResult = store.revokeLog(afterEdit.active[0].recordId);
const afterRevoke = store.getLogsView();
table([
  { 项目: 'revokeLog.ok', 值: revokeResult.ok },
  { 项目: '早餐 active / revoked', 值: `${afterRevoke.meals[0].active.length} / ${afterRevoke.meals[0].history.length}` },
  { 项目: '当日已知实付', 值: `￥${(afterRevoke.intake.priceKnownCents / 100).toFixed(2)}` },
  { 项目: '当日餐次回到待处理', 值: afterRevoke.meals[0].canConfirm },
]);

// --- 6. 补记未知 ---
section('6. 补记未知价格 / 未知营养：未知不当 0');
const manual = store.addManualLog('lunch', {
  name: '酸奶（未知营养）',
  portionCode: 'full',
  quantity: 1,
  unitPriceCents: null,
  priceKnown: false,
  nutrition: null,
  note: '证据样例',
  clientToken: 'trace-manual-1',
});
const manualDuplicate = store.addManualLog('lunch', {
  name: '酸奶（未知营养）',
  portionCode: 'full',
  quantity: 1,
  unitPriceCents: null,
  priceKnown: false,
  nutrition: null,
  note: '证据样例',
  clientToken: 'trace-manual-1',
});
const afterManual = store.getLogsView();
table([
  { 项目: '首次补记 / 重复补记', 值: `${manual.ok} / ${manualDuplicate.ok}（duplicate=${!!manualDuplicate.duplicate}）` },
  { 项目: '能量 / 蛋白质', 值: `${afterManual.intake.energyLabel} / ${afterManual.intake.proteinLabel}` },
  { 项目: '营养不完整项', 值: afterManual.intake.incompleteNutrients.join('、') || '无' },
  { 项目: '未知价格项数 / 价格完整', 值: `${afterManual.intake.unknownItemCount} / ${afterManual.intake.priceIncomplete ? '不完整' : '完整'}` },
  { 项目: '预算核算', 值: afterManual.budget.message },
]);

// --- 7. 菜单预检拒绝 + 原子替换 ---
section('7. 菜单导入：预检拒绝不破坏原数据，成功替换后旧计划失效');
const goodCatalog = JSON.parse(JSON.stringify(SIMULATED_CATALOG));
goodCatalog.menuVersion = 'menu-simulated-v2-imported';
goodCatalog.catalogHash = canonicalSha256(goodCatalog, 'catalogHash');
const badCatalog = JSON.parse(JSON.stringify(goodCatalog));
badCatalog.catalogHash = 'sha256:' + '0'.repeat(64);
const beforeMenu = store.getMenuView();
const beforeDigest = canonicalSha256(store.peekState());
const badPreflight = await store.preflightMenu(JSON.stringify({ catalog: badCatalog }), 'bad-menu.json');
const afterBadState = store.peekState();
table([
  { 项目: '当前菜单版本', 值: beforeMenu.info.menuVersion },
  { 项目: '非法菜单预检 ok / stage', 值: `${badPreflight.ok} / ${badPreflight.stage}` },
  { 项目: '非法菜单错误', 值: badPreflight.message },
  { 项目: '预检失败后菜单版本不变', 值: store.getMenuView().info.menuVersion === beforeMenu.info.menuVersion },
  { 项目: '预检失败后整份状态摘要不变', 值: canonicalSha256(afterBadState) === beforeDigest },
]);
// 先加一个锁定与售罄，验证替换后锁定保留、售罄按新菜单整理
store.toggleItemLock('lunch', 'offer-chicken');
store.markSoldOut('dinner', 'dish-greens');
const lockBefore = day(store).itemLocks.length;
const planBefore = !!day(store).plan;
const goodPreflight = await store.preflightMenu(JSON.stringify({ catalog: goodCatalog }), 'good-menu.json');
const applyResult = store.applyMenu(goodPreflight);
const afterMenuState = store.peekState();
table([
  { 项目: '合法预检 ok / stage', 值: `${goodPreflight.ok} / ${goodPreflight.stage}` },
  { 项目: '预检差异（版本变更/受影响餐次）', 值: `${goodPreflight.diff.oldMenuVersion} → ${goodPreflight.diff.newMenuVersion}；受影响餐次=${goodPreflight.diff.impactedMeals.join(',') || '无'}` },
  { 项目: '确认替换 ok / 消息', 值: `${applyResult.ok}；${applyResult.message}` },
  { 项目: '替换前有旧计划 / 替换后 day.plan', 值: `${planBefore} / ${day(store).plan === null ? 'null（旧计划失效）' : '仍存在'}` },
  { 项目: '新菜单版本 / 来源', 值: `${store.getMenuView().info.menuVersion} / ${store.getMenuView().info.source}` },
  { 项目: '锁定保留条数（替换前 → 后）', 值: `${lockBefore} → ${day(store).itemLocks.length}` },
  { 项目: '售罄标记（替换后）', 值: day(store).soldOut.length },
  { 项目: 'catalogMeta', 值: JSON.stringify(afterMenuState.catalogMeta) },
]);

// --- 8. 导出 / 恢复 ---
section('8. 本地导出 → 恢复：摘要与逐项对照');
const exported = await store.exportBackup();
const restorePre = await store.preflightRestore(exported.text);
const restoreResult = await store.applyRestore(restorePre);
line(`- 导出摘要：${exported.digest}`);
line(`- 导出文本长度：${exported.text.length} 字符；文件路径：${exported.filePath || '未写入文件（Node 无 wx.env）'}`);
line(`- 恢复预检：ok=${restorePre.ok}，stage=${restorePre.stage}`);
line(`- 恢复摘要：${restoreResult.digest}；恢复 ok=${restoreResult.ok}`);
line(`- 恢复消息：${restoreResult.message}`);
table(restoreResult.comparison.map((row) => ({ 对照项: row.label, 恢复前: row.before.slice(0, 40), 恢复后: row.after.slice(0, 40), 一致: row.equal })));

// --- 9. 跨日隔离 ---
section('9. 跨日隔离：不迁移摄入/锁定/售罄');
const oldDate = store.peekState().activeDate;
const oldLogs = day(store).logs.length;
const oldLocks = day(store).itemLocks.length + day(store).windowLocks.length;
const oldSoldOut = day(store).soldOut.length;
clock = new Date('2026-10-21T08:30:00+08:00');
const rolled = store.ensureToday();
const newDay = day(store);
table([
  { 项目: 'ensureToday 返回（跨日）', 值: rolled },
  { 项目: '旧日期 / 新日期', 值: `${oldDate} / ${store.peekState().activeDate}` },
  { 项目: '旧日日志 / 锁定 / 售罄（保留）', 值: `${oldLogs} / ${oldLocks} / ${oldSoldOut}` },
  { 项目: '新日日志 / 锁定 / 售罄', 值: `${newDay.logs.length} / ${newDay.itemLocks.length + newDay.windowLocks.length} / ${newDay.soldOut.length}` },
  { 项目: '历史日只读（getLogsView 旧日期 canConfirm）', 值: store.getLogsView(oldDate).meals.some((m) => m.canConfirm) ? '可确认（异常）' : '不可确认（符合预期）' },
]);

line('\n---\n本文件由 `tools/miniprogram/demo-storage-trace.mjs` 生成；Node 宿主证据，不代表微信工具/红米真机结果。');
console.log(out.join('\n'));

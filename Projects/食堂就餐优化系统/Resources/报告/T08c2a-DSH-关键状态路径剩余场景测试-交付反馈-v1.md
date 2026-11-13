# T08c2a｜DSH｜关键状态路径剩余场景测试 — 交付反馈 v1

- 任务卡：`Resources/任务卡/T08c2a-DSH-关键状态路径剩余场景接替测试-v1.md`（接替 T08c2 未完成的场景2/3/4）
- 执行平台/窗口：DSH（主执行员 1 名 + 同模型子代理 3 名）
- 执行日期：2026-10-23（Asia/Shanghai）
- 唯一反馈（本文件）：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T08c2a-DSH-关键状态路径剩余场景测试-交付反馈-v1.md`
- 证据目录（沿用 T08c2 唯一证据目录）：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T08c2-ZCode-关键状态路径自动测试-证据-v1\`
- 权限边界：生产源码 `miniprogram/src/**`、`tools/miniprogram/**`、包内 WASM、正式菜单全部只读；agent-a 已交付证据只读；agent-b 的 ZCode 中断中间产物未删除/未覆盖/未作为结论引用；所有新文件只写证据目录。

## 0. 结论速览

| 场景 | 结果 | 新缺陷 |
|---|---|---|
| 场景1（已闭环，本卡不复测） | 仅引用 `agent-a/report.md`：4 用例 / 25 项全通过，DEFECT-T08A1-01 复现证实 | 0 |
| 场景2 单品餐次连续换菜与锁定 | **41/41 断言 PASS，0 FAIL，0 未测** | 0（DEFECT-T08A1-02 获 Node 路径实证） |
| 场景3 推荐→确认→重复确认→修改/撤销→重新生成 | **214 断言：212 PASS / 2 FAIL**；2 项均为产品口径不符，脚本/环境异常 0 | **2 条（均主要）**：DEFECT-S3-01、DEFECT-S3-02 |
| 场景4 跨日期记录、昨日回看、月汇总 | **91/91 检查 PASS，0 FAIL，0 未测** | 0 |

- 合计 **346 项断言/检查：344 PASS、2 FAIL（均为产品口径问题）、0 项因工具故障未完成**；场景2/4 的必做步骤全部真实执行，场景3 步骤 1—5 全执行并有可选步骤6加分。
- 候选身份：开工与收工两次复算均为 `sourceTreeDigest=sha256:d15bbe0eb2a73e9eba230c819288e9db180487df4ea1ab7b90516482e290f19e`，与基准一致（113/113 文件逐项相同，75 源码 / 38 工具，WASM 冻结身份匹配）；收工复算未变，证明测试未改生产文件。
- **两条新缺陷均经主执行员独立复现**（见 §7 与附录 A），不是子代理单方面报告；其余结论由主执行员重跑三个场景脚本复核（§3.2）。

## 1. 模型、身份与执行分工（如实记录）

| 项 | 记录 |
|---|---|
| 派单请求模型 | DeepSeek V4.1 Flash（任务卡第 16 行指定） |
| 本窗口实际标称模型 | `deepseek-v4.1-flash-1017`（DSH 会话模型标识，主执行员与 3 名子代理同一标识） |
| 平台服务端实际型号/档位 | **未知**：本窗口无法从平台侧核实服务端实际型号/档位/额度，不把请求配置当实际证明 |
| 子代理 | 3 名（s2-b / s3-c / s4-c），均为 fresh context 独立会话，同一写入边界约束；实际可开启 3 名，未超过任务卡上限 3 |
| 每名子代理平台可见模型 | 均只能看到本会话标称标识 `deepseek-v4.1-flash-1017`；各自服务端实际档位 **未知** |
| 主执行员职责 | 候选身份核验、子代理派单与写域划分、全部产物验收、脚本重跑、缺陷独立复现、唯一反馈合并去重 |
| 宿主声明 | 全程 **Node.js v24.19.0 宿主 + 包内真实 WASM + mock wx**；**不是微信开发者工具、不是微信模拟器、不是红米真机**，不能冒充真机/模拟器证据 |

## 2. 候选身份核验（开工 + 收工）

- 基准：`Resources/报告/T05U06a2-P01-接收与T08a1候选证据-v1/manifest.json`，`sourceTreeDigest=sha256:d15bbe0e…f19e`。
- 开工复算：`node tools/miniprogram/candidate-manifest.mjs --out "Resources/报告/T08c2-ZCode-关键状态路径自动测试-证据-v1/identity-dsh"`
  - 结果：`sourceTreeDigest=sha256:d15bbe0eb2a73e9eba230c819288e9db180487df4ea1ab7b90516482e290f19e`；75 源码文件 / 872,829 B；38 工具文件 / 447,791 B；包内 WASM 107,472 B / `B53C7405A643E8409071ED76D3CB4CCBDF1A37E6E5C408CE1D4A373D4CC00744`，`matchesFrozen=true`。
  - 主执行员另做逐文件比对：本次 113 项 `路径|字节|sha256` 与基准 manifest **113/113 完全一致**。
- 收工复算：`--out ".../identity-dsh-final"`，摘要与文件数、字节数、WASM 身份**全部不变**（证明测试期间生产源码/工具/WASM 未被修改）。
- 证据：`...\证据-v1\identity-dsh\manifest.json`、`identity-dsh\hashes.sha256`、`identity-dsh-final\`。

## 3. 执行方式与命令

### 3.1 装载方式（三场景一致）

- 真实 `AppStore`（`miniprogram/src/domain/store.ts`）+ 包内真实 WASM（`t05-test-helpers.mjs` 的 `createRealInstantiate()` + `wasmPath`，Node `WebAssembly` 实例化）+ `createMockWx()`（Map 存储、字符串持久化、模拟杀进程后只剩文本）+ 注入时钟 `new AppStore({instantiate, wasmPath, now: clock})`。
- 页面事件路径：真实加载 `pages/home/index.ts` / `pages/logs/index.ts`（`globalThis.Page/getApp/getCurrentPages` 桩），`getApp().globalData.store` 挂真实 store；`wx.showToast`/`showActionSheet` 换成记录器（ActionSheet 按队列返回 `tapIndex`）。
- 菜单：`config/west1-menu.ts` 的 `WEST1_MENU_CATALOG` 经 `store.preflightMenu(JSON.stringify(...), '西院西一食堂-首批菜单.json')` + `store.applyMenu(...)` 启用（与 `pages/menu/index.ts:337` 正式内置菜单导入同源）；场景4 另用内置模拟菜单做跨日基线。
- 证据只写证据目录，未使用 `t05-test-helpers.writeEvidenceJson`（不写共享 `.toolchain/tmp`）。

### 3.2 复跑命令（项目根 `D:\项目\cpp\Projects\食堂就餐优化系统`）

```powershell
# 身份（开工/收工各一次）
node tools/miniprogram/candidate-manifest.mjs --out "Resources/报告/T08c2-ZCode-关键状态路径自动测试-证据-v1/identity-dsh-final"

# 场景2（期望：断言 41 项，通过 41，失败 0；exit 0）
node --import ./tools/miniprogram/register-ts.mjs "Resources/报告/T08c2-ZCode-关键状态路径自动测试-证据-v1/agent-b/dsh/dsh-case-swap-lock.mjs"

# 场景3（期望：总计 212/214 通过，2 失败均为产品口径；exit 1 属设计行为）
node --import ./tools/miniprogram/register-ts.mjs "Resources/报告/T08c2-ZCode-关键状态路径自动测试-证据-v1/agent-c/dsh/s3/dsh-case-s3.mjs"

# 场景4（期望：通过 91 项，失败 0；exit 0）
node --import ./tools/miniprogram/register-ts.mjs "Resources/报告/T08c2-ZCode-关键状态路径自动测试-证据-v1/agent-c/dsh/s4/dsh-case-crossday.mjs"

# 主执行员独立复核两条新缺陷（期望：20 项检查通过 20，失败 0；exit 0）
node --import ./tools/miniprogram/register-ts.mjs "Resources/报告/T08c2-ZCode-关键状态路径自动测试-证据-v1/agent-c/dsh/lead/dsh-lead-recheck-s3-findings.mjs"
```

主执行员已亲自重跑以上 4 个命令：结果依次为 41/41 (exit 0)、212/214 (exit 1，失败项即两条缺陷)、91/91 (exit 0)、20/20 (exit 0)。

### 3.3 隔离说明

- 场景2：用例 A—F 各用一份全新 mock wx + 新 AppStore，不共享状态。
- 场景3：C1—C6 各用全新 mock/时钟/store（用例间 `coreRuntime.resetCore()`）。
- 场景4：C1—C4 **有意共用同一 mock 存储**以完成「10-19 写入 → 跨日 → 10-20 写入 → 冷启动重开」的连续状态链（cross-day 语义要求持久化文本连续，这是任务卡日期接缝所必需）；C5 跨月用独立 mock。该例外在 s4 报告 §1 已声明。

## 4. 场景2｜单品餐次连续换菜与锁定（agent-b/dsh）

- 脚本：`agent-b/dsh/dsh-case-swap-lock.mjs`（公共装载 `agent-b/dsh/dsh-lib.mjs`）；原始输出 `dsh-run-log.txt`（另存 UTF-8 版）。
- 结果：**41/41 PASS，0 FAIL，0 未测**。逐用例：A 首页事件路径 20 项；B store 直驱首换 3 项；C 锁定态 store 直驱 3 项；D 次级页入口穷尽 5 项；E 多菜品对照 8 项；F 跨窗口补充 2 项。

关键事实（均有 JSON 快照 + 日志）：

1. 基线：`saveSettings({maxItemsPerMeal:1})` + 西一菜单 → 早餐单品 `offer-shredded-pancake`（手抓饼），`itemLocks=[]`、`replaceable=1`、`swappableOffers=3`。
2. 第一次换菜（页面事件真实调用 `page.onSwapMeal()`）：成功换入 `offer-shandong-pancake`；**换入项被强制写入 `itemLocks`**（`domain/store.ts:761`），`items[].locked=true`、页面 `replaceable=0`；持久化该日桶与内存一致。
3. 第二次换菜（同一页面路径）：被 `pages/home/index.ts:735-738` 拦截，Toast「没有可替换的菜品（锁定项不能直接换）」；**store 零写入**——持久化整串 sha256 前后相同（`d796660b…98c5`）、`setStorageSync` 调用数 6→6、未弹 ActionSheet。
4. 可达路径穷尽：
   - (a) 先 `toggleItemLock` 解锁再换：**可达**。首页详情面板 `onToggleItemLock` 的 dataset 由 `home/index.wxml:313-314` 的 `data-meal="{{card.meal}}"`/`data-offer="{{item.offerId}}"` 提供；解锁成功后 `replaceable=1`，再次 `onSwapMeal` 成功（再次上锁）；dataset 缺 `meal` 时回退 `this.data.activeMeal` 也可解锁。
   - (b) 次级页/其他页面入口：**不可达**。11 个页面模板静态枚举只有 home 含换菜/锁定事件绑定；self-pick/menu/logs 页面模块真实加载后均无 swap/lock 处理器，自选页真实驱动也无可换菜/解锁字段。
   - (c) 锁定态 store 直驱 `swapOffer`：**可达**（`ok=true`，`status=OkPartial`），但页面无入口——证明拦截点是页面过滤而非 store 拒绝。
5. 对照组：默认 `maxItemsPerMeal=3` 下核心首选方案三餐均为单品；改用核心备选方案 index=2（lunch 为 2 道肠粉，经页面真实 `onSelectPlan`）构造 ≥2 菜品餐次。换一份成功后，**同窗替换把「剩余菜品 + 换入菜品」整餐写入 `itemLocks`**（`store.ts:749-761` 设计分支），页面 `replaceable=0`——任务卡第 46 行「强制锁定只作用于换入单品」的预期**不成立**；该现象与 DEFECT-T08A1-02 同一机制（既有代码注释明示「把替换后的整餐 offerId 集合写成 itemLocks」），不另开新缺陷编号。
6. 跨窗口补充：跨窗换菜只锁换入单品并把该餐窗口锁移到目标窗口（`store.ts:752-765`），与同窗分支不同；页面不可达，仅 store 直驱可测。
7. **DEFECT-T08A1-02 Node 路径实证成立**：`domain/store.ts:761` 强制写锁 → `pages/home/index.ts:735-738` 过滤后二次换菜被 Toast 拦截，且页面零写入。

证据：`agent-b/dsh/dsh-case2-result.json`（`checksSummary`、`cases.A.zeroWrite`、`cases.C.lockedStateSwap`、`cases.E.conclusion`）、`dsh-caseA–F*.json`、`dsh-report.md`。

## 5. 场景3｜推荐→确认→重复确认→修改/撤销→重新生成（agent-c/dsh/s3）

- 脚本：`agent-c/dsh/s3/dsh-case-s3.mjs`；证据统一在 `agent-c/dsh/s3/`（本反馈按 `s3/` 前缀引用）。
- 结果：**214 断言：212 PASS / 2 FAIL**（2 项均为产品口径不符；脚本/断言/环境异常 0）。逐用例：

| 用例 | 覆盖 | 断言 | 结果 |
|---|---|---|---|
| C1 | 生成推荐→confirmMeal→持久化 MealLog 结构逐字段、支出/营养小计、记录页/首页一致 | 46 | PASS |
| C2 | 同餐重复确认 ×3、同 clientToken 重复补记、月汇总餐数不重复 | 24 | PASS |
| C3 | editLog（superseded + revision+1 + supersedes 链）、revokeLog（revoked）、摘要回退、拒绝分支不写盘 | 40 | PASS |
| C4 | 确认早餐后 refreshPlan：日志不丢、只规划剩余餐次、剩余预算一致 | 27 | PASS |
| C4b | 全部餐次确认后再 refreshPlan：计划不计为已吃的预算判定 | 13 | **FAIL 1（DEFECT-S3-01）** |
| C5 | 未知营养口径：同餐多已知累加、已知+未知整项 null、页面不得显示 0 | 41 | **FAIL 1（DEFECT-S3-02）** |
| C6（可选加分） | 真实 `pages/logs/index.ts` 页面 handler 驱动确认→改记→撤销 | 23 | PASS |

关键事实：

1. 确认落库：`MealLog` 顶层 14 字段齐全（`contractVersion=1.0`、`recordId`、`confirmationId`、`businessDate`、`tzOffsetMinutes=480`、`meal`、`status=active`、`revision=1`、`supersedesRecordId=null`、`revokedByRecordId=null`、`createdAt/updatedAt`、`menuVersion`）；items 13 字段齐全，价格=菜单价、`nutritionBasis` 与菜单 `estimated` 一致。
2. 重复确认：第 2/3 次均 `{ok:true, duplicate:true}`「该餐已确认过，本次点击未重复累计」；日志条数 1→1，金额/营养/itemCount 不翻倍；同日同餐补记不重复计餐（月汇总餐数不重复），与 PRD「重复确认不重复累计/补记不重复计餐」一致。
3. 修改/撤销：edit 生成新 revision、旧记录 superseded、`supersedesRecordId` 指向旧记录，支出与已知营养按新值回退/更新；revoke 后 status=revoked，intake 支出回 0、营养回空、`consumedMeals=[]`；对 superseded/revoked 再 edit/revoke 均返回失败且持久化逐字节不变（拒绝分支不写盘）。
4. 重新生成：部分确认后 `refreshPlan()` 成功，日志不丢、只规划剩余餐次（请求 `planningMeals=['lunch','dinner']` 且携带已吃快照），刷新后预算 `plannedKnownCents=2200 ≤ remainingKnownCents=2450`、`overBudget=false`，与 PRD §3.2 一致。
5. 未知营养口径（聚合层正确）：西一菜单 35 菜中 31 菜营养未知；同餐「已知+未知」确认后记录 nutrition 四项 null（未写成 0）、`priceKnown=true` 且单价 700；`summarizeActiveLogs().knownSums` 与 intake 四项整项 null、`incompleteNutrients=['能量','蛋白质','脂肪','碳水']`、四标签均「未知」、`unknownItemCount=1`、`priceKnownCents=1500`、`priceIncomplete=false`；首页卡片热量区正确显示「热量待补全」。
6. 失败点：见 §7 两条新缺陷。

证据：`agent-c/dsh/s3/dsh-case-run-summary.json`（逐条断言）、`dsh-run-log.txt`、`dsh-case1…6/4b*.json`、`dsh-report.md`。

## 6. 场景4｜跨日期记录、昨日回看和月汇总（agent-c/dsh/s4）

- 脚本：`agent-c/dsh/dsh-case-crossday.mjs`；原始输出 `dsh-run-log.txt`。
- 结果：**91/91 PASS，0 FAIL，0 未测**（C0 环境 4；C1 10-19 记录构造 21；C2 跨日/冷启动 12；C3 10-20 记录 8；C4 覆盖干扰与历史不变 39；C5 跨月边界 7）。

关键事实（均有前后快照 JSON）：

1. **日期接缝（真实接缝，未改系统时间）**：注入时钟 `2026-10-19T08:00+08:00` 建档写入 → 同一实例 `ensureToday()` 返回 `true`、`activeDate=2026-10-20`、新桶为空 → 以「同一 mock 持久化文本 + 新 AppStore + init()」模拟杀进程重开（返回「已恢复本地数据」、业务日期 2026-10-20）。未退回手工构造 businessDate 数据的替代方案。
2. 昨日回看：`getLogsView('2026-10-19')` active 项与写入时快照逐项一致（价格/营养/记录 id/状态/menuVersion）；历史视图 `canConfirm` 全 false（只读回看）；intake 与写入时一致。
3. 月汇总（真实 store `getMonthLogs` + `summarizeMonthLogs`，与月历同口径）：
   - M1（仅 10-19）：1 天 / 2 餐 / 已知 1300 分 / 653 kcal；
   - M2（+10-20 早餐）：2 天 / 3 餐 / 1600 分 / 1221 kcal；
   - M3（+10-20 未知营养晚餐 + 同餐补记 + 锁定）：2 天 / 4 餐 / 2650 分 / 653 kcal + `energyIncomplete=true`；
   - 计划不计为已吃（有方案未确认的餐不进汇总）；补记同餐不重复计餐；未知营养不按零（整日不加入已知热量且标不完整）；每个阶段均与脚本内独立循环重算逐字段一致。
4. 覆盖干扰：切到西一菜单（`preflightMenu`+`applyMenu`）+ 今日确认/换菜/锁定/补记 + 再互切回模拟菜单后：
   - 10-19 DayRecord 原始 JSON **逐字节一致**（`sha256=1c4c5e4a…e734`，`deepDiff=[]`；主执行员另行独立比对对象亦相同）；
   - 昨日回看数值/intake/canConfirm 全部不变；月汇总昨日分量与 M1 一致；
   - 今日写操作只落 10-20 桶，所有记录的 `businessDate` 与桶键一致；菜单切换未改写历史记录快照（`nameSnapshot`/`menuVersion`/营养）。
5. 跨月粗验：真实 9-30→10-01 跨日，10 月汇总排除 9-30（10 月仅 1 天/1 餐/150 分）。
6. 新缺陷 0；2 条非缺陷观察（`ItemView.nutritionKnown` 语义、跨窗口换菜连带窗口锁），报告 §8 已标明不判缺陷。

证据：`agent-c/dsh/s4/dsh-case-summary.json`、`dsh-before-day1.json`、`dsh-crossday-restart.json`、`dsh-before-menu-switch.json`、`dsh-after-menu-switch.json`、`dsh-month-boundary.json`、`dsh-run-log.txt`、`dsh-report.md`。

## 7. 缺陷清单（新发现 / 已知复现 / 去重）

### 7.1 新缺陷（仅 2 条，均「主要」，均经主执行员独立复现）

#### DEFECT-S3-01｜全部餐次确认后旧计划总价仍参与超支判定，误报「已超出预算」（主要）

- 源码位置：
  - `miniprogram/src/domain/logs.ts:275-277`：`overBudget` 第三分支把 `plannedKnown > remainingKnown` 当超支，未排除「计划项已全部确认/已吃」；
  - `miniprogram/src/domain/plan.ts:860`：`budgetInput` 直接取旧 `day.plan` 的 `selectedPlan.budget`；
  - `miniprogram/src/domain/store.ts:530-534`：无待规划餐次时 `refreshPlan()` 提前成功返回、**保留旧 `day.plan`**（不置空），旧计划总价长期参与判定；
  - 文案 `logs.ts:300-302`。
- 最短复现（Node 宿主，真实 store/WASM，西一菜单，预算 5000）：
  1. `refreshPlan()` → 计划总价 2750；
  2. `confirmMeal('breakfast', {})`、`confirmMeal('lunch', {})`、`confirmMeal('dinner', {})`（各 1 次成功，实际支出 2750）；
  3. `getHomeView().budget` → `plannedKnownCents=2750, spentKnownCents=2750, remainingKnownCents=2250, overBudget=true`，文案「已超出预算：计划 ￥27.50 / 剩余可用 ￥22.50…」；
  4. 首页 `buildSummary` 把 `overBudget=true`、`overageLabel=￥5.00` 以危险样式暴露给用户；`planState` 仍为 `ok`（类型里的 `all-handled` 状态从未被赋值，`types.ts:574`）。
  5. 同根因第二复现：预算 3000、仅确认早餐 550，刷新前 `overBudget=true`（旧计划 2750 > 剩余 2450），`refreshPlan()` 后新计划 2200、`overBudget=false`。
- 期望：实际支出 2750 ≤ 预算 5000 且无剩余待规划餐次时 `overBudget=false`；推荐价只用于计划，确认后计入实际支出，不得与旧计划重复计（PRD §3.2「推荐价格仅用于计划，确认后才计入实际支出」「剩余可用预算=全天预算−当天实际支出」「后续主方案总价不得超过此余额」）。
- 性质：产品聚合口径问题；不写坏数据，但首页/记录页给出错误财务结论（假超支 ￥5.00）。
- 证据：`agent-c/dsh/s3/dsh-case4b-all-confirmed-budget.json`、`dsh-case4-replan.json`；主执行员独立复现 `agent-c/dsh/lead/dsh-lead-r1-budget.json`（R1 10/10 PASS）。

#### DEFECT-S3-02｜今日页明细把未知营养菜显示为「能量 0 kcal」（主要）

- 源码位置：
  - `miniprogram/src/domain/plan.ts:424-431`：计划项只要有 `item.nutrition` 对象即整块保留（四项可能全 null）；
  - `plan.ts:432-433`：只在 `!nutrition` 时追加「营养未知」；`:450` `nutritionKnown = !!nutrition`（全 null 对象也为 true）；`:455` 因此 `unknownLabel=''`；
  - `miniprogram/src/pages/home/index.ts:88`：`Math.round(nutrition.energyKcal)` 对 null 得 0；`formatGramsFromDg(null)` 返回「待补全」后仍拼 `g`；`:473` 用 `item.nutrition ? …` 判断对象真假（全 null 对象为真）→ 走数值分支。
- 最短复现（西一菜单，预算 5000）：
  1. `toggleItemLock('lunch','offer-lean-pork-changfen')` + `toggleItemLock('lunch','offer-ham-changfen')`（同窗，否则 LockConflict）；`refreshPlan()`；
  2. `getHomeView().meals[lunch].items` 中火腿肠粉 `nutrition={energyKcal:null,…}`、`nutritionKnown=true`、`unknownLabel=''`；
  3. 加载真实 `pages/home/index.ts`，`buildDetail(lunchView)` → 该项 `nutritionText="能量 0 kcal · 蛋白 待补全g · 脂肪 待补全g · 碳水 待补全g"`。
- **可达性补充（主执行员实测）**：不经直调锁定，仅用页面同构的「换菜」换入未知营养报价（`offer-cpky-cuipi-kaoya-fan`，西一 31 道未知之一）后，首页明细同样显示「能量 0 kcal」——即该显示缺陷在「换菜」正常路径即可出现，31/35 菜营养未知使其具备现实触发面。
- 期望：未知营养项不得出现 0 kcal / 0 g，应显示「营养待补全/营养未知」（PRD R09「营养未知不当零」、§3.1「已知为零与未知分开」）。
- 性质：显示层口径问题；intake/knownSums/记录页/预算等聚合口径均正确，同页卡片热量区也正确显示「热量待补全」，仅今日页明细单行错误。
- 证据：`agent-c/dsh/s3/dsh-case5-nutrition.json`（`c5b.lunchPlanItems`、`c5c.pageDetailNutritionText`、`pageDetailItem`）；主执行员独立复现 `agent-c/dsh/lead/dsh-lead-r2-unknown-zero.json`（R2 10/10 PASS，含换菜可达路径）。

### 7.2 已知缺陷复现（不算新缺陷）

- **DEFECT-T08A1-02**（`domain/store.ts:761` 换菜强制写 `itemLocks` + `pages/home/index.ts:735-738` 过滤拦截二次换菜）：本卡场景2 已获 **Node 路径完整实证**（含页面事件路径、二次换菜零写入、详情面板解锁后可再换、store 直驱可换、跨窗分支差异）。按任务卡第 33 行口径，本卡只做实证、不重复编号；**未发现其判定点之外的新证据**。
- **DEFECT-T08A1-01**（`pages/home/index.ts:263-273` 漏传 `meal`）：本卡未复测（任务卡明确场景1 已闭环不复测），仅引用 `agent-a/report.md`。
- `agent-a` 的 1 条观察（`preflightMenu.diff.invalidLocks` 不含 `offerId`）：本卡未重复上报；场景4 切菜单后「保留 3 条失效锁定」仅为同源现象记录，不另立缺陷。

### 7.3 去重说明

- 两条新缺陷与 DEFECT-T08A1-01/02、agent-a 观察均不重叠：前者属「预算聚合把已吃计划重复计入」，后者属「今日页明细把 null 营养渲染成 0 kcal」，均未被上述两项覆盖。
- 与既有已交付结论边界（已核对 `T06b-反重力-固定候选业务闭环验证-交付反馈-v1.md`）：该报告情境1「未知营养在视图中标 null/未知、绝未虚假显示 0 kcal」核的是计划/卡片的 nutrition 字段与聚合值，未覆盖「今日页明细行把 null 渲染成 0 kcal」的页面路径（DEFECT-S3-02 为页面层新观测，同时说明 T06b 该结论的适用范围应限定为字段/聚合层）；情境3「余餐预算」只验证「确认一餐后的剩余可用/未知实付」，未覆盖「全部餐次确认后旧计划仍参与 overBudget」（DEFECT-S3-01 为新缺陷）。
- 与 T08c1（微信开发者工具 AI 模拟器主流程巡检）属不同宿主与口径：本卡为 Node 离线路径测试，不替代模拟器/真机结论；若两者结论冲突，以各自证据为准并交 P01 裁定。
- 未发现「阻断」级缺陷；两条新缺陷建议 P01 合并去重后统一排修复卡，不并入本卡范围。

## 8. 非缺陷观察（供 P01 合并判断，不新增编号）

1. **换菜后「换一份」按钮仍可见可点**：`pages/home/index.ts:429-434` 的 `canSwap` 只看 `hasPlan/items.length/swappableOffers/ended/confirmed`，不看 `locked`；换菜后 `replaceable=0` 但 `canSwap` 仍 true，点击才被 `:735-738` 拦下。现象与 DEFECT-T08A1-02 同源，建议并入该缺陷记录而不另开编号（场景2 A10b/E8）。
2. **多菜品同窗换菜整餐上锁**：`store.ts:749-761` 有意把「剩余菜品 + 换入菜品」写入 `itemLocks`（代码注释明示），页面效果与任务卡第 46 行预期「只锁换入单品」不符；属 DEFECT-T08A1-02 同一机制的设计分支，不是新缺陷（场景2 E5/E6）。
3. **跨窗口换菜连带窗口锁**：跨窗分支只锁换入单品并把该餐 `windowLocks` 移到目标窗口（`store.ts:752-765`），与同窗分支语义不同；页面无入口、仅 store 直驱可测（场景2 F1/F2、场景4 记录）。
4. **`planState` 的 `all-handled` 从未被赋值**：`types.ts:574` 类型含该状态、首页徽标映射也支持，但 `getHomeView()` 在全部餐次确认后仍返回 `ok`；与 DEFECT-S3-01「旧计划仍被当成当前计划」同一根因，属实现缺口观察（主执行员 R1 记录）。
5. **`ItemView.nutritionKnown` 语义**：计划项营养四项全 null 时仍为 true（`plan.ts:450`），记录页/自选页用「营养已知」判定时需注意；该语义问题正是 DEFECT-S3-02 的直接入口（场景3 C5b、场景4 §8）。
6. **未知营养聚合口径与 PRD 表述差异（待裁定，非本卡缺陷）**：PRD §3.1 写「已吃食物含未知项时，按营养素分别显示已知小计及『不完整』」，现行实现为「任一未知项 → 该营养素 knownSums 整项 null，只显示未知/不完整、不显示已知小计」（`logs.ts:56-118`，代码注释明确此为本项目口径）。本卡按现行口径验证并通过（未知未按 0）；是否需修订 PRD 措辞或实现，交 P01 裁定，不作为本轮新缺陷。

## 9. 覆盖边界与受限项（不得冒充的结论）

1. **全程 Node.js v24.19.0 离线宿主 + mock wx + 包内真实 WASM**：等价于「逻辑层真实源码执行」，**不代表**微信渲染层行为；WXML 绑定只做源文本静态核实，未渲染事件树；不能替代微信开发者工具模拟器或红米真机证据。
2. 页面文案结论来自真实页面模块函数运行时（`buildDetail`/`buildCard`/`buildSummary`/handler），不是 WXML 渲染后的视觉证据。
3. 未覆盖：真机/模拟器视觉与触控、真实杀进程（用「同一 mock + 新 AppStore + init()」模拟）、00:00 边界/时区/DST/时钟回拨、`MAX_KEPT_DAYS=14` 历史裁剪、跨年、备份/恢复、未知实付价确认链路（`priceEdits:null`）、`refreshPlan` 的 stale 响应丢弃分支、自选菜（self-pick）落账（T06b 已覆盖）、月历 UI 渲染、售罄与预算/窗口锁在换菜中的交互。
4. 场景2 的多菜品餐次由核心备选方案 index=2 构造（默认 `maxItemsPerMeal=3` 下首选三 meal 均为单品），未造任何假菜单/假数据；场景4 的 C1—C4 共用同一 mock 属跨日连续性所需，已声明。
5. 营养未知一律未按零处理；本反馈所有金额为整数分、营养宏量单位为 0.1g。

## 10. 证据索引（T08c2 唯一证据目录下）

| 路径（相对 `...\T08c2-ZCode-关键状态路径自动测试-证据-v1\`） | 说明 |
|---|---|
| `identity-dsh\manifest.json`、`identity-dsh\hashes.sha256` | 开工候选身份复算（d15bbe0e…f19e，113 项一致） |
| `identity-dsh-final\` | 收工候选身份复算（摘要未变，证明只读） |
| `agent-b\dsh\dsh-report.md` + `dsh-case-swap-lock.mjs`、`dsh-lib.mjs`、`dsh-case2-result.json`、`dsh-caseA–F*.json`、`dsh-run-log*.txt` | 场景2 全部证据（dsh- 前缀新文件；agent-b 根下旧中间产物未动） |
| `agent-c\dsh\s3\dsh-report.md` + `dsh-case-s3.mjs`、`dsh-run-log.txt`、`dsh-case-run-summary.json`、`dsh-case1…6/4b*.json` | 场景3 全部证据 |
| `agent-c\dsh\s4\dsh-report.md` + `dsh-case-crossday.mjs`、`dsh-run-log.txt`、`dsh-case-summary.json`、`dsh-before/after*.json`、`dsh-month-boundary.json` | 场景4 全部证据 |
| `agent-c\dsh\lead\dsh-lead-recheck-s3-findings.mjs`、`dsh-lead-recheck-run-log.txt`、`dsh-lead-r1-budget.json`、`dsh-lead-r2-unknown-zero.json`、`dsh-lead-recheck-summary.json` | 主执行员对两条新缺陷的独立复现证据（20/20 PASS） |
| `agent-a\report.md` | 场景1（本卡不复测，仅引用） |

## 11. 结论与下一步（不越权）

- 本卡范围（场景2/3/4）**已全部执行并落盘证据**；场景1 按卡不复测。场景2、4 全通过；场景3 暴露 2 条新缺陷（均「主要」，均经独立复现）。
- 未发现阻断级问题；DEFECT-T08A1-02 的 Node 路径实证已补齐，T08a1 真机反馈的「单菜餐次换一份后锁死」在逻辑层得到解释。
- 建议 P01：将 DEFECT-S3-01/02 与既有缺陷去重分级后统一排修复卡，并考虑把「换菜后按钮仍可点」「多菜品整餐上锁」并入 DEFECT-T08A1-02 记录；P02 若需查收，先读本反馈 §4—§7，再按 §10 打开对应脚本与快照。真实微信模拟器/真机复核仍须另卡，不因本卡 Node 证据而视为已通过。
- 本卡未修改任何生产源码/工具/WASM/正式菜单/既有证据；MEMORY 等岗位文件未改动（按项目约定由 P01/P02 维护）。

---

## 附录 A｜主执行员独立复核记录（防单方面结论）

| 复核动作 | 命令 | 结果 |
|---|---|---|
| 候选身份开工 | `candidate-manifest.mjs --out .../identity-dsh` | `d15bbe0e…f19e`；与基准 manifest 113/113 逐项相同；WASM 匹配 |
| 候选身份收工 | `... --out .../identity-dsh-final` | 摘要/文件数/字节/WASM 全部未变 |
| 场景2 重跑 | `dsh-case-swap-lock.mjs` | 41/41 PASS，exit 0；二次换菜零写入（rawText sha 前后相同、setStorageSync 6→6）独立核对一致 |
| 场景3 重跑 | `dsh-case-s3.mjs` | 212/214，2 项失败与报告一致，exit 1（设计行为） |
| 场景4 重跑 | `dsh-case-crossday.mjs` | 91/91 PASS，exit 0；10-19 桶前后对象比对一致（另行独立计算） |
| DEFECT-S3-01 复现 | `dsh-lead-recheck-s3-findings.mjs`（R1） | 预算 5000、已吃 2750、旧计划 2750 → `overBudget=true`、`overage=￥5.00`；首页汇总同样暴露 |
| DEFECT-S3-02 复现 | 同上（R2，含换菜可达路径） | `nutritionText="能量 0 kcal …"`、`nutritionKnown=true`、`unknownLabel=''`；锁定构造与换菜构造均复现 |
| 页面绑定核实 | 读 `pages/home/index.wxml` | 详情面板 `:313-314` 为 `data-meal="{{card.meal}}"`（支持解锁可达结论） |

- 复核脚本退出码：R1/R2 合计 20/20 PASS，exit 0；原始输出 `agent-c\dsh\lead\dsh-lead-recheck-run-log.txt`。
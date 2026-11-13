# T08G02 · ZCode GLM5.3 · 套餐、预算与记录专项 · 交付反馈 v1

| 项 | 内容 |
|---|---|
| 主任务卡 | `Resources/任务卡/T08G02-ZCode-套餐预算记录专项小卡-v1.md` |
| 定位 | 专项检查（只审不修、不做性能结论）；**不是最终验收** |
| 请求模型 | ZCode 子代理，GLM 5.3 |
| 实际可见模型/档位 | 客户端会话模型 `GLM-5.3-Flash`（account:zai-start-plan）；**服务端实际路由/档位未知** |
| 执行/写入 | T08G02 子代理单写入者；只写本证据目录与本文反馈，未写生产、未写其他证据目录、未写共享 tmp |
| 聊天 cwd / 项目根 | `D:\项目\cpp` / `D:\项目\cpp\Projects\食堂就餐优化系统` |
| 证据目录 | `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T08G02-ZCode-套餐预算记录-证据-v1\` |
| 状态 | **专项检查完成：3 个低severity缺陷（合并同根因后 3 条）+ 若干观察；核心链路在 Node/mock 环境全部通过** |

---

## 1. 固定身份（现场复验）

| 项 | 值 | 复验方式 |
|---|---|---|
| 固定 candidate | `Resources\报告\T05U09-DSH-体验收尾归集-证据-v1\candidate\` 的副本 → 本证据目录 `candidate\` | 复制后在本副本上重算 |
| 候选树摘要 | `sha256:7f6a6ea5071626afeb817592f5ad10f105481a2fbefdfee0b8c4b98626aeba42`（75 源文件 / 996165 B；45 工具 / 649001 B） | `candidate/tools/miniprogram/candidate-manifest.mjs` 在本副本上重算一致；存档 `manifest/manifest.json` |
| 冻结 WASM | `miniprogram/src/assets/wasm/mp_core.wasm` 107472 B / `B53C7405A643E8409071ED76D3CB4CCBDF1A37E6E5C408CE1D4A373D4CC00744` | 测试内 `readWasmChecked()` 校验通过 |
| 菜单身份 | `menuVersion=west1-canteen-batch1-nutrition35-chuanxiang6-20261024`；`catalogHash=sha256:23c0eda554226f9ecda0d4b973e57eabc697abe9e5ca34b7058fd45b30ff44ea`；6 窗口 / 91 菜 / 62 报价 | 场景A脚本 + 核心 `mp_validate_menu`（与 T06c 冒烟同口径） |

若当前生产已不是 `7f6a6ea5…`，本反馈仍只对上述固定副本负责（未换版本）。

## 2. 实际操作环境

- **Node 宿主 + 真实冻结 WASM + mock wx**（`t05-test-helpers.mjs` 的 `createMockWx` 内存 Map 存储、`createRealInstantiate`）；部分场景加载**真实页面模块**（`pages/logs/index.ts`，按 test-t06c 的 Page bootstrap 方式）。**不等于微信开发者工具/真机证据。**
- 本轮只跑 **greedy**；未运行三餐 DP20000；未做三算法正确性/营养来源/性能审计（按卡留给固定新核心候选）。
- 每个脚本一次 `timeout 25` 硬超时独立子进程运行，全部在超时内完成（最长约数秒）。
- 与 UI 代理无共用开发者工具/测试存储：本轮未使用开发者工具，无需协调等待。
- 每个场景用独立 `createMockWx()`（内存存储，进程结束即弃），**无持久化测试存储遗留**；写盘仅限本证据目录 `logs\`、`scripts\`、`manifest\`、`manifest-input\`、`candidate\`。

## 3. 结构化场景结果（原始证据均在 `证据-v1\logs\`）

断言口径说明：以下"项数"是**断言数**，不是独立场景数；一个场景可含多条断言。复用与新增划分见 §4。

### 场景A：川湘套餐价格/两素三素/米饭/早餐时段（新增）— 32/32 通过
`scenario-a-chuanxiang-pricing.mjs` → `scenario-a-results.json`、`scenario-a-core-offer-nutrition-lunch.json`
- 川湘窗口 27 报价 = 25 款招牌套餐（价格全在 {1100,1200,1300} 分，10/10/5 款，`priceBasis=comboTotal` 整套价、kind=combo）+ 两素 700 分 + 三素 900 分。✅
- 9 元/14 元受限荤素（`offer-chuanxiang-set-1meat-1veg-rice`/`2meat-1veg-rice`）**连报价带套餐菜品都已移出目录**（不是 0 元、不是缺价商品，也不出现在任何餐次自选视图）；`WEST1_MENU_SOURCE.isolatedOfferIds` 保留隔离清单。✅
- 米饭（dish-cx-rice）在每个川湘套餐恰好 1 份；川湘窗口无单独售卖米饭/单菜的报价（米饭不重复计价）；核心 `mp_offer_nutrition` 对 25 款招牌套餐返回热量与组件单份合计差 ≤2（估算舍入），米饭/素菜营养只计一次。✅
- 川湘所有报价 mealWindows=午+晚；窗口与自选视图均不含早餐；早餐由其他窗口正常供应（12 条早餐报价）。✅
- 全目录 62 条报价无 0 元、无缺价；35 项照片参考未伪造为可售商品。✅
- 核心套餐营养 estimated=true、数值=菜单中心值（前端不重算）。✅

### 场景B：自选→预览→实付→确认→记录，预算只计一次/幂等（新增）— 41/41 通过
`scenario-b-confirm-budget-idempotency.mjs` → `scenario-b-results.json`、`scenario-b-selfpick-confirm.json`、`scenario-b-budget-after-eaten.json`
- 方案确认填不同实付（300 分）→ 记录快照实付=300 分而非菜单价；预算实际消费=记录已知价之和（只计一次）；重复确认 duplicate、日志数与金额不变；`confirmationId=conf-plan-日期-餐-planKey`。✅
- 自选链路：川湘套餐视图整套价、组件展示含米饭但不展开计价；预览（按菜单价/实付未知/实付改9元/数量2）合计=整套价或改值或 ×2，行数恒为 1；实付未知落账 `unitPriceCents=null + priceKnown=false`（不补 0），文案"实付待补全"不含 ￥0.00；预算已知消费=0 且标 `priceIncomplete`。✅
- 幂等：同 draftToken 重复确认 duplicate 不新增；新 draftToken 再确认被拒（"已有有效记录"）。✅
- 超预算：预算 800 分 < 午餐 1200 分，预览出"超过今日剩余预算"提示且不阻止保存；确认后刷新方案，**方案不含已确认的午餐**、待吃计划花费=待规划餐次方案项之和（plannedKnown=2100=待规划项和，不含已吃 1200）；数据层已吃/待吃分离正确。⚠️ 文案层问题见缺陷1。✅（数据）/⚠️（文案）
- 降预算：5000→800 保存后旧方案失效（plan=null），预算视图不声称"预算内"，标签更新 ￥8.00；低预算下仍出方案（OkPartial 超预算备选）。✅
- 跨路径合计：方案确认（首项改 400 分）+ 自选套餐 → 已知实付=两记录之和，午餐整套价恰好额外计一次；active 记录数=2。✅

### 场景C：用户锁/换菜约束/售罄/菜单替换/0值区分（新增）— 38/38 通过
`scenario-c-locks-soldout-menureplace.mjs` → `scenario-c-results.json`、`scenario-c-menureplace.json`、`scenario-c-nullprice-preflight.json`、`scenario-c-nonutrition-preflight.json`
- 用户锁：锁定项刷新后进方案（locked=true）；换掉手动锁定项被拒（"请先解除菜品锁定"）；解锁后同窗换菜成功且方案含新菜不含旧菜；目标已在推荐中→拒绝（防重复项）。✅
- 售罄：作用域=日期+窗+餐+菜；不存在窗口标记被拒（不写脏标记）；售罄报价自选视图标"已售罄"，预览/确认均被拒且不落账；同菜晚餐不受影响（跨餐隔离）；售罄菜不能锁定；解除后可再选。✅
- 菜单替换：应用自定义菜单后——旧记录快照**逐字节不变**（名称/价格/营养/menuVersion）；失效用户锁保留不静默解锁，刷新返回 `LockConflict`（带精确 offerId 原因）；自选视图/营养快照切到新菜单（来源绑定新 catalogHash）。✅
- 合法 0 值 vs 缺失：0 元报价（整/半同价 0）可导入，预览/落账显示 `￥0.00、priceKnown=true`，预算计 0 且核算完整；全 0 营养=已知 0（不显示"待补全"）；缺价格（`priceCents=null`，需配 `priceBasis=unknown`）导入后全链路"实付未填/实付待补全/priceIncomplete=true"，与 0 元明确区分。✅
- 核心（validate 层）拒绝两类输入并给出可读原因：整/半不同价（含 0/100 组合）、`priceCents=null` 未配 `priceBasis=unknown`、菜品缺 `nutrition` 字段（`$.catalog.dishes[].nutrition 缺少必需字段`）——即**菜单导入层不允许"缺营养"**，记录层"营养待补全"只在核心返回全 null 或手动补记（nutrition=null）时出现。✅（行为记录）

### 场景D：缺价格/缺营养导入行为补充探测（新增）— 记录性通过
`scenario-d-missing-value-probe.mjs` → `scenario-d-unknown-price.json`、`scenario-d-no-nutrition-preflight.json`
- 整/半都 `priceCents=null + priceBasis=unknown` 可导入：预览 priceKnown=false、"实付未填"，落账 null/priceKnown=false，预算 `priceIncomplete=true`。✅
- 缺营养完整拒绝报文已存档（`INVALID_INPUT / $.catalog.dishes[].nutrition / 缺少必需字段`）。✅

### 场景E：实付上限一致性与页面确认面板边界（新增）— 13/13 断言通过（其中 E1.4/E1.5/E2.4 为缺陷取证）
`scenario-e-page-confirm-edge.mjs` → `scenario-e-results.json`
- 记录页确认面板（真实页面模块）：三位小数被页面拦截（"实付价格式不正确（最多两位小数）"）且不落账。✅
- 缺陷取证见下节（上限不一致、超上限静默回退）。

## 4. 复用与新增的划分

- **复用**：`t05-test-helpers.mjs`（mock wx / 真实 WASM 实例化 / 身份校验）、test-t06c 的页面 Page-bootstrap 模式、`FIXTURE_CASES.success` 菜单夹具、`candidate-manifest.mjs` 身份复验、核心 `validate-menu`/`offer-nutrition` 调用方式。未重复运行 test-t06c-unified（其 §2 含 dp/branchAndBound 真实请求，本卡只授权 greedy）。
- **新增**：场景 A/B/C/D/E 五个脚本全部为本轮新写（`证据-v1\scripts\`），断言全部新增；未把任何既有断言数计入本反馈。

## 5. 缺陷清单（3 条，均 Node/mock 环境可复现；未合并不同根因）

### 缺陷1（低·提示口径）：已吃超预算的提示被并入待吃计划的文案，"已吃超支"事实丢失
- 最小输入：预算 `budgetCents=800`；自选确认午餐套餐 1200 分（`offer-chuanxiang-set-guobaorou`，实付按菜单价）；刷新方案。
- 操作：`store.confirmSelfPickMeal` → `store.refreshPlan` → `store.getHomeView().budget`。
- 预期：预算超支提示区分两个来源——已吃部分本身已超支（1200>800，即使不再消费也超 400）与待吃计划超预算。
- 实际：`overBudget=true`、`withinBudgetKnown=false` 正确，但 message 只剩"**已超出预算：计划 ￥21.00 / 剩余可用 ￥0.00，请调整或明确接受加价备选。**"；`overageCents=2500`（=已吃1200+计划2100−800）也是合并数。用户读到的唯一超支原因是"计划"，引导"调整/接受加价备选"，而即使计划为 0 该日也已超支。仅当 `plannedKnown===0` 时才走"实际消费已超出全天预算"分支。
- 原始输出：`logs\scenario-b-budget-after-eaten.json`（spent=1200 / planned=2100 / message / overage=2500）；断言 B3.8。
- 位置：`candidate/miniprogram/src/domain/logs.ts` `buildBudgetView` message 分支（`budgetSet && spentKnown > budget && plannedKnown === 0` 才提实际消费）。
- 数据字段本身（spentKnownCents/plannedKnownCents/remainingKnownCents）分离正确，属纯文案/口径问题；未测微信端实际观感。

### 缺陷2（低·校验不一致）：实付/预算金额上限在两条记录路径不一致，且 self-pick 注释宣称"同一上限"不实
- 最小输入：同一金额 `priceEdit/priceEdits = 50000000` 分（￥500,000）。
- 操作：方案确认 `store.confirmMeal(meal, {itemKey: 50000000})` vs 自选 `store.previewSelfPickDraft('lunch', 窗口, [{offerId, quantity:1, priceEdit: 50000000}])`。
- 预期：同一上限（self-pick.ts 第 39 行注释："与 store 的 isValidMoney 同一上限（分）：非负整数且不超过 100,000 元"）。
- 实际：方案确认/改记/补记走 `store.ts` `MAX_BUDGET_CENTS = 100*1000*1000`（￥1,000,000），￥500,000 **接受并落账**；自选走 `self-pick.ts` `MAX_MONEY_CENTS = 100*1000*100`（￥100,000），同一金额**被拒**（"实付价格必须是非负整数（分）"）；￥100,000 整是自选的恰好边界（接受）。
- 原始输出：`logs\scenario-e-results.json` 断言 E1.1/E1.2/E1.3/E1.4。
- 影响：两条链路对同一输入判定相反；极端大额实付记录口径取决于走哪条路径。低危（正常食堂金额远低于上限）。

### 缺陷3（低·静默丢弃）：超过 store 上限（>￥1,000,000）的实付输入被静默回退为菜单价，且仍报成功
- 最小输入：记录页确认面板（真实 `pages/logs/index.ts`）实付填 `1000000.01`（页面 `yuanToCents` 正则放行 → 100000001 分 > MAX_BUDGET_CENTS）。
- 操作：`page.onConfirmMeal`（或直接 `store.confirmMeal(meal, {itemKey: 100000001})`）。
- 预期：拒绝并提示，或至少成功消息中说明实付未生效。
- 实际：`confirmMeal` 对非法 edit 静默忽略（`store.ts` confirmMeal 价格编辑分支既不 fail 也不提示），记录 `unitPriceCents=菜单价`（如 500 分），返回成功"早餐已确认 2 项，计入实际消费"，状态栏同文，用户完全无感知。UI 可达（面板输入框无上限拦截）。
- 原始输出：`logs\scenario-e-results.json` 断言 E1.5/E1.6/E2.3/E2.4/E2.5。
- 对照：自选路径同额会显式报错（`buildSelfPickDraftPreview` errors），两路径行为不对称。

### 低风险观察（不占缺陷名额、非手动链路可达）
- `store.editLog`：`itemPatch.unitPriceCents !== undefined` 即置 `priceKnown=true`，仅当 `priceKnown === true` 时才做 `isValidMoney` 校验（`store.ts` ~1459 行）——直调 API 传 `{unitPriceCents: -5}` 可落非法价；页面总是显式传 `priceKnown`，故手动链路不可达。

## 6. 未复现 / 未测项（如实记录）

- **未发现缺陷的覆盖项**：川湘 25 款三档整套价、两素7/三素9、米饭计价/营养一次、早餐不供应川湘、套餐确认/自选确认幂等、预算只计一次、已吃与待吃数据分离、降预算失效旧方案、售罄拦截（预览+确认+锁定）、换菜单后快照/失效锁/LockConflict、0 值与缺失区分、补记幂等——在 Node/mock 环境均通过。
- **未测**：微信开发者工具编译/预览、真机运行、真机 ActionSheet/键盘/字号渲染（本机无开发者工具）；微信端 Toast/状态栏实际观感（缺陷1/3 的文案影响仅到数据与返回值层）。
- **按卡不做**：三餐 DP20000、三算法正确性、营养来源/数值审计、性能、cap64 截断复核（本轮场景未触及该截断路径）。
- **服务端模型路由/档位**：未知。

## 7. 测试存储遗留

- mock wx 为内存 Map，进程结束即销毁：**无 wx 存储遗留、未写任何真实用户数据**。
- 写盘新增内容全部在本证据目录内：`candidate\`（固定候选副本）、`manifest\manifest.json`（本副本复验摘要）、`manifest-input\`（U09 原始 manifest 存档）、`scripts\`（5 个场景脚本）、`logs\`（12 个原始输出 JSON）。
- 未写生产 `miniprogram/`、`core/`、`tools/`（项目根），未写其他任务证据目录，未写 `D:\项目\cpp\.toolchain\tmp\`（未调用会写共享 tmp 的旧脚本）。

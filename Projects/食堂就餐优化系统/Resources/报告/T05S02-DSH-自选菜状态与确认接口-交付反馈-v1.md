# T05S02｜DSH｜自选菜状态与确认接口-交付反馈 v1

- 任务卡：`Resources\任务提示词\T05S02-DSH-自选菜状态与确认接口-v1.md`（v1）
- 状态：**已完成 B1 交付（源码级 + 任务局部检查通过），等待 P01 查收；未开始 S03**
- 执行日期：2026-10-22（Asia/Shanghai）
- 绝对 cwd：`D:\项目\cpp\Projects\食堂就餐优化系统`
- 记录时工作区根：`D:\项目\cpp`（项目根见上）

## 一、模型与执行环境

| 项 | 内容 | 证据类型 |
|---|---|---|
| P01 指定模型 | DeepSeek V4.1 Flash | 任务卡明文 |
| 本窗口自报模型 | `deepseek-v4.1-flash-1017`，思考档位 `high` | 运行时系统提示（本窗口） |
| 配置文件声明 | `provider: qw` / `model: deepseek-v4.1-flash-1017` / `reasoningEffort: high`（`C:\Users\link\.dsh\profiles\desktop\cordis.patch.yml`，SHA256 `d833c6727a619188979fee27714525ef9eff782526efc8a3a36b22803b4977e8`） | 运行环境可核实（配置声明，**不等于**服务端实际路由） |
| 服务端真实路由/子版本/配额 | **未知**（无可核实证据，不推断） | 未知 |
| 原生思考档位 | 本卡未指定；配置为 `high` | 配置声明 |
| 是否 Gemini 4 | **否**，未见任何 Gemini 4 迹象，无需触发卡内高亮告警 | 运行环境 |

证据：`Resources\报告\T05S02-DSH-自选菜状态与确认接口-证据-v1\04-环境\01-运行环境与模型配置.txt`

执行环境：Windows 11 10.0.26300 / Node v24.19.0 / PowerShell 5.1.26100.9711。

## 二、开工门槛核对（三项全部成立）

| 门槛 | 结论 | 依据 |
|---|---|---|
| 1. U05a 有实际交付反馈且候选可读 | 成立 | `Resources\报告\T05U05a-DSH-视觉收口-交付反馈-v1.md`（SHA256 `c2c98540f1bd23767959cad285ca47a0ffe3889d4bacc3d16c032f0ad3e76953`）；候选清单 `T05U05a-DSH-视觉收口-证据-v1\00-输出候选\manifest.json` 可读且与工作区一致 |
| 2. P01 已核对实际页面并明确放行 B1 | 成立 | `Resources\报告\T05U05a-P01-用户体验接收与S02放行-20261022-v1.md`（SHA256 `72601cf608d00f82b0f7821427f3b4c09b5b4608c85592614c1604e9e3664701`）；P01 裁定 §3/§5 见 `天科食客-P01-现状与明日规划-20261022-v1.md` |
| 3. 无其他执行员并发写同一前端目录 | 成立 | U05a 输出候选清单 106 项与工作区逐文件核对（见 §三），核对发生在任何源码修改之前 |

## 三、输入基线与输出候选核对（当次现算，不引用旧值）

### 3.1 U05a 输出候选 → 开工前工作区

| 项 | U05a 声明（manifest.json 实际值） | 本次核对 |
|---|---|---|
| 候选清单 | `Resources\报告\T05U05a-DSH-视觉收口-证据-v1\00-输出候选\manifest.json`，SHA256 `b14b8044935392cf487c5308a21e34e822d8b27c31ffeffcbd1c6cf20ce97bec` | 可读、可解析 |
| `sourceTreeDigest` | `sha256:f22eae28924422e22e262d73405eda91641b9ea7dc87788d32b6191ea0ded61a` | 与清单一致 |
| 源码/工具 | 69 个 / 712,591 B；37 个 / 402,444 B | 106 项逐文件比对：**106/106 字节与 SHA256 全部一致**（开工前无他人改动需避让） |
| 冻结 WASM | 72,881 B / `715CD7701B64D8F493A110C348B5F643979536578C7380C29837E05C4F31D52C` | 一致，未变 |

> 备注：U05a 反馈 §1 表格左列“69 个 / 711,366 B”是它自己的**输入**（U05 候选）口径；其**输出** `manifest.json` 实际为 712,591 B（同为 69 个文件，说明 U05a 改过其中文件的字节）。本卡一切以 U05a 输出 `manifest.json` 为基线，并以当次现算为准。

### 3.2 开工后复跑（证明除本卡声明改动外无越界）

| 结果 | 数量 |
|---|---|
| 与 U05a 完全一致的文件 | 103 / 106 |
| 本卡声明改动的文件 | 3（`domain\store.ts`、`domain\plan.ts`、`domain\types.ts`） |
| 未声明差异 / 缺失 | **0 / 0** |
| 本卡新增文件 | 2（`domain\self-pick.ts`、`tools\miniprogram\test-self-pick.mjs`） |

结论：U05a 清单内除本卡 3 个改动文件外，其余 103 项字节与哈希仍与 U05a 完全一致；本卡无越界修改，也未覆盖/清理他人文件。

### 3.3 本卡输出候选（新）

| 项 | 值 |
|---|---|
| `sourceTreeDigest` | `sha256:b30ec202635af78ddec77544912f945b64a10520c4a0922c2ef951cc9d981cae` |
| `miniprogram/src` | 70 个文件 / 751,205 B |
| `tools/miniprogram` | 38 个文件 / 429,278 B |
| 冻结 WASM | 未变：72,881 B / `715CD7701B64D8F493A110C348B5F643979536578C7380C29837E05C4F31D52C`（`matchesFrozen=true`） |
| 清单位置 | `Resources\报告\T05S02-DSH-自选菜状态与确认接口-证据-v1\03-输出候选\manifest.json` + `hashes.sha256` |

## 四、改动文件（4 改 1 增）

| 文件 | 类型 | 字节 | SHA256 |
|---|---|---|---|
| `miniprogram\src\domain\self-pick.ts` | 新增 | 26,630 | `448a1bf136162f32f2465dd78634825ca93076aa417fe8ac8a0f75d2b7f9f66a` |
| `miniprogram\src\domain\store.ts` | 修改 | 94,022（+9,563） | `d76caab53a2707dbef4e70740382a77e51978654514ea3993bdae8f62183b8e8` |
| `miniprogram\src\domain\plan.ts` | 修改 | 38,721（+2,083） | `ca3eb4cf2b0b174fa55c35bf3a61f8f0db2b9e8d144f7e9f16d3ff6489f0c1a8` |
| `miniprogram\src\domain\types.ts` | 修改 | 19,129（+338） | `bb33c6224adad87227dd3f8eb80a031846b7a2a0ee4b183bf039b73afb256b7d` |
| `tools\miniprogram\test-self-pick.mjs` | 新增（测试工具） | 26,834 | `27ea395dc2db258c20defcd036e2cf9bf04b9cf9f3b3aecdf70c4a3783d2fba1` |

未改：页面 wxml/ts/wxss（**没有做页面、没有加今日入口、没有改记录页 UI**）、WASM 二进制、C++ 核心、契约文件、持久化结构、其它工具脚本。

改动明细与逐文件说明：`Resources\报告\T05S02-DSH-自选菜状态与确认接口-证据-v1\02-任务局部检查\04-改动清单与逐文件哈希.md`

## 五、最终接口契约（供 S03 原样接续）

完整契约（含字段级语义、拒绝顺序、S03 边界）：`...\02-任务局部检查\05-S03接续接口契约.md`。摘要：

| 接口 | 参数 | 返回/语义 | 落点 |
|---|---|---|---|
| `getSelfPickView(meal)` | `Meal` | 只读：`canPick`、`blockCode`（`no-supply`/`meal-ended`/`already-confirmed`/`no-offer`）、`blockMessage`、`windows[]`（含每窗 `offers[]`、售罄/可售、份量只来自菜单 Offer、价格/营养未知不补 0）、`defaultWindowId`、`simulated` | `domain\store.ts` L1088 |
| `newSelfPickDraftToken()` | 无 | `sp-<base36 时间>-<base36 随机>`；页面开草稿时取一次并复用，不持久化 | L1120 |
| `previewSelfPickDraft(meal, windowId, selections)` | `selections: {offerId, quantity?, priceEdit?}[]` | 只读预览：`ok/message/lines/knownTotalCents/priceLabel/priceIncomplete/nutritionSums/incompleteNutrients/unknownItemCount/estimated/hints/errors`；**不写盘、不调核心** | L1129 |
| `confirmSelfPickMeal(meal, {windowId, draftToken, selections})` | 同上 + 稳定草稿标识 | 唯一写入点：`ok/message/duplicate?/recordId/confirmationId/planNeedsUpdate/affectedMeals/hints` | L1170 |
| `getPlanUpdateState()` | 无 | 派生：`{needsUpdate, meals, message}`，不持久化、不重算 | L1275 |
| `getHomeView()` 新增字段 | — | `planNeedsUpdate / planUpdateMeals / planUpdateMessage` | L1275 附近 + `types.ts` L554–556 |

关键语义（S03 必须依赖）：

1. **草稿只存页面 `data`**；取消/返回/关闭只丢弃，不产生记录。只有 `confirmSelfPickMeal` 经 `commit` 单事务写入 `MealLog`。
2. **幂等键** `conf-selfpick-<businessDate>-<meal>-<draftToken>`：同一草稿重复提交返回 `ok:true, duplicate:true`，不新增、不累计；不同草稿在已有 active 记录时被拒绝（引导记录页改记/撤销，不提供第二条确认路径）。
3. **状态校验不绕过**：已结束餐次必须先走既有 `reopenMeal`；已确认只能走既有 `editLog`/`revokeLog`。
4. **单窗口边界**：`windowId` 定死作用域，跨窗混选直接拒绝；报价必须存在、供应本餐、未售罄；份量只来自菜单真实 `Offer`（不制造菜单里没有的半份）。
5. **金额/营养缺失保持 `null`**：`priceCents=null ⇔ priceKnown=false`，未知不补 0；汇总给 `priceIncomplete`/`incompleteNutrients`。
6. **套餐**按 `priceBasis='comboTotal'` 只计一次，组件不单独成行；**半份米饭与整份同价**（价格取菜单 Offer，不除以 2）。
7. **预算/热量偏离只进 `hints`**，不参与 `ok` 判定，绝不改写用户选择。
8. **落账只标记推荐需更新**（`planNeedsUpdate/affectedMeals`），确认接口不调用核心、不在后台静默重算；刷新仍由用户点现有入口。
9. 落账快照：`recordId=makeRecordId(now,'selfpick')`、`status='active'`、`revision=1`、`menuVersion`=当前菜单、`items[]` 含 `source:'menuOffer'/offerId/dishId/nameSnapshot/portionCode/quantity/unitPriceCents/priceKnown/nutrition/nutritionBasis/menuVersion`。

## 六、幂等与状态校验结果（实测）

`test-self-pick.mjs` 10/10 通过（原始输出：`...\02-任务局部检查\01-test-self-pick.txt`）：

| # | 用例 | 结果 |
|---|---|---|
| 1 | 状态视图：报价/份量来自菜单真实 Offer、售罄带窗口、不伪造 Offer、半份同价 | 通过 |
| 2 | 草稿预览不写存储、未知不补 0、半份营养按契约 1/2 逐项 `round_half_up` | 通过 |
| 3 | 确认成功：1 条 active `MealLog` + 菜单快照（名称/份量/价格/营养/估算），记餐页与月历读模型可读 | 通过 |
| 4 | 幂等：同一草稿重复提交不新增、不累计；新草稿在已有记录时被拒 | 通过 |
| 5 | 已结束餐次拒绝写入，提示走既有重开；`reopenMeal` 后可自选 | 通过 |
| 6 | 本窗本餐售罄项：视图置灰、预览拒绝、确认拒绝 | 通过 |
| 7 | 跨窗混选 / 伪造报价 / 非法餐次 / 非法草稿标识 全部拒绝且不写记录 | 通过 |
| 8 | 套餐按 `comboTotal` 只计一次；`priceEdit:null` 时 `unitPriceCents=null`、`priceKnown=false`，预算显示不完整不显示 ￥0.00 | 通过 |
| 9 | 超预算只提示，不拒绝保存、不改写选择与落账金额 | 通过 |
| 10 | 接合：已确认餐次展示实际记录快照；`planNeedsUpdate=true`、`affectedMeals=['breakfast','dinner']`；旧方案原文与 `requestId` 未被改写（不静默重算） | 通过 |

另：确认链路“不调用核心”由测试用**抛错的实例化器**证明（一旦走 `PlanDay`/`ValidateMenu` 即失败），不是靠日志观察。

## 七、实际运行的命令与证据

| # | 命令 | 结果 | 原始证据（绝对路径） |
|---|---|---|---|
| 1 | `node tools/miniprogram/typecheck-src.mjs` | TS 4.1.2 与 5.9.3 均 **0 errors / 36 files**，exit 0 | `...证据-v1\01-静态检查\01-typecheck.txt` |
| 2 | `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/check-pages.mjs` | 全部页面静态检查通过，exit 0（不可替代开发者工具编译） | `...\01-静态检查\02-check-pages.txt` |
| 3 | `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-self-pick.mjs` | **10/10 通过**，exit 0 | `...\02-任务局部检查\01-test-self-pick.txt` |
| 4 | `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-t05-store.mjs`（针对性回归：本轮改了 store 写入链路与 plan 读模型） | 28 项 27 通过；1 项失败为既有过期断言（见 §八） | `...\02-任务局部检查\02-test-t05-store-回归.txt` |
| 5 | `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-home-view.mjs`（既有页面套件观察） | 2 项失败均为 U05 卡片改版后的过期断言（见 §八） | `...\02-任务局部检查\03-test-home-view-既有套件观察.txt` |
| 6 | `node -e "<核对脚本>"`（见 `00-输入候选\00-核对脚本-s02-verify-baseline.mjs`） | 103 一致 / 3 声明改动 / 0 意外差异 / 0 缺失 | `...\00-输入候选\01-U05a输出候选与工作区核对.json` |
| 7 | `node tools/miniprogram/candidate-manifest.mjs --out "...\03-输出候选"` | 新 `sourceTreeDigest`，`frozenWasmMatches=true`，exit 0 | `...\03-输出候选\00-manifest命令行输出.txt`、`manifest.json`、`hashes.sha256` |
| 8 | `node -e`（`WebAssembly.Module.exports` 读导出表，只读） | WASM 72,881 B / 哈希未变；导出 8 项：`memory`、`mp_api_version`、`mp_contract_version`、`mp_alloc`、`mp_free`、`mp_plan`、`mp_nutrition_target`、`mp_validate_menu`——**无 Offer 级营养导出**（支撑 G1），exit 0 | `...\02-任务局部检查\06-WASM导出面核对.txt` |

证据目录总入口：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T05S02-DSH-自选菜状态与确认接口-证据-v1\README.md`

## 八、未运行项与既有套件失败（如实记录）

**未运行**：

1. **微信开发者工具编译 / 预览 / 截图**：本卡范围不含页面，且未做 UI 变更，故未启动开发者工具；不能据此声称“页面可用”。
2. **真机运行、模拟器自动化验收**：同上，未运行。
3. **完整回归套件**（`verify-t05-integration.mjs`、`run-t05-all.mjs` 等）：卡内明确“不做完整回归”，未运行。
4. **微信小程序运行时下的持久化实测**：只用 mock `wx` 文本存储验证，未在真实 `wx.setStorageSync` 环境跑。

**既有套件中与本卡无关的失败（原样保留，不修改测试凑绿）**：

| 套件 | 失败项 | 判定 |
|---|---|---|
| `test-t05-store.mjs` 第 8 项 | 断言 `'价格未知'`，实际 `'实付未填'` | U05 已把未知实付文案统一为“实付未填”（`utils/money-display.ts` 与本轮未改的 `domain/logs.ts` 决定）；该断言是 U05 前的旧文案，非本卡引入 |
| `test-home-view.mjs` 第 2 节 | `estimateNote === '营养为估算值'`、`macro.barProtein/barFat/barCarb` | U05 卡片改版后字段已变为 `heatEstimated`、`macro.barStyle*`（`pages/home/index.ts` L396–416），旧断言过期，非本卡引入 |

两个涉及文件（`pages/home/index.ts`、`utils/money-display.ts`、`domain/logs.ts`）本轮均未改动，可用 §三 的 103 项一致记录交叉印证。

## 九、缺口 / 未完成项 / 需 P01 决定

### G1（需 P01 裁定）：Offer 级营养没有核心入口，前端按冻结契约派生

- 现象：包内 WASM 导出表只有 `mp_api_version / mp_contract_version / mp_alloc / mp_free / mp_plan / mp_nutrition_target / mp_validate_menu`（当次用 `WebAssembly.Module.exports` 读得，见 `...\02-任务局部检查\06-WASM导出面核对.txt`），**没有**“给任意 Offer 算营养”的接口；`mp_nutrition_target` 只产目标值，不是菜单项营养。
- 当前做法：`domain\self-pick.ts` 的 `offerNutritionOf` 严格按**冻结契约 §Offer** 的顺序在纯前端派生：`nutritionOverride` 优先（半份按 `portionRatioNum/Den` 缩放）→ 否则菜品营养按比例缩放 → 逐项 `round_half_up`，估算标记透传；与 `core/src/catalog.cpp` 的 `OfferNutrition` 同序同舍入（我按源码逐行核对）。
- 为什么没加核心适配：卡内明令“不新增 C++/WASM 算法”，且这属于第二条“正式营养实现”，风险需 P01 拍板。
- 可选项：① 维持现状（本卡选择，理由：与核心逐位一致、只用于**记录快照**、不参与目标/推荐计算）；② 把记录里的 `nutrition` 改为 `null`（永久未知，代价是记餐页无营养数据）；③ P01 授权后续卡片给核心加只读导出（不在本卡范围）。
- **请 P01 明确选 ① / ② / ③**；若选 ③，本卡改动会在新卡片中回退为调用核心。

### G2（提示，不需现在决定）：`plan.ts` 读模型行为变化对既有今日页有可见影响

- `buildMealView` 已确认分支由 `confirmed && !planMeal` 改为 `confirmed`（S01 §5.2 建议、卡内“实际记录作为事实来源”要求）。
- 效果：通过**既有方案确认**（`confirmMeal`）确认的餐次，今日页卡片现在也展示实际记录快照而非旧推荐。这是修正而非新功能，但属于既有页面的可见变化；S03 做页面时请一并确认视觉与文案无冲突。
- 我当时判断：这是 B1 接合必需的最小修正，不能算“改页面 UI”（未动 wxml/wxss）。如 P01 认为应推迟，可单独回退这一行。

### G3（S03 需知）：模式标记尚未写入记录

- 契约 `MealLog` 无 `mode` 字段，本卡**未新增**任何持久化字段（卡内禁止第二套持久化结构）。自选菜记录通过 `confirmationId` 前缀 `conf-selfpick-` + `items[].source='menuOffer'` 与方案确认区分。
- S03/后续若要“记录页显示自选来源”，需要 P01 决定是否给契约加字段（属契约变更，不在本卡）。

### G4（已知限制，不改）

- 记录项 `itemKey` 目前由 `offerId` 派生（`logItemFromDraftLine`），若后续允许“同一 Offer 多行不同实付”，需要 P01 确认 `itemKey` 规则；当前同 Offer 会被合并/拒绝（同一草稿内重复 `offerId` 直接判错）。
- 模拟菜单只有单窗口（`w-main`），真实多窗口/多餐次菜单仅在测试夹具中验证（`test-self-pick.mjs` 用例 7 自造两窗口菜单）。

## 十、范围自查

| 约束 | 状态 |
|---|---|
| 只做 B1（状态/确认/接合） | 符合 |
| 不做自选菜页面、不加今日入口、不改记录页 UI | 符合（`pages/**` 零改动） |
| 不做完整回归 | 符合（只跑 typecheck、页面静态检查、本卡测试、针对性 store 回归） |
| 不装新工具/依赖 | 符合（仅用仓库内既有 Node 脚本） |
| 不新增 C++/WASM 算法、不改契约 | 符合（WASM 身份未变；`contractVersion`/契约文件未动） |
| 不改目标规则、不复制正式营养公式之外的第二套算法 | 见 G1（派生规则与核心逐位一致，仅用于记录快照） |
| 不使用 sol | 符合 |
| 不静默重算推荐 | 符合（确认接口不调核心，用例 10 断言旧方案原文/`requestId` 未变） |
| 不覆盖他人文件 | 符合（§3.2：未声明差异 0；MEMORY 与其它岗位文件未触碰） |
| 反馈唯一写入指定路径 | 符合（本文件；写入前已确认目标不存在，未覆盖旧版） |

## 十一、给 S03 的接续信息

1. **实际候选身份**：以本反馈 §3.3 的 `sha256:b30ec202635af78ddec77544912f945b64a10520c4a0922c2ef951cc9d981cae` 为准；若 S02 后又有改动，必须按新候选重新核对。
2. **可调用接口**：`store.getSelfPickView / newSelfPickDraftToken / previewSelfPickDraft / confirmSelfPickMeal / getPlanUpdateState`，类型从 `./self-pick` 导入，**不要自行改名或另建确认路径**。
3. **页面状态**：仅 `data` 持有 `draftToken`、所选 `windowId`、`selections`；进入入口时调 `newSelfPickDraftToken()` 一次并在整段草稿生命周期复用。
4. **成功/错误/重复语义**：见 §五 表格与契约文档；`duplicate=true` 是成功，不要弹“失败”；`ok=false` 时按 `message`/`errors` 展示并保留草稿让用户修改。
5. **已知限制**：核心无 Offer 级营养接口（G1）；无 `mode` 字段（G3）；模拟菜单单窗口（G4）；既有 `test-home-view`/`test-t05-store` 有 2+1 处过期断言，跑回归时不要误判为本轮回归。

## 十二、结语

B1 已完成并验证，唯一反馈为本文件。**按卡片要求：只返回本文件绝对路径与一句状态，停止，不自行开始 S03、不向其他聊天发送、不持续轮询。**
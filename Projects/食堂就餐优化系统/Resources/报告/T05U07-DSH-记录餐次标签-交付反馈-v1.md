# T05U07-DSH 记录页餐次标签切换 · 交付反馈 v1

- 任务卡：`Resources/任务卡/T05U07-DSH-记录页餐次标签切换小卡-v1.md`（sha256 `5161f1af4776a628e85662e2344f029fc3460ec0419d6621a39d05a9e106466b`）
- 主 PRD：v0.2（sha256 `d68ece7218bc076155a0afb6200788b7608898e9d0cdf6ecec27c5e49aa58fdd`）
- 执行者：`records-route`（DSH 子代理，Agent Teams 成员；Team Lead `lead`；共享任务 `task-3`）
- 实际 cwd：`D:\项目\cpp`；项目根：`D:\项目\cpp\Projects\食堂就餐优化系统`
- 完成时间：2026-10-24 14:29—14:45（Asia/Shanghai）
- 交付性质：**仅隔离候选（candidate），不是“已改生产”**。生产 `miniprogram/src`、`tools`、`core`、WASM、`Resources/真实菜单` 一个字节都没有改。

## 1. 模型声明

- 请求模型：**DeepSeek V4.1 Flash**（任务卡指定）
- 实际可核实模型：DSH 运行时可见 `deepseek-v4.1-flash-1017`
- 服务端实际路由子型号/量化档位/额度：**未知**（本会话无法核实，不把请求配置写成实际证明）

## 2. 身份：共同基线 vs 候选（可复核）

| 项 | 共同基线（生产，未改） | 候选（证据目录 `candidate/`） |
|---|---|---|
| `sourceTreeDigest` | `sha256:29deba8f66e85207e7d0fdd87cdf18250b6d5acdfb2853ac42d34b3c86a78d8b` | `sha256:d573ee6c604d9bbded1666908c8f156e3ec11b779e35f2baac6c9da9ae6b0a22` |
| miniprogram/src | 75 文件 / 882,086 B | 75 文件 / 887,361 B（**+5,275 B**） |
| tools/miniprogram | 38 文件 / 447,791 B | 39 文件 / 479,686 B（+31,895 B，新增 1 个测试工具） |
| 冻结 WASM | `B53C7405A643E8409071ED76D3CB4CCBDF1A37E6E5C408CE1D4A373D4CC00744` / 107,472 B | 同左（未触碰，`frozenWasmMatches: true`） |

- 候选 manifest：`manifest/manifest.json`（sha256 `1c354c3f0a05345dcc1c44cc6a8a898cefe9496b40ca09cafd56f1cc80e33018`）、`manifest/hashes.sha256`
- 统一补丁：`patch/T05U07-vs-baseline.patch`（44,611 B，sha256 `34116eca535592c18ac9e83cecbd11e24739910041f6feb3cf8317e4e9cb3583`）
- 补丁验证：生产副本 + 补丁 == 候选（`git apply --check`/`apply` 通过，应用后 `sourceTreeDigest=d573ee6c…`、75/887,361、tools 39/479,686，逐文件 0 差异）
- 证据目录：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T05U07-DSH-记录餐次标签-证据-v1\`

## 3. 改了什么（职责边界内最小修改）

| 文件（候选内） | 变化 | 说明 |
|---|---|---|
| `miniprogram/src/pages/logs/index.ts` | +3,475 B | 新增页面浏览状态 `activeMeal` / `mealTouched` / `mealTabs`；`syncActiveMeal()`（首进按时段、`?meal=` 优先、手选后保持）；`onSelectMeal()`（只 setData，不写、不重读）；`applyView` 派生标签状态并在原选择失效时退回第一餐；空态“记一餐”改用当前标签餐次；新增纯展示函数 `mealTabState()` 与 `MealTabUI` 接口 |
| `miniprogram/src/pages/logs/index.wxml` | +834 B | 日期条/月历之后新增 `.meal-tabs` 三标签块（`mealTabs` → `onSelectMeal`）；餐次区改为 `block wx:for` + `wx:if="{{sec.meal === activeMeal}}"`，只渲染选中餐次 |
| `miniprogram/src/pages/logs/index.wxss` | +966 B | 新增 `.meal-tabs / .meal-tab / .meal-tab-label / .meal-tab-state`（与首页同形态；全部走 `--tk-*` 令牌，无深色分支） |
| `tools/miniprogram/test-logs-meal-tabs.mjs` | 新增 31,895 B | 本卡页面级用例（受控 store + 结构化 dump），不进入小程序运行时 |

**未改**：`domain/logs.ts`（`summarizeMonthLogs` 等汇总口径）、`domain/store.ts`、`pages/home/*`、`app.wxss`、WASM、菜单、任何生产文件。没有新增通用框架/防御层，没有吞错或静默降级。

### 实现口径（对应卡面要求）

- **三标签只换查看范围**：`onSelectMeal` 只写页面 `activeMeal`/`mealTouched`，不调用 store 写方法、不重读 `getLogsView`、不改 `viewingDate`，月度汇总不重算。
- **标签状态**：与首页 `tabState` 同序——已记（ok）→ 已结束（muted）→ 待确认（plan，即有推荐未确认）→ 未记（muted）；未选中的两餐是否已记仍可一眼看到。
- **首次进入选餐**：`suggestedMealByTime`（<10 早餐 / <15 午餐 / 其余晚餐）；今日页带 `?meal=` 进来时该餐次优先并直接落在其确认面板；用户点过标签后 `mealTouched=true`，切日期/月历/主题/改撤都不重置（沿用首页同一浏览状态模型）。
- **汇总不变**：当日已知与月度汇总仍来自整份 `LogsView` / `summarizeMonthLogs`（全部有效餐次），页面只切片渲染，不缩口径。
- **空态一致性**：空日“记一餐”展开的是当前标签餐次（原为按时间建议），避免展开一个看不见的表单；仍只展开表单、不写记录。

## 4. 实际命令与结果（原始日志在证据目录）

### 4.1 基线/候选身份

```powershell
# 开工（生产根）：仍为共同基线
node tools/miniprogram/candidate-manifest.mjs
# → sourceTreeDigest=sha256:29deba8f…a78d8b，75/882,086，tools 38/447,791，frozenWasmMatches=true
# → 证据：baseline-candidate-digest.log（隔离副本复制后同值）

# 收尾（生产根）：同值，未改动
node tools/miniprogram/candidate-manifest.mjs
# → 29deba8f…a78d8b，75/882,086，tools 38/447,791；证据：production-digest-after.log

# 候选根
node tools/miniprogram/candidate-manifest.mjs --out "…\manifest"
# → d573ee6c…b0a22，75/887,361，tools 39/479,686；证据：manifest-candidate.log、manifest/
```

### 4.2 本卡页面用例（Node 侧）

```powershell
cd "…\candidate"
node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-logs-meal-tabs.mjs --theme light --dump-dir "…\node-dump"
node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-logs-meal-tabs.mjs --theme dark  --dump-dir "…\node-dump"
# → light：全部通过：85 项；dark：全部通过：85 项（exit 0）
```

### 4.3 静态检查

```powershell
node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/check-pages.mjs
# → 全部页面静态检查通过；pages/logs：WXML 标签闭合、事件绑定 24 个均有方法、绑定根标识符 40 个均可解析

node tools/miniprogram/typecheck-src.mjs
# → wechat-devtools TS 4.1.2：0 errors across 38 files；antigravity TS 5.9.3：0 errors across 38 files
```

### 4.4 回归（候选 vs 未修改生产基线，同一批命令）

见 `regression/compare.md`（同表）：

| 测试文件 | 候选 | 生产基线 | 失败集合一致 |
|---|---|---|---|
| test-appearance.mjs | 27 PASS / 0 FAIL | 27 PASS / 0 FAIL | 是 |
| test-calendar.mjs | 41 PASS / 0 FAIL | 41 PASS / 0 FAIL | 是 |
| test-core-bridge.mjs | 12 PASS / 1 FAIL | 12 PASS / 1 FAIL | 是（基线既有） |
| test-home-view.mjs | 34 PASS / 0 FAIL | 34 PASS / 0 FAIL | 是 |
| test-logs-page.mjs | 76 PASS / 2 FAIL | 76 PASS / 2 FAIL | 是（基线既有） |
| test-month-summary.mjs | 35 PASS / 0 FAIL | 35 PASS / 0 FAIL | 是 |
| test-self-pick.mjs | 13 PASS / 0 FAIL | 13 PASS / 0 FAIL | 是 |
| test-t05-modules.mjs | 17 PASS / 0 FAIL | 17 PASS / 0 FAIL | 是 |
| test-t05-soldout-scope.mjs | 11 PASS / 0 FAIL | 11 PASS / 0 FAIL | 是 |
| test-t05-store.mjs | 28 PASS / 0 FAIL | 28 PASS / 0 FAIL | 是 |
| test-today-display.mjs | 46 PASS / 0 FAIL | 46 PASS / 0 FAIL | 是 |

注：`test-storage-snapshot.mjs` 未纳入回归——该脚本会改写 T02 历史证据目录，与本卡无关。

### 4.5 一键自核

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "…\repro-verify.ps1"
# → 12/12 PASS：生产 digest/文件数/tools/WASM 未变；git apply --check/apply 通过；
#   补丁重建候选 digest 与计数一致；候选 manifest 与现状一致；light/dark 各 85 项通过
# → 证据：repro-verify.log
```

## 5. 逐项验收（对应任务卡原文）

| # | 验收点 | 结果 | 实际依据（`test-light.log` / `test-dark.log` 断言，两主题各 85 项全 PASS） |
|---|---|---|---|
| 1 | 三标签切换 | **PASS** | 三张标签文案早餐/午餐/晚餐、顺序固定；首次进入 8/12/20 点分别选早/午/晚；切标签不写业务数据、不重读 store、不改日期；只渲染选中餐次的 section（`renderedSectionCount=1`）；重复点/非法餐次不改变状态；WXML 只有 1 个 sections 渲染循环且带 `sec.meal === activeMeal` |
| 2 | 选中餐次改撤 | **PASS** | 确认：`confirmMeal(breakfast)` + 实付 1.50 元→150 分 + itemKey 对应；修改：`editLog(rec-d)` + quantity=2 + 价格已知 300 分；撤销：二次确认后 `revokeLog(rec-d)`、取消不写；补记：`addManualLog(lunch)`、整份×1、价格未知保持 `null` 不按 0；面板只在目标餐次展开；空菜名只在该面板报错不写数据 |
| 3 | 历史只读 | **PASS** | 切到 2026-10-20：`readonly=true`、读取的是该日视图、标签仍可切换、历史标签状态可见（午餐已记）；切标签 0 写入 0 重读；模板 `!readonly` 守卫 7 处保留；`.meal-tabs` 块不受只读限制 |
| 4 | 汇总不变 | **PASS** | 当日已知 3 项菜品/580 kcal 含全部餐次；月度汇总“本月已记 2 天 · 4 餐”；切三个标签后 `dayTotals`（含 spent/planned/remaining/月汇总）逐字节不变；空日只渲染选中餐次且不出现“摄入 0” |
| 5 | 两主题页面结果 | **PASS（Node 侧）** | light→`tk-light`、dark→`tk-dark`；切标签不改变主题；标签样式块只用 `var(--tk-*)` 且无 `#`/`rgb(`；`--tk-card/accent/accent-soft/text/muted/info/shadow` 在浅/深色都有定义（解析值见 `node-dump/logs-meal-tabs-{light,dark}.json` 的 `主题令牌`） |
| 6 | 双模式（简易/完整）不回归 | **PASS** | 完整模式读取 `mode=full`、当日已知含三大营养素；切标签不改模式；完整营养区仍由 `mode === 'full'` 守卫；简易模式同口径 |
| 7 | 微信开发者工具 / 模拟器 / 真机 | **未测** | 任务硬边界禁止启动微信开发者工具、不占模拟器、不碰真机；本目录无截图/屏录 |

## 6. 微信环境（如实分栏）

- **微信开发者工具**：未启动、未编译，无截图。
- **模拟器**：未占用（与其他并行任务隔离）。
- **真机**：未测。
- 因此“两主题页面结果”只有 Node 侧可核对数据（themeClass + 令牌解析 + 静态样式依据），**不能替代微信渲染**；视觉层面需后续有模拟器/真机的窗口补证。

## 7. 缺陷 / 限制 / 与卡面的补充说明

1. **基线既有失败（与本卡无关，候选与生产一致）**：`test-logs-page.mjs` 2 项（汇总文案期望 `￥10.00（含未填项）` vs 实际 `已知实付 ￥10.00（含未填项）`；未知价格文案）、`test-core-bridge.mjs` 1 项（测试断言 WASM 导出 `mp_offer_nutrition`，冻结 WASM 无此导出）。二者在未修改生产基线上同样失败，本卡未修，建议另立卡片。
2. **“手选后保持”范围**：沿用首页 `mealTouched` 模型，页面实例存活期间跨 `onShow` 保持（比“本次页面操作”更宽）；离开小程序重进为新实例，回到按时段选餐。切日期/月历/主题/改撤都不重置，符合“只换查看范围”。
3. **空态“记一餐”目标变化**：由“按时段建议餐次”改为“当前标签餐次”，与“只展示选中餐次”保持一致；仍只展开表单、不写记录。
4. **标签状态多一档“待确认”**：卡面只要求三个标签；标签状态文案取首页同序语义（已记/已结束/待确认/未记），属展示增强，不引入新业务状态。
5. **候选内含 `candidate/Resources/契约/`（13 个只读副本）**：仅为既有 `test-t05-modules.mjs` 读取契约 JSON；不计入 manifest（manifest 只统计 `miniprogram/src` 与 `tools/miniprogram`），不在补丁内，可随证据目录删除。
6. **未做整页视觉走查**：本卡约束不重做 UI，样式沿用首页 `.meal-tabs` 形态与现有令牌；像素级留白/字号需微信侧复核。

## 8. 生产未改动证据（收尾）

生产根执行 `node tools/miniprogram/candidate-manifest.mjs`（收尾侧完整输出见 `production-digest-after.log`）：

```
"candidate": {
  "sourceTreeDigest": "sha256:29deba8f66e85207e7d0fdd87cdf18250b6d5acdfb2853ac42d34b3c86a78d8b",
  "sourceFileCount": 75,
  "sourceBytes": 882086,
  "toolFileCount": 38,
  "toolBytes": 447791
},
"frozenWasmMatches": true
```

开工与收尾同值（`29deba8f…a78d8b`、75/882,086、38/447,791、WASM `B53C7405…4CC00744`）→ **生产未被修改**。

## 9. 下一负责人

- **P01**：决定是否把本候选交 T06 合入（或并入后续 UI 整合卡）；若合入，只需 `patch/T05U07-vs-baseline.patch` 的 3 个源码 hunk（`pages/logs/index.ts|wxml|wxss`），测试工具 hunk 可选。
- **P02**：按 `README.md` §2/§4 查收；`repro-verify.ps1` 可一键复验。
- **有模拟器/真机的窗口**：补“记录页浅色/深色、三标签、历史只读、空日”页面截图；本轮不占用模拟器。
- 合入注意：`index.wxml` 的餐次区已由 `view wx:for` 改为 `block wx:for` + `wx:if`；`index.ts` 的 `applyView` 新增 `activeMeal/mealTabs` 字段，`onEmptyRecordTap` 目标餐次改为 `activeMeal`；`index.wxss` 新增标签样式块。三处均只动记录页，不改全局记录模型。

## 10. 结论

**结论：记录页早/中/晚三标签已在隔离候选内实现并验证（两主题各 85 项 Node 用例全部 PASS，11 个既有测试与生产基线失败集合完全一致，类型检查 0 errors，补丁可逐字节重建候选）；生产源码未被修改（digest 前后均为 `29deba8f…a78d8b`）；微信开发者工具/模拟器/真机未测。这是“隔离候选已就绪、可交合入/独立复验”，不是“生产已修复”。**
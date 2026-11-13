# T06d｜ZCode GLM5.3｜修复与资源统一汇合｜交付反馈 v1

| 项 | 内容 |
|---|---|
| 主任务卡 | `Resources/任务卡/T06d-ZCode-修复与资源统一汇合小卡-v1.md` |
| 定位 | 已批准修复的串行汇合（非重新设计）：H01/H02/A15/A14 + 新 WASM/native 接入与推广 |
| 执行 | GLM5.3 单一执行员（本会话），全程串行单写入；生产推广仅在本卡收尾一次 |
| 请求模型 / 实际 | 请求 ZCode GLM 5.3；客户端标识 `account:zai-start-plan/GLM-5.3-Flash`；服务端路由/档位未知 |
| 证据目录 | `Resources/报告/T06d-ZCode-统一资源修复-证据-v1/`（candidate/ manifest/ scripts/ tests/ logs/ backup-生产7f6a-20261025/） |
| 状态 | **统一开发候选，待集中验证**。必要编译/回归/资源观察完成，7f6a 已备份并推广；未做 P09、微信/真机、正式性能 |

---

## 1. 身份（前后对照）

| 项 | 推广前（备份留证） | 推广后（当前生产） |
|---|---|---|
| 源码树摘要 | `sha256:7f6a6ea5071626afeb817592f5ad10f105481a2fbefdfee0b8c4b98626aeba42`（75 文件/996165 B） | `sha256:2871b4cad6cf801eeb27291c9eb291b3227d0adcf4c6a3270d40e9e34b3441a1`（75 文件/1004620 B） |
| 工具树 | 45 文件/649001 B | 45 文件/649145 B |
| 包内 WASM | 107472 B / `B53C7405…4CC00744`（A11） | **107936 B / `304FED667624EA93B4A77314CFCC74D09AC57B2A2F3A1D6A4EBF8CE79DA370E8`**（A15 修复核心），manifest `frozenWasmMatches=true` |
| 核心源 `core/src/json.cpp` | `683a472f…7bb2105` | `3c2ba4cab47599c6e00b40c089a8014fe6e62594cc5a2d8a05902088b8bb44a2`（A15 候选原文件复制，非重新编译） |
| 菜单 | 未触碰：west1 内置菜单 `54B77216…032E7`（123646 B）与 catalogHash 常量原样保留（test-t05-menu-default 69/69 内断言） | 同左 |
| 匹配 native CLI（仅证据目录） | — | `candidate/build/native/mp_cli.exe` 373248 B / SHA256 `37606911619a05a0a1b81b63c3df4b7d94ef91cdb9f95b8f6c04a0c62ca63dee` |
| 候选/生产一致性 | — | 推广后重算：生产 manifest 与 `candidate/manifest/manifest.json` 完全一致；tools 全树逐文件 diff 仅 9 个预期文件不同；`core/src/json.cpp` 两侧同哈希 |

### 输入身份核验（开工时实算）

- H01 补丁 `89a816742ee4…4A8BF2A8`、H02 补丁 `61cda9e6…2B800B1`：与卡一致。
- A15 `json.cpp` `3c2ba4ca…b8bb44a2`、新 WASM `304fed66…da370e8`：与卡/报告一致。
- **发现一处输入报告偏差（如实记录）**：A15 反馈 §4 表登记的 native CLI SHA `a08193f5…`、measure_alloc `1453cb64…` 与磁盘实算不符；磁盘值 `37606911…`/`d222d1ad…` 与 A15 自己的 `runs/artifact-hashes.txt` 一致，且 P01 独立实跑的就是这些磁盘产物。判定为报告表格误登了中断期旧构建哈希；WASM 身份三处一致，不受影响。未以此阻断汇合。
- **core 源一致性**：生产 core 与 A15 候选 core 逐目录 diff，仅 `src/json.cpp` 不同（cli/include/wasm 及 src 其余文件逐字节一致）⇒ 复用已批准 WASM/native 产物合规，未重新编译，不声称旧 hash 匹配新产物。

## 2. 接入清单（备份 vs 现态全树 diff 权威口径）

**miniprogram/src（7 文件 + WASM）**
- H01（补丁干净套用，+34/−11）：`domain/logs.ts`、`domain/self-pick.ts`、`domain/store.ts`、`domain/types.ts`
- H02（补丁干净套用）：`domain/app-state.ts`（MAX_KEPT_DAYS 14→62，KEEP_PLAN_RAW_DAYS=3 不变）
- A14 有界配置（补丁干净套用）：`domain/plan.ts` → `maxMealCandidatesPerMeal: 256`；`maxDpStates: meals.length===3 ? 32 : 20000`；其余限额不动
- A15 新 WASM：`assets/wasm/mp_core.wasm`（107936 B，非重新编译）
- 身份常量：`utils/core-runtime.ts` WASM_IDENTITY → 107936/304FED66…（含注释：A15 修复核心，A11 值已退役）

**core（1 文件）**：`src/json.cpp` = A15 候选原文件。

**tools/miniprogram（9 文件，仅活跃工具/当前测试期待，历史报告未动）**
- 身份常量更新：`candidate-manifest.mjs`（FROZEN_WASM）、`t05-test-helpers.mjs`（WASM_EXPECTED_*）
- 当前版本测试期待：`test-t05-menu-default.mjs`、`test-t06c-unified.mjs`、`verify-t05-integration.mjs`（身份断言）；`test-t05-store.mjs`（身份消息 + 默认限额期待）；`verify-t05-integration.mjs`（默认限额期待 64/20000→256/32）
- 头注释同步：`test-t05a01a-dp-chain.mjs`、`test-t05a01b-bnb-chain.mjs`、`test-t05-soldout-scope.mjs`
- 说明：两套件原期待 `64/20000` 与 A14 新默认不符导致首跑各 1 项失败，按"当前版本测试期待"同步为 `256/32`（三餐场景）后通过；测试内故意压低限额的构造请求未改。

**仅证据目录（不进生产）**：`candidate/build/native/`（mp_cli.exe、mp_test_json.exe `cd71dc29…`、mp_test_json_string.exe `ebdbe8ba…`）、worker 拷贝、`candidate/Resources/契约/T01-v1.2-candidate/nutrition-v1-candidate.json`（test-t05-modules 必要夹具，与生产原件同哈希 `8254ab22…`）。

## 3. 推广与回退

- 备份：`backup-生产7f6a-20261025/`（miniprogram/tools/core 全树 + 营养契约），备份内 manifest 复算 = `7f6a6ea5…` 一致。
- 推广方式：候选 miniprogram/tools 覆盖生产 + `core/src/json.cpp` 单文件覆盖；生产 `tools/core/`（C++ 构建脚本）不在候选内，已从备份原样保留（见 §7 事故记录）。
- **回退指引**：将 `backup-生产7f6a-20261025/` 下 `miniprogram/`、`tools/` 覆盖回项目根同名目录，`core/src/json.cpp` 用备份版（`683a472f…`）覆盖即可回到 7f6a 基线；回退后 `candidate-manifest.mjs` 应复算 `7f6a6ea5…` 且旧 WASM 匹配。
- 生产收尾冒烟：test-t06c-unified 109/109；包内 WASM 实读 107936 B/`304FED66…`。

## 4. 回归结果（每可能长跑独立子进程 25s 硬超时；仅当前默认配置）

| 组 | 结果 |
|---|---|
| TS 静态检查（typecheck-src.mjs） | TS 4.1.2 **0 errors/38 files**；TS 5.9.3 **0 errors/38 files** |
| H01 三项修复（合入后副本重跑） | `h01-after-verify` **44/44**；`scenario-e-after` **12/12** |
| H01/G02 场景回归 | 场景A **32/32**、B **41/41**、C **38/38**、D 探针行为一致（非法实付拒绝报文同口径） |
| H02 整月保留 | r1 **15/15**、r2 **12/12**、r3 **17/17**（62 桶/跨月/备份恢复/旧 state 加载/收口只删最旧桶） |
| 字符串/JSON 最小回归（candidate native） | `mp_test_json_string` **76/76 ALL PASS**；`mp_test_json` **189 checks ALL PASS**（需项目根 cwd，首跑因 cwd 读不到夹具失败 2 项，换根后全过） |
| 工具套件（Node+真实新 WASM） | test-t05-store 22/22、test-self-pick、test-t06c-unified **109/109**、verify-t05-integration 17/17、test-t05-menu-default 69/69、test-t05-soldout-scope、test-t05a01a-dp-chain **13/13**、test-t05a01b-bnb-chain **10/10**（见下注）、test-logs-page 78/78、test-home-swap-sheet 21/21、test-month-summary 35、test-calendar 41、test-today-display 46、test-t05-modules 17/17、test-home-view 34、test-logs-meal-tabs 85 |
| 三算法入口/候选覆盖（真实新 WASM，默认配置） | greedy/dp/bnb 各发一单全部 `ok=true`、`candidatesEnumerated = 早餐46/午186/晚186`（cap256 无截断）；预算/锁定/售罄/自选实付/幂等/历史快照由场景B/C、test-t05-store 22 项、H02 r3 覆盖 |
| 三餐 DP 近似（诚实标记） | DP 默认即 DP32：三餐 `capsHit=maxDpStates(32)`（需求状态 46/5952/5333），plan flags 含 `APPROXIMATE_DISCRETIZATION`+`SEARCH_LIMIT_REACHED`；近似未被说成精确 |

**BnB 时长注记**：cap256 下 bnb-chain 场景 08/10 各约 6.3s/6.7s，整脚本累计超 25s 被 25s 硬超时截断（非挂死）；按卡要求如实记录，未放宽阈值，改以单进程 60s 诊断复跑确认 10/10 全过。

## 5. 资源观察（同一新 WASM，三餐请求，worker repeats=6：第 1 样=冷，后 5 样=正式）

| 算法 | 冷 coreMs | 正式 5 样 coreMs | 线性内存峰值 | 触限/标记 |
|---|---|---|---|---|
| greedy | 8.78 | 2.74 / 2.70 / 2.46 / 2.71 / 3.00 | 2,752,512 B（≈2.6 MiB），零增长 | 无 capsHit；APPROXIMATE_CANDIDATES（贪心近似） |
| dp（DP32） | 484.81 | 382.0 / 379.9 / 379.8 / 382.2 / 380.0 | 10,420,224 B（≈9.94 MiB） | 三餐 maxDpStates=32 capsHit + APPROXIMATE_DISCRETIZATION |
| branchAndBound | 6351.34 | 1192.3 / 1182.3 / 1182.5 / 1198.2 / 1186.2 | **363,986,944 B（≈347 MiB）** | maxSearchNodes=200000 触限（observed 200001），SEARCH_LIMIT_REACHED |

- 原始输出：`logs/t06d-bench-{greedy,dp,branchAndBound}.out/.resp.json`、请求 `logs/t06d-bench-*.req.json`（98307–98319 B，limits=256/32/200000/null）。
- **CPU 并发条件**：本机无法保证独占（其他用户进程在跑），以上仅为汇合观察量级，**不是正式性能结论**，不得据此宣称 A10/红米达标；正式页面/红米性能按卡在后置环节独占重测。未复用旧 WASM 计时，未把 Node 计时当真机。
- **如实报告的障碍/风险（不擅自降 K 或放宽阈值）**：BnB 在 cap256 + 200k 节点预算下线性内存峰值 ≈347 MiB（对比 DP32 的 9.94 MiB）。这在微信真机 WASM 内存约束下是实质风险，且 BnB 当前即触 maxSearchNodes（searchComplete=false）。留给 P01/集中验证裁定（提升节点预算只会更糟；压预算属改配置，不在本卡权限内）。
- `wallClockMs` 仍为 null 且未实现生效：本卡未把它当保护，未声称资源门全过；保留为集中契约核查项。

## 6. 未测项 / 边界（不伪报）

- 微信开发者工具编译/预览、真机、Toast/页面观感：未测（Node+真实 WASM+mock wx 口径）。
- DP20000 三餐：按卡未重跑（当前默认配置三餐即 DP32，不再发送 20000）。
- 正式性能/内存验收、A10、P09 总审：不在本卡，后置集中验证。
- 单菜换菜 UI：H03 旧证据适用范围维持 P01 裁定（成功/取消路径已走通；无候选分支纯 UI 不可触发）；test-home-swap-sheet 21/21 通过，不新增真机证据。
- 存储压力：62 桶上限的微信端存储体积未压测。

## 7. 过程事故记录（如实）

- 推广首步 `rm -rf miniprogram tools` 因 miniprogram 目录被其他进程占用而中断，`tools/`（含 `tools/core/` C++ 构建脚本目录）在此步被删除；因候选仅含 `tools/miniprogram`，覆盖复制未自动恢复 `tools/core/`。已在推广后全树 diff 中发现，并从 7f6a 备份**逐字节还原** `tools/core/`（还原后备份 vs 现态 tools 仅剩 9 个预期差异文件）。已复核 miniprogram 全树无缺失（diff 无 "Only in" 项）。
- 候选内测试运行时，`t05-test-helpers.mjs` 按其固定逻辑向 `Resources/报告/.toolchain/tmp/t05/` 写证据 JSON（其中含更早会话遗留文件）。已将该目录整体收编至本证据 `logs/t05-tmp-collected/`（原样保留）后删除该残留目录；生产路径的 `D:\项目\cpp\.toolchain` 未触碰。

## 8. 交付物清单（均在 `T06d-ZCode-统一资源修复-证据-v1/`）

| 项 | 路径 |
|---|---|
| 统一候选副本（=当前生产） | `candidate/`；终态 manifest `manifest/manifest.json` + `hashes.sha256` |
| 7f6a 生产备份 | `backup-生产7f6a-20261025/`（备份内 manifest 复算=7f6a6ea5…） |
| 合入后回归脚本 | `scripts/`（H01 六脚本 + 新增 `t06d-algo-coverage-probe.mjs`、`t06d-export-bench-requests.mjs`）；`tests/`（H02 四脚本） |
| 原始输出 | `logs/`（全部 .out/.json，含 bench 原始计时与响应） |

完成后停写。状态：**统一开发候选，待集中验证**。本卡不做 P09 最终审查，不要求用户补拍，不改 PPT。

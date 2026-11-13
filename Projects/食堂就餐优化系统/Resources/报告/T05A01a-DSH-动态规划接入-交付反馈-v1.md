# T05A01a 动态规划端到端接入｜交付反馈 v1

## 1. 任务与版本

| 项 | 值 |
|---|---|
| 任务卡 | `Resources\任务卡\T05A01a-DSH-动态规划端到端接入小卡-v1.md`（只做本卡；T05A01b 分支限界未开始、未混入） |
| 主 PRD | v0.2（2026-10-20，产品需求未改）；本卡对应 §5「三个手写核心算法·动态规划」与「搜索上限触发时标近似、限制原因及未证明最优」 |
| 岗位约定 | 项目 `AGENTS.md` 的「模型、范围与共享文件」「报告与复核」；用户路由为前端/UI 由 DSH 请求 DeepSeek V4.1 Flash |
| 生产基线 | `sha256:29deba8f66e85207e7d0fdd87cdf18250b6d5acdfb2853ac42d34b3c86a78d8b`（75 源文件 / 882,086 B；38 工具 / 447,791 B），与 Lead 提供的共享基线一致 |
| 隔离副本 | `...\T05A01a-DSH-动态规划接入-证据-v1\candidate\`，改动后 `sha256:6fc1c582c3814444d7a918ce0480ef23c85698e052428d4d30eeaa63737e36fc`（75 源 / 887,403 B；39 工具 / 485,401 B） |
| 冻结 WASM | 未重建：107,472 B，`B53C7405A643E8409071ED76D3CB4CCBDF1A37E6E5C408CE1D4A373D4CC00744` |
| 实际 cwd | `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T05A01a-DSH-动态规划接入-证据-v1\candidate` |
| 指定模型 | DeepSeek V4.1 Flash（P01 派单） |
| 实际模型/档位 | 可核实的可见运行时标识：`deepseek-v4.1-flash-1017`；Harness 服务端真实路由/额度不可从本会话证得，按未知记录，不把请求配置当实际证明 |
| 工具链 | Node v24.19.0 / V8 13.6.233.17-node.51 / win32 x64 10.0.26300 / AMD Ryzen 5 5600U（12 线程） |

## 2. 产物与哈希

| 产物 | 绝对路径 | SHA256 |
|---|---|---|
| 统一补丁（相对生产基线，`git apply --check` 退出 0） | `...\T05A01a-DSH-动态规划接入-证据-v1\T05A01a-相对基线统一补丁.patch` | `514c847d0e2203d64f8a5457fefdf913b7afbdd3cb89b12af51bfa87aca0cbb6` |
| candidate 清单 | `...\T05A01a-DSH-动态规划接入-证据-v1\manifest\manifest.json` | `c065912d122f3a05a48e3c9f784672759080bbf17c361ff812c671741691d68c` |
| 逐文件清单 | `...\manifest\hashes.sha256` | `2df5946c7aa6f5c7a78401fdae9fc8cbb4239e402a1547b214633c5cba7bb8b9` |
| 生产未改动复核输出 | `...\manifest\production-unchanged-20261024.txt` | `c8e7512adbcd3aa90a816cc2b9e37c3e4f929036f117fc01f12477185abcc1c1` |
| 变更文件哈希对照 | `...\manifest\baseline-vs-candidate.txt` | `f325c75087e8f4be8a1489a7910d58f0b5a66d6eff6d77f46a9057781e5af787` |
| Node 验证结构化结果 | `...\evidence-node\result.json` | `47ebdfcf79b2bfb5e3e4a496d9c897faf74c43a49e567ca1d431145c85fa5f84` |
| Node 验证原始日志 | `...\evidence-node\test-run.log` | `0350b8177411ae0990039d87fc62b4e7dc269f24766947dc00797cbdcba7ad19` |
| 既有 T05 集成验证结果 | `...\evidence-node\verify-t05-integration.json` | `f98a69c8f1172cd3c77fb6d5f32d7234003decdbf4554a042d7c392599502597` |
| 变更清单 | `...\变更清单.md` | 见目录 |
| candidate 内只读输入复制 | `...\candidate\Resources\契约\T01-v1.2-candidate\nutrition-v1-candidate.json` | `8254ab22dca9ceea1e41f575373442781ae7184de40169041fd02b2e8308d191`（与生产同路径文件逐字节一致，未改写） |

## 3. 实际操作与原始结果

全部命令在 candidate 根执行；日志原文在 `...\logs\`（失败原文保留，不改写）。

| # | 命令 | 结果 |
|---|---|---|
| 1 | `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-t05a01a-dp-chain.mjs --out <证据>\evidence-node` | 13/13 通过（`logs\01-test-t05a01a-dp-chain.log`） |
| 2 | `node tools/miniprogram/typecheck-src.mjs` | 0 errors across 38 files（`logs\02`） |
| 3 | `node --import … check-pages.mjs` | 全部页面静态检查通过；绑定根标识符均可解析（`logs\03`） |
| 4 | `node --import … test-core-bridge.mjs` | pass 12 / fail 1：能力测试通过（dp 可过、其他被拒）；失败项为 `loadCore` 的基线既有问题（见 §6）（`logs\04`） |
| 5 | `node --import … test-t05-modules.mjs` | 17/17 通过（复制契约输入后；首次 ENOENT 原文见 `logs\05` 重跑前记录，最终日志已为通过）（`logs\05`） |
| 6 | `node --import … test-t05-store.mjs` | 28/28 通过（含用例 13 greedy/dp 可保存）（`logs\06`） |
| 7 | `node --import … verify-t05-integration.mjs` | 17/17 通过（既有集成验证；结果 JSON 见 `evidence-node\verify-t05-integration.json`，其助手原写入 `Resources\报告\.toolchain` 的副本已移入本目录并清理临时目录）（`logs\07`） |
| 8 | `cd <生产根>; node tools/miniprogram/candidate-manifest.mjs` | 生产 `sourceTreeDigest` 仍 `29deba8f…`，75/882,086，38/447,791，`frozenWasmMatches:true`（`manifest\production-unchanged-20261024.txt`） |
| 9 | `cd <生产根>; git apply --check <补丁>` | 退出 0，13 个文件可干净应用 |

说明：Node 宿主 + mock wx 存储 + 真实冻结 WASM 的结论**只能**记在 Node 栏；微信开发者工具、模拟器、真机本轮全部未测（禁止占用模拟器/真机，其他任务并行中）。

## 4. 逐项验收状态（证据逐条对应）

| 验收项 | 状态 | 证据 |
|---|---|---|
| A1 走既有设置/诊断入口可选中动态规划；简易/完整两模式同一入口 | 通过（Node） | 场景 12：真实 `Page` 处理器 `onSelectAlgorithm` 写设置成功；`saveDisplayMode('full')` / `'simple'` 下均可用且互不覆盖 |
| A2 保存后关闭重开仍保留 | 通过（Node，mock 持久化） | 场景 02：杀进程重开 `init.message=已恢复本地数据`，`settings.algorithm=dp` |
| A3 备份导出→恢复往返不丢数据 | 通过（Node） | 场景 03：8 行对照全相等、摘要一致，dp 设置与已吃记录保留 |
| A4 默认仍是贪心 | 通过 | 场景 01：`DEFAULT_ALGORITHM='greedy'`；首页能力说明 `greedy / dp` |
| A5 真实生产桥发出 `algorithm=dp` 并由冻结 WASM 返回 | 通过（Node） | 场景 06/08：请求 `plannerConfig.algorithm=dp`，响应 `search.algorithm=dp`；场景 06 同一请求原文重放响应逐字节一致（非前端伪造） |
| A6 首页展示 dp 结果；首页无新增算法面板 | 通过（Node 视图层） | 场景 06/08：`getHomeView` 3 个方案、三餐均有推荐；首页源文件未改（补丁仅 9 个文件，无 home） |
| A7 非法算法仍明确拒绝 | 通过（Node） | 场景 04：`saveSettings`、状态载入、备份预检三处均拒绝并回显实际值；`validateState` 消息含 `greedy / dp` |
| A8 每个算法选项实际请求/响应原文（真实冻结 WASM，Node/微信分栏） | Node 通过；微信未测 | `requests\greedy-simulated|dp-simulated|greedy-west1|dp-west1`（入口：首页「刷新方案」同一 `store.refreshPlan`；输入含模拟菜单与内置西一真实菜单）；`dp-limit|dp-after-eaten|dp-locks` 为专项场景 |
| A9 DP 触限按核心标记标「近似/未证明最优」 | 通过（Node） | 场景 09：只压低真实请求 `limits`（`maxDpStates=1,maxSearchNodes=1`）后核心给 3 条 `capsHit`（observed 7/14/14）、`searchComplete=false`、3 条 `APPROXIMATE_DISCRETIZATION`；前端映射出「近似结果：DP 状态被离散化/截断（未证明最优）」+「触及搜索限额」 |
| A10 已吃/餐次保护不回退 | 通过（Node） | 场景 10：`planningMeals=['lunch','dinner']`，`activeLogs` 携带早餐，dp 响应不给早餐出推荐，首页早餐保持已确认 |
| A11 锁定保护不回退 | 通过（Node） | 场景 11：菜品锁/窗口锁进请求且在 dp 方案生效；标售罄造成失效锁时返回 `LockConflict`、未再调用核心、锁定记录保留（未静默解锁） |
| A12 只做受影响验证；前端不复制算法 | 通过 | 场景 13：src 无核心算法符号、75 文件未扩张；`mp_plan` 仍只在 `utils/core-bridge.ts` 桥接；补丁只动设置/能力门/文案/诊断页与受影响测试 |

## 5. 未测项（不得视为通过）

1. 微信开发者工具编译/运行、WXML 真实渲染与点击、DP 结果在真机界面的展示。
2. 真机（红米 K90 Pro Max）上的持久化、杀进程重开、备份文件读写。
3. 微信运行时 `WXWebAssembly` 下 DP 的耗时与端到端响应（Node 耗时不可外推）。
4. 小程序整体视觉/交互回归（本轮仅静态页检查，不能替代开发者工具编译）。

## 6. 缺陷与风险

1. **基线既有失败（非本卡引入）**：`tools/miniprogram/test-core-bridge.mjs` 的 `loadCore：空 import 对象实例化；缺导出时列出名称` 在生产树同样失败（`Error: WASM 缺少必需导出：mp_offer_nutrition`，生产复现 pass 12 / fail 1），原因是该用例的 mock 核心未提供 `mp_offer_nutrition`；本卡未修、未掩盖，能力门相关断言已改且通过。建议另派小卡处理。
2. 首次跑 `test-t05-modules.mjs` 因 candidate 内缺 `Resources\契约\T01-v1.2-candidate\nutrition-v1-candidate.json` 报 ENOENT；已按边界原样复制该只读输入后 17/17 通过，未改其内容。
3. `verify-t05-integration.mjs` 的助手固定写 `Resources\报告\.toolchain\tmp\t05\`；本次产生 1 个 JSON 已移入本证据目录并删除该临时目录，未改助手/未扩大写入范围。后续跑该脚本仍会写该处，需 P01 知晓。
4. candidate 内的 `Resources\契约\…json` 只用于本地测试读取，不属交付代码；合并生产时不需要带上。

## 7. 交接与下一步

- 生产树未改动（`29deba8f…` 复核通过）；本卡交付形式为「隔离候选 + 统一补丁 + 证据」，由 P01 决定合并/替换方式，合并后需重跑受影响测试（Node）并补微信/真机验证。
- 下一负责人：P01（查收与集成）；P02 可按本文件与 `变更清单.md` 逐项核对；P09 独立复核时以 `candidate\` + `manifest\` + 请求/响应原文为准。
- T05A01b（分支限界）未开始，请勿把本卡证据外推到该卡。
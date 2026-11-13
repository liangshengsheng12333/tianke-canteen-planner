# T05A01b 分支限界端到端接入｜交付反馈 v1

## 1. 任务与版本

| 项 | 值 |
|---|---|
| 任务卡 | `Resources\任务卡\T05A01b-DSH-分支限界端到端接入小卡-v1.md` |
| 主 PRD | v0.2（2026-10-20，产品需求未改）；本卡对应 §5「三个手写核心算法·分支限界」与「触限标近似/未证明最优；无方案时明确资源限制、不称已证明无解」 |
| 前置依赖 | T05A01a（task-1）已完成并由 Lead 独立核验；本卡未重做 A01a |
| 共同基线（生产树，未改） | `sha256:29deba8f66e85207e7d0fdd87cdf18250b6d5acdfb2853ac42d34b3c86a78d8b`，75 源 / 882,086 B，38 工具 / 447,791 B |
| 输入（A01a 隔离候选，实际引用） | `...\T05A01a-DSH-动态规划接入-证据-v1\candidate\`，`sha256:6fc1c582c3814444d7a918ce0480ef23c85698e052428d4d30eeaa63737e36fc`（75 源 / 887,403 B；39 工具 / 485,401 B，取自 A01a manifest）；复制到本卡 candidate 后、修改前复核 digest 一致，未猜摘要 |
| 本卡候选 | `sha256:6a10275df1bff891c0154548ef483c00e39ef58ffacc2701b52b9a18ac51b558`（75 源 / 887,788 B；40 工具 / 523,166 B） |
| 冻结 WASM | 未重建：107,472 B，`B53C7405A643E8409071ED76D3CB4CCBDF1A37E6E5C408CE1D4A373D4CC00744` |
| 实际 cwd | `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T05A01b-DSH-分支限界接入-证据-v1\candidate` |
| 请求模型 | DeepSeek V4.1 Flash（Lead 派单） |
| 客户端可见实际模型 | `deepseek-v4.1-flash-1017`（会话运行标识）；服务端真实路由/档位/额度不可从本会话证得，按未知记录；不把请求配置当实际证明 |
| 工具链 | Node v24.19.0 / V8 13.6.233.17-node.51 / win32 x64 10.0.26300 / AMD Ryzen 5 5600U（12 线程） |

## 2. 产物与哈希

| 产物 | 绝对路径 | SHA256 |
|---|---|---|
| 累计补丁（含 A01a + 本卡，后续合入只用本份） | `...\T05A01b-DSH-分支限界接入-证据-v1\T05A01b-相对共同基线累计补丁.patch` | `aa7a9c4e20075e314fdc6c07e7fc9c969dc682d97512e56b4ed75e83a6d06218` |
| 本卡候选清单 | `...\manifest\manifest.json` | `a768c1549aa2e620ec6038050657ddeafd475109666d528b783451267b165799` |
| 逐文件清单 | `...\manifest\hashes.sha256` | `0573a44dc0d870be73c919d9a7dc88064739ba4ed94c9d2a83dc41935c4e8682` |
| 生产未改动复核输出 | `...\manifest\production-unchanged-20261024.txt` | `c8e7512adbcd3aa90a816cc2b9e37c3e4f929036f117fc01f12477185abcc1c1` |
| 累计变更逐文件哈希 | `...\manifest\baseline-vs-candidate.txt` | `3166240da221bf9c652463734ad0de8b3990e2654986667aa7e0e6986d768754` |
| Node 验证结构化结果 | `...\evidence-node\result.json` | `1ad1c9267160d091e20b6b22c672e3225d8b35fd2800840cf4db3c0a55e51b23` |
| Node 验证原始日志 | `...\evidence-node\test-run.log` | `58725320991025f310c270e78ed35ed073d37cdcdd7aa7f0c887f6c78a0f6101` |
| A01a 链路在本卡候选的重跑结果 | `...\evidence-node\a01a-rerun\result.json` | `f8a60e5b2dfca8f92af366e1b091fdc8bffad016ed572c57f9414870ff3bedb2` |
| 既有 T05 集成验证结果 | `...\evidence-node\verify-t05-integration.json` | `2823e106526ffc0b944299554406d7e88173cd08719dac99ccc10db9ed643221` |
| 变更清单 | `...\变更清单.md` | `77ef3ae8529eb8ad330a62babe6ea238f79d2bb0ff7b63ba13327af16f5c293d` |
| candidate 内只读输入复制 | `...\candidate\Resources\契约\T01-v1.2-candidate\nutrition-v1-candidate.json` | `8254ab22dca9ceea1e41f575373442781ae7184de40169041fd02b2e8308d191`（与生产同路径逐字节一致） |

## 3. 实际操作与原始结果

全部命令在 candidate 根执行；日志原文在 `...\logs\`（失败原文保留）。

| # | 命令 | 结果 |
|---|---|---|
| 1 | `node --import … test-t05a01b-bnb-chain.mjs --out <证据>\evidence-node` | 10/10 通过（`logs\01`） |
| 2 | `node tools/miniprogram/typecheck-src.mjs` | 0 errors across 38 files（`logs\02`） |
| 3 | `node --import … check-pages.mjs` | 全部页面静态检查通过（`logs\03`） |
| 4 | `node --import … test-core-bridge.mjs` | pass 12 / fail 1：三算法能力测试通过；唯一失败为基线既有的 `loadCore` mock 缺 `mp_offer_nutrition`（生产同样复现，非本卡引入）（`logs\04`） |
| 5 | `node --import … test-t05-modules.mjs` | 17/17 通过（`logs\05`） |
| 6 | `node --import … test-t05-store.mjs` | 28/28 通过（用例 13 已覆盖三算法保存）（`logs\06`） |
| 7 | `node --import … test-t05a01a-dp-chain.mjs --out …\a01a-rerun` | 13/13 通过（A01a 链路在新候选上未回退；白名单断言随三算法更新）（`logs\07`） |
| 8 | `node --import … test-home-view.mjs` | 34 项全通过（`logs\08`） |
| 9 | `node --import … verify-t05-integration.mjs` | 17/17 通过（`logs\09`；助手原写入 `Resources\报告\.toolchain` 的 JSON 已移入本目录并清理临时目录） |
| 10 | `cd <生产根>; git apply --check <累计补丁>` | 退出 0（14 个文件可干净应用） |
| 11 | `cd <生产根>; node tools/miniprogram/candidate-manifest.mjs` | 生产 `sourceTreeDigest` 仍 `29deba8f…`，75/882,086，38/447,791，`frozenWasmMatches:true` |

说明：Node 宿主 + mock wx 存储 + 真实冻结 WASM 的结论只能记在 Node 栏；微信开发者工具、模拟器、真机本轮全部未测（按边界禁占）。

## 4. 逐项验收状态（证据逐条对应）

| 验收项 | 状态 | 证据 |
|---|---|---|
| 同一设置入口可选三算法，简易/完整模式共用 | 通过（Node） | 场景 07：诊断页 3 个选项，真实 `Page` 处理器 `onSelectAlgorithm` 写入 branchAndBound/greedy 成功；`full`/`simple` 显示模式互不覆盖 |
| 三算法分别实发并被真实冻结 WASM 处理 | 通过（Node） | 场景 05：同一基础状态（仅 algorithm 不同）分别发 greedy/dp/branchAndBound；除 algorithm 外三份请求逐字一致；响应 `search.algorithm` 分别回显；同一请求重放响应逐字节一致；greedy nodes=25、dp states=1477、branchAndBound nodes=273 |
| 切换设置使旧推荐按既有规则失效、已吃记录不变 | 通过（Node） | 场景 06：greedy 方案 + 已吃早餐后切 branchAndBound→dp，每次旧 `plan` 置空、logs 的 recordId 与条数不变、首页早餐仍「已确认」；重算 `planningMeals=['lunch','dinner']`，activeLogs 携带早餐，响应不给早餐推荐 |
| 重开/恢复不丢已选算法 | 通过（Node） | 场景 02：branchAndBound 落盘后杀进程重开仍为 branchAndBound，诊断视图一致；场景 03：备份导出→预检→恢复 8 行对照全等、摘要一致，算法与已吃记录保留 |
| 默认仍贪心 | 通过 | 场景 01：`DEFAULT_ALGORITHM='greedy'`；三算法顺序 greedy 在前 |
| 触搜索限额时不称全局最优/证明无解 | 通过（Node） | 场景 08（有方案）：`maxSearchNodes=3` → `OkPartial`、`searchComplete=false`、capsHit `maxSearchNodes(3, observed 4)`、前端 flag「触及搜索限额」、文案无最优声明；场景 10（无方案）：`maxSearchNodes=2` → `ResourceLimited`、0 方案、`searchComplete=false`、状态标「触及搜索限额（未证明无解）」、消息含「不能声称最优」「不等于证明无解」，不冒充无解 |
| 非法算法仍明确拒绝 | 通过（Node） | 场景 04：`dynamicProgramming`/`greedy2` 在 saveSettings、状态载入、备份预检三处均被拒，消息含三算法范围与实际值 |
| 不重写核心 / WASM 未重建 / 前端不复制算法 | 通过 | 场景 09：src 75 文件未扩张，无 C++ 算法符号；`mp_plan` 仍只在 `utils/core-bridge.ts` 桥接；补丁只动白名单/文案/诊断入口/受影响测试；WASM 哈希未变 |
| 只做受影响验证 + 最小必要回归 | 通过 | 上述 9 条命令；A01a 链路 13/13 重跑未回退；无微信/真机结论混入 |
| 含 A01a 的相对共同基线总补丁可应用 | 通过 | 累计补丁 `git apply --check` 退出 0；14 个文件；后续合入只套本份，不再额外套 A01a |

三算法同输入要点（`evidence-node\requests\*-same-input.*`）：greedy `OkPartial`/1 方案/`nodesEvaluated=25`；dp `OkPartial`/3 方案/`statesEvaluated=1477`/`searchComplete=true`；branchAndBound `OkPartial`/3 方案/`nodesEvaluated=273`/`searchComplete=true`。greedy 的 `searchComplete=false` 是核心既有语义（贪心不声称完成全局搜索），非本卡改动。

## 5. 未测项（不得视为通过）

1. 微信开发者工具编译/运行、WXML 真实渲染与点击、三算法在真机界面的展示与切换。
2. 真机（红米 K90 Pro Max）上的持久化、杀进程重开、备份文件读写。
3. 微信运行时 `WXWebAssembly` 下分支限界的耗时与端到端响应（Node 的 nodes/states 数值不可外推为真机性能）。
4. 小程序整体视觉/交互回归（本轮仅静态页检查，不能替代开发者工具编译）。

## 6. 缺陷与风险

1. **基线既有失败（非本卡引入）**：`test-core-bridge.mjs` 的 `loadCore：空 import 对象实例化；缺导出时列出名称` 在生产树同样失败（`WASM 缺少必需导出：mp_offer_nutrition`，生产复现 pass 12 / fail 1），原因是该用例 mock 核心未提供该导出。本卡未修、未掩盖；三算法能力测试已改且通过。建议另派小卡处理。
2. `verify-t05-integration.mjs` 的助手固定写 `Resources\报告\.toolchain\tmp\t05\`；本次产生 1 个 JSON 已移入本证据目录并删除临时目录，未改助手、未扩大写入范围。后续跑该脚本仍会写该处，需 P01 知晓。
3. 为保持累计候选内测试与三算法一致，`test-t05a01a-dp-chain.mjs` 在其原有断言上做了白名单相关最小更新（受支持列表 3 个、非法值改用 dynamicProgramming/greedy2、诊断页 3 选项）。**A01a 原证据目录与其 manifest/补丁未改**；A01a 卡的结论仍以 A01a 证据为准。
4. candidate 内的 `Resources\契约\…json` 只用于本地测试读取，不属交付代码；合并生产时不需要带上。

## 7. 交接与下一步

- 生产树未改动（`29deba8f…` 复核通过）。本卡交付为「A01a 候选 + 本卡增量」的累计候选与累计补丁，由 P01 决定合入方式；合入后需重跑受影响 Node 测试并补微信/真机验证。
- 下一负责人：P01（查收与合入）；P02 可按本文件与 `变更清单.md` 逐项核对；P09 独立复核以 `candidate\` + `manifest\` + 请求/响应原文为准。
- 后续合入只用 `T05A01b-相对共同基线累计补丁.patch`（已含 A01a），不要再套 A01a 补丁。
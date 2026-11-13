# T05A-M-U｜DSH 三路功能收尾 · 归集交付反馈 v1

- 派单入口：`Resources/任务卡/T05A-M-U-DSH-三路并行功能收尾转交小卡-v1.md`
- 归集执行：Team Lead（主执行员，`lead`）；cwd `D:\项目\cpp`；项目根 `D:\项目\cpp\Projects\食堂就餐优化系统`
- 日期：2026-10-24（Asia/Shanghai）
- 共同基线：`sha256:29deba8f66e85207e7d0fdd87cdf18250b6d5acdfb2853ac42d34b3c86a78d8b`，75 源 / 882,086 B；38 工具 / 447,791 B；WASM 107,472 B / `B53C7405A643E8409071ED76D3CB4CCBDF1A37E6E5C408CE1D4A373D4CC00744`；正式菜单 37,157 B / `0657E2B26F2AE19EBAF98322AA9A167E3D0350C8D2132A8FF11F9D037981C607`。manifest：`Resources/报告/T08f05-P01-接收核对证据-20261024-v1/manifest/manifest.json`
- 性质：**本文件只归集各路反馈与候选，不含任何生产合入**。四张卡均已产出隔离候选 + 证据 + 唯一反馈，不是「已准备/已派出」；微信开发者工具、模拟器、真机全部未测。

## 1. 归集总表

| 路 | 任务卡 | 共享任务 | 子代理 | 唯一反馈（点击可开） | 隔离候选摘要（miniprogram/src, 工具） | 统一补丁（B / SHA-256） | 交付状态 |
|---|---|---|---|---|---|---|---|
| 算法路① | T05A01a 动态规划端到端接入 | task-1 completed | `algo-route` | [T05A01a-DSH-动态规划接入-交付反馈-v1.md](T05A01a-DSH-动态规划接入-交付反馈-v1.md) | `sha256:6fc1c582c3814444d7a918ce0480ef23c85698e052428d4d30eeaa63737e36fc`，75 / 887,403 B；39 / 485,401 B | `T05A01a-相对基线统一补丁.patch`，64,308 B / `514c847d0e2203d64f8a5457fefdf913b7afbdd3cb89b12af51bfa87aca0cbb6` | 完成（Node 13/13；微信/真机未测） |
| 算法路② | T05A01b 分支限界端到端接入（依赖①） | task-4 completed | `algo-route` | [T05A01b-DSH-分支限界接入-交付反馈-v1.md](T05A01b-DSH-分支限界接入-交付反馈-v1.md) | `sha256:6a10275df1bff891c0154548ef483c00e39ef58ffacc2701b52b9a18ac51b558`，75 / 887,788 B；40 / 523,166 B | `T05A01b-相对共同基线累计补丁.patch`（含①），103,644 B / `aa7a9c4e20075e314fdc6c07e7fc9c969dc682d97512e56b4ed75e83a6d06218` | 完成（Node 10/10 + ①重跑 13/13；微信/真机未测） |
| 菜单路 | T05M02 默认真实菜单与快捷切换 | task-2 completed | `menu-route` | [T05M02-DSH-真实菜单入口-交付反馈-v1.md](T05M02-DSH-真实菜单入口-交付反馈-v1.md) | `sha256:471febbdfbe39384c38f45c9fc4ee80abf2a55f74a6cd03da78d4b67bc3a6e14`，75 / 884,865 B；39 / 482,397 B | `patch/T05M02-真实菜单入口.patch`，59,855 B / `8bda19ba2c0b5b5ffa9d7a94c4483bda53d680dd0358802f6f1167938f5368e8` | 完成（Node 新增 69/69；微信/真机未测） |
| 记录路 | T05U07 记录页早/中/晚标签切换 | task-3 completed | `records-route` | [T05U07-DSH-记录餐次标签-交付反馈-v1.md](T05U07-DSH-记录餐次标签-交付反馈-v1.md) | `sha256:d573ee6c604d9bbded1666908c8f156e3ec11b779e35f2baac6c9da9ae6b0a22`，75 / 887,361 B；39 / 479,686 B | `patch/T05U07-vs-baseline.patch`，44,611 B / `34116eca535592c18ac9e83cecbd11e24739910041f6feb3cf8317e4e9cb3583` | 完成（Node light/dark 各 85/85；微信/真机未测） |

证据目录：`Resources/报告/T05A01a-DSH-动态规划接入-证据-v1/`、`T05A01b-DSH-分支限界接入-证据-v1/`、`T05M02-DSH-真实菜单入口-证据-v1/`、`T05U07-DSH-记录餐次标签-证据-v1/`（各含 candidate、manifest、补丁、日志、请求/响应原文或页面数据）。

## 2. 请求模型与实际模型

| 项 | 记录 |
|---|---|
| 请求模型（派单口径） | **DeepSeek V4.1 Flash**（三路四卡一致；主执行员与三个子代理均由同一 DSH 会话派生） |
| 实际可见模型 | Harness 会话运行标识 `deepseek-v4.1-flash-1017`（三个子代理 `model` 字段与请求一致；各反馈文件同记） |
| 服务端真实路由/子型号/量化档位/额度 | **未知**（执行侧无法核实，不把请求配置写成实际证明） |
| 平台槽位与并行程度 | 三个子代理（算法/菜单/记录）同时开启并全程并行；算法路两张卡按卡面串行（A01a 交付 → Lead 核验 → A01b），未把两卡混成一个大任务；未出现槽位不足分波 |

## 3. 各路完成 / 未完成 / 未测（摘要）

**算法路（A01a→A01b，同一 `algo-route`）**
- 完成：A01a 在既有诊断页设置入口接通 `greedy/dp`（持久化、重开保留、备份往返、能力门、请求构造、旧「只支持 greedy」文案、DP 触限标近似、已吃/锁定保护）；A01b 在同一链路加入 `branchAndBound`，三算法可选、默认仍贪心、复用共享白名单与文案、不复制业务状态。三算法同输入各实发一单并由真实冻结 WASM 处理：greedy `nodesEvaluated=25`/1 方案、dp `statesEvaluated=1477`/3 方案、branchAndBound `nodesEvaluated=273`/3 方案；触限有方案 `OkPartial`+「触及搜索限额」、无方案 `ResourceLimited`+「触及搜索限额（未证明无解）」。
- 未完成/失败：无阻塞失败。基线既有失败 `test-core-bridge.mjs` 1 项（`WASM 缺少必需导出：mp_offer_nutrition`，生产同样复现，两卡均未修未掩盖）。
- 未测：微信开发者工具编译/渲染/点击、真机持久化与杀进程重开、微信 `WXWebAssembly` 下 dp/BnB 耗时与端到端响应。

**菜单路（M02）**
- 完成：空存储/无有效菜单首开默认内置西一真实菜单（`source=builtin`、5 窗口/35 菜/35 报价、首开 0 次业务写入）；已导入自定义菜单与真实就餐记录重开不被覆盖；首页一行「当前菜单名 + 切换 ›」直达既有 `/pages/menu/index?focus=import` 选择/预检/确认流程；取消不变、写失败保留原数据；浅/深色对比度 4.70–15.12（≥4.5）且样式只走 `--tk-*`；示例菜单仅保留显式导入的开发/演示用途。
- 未完成/未失败：无阻塞缺陷。`verify-t05-integration.mjs`、`measure-t05.mjs`、`run-t05-all.mjs` 因会写共享 `.toolchain/tmp/t05`（超出本卡写入边界）**未执行**，已如实列明，交 T06c 在授权目录复跑。
- 未测：微信侧全部（页面渲染、`wx.navigateTo`/`pageScrollTo`、真机深浅色与字体）；截图级视觉证据。

**记录路（U07）**
- 完成：记录页新增早/中/晚三标签，只渲染选中餐次；首进按时段选餐、`?meal=` 优先、手选后本次页面保持；切标签/日期只换查看范围不写数据；当日/月度汇总仍按全部有效餐次；确认/修改/撤销/补记与历史只读归属正确；深浅色与双模式沿用现有令牌。Node light/dark 各 85 项全 PASS，11 个既有测试与生产基线失败集合完全一致。
- 未完成/失败：无阻塞缺陷；基线既有 `test-logs-page` 2 项、`test-core-bridge` 1 项失败（与本卡无关，未修）。
- 未测：微信开发者工具/模拟器/真机页面渲染与截图。

## 4. Lead 独立核验（不依赖子代理自述）

| 核验项 | 实际命令/方法 | 结果 |
|---|---|---|
| 生产基线未漂移（全程多次，开工/交付中/收尾） | `node tools/miniprogram/candidate-manifest.mjs` | 始终 `sha256:29deba8f…a78d8b`，75 / 882,086 B，38 / 447,791 B，`frozenWasmMatches=true` |
| WASM / 正式菜单未变 | `Get-FileHash` | WASM `B53C7405…CC00744`；菜单 `0657E2B2…C607` |
| 四份补丁可应用到生产基线 | `git apply --check`（只检不改） | A01a 退出 0（13 文件）；A01b 累计退出 0（14 文件）；M02 退出 0（16 文件）；U07 退出 0（4 文件） |
| A01a 隔离证据未被后续卡篡改 | 重算 `T05A01a-相对基线统一补丁.patch` | 仍为 `514c847d…cbb6`（与 A01a 反馈登记一致） |
| dp 真实请求/响应 | 抽查 `evidence-node/requests/dp-west1.*` | 请求 `plannerConfig.algorithm=dp`；响应 `search.algorithm=dp`、`statesEvaluated=124`、`capsHit=[]` |
| 三算法同输入 | 重新解析 A01b `requests/*-same-input.*` | 三份请求除 `algorithm` 外逐字一致；响应算法回显 greedy/dp/branchAndBound；bnb `nodesEvaluated=273`；触限 `capsHit=[maxSearchNodes(3, observed 4)]`、无方案 `ResourceLimited`+`INSUFFICIENT_DISTINCT_PLANS` |
| U07 一键自核 | 复读 `repro-verify.log` | 12/12 PASS（生产未变、补丁 apply 通过、补丁重建候选 digest/计数一致、light/dark 各 85 项） |
| 候选清单与报告一致 | 读四份 `manifest/manifest.json` | 四份 `sourceTreeDigest` 与各自反馈登记逐一相同 |
| 越界写入扫描 | 近 3 小时文件扫描 + `.toolchain` 检查 | 生产 `miniprogram/src`、`tools`、`core`、WASM、正式菜单零改动；`Resources/报告/.toolchain` 无残留；子代理写入仅落在各自证据目录与唯一反馈文件 |

## 5. 交 T06c（后置另派）的合入注意

1. **算法路只套累计补丁**：`T05A01b-相对共同基线累计补丁.patch` 已含 A01a，**不得再额外套 A01a**；A01a 的单卡补丁仅作历史复核。
2. **A01b × M02 存在语义交叠，不能机械顺序 apply**：两补丁同改 `domain/app-state.ts`、`domain/store.ts`、`domain/types.ts`、`pages/dev/index.ts`、`pages/menu/index.wxml`。Lead 已在临时副本实测：先 A01b 后 M02、先 M02 后 A01b 两种顺序的 `git apply --check` 均为退出 1（`store.ts` 冲突）。T06c 需按语义合并（尤其 `store.ts` 的 `catalog()` 兜底来源与算法设置门、`types.ts` 的 `CatalogSource` 与 `SUPPORTED_ALGORITHMS` 两组新增）。
3. **U07 可叠加**：实测在已应用 A01b 的副本上 `git apply --check T05U07` 退出 0，且只动 `pages/logs/index.ts|wxml|wxss` + 新增测试工具，与另两路无文件交叠。
4. **M02 必须整份打补丁**：16 文件含 4 个测试夹具对齐与 1 个新增验收脚本；只拷 `candidate/miniprogram/src` 会缺夹具与脚本。
5. **合入后必做**：在授权 TMP 目录复跑 `verify-t05-integration.mjs`/`run-t05-all.mjs`（M02 未跑）；补微信开发者工具 + 真机验证（三路均未测）；`test-logs-page` 2 项与 `test-core-bridge` 1 项既有失败另行安排，不在合入卡内顺手改产品文案。

## 6. 未完成 / 未测清单（不得视为通过）

1. 三路全部未做微信开发者工具编译与真机验证；无任何截图/屏录级证据。
2. M02 三个写共享 TMP 目录的脚本未执行（边界原因，见 §3）。
3. 基线既有失败 3 项（`test-core-bridge` 1、`test-logs-page` 2）未修。
4. 生产未合入任何一路；四份补丁均只经 `git apply --check`，未写入 `miniprogram/src`、`tools`。
5. MEMORY 四文件本轮由 P01 侧并行维护（Lead 未写，避免并发覆盖）；三路状态以本文件为准，请 P01 归档时同步索引。

## 7. 下一负责人

- **P01**：查收本归集文件与四份唯一反馈，决定 T06c 合入顺序与语义合并方式；更新 MEMORY 索引。
- **P02**：按各反馈文件 + 证据目录逐项查收（候选清单、补丁、日志、请求/响应原文）。
- **P09**：只验不修，独立复核算法路（三算法真实响应、触限语义）与两条 UI 路（汇总口径、默认菜单来源）。
- **有模拟器/真机窗口的岗位**：补三路页面截图与微信环境实测，回填 §6 第 1 项。

## 8. 结论

**三路（四卡）均已完成隔离交付并被 Lead 独立核验：生产基线全程为 `29deba8f…a78d8b`（75/882,086 B、38/447,791 B、WASM 与正式菜单未变），四份补丁分别可干净应用到基线；A01a/A01b 算法链路、M02 默认菜单与切换入口、U07 记录页三标签均有 Node 侧实跑证据。失败项为 0 项阻塞、3 项基线既有失败；微信/真机与 M02 三个共享 TMP 脚本为未测。生产未合入任何一路，合入归后置 T06c。**
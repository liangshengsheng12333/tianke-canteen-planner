# T02｜DSH｜接入前定点修正｜交付反馈

- **日期**：2026-10-20（Asia/Shanghai）
- **执行卡版本**：`T02-DSH 接入前定点修正 v1`（`Resources\任务卡\T02-DSH-接入前定点修正-v1.md`）
- **反馈文件版本**：v2
- **任务范围与子交付边界**：只修 T02 当前受支持子集（`algorithm=greedy`、`comboRules=[]`）的 **DSH C++ 核心 / 原生 CLI / WASM 导出侧**。不缩减 PRD/T04 三算法范围；不新增错误码或兼容层；不改页面；不改 T01 v1.2 冻结的三份原文件。微信开发者工具、小程序桥接、红米真机仍不在本子交付内。

## 1. 输入与冻结核对

| 项 | 值 | 结论 |
|---|---|---|
| 冻结裁定 | `Resources\报告\T01-P01-冻结裁定-20261020.md` | 存在、可读、覆盖本轮所需三份候选 |
| `contract-v1-candidate.md` | 22338 字节 `1248398A59BB678A149344098F842F03D9832155AA781EE1B719511601820DB7` | **未修改**（与冻结一致） |
| `nutrition-v1-candidate.json` | 19077 字节 `8254AB22DCA9CEEA1E41F575373442781AE7184DE40169041FD02B2E8308D191` | **未修改** |
| `request-result-pair.json` | 30456 字节 `087A890477BB6272C28885E62E87161AA7AC31AA5DBC878437B2D6241B92D40C` | **未修改** |

旧 v1 证据与反馈原样保留、未被覆盖：`Resources\报告\T02-DSH-最小核心链路-证据-v1\`（10 个文件）、`Resources\报告\T02-DSH-最小核心链路-交付反馈-v1.md`。

## 2. 模型

- **P01 指定请求模型**：DeepSeek V4.1 Flash；本单不另指定原生思考档。
- **实际模型/档位**：本会话平台元数据可见的模型标识为 `deepseek-flash`（证据类型：**现场可见**的平台标识）；服务端具体版本号与原生思考档位**无法核实，记为"未知"**。全程未换模、未新增付费推理。
- 本轮**未新增任何安装或下载**，沿用既有 MSVC / zig / Node。

## 3. 本轮改了什么（对应卡的输出要求）

| 卡要求 | 实现 | 实测证据 |
|---|---|---|
| `meals[]` 补 `nutritionReferenceTarget` | 每餐输出该餐参考目标，与 `targets.mealReference[meal]` 同源 | `02` §1、独立校验 D9 |
| 方案预算含契约全部字段与完整性语义 | `budget{}` 由 5 字段补到 **9 字段**（新增 `budgetCents`/`remainingBudgetKnownCents`/`withinBudgetKnownAmounts`/`overageCents`），只用已知金额判"预算内" | `02` §2、独立校验 D12–D17 |
| 跨策略去重、`offeredAs` 合并、`strategyOutcome` 同指一个 `planKey` | 去重后合并 `offeredAs`；三个策略的 `strategyOutcome` 均 `applied=true` 且 `planKey` 相同 | `02` §3、独立校验 E21–E24 |
| 按状态输出 flags；`estimated=true` 保留估算标志 | 新增 `ESTIMATED_DATA` 标志（源于 catalog 的 `nutritionBasis.estimated`），并据此把状态升为 `OkPartial` | `02` §5、独立校验 F25–F26 |
| `planKey` = 规范 JSON 元组数组 SHA-256，`plan:`+小写摘要 | 重写 `BuildPlanKey`：餐次固定顺序、items 按 `offerId` 字节序、同 offer 合数量、排除 strategy/价格/营养/计时 | `04`、独立校验 C |
| `ResourceLimited` 由合法限额真实触发 | 解析 `plannerConfig.limits{maxCandidates,maxNodes}`；预算耗尽 → `ResourceLimited` + `SEARCH_LIMIT_REACHED`，不说成"已证明无解" | `03` §4，`nodesVisited=3` 为真实耗尽 |
| 四类夹具 + 原生/WASM 实跑比较 | 4 请求 + 4 结果夹具；`tools/core/run_v2_cases.mjs` 双端实跑逐字节比较 | `03` §2 |

改动文件（仅这些）：`core\src\planner.cpp`、`core\tests\test_core_main.cpp`（新增用例）、`tools\core\run_v2_cases.mjs`（新）、`tools\core\verify_planday.py`（新，独立校验器）。

## 4. 交付物与哈希

**源码 / 脚本**

| 文件 | 字节 | SHA256 |
|---|---|---|
| `core\src\planner.cpp` | 68276 | `A2B4C05C49C5ACF0F5FDBD41672DBCFFDC2971555A0CE04095B866F60F56AF3B` |
| `core\tests\test_core_main.cpp` | 52246 | `96E394FBB6A0782CE7C309EC2E83E5A2BDED7BFD1930AF394AAA6577B11715CE` |
| `tools\core\run_v2_cases.mjs` | 8148 | `7BD9AE9C927A36AA3C500F4BF68CE15C0AE07601267DE7C0C6542407A8A80FC9` |
| `tools\core\verify_planday.py` | 42501 | `43AE38ABE41910289C59F529E21AA5B7B750EA1705CAF043FDC20730561B800C` |

**二进制（本构建实例；MSVC 产物含时间戳/GUID，不可复现，判同一份代码看源码哈希）**

| 产物 | 字节 | SHA256 |
|---|---|---|
| `mp_cli.exe` | 306176 | `6C054E331B729DD6BC1CF9EBE4A34DE5D675DBC3F594B0AEBD8177CB31C3A3BB` |
| `mp_test_core.exe` | 339968 | `5623212F9E89F265FCB9D146FF3C500A20561E44427CD4BE48C3B2388E0066FC` |
| `mp_test_json.exe` | 323072 | `CEDDDD9277AE387277831DB16B85C0AB71334A721C19AD867CA74B03B7DEE6BD` |
| `mp_test_sha256.exe` | 311296 | `6F066B2ADAB72226BCCDC3C5BA50D71BCC8E730DE9C499F99F669D3C3B5C02CC` |
| `mp_core.wasm`（可复现） | **72881** | `715CD7701B64D8F493A110C348B5F643979536578C7380C29837E05C4F31D52C` |
| `mp_test_core_asan.exe` | 1172992 | `F2321E6DC11129D8E14BC619742826DCB42E68F81C8D2E2ABE39C5ED921D98EC` |

**证据**：`Resources\报告\T02-DSH-接入前定点修正-证据-v2\`（README、01–06、`inputs\` 4 份请求夹具、`results\` 4 份结果夹具）。
**运行原始记录**：`D:\项目\cpp\.toolchain\build\v2\run_report.json`（逐例命令、退出码、stdout/stderr 原文、输入/输出字节数、`nativeSha256`/`wasmSha256`、`nativeEqualsWasm`、状态、问题列表）。

## 5. 验证结果（实际执行）

构建：`powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\core\build_native.ps1` 与 `…build_wasm.ps1`
→ 5 个目标全部 exit=0、**warning 0、error 0**。

| 验证 | 命令 | 结果 |
|---|---|---|
| 单元/集成（原生） | `mp_test_sha256.exe` / `mp_test_json.exe` / `mp_test_core.exe` | `ALL PASS (20)` / `ALL PASS (189)` / **`ALL PASS (38)`** |
| 内存检查 | ASan 版 `mp_test_core_asan.exe` | exit=0，`检查项 38，失败 0`，无 `AddressSanitizer`/`ERROR:` 标记（泄漏检测平台不支持，仍未运行） |
| 四类夹具双端实跑 | `node tools\core\run_v2_cases.mjs` | **4/4 PASS**，原生与 WASM **逐字节相同**；exit=0；退出码与 stdout/stderr 已逐例记录 |
| 独立校验（第二实现） | `python tools\core\verify_planday.py <inputs> <results>` | **`CHECKS=94 FAILED=0`**，exit=0 |
| 注释率复测 | `python tools\core\count_comments.py` | 全部 8481/410 = **4.83%**；C++ 7827/366 = **4.68%** |

四类实跑结论：

```
[PASS] success              status=OkPartial        字节 5255  native==wasm
[PASS] target-unavailable   status=TargetUnavailable 字节 1909  native==wasm（plans=[]）
[PASS] invalid              INVALID_INPUT @ $.plannerConfig.maxItemsPerMeal  字节 208
[PASS] resource-limited     status=ResourceLimited   字节 1768  native==wasm（limitReached=true, nodesVisited=3）
```

独立校验器重算的内容（不是拿输出对输出）：`planKey` 的 SHA-256 元组口径、四餐次/四项营养的合计、预算六项算术、`nutritionDeviationBp` 与 `tier`、`offeredAs` 与 `strategyOutcome` 的互相指认、`ESTIMATED_DATA` 与 catalog `estimated` 的一致性、`diagnostics.code` 取值范围。

**行为变化提示（有意）**：v1 里成功方案是 `Ok`，本轮因模拟数据 `estimated=true` 必须带 `ESTIMATED_DATA`，按契约 §1 状态变为 `OkPartial`。页面不得写死 `Ok`。

## 6. 未运行项

微信开发者工具加载 `.wasm`、WXWebAssembly 实例化、小程序页面/交互/本地存储、红米 K90 Pro Max 真机、真实菜单（T03）、完整规模性能（T07）、内存泄漏检测（平台不支持）、注释率 ≥20%（T04 补齐）—— 均**未运行/未达标**，不能据此宣称 T02 整卡或课程验收通过。

## 7. 未完成 / T04 欠项与下一责任方

| 事项 | 原因 | 下一责任方 |
|---|---|---|
| `comboRules` 非空、`algorithm≠greedy` | 卡明确作为 T04 欠项，本轮保持可见 `INVALID_INPUT`，不新增错误码 | **DSH（T04）** |
| `planKey` 对套餐的推广 | 当前口径仅适用 offer 子集，套餐需先统一 offer 身份 | **DSH（T04）** |
| `Ok` 状态无实测用例 | 模拟数据全部 `estimated=true` 会升为 `OkPartial`；构造 `Ok` 需非估算样例（属 T03 真实菜单或另开样例） | **P01 决定** |
| 注释率 4.68%（<20%） | 卡要求"在 T04 范围补有效注释并按原口径复测"；本轮只复测并如实上报，**未标课程合格** | **DSH（T04）** |
| `PlanDay` 输出结构仍无 T01 冻结配对样例 | 本轮 4 份结果夹具是"实跑记录 + 独立语义校验"，不是冻结期望值 | **P01** 决定是否冻结 |

## 8. 状态

**完成（仅限本卡范围：T02 接入前定点修正）**。

- 卡的 8 项要求全部落地并有实测证据；四类夹具经同一修订候选原生/WASM 实跑逐字节一致；独立校验器 94 项全通过；零 warning；ASan 无堆错误。
- 仍**不**代表 T02 整卡、微信小程序、红米真机或课程验收通过；注释率未达标、`comboRules`/非 greedy 仍为 T04 欠项，均已在 06 与本节列明。

按卡要求：仅在当前 DSH 窗口回复本反馈路径与一句状态；交付后停止，不联系其他岗位、不自行派单。

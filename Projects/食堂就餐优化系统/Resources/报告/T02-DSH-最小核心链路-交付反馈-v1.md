# T02｜DSH｜最小核心链路交付反馈

- **日期**：2026-10-20（Asia/Shanghai）
- **执行提示词版本**：`T02-DSH-最小核心链路-v1`（2026-10-20）
- **反馈文件版本**：v1
- **任务范围与子交付边界**：本反馈只覆盖 **DSH 的 C++17 共享核心 / 原生 CLI / WASM 导出侧**。不含微信开发者工具、小程序页面与桥接、红米真机、真实菜单（T03）、完整三算法（T04）、性能完整规模（T07）、朋友试用（T08）。**本子交付完成不构成 T02 整卡通过**。

## 1. 开工门禁与输入核对（已通过）

- 冻结裁定实读：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T01-P01-冻结裁定-20261020.md`（存在、可读、绑定下表三份文件与哈希）。
- 三份候选**现场复算 SHA256**，与冻结裁定逐一相同：

| 冻结文件 | 字节 | 现场复算 SHA256 | 结论 |
|---|---|---|---|
| `Resources\契约\T01-v1.2-candidate\contract-v1-candidate.md` | 22338 | `1248398A59BB678A149344098F842F03D9832155AA781EE1B719511601820DB7` | 一致 |
| `Resources\契约\T01-v1.2-candidate\nutrition-v1-candidate.json` | 19077 | `8254AB22DCA9CEEA1E41F575373442781AE7184DE40169041FD02B2E8308D191` | 一致 |
| `Resources\契约\T01-v1.2-candidate\request-result-pair.json` | 30456 | `087A890477BB6272C28885E62E87161AA7AC31AA5DBC878437B2D6241B92D40C` | 一致 |

- JSON 均可解析；`p09ReviewStatus=pendingReview` 属原始文档状态，**未改写候选任何字节**，冻结状态按 P01 裁定。
- 其他实读材料：项目 `AGENTS.md`、`Resources\主PRD.md`（v0.2）、`Resources\任务卡\T02-最小真机链路.md`（v0.2）、`Resources\角色卡\DSH-C++算法.md`、`Resources\模板\外部任务交付反馈.md`、凉笙《代码简洁约定》。MEMORY 仅作背景，未修改。

## 2. 模型

- **P01 指定请求模型**：DeepSeek V4.1 Flash（本单唯一指定，不得自行切模或新增付费推理）。原生思考档本单未新指定。
- **实际模型/版本/档位**：本会话平台元数据可见的模型标识为 `deepseek-flash`（证据类型：**现场可见**的平台标识）。服务端具体版本号与原生思考档位**无法核实，记为"未知"**（不以历史自报代替本次证据）。
- 全程未更换模型、未新增付费推理。

## 3. 工具链与构建（真实执行）

| 项 | 实际值 |
|---|---|
| 原生编译器 | MSVC `19.51.36260 for x64`（工具集 14.51.36231，SDK 10.0.26100.0） |
| WASM 编译器 | zig `0.16.0`（内置 clang 21.1.0），`-target wasm32-freestanding -nostdlib` |
| WASM 运行宿主 | Node.js `v24.19.0` x64 |
| 内存检查 | MSVC `/fsanitize=address`（可用），**泄漏检测平台不支持** |
| Shell | Windows PowerShell 5.1.26100.9444（脚本需 `-ExecutionPolicy Bypass`） |

构建命令与结果（完整见 `01-构建记录.md`）：

```powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'tools\core\build_native.ps1'
powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'tools\core\build_wasm.ps1'
```

| 目标 | 退出码 | warning | error |
|---|---|---|---|
| `mp_cli.exe` | 0 | 0 | 0 |
| `mp_test_sha256.exe` | 0 | 0 | 0 |
| `mp_test_json.exe` | 0 | 0 | 0 |
| `mp_test_core.exe` | 0 | 0 | 0 |
| `mp_core.wasm`（zig `-Wall -Wextra`） | 0 | 0 | 0 |

## 4. 交付物（绝对路径 / 版本 / SHA256）

**源码**（DSH 独占范围 `core\include`、`core\src`、`core\cli`、`core\wasm`、`core\tests`、`tools\core`）：

- 核心与接口：`core\include\mp\{api,base,catalog,contract,json,nutrition,sha256}.h`，`core\src\{api,base,catalog,contract,json,nutrition,planner,platform_native,platform_wasm,sha256}.cpp`
- 原生 CLI：`core\cli\main.cpp` → `D:\项目\cpp\.toolchain\build\native\mp_cli.exe`（301568 字节，`B7D96C1DD50620AE9E2DB84839D4A3BB95D9BC14E3739C20360A4FDC78145A34`；MSVC 产物含时间戳/GUID，该哈希是本构建实例标识、不可复现，判同一份代码请以源码 SHA256 为准，见 01 §3.1）
- 测试：`core\tests\{test_core_main,test_json_main,test_sha256_main}.cpp`
- WASM 说明：`core\wasm\README.md`（最小加载/调用说明）
- 构建/校验脚本：`tools\core\{build_native.ps1,build_wasm.ps1,host_wasm.mjs,verify_wasm.mjs,check_heap_growth.mjs,count_comments.py}`

**WASM 二进制**：`D:\项目\cpp\.toolchain\build\wasm\mp_core.wasm`，70370 字节，
SHA256 `1F77D9153EDA9B2A491CCDED8A993AC4CB9C2D2C71447E5CF4453DD863B4B8B5`；
零 import，导出 `memory` + `mp_api_version`/`mp_contract_version`/`mp_alloc`/`mp_free`/`mp_plan`/`mp_nutrition_target`/`mp_validate_menu`。

**模拟输入（SIMULATED，未写入真实菜单/营养目录）**：

- `Resources\报告\T02-DSH-最小核心链路-证据-v1\inputs\menu-simulated.json`（5494 字节，`A1BA0015AE74EC1CF09B6521BF5686FC4E6772EECC606CA8A51C942CE4322BE7`）
- `Resources\报告\T02-DSH-最小核心链路-证据-v1\inputs\plan-request-simulated.json`（7663 字节，`032121F82327A2CE640A87681547C433FBDEB3E8F50B285062B3C367ECF856D6`）

**证据目录**：`Resources\报告\T02-DSH-最小核心链路-证据-v1\`（README 为索引，00–06 见下节）。
**原始输出与比较结果**：`.toolchain\build\wasm\{cases,native-out,wasm-out}\`、`.toolchain\build\wasm\verify_report.json`、`.toolchain\build\comment_ratio.json`、`.toolchain\build\asan\asan_run.log`。
（本机沙箱不允许子进程在 `Projects\` 下写文件，原始输出无法直接落到证据目录，已在 04 给出路径、哈希与一条命令复现口径。）

## 5. 验证结果（实际操作与证据）

| 项 | 结果 | 证据 |
|---|---|---|
| 9 组配对样例（`ComputeNutritionTarget`） | **9/9 PASS**，0 跳过；逐例与冻结期望结果做递归深层相等比较 | `02-九组配对样例逐例结果.md`；`mp_test_core.exe` 输出 |
| PlanDay 状态覆盖 | `PlanResult.status` 8 个取值中 **7 个有实测用例**（`Ok`/`OkPartial`/`NoFeasible`/`NoFeasibleWithinBudget`/`NutritionDataInsufficient`/`LockConflict`/`TargetUnavailable`）；`ResourceLimited` 无用例（需触发 2000 候选限额） | `03 §5`；`mp_test_core.exe` 共 27 项断言 |
| 菜单校验负例 | `catalogHash` 不一致 / 半份与整份不同价 / 报价引用不存在菜品，均返回带 `fieldPath` 的 `INVALID_INPUT` | `mp_test_core.exe` [3b] |
| 成功 `PlanDay` | `status=Ok`，3 餐各 3 项，`priceCents=2550`（预算 5000），`distinctPlanCount=1`（三策略收敛，不复制凑数） | `03-最小核心链路与PlanDay示例.md` |
| 目标不可用 | `status=TargetUnavailable`、`targetStatus=AUTO_TARGET_DISABLED`、`plans=[]`、含 `TARGET_NOT_APPLICABLE` 诊断 | 同上 §4 |
| 契约级输入错误 | `ageYears=200` → `INVALID_INPUT @ $.profile.ageYears`；`contractVersion=2.0` → `UNSUPPORTED_CONTRACT_VERSION`；`maxItemsPerMeal=99` → `INVALID_INPUT` | 同上 §4 |
| `ValidateMenuCatalog` | 模拟菜单 `valid=true`，`computedCatalogHash` 与声明值一致 | 同上 §4 |
| 原生 / WASM 一致性 | **18/18 逐字节相同**（9 组配对 + plan 6 态 + validate-menu + 2 个错误样例），未剥离任何字段 | `04-...md`；`verify_report.json` |
| WASM 所有权/生命周期 | 31 项检查 0 失败：零 import、内存导出、版本接口静态指针、输入/输出各释放一次、重复释放安全、释放后指针在仍有存活块时不分发、错误不越界 trap、200 次分配不增长 | 同上 |
| 内存检查 | ASan 版 27/27 通过、无 `AddressSanitizer` 报错；**泄漏检测平台不支持，未运行** | `05-内存检查与注释率.md` |
| 逐请求内存增长 | `nutrition-target`×50 与 `plan`×50 内存页数呈平台（19 / 46 页），无逐请求增长 | `04 §4`、`heap_growth.json` |
| 注释率 | 全部 4.71%（7913 代码行/373 注释行）；仅 C++ 4.54%（7416/337）。**未达课程 20%**，未用行尾注释凑数 | `05 §3` |

## 6. 明确未运行项

微信开发者工具、WXWebAssembly 实例化、小程序页面/桥接/本地存储、红米 K90 Pro Max 真机、真实菜单与真实营养数据、完整三算法（DP/分支限界）、性能完整规模测量、内存泄漏检测（平台不支持）、朋友试用 —— **均未运行**，本子交付不能据此宣称 T02 整卡通过。详见 `06-未运行项与边界裁定请求.md` §1。

## 7. 未完成 / 阻塞事项与下一责任方

| 事项 | 原因 | 恢复条件 | 下一责任方 |
|---|---|---|---|
| `catalog.comboRules` 非空、`algorithm≠greedy` 无契约状态 | T01 未定义"未实现"表达；本实现返回可见 `INVALID_INPUT`，不伪造成功、不自造错误码 | P01 裁定状态或限定取值 | **P01** |
| 手动目标缺宏量时无派生规则 | 冻结配置 `derivedFieldsAllowed=true` 但无任何派生规则文本，不自行发明 | P01 给出规则或确认不派生 | **P01** |
| `PlanDay` 输出结构无冻结配对样例 | T01 只有 `ComputeNutritionTarget` 的 9 组样例 | P01 确认字段或补夹具 | **P01** → 反重力接入前 |
| 注释率 4.54% < 20% | 大文件（planner/nutrition/catalog）缺逐步骤注释；算法尚未定型，现在补会被 T04 改动冲掉 | T04 算法定型后统一补齐，T09 用同一脚本复测 | **DSH（T04）** |
| 单次 `plan` 内存高水位 ≈2.9 MiB | 零 import 目标下自写 bump 分配器 + Arena 未做块复用 | T07 性能阶段优化 | **DSH（T07）** |

**与执行提示词的偏离（须 P01 知情）**：本机经穷尽搜索确认无 C++→WASM 前端，经用户在本会话明确授权"缺什么环境可以自己安"后安装 zig 0.16.0 到 `D:\项目\cpp\.toolchain\py-zig`；这与提示词 §5.2"不安装新工具/不联网下载"冲突。安装前的不存在证据在 `00-工具链勘察.md`。**若 P01 不接受该偏离，WASM 侧全部结论应按"未构建/未运行"处理**，原生部分不受影响。

## 8. 状态

**阶段交付**（仅覆盖 DSH C++ / CLI / WASM 子交付）。

- 已完成并自验：手写 C++17 贪心基线与营养目标唯一实现 → 原生 CLI 与零 import WASM 同源同结果（18/18 逐字节一致）、9/9 配对样例、7/8 PlanDay 状态实测、所有权与错误边界、ASan 无错误、零 warning。
- 未达成/待裁定：`comboRules` 与非 greedy 算法未实现（需 P01 定状态表达）、注释率 4.54% 未达 20%、`PlanDay` 输出结构未获冻结样例确认、`ResourceLimited` 无用例。
- 因此**不标"完成"**，也不代表 T02 整卡、微信小程序、红米真机或课程验收通过。

按 P01 安排等候下一任务；未联系 P01/P02/反重力或其他聊天，未改契约、未更新 MEMORY/TodoKit、不轮询、不自行续派。

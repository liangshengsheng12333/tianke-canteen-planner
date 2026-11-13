# T08M03｜ZCode GLM5.3｜交付材料核对｜交付反馈 v1

| 项 | 内容 |
|---|---|
| 主任务卡 | `Resources/任务卡/T08M-ZCode-最终验证三子代理总转交卡-v1.md` + `Resources/任务卡/T08M03-ZCode-交付材料核对小卡-v1.md` |
| 定位 | 交付运行材料（运行索引+独立副本实际构建运行）、A09 注释率/零 warning/内存检查、A01—A12 当前证据映射；只验不修 |
| 请求模型 / 实际 | 请求 ZCode GLM 5.3；本会话客户端标识 `account:zai-start-plan/GLM-5.3-Flash`；服务端路由/档位**未知** |
| 候选 | `sha256:97c8085ce2817c339455a21be53ed01308c1d570ff3781511bddc39c39b13123`（唯一来源：`Resources/报告/T06e-ZCode-最终核心汇合-交付反馈-v2.md` 及其证据目录） |
| 证据目录 | `Resources/报告/T08M03-ZCode-交付材料核对-证据-v1/`（identity/ copy/ build-native-m03 在 copy 内/ runs/ a09/ 两份索引映射 md） |
| 状态 | **部分完成（本路三条任务完成；发现 2 项待裁定/缺项 + 3 项全局未完成如实保留）；不构成最终验收，正式性能/红米/A11/P09 未完成** |

---

## 1. 固定身份核对结果（开工现场实算，全部一致，无漂移）

| 项 | 固定值 | 现场实算 |
|---|---|---|
| manifest 摘要 | `sha256:97c8085c…39b13123`，75 源/1,008,941 B，45 工具/649,308 B | ✅ 生产重算 + 独立副本自算两次一致（`identity/manifest-prod.json/`、`identity/manifest-copy-{pre,postrun}/`） |
| frozenWasmMatches | true | ✅ |
| WASM | 111,521 B / `8A817926…F3A4AD8` | ✅（生产与副本各自实算） |
| planner.cpp | 225,445 B / `109555B9…5ECE69` | ✅（生产与副本；运行前后哈希不变） |
| T06e 证据内 native | 382,464 B / `c86461c7…` | ✅（仅核对，未复用其运行结果） |

独立副本：`copy/` 由 T06e candidate 全树复制 182 文件，与源 **逐文件 SHA256 逐字节一致**（清单与哈希双 diff 0 差异），构建与运行均发生在副本内；运行后副本 core/tools 与源 candidate `diff -r` 仍 0 差异。非"只换输出目录读生产源码"的伪副本。

**执行事故（如实报告）**：一次构建的 `-OutDir` 参数因 shell 引号展开失误，把首次 mp_cli 构建产物写到了本路证据目录之外的散落目录 `D:\项目\cpp\Projects\食堂就餐优化系统$E\`（本路刚误建的新目录，未触碰任何既有文件）；已将产物并入 `copy/build-native-m03/` 并删除空壳目录。其余写入均在边界内。

## 2. 实际操作命令（均在本路证据目录内）

- `node tools/miniprogram/candidate-manifest.mjs --out <本路目录>`（生产+副本各跑，运行前后共 3 次）。
- `powershell.exe -NoProfile -ExecutionPolicy Bypass -File <copy>/tools/core/build_native.ps1 -OutDir <本路>\copy\build-native-m03 -Only {mp_cli|mp_test_sha256|mp_test_json|mp_test_core}`（4 次独立进程，各 ≤25s）。
- 副本 `mp_test_*.exe` 三个单测、`mp_cli.exe` plan×3 算法 / nutrition-target / validate-menu / 1ms plan（每进程 25s 上限，全部在限内完成）。
- `node <copy>/tools/miniprogram/count-comments.mjs`（TS 注释率，仓库脚本原样）。
- 本路自写脚本（只落本路证据目录）：`a09/count-comments-core.mjs`、`a09/count-comments-v12.mjs`（严格有效注释口径）、`a09/m03-heap-check.mjs`（复用 `tools/core/check_heap_growth.mjs` 方法）、`a09/m03-asan-build.ps1`（/fsanitize=address 重建）。
- `diff -r` / `sha256sum` 副本一致性核对。

## 3. 原始结果与断言

### 3.1 任务① 运行索引（另写，不覆盖旧 T10a）

`T08M03-当前候选运行与证据入口索引-v1.md`（证据目录内）：小程序/当前 native CLI 真实入口、构建命令与前提、离线准备、版本哈希、菜单/契约（contractVersion 1.0；`west1-…-20261024` 6 窗/91 菜/62 offer，validate-menu 实测 catalogHash 自洽）、失败排查（7 项，含本轮实际踩到的 .bat 中文路径乱码、ASan DLL、MSVC ASan 不支持泄漏检测）。

### 3.2 独立副本实际运行

| 运行 | 结果 |
|---|---|
| 构建 mp_cli/mp_test_sha256/mp_test_json/mp_test_core | **4/4 exit=0，自有代码 0 warning，0 error**（逐目标日志 `copy/build-native-m03/build_*.log`） |
| 单元测试 | sha256 20/20、json 189/189、core 43 检查 0 失败（`runs/test_*.out`） |
| plan 三算法（六窗全量请求） | greedy/dp/bnb 均 `ok=true status=OkPartial`、3/3 餐 planned（`runs/m03-rep-*.resp.json`） |
| nutrition-target | `Ok`、eligible、日目标 2370 kcal |
| 1ms 时限（greedy） | `ResourceLimited`（A18 真实触限语义在副本重建产物上复现） |
| 工具不可用捕获 | 本机无 Dr.Memory/Valgrind；MSVC ASan 明确不支持 `detect_leaks`（实测报文存 `a09/asan-nt.stdout.log`）；ASan 重建 11 条 C5072 均为"ASan 无调试信息"提示性告警、非源码告警 |

### 3.3 任务② A09（落盘：`a09/A09-注释率与内存检查核对-v1.md` + 四张原始计数表）

- 口径依据：冻结 T01 v1.2 §12。双口径并列（口径 A=仓库脚本整行注释；口径 B=剔除纯分隔填充的有效注释，对齐 `tools/core/count_comments.py` 规则）。
- **C++ `core/`：口径 A 25.3%（2704/10706）、口径 B 24.1%（2585/10706）✅**
- **TS `miniprogram/src/`：口径 A 21.2%（2238/10557）✅；口径 B 16.3%（1718/10557）❌（<20%，见 §4 问题 P-1）**
- **合计：口径 A 23.2%、口径 B 20.2% ✅**（原始计数与排除表全部落盘，脚本可重跑）
- 三算法手写源/复杂度/优化说明定位：planner.cpp :1536（贪心）、:1911（DP 支配定理与离散化近似语义）、:2428（BnB 乐观界与剪枝安全性定理）+ 三个 Run*Algorithm 入口行号，见 A09 文档 §4。
- 内存检查：WASM 单实例 ×50 nutrition-target 页数恒 18、×50 plan(greedy) 恒 42（`a09/heap-growth-m03.json`）；ASan 三代表请求退出 0 无堆错误；**覆盖与局限如实注明：WASM 页数平稳不能证明 native 无泄漏，native 泄漏检查在本机无可用工具（缺项，最小补齐建议见 §4 P-2）**。

### 3.4 任务③ A01—A12 证据映射（落盘：`A01-A12-证据映射-v1.md`）

一张表覆盖 A01—A12，每项标来源/候选/操作范围/状态（✅当前候选证据/🟡旧候选可沿用事实/🔴未完成）。要点：
- 当前候选有直接证据的：A02 数据与核心层、A03 Node/核心层、A05 部分核心层（等 M01）、A06 Node 层一致性、A08 Node 层、A09 大部（含 2 项待裁定）。
- 旧候选事实仅标 🟡 可沿用（T08J01/02 模拟器链路=2871、T07a Oracle=d15bbe0e、红米 T08a1/T08a3=更旧候选），未拼接成总审通过。
- **A10（正式性能/红米）、A11（真实朋友试用）、P09 总审、A04 营养独立核对、A06 当前候选真机最小链路：🔴 未完成，如实保留。**
- A12：复用 T10a 素材顺序（真实问题→菜单→四流程→算法→一致性→工程→如实收尾），并列出 7 条"素材与当前功能不符处"（菜单规模 35→6 窗 91 菜、候选哈希过时、WASM 新 ABI、营养未知比例、旧性能数字不可用、BnB 347MiB 表述过时、旧 UI 截图），供用户以后自行更新 PPT；本路未改 PPT/演讲稿，未生成发布包。

## 4. 发现的问题（只报不修）与最小补齐建议

| # | 问题 | 证据 |
|---|---|---|
| P-1 | **TS 注释率在"严格有效注释"口径下 16.3%<20%**（TS 单侧；合计口径 B 20.2% 仍达标）。分歧点在 JSDoc 块的孤立标记行（`/**`、`*`、`*/`）与纯分隔线是否计入分子；仓库 TS 脚本 `count-comments.mjs` 计入（21.2%），`tools/core/count_comments.py` 规则不计入。**建议**：P09/用户明确"有效注释行"口径；若维持严格口径，TS 需在新候选补注释（约 390 行整行有效注释），本路未补 | `a09/ts-comment-table.md` vs `a09/ts-comment-table-v12.md`、排除清单 `a09/ts-comment-excluded-sample.md` |
| P-2 | **native（mp_cli）内存泄漏检查工具缺项**：MSVC ASan 不支持 detect_leaks（平台实测），本机无 Dr.Memory/Valgrind。WASM 页数平稳（本路实测）不能证明原生无泄漏。**建议**：正式验证引入 Windows Dr.Memory 或对 mp_cli 启用 UCRT 调试堆（`_CrtSetDbgFlag/_CrtDumpMemoryLeaks`）跑代表请求集，或 WSL Valgrind；属新测量任务，不在本路 | `a09/asan-nt.stdout.log`、`a09/A09-…-v1.md` §5 |
| P-3 | A01 完整用户可见链路（换菜→确认/改撤/补记→仅重算未吃）在**当前候选**上只有 Node 回归+建档/生成冒烟；模拟器完整链路证据停留在 2871 候选。M02 路并行核查中，本路不判 | `A01-A12-证据映射-v1.md` A01 行 |
| P-4 | A04 当前 62 offer 的数据映射与 estimated 标记的独立核对未做；A06 当前 WASM 真机最小链路未测；A10/A11/P09 未完成 | 同上映射表对应行 |

## 5. 未测项 / 边界（不伪报）

- 正式性能测量（A10 PC 基准与红米矩阵）：未跑（本路禁止，25s 上限仅诊断）。
- 红米真机、其他基础库：未测；本路全部为 Windows Node/MSVC/副本 native 证据。
- 微信模拟器 GUI：未操作（M02 专用）。
- offer-nutrition 命令：本轮代表请求未覆盖（四命令之一，工具入口已在索引登记；非本小卡必测项）。
- DP/BnB 的 1ms 触限仅验证了 greedy；M01 路负责算法终验。
- PPT/演讲稿未改；未生成最终发布包；未写 MEMORY（不在本路写入边界）。

## 6. 交付物清单（`T08M03-ZCode-交付材料核对-证据-v1/`）

| 项 | 路径 |
|---|---|
| 任务① 运行索引 | `T08M03-当前候选运行与证据入口索引-v1.md` |
| 任务③ A01—A12 映射 | `A01-A12-证据映射-v1.md` |
| 任务② A09 核对 | `a09/A09-注释率与内存检查核对-v1.md` + `a09/{cpp,ts}-comment-table*.md`、`a09/ts-comment-excluded-sample.md`、计数脚本 `a09/count-comments-*.mjs` |
| 独立副本+构建 | `copy/`（182 文件，逐字节一致）、`copy/build-native-m03/`（4 目标 0 warning + 日志） |
| 运行原始记录 | `runs/`（3 单测输出、7 组 req/resp、1ms）、`identity/`（manifest×3 + planner 哈希） |
| 内存检查 | `a09/heap-growth-m03.json`、`a09/asan-obj/`（ASan exe+日志）、`a09/asan-*.stdout.log` |

完成后停写。生产、历史报告、其他路副本零改动；旧 T10a 材料未覆盖。

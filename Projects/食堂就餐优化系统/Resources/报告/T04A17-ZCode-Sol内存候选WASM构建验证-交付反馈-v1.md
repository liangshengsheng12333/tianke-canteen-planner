# T04A17｜ZCode｜Sol内存候选WASM构建验证交付反馈 v1

**阶段交付：本卡 memory-only 源的新 native（4 目标）与新 WASM 32 位均已实际生成并通过全部对拍；BnB 新 WASM 线性内存 1000→200000 节点恒定 2490368 B（38 页），旧批准基线同点为 363986944 B（T06d 记录）。未合生产，非空墙钟缺口仍开放（A18 解决）。**

执行日期 2026-10-25。cwd `D:\项目\cpp\Projects\食堂就餐优化系统`（构建/验证命令均在此或以绝对路径执行）。P01 请求模型 **GLM5.3**；实际客户端身份 **GLM-5.3-Flash**（ZCode 子代理）；服务端实际路由/档位/额度无独立证明，**记未知**，不把请求配置当作实际证明。

## 1. 范围与输入身份（开工实算，非转录）

证据根：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T04A17-ZCode-内存候选构建验证-证据-v1\`（本卡唯一写入目录；另写唯一反馈即本文件）。未改 T06d candidate、A16/A15/A18 证据、生产树、MEMORY、共享契约、ACL；未清缓存。

| 输入 | 实算结果 | 结论 |
|---|---|---|
| T06d candidate manifest（`candidate/tools/miniprogram/candidate-manifest.mjs` 重跑） | sourceTreeDigest **sha256:2871b4cad6cf801eeb27291c9eb291b3227d0adcf4c6a3270d40e9e34b3441a1**，75源/1004620 B，45工具/649145 B，frozenWasmMatches=true | 与卡一致 |
| core 镜像（复制 T06d candidate/core 至本卡 `core/`） | `diff -r` 逐字节一致（补丁前） | 镜像成立 |
| `patches/memory-lifetime.patch` 副本（`patches-image/`） | **12841 B / sha256 62829b23d484071e00b0b4f96a26e4d853871f5084c2ac0e8e02afbafa15f41e** | 与卡一致，已用 |
| combined.patch / wallclock-reject-policy.patch | 存在于 A16 目录但**本卡全程未使用** | 禁用项合规 |

**源身份链（含关键发现）**：planner.cpp 补丁前 217345 B / `c90e986784d01151f16c314450e3351f6c450378464858c91ec1a515bb25f9a9`；`git -c core.autocrlf=false apply` 应用 memory-lifetime.patch 后 **219886 B / 98790029baf43c680b1b04201485252363ffc89f037cd63a38552c863c55351e**（本卡 memory-only 源）。**发现**：A16 反馈虽称"仅 planner.cpp 变化"，但其 candidate/core planner.cpp（220036 B / 578c09df…）实测含 `INVALID_INPUT … wallClockMs` 守卫——本卡在系统临时目录验证 memory-only + wallclock-reject-policy.patch 逐字节复现 578c09df/220036 B，证明 A16 candidate/core 同时含两补丁，其"仅内存改动"表述应以合并补丁理解。本卡构建源为**纯 memory-only**，源清单 `source-manifest.json`（24 文件/652425 B，逐文件 sha256）。

## 2. 构建（A16 被阻断项本卡闭合）

自写脚本 `build/build-all.ps1`（ASCII-only；仅参考 A15 build-all.ps1 的参数/工具链用法，按本卡 core 源码重新生成，未运行 A15/A16 旧脚本）。工具链复用 P01 批准的 A15 已证实路径：`D:\项目\cpp\.toolchain\py-zig`、`zig-cache`、`zig-cache-local`、`build\wasm`（A16 失败源于在其证据目录内建缓存，本卡未走该路径）。

- native：vcvars64 + `cl /nologo /std:c++17 /W4 /EHsc /permissive- /utf-8 /Zc:__cplusplus /MP`，4 目标全部 **exit=0 warnings=0 errors=0**（日志 `build/logs/build_*.log`）。
- WASM：`python -m ziglang c++ -target wasm32-freestanding -nostdlib -Os -fno-exceptions -fno-rtti -Wall -Wextra -Wno-unused-parameter -std=c++17 -I core/include -Wl,--no-entry -Wl,--gc-sections`（zig 0.16.0 / cl 19.51.36260 x64 / Python 3.12.10，见 `build/logs/compiler-versions.log`）。stage 独占名 `D:\项目\cpp\.toolchain\build\wasm\t04a17_memory_candidate.wasm`，未触既有 mp_core.wasm 或 A15/A18 stage；exit=0，与 `build/wasm/mp_core.wasm` `cmp` 一致（日志 `build/logs/build_wasm.log`）。

| 新产物 | 大小 | SHA256 |
|---|---:|---|
| `build/wasm/mp_core.wasm`（新 WASM 32 位） | 109086 B | **14abef2e1f5107d32b8be0613cbc543af2998cd41cbf529c608dd36c5570815d** |
| `build/native/mp_cli.exe` | 374784 B | c558b5470c7ea57c3a11255e7ea9b78b81d91d967e6197f02dbe4902bab3abab |
| `build/native/mp_test_sha256.exe` | 379904 B | 57c2c2eb585e5058e616a8e318c1d090c30b89fc2b7973384de37c0c360ad1c6 |
| `build/native/mp_test_json.exe` | 392192 B | 305a25b5ee0221f2126e5cd006c67d5287725dd38e684cc8496c18f8909cfede |
| `build/native/mp_test_core.exe` | 419328 B | 84cb95daa2882d1bb5de2c27884a0d0d4153e99e65c5aa5a5857d6b96f932208 |

新 WASM 魔数/版本校验通过，`WebAssembly.Module.imports` = **[]**，无新增 ABI 导入。对照基线 WASM 107936 B / 304FED66…（A16 记录沿用），体积差 +1150 B 为补丁代码增量。

## 3. 单元测试与对拍（全部精确指向本卡新产物）

native 单元测试：sha256 **20**、JSON **189**、core **43**，共 252 项全过。主验证 `verify_t04a17.py`：**211 项断言、137 次 planKey 复算全过**（`verification.json`）；共 76 个核心请求，全部独立进程、25 秒硬超时、串行执行，**0 超时**（逐请求记录在 `runs/`、请求/响应在 `raw_io/`）。requestId 前缀 `a17-`，逐字节比较时排除。

- **节点递增新 native/新 WASM 对拍**：1000/10000/50000/200000 四档，逐字节（除 requestId）一致；先小量确认内存趋势（见 §4）再跑 200000。
- **六窗口基准**（复用 T06d bench 请求，`base.req.json` 与 T06d/A16 请求逐字节一致）：greedy/dp/BnB 三策略、候选 46/186/186、planKey/评分/策略归并/近似字段与 **T06d 批准 WASM 存证**逐字段一致（除 requestId）；BnB 200000 为 nodesEvaluated=200000、capsHit observed=200001、OkPartial、SEARCH_LIMIT_REACHED，节点数/评分/K 均未改。
- **复用 A16 聚焦用例（指向本卡新 native+新 WASM，各跑一遍并互比）**：T04A11 legacy 5 例（4097 字节规范元组的长 planKey、已吃超预算、更优预算保留、f6 恢复、两餐已吃未知支出）×dp/BnB；T04A14 contract 4 例（预算600、午餐窗口锁、菜品锁、川湘首项售罄）×dp/BnB（maxSearchNodes=10000）；全部逐字节一致。
- **独立 2×2×2 极小穷举**（Python 自行枚举 8 组合、自行计算偏差/tier/预算优先/多样性/planKey，不读引擎实现）：无预算/1600/1400 ×dp/BnB 完全命中独立最优，greedy 断言合法枚举成员；单餐池 2/2/2。
- **极小 BnB 预算**：节点 1/2 返回 ResourceLimited 空方案；节点 3 保留完整当选并标 SEARCH_LIMIT_REACHED。
- 137 次 planKey 复算（对 `raw_io` 全部响应）全过；锁/售罄/长键未被复用缓冲污染。

## 4. 资源实测（新 WASM；native 数不当 WASM 数）

| 项 | 新 WASM 实测 | 对照 |
|---|---|---|
| BnB 节点 1000/10000/50000/200000 | 线性内存恒 **2490368 B / 38 页**，无页增长 | 批准基线 WASM 200000 为 363986944 B（约 5552 页，T06d 记录沿用，未重跑） |
| greedy 六窗（同进程 6 调用） | 恒 2752512 B / 42 页；冷 9.78 ms，热 2.73–3.53 ms | — |
| DP32 六窗（同进程 6 调用） | 恒 10354688 B / 158 页；冷 519.7 ms，热 407.3–431.0 ms；statesEvaluated 11950、近似标记不变 | — |
| BnB 200000，5 组独立进程"预热1＋正式1" | 每次调用均 2490368 B / 38 页；预热 868.8/866.8/863.8/879.5/862.2 ms，正式 **863.6/862.3/851.2/871.6/858.3 ms** | — |

WASM 线性内存只增不减，故结束值即峰值；BnB 全程无任何页增长，A16 的 native 生命周期结论在 32 位 WASM 上成立。native 峰值工作集（ctypes GetProcessMemoryInfo 外部轮询，**native 进程指标，不是 WASM 页/内存数**）：1000/10000/50000/200000 = 6254592/5873664/5873664/5869568 B。**本卡未构建 mp_bench/api-trace，无 native Arena 数**（A16 已证该补丁 Arena 恒定，且其数不充当 WASM 数）。

计时条件如实记录：**非独占机器**——按主窗口告知本机另有 T08L 小修代理执行轻量 Node 检查；本卡各请求独立进程、卡内串行，计时仅诊断量级，不作真机性能结论，不与 50ms 阈值混比。A16 曾因六次 BnB 同进程累计超时改用对子，本卡直接沿用"预热1＋正式1"多组方案，无超时发生。

## 5. wallClock 缺口（如实记，不代替 A18）

本卡源不含 wallclock-reject-policy（禁用项）。非空 wallClockMs 行为沿用 2871 生产语义：本卡对新 WASM 做了一次**行为记录（非验证断言）**——wallClockMs=1000 的 DP 请求 ok=true 完整返回、无任何真实时限生效（`runs/wallclock_nonnull_behavior_record.json`）。**"非空墙钟被接受但不限时"的需求缺口未闭合**，由 A18 真时限任务解决；本卡未采纳拒绝政策，未改契约/ABI。

## 6. 结论与边界

- **新 WASM 32 位已实际生成本卡 memory-only 源**（非旧 WASM 充数），A16 阶段"新 WASM 未产出"的阻塞在本卡闭合；正确性、节点预算语义、候选覆盖、planKey、锁/售罄/预算/已吃/未知支出行为全部保持。
- 未测/边界：native Arena 未测（无探针）；DP 仅覆盖六窗 DP32 与 oracle DP20000，未跑更大 DP 规模；不推广生产、不做真机结论；未跑 200000 节点批准基线 WASM（沿用 T06d 存证，避免多进程大内存重放）。
- 待 P01 将 memory-only 候选与 A18 真时限候选统一审查后才合生产；本卡不自行宣布通过合入。

主要文件：`source-manifest.json`、`build/build-all.ps1`、`build/logs/`、`build/wasm/mp_core.wasm`、`build/native/`、`run.py`、`worker.mjs`、`verify_t04a17.py`、`verification.json`、`runs/`、`raw_io/`、`patches-image/memory-lifetime.patch`（均在本卡证据根下）。

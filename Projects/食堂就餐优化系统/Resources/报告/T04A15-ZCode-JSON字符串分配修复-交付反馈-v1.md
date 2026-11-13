# T04A15｜ZCode｜JSON 字符串分配定向修复｜交付反馈 v1

状态：**完成**（隔离候选 + 新 native/WASM 产物 + 全部指定验证闭环；0 阻塞）。
日期：2026-10-25。唯一 C++ 写入者：T04A15 主执行代理（本会话）。

## 1. 基线与输入身份

- 项目根：`D:\项目\cpp\Projects\食堂就餐优化系统`。开工时以 `tools\miniprogram\candidate-manifest.mjs` 现场重算：`sha256:7f6a6ea5071626afeb817592f5ad10f105481a2fbefdfee0b8c4b98626aeba42`（miniprogram/src 75 文件 996165 B、tools/miniprogram 45 文件 649001 B、冻结 WASM 匹配）＝ U09。收工时复算仍为 U09，**生产未改**。
- 生产 `core/src/json.cpp`：SHA256 `683a472f8821d758051b475d59952e5bdd0e676ffad944e402318171e7bb2105`（40688 B），与 A14 `identity.json` 一致，非仅同名推定。
- 冻结旧 WASM：107472 B，SHA256 `B53C7405A643E8409071ED76D3CB4CCBDF1A37E6E5C408CE1D4A373D4CC00744`，manifest 校验 matches=true；全程未被替换。
- git 情况：项目根不是 git 仓库；`miniprogram/.git` 存在但**无任何提交**（空仓库），与 H01/H02 发现的"git 基线不可用"一致。身份核验全部以 manifest（U09）为准，不依赖 git。

## 2. 接续此前中断进度的核实与取舍

证据目录 `Resources\报告\T04A15-ZCode-解析器内存修复-证据-v1\candidate\` 此前一次被中断的运行已留下 `candidate\core\`（仅 cli/include/src/tests/wasm 镜像，无 build 产物、无证据）。开工核验结论：

- `candidate\core` 与生产 `core` 逐文件 diff：**唯一差异是 `core/src/json.cpp`**，其余文件字节一致；生产 json.cpp 哈希与 A14 identity 吻合 ⇒ 该镜像确来自 U09 版生产 core，身份相符，**续用，不重建**。
- 遗留 json.cpp 修改（SHA256 `3c2ba4cab47599c6e00b40c089a8014fe6e62594cc5a2d8a05902088b8bb44a2`）为主执行者逐行审查：两遍扫描实现（第一遍 ScanString 完成全部转义/\u/代理对/控制字符校验并求出精确解码字节数，第二遍只按 `decodedBytes+1` 分配解码）。错误定位逐点核对与旧实现等价（详见 §6）；Parser 类定义在 json.cpp 内部，无 ABI/头文件变化。**确认正确后沿用**。
- 本轮实际新增完成：parser 回归测试、分配量测量入口、隔离构建（native 新/旧 + WASM 新）、四端对拍、错误路径一致性、线性内存对照、本反馈。上次运行未做其中任何一项。

## 3. 候选源码与差异

- 候选根：`...\T04A15-ZCode-解析器内存修复-证据-v1\candidate\`
- 唯一改动文件：`candidate\core\src\json.cpp`（SHA256 `3c2ba4ca…b8bb44a2`）。unified diff：`candidate\t04a15-json.cpp.patch`（309 行，仅此一个文件）。
- 新增候选内文件（非生产）：`candidate\core\tests\test_json_string_main.cpp`（76 项断言回归）、`candidate\core\tests\measure_string_alloc_main.cpp`（分配量测量入口，仅 native）。
- 候选源码全清单：`candidate\runs\candidate-core-hashes.txt`（26 文件）。

## 4. 隔离构建产物、命令与工具链

构建脚本：`candidate\build\build-all.ps1`（ASCII-only，路径由 `$PSScriptRoot` 推导；MSVC 参数与 `tools\core\build_native.ps1` 相同：`/std:c++17 /W4 /EHsc /permissive- /utf-8 /Zc:__cplusplus /MP`；Zig 参数与 `tools\core\build_wasm.ps1` 相同：`-target wasm32-freestanding -nostdlib -Os -fno-exceptions -fno-rtti -Wall -Wextra -std=c++17 -Wl,--no-entry -Wl,--gc-sections`）。编译器：MSVC 19.51.36260 for x64；zig 0.16.0（python -m ziglang）；Python 3.12.10（`candidate\build\logs\compiler-versions.log`）。全部目标 exit=0，唯一警告为测量入口 `_wfopen` 弃用提示（C4996，不影响）。

| 产物 | 路径（相对证据目录） | 大小 | SHA256 |
|---|---|---|---|
| 候选 native CLI | `candidate\build\native\mp_cli.exe` | 373248 B | `a08193f580393d9d8693c974259fe7f29633e8a753611f3e39fc63b803604606` |
| 候选字符串回归 | `candidate\build\native\mp_test_json_string.exe` | — | `aff85c4f0693a3ab9d91e9216658ec02852de1672da0a0853475d37983d9cce7` |
| 候选分配测量 | `candidate\build\native\measure_alloc_new.exe` | — | `1453cb64e35a2e15a16bfb2675a8fc02a0c0c6b181afd0f2df5c076704c39e9e` |
| 旧版对照 CLI（生产源码只读编译） | `candidate\build\native-old\mp_cli_old.exe` | 372224 B | `919a73e0202138cac27dae82ee8faf28cc4bf859aecd965d63cc21809a8be204` |
| 旧版对照测量 | `candidate\build\native-old\measure_alloc_old.exe` | — | `1f2cd9132543a7caa799ff297d56f367c7f0598114781f30123a66e005f3aeea` |
| **候选 WASM** | `candidate\build\wasm\mp_core.wasm` | 107936 B | `304fed667624ea93b4a77314cfcc74d09ac57b2a2f3a1d6a4ebf8ce79da370e8` |

日志：`candidate\build\logs\build_*.log`、`build_summary.json`。构建命令全文见 `build-all.ps1`（cl 逐目标命令、zig 参数列表均可复现）。

偏差与原因（如实记录）：
1. zig/wasm-ld 无法在证据目录树内创建输出文件（`cannot open output file … Permission denied`，cl 同目录可写，属工具级差异，未改 ACL）。改用**项目脚本自用的既有 stage 目录** `D:\项目\cpp\.toolchain\build\wasm` 中转（与 build_wasm.ps1 相同流程），stage 文件名为独立的 `t04a15_candidate_stage.wasm`，**未触碰该目录已有 mp_core.wasm**，产物随后复制入候选目录。未在项目外新建暂存目录。
2. `.ps1` 以 ASCII-only 编写（PowerShell 5.1 按 ANSI 读脚本，中文路径字面量会损坏——首次运行已实际踩到并修正为路径推导）。

## 5. 指定模型与审查

- 指定平台/模型：ZCode / GLM 5.3。客户端模型标识：GLM-5.3-Flash（会话配置 `account:zai-start-plan/GLM-5.3-Flash`）。Harness/档位：客户端未展示可核实的档位信息；**实际服务端模型与档位无法独立核实，记为未知**。未把请求模型当作实际调用的证明。
- 独立只读审查代理：**未做**（本会话未安排独立只读审查者）。转义/越界/错误路径由主执行者自查＋机器对拍覆盖（§6/§7），不得计为"双人通过"。

## 6. Parser 回归（候选 native）

`candidate\build\native\mp_test_json_string.exe`：**76 项断言全部通过（ALL PASS）**。覆盖与结果：

- 合法：空串、ASCII、原生中文、转义引号/反斜线/斜杠、`\b\f\n\r\t`、`\uXXXX`（ASCII/中文/大写十六进制/`FFFF`）、代理对（小写/大写十六进制）、键位置转义键、数组内重复字符串、100000 字符长串内容完整性。
- 非法（不吞错、不假成功，均明确失败且定位与旧实现逐字节一致）：截断字符串/尾随反斜杠（byte 0）、非法转义（byte 5）、`\u` 截断（byte 3）、非法 hex（byte 3）、孤立高/低代理（byte 7）、高代理无低代理（byte 13）、裸控制字符（byte 2）、非法 UTF-8 字节与 UTF-8 编码的代理项（byte 0）、重复键（byte 7）。
- 分配行为断言：单短串文档 Arena 用量 102 B；1 字符串 + 300 KB 空白尾文档解析仅用 **266 B**（旧实现仅该字符串预留即 ≈300 KB）。

既有套件回归：候选 `mp_test_json.exe` 与旧源 `mp_test_json_old.exe` 在项目根运行均 **ALL PASS（189 checks）**，日志 `candidate\runs\mp_test_json_new.log`、`mp_test_json_old.log`。

## 7. A14 原始输入四端对拍（每请求独立进程，硬超时 25 s）

输入：A14 `raw_io\compact_states32.req.json`（紧凑 98312 B）、`states32.req.json`（pretty 136559 B）、`compact_three_greedy.req.json`。后端：候选 native、旧源 native、候选 WASM（worker 重复 3 次）、冻结 WASM（只读调用，作旧 WASM 参考）。驱动：`candidate\build\run-compare.py`；原始响应：`candidate\runs\*.resp.json`；汇总：`candidate\runs\compare-summary.json`。

结果（3 用例 × 5 项检查全部通过，`ALL COMPARISONS PASS`）：

- 候选 native 与旧源 native 响应**字节全等**（去尾白口径）；
- 候选 native 与候选 WASM 响应**字节全等**；
- 候选 WASM 与冻结 WASM 语义全等（JSON deep-equal）；
- 候选 native 与 A14 原始正常响应**语义与字节全等**（A14 参考文件带一个结尾 `\n`，口径为去尾白后比较）。
- 无失败响应被丢弃后计通过；无超时发生（所有运行均在 25 s 内完成，含被测的 frozen WASM 最慢一次 coreMs≈2678 ms）。

worker：`candidate\build\t04a15-wasm-worker.mjs`（A14 `wasm-worker.mjs` 的字节级拷贝，SHA256 `22a3ed6473445c71c34925a1f8828db79d7f7054a6ea35ae6d7065cdd2762f03` 两侧一致）。

## 8. 资源对照：解析分配量与 WASM 线性内存

native 口径：`Arena::BytesUsed()`（解析 Arena 的实际累计分配字节，**非进程 RSS**；输入缓冲在独立 Arena 不计入）。stringTokens 为 DOM 键+字符串值计数。

| 输入 | tokens（旧/新） | 旧 Arena 分配 | 新 Arena 分配 | 下降 |
|---|---|---|---|---|
| compact_states32 | 3618 / 3618 | 158,457,212 B | **409,323 B** | −158,047,889 B（约 1/387） |
| states32（pretty） | 3618 / 3618 | 228,112,474 B | **409,315 B** | −227,703,159 B（约 1/557） |
| compact_three_greedy | 3618 / 3618 | 158,482,434 B | **409,331 B** | −158,073,103 B |
| 单短串（合成） | 1 / 1 | 103 B | 102 B | 持平（字符串后无剩余文档） |
| 1 串 + 300 KB 空白尾（合成） | 1 / 1 | 300,270 B | **266 B** | −300,004 B |

- tokens 计数与 A14 `parser-allocation-proof.json` 的静态 3618 完全吻合；旧实现动态实测（158,457,212 B）与 A14 静态估算（158,133,908 B）量级一致（差值来自 `\0` 结尾与其他 DOM 固定分配，静态口径只计字符串 payload 预留）。
- 证据直接证明：**每个字符串的分配不再随"该字符串之后的文档剩余长度"增长**（300 KB 尾部用例从 300,270 B 降到 266 B）。
- WASM 线性内存峰值（worker 实测 `memory.buffer.byteLength`，非 RSS）：

| 输入 | 冻结旧 WASM 峰值 | 候选 WASM 峰值 |
|---|---|---|
| compact_states32 | 168,624,128 B（≈160.8 MiB） | **10,420,224 B（≈9.9 MiB）**，且峰值=初始，plan 期间零增长 |
| states32（pretty） | 238,354,432 B（≈227.3 MiB） | **10,485,760 B（≈10.0 MiB）**，峰值=初始 |
| compact_three_greedy | 161,021,952 B | **2,752,512 B**，峰值=初始 |

## 9. 计时口径与限制（如实说明）

- **未保证独占 CPU**：本轮运行期间无法确认没有其他代理/进程并发（同批可能有只读复核代理在跑），故全部 coreMs/wallMs 样本（已存 `compare-summary.json` 的 `samplesMs`）**只作功能与量级参考，不作为性能结论**；本卡也不做最终整机性能验收。
- 冷/热口径：WASM 每请求独立进程实例化，worker 内重复 3 次为热样本（如 compact_states32 [486.8, 387.6, 380.9] ms），首样本为冷；native 每请求单进程单次。初始化计入：线性内存峰值含模块初始内存与输入缓冲。
- **DP20000 三餐长跑未重跑**（按卡要求）。
- 未外推：本结果只覆盖解析器字符串分配问题，不外推到 DP、整机或"所有性能目标已达成"；未宣称"无泄漏"（Arena 本身整块回收的既有行为未改）。

## 10. 错误路径新旧一致性补充

13 个畸形输入（§6 所列）逐一经新旧测量二进制独立进程运行：**ok 状态与错误文本 13/13 逐字节一致**（含"at byte N"定位），见 `compare-summary.json` 的 `errorParity`。源码层面亦逐点核对：新实现全部 `FailAt(offset)` 与旧实现失败时刻的 `Fail()`（即当时 `pos`）位置逐一相同（含 `\u` hex、孤立/无效代理、非法转义、控制字符、unterminated）。

## 11. 生产与既有证据未改确认

- 生产 manifest 收工复算仍为 U09（7f6a6ea5…），生产 `core/src/json.cpp` 哈希不变（683a472f…）。
- 冻结 WASM 未替换（manifest matches=true）；新 WASM 仅存在于候选/证据目录，**未经 P01 接收不得替换冻结产物**。
- A14 原始证据目录只读（仅复制 worker 与读取 raw_io）；MEMORY 未改；未在项目外建暂存目录。
- `.toolchain\build\wasm` stage 目录内既有 `mp_core.wasm`（旧构建产物）未触碰，仅新增独立命名的 stage 文件。

## 12. 遗留与下一步（接收者决定）

- 无阻塞项。新候选 WASM（107936 B）与候选 json.cpp 补丁（`candidate\t04a15-json.cpp.patch`）等待 P01 核收后按单人汇合流程处置。
- 本卡结论边界：仅证明解析器字符串分配修复及双端语义一致；合成对照、A14 三请求、双端对拍、错误路径均闭环；未做独立只读审查代理（如需可补派）。

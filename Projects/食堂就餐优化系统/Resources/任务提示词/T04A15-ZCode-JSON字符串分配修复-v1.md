# T04A15｜ZCode｜JSON 字符串分配定向修复

**指定平台/模型：ZCode / GLM 5.3。**若客户端明确显示 GLM 5.3 Flash，按客户端显示原样记录；实际服务端模型、档位或 Harness 无法核实时写“未知”，不要把请求模型当成实际调用证明。本任务不属于反重力/Gemini 路由，不要转交其他平台，也不要混入其他 QA 卡。

## 任务与输入

- 项目根：`D:\项目\cpp\Projects\食堂就餐优化系统`
- 开工前确认当前目录就是上述项目根。先阅读项目 `AGENTS.md`、`MEMORY\MEMORY.md`/`事实.md`/`待办.md`/`决策点.md` 中与本卡直接相关的最新事实，再读任务卡 `Resources\任务卡\T04A15-ZCode-JSON字符串分配修复卡-v1.md`、A14 报告 `Resources\报告\T04A14-内部Sol-全天DP有界搜索-交付反馈-v1.md`、下列 A14 证据、实际生产 `core\src\json.cpp` 和本提示词所附代码简洁约定。无需复制整段历史。
- A14 证据目录：`Resources\报告\T04A14-内部Sol-全天DP有界搜索-证据-v1\`
- 必读证据：`parser-allocation-proof.json`、`identity.json`、`readonly-reference\core\`、`raw_io\compact_states32.req.json`、`raw_io\compact_three_greedy.req.json` 及其正常响应；按需读取相应 `.run.json` 和 `diagnose.py` / `wasm-worker.mjs`。A14 的诊断脚本硬编码旧 native/WASM 路径，只能作为证据与调用方式参考，直接调用它并不算验证新候选。
- 生产 UI 基线摘要：`7f6a6ea5071626afeb817592f5ad10f105481a2fbefdfee0b8c4b98626aeba42`。冻结旧 WASM：107472 B，SHA256 `B53C7405A643E8409071ED76D3CB4CCBDF1A37E6E5C408CE1D4A373D4CC00744`。核心源码身份以 A14 `identity.json` 为准，不得仅凭同名文件推定一致。
- 已核实的问题：`ParseString` 当前以 `length-pos+1` 为每个字符串预留容量，等同把整个 JSON 剩余字节数算给当前字符串。A14 对 98312 B 紧凑输入中的 3618 个字符串 token 求和为 158133908 B；136559 B pretty 输入为 227789170 B。请以实际源码/输入复核，不把报告数值当作实现结果。

## 目标与边界

在 `Resources\报告\T04A15-ZCode-解析器内存修复-证据-v1\candidate\` 建立隔离核心候选，只改 `core/src/json.cpp` 解决字符串容量预留问题。保留 JSON 契约、ABI、输入格式、合法输入语义及错误定位；覆盖 UTF-8、引号/反斜线等转义、Unicode `\u` 和代理对、中文、空串、重复键/值、长串、截断及非法转义。非法输入须继续明确失败，不吞错、不返回假成功。

不引入依赖、备用解析器、通用抽象/兼容框架；不改 planner/算法、评分、菜单、营养公式、限额契约、页面或生产目录。生产源文件、冻结 WASM、A14 原始证据与项目 MEMORY 保持不动。新 WASM 只放在候选/证据目录，未经 P01 接收不得替换冻结产物。

主执行者是唯一 C++ 写入者。若平台支持，可安排最多一名只读审查者独立查看转义、边界和错误路径；审查者不得改代码。否则记录未做独立审查，不能写“双人通过”。

## 代码简洁约定

本约定适用于新增代码和本卡直接改动；无关旧代码只记录，不顺手重构。依据真实输入、支持版本、调用方和已确认业务要求直接实现：

1. 在接收外部输入、文件内容或第三方响应的适当边界校验；内部已建立的契约不逐层重复检查。
2. 内部契约被违反时提供清楚、可定位的失败信息；避免吞异常后返回空结果、默认值或假成功。
3. 重试、降级、默认值须对应真实失败场景或明确业务要求；不为假想问题增加多层备用路径。
4. 兼容层须有已支持版本、真实调用方或明确迁移需求；不预先兼容不存在的旧格式或未来接口。
5. 在当前范围内直接实现，不为未来可能的需求增设抽象层或兜底框架。

这不禁止 `try/catch`、判空、重试或兼容代码；保留故障处理时说明它保护的真实条件和失败结果。来源：凉笙《代码简洁约定》，SHA256 `104B13661AF6851A08C70444F8A66B0BF94B02F757DAC9A079393E5497AA1A7A`。

## 隔离构建入口与候选调用

项目已有入口 `tools\core\build_native.ps1` 与 `tools\core\build_wasm.ps1`。已核实：前者支持 `-OutDir`，但源码根固定为项目 `core`；后者同样固定项目源码根，`-OutDir` 只改产物目录。**不要直接运行它们后宣称产物含候选修复。**两脚本的已配置工具分别是 MSVC（`D:\Microsoft Visual Studio\VC\Auxiliary\Build\vcvars64.bat`，存在）和 Zig 0.16.0 Python 模块（`D:\项目\cpp\.toolchain\py-zig`，存在）。

先检查 `candidate\core` 是否已存在；若存在，先核实身份并续用，绝不覆盖未知候选。若不存在，在候选下复制当前生产 `core` 目录作为同版镜像，再只改候选 `core\src\json.cpp`；必要的新增 parser 用例放在候选测试目录/证据目录，不改生产文件。可从项目根执行：

```powershell
if (Test-Path -LiteralPath (Join-Path $candidate 'core')) { throw 'candidate core already exists; inspect its identity before reuse' }
New-Item -ItemType Directory -Force -Path $candidate | Out-Null
Copy-Item -LiteralPath (Join-Path $project 'core') -Destination $candidate -Recurse
```

产物输出到证据目录内的 `candidate\build\native` 和 `candidate\build\wasm`。保存源码清单/哈希、候选补丁或清晰 unified diff、编译器版本、命令、退出码、日志及产物哈希。

下面是按现有脚本核实过的**隔离构建命令模板**；在项目根 PowerShell 执行。先设好变量并按模板建候选镜像，不要让构建脚本重新读取生产 `core`：

```powershell
$project = (Get-Location).Path
$evidence = Join-Path $project 'Resources\报告\T04A15-ZCode-解析器内存修复-证据-v1'
$candidate = Join-Path $evidence 'candidate'
$core = Join-Path $candidate 'core'
$nativeOut = Join-Path $candidate 'build\native'
$wasmOut = Join-Path $candidate 'build\wasm'
$obj = Join-Path $nativeOut 'obj'
New-Item -ItemType Directory -Force -Path $nativeOut,$wasmOut,$obj | Out-Null

# 从候选镜像收集所有 core/src/*.cpp；使用项目脚本相同的 MSVC 参数与 CLI 入口。
$sources = @(Get-ChildItem -LiteralPath (Join-Path $core 'src') -Filter '*.cpp' | Sort-Object Name | ForEach-Object { $_.FullName })
$vcvars = 'D:\Microsoft Visual Studio\VC\Auxiliary\Build\vcvars64.bat'
$quoted = ($sources | ForEach-Object { '"' + $_ + '"' }) -join ' '
$cli = '"' + (Join-Path $core 'cli\main.cpp') + '"'
$exe = Join-Path $nativeOut 'mp_cli.exe'
$cl = 'cl /nologo /std:c++17 /W4 /EHsc /permissive- /utf-8 /Zc:__cplusplus /MP /I"' + (Join-Path $core 'include') + '" /Fe"' + $exe + '" ' + $quoted + ' ' + $cli
$cmd = 'call "' + $vcvars + '" >nul && cd /d "' + $obj + '" && ' + $cl
& cmd.exe /c $cmd
if ($LASTEXITCODE -ne 0) { throw "candidate native build failed: $LASTEXITCODE" }

# 项目 build_wasm.ps1 使用的 Zig 参数；环境路径沿用工作区现有工具链，产物写入候选目录。
$zigDir = 'D:\项目\cpp\.toolchain\py-zig'
$env:PYTHONPATH = $zigDir
$env:ZIG_GLOBAL_CACHE_DIR = 'D:\项目\cpp\.toolchain\zig-cache'
$env:ZIG_LOCAL_CACHE_DIR = 'D:\项目\cpp\.toolchain\zig-cache-local'
$env:PYTHONIOENCODING = 'utf-8'
$wasm = Join-Path $wasmOut 'mp_core.wasm'
$zigArgs = @('c++','-target','wasm32-freestanding','-nostdlib','-Os','-fno-exceptions','-fno-rtti','-Wall','-Wextra','-Wno-unused-parameter','-std=c++17','-I',(Join-Path $core 'include'),'-Wl,--no-entry','-Wl,--gc-sections','-o',$wasm) + $sources
& python -m ziglang @zigArgs
if ($LASTEXITCODE -ne 0) { throw "candidate WASM build failed: $LASTEXITCODE" }
```

编译器/工具链如果实际不可用，记录命令、错误和阻塞，不装无关依赖、不改 ACL、不切完全访问。若调整命令，必须注明差异及为何仍确保读取候选源。

CLI 实际用法已在 `core\cli\main.cpp` 核实：`mp_cli.exe plan <request.json> --out <response.json>`。WASM 对照可复用 A14 `wasm-worker.mjs` 的参数：`node <wasm-worker.mjs> <candidate-mp_core.wasm> <request.json> <response.json> <repeats>`。A14 worker 的重复数为第 5 个参数。须把调用包在一个单请求父进程 `subprocess.run(..., timeout=25)` 中，以免 worker/CLI 卡住；每个请求独立进程。新旧对照输入至少用 `raw_io\compact_states32.req.json`（紧凑）、`raw_io\states32.req.json`（pretty）和 `raw_io\compact_three_greedy.req.json`，旧响应仅作语义对照，native 与新 WASM 必须明确指向新候选产物。不得复跑已知 DP 20000 三餐长跑。

## 验收与证据

1. 为直接改动新增最小 JSON parser 回归，覆盖合法/转义引号与反斜线/Unicode 代理对与中文/空串/重复字符串/长串，以及截断、非法转义和错误定位。构建并运行候选 native 与候选 WASM；记录每个用例实际输入、响应/错误、退出码与日志。非法输入不能被吞掉或变成假成功。
2. 对 A14 `compact_states32`、`compact_three_greedy` 输入，新旧正常响应语义一致；新 native 与新 WASM 一致。保留 requestId 等已知实验字段差异说明，不能把失败响应丢弃后计作通过。
3. 对同一版 A14 紧凑/pretty 请求做可比的解析分配量或 WASM 线性内存峰值比较，说明冷/热口径、初始化是否计入。不得用进程 RSS 代替 WASM 线性内存。证据应证明分配不再随“当前字符串之后的整份文档剩余长度”增长，并给出实际下降量；只做静态代码阅读不够。
4. 报告不能外推到 DP、整机或所有性能目标已达成；不宣称无泄漏，除非有实际证据。
5. 每个可能长跑用独立进程硬超时 25 秒；失败或超时原样记录。不得重跑已知 DP 20000 三餐无界实验。

唯一反馈：`Resources\报告\T04A15-ZCode-JSON字符串分配修复-交付反馈-v1.md`。隔离候选/产物/原始证据全部留在本卡证据目录；不要改生产、原 A14 证据或 MEMORY。完成、阶段交付或阻塞都写完整反馈并停止，不自行升级/替换小程序包内 WASM，不外发给其他角色。

## 唯一反馈文件必须包含

- T04A15、基线与输入身份、候选源码路径/差异/哈希；隔离 native/WASM 产物路径、大小、SHA256、实际编译器/参数/命令/退出码和日志。
- 指定模型 GLM 5.3；客户端可见模型/Harness/档位逐项如实写，未能独立核实写“未知”。只读审查代理身份与是否实际审查；不支持时写“未做”。
- 每个 parser 回归、双端对拍、A14 原始输入对照、资源比较的原始证据位置和结果；冷/热口径、超时记录、未运行项与限制。
- 生产未改、冻结 WASM 未替换的确认；阻塞项与下一步所需接收者决定。


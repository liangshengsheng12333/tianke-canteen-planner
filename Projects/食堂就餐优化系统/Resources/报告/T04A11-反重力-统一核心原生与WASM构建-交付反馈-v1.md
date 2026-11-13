# T04A11｜反重力｜统一核心原生与WASM构建 交付反馈 v1

- **任务编号**：T04A11
- **任务名称**：统一核心原生与 WASM 构建
- **提示词版本**：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\任务提示词\T04A11-反重力-统一核心原生与WASM构建-v1.md`
- **执行角色**：主执行员（反重力）
- **执行日期**：2026-10-23
- **工作目录 (cwd)**：`D:\项目\cpp`
- **项目路径**：`D:\项目\cpp\Projects\食堂就餐优化系统`
- **唯一反馈归档路径**：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T04A11-反重力-统一核心原生与WASM构建-交付反馈-v1.md`
- **独立证据目录**：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T04A11-反重力-统一核心原生与WASM构建-证据-v1\`

---

## 一、指定模型与执行环境核实记录

依据项目协作准则与任务指示，严格记录本任务主执行员与子代理的请求模型与现场运行环境：

| 角色 / 会话 | P01 指定模型 | 现场可见/可核实实际模型 | 档位 | 证据类型与核验记录 |
| :--- | :--- | :--- | :--- | :--- |
| **主执行员** | **Gemini 3.8** | **Gemini 3.8 Flash** | High | 任务提示词指定 Gemini 3.8；平台设置为 Gemini 3.8 Flash (High)，运行于 Google Antigravity 框架下，无 Gemini 4 换模 |
| **子代理 A**（产物二进制核验） | **Gemini 3.8** | **未知**（平台未透传服务端具体子型号） | 未知 | 独立子代理会话 `664d7329-8260-4d3f-bdb7-015a078563cf`，完成 WASM/Native 符号与内存协议核查，结论：**PASS**（见 `agent-wasm-audit/report.md`） |
| **子代理 B**（跨宿主回归测试） | **Gemini 3.8** | **未知**（平台未透传服务端具体子型号） | 未知 | 独立子代理会话 `d6f42f5d-e544-44a8-a0a2-aa202df1ac82`，完成 15 组案例 50 次双端交叉调用与性能基准，结论：**PASS**（见 `agent-regression-check/report.md`） |
| **子代理 C**（交付物与契约审计） | **Gemini 3.8** | **未知**（平台未透传服务端具体子型号） | 未知 | 独立子代理会话 `58b9d4cb-d84c-46b2-88e5-12476b942bc1`，完成快照身份、边界隔离与契约只读审计，结论：**PASS**（见 `agent-semantic-audit/report.md`） |

> [!IMPORTANT]
> **Gemini 4 鉴别结论**：全过程各会话均严格指定 Gemini 3.8，现场未检出任何 Gemini 4 标识、徽标或换模记录。平台不可核实子型号统一标为“未知”。

---

## 二、开工门槛与真实源码身份核查（单一快照依据）

在执行任何构建操作前，已严格核实前置条件：
1. **A10a 接收判定与核心写入终止**：
   - 查验并实读 A10a 唯一反馈：`Resources/报告/T04A10a-反重力-策略排序与剪枝对齐-交付反馈-v1.md`；
   - 查验并实读 P01 接收裁定：`Resources/报告/T04A10a-T05N01a-P01-接收与后续放行-20261023-v1.md`，明确记录：“A10a 接收为统一构建输入……T04A11 统一核心原生与 WASM 构建：放行”；
   - 确认核心写入已结束，现场无其他活跃写入者，反重力为当前唯一核心责任方。
2. **源码身份核查与快照固化**：
   - 现场逐文件计算生产目录全部 19 项核心源码与脚本哈希，与 A10a `identity_post.json` 达成 **100% 逐文件逐字节吻合**；
   - 关键核心文件 `core/src/planner.cpp` 实测 `217,345` 字节，SHA-256 为 `C90E986784D01151F16C314450E3351F6C450378464858C91EC1A515BB25F9A9`；
   - 在证据目录下固化完整源码快照 `snapshot/`，生成身份台账 `identity.json`。

---

## 三、隔离构建命令、工具链与构建产物

### 3.1 构建命令与工具链版本

1. **原生构建 (Native CLI & Unit Tests)**：
   - **工具链**：MSVC v18.11 (`vcvars64.bat`, `cl.exe`)
   - **参数**：`/nologo /std:c++17 /W4 /EHsc /permissive- /utf-8 /Zc:__cplusplus /MP`
   - **执行命令**：
     ```powershell
     powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\core\build_native.ps1 -OutDir Resources\报告\T04A11-反重力-统一核心原生与WASM构建-证据-v1\native
     ```
   - **结果**：`mp_cli` 及 3 个测试套件编译 exitCode=0, warnings=0, errors=0。构建摘要保存于 `native/build_summary.json`。
2. **WASM 构建 (WASM Module)**：
   - **工具链**：Zig 0.16.0 (`build\zig-runner\zig.exe`, Python `ziglang`)
   - **目标与参数**：`wasm32-freestanding -nostdlib -Os -fno-exceptions -fno-rtti -Wall -Wextra -Wno-unused-parameter -std=c++17 -Wl,--no-entry -Wl,--gc-sections`
   - **执行命令**：
     ```powershell
     powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\core\build_wasm.ps1 -OutDir Resources\报告\T04A11-反重力-统一核心原生与WASM构建-证据-v1\wasm
     ```
   - **结果**：exitCode=0, warnings=0。构建摘要保存于 `wasm/wasm_summary.json`。

### 3.2 交付产物清单与物理散列

| 产物名称 | 交付绝对路径 | 文件大小 | SHA256 哈希 |
| :--- | :--- | :--- | :--- |
| **隔离原生 CLI** | `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T04A11-反重力-统一核心原生与WASM构建-证据-v1\native\mp_cli.exe` | 372,224 字节 | `F004C533BE759618E80873A8760AD20F4EDA4AB0BC796E1D79EE3DA2C75C43B5` |
| **隔离 WASM 产物** | `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T04A11-反重力-统一核心原生与WASM构建-证据-v1\wasm\mp_core.wasm` | 107,472 字节 | `B53C7405A643E8409071ED76D3CB4CCBDF1A37E6E5C408CE1D4A373D4CC00744` |

---

## 四、ABI 出口与命令清单

### 4.1 WASM 模块导出面与宿主依赖（经 Node.js 实测核验）
- **Imports**：`[]`（**0 项**，纯 freestanding 零宿主依赖）。
- **Exports**：共 **9 项**（1 项线性内存 + 8 个稳定 C ABI 入口函数）：
  1. `memory` (WebAssembly.Memory)
  2. `mp_api_version` (uint32_t(void) -> 1)
  3. `mp_contract_version` (const char*(void) -> "1.0", 静态只读)
  4. `mp_alloc` (void*(uint32_t size))
  5. `mp_free` (void(void* ptr))
  6. `mp_plan` (void*(const char* input, uint32_t len))
  7. `mp_nutrition_target` (void*(const char* input, uint32_t len))
  8. `mp_validate_menu` (void*(const char* input, uint32_t len))
  9. `mp_offer_nutrition` (void*(const char* input, uint32_t len))

### 4.2 原生 CLI 子命令支持
原生 CLI `mp_cli.exe` 完整覆盖四项业务命令，与 WASM 导出能力等价对齐：
- `mp_cli plan <request.json> [--out <response.json>]`
- `mp_cli nutrition-target <request.json> [--out <response.json>]`
- `mp_cli validate-menu <menu.json> [--out <response.json>]`
- `mp_cli offer-nutrition <catalog.json> [--out <response.json>]`

---

## 五、跨宿主最小定向验证与双端一致性数据

由反重力子代理 B 执行跨引擎自动化回归，累计执行 15 组独立场景、25 组算法调用、**50 次双端交叉验证**，原生与 WASM **结构与字段深度一致率 100.0%**。

### 5.1 关键定向用例验证数据表

| 用例代号 / 场景 | 测试重点与断言 | 原生结果摘要 | WASM 结果摘要 | 双端一致性 |
| :--- | :--- | :--- | :--- | :---: |
| **A04 Offer 营养出口** (`01-portion-scaling.json`) | 真实调用 `offer-nutrition`，验证整份与半份缩放 | 整份 232 kcal，半份 116 kcal | 整份 232 kcal，半份 116 kcal | **100% 逐字段相等** |
| **A07 长 planKey 案例** (`a07-4097-minimal.request.json`) | 4097 字节规范化键，长哈希不截断，胜者一致 | `plan:6c2a0a4ee5904585b0f972ec608fb2a89b172a6baa2d6aa229d48cb74c6fd2cd` | `plan:6c2a0a4ee5904585b0f972ec608fb2a89b172a6baa2d6aa229d48cb74c6fd2cd` | **100% 逐字段相等** |
| **A08 已吃超预算边界** (`already_over_budget_dp.request.json`) | 预算已超，返回保底方案并标 `overBudget=true` | `overBudget=true`, 状态 `NoFeasibleWithinBudget` | `overBudget=true`, 状态 `NoFeasibleWithinBudget` | **100% 逐字段相等** |
| **A09 F6 DP 恢复验证** (`f6_restore_dp.request.json`) | DP 状态下正确保留符合预算的更优候选 | 命中 `plan:7bd365ee32...`，价格 100 分 | 命中 `plan:7bd365ee32...`，价格 100 分 | **100% 逐字段相等** |
| **A09 更好预算保留** (`better_budget_retained_dp.request.json`) | 预算保留候选，优先选择低价合规方案 | 命中 `plan:986cd22305...`，价格 95 分 | 命中 `plan:986cd22305...`，价格 95 分 | **100% 逐字段相等** |
| **A09 两餐已吃未知** (`two_meals_spent_unknown_dp.request.json`) | 未知花销安全兼容，保留合法预算组合 | 命中 `plan:100946a5c5...`，价格 160 分 | 命中 `plan:100946a5c5...`，价格 160 分 | **100% 逐字段相等** |
| **A10a 排序/剪枝（7项）** (`a10_case_01 ~ 07`) | economy/taste 按 planKey 决胜，消除 deviationBp 尾比较与 BnB 误剪枝 | 7 项全命中契约最优，BnB 节点评估数 = 4 | 7 项全命中契约最优，BnB 节点评估数 = 4 | **100% 逐字段相等** |
| **三规划算法基准** (`greedy`, `dp`, `branchAndBound`) | 正常调用计划生成，输出结构完整合法 | 均生成合法方案，各指标完备 | 均生成合法方案，各指标完备 | **100% 逐字段相等** |

### 5.2 性能时延基准 (In-Engine WASM 耗时)

在 Node.js 宿主下测试纯 WASM 引擎计算时延（10 次采样中位数）：
- **常规一餐/两餐规划**：`0.50 ms ~ 0.71 ms`（亚毫秒级响应）；
- **4097 字节组合规划 (A07)**：`67.98 ms`；
- **营养目标计算 (`nutrition-target`)**：`0.155 ms`；
- **菜品份量缩放 (`offer-nutrition`)**：`1.017 ms`；
- **菜单结构校验 (`validate-menu`)**：`1.003 ms`。

### 5.3 内存协议与生命周期（子代理 A 专项断言）
- **Alloc / Free 契约**：`mp_alloc` 分配非零、不同指针；单次 `mp_free` 释放；重复 `mp_free` 安全不破坏堆。
- **内存无泄漏**：200 次及 500 次 alloc/free 循环后，宿主堆保持平直，零额外内存页增长；单次请求完成后 bump 指针准确复位至 `heap_base`。
- **边界防崩溃 (Zero Trap)**：空 JSON、语法畸形 JSON、未知字段及乱码输入在两端均不 trap，优雅返回带有 `INVALID_INPUT` 或对应错误码的 ResultEnvelope 结构。
- **原生单元测试**：`mp_test_sha256.exe` (20 PASS), `mp_test_json.exe` (189 PASS), `mp_test_core.exe` (43 PASS)，全部 252 项断言通过。

---

## 六、写入边界与代码保护审计

由反重力子代理 C 执行独立合规审计：
1. **生产核心零修改**：`core/` 目录 18 个核心源码与头文件逐字节等于快照，无任何算法改动。
2. **生产小程序 WASM 零替换**：
   - 生产环境 `miniprogram/src/assets/wasm/mp_core.wasm` 严格保持 2026-10-20 17:16 历史版本，大小 `72,881` 字节，SHA-256 为 `715CD7701B64D8F493A110C348B5F643979536578C7380C29837E05C4F31D52C`；
   - **本次产物绝对未覆盖或替换该文件**。
3. **前端与菜单零污染**：小程序代码及真实菜单目录无任何修改。
4. **`tools/core/build_wasm.ps1` 最小环境修复记录**：
   - **原因**：Windows 环境下，Zig 工具链的 LLVM `wasm-ld` 在解析包含非 ASCII 中文字符的目标输出路径时会触发 `Permission denied / AccessDenied`；
   - **修复**：将编译输出暂存于工作区内部 ASCII 暂存区（`.toolchain\build\wasm\`），编译完成后自动复制至 `-OutDir` 指定的目标证据目录；同时修复了 `ZIG_LOCAL_CACHE_DIR` 与 runner 路径指向，编译参数与链接选项完全未动。

---

## 七、前端（T05N02）接合指南与 ABI 使用要点

供后续 T05N02（自选营养接合）任务参考：

1. **确切 WASM 引用路径**：
   `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T04A11-反重力-统一核心原生与WASM构建-证据-v1\wasm\mp_core.wasm`
   （文件大小：`107,472` 字节，SHA-256：`B53C7405A643E8409071ED76D3CB4CCBDF1A37E6E5C408CE1D4A373D4CC00744`）
2. **WebAssembly 实例化**：
   ```javascript
   const instance = await WebAssembly.instantiate(wasmBytes, {}); // 空 import 对象，无需任何宿主函数注入
   ```
3. **内存调度与释放协议（严格遵守，防内存泄漏）**：
   - **输入数据**：
     1. 调用 `ptr = exports.mp_alloc(inputBytes.length)` 分配缓冲区；
     2. 向 `exports.memory.buffer` 中 `ptr` 偏移处写入 UTF-8 JSON 字节；
     3. 调用业务入口，如 `block = exports.mp_offer_nutrition(ptr, inputBytes.length)`；
     4. **必须立即调用** `exports.mp_free(ptr)` 释放输入缓冲区。
   - **输出数据**：
     1. 核心返回结果块指针 `block`（非 0）；
     2. 读取 `block + 0` 处的前 4 字节（32 位无符号小端整数 `payloadLength`）；
     3. 从 `block + 8` 处复制出长度为 `payloadLength` 的 UTF-8 字节并转为 JS 字符串或解析 JSON；
     4. **必须调用** `exports.mp_free(block)` 释放结果块恰好一次。
   - **版本号**：
     `exports.mp_contract_version()` 返回静态只读字符串指针，**禁止对其调用 mp_free**。

---

## 八、未覆盖边界与后续建议

1. **半份奇数舍入临界值**：A04 测试用例基于偶数折半（如 464->232, 232->116）。对于出现奇数卡路里/营养素产生 `.5` 小数时的取整边界，明确留待后续统一真实菜单候选时进行多点验证。
2. **小程序生产 WASM 替换**：根据调度规则，生产 `miniprogram/src/assets/wasm/mp_core.wasm` 须待 P01 验收本报告并由后续卡片明确授权后再行合并替换。

---

## 九、结论与状态

- **状态**：**完成 (PASS)**
- **交付证据目录**：[`Resources/报告/T04A11-反重力-统一核心原生与WASM构建-证据-v1/`](file:///D:/项目/cpp/Projects/食堂就餐优化系统/Resources/报告/T04A11-反重力-统一核心原生与WASM构建-证据-v1/)
- **子代理报告**：
  - 子代理 A 报告：[`agent-wasm-audit/report.md`](file:///D:/项目/cpp/Projects/食堂就餐优化系统/Resources/报告/T04A11-反重力-统一核心原生与WASM构建-证据-v1/agent-wasm-audit/report.md)
  - 子代理 B 报告：[`agent-regression-check/report.md`](file:///D:/项目/cpp/Projects/食堂就餐优化系统/Resources/报告/T04A11-反重力-统一核心原生与WASM构建-证据-v1/agent-regression-check/report.md)
  - 子代理 C 报告：[`agent-semantic-audit/report.md`](file:///D:/项目/cpp/Projects/食堂就餐优化系统/Resources/报告/T04A11-反重力-统一核心原生与WASM构建-证据-v1/agent-semantic-audit/report.md)
- **汇总数据**：[`verification_summary.json`](file:///D:/项目/cpp/Projects/食堂就餐优化系统/Resources/报告/T04A11-反重力-统一核心原生与WASM构建-证据-v1/verification_summary.json)

本单任务已全部执行完毕，核心写入立即停止，未替换生产小程序 WASM，等待 P01 查收与后续放行。

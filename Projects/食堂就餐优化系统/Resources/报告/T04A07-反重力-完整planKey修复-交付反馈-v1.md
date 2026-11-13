# T04A07｜反重力｜完整 planKey 修复 交付反馈 v1

- **任务代号**：T04A07
- **任务名称**：完整 planKey 修复
- **提示词版本**：`T04A07｜反重力｜完整 planKey 修复 v1`
- **执行角色**：主执行员（反重力）
- **执行日期**：2026-10-22
- **工作目录 (cwd)**：`d:\项目\cpp`
- **项目路径**：`d:\项目\cpp\Projects\食堂就餐优化系统`
- **唯一反馈归档路径**：`d:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T04A07-反重力-完整planKey修复-交付反馈-v1.md`
- **证据目录**：`d:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T04A07-反重力-完整planKey修复-证据-v1\`

---

## 一、指定模型与执行环境核实记录

依据提示词规范，如实记录本任务各参与角色的指定模型与现场运行环境：

| 角色 / 会话 | P01 指定模型 | 现场可见/可核实实际模型 | 档位 | 证据类型与核验记录 |
| :--- | :--- | :--- | :--- | :--- |
| **主执行员** | **Gemini 3.8** | **未知**（宿主未透传运行时具体内部版本字符串） | 未知 | 提示词指定 Gemini 3.8，原生档未指定；运行于 Google Antigravity 框架下，无 Gemini 4 换模 |
| **独立只读验证子代理** | **Gemini 3.8** | **未知**（宿主未透传运行时具体内部版本字符串） | 未知 | 独立子代理会话 `156e966f-2805-4b88-aa0a-915ebd0bebf7`，只读复核反例，无 Gemini 4 换模 |

> [!IMPORTANT]
> **Gemini 4 鉴别结论**：全过程严格指定 Gemini 3.8，现场未检出任何 Gemini 4 标识、徽标或文本提示，未发生跨代换模。不可核实的平台内部版本统一如实标为“未知”，不把请求配置直接推断为服务端内部版本。

---

## 二、启动门槛与前置基线核查

在执行任何核心修改前，主执行员已逐项核验并满足启动门槛：

1. **A04 交付状态**：
   - A04 核心只读出口已完成交付并归档（[`T04A04-反重力-Offer营养只读出口-交付反馈-v1.md`](T04A04-反重力-Offer营养只读出口-交付反馈-v1.md)）。
   - 主执行员已完全结束对共享核心路径的修改写入，状态已冻结。
2. **P01 裁定放行**：
   - P01 在 [`T04A04-T03b-P01-接收与后续放行-20261022-v1.md`](T04A04-T03b-P01-接收与后续放行-20261022-v1.md) 中已明确裁定：“**接收 A04 为后续核心开发基础，放行 A07**”。
3. **真实前序候选身份核查**：
   - 前序文件路径：`d:\项目\cpp\Projects\食堂就餐优化系统\core\src\planner.cpp`
   - 实测前序大小：225,861 字节
   - 实测前序 SHA-256：`417E753207D49700DFE8FE0AD7B010BA178E953E72ED4743FE33149E76582AC0`
   - 说明：该哈希与 A06 隔离实验起点哈希一致（因 A04 修改未触碰 `planner.cpp`），这是从当前实际物理文件实测计算得出，严禁由 A06 整文件覆盖引入。

---

## 三、代码局部移植内容与生产哈希变更

主执行员作为唯一核心写入者，将 A06 隔离实验验证通过的共享规范序列化与完整 32 字节摘要方案精确移植到生产候选：

### 3.1 移植改动清单

1. **共享私有规范序列化**：
   - 从 `BuildPlanKey` 中提取私有结构 `struct PlanKeyItem { Str offerId; i64 quantity; };`。
   - 提取私有序列化函数 `bool WritePlanKeyRows(const Vec<MealPlan>& meals, Vec<PlanKeyItem>* pairs, TextBuffer* json)`。
   - 严格保证早/午/晚顺序（`kMealBreakfast, kMealLunch, kMealDinner`）、同餐同 offerId 数量合并（`pairs[k].quantity += 1`）、offerId 字节序升序插入排序以及 `JsonOut` 字符串转义和数值语义完全一致。
   - 正式方案 `BuildPlanKey` 重构为直接调用 `WritePlanKeyRows`，消除双轨代码分歧。
2. **DP 状态 32 字节摘要缓存**：
   - 在 `struct DpState` 中新增成员：`Sha256Digest terminalPlanKey;`（32 字节固定数组）。
   - 移除原有 4096 字节固定栈缓冲区结构 `StackJsonBuf`。
   - 移除重复手写的十六进制格式化与比较函数 `ComputeTerminalDpPlanKeyHex` 与 `CompareTerminalDpPlanKey`。
   - 实现 `bool ComputeTerminalDpPlanKeyDigest(...)`，在 DP 终端阶段确立完整餐次选择时，复用 `WritePlanKeyRows` 对完整选择计算 SHA-256 并直接存入 `terminalPlanKey`。
3. **终端平局词典序等价决胜**：
   - 在终端支配 `DpExactDominates` 的尾部平局分支中，将原有基于截断字符串比较替换为：
     `MemCompare(a.terminalPlanKey.bytes, b.terminalPlanKey.bytes, kSha256Bytes) <= 0;`
   - 由于十六进制小写编码与原始无符号字节的字典序严格保序，且所有正式 planKey 均有固定前缀 `"plan:"`，因此 32 字节无符号内存比较与完整正式 planKey 字典序比较数学上完全等价。
   - 移除了所有在非终端阶段按前缀哈希剪枝的危险逻辑，仅在终端全指标平局时生效。
4. **单次规划容量复用**：
   - 在 `RunDpAlgorithm` 函数栈层初始化暂存容器：
     ```cpp
     Vec<MealPlan> keyMeals; keyMeals.Init(&ctx.Memory());
     Vec<PlanKeyItem> keyPairs; keyPairs.Init(&ctx.Memory());
     TextBuffer keyJson; keyJson.Init(&ctx.Memory());
     ```
   - 在每个终端候选处理时通过 `Clear()` 与 `size = 0` 复用底层已分配内存，避免按候选新建 Arena 导致 WASM bump 堆无谓前进。
   - 动态 `TextBuffer` 扩容失败时沿 `ctx.FailInternal` 正常错误出口退出，不使用隐蔽截断伪装成功。

### 3.2 生产文件哈希核查

| 文件物理路径 | 修改前 SHA-256 | 修改后 SHA-256 | 文件大小变化 |
| :--- | :--- | :--- | :--- |
| `core\src\planner.cpp` | `417E753207D49700DFE8FE0AD7B010BA178E953E72ED4743FE33149E76582AC0` | `B4DE5FBD69098E0C82D210B03E5D85C6C7B1E5FDAB5A1FDEA82E22D6B6188B0D` | 225,861 B → 220,629 B (-5,232 B) |

> 核心修改仅限于 `core/src/planner.cpp`，未修改任何头文件、API、C ABI、契约文件、前端文件或构建脚本。

---

## 四、原生构建与编译记录

使用隔离参数与证据目录进行原生 CLI 构建：

- **构建命令**：
  ```powershell
  powershell.exe -NoProfile -ExecutionPolicy Bypass -File tools\core\build_native.ps1 -Only mp_cli -OutDir "Resources\报告\T04A07-反重力-完整planKey修复-证据-v1\native"
  ```
- **编译参数**：MSVC 64-bit，`/std:c++17 /W4 /EHsc /permissive- /utf-8 /Zc:__cplusplus`
- **构建输出与状态**：
  ```text
  [OK] mp_cli  exit=0 warnings=0 errors=0
  summary -> d:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T04A07-反重力-完整planKey修复-证据-v1\native\build_summary.json
  ```
- **产物文件核查**：
  - 路径：`Resources\报告\T04A07-反重力-完整planKey修复-证据-v1\native\mp_cli.exe`
  - 大小：371,200 字节
  - SHA-256：`6D082A1BBB78BD8DFBC9FD29A3320ADE9590B4FDD41F0C7EE4A2C0AC73FFBDB6`

---

## 五、定向验证全集与结果

使用独立验证套件 `verify_long_keys.py` 驱动新构建的 `mp_cli.exe`，执行全部定向用例（共 7 个规划请求、1 个 BnB 辅助对照、4 个目录校验请求）：

### 5.1 边界与反例结果一览表

| 用例名称 | 规范串字节数 | 候选数 | 预期赢家完整 planKey | 实际输出 planKey | 结果 | 关键说明 |
| :--- | :---: | :---: | :--- | :--- | :---: | :--- |
| **4095 字节边界** | 4095 | 191 | `plan:5fb2172a741a...` | `plan:5fb2172a741a...` | **PASS** | 两平局方案规范串 4095 字节，完整与截断哈希同序 |
| **4096 字节边界** | 4096 | 191 | `plan:1660c1ee0db4...` | `plan:1660c1ee0db4...` | **PASS** | 4096 临界点，哈希全序完全一致 |
| **4097 字节反例 (全集合)** | 4097 | 191 | `plan:6c2a0a4ee590...` (`z000000`) | `plan:6c2a0a4ee590...` | **PASS** | **旧基线错选 `ddccd...`；修复后正确选出 `6c2a...`** |
| **4097 字节最小反例 (3候选)** | 4097 | 3 | `plan:6c2a0a4ee590...` | `plan:6c2a0a4ee590...` | **PASS** | 单餐、7 项购买项、锁定 6 项，primary/economy/taste 均正确胜出 |
| **4097 BnB 对照** | 4097 | 191 | `plan:6c2a0a4ee590...` | `plan:6c2a0a4ee590...` | **PASS** | 分支定界策略与修复后 DP 结果严格一致 |
| **A01 跨餐短键平局** | 63 | 2 叶 | `plan:91a2f58a00a4...` | `plan:91a2f58a00a4...` | **PASS** | 跨餐短键基准用例，与 A01 参照一致 |
| **14427 字节紧上界** | 14427 | 1 | `plan:4cf038d019ce...` | `plan:4cf038d019ce...` | **PASS** | 8 组件 × 8 规则 × 3 餐，验证动态缓冲扩展无截断 |
| **2016 字节数量合并** | 2016 | 1 | `plan:1a01c0f24621...` | `plan:1a01c0f24621...` | **PASS** | 同 offerId 数量 8 份合并为单个元组 `["offer",8]` |

### 5.2 4097 字节反例数学倒错证明

在 4097 字节 3 候选最小例中，两个指标完全相同（营养 deviationBp=0、tier=0、价格=700 分、覆盖=2、重复=0）的竞争候选如下：

| 候选标识 | 规范元组长度 | 完整 SHA-256 摘要（真实全序） | 前 4096 字节截断 SHA-256 | 旧实现截断判定 | 新实现完整判定 |
| :--- | :---: | :--- | :--- | :---: | :---: |
| **z000000** | 4097 B | `6c2a0a4ee5904585b0f972ec608fb2a89b172a6baa2d6aa229d48cb74c6fd2cd` | `246d1c0a08a0038e627f390e71428d1337cbcd06a93c4273893ed59360e12883` | 被支配（劣） | **胜出（优）** |
| **z000001** | 4097 B | `ddccd42119e11d9fbb641d7ce58da95ff3f0fbf19ca6b4203b3e81defd8ee8c3` | `07abfae8f9a5c39e696455fa3db2615e097a302be166ab459e1e5b61bdf80310` | **错选胜出** | 被支配（劣） |

- **旧实现错选原因**：`StackJsonBuf` 在写入第 4097 字节（末尾 `]`）时丢弃该字符，哈希截断后由于 `'07abfae8...' < '246d1c0a...'`，代码错误认为 `z000001` 更优，导致 `z000000` 被提前剪掉。
- **新实现修复证明**：采用完整 32 字节摘要比较，`'6c2a0a4e...' < 'ddccd421...'`，严格判定 `z000000` 胜出。实际 CLI 运行各策略方案输出 `planKey` 均为 `plan:6c2a0a4e...`，错选彻底消除。

---

## 六、独立只读验证子代理复核结论

- **子代理会话 ID**：`156e966f-2805-4b88-aa0a-915ebd0bebf7`
- **请求模型**：Gemini 3.8（实际模型未知，无 Gemini 4 换模）
- **独立复核报告文件**：[`Resources\报告\T04A07-反重力-完整planKey修复-证据-v1\agent-long-key-check.md`](agent-long-key-check.md)
- **子代理复核结论摘要**：
  1. 独立核实候选源码 SHA-256 确为 `B4DE5FBD69098E0C82D210B03E5D85C6C7B1E5FDAB5A1FDEA82E22D6B6188B0D`；
  2. 独立核验构建产物 `mp_cli.exe`（SHA-256: `6D082A1BBB78BD8DFBC9FD29A3320ADE9590B4FDD41F0C7EE4A2C0AC73FFBDB6`，exit=0）；
  3. 独立重算 4097 字节反例两个候选的规范串与完整/截断哈希，证明旧逻辑确实存在倒错错选；
  4. 独立调用 `mp_cli.exe` 验证响应，证实修复后实际胜出方案确为 `plan:6c2a0a4ee590...`；
  5. 独立复核 4095/4096 边界、14427 字节紧上界及 2016 字节数量合并用例全部正确通过；
  6. 子代理全过程严格只读，零生产污染。

---

## 七、证据索引清单

所有支撑证据均已固化保存在证据目录中：
`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T04A07-反重力-完整planKey修复-证据-v1\`

- `native\mp_cli.exe` / `native\build_summary.json` / `native\build_mp_cli.log`：隔离构建原生 CLI 产物与编译日志。
- `verify_long_keys.py`：独立枚举、规范元组生成与 CLI 驱动验证脚本。
- `a07-summary.json`：全套定向用例执行结果统计与详细字段记录。
- `a07-4097-minimal.request.json` / `.response.json` / `.stderr.txt`：4097 字节 3 候选最小反例请求与响应。
- `a07-4097.request.json` / `.response.json` / `a07-4097-bnb.request.json` / `.response.json`：4097 字节全集 DP 与 BnB 对照。
- `a07-4095.*` / `a07-4096.*`：4095/4096 字节边界请求、枚举元组与响应。
- `a07-tight-bound.*` / `a07-quantity-merge.*` / `a07-short-cross-meal.*`：14427 字节紧上界、数量合并与跨餐短键证据。
- `agent-long-key-check.md`：子代理独立只读复核报告。

---

## 八、未测项、未解决问题与接续边界

1. **未测项**：
   - 本任务按规范仅执行了针对长键序列化、边界及平局决胜的最小定向验证；
   - 未运行算法全量单元测试或综合测试矩阵；
   - 未测量全规模真实菜单下的端到端性能、内存泄漏或红米端到端耗时；
   - 未替换或打包正式小程序 WASM 产物，未在微信开发者工具或真机上运行。
2. **状态与后续**：
   - 生产求解器 `planner.cpp` 终端 planKey 平局截断错选缺陷已彻底修复；
   - 主执行员已**立即停止所有核心文件写入**；
   - 后续 A08、A09 仍处于未放行状态，等待 P01 查收核验本报告后另行安排。

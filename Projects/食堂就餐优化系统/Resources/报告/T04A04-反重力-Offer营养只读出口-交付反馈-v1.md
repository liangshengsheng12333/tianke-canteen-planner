# T04A04｜反重力｜Offer营养只读出口 交付反馈 v1

- **任务代号**：T04A04
- **任务名称**：Offer营养只读出口
- **提示词版本**：`T04A04｜反重力｜Offer营养只读出口 v1`
- **执行角色**：主执行员（反重力）
- **执行日期**：2026-10-22
- **绝对工作目录 (cwd)**：`D:\项目\cpp`（项目根目录：`D:\项目\cpp\Projects\食堂就餐优化系统`）
- **交付反馈归档路径**：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T04A04-反重力-Offer营养只读出口-交付反馈-v1.md`
- **独立证据目录**：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T04A04-反重力-Offer营养只读出口-证据-v1\`

---

## 一、指定模型与执行环境核实记录

依据提示词规范，如实记录本任务各参与会话的指定模型与现场运行环境：

| 角色 / 会话 | P01 指定模型 | 现场可见/可核实实际模型 | 档位 | 证据类型与核验记录 |
| :--- | :--- | :--- | :--- | :--- |
| **主执行员** | **Gemini 3.8** | **未知**（宿主未透传运行时具体模型版本字符串） | 未知 | 提示词指定 Gemini 3.8，原生档未指定；运行于 Google Antigravity 框架下，无 Gemini 4 换模 |
| **子代理 A**（案例复核） | **Gemini 3.8** | **未知**（宿主未透传运行时具体模型版本字符串） | 未知 | 独立子代理会话 `c8d84fc3-d461-4c6f-b998-b65276862e64`，无 Gemini 4 换模 |
| **子代理 B**（固定候选验证）| **Gemini 3.8** | **未知**（宿主未透传运行时具体模型版本字符串） | 未知 | 独立子代理会话 `abe3afd8-dd7a-4a49-8555-e335ceb6fe67`，无 Gemini 4 换模 |

> [!IMPORTANT]
> **Gemini 4 鉴别结论**：全过程各会话均严格指定 Gemini 3.8，现场未检出任何 Gemini 4 标识、徽标或文本提示，未发生跨代换模。

---

## 二、输入基线与关键生产文件哈希核验

本任务执行前对前置指定材料及生产求解器核心基线进行了严格核验：

### 2.1 依赖与前置文件
1. **接口规格**：`Resources\报告\T04A04-P01-Offer营养出口规格-v1.md`（SHA256: `B1A0692F9D381699C10DBD1AE9FA7362EA17B3BAE2C91D557EE344B731F23128`）
2. **A03 接收与续行裁定**：`Resources\报告\T04A03-T05S02a-P01-接收与并行续行裁定-20261022-v1.md`
3. **A03 交付反馈**：`Resources\报告\T04A03-反重力-待选价格状态修正-交付反馈-v2.md`

### 2.2 生产核心基线核验（零求解器污染证明）
- **核验目标**：`D:\项目\cpp\Projects\食堂就餐优化系统\core\src\planner.cpp`
- **要求基线 SHA256**：`417E753207D49700DFE8FE0AD7B010BA178E953E72ED4743FE33149E76582AC0`
- **实测 SHA256（开工前）**：`417E753207D49700DFE8FE0AD7B010BA178E953E72ED4743FE33149E76582AC0`（225,861 字节）
- **实测 SHA256（完工后）**：`417E753207D49700DFE8FE0AD7B010BA178E953E72ED4743FE33149E76582AC0`（225,861 字节）
- **结论**：**`planner.cpp` 严格未改动任何一字节，求解器、推荐逻辑、排序机制零污染。**

---

## 三、代码改动清单、ABI 与 CLI 调用方式及契约文档

### 3.1 实际修改的代码文件清单
主执行员独占修改核心目录、C ABI 及 CLI 接线，未触碰任何冻结 T01 文件或前端目录：

| 文件物理路径 | SHA256 哈希 | 改动内容简述 |
| :--- | :--- | :--- |
| `core\include\mp\api.h` | `525D7B98FA3283A8E73867082A8EB1B76A87F858D992338CC62189C47BC6CF59` | 声明 C ABI 导出入口 `mp_offer_nutrition` |
| `core\src\api.cpp` | `94D1E8A86E81603F332E0C602FFE05CA2D6084CECC757238D479133E1A6BA0DA` | 复用 `BuildResultBlock` 导出 `mp_offer_nutrition` |
| `core\include\mp\contract.h` | `33242C59A59DF114476A7EB047F5D62F3776AF8FA85A1361BF2CFE1B3E3C2AB7` | 声明 `OfferNutritionEntry` 契约入口函数 |
| `core\include\mp\catalog.h` | `747E79418427A7ED0CF1AD5690BE59FB5D3A053E9EFA95D2AFD09C1383227659` | 声明 `FindOffer` 统一查找工具函数 |
| `core\src\catalog.cpp` | `989D43CDF33C273B70D2372B0D2CF4E92D0CBCF55337AB4C3D140022CC507930` | 实现 `FindOffer`、OfferNutrition 序列化与校验 |
| `core\cli\main.cpp` | `20AC81E8B7A82B40AD4BB29FE19C58FD21DB2DC01E73A3A74DF87A5359082146` | CLI 新增 `offer-nutrition` 子命令及对应内存调度 |

### 3.2 C ABI 与 CLI 调用方式
1. **C ABI 签名**：
   ```c
   MP_API_EXPORT("mp_offer_nutrition") void* mp_offer_nutrition(const char* input, uint32_t length);
   ```
   - **内存协议**：输入由宿主通过 `mp_alloc` 分配并在调用后立即用 `mp_free` 释放；输出返回标准 8 字节前缀结果块（前 4 字节为小端有效载荷长度，第 4..7 字节保留，第 8 字节起为 JSON），宿主复制结果后必须调用 `mp_free` 释放恰好一次。
2. **原生 CLI 调用方式**：
   ```powershell
   mp_cli offer-nutrition <request.json> [--out <result.json>]
   ```
   - 若不指定 `--out`，结果直接输出至 stdout。

### 3.3 契约扩展文档归档
- **文档路径**：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\契约\Offer营养只读出口扩展-v1.md`
- **文档 SHA256**：`9CA557A514E51BAB013D528654EC50212E83B17F547A2A9A33373BC0D591CF64`
- **文档内容**：包含接口定位、JSON Schema、错误处理准则，以及 6 组完全基于实测真实输出的请求与响应样例。

---

## 四、隔离候选产物与 SHA256 哈希

本次构建产物严格收敛于证据目录，未对正式生产目录产生任何覆盖：

| 产物名称 | 隔离存放路径 | 文件大小 | SHA256 哈希 |
| :--- | :--- | :--- | :--- |
| **隔离原生 CLI** | `.../Resources/报告/T04A04-反重力-Offer营养只读出口-证据-v1/native/mp_cli.exe` | 373,248 字节 | `ADA573FF90D50A81C4ECE64820B73398FB4671D05F6FE13CA2DADC49838618FB` |
| **隔离 WASM 候选**| `.../Resources/报告/T04A04-反重力-Offer营养只读出口-证据-v1/wasm/mp_core.wasm` | 108,387 字节 | `AC8CD1172B2FD2483CE6B4B61E9E078CEA1D7E9FCE2CBC35E5E12330ED863D3C` |

---

## 五、原生与 WASM 定向案例实测与冒烟验证数据

所有 10 项新增 Offer 营养定向测试案例与 3 项既有业务入口冒烟案例均在原生 CLI 与 WASM 模块上进行了严格执行与逐字节对比：

### 5.1 10 项 Offer 营养定向测试结果（Native 与 WASM 100% 逐字节一致）

| 编号 | 测试用例文件 | 验证规格重点 | 原生字节 | WASM 字节 | 逐字节匹配 (ByteMatch) | JSON 语义匹配 |
| :---: | :--- | :--- | :---: | :---: | :---: | :---: |
| 1 | `01-portion-scaling.json` | 整半份米饭营养 1/2 缩放 | 629 | 629 | **TRUE** | **TRUE** |
| 2 | `02-nutrition-override.json` | 单品报价 override (999/888/777/666) 优先 | 429 | 429 | **TRUE** | **TRUE** |
| 3 | `03-combos-fixed-and-rule.json` | 固定双拼与规则展开套餐组件累加（含 `#`、`+`） | 671 | 671 | **TRUE** | **TRUE** |
| 4 | `04-zero-and-partial-null.json` | 数值 0 保留与 null 缺失传播、完整性 false | 437 | 437 | **TRUE** | **TRUE** |
| 5 | `05a-error-empty-offer-ids.json` | 错误拦截：空 offerIds 拒绝且返回 INVALID_INPUT | 172 | 172 | **TRUE** | **TRUE** |
| 6 | `05b-error-duplicate-offer-ids.json`| 错误拦截：重复 offerIds 拒绝且返回 INVALID_INPUT | 175 | 175 | **TRUE** | **TRUE** |
| 7 | `05c-error-invalid-offer-id.json` | 错误拦截：无效 ID 全有或全无原子拒绝（零部分成功） | 192 | 192 | **TRUE** | **TRUE** |
| 8 | `05d-error-meal-mismatch.json` | 错误拦截：餐别不匹配（早餐品午餐查）拦截拒绝 | 192 | 192 | **TRUE** | **TRUE** |
| 9 | `06a-order-chicken-rice.json` | 顺序保持：请求 [鸡肉, 米饭] -> 返回 [鸡肉, 米饭] | 629 | 629 | **TRUE** | **TRUE** |
| 10 | `06b-order-rice-chicken.json` | 顺序保持：请求 [米饭, 鸡肉] -> 返回 [米饭, 鸡肉] | 629 | 629 | **TRUE** | **TRUE** |

### 5.2 既有三大核心入口冒烟测试结果（老包络与协议零退化证明）

| 既有业务入口 | 测试输入文件 | 原生字节 | WASM 字节 | 逐字节匹配 | 业务结果验收 |
| :--- | :--- | :---: | :---: | :---: | :--- |
| **validate-menu** | `menu-simulated.json` (标准测试菜单) | 399 | 399 | **TRUE** | `valid=true`, `counts.offers=9`, `catalogHash` 一致 |
| **validate-menu** | `catalog-t04a04.json` (合成测试菜单) | 396 | 396 | **TRUE** | `valid=true`, `counts.offers=8`, 规则展开支持正常 |
| **nutrition-target** | `smoke-nutrition-target.json` | 380 | 380 | **TRUE** | `ok=true`, `AUTO_TARGET_DISABLED`（BMI 18.5 偏瘦锁定） |
| **plan** | `smoke-plan.json` | 8,338 | 8,338 | **TRUE** | `ok=true`, 成功输出去重方案，`requestId="req-v2-success"` |

---

## 六、子代理独立输出引用与复核结论

本次任务严格执行双子代理独立复核与验证机制，报告均已归档并完成哈希核实：

### 6.1 子代理 A：只读案例复核
- **报告归档路径**：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T04A04-反重力-Offer营养只读出口-证据-v1\agent-case-review\report.md`
- **报告 SHA256**：`9E3196F85DFDBF1473C122E4749D12B23CFB9E20A6A6779128E08A8280EC7FBC`
- **复核结论**：
  1. 确认六项核心要求均获得充分测试，用例设计具备高度区分度；
  2. 确认核心实现复用了已有 `OfferNutrition` 与 `ScaleNutrition` 路径，未编写第二套营养计算公式；
  3. 确认 `planner.cpp` 零修改；
  4. 明确指出测试限制：`01` 号用例中米饭基础数据均为偶数，缺乏产生 `.5` 小数的奇数案例以在结果层区分四舍五入与向下截断（但 C++ 核心源码层复用了经过单测验证的 `RoundHalfUp`）。

### 6.2 子代理 B：固定候选定向验证
- **报告归档路径**：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T04A04-反重力-Offer营养只读出口-证据-v1\agent-fixed-candidate-check\report.md`
- **报告 SHA256**：`98E1A79D31BDD2718B1A84BC5B012F23DFDBBF67CA40B9600AC187B3B9A86579`
- **验证结论**：**全部通过 (ALL PASS)**。
  1. 独立核实了原生 CLI、WASM 与生产核心源码哈希，与主执行员完全一致；
  2. 独立运行了 10 个测试用例与 3 个冒烟用例，达成 100% 逐字节完全匹配；
  3. 确认 C ABI 符号导出完备、内存申请释放生命周期无任何泄漏或越界。

### 6.3 分歧与共识
主执行员、子代理 A 与子代理 B 之间**无任何结论分歧**。

---

## 七、未运行项、限制说明与责任边界声明

依据提示词规范，如实说明当前边界及未运行项：

1. **当前小程序 WASM 严格未替换**：
   本次构建生成的 `mp_core.wasm` 仅保存在证据目录下作为独立隔离候选，**绝对未替换或覆盖 `miniprogram` 目录中的任何现有 WASM 产物**。
2. **前端接合未做**：
   小程序端的 JS 胶水层封装、Worker 消息收发改造、以及 DSH 自选菜界面的 UI 对接均未在本任务范围之内。
3. **后续责任归属**：
   **后续由 P01 另派前端接合任务（或由 DSH 承接）负责将隔离 WASM 接入小程序前端。**
4. **测试限制项**：
   - 微信开发者工具与真机环境未运行；
   - 极端多选拼接展开 ID 超长（超过 128 字符）未做极端压力测试；
   - 性能压力测试未运行（本卡为定向功能验证）。

---

## 八、交付结论

T04A04 Offer 营养只读出口已完备实现并经验证：
- 生产核心 `planner.cpp` 保持基线零改动；
- 契约文档与 10 项区分度测试用例完备；
- 隔离原生 CLI 与隔离 WASM 候选构建通过，并达成 100% 逐字节一致；
- 既有三大入口冒烟通过，老内存协议零破坏；
- 双子代理独立核查报告齐备，结论一致。

本单核心实施已完成并立即停止写入。

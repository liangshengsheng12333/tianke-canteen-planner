# T07a2｜反重力｜极小菜单 Oracle 补证｜交付反馈

- 日期：2026-10-23
- 执行提示词版本：v1（依据 `Resources/任务卡/T07a2-反重力-Oracle独立性与文案补证小卡-v1.md`）
- 反馈文件版本：v1
- 任务范围：
  1. 彻底断开目标值对 C++ 预跑响应的依赖：从原合成档案与营养配置出发，纯 Python 独立实现 Mifflin-St Jeor 整数定点公式计算 `targets.daily` 与 `mealReference`，并与 C++ CLI 计算结果逐字段核对；
  2. 保留极小菜单 Layer 1 单餐候选独立枚举（10/15/15）与 Layer 2 全天 2,250 组独立笛卡尔积穷举，使用独立 targets 求解 primary/economy/taste 最优方案，与 C++ DP/BnB 原始输出 100% 逐字段匹配，并验证 Greedy 近似特征；
  3. 审查核心公开接口对单餐候选的暴露能力，出具评估报告 `candidate_interface_assessment.md`，明确陈述“核心公开接口仅核数量、未核内容”，用全天 2,250 组合独立全局最优解客观界定覆盖边界；
  4. 截断 Flag 真实字段溯源与文案纠偏，出具分析报告 `flags_correction.md`，纠正原反馈中 `DISCRETIZED_SEARCH` 笔误，正本清源为 `ESTIMATED_DATA`、`APPROXIMATE_DISCRETIZATION`、`SEARCH_LIMIT_REACHED` 并给出精确技术解释；
  5. 在全新独立目录落盘全部独立脚本、输入、原始响应与核验断言结果。
- 输入/候选：
  - 任务卡：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\任务卡\T07a2-反重力-Oracle独立性与文案补证小卡-v1.md`
  - 查收报告依据：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T07a-P02-阶段查收与P01转交-20261023-v1.md`
  - 裁定报告依据：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T07a-P01-部分接收与双卡补证裁定-20261023-v1.md`
  - 隔离编译产物：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T07a-反重力-固定候选算法正确性与双端一致性-证据-v1\bin\mp_cli.exe`（372,224 B / SHA-256 `29D2165BD0E6BB23AE52DA443C7811F43DDC328271E64E25434345E4B43B905E`）
  - 原截断反例原始响应：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T07a-反重力-固定候选算法正确性与双端一致性-证据-v1\counterexamples\part1-dp-cap-2.response.json`（5,037 B / SHA-256 `2D21C2FD127AA56E23CC2B73FB12CFE1BA88887BF723F49C070E7B4C62744171`）
  - 固定候选身份：A11 WASM（107,472 B / `B53C7405...`）、core 19 项源码、75 项小程序源码、38 项工具脚本及 T03d 菜单（37,157 B / `0657E2B2...`）均保持逐字节只读，未发生漂移。
- P01 指定请求模型：Antigravity / Gemini 3.8
- 实际模型/版本/档位：
  平台界面显示 `Gemini 3.8 Flash (High)`；服务端实际子型号/内部版本/路由档位无法独立核实，按事实如实登记“服务端实际子型号/档位未知”。
- 交付文件：
  - 唯一反馈文件：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T07a2-反重力-Oracle补证-交付反馈-v1.md`
  - 独立证据目录：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T07a2-反重力-Oracle补证-证据-v1\`
    1. `run_two_layer_oracle_t07a2.py`（34,824 B / SHA-256 `8954692DB69747BB16E21C2CDBDF9C444544247063C16DA52CCF17A0E442B542`）
    2. `request_mini_t07a2.json`（9,151 B / SHA-256 `824F4D5A536AE69801BE7BA4ADEEFD0DEA0F115C46A6D5A2E2AD2C1EB9A32E9A`）
    3. `targets_verification.json`（3,465 B / SHA-256 `1C7CC723E528246C6205009A1953D82695E032CDEA5381388DA5ED0AF5DFC204`）
    4. `request_dp.json`（9,151 B / SHA-256 `824F4D5A536AE69801BE7BA4ADEEFD0DEA0F115C46A6D5A2E2AD2C1EB9A32E9A`）
    5. `response_dp.json`（9,427 B / SHA-256 `8F6DDD4C6150D2A7F53A5E1458760CF9443C5F46992DBCAB4E3F93958D1E111D`）
    6. `request_branchAndBound.json`（9,163 B / SHA-256 `C877089F0663DB6BBB81B823AEC3BB8E3AE158E4C97F65402E3B1F2C9459AC4C`）
    7. `response_branchAndBound.json`（9,439 B / SHA-256 `5CC18243560C8555AD2B65F737EE4F6A6251B5998B9C2A9FE23646AB72E7D838`）
    8. `request_greedy.json`（9,155 B / SHA-256 `D9FDAA313542EC52A62D33B4F00E637B87E975F52B8D5D4AC69A091DA68D0764`）
    9. `response_greedy.json`（9,747 B / SHA-256 `79644AAA6ED0825166CBAE22680039DC1811018080A64C95BBE0EA5949485018`）
    10. `oracle_verification.json`（4,251 B / SHA-256 `B13CD144AFE73DCD58F77BA8CF5EC7029674561FA2E1CAFD3AFC81CD1B529548`）
    11. `candidate_interface_assessment.md`（6,015 B / SHA-256 `BC6CB08C371837B95FDA9CA6DD3193CE3B7DA0976B5D3E282B4769FDC31B42C9`）
    12. `flags_correction.md`（4,320 B / SHA-256 `B2EC9BFA161374E17114654EFA583B01F673BE44A1E8B7B4AFC7A6AFBE31EA85`）
    13. `README.md`（4,196 B / SHA-256 `9619F81B0BB09574585F71D4CD330563737DC6BC079D8EE61793C78A02FD5232`）
  - 未交付项：无。

---

## 运行与验证过程及详细结果

### 1. 营养目标纯独立计算与核心 100% 核对（摆脱依赖）
- **独立实现**：在 `run_two_layer_oracle_t07a2.py` 中，纯 Python 原生实现 Mifflin-St Jeor 全整数定点运算：
  - 输入：男性、22 岁、1750 mm、68000 g、中度活动量（1550）、减脂目标（赤字 10% 封顶 300 kcal）、正常蛋白质偏好（1200 mg/kg）、脂肪热量占比 270 permille、餐次比例（早 300 / 午 400 / 晚 300 permille）；
  - 计算链：
    - $REE = 10 \times 68000 + 625 \times 1750 - 5000 \times 22 + 5000 = 1,668,750 \text{ mkcal}$；
    - $TDEE = \text{RoundHalfUp}(1668750 \times 1550, 1000) = 2,586,563 \text{ mkcal}$；
    - 减脂赤字：$2,586,563 \times 10\% = 258,656 \text{ mkcal} \le 300,000 \text{ mkcal}$，实取 $258,656 \text{ mkcal}$；
    - 每日总能量：$\text{RoundHalfUp}(2586563 - 258656, 1000) = 2,328 \text{ kcal}$；
    - 蛋白质分克：$\text{RoundHalfUp}(1200 \times 68000, 100000) = 816 \text{ dg}$（$81.6 \text{ g}$）；
    - 脂肪能量与分克：$2328 \times 270 / 1000 = 629 \text{ kcal}$，$\text{RoundHalfUp}(629 \times 10, 9) = 699 \text{ dg}$（$69.9 \text{ g}$）；
    - 碳水能量与分克：$2328 - 326 - 629 = 1373 \text{ kcal}$，$\text{RoundHalfUp}(1373 \times 10, 4) = 3433 \text{ dg}$（$343.3 \text{ g}$）；
- **逐字段核对**：
  运行 C++ CLI 获取核心计算的 `result.targets`，逐项核验 `daily`（4项）和 `mealReference`（12项）：
  - `daily`: `energyKcal: 2328`, `proteinDg: 816`, `fatDg: 699`, `carbDg: 3433` -> **100% 匹配**；
  - `mealReference.breakfast`: `energyKcal: 698`, `proteinDg: 245`, `fatDg: 210`, `carbDg: 1030` -> **100% 匹配**；
  - `mealReference.lunch`: `energyKcal: 931`, `proteinDg: 326`, `fatDg: 280`, `carbDg: 1373` -> **100% 匹配**；
  - `mealReference.dinner`: `energyKcal: 698`, `proteinDg: 245`, `fatDg: 210`, `carbDg: 1030` -> **100% 匹配**；
  - 核对记录已持久化至 `targets_verification.json`，证明核心目标计算完全符合规范，且 Oracle 独立性 100% 达成。

### 2. 两层 Oracle 独立穷举与 DP/BnB 算法 100% 吻合
- **Layer 1 单餐候选枚举**：
  - 极小菜单（2窗口、5菜品、1规则套餐含米饭互斥）；
  - 独立枚举结果：早餐 10、午餐 15、晚餐 15；
  - C++ 核心公开响应 `result.search.candidatesEnumerated`：早餐 10、午餐 15、晚餐 15 -> **一致性 PASS**。
- **Layer 2 全天笛卡尔积穷举与多目标求解**：
  - 状态空间：$10 \times 15 \times 15 = 2,250$ 组三餐组合；
  - 预算硬约束：总价 $\le 3500$ 分；
  - 使用独立计算的 `targets.daily` 计算营养偏差，并按 T01 v1.2 §10 词典序多目标比较器独立求解理论全局最优：
    - `primary`: planKey `plan:1bd4af957d9d3a83dae870be9ac01ee679cb3234354c624688dba9eeab72eb69`，偏差 3163 bp，总价 3400 分，口味分 2
    - `economy`: planKey `plan:4f2681a071ee640a48b43796eaed247c2681555526d097d5edecc8c7be31cb79`，偏差 3517 bp，总价 2900 分，口味分 2
    - `taste`: planKey `plan:051bac31ac92849cb1a904b193f90105ac4be327668ac4dcebad09fe871face5`，偏差 3984 bp，总价 3500 分，口味分 3
- **核心 DP 与 BranchAndBound 对拍**：
  - DP 运行结果：
    - `primary`: planKey 匹配、偏差 3163 bp 匹配、价格 3400 分匹配 -> **PASS**
    - `economy`: planKey 匹配、偏差 3517 bp 匹配、价格 2900 分匹配 -> **PASS**
    - `taste`: planKey 匹配、偏差 3984 bp 匹配、价格 3500 分匹配 -> **PASS**
  - BranchAndBound 运行结果：
    - `primary`: planKey 匹配、偏差 3163 bp 匹配、价格 3400 分匹配 -> **PASS**
    - `economy`: planKey 匹配、偏差 3517 bp 匹配、价格 2900 分匹配 -> **PASS**
    - `taste`: planKey 匹配、偏差 3984 bp 匹配、价格 3500 分匹配 -> **PASS**
- **Greedy 算法近似特征核查**：
  - `searchComplete: false`（如实标记未完全穷举，PASS）；
  - `approximations`: 明确包含 `APPROXIMATE_CANDIDATES`（PASS）；
  - 预算合法性：满足硬约束无越界（PASS）。

### 3. 单餐候选公开接口能力界定与算法边界陈述
- **接口审查结论**：审查 `core/include/mp/api.h`、`core/cli/main.cpp` 及 JSON 契约，核心公开接口仅返回 `candidatesEnumerated: { breakfast: 10, lunch: 15, dinner: 15 }` 计数及 `mealOutcomes[].candidateCount` 标量，**从未在公开契约中暴露单餐候选集合明细**；
- **边界声明规范**：明确声明“**核心公开接口仅核数量、未核内容**”，在所有证据与结论中杜绝虚夸；
- **算法覆盖边界**：由于全天 2,250 组独立笛卡尔积单餐组合在独立多目标比较器下求解出的 primary/economy/taste 最优方案（含具体的菜品项、份量、价格、营养），与 C++ DP 及 BnB 算法 100% 吻合，这从端到端层面强力证明了核心生成的候选组合集合及其属性在最优决策路径上的完全正确性。专职评估报告见 `candidate_interface_assessment.md`。

### 4. 截断 Flag 真实字段纠偏分析与正本清源
- **溯源确认**：核对原 T07a `part1-dp-cap-2.response.json` 原始响应，方案实际 `flags` 为 `["ESTIMATED_DATA", "APPROXIMATE_DISCRETIZATION", "SEARCH_LIMIT_REACHED"]`；
- **笔误勘误**：原 T07a 交付反馈正文及 counterexamples README 中将量化截断行为概括写成了 `DISCRETIZED_SEARCH`，属于文本笔误，契约中并无该枚举项；
- **技术解释与纠偏**：
  - `ESTIMATED_DATA`: 菜品营养包含估算标记；
  - `APPROXIMATE_DISCRETIZATION`: DP 状态空间离散化步长量化近似；
  - `SEARCH_LIMIT_REACHED`: 触碰 `maxDpStates=2` 状态数上限发生搜索截断，对应 `searchComplete=false`；
  - 本交付反馈全面纠正文字口径，并保持原 T07a 历史证据只读不改写。专职说明见 `flags_correction.md`。

---

## 未完成 / 阻塞事项

- **未完成事项**：无。
- **阻塞事项**：无。
- **后续规划说明**：根据项目总控流程，正式性能基准测试由 T07b 另排派单；本卡专注于 Oracle 独立性与文案补证，不包含性能测量与真机测试。

---

## 交付状态

- **状态：完成**。
- **范围边界**：已彻底解决目标值依赖、明确单餐候选接口核对边界、纠正截断 flags 真实字段，全部独立脚本、输入、原始响应与核验断言文件均已落盘至全新目录 `Resources/报告/T07a2-反重力-Oracle补证-证据-v1/`，生产代码与历史证据保持零修改只读，随时接受 P02 与 P01 查收裁定。

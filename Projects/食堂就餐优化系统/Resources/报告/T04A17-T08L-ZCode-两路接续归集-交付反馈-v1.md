# T04A17 + T08L｜ZCode GLM5.3｜两子代理接续 · 归集总反馈 v1

| 项 | 内容 |
|---|---|
| 总任务卡 | `Resources/任务卡/T04A17-T08L-ZCode-两子代理接续总转交卡-v1.md` |
| 主窗口 | ZCode GLM 主窗口（归集者，未写生产、未自行推广、未汇合两路产物） |
| 请求模型 / 实际 | 主窗口与两名子代理均请求 GLM5.3；实际客户端标识均为 `account:zai-start-plan/GLM-5.3-Flash`；**服务端路由/档位未知**，不把请求配置写成实际证明 |
| 固定输入 | T06d `sha256:2871b4cad6cf801eeb27291c9eb291b3227d0adcf4c6a3270d40e9e34b3441a1`（两路各自实算复核一致）；A16 冻结内存补丁 `patches/memory-lifetime.patch` 12841 B / SHA256 `62829b23d484071e00b0b4f96a26e4d853871f5084c2ac0e8e02afbafa15f41e`（主窗口派发前实算核对一致） |
| 派发方式 | 两名子代理独立副本**实际并行运行**（A17 构建验证 + T08L 小修，无 GUI 占用冲突）；A17 正式计时按卡注明非独占机器与另一代理轻量检查并存的并发条件 |
| 状态 | **两路完成交付**：A17 新 native + 新 WASM 32 位实际生成并全部对拍通过（A16 的"新 WASM 未产出"阻塞闭合）；T08L 小补丁 26/26 通过。均为**验证/小修交付**，待 P01 收齐 A18 真时限证据后另指定单写入者汇合，本轮不推广 |

---

## 1. 两路子反馈索引

| 路 | 唯一反馈 | 证据目录 | 一句话状态 |
|---|---|---|---|
| T04A17 构建验证 | `Resources/报告/T04A17-ZCode-Sol内存候选WASM构建验证-交付反馈-v1.md` | `T04A17-ZCode-内存候选构建验证-证据-v1/` | memory-only 源新 native（4 目标/252 单测）与新 WASM 32 位实际生成；211 断言+137 planKey 复算全过；BnB 新 WASM 线性内存 1000→200000 节点恒定 38 页 |
| T08L 提示小修 | `Resources/报告/T08L-ZCode-改记超限提示小修-交付反馈-v1.md` | `T08L-ZCode-改记提示-证据-v1/` | editLog 两处超限文案统一为 confirmMeal 同口径（仅 2 行字符串），26/26 断言通过，副本+981B 补丁待合入 |

## 2. 源与产物哈希（归集）

**T04A17（构建路）**

| 对象 | 大小 | SHA256 |
|---|---:|---|
| 构建源 planner.cpp（2871 基线 `c90e9867…` 217345 B + memory-lifetime.patch） | 219886 B | `98790029baf43c680b1b04201485252363ffc89f037cd63a38552c863c55351e` |
| **新 WASM 32 位**（本卡核心交付） | 109086 B | `14abef2e1f5107d32b8be0613cbc543af2998cd41cbf529c608dd36c5570815d` |
| 新 native mp_cli.exe | 374784 B | `c558b5470c7ea57c3a11255e7ea9b78b81d91d967e6197f02dbe4902bab3abab` |
| 新 native 三个测试可执行（sha256/json/core） | — | 见 A17 反馈 §2（57c2c2eb…/305a25b5…/84cb95da…） |

新 WASM 魔数/版本校验通过、imports=[]（无新增 ABI）、较基线 304FED66…（107936 B）+1150 B 属补丁代码增量；stage 独占名 `t04a17_memory_candidate.wasm`，未覆盖既有 mp_core.wasm 或 A15/A18 stage。

**T08L（小修路）**

| 对象 | 大小 | SHA256 |
|---|---:|---|
| 小补丁（相对 2871 基线） | 981 B | `21870e4cb36449b764accfb80d23c2c14e26dae96b058bcff55b04a05d757030` |
| 改动后 store.ts（基线 107141 B/`1c1433e5…` +80） | 107221 B | `76137dfef8bdf52dc370a17f8f617a33fc3de3fb54e59e52e7467f1feaee2378` |

改动后副本源码树摘要 `sha256:1152972c9f51c97f26ab44aefae3825c9e7db87b81518d43e91dd93371d91858`（75 文件/1004700 B，恰 +80；WASM 未触碰仍 304FED66…）——合入后生产树身份属预期变化，由 P01 单人执行。

## 3. 已完成（去重归集）

1. **A16 阻塞闭合**：A16 阶段"新 WASM 未产出"的阻塞在本轮闭合——memory-only 源的新 native 与新 WASM 32 位均为本卡实际构建（非旧 WASM 充数），源清单/编译命令/日志齐备。
2. **正确性保持**：节点 1000/10000/50000/200000 四档新 native/新 WASM 逐字节对拍一致；六窗口 46/186/186、三策略、planKey/评分/近似字段与 T06d 批准 WASM 存证逐字段一致；BnB 200000 仍 nodesEvaluated=200000、capsHit observed=200001、SEARCH_LIMIT_REACHED（节点数/评分/K 未改）；A16 聚焦用例（legacy 5×2、contract 4×2）与独立极小穷举全部指向新产物复验通过。
3. **内存结论（量级）**：BnB 新 WASM 线性内存 1000→200000 节点**恒定 2490368 B（38 页）**，对照批准基线同点 363986944 B（≈347 MiB，T06d 存证沿用）——A16 的 native 生命周期结论在 32 位 WASM 上成立。greedy 42 页、DP32 158 页均恒定。属诊断量级，**不作最终真机/正式性能结论**（计时非独占机器，条件已在 A17 反馈 §4 如实记录）。
4. **T08L 最小小修**：editLog 两处超限拒绝文案统一（指明 ￥1,000,000 上限，与 confirmMeal/self-pick 现有后缀逐字同口径）；拒绝/零写入行为与 0 元/未知语义回归不变（26/26，含超限零写入、边界值合法、confirmMeal 文案未动、MAX_MONEY_CENTS/isValidMoney 未动的源级断言）。

## 4. 重要发现（如实上报）

- **A16 candidate/core 实际含双补丁**：A16 反馈称"仅 planner.cpp 变化（仅内存改动）"，但 A17 实测其 candidate/core planner.cpp（220036 B/`578c09df…`）含 `INVALID_INPUT … wallClockMs` 守卫，且 memory-only + wallclock-reject-policy 逐字节复现该身份——**A16 candidate 的"仅内存改动"表述应按合并补丁理解**。A17 构建源为纯 memory-only（`98790029…`），与 A16 candidate 区分。此发现影响后续合入时对 A16 产物的引用口径，留 P01 审查裁定。

## 5. 受阻 / 未测（不伪报）

- **非空 wallClockMs 缺口仍开放**：新 WASM 行为记录显示 wallClockMs=1000 的 DP 请求被接受但无真实时限生效（ok=true 完整返回）——"非空墙钟被接受但不限时"的需求缺口未闭合，由 A18 真时限任务解决；本轮未采纳未批准的拒绝政策，未改契约/ABI。**核心最终完成与否待 A18 交付后由 P01 统一审查裁定。**
- native Arena 未测（本卡未构建 mp_bench/api-trace 探针）；native 进程工作集数不充当 WASM 内存数。
- DP 仅覆盖六窗 DP32 与 oracle DP20000 请求，未跑更大 DP 规模；未重跑 200000 节点批准基线 WASM（沿用 T06d 存证，避免多进程大内存重放）。
- T08L：微信开发者工具 UI 与真机未测（按卡 Node+mock wx 口径）；页面解析层负数预检文案（J01 观察 1）不在范围；`addManualLog`（store.ts:1088）旧文案**有意未动**——是否一并统一留 P01 裁定（改动后源内旧文案仅剩此 1 处）。

## 6. 纪律与边界

- 两路只写各自证据目录与唯一反馈；T06d candidate、A15/A16/A18 目录、生产树、共享契约、MEMORY 均零改动；未清缓存、未改 ACL、未覆盖旧证据；stage 文件独占命名。
- 本轮仅验证/小修交付：**不自行推广、不汇合**；P01 收齐核心时限（A18）与构建证据后另指定单写入者统一汇合内存候选与小修，再进入集中验证。
- 不要求用户补拍，未动 PPT。聊天按卡只回本反馈路径和一句状态。

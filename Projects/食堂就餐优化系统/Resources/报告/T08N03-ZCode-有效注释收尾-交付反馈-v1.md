# T08N03｜ZCode GLM5.3｜有效注释收尾｜交付反馈 v1

- 日期：2026-10-25。绝对 cwd：`D:\项目\cpp\Projects\食堂就餐优化系统`
- 执行者：T08N 子代理 N03。**请求模型 GLM5.3；实际运行 GLM-5.3-Flash（ZCode CLI 子代理，客户端标识 `account:zai-start-plan/GLM-5.3-Flash`）；服务端 reasoning 档位不可从本会话核实，档位未知。**
- 依据卡：`Resources/任务卡/T08N-ZCode-四子代理最终收尾总卡-v1.md`、`Resources/任务卡/T08N03-ZCode-有效注释收尾小卡-v1.md`（唯一范围）。已实读：项目 `AGENTS.md`、P01 裁定 `T08M-P01-接收裁定与收尾顺序-20261025-v1.md`（注释率段）、`T08M03-ZCode-交付材料核对-交付反馈-v1.md` 及其证据（口径 B 脚本/原表/排除样本）。
- 结论一句话：**语义清理已完成——删除 1,865 行模板注释、补 214 行实质注释，全部 16 个文件 diff 逐行验证为仅注释，去注释后代码与合成基线逐字节一致（23,091 行，强于 token 一致）；最终有效注释率 C++ 8.69%、TS 16.31%、合计 12.47%，低于 20% 冻结口径，差距如实列出，未凑行。**

## 1. 输入与合成基线身份（逐项核验）

| 项 | 值 | 核验方式 |
|---|---|---|
| 固定输入 | T06e candidate（`Resources/报告/T06e-ZCode-最终核心汇合-证据-v2/candidate`，manifest 97c8085c…39b13123） | 开工 diff 全树比对 |
| N02 路副本 | `T08N02-ZCode-计划项锁定字段-证据-v1/workcopy`：planner.cpp = `c883b15d…a04f1`（97 逐字节复现 + locked 4 行插入），其余与 97 一致 | sha256 实算 + 全树 diff 仅 planner.cpp 一文件差异 |
| N01 路副本 | `T08N01-ZCode-备份摘要文案-证据-v1/candidate-copy`：backup.ts = `b07c87ad…ab7217`（模拟菜单→内置菜单），其 miniprogram/src 与 97 逐字节一致（除 backup.ts） | sha256 实算 + src 全目录 diff |
| N02 backup.ts 与 97 原版逐字节一致 | `f134fc8c…a74581` = 97 清单值 | sha256 实算 |
| **合成基线（本路起点）** | N02 核心 + N01 backup.ts；对 T06e candidate 全树 diff 仅 2 文件（planner.cpp、backup.ts）；miniprogram/src+tools/miniprogram manifest 复算 = `sha256:d5373bb5…6980e4`（与 N01 报告 §5.6 声明的继承标识一致） | `proof-baseline/` 快照 + `identity-baseline-synthesis.json/manifest.json` |
| 合成后改前快照 | `proof-baseline/`（证据目录内，供 P01 复算） | 见 §6 |

## 2. 实际操作（均在本路证据目录内）

1. 合成工作副本 `workcopy/`（N02 workcopy 复制 + N01 backup.ts 覆盖），逐项核验（§1）。
2. 字符串感知注释分析器 `analyze_comments.py`：口径 = M03 口径 B 行规则 + 字符串/字符/模板串感知修正；对合成基线复算与 M03 官方脚本逐文件吻合（C++ 2587/10708=24.16%、TS 1718/10557=16.27%，差额即 N02 补丁 2+2 行），以此取得可信基线。
3. 逐文件人工审查注释（planner/json/nutrition/catalog/base/contract/sha256/api/platform×2/cli/tests 14 个 C++ 文件 + TS 抽样全查），按模板类别删除、按小卡主题清单补写。
4. 字节级行编辑驱动 `apply_edits.py`（行级锚点必须唯一否则退出；保留混合行尾；应用后置 done 防重复）。期间发生两次重复应用，均通过从 N02 基线整文件恢复后单次重放纠正；最终状态经计数与 diff 复核为恰好一次应用。
5. planner.cpp 第二轮补强（ParseTastes/WriteMacrosJson/WriteIncompleteNutrients/WriteCanonicalSearchBlock 4 处）与 plan.ts requestId 注释修正，均为独立小脚本单次应用。
6. **过程事故（如实记录）**：两条新增注释中的 `'\0'` 被 Python 转义规则解释为真实 NUL 字节写入 api.cpp 与 test_core_main.cpp；经 diff 报"binary files differ"发现，定位后改为两字符转义 `\0` 重写，并对全部 16 个改动文件复扫 NUL/U+FFFD 均为 0（`json.cpp` 的 `\u00XX` 转义同样核验为字面文本）。最终 diff 与证明均基于修复后状态。
7. 验证：全量 diff 仅注释核验、令牌一致性证明、最终计数、manifest 复算、生产目录哈希核对。
8. 未跑构建/测试（按卡由主窗口集成时统一执行）。

## 3. 仅注释 patch（相对合成基线的完整 diff）

- 完整 diff：`n03-comments-only.diff`（8,795 行，+214/−1,865，SHA256 `2097592d…856f79`）。
- **仅注释验证**：diff 全部 `+`/`−` 行均匹配 `^[+-] *(//|/\*|\*)`，非注释变更行 = **0**（16 文件逐一核验，另见各文件独立 diff 复核记录于反馈生成过程）。
- 改动范围：C++ 14 文件（core/src×10、core/cli/main.cpp、core/tests×3）+ TS 2 文件（`miniprogram/src/domain/types.ts`、`plan.ts`）。**TS 其余 32 文件零改动**——逐文件抽样审查未发现 C++ 式模板注释（TS 注释以 JSDoc 实义说明为主），如实不改。
- 删除明细：`removed-template-stats.tsv`（逐文件逐类别）、`removed-template-samples.md`（每类样本）；完整行级清单即 diff 本身（含行号）。

## 4. 语义剔除规则与实质性说明

**剔除规则（对齐 P01 裁定例举）**：整行注释若只复述 if/for 条件（“分支守卫：当满足…”）、循环推进（“循环推进与边界守卫…”、“确定性顺序遍历循环…”）、WriteKey/JsonFind/RequireMember/ctx.Fail 等单调用动作（“序列化输出契约字段 X”、“在当前 JSON 对象中按字段名…”、“契约必填字段提取…”、“触发契约错误短路返回…”）、无针对性的函数三件套（“函数实现/参数签名/执行语义：按契约规范校验…”）、跨行声明+前置/后置模板、逐结构雷同的“数据结构定义/所有成员均采用…”、逐断言复述（“单元测试断言核查…”）与逐字段 DOM 构造复述（“向测试 DOM 对象追加字段…”）——一律删除。保留：模块说明/工程约束头、测试章节标题、案例级测试说明、全部实义注释。空标记/纯分隔行不计有效（口径 B 既有规则）。

**补写主题（小卡清单逐项落位，示例见 `抽核记录-关键注释与证据对照.md`）**：

| 主题 | 定位（文件:函数） |
|---|---|
| 单位/整数舍入 | nutrition.cpp ComputeEnergyChain（REE mkcal 公式与性别项）、ComputeMacrosFromEnergy（4/9/4 kcal/g→dg）、ComputeComposition（交叉相乘防边界误差）、WriteMacros（kcal/dg）、json.cpp ParseNumber（仅 i64 整数模型）、planner.cpp WriteNutritionKnown（null=未知≠0） |
| 未知与 0 | planner.cpp ParseIntakeSummary 三处（未知价/整条缺失/单分量 null）、catalog.cpp ScaleNutrition、json.cpp JsonFind/JsonSerializeCanonicalExcluding |
| 预算/锁定/套餐不变量 | planner.cpp EvaluateFullDayPlan（overBudget 含价格不完整）、RunGreedyAlgorithm（能量占比拆分整数截断）、EnumerateMealCandidates（LockConflict≠NoFeasible、quantity 展开）、WritePlanJson（known_only 口径、状态分界 Ok/OkPartial/NoFeasibleWithinBudget） |
| 候选覆盖 | planner.cpp RecurseMealOfferSubsets（observedBeforeCap）、CollectWindowEligibleOffers（静态+展开合并遍历）、节点预算口径 |
| DP 状态/支配/截断近似 | planner.cpp DpState 结构、桶化块（整除桶键/代表元/截断、无全局误差上界）、RunDpAlgorithm（searchComplete 语义） |
| BnB 乐观界 | planner.cpp BnBSearchEnv、RecurseBranchAndBound、RunBranchAndBoundAlgorithm（引用文件头既有定理，不新增断言） |
| 时限区间/超调局限 | planner.cpp SearchTracker::Stop（协作式检查点超调、时钟回退=内部错误） |
| 内存所有权 | planner.cpp 模块头第 5 条（Arena 统一分配）、json.cpp JsonParse、base.cpp TextBuffer::Reserve、platform_wasm.cpp BlockHeader/RawFree（地址不复用+整体回收）、api.cpp BuildResultBlock（结果块协议与 mp_free 恰好一次）、cli/main.cpp main、tests CallApi |
| 请求版本/导入原子性 | types.ts（contractVersion 字面量钉死）、plan.ts（requestId 仅回显不去重）；导入原子性由 backup.ts 既有注释完整覆盖，未重复添加 |

## 5. 令牌一致性证明

- 方法：本路全部改动均为整行注释增删改（§3 已证 diff 0 非注释行），故「基线去掉整行注释（含纯分隔）后的剩余行」与「改后同样处理后」逐字节相同——这是强于“去注释后 token 一致”的证明。
- 工具：`prove_token_identity.py`（复用字符串感知分析器，//、/* */、".."、'..'、模板串含 `${}` 均感知，不会误删字符串内容）；本仓库 src 中无以 `/` 开头且与注释歧义的正则字面量（如需可由主窗口以构建复核）。
- 结果：`token-identity-proof.txt` —— **cpp+ts 去注释后共 23,091 行，mismatches = 0，PASS**。
- 旁证：`identity-final-workcopy.json/manifest.json`（miniprogram/src 侧 digest `sha256:3d9462ca…a68621`，75 文件/1,009,455B；冻结 WASM 111,521B/8A817926… 未动，frozenWasmMatches=true）。

## 6. 最终计数（分语言，逐文件表见 final-count-*.tsv，基线对照表见 baseline-count-*.tsv）

| 语言 | 有效注释行 | 代码行（非空非注释） | 基线有效（口径B） | 基线率 | **最终率** |
|---|---|---|---|---|---|
| C++（core/src+include/mp+tests+cli） | 930 | 10,708 | 2,587 | 24.16% | **8.69%** |
| TS（miniprogram/src，排除 types.d.ts/config/ mock/ 数据文件） | 1,722 | 10,557 | 1,718 | 16.27% | **16.31%** |
| **合计** | **2,652** | **21,265** | 4,305 | 20.25% | **12.47%** |

计数规则重申：分子=整行有效注释（剔除纯分隔/空标记；行尾注释不计分子；本路语义剔除的模板行已物理删除，故 srem=0）；分母=非空非整行注释行（含行尾注释行与纯字符串行）；空行不计两侧。TS 排除表沿用 M03 冻结口径（`types.d.ts`、`config/`、`mock/` 为数据文件，明细见 §8）。

## 7. 与 20% 冻结口径的差距（如实列出）

**最终合计 12.47% < 20%，未达标。** 原因与说明：

1. M03 的 20.2% 中约 1,865 行（8.8 个百分点）为模板复述，按 P01 裁定剔除后基线即回落至约 11.5%；本路补写的 214 行（+1.0 个百分点）均为小卡主题内的实证内容。
2. 达到 20% 需再补约 1,600 行。本路逐文件审查后的判断：在“不逐行翻译代码、不复制模板、不声称未证明结论”的硬约束下，剩余可写的真实内容不足以诚实填满该缺口；继续凑行即违反小卡“不能为过线造注释”。故按卡如实报告缺口，**由 P01/用户裁定**：接受语义干净口径的新基线，或另开专卡为高语义密度文件（planner/nutrition/catalog，当前 9.0%/5.5%/5.3%）做增量文档化。
3. 未凑行的自证：TS 侧 32 个文件零改动（无模板可剔、补写点已有实义注释）；C++ 每处新增均落入 §4 主题且经抽核（§8）。

## 8. 排除表与范围

- C++ 范围：`core/src/*.cpp`、`core/include/mp/*.h`、`core/tests/*.cpp`、`core/cli/main.cpp`（与 M03 冻结 A09 口径一致）。
- TS 范围：`miniprogram/src/**/*.ts`，排除 `types.d.ts`（仅 7 行环境声明）、`config/`（west1-menu.ts 3,282 代码行为菜单数据、simulated-menu.ts、nutrition-config.ts）、`mock/`（simulated-inputs.ts 夹具数据）——对齐 M03 冻结排除清单，非本路新增裁量。
- 未动：生产目录（core/、miniprogram/、tools/、项目根；生产 planner.cpp=109555b9、backup.ts=f134fc8c 均为 97 冻结值，实算核验）、旧证据、MEMORY、共享契约、PPT；未删除任何目录、未改 ACL。

## 9. 人工抽核结果

`抽核记录-关键注释与证据对照.md`：7 组关键注释（时限/未知与0/locked快照/DP桶化/BnB不冒充最优/预算known_only/请求版本与requestId）逐条对照代码与 M01、N02 冻结证据，全部一致；抽核中修正 1 处未经证实推断（plan.ts requestId 幂等性表述，已改为可证事实）。本路注释不声称零泄漏、全局最优或契约整体通过。

## 10. 未完成项 / 边界（不伪报）

- **20% 冻结口径未达标（12.47%）**，处置待 P01/用户裁定（§7）。
- 构建、单测、双端对拍、泄漏检测均未执行（按卡归主窗口集成）；本路改动后代码令牌与基线一致，算法语义无漂移风险，但正式验证以主窗口新产物为准。
- `workcopy/build/` 内的 mp_cli.exe 等为 N02 副本带来的**陈旧构建产物**（对应改前源码），仅随副本继承、本路未使用未重建；主窗口集成时请以新源码重新构建，勿复用。
- TS 32 文件零改动是审查后的判断；如 P01 要求对 TS 也做逐行语义审查，属增量工作。
- 实际模型档位未知（§0）；本路未写 MEMORY（不在写入边界）。

## 11. 证据目录索引（`Resources/报告/T08N03-ZCode-有效注释收尾-证据-v1/`）

| 项 | 路径 |
|---|---|
| 工作副本（改后源码） | `workcopy/` |
| 合成基线快照（N02+N01，供复算） | `proof-baseline/` |
| 完整仅注释 diff | `n03-comments-only.diff` |
| 令牌一致性证明 | `prove_token_identity.py`、`token-identity-proof.txt` |
| 计数脚本与逐文件表 | `analyze_comments.py`、`final-count-cpp.tsv`、`final-count-ts.tsv`、`baseline-count-cpp.tsv`、`baseline-count-ts.tsv` |
| 模板剔除明细/样本 | `removed-template-stats.tsv`、`removed-template-samples.md`（完整行级=diff） |
| 编辑驱动（可复算全过程） | `apply_edits.py` |
| 身份固定 | `identity-baseline-synthesis.json/`、`identity-final-workcopy.json/`（manifest 工具复算输出） |
| 人工抽核 | `抽核记录-关键注释与证据对照.md` |

完成后停写。生产、旧证据、MEMORY、共享契约零改动。

# T04A10｜策略排序与剪枝一致性反馈 v1

2026-10-22，Asia/Shanghai。内部算法专项 `/root/core_pruning_research`。**生产严格只读；补丁只在本卡证据目录，不代表已合入或验收。**

## 1. 结论

额外的同 tier 原始偏差尾比较**会改变合法输入的最终结果**，与冻结 T01 v1.2 / 继承 v1.1 的 economy、taste 排序不符。

本卡已构造一餐两候选的最小最终排序反例，以及两餐 2×1 组合的最小非叶 BnB 剪枝反例；两种策略分别实测。结果为：

- 基线三算法在两窗口反例中都返回偏差 0、planKey 较大的方案；冻结规则要求同 tier、其他分数相同时返回偏差 1、planKey 较小的方案。
- **只删终端比较器的两处尾比较不够。** 隔离中间变体的 DP 已对齐，BnB 仍在非叶节点用原始偏差错剪，返回与新版终端比较器不一致的结果。
- 最小完整补丁只删除 **10 行**：终端比较器 economy/taste 的两个四行尾比较块，以及 BnB economy/taste 各一个偏差尾剪枝语句。隔离补丁后三算法在上述双窗口极小例中均与独立冻结排序枚举一致。
- primary 的最终偏差排序和偏差剪枝保持原样；economy 的跨 tier 正常剪枝仍发生。DP 精确支配和 DP 启发式无需为本次排序问题修改。

实际函数名是 `IsPlanBetterForStrategy` 与 `CanPruneForStrategy`；任务卡中的 `IsBetterPlan` / `ShouldPruneBnB` 对应这两个函数，本卡没有重命名。

## 2. 依据、身份与隔离范围

请求配置沿用 **gpt-6.1-sol / high**。可核实的是本卡派单请求和内部身份；实际服务端路由、实际推理档位及额度无独立回执，均为**未知**。默认 cwd=`D:\项目\cpp`，项目根=`D:\项目\cpp\Projects\食堂就餐优化系统`。

实读/复用项目 AGENTS、当前 MEMORY 索引、冻结 T01 v1.2 第 10 节及 v1.1 继承条款；A01 排序诊断、A02 频次修复和 A03 价格状态实际反馈沿用本代理此前实读的材料。本卡不改变产品排序。冻结顺序为：

| 策略 | 共同预算/营养完整性前序之后的排序 |
|---|---|
| primary | 原始偏差↑ → 多样性 → 口味↓ → 价格↑ → planKey↑ |
| economy | tier↑ → 价格↑ → 多样性 → 口味↓ → planKey↑ |
| taste | tier↑ → 口味↓ → 多样性 → 价格↑ → planKey↑ |

多样性继续使用现有覆盖数、重复对数、未知类别数顺序；价格继续使用完整性再已知总价。两份冻结契约都没有在 economy/taste 的 planKey 前插入原始偏差。

核心同时可能由 A04 写入，所以本卡复制所需核心实现、头文件、CLI 和既有原生构建脚本共 **19 个文件**到专属 `baseline/`；逐文件复制前/副本/复制后的 SHA256 相同，台账见 `source-identity.json`。所有实验都编译此固定副本及它的两个隔离变体，不调用正在变化的生产文件，不把 A04 状态或其 API 工作当作本卡已验收。

| 变体 | planner.cpp SHA256 | 原生 CLI SHA256 |
|---|---|---|
| baseline，完整固定参考 | `417E753207D49700DFE8FE0AD7B010BA178E953E72ED4743FE33149E76582AC0` | `FC4435DC1817F394953D1A1D651B60CB01D268CA96ABA8E5CA9117FD4CCD577C` |
| compare-only，仅删终端尾比较 | `8EF677B603DD1FD1BD990BFC14513EB747813EF298680CD721B20033C0A7995F` | `91094A8D477530A90124E8AD82918F8A0F10398ACC03A0080A3EB802752ADFDB` |
| aligned，同时对齐终端和剪枝 | `216BF1CF75971FD708F85E5C726BE5C981EDE0DE5533FB53F23E4E5045BFCE7B` | `5879EB67205C0B06C5CB230C39051A3AB5193AA21F5FD92C646B8FEA5AD5BF26` |

三份 CLI 都在本卡目录内从相应副本构建，**各 exit=0、warnings=0、errors=0**。其他 18 个捕获文件在 baseline/aligned 间逐字节一致，没有夹带其他生产修复。原生程序不引用生产源码的后续变更。

## 3. 独立最小反例

### 3.1 一餐两候选：直接改变最终结果

合法合成请求，全天目标由固定 Profile/nutritionConfig 正式计算为 `(2370,840,711,3485)`；只规划午餐，两个供应午餐的窗口各一个候选。`maxItemsPerMeal=1`，无预算、已吃记录、锁定或套餐，三项限额均未触发。四项营养和价格均已知，类别 other，口味 0，重复 0，未知类别 0。所有 ID 都短且符合稳定 ID 格式。

| 候选 | 窗口 / offerId | 营养 `(E,P,F,C)` | 偏差 / tier | 价格 |
|---|---|---|---|---:|
| A | w-a / offer-a | `(2370,840,711,3485)` | 0 / 0 | 100 |
| B | w-b / offer-b-0 | `(2371,840,711,3485)` | 1 / 0 | 100 |

按独立规范元组 SHA256：

- A：`plan:8fde39922467113a00ba576c0c7ef58802ef957b6b421ffbb4eb60f4ccc69b52`
- B：`plan:58a58003dcfe57534eca5131a0a6deed178bbe4ae8f0c54f48c5e8ea57a17998`

因此 `key(B)<key(A)`。economy/taste 的全部前序相同，冻结排序应选 **B**，尽管其原始偏差多 1 bp。primary 则应选 A。这不是新增产品取舍，而是执行已冻结的 tier 分组和平局规则。

独立脚本直接枚举两个组合，以整数公式和 Python 标准库 SHA256 生成真值，没有调用生产评分、比较或剪枝。分别请求 economy、taste 时，基线 greedy/DP/BnB 都选 A；aligned 三算法都选 B。DP/BnB 基线 `searchComplete=true`、无 caps，不能用近似解释这个规格差异。

对 greedy，本例将两个选择放在不同窗口，每窗口仅一个合法购买项，因此两方案都进入现有全天候选比较；补丁只改最终比较就使结果从 A 变 B，显示这里同样是实现排序与契约不符，不能全部归因为贪心候选遗漏。它仍报告自身的近似搜索属性，本卡不由该例宣称 greedy 全局精确。

至少需要两个可比较方案才能出现顺序反转；本例仅一餐、两候选，已是最终比较问题的最小选择规模。规范元组为 33/35 字节，完全不涉及长 key。

### 3.2 两餐 2×1：只改终端比较仍会被旧剪枝裁掉

午餐 A=`(948,336,284,1394)`，B=`(949,336,284,1394)`；窗口/offerId 与上例相同，各 100 分。晚餐唯一候选 D 位于 w-d / offer-d，营养=`(1422,504,427,2091)`、100 分。各菜 ID 不同、类别同为 other，三项多样性指标和口味相同。

全天仅两组合：

| 组合 | 偏差 / tier | 总价 | planKey |
|---|---|---:|---|
| A+D | 0 / 0 | 200 | `plan:aaf0cddecb1a94266f9910c247d42a1413a41435cbe139d6d46a9c175d9cdcc0` |
| B+D | 1 / 0 | 200 | `plan:0a8d8b5dc867bb0170297020d91f8fc9be64e32527cf321f5c981a2d906b0b54` |

冻结 economy/taste 应选 B+D。BnB 按接近餐次参考目标排序，先访问 A，建立 A+D incumbent。处理 B 前缀时，剩余晚餐只有 D，因此营养区间退化成一个点：`lbDeviationBp=1`、`lbTier=0`；乐观价格 200、覆盖 1、重复 0、未知类别 0、口味 0，均与 incumbent 打平。

此时旧语句 `if (optNutComplete && lbDeviationBp > incumbent.deviationBp) return true;` 因 `1>0` 剪去 B+D。它恰是按冻结 planKey 应胜出的分支。

| 隔离变体 | DP，economy/taste | BnB，economy/taste | BnB 节点数 |
|---|---|---|---:|
| baseline | A+D，违反冻结顺序 | A+D，违反冻结顺序 | 3 |
| compare-only | **B+D，已对齐** | **A+D，仍错剪** | 3 |
| aligned | **B+D，已对齐** | **B+D，已对齐** | 4 |

三变体都没有触发限额；DP 均评估 4 个阶段状态。compare-only 的 BnB 还会报告 `searchComplete=true`。因此完整补丁必须包含剪枝两处尾语句，不能只修终端函数。对需要非叶剪枝的当前 BnB，至少两餐；本例只有两组合，已是该错剪的最小分支规模。

### 3.3 区分 greedy 的允许近似

另将一餐两个报价放在**同一窗口**，重新独立生成满足 `key(B)<key(A)` 的短 ID。greedy 的窗口内启发式先按单餐参考目标留下 A，最终比较只看到 A。baseline/aligned 均返回 A，均 `searchComplete=false`，`search.approximations` 包含 `APPROXIMATE_CANDIDATES`。

这仍是冻结完整空间中的次优，但不能据此判定 aligned 的终端比较器失效：B 没进入 greedy 的最终候选集合。此对照和双窗口例共同区分了两件事：**使用错误比较器**与**启发式候选集遗漏**。本卡不为追求 greedy 在全空间最优而扩大修改。

## 4. 正确剪枝条件与证明

### 4.1 只能按真实目标中的键剪枝

将多样性写为 `D=(-coverage, repeatedPairs, unknownCategoryCount)`，价格写为 `P=(!priceComplete, knownPrice)`，均按升序比较。共同前序仍是可用性、已设置预算时的预算可行性、营养完整性。完整方案在前序之后为：

- economy：`(tier, P, D, -preference, planKey)`；
- taste：`(tier, -preference, D, P, planKey)`。

营养不完整时依原实现跳过 tier；本次删除的原始偏差尾语句原来也仅在营养完整时启用。primary 继续比较原始偏差。

构造不含未知 planKey 的乐观向量 O：tier 用 `lbTier`，价格用乐观完整位及 `lbKnownPrice`，覆盖用上界，重复/未知类别用下界，偏好用上界。A02/A03 固定参考中相关频次/价格状态已经分离；本卡仅改变该向量与目标顺序的对应关系，不重做它们的全部验证。

在各字段界确实乐观的前提下，对任何延伸叶子 X，都有 `O≤X`（将“越大越好”的字段取负后统一升序）。各字段极值不必共同可达，无法共同达到只会使 O 更乐观。

**充分剪枝条件：** 在请求策略的共同前序及真实非 planKey 字段中，O 相对于 incumbent 的第一个不同字段严格更差。由 `incumbent<O≤X`，任何叶子都不可能胜过 incumbent。若 O 的较早字段更好，就不能凭较晚字段剪；所有字段打平时，当前简单实现应返回 **false**，让叶子正式比较 planKey。多策略请求仍必须全部策略各自可剪才剪整棵子树。

若能独立证明所有延伸 key 都不小于 incumbent，也可在全非键字段平局时剪；现实现没有这种哈希下界，且不透明 SHA256 不具有菜名/前缀顺序单调性。本卡不添加新的 key 下界框架，保留等界分支即可。

### 4.2 为什么同 tier 内不能继续用原始偏差

营养偏差下界 `lbDeviationBp` 仍可安全推出 `lbTier=floor(lbDeviationBp/W)`。例如 incumbent tier=0、下界为 1055 bp，W=1000，则所有延伸 tier≥1，按两策略都可剪；本卡正向对照仍观察到这种剪枝。

但 `lbDeviationBp=1 > incumbent.deviationBp=0` 只说明营养原始偏差更大，不说明冻结键更差：双方 tier 都为 0 时，该维度已用完，后面只看价格/多样性/偏好与 planKey。第 3.2 节的 B+D 就是反例。因此删除 economy/taste 两处尾剪枝，而**保留偏差区间计算、tier 下界和 primary 偏差剪枝**，是最小且对准目标的修正。

证明针对本次排序目标一致性；不能据此证明未覆盖的预算边界、长 key、资源失败或全部规模的搜索正确性。

## 5. DP 与其他取舍的必要改动

| 位置 | 本卡必要动作 | 理由 |
|---|---|---|
| `IsPlanBetterForStrategy` | 删除 economy/taste 末尾原始偏差比较块 | 冻结排序在各自主序后直接到 planKey |
| `CanPruneForStrategy` | 删除两策略末尾 `lbDeviationBp > incumbent.deviationBp` 剪枝 | 同 tier 且其他字段平局时仍可能以 planKey 胜出 |
| `DpExactDominates` | **不改** | 支配先要求四项累计营养数值相同，故偏差和 tier 相同；后续 Pareto/终端 key 条件仍充分 |
| DP 终端选择 | 使用修正后的共同比较器 | 极小例中两状态营养和不同，本就都保留；只需正确选终端胜者 |
| DP 桶化、启发式代表及全局截断 | **不改** | 属于已标记近似路径；用偏差启发式留代表不等于规定精确终端顺序，不在此卡重做近似保证 |
| greedy 窗口内启发式 | **不改** | 保留其候选近似差异；已经进入最终比较的方案仍必须使用冻结顺序 |
| BnB 营养启发式访问顺序 | **不改** | 搜索顺序可参考原始偏差，不能把顺序启发式升级为同 tier 精确目标 |
| primary | **不改** | 冻结排序本来就首先比较原始偏差 |

`scope-check.json` 核对 DP 精确支配、DP 启发式、primary 最终比较、primary 剪枝文本均未改变；其余捕获源码也未改变。无需新开关、重复评分、额外状态、兼容层或多级兜底。

## 6. 隔离补丁与实际验证

专属证据根：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T04A10-sol-策略排序与剪枝一致性-证据-v1`。

最小补丁：`A10-minimal-alignment.patch`。固定参考行号为：

- 1395–1398：删除 economy 终端尾比较；
- 1418–1421：删除 taste 终端尾比较；
- 2648：删除 economy 尾剪枝；
- 2667：删除 taste 尾剪枝。

删除 10 行，无新增生产逻辑。`aligned/core/src/planner.cpp` 是已编译实验副本，**不能整文件覆盖生产**。

三份变体各隔离构建一次，只构建 CLI，均 0 警告/0 错误。研究脚本共 **38 次原生运行**，包括故意保留错误的 baseline/compare-only，以及 greedy 允许近似的对照；这些结果均符合专项预期，**不写成“38 项全算法通过”**。

| 验证组 | 运行量 | 结果 |
|---|---:|---|
| 一餐 economy/taste，三算法，baseline/aligned | 12 | baseline 选 A；aligned 全部选冻结期望 B |
| 两餐 economy/taste，三算法，baseline/aligned | 12 | baseline 选 A+D；aligned 全部选 B+D |
| 两餐 economy/taste，DP/BnB，仅 comparator-only | 4 | DP 对齐；BnB 仍错剪，锁定遗漏修复点 |
| primary，三算法，baseline/aligned | 6 | 均选偏差 0 的 A+D，行为保持 |
| economy 跨 tier，BnB，baseline/aligned | 2 | 另一组合偏差 1055、tier=1；均正确选 tier=0，节点均为 3，正常剪枝保留 |
| 同窗口 greedy，baseline/aligned | 2 | 均允许返回次优 A；搜索近似标记保留 |

所有极小输入组合数均为 2。主反例最大规范 key 元组只有 **68 字节**，不依赖 A06/A07 长 key 修复；无预算，也不依赖 A08/A09。独立真值按冻结条款实现，**不在 economy/taste 排名元组内加入 deviation 尾项**；生产返回的每个 score 字段均与独立评分核对。

脚本最初有一次基础夹具路径笔误，在任何 CLI 实验运行前已改为实际保存的 A01 请求路径；没有据此改生产或重复已完成的旧实验。最终研究脚本 exit=0，未运行项目全量测试或生产/WASM 构建。

已保存变体可这样复核：

```powershell
$e = 'D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T04A10-sol-策略排序与剪枝一致性-证据-v1'
foreach ($variant in @('baseline','compare-only','aligned')) {
  & "$e\$variant\tools\core\build_native.ps1" -Only mp_cli -OutDir "$e\$variant\native"
}
& 'C:\Users\link\.cache\codex-runtimes\codex-primary-runtime\dependencies\python\python.exe' "$e\verify_ordering.py"
```

证据入口：

- `source-identity.json`、`variant-identity.json`、`binary-identity.json`：输入与三变体身份。
- `baseline/`、`compare-only/`、`aligned/`：隔离源码及各自 `native/build_summary.json`、构建日志、CLI。
- `prepare_variants.py`、`A10-minimal-alignment.patch`：本卡专用变体生成及最小补丁。
- `verify_ordering.py`、`inputs/`：确定性短 ID 反例及实际请求。
- `expected/*.enumeration.json`：独立完整枚举、冻结排名、planKey 与 score 真值。
- `outputs/<variant>/*.response.json`：补丁前/中间变体/补丁后原始响应。
- `verification.json`、`verification.log`、`compact-results.json`、`scope-check.json`：汇总与修改范围。

## 7. 整合交接与未测边界

本卡补丁只在固定副本验证，未触碰 A04 的生产写入。后续由 P01 按原串行顺序放行，在当时唯一生产候选上**只合并这四处删除**，不能复制整份旧 `planner.cpp`，也不能把本卡 CLI 直接替换共享 WASM。

交叉函数：

- A07 长 key 涉及终端 key 生成/比较，本补丁不改其实现；同文件整合时保留 A07 的哈希流/序列化修复。
- A08 预算前序可能涉及 `IsPlanBetterForStrategy` / `CanPruneForStrategy` 的预算守卫，本补丁不动预算字段和判断；合并时保留对应新语义。
- A09 预算见证要进入终端候选集合，必须调用同一个已对齐比较器。本卡不修改其候选保留逻辑，也不重复做预算研究。

后续同候选必要验证应优先保留本卡的一餐排序反例和两餐“只改比较器仍失败”证据，再按合并影响复查。没有验证新 API、实际菜单、WASM/真机、性能/内存、全规模、复杂未知输入或其他缺陷；不以本卡替代 P09 总审。

完成状态：

- [x] 固定只读副本及冻结排序依据。
- [x] 独立枚举最小合法反例，分别覆盖 economy/taste 和三算法。
- [x] 给出安全剪枝条件、DP 取舍说明及隔离最小补丁。
- [x] 保存原始输出、构建证据与反馈后结束，不改生产、不自行派单或等待其他窗口。

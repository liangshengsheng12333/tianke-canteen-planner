# T04A16｜内部Sol｜搜索内存与时限语义交付反馈 v1

**阶段交付：已实现并用新 native 证明 BnB 节点累积分配被消除，评分、节点预算、候选覆盖和确定性结果保留；新 WASM 构建被工具 AccessDenied 阻断，尚未产出。此候选不可据此直接合入/推广，也未完成任务要求的“新 native/新 WASM 对拍及三算法 WASM 资源实测”。**

当前真实 200000 节点预算不变，native 候选的请求 Arena 约 **1770403 B**，1000→200000 节点基本不增长；原版 native 在50000节点已约100782850 B。峰值工作集从原版50000节点约100.8 MiB降到候选200000节点约6.18 MiB。两者是原生观测，不是新WASM内存数字。批准的旧304FED WASM基线50000节点实测约89 MiB，其200000节点约347 MiB沿用T06d记录，不重跑多进程大内存测试。

## 1. 范围、身份与产物

- 依据：`Resources/任务卡/T04A16-内部Sol-搜索内存与时限语义核心卡-v1.md`、主PRD三算法/资源限制/确定性要求、冻结T01 v1.2及其沿用v1.1条款；已读当前AGENTS、项目MEMORY四文件的最新条目、T06d报告与原始输入、代码简洁约定。复用既有 diagnosing-bugs 方法。
- 执行日期2026-10-25；cwd `D:\项目\cpp`；项目根 `D:\项目\cpp\Projects\食堂就餐优化系统`。P01请求沿用 **gpt-6.1-sol / high**；内部子代理 `/root/dp_boundedness_core`、Default；服务端实际路由/档位/额度无独立证明，记未知。
- 只写本卡证据和本唯一反馈；未改生产/MEMORY/正式契约/生产ABI/ACL，未向其他聊天发消息，未另派代理。

证据根：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T04A16-内部Sol-搜索资源整改-证据-v1\`。

生产前后现场manifest逐文件一致，固定 **sha256:2871b4cad6cf801eeb27291c9eb291b3227d0adcf4c6a3270d40e9e34b3441a1**（75源/1004620 B，45工具/649145 B）。A15 json.cpp保持44777 B / `3c2ba4cab47599c6e00b40c089a8014fe6e62594cc5a2d8a05902088b8bb44a2`。基线 WASM 为107936 B / **304FED667624EA93B4A77314CFCC74D09AC57B2A2F3A1D6A4EBF8CE79DA370E8**，不是旧7f6a/B53C解析器。

| 产物 | 位置及身份 |
|---|---|
| 隔离核心 | `candidate/core/`；相对基线仅 `src/planner.cpp` 变化，220036 B / **578c09df3e9a1de2e2c8a4440fffaf1bcf2597a044e1f9ebc1fc8fde2508270c** |
| 搜索内存补丁 | `patches/memory-lifetime.patch`，12841 B / `62829b23d484071e00b0b4f96a26e4d853871f5084c2ac0e8e02afbafa15f41e` |
| 独立墙钟拒绝政策补丁 | `patches/wallclock-reject-policy.patch`，437 B / `8b0426fead490256d41b8c233b9eb71aab1f189c990dc249d547e9d39bb3988b`；待P01裁定 |
| 合并补丁 | `patches/combined.patch`，13224 B；`git -c core.autocrlf=false apply --check`通过，实际应用后逐字节复现候选 |
| 新native CLI | `candidate/build/native/mp_cli.exe`，375296 B / **b1cabd9b20109ab0be14b633213c272cd60c36ed09576ecca6f720f2f1010acc** |
| native诊断台 | `candidate/build/native/mp_bench.exe`；独立api-trace仅stderr输出Arena统计，不进入正式候选core/协议 |
| 新WASM | **未生成**；`candidate/build/wasm/`只有失败日志，不能拿reference产物充当新产物 |
| 基线、运行和验证 | `reference/`、`runs/`、`raw_io/`、`resource-summary.json`、`verification-native.json`、`verification-package.json`、`unit-logs/`、`identity.json` |

基准请求复用T06d的 `logs/t06d-bench-branchAndBound.req.json`，真实6窗、候选46/186/186、每餐3项、三策略、200000节点、DP32、wallClock=null，除受控节点参数和requestId之外不改目标/数据。日期沿用已批准请求中的2026-10-24，用于同输入比较，不冒充当天实际用户记餐。

## 2. 根因与最小实现

原 `RecurseBranchAndBound` 每访问一个叶子就新建 `PlanCandidate.meals`；`EvaluateFullDayPlan → BuildPlanKey` 每次新建JSON文本、offer配对和key缓冲；每个非叶前缀又重建并排序该餐的候选索引。所有分配都进入请求Arena，旧Vec/TextBuffer扩容缓冲和不再当选的叶子也到请求结束才释放。WASM底层bump即使提前RawFree也不会单块复用，所以“给每个叶子新Arena然后Reset”不能可靠解决线性内存高水位，且不应改变既有指针生命周期契约。

本卡只改一个核心文件：

1. BnB叶子餐次Vec、planKey的JSON/pairs/key工作缓冲每请求初始化一次，后续Clear/size=0复用容量。
2. 每个策略保留自己的餐次Vec、offeredAs Vec和稳定planKey缓冲；当选时复制少量MealPlan值及完整69字符SHA256键。底层items/components/字符串仍指向请求Arena中的不可变菜单/候选。
3. 该餐排序仅依赖固定候选、参考目标、权重和价格，原来每个DFS前缀都得到同一顺序；现在每餐只排序一次。插入排序比较/稳定平局规则完全保留，所以遍历顺序、剪枝和节点触限位置不变。
4. 共享的planKey工作缓冲和稳定保留方案方法也用于DP终端评分；K、DP展开/支配/桶化、预算最低价见证和评分规则均未改。未为了50ms降K、砍节点或禁用算法。

**生命周期证明**：叶子工作区可在下一叶子覆盖，但保留方案的meal列表/key/offeredAs分别独立持有；每个MealPlan的深层items指向已生成、整个请求内不再修改的候选。工作区C++对象或env退出后，Vec/TextBuffer的实际数据仍归调用方ExecContext的Arena持有，直到结果序列化结束才释放。因此outStrategyPlans不会引用栈对象，也不会引用下一叶子被改写的key/meal列表。StoreSearchIncumbent失败则可定位INTERNAL_ERROR，不返回部分更新的假成功结果。没有增加逐节点释放、通用缓存或多级恢复框架。

额外空间从随访问节点累积的 `O(N × 每叶临时对象)`，改为固定输入下 `O(ΣC_m + 最长规范键文本 + M×策略数)` 的搜索工作区；DFS栈深≤3。原候选生成、输入解析及DP状态层的空间另计。JSON缓冲可能随首次遇到更长键增长到该请求最长值，此后复用；不能把“与节点数无关”理解成任意长输入都常数空间。SHA256、营养/多样性评分与DFS仍需逐节点工作，耗时并未被伪称常数。

## 3. 实际内存与时延证据

先串行执行小节点递增，未一开始同时跑多个347MiB进程。每个请求均独立子进程25秒硬超时。

| 节点预算 | 批准基线WASM线性内存 | 原版native Arena BytesUsed | 候选native Arena BytesUsed | 候选native峰值工作集 |
|---:|---:|---:|---:|---:|
| 1000 | 4325376 B | 3788033 B | 1770401 B | 6488064 B |
| 10000 | 20971520 B | 21870722 B | 1770402 B | 6479872 B |
| 50000 | 93323264 B | 100782850 B | 1770402 B | 6483968 B |
| 200000 | 未在本卡重跑；T06d为363986944 B | 未重跑大基线 | 1770403 B | 6479872 B |

Arena相差1–2字节来自不同requestId长度，不能把它当节点增量。native峰值工作集是Windows GetProcessMemoryInfo(PeakWorkingSetSize)，含进程运行库；Arena BytesUsed是本请求累计申请的payload，不是同一指标，也不是WASM页数。`api-trace.cpp`只把该数字打到stderr；正式候选CLI没有此探针。基线与候选native bench同编译选项/MSVC，未用优化档位差制造资源下降。

固定节点1000/10000/50000的原版native、候选native以及批准基线WASM结果逐字段/字节对照一致（requestId另比时排除）；200000节点新native结果与T06d批准WASM存证结果除requestId外完全一致，仍是200000评估、observed200001、searchComplete=false和SEARCH_LIMIT_REACHED。完整候选46/186/186不变。

当前六窗口候选native的实际计时：MSVC `/std:c++17 /W4 /EHsc /permissive- /utf-8 /Zc:__cplusplus /MP`，未启用/O2；计时仅mp_plan入口，非独占机器，只作诊断量级，不与WASM/红米或正式阈值混比。

| 算法 | 冷样/后续正式样（ms） | native资源 |
|---|---|---|
| greedy | 14.4048；13.9621/13.7231/13.9470/14.2318/14.3149 | 峰值工作集6782976 B |
| DP32 | 752.2030；758.8943/798.1069/768.0596/812.2860/833.9610 | 峰值工作集14823424 B；11950转移，近似标记保留 |
| BnB200000 | 普通冷样4345.4609；5个独立进程各预热1次后取1次正式：4557.1067/4720.5013/4586.3790/4559.5161/4511.5301 | 峰值工作集约6.2MiB，节点预算和触限不变 |

最初把BnB六次放同一25秒子进程，累计超时被终止，保留 `candidate_native_warm_branchandbound.json`，未放宽硬超时、未将其算成功；随后采用5组独立“预热1+正式1”对子，每组约9秒，满足单次子进程上限。新WASM的冷/热/内存均未测，DP20000三餐也未跑；不能据native内存改善推定新WASM已经达到某页数或50ms。

## 4. 正确性与独立参照

新native实际构建4目标，exit=0、warning=0、error=0。原有sha256 20、JSON 189、core 43项检查均通过（252项原有检查，非252独立业务场景），日志在unit-logs。native对照脚本212项断言含131次planKey复算，包含重复工件；另11项打包/身份检查通过，不包装成223个独立业务场景。

- 同一批准新解析器源的native基线与候选，18组聚焦请求逐字节一致：4097字节规范元组的planKey、已吃超预算、DP预算恢复/更好预算候选、已吃未知支出各改成DP/BnB两算法；预算600、窗口锁、菜品锁、川湘首项售罄也各测DP/BnB。长元组来自规则展开后527/584字符的offerId，摘要键仍为69字符；锁和售罄未被复用缓冲覆盖。
- 直接从原始合成菜单独立枚举2×2×2共8个三餐组合；Python自行计算营养偏差整数四舍五入、tier、预算优先、多样性/重复与规范元组SHA256，不读取引擎候选表/剪枝/评分实现。无预算/1600/1400三组，DP/BnB各三策略均命中独立最优；greedy只断言合法枚举成员，不伪称全局最优。目标数值沿用同请求返回的daily目标，独立性限于候选/搜索/评分，未另充当营养公式Oracle。
- 极小BnB节点1/2无完整方案时返回ResourceLimited而非NoFeasible；节点3已找到完整方案时保留它并标SEARCH_LIMIT_REACHED；无预算、可行预算、不足预算、已吃/未知值的旧行为保持。
- 当前六窗口3算法候选native输出与T06d批准WASM历史响应除requestId外全等，含planKey、方案内容、评分、策略归并、计数与近似字段。这是“新native vs 已批准旧WASM存证”的兼容证据，**不是新WASM对拍**。

上述没有证明任意输入无缺陷、native堆绝对零泄漏或真机性能通过。缓冲别名/保存键/同分planKey由结果全等、长键及独立穷举共同验证，仍需新WASM32位实际验证。

## 5. wallClockMs：不再默许非空，但正式能力待裁定

复核正式T01 v1.2 §4沿用v1.1的limits结构及一致性null要求，未找到“非空可接受但可忽略”的条款，也没有不支持墙钟的能力协商。主PRD有触时间限制的诚实返回要求。故不能自行宣布正式契约已取消时间支持。

本卡提供**独立政策候选**：对有效非空整数直接现有INVALID_INPUT，fieldPath=`$.plannerConfig.limits.wallClockMs`，message=`wallClockMs is unsupported by this build; use null`；null正常路径不变。native三算法×1/600000共6组可见拒绝验证通过。没有用节点数伪装毫秒，没有新增ABI/导入。候选native包含此guard，但P01合入前必须确认本版是否明定“仅支持null、非空拒绝”，同步正式能力说明；不批准则只取memory-lifetime.patch，墙钟缺口仍未闭合。

若必须支持真实时钟，`wallclock-policy-proposal.md`给出native steady_clock、WASM宿主单调时钟导入、截止时刻/检查粒度、完整方案与ResourceLimited语义的最小方向及裁定点。该方向未实现/未测，不能与本拒绝候选混称“限时已生效”。本卡未改正式契约或生产ABI。

## 6. WASM构建障碍、命令与接续

`candidate/build-wasm.ps1`保持现有Zig0.16/wasm32-freestanding/nostdlib/Os参数，源/缓存/临时文件/产物均在本卡目录。普通运行出现Unexpected/FileNotFound；受控提权调用并未被自动审批拒绝，但Zig实际返回：

```
error: failed to create output directory 'build\zig-cache-local\tmp\ff9ad959ad3a49d7': AccessDenied
```

源码可被Python/MSVC读取，缩短缓存路径和最小stdin仍失败；未证实错误具体来自令牌/ACL还是工具实现。未改ACL、未安装新工具、未写旧工具链缓存/生产产物。详细过程与当前失败日志见 `WASM构建障碍.md`。这是唯一构建阻塞，不是用旧WASM跑新候选后给的通过结论。

已完成的实际命令（各核心请求由run.py/验证脚本独立25秒硬超时）：

```powershell
# 项目根 cwd
python Resources/报告/T04A16-内部Sol-搜索资源整改-证据-v1/run.py baseline
python Resources/报告/T04A16-内部Sol-搜索资源整改-证据-v1/make_candidate.py
& Resources/报告/T04A16-内部Sol-搜索资源整改-证据-v1/candidate/tools/core/build_native.ps1 -OutDir D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T04A16-内部Sol-搜索资源整改-证据-v1\candidate\build\native
python Resources/报告/T04A16-内部Sol-搜索资源整改-证据-v1/make_trace.py
& Resources/报告/T04A16-内部Sol-搜索资源整改-证据-v1/build-bench.ps1
python Resources/报告/T04A16-内部Sol-搜索资源整改-证据-v1/run.py native
python Resources/报告/T04A16-内部Sol-搜索资源整改-证据-v1/run.py native-bnb-pairs
python Resources/报告/T04A16-内部Sol-搜索资源整改-证据-v1/verify-native.py
python Resources/报告/T04A16-内部Sol-搜索资源整改-证据-v1/pack.py
```

WASM构建尝试命令：`& .../candidate/build-wasm.ps1 -Toolchain D:\项目\cpp\.toolchain`，失败日志保存。当前run.py native已跳过已证实会累计超时的BnB六次组，改用native-bnb-pairs；原超时证据保留。补丁生成器最初遇到原文件混合CRLF/LF而匹配失败，已用精确换行适配修正；候选未整文件换行重排，合并补丁实际应用后与候选逐字节相同。

**P01接续**：先审内存生命周期补丁和墙钟政策取舍；安排已有可正常构建的执行环境在本隔离目录生成新WASM，再逐例与新native对拍并实际执行`run.py after`（每请求25秒、单进程串行），核六窗口三算法冷/热/页数、节点空解/已有解及近似字段。需要路径/权限范围变化先由P01裁定，不能在本卡擅改ACL。之后才可单人汇合当前2871b4ca版、核定新唯一身份和受影响真机/全量验收。当前生产保持不变，整卡/A10/P09均未通过。

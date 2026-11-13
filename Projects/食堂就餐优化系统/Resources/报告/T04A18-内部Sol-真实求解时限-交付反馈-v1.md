# T04A18｜真实求解时限｜隔离交付

日期：2026-10-25。执行岗位：内部核心子代理 `/root/dp_boundedness_core`；请求配置沿用 gpt-6.1-sol/high，实际后端模型/档位无独立工具证明。按已确认任务卡执行，没有修改生产、MEMORY、正式共享契约或A16/A17冻结证据，没有推广候选。

## 接收结论

已交付真实单调时钟的最小核心/宿主候选、新native与WASM，以及新产物的双端证据。`wallClockMs=null` 不读取时钟，三算法真实三餐请求与2871＋A16 memory-only参考输出逐字节一致（仅归一化requestId）。合法正限额实际生效，覆盖候选枚举和各算法重循环；完成全天方案后超时保留完整方案并明确近似，没有完整方案返回ResourceLimited。没有用节点数代替毫秒、降低K/节点预算、改变评分或按窗口前缀截覆盖。

本卡可接收为**核心/native/Node WASM阶段成果**。微信真机时钟与新import配对加载尚未验证，不能称生产或整体验收通过。实现是协作式deadline，具有下文明确的原子工作超调边界，不宣称硬实时或端到端1ms/50ms达标。

## 唯一基线、候选和补丁

证据根：`Resources/报告/T04A18-内部Sol-真实求解时限-证据-v1/`，下文文件均相对此目录。

| 对象 | 字节 / SHA256 |
|---|---|
| 生产UI/工具清单 | `sha256:2871b4cad6cf801eeb27291c9eb291b3227d0adcf4c6a3270d40e9e34b3441a1`；75src/1004620B、45tools/649145B |
| 未改生产WASM | 107936B / `304fed667624ea93b4a77314cfcc74d09ac57b2a2f3a1d6a4ebf8ce79da370e8` |
| 冻结A16 memory-only输入 | 12841B / `62829b23d484071e00b0b4f96a26e4d853871f5084c2ac0e8e02afbafa15f41e` |
| 新候选WASM | 111521B / `8a817926bde039b74672fa17974323574aebdb2b41fd8d9815b0e11bff3a4ad8` |
| 新native CLI | 382464B / `c86461c7a9b108dd9e616a19a6b14f0fdd93bf5d4f4c5f41e1e2d4a69a3c5fad` |
| 测试时钟专用CLI | 384000B / `d7b535691305068d18e50db91e8aa07ceb9ba73c65af28af707cf8a5abcd29bc` |
| 增量combined.patch | 38946B / `8ca8845cac11256ce7e27a4cfc82b3d116b3cfc02ff2e42d412c67ef3cc96a73` |

`reference/core`是生产core应用**仅memory-lifetime.patch**；`candidate/core`在此之上实现时钟，不含A16未批准的wallclock拒绝guard。`patches/core-clock.patch`相对此memory-only参考；`patches/host-clock.patch`相对2871宿主。合并前必须先应用memory-only补丁，再应用combined.patch，附上新文档`candidate/core/wasm/A18-ABI.md`。补丁8文件，204增/40删；未重构引擎。`pack.py`用git apply --check/apply在隔离镜像核实可重现逐字节候选。完整逐文件身份见`identity.json`，生产最终复核见`production-final/manifest.json`。

## 时限语义与检查边界

native使用`std::chrono::steady_clock`。WASM新增且只新增必需函数import：`env.mp_monotonic_ms: () -> f64`，含义为有限、非负、不递减的单调毫秒。原8个C导出、内存/JSON接口、评分和planKey规则未改；API版本仍1、JSON契约仍1.0，但**宿主import ABI发生变化**，不能把新WASM交给旧空imports加载器。

计时起点在合法请求、菜单、规划状态、营养目标等校验完成并确定目标可规划之后，候选枚举之前。解析、校验、目标计算不计入求解限额；桥接输入输出复制、JSON输出也不计入。`null`全程零次时钟读取；非空以`now-start >= limit`触发，实际耗时不进入JSON/评分，capsHit.observed记已达到的整数阈值，**不是实测elapsed**。不可用、NaN、负值或倒退时钟返回`INTERNAL_ERROR`，定位`$.plannerConfig.limits.wallClockMs`；宿主回调异常转不可用值供核心明确报错。

检查位置覆盖报价扫描/插入排序/候选子集递归、贪心窗口与扩展/组合、DP展开/成对支配/桶插入/桶排序/终端遍历、BnB后缀界/候选排序/DFS。没有隔几秒才在算法结束检查一次。DP在非终层停止时清空前缀，终层已构建的完整状态最多完成一个评分/planKey收尾；已有incumbent保留。贪心和BnB完整叶子的评分及至多3策略提交作为原子工作，避免返回半成品。

检查粒度的工作量上界是一个循环元素/支配比较/排序移动/递归边界，加一次不可拆分辅助操作；原子全天评分至多3餐、每餐既有上限8项、至多3个策略，但仍受组件数量、查找及ID字节数影响。单次内存扩容/字符串比较/计划key序列化和SHA不能被中途抢占。因而超调上界应写为“最后一个检查间隔的原子工作＋有界方案收尾＋调度延迟”，**没有跨机器固定毫秒上界**；恶意巨型目录/长字符串的最坏超调尚未做上限压力证明。解析/校验也有自己的输入规模成本。外部25秒子进程硬终止是实验保护，与核心deadline分开。

## 关键可证伪反例与返回行为

`verification.json`的可控时钟在指定第N次读取后从0跃至1000ms，合法限额为10ms。它只存在测试CLI宏/测试宿主回调中，生产native不使用该实现。读取次数用于选择相邻中断点，**不是毫秒换算**。三算法相邻点在新native/WASM输出一致：

| 算法 | 首个完整方案可保留的读取截点 | 前一截点 |
|---|---:|---|
| greedy | 86 | ResourceLimited，0完整方案 |
| dp | 70 | ResourceLimited，0完整方案 |
| branchAndBound | 77 | ResourceLimited，0完整方案 |

截点触限均有wallClockMs capsHit、APPROXIMATE_TIMEOUT、searchComplete=false；保留方案均含3餐和SEARCH_LIMIT_REACHED，不宣称最优。DP预算1400的同一超时反例得到带overBudget事实的OkPartial，避免误称已证明NoFeasibleWithinBudget。

补充`phase-probes.json`：枚举中断准确报告2/2/0；DP K1桶化阶段触限时states=2并无完整方案；BnB界/排序阶段触限时nodes=0。多窗口贪心首完整截点116/总128，证明在仍有组合未处理时也能保留完整全天方案。

发现并修复交叉限额遗漏：多窗口贪心node=7已有完整方案，旧分支在节点触限时会清空方案，即使时限也到达。`before-joint-cap-fix/`保留失败反例；`joint-caps-verification.json`核实新native/WASM双限额均可见、nodes仍7/observed8、完整方案保留且有两类标记。此保留仅启用时钟的路径生效；同输入null仍与memory-only节点截断输出完全相同。正限额下节点单独先触发时同样保留已完成方案并标节点受限，没有多用节点预算。

## 实际计时和资源

每请求独立子进程，`subprocess.run(timeout=25)`，串行执行；本机非独占、冷调用、非正式A10性能验收。`final-metrics.json`保存分段和原始响应。内存为调用后WASM线性memory容量（只增长，可反映本次峰值），不等同宿主RSS。

| 新WASM真实时钟请求 | 检查区间ms | 核心入口ms | 桥调用ms | 返回 |
|---|---:|---:|---:|---|
| greedy 1ms | 1.0023 | 5.9945 | 11.4605 | ResourceLimited |
| DP 1ms | 1.0027 | 6.0756 | 11.6875 | ResourceLimited |
| BnB 1ms | 1.0056 | 5.7605 | 11.1556 | ResourceLimited |
| greedy 50ms | 9.4483 | 14.4063 | 21.4127 | 3方案，正常启发式结束，无time cap |
| DP 200ms | 200.0025 | 205.1043 | 211.3180 | ResourceLimited，非终层1849状态 |
| BnB 50ms | 50.0041 | 55.0893 | 61.6471 | 保留3方案，8565节点，time cap |

1ms三组首回调前核心开销4.43–4.76ms、末回调后0.315–0.327ms；首回调前合并包含解析/校验/目标，并未进一步伪拆成纯JSON解析耗时。native使用真实steady_clock的1ms请求三算法均实际触限；只记录进程总耗时30.44–102.92ms（含启动/读写），没有把它宣称求解耗时。

真实六窗口、三餐、cap256、K32、节点200000、null的候选数始终46/186/186。新WASM greedy 9.33ms/2752512B；DP 609.90ms/10354688B、11950状态；BnB 849.50ms/2490368B、200000节点触限。三算法每组均零次时钟读取且与reference同输出。不同阶段/冷热环境数据不可与A16的热耗时直接比较；本卡不声称null零性能开销或50ms达标。正限额细粒度polling也有开销，例如200ms DP约163万次宿主时钟调用；未为追求速度偷减搜索量。

## 核验范围

- `verify.py`：79断言，包括三算法相邻超时点、三类坏时钟、三算法真实三餐null、15组原有预算/已吃/未知值/窗口锁/菜品锁/售罄/长key原始元组及节点限额回归，双端对memory-only。
- `positive-constraints.py`：另12组正限额＋受控不超时clock，双端与原参考完全一致，核正限额路径没有改变上述业务规则。
- `oracle.py`：独立Python穷举原始2×2×2组合，3预算×3算法；DP/BnB三策略最优key与自写比较器一致，greedy只核合法组合成员，不伪称全局最优。目标取相同请求输出，只是搜索oracle，不是营养目标oracle。
- `extra-checks.py`：157断言，其中143次planKey独立SHA重算（包含重复/试验输出，不能称143个独立场景）；含多窗口中断、6组真实1ms双端、3组较大限额与Node命令行宿主适配。长元组原始key行4097B，摘要依旧固定69字符。
- `joint-caps.py`：9断言；`phase-probes.py`：3组阶段双端对拍。
- `verify-host.py`：7条命令通过；native SHA20＋JSON189＋core43=252 checks；TS4.1.2在3个适配文件0 errors，未称全UI类型检查。另一IDE TS路径不存在而跳过，日志有记录。
- runtime Node三组：实际全局performance.now、显式注入、缺失源；缺失源的正限额明确错误，null仍可运行。新module导入/导出实查见`module-identity.json`。补丁应用复现与null逐字节核验见`null-byte-equivalence.json`。

`run-summary.json`只收录绑定最终候选或memory-only参考身份的168次调用；旧版本3次、早期未绑定6次排除，不混作新产物证据。当前runs无25秒硬超时，单次最大进程约9.59秒。初期测试脚本的路径/flags字段误用已修正后重跑，未将失败运行当PASS。

## 构建命令与宿主影响

在PowerShell设置`$e`为本证据根，实际使用：

```powershell
python "$e\make_candidate.py"
& "$e\candidate\tools\core\build_native.ps1" -OutDir "$e\candidate\build\native"
& "$e\build-controlled.ps1"
& "$e\build-wasm.ps1" -PatchedRunner
python "$e\adapt-host.py"
python "$e\verify.py"
python "$e\oracle.py"
python "$e\extra-checks.py"
python "$e\phase-probes.py"
python "$e\joint-caps.py"
python "$e\positive-constraints.py"
python "$e\verify-host.py"
node "$e\inspect-module.mjs"
python "$e\pack.py"
```

WASM共使用两条有据路径：普通`python -m ziglang`逐源报Unexpected，日志`candidate/build/wasm/build-normal.log`；沿已授权缓存的既有`.toolchain/build/zig-runner/zig.exe`路径成功（工具自动审批允许隔离构建），后续重建继续同一路径。独占stage `.toolchain/build/wasm/t04a18_time_candidate.wasm`；未改ACL/装工具/覆盖他人stage。MSVC与Zig命令展开在脚本，构建日志与测试CLI源码均在本证据内。

core-bridge为新import绑定有验证的回调；core-runtime新增可选`monotonicClockMs`配置，默认只使用实际存在的标准global performance.now；Node工具显式绑定perf_hooks.performance.now。[Node官方说明](https://nodejs.org/api/perf_hooks.html#performancenow)给出毫秒依据。没有Date.now降级。

微信官方页面此次访问失败；[腾讯官方API类型](https://raw.githubusercontent.com/wechat-miniprogram/api-typings/master/types/wx/lib.wx.api.d.ts)的Performance接口未列now。这不足以证明所有微信环境都没有单调时钟，也不足以猜测wx.getPerformance().now存在/单位。故候选保留明确可注入能力，无法获得源时可见错误；这项障碍不能作为取消PRD时间需求的理由。来源与边界详见`host-clock-evidence.md`。

## P01后续合入清单与未测项

1. 审阅memory-only＋clock补丁、起点/原子收尾/observed阈值语义；批准并正式冻结新import ABI与配套桥/runtime/Node文件，不能仅换WASM。生产冻结身份由P01维护。
2. 微信开发者工具与红米真机核实真正可用的单调毫秒源及单位，必要时向configureCore注入已核实provider；验证新import加载、时钟异常、正限额有解/无解、null对照。当前只有native/Node真实时钟证据。
3. 在一个最终集成候选上复跑业务/UI回归、冷热与连续调用、前后台切换及A10性能/资源验收。不同机器正限额可以得到不同搜索进度与方案，不能要求同字节；null继续要求确定性。
4. 尚未证明任意巨大合法输入的固定毫秒超调上界；若产品要求硬端到端截止，需要输入规模上界/异步worker终止策略，不能把当前协作式求解deadline说成硬实时。此次不扩展线程框架、不自行改变正式JSON。

所有改动仅作为可审隔离候选交回；原需求未取消，生产没有自动推广。

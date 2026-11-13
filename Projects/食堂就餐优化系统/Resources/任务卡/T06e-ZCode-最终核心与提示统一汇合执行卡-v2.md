# T06e｜GLM5.3｜最终核心与提示统一汇合｜v2

**P01已接收A18原生/Node WASM阶段成果，现可转交执行本卡。** 取代预备v1。指定 **GLM5.3一名主执行员**，先隔离集成/微信检查，满足推广条件才按清单写生产；不派多代理并发改代码。

项目根 `D:\项目\cpp\Projects\食堂就餐优化系统`。生产基线2871b4cad6cf801eeb27291c9eb291b3227d0adcf4c6a3270d40e9e34b3441a1。P01裁定：`Resources/报告/T04A18-P01-阶段验收与最终汇合放行-20261025-v1.md`；配套语义/ABI：`Resources/契约/T04A18-单调求解时限与宿主ABI接收裁定-20261025-v1.md`。

## 输入与正确应用顺序

读A18唯一反馈 `Resources/报告/T04A18-内部Sol-真实求解时限-交付反馈-v1.md`。其证据根为 `Resources/报告/T04A18-内部Sol-真实求解时限-证据-v1/`。

从2871必要副本建 `Resources/报告/T06e-ZCode-最终核心汇合-证据-v2/candidate/`：
1. 先A16已批准memory-lifetime.patch（12841B/62829B23…15F41E），再A18 `patches/combined.patch`（38946B/SHA256 8CA8845CAC11256CE7E27A4CFC82B3D116B3CFC02FF2E42D412C67EF3CC96A73）。A18增量基于memory-only，不是2871原planner。若直接从A18候选复制已核变更文件，则不要又重复叠内存补丁；核A18 pack.py/identity清单确认逐文件相等。
2. 合A18 `candidate/core/wasm/A18-ABI.md`及必要宿主适配。新WASM **111521B / 8A817926BDE039B74672FA17974323574AEBDB2B41FD8D9815B0E11BFF3A4AD8**，匹配native **382464B / C86461C7A9B108DD9E616A19A6B14F0FDD93BF5D4F4C5F41E1E2D4A69A3C5FAD**。不可用A17无时钟14ABEF核心代替，不混A16拒绝非空guard。
3. 合T08L反馈内两行editLog提示补丁（981B/21870E4C…D757030），同时只把addManualLog同类超限提示统一到现有上限表达，验证拒绝/无写入/0/null。金额常量/业务事务不改，无须另开小修轮。

## 先做微信宿主检查

新模块只新增 `env.mp_monotonic_ms`，原JSON接口/8导出不变；必须同步bridge/runtime/Node调用器，不是仅换WASM。先在本候选专用微信工具项目确认实际编译加载111521B新产物、import可绑定、null常规UI可用。

实际探测当前运行环境的单调毫秒源及单位/可调用性，优先A18 runtime已实现的标准performance.now能力，有经核实其他源才通过configureCore注入。不要凭类型缺失就断言微信绝无时钟，也不能猜wx.getPerformance().now存在/单位；不使用Date.now或节点数充当单调时间。保留实际探测/短间隔递增证据、环境/基础库和已核来源说明。

在该实际源下用小限额证明正限额确实触发、有完整解/无完整解语义正确；实际时限与JS外部25秒硬终止分开。若新import不能加载、微信没有已核单调源或非空只报不支持，**停止推广**，提交隔离集成候选/最小错误和宿主探测结果，不默改请求为null、不删时限功能、不扩权限。

## 必要回归与推广

保留当前全部H01/H02/U09功能和默认限额（cap256、三餐DP32/单双餐原K、节点200000、默认wallClock=null）；本卡不自调K/节点/默认正时间阈值。对活跃身份/manifest/helpers及直接空imports调用点按新ABI同步，历史报告和旧基线不替换。

必要编译、null确定性/三算法新核心调用、A18超时/坏时钟行为、预算锁售罄/快照/62桶/金额三路径及单菜UI冒烟；core空解不能冒称NoFeasible。A18适配文件局部TS通过不代表全UI编译，需在完整集成候选核类型/加载。只跑受影响回归，最终正式矩阵在新manifest后；可能长跑逐请求25秒硬超时，不把全部BnB样本塞一个25秒进程。

以上正确性和微信宿主门槛通过后，先备份生产实际版本，**仅逐文件覆盖获批清单，不删除生产目录/重建tools**，由同一执行员推广开发候选。记录source/tools/core/menu/native/WASM与import能力身份、生产=candidate、备份和回退；仍不能称最终验收通过。

唯一反馈 `Resources/报告/T06e-ZCode-最终核心与提示统一汇合-交付反馈-v2.md`；原始结果/源hash/新产物/微信实际加载与时钟探测/已测未测/推广或停止原因全部落盘。完成停写，P01核定唯一新候选后集中性能/算法/真机/P09。不要求补拍、不动PPT。

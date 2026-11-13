# T06d｜GLM5.3｜修复与资源统一汇合

**现可由用户转交GLM主窗口，指定一名GLM 5.3主执行员写入，不再派四名代理同时改生产。** 各H/A15执行者先停写。本卡是已批准修复的汇合，非重新设计。

项目根 `D:\项目\cpp\Projects\食堂就餐优化系统`。当前生产基线 `sha256:7f6a6ea5071626afeb817592f5ad10f105481a2fbefdfee0b8c4b98626aeba42`（75源码/996165B、45工具/649001B）。P01接收依据 `Resources/报告/T08H-P01-四路接收与统一汇合放行-20261025-v1.md`。

## 实际输入

- H01 `Resources/报告/T08H01-ZCode-预算实付三项修复-交付反馈-v1.md`；补丁 `Resources/报告/T08H01-ZCode-预算实付修复-证据-v1/h01-cumulative-patch-vs-U09-7f6a6ea5.patch`（8321B/SHA256 89A816742EE4D1BF7537AEB6FE26B06916D3E6910FDD969893119CBB4A8BF2A8）。
- H02 `Resources/报告/T08H02-ZCode-整月记录保留修复-交付反馈-v1.md`；补丁 `Resources/报告/T08H02-ZCode-整月保留-证据-v1/patch/t08h02-max-kept-days-14-to-62.patch`（1185B/SHA256 61CDA9E6C3F40D24CC15ABB09407384915CC4764EC2DAB8707790CDE42B800B1）。
- A15 `Resources/报告/T04A15-ZCode-JSON字符串分配修复-交付反馈-v1.md`；候选 `Resources/报告/T04A15-ZCode-解析器内存修复-证据-v1/candidate/`：core/src/json.cpp和已编译新native/wasm。只接该源文件改动，不把整份旧core覆盖到现态。
- 新WASM `candidate/build/wasm/mp_core.wasm`，**107936B/SHA256 304FED667624EA93B4A77314CFCC74D09AC57B2A2F3A1D6A4EBF8CE79DA370E8**。匹配native CLI在candidate/build/native/mp_cli.exe。P01已独立跑parser回归/189 checks及同输入新native/WASM/旧响应一致。
- A14两行隔离建议 `Resources/报告/T04A14-内部Sol-全天DP有界搜索-证据-v1/candidate-limits.patch`。不得再单独叠A13旧的一行补丁。

## 串行完成

1. 在 `Resources/报告/T06d-ZCode-统一资源修复-证据-v1/candidate/` 从当前7f6a建完整必要副本，先核基线无漂移；合H01/H02和A15 json.cpp。预算/金额、62日期桶、原始planRaw3天、完整六窗口/用户锁/已有记录快照/所有U09体验改动同时保留。
2. 接新WASM及匹配native产物。核core其他生产源与A15编译所用源一致；来源一致可复用已批准产物，若重新编译则保存实际命令/来源/新哈希并核差异，不声称旧hash仍匹配。A15非标准diff路径不能盲套到错误目录。
3. 采用A14已验证的有界开发配置：`maxMealCandidatesPerMeal=256`；`maxDpStates=meals.length===3 ? 32 : 20000`；其他限额不改。保留全天目标/三餐/三算法和近似标记，不禁用DP、缩餐或把近似说精确。32是开发有界缓解参数，不是已证明最优或质量无损；本卡实跑结果不达要求就报告真实障碍，不擅自继续降K/放宽验收阈值。
4. 当前生产WASM身份校验入口统一改指本轮批准的新产物，准确核runtime、manifest与tools辅助常量/当前版本测试期待。只改活跃代码/工具与必要夹具，历史Resources报告/旧基线身份不全局替换。更新当前开发候选WASM身份不代表最终产品验收通过。
5. 必要编译和受影响回归：H01旧缺陷输入/H02整月备份恢复/字符串与JSON最小回归；真实新WASM三算法入口/候选46-186-186覆盖、三餐DP近似/预算锁售罄、自选实付/幂等/历史快照及单菜UI旧证据的适用范围。仅当前默认配置，不重跑已知DP20000三餐；每个可能长跑独立子进程25秒硬超时。
6. 单独给同一新产物下三餐greedy/DP/BnB的1次冷＋5次正式核心样本及线性内存，标CPU并发条件；这只是汇合观察，正式页面/红米性能在后。不得复用旧WASM计时或把Node计时称真机。wallClockMs当前未实现，不能把它当保护或声称所有资源门已通过，保留为集中契约核查项。

必要编译/冒烟通过后，按已有开发授权由此**单一执行员**备份7f6a并推广统一开发候选；同时推广H01/H02/核心源和新WASM，不能只换二进制或只换前端配置。前后manifest/原核心源备份/回退指引写清。若必要启动/记录正确性失败先停止推广、保存隔离候选交P01，不伪造通过。

唯一反馈 `Resources/报告/T06d-ZCode-修复与资源统一汇合-交付反馈-v1.md`。附最终源码/工具/菜单/native/WASM身份、生产与candidate一致性、具体接入清单、真实结果和未测项。完成后停写，状态只能是“统一开发候选，待集中验证”。本卡不做P09最终审查，不要求用户补拍、不改PPT。

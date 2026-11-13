# T09c｜user-v2 总审预审交付反馈

- 日期：2026-10-26
- 请求模型/档位：gpt-6-luna / high
- 实际模型/档位：未知
- 预审结论：材料可进入最终总审准备；当前不能判定 A01—A12 全部通过。A10 手机性能、A11 真实朋友试用仍缺结果，按任务卡停止在预审，不等待或轮询。

## 1. 范围与操作

按 T09c 固定核对 user-v2、dev-v2 同源对照及 T06g 合流源。复核了包清单与文件哈希、源码树摘要、两包差异、菜单目录摘要、user 入口隔离、T06g/T08N C++ 核心源对应关系和正确 native CLI 产物身份。此次没有构建、启动小程序、运行核心/算法、运行性能负载，也没有修改产品、旧证据、MEMORY、契约、权限或 PPT。

新留的独立核对脚本只读计算哈希并做静态包面检查。它不是业务测试，也不取代微信开发者工具或手机实测。具体操作和机器可读结果见本目录的 `verify-user-dev-packages.js` 与 `package-identity-review.json`。

## 2. 候选身份与边界

| 候选/用途 | 固定路径 | 身份核对 |
|---|---|---|
| 手机实际运行包 user-v2 | `Resources/报告/T05R02-DSH-用户包补正-证据-v1/out/user-v2` | 72 文件 / 929,784 B；treeDigest `sha256:ada8d989f82f9cbd5c77824d416fa9b24a6c958f36bb8962b17ff220569910c4`；与清单逐文件一致 |
| 同源比较包 dev-v2 | `Resources/报告/T05R02-DSH-用户包补正-证据-v1/out/dev-v2` | 81 文件 / 1,030,448 B；treeDigest `sha256:ece1cc4dbfafd8b803f8070e71b23762dbbd7a81030701107506b6a282bf66cd`；只用于对照，不能代替 user-v2 手机测试 |
| 本次合流源码 | `Resources/报告/T05R02-DSH-用户包补正-证据-v1/workcopy/miniprogram` | 81 文件 / 1,030,448 B；treeDigest `sha256:910b4470b7e256154f9b5dc588122d4eaa64d94bd4341a1d326b27b8edc97745`，与 T06g/T05R02 记录一致 |
| 生产目录 | `miniprogram/` | 当前仍是 a62；不等于本次手机测试包，不可将其截图或运行结果冒充 user-v2 |

两包共有 72 个文件，其中 7 个内容不同；user-v2 没有独占文件，dev-v2 另有 9 个文件，含开发页、模拟输入与 T02 页面。user-v2 静态核对确认未注册/包含开发页、T02 页或模拟输入，教程、菜单升级、普通备份入口存在，首页/个人资料/数据/菜单页未发现 JSON 文本域。此项证明包面与清单，不证明微信 UI 实际行为。

两包携带相同 WASM：111,554 B，SHA256 `B0098453B7251C2FF39C65B3DF932E7E15975E4252A036196EBF63638A3DC5DD`；菜单源 SHA256 `69748A5D72AD215040B16E8AF4758CAC0E207E7FF2C6D6BD4A7770583E95C7AB`。目录版本为 `west1-canteen-batch1-nutrition35-chuanxiang6-20261024`，规范化目录摘要匹配 `sha256:23c0eda554226f9ecda0d4b973e57eabc697abe9e5ca34b7058fd45b30ff44ea`，含 6 个时段、91 道技术菜品、62 个可售项。对应 T09b 数据分项仍适用于本候选。

T06g candidate/core 与 T08N integrated-candidate/core 均为 25 个文件、501,558 B，逐文件一致，树摘要 `sha256:9733f49edad4c53075976fff1461c83601e73fae22c4d3aa0601f266fab87d4a`。user-v2 的 WASM 与 a62/T06g 核心产物一致，因此既有算法证据可按明确范围复用；这不自动证明当前手机体验或性能。

## 3. 证据类型与复用规则

- **本次独立静态核对：** 本目录脚本对 user-v2/dev-v2 清单、源码树、目录摘要、两包差异、入口隔离和 native 产物做了哈希/文件检查；`allManifestChecksPass: true`。无业务代码执行。
- **供应方 Node/自动化或 DevTools 模拟器材料：** T05R02 反馈记录了用户流程、教程完成、自选菜确认、主题/模式、旧菜单升级、备份导出及回读、恢复数据经自动化注入后的日志核对、无效摘要拒绝。它们属于交付方报告的模拟器/自动化证据，不是本次 P09 独立复跑，自动注入也不能证明真实文件选择器。
- **P01 独立核对：** `T05R02-P01-用户包接收核对-20261026-v1/verification.json` 核了包身份与既存 G1 请求/结果原始配对；G1 未因本次预审重跑。P01 未重跑 GUI、真实文件选择/分享、手机或性能。
- **算法证据：** T08M01 Oracle 结果可复用于未变核心语义；T08N02 的 `locked` 字段增量由 N02/P01 双端限定算例验证，N03 证明注释变更范围，T08N04 是限定批次的 native 泄漏检查。上述证据不能拼接成“本次候选所有场景、所有验收均通过”。
- **性能：** T08a4 整体 PASS 已由 P01 否决。保留的 PC 原始诊断值是 G2 DP 271.439 ms、G3 DP 529.803 ms / BnB 808.908 ms；不能外推到红米或用户可见渲染达标。按卡不重复跑 PC 矩阵。

## 4. A01—A12 逐项预审

| 项 | 当前裁定 | 可接收范围与依据 | 缺项/下一责任人 |
|---|---|---|---|
| A01 主流程 | 部分 | T05R02 模拟器记录覆盖教程、自选/确认等部分用户路径；静态入口与本次 user-v2 身份已核。 | PRD 所列资料→三餐主备选→换菜→确认/编辑/撤销/补记→仅重算未食部分，尚无完整 user-v2 同包端到端证据。T08a5 手机执行者补记录，P09 总审核对。 |
| A02 菜单/份量/锁定 | 数据分项可复用；交互未总验 | T09b 已核当前 a62 数据映射；user-v2 菜单源、目录摘要及 WASM 与固定候选匹配。N02/P01 限定核了 locked 序列化。 | 真实用户菜单展示、售罄、份量、组合饭、锁定 UI 仍随手机同包核验；P09 汇总。 |
| A03 预算与无解 | 算法语义可复用；用户表现部分 | M01 Oracle 与未变核心一致，能支持原始算法范围。 | 当前 user-v2 上的预算边界、无解/近似/不完整提示及交互证据不足；按 T08a5 当前包场景补充，P09 判定。 |
| A04 营养估算 | 分项通过可复用 | T09b-P09 a62 数据分项核对已通过；目录版本/摘要在 user-v2 中匹配。按已批准假设和中心值沿用。 | 不重新索要照片、克重或品牌；若手机发现显示/单位问题，由 T08a5 留同候选证据，P09 对照既有计算。 |
| A05 算法正确性 | 既有范围通过可复用 | T08M01 独立 Oracle；T08N02/P01 对新增 locked 行为的限定双端核验；T06g 核心源与 T08N 核心源相同，user-v2 WASM hash 相同。 | 不代表全场景或手机验收。若手机发现新输入差异，P09 再按差异定向核对；本次未重跑 Oracle。 |
| A06 Native/WASM/设备一致性 | 限定范围可接收 | P01 对 7 个 a62 native/WASM locked 算例逐字节/规范化比对；本次确认 user-v2 携带同一 WASM。 | 没有本轮 Redmi 真机调用/一致性记录。T08a5 补当前 user-v2 设备记录，P09 汇总。 |
| A07 错误与导入 | 部分 | T05R02 交付方模拟器报告称无效摘要被拒绝；user-v2 有普通备份能力，且与固定清单一致。 | 真实文件选择、损坏/版本错误等导入恢复路径没有 P09 独立手机证据；交付方需按 T08a5 记录实际系统文件流程。 |
| A08 幂等/备份恢复 | 部分 | T05R02 报告导出文件 100,927 B 并回读；恢复文本经自动化注入，随后检查多日日志。 | 自动注入不等于真实 `wx.chooseMessageFile`、分享面板或手机恢复。T08a5 补实机原始材料，P09 核对。 |
| A09 工程质量 | 例外已接受，限定检查通过 | 注释有效比例 12.47%，低于原定 20%；用户已接受现状，不记为 20% 达成且不重开。无页面消费者的两个文本 getter 已由 P01 接受，不要求剥离或重打包。N04 修正口径为 453 次真实 ABI 调用，在该请求集未见泄漏；P01 重跑正/负控制。 | N04 未由 P01 重跑交付方全部业务批次，结论限于其覆盖集。源码构建/警告材料见 T08N；不据此扩张为全验收。 |
| A10 性能/冷启动 | 待实机 | T08a4 PC 数值只作原始诊断；P01 否决 T08a4 整体 PASS。原目标仍是核心 50 ms、可见渲染 300 ms、768 页；现有材料不证明达成。 | T08a5 对 user-v2 在目标 Redmi 的同候选原始矩阵、冷启动/可见渲染/规模证据待交付。T08a5 执行者负责，P01/P09 收口。 |
| A11 朋友试用 | 未开始/待反馈 | 目前没有真实朋友反馈材料。 | 需实际朋友按任务反馈；用户本人或 AI 不可代替。由用户组织真实试用，P09 仅据原始反馈裁定。 |
| A12 演示/运行/问答 | 入口可追溯；演示闭环未完成 | 本反馈列出当前 user-v2 路径、构建方法、源码、正确 native CLI 和问答证据。 | 当前候选手机截图、性能数据和最终演示素材尚缺；T10a 旧索引指向旧根候选/旧菜单或 WASM，应以本反馈入口为准，后续由 P01 更新索引。PPT/稿子不在本次修改范围。 |

## 5. A12 当前运行入口

**手机候选：** `Resources/报告/T05R02-DSH-用户包补正-证据-v1/out/user-v2`。不要用 dev-v2、生产 `miniprogram/`、旧 user-v1 或 workcopy 替代。

**源码与构建记录：** 完整 T06g 合流源码位于 `Resources/报告/T05R02-DSH-用户包补正-证据-v1/workcopy/miniprogram`，源码摘要为 `910b4470…c97745`。既有构建命令记录为：

```powershell
node --import ./workcopy/tools/miniprogram/register-ts.mjs build-user-dev.mjs --source ./workcopy/miniprogram --out ./out --target all --version v2
```

命令的工作目录为 `Resources/报告/T05R02-DSH-用户包补正-证据-v1`。这是身份追溯信息，本次没有重新构建或覆盖输出。

**Native 核心源码：** `Resources/报告/T06g-ZCode-菜单教程汇合-证据-v1/candidate/core`。**正确 native CLI：** `Resources/报告/T08N-ZCode-最终收尾归集-证据-v1/build-scripts/toolchain/build/native/mp_cli.exe`，382,464 B，SHA256 `2DAE456921AB5E9F414140D26E676EF6A35C3D138C2356AB6E5FF4B3466110BA`。不要使用继承目录 `integrated-candidate/build/native/mp_cli.exe`。

**Native 构建脚本：** `Resources/报告/T08N-ZCode-最终收尾归集-证据-v1/build-scripts/build_native_t08n.ps1`；使用 PowerShell 5.1/7 和 `D:\Microsoft Visual Studio\VC\Auxiliary\Build\vcvars64.bat`，编译参数 `/std:c++17 /W4 /EHsc /permissive- /utf-8 /Zc:__cplusplus`。该脚本固定从 T08N integrated candidate 构建；本次未执行。

CLI 形态为：

```text
mp_cli.exe <nutrition-target|plan|validate-menu|offer-nutrition> <request.json> [--out <result.json>]
```

**算法问答材料：** `Resources/报告/T08M01-ZCode-算法终验-交付反馈-v1.md` 及其 `证据-v1/task1/two_layer` 原始材料；locked 字段补充看 `Resources/报告/T08N02-ZCode-计划项锁定字段-证据-v1`；营养口径看 T01 冻结契约/配置和 `Resources/报告/T09b-P09-a62数据分项核对-证据-v1`；性能边界看 `Resources/报告/T08a4-T09b-P01-查收核对-20261025-v1`。

## 6. 最小缺项与后续责任

1. **T08a5 当前 user-v2 手机实测：** 原始设备/系统/包身份、真实流程、系统文件选择/分享、冷启动与性能矩阵、失败情况及截图/日志。真实反馈尚未提交；本次不等待。
2. **A11 真实朋友试用：** 需要参与者实际反馈和原始记录，不用用户自评或 AI 模拟替代。
3. **P09 最终 T09：** 上述材料到齐后，再按同一 user-v2 候选审 A01—A12；本预审不提前宣告总审通过。
4. **P01/T10a 索引：** 后续把本报告的当前候选、源码、CLI 和性能状态入口同步到演示索引；不在本次编辑旧索引或 PPT。

本次没有发现足以在预审阶段确认的新增产品阻断缺陷；这表示“当前材料审阅未确认”，不表示产品无缺陷或最终验收通过。除上述最小缺项外不另开新的算法重跑、营养资料追索或代码清理任务。

## 7. 依据材料

- `Resources/任务卡/T09c-P09-user-v2总审预审小卡-20261026-v1.md`
- `Resources/任务卡/T09-独立总审.md`、主 PRD v0.2、项目 MEMORY 当前记录
- `Resources/报告/T05R02-P01-user-v2接收与实机总审安排-20261026-v1.md`
- `Resources/报告/T05R02-P01-用户包接收核对-20261026-v1/verification.json`
- `Resources/报告/T05R02-DSH-用户包补正-证据-v1`、`T05R02` 交付反馈、T05R01/T06g 接收和汇合材料
- `Resources/报告/T09b-P09-a62数据分项核对-证据-v1` 与 T09b 交付反馈
- `Resources/报告/T08M01-ZCode-算法终验-证据-v1`、`T08N02`、`T08N03`、`T08N04`、`T08N-P01-独立核对-20261025-v1`
- `Resources/报告/T05U10-DSH-四步新手教程-证据-v1`、`T06f-ZCode-a62逐文件推广-证据-v1`
- `Resources/报告/T08a4-T09b-P01-查收核对-20261025-v1`、`T08a5-反重力-user-v2实机与性能收口-证据-v1`
- 本次新增只读核对：本目录 `verify-user-dev-packages.js`、`package-identity-review.json`

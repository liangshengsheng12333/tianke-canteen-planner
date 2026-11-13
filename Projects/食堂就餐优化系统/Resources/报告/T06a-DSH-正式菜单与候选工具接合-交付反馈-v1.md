# T06a · DSH · 四道营养正式菜单与候选工具接合 · 交付反馈 v1

| 项 | 值 |
| --- | --- |
| 任务卡 / 提示词 | `Resources\任务提示词\T06a-DSH-正式菜单与候选工具接合-v2.md`（P01 放行依据 `Resources\报告\T03d-P01-接收与T06a放行裁定-20261023-v1.md`） |
| 日期 | 2026-10-23（Asia/Shanghai，本地时间约 12:37–12:50） |
| 角色 | DSH 前端/工具写入者（生产小程序 `miniprogram/` 与 `tools/miniprogram/`） |
| 项目根（绝对 cwd） | `D:\项目\cpp\Projects\食堂就餐优化系统` |
| 请求模型 | DeepSeek V4.1 Flash；原生推理档未指定 |
| 实际模型 | `deepseek-v4.1-flash-1017`（本会话客户端标识） |
| 服务器侧实际型号/档位 | **未知**（客户端不回传，不能把请求配置当实际证明） |
| 结论 | **完成（自验通过，待 P02/P01 查收）**；无阻塞，未启动 T06b |
| 唯一反馈 | 本文件 |
| 证据目录 | `Resources\报告\T06a-DSH-正式菜单与候选工具接合-证据-v1\`（索引见其 `README.md`） |

> 所有“通过”均为 **Node.js 宿主 + 包内 A11 WASM + mock wx 存储**的执行方自验；**不是微信开发者工具模拟器、不是真机**，不代替 T06b/T07/T09。

## 1. 输入身份（开工前现场复算）

| 输入 | 实测身份 | 与 P01 接收值 |
| --- | --- | --- |
| T03d 正式菜单 `Resources\真实菜单\西院西一食堂-20261022\T03d-v1\menu-catalog.json` | 37,157 B / SHA-256 `0657E2B26F2AE19EBAF98322AA9A167E3D0350C8D2132A8FF11F9D037981C607` | 一致 |
| 内嵌 `menuVersion` | `west1-canteen-batch1-nutrition4-20261023` | 一致 |
| 内嵌 `catalogHash` | `sha256:020f904dcd3ba8cd3d017a588692b69adc4127aca98b56487a5c9d94bd0764b5` | 一致；可被规范化序列化复算 |
| 来源映射 `白名单与来源映射.md` | 12,850 B / `0A5B7AEA09D80DA3A8A89E061DA0F22E4335522220EA53927F21AEC64A936A0C` | 一致（仅核对，未改） |
| 包内 A11 WASM `miniprogram\src\assets\wasm\mp_core.wasm` | 107,472 B / `B53C7405A643E8409071ED76D3CB4CCBDF1A37E6E5C408CE1D4A373D4CC00744` | 一致 |
| 旧内置基线 T03b | 34,660 B / `ECC711034C2F438F2864D0987A0F4724CF42F5C844BDEDB20D20DA05FBD41CB5`；内嵌副本改前与它逐字段相同 | 一致 |
| T05N02 生产基线 | 75 文件 / 866,998 B / `sha256:44996b06b1a553df106b6b3c1eefa5e47273e409ee923267adee5117e58d6642` | 与 T05N02 交付值一致，未见漂移 |
| 生产前端写入者 | 本会话唯一写入者；开工时无第二名生产前端写入者 | — |

## 2. 逐文件改动（候选内共 5 个文件；其余 108 个候选文件逐字节相同）

| 文件（相对项目根） | 字节（前 → 后） | SHA-256（前 → 后） | 改动内容 |
| --- | --- | --- | --- |
| `miniprogram\src\config\west1-menu.ts` | 35,042 → 37,814 | `6FA3CF89B9BC1696BF110642478D77EE61FC13A47956502C496B8697F482DD33` → `2550BDCFE2F075C65E6EAA73D3518FEBFB595D88D4E2B2E63DF48BE52F6FA26E` | 只读副本换为 T03d 原样 JSON；来源元信息（路径/字节/SHA-256/catalogHash/menuVersion/计数/营养覆盖标记）同步；四道营养与 basis 随之更新，其余 31 道仍 null |
| `miniprogram\src\mock\simulated-inputs.ts` | 31,997 → 32,940 | `E3F0FBD410EBFEDEDBEB65E097A67BB64F9F1840739D56F0EE93DD74B40F6144` → `A3D956B72F37EBC867BA32668C30B0C756E3C81C44AA28C26844298A36E3262B` | 四类模拟夹具的 `plannerConfig.limits` 改为契约四字段；success/targetUnavailable/invalid 用 64/20000/200000/null，resourceLimited 用 maxSearchNodes=3；保留 SIMULATED 标识 |
| `tools\miniprogram\candidate-manifest.mjs` | 4,172 → 4,174 | `5177AE599AB8228DF4A331D3E50F4F27A6C5CD1E51E5C6D7B2108A2E1DDD8937` → `851F78273587D7C7239B12D2E5A9F94D12931B50AB42468D5663410D83370338` | `FROZEN_WASM` 从 T02 旧值改为包内 A11：107,472 B / `B53C7405…00744`；注释同步；逻辑未变 |
| `tools\miniprogram\gen-sim-inputs.mjs`（**范围外必要文件**，见 §5.1） | 4,241 → 5,711 | `7C9DD72B4794BDED09F95B4020D093516961B633C84430F68F7D62BE0C2DE3BA` → `68AABB8C9B1F27483C487152256D13D1D91FCA284C1B7253312896C80F1D96F5` | 生成器同步输出四字段 limits 与 resourceLimited 说明；否则重跑会静默回退第 3 项 |
| `tools\miniprogram\test-self-pick.mjs` | 28,704 → 38,985 | `62C75D23D4B9BA44E06085EC159719A2C42BFB73CD1384E5B7FE901229E59B04` → `99A557849EE6CFDB20AE13BE0A0ED73065045E4E267DDA030AEAE3C61DECEDC2` | 旧“营养恒为 null”断言改为“未取核心结果时才未知”；新增 11–13 以真实 A11 覆盖完整已知/部分未知/全未知；保留半份米饭与整份同价断言 |

> 生成 `west1-menu.ts` 的脚本首跑多写了一个 `}`，当场由下一次运行发现并修正；之后全部检查复跑通过，最终身份以本表为准（过程记录见证据 `checks\west1-menu-update.json`）。
> 未写入：C++ 核心、WASM 二进制、共享契约、T03d/T03b 原件、用户记录、`MEMORY/`；未新增营养值或第二套算法。

## 3. 固定候选身份（交付后）

- `miniprogram/src`：**75 文件 / 870,713 B / `sha256:ed137fa0afe146f62c11ae4f8942b2549850411c173b96f922151c090722099f`**
- `tools/miniprogram`：38 文件 / 445,590 B
- 包内 WASM 冻结身份：107,472 B / `B53C7405A643E8409071ED76D3CB4CCBDF1A37E6E5C408CE1D4A373D4CC00744`，`frozenWasmMatches:true`，脚本 exit 0
- 对比开工基线与交付：**5 文件改动、108 文件逐字节相同**（`checks\changed-files.json`）
- 本候选是 T06a 交付候选，**不声称**已通过 T06b/真机/T07/T09 或整版冻结。

## 4. 四项验收阈值

| # | 阈值 | 状态 | 证据 |
| --- | --- | --- | --- |
| 1 | 内置菜单在既有导入/预检路径可识别 T03d 版本与 `catalogHash`；四道值与 T03d 逐项一致；其余 31 道四项未知；价格/餐次/窗口不变 | **通过** | `checks\menu-embed.json` 26/26；`checks\menu-preflight.json` 16/16（preflight `stage=ready`，消息含 `west1-canteen-batch1-nutrition4-20261023` 与“窗口 5，菜品 35，报价 35”，apply 后 `west1Applied` 判定命中） |
| 2 | `frozenWasmMatches:true` 且清单记录包内 A11 真实身份 | **通过** | `checks\candidate-manifest.txt`、`after\manifest.json`（exit 0） |
| 3 | 旧 `limits` 夹具发送规范四字段；受影响目标检查无旧别名错误 | **通过** | `checks\fixtures-core.json` 25/25：四夹具均四字段、无 maxCandidates/maxNodes；A11 `PlanDay` 依次为 OkPartial(2 plans)/TargetUnavailable/INVALID_INPUT(`$.plannerConfig.maxItemsPerMeal`)/ResourceLimited(capsHit maxSearchNodes=3) |
| 4 | 自选页完整已知、部分未知、全未知三类从统一核心返回并在预览中保留；未知仍 null 不当 0，`estimated` 透传；半份米饭同价断言保留 | **通过** | `checks\test-self-pick.txt` 13/13；新增 11–13 分别断言 `232/44/6/516`、`{120,null,null,null}` 合计、全未知 `sums=null`+四项待补全；测试 1 中 `riceHalf.priceCents===100` 保留 |

## 5. 范围说明

### 5.1 唯一范围外文件 `gen-sim-inputs.mjs`（已列明理由）

`simulated-inputs.ts` 文件头注明“由 `gen-sim-inputs.mjs` 自动生成，请勿手工修改”。若只改生成物不改生成器，任何一次重跑都会把旧 `limits.maxNodes` 静默带回来，使第 3 项验收失效。因此同步改了生成器：新增四字段常量与四个夹具的赋值、更新 resourceLimited 描述/`_note`、补一句 T06a 适配说明；逐文件身份见 §2。未改 T02 证据源文件与其 sha256 元数据。

### 5.2 已知遗留（未在本卡修改，建议 T06b/后续统一收口）

1. `tools\miniprogram\t05-test-helpers.mjs` 仍冻结 T02 WASM 身份（72,881 B / `715CD770…`）。`readWasmChecked()/environmentInfo()` 被 `measure-t05.mjs`、`verify-t05-integration.mjs`、`test-t05-soldout-scope.mjs`、`test-t05-store.mjs` 使用，当前候选上会在身份校验处直接失败。本卡只点名了 `candidate-manifest.mjs`，未扩大写入。
2. `tools\miniprogram\test-t05-store.mjs` 第 12 项、`verify-t05-integration.mjs` 第 10 场景仍断言“请求携带旧 `settings.limits{maxNodes:3}`”；T05N02 起 `domain\plan.ts` 固定发送契约四字段，这两个旧断言已过时。本卡未运行也未改这两处。
3. `domain\types.ts` 的 `PlannerSettings.limits` 旧 T02 形状与 `store.saveSettings` 的旧键校验仍在；P01 已注明 T06 统一整理，本卡未动。
4. 模拟夹具的 `file/sha256` 元数据仍指 T02 源文件身份（源文件未改），已在生成器与反馈中注明。

## 6. 实际检查（原始命令与结果）

| 检查 | 命令（项目根） | 结果 |
| --- | --- | --- |
| 类型检查 | `node tools/miniprogram/typecheck-src.mjs` | wechat-devtools TS 4.1.2 **0 errors / 38 files**；antigravity TS 5.9.3 **0 errors / 38 files** |
| 定向自选检查 | `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-self-pick.mjs` | **13 tests / 13 pass / 0 fail**（原 10 项 + 新增 3 项） |
| 菜单内嵌核对 | `node --import ./tools/miniprogram/register-ts.mjs "<证据>\scripts\verify-menu-embed.mjs"` | **26/26 通过**，0 失败 |
| 菜单预检/应用 | `node --import ./tools/miniprogram/register-ts.mjs "<证据>\scripts\preflight-menu.mjs"` | **16/16 通过**，0 失败 |
| 夹具旧别名回归 | `node --import ./tools/miniprogram/register-ts.mjs "<证据>\scripts\check-fixtures-core.mjs"` | **25/25 通过**，0 失败 |
| 候选清单 | `node tools/miniprogram/candidate-manifest.mjs --out "<证据>\after"` | `frozenWasmMatches:true`，exit 0；清单与基线对比见 `checks\changed-files.json` |

（`<证据>` = `Resources\报告\T06a-DSH-正式菜单与候选工具接合-证据-v1`。）

## 7. 未测项 / 限制

- 未运行微信开发者工具模拟器、未做真机验证、未做性能/内存专项；未重复 T05 全量回归矩阵。
- 未做 T06b 全流程（双模式今日/月历/设置/界面整合）、T07 集中测试、T08、T09 总审。
- 未验证 dp/branchAndBound 与 UI 交互；UI 仍固定 greedy（沿用既有设计）。
- 营养值本身沿用 P01 已接收的 T03d，本次未重新做营养来源复核（属 P09/T03 范围）。
- 上述所有通过项是执行方自验；P02 材料查收与 P09 独立复核仍需另行进行。

## 8. 阻塞与接续

- 阻塞：**无**。
- 完成后停止，不启动 T06b；交 P02 查收、P01 复核。若 P01 需要我在同一候选上补跑模拟器/真机证据，请另发单项授权。

【结束】
# T05U04 · 我的与设置收口 · 交付反馈 v1

- 任务卡：`Resources\任务提示词\T05U04-DSH-我的与设置收口-v1.md`
- 主 PRD：v0.2（含修订记录）／设计输入：`Resources\报告\天科食客-双模式界面设计定稿-P01-v2.md` §2、§6
- 实际 cwd：`D:\项目\cpp\Projects\食堂就餐优化系统`
- 小程序根：`D:\项目\cpp\Projects\食堂就餐优化系统\miniprogram`
- 平台/角色：DSH（DeepSeek Harness）小程序前端执行员
- 指定模型：DeepSeek V4.1 Flash；窗口可见模型标识 `deepseek-v4.1-flash-1017`；**服务端真实模型/原生档位/额度：未知**（窗口只显示模型标识，无法核实服务端版本与配额）
- 结论：**本卡实现完成、静态检查与模拟器实测通过；未做真机、性能与 T05 整体复跑**（见“未测项”）

## 一、输入与产物候选

| 项 | 值 |
| --- | --- |
| 输入候选（U03） | `sha256:16f1009db3edcb97f27c33f6acc0e5a34db8deedbe8cbfaa37872586efd63372` |
| 输入规模 | 56 文件 / 665,454 B；tools 37 / 402,307 B；WASM 72,881 B（`715CD770…F31D52C`） |
| 输入核对 | 复制 U03 manifest/hashes 到证据 `00-输入候选/` 重算，mismatch=0 |
| **输出候选** | **`sha256:8625eb9cac74183b7a0dfc5441196c5289d9e3a23a77d5d93055367fa1c0cf5d`** |
| 输出规模 | 68 文件 / 705,479 B；tools 37 / 402,444 B |
| WASM | 未改动，与冻结文件一致（manifest `frozenWasm.matchesFrozen=true`） |
| 候选清单 | `Resources\报告\T05U04-DSH-我的与设置收口-证据-v1\00-输出候选\manifest.json`（含每文件 sha256） |

## 二、改动清单（候选内文件 sha256 前缀）

新增页面（4 文件/页）：
- `miniprogram/src/pages/profile-edit/index.ts`（28,106 B，`64c6a120d0555c74`）、`index.wxml`（11,048 B，`c8e73971dad2bfd0`）、`index.wxss`（1,219 B）、`index.json`
- `miniprogram/src/pages/budget/index.ts`（9,602 B，`5f56b7bb77380235`）、`index.wxml`（4,104 B）、`index.wxss`、`index.json`
- `miniprogram/src/pages/data/index.ts`（3,388 B，`897c9eadfca2d975`）、`index.wxml`（3,101 B）、`index.wxss`、`index.json`

改写页面：
- `miniprogram/src/pages/profile/index.ts`（11,591 B，`1307950d53a50df5`）——由“建档表单页”改为“我的”首页
- `miniprogram/src/pages/profile/index.wxml`（5,323 B）、`index.wxss`（2,722 B）、`index.json`
- `miniprogram/src/pages/menu/index.ts`（20,953 B，`438e80616a50119a`）——新增 `onLoad(query)` 读 `focus`；`reload()` 末尾调用 `scrollToFocus()`；其余逻辑未改
- `miniprogram/src/pages/menu/index.wxml`（13,348 B）——仅给四个分区加 `id="data-current|data-import|data-export|data-restore"` 锚点与按钮附加 class

共享配置/工具：
- `miniprogram/src/app.json`（511 B，`ad49f3eeea445e5f`）——`pages` 追加 `profile-edit`、`budget`、`data`
- `tools/miniprogram/check-pages.mjs`（6,279 B）——页面静态检查清单补三页

未改动：`core/`、冻结契约、WASM、日志/档案/备份业务语义、`pages/home`、`pages/logs`、`pages/appearance`、`pages/dev`。

## 三、页面结构与复用关系（不新增第二套状态）

“我的”首页 `pages/profile` 只做视图聚合，数据全部来自唯一 `AppStore`（`getApp().globalData.store`）：
- **当前目标**：`store.getHomeView()/currentTargetView()` 的目标摘要 + 状态徽标（目标可用/待补全等），点击进入资料页；
- **个人资料**：`store.getProfileView()` 摘要行 + “查看/编辑个人资料” → `pages/profile-edit`（摘要优先，未点“编辑资料”不展开表单；“取消编辑”回到摘要且不写库）；
- **预算与偏好**：`pages/budget` 复用 `store.saveSettings({budgetCents})`、`store.saveProfile(draft)`、`store.computeTarget()`；`budgetCents=null` 显示“未设置”、`0` 显示零预算，未知价格不按 0 计；
- **显示与外观**：复用 `utils/display-mode.ts`（`simple|full`）与 `utils/appearance.ts`（`light|dark|system`），两键 `tk.ui.displayMode.v1` / `tk.ui.appearance.v1` 独立写入并回读校验；选项同时用**边框 + ✓已选文字 + 说明文字**表达，外观提供浅色/深色/跟随系统三张预览块；“更多外观说明”仍链到旧 `pages/appearance`；
- **数据管理**：`pages/data` 复用 `store.getMenuView()` 与既有菜单/备份/恢复流程：更新菜单/导出备份/恢复备份均跳既有 `pages/menu`（带 `?focus=` 定位）；“备份摘要与原始数据”跳 `raw`；“诊断信息”作为次级入口进旧 `pages/dev`；
- 模拟菜单时显示“示例菜单（模拟）”徽标（来自 `store.catalogIsSimulated()`/menu 来源），真实导入后不显示。

## 四、实际操作与验证结果

### 4.1 静态检查（证据 `01-静态检查/`）
- `node tools/miniprogram/typecheck-src.mjs`：微信 TS 4.1.2 **0 错 / 34 文件**；Antigravity TS 5.9.3 **0 错 / 34 文件**
- `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/check-pages.mjs`：**27 项 PASS**（9 页：WXML 闭合、事件绑定、mustache 根标识符、四件套齐全）

### 4.2 微信开发者工具实测（证据 `02-微信实测/01–16` + `17/18` console）
iOS iPhone 12/13 模拟器 351×760，基础库 3.17.4；最终候选上重拍：

| # | 操作 | 实测结果 |
| --- | --- | --- |
| 01 | 今日 → 我的 | 目标摘要（REE 1689 kcal / 活动系数 1.550 / 维持体重）+ 四个分组 + 底部三 tab 正常 |
| 02 | 显示模式切“完整” | 仅 `tk.ui.displayMode.v1=full`；业务状态哈希不变（12536 字符 / h 一致） |
| 03b | 主题切“深色” + 完整 | `tk.ui.appearance.v1=dark`，`themeClass=tk-dark`；模式仍 full；深色下卡片/选中态可读 |
| 15b | 恢复浅色/简易 | 两组选项均显示“✓ 已选”，说明文案“两组独立”可见 |
| 04 | 我的 → 查看/编辑个人资料 | 默认显示已存摘要（7 行、revision 1），**表单不展开** |
| 05 | 点“编辑资料” | 展开身体档案表单（性别/年龄/身高/体重/体脂率/活动水平/目标） |
| 06 | 点“取消编辑” | 回到摘要，`revision` 仍 1（未写库） |
| 07 | 年龄清空后保存 | 显示“请填写年龄”，`revision` 不变；取消后恢复 22 岁 |
| 08 | 我的 → 打开预算与偏好 | 全天预算 + 口味/训练偏好，档案已保存状态 |
| 09 | 预算填 `abc` 保存 → 填 `30` 保存 | `abc` 不写库（`budgetCents=null`）；`30` → `budgetCents=3000`，提示“请回今日页刷新方案” |
| 10 | 口味“清淡，少辣”+ 训练偏好开 → 保存偏好 | `revision 1→2`，`tastes=["清淡","少辣"]`，目标按新档案重算 |
| 11 | 我的 → 打开数据管理 | 当前菜单 5 行（版本/来源/内容/导入时间/导入文件）+ 三个操作入口 + 技术信息 |
| 12 | 数据管理 → 更新菜单 | 进入 `pages/menu` 并**直接定位到“导入菜单”分区**（focus 生效） |
| 13 | 粘贴 `{ not json` → 预检 | `stage=parse`、`ready=false`、错误可见；**业务状态哈希前后一致**（数据未损） |
| 14 | 粘贴合法备份 → 预检（不确认） | 摘要/版本/结构校验通过，摘要 `sha256:73fb6a48…0ec323`；点“取消恢复”后输入清空、**状态哈希不变** |
| 16 | 今日页点模式胶囊 | `simple→full`，主题仍浅色、`tk.ui.appearance.v1` 不变（两设置互不覆盖） |

补充实测（不截图，evaluate 断言）：
- 两组设置写入后重新打开页面仍为 `simple/light`，并从 storage 回读一致；
- 每次切换显示模式/主题，`store.state` 的 JSON 长度与哈希均不变（设置不触碰业务数据）；
- 测试后以 U03 生成前备份经 `preflightRestore/applyRestore` 还原：`digest=sha256:73fb6a48…0ec323`、当日有效日志 1、档案 revision 1、预算未设置、口味/偏好清空；UI 键复位 simple/light（见 `03-原始数据/02-测试后状态.json`）。

### 4.3 编译与 console
- 最终候选在模拟器**编译通过**、页面可交互；console 仅 `WeChatLib: 3.17.4` 一行，无小程序报错（`17-console-全部.txt`、`18-console-说明.txt`）。
- 过程中曾出现一次整包 `.wxss` 编译失败，根因为 PowerShell 改写文件写入 BOM（`pages/profile-edit/index.wxss(1:1): unexpected @`）；已扫描并清除 4 个文件 BOM，重编译通过，详见 `04-操作记录.md`。

## 五、逐项验收对照（任务卡）

| 验收点 | 结论 | 证据 |
| --- | --- | --- |
| “我的”作为统一入口，含资料/预算偏好/显示外观/数据管理 | 满足 | 01、03b、15b |
| 资料未编辑时不展开、显式编辑后可返回 | 满足 | 04、05、06 |
| 复用既有 profile/settings/菜单导入/备份/诊断能力，无第二套状态 | 满足 | 代码只调 `AppStore` 公开方法；`budget`/`data`/`profile` 均无本地持久化 |
| 主题与显示模式各自独立持久化 | 满足 | 02、03b、16 + storage 回读 |
| 预算 null/0 语义、未知价格不按 0 | 满足 | 08、09；`BudgetView.budgetSet/budgetCents` |
| 导入/备份取消或失败不损坏原数据 | 满足 | 13（失败）、14（预检后取消）；哈希前后一致 |
| 诊断放次级入口、示例菜单有标识 | 满足 | 11（技术信息）；模拟菜单徽标逻辑随 `catalogIsSimulated` |
| 不新增后端/账号/社区、不改 core/契约/WASM | 满足 | 候选清单仅前端页面与检查脚本变化，WASM 冻结校验 true |
| 不回归 U01–U03（主题/双模式/记录/月历） | 满足（抽查） | 02/16 双模式、console 无错；U03 页面未改 |
| 旧入口保留 | 满足 | `pages/appearance`（更多外观说明）、`pages/dev`（诊断）仍注册可进 |

## 六、未测项 / 限制

1. **未上真机**：仅 iOS 模拟器；红米等现场验收、真机字号/安全区未复测。
2. **未做性能测量、未重跑 T05 全链路**（本卡不要求，但因此不能视为 T05 整体通过）。
3. **恢复“确认应用”路径本轮未重跑**：U03 已覆盖确认恢复；本轮只验“预检 + 取消不写库”，且测试后正是用该备份成功还原（可视为确认路径的间接证据，但未重新截图）。
4. **文件选择对话框未重跑**：沿用 U03 结论（`wx.chooseMessageFile` 取消路径已验）；本轮数据管理页“更新菜单”只验证到进入菜单页并定位，未再次触发原生选文件窗口。
5. **“示例菜单”徽标未截到图**：测试数据处于已导入菜单状态，`simulated=false`，徽标条件不成立；代码路径存在但未以模拟菜单状态截图。
6. 开发者工具自身网络上报仍报 `ERR_PROXY_CONNECTION_FAILED`（系统代理 127.0.0.1:17891 未监听），非小程序代码问题；测试期间曾临时关闭系统代理，收尾已恢复原值。
7. 服务端模型档位/额度不可核实，已按“未知”记录。

## 七、U05（界面整合）交接提示

- 三页均已挂 `applyPageAppearance()`，`themeClass` 由页面 data 提供；整合时统一主题变量即可，不要改两处存储键。
- “我的”里 `入口` 与 `旧页面` 并存：`pages/appearance` 仅作外观说明页保留；`pages/dev` 仅作诊断次级入口。整合若合并入口，需同步 `pages/data/index.ts` 的 `onOpenTech/onOpenDev` 与 `pages/profile` 的 `onOpenAppearanceDetail`。
- 菜单页新增 `onLoad(query).focus` 仅做一次锚点滚动（`pendingFocus` 消费后清空），后续改动勿在 `reload()` 里重复滚动。
- 预算页/数据页不持有业务状态，全部走 `AppStore`；整合时不要复制逻辑。

## 八、证据位置

`Resources\报告\T05U04-DSH-我的与设置收口-证据-v1\`
- `00-输入候选/`：U03 manifest、hashes、核对说明
- `00-输出候选/manifest.json`：最终候选逐文件哈希与摘要
- `01-静态检查/`：typecheck、check-pages 原始输出
- `02-微信实测/`：01–16 截图、17 console、18 console 说明
- `03-原始数据/`：测试前/后状态、系统代理设置前后快照
- `04-操作记录.md`：时间线、环境故障与处理、候选一致性说明
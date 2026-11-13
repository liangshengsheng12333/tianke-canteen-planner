# T05U02｜DSH｜今日页双模式 交付反馈 v1

- 卡片：`Resources/任务提示词/T05U02-DSH-今日页双模式-v3.md`（v3｜2026-10-21，P01 核对前置后放行；用户手动转交）
- 设计输入：`Resources/报告/天科食客-双模式界面设计定稿-P01-v2.md` 第 3、4、5 节（只读）
- 产品输入：主 PRD v0.2 及其修订记录
- 执行角色：DSH 小程序前端执行员（external DSH）
- 反馈时间：2026-10-21 16:50（Asia/Shanghai）
- 绝对 cwd：`D:\项目\cpp`；项目根：`D:\项目\cpp\Projects\食堂就餐优化系统`
- 唯一反馈文件：本文件；局部证据目录：`Resources/报告/T05U02-DSH-今日页双模式-证据-v1/`

## 0. 状态摘要

本卡范围内的实现与局部自查在微信开发者工具中**实际编译、运行并截图**：今日页简易/完整双模式、三入口共用底部导航、完整模式营养区与全部营养/文案边界、模式与主题独立保存、餐次切换、跨页导航、长菜名、未知数据展示。

**未做**真机、T05 全量回归、性能测试、系统级退出重开、正式验收；**不宣称**本卡通过验收，等待 P01 核对并另行派发 U03。

“自己选菜”按卡要求保留为普通入口，但核心尚未提供手选能力，页面给出已知类别提示与明确的缺项说明，未使用 mock/静态 JSON/前端排序冒充。

## 1. 模型与执行环境

| 项 | 值 |
| --- | --- |
| P01 指定模型 | **DeepSeek V4.1 Flash** |
| 本会话可见模型 ID | `deepseek-v4.1-flash-1017`（会话运行配置中可见） |
| 服务端版本 / 原生思考档位 / 额度 | **未知**（无平台侧可核实证据，不臆测） |
| 工作区 | `D:\项目\cpp` |
| 权限 | 本会话 file policy = danger-full-access，审批提示关闭；未遇到沙盒拦截 |
| Node | v24.19.0 |
| 微信开发者工具 | 2.02.2609231 RC（`D:\微信小程序\微信web开发者工具`） |
| 基础库 / 模拟器 | 3.17.4 / iPhone 12/13（351×760 截图） |
| 编译方式 | 开发者工具原生编译（TypeScript 编译器插件），非本地预览器 |
| 备注 | CLI 传项目路径需用真实中文路径；`D:\t05u02proj` junction 仅用于早期 CLI 打开项目，不影响源码与候选 |

## 2. 输入候选与输出候选

### 2.1 输入（U01a 新候选，作者声明 + P02 已核对文件清单）

- `miniprogram/src`：52 文件、612,957 B
- 源码树摘要：`sha256:dc5e23f4e22ac23f5dd6962cc3917a3d265043403ec730aa2990e305a08267e1`
- `tools/miniprogram`：30 文件、329,008 B

### 2.2 输出（本卡实际测得，含改动）

- `miniprogram/src`：**55 文件、644,164 B**
- 源码树摘要：`sha256:483110d24346aaa4d8ba1ab44144dc38c5d3cabe35157b86e15fdd150f6b4c9e`
- `tools/miniprogram`：**33 文件、357,824 B**
- 清单与逐文件哈希：`证据-v1/00-候选清单/manifest.json`、`hashes.sha256`
- 冻结 WASM 未改：`miniprogram/src/assets/wasm/mp_core.wasm` = **72,881 B**，SHA256 `715CD7701B64D8F493A110C348B5F643979536578C7380C29837E05C4F31D52C`（与卡一致，manifest `frozenWasmMatches: true`）
- `src/app.json` = 429 B（与 P02 校正值一致）

候选增加了 3 个源文件、3 个工具文件（详见 §3），与 U01a 输入候选不同；本反馈的截图/数据只对应上表输出候选。

## 3. 改动文件（全部在卡允许范围）

新增源码：

| 文件 | 字节 | 作用 |
| --- | --- | --- |
| `miniprogram/src/utils/display-mode.ts` | 4,156 | 显示模式类型、默认 simple、`tk.ui.displayMode.v1` 存取与回读校验、时间餐次提示 |
| `miniprogram/src/utils/nutrition-display.ts` | 9,797 | 热量文案、克数格式、最大余数法比例分配、`buildMacroShares`、搭配说明 |
| `miniprogram/src/utils/tabbar.ts` | 1,788 | `MAIN_TABS`（今日/记录/我的）、`gotoMainTab` 防重复点击 |

修改源码：

| 文件 | 字节 | 改动 |
| --- | --- | --- |
| `pages/home/index.ts` | 30,291 | 重写今日页：双模式、餐次、卡片、小结、其他方案、详情/自己选菜/锁定/售罄/换菜/确认/结束重开、导航 |
| `pages/home/index.wxml` | 18,650 | 同上的结构（标题/日期/模式胶囊/餐次/餐卡/营养区/操作/小结/其他方案/浮层/底部导航） |
| `pages/home/index.wxss` | 10,343 | 今日页样式（含 58vh 浮层、营养区、比例条、悬浮导航占位） |
| `pages/home/index.json` | 47 | 导航标题“天科食客” |
| `app.wxss` | 11,640 | 玻璃卡/浮层/链接/大按钮令牌与三入口悬浮导航（纯 CSS 图标） |
| `domain/types.ts` | 18,791 | `ItemView.category`（搭配说明数据来源） |
| `domain/plan.ts` | 36,491 | 在计划与已确认记录条目中填充 `category` |
| `pages/logs/index.ts` | 34,964 | 三入口导航；`onLoad(query)` 接收 `?meal=` 并在 `onShow` 打开该餐确认面板 |
| `pages/logs/index.wxml` | 17,165 | 底部导航替换为共用实现 |
| `pages/profile/index.ts` | 28,786 | 三入口导航；`onOpenMenu`/`onOpenDev` 次级入口 |
| `pages/profile/index.wxml` | 13,381 | 数据管理卡片（菜单与备份、诊断）+ 共用导航 |
| `pages/menu/index.ts` | 19,940 | 移除旧五项底部导航，改 `onBack` 返回我的 |
| `pages/menu/index.wxml` | 13,148 | “‹ 返回我的”返回行 |
| `pages/dev/index.ts` | 17,985 | 同上 |
| `pages/dev/index.wxml` | 7,926 | 同上 |
| `miniprogram/README.md` | 4,589 | 页面与导航说明更新 |

新增工具（`tools/miniprogram/`）：

| 文件 | 字节 | 作用 |
| --- | --- | --- |
| `test-today-display.mjs` | 9,420 | 46 项：模式存取、时间边界、热量/克数文案、最大余数、T=0、缺项、负值等 |
| `test-home-view.mjs` | 14,283 | 36 项：假 wx/getApp/Page 下的首页数据流、模式/主题独立、切餐不写存储、跳转与防重复 |
| `make-longname-menu.mjs` | 5,113 | 生成本地“长菜名”模拟菜单（显式 SIMULATED，不改官方菜单与冻结模拟菜单） |

未修改：`core/`、`tools/core/`、冻结契约、正式菜单、日志业务模型/快照、WASM、外观模块（`utils/appearance.ts`）。

## 4. 实际命令与原始结果

原始输出：`证据-v1/01-静态检查/`、`02-微信实测/14-console.txt`、`02-微信实测/15-操作记录.md`。

```text
node tools/miniprogram/candidate-manifest.mjs --out Resources\报告\T05U02-DSH-今日页双模式-证据-v1\00-候选清单
  → sourceTreeDigest sha256:483110d2… , sourceFileCount 55, sourceBytes 644164,
    toolFileCount 33, toolBytes 357824, frozenWasmMatches true

node tools/miniprogram/typecheck-src.mjs
  → wechat-devtools (TS 4.1.2): 0 errors across 30 files
  → antigravity-ide (TS 5.9.3): 0 errors across 30 files

node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/check-pages.mjs
  → 全部页面静态检查通过（含今日/记录/我的/菜单/诊断/外观的标签闭合、事件方法、WXML 根标识符）

node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-today-display.mjs
  → 全部通过：46 项

node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-home-view.mjs
  → 全部通过：36 项
```

微信开发者工具（cli 通过 `wechatide.cmd -c DeepSeek`）：

```text
check_wechatide_status                     → success, loginExpired=false
simulator_open_page --page pages/home/index → success（原生编译并渲染今日页）
get_simulator_console 'grep -n .'           → 仅 WeChatLib 3.17.4 一行，无 error/warn
simulator_screenshot ×17                    → 351×760，均成功
```

编译通道说明：IDE 停在“欢迎使用微信开发者工具”页时，`automation_*` 全部超时（>120 s），
`simulator_refresh` 也只返回 success 而不真正重编译；由用户在 IDE 打开项目窗口并点一次工具栏“编译”
后，`desktop-08/09.png`（过程记录）显示“Loading project all files… → 页面正常渲染”，
自动化恢复。该通道问题与代码无关，建议后续派单写明“先确保模拟器已加载”。

## 5. 逐项自查（相对本卡范围）

| # | 要求 | 结果 | 证据 |
| --- | --- | --- | --- |
| 1 | 默认浅色 + 简易 | PASS | `01-light-simple.png`：简易胶囊、无营养克数/百分比、约 568 千卡 + 估算标签 + 估算说明、搭配说明、换一份/确认吃了/自己选菜/这餐详情 |
| 2 | 完整模式营养区 | PASS | `02-light-full.png`：三行克数/比例（9.6% / 3.0% / 87.4%，合计 100.0%）+ 单条三段比例条 + 说明；表与条使用同一结果 |
| 3 | 餐次切换 | PASS | `03-meal-lunch.png`；`12` 中早餐显示“已记”而当前选中晚餐（其他餐次已记状态可见） |
| 4 | 三入口共用底部导航 | PASS | `04`（记录选中）、`05`（我的选中）、各页同一 `MAIN_TABS` 实现；图标+文字+选中态；`我的→菜单/诊断` 路由实测命中 `pages/menu/index`、`pages/dev/index` |
| 5 | 模式/主题保存恢复 | PASS | `06`（深色外观页）、`07`（返回今日页仍“完整”+深色）、`10`（关闭并重开项目窗口后重进今日页仍 `mode=full`、`themeClass=tk-dark`） |
| 6 | 长菜名换行 | PASS | `11-long-name.png`：29 字菜名两行、价格列未被挤压、卡片结构稳定 |
| 7 | 未知数据展示 | PASS | `08-unknown-home.png`：已记录热量“待补全”、实付“￥0.00（不完整）”、“未知不按 0 计入”；`09-unknown-logs.png`：四项均“未知”、未知项 1 项（不按 0 计入）、记录行“营养未知/价格未知” |
| 8 | 保留既有业务入口 | PASS | `15` 详情（窗口/状态/计划合计/逐菜营养与锁定/标记售罄/换菜）；`16` 自己选菜；`13` 确认深链打开确认面板；浮动导航不挡末尾内容（`17`） |
| 9 | 模拟数据显式标注 | PASS | `01`–`03` 顶部“示例菜单 查看说明”；长菜名测试用菜单自带“模拟食堂（非真实菜单）”与 `nutritionBasis.note=SIMULATED`，未冒充真实菜单 |
| 10 | 首次餐次提示不写业务 | PASS | 16:5x 重进今日页：`hour=16`、`activeMeal=dinner`、`mealTouched=false`；仅按时间提示初始餐次，未自动确认/结束/补记；切模式、切主题均无 store 写入（单测 `test-home-view`） |

### 5.1 营养与文案边界逐条

| 边界 | 结果 | 证据 |
| --- | --- | --- |
| 热量估算显示“约 ×× 千卡”+估算提示 | PASS | `01`“约 568 千卡”+“估算”+“营养为估算值” |
| 热量不完整显示“热量待补全”，未知不显示 0 | PASS | 过程记录 `desktop-09.png`（未建档空计划卡）、“待补全”文案；单测覆盖 |
| 搭配说明仅用已知类别 | PASS | 三类已知：“主食、蛋白质食物、蔬菜都有”（`11`）；确实缺蔬菜：“这份没配蔬菜”（`01`/`03`）；类别不完整：“搭配信息待补”（空计划态，过程记录） |
| 比例公式 P=4·proteinDg、F=9·fatDg、C=4·carbDg、T=P+F+C | PASS | 单测 46 项；模拟器 9.6/3.0/87.4 与 32.3/17.9/49.8 等 |
| 一位小数、最大余数合计 100.0%、同余按蛋白→脂肪→碳水 | PASS | 单测：30/20/75 dg → 20.0/30.0/50.0；9/4/9 dg → 33.4/33.3/33.3；不整除场景合计 100.0% |
| T=0 → 三项已知 0 克 + “暂不显示比例” | PASS | 单测 |
| 负值/非有限 → 无效，不给比例 | PASS | 单测（invalid / 非有限按缺项） |
| 有未知项 → 保留已知克数、缺项写“待补全”、不画完整比例条 | PASS | 单测 + `08`/`09` 未知场景 |
| 计划价与实付分开；小结写“已记录” | PASS | `08`“已记录实付”与计划价分列；“今天已记 1 餐” |
| 无全天预算不放空预算卡 | PASS | `08` 小结无预算卡（只有未设置提示的空态处理在记录页，属 U03） |
| 切模式不改外观；切主题不改模式；均不重规划/记餐/清输入 | PASS | `07` 深色仍完整；单测记录零 store 写入、外观键未被触碰 |
| “增肌”不出现在本版目标 | PASS | 未新增该目标；沿用既有档案/目标字段 |

## 6. 已保留入口与缺失能力

- 今日 / 记录 / 我的：共用 `MAIN_TABS` + `gotoMainTab`，固定顺序、图标+文字、当前项高亮、重复点击不重复跳转。
- 菜单与诊断：原底部入口移至“我的 → 数据管理（次级入口）”，实测可进入并可用返回路径（菜单/诊断页“‹ 返回我的”，无页面栈时 reLaunch 我的）。
- 确认吃了：跳 `/pages/logs/index?meal=<meal>`，记录页 `onLoad` 暂存、`onShow` 打开该餐确认面板（该餐需可确认且有方案行；实测 `13` 打开成功）。
- 换一份、锁定窗口/菜品、标记/解除售罄、结束/重开、详情：沿用既有实现，页面入口与调用条件保持原样；本卡只重排与新增双模式/导航，未逐一重测全部动作分支。
- **自己选菜**：普通入口保留，但**核心尚无手动选菜能力**；页面显示已知类别提示与原样缺项说明（“当前版本还没有手动选菜能力：核心尚未提供手选入口，本页不生成替代方案…”），不生成假方案（`16`）。

## 7. 未测项（继承与新增）

1. 真机（红米/Android/iOS）与真机透传、导航栏/冷启动白闪、回前台主题同步：未做。
2. 微信运行时存储保存失败/回读不一致：仅用 Node 假 `wx` 覆盖失败分支（`test-home-view`），未在真机/异常存储环境触发。
3. “跟随系统”×简易/完整的组合：未单独截图（外观逻辑属 U01a，本卡未改外观模块；已验证切外观不改模式）。
4. 像素级对照 P01 HTML/截图：未做（仅作视觉方向）。
5. T05 全量回归、性能测试、正式红米验收、系统级退出重开：按卡不做。
6. 锁定/售罄/结束重开/换菜等既有动作的完整回归：仅保留入口与局部观察，未逐项重测。

## 8. 缺陷与限制（如实）

1. **导入菜单后“示例菜单”标记消失**：今日页示例标记依据“当前菜单 catalogHash = 仓库冻结模拟菜单 catalogHash”判定。通过正式粘贴入口导入 T02 的 `menu-simulated-v1`（哈希不同）后标记不再显示，而食堂名仍是“模拟食堂（非真实菜单）”。属既有判定逻辑，非本卡新增；建议 P01 判断是否改为按 `canteenId`/显式标注判定，避免本地测试数据看起来像真菜单。
2. **首次餐次提示的一次观察**：16:16 期间截到今日页首帧为早餐，但当天 16:5x 重进今日页实测 `hour=16、activeMeal=dinner、mealTouched=false`，按时间提示正确；推断 16:16 的早餐选中态来自模拟器侧人工点按（`mealTouched=true` 后 onShow 保持用户选择），不是缺陷。无法完全排除，故只记录不结案。
3. **记录/我的页正文会延伸到悬浮导航下方**（可滚动、底部有占位）；`17` 证明末尾内容完整可见，未被永久遮挡。
4. **开发者工具自动化依赖一次人工“编译”**：IDE 停在欢迎页时 automation 全部超时；不是代码问题，已记入操作记录。
5. 长菜名验证使用本地生成、显式标注 SIMULATED 的菜单（走菜单页“粘贴→预检→替换”正式入口），之后已用 T02 冻结模拟菜单恢复（`12`）；相关文件保留在 `03-原始数据/`。

## 9. U03 接续信息

- 今日页：`miniprogram/src/pages/home/index.ts|wxml|wxss`（数据字段 `view/card/summary/mealTabs/mode/themeClass/tabs/tab/activeMeal/detail/selfPick`）。
- 共用导航：`miniprogram/src/utils/tabbar.ts`（`MAIN_TABS`：今日 `/pages/home/index`、记录 `/pages/logs/index`、我的 `/pages/profile/index`）。
- 显示模式：`miniprogram/src/utils/display-mode.ts`（键 `tk.ui.displayMode.v1`，默认 `simple`，保存含回读校验）。
- 营养展示：`miniprogram/src/utils/nutrition-display.ts`（`energyDisplay`、`buildMacroShares`、`pairingText`、`knownCategoriesHint`）。
- 记录页深链：`/pages/logs/index?meal=breakfast|lunch|dinner`；`logs.onLoad` 暂存 `pendingMeal`，`onShow` 在“当日 + canConfirm + 有方案行”时打开确认面板。
- 次级入口：我的页 `onOpenMenu`/`onOpenDev`；菜单/诊断页 `onBack`（无页面栈时 reLaunch 我的）。
- 候选：`sha256:483110d2…`（55 文件/644,164 B）。U03 若继续改源码，需要新候选与新证据，本反馈截图只证明该候选。
- 下一步负责人：**P01**（核对本反馈与证据、决定 §8 限制项处理、另派 U03）。本卡完成反馈后停止，不自动外发、不通知其他角色、不自派下一卡。

## 10. 结论

本卡在 DSH 平台完成范围内实现与局部自查，证据见 `Resources/报告/T05U02-DSH-今日页双模式-证据-v1/`。
**本反馈不代表正式验收通过**：真机、回前台、冷启动、异常存储、全量回归与像素级对照均未验证，交由 P01 核对与后续固定候选集中验证。
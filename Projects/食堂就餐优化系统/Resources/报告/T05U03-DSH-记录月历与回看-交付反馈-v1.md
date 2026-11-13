# T05U03｜DSH｜记录月历与回看交付反馈 v1

- 状态：**已完成本卡范围内的实现与局部验证，待 P01 核对**。不冒充正式验收；真机、冷启动、异常存储、性能与全量回归未做（本卡明确不要求）。
- 平台/角色：DSH 小程序前端执行员
- 执行时间：2026-10-21 17:55—18:45（Asia/Shanghai）
- 绝对 cwd：`D:\项目\cpp`；项目根：`D:\项目\cpp\Projects\食堂就餐优化系统`
- 卡片：`Resources/任务提示词/T05U03-DSH-记录月历与回看-v3.md`（v3｜2026-10-21，P01 核对 U02 后准予接续）
- 产品输入：主 PRD v0.2 及其修订记录；设计只读 `Resources/报告/天科食客-双模式界面设计定稿-P01-v2.md` 第 6、11 节
- 上游反馈：`Resources/报告/T05U02-DSH-今日页双模式-交付反馈-v1.md`（已读 §2 身份与 §9 接续摘要）

## 0. 模型与实际可核实信息

| 项 | 值 |
| --- | --- |
| 卡片指定模型 | **DeepSeek V4.1 Flash** |
| 本会话可见模型 ID | `deepseek-v4.1-flash-1017`（会话运行配置中可见） |
| 服务端版本 / 原生思考档 / 额度 | **未知**（本会话无对应可核实证据；卡片未新指定档位） |
| 授权来源 | 用户手动转交本卡；无自动派发、无跨角色通知 |

## 1. 输入候选与输出候选

### 1.1 输入（U02 输出候选，作者声明 + P02 已核对）

- `miniprogram/src`：**55 文件、644,164 B**，源码树摘要 `sha256:483110d24346aaa4d8ba1ab44144dc38c5d3cabe35157b86e15fdd150f6b4c9e`
- `tools/miniprogram`：**33 文件、357,824 B**
- 说明：本卡动手前未单独保存 U02 输入树的逐文件快照（该清单在上游反馈的 `00-候选清单/` 内，P02 已核）。本卡对源码的改动全部列在 §2，未恢复覆盖任何历史文件；若需逐字节复核输入树，可与 U02 证据目录内 manifest 对照。

### 1.2 输出（本卡新候选，已冻结清单）

- `miniprogram/src`：**56 文件、665,454 B**（+1 新文件 `utils/calendar.ts`；其余为改动，未删文件）
- 源码树摘要：`sha256:16f1009db3edcb97f27c33f6acc0e5a34db8deedbe8cbfaa37872586efd63372`
- `tools/miniprogram`：**37 文件、402,307 B**（+4 个本卡局部检查/造数工具）
- 固定 WASM：`miniprogram/src/assets/wasm/mp_core.wasm` **72,881 B**、`715CD7701B64D8F493A110C348B5F643979536578C7380C29837E05C4F31D52C`，`matchesFrozen=true`
- 清单与逐文件哈希：`证据-v1/00-候选清单/manifest.json`、`hashes.sha256`

## 2. 修改文件（全部在允许范围内）

| 文件 | 字节 | 改动性质 |
| --- | --- | --- |
| `miniprogram/src/utils/calendar.ts` | 5,422 | **新增**：纯日期/月历函数（无业务、无存储、无 UI 依赖） |
| `miniprogram/src/domain/logs.ts` | 18,396 | 追加 `summarizeMonthLogs` + `MonthLogsSummary`，复用 `summarizeActiveLogs`；未改既有函数 |
| `miniprogram/src/domain/store.ts` | 83,891 | 追加只读 `getMonthLogs(monthKey)`；未改持久化、未改 ensureToday/写入/幂等路径 |
| `miniprogram/src/pages/logs/index.ts` | 42,293 | 记录页重写：月历、历史日只读、月汇总、空态、模式 |
| `miniprogram/src/pages/logs/index.wxml` | 20,181 | 日期条/月历/月汇总/空态；当日汇总卡在空态下不渲染 |
| `miniprogram/src/pages/logs/index.wxss` | 4,511 | `.date-bar`/`.cal-*`/`.month-*`/空态样式，全部用 `--tk-*` 主题变量 |
| `tools/miniprogram/test-calendar.mjs` | 7,114 | 新增 41 项月历纯函数检查 |
| `tools/miniprogram/test-month-summary.mjs` | 9,591 | 新增 35 项月汇总口径检查 |
| `tools/miniprogram/test-logs-page.mjs` | 21,226 | 新增 78 项记录页逻辑检查（受控 store） |
| `tools/miniprogram/make-u03-history-backup.mjs` | 6,552 | 新增：生成显式标注的模拟多日备份（仅测试造数） |

**未触碰**（mtime 仍为 U02 的 15:0x—15:1x）：`pages/home/*`、`pages/profile/*`、`utils/display-mode.ts`、`utils/appearance.ts`、`domain/types.ts`、`utils/canonical-json.ts`、`config/*`、`mock/*`、`assets/wasm/*`、`tools/core/*`、任何共享契约与日志持久化格式。本卡没有第二记录库、没有新的存储键；记录与统计全部读既有 `MealLog` 快照。

设计要点：

- 月历：周一起始、只渲染当月（相邻月留空格）、`有记录` 圆点 + `今天` 文字标记 + 选中态用**外框 + 内描边**（不只靠颜色）；前后月按“日号映射 + 月末夹取”，跨年后仍正确；提供“回到今天”。
- 历史日：`readonly = viewingDate !== todayDate`，只读提示“历史日期只读：仅可查看，不提供改写历史的入口”；菜名/价格/份量/营养读记录快照（实测快照菜名在当前菜单中不存在仍能显示）。
- 空态：按“有没有**有效**记录”判断（因此只剩已撤销/被替代历史的日期也算空态，历史条目只读展示），写“这天还没记餐 / 未记餐不代表摄入为零”，今天另有“记一餐”，历史空白日不提供改写入口；空态下**不渲染**当日汇总，避免出现“0 kcal”。
- 月汇总：`本月已记 X 天 · Y 餐` + 已知花费 + 已知热量；任一缺项标“含未填项”，已知合计为 0 但有缺项时显示“未知（含未填项）”，不写 ￥0.00 / 0 kcal。
- 模式：简易模式只给热量摘要；完整模式额外给已有蛋白/脂肪/碳水克数（取自 store 已有合计，不复制比例算法）；今日页“切换为完整模式”提示保留。
- 选日期/切月份只调 `loadDate()`：`ensureToday` + `getLogsView(date)` + 月汇总刷新，不写记录、不触发规划、不改快照（实测前后 store 快照逐字节一致）。

## 3. 日志与“有效记录”统计口径

- 只认 `MealLog.status === 'active'`；`superseded`（被修改替代）与 `revoked`（已撤销）不计入任何汇总。
- X（天）= 有效记录中 `businessDate` 去重数；Y（餐）= 有效记录中 `(businessDate, meal)` 去重数。同一天同一餐多次补记只计 1 餐，但金额/营养按有效明细相加。
- 花费只汇总 `priceKnown && unitPriceCents != null` 的明细；能量/蛋白/脂肪/碳水同理只汇总有值项；某日任一明细营养为 `null` 时该日能量整体按“未知”处理（沿用 `summarizeActiveLogs` 既有口径），不做“部分克数当整日”的伪精度。
- 缺项标记：花费或营养有任何未知 → `（含未填项）`；已知合计为 0 且存在缺项 → `未知（含未填项）`；完全无记录 → `0 天 · 0 餐`，不补成零摄入。
- 计划/推荐/待吃餐次不参与统计；未记录日期不补 0。

## 4. 局部验证（逐项）

### 4.1 静态检查（Node 本地）

| 检查 | 命令 | 结果 | 证据 |
| --- | --- | --- | --- |
| 类型检查（项目 TS 4.1.2） | `node tools/miniprogram/typecheck-src.mjs` | 0 errors / 31 files | `01-静态检查/01-typecheck.txt` |
| 类型检查（IDE TS 5.9.3） | 同上 | 0 errors / 31 files | 同上 |
| 页面静态检查 | `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/check-pages.mjs` | 全部页面 PASS（含记录页 27 个绑定标识符、事件方法一一对应） | `01-静态检查/02-check-pages.txt` |
| 月历纯函数 | `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-calendar.mjs` | 41/41 PASS | `01-静态检查/03-test-calendar.txt` |
| 月汇总口径 | `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-month-summary.mjs` | 35/35 PASS | `01-静态检查/04-test-month-summary.txt` |
| 记录页逻辑 | `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-logs-page.mjs` | 78/78 PASS | `01-静态检查/05-test-logs-page.txt` |

### 4.2 微信开发者工具实测（iPhone 12/13，351×760，基础库 3.17.4）

| # | 验收点 | 结果 | 证据（`02-微信实测/`） |
| --- | --- | --- | --- |
| 1 | 默认今天、三餐状态、已记食物与实付 | PASS | `01-记录页-默认今天-深色简易.png` |
| 2 | 初次空态“这天还没记餐”，不出现“摄入 0” | PASS | `06/07-空白日-…`；空态下汇总卡不渲染 |
| 2b | 只剩撤销/被替代历史的日期同样按空态处理（撤销后的 0 合计不能冒充 0 摄入），历史条目仍只读展示；今天只剩撤销记录时给“记一餐” | PASS | `24-今天只剩撤销记录-空态记一餐-浅色.png`；“历史记录（只读）”里显示已撤销条目，月汇总“0 天 0 餐” |
| 3 | “查看月历/收起月历”展开收起，周一起始 | PASS | `02-月历展开…png`、`05b-月历收起…png` |
| 4 | 前后月份切换 | PASS | `08-月历-上月…png` |
| 5 | 月末夹取（10-31 → 9-30） | PASS | `08`；`viewingDate=2026-09-30`、标题 2026年9月 |
| 6 | 今天 / 选中 / 有记录三种标记可区分 | PASS | `02`；选中=外框+内描边、今天=文字“今”、有记录=圆点 |
| 7 | 点日期刷新详情并保留月历展开与选中 | PASS | `03/04`；点击后 `calendarOpen` 保持 true，选中格跟随 |
| 8 | “回到今天” | PASS | `10-回到今天-深色.png`；回到 2026-10-21、`readonly=false` |
| 9 | 已记录历史日详情（只读、快照菜名） | PASS | `03/04/05`；显示“黑椒土豆泥盖饭（模拟历史快照）” |
| 10 | 空白日详情（历史只读、无 0 kcal） | PASS | `06/07` |
| 11 | 实付未知 / 热量未知提示 | PASS | `01`；`未知（含未填项）`、记录内 `￥0.00（不完整）` |
| 12 | 月汇总 X 天 · Y 餐（去重口径） | PASS | `01/02`；3 天 5 餐，同日同餐补记后仍 5 餐（`18`） |
| 13 | 编辑后统计一致（旧版本不重复计） | PASS | `17`；￥11.00 被 ￥20.00 替代，月汇总 ￥42.50 |
| 14 | 撤销成功/取消后统计一致 | PASS | 取消不变；确认后回退 3 天 5 餐 ￥22.50（见数值快照） |
| 15 | 补记成功/取消/失败后统计一致 | PASS | `18`（成功）、`19`（失败报错）；取消不变 |
| 16 | 简易/完整模式不回归 | PASS | `01`（简易仅热量）、`11/12/13`（完整含克数） |
| 17 | 浅色/深色主题不回归 | PASS | 深色 `01/02`，浅色 `13/14`；切换入口为“我的→调整外观” |
| 18 | 共用“今日/记录/我的”导航不回归 | PASS | 点底部“今日”切到 `pages/home/index`；各 tab 页均渲染底栏 |
| 19 | 控制台无 error/warn | PASS | `15-console.txt`、`22-console-全部.txt`（仅基础库信息行） |
| 20 | 编译通过 | PASS | `simulator_refresh`/`simulator_open_page` 均成功，页面实际渲染 |

关键数值（每一步的操作前后读数、store 状态快照）：`03-原始数据/09-实测关键数值快照.json`、`03-原始数据/05-切换日期前后-状态.json`。操作与偏差说明：`02-微信实测/23-操作记录.md`。

### 4.3 测试数据声明

- 截图（`01`—`24`、含 `05b`）全部在 §1.2 最终候选 `sha256:16f1009d…` 上重新采集（修正空态判定后重新编译并重跑全部场景），覆盖深色/浅色两套外观与简易/完整两种模式。
- 截图中的历史记录与菜名均为**显式模拟数据**，由 `tools/miniprogram/make-u03-history-backup.mjs` 生成，用一个当前菜单中不存在的菜名（“黑椒土豆泥盖饭（模拟历史快照）”）证明历史详情读记录快照；备份摘要 `sha256:5dcdc776…`。
- 测试结束后已用同一“恢复备份”入口还原生成前状态（摘要 `sha256:73fb6a48…`），模拟数据未留在模拟器中；还原后记录页仅今天 1 天 1 餐（`21-还原后-仅今天-浅色.png`）。
- 这些截图只对应 §1.2 输出候选；不代表正式验收、真机或真实用户数据。

## 5. 偏差与限制（如实记录）

1. 自动化无法把 1.7 万字符一次性输入 textarea：注入/还原时调用页面自身的 `onRestoreInput`/`onPreflightRestore`/`onApplyRestore`；其中还原一步在被压栈的菜单页实例上 `setData` 长文本被静默丢弃，改为调用 `store.preflightRestore/applyRestore`（AppStore 同一校验与原子写盘路径）。弹窗未确认前本机数据不变。
2. 撤销确认用原生 `wx.showModal`，自动化不能点原生弹窗：临时替换 `wx.showModal` 的 success 回调为 `{confirm:false}` / `{confirm:true}` 各验证一次；撤销逻辑本身走页面 `onRevoke → store.revokeLog`。
3. 同一餐次卡内多个按钮无稳定选择器：打开补记/确认面板时调用页面 `onOpenManual`/`onOpenConfirm`（参数与 WXML dataset 一致），面板内输入与提交/取消按钮仍为真实元素操作。
4. 本卡未重跑双击竞态；幂等沿用既有 store 实现与既有单测结论（本次实测补记表单每次打开换新 token，重复提交由既有机制处理）。
5. 未做：真机/红米正式验收、系统级退出重开与冷启动、弱网/离线、性能与像素级对照、完整历史回归。这些按卡片留给后续固定候选集中验证。

## 6. 未知数据与缺失字段

- 当前 `MealLog` 已能区分 `active/superseded/revoked`、业务日期、餐次、价格已知性和营养缺项，本卡统计不需要新增字段。
- 仍未知/未处理的既有事实（未在本卡修正、未登记为已实现）：导入冻结模拟菜单后示例标记消失（U05）、自己选菜尚只是缺项说明（另开专项）。
- 缺项展示：价格未知 → `￥0.00（不完整）` + 月/日汇总“含未填项”；营养未知 → 汇总“未知（含未填项）”，均不按 0 计入。

## 7. 范围合规自检

- 仅修改 `miniprogram/` 内记录页、月历/日期辅助与只读汇总视图 + `tools/miniprogram/` 本卡局部检查脚本。
- 未改核心算法、共享契约、日志持久化格式、幂等行为、档案/菜单数据、`core`、`tools/core`、WASM。
- 未创建第二记录库/第二统计源；无新增存储键；月汇总全部由既有 store 视图与日志快照推导。
- 未修改 U02 今日页行为与主题/显示模式状态；未复制或另造比例算法。
- 选日期/切换月份无任何写操作（store 快照前后一致）。

## 8. 下一卡 U04 可直接接续的入口

| 能力 | 实际入口 |
| --- | --- |
| “我的”页 | `miniprogram/src/pages/profile/index.{ts,wxml,wxss}`（ts 28,786 B；卡片含档案、预算与今日设置、目标与宏量构成、手动目标存证、数据管理） |
| 档案 | 同页 `onSave`（保存档案）、字段：性别/年龄区间/身高/体重/活动量/目标类型；保存后需回今日刷新方案 |
| 预算/偏好 | 同页预算卡片 `onSaveBudget`，及今日页方案预算（`pages/home/index.ts`、`domain/planner.ts` 一侧只读） |
| 目标计算 | 同页 `onComputeTarget()` → WASM 目标；展示“目标来源 / 宏量构成 / 手动目标存证与应用 / 未应用原因” |
| 主题状态 | `miniprogram/src/pages/appearance/index.*` + `utils/appearance.ts`（键 `tk.ui.appearance.v1`，`applyPageAppearance()` 已在各页 onShow 调用，`themeClass` 挂在页面根节点） |
| 显示模式状态 | `utils/display-mode.ts`（键 `tk.ui.displayMode.v1`，`simple/full`，`suggestedMealByTime`），今日页 `.mode-pill`、记录页 `data.mode` |
| 数据管理 | `miniprogram/src/pages/menu/index.*`（菜单导入/导出/恢复备份，摘要比对）、`pages/dev/index.*`（诊断）；“我的”页按钮 `onOpenMenu`/`onOpenDev` |
| 共用导航 | 无独立组件，各 tab 页内联 `.tabbar` + `onTab`（今日 `pages/home/index`、记录 `pages/logs/index`、我的 `pages/profile/index`）；路由顺序见 `app.json` |
| 单例数据入口 | `getApp().globalData.store`（`domain/store.ts` 的 `AppStore`）；记录相关只读 API：`getLogsView/getMonthLogs/summarizeMonthLogs/summarizeActiveLogs` |
| 本卡新增可复用件 | `utils/calendar.ts`（月历纯函数）、`domain/logs.ts` 的 `summarizeMonthLogs`、记录页 `loadDate/refreshMonth/buildCalendar` |

## 9. 结论

- 本卡记录页月历、历史回看与月度汇总已按 v3 卡片实现并通过本卡局部验证（静态检查全绿 + 开发者工具实测 21 项 PASS）。
- 新候选：`sha256:16f1009db3edcb97f27c33f6acc0e5a34db8deedbe8cbfaa37872586efd63372`（56 文件 / 665,454 B；tools 37 文件 / 402,307 B；WASM 未变）。
- 本反馈**不代表正式验收通过**；真机、冷启动、异常存储与全量回归留待固定候选集中验证。
- 已停止，等待 P01 核对并单独派发 U04；未自动外发、未通知其他角色、未自派下一卡。
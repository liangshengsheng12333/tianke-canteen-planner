# T05U05a 视觉收口｜交付反馈 v1

- 任务卡：`Resources\任务卡\T05U05a-DSH-视觉收口-v1.md`（视觉收口，共享样式 + 必要局部 WXSS/WXML）
- 设计依据：`Resources\报告\天科食客-双模式界面设计定稿-P01-v2.md` §7.2 颜色、§7.3 字级/间距/触控
- 绝对 cwd：`D:\项目\cpp\Projects\食堂就餐优化系统`
- 平台/角色：DSH｜小程序前端执行员
- **指定模型：DeepSeek V4.1 Flash**
- **实际模型/原生档位：未知**（不可核实，按任务卡允许如实写未知）
- 证据目录：`Resources\报告\T05U05a-DSH-视觉收口-证据-v1\`

## 1. 候选版本与哈希

| 项 | 输入（U05 候选） | 输出（本卡候选） |
|---|---|---|
| sourceTreeDigest | `sha256:6852753c77b148c8b2bdebd90d7c1df84f4c1cd408a4a159b2ca325c435354e8` | `sha256:f22eae28924422e22e262d73405eda91641b9ea7dc87788d32b6191ea0ded61a` |
| 源码文件 | 69 个 / 711,366 B | 69 个（见 `manifest.json` 字节数） |
| 工具文件 | 37 个 / 402,444 B | 37 个 / 402,444 B（未改） |
| 冻结 WASM | `mp_core.wasm` 72,881 B | **字节与哈希均未变**，`frozenWasmMatches: true` |
| 清单位置 | `00-输入候选\manifest-u05.json` | `00-输出候选\manifest.json` + `hashes.sha256` |

本卡未改业务数据、来源判定、营养口径、定价规则、记录逻辑、C++ 核心、契约与 WASM。

## 2. 改了什么

### 2.1 共享色板与全局字级（`miniprogram/src/app.wxss`）
- 页面正文基准 32rpx（16px）；标题 56rpx（28px）；热量主数值 76rpx（38px）；菜名/价格 36rpx（18px）；日期/来源/标签/说明 28rpx（14px，取设计稿 13–14px 上限）。
- 全局次级字号 26rpx→28rpx 全量替换（app.wxss 与 9 个页面 wxss 均已无 26rpx 字号残留）。
- **移除非契约橙色** `--tk-price`：价格统一 `var(--tk-text)`；警示条/片段改 `var(--tk-warn-text)`；`.btn-warn` 改用 `--tk-warn-*` 令牌。
- `.card` 内距 40rpx（20px）、圆角 56rpx（28px）、组间 margin-top 40rpx；`.tag`/`.badge`/`.note`/`.muted` 28rpx；`.link` 改 `inline-flex + min-height 88rpx` 保证触控区。
- 深色 `--tk-muted` 由 `#AFBAB4` 改为 **`#E3EAE5`**（用户从 A/B 方案中明确选 B，**偏离设计稿 §7.2**，见 §5）。
- `.meal-card` padding 32rpx→40rpx、radius 32rpx→56rpx（餐次卡达 20px/28px）。

### 2.2 页面样式
- `pages/home/index.wxss`：标题/日期/餐次/菜单/营养行字级统一；价格 `--tk-text`；说明类 28rpx；`.profile-tip` 内距 40rpx、圆角 56rpx；`.sheet` 保留 `backdrop-filter: blur(24rpx)`（毛玻璃仅用于导航/胶囊/弹层）。
- `pages/home/index.ts`：主选方案卡已显示的估算/限制标志不再在"其他方案"标题重复出现（`topFlags` 过滤主选方案 flag）。
- `pages/logs/index.wxss`：日期条 `.cal-day` 88rpx 高、水平 margin 归零（达 44px 宽）、`.cal-num` 28rpx、`.cal-nav` min-height 88rpx、`.record` 内距 20px/圆角 24rpx、`.price-input` 220×88rpx。
- `pages/profile/index.wxss`、`pages/profile-edit/index.wxss`、`pages/data/index.wxss`、`pages/menu/index.wxss`、`pages/budget/index.wxss`、`pages/appearance/index.wxss`：卡片内距 20px、圆角 28px、标题 28–32rpx、次级文字 28rpx；`badge-sim` 未定义色改为 `var(--tk-warn-text)`。

## 3. 实测与验证（微信开发者工具 RC 2.02.2609231，基础库 3.17.4，模拟器 iPhone 12/13 Pro，351×760 逻辑像素）

### 3.1 自动化检查
- `node tools/miniprogram/typecheck-src.mjs`：**0 errors / 35 files**（TS 4.1.2 与 5.9.3 双版本）。
- `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/check-pages.mjs`：**通过**（9 页 × 3 项静态检查）。
- `trace`/`compile` 类脚本未改；工具文件 37 个字节未变。
- 以上输出见 `01-静态检查\01-typecheck.txt`、`01-静态检查\02-check-pages.txt`。

### 3.2 页面渲染截图（`02-微信实测\`，351×760 原始 PNG）
| 场景 | 文件 |
|---|---|
| 今日·浅色·简易 | `01-今日-浅色简易-字级与卡片.png` |
| 今日·深色·完整（营养比例与估算） | `02-今日-深色完整-营养比例与估算.png` |
| 记录·浅色（日期条/汇总字级） | `03-记录-浅色-日期条与汇总字级.png` |
| 我的·浅色（目标摘要/设置） | `04-我的-浅色-目标摘要与设置字级.png` |
| 次级页·数据管理（返回与入口） | `05-次级页-数据管理-返回与入口触控.png` |
| 记录·展开月历（触控区/选中态） | `06-记录-展开月历-触控区与选中态.png` |
| 今日·深色完整·滚动到底（导航不遮操作） | `07-今日-深色完整-滚动到底-导航不遮操作.png` |
| 今日·浅色完整·滚动到底 | `08-今日-浅色完整-滚动到底-与深色对照.png` |
| 记录·深色（方案B字色） | `13-记录-深色-次级文字方案B.png` |
| 我的·深色（方案B字色） | `14-我的-深色-次级文字方案B.png` |
| 交互回归（底部导航三项/深色选中/换页成功） | `15`–`21`（含 `20-回归-今日点记录-切换成功.png`、`21-回归-记录点我的-切换成功.png`） |
| 字色方案对照（过程证据，非最终态） | `09`、`10`、`11`、`12` |

### 3.3 字级/间距（375px 基准，1rpx=0.5px）
| 项目 | 目标 | 实际 | 结果 |
|---|---|---|---|
| 页面标题 | 28px | 56rpx=28px（`.page-title`/`.hero-title`） | PASS |
| 热量主数值 | 38px | 76rpx=38px（`.heat-value`） | PASS |
| 菜名/价格 | 18px | 36rpx=18px（`.dish-name`/`.dish-price`/`.item-name`） | PASS |
| 正文/按钮 | 16px | 32rpx=16px（`page` 基准、`.btn`） | PASS |
| 日期/来源/标签 | 13–14px | 28rpx=14px（`.tag`/`.badge`/`.note`/`.muted`/`.dish-note`/`.plan-meta`） | PASS（取上限） |
| 页左右留白 | 20px | 40rpx=20px（`.page` padding） | PASS |
| 卡片内距 | 20px | 40rpx=20px（`.card`、`.meal-card`、`.profile-tip`） | PASS |
| 卡片圆角 | 28px | 56rpx=28px（`.card`/`.meal-card`） | PASS |
| 组间 | 20–24px | 40rpx=20px（`.card` margin-top） | PASS（取 20px 下限） |
| 组内 | 8–12px | 16rpx=8px / 24rpx=12px | PASS |
| 主按钮高 | 48px | 96rpx=48px（`.btn` 实测 49px 含边框） | PASS |
| U05 的 22px 卡片内距 | 不得使用 | 已无页面使用 44rpx 内距 | PASS |

### 3.4 触控区（实测，px）
| 元素 | 实测 | 结论 |
|---|---|---|
| `.btn`（今日） | 151×49 / 149×49 / 132×49 | PASS |
| `.mode-pill` | 61×47 | PASS |
| `.meal-tab` | 111×67 | PASS |
| `.tabbar-item` | 118×58（三页一致） | PASS |
| `.link`（今日） | 64×45 / 73×45 / 45×45 | PASS |
| `.link-strong`（记录） | 64×45 | PASS |
| `.plan-chip` | 310×129 | PASS |
| `.cal-nav` / `.cal-day` | 未取到（月历折叠） | CSS 88rpx=44px，**待展开实测** |
| `.opt` / `.action` / `.option` | 未取到（工具超时） | **未测** |

原始数据：`03-原始数据\03-触控区实测.json`；逐项表另见 `05-字级间距触控核对表.md`、`07-补充记录-终稿.md`。

### 3.5 功能保持
- 今日/记录/我的三入口均在，双模式（简易/完整）与三主题（浅色/深色/跟随系统）切换正常，月历可展开，返回路径存在（数据管理页"‹ 返回我的"）。
- 图标/入口/业务文案未改；长文本换行正常（完整模式说明、方案副标题均自动换行，无截断）。
- 深色完整模式滚动到底后底部导航不遮挡主操作（07/08）。

## 4. 未完成 / 未测项

1. **真机**（iOS/Android）观感、对比度、系统字体放大：未测。
2. `.cal-nav`/`.cal-day` 渲染触控区：未取到实测（折叠态），仅有 CSS 定值；`我的/数据管理/外观`页的 `.opt`/`.action`/`.option` 触控实测因工具超时未取到。
3. 跨页跳转回归**仅在重启后的干净 DevTools 实例中通过**；旧实例下复现"reLaunch unregistered page"（详见 §5），无法证明旧实例下可用。
4. `01`–`14` 截图为开发者工具 1x 模拟器截图，不等于真机清晰度；用户主观"深色小字发糊"已用"字号 13→14px + 深色次级字色提亮"处理，最终观感需用户在工具里确认。

## 5. 偏差与需要 P01 知晓的事项

1. **深色 `--tk-muted` = `#E3EAE5`**，偏离设计稿 §7.2 的 `#AFBAB4`。原因：用户反馈深色模式小字"墨绿发糊、比浅色难读"；提供方案 A（`#BFC8C2`）与方案 B（`#E3EAE5`）实测对照后，**用户明确选 B**。副作用：次级文字与主文字的色阶差变小，层级感略弱。
2. **"含估算数据"等限制标志去重**改在 `pages/home/index.ts`（属展示层，不涉及业务判定）。
3. **`pages/index/index.wxss`**（未在 `app.json` 注册的遗留页）仍含 `#ff9800` 等暖色硬编码，本卡未清理，建议 P01 决定删除该遗留页或后续任务处理。
4. **开发者工具路由故障**（用户可见：底部"记录/我的"点不动）：`src/app.json` 与运行时 `__wxConfig.pages` 均含全部页面，但 `wx.reLaunch` 对任意页面报 `unregistered page`；完整退出并重开开发者工具后恢复，三入口切换实测通过。判定为**工具实例状态问题，非源码缺陷**，源码未为此改动。详见 `07-补充记录-终稿.md` §4。
5. **机器异常重启**：本轮期间系统发生 4 次 `Kernel-Power 41` 异常断电重启（13:22/13:30/13:31/15:24），非本代理执行关机命令；代理仅执行过一次开发者工具 `quit`+重开（用于修复 §4 的路由故障）。异常重启可能与本机长时间运行 DevTools/自动化有关，建议排查电源或驱动。
6. 未改任何共享契约、WASM、C++ 源码；未新增依赖、权限、网络请求。

## 6. 证据与下一负责人

- 完整证据：`Resources\报告\T05U05a-DSH-视觉收口-证据-v1\`
  - `00-输入候选` / `00-输出候选`（清单与 hashes）
  - `01-静态检查`（typecheck / check-pages）
  - `02-微信实测`（01–21 截图）
  - `03-原始数据`（状态快照、状态差异、触控实测）
  - `04-操作记录.md`、`05-字级间距触控核对表.md`、`06-文件清单.md`、`07-补充记录-终稿.md`
- 下一负责人：P02 查收 / P09 独立复核（重点：真机观感、深色方案 B 的层级取舍、触控区未测项、工具路由故障的复现条件）。
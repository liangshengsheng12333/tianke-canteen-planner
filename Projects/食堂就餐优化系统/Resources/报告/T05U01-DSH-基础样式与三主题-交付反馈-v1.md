# T05U01｜DSH｜基础样式与三主题 交付反馈 v1

- 日期：2026-10-21（Asia/Shanghai）
- 平台/角色：DSH（小程序前端执行员）；工作区 `D:\项目\cpp`；项目根 `D:\项目\cpp\Projects\食堂就餐优化系统`
- 任务卡/执行提示词：`Resources\任务提示词\T05U01-DSH-基础样式与三主题-v1.md`（v1，8,619 字节，SHA256 `8095802889576ECB9DF85950035E7C1C09C125144C46E427860287656CEB3292`）
- **状态：阶段交付/大部分完成。** 颜色令牌、浅色/深色/跟随系统三项偏好、保存与恢复、开发者工具真实运行与截图已完成；**系统主题“动态跟随”与真机未测**（本机模拟器读不到系统主题，见 §6），保存失败提示仅 Node 桩覆盖。
- 唯一反馈文件：本文件。证据目录：`Resources\报告\T05U01-DSH-基础样式与三主题-证据-v1\`
- 本卡完成即停止：未派发、未执行 U02，也未改动本卡范围外的业务/Core/契约/菜单/WASM。

## 1. 模型与平台记录（请求 ≠ 实际证明）

- P01 指定请求模型：**DeepSeek V4.1 Flash**；原生思考档未指定。
- 本会话可见模型标识：`deepseek-v4.1-flash-1017`；**服务端实际版本、额度、原生档位无法核实，记为未知。**
- 未使用 Gemini 4（不在本单）。
- 开发/验证环境：微信开发者工具（wechatide-skill 0.3.11，基础库 3.17.4，模拟器 iPhone 12/13 Pro 档，iOS 模拟）；Node v24.19.0；TypeScript 4.1.2（开发者工具自带）与 5.9.3（本机对照）。

## 2. 输入与接手基线身份

| 输入 | 身份 |
|---|---|
| 本卡提示词 | `Resources\任务提示词\T05U01-DSH-基础样式与三主题-v1.md`，8,619 B，`8095802889576ECB9DF85950035E7C1C09C125144C46E427860287656CEB3292` |
| 主 PRD | `Resources\主PRD.md`，24,044 B，`D68ECE7218BC076155A0AFB6200788B7608898E9D0CDF6ECEC27C5E49AA58FDD` |
| 界面设计定稿 P01-v2 | `Resources\报告\天科食客-双模式界面设计定稿-P01-v2.md`，23,002 B，`4AAB6F39E1C010486F87814EB43BC73EA72A05A673159DED56A49BB7FEE8BF64` |
| 视觉参考 HTML | `Resources\设计\天科食客-界面预览-P01-v2.html`，35,215 B，`9205413D38932EEE8DEDD97B564E9F99478E55FD6AD246256CFB8FAE7CDFE6F6` |
| 浅深主题对照图 | `Resources\设计\天科食客-浅深主题对照-P01-v2.png`，95,429 B，`8553DB9279C72D119EDAE003E51D341F5A1949094EC3C938646BAC8FEF5D5B9A` |
| 月历与外观设置图 | `Resources\设计\天科食客-月历与外观设置-P01-v2.png`，92,820 B，`C4AB2B4133D0FF2329FAEFC621ABACCB4A8C4E485FEB2A1CF281B8D3B7DAE71B` |
| 上一候选反馈 v2 | `Resources\报告\T05-DSH-补测与红米试用-交付反馈-v2.md`，15,310 B，`84FBA9724E07F059D30A49C45C7BDABC6B8D8774ECE42B3444604FDF296C33DC` |
| 上一候选 manifest | `Resources\报告\T05-DSH-补测与红米试用-证据-v2\04-候选与构建\manifest.json`，14,848 B，`7F2FD23F07A3D29D5BCBEDC85D176EA13125BDC3A158CC058FC99B80DBD761A3` |

接手基线（与卡片记录一致）：`miniprogram/src` **47 文件 / 586,955 字节 / sha256:ac0f89e87bd67d927306dbbf8962f1701884767e920cb48ee89008a4669a6b2f**；`tools/miniprogram` **29 文件 / 320,474 字节**；包内 WASM `miniprogram/src/assets/wasm/mp_core.wasm` **72,881 字节 / `715CD7701B64D8F493A110C348B5F643979536578C7380C29837E05C4F31D52C`**。逐项哈希见证据 `03-输入哈希\inputs.sha256.txt`（`A5508A66…`）。

> 改动后旧候选树已被本卡修改覆盖，无法再重算旧树；旧候选的验收证据仍只属于旧候选，本卡不拼接。

## 3. 交付产物

最终清单与逐文件哈希：`00-候选清单\manifest.json`（`5EF17166E74374FDF0179E2560B07608EBF860B6F029512167DB85260A1F8317`）与 `00-候选清单\hashes.sha256`（`BB71A9C2DFACC59BC3A24EC4B0EDD2CB7446900A6E3C6773B964ED88B4789A1A`）。

| 项 | 结果 |
|---|---|
| 最终源码候选 | `miniprogram/src` **52 文件 / 612,937 字节 / `sha256:eac6e0a233657b055ce84cd4f5b532f6248691a51a8ae7272adae9b42b000a38`** |
| 工具目录 | `tools/miniprogram` **30 文件 / 329,008 字节** |
| 固定 WASM | 72,881 字节 / `715CD7701B64D8F493A110C348B5F643979536578C7380C29837E05C4F31D52C`，**与冻结身份一致、未替换** |
| 新增（5 源文件 + 1 工具） | `src/utils/appearance.ts`；`src/pages/appearance/index.{ts,wxml,wxss,json}`；`tools/miniprogram/test-appearance.mjs` |
| 修改（18 源文件 + 1 工具） | `src/app.ts`、`app.json`、`app.wxss`；`pages/{home,profile,logs,menu,dev}/index.{ts,wxml,wxss}`（各 3 个）；`tools/miniprogram/check-pages.mjs` |
| 删除 | 无 |

未新增“我的”主页、未增加/重排主导航、未实现简易/完整显示模式、未改 Core/工具链/契约/正式菜单/档案/记餐/备份格式/WASM。

## 4. 实现要点

1. **颜色令牌集中在 `app.wxss`**：`.tk-light` / `.tk-dark` 两套 `--tk-*`（页面底、主/次卡片、文字、强调与按钮字、提示、错误、信息、价格、分隔线、字段、tabbar、hero、阴影、禁用），全部按卡片表格设计值；`.page` 铺主题底色并占满视口。
2. **外观唯一入口 `utils/appearance.ts`**：存储键 `tk.ui.appearance.v1`；默认浅色；保存“写入 + 回读校验”，失败返回 false 且不改旧值；系统主题优先 `wx.getAppBaseInfo().theme`、回退 `getSystemInfoSync().theme`，读不到返回 null；`system` 解析失败暂用浅色但**保留用户选择**；对外提供 `getAppearance()`、`pageThemeData()`、`applyPageAppearance()`、`setAppearancePreference()`、`refreshAppearance()`、`initAppearance()`，并把快照同步到 `App.globalData.appearance`（避免第二份过期状态）。
3. **页面接入**：各页 `data.themeClass`（`tk-light`/`tk-dark`），根节点写 `class="page {{themeClass}}"`；`onShow` 首行调用 `applyPageAppearance()`，同时重设导航栏/窗口底色（微信导航栏颜色按页面生效，不继承上一页）。
4. **设置入口**：沿用现有 profile 页，新增“显示与外观”卡片（当前值 badge + 说明 + “调整外观”按钮）→ `pages/appearance/index`；外观页三项单选、选中态用边框+勾选+文本三重表达，保存失败回滚并提示“设置没保存，请重试”。
5. **冷启动顺序**：`app.ts` 模块求值阶段即 `refreshAppearance()`（早于 `App()` 与页面创建），`onLaunch` 再同步并注册 `wx.onThemeChange`（仅 `system` 时响应），`onShow` 重新解析，覆盖“回到前台同步”。
6. **`app.json`**：注册 `pages/appearance/index`，窗口底色改为 `#f5f6f8`；未改业务页顺序与 tabBar。

## 5. 验证结果

### 5.1 Node 自动检查（本地桩，非微信运行时证据）

| 命令 | 结果 | 输出 |
|---|---|---|
| `node tools/miniprogram/typecheck-src.mjs` | TypeScript 4.1.2：`0 errors across 27 files`；5.9.3：`0 errors across 27 files` | `02-静态检查\typecheck.stdout.txt`（`3E5992F6…`） |
| `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/check-pages.mjs` | 6 个页面（含 appearance）WXML 闭合、事件绑定、mustache 标识符全部通过 | `02-静态检查\check-pages.stdout.txt`（`27CEFA23…`） |
| `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-appearance.mjs` | **27/27 通过**（10 组：默认/非法值、保存失败、回读不一致、系统主题可用/不可用、跟随解析、页面通知边界、globalData 同步等） | `01-自动测试\test-appearance.stdout.txt`（`D5CA1B4C…`） |

### 5.2 微信开发者工具真实运行（编译/启动/主题/持久化）

- 编译与启动：`simulator_open_page` 打开 `pages/appearance/index`、`pages/profile/index`、`pages/home/index`，`get_simulator_console` 过滤 `error|fail|exception` **无命中**（`04-运行时\console-error-grep-{dark,light}.txt` 均为空结果）。
- 深浅主题：浅色固定、深色固定均按令牌呈现（见 §5.3 截图）；深色下导航栏与状态栏同步变深。
- 跟随系统：选择后 `systemReadable=false`，界面暂用浅色且页面明确说明“当前环境读不到系统主题……选择已保存”（`04-appearance-system.png`；文案由 `.note` 真实读取：`当前环境读不到系统主题，暂按浅色显示；“跟随系统”的选择已保存，环境支持后按系统主题呈现。`）。
- 持久化：切深色 → `simulator_refresh`（应用重启，未清存储）→ `pages/profile` 仍为深色，`getApp().globalData.appearance = {preference:"dark",resolved:"dark",systemReadable:false}`（`04-运行时\appearance-snapshot-after-restart-dark.json`；截图 `08-persistence-dark-after-restart.png`）。
- 设置隔离：`wx.getStorageInfoSync()` 的键仅 `tk.ui.appearance.v1`（`04-运行时\storage-keys-{dark,light}.json`）；主题切换期间 `get_simulator_network` 过滤 `wasm|mp_plan|mp_nutrition|mp_validate` **无命中**（`04-运行时\network-core-grep-{dark,light}.txt`），即未触发 WASM 计算。
- 入口可达：profile 页“调整外观”按钮真实点击后 `currentPage` 为 `pages/appearance/index`；返回后回到 `pages/profile/index`。

### 5.3 有效截图（均来自本候选 `eac6e0a2…`，微信开发者工具模拟器）

| 文件 | 内容 | SHA256 |
|---|---|---|
| `02-appearance-light.png` | 外观页浅色（三项、选中态、说明） | `A53278EA4FD8B99EC1EB74C9E0A9ACB06FAC9439CAB22DDCE4B2CB56BD5EB447` |
| `03-appearance-dark.png` | 外观页深色 | `459C025659D5FC325E6D8F4AA7FF518E61A8585CB53A1C9C1CB364D578A16BE5` |
| `04-appearance-system.png` | 跟随系统选择 + 读不到系统主题的回退说明 | `F351FBB4360565D73B0E017A4FEA22F7019AD300A02FE678035DE6162825E245` |
| `05-profile-light-entry.png` | profile 页浅色 + “显示与外观”入口 | `64416BABAD6CB801E69DBE28165231DD51F43C222519BBE58E8B293906574287` |
| `06-profile-dark-entry.png` | profile 页深色入口（导航栏同步变深） | `7B07471E6D644D4CE77C3CA1B530B322B820D00108BAD1109D72C87B891D6FF7` |
| `07-home-dark.png` | home 页深色 | `87E545B9D4139292FF7C3A7F723B55EB34E9F38A2FF164B35CFA97742A352E0E` |
| `08-persistence-dark-after-restart.png` | 重启后仍深色（持久化） | `50C72AD75FD1460623F9D939E5EC00DEC7673070872B50EF72E0CF309000E035` |
| `09-logs-dark.png` | logs 页深色 | `680A2C90E0D180C374C0926CA97FFDDD33DE8FAE105187C4D4A5B07F7359064D` |
| `10-menu-dark.png` | menu 页深色（含错误态 token） | `01344443D31AA39E6FF10475CE861FB6007D180A1D4FAF562681AE6D450FF3B8` |
| `11-home-light.png` | home 页浅色 | `49953EB67951CF11FE038071C38C4ADB5E7D1AC0972780070DBDBEC12BD9B45A` |

（模拟器档位为 iPhone 12/13 Pro profile 的模拟器，**不是真机**；截图只能证明工具侧渲染。）

### 5.4 逐项验收对照

| 提示词要求 | 状态 | 说明 |
|---|---|---|
| 共用语义令牌覆盖可读性所需颜色 | 已实现并截图 | `app.wxss` 两套 `--tk-*`；5 个既有页面 + 新页全部接入 |
| 浅色固定 / 深色固定 | 开发者工具已验证 | 截图 02/03/05/06/07/09/10/11 |
| 跟随系统选择保存 + 读不到时暂用浅色且保留选择 | 已验证 | 04 截图 + `.note` 原文；Node 桩覆盖解析分支 |
| 跟随系统随系统主题变化/回到前台生效 | **未测（受限）** | 模拟器 `getAppBaseInfo()` 无 `theme` 字段；仅代码路径与 Node 桩覆盖 |
| 保存后返回、重新打开仍为所选值 | 已验证 | 重启后深色保持（08 + 快照 json） |
| 保存失败回滚并提示“设置没保存，请重试” | Node 桩已验证，**微信运行时未注入** | 写抛错/回读不一致两种分支 |
| 主题切换不改业务数据/不触发核心 | 已验证（局部） | 存储键仅外观键；network 无 `mp_*`/wasm 调用；截图档案字段前后一致 |
| 冷启动先恢复外观再绘制 | 代码顺序保证（模块求值先于 App/页面） | 未测“白闪”肉眼观察，仅工程顺序 |
| 固定 WASM 哈希不变 | 已验证 | manifest `frozenWasm.matches=true` |

## 6. 实际微信系统主题能力（实测，避免把假设写成能力）

- 微信开发者工具模拟器（基础库 3.17.4）里，`wx.getAppBaseInfo()` 返回对象**不含 `theme` 字段**，`wx.getSystemInfoSync().theme` 也取不到值；所以本机 `systemReadable=false`，应用按卡片要求**暂用浅色并保留“跟随系统”选择**，页面文案如实说明。
- 因此“系统主题变化事件”和“后台返回重新同步”在开发者工具**没有实测证据**；`wx.onThemeChange` 注册、只在 `system` 偏好下响应、`onShow` 重新解析这些行为由 Node 桩单测覆盖。
- 真机的系统主题读取/切换未测（本卡不要求全套真机，且未取得用户真机回传）。

## 7. 过程中发现的环境问题（供后续卡参考）

1. **开发者工具增量编译可能漏登记新增 `.ts` 文件**：现象为 `Error: module 'utils/appearance.js' is not defined`、页面空白；`simulator_refresh`、`close_project_window` 重开、单独 `cleanCompileCache`/`cleanProjectFileListCache` 均无效；**`debug_clear_cache --action cleanAll`（或重启工具进程）后立即恢复**。后续卡新增文件后建议先清全部缓存再编译，或改文件名重引用。
2. **`button` 组件默认 `width:184px` + `margin:auto`**：会把按钮定宽并居中；已在 `.btn` 用 `!important` 覆盖（带注释），并修复导航栏“返回我的”按钮歪斜。
3. **导航栏颜色按页面生效**：切换主题后新页面不会继承，已在每页 `onShow` 调 `applyPageAppearance()` 重设。
4. **`page` 元素静态底色为浅色**：深色时由 `.page` 覆盖视口 + `wx.setBackgroundColor` 处理；极端滚动回弹边缘可能短暂露出浅色，本卡未观测到异常，列为限制。

## 8. 未测项、缺陷与限制

1. 系统主题动态跟随、回到前台同步：**开发者工具未测**（接口无 `theme`）+ **真机未测**。
2. 真机浅/深/跟随与冷启动白闪：未测。
3. 微信运行时“保存失败”注入（存储写失败/回读不一致）：未做，仅 Node 桩覆盖；未伪造证据。
4. 与 P01 HTML 预览逐像素对照未做：本卡是令牌与外观层，布局按要求保持现状；令牌值取自任务卡表格与定稿第 7 节。
5. 简易/完整显示模式未实现（本卡范围外，留给 U0x）。

## 9. 下一卡接续摘要

- 当前候选：`miniprogram/src` 52 文件，`sha256:eac6e0a233657b055ce84cd4f5b532f6248691a51a8ae7272adae9b42b000a38`（manifest 见 `00-候选清单\manifest.json`），固定 WASM `715CD770…` 未变。
- 接续读取入口：
  - 令牌：`miniprogram/src/app.wxss` 的 `.tk-light` / `.tk-dark`；
  - 外观：`miniprogram/src/utils/appearance.ts` → `pageThemeData()`（取 `themeClass`）、`applyPageAppearance()`（页面 `onShow` 首行调用，含窗口/导航栏）、`setAppearancePreference()`（保存并广播）；
  - 页面写法：根节点 `class="page {{themeClass}}"`，`data` 声明 `themeClass`；新增页面沿用同一模式即可自动支持三主题；
  - 入口：`pages/profile/index` 的“显示与外观”卡片；设置页 `pages/appearance/index`。
- 旧 T05 v2 截图/二维码/查收证据只属于旧冻结候选，**不可与本候选证据拼接**。
- 本卡完成即停止，等 P01/用户查收；未自行推进 U02。
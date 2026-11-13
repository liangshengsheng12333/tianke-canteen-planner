# T05U10｜四步新手教程 · 交付反馈 v1

- 任务卡：`Resources/任务卡/T05U10-DSH-首次可跳过教程-20261025-v1.md`
- 产品依据：`Resources/天科食客-第一版菜单教程与构建区分简要PRD-20261025-v2.md`（已确认部分）
- 项目根 / 实际工作目录：`D:\项目\cpp\Projects\食堂就餐优化系统`（聊天默认 cwd `D:\项目\cpp`）
- 交付日期：2026-10-25
- 唯一反馈：本文件；证据：`Resources/报告/T05U10-DSH-四步新手教程-证据-v1/`（入口说明见其 `README.md`）

## 1. 模型与身份

| 项 | 值 |
| --- | --- |
| P01 指定模型 | DeepSeek V4.1 Flash（会话路由） |
| 可核实实际模型 / 原生档位 | **未知**：DSH Web 会话未提供平台侧模型/档位回执；harness 配置标识为 `deepseek-v4.1-flash-1017`，仅作请求侧标识，不当作实际证明 |
| 输入基线（固定 a62 独立副本） | `sha256:a62aced0ee327eb208bfac4528b26f9a745bb8130772cbe9c2c83ba7cce0b357`；`miniprogram/src` 75 文件 / 1,009,489 B；`tools/miniprogram` 45 / 649,308 B；WASM `B0098453…3DC5DD`（111,554 B）匹配 |
| 基线来源 | `Resources/报告/T08N-ZCode-最终收尾归集-证据-v1/integrated-candidate`（`00-输入候选/manifest.json`） |
| 输出候选（本路副本） | `sha256:a8b9604f330451d5cd6018476ccd2eeaf6f354d338ea2bc8414a3f40211e0865`；src 80 / 1,025,061 B；tools 45 / 649,437 B |
| 当前生产树（只读复算） | `sha256:a62aced0…0b357` / 75 / 1,009,489 B；tools `sha256:836eb7f1…7689` / 45 / 649,308 B；WASM 匹配 → **生产 = 本次 a62 基线，本任务未写入生产** |
| 基线口径说明 | MEMORY 早期记的 `97c8085c…39b13123`（75 / 1,008,941 B）是 T06f 推广前旧身份；T06f/T08N 已把 a62 推为生产身份，故本次以 a62 为基线，非 97c |

## 2. 交付内容（全部在副本内，生产未改）

副本：`Resources/报告/T05U10-DSH-四步新手教程-证据-v1/01-工作副本/`

新增：
- `miniprogram/src/utils/tutorial-state.ts`：独立 UI 标记 `tk.ui.tutorial.v1`（`{seenAt, via: 'finish'|'skip'}`）；读损坏/抛异常按“未看过”；写入后回读校验，失败返回 false 并由页面如实提示。
- `miniprogram/src/pages/tutorial/{index.ts,index.wxml,index.wxss,index.json}`：四步教程页，复用 `applyPageAppearance()` 与 `--tk-*` 变量、`btn` 体系，未做高亮蒙层。

修改：
- `pages/home/index.ts`：`tutorialEntryVisible` + `onShow` 同步 + `onStartTutorial` + `onSkipTutorial`（入口已隐藏时不重复写标记，写失败如实提示）。
- `pages/home/index.wxml|wxss`：今日页顶部轻量入口卡（标题「第一次用？四步就会」，跳过 / 开始使用），不挡三餐切换、推荐与记餐。
- `pages/profile/index.ts|wxml`：我的页「使用教程」固定卡（四步徽标 + 查看使用教程），已看过也可随时重看。
- `app.json`：注册 `pages/tutorial/index`。
- `tools/miniprogram/check-pages.mjs`：静态检查登记 `tutorial` 页（**仅副本内工具**，生产工具未动）。

未触碰：`domain/store.ts`、`app-state.ts`、`app.ts`、营养数据/算法/WASM、导航结构；未新增依赖。

四步文案（按钮名与现有界面同名；热量写「估算 / 约数」；不宣传增肌、不承诺精准称重、不出现开发术语）：
1. 填档案，定目标（个人资料 · 预算与偏好）
2. 选一餐，看推荐（换一份 · 自己选菜）
3. 确认吃了，可改可撤（确认吃了 · 结束餐次 · 改记 · 撤销 · 补记食物；并说明「今日」页小结看「已记录热量 / 已记录花费 / 剩余可用」）
4. 回看月历，调设置（上月 / 下月 · 显示与外观 · 数据管理）

## 3. 验证结果（Node 与实际开发者工具操作分列）

### 3.1 Node 逻辑检查（`02-Node检查/`）

| 检查 | 命令（cwd = `01-工作副本`） | 结果 |
| --- | --- | --- |
| 类型检查 | `node tools/miniprogram/typecheck-src.mjs` | wechat-devtools TS 4.1.2 与 antigravity TS 5.9.3 均 **0 errors / 40 files** |
| 页面静态检查 | `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/check-pages.mjs` | 11 页全 PASS；tutorial 5 事件 / 7 绑定；home 25 事件、profile 8 事件 |
| 教程逻辑测试 | `node --import ./tools/miniprogram/register-ts.mjs ../../06-脚本/test-tutorial-logic.mjs` | **PASS 66 / FAIL 0**（存储标记、损坏值、读写异常、静默丢弃、三键互不覆盖、翻页越界、看完/跳过/返回三路径、导航失败兜底、首页入口、我的入口、边界） |

说明：该测试使用脚本内 `wx` stub，不是微信运行时；stderr 中“读取/写入失败”是故意触发的失败分支，真实结果见 `02-Node检查/03-tutorial-logic.txt`。

### 3.2 微信开发者工具模拟器实际操作（`03-微信实测/`、`05-原始数据/`）

环境：微信开发者工具 CLI（`wechatide.cmd`，client `DeepSeek`，skill 0.3.11，登录用户 凉笙），模拟器 728×1572；**非真机**。操作均为真实元素点击/导航：`automation_element_action tap`、`automation_navigate`、`automation_page_action getData`、`automation_evaluate`、`simulator_screenshot`。

| 卡内验收项 | 结果 | 证据 |
| --- | --- | --- |
| 新装显示入口 | 满足：清空存储 + 重置业务数据后 `tutorialEntryVisible=true`，首页出现入口卡，三餐与记餐不被阻塞 | `01-fresh-entry-visible.json`、截图 `01` |
| 跳过 | 满足：入口消失、`tk.ui.tutorial.v1` 写入 `via=skip`；失败时如实提示“跳过没保存” | `03-tap-skip`/`03-after-skip-*`、截图 `02`（Node 侧 C5–C7、C10–C11） |
| 完成 | 满足：第 4 步「开始使用」返回首页、`via=finish`、入口消失 | `07-after-finish-*`、截图 `07` |
| 返回 | 满足：直接「返回」不写标记，首页入口仍在 | `09-after-back-fingerprint.json`（无教程键）、`09-after-back-entry.json`（true）、截图 `09` |
| 重开不反复弹 | 满足：关闭项目窗口→重开（≈小程序重启）后入口不出现；看完后再重开同样不出现 | `04-reopen-fingerprint.json`、`19-reopen-entry-visible-attempt1.json`（false）、截图 `03`/`08`/`19` |
| 我的重看 | 满足：我的页固定入口可随时打开教程（含已看过） | `10-after-profile-entry-route.json`、截图 `10`/`20`/`11` |
| 已存在记录不变 | 满足：全程业务状态 `stateLen=1434`、`stateHash=h1439147961` 不变（baseline / 跳过 / 看完 / 返回 / 收尾 / 重开一致），首页早餐“已记”仍在 | `16-fingerprint-table.json`、`16-fingerprint-compare.json`、`13-final-home-summary.json`、截图 `16`/`18` |
| 不改档案/目标/模式 | 满足：教程流程从未写 `tk.ui.displayMode.v1` / `tk.ui.appearance.v1`（3/4/7/9 快照中无这两个键） | `16-fingerprint-compare.json`（`tutorialWroteDisplayModeOrAppearance=false`） |
| 简易/完整 × 浅色/深色布局 | 满足：浅色简易（01/04/05/06/07）、深色简易（12–15）、浅色完整（16/17）均无错位、溢出、遮挡，文字可读；收尾恢复浅色简易 | 对应截图 + `11-after-dark.json`（dark/tk-dark）、`12-home-full-mode.json`（full）、`13-restored-mode.json`（simple） |
| 教程页可编译 | 满足：WXML 编译 `$gwx` 318,544 B；WXSS 2 文件 / 24,961 B；无编译错误 | `14-compile-*.json` |
| console | 无小程序侧异常：exception / uncaught / tutorial 三个 grep 均为空；error grep 仅 1 条开发者工具自动化侧 `inspectee MPPage.getCurrent` 竞态（关窗重开后立即 getData 的已知工具侧问题，重试即成功） | `15-console-*.json`、`19-…attempt1.json` |
| 实际操作分列 | 满足：Node 与 DevTools 结果分别登记，未混用；未用 Node 结果冒充运行时结果 | 本文件 §3.1 / §3.2 |

## 4. 生产未变证明

- 只读复算生产（`06-脚本/prod-digest.mjs`，根由参数传入，不写生产）：`05-原始数据/17-prod-digest.json`
  - `miniprogram/src` = `sha256:a62aced0…0b357` / 75 / 1,009,489 B
  - `tools/miniprogram` = `sha256:836eb7f1…7689` / 45 / 649,308 B
  - WASM = `B0098453…3DC5DD` 匹配
- 本任务所有写入都在 `01-工作副本/` 与 `Resources/报告/…证据-v1/`、唯一反馈文件内；未改 MEMORY、旧证据、共享契约、PPT、生产源码与工具。

## 5. 最小 patch（`04-补丁/`）

- `T05U10.patch`：21,595 B，LF-only，**12 个文件，+457 / −3**，相对 a62 基线。
- 逐文件状态/字节/SHA256：`changed-files.txt`、`changed-files.json`；输出候选：`output-candidate/manifest.json`。
- 自检（`patch-verify.txt`）：干净 a62 副本上 `git -c core.autocrlf=false apply -p1 --check` = 0、`apply` = 0，复算树 = 交付树（`sha256:a8b9604f…0865` / 80 / 1,025,061 B；tools `sha256:b3a74719…1ef9` / 45 / 649,437 B）→ **PASS**。
- 应用须带 `core.autocrlf=false`（候选全 LF，否则 apply 会写 CRLF 导致树不一致，已复现并写进 `patch-verify.txt`）。
- 合入提醒：`tools/miniprogram/check-pages.mjs` 的 hunk 只是让副本静态检查认识教程页；生产工具未动，汇合时可只取 `miniprogram/src` 的 11 个文件。

## 6. 未测项 / 限制

- 未真机、未 iOS、未不同屏幕尺寸与系统字体放大；仅开发者工具模拟器（728×1572）。
- 「跟随系统」外观未单独截图（教程页与其它页共用 `applyPageAppearance()`，本次只实测浅色/深色）。
- “关闭项目窗口再打开”是工具层重启，不完全等同真机冷启动。
- 未覆盖多用户/多设备存储隔离、存储配额耗尽。
- 未做教程入口的曝光/点击埋点（本版无埋点要求）。

## 7. 缺陷与下一负责人

- 无阻塞缺陷；Node 66/66、静态检查 11 页、模拟器流程全部通过。
- 已知小瑕疵（不影响验收，供 P01 记录）：
  1. 「我的」页教程卡在页面下部，需滚动一屏才可见（截图 `20`）；若希望首屏可见需调整卡片顺序，属下一轮 UI 整合范围。
  2. 开发者工具 `console` 里那条 `inspectee MPPage.getCurrent` 是工具自动化侧竞态，非小程序缺陷。
- 下一负责人：**P01** 按“教程与菜单升级单人串行汇合”合入；如需真机/独立验收，交 P09 或真机窗口，按本反馈 §3.1 与 §3.2 分列复核。
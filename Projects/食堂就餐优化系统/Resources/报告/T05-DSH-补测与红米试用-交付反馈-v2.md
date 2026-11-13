# T05 补测与红米试用｜交付反馈 v2（DSH）

日期：2026-10-20（Asia/Shanghai）
任务卡：`Resources/任务卡/T05-DSH-补测与红米试用-v1.md`（P01 已批准）
依据：主 PRD v0.2；T01 契约 v1.1/v1.2；T05 执行提示词 v2（`Resources/任务提示词/T05-DSH-天科食客页面存储-v2.md`）；T05 交付反馈 v1；`Resources/报告/T04-T05-P02-双任务查收-20261020.md`
绝对 cwd：`D:\项目\cpp`（项目根 `D:\项目\cpp\Projects\食堂就餐优化系统`）
平台：DeepSeek Harness（DSH）Web GUI 会话，团队 Lead 具名 `lead`

## 0. 状态一句话

第 1—4 项已完成并冻结候选、已编译、已出**新预览二维码**；第 5 项（红米真机）**未执行，等用户配合**——需要用户扫码并按 `05-红米真机/操作步骤与记录.md` 回传实测值。

## 1. 模型 / 档位

| 项 | 值 | 可核实来源 |
|---|---|---|
| P01 指定模型 | DeepSeek V4.1 Flash | 任务卡 v1 第 7 行 |
| 实际运行时自报模型 | `deepseek-v4.1-flash-1017` | DSH 运行时/GUI 会话标签（本会话 Lead 使用）；`env` 中只有 `DSH_HOME/DSH_PROFILE/DSH_SESSION_ID/DSH_WEB_URL`，无模型字段 |
| 档位 | High | 仅 GUI 会话标签可核实；CLI/env 无法独立核实，属“运行时显示” |
| 额度/计费 | 未知 | 无可用查询入口，不推测 |

未把请求配置写成实际证明：上表“运行时自报”项是本会话实际使用的模型标识，档位只标到 GUI 可见层级。

## 2. 候选与产物身份（冻结）

| 对象 | 身份 |
|---|---|
| 候选源码树（`miniprogram/src` 全 47 文件） | `sha256:ac0f89e87bd67d927306dbbf8962f1701884767e920cb48ee89008a4669a6b2f`（47 文件 / 586,955 字节） |
| 工具树（`tools/miniprogram` 全 29 文件） | 320,474 字节，逐文件哈希见 `04-候选与构建/hashes.sha256` |
| 包内固定 WASM | `miniprogram/src/assets/wasm/mp_core.wasm`，72,881 字节，`SHA256 715CD7701B64D8F493A110C348B5F643979536578C7380C29837E05C4F31D52C`（与冻结身份一致，未升级） |
| T02 v2 WASM 接入 | 真实 `WXWebAssembly` 单实例；测试开头用 `readWasmChecked()` 校验字节/哈希 |
| 预览包大小（工具返回） | 592,136 字节 |
| 预览二维码 | `05-红米真机/preview-qrcode.jpg`（470×470 JPEG，46,245 字节），本次候选上生成；**旧码作废** |

逐文件清单：`Resources/报告/T05-DSH-补测与红米试用-证据-v2/04-候选与构建/hashes.sha256`；机器可读：同目录 `manifest.json`（含 frozenWasm.observed 与 matchesFrozen=true）。

## 3. 第 1 项｜多窗口/同菜多 offer/换菜售罄作用域补测

**结论：完成，发现并修复 5 类真实缺陷 + 1 类页面/视图缺陷（如下），全部绑定当前候选。**

- 测试入口：`tools/miniprogram/test-t05-soldout-scope.mjs`（11 个用例 A0–A10，43,153 字节）
- 模拟菜单（明确非真实菜单）：`tools/miniprogram/t05-simulated-multi-window-menu.mjs`，版本 `menu-simulated-multi-window-v1`，规范化 `catalogHash sha256:96aa1ad60d6dcd2e023ba0a851c2f5cede7cf2d531ddb81d4aa7e8bdf3c97203`
- 只读实测核心作用域（7 组构造 state）：`tools/miniprogram/probe-t05-soldout-scope.mjs`；关键结论：核心按 `{windowId, meal, dishId}` 生效、锁定校验看报价自身窗口、**未知 `windowId` 被静默忽略**（因此前端必须校验，已修）
- 全量回归：`node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/run-t05-all.mjs` → 3/3 文件通过，56 例 0 失败（modules 17、soldout-scope 11、store 28）

修复清单（位置为修复后行号，详见 `01-分支测试/01-实现与缺陷说明.md`）：

| # | 位置 | 原问题 | 修复 |
|---|---|---|---|
| ① | `store.ts` markSoldOut | 任意 `windowId` 都写标记，核心忽略未知窗口 → 永不生效的脏标记 | 校验必须是该菜该餐真实供应窗口；未指定窗口保留默认推断 |
| ② | `store.ts` toggleItemLock | 售罄判断只比 meal+dishId，A 窗售罄错误阻止锁定 B 窗同菜 | 增加 `mark.windowId === offer.windowId` |
| ③ | `store.ts` swapOffer | 目标售罄判断只比 meal+dishId，跨窗换菜误拦/漏拦 | 只按目标报价自身窗口判断 |
| ④ | `store.ts` clearSoldOut | 一次清掉该菜所有窗口标记 | 可选 `windowId`；多窗口未指定时返回可读失败，不静默全清 |
| ⑤ | `plan.ts` itemViewFromPlanItem / buildMealView | 方案项、换菜候选只比 meal+dishId，A 窗售罄误标/误剔 B 窗同菜 | 由 `item.offerId` 反查报价窗口再比；旧计划未知报价保守按 dishId |
| ⑥ | `menu.ts` buildMenuDiff / prepareCatalogReplacement | 菜单替换只判“菜还在+窗口供应此餐”，残留无意义售罄标记 | 抽出 `soldOutMarkStillServed()`（菜在+窗供应+该窗该餐仍有该菜报价），`droppedSoldOut` 带窗口名 |
| ⑦ | `types.ts` / `plan.ts` / 页面 | `ItemView`/`HomeView.soldOutMarks`/`MenuDiffView.droppedSoldOut` 无窗口字段；首页“解除售罄”不区分窗口 | 新增可选窗口字段（向后兼容）；首页售罄卡片与按钮带 `windowId/windowName`，`onClearSoldOut` 按 `data-window` 精确解除；`itemViewFromPlanItem` 回填 `windowId` |

修复均在本任务允许目录（`miniprogram/`），未改 `core/`、`tools/core/`、T01 冻结文件、PRD、任务卡。

## 4. 第 2 项｜微信开发者工具真实选文件（导入/恢复的成功、取消、非法）

**结论：完成。文件选择是真实系统对话框 + 真实磁盘文件，不是直调 store、不是粘贴文本。**

- 环境：微信开发者工具 2.02.0；模拟器 iPhone 12/13 Pro，基础库 3.17.4，微信 8.0.5；平台字段 `devtools`
- 方法：`automation_element_action` 真实点击「选择文件…」→ 真实 Windows `#32770 打开` 对话框（UI Automation 填文件名 + 点“打开”；取消用 Win32 `BM_CLICK` 点“取消”）→ 页面真实读取 → 预检/确认替换/导出/恢复用 `automation_evaluate` 调用页面自身方法（与按钮 `bindtap` 同一函数，不伪造返回、不直调 store）
- 12 步完整记录 + 15 张有效截图（均 351×760 PNG，非 1×1）：
  `Resources/报告/T05-DSH-补测与红米试用-证据-v2/03-微信工具与选文件/`（`log.json`、`log/01..12`、`screenshots/01..15`、`README.md`）

关键结果（原文摘自各步日志）：

| 分支 | 结果 |
|---|---|
| 成功导入 | 选中 `menu-valid-multiwindow-v2.json`（5,190 字符）→ 预检通过“窗口 2，菜品 4，报价 7” → 确认替换后菜单版本 `menu-simulated-v2-t05v2-import` → `menu-simulated-v2-t05v2-import-b`（有可见前后差异） |
| 取消 | 点对话框“取消”后对话框关闭（`cancel-closed=True`），`menuVersionUnchanged: true`，`importFileName` 仍为上一文件，界面无变化 |
| 非法文件 | 选中 51 字节截断 JSON → `preflightStage: parse`、`JSON 解析失败：Unexpected end of JSON input`、`importErrors` 可见、`applyBlocked: true`、`menuVersionUnchanged: true` |
| 导出备份 | 页面导出 9,466 字符备份文本，落盘 `backup-exported.json`（`http://usr/...` 是小程序虚拟路径，不能当磁盘路径写） |
| 恢复成功 | 真实选中该备份 → 预检通过 → 确认恢复 → “恢复完成，摘要 sha256:13a706… 与恢复前逐项一致” |
| 非法恢复文件 | 选中菜单 JSON 当备份 → `restoreStage: parse`、“不是天科食客备份文件（format=undefined）”，不执行恢复 |

夹具：`C:\Users\link\AppData\Local\Temp\t05v2-files\`（合法 5,320/5,325 字节、截断 51 字节、坏哈希 5,319 字节）；生成脚本 `tools/miniprogram/make-choosefile-fixtures.mjs`。夹具内容和窗口名均明确标注“模拟食堂（T05 选文件取证夹具·非真实菜单）”，不冒充真实菜单。

过程记录（如实）：首次取证时用 SendKeys 发 Esc 取消，被前台窗口抢占而静默失效，遗留对话框把 automator 卡超时；随后改为 Win32/UIA 直接点按钮并断言“对话框已关闭”，重跑后取消分支才真正成立。这不是产品缺陷，是取证手段缺陷，已修复在工具脚本里。

## 5. 第 3 项｜有效注释与复测

**结论：完成，达到 ≥20% 门槛，口径未放宽。**

- 脚本与口径：`tools/miniprogram/count-comments.mjs`（整行注释 / 非空非注释代码行；排除 `src/mock/**`、`src/config/**`、`src/types.d.ts`、`src/assets/wasm`）
- v1 基线：注释 563 / 代码 6,941 = **8.1%**
- 本次终态：注释 **1,533** / 代码 **7,021** = **21.8%**（+970 行注释）
- 分文件：`store.ts` 23.1%、`plan.ts` 24.0%、domain 其余 22–25%、页面 21–28%；逐文件表见 `02-注释补充/domain-b/count-after.txt`、`02-注释补充/pages/count-after.txt`、`06-静态检查/count-comments-final.txt`
- 注释主题按要求覆盖：状态机与视图派生、存储事务（原子写/迁移）、幂等（重复记餐/重复恢复/重复预检）、跨日业务日边界、请求关联（requestId/stale 丢弃）、恢复摘要校验、桥内存边界（WASM 内存复制/释放归属）
- 未做无关重构；未添加凑数注释（新增注释均解释“为什么/边界/失败语义”，实现说明见 `02-注释补充/*说明.md`）

## 6. 第 4 项｜冻结、编译、新二维码

- 编译：`simulator_refresh` 返回 success；模拟器 console 原始输出 `04-候选与构建/compile-console.txt`（无编译错误）
- 静态门禁：TS 4.1.2 与 TS 5.9.3 均 **0 errors / 25 files**；页面静态检查全部 PASS；全量测试 3/3 文件、56/56 例通过（`06-静态检查/`）
- 新预览二维码：`05-红米真机/preview-qrcode.jpg`（470×470 JPEG，本次候选上生成；**旧码作废**）
- 冻结边界：本报告写完后不再改 `miniprogram/**` 与 `tools/miniprogram/**`；后续修复必须重建候选并说明旧证据适用性

## 7. 第 5 项｜红米真机（未执行，等用户）

状态：**未测**。开发者工具模拟器（平台 `devtools`、伪 iOS 10.0.1）不能替代红米真机；没有真机数据，不写“通过”。

需要用户完成（最少步骤，详见 `05-红米真机/操作步骤与记录.md`）：

1. 微信扫码打开预览（`preview-qrcode.jpg`），确认首页能出内容；
2. 记 1 笔午餐 → 看当日汇总；菜单页导入→预检→替换；档案保存→刷新方案；
3. 导出备份并把文件转回手机可选位置 → 恢复该备份 → 看到“摘要一致”；
4. 多任务杀进程重启 → 档案/菜单/记餐仍在；
5. 飞行模式下重开 → 离线读首页/记餐/导出恢复/WASM 计算均可用；再关飞行模式；
6. 计时：冷启动 3 次、热运行（刷新方案）≥5 次、记餐/导出/恢复各 1 次，给原始值 + median/min/max；记录机型、系统、微信版本、基础库版本、是否省电模式。

回传后我补“真机结果”并保持未测项标注；未回传时本卡停在“等待真机配合”，不催促、不用模拟器顶替。

工具侧参考值（**不是真机、不宣布达标**）：同候选上 `onMeasurePerf` 每组 5 次——核心-only median 2.100 ms（min 1.400 / max 5.400）；桥接+复制/释放 median 3.600 ms（1.900 / 4.000）；页面端到端 median 19.500 ms（18.600 / 26.500）。原始数据与说明见 `07-性能原始数据/`。工具侧冷启动观测点未写入（`firstHomeAtMs=0`），**没有**得到可用冷启动值，见 `07-性能原始数据/coldstart-probe.json`。

## 8. 逐项验收状态

| 卡片项 | 状态 | 证据 |
|---|---|---|
| 1 多窗口/同菜多 offer/换菜售罄作用域 | 完成（修复 7 处 + 11 用例） | `01-分支测试/`、`06-静态检查/run-t05-all-final.txt` |
| 2 真实选文件导入/恢复（成功/取消/非法）+ 四页截图 | 完成 | `03-微信工具与选文件/` |
| 3 有效注释 ≥20%（同脚本同口径） | 完成 21.8% | `02-注释补充/`、`06-静态检查/count-comments-final.txt` |
| 4 冻结候选 + 哈希 + 编译 + 新预览码 | 完成 | `04-候选与构建/`、`05-红米真机/preview-qrcode.jpg` |
| 5 红米真机流程 + 冷启动 + ≥5 热运行 + 四口径 | **未测，等用户** | `05-红米真机/` |
| 整体 | **不能标整体完成**（第 5 项未测） | — |

## 9. 未测项 / 限制

1. 红米真机全部项（杀进程重启、飞行模式、真机冷启动/热运行、真机导出恢复选文件、真机截图）——未测。
2. 真实 T03 菜单未就绪，本轮全部用模拟菜单（已明确标注），不依赖、不等待 T04。
3. 工具侧冷启动未取到（观测点未写入），只有真机能补。
4. 性能门槛未冻结：不声明达标；历史 8 ms 仅参考，本轮同候选工具侧 2.1 ms（核心）/3.6 ms（桥接）/19.5 ms（页面端到端）中位数也不能推真机结论。
5. 已知核心限制（非本候选缺陷，供 P01/P09 注意）：T02 v2 只校验 `itemLocks` 有效性，不保证锁定项一定在方案里；核心对未知 `soldOut.windowId` 静默忽略（前端已加校验）。
6. 本报告未走 P02 查收、未做 P09 独立总审；本轮不联系、不监控其他岗位。

## 10. 复现命令

```powershell
cd D:\项目\cpp\Projects\食堂就餐优化系统
node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/run-t05-all.mjs
node tools/miniprogram/typecheck-src.mjs
node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/check-pages.mjs
node tools/miniprogram/count-comments.mjs
node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/make-choosefile-fixtures.mjs
powershell -NoProfile -ExecutionPolicy Bypass -File tools/miniprogram/run-choosefile-evidence.ps1 `
  -Project 'D:\项目\cpp\Projects\食堂就餐优化系统\miniprogram' `
  -OutDir 'Resources\报告\T05-DSH-补测与红米试用-证据-v2\03-微信工具与选文件' `
  -FixtureDir 'C:\Users\link\AppData\Local\Temp\t05v2-files' `
  -ValidMenu 'menu-valid-multiwindow-v2.json'
node tools/miniprogram/candidate-manifest.mjs --out 'Resources\报告\T05-DSH-补测与红米试用-证据-v2\04-候选与构建'
```

## 11. 下一步

- 用户：按 `05-红米真机/操作步骤与记录.md` 扫码操作并回传数据/截图；不可测项直接说“测不了”。
- P01：本反馈可交 P02 查收；第 5 项补测后需出新版本反馈（v3），不拼接旧候选证据。
- 修复任何问题都会重建候选并重新编译/出码，届时本报告 §2 哈希失效，需对应更新。

## 12. 证据目录

`Resources/报告/T05-DSH-补测与红米试用-证据-v2/`

| 目录 | 内容 |
|---|---|
| `01-分支测试/` | 分支测试 stdout、探针实测、实现与缺陷说明 |
| `02-注释补充/` | 补注释前后计数、分文件说明、页面核对 |
| `03-微信工具与选文件/` | 12 步日志、15 张截图、取证 README |
| `04-候选与构建/` | 候选哈希清单、manifest、编译 console、构建说明 |
| `05-红米真机/` | 预览二维码、真机操作步骤与记录表（待回填） |
| `06-静态检查/` | typecheck、页面检查、注释计数、全量测试、工具状态 |
| `07-性能原始数据/` | 三口径原始值、冷启动探测、说明 |
# T08G01 · ZCode · 当前UI交互专项 · 交付反馈 v1

| 项 | 内容 |
|---|---|
| 主任务卡 | `Resources/任务卡/T08G01-ZCode-当前UI交互专项小卡-v1.md` |
| 输入依据 | `Resources/报告/T05U09-DSH-体验收尾归集-交付反馈-v1.md`（§3 固定 candidate） |
| 请求模型 | GLM 5.3 |
| 实际可见模型/档位 | 客户端会话可见 `GLM-5.3-Flash`（协调者界面档位标签显示"高"）；**服务端实际路由/档位未知**，未写成证明 |
| 执行/写入 | 本子代理（独立上下文），只写自己的证据目录与本反馈文件，未改生产代码、未改其他代理目录 |
| 聊天 cwd / 项目根 | `D:\项目\cpp` / `D:\项目\cpp\Projects\食堂就餐优化系统` |
| 证据目录 | `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T08G01-ZCode-UI交互专项-证据-v1\`（`candidate\`、`candidate-work\`、`screenshots\` 41 文件、`logs\`） |
| 状态 | **专项复核完成；发现 0 阻断、3 一般问题（均为工具链/环境，非应用代码缺陷）、1 审美建议、若干未复现/未测。微信开发者工具模拟器实测可用，全部主场景走通；不是最终整机验收** |

---

## 1. 固定身份（现场复算）

| 项 | 值 | 复算方式 |
|---|---|---|
| candidate 源码树摘要 | `sha256:7f6a6ea5071626afeb817592f5ad10f105481a2fbefdfee0b8c4b98626aeba42`（75 文件 / 996165 B） | 按官方 `candidate-manifest.mjs` 口径在自建副本 `candidate\` 上重算，与 U09 §3 一致 |
| 生产路径 | 与 candidate **逐文件 0 差异**（`diff -rq miniprogram/src` exit 0），生产树摘要同上 | 本机现场比对 |
| 冻结 WASM | `miniprogram/src/assets/wasm/mp_core.wasm` 107472 B / `B53C7405A643E8409071ED76D3CB4CCBDF1A37E6E5C408CE1D4A373D4CC00744` | sha256sum 现算 |
| 菜单身份 | `west1-canteen-batch1-nutrition35-chuanxiang6-20261024`（空存储首开页面 data 实读） | automation_evaluate |
| tools/miniprogram | 45 文件 / 649001 B | find+stat |

## 2. 实际操作环境（如实）

- **微信开发者工具：可用**。安装于 `D:\微信小程序\微信web开发者工具`（skill v0.3.11，已登录，昵称"凉笙"）。经 `wechatide.cmd` CLI 完成 auth → `project_import` → `open_project_window`（winId s2），本代理对项目窗口内自己的页面上下文做自动化（evaluate / page_action / element_action / simulator_screenshot / console / debug_clear_cache）。
- **被测对象**：固定 candidate 的独立工作副本 `candidate-work\miniprogram`（DevTools 项目根），测试全程不触碰生产；测后 `diff -r` 核对：src 75 文件与 candidate **逐字节一致**，仅 `project.private.config.json` 被 IDE 导入过程改写（见问题1）。
- **原生面板交互**：simulator_screenshot 拍不到原生 ActionSheet/modal 层（见问题2），改用 DPI 感知的真实鼠标点击（Win32 mouse_event）+ 桌面级截图（`logs/fullscreen2.ps1`）完成原生面板的成功/取消/确认操作。ActionSheet 选择项、modal「放弃返回」均为**真实点击**。
- **模拟器**：iPhone 12/… 基础库 3.17.4；存储在场景1前用 `debug_clear_cache cleanStorageCache` 清空并复核 `wx.getStorageInfoSync().keys === []`。
- 同一 IDE 进程内可见其他项目窗口（疑似 G02/G03 并行实例）；本代理自动化始终绑定自己的 project 路径，未操作其他窗口。

## 3. 逐场景结果（先操作后读码；取消静默不算 Bug）

| # | 场景 | 结果 | 关键观察 | 证据 |
|---|---|---|---|---|
| 1 | 空存储首开：默认六窗口 + 首页切菜单入口 | **通过** | 清存储后重启：首页默认 `mode=simple`、`theme=light`、菜单 `west1-canteen-batch1-nutrition35-chuanxiang6-20261024`（`menuSimulated=false`）；存储 keys=[]（首开未写任何 key）。点「切换 ›」→ `pages/menu/index?focus=import`，页显示「西院西一食堂 · 六窗口菜单」「6 个窗口 · 91 款餐品 · 62 条报价」及数据驱动文案（营养为估算值/仅覆盖 6 窗口） | s01-empty-home-light、s02-menu-page-after-switch；logs/s01-home-data.json |
| 2 | 简易 / 完整两模式 | **通过** | 点 `.mode-pill`：`mode` simple→full、徽标 简易→完整；完整模式在餐卡下出现逐项营养行（碳水 等），空计划时显示"待补全"；无开发者模式含义混入 | s03-home-full-mode、s04-home-full-scrolled* |
| 3 | 浅 / 深 / 跟随系统 | **通过（系统深色切换未测，见未测项）** | 选深色：`preference=dark`、首页/外观页/我的页 `themeClass=tk-dark`，整页深色渲染正常；**我的页深色导航栏为深底白字，旧"白底"问题未复现**（与 U09 §4.2 一致）。选跟随系统：`preference=system` 解析为 tk-light（系统当前 light），`systemNote` 文案正确 | s04-appearance-page、s05、s06-home-dark、s07-profile-dark、s08-home-follow-system |
| 4 | 选菜底栏：数量 / 已知金额 / 安全区 | **通过（未知价分支数据不可触发，见问题5）** | 选 山东杂粮煎饼×1 + 烤冷面×2 → 底栏「已选 3 项 · 合计 ￥15.50」（数量按份数合计、金额=5.50+5.00×2，正确）；「选菜明细」展开/收起复用预览行（×1·￥5.50 / ×2·￥5.00）；确认按钮随 `canConfirm` 联动；底栏位于 home indicator 之上留白（css `env(safe-area-inset-bottom)`） | s32-selfpick-footer、s33-selfpick-detail-open |
| 5 | 个人资料：默认值 / 未保存 / 保存 / 取消 | **通过** | 首开预填 男/20/175/70，徽标「默认示例 · 未保存」、档案版本 0；输入 25 → 保存 → 徽标「已保存」、版本 1、摘要 25 岁；再改 30 → 取消编辑 → 25 且 saved 不变；「计算营养目标」真实 WASM：status Ok、2594 kcal、BMI 22.9、餐次参考齐备 | s09、s10-profile-editing-age25、s11-profile-saved；logs/s12-compute-target.json |
| 6a | 餐次「换一份」原生 ActionSheet：成功 | **通过** | 真实两级原生面板：①「选择要替换的菜品」（列出 烤冷面/山东杂粮煎饼 及份数价格）→ ②「选择替代菜品（同窗口优先）」（手抓饼 ￥5.50）→ 真实点击后晚餐变为 山东杂粮煎饼+手抓饼、约 896 千卡、营养与运费计划（￥11.00）同步重算，无错误 toast、`sheetError` 为空 | s24-swap-dish-sheet、s27-swap-candidate-sheet、s28-after-swap |
| 6b | 取消 | **通过（静默，非 Bug）** | 点面板遮罩/「取消」→ 面板关、无 toast、计划与 `sheetError` 均不变 | s15-test-actionsheet-open 前后状态、evaluate 复核 |
| 6c | 真实打开失败 | **分支已验，真实失败未测** | 模拟器无法制造真实打开失败；用 evaluate 注入 `fail({errMsg:'showActionSheet:fail mock-injected'})`（mock，非真实）：toast「选择面板打不开，请重试」**可见**、`sheetError` 留存 errMsg、不发生换菜——与 U09 修复口径一致；**不据此宣称真机真实失败已验证，也不推测 alertText 为根因** | s31-fail-toast-simulator（toast 在图内） |
| 6d | 单菜「换菜」 | **部分验证** | 详情面板内「换菜」按钮存在且 `data-offer` 正确（两次核对：offer-grilled-cold-noodles / offer-grain-soymilk）；自动化 tap 可触发面板；端到端一次完整单菜换菜受坐标/遮挡影响未补齐（与 6a 共用同一 `chooseIndex`+`pickOfferAndSwap`+`store.swapOffer` 代码路径） | s22-swap-item-sheet、s26、s36-dish-swap-sheet |
| 补 | 首页底部提示条是否截断 | **非缺陷** | 滚动到底后黄色提示「近似结果：候选被候选限额截断（未证明最优）」完整可读（属已知候选限额提示，不重复报新缺陷） | s35-home-bottom-scrolled |

\* 标 `*` 的 4 张截图（s01-home-empty / s02-menu-page / s03-home-full / s04-home-full-scrolled）创建于本代理首次截图前 10 分钟（23:16–23:19），来源无法在本上下文确证（疑为前一次同名任务尝试写入同一证据目录）；已逐张查看，内容与本次固定 candidate 实测一致，**仅作旁证，不计入本代理原始观察**。

## 4. 问题清单（≤8；阻断 / 一般问题 / 审美建议 / 未复现）

**阻断：无。**

1. **一般问题（工具链/环境，非应用代码）**：开发者工具导入项目时把 `project.private.config.json` 的 `projectname` 再次 URL 编码（`%25E5…` → `%2525E5…`），项目窗口标题显示为编码串。
   步骤：`project_import` 指向工作副本 → 查看窗口标题与该文件。预期：显示「天科食客」。实际：标题为 `%2525E5%2525A4…` 编码串，文件被 IDE 改写。证据：`logs/candidate-work-hashes-before/after.txt`（78 文件中唯一差异）+ s19-dpi-desktop。影响仅显示与副本元数据，src 0 差异。
2. **一般问题（工具限制，影响取证）**：`simulator_screenshot` 不包含原生 ActionSheet/确认弹层。
   步骤：evaluate 调 `wx.showActionSheet`（阻塞等待）→ 立即 simulator_screenshot。预期：面板入图。实际：截图无面板（s15-test-actionsheet-open），而 evaluate 超时证明面板开着；必须用桌面级截图取证。非应用缺陷。
3. **一般问题（工具限制）**：自动化选择器引擎对多匹配只命中首个元素，`:nth-child/nth-of-type` 无效。
   步骤：对 `.option:nth-child(2)/(3)` 读 `data-value`。预期：分别 light/system（或 dark）。实际：均返回第一项 `light`。影响依赖序号选择器的自动化可靠性；真实控件 `data-*` 经 tap 正常传递（6a 全流程成功可证）。
4. **一般问题（工具限制）**：`automation_wx_api mock showActionSheet` 未生效。
   步骤：注册 fail 型 mock → evaluate 探针调 showActionSheet。预期：fail 回调被注入。实际：探针 4s 内 success/fail 均未回调（真面板被拉起）；失败分支最终改用 evaluate 直接补丁完成（见 6c）。mock 注入 ≠ 真实失败。
5. **未复现（当前菜单数据不可触发）**：选菜底栏/预览的「已知合计 ￥x（另 m 项待补价格）」与「价格待补」分支。
   步骤：遍历自选页全部 offers 的 `priceLabel`。预期：存在未知价项可勾选。实际：62 项全部有报价（`unknownCount=0`），无法用真实数据触发；相关渲染代码存在（self-pick `index.wxml` 行134/154），本次未验证显示效果。
6. **未测**：跟随系统主题在系统运行中切到深色时的自动跟随（CLI 无法切换模拟器系统主题；仅验证 `system` → 解析浅色 + 说明文案）。
7. **审美建议（低优先级）**：首页空计划时「这餐计划 ￥0.00」与「热量 待补全 / 搭配信息 待补」并列。
   步骤：空存储+未完善资料看首页餐卡。预期（口径一致）：金额与营养同样以"待补/未定"表述。实际：营养显示待补，金额显示确定值 0.00（0 项合计 0.00 数学上成立，但与"未知不按 0 计"的文案观感不一致）。证据：s01-empty-home-light。不阻断。
8. **观察（非缺陷，测试遗留）**：坐标试错期一次真实误点把工作副本早餐计划的「五谷杂粮豆浆」置为 locked；属本代理在一次性副本上的操作痕迹，已随 `cleanStorageCache` 清除，不影响 candidate 与生产。

## 5. 未测项（不宣称通过）

1. 真机运行、真机原生 ActionSheet、真机深浅色与底部安全区真实渲染——全部未测。
2. 跟随系统主题的系统深色实时切换（见问题6）。
3. 未知价/部分未知金额显示分支（数据不可触发，见问题5）。
4. 单菜换菜端到端完整成功路径（部分验证，见 6d）；换菜候选 >6 项的截断提示未实测。
5. 全量回归、算法可达性、营养专项、性能、全天 DP——按卡禁止，未做。
6. 服务端模型路由/档位不可核实 = 未知。

## 6. 测试存储与证据目录遗留

- 模拟器项目存储：已 `cleanStorageCache` 清空，复核 `keys=[]`（含测试期写入的 `tk.ui.*`、`tiankeshike:state:v1`、意外锁定）。
- `candidate-work\miniprogram`：src 75 文件与 candidate 逐字节一致；`project.private.config.json` 被 IDE 改写（问题1），留在证据目录内作记录。
- 开发者工具项目列表新增一条指向 `…\T08G01-…\candidate-work\miniprogram` 的导入项；项目窗口（winId s2）与 IDE 进程保持打开状态，可用 `close_project_window`/`project_remove` 清理。
- `screenshots\` 41 个文件全部经本代理逐张查看；其中 4 张来源待定（§3 注 \*）。`logs\` 内为辅助脚本、页面 data 原始导出（s01/s02/s04/s12）与前后哈希清单。

## 7. 截图索引（41 项，与文件一一对应；均已逐张查看）

| 文件 | 内容 |
|---|---|
| s01-empty-home-light.png | 空存储首开·浅色·简易·六窗口菜单（本代理） |
| s01-home-empty.png * | 同场景（来源待定旁证） |
| s02-menu-page-after-switch.png | 点「切换›」后的菜单与备份页（本代理） |
| s02-menu-page.png * | 同场景（旁证） |
| s03-home-full-mode.png | 完整模式首页（本代理） |
| s03-home-full.png * | 同场景（旁证） |
| s04-appearance-page.png | 显示与外观页·浅色选中（本代理） |
| s04-home-full-scrolled.png * | 完整模式滚动营养区（旁证） |
| s05-appearance-dark-selected.png | 外观页深色·深色选中 ✓（本代理） |
| s06-home-dark.png | 首页深色整页渲染（本代理） |
| s07-profile-dark.png | 我的页深色：深底导航白字，旧Bug未复现（本代理） |
| s08-home-follow-system.png | 跟随系统→浅色首页（本代理） |
| s09-profile-edit-default.png | 个人资料默认值·「默认示例 · 未保存」（本代理） |
| s10-profile-editing-age25.png | 编辑态·年龄改25（本代理） |
| s11-profile-saved.png | 保存后「已保存」·版本1·25岁（本代理） |
| s13-home-after-profile.png | 资料保存后首页生成晚餐推荐（本代理） |
| s14-actionsheet-replace-pick.png / s14-ide-window.png | 面板取证过程图（本代理） |
| s15-ide-with-sheet.png / s15-test-actionsheet-open.png | 证明"模拟器截图拍不到原生面板"（本代理） |
| s16-desktop-with-sheet.png / s17-desktop-after-move.png / s18-after-close-detail.png | 桌面级面板定位过程（本代理） |
| s19-dpi-desktop.png | DPI 归一后桌面全景：面板两项+取消可见（本代理） |
| s20-sheet2-replace-candidate.png / s21-detail-reopen.png / s22-swap-item-sheet.png / s23-popup-closed.png / s24-swap-dish-sheet.png / s25-after-swap-success.png / s26-state-check.png | 换一份/换菜交互过程与状态核对（本代理） |
| s27-swap-candidate-sheet.png | 「选择替代菜品」面板：手抓饼（本代理） |
| s28-after-swap.png | 换菜成功：山东杂粮煎饼+手抓饼·896千卡（本代理） |
| s29-swap-fail-toast.png / s30-probe-state.png | mock 未生效阶段的取证（本代理） |
| s31-fail-toast-simulator.png | **toast「选择面板打不开，请重试」可见**（本代理） |
| s32-selfpick-footer.png | 选菜底栏「已选 3 项 · 合计 ￥15.50」+安全区（本代理） |
| s33-selfpick-detail-open.png | 「已选明细」展开（本代理） |
| s34-cancel-modal.png | 取消确认弹层「放弃本次选择?」（本代理） |
| s35-home-bottom-scrolled.png | 首页滚到底：限额提示完整可读（本代理） |
| s36-dish-swap-sheet.png | 单菜换菜核对过程（本代理） |

## 8. 结论

在固定 candidate（`7f6a6ea5…`，生产一致）上，任务卡要求的六大场景全部在微信开发者工具模拟器中实际操作走通：空存储首开默认六窗口与切菜单入口、简易/完整、浅/深/跟随系统（系统实时切换除外）、选菜底栏数量与已知金额与安全区、个人资料四态、换一份/换菜的原生 ActionSheet 成功与取消静默；失败反馈分支以 mock 注入验证可见，真机真实失败仍未测。未发现应用级阻断或新缺陷；旧"我的页深色导航白底"在模拟器深色下未复现。以上不构成最终整机验收。

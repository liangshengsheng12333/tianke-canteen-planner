# T08H03 · ZCode · 单菜换菜路径定向复核 · 交付反馈 v1

| 项 | 内容 |
|---|---|
| 主任务卡 | `Resources/任务卡/T08H03-ZCode-单菜换菜路径定向复核小卡-v1.md`（总转交卡 `T08H-ZCode-三路补正与解析器四子代理总转交卡-v1.md`） |
| 输入依据 | U09 固定 candidate `sha256:7f6a6ea5071626afeb817592f5ad10f105481a2fbefdfee0b8c4b98626aeba42`；G01 反馈 §3-6d（单菜换菜端到端未补齐项） |
| 请求模型 | GLM 5.3 |
| 实际可见模型/档位 | 本子代理会话可见 `account:zai-start-plan/GLM-5.3-Flash`；**服务端实际路由/档位不可核实 = 未知**，不写成证明 |
| 执行/写入 | 本子代理（独立上下文），只写自己的证据目录与本反馈文件；未改生产、未改其他代理目录、未改原证据、未改 MEMORY、未改任何代码 |
| 聊天 cwd / 项目根 | `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告` / `D:\项目\cpp\Projects\食堂就餐优化系统` |
| 证据目录 | `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T08H03-ZCode-单菜换菜复核-证据-v1\`（`candidate\`、`candidate-work\`、`screenshots\` 7 文件、`logs\` 25 文件） |
| 状态 | **定向复核完成：单菜换菜「成功」与「取消」两条路径均在微信开发者工具模拟器中以真实 UI 操作端到端走通；无可换候选分支用当前固定菜单真实数据不可触发（已附可达性分析），反馈文案以明确标注的 mock 注入验证可见**。未发现应用级缺陷 |

---

## 1. 固定身份（现场复算）

| 项 | 值 | 复算方式 |
|---|---|---|
| 固定 candidate | `sha256:7f6a6ea5071626afeb817592f5ad10f105481a2fbefdfee0b8c4b98626aeba42`（75 文件 / 996165 B） | 在生产树现算 `tools/miniprogram/candidate-manifest.mjs`，与 U09 口径一致 |
| 生产 vs candidate | **当前生产源码树摘要与固定 candidate 完全一致**，无需取历史副本 | 同上现场复算 |
| 自建 candidate 副本 | `证据目录\candidate\`，摘要同上（75 文件 / 996165 B，frozen WASM matches=true） | 同一脚本在副本上重算 |
| 工作副本 | `证据目录\candidate-work\miniprogram`（DevTools 项目根）；测后 src 75 文件哈希与 candidate **逐一相同**，全目录仅 `project.private.config.json` 被 IDE 导入过程改写（已知工具链问题，与 G01 问题1 同源） | `find + sha256sum` 前后各一次（`logs/candidate-src-hashes.txt`、`logs/candidate-work-src-hashes-after.txt`） |
| 菜单身份 | `west1-canteen-batch1…` 六窗口内置菜单（早餐窗口：武汉热干面 5 报价 / 山东杂粮煎饼·烤冷面·手抓饼 3 报价 / 广东肠粉 4 报价） | 运行时 evaluate 实读 catalog |

## 2. 实际操作环境（如实）

- **微信开发者工具**（`D:\微信小程序\微信web开发者工具`，skill v0.3.11，已登录，昵称"凉笙"）。`wechatide.cmd` CLI：auth → `project_import` → `open_project_window`（winId **s3**）→ automation_evaluate / element_action / simulator_screenshot / debug_clear_cache。
- **模拟器**：iPhone 12/…，devicePixelRatio 3；测试前 `debug_clear_cache cleanStorageCache` 并复核 `wx.getStorageInfoSync().keys === []`；测试后再次清空复核 `keys=[]`。
- **原生面板能否被自动化/截图捕获（本卡要求分别记录）**：
  - **元素自动化不可达**：原生 ActionSheet 打开时 `querySelectorAll('.weui-actionsheet__menu')` 返回空数组——不在页面元素树内，element_action 无法操作。
  - **simulator_screenshot 拍不到**：原生面板打开时立即截图（`screenshots/s04-simshot-native-sheet-missing.jpg`），图中只有页面遮罩层，无面板——与 G01 问题2 一致，非应用缺陷。
  - 因此原生面板的**选择与取消均为 DPI 感知的真实鼠标点击**（Win32 SetForegroundWindow + mouse_event，自建脚本 `logs/h03-fg-click.ps1`），面板内容取证用桌面级截图（`logs/h03-fullscreen.ps1` + `logs/h03-crop.ps1`）。窗口识别：本项目窗口 hwnd `0x2080558` rect (839,0)-(1400,1328)，先桌面全景截图确认内容归属后再点击，未操作同机其他 IDE 窗口。
- **自动化选择器引擎限制（沿用 G01 问题3，本次再次实遇）**：多匹配只命中首个元素，`--name` 序号在本页不生效（`.sheet .btn-ghost` 各序号均返回首个"锁定"），`:last-child` 类选择器同样不可靠。故被替换项/第二菜的按钮操作全部改用真实鼠标点击，不走序号选择器。
- 详情面板滚动：`element_action scrollTo(.sheet-body)` 需 `--x/--y` 形式，成功滚动到 y=380 / 回 0（合成 touch 滑动不触发 scroll-view 滚动，已弃用）。
- 首开进入方案态的路径：清存储 → `pages/profile-edit`（真实 tap「编辑资料」，默认示例 男/20/175/70）→ tap「保存资料」（elementId 定位，真实 tap）→ 返回首页出现早餐方案「约 868 千卡 / ￥10.50」（截图 `s01`）。资料保存前的导航用 evaluate 执行 wx.navigateTo（setup 手段，不属于被测路径）。

## 3. 两条被测路径结果（先操作后读码；全部真实 UI 操作）

### 路径1｜单菜换菜「成功」——**走通**

操作链（每步真实操作）：首页有方案态 → 餐卡「这餐详情 ›」（element tap）→ 详情面板内先真实点击**山东杂粮煎饼·锁定**（用户显式锁定其他菜）→ 真实点击**烤冷面·换菜** → 原生选择面板「手抓饼（整份，￥5.50）」→ 真实点击该候选 → 面板关闭、核心重算完成。

| 验证点 | 换菜前 | 换菜后 | 结论 |
|---|---|---|---|
| 原菜 | 烤冷面 offer-grilled-cold-noodles ×1 ￥5.00 | **已不在推荐中**，换入手抓饼 offer-shredded-pancake ×1 ￥5.50 | 原菜变化 ✓ |
| 这餐计划金额 | ￥10.50 | **￥11.00**（5.50+5.50，正确） | ✓ |
| 热量/营养 | 约 868 千卡；能量868·蛋白28.9·脂肪28·碳水126.6 | **约 896 千卡**；能量896·蛋白27.4·脂肪36.6·碳水116.8 | 营养预算随之更新 ✓ |
| 其他显式锁定菜 | 山东杂粮煎饼 locked=true（详情面板显示「已锁定」徽标） | **仍在推荐中且 locked=true**，未被换菜清掉或重算掉 | 显式锁定保持 ✓ |
| 窗口 | 山东杂粮煎饼/烤冷面/手抓饼 | 同窗口（未跨窗） | ✓ |
| 错误反馈 | — | `sheetError=''`、无错误 toast、`refreshing=false`、详情面板保持打开 | ✓ |

证据：`s02-detail-sheet-breakfast.jpg`（详情+换菜按钮）、`logs/h03-win-locked.png`（锁定后「已锁定」+「解除锁定」）、`logs/h03-win-swap-sheet.png`（原生面板：唯一候选 手抓饼（整份，￥5.50）+ 取消，真实桌面截图）、`s04-simshot-native-sheet-missing.jpg`（同刻模拟器截图无面板，证明截图限制）、`s05-after-swap-detail.jpg`（换后详情：￥11.00、煎饼已锁定+手抓饼）、`logs/s00-baseline-home-detail.json`、`logs/s06-after-swap-state.json`。

说明：换菜发起按钮（烤冷面·换菜）为真实鼠标点击（屏幕坐标 1140,927，来自桌面截图定位），非 evaluate 直调页面方法；换后状态为页面 data 实读。

### 路径2｜单菜换菜「取消」——**走通（取消后完全不变）**

操作链：详情面板滚动到 手抓饼（×1 ￥5.50）→ 真实点击其「换菜」→ 原生面板出现「烤冷面（整份，￥5.00）」唯一候选 → 真实点击「取消」（屏幕坐标 1120,1102）。

| 验证点 | 取消前 | 取消后 | 结论 |
|---|---|---|---|
| 推荐内容 | 山东杂粮煎饼(locked) + 手抓饼，￥11.00，约896千卡 | **逐项相同**（offerId 级核对），金额/营养/锁定全部不变 | 取消不变 ✓ |
| 面板 | 原生面板打开 | 面板关闭，无 toast，`sheetError=''`，详情面板保持打开 | ✓ |

证据：`logs/h03-win-cancel-pre.png`、`logs/h03-win-cancel-sheet.png`（原生面板：烤冷面候选+取消）、`s07-after-cancel-unchanged.jpg`、`logs/s08-after-cancel-state.json`。注：本路径取消走的是「取消」按钮；面板遮罩点击取消在餐次级面板已由 G01 验证（静默、非 Bug），本次未重复。

### 补充｜无可换候选时的反馈——**真实数据不可触发；mock 注入（明确标注）验证文案可见**

- **可达性分析（真实数据）**：该分支触发条件 = 窗口可换报价（去掉售罄）全部已在当前推荐里。当前固定菜单三个早餐窗口分别有 5/3/4 个报价，而推荐每餐最多 1–2 项，「标记售罄」入口只存在于本餐详情面板内（即只能对**已在推荐里**的菜标记），非推荐菜无法经 UI 标记售罄——遍历操作顺序后确认：3 报价窗口 + 2 项推荐时恒有 ≥1 个候选，**纯真实 UI 操作无法触发该分支**（分析依据：`domain/plan.ts` swappableOffers 过滤逻辑实读 + 三窗口报价清单运行时实读）。
- **mock 注入（非真实数据、不计为 UI 端到端）**：evaluate 构造 candidates=0 的 mealView 调 `pickOfferAndSwap`（该分支为早退，无任何状态写入），toast **「同窗口暂无可替换的其他菜品」** 在模拟器内可见（`s09-no-candidate-toast-mock.jpg`），注入后复核计划/锁定/`sheetError` 全部不变（`logs/s10-after-mock-state.json`）。文案本身可理解、无错误码外泄；但**真实数据下的触发未复现**，不据此宣称该分支在真实数据下已验证。

## 4. 问题清单

**阻断：无。应用级新缺陷：无。**

1. **一般问题（工具链，已知问题复现，非新发现）**：`project_import` 把 `project.private.config.json` 的 `projectname` 再次 URL 编码（%25→%2525），窗口标题显示编码串。本次复现且仅影响工作副本该文件；src 0 差异。证据：`candidate\` 与 `candidate-work\` 全目录 diff 仅此文件不同。
2. **一般问题（工具限制，已知问题复现）**：simulator_screenshot 拍不到原生 ActionSheet；元素自动化树中无原生面板节点（`querySelectorAll('.weui-actionsheet__menu')` 返回空）。原生面板操作/取证必须真实鼠标点击 + 桌面级截图。证据：`s04-simshot-native-sheet-missing.jpg` 与 `logs/h03-win-swap-sheet.png` 同刻对比。
3. **一般问题（工具限制，已知问题复现）**：自动化选择器引擎多匹配只命中首个元素，`--name` 序号在本页无效。影响：无法按序号选中第二个菜的按钮，改用真实坐标点击绕过。不影响真实用户（真实 tap 事件正常传递，路径1 全程可证）。
4. **观察（非缺陷）**：原生面板未显示 `alertText`（「选择替代菜品（同窗口优先）」标题在模拟器面板中不可见，仅 itemList）。开发者工具渲染行为，是否真机显示未测，不推测原因、不计缺陷。

## 5. 未测 / 未复现（不宣称通过）

1. **真机**运行、真机原生面板、真机滚动与点击——全部未测；本结论仅覆盖开发者工具模拟器。
2. **无可换候选分支真实数据触发**——未复现（§3 补充的分析），仅有标注为 mock 的文案可见性验证。
3. 单菜换菜的**失败重算分支**（换菜后核心返回 not-ok / 抛异常的 toast）——未测；G01 已有失败注入（面板打不开）未重复，真实打开失败仍未复现。
4. 候选 >6 项的「仅显示前 6 项」截断提示——未测（早餐窗口最多 5 报价，天然不可达）。
5. 跨窗口单菜换菜（换窗口）——本路径固定同窗，未测。
6. 全量回归、全天 DP、算法可达性、性能——按卡禁止，未做。
7. 服务端模型路由/档位不可核实 = 未知。

## 6. 测试存储与证据目录遗留

- 模拟器项目存储：已两次 `cleanStorageCache` 清空并复核 `keys=[]`；测试期仅产生 `tiankeshike:state:v1`。
- `candidate-work\miniprogram`：src 75 文件与 candidate 逐字节一致（测后复验）；仅 `project.private.config.json` 被 IDE 改写（问题1）。
- 开发者工具项目列表新增一条指向 `…\T08H03-…\candidate-work\miniprogram` 的导入项；项目窗口（winId s3）已用 `close_project_window` 关闭，IDE 进程保留（登录态与其他代理窗口未动）。如需清理可用 `project_remove`。
- 主操作路径只尝试了两条有实际依据的路径（成功/取消），无反复无效截图。

## 7. 证据文件索引

| 文件 | 内容 |
|---|---|
| screenshots/s01-home-plan-breakfast.jpg | 首页有方案态（早餐 烤冷面+煎饼 ￥10.50 约868千卡） |
| screenshots/s02-detail-sheet-breakfast.jpg | 这餐详情面板：两菜+锁定/标记售罄/换菜按钮 |
| screenshots/s03-sheet-scrolled.jpg | 详情面板滚动（合成 touch 滑动无效的过程记录） |
| screenshots/s04-simshot-native-sheet-missing.jpg | 原生面板打开时模拟器截图无面板（截图限制证据） |
| screenshots/s05-after-swap-detail.jpg | 换菜成功后：￥11.00、煎饼「已锁定」+手抓饼 |
| screenshots/s07-after-cancel-unchanged.jpg | 取消后状态不变 |
| screenshots/s09-no-candidate-toast-mock.jpg | **mock 注入**的「同窗口暂无可替换的其他菜品」toast |
| logs/h03-win-*.png | 桌面级截图裁剪：窗口识别、锁定后、原生面板（成功/取消）、操作前定位 |
| logs/h03-desktop-*.png | 对应桌面全景原图 |
| logs/h03-listwin.ps1 / h03-fullscreen.ps1 / h03-crop.ps1 / h03-fg-click.ps1 | 自建窗口枚举/桌面截图/裁剪/前台点击脚本（可复跑） |
| logs/s00-baseline-home-detail.json | 换菜前页面 data 原始导出（card+detail） |
| logs/s06-after-swap-state.json / s08-after-cancel-state.json / s10-after-mock-state.json | 换后/取消后/mock 后状态导出 |
| logs/candidate-src-hashes.txt / candidate-work-src-hashes-after.txt | candidate 与工作副本测后 75 文件哈希（逐一相同） |

## 8. 结论

在固定 candidate（`7f6a6ea5…`，当前生产一致）的独立工作副本上，G01 未走通的单菜换菜两条路径本轮**均以真实 UI 操作端到端走通**：成功路径（含其他菜显式锁定保持、原菜替换、金额与营养预算同步更新）、取消路径（逐项不变）；无可换候选分支用当前固定菜单真实数据不可触发（可达性分析已附），反馈文案经明确标注的 mock 注入验证可见。原生子代理/真机能力边界与工具链限制如实记录，未发现应用级阻断或新缺陷。以上不构成最终整机验收，不外推到真机。

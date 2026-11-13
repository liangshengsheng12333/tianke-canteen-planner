# T08M02｜ZCode GLM5.3｜当前整合业务终验｜交付反馈 v1

| 项 | 内容 |
|---|---|
| 主任务卡 | `Resources/任务卡/T08M-ZCode-最终验证三子代理总转交卡-v1.md`（总卡）+ `Resources/任务卡/T08M02-ZCode-业务终验小卡-v1.md`（本路独立小卡） |
| 定位 | T08M 三路终验之 M02 路：当前唯一整合候选（97c8085c）的整合业务终验，只验不修 |
| 请求模型 / 实际 | 请求 ZCode GLM5.3；客户端标识 `account:zai-start-plan/GLM-5.3-Flash`（ZCode 子代理）；**服务端实际路由/档位未知**，不把请求配置当实际证明 |
| 项目根 / 证据目录 | `D:\项目\cpp\Projects\食堂就餐优化系统` / `Resources\报告\T08M02-ZCode-业务终验-证据-v1\`（candidate/、mock/、scripts/、tools/、logs/ 175 项、shots/、wechat-project/、identity-before/after.json） |
| 唯一反馈 | 本文件 |
| 状态 | **完成（业务终验范围内逐项执行，结论见 §6；2 条低危缺陷 + 若干工具边界如实记录；模拟器 GUI 实操受并行窗口竞争限制的缺项如实单列 §5）** |

---

## 1. 固定身份核对（开工实算 + 收尾复算，均一致）

| 项 | 卡值 | 实算（开工/收尾各一次） | 结果 |
|---|---|---|---|
| manifest | `sha256:97c8085c…39b13123`，75 源/1008941B、45 工具/649308B，frozenWasmMatches=true | 在 T06e candidate 与本路副本内各实跑 `tools/miniprogram/candidate-manifest.mjs` 两次 | **一致** |
| WASM | 111521B / `8A817926BDE039B74672FA17974323574AEBDB2B41FD8D9815B0E11BFF3A4AD8`，必需 import `env.mp_monotonic_ms` | `sha256sum` 实测 | **一致** |
| core/src/planner.cpp | 225445B / `109555B9A255792CC571BC1620153D33A11358DF7AAB7D25C2EED7F5295ECE69` | 实测 | **一致** |
| native mp_cli.exe | 382464B / `C86461C7A9B108DD9E616A19A6B14F0FDD93BF5D4F4C5F41E1E2D4A69A3C5FAD` | 实测（仅证据目录，未重新编译） | **一致** |

- **独立副本纪律**：`cp -r` T06e candidate → 本证据目录 `candidate/`，复制后在副本内复算 manifest 一致；全部 Node 脚本只从该副本（及 `mock/candidate-src/`，与 `candidate/miniprogram/src` diff 逐文件一致）读源码；本路独立微信项目 `wechat-project/miniprogram` = 候选 miniprogram 副本。收尾复测：manifest 不变、WASM 不变、**wechat-project 与 candidate `diff -rq` 零差异**（本轮连 projectname 再编码副作用都没有）。identity-before/after.json 存证。
- **写入边界**：仅写本证据目录与本反馈；生产树、历史报告、其他路证据未触碰；未改 ACL/契约/期待值；未使用任何旧 storage-snapshot 脚本。

## 2. 实际模型/档位与环境

- 请求 ZCode GLM5.3；客户端标识 `account:zai-start-plan/GLM-5.3-Flash`；服务端路由/档位未知。
- 模拟器：微信开发者工具 2.02.260931 RC（`D:\微信小程序\微信web开发者工具`），本路独立项目导入（授权回执 taskId `auth_4e00…4536` = authorization_success，`logs/m02-import-poll.json`），基础库 3.17.4（clock probe 实测 SDKVersion），winId s6，存储测试前 `debug_clear_cache cleanStorageCache` 清空并 evaluate 复核 `keys==[]`（`logs/m02-storage-empty.json`）。测试窗口已 `close_project_window` 关闭。

## 3. 模拟器门槛（GUI 实测，先于业务流）

| 门槛 | 结果 | 证据 |
|---|---|---|
| 实际编译加载新 WASM | 运行时 `getFileSystemManager().readFileSync('/assets/wasm/mp_core.wasm')` 实读 **111521B**，FNV-1a64 正向 `2558ca13c80a978f`/反向 `970178bb74c527f`，与主机侧对磁盘新产物计算逐位一致（≠旧 304FED66 产物值） | `logs/m02-wasm-fnv.json`、主机侧 fnv64 对照 |
| 新 import 必须绑定 | `WXWebAssembly.instantiate(path,{})` 空 imports **拒绝**（`Import #0 "env": module is not an object or function`）；绑定 `{env:{mp_monotonic_ms}}` 成功，8 导出齐全（mp_api_version/mp_contract_version/mp_alloc/mp_free/mp_plan/mp_nutrition_target/mp_validate_menu/mp_offer_nutrition） | `logs/m02-imports.json` |
| 单调毫秒源 | `performance.now` 存在、有限非负，忙等 ~120ms 递增 119ms（Date.now 同窗 120ms ⇒ 毫秒）；`wx.getPerformance().now` 亦存在（epoch 毫秒基准，仅记录） | `logs/m02-clock-probe.json` |
| 首开状态 | 清存储后首页 `themeClass=tk-light`、简易模式、真实菜单 `west1-canteen-batch1-nutrition35-chuanxiang6-20261024`（builtin，91 菜/62 报价/6 窗口） | `logs/m02-s01-first-open.json`、`logs/m02-switchtab2.json` 链 |

## 4. Node 层（隔离副本 + 真实冻结 WASM；每进程 25 秒外部上限内完成）

| 套件（脚本只读本路副本） | 结果 | 证据 |
|---|---|---|
| H01 h01-after-verify（金额三路径/负数/幂等/零写入/菜单价不污染/旧快照不改） | **44/44** | `logs/m02-h01-after-verify.json` |
| H01 场景B（确认/预算幂等/超支口径） | **41/41** | `logs/m02-scenario-b-confirm-budget-idempotency.json` |
| H01 场景C（锁定/售罄/菜单替换） | **38/38** | `logs/m02-scenario-c-locks-soldout-menureplace.json` |
| H01 场景E（实付三入口上限统一文案/补记幂等/未知不补0） | **12/12** | `logs/m02-scenario-e-after.json` |
| T08L addManualLog 同口径（含恰好 ￥1,000,000.00 合法、0 分合法、null=未知合法） | **13/13** | `logs/m02-t08l-addmanual-verify.json` |
| J02 六场景（62 日桶/滚动清理/3 天 planRaw/导出恢复重开/旧 14 桶/故障注入不半提交）——runner 仅改 WASM 期待值为 111521/8A81 | **344/344** | `mock/results/t08j02-evidence.json`（S1 62 桶 248214B、S2 恰-2026-08-25+2026-10-26、S4 恢复对照 8 行 equal + 0 元/未知各 6 例保留、S5 14→15→16 桶、S6 五类注入零半提交） |
| self-pick（半份米饭同价核心强制：`riceHalf.priceCents===100` 与整份同价、半份只来自菜单 half Offer） | **13/13** | `logs/m02-self-pick.json` |
| home-swap-sheet（换菜面板 Node 真模块冒烟：面板打开/候选截断 6 项提示/按选中项换菜/打开失败保留错误） | **21/21** | `logs/m02-swap-sheet.json` |
| menu-default（内置菜单数据 + 外观/深色类切换断言） | **69/69** | `logs/m02-menu-default.json` |
| dp-chain / bnb-chain（前端不复制算法，结果仅来自 WASM 原文） | **13/13、10/10** | `logs/m02-dp-chain.json`、`logs/m02-bnb-chain.json` |

## 5. 微信开发者工具模拟器实际操作（本路独占项目/存储）

交互方式：页面流转与表单用真实元素 tap/input（automation_element_action）；页面数据/存储读取断言用 evaluate（只读为主，少数页面自身处理器的调用式导航/表单注入在下列各条注明）；原生层（ActionSheet/Modal）受本机窗口裁剪与并行窗口遮挡限制，处理方式逐条如实注明。**每步均为运行时操作与数据断言，非静态截图**。

### 5.1 完整一天业务流（A01 链路）

| # | 步骤 | 结果 | 关键实测 | 证据 |
|---|---|---|---|---|
| 1 | 建档（男/22/172/65 真实输入） | 通过 | BMI 22.0、profileRevision 1、目标 status Ok **2511 千卡**（真实 WASM 计算，与 T08J01 同口径同值） | `logs/m02-input-*.json`、`logs/m02-s02-*`、`shots/m02-s02-profile-saved.png` |
| 2 | 全天预算 40 元 | 通过 | 存储 `settings.budgetCents=4000` | `logs/m02-s03-budget-saved.json` |
| 3 | 六窗方案生成 | 通过 | 主推荐 ￥38.00（偏差 3.5%）/经济 ￥31.00/口味 ￥39.50，营养完整、含估算标记；午餐卡=山东杂粮煎饼窗口 烤冷面 ￥5.00+煎饼 ￥5.50=￥10.50、约 868 千卡 | `logs/m02-s04-plans.json` |
| 4 | 换菜（原生 ActionSheet 路径） | **部分（工具边界）** | 真实 tap「换一份」触发后，原生 ActionSheet 渲染于模拟器窗口被裁剪的手机底部区域，且 `simulator_screenshot` 与页面 DOM 均不可见/不可点（PostMessage、真实鼠标、Enter 均无法命中，详见 §7-2）；换菜业务逻辑由 **Node 真模块 21/21** 覆盖（含 store.swapOffer 由核心重算整餐）；GUI 侧验证了入口与边界状态：未确认餐 `canSwap=true`、**确认后 `canSwap=false`** 且首页明示「这餐已记录，推荐不会覆盖已吃快照」 | `logs/m02-swap-tap*.json`、`logs/m02-swap-sheet.json`、`shots/m02-s06-swap-sheet.png` |
| 5 | 确认午餐 | 通过 | 记录页核对实付面板（烤冷面 5.00/煎饼 5.50）→「午餐已确认 2 项，计入实际消费」，revision 1，消费 ￥10.50 | `logs/m02-s10-lunch-confirmed.json` |
| 6 | 确认早餐（金额 0） | 通过 | 豆浆实付改 0 → 「早餐已确认 3 项」，`unitPriceCents=0, priceKnown=true` 保留，消费 ￥25.50（0 计 0，不吞项） | `logs/m02-s11-breakfast-zero2.json` |
| 7 | 改记（含 100 万上限） | 通过 | 1000000.01 → 拒绝，文案**「已知价格无效：必须是非负整数（分），且不超过 ￥1,000,000.00」**（T08L 统一后口径，J01 旧缺陷文案已消失），零写入（revision 不变、消费不变）；改 6.00 → revision 2，旧 rev1(500 分)入 superseded 历史，消费 ￥26.50 | `logs/m02-s12-edit-1e6-reject.json`、`logs/m02-s13-edit-legal.json` |
| 8 | 补记食物（价格/营养未知） | 通过 | 「冰镇酸梅汤」未知价提交 → `price=null,known=false,nutrition=null`，状态栏「补记已记录；未知营养/价格不会被当作 0」，预算块变「已知实付 ￥26.50（含未填项）」——未知不按 0 计入 | `logs/m02-s14-manual-unknown.json` |
| 9 | 撤销（原生 Modal 路径） | **部分（工具边界）** | 「撤销」真实 tap 后原生 showModal 弹出（阻断后续写入：记录保持 active，行为安全正确），但 Modal 为原生层不可见/不可点（同 §7-2）；撤销业务逻辑由 Node 层覆盖（h01 44 项内撤销/幂等断言 + J02 S1 撤销 4 例） | `logs/m02-revoke-modal*.png`、`logs/m02-s15-revoke.json` |
| 10 | 补记已知价（1e6 超限） | Node 层通过 | UI 开关（价格已知 switch）无法被自动化触发（工具边界 §7-3），已知价超限拒绝由场景E RA4.3 覆盖（同口径文案） | `logs/m02-scenario-e-after.json` |
| 11 | 「已处理」状态正确性 | 通过 | 三餐均有有效记录后再点「重新生成方案」→ 明确「今天各餐次都已确认或结束，无需再规划」，不虚构新方案 | `logs/m02-state-after-refresh.json` |

### 5.2 输入变化 / 连续生成 / 错误可见 / 算法切换

| 项 | 结果 | 关键实测 | 证据 |
|---|---|---|---|
| 输入变化→旧结果不覆盖新输入 | 通过 | 预算 40→30 保存后，方案生成读取新预算（后续以「今日已处理」正确拒绝，无陈旧方案输出）；确认路径每次以当前输入核对实付 | `logs/m02-s16-replan.json`、`logs/m02-state-after-refresh.json` |
| 已确认快照与当天记录一致 | 通过 | 午餐改记后确认快照保持（首页明示不覆盖已吃快照）；存储内 lunch active=rev2/600 分、superseded=rev1/500 分逐字节保留 | `logs/m02-s13-edit-legal.json` |
| 错误可见 | 通过 | 超限/负数/未知均有可见状态栏错误（§5.1 #7；负数与格式错误由场景E RA1.1 Node+页面层覆盖） | 同上 |
| 算法切换 | 通过 | dev 页 tap「动态规划」→ `algorithm=dp` 写入设置并**清空当天旧方案**（`planCleared=true`）；tap 回贪心成功；因三餐均已有记录，DP 方案的 UI 现场生成无法在当天执行（规则性拒绝），DP 正确性由本副本 dp-chain 13/13 + J02 内 greedy 方案 5 次真实 WASM 生成覆盖 | `logs/m02-s17-algo-dp.json`、`logs/m02-s18-dp-plan.json`、`logs/m02-dp-chain.json` |
| 连续生成/重复确认幂等 | Node 层通过 | H01 44 项（重复确认不重复计费）+ 场景E RA4.1（同 clientToken 恰一条） | `logs/m02-h01-after-verify.json`、`logs/m02-scenario-e-after.json` |
| 断网 | 结构性通过 | 源码 `wx.request/wx.downloadFile/wx.uploadFile` 出现次数 **0**，核心为本地 WASM；模拟器网络缓冲读取因窗口已关未取得（如实记录） | grep 计数 0、`logs/m02-network.json`（失败存证） |
| 跨日期 / 前后台 | 模拟器未测（工具无法改系统日期/无前后台切换 CLI）；机制级覆盖：`app.ts onShow→store.ensureToday()` 源码核读 + J02 隔离 mock 344 项中跨日滚动/回收/重开全部经注入时钟覆盖 | `logs/m02-*`、`mock/results/t08j02-evidence.json` |
| 模式与明暗 | 通过 | 简易↔完整切换（完整模式显示逐项营养行，供能占比口径）、外观 dark→`themeClass=tk-dark` 全页生效、`tk.ui.appearance.v1=dark`/`tk.ui.displayMode.v1=full` 持久化 | `logs/m02-s19-dark.json`、`logs/m02-s20-full-mode.json`、`shots/m02-dark-home.png`、`shots/m02-dark-full-home.png` |

### 5.3 62 日桶 / 月历 / 导出恢复（真实宿主侧）

| 项 | 结果 | 关键实测 | 证据 |
|---|---|---|---|
| 月历回看 | 通过 | 2026年10月 31 格全渲染、10-25「有记录+今」；‹上月 real tap → 9月 30 格无虚构；连续翻到 8月/11月（下月方向经页面处理器，见 §7-3）；回看 10-24 空日 `readonly=true` 零记录零虚构；回到今天恢复可写 | `logs/m02-s21-*`、`logs/m02-s22-calendar-sep.json`、`logs/m02-s24-backlook-1024.json` |
| 62 日桶/3 天清理/滚动收口（mock） | 通过 | 见 §4 J02 344/344（62 桶 248214B、第 63 天恰清最旧桶、planRaw 72h 滑窗回收+快照保留） | `mock/results/t08j02-evidence.json` |
| 真实存储 | 通过 | 宿主 `getStorageInfoSync`：3 键（state/外观/显示模式），currentSize=9KB/limit 10240KB，state 7254 字符 | `logs/m02-s25-storage-info.json` |
| 导出（UI 全链路） | 通过 | 菜单与备份页「导出备份」→ `backupReady=true`，digest `sha256:3a213e23…c504081`，真实写入 USER_DATA_PATH `tiankeshike-backup-2026-10-25.json`（7457B，格式/版本/摘要复核一致） | `logs/m02-s26-export4.json`、`logs/m02-s26-backup-file.json`、`shots/m02-export-done.png` |
| 恢复失败原子性（UI） | 通过 | ① 非 JSON → 预检 stage=「文件解析」拒绝「恢复文件不是合法 JSON」；② 篡改 budget 后重算摘要不匹配 → 「备份摘要不一致：文件内容可能被修改或损坏，已拒绝恢复」；两次 `restoreReady=false`、**本机状态零变化**（budget 3000、4 条日志原样） | `logs/m02-s27-restore-parse-reject2.json`、`logs/m02-s27-restore-tamper-reject2.json` |
| 恢复成功（UI 全链路，真实宿主） | 通过 | 原备份预检通过 → 「确认恢复」→ 对照表 **8 行全部「一致」**（业务日期/档案 revision/档案摘要/菜单版本/当日日志/锁定售罄/计划 requestId/恢复内容摘要），catalogMeta 仍 builtin，4 条日志在 | `logs/m02-s28-preflight-ok.json`、`logs/m02-s28-restored.json`、`shots/m02-restore-compare.png` |
| 重开（close+reopen 项目窗口） | 通过 | 重开前后状态 UTF-8 长度 **7351=7351**、预算/3 条有效记录/档案 revision 一致；深色+完整模式随 `tk.ui.*` 恢复；完整模式营养行与供能占比口径正常 | `logs/m02-s29-pre-restart.json`、`logs/m02-s29-after-restart2.json`、`shots/m02-after-restart-dark-full.png` |

## 6. 缺陷清单（2 条，均低危显示层；与工具边界、未测项分开）

1. **【低危·文案】恢复预检摘要把内置菜单状态误标为「模拟菜单」。**
   - 输入：本机真实状态（catalog=null、catalogMeta.source='builtin'，内置 west1 菜单）→ UI 导出 → 预检。
   - 实际：预检摘要显示「菜单 模拟菜单」（`candidate/miniprogram/src/domain/backup.ts:253` 对 `state.catalog` 为空的回退文案）。
   - 对照：同一文件 :214-216 的恢复对照表对同一空 catalog 情况回退为「内置菜单」——同一条件两种口径。
   - 影响：仅预检摘要显示误导，预检校验与恢复行为本身正确（对照表「菜单版本:一致」）。
   - 最短复现：菜单与备份页 → 导出备份 → 粘贴该备份 → 预检 → 读摘要行。
2. **【低危·观察确认】J01 记录的 editLog 上限文案缺陷已在当前候选修复**（改记路径现返回与确认路径同口径的含上限文案，见 §5.1 #7）——此项为修复复核结论，非新缺陷。

## 7. 工具边界与未测项（不伪报、不把 mock 算作模拟器/手机通过）

1. **手机真机**：全程未测。本反馈所有「模拟器」结论限于开发者工具基础库 3.17.4。
2. **原生 ActionSheet/Modal 不可自动化**：「换一份」的两次原生 ActionSheet 与撤销的原生 showModal 均渲染于手机视口底部/中央，本机模拟器窗口将手机底部裁剪在屏幕外，且 `simulator_screenshot` 与页面 DOM 查询均不含原生层；叠加 M01 并行代理窗口持续抢占前台/遮挡，真实鼠标点击与 PostMessage 定向点击均无法可靠命中。GUI 侧只验证了入口存在、触发后写入被安全阻断（未误撤/未误换）、边界状态（canSwap 翻转）；业务逻辑由 Node 真模块（swap-sheet 21/21、h01 44/44）与本候选 J02 覆盖。**不能据此声称换菜/撤销在模拟器里“走通”**，如实记为部分。
3. **「下月›」按钮**与「上月」同 class，选择器引擎只认首个匹配；下月方向经页面自身处理器 `onNextMonth` 完成（`logs/m02-nextmonth-eval.json`），上月方向为真实 tap。补记面板「价格已知」switch 无法被自动化触发（元素属性选择器不可达），已知价补记由 Node 场景E覆盖。
4. **恢复成功路径的粘贴自动化**：textarea 的 bindinput 不被自动化 input 触发、7931 字符超 cmd 参数上限；改用“应用内读取备份文件→传入页面自身 onRestoreInput 处理器”完成（文本内容与用户可粘贴内容逐字节相同），预检/应用按钮均为真实 tap。
5. **跨日期/前后台/断网开关**：模拟器无法改变系统日期、无前后台切换与网络开关 CLI；跨日/回收/重开语义由 J02 注入时钟的隔离 mock 覆盖，断网由源码零网络调用结构性覆盖（network 缓冲读取因窗口关闭未取得，如实记录）。
6. **限额与时钟路径**：模拟器实测默认 `settings.limits=null` 存储 + `performance.now` 毫秒源 + null 时钟容忍（clockReads=0）已由 T06e 门槛覆盖；本路复测了运行时 WASM/import/时钟三项门槛一致。未在 UI 注入坏时钟（属核心层，T06e/A18 已有 Node+native 证据）；**无任何“偷偷降级限额”路径发现**（limits=null 原样传核心，UI 无改写）。
7. 正式性能测量、红米、P09 总审、BnB 大规模内存矩阵：按总卡不属于本路，未做。
8. 测试实例的示例存储保留在本路测试项目中，非真实用户数据；项目窗口已关闭。

## 8. 结论（逐项，不用“全部通过”替代）

- 固定身份：通过（开工/收尾双算一致，零漂移）。
- 模拟器门槛（WASM 实载/import 绑定/时钟源）：通过。
- 小卡任务①：建档→六窗方案→确认→改记→补记→状态机链路 GUI 走通；换菜/撤销的**原生面板步骤**受工具边界记为部分（逻辑 Node 全覆盖）；五重点中金额0/未知、非法实付拒绝、100 万上限（确认✓改记✓，补记 Node✓）、半份米饭同价（Node 13/13 + 当前菜单无 half offer 不触发 UI）、套餐米饭计一次（J03 核心证据 + menu-default 69/69 数据一致）全部成立。
- 小卡任务②：输入变化/快照一致/明暗/模式/重开通过；跨日期/前后台/断网为边界记录（机制 Node 覆盖）。
- 小卡任务③：62 桶/月历/清理/导出恢复原子性——隔离 mock 344/344 + 真实宿主导出/预检拒绝/恢复成功/重开全通过（J02 此前“真实宿主未测”的缺项本路补上）。
- 缺陷：2 条低危显示层（§6）；0 阻断、0 数据完整性问题。

完成后停写。

# T08J01 · ZCode GLM5.3 · 微信端完整使用流程独立核查 · 交付反馈 v1

| 项 | 内容 |
|---|---|
| 主任务卡 | `Resources/任务卡/T08J01-ZCode-微信端完整使用流程小卡-v1.md`（独立业务核查卡 T08J01，只读/独立测试） |
| 请求模型 / 实际 | 请求 GLM5.3；实际客户端标识 `account:zai-start-plan/GLM-5.3-Flash`（ZCode 子代理）；**服务端实际路由/档位未知**，不作为证明 |
| 绝对 cwd | `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T06d-ZCode-统一资源修复-证据-v1`（开工目录）；全部写入在下方两个目录 |
| 证据目录 | `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T08J01-ZCode-微信整合流程-证据-v1\`（`candidate\` 工作副本、`tools\`、`logs\` 29 个原始输出、`shots\` 12 张截图） |
| 唯一反馈 | `Resources/报告/T08J01-ZCode-微信端完整使用流程-交付反馈-v1.md`（本文件） |
| 状态 | **完成**。完整一天流程在微信开发者工具模拟器全部走通；H01 五个重点全部实测通过；WASM 新核心确认被运行时实际加载；有效缺陷 1 个（低危文案口径），另见观察与未测项 |

---

## 1. 输入身份与实算复核（开工时本代理自行实算）

| 项 | 卡值 | 实算 | 结果 |
|---|---|---|---|
| sourceTreeDigest | `sha256:2871b4cad6cf801eeb27291c9eb291b3227d0adcf4c6a3270d40e9e34b3441a1` | 在 T06d candidate 内运行其自带 `tools/miniprogram/candidate-manifest.mjs` | **一致** |
| 源码文件 | 75 文件 / 1004620 B | 同上 `sourceFileCount/sourceBytes` | **一致** |
| tools 树 | 45 文件 / 649145 B | 同上 `toolFileCount/toolBytes` | **一致** |
| 包内 WASM | 107936 B / SHA256 `304FED667624EA93B4A77314CFCC74D09AC57B2A2F3A1D6A4EBF8CE79DA370E8` | `ls -l` + `sha256sum` 实测 `miniprogram/src/assets/wasm/mp_core.wasm` | **一致** |
| frozenWasmMatches | true | manifest 输出 | **true** |
| `utils/core-runtime.ts` WASM_IDENTITY | 107936 / 304FED66… | 读源文件 21–24 行 | **一致**（注释明确 A11 值已退役） |

## 2. 实际被测对象与运行环境（如实）

- **被测对象**：T06d candidate 复制到本证据目录的独立工作副本 `candidate\miniprogram`（复制后在副本内复算 manifest 与上表一致）。微信开发者工具导入的是**这个副本**；T06d candidate 原目录只读未动，生产树全程未触碰、未导入。
- **运行环境**：微信开发者工具 `D:\微信小程序\微信web开发者工具`（版本 2.02.260931 RC，skill v0.3.11，登录用户"凉笙"）；模拟器 iPhone 12/…，基础库 3.17.4；`project.private.config.json` libVersion 3.17.4。
- **隔离与清理**：开工时先 `debug_clear_cache cleanStorageCache` 清空**本测试实例的模拟器存储**并 evaluate 复核 `wx.getStorageInfoSync().keys === []` 后才走"首次打开"。真实用户数据未触碰；另两路子代理离线核查不占此 GUI 实例。
- **写盘范围**：仅本证据目录与唯一反馈文件。测试结束后 `diff -rq` 核对工作副本 vs T06d candidate：**仅 `miniprogram/project.private.config.json` 1 个文件被 IDE 导入过程改写**（projectname 再次 URL 编码，见问题2），源码 0 差异；副本内复算 manifest 仍为 `2871b4ca…`。
- **环境恢复**：测试用项目窗口已 `close_project_window` 关闭（winId s4）；本测试实例的示例存储保留当天测试数据（属本卡独占的示例存储，非真实用户数据）。

### 运行时 WASM 身份（本卡核心要求：证明实际编译/加载了新核心，不是旧缓存）

1. **源码侧**：副本 manifest 复算 = `2871b4ca…` 且 `frozenWasmMatches=true`；磁盘 WASM 实测 107936 B / SHA256 `304FED66…`。
2. **运行时实读包内文件**（`automation_evaluate` + `wx.getFileSystemManager().readFileSync('/assets/wasm/mp_core.wasm')`）：byteLength=**107936**，FNV-1a64 正向 `ede1323e76ef745d` / 反向 `2d723de378150f85`；与主机侧对**新** WASM 磁盘文件算出的 FNV 对逐位一致；对 7f6a 备份中的**旧** A11 WASM（107472 B）算出的 FNV 对完全不同（`f25a3ecefcd532c4` / `791d836a882b37e2`）。⇒ 模拟器运行时在该路径实际提供的是新 WASM 字节，不是旧缓存。证据：`logs/wasm-fnv-compare.json` + 本反馈引述的 evaluate 输出。
3. **运行时功能调用**：保存档案触发的营养目标重算（status Ok，2511 千卡）、方案生成、记录汇总全部走真实 WASM 实例成功；dev 视图 `expectedWasmBytes=107936`、`expectedWasmSha256=304FED66…`、`algorithm=greedy`、`schemaVersion=1`（`logs/s25b-devview-identity.json`）。
4. 全程 console 无 error 行（`grep -iE error` 返回空）。

## 3. 实际操作与命令（全部为模拟器内真实运行时操作）

- 工具入口：`D:\微信小程序\微信web开发者工具\wechatide.cmd -c T08J01 <tool>`；本代理自建薄封装 `tools\wxide.ps1`（tap/page data/evaluate/console/screenshot/clear-cache，模式沿用 T08G01，客户端名改 T08J01）、DPI 感知截图/点击 `tools\shot-window-dpi.ps1`、`tools\click-dpi.ps1`、FNV 主机侧脚本 `tools\fnv64.mjs`。
- 项目导入：`project_import --project <候选副本>\miniprogram` → `open_project_window`（winId s4）→ 模拟器编译加载 pages/home/index。
- **交互方式**：页面流转用真实元素 tap（`automation_element_action`）；表单用真实 input 动作（年龄 22/身高 172/体重 65、预算 40、实付草稿输入）；撤销的**原生确认弹层**用 DPI 感知真实鼠标点击"撤销"按钮（本机 DPI 缩放 1.5，坐标按物理像素换算，见问题4）；evaluate 只用于**读页面数据/存储/dev 视图做断言与取证**，唯一例外是回 10 月时"下月"按钮与"上月"同 class 且选择器引擎只认首个匹配，改走页面同名处理器路径未成功（见未测项），实际用"回到今天"真实链接返回。未用 Node 冒充微信，未用 evaluate 直接写业务状态。

## 4. 完整一天流程逐项结果

| # | 卡面步骤 | 结果 | 关键实测 | 证据（logs / shots） |
|---|---|---|---|---|
| 1 | 首次打开 | **通过** | 清存储后刷新：存储 keys=[]（首开不写任何键）；首页 `themeClass=tk-light`、简易模式、`planState=no-profile`、"尚未建档"；默认菜单 `west1-canteen-batch1-nutrition35-chuanxiang6-20261024`（builtin，`simulated=false`，91 菜/62 报价/6 窗口） | s01-first-open-summary.json；shots/s01 |
| 2 | 填写/保存档案 | **通过** | 编辑态真实输入 男/22/172/65 → 保存 → 徽标"已保存"、档案版本 1、BMI 22.0、目标 status Ok（真实 WASM 计算，我的页显示每日目标 2511 千卡估算） | s02-profile-saved.json；shots/s02、s21 |
| 3 | 预算 | **通过** | 预算页真实输入 40 → 保存全天预算 → `getLogsView().budget.budgetSet=true, budgetCents=4000, budgetLabel=￥40.00` | s03-budget-saved.json |
| 4 | 六窗口自选川湘 | **通过** | 午餐自选页列出 6 个窗口（武汉热干面/山东杂粮煎饼烤冷面手抓饼/广东肠粉/海南鸡饭/脆皮烤鸭/川湘小厨）；真实切到"川湘小厨"（27 项可选）；点选 鱼香肉丝套餐￥11 + 宫保鸡丁套餐￥11；步进 +1/−1 正常；确认 → "午餐已确认 2 项（￥22.00），已计入实际消费" | s04-selfpick-initial.json、s04-chuanxiang-window.json、s06-selfpick-confirmed.json；shots/s06 |
| 5 | H01 底栏合计 | **通过** | 草稿态底栏：选 2 项「已选 2 项 · 合计 ￥22.00」=11+11；+1 后「已选 3 项 · 合计 ￥33.00」，−1 恢复 22；`knownTotalLabel` 同步 ￥22.00 | s05-selfpick-footer-2items.json |
| 6 | H01 非法实付拒绝（确认路径） | **通过** | 早餐确认面板第 1 项输入 `1000000.01` → 确认被拒：状态栏"「五谷杂粮豆浆」的实付金额无效：必须是非负整数（分），且不超过 ￥1,000,000.00"，面板不关、草稿原样保留、早餐 0 条记录、实际消费不变 ￥22.00；改为合法 2.00 → 确认成功（3 项，消费 ￥39.00）。中途一次清空输入被自动化工具参数校验挡住、非法值仍在时再次确认**再次被正确拒绝**（意外多验证了一次幂等拒绝） | s09-breakfast-illegal-reject.json、s10-breakfast-confirmed.json；shots/s09 |
| 7 | H01 非法实付拒绝（改记路径） | **通过（含缺陷1）** | 午餐记录"修改"面板输入 `1000000.01` → 保存被拒："已知价格必须是非负整数（分）"，面板不关、草稿保留、零写入（revision 不变、history 0、消费不变）；输入 `-5` → 页面解析层拒绝（"实付价格式不正确（最多两位小数）"，见观察1）；输入 `25.00` → 成功：新有效记录 revision 2、旧记录入历史（history 1）、消费 ￥53.00 | s11-lunch-edit-illegal-reject.json、s12-lunch-edit-negative-reject.json |
| 8 | H01 已吃超支提示 | **通过** | 午餐改 25.00 后（已吃 53 > 预算 40）预算文案三事实齐备："实际消费 ￥53.00 已超全天预算（**仅已吃即超支 ￥13.00**）；另有计划 ￥10.50 / 剩余可用 ￥0.00，全天预计合计超 ￥23.50"，overage=2350 分不重算；还原 11.00 后回到计划口径文案（"计划 ￥10.50 / 剩余可用 ￥1.00"）；撤销早餐后回到"计划 ￥27.50 / 剩余可用 ￥18.00"。两个文案分支+数据字段均与 H01 设计一致 | s13-lunch-edited-25-overspend.json、s14-lunch-revert-11.json、s16-breakfast-revoked.json；shots/s13 |
| 9 | 记录改撤 | **通过** | 改记链路见 #7（revision 1→3，历史快照逐级保留）；撤销：点"撤销"→ 原生确认弹层"撤销后该记录不再计入实际消费与营养汇总，历史中保留'已撤销'"（桌面级截图取证）→ 真实点击"撤销" → "已撤销该记录，实际消费与营养汇总同步回落"，早餐 active 0/history 1，消费 ￥39.00→￥22.00 | s16-breakfast-revoked.json；shots/s15、s15b |
| 10 | H02 整月显示（月历） | **通过** | 查看月历：2026年10月整月 **31 格全部渲染**（10-01…10-31），今日 10-25 标"今"+有记录圆点，图例"有记录/今/今天/外框选中"；上月 → 2026年9月 30 格全渲染、无记录日不虚构；回看 10-24 空日：`readonly=true`、无记录、不补写不虚构；"回到今天"恢复正常可写态 | s17-calendar-october.json、s17b、s18-calendar-september.json、s19-backlook-1024.json；shots/s17 |
| 11 | 切主题/模式 | **通过** | 首页点"简易"徽标 → `mode=full`"完整"，餐卡出现逐项营养行（约 674 千卡+脂肪/碳水行）；我的页点深色 → `preference=dark, themeClass=tk-dark`，我的/首页深色渲染正常 | s20/s21 截图；logs/s24-home-after-restart.json |
| 12 | 关闭重开 | **通过** | `close_project_window` → 重开 → 数据一致：存储 3 键原样（`tiankeshike:state:v1` 20059 字符 + 显示模式 full + 外观 dark）；预算 4000、消费 ￥22.00、午餐 active 1（revision 3，两川湘项 2200 分）、早餐撤销史 1、档案 revision 1 目标 Ok、菜单未漂移、业务日 2026-10-25；UI 恢复深色+完整模式；记录页月历复核：10 月 31 格、10-25 有记录、午餐史 2 条+早餐史 1 条 | s22-pre-restart-state.json、s23-after-restart-state.json、s24-home-after-restart.json、s26-after-restart-logs-calendar.json；shots/s24 |
| 13 | 数据与页面一致 | **通过** | 上述每步均以页面 data + store 视图双口径断言（消费/预算/修订链/月历标记/主题模式），重开前后全部吻合；H01 修订链（3 修订+2 历史）与 H02 状态桶（schema v1、62 天上限源码在位 `MAX_KEPT_DAYS=62`）在同一存储实例共存并一起活过重启 | 同上 + 副本内源读 |

## 5. 缺陷清单（≤8；与建议/观察分开）

**阻断：无。一般/低危缺陷 1 个：**

1. **【低危｜H01 修复的文案口径残留】改记（editLog）路径对"超过上限"金额的拒绝文案不精确，与确认路径不一致。**
   - 最小步骤：记录页 → 午餐已记记录 → 修改 → 实付改为 `1000000.01` → 保存修改。
   - 预期：拒绝且提示与确认路径同口径（说明不超过 ￥1,000,000.00）。
   - 实际：拒绝正确（零写入、面板不关、草稿保留），但文案为"已知价格必须是非负整数（分）"——`1000000.01` 元 = 100000001 分本身是非负整数，真实触发原因是超过 ￥1,000,000 上限，该文案未说明。
   - 当次证据：`logs/s11-lunch-edit-illegal-reject.json`（改记文案）对照 `logs/s09-breakfast-illegal-reject.json`（确认路径文案含上限）；源码定位 `candidate/miniprogram/src/domain/store.ts:1457`（editLog，无上限文案）vs `:1003`（confirmMeal，含上限文案）。
   - 影响：仅提示信息误导，金额校验行为本身正确（合法/非法边界与 H01 验证一致）。

## 6. 建议 / 观察（非缺陷）

1. 页面解析层对负数 `-5` 的拒绝文案是"实付价格式不正确（最多两位小数）"——负数确实非法，拒绝正确，但文案未点明"不能为负"（属页面预检通用文案，H01 未涉及该层，不算缺陷）。证据 `logs/s12-lunch-edit-negative-reject.json`。
2. IDE 导入副作用（复现 T08G01 已知问题1，工具链非应用）：`project.private.config.json` 的 projectname 被再次 URL 编码（`%25E5…` → `%2525E5…`），仅显示/元数据受影响，src 0 差异。证据 `logs/ide-import-private-config.diff`。
3. 自动化点击坐标受系统 DPI 缩放 1.5 影响的现象与解法已记录（首次未生效的一次点击落在窗口外空白处，未触任何 UI；改用 DPI 感知脚本后成功），供后续 GUI 轮次复用：`tools/shot-window-dpi.ps1`、`tools/click-dpi.ps1`。
4. 本轮全程 console 无 error；dev 视图 `algorithm=greedy`（应用默认规划即 greedy，未触发 DP/BnB 路径，符合本卡红线）。

## 7. 未测项 / 测试遗留（不伪报）

- **62 天收口边界未在 UI 用真实数据压到**：单日 UI 流程只产生 1 个记录日，无法也不应以伪造数据走 62+ 天（H02 的 r1–r3 Node 级 15/12/17 断言仍为其边界证据）。本轮 H02 的 UI 侧证据=整月渲染、跨月回看、空日只读不虚构、重开后状态桶完整。
- **下月›按钮**未走成真实 tap：与"‹上月"同 class 且自动化选择器引擎只认首个匹配（T08G01 已知工具限制3）；用页面"回到今天"真实链接完成了回 10 月，月历跨月双向仅"上月"方向有真实 tap 证据。
- **补记食物（manual log）UI 路径**、**换一份/单菜换菜 ActionSheet**：本轮未重复操作（前者不在卡面重点清单，后者 T08G01 已有全流程证据，卡明确不重复老 UI 轮次）；补记的金额校验有 H01 Node 级证据在案。
- **真机**：未测（本卡工具为开发者工具模拟器；"页面路径 pages/logs/index、iPhone 12/…、基础库 3.17.4"均为模拟器口径，不冒充真机）。
- **Toast 原生层截图**：模拟器截图不捕原生 Toast/弹层（T08G01 已知工具限制2）；本轮改用桌面级截图取证原生撤销弹层，Toast 类提示以页面状态栏文案+data 断言为准。
- 62 桶上限的存储体积压力、CPU/内存性能结论、DP20000、PPT、P09 总审：按卡不做。

## 8. 原始证据位置（均在 `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T08J01-ZCode-微信整合流程-证据-v1\`）

- `logs\`：28 个场景 JSON（s01–s26，含 manifest 复算引述、WASM FNV 对比 `wasm-fnv-compare.json`、IDE 导入 diff `ide-import-private-config.diff`）。
- `shots\`：12 张截图（首开/档案/自选确认/非法拒绝/超支文案/原生撤销弹层桌面图×2/月历整月/完整模式/深色/重开后深色完整首页）。
- `tools\`：本轮自建自动化脚本（wxide.ps1、shot-window-dpi.ps1、click-dpi.ps1、fnv64.mjs）。
- `candidate\`：被测工作副本（测后与 T06d candidate 仅 project.private.config.json 1 文件差异，manifest 复算仍 2871b4ca…）。

完成停写。本卡不做修复、不改生产、不改 PPT、不要求用户补拍。

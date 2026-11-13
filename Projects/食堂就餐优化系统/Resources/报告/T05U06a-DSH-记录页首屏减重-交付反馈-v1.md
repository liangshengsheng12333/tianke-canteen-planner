# T05U06a｜DSH｜记录页首屏减重（隔离小卡）交付反馈 v1

## 0. 状态

在隔离副本内完成记录页首屏重排，浅色/深色首屏、空日、月历展开、月度汇总、历史只读、补记/改撤、预算/未知口径与底部导航均有模拟器证据；**生产目录 `miniprogram/src` 未被改动**。送审前已做一次只读独立复核（结论可交，建议已吸收）。等 P01 接收，不自行合并，不启动 T05U06b。

## 1. 任务与执行信息

| 项 | 值 |
| --- | --- |
| 任务卡 | `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\任务卡\T05U06a-DSH-记录页首屏减重隔离小卡-v1.md`（v1） |
| 主 PRD | `Resources\主PRD.md` v0.2（2026-10-20） |
| 请求执行方 / 指定模型 | DSH / **DeepSeek V4.1 Flash** |
| 可核实实际模型/档位 | **未知**；本会话运行时客户端标识为 `deepseek-v4.1-flash-1017`，该标识不能证明平台实际档位与额度 |
| 绝对 cwd | `D:\项目\cpp\Projects\食堂就餐优化系统` |
| 执行时间 | 2026-10-23 16:32–17:22（Asia/Shanghai；页面改动 16:32/16:42，最终截图 16:58–17:00，补充核对 17:22） |
| 执行范围 | 仅 `Resources\报告\T05U06a-DSH-记录页首屏减重-证据-v1\experiment\miniprogram` 隔离副本；只改记录页 WXML/WXSS |
| 未改动 | `miniprogram/src` 生产目录、TS 业务/显示逻辑、日志/统计/持久化、菜单、核心、WASM、共享主题组件、导航行为 |
| 是否接 T05U06b | 否（按要求停止） |

## 2. 输入候选与隔离方法

- 输入：P01 已接收的 T06a2 固定候选
  `Resources\报告\T06a2-P01-接收与T06b放行-证据-v1\manifest.json`
  - 文件 SHA-256：`b4f63727f75a0174f9347f3c921013a4aeecc23e7cb634c68c2711c7a33c7c9f`
  - `sourceTreeDigest`：`sha256:ed137fa0afe146f62c11ae4f8942b2549850411c173b96f922151c090722099f`
  - 源码 75 文件 / 870713 B；工具 38 文件 / 447791 B；冻结 WASM `miniprogram/src/assets/wasm/mp_core.wasm` 107472 B / `B53C7405A643E8409071ED76D3CB4CCBDF1A37E6E5C408CE1D4A373D4CC00744`
- 隔离方法：复用 T05N01a 已验证的隔离预览结构（`experiment/miniprogram` + `experiment/tools/miniprogram` + `experiment/verify` + `experiment/evidence`），开发者工具直接打开隔离副本，不触碰生产目录。

### 2.1 隔离与身份证明（最终态）

`experiment/evidence/copy-manifest/isolation-proof.json`（`node verify/verify-isolation.mjs`，verdict = true）：

| 检查 | 结果 |
| --- | --- |
| 生产 `miniprogram/src` 与 T06a2 候选逐字节一致 | **75/75 一致**，生产树摘要 = 候选摘要（`sha256:ed137fa0…`） |
| 隔离副本与候选的差异 | **只有 2 个预期文件**不同，其余 73 个一致 |
| 副本实际树摘要（用副本自身哈希重算） | `sha256:4e72114abb11001453ec3e19cbf6367e0f8fbe440c6d1e7bc1c70b2f6d2659fb`（与候选不同，证明确实只改了这 2 个文件） |
| `tools/miniprogram` | 38/38 与候选一致 |
| 冻结 WASM | 字节数与 SHA-256 均一致 |

说明：导入时 `verify-copy-identity.mjs` 曾报告 `allMatch: true`（75/75、38/38、WASM 一致）；该 JSON 快照已被改动后的重跑覆盖，无法再独立复核，仅作过程记录。当前 `copy-identity.json` 的 `allMatch: false` 是上述 2 个预期文件差异，不是意外漂移。最终边界以 `isolation-proof.json`（生产 75/75 与候选一致、副本恰好 2 文件不同）为准。另发现并修正了该脚本的一处证据缺陷：原实现的源码树摘要用 manifest 里的期望哈希计算，会恒等于候选摘要、无法证明副本内容，现已改为用副本实际文件哈希计算。

## 3. 实际改动文件（前后标识）

`experiment/evidence/diff/changed-files.json` + `logs-index-wxml.diff` / `logs-index-wxss.diff`（相对 T06a2 候选）：

| 文件（隔离副本内） | 改动前 | 改动后 |
| --- | --- | --- |
| `miniprogram/src/pages/logs/index.wxml` | 20048 B，`a9e93a95f1d28bfc87d6fc2aae7095bad62f00ce566f8d0f59487bb059705fce` | 20254 B，`2c930246907c06fc8632b524cb4cbd7d78aa5f912cefb906d7684acb3b6e626b` |
| `miniprogram/src/pages/logs/index.wxss` | 4571 B，`1504bb033d93c755d44b69d8e2d839df8af5ab9e9a3c096ee51c41e89829b0d1` | 4881 B，`d66139069908fb99046d8366349cfd2b2c2ab5b7dd205576e1ba48ee71edb17c` |

未改 `index.ts`、`index.json`、任何共享文件；未新增图片、主题或新组件。

### 3.1 结构变化（前 → 后）

改动前顺序：绿色 hero（标题＋业务日期＋只读提示）→ 日期条 → 月历 → **月度汇总** → 状态行 → 空日卡 → **当日已知** → 三餐 → 底部导航。

改动后顺序：日期条（日期＋今天/历史标签＋查看/收起月历＋回到今天＋只读提示一行）→ 月历 → 状态行 → 空日卡 → **三餐** → **当日已知** → **月度汇总** → 底部导航。

具体：

1. **删除绿色 hero**：标题由导航栏“天科食客 · 记餐”承担，业务日期与所选日期重复，连同 `hero-sub` 只读提示一并移除；只读提示并入日期条（`.date-hint`），历史日期仍能一眼看到。
2. **日期条压成首行**：`margin-top` 24rpx→0，`padding` 20rpx→16rpx，日期 32rpx/600→36rpx/700，操作间距 24rpx→16rpx，并允许换行（历史日期两个入口时“收起月历/回到今天”自动落到第二行，不挤压日期）。
3. **月历后先给当天餐次**：`month-card` 从三餐之前移到三餐与当日已知之后；空日卡与三餐成为首屏主阅读线。
4. **当日已知后移**：从三餐之前移到三餐之后、月度汇总之前，首屏不再被汇总与说明占满。
5. **重复说明合并**：空日卡原来两条 note（“未记餐不代表摄入为零；可以补记，或在今日页生成方案后再确认。”＋条件性 `emptyActionHint`）合并为一条“未记餐不代表摄入为零。{{emptyActionHint}}”；月度汇总的统计口径说明保留在月度卡片内，不重复搬到首屏。
6. **验证钩子**：给“当日已知”卡片增加 `day-card` class（纯标识，无视觉变化），用于脚本在页尾核对可达性；`month-card`、`meal-card`、`.btn-empty-record` 等既有类名/事件绑定未动。
7. 仅注释同步更新；TS 的 `emptyActionHint / monthLineText / monthNoteText` 等显示字段未改。

## 4. 两处视觉对照

**截图来源：微信开发者工具模拟器**（真实小程序运行时 + 模拟器渲染，由 `simulator_screenshot` 自动截取），**不是静态预览，也不是真机**。对比按同一数据、同一页面滚动位置截取；浅色/深色同一套 `--tk-*` 令牌，没有另写深色样式。

环境：微信开发者工具 2.02.2609231，自动化 skill 0.3.11，基础库 3.17.4，appid `wxbfca8d9d520d5f43`；模拟器逻辑屏 390×844、`windowHeight` 753、`pixelRatio` 3，截图输出 459×990 px（含状态栏/导航栏）。

### 4.1 对照组 A：月历收起，浅色 / 深色首屏（有记录）

浅色：

![有记录-浅色-首屏](<T05U06a-DSH-记录页首屏减重-证据-v1/experiment/evidence/simulator/02-有记录-浅色-首屏（月历收起）.jpg>)

深色：

![有记录-深色-首屏](<T05U06a-DSH-记录页首屏减重-证据-v1/experiment/evidence/simulator/03-有记录-深色-首屏（月历收起）.jpg>)

两屏首屏均为：日期条（2026年10月23日·今天·查看月历）→ 早餐卡（已记、食物、数量、实付、修改/撤销、补记食物、结束餐次）→ 午餐卡开头；月度汇总不在首屏。第一个 `.meal-card` 页面 top = **97 px** < `windowHeight` 753，**无需滚动**即可看到第一餐卡开头。

### 4.2 对照组 B：空日 + 月历展开（浅色）

空日（清空数据、今天、月历收起）：

![空日-浅色-首屏](<T05U06a-DSH-记录页首屏减重-证据-v1/experiment/evidence/simulator/01-空日-浅色-首屏（月历收起）.jpg>)

月历展开（同一天，有记录）：

![有记录-浅色-月历展开](<T05U06a-DSH-记录页首屏减重-证据-v1/experiment/evidence/simulator/04-有记录-浅色-月历展开.jpg>)

空日首屏：日期条 → “这天还没记餐”说明 → **“记一餐”按钮页面 top = 203.19 px** < 753，无需滚动；随后是早餐卡。月历展开时日期条仍在一行（“收起月历”），月历卡完整可点，底部导航在。

## 5. 保留项与可达性证据（全部浅色，同隔离副本）

| 保留项 | 证据 | 结果 |
| --- | --- | --- |
| 月历 | `04` + `sim-07-calendar-open.data.json`（`calendarOpen: true`）；`sim-15-calendar-collapse.json`：false → true → false | 展开/收起均可达 |
| 月度汇总短卡（页尾，滚动可达） | `06` + `sim-09-month-card-text.json`：`本月已记 1 天 · 3 餐`、`本月实付 已知实付 ￥14.50（含未填项）`、`本月热量 未知（含未填项）`；`sim-03d-offset-month-card.json` top=2312.13（页尾），滚动后 `sim-09a-offset-month-card-viewport.json` top=393.85 可见 | 短卡可达，未知口径保留；页面无独立“汇总入口” |
| 历史只读提示 | `10` + `sim-12-history-readonly.data.json`（`readonly: true`，2026-10-22），页内“历史日期只读：仅可查看，不提供改写历史的入口。”+“回到今天”；宽选择器（含 `.btn-empty-record`、`.record .btn-ghost` 等）计数 `sim-12d-history-write-entries-all.json` = **0** | 只读状态可达且无写入口 |
| 当日已知/预算/未知口径 | `05` + `sim-08-day-card-text.json`：`能量 未知`、`已记录菜品 3 项`、`未知项 2 项（不按 0 计入）`、`预算核算不完整…`；`07` 午餐“营养未知” | 保留 |
| 补记/改撤 | `08`（修订 2 有效 + 历史记录（只读）+ 修改/撤销按钮）、`09`（点“修改”展开修改面板）、`sim-11-edit-breakfast.json`（`editLog` 改记成功，旧记录保留历史）。**撤销按钮未实际点击**；补记夹具走 store 注入，UI 补记表单未提交 | 入口可见，修改面板可达，改记成功 |
| 底部导航 | `sim-12c-tabbar-text.json` = `今日记录我的`，每张截图均可见 | 保留 |
| 月度汇总短卡 | `06` 可见；月度卡在页尾，滚动可达（§5 上一行） | 保留 |

补充：`07` 显示午餐“营养未知”、`05/06` 显示“含未填项/未知（含未填项）”，没有把未知营养或未知价格渲染成 0；没有把推荐当作已吃；历史日期不允许写。

## 6. 静态检查

| 检查 | 命令 | 结果 |
| --- | --- | --- |
| 页面结构/绑定 | `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/check-pages.mjs` | 全部页面通过；`pages/logs`：标签闭合、23 个事件绑定均有方法、38 个绑定根标识符可解析（`evidence/static-checks/01-check-pages.txt`） |
| 类型检查（TS 4.1.2，开发者工具） | `node tools/miniprogram/typecheck-src.mjs` | 0 errors / 38 files |
| 类型检查（TS 5.9.3，antigravity 环境） | 同上 | 0 errors / 38 files（`evidence/static-checks/02-typecheck.txt`） |
| 模拟器控制台 | `get_simulator_console` 过滤 `error|fail|exception` | 无匹配（`sim-14-console-errors.txt`） |

## 7. 逐项验收

| # | 任务卡要求 | 状态 | 依据 |
| --- | --- | --- | --- |
| 1 | 只在隔离副本改动，不写生产目录 | **通过** | `isolation-proof.json`：生产 75/75 与候选一致 |
| 2 | 从 T06a2 固定候选复制，复用隔离预览方法 | **通过** | manifest 哈希、75/38/WASM 计数与哈希、`run-preview.ps1` |
| 3 | 去掉重复的绿色 hero（标题/日期重复） | **通过** | diff；浅/深色首屏 |
| 4 | 日期条压缩为一行 | **通过** | 浅/深色首屏；历史日期提示自动换行 |
| 5 | 当天三餐/空日主操作先于月度汇总 | **通过** | 餐卡 top 97、当日已知 1694.5、月度汇总 2312.13 |
| 6 | 浅色、深色首屏无需滚动即见第一餐卡/“记一餐” | **通过** | 97 / 203.19 < 753 |
| 7 | 浅/深色使用既有 `--tk-*` 令牌，无另写主题 | **通过** | diff 只有页面 WXML/WXSS；深色截图 |
| 8 | 月历保留且可到达 | **通过** | `04`、`calendarOpen: true`、`sim-15`（展开/收起） |
| 9 | 月度汇总短卡保留且可到达 | **通过** | `06`、文本与 offset（页尾短卡，滚动可达；无独立入口） |
| 10 | 历史只读提示保留且无写入口 | **通过** | `10`、`readonly: true`、宽选择器计数 0（`sim-12d`） |
| 11 | 补记/改撤保留且可到达 | **通过** | `07/08/09` 入口与修改面板可见、`editLog` 改记成功；撤销未实际点击 |
| 12 | 预算/未知口径保留（未知不按 0） | **通过** | `05/07`、文本含“未知项…不按 0 计入”“含未填项” |
| 13 | 底部导航保留 | **通过** | `sim-12c-tabbar-text.json`、全部截图 |
| 14 | 不渲染未知营养为 0、推荐不等于已吃、不改写历史日期 | **通过** | 数据快照 `sim-03/sim-08/sim-12`；无新增写入路径 |
| 15 | 不加装饰图片、新主题、大改版；不改 TS 显示字段（除非必要） | **通过** | 仅 2 文件、无新资源 |
| 16 | 列出实际改动文件的前后标识 | **通过** | 第 3 节 |
| 17 | 两组视觉对照（浅/深首屏；空日或展开月历） | **通过** | 第 4 节（两组都给了） |
| 18 | 说明截图来自模拟器还是静态预览 | **通过** | 第 4 节开头 |
| 19 | 完整回归 | **未执行（按要求留给集成）** | — |
| 20 | 真机验证 | **未执行** | — |

## 8. 未测项与限制

- 未在真机（含红米 K90 Pro Max / iOS）验证；模拟器不覆盖安全区、系统字体放大、真机触控与性能。
- 未做完整回归、未跑其它页面/主题组合；未验证 `mode = full`（完整模式）下的首屏，本卡证据均为默认简易模式。
- 未验证月历翻月到无记录月份、跨月边界、补记表单完整提交流程（只验证面板可达与 `editLog` 成功）。
- 未做低端机/长列表性能对比，未做屏幕阅读器/无障碍专项。
- 浅/深色切换通过“显示与外观”页真实点选验证；未覆盖系统跟随（`system`）在真机切换。
- 本卡是隔离 UI 候选，不是可发布候选；合并前仍需 P01 决定，并在新候选上重跑受影响回归。

## 9. 失败、异常与修正记录

- **无阻断性失败**；静态检查、类型检查、控制台过滤均无异常。
- 采集过程问题 1（已修正）：第一次采集前隔离环境残留上一轮测试数据，导致“空日”截图实际是有记录状态；脚本改为采集前显式 `resetLocalData` 并重跑，本反馈全部使用重跑后的证据。
- 采集过程问题 2（已修正）：自动化 `offset` 返回相对视口坐标，最初被当成页面坐标，导致月度汇总截图滚错位置；脚本改为先回顶再取 offset，并保存滚动后的复核 offset。
- 采集过程问题 3（已规避，不构成页面缺陷）：store `makeRecordId` 只精确到毫秒，同一毫秒连续补记多餐会撞 id，测试夹具用 60ms 间隔规避；真实 UI 点击无法在同一毫秒完成多餐。
- 证据工具缺陷（已修正）：`verify-copy-identity.mjs` 的源码树摘要原本用 manifest 期望哈希，恒等于候选；已改为副本实际哈希，并在报告第 2.1 节说明。`verify-isolation.mjs` 也已补 `--out`，复核时可写到临时目录而不覆盖证据。
- 复核建议（已吸收）：独立只读复核指出 3 点证据强度问题，均已处理——① 历史只读写入口计数选择器补上 `.btn-empty-record` 等并以 `sim-12d` 复测为 0；② 补测月历“展开后可收起”（`sim-15`，false→true→false）；③ 报告把“月度汇总入口”改为“月度汇总短卡（页尾，滚动可达）”，并把“补记/改撤可操作”收敛为“入口可见、修改面板可达、改记成功；撤销未实际点击”。
- 视觉小限（非本卡范围）：已知小计行在 390 px 宽度下“营养（已知小计）”与长数值会换行，属改动前既有排版，未在本卡扩大修改范围。

## 10. 证据位置

根目录：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T05U06a-DSH-记录页首屏减重-证据-v1\`

| 路径 | 内容 |
| --- | --- |
| `experiment\miniprogram` | 隔离副本（唯一被改的 2 个文件在 `src\pages\logs\`） |
| `experiment\verify\run-preview.ps1` | 模拟器采集脚本（清数据→空日→注入夹具→浅/深色→月历→汇总→改撤→历史只读→控制台） |
| `experiment\verify\verify-isolation.mjs` | 最终隔离证明（生产未动 + 副本只差预期 2 文件） |
| `experiment\verify\verify-copy-identity.mjs` | 逐文件身份核对（改动后 73/75、tools 38/38、WASM 一致） |
| `experiment\verify\diff-against-candidate.mjs` | 改动范围（2 个 modified，无 added/deleted） |
| `experiment\evidence\copy-manifest\isolation-proof.json` | 最终隔离证明 JSON |
| `experiment\evidence\copy-manifest\copy-identity.json` | 改动后逐文件核对 JSON（含 2 个预期差异明细） |
| `experiment\evidence\diff\changed-files.json`、`*.diff` | 改动文件身份与原始 diff（WXML 11735 B、WXSS 2773 B） |
| `experiment\evidence\static-checks\01-check-pages.txt`、`02-typecheck.txt` | 静态检查原始输出 |
| `experiment\evidence\simulator\01–10*.jpg` | 10 张模拟器截图（见第 4/5 节与 README） |
| `experiment\evidence\simulator\README.md` | 截图来源、夹具、关键测量、注意事项、复现命令 |
| `experiment\evidence\simulator\*.data.json / *.json` | 各状态页面数据、元素文本、offset、视口、控制台过滤结果；含 `sim-12d-history-write-entries-all.json`（宽选择器计数）与 `sim-15-calendar-collapse.json`（展开/收起） |
| `experiment\evidence\simulator\run-log.txt` | 采集运行日志（含工具调用摘要） |
| `experiment\evidence\SHA256SUMS.txt` | 证据目录 60 个文件的 SHA-256 清单（便于 P02/P09 复核） |

主要截图 SHA-256（`experiment\evidence\simulator\`）：

| 截图 | SHA-256 |
| --- | --- |
| `01-空日-浅色-首屏（月历收起）.jpg` | `dcc73c5e3556e44e74b771401dbc098a1714360103ede894fa4b1714368d982f` |
| `02-有记录-浅色-首屏（月历收起）.jpg` | `5621af5e18c20ae81dc0bddfdc86b8760b7f2750025b4e04a6f9fe916597fb90` |
| `03-有记录-深色-首屏（月历收起）.jpg` | `410ed4cf4340fdc135f337e81babf2b0c6717553e49002fa964742c31db944da` |
| `04-有记录-浅色-月历展开.jpg` | `22e7974e27d6b5de1edb45fd42eee672e23becd4c2fa58c34af151a098c5afb4` |
| `05-有记录-浅色-当日已知短卡（预算与未知口径）.jpg` | `fa1bc8962ffbc4eb4ee71827d2af6ca11e178d81a2ebbb9ac2ea7df026828a23` |
| `06-有记录-浅色-月度汇总短卡.jpg` | `3f8e21c766573b7f4434e1e0922190ff5f3437404714775aa37f1e9d0a15474f` |
| `07-有记录-浅色-午餐与晚餐-未知口径.jpg` | `55f0fecd4f586599c2f19ef60093acdc400f9c12797055f3ece7191e3d3ff4c5` |
| `08-改记后-浅色-修改撤销与历史记录（只读）.jpg` | `cddce8651774ffd45c0bdb4b3283297a317bff5603aace3ab22f2b18a16d3157` |
| `09-改记后-浅色-修改面板可达.jpg` | `f033058978347c2f46d53ea43c5b8052f969547fec1aa9300de2e3820e8b6f15` |
| `10-历史日期-浅色-只读首屏（无写入口）.jpg` | `c788dcb38e386527431625083407a519fbcbb056ff9a5a14f386ddc6092fb0ac` |

## 11. 复现命令

```powershell
cd "D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T05U06a-DSH-记录页首屏减重-证据-v1\experiment"
# 只读复核：结果写到临时目录，不覆盖本次证据
node verify\verify-isolation.mjs --out "$env:TEMP\t05u06a-isolation.json"
node verify\verify-copy-identity.mjs --out "$env:TEMP\t05u06a-identity.json"
node verify\diff-against-candidate.mjs --out "$env:TEMP\t05u06a-changed.json"
node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/check-pages.mjs
node tools/miniprogram/typecheck-src.mjs
# 重新采集（会重写证据）：先确认需要，再执行
powershell -NoProfile -ExecutionPolicy Bypass -File verify\run-preview.ps1
```

⚠️ 上述前三条命令**不带 `--out` 时会覆盖** `evidence/copy-manifest/*.json`、`evidence/diff/*.json`（`generatedAt` 变化会让 `SHA256SUMS.txt` 失配）；`run-preview.ps1` 会清空并重截 `evidence/simulator/` 下的截图和 JSON、重置隔离副本本地数据。只想复核时请用带 `--out` 的写法，不要随意重跑 `run-preview.ps1`。

`run-preview.ps1` 需要微信开发者工具已登录且自动化端口可用；脚本会重置**隔离副本**本地数据、注入测试夹具、切浅/深色、滚动与点击，并把截图/JSON 写到 `experiment\evidence\simulator\`。当前 10 张截图的采集时间见 `evidence\simulator\README.md`（16:58–17:00）。

## 12. 交接

- 下一负责人：**P01**（决定是否接收合并；本卡不合并生产）。
- 不启动 T05U06b；T06b 业务闭环、T07a 算法验证不受影响（生产目录未动，隔离副本独立）。
- 若 P01 决定合并，请按新候选重跑：真机首屏、浅/深色、系统跟随、完整模式、空日、历史只读、补记/改撤，以及受影响页面的完整回归。
- 本反馈中的“通过”仅指隔离副本 + 微信开发者工具模拟器范围内的证据，不等同于真机通过或总体验收通过。
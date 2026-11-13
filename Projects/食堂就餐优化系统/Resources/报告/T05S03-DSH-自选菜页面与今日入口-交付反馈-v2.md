# T05S03｜DSH｜自选菜页面与今日入口 — 交付反馈 v2

- 卡片版本：`Resources\任务提示词\T05S03-DSH-自选菜页面与今日入口-v2.md`（v2，2026-10-22 读取执行）
- 放行依据：`Resources\报告\T04A03-T05S02a-P01-接收与并行续行裁定-20261022-v1.md`（P01 已核对 S02a、放行 S03v2）
- 项目根（实际 cwd）：`D:\项目\cpp\Projects\食堂就餐优化系统`
- 平台/执行角色：DSH
- 指定模型：**DeepSeek V4.1 Flash**（本卡明确不是 Gemini 4 派单；本窗口未出现 Gemini 4）
- 实际可核实配置：`C:\Users\link\.dsh\profiles\desktop\cordis.patch.yml`（2,341 B，SHA256 `D833C6727A619188979FEE27714525EF9EFF782526EFC8A3A36B22803B4977E8`），`agent-default-model` 段 `provider: qw / model: deepseek-v4.1-flash-1017 / reasoningEffort: high`；与服务端真实路由/子版本/配额：**未知**（本窗口无独立可核实证据）。
- 环境：Windows 11 10.0.26300 / Node v24.19.0 / PowerShell 5.1.26100.9711；详见证据 `04-环境\01-运行环境与模型配置.txt`。

## 一、输入身份与开工核对（先核对后改源码）

| 项 | 值 |
| --- | --- |
| S02a 唯一反馈 | `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T05S02a-DSH-营养快照接续与断言收口-交付反馈-v1.md`（10,464 B，第 14 行输出候选 `sha256:5feef192…cb17`） |
| S02a 输出候选路径 | `Resources\报告\T05S02a-DSH-营养快照接续与断言收口-证据-v1\03-输出候选\manifest.json` |
| 输入候选身份 | `sha256:5feef1925d426693110af9af27ca9972849c30c90fcc5a3f02b8eb21aac8cb17`（70 源文件 / 749,479 B；工具 38 文件 / 433,565 B） |
| 冻结 WASM（必须不变） | 72,881 B / `715CD7701B64D8F493A110C348B5F643979536578C7380C29837E05C4F31D52C` |

核对方式：先按 P01 放行文档与 S02a manifest 固定输入候选，改动后以同一 `candidate-manifest.mjs` 重算当前树并逐文件对比；结果见 `00-输入候选\01-输入候选与工作区核对.json`：

- 改动 5 个、新增 4 个、删除 0 个、**超出本卡声明范围 0 个**；
- 被改文件的“旧哈希”与 S02a 候选清单完全一致（说明改动前工作区等于 `5feef192…cb17`）；
- `frozenWasmMatches: true`，`test-home-view.mjs / test-self-pick.mjs / test-t05-store.mjs` 与输入候选逐字节一致。

## 二、本卡输出候选

| 项 | 值 |
| --- | --- |
| 输出候选路径 | `Resources\报告\T05S03-DSH-自选菜页面与今日入口-证据-v2\03-输出候选\manifest.json` |
| sourceTreeDigest | `sha256:ee6790e85ea2a5bc8ea251c9722d74eefb126db6020c97f76837b802490d2ca2` |
| 规模 | 源文件 74 / 777,450 B；工具 38 / 433,612 B |
| 逐文件哈希清单 | `03-输出候选\hashes.sha256`（12,052 B） |
| WASM | 未变（同上 72,881 B / `715CD770…D52C`） |
| 相对输入候选改动 | `03-输出候选\01-相对S02a输入候选改动.json`（changed 5 / added 4 / removed 0 / unexpected 0） |

## 三、改动文件（新增 4 + 修改 5）

| 文件（项目根相对） | 字节 | SHA256 | 说明 |
| --- | --- | --- | --- |
| `miniprogram/src/pages/self-pick/index.ts` | 16,472 | `68EA208E35A9E230DD844DD262AD7887F7C015C8DFCE8F94F2E2E75A9886292C` | 新增次级页逻辑 |
| `miniprogram/src/pages/self-pick/index.wxml` | 7,568 | `606E4429AE4E55A9257E7CE7762B8DCBBFDA0B484D1841FE6D6D96FC17777596` | 页面结构 |
| `miniprogram/src/pages/self-pick/index.wxss` | 4,329 | `2972702D1FC1BDA718AB4FDFE30F7E619E8E5C82F7F64B74FEF94C8295EFEB80` | 共用令牌样式 |
| `miniprogram/src/pages/self-pick/index.json` | 46 | `0E34060671213E1A47AD9346262EA789E8FE7458A69E9F2E474721CB5CCE2436` | 页面标题 |
| `miniprogram/src/app.json` | 511 → 540 | `52DC32C61EA57019676B65DE48BDF05C95A0A93CBEF03EAA24D9C4CEB4310F58` | 注册新页 |
| `miniprogram/src/pages/home/index.ts` | 31,529 → 31,711 | `B4E55E1C8937640F21C0582037A228B3EB6EDC43131768E1290ACBA7673F2644` | 入口改导航 + 需更新提示 |
| `miniprogram/src/pages/home/index.wxml` | 18,479 → 17,895 | `BEAE3025C7CE2CDF3D1F00BBF8A941B3EFD5B78BA34D292F13E6299CEFDAC763` | 移除旧弹层、加提示横幅 |
| `miniprogram/src/pages/home/index.wxss` | 10,768 → 10,697 | `8BF9D4240D9FFDF3ED132B538FFC9658147B6A6386A3A2E77650D35E83BFDA48` | 删旧弹层样式、加横幅样式 |
| `tools/miniprogram/check-pages.mjs` | 6,279 → 6,326 | `5E639B29567918CD70F147ABB836EF3745BC544E6558CAFD954D46497C48F223` | 静态检查清单加 self-pick |

逐文件理由与状态覆盖见 `02-任务局部检查\02-改动清单与理由.md`。

## 四、调用的既有接口（全部来自 S02a 交付，未新增/未改签名）

`getSelfPickView(meal)`、`newSelfPickDraftToken()`、`previewSelfPickDraft(meal, windowId, selections)`、`confirmSelfPickMeal(meal, {windowId, draftToken, selections})`、`reopenMeal(meal)`（已结束餐次走既有重开）、`ensureToday()`；成功记录经既有 `getLogsView()/getHomeView()` 出现在今日与记录/月历。

约束遵守：草稿（draftToken/windowId/selections）只在页面 data，取消/返回只丢弃不写存储；唯一写入点是用户点“确认吃了”；重复提交复用同一 `draftToken`，store 返回 `duplicate:true` 不累计；确认后只提示“剩余推荐需更新”，刷新仍由用户在今日页点既有“刷新方案”，页面不自动重算；未改历史日志、未追溯补算。

## 五、实际执行的操作与结果

| # | 命令（项目根执行） | 结果 | 证据 |
| --- | --- | --- | --- |
| 1 | `node tools/miniprogram/typecheck-src.mjs` | exit 0；TS 4.1.2：0 errors / 37 files；TS 5.9.3：0 errors / 37 files | `01-静态检查\01-typecheck.txt` |
| 2 | `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/check-pages.mjs` | exit 0；10 个页面全部 PASS（含 `pages/self-pick`：标签闭合 / 9 个事件方法 / 26 个 data 根标识符） | `01-静态检查\02-check-pages.txt` |
| 3 | `node --import ./tools/miniprogram/register-ts.mjs "Resources/报告/T05S03-…-证据-v2/02-任务局部检查/00-页面局部核对.mjs"` | exit 0；14 项全通过（真实 AppStore + 真实 WASM + mock wx） | `02-任务局部检查\00-页面局部核对输出.txt`、`…结果.json` |
| 4 | `node "Resources/报告/T05S03-…-证据-v2/00-输入候选/00-核对脚本-s03-baseline.mjs"` | exit 0；改动 5 / 新增 4 / 越界 0 / WASM 未变 | `00-输入候选\02-核对摘要.txt`、`03-输出候选\*` |
| 5 | `node --import ./tools/miniprogram/register-ts.mjs --test tools/miniprogram/test-home-view.mjs` | **1 个失败点**：§5 三条旧弹层断言过期（详见第六节）；同文件其余断言全部 PASS | `02-任务局部检查\01-既有test-home-view观察.txt` |
| 6 | `node "Resources/报告/T05S03-…-证据-v2/04-环境/02-证据文件自检.mjs"` | exit 0；证据 20 文件，BOM/清单/manifest 一致，问题 0 | `04-环境\03-证据文件清单.txt` |

页面局部核对 14 项覆盖：今日入口跳转、窗口/菜单来自真实视图、草稿不落存储、未选不可确认、勾选只预览、数量 1–99、取消不写存储、两窗口切窗清空、确认写 1 条、重复确认不累计、已确认拦截并指向记录页、已结束拦截 + `reopenMeal` 重开、空草稿直接返回、简易/完整两模式均保留选择/金额/未知/确认、记录进入既有读模型、自定义两窗口菜单套餐按总价计一次且营养四项均 `null`（未补 0）。

## 六、逐项验收状态（对照卡片）

| # | 卡片要求 | 状态 | 依据/备注 |
| --- | --- | --- | --- |
| 1 | 独立次级页 + 今日入口，不在记录页加第二入口 | 满足 | 新页 4 文件；`onOpenSelfPick → /pages/self-pick/index?meal=`；记录页未改 |
| 2 | 保留“今日/记录/我的”主导航 | 满足 | 只改今日入口与提示，未动 tabbar |
| 3 | 返回/加载/空数据/错误/取消/确认成功/重复提交状态 | 满足（Node 核对） | 状态实现见改动清单第四节；未在开发者工具目测 |
| 4 | 简易/完整模式均保留核心能力 | 满足（Node 核对） | 14 项核对第 12 项，两模式均可选/可确认/显示金额与未知 |
| 5 | 浅色默认、深色、跟随系统 | 满足（代码级） | 根节点 `{{themeClass}}` + `applyPageAppearance()` + 全部 `--tk-*` 令牌；**渲染未目测** |
| 6 | U05a 视觉参照、7.3 尺寸、长文本换行不裁切 | 部分（静态保证） | 复用共享组件与令牌；长名称/份量/套餐/缺项已设 `word-break`/`flex-wrap`；**未在开发者工具/真机目测** |
| 7 | 单餐次/单窗口、真实份量、套餐不重复计价、半份同价 | 满足 | 全部由 store 接口返回；页面不重算；14 项核对第 14 项套餐 ￥12.00 记 1 行 |
| 8 | 预算/营养偏离只提示不拒绝 | 满足 | `preview.hints` 原样展示；`preview.ok` 不由提示决定 |
| 9 | 沿用“需更新”提示，仅用户主动触发刷新 | 满足 | 今日页新增 `planUpdate` 横幅，按钮绑定既有 `onRefreshPlan`；不自动重算 |
| 10 | 营养 null 按未知显示、不补 0、不阻止确认 | 满足 | `nutritionSums:null`、`incompleteNutrients` 四项、记录 `knownSums` 四项 `null` |
| 11 | 不实现核心营养接口、不改领域/测试/WASM | 满足 | 改动清单 4 类零改动；核对越界 0；WASM 未变 |
| 12 | 仅必要局部检查，不做全量回归/真机/新依赖 | 满足 | 只跑上述 6 条命令；未安装任何依赖 |

## 七、未运行项

- 微信开发者工具编译、模拟器、真机：未运行（本卡不做真机；本窗口无开发者工具自动化证据）。
- T05 全量回归、`test-self-pick.mjs`、`test-t05-store.mjs`：未运行（领域逻辑零改动，不重跑他人候选断言，避免拼接不兼容结果）。
- 深浅色/长文本在真实渲染下的目测换行：未运行（只有 WXML/WXSS 静态保证）。

## 八、缺陷/需 P01 处理项

1. **既有测试 3 条旧断言过期（本卡未改测试）**：`tools/miniprogram/test-home-view.mjs` 第 415–417 行仍断言旧“自己选菜缺能力弹层”的 `selfPickOpen/selfPick.missing/selfPick.hint`；本卡按卡片要求改为独立页入口并移除该弹层，导致该 3 条断言失败（第 416 行 TypeError 中止脚本），同文件其余断言全部通过。建议由 S02a 收口为一条导航断言（具体改法见 `02-任务局部检查\03-既有断言影响与建议.md`，本卡未执行）。
2. 默认模拟菜单仅 1 个可售窗口，切窗逻辑改在自定义两窗口菜单下核对；如后续需要默认菜单多窗口场景，需先有对应菜单数据。

## 九、未完成项与依赖

- **营养出口未完成（不是本卡范围）**：`SelfPickView/Preview` 营养仍为 `null`（S02a 临时接续）。正式版需共享 C++ 核心 Offer 级营养只读出口（T04A02→A03，P01 另派）后再做前端接合；本卡未实现、未顺带扩展，也不把本卡页面完成写成营养功能完成。
- 本卡范围内无未完成实现项。

## 十、下一负责人

- P01：核对本反馈 + 证据；决定 `test-home-view` §5 断言由 S02a 收口或另派；确认是否需要开发者工具/真机验收。
- S02a：如 P01 授权，按 `03-既有断言影响与建议.md` 收口 3 条过期断言。
- 正式营养出口：P01 另派 A03/A04 链路，不属本卡。

聊天回复按卡片要求：只回本反馈路径 + 一句状态；停止等待 P01，不自动开始后续任务，不联系其他窗口。
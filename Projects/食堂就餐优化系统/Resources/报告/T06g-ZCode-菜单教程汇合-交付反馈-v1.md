# T06g｜菜单与教程串行汇合｜交付反馈 v1

日期：2026-10-25（Asia/Shanghai）。项目根：`D:\项目\cpp\Projects\食堂就餐优化系统`。
本反馈对应任务卡：`Resources/任务卡/T06g-ZCode-菜单教程串行汇合小卡-20261025-v1.md`（第 1 段），总转交卡 `Resources/任务卡/T06g-T05R01-ZCode-合流到双构建总转交卡-20261025-v1.md`，P01 接收/放行裁定 `Resources/报告/T05M04-T05U10-P01-接收与串行双构建放行-20261025-v1.md`。

## 0. 执行者交接（必须先读，涉及 P01 放行前提）

- 22:06–22:08 之间，本单证据目录已由**另一个窗口（ZCode 桌面端，进程 `ZCode.exe` 运行中）**实际生成：`candidate/`、`build-candidate.mjs`、`manifest-check/`、`test-tutorial-logic.mjs`。该窗口的客户端/服务端模型与档位本窗口**不可核实（未知）**；其后 22:08:46 至 23:19 无任何新写入，也无测试日志与反馈。本反馈只把它按“前序写入产物”核对，不替它宣称模型。
- 23:19 起，按用户当场指令，本 DSH 窗口**接手**完成身份复核、测试、真实微信编译与组合验证并落盘。本窗口实际模型：`deepseek-v4.1-flash-1017`（会话运行时提供），Harness 为 DeepSeek Harness；平台不是 ZCode，也不是 GLM 5.3。
- **因此 P01 的“同一名 GLM5.3 执行员串行完成两段”前提已被打破。** 本单第 1 段门槛在客观证据上全部通过（见 §3–§5），但请 P01 明确追认“窗口更换/中途接手”这一例外，或退回重派；第 2 段已按同一授权继续，并在其反馈中同样登记该事实。

## 1. 前置输入身份（只读核对）

| 项 | 实际值 | 与 P01 预期 |
|---|---|---|
| 生产（起点）manifest | `sha256:a62aced0ee327eb208bfac4528b26f9a745bb8130772cbe9c2c83ba7cce0b357`，75 源/1009489B、45 工具/649308B | 一致 |
| 菜单源候选 | `sha256:2368a950e52c4eab0f35a9bfc5daa451a3792d07e2bacb378300a74437e9160c`，76/1014876B、46/667039B | 与 P01 报告一致 |
| 教程源候选 | `a8b9604f…e0865`（80/1025061B、45/649437B），以 P01 报告登记为准；该副本不含完整 core | 采用 P01 登记，未重算 |
| P01 预期合流身份 | `sha256:910b4470b7e256154f9b5dc588122d4eaa64d94bd4341a1d326b27b8edc97745`，81 源/1030448B、46 工具/667064B | 本单 candidate 实测完全相同 |
| WASM | 111554B / `B0098453B7251C2FF39C65B3DF932E7E15975E4252A036196EBF63638A3DC5DD` | 一致 |
| C++ planner | 172712B / `30F716892350CD5134D07AB30B6AC3C6DBA55BD8BC31E87284DE7DD3C3A63B51` | 一致 |
| native CLI（只读引用生产） | `build/native/mp_cli.exe` 382464B / `2DAE456921AB5E9F414140D26E676EF6A35C3D138C2356AB6E5FF4B3466110BA` | 一致，未从旧镜像继承 |
| 菜单版本 / catalogHash | `west1-canteen-batch1-nutrition35-chuanxiang6-20261024` / `sha256:23c0eda5…ff44ea` | 一致 |

## 2. 合流候选与逐文件身份

- 路径：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T06g-ZCode-菜单教程汇合-证据-v1\candidate`（core/miniprogram/tools 三目录；miniprogram 下 src + README.md + 两个项目配置）。目录内无 P01 清单外源码/工具，未复制生产 Resources。
- 独立复算（本窗口重跑，未信任前序产物）：`01-身份核对\verify-expected.mjs` 对 P01 `expected-merged-manifest.json` 全部 127 条逐文件比对 → **missing 0 / extra 0 / mismatch 0 / ok 127**；core 25 个文件与 a62 基线镜像逐字节一致；`miniprogram/README.md`、`project.config.json`、`project.private.config.json` 与基线一致。
- 工具断言：仅 `tools/miniprogram/test-t05a01a-dp-chain.mjs` 与 `test-t05a01b-bnb-chain.mjs` 各 1 行 `files.length` 76→81（已核 before/after SHA 与 P01 批准值一致，`has76=false`），其余行为断言未改。
- 完整文件表与 manifest：`01-身份核对\candidate-regenerated\{manifest.json,hashes.sha256}`、`01-身份核对\expected-vs-actual.json`；前序窗口产物在 `manifest-check\` 保留未动。
- 处理方式：按卡要求**未删除、未重建**已存在目录；接手后的所有写入只落在本单证据目录与该唯一反馈。

## 3. Node / mock 层结果（全部在本单 candidate 上实跑）

| 项 | 命令（candidate 根下） | 结果 |
|---|---|---|
| 菜单升级 10 项 | `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-t05m04-menu-upgrade.mjs` | **10/10 通过**（`02-测试日志\menu-upgrade.log`） |
| 教程 66 项 | `node --import ./tools/miniprogram/register-ts.mjs ../test-tutorial-logic.mjs` | **PASS 66 / FAIL 0**，退出码 0（`02-测试日志\tutorial-logic.log`） |
| 类型检查 | `node tools/miniprogram/typecheck-src.mjs` | **0 errors / 41 files**，双引擎（微信开发者工具自带 TS 4.1.2、Antigravity 5.9.3） |
| 页面静态检查 | `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/check-pages.mjs` | 全部页面通过（含 tutorial） |
| store 受影响回归 | `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-t05-store.mjs` | **28/28** |
| 默认菜单/首页入口 | `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-t05-menu-default.mjs` | **69 PASS / 0 FAIL** |
| dp 链（含 81 断言、无前端算法重复实现） | `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-t05a01a-dp-chain.mjs` | **13/13** |
| bnb 链（同上） | `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-t05a01b-bnb-chain.mjs` | **10/10** |

- 教程脚本适配：由 T05U10 `06-脚本\test-tutorial-logic.mjs`（13943B / `50395D93…`）复制到本单并**只改 1 行**被测根目录 → 本单 `test-tutorial-logic.mjs`（14008B / `57882706…`），diff 见 `02-测试日志\script-adaptation.diff`；实跑证明读的是本单 candidate，不是旧工作副本。
- 未跑：`test-t05-modules.mjs`——它读 `Resources/契约/T01-v1.2-candidate/nutrition-v1-candidate.json`，本单 candidate 按卡不含 Resources，属**不适用**（不是失败）；如需该覆盖请在带 Resources 的副本上另跑。

## 4. 真实微信编译（独立项目、隔离存储）

- 工具：微信开发者工具（微信库 `WeChatLib: 3.17.4`，wechatide skill 0.3.11），项目路径 = 本单 `candidate\miniprogram`（与生产目录分离，模拟器存储互不影响；全程未读写真实用户数据）。
- `open_project_window --project <candidate\miniprogram>` → `success=true, newopen, winId=s9`；`simulator_open_page --page pages/home/index` → `success=true`；随后各页面 `getData` 均正常返回，控制台无编译错误（`03-组合验证\console-after-open.json`）。
- 说明：该编译/运行证据属于模拟器（开发者工具）层面，**不是真机、也不是正式性能**。

## 5. 组合验证（同一存储内：旧官方菜单 + 已吃日志 + 教程未读）

- 种子（`03-组合验证\make-seed.mjs` → `seed-state.json`）：catalog=T03d 旧官方原件（`west1-canteen-batch1-nutrition4-20261023` / `sha256:020f904d…`），catalogMeta=`imported`；当日已吃日志 `rec-001`（午餐、旧菜单期手动记录）+ 昨日日志 `rec-old-001` + 昨日计划原文 `req-legacy-000`；锁/计划/售罄按旧菜单构造；教程键不存在。种子 sha256 `2da5d4ba…`（29122B）。
- 启动后（实测，`03-组合验证\10-state-after-upgrade.json`）：`catalog=null`、`catalogMeta.source=builtin`、`importedAt/importedFileName=null`；首页标题 `西院西一食堂 · 内置菜单`、banner 为最新版本；旧计划失效（当日 plan=null）、swap 选择锁作废、用户锁/窗口锁保留、售罄按新菜单作用域清理为 1 条；当日/昨日日志与昨日计划原文逐字未动。
- 显示煎饼估算热量（完整模式，自选页早餐窗口）：`山东杂粮煎饼｜估算｜约 470 千卡 · 蛋白 13.9g · 脂肪 16.4g · 碳水 69.2g｜￥5.50`，渲染 WXML 实读（`17-selfpick-pancake-nutrition.png`、`18-pancake-row-wxml.json`）；数值来自核心 `mp_offer_nutrition`，不是前端另算。
- 教程：首页 `.tutorial-tip` 可见 → 点「开始使用」进教程 → 真实点击走完 4 步（1 填档案，定目标 → 2 选一餐，看推荐 → 3 确认吃了，可改可撤 → 4 回看月历，调设置）→ 点「开始使用」完成；`tk.ui.tutorial.v1 = {seenAt: 2026-10-25T15:22:52.714Z, via: 'finish'}`。
- **业务指纹**（定义：`sha256(业务存储 tiankeshike:state:v1 原始文本)`，排除 tk.ui.* 界面键）：
  - 升级后、进教程前：`73C3844C2BE90DB441EC85DE4A9C9DC9B392D9A32C3E9B904679EFC80686A39B`
  - 教程操作后：`73C3844C…A39B`（**完全一致**，教程不改业务数据）
  - 整包重开后：`73C3844C…A39B`（仍一致）
- 重开（`simulator_open_page` 重新编译启动）：`tutorialEntryVisible=false`（教程不再重弹）、`catalog=null`/`builtin`（菜单未退回、未重复升级）、首页标题仍为内置最新菜单；微信库 `3.17.4`。
- 自定义/改价菜单不被覆盖（`03-组合验证\28-custom-menu-after-boot.json`）：种子 catalog 用 T03d 原件内容但 `menuVersion=custom-user-menu-20261025`、煎饼改价 999 分、meta=imported → 重开后 catalog 原样保留（版本/价格/来源均未变），首页 banner 为“当前为导入菜单 custom-user-menu-20261025；历史已吃快照不会因换菜单而改写”。历史日志 `rec-001`/`rec-old-001` 与昨日计划 `req-legacy-000` 仍在。
- 截图：`12-home-after-upgrade.png`、`14-selfpick-breakfast.png`、`17-selfpick-pancake-nutrition.png`、`21-tutorial-step1..4.png`、`24-after-tutorial-finish.png`、`27-home-after-relaunch.png`、`29-custom-menu-home.png`。
- 作废 RUN1：`03-组合验证\00-作废-RUN1-早餐日志致自选页阻塞\`（种子把已吃日志放早餐，自选页按业务规则拦截，无法展示煎饼；升级本身已成功）。不参与最终结论。

## 6. 生产未变证明

- 接手开始时：`01-身份核对\production-before\manifest.json` = `sha256:a62aced0…0b357`（75/1009489B、45/649308B）。
- 全部工作结束后：`01-身份核对\production-after\manifest.json` = **同一** `sha256:a62aced0…0b357`（75/1009489B、45/649308B）。
- 本单 candidate 结束后复算仍为 `sha256:910b4470…c97745`（81/1030448B、46/667064B，WASM 匹配）；生产目录内无 22:10 之后的写入。

## 7. 未测 / 保留限制

- 仅开发者工具模拟器：真机、手机存储容量、真实扫码入口、正式性能（50ms/300ms/768 页目标）本轮均未测，不能由本单结果外推。
- P09 独立总审、最终用户包冻结、推广决定均不在本单范围，也未做。
- 微信编译只证明“能编译并跑通代表组合”，不等同全量 UI 回归；node/mock 的 22 项 store 行为与菜单/教程专项已如上单独列出。
- 前序 ZCode 窗口的实际模型/档位不可核实；本反馈未把请求路由当作实际调用证明。

## 8. 结论

第 1 段硬门槛 1–4 全部满足：candidate 实际 manifest 与 P01 预期**精确一致**（127/127 逐文件）、功能同候选可用且历史不变、组合场景与独立微信项目编译实测通过、教程操作不改变业务指纹。**在 P01 追认“窗口更换/中途接手”例外的条件下**，可按原条件授权进入第 2 段（`T05R01-ZCode-用户开发双构建-v2.md`）；否则本反馈即为第 1 段交付，第 2 段结果请按 P01 裁定处理。

证据目录：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T06g-ZCode-菜单教程汇合-证据-v1\`
（`01-身份核对/`、`02-测试日志/`、`03-组合验证/`、`candidate/`、`build-candidate.mjs`、`test-tutorial-logic.mjs`、`manifest-check/`）
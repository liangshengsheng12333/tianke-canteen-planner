# T08f05 四补丁同候选整合 · 交付反馈（v1）

- 任务卡：`Resources/任务卡/T08f05-DSH-四补丁同候选整合小卡-v1.md`（主 PRD v0.2）
- 执行时间：2026-10-24（Asia/Shanghai）；cwd：`D:\项目\cpp\Projects\食堂就餐优化系统`
- 执行者：DSH（任务卡指定 DSH / DeepSeek V4.1 Flash；本次实际模型自报 `deepseek-v4.1-flash-1017`，服务端子档位未暴露，无法再核实）
- 写入者：仅主执行者 1 人写生产源码；未创建任何写入型子代理
- 唯一反馈：本文件；证据目录：`Resources/报告/T08f05-DSH-四补丁同候选整合-证据-v1/`

## 一、结论

四项隔离补丁已按 f01→f02→f03→f04 合并到**同一个生产候选**，四份补丁在文本层面零冲突；语义组合检查发现并修补了 **1 处四卡独立时都不暴露的缺陷**（换菜选择锁在菜单替换后形成“失效锁无法解除”死局），修补只动 `domain/store.ts` 3 个 hunk 并单列 diff，可独立审阅/回退。任务卡最小验收五项均在本候选上通过（Node 离线 + 微信模拟器），回归与双编译器通过；`test-logs-page` 的 2 项失败为**基线既有**，已用基线对照日志确认。

## 二、候选与身份

| 项 | 值 |
|---|---|
| 写前基线 | `sha256:d15bbe0eb2a73e9eba230c819288e9db180487df4ea1ab7b90516482e290f19e`（75 文件 / 872,829 B，与任务卡一致，未触发 P01 上报） |
| 当前候选 | `sha256:29deba8f66e85207e7d0fdd87cdf18250b6d5acdfb2853ac42d34b3c86a78d8b`（75 文件 / 882,086 B） |
| 新 manifest | `…-证据-v1/work/manifest-merged/manifest.json` + `hashes.sha256`（由 `tools/miniprogram/candidate-manifest.mjs --out` 生成）；交付前重跑同一工具复核 digest 一致：`work/final-manifest-check/` + `logs/final-manifest-check.log` |
| 冻结 WASM | `miniprogram/src/assets/wasm/mp_core.wasm` 107,472 B `B53C7405A643E8409071ED76D3CB4CCBDF1A37E6E5C408CE1D4A373D4CC00744`，`frozenWasmMatches: true`（未改） |
| 行尾 | 4 份改动文件均 LF（0 CRLF，按项目约定；Git 自动 CRLF 已还原） |
| 工具文件 | 38 文件 / 447,791 B（与基线一致） |

## 三、变更清单（相对基线，仅 4 个获批文件）

| 文件 | 基线 | 候选 | 行数变化（基线→候选） |
|---|---|---|---|
| `miniprogram/src/domain/logs.ts` | 18,702 B `954b4931…7d2359` | 19,251 B `255e8039…c8e3` | +15 / −4 |
| `miniprogram/src/domain/plan.ts` | 38,814 B `57d3496e…f4912f29` | 41,123 B `09c800f6…e7c7af` | +73 / −7 |
| `miniprogram/src/domain/store.ts` | 98,424 B `c5d3a051…8ecf5bfb` | 103,608 B `3629cbcd…3a2e29c` | +89 / −18（其中 f05 修补 3 hunk） |
| `miniprogram/src/pages/home/index.ts` | 31,711 B `b4e55e1c…73f2644` | 32,926 B `2e110b87…360e359` | +38 / −2 |

- 总 diff：`patches/T08f05-merged-vs-baseline.patch`（26,487 B，恰好 4 文件，无其他文件）。
- 逐补丁前后差异（逐步 apply 实测哈希）：`logs/step-replay-hashes.log`；摘要表见 `合并与冲突处理记录-v1.md` §2。
- 无关文件、C++ 核心、WASM、正式菜单均未改（manifest 白名单 + 总 diff 文件集双重核对）。

## 四、合并与冲突处理

- 顺序：f01 → f02 → f03 → f04，在基线快照副本上 `git -c core.autocrlf=false apply`；四次 `--check` 与 `apply` 全部 exit 0，无文本冲突（`logs/merge-replay.log`）。
- 四补丁重放结果 vs 合并候选：**仅 `store.ts` 不同**（`logs/merge-replay-vs-merged.log`），差异即 f05 修补；其余 3 文件逐字节相同。
- f05 语义修补（`patches/T08f05-merge-fix-store.patch`，2,655 B / 3 hunk / 只动 `store.ts`）：
  1. `applyMenu` 提交时丢弃 `source:'swap'` 的换菜选择锁（选择锁只约束已作废的旧计划；用户锁定保留）；
  2. `preflightMenu` 的差异视图同样剔除选择锁，使“保留 N 条失效锁定”提示与实际替换一致；
  3. 同步注释。
  复现与验证：修补前 `logs/probe-integrated-stage.log` G5.15 死局；修补后 `logs/f05-integrated.log` G5.14–G5.21 全绿，模拟器 `sim-56…sim-61` 实证“提示保留 1 条 → 替换后确为 1 条用户锁 → 首页可解除 → 无失败 Toast”。
- 若需回退该修补：只回退 `store.ts` 上述 3 hunk 即回到“四补丁精确结果”，但会重新引入组合死局；不影响另外 3 文件。

## 五、四卡复用脚本（加载同一候选，重跑受影响路径）

全部脚本以 `--src` 指向**生产候选** `miniprogram/src`（不叠加单卡补丁），日志在 `logs/`：

| 脚本 | 覆盖 | 结果 |
|---|---|---|
| `scripts/run-f05-integrated.mjs` | G1 f01 / G2 f02 / G3 f03 / G4 f04 / G5 组合，含候选关键文件哈希断言 | **88 项通过 / 0 失败** |
| `scripts/run-f01-merged.mjs` | f01 失效锁定解除（合并后页面哈希断言 + 修复标记） | **38 通过 / 0 失败** |
| `scripts/run-f02-merged.mjs` | f02 连续换菜、锁定/已确认/已结束保护 | **47 通过 / 0 失败** |
| `scripts/run-f02-regression-merged.mjs` | f02 回归（含 R0.x 适配） | **34 通过 / 0 失败** |
| `scripts/run-f03-merged.mjs` | f03 预算口径/超支/部分确认 | **103 项通过 / 0 失败**（写 `logs/f03-test-results.json`） |
| `scripts/run-f04-merged.mjs` | f04 未知营养显示（断言相对基线只 4 文件不同） | **33 项通过 / 0 失败** |

## 六、回归矩阵（全部针对本候选）

| 用例 | 结果 |
|---|---|
| `test-home-view.mjs` | 34 项通过 |
| `test-today-display.mjs` | 46 项通过 |
| `test-month-summary.mjs` | 35 项通过 |
| `test-calendar.mjs` | 41 项通过 |
| `test-t05-store.mjs` | 0 fail |
| `test-t05-soldout-scope.mjs` | 0 fail |
| `run-t05-all.mjs` | 0 fail |
| `typecheck-src`（TS 4.1.2 / 5.9.3 双编译器） | 0 errors / 38 files（两侧均 0） |
| `test-logs-page.mjs` | **2 项失败**：`月汇总只算本月已知花费`、`只有未知价格时写“未知（含未填项）”`；基线对照（临时恢复基线后重跑）同样 2 项失败 → **基线既有，非本次合并引入**（`logs/baseline-test-logs-page.log`） |

汇总日志：`logs/production-tests-summary.log`。

## 七、微信模拟器关键交互预览（本候选，v4 脚本，一次自动化流程）

- 脚本：`scripts/run-simulator-preview-v4.ps1`（PowerShell 5.1 自动化，经 `wechatide` CLI；`simulator_refresh` 重新编译后执行；页面 handler 与 store/WASM 均跑在微信运行时）
- 环境：微信开发者工具 `wechatide-skill 0.3.11`，登录态有效；页面 `pages/home/index`、`pages/menu/index`
- 结果（原始 JSON 在 `sim/`）：
  1. f02 换菜：首页午餐 3 件 → 点“换一份”后替换 1 件，选择锁 `source:'swap'` 出现，用户锁定保留，无失败 Toast，ActionSheet 正常弹出（`sim-52/53`）；再点一次继续换（`sim-54/55`），无失败 Toast。
  2. f01+f05：经菜单页真实入口 `onUseWest1Menu`→`onApplyMenu` 替换菜单，提示“保留 1 条失效锁定”；首页只剩 1 条用户失效锁且 `pageLockIssues` 带 `meal:'lunch'`（f01 修复点），`planState: lock-conflict`（`sim-56…59`）；点解除 → 锁清空、无失败 Toast、`planState: idle`、`canPlan: true`（`sim-60/61`）。
  3. f04：重规划后把未知营养菜“脆皮烤鸭饭”换入午餐，详情页显示“营养未知 / 能量待补全 · 蛋白待补全 · 脂肪待补全 · 碳水待补全”，**未显示 0**（`sim-64/65`，截图 `sim-65-detail-unknown-nutrition.png`）。
  4. f03：全部确认后 `plannedKnownCents=0`、`overBudget=false`、`withinBudgetKnown=true`（“按已知金额在预算内：计划 ￥0.00…”）；把预算改为 2000 分后 `overBudget=true`、`overageCents=950`、剩余 0（`sim-66…69`）。
- 说明：v1–v3 预览脚本有自动化口径问题（v2 的 CSS 选择器点到了“确认吃了”；v3 页面 data 过期挡住换菜），已如实保留在 `sim/superseded-runs/`，判定以 v4 为准。

## 八、验收逐项对照（任务卡最小验收）

| 验收项 | 状态 | 证据 |
|---|---|---|
| 失效锁定可解除 | 通过 | `f05-integrated` G1/G5.20、`f01-merged` 38 项、模拟器 `sim-58…61` |
| 单品/多菜连续换菜且已吃不被改 | 通过 | `f02-merged` 47 项 + `f02-regression` 34 项、模拟器两次换菜；已确认/已结束保护用例 |
| 全部/部分确认预算不重复计价 | 通过 | `f03-merged` 103 项、`f05-integrated` G3、模拟器 `sim-66…69` |
| 未知营养不误显 0、真实零保留 | 通过 | `f04-merged` 33 项、G4/G5、模拟器 `sim-65`（另有真实零值用例在 f04 离线用例内） |
| 复用四卡脚本、在同一正式候选重跑 | 通过 | 见 §5（同一 `--src`，未叠加单卡补丁） |
| ≥1 次微信模拟器关键交互预览 | 通过 | 见 §7（换菜/换菜单/解失效锁/未知营养/预算两态） |
| 失败如实交付、不临时扩大范围 | 遵守 | `test-logs-page` 2 项基线失败如实列出；f03 已知风险未顺手改 |

## 九、未测项与风险

1. **真机未测**：本卡只要求模拟器预览；红米真机定向复测与 P09 独立验收按流程由 P01 排期，本反馈不声称已完成。
2. **模拟器覆盖范围有限**：只走关键交互，未覆盖文件选择导入菜单、备份导出/恢复、跨日/跨月切换、外观设置等；自动化以 `automation_evaluate` 调页面 handler 为主，人工点击只覆盖部分流程。
3. **f03 已知风险（未改）**：`activePlanMeals.length === 0` 的合成分支返回 `plannedTotalCents: null` + `withinBudgetKnownAmounts: false`，本卡未在 UI 路径触发，保持 f03 原样，仅登记。
4. **f05 修补属超出四补丁的行为改动**：虽只动 `store.ts` 3 hunk 且组合路径已验证，仍需 P01 明确接受；不接受可按 §4 回退。
5. **模型子档位**：任务卡指定 DeepSeek V4.1 Flash，实际自报 `deepseek-v4.1-flash-1017`，服务端未暴露子档位，无法完全核实。

## 十、证据索引

- 说明与目录：`…-证据-v1/README.md`
- 合并与冲突处理：`…-证据-v1/合并与冲突处理记录-v1.md`
- 新 manifest：`…-证据-v1/work/manifest-merged/`
- 总 diff / f05 diff：`…-证据-v1/patches/T08f05-merged-vs-baseline.patch`、`patches/T08f05-merge-fix-store.patch`
- 四文件只读副本 + 哈希：`…-证据-v1/merged-files/`
- 原始日志：`…-证据-v1/logs/`（合并重放、逐步哈希、变更清单、生产全量复跑、基线对照）
- 脚本：`…-证据-v1/scripts/`（`run-f05-integrated.mjs`、`run-f0x-merged.mjs`、`run-all-production-tests.ps1`、`run-simulator-preview-v4.ps1`）
- 模拟器：`…-证据-v1/sim/`（`sim-50…sim-69` 为最终证据，`superseded-runs/` 为过程版本）

## 十一、交接

P02 请查收本反馈与证据目录；P01 接收后才进入红米定向复测 / T09。本消息只回路径与一句状态。
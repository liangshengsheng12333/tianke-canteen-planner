# T05M04｜旧官方菜单更新｜交付反馈 v1

2026-10-25。执行方：ZCode（客户端 ZCode，模型 GLM-5.3；服务端档位不可核实，记未知）。单人执行，未派子代理。

## 1 基线与前后身份

- 基线：从 `Resources/报告/T08N-ZCode-最终收尾归集-证据-v1/integrated-candidate/` 复制独立副本；建副本时生产（项目根）与副本各自实跑 `candidate-manifest.mjs`，均为 `a62aced0ee327eb208bfac4528b26f9a745bb8130772cbe9c2c83ba7cce0b357`（75 源/1009489B、45 工具/649308B、frozenWasmMatches=true），另核生产=a62。
- 候选最终：`sha256:2368a950e52c4eab0f35a9bfc5daa451a3792d07e2bacb378300a74437e9160c`（76 源/1014876B、46 工具/667039B、frozenWasmMatches=true）。WASM 未动（111554B/`B0098453…3DC5DD`，A18 冻结身份）；菜单数据 `west1-menu.ts` 未动（62 报价/6 窗/91 菜）。
- 明细见 `T05M04-ZCode-旧官方菜单更新-证据-v1/manifest-baseline-and-final.json`；生产未改，未推广。

## 2 最小 diff / 文件清单

源码（2 文件）：
- `miniprogram/src/domain/store.ts`（`a4e9e670…805aa`→`121ebd60…f5565`）：init() 末尾挂接一次性升级；新增私有 `upgradeLegacyOfficialMenu()`；2 个 import。完整 diff 见 `证据-v1/identity/store.ts.diff`（+54 行含注释）。
- `miniprogram/src/domain/menu-upgrade.ts`（新增，`0b8a5f25…25ee`）：旧官方菜单精确身份白名单与判定——menuVersion、canteenId、canonicalSha256（排除 catalogHash 自身重算，与核心一致口径）三重一致才命中；白名单=本地官方原件 T03b-v1（`west1-canteen-batch1-20261022`/`1e6b7fd1…`）与 T03d-v1（`west1-canteen-batch1-nutrition4-20261023`/`020f904d…`），原件文件级 SHA/字节数与复算记录见 `证据-v1/identity/legacy-menu-identity.json`（三项自检全真）。

工具（非运行时）：
- 新增 `tools/miniprogram/test-t05m04-menu-upgrade.mjs`（专项 10 项）。
- `test-t05a01a-dp-chain.mjs`/`test-t05a01b-bnb-chain.mjs`：源码文件数断言 75→76（本卡授权新增 menu-upgrade.ts；「前端无核心算法符号」断言原样保留并通过）。

行为设计：命中白名单→回到"新装"形态（catalog=null 由 `catalog()` 回退包内最新版、catalogMeta 复位 builtin），后续包内菜单更新无需再迁移、升级天然只发生一次；只清当日旧计划（旧推荐失效），用户锁/窗口锁保留待用户按现有规则处理，swap 选择锁随旧计划作废，售罄按 `prepareCatalogReplacement` 既有作用域清理；历史日期桶/日志/快照零回写；写盘走既有 `commit()`（校验→原子写→失败保留原状，无半更新，失败下次启动重试）；正常升级在 init 返回消息与首页「最近操作」各一句普通提示。自定义/改价/同名同版本但内容不同/归属不符/hash 缺失或不符→一律不识别、零写入。未做通用迁移框架；后续新官方旧版本须先有本地原件再登记。

## 3 验证与原始证据（全部在隔离副本+隔离存储）

Node（真实 WASM+mock wx，`证据-v1/node-verification-summary.json`）：类型检查 TS4.1.2/5.9.3 双 0 错（39 文件）；专项 10/10（新装默认、T03d 升级全项、煎饼热量、重开不退不重复、自定义不覆盖、三种身份不符不升级、T03b 白名单、保存失败无半提交且存储逐字节不变+恢复后重试成功、历史桶逐项不变）；全回归绿（run-t05-all 4/4、t06c 109/109、dp/bnb 链 13/13+10/10、self-pick/calendar/month-summary/home-view/today-display/appearance/logs-meal-tabs/home-compact/home-swap-sheet/integration 全过）。

微信开发者工具模拟器（真实微信宿主，`证据-v1/simulator/summary.md`+`steps/`46 步原始 JSON 全 ok）：新装直接最新版；T03d 原件 base64 精确重建入存储（hash 读回一致）；`simulator_refresh` 应用级冷启动后 catalog=null/builtin/62 报价、旧计划失效、锁与售罄处理同 Node；煎饼 470 kcal estimated=true（核心唯一营养源）；再次冷启动不退不重复；手动 init() 捕获提示原文「已将旧官方菜单（…nutrition4-20261023）更新为最新内置菜单（…chuanxiang6-20261024）」；截图 2 张（升级后/重开后首页）。

范围边界：模拟器非真机；`close_project_window` 会清模拟器存储（踩坑记录于 gen-steps.mjs 头部，重启用 `simulator_refresh` 替代）；s2-02 提示文本在控制台捕获时有 GBK 二次解码乱码形，版本串完整可核。

## 4 复现衔接

P01 `T08O-P01-热量显示排查-20261025-v1/legacy-menu-reproduction.json` 的旧官方菜单（menuVersion 同 T03d、35 报价 31 未知、煎饼 null）即本卡白名单身份：本卡在 Node 与模拟器均以 T03d 原件精确复现该状态并验证升级后 62 报价全有热量（煎饼 470 kcal）。未重跑手机端操作。

## 5 未测项与说明

- 红米真机/其他基础库/正式性能：未测（50ms/300ms/768 页目标不变，与 A10 一并后置）。
- 负面分支（自定义改价/身份不符/保存失败注入）仅 Node 覆盖；微信宿主无法真实注入存储故障，模拟器只跑主正向+重启路径。
- 历史日志/快照零回写、fresh-self-pick 场景：Node 覆盖，模拟器未重复。
- 本卡不做构建区分（待用户确认 PRDv2 选项）、不改 home/profile/app.json/教程文件（DSH 并行中）、不改核心/WASM/菜单数据/生产/旧证据/MEMORY/契约。交回后与 T05U10 由单一汇合者合并。
- 附注：清理了 `Resources/报告/.toolchain/`（测试工具的临时输出目录，含本卡运行残留及 1 份今晨更早任务的同类残留 `verify-t05-integration-2026-10-25T04-42-25-402Z.json`；非登记证据，如需可从各任务证据目录复算）。

## 6 结论

任务卡「目标与最小实现」三条与「验证与输出」全项完成于隔离副本：新用户即最新版；持久化旧官方西一菜单（T03d 本次复现版 + T03b，均以本地原件精确白名单）一次性升级、提示一句、重开不退；自定义/未知身份不动、历史零回写、失效锁定与售罄按既有机制处理、无半提交；营养仍唯一来自核心。状态：**隔离候选已交付，待 P01 核后与 T05U10 单人汇合**。

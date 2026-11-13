# T08H02 · ZCode GLM · 整月记录保留修复 · 交付反馈 v1

| 项 | 内容 |
|---|---|
| 主任务卡 | `Resources/任务卡/T08H02-ZCode-整月记录保留修复小卡-v1.md`（总转交卡固定约束：U09 `sha256:7f6a6ea5…`、隔离副本、只写本证据目录+唯一反馈） |
| 执行 | T08H02 子代理（独立窗口），在隔离 candidate 副本上打 H02 补丁 + 针对性回归；未写生产、未改其他副本、未改 G03 原证据、未跑 DP/性能 |
| 指定模型 | 任务卡请求 GLM 5.3 |
| 实际可见模型/档位 | 客户端标识 `account:zai-start-plan/GLM-5.3-Flash`；**服务端实际路由/档位未知**，未写成证明 |
| 聊天 cwd / 项目根 | `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告` / `D:\项目\cpp\Projects\食堂就餐优化系统` |
| 证据目录 | `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T08H02-ZCode-整月保留-证据-v1\` |
| 状态 | **完成**：补丁+注释已落、44/44 断言通过（r1 15 + r2 12 + r3 17）；未复现任何 H02 新缺陷；微信开发者工具/真机未测 |

---

## 1. 接续此前中断进度的核实（如实记录）

本证据目录 `candidate/ logs/ patch/ tests/` 由前一次被中断的运行留下。接续时逐项核实：

**身份核验（有效部分，已接续）**
- 生产工作树当日复算：`sourceTreeDigest = sha256:7f6a6ea5071626afeb817592f5ad10f105481a2fbefdfee0b8c4b98626aeba42`（miniprogram/src 75 文件 / 996165 B，冻结 WASM matches=true）——**生产=固定 U09，未漂移**。
- candidate 工作树逐文件与生产比对（`logs/identity-diff.mjs`）：**仅 `miniprogram/src/domain/app-state.ts` 1 个文件不同（即 H02 补丁），tools 45 文件全部一致**——中断运行留下的工作树内容有效，未重做。
- 已完成的 `tests/t08h02-helpers.mjs`、`r1`、`r2` 脚本内容有效，直接复用（r2 两处预期笔误已修正，见 §4）。
- `logs/`、`patch/` 当时为空（中断点在补丁已改、证据未落盘处）。

**身份不符部分（按任务卡授权重建，原因如下）**
- 旧 baseline 提交 `fdfa8ee`（消息 "baseline e45d74024c…"）的树**不是 U09**：与生产/U09 差 11 个 `miniprogram/src` UI 文件 + 3 个 tools 文件，且与本机任何现存候选副本（G03/G01/G02/T05U09/T05U09a，均为 7f6a6ea5 口径）都不一致，来源无法确定。判定为中断运行的无效基线快照。
- 处置：以现场复算=U09 的内容重建 baseline 提交 `ec08da8`（树摘要复算一致后提交），再提交 H02 补丁 `cf7f015`；旧提交保留在 git 历史中备查。全过程只发生在本证据目录 candidate 内。详见 `logs/identity-check.json`。

## 2. 真实输入与补丁内容

- 基线：固定 U09 candidate（工作树逐文件核验=生产=U09；重建后的 baseline 提交 `ec08da8` 树摘要=7f6a6ea5，75 文件/996165 B）。
- 补丁（相对 7f6a6ea5，`patch/t08h02-max-kept-days-14-to-62.patch`，唯一差异文件 `miniprogram/src/domain/app-state.ts`，4+/2-）：
  - `MAX_KEPT_DAYS` **14 → 62**：至少容纳当前自然月＋前一个完整自然月（两月最多 31+31=62 天），月历回看与"本月已记 N 天"月汇总在整月范围成立。
  - 同步注释：保留范围口径、按业务日期字符串排序收口不变、**KEEP_PLAN_RAW_DAYS=3 仍单独控制 plan.rawText**（原始计划大响应回收与整月保留不混为一谈）。
  - **不改**收口机制本身（`ensureDay` 按日期字典序删最旧桶）、不改 state 版本（schemaVersion 仍 1）、不新增数据库/云同步/归档、不清空现有数据。
- 全库检索确认：`MAX_KEPT_DAYS` 无其他引用点，源码无"最近 14 天"类展示文案需要同步，tools 无旧 14 天断言需要改。
- 补丁后 candidate 终态摘要：`sha256:af92b59f942a25b0113c41441bdbfceaa1aaffd7be6f301f6d3b562217538400`（75 文件/996407 B，与 U09 差 242 字节=仅 app-state.ts），`logs/manifest-final/`。

## 3. 针对性回归与结果（44/44 通过）

环境：Node v24.19.0 + mock wx（Map 存储替身）+ 真实冻结 WASM（AppStore instantiate）；命令 `cd <证据目录>/tests && node --import ../candidate/tools/miniprogram/register-ts.mjs r<N>-….mjs`；原始逐条结果在 `logs/r1…r3.json`。

### R1 `r1-full-month-retention.mjs`（15/15）— 整月/跨月界/收口/修改撤销
| 组 | 场景 | 结果 |
|---|---|---|
| A | 连续 31 天整月（2026-03）：31 桶全保留（旧 14 天版只剩 14）；月汇总 dayCount=31 与逐日 summarizeActiveLogs 独立重算一致；覆盖 03-01…03-31 | 全过 |
| B | 31+31 双月（07-01…08-31 恰 62 桶）：不触发收口；两月各自全量一致 | 全过 |
| C | 92 天超限（07-01…09-30）：按既有日期顺序收口到 62 桶（留 07-31…09-30）；9/8 月仍全量、7 月如实只剩 07-31（不虚构更早历史） | 全过 |
| D | 当天修改/撤销：supersede/revoked 留痕、不重复计入；月汇总 31→30 天与重算一致 | 全过 |

### R2 `r2-feb-sparse-planraw.mjs`（12/12）— 2月/闰年/稀疏/planRaw
| 组 | 场景 | 结果 |
|---|---|---|
| E | 平年 2 月跨月（01-25…03-03 共 38 天）：全保留，2 月汇总=28 天全量 | 全过 |
| F | 闰年 2 月跨月（2028-01-25…03-03 共 39 天）：全保留，2 月=29 天 | 全过 |
| G | 稀疏日期（09-01…10-31 每 3 天+每月 1 号）：只建 21 个有记录桶，全保留，两月汇总一致 | 全过 |
| H | KEEP_PLAN_RAW_DAYS=3 不变：≤72h 的 plan.rawText 保留（10-18 恰在边界上不清）、>72h 清空原文但**日期桶与日志保留**（不是删桶）；桶数远小于 62 不触发收口 | 全过 |

### R3 `r3-backup-oldstate.mjs`（17/17）— 本次补齐（中断运行未覆盖的两块）
| 组 | 场景 | 结果 |
|---|---|---|
| I | 40 天连续 state（>14、<62）备份闭环：导出文本含最旧 09-20 与月初 10-01（**导出不截成 14 天**）、预检 digest 一致、恢复后 40 桶逐字节等于导出时、9 月 11 天+10 月 29 天汇总一致、杀进程重开仍 40 桶 | 全过 |
| J | 旧版（14 天时代）state 原样加载：schemaVersion 仍 1、14 桶与写入逐字节一致（记录/修订快照/用户锁 windowLocks/itemLocks 不被新版本改写）；**同日 ensureDay 零收口零改写** | 全过 |
| K | 旧备份按既有正常恢复流程回看：预检通过、14 个旧桶全部回来+今天补空桶（不截断不虚构）、10-15 记录可回看 | 全过 |
| L | 超限收口只删最旧桶：69+1 桶跨日收口到 62，保留桶上的用户锁与 superseded/active 修订快照逐字节不变 | 全过 |

## 4. 与 G03 旧断言的关系（按任务卡要求说明为何改变）

- G03 s5 O1–O3 断言"连续 24 天后只剩最近 14 桶、月汇总只覆盖 14 天窗口"——这是旧 `MAX_KEPT_DAYS=14` 的**真实口径边界**，不是测试错误。本版需求（用户已确认的当月饮食回看/月历与月汇总）要求整月可看，故 O 组口径改为 62 桶（r1 A–C 组：62 ≥ 任一自然月全量），不强行保留旧 14 天断言。
- G03 其余场景（月历渲染、修订链、备份原子性、跨日恢复 N 组）语义均不依赖 14 天上限，r3 I/J/K 组按同口径复核通过，未复用旧脚本文件（复用其环境形态与 helper 思路，落盘到本证据目录）。

## 5. 如实说明（未做/边界）

- **编译口径**：本机无独立 tsc/微信开发者工具 CLI。被改文件经由 Node 24 类型擦除加载在 3 个回归脚本中真实执行（等价于通过项目现有编译路径），微信开发者工具编译与真机未测。
- **存储体积**：62 桶上限会增大单键状态体积（r3 I 场景 40 天状态已验证可正常序列化/恢复）；本次未做存储容量压力测试（任务卡不要求性能/DP）。
- 3 个月以上前的历史依旧按既有机制收口删除，不虚构、不新增归档框架（任务卡明确不要求）。
- r2 修正记录：接续复跑时发现中断运行留下的 H2/H3 预期与机制语义不符（ensureDay 时刻取 10-21 而"3 天"边界按 10-20 计算；且漏数 createInitialState 的 10-20 初始桶）。修正为机制真实语义（≤72h 保留、>72h 清原文不删桶、桶数 7）后通过；这是**测试预期笔误修正，不是产品行为变更**，planRaw 机制代码本身未被 H02 触碰。

## 6. 交付物清单

| 项 | 路径（相对证据目录 `Resources/报告/T08H02-ZCode-整月保留-证据-v1/`） |
|---|---|
| 隔离 candidate（git：ec08da8=U09 基线 → cf7f015=H02 补丁；旧无效提交 fdfa8ee 留史备查） | `candidate/` |
| 补丁（相对 U09 7f6a6ea5） | `patch/t08h02-max-kept-days-14-to-62.patch` |
| 回归脚本 | `tests/t08h02-helpers.mjs`、`r1-full-month-retention.mjs`、`r2-feb-sparse-planraw.mjs`、`r3-backup-oldstate.mjs` |
| 原始结果 | `logs/r1-full-month-retention.json`（15/15）、`logs/r2-feb-sparse-planraw.json`（12/12）、`logs/r3-backup-oldstate.json`（17/17） |
| 身份证据 | `logs/identity-check.json`、`logs/identity-diff.mjs`、`logs/manifest-final/{manifest.json,hashes.sha256}` |

完成停写，交 P01 整合。

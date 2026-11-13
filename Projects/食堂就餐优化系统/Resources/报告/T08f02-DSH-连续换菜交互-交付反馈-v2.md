# T08f02 DSH 交付反馈 v2 — 连续换菜被锁定拦截（DEFECT-T08A1-02）

> 范围声明：本卡只做**隔离补丁 + 隔离复现/回归证据**，不做生产修复、不改生产源码、不动 WASM/菜单；
> 生产集成由 f05 负责。文末结论明确写“候选已隔离验证”，**不是**“生产已修复”。

## 1. 任务卡、基线与工作目录

| 项 | 值 |
|---|---|
| 任务卡 | `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\任务卡\T08f02-DSH-连续换菜隔离并行小卡-v2.md`（v2） |
| 主 PRD | 主 PRD v0.2（按任务卡引用范围执行；本卡未改 PRD） |
| 绝对 cwd | `D:\项目\cpp`；项目根 `D:\项目\cpp\Projects\食堂就餐优化系统` |
| 生产基线树 | `miniprogram\src`：`sourceTreeDigest = sha256:d15bbe0eb2a73e9eba230c819288e9db180487df4ea1ab7b90516482e290f19e`，75 文件 / 872829 B |
| 冻结 WASM | `miniprogram\src\assets\wasm\mp_core.wasm`，107472 B，SHA-256 `B53C7405A643E8409071ED76D3CB4CCBDF1A37E6E5C408CE1D4A373D4CC00744`（未重建、未替换） |
| 候选树 | `sourceTreeDigest = sha256:8af0f3f0e0b7f65a131313cefbb31db45a037810e320b655ec310f3968bdb9a5`，75 文件 / 877397 B |
| 改动文件 | 只有 2 个：`domain/store.ts`（+3777 B）、`pages/home/index.ts`（+791 B），见 `changed-files.txt` |
| 证据时间 | 2026-10-23（Asia/Shanghai） |

## 2. 模型与可核实身份

- 派单请求模型：**DeepSeek V4.1 Flash**。
- 可核实的实际模型标识（DSH 客户端自报）：`deepseek-v4.1-flash-1017`。
- 服务端实际模型/档位：**未知**（执行侧没有服务端凭证，未编造；如需核实请 P01 从平台侧查）。
- 运行环境：Windows NT 10.0.26300.0（AMD64）、PowerShell 5.1.26100.9711、Node v24.19.0、Git 2.56.0.windows.2，详见 `logs\identity.log`。

## 3. 交付文件（绝对路径）

| 文件 | 说明 |
|---|---|
| `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T08f02-DSH-连续换菜交互-交付反馈-v2.md` | 本反馈 |
| `…\Resources\报告\T08f02-DSH-连续换菜交互-证据-v2\patch.diff` | 统一补丁（12023 B，末尾有恰为 `--` 的签名行；只改 2 个文件，git apply --check/apply 均 exit 0） |
| `…\T08f02-DSH-连续换菜交互-证据-v2\changed-files.txt` | 改动文件 before/after SHA-256 与字节数、两棵树 digest |
| `…\T08f02-DSH-连续换菜交互-证据-v2\logs\run-before.log` | 纯基线复现：**22 PASS / 25 FAIL，exit 1** |
| `…\…\logs\run-after.log` | 候选验收：**47 PASS / 0 FAIL，exit 0** |
| `…\…\logs\run-regression.log` | 候选回归：**34 PASS / 0 FAIL，exit 0** |
| `…\…\logs\patch-verify.log` | git apply 正向/反向验证（%TEMP% 隔离副本） |
| `…\…\logs\production-digest.log` | 生产源码/WASM 未被修改的身份证据 |
| `…\…\logs\identity.log` | 环境、模型自报值、测试方式与边界 |
| `…\…\run-harness.mjs` | 自物化测试宿主（复制生产 src + 应用 patch.diff + 计算 digest + 清理） |
| `…\…\run-f02.mjs` | 缺陷复现/修复验收脚本（S0–S6） |
| `…\…\run-regression.mjs` | 既有行为回归脚本（R0–R7） |
| `…\…\candidate\README.md` | 候选完整树重建方式（= 生产基线 src + `patch.diff`） |

候选完整树的落地事实（不说成“已落整树”）：
**证据目录没有存放 75 文件整树，也没有复制 107472 B 的 WASM**；证据目录只存改动文件清单与 `patch.diff`。
整树只存在于每次运行时的 `%TEMP%` 隔离目录（进程退出即删）。重建方法见第 6 节，`candidate\README.md` 有同样说明。
另：`probe.txt`、`tmp-newline-probe.txt`、`candidate\miniprogram\src\.mkdir-probe` 是写入通道探针残留（证据目录 ACL 不允许 shell 写/删，只能 write），不属于交付内容，已在文件内注明。

## 4. 逐项结果（before → after）

判定口径：`run-f02.mjs` 在 `%TEMP%` 隔离树上跑，页面事件走真实页面模块（mock wx 的存储/Toast/ActionSheet），核心用真实冻结 WASM。
before = 纯基线（缺陷态），after = 基线 + `patch.diff`（候选态）。

| 场景 | 验收点 | before | after |
|---|---|---|---|
| S1 单品餐次连续换菜 | 第二次点“换一份”仍可选择 | **FAIL**：Toast「没有可替换的菜品（锁定项不能直接换）」，0 个 ActionSheet，存储零写入 | **PASS**：弹出替代 ActionSheet，换到 `offer-rice-half`，存储 `itemLocks:[{offerId, quantity:1, source:"swap"}]` |
| S1 | 换菜后视图不显示“已锁定” | **FAIL**：`locked:[true]`（换菜锁被画成用户锁） | **PASS**：`locked:[false]`，视图只认用户显式锁 |
| S1 | 最新主动选择保留 | **FAIL**：停留在上次换入的菜（无法再选） | **PASS**：init `offer-chicken` → 第一次 `offer-rice-full` → 第二次 `offer-rice-half`（最新选择） |
| S2 同窗多菜连续换 | 多菜换菜后仍可继续换 | **FAIL**：整餐 3 道全被写成用户锁、全显示“已锁定”，第二次直接 Toast 拦截 | **PASS**：2 个 ActionSheet 正常、3 道菜、锁定全为 `source:"swap"`、视图无“已锁定” |
| S3 显式锁定保护 | 用户手动锁定的菜不能被换掉 | **FAIL**：store 层换锁定项仍返回 `ok:true`（页面只挡住一处，store 可绕过） | **PASS**：store 返回 `ok:false`「该菜品已手动锁定，不能直接换掉；请先解除菜品锁定」；存储与计划未变 |
| S3 | 换菜后用户锁仍保留、只有它显示“已锁定” | **FAIL**：换菜后 3 道全 `locked:true` | **PASS**：用户锁保留（无 source），换入的菜为 swap 锁，`locked:[false,true,false]` |
| S4 已确认餐次 | 页面拦截 + store 拒绝 | **FAIL**：页面直接弹 ActionSheet；store 拒绝理由不对（“没有可替换的推荐”） | **PASS**：页面 Toast「该餐已确认，如需调整请到记录页改记或撤销」，不弹面板；store 返回「该餐已确认并计入实际消费，不能直接换菜；如需修改请到记录页改记或撤销」，存储/日志不变 |
| S4 已结束餐次 | 同上 | **FAIL**：页面弹 ActionSheet；store 拒绝理由不对 | **PASS**：页面 Toast「该餐已结束，如需换菜请先重开餐次」；store 返回「该餐已结束，不能换菜；如需调整请先重开餐次」，存储/日志不变 |
| S5 杀进程重开 | 重启后仍可连续换 | **FAIL**：重启后 `locked:[true]`，再点“换一份”被拦截 | **PASS**：选择锁随持久化文本恢复（`source:"swap"`），视图未锁，仍可继续换到 `offer-rice-half` |
| S6 换菜后点“锁定” | 选择锁转用户锁，而不是被当成解锁 | **FAIL**：点“锁定”把锁删了（`itemLocks:[]`、视图未锁），语义反转 | **PASS**：转成用户锁（`itemLocks:[{…,source:"user"}]`），再点解除后无残留，仍可继续换 |
| R1 核心契约 | 换菜后 `PlanRequest.state.itemLocks` 只含 `{meal,offerId,quantity}` | —（基线同样满足） | **PASS**：source 字段发送前剥离；核心正常接受，连续换菜可重算 |
| R2 显式锁定+换菜 | 用户锁在换菜后保留、仍不可换 | — | **PASS**（5 项） |
| R3 备份导出/恢复 | swap 选择锁随备份往返 | — | **PASS**（8 项：导出含 swap 锁、恢复后仍可换、视图不误标） |
| R4 旧数据兼容 | 无 source 的历史锁定按用户锁处理 | — | **PASS**（3 项：仍显示已锁定、不能被换菜绕过） |
| R5 撤销确认后 | 重新获得换菜能力（不过度拦截） | — | **PASS**（5 项） |
| R6 开发页 lockCount | 锁定诊断口径不变 | — | **PASS** |
| R7 换菜后锁定 | 选择锁→用户锁→解除无残留 | — | **PASS**（4 项） |

汇总：**before 22 PASS / 25 FAIL（exit 1）；after 47 PASS / 0 FAIL（exit 0）；regression 34 PASS / 0 FAIL（exit 0）**。
辅助回归（临时区候选副本，非自物化，仅作旁证）：`test-t05-store` 28/0、`test-t05-soldout-scope` 11/0、`test-home-view` 34/0。
无 FAIL 项、无未测项被算作通过；未测项见第 7 节。

## 5. 锁定来源与最终交互规则

- 新增内部标记：`interface SwapSelectionLock extends ItemLock { source: 'swap' }`，`isSwapSelectionLock()` 判定。
- 换菜写入的是**选择锁** `{meal, offerId, quantity:1, source:'swap'}`：只约束本次核心重算，不是用户锁定。
- **不进核心契约**：`refreshPlan()` 组装 `PlanRequest` 前把 `state.itemLocks` 映射成 `{meal, offerId, quantity}`（剥离 source）。
- **视图不误标**：`getHomeView()` 用 `viewDay = {...day, itemLocks: day.itemLocks.filter(l => !isSwapSelectionLock(l))}` 喂 `interpretPlanResult`，所以“已锁定”标签只代表用户显式锁定。
- **显式锁定不可被绕过**：`swapOffer()` 若 removeOfferId 命中用户锁 → 拒绝「该菜品已手动锁定…」；跨窗整餐换窗若有用户锁 → 拒绝「该餐有手动锁定的菜品，不能整餐换窗口…」；换菜 commit 保留用户锁（`keptExplicit`），只替换该餐的选择锁。
- **已确认/已结束不可被静默替换**：store 在换菜入口先查 `active` 日志与 `isMealEnded()` 拒绝；页面 `swapBlockedHint(mealView)` 在打开 ActionSheet 之前 Toast，两侧文案见第 4 节。
- **锁定按钮语义**：`toggleItemLock()` 查找 existing 时排除 swap 锁；点“锁定”把 swap 锁转成用户锁（先过滤该菜 swap 锁再写入 user 锁），点“解除”只解除用户锁。
- **旧数据兼容**：没有 `source` 的历史锁定一律按 user 处理（不静默解锁、不可被换菜绕过）。
- **最新选择保留**：同窗换菜按“整餐 offerId 子集”重算，第二次换菜覆盖上一次的 swap 选择锁，不回到旧菜。

## 6. 证据性质与候选重建方式（必须与事实一致）

- 证据是 **Node 24 离线测试**：mock wx（存储 Map、Toast/ActionSheet 记录器）+ 真实页面模块 + 真实冻结 WASM（`WebAssembly.instantiate`）。
- **未在微信开发者工具模拟器/真机验证**（本卡明确不碰模拟器，避免与同期 T08c1 巡检抢用）。无截图。
- **生产源码未修改**：`miniprogram\src` 仍是 `sha256:d15bbe0e…f19e`（75 文件 / 872829 B），WASM 冻结身份不变，见 `logs\production-digest.log`。
- 候选完整树重建方式：**生产基线 `miniprogram/src` + `patch.diff`**。可复跑命令（项目根执行）：

```
node --import ./tools/miniprogram/register-ts.mjs "./Resources/报告/T08f02-DSH-连续换菜交互-证据-v2/run-f02.mjs" before
node --import ./tools/miniprogram/register-ts.mjs "./Resources/报告/T08f02-DSH-连续换菜交互-证据-v2/run-f02.mjs" after
node --import ./tools/miniprogram/register-ts.mjs "./Resources/报告/T08f02-DSH-连续换菜交互-证据-v2/run-regression.mjs" regression
```

`run-harness.mjs` 每次运行：复制生产 `src` 到 `%TEMP%\T08f02-DSH-连续换菜交互-证据-v2-selfmat\run-*\miniprogram\src` → 应用证据目录 `patch.diff`（纯 JS 应用器，位置式匹配，不调 git）→ 计算 digest 并核对期望值 → 跑完删树。**不依赖 %TEMP% 残留**，也不依赖任何临时区脚本。
期望：before 打印 `sha256:d15bbe0e…f19e`（22/25），after/regression 打印 `sha256:8af0f3f0…b9a5`（47/0、34/0）。

## 7. 已知限制、未完成项、阻塞与 f05 合并提示

限制/未完成（不影响“隔离补丁+证据”结论，但不能当作生产验收）：
1. 未在模拟器/真机验证（交互手感、真实 ActionSheet 取消、Toast 时长、WXML 渲染未覆盖；本卡未改 wxml/wxss）。
2. 未测：跨日切换、菜单导入后锁定清理、备份跨版本恢复（只测同版本）、并发/存储配额、多端同步、性能。
3. 测试固定画像与时钟 fixture（2026-10-23 12:00，maxItemsPerMeal=1 或 3），未穷举全菜单组合。
4. `candidate/` 未落改动文件实体：`store.ts` 约 100 KB，证据目录只能用 write 工具（读工具单页会截断、shell 复制被 ACL 拒绝），无法内联；已在 `candidate\README.md` 写明重建方式与实体放置位置，`run-harness.mjs` 支持叠加实体并校验逐字节一致（S0.8/R0.5）。
5. 证据目录文本文件末尾无换行（write 通道裁剪）已用 `--` 签名行解决：`patch.diff` 末尾恰为 `--`，git apply 忽略其后内容，**可直接 `git apply`，无需手工补换行**；对证据目录原文件 `--check/apply/reverse --check` 全部 exit 0（见 `logs/patch-verify.log`），自物化 after/regression 复跑仍 47/0、34/0。
6. `probe.txt`、`tmp-newline-probe.txt`、`candidate\…\.mkdir-probe` 是沙箱写通道探针残留，删除需要 ACL 权限（未改 ACL），已注明可忽略。
7. 三个日志的正文逐行一致，仅首尾各 1 个空行被 write 通道裁掉（不影响内容判断）。

阻塞：无。证据目录写权限受限已按“不修改 ACL”的要求绕过（只走 write 工具）。

f05 合并提示：
- 改 2 文件：`miniprogram\src\domain\store.ts`、`miniprogram\src\pages\home\index.ts`。与 **f01（首页）存在冲突点**：`pages/home/index.ts` 新增 `swapBlockedHint()` 并在 `onSwapMeal/onSwapItem` 前置拦截；若 f01 也改首页，建议先合 f01 再合本 patch，冲突时保留 f01 的页面结构、只并入本卡的防护调用与文案；`store.ts` 若 f01 未改可直接 `git apply`。
- 应用顺序：直接 `git -c core.autocrlf=false apply --check`（`patch.diff` 末尾 `--` 签名行已解决换行问题，无需预处理）→ `apply` → 两个文件哈希应为 `6480a851…e12676` / `0aa4acec…04e44`（见 `changed-files.txt`）。
- 合并后**必须重跑**：`run-f02 after`（期望 47/0）、`run-regression`（期望 34/0）、既有 `test-t05-store`/`test-t05-soldout-scope`/`test-home-view`；并补模拟器/真机验证。
- 注意：`run-harness.mjs` 以“生产 src 仍是基线”为前提自物化。f05 把补丁合进生产后，生产 src 已含修复，digest 不再等于 `8af0f3f0…`（这是预期）；此时应改为直接对生产树跑页面/store 测试，或先用基线快照 + patch 复核一次再合并。
- 本卡证据不可直接当作“生产已修复”证明；需 f05 集成 + 独立验收（P09）后再冻结。

## 8. 结论

- **已达成**：“隔离补丁 + 隔离复现/回归证据”标准——同一缺陷在纯基线上可复现（22 PASS/25 FAIL），叠加 `patch.diff` 后验收全过（47/0），既有行为回归全过（34/0），生产源码/WASM 身份未变（digest 证据），候选树可由“生产基线 src + patch.diff”确定性重建并核对 digest。
- **未达成/未宣称**：这不是“生产已修复”。生产 `miniprogram/src` 未被本卡修改；真实微信运行时（模拟器/真机）未验证；集成与最终验收属于 f05/P09。
- 一句话：**缺陷在隔离副本上已修复并有可复跑证据；生产集成待 f05，生产修复结论未出。**
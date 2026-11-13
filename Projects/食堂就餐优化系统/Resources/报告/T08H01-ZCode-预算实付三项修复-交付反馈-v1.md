# T08H01 · ZCode GLM5.3 · 预算与实付三项定向修复 · 交付反馈 v1

| 项 | 内容 |
|---|---|
| 主任务卡 | `Resources/任务卡/T08H01-ZCode-预算实付三项修复小卡-v1.md` |
| 定位 | 隔离修复（H01 三项：已吃/待吃超支提示、金额边界统一、非法实付拒绝）；**隔离候选补丁，非生产合入** |
| 请求模型 | ZCode 子代理，GLM 5.3 |
| 实际可见模型/档位 | 客户端会话模型 `GLM-5.3-Flash`（account:zai-start-plan）；**服务端实际路由/档位未知** |
| 执行/写入 | T08H01 子代理单写入者；只写本证据目录与本文反馈，未写生产、H02/H03、解析器副本、其他证据目录或 MEMORY |
| 项目根 | `D:\项目\cpp\Projects\食堂就餐优化系统` |
| 证据目录 | `Resources\报告\T08H01-ZCode-预算实付修复-证据-v1\` |
| 状态 | **三项修复全部完成；新行为验证 44/44 + G02 回归 A/B/C 全绿 + E 重跑 12/12；TS 4.1.2/5.9.3 双编译 0 错误** |

---

## 1. 固定输入与候选身份（现场复验）

| 项 | 值 | 复验方式 |
|---|---|---|
| 固定输入 U09 | `sha256:7f6a6ea5071626afeb817592f5ad10f105481a2fbefdfee0b8c4b98626aeba42`（75 源文件 / 996165 B；45 工具 / 649001 B） | `candidate-manifest.mjs` 在 **U09 源目录**（`T05U09-DSH-体验收尾归集-证据-v1\candidate\`）重算一致 |
| 冻结 WASM | `miniprogram/src/assets/wasm/mp_core.wasm` 与冻结身份一致 | manifest `frozenWasmMatches=true`（U09 与补丁后各验一次） |
| 补丁后候选树 | `sha256:8628de0b6e942c2138efdb8d92e75fa1087342cd2c07a1dbe495b375dddf3de6`（75 源文件 / 998270 B；45 工具 / 649001 B 不变） | `manifest/manifest.json`（本副本重算） |
| 补丁范围 | **恰好 4 个 TS 文件**：`domain/logs.ts`、`domain/self-pick.ts`、`domain/store.ts`、`domain/types.ts`；`diff -rq` 对 U09 全树比对确认无其他差异 | 见 §3 |
| 累计补丁 | `h01-cumulative-patch-vs-U09-7f6a6ea5.patch`（151 行） | 在**纯 U09 新副本**上 `git apply` 干净套用，套用结果与补丁候选逐文件一致（本轮验证后临时副本已删除） |
| 候选内 git | `b9a604b baseline U09 7f6a…` → `36032bc H01 三项修复…`（两提交，基线树已验证=纯 U09） | `git diff HEAD~1 HEAD` 即累计补丁 |

### 接续此前中断进度的说明（如实记录）

- 证据目录此前已存在（一次被中断的运行所留）：`candidate/`、`logs/`、`scripts/`。本轮**接续而非重做**。
- **核验通过后保留**：中断运行已正确复制 U09（工作区与 U09 全树比对，除 4 个 domain 补丁文件外逐字节一致）；已完成 G02 三项旧行为基线复现（`logs/h01-baseline-repro-results.json`，19/19 符合旧行为，00:33）；已把 H01 补丁应用到 4 个 domain 文件；已复制 G02 五个场景脚本到 `scripts/`（尚未运行）。
- **发现并修正的身份问题**：中断运行在 candidate 里留下的 git 仓库基线提交自称 `baseline e45d740…`，与 U09 哈希（7f6a6ea5…）**不符**（无法产出干净的"相对 U09 累计补丁"）。本轮以"暂存补丁 4 文件 → 以 U09 原版内容重建 git 基线提交（树比对=纯 U09）→ 还原补丁并提交"方式修正，修正原因如实记录于此。
- **遗留文件标注**：`logs/h01-baseline-budget-after-eaten.json`（00:37）虽名为 baseline，**内容实为打补丁后输出**（message 已是新旧口径合并的新文案），系中断前最后一次运行所留；真正基线口径的 message 以 `h01-baseline-repro-results.json` 断言 D1.3 为准。该文件保留原样、在此标注，正式"修复后"预算输出见 `logs/h01-after-budget-after-eaten.json`。

## 2. 实际操作环境

- **Node v24.19.0 + 真实冻结 WASM + mock wx**（`t05-test-helpers.mjs` 内存 Map 存储、`createRealInstantiate`），脚本经 `--import candidate/tools/miniprogram/register-ts.mjs` 加载真实 TS 源与真实页面模块（`pages/logs/index.ts`）。**不等于微信开发者工具/真机证据。**
- 只跑 greedy；未运行三餐 DP20000；未做三算法正确性/营养/性能审计（不在本卡范围）。
- 每个脚本独立进程运行；每个场景独立 `createMockWx()`（内存存储，进程结束即弃），**无持久化测试存储遗留**。
- 写盘仅限本证据目录：`candidate\`（补丁候选）、`manifest\`、`scripts\`（新增 2 个脚本）、`logs\`（16 个原始输出 JSON）、根下 1 个补丁文件。未写项目根生产代码、未写项目外暂存。

## 3. 三项修复内容（相对 U09 的累计补丁，共 4 文件 +34/−11 行）

补丁文件：`h01-cumulative-patch-vs-U09-7f6a6ea5.patch`；候选内可 `git diff b9a604b 36032bc` 复核。

### 修复1｜已吃超支与待吃计划压力分开说（`domain/logs.ts` `buildBudgetView`）
- 新增 `spentOver` 判定：已吃已超支且计划 >0 时，message 同时给出三个事实——"实际消费已超全天预算（**仅已吃即超支 X**）"、"另有计划 Y / 剩余可用 Z"、("**全天预计合计超 W**"=原 overageCents 合并数，不重算)。
- 两条既有分支**原样保留**：`spentOver && plannedKnown===0` 仍走"实际消费已超出全天预算"；已吃未超仍走"计划"口径。消费/计划/剩余/overage 等数据字段一律未动。

### 修复2｜金额边界统一（`domain/types.ts` + `self-pick.ts` + `store.ts`）
- `types.ts` 新增共享常量 `MAX_MONEY_CENTS = 100 * 1000 * 1000`（分，=人民币 100 万元），带注释说明"只挡误输与极端值，不设更低业务上限"。
- `store.ts` 删除本地 `MAX_BUDGET_CENTS`，`isValidMoney` 改用 `MAX_MONEY_CENTS`——方案确认/改记/补记/预算路径语义不变（原 store 上限就是 100000000 分，合法旧记录全部保留）。
- `self-pick.ts` 删除本地 `MAX_MONEY_CENTS = 100*1000*100`（￥100,000 旧上限）与"与 store 同一上限（100,000 元）"的**不实注释**，改 import 共享常量；超上限整数时的误导性提示（"必须是非负整数（分）"）同步为与确认路径同口径（"…且不超过 ￥1,000,000.00"）。
- 预算、实付、已知 0、未知 null 语义不变（0 元仍 `priceKnown=true`，null 仍"明确未知"不补 0）。

### 修复3｜非法实付确认拒绝（`domain/store.ts`，校验放在输入/存储事务边界，不每层重复）
- `confirmMeal`：在 duplicate 检查之后、写库事务之前，对 `priceEdits` 中每个显式给出的**非 null 数字**整体校验 `isValidMoney`，非法则 `fail`（含菜名、"无效"、上限），**不部分写入、不静默回退菜单价、不显示成功**；null/未填走原正常路径。
- `editLog`：补上 G02 低风险观察的直调口子——显式数字 patch 必须过 `isValidMoney`（负价/超限拒绝），并把 `unitPriceCents` 显式给值时的 `priceKnown` 从恒 `true` 改为 `!== null`（不再落"已知 null"）。
- 补记（`addManualLog`）的既有 `priceKnown && isValidMoney` 校验入口未改（本就有效，回归确认）。
- 页面层未改：`pages/logs/index.ts` 失败时经既有 `handleResult` 显示错误 + Toast，确认面板不关闭、输入草稿保留（脚本实测）。

## 4. 验证结果（原始 JSON 均在 `logs\`）

### 4.1 基线复现（中断运行完成，本轮复核采信）— `h01-baseline-repro-results.json`
19/19 断言在**未打补丁的 U09**上复现 G02 三项旧行为（含补充边界：负数/非整数/上限边界/null/0/editLog 负价直调）。

### 4.2 修复后新行为验证（本轮新增 `scripts/h01-after-verify.mjs`）— `h01-after-verify-results.json`：**44/44 通过**
- **N1（9 项）**：预算 800/已吃 1200/待吃 2100 → message 含"仅已吃即超支 ￥4.00"与"全天预计合计超 ￥25.00"；spent/planned/remaining/overage=1200/2100/0/2500 **不误改不重计**；已吃未超（spent=0）仍"计划"口径不误报；planned=0 仍"实际消费"分支。
- **N2（9 项）**：`MAX_MONEY_CENTS=100000000` 唯一常量；￥500,000 在方案确认与自选**同收**；恰好 ￥1,000,000 两路径收、￥1,000,000.01 两路径拒（提示含上限）；旧合法 ￥100,000 仍收；0/null 语义不变。
- **N3（26 项）**：超上限确认 `ok=false` 含"无效"+上限 → **无记录写入**、菜单价不污染、之后正常确认仍按菜单价落账；页面路径（真实 `pages/logs/index.ts`）：错误口径状态栏（非"已确认"）、面板不关闭、输入草稿保留（'1000000.01' 原样）；负数 −5 / 非整数 12.5 拒绝；null/0/恰好上限走原正常路径；自选多项含一个非法金额 → **整单拒绝不部分写入**，同一 draftToken 修正后确认成功（草稿未烧掉），重复提交 `duplicate` 且记录数不变；**已有早餐记录快照在非法确认尝试前后逐字节不变**；editLog 直调负价/超限拒绝、null 置未知、合法改价正常。

### 4.3 G02 场景回归（复用 G02 脚本原样重跑，输出在本证据 `logs\`）
- 场景A（川湘计价）：**32/32** ✅
- 场景B（确认/预算/幂等）：**41/41** ✅（其中预算提示已呈现新文案，数据断言不受影响）
- 场景C（锁/售罄/菜单替换/0 值区分）：**38/38** ✅（旧记录快照逐字节不变、LockConflict 等均保持）
- 场景D（缺价格/缺营养导入探测）：完成，行为与 G02 记录一致 ✅
- 场景E：**原脚本不可整脚本复跑**——它是缺陷取证脚本，E1.2/E1.4/E1.5/E2.3-E2.5 断言的是**旧行为**；打补丁后 E1.2 如期"失败"（自选不再拒绝同一金额）、E1.5 如期抛错（确认被拒无记录可读）——这两个"失败"本身就是修复证据，已如实记录而非掩盖。其仍然有效的回归项 + 修复后期望重述由本轮新增 `scripts/scenario-e-after.mjs` 覆盖：**12/12 通过**（`scenario-e-after-results.json`）：三位小数拦截、超上限页面+store 双层拒绝、两路径一致性、补记幂等/未知价/补记超限拒、补记恰好上限可落账。

### 4.4 TypeScript 静态检查 — `tools/miniprogram/typecheck-src.mjs`
- 微信开发者工具自带 TypeScript **4.1.2：0 errors / 38 files**；Antigravity IDE 自带 TypeScript **5.9.3：0 errors / 38 files**。

## 5. 未复现 / 未完成 / 未测项（如实记录）

- **未发现回归**：A/B/C/D 及 E 有效项全部通过；预算、计划、幂等、售罄、菜单替换、0/null 语义链路无行为变化。
- **未测**：微信开发者工具编译/预览、真机运行、Toast/状态栏在微信端的实际观感（本轮证据止于 Node/mock + 真实页面模块层）。
- **按卡不做**：C++/WASM/算法/限额/营养/月保留策略未触碰（补丁仅 4 个 TS 文件）；三餐 DP20000；全项目测试矩阵。
- **已知残留（非本卡范围、未修）**：`addManualLog` 对 `priceKnown:true` 的校验依赖调用方如实传 `priceKnown` 的既有形态（G02 观察的一部分，页面链路不可达，本轮仅在补记路径回归确认既有校验有效）；未扩展到其他直调 API 面。
- **服务端模型路由/档位**：未知。

## 6. 交付物清单

| 文件 | 说明 |
|---|---|
| `T08H01-ZCode-预算实付修复-证据-v1\h01-cumulative-patch-vs-U09-7f6a6ea5.patch` | 相对 U09（7f6a6ea5）累计补丁，已验证可干净套用 |
| `T08H01-ZCode-预算实付修复-证据-v1\manifest\manifest.json`（+ `hashes.sha256`） | 补丁后候选树 manifest（8628de0b…） |
| `T08H01-ZCode-预算实付修复-证据-v1\candidate\` | U09 副本 + H01 补丁（git 两提交：纯 U09 基线 → 补丁） |
| `T08H01-ZCode-预算实付修复-证据-v1\scripts\` | 中断运行遗留：基线复现 + G02 五场景脚本；本轮新增：`h01-after-verify.mjs`、`scenario-e-after.mjs` |
| `T08H01-ZCode-预算实付修复-证据-v1\logs\` | 全部原始输出 JSON（基线 2 + 修复后 2 + 回归 11 + 遗留标注 1） |

## 7. 合入提示（供主窗口/P01 核验）

- 补丁只含 4 个 TS 文件、+34/−11 行，无 C++/WASM/配置改动；主窗口/P01 核验通过后由**单人**合入生产，本代理未自行推广。
- 合入前建议按 §4 的脚本在合入目标上重跑 `h01-after-verify.mjs` 与 `scenario-e-after.mjs`（需 `--import register-ts.mjs`）。

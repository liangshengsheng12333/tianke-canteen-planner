# T08J02 · ZCode GLM · 62 天存储与恢复压力 · 交付反馈 v1

| 项 | 内容 |
|---|---|
| 主任务卡 | `Resources/任务卡/T08J02-ZCode-六十二天存储恢复压力小卡-v1.md` |
| 执行 | T08J02 子代理（独立窗口），只审不修 + 隔离 mock 测试；未写生产树、未改实现、未占微信开发者工具 GUI（本轮由 T08J01 独占） |
| 指定模型 | 任务卡请求 GLM5.3 |
| 实际可见模型/档位 | 客户端标识 `account:zai-start-plan/GLM-5.3-Flash`（ZCode 子代理）；**服务端实际路由/档位未知**，本反馈不把请求配置写成实际证明 |
| 聊天 cwd / 项目根 | `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T08J02-ZCode-长期存储压力-证据-v1` / `D:\项目\cpp\Projects\食堂就餐优化系统` |
| 证据目录 | `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T08J02-ZCode-长期存储压力-证据-v1\` |
| 写入范围 | 仅上述证据目录 + 本反馈文件；T06d candidate 目录全程只读（mtime 核验未变） |
| 状态 | **卡内全部场景执行完毕：6 个独立场景、344/344 断言通过，0 个真实缺陷**；3 项规则口径观察（非缺陷）；真实微信存储注入/真实容量未测 |

---

## 1. 输入身份与实算复核（开工时自行复算）

- 固定候选：`Resources/报告/T06d-ZCode-统一资源修复-证据-v1/candidate/`，在本候选目录内实跑其自带 `tools/miniprogram/candidate-manifest.mjs`：
  - sourceTreeDigest `sha256:2871b4cad6cf801eeb27291c9eb291b3227d0adcf4c6a3270d40e9e34b3441a1`（75 文件 / 1004620 B）✓ 与任务卡一致
  - tools 45 文件 / 649145 B ✓；`frozenWasmMatches=true` ✓
- 包内 WASM 单独核验：`miniprogram/src/assets/wasm/mp_core.wasm` = 107936 B，SHA256 `304FED667624EA93B4A77314CFCC74D09AC57B2A2F3A1D6A4EBF8CE79DA370E8` ✓
- 独立副本：复制 `candidate/miniprogram/src` → 证据目录 `candidate-src/`，`diff -rq` 与源逐文件一致（COPY_IDENTICAL）；测试只对副本运行。
- 关键常量实读：`app-state.ts` `MAX_KEPT_DAYS=62`、`KEEP_PLAN_RAW_DAYS=3`、存储键 `tiankeshike:state:v1`；`app.json` 无任何存储容量/上限配置。

## 2. 环境、命令与隔离边界

| 项 | 值 |
|---|---|
| 运行环境 | Node.js v24.19.0（win32 x64，本机 UTC+8）+ 自建 mock wx（Map 字符串存储替身，语义对齐“不存在的键返回 ''”）+ 候选包内真实冻结 WASM（5 次日常单日 greedy 方案，无 BnB/DP/大规模请求，无 CPU 性能测试） |
| 被测代码 | 证据目录 `candidate-src/`（domain/app-state.ts、store.ts、backup.ts、logs.ts、self-pick.ts、utils/*） |
| 运行器 | 证据目录 `t08j02-run.mjs` + `harness/mock-wx.mjs`（T08J02 自建，未复用写死共享 tmp 的 t05 helper）+ `harness/register-ts.mjs`（复制自候选） |
| 运行命令 | `cd <证据目录> && node --import ./harness/register-ts.mjs t08j02-run.mjs`（单进程约 8 秒） |
| 原始结果 | `results/t08j02-evidence.json`（344 条逐条断言 + 全部参数/字节/错误消息）、`results/state-source-day63.json`（303753 B 源状态快照）、`results/export-bundle-day63.json`（236851 B 导出文本） |
| 隔离声明 | 全部写入/清理/故障注入只发生在运行器自建的 mock 存储与 mock 文件 Map；未触碰主工作树生产源、未触碰 T06d candidate、未触碰其他代理输出、未触碰真实微信存储；未清空任何真实用户数据 |

## 3. 数据生成参数与预期（可解释、可复现）

62 天窗口 = 2026-08-25 .. 2026-10-25（本地日期，东八区自洽），每天 3 餐（早/午/晚），共 186 餐。全部记录经 store 真实 API 写入（`addManualLog` / `confirmSelfPickMeal` / `editLog` / `revokeLog` / `endMeal` / `saveProfile` / `saveSettings` / `refreshPlan`），不经手存储 JSON。注入时钟每日设到当天本地 12:00:00，此后每次调用前进 1000ms（保证 recordId/createdAt 单调）。

| 参数 | 值/公式 |
|---|---|
| 自选确认餐 | r=(dayIdx*7+mealIdx*3)%31 的其余餐：171 餐，每餐 1–3 项（(dayIdx+mealIdx)%3+1），数量 1–2，实付价 = (dayIdx*37+mealIdx*101)%2000+1 分（已知价） |
| 手动补记·价格+营养未知 | r===0 的 6 餐：unitPriceCents=null、priceKnown=false、nutrition=null（2026-08-28 午、09-01 晚、09-24 早、09-28 午、10-02 晚、10-25 早） |
| 手动补记·明确 0 元 | r===1 的 6 餐：unitPriceCents=0、priceKnown=true、营养完整（energyKcal=520 等）（09-02 早、09-06 午、09-10 晚、10-03 早、10-07 午、10-11 晚） |
| 改记 | 第 3/13/23/33/43/53 天午餐 quantity+1 → 旧记录 superseded、新 revision+1（6 次） |
| 撤销 | 第 7/21/35/49 天晚餐 revoke（保留 revoked 历史，4 次） |
| 结束不虚构 | 第 14/35/56 天早餐 endMeal（无记录，3 次） |
| 真实 WASM 方案 | 第 55/59/60/61/62 天 refreshPlan（每次 rawText 均为 7560 字符的真实核心响应） |
| 档案/预算 | 男性 20 岁 175cm/70kg 减脂；budgetCents=3000（30 元，非 null） |
| d62 用户锁/售罄 | 午餐窗口锁 `w-shandong-pancake`、早餐菜品锁 `offer-wuhan-hotdry-noodles`、晚餐售罄 `dish-wuhan-hotdry-noodles@w-wuhan-hotdry-noodles` |

**预期月汇总**（由写入时刻登记表独立推导，与实现分口径）：2026-08 = 7 天/21 餐−1 撤销 = 20 餐；2026-09 = 90−1 撤销−1 结束−1 撤销 = 86 餐；2026-10 = 75−1 撤销−1 结束 = 73 餐；已知价分值与未知标记由登记表逐项累计（未知不按 0）。

## 4. 逐场景结果（S1–S6，断言 344/344 通过）

### S1｜62 日期桶规模（62 天逐日构建后检查点）

| 指标 | 实测 |
|---|---|
| 日期桶数 / 范围 / activeDate | 62 桶；2026-08-25 .. 2026-10-25；activeDate=2026-10-25 |
| 状态 JSON 实际 UTF-8 字节 | **248212 B**（244434 字符；dev 页 `estimateStateBytes` 口径为字符数，不等于字节） |
| mock 存储载荷 | 与内存状态逐字节一致（sha256 相同），248212 B；mock `getStorageInfoSync` 折算 currentSize=243（**mock 值，非微信真实宿主返回**） |
| 导出文本（d62 探针） | 248415 B UTF-8，digest `sha256:4ab6e22d…`（导出含包络，恒大于状态本体） |
| 状态字节增长曲线 | d1=4042 B → d10=35629 → d30=104016 → d54=187737 → d62=247935 B（日常约 +4 KB/天；方案日 +12 KB，其中 7.5 KB 为 plan.rawText） |
| 月汇总（实现 vs 生成登记表） | 2026-08：7 天/20 餐/11279 分/含未知 ✓；2026-09：30 天/86 餐/194390 分 ✓；2026-10：25 天/73 餐/187625 分 ✓；三天 `priceIncomplete=true`（未知未按 0）、`knownEnergyKcal=0` 且 `energyIncomplete=true`（自选项营养未知不派生） |

### S2｜第 63 天滚动清理（2026-10-26）

- 桶集合变化**恰好** −`2026-08-25`（最旧）+`2026-10-26`（当天新桶），桶数 62→62；幸存 61 桶的 logs/windowLocks/itemLocks/soldOut/endedMeals 逐字节不变。
- 月汇总随清理回落：2026-08 从 7 天降为 **6 天**（8-25 桶已清理）；2026-10 保持 25 天。
- **planRaw 未变**（`planRawChangedToday=[]`）：d60 方案 createdAt=2026-10-23T04:00:04Z，第 63 天 ensureDay 的 keepRawFrom=2026-10-23T04:00:01Z，差 3 秒未达回收线——见观察项 O-1。

### S3｜planRaw 3 天回收 + 快照保留（嵌入 S1/S2/S4 检查点，规则一致性逐桶断言）

- 62 天检查点：d55（10-18，创建于 72h 之前）rawText 已回收为 ''，且 requestId/revision/profileRevision/menuVersion/createdAt 快照完整保留 ✓；d59–d62（72h 内）rawText 保留 ✓。
- 回收边界按实现规则（`createdAt >= now-72h` 保留）逐桶核验通过；d60 方案的 rawText 实际回收发生在重开时（时钟 19:00，keepRawFrom=10-23T19:00>创建时刻），方向唯一：源保留→重开回收，快照仍在 ✓。

### S4｜导出 → 预检 → 恢复 → 重开 一致性（d63 状态，导出 236851 B）

- 预检通过（格式/版本/摘要形态/结构/摘要复算）；`applyRestore` 对照表 8 行：业务日期/菜单版本/当日日志/锁定售罄/计划 requestId **equal**，档案 revision 与档案内容摘要 unequal（恢复目标为全新空实例，属“正常覆盖”预期行）；第 8 行恢复内容摘要与备份文件一致 **equal** ✓。
- 重开（销毁实例→同存储新实例）：**days 逐字节一致（plan.rawText 归一化后）**、settings（预算 3000 分）一致、profileRevision 一致；三月月汇总与源店及登记表一致（08：6 天/17 餐/10306 分；09：30/86/194390；10：25/73/187625）✓。
- 用户锁/售罄（d62 桶）：窗口锁、用户菜品锁、售罄标记跨导出恢复逐字节一致且非空 ✓；d63 plan requestId/revision 一致 ✓。
- **金额 0 与未知保留**：6 个 0 元样例恢复后仍 `unitPriceCents=0, priceKnown=true`；6 个未知样例仍 `unitPriceCents=null, priceKnown=false, nutrition=null` ✓（0 未被吞成未知、未知未被补成 0）。

### S5｜旧 14 桶格式恢复，不重新截 14 天

- 旧格式状态（schemaVersion 仍为 1、14 桶 2026-10-12..25、内置冻结示例菜单、每日 1 餐、10-25 含 plan）通过当前 `validateState`，导出 15416 B，预检+恢复成功 ✓。
- 恢复后仍 **14 桶**、14 天日志逐字节保留、activeDate 按备份为 10-25、plan.rawText 随恢复保留 ✓。
- +1 天 → 15 桶，+2 天 → **16 桶**：新代码不再套用 14 天窗口（不重新截 14 天）✓；2026-10 月汇总 = 14 天/14 餐/1659 分（与逐日 100+i 生成参数精确一致）/priceIncomplete=false/energyIncomplete=true ✓。

### S6｜故障注入（隔离 mock）——内存与存储不半提交

| 注入 | 结果（错误路径消息原文见 evidence.json） |
|---|---|
| 提交中途 `setStorageSync` 一次性失败 | `addManualLog` 返回 `保存失败，已保留原数据：注入：setStorageSync 一次性失败`；**内存状态 sha256 不变、存储载荷逐字节不变**；解除注入后同 token 重试成功且恰好新增 1 条记录（无重复、无半条）✓ |
| init 跨日写入失败（全写失败注入） | `初始化写入失败：mock setStorageSync 写入失败（T08J02 注入）`；存储仍为注入前旧状态（无半提交）；故障闩锁下业务写入被拒（`本地数据处于故障状态…`）；`resetLocalData` 成功自救，之后写入恢复 ✓ |
| 备份文件写失败 | `exportBackup` 仍成功（text 兜底 236KB 级），`filePath=null`，元数据如实记 `已生成备份文本（未写入文件）`；解除注入后文件写入成功（正对照）✓ |
| 备份读取/校验失败 | 非 JSON → stage=parse 拒绝；篡改 state → `备份摘要不一致…已拒绝恢复`；format 不匹配 → `不是天科食客备份文件`；bundleVersion=2 → 版本拒绝；全部失败路径**未写任何状态/存储** ✓ |
| `getStorageSync` 读取失败 | `读取本地存储失败：注入…` → 故障闩锁阻止写入（不用空状态覆盖可能可恢复的数据）；故障解除后重新 init 自愈成功 ✓ |

## 5. 通过 / 失败 / 未测 逐项

| 卡内要求 | 结论 |
|---|---|
| 62 日期桶新规模（状态/导出实际 UTF-8 字节、保留日期、月汇总） | **通过**（S1，字节与月汇总见上表） |
| 第 63 天只清理最旧桶 | **通过**（S2，恰 −8-25 +10-26，其余桶逐字节不变） |
| 3 天前 planRaw 按既有规则回收但快照在 | **通过**（S3；d55 回收+快照在；边界行为见 O-1） |
| 导出→预检→恢复→重开→月汇总/预算/修订/用户锁一致，金额 0/未知保留 | **通过**（S4，34 条对照+逐项断言全过） |
| 旧 14 桶格式能恢复，不重新截 14 天 | **通过**（S5，14→15→16 桶） |
| 存储写失败/备份读写失败 mock 注入，内存和存储不半提交 | **通过**（S6，5 类注入全部符合“要么完整落盘、要么内存存储双不变”） |
| 真实微信文件系统注入 / 专用测试项目测真实存储 | **未测**——GUI 本轮由 T08J01 独占，本卡未占用；无专用测试项目可清空用户实例的授权，不强行注入 |
| 真实微信容量判断 | **未测/不判**——`app.json` 无容量配置、代码无写入前体积闸（如实记录）；mock 的 limitSize/currentSize 是替身值；**Node 内存 Map 全过 ≠ 微信容量成功**，本反馈不自创“肯定未超微信上限”的数字 |

## 6. 缺陷清单（真实缺陷 0 个；观察项 3 条，均不构成数据损坏）

> 断言数（344）与独立场景数（6）分开统计；以下观察项为规则口径记录，不计入真实缺陷。

- **O-1（口径）** `KEEP_PLAN_RAW_DAYS=3` 的注释语义是“超过 3 天只清空原文”，实现为 `createdAt >= now-72h 保留`：实际 rawText 存活 3–5 天，取决于方案创建时刻与后续各次 `ensureDay` 时刻的秒级相对差（实测 d60 方案在第 63 天 12:00:01 差 3 秒未回收、19:00 才回收）。行为符合代码规则、可解释、无损坏；建议在注释或文档标注“72 小时滑动窗口”口径，避免按“自然 3 天”理解。
- **O-2（设计确认）** init 跨日写入失败时，内存已含新桶而磁盘保持旧状态——设计上靠故障闩锁阻止后续任何写入，磁盘内容不变、下次启动重新跨日；实测无半提交。属有意设计（源码注释明确），建议保持，不需修复。
- **O-3（规模提示）** 62 天满载 + 72h 内最多 5 份真实 plan.rawText（每份 ~7.5KB）时，状态/导出约 237–248 KB UTF-8，且单键整体写入（每次 commit 全量重写）。本机 Node mock 无压力；微信单键/总容量与全量重写耗时在真机上的表现未测（见第 5 节未测项），建议 T08J01 或后续有 GUI 的窗口在真实宿主读 `getStorageInfo` 实测后再下容量结论。

## 7. 假设与不确定性（与缺陷分开）

- 62 天窗口取 2026-08-25..10-25、东八区：场景日期全部由本地日期构造，与机器时区自洽（已断言 +08:00 正午换算一致）；其他时区下日期平移但行为结论不变。
- 旧 14 桶格式按 T08G03 记录的历史行为（`MAX_KEPT_DAYS=14` 时代、schemaVersion 未变、导出包络同 format/bundleVersion=1）构造；候选树内无该历史版本源码可对照，格式假设已在证据 JSON 中显式标注。
- mock wx 只模拟“字符串存储 + 一次性失败注入”的必要子集；真实微信 `setStorageSync` 的失败语义（如超配额 errMsg、10MB 上限行为）未测。
- 每日方案请求为正常单日 greedy（5 次，rawText 各 7560 字符）；未跑 BnB/DP/大规模请求，未做 CPU 性能测试（遵守卡红线）。

## 8. 证据索引

| 文件（证据目录内，绝对路径前缀 `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T08J02-ZCode-长期存储压力-证据-v1\`） | 内容 |
|---|---|
| `results\t08j02-evidence.json` | 344 条逐条断言、生成参数、字节曲线、月汇总、恢复对照表、全部错误路径消息原文 |
| `results\state-source-day63.json` | 62+1 天满载源状态快照（303753 B 格式化 JSON） |
| `results\export-bundle-day63.json` | 实际导出备份文本（236851 B UTF-8） |
| `t08j02-run.mjs` / `harness\mock-wx.mjs` / `harness\register-ts.mjs` | 运行器与隔离 mock（可重跑复现） |
| `candidate-src\` | T06d 候选独立副本（diff 校验与源一致） |

# T08N02｜计划项锁定字段补齐｜交付反馈 v1

- 日期：2026-10-25。绝对 cwd：`D:\项目\cpp\Projects\食堂就餐优化系统`
- 执行者：T08N 子代理 N02。**请求模型 GLM5.3；实际运行 GLM-5.3-Flash（ZCode CLI，服务端 reasoning 档位未知）**。实际平台 ZCode CLI / Bash+Node+PowerShell 工具链，无外部平台。
- 依据卡：`Resources/任务卡/T08N-ZCode-四子代理最终收尾总卡-v1.md`、`Resources/任务卡/T08N02-ZCode-计划项锁定字段补齐小卡-v1.md`（唯一范围）。已实读：项目 AGENTS.md、主 PRD v0.2、`Resources/报告/T08M-P01-接收裁定与收尾顺序-20261025-v1.md`、T01 契约 v1.2/v1.1/v1 冻结文本。
- 结论一句话：**最小补丁已交付并通过全部本卡验证**——未修改核心逐字节复现 97（97c8085c）旧结果后，仅新增 `locked` 序列化 4 行；新 native/WASM 双端 7 案例逐字节一致，去 `locked` 后与 97 旧结果规范化逐字节一致，锁定语义断言全过。

## 1. 输入与候选版本

| 项 | 值 | 核验方式 |
|---|---|---|
| 固定输入 | T06e candidate（`Resources/报告/T06e-ZCode-最终核心汇合-证据-v2/candidate`） | 复制独立副本到 `…\T08N02-ZCode-计划项锁定字段-证据-v1\workcopy` 后用候选自带 `tools/miniprogram/candidate-manifest.mjs` 复算 |
| 源树摘要 | `sha256:97c8085ce2817c339455a21be53ed01308c1d570ff3781511bddc39c39b13123`，75 文件 / 1,008,941 B；工具 45 文件 / 649,308 B | 复算一致，无漂移（证据 `manifest-workcopy/`） |
| 冻结 WASM | 111,521 B，SHA256 `8A817926…BFF3A4AD8`，`frozenWasmMatches=true` | 复算一致 |
| 冻结 planner.cpp | 225,445 B，SHA256 `109555B9A255792CC571BC1620153D33A11358DF7AAB7D25C2EED7F5295ECE69` | 与候选内文件一致（小卡/总卡身份吻合） |
| 旧 97 参考响应 | `T08M01-ZCode-算法终验-证据-v1\task2\case-*.resp.json` | 该候选源树摘要同样复算为 97c8085c，core/src 与本路副本 diff 为空、冻结 WASM diff 为空（见 §6） |

## 2. 字段责任表（locked / riceIncluded）

| 层 | 位置 | 职责与现状 |
|---|---|---|
| ① 核心原始结果（唯一权威） | `core/src/planner.cpp`：`PlannedItem.locked`（:134）；赋值点 `MakePlannedItem(..., locked)`（:593-612）：锁定项构造传 `true`（:1022），搜索自由选入传 `false`（:952）。序列化 `WriteMealJson`（:3737）输出 `plans[].meals[].items[]` | **修复前**：`item.locked` 已存在但 WriteMealJson 未写出（缺陷 = 序列化遗漏）。**修复后**：在 item 对象 `nutrition` 之后输出 boolean `locked`，取值即生成时快照，不重新计算 |
| ② catalog 组成 | 契约 v1.2 §3 `Dish/Offer` | 只承载 `riceIncluded`（菜品/套餐含饭属性，用于含饭互斥与计价）与锁定校验所需结构；`state.itemLocks[{meal,offerId,quantity}]` 是**请求输入**，不是结果字段。按 P01 裁定，**不**给结果项加同名 `riceIncluded` 冗余字段（本次未加） |
| ③ 前端展示 | `miniprogram/src/domain/plan.ts` `itemViewFromPlanItem`（:411-468，locked 在 :427 由 `day.itemLocks.some(...)` 计算） | 前端按**当前** day.itemLocks 计算 locked 展示，不读核心结果字段。语义区别：核心 `locked`=生成时快照（该项是否因锁定入选）；前端=此刻是否仍有该锁定（生成后解除锁定两者可合法不同）。**前端未改**（小卡允许保留），主窗口集成时结果里将多出 `locked` 字段，前端 `itemViewFromPlanItem` 按字段名取值不受影响 |
| ④ 旧文档继承 | T01 **v1:188**：`meals[].items[]` 字段表**明列** `locked`；v1.1 §7「字段同 v1」+ 修订性质「未受影响结构沿用 v1」；v1.2 修订性质仅营养小修 | 继承链闭合：locked 是明列字段，97 结果缺失属实现遗漏，与 P01 裁定一致。未发现任何已批准后续契约覆盖该裁定（检查了 `Resources/契约/` 全部文件：Offer营养只读出口扩展、T04A18 接收裁定、T08 性能配置 v1/v2、照片估算口径——均不涉及 items 序列化） |
| ⑤ 其他字段差异（仅列证据，不扩大补丁） | T01 v1:188 items 表列 `{offerId,dishId,name,quantity,portionCode,unitPriceCents,priceKnown,nutrition,nutritionBasis,locked,estimated,combo}`；97 现输出为 `{offerId,dishId,portionCode,quantity,priceCents,nutrition(,locked)}` | 差异：无 `name`/`nutritionBasis`/`estimated`/`combo`；价字段用单一 `priceCents`（null=未知）而非 `unitPriceCents`+`priceKnown` 对。此差异在 97 候选即存在、先于本卡，前端 plan.ts 已按现输出适配。是否属"明确规范化一致"范围由 P01/P09 裁定，**本次不改** |

## 3. 最小补丁

`n02-core.diff`（SHA256 `bb67b11a7b86aa7c7900d6f7728c74a200a8de70b7d5e7f06b1ca30785fd28bc`）：对 97 候选全树 diff，**唯一改动**为 `core/src/planner.cpp` `WriteMealJson` item 循环内 4 行插入（字节级插入，含行尾在内其余全部字节不变）：

```diff
3782a3783,3786
>     // T01 v1 §5 meals[].items[] 明列 locked：按 MakePlannedItem 已有的 item.locked 快照原样写出，
>     // 不重新计算；false=该 item 由搜索自由选入，true=生成时由 state.itemLocks 固定入选。
>     out.WriteKey("locked");
>     out.WriteBool(item.locked);
```

- 位置：item 对象 `nutrition` 之后（与 v1 items 表中 locked 位于 nutrition 系字段之后的顺序一致）。
- 不变量：未改锁定计算、评分、排序、planKey、限额、含饭计价；未加兼容层；`miniprogram/`、`tools/` 零改动（diff 为空）。
- 补丁后 planner.cpp：225,733 B，SHA256 `c883b15d4a090800d2c510ea7a5eed21ad214aaf8261d32fc7909ec4456a04f1`。
- 过程说明：首次用编辑器工具改写导致全文 CRLF→LF 归一（diff 噪声），已废弃并改为字节级插入重做，最终 diff 即上述 4 行。

## 4. 构建与配对产物（均实读本路 workcopy 源码）

| 产物 | 字节 | SHA256 | 说明 |
|---|---|---|---|
| 基线 `baseline-build/mp_cli.exe` | 382,464 | `8ea9513cf153ba9902bb7e441355053963bb7c2db8dc3bdd3e64a9650b12bdc3` | 未修改源码，MSVC cl /std:c++17 /W4 /EHsc /permissive- /utf-8，0 warning |
| 基线 `baseline-build/mp_core.wasm` | 111,521 | `8a817926bde039b74672fa17974323574aebdb2b41fd8d9815b0e11bff3a4ad8` | **与冻结 97 WASM 逐字节一致** → 本路构建环境可精确复现冻结产物 |
| 交付 `final-build/mp_cli.exe` | 382,464 | `29b562d8c59add40f1229f60bf112d2cda598480c27ffb489651c1a3b77f1fc5` | 补丁源码，0 warning |
| 交付 `final-build/mp_core.wasm` | 111,554 | `b0098453b7251c2ff39c65b3df932e7e15975e4252a036196ebf63638a3dc5dd` | 补丁源码，zig 0.16.0（python -m ziglang，wasm32-freestanding -nostdlib -Os），0 warning |
| `final-build/mp_test_core.exe` | 427,008 | `381df2a942bf5be360ab58096cee543137cda1818aca5f79576ad9bec4f45a48` | 补丁源码单元测试，43/43 ALL PASS（在项目根 cwd 运行，只读生产夹具） |

- ABI 面（交付 WASM 实测）：import 1 个 = `env.mp_monotonic_ms`；exports 9 个 = `memory` + `mp_api_version`/`mp_contract_version`/`mp_alloc`/`mp_free`/`mp_plan`/`mp_nutrition_target`/`mp_validate_menu`/`mp_offer_nutrition` —— 与 97 完全相同，宿主 import/8 函数导出不变。
- 构建命令：`build-scripts/build_native_n02.ps1`、`build-scripts/build_wasm_n02.ps1`（候选原 `tools/core/build_native.ps1`/`build_wasm.ps1` 的副本，仅改 `$root`→本路 workcopy、`$toolchain`→证据内目录并加 UTF-8 BOM 以便 PS5.1 读中文路径；编译参数逐字未动）；zig 实际命令见上，缓存用共享 `.toolchain\zig-cache*`（仅构建缓存，非受控文件），stage 输出 `.toolchain\build\wasm\n02_*_stage.mp_core.wasm` 后复制入证据。
- 实际操作备注：ZCode 沙箱内 `python -m ziglang` 报 `AccessDenied`（无法建缓存子目录），zig 编译两枚均以非沙箱方式执行成功；native MSVC 构建与全部 node 验证在常规方式下完成。
- 单进程耗时：最贵为 branchAndBound native 求解 4.28 s，全部远低于 25 s 上限；native 构建 ~2.9-10.4 s、zig（热缓存）~1 s。

## 5. 验证与原始请求/响应

harness：`harness/run_n02_compare.mjs`（结构沿用 T08M01 task2 `run_dual_compare.mjs`；夹具 `t06e-base-req.json`/`mini-base.json` 与其逐字节同源；requestId 复用 `m01-t2-<case>` 使请求与旧 97 参考**逐字节相同**，已逐案 `cmp` 验证 IDENTICAL）。

汇总（`responses-final/n02-compare-summary-final.json`，原始未处理响应同目录另存）：

| 案例 | 覆盖点 | native↔wasm 逐字节 | 去 locked 规范化 vs 97 旧结果 | locked 断言 |
|---|---|---|---|---|
| base-greedy / base-dp / base-branchandbound | 空锁定；三算法、null 限额（limits.wallClockMs=null）全响应双端一致 | 全 true | 全 true | — |
| locks | 窗口锁定（lunch→w-chuanxiang-xiaochu，windowLocked=true）+ 单项锁定（breakfast wonton） | true | true | 过（含 locked offer 真实入选） |
| combo-rice-once | 单项锁定含饭套餐（米饭只计一次，价=套餐总价） | true | true | 过 |
| half-rice-same-price | 单项锁定半份米饭（价=整份同价 100） | true | true | 过 |
| unknown-nutrition-locked | 锁定未知营养 offer：可入、营养四项 null、`NUTRITION_INCOMPLETE`+`LOCKED_UNKNOWN_NUTRITION`+`ESTIMATED_DATA` 标记齐全 | true | true | 过 |

- **断言口径**：每个 item 的 `locked` 值 === 该 (meal,offerId) 是否在请求 `state.itemLocks`（生成时快照语义）；每个已规划餐次的锁定 offer 必须真实出现在某 plan 的 items 且 `locked=true`。7 案例全过。
- **规范化比较声明（唯一允许差异）**：新响应去掉 `plans[].meals[].items[].locked` 后按 canonical JSON（键排序、紧凑）与旧 97 响应比较；旧响应文件为 T08M01 task2 原始字节复制（`old-97-reference/`），**未改旧期待**。基线（未修改源码构建）响应与 97 旧结果 14/14 文件逐字节一致，证明规范化比较的其余字段零漂移。
- 补充：响应字节长对照——如 case-locks native 旧 7,786 B → 新 8,181 B（差异即各 item 的 `"locked":bool` 串）。
- A18 时限冒烟（`harness/a18_smoke.mjs`，`responses-final/a18-smoke-wallclock1.*`）：wallClockMs=1 的 branchAndBound 双端均 `ok=true`、`ResourceLimited`、`searchComplete=false`、`approximations=["APPROXIMATE_TIMEOUT"]` —— 单调时钟 import 的时限语义保持（该案例含时序依赖，不做双端字节相等断言，等值口径以上表 null 限额用例为准）。
- 命令记录：构建 §4；验证 `node harness/run_n02_compare.mjs --cli final-build/mp_cli.exe --wasm final-build/mp_core.wasm --out responses-final --tag final`（基线 tag=baseline 同理）；单元测试 `.\final-build\mp_test_core.exe`（项目根 cwd）。

## 6. 未测项与边界

- 未宣称：契约整体通过、A09、真机（红米）通过、T04A18 专项时限用例全套、生产目录变更——均未发生/未验证。
- 未重跑 T08M01 其余 5 案例（activelogs/soldout/budget-1500/mini-dp/unknown-nutrition-auto）：与本卡字段无关，且基线已证未修改路径零漂移。
- 未测：LockConflict（锁定失效）路径；WASM 内存增长/泄漏（N04 范围）；小程序端构建与真机。
- `plan.ts` 未改：前端"按当前锁定状态显示"与核心"生成时快照"的语义区别已在 §2③ 说明，页面如需改用核心快照字段属后续卡范围。
- §2⑤ 的 v1 items 表与现输出的其余字段差异**只列证据未改**，交 P01/P09 裁定。

## 7. 证据目录索引（`Resources/报告/T08N02-ZCode-计划项锁定字段-证据-v1/`）

`workcopy/`（独立副本，含补丁后源码）、`manifest-workcopy/`（开工复算清单）、`n02-core.diff`（最小补丁）、`build-scripts/`（构建脚本副本+生成器）、`baseline-build/`、`final-build/`（交付配对产物）、`harness/`（run_n02_compare.mjs、a18_smoke.mjs、夹具）、`old-97-reference/`（T08M01 原始字节复制）、`responses-baseline/`、`responses-final/`（原始请求/响应+汇总）。

生产目录（core/、miniprogram/、tools/ 项目根）、旧证据、MEMORY、共享契约均未写；未删除任何目录、未改 ACL。

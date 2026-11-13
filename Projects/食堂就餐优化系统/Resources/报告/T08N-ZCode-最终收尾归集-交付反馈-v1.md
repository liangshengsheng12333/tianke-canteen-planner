# T08N｜ZCode 四子代理最终收尾归集｜交付反馈 v1

- 日期：2026-10-25；主窗口（唯一汇合者）：GLM5.3（实际运行 GLM-5.3-Flash，服务端档位未知）
- cwd：`D:\项目\cpp\Projects\食堂就餐优化系统`
- 输入：T06e candidate（manifest `97c8085c…39b13123`，开工/集成前/归集末三次现场复算一致）；T08M 证据与 `Resources/报告/T08M-P01-接收裁定与收尾顺序-20261025-v1.md`
- 总卡：`Resources/任务卡/T08N-ZCode-四子代理最终收尾总卡-v1.md`；本卡不推广生产，生产全程零改动。

## 1. 四路子代理（链接与实际模型）

| 路 | 反馈 | 证据 | 实际模型 | 状态 |
|---|---|---|---|---|
| N01 备份摘要文案 | `T08N01-ZCode-备份摘要文案-交付反馈-v1.md` | 同名`-证据-v1/` | GLM-5.3-Flash（请求 GLM5.3，档位未知） | 完成，副本 manifest 无漂移 |
| N02 locked 字段补齐 | `T08N02-ZCode-计划项锁定字段-交付反馈-v1.md` | 同名`-证据-v1/` | 同上 | 完成，双端 7 案例逐字节一致 |
| N03 有效注释收尾 | `T08N03-ZCode-有效注释收尾-交付反馈-v1.md` | 同名`-证据-v1/` | 同上 | 完成，**最终有效注释率 12.47% 未达 20%，如实列待 P01 裁定** |
| N04 native 泄漏检查 | `T08N04-ZCode-native泄漏检查-交付反馈-v1.md` | 同名`-证据-v1/` | 同上 | 完成，驱动就绪+最终候选实测未检出泄漏 |

派发顺序：N01+N02 并行（独立副本）→ 交回后 N03 继承「N02 核心+N01 文案」合成基线，N04 同槽准备驱动 → 主窗口汇合构建后 N04 实测最终候选。两槽接力，与总卡一致。

## 2. 三路最小 diff

- **N01**：`backup.ts:253` 空 `state.catalog` 回退文案「模拟菜单」→「内置菜单」，单行；与同文件恢复对照表（:214-216）口径一致。改后 backup.ts 哈希 `b07c87ad…`（11414B 不变）。见 `T08N01-…证据-v1/backup-ts-minimal.diff`。
- **N02**：`planner.cpp` WriteMealJson 新增 4 行（2 注释+2 代码）：`out.WriteKey("locked"); out.WriteBool(item.locked);`（按 MakePlannedItem 已有快照原样写出，不重算锁定）。见 `T08N02-…证据-v1/n02-core.diff`。未改评分/排序/planKey/限额/含饭计价。
- **N03**：16 文件仅注释 diff（8795 行）：删 1,865 行模板注释（"分支守卫：当满足…"、"序列化输出契约字段…"、"循环推进与边界守卫：当条件…"等复述型）、补 214 行实质注释（遍历顺序不变量、Arena 内存所有权、时限是尽早终止的保护等）。见 `T08N03-…证据-v1/n03-comments-only.diff` 与 `removed-template-samples.md`。

## 3. 主窗口集成与验证（本卡集成副本）

集成目录：`T08N-ZCode-最终收尾归集-证据-v1/integrated-candidate`。合成顺序：T06e candidate（复算 97c8085c）→ N01 backup.ts → N02 planner.cpp → N03 patch -p1（16 文件干净套用）。

验证链：
1. `diff -r --strip-trailing-cr`（core/miniprogram/tools）与 N03 已验证 workcopy **0 差异**；
2. N03 字符串感知工具复核：去注释后代码与「N02+N01」基线 23,091 行**逐字节一致**（首次跑报 4 行不匹配，逐行核实均为 proof-baseline 内 platform_wasm.cpp 既有 4 行 LF-only 行尾伪差，非代码差异，证明材料存 `T08N03-…证据-v1/token-identity-proof.txt`）；
3. backup.ts 与 N01 副本逐字节一致；planner.cpp 含 N02 `WriteKey("locked")`。

**披露①（行尾）**：`patch` 将 16 个被改文件行尾重写为 LF，主窗口已统一转回 CRLF（项目主导约定）；其中 platform_wasm.cpp 等 4 文件原始即混合行尾（个别行 LF），统一 CRLF 后与原始字节相比有 4 处行尾差异、内容令牌不变。
**披露②（越界写入）**：主窗口首次 native 构建脚本误指向 N02 证据内 toolchain scratch（`T08N02-…/build-scripts/toolchain/build/native` 的中间 exe/log/summary 被同参数重建产物覆盖）。N02 正式记录证据（baseline-build/final-build/workcopy/responses/diff）已逐项复核哈希无损。

## 4. 配对产物与身份（新候选）

- **新源码 manifest**：`sha256:a62aced0ee327eb208bfac4528b26f9a745bb8130772cbe9c2c83ba7cce0b357`（75源/1,009,489B、45工具/649,308B、frozenWasmMatches=true）。清单落盘 `T08N-ZCode-最终收尾归集-证据-v1/candidate-manifest/`。
- **WASM**：111,554 B / SHA256 `B0098453B7251C2FF39C65B3DF932E7E15975E4252A036196EBF63638A3DC5DD`，与 N02 final-build 逐字节一致（注释改动不影响产物，构建确定性复证）；已入包，`frozenWasmMatches=true`。
- **native（MSVC /std:c++17 /W4 /EHsc /permissive- /utf-8，0 warning）**：mp_cli.exe 382,464B/`2DAE456921AB5E9F414140D26E676EF6A35C3D138C2356AB6E5FF4B3466110BA`；mp_test_core.exe 427,008B/`14EFC311…`；mp_test_json.exe 399,360B/`38D5F0E8…`；mp_test_sha256.exe 387,072B/`DF515B23…`。（与 N02 exe 同尺寸不同哈希：MSVC 时间戳，正常）
- **活跃身份/测试期待同步**（T06e 同口径）：`core-runtime.ts`、`candidate-manifest.mjs` FROZEN_WASM、`t05-test-helpers.mjs` 及 7 个测试脚本的身份常量/注释 111521→111554、8A817926→B0098453，共 10 文件。
- 构建：`build-scripts/build_native_t08n.ps1`（日志 `toolchain/build/native/build_*.log`）；WASM 构建障碍与解法见 `build-wasm-record.md`——**披露③**：本窗口内 `python -m ziglang`（与 N02 同款 toolchain）持续 AccessDenied，根因为 zig 路径含中文字符导致其内部目录创建失败；将 zig.exe+lib 复制到纯 ASCII 路径 `D:\zig-ascii\` 后同参数编译成功，编译参数逐字未动。

## 5. 集成副本回归（原始输出在本卡证据目录/responses-t08n、上方日志）

- 单测：mp_test_core **43/43**、mp_test_json **189** 全过、mp_test_sha256 **20** 全过。
- N02 harness 双端对拍（新 mp_cli + 包内新 wasm）：**7 案例（三算法 null 限额+空锁定/窗口锁定/单项锁定/锁定未知营养）native↔wasm 逐字节全真**；去 `locked` 规范化后与 97 旧结果逐字节一致（normOld 全 true）；锁定快照断言全过。
- TS 类型检查：wechat-devtools TS 4.1.2 与 antigravity-ide TS 5.9.3 均 **0 errors/38 files**。

## 6. 字段责任与双端行为（N02 §2 摘要）

- `locked`：T01 v1:188 于 items 明列，v1.1 沿用，v1.2 未取消；核心 PlannedItem 已有该状态而 WriteMeal 未写出——本次按 `item.locked` 快照原样输出 boolean，不重算。前端 `plan.ts` 仍按当前 `day.itemLocks` 计算展示（生成时快照 vs 当前状态的区别已在反馈说明）。
- `riceIncluded`：属 Dish/Offer 含饭互斥组成数据，冻结结果项不要求同名冗余字段，未加。
- 与 97 旧结果对比：仅事先声明的去 `locked` 规范化比较，其余逐字节一致；完整未处理响应另存 `T08N02-…证据-v1/responses-final/`，未改旧期待。未发现其他字段差异。

## 7. 有效注释计数（N03，最终）

- 口径：自写 C++/TS 合计、分语言公开；剔除空标记/纯分隔/模板复述（剔除规则与逐文件表存 N03 证据）。
- **最终：C++ 8.69%（930/10,708）、TS 16.31%、合计 12.47%——低于 20% 冻结口径**。N03 未凑行、未造注释，不足如实列出。对照：M03 口径 B 的 20.2% 含大量未剔除模板，不可宣布通过。**此为 P01 待裁定项：是否接受当前语义有效口径并修订注释率验收方式，或另派补注释轮次。**

## 8. native 泄漏检测（N04）

- 驱动：统一 `/MDd /D_CRTDBG_MAP_ALLOC` 调试运行库，`_CrtMemCheckpoint/_CrtMemDifference` 逐批对照；`RawAlloc` malloc/free 路径确认被覆盖。
- 阳性对照两组：驱动临时分配不释放被检出、释放后差异消失；核心路径故意漏 `mp_free` 被检出并定位 `platform_native.cpp` malloc 行——检测通路有效。
- **最终汇合候选实测**（`integrated-candidate`，被测源码 `copy-final/` 与其 diff -r 0 差异，非旧 97 核心）：四入口（plan/target/menu/offer）×三算法×非法输入×null×真实正时限共 373 次真实 C ABI 调用，逐批差值全 0；最贵子进程 12.8s ≤25s；原始输出 `runs-final/` 11 份；旁证 FNV 确认被测对象为新汇合核心。
- 结论限定：**该请求集未检出泄漏**。未测：并发、进程启停、fuzz、WASM 侧内存；不宣称任意输入无泄漏。

## 9. 生产未变证明

派发前、集成前、归集末三次现场复算生产 manifest 均 `sha256:97c8085ce2817c339455a21be53ed01308c1d570ff3781511bddc39c39b13123`（75/1,008,941B、45/649,308B、frozenWasmMatches=true）。本卡全部改动只发生在 `Resources/报告/T08N*` 证据目录内。

## 10. 缺陷、限制与下一步

- **待 P01 裁定①**：N03 最终有效注释率 12.47% < 20%，是否接受语义有效口径并调整验收方式，或另派补注释轮次。
- **待 P01 裁定②**：新候选 `a62aced0…`（配对 WASM `B0098453…`/native `2DAE4569…`）是否接收为收尾基线，进而按 T08M-P01 顺序另指定单人逐文件推广并固定新身份，再放行 T08a4 新版提示词与 P09 数据分项。
- 未测（沿各卡如实记录）：微信模拟器/真机、正式性能、A09 宣告、P09 总审；WASM 侧泄漏、并发/fuzz。
- 本卡未推广生产、未动 PPT、未写 MEMORY、未动共享契约与旧证据；本反馈为唯一归集入口。

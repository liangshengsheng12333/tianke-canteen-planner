# T08f-DSH｜三子代理隔离修复转交与归集 · 交付反馈 v1

- 任务卡：`Resources/任务卡/T08f-DSH-三子代理隔离修复转交封面-v1.md`
- 覆盖小卡：`T08f01-DSH-失效锁定解除隔离并行小卡-v2`、`T08f02-DSH-连续换菜隔离并行小卡-v2`、`T08f04-DSH-未知营养显示隔离并行小卡-v2`
- 执行者：DSH 主执行员（Team Lead `lead`）+ 3 名同模型子代理
- 实际 cwd：`D:\项目\cpp`；项目根：`D:\项目\cpp\Projects\食堂就餐优化系统`
- 执行时间：2026-10-23 22:39—23:26（Asia/Shanghai）
- 交付性质：**只做分发、归集与独立复核；未合并生产、未执行 f05、未改 `miniprogram/src`/`tools`/WASM/菜单。**

## 0. 一页结论

- 三张 v2 小卡已分别交给 **3 名 DeepSeek V4.1 Flash 子代理并行执行**（同一冻结基线、三个互不重叠证据目录），三份隔离补丁 + 隔离复现/回归证据 + 实际模型记录均已落盘。
- **生产源码零改动**：开工、中途、收尾三次只读 `candidate-manifest.mjs` 均为 `sha256:d15bbe0e…f19e`（75 文件 / 872,829 B，`frozenWasmMatches=true`）。
- 三份补丁 Lead 均已**独立复跑/独立物化验证**（不是转述子代理自报）：
  - f01：基线 RED 可复现，补丁应用后与候选逐字节一致；after 37/37、regression 47/47。
  - f02：基线 22 通过/25 失败（exit 1）→ 候选 47/0，regression 34/0；补丁 apply 后两文件哈希等于 `changed-files.txt`。
  - f04：由 Lead 自行"基线 + patch"物化候选，跑被测脚本 33/33；两文件哈希等于 `changed-files.txt`；基线明细确实输出 `"能量 0 kcal · 蛋白 待补全g …"`。
- **本轮不宣布任何缺陷"已在生产修复"**：三份补丁等待 f05 单一写入者按序合并，并在**合并后的同一候选**重跑三类行为。

## 1. 身份、基线与环境事实

| 项 | 值 |
|---|---|
| 基线清单 | `Resources/报告/T05U06a2-P01-接收与T08a1候选证据-v1/manifest.json` |
| 基线 `sourceTreeDigest` | `sha256:d15bbe0eb2a73e9eba230c819288e9db180487df4ea1ab7b90516482e290f19e` |
| 基线规模 | 75 文件 / 872,829 B；tools 38 文件 / 447,791 B |
| 冻结 WASM | `B53C7405A643E8409071ED76D3CB4CCBDF1A37E6E5C408CE1D4A373D4CC00744`（107,472 B） |
| 运行环境 | Node v24.19.0（类型擦除）+ `tools/miniprogram/register-ts.mjs` 无扩展名解析钩子；git 2.56.0；Windows |
| 请求模型（三卡指定） | DeepSeek V4.1 Flash |
| 实际可核实模型 | DSH 客户端自报 `deepseek-v4.1-flash-1017`（Team Lead 与 3 名成员的 spawn 记录一致） |
| 服务端实际子型号/档位 | **未知**（不把请求配置当实际证明） |
| 会话/槽位 | 本会话 22:39 起为空闲 DSH 会话（当时 0 名队友），非 T08c1 所在窗口 |

## 2. 与 T08c1 模拟器巡检的隔离（硬要求）

- 派单前实测：另一窗口的 T08c1 巡检正在运行——微信开发者工具进程 4 个（22:33 仍在启动新进程），T08c1 证据目录持续写入（最晚 22:55:08 仍新增截图，反馈文件仍标"草稿"）。因此**本会话按"使用独立 DSH 会话"处理，未对该窗口发任何消息、未中断任何 turn**。
- 全程未启动/操作微信开发者工具，未运行 `wxide.ps1`、`wechatide-simulator-evidence.ps1`、`capture-window.ps1`、`run-choosefile-evidence.ps1` 等模拟器脚本，未截图；三卡所有验证均为 **Node 离线 + mock wx + 真实冻结 WASM**。
- 因此本反馈**不能**作为模拟器/真机证据使用，也不改变 T08c1 的进行状态。

## 3. 并行度与派单事实

| 卡 | 子代理 | 认领任务 | 开工 | 交付回执 | 实际并行 |
|---|---|---|---|---|---|
| T08f01 | `f01-lock` | `task-1` | 22:41 | 22:59 | 与 f02/f04 同时运行 |
| T08f02 | `f02-swap` | `task-2` | 22:41 | 23:19（23:22 修补补丁） | 同上 |
| T08f04 | `f04-nutrition` | `task-3` | 22:41 | 23:01 | 同上 |

- **三卡确实同时开启**，不是串行补位、也不是"只准备/只分发"；每卡都有补丁、日志、脚本与反馈文件落盘。
- 三名子代理模型均为 `deepseek-v4.1-flash-1017`（spawn 记录）；三张卡分别使用互不重叠的写入范围（见 §4 路径），无跨卡写冲突。

## 4. 三卡交付清单与 Lead 独立复核

### 4.1 T08f01 失效锁定解除（DEFECT-T08A1-01）

- 反馈：`Resources/报告/T08f01-DSH-失效锁定解除-交付反馈-v2.md`
- 证据：`Resources/报告/T08f01-DSH-失效锁定解除-证据-v2/`
- 补丁：`patch.diff`，489 B，`sha256=1e7ba4f4d0f4c8d2f24843be919ae02a094c3fba88911f64d55811ce8f4a50d9`
- 改动：`miniprogram/src/pages/home/index.ts` 一处 +1 行 `meal: issue.meal,`（31,711 B → 31,735 B；`b4e55e1c…` → `1ce81b8c…`），其余 74 个 src 文件未动
- 子代理自报：before RED 32/32、after GREEN 37/37、regression 47/47
- **Lead 独立复核**：
  - 复跑 `run-f01.mjs before` → `SUMMARY variant=before passed=32 failed=0`，日志显示两条失效锁定点"解除"后仍在、`refreshPlan` 返回 `LockConflict`；
  - 复跑 `run-f01.mjs after` → `passed=37 failed=0`，`lockIssues` 清零、`refreshPlan ok=true status=OkPartial`；
  - 在 `%TEMP%` 新建基线副本 `git config core.autocrlf false` → `git apply --check/apply` 均 exit 0，应用后 `home/index.ts` 为 31,735 B / `sha256=1ce81b8c…`，与证据目录候选**逐字节一致**。
  - **注意**：Windows 默认 `core.autocrlf=true` 时 `git apply` 会写出 CRLF，哈希对不上；f05 必须显式 `-c core.autocrlf=false`。
- 补丁末尾带 `--`（邮件签名行），`git apply` 可正常忽略；此为 write 通道不保留末尾换行时的权宜写法，不影响应用。

### 4.2 T08f02 连续换菜（DEFECT-T08A1-02）

- 反馈：`Resources/报告/T08f02-DSH-连续换菜交互-交付反馈-v2.md`
- 证据：`Resources/报告/T08f02-DSH-连续换菜交互-证据-v2/`
- 补丁：`patch.diff`，12,023 B，`sha256=a59e3cf04836ac61f528629a7dafec864a07e46d8dd297bc6e2d935b4d310d51`
- 改动（2 文件）：
  - `domain/store.ts` 98,424 B / `c5d3a051…` → 102,201 B / `6480a851…`
  - `pages/home/index.ts` 31,711 B / `b4e55e1c…` → 32,502 B / `0aa4acec…`
- 候选整树 digest（自物化现算）：`sha256:8af0f3f0…b9a5`（75 文件 / 877,397 B）
- 子代理自报：基线 22 通过/25 失败（exit 1）→ 候选 47/0，regression 34/0
- **Lead 独立复核**：
  - 复跑 `run-f02.mjs before` → 22 通过 / 25 失败（exit 1），失败项含 S1.5「第二次点"换一份"仍可继续选择（DEFECT-T08A1-02 核心验收）」等；
  - 复跑 `run-f02.mjs after` → 47/0（exit 0）；`run-regression.mjs` → 34/0（exit 0）；
  - 用**证据目录原 `patch.diff`** 对全新基线副本 `git apply --check/apply` 均 exit 0，两文件哈希与 `changed-files.txt` 完全一致。
  - 初版交付补丁末尾缺换行会被 git 判 `corrupt patch`；已要求子代理补 `--` 签名行并复验（现文件可直接应用），本报告记录的是修补后的 `a59e3cf0…`。

### 4.3 T08f04 未知营养显示（DEFECT-S3-02）

- 反馈：`Resources/报告/T08f04-DSH-未知营养显示-交付反馈-v2.md`
- 证据：`Resources/报告/T08f04-DSH-未知营养显示-证据-v2/`
- 补丁：`patch.diff`，2,907 B，`sha256=b141f97ca6f1fae03e74aa37a64d896a030c8624d7c0a0b2d23433becdd34e4a`
- 改动（2 文件）：
  - `domain/plan.ts` 38,814 B / `57d3496e…` → 39,188 B / `b05c1388…`
  - `pages/home/index.ts` 31,711 B / `b4e55e1c…` → 32,111 B / `f6877310…`
- 候选整树 digest：`sha256:66e2e3ee…bb87`（75 文件 / 873,603 B）
- 子代理自报：before 6 FAIL → after 33/33；5 项既有测试在候选与基线上 PASS/FAIL 集合一致
- **Lead 独立复核**：
  - 自行在 `%TEMP%` 用「生产基线 src + `patch.diff`（autocrlf=false）」物化候选 → 两文件哈希与 `changed-files.txt` 一致；
  - 用 Lead 自己的候选跑 `run-f04.mjs --candidate <Lead 物化的候选>` → **33/33 全部通过（exit 0）**，实际文本：未知项 `"能量待补全 · 蛋白待补全 · 脂肪待补全 · 碳水待补全"`，已知项 `"能量 231 kcal …"`，已知零仍 `"能量 0 kcal …"`；
  - 基线复现原文：`"能量 0 kcal · 蛋白 待补全g · 脂肪 待补全g · 碳水 待补全g"`、未知标签为空字符串 —— 与缺陷描述一致；
  - 补丁 `git apply --check/apply` exit 0。

## 5. 合并风险与给 f05 的硬提示

1. **三份补丁都改 `pages/home/index.ts`**，f02 还改 `domain/store.ts`、f04 还改 `domain/plan.ts`：**不能按顺序盲目 `git apply`**，必须由单一写入者手工合并（f01 的 1 行、f02 的 swap 锁语义、f04 的逐字段营养文案在同一函数/映射附近）。
2. **三次隔离验证不可相加**：合并后必须在同一候选重跑三类行为（失效锁定解除、连续换菜、未知营养显示）加既有回归，才可判通过。
3. **f02 引入了持久化内部字段** `itemLocks[].source='swap'`：仅为前端内部标记，发出 `PlanRequest` 前已剥离；视图只把用户锁显示为"已锁定"；旧数据无 `source` 按用户锁处理。合并时需同时核：备份/导入导出、恢复校验（`app-state.ts` 仅做 `Array.isArray` 校验，不会剥离该字段）、以及任何遍历 `itemLocks` 的代码（自选页、日志恢复、月汇总）。
4. **f04 改了 `ItemView.nutritionKnown` 语义**（从"有营养快照"→"四项都是有限数字"）：当前 `src` 内没有页面直接消费该字段，但合并后需再核一遍调用方，避免"部分已知"被新语义误判。
5. **补丁应用方式**：全部用 `git -c core.autocrlf=false apply`；应用后用 `changed-files.txt` 的候选 SHA-256 逐文件核对。f01/f02 补丁末尾带 `--` 签名行属正常，勿手工删。
6. **候选整树不在证据目录**（f02/f04 会话 shell 被沙箱拒写 `Resources\报告`）：候选 = 生产基线 `miniprogram/src` + 对应 `patch.diff`，Lead 已按此路径独立物化并核对哈希；f05 照同一方式重建即可，不要去找不存在的 `candidate` 整树。
7. **既有测试既有失败**：`tools/miniprogram/test-logs-page.mjs` 在**未改动的生产基线**上就失败 2 项（"月汇总只算本月已知花费"、"只有未知价格时写'未知（含未填项）'"）。这与三卡无关，但 P01 需要知道：要么是另一处真实缺陷，要么是过时断言。

## 6. 未完成项与证据边界

- 未做：微信模拟器、真机、WXML 渲染、真实 touch 事件分发；三卡均未在模拟器/真机验证（本卡禁止占用模拟器）。
- 未做：f05 生产合并与同候选重测（后置，依赖本次三份补丁 + T08c1 最终反馈 + P01 核定）。
- 未做：f03（反重力 Gemini 3.8，预算误报）——不在本封面范围。**观察到** `Resources/报告/T08f03-反重力-预算误报修正-交付反馈-v2.md`（23:04 落盘），但其内容与证据未由本会话核验，交 P01/P02。
- T08c1 最终反馈仍为草稿状态（本会话未参与、未修改）。
- 证据性质：全部为隔离副本的 Node 离线结果；不代表生产已修复，不代表模拟器/真机。

## 7. 环境异常与残留（如实记录）

1. 本会话及 3 名子代理的 s**hell/node 进程无法在 `Resources\报告` 下建目录或写文件**（沙箱/低完整性 ACL：`Authenticated Users Modify` 存在但缺低完整性标签；`icacls` 也不可改）。所有落盘均经 DSH fs `write` 工具完成，故：f01 只落唯一改动文件；f02/f04 未能落整树候选，改用"基线 + patch"确定性重建。**未修改任何 ACL、未扩大权限。**
2. 证据目录内残留探针文件（`_probe.txt`、`sandbox-write-probe.log`、`probe.txt`、`.mkdir-probe`、`.write-probe.txt`、`sub-probe/` 等）是环境探针，**不是产物**，查收时请忽略。
3. 三名子代理均未联网、未装依赖、未派生嵌套子代理、未改 `MEMORY\**`/任务卡/其他卡证据目录。

## 8. 结论

本封面任务完成：三张 v2 小卡已真实派给 3 名 DeepSeek V4.1 Flash 子代理并行执行，各自交付**隔离候选/补丁 + 可复跑隔离测试 + 改动清单哈希 + 生产零改动自证**；Lead 已独立复跑与独立物化复核，未合并任何生产代码。

**交付状态：三份补丁可供 f05 合并，缺陷尚未在生产修复；T08c1 未被打断，四卡合流与生产验证仍待 P01 安排。**
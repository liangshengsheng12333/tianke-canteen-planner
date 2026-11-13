# T08M01｜ZCode GLM5.3｜算法与双端终验｜交付反馈 v1

| 项 | 内容 |
|---|---|
| 任务卡 | 总卡 `Resources/任务卡/T08M-ZCode-最终验证三子代理总转交卡-v1.md`；小卡 `Resources/任务卡/T08M01-ZCode-算法终验小卡-v1.md` |
| 定位 | M01 算法与双端终验（只验不修；不跑正式性能；不操作微信模拟器 GUI） |
| 执行 | GLM5.3 M01 子代理，单一执行路 |
| 请求模型 / 实际 | 请求 ZCode GLM5.3；客户端标识 `account:zai-start-plan/GLM-5.3-Flash`；服务端路由/档位未知 |
| 证据目录 | `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T08M01-ZCode-算法终验-证据-v1\` |
| 状态 | **三条任务全部执行完成，0 确定缺陷；有 3 条观察记录（均为工具/口径层面，非核心缺陷）** |

---

## 1. 固定身份核对（开工现场实算，全部一致）

| 项 | 固定值 | 现场实算 | 结果 |
|---|---|---|---|
| 生产 manifest | `sha256:97c8085ce2817c339455a21be53ed01308c1d570ff3781511bddc39c39b13123`（75源/1008941B、45工具/649308B、frozenWasmMatches=true） | `node tools/miniprogram/candidate-manifest.mjs` 同值 | 一致 |
| WASM | 111521B / `8A817926…F3A4AD8` | 同值 | 一致 |
| planner.cpp | 225445B / `109555B9…5ECE69` | 同值 | 一致 |
| 配对 native mp_cli.exe | 382464B / `C86461C7…C5FAD` | 同值 | 一致 |
| 测试时钟 CLI mp_clock_cli.exe | 384000B / `d7b53569…d29bc`（T06e 记录） | 同值 | 一致 |

## 2. 独立副本与身份保存

- 独立副本：从 `Resources/报告/T06e-ZCode-最终核心汇合-证据-v2/candidate/` 整树复制到 `…\T08M01-ZCode-算法终验-证据-v1\candidate\`。本路所有脚本只读该副本源码/产物，未读生产 core 运行。
- 副本自检：副本内 `candidate-manifest.mjs` 复算 = `97c8085c…`（75/1008941B、45/649308B、frozenWasmMatches=true）；副本 WASM/planner/native 三哈希与固定身份一致。
- 运行前后身份：`identity-before/`、`identity-after/`（manifest.json + hashes.sha256），前后一致，**无漂移**。
- `candidate/build/wasm/mp_core.wasm` 与包内 WASM 逐字节同哈希（`8A817926…`）。

## 3. 任务1｜独立两层算法验证（复用 T07a 已批准极小菜单/Oracle，指到本路副本）

工具适配（仅存本路）：`task1/two_layer/run_two_layer_oracle.py` 复制自 T07a 已批准证据，仅改 CLI 路径为本路副本 `candidate/build/native/mp_cli.exe`；请求/菜单/评分逻辑零改动。运行中所有核心子进程 25 秒外部上限。

### 3.1 层一：内容级核对（本路新增，修补 T07a"仅比数量"缺口）

核心公开接口只输出 `candidatesEnumerated` 计数、不输出候选明细，故本路用"锁定探针"做内容级核对（`task1/layer1_content_probe.py` + `layer1_content_verification.json` + 40 组 probe_*.req/resp.json）：

- 方法：独立 Oracle 逐餐枚举全部合法单餐候选（早餐10/午餐15/晚餐15）；对每个候选构造单餐 dp 请求，`state.itemLocks` 精确锁定该候选的 offer 组合、`maxItemsPerMeal` 收窄到该候选件数，迫使核心若枚举过该候选必须原样返回；逐字段比对 windowId / offer+quantity 集合 / 单价合计 / knownSums / planKey（独立计算终局 planKey）。
- 结果：**40/40 候选内容全匹配**（含含饭套餐候选：价 1350 整、互斥规则正确）；数量等式 oracle=core（10/15/15）；全部探针响应 `searchComplete=true`、`capsHit=[]`、`approximations=[]`。
- 数量等式 + 每个 Oracle 候选均可被核心原样返回 ⇒ 候选集合内容完全一致（双向覆盖）。
- 负向探针：米饭+含饭套餐同时锁定 → `LockConflict`（未产生违规方案）；售罄 d-beef 后早餐主推不含该菜。均通过。

### 3.2 层二：全天独立穷举与最优对照（`task1/two_layer/two_layer_verification.json`）

- 全天笛卡尔积 10×15×15=2250 组，独立 Python Oracle 全量过滤+词典序排序得三策略全局最优。
- DP 与 BnB：primary/economy/taste 三策略 planKey、nutritionDeviationBp、priceCents 与独立真值 **6/6 全匹配**（planKey 与 T07a 历史值逐字一致）；两响应均未触任何截断（`searchComplete=true`、capsHit/approximations 为空，见 `task1/truncation_and_greedy_check.json`），故对照有效为"精确最优"。
- Greedy：`searchComplete=false` 如实、`APPROXIMATE_CANDIDATES` 标记在、三方案预算内合法；评分独立复算（由方案自身 knownSums 按同一权重公式重算 deviation）**3/3 一致**；响应无任何"最优/精确"声明。未要求 greedy 全局最优，口径正确。
- 反例原始输入输出：未发现缺陷，无反例；全部请求/响应原始 JSON 已存 `task1/`（probe_*.req/resp.json、request_*.json/response_*.json）。

## 4. 任务2｜新配对 native / 真实 WASM null 限额确定性全响应比较

Harness：`task2/run_dual_compare.mjs`（native spawn + WASM 进程内 `loadCore/callApi`，均读本路副本）；断言：`task2/assert_cases.mjs`；原始结果：`task2/dual-compare-summary.json`、`semantic-assertions.json`、`case-*.req/native.resp/wasm.resp.json`。

- 12 个案例（同一请求文件、同 requestId，原始字节直接比较，无归一化字段——两端无任何动态时间字段泄漏，null 限额下输出确定）：
  1. `base-greedy/base-dp/base-branchandbound`：六窗全量（武汉热干面/山东煎饼烤冷面手抓饼/广东肠粉/海南鸡饭/脆皮烤鸭/川湘小厨，三餐 G1/G2/G3，91 技术实体/62 offer，全 estimated 营养）
  2. `budget-1500`（全天预算 1500 分）
  3. `locks`（午餐窗口锁定川湘 + 早餐单品锁定）
  4. `soldout`（午餐热干面、晚餐海南鸡饭售罄）
  5. `activelogs`（早餐已吃：1 已知价+1 未知价项，早餐移出 planningMeals）
  6. `mini-dp`（极小菜单全餐）
  7. `combo-rice-once`（锁定含饭套餐）
  8. `half-rice-same-price`（新增半份米饭 offer，portionRatio 1/2，价同整份）
  9. `unknown-nutrition-auto`（煎蛋四营养素置 null）
  10. `unknown-nutrition-locked`（煎蛋 null 营养 + 手动锁定）
- **字节比较：12/12 全部逐字节一致**（native 与 WASM SHA256 逐案例记录在 summary）。
- 语义断言：**43/43 通过**，要点：
  - 候选覆盖：三餐 46/186/186（三算法一致）；cap256 未截断。
  - 截断标记：DP32 触 `maxDpStates` cap + `APPROXIMATE_DP_STATES` 类近似标记 + `searchComplete=false`；BnB 触 `maxSearchNodes`（observed=200001）+ 三方案均带 `SEARCH_LIMIT_REACHED` flag + diagnostics + `searchComplete=false`；**DP32/BnB 触限结果未被声称证明最优**（响应无 provenOptimal/isOptimal/exact 字段，断言通过）。
  - 预算：三策略全部 `withinBudgetKnownAmounts=true`、`overBudget=false`。
  - 锁定：午餐全部落在锁定的川湘窗口；早餐含被锁 offer。
  - 售罄：无任何方案含售罄菜。
  - 已吃：`intakeSummary` 体现已知小计与价格不完整；已吃餐次出现在 planningMeals 被核心明确拒绝（`INVALID_INPUT`，语义正确）。
  - 套餐米饭只计一次：套餐项 priceCents=1350 含饭总价、无独立米饭项、餐总价=Σ单品价（1550，无隐藏米饭费）。
  - 半份米饭同价：半份 offer 价 100 同整份、`portionCode=half`、营养按 1/2 四舍五入缩放（230→115）。
  - 未知营养：四营养素 null 的菜不进入自动候选池；手动锁定可入且 `incompleteNutrients/unknownItemRefs` 与计划 `flags` 明确标记不完整。
- 合同错误语义顺带实证（均为正确行为）：requestId 含大写/`#`/`+` → `INVALID_INPUT` 逐字提示；`dishes[].nutrition=null`（整对象 null）→ `INVALID_INPUT`（逐营养素 null 才是契约的未知表达）。

## 5. 任务3｜A18 受控时钟三算法语义

Harness：`task3/run_clock_semantics.mjs`；结果：`task3/clock-semantics-results.json` + `clk-*/real-*` 原始请求响应。受控时钟用测试专用 `mp_clock_cli.exe`（MP_TEST_CLOCK 构建，与正式 native 分开，A18_CLOCK_MODE/A18_CLOCK_AFTER 控制），真实时限用正式 `mp_cli.exe`（steady_clock）与真实 WASM（Node `performance.now` 绑定 `env.mp_monotonic_ms`）。

**13/13 通过**：

| 组 | 结果 |
|---|---|
| null 不读取时钟 | 受控 'f'（读即 abort）模式下 null 限额正常完成 3 方案（exit=0）⇒ 全程零读取；WASM 侧注入必抛时钟 + null → ok、3 方案、reads=0 |
| 无完整解前超时 | 受控时钟（A18_CLOCK_AFTER=1, wallClockMs=5）greedy/dp/bnb 三算法均 `ResourceLimited`、0 方案、`wallClockMs` cap、`APPROXIMATE_TIMEOUT`、`searchComplete=false` |
| 首个完整方案后超时 | 正式 native bnb 200ms（六窗全量）→ `OkPartial`、保留 3 完整方案、wallClock cap + `SEARCH_LIMIT_REACHED`/近似标记；真实 WASM bnb 200ms 同语义 |
| 真实正时限（native/WASM 各代表） | native 1ms greedy → `ResourceLimited` 无半方案；WASM 1ms greedy → 同 |
| 坏时钟 | 受控 NaN / 负值 / 倒退 → `INTERNAL_ERROR` 定位 `$.plannerConfig.limits.wallClockMs`（WASM 侧对应行为在 T06e bad-clock 已证，本路未重跑 WASM 坏时钟，见未测项） |

## 6. 缺陷与观察

**确定缺陷：0 条。** 无需反例修复输入。

观察记录（非核心缺陷，供 P01 归集裁量）：

1. **OBS-M01-01（宿主工具，环境特定）**：Node v24.19.0 (win32) 以 CLI 方式 spawn `host_wasm.mjs` 在个别快速失败响应后进程退出时触发 libuv 断言 `Assertion failed: !(handle->flags & UV_HANDLE_CLOSING), src\win\async.c:94`（exit 3221226505），输出文件已完整写出、内容正确。本路改用进程内 `loadCore/callApi` 复现 12/12 一致。与核心/WASM 无关；建议后续宿主脚本用进程内调用或降级 Node 复核。
2. **OBS-M01-02（响应字段口径）**：计划项 JSON 不序列化 `locked`/`riceIncluded` 字段（`quantity`/`priceCents`/`nutrition` 等在）；"锁定生效"与"套餐含饭只计一次"只能经 offer 组成与平价口径观察（本路即按此口径断言并通过）。若契约本意含这两个字段则为契约-实现差异，需 P01 按冻结契约裁定，本路不改契约。
3. **OBS-M01-03（测试时钟统计可见性）**：`mp_clock_cli.exe` 的 `clockReads=N` 统计仅在发生 ≥1 次读取时经 atexit 输出；null 场景无该行，需以"读即 abort 模式下正常完成"作零读取证据。属测试工具行为，非产品缺陷。

本路脚本自身曾出现的三类错误（requestId 大写/非法字符、`nutrition:null` 表达、已吃餐次重复规划）均为**探针脚本错误，被核心正确拒绝**，已在本路脚本内修正重跑；未修改任何历史报告/历史脚本。

## 7. 未测范围（如实列出）

- 正式性能测量、A10 资源矩阵、冷/热与连续调用：按卡不跑。
- 微信开发者工具模拟器、红米真机、其他基础库：M02/后续路独占，本路未触 GUI。
- `nutrition-target` / `validate-menu` / `offer-nutrition` 三个非 plan 端点的双端比较：未做（本路双端比较仅覆盖 `plan`）。
- 生产六窗菜单的独立全天穷举：规模 46×186×186 不可人工穷举，独立穷举仅在极小菜单两层完成；生产菜单以"候选覆盖计数 + 截断标记 + 双端一致 + 业务代表案例"覆盖，未做内容级逐项枚举核对。
- WASM 侧坏时钟（NaN/负值/倒退）注入：本路未重跑（T06e `tools/bad-clock-check.mjs` 已有证据，其引用路径为生产 core 而非本路副本；如需本路副本复跑可由后续路执行）。
- 任意巨大合法输入固定毫秒超调上界：A18 裁定中已列未证项，本路未测。
- BnB 200000 节点内存峰值：未测（T04A17 已有恒定 2490368B/38 页证据，本卡未要求）。

## 8. 主要命令记录

```bash
# 身份
node tools/miniprogram/candidate-manifest.mjs
sha256sum miniprogram/src/assets/wasm/mp_core.wasm core/src/planner.cpp \
  "Resources/报告/T06e-ZCode-最终核心汇合-证据-v2/candidate/build/native/mp_cli.exe"
# 独立副本运行（全部指向 …/T08M01-ZCode-算法终验-证据-v1/candidate/…）
python task1/layer1_content_probe.py
python task1/two_layer/run_two_layer_oracle.py
node task2/run_dual_compare.mjs && node task2/assert_cases.mjs
node task3/run_clock_semantics.mjs
# 时钟 CLI 示例
A18_CLOCK_AFTER=1 candidate/build/native/mp_clock_cli.exe plan <req> --out <resp>   # wallClockMs=5
```

每核心子进程 25 秒外部上限已设于各 harness；所有耗时仅诊断记录，不作性能结论。

## 9. 结论

固定身份无漂移；任务1（独立两层含内容级 40/40、2250 组穷举最优对照 6/6、greedy 评分/合法性/近似口径）、任务2（native/WASM null 限额 12/12 逐字节一致 + 43/43 语义断言，DP32/BnB 截断如实标记未称最优）、任务3（受控时钟 13/13）全部通过。**0 确定缺陷，3 条观察记录。** 原生与 WASM 各自运行结果均逐项列出如上；未测范围见 §7。本路未修改生产、历史报告、其他副本与任何契约/期待值。

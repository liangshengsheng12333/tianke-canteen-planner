# T05N02 · DSH · 正式核心与自选营养接合 · 交付反馈 v1

| 项 | 值 |
| --- | --- |
| 任务卡 | `Resources\任务提示词\T05N02-DSH-正式核心与自选营养接合-v1.md` |
| 日期 | 2026-10-23（Asia/Shanghai，本地时间 10:57–11:32） |
| 角色 | DSH 前端写入者（生产小程序 `miniprogram/`） |
| 请求模型 | DeepSeek V4.1 Flash |
| 实际模型 | `deepseek-v4.1-flash-1017` |
| 服务器侧模型/档位 | 未知（客户端未回传） |
| 结论 | **完成**（自选营养闭环 + 统一核心接入 + 既有入口冒烟；含 1 项经用户放行的范围扩展，见 §5.1） |

> 证据目录：`Resources\报告\T05N02-DSH-正式核心与自选营养接合-证据-v1\`（索引见其 `README.md`）。
> 本文所有“模拟器”结论均来自 **WeChat DevTools 模拟器（simulator）**，**不是真机**；模拟器本地存储是隔离测试态，不是生产/用户记录。

## 1. 开工门槛与输入身份

| 输入 | 身份（实测） | 接收依据 |
| --- | --- | --- |
| A11 统一核心 WASM | `107,472 B` / `B53C7405A643E8409071ED76D3CB4CCBDF1A37E6E5C408CE1D4A373D4CC00744` | `T04A11-T03c5c9-P01-接收与接续裁定-20261023-v1.md` 第 9 行「接收T04A11隔离原生/WASM产物为T05N02开发输入」、第 13 行「两项前置均满足」 |
| A11 原生 CLI | `372,224 B` / `F004C533BE759618E80873A8760AD20F4EDA4AB0BC796E1D79EE3DA2C75C43B5` | 同上；仅用于逐字节对照，不进入小程序包 |
| N01a 实验前端 | 75 文件 / 867,814 B / `sha256:406fe0c8…`（P01 登记值） | `T04A10a-T05N01a-P01-接收与后续放行-20261023-v1.md` 第 8 行「N01a接收为前端接合输入」，A11 同裁定第 13 行追认 |
| 生产基线（写前） | 75 文件 / 817,080 B / `sha256:16c2b29a593322efa1106f935ab14a16f3b23ae898603a8d439f54bcd0ec42f1`；包内 WASM `72,881 B` / `715CD7701B64D8F493A110C348B5F643979536578C7380C29837E05C4F31D52C` | 与 M01 已接收基线一致；独立审计 `audit/input-audit/` 现场复算同值 |
| 8 文件基线哈希 | 8/8 与 N01a `file-hashes.json` 一致 | 同上 |

门槛判定：A11 已收、N01a 已收、无第二名生产写入者（审计 E 项“并发写入者”经核即本卡写入者本人，同一会话同一写入流），可以开工。

## 2. 交付：生产写入清单（基线 → 交付）

写入路径仅 `miniprogram/src` 下 9 个文件；`miniprogram/src` 之外、`core/`、`tools/`、`tests/`、菜单数据、`MEMORY/` 均未写入。

| 文件 | 字节（前→后） | sha256（前 → 后） |
| --- | --- | --- |
| `assets/wasm/mp_core.wasm` | 72,881 → 107,472 | `715cd770…f31d52c` → `b53c7405…4cc00744` |
| `utils/core-runtime.ts` | 3,015 → 3,202 | `f3a36bf4…0d7cc10e` → `12eece8d…4a238669` |
| `utils/core-bridge.ts` | 11,309 → 11,645 | `75969a1f…7a9704` → `f5eb667c…a28ac` |
| `domain/types.ts` | 19,129 → 20,334 | `bb33c622…b256b7d` → `c503bdd8…06de70` |
| `domain/self-pick.ts` | 24,904 → 32,161 | `45f2851c…3e4c33` → `f198c688…2d5f83` |
| `domain/store.ts` | 94,022 → 98,424 | `d76caab5…83b8e8` → `c5d3a051…5bfb` |
| `domain/plan.ts`（§5.1 用户放行） | 38,721 → 38,814 | `ca3eb4cf…0c1a8` → `57d3496e…2f29` |
| `pages/self-pick/index.ts` | 16,472 → 18,052 | `68ea208e…89292c` → `6eb660c6…f09196` |
| `pages/self-pick/index.wxml` | 7,568 → 7,835 | `606e4429…777596` → `93a41ff9…e43a8` |

- 整树摘要：`sha256:16c2b29a…42f1`（75/817,080）→ `sha256:44996b06b1a553df106b6b3c1eefa5e47273e409ee923267adee5117e58d6642`（75/866,998）；官方 `candidate-manifest.mjs` 对 sourceTreeDigest 取值一致。
- 最小性：基线↔交付逐文件比对 **恰 9 文件不同、66 文件逐字节相同**（`manifests/changed-files.json`）；暂存树与生产 **75/75 逐字节相同**；N01a 实验树↔交付 **只差 3 文件**（A11 WASM、`core-runtime.ts` 身份、`plan.ts` limits），未整包拷贝实验树。
- WASM 接入路径：`miniprogram/src/assets/wasm/mp_core.wasm`，与 A11 已接收二进制同尺寸同哈希；`core-runtime.ts` 的 `WASM_IDENTITY` 同步为 `{bytes:107472, sha256:B53C7405…00744}`，运行期校验通过（离线检查 `runtime.wasmIdentityMatches=true`）。

## 3. 实现要点（沿用 N01/N01a 语义，不新增第二套营养计算）

1. `utils/core-bridge.ts` / `core-runtime.ts`：单例加载 + 结果块协议 `[payloadLen][reserved][JSON][NUL]`；输入 `mp_alloc` 一次、调用后 `mp_free` 一次；输出拷贝后 `mp_free` 一次；`mp_contract_version` 静态指针不释放。
2. `domain/self-pick.ts`：自选页每个 Offer 的单份营养只来自 `mp_offer_nutrition`（一次请求带全部 offerIds，响应保持请求顺序）；`null=未知`、`0=已知零`、`estimated` 透传；套餐组件按 `ComboComponent{dishId,count}` 显示为「菜名×数量」。
3. `domain/store.ts`：确认记餐快照写入记录（含 offer/数量/单份营养/组件标签），重复确认以确认令牌幂等；记录页只读快照，不按新菜单重算。
4. `pages/self-pick/*`：选择真实 Offer/数量 → 预览本餐（已知合计 + 未知项单列）→ 确认记餐；未知不上屏成 0，不显示 `[object Object]`。
5. `domain/plan.ts`：统一核心要求 `plannerConfig.limits` 必填且只收契约 §4 四字段，改为固定发送 `{maxMealCandidatesPerMeal:64,maxDpStates:20000,maxSearchNodes:200000,wallClockMs:null}`（原旧 T02 别名 `maxCandidates/maxNodes` 会被核心拒绝）。

## 4. 验证结果（全部落盘于证据目录）

### 4.1 类型检查（生产源码）

`node tools/miniprogram/typecheck-src.mjs`：wechat-devtools TypeScript 4.1.2 **0 errors / 38 files**；antigravity TypeScript 5.9.3 **0 errors / 38 files**（`typecheck/typecheck-result.txt`）。

### 4.2 离线链路检查（生产包内 A11 WASM，Node 宿主）

`verify/run-offline-checks.mjs --src <生产 src>`：**60/60 通过**，0 失败（`offline/offline-checks.json`）。覆盖：WASM 身份与 9 导出/0 导入、结果块协议、释放一次、A04 offer 用例逐字节、数量缩放、零/部分未知、套餐（含 count=2）、真实/测试菜单校验、`runtime.wasmIdentityMatches`。

### 4.3 微信开发者工具「模拟器」全流程（26/26 断言通过）

`simulator/sim-summary.json|.md`，截图 `sim-*.jpg`。关键实测：

| 断言 | 实测值 |
| --- | --- |
| 自选页每行显示统一核心单份营养 | 米饭整份 `232 千卡…`、半份 `116…`、鸡胸 `约 165…（估算）`、青菜 `80…`、部分未知 `约 0 千卡 · 蛋白待补全 · 脂肪 0g · 碳水待补全` |
| 套餐真实组件名+数量 | `清蒸鸡胸×2、清炒青菜×1`（count=2 正确显示 ×2，无 `[object Object]`） |
| 部分未知不按 0 计算 | `已知合计 能量 0 千卡 · 蛋白质待补全 · 脂肪 0g · 碳水待补全（未知项不按 0 计算）` |
| 数量加权预览（半份 1 + 鸡胸 2 + 双拼套餐 1） | `能量 856 千卡 · 蛋白质 128.2g · 脂肪 19.7g · 碳水 31.8g`，已知总价 ￥35.00 |
| 确认记餐 | 记录 `rec-mvkeolnm-selfpick`，3 项快照（含 `清蒸鸡胸 ×2`） |
| 重复确认幂等 | 两次均 `duplicate=true`、同一 recordId、**有效午餐记录仍为 1 条** |
| 记录页/首页回看 | 记录页快照可回看；首页已吃 `856 kcal / 128.2 g / 19.7 g / 31.8 g`，无未知项 |
| 换餐次 | 晚餐/早餐自选页同核心取单份营养正常 |
| 既有目标入口 | 档案保存后 `computeTarget` → `status=Ok` |
| 既有规划入口 | 内置模拟菜单（`comboRules=[]`）：`refreshPlan` → `status=OkPartial`、`planKey=plan:a267a85b2154cac9cd0fe1b061ebcd09f5015c3a17d25ffb0913f41efd00e950`，首页 `planStatus=OkPartial`；真实 PlanRequest 含规范四字段 limits |
| TEST 菜单（含 1 条套餐规则） | 前端能力门按设计拒绝规划：`当前只支持 comboRules=[]，菜单含 1 条套餐规则`（不是 WASM 回归） |
| 真实「西一食堂」菜单 | 导入/替换可用（35 菜 35 报价 5 窗口 0 套餐规则）；自选页营养全部 `营养待补全（核心没有该报价的已知单份数值）`，无测试假值；预览 `四项均待补全`；规划返回 `NutritionDataInsufficient`（不假称达标，正确语义） |
| 关窗重开 | 记录与首页汇总仍在（本地存储恢复） |
| console | `grep -i error` 空 |

### 4.4 三规划算法请求（生产 A11 WASM + A11 native 逐字节对照）

用 App 真实 PlanRequest（`algorithms/request-from-app.json`）分别跑 greedy / dp / branchAndBound：均 `ok=true, status=OkPartial`，响应 `algorithm` 与请求一致；同请求交 A11 `mp_cli.exe`，**响应载荷去掉尾随换行后逐字节一致**（3/3，`algorithms/native-wasm-compare.json`）。另 `validate-menu` 用例 `valid=true`（`menu-t04a04-v1`，1 窗口/6 菜/8 报价/1 套餐规则）。此项为 Node 宿主 ABI 冒烟，**不是**模拟器/真机证据。

### 4.5 独立复核（队友，只读 D:，证据已并入 `audit/`）

- **WASM 审计 12/12 PASS**：9 导出/0 导入、api_version=1、contract_version="1.0"、A04 offer 用例 10/10 逐字节、count=2 套餐 `410/640/122/60` 一致、plan/nutrition-target/validate-menu 3/3 与原生一致、105 次调用各释放一次、堆高水位约 50 页 ≈3.1 MiB（非阻塞观察）。
- **输入审计 15/16 PASS**：门槛、A11/N01a 身份、生产基线、8 文件哈希与 patch 范围全部现场复算一致；E 项“并发写入者”经核即本卡写入者，不构成双写冲突。审计提示的 S2（当前生产非基线，基线对照用 `before/`）与 S3（`tools/miniprogram/test-self-pick.mjs` 旧“营养恒 null”断言不在本卡写范围）已按 §5/§6 处理。

## 5. 范围与偏差（需 P01 知悉/追认）

### 5.1 唯一超默认写范围的文件：`domain/plan.ts`（用户已放行）

接入 A11 后实测发现：旧前端按 T02 口径只在用户显式配置时才发 `plannerConfig.limits{maxCandidates,maxNodes}`，而 A11 要求四字段必填且拒绝旧别名 → 同一请求在 A04/A11 均 `INVALID_INPUT $.plannerConfig.limits`，旧生产 WASM 则接受（所以此前未暴露）。由于首页规划入口“继续可用”是本卡验收项，且该改动落在默认写范围之外的 `plan.ts`，已按卡内要求向派单人（用户）说明阻塞与最小范围，**获得选项 A 放行**后仅改 1 个文件、约 10 行（固定发送契约四字段，不新增兼容别名、不引入第二套限额逻辑）。请 P01 追认该文件列入本卡写范围，或转 T06 统一迁移时一并接管（`settings.limits` 旧形状此后不再发送；当前无 UI 设置该值）。

### 5.2 未改动但需 P01 安排

1. `tools/miniprogram/candidate-manifest.mjs` 的 `FROZEN_WASM` 仍是已退役 T02 值（72,881 B/`715CD770…`），换 A11 后脚本报 `frozenWasmMatches:false` 并 exit 1；脚本不在写范围，候选冻结身份需 P01 同步。
2. `miniprogram/src/mock/simulated-inputs.ts` 开发夹具是旧契约快照（缺 limits 四字段），A04 与 A11 对其报同一 `INVALID_INPUT`，属既有夹具漂移，与本卡无关。
3. `tools/miniprogram/test-self-pick.mjs` 仍含“营养恒 null”旧断言（28,704 B/`62C75D23D4B9BA44E06085EC159719A2C42BFB73CD1384E5B7FE901229E59B04`，本卡未改），需 P01 定验收口径。

### 5.3 测试态说明

模拟器流程开始时调用了应用内既有 `resetLocalData()` 并导入 T05N01a TEST 菜单（标注“不是真实食堂”），结束时换回真实「西一食堂」菜单；这些只作用于 **DevTools 模拟器本地存储**，未触碰任何生产/用户数据文件，也未执行真机或云端清库。

## 6. 未测项 / 限制

- 未做真机验证；未做性能/内存专项测量（仅记录 WASM 堆高水位约 3.1 MiB 的非阻塞观察）。
- 未跑全量矩阵/无关回归（按卡内要求只做最小冒烟）；套餐规则组合（`comboRules≠[]`）的自动规划仍被前端能力门拦截，未在本卡展开。
- 未验证多日/跨日、导入恢复失败、售罄/锁菜等 T06 全流程场景。
- dp/branchAndBound 只做了 ABI 级请求冒烟与原生对照，UI 仍固定 greedy（沿用既有设计）。

## 7. 阻塞

无。生产可写、A11/N01a 输入齐备、必要检查全部通过；唯一需 P01 处理的是 §5.1 的写范围追认与 §5.2 的工具性缺口。

## 8. 交付物

- 生产前端：`miniprogram/src`（9 文件，见 §2）
- 证据目录：`Resources\报告\T05N02-DSH-正式核心与自选营养接合-证据-v1\`（`README.md` 为索引；含 `before/after/manifests/typecheck/offline/simulator/algorithms/audit/scripts`，共 150+ 文件，复算脚本已随目录保存）
- 本反馈：本文件（唯一交付反馈）
# T06e｜ZCode GLM5.3｜最终核心与提示统一汇合｜交付反馈 v2

| 项 | 内容 |
|---|---|
| 主任务卡 | `Resources/任务卡/T06e-ZCode-最终核心与提示统一汇合执行卡-v2.md` |
| 定位 | A16 memory-only + A18 真实时限核心 + T08L/addManualLog 提示统一的隔离汇合、微信宿主门槛检查与条件推广（单人串行单写入） |
| 执行 | GLM5.3 单一执行员（本会话），全程串行，无子代理；生产推广仅收尾一次 |
| 请求模型 / 实际 | 请求 ZCode GLM 5.3；客户端标识 `account:zai-start-plan/GLM-5.3`；服务端路由/档位未知 |
| 证据目录 | `Resources/报告/T06e-ZCode-最终核心汇合-证据-v2/`（candidate/ wechat-project/ tools/ scripts/ tests/ logs/ shots/ manifest-*/ backup-生产2871-20261025/） |
| 状态 | **开发候选已推广为新生产；微信开发者工具模拟器门槛全过；真机/P09/正式性能矩阵未做，不称最终验收通过** |

---

## 1. 身份（推广前后对照）

| 项 | 推广前（备份留证） | 推广后（当前生产） |
|---|---|---|
| 源码树摘要 | `sha256:2871b4cad6cf801eeb27291c9eb291b3227d0adcf4c6a3270d40e9e34b3441a1`（75src/1004620B、45tools/649145B） | `sha256:97c8085ce2817c339455a21be53ed01308c1d570ff3781511bddc39c39b13123`（75src/1008941B、45tools/649308B） |
| 包内 WASM | 107936B / `304FED66…DA370E8`（A15） | **111521B / `8A817926BDE039B74672FA17974323574AEBDB2B41FD8D9815B0E11BFF3A4AD8`**（A16+A18 核心），manifest `frozenWasmMatches=true` |
| WASM import ABI | 零 import（空对象实例化） | **新增必需 `env.mp_monotonic_ms: () -> f64`**；空 imports 实例化被拒（实测见 §3） |
| core/src/planner.cpp | 2871 版 | `109555b9…ece69`（= A18 identity 清单逐字节） |
| 域 store.ts | 2871 版 | `a4e9e670…805aa`（2871 + T08L 两行 + addManualLog 同口径一行） |
| native CLI（仅证据目录） | — | 382464B / `c86461c7a9b108dd9e616a19a6b14f0fdd93bf5d4f4c5f41e1e2d4a69a3c5fad`；测试时钟 CLI 384000B / `d7b53569…d29bc` |
| 菜单 | 未触碰：内置 west1 菜单 123646B / `54B77216…032E7` 与 catalogHash 原样（test-t05-menu-default 69/69 内断言） | 同左 |
| 候选/生产一致性 | — | 推广后 core、tools/core、tools/miniprogram、miniprogram/src 四子树与候选**逐文件逐字节一致**；manifest 复算两侧相同 |

### 输入身份核验（开工实算，全部与卡/裁定一致）

- A16 `memory-lifetime.patch` 12841B / `62829b23…15f41e`；A18 `combined.patch` 38946B / `8ca8845c…c96a73`；T08L `T08L-editlog-message.patch` 981B / `21870e4c…57030`。
- A18 新 WASM / native / 测试 CLI / `A18-ABI.md` 与其 `identity.json` 逐项相等；identity 中 8 个 core/host 源文件全部与磁盘一致。
- 推广前生产 manifest 复算 = `2871b4ca…`，与 P01 裁定一致。

## 2. 候选构建（补丁链，未重复叠补丁）

1. 从生产 2871 必要副本建 `candidate/`（core + miniprogram + tools 全树）。
2. `git apply`（autocrlf=false）先 A16 memory-lifetime → 再 A18 combined（core-clock 相对 memory-only 参考 + host-clock 相对 2871 宿主），两步 `--check` 干净通过。
3. **8 个补丁文件与 A18 `identity.json` 逐字节相等**（core 5 文件 + bridge/runtime/host_wasm 3 文件），未采用 A17 无时钟 14ABEF 核心，未混 A16 拒绝的非空 guard。
4. 复制 `core/wasm/A18-ABI.md`（1448B/`02e41355…`）与 A18 已核产物（WASM 入包，native/测试 CLI 仅证据目录，未重新编译）。
5. T08L 补丁干净套用（store.ts 改记两行 →『已知价格无效：必须是非负整数（分），且不超过 ￥1,000,000.00』）；**addManualLog 同类超限提示（store.ts:1088）同口径统一**，仅该一行字符串，金额常量/业务事务未改。
6. 活跃身份同步：`candidate-manifest.mjs` FROZEN_WASM、`t05-test-helpers.mjs` WASM_EXPECTED_*、7 个测试文件的当前版本身份期待（menu-default / t06c-unified / verify-integration / t05-store / soldout-scope / a01a / a01b），旧 304FED66/107936 引用全树清零；历史报告与旧基线未替换。

推广清单 20 文件（`promoted-files.json` 逐文件哈希）：core 5 改 + A18-ABI.md 新增；`tools/core/host_wasm.mjs`；miniprogram 4（WASM、store.ts、core-bridge.ts、core-runtime.ts）；tools/miniprogram 9。

## 3. 微信宿主门槛（本卡关键新增证据，先做且通过）

专用微信工具项目 `wechat-project/miniprogram` = 候选副本 + 唯一新增惰性夹具 `src/assets/t06e-base-req.json`（102914B 六窗全量请求，未注册未引用；与候选源码 diff 仅此一件 + IDE 已知 projectname 再编码副作用）。微信开发者工具 2.02（skill v0.3.11，登录用户"凉笙"，自动化客户端 T06e，导入 winId s5，基础库 3.17.4，清存储后首开）。逐项结果（原始 JSON 全在 `logs/wx-*.json`，汇总 `logs/wechat-gate-summary.json`）：

1. **实际编译加载 111521B 新产物**：模拟器编译通过、pages/home 首开正常；运行时 `getFileSystemManager().readFileSync('/assets/wasm/mp_core.wasm')` 实读 111521B，FNV-1a64 正向 `2558ca13c80a978f` / 反向 `970178bb74c527f`，与主机侧对新产物磁盘文件计算逐位一致 ⇒ 实际提供的是新核心，非旧缓存。
2. **import 可绑定且必须绑定**：`WXWebAssembly.instantiate(path,{})` 空 imports **拒绝实例化**（`Import #0 "env": module is not an object or function`）；绑定 `{env:{mp_monotonic_ms}}` 成功，原 8 导出齐全（mp_api_version/mp_contract_version/mp_alloc/mp_free/mp_plan/mp_nutrition_target/mp_validate_menu/mp_offer_nutrition）。
3. **单调毫秒源实际探测（不猜类型、不用 Date.now/节点数）**：
   - `globalThis.performance.now`：存在、可调用、有限非负；忙等 ~120ms 递增 147.20ms（Date.now 同窗 147ms）⇒ **毫秒单位**；A18 core-runtime 默认 `platformMonotonicClockMs` 即此源，本环境实测存在，**无需注入**。
   - `wx.getPerformance()`：存在且返回对象含 `now`（可调用，忙等 126.07ms/126ms 吻合毫秒；绝对值 epoch 毫秒基准）。仅记录事实，未据此改默认适配。
4. **null 零时钟读取**：注入"必抛异常"时钟 + `wallClockMs=null` 全量请求 → OkPartial、3 方案、候选 46/186/186、**clockReads=0**。
5. **正限额真实触发与完整解/无完整解语义**（时钟=已核实 performance.now）：
   - greedy/dp/bnb 各 1ms → ResourceLimited、0 方案、wallClockMs capsHit observed=1、APPROXIMATE_TIMEOUT、searchComplete=false（无完整解不输出半方案、不称 NoFeasible）。
   - **bnb 200ms → OkPartial、保留 3 完整方案 + wallClockMs cap + APPROXIMATE_TIMEOUT + searchComplete=false**（超时已有合法完整方案→保留并明确近似）。
   - greedy 2000ms → 3 完整方案正常完成（无 time cap）；greedy 50ms → 该机较慢未及完成，正确走 ResourceLimited；dp 50ms → maxDpStates 与 wallClockMs **双限额同时可见**。
6. **null 常规 UI 可用**：真实输入建档（男/22/172/65）→ 目标经真实 WASM 计算 Ok（2511 千卡/BMI 22.0，与 T08J01 同口径同值）→ 首页生成 3 方案（应用默认 wallClockMs=null 的 mp_plan 全链路，`planStatusShort=已就绪`），全程无 console error；截图 `shots/wx-home-plan.png`。
7. 实际求解时限与 JS 外部保护分开：以上均为核心协作式 deadline；25 秒硬终止仅回归脚本的进程保护。

**边界（如实）**：以上是微信开发者工具**模拟器**（基础库 3.17.4、devtools 平台）证据；红米真机/其他基础库未测，wx.getPerformance().now 的真机可用性未验，留给集中验证。工具项目窗口已 `close_project_window` 关闭。

## 4. 必要回归（全绿；长跑各自独立进程、串行）

| 组 | 结果 |
|---|---|
| TS 全量类型检查（typecheck-src.mjs，完整 UI 树） | TS 4.1.2 **0 errors/38 files**；TS 5.9.3 **0 errors/38 files** |
| null 确定性（候选 WASM） | 三算法各 2 次运行**逐字节一致**，且 requestId 归一化后**与 A18 冻结 null_wasm 响应逐字节一致**（greedy `df5ea94b…`/dp `50bf0d66…`/bnb `c1e748c6…`） |
| 三算法 null 全量请求 | OkPartial×3、3 方案、候选 46/186/186（cap256 无截断）；DP32 触 maxDpStates、BnB 200000 节点触限语义与既有基线一致 |
| A18 超时行为（Node 真实 performance.now + native 真实 steady_clock） | WASM 三算法 1ms 全部 ResourceLimited+wallClock cap；native `mp_cli.exe` 三算法 1ms 同样真实触限 |
| 坏时钟行为 | NaN / 负值 / 倒退 → `INTERNAL_ERROR` 定位 `$.plannerConfig.limits.wallClockMs`；null + 坏时钟 → OkPartial 且 clockReads=0（`logs/bad-clock-results.json`） |
| T08L + addManualLog（本卡脚本 `scripts/t08l-addmanual-verify.mjs`） | **13/13**：改记/补记超 100000000 分拒绝且文案同口径、拒绝后零写入（记录数/修订号不变）、恰好 ￥1,000,000.00 合法、0 分合法、null=明确置未知合法 |
| 业务回归（Node+真实新 WASM） | test-t05-store 28/28、test-t05-menu-default 69/69、verify-t05-integration 17/17、test-self-pick 13/13、test-home-swap-sheet（单菜 UI 冒烟）21/21、test-storage-snapshot 通过、test-t06c-unified 109/109、test-t05-soldout-scope 11/11、test-t05-modules 17/17、dp-chain 13/13、bnb-chain 10/10（BnB 单独进程） |
| H01 金额三路径/幂等/快照（T06d 脚本指向本候选重跑） | h01-after-verify 44/44（含 N3.22/N3.23 断言新统一文案）；场景B（确认预算幂等）41/41；场景C（锁定/售罄/菜单替换）38/38；场景E 12/12 |
| H02 62 日期桶 | r1 整月保留 15/15、r2 planRaw 72h 滑窗 12/12、r3 62 桶收口/备份/旧 state 17/17 |
| 生产收尾冒烟（推广后） | test-t06c-unified 109/109、test-t05-menu-default 69/69；生产 manifest=候选 manifest、WASM 实读 111521/8A817926 |

默认限额未动：cap256、三餐 DP32/单双餐原 K、节点 200000、默认 `wallClock=null`；本卡未自调 K/节点/时间阈值。BnB 内存峰值 ≈347MiB 问题随核心内存生命周期改进已不在本卡复测范围（A17 已证 200000 节点恒定 2490368B/38 页），正式 A10 资源矩阵留给集中验证。

## 5. 推广与回退

- 备份：`backup-生产2871-20261025/`（core/miniprogram/tools 全树 + 备份内 manifest 复算 = `2871b4ca…` 一致、frozenWasm 匹配旧值）。
- 推广方式：**仅逐文件覆盖获批清单 20 文件**（`promoted-files.json` 含逐文件 SHA256），未删除生产目录、未重建 tools；core 空解语义未冒称 NoFeasible（回归断言覆盖）。
- 回退指引：将 `backup-生产2871-20261025/` 的 `core/`、`miniprogram/`、`tools/` 覆盖回项目根即可回到 2871（备份内 manifest 自证）；`core/wasm/A18-ABI.md` 为本卡新增文件，回退时删除该文件。
- 推广后复算：生产 manifest = `sha256:97c8085ce2817c339455a21be53ed01308c1d570ff3781511bddc39c39b13123`（75/1008941B、45/649308B），`frozenWasmMatches=true`；四子树与候选逐文件一致。

## 6. 未测项 / 边界（不伪报）

- 红米真机、其他基础库/微信版本的时钟源与新 import 加载：未测（本卡仅开发者工具模拟器 3.17.4）。
- 正式 A10 性能/资源矩阵、冷热与连续调用、前后台切换：未做（按卡留待新 manifest 后集中验证）。
- P09 总审、最终验收：未做，本卡不称最终验收通过。
- 任意巨大合法输入的固定毫秒超调上界：仍为 A18 裁定中的未证项（协作式 deadline，不承诺硬实时）。
- 微信工具项目内测试数据（示例存储）保留在测试实例，不属真实用户数据。

## 7. 交付物清单（`T06e-ZCode-最终核心汇合-证据-v2/`）

| 项 | 路径 |
|---|---|
| 集成候选（=当前生产） | `candidate/`（含证据专用 build/native、build/wasm 与测试夹具 Resources，均不进生产） |
| 微信专用工具项目 | `wechat-project/miniprogram`（候选副本 + 唯一惰性夹具） |
| 微信门槛证据 | `logs/wx-*.json`（时钟探测/身份/import/null/限额共 11 组原始返回）、`logs/wechat-gate-summary.json`、`shots/wx-home-plan.png`、`shots/desktop-auth.png` |
| 探针与脚本 | `tools/probe-*.js`（单行 evaluate 源）、`tools/wxide.ps1`、`tools/bad-clock-check.mjs`、`scripts/`（T08L 验证 + H01 场景）、`tests/`（H02 三组） |
| 原始回归输出 | `logs/`（smoke/det/bad-clock/native/t08l 等 .req/.resp/.json） |
| 推广记录 | `promoted-files.json`、`manifest-before/`、`manifest-candidate/`、`manifest-after/` |
| 生产备份 | `backup-生产2871-20261025/` |

完成后停写。待 P01 核定唯一新候选（manifest `97c8085c…`）后进入集中性能/算法/真机/P09。

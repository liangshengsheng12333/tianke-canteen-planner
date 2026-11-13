# T08f01-DSH-失效锁定解除-交付反馈-v2

> 任务卡：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\任务卡\T08f01-DSH-失效锁定解除隔离并行小卡-v2.md`
> 缺陷：`DEFECT-T08A1-01`「失效锁定无法解除」（首页点“解除”后旧菜单残留的窗口/菜品锁仍在，`refreshPlan` 持续 `LockConflict`）
> 交付形态：**隔离副本 + 补丁 + 证据**；生产 `miniprogram/src` 全程只读，**未合入生产**。
> 反馈修订：v2（本卡为隔离并行小卡，v1 未产出；本文件是本次唯一反馈）。

## 0. 一页结论

- 根因是**单点漏字段**：`pages/home/index.ts` 的 `applyHome` 把 `HomeView.lockIssues` 映射成页面数据时漏了 `meal`，导致 WXML 清除按钮的 `data-meal="{{item.meal}}"` 取到 `undefined`，真实 handler 调用 `store.toggleWindowLock(undefined)` / `store.toggleItemLock(undefined, offerId)`，本应“删除锁”的 toggle 实际变成“新增锁”，两条失效锁永远解除不掉。
- 修复：在 `lockIssues` 映射里补一行 `meal: issue.meal,`（**+1 行，唯一改动**），把 store/HomeView 里本来就存在、WXML 本来就绑定的 `meal` 正确传到 handler。没有新增兜底分支，没有改 store 的 toggle 语义，没有改 WXML。
- 隔离验证：**before 复现 RED 32/32 断言通过（含 3 条缺陷复现）**；**after GREEN 37/37**（页面上点“解除”后两条失效锁被删除、`lockIssues` 清空、无失败 toast、`refreshPlan` 通过锁定门且 `ok=true`）；**回归 47/47**（正常锁定加解、售罄、结束/重开、刷新方案、同窗换菜、换菜单后正常锁定均不退化）。
- 生产零改动：开工/收尾 `candidate-manifest.mjs` 的 `sourceTreeDigest` 均为 `sha256:d15bbe0e…f19e`，75 文件 / 872,829 B，`frozenWasmMatches=true`。
- 证据边界：以上均为**隔离副本的 Node 离线测试（真实冻结 WASM + mock wx）**，**不是**微信模拟器/真机证据，也**不是**生产已修复的证据。

## 1. 任务卡、基线、cwd 与身份数字

| 项 | 值 |
|---|---|
| 当前 cwd | `D:\项目\cpp` |
| 项目根 | `D:\项目\cpp\Projects\食堂就餐优化系统` |
| 任务卡 | `Resources\任务卡\T08f01-DSH-失效锁定解除隔离并行小卡-v2.md`（已实读） |
| 基线清单 | `Resources\报告\T05U06a2-P01-接收与T08a1候选证据-v1\manifest.json`（只读引用） |
| 基线 `sourceTreeDigest` | `sha256:d15bbe0eb2a73e9eba230c819288e9db180487df4ea1ab7b90516482e290f19e` |
| 基线规模 | 75 文件 / 872,829 B；toolFileCount=38 / toolBytes=447,791 |
| 冻结 WASM | `B53C7405A643E8409071ED76D3CB4CCBDF1A37E6E5C408CE1D4A373D4CC00744`，107,472 B（`frozenWasmMatches=true`） |
| 生产页文件 | `miniprogram/src/pages/home/index.ts` = 31,711 B，sha256 `b4e55e1c8937640f21c0582037a228b3eb6edc43131768e1290acba7673f2644` |
| 候选页文件 | 同路径 = 31,735 B，sha256 `1ce81b8c4ec9c206669740b6e32f20a7662ea5c8186f7394314d4c5b04ab8c3e`（= 生产 + 1 行） |
| 运行环境 | Node v24.19.0（type-stripping + `tools/miniprogram/register-ts.mjs` 解析无扩展名相对导入）；git 2.56.0；Windows |
| 会话身份 | DSH 子代理 `f01-lock`（Team Lead `lead`，共享任务 `task-1`） |

**未执行**（按卡片红线）：`tools/core/build_wasm.ps1`、`build_native.ps1`、`tools/miniprogram/copy-wasm.ps1`、`candidate-manifest.mjs --out`、微信模拟器任何脚本/截图、`git init` 于项目根、联网、装依赖、嵌套子代理。

## 2. 模型：请求 / 可核实 / 未知

- **请求模型（P01 派单指定）**：DeepSeek V4.1 Flash。
- **实际可核实模型（DSH 客户端自报）**：`deepseek-v4.1-flash-1017`。
- **服务端实际子型号/档位**：**未知**（会话内无法核实服务端具体子型号或档位；不把请求配置当实际证明）。
- 未使用内部 sol、未使用 Gemini，未创建子代理。

## 3. 交付文件（绝对路径）

证据目录：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T08f01-DSH-失效锁定解除-证据-v2\`

| 文件 | 用途 |
|---|---|
| `patch.diff` | 生产基线可直接应用的补丁（1 文件 +1 行；489 B） |
| `changed-files.txt` | 改动文件清单（改动前后 sha256 / 字节） |
| `run-before.log` | 修复前复现（RED，32/32） |
| `run-after.log` | 修复后验证（GREEN，37/37） |
| `regression.log` | 回归（47/47） |
| `identity.log` | 开工身份自证（只读 manifest 输出） |
| `production-digest.log` | 收尾生产身份自证（digest 未变） |
| `patch-verify.log` | `git apply --check` / 应用 / 逐字节比对 |
| `sandbox-write-probe.log` | 本会话沙箱写权限探针（解释交付方式） |
| `run-f01.mjs` | before/after 场景测试脚本（含命令注释） |
| `run-regression.mjs` | 回归测试脚本（含命令注释） |
| `candidate\miniprogram\src\pages\home\index.ts` | **权威候选文件**（生产页 + 1 行） |
| `candidate\README.md` | 候选说明与物化方法 |
| `candidate\materialize.mjs` | 把候选物化为完整 75 文件 src 树（已校验） |

生产侧唯一待改文件：`D:\项目\cpp\Projects\食堂就餐优化系统\miniprogram\src\pages\home\index.ts`（当前仍为基线 sha256，未改）。

## 4. 验收逐项状态

卡片要求的 4 个验收场景全部覆盖；逐项如下（证据均在上述证据目录内）。

| # | 验收项 | 状态 | 证据 |
|---|---|---|---|
| A | 场景1：旧菜单建窗口锁+菜品锁 → 切 west1 → 首页 `lockIssues` 显示 2 条（窗口/菜品各 1）且 `planState=lock-conflict` | **PASS** | `run-before.log` L24–33；`run-after.log` L25–34 |
| B | 场景2a（缺陷复现）：点击首页“解除”后两条失效锁仍在（`windowLocks=1 itemLocks=1`、2 次失败 toast、handler 收到 `<undefined>`） | **PASS（RED 复现）** | `run-before.log` L36–42 |
| C | 场景2b（缺陷复现）：死锁存在时 `refreshPlan` 返回 `ok=false status=LockConflict coreCalled=false` | **PASS（RED 复现）** | `run-before.log` L43–44 |
| D | 场景2c（修复后）：用 `lockIssues` 数据触发真实首页 clear handler → 两条失效锁被删除（`lockIssues=0 windowLocks=0 itemLocks=0`、0 toast） | **PASS** | `run-after.log` L34–44 |
| E | 场景3：解除后 `refreshPlan` 通过锁定门并 `ok=true`（west1 上 `status=OkPartial coreCalled=true`；切回 simulated 再 `ok=true`） | **PASS** | `run-after.log` L45–51 |
| F | 场景4：正常窗口锁/菜品锁的首页加/解不回归（含合法锁不产生假 `lockIssues`） | **PASS** | `regression.log` L15–22（simulated）、L43–49（west1） |
| G | 回归：售罄与锁定互斥、结束/重开、刷新方案、同窗换菜 | **PASS** | `regression.log` L23–38 |
| H | 生产零改动（只读自证） | **PASS** | `identity.log`、`production-digest.log`（digest 相同） |
| I | 补丁可应用且结果等于候选 | **PASS** | `patch-verify.log`：`gitApplyCheckExitCode=0`、`evidenceAppliedSha256=1ce81b8c…`、`nonPageFilesIdenticalAfterApply=74/74` |
| J | 候选完整 75 文件树在证据目录内直接物化 | **未测（沙箱限制）** | `materialize.mjs` 在同一会话用 temp 目标验证 PASS（75 文件、74/74 一致、WASM 冻结），但 `Resources\报告` 对本会话 pwsh/node 只读（见 `sandbox-write-probe.log`） |
| K | WXML 渲染、真实 touch 事件、微信模拟器/真机 | **未测（本卡禁止/不属出口）** | 本卡明确不碰模拟器；WXML 未改动（按钮 `data-meal="{{item.meal}}"` 已存在） |
| L | 其他页面/月历/自选菜等行为 | **未测（不在范围）** | 其余 74 个 src 文件与生产逐字节一致，未改逻辑 |

测试计数口径：**before = 32/32 断言通过（3 类缺陷复现断言全部 PASS，整体判 RED）**；**after = 37/37**；**regression = 47/47**。没有用 `--test` 跑页面模块。

复跑命令（项目根下，注意用相对 `--import` 路径，绝对 Windows 路径会触发 `ERR_UNSUPPORTED_ESM_URL_SCHEME`）：

```powershell
cd "D:\项目\cpp\Projects\食堂就餐优化系统"
$ev = "D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T08f01-DSH-失效锁定解除-证据-v2"
node --import "./tools/miniprogram/register-ts.mjs" "$ev\run-f01.mjs" before
node --import "./tools/miniprogram/register-ts.mjs" "$ev\run-f01.mjs" after
node --import "./tools/miniprogram/register-ts.mjs" "$ev\run-regression.mjs"
```

## 5. 根因与为什么不是防御性补丁

**根因（单点数据断链）**

1. 菜单切换保留旧锁定：`store.applyMenu/preflightMenu`（`domain/store.ts`）在切换菜单时不清理已有 `windowLocks/itemLocks`，这些旧 ID 在新菜单里成为失效锁，`domain/plan.ts:validateLocks` 产出 `LockIssue{kind,meal,label,reason,windowId?,offerId?}`，`getHomeView()` 把 `lockIssues`（含 `meal`）交给页面，`planState=lock-conflict`。
2. 页面映射丢字段：`pages/home/index.ts` 的 `applyHome`（约 263–273 行）把每条 issue 映射为 `{index, kind, kindLabel, mealLabel, reason, offerId, windowId}`——**唯独漏了 `meal`**。
3. WXML 依赖该字段：`pages/home/index.wxml`（约 234–247 行）清除按钮绑定 `data-meal="{{item.meal}}"`，缺字段时 dataset 为 `undefined`。
4. handler 无兜底（也不该有）：`onClearWindowLockIssue` / `onClearItemLockIssue`（约 713–722 行）直接 `e.currentTarget.dataset.meal as Meal` 并调用 `store.toggleWindowLock(meal)` / `store.toggleItemLock(meal, offerId)`；`meal=undefined` 时 toggle 的“存在则删、不存在则加”语义变成**新增**一条无效锁，于是旧失效锁纹丝不动、页面弹失败 toast、`refreshPlan` 被锁定门挡回 `LockConflict`，用户无法自救。

**为什么这是根因修复，而不是防御性编程**

- `meal` 在数据源里**本来就存在**（`HomeView.lockIssues` 带 `meal`；WXML 也早已按 `item.meal` 绑定），唯一断点在“页面映射”这一层。补 `meal: issue.meal,` 是让真实数据按既有正常路径流动，不是给缺失值加备用逻辑。
- 若改在 handler 里加 `|| this.data.activeMeal` 兜底：会掩盖映射 bug，而且 `lockIssues` 可能同时包含不同餐次的锁，用当前浏览餐次兜底会**解除错误餐次的锁**，是更危险的假修复。
- 若改 store 的 toggle 语义（例如 undefined 时 no-op）：会改动被多处依赖的既有语义，且仍留下页面数据缺字段的问题。
- 因此选择最小、单点、可验证的 +1 行；不新增分支、不新增接口、不改 WXML、不改 wasm。

## 6. 证据边界声明（必读）

- 本反馈中的全部运行证据来自**隔离副本的 Node 离线测试**：生产 `miniprogram/src` 全量复制到系统临时目录（`<os.tmpdir()>/dsh-t08f01/run-<variant>/miniprogram/src`），覆盖候选页文件后逐文件 SHA-256 校验（75 文件；74/74 非页文件与生产一致；页文件等于候选；WASM 为冻结身份），再从该隔离树 import `store`/页面模块（日志中 `loadedPageFile`/`module URL` 可核），并使用 **mock wx**（`tools/miniprogram/t05-test-helpers.mjs` 的 `createMockWx`）与**真实冻结 WASM** 实例化。
- **这不是微信模拟器证据，也不是真机证据**；本卡不碰模拟器（另一窗口在跑 T08c1 巡检），未截图。
- **生产未被修改**：本卡没有对 `miniprogram/src`、`tools`、`core`、`MEMORY`、任务卡或任何生产文件执行写操作；收尾 `candidate-manifest.mjs` 复跑 `sourceTreeDigest` 仍为 `sha256:d15bbe0e…f19e`（75/872,829，`frozenWasmMatches=true`），见 `production-digest.log`。
- 因此本反馈**不能**被读作“生产已修复”。生产修复需要整合窗口应用 `patch.diff` 并重新验证。

## 7. 已知限制、阻碍与下一步（给整合窗口 f05）

**限制/阻碍**

1. **沙箱写权限**：本会话 Windows 沙箱下 pwsh/node 对 `Resources\报告` 只读（ACL 阻断，`sandbox-write-probe.log`），证据目录内文件只能由 DSH fs 工具写入。因此 `candidate/` 只保存**唯一改动文件**（权威），完整运行树由测试脚本每次在 temp 物化；若需在证据目录内落完整 75 文件树，请在可写会话执行 `candidate/materialize.mjs`（脚本已在 temp 目标验证通过）。
2. **补丁文件末尾**：fs 写入工具不保留文件末尾换行，纯 diff 会被 git 判 `corrupt patch`，故 `patch.diff` 末尾附一行 `--`（mail 签名，git apply 忽略）；`git apply --check` / `git apply` 均已验证 `exit 0` 且结果 sha 等于候选（`patch-verify.log`）。
3. **测试面**：未覆盖 WXML 渲染层、真实 touch 事件分发、模拟器/真机；数据来自 `simulated-menu` 与 `west1-menu` 配置，非真实供应。
4. **交互语义（既有 toggle）**：`onClear*Issue` 复用 toggle；修复后点击一次即删除对应失效锁；若用户基于旧数据快照重复点击同一按钮，会按 toggle 语义重新加锁——这是既有交互语义，不属本缺陷；同一餐多条失效锁需逐条解除（与现有 UI 一致）。
5. **未触碰**：build/wasm 重建、模拟器、其他任务证据目录、`candidate-manifest --out`；无联网、无依赖变更、无子代理。
6. **时间来源**：测试时钟固定从 `2026-10-23T12:00:00+08:00` 起推进（用于模拟餐次时段），实际设备时区/日期行为未测。

**下一步（f05 整合窗口）**

1. 用 `patch.diff` 应用生产（`git apply --check` → `git apply`），或直接把 `candidate\miniprogram\src\pages\home\index.ts` 覆盖到生产页；改动应为 1 文件 +1 行。
2. 在微信模拟器/真机验证首页：旧菜单建窗口/菜品锁 → 切 west1 → 首页出现 2 条失效锁 → 点“解除”后两条消失、无失败 toast、`refreshPlan` 可成功；正常锁定加/解、售罄、换菜不受影响。
3. 建议把本卡场景固化为仓库内回归用例（`run-f01.mjs` 可作为蓝本，替换 mock 为仓库既有测试风格）。
4. 若需 UI 截图/模拟器证据，由具备权限的窗口补测并在整合报告中单列；本卡不冒充该证据。
5. 发布前按正常流程重建/校验产物（本卡遵守冻结基线，未做 build）。

## 8. 结论

在**隔离副本**中，`DEFECT-T08A1-01` 的根因已定位并修复：`applyHome` 的 `lockIssues` 映射补 `meal`（+1 行），首页“解除”按钮能真正删除旧菜单残留的窗口/菜品失效锁，`lock-conflict` 消失，`refreshPlan` 恢复可重算；正常锁定加解与既有业务行为回归通过。补丁经 `git apply` 校验，应用结果与候选逐字节一致。

**生产尚未修复**：需由整合窗口 f05 应用补丁并在模拟器/真机复核后才能宣告完成。本反馈所有证据均为隔离 Node 离线测试，不是模拟器/真机证据。
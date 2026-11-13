# T06a2｜DSH｜旧测试入口与 A11 身份对齐 · 交付反馈 v1

| 项 | 值 |
| --- | --- |
| 任务卡 | `Resources\任务卡\T06a2-DSH-旧测试入口与A11身份对齐小卡-v1.md`（用户 2026-10-23 单独转交 DSH） |
| 输入裁定 | `Resources\报告\T06a-P01-接收与T06b前置安排-20261023-v1.md` |
| 日期 | 2026-10-23（Asia/Shanghai，本地时间约 15:49–15:58） |
| 角色 | DSH 前端/工具写入者（本卡只写 `tools/miniprogram` 测试与工具） |
| 项目根（绝对 cwd） | `D:\项目\cpp\Projects\食堂就餐优化系统` |
| 请求模型 | DeepSeek V4.1 Flash；原生推理档未指定 |
| 实际模型 | `deepseek-v4.1-flash-1017`（本会话客户端标识） |
| 服务器侧实际型号/档位 | **未知**（客户端不回传，不把请求配置当实际证明） |
| 结论 | **完成（自验通过，待 P02/P01 查收）**；无阻塞，未启动 T06b |
| 唯一反馈 | 本文件 |
| 证据目录 | `Resources\报告\T06a2-DSH-旧测试入口与A11身份对齐-证据-v1\`（索引见其 `README.md`） |

> 所有“通过”均为 **Node.js 宿主 + 包内 A11 WASM + mock wx 存储**的执行方自验；**不是**微信开发者工具模拟器、不是真机，不代替 T06b/T07/T08/T09。

## 1. 开工身份核对（改任何文件之前）

现场复算与卡片输入完全一致，未发现漂移，具备开工条件：

| 项 | 卡片输入 | 现场实测 | 结论 |
| --- | --- | --- | --- |
| `miniprogram/src` 摘要 | `sha256:ed137fa0afe146f62c11ae4f8942b2549850411c173b96f922151c090722099f` | 同值；75 文件 / 870,713 B | 一致 |
| 包内 A11 WASM | 107,472 B / `B53C7405A643E8409071ED76D3CB4CCBDF1A37E6E5C408CE1D4A373D4CC00744` | 同值，`frozenWasmMatches:true` | 一致 |
| T03d 正式菜单 | 37,157 B / `0657E2B26F2AE19EBAF98322AA9A167E3D0350C8D2132A8FF11F9D037981C607` | 同值（仅核对，未改） | 一致 |
| T06a 交付后基线 | — | 113 个候选文件与 T06a `after/manifest.json` 逐项字节/哈希全等，0 差异 | 无他方改动 |

命令：`node tools/miniprogram/candidate-manifest.mjs --out <scratch>\baseline`，exit 0。证据 `00-开工核对/identity-check.json`。

## 2. 改动（5 个文件，全部在 `tools/miniprogram`；`miniprogram/src` 逐字节未动）

| 文件 | 字节（前 → 后） | SHA-256（前 → 后） | 对应卡片项 |
| --- | --- | --- | --- |
| `t05-test-helpers.mjs` | 11,052 → 11,183 | `f7308028…34de30` → `538eba26…3080fc` | 第 1 项 |
| `test-t05-store.mjs` | 69,312 → 70,763 | `2fc174ff…c010ab` → `c28941e1…3992bf` | 第 2 项（第 12 项） |
| `verify-t05-integration.mjs` | 21,455 → 22,079 | `595ab3fc…6551a` → `0792e3b3…9ae2ce` | 第 2 项（第 10 场景） |
| `measure-t05.mjs` | 15,591 → 15,574 | `f13ffea6…10139` → `07e7f896…ce94c7` | 紧邻测试数据 |
| `test-t05-soldout-scope.mjs` | 43,154 → 43,166 | `c5e2afc2…a465` → `c99381e4…50d62` | 紧邻测试数据（仅头注释） |

完整逐文件身份、必要性说明与“未改清单”见 `02-改动清单/changed-files.json`。

1. **`t05-test-helpers.mjs`**：`WASM_EXPECTED_BYTES/SHA256` 由 T02 旧值（72,881 / `715CD770…`）改为包内 A11 真实身份（107,472 / `B53C7405…`），文件头说明同步。依赖该帮助函数的既有测试由此可进入业务断言。
2. **`test-t05-store.mjs` 第 12 项**：按现行 `domain/plan.ts` 与 T01 v1.2 四字段语义重写，检查项未删除：
   - 请求 `plannerConfig.limits` 深比较 `{maxMealCandidatesPerMeal:64, maxDpStates:20000, maxSearchNodes:200000, wallClockMs:null}`，键数恰为 4；
   - 序列化请求不含旧别名 `maxNodes`/`maxCandidates`；
   - 写入旧 `settings.limits{maxNodes:3}` 后真实核心仍正常返回 `OkPartial`（旧设置不再截断搜索、不产生假 `ResourceLimited`）；
   - `ResourceLimited` 展示语义改用**真实核心** `resourceLimited` 夹具（合法极小 `maxSearchNodes=3`）响应，再走与首页同一 `interpretPlanResult` 映射，断言 `plans` 为空、诊断含 `SEARCH_LIMIT_REACHED`、文案含“搜索达到合法限额”（限额耗尽不得冒充无解）。
   - 附加项 dev 视图字节断言改用 `WASM_EXPECTED_BYTES` 常量（原硬编码 72,881 会必失败）。
3. **`verify-t05-integration.mjs` 第 10 场景**：同一四字段口径重写（深比较、旧别名不出现、真实核心 `OkPartial`）；场景 01 标题与头注释改 A11 身份。
4. **`measure-t05.mjs`**：报告对象 `wasm.expectedBytes/expectedSha256/identityMatched` 改用 helper 的 A11 常量，避免身份对齐后仍记录“期望 72,881 / 不匹配”的假证据（本卡未运行性能测量）。
5. **`test-t05-soldout-scope.mjs`**：仅头注释身份数字同步为 A11；断言逻辑本就走 helper 常量。

## 3. 定向检查（改前基线 → 改后复跑）

| 检查 | 命令（项目根） | 改前 | 改后 |
| --- | --- | --- | --- |
| store | `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-t05-store.mjs` | exit 1；26 pass / 2 fail（第 12 项 `true !== false`、附加项 `107472 !== 72881`） | **exit 0；28 tests / 28 pass / 0 fail** |
| integration | `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/verify-t05-integration.mjs` | exit 1；`readWasmChecked()` 抛“包内 WASM 身份不符：预期 72881…实际 107472…”，未进入场景 | **exit 0；17 / 17 PASS** |
| soldout | `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-t05-soldout-scope.mjs` | exit 1；同一身份校验失败 | **exit 0；11 tests / 11 pass / 0 fail** |
| 候选 manifest | `node tools/miniprogram/candidate-manifest.mjs --out <scratch>\manifest-after` | 开工时 exit 0、`frozenWasmMatches:true` | **exit 0**；`sourceTreeDigest` 仍 `ed137fa0…`（75 文件 / 870,713 B）；`frozenWasmMatches:true`；仅 5 个 `tools/miniprogram` 文件变动，tools 445,590 → 447,791 B |

原始输出（改前/改后）见 `01-基线失败/`、`03-复跑结果/`；候选核验见 `04-候选核验/manifest-check.json`。

> 第一次改后跑集成检查时为 16/17：场景 06 仍断言“不得发送四字段”。该断言与第 12 项/第 10 场景同属卡片 §5.2 已明示的旧 limits 漂移（T02 二进制时代口径），在现行 `plan.ts` 上必失败；已按同一四字段语义改为“必须发送四字段且 `wallClockMs=null`”，最终 17/17。不是产品缺陷，也没有通过改断言掩盖产品问题——四字段发送本身是现行产品行为，旧断言才是过时口径。

## 4. 范围与未改项

- 未改：`miniprogram/src`（75 文件 / 870,713 B）、WASM、正式菜单、C++ 核心、共享契约、用户记录、历史证据、`MEMORY/`。
- 未新增营养值、未改产品逻辑、未做第二套算法、未跑正式性能测量、未启动 T06b。

## 5. 未测项 / 限制

- 未运行微信开发者工具模拟器、未做真机验证；未做 T06b/T07/T08/T09。
- 未跑 T05 全量测试矩阵（`run-t05-all.mjs`，含 `test-t05-modules.mjs` 等）；只按卡片定向跑 store / integration / soldout。
- 未运行 `measure-t05.mjs`（卡片交代无需正式性能测量）；其改动仅限证据字段口径。
- 上述通过项是执行方自验；P02 材料查收与 P09 独立复核仍需另行进行。

## 6. 运行中的发现（交 P01，未在本卡扩写）

1. **同源旧断言第 3 处**：`verify-t05-integration.mjs` 场景 06 原为“不得发送四字段”，属 §5.2 第 2 条同一漂移；已按四字段语义修正（见 §3 说明）。
2. **`tools/miniprogram/test-storage-snapshot.mjs` 第 128–129 行**仍硬编码 T02 身份（72,881 / `715CD770…`），且把结果写入 `Resources/报告/T02-反重力-最小小程序链路-证据-v1/`。它不在本卡点名的三处旧入口内，也不在 `run-t05-all.mjs` 的 `test-t05-*` 名单内，**本卡未改**；若将来有人运行，会以旧身份覆盖 T02 历史证据。建议 P01 单独决定收口（改 T02 历史证据生成器或显式标注不可再跑）。
3. **`domain/types.ts` 旧 `PlannerSettings.limits` 形状与 `store.saveSettings` 旧键校验仍在**（P01 已注明 T06 统一）。现行 `plan.ts` 完全不读取 `settings.limits`，第 12 项已按“旧设置不进入请求”的现状断言并注明清理属 T06；本卡未动生产逻辑，也未观察到它影响产品行为。

## 7. 阻塞与接续

- 阻塞：**无**。
- 完成后停止，不启动 T06b；交 P02 查收、P01 复核。如需在同候选上补跑模拟器/真机或全量 T05 矩阵，请另发单项授权。

【结束】
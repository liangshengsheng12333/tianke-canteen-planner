# T05N01a · 隔离套餐组件类型对齐 · 交付反馈 v1

- 反馈对象：`Resources/任务卡/T05N01a-DSH-隔离套餐组件类型对齐-v1.md`
- 执行平台：DeepSeek Harness（DSH）
- 指定模型：**DeepSeek V4.1 Flash**（P01 派单）
- 可核实实际模型/档位：运行时自报 `deepseek-v4.1-flash-1017`；服务端实际模型与原生档位无法核实 = **未知**
- 执行 cwd：`D:\项目\cpp`
- 状态：**完成**（隔离副本内套餐组件显示已修并实测；未合入生产，未改生产/N01/核心/菜单/契约/MEMORY）

## 1. 输入与输出身份

| 项 | 值 |
| --- | --- |
| 输入基线 | N01 隔离副本 `miniprogram/src` = `sha256:437d532d4c122012dead377daee3231745caa89db3c182b84c39edff7984e733`（75 文件 / 867,332 B；收尾复核未变） |
| 输入 WASM | A04 隔离候选 108,387 B，SHA-256 `AC8CD1172B2FD2483CE6B4B61E9E078CEA1D7E9FCE2CBC35E5E12330ED863D3C` |
| 输出候选 | N01a 隔离副本 `miniprogram/src` = `sha256:406fe0c87ac61545de5a8b9bafcbc8395cd8e278b5f4a5e2b5f35fc6e9d21bb9`（75 文件 / 867,814 B） |
| 输出 tools | 38 文件 / 433,912 B（仅同步 1 处既有样例类型） |
| 生产只读复核 | 仍 `sha256:16c2b29a…42f1`、`frozenWasmMatches:true`；生产 WASM 仍 72,881 B / `715CD770…1D52C` |
| 对齐依据 | `core/include/mp/catalog.h` 的 `ComboComponent{dishId,count}`、`core/src/catalog.cpp` 对 `dishes[].components[]{dishId,count}` 的解析、T01 v1.2 §3、A04 `01-portion-scaling`/`03-combos-fixed-and-rule` 输入 |

## 2. 交付文件（绝对路径）

- 隔离工程：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T05N01a-DSH-隔离套餐组件类型对齐-证据-v1\experiment\miniprogram`
- 证据报告：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T05N01a-DSH-隔离套餐组件类型对齐-证据-v1\T05N01a-DSH-隔离套餐组件类型对齐-证据-v1.md`
- **最小 patch（相对 N01）**：`...\experiment\evidence\copy-diff\patch-vs-n01.diff`
  （5,506 B，SHA-256 `033EFC38A2679301703549D194E3A3437A3A3D268BBCF0BE2411C0C2D4B48620`）
- 样例类型同步：`...\experiment\evidence\copy-diff\patch-tools-vs-n01.diff`（2,112 B，`14F6CBEE…EA77DFD4`）
- 累计 patch（N01+N01a，对生产，供合并参考）：`...\experiment\evidence\copy-diff\patch-vs-production.diff`（47,698 B）
- 三方逐文件哈希：`...\experiment\evidence\copy-diff\file-hashes.json`
- 候选清单：`...\experiment\evidence\copy-manifest\manifest.json`
- 局部检查：`...\experiment\evidence\offline-checks\offline-checks.json`
- 模拟器证据：`...\experiment\evidence\simulator\`（`sim-00…sim-16c` JSON、13 张 JPEG、`run-log.txt`、`sim-summary.json`）
- 证据索引：`...\experiment\evidence\evidence-index.json`
- 复现脚本：`...\experiment\verify\make-combo-fixtures.mjs`、`run-offline-checks.mjs`、`run-simulator-checks.ps1`、`summarize-simulator-evidence.mjs`

## 3. 最小 patch 内容

| 文件 | 改动 |
| --- | --- |
| `src/domain/types.ts` | 新增 `ComboComponent{dishId,count}`；`Dish.components: string[]` → `ComboComponent[]`（与核心同形，不留双轨适配） |
| `src/domain/self-pick.ts` | `comboComponentNames` → `comboComponentLabels`：按组件 `dishId` 取真实菜名，输出 `菜名×count`（只展示，不参与营养/计价） |
| `tools/miniprogram/test-self-pick.mjs` | 既有套餐样例 `components` 同步为 `[{dishId,count}]`（旧样例无真实数据支持，不保留 string 形态） |

未改：offer 视图/预览/确认写入路径、store 核心快照、数量累加/未知语义/估算标记、菜单页（按卡不碰）、生产目录。

## 4. 实际操作与验证结果

| 验证 | 命令/方式 | 结果 |
| --- | --- | --- |
| 局部类型检查 | `node tools/miniprogram/typecheck-src.mjs` | TS 4.1.2 / 5.9.3 两套均 0 error（38 files） |
| 核心与原生对拍 | 6 个 case（含本卡 `03`、`05`）| 运行时 WASM 输出与 A04 `mp_cli.exe` **逐字节相同** |
| 离线断言 | `verify/run-offline-checks.mjs` | **59/59 通过**（N01 原 42 + 本卡 17：组件形状、菜名×份数、无对象字符串、已知/未知传播、不重算、快照） |
| 模拟器闭环 | `verify/run-simulator-checks.ps1`（真实点击 + 截图） | 导入 TEST 菜单 `menu-t05n01a-combo-count2-v1`（8 菜/10 报价）；套餐行显示 `清蒸鸡胸×2、清炒青菜×1`（含 count>1）、部分未知套餐显示 `已知零与部分未知菜×1、清炒青菜×1`；**无 `[object Object]`**；预览 856 千卡；确认 3 项后记录快照含套餐 `{410,640,122,60}`、`knownSums=856/1282/197/318`；重复确认 `duplicate:true` 且仅 1 条有效记录；关窗重开后记录/营养仍在；换回真实西一菜单仍全部「营养待补全」、无测试值 |
| 规则套餐 | A04 `03` 输入 | 核心可返回 `rule-combo-lunch#dish-chicken+dish-greens` 营养 245/330/86/60；自选页只列静态报价、无 `rule-*` 行，固定套餐行标签正确 |
| console | `get_simulator_console --command 'grep -i error'` | 无命中 |
| 生产未被改动 | 生产 `candidate-manifest.mjs` | `16c2b29a…`、冻结 WASM 匹配；N01 副本仍 `437d532d…` |

证据性质：模拟器运行（微信开发者工具自动化），**不是真机**。

## 5. 未完成项 / 未测项

1. 未上真机；A04 隔离 WASM 不等于最终生产核心候选。
2. 菜单页按卡未改、未检查（两项低优先观察不在本卡）。
3. 规则套餐在自选页不出现属现状（核心展开报价不在 `catalog.offers`），本卡未改也未回归推荐/计划页展示。
4. `tools/miniprogram/test-self-pick.mjs` 仅同步样例类型，未作为本卡验收运行；M01 时期「营养恒 null」旧断言仍与新语义冲突。
5. 多窗口/售罄/锁定组合未逐项复测（相关逻辑未改）。
6. N01 已知建模缺口未变：记录层 `nutritionBasis` 仍按核心 `estimated` 取 `'estimated' | 'menu'`。

## 6. 阻塞

无阻塞。未合入生产、未写回原目录、未领取其他任务；后续合并按 P01 的统一核心/A10a 节奏另派。
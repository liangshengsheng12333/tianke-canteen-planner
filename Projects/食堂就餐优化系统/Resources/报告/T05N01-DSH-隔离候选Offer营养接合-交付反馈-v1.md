# T05N01 · 隔离候选 Offer 营养接合 · 交付反馈 v1

- 反馈对象：P01（任务卡 `Resources/任务提示词/T05N01-DSH-隔离候选Offer营养接合-v1.md`）
- 执行平台：DeepSeek Harness（DSH）
- 指定模型：**DeepSeek V4.1 Flash**（P01 派单路由）
- 可核实实际模型/档位：运行时自报 `deepseek-v4.1-flash-1017`；服务端实际模型与原生档位无法核实 = **未知**
- 执行 cwd：`D:\项目\cpp`
- 状态：**完成**（隔离副本闭环已实测；未合入生产，未改生产文件）

## 1. 输入与候选版本

| 项 | 值 |
| --- | --- |
| 基线候选 | M01 源码树 `sha256:16c2b29a593322efa1106f935ab14a16f3b23ae898603a8d439f54bcd0ec42f1`（75 文件 / 817,080 B，冻结 WASM 匹配） |
| A04 候选 WASM | 108,387 B，SHA-256 `AC8CD1172B2FD2483CE6B4B61E9E078CEA1D7E9FCE2CBC35E5E12330ED863D3C` |
| 生产 WASM（未替换） | 72,881 B，SHA-256 `715CD7701B64D8F493A110C348B5F643979536578C7380C29837E05C4F31D52C` |
| 契约 | `Resources/契约/Offer营养只读出口扩展-v1.md` |
| 测试数据 | 全部来自 A04 证据 inputs，明确标 TEST（菜单版本 `menu-t04a04-v1`、导入名 `T05N01-TEST-A04-offer-nutrition.catalog.json`） |

## 2. 交付文件（绝对路径）

- 隔离工程（可运行）：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T05N01-DSH-隔离候选Offer营养接合-证据-v1\experiment\miniprogram`
  - 隔离副本摘要 `sha256:437d532d4c122012dead377daee3231745caa89db3c182b84c39edff7984e733`（75 文件 / 867,332 B）
- 证据报告：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T05N01-DSH-隔离候选Offer营养接合-证据-v1\T05N01-DSH-隔离候选Offer营养接合-证据-v1.md`
- 代码补丁（对 M01）：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T05N01-DSH-隔离候选Offer营养接合-证据-v1\experiment\evidence\copy-diff\patch-against-m01-src.diff`
- 逐文件哈希：`...\experiment\evidence\copy-diff\file-hashes.json`（8 改 / 67 同 / 0 增删）
- 局部检查结果：`...\experiment\evidence\offline-checks\offline-checks.json`
- 模拟器证据：`...\experiment\evidence\simulator\`（`sim-00…sim-16c` JSON、12 张 JPEG、`run-log.txt`、`sim-summary.json`）
- 证据索引：`...\experiment\evidence\evidence-index.json`（68 文件含 SHA256）
- 复现脚本：`...\experiment\verify\run-offline-checks.mjs`、`...\experiment\verify\run-simulator-checks.ps1`

## 3. 实际操作与验证结果

改动 8 个文件（WASM + 7 源文件），其余 67 个与 M01 逐字节一致：
`utils/core-bridge.ts`（增 `mp_offer_nutrition` 导出/命令/映射）、`utils/core-runtime.ts`（隔离副本的预期 WASM 身份改为 A04）、
`domain/types.ts`（A04 契约类型）、`domain/self-pick.ts`（快照+单份值×数量+未知语义+展示文案）、
`domain/store.ts`（`ensureSelfPickNutrition` 唯一核心入口、按菜单+餐次复用、回显校验）、
`pages/self-pick/index.ts`/`.wxml`（首屏后补营养、文案接核心值、自动化用 id，视觉不变）。

| 验证 | 命令/方式 | 结果 |
| --- | --- | --- |
| 类型检查 | `node tools/miniprogram/typecheck-src.mjs` | TS 4.1.2 / 5.9.3 两套均 0 error（38 files） |
| 运行时 WASM 与原生 CLI 对拍 | `verify/run-offline-checks.mjs` + `mp_cli.exe offer-nutrition` | 42/42 断言通过；4 个 case 输出**逐字节相同** |
| 模拟器真实闭环 | `verify/run-simulator-checks.ps1`（真实点击 + 截图） | 通过：自选页 7 报价显示单份值（整份 232 / 半份 116 千卡）；鸡胸×2 + 半份米饭合计 446 千卡/64.2g/7.5g/25.8g；确认生成记录 `rec-mvjn5buu-selfpick`；记录页/今日摄入 446 千卡；同草稿二次确认 `duplicate:true` 且仅 1 条有效记录；换晚餐/早餐不串值；关窗重开后记录仍在 |
| 已知 0 与未知 | 模拟器 + 离线断言 | 能量 0、脂肪 0 保持 0；蛋白/碳水显示「待补全」，合计不按 0 计 |
| `estimated` 传播 | 模拟器 + 离线断言 | 核心 `estimated=true`（含固定套餐组件汇总）在行内与预览标注「估算」 |
| 真实菜单仍未知 | 用 UI 切回内置西一菜单后进入自选页 | 全部「营养待补全」、合计未知、无任何测试数值；`hasTestValue:false` |
| 生产未被改动 | 收尾复核 `candidate-manifest.mjs` | `sha256:16c2b29a…42f1`，`frozenWasmMatches:true` |
| console | `get_simulator_console --command 'grep -i error'` | 无命中 |

证据性质：模拟器运行（微信开发者工具自动化），**不是真机**。

## 4. 未完成项 / 未测项

1. 未上真机：A04 108 KB 包在真机的加载、包体与耗时未测。
2. 未跑全量回归与性能矩阵（任务卡只要求最小验证）；M01 时期断言「营养恒 null」的基线测试脚本与本候选语义冲突，未作为验收、也未修改。
3. 既有缺口（非本卡引入、未修）：前端 `Dish.components: string[]` 与 A04 契约 `{dishId,count}[]` 不一致，测试菜单套餐行显示「含 [object Object]」；生产西一菜单当前无套餐规则，不影响线上。
4. 多窗口/售罄/锁定组合未逐项复测（本次测试菜单单窗口、无售罄；相关逻辑未改）。
5. 合入前需：同步 `WASM_IDENTITY`/包体校验、处理组件类型差异、更新旧断言。

## 5. 阻塞

无阻塞。未合入生产、未写回原目录、未领取其他任务。
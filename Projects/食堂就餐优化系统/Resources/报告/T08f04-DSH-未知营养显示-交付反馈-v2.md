# T08f04-DSH 未知营养显示 · 交付反馈 v2

- 任务：DEFECT-S3-02（今日页按菜品营养明细把未知营养显示成 `0 kcal`、拼接出 `"待补全g"`、且不显示未知标签）
- 执行者：`f04-nutrition`（DSH 子代理，Agent Teams 成员；Team Lead `lead`）
- 实际 cwd：`D:\项目\cpp`；项目根：`D:\项目\cpp\Projects\食堂就餐优化系统`
- 完成时间：2026-10-23 22:42—23:00（Asia/Shanghai）
- 交付性质：**仅隔离补丁（isolated patch / candidate），不是"已修复生产"。生产源码一个字节都没有改。**

## 1. 模型声明（按任务卡要求）

- 请求模型：**DeepSeek V4.1 Flash**
- 实际可核实模型：**DSH 客户端自报 `deepseek-v4.1-flash-1017`**
- 服务端实际子型号/档位：**未知**（无法从本会话核实服务端路由的实际子型号或量化档位，不把请求配置写成实际证明）

## 2. 基线身份（开工/收尾各一次，只读）

`node tools/miniprogram/candidate-manifest.mjs`（项目根，无 `--out`）：

| 项 | 值 |
|---|---|
| production `sourceTreeDigest` | `sha256:d15bbe0eb2a73e9eba230c819288e9db180487df4ea1ab7b90516482e290f19e` |
| 文件数 / 字节 | 75 / 872,829 |
| 冻结 WASM | `frozenWasmMatches: true`，`B53C7405…4CC00744`（107,472 B），未触碰 |

收尾复核同值 → **生产源码未被修改**。证据：`identity.log`（开工侧）、`production-digest.log`（收尾侧）。

## 3. 改了什么（仅 2 个文件，均在候选内）

- `miniprogram/src/domain/plan.ts`（`itemViewFromPlanItem`，约 L429-460）
- `miniprogram/src/pages/home/index.ts`（`nutritionSummaryText`，约 L80-100）
- `patch.diff`：`sha256=b141f97ca6f1fae03e74aa37a64d896a030c8624d7c0a0b2d23433becdd34e4a`，2,907 B
- 候选树（生产 + patch）：`sourceTreeDigest=sha256:66e2e3ee4ea8d7e5085ff1f3c2ddf42681abc8b4cb8f2dc2adbed7cb5f76bb87`，75 文件 / 873,603 B（+774 B）
- 逐文件前后 SHA-256 / 字节：`changed-files.txt`

## 4. 根因（可核实到行）

1. `domain/plan.ts` 原为 `nutritionKnown: !!nutrition`，只区分"整个 nutrition 对象有没有"。但核心契约里 `item.nutrition` **对象存在、四个字段可为 null**（真实 T03d 菜单 35 道中 31 道四项全 null）。对象为真值 → 未知营养被当成"已知"，`unknownLabel` 不写"营养未知"（页面 detail 也只在对象为 null 时才写"营养待补全"，于是标签为空）。
2. `pages/home/index.ts` 原 `nutritionSummaryText`：`Math.round(nutrition.energyKcal)` 对 `null` 得 **0**（显示 `能量 0 kcal`）；宏量先调 `formatGramsFromDg` 得到 `"待补全"` 又硬拼 `g` → `"待补全g"`。
3. 语义错误点：把"字段未知（null）"与"真实零（0）"混为一谈，且判断用真值/整体对象而不是逐字段 `number`。

### null vs 0 的处理（本次固定语义）

- 判已知：`typeof value === 'number' && Number.isFinite(value)`；**不用 `!value`、不用真值判断**。
- `null`（或非有限数）→ 该字段显示 `待补全`；真实 `0` → 显示 `0`。
- 四项全部有限数才算 `nutritionKnown=true`（未知标签逐项合并，仍与 `价格待补` 并列）；不伪造任何营养值，null 永远保持 null。
- 聚合层（`unknownNutrientsToNull` / `knownSums` / `incompleteNutrients`）未改，仍按契约逐字段输出。

## 5. 逐项验收（实际显示字符串原样来自 `run-after.log`）

| # | 验收点 | 结果 | 实际显示（隔离候选） |
|---|---|---|---|
| 1 | 未知营养四项逐字段写"待补全"，不出现 `0 kcal` | **PASS** | 明细文本 `"能量待补全 · 蛋白待补全 · 脂肪待补全 · 碳水待补全"` |
| 2 | 未知营养带未知标签 | **PASS** | `unknownLabel: "营养未知"` |
| 3 | 不出现 `"待补全g"` 拼接 | **PASS** | 同上文本中无 `待补全g` |
| 4 | 真实已知营养照常显示、不误标未知 | **PASS** | `"能量 231 kcal · 蛋白 2.5g · 脂肪 2.2g · 碳水 53.1g"`，标签 `""` |
| 5 | 真实已知零显示 0、不写待补全、不误标未知 | **PASS** | `"能量 0 kcal · 蛋白 0g · 脂肪 0g · 碳水 0g"`，标签 `""`；热量大字 `"约 0 千卡"`（该菜 `estimated=true`，故带"约"），营养区状态 `zero`、克数 `"0 克"` |
| 6 | 混合已知/未知逐字段处理 | **PASS** | `"能量 120 kcal · 蛋白待补全 · 脂肪 4g · 碳水 10g"`，标签 `"营养未知"` |
| 7 | 今日页小计/目标行不回退 | **PASS** | 午餐小计 `"能量 351 kcal · 蛋白 2.5g · 脂肪 6.2g · 碳水 63.1g"`；目标 `"能量 948 kcal · 蛋白 33.6g · 脂肪 28.4g · 碳水 139.4g"`；午餐热量大字 `"热量待补全"` |
| 8 | 首页小结口径不回退 | **PASS** | 已知 `"500 千卡"`；未知 `"待补全"` |
| 9 | 模板仍绑定同一字段 | **PASS** | `index.wxml` 含 `{{item.nutritionText}}`、`{{item.unknownLabel}}` |
| 10 | 记录页/月汇总/月历/今日展示既有测试不回归 | **PASS（基线一致）** | 见 §7：5 项既有测试候选与未修改基线 PASS/FAIL 集合完全一致；`test-logs-page.mjs` 2 项失败为生产基线既有 |
| 11 | 微信开发者工具/模拟器/真机显示 | **未测** | 任务约束禁止占用模拟器（T08c1 正在使用），本会话只做 Node 离线隔离测试 |

自测汇总：修复前 `run-before.log` **6 FAIL**（`"能量 0 kcal · 蛋白 待补全g · 脂肪 待补全g · 碳水 待补全g"`、未知标签空、混合项同样拼接）；修复后 `run-after.log` **全部通过：33 项**（exit 0）。

## 6. 明确声明（按任务卡要求，请原样引用）

**本交付为 Node 离线隔离测试，未在微信模拟器/真机验证；生产源码未被修改（digest 证据：`identity.log` 与 `production-digest.log` 前后均为 `sha256:d15bbe0eb2a73e9eba230c819288e9db180487df4ea1ab7b90516482e290f19e`，75 文件 / 872,829 B，冻结 WASM 未变）。**

## 7. 回归（隔离候选 vs 生产逐字节副本基线）

`regression.log` 记录：同一批既有测试分别跑「候选」与「未修改基线」：

| 测试 | 候选 | 基线 | 失败集合一致 |
|---|---|---|---|
| test-today-display.mjs | PASS 46 / FAIL 0 | PASS 46 / FAIL 0 | 是 |
| test-home-view.mjs | PASS 34 / FAIL 0 | PASS 34 / FAIL 0 | 是 |
| test-logs-page.mjs | PASS 76 / FAIL 2（exit 1） | PASS 76 / FAIL 2（exit 1） | 是 |
| test-month-summary.mjs | PASS 35 / FAIL 0 | PASS 35 / FAIL 0 | 是 |
| test-calendar.mjs | PASS 41 / FAIL 0 | PASS 41 / FAIL 0 | 是 |

`test-logs-page.mjs` 的 2 项失败是**生产基线既有**，与本次补丁无关：测试期望 `"￥10.00（含未填项）"` / `"未知（含未填项）"`，实际实现输出 `"已知实付 ￥10.00（含未填项）"` / `"实付待补全"`（金额数值正确，也未把未知当 0）。已在未修改基线上复现同样 2 FAIL；建议另立卡片更新测试期望，勿并入 f04。

## 8. 证据与复跑（绝对路径）

证据目录：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T08f04-DSH-未知营养显示-证据-v2\`

- `patch.diff`、`changed-files.txt`、`patch-verify.log`（`git apply --check`/apply 通过，应用后两文件 SHA-256 与候选一致，其余 73 文件 0 差异；重生成的 diff 与发布版 SHA-256 相同）
- `run-before.log`（红：6 FAIL）、`run-after.log`（绿：33 PASS）、`regression.log`
- `identity.log`、`production-digest.log`、`candidate-digest.log`
- `run-f04.mjs`（可复跑，头部注释含完整命令）、`f04-hash.mjs`、`materialize-candidate.ps1`、`candidate-README.md`、`sandbox-write-probe.log`

复跑（推荐一键物化 + 复验，需完全权限会话）：

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File "D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T08f04-DSH-未知营养显示-证据-v2\materialize-candidate.ps1"
```

该脚本实测结果：候选树 `sha256:66e2e3ee4ea8d7e5085ff1f3c2ddf42681abc8b4cb8f2dc2adbed7cb5f76bb87`、`run-f04` 33 PASS、5 项回归与上表一致。手工复跑：

```powershell
Set-Location "D:\项目\cpp\Projects\食堂就餐优化系统"
node --import "./tools/miniprogram/register-ts.mjs" "<证据>\run-f04.mjs" --candidate "<证据>\candidate"
```

### 8.1 为什么证据目录里没有 `candidate/miniprogram/src` 实体树（环境限制，需 Lead 知晓）

- 本会话 shell 是低完整性受限令牌（`whoami /groups` 为 `Low Mandatory Level`，仅 `SeChangeNotifyPrivilege`），实测**无法**在 `Resources\报告\` 下建目录/写文件（`Access denied`，细节见 `sandbox-write-probe.log`）；文本证据由宿主写入工具落盘，但 `candidate/miniprogram/src` 内含 107,472 B 冻结 WASM 二进制，文本写入工具无法复制。
- 因此隔离候选构建在 `C:\Users\link\AppData\Local\Temp\dsh-Me3b2G\T08f04-DSH-未知营养显示-证据-v2\candidate`（75 文件 / 873,603 B，已用于全部日志），并交付 `materialize-candidate.ps1`：从生产只读复制 + 在候选内应用 `patch.diff`。该脚本已在临时目标实测，物化结果与手工候选逐文件 SHA-256 完全一致（`sourceTreeDigest` 相同），`run-f04` 33 PASS。
- 若 Lead/P09 要求证据目录内自带实体候选树，请在完全权限会话执行上述一条命令即可（或由 P01 代为执行后复核 digest）。

## 9. 限制与未测项

1. **未在微信开发者工具/模拟器/真机验证**：无截图、无真机；显示字符串均为 Node 离线（wx/Page 桩）输出。任务约束禁止占用模拟器（T08c1 在使用）。
2. 未做 f01/f02 页面改动合并后的整页端到端验证；本补丁只在"当前生产基线 + 本 2 文件"上验证。
3. 未知价格与未知营养同时出现时只断言了 `unknownLabel` 合并路径（`营养未知、价格待补` 的顺序逻辑），未单独构造"价格未知+营养全未知"的完整显示用例；但 `PRICE_PENDING` 逻辑未改。
4. 记录页/月汇总只做既有测试回归（其中 2 项为既有失败），未逐屏人工核对。
5. `utils/nutrition-display.ts` 未改（复用既有 `formatGramsFromDg`，其"未知→待补全"语义正确）；未新增公共工具文件。

## 10. 给 f05/合并者的提示

- **同文件冲突面**：f01/f02 也改 `pages/home/index.ts`（本补丁只动 `nutritionSummaryText` 一个函数与注释，约 L80-100）；`domain/plan.ts` 只动 `itemViewFromPlanItem` 内 `unknown`/`nutritionKnown` 一段（约 L429-460）。合并时以函数/代码块为单位 rebase，保留 f01/f02 的 `buildCard`/`buildSummary` 改动。
- 合并顺序建议：先 f01 → f02 → 本补丁（本补丁最小且依赖字段语义）；任一处若把 `nutritionKnown: !!nutrition` 改回去，未知标签会再次丢失。
- 不要对 `energyKcal` 直接 `Math.round()`（null → 0）；不要写 `formatGramsFromDg(x) + 'g'`（未知 → "待补全g"）；统一用 §4 的逐字段有限数判断。
- `tools/miniprogram/test-home-view.mjs` 的断言依赖 `unknownLabel` / `nutritionKnown` 字段语义（页面模板绑定 `item.unknownLabel`）；合并后复跑 `run-f04.mjs` 与 5 项既有测试，期望 33 PASS 且回归与 §7 表一致。
- 候选身份以 `sourceTreeDigest=sha256:66e2e3ee…bb87` + `patch.diff sha256=b141f97c…34e4a` 为准；若合并使候选变化，需重新生成 digest 与 patch，不能拼接旧证据。

## 11. 结论

**结论：只在隔离候选上修复并验证了 DEFECT-S3-02（未知营养显示），产出可复核的 isolated patch（2 文件、+774 B）与 33 项 PASS/6 项 FAIL 红绿证据；生产源码未被修改（digest 前后一致）；未在微信模拟器/真机验证。综上，这是"隔离补丁已就绪、可交合并/独立复验"，不是"生产已修复"。**
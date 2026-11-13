# T05｜DSH｜“天科食客”页面与本地数据 交付反馈 v1

- 日期：2026-10-20（Asia/Shanghai）
- 平台/工作区：DSH；工作区 `D:\项目\cpp`；项目根 `D:\项目\cpp\Projects\食堂就餐优化系统`
- 任务卡：`Resources\任务卡\T05-小程序与本地数据.md`（v0.2，SHA256 `2DE43B034C2E667D833006F94157C235B53BB6C4B12F6B63FA82F9DA7762EE52`）
- 执行提示词：`Resources\任务提示词\T05-DSH-天科食客页面存储-v2.md`（v2，15,638 字节，SHA256 `867F932A26743A2E0C8182B403662F085EF6B70AB712BAC71CFE16594EEF9943`，与 P04 回执一致）
- **状态：阶段交付/部分验证完成。** 实现、Node 真实 WASM 自动测试、微信开发者工具编译/预览与模拟器真实运行时流程已完成；**红米 K90 Pro Max 真机、手机杀进程重开、断网实测未运行（缺少用户现场配合证据）**，因此不把整卡所有验证项标为通过。
- 唯一反馈文件：本文件。证据目录：`Resources\报告\T05-DSH-天科食客页面存储-证据-v1\`

## 1. 模型与平台记录（请求 ≠ 实际证明）

- P01 指定请求模型：**DeepSeek V4.1 Flash**；原生思考档位未指定。
- DSH 运行时可见标识：本会话执行过程中平台标记过 `qw/deepseek-v4.1-flash-1017` 与 `deepseek-account/deepseek-flash`；子执行员记录为 `deepseek-flash`。**服务端实际版本、额度与原生档位无法核实，记为未知。**
- **未使用 Gemini 4**；Gemini 4 属于 T04，不在本单。
- 开发工具：微信开发者工具 2.02.0（本机已安装，复用未重装）；Node v24.19.0（测试宿主）。

## 2. 输入与接手基线身份

接手时按提示词要求只读复核，**未修改** `core\`、`tools\core\`、T01 冻结契约/营养配置/样例、主 PRD、任务卡、AGENTS、MEMORY。详细复核见证据 `00-移交前基线\00-交接基线复核.md`。

| 输入 | 身份 |
|---|---|
| P01 门禁裁定 | `T02-P01-功能门禁与后续派工裁定-20261020.md`，SHA256 `61384EE761C9267CE7B748ABC2037A40AA0319463AC7B9B1C85E1FA4556B2F82` |
| P02 当前交接快照 | `T02-P02-当前交接基线-20261020.json`，SHA256 `BA52D125D91AB55AF3ED6125928FC1EDC1A4E3F5A61F1112CF217B14963F2526`（schema `T02-current-handoff-baseline-v1`，fileCount=54，snapshotStable=true） |
| 主 PRD v0.2 | SHA256 `D68ECE7218BC076155A0AFB6200788B7608898E9D0CDF6ECEC27C5E49AA58FDD` |
| T01 v1.2 契约 | `1248398A59BB678A149344098F842F03D9832155AA781EE1B719511601820DB7`（22,338 B） |
| T01 v1.2 营养配置 | `8254AB22DCA9CEEA1E41F575373442781AE7184DE40169041FD02B2E8308D191`（19,077 B） |
| T01 v1.2 请求/结果样例 | `087A890477BB6272C28885E62E87161AA7AC31AA5DBC878437B2D6241B92D40C`（30,456 B） |
| 本单目录接手基线 | `miniprogram\` + `tools\miniprogram\` 共 21 个文件，逐文件重算 SHA256：**0 缺失、0 哈希不符、0 大小不符、0 额外文件** |

WASM 身份（接管前后一致，未重建/未复制/未覆盖）：

| 工件 | 字节 | SHA256 |
|---|---|---|
| `D:\项目\cpp\.toolchain\build\wasm\mp_core.wasm`（源） | 72,881 | `715CD7701B64D8F493A110C348B5F643979536578C7380C29837E05C4F31D52C` |
| `miniprogram\src\assets\wasm\mp_core.wasm`（包内） | 72,881 | `715CD7701B64D8F493A110C348B5F643979536578C7380C29837E05C4F31D52C` |

## 3. 交付产物

最终清单与逐文件哈希：`00-移交前基线\00-交付产物清单与哈希.md`。

- `miniprogram\` 与 `tools\miniprogram\` 共 **69 个文件**（不含 node_modules）：新增 48、修改 7、未修改 14。
- 新增页面：`pages/home`、`pages/profile`、`pages/logs`、`pages/menu`、`pages/dev`（各 ts/wxml/wxss/json）；`app.json` 注册 5 页，标题统一“天科食客”。
- 新增领域层：`domain/types.ts`、`app-state.ts`、`store.ts`、`plan.ts`、`profile.ts`、`logs.ts`、`menu.ts`、`backup.ts`。
- 新增工具/配置：`utils/wx-runtime.ts`、`utils/core-runtime.ts`、`utils/sha256.ts`、`utils/canonical-json.ts`；`config/nutrition-config.ts`（T01 v1.2 快照只读副本）、`config/simulated-menu.ts`（T02 模拟菜单副本）。
- 修改：`utils/core-bridge.ts`（抽出共享 ABI 实现并新增计时变体 `callApiTimed`，`callApi` 行为不变）、`app.ts`、`app.wxss`、`app.json`、`types.d.ts`、`project.config.json`（名称/说明）、`README.md`。
- 新增验证工具：`tools/miniprogram/register-ts.mjs`、`t05-test-helpers.mjs`、`test-t05-modules.mjs`、`test-t05-store.mjs`、`run-t05-all.mjs`、`verify-t05-integration.mjs`、`measure-t05.mjs`、`check-pages.mjs`、`typecheck-src.mjs`、`count-comments.mjs`、`demo-storage-trace.mjs`、`wechatide-simulator-evidence.ps1`、`probe-core-api.mjs`（开发探测）。
- `src\pages\index\`（T02 旧探针页）保留作历史但**未在 app.json 注册**，不进入产品流程。

## 4. 实现范围与数据流（对应主 PRD 3.1–3.4）

1. **建档与目标**：档案字段/单位换算/范围校验；保存后 `profileRevision` 递增并调用 `mp_nutrition_target`；`TargetResult` 状态（Ok / REFERENCE_ONLY / MANUAL_TARGET_INCOMPLETE / AUTO_TARGET_DISABLED 等）、适用性原因、BMI、日目标、餐次参考、来源、警告、手动目标“存证但未应用”原因均可见；前端不实现 Mifflin/BMR/TDEE/宏量分配。
2. **今日三餐与计划**：按设备本地日期和 `tzOffsetMinutes` 构造 PlanRequest；只把“未结束且无 active 记餐”的餐次交给核心；页面先展示三餐窗口/菜品/主备选/价格，再展示营养进度；窗口锁定、同窗换菜、菜品锁定、临时售罄、结束/重开均写入当日状态并参与求解；`Ok/OkPartial/NoFeasible/NoFeasibleWithinBudget/NutritionDataInsufficient/ResourceLimited/LockConflict/TargetUnavailable` 各有可见文案；模拟菜单醒目标注。
3. **实际记餐**：仅用户确认才写 active MealLog；确认幂等键 `conf-plan-<date>-<meal>-<planKey>`，重复点击不重复累计；改记生成新 active 记录并标记旧记录 superseded；撤销标记 revoked；补记支持未知价格/未知营养（不当 0）；结束/重开餐次；历史快照不被换菜/重算/换菜单改写。
4. **预算与价格**：计划花费（来自核心方案）与实际消费（来自本地 active 记录）分开；未知价格显示“不完整”、不显示“预算内”；超预算保留真实数据并醒目标注；未知营养按营养素分别标“不完整”。
5. **菜单导入与替换**：本地 JSON → 前端解析（缺 catalogHash 时按 T01 v1.2 规范化序列化补算）→ 调用 `mp_validate_menu` 预检 → 展示错误与对计划/锁定/售罄的影响 → 用户确认后**单次事务写入**替换；失败/取消保留原菜单、锁定与计划；成功后旧计划失效、绑定新 menuVersion。
6. **本地导出与恢复**：用户主动导出（规范化摘要 + 真实写入 `USER_DATA_PATH` 文件）；恢复前校验 format/版本/摘要/状态结构，确认后原子应用；恢复后 8 行逐项对照（业务日期/档案 revision/档案内容摘要/菜单版本/日志条数/锁定售罄/计划 requestId/恢复内容摘要）。
7. **请求一致性与业务日期**：请求关联 requestId、profile.revision、nutritionConfig.version/hash、catalog.menuVersion/catalogHash、tzOffsetMinutes；每次刷新递增序号；**调用期间任何本地写入或更新的请求都会让旧响应 `stale` 丢弃**；跨日只建新桶，不迁移摄入/锁定/售罄；历史日志保存创建时 tz，不因时钟变化改写。
8. **受支持能力门**：核心调用前检查 `algorithm=greedy` 且 `comboRules=[]`；菜单非空套餐规则在预检被核心拒绝；`dp`/`branchAndBound` 不发送；前端不复制正式营养/搜索算法；WASM 是唯一正式值来源。
9. **请求字段口径**：继续使用旧 T02 v2 二进制实测口径（`plannerConfig.limits.maxCandidates/maxNodes`，未设置时不发送 limits），**未改用 T01 新搜索限额字段**；统一迁移留 T06。

## 5. 验证结果

### 5.1 Node 自动测试（真实包内 WASM，非 mock 核心）

| 文件 | 用例/断言 | 结果 |
|---|---|---|
| `test-core-bridge.mjs`（既有 T02 桥测试） | 13 test | 13/13 PASS |
| `test-t05-modules.mjs` | 17 test / 48 assert | PASS |
| `test-t05-store.mjs` | 28 test / 399 assert | PASS |
| `verify-t05-integration.mjs` | 17 场景 / 79 assert | 17/17 PASS |

覆盖：存储往返/损坏、档案 revision、3 类目标状态、真 WASM 计划、确认幂等、改记/撤销、补记未知、结束/重开、预算 0、TargetUnavailable、`limits.maxNodes=3 → ResourceLimited`、能力门、售罄跨日隔离、锁定失效 `LockConflict`（不调用核心）、同窗换菜、菜单导入非法/取消/写入失败保留原数据、成功替换旧计划失效、导出恢复 3 情形、旧响应 stale、请求一致性、杀进程重开（新 store 同存储）。

原始输出：`01-自动测试\`。运行命令：
`node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/run-t05-all.mjs`

### 5.2 类型与页面静态检查

- `tools/miniprogram/typecheck-src.mjs`：微信开发者工具自带 TypeScript **4.1.2**：`0 errors across 25 files`；Antigravity 自带 TypeScript 5.9.3：`0 errors across 25 files`（`06-静态检查\06-typecheck.stdout.txt`）。
- `check-pages.mjs`：5 个页面 WXML 标签闭合、事件绑定 71 个全部有对应方法、mustache 根标识符全部可在 data/wx:for 解析；`06-静态检查\06-check-pages.stdout.txt`。
- TS 注释率（T01 v1.2 §12 口径，排除生成/复制数据）：注释 563 行 / 代码 6941 行 = **8.1%**，**未达课程 20%**；本轮不为凑比例添加无意义注释，详见 §8。

### 5.3 微信开发者工具：编译/预览

- `cli.bat preview`：**成功**，AppID `wx51c68c82b059e864`，包体 **569.8 KB（583,496 Byte）**；证据 `04-微信工具与真机\04-微信工具-preview终端输出.txt`、预览二维码 png。
- 首次调用遇到一次 `APPID_ERROR / connect ETIMEDOUT 198.18.0.12:443`，重试即成功（网络瞬时）。

### 5.4 微信开发者工具：模拟器真实运行时流程

用开发者工具自带 wechatide 自动化（client `DeepSeek`，服务端口开启，用户已授权）在**真实微信运行时**执行，详见 `04-微信工具与真机\04-微信工具模拟器运行时验证.md` 与 `sim-*.json`：

| 流程 | 结果 |
|---|---|
| 首页渲染/模拟菜单警示/三餐卡 WXML | 通过（页面 data + 真实 outerWxml） |
| 建档 → `mp_nutrition_target` | 通过：`Ok`，BMI 22.9，日目标 2633/84.0g/79.0g/396.5g |
| `mp_plan` 三餐方案 | 通过：`OkPartial`，planKey `plan:a267a85b…e950`，flags=含估算数据 |
| 确认幂等 / 改记 / 撤销 / 补记未知 | 通过（记录数、revision、supersedes、汇总、未知不当 0） |
| 导出 → 恢复 | 通过：摘要 `sha256:9b779630…`，真实文件 `http://usr/tiankeshike-backup-2026-10-20.json`，8 行对照全 true |
| 菜单坏哈希预检拒绝 / 合法预检+原子替换 | 通过：坏菜单被核心拒绝且菜单版本不变；合法替换后旧计划失效、新菜单重新规划 `OkPartial` |
| 关闭项目窗口 → 重开恢复 | 通过：档案、导入菜单版本、计划、有效/历史日志从 wx 存储恢复 |
| console `error/fail/exception` | 无命中 |

**跨宿主一致性**：同一档案与模拟菜单下，Node 宿主与微信模拟器运行时得到同一 `planKey plan:a267a85b2154cac9cd0fe1b061ebcd09f5015c3a17d25ffb0913f41efd00e950`（说明请求/快照/WASM 输入在两端一致）。

### 5.5 计时（只报数值，不宣布达标）

**Node v24.19.0 / win32 x64 / AMD Ryzen 5 5600U / WASM 72,881 B `715CD770…`**（15 次热运行，1 次预热不计；详见 `03-性能原始数据\`）：

| 口径 | raw（ms） | min | median | max |
|---|---|---|---|---|
| 冷启动/首次加载（新 AppStore init + 载入 WASM） | 0.344,0.343,0.314,0.288,0.278,0.266,0.258,0.258,0.273,0.263 | 0.258 | 0.276 | 0.344 |
| WASM 核心-only（仅入口调用） | 1.167,0.800,0.787,1.068,0.814,0.829,0.853,1.119,0.986,0.966,0.966,1.106,1.134,1.139,1.402 | 0.787 | 0.986 | 1.402 |
| 桥接+复制/释放 | 2.450,2.464,0.904,1.033,0.948,1.024,1.006,1.842,1.188,1.168,1.459,1.357,1.268,2.477,1.443 | 0.904 | 1.268 | 2.477 |
| 页面端到端（store.refreshPlan 全流程，不含真实 setData 渲染） | 0.703,0.859,1.052,0.885,0.806,0.740,0.770,0.759,0.773,0.972,0.654,0.729,0.893,0.793,0.664 | 0.654 | 0.773 | 1.052 |
| 冷到首方案（补充口径） | 1.451,1.131,1.108,1.462,2.913,1.441,1.234,1.240,1.131,1.248 | 1.108 | 1.244 | 2.913 |

**微信开发者工具模拟器（iPhone 12/13 Pro profile，iOS 10.0.1 模拟）**：核心-only 5 次原始 4.300/1.700/1.300/1.500/1.500，median 1.500；桥接 5 次 3.500/2.600/3.100/2.000/2.200，median 2.600；页面端到端（含 setData 回调）5 次 18.600/13.100/13.400/13.400/12.700，median 13.400；冷启动观测 1 次 **173.00 ms**（JS 启动→首页首次 setData 回调）。**均为模拟器/Node 数值，不能代表红米真机，也不宣布任何门槛达标。**

## 6. 真机与断网：未运行

| 要求 | 状态 | 说明 |
|---|---|---|
| 开发者工具编译/预览 + 模拟器流程 | **已运行**（见 §5.3/5.4） | 工具侧证据已保存 |
| 红米 K90 Pro Max 扫码运行、关键用户流程 | **未运行** | 用户已表示可配合并生成预览二维码，但本次交付前未回传真机操作结果；不填通过 |
| 手机系统级杀进程 → 重开恢复 | **未运行** | 仅完成开发者工具“关闭项目窗口→重开”恢复（§5.4），不等同手机杀进程 |
| 真机断网（飞行模式）离线读取/记餐/导出恢复 | **未运行** | 未取得现场证据；WASM 在包内，离线核心理论可用，但本单不据此宣称通过 |
| 红米冷启动/≥5 次热运行 | **未运行** | 仅 Node 与开发者工具模拟器数值；真机门槛未冻结 |

真机操作清单已备好：`04-微信工具与真机\04-红米真机验证清单.md`（含截图/回传方式）。用户完成并回传后才能把上述项改为实测结果。

## 7. 逐项验收对照

### T05 任务卡完成条件

| # | 条件 | 状态 |
|---|---|---|
| 1 | 首页先三餐/窗口/价格再进度；备选可解释；加载/无候选/数据不足/无解/限额有反馈 | 已实现，Node + 模拟器覆盖；真机未运行 |
| 2 | 同窗换菜优先；确认才入账；重复不重复累计；改撤同步；快照不被覆盖 | 已实现并自动/模拟器通过 |
| 3 | 跨日不继承售罄/锁定；结束/重开/售罄解除/锁定失效有明确动作 | 已实现，Node 覆盖；真机未运行 |
| 4 | 菜单先校验提示影响；取消/失败保留；成功替换旧计划失效；历史快照稳定；导出可恢复 | 已实现，Node + 模拟器通过 |
| 5 | 请求关联版本；旧结果不覆盖；未知不冒称完整；超预算不冒称预算内；真实桥错误可见 | 已实现，Node + 模拟器通过；T02 已过 |

### 提示词“验证要求”

1. 桥真实 ABI/错误处理保留，mock 只作测试 —— 通过（桥测试 13/13；T02 代码复用）。
2. 自动覆盖重复确认幂等、改撤补记、结束重开、未知营养/价格、预算不完整、同窗替换、锁定失效、售罄、跨日隔离、旧响应、菜单预检/取消/失败、成功原子替换、导出恢复 —— 通过（45 test / 447 assert）。
3. 开发者工具与红米分别记证；红米完成关键流程并按用户协助杀进程/重开 —— 开发者工具部分通过；**红米与杀进程未运行**。
4. 离线验证 —— **未运行**。
5. 冷启动/核心/桥/页面四口径，≥5 次热运行、原始值/median/min/max、环境/WASM 哈希绑定 —— Node 完成；模拟器完成核心/桥/页面 5 次与冷启动 1 次；红米未运行；门槛未冻结，只报数值。
6. 错误/空结果/TargetUnavailable/OkPartial/ESTIMATED_DATA/预算不完整在页面可见 —— 通过（模拟器页面 data + Node 断言）。
7. 完成后停止，不自行推进 T06 —— 遵守；等用户/P01 查收。

## 8. 未测项、缺陷与后续交接

### 未测/限制

1. **红米真机、手机杀进程、断网**：未运行（§6），这是本单主要缺口。
2. **真实菜单（T03）缺失**：当前内置菜单是模拟数据，真实窗口/菜名/价格/套餐规则未提供；因此真实产品验收、真实价格与套餐规则未验证。
3. 多窗口/同菜品多 offer 的售罄作用域与换菜跨窗口分支未测（模拟菜单只有 1 窗口）。
4. `wx.chooseMessageFile` 真实选文件交互未测（自动化覆盖粘贴与文件写入；导出写文件已在模拟器真实执行）。
5. 负时区跨日、设备时钟/时区改动的真实场景未测（Node 用注入时钟覆盖日期前进）。
6. `simulator_screenshot` 在本机返回 1×1 图像，UI 证据以页面 data + 真实 WXML 文本为准，不是截图。
7. TS 注释率 8.1% < 课程 20%：本轮未补无意义注释；建议在 T06/T09 前按同一口径补有效注释并复测（脚本 `count-comments.mjs`）。
8. `ProfileView.validationErrors` 恒为空数组（页面改用 `saveProfile` 返回的 errors 展示），不影响产品行为，记录为小差异。

### 本轮发现并修复的问题

- `applyRestore` 往返时因 backup 元数据更新导致 comparison 第 8 行不等、误报失败：改为“摘要与文件一致”判定，往返 ok:true + 8 行全 equal。
- `plan.ts` 使用未定义类型 `LogsPlanBudgetInput`（Node 类型擦除不报错、微信 TS 会报错）：已改为 `PlanBudgetInput`。
- `init()` 读取异常未阻止写入：统一为 loadState 非 ok 即 storageFault，`resetLocalData` 可恢复。
- `MealView.flags` 为原始码、`HomeView.lockIssues` 缺 windowId/offerId：已补中文标签与精确解除字段。
- 未知项计数重复 +1：已改为每项只计一次。

### 后续交接（T06/T03/T09，不自行推进）

- T06 接入 T04 新算法/套餐/新 WASM 时：本单请求仍是旧 T02 字段口径（`limits.maxCandidates/maxNodes`），应在 T06 统一迁移到 T01 新搜索字段并核对结果；不要在本单基础上直接覆盖 WASM。
- T03 真实菜单提供后：用“菜单与备份”页导入（核心预检通过后确认替换），再把模拟菜单标注切换到真实来源；真实价格/套餐规则仍需 T03 材料。
- 真机/断网/杀进程证据补齐后再请求 P01/P02 查收；本单不冒充这些项通过。
- 注释率整改建议由 T06/T09 统一安排（同脚本同口径复测）。

## 9. 证据索引

根目录：`Resources\报告\T05-DSH-天科食客页面存储-证据-v1\`

| 路径 | 内容 |
|---|---|
| `00-实现接口约定.md` | 并行实现期接口与页面职责约定（历史过程材料） |
| `00-移交前基线\00-交接基线复核.md` | 接手时目录/WASM/输入哈希复核 |
| `00-移交前基线\00-交付产物清单与哈希.md` | 最终 69 个文件逐项哈希与相对基线状态 |
| `01-自动测试\` | run-t05-all、modules、store 原始输出与汇总 JSON |
| `02-真WASM集成\` | 17 场景集成验证原始输出/JSON、两轮真实 WASM 探测输出 |
| `03-性能原始数据\` | Node 四口径原始数值 JSON（含环境/WASM 哈希） |
| `04-微信工具与真机\` | preview 输出/二维码、模拟器运行时验证说明与 `sim-*.json`、自动化会话日志、红米真机清单 |
| `05-存储与导出对照\` | 建档/请求关联/确认幂等/改撤/补记/菜单原子替换/导出恢复/跨日逐项对照 |
| `06-静态检查\` | 类型检查（TS 4.1.2/5.9.3）、页面 WXML/绑定检查、TS 注释率计数 |

## 10. 停止状态

- 本反馈已完成并落盘；**未自行推进 T06、未升级/替换 WASM、未联系反重力/P01/P02、未修改 MEMORY/任务卡/冻结契约**。
- 等待用户/P01 查收；红米真机与断网项如需补测，可按 `04-红米真机验证清单.md` 执行，我方可据结果更新证据与反馈（新版本）。

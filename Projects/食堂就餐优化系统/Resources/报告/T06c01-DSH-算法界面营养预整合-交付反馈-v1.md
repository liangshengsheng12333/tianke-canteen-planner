# T06c01｜DSH｜算法界面营养预整合｜交付反馈

- 日期：2026-10-24（Asia/Shanghai）
- 任务卡：`Resources\任务卡\T06c01-DSH-算法界面营养预整合小卡-v1.md`（v1）
- 依据 PRD：主 PRD v0.2（SHA256 `D68ECE7218BC076155A0AFB6200788B7608898E9D0CDF6ECEC27C5E49AA58FDD`）
- 放行依据：`Resources\报告\双平台-P01-交付核对与并行开发放行-20261024-v1.md`（4,927 B / `4F0662AF…A02D`）
- 反馈文件版本：v1
- 实际 cwd：`D:\项目\cpp`；项目根：`D:\项目\cpp\Projects\食堂就餐优化系统`；候选 cwd：`...\Resources\报告\T06c01-DSH-预整合-证据-v1\candidate`
- P01 指定请求模型：**DeepSeek V4.1 Flash**（主执行员与承接子代理一致）
- 实际模型/版本/档位：本子代理 `t06c01-merge` 现场可见运行标识为 **`deepseek-v4.1-flash-1017`**（与请求一致）。服务端真实路由/子型号/量化档位/额度：**未知**（执行侧无法核实；不把请求配置当作实际证明）。
- 状态：**预整合隔离候选完成，待 T06c v3 合入**。未合入生产、未验收、不代表微信/真机通过。
- 执行性质：单一路（T06c01），只在 `Resources\报告\T06c01-DSH-预整合-证据-v1\` 与本反馈文件写入；未读写并行副本 `T05C01-DSH-川湘套餐闭环-证据-v2\candidate\`，未写生产 `miniprogram\src`、`tools`、`core`、WASM、正式菜单/原始数据。

## 1. 输入（全部只读引用，未改）

| 输入 | 字节 | SHA256 | 实读 |
|---|---|---|---|
| A01b 累计补丁（已含 A01a，未再叠 A01a）`Resources\报告\T05A01b-DSH-分支限界接入-证据-v1\T05A01b-相对共同基线累计补丁.patch` | 103,644 | `AA7A9C4E20075E314FDC6C07E7FC9C969DC682D97512E56B4ED75E83A6D06218` | 是 |
| M02 补丁 `Resources\报告\T05M02-DSH-真实菜单入口-证据-v1\patch\T05M02-真实菜单入口.patch` | 59,855 | `8BDA19BA2C0B5B5FFA9D7A94C4483BDA53D680DD0358802F6F1167938F5368E8` | 是 |
| U07 补丁 `Resources\报告\T05U07-DSH-记录餐次标签-证据-v1\patch\T05U07-vs-baseline.patch` | 44,611 | `34116ECA535592C18AC9E83CECBD11E24739910041F6FEB3CF8317E4E9CB3583` | 是 |
| T03f 菜单 `Resources\真实菜单\西院西一食堂-20261022\T03f-v1\menu-catalog-candidate.json` | 47,653 | `D5039A74B560D45FB187D67B58B9E44298633494CC86DA11ED42A808DAAACA6C` | 是 |
| T03d 正式菜单（对照）`Resources\真实菜单\西院西一食堂-20261022\T03d-v1\menu-catalog.json` | 37,157 | `0657E2B26F2AE19EBAF98322AA9A167E3D0350C8D2132A8FF11F9D037981C607` | 是 |
| 契约 §3 `Resources\契约\T01-v1.2-candidate\contract-v1-candidate.md` | 22,338 | `1248398A…0DB7` | 是（§3） |
| 营养配置 `Resources\契约\T01-v1.2-candidate\nutrition-v1-candidate.json` | 19,077 | `8254AB22DCA9CEEA1E41F575373442781AE7184DE40169041FD02B2E8308D191` | 复制进候选同路径供测试 |
| 三路归集反馈 `Resources\报告\T05A-M-U-DSH-三路功能收尾归集-交付反馈-v1.md` | 11,799 | `0CB87828…7AD7` | 是（重点 §5） |

- 共同基线：`sha256:29deba8f66e85207e7d0fdd87cdf18250b6d5acdfb2853ac42d34b3c86a78d8b`（75 源 / 882,086 B；38 工具 / 447,791 B；冻结 WASM 107,472 B / `B53C7405A643E8409071ED76D3CB4CCBDF1A37E6E5C408CE1D4A373D4CC00744`）。
- 不可读项：无。未读整个项目 MEMORY/历史报告树；`core`/`tools\core` 未改。

## 2. 交付文件（绝对路径 + 大小 + SHA256）

证据目录：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T06c01-DSH-预整合-证据-v1`

| 交付物 | 绝对路径 | 字节 | SHA256 |
|---|---|---|---|
| 隔离候选（源码+工具） | `...\T06c01-DSH-预整合-证据-v1\candidate\`（HEAD `6ff5d331…`，基线提交 `2873fa9`） | — | sourceTreeDigest 见 §3 |
| 候选 manifest | `...\预整合-证据-v1\manifest\manifest.json` | 22,799 | `D3A23D4CD58C5B1A260DA28306CBCB0F9ABEC0D69501EF56197D4415283CD092` |
| 逐文件哈希 | `...\manifest\hashes.sha256` | 12,709 | `FE151345E1A9752440925F241A099A0FDA7B6F36E70782C8DCB12F5DC7E938F5` |
| 相对共同基线累计补丁 | `...\patch\T06c01-相对共同基线累计补丁.patch` | 272,015 | `D7538E515BF14D501CC4528B98DE1B46EFDDFD716989681A387867C377627A12` |
| 冲突处理说明 | `...\预整合-证据-v1\冲突处理说明.md` | — | 见文件 |
| 变更清单 | `...\预整合-证据-v1\变更清单.md` | — | 见文件 |
| 冒烟结构化结果 | `...\smoke\t06c01\t06c01-smoke-result.json` | 2,148 | `BFC30F258AC7E14E181D45830B87EAE30ED6B7D2D43294D26FA0916E608D9D37` |
| 三算法真实请求/响应原文 | `...\smoke\t06c01\requests\{greedy,dp,branchAndBound}.{request,response}.json` | — | 原始文本 |
| 基线/生产只读清单 | `...\manifest-baseline\manifest.json`、`...\manifest-production\manifest.json` | — | 均 `29deba8f…` |
| 补丁复现清单 | `...\manifest-from-patch\manifest.json` | 22,802 | 摘要 `d7868dba…`（应用补丁后与候选一致） |
| 命令日志 | `...\预整合-证据-v1\logs\01…13`（17 个） | — | 原始输出 |
| 唯一反馈（本文件） | `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T06c01-DSH-算法界面营养预整合-交付反馈-v1.md` | — | 本文件 |

## 3. 候选清单（candidate-manifest，收尾态）

- `sourceTreeDigest`：`sha256:d7868dba31cf4fad9d29f956e55e4a6a9a9520679d8d9b70983a0fab1524ea89`
- `miniprogram/src`：**75 文件 / 907,509 B**
- `tools/miniprogram`：**43 文件 / 613,198 B**（基线 38 + A01b 2 + M02 1 + U07 1 + 本卡 1）
- `frozenWasmMatches`：**true**（包内 WASM 未重建、未替换）
- 基线身份复核：候选开工时 `sha256:29deba8f…`、75 / 882,086 B、38 / 447,791 B、`frozenWasmMatches=true`（`logs\01-candidate-baseline-manifest.log`）。

## 4. 补丁与生产复核

- 生成方式：候选内 `git diff 2873fa9 HEAD --binary --output=<补丁>`（UTF-8 无 BOM；早期 PowerShell `>` 重定向曾产生 UTF-16 BOM 版本，已作废并用 git `--output` 重新生成，交付的是后者）。
- 内容：30 文件，3,899 插入 / 383 删除；路径前缀 `a/miniprogram/...`、`a/tools/...`，可在项目根直接应用。
- 生产根 `git apply --check`（只检不改）：**退出 0**。
- 生产未漂移：收尾重跑生产 `candidate-manifest.mjs` → `sha256:29deba8f66e85207e7d0fdd87cdf18250b6d5acdfb2853ac42d34b3c86a78d8b`、75 / 882,086 B、38 / 447,791 B、`frozenWasmMatches=true`（`logs\13-production-manifest-after.log`）；WASM `B53C7405…CC00744`、T03d `0657E2B2…C607`、T03f `D5039A74…CA6C` 均未变。
- 未写入生产：全程仅只读复制/只读 `--check`；生产 `miniprogram/src`、`tools`、`core`、WASM、正式菜单/原始数据零改动。
- 补丁可复现性自检：只读复制生产 `miniprogram\`+`tools\`+契约营养 JSON 到证据目录临时 `verify-apply\`，用 `git -c core.autocrlf=false apply` 应用累计补丁后重跑 manifest，得到与候选完全一致的 `sha256:d7868dba…4ea89`、75/907,509 B、43/613,198 B（`logs\14-verify-apply-manifest.log`、`manifest-from-patch\`；临时树核对后删除）。
- **行尾注意（交 T06c v3）**：本机全局 `core.autocrlf=true`。在非 git 仓库目录直接 `git apply` 会把 LF 改写成 CRLF（实测文件变大、manifest 摘要变化），合入时请用 `git -c core.autocrlf=false apply <补丁>`；`git apply --check` 只读校验不受影响（生产根已退出 0）。

## 5. 冲突处理说明（摘要，全文见证据目录 `冲突处理说明.md`）

1. A01b 累计补丁：`git apply --check` 退出 0 → 干净应用 14 文件（提交 `13680b1`）；**未再叠 A01a**。
2. M02：普通 `git apply --check` 复现退出 1（`store.ts` 冲突，与归集 §5 一致）；改用 **`git apply --3way`**（候选仓库保留基线 blob，三方=共同基线/A01b/M02），16 文件逐 hunk 合并全部 clean，无冲突标记、无整文件覆盖（提交 `a573581`）。合入后逐个复核 5 个语义交叠文件：
   - `domain/types.ts`：`CatalogSource='builtin'|'simulated'|'imported'` 与 `SUPPORTED_ALGORITHMS/DEFAULT_ALGORITHM/isSupportedAlgorithm/ALGORITHM_*` 共存；
   - `domain/app-state.ts`：`emptyCatalogMeta().source='builtin'` 与算法白名单载入校验共存；
   - `domain/store.ts`：`catalog()` 兜底 `WEST1_MENU_CATALOG` + `catalogSource()`（`catalog===null→builtin`、示例→simulated、其余→imported）与 `saveSettings()` 三算法门共存；
   - `pages/dev/index.ts`：三算法设置 UI 与菜单来源三态展示共存；
   - `pages/menu/index.wxml`：保留 M02 的 `west1Applied` 内置菜单态，算法 UI 不进菜单页。
3. U07 在 A01b+M02 合并态上 `git apply --check` 退出 0 → 干净应用 4 文件，与另两路零文件交叠。
4. 合入后必要整合：内置菜单换 T03f 35 道并重赋身份（见 §6）；按新身份对齐 M02 既有测试常量（menuVersion/catalogHash/来源字节与哈希）与 dp 链路 2 处证据标签文本；新增本卡冒烟脚本。

## 6. 内置菜单 35 道整合（卡面执行边界 3）

- 生成脚本 `scripts\build-west1-menu35.mjs`（25 项校验全 PASS，`logs\02-build-west1-menu35.log`）：
  - 采用 T03f 35 道；**原 T03d 4 道完整对象逐字段不变**；窗口/菜品/报价 ID、价格、餐次/供应、非营养字段与 T03d 一致（canteen/windows/offers/comboRules 键序与内容同 T03d）。
  - 35 道四项营养均为非负安全整数、`nutritionBasis.estimated=true`、来源与份量说明齐全。
  - 重赋 `menuVersion=west1-canteen-batch1-nutrition35-20261024`；用现有 `utils/canonical-json.ts` 的 `canonicalSha256(catalog,'catalogHash')` 重算 `catalogHash=sha256:8bf7f6425bd1e5abfc0d2eef0aae0a3d0312be445374798b2d200d34f736375c`；T03f 旧版本/旧哈希/metadata 不作最终身份（metadata 不进入内置对象）。
  - `WEST1_MENU_SOURCE`：来源路径 T03f-v1、47,653 B、`D5039A74…CA6C`、营养 35 已知 / 0 未知。
- 核心独立复核：`mp_validate_menu` → `valid=true`、`menuVersion/catalogHash=computedCatalogHash` 与内置一致、`counts={windows:5,dishes:35,offers:35,halfOffers:0,comboRules:0}`（`logs\08-test-t06c01-preintegrated.log`）。
- 内置副本：`candidate\miniprogram\src\config\west1-menu.ts` 49,481 B / `5DF67C38…700D`。

## 7. 实际运行与验证（原始结果 + 日志路径）

全部在 `...\candidate` 根执行；TS 用 `node --import ./tools/miniprogram/register-ts.mjs`；日志在 `...\logs\`。

| # | 命令/脚本 | 结果 | 日志 |
|---|---|---|---|
| 1 | `candidate-manifest.mjs`（候选开工） | `29deba8f…`、75/882,086、38/447,791、WASM true | `logs\01-…` |
| 2 | `scripts\build-west1-menu35.mjs` | 25/25 PASS；新 hash `8bf7f642…` | `logs\02-…` |
| 3 | `typecheck-src.mjs` | 微信 TS 4.1.2：0 errors/38 文件；TS 5.9.3：0 errors/38 文件 | `logs\03-…` |
| 4 | `check-pages.mjs` | 全部页面静态检查通过（事件绑定/绑定标识符/标签闭合） | `logs\04-…` |
| 5 | `test-t05a01b-bnb-chain.mjs` | **10/10 PASS** | `logs\05-…bnb…` |
| 6 | `test-t05a01a-dp-chain.mjs` | **13/13 PASS** | `logs\05-…dp…` |
| 7 | `test-t05-menu-default.mjs`（M02 验收，对齐新菜单身份后） | **69/69 PASS** | `logs\06-…menu-default…` |
| 8 | `test-t05-store.mjs` | **28/28 PASS**（node:test） | `logs\06-…store…` |
| 9 | `test-home-view.mjs` | **34/34 PASS** | `logs\06-…home-view…` |
| 10 | `test-logs-page.mjs` | 76 PASS / **2 FAIL（基线既有旧文案断言，与生产一致，未修未掩盖）**，退出 1 | `logs\06-…logs-page…` |
| 11 | `test-core-bridge.mjs` | 12/13 PASS；**1 FAIL = 基线既有 `WASM 缺少必需导出：mp_offer_nutrition`（mock 缺项，生产同样复现）**，退出 1 | `logs\07-…core-bridge…` |
| 12 | **`test-t06c01-preintegrated.mjs`**（本卡自写冒烟，73 项） | **73/73 PASS**，退出 0 | `logs\08-…` / `smoke\t06c01\` |
| 13 | `test-logs-meal-tabs.mjs`（U07 验收） | **85/85 PASS**（light 主题；dark 由 U07 原证据，本卡未重跑） | `logs\09-…` |
| 14 | `verify-t05-integration.mjs`（M02 未跑项，本卡复跑） | **17/17 PASS**；证据 JSON 已复制进 `smoke\tmp05-copies\` | `logs\10-…` |
| 15 | `run-t05-all.mjs`（M02 未跑项，本卡复跑） | **4/4 测试文件 PASS**（test-t05-menu-default/modules/soldout-scope/store）；证据 JSON 已复制 | `logs\11-…` |
| 16 | 候选收尾 `candidate-manifest.mjs --out manifest` | `d7868dba…`、75/907,509、43/613,198、WASM true | `logs\12-…` |
| 17 | 生产收尾 `candidate-manifest.mjs` + `git apply --check` | 生产 `29deba8f…` 未变；补丁 check 退出 0 | `logs\13-…` |
| 18 | 只读复制生产+`git -c core.autocrlf=false apply`+`candidate-manifest.mjs` | 复现候选清单 `d7868dba…`、75/907,509、43/613,198（补丁完整） | `logs\14-…` |

本卡自写冒烟（#12）关键原始结果：
- 三算法各发一单真实冻结 WASM：`plannerConfig.algorithm` 与响应 `search.algorithm` 分别为 `greedy/dp/branchAndBound`，均有方案（`plans.length>0`），三份请求除 `requestId`/`algorithm` 外逐字一致（同输入）。
- 估算显示：35 道热量展示均为“**约 X 千卡**”且 `estimated=true`；首页方案项全部 `nutritionKnown=true`、`estimatedLabel='估算'`、`unknownLabel=''`（无“营养未知/价格待补全”）。
- 首页菜单切换：`menuTitle` 含“西院西一食堂”、`menuBanner` 含“内置真实菜单…切换”，`onOpenMenuSwitch()` 跳转 `/pages/menu/index?focus=import`。
- 记录页三标签：3 个 `mealTabs`（breakfast/lunch/dinner），逐个切换生效、3 餐区块保持、切标签前后持久化原文不变（不写业务数据）。
- 保留语义：旧存储（`catalog=null`＋`source='simulated'`）升级按内置真实菜单解释；真实规划+确认+用户锁后杀进程重开，记录与锁均保留；导入自定义菜单重开不被内置菜单覆盖（`source=imported`）。
- 共享 TMP：`verify-t05-integration`/`run-t05-all` 会写 `Resources\报告\.toolchain\tmp\t05`，本卡只复制自有 2 个时间戳 JSON 到 `smoke\tmp05-copies\`，未删除共享目录或他人文件。

## 8. 逐项验收状态（卡面 §执行边界 1–5）

| 边界 | 要求 | 状态 | 证据 |
|---|---|---|---|
| 1 | 仅在自己证据目录候选工作；不改生产/C01 副本/原交付/核心 WASM；单写入者 | **满足** | 生产 manifest 收尾仍 `29deba8f…`；写入均在 `T06c01-DSH-预整合-证据-v1\**` 与本反馈；未读写 T05C01 目录 |
| 2 | A01b×M02 按行为合并（store/app-state/types/dev/menu），禁止整文件覆盖；保留补丁内必要工具/夹具变更 | **满足** | 见 §5；`--3way` 逐 hunk 合并 + 5 文件行为复核；工具/夹具（M02 新增脚本、A01b 两测试、U07 测试、`test-core-bridge` 等）保留 |
| 3 | 真实菜单换 T03f 全部 35 道估算，原 4 道/价格/ID/供应规则保留；重赋版本、重算 catalogHash；T03f 旧身份不用 | **满足**（隔离候选内） | 见 §6；25 项脚本校验 + 核心 `mp_validate_menu` 一致 |
| 4 | 保留用户菜单/已吃快照/用户锁；空存储默认真实菜单；旧内置菜单走现有预检/确认更新；不静默重写自定义菜单 | **满足**（Node 侧） | §7 #12 保留语义 4 组；M02 `test-t05-menu-default` 69/69 覆盖导入/预检/确认/取消/写失败 |
| 5 | 仅必要编译及冒烟：三算法可保存并产生真实 WASM 请求/响应、首页菜单切换、记录页三餐标签、估算值显示 | **满足**（Node 侧） | §7 #3/#4/#12；完整 Bug/性能/手机矩阵按卡留给最终六窗口候选 |

行为要求补充核对（任务提示 §四.6）：
- 空存储/无有效菜单首开默认真实菜单：满足（首开 0 次业务写入、`catalog` 仍 `null`）。
- 已存旧内置菜单走现有预检/确认更新：满足（旧存储按内置真实菜单解释；自定义菜单仍走 `preflightMenu→applyMenu`）。
- 不静默重写自定义菜单/用户锁/已吃快照：满足（自定义菜单与记录/锁重开保留）。
- 三算法设置可保存并产生对应真实 WASM 请求/响应：满足。
- 首页菜单切换入口可用、记录页三餐标签可切换、估算值正常显示：满足（Node/页面模块级）。

## 9. 未测项（不得视为通过）

1. 微信开发者工具编译/渲染/点击、`wx.navigateTo`/`pageScrollTo` 的真实行为：**未运行**（无微信环境）。
2. 真机（含红米）持久化、杀进程重开、`WXWebAssembly` 下 dp/分支限界耗时与端到端响应：**未运行**。
3. 截图/屏录级视觉证据、深浅色真机对比：**未运行**（M02/U07 的 Node 对比度/主题断言已复跑，不等于真机）。
4. 全量 Bug 矩阵、性能矩阵（DP/BnB/扩充菜单规模）：**未运行**。
5. 35 道营养科学性与来源一手复核：**未做**（沿用 T03f 估算口径，不作为已证实实测）；T03f 的 4 道原对象不变已核对，其余 31 道未做营养学复算。
6. P09/T10 独立验收、与 T05C01 川湘闭环的最终六窗口合并：**未做**（由 T06c v3 接续）。
7. `test-logs-meal-tabs.mjs` 仅复跑 light 主题 85/85；dark 沿用 U07 原证据，未在本候选重跑 dark。
8. 基线既有失败 3 项（`test-core-bridge` 1、`test-logs-page` 2）**未修未掩盖**，与生产基线一致；不属于本卡引入。

## 10. 缺陷与下一负责人

- 本卡未发现阻塞缺陷。已知观察：
  1. T03f 35 道营养为估算值（`estimated=true`），产品口径必须继续显示“约/估算”，不得表述为实测或已通过营养复核；
  2. 生产 `miniprogram` 目录内存在历史 `.git`（只读复制后已从候选移除，未改生产）；候选保留自身 `.git` 便于 T06c v3 `--3way` 复核，manifest 不含 `.git`；
  3. 旧基线失败 3 项与 M02 遗留的微信/真机验证缺口仍待最终候选处理。
- **下一负责人：T06c v3（单一执行员）**——把本隔离候选与 T05C01 川湘闭环按语义合并为六窗口统一开发候选；届时需在授权 TMP 目录复跑集成脚本、补微信开发者工具+真机验证，并处理基线既有失败与真实 Bug/性能收口。本反馈不构成生产合入授权。

## 11. 结论

**预整合隔离候选完成，待 T06c v3 合入**：候选由共同基线 `29deba8f…` 建起（A01b→M02 三方式语义合并→U07 干净叠加），内置菜单换 T03f 35 道全估算并重赋版本/重算哈希，Node 侧必要编译与冒烟全部通过（本卡冒烟 73/73、M02 验收 69/69、A01a/A01b 链路 13/13 与 10/10、store 28/28、home 34/34、U07 85/85、集成 17/17、T05 总入口 4/4）；相对基线累计补丁在生产根 `git apply --check` 退出 0，生产与 WASM/正式菜单未变；微信开发者工具/真机与全量 Bug/性能/营养独立复核**未做**，不写“已验收”。
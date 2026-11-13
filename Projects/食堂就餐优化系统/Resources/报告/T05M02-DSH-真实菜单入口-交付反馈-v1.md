# T05M02｜DSH｜默认真实菜单与快捷切换 · 交付反馈 v1

- 卡片：`Resources/任务卡/T05M02-DSH-默认真实菜单与快捷切换小卡-v1.md`（v1）
- 产品依据：主 PRD v0.2 及其修订记录
- 绝对 cwd（执行时）：`D:\项目\cpp`；项目根：`D:\项目\cpp\Projects\食堂就餐优化系统`
- 共同基线：`sha256:29deba8f66e85207e7d0fdd87cdf18250b6d5acdfb2853ac42d34b3c86a78d8b`（75 源文件 / 882,086 B；38 工具 / 447,791 B；WASM 107,472 B）
- 请求模型（卡片指定）：DeepSeek V4.1 Flash
- 可核实实际模型/档位：**未核实**。本会话运行时自述 `deepseek-v4.1-flash-1017`；客户端可见模型与服务端档位/额度无法从执行侧核实，均记为未知。
- 隔离候选：`Resources/报告/T05M02-DSH-真实菜单入口-证据-v1/candidate/`
- 证据目录：`Resources/报告/T05M02-DSH-真实菜单入口-证据-v1/`（索引见 `证据目录说明.md`）

## 1. 结论

卡片五项验收在 **Node 侧（真实包内 WASM + mock wx + 真实页面模块）全部通过**，统一补丁可干净应用到共同基线并逐字节还原候选；生产目录未改动（`sourceTreeDigest` 仍为 `29deba8f…`）。微信开发者工具/模拟器/真机**未测**，因此本卡判定为「Node 侧通过、微信侧待验」，不冒称整卡在微信环境通过。

## 2. 交付物

1. **完整隔离候选**：`candidate/`（`miniprogram/src` 75 文件 / 884,865 B；`tools/miniprogram` 39 文件 / 482,397 B）
   - 候选 `sourceTreeDigest`：`sha256:471febbdfbe39384c38f45c9fc4ee80abf2a55f74a6cd03da78d4b67bc3a6e14`
   - 候选清单：`candidate-manifest.mjs --out .../manifest` → `manifest/manifest.json`（sha256 `107ce68f52b20be3e3600446bdb15c5547895627b7aa41c5d860f58eb5c7b13a`）、`manifest/hashes.sha256`；`frozenWasmMatches=true`
2. **统一补丁**（相对共同基线）：`patch/T05M02-真实菜单入口.patch`
   - 59,855 B，sha256 `8bda19ba2c0b5b5ffa9d7a94c4483bda53d680dd0358802f6f1167938f5368e8`
   - 16 文件（11 运行时源码 + 4 夹具对齐 + 1 新增验收脚本）；逐文件目的/增删行/前后哈希见 `patch/改动清单.md`
   - 验证：在“改动前文件独立副本”上 `git -c core.autocrlf=false apply --check -p1` 退出 0、`apply` 后 16/16 文件与候选 SHA256 逐个相同
3. **改动前后页面与数据证据**：`pages/T05M02-改动前-默认菜单视图.json`、`pages/T05M02-页面与数据结果.json`、`logs/before-menu-default-probe.log`、`logs/baseline-*.log`、`logs/after-*.log`
4. **深浅色/双模式依据**：`pages/T05M02-页面与数据结果.json` 的 `sections.themeAndMode`（真实 `app.wxss` 令牌 + WCAG 对比度计算 + 页面 class 实测）
5. **生产未改动证明**：`logs/production-manifest-after.log`

## 3. 实际改动（最小必要）

- `domain/types.ts`：`CatalogSource` ∈ `builtin | simulated | imported`。
- `domain/app-state.ts`：新状态 `catalogMeta.source='builtin'`。
- `domain/store.ts`：`catalog()` 空值时回退内置西一菜单；新增 `catalogSource()` 统一判定（`catalog===null`→builtin；示例特征→simulated；其余→imported）；`catalogIsSimulated()/menuInfo()/getDevView()` 改用之。
- `domain/menu.ts`：`buildMenuInfoView` 增加 builtin 分支与提示语。
- `pages/home/index.ts|wxml|wxss`：一行「当前菜单名 + 切换 ›」（无大卡片），`onOpenMenuSwitch` 跳既有 `/pages/menu/index?focus=import`；样式只引用 `--tk-*`。
- `pages/data/index.ts`、`pages/dev/index.ts`、`pages/menu/index.wxml`、`domain/backup.ts`：来源/兜底文案区分 builtin/simulated/imported，不再把内置西一说成示例或导入。
- 测试夹具：`test-t05-store/test-self-pick/test-t05-soldout-scope/verify-t05-integration` 在空存储时预置“已保存的示例菜单”，保持既有断言口径；新增 `test-t05-menu-default.mjs`（69 项检查）。

未改动：C++ 核心、WASM、契约、营养配置、`app.wxss` 令牌、正式菜单数据 `Resources/真实菜单/*`、`config/west1-menu.ts`（内置副本原样）。

## 4. 实际操作与原始结果

均在 `candidate/` 根下运行（Node v24.19.0）：

```bash
# 候选清单
node tools/miniprogram/candidate-manifest.mjs --out <证据目录>/manifest
# 类型检查 / 页面文件检查
node tools/miniprogram/typecheck-src.mjs                                   # exit 0（0 error）
node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/check-pages.mjs   # exit 0
# 回归（13 个文件逐个运行，输出写 logs/after-<file>.log）
node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-t05-menu-default.mjs --out <证据目录>/pages
node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/<其余 12 个 test-*.mjs>
# 生产未改动
(node tools/miniprogram/candidate-manifest.mjs)  # 在项目根运行
```

原始结果：

| 文件 | 改动前 | 改动后 |
| --- | --- | --- |
| `test-t05-menu-default.mjs`（新增） | — | **69 PASS / 0 FAIL**，exit 0 |
| `test-t05-store.mjs` | 28 tests / 28 pass / 0 fail | 28 tests / 28 pass / 0 fail |
| `test-t05-modules.mjs` | 17 / 17 pass | 17 / 17 pass |
| `test-self-pick.mjs` | 13 / 13 pass | 13 / 13 pass |
| `test-t05-soldout-scope.mjs` | 11 / 11 pass | 11 / 11 pass |
| `test-home-view.mjs` | pass | pass |
| `test-calendar.mjs` / `test-today-display.mjs` / `test-month-summary.mjs` / `test-appearance.mjs` / `test-storage-snapshot.mjs` | pass | pass |
| `test-logs-page.mjs` | 2 项既有失败* | 同样 2 项失败* |
| `test-core-bridge.mjs` | 1 项既有失败** | 同样 1 项失败** |
| `typecheck-src.mjs` | 0 error | 0 error |
| `check-pages.mjs` | 20 fails（基线运行缺 `--import` 钩子） | exit 0（加钩子后全部通过） |

\* `test-logs-page` 既有失败：「月汇总只算本月已知花费」「只有未知价格时写“未知（含未填项）”」，改动前后失败名称与断言完全一致，属页面夹具与 `monthPriceLabel` 断言陈旧，与本卡菜单改动无关。
\*\* `test-core-bridge` 既有失败：「loadCore：空 import 对象实例化；缺导出时列出名称」→ `WASM 缺少必需导出：mp_offer_nutrition`（断言陈旧），改动前后一致。
（`check-pages` 基线失败是本卡基线运行方式缺陷：未加载 TS 解析钩子；补齐钩子后基线候选也全绿，已记录不当作回归。）

## 5. 逐项验收

| 卡片验收项 | 结论 | 证据 |
| --- | --- | --- |
| 空存储首开即为西一 | **通过（Node 侧）** | 首开 `getMenuView().info`：`source=builtin`、`simulated=false`、`menuVersion=west1-canteen-batch1-nutrition4-20261023`、`catalogHash=sha256:020f904d…64b5`、5 窗口/35 菜/35 报价、`banner` 含“内置真实菜单”“切换”；`peekState().catalog=null`、`catalogMeta.source='builtin'`、首开 0 次业务写入。对照改动前：`source=simulated`、`menu-simulated-v2`、4 菜/1 窗口（`pages/T05M02-改动前-默认菜单视图.json`） |
| 有自定义菜单重开不被覆盖 | **通过（Node 侧）** | 导入自定义菜单（`menu-t05m02-custom-v1`，摘要复算）后写 1 条真实就餐记录 → 杀进程重开同一 mock 存储：菜单仍为自定义版本/摘要、`source=imported`，记录仍 `active`（`校外盒饭`），首页视图绑定自定义食堂 |
| 首页入口可到切换/确认 | **通过（Node 侧）** | 首页 data：`menuTitle='西院西一食堂 · 内置菜单'`、`menuSimulated=false`；`onOpenMenuSwitch()` 实测 `wx.navigateTo('/pages/menu/index?focus=import')`；菜单页 `onLoad({focus:'import'})` 后滚到 `#data-import`，`west1Applied=true`；`onUseWest1Menu()` 得到“预检通过”凭证 → `onApplyMenu()` 成功替换并写入 `catalogMeta`（走既有 preflight→apply，未新增旁路） |
| 取消不变、失败不破坏旧数据 | **通过（Node 侧）** | 取消：`west1Pending/importReady` 清空、`catalog` 仍 `null`、菜单版本/摘要不变；非法菜单预检 `ok=false/token=null` 且菜单不变；合法预检 + 注入写失败：`applyMenu` 返回「保存失败，已保留原数据」、菜单仍内置西一、`catalog` 仍 `null`、就餐记录保留 |
| 深浅色/双模式下可读 | **通过（Node 侧，样式与数据依据）** | 真实 `app.wxss` 令牌实测对比度：浅色 muted/bg 4.70、accent/bg 5.30、warn-text/warn-bg 5.93；深色 15.12 / 10.93 / 8.42（均 ≥4.5:1）；`.menu-line*` 规则 0 处硬编码颜色、只引用 `--tk-*`；页面 class 实测 `tk-light`/`tk-dark`；简易/完整两种模式下 `menuTitle` 一致（`西院西一食堂 · 内置菜单`），且两模式均 `menuSimulated=false` |

## 6. 兼容与语义说明

- 旧版本存储（`catalog=null` 且 `catalogMeta.source='simulated'`）升级后按内置真实菜单解释、不误标示例；历史字段原样保留不迁移、不覆写（证据：`sections.legacyUpgrade`）。
- 示例菜单仍可显式导入并标注 `simulated`（开发/演示用途保留），只是不再作为默认内容。
- 用户显式点“使用西一食堂菜单”并确认后，`catalogMeta.source='imported'`、`importedAt/importedFileName` 如实记录；首页名称只显示食堂名（不出现来源后缀），菜单页按 `catalogHash` 显示“已启用”。这属于用户主动动作，主页不额外制造来源文案。
- 未加迁移/兼容层、未新增通用框架；存储与输入边界沿用既有 `validateState`/`commit()`/一次性 `pendingMenu` 凭证。

## 7. 未测项（如实）

1. **微信侧全部未测**：未开微信开发者工具、未用模拟器、未真机；页面渲染、`wx.navigateTo`、`pageScrollTo` 真实行为、真机深浅色与字体表现均未验证。Node 侧证据只覆盖逻辑与样式令牌/数据。
2. `verify-t05-integration.mjs`、`measure-t05.mjs`、`run-t05-all.mjs` **未执行**：这三者会把结构化 JSON 写到 `Resources/报告/.toolchain/tmp/t05`（共享证据目录，超出本卡“只写本证据目录 + 唯一反馈文件”的写入边界）。为避免越界，仅做了与既有口径对齐的夹具改动（`verify-t05-integration.mjs`），其通过性未取得本卡运行证据；T06c 合入时应在授权的 TMP 目录下复跑。
3. 未做性能/耗时对比（本卡不涉及）；未做多机型/多基础库兼容测试。
4. 图片级视觉证据（截图）未提供：依赖微信开发者工具，本卡无该授权/环境。

## 8. 缺陷与风险

- 无阻塞缺陷。已知非本卡问题：`test-logs-page` 2 项、`test-core-bridge` 1 项既有失败（见第 4 节），需要对应卡片修复，不在本卡改动。
- 风险提示（交整合卡）：`test-t05-store/test-self-pick/test-t05-soldout-scope/verify-t05-integration` 的 `openStore()` 现在会预置“已保存示例菜单”；后续若新增依赖“空存储默认菜单”的用例，应显式走 `test-t05-menu-default.mjs` 的 `seed='default'` 口径。
- 生产合并必须应用 `patch/T05M02-真实菜单入口.patch`（16 文件），不要只拷 `candidate/miniprogram/src`，否则新增验收脚本与夹具对齐会缺失。

## 9. 生产未改动证明

在项目根 `D:\项目\cpp\Projects\食堂就餐优化系统` 运行：

```bash
node tools/miniprogram/candidate-manifest.mjs
```

输出 `sourceTreeDigest: sha256:29deba8f66e85207e7d0fdd87cdf18250b6d5acdfb2853ac42d34b3c86a78d8b`（75 文件 / 882,086 B；38 工具 / 447,791 B；`frozenWasmMatches=true`）——与共同基线完全一致，生产未改动。原始输出：`logs/production-manifest-after.log`。

## 10. 下一负责人

- 合并/整合：**P01 / T06c** —— 应用补丁、在微信开发者工具+真机补测第 7 节第 1 项、按授权 TMP 目录复跑 `verify-t05-integration.mjs`/`run-t05-all.mjs`。
- 既有失败修复：对应测试卡负责人（`test-logs-page` 月汇总断言、`test-core-bridge` 缺导出断言）。
- 独立复核：P09（只验不修）。
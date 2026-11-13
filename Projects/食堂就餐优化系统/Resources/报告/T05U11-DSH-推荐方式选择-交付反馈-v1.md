# T05U11｜DSH｜推荐方式选择与三算法说明｜交付反馈 v1

- 任务卡：`Resources/任务卡/T05U11-DSH-推荐方式选择与三算法说明-20261026-v1.md`
- 产品依据：主 PRD v0.2（含第 11 节修订解释）
- 执行 cwd：`D:\项目\cpp`；项目根：`D:\项目\cpp\Projects\食堂就餐优化系统`
- 平台：DSH（DeepSeek Harness）；**指定模型：DeepSeek V4.1 Flash**；实际显示模型：`deepseek-v4.1-flash-1017`；运行模式/档位：**未知**（平台不显示档位，未猜测）
- 证据根：`Resources/报告/T05U11-DSH-推荐方式选择-证据-v1/`
- 用户授权：2026-10-26 已授权本卡列出的修改范围

## 1. 输入与交付身份

| 项 | 值 |
|---|---|
| 唯一输入 | `T05R02-DSH-用户包补正-证据-v1/out/dev-v2` → `sha256:ece1cc4dbfafd8b803f8070e71b23762dbbd7a81030701107506b6a282bf66cd`（81 / 1,030,448B） |
| 可重建候选源 | `workcopy/miniprogram`，`baseDir=workcopy` → `sha256:5d1ea69377e340fdacc157b2d268380ab6b8760665bfcb7b3cbd1e050e50178a`（87 / 1,055,036B） |
| 候选改动 | 新增 6、修改 9、删除 0；工具面只改 `check-pages.mjs`（逐项见 `01-输入身份/`） |
| user-v3 | `out/user-v3` 78 / 954,372B / `sha256:335955165e37946128088430f2578429f75f0f8612251207910f4ba3aaf6c868` |
| dev-v3 | `out/dev-v3` 87 / 1,055,036B / `sha256:580b913342e56882717623c6295d6c8d3040bb199fb4d621ed191a00a29fec65` |
| WASM | 111,554 B / `B0098453B7251C2FF39C65B3DF932E7E15975E4252A036196EBF63638A3DC5DD`（未改） |
| 菜单 | `west1-canteen-batch1-nutrition35-chuanxiang6-20261024` / `sha256:23c0eda554226f9ecda0d4b973e57eabc697abe9e5ca34b7058fd45b30ff44ea`（未改） |
| 算法标识 | `greedy` / `dp` / `branchAndBound`，新装默认 `greedy`（未改契约） |
| 未改动 | 生产 `miniprogram`（`a62aced0…`）、T05R02 user-v2（`ada8d989…`）、旧证据、MEMORY、共享契约 |

构建命令（证据根下）：

```
node --import ./workcopy/tools/miniprogram/register-ts.mjs build-user-dev.mjs \
  --source ./workcopy/miniprogram --out ./out --target all --version v3
```

## 2. 改了什么

1. **新增推荐方式选择页** `src/pages/algorithm/*`：三张单选项（快速推荐/全天搭配/深入搜索）+「了解区别」+ 保存；`?first=1` 首次提示模式（保存并开始/稍后再选/返回）。
   - 保存复用 `store.saveSettings({algorithm})`；同值保存不发请求、不动方案；失败回退选中值并明确提示，绝不显示"已保存"。
   - 三种退出（保存/稍后再选/返回）都写 `tk.ui.algorithm-prompt.v1`，只提示一次；跳过不改业务算法（新装仍是贪心）。
2. **共享文案模块** `src/utils/algorithm-choice.ts` + `algorithm-choice-state.ts`：三卡名/短说明/差异说明/共同点/餐次范围/最优性免责声明，全部按批准口径，无编造数字或排名。
3. **今日页**：紧凑单行「推荐方式：<方式> · <算法名>」，可点击切换；属普通用户能力。
4. **我的页**：新增「推荐方式」卡（当前值 + 修改入口）。
5. **教程**：仍 4 步，第 2 步补一句「推荐方式」说明；收尾（完成或跳过）时按「教程从未看过 && 提示未处理」跳转首次方式选择。
6. **domain**：`HomeView.algorithm` 单一展示真值；`getHomeView()` 输出 `settings.algorithm`。
7. **双构建规则**：user 包继续剥离开发页/夹具/诊断原始输出，但**保留推荐方式页与三算法说明**；构建新增 `mustKeep`/`mustNotContain` 断言防止误删或残留。

差异原文：`03-用户界面差异/*.diff`、`ALL-user-source-diffs.patch`；依赖审计：`07-依赖与差异审计/00-依赖与差异表.md`。

## 3. 验证结果（自测，不等于 P01/P09 验收）

| 项 | 结果 |
|---|---|
| 输入身份 + 改动集 + 冻结身份 | PASS（`01-输入身份/input-identity-check.json`） |
| 双包构建 + 独立 manifest | PASS（`02-构建产物清单/`） |
| 同源比较 | PASS：dev 独有 9、内容不同 7、共享相同 71（`04-隔离与同源/build-compare-v3.json`） |
| G1 两包同源真实 WASM | PASS：`sameRequest=true`、`sameResponse=true`、OkPartial（`g1-compare-v3.json`） |
| 两包 × 三算法真实调用 | PASS：请求算法逐次匹配、响应 OkPartial、方案落盘、三次请求互异、两包同算法逐字节相同（`algorithms-v3.json`） |
| 切换失效 + 竞态 | PASS：切换后旧方案清空（`plans=0`、`planCreatedAt=null`）；生成中切换旧响应 `stale=true` 被丢弃，最终 dp（`algorithms-v3.json`） |
| 页面场景测试 | PASS 83/83（`05-用户场景/ui-state-v3.json`） |
| 页面静态检查 | PASS（`08-验证与未测清单/check-pages.log`） |
| TS 类型检查 | 0 error / 44 files × 两套 TS（`typecheck-src.log`） |
| 开发者工具模拟器 user-v3 | PASS 22/22（`simulator-checks.json`，含新装贪心→切 DP→旧方案替换→dp 重算、深浅/简易完整、首次提示、稍后再选、重看不重弹、诊断隔离） |
| 开发者工具模拟器 dev-v3 | PASS（推荐方式行/页保留、诊断页与开发方法可用） |

断言明细：`08-验证与未测清单/00-验证与未测清单.md`；截图索引：`05-用户场景/00-用户场景说明.md`。

## 4. 逐项对照任务卡验收

- 新装/跳过/旧用户：新装默认贪心；教程跳过→首次提示弹一次；稍后再选不改算法；旧用户（教程已看过或提示已处理）不再弹——Node 场景 + 模拟器双证。
- 切换/失败/重复/持久化：切换走 `saveSettings` 且旧方案失效；同值保存不发请求；失败回滚+提示（Node 注入）；持久化跨页面/重开由 store 既有规则与场景测试覆盖。
- 今日推荐区单行与我的入口：两包都有，可点击进选择页；普通用户能力未随 dev 剥离。
- 文案：三卡、共同点、了解区别后的最优性说明与批准口径一致；无新造数字/排名。
- 教程：4 步 + 第 2 步一句。
- 隔离与构建：user 无 dev 页/夹具/诊断；dev 保留；两包均有真实 WASM 调用（G1 与算法矩阵）。
- 冻结：WASM/菜单/算法标识/生产包均未变。

## 5. 未测 / 缺陷

**未测**（详见 08 清单）：安卓真机字体/触控/系统深色；小屏机型（本 CLI 无法切换）；模拟器内 storage 写失败注入（由 Node 场景测试替代）；性能；跨日历史回看组合；读屏/字号放大。

**已知限制/缺陷**：无阻断性缺陷。两点说明：
1. 模拟器截图 `23`/`24` 因今日页自动重算过快而画面相同，已如实标注，不声称捕获"清空瞬间"。
2. user 包 `utils/core-bridge.ts/core-runtime.ts` 等共享 ABI 底层实现保留 `probeAbi/readEnvironmentRows` 等函数（无页面入口、不在页面层暴露），与 R02 已批准的依赖判定一致，不在本卡范围内重构。

## 6. 证据索引

| 内容 | 路径 |
|---|---|
| 输入/候选身份 | `01-输入身份/00-身份核对.md`、`input-identity-check.json`、`verify-inputs.log` |
| 产物清单/manifest | `02-构建产物清单/manifest-{user,dev}-v3.json`、`*-files.txt`、`hashes.sha256` |
| 界面差异 | `03-用户界面差异/` |
| 隔离与同源/算法矩阵 | `04-隔离与同源/` |
| 用户场景（Node/模拟器） | `05-用户场景/00-用户场景说明.md`、`ui-state-v3.json`、`*.png` |
| 开发包诊断 | `06-开发包诊断/00-开发包诊断说明.md` |
| 依赖与差异审计 | `07-依赖与差异审计/` |
| 验证与未测清单/原始日志 | `08-验证与未测清单/` |

## 7. 后续

- 下一负责人：**P01**（接收/汇总；P09 独立复核）。
- 当前状态：功能与自测完成，等待 P01 接收；本轮不再改 T05U11 源码。T06h 将在新隔离副本续接（另一份反馈）。
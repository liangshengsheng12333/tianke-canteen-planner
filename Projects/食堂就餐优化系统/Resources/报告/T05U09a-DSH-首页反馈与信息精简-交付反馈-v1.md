# T05U09a · 首页反馈与信息精简 · 交付反馈 v1

- **任务卡**：`Resources/任务卡/T05U09a-DSH-首页反馈与信息精简小卡-v1.md`（v1）
- **依据**：主 PRD v0.2；`Resources/报告/T06c-DSH-六窗口统一开发候选-交付反馈-v3.md`（统一候选 `e45d7402…`）
- **执行/写入**：DSH 执行子代理 `t05u09a-home` 单写入者（隔离候选内）
- **指定模型**：请求 DeepSeek V4.1 Flash（P01 路由；客户端可见 `deepseek-v4.1-flash-1017`）
- **实际可见模型/档位**：`deepseek-v4.1-flash-1017`；服务端实际路由/档位 **未知**
- **聊天 cwd**：`D:\项目\cpp`（本子代理为受限权限会话）｜**项目根**：`D:\项目\cpp\Projects\食堂就餐优化系统`
- **证据目录**：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T05U09a-DSH-首页精简-证据-v1`
- **状态**：**隔离候选改动完成并通过受影响自检；证据目录完整落盘受限（环境问题，见 §7）**

---

## 1. 输入基线（先自证再改）

| 项 | 值 |
|---|---|
| 生产路径复算（改前） | `sha256:e45d74024c742b93a575236d7aea7becb9dce2c2d6ff34f64400699d20a54d78` |
| 规模 | 75 源 / 985282 B；43 工具 / 625071 B；冻结 WASM 匹配 true |
| 与任务卡指定基线 | 完全一致（未使用旧 `29de…` 候选） |
| 候选基线提交 | `79b43a97435b5a34c182598fc69aa5a4f1c5cbea` `baseline e45d7402` |
| 生产改后复算 | 仍 `e45d7402…`（本任务未写生产） |

## 2. 交付身份（候选）

| 项 | 值 |
|---|---|
| 候选 digest | `sha256:64018bdd280530ab8abe4d0db3b17059cdab2a0eed732eba0a445769f9e786c2` |
| 规模 | 75 源 / 990338 B；45 工具 / 649001 B（新增 2 个针对性测试）；WASM 匹配 true |
| 补丁 | `T05U09a.patch` 37,686 B；`git apply --check` 通过；应用到生产副本后复算 digest 与候选一致 |
| 变更文件 | `miniprogram/src/pages/home/index.ts` / `index.wxml` / `index.wxss`（3 改）+ `tools/miniprogram/test-home-compact.mjs` / `test-home-swap-sheet.mjs`（2 新增） |

**完整工件暂存位置**（受限 shell 无法写项目目录，见 §7）：
`D:\项目\cpp\_t05u09a_work\{candidate,manifest,manifest-baseline,patch,logs,apply-verify,manifest-apply-verify,manifest-production-check}`

## 3. 实际改动（做了什么）

### 3.1 “其他方案”卡：一行状态 + 必要标记 + 可展开说明

- 卡片头只保留标题 + “说明/收起说明”；正文改为**一行状态**：短状态徽标（未建档/待生成/生成中/已就绪/无可用方案/今日已处理/暂不支持/生成失败/需先处理锁定）+ 一句页面本地提示。
- 业务说明（`planMessage`、`lastAction` 等）进入**折叠区**；目标不可用等业务警示仍默认可见。
- **内部实现细节分流**：命中 `WASM|greedy|branchAndBound|comboRules|OkPartial|plannerConfig|algorithm|mp_*|catalog.*|契约级错误|INTERNAL_ERROR|requestId` 的文案不进默认可见区，只进折叠区“技术信息（用于诊断）”，并保留在页面数据 `planTechNotes` 中；
  原始推荐状态码、能力拒绝原文、方案未知策略原名也放技术信息。默认可见区不再绑定 `view.planStatusLabel` / `view.planMessage` / `view.capabilityMessage` / `view.lastAction`。
- 诊断入口仍可读：折叠区“技术信息”+ 指向 `我的 → 数据管理 → 开发诊断`（dev 页未改动，原有技术字段仍可看）。
- **保留的业务信息**：估算 tag、未知价/未知营养标记、预算受限/超预算备选、锁定失效、目标不可用、方案价格与营养偏差、主选/备选切换入口、刷新方案按钮均未删。
- “不足三套合法方案是核心真实结果”改为“不足三套时按真实结果展示，不复制凑数”（去内部词，语义不变）。
- **未改推荐算法、核心/WASM、菜单数据、份量、评分、套餐价、store 判定**。

### 3.2 完整模式宏量百分比标注“供能占比”

- 营养区标题行改为左右两列：“这餐的营养” + “**供能占比**”（26rpx 次要色，跟随深浅色令牌）。
- 百分比数值/比例条/公式/最大余数法分配**未改**；简易模式仍不渲染营养区，保持轻量。

### 3.3 换菜 / 换一份：原生 ActionSheet 三路径

- 复现环境：Node 24.19.0 + 真实页面模块 + mock `wx.showActionSheet`（可配置 success / fail-cancel / fail-other），**不是微信开发者工具/真机原生面板**。
- 成功：详情单菜“换菜”、餐次“换一份”（单可换项直接选替代；多菜先选被替换项再选替代）均能选完并调用 `store.swapOffer(meal, removeOfferId, pickOfferId)`；候选 >6 时仍只列前 6 并提示，不假装全部可选。
- 用户取消：`showActionSheet:fail cancel` → **静默返回**（不换菜、不弹错误、不残留错误、不进入“生成中”）。
- 真实打开失败：非 cancel 的 fail → **1 条可见 Toast「选择面板打不开，请重试」** + 底层 `errMsg` 存入页面 `sheetError`，在“说明 → 技术信息”里可读；不换菜。
- **未按猜测重写选择器、未新增冗余兜底**；只补 fail 分支的取消/失败区分与错误留存（原实现 fail 一律静默，属已定位的可观测缺口）。

## 4. 逐项自检结果（受影响范围，非全量）

执行根 = 候选根；原始逐条日志在 `_t05u09a_work\logs\`，摘要见证据目录 `logs\自检结果汇总.md`。

| # | 命令 | 退出码 | 结果 |
|---|---|---|---|
| 1 | `test-home-view.mjs` | 0 | 34/34 |
| 2 | `test-today-display.mjs` | 0 | 46/46 |
| 3 | `test-t06c-unified.mjs` | 0 | 109/109（三算法+首页入口+六窗口冒烟全部通过） |
| 4 | `typecheck-src.mjs` | 0 | 0 error / 38 文件（TS 4.1.2 与 5.9.3 各一遍） |
| 5 | `check-pages.mjs` | 0 | 10 页静态检查全通过（含首页新绑定根标识符） |
| 6 | `test-home-compact.mjs`（新增） | 0 | 21/21 |
| 7 | `test-home-swap-sheet.mjs`（新增） | 0 | 21/21 |
| 8 | 补丁应用到“生产副本”后复跑 6、7 | 0/0 | 21/21、21/21；digest 复算 `64018bdd…` |

**既有测试期望未改动**：本次没有删除/放松任何既有断言；新增覆盖放进 2 个新测试文件（获批的“针对性验证”范围）。
`test-t05-modules.mjs` 按任务卡不跑（依赖 `Resources/真实菜单`，候选副本内不适用）。

## 5. 未复现 / 未验证（如实）

1. **微信开发者工具编译、真机/客户端原生 ActionSheet 实测**：未做（本机无开发者工具；本窗口不能操作微信）。§3.3 的“成功/取消/真实失败”是 **Node mock**，不能证明 GLM 旧模拟器“三次点击无反应”的根因；本卡只保证页面侧取消/失败分支可区分、失败有可见反馈与错误留存，**根因仍为未定**。
2. **深浅色与两模式视觉溢出**：仅做静态检查（新样式全部走 `--tk-*` 令牌、flex 可换行），**未截图/未真机核对**。
3. **全量回归、性能、P09 独立总审、现场演示**：未做；不得表述为“全量回归通过”。
4. 折叠区文案较长时的极端字号/机型换行未实测。

## 6. 共享文件影响

- 只改 `pages/home/**`（页面私有 TS/WXML/WXSS），未改 `domain/`、`core/`、`utils/`、`app.wxss`、`app.json`、菜单数据/真实菜单/契约。
- 未触碰 `pages/menu/**`（主窗口独占）、`pages/self-pick/**`、`pages/profile/**`、`pages/profile-edit/**`，未读写另两名子代理的 `T05U09b/c` 证据目录。
- `tools/miniprogram` 仅新增 2 个测试文件，未改既有工具/脚本。
- store 层的 `home.planMessage` / `home.capabilityMessage` 等**保持原样**（`test-t05-store` / `test-t05a01a/b` 的既有诊断断言不受影响，本卡未跑这些非受影响脚本）。

## 7. 未完成项与阻塞（重要）

**受限权限导致证据目录无法完整落盘**：本执行子代理的 shell/node 对整个项目目录树无写权限（`UnauthorizedAccessException` / `EPERM`；只有 `D:\项目\cpp` 根可写），审批已禁用、按规则不改 ACL。DSH 文件工具可写本目录文本文件，但不能复制 107,472 B 冻结 WASM 二进制，故候选树/manifest/patch/原始日志**无法由本窗口完整写入证据目录**。

当前证据目录已落盘：本反馈、`环境限制与工件位置说明.md`、`logs\自检结果汇总.md`、`manifest\身份摘要.json`、`manifest-baseline\身份摘要.json`、`patch\补丁说明.md`、`candidate\README-候选位置.md`。
（另有一个早期环境探针遗留文件 `probe.txt`，受限 shell 无法删除，无业务含义。）

**待处理（需 Lead/用户）**：把可写暂存区复制进证据目录（完全权限下一次即可）：

```powershell
$work = 'D:\项目\cpp\_t05u09a_work'
$ev   = 'D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T05U09a-DSH-首页精简-证据-v1'
Copy-Item "$work\candidate"         "$ev\candidate"         -Recurse -Force
Copy-Item "$work\manifest"          "$ev\manifest"          -Recurse -Force
Copy-Item "$work\manifest-baseline" "$ev\manifest-baseline" -Recurse -Force
Copy-Item "$work\patch"             "$ev\patch"             -Recurse -Force
Copy-Item "$work\logs"              "$ev\logs"              -Recurse -Force
```

复制后复算：`node "$ev\candidate\tools\miniprogram\candidate-manifest.mjs"` 应得 `64018bdd…`。

## 8. 下一负责人 / 建议

- P01：决定候选是否进入集中测试；如需合入生产，用 `T05U09a.patch` 应用到 `e45d7402…` 生产树，再复算 manifest 与跑受影响自检。
- 集中测试：重点看折叠区信息取舍是否符合产品意图、失败 Toast 文案、真机原生 ActionSheet（尤其微信宿主取消行为）。
- 若 P01 不认可“技术信息仍能读到 WASM/greedy 等原文”，可改为仅指向 dev 页（删除折叠区技术信息块）——本卡按“诊断入口仍可读”保留，未擅自删除。
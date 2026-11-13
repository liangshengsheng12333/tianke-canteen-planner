# T05U09b · 选菜栏数量金额（隔离 UI 小卡）· 交付反馈

- **任务卡**：`Resources/任务卡/T05U09b-DSH-选菜栏数量金额小卡-v1.md`（v1）
- **唯一输入基线**：生产统一候选 `sha256:e45d74024c742b93a575236d7aea7becb9dce2c2d6ff34f64400699d20a54d78`（75 源 / 985282 B；43 工具 / 625071 B；冻结 WASM 匹配 true），已用 `candidate-manifest.mjs` 在隔离副本复算一致
- **平台/模型**：DSH；请求 DeepSeek V4.1 Flash。客户端可见模型 `deepseek-v4.1-flash-1017`；服务端实际路由/档位**未知**
- **聊天 cwd**：`D:\项目\cpp`｜**项目根**：`D:\项目\cpp\Projects\食堂就餐优化系统`
- **证据目录**：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T05U09b-DSH-选菜栏-证据-v1`
- **状态**：**实现与受影响自检完成；证据落盘受本会话文件权限阻塞，candidate 树与完整 manifest 未落到证据目录**（见 §6，已提供一键补齐脚本）。不是最终验收，未做微信开发者工具/真机。

---

## 1. 改动范围（只改 self-pick 页面，未改生产）

候选内仅 3 个文件变更（`git diff --stat`：135 insertions / 4 deletions）：

| 文件 | 内容 |
|---|---|
| `miniprogram/src/pages/self-pick/index.ts` | 底部栏摘要 `buildFooterSummary`（只拼正式预览已算好的数量/金额，不重算价格）；`footerSummaryText`/`detailOpen` 两个展示字段；`onToggleDetail`；预览失败/阻塞/确认成功时清空或收起明细 |
| `miniprogram/src/pages/self-pick/index.wxml` | 固定底栏新增摘要行（`已选 n 项 · 合计 ￥x`）与“选菜明细”展开面板；确认按钮 `disabled="{{confirming || !canConfirm}}"` **原样未动** |
| `miniprogram/src/pages/self-pick/index.wxss` | 底部摘要/明细面板样式（全部 `--tk-*` 令牌，无硬编码颜色）；页面底部占位 220→340rpx，保留 `env(safe-area-inset-bottom)` |

口径（复用 `domain/self-pick.ts` 的正式预览与 `utils/money-display.ts` 的 `yuan`，页面不复制计价逻辑）：
- 价格全已知：`已选 n 项 · 合计 ￥x`；
- 部分未知：`已选 n 项 · 已知合计 ￥x（另 m 项待补价格）`；
- 全未知：`已选 n 项 · 价格待补`；未选：`还没选菜 · 至少选 1 项才能确认`；
- 任何情况下不出现 `￥0.00` 冒充未知价，也不把已知部分写成完整总价；
- 套餐按 `comboTotal` 计一次，组件不重复成行；明细行价格沿用正式预览的“实付未填/价格待补”口径；
- “选菜明细”只展开/收起页面已有的正式预览行，不重新取数、不改草稿。

未改：`domain/self-pick.ts`、`store.ts`、核心/WASM、菜单数据、套餐价、确认/实付语义；未碰 `pages/home/**`、`pages/menu/**`、`pages/profile/**`；生产 `miniprogram/`、`tools/`、`core/`、`Resources/真实菜单/`、`Resources/契约/` 未写入。

## 2. 交付身份

| 项 | 值 |
|---|---|
| 候选 sourceTreeDigest | `sha256:dcb4fcd0faa7cd80b8dfed4914beed721049dd16ee30475c4e00e4b4518f4aba` |
| 候选规模 | 75 源 / 989553 B（+4271 B）；43 工具 / 625071 B（工具未改）；冻结 WASM 匹配 true |
| 基线（未改） | `sha256:e45d74024c742b93a575236d7aea7becb9dce2c2d6ff34f64400699d20a54d78` |
| 补丁 | `…\证据-v1\patch\T05U09b.patch`（8510 B；落盘缺末尾 LF，`publish.ps1` 会补；补后 `git -c core.autocrlf=false apply` 通过且 3 文件与候选逐字节一致） |
| 暂存完整产物 | `D:\项目\cpp\_t05u09b_stage\`（`candidate\`、`manifest\`、`manifest-baseline\`、`logs-utf8\`、`selfcheck\`、`patch\`） |

## 3. 实际操作与逐项自检（candidate 根）

已在隔离候选（`_t05u09b_stage\candidate`，内容等于 e45d7402 基线 + 本卡改动）实跑：

| 命令 | 结果 |
|---|---|
| `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-self-pick.mjs` | **13 / 13 pass，0 fail** |
| `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-t06c-unified.mjs` | **109 / 109 pass，0 fail** |
| `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/typecheck-src.mjs` | **0 error / 38 文件**（TS 4.1.2 与 5.9.3 各一遍） |
| `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/check-pages.mjs` | 10 个页面静态检查全通过 |
| `selfcheck/self-pick-footer-check.mjs`（本卡页面级自检，真实页面模块 + 真实 AppStore + mock wx） | **27 / 27 pass，0 fail** |

页面级自检覆盖（逐项，日志 `…\证据-v1\logs\14-selfcheck-footer.log`）：
- 未选（底部“还没选菜”、canConfirm=false、明细开关只提示不展开）；
- 单选（`已选 1 项 · 合计 ￥1.00`）；多选+数量（`已选 3 项 · 合计 ￥10.00`）；全部取消回到未选；
- 套餐米饭不重复计价（套餐 ￥12.00 计一次、组件不成行；套餐+米饭 = ￥13.00）；
- 未知价（`价格待补`、不出现 ￥0.00、仍可确认沿用原语义）；已知+未知（`已知合计 ￥12.00（另 1 项待补价格）`）；
- 明细展开/收起；确认按钮禁用表达式未改；
- 底部安全区（`.footer` 与页面占位均含 `env(safe-area-inset-bottom)`）、深浅色跟随 `--tk-*` 令牌（新增样式无硬编码颜色，8 个令牌在 `app.wxss` 均有浅/深两套定义；
  **这是静态核验，不是微信渲染/真机深浅色截图**）。

既有断言无需放宽或删除：受影响测试（`test-self-pick`、`test-t06c-unified`）未改一行，全部原样通过；`test-t05-modules` 依赖 `Resources` 数据，按要求未在候选副本运行。

## 4. 未验证项 / 已知限制

1. **微信开发者工具编译、真机运行、真机深浅色与安全区渲染**：未测（本机无开发者工具）；以上通过项均为 **Node 宿主 + mock wx 或真实冻结 WASM**，**不等同微信/真机验收**。
2. 底部栏在真机字体放大、超长菜名、iPhone 底部横条下的换行/遮挡：仅静态样式与 Node 数据验证，未做真机截图。
3. 未做全量回归、集中测试、P09 独立总审、现场演示；**不得据此宣称全量回归通过**。
4. 未验证微信对 `scroll-view` 在 fixed 底栏内的滚动表现。

## 5. 共享文件影响

- 生产路径只读，未写入；未改其他页面、算法/核心/WASM/菜单/套餐价/契约。
- candidate 中 `tools/miniprogram` 与基线逐字节一致（43 文件 / 625071 B），未新增/修改工具脚本；本卡自检脚本放证据目录 `selfcheck/`，不进入 candidate。
- 本卡只占用 `task-2` 声明的写域；未读写 `t05u09a-home`、`t05u09c-profile` 证据目录，未碰其页面。

## 6. 未完成项与阻塞（必须如实保留）

- **阻塞**：本会话子进程（`node`/`git`/`pwsh`）无法写入项目目录——`New-Item`/`Set-Content` 到 `…\Resources\报告\…` 报“访问被拒绝”，可写范围仅 `D:\项目\cpp` 直属；`write` 工具可写。故 **candidate 树、`manifest\manifest.json`、`manifest-baseline\manifest.json` 未落到证据目录**，实现与自检在暂存区完成。
- **补齐方式**：在具备项目目录写权限的会话运行 `…\证据-v1\publish.ps1`（本反馈同目录下的证据目录），它会：
  1) 从 `D:\项目\cpp\_t05u09b_stage` 复制 candidate 树、manifest、manifest-baseline、5 份日志、自检脚本到证据目录；
  2) 若暂存区已清理，则用生产基线 + `patch\T05U09b.patch` 重建候选（`git init` 基线提交后重算 manifest）；
  3) 补 patch 末尾 LF，并复核候选 `dcb4fcd0…`、基线 `e45d7402…` 与 WASM 匹配。
- 证据目录内 `probe.txt` 为权限探测残留（`write` 工具写入），可删除，不影响交付。
- 环境修复建议：把本会话切「完全权限」，或让执行落盘的子会话 cwd 指向项目根（`D:\项目\cpp\Projects\食堂就餐优化系统`），使文件权限覆盖 `Projects` 子树。

## 7. 下一负责人

P01 决定是否按 `publish.ps1` 落盘/集成；P09 独立复核时以本文件 §2 身份与 §3 实跑为基线，回滚即丢弃 patch（无生产写入）。若需要我在权限恢复后补落盘，回一句即可。
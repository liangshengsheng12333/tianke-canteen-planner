# T05U06a2｜DSH｜记录页隔离版合入与两处精简 · 交付反馈 v1

- 任务卡：`Resources/任务卡/T05U06a2-DSH-记录页隔离版合入与两处精简小卡-v1.md`（v1，2026-10-23）
- 项目根：`D:\项目\cpp\Projects\食堂就餐优化系统`（会话默认 cwd 为 `D:\项目\cpp`，本卡所有命令均在项目根下执行）
- 证据目录：`Resources/报告/T05U06a2-DSH-记录页合入与精简-证据-v1/`（索引见其中 `README.md`）
- 状态：**完成**（任务卡三项已完成，模拟器证据齐全；真机/撤销/补记提交等按卡归 T08，本卡未测）

## 1. 执行配置与实际模型

| 项 | 内容 |
| --- | --- |
| 请求模型 | DeepSeek V4.1 Flash（P01 派单） |
| 实际平台 | DSH 桌面端（`DSH_PROFILE=desktop`，session `session-b60a133e-9ad6-4bc4-9a7a-0a8db59b5f42`） |
| 实际模型/档位 | 运行时自述为 `deepseek-v4.1-flash-1017`；环境中无模型/额度标识，**档位、温度、额度：未知**（不把“请求配置”当实际证明） |
| 辅助工具 | 微信开发者工具 skill CLI `0.3.11`（基础库 `3.17.4`）、Node `v24.19.0`、Windows PowerShell `5.1`、TypeScript `4.1.2`（开发者工具自带）与 `5.9.3`（Antigravity IDE 自带） |
| 授权与权限 | 本会话文件策略为 `danger-full-access`，审批提示关闭；未修改任何 ACL |

本机只有 Windows PowerShell 5.1，`.ps1` 按 ANSI(cp936) 解码会把中文字面量变成乱码（实测 `空日-浅色` → `绌烘棩-娴呰壊`），
因此模拟器采集驱动改为 Node 实现（`verify/run-simulator.mjs`），并用 `wechatide.cmd` 同一条启动链的底层入口调用
开发者工具，避免中文路径/中文截图名经 `cmd.exe` 被打散。

## 2. 合入前核对（任务卡第 1 步前半）

| 核对项 | 结果 |
| --- | --- |
| 正式版 `miniprogram/src` 是否仍等于 T06a2 冻结候选 | **是**。75/75 文件逐字节一致，`equalsCandidate=true`，`sourceTreeDigest=sha256:ed137fa0afe146f62c11ae4f8942b2549850411c173b96f922151c090722099f`（`evidence/baseline-t06a2-match-before-merge.json`） |
| 合入前两目标文件身份 | `index.wxml` 20048 B / `a9e93a95…705fce`；`index.wxss` 4571 B / `1504bb03…829b0d1`（等于候选清单里的期望值） |
| 与隔离版的差异 | 恰好就是待合入的两文件：`index.wxml` → 20254 B / `2c930246…b6e626b`、`index.wxss` → 4881 B / `d6613906…edb17c` |

结论：走“基线一致 → 合入 T05U06a 两文件改动”，未整树复制，未覆盖其他正式版内容。

## 3. 实际改动文件及前后身份

只改了 2 个文件，**没有改 `index.ts`（0 行）**，其他 73 个源文件与 38 个工具文件、冻结 WASM 均未动
（`evidence/verify-isolation-after-merge.json`：与 T06a2 候选相比仅这两个文件不同，`tools` 38/38 一致、`mp_core.wasm` 一致）。

| 文件（相对项目根） | 合入前 | 仅合入隔离版（中间态） | 本次交付（合入 + 两处精简） |
| --- | --- | --- | --- |
| `miniprogram/src/pages/logs/index.wxml` | 20048 B<br>`a9e93a95f1d28bfc87d6fc2aae7095bad62f00ce566f8d0f59487bb059705fce` | 20254 B<br>`2c930246907c06fc8632b524cb4cbd7d78aa5f912cefb906d7684acb3b6e626b`（= T05U06a 隔离版交付哈希） | **20798 B**<br>**`3a44a1074c325cfb8cb135c9dae30fcc18b57ff19258ace97cb25b4e04cfce56`** |
| `miniprogram/src/pages/logs/index.wxss` | 4571 B<br>`1504bb033d93c755d44b69d8e2d839df8af5ab9e9a3c096ee51c41e89829b0d1` | 4881 B<br>`d66139069908fb99046d8366349cfd2b2c2ab5b7dd205576e1ba48ee71edb17c`（= 隔离版交付哈希） | **5937 B**<br>**`d15a9ae75786c43fc99a931c81a159f9b053edd2af608f34f4f4f17d35a93f86`** |

- “中间态”身份由 `evidence/merge-fidelity.json` 机械复核：把本次两处精简按字面反向还原后，两个文件与隔离版
  交付哈希**逐字节相同**（`allMatch=true`）；也就是说合入没有夹带别的改动，精简只有下面这两处。
- 与隔离版的完整差异见 `evidence/diff/refinement-index-wxml.diff`（5 个 hunk）与
  `evidence/diff/refinement-index-wxss.diff`（新增 1 段样式）。
- 两文件均为 UTF-8 无 BOM；末尾换行沿用合入前状态（未额外增删）。

## 4. 两处精简的做法

### 4.1 390px 首屏“营养（已知小计）”挤成多行

根因：共享样式 `app.wxss` 里 `.row-label { flex: 0 0 210rpx }`、`.row-value { word-break: break-all }`，
在 287px 宽的行里标签只剩约 64rpx 内容宽，“营养（已知小计）”7 个字被折成 2 行，数值又被 `break-all` 逐字切断。

做法（WXML 2 处 + WXSS 1 段，不改 `app.wxss` 等共享主题）：

1. 文案：`营养（已知小计）` → `已知小计`（简短直白；同一行上方已有“当日已知/记录”语境，热量单位 `kcal` 与
   蛋白/脂肪/碳水标签仍在数值里，语义不减）。
2. 给该行加 `row-nutrition` 类（“已记记录”和“历史回看记录”两处都加）。
3. 只在该行覆盖布局：标签 `flex: 0 0 auto; white-space: nowrap`（按内容定宽、不折行）；数值占剩余宽度，
   `word-break: keep-all`（禁止在汉字之间断行，不再拆“蛋/白”“脂/肪”）+ `overflow-wrap: break-word` 兜底 +
   `line-height: 1.5`。

效果（390×844 模拟器实测）：标签 **56×21.7**（= 4 个 28rpx 汉字，单行），数值 **223.3×48**（两行，只在空格/标点处换行，
`word-break` 计算值为 `keep-all`）；行高 64.7 → 记录卡不再被撑成 4–5 行。简易模式与完整模式都量过
（`sim-03e`、`sim-05d`），数值文案仍是 `320 kcal，蛋白 7.0g，脂肪 8.0g，碳水 6.0g`，未知营养仍由原逻辑输出
“营养未知/待补全”，**没有把未知当 0**。

### 4.2 空日首屏“记一餐”+ 三张未记餐卡重复冗长

做法（只动布局/折叠/文案，不重构业务，不删入口）：

1. 空日（`emptyDay` 为真）时餐卡加 `meal-card-slim`：`margin-top: 16rpx; padding: 24rpx 28rpx`，把原来
   上下两排按钮的大卡片压成“餐次名 + 状态”一行、按钮一行。
2. 两个按钮组（补记食物 / 结束·重开）加 `meal-actions`；空日时 `display: inline-flex` 且并排（组间距 12rpx），
   非空日仍是普通块级按钮组（不受影响）。
3. 空日的每卡重复说明 `sec.confirmHint` 隐藏：`wx:if="{{!emptyDay || sec.ended}}"`——“已结束/无方案”语义在
   `sec.ended` 时仍显示，其余重复说明由空日卡承担。
4. **入口全保留**：总入口“记一餐”、每卡“补记食物/结束餐次”都在；`id="meal-{{sec.meal}}"` 保留，
   `onEmptyRecordTap` 需要滚到的 `#meal-*` 节点未被隐藏、未改结构。

效果（空日首屏实测）：三张餐卡 top 分别 276.2/388.4/500.6，第三张 bottom **604.9 < windowHeight 753**，
三卡 + “记一餐”（top 203.2）全部在首屏；每卡两枚按钮同一 top（322.75 / 434.9 / 547.2）即并排一行；
空日 `.meal-card .note` 命中数 0（`confirmHints=[]`）；`.meal-card-slim` 计算 padding-top 12px、
`.meal-actions` 计算 `display:inline-flex`；已记日 `slimCards=0`（紧凑样式不外溢）。

取舍：没有采用“空日只留一行、点开才展开餐卡”的更激进折叠——那需要改 `index.ts` 的页面展示状态，超出本卡
“轻量处理”的边界；本卡选择压缩视觉长度、保留全部路径。

## 5. 检查命令与结果

均在项目根执行，原始输出见 `evidence/static-checks/` 与 `evidence/simulator/run-log.txt`。

| # | 命令 | 结果 |
| --- | --- | --- |
| 1 | `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/check-pages.mjs` | 全部页面 PASS；`pages/logs`：WXML 标签闭合、**事件绑定 23 个均有对应方法**、**WXML 绑定根标识符 38 个均可解析** |
| 2 | `node tools/miniprogram/typecheck-src.mjs` | `0 errors across 38 files`（微信开发者工具 TS 4.1.2）；`0 errors across 38 files`（Antigravity TS 5.9.3） |
| 3 | `node <证据目录>\verify\make-change-evidence.mjs --out <证据目录> --before …\prod-identity-before.json` | `mergeFidelity allMatch=true`；两文件前后身份见 §3 |
| 4 | 复跑 T05U06a 隔离校验脚本（`--out` 指向本证据目录） | 与 T06a2 候选相比**只有**两文件不同，`tools` 38/38、`wasmMatches=true` |
| 5 | `node <证据目录>\verify\run-simulator.mjs --out …`（微信开发者工具模拟器 390×844） | 9 张截图 + 逐项测量；console 过滤 `error|fail|exception` 为空 |

模拟器侧基本操作（任务卡验收口径）：

| 操作 | 证据 | 结果 |
| --- | --- | --- |
| 空日“记一餐”能展开对应表单 | `02-…jpg`、`sim-02a`、`sim-02-…data.json` | 点击后滚到当段餐次并展开补记表单：`manualOpenMeals=["dinner"]`（19 点 → 晚餐），`manual` 表单与“提交补记/取消”可见 |
| 月历可展开 | `06-…jpg`、`sim-06`、`sim-06b` | `calendarOpen: true → false`，按钮文案“查看月历/收起月历”同步 |
| 历史只读 | `07-…jpg`、`07b-…jpg`、`sim-07a`、`sim-07b` | `readonly=true`、`businessDate=2026-10-22`；只读页可写入口命中数 **0**；无“记一餐”、无“补记食物/结束餐次” |
| 底部导航 | `sim-08` | `.tabbar` 文本 `今日记录我的` |
| 视口 | `sim-09` | `windowWidth 390 / windowHeight 753 / screenHeight 844 / pixelRatio 3 / theme light` |
| 未知营养不当零 | `05b-…jpg` | “当日已知”能量/蛋白质/脂肪/碳水为“未知”，另有“未知项 2 项（不按 0 计入）”与“营养不完整…”提示 |

## 6. 逐项验收状态

| 任务卡条目 | 状态 | 依据 |
| --- | --- | --- |
| 第 1 条：先核对基线，再按差异合入两文件；不整树复制；必要时才动 ts | **满足** | §2、§3；`index.ts` 0 行改动 |
| 第 2 条：390px“营养（已知小计）”与数值不再挤成多行；保留热量与三大营养素已知/未知语义；简易/完整都可读 | **满足**（模拟器） | §4.1；`sim-03e/03f/03g/03h/03i`、`sim-05d` |
| 第 3 条：空日首屏去重复冗长，但保留选早/午/晚并实际补记、结束的路径；不隐藏滚动目标节点 | **满足**（模拟器） | §4.2；`sim-01f`、`01e/01g`、`02a`；`#meal-*` 未动 |
| 验收：空日 / 已记浅色 / 已记深色 / 完整模式各一张关键截图 | **满足**（另附 5 张） | `01`、`03`、`04`、`05`（+`02`、`05b`、`06`、`07`、`07b`） |
| 验收：记录页受影响的绑定/类型检查 | **满足** | §5 第 1、2 项 |
| 验收：记一餐展开 / 月历展开 / 历史只读 / 底部导航 | **满足** | §5 基本操作表 |
| 边界：未知营养不当零、推荐不当已吃 | **满足**（未改逻辑） | §4.1、`05b-…jpg`；推荐与已吃语义由原有代码保证，本卡未触碰 |
| 边界：不改正式菜单、WASM、核心、共享主题、其他页面 | **满足** | `verify-isolation-after-merge.json`（仅 2 文件差异、tools 38/38、wasm 一致） |

## 7. 未测项（按卡留给 T08 或他人）

1. 真机；红米端左端挤压；系统深色跟随（本卡深色是页面内主题切换，不是系统跟随）。
2. 撤销（记录卡“撤销”按钮只截图未点）；补记提交（`提交补记` 只截图未提交）；结束/重开餐次的实际写入。
3. 全量回归、其他页面、390px 之外的机型宽度、滚动到底部的完整视觉、动效/长按。
4. 缓存/升级路径（正式版既有本地数据在合入后首次打开的表现）未专门构造验证。
5. P02 查收、P09 独立复核由对应岗位完成，本反馈不代填通过结论。

## 8. 候选身份（供 P01 裁定）

| 项 | 值 |
| --- | --- |
| 新候选（正式版当前工作树） | 75 个源文件，`sourceTreeDigest = sha256:d15bbe0eb2a73e9eba230c819288e9db180487df4ea1ab7b90516482e290f19e`（与候选清单同一算法，由隔离校验脚本算出） |
| 相对 T06a2 冻结候选（`ed137fa0…`） | 只差 `pages/logs/index.wxml`、`pages/logs/index.wxss` 两文件 |
| 工具链 | 38 个文件未变（`tools` 38/38 一致） |
| 冻结 WASM | `mp_core.wasm` 未变（`B53C7405…00744`） |
| 备注 | 本卡未命名/未冻结新候选；建议 P01 裁定后由 T08 在同候选上验撤销/补记提交/系统主题/红米端 |

## 9. 说明与风险

1. 截图均为**微信开发者工具模拟器**（390×844、导出 459×990 JPEG），不是真机；不能据此宣称真机通过。
2. 文案改短只作用于记录卡内该行的“标签”，`index.ts` 生成的营养串（含“待补全/营养未知”）未改，因此未知语义
   与完整模式的逐项展示保持原样。
3. 精简 2 保留全部入口，属于“压缩视觉长度”而非“减少入口”；若 P01 期望更激进的折叠（空日只留一行餐次、点开
   才展开），需要动 `index.ts` 展示状态，请另开卡。
4. `evidence/diff/*.diff` 生成时给两份临时副本末尾补了换行以避免 diff 末尾对齐怪异；生产文件本身未补。
5. 未修改 `MEMORY/`、未修改 P01/P02 记录文件、未启动 T05U06b、未与反重力 T07b 证据交叉覆盖。
6. 证据目录内 `SHA256SUMS.txt` 给出交付文件与全部证据文件的 SHA-256；`evidence/prod-identity-before.json` 为合入前
   的 75 文件快照（本机快照脚本自算摘要，与候选清单摘要算法不同，故两者数值不可直接比大小，用途是“起点可回溯”）。

## 10. 下一步

- 交 **P02 查收**（读本文件 → 读 §3 产物与证据 → 按卡核验），再由 **P01 裁定**是否接收为下一轮 UI 候选。
- 本反馈完成后停止，不自行启动 T05U06b；撤销/补记提交/系统跟随主题/红米端按卡在 T08 同候选验证。
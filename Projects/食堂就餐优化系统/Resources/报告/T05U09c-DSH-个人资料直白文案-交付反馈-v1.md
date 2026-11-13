# T05U09c · DSH · 个人资料直白文案小卡 · 交付反馈 v1

| 项 | 内容 |
|---|---|
| 任务卡 | `Resources/任务卡/T05U09c-DSH-个人资料直白文案小卡-v1.md`（小卡 v1） |
| 主 PRD | `Resources/主PRD` 主 PRD v0.2（按 P01 派单） |
| 平台 / 执行位 | DSH 平台执行子窗口（teammate `t05u09c-profile`），派单方 P01 / Lead |
| 派单请求模型 | DeepSeek V4.1 Flash |
| 实际模型 / 档位 | 客户端可见 `deepseek-v4.1-flash-1017`；**档位未知**；**服务端实际路由/配额未知**（不可核实，不写成证明） |
| 绝对 cwd | `D:\项目\cpp`（项目根 `D:\项目\cpp\Projects\食堂就餐优化系统`） |
| 日期 | 2026-10-24（Asia/Shanghai） |
| 结论 | 小卡三项要求中：直白文案、未保存预填标注与三态边界**已实现并自验通过**；主题缺陷**未复现**，如实记录，未改主题代码 |

## 一、输入 / 产物版本与哈希

| 对象 | 身份 |
|---|---|
| 输入基线（生产 `miniprogram`，只读） | `sha256:e45d74024c742b93a575236d7aea7becb9dce2c2d6ff34f64400699d20a54d78`；75 文件 / 985282 B；tools 43 / 625071 B；WASM `B53C7405…` matchesFrozen=true |
| 交付候选（隔离副本） | `sha256:a9ec20e566c531a504c1e8266c1cf0ba15ada2ba5a416e259082f0e570e6cc04`；75 / 986669 B（+1387 B）；tools 43 / 625071 B（未改）；WASM matchesFrozen=true |
| 候选树位置（含真实 WASM，暂存区） | `D:\项目\cpp\_dsh_work_T05U09c\candidate`（git 基线提交 `916a654 baseline e45d7402`） |
| 规范字节补丁 | `D:\项目\cpp\_dsh_work_T05U09c\patch\T05U09c.patch`，11608 B，sha256 `cee609ba487e3431b230c595bfeb48af45b63f2209798b7e526adabeee5952b4` |
| 证据目录 | `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T05U09c-DSH-个人资料文案-证据-v1` |
| 证据目录内可读补丁 | `patch/T05U09c.patch`，11564 B，sha256 `167c779dda2c1216a6e9e67eef9d14c239d1a7048892499afff8d5e2e6d2b95f`（LF 化 + 末尾 `--`；两步应用后 75 文件 0 差异） |
| 候选/基线完整 manifest | 暂存区 `manifest\manifest.json`（sha256 `323629e7…`）/ `manifest-baseline\manifest.json`（sha256 `05554e62…`） |

改动范围：4 个文件，`git diff --stat` = **4 files changed, 40 insertions(+), 22 deletions(-)**

| 文件 | 候选 sha256 |
|---|---|
| `miniprogram/src/pages/profile/index.ts` | `89808cb8bc404f988473ee6194d9e96e1c525bac2bb355e3ecba9b6f6ace8bdc` |
| `miniprogram/src/pages/profile/index.wxml` | `0c22bdabbe4f69fc738cc67e0662663edef0e764aeb8ece2aea73cf5ca99c15d` |
| `miniprogram/src/pages/profile-edit/index.ts` | `271ccf3ec93cb73a9c5a2921f604529109118740b6608978bd90852a442b9c3b` |
| `miniprogram/src/pages/profile-edit/index.wxml` | `822c102daea1580fbd90da69c51a41200051e2efb8e291356d9d8f79ac1b713e` |

## 二、实际操作（关键决定与改法）

1. **先核对基线**：用生产目录自带 `tools/miniprogram/candidate-manifest.mjs` 生成生产清单，得 `e45d7402…` = 派单指定基线，才开工。
2. **隔离副本**：把生产 `miniprogram`（去掉空 `.git`）+ `tools/miniprogram` 拷到 `_dsh_work_T05U09c\candidate`，`git init -b main`、`core.autocrlf false`、提交基线 `916a654`；生产树不作任何写入。
3. **只改两个页面**（`pages/profile/**`、`pages/profile-edit/**`）：
   - 标题/按钮/结果去实现细节：`计算目标（WASM）`→`计算营养目标`、`保存档案`→`保存资料`、`营养目标（WASM）`→`每日营养目标`、
     我的页卡片 `当前目标`→`每日营养目标`、`BMI（WASM）`→`BMI`、`状态`→`目标状态`、`适用性/适用/不适用`→`能否用于自动规划/可以/暂不可以`（去掉 `status` 代码括号）；
     WXML 中“C++ WASM 由核心计算”“调用核心”“本页不套公式”“满 18 岁…核心适用性”等改为用户口径。
   - 未保存预填：`profile-edit` 新增 `editingNote`（`buildEditingNote`），未保存时显示
     “下面的数字是默认示例（还没有保存），保存后才会生效；未保存的修改不会用于计算每日目标。”；
     徽标改为 `默认示例 · 未保存` / `编辑中 · 未保存`；保存块加两条说明：只有点“保存资料”才写入、取消编辑丢弃本次修改、
     “计算营养目标”只吃已保存资料。
   - 目标卡新增编辑态提示：正在编辑时，卡内目标仍来自已保存资料，表单未保存修改不参与。
   - `profile` 页 `targetSub` 与 hero-sub 改直白表述，指向“个人资料 → 编辑资料 → 保存后生效”。
4. **不改的地方**：`domain/store.ts`、`utils/appearance.ts`、`app.json`、WXSS、其他 8 个页面、`tools`、`core`、`Resources/真实菜单`、`Resources/契约` 均未动；
   既有测试断言未改（tools 43 文件哈希与基线全等）。
5. **主题**：只按“是否真实复现”核对，未重建主题框架（详见第四节）。

## 三、验证结果（原始输出见证据目录 `logs/`）

| 检查 | 命令（cwd = 候选根） | 结果 |
|---|---|---|
| AppStore 行为测试 | `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-t05-store.mjs` | **28/28 pass, 0 fail**（含真实 WASM 身份断言） |
| T06c 六窗口统一冒烟 | `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-t06c-unified.mjs --out <logs\t06c-unified-out>` | **109/109 pass, 0 fail** |
| 类型检查 | `node tools/miniprogram/typecheck-src.mjs` | **0 errors / 38 files**，TS 4.1.2 与 5.9.3 各一轮 |
| 页面静态一致性 | `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/check-pages.mjs` | **10 页全 PASS**（标签闭合、事件方法、绑定标识符） |
| 本卡四态 × 双主题自验 | `node D:\项目\cpp\_dsh_work_T05U09c\verify\verify-t05u09c-states.mjs` | **57/57 pass, 0 fail** |
| 证据复算（现跑） | `powershell -NoProfile -ExecutionPolicy Bypass -File <证据目录>\verify\recheck.ps1` | **RECHECK PASS（12/12）**：候选摘要、生产仍为基线、补丁应用后 75 文件 0 差异、改动仅 4 页 |

自验覆盖（`logs/20`）：A 未保存四态（进入编辑/输入/取消/保存）、B 已保存四态（进入编辑未提交/取消/保存新版本）、
C 文案断言（WXML 不含 `WASM`/`C++`、两页出现“每日营养目标”、按钮改名、默认示例提示、未保存修改不参与）、
双主题（`tk-light`/`tk-dark` 与导航栏颜色参数）。其中 B6 另证：保存新版本后历史记录与业务日数据逐字节未被重写、revision 仅 1→2。

## 四、主题结论（如实记录：未复现）

- T06c v3 反馈提到“深色底 + 白色导航栏”现象（旧报告 12/33 条）。本次在**当前候选**上按页面实际代码路径核对：
  - `pages/profile`、`pages/profile-edit` 两页 `onShow` 都调用 `utils/appearance.ts` 的 `applyPageAppearance()` + `applyWindowTheme()`；
  - Node 桩记录到的实际调用：浅色 `#f5f6f8` 底 + `#000000` 字；深色 `#111416` 底 + `#ffffff` 字；页面根 class 分别为 `tk-light`/`tk-dark`；
  - `app.json` 是静态 `#f5f6f8`/`black`，但两页进入后都由 `applyWindowTheme` 覆盖。
- 因此：**在本候选上没有复现该缺陷，故未改任何主题代码、未重建主题框架**；不把旧报告当作已证根因。
- 若 P09/P01 仍要追这条：需要真机复现信息（机型、微信版本、是否冷启动、是否从其他 tab 切入、是否在 `onShow` 之前截图），本卡不擅自动主题层。

## 五、未测项（不声称通过）

- 未做微信开发者工具编译/预览、真机四态与双主题目视、真实点击流、包体/性能检查；
  上述自检均为 **Node 宿主 + mock wx + 包内真实冻结 WASM**，`Page()/setData` 是测试桩。
- **不声称全量回归通过**：只跑了与本卡受影响相关的 4 项自检 + 本卡自验 57 项。
- 主题缺陷的真机复现未做（见第四节）。

## 六、缺陷 / 风险 / 阻塞

1. **写入边界（非代码缺陷，影响交付形态）**：命令侧低完整性沙箱无法写本项目树；
   `write` 工具可写但会归一文本（CRLF→LF、去文末换行）。因此含真实 WASM 的候选树、完整 manifest/hashes、
   结构化结果 JSON 留在暂存区 `D:\项目\cpp\_dsh_work_T05U09c\`；证据目录内给出路径 + sha256 + 现跑复算脚本
   （`verify/recheck.ps1`）作为等价证明。若需把它们放进项目树，需要一个能写本项目树的执行上下文。
   日志转写回比结果（证据目录 vs 暂存区原件）：`10`（首轮有 2 处计时数字误抄，已按原件改正后逐行一致）、
   `11`（仅少 1 个文首空行，其余逐行一致）、`12`/`13`/`20`（逐行一致）；`00`/`30` 为本包新写，无原件。
2. 证据目录内 `patch/T05U09c.patch` 因上述归一与规范补丁字节不同（11564 B vs 11608 B），
   已实测“两步应用后与候选 0 差异”（`patch/应用说明.md`、`logs/30`）；规范字节版在暂存区。
3. 证据目录内 `patch/T05U09c.patch.b64` 为**已废弃**文件（base64 转写在通道上出现字符损失），文件内已写明勿使用。
4. 无功能性缺陷遗留；`pages/profile`、`pages/profile-edit` 之外无改动。

## 七、下一负责人

- **P09**：按 `Resources/报告/T05U09c-DSH-个人资料文案-证据-v1/README-证据说明.md` 复核（可现跑 `verify/recheck.ps1`），
  重点核 4 个文件文案口径、57 项自验与“主题未复现”的结论是否接受。
- **P01**：决定 (a) 是否接受暂存区交付形态或安排具备项目树写权限的上下文搬入文件；
  (b) 是否需要补真机主题复现（需指定机型/路径）再决定是否开后续主题卡。
- 后续卡若再改 `pages/profile*`，需重开候选与证据，不复用本包结论。

## 八、证据位置汇总

- 证据目录：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T05U09c-DSH-个人资料文案-证据-v1\`
  （`README-证据说明.md`、`logs/00…30`、`manifest/摘要.md`、`manifest-baseline/摘要.md`、`patch/`、`verify/recheck.ps1`）
- 暂存区（候选树/完整清单/规范补丁/结构化结果）：`D:\项目\cpp\_dsh_work_T05U09c\`
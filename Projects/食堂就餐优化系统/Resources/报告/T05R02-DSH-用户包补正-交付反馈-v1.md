# T05R02 DSH 用户包开发残留补正 — 交付反馈 v1

## 一、任务与输入

- 任务卡：`Resources/任务卡/T05R02-DSH-用户包开发残留补正-20261025-v1.md`（v1）
- 前置裁定：`Resources/报告/T06g-T05R01-P01-接手例外裁定与用户包补正-20261025-v1.md`
- 主 PRD：v0.2（T05R02 按卡片范围执行，不扩范围）
- 执行 cwd：`D:\项目\cpp`；项目根 `D:\项目\cpp\Projects\食堂就餐优化系统`
- 构建输入（唯一）：`Resources/报告/T05R02-DSH-用户包补正-证据-v1/workcopy`（复制自 T06g 冻结候选，复制后重算校验）
  - sourceTreeDigest `sha256:910b4470b7e256154f9b5dc588122d4eaa64d94bd4341a1d326b27b8edc97745`，81 文件 / 1030448 B
  - WASM 111554 B / `B0098453B7251C2FF39C65B3DF932E7E15975E4252A036196EBF63638A3DC5DD`
  - 菜单 `west1-canteen-batch1-nutrition35-chuanxiang6-20261024` / `sha256:23c0eda554226f9ecda0d4b973e57eabc697abe9e5ca34b7058fd45b30ff44ea`
- 生产只读核对未变：75 文件 / 1009489 B / `sha256:a62aced0ee327eb208bfac4528b26f9a745bb8130772cbe9c2c83ba7cce0b357`

## 二、执行角色与实际模型

- 执行：DSH 单写入者（本会话）；P01 指定的模型为 DeepSeek V4.1 Flash。
- 运行时平台回报的实际模型标识：`deepseek-v4.1-flash-1017`（照实记录，不作外部验证）。

## 三、产物（绝对路径 + 哈希）

| 产物 | 路径 | 文件数 | 字节 | treeDigest |
|---|---|---|---|---|
| 用户包 | `Resources\报告\T05R02-DSH-用户包补正-证据-v1\out\user-v2` | 72 | 929784 | `sha256:ada8d989f82f9cbd5c77824d416fa9b24a6c958f36bb8962b17ff220569910c4` |
| 开发包 | `Resources\报告\T05R02-DSH-用户包补正-证据-v1\out\dev-v2` | 81 | 1030448 | `sha256:ece1cc4dbfafd8b803f8070e71b23762dbbd7a81030701107506b6a282bf66cd` |

- dev-v2 与 T05R01 的 dev-v1 逐字节同构（treeDigest 相同），dev 规则未变。
- 完整逐文件清单与 sha256：`02-构建产物清单\manifest-user-v2.json`、`manifest-dev-v2.json`、`user-v2-files.txt`、`dev-v2-files.txt`。
- 构建规则/脚本：`build.config.mjs`、`build-user-dev.mjs`（证据根目录）；用户界面覆盖源：`user-overrides/`。

构建命令（证据根目录）：

```powershell
node --import ./workcopy/tools/miniprogram/register-ts.mjs build-user-dev.mjs --source ./workcopy/miniprogram --out ./out --target all --version v2
```

构建内建断言：输入身份 = 910b4470…；WASM/菜单 = 冻结值；user 无 `pages/dev` 注册与目录、无 `simulated-inputs.ts`、无开发方法/夹具/粘贴编辑器/哈希摘要、无“技术信息/诊断”文案；user 必须保留 exportBackup/preflightRestore/applyRestore/refreshPlan/computeTarget/saveProfile 与菜单页文件导入/导出/恢复控件。任一不满足即构建失败。

## 四、本次补正内容（对照卡片第 1—3 条）

1. **user 普通界面**
   - 首页：删除“技术信息（用于诊断）”块（含 planTechNotes、选择面板错误、开发诊断指引）。
   - 数据管理：删除“技术信息 / 次级入口”整卡与“备份摘要与原始数据 / 诊断信息”按钮，删除对应 `onOpenTech`、`onOpenDev`。
   - 我的：提示改为“更新菜单、导出与恢复备份都在这里；恢复前会先预检，确认后才替换本地数据。”
   - 菜单：保留普通“使用/更新西一菜单”与文件导入；删除手动粘贴菜单 JSON、粘贴备份 JSON、catalogHash/摘要/长度等哈希展示、复制到剪贴板、核心错误原文行。保留真实限制说明（营养估算、仅覆盖已录入窗口、comboRules 非空暂不发送核心）。
   - 未用 CSS 隐藏、未保留可达原始数据路由（直达 `/pages/dev/index`、`/pages/index/index` 均不新增页面栈；`?focus=raw` 只打开正常菜单页）。
2. **普通备份恢复**
   - 导出：保留导出→写文件→分享文件；恢复：保留选择文件→预检（格式/版本/摘要/结构）→确认→逐项对照。
   - 删除开发版原始 JSON 编辑/技术摘要面板，但备份摘要计算、结构校验、原子提交逻辑全部保留（store `exportBackup/preflightRestore/applyRestore`、`domain/backup.ts`、`domain/app-state.ts` 未改）。
   - 真实文件选择/系统分享无法自动化，已按“未测”标注；自动化 mock 注入真实导出文件路径的链路单独标为“自动化注入”，不计作真实文件选择通过。
3. **纯开发夹具依赖**
   - 删除 `src/mock/simulated-inputs.ts`、T02 联调探针页 `src/pages/index/`、诊断页 `src/pages/dev/`。
   - user 版 store 移除 `FIXTURE_CASES`、`runFixture`、`measurePerformance`、`getDevView`、`ensureCoreLoaded`、`probeAbi`、`PerformanceSample` 及相应 import；业务方法（JSON 解析/校验、ABI 生命周期、错误处理、菜单判定、备份恢复）全部保留，dev 版 store 与 dev 页原样保留。
   - 依赖先审计后剥离（`07-依赖与差异审计\dev-symbol-consumers.txt`）；未按关键字盲删。

差异逐项表、依赖排除/保留总表、业务能力核查见 `07-依赖与差异审计\00-差异与依赖表.md`；源码差异见 `03-用户界面差异\*.diff`（含 `ALL-user-source-diffs.patch`）。

## 五、实际验证结果（细节与证据索引见 08 清单）

- **两包真实微信编译**：均打开项目窗口并编译页面成功（user 首页、dev 诊断页）；模拟器 iPhone 12/13、WeChatLib 3.17.4。
- **同源**：user/dev 同一 `init→saveProfile→computeTarget→refreshPlan` 请求/响应逐字节相同（request 98311 B `c3ef740f…`，response 10920 B `2c8b8c6f…`，`OkPartial`）；65 个共享文件逐字节相同；WASM/菜单/目标身份不变。
- **user 场景**：教程 4 步走完并记录 `via=finish`；简易/完整与浅色/深色可切换；自选早餐热干面 506 kcal 确认入账；我的→数据管理→更新菜单→西一菜单预检+确认替换成功；旧官方菜单历史状态在升级与替换前后一致，月历可回看 10-25 旧记录。
- **导出/恢复**：导出入盘 71838 字符，`wx.getFileSystemManager().readFileSync` 真实读回 100927 B；恢复预检通过并“逐项一致”（8 项）后恢复，3 天日志保持 10-24/10-25/10-26；非法摘要备份被拒且提示明确（field=digest）。
- **dev 诊断**：诊断页 5 行环境信息、4 个夹具；ABI 探针 ok（5 行、原始 185 B）；夹具 success=OkPartial；计时仅 5 次原始值（不作性能结论）。

关键证据位置：`05-用户场景/`（页面/流程截图与 JSON）、`06-开发包诊断/`、`04-隔离与同源/`、`02-构建产物清单/`、`01-输入身份/`。

## 六、未测项与限制（如实列出，未混入通过数）

1. 真实系统文件选择对话框（`wx.chooseMessageFile` 系统 UI）未测；恢复链路用 mock 注入真实导出文件路径验证，属自动化注入。
2. 系统分享面板 / “分享文件”交互未测。
3. 真机未测；全部结果来自微信开发者工具模拟器，模拟器 ≠ 手机。
4. 未做正式性能测量，不引用性能阈值。
5. 未穷举“简易/完整 × 浅色/深色 × 全部动作”组合（已覆盖组合见 08 清单 G5）。
6. 教程“跳过”路径本轮未复测（T05R01 已测 skip，本轮测 finish）。
7. 恢复“存在不同项”分支未构造复测（本轮恢复前后一致；该分支代码未改）。
8. 真机文件系统路径/权限（模拟器 `http://usr/...`）未测。

## 七、缺陷与观察

- 未发现阻断性缺陷；无新增已知缺陷。
- 观察 1：devtools 自动化 `MPPage.getCurrent` 检查器错误在页面尚未就绪时查询会出现（工具侧现象，非业务错误），已在页面 ready 后重试完成全部检查。
- 观察 2：旧官方菜单升级时 `state.catalog` 会先置空并由内置菜单承接（view 显示 builtin），用户确认替换后才落盘为 imported；历史日志与档案 id 保留，符合现有升级规则（未改逻辑）。
- 未修改：生产、T06g/T05R01 旧证据与旧反馈、MEMORY、共享契约、PPT、性能阈值；未改 ACL；未清理历史产物（本轮只重建自己的 `out/user-v2`、`out/dev-v2`，并删除本轮误留的 2 个重复证据文件）。
- 本轮未自评“验收通过”；结论待 P01 复核与 P02 查收。

## 八、下一负责人

- P01：复核本反馈、evidence 与双包产物，决定是否接受 user-v2 进入后续候选/转交；如需补测真机或真实文件对话框，请指定环境与授权，本任务不自行扩大。
- P02：按批准阶段记录状态与证据位置。
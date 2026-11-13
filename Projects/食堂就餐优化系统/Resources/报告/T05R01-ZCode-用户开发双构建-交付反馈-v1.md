# T05R01｜用户/开发双构建｜交付反馈 v1（第 2 段）

日期：2026-10-25（Asia/Shanghai）。项目根 `D:\项目\cpp\Projects\食堂就餐优化系统`；本段实际 cwd `D:\项目\cpp`，写入只落在本证据目录与这一份反馈。
对应任务卡：`Resources/任务卡/T05R01-ZCode-用户开发双构建-v2.md`（第 2 段），总转交卡 `Resources/任务卡/T06g-T05R01-ZCode-合流到双构建总转交卡-20261025-v1.md`。

## 0. 执行者交接（P01 需追认）

- 第 1 段（T06g）的 `candidate/` 等产物由另一个窗口（ZCode 桌面端）在 22:06–22:08 生成；其客户端/模型档位本窗口不可核实（未知）。23:19 起由本 DSH 窗口接手完成第 1 段验证并落盘（详见 `T06g-ZCode-菜单教程汇合-交付反馈-v1.md`）。
- **第 2 段（本反馈）由本 DSH 窗口全程执行**：实际模型 `deepseek-v4.1-flash-1017`（会话运行时提供），Harness 为 DeepSeek Harness；非 ZCode、非 GLM 5.3。
- 因此 P01 放行前提“同一名 GLM5.3 执行员串行完成两段”已被打破。本段在客观证据上满足第 2 段完成条件（见 §11），但请 P01 明确追认“窗口更换/中途接手”例外，或退回重派。

## 1. 输入身份与复制核对（只读）

| 项 | 值 |
|---|---|
| 第 1 段交付候选（源） | `Resources/报告/T06g-ZCode-菜单教程汇合-证据-v1/candidate`，manifest `sha256:910b4470b7e256154f9b5dc588122d4eaa64d94bd4341a1d326b27b8edc97745`，81 源/1030448B、46 工具/667064B |
| 本段独立副本 | `Resources/报告/T05R01-ZCode-用户开发双构建-证据-v1/workcopy`（整体复制 core/miniprogram/tools，共 2.1MB） |
| 副本复算 | `01-输入身份/manifest.json` = **同一** `sha256:910b4470…c97745`，81/1030448B、46/667064B，`frozenWasmMatches: true` |
| WASM | 111554B / `B0098453B7251C2FF39C65B3DF932E7E15975E4252A036196EBF63638A3DC5DD` |
| C++ planner | 172712B / `30F716892350CD5134D07AB30B6AC3C6DBA55BD8BC31E87284DE7DD3C3A63B51` |
| 菜单身份 | `west1-canteen-batch1-nutrition35-chuanxiang6-20261024` / `sha256:23c0eda5…ff44ea` |
| 生产（只读对照） | `sha256:a62aced0ee327eb208bfac4528b26f9a745bb8130772cbe9c2c83ba7cce0b357`（75/1009489B、45/649308B），本段前后一致（`01-输入身份/production-final/manifest.json`） |

依赖审计（先查依赖再剥离，不盲删）：
- `pages/dev` 仅被 `src/app.json` 注册；
- `src/pages/data/index.ts` 有唯一处理方法 `onOpenDev()` → `wx.navigateTo('/pages/dev/index')`，`src/pages/data/index.wxml` 有唯一按钮 `诊断信息`（`bindtap="onOpenDev"`）；
- `src/mock/simulated-inputs.ts` 虽像夹具，但被**业务** `src/domain/store.ts` 静态 import（`runFixture`、`measurePerformance` 使用），删掉 user 包会编译失败 → 保留，不按“夹具”盲删；
- 其余原始 JSON/哈希诊断能力在 `utils/core-runtime.ts` 等业务依赖模块内，页面层不可达即满足“user 无开发入口”，不做方法级裁剪（超出最小构建范围）。

## 2. 构建方案（最小、可复现）

文件（均在本证据目录）：
- `build.config.mjs`：唯一配置——源候选冻结身份 `910b4470…`、WASM/菜单冻结身份、两个目标（`user`/`dev`）的删除/改写清单；
- `build-user-dev.mjs`：唯一构建入口；
- `compare-builds.mjs`：双包差异/同源比对；
- `same-source-check.mjs`：G1 同请求同响应比对。

命令（实际执行，工作目录 = 本证据目录）：
```
node --import ./workcopy/tools/miniprogram/register-ts.mjs build-user-dev.mjs --source ./workcopy/miniprogram --out ./out --target all --version v1
```

构建规则（与卡对齐）：
1. 先复算源 `miniprogram/src` 身份，必须等于 `910b4470…`（81/1030448B），否则拒绝构建；
2. 每个目标复制到 `out/.staging-<target>-<pid>-<ts>`，按配置删/改，再校验，再写 `build-manifest.json`；
3. **校验**：user 必须无 `pages/dev/index` 注册、无 `src/pages/dev` 目录、全 src 无 `pages/dev|onOpenDev` 引用；dev 必须有注册与页面；WASM 字节/SHA 与菜单 version/catalogHash 必须等于冻结值；
4. 校验全过才 `rename` 成 `out/<target>-<version>`；目标已存在即报错（不覆盖旧输出，需换 `--version`）；
5. 任一步失败：只删本次 staging 并 exit 1，不留“伪完整包”；无静默回退、无猜测路径、不清理其它目录。

`user` 变换（且只有这些）：删 `src/pages/dev/`（4 文件）；`src/app.json` 移除 `pages/dev/index`；`src/pages/data/index.ts` 删 `onOpenDev()` 方法块；`src/pages/data/index.wxml` 删“诊断信息”按钮行（精确片段匹配，命中次数≠1 即构建失败）。
`dev` 变换：无（保留完整诊断页）。

## 3. 构建产物身份

| 目标 | 输出目录 | 文件/字节 | treeDigest（`src/…` 相对路径） |
|---|---|---|---|
| user | `out/user-v1` | 77 / 1000391B | `sha256:27418f70c45f20951bc706f2794548c8b88858f3a68b7b53a5c1fc07f01b4c9a` |
| dev | `out/dev-v1` | 81 / 1030448B | `sha256:ece1cc4dbfafd8b803f8070e71b23762dbbd7a81030701107506b6a282bf66cd` |

- 每个输出根都有 `build-manifest.json`：版本、目标、构建时间、命令、源候选路径与身份、输出逐文件 SHA256/字节数（固定排序）、WASM/菜单身份、变换清单、app.json pages。
- 双包差异（`04-隔离与同源/build-compare-v1.json`，verdict PASS）：仅 dev 有 4 个 dev 页文件；两边仅 `src/app.json`、`src/pages/data/index.ts`、`src/pages/data/index.wxml` 3 个文件内容不同；**74 个共同文件逐字节相同**（共同树 `sha256:31156b8bbb81d41e76ac23649bc37d12d6db8a9f7d2b3cdb71868da2e95de068`）；两包 WASM/菜单身份一致且等于冻结值。

## 4. 两包真实微信编译（分别新开独立项目窗口）

- 工具：微信开发者工具 / wechatide skill 0.3.11；基础库 `3.17.4`、微信 `8.0.5`、设备 `iPhone 12/13 (Pro)`、平台 `devtools`。
- user：`open_project_window --project out/user-v1` → `newopen, winId=s10`；`simulator_open_page pages/home/index` 成功；首页数据正常（见 §7 新装）；控制台无编译错误。证据 `04-隔离与同源/30-open-user.json`、`31-user-home-data.json`。
- dev：`open_project_window --project out/dev-v1` → `newopen, winId=s11`；`simulator_open_page pages/dev/index` 成功并展示环境/诊断数据。证据 `32-open-dev.json`、`33-dev-page-data.json`、`34-dev-page.png`。
- 说明：这是开发者工具模拟器编译/运行证据，**不是真机、不是上传发布、不是性能实测**。

## 5. 隔离验证

- **user 无开发入口**：构建期断言 + 运行期实测——user 包内 `wx.navigateTo('/pages/dev/index')`/自动化直达均失败，页面栈保持 `["pages/home/index"]`（`04-隔离与同源` 内 evaluate 记录；数据管理页无“诊断信息”按钮，截图 `05-用户场景/62-user-data-page.png`）。
- **dev 保留诊断页**：dev 包 `pages/dev/index` 可正常打开，显示 SDK/微信版本/平台/机型、WASM 路径与预期字节/SHA；在页面实例上实际执行 `onProbe()`，`probeRaw` 长度 185、4 个夹具键（success/targetUnavailable/invalid/resourceLimited）存在（`05-用户场景/60-dev-probe.json`、`61-dev-probe.png`）。
- 两包是**不同项目路径**，开发者工具存储分别隔离；user 场景全程只操作 `out/user-v1` 的存储，未触碰生产目录 `miniprogram/`，也未清空/覆盖任何真实用户数据。

## 6. 同源验证（G1：同一请求 → 同一算法 → 同一响应）

- 场景：档案（男/20/175cm/70kg/中等活动/减脂）→ `computeTarget` → `refreshPlan`，使用各自包内真实 `mp_core.wasm`；两包共用同一“已保存档案”初始状态以消除新装随机 `profileId`。
- 结果（`04-隔离与同源/g1-compare-v1.json`，verdict PASS）：
  - 请求原文：98311B，`sha256:14dbcc21a0ee7bc5f5c236f28f7dac99d24c3b94b61456c57415d7ee331966d7`（两包完全相同）；
  - 响应原文：10920B，`sha256:2c8b8c6fe3bcb3a924668230ba313dca33345b00d389820e95a9dd99abe2499d`（两包完全相同），`result.status = OkPartial`；
  - 无构建元数据注入业务源，因此没有“预期差异字段”。
- 请求/响应原文分别落盘：`g1-user-v1-{request,response}.json`、`g1-dev-v1-{request,response}.json`。

## 7. user 包场景覆盖（隔离存储，真实开发者工具）

| 场景 | 实际操作 | 结果/证据 |
|---|---|---|
| 新装 | 空存储启动 | 内置最新菜单（91 菜/62 offer/6 窗口），`profileReady=false`、`planState=no-profile`，banner 为内置真实菜单（`31-user-home-data.json`） |
| 旧官方菜单升级 | 种子=T03d 旧官方菜单 + 已吃午餐日志 + 昨日日志/计划（`05-用户场景/seed-state-legacy.json`，29057B，sha256 `d785e661…`）→ 重开 | catalog 切内置最新 `nutrition35`，banner 更新，教程入口出现；旧日志保留（`41-user-home-after-upgrade.json`、`42-…png`） |
| 教程首次 | 首页 `.tutorial-tip` 可见（含开始/跳过） | 显示正常（截图 42） |
| 教程跳过 | 真实点击 `.tutorial-tip-skip` | `tk.ui.tutorial.v1={seenAt:2026-10-25T15:38:06.106Z, via:'skip'}`，入口隐藏 |
| 教程重看 | 我的 → 真实点击 `.btn-tutorial` | 教程页打开第 1/4 步“填档案，定目标”，`.tut-back` 可返回（`43-user-tutorial-review.json`、`44-…png`） |
| 选餐→确认→历史 | 晚餐自选页选“热干面” → `#confirm-eat` 真实点击 | 新记录 `rec-mvnztiiz-selfpick`（晚餐，热干面 506 kcal、￥8.00，来源=菜单）；记录页 active 显示该餐 `confirmed=true`（`46/47/48/49-*`） |
| 简易/完整 | 首页 `.mode-pill` 真实点击 | `tk.ui.displayMode.v1=full`；完整模式营养文案可用（T06g 已实测 `.offer-nutrition` 渲染） |
| 主题 | 我的 → 外观 → 真实点击 `.option[data-value="dark"]` | `preference=dark`、`themeClass=tk-dark`（`50-user-appearance-dark.png`） |
| 导出备份 | 数据管理 → 菜单与备份 → `.btn-export-run` | 生成备份正文 3916B、摘要 `sha256:69da895e…`、路径 `http://usr/tiankeshike-backup-2026-10-25.json`（`52-user-menu-export.json`、`53-…png`） |
| 恢复备份 | 同一页面把上述备份正文注入 `restoreText`（模拟粘贴）→ `.btn-restore-preflight` → `.btn-restore-apply` | 预检“格式/版本/摘要/结构校验通过”；恢复完成“摘要 `sha256:953ec5e9…` 与恢复前逐项一致”；日志 `rec-001`/`rec-mvnztiiz-selfpick` 保留（`54/55/56-*`） |

## 8. dev 包覆盖

- 编译/打开成功；诊断页展示 5 条环境行与 WASM 身份行（路径 `/assets/wasm/mp_core.wasm`、预期 111554B、预期 SHA256）。
- 页面实例实际执行 `onProbe()`：`probeRaw` 有内容（185B），4 个夹具键可用；性能测量/逐夹具执行按钮本轮未逐个点按（见 §9）。
- 诊断页同样依赖真实包内 WASM，与 user 包同源（见 §3/§6）。

## 9. 未测 / 限制（不冒充通过）

1. 未上传、未生成预览码/体验版，未在真机运行；本轮全部为开发者工具模拟器证据。
2. 未做正式性能（50ms/300ms/768 页等）与包体积上限/分包实测（仅记录字节数：user 1000391B、dev 1030448B）。
3. dev 包诊断页只实测“打开 + 环境/WASM 展示 + onProbe 执行”；4 类夹具运行、性能三档测量、清除数据、原始 JSON 展开等按钮未逐个点按（其逻辑已由既有 Node 测试覆盖，但不算本段 UI 实测）。
4. 恢复备份的正文是用页面 `setData` 注入（模拟粘贴），不是人工键盘粘贴/文件选择；`选择文件…`、`分享文件` 未实测。
5. 导入菜单（更新菜单 → 预检 → 确认替换）、错误路径（非法备份、损坏存储、写入失败）本轮未在开发者工具逐一实测。
6. user 包仅“页面层不可达开发入口”；`core-runtime` 等模块内仍保留 ABI/测量代码路径（业务 store 依赖），未做方法级裁剪——这是最小构建的刻意取舍，详见 §1 依赖审计。
7. 前序 ZCode 窗口实际模型/档位不可核实；本反馈未把请求路由当作实际调用证明。

## 10. 生产未变证明

- 本段开始/结束两次只读复算生产：均为 `sha256:a62aced0…0b357`（75/1009489B、45/649308B）。
- 生产目录未被本段写入；两包及所有脚本/日志只在 `Resources/报告/T05R01-ZCode-用户开发双构建-证据-v1/` 内。第 1 段候选 `candidate/` 亦未被修改（本段用的是其复制件 `workcopy/`）。

## 11. 结论

- 双包隔离：user 无开发页/路由/入口（构建断言 + 运行期直达失败），dev 保留并可运行诊断页 —— 通过。
- 同源同身份：74 个共同业务文件逐字节一致 + 同一 G1 请求/响应原文（sha 相同）+ WASM/菜单冻结身份 —— 通过。
- 可重复生成：配置/脚本/命令/逐文件 manifest/失败即清理/不覆盖旧输出 —— 通过。
- 两包各自实际编译并通过代表场景（user 9 项、dev 诊断页+探针）—— 通过；未测项见 §9。
- 因此第 2 段的完成条件在客观证据上满足；**前置条件是 P01 追认“窗口更换/中途接手”例外**（见 §0）。

## 12. 证据目录

`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T05R01-ZCode-用户开发双构建-证据-v1\`
```
build.config.mjs / build-user-dev.mjs / compare-builds.mjs / same-source-check.mjs
01-输入身份/        （workcopy 复算 manifest、生产最终 manifest）
out/user-v1/        （含 build-manifest.json + 完整项目）
out/dev-v1/         （含 build-manifest.json + 完整项目）
out/build-summary-v1.json
workcopy/           （源候选完整复制）
04-隔离与同源/      （开窗/编译/双包对比/G1 同源对比/页面数据）
05-用户场景/        （user 场景数据、日志、导出恢复、dev 探针、截图 15 张）
```
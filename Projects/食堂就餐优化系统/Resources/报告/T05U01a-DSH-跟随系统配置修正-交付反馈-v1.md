# T05U01a｜DSH｜跟随系统配置修正 交付反馈 v1

- 日期：2026-10-21（Asia/Shanghai）
- 平台/角色：DSH（小程序前端执行员）；工作区 `D:\项目\cpp`；项目根 `D:\项目\cpp\Projects\食堂就餐优化系统`
- 任务卡：`Resources\任务卡\T05U01a-DSH-跟随系统配置修正-v1.md`（v1，3,228 字节，SHA256 `11CFDB0951F5AA0130000E71CFCFB170B2C75FD1BA31B6E37134DB9A414A0C94`）
- **状态：修正完成，微信运行时已实测通过本卡要求的三主题矩阵与系统主题事件；仅“回到前台同步”与真机未单独实测。**
- 唯一反馈文件：本文件。证据目录：`Resources\报告\T05U01a-DSH-跟随系统配置修正-证据-v1\`
- 未改动 U01 报告与 U01 证据；本卡交付后停止，未做 U02。

## 1. 结论先行

**U01 里“开发者工具模拟器读不到系统主题”的结论是错的——根因是 `app.json` 缺全局 `"darkmode": true` 声明。**

补充声明后，同一台机器、同一基础库（3.17.4）下 `wx.getAppBaseInfo().theme` / `wx.getSystemInfoSync().theme` 均能真实返回 `"light"` / `"dark"`，`wx.onThemeChange` 也能在用户切换系统主题时真实触发，界面自动跟随。

## 2. 模型与平台记录（请求 ≠ 实际证明）

- P01 指定请求模型：**DeepSeek V4.1 Flash**；原生思考档未指定。
- 本会话可见模型标识：`deepseek-v4.1-flash-1017`；**服务端实际版本、额度、原生档位无法核实，记为未知。**
- 验证环境：微信开发者工具 2.02.2609231 RC（skill 0.3.11，基础库 3.17.4，模拟器 iPhone 12/13 档），完整 IDE 窗口（模拟器+编辑器+调试器）；Node v24.19.0。

## 3. 输入与接手核对

| 输入 | 身份 | 核对结果 |
|---|---|---|
| 本卡提示词 | 3,228 B，`11CFDB09…` | 已读，按“只做这几件事”执行 |
| U01 交付反馈 | `T05U01-DSH-基础样式与三主题-交付反馈-v1.md`，`4433ED273B038CA43668A8D26D169F2477682FCC7E1790859650CE3D9ACE097F` | 已读候选与接续摘要；**原文件未改** |
| U01 候选清单 | `T05U01-…-证据-v1\00-候选清单\manifest.json`，`5EF17166E74374FDF0179E2560B07608EBF860B6F029512167DB85260A1F8317` | 与当前源码一致：`sha256:eac6e0a2…` / 52 文件 / 612,937 B |
| 接手 `app.json` | 152 B，`5FEB5FDF4A493EB89DA4E0D1B8541EE76E2634F6F9D16F6BF9D290FFD2CB8CDF` | 与 P01 实读一致；确认**无** `darkmode` |
| 主 PRD | `Resources\主PRD.md`，24,044 B，`D68ECE72…` | 未改 |
| 固定 WASM | `miniprogram\src\assets\wasm\mp_core.wasm`，72,881 B，`715CD7701B64D8F493A110C348B5F643979536578C7380C29837E05C4F31D52C` | 修改前后一致，未替换 |

## 4. 改动内容

唯一源码改动：`miniprogram/src/app.json` 增加一行全局声明（其余字段原样）：

```json
"style": "v2",
"sitemapLocation": "sitemap.json",
"darkmode": true
```

- 修改后 `app.json`：152 → 152 B 不变量级，SHA256 `06B8328158B6BA0158D8AF65DC22A96AD0F41A8B4E962B674D79C30A5A96B80D`。
- **未改** `utils/appearance.ts`：现有读取实现（`getAppBaseInfo().theme` → `getSystemInfoSync().theme`）在声明生效后即可用，不需要改代码。
- **未加** `themeLocation` / `theme.json`：本项目的导航栏颜色由 `applyPageAppearance()` 运行时按解析主题设置，加窗口主题配置反而可能与用户显式浅/深色冲突，故只补最小声明。
- 未改页面布局、路由、业务逻辑、Core、契约、菜单、档案/记餐数据、WASM。

## 5. 新候选身份（不能沿用 U01 摘要）

| 项 | 值 |
|---|---|
| 源码树 | `miniprogram/src` **52 文件 / 612,957 字节 / `sha256:dc5e23f4e22ac23f5dd6962cc3917a3d265043403ec730aa2990e305a08267e1`** |
| 工具目录 | `tools/miniprogram` 30 文件 / 329,008 字节（未变） |
| 与 U01 差异 | 新增 0、删除 0、**修改 1（仅 `miniprogram/src/app.json`）** |
| 固定 WASM | 72,881 B / `715CD7701B64D8F493A110C348B5F643979536578C7380C29837E05C4F31D52C`，`matchesFrozen=true` |
| 清单 | `00-候选清单\manifest.json`（`3F3DFBB3…`）、`00-候选清单\hashes.sha256`（`C6024436…`） |

## 6. 微信开发者工具实测（本次为真实运行时证据）

操作方式：先补 `darkmode: true` 并重新编译；随后由用户在开发者工具「设置 → 外观」手动切换系统主题（浅 → 深 → 浅），我在每次切换后读取真实 `theme`、`onThemeChange` 记录与页面截图。原始 CLI 回显见 `02-微信实测\CLI原始输转存.md`。

| 场景 | 系统主题 | 用户偏好 | 实测 `theme` | 解析结果 | 界面 | 截图 |
|---|---|---|---|---|---|---|
| 声明生效（重编译后默认浅色） | 浅 | 浅（默认） | `light`（可读） | `light` | 浅色 | `13-appearance-after-decl.png` |
| 系统深 + 显式深 | 深 | 深 | `dark` | `dark` | 深色 | `17-system-dark-explicit-dark.png` |
| 系统深 + 显式浅 | 深 | 浅 | `dark` | `light` | **浅色** | `18-system-dark-explicit-light.png` |
| 系统深 + 跟随系统 | 深 | 跟随 | `dark` | `dark`，`systemReadable=true` | 深色 | `19-system-dark-follow.png` |
| 系统切回浅 + 跟随系统 | 浅 | 跟随 | `light` | **自动变 `light`** | 浅色 | `20-system-light-follow.png` |
| 系统浅 + 显式深 | 浅 | 深 | `light` | `dark` | **深色** | `21-system-light-explicit-dark.png` |
| 恢复显式浅 | 浅 | 浅 | `light` | `light` | 浅色 | `22-final-light.png` |

关键证据：

- **读取恢复**：`{ "appBaseTheme": "light", "systemTheme": "light", "onThemeChange": "function" }`；切换到深色后 `{ "appBaseTheme": "dark", "systemTheme": "dark" }`。
- **真实事件**：切换前注册 `wx.onThemeChange` 临时记录器；系统由深→浅时记录到 `["light"]`，同时 `appearance` 由 `{preference:"system",resolved:"dark"}` 自动变为 `{preference:"system",resolved:"light"}`，页面无操作即重绘为浅色。
- **显式偏好不被系统覆盖**：系统深色下显式浅色仍浅色；系统浅色下显式深色仍深色；导航栏与页面底色同步跟随解析结果（`18`/`21` 截图）。
- **页面说明文案随能力变化**：可读时显示“系统切换浅色/深色后界面会自动跟随；从后台返回时也会重新同步一次。”；不可读时才显示“当前环境读不到系统主题……”（`.note` 文案由 `automation_element_action --action text` 实读）。
- **隔离**：`wx.getStorageInfoSync()` 键仍只有 `tk.ui.appearance.v1`；`get_simulator_console` grep `error|fail|exception|theme` 无命中；`get_simulator_network` grep `wasm|mp_plan|mp_nutrition|mp_validate` 无命中（未因主题切换触发核心计算）。

## 7. 静态检查（本候选重跑）

| 命令 | 结果 | 输出 |
|---|---|---|
| `node tools/miniprogram/typecheck-src.mjs` | TS 4.1.2 / 5.9.3 均 `0 errors across 27 files` | `03-静态检查\typecheck.stdout.txt` |
| `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/check-pages.mjs` | 6 页全部通过 | `03-静态检查\check-pages.stdout.txt` |
| `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-appearance.mjs` | 27/27 通过（输出中的 storage full/read failed 堆栈是注入失败分支的预期告警） | `03-静态检查\test-appearance.stdout.txt` |

Node 桩只作为逻辑回归，不作为微信事件证据；本卡的微信事件证据以 §6 的真实记录为准。

## 8. 操作过程中的环境事实（与 U01 结论的修正）

1. **项目列表原本是空的**：`project_list` 返回 `count: 0`；CLI 直接按路径打开项目窗口不会写入开发者工具“项目列表”。本卡为了拿到完整 IDE（含设置菜单）先用 `project_import` 导入（`alreadyImported=false` → 之后 `count: 1`），再从项目列表打开完整 IDE。
2. **只有模拟器的窄窗没有“设置/外观”入口**：CLI 直接打开的项目窗口只有模拟器；完整 IDE 才有「设置 → 外观」，这是切换系统主题（IDE 外观）的入口。后续卡需要切主题时，先确认打开的是完整 IDE。
3. **补充 `darkmode` 后必须重新编译**：声明变更不会热更，需 `simulator_open_page` / 重新编译后生效。
4. 系统主题切换是**用户在开发者工具「设置 → 外观」手动完成**的（本机无法用 CLI 触发），切换时刻与读取时刻对应关系已按上表记录。

## 9. 仍存在的限制与未测项

1. **“从后台返回前台自动同步”未单独实测**：开发者工具没有可用的“切后台”CLI/入口（`automation_viewport_action` 只有 pageScrollTo/screenshot/remote/close），本卡未伪造后台事件。代码路径（`onShow → applyPageAppearance → refreshAppearance`）与 Node 桩覆盖仍在，但仍列为未测。
2. **真机未测**：真实手机系统主题切换、真机导航栏配色、真机冷启动白闪均未运行（本卡不要求全套真机）。
3. 系统主题可读依赖宿主环境（iOS/Android/开发者工具）实现；`readSystemTheme()` 的双接口回退与不可读回退仍保留，未删除。
4. 未新增 `themeLocation`/`theme.json`，因此导航栏颜色完全由运行时设置；若后续卡改为静态窗口主题，需要重新评估与本逻辑的冲突。
5. 视觉层没有新增/修改（本卡只修配置），所以 U01 的“与 P01 预览逐像素对照未做”结论不变。

## 10. 给 U02 的接续摘要

- **新候选**：`miniprogram/src` 52 文件 / 612,957 B / `sha256:dc5e23f4e22ac23f5dd6962cc3917a3d265043403ec730aa2990e305a08267e1`；清单 `Resources\报告\T05U01a-DSH-跟随系统配置修正-证据-v1\00-候选清单\manifest.json`。U01 的 `eac6e0a2…` 已被本卡取代，不得混用 U01 截图/证据。
- **主题入口**：`miniprogram/src/utils/appearance.ts`（`pageThemeData()` / `applyPageAppearance()` / `setAppearancePreference()`）；令牌 `app.wxss` 的 `.tk-light` / `.tk-dark`；`app.json` 已声明 `"darkmode": true`。
- **遗留限制**：回前台同步未单独实测、真机未测。
- 本卡完成即停止，等 P01 核对与用户下一张转交；未推进 U02。

## 11. 证据清单

| 文件 | 说明 | SHA256 |
|---|---|---|
| `00-候选清单\manifest.json` | 新候选逐文件哈希 | `3F3DFBB34B2FDDD30C810B7A867A2163F0C9C8D759EC45039207154F08FF2690` |
| `00-候选清单\hashes.sha256` | 可复核文本清单 | `C6024436562343B3820459E7E7F26B848FFFC935877416BB65387A70F763D743` |
| `01-输入核对\app.json.new.sha256.txt` | 修改后 app.json 哈希 + U01 原值 | `84B731C3A2DF0D3728A373539B3B344DADB0F47208B3D7B063426D5E558E15C8` |
| `02-微信实测\CLI原始输转存.md` | 7 组真实读取/事件原始回显 | `CFF8BFC1AC9056FDD38A6D21DB5E31115CF02B2B0914133F24EA72C56F19A8BC` |
| `02-微信实测\console-grep.txt` / `network-core-grep.txt` | console/network 过滤（均无命中） | — |
| `02-微信实测\storage-keys.json` | 存储键仅外观键 | — |
| `13-appearance-after-decl.png` | 补声明后外观页（浅） | `830FF34ED66DD0245CF0BF72CDEFB532900C717805691A756B9AD85D8CF228C5` |
| `17-system-dark-explicit-dark.png` | 系统深 + 显式深 | `30B222224EE9F007B1717120EF06CEFEA757B346CD8586EDBEE2832C49D7A2F3` |
| `18-system-dark-explicit-light.png` | 系统深 + 显式浅 | `6A9BE246D7EAC9F0C90F343BEE38073886BD9B8FB40FF2FA22E558058FD90508` |
| `19-system-dark-follow.png` | 系统深 + 跟随系统 | `43D6C080E21C46502BA8A28C97C8E04B54D2F51D465A7EEE8C55330B6D2A5AE1` |
| `20-system-light-follow.png` | 系统切回浅 + 跟随系统（事件后） | `034E89402A6E7D0F379CB107292D5C7793B655ECB83725C3AE98ECB159119203` |
| `21-system-light-explicit-dark.png` | 系统浅 + 显式深 | `CB18D584CB0190367DC2DD5DB1550D8D20667E0BDD71C0F6BE025E149AF75E43` |
| `22-final-light.png` | 恢复显式浅的最终状态 | `1F1FF8FC9C3AEC450D5326D9EC932D8B900E89C32C90A4887EBCDE65CBD39A1F` |
| `03-静态检查\*.stdout.txt` | 类型检查/页面检查/外观单测输出 | 见 §7 |

> 说明：截图来自微信开发者工具模拟器（iPhone 12/13 档），**不是真机**；系统主题切换由用户在该工具「设置 → 外观」完成，事件与读取值见 `CLI原始输转存.md`。
# T06h1-DSH-规格修正与微信预览-交付反馈-v1

## 1. 任务与身份

| 项 | 内容 |
|---|---|
| 任务卡 | `Resources/任务卡/T06h1-DSH-规格显示小修与微信预览-20261026-v1.md` |
| 平台/模型 | DSH Web；请求模型 `deepseek-v4.1-flash-1017`，原生档位**未在会话中显示**（按卡要求如实记录，不冒充其它模型） |
| 实际 cwd | `D:\项目\cpp`（项目根 `D:\项目\cpp\Projects\食堂就餐优化系统`） |
| 唯一输入 | T06h 最终可重建源 `sha256:eefe10efbfb1ef573a3cd6dfd966c370eb965f8aa737d08be4f20483a8542b25`（88 文件 / 1,130,414 B） |
| 候选源 | `sha256:82a6d3c881a19468c04f22b20496965c0384d436295162c646ebc3d79986b0da`（88 文件 / 1,131,647 B） |
| 菜单身份（未变） | `west1-canteen-batch2-supplement6-20261026` / `sha256:a35158df416b9b338df10a3a7907f1a3e5ea5b2df0d60785ab6aa0e9f4839b0a`；12 窗口 / 166 菜品 / 137 报价 |
| WASM（未变） | `111,554 B / B0098453B7251C2FF39C65B3DF932E7E15975E4252A036196EBF63638A3DC5DD` |

## 2. 交付文件（绝对路径）

- 证据目录：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T06h1-DSH-规格修正与微信预览-证据-v1\`
- 源（最终可重建）：`…\workcopy\miniprogram`（`sha256:82a6d3c8…`，88 / 1,131,647 B）
- 用户包：`…\out\user-v4a`（79 文件 / 1,030,857 B / `sha256:ce34f2637ecd7271de297177a425b046dd74409343397a78fd695a06d7fc5714`）
- 开发包：`…\out\dev-v4a`（88 文件 / 1,131,647 B / `sha256:dabbe7ce74d60aecfbc3596cae3b10effb14c6fa0400dfc87b1749fa467c84ac`）
- 说明：`01-输入身份\00-输入身份说明.md`、`02-菜单身份\00-菜单身份说明.md`、`03-隔离与同源\00-隔离与同源说明.md`、`04-验证与未测清单\00-验证与未测清单.md`、`05-差异\00-差异说明.md`、`截图\00-截图说明.md`
- 原始结果：`01-输入身份\{verify-inputs.log,input-identity-check.json}`、`02-菜单身份\{coverage.json,make-v4-evidence.log}`、`03-隔离与同源\{build-v4a.log,compare-v4a.log,build-compare-v4a.json,verify-t06h.log,menu-verify-*.json}`、`04-验证与未测清单\{typecheck-v4a.log,check-pages-v4a.log,manifest-index.json,wechatide-t06h1.log,simulator-checks.json}`、`05-模拟器证据\*.json`
- 截图：`…\截图\01-user-v4a-首页-新装方案.png` … `05-user-v4a-记录页.png`
- 预览二维码：`…\二维码\user-v4a-preview.png`（48,704 B；记录 `preview-qrcode-record.json`，生成时间 `2026-10-26T03:55:49+08:00`，项目路径=`…\out\user-v4a`）

## 3. 原问题与修改

**原问题（T06h 遗留）**：`portion-spec.ts` 把配方营养假设里的第一个 g/ml 数字当成售卖规格，于是热干面显示 200g、南方小馄饨小份 45g、烧麦 32g、煎饼 110g（均为配方原料量/皮重），菜单页还出现“含 T03h 六组补录”和 `comboRules`/`algorithm=…` 内部调试文案。

**修改（只动展示，不动数据/算法/价格/营养/限额/历史）**：

1. `src/utils/portion-spec.ts` 重写为**显式售卖规格表** `OFFER_PORTION_SPEC`（offerId→`500g`/`300g`/`400g`/`500g`/`300ml`），helper 签名改为 `portionSpecLabel(offerId, priceBasis)`：仅当 `priceBasis==='unitPrice'` 且 offerId 在表内才返回文案，其余一律空串；没有文本解析、没有配方假设兜底、不把估算当实测。
2. `src/domain/plan.ts`、`src/domain/self-pick.ts` 调用点同步传 `offerId + priceBasis`。
3. 菜单页文案：`src/pages/menu/index.wxml` 改为“西院西一食堂 · 当前已录入 {{view.info.windowCount}} 个窗口”；`user-overrides/src/pages/menu/index.wxml` 把 user 版 `comboRules 条数` 行和 `algorithm=…` 调试说明换成普通支持范围句（dev 版保留诊断字段）。
4. **模拟器实测追加发现并修复**：自选页 WXML 早已引用 `portionSpecLabel`，但页面 `OfferRow`/`SelectionRow` 映射漏了该字段（T06h 只在首页详情生效）。已在 `src/pages/self-pick/index.ts` 补字段并从当前窗口视图回填展示（仍不参与计价/营养）。
5. 测试断言重建：`verify-t06h.mjs` 改为 26 项/包，替换旧“普通菜=110g”错误断言为“酱香饼 500g、9 个称重档 300/400/500g、饮品 300ml、热干面/小馄饨/烧麦/煎饼为空”；新增菜单文案断言（动态窗口数、无任务号、user 无调试原文）。

## 4. 逐项结果

| 卡片要求 | 状态 | 证据 |
|---|---|---|
| 规格不再取配方第一个克数；酱香饼 500g、9 个称重档、普通菜无克数 | 满足 | `verify-t06h.mjs` 26/26 PASS×2 包；`verify-inputs-t06h1.mjs` 19/19 PASS；模拟器真实页面读取规格 |
| 菜单页去任务号、user 去调试原文、算法页三种中文名保留 | 满足 | 构建 mustKeep/mustNotContain 命中；模拟器检查“推荐方式页三种算法中文名可见且当前为快速推荐”PASS |
| 重建可重建源/覆盖/脚本/清单与双包 | 满足 | `build-v4a.log`、`out/build-summary-v4a.json`、`out\user-v4a`、`out\dev-v4a` |
| 菜单/数据/WASM 不变 | 满足 | `manifest-index.json` 两包 identity 均为 batch2 + `B0098453…`；`verify-inputs` 逐项核对 |
| 双包隔离与同源 | 满足 | `compare-builds.mjs --version v4a` PASS：dev 独有 9 / user 多出 0 / 内容不同 7 / 共享 72，两包同源 |
| 最小功能验证（新装 12 窗、新增组可选、算法切换、生成→确认→记录、升级/锁/售罄/重开） | 满足 | `verify-t06h.log` 26/26 PASS×2 包；模拟器 12/12 PASS（见下） |
| 微信开发者工具实际编译 user/dev 双包 | 满足 | `wechatide-t06h1.log`、`simulator-checks.json`；`platform=devtools`、iPhone 12/13 Pro、SDK 3.17.4 |
| user 包真实页面截图 3—5 张 | 满足 | 5 张，见 `截图\`；均标注模拟器，不是真机 |
| 基于 user-v4a 生成可用预览二维码并记录时间/路径 | 满足（仅生成） | `二维码\preview-qrcode.png` + `preview-qrcode-record.json`；**未扫码、未真机验证** |
| 不伪造成功、工具失败不回收代码 | 满足 | 工具均在真实环境跑，失败检查修正后重跑；未回滚代码、未写假结果 |

### 模拟器走查（12/12 PASS，均为真实页面操作）

新装清缓存→init→建档→算目标→真实 WASM 生成方案；菜单页 12/166/137、内置真实菜单已启用、文案动态；推荐方式页三中文名、切到全天搭配（DP）保存后今日页生效；自选页列出 6 个新增窗口（晚餐），视图规格酱香饼 500g/麻辣烫 300g/小馄饨/煎饼为空；麻辣烫 300g 可选并显示 `整份（300g）`、估算标签、￥11.28；确认写入真实记录；记录页显示晚餐“已记”、麻辣烫 300g ￥11.28、营养快照 350 kcal/蛋白 20.5g/脂肪 16.5g/碳水 30.0g；dev 包实际编译并保留诊断页。

## 5. 关键判断与限制

- 规格表是**显式少量映射**，只覆盖已知按重量/按杯售卖的报价；以后新增称重菜必须补表，否则宁可不显示也不猜。这是有意为之的“宁可无、不可假”。
- 自选页 `portionSpecLabel` 映射是走查中发现的实际显示缺陷（WXML 有引用、页面未映射），已修但属展示层；未改任何计价/营养/存储。
- 所有自动检查均在隔离证据目录、读取包内真实 WASM 执行；模拟器与真机存在差异。
- **未测**：真机（Android/iOS）安装与扫码、手机扫预览码、小屏/大字号、性能与真实设备耗时、推荐方案逐屏确认流（本轮确认路径用自选菜完成）、完整回归套件（旧 `test-t05-*` 仍写死上一候选，历史卡资产，本轮未重跑）、其他自定义菜单混合升级、T03h 数据生产正确性。详见 `04-验证与未测清单`。
- 二维码生成 ≠ 手机已测。

## 6. 未完成项 / 阻塞

无阻塞。按卡要求在此停步，等 P01 验收与派单；不推广、不改 MEMORY/PPT/旧证据。

## 7. 下一负责人

P01（验收与后续派单）。
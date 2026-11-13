# T05M01｜DSH｜首批西一真实菜单接入 — 交付反馈 v1

- 任务卡：`Resources\任务卡\T05M01-DSH-首批西一真实菜单接入-v1.md`（P01，2026-10-22）
- 主 PRD：v0.2（本卡不改产品行为，只接首批真实菜单与入口）
- 项目根（实际 cwd）：`D:\项目\cpp\Projects\食堂就餐优化系统`
- 平台/执行角色：DSH
- 请求模型：**DeepSeek V4.1 Flash**（本卡不另指定原生档位）
- 实际可核实配置：`C:\Users\link\.dsh\profiles\desktop\cordis.patch.yml`（2,341 B / SHA256 `D833C6727A619188979FEE27714525EF9EFF782526EFC8A3A36B22803B4977E8`），`provider: qw / model: deepseek-v4.1-flash-1017 / reasoningEffort: high`；服务端真实路由/原生档位：**未知**。
- 微信工具：微信开发者工具 **2.02.2609231**，wechatide skill **0.3.11**（client=`DeepSeek`），登录态有效（凉笙），模拟器 `iPhone 12/13 (Pro)` / SDK 3.17.4 / 390×844。
- 证据目录：`Resources\报告\T05M01-DSH-首批西一真实菜单接入-证据-v1\`（索引 `README.md`）。
- 边界：微信部分均为**开发者工具模拟器**结果，不是真机；本反馈为 DSH 自查/操作留档，不是 P02/P09 验收。

## 一、输入候选

| 项 | 值 |
| --- | --- |
| 输入候选（开工核对） | `sha256:1ade059e79ad2f03fdf628090940063f3dafa1b0ff9e8b2735096c0e6d4c3d84`（74 文件 / 777,789 B；工具 38 文件 / 433,837 B） |
| 输入菜单原件（只读） | `Resources\真实菜单\西院西一食堂-20261022\T03b-v1\menu-catalog.json`：34,660 B / `ECC711034C2F438F2864D0987A0F4724CF42F5C844BDEDB20D20DA05FBD41CB5`，`menuVersion=west1-canteen-batch1-20261022`，`catalogHash=sha256:1e6b7fd1d75d35ffef9fd2ca2c81ab0e746b4aeffc91dc82ef3d40d77e2153c4` |
| 原件结构 | 5 窗口 / 35 菜品 / 35 报价；`nutrition` 四字段值全 null；`comboRules=[]`；早餐 3 窗口、午/晚 5 窗口 |
| 依据清单位置 | `证据-v1\00-输入候选\manifest.json`、`hashes.sha256`、`00-输入身份.txt` |

## 二、本卡输出候选

| 项 | 值 |
| --- | --- |
| 生产源码树 | `sha256:16c2b29a593322efa1106f935ab14a16f3b23ae898603a8d439f54bcd0ec42f1`（75 文件 / 817,080 B） |
| 工具目录 | 38 文件 / 433,837 B（**未变**） |
| 冻结 WASM | 未变：72,881 B / `715CD7701B64D8F493A110C348B5F643979536578C7380C29837E05C4F31D52C` |
| 逐文件清单 | `证据-v1\03-输出候选\manifest.json`、`hashes.sha256`、`01-相对输入候选改动.json` |

实际改动（只有 4 个文件，无删除、无夹带）：

| 文件 | 前 | 后 |
| --- | --- | --- |
| `miniprogram/src/config/west1-menu.ts`（**新增**） | — | 35,042 B / `6FA3CF89B9BC1696BF110642478D77EE61FC13A47956502C496B8697F482DD33` |
| `miniprogram/src/pages/menu/index.ts` | 20,953 B / `438E80616A50119A057F1C0E8D69014116A70A00E30822C32C5EC48E390E3F7D` | 23,370 B / `7F1E261652DCE9A0B402CC2EDCBA4D78C7159A137F9BAEA4B3C0874D9F3EB334` |
| `pages/menu/index.wxml` | 13,348 B / `FD5F3D5AAC8A4463A714AA634ED5C1F55E1720185A70D9AA1EA5AF360E853E02` | 14,739 B / `991EA0227C090C3A4FE8EACDEBE6B8FE421BB3C05EDBE9B107AD871CF21A69E7` |
| `pages/menu/index.wxss` | 1,597 B / `C5C4FED82DEE74B7711315B52078CDD16D4D0181B31AA33CBB4B80DBD7391FCE` | 2,038 B / `F0A91BDED2EC14621B807C07C5BD3F7A6724C3376FB925F40206514975EEA443` |

`core/`、契约、原始菜单 JSON、`MEMORY/`、前端 WASM、`tools/miniprogram`、`simulated-menu.ts` 均未改（输出清单逐文件哈希对比）。

## 三、内置副本一致性（原件 ↔ 内置资源）

- 做法：`miniprogram/src/config/west1-menu.ts` 导出 `WEST1_MENU_CATALOG`，内容为原始 `menu-catalog.json` 解析后经 `JSON.stringify(catalog, null, 2)` 原样嵌入；导入时再 `JSON.stringify` 交给既有 `store.preflightMenu`。没有新转换框架、没有补营养、没有重排/改 ID。
- 独立核对脚本（`证据-v1\01-内置副本一致性\`）：通过 `register-ts.mjs` 动态加载 .ts，不手抄数据。
- 结果 `allPassed=true`：`sameJsonText`、`sameMenuVersion`、`sameCatalogHash`、复算目录摘要 = `sha256:1e6b7fd1…2153c4`、`sameCanteen`、`sameComboRules`、`sameWindows`(5)、`sameDishes`(35)、`sameOffers`(35)、`idsKept`、`dishesAllNull`、`sourceMetaConsistent`。
- 另由独立 DSH 子复核员二次核对（只读，非 P02/P09）：`JSON.stringify` 逐字节相等、递归 0 差异、35/35 nutrition 四字段全 null、无 0/估算值；报告见 `证据-v1\04-环境\06-独立只读复核.md`。

## 四、菜单页接线（小改）

- `pages/menu/index.wxml`：在既有“导入菜单”卡片内新增唯一内置入口 `#data-west1`，含标题/“当前已启用”徽标/三句规定文案/“预检并启用西一菜单”按钮；预检面板加 `id="data-import-preflight"` 供滚动定位；手动粘贴区前加“或手动导入”小标题。
- `pages/menu/index.ts`：新增 `onUseWest1Menu()`——置忙、调用既有 `store().preflightMenu(JSON.stringify(WEST1_MENU_CATALOG), '西院西一食堂-首批菜单.json')`，把结果写回既有 `importStage/StageLabel/Message/Errors/Diff/Ready/RawError` 状态并保存一次性 `pendingMenu`；确认替换仍走原 `onApplyMenu`（复用一次性 token、成功/失败处理、作废凭证），取消仍走原 `onCancelImport`；`reload()` 只新增 `west1Applied = view.info.catalogHash === WEST1_MENU_CATALOG.catalogHash`。
- 没有新增校验、持久化、备份、领域逻辑或营养计算；没有自动替换（必须点按钮，且替换必须再点“确认替换”）、没有自动刷新推荐。
- 真实菜单启用后：来源显示“西院西一食堂 · 首批菜单（内置真实菜单）”，`simulated=false`，不再出现“示例菜单”标注；内置示例菜单仍按既有逻辑显示“示例菜单”。

## 五、微信实际编译与操作结果

### 5.1 工具/编译

| 项 | 实际结果 | 证据 |
| --- | --- | --- |
| 打开工程 | `open_project_window` → `ok:true`（窗口复用） | `02-微信实测\01-open-project.json` |
| 菜单页 WXML 编译 | `success:true`，`codeLength:301032` | `02-微信实测\20-compile-wxml.json` |
| 菜单页 WXSS 编译 | `success:true`，`files:2`，`totalCodeLength:24961` | `02-微信实测\21-compile-wxss.json` |
| 模拟器控制台 | `grep -n -i error` → `ok:true`、无匹配行 | `02-微信实测\22-console-errors-final.json` |
| 登录态 | `check_wechatide_status`：`loginExpired:false`、凉笙、skill 0.3.11 | `02-微信实测\00-status.json` |

### 5.2 实际流程（完整 28 步见 `02-微信实测\00-操作记录.md`）

起始：先 `store.resetLocalData()` 清掉开发者工具本地演示数据（**不是**真实用户数据），起始为内置示例菜单 `menu-simulated-v2`（1 窗口/4 菜/5 报价，页面有“示例菜单”）。

1. **取消**：点“预检并启用西一菜单” → 预检通过（原文“预检通过：west1-canteen-batch1-20261022（窗口 5，菜品 35，报价 35）；确认后才会替换。”）→ 点“取消” → 原文“已取消导入；当前菜单、锁定与计划保持不变。”，菜单仍是 `menu-simulated-v2`、hash `sha256:40f2bd13…`、`simulated:true`。共做两轮取消，结果一致。
2. **启用**：再次预检 → 点“确认替换” → 原文“菜单已替换为 west1-canteen-batch1-20261022”；`west1Applied=true`；`view.info`：`source=imported`、`simulated=false`、`canteenName=西院西一食堂`、`windowCount=5`、`dishCount=35`、`offerCount=35`、`catalogHash=sha256:1e6b7fd1…2153c4`、`importedFileName=西院西一食堂-首批菜单.json`。
3. **真实窗口选菜**：晚餐页 5 个真实窗口（报价数 5/3/4/12/11，合计 35）；选“脆皮烤鸭”窗口 → 脆皮烤鸭饭 ￥13.00 + 五香鸭腿饭 ￥11.00（已知合计 ￥24.00）→ 点“确认吃了” → “晚餐已确认 2 项（￥24.00），已计入实际消费”。
4. **午餐**：海南鸡饭窗口 → 海南鸡饭 ￥12.00 + 小青菜 ￥6.00 → 预览“已知合计 ￥18.00 / 营养状态：待补全（数值未知，不按 0 计算）” → 确认成功“午餐已确认 2 项（￥18.00）”。
5. **记录页**：午餐/晚餐逐项显示真实菜名、整份、单价（￥12.00/￥6.00、￥13.00/￥11.00）；当日能量/蛋白质/脂肪/碳水均“未知”，`unknownItemCount=4`，未知不按 0；本月“1 天 · 2 餐”、￥42.00。
6. **餐次供应区分**：早餐 3 窗口（热干面/煎饼/肠粉，合计 12 报价，热干面 ￥8.00 等真实价格）；午餐、晚餐各 5 窗口（合计 35 报价）。
7. **今日页**：菜单横幅“当前为导入菜单 west1-canteen-batch1-20261022；历史已吃快照不会因换菜单而改写。”，`menuSimulated=false`，晚餐已记 ￥24.00、热量待补全。

### 5.3 截图（`02-微信实测\`，模拟器实拍 1x PNG）

| 要求 | 文件 |
| --- | --- |
| 来源信息 | `14-菜单页-已启用-顶部.png`（来源“西院西一食堂 · 首批菜单（内置真实菜单）”、5/35/35、无示例横幅）、`15-菜单页-西一入口-已启用.png`（“当前已启用”徽标） |
| 预检/取消 | `12-菜单页-西一预检通过.png`、`12c-菜单页-西一入口-已预检.png`、`13b-菜单页-取消后-顶部.png`（取消后仍为示例菜单） |
| 真实菜名与价格 | `36-自选页-午餐-真实菜名价格已选.png`、`37-自选页-午餐-预览与合计.png`、`31-自选页-晚餐-已选两项.png`、`32-自选页-晚餐-预览与确认.png`、`35-自选页-早餐-3窗口.png`、`35b-自选页-早餐-热干面等真实价格.png` |
| 确认后记录 | `33-自选页-晚餐-确认成功.png`、`38-自选页-午餐-确认成功.png`、`34-记录页-晚餐真实菜名价格.png`、`34b-记录页-真实菜名与价格.png`、`40-今日页-已导入真实菜单.png` |

## 六、逐项验收（对照任务卡）

| # | 卡片要求 | 状态 | 依据 |
| --- | --- | --- | --- |
| 1 | 以独立内置数据资源接入 T03b 菜单，沿用既有配置导入方式 | 满足 | `config/west1-menu.ts`；一致性检查 `allPassed=true` |
| 2 | JSON 语义与原件相等：版本/摘要/ID/价格/餐次/null 保留，不补营养、不重分类 | 满足 | `01-copy-check.json`；独立复核逐字段 0 差异 |
| 3 | 菜单页加入口，复用 `preflightMenu`+`applyMenu` 与确认/取消/失败逻辑 | 满足 | `index.ts` 仅新增 `onUseWest1Menu`；确认/取消走原方法；操作记录 #6–#14 |
| 4 | 文案三句，不宣称全食堂/健康营养推荐/营养已完成 | 满足 | 入口卡片原文；截图 `11b`/`12c` |
| 5 | 真实菜单不显示“示例菜单”，模拟菜单仍正确标注 | 满足 | 启用后 `simulated=false` 且无标签（`14`）；示例态有标签（`11`/`13b`） |
| 6 | 启动不自动替换、不自动刷新推荐、不清历史 | 满足 | 必须点按钮且再确认；无 `refreshPlan` 调用；换菜单只使旧计划失效（既有规则），历史快照不改写 |
| 7 | 未知营养保持未知；已知价格正常价格/记账 | 满足 | 记录页营养“未知”；午餐 ￥18.00、晚餐 ￥24.00、本月 ￥42.00 |
| 8 | 不新增前端营养计算；不改 core/契约/原件/MEMORY/WASM；依赖既有 validate-menu | 满足 | 输出 diff 仅 4 文件；WASM/tools 未变；预检走既有 store 路径 |
| 9 | 首次真实运行：取消 + 启用 + 真实窗口选菜 + 确认吃了 | 满足 | 操作记录 §2；截图见 §5.3 |
| 10 | 保留来源信息、真实菜名价格、确认后记录、编译结果截图 | 满足 | 见 §5.1/§5.3 |
| 11 | 关注早/午/晚供应按菜单区分、null≠0 | 满足 | 早餐 3 窗口/12 报价，午晚 5 窗口/35 报价；营养未知 |
| 12 | 不做全量回归、不引入额外框架 | 满足 | 仅跑既有 `typecheck-src`、`check-pages`、`test-t05-store`、`test-t05-modules` |

静态检查结果：TypeScript 4.1.2 与 5.9.3 各 **0 errors / 38 files**；`check-pages` 全 PASS；`test-t05-store` 28/28、`test-t05-modules` 17/17；日志见 `证据-v1\04-环境\02~05`。

## 七、未完成/未覆盖

- 未在真机（iOS/Android）运行；截图不替代手机观感、触控与性能。
- 未做全量回归；只跑既有定向静态检查与 T05 既有测试，未跑 P09 总审。
- 未接正式营养数据；营养仍未知，未做任何营养推荐。
- 只验证首批 5 窗口 35 菜；未验证其他批次/窗口/菜品。
- 未构造 core 拒绝预检的失败分支（内置副本事先已通过前端 `validate-menu` 预检）；既有失败展示逻辑未改。
- 未构造“已有旧计划被替换失效”的界面场景（起始无方案）；该逻辑由既有 `test-t05-store` 用例 17 覆盖。
- 自动化工具首次 `getData` 超时一次，加 `--wait` 后成功；不影响结果。

## 八、缺陷/低风险观察与下一负责人

| 项 | 说明 | 处理/下一负责人 |
| --- | --- | --- |
| 内置入口预检失败时清空手动粘贴框 | `index.ts` 在内置预检失败时也把 `importText` 置空；成功时清空是为避免旧文本与内置来源混淆。失败时清掉用户粘贴内容属轻微体验问题；本次未改（改动会换候选并需重拍证据，且失败路径未构造）。 | 记录，P01/P02 判断是否需要小修 |
| 计数文案为固定值 | “5个窗口 · 35款餐品”按卡片要求固定写死，未从 `WEST1_MENU_SOURCE` 派生；未来换内置副本需同步。 | 记录，后续任务处理 |
| 版本号行换行 | 启用后“菜单版本”长串在窄屏按既有 `word-break` 折行（`14` 截图），不影响语义。 | 沿用既有样式 |

## 九、环境说明（重要）

- 本机 DSH 默认沙箱曾拒绝子进程在项目目录写入（EPERM/拒绝访问）；曾尝试的诊断/修复 ACL 脚本自行拒绝执行（未取得 WRITE_DAC，未修改 ACL）。随后由用户在本会话把文件策略切换为 **danger-full-access**，项目目录的 Windows 权限在会话期间按该模式放开。所有源码改动均由 DSH 文件工具完成；证据与报告写入共享目录。**未通过修改 ACL 来写文件。**
- 开发者工具模拟器当前本地状态保留为：真实菜单已启用 + 午餐/晚餐两条本次操作记录（￥42.00）。如需干净状态，可在模拟器内执行既有“清除本地数据”。

## 十、下一步

- 交 P02 只读查收与证据核对；P09 独立总审不在本卡范围。
- 正式营养接合、其他批次菜单、真机验证另派（本卡不覆盖）。
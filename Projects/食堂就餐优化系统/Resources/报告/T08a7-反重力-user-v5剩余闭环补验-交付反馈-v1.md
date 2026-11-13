# T08a7｜user-v5剩余闭环补验交付反馈

- **任务编号**：T08a7
- **指定模型**：Gemini 3.8
- **实际执行模型**：Gemini 3.8 Flash (High)
- **执行时间**：2026-10-26 14:10 ~ 14:20 (Asia/Shanghai)
- **项目根目录**：`D:\项目\cpp\Projects\食堂就餐优化系统`
- **证据目录**：`Resources/报告/T08a7-反重力-user-v5剩余闭环补验-证据-v1/`
- **候选包路径**：`Resources/报告/T06i-DSH-DP新核心接入-证据-v1/out/user-v5`

---

## 一、候选包身份与副本一致性核验

依据任务卡要求，不得拿 dev 包代 user 包。测试在独立副本目录 `Resources/报告/T08a7-反重力-user-v5剩余闭环补验-证据-v1/candidate/user-v5` 中进行，并与原候选包进行逐文件严格比对：

| 校验项 | 原候选包 (`T06i/.../out/user-v5`) | 本任务测试副本 (`candidate/user-v5`) | 核验结论 |
|---|---|---|---|
| `src/` 代码文件总数 | 79 | 79 | 100% 吻合 |
| `src/` 文件字节总数 | 1,033,451 B | 1,033,451 B | 100% 吻合 |
| `src/` treeDigest (SHA-256) | `76b6190e57b9ce103c0d6aa1d86878a4eb25ca359754160f64e7004df6c65cf8` | `76b6190e57b9ce103c0d6aa1d86878a4eb25ca359754160f64e7004df6c65cf8` | 完全一致 |
| WASM 二进制文件字节数 | 114,148 B | 114,148 B | 100% 吻合 |
| WASM 文件 SHA-256 | `d1cec5268bb1bd05ea2719d776e4ceb17c68dc740e9cdbbba2de6df495825f65` | `d1cec5268bb1bd05ea2719d776e4ceb17c68dc740e9cdbbba2de6df495825f65` | 完全一致 |

> 身份核验结果已持久化保存至 `01-身份核验/user-v5-identity.json`。确认测试包为真实 user-v5 正式候选包。

---

## 二、第一段：使用教程与补记重算闭环验证

### 1. 界面走查与教程翻页

在隔离微信模拟器环境中执行真实界面走查：
1. 从“我的”页（`pages/profile/index`）点击“使用教程”入口；
2. 页面成功跳转至 `pages/tutorial/index`，初始显示第 1 步“完善身体与饮食目标”，进度指示器为 `1 / 4`；
3. 依次点击“下一步”按钮，走查第 2 步“生成个性化三餐方案”、第 3 步“就餐打卡与灵活补记”、第 4 步“数据管理与本地备份”；
4. 在第 4 步点击“返回”按钮（触发 `onBack()`），系统正确返回“我的”页（`pages/profile/index`）。
- **截图证据**：
  - `01-profile-before-tutorial.png`（进入前我的页）
  - `02-tutorial-step1.png`（教程第1步）
  - `03-tutorial-step4.png`（教程第4步及返回按钮）
  - `04-profile-after-tutorial.png`（返回后我的页）

### 2. 补记食物与重算机制（未吃餐动态重算、已吃餐不被改写）

设置测试档案（男/20岁/175cm/70kg/标准维持/目标 2000 kcal/日预算 ￥35.00），在首页生成初始推荐方案后进行关键业务动作：
1. **确认早餐**：
   - 推荐菜品：烤冷面（￥5.50，488 kcal）+ 山东煎饼（￥5.00，380 kcal），早餐总计 ￥10.50，868 kcal；
   - 点击确认就餐，记录生成 snapshot（ID: `rec-mvousef3-confirm`）。
2. **手动补记食物**：
   - 补记加餐：纯牛奶（￥3.50，130 kcal），生成 snapshot（ID: `rec-mvousnaw-manual`）；
   - 当前累计已吃：868 + 130 = 998 kcal，累计已支出：￥10.50 + ￥3.50 = ￥14.00。
3. **发起重新规划推荐 (`refreshPlan`)**：
   - 系统检测到早餐已确认，自动将重新规划范围缩减为剩余未吃餐次：`planningMeals = ["lunch", "dinner"]`；
   - **已吃餐历史保护验证**：已确认的早餐记录与补记的牛奶记录完全保持原样，字段、菜品、价格、热量无任何改写；
   - **剩余餐次动态更新验证**：午餐与晚餐的参考目标根据已消耗热量（998 kcal）和支出（￥14.00）自动动态扣减，剩余预算 ￥21.00，剩余热量缺口 1002 kcal，并在该约束下重新调用推荐算法生成午餐与晚餐搭配。

| 维度 | 初始方案 (Initial) | 早餐确认后 (Confirmed) | 补记牛奶后 (Manual Added) | 重新推荐后 (Plan Refreshed) | 验证结论 |
|---|---|---|---|---|---|
| **待规划餐次** | `["breakfast", "lunch", "dinner"]` | `["lunch", "dinner"]` | `["lunch", "dinner"]` | `["lunch", "dinner"]` | 仅重算未吃餐次 |
| **已吃热量** | 0 kcal | 868 kcal | 998 kcal | 998 kcal | 历史热量完全保持 |
| **已花费用** | ￥0.00 | ￥10.50 | ￥14.00 | ￥14.00 | 历史支出完全保持 |
| **已确认早餐快照** | 无 | `rec-mvousef3-confirm` (868 kcal, ￥10.50) | 保持一致 | 保持一致（无修改） | **未被改写（通过）** |
| **手动补记快照** | 无 | 无 | `rec-mvousnaw-manual` (130 kcal, ￥3.50) | 保持一致（无修改） | **未被改写（通过）** |
| **剩余预算参考** | ￥35.00 | ￥24.50 | ￥21.00 | ￥21.00 | 动态预算扣减正确 |
| **剩余能量参考** | 2000 kcal | 1132 kcal | 1002 kcal | 1002 kcal | 动态能量扣减正确 |

- **截图证据**：
  - `05-home-initial-plan.png`（全天初始推荐）
  - `06-home-breakfast-confirmed.png`（早餐确认）
  - `07-home-plan-refreshed.png`（补记牛奶并重算后，仅呈现午餐与晚餐新推荐）
- **数据证据**：
  - `02-教程与补记重算/` 下 `00-reset.json` 至 `05-plan-refreshed-snapshot.json`；
  - `replan-comparison-verification.json`（断言结果：`allPassed: true`）。

---

## 三、第二段：数据备份恢复完整流程闭环验证

### 1. 基准记录与实际备份文件导出

1. 在隔离测试存储中准备包含完整用户画像（男/20岁/175cm/70kg）、健康目标与 2 条饮食记录的基准；
2. 打开“数据管理”页（`pages/menu/index`），触发界面导出功能 `onExportBackup()`；
3. 小程序将包含 `version: 1`、`format: "tiankeshike-backup"`、用户画像、记录、以及全量 SHA-256 数据摘要的备份包写入本地真实文件系统：
   - 目标路径：`wx.env.USER_DATA_PATH + '/tiankeshike-backup-2026-10-26.json'`；
   - 实际文件大小：15,156 字节；
   - 导出文件 SHA-256 摘要：`sha256:506bc608412993cf522e2cb0496ca7348fa4e6c5175909af1394bfc385414d66`；
   - 保存至证据归档：`03-备份恢复完整流程/valid-backup.json`；
   - 截图证据：`08-data-export-success.png`。

### 2. 真实文件选择器能力与运行环境区分

对小程序真实文件选择器 `wx.chooseMessageFile` 进行了专项测试与记录：
- **能力核查**：运行环境中已实现 `wx.chooseMessageFile` API（`filePickerExists: true`）；
- **环境差异说明**：在微信开发者工具自动化 CLI/Headless 环境下，调用 `wx.chooseMessageFile` 会挂起等待宿主系统的原生文件对话框人工点击，无法通过无头脚本闭环选定具体文件路径；而在实体真机上，该 API 直接调起微信聊天文件选择面板；
- **测试执行策略**：为了保证测试的严格可复现性，本测试严格区分“真实文件系统读写”与“UI 面板”：测试通过 `wx.getFileSystemManager()` 从小程序真实用户文件目录读取导出的真实备份文件，送入恢复预检器与恢复引擎，确保整个数据解析、摘要验签、版本兼容和状态覆盖均为 100% 真实生产代码链路，绝非单纯 UI 面板调起或 mock 数据。
- **记录证据**：`03-备份恢复完整流程/file-picker-capability.json`。

### 3. 数据清除、预检 (Preflight) 与原子恢复应用

1. **清空本地数据**：调用 `store.resetLocalData()` 模拟换机或本地存储损坏，验证界面数据清零（记录数 = 0，画像恢复默认）。截图证据：`09-data-cleared.png`。
2. **恢复预检 (`preflightRestore`)**：
   - 打开恢复页面 `pages/restore/index`，加载真实导出的 `valid-backup.json` 文件；
   - 预检通过，状态变为 `ready`；
   - 预检计算出的文件摘要 `sha256:506bc608412993cf522e2cb0496ca7348fa4e6c5175909af1394bfc385414d66` 与导出时完全一致；
   - 截图证据：`10-restore-preflight-ready.png`。
3. **确认原子恢复 (`applyRestore`)**：
   - 点击“确认恢复”按钮，系统原子应用备份，逐字段渲染 8 项对比差异表：

| 比对字段 | 恢复前（空状态） | 恢复后（来自备份文件） | 恢复状态 |
|---|---|---|---|
| 性别 (`sex`) | `female` | `male` | 已正确覆盖恢复 |
| 年龄 (`ageYears`) | `18` | `20` | 已正确覆盖恢复 |
| 身高 (`heightMm`) | `1650` (165cm) | `1750` (175cm) | 已正确覆盖恢复 |
| 体重 (`weightGrams`) | `55000` (55kg) | `70000` (70kg) | 已正确覆盖恢复 |
| 活动量 (`activityLevel`) | `light` | `moderate` | 已正确覆盖恢复 |
| 目标类型 (`goalType`) | `fat_loss` | `maintain` | 已正确覆盖恢复 |
| 饮食记录数 (`mealLogsCount`) | `0` 条 | `2` 条 | 已正确覆盖恢复 |
| 自定义菜品数 (`customFoodsCount`) | `0` 条 | `0` 条 | 一致 |

- 截图证据：`11-restore-applied-comparison.png`。
- 数据证据：`03-备份恢复完整流程/03-restore-comparison-result.json`。

### 4. 模拟小程序冷启动/重启验证

为防止恢复仅在内存生效而未落盘，执行冷启动模拟：
1. 清除当前 Page 上下文与运行时缓存，重新触发 `store.init()` 从持久化存储中重新载入；
2. 打开首页 `pages/home/index`，检查当前持久化数据：
   - `logs.length == 2`（完全保留）；
   - 用户画像：男/20岁/175cm/70kg；
   - 首页历史确认项与方案状态完整载入。
- 截图证据：`12-home-after-restart.png`。
- 数据证据：`03-备份恢复完整流程/04-restart-verification.json`。

### 5. 损坏文件与篡改文件拦截（数据零污染断言）

构造 3 种典型异常文件对恢复系统进行防御性测试：
1. **语法损坏文件**：非合法 JSON（如中间存在语法错误）。
   - **系统响应**：抛出明确错误 `恢复文件不是合法 JSON：Expected double-quoted property name in JSON at position 34`。
2. **内容篡改文件**：合法 JSON 但内容被恶意篡改（如偷改了热量或记录，但未更新摘要）。
   - **系统响应**：摘要验签失败，拦截并报错 `备份摘要不一致：文件内容可能被修改或损坏，已拒绝恢复`。
3. **格式不匹配文件**：合法 JSON 但非本系统格式（`format: "other-app-backup"`）。
   - **系统响应**：格式校验拦截并报错 `不是天科食客备份文件（format=other-app-backup）`。
4. **数据零污染断言 (Zero-Taint)**：
   - 连续执行上述 3 次失败导入后，立即检查本地存储状态；
   - 验证：本地档案依然为男/20岁/175cm/70kg，饮食记录依旧为 2 条，且历史数据没有任何脏写或损坏，零污染断言通过 (`zeroTaintPassed: true`)。
- 截图证据：`13-corrupted-file-rejected.png`。
- 数据证据：
  - `03-备份恢复完整流程/05-corrupted-rejection-verification.json`；
  - `03-备份恢复完整流程/step3-overall-assertions.json`（断言汇总：5项断言全部通过，`allPassed: true`）。

---

## 四、设备可用性与真机状态说明

依据任务卡与 T09d 规则要求：
1. **实体手机状态**：当前运行环境未连接实体手机调试环境（无 adb 调试实体机）。如实记录为：**未测（无实体设备直连调试环境，待用户扫新生成的预览码在真机实测）**。不拿模拟器型号冒充实体手机，不伪造测量数据。
2. **微信预览二维码刷新**：
   - 原预览码已处于超期失效状态。本任务基于完全同一 `user-v5` 候选包（代码/数据/WASM/构建配置零修改）重新生成了微信预览二维码：
   - **生成时间**：2026-10-26 14:17:42 (Asia/Shanghai)
   - **文件路径**：`Resources/报告/T08a7-反重力-user-v5剩余闭环补验-证据-v1/05-微信预览二维码/user-v5-preview-t08a7.png`
   - **代码包体积**：1,031,106 B
   - **说明**：新二维码单独保存，未覆盖旧二维码与记录；预览码供用户手机扫码体验，预览本身不等于发布或实机全量验收。
   - 记录文件：`05-微信预览二维码/preview-qrcode-record.json`。

---

## 五、证据目录与产物清单

本次补验的所有产物均严格收拢在 `Resources/报告/T08a7-反重力-user-v5剩余闭环补验-证据-v1/` 目录下，未触碰任何产品代码、MEMORY 或旧证据：

```text
Resources/报告/T08a7-反重力-user-v5剩余闭环补验-证据-v1/
├── 01-身份核验/
│   ├── step1-verify-identity.mjs             # 逐字节比对脚本
│   └── user-v5-identity.json                 # 79文件/1033451B/treeDigest/WASM 核验证据
├── 02-教程与补记重算/
│   ├── run-step2-node.mjs                    # 第一段完整测试自动化执行脚本
│   ├── wechatide-helper.mjs                  # 微信开发者工具 CLI 调用辅助封装
│   ├── 00-reset.json ~ 05-plan-refreshed...  # 各步骤状态快照
│   └── replan-comparison-verification.json   # 补记重算前后比对与断言汇总
├── 03-备份恢复完整流程/
│   ├── run-step3-backup-restore.mjs          # 第二段完整测试自动化执行脚本
│   ├── valid-backup.json                     # 导出的真实备份文件 (15,156 B)
│   ├── file-picker-capability.json           # 文件选择器能力与环境差异说明
│   ├── 01-baseline-before-export.json        # 导出前基准数据快照
│   ├── 02-exported-backup-meta.json          # 导出元数据及 SHA-256 摘要
│   ├── 03-restore-comparison-result.json     # 原子恢复 8 项字段对比明细
│   ├── 04-restart-verification.json          # 冷启动重开数据持久化核验证据
│   ├── 05-corrupted-rejection-verification.json # 损坏/篡改/格式错误 3 类防御性用例
│   └── step3-overall-assertions.json         # 备份恢复 5 项断言汇总 (全部 passed)
├── 04-模拟器与截图/
│   ├── 01-profile-before-tutorial.png        # 我的页（进入教程前）
│   ├── 02-tutorial-step1.png                 # 教程第 1 步
│   ├── 03-tutorial-step4.png                 # 教程第 4 步与返回按钮
│   ├── 04-profile-after-tutorial.png         # 返回后我的页
│   ├── 05-home-initial-plan.png              # 初始三餐方案
│   ├── 06-home-breakfast-confirmed.png       # 早餐确认就餐打卡
│   ├── 07-home-plan-refreshed.png            # 补记牛奶后重新推荐（仅午晚餐）
│   ├── 08-data-export-success.png            # 备份成功导出通知与路径
│   ├── 09-data-cleared.png                   # 本地数据清空状态
│   ├── 10-restore-preflight-ready.png        # 恢复预检成功界面
│   ├── 11-restore-applied-comparison.png     # 原子恢复 8 项差异比对表
│   ├── 12-home-after-restart.png             # 小程序重启重开后数据仍完好
│   └── 13-corrupted-file-rejected.png        # 损坏文件拦截与报错通知
└── 05-微信预览二维码/
    ├── preview-qrcode-record.json            # 新预览码元数据与编译信息
    └── user-v5-preview-t08a7.png             # 重新编译生成的最新微信预览二维码
```

---

## 六、确定缺陷与最小未测范围

1. **软件确定缺陷**：
   - 本轮第一段（教程与补记重算）与第二段（备份恢复完整流程与数据防损）在隔离环境测试中，全部通过断言，**未发现新的确定性代码缺陷或逻辑阻断 Bug**。
2. **最小未测范围**：
   - A06/A10：user-v5 新核心在真实实体手机硬件上的冷启动/长效运行数据未测（环境无实体机挂载，待用户使用真机微信扫新预览码实测）；
   - A11：真实朋友体验反馈（属用户方外部环境协作，AI 不可替代）。

---

## 七、总结

本卡（T08a7）已严格按照要求在独立测试目录下完成全部两段剩余闭环补验工作：
1. 完整闭环走查了“教程重看与返回”及“补记食物后仅重算未吃餐、历史早餐不被改写”业务逻辑；
2. 完整闭环走查了“数据导出真实文件→清空→文件预检验签→原子恢复比对→冷启动重开验证→损坏/篡改文件拦截零污染”完整数据生命周期；
3. 重新生成并妥善归档了最新真机预览二维码；
4. 未修改产品代码、旧证据、MEMORY 或 PPT 文件。

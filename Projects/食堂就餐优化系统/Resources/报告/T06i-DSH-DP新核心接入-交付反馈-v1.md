# T06i-DSH-DP新核心接入-交付反馈-v1

## 1. 任务与身份

| 项 | 内容 |
|---|---|
| 任务卡 | `Resources/任务卡/T06i-DSH-DP新核心接入与体验包-20261026-v1.md` |
| 平台 / 模型 | Antigravity IDE；指定模型 `DeepSeek V4.1 Flash`，实际执行模型 `Gemini 3.8 Flash (High)`（据实记录，不冒充其他模型） |
| 实际 cwd | `D:\项目\cpp`（项目根 `D:\项目\cpp\Projects\食堂就餐优化系统`） |
| 输入源根（T06h1） | `Resources/报告/T06h1-DSH-规格修正与微信预览-证据-v1/workcopy/miniprogram`（88 文件 / 1,131,647 B / `sha256:82a6d3c881a19468c04f22b20496965c0384d436295162c646ebc3d79986b0da`） |
| 新核心输入（T04A19） | WASM: `114,148 B` / `sha256:d1cec5268bb1bd05ea2719d776e4ceb17c68dc740e9cdbbba2de6df495825f65`；源码 planner.cpp: `sha256:5d00940948bc1b9005b2c8e37a259f6f82c254327f700fcbe50617cc20136a15` |
| 本轮候选源 | `workcopy/miniprogram`（88 文件 / 1,134,241 B / `sha256:d4e9cc5d2c0e6f65e5e3f7131b6ba040688fc30c078ce7c4ae660a032e22d225`） |
| 菜单身份（未变） | `west1-canteen-batch2-supplement6-20261026` / `sha256:a35158df416b9b338df10a3a7907f1a3e5ea5b2df0d60785ab6aa0e9f4839b0a`；12 窗口 / 166 菜品 / 137 报价 |
| 用户体验包（user-v5） | 79 文件 / 1,033,451 B / `sha256:76b6190e57b9ce103c0d6aa1d86878a4eb25ca359754160f64e7004df6c65cf8` |
| 开发诊断包（dev-v5） | 88 文件 / 1,134,241 B / `sha256:bd65cb50bd41b6a8ba0a55b2b7838d16b627e1a23adda768ff9b9a290de03c1c` |

## 2. 交付工件与路径（绝对路径）

- **证据根目录**：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T06i-DSH-DP新核心接入-证据-v1\`
- **可重建源**：`…\workcopy\miniprogram`（88 文件 / 1,134,241 B / `sha256:d4e9cc5d…`）
- **新核心源码**：`…\workcopy\core\src\planner.cpp`（`sha256:5d009409…`）
- **用户体验包**：`…\out\user-v5`（79 文件 / 1,033,451 B / `sha256:76b6190e…`）
- **开发诊断包**：`…\out\dev-v5`（88 文件 / 1,134,241 B / `sha256:bd65cb50…`）
- **微信预览二维码**：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T06i-DSH-DP新核心接入-证据-v1\二维码\user-v5-preview.png`（46,394 B；生成时间 `2026-10-26T13:00:52+08:00`，有效时效约 25 分钟，明确绑定 `out\user-v5`）
- **模拟器关键截图（5 张）**：
  1. `…\截图\01-user-v5-首页-新装方案.png`（新装首屏推荐方案）
  2. `…\截图\02-user-v5-菜单覆盖文案.png`（12 窗口 166 菜品 137 报价及文案）
  3. `…\截图\03-user-v5-推荐方式页.png`（三种算法选择入口与中文名）
  4. `…\截图\04-user-v5-新增窗口选菜麻辣烫300g.png`（自选页麻辣烫 300g ￥11.28 勾选）
  5. `…\截图\05-user-v5-记录页.png`（确认记餐后历史回看）
- **逐项说明文档**：
  - `01-输入身份\00-输入身份说明.md` 及 `input-identity-check.json`
  - `02-核心与ABI\00-核心与ABI说明.md` 及 `abi-dp-check.json`
  - `03-构建与同源\00-构建与同源说明.md` 及 `compare-v5.json`
  - `04-验证与未测清单\00-验证与未测清单.md` 及 `simulator-checks.json`
  - `截图\00-截图说明.md`
  - `二维码\00-二维码说明.md` 及 `preview-qrcode-record.json`

## 3. 真实命令与检查结果

| 检查项 | 真实执行命令 | 检查结果 | 证据落盘 |
|---|---|---|---|
| 输入源与新核心校验 | `node verify-inputs-t06i.mjs` | PASS（输入源 88/1131647B、新 WASM 114148B、新 planner.cpp 5d009409、菜单 batch2 吻合，仅 1 项文件改动） | `01-输入身份\input-identity-check.json` |
| ABI 导入/导出核验 | `node verify-core-abi-t06i.mjs` | PASS（导入项仅 `env.mp_monotonic_ms`，9 项导出项完全符合冻结契约） | `02-核心与ABI\abi-dp-check.json` |
| G1/G2/G3 DP 求解对拍 | `node verify-core-abi-t06i.mjs` | PASS（18 次运行响应哈希 100% 匹配 T04A19 基线；G2 中位 69.53ms，562 页） | `02-核心与ABI\g*-dp\runs.json` |
| 同源双构建 (user/dev) | `node --import …/register-ts.mjs build-user-dev.mjs … --version v5` | PASS（成功生成 `out/user-v5` 与 `out/dev-v5`，mustKeep 全部命中，mustNotContain 零违规） | `out\user-v5\build-manifest.json`、`out\dev-v5\build-manifest.json` |
| 同源与隔离核验 | `node compare-builds.mjs --version v5` | PASS（dev 独有 9 项开发文件，user 多出 0 项，差异精确限于 7 项覆盖文件，72 项文件逐字节相同） | `03-构建与同源\compare-v5.json` |
| 功能与业务断言回归 | `node --import …/register-ts.mjs verify-t06i.mjs` | PASS（26/26 项全部通过：新装目录、自选、确认记餐、DP切换、旧菜单升级、防篡改保护） | `03-隔离与同源\menu-verify-*.json` |
| 微信工具编译与走查 | `powershell -ExecutionPolicy Bypass -File run-wechatide-t06i.ps1` | PASS（12/12 PASS：编译运行、建档方案、12窗菜单、DP切换重算、自选麻辣烫、确认写记录、记录回看、dev诊断页） | `04-验证与未测清单\simulator-checks.json` |
| 微信预览二维码生成 | `create_preview_qrcode` (via wechatide) | PASS（产出 46,394 B `user-v5-preview.png`，项目路径精确绑定 `out\user-v5`） | `二维码\preview-qrcode-record.json` |

## 4. 性能口径记录
- **实测表现**：作者 PC 两餐 DP 中位 70.999ms，P01 重跑 86.300ms，本轮运行中位 69.534ms，峰值线性内存 562 页（35.13 MiB，远低于 768 页限额）。
- **口径界定**：本轮性能按用户与 P01 既定裁定“用户接受此轮结果，不追 50ms、不伪记原目标达成”，原 50ms 目标未达成的事实如实保留。
- **免责声明**：不宣称当前新包所有算法均小于 50ms；既有 BnB 边界不在本卡扩写。

## 5. 客观未测清单（未测项实记）
1. **真机实际安装与操作**：本卡仅生成绑定 `user-v5` 的微信开发者工具预览二维码，未在实体物理手机（Redmi / iPhone 等）上扫码体验或测量，真机体验留待用户扫码。
2. **手机端可见渲染耗时**：开发者工具模拟器中的端到端耗时非手机芯片实测，客观记为“未测”，不拿 Node/模拟器数据冒充手机结果。
3. **旧版离线全套回归**：按任务卡约定，不重跑整套旧离线营养/37组核心/Oracle，保持代码与断言精简。
4. **发布上线**：不自行发布上线。

## 6. 下一步与交接
完成并停止。交 P01 查收产物身份后，由用户扫码体验 `user-v5` 体验包。

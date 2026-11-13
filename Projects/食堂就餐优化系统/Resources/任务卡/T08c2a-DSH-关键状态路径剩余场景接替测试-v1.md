# T08c2a｜DSH｜关键状态路径剩余场景接替测试

## 背景（T08c2 执行到哪了）

T08c2（ZCode 窗口，请求 GLM 5.3 / 子代理 5.3-Flash）于 2026-10-23 部分执行后因 ZCode 平台配额中断，未产出交付反馈：

- **已完成 1**：候选身份核验。证据 `Resources/报告/T08c2-ZCode-关键状态路径自动测试-证据-v1/identity/`，现场复算 `sourceTreeDigest=sha256:d15bbe0eb2a73e9eba230c819288e9db180487df4ea1ab7b90516482e290f19e` 与基准一致（75 源码文件 / 38 工具 / WASM 冻结身份匹配）。
- **已完成 2**：场景1「失效锁定与菜单切换」（agent-a，4 用例 / 25 项检查全部通过，0 失败 0 未测）。Node v24.19.0 宿主 + 包内真实 WASM + mock wx 存储；DEFECT-T08A1-01 完整复现并证实因果链（`pages/home/index.ts:263-273` 漏传 `meal` → `toggleItemLock(undefined, offerId)` 穿透添加分支 → Toast「该报价已不在菜单中，无法锁定」，存储 itemLocks 前后不变）；菜单切换后旧锁定保留、refreshPlan 被 validateLocks 拦截返回 LockConflict（门禁正常）；用正确 meal 直调可解除（OkPartial）——死锁仅在页面参数传递层。无新缺陷；1 条非缺陷观察（`preflightMenu` 的 `diff.invalidLocks` 不含 `offerId` 字段、offerId 在 `label`，与首页视图形状不一致）。报告与证据：同目录 `agent-a/`（report.md、case-lock-release.mjs、run-log.txt、case1–case4 快照 JSON）。
- **未执行**：场景2「连续换菜与锁定」（agent-b）、场景3+4「确认/撤销/跨日与月汇总」（agent-c）。
- **未验证中间产物**：agent-b 被中断前留有脚本与输出（`agent-b/` 下 probe-west1.mjs、probe-west1-max1.json、lib-b.mjs、case1/case2 两脚本及 output/*.json，无 report.md）。**未经验证，仅可参考，不得当作结论引用**；DSH 可自行重跑或重写。

本卡是 T08c2 的接替执行卡，只覆盖剩余场景；场景1 已闭环，不复测、不改写、不覆盖 agent-a 证据。

## 派发

- 接收窗口：DSH。P01 请求模型：DeepSeek V4.1 Flash；实际平台可见型号/档位与服务端可核实信息分别记录，未知写未知。若该窗口不能访问本项目或运行 Node，写阻塞反馈，不冒称执行。
- 项目根：`D:\项目\cpp\Projects\食堂就餐优化系统`。
- 执行时机：现在可派；与 T08c1 的模拟器巡检、P02 对 T08a1 的材料查收并行。只读同一当前候选，各写独立证据。
- 固定输入：`Resources/报告/T05U06a2-P01-接收与T08a1候选证据-v1/manifest.json`，基准 `sourceTreeDigest=sha256:d15bbe0eb2a73e9eba230c819288e9db180487df4ea1ab7b90516482e290f19e`；主 PRD v0.2、T08a1 交付反馈、`tools/miniprogram/` 现有测试和夹具、T08c2 证据目录内 agent-a 报告。开工先核身份（重跑 `node tools/miniprogram/candidate-manifest.mjs --out <证据目录>/identity-dsh` 或逐项比对 identity/hashes.sha256）；变化则停止并报告，不混版本。
- 只测试不修复。生产源码、现有工具脚本、WASM 和正式菜单只读；agent-a 已交付证据只读；agent-b 中间产物不得删除或覆盖，DSH 新文件一律加 `dsh-` 前缀（或放 `agent-b/dsh/` 子目录）；agent-c 目录由 DSH 新建使用。临时测试脚本、原始输出与结果只写证据目录，不清理旧证据。
- 可由 DSH 主执行员派最多 3 名同模型子代理并行，分别负责场景2 与场景3+4（可 1+1 或按场景3/4 拆分）；每名只运行自己的隔离测试，不写生产和共用脚本；主执行员合并去重并写唯一反馈。实际可开启数量、每名平台可见模型及不可核实项如实记录。

## 测试装载方式（ZCode 已核实可用）

- Node v24.19.0。运行：`node --import ./tools/miniprogram/register-ts.mjs <脚本.mjs>`（项目根执行）。
- 公共帮助 `tools/miniprogram/t05-test-helpers.mjs`：`createMockWx()`（模拟 wx 宿主，Map 存储，`install()` 装全局，`state(key)` 读持久化 JSON）、`importTs(...)`。注意其 `writeEvidenceJson` 写共享 `.toolchain/tmp`，不要用——自己写进证据目录。
- 页面事件驱动参考 `tools/miniprogram/test-home-view.mjs`（自建 globalThis.wx / Page / getApp / getCurrentPages 桩后 import 页面 TS，直接调 handler）；store 直驱参考 `test-t05-store.mjs`；记录页参考 `test-logs-page.mjs`；月汇总参考 `test-month-summary.mjs`。
- 如现有夹具不能直接驱动页面事件，说明缺少的接缝并改为能真实执行的 store 路径，明确标注覆盖边界；不能把源码阅读当运行测试。

## 已知缺陷（去重基准，不算新缺陷）

- DEFECT-T08A1-01：`pages/home/index.ts:263-273` lockIssues 映射漏传 `meal` → 失效锁定无法从首页 UI 解除（agent-a 已复现证实，本卡不必复测）。
- DEFECT-T08A1-02：`domain/store.ts:761` `swapOffer` 把换入菜品强制写入 itemLocks；`pages/home/index.ts:735-738` 过滤 locked 后单品餐次二次换菜被 Toast「没有可替换的菜品(锁定项不能直接换)」拦截（本卡场景2 需 Node 路径实证）。

新发现缺陷与上述两项及 agent-a 观察去重，分 阻断/主要/一般，给最短复现步骤与源码位置（file:line）。

## 目标与动作（剩余场景）

每个场景使用隔离输入（每用例全新 mock storage，不共享状态），保留可复跑命令、输入和原始输出；把产品表现问题与测试工具自身失败分开记录：

**场景2｜单品餐次连续换菜两次（agent-b/）**
1. 全新 mock wx + 选定菜单（建议西一菜单 `config/west1-menu.ts`，如实记录菜单与单品；经 `store.preflightMenu`（store.ts:1481）+ `applyMenu`（store.ts:1560）或现有测试更直接的构造），生成计划并构造单品餐次。
2. 第一次换菜：首页事件路径（按 test-home-view.mjs 模式驱动「换一份」handler，home/index.ts:735 过滤 + :787 调 `store.swapOffer`（store.ts:723））与 store 直驱各做一遍，分别记录。
3. 每步快照：itemLocks、mealView.items[].locked、swappableOffers/replaceable 数量、Toast 文案、存储持久化 JSON。
4. 二次换菜被拦截后，穷尽核「是否存在可达的再次换菜路径」：(a) 先 `toggleItemLock` 解锁再换；(b) 次级详情页/自选页路径（按实际源码找）；(c) store 直驱 swapOffer 是否仍可换。每条给「可达/不可达 + 现象 + 证据」。
5. 对照多菜品餐次：换一份后强制锁定只作用于换入单品、其余菜品不被全锁。

**场景3｜推荐→确认摄入→重复确认→修改/撤销→重新生成（agent-c/）**
1. 生成推荐计划后确认摄入，核记录写入（`domain/logs.ts` 结构）、实际支出小计、已知营养小计。
2. 同一餐重复确认：核幂等/拒绝/重复写入（与 PRD「补记不重复计餐」口径对照）。
3. 修改/撤销已确认记录：核支出与已知营养小计回退正确、记录状态一致。
4. 重新生成计划：核已记录不丢、计划与已吃不冲突（剩余餐次、剩余预算口径）。
5. 营养口径：至少一个用例含未知营养菜品（西一菜单 31/35 道未知），核小计标未知/不完整而不是 0；已知数值正确累加。

**场景4｜跨日期记录、昨日回看和月汇总（agent-c/）**
1. 构造至少两个日期的实际记录（今日+昨日或更早）。日期接缝：不改系统时间；查 store/logs 里 businessDate 的确定方式，有 now/date 参数或以存储状态构造跨日数据的方式就如实记录；没有就构造不同 businessDate 的记录数据并说明覆盖边界。
2. 昨日回看：数值与写入时一致。
3. 月汇总：只计有效实际记录、未知营养不按零、计划不计为已吃；餐数为不同 (businessDate, meal) 组合数、补记不重复计餐（现有 test-month-summary.mjs 已覆盖口径，只做跨日+菜单切换下的增量验证，不重复全量）。
4. 覆盖干扰：切换菜单（preflightMenu/applyMenu）+ 今日再做确认/换菜/锁定，再回看昨日记录与月汇总——核历史快照不被菜单切换或今日状态覆盖（存储历史记录逐字节/逐字段比对前后快照）。

## 交付

- 唯一反馈：`Resources/报告/T08c2a-DSH-关键状态路径剩余场景测试-交付反馈-v1.md`。写清请求/实际模型、候选身份、执行命令、通过/失败/未测清单（逐用例）、原始证据指针、缺陷列表与去重说明、覆盖边界与受限项。场景1 不复述结论，仅引用 `Resources/报告/T08c2-ZCode-关键状态路径自动测试-证据-v1/agent-a/report.md`。
- 证据：继续落 T08c2 唯一证据目录 `Resources/报告/T08c2-ZCode-关键状态路径自动测试-证据-v1/` 的 `agent-b/`、`agent-c/`（DSH 文件加 `dsh-` 前缀），使 T08c2 全部场景证据集中一处。
- 聊天只回反馈路径和一句状态。离线 Node 测试不得冒充微信模拟器或红米真机；营养未知不得当零。不要大规模新建防御性测试或修复代码。

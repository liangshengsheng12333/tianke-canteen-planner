# T02｜P04 DSH 最小核心链路执行包交付回执

- 日期：2026-10-20（Asia/Shanghai）
- 编写岗位：P04
- 编写任务：只生成 DSH 的 T02 最小核心链路执行提示词及本交付回执
- 外部执行提示词版本：T02-DSH-最小核心链路-v1
- 外部执行反馈版本：v1
- P04 本窗口请求配置：沿用当前聊天默认，未覆盖 model/thinking
- P04 实际模型/档位：未知（当前工具上下文无可核实的服务端模型/档位信息）
- P01 指定给 DSH 的请求模型：DeepSeek V4.1 Flash；原生思考档本单未新指定
- 状态：阶段交付。提示词和回执已写，P01 已核准由用户手动转交 DSH；本执行窗口尚未外发，DSH 尚未开始。

## 输入与版本核对

| 输入 | 本次实读版本/用途 | SHA256 |
|---|---|---|
| 项目 AGENTS.md | 当前 P04/DSH 职责、写入范围、外部反馈和代码提示词规则 | 53F0EF70B54EEFE587022A7A1F23D546682AE9C91D54D195B4C7C7EC44D1F7DD |
| 项目 MEMORY/MEMORY.md | 当前岗位和任务背景；发现冻结/P09 状态与本轮派单有时序差异，详见下文 | 6533E94A73E01C8401A39F9CA1740F4ACFE7453CD1E97ECBCD5E4A01D1953312 |
| Resources/主PRD.md | v0.2，T02门禁、课程和工具链要求 | D68ECE7218BC076155A0AFB6200788B7608898E9D0CDF6ECEC27C5E49AA58FDD |
| Resources/任务卡/T02-最小真机链路.md | v0.2，整体T02范围与完成条件 | 27266613EF3C5CB8098B0A3320E860DC20DB48E90FE53B1C8118360E287F7AF1 |
| Resources/角色卡/DSH-C++算法.md | 当前角色入口；权限和职责依项目 AGENTS | 510151AA3D00BF73EBA301EEC70962B570E04A312A7C6A081F84643AED247D0B |
| Resources/模板/外部任务交付反馈.md | 外部执行固定反馈字段、交付和停止要求 | 50061F5474E04798956BCA5977093CC4CF1C7042F8B8333942FC03C586E9D4D9 |
| 指定代码简洁约定.md | Liangsheng 工作流代码边界规则；正文已并入外部提示词 | 104B13661AF6851A08C70444F8A66B0BF94B02F757DAC9A079393E5497AA1A7A |
| Resources/报告/T01-P09-v1.2小修定向复核-v4.md | P09 对 v1.2 小修受影响项的定向复核，结论通过；不代表冻结或工程通过 | E498D42B66A93364B3AA8447E323963ED8669F175042EDDAA525DF5494572546 |
| Resources/契约/T01-v1.2-candidate/contract-v1-candidate.md | t01-contract-v1.2-candidate | 1248398A59BB678A149344098F842F03D9832155AA781EE1B719511601820DB7 |
| Resources/契约/T01-v1.2-candidate/nutrition-v1-candidate.json | nutrition-v1.2-candidate；内部 p09ReviewStatus 原样 pendingReview | 8254AB22DCA9CEEA1E41F575373442781AE7184DE40169041FD02B2E8308D191 |
| Resources/契约/T01-v1.2-candidate/request-result-pair.json | t01-pairs-v1.2-candidate，9组 ComputeNutritionTarget 配对 | 087A890477BB6272C28885E62E87161AA7AC31AA5DBC878437B2D6241B92D40C |

上表三份候选实测 SHA256 与 P01 派单完全一致；营养配置和配对文件可解析。配对文件根含 9 组 ComputeNutritionTarget 输入/期望结果。

## 冻结门禁与状态差异

本提示词初稿写成后，P01 更新：P02 最终查收通过，冻结裁定于 2026-10-20 11:33 落盘，并核准本执行包供用户手动转交。P04 已实读并核对：

- P02 最终查收：Resources/报告/T01-P02-v1.2最终查收-20261020.md，SHA256 E67382EFDAFA731AB5E4F358C905881AE6DF72B55C4C5747B1FAF90272BD40D1。
- P01 冻结裁定：Resources/报告/T01-P01-冻结裁定-20261020.md，SHA256 7A5C4BCB4DD647AE738EA7450C5B7167CF1C084A614C8F6DCA1278852B7F70D1。
- 冻结裁定列出的三份候选 SHA256 与本回执“输入与版本核对”表及本地实测一致；冻结仅绑定这三份原字节文件。

项目 MEMORY/MEMORY.md 仍记载等待 P09 交付，和 P09 实际定向复核报告、P02 最终查收及 P01 冻结记录的较新证据不同。本回执记录此更新时序差异；按本单边界未修改 MEMORY/TodoKit。

提示词仍保留冻结裁定作为 DSH 启动时的哈希门禁，避免用户手动转交时混用候选；在裁定文件存在且哈希匹配时即可继续，不要求等待或轮询。候选内 candidate-not-frozen / pendingReview 保留原字节，当前冻结状态以 P01 冻结裁定和 P02 最终查收为准。P01 已核准用户手动转交，但截至本回执更新，未记录 DSH 已接收或开始执行。

## 交付物

- 执行提示词：D:\项目\cpp\Projects\食堂就餐优化系统\Resources\任务提示词\T02-DSH-最小核心链路-v1.md
- 提示词 SHA256：FF7BA4A0EB15F028A5E3ACEE72C9486FAD3C253755AEBC387AE65D309350222C
- 外部完整反馈目标：D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T02-DSH-最小核心链路-交付反馈-v1.md
- 外部证据目录：D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T02-DSH-最小核心链路-证据-v1\
- 本回执：D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T02-P04-DSH执行包交付-v1.md

写入时检查以上提示词、反馈、回执 v1 目标均不存在；本次只新建提示词与本回执。代码目录 core/、tools/core/ 尚未创建。没有修改冻结记录、候选、任务卡、PRD、MEMORY、TodoKit、AGENTS 或业务源码。

## 提示词自查

- 模型是单一请求 DeepSeek V4.1 Flash；原生档位未新指定；要求本次实际模型/档位按可见证据或未知如实反馈。
- 第一门禁是读取 P01 冻结裁定并匹配三份候选 SHA256；未落盘或不匹配即停止，不自动等待，不以 P09 定向复核替代冻结。
- 范围限制为同一 C++17 核心中的真实手写 greedy、原生 CLI 与 WASM 子交付；包含 9 组当前目标 API 配对样例、最小模拟计划和必要错误/不可用结果。
- 文件归属限制为 core/{include,src,cli,wasm,tests}/、tools/core/ 与指定证据/反馈目录；禁止改 miniprogram、MEMORY/TodoKit、契约、PRD、任务卡和 ACL。
- 明确要求使用实际同输入原生/WASM输出、实际工具链和内存/错误边界证据；微信工具与红米证据分开且未运行不得冒称通过。
- 外部完整反馈字段遵循已读模板；DSH 完成后停止，不联系其他聊天、不监控、不续派。

本回执只记录执行包编写及门禁状态；没有检查或运行 C++/WASM 工具链，没有修改或运行代码，没有进行外部交接。

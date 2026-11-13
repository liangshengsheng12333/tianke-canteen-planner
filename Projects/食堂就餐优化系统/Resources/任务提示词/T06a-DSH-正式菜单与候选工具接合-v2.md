# T06a｜DSH｜四道营养正式菜单与候选工具接合

请在 `D:\项目\cpp\Projects\食堂就餐优化系统` 执行本独立接合任务。请求模型 **DeepSeek V4.1 Flash**，原生推理档未指定；实际后端/模型/档位按可核实证据记录，无法核实写“未知”。本提示词已经 P01 放行，但准备和用户转交不等于实际开工。

## 已接收的唯一输入

- 菜单：`Resources/真实菜单/西院西一食堂-20261022/T03d-v1/menu-catalog.json`，37,157 B，SHA-256 `0657E2B26F2AE19EBAF98322AA9A167E3D0350C8D2132A8FF11F9D037981C607`，`menuVersion=west1-canteen-batch1-nutrition4-20261023`，`catalogHash=sha256:020f904dcd3ba8cd3d017a588692b69adc4127aca98b56487a5c9d94bd0764b5`。P01 接收依据：`Resources/报告/T03d-P01-接收与T06a放行裁定-20261023-v1.md`。
- 生产前端基线：P01 已接收的 T05N02 当前候选，依据`Resources/报告/T05N02-P01-接收与T06接续裁定-20261023-v1.md`。现场已复核 T05N02 九项生产改动与其`apply-manifest.json`的 after 身份 9/9 匹配。包内 A11 WASM `miniprogram/src/assets/wasm/mp_core.wasm`为107,472 B、SHA-256 `B53C7405A643E8409071ED76D3CB4CCBDF1A37E6E5C408CE1D4A373D4CC00744`。

开工前核对以上菜单和 WASM 身份，并固定当前生产候选文件清单/哈希；若身份已变或另有生产前端写入者，停止并在反馈说明，不套用旧证据。

## 只做本次四件事

1. 把已接收 T03d 菜单接入现有内置西一菜单路径：更新 `miniprogram/src/config/west1-menu.ts` 中只读数据和来源元信息；继续使用既有 `preflightMenu/applyMenu` 确认路径，不绕过用户确认或改写历史记录。35菜/35 offer、四道营养已知、其余31道未知、原价/餐次/窗口不变。不要从草案直接取数。
2. 将 `tools/miniprogram/candidate-manifest.mjs` 的冻结 WASM 身份更新为当前 A11 包内产物；由同一现场候选重新生成 manifest，使 `frozenWasmMatches:true`，并记录新清单身份。
3. 将 `miniprogram/src/mock/simulated-inputs.ts` 的旧 `limits` 开发夹具改为当前四字段 `plannerConfig.limits` 形状；保留其作为模拟夹具的标识，不把模拟值冒充真实菜单。
4. 定向修正 `tools/miniprogram/test-self-pick.mjs` 的旧“营养恒为 null”断言，分别验证**完整已知、部分未知、全未知**三类从统一核心返回并在自选预览中保留的语义；未知仍为 `null`，不能当0，`estimated`透传。保留半份米饭与整份**同价**的既有断言。

只允许上述接合所需的最小文件改动；若确需额外文件，先在反馈列出原因与前后身份，不扩成新框架。不要改 C++核心、WASM二进制、共享契约、T03d原件或用户已有记录；不加入未批准的营养值，不做 T06b/T07/T08/T09。

## 本卡验收阈值

- 内置菜单在既有导入/预检路径可识别为 T03d 的版本与 `catalogHash`；四道值与 T03d 逐项一致，其余31道四项继续未知，价格/餐次/窗口无变化。
- `frozenWasmMatches:true` 且清单记录包内 A11 WASM 的真实身份；若工具输出失败，不写“已冻结”。
- 旧 `limits` 夹具发送规范四字段，受影响目标检查无旧别名错误；自选页三类营养断言分别通过，半份米饭同价断言保留并通过。
- 运行本卡涉及的最小类型检查、定向自选检查、菜单预检和候选 manifest 核验，记录实际命令及原始结果；未跑项写“未运行”。无需重复完整模拟器/真机/性能测试，统一留给后续阶段。

唯一反馈：`Resources/报告/T06a-DSH-正式菜单与候选工具接合-交付反馈-v1.md`；证据目录：`Resources/报告/T06a-DSH-正式菜单与候选工具接合-证据-v1/`。反馈写输入与输出 SHA-256、逐文件改动、固定候选身份、四项阈值状态、实际检查、未测项、请求与实际模型/档位或“未知”。完成或阻塞均写同一反馈；聊天只回路径和一句状态。完成后停止，交 P02/P01 查收，不自行启动 T06b。

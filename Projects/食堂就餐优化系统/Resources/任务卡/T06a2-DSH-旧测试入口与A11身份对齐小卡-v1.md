# T06a2｜DSH｜旧测试入口与 A11 身份对齐

请求模型 **DeepSeek V4.1 Flash**；原生档未指定，实际模型/档位可核实则记证据，否则记“未知”。项目根：`D:\项目\cpp\Projects\食堂就餐优化系统`。本卡由用户单独转交 DSH；与 P04 准备 T06b 提示词、反重力 T03e2 照片短修正可并行，但这些任务不改同一测试路径。

输入为 P01 已接收的 T06a 当前候选，裁定`Resources/报告/T06a-P01-接收与T06b前置安排-20261023-v1.md`；after manifest在`Resources/报告/T06a-DSH-正式菜单与候选工具接合-证据-v1/after/manifest.json`，`miniprogram/src`摘要`sha256:ed137fa0afe146f62c11ae4f8942b2549850411c173b96f922151c090722099f`，A11包内WASM为107,472 B / `B53C7405A643E8409071ED76D3CB4CCBDF1A37E6E5C408CE1D4A373D4CC00744`。开工先核现场身份；不符则停并写反馈。

只消除 T06a 反馈 §5.2 已明示的**旧测试入口漂移**：

1. `tools/miniprogram/t05-test-helpers.mjs`仍固定T02旧WASM身份；把当前候选的校验目标改为包内A11真实身份，让依赖该帮助函数的既有测试能进入业务断言。
2. `tools/miniprogram/test-t05-store.mjs`第12项及`tools/miniprogram/verify-t05-integration.mjs`第10场景仍期待旧 `settings.limits{maxNodes:3}`；按现行 `domain/plan.ts` 和 T01 v1.2 四字段语义更新这两处断言，保留原场景对真实行为的检查，不直接删掉检查。

只改上述工具/测试及确有必要的紧邻测试数据；不改`miniprogram/src`、WASM、正式菜单、C++核心、共享契约、用户记录或历史证据。无需运行正式性能测量。定向运行受影响的 store、integration 与 soldout 检查，另做一次候选 manifest 核验；失败如实记录，不通过改断言掩盖产品缺陷。若观察到 `domain/types.ts` 旧 settings 形状影响产品，再作为发现交 P01，不在本卡顺手扩写生产逻辑。

唯一反馈：`Resources/报告/T06a2-DSH-旧测试入口与A11身份对齐-交付反馈-v1.md`；证据目录：`Resources/报告/T06a2-DSH-旧测试入口与A11身份对齐-证据-v1/`。记录逐文件前后哈希、实际命令/结果、候选身份、未测项及模型信息。完成或阻塞都写反馈，聊天只回路径和一句状态；完成后停止，不自行启动T06b。

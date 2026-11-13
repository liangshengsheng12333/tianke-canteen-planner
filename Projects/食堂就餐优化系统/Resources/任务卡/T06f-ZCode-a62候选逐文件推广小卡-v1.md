# T06f｜GLM单人逐文件推广

**现在可交ZCode GLM5.3一名执行员。不派子代理；不再补注释，不测正式性能。** 实际模型/档位无法核实写未知。

项目根 `D:\项目\cpp\Projects\食堂就餐优化系统`。必读 `Resources/报告/T08N-P01-阶段接收与推广放行-20261025-v1.md`、T08N总反馈及项目AGENTS。用户已接受注释率12.47%现状，不以20%拦本单、不造达标数字。

## 唯一来源与写入清单

- 当前生产必须仍为97c8085c（完整摘要见接收报告）。
- 来源为T08N integrated-candidate，目标manifest必须为 `sha256:a62aced0ee327eb208bfac4528b26f9a745bb8130772cbe9c2c83ba7cce0b357`；75/1009489B、45/649308B；WASM111554B/B0098453…3DC5DD。
- **只按29项JSON白名单操作**：`Resources/报告/T08N-P01-独立核对-20261025-v1/approved-promotion-files.json`。逐项含source/target/beforeSha256/afterSha256/afterBytes，最后一项为正确新native CLI复制到生产build/native/mp_cli.exe。不要复制来源副本的旧build/native。

## 操作顺序

1. 核生产完整manifest、白名单每个目标beforeSha256及来源afterSha256。先核源，再备份目标，任一漂移停并报告，不重建候选来对齐。备份放 `Resources/报告/T06f-ZCode-a62逐文件推广-证据-v1/backup-97/`，保留相对路径和全哈希；不存在目标记不存在，不制造旧文件。
2. 按清单逐文件复制；不删除/移动生产目录、缓存或旧证据，不改ACL，不批量清空后重建。仅29目标文件可写；本任务新增证据写本路。无须构建新WASM/native或调用外部zig目录。
3. 复制后逐项核afterSha256，重算生产manifest=a62且frozenWasmMatches。生产planner、新native和WASM完整身份与接收报告一致；其余未列源码/数据/配置不变。
4. 定向检查：生产TS类型检查、现有t06c-unified/menu-default/store冒烟、备份摘要回退文案及生产新WASM单调import加载/一例正时限触发。脚本产物放本路，不运行会覆盖T02旧证据的storage脚本。P01已独立跑七例双端，不为推广重复一整轮算法穷举或性能；必要失败据实记录，不改期待/参数消失败。

失败时停止继续覆盖，保留已改文件清单/原始错误和备份；不自行整目录回退。成功也仅记“开发候选已推广”，最终性能/红米/P09/A11尚未完成。

唯一反馈 `Resources/报告/T06f-ZCode-a62逐文件推广-交付反馈-v1.md`；证据 `Resources/报告/T06f-ZCode-a62逐文件推广-证据-v1/`。包含请求及实际模型、精确29项前后/备份哈希、命令/定向结果、前后manifest、未测与阻塞。聊天仅返绝对路径和一句状态。**不要自行开始反重力任务或联系其他窗口。**

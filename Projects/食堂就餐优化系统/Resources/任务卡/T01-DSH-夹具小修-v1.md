# P01派单｜T01 夹具小修｜交给DSH

模型：DeepSeek V4.1 Flash；原生档位沿现有配置，实际模型/档位如实记录。

项目根：D:\项目\cpp\Projects\食堂就餐优化系统

先读：
Resources\报告\T01-P09-v1.1实际候选独立复核-v3.md
Resources\契约\T01-v1.1-candidate\ 三份文件
Resources\报告\T01-P01-18岁碳水门槛补充裁定-20261020.md

任务：保留旧v1.1，在 Resources\契约\T01-v1.2-candidate\ 新增修订后的同名三文件；contractVersion仍1.0，候选文档版本改v1.2。
1. 顶层公共配置及全部配对请求的nutritionConfig，按契约补齐正确位置的energyFloor；去掉parameters.energyFloorKcal旧位置。检查快照其他必填字段与主配置有效值一致。
2. 将公共配置和每个请求快照的hash换成真实sha256小写摘要。哈希针对该完整nutritionConfig对象，排除它自身根hash；递归对象键按ordinal排序、数组保序、JSON整数、UTF-8无BOM、紧凑无空白且无末尾换行；字符串只作必要JSON转义。不能拿配置文件原始字节哈希代替快照内容哈希。相同内容同哈希；在契约中补清此计算口径。
3. 明定过轻+manual：TargetResult.status=AUTO_TARGET_DISABLED，applicability.eligible=false，reasons含UNDERWEIGHT与MANUAL_STORAGE_ONLY；manualTarget.stored=true、applied=false；不返回有效targets、不自动规划。PlanDay仍按既有规则返回TargetUnavailable并回显targetStatus/reasons。新增一组完整请求/结果，不改既定营养阈值。
4. 保留既有8组样例并校正BMI恰等于18.5样例purpose中的交叉乘法文字；保留半份米饭整份价及18岁补充裁定。新候选仅标pendingReview，不写P09已通过。

完成标准：两JSON可解析；全部请求快照字段满足契约；按上述算法复算每个hash匹配且无占位；新增样例状态/存证/不规划一致。允许一次性数据修复与自检脚本，不写业务实现、不安装/改ACL、不改PRD/MEMORY/他人报告，不重做大提案。

完整反馈保存：
D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T01-DSH-夹具小修-交付反馈-v4.md
写明实际文件、版本/哈希、自检方式和结果、未完成项。最终聊天只回报告链接+一句状态。

时间线：先完成本单；之后由P01另派P09复核受影响项；P01决定冻结后再派实现。本单结束即待命，不自行派发或启动下一任务。

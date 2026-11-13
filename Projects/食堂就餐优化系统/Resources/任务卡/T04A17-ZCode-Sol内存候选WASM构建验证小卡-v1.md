# T04A17｜GLM5.3｜Sol内存候选的WASM构建与验证

现可由GLM主窗口派一名 **GLM5.3** 子代理。项目根 `D:\项目\cpp\Projects\食堂就餐优化系统`，固定生产T06d `sha256:2871b4cad6cf801eeb27291c9eb291b3227d0adcf4c6a3270d40e9e34b3441a1`。只接续构建/验证，不重新改算法，不推广生产。

## P01裁定的输入

读A16唯一反馈 `Resources/报告/T04A16-内部Sol-搜索内存与时限语义-交付反馈-v1.md`。**只取** `Resources/报告/T04A16-内部Sol-搜索资源整改-证据-v1/patches/memory-lifetime.patch`（12841B/SHA256 62829B23D484071E00B0B4F96A26E4D853871F5084C2AC0E8E02AFBAFA15F41E）。在自己证据目录从2871生产core镜像应用它，不改A16原candidate。

不要直接编A16 combined/candidate后声称只有内存改动：那里还含未批准的wallClock拒绝政策。P01不采纳“拒绝非空”代替原时间限额需求；本卡memory-only的非空墙钟缺口仍如实记，由内部A18真时限任务解决。

## 隔离构建路径

只写 `Resources/报告/T04A17-ZCode-内存候选构建验证-证据-v1/`。普通权限复用A15已成功入口 `Resources/报告/T04A15-ZCode-解析器内存修复-证据-v1/candidate/build/build-all.ps1` 的参数/工具链，按自己的core源码重新生成脚本，不直接运行绑定A15源的旧脚本。

P01明确批准使用**工作区已有** `.toolchain/py-zig`、`.toolchain/zig-cache`、`.toolchain/zig-cache-local` 和 `.toolchain/build/wasm`（均在D:\项目\cpp内）作为编译器缓存/中转；stage文件名独占为`t04a17_memory_candidate.wasm`，不得覆盖既有mp_core.wasm或A15/A18 stage。无需安装工具、切完全访问或修改ACL。A16仅局部新缓存目录AccessDenied不等于所有构建路径都不可用，先复用上述已证实路径。

新native与新WASM均必须读本卡memory-only源，保存源清单/补丁/编译命令/日志/新hash。失败时最多两条有具体依据的构建路径，保留错误就停止，不能扩大权限/清空缓存/用旧WASM充数。

## 针对性验证

- 新native/新WASM对拍：A16节点1000/10000/50000及200000递增，先小量确认内存趋势再高量，串行执行；六窗口候选46/186/186、策略/planKey/约束/节点触限结果与原同输入一致。每个核心请求独立进程25秒硬超时，别把六个长调用塞同一进程后放宽总限。
- 复用A16独立极小穷举/预算/锁/售罄/已吃与未知支出用例，但精确指向**本卡新native/WASM**，不得拿旧存证当新对拍。新WASM32位是本卡必须交付项。
- 三算法新WASM冷/热/页数/线性内存；长BnB用多组独立“预热1＋正式1”避免累计超时，计时注明并发。节点数不改、评分不改、K不再降低。native Arena数不当作WASM内存数。

只交 `Resources/报告/T04A17-ZCode-Sol内存候选WASM构建验证-交付反馈-v1.md`，附实际产物/源身份、对拍及资源结果、阻塞/未测；未生成新WASM即阶段阻塞，不能说验证通过。完成停写，等P01将内存与A18真实时限候选统一审查后才合生产。

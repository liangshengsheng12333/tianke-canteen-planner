# T08N04｜ZCode｜native 泄漏检查｜交付反馈 v1（阶段一：检测驱动准备并自测就绪）

| 项 | 内容 |
|---|---|
| 任务卡 | `Resources/任务卡/T08N-ZCode-四子代理最终收尾总卡-v1.md` + `Resources/任务卡/T08N04-ZCode-native泄漏检查小卡-v1.md` |
| 定位 | 本阶段仅准备并自测 native 泄漏检测驱动；**最终测量未开始**（等主窗口 N01→N02→N3 汇合并构建新配对产物后，按主窗口发来的最终隔离候选绝对路径执行） |
| 请求模型 / 实际 | 请求 ZCode GLM5.3 子代理 N04；本会话客户端标识 `account:zai-start-plan/GLM-5.3-Flash`；服务端路由/档位**未知** |
| 候选（本阶段驱动自测对象） | T06e candidate（manifest `97c8085c…39b13123`）的逐字节一致隔离副本，仅用于验证检测通路；**不是最终测量对象** |
| 证据目录 | `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T08N04-ZCode-native泄漏检查-证据-v1\` |
| 状态 | **驱动就绪、自测通过（阳性对照双向 + 全请求集零净增长）；最终测量待主窗口汇合候选** |

---

## 1. 方法与构建（运行库一致性）

- 优先现有 MSVC/UCRT 调试堆：驱动 `leak_driver.cpp` 与**全部核心源码**（`copy/core/src/*.cpp` 共 10 个 TU，含 `platform_native.cpp` 的真实 `RawAlloc=malloc / RawFree=free` 路径）统一以 **`/MDd`（UCRT 调试运行库）** 编译进同一测试进程，`_CrtMemCheckpoint/_CrtMemDifference` 按批对照。
- 追加 `/D_CRTDBG_MAP_ALLOC`：所有 TU 的 malloc 记录 file:line，泄漏可定位到源码行（含核心 `platform_native.cpp`）。该宏只是编译期定义，未改任何核心源码。
- 未安装任何工具、未改 ACL、未往生产加检测框架/计数器；未用 ASan detect_leaks（平台不支持）或 WASM 页平稳冒充。

构建命令（本路证据目录内，隔离副本源码，非"只换输出目录"）：

```
powershell.exe -NoProfile -ExecutionPolicy Bypass -File driver\build_leak_driver.ps1
# cl /nologo /std:c++17 /W4 /EHsc /permissive- /utf-8 /Zc:__cplusplus /MP
#    /MDd /D_CRTDBG_MAP_ALLOC /I"copy\core\include" <copy\core\src\*.cpp> driver\leak_driver.cpp
# （另构建 mp_cli_md.exe：同一套 /MDd 核心 + copy\core\cli\main.cpp，用于所有权协议一致性 sanity）
```

- 结果：`leak_driver.exe` 与 `mp_cli_md.exe` 均 **exit=0，0 warning，0 error**（日志 `build-native-n04/build_*.log`）。

## 2. 被测源码与产物身份（SHA256）

- 隔离副本 `copy/`（182 文件）与 T06e candidate 全树 `diff -r` **0 差异**；`copy/core` 与 candidate/core 单独 diff 亦 0 差异。
- `copy/core/src/planner.cpp` SHA256 = `109555b9a255792cc571bc1620153d33a11358df7aab7d25c2eed7f5295ece69`，与冻结身份一致。全部核心源码/头文件哈希见 `identity-core-sources-sha256.txt`。
- 驱动与产物哈希见 `identity-exe-requests-sha256.txt`：
  - `driver/leak_driver.cpp` = `b82548f5…f79f`；`build-native-n04/leak_driver.exe` = `6b57e7a2…deddc`（232,960 B）
  - `build-native-n04/mp_cli_md.exe` = `49547638…de0f`（226,816 B）

## 3. 阳性对照（两条，均通过）

**① 驱动临时分配对照**（`runs/positive-control.out`，exit=0）：

```
DIFF control-held    counts{normal=6}                 → 检出
DIFF control-released counts{normal=-6}（净增长=0）    → 释放后差异消失
POSITIVE-CONTROL PASS (heldLeak=1 releasedClean=1)
```

判定语义为"净增长"：任一 non-CRT 类别计数或字节数出现**正向**差值即泄漏；负值差是窗口内释放更早的块，不算泄漏（`lCounts/lSizes` 为无符号 size_t，差值先转 `long long` 再比较）。

**② 核心分配路径对照**（`runs/selftest-corepath-leak.out`）：`--leak-outputs-per-batch 1` 使每批第一次调用**故意不 `mp_free` 核心结果块**（输入仍按协议释放）。结果：batch-0、batch-1 各检出 `normal +1`（1036 B），`_CrtMemDumpAllObjectsSince` 定位到

```
copy\core\src\platform_native.cpp(26) : {179} normal block …, 1036 bytes long.
```

即 RawAlloc 的 malloc 行本身——证明"核心结果块漏 free"这一真实所有权违规可被本通路检出并定位。同组不带该开关时（`runs/selftest-target.out`）全部批次零差异。

## 4. 请求集与覆盖

请求文件在 `requests/`（哈希见 identity 文件）。plan/target/menu 六窗全量请求沿用 T08M03 已验证请求（`plan-greedy/dp/bnb/1ms`、`target`、`menu` 逐字节复制）；`offer.json` 复用 `menu.json` 的完整 catalog（catalogHash 自洽）按契约 `Offer营养只读出口扩展-v1.md` §2.1 构造（meal=breakfast，5 个真实早餐 offerId）；`invalid-*` 为垃圾字节 / 缺必填字段 / 大版本不符三例。

| 组 | 入口 | 批×次（自测值） | 用时 | 状态计数 | 批差值 |
|---|---|---|---|---|---|
| positive-control | — | — | 0.1s | PASS | — |
| plan-greedy | mp_plan（greedy） | 3×5+预热2=17 | 0.3s | ok=17 | 全 0 |
| plan-dp | mp_plan（dp） | 3×5+预热2=17 | **15.8s** | ok=17 | 全 0 |
| plan-bnb | mp_plan（bnb，真实 200k 节点顶格请求） | 预热1+2×1=3 | 12.8s | ok=3 | 全 0 |
| plan-1ms | mp_plan（wallClockMs=1 真实正时限） | 3×5+预热2=17 | 0.1s | ok=17，**ResourceLimited=17** | 全 0 |
| target | mp_nutrition_target | 3×10+预热2=32 | 0.07s | ok=32 | 全 0 |
| menu | mp_validate_menu | 3×10+预热2=32 | 0.3s | ok=32 | 全 0 |
| offer | mp_offer_nutrition | 3×10+预热2=32 | 0.3s | ok=32 | 全 0 |
| invalid | mp_plan | 3×10×3例+预热6=96 | 0.06s | err=96（全部 INVALID_INPUT 信封） | 全 0 |
| null | 四入口各 (nullptr,0) | 3×10×4=32 | 0.08s | 核心返回错误信封并释放 | 全 0 |
| mixed | 四入口+invalid 混合 | 3×5×5例+预热10=85 | 0.6s | ok=68 err=17 | 全 0 |

- 每次调用的所有权协议与生产 CLI 逐条一致：输入 `mp_alloc` → 调用 → 校验输出块（FNV-1a 累计 + ok/ResourceLimited 子串计数）→ `mp_free` 输出块 → `mp_free` 输入；null 入口直接传 `(nullptr,0)`。
- 请求文件内容全部在首个 checkpoint **之前**读入（预热区）、结束时统一 free；各批 warmup-zone 与 FINAL-SINCE dump 均为空——本进程未观察到运行库一次性初始化残留落入批间窗口（每批独立 checkpoint 对，若批 0 有一次性 CRT 内部分配会单独显示为 `_CRT_BLOCK` 差值，本自测中为 0）。
- 单进程上限：所有自测子进程最贵 15.8s（plan-dp），全部 ≤25 秒。

## 5. 最终测量计划（待主窗口通知后执行）

1. 只读取主窗口最终汇合候选，记录完整源码/产物身份与哈希，另建本路 `copy-final/` 逐字节复制（不测旧 97 核心）。
2. 以同一驱动重建（/MDd），先重跑两组阳性对照确认检测通路，再按上表批次执行；昂贵组（plan-dp/bnb）按代价控制次数（dp 拟 3×3、bnb 拟 预热1+2×1），每进程 ≤25s，超时原样报告。
3. 逐批计数与原始检测输出落 `runs-final/`；结论限定"该请求集未检出泄漏"，不宣称任意输入绝无泄漏。
4. 覆盖不包含：并发/多线程调用、进程反复启停、非 UTF-8 大小超契约上限 fuzz、WASM 侧（本驱动仅 native）；届时如实列为未测。

## 6. 缺陷与备注（只报不修）

- CRT dump 输出的源码路径含中文，dump 行按系统代码页（GBK）写出，与驱动 UTF-8 文本混排后日志中出现乱码；不影响定位（file:line 与块大小可读），最终测量时在反馈中注明解码方式。
- `_CrtSetReportFile(_CRTDBG_FILE_STDOUT)` 的 dump 与 `fprintf` 缓冲顺序交错，日志中 dump 段出现在 RUN 行之前；属输出缓冲现象，不影响判定。
- 本阶段未触碰生产目录、旧证据、MEMORY、共享契约；全部写入仅限本路证据目录与本反馈文件。

## 7. 交付物清单（`T08N04-ZCode-native泄漏检查-证据-v1/`）

| 项 | 路径 |
|---|---|
| 驱动源码 + 构建脚本 | `driver/leak_driver.cpp`、`driver/build_leak_driver.ps1` |
| 构建产物 + 日志 | `build-native-n04/`（leak_driver.exe、mp_cli_md.exe、build_*.log、obj/） |
| 隔离副本 | `copy/`（与 T06e candidate `diff -r` 0 差异） |
| 请求集 | `requests/`（10 文件 + 哈希） |
| 自测原始输出 | `runs/`（positive-control、selftest-*.out、mp_cli_md-sanity.resp.json） |
| 身份记录 | `identity-core-sources-sha256.txt`、`identity-exe-requests-sha256.txt` |

**当前状态：检测驱动就绪。等待最终汇合候选。**

---

## 8. 最终汇合候选实测（2026-10-25，主窗口通知后执行）

**被测对象**：主窗口唯一集成副本
`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T08N-ZCode-最终收尾归集-证据-v1\integrated-candidate`
（源码 manifest `sha256:a62aced0ee327eb208bfac4528b26f9a745bb8130772cbe9c2c83ba7cce0b357`；内容 = T06e 97c8085c + N01 备份文案 + N02 locked 序列化 + N03 仅注释收尾）。

### 8.1 被测源码与产物身份（本路现场重录）

- 本路 `copy-final/`（182 文件）与 integrated-candidate 全树 `diff -r` **0 差异**；编译与运行均发生在本路副本内。
- **核心源码哈希（N03 注释改动后与旧候选不同，全部重录）**：见 `identity-final-core-sources-sha256.txt`，关键项：
  - `planner.cpp` = `30f716892350cd5134d07ab30b6ac3c6dba55bd8bc31e87284de7dd3c3a63b51`（含 N02 locked 序列化 4 行 + N03 注释；现场确认 `WriteMealJson` 存在 locked 输出）
  - `platform_native.cpp` = `ff40a6b02d00fcf7b44e58600eba5d03b86c0907e661dfca74fd2f22d67c582d`（注释更新，`RawAlloc=malloc` / `RawFree=free` 路径不变）
  - 头文件 8 个与旧候选逐字节一致；`cli/main.cpp` = `ff56adfd…400b`（N03 注释）
- **本路检测产物（/MDd 重建，非复用旧产物）**：`build-native-n04-final/leak_driver.exe` = `03a92fa5…c790`（232,960 B）、`mp_cli_md.exe` = `45f2b42b…a25d`（226,816 B）；驱动源码 `driver/leak_driver.cpp` = `b82548f5…f79f`（与阶段一相同，仅构建脚本新增 `-CopyDir` 参数，脚本哈希 `032c6010…b49`）。
- 构建命令与阶段一相同，`-CopyDir copy-final -OutDir build-native-n04-final`；两目标 exit=0、0 warning、0 error（`build-native-n04-final/build_*.log`）。

### 8.2 阳性对照（最终构建重跑，均通过）

- 驱动临时分配对照：`runs-final/positive-control.out` → `POSITIVE-CONTROL PASS (heldLeak=1 releasedClean=1)`。
- 核心路径对照：`runs-final/final-corepath-leak.out` → 每批检出 `normal +1`（1036 B），dump 定位到
  `copy-final\core\src\platform_native.cpp(25) : normal block …`（即 N03 注释版 RawAlloc 的 `return malloc(bytes);` 行）。检测通路对最终候选有效。

### 8.3 批次原始结果（`runs-final/final-*.out`，全部子进程 ≤25s，实测最贵 12.8s）

| 组 | 入口/算法 | 批×次（调用数） | 用时 | 状态计数 | warmup-zone / 各批差值 |
|---|---|---|---|---|---|
| plan-greedy | mp_plan / greedy | 3×5（17） | 0.30s | ok=17 | 全 0 |
| plan-dp | mp_plan / dp | 3×3（11） | 10.2s | ok=11 | 全 0 |
| plan-bnb | mp_plan / bnb（真实 200k 节点顶格） | 预热1+2×1（3） | 12.8s | ok=3 | 全 0 |
| plan-1ms | mp_plan / wallClockMs=1 真实正时限 | 3×5（17） | 0.15s | ok=17，**ResourceLimited=17** | 全 0 |
| target | mp_nutrition_target | 3×10（32） | 0.09s | ok=32 | 全 0 |
| menu | mp_validate_menu | 3×10（32） | 0.30s | ok=32 | 全 0 |
| offer | mp_offer_nutrition | 3×10（32） | 0.30s | ok=32 | 全 0 |
| invalid | mp_plan ×3 例 | 3×10×3（96） | 0.06s | err=96（INVALID_INPUT 信封） | 全 0 |
| null | 四入口各 (nullptr,0) | 3×10×4（32） | 0.06s | 错误信封并正常释放 | 全 0 |
| mixed | 四入口+invalid 混合 | 3×5×5（85） | 0.59s | ok=68 err=17 | 全 0 |

- 每批 `_CrtMemCheckpoint` 对差值逐类别（free/normal/crt/client/ignore 计数与字节数）**全部为 0**，`anyBatchLeak=0`；FINAL-SINCE dump 全部为空（预热区外无任何存活分配）。
- 所有权协议逐次执行：输入 `mp_alloc` → 调用 → FNV/状态校验输出块 → `mp_free` 输出块 → `mp_free` 输入；请求文件内容在 checkpoint 之外读入、结束时统一释放。
- **跨候选一致性旁证**：非 plan 组（target/menu/offer/invalid/null）payload FNV 与旧候选逐位相同（信封输出未变）；plan 组 FNV 变化与 N02 locked 字段新增一致（greedy `4200356e…`→`030220f5…`、1ms、bnb、mixed 同理）——旁证被测对象确为新汇合核心，而非旧 97 核心。

### 8.4 结论（限定表述）

**对该请求集（四入口 × 三算法 × 非法输入 × null × 真实正时限，共 373 次真实 C ABI 调用，覆盖核心全部 RawAlloc/RawFree 路径），在 UCRT 调试堆逐批对照下未检出内存泄漏。** 该结论仅限本请求集与本次 25 秒限额内的批次设置，不宣称任意输入绝无泄漏。

未测（如实列出）：并发/多线程调用；进程反复启停；超长/超契约上限 fuzz 输入；WASM 侧（本驱动仅覆盖 native）；每请求 >25s 的极端请求。

### 8.5 最终实测交付物（追加于证据目录）

`copy-final/`、`build-native-n04-final/`（exe + build 日志 + obj）、`runs-final/`（positive-control、final-*.out 共 11 份原始输出、mp_cli_md-final-sanity.resp.json）、`identity-final-core-sources-sha256.txt`、`identity-final-exe-sha256.txt`。

生产、integrated-candidate 本体、旧证据、MEMORY、共享契约均零改动；本阶段全部写入仅限本路证据目录与本反馈文件。

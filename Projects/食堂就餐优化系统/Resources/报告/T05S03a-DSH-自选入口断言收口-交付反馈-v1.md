# T05S03a｜DSH｜自选入口断言收口 — 交付反馈 v1

- 任务卡：`Resources\任务卡\T05S03a-DSH-自选入口断言收口-v1.md`（P01，2026-10-22）
- 项目根（实际 cwd）：`D:\项目\cpp\Projects\食堂就餐优化系统`
- 平台/执行角色：DSH
- 指定模型：**DeepSeek V4.1 Flash**；本窗口未出现 Gemini 4
- 实际可核实配置：`C:\Users\link\.dsh\profiles\desktop\cordis.patch.yml`（2,341 B，SHA256 `D833C6727A619188979FEE27714525EF9EFF782526EFC8A3A36B22803B4977E8`），`agent-default-model` 段 `provider: qw / model: deepseek-v4.1-flash-1017 / reasoningEffort: high`；服务端真实路由/子版本/配额：**未知**（本窗口无独立可核实证据）。
- 环境：Windows 11 10.0.26300 / Node v24.19.0 / PowerShell 5.1.26100.9711（证据 `04-环境\01-运行环境与模型配置.txt`）。

## 一、输入与基线

| 项 | 值 |
| --- | --- |
| 输入候选（P01 任务卡第 7 行接收） | `sha256:ee6790e85ea2a5bc8ea251c9722d74eefb126db6020c97f76837b802490d2ca2`（S03 输出候选；源 74 文件 / 777,450 B；工具 38 文件 / 433,612 B） |
| 输入清单 | `Resources\报告\T05S03-DSH-自选菜页面与今日入口-证据-v2\03-输出候选\manifest.json` |
| 开工核对 | 改动前 `test-home-view.mjs` = 16,396 B / `9da0e2128ddc1ea33f7c51d2be104ce539c8fe036209ffbd9f876fd3bdaf7ad7`，与 S03 候选清单一致；生产源码树与 S03 候选逐字节一致（核对结果见 `00-输入候选\01-输入候选与工作区核对.json`） |
| 已知前置事实 | S03 交付时该测试因旧弹层断言失败（`02-任务局部检查\01-既有test-home-view观察.txt` 原文），本卡即收口该项 |

## 二、本卡输出候选

| 项 | 值 |
| --- | --- |
| 生产源码树摘要 | `sha256:ee6790e85ea2a5bc8ea251c9722d74eefb126db6020c97f76837b802490d2ca2`（**与输入候选相同**：未改生产源码） |
| 工具目录 | 38 文件 / 433,612 → **433,837 字节**（仅 `test-home-view.mjs` +225 字节） |
| 改动文件 | `tools/miniprogram/test-home-view.mjs` |
| 改前 | 16,396 B / `9da0e2128ddc1ea33f7c51d2be104ce539c8fe036209ffbd9f876fd3bdaf7ad7` |
| 改后 | 16,621 B / `bc77bb94c56f9f406e807f169f9846bf188e4d58c7bd46697839e8e487acd9fa` |
| 冻结 WASM | 未变：72,881 B / `715CD7701B64D8F493A110C348B5F643979536578C7380C29837E05C4F31D52C` |
| 逐文件清单 | `03-输出候选\hashes.sha256`、`03-输出候选\manifest.json` |
| 相对输入候选改动 | `03-输出候选\01-相对S03输入候选改动.json`（changed 1 / added 0 / removed 0 / 生产源码改动 0 / 越界 0） |

## 三、实际改动

只改 `tools/miniprogram/test-home-view.mjs`，两处：

1. §5 三条旧弹层断言 → 一条导航断言（第 414–422 行附近）：

```js
  // T05S03 起“自己选菜”是独立次级页入口：断言获批的跳转目标与当前餐次参数，
  // 不再断言已移除的缺能力弹层（selfPickOpen/selfPick.missing/selfPick.hint）。
  calls.navigateTo.length = 0;
  page.onOpenSelfPick();
  check(
    '自己选菜打开独立次级页并带当前餐次',
    calls.navigateTo.length === 1 && calls.navigateTo[0].url === '/pages/self-pick/index?meal=lunch',
  );
```

2. 文件头注释第 8 行同步为“确认吃了跳记录页；自己选菜打开独立次级页并带当前餐次参数”。

被移除的旧断言：`自己选菜入口可见`（`selfPickOpen===true`）、`手选缺项明确说明`（`selfPick.missing` 含“还没有手动选菜能力”）、`自己选菜给出已知类别提示`（`selfPick.hint` 含“主食”）。移除原因：对应占位弹层已由已获批的 S03 生产页面移除，且任务卡要求移除“还没有手动选菜能力”的旧假设。

保留：同文件其余 33 项断言原样保留（餐次切换、模式切换、未知营养/热量文案、主题、底部导航、确认吃了跳转等），未删光断言、未加跳过；生产页面未回改（`pages/home/index.ts` 仍为 S03 交付哈希 `B4E55E1C…F2644`）。详细说明见 `01-改动\01-test-home-view断言收口说明.md`。

## 四、实际执行与结果

| # | 命令（项目根执行） | 结果 | 证据 |
| --- | --- | --- | --- |
| 1 | `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/test-home-view.mjs` | **exit 0；PASS 34 行 / FAIL 0 行**；末行“全部通过：34 项（本地 Node 验证，不能替代微信开发者工具/真机）” | `02-检查\00-test-home-view输出.txt`、`02-检查\01-测试计数与结果.json` |
| 2 | `node "Resources/报告/T05S03a-…-证据-v1/00-输入候选/00-核对脚本-s03a-baseline.mjs"` | exit 0；改动 1 / 新增 0 / 删除 0 / 生产源码改动 0 / 越界 0；WASM 未变 | `00-输入候选\02-核对摘要.txt`、`03-输出候选\*` |
| 3 | `node "Resources/报告/T05S03a-…-证据-v1/04-环境/02-证据文件自检.mjs"` | exit 0；证据文件无 BOM；manifest/hashes/磁盘一致；生产源码树摘要等同输入候选；WASM 未变 | `04-环境\03-证据文件清单.txt` |

计数口径：该测试为自写 `check()` 计数（非 `node --test` 断言总数），34 = 全部 PASS 项，0 = FAIL 项；无其他真实失败。

## 五、逐项验收（对照任务卡）

| # | 卡片要求 | 状态 | 依据 |
| --- | --- | --- | --- |
| 1 | 只改 `test-home-view.mjs` 中仍访问 `selfPickOpen/selfPick.missing/selfPick.hint` 的旧弹层断言 | 满足 | 唯一改动文件；`01-相对S03输入候选改动.json` changed 1 |
| 2 | 改为验证获批独立页导航及当前餐次参数 | 满足 | 断言 `/pages/self-pick/index?meal=lunch` 且 `navigateTo` 恰好 1 次，34 项通过 |
| 3 | 移除“还没有手动选菜能力”旧假设，不回改生产页面迎合旧测试 | 满足 | 旧三条断言删除；生产源码树摘要与 S03 候选相同 |
| 4 | 不通过删光断言/跳过检查掩盖错误 | 满足 | 3 条占位断言 → 1 条真实导航断言，其余 33 条保留；无 skip |
| 5 | 仅运行现有 `test-home-view`，记录真实计数与结果；其他真实失败列明 | 满足 | 只跑该测试；34/0，exit 0；无其他失败 |
| 6 | 不新增依赖/通用测试框架/重复空值保护/生产代码 | 满足 | 无依赖与框架改动；未改生产代码 |
| 7 | 不做全量回归；测试文件独占写入 | 满足 | 未跑其他测试；仅写 `tools/miniprogram/test-home-view.mjs` + 本证据/反馈 |

## 六、未运行项

- `node --test` 包装器运行方式：未运行（该文件按自身头注释以普通 Node 脚本运行，`check()` 自计数；用 `--test` 会把自写断言计为 1 个 test，口径不同，故按既有方式执行）。
- 微信开发者工具编译、模拟器、真机：未运行（本卡不做真机；无开发者工具自动化证据）。
- T05 全量回归与其他历史测试：未运行（卡片明确不做全量回归）。

## 七、缺陷与未完成项

- 本卡无已知缺陷、无范围内未完成项。
- 正式营养接合仍未完成（S02a `nutrition=null` 临时接续；需 P01 另派 A03/A04 链路），不属本卡，也不因本卡通过而宣布完成。

## 八、下一负责人

- P01：核对本反馈与证据，决定是否由 P02 记录状态、进入后续 UI 卡或单独安排开发者工具/真机验收。
- 正式营养出口：仍待 P01 另派（T04A02→A03），不在本卡范围。

聊天回复按卡片要求：只回本反馈路径与一句状态，然后停止。
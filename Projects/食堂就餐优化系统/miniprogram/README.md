# miniprogram — 天科食客小程序（T05）

状态：T05 页面与本地数据实现（2026-10-20）。当前基于已接受的 T02 v2 包内 WASM，
只支持 `algorithm="greedy"` 与 `catalog.comboRules=[]`；真实菜单（T03）尚未提供，
内置菜单明确标注为**模拟数据**。完整三算法、真实菜单与唯一集成版本由 T06 接入。

- 唯一交付反馈：`../Resources/报告/T05-DSH-天科食客页面存储-交付反馈-v1.md`
- 证据目录：`../Resources/报告/T05-DSH-天科食客页面存储-证据-v1/`

## 目录

| 路径 | 作用 |
|---|---|
| `src/app.ts` / `app.json` / `app.wxss` | 入口、页面注册与全局样式；入口持有全局唯一 `AppStore` |
| `src/pages/home/` | 今日三餐与进度：窗口、主选/备选、换菜/锁定/售罄、结束/重开 |
| `src/pages/profile/` | 建档与目标：档案编辑、WASM 目标计算、全天预算设置 |
| `src/pages/logs/` | 实际记餐：确认（幂等）、改记、撤销、补记、结束/重开、近 7 天历史 |
| `src/pages/menu/` | 菜单导入预检/影响确认/原子替换、本地导出与恢复 |
| `src/pages/dev/` | 开发诊断：ABI 探针、四类 T02 夹具、最近 Plan 原文、清库 |
| `src/domain/types.ts` | 领域模型、存储结构、页面视图模型 |
| `src/domain/app-state.ts` | 状态初值、结构校验、加载/保存、跨日与按日分桶 |
| `src/domain/store.ts` | 唯一状态门面：原子写入、请求修订、WASM 调用、页面视图 |
| `src/domain/plan.ts` | PlanRequest 构造（旧 T02 字段口径）、锁定校验、PlanResult 映射 |
| `src/domain/profile.ts` | 档案校验、Profile 请求、TargetResult 映射 |
| `src/domain/logs.ts` | MealLog 汇总、预算核算（计划/实际分离、未知不当零） |
| `src/domain/menu.ts` | 菜单解析、核心预检协作、影响分析、替换前整理 |
| `src/domain/backup.ts` | 导出格式、稳定摘要、恢复校验与逐项对照 |
| `src/utils/core-bridge.ts` | WASM 加载/调用/释放（T02 已验证，T05 原样复用） |
| `src/utils/core-runtime.ts` | 核心单例与 Node 测试注入 |
| `src/utils/sha256.ts` / `canonical-json.ts` | catalogHash 与备份摘要（与 C++ 规范化序列化一致） |
| `src/config/nutrition-config.ts` | T01 v1.2 冻结营养配置快照（只读副本） |
| `src/config/simulated-menu.ts` | 内置模拟菜单（非真实菜单） |
| `src/mock/simulated-inputs.ts` | T02 四类夹具（开发页使用，生成物） |
| `src/assets/wasm/mp_core.wasm` | 当前固定核心（72,881 字节，SHA256 `715CD770…F31D52C`） |

## 关键行为

- **唯一计算来源**：营养目标与推荐来自 WASM（`mp_nutrition_target` / `mp_plan`）；
  前端只做输入校验、单位换算、状态管理、展示，不实现 Mifflin/BMR/TDEE/宏量分配。
- **请求修订**：每次 `refreshPlan` 递增请求序号；调用期间任何本地写入或更新的请求都会使
  迟到响应被丢弃（`stale`），旧结果不覆盖新输入。
- **原子写入**：所有改动先克隆状态、修改、结构校验、单键写入，失败保留原数据；
  菜单替换、恢复、记餐失败都不会破坏当前可用数据。
- **跨日**：按设备本地业务日期分桶；跨日只新建空桶，不迁移昨天摄入、锁定或售罄。
- **锁定失效**：前端在调用核心前校验窗口/菜品锁定是否仍可供应、未售罄；
  失效锁定保留记录并要求用户显式解除/替换，不静默解锁。
- **未知不当零**：营养/价格未知分别显示“未知/不完整”，预算核算不完整时不显示“预算内”。

## 命令

```powershell
cd D:\项目\cpp\Projects\食堂就餐优化系统
# 既有桥单元测试（JS 模拟导出，不是 WASM 证据）
node tools\miniprogram\test-core-bridge.mjs
# T05 行为/集成/计时（Node 24 直接跑 TS；单进程 pattern，不用 node --test）
node --import ./tools/miniprogram/register-ts.mjs tools\miniprogram\run-t05-all.mjs
node --import ./tools/miniprogram/register-ts.mjs tools\miniprogram\verify-t05-integration.mjs
node --import ./tools/miniprogram/register-ts.mjs tools\miniprogram\measure-t05.mjs
node --import ./tools/miniprogram/register-ts.mjs tools\miniprogram\check-pages.mjs
node tools\miniprogram\typecheck-src.mjs
node tools\miniprogram\count-comments.mjs
```

微信开发者工具：导入本目录（`miniprogramRoot` 为 `src/`）后编译/预览。真机与杀进程、
断网恢复证据记录在交付反馈中，未执行项明确写“未运行”。

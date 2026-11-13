# core/wasm — A18 隔离候选导出说明

本副本新增单调时钟导入，配套宿主与边界见 A18-ABI.md；正式生产与共享契约未更改。

本目录是 WASM 侧的**说明入口**。实际导出符号定义在 `core/src/api.cpp`（`extern "C"` + `__attribute__((export_name(...)))`），
与原生 CLI 共用同一份核心与同一组 C ABI，因此这里没有额外的 `main`。

## 构建

```powershell
Set-Location 'D:\项目\cpp\Projects\食堂就餐优化系统'
# 本卡使用证据根 build-wasm.ps1 -PatchedRunner，独占 t04a18_time_candidate.wasm
```

- 工具链：zig 0.16.0（内置 clang 21.1.0），解包在 `<工作区>\.toolchain\py-zig`
- 目标：`wasm32-freestanding -nostdlib`，有 **env.mp_monotonic_ms** 单一时钟 import（不依赖 WASI / Emscripten 运行时）
- 产物：`<本卡证据>\candidate\build\wasm\mp_core.wasm`

## 导出面

| 导出 | 说明 |
|---|---|
| `memory` | 线性内存（宿主读写输入/输出缓冲） |
| `mp_api_version` | 返回 `1` |
| `mp_contract_version` | 返回静态只读 `"1.0"`，**不得释放** |
| `mp_alloc(u32)` | 从核心分配器取内存，0 表示真实分配失败 |
| `mp_free(ptr)` | 释放恰好一次；重复释放安全 |
| `mp_plan(ptr,len)` | 入参 UTF-8 JSON（PlanRequest），返回结果块指针 |
| `mp_nutrition_target(ptr,len)` | ComputeNutritionTarget |
| `mp_validate_menu(ptr,len)` | ValidateMenuCatalog |

结果块布局：`[u32 载荷长度][u32 保留=0][UTF-8 JSON 包络][NUL]`。

## 最小加载与调用

可运行的宿主实现见 `tools/core/host_wasm.mjs`（库 + CLI 两用）：

```powershell
node tools\core\host_wasm.mjs plan <request.json> --out <result.json>
```

完整的所有权协议、逐字节一致性对比与内存实验见
`Resources\报告\T02-DSH-最小核心链路-证据-v1\04-原生与WASM一致性与所有权.md`。

## 消费方注意

- 实例化只需空 import 对象：`new WebAssembly.Instance(module, {})`。
- `mp_alloc` 或任意入口调用后，线性内存可能增长导致旧的 `ArrayBuffer` 失效，**必须重新取** `exports.memory.buffer`。
- 返回 0 只代表真实分配失败；输入非法一律返回 `ok=false` 的完整包络（不抛、不 trap）。
- 单实例串行使用：调用结束即释放输入与输出块。

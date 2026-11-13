# A18 isolated clock-aware module

This candidate retains the existing eight exported C API functions, memory layout and JSON contract. It adds one required WASM function import:

| Module | Name | Type | Meaning |
|---|---|---|---|
| env | mp_monotonic_ms | () -> f64 | Nonnegative, finite, nondecreasing monotonic milliseconds |

`wallClockMs=null` never calls the import. A positive limit reads it after request/catalog/target/state validation and polls during candidate enumeration and solver work. Missing, invalid or backwards time produces INTERNAL_ERROR at `$.plannerConfig.limits.wallClockMs`. Host adapters must bind the import even when all calls use null; older empty-import loaders cannot instantiate this module.

Native uses `std::chrono::steady_clock`; Node binds `performance.now()`. Mini-program runtime accepts an explicit `monotonicClockMs` provider, or a present standard global `performance.now`. It does not guess units for `wx.getPerformance()` and does not use Date.now. Actual WeChat clock availability and the paired module remain a device-verification gate.

This is an isolated ABI proposal. Production identity and formal shared contract are unchanged. Deploy the matching core-bridge/runtime/Node adapter together only after P01 approval and identity freeze. Use the evidence root's build-wasm.ps1 with the exclusive `t04a18_time_candidate.wasm` stage; do not overwrite another task's stage or the production module.

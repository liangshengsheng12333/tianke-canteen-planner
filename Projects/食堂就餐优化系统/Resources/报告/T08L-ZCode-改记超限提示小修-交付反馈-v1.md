# T08L · ZCode GLM5.3 · 改记超限提示小修 · 交付反馈 v1

| 项 | 内容 |
|---|---|
| 主任务卡 | `Resources/任务卡/T08L-ZCode-改记超限提示小修卡-v1.md`（小修卡，对象=J01 缺陷 1：editLog 超限提示口径） |
| 请求模型 / 实际 | 请求 GLM5.3；实际客户端标识 `account:zai-start-plan/GLM-5.3-Flash`（ZCode 子代理）；**服务端实际路由/档位未知**，不作为证明 |
| 绝对 cwd | `D:\项目\cpp\Projects\食堂就餐优化系统` |
| 证据目录 | `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T08L-ZCode-改记提示-证据-v1\`（`candidate\` 独立副本、`patch\`、`tools\`、`logs\`） |
| 唯一反馈 | `Resources/报告/T08L-ZCode-改记超限提示小修-交付反馈-v1.md`（本文件） |
| 状态 | **完成**。editLog 两处超限拒绝文案已统一为 confirmMeal 同口径（指明上限），仅改 2 行提示字符串；26/26 断言通过；未触碰常量/解析/事务/其他路径。产物为独立副本+小补丁，待 P01 单人合入 |

---

## 1. 基线身份实算复核（开工时本代理自行实算，非转抄）

| 项 | 卡值/预期 | 实算 | 结果 |
|---|---|---|---|
| sourceTreeDigest | `sha256:2871b4cad6cf801eeb27291c9eb291b3227d0adcf4c6a3270d40e9e34b3441a1` | 在 T06d candidate 目录内运行其自带 `tools/miniprogram/candidate-manifest.mjs` | **一致** |
| 源码树 | 75 文件 / 1004620 B | manifest `sourceFileCount/sourceBytes` | **一致** |
| tools 树 | 45 文件 / 649145 B | manifest `toolFileCount/toolBytes` | **一致** |
| frozenWasmMatches | true | manifest 输出 | **true** |
| 基线 store.ts 身份（本卡改动对象，另行记录） | — | `sha256sum` + `wc -c`：**107141 B / `1c1433e5ad0556bd9cfe1102a1396cdf5dc0aed1b153bc1080c359e0d3a8bfe4`** | 在案 |
| 复制后副本内复算 manifest | 同 2871b4ca… | 副本内重跑 manifest | **一致**（改动前） |

## 2. 改动内容（最小范围）

**唯一改动文件**：`candidate/miniprogram/src/domain/store.ts`，仅 2 行提示字符串（editLog 内两条金额校验分支，原 1453/1457 行）：

```diff
       if (itemPatch.priceKnown === true && !isValidMoney(itemPatch.unitPriceCents)) {
-        return this.fail('已知价格必须是非负整数（分）');
+        return this.fail('已知价格无效：必须是非负整数（分），且不超过 ￥1,000,000.00');
       }
       // 与确认/补记同一金额边界：显式给的数字必须合法；null=明确置未知，不落成"已知 null"。
       if (itemPatch.unitPriceCents !== undefined && itemPatch.unitPriceCents !== null && !isValidMoney(itemPatch.unitPriceCents)) {
-        return this.fail('已知价格必须是非负整数（分）');
+        return this.fail('已知价格无效：必须是非负整数（分），且不超过 ￥1,000,000.00');
       }
```

- 口径来源：与 `confirmMeal`（store.ts:1003，J01 缺陷定位处）及 `self-pick.ts:562` 现有上限文案**逐字共用同一后缀** `必须是非负整数（分），且不超过 ￥1,000,000.00`；前缀沿用 editLog 原有"已知价格"用语改为"已知价格无效："。上限值 100000001 分即超 ￥1,000,000.00，提示现在如实说明超上限。
- **未改动**（红线逐项）：`MAX_MONEY_CENTS` 本身（types.ts:34）、`isValidMoney` 函数体、金额解析、commit 事务、`confirmMeal`、页面层；**未重构提示框架**（无新常量、无格式化函数，纯字符串）。
- `addManualLog`（store.ts:1088）的旧文案"已知价格必须是非负整数（分）"**有意未动**：卡面范围仅 editLog（"该处"），补记路径不在缺陷定位内，是否一并统一留 P01 裁定（改动后该旧文案在源内仅剩此 1 处）。

## 3. 产物与身份（均在 `T08L-ZCode-改记提示-证据-v1\`）

| 产物 | 路径（相对证据目录） | 字节数 | SHA256 |
|---|---|---|---|
| 小补丁（相对 2871 基线，a/b 路径） | `patch\T08L-editlog-message.patch` | 981 | `21870e4cb36449b764accfb80d23c2c14e26dae96b058bcff55b04a05d757030` |
| 改动后源文件 | `candidate\miniprogram\src\domain\store.ts` | 107221（=基线 107141+80） | `76137dfef8bdf52dc370a17f8f617a33fc3de3fb54e59e52e7467f1feaee2378` |
| 验证脚本 | `tools\verify-editlog-message.mjs` | — | `e8ccccb5770deb71b893e6a83d53a8cfe4cc304112a1a9dfb8ee35c3cccf89c5` |
| 验证原始输出 | `logs\verify-editlog-message.json` | — | `bb8b9f2619effad416114eec10e1e35637b8b0906c9f8e0c14d817ab70570c8c` |

改动后副本 manifest 实算：sourceTreeDigest `sha256:1152972c9f51c97f26ab44aefae3825c9e7db87b81518d43e91dd93371d91858`、75 文件/1004700 B（恰 +80）、tools 45/649145 不变、frozenWasmMatches=true（WASM 未触碰，运行时 `readWasmChecked` 复核 107936B/304FED66… 通过）。

## 4. 写入纪律核对

- 独立副本从 T06d candidate 整树复制到 `T08L-ZCode-改记提示-证据-v1\candidate\`，改动只在副本内；**T06d candidate 原目录零改动**（全程只读，开工/收尾 manifest 实算均一致）。
- `diff -rq` T06d candidate vs 本副本：**仅 `miniprogram/src/domain/store.ts` 1 个文件差异**，其余 74 源文件+45 tools 文件全同。
- 生产树、A17/A18 目录、T08J 系证据、MEMORY：均未读写改动。写入仅本证据目录 + 本反馈。

## 5. 验证结果（Node + mock wx 口径，沿项目现有测试方式；26/26 通过，无失败）

运行方式：`node --import ./candidate/tools/miniprogram/register-ts.mjs tools/verify-editlog-message.mjs`（副本内真实 mp_core.wasm 实例化 + mock wx 存储；未占微信开发者工具，保持轻量，与 A17 构建并行无干扰）。

| 组 | 断言 | 结果 |
|---|---|---|
| S1 确认路径回归 | confirmMeal 超限拒绝文案仍为原口径（"的实付金额无效：…且不超过 ￥1,000,000.00"）、拒绝零写入、被拒餐零记录、既有记录不受影响 | 4/4 通过 |
| S2 超限拒绝零写入 | editLog `100000001` 分（缺陷复现路径）与 `priceKnown:true` 分支均拒绝且文案=新统一文案；负数、非整数同样拒绝同文案；每次拒绝后存储原文、mock 写次数、revision、记录数、history、消费、价格**全部零变化** | 8/8 通过 |
| S3 边界内合法 | 上限边界值 `100000000` 分（恰 ￥1,000,000.00）改记成功（revision 2、旧记录 superseded 入 history 1、supersedesRecordId 正确、新价格写入）；常规 `2500` 分再改成功（revision 3、history 2） | 4/4 通过 |
| S4 0 元与未知语义 | `0` → 成功且 priceKnown=true/金额 0；`null` → 成功且 priceKnown=false/null 持久化（不落"已知 null"）；`priceKnown:false` → 置未知不变 | 3/3 通过 |
| S5 源级与口径闭环 | confirmMeal 文案未被改动；旧文案仅剩 addManualLog 1 处；新文案恰 2 处；`MAX_MONEY_CENTS = 100*1000*1000` 定义未动；`isValidMoney` 函数体未动；运行时常量=100000000；包内 WASM 身份仍为冻结值 | 7/7 通过 |

原始输出：`logs\verify-editlog-message.json`（26 项逐条 pass/fail 与明细）。

## 6. 未测项 / 边界（不伪报）

- **微信开发者工具 UI 与真机未测**：按卡用 Node+mock wx 口径即可，未占 GUI；页面状态栏实际渲染新文案未在模拟器目验（文案字符串已由源级+运行时双侧断言）。
- **页面解析层负数预检文案**（J01 观察 1，"实付价格式不正确（最多两位小数）"）不在本卡范围，未动。
- **addManualLog 旧文案**（store.ts:1088）按卡范围未动，是否统一留 P01 裁定。
- 未重跑完整流程/算法/其余 store 测试套件（按卡"只跑受影响的必要检查"）；本卡交付为副本+补丁，**生产合入由 P01 单人执行**，合入后生产树身份将变为 1152972c…（源码树摘要），属预期。

完成停写。

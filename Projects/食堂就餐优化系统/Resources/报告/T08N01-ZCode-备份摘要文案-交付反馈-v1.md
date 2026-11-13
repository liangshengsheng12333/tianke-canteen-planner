# T08N01｜备份摘要文案修复｜交付反馈 v1

- 日期：2026-10-25
- 执行：ZCode 子代理 N01（T08N 总卡派发）
- 绝对 cwd：`D:\项目\cpp\Projects\食堂就餐优化系统`
- 本路写入边界：`Resources/报告/T08N01-ZCode-备份摘要文案-交付反馈-v1.md` + `Resources/报告/T08N01-ZCode-备份摘要文案-证据-v1/`（含独立副本 candidate-copy/）。未改生产目录（core/ miniprogram/ tools/ 项目根）、旧证据、MEMORY、共享契约；未删除任何目录；未改 ACL。

## 1. 卡片与输入候选版本

| 项 | 版本/值 |
|---|---|
| 总卡 | `Resources/任务卡/T08N-ZCode-四子代理最终收尾总卡-v1.md`（已实读） |
| 小卡（唯一范围） | `Resources/任务卡/T08N01-ZCode-备份摘要文案修复小卡-v1.md`（已实读） |
| 项目规则 | 项目根 `AGENTS.md`（已实读） |
| P01 裁定 | `Resources/报告/T08M-P01-接收裁定与收尾顺序-20261025-v1.md`（已实读，DEFECT-M02-01 即本卡修复点） |
| 主PRD | `Resources/主PRD.md` v0.2（已实读） |
| 固定输入候选 | `Resources/报告/T06e-ZCode-最终核心汇合-证据-v2/candidate`，manifest 口径 `sha256:97c8085ce2817c339455a21be53ed01308c1d570ff3781511bddc39c39b13123`，75 源/1008941B、45 工具/649308B、frozenWasmMatches=true |
| 工作副本 | 证据目录内独立副本 `candidate-copy/`，开工时先复制后复算，确认无漂移才动手 |

## 2. 实际模型记录（如实）

- 请求模型：GLM 5.3（总卡/小卡派单请求）。
- 实际运行模型：GLM-5.3-Flash（平台：ZCode CLI 子代理）。服务端档位不可从本会话核实，**档位未知**。
- 实际平台/Harness：ZCode（agent 子代理）；无额度可核实信息。

## 3. 修复内容与最小 diff

仅一处、一个字符串，位于 `candidate-copy/miniprogram/src/domain/backup.ts::summarizeBackup`（原 :253），与同文件恢复对照表 :214-216 的「内置菜单」口径一致。恢复逻辑、菜单选择、持久化、其他页面均未改。

```diff
--- candidate-copy/miniprogram/src/domain/backup.ts（改前）
+++ candidate-copy/miniprogram/src/domain/backup.ts（改后）
@@ -250,7 +250,7 @@
   const summary = stateSummary(state, date);
   return (
     `业务日期 ${date}；档案 revision ${state.profileRevision}；` +
-    `菜单 ${state.catalog ? state.catalog.menuVersion : '模拟菜单'}；` +
+    `菜单 ${state.catalog ? state.catalog.menuVersion : '内置菜单'}；` +
     `当日日志 ${summary.logs} 条（有效 ${summary.activeLogs}）；锁定 ${summary.locks} 条；售罄 ${summary.soldOut} 条`
   );
 }
```

完整 diff 存于证据目录 `backup-ts-minimal.diff`。

## 4. backup.ts 改前后哈希与字节数

| 版本 | SHA256 | 字节数 | 行数 |
|---|---|---|---|
| 改前（=97c8085c 清单值） | `f134fc8cb1689985739be5fe2176264fe9b60f48410e3f620fb4abd948a74581` | 11414 | 256 |
| 改后（本路候选） | `b07c87ad9cabef3d366ed4a1a0de3efce0851f858afa7cad2bbe8df710ab7217` | 11414 | 256 |

字节数不变（模拟/内置同为 2 个汉字）；仅哈希变化。

## 5. 操作命令与实际结果

证据目录：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T08N01-ZCode-备份摘要文案-证据-v1\`

1. **复制独立副本**：`cp -r …/T06e-…/candidate candidate-copy` → 成功。
2. **复算 manifest（改前，无漂移确认）**：`node candidate-copy/tools/miniprogram/candidate-manifest.mjs` → `sourceTreeDigest=sha256:97c8085ce2817c…`，75/1008941B、45/649308B，`frozenWasmMatches=true`（存 `initial-manifest-output.txt`）。
3. **复现原缺陷**：定向验证脚本 `T08N01-verify.mjs`（只读，不写文件；状态用项目自身 `createInitialState` 构造，catalog 保持 null）。
   `node --import ./candidate-copy/tools/miniprogram/register-ts.mjs T08N01-verify.mjs`（Node v24.19.0）
   → `SUMMARY_EMPTY: …菜单 模拟菜单…`（缺陷复现，与恢复对照表「内置菜单」不一致），`SUMMARY_CUSTOM: …菜单 v20261025-real-menu…`，`COMPARE_MENU_ROW` before=「内置菜单」，`PARSE_OK: true`，摘要 `DIGEST_EMPTY=sha256:cc275eb2…`、`DIGEST_CUSTOM=sha256:bd49c3f8…`（存 `before-output.txt`）。
4. **应用最小修改**（Edit 工具，仅 :253 一个字符串）。
5. **改后同脚本重跑** → `SUMMARY_EMPTY: …菜单 内置菜单…`；其余输出与改前逐行一致，diff 仅 SUMMARY_EMPTY 一行（存 `after-output.txt`、`verify-output-diff.txt`）。
6. **改后 manifest**：`sourceTreeDigest=sha256:d5373bb58ff5d7fe3b26f86c03d6bdd37ae55a0cb4b12a49cb452fe1526980e4`，75/1008941B、45/649308B，`frozenWasmMatches=true`（存 `patched-manifest-output.txt`）。此即 N03 注释路径应继承的本路版本标识。
7. **类型检查**：`node candidate-copy/tools/miniprogram/typecheck-src.mjs`（25 秒上限内，实际 3.9s）→ wechat-devtools TS 4.1.2：0 errors/38 files；antigravity-ide TS 5.9.3：0 errors/38 files（存 `typecheck-output.txt`）。
8. **生产未变证明**：`sha256sum D:\项目\cpp\Projects\食堂就餐优化系统\miniprogram\src\domain\backup.ts` → `f134fc8cb1689985739be5fe2176264fe9b60f48410e3f620fb4abd948a74581`（=改前值，生产 backup.ts 未动）。
9. **范围核查**：`grep -rn "模拟菜单" miniprogram/src` 剩余命中均为 types.ts/simulated-menu.ts/menu.ts/self-pick.ts/pages/menu 的「模拟菜单」功能本身（开发/演示菜单警示口径），不在本卡范围，未改；backup.ts 内已无「模拟菜单」。

## 6. 定向验证逐项状态

| 项 | 状态 | 证据 |
|---|---|---|
| 空 catalog 摘要文案：模拟菜单→内置菜单 | 通过 | before/after-output.txt |
| 自定义菜单分支摘要不受影响（menuVersion 原样） | 通过 | before/after-output.txt 逐行一致 |
| 恢复对照表「菜单版本」行口径不变（内置菜单） | 通过 | COMPARE_MENU_ROW 改前后一致 |
| 预检只读：serialize→parse 往返 ok、消息不变 | 通过 | PARSE_OK: true |
| 恢复内容/摘要对照不受影响：backupDigest 改前后一致 | 通过 | DIGEST_EMPTY/DIGEST_CUSTOM 改前后逐字节相同 |
| summarizeBackup 等只读调用无状态写入 | 通过 | 验证脚本内无写入路径；对照表行与摘要不变佐证 |
| 类型检查（两套本机 TS） | 通过 | typecheck-output.txt |
| manifest 复算（改前 97c8085c / 改后 d5373bb5） | 通过 | initial/patched-manifest-output.txt |
| 生产目录未变 | 通过 | 生产 backup.ts 哈希=改前值 |

## 7. 未测项

- 微信开发者工具编译与真机运行未做（本卡为单一字符串文案修复，静态类型检查+Node 直跑已覆盖；真机验证属 T08 正式流程）。
- 菜单页「模拟菜单」警示文案（menu.ts/store）未改未测，属另一口径（模拟菜单功能本身），不在本卡。
- 完整恢复流程（含文件选择、影响确认 UI）未端到端重跑；backup.ts 其余函数未改动，既有 T06e/M01/M02 证据在恢复/摘要路径上的适用性不受本修改影响（唯一改动行不进入 digest/对照逻辑，已由第 6 节摘要不变证明）。

## 8. 缺陷与下一负责人

- 本卡无未解决缺陷。DEFECT-M02-01 已在本路副本修复并验证。
- 交接：N03 注释路径如需读 backup，须继承本路副本版本 `candidate-copy`（backup.ts sha256 `b07c87ad…`，源树 `sha256:d5373bb5…`）。主窗口汇合时按总卡顺序 N01→N02→N03 合入本 diff（唯一一行）。
- 下一负责人：T08N 主窗口（唯一汇合者），随后 P01 核定；本卡不推广生产。

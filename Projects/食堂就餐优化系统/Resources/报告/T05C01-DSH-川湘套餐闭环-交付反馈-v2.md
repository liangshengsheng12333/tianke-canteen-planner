# T05C01｜DSH｜川湘套餐选餐记录闭环｜v2 · 交付反馈

| 项 | 值 |
| --- | --- |
| 任务卡 | `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\任务卡\T05C01-DSH-川湘套餐选餐记录闭环小卡-v2.md`（v2，31 行） |
| 主 PRD | 项目主 PRD v0.2（按其第 11 节解释本卡范围） |
| 绝对 cwd | `D:\项目\cpp\Projects\食堂就餐优化系统`（工具实际运行在 `…\Resources\报告\T05C01-DSH-川湘套餐闭环-证据-v2\candidate`） |
| 执行身份 | DSH 子代理 `t05c01-chuanxiang`（Team Lead：`lead`），共享任务 `task-2` |
| 指定模型 | DeepSeek V4.1 Flash（卡面/Task 指定） |
| 实际客户端可见模型 | `deepseek-v4.1-flash-1017`（本会话运行标注，客户端可见）；服务端路由/档位：**未知**（不可核实，不把请求配置当证明） |
| 平台 | DeepSeek Harness（Windows 宿主，Node.js v24 运行 TypeScript 源码 + mock `wx` + 真实冻结 WASM；**非微信开发者工具、非真机**） |
| 完成状态 | **川湘闭环隔离候选完成，待 T06c v3 统一合入** |

## 1. 结论

已从共同基线 `sha256:29deba8f66e85207e7d0fdd87cdf18250b6d5acdfb2853ac42d34b3c86a78d8b` 建出隔离候选，把川湘小厨作为**第 6 窗口**接入菜单 / 自选 / 推荐 / 确认 / 历史记录闭环（仅午/晚）。既有五窗口按卡面采用 T03f（35 道营养补全、T03d 原 4 道估算保留）。卡面 6 项“已发现问题”均在接入副本内处理：两素/三素改用核心按组件合计算出的值、一荤一素与两荤一素移出可售、35 项照片参考不伪造 0 元可售、米饭 200g 文案改写、`menuVersion`/`catalogHash` 用现有规范化工具重算并经真实核心校验。

产出：新菜单 JSON、候选 manifest、相对共同基线累计补丁（**生产根 `git apply --check` 退出 0**）、实际可售 offer 清单、已处理问题、未测项与证据日志。**未写生产、未推广、不宣称通过验收。**

## 2. 输入身份（本卡实读）

| 输入 | 路径 | 字节 | SHA256 |
| --- | --- | --- | --- |
| 共同基线 | 生产 `miniprogram/src`（75 src + 38 tool） | 882,086 + 447,791 | `29deba8f66e85207e7d0fdd87cdf18250b6d5acdfb2853ac42d34b3c86a78d8b` |
| 生产内置菜单（补丁前像） | `miniprogram/src/config/west1-menu.ts` | 37,814 | `2550BDCFE2F075C65E6EAA73D3518FEBFB595D88D4E2B2E63DF48BE52F6FA26E` |
| 五窗口来源（卡面指定） | `Resources/真实菜单/西院西一食堂-20261022/T03f-v1/menu-catalog-candidate.json` | 47,653 | `D5039A74B560D45FB187D67B58B9E44298633494CC86DA11ED42A808DAAACA6C` |
| 川湘窗口候选 | `Resources/真实菜单/西院西一食堂-20261022/T03g-v1/川湘窗口候选.json` | 233,596 | `6C55038EC1FB787CE23976462556D772FC18577B333F5ACF408F3199685A1DED` |
| 冻结 WASM | `miniprogram/src/assets/wasm/mp_core.wasm` | 107,472 | `B53C7405A643E8409071ED76D3CB4CCBDF1A37E6E5C408CE1D4A373D4CC00744` |
| P01 数据裁定 | `Resources/报告/双平台-P01-交付核对与并行开发放行-20261024-v1.md` | — | 已读（§本轮独立检查 1/3/4） |

## 3. 产出（绝对路径）

| 交付物 | 绝对路径 | 身份 |
| --- | --- | --- |
| 隔离候选 | `…\Resources\报告\T05C01-DSH-川湘套餐闭环-证据-v2\candidate\` | digest `sha256:cb243508ce00ed373d435bdfa1d41185d1ee98adbb22cfdc61f1d38394e15d94`；75 src / 971,347 B；38 tool / 447,791 B；`frozenWasmMatches:true` |
| 新菜单 JSON（六窗口 catalog） | `…\证据-v2\产物\west1-menu-window6-v2.json` | 123,645 B / `0C283F5462F0AA3D248904C241C37614558427F773FDAA5126216BC5924F6D26`；`menuVersion=west1-canteen-batch1-nutrition4-chuanxiang6-20261024`；`catalogHash=sha256:7c0873617d1db86bcb54b2d972705dd13177a103f44c470b942c973fbde5101f`；6 窗口 / 91 菜（91 道营养全已知）/ 62 offer |
| 候选内置菜单（编译进候选） | `…\证据-v2\candidate\miniprogram\src\config\west1-menu.ts` | 127,075 B / `A0F153BEA03897D00CBAF73ACD12D92A2C683AF51763F6E498B8FAB80D2666FE` |
| 候选 manifest | `…\证据-v2\manifest\candidate\manifest.json` + `hashes.sha256` | 逐文件哈希 + 树 digest |
| 基线 manifest | `…\证据-v2\manifest\baseline\` | digest `29deba8f…` 复现证据 |
| 累计补丁 | `…\证据-v2\patch\T05C01-相对共同基线累计补丁.patch` | 143,501 B / `ABC8D235176E06B18D136823FAF999FEFCCB1A826A14D518450D161E25D94542`；1 文件 +2525/−515 |
| 补丁应用说明 | `…\证据-v2\patch\应用说明.md` | 含 autocrlf 注意事项、校验/应用/回滚/与其它合入路的关系 |
| 实际可售 offer 清单 | `…\证据-v2\产物\实际可售offer清单.md` | 62 条逐窗列价 + 隔离两款 + 照片参考 |
| 已处理问题 | `…\证据-v2\产物\已处理问题.md` | 8 节（三款参考组合、隔离、素菜假设、照片参考、米饭文案、≤2 舍入、T03f 口径、版本哈希） |
| 变更清单 | `…\证据-v2\产物\变更清单.md` | 唯一改动文件 + 逐项语义变化 + 未改动范围 |
| 证据索引 | `…\证据-v2\证据索引.md` | 身份表、自检表、冒烟 21 项、复现命令、写入边界 |
| 生产基线对照口径 | `…\证据-v2\产物\west1-menu-window6-v2-productionBaseline.json` + `生成记录-生产基线对照.json` | 112,175 B / `45C90ECD261AB587075DFC274239F4A03DB192AD89385A49F49E6F5D504B9C8B`；60 已知 / 31 待补全；`catalogHash=sha256:e653582f…4de0`；不编译进候选 |
| 生成记录（原始核心返回） | `…\证据-v2\产物\生成记录.json` | `mp_validate_menu` / `mp_offer_nutrition` 原始返回、27 条审计、组件合计审计、隔离证据、35 项照片参考 |
| 冒烟脚本与结果 | `…\证据-v2\smoke\smoke-chuanxiang6.mjs` + `smoke-result.json` | 21/21 通过 |
| 运行日志 | `…\证据-v2\logs\` | 17 个日志 + 1 个集成证据 JSON |

## 4. 逐项验收状态（对照卡面与 Task 验收标准）

| # | 要求 | 状态 | 证据 |
| --- | --- | --- | --- |
| 1 | 从共同基线建 candidate | 满足 | `logs/08-candidate-baseline-manifest.log`（digest `29deba8f…` 逐文件复现后建基线提交 `a67a31b`，`core.autocrlf=false` 保 LF） |
| 2 | 既有五窗口用 T03f（47,653 B / `D5039A74…`，原 4 道估算保留） | 满足 | `logs/02b-base-invariance.log`：canteen/contractVersion/5 窗口/35 菜/35 offer/comboRules 与 T03f 全等；仅 hash/version 按卡重算 |
| 3 | 川湘为第 6 窗口接入菜单 | 满足 | `产物/生成记录.json` 的 `mp_validate_menu`（6/91/62）；冒烟 2b/2c（预检→应用→菜单页 6 窗口） |
| 4 | 自选/推荐/确认/历史记录闭环 | 满足（Node 链路） | 冒烟 2d/2e/3a/3b/3c/4a/4b/4c：自选可见、核心推荐含套餐、整套价确认落账、`menuVersion` 快照绑定；既有 store 自选/记录回归全绿 |
| 5 | 仅午/晚 | 满足 | 冒烟 2d（早餐不含川湘）；`windows[5].mealWindows=["lunch","dinner"]` |
| 6 | 25 款 11/12/13 元整套价，米饭营养只计一次，组件名可读 | 满足 | 冒烟 1c/3b/3c（1100 分、营养=套餐值、不额外叠加 200g 米饭）；`实际可售offer清单.md` 列出组件可读文案 |
| 7 | 两素组合标估算假设、不宣称店员固定搭配 | 满足 | `nutritionBasis.portionAssumption`/`note`；`已处理问题.md` §3 |
| 8 | 可改实付 | 满足 | 冒烟 4b（预览/落账 650，菜单原价 700 不被覆盖） |
| 9 | 三款参考组合以核心组件合计值为准、不显示一套算一套 | 满足 | 两素 333 / 三素 415 与核心逐项一致（1c/4a/4b/4c）；一荤一素/两荤一素已隔离（`isolatedCombos`） |
| 10 | 9/14 元两款 offer 移出正式可推荐/购买，保留来源参考，不绑主菜 | 满足 | 冒烟 1d/5a（不在可售集合、伪造报价预览被拒）；`已处理问题.md` §2 |
| 11 | 35 项照片参考不伪造 0 元、不宣称去重/素菜资格 | 满足 | 冒烟 1d/4d；`photoReferences` 35 条 `inMenuCatalog:false` |
| 12 | 93 实体不全列 93 款商品 | 满足 | 可售 62 offer / 91 dish；照片 35 项无 offer |
| 13 | menuVersion/catalogHash 用现有规范化工具重算并核 `mp_validate_menu` | 满足 | 冒烟 1a/1b（`canonicalSha256` 重算 = 核心回显 = 核心复算） |
| 14 | 保留用户自定义菜单、旧记录快照、用户锁 | 满足 | 冒烟 5c（换自定义五窗口菜单→旧记录快照逐项不变、用户锁保留→换回六窗口锁仍有效） |
| 15 | 米饭 200g 文案按卡 | 满足 | `dish-cx-rice` 的 `portionAssumption`“本次估算按200g熟米饭（非本窗口实测份量）”；免费续饭不计 |
| 16 | 最低自检全部实跑并留日志 | 满足 | `logs/02,02b,02c,03,04,05,06*,07,08,09,10`；冒烟 21/21；类型检查双 TS 版本 0 error；页面静态检查通过 |
| 17 | 相对基线累计补丁，生产根 `git apply --check` 退出 0 | 满足 | `logs/10-patch-verify.log`：`git apply --check` 退出 0；`-c core.autocrlf=false` 应用后与候选字节一致（127,075 B / `A0F153BE…`）；生产文件仍 37,814 B/`2550BDCF…` |
| 18 | 实际可售 offer 清单、已处理问题、未测项 | 满足 | `产物/实际可售offer清单.md`、`产物/已处理问题.md`、本文 §6 |
| 19 | 不得声称任何验收结论 | 满足 | 本文与证据内无验收通过表述；状态仅为“隔离候选完成，待 T06c v3 统一合入” |
| 20 | 结束后停止写入 | 满足 | 完成本文件与 `task-2` 回执后不再写任何文件 |

### 4.1 合入交接要点（T06c v3 必读）

- 本候选/补丁的五窗口口径 = T03f（31 道营养补全、原 4 道保留），并追加川湘 56 菜 / 27 offer；`menuVersion`/`catalogHash` 已按卡重算（`logs/02b-base-invariance.log` 证明除这两项外与 T03f 逐字段相等）。
- 补丁前像仍是共同基线生产文件，所以生产根 `git apply --check` 退出 0；但补丁同时携带 T03f 内容，**不能与另一路 T03f 补丁盲叠**，需语义合入并重算版本/哈希后重跑 `mp_validate_menu` 与冒烟。
- 若只想先做“纯川湘增量”，用对照口径 `产物/west1-menu-window6-v2-productionBaseline.json`（60 已知 / 31 待补全，`catalogHash=e653582f…`）替代。

## 5. 实际操作与原始结果（摘要）

| 操作 | 命令（candidate 根） | 原始结果 | 日志 |
| --- | --- | --- | --- |
| 基线复现 | `node tools/miniprogram/candidate-manifest.mjs` | `29deba8f…`，75/882,086 + 38/447,791，frozenWasmMatches true | `logs/08-*` |
| 生成菜单（主口径） | `node --import ./tools/miniprogram/register-ts.mjs "..\tools\gen-west1-menu-chuanxiang6.mjs"` | valid=true，6/91/62，hash `7c087361…`，27 条川湘营养审计 0 不一致 | `logs/02-*` |
| 生产基线对照 | 同上 `--base=production` | 60 已知/31 待补全，hash `e653582f…` | `logs/02c-*` |
| 五窗口未动复核 | `node -e`（T03f vs 新目录逐字段比较） | canteen/contractVersion/5 窗/35 菜/35 offer/comboRules 全等 | `logs/02b-*` |
| 类型检查 | `node tools/miniprogram/typecheck-src.mjs` | 0 errors × 38 files（TS 4.1.2 与 5.9.3） | `logs/03-*` |
| 页面静态检查 | `node --import ./tools/miniprogram/register-ts.mjs tools/miniprogram/check-pages.mjs` | 10 页面通过 | `logs/04-*` |
| 冒烟 | `node --import ./tools/miniprogram/register-ts.mjs "..\smoke\smoke-chuanxiang6.mjs"` | 21/21 通过 | `logs/05-*` |
| 回归 store / self-pick | `… test-t05-store.mjs` / `… test-self-pick.mjs` | 28/0、13/0 | `logs/06-*` |
| 回归 today / month | `… test-today-display.mjs` / `… test-month-summary.mjs` | 46 项、35 项通过 | `logs/06-*` |
| 回归 记录页 | `… test-logs-page.mjs` | 2 项失败：旧文案断言（`￥10.00（含未填项）`/`未知（含未填项）`），**基线同项同因**（stash 回退菜单文件复跑一致） | `logs/06-*`、`logs/07-*` |
| 回归 T05 集成 | `… verify-t05-integration.mjs` | 17/17 通过 | `logs/06-*`、`logs/verify-t05-integration-evidence.json` |
| 候选 manifest | `node tools/miniprogram/candidate-manifest.mjs --out "..\manifest\candidate"` | `cb243508…`，frozenWasmMatches true | `logs/09-*` |
| 补丁校验 | `git apply --check <patch>`（生产根） | 退出 0；生产文件未变 | `logs/10-*` |

## 6. 未测项与限制（不填通过）

- 微信开发者工具编译、真机/真实扫码点餐：未测（仅 Node 宿主 + mock `wx` + 真实冻结 WASM）。
- 营养独立复核（P09/独立营养审计）与全量营养科学性：未测；五窗口 35 道（T03f）与川湘 56 道为估算（`estimated=true`），不是后厨实测。
- 完整 Bug/性能/兼容矩阵、真实历史数据迁移回归：按卡面后置，未测。
- 真实店员报价/份量/可选荤菜范围确认：未做（正因如此隔离两款荤素组合、素菜标“代表性假设”）。
- 本候选版本/哈希只对“T03f 五窗口 + 川湘”这份 catalog 有效；T06c 合并后必须重算（已备对照口径）。

## 7. 缺陷与风险（交接项）

1. **同一文件多补丁风险**：本补丁携带 T03f 内容；若另一路（如 T06c01 预整合候选）也改 `west1-menu.ts`，不能盲叠，需语义合入并重算版本/哈希后重跑 `mp_validate_menu` 与冒烟。
2. 本机 git 全局 `core.autocrlf=true`：应用补丁必须 `-c core.autocrlf=false`，否则 LF→CRLF 导致字节/哈希不一致（已写入 `patch/应用说明.md`）。
3. 既有 `test-logs-page.mjs` 2 项旧文案断言失败为基线遗留，不属本卡；未修改该测试。
4. 菜单页默认切换与算法设置按卡面留给 T06c 合并，本卡未改默认切换。

## 8. 下一负责人

- **T06c v3（统一合入执行员）**：语义合入其它路（含 T03f/预整合候选）与本卡川湘窗口；重算 `menuVersion`/`catalogHash`；重跑 `mp_validate_menu` 与 `smoke-chuanxiang6.mjs`；参考 `patch/应用说明.md` §6 与本文 §4.1。
- **P01**：核对本反馈与证据；决定是否让 P09 做营养独立复核与真机验证。
- **P09（若派）**：复核五窗口 35 道与川湘 56 道营养口径（估算/组件合计/米饭口径）与隔离边界，不修只验。

## 9. 写入边界声明

只写了：`Resources\报告\T05C01-DSH-川湘套餐闭环-证据-v2\**` 与 `Resources\报告\T05C01-DSH-川湘套餐闭环-交付反馈-v2.md`。另：既有工具 `verify-t05-integration.mjs` 自身会按其设计在 `Resources\报告\.toolchain\tmp\t05\` 写一份时间戳证据 JSON（工具行为，未改工具、未动他人文件；已复制到本目录 `logs\verify-t05-integration-evidence.json`）。
未写：生产 `miniprogram/src`（含 `west1-menu.ts`）、`tools`、C++ 核心、WASM、`Resources/真实菜单` 原始数据、T06c01 副本、任务卡、MEMORY、AGENTS、其它报告、PPT。生产根 `candidate-manifest` 复核仍为 `sha256:29deba8f…a78d8b`；未给其它队友发消息（仅回执 `lead`）。

## 10. 回执

【回执】结论：川湘小厨已作为第 6 窗口接入隔离候选的菜单/自选/推荐/确认/记录闭环（仅午晚），五窗口按卡采用 T03f，三款参考组合与两款荤素隔离、照片参考与米饭文案按卡处理，候选完成待 T06c v3 统一合入；证据：真实核心 `mp_validate_menu` 6/91/62 且哈希回显一致、`mp_offer_nutrition` 27 条川湘营养 0 不一致、冒烟 21/21、类型检查 0 error、既有回归 28/0+13/0+46+35+17/17（记录页 2 项为基线遗留）、生产根 `git apply --check` 退出 0、生产 digest 仍 `29deba8f…`；落盘：`…\证据-v2\`（产物/ manifest/ patch/ smoke/ logs/）与 `…\交付反馈-v2.md`。【结束】
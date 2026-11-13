# T06c v3 · 六窗口与功能统一开发候选 · 交付反馈

- **任务卡**：`Resources/任务卡/T06c-DSH-六窗口与功能统一合入小卡-v3.md`（T06c v3，取代 v2）
- **依据报告**：`Resources/报告/T06c01-DSH-算法界面营养预整合-交付反馈-v1.md`、`Resources/报告/T05C01-DSH-川湘套餐闭环-交付反馈-v2.md`、`Resources/报告/T06c-P01-两路接收与GLM建议取舍-20261024-v1.md`
- **执行/写入**：DSH 单写入者（本窗口）；两条只读分析路 `c01-catalog-analyst`、`t06c01-inventory` 只写各自 `_analysis/**`，均已回执销账
- **模型**：请求 DeepSeek V4.1 Flash（客户端可见 `deepseek-v4.1-flash-1017`）；服务端实际路由/档位**未知**
- **聊天 cwd**：`D:\项目\cpp`｜**项目根**：`D:\项目\cpp\Projects\食堂就餐优化系统`
- **证据目录**：`D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T06c-DSH-六窗口统一开发候选-证据-v3`
- **状态**：**统一开发候选完成，待集中测试**（不是最终验收通过；未做微信开发者工具/真机/全量 Bug/P09）

---

## 1. 交付物（绝对路径）

| 类别 | 路径 |
|---|---|
| 反馈（本文件） | `D:\项目\cpp\Projects\食堂就餐优化系统\Resources\报告\T06c-DSH-六窗口统一开发候选-交付反馈-v3.md` |
| 开发候选树 | `…\证据-v3\candidate\`（`miniprogram/src` 75 文件、`tools/miniprogram` 43 文件） |
| 候选 manifest | `…\证据-v3\manifest\manifest.json` |
| 生产 manifest（传播后） | `…\证据-v3\manifest-production\manifest.json` |
| 生产基线 manifest | `…\证据-v3\manifest-production-baseline\manifest.json` |
| 累积补丁 | `…\证据-v3\patch\T06c-v3-cumulative.patch`（389150 B）+ `T06c-v3-diff-list.json` / `T06c-v3-diffstat.txt` / `T06c-v3-apply-verify.txt` |
| 最终菜单目录 | `…\证据-v3\产物\west1-menu-window6-v3.json`（123646 B） |
| 生成记录 | `…\证据-v3\产物\生成记录-v3.json` |
| 窗口/可售/组件/估算清单 | `…\证据-v3\产物\菜单与可售清单-v3.md` |
| 合并记录 | `…\证据-v3\产物\合并记录-v3.md` |
| 统一冒烟结构化结果（生产侧） | `…\证据-v3\smoke\production\t06c-unified-smoke-result.json` |
| 回滚基线 | `…\证据-v3\backup-production\`（116 文件 / 1336087 B）+ 基线 manifest |
| 两路只读分析 | `…\证据-v3\_analysis\c01\`、`…\证据-v3\_analysis\t06c01\` |

**状态为「统一开发候选完成，待集中测试」**：生产路径已被本候选覆盖，但是否最终验收由 P01/P09 集中测试判定。

---

## 2. 合并记录（摘要，细节见 `产物\合并记录-v3.md`）

- 合并基点：T06c01 候选 `HEAD 6ff5d33`（含 A01b 累积 A01a、M02 三方语义合并、U07、T06c01 自身菜单替换）。**未重新叠加 A01a/A01b 补丁**，**未整文件覆盖另一路的 store/menu/detail/record 逻辑**。
- 按 C01 的“共同 29de 基线三方比较”做字段级判断：保留 T06c01 的代码/界面改动，只替换内置菜单数据源 `miniprogram/src/config/west1-menu.ts`。
- 五窗口部分按 id 与 T03f 逐字段一致（唯一差异：T03f 顶层 `metadata` 未带入 —— 修正 C01 报告“仅版本/哈希不同”的表述）；川湘部分与 C01 目录内容相等，仅身份字段不同，生成器内置断言通过（差异 0）。
- T03f 营养只消费一次：原 35 道沿用 T03f 估算值，川湘 56 道沿用 C01 估算值，无重复叠加、无 null。
- 身份按最终内容重算：`menuVersion=west1-canteen-batch1-nutrition35-chuanxiang6-20261024`、`catalogHash=sha256:23c0eda554226f9ecda0d4b973e57eabc697abe9e5ca34b7058fd45b30ff44ea`。
- 川湘接入口径逐条落地（P01 裁决）：25 款 11/12/13 元招牌套餐（10/10/5）+ 两素 7 元/三素 9 元参考组合；`offer-chuanxiang-set-1meat-1veg-rice`(9 元)、`offer-chuanxiang-set-2meat-1veg-rice`(14 元) 隔离不进可售；35 项照片参考只在 `WEST1_MENU_SOURCE.photoReferenceCount`，不伪造可售；仅午/晚；套餐营养一份整体值、米饭只出现一次。

### 2.1 两处基线既有失败：分别核实并处理

| 问题 | 核实结论 | 处理 |
|---|---|---|
| `test-logs-page.mjs` 2 项 | **旧文案断言过时**：T05U05 已把月汇总金额统一为“已知实付 ￥X（含未填项）/实付待补全”（`utils/money-display.ts`），T03 的旧断言未回改；生产基线同样 76 PASS/2 FAIL | 仅改测试期望（同义保真，仍能抓“未知写成 0 元”回归）→ 现 78/78 |
| `test-core-bridge.mjs` 缺 `mp_offer_nutrition` | **测试 mock 缺项**：真实冻结 WASM 9 个导出含 `mp_offer_nutrition`（107472 B / `B53C7405…`），mock 只 7 个；生产基线同样 12 pass/1 fail | mock 增补该导出、`REQUIRED_EXPORTS.length` 7→8、缺导出断言改为 `mp_free, mp_offer_nutrition, memory` → 现 13/13 |

两者均为**测试/工具侧缺陷，不是产品缺陷**，未改任何产品代码；改动属“补丁/工具/数据一起收口”范围。

---

## 3. 最终身份（菜单与 WASM）

| 项 | 值 |
|---|---|
| menuVersion | `west1-canteen-batch1-nutrition35-chuanxiang6-20261024` |
| catalogHash | `sha256:23c0eda554226f9ecda0d4b973e57eabc697abe9e5ca34b7058fd45b30ff44ea` |
| 目录 JSON | 123646 B / `54B77216777590A12BE036E92191DD3D446DDA344C97E9FBEB53ABEF0DA032E7` |
| 内置 TS 副本 | 127254 B / `69748A5D72AD215040B16E8AF4758CAC0E207E7FF2C6D6BD4A7770583E95C7AB` |
| 规模 | 6 窗口 / 91 菜（川湘 56）/ 62 可售报价（川湘 27）/ comboRules 0 |
| 冻结 WASM | 107472 B / `B53C7405A643E8409071ED76D3CB4CCBDF1A37E6E5C408CE1D4A373D4CC00744` |
| 候选 = 生产 manifest | `sha256:e45d74024c742b93a575236d7aea7becb9dce2c2d6ff34f64400699d20a54d78`（75 源 / 985282 B；43 工具 / 625071 B；WASM 匹配 true） |
| 传播前生产基线 | `sha256:29deba8f66e85207e7d0fdd87cdf18250b6d5acdfb2853ac42d34b3c86a78d8b`（75 / 882086；38 / 447791） |

窗口/可售条目/组件/估算覆盖逐项清单：`…\证据-v3\产物\菜单与可售清单-v3.md`（6 窗口逐条、川湘 27 条、27 款套餐组件、隔离两款、35 照片参考、91/91 估算）。

---

## 4. 实跑结果（生产路径，Node + 真实冻结 WASM）

传播后在生产根 `D:\项目\cpp\Projects\食堂就餐优化系统` 直接复跑，**17 个脚本 / 646 项检查 PASS / 0 FAIL**（逐脚本日志 `…\证据-v3\logs\50-production-*.log`，汇总 `50-production-suite.csv`）：

| 脚本 | 结果 |
|---|---|
| `test-t06c-unified.mjs` | **109 / 109**（0–7 节，见下） |
| `test-t05-menu-default.mjs` | 69 PASS / 0 FAIL |
| `test-t05-store.mjs` / `test-t05-modules.mjs` / `test-t05-soldout-scope.mjs` | 28 / 17 / 11，fail 0 |
| `test-t05a01a-dp-chain.mjs` / `test-t05a01b-bnb-chain.mjs` | 13 / 13、10 / 10 |
| `verify-t05-integration.mjs` | 17 / 17 |
| `test-core-bridge.mjs` / `test-self-pick.mjs` | 13 / 13、13 / 13 |
| `test-logs-page.mjs` / `test-month-summary.mjs` / `test-logs-meal-tabs.mjs` | 78 / 35 / 85 |
| `test-today-display.mjs` / `test-home-view.mjs` / `test-appearance.mjs` / `test-calendar.mjs` | 46 / 34 / 27 / 41 |
| `typecheck-src.mjs` | 0 error / 38 文件（TS 4.1.2 与 5.9.3 各一遍） |
| `check-pages.mjs` | 10 个页面静态检查全通过（WXML 闭合/事件绑定/mustache 根标识符/文件齐全） |

### 4.1 统一冒烟覆盖（`test-t06c-unified.mjs`）

- **0 身份**：新 menuVersion/catalogHash/来源常量；核心 `mp_validate_menu` valid=true、counts 6/91/62/0、回显 hash 与本地复算一致；WASM 107472/`B53C7405…`。
- **1 空存储首开**：默认真实菜单、不写业务数据；规模 6/91/62。
- **2 三算法真实请求**：greedy / dp / branchAndBound 各保存设置并各发一单真实冻结 WASM，三份请求 catalog 均为统一菜单身份；均返回 `OkPartial` + 3 个方案（greedy 153 节点、dp 191406 状态、BnB 173166 节点）。
- **3 估算口径**：91 道热量展示均为“约 X 千卡”且 `estimated=true`，不按 0、不宣称实测。
- **4 首页入口**：当前菜单 + 浅层切换入口可用（真实页面模块 + store）。
- **5 三餐标签**：记录页早/午/晚三标签可切换且不写数据。
- **6 保留语义**：旧内置升级、已吃/锁定、自定义菜单不被覆盖；菜单更新走预检→差异确认→原子替换，记录快照绑定 menuVersion。
- **7 川湘六窗口闭环**：27 条可售（25 招牌 10/10/5 + 两素 7/三素 9）；11 元套餐整套价 ￥11.00、营养 563 kcal/24.5 g 蛋白（已知+完整+估算）、组件文案含主菜/两素/米饭且米饭只一次；套餐营养=核心组件口径一次合计（招牌偏差 ≤2 单位，参考组合逐字段相等）；9/14 元隔离、35 照片参考不伪造；自选 27/27 可用；草稿预览按实付 ￥6.50（不按菜单价）、不写入；确认落账记录 `unitPriceCents=650`、`menuVersion` 快照绑定、营养=套餐值/`basis=estimated`、同草稿重复提交幂等；换菜可跨窗换入川湘套餐并重算、确认后进入实际消费；菜单页显示 6 窗口 + 统一版本 + 62 报价。

### 4.2 补丁与传播

- `git apply --check` 在生产副本通过；应用后与候选**逐文件哈希不一致 0**；应用到生产根 exit 0。
- 传播后生产 manifest 与候选**完全一致**（`e45d7402…`），基线 `29deba8f…` 与回滚副本均在位。
- 无同一生产路径的其他写入者：两路分析任务只读且 completed；传播前后生产 manifest 分别等于基线/候选。

---

## 5. 未测项与已知限制（如实标注）

1. **微信开发者工具编译、真机运行、真实 WASM 在微信宿主的导出**：未测（本机无开发者工具）；本报告所有通过项都是 Node 宿主 + 真实冻结 WASM，不等同微信验收。
2. **集中测试类**：全量 Bug、性能（冷/热启动、algorithms caps 下的响应）、P09 独立总审、现场演示，均未做。
3. **算法可达性观察（非本卡缺陷，供集中测试判断）**：默认 greedy/dp/BnB 生成的 3 个方案均未自然选中川湘套餐；`search.candidatesEnumerated` 显示午餐/晚餐候选枚举被 `maxMealCandidatesPerMeal=64` 截断（186→64）。川湘当前通过“自选”和“换菜”可达且可落账（已实测）；是否要让推荐自然覆盖川湘属算法调优，本卡未改核心/配置。
4. **旧性能脚本未跑**：`test-storage-snapshot.mjs` 是 T02 遗留脚本，硬编码旧 WASM（72881 B / `715CD770…`）并写死输出到 T02 证据路径，不适用于本候选；性能验收属 P09。
5. **菜单页文案**：界面仍写“西院西一食堂 · 首批菜单”“仅覆盖首批部分窗口”，六窗口统一后是否改称留给界面整合/文案卡，本卡未改产品文案。
6. **未做**：T03f 顶层 `metadata` 合并（T03f 有、C01/统一目录无）；数据侧不改 T03f/T03g 源文件。
7. **环境**：服务端模型路由、额度、档位不可核实 = 未知；会话内两条只读分析路模型同为请求 Flash、实际路由未知。

---

## 6. 缺陷与下一负责人

- 未发现启动/保存阻断（空存储首开、菜单更新、记录落账、快照恢复相关用例均通过）。
- 待集中测试关注：①推荐是否应自然覆盖川湘（候选截断上限）；②菜单页“首批菜单”文案；③算法在 91 菜规模下的耗时与 caps 行为。
- 下一负责人：P01 派集中测试（P09 独立复验时以本文件 §3 身份与 §4 实跑为基线；回滚用 `backup-production/`）。
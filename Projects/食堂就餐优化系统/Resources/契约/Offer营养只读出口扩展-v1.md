# Offer 营养只读出口扩展 v1

本文档定义共享核心（C++17 / Native CLI / WASM）新增的 Offer 级营养只读出口契约。本扩展作为对已冻结 T01 契约的只读补充，专门服务于自选菜餐盘营养快照查询，不改变原有求解器逻辑、不修改已冻结 T01 文件。

---

## 1. 能力说明与导出符号

### 1.1 新增能力定位
为自选菜界面与记录确认提供单份售卖 Offer 的最终权威营养快照。复用现有核心 `ParseCatalog`、`ValidateCatalogSemantics`、`catalogHash` 校验与 `OfferNutrition` 计算链：
- 严格由核心执行整份/半份（1/2）换算（`round_half_up`）、单品 `nutritionOverride` 优先回填、固定套餐组件累加（`comboComponentSum`）及规则套餐（`comboRules[]`）展开报价营养求和；
- 避免前端/页面层重复实现第二套份量缩放、舍入或求和算法；
- 本接口纯只读，不输出价格，不接收 `quantity`，不执行推荐算法，不调用求解器。

### 1.2 导出接口与协议
- **C ABI**：`mp_offer_nutrition(const char* input, uint32_t length)`
- **WASM 导出名称**：`mp_offer_nutrition`
- **Native CLI 子命令**：`mp_cli offer-nutrition <request.json> [--out <result.json>]`
- **内存协议**：复用现有 8 字节结果块头（`[u32 payload_len][u32 reserved=0][UTF-8 ResultEnvelope JSON][\0]`），通过 `mp_alloc` 申请输入缓冲、`mp_free` 释放输入及输出结果块。

---

## 2. 请求与响应契约规范

### 2.1 请求对象结构
```json
{
  "contractVersion": "1.0",
  "catalog": { /* MenuCatalog 完整结构 */ },
  "meal": "breakfast" | "lunch" | "dinner",
  "offerIds": [ "string" ]
}
```

#### 字段约束
1. `contractVersion`：字符串，必须为 `"1.0"`。
2. `catalog`：合法 `MenuCatalog` 对象，其内部 `catalogHash` 必须与规范化序列化摘要严格一致。
3. `meal`：餐次枚举字符串，仅允许 `"breakfast"`、`"lunch"`、`"dinner"`。
4. `offerIds`：字符串数组，**必须非空且元素唯一（不重复）**。
   - 元素可以为普通静态售卖 Offer ID（如 `"offer-rice-full"`）；
   - 也可以为规则套餐确定性展开后的原子 Offer ID（如 `"rule-combo-lunch#dish-chicken+dish-greens"`），展开 ID 允许包含 `#`、`+` 且不受普通 64 字符 ID 格式限制；
   - 每个 ID 必须对应指定 `meal` 下实际可售的报价；若任一 ID 不存在或不属于指定餐次，整次请求返回 `INVALID_INPUT` 错误，绝不返回部分成功。

### 2.2 响应对象结构（ResultEnvelope）
外层完全沿用标准的 `ResultEnvelope`：

```json
{
  "contractVersion": "1.0",
  "requestId": null,
  "ok": true,
  "error": null,
  "result": {
    "menuVersion": "string",
    "catalogHash": "string",
    "meal": "string",
    "offers": [
      {
        "offerId": "string",
        "dishId": "string",
        "windowId": "string",
        "portionCode": "full" | "half",
        "nutrition": {
          "energyKcal": 232,
          "proteinDg": 44,
          "fatDg": 6,
          "carbDg": 516
        },
        "nutritionComplete": true,
        "estimated": false
      }
    ]
  }
}
```

#### 结果字段语义
- `menuVersion` / `catalogHash`：回显所传入菜单快照的版本与摘要。
- `meal`：回显查询的餐次。
- `offers`：报价列表，**严格保持与请求中 `offerIds` 相同的数组顺序**。
- `offerId`：报价标识符。
- `dishId`：关联菜品标识符（规则套餐展开报价对应其 `ruleId`）。
- `windowId`：供餐窗口标识符。
- `portionCode`：`"full"`（整份）或 `"half"`（半份）。
- `nutrition`：四项核心营养素对象。
  - 单位：`energyKcal` 为整数 kcal；`proteinDg`、`fatDg`、`carbDg` 为整数 dg（0.1g）。
  - 数值允许为 `null`；严格区分已知数值零（保留 `0`）与缺失未知（输出 `null`）。
- `nutritionComplete`：布尔值，仅当四项营养素均非 `null` 时为 `true`，否则为 `false`。
- `estimated`：布尔值，沿用菜品主数据及组件汇总的估算元数据传播。

---

## 3. 实测调用示例（基于合成测试目录）

以下示例均来自于实际测试输入与原生 CLI / WASM 的真实运行输出（测试输入基线文件位于 `Resources\报告\T04A04-反重力-Offer营养只读出口-证据-v1\inputs\`）。

### 3.1 成功示例 1：整份与半份米饭换算（份量缩放）
**请求概要**（`01-portion-scaling.json`）：
查询 `offer-rice-full` 与 `offer-rice-half`。

**实际输出**（`outputs/native/01-portion-scaling.response.json`）：
```json
{
  "contractVersion": "1.0",
  "requestId": null,
  "ok": true,
  "error": null,
  "result": {
    "menuVersion": "menu-t04a04-v1",
    "catalogHash": "sha256:8d8f55965a390d26d0f648118e94d33c78207f0897c80eb4bf1e4c318b27d8e2",
    "meal": "lunch",
    "offers": [
      {
        "offerId": "offer-rice-full",
        "dishId": "dish-rice",
        "windowId": "w-main",
        "portionCode": "full",
        "nutrition": {
          "energyKcal": 232,
          "proteinDg": 44,
          "fatDg": 6,
          "carbDg": 516
        },
        "nutritionComplete": true,
        "estimated": false
      },
      {
        "offerId": "offer-rice-half",
        "dishId": "dish-rice",
        "windowId": "w-main",
        "portionCode": "half",
        "nutrition": {
          "energyKcal": 116,
          "proteinDg": 22,
          "fatDg": 3,
          "carbDg": 258
        },
        "nutritionComplete": true,
        "estimated": false
      }
    ]
  }
}
```

### 3.2 成功示例 2：固定套餐与规则套餐展开 ID（组件求和与特殊字符）
**请求概要**（`03-combos-fixed-and-rule.json`）：
查询主厨固定双拼 `offer-fixed-combo` 与展开规则套餐 `rule-combo-lunch#dish-chicken+dish-greens`。

**实际输出**（`outputs/native/03-combos-fixed-and-rule.response.json`）：
```json
{
  "contractVersion": "1.0",
  "requestId": null,
  "ok": true,
  "error": null,
  "result": {
    "menuVersion": "menu-t04a04-v1",
    "catalogHash": "sha256:8d8f55965a390d26d0f648118e94d33c78207f0897c80eb4bf1e4c318b27d8e2",
    "meal": "lunch",
    "offers": [
      {
        "offerId": "offer-fixed-combo",
        "dishId": "dish-fixed-combo",
        "windowId": "w-main",
        "portionCode": "full",
        "nutrition": {
          "energyKcal": 245,
          "proteinDg": 330,
          "fatDg": 86,
          "carbDg": 60
        },
        "nutritionComplete": true,
        "estimated": true
      },
      {
        "offerId": "rule-combo-lunch#dish-chicken+dish-greens",
        "dishId": "rule-combo-lunch",
        "windowId": "w-main",
        "portionCode": "full",
        "nutrition": {
          "energyKcal": 245,
          "proteinDg": 330,
          "fatDg": 86,
          "carbDg": 60
        },
        "nutritionComplete": true,
        "estimated": true
      }
    ]
  }
}
```

### 3.3 成功示例 3：已知数值零与部分未知（零值保留与 null 传播）
**请求概要**（`04-zero-and-partial-null.json`）：
查询包含已知零能量/脂肪与未知蛋白质/碳水的菜品报价 `offer-partial-null`。

**实际输出**（`outputs/native/04-zero-and-partial-null.response.json`）：
```json
{
  "contractVersion": "1.0",
  "requestId": null,
  "ok": true,
  "error": null,
  "result": {
    "menuVersion": "menu-t04a04-v1",
    "catalogHash": "sha256:8d8f55965a390d26d0f648118e94d33c78207f0897c80eb4bf1e4c318b27d8e2",
    "meal": "lunch",
    "offers": [
      {
        "offerId": "offer-partial-null",
        "dishId": "dish-partial-null",
        "windowId": "w-main",
        "portionCode": "full",
        "nutrition": {
          "energyKcal": 0,
          "proteinDg": null,
          "fatDg": 0,
          "carbDg": null
        },
        "nutritionComplete": false,
        "estimated": true
      }
    ]
  }
}
```

### 3.4 错误示例 1：包含不存在的 Offer ID
**请求概要**（`05c-error-invalid-offer-id.json`）：
`offerIds` 中包含一个合法 ID 和一个不存在的 ID `["offer-chicken", "offer-ghost-not-found"]`。

**实际输出**（`outputs/native/05c-error-invalid-offer-id.response.json`）：
```json
{
  "contractVersion": "1.0",
  "requestId": null,
  "ok": false,
  "error": {
    "code": "INVALID_INPUT",
    "fieldPath": "$.offerIds",
    "message": "offerId 不存在或不属于指定餐次",
    "details": []
  },
  "result": null
}
```

### 3.5 错误示例 2：餐次不匹配（餐次供应范围越界）
**请求概要**（`05d-error-meal-mismatch.json`）：
`meal: "lunch"`，但所请求的 `offer-mantou` 仅在早餐供应（`mealWindows: ["breakfast"]`）。

**实际输出**（`outputs/native/05d-error-meal-mismatch.response.json`）：
```json
{
  "contractVersion": "1.0",
  "requestId": null,
  "ok": false,
  "error": {
    "code": "INVALID_INPUT",
    "fieldPath": "$.offerIds",
    "message": "offerId 不存在或不属于指定餐次",
    "details": []
  },
  "result": null
}
```

### 3.6 错误示例 3：重复 offerIds
**请求概要**（`05b-error-duplicate-offer-ids.json`）：
`offerIds: ["offer-chicken", "offer-chicken"]`。

**实际输出**（`outputs/native/05b-error-duplicate-offer-ids.response.json`）：
```json
{
  "contractVersion": "1.0",
  "requestId": null,
  "ok": false,
  "error": {
    "code": "INVALID_INPUT",
    "fieldPath": "$.offerIds",
    "message": "offerIds 存在重复项",
    "details": []
  },
  "result": null
}
```

---

## 4. 交付与边界保证
1. **零求解器污染**：本接口完全独立于 DP、Branch & Bound 和 Greedy 推荐算法，不调用求解器、不触碰目标与预算状态。
2. **零核心回退**：`planner.cpp` 源码未做任何改动（SHA256 严格保持 `417E753207D49700DFE8FE0AD7B010BA178E953E72ED4743FE33149E76582AC0`）。
3. **同源一致性**：Native CLI（MSVC C++17）与 WASM（Zig/LLVM wasm32-freestanding）在上述所有测试案例上 100% 逐字节输出一致。
4. **现有入口零破坏**：原有 `ValidateMenuCatalog`、`ComputeNutritionTarget`、`PlanDay` 三个入口及其内存分配/释放生命周期完全不受影响。

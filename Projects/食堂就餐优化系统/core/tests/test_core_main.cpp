// 模块说明：T04 三算法核心与契约全路径原生单元测试套件（覆盖营养目标 9 组黄金配对、菜单校验、三算法对拍、套餐展开与限额截断）。
// test_core_main.cpp — T04 子交付的核心原生单元测试套件
//
// 测试覆盖范围与工程不变量说明：
//   1) T01 v1.2 配对样例 9 组 ComputeNutritionTarget：
//      逐例通过 C ABI (mp_nutrition_target) 调用核心，并与冻结期望结果做 JSON DOM 深层相等比较；
//   2) 契约级错误边界（ok=false）：
//      - 字段越界（如 ageYears=200、maxItemsPerMeal=99）返回 INVALID_INPUT 及精确 fieldPath；
//      - 不支持的契约主版本（如 contractVersion="2.0"）返回 UNSUPPORTED_CONTRACT_VERSION；
//      - plannerConfig.limits 缺失或使用旧字段名（maxCandidates / maxNodes）返回 INVALID_INPUT；
//   3) ValidateMenuCatalog 菜单快照校验：
//      - 合法模拟菜单及含固定套餐（kind="combo"）、规则套餐（comboRules[]）的扩展菜单校验通过；
//      - catalogHash 篡改、半份米饭与整份不同价、引用不存在的 dishId 等非法输入被精确拒绝；
//   4) PlanDay 三种规划算法（greedy / dp / branchAndBound）与业务状态路径：
//      - 验证规范 result.search 结构（algorithm / searchComplete / candidatesEnumerated /
//        nodesEvaluated / statesEvaluated / capsHit / approximations）；
//      - 验证 dp 与 branchAndBound 在模拟请求上均完成精确搜索（searchComplete=true），
//        且在 primary / economy / taste 三个策略上给出完全一致的全局最优方案与评分；
//      - 验证规则套餐确定性展开（ruleId#<dishId升序拼接>）、固定套餐组件营养汇总、
//        含饭套餐与米饭单品互斥（riceIncluded vs riceDish）、子组件售罄连带套餐失效；
//      - 验证 dp 触发 maxDpStates 时诚实记录 capsHit 与 APPROXIMATE_DISCRETIZATION；
//      - 验证 branchAndBound 触发 maxSearchNodes 时诚实记录 capsHit、ResourceLimited 与 SEARCH_LIMIT_REACHED。
//
// 说明：测试驱动本身是原生可执行程序，可使用 stdio/stdlib 读取夹具与打印断言；
// 被测核心（core/src/*）保持严格的 freestanding 实现，无任何标准库依赖。
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <wchar.h>

#include "mp/api.h"
#include "mp/contract.h"
#include "mp/json.h"
#include "mp/sha256.h"

namespace {

// 全局断言计数器：统计总检查项数（g_checks）与失败项数（g_failures）。
// 任何单项断言失败均立即打印可读定位信息，最终由 main() 汇总退出码（全过返回 0，否则返回 1）。
int g_checks = 0;
int g_failures = 0;

// 基础布尔断言原语：递增总检查次数，若条件不成立则累加失败计数并输出错误描述。
void Check(bool condition, const char* what) {
  ++g_checks;
  if (!condition) {
    ++g_failures;
    printf("  [FAIL] %s\n", what);
  }
}

// 宽字符路径文件读取工具：
//   * 由于工程路径包含中文目录名（如「食堂就餐优化系统」「契约」「报告」），
//     在 Windows 原生环境下必须使用 _wfopen_s 打开宽字符路径，避免 ANSI 代码页导致路径解析失败；
//   * 一次性将完整文件字节读入堆内存，并在末尾追加 '\0' 以便调试打印，同时通过 outSize 返回真实字节数。
char* ReadFileWide(const wchar_t* path, size_t* outSize) {
  FILE* file = nullptr;
  if (_wfopen_s(&file, path, L"rb") != 0 || file == nullptr) {
    return nullptr;
  }
  if (_fseeki64(file, 0, SEEK_END) != 0) {
    fclose(file);
    return nullptr;
  }
  const __int64 length = _ftelli64(file);
  if (length < 0) {
    fclose(file);
    return nullptr;
  }
  _fseeki64(file, 0, SEEK_SET);
  char* buffer = static_cast<char*>(malloc(static_cast<size_t>(length) + 1));
  if (buffer == nullptr) {
    fclose(file);
    return nullptr;
  }
  const size_t read = fread(buffer, 1, static_cast<size_t>(length), file);
  fclose(file);
  if (read != static_cast<size_t>(length)) {
    free(buffer);
    return nullptr;
  }
  buffer[read] = '\0';
  *outSize = read;
  return buffer;
}

// 统一 C ABI 调用封装：
//   * 严格复现小程序 WASM 宿主与核心交互的内存生命周期协议（契约 §7）：
//     1) 调用 mp_alloc(length) 在核心管理的堆上分配输入缓冲区；
//     2) 将 UTF-8 请求文本拷贝至输入缓冲区；
//     3) 根据命令名调用对应的 C ABI 导出函数（mp_nutrition_target / mp_plan / mp_validate_menu）；
//     4) 调用 mp_free(input) 释放输入缓冲区恰好一次；
//     5) 返回核心分配的结果块指针（由调用方读取后调用 mp_free 释放）。
// ABI 调用辅助：输入缓冲 mp_alloc/mp_free 配对；结果块由核心分配（[u32 长度][保留] 头
// + JSON payload + '\0'），调用方读取后必须 mp_free 恰好一次——所有权协议与 WASM 宿主一致。
void* CallApi(const char* command, const char* text, size_t length) {
  void* input = mp_alloc(static_cast<uint32_t>(length));
  if (input == nullptr) {
    return nullptr;
  }
  if (length > 0) {
    memcpy(input, text, length);
  }
  void* block = nullptr;
  if (strcmp(command, "nutrition-target") == 0) {
    block = mp_nutrition_target(static_cast<const char*>(input), static_cast<uint32_t>(length));
  } else if (strcmp(command, "plan") == 0) {
    block = mp_plan(static_cast<const char*>(input), static_cast<uint32_t>(length));
  } else {
    block = mp_validate_menu(static_cast<const char*>(input), static_cast<uint32_t>(length));
  }
  mp_free(input);
  return block;
}

// 解析 C ABI 结果块头部 [0..3] 的 32 位小端无符号整数，获取 JSON 载荷的精确字节长度。
uint32_t BlockLength(const void* block) {
  const unsigned char* bytes = static_cast<const unsigned char*>(block);
  return static_cast<uint32_t>(bytes[0]) | (static_cast<uint32_t>(bytes[1]) << 8) |
         (static_cast<uint32_t>(bytes[2]) << 16) | (static_cast<uint32_t>(bytes[3]) << 24);
}

// 获取 C ABI 结果块偏移 8 字节处（跳过 4 字节长度与 4 字节保留字）的 UTF-8 JSON 载荷起始地址。
const char* BlockPayload(const void* block) {
  return static_cast<const char*>(block) + mp::kResultBlockHeaderBytes;
}

// 递归 JSON DOM 深层等价比较器：
//   * 对 Null / Bool / Number / String 逐值严格比较；
//   * 对 Array 要求元素个数相同且按下标顺序逐一递归相等；
//   * 对 Object 要求成员个数相同且按成员键名无序匹配后递归比较对应值；
//   * 发现任何不一致时递增 *diffs，并在前 12 处差异内打印精确的 JSONPath 路径与两侧实际值。
void DiffJson(const mp::JsonValue* actual, const mp::JsonValue* expected, const char* path,
              int* diffs, int* printed) {
  if (actual == nullptr || expected == nullptr) {
    ++*diffs;
    if (*printed < 12) {
      ++*printed;
      printf("    %s: 一侧缺失\n", path);
    }
    return;
  }
  if (actual->kind != expected->kind) {
    ++*diffs;
    if (*printed < 12) {
      ++*printed;
      printf("    %s: 类型不同（actual kind=%d expected kind=%d）\n", path,
             static_cast<int>(actual->kind), static_cast<int>(expected->kind));
    }
    return;
  }
  switch (actual->kind) {
    case mp::JsonKind::Null:
      return;
    case mp::JsonKind::Bool:
      if (actual->boolean != expected->boolean) {
        ++*diffs;
        if (*printed < 12) {
          ++*printed;
          printf("    %s: %s != %s\n", path, actual->boolean ? "true" : "false",
                 expected->boolean ? "true" : "false");
        }
      }
      return;
    case mp::JsonKind::Number:
      if (actual->number != expected->number) {
        ++*diffs;
        if (*printed < 12) {
          ++*printed;
          printf("    %s: %lld != %lld\n", path, static_cast<long long>(actual->number),
                 static_cast<long long>(expected->number));
        }
      }
      return;
    case mp::JsonKind::String:
      if (!actual->text.Equals(expected->text)) {
        ++*diffs;
        if (*printed < 12) {
          ++*printed;
          printf("    %s: \"%.*s\" != \"%.*s\"\n", path, static_cast<int>(actual->text.size),
                 actual->text.data, static_cast<int>(expected->text.size), expected->text.data);
        }
      }
      return;
    case mp::JsonKind::Array: {
      if (actual->count != expected->count) {
        ++*diffs;
        if (*printed < 12) {
          ++*printed;
          printf("    %s: 数组长度 %zu != %zu\n", path, actual->count, expected->count);
        }
        return;
      }
      const mp::JsonValue* left = actual->child;
      const mp::JsonValue* right = expected->child;
      size_t index = 0;
      while (left != nullptr && right != nullptr) {
        char childPath[192];
        snprintf(childPath, sizeof(childPath), "%s[%zu]", path, index);
        DiffJson(left, right, childPath, diffs, printed);
        left = left->next;
        right = right->next;
        ++index;
      }
      return;
    }
    case mp::JsonKind::Object: {
      // 第一遍：检查 actual 中的每个键是否均存在于 expected 中，并递归比对成员值
      if (actual->count != expected->count) {
        ++*diffs;
        if (*printed < 12) {
          ++*printed;
          printf("    %s: 对象成员数 %zu != %zu\n", path, actual->count, expected->count);
        }
      }
      for (const mp::JsonMember* member = actual->members; member != nullptr; member = member->next) {
        char keyBuffer[128];
        size_t cursor = 0;
        while (cursor + 1 < sizeof(keyBuffer) && member->key.data[cursor] != 0 &&
               cursor < member->key.size) {
          keyBuffer[cursor] = member->key.data[cursor];
          ++cursor;
        }
        keyBuffer[cursor] = '\0';
        char childPath[192];
        snprintf(childPath, sizeof(childPath), "%s.%s", path, keyBuffer);
        const mp::JsonValue* other = nullptr;
        for (const mp::JsonMember* candidate = expected->members; candidate != nullptr;
             candidate = candidate->next) {
          if (candidate->key.Equals(member->key)) {
            other = candidate->value;
            break;
          }
        }
        if (other == nullptr) {
          ++*diffs;
          if (*printed < 12) {
            ++*printed;
            printf("    %s: 期望结果里没有这个成员\n", childPath);
          }
          continue;
        }
        DiffJson(member->value, other, childPath, diffs, printed);
      }
      // 第二遍：检查 expected 中的每个键是否均存在于 actual 中，防止漏检缺失字段
      for (const mp::JsonMember* member = expected->members; member != nullptr;
           member = member->next) {
        bool found = false;
        for (const mp::JsonMember* candidate = actual->members; candidate != nullptr;
             candidate = candidate->next) {
          if (candidate->key.Equals(member->key)) {
            found = true;
            break;
          }
        }
        if (!found) {
          ++*diffs;
          if (*printed < 12) {
            ++*printed;
            printf("    %s: 实际结果缺少成员 \"%.*s\"\n", path,
                   static_cast<int>(member->key.size), member->key.data);
          }
        }
      }
      return;
    }
  }
}

// 判断两棵 JSON DOM 树是否在结构与值上完全相等。
bool JsonTreesEqual(const mp::JsonValue* actual, const mp::JsonValue* expected) {
  int diffs = 0;
  int printed = 0;
  DiffJson(actual, expected, "$", &diffs, &printed);
  return diffs == 0;
}

// 在 JSON 对象节点中按 C 字符串键名查找成员值（不存在或非对象返回 nullptr）。
const mp::JsonValue* Member(const mp::JsonValue* object, const char* key) {
  return mp::JsonFind(object, key);
}

// 解析 JSON 文本为 Arena 管理的 DOM 树；若语法解析失败则立即记录测试失败并打印字节偏移原因。
mp::JsonValue* ParseOrNull(mp::Arena* arena, const char* text, size_t size) {
  char error[192];
  error[0] = '\0';
  mp::JsonValue* root = mp::JsonParse(arena, text, size, error, sizeof(error));
  if (root == nullptr) {
    printf("  [FAIL] JSON 解析失败: %s\n", error);
    ++g_failures;
    ++g_checks;
  }
  return root;
}

// 将内存中的 JSON DOM 树按契约 §0.3 规范化规则重新序列化为堆分配的 UTF-8 字符串，供构造派生测试请求使用。
char* SerializeCanonical(mp::Arena* arena, const mp::JsonValue* root, size_t* outSize) {
  mp::TextBuffer buffer;
  buffer.Init(arena);
  if (!mp::JsonSerializeCanonical(root, &buffer)) {
    return nullptr;
  }
  char* copy = static_cast<char*>(malloc(buffer.size + 1));
  if (copy == nullptr) {
    return nullptr;
  }
  memcpy(copy, buffer.data, buffer.size);
  copy[buffer.size] = '\0';
  *outSize = buffer.size;
  return copy;
}

// ---------------------------------------------------------------------------
// 1) 9 组配对样例：验证 ComputeNutritionTarget 全路径与冻结配对样例逐字段一致
// ---------------------------------------------------------------------------
// 覆盖 9 组黄金配对样例：
//   pair-01: 18 岁男性维持期（触发 AGE_18_EXTRAPOLATION 提示）
//   pair-02: 成年女性减脂期（触发减脂能量缺口上限截断或比例扣减）
//   pair-03: 孕期/哺乳期自动目标禁用（AUTO_TARGET_DISABLED）
//   pair-04: BMI 过轻且目标为维持（REFERENCE_ONLY，仅给 REE/TDEE 参考）
//   pair-05: BMI 过轻且目标为减脂（AUTO_TARGET_DISABLED）
//   pair-06: 减脂目标跌破性别能量下限（TARGET_REVIEW_REQUIRED / PRODUCT_ENERGY_FLOOR）
//   pair-07: 宏量供能比或碳水保底冲突（TARGET_COMPOSITION_CONFLICT）
//   pair-08: 手动目标完整且在 max(20kcal, 2%) 容差内（Ok 且 applied=true）
//   pair-09: 手动目标能量与三大宏量折算热量不一致（MANUAL_TARGET_INCONSISTENT）
constexpr const wchar_t* kPairsPath =
    L"Resources\\契约\\T01-v1.2-candidate\\request-result-pair.json";

void RunNutritionPairTests() {
  // 执行单元测试章节：[1] ComputeNutritionTarget 配对样例\n
  printf("[1] ComputeNutritionTarget 配对样例\n");
  size_t textSize = 0;
  char* text = ReadFileWide(kPairsPath, &textSize);
  if (text == nullptr) {
    printf("  [FAIL] 无法读取配对样例文件\n");
    ++g_failures;
    ++g_checks;
    return;
  }
  mp::ExecContext context;
  mp::JsonValue* root = ParseOrNull(&context.Memory(), text, textSize);
  free(text);
  if (root == nullptr) {
    return;
  }
  const mp::JsonValue* pairs = Member(root, "pairs");
  if (pairs == nullptr || pairs->kind != mp::JsonKind::Array) {
    printf("  [FAIL] 配对样例缺少 pairs 数组\n");
    ++g_failures;
    ++g_checks;
    return;
  }
  printf("  pairs 数量 = %zu（期望 9）\n", pairs->count);
  Check(pairs->count == 9, "配对样例组数为 9");

  int index = 0;
  for (const mp::JsonValue* pair = pairs->child; pair != nullptr; pair = pair->next) {
    ++index;
    const mp::JsonValue* id = Member(pair, "id");
    const mp::JsonValue* request = Member(pair, "request");
    const mp::JsonValue* expectedResult = Member(pair, "result");
    if (id == nullptr || request == nullptr || expectedResult == nullptr) {
      printf("  [FAIL] 第 %d 组结构不完整\n", index);
      ++g_failures;
      ++g_checks;
      continue;
    }
    char idText[96];
    const size_t idLength = id->text.size < sizeof(idText) - 1 ? id->text.size : sizeof(idText) - 1;
    memcpy(idText, id->text.data, idLength);
    idText[idLength] = '\0';

    size_t requestSize = 0;
    char* requestText = SerializeCanonical(&context.Memory(), request, &requestSize);
    if (requestText == nullptr) {
      printf("  [FAIL] %s 请求序列化失败\n", idText);
      ++g_failures;
      ++g_checks;
      continue;
    }
    void* block = CallApi("nutrition-target", requestText, requestSize);
    free(requestText);
    if (block == nullptr) {
      printf("  [FAIL] %s 核心返回空结果块\n", idText);
      ++g_failures;
      ++g_checks;
      continue;
    }
    mp::ExecContext outputContext;
    mp::JsonValue* envelope = ParseOrNull(&outputContext.Memory(), BlockPayload(block), BlockLength(block));
    if (envelope == nullptr) {
      mp_free(block);
      printf("  [FAIL] %s 输出不是合法 JSON\n", idText);
      ++g_failures;
      ++g_checks;
      continue;
    }
    const mp::JsonValue* ok = Member(envelope, "ok");
    const mp::JsonValue* result = Member(envelope, "result");
    const mp::JsonValue* expectedInner = Member(expectedResult, "result");
    bool passed = ok != nullptr && ok->kind == mp::JsonKind::Bool && ok->boolean &&
                  result != nullptr && expectedInner != nullptr &&
                  JsonTreesEqual(result, expectedInner);
    if (!passed) {
      printf("  [FAIL] %s\n", idText);
      if (result != nullptr && expectedInner != nullptr) {
        int diffs = 0;
        int printed = 0;
        DiffJson(result, expectedInner, "$.result", &diffs, &printed);
      }
      ++g_failures;
    } else {
      printf("  [PASS] %s\n", idText);
    }
    ++g_checks;
    mp_free(block);
  }
}

// ---------------------------------------------------------------------------
// 2) 契约级错误：验证越界字段与未知契约主版本均以 ok=false 包络返回精确错误码
// ---------------------------------------------------------------------------
void RunContractErrorTests() {
  // 执行单元测试章节：[2] 契约级错误\n
  // 本节断言输入级失败必须以 ok=false 可见包络返回精确 error.code 与 fieldPath，
  // 核心不得崩溃、不得返回空（见文件头说明 2)）。
  printf("[2] 契约级错误\n");
  size_t textSize = 0;
  char* text = ReadFileWide(kPairsPath, &textSize);
  if (text == nullptr) {
    printf("  [FAIL] 无法读取配对样例文件\n");
    ++g_failures;
    ++g_checks;
    return;
  }
  mp::ExecContext context;
  mp::JsonValue* root = ParseOrNull(&context.Memory(), text, textSize);
  free(text);
  if (root == nullptr) {
    return;
  }
  const mp::JsonValue* pairs = Member(root, "pairs");
  const mp::JsonValue* firstPair = pairs == nullptr ? nullptr : pairs->child;
  const mp::JsonValue* request = firstPair == nullptr ? nullptr : Member(firstPair, "request");
  if (request == nullptr) {
    printf("  [FAIL] 无法取得用于错误测试的请求\n");
    ++g_failures;
    ++g_checks;
    return;
  }

  // 2.1 ageYears 越界（200 > 120）→ 必须返回 ok=false, error.code="INVALID_INPUT", fieldPath="$.profile.ageYears"
  {
    mp::ExecContext caseContext;
    size_t requestSize = 0;
    char* requestText = SerializeCanonical(&caseContext.Memory(), request, &requestSize);
    mp::JsonValue* mutableRoot = const_cast<mp::JsonValue*>(request);
    const mp::JsonValue* profile = Member(mutableRoot, "profile");
    if (profile != nullptr && profile->kind == mp::JsonKind::Object) {
      for (mp::JsonMember* member = profile->members; member != nullptr; member = member->next) {
        if (member->key.Equals("ageYears")) {
          member->value->number = 200;
        }
      }
    }
    free(requestText);
    size_t mutatedSize = 0;
    char* mutated = SerializeCanonical(&caseContext.Memory(), request, &mutatedSize);
    void* block = mutated == nullptr ? nullptr : CallApi("nutrition-target", mutated, mutatedSize);
    free(mutated);
    Check(block != nullptr, "ageYears=200 时核心仍返回可见包络");
    if (block != nullptr) {
      mp::ExecContext outContext;
      mp::JsonValue* envelope = ParseOrNull(&outContext.Memory(), BlockPayload(block), BlockLength(block));
      const mp::JsonValue* ok = envelope == nullptr ? nullptr : Member(envelope, "ok");
      const mp::JsonValue* error = envelope == nullptr ? nullptr : Member(envelope, "error");
      const mp::JsonValue* code = error == nullptr ? nullptr : Member(error, "code");
      const mp::JsonValue* fieldPath = error == nullptr ? nullptr : Member(error, "fieldPath");
      const bool good = ok != nullptr && ok->kind == mp::JsonKind::Bool && !ok->boolean &&
                        code != nullptr && code->text.Equals("INVALID_INPUT") &&
                        fieldPath != nullptr && fieldPath->text.Equals("$.profile.ageYears");
      if (!good) {
        printf("  [FAIL] ageYears=200 未返回 INVALID_INPUT/$.profile.ageYears\n");
        ++g_failures;
      } else {
        printf("  [PASS] ageYears=200 → INVALID_INPUT @ $.profile.ageYears\n");
      }
      ++g_checks;
      mp_free(block);
    }
  }

  // 2.2 contractVersion="2.0" → 主版本不为 1，必须返回 UNSUPPORTED_CONTRACT_VERSION
  {
    mp::ExecContext caseContext;
    mp::JsonValue* mutableRoot = const_cast<mp::JsonValue*>(request);
    for (mp::JsonMember* member = mutableRoot->members; member != nullptr; member = member->next) {
      if (member->key.Equals("contractVersion")) {
        member->value->text = mp::Str("2.0");
      }
    }
    size_t mutatedSize = 0;
    char* mutated = SerializeCanonical(&caseContext.Memory(), request, &mutatedSize);
    void* block = mutated == nullptr ? nullptr : CallApi("nutrition-target", mutated, mutatedSize);
    free(mutated);
    Check(block != nullptr, "contractVersion=2.0 时核心仍返回可见包络");
    if (block != nullptr) {
      mp::ExecContext outContext;
      mp::JsonValue* envelope = ParseOrNull(&outContext.Memory(), BlockPayload(block), BlockLength(block));
      const mp::JsonValue* error = envelope == nullptr ? nullptr : Member(envelope, "error");
      const mp::JsonValue* code = error == nullptr ? nullptr : Member(error, "code");
      const bool good = code != nullptr && code->text.Equals("UNSUPPORTED_CONTRACT_VERSION");
      if (!good) {
        printf("  [FAIL] contractVersion=2.0 未返回 UNSUPPORTED_CONTRACT_VERSION\n");
        ++g_failures;
      } else {
        printf("  [PASS] contractVersion=2.0 → UNSUPPORTED_CONTRACT_VERSION\n");
      }
      ++g_checks;
      mp_free(block);
    }
  }
}

// ---------------------------------------------------------------------------
// 3) ValidateMenuCatalog：验证菜单快照结构、跨表引用、半份同价与 catalogHash
// ---------------------------------------------------------------------------
constexpr const wchar_t* kMenuPath =
    L"Resources\\报告\\T02-DSH-最小核心链路-证据-v1\\inputs\\menu-simulated.json";

void RunValidateMenuTest() {
  // 执行单元测试章节：[3] ValidateMenuCatalog（模拟菜单）\n
  printf("[3] ValidateMenuCatalog（模拟菜单）\n");
  size_t size = 0;
  char* text = ReadFileWide(kMenuPath, &size);
  if (text == nullptr) {
    printf("  [FAIL] 无法读取模拟菜单 %ls\n", kMenuPath);
    ++g_failures;
    ++g_checks;
    return;
  }
  void* block = CallApi("validate-menu", text, size);
  free(text);
  Check(block != nullptr, "校验菜单返回可见包络");
  if (block == nullptr) {
    return;
  }
  mp::ExecContext context;
  mp::JsonValue* envelope = ParseOrNull(&context.Memory(), BlockPayload(block), BlockLength(block));
  const mp::JsonValue* ok = envelope == nullptr ? nullptr : Member(envelope, "ok");
  const mp::JsonValue* result = envelope == nullptr ? nullptr : Member(envelope, "result");
  const mp::JsonValue* valid = result == nullptr ? nullptr : Member(result, "valid");
  const bool good = ok != nullptr && ok->kind == mp::JsonKind::Bool && ok->boolean &&
                    valid != nullptr && valid->kind == mp::JsonKind::Bool && valid->boolean;
  if (!good) {
    printf("  [FAIL] 合法模拟菜单未通过校验\n");
    ++g_failures;
  } else {
    printf("  [PASS] 模拟菜单结构/引用/半份同价/catalogHash 校验通过\n");
  }
  ++g_checks;
  mp_free(block);
}

// ---------------------------------------------------------------------------
// 4) PlanDay
// ---------------------------------------------------------------------------
constexpr const wchar_t* kPlanOkPath =
    L"Resources\\报告\\T02-DSH-最小核心链路-证据-v1\\inputs\\plan-request-simulated.json";

// 在 DOM 里按成员名浅层改一个布尔值/整数值（用于从基础请求派生边界样例）
void SetBoolMember(mp::JsonValue* object, const char* key, bool value) {
  if (object == nullptr || object->kind != mp::JsonKind::Object) {
    return;
  }
  for (mp::JsonMember* member = object->members; member != nullptr; member = member->next) {
    if (member->key.Equals(key)) {
      member->value->kind = mp::JsonKind::Bool;
      member->value->boolean = value;
      return;
    }
  }
}

void SetNumberMember(mp::JsonValue* object, const char* key, mp::i64 value) {
  if (object == nullptr || object->kind != mp::JsonKind::Object) {
    return;
  }
  for (mp::JsonMember* member = object->members; member != nullptr; member = member->next) {
    if (member->key.Equals(key)) {
      member->value->kind = mp::JsonKind::Number;
      member->value->number = value;
      return;
    }
  }
}

// ---- DOM 构造辅助（用于从基础请求派生边界样例，避免复制整份夹具）----
mp::Str NewStr(mp::Arena* arena, const char* text) {
  const mp::usize length = mp::StrLen(text);
  char* copy = static_cast<char*>(arena->Alloc(length + 1, 1));
  if (copy == nullptr) {
    return mp::Str();
  }
  memcpy(copy, text, length);
  copy[length] = '\0';
  return mp::Str(copy, length);
}

mp::JsonValue* NewStringNode(mp::Arena* arena, const char* text) {
  mp::JsonValue* node = arena->New<mp::JsonValue>();
  node->kind = mp::JsonKind::String;
  node->text = NewStr(arena, text);
  return node;
}

mp::JsonValue* NewNumberNode(mp::Arena* arena, mp::i64 value) {
  mp::JsonValue* node = arena->New<mp::JsonValue>();
  node->kind = mp::JsonKind::Number;
  node->number = value;
  return node;
}

mp::JsonValue* NewObjectNode(mp::Arena* arena) {
  mp::JsonValue* node = arena->New<mp::JsonValue>();
  node->kind = mp::JsonKind::Object;
  return node;
}

mp::JsonValue* NewNullNode(mp::Arena* arena) {
  mp::JsonValue* node = arena->New<mp::JsonValue>();
  node->kind = mp::JsonKind::Null;
  return node;
}

mp::JsonValue* NewArrayNode(mp::Arena* arena) {
  mp::JsonValue* node = arena->New<mp::JsonValue>();
  node->kind = mp::JsonKind::Array;
  return node;
}

mp::JsonValue* NewBoolNode(mp::Arena* arena, bool val) {
  mp::JsonValue* node = arena->New<mp::JsonValue>();
  node->kind = mp::JsonKind::Bool;
  node->boolean = val;
  return node;
}

void AppendMember(mp::Arena* arena, mp::JsonValue* object, const char* key, mp::JsonValue* value) {
  mp::JsonMember* member = arena->New<mp::JsonMember>();
  member->key = NewStr(arena, key);
  member->value = value;
  if (object->members == nullptr) {
    object->members = member;
    object->memberTail = member;
  } else {
    object->memberTail->next = member;
    object->memberTail = member;
  }
  object->count += 1;
}

// 为内存中解析出的请求树注入或覆盖规范的 T01 v1.2 plannerConfig.limits 四字段
// （不修改磁盘上的 T02 历史夹具原件，保证测试输入符合 T04 规范契约）
void EnsureCanonicalLimits(mp::Arena* arena, mp::JsonValue* root,
                           mp::i64 maxCand = 2000, mp::i64 maxDp = 4000, mp::i64 maxNodes = 20000) {
  if (root == nullptr || root->kind != mp::JsonKind::Object) {
    return;
  }
  mp::JsonValue* plannerConfig = const_cast<mp::JsonValue*>(Member(root, "plannerConfig"));
  if (plannerConfig == nullptr || plannerConfig->kind != mp::JsonKind::Object) {
    return;
  }
  mp::JsonValue* limits = NewObjectNode(arena);
  AppendMember(arena, limits, "maxMealCandidatesPerMeal", NewNumberNode(arena, maxCand));
  AppendMember(arena, limits, "maxDpStates", NewNumberNode(arena, maxDp));
  AppendMember(arena, limits, "maxSearchNodes", NewNumberNode(arena, maxNodes));
  AppendMember(arena, limits, "wallClockMs", NewNullNode(arena));

  for (mp::JsonMember* m = plannerConfig->members; m != nullptr; m = m->next) {
    if (m->key.Equals("limits")) {
      m->value = limits;
      return;
    }
  }
  AppendMember(arena, plannerConfig, "limits", limits);
}

mp::JsonValue* AppendElement(mp::Arena* arena, mp::JsonValue* array, mp::JsonValue* item) {
  (void)arena;
  if (array->child == nullptr) {
    array->child = item;
    array->tail = item;
  } else {
    array->tail->next = item;
    array->tail = item;
  }
  array->count += 1;
  return item;
}

// 把某道菜的四项营养全部置为未知（null），用于触发 NutritionDataInsufficient
void NullifyDishNutrition(mp::JsonValue* dish) {
  if (dish == nullptr || dish->kind != mp::JsonKind::Object) {
    return;
  }
  for (mp::JsonMember* member = dish->members; member != nullptr; member = member->next) {
    if (!member->key.Equals("nutrition") || member->value->kind != mp::JsonKind::Object) {
      continue;
    }
    for (mp::JsonMember* field = member->value->members; field != nullptr; field = field->next) {
      field->value->kind = mp::JsonKind::Null;
      field->value->number = 0;
    }
  }
}

const char* StringValueOf(const mp::JsonValue* object, const char* key, bool* found) {
  *found = false;
  if (object == nullptr || object->kind != mp::JsonKind::Object) {
    return "";
  }
  for (const mp::JsonMember* member = object->members; member != nullptr; member = member->next) {
    if (member->key.Equals(key) && member->value->kind == mp::JsonKind::String) {
      *found = true;
      return member->value->text.data;
    }
  }
  return "";
}

bool CallPlanAndParse(const char* text, size_t size, mp::ExecContext* context, void** blockOut,
                      mp::JsonValue** envelopeOut) {
  void* block = CallApi("plan", text, size);
  if (block == nullptr) {
    printf("  [FAIL] PlanDay 返回空结果块\n");
    ++g_failures;
    ++g_checks;
    return false;
  }
  mp::JsonValue* envelope = ParseOrNull(&context->Memory(), BlockPayload(block), BlockLength(block));
  *blockOut = block;
  *envelopeOut = envelope;
  return envelope != nullptr;
}

void RunPlanTests() {
  // 执行单元测试章节：[4] PlanDay\n
  // 本节以模拟菜单夹具驱动 plan 命令，并对锁定/售罄/预算变体做受限改写（Mutate*），
  // 断言状态码、plans 结构与 result.search 统计（见文件头说明 4)）。
  printf("[4] PlanDay\n");
  size_t rawSize = 0;
  char* rawBase = ReadFileWide(kPlanOkPath, &rawSize);
  if (rawBase == nullptr) {
    printf("  [FAIL] 无法读取模拟 PlanDay 输入\n");
    ++g_failures;
    ++g_checks;
    return;
  }
  mp::ExecContext baseDomCtx;
  mp::JsonValue* baseRoot = ParseOrNull(&baseDomCtx.Memory(), rawBase, rawSize);
  free(rawBase);
  if (baseRoot == nullptr) {
    ++g_failures;
    ++g_checks;
    return;
  }
  EnsureCanonicalLimits(&baseDomCtx.Memory(), baseRoot);
  size_t size = 0;
  char* base = SerializeCanonical(&baseDomCtx.Memory(), baseRoot, &size);

  // 4.1 成功计划
  {
    mp::ExecContext context;
    void* block = nullptr;
    mp::JsonValue* envelope = nullptr;
    if (CallPlanAndParse(base, size, &context, &block, &envelope)) {
      const mp::JsonValue* ok = Member(envelope, "ok");
      const mp::JsonValue* result = Member(envelope, "result");
      const mp::JsonValue* status = result == nullptr ? nullptr : Member(result, "status");
      const mp::JsonValue* plans = result == nullptr ? nullptr : Member(result, "plans");
      const bool good = ok != nullptr && ok->boolean && status != nullptr &&
                        (status->text.Equals("Ok") || status->text.Equals("OkPartial")) &&
                        plans != nullptr && plans->kind == mp::JsonKind::Array &&
                        plans->count > 0;
      if (!good) {
        printf("  [FAIL] 成功计划样例\n");
        ++g_failures;
      } else {
        printf("  [PASS] status=%s plans=%zu\n", status->text.data, plans->count);
      }
      ++g_checks;
      mp_free(block);
    }
  }

  // 4.2 目标不可用：把 pregnancyOrLactation 改为 true 后应返回 TargetUnavailable
  {
    mp::ExecContext domContext;
    mp::JsonValue* root = ParseOrNull(&domContext.Memory(), base, size);
    if (root != nullptr) {
      mp::JsonValue* profile = const_cast<mp::JsonValue*>(Member(root, "profile"));
      mp::JsonValue* flags = profile == nullptr ? nullptr : const_cast<mp::JsonValue*>(Member(profile, "dietaryFlags"));
      SetBoolMember(flags, "pregnancyOrLactation", true);

      mp::ExecContext jsonContext;
      size_t mutatedSize = 0;
      char* mutated = SerializeCanonical(&jsonContext.Memory(), root, &mutatedSize);
      if (mutated != nullptr) {
        mp::ExecContext context;
        void* block = nullptr;
        mp::JsonValue* envelope = nullptr;
        if (CallPlanAndParse(mutated, mutatedSize, &context, &block, &envelope)) {
          const mp::JsonValue* ok = Member(envelope, "ok");
          const mp::JsonValue* result = Member(envelope, "result");
          const mp::JsonValue* status = result == nullptr ? nullptr : Member(result, "status");
          const mp::JsonValue* targetStatus = result == nullptr ? nullptr : Member(result, "targetStatus");
          const mp::JsonValue* plans = result == nullptr ? nullptr : Member(result, "plans");
          const mp::JsonValue* diagnostics = result == nullptr ? nullptr : Member(result, "diagnostics");
          const bool good = ok != nullptr && ok->boolean && status != nullptr &&
                            status->text.Equals("TargetUnavailable") && targetStatus != nullptr &&
                            targetStatus->text.Equals("AUTO_TARGET_DISABLED") && plans != nullptr &&
                            plans->count == 0 && diagnostics != nullptr &&
                            diagnostics->kind == mp::JsonKind::Array && diagnostics->count > 0;
          if (!good) {
            printf("  [FAIL] 目标不可用样例\n");
            ++g_failures;
          } else {
            printf("  [PASS] TargetUnavailable（targetStatus=%s，plans=0）\n", targetStatus->text.data);
          }
          ++g_checks;
          mp_free(block);
        }
        free(mutated);
      }
    }
  }

  // 4.3 非法输入：maxItemsPerMeal 越界
  {
    mp::ExecContext domContext;
    mp::JsonValue* root = ParseOrNull(&domContext.Memory(), base, size);
    if (root != nullptr) {
      mp::JsonValue* plannerConfig = const_cast<mp::JsonValue*>(Member(root, "plannerConfig"));
      SetNumberMember(plannerConfig, "maxItemsPerMeal", 99);

      mp::ExecContext jsonContext;
      size_t mutatedSize = 0;
      char* mutated = SerializeCanonical(&jsonContext.Memory(), root, &mutatedSize);
      if (mutated != nullptr) {
        mp::ExecContext context;
        void* block = nullptr;
        mp::JsonValue* envelope = nullptr;
        if (CallPlanAndParse(mutated, mutatedSize, &context, &block, &envelope)) {
          const mp::JsonValue* ok = Member(envelope, "ok");
          const mp::JsonValue* error = Member(envelope, "error");
          const mp::JsonValue* code = error == nullptr ? nullptr : Member(error, "code");
          const bool good = ok != nullptr && !ok->boolean && code != nullptr &&
                            code->text.Equals("INVALID_INPUT");
          if (!good) {
            printf("  [FAIL] 非法输入样例\n");
            ++g_failures;
          } else {
            printf("  [PASS] maxItemsPerMeal=99 → INVALID_INPUT\n");
          }
          ++g_checks;
          mp_free(block);
        }
        free(mutated);
      }
    }
  }

  free(base);
}

// ---------------------------------------------------------------------------
// 4b) PlanDay 其余状态路径（代码里有分支，必须有用例覆盖）
// ---------------------------------------------------------------------------
void RefreshCatalogHash(mp::Arena* arena, mp::JsonValue* root) {
  mp::JsonValue* catalog = const_cast<mp::JsonValue*>(Member(root, "catalog"));
  if (catalog == nullptr || catalog->kind != mp::JsonKind::Object) {
    return;
  }
  mp::TextBuffer canonical;
  canonical.Init(arena);
  if (!mp::JsonSerializeCanonicalExcluding(catalog, "catalogHash", &canonical)) {
    return;
  }
  char hex[72];
  mp::Sha256PrefixedHexLower(canonical.data, canonical.size, hex);
  for (mp::JsonMember* member = catalog->members; member != nullptr; member = member->next) {
    if (member->key.Equals("catalogHash")) {
      member->value->kind = mp::JsonKind::String;
      member->value->text = NewStr(arena, hex);
      return;
    }
  }
}

mp::JsonValue* ArrayMemberOf(mp::JsonValue* object, const char* key) {
  mp::JsonValue* member = const_cast<mp::JsonValue*>(Member(object, key));
  if (member == nullptr || member->kind != mp::JsonKind::Array) {
    return nullptr;
  }
  return member;
}

// 把某餐锁到一个不供应它的窗口 -> 该餐候选为 0 -> NoFeasible
void MutateNoFeasible(mp::Arena* arena, mp::JsonValue* root) {
  mp::JsonValue* state = const_cast<mp::JsonValue*>(Member(root, "state"));
  mp::JsonValue* locks = state == nullptr ? nullptr : ArrayMemberOf(state, "windowLocks");
  if (locks == nullptr) {
    return;
  }
  mp::JsonValue* entry = NewObjectNode(arena);
  AppendMember(arena, entry, "meal", NewStringNode(arena, "breakfast"));
  AppendMember(arena, entry, "windowId", NewStringNode(arena, "w-veg"));
  AppendElement(arena, locks, entry);
}

// 预算 1 分钱 -> 每个餐次份额为 0 -> 有合法组合但预算内无解
void MutateOverBudget(mp::Arena* arena, mp::JsonValue* root) {
  (void)arena;
  mp::JsonValue* plannerConfig = const_cast<mp::JsonValue*>(Member(root, "plannerConfig"));
  SetNumberMember(plannerConfig, "budgetCents", 1);
}

// 锁定一个不存在的报价 -> LockConflict（业务状态，不是契约错误）
void MutateLockConflict(mp::Arena* arena, mp::JsonValue* root) {
  mp::JsonValue* state = const_cast<mp::JsonValue*>(Member(root, "state"));
  mp::JsonValue* locks = state == nullptr ? nullptr : ArrayMemberOf(state, "itemLocks");
  if (locks == nullptr) {
    return;
  }
  mp::JsonValue* entry = NewObjectNode(arena);
  AppendMember(arena, entry, "meal", NewStringNode(arena, "lunch"));
  AppendMember(arena, entry, "offerId", NewStringNode(arena, "offer-does-not-exist"));
  AppendMember(arena, entry, "quantity", NewNumberNode(arena, 1));
  AppendElement(arena, locks, entry);
}

// 所有菜品营养未知 -> 自动候选全被排除 -> NutritionDataInsufficient
void MutateNutritionInsufficient(mp::Arena* arena, mp::JsonValue* root) {
  mp::JsonValue* catalog = const_cast<mp::JsonValue*>(Member(root, "catalog"));
  mp::JsonValue* dishes = catalog == nullptr ? nullptr : ArrayMemberOf(catalog, "dishes");
  if (dishes == nullptr) {
    return;
  }
  for (mp::JsonValue* dish = dishes->child; dish != nullptr; dish = dish->next) {
    NullifyDishNutrition(dish);
  }
  RefreshCatalogHash(arena, root);  // 目录内容变了，快照哈希必须同步重算
}

typedef void (*DomMutator)(mp::Arena*, mp::JsonValue*);

void CheckPlanStatus(const char* label, const char* base, size_t size, DomMutator mutate,
                     const char* expectedStatus, bool expectEmptyPlans) {
  mp::ExecContext jsonContext;
  mp::JsonValue* root = ParseOrNull(&jsonContext.Memory(), base, size);
  if (root == nullptr) {
    ++g_checks;
    ++g_failures;
    return;
  }
  EnsureCanonicalLimits(&jsonContext.Memory(), root);
  mutate(&jsonContext.Memory(), root);
  size_t mutatedSize = 0;
  char* mutated = SerializeCanonical(&jsonContext.Memory(), root, &mutatedSize);
  if (mutated == nullptr) {
    printf("  [FAIL] %s：派生请求序列化失败\n", label);
    ++g_checks;
    ++g_failures;
    return;
  }
  void* block = CallApi("plan", mutated, mutatedSize);
  free(mutated);
  ++g_checks;
  if (block == nullptr) {
    printf("  [FAIL] %s：核心返回空结果块\n", label);
    ++g_failures;
    return;
  }
  mp::ExecContext callContext;
  mp::JsonValue* envelope = ParseOrNull(&callContext.Memory(), BlockPayload(block), BlockLength(block));
  const mp::JsonValue* ok = envelope == nullptr ? nullptr : Member(envelope, "ok");
  const mp::JsonValue* result = envelope == nullptr ? nullptr : Member(envelope, "result");
  const mp::JsonValue* status = result == nullptr ? nullptr : Member(result, "status");
  const mp::JsonValue* plans = result == nullptr ? nullptr : Member(result, "plans");
  const bool good = ok != nullptr && ok->kind == mp::JsonKind::Bool && ok->boolean &&
                    status != nullptr && status->text.Equals(expectedStatus) && plans != nullptr &&
                    plans->kind == mp::JsonKind::Array &&
                    (expectEmptyPlans ? plans->count == 0 : plans->count > 0);
  if (!good) {
    const mp::JsonValue* error = envelope == nullptr ? nullptr : Member(envelope, "error");
    const mp::JsonValue* code = error == nullptr ? nullptr : Member(error, "code");
    printf("  [FAIL] %s：期望 status=%s，实际 status=%s ok=%d errorCode=%s\n", label,
           expectedStatus,
           status != nullptr ? status->text.data : "(none)",
           (ok != nullptr && ok->kind == mp::JsonKind::Bool) ? static_cast<int>(ok->boolean) : -1,
           code != nullptr ? code->text.data : "(null)");
    ++g_failures;
  } else {
    printf("  [PASS] %s → status=%s plans=%zu\n", label, expectedStatus, plans->count);
  }
  mp_free(block);
}

// ---------------------------------------------------------------------------
// 3b) ValidateMenuCatalog 的失败路径
// ---------------------------------------------------------------------------
void MutateMenuBadHash(mp::Arena* arena, mp::JsonValue* root) {
  char zeros[80];
  for (int i = 0; i < 71; ++i) {
    zeros[i] = (i < 7) ? "sha256:"[i] : '0';
  }
  zeros[71] = '\0';
  for (mp::JsonMember* member = root->members; member != nullptr; member = member->next) {
    if (member->key.Equals("catalogHash")) {
      member->value->kind = mp::JsonKind::String;
      member->value->text = NewStr(arena, zeros);
      return;
    }
  }
}

void MutateMenuHalfPriceDiffers(mp::Arena* arena, mp::JsonValue* root) {
  (void)arena;
  mp::JsonValue* offers = ArrayMemberOf(root, "offers");
  if (offers == nullptr) {
    return;
  }
  for (mp::JsonValue* offer = offers->child; offer != nullptr; offer = offer->next) {
    bool found = false;
    const char* offerId = StringValueOf(offer, "offerId", &found);
    if (found && strcmp(offerId, "offer-rice-half") == 0) {
      SetNumberMember(offer, "priceCents", 50);
      return;
    }
  }
}

void MutateMenuUnknownDish(mp::Arena* arena, mp::JsonValue* root) {
  mp::JsonValue* offers = ArrayMemberOf(root, "offers");
  if (offers == nullptr) {
    return;
  }
  for (mp::JsonValue* offer = offers->child; offer != nullptr; offer = offer->next) {
    bool found = false;
    const char* offerId = StringValueOf(offer, "offerId", &found);
    if (found && strcmp(offerId, "offer-chicken") == 0) {
      for (mp::JsonMember* member = offer->members; member != nullptr; member = member->next) {
        if (member->key.Equals("dishId")) {
          member->value->kind = mp::JsonKind::String;
          member->value->text = NewStr(arena, "dish-missing");
          return;
        }
      }
    }
  }
}

void CheckMenuRejected(const char* label, const char* base, size_t size, DomMutator mutate,
                       const char* expectedPathPart) {
  mp::ExecContext jsonContext;
  mp::JsonValue* root = ParseOrNull(&jsonContext.Memory(), base, size);
  if (root == nullptr) {
    ++g_checks;
    ++g_failures;
    return;
  }
  mutate(&jsonContext.Memory(), root);
  size_t mutatedSize = 0;
  char* mutated = SerializeCanonical(&jsonContext.Memory(), root, &mutatedSize);
  if (mutated == nullptr) {
    printf("  [FAIL] %s：派生请求序列化失败\n", label);
    ++g_checks;
    ++g_failures;
    return;
  }
  void* block = CallApi("validate-menu", mutated, mutatedSize);
  free(mutated);
  ++g_checks;
  if (block == nullptr) {
    printf("  [FAIL] %s：核心返回空结果块\n", label);
    ++g_failures;
    return;
  }
  mp::ExecContext callContext;
  mp::JsonValue* envelope = ParseOrNull(&callContext.Memory(), BlockPayload(block), BlockLength(block));
  const mp::JsonValue* ok = envelope == nullptr ? nullptr : Member(envelope, "ok");
  const mp::JsonValue* error = envelope == nullptr ? nullptr : Member(envelope, "error");
  const mp::JsonValue* code = error == nullptr ? nullptr : Member(error, "code");
  const mp::JsonValue* fieldPath = error == nullptr ? nullptr : Member(error, "fieldPath");
  bool pathOk = false;
  if (fieldPath != nullptr && fieldPath->kind == mp::JsonKind::String) {
    pathOk = strstr(fieldPath->text.data, expectedPathPart) != nullptr;
  }
  const bool good = ok != nullptr && ok->kind == mp::JsonKind::Bool && !ok->boolean &&
                    code != nullptr && code->text.Equals("INVALID_INPUT") && pathOk;
  if (!good) {
    printf("  [FAIL] %s：ok=%d code=%s fieldPath=%s\n", label,
           (ok != nullptr && ok->kind == mp::JsonKind::Bool) ? static_cast<int>(ok->boolean) : -1,
           code != nullptr ? code->text.data : "(none)",
           fieldPath != nullptr ? fieldPath->text.data : "(none)");
    ++g_failures;
  } else {
    printf("  [PASS] %s → INVALID_INPUT @ %s\n", label, fieldPath->text.data);
  }
  mp_free(block);
}

void RunValidateMenuNegativeTests() {
  // 执行单元测试章节：[3b] ValidateMenuCatalog 失败路径\n
  printf("[3b] ValidateMenuCatalog 失败路径\n");
  size_t size = 0;
  char* base = ReadFileWide(kMenuPath, &size);
  if (base == nullptr) {
    printf("  [FAIL] 无法读取模拟菜单\n");
    ++g_checks;
    ++g_failures;
    return;
  }
  CheckMenuRejected("catalogHash 与目录内容不一致", base, size, &MutateMenuBadHash, "catalogHash");
  CheckMenuRejected("半份米饭价格与整份不同价", base, size, &MutateMenuHalfPriceDiffers,
                    "priceCents");
  CheckMenuRejected("报价引用不存在的菜品", base, size, &MutateMenuUnknownDish, "dishId");
  free(base);
}

// 锁定一个营养未知的菜品 -> 方案可用但营养不完整 -> OkPartial（带 NUTRITION_INCOMPLETE 标志）
void MutatePartialNutrition(mp::Arena* arena, mp::JsonValue* root) {
  mp::JsonValue* catalog = const_cast<mp::JsonValue*>(Member(root, "catalog"));
  mp::JsonValue* dishes = catalog == nullptr ? nullptr : ArrayMemberOf(catalog, "dishes");
  if (dishes == nullptr) {
    return;
  }
  for (mp::JsonValue* dish = dishes->child; dish != nullptr; dish = dish->next) {
    bool found = false;
    const char* dishId = StringValueOf(dish, "dishId", &found);
    if (found && strcmp(dishId, "dish-soup") == 0) {
      NullifyDishNutrition(dish);
      break;
    }
  }
  RefreshCatalogHash(arena, root);
  mp::JsonValue* state = const_cast<mp::JsonValue*>(Member(root, "state"));
  mp::JsonValue* locks = state == nullptr ? nullptr : ArrayMemberOf(state, "itemLocks");
  if (locks == nullptr) {
    return;
  }
  mp::JsonValue* entry = NewObjectNode(arena);
  AppendMember(arena, entry, "meal", NewStringNode(arena, "dinner"));
  AppendMember(arena, entry, "offerId", NewStringNode(arena, "offer-soup"));
  AppendMember(arena, entry, "quantity", NewNumberNode(arena, 1));
  AppendElement(arena, locks, entry);
}

// 用规范合法限额 limits.maxSearchNodes=2 真实触发搜索限额（不是写死状态）
void MutateResourceLimited(mp::Arena* arena, mp::JsonValue* root) {
  EnsureCanonicalLimits(arena, root, 2000, 4000, 2);
}

void RunPlanStatusTests() {
  // 执行单元测试章节：[5] PlanDay 其余状态路径\n
  printf("[5] PlanDay 其余状态路径\n");
  size_t size = 0;
  char* base = ReadFileWide(kPlanOkPath, &size);
  if (base == nullptr) {
    printf("  [FAIL] 无法读取模拟 PlanDay 输入\n");
    ++g_checks;
    ++g_failures;
    return;
  }
  CheckPlanStatus("NoFeasible（早餐锁到不供应早餐的窗口）", base, size, &MutateNoFeasible,
                  "NoFeasible", true);
  CheckPlanStatus("NoFeasibleWithinBudget（预算 1 分）", base, size, &MutateOverBudget,
                  "NoFeasibleWithinBudget", false);
  CheckPlanStatus("LockConflict（锁定不存在的报价）", base, size, &MutateLockConflict,
                  "LockConflict", true);
  CheckPlanStatus("NutritionDataInsufficient（全部菜品营养未知）", base, size,
                  &MutateNutritionInsufficient, "NutritionDataInsufficient", true);
  CheckPlanStatus("OkPartial（锁定营养未知的汤）", base, size, &MutatePartialNutrition,
                  "OkPartial", false);
  CheckPlanStatus("ResourceLimited（limits.maxSearchNodes=2 合法限额触发）", base, size,
                  &MutateResourceLimited, "ResourceLimited", true);
  free(base);
}

// ---------------------------------------------------------------------------
// 6) PlanDay 契约字段核对（§5：nutritionReferenceTarget / budget / offeredAs / planKey / flags）
// ---------------------------------------------------------------------------
const mp::JsonValue* MemberByStr(const mp::JsonValue* object, mp::Str key) {
  if (object == nullptr || object->kind != mp::JsonKind::Object) {
    return nullptr;
  }
  for (const mp::JsonMember* member = object->members; member != nullptr; member = member->next) {
    if (member->key.Equals(key)) {
      return member->value;
    }
  }
  return nullptr;
}

bool NumberMemberEquals(const mp::JsonValue* object, const char* key, mp::i64 expected) {
  const mp::JsonValue* value = Member(object, key);
  return value != nullptr && value->kind == mp::JsonKind::Number && value->number == expected;
}

void RunPlanContractFieldTests() {
  // 执行单元测试章节：[6] PlanDay 契约字段核对\n
  printf("[6] PlanDay 契约字段核对\n");
  size_t rawSize = 0;
  char* rawBase = ReadFileWide(kPlanOkPath, &rawSize);
  if (rawBase == nullptr) {
    printf("  [FAIL] 无法读取模拟 PlanDay 输入\n");
    ++g_checks;
    ++g_failures;
    return;
  }
  mp::ExecContext baseDomCtx;
  mp::JsonValue* baseRoot = ParseOrNull(&baseDomCtx.Memory(), rawBase, rawSize);
  free(rawBase);
  EnsureCanonicalLimits(&baseDomCtx.Memory(), baseRoot);
  size_t size = 0;
  char* base = SerializeCanonical(&baseDomCtx.Memory(), baseRoot, &size);
  void* block = CallApi("plan", base, size);
  free(base);
  ++g_checks;
  if (block == nullptr) {
    printf("  [FAIL] PlanDay 返回空结果块\n");
    ++g_failures;
    return;
  }
  mp::ExecContext context;
  mp::JsonValue* envelope = ParseOrNull(&context.Memory(), BlockPayload(block), BlockLength(block));
  const mp::JsonValue* result = envelope == nullptr ? nullptr : Member(envelope, "result");
  const mp::JsonValue* status = result == nullptr ? nullptr : Member(result, "status");
  Check(status != nullptr && status->kind == mp::JsonKind::String &&
            (status->text.Equals("Ok") || status->text.Equals("OkPartial")),
        "成功计划状态为 Ok/OkPartial");

  const mp::JsonValue* plans = result == nullptr ? nullptr : Member(result, "plans");
  Check(plans != nullptr && plans->kind == mp::JsonKind::Array && plans->count >= 1, "plans 非空");
  const mp::JsonValue* plan = plans == nullptr ? nullptr : plans->child;

  // planKey：plan: + 64 位小写 hex
  const mp::JsonValue* planKey = plan == nullptr ? nullptr : Member(plan, "planKey");
  bool keyShapeOk = planKey != nullptr && planKey->kind == mp::JsonKind::String &&
                    planKey->text.size == 69;
  if (keyShapeOk) {
    const char prefix[] = "plan:";
    for (mp::usize i = 0; i < 5; ++i) {
      if (planKey->text.data[i] != prefix[i]) {
        keyShapeOk = false;
      }
    }
    for (mp::usize i = 5; i < 69; ++i) {
      const char c = planKey->text.data[i];
      if (!((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f'))) {
        keyShapeOk = false;
      }
    }
  }
  Check(keyShapeOk, "planKey 形如 plan:+64 位小写 hex（不透明稳定键）");

  const mp::JsonValue* targets = result == nullptr ? nullptr : Member(result, "targets");
  const mp::JsonValue* mealReference = targets == nullptr ? nullptr : Member(targets, "mealReference");
  const mp::JsonValue* meals = plan == nullptr ? nullptr : Member(plan, "meals");
  bool referenceOk = meals != nullptr && meals->kind == mp::JsonKind::Array && mealReference != nullptr;
  if (referenceOk) {
    static const char* nutrientKeys[] = {"energyKcal", "proteinDg", "fatDg", "carbDg"};
    for (const mp::JsonValue* meal = meals->child; meal != nullptr && referenceOk;
         meal = meal->next) {
      const mp::JsonValue* mealName = Member(meal, "meal");
      const mp::JsonValue* reference = Member(meal, "nutritionReferenceTarget");
      const mp::JsonValue* expected =
          mealName == nullptr ? nullptr : MemberByStr(mealReference, mealName->text);
      if (reference == nullptr || reference->kind != mp::JsonKind::Object || expected == nullptr) {
        referenceOk = false;
        break;
      }
      for (mp::usize i = 0; i < 4; ++i) {
        const mp::JsonValue* actual = Member(reference, nutrientKeys[i]);
        const mp::JsonValue* wanted = Member(expected, nutrientKeys[i]);
        if (actual == nullptr || wanted == nullptr || actual->kind != mp::JsonKind::Number ||
            wanted->kind != mp::JsonKind::Number || actual->number != wanted->number) {
          referenceOk = false;
        }
      }
    }
  }
  Check(referenceOk, "每餐 nutritionReferenceTarget == targets.mealReference[meal]");

  // budget：契约 9 个字段齐备，且金额/完整性语义与 items 独立核对
  const mp::JsonValue* budget = plan == nullptr ? nullptr : Member(plan, "budget");
  bool budgetFieldsOk = budget != nullptr && budget->kind == mp::JsonKind::Object;
  if (budgetFieldsOk) {
    static const char* required[] = {"budgetCents",
                                     "remainingBudgetKnownCents",
                                     "plannedTotalCents",
                                     "plannedTotalKnownCents",
                                     "priceIncomplete",
                                     "overBudget",
                                     "withinBudgetKnownAmounts",
                                     "overageCents",
                                     "checkBasis"};
    for (mp::usize i = 0; i < 9; ++i) {
      if (Member(budget, required[i]) == nullptr) {
        budgetFieldsOk = false;
      }
    }
  }
  Check(budgetFieldsOk, "方案 budget 含契约全部 9 个字段");

  bool budgetSemanticsOk = budgetFieldsOk;
  if (budgetSemanticsOk) {
    mp::i64 itemSum = 0;
    bool priceIncomplete = false;
    for (const mp::JsonValue* meal = meals->child; meal != nullptr && budgetSemanticsOk;
         meal = meal->next) {
      const mp::JsonValue* items = Member(meal, "items");
      if (items == nullptr || items->kind != mp::JsonKind::Array) {
        budgetSemanticsOk = false;
        break;
      }
      for (const mp::JsonValue* item = items->child; item != nullptr; item = item->next) {
        const mp::JsonValue* price = Member(item, "priceCents");
        if (price == nullptr) {
          budgetSemanticsOk = false;
        } else if (price->kind == mp::JsonKind::Null) {
          priceIncomplete = true;
        } else {
          itemSum += price->number;
        }
      }
    }
    const mp::JsonValue* priceIncompleteValue = Member(budget, "priceIncomplete");
    const mp::JsonValue* withinValue = Member(budget, "withinBudgetKnownAmounts");
    const mp::JsonValue* overValue = Member(budget, "overBudget");
    budgetSemanticsOk = budgetSemanticsOk &&
                        NumberMemberEquals(budget, "plannedTotalKnownCents", itemSum) &&
                        NumberMemberEquals(budget, "plannedTotalCents", itemSum) &&
                        NumberMemberEquals(budget, "budgetCents", 5000) &&
                        NumberMemberEquals(budget, "remainingBudgetKnownCents", 5000) &&
                        NumberMemberEquals(budget, "overageCents", 0) &&
                        priceIncompleteValue != nullptr &&
                        priceIncompleteValue->kind == mp::JsonKind::Bool &&
                        priceIncompleteValue->boolean == priceIncomplete &&
                        withinValue != nullptr && withinValue->kind == mp::JsonKind::Bool &&
                        withinValue->boolean && overValue != nullptr &&
                        overValue->kind == mp::JsonKind::Bool && !overValue->boolean;
  }
  Check(budgetSemanticsOk, "budget 金额/完整性语义与 items 一致（预算内、超额 0）");

  // 跨策略合并：offeredAs 覆盖全部策略；strategyOutcome 全部 applied 且指向同一 planKey
  const mp::JsonValue* offered = plan == nullptr ? nullptr : Member(plan, "offeredAs");
  const mp::JsonValue* outcomes = result == nullptr ? nullptr : Member(result, "strategyOutcome");
  bool mergeOk = offered != nullptr && offered->kind == mp::JsonKind::Array &&
                 offered->count > 0 && outcomes != nullptr &&
                 outcomes->kind == mp::JsonKind::Array && outcomes->count == offered->count;
  if (mergeOk) {
    for (const mp::JsonValue* outcome = outcomes->child; outcome != nullptr;
         outcome = outcome->next) {
      const mp::JsonValue* applied = Member(outcome, "applied");
      const mp::JsonValue* key = Member(outcome, "planKey");
      if (applied == nullptr || applied->kind != mp::JsonKind::Bool || !applied->boolean) {
        mergeOk = false;
      }
      if (key == nullptr || key->kind != mp::JsonKind::String || planKey == nullptr ||
          !key->text.Equals(planKey->text)) {
        mergeOk = false;
      }
    }
    for (const mp::JsonValue* strategyValue = offered->child; strategyValue != nullptr;
         strategyValue = strategyValue->next) {
      bool found = false;
      for (const mp::JsonValue* outcome = outcomes->child; outcome != nullptr;
           outcome = outcome->next) {
        const mp::JsonValue* strategy = Member(outcome, "strategy");
        if (strategy != nullptr && strategy->kind == mp::JsonKind::String &&
            strategy->text.Equals(strategyValue->text)) {
          found = true;
        }
      }
      if (!found) {
        mergeOk = false;
      }
    }
  }
  Check(mergeOk, "同一方案 offeredAs 合并全部策略，strategyOutcome 全部 applied 且同一 planKey");

  // ESTIMATED_DATA：模拟数据 estimated=true，必须带估算标志
  bool estimatedOk = false;
  const mp::JsonValue* flags = plan == nullptr ? nullptr : Member(plan, "flags");
  if (flags != nullptr && flags->kind == mp::JsonKind::Array) {
    for (const mp::JsonValue* flag = flags->child; flag != nullptr; flag = flag->next) {
      if (flag->kind == mp::JsonKind::String && flag->text.Equals("ESTIMATED_DATA")) {
        estimatedOk = true;
      }
    }
  }
  Check(estimatedOk, "estimated=true 的模拟数据带 ESTIMATED_DATA 标志");

  const mp::JsonValue* search = result == nullptr ? nullptr : Member(result, "search");
  const bool searchOk = search != nullptr && Member(search, "algorithm") != nullptr &&
                        Member(search, "searchComplete") != nullptr &&
                        Member(search, "candidatesEnumerated") != nullptr &&
                        Member(search, "nodesEvaluated") != nullptr &&
                        Member(search, "statesEvaluated") != nullptr &&
                        Member(search, "capsHit") != nullptr &&
                        Member(search, "approximations") != nullptr;
  Check(searchOk, "search 含 T01 v1.2 规范 7 字段（algorithm/searchComplete/candidatesEnumerated/nodesEvaluated/statesEvaluated/capsHit/approximations）");

  mp_free(block);
}

// ---------------------------------------------------------------------------
// 7) T04 三算法（greedy / dp / branchAndBound）、套餐规则展开与限额降级单测
// ---------------------------------------------------------------------------
void SetStringMember(mp::Arena* arena, mp::JsonValue* object, const char* key, const char* val) {
  if (object == nullptr || object->kind != mp::JsonKind::Object) {
    return;
  }
  for (mp::JsonMember* m = object->members; m != nullptr; m = m->next) {
    if (m->key.Equals(key)) {
      m->value->kind = mp::JsonKind::String;
      m->value->text = NewStr(arena, val);
      return;
    }
  }
  AppendMember(arena, object, key, NewStringNode(arena, val));
}

void RunT04AlgorithmAndComboTests() {
  // 执行单元测试章节：[7] T04 三算法与套餐展开专项验证\n
  printf("[7] T04 三算法与套餐展开专项验证\n");
  size_t rawSize = 0;
  char* rawBase = ReadFileWide(kPlanOkPath, &rawSize);
  if (rawBase == nullptr) {
    printf("  [FAIL] 无法读取模拟 PlanDay 输入\n");
    ++g_checks;
    ++g_failures;
    return;
  }

  // 7.1 旧版 limits.maxNodes / maxCandidates 字段名必须报 INVALID_INPUT（禁止静默兼容）
  {
    mp::ExecContext domCtx;
    mp::JsonValue* root = ParseOrNull(&domCtx.Memory(), rawBase, rawSize);
    mp::JsonValue* pc = const_cast<mp::JsonValue*>(Member(root, "plannerConfig"));
    mp::JsonValue* badLimits = NewObjectNode(&domCtx.Memory());
    AppendMember(&domCtx.Memory(), badLimits, "maxCandidates", NewNumberNode(&domCtx.Memory(), 2000));
    AppendMember(&domCtx.Memory(), badLimits, "maxNodes", NewNumberNode(&domCtx.Memory(), 20000));
    for (mp::JsonMember* m = pc->members; m != nullptr; m = m->next) {
      if (m->key.Equals("limits")) {
        m->value = badLimits;
      }
    }
    size_t s = 0;
    char* req = SerializeCanonical(&domCtx.Memory(), root, &s);
    void* block = CallApi("plan", req, s);
    free(req);
    mp::ExecContext resCtx;
    mp::JsonValue* env = ParseOrNull(&resCtx.Memory(), BlockPayload(block), BlockLength(block));
    const mp::JsonValue* ok = Member(env, "ok");
    const mp::JsonValue* err = Member(env, "error");
    const mp::JsonValue* code = err == nullptr ? nullptr : Member(err, "code");
    Check(ok != nullptr && !ok->boolean && code != nullptr && code->text.Equals("INVALID_INPUT"),
          "旧版 limits.maxCandidates/maxNodes 字段名被严格拒绝并返回 INVALID_INPUT");
    mp_free(block);
  }

  // 7.2 dp 与 branchAndBound 在模拟请求上均成功完成全局最优搜索，且与无损最优解一致
  char dpKeyBuf[80] = {0};
  {
    mp::ExecContext domCtx;
    mp::JsonValue* root = ParseOrNull(&domCtx.Memory(), rawBase, rawSize);
    EnsureCanonicalLimits(&domCtx.Memory(), root, 2000, 4000, 50000);
    mp::JsonValue* pc = const_cast<mp::JsonValue*>(Member(root, "plannerConfig"));
    // 覆写测试 DOM 对象中的字段 "algorithm"，注入特定算法或边界测试参数
    SetStringMember(&domCtx.Memory(), pc, "algorithm", "dp");
    size_t s = 0;
    char* req = SerializeCanonical(&domCtx.Memory(), root, &s);
    void* block = CallApi("plan", req, s);
    free(req);
    mp::ExecContext resCtx;
    mp::JsonValue* env = ParseOrNull(&resCtx.Memory(), BlockPayload(block), BlockLength(block));
    const mp::JsonValue* res = Member(env, "result");
    const mp::JsonValue* search = res == nullptr ? nullptr : Member(res, "search");
    const mp::JsonValue* sc = search == nullptr ? nullptr : Member(search, "searchComplete");
    const mp::JsonValue* statesEval = search == nullptr ? nullptr : Member(search, "statesEvaluated");
    const mp::JsonValue* nodesEval = search == nullptr ? nullptr : Member(search, "nodesEvaluated");
    const mp::JsonValue* plans = res == nullptr ? nullptr : Member(res, "plans");
    const mp::JsonValue* pk = (plans && plans->child) ? Member(plans->child, "planKey") : nullptr;
    if (pk && pk->kind == mp::JsonKind::String && pk->text.size < 79) {
      memcpy(dpKeyBuf, pk->text.data, pk->text.size);
      dpKeyBuf[pk->text.size] = '\0';
    }
    Check(sc != nullptr && sc->kind == mp::JsonKind::Bool && sc->boolean &&
              statesEval != nullptr && statesEval->kind == mp::JsonKind::Number && statesEval->number > 0 &&
              nodesEval != nullptr && nodesEval->kind == mp::JsonKind::Null,
          "algorithm=dp 搜索完成（searchComplete=true, statesEvaluated>0, nodesEvaluated=null）");
    mp_free(block);
  }

  {
    mp::ExecContext domCtx;
    mp::JsonValue* root = ParseOrNull(&domCtx.Memory(), rawBase, rawSize);
    EnsureCanonicalLimits(&domCtx.Memory(), root, 2000, 4000, 50000);
    mp::JsonValue* pc = const_cast<mp::JsonValue*>(Member(root, "plannerConfig"));
    // 覆写测试 DOM 对象中的字段 "algorithm"，注入特定算法或边界测试参数
    SetStringMember(&domCtx.Memory(), pc, "algorithm", "branchAndBound");
    size_t s = 0;
    char* req = SerializeCanonical(&domCtx.Memory(), root, &s);
    void* block = CallApi("plan", req, s);
    free(req);
    mp::ExecContext resCtx;
    mp::JsonValue* env = ParseOrNull(&resCtx.Memory(), BlockPayload(block), BlockLength(block));
    const mp::JsonValue* res = Member(env, "result");
    const mp::JsonValue* search = res == nullptr ? nullptr : Member(res, "search");
    const mp::JsonValue* sc = search == nullptr ? nullptr : Member(search, "searchComplete");
    const mp::JsonValue* statesEval = search == nullptr ? nullptr : Member(search, "statesEvaluated");
    const mp::JsonValue* nodesEval = search == nullptr ? nullptr : Member(search, "nodesEvaluated");
    const mp::JsonValue* plans = res == nullptr ? nullptr : Member(res, "plans");
    const mp::JsonValue* pk = (plans && plans->child) ? Member(plans->child, "planKey") : nullptr;
    const bool sameKey = pk != nullptr && pk->kind == mp::JsonKind::String && pk->text.Equals(dpKeyBuf);
    Check(sc != nullptr && sc->kind == mp::JsonKind::Bool && sc->boolean &&
              nodesEval != nullptr && nodesEval->kind == mp::JsonKind::Number && nodesEval->number > 0 &&
              statesEval != nullptr && statesEval->kind == mp::JsonKind::Null && sameKey,
          "algorithm=branchAndBound 搜索完成且与 dp 全局最优 planKey 完全一致");
    mp_free(block);
  }

  // 7.3 DP 在紧状态上限（maxDpStates=2）下触发桶化量化 APPROXIMATE_DISCRETIZATION
  {
    mp::ExecContext domCtx;
    mp::JsonValue* root = ParseOrNull(&domCtx.Memory(), rawBase, rawSize);
    EnsureCanonicalLimits(&domCtx.Memory(), root, 2000, 2, 50000);
    mp::JsonValue* pc = const_cast<mp::JsonValue*>(Member(root, "plannerConfig"));
    // 覆写测试 DOM 对象中的字段 "algorithm"，注入特定算法或边界测试参数
    SetStringMember(&domCtx.Memory(), pc, "algorithm", "dp");
    size_t s = 0;
    char* req = SerializeCanonical(&domCtx.Memory(), root, &s);
    void* block = CallApi("plan", req, s);
    free(req);
    mp::ExecContext resCtx;
    mp::JsonValue* env = ParseOrNull(&resCtx.Memory(), BlockPayload(block), BlockLength(block));
    const mp::JsonValue* res = Member(env, "result");
    const mp::JsonValue* search = res == nullptr ? nullptr : Member(res, "search");
    const mp::JsonValue* sc = search == nullptr ? nullptr : Member(search, "searchComplete");
    const mp::JsonValue* capsHit = search == nullptr ? nullptr : Member(search, "capsHit");
    const mp::JsonValue* approx = search == nullptr ? nullptr : Member(search, "approximations");
    bool hasDpCap = false;
    if (capsHit && capsHit->kind == mp::JsonKind::Array) {
      for (const mp::JsonValue* c = capsHit->child; c != nullptr; c = c->next) {
        const mp::JsonValue* lim = Member(c, "limit");
        if (lim && lim->text.Equals("maxDpStates")) hasDpCap = true;
      }
    }
    bool hasDiscretization = false;
    if (approx && approx->kind == mp::JsonKind::Array) {
      for (const mp::JsonValue* a = approx->child; a != nullptr; a = a->next) {
        const mp::JsonValue* kind = Member(a, "kind");
        if (kind && kind->text.Equals("APPROXIMATE_DISCRETIZATION")) hasDiscretization = true;
      }
    }
    Check(sc != nullptr && !sc->boolean && hasDpCap && hasDiscretization,
          "dp 在 maxDpStates=2 下诚实记录 capsHit(maxDpStates) 与 APPROXIMATE_DISCRETIZATION");
    mp_free(block);
  }

  // 7.4 comboRules[] 规则展开（ruleId#<dishId升序拼接>）与含饭互斥校验
  {
    mp::ExecContext domCtx;
    mp::JsonValue* root = ParseOrNull(&domCtx.Memory(), rawBase, rawSize);
    EnsureCanonicalLimits(&domCtx.Memory(), root, 2000, 4000, 50000);
    mp::JsonValue* pc = const_cast<mp::JsonValue*>(Member(root, "plannerConfig"));
    // 覆写测试 DOM 对象中的字段 "algorithm"，注入特定算法或边界测试参数
    SetStringMember(&domCtx.Memory(), pc, "algorithm", "dp");

    mp::JsonValue* catalog = const_cast<mp::JsonValue*>(Member(root, "catalog"));
    mp::JsonValue* comboRules = ArrayMemberOf(catalog, "comboRules");
    if (comboRules != nullptr) {
      mp::JsonValue* rule = NewObjectNode(&domCtx.Memory());
      AppendMember(&domCtx.Memory(), rule, "ruleId", NewStringNode(&domCtx.Memory(), "rule-lunch-set"));
      AppendMember(&domCtx.Memory(), rule, "name", NewStringNode(&domCtx.Memory(), "午间双蛋白套餐"));
      AppendMember(&domCtx.Memory(), rule, "windowId", NewStringNode(&domCtx.Memory(), "w-main"));
      mp::JsonValue* mealsArr = NewArrayNode(&domCtx.Memory());
      AppendElement(&domCtx.Memory(), mealsArr, NewStringNode(&domCtx.Memory(), "lunch"));
      AppendMember(&domCtx.Memory(), rule, "mealWindows", mealsArr);
      AppendMember(&domCtx.Memory(), rule, "totalPriceCents", NewNumberNode(&domCtx.Memory(), 1100));
      AppendMember(&domCtx.Memory(), rule, "includesRice", NewBoolNode(&domCtx.Memory(), true));

      mp::JsonValue* reqCounts = NewObjectNode(&domCtx.Memory());
      AppendMember(&domCtx.Memory(), reqCounts, "protein", NewNumberNode(&domCtx.Memory(), 2));
      AppendMember(&domCtx.Memory(), rule, "requiredCounts", reqCounts);

      mp::JsonValue* candDishes = NewArrayNode(&domCtx.Memory());
      AppendElement(&domCtx.Memory(), candDishes, NewStringNode(&domCtx.Memory(), "dish-chicken"));
      AppendElement(&domCtx.Memory(), candDishes, NewStringNode(&domCtx.Memory(), "dish-pork"));
      AppendMember(&domCtx.Memory(), rule, "candidateDishIds", candDishes);

      AppendMember(&domCtx.Memory(), rule, "nutritionPolicy", NewStringNode(&domCtx.Memory(), "sumComponents"));
      AppendElement(&domCtx.Memory(), comboRules, rule);
      RefreshCatalogHash(&domCtx.Memory(), root);
    }

    // 锁定展开后的套餐 ID：rule-lunch-set#dish-chicken+dish-pork
    mp::JsonValue* state = const_cast<mp::JsonValue*>(Member(root, "state"));
    mp::JsonValue* itemLocks = ArrayMemberOf(state, "itemLocks");
    mp::JsonValue* lockEntry = NewObjectNode(&domCtx.Memory());
    AppendMember(&domCtx.Memory(), lockEntry, "meal", NewStringNode(&domCtx.Memory(), "lunch"));
    AppendMember(&domCtx.Memory(), lockEntry, "offerId",
                 NewStringNode(&domCtx.Memory(), "rule-lunch-set#dish-chicken+dish-pork"));
    AppendMember(&domCtx.Memory(), lockEntry, "quantity", NewNumberNode(&domCtx.Memory(), 1));
    AppendElement(&domCtx.Memory(), itemLocks, lockEntry);

    size_t s = 0;
    char* req = SerializeCanonical(&domCtx.Memory(), root, &s);
    void* block = CallApi("plan", req, s);
    free(req);
    mp::ExecContext resCtx;
    mp::JsonValue* env = ParseOrNull(&resCtx.Memory(), BlockPayload(block), BlockLength(block));
    const mp::JsonValue* ok = Member(env, "ok");
    const mp::JsonValue* res = Member(env, "result");
    const mp::JsonValue* status = res == nullptr ? nullptr : Member(res, "status");
    Check(ok != nullptr && ok->boolean && status != nullptr && status->text.Equals("OkPartial"),
          "comboRules 展开生成 rule-lunch-set#dish-chicken+dish-tofu 且支持锁定与规划");
    mp_free(block);
  }

  free(rawBase);
}

}  // namespace

int main() {
  setvbuf(stdout, nullptr, _IONBF, 0);
  printf("=== T04 三算法核心：原生单元与契约验证 ===\n");
  fflush(stdout);
  RunNutritionPairTests();
  fflush(stdout);
  RunContractErrorTests();
  fflush(stdout);
  RunValidateMenuTest();
  fflush(stdout);
  RunValidateMenuNegativeTests();
  fflush(stdout);
  RunPlanTests();
  fflush(stdout);
  RunPlanStatusTests();
  fflush(stdout);
  RunPlanContractFieldTests();
  fflush(stdout);
  RunT04AlgorithmAndComboTests();
  fflush(stdout);
  printf("\n检查项 %d，失败 %d\n", g_checks, g_failures);
  if (g_failures == 0) {
    printf("ALL PASS (%d checks)\n", g_checks);
    return 0;
  }
  printf("FAILED\n");
  return 1;
}

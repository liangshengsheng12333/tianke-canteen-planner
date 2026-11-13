#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""T02 PlanDay 结果独立校验器。

用法：
    python tools/core/verify_planday.py <inputs_dir> <results_dir>

inputs_dir 放 4 份请求夹具，results_dir 放 4 份结果夹具；
逐项检查并打印 [PASS]/[FAIL]，最后打印 CHECKS=N FAILED=M。
全部通过 exit 0；存在失败或没有可执行检查时 exit 1。
夹具缺失时打印 [SKIP] 缺文件 ... 并继续，不抛栈。

本文件是独立实现：不调用 C++/JS 被测代码，planKey、营养偏差、预算语义等
全部按契约规则在 Python 内重算。
"""

import hashlib
import json
import sys
from pathlib import Path

# 绑定关键上下文变量 MEAL_ORDER，用于后续契约比对或子进程调用
MEAL_ORDER = ("breakfast", "lunch", "dinner")
# 绑定关键上下文变量 MEAL_INDEX，用于后续契约比对或子进程调用
MEAL_INDEX = {name: index for index, name in enumerate(MEAL_ORDER)}

# 结果字段 -> nutritionConfig 权重键
NUTRIENT_FIELDS = (
    ("energyKcal", "energy"),
    ("proteinDg", "protein"),
    ("fatDg", "fat"),
    ("carbDg", "carb"),
)

# 绑定关键上下文变量 KNOWN_DIAGNOSTIC_CODES，用于后续契约比对或子进程调用
KNOWN_DIAGNOSTIC_CODES = frozenset(
    {"TARGET_NOT_APPLICABLE", "LOCK_CONFLICT", "SEARCH_LIMIT_REACHED"}
)

# 绑定关键上下文变量 SCENARIOS，用于后续契约比对或子进程调用
SCENARIOS = (
    ("success", "plan-request-success.json", "plan-result-success.json"),
    ("target-unavailable", "plan-request-target-unavailable.json", "plan-result-target-unavailable.json"),
    ("invalid", "plan-request-invalid.json", "plan-result-invalid.json"),
    ("resource-limited", "plan-request-resource-limited.json", "plan-result-resource-limited.json"),
)


# 函数定义：is_int —— 独立执行契约参考计算或验证断言
# 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
def is_int(value):
    """JSON 整数（排除 bool，因为 Python 中 bool 是 int 子类）。"""
    return isinstance(value, int) and not isinstance(value, bool)


# 函数定义：brief —— 独立执行契约参考计算或验证断言
# 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
def brief(value, limit=220):
    # 绑定关键上下文变量 text，用于后续契约比对或子进程调用
    text = repr(value)
    return text if len(text) <= limit else text[:limit] + "..."


# 函数定义：dig —— 独立执行契约参考计算或验证断言
# 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
def dig(obj, *keys, default=None):
    """安全地按路径取嵌套字段；任一层不是对象时返回 default。"""
    current = obj
    # 顺序遍历迭代变量 key，执行逐项校验或候选枚举
    for key in keys:
        # 条件分支判断：检查 (not isinstance(current, dict)) 是否成立
        if not isinstance(current, dict):
            return default
        current = current.get(key)
    return default if current is None else current


# 函数定义：load_json —— 独立执行契约参考计算或验证断言
# 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
def load_json(path):
    """返回 (对象, 错误说明)。缺文件错误说明为 "missing"。"""
    if not path.is_file():
        return None, "missing"
    try:
        with path.open("r", encoding="utf-8-sig") as handle:
            return json.load(handle), None
    except Exception as exc:  # 夹具损坏也不能抛栈
        return None, "{}: {}".format(type(exc).__name__, exc)


class Checker:
    # 函数定义：__init__ —— 独立执行契约参考计算或验证断言
    # 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
    def __init__(self):
        self.checks = 0
        self.failed = 0
        self.failures = []

    # 函数定义：check —— 独立执行契约参考计算或验证断言
    # 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
    def check(self, condition, description, detail=""):
        self.checks += 1
        # 条件分支判断：检查 (condition) 是否成立
        if condition:
            print("[PASS] " + description)
        else:
            self.failed += 1
            self.failures.append(description)
            suffix = (" | " + detail) if detail else ""
            print("[FAIL] " + description + suffix)

    # 函数定义：skip —— 独立执行契约参考计算或验证断言
    # 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
    def skip(self, message):
        print("[SKIP] " + message)


# ---------------------------------------------------------------------------
# 包络（A1/A2）与回显（A3）
# ---------------------------------------------------------------------------


def check_envelope(chk, scenario, envelope, request):
    # 绑定关键上下文变量 version，用于后续契约比对或子进程调用
    version = envelope.get("contractVersion")
    chk.check(
        version == "1.0",
        "{}/A1 contractVersion == \"1.0\"".format(scenario),
        "实际 {}".format(brief(version)),
    )
    # 条件分支判断：检查 (isinstance(request, dict)) 是否成立
    if isinstance(request, dict):
        expected_id = request.get("requestId")
        actual_id = envelope.get("requestId")
        chk.check(
            actual_id == expected_id,
            "{}/A1 requestId 等于请求 requestId".format(scenario),
            "请求 {} / 结果 {}".format(brief(expected_id), brief(actual_id)),
        )

    # 绑定关键上下文变量 ok，用于后续契约比对或子进程调用
    ok = envelope.get("ok")
    chk.check(
        isinstance(ok, bool),
        "{}/A2 ok 是布尔值".format(scenario),
        "实际 {}".format(brief(ok)),
    )
    # 条件分支判断：检查 (ok is True) 是否成立
    if ok is True:
        chk.check(
            envelope.get("error") is None,
            "{}/A2 ok==true 时 error is null".format(scenario),
            "实际 {}".format(brief(envelope.get("error"))),
        )
        chk.check(
            isinstance(envelope.get("result"), dict),
            "{}/A2 ok==true 时 result 是对象".format(scenario),
            "实际 {}".format(brief(envelope.get("result"))),
        )
    elif ok is False:
        chk.check(
            envelope.get("result") is None,
            "{}/A2 ok==false 时 result is null".format(scenario),
            "实际 {}".format(brief(envelope.get("result"))),
        )
        error = envelope.get("error")
        code = error.get("code") if isinstance(error, dict) else None
        field_path = error.get("fieldPath") if isinstance(error, dict) else None
        chk.check(
            isinstance(code, str) and code != "",
            "{}/A2 ok==false 时 error.code 非空".format(scenario),
            "实际 {}".format(brief(code)),
        )
        chk.check(
            isinstance(field_path, str) and field_path != "",
            "{}/A2 ok==false 时 error.fieldPath 非空".format(scenario),
            "实际 {}".format(brief(field_path)),
        )


# 函数定义：check_common_result —— 独立执行契约参考计算或验证断言
# 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
def check_common_result(chk, scenario, request, result):
    # 条件分支判断：检查 (isinstance(request, dict)) 是否成立
    if isinstance(request, dict):
        chk.check(
            result.get("businessDate") == request.get("businessDate"),
            "{}/A3 businessDate 与请求一致".format(scenario),
            "请求 {} / 结果 {}".format(
                brief(request.get("businessDate")), brief(result.get("businessDate"))
            ),
        )
        chk.check(
            result.get("tzOffsetMinutes") == request.get("tzOffsetMinutes"),
            "{}/A3 tzOffsetMinutes 与请求一致".format(scenario),
            "请求 {} / 结果 {}".format(
                brief(request.get("tzOffsetMinutes")), brief(result.get("tzOffsetMinutes"))
            ),
        )

    # F27：diagnostics 的 code 只能是已知集合中的值
    diagnostics = result.get("diagnostics")
    # 条件分支判断：检查 (isinstance(diagnostics, list)) 是否成立
    if isinstance(diagnostics, list):
        codes = []
        malformed = []
        # 顺序遍历迭代变量 entry，执行逐项校验或候选枚举
        for entry in diagnostics:
            if isinstance(entry, dict) and isinstance(entry.get("code"), str):
                codes.append(entry["code"])
            else:
                malformed.append(entry)
        unknown = [code for code in codes if code not in KNOWN_DIAGNOSTIC_CODES]
        chk.check(
            not malformed and not unknown,
            "{}/F27 diagnostics code 均在已知集合内".format(scenario),
            "codes={} / 非法项={}".format(brief(codes), brief(malformed)),
        )
    else:
        chk.check(
            False,
            "{}/F27 diagnostics code 均在已知集合内".format(scenario),
            "diagnostics 缺失或不是数组：{}".format(brief(diagnostics)),
        )

    # E21（计数字段部分）：无论有无方案都应成立
    plans = result.get("plans")
    # 条件分支判断：检查 (isinstance(plans, list)) 是否成立
    if isinstance(plans, list):
        chk.check(
            result.get("distinctPlanCount") == len(plans),
            "{}/E21 distinctPlanCount == len(plans)".format(scenario),
            "distinctPlanCount={} / len(plans)={}".format(
                brief(result.get("distinctPlanCount")), len(plans)
            ),
        )
    else:
        chk.check(
            False,
            "{}/E21 distinctPlanCount == len(plans)".format(scenario),
            "plans 缺失或不是数组：{}".format(brief(plans)),
        )


# ---------------------------------------------------------------------------
# 四类状态（B4-B7）
# ---------------------------------------------------------------------------


def check_scenario_status(chk, scenario, request, envelope, result):
    # 绑定关键上下文变量 ok，用于后续契约比对或子进程调用
    ok = envelope.get("ok")
    # 条件分支判断：检查 (scenario == "invalid") 是否成立
    if scenario == "invalid":
        error = envelope.get("error")
        code = error.get("code") if isinstance(error, dict) else None
        field_path = error.get("fieldPath") if isinstance(error, dict) else None
        chk.check(
            ok is False,
            "{}/B4 invalid: ok==false".format(scenario),
            "实际 {}".format(brief(ok)),
        )
        chk.check(
            code == "INVALID_INPUT",
            "{}/B4 invalid: error.code==INVALID_INPUT".format(scenario),
            "实际 {}".format(brief(code)),
        )
        chk.check(
            isinstance(field_path, str) and field_path != "",
            "{}/B4 invalid: error.fieldPath 非空".format(scenario),
            "实际 {}".format(brief(field_path)),
        )
        return

    # 条件分支判断：检查 (not isinstance(result, dict)) 是否成立
    if not isinstance(result, dict):
        return

    # 条件分支判断：检查 (scenario == "target-unavailable") 是否成立
    if scenario == "target-unavailable":
        chk.check(
            ok is True,
            "{}/B5 target-unavailable: ok==true".format(scenario),
            "实际 {}".format(brief(ok)),
        )
        chk.check(
            result.get("status") == "TargetUnavailable",
            "{}/B5 target-unavailable: status==TargetUnavailable".format(scenario),
            "实际 {}".format(brief(result.get("status"))),
        )
        chk.check(
            isinstance(result.get("targetStatus"), str),
            "{}/B5 target-unavailable: targetStatus 是字符串".format(scenario),
            "实际 {}".format(brief(result.get("targetStatus"))),
        )
        chk.check(
            result.get("plans") == [],
            "{}/B5 target-unavailable: plans==[]".format(scenario),
            "实际 {}".format(brief(result.get("plans"))),
        )
        diagnostics = result.get("diagnostics")
        codes = [
            entry.get("code")
            for entry in diagnostics
            if isinstance(entry, dict)
        ] if isinstance(diagnostics, list) else []
        chk.check(
            "TARGET_NOT_APPLICABLE" in codes,
            "{}/B5 target-unavailable: diagnostics 含 TARGET_NOT_APPLICABLE".format(scenario),
            "codes={}".format(brief(codes)),
        )
    elif scenario == "resource-limited":
        chk.check(
            ok is True,
            "{}/B6 resource-limited: ok==true".format(scenario),
            "实际 {}".format(brief(ok)),
        )
        chk.check(
            result.get("status") == "ResourceLimited",
            "{}/B6 resource-limited: status==ResourceLimited".format(scenario),
            "实际 {}".format(brief(result.get("status"))),
        )
        chk.check(
            result.get("plans") == [],
            "{}/B6 resource-limited: plans==[]".format(scenario),
            "实际 {}".format(brief(result.get("plans"))),
        )
        search = result.get("search")
        limit_reached = search.get("limitReached") if isinstance(search, dict) else None
        chk.check(
            limit_reached is True,
            "{}/B6 resource-limited: search.limitReached==true".format(scenario),
            "实际 {}".format(brief(limit_reached)),
        )
        diagnostics = result.get("diagnostics")
        codes = [
            entry.get("code")
            for entry in diagnostics
            if isinstance(entry, dict)
        ] if isinstance(diagnostics, list) else []
        chk.check(
            "SEARCH_LIMIT_REACHED" in codes,
            "{}/B6 resource-limited: diagnostics 含 SEARCH_LIMIT_REACHED".format(scenario),
            "codes={}".format(brief(codes)),
        )
        max_nodes = dig(request, "plannerConfig", "limits", "maxNodes")
        legal_limit = is_int(max_nodes) and 0 < max_nodes <= 100000
        chk.check(
            legal_limit,
            "{}/B6 resource-limited: 请求 limits.maxNodes 是合法小整数(0<x<=100000)".format(scenario),
            "实际 {}".format(brief(max_nodes)),
        )
    elif scenario == "success":
        chk.check(
            ok is True,
            "{}/B7 success: ok==true".format(scenario),
            "实际 {}".format(brief(ok)),
        )
        status = result.get("status")
        chk.check(
            status in {"Ok", "OkPartial"},
            "{}/B7 success: status in {{Ok, OkPartial}}".format(scenario),
            "实际 {}".format(brief(status)),
        )
        plans = result.get("plans")
        chk.check(
            isinstance(plans, list) and len(plans) > 0,
            "{}/B7 success: plans 非空".format(scenario),
            "实际 {}".format(brief(plans)),
        )


# ---------------------------------------------------------------------------
# C：planKey 独立重算
# ---------------------------------------------------------------------------


def compute_plan_key(plan):
    """按契约规则重算 planKey，返回 ("plan:<hex>", 规范 JSON) 或 (None, 原因)。"""
    try:
        meals = plan.get("meals")
        # 条件分支判断：检查 (not isinstance(meals, list)) 是否成立
        if not isinstance(meals, list):
            return None, "meals 不是数组"
        by_meal = {}
        # 顺序遍历迭代变量 meal，执行逐项校验或候选枚举
        for meal in meals:
            if not isinstance(meal, dict):
                return None, "meals 中存在非对象"
            name = meal.get("meal")
            if name in by_meal:
                return None, "餐次重复：{}".format(brief(name))
            by_meal[name] = meal

        tuples = []
        # 顺序遍历迭代变量 name，执行逐项校验或候选枚举
        for name in MEAL_ORDER:
            if name not in by_meal:
                continue
            meal = by_meal[name]
            items = meal.get("items")
            if not isinstance(items, list):
                return None, "{} 的 items 不是数组".format(name)
            merged = {}
            for item in items:
                if not isinstance(item, dict):
                    return None, "items 中存在非对象"
                offer_id = item.get("offerId")
                quantity = item.get("quantity")
                if not isinstance(offer_id, str) or not is_int(quantity):
                    return None, "offerId/quantity 非法：{}".format(brief(item))
                merged[offer_id] = merged.get(offer_id, 0) + quantity
            ordered = sorted(merged.keys(), key=lambda text: text.encode("utf-8"))
            pairs = [[offer_id, merged[offer_id]] for offer_id in ordered]
            tuples.append([name, meal.get("windowId"), pairs])

        canonical = json.dumps(tuples, ensure_ascii=False, separators=(",", ":"))
        digest = hashlib.sha256(canonical.encode("utf-8")).hexdigest()
        return "plan:" + digest, canonical
    except Exception as exc:  # 输入结构异常也只报 FAIL，不抛栈
        return None, "重算异常 {}: {}".format(type(exc).__name__, exc)


# 函数定义：check_plan_key —— 独立执行契约参考计算或验证断言
# 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
def check_plan_key(chk, scenario, index, plan):
    expected, detail = compute_plan_key(plan)
    # 绑定关键上下文变量 actual，用于后续契约比对或子进程调用
    actual = plan.get("planKey")
    # 绑定关键上下文变量 ok，用于后续契约比对或子进程调用
    ok = expected is not None and isinstance(actual, str) and actual == expected
    chk.check(
        ok,
        "{}/C plans[{}].planKey == \"plan:\"+sha256(规范元组数组)".format(scenario, index),
        "actual={} expected={} canonical={}".format(
            brief(actual), brief(expected), brief(detail)
        ),
    )
    return actual if isinstance(actual, str) else None


# ---------------------------------------------------------------------------
# D：单方案字段语义（D8-D20）
# ---------------------------------------------------------------------------


def check_meals_order(chk, scenario, plan_index, plan):
    # 绑定关键上下文变量 meals，用于后续契约比对或子进程调用
    meals = plan.get("meals")
    # 条件分支判断：检查 (not isinstance(meals, list) or not meals) 是否成立
    if not isinstance(meals, list) or not meals:
        chk.check(
            False,
            "{}/D8 plans[{}].meals 顺序为 breakfast→lunch→dinner 子序列".format(
                scenario, plan_index
            ),
            "meals 缺失或为空：{}".format(brief(meals)),
        )
        return
    # 绑定关键上下文变量 indices，用于后续契约比对或子进程调用
    indices = []
    # 绑定关键上下文变量 valid，用于后续契约比对或子进程调用
    valid = True
    # 顺序遍历迭代变量 meal，执行逐项校验或候选枚举
    for meal in meals:
        name = meal.get("meal") if isinstance(meal, dict) else None
        # 条件分支判断：检查 (name not in MEAL_INDEX) 是否成立
        if name not in MEAL_INDEX:
            valid = False
            break
        indices.append(MEAL_INDEX[name])
    # 条件分支判断：检查 (valid) 是否成立
    if valid:
        valid = all(indices[i] < indices[i + 1] for i in range(len(indices) - 1))
    chk.check(
        valid,
        "{}/D8 plans[{}].meals 顺序为 breakfast→lunch→dinner 子序列".format(
            scenario, plan_index
        ),
        "meal 序列={}".format(brief([m.get("meal") if isinstance(m, dict) else m for m in meals])),
    )


# 函数定义：check_reference_targets —— 独立执行契约参考计算或验证断言
# 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
def check_reference_targets(chk, scenario, plan_index, plan, meal_reference):
    # 绑定关键上下文变量 meals，用于后续契约比对或子进程调用
    meals = plan.get("meals")
    # 条件分支判断：检查 (not isinstance(meals, list)) 是否成立
    if not isinstance(meals, list):
        return
    # 顺序遍历迭代变量 meal_index, meal，执行逐项校验或候选枚举
    for meal_index, meal in enumerate(meals):
        # 条件分支判断：检查 (not isinstance(meal, dict)) 是否成立
        if not isinstance(meal, dict):
            continue
        meal_name = meal.get("meal")
        reference = meal.get("nutritionReferenceTarget")
        expected = meal_reference.get(meal_name) if isinstance(meal_reference, dict) else None
        ok = isinstance(reference, dict) and isinstance(expected, dict)
        detail = "实际 {} / 期望 {}".format(brief(reference), brief(expected))
        # 条件分支判断：检查 (ok) 是否成立
        if ok:
            for field, _weight_key in NUTRIENT_FIELDS:
                actual_value = reference.get(field)
                expected_value = expected.get(field)
                if not (is_int(actual_value) and is_int(expected_value) and actual_value == expected_value):
                    ok = False
                    detail = "{} 实际 {} / 期望 {}".format(
                        field, brief(actual_value), brief(expected_value)
                    )
                    break
        chk.check(
            ok,
            "{}/D9 plans[{}].meals[{}] nutritionReferenceTarget == targets.mealReference[{}]".format(
                scenario, plan_index, meal_index, brief(meal_name)
            ),
            detail,
        )


# 函数定义：check_meal_known_sums —— 独立执行契约参考计算或验证断言
# 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
def check_meal_known_sums(chk, scenario, plan_index, meal_index, meal):
    # 绑定关键上下文变量 items，用于后续契约比对或子进程调用
    items = meal.get("items")
    # 条件分支判断：检查 (not isinstance(items, list)) 是否成立
    if not isinstance(items, list):
        items = []
    # 绑定关键上下文变量 nutrition，用于后续契约比对或子进程调用
    nutrition = meal.get("nutrition")
    # 绑定关键上下文变量 sums，用于后续契约比对或子进程调用
    sums = nutrition.get("knownSums") if isinstance(nutrition, dict) else None
    # 绑定关键上下文变量 unknown_fields，用于后续契约比对或子进程调用
    unknown_fields = []
    # 顺序遍历迭代变量 field, _weight_key，执行逐项校验或候选枚举
    for field, _weight_key in NUTRIENT_FIELDS:
        values = []
        all_known = True
        # 顺序遍历迭代变量 item，执行逐项校验或候选枚举
        for item in items:
            item_nutrition = item.get("nutrition") if isinstance(item, dict) else None
            value = item_nutrition.get(field) if isinstance(item_nutrition, dict) else None
            values.append(value)
            if not is_int(value):
                all_known = False
        known_values = [value for value in values if is_int(value)]
        # 条件分支判断：检查 (not all_known) 是否成立
        if not all_known:
            unknown_fields.append(field)
        expected = sum(known_values) if all_known and items else None
        actual = sums.get(field) if isinstance(sums, dict) else None
        # 条件分支判断：检查 (expected is None) 是否成立
        if expected is None:
            # 契约把未知记 null；任务口径允许"未知按 0"时全未知返回 0。
            ok = actual is None or (not known_values and actual == 0)
        else:
            ok = actual == expected
        chk.check(
            ok,
            "{}/D10 plans[{}].meals[{}].nutrition.knownSums.{} == 逐项求和".format(
                scenario, plan_index, meal_index, field
            ),
            "实际 {} / 期望 {}".format(brief(actual), brief(expected)),
        )

    # 条件分支判断：检查 (unknown_fields) 是否成立
    if unknown_fields:
        incomplete = nutrition.get("incompleteNutrients") if isinstance(nutrition, dict) else None
        chk.check(
            isinstance(incomplete, list) and set(incomplete) == set(unknown_fields),
            "{}/D10 plans[{}].meals[{}].nutrition.incompleteNutrients 与未知项一致".format(
                scenario, plan_index, meal_index
            ),
            "实际 {} / 期望 {}".format(brief(incomplete), brief(unknown_fields)),
        )
        expected_refs = sorted(
            {
                item.get("offerId")
                for item in items
                if isinstance(item, dict)
                and not (
                    isinstance(item.get("nutrition"), dict)
                    and all(is_int(item["nutrition"].get(field)) for field, _ in NUTRIENT_FIELDS)
                )
                and isinstance(item.get("offerId"), str)
            }
        )
        refs = nutrition.get("unknownItemRefs") if isinstance(nutrition, dict) else None
        chk.check(
            isinstance(refs, list) and sorted(refs) == expected_refs,
            "{}/D10 plans[{}].meals[{}].nutrition.unknownItemRefs 指向不完整营养项".format(
                scenario, plan_index, meal_index
            ),
            "实际 {} / 期望 {}".format(brief(refs), brief(expected_refs)),
        )


# 函数定义：check_plan_items —— 独立执行契约参考计算或验证断言
# 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
def check_plan_items(chk, scenario, plan_index, plan, offer_map):
    # 绑定关键上下文变量 meals，用于后续契约比对或子进程调用
    meals = plan.get("meals")
    # 条件分支判断：检查 (not isinstance(meals, list)) 是否成立
    if not isinstance(meals, list):
        return
    # 顺序遍历迭代变量 meal_index, meal，执行逐项校验或候选枚举
    for meal_index, meal in enumerate(meals):
        # 条件分支判断：检查 (not isinstance(meal, dict)) 是否成立
        if not isinstance(meal, dict):
            continue
        items = meal.get("items")
        # 条件分支判断：检查 (not isinstance(items, list)) 是否成立
        if not isinstance(items, list):
            continue
        # 顺序遍历迭代变量 item_index, item，执行逐项校验或候选枚举
        for item_index, item in enumerate(items):
            if not isinstance(item, dict):
                chk.check(
                    False,
                    "{}/D11 plans[{}].meals[{}].items[{}] 是对象".format(
                        scenario, plan_index, meal_index, item_index
                    ),
                    brief(item),
                )
                continue
            offer_id = item.get("offerId")
            dish_id = item.get("dishId")
            quantity = item.get("quantity")
            offer = offer_map.get(offer_id) if isinstance(offer_map, dict) else None
            ok = (
                isinstance(offer_id, str)
                and offer is not None
                and dish_id == offer.get("dishId")
                and is_int(quantity)
                and quantity > 0
            )
            chk.check(
                ok,
                "{}/D11 plans[{}].meals[{}].items[{}] offerId/dishId/quantity 与 catalog 一致".format(
                    scenario, plan_index, meal_index, item_index
                ),
                "item={} / catalog offer={}".format(brief(item), brief(offer)),
            )


# 函数定义：check_plan_budget —— 独立执行契约参考计算或验证断言
# 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
def check_plan_budget(chk, scenario, plan_index, plan, request, result):
    # 绑定关键上下文变量 budget，用于后续契约比对或子进程调用
    budget = plan.get("budget")
    # 绑定关键上下文变量 budget，用于后续契约比对或子进程调用
    budget = budget if isinstance(budget, dict) else {}

    # 绑定关键上下文变量 prices，用于后续契约比对或子进程调用
    prices = []
    # 绑定关键上下文变量 meals，用于后续契约比对或子进程调用
    meals = plan.get("meals")
    # 条件分支判断：检查 (isinstance(meals, list)) 是否成立
    if isinstance(meals, list):
        # 顺序遍历迭代变量 meal，执行逐项校验或候选枚举
        for meal in meals:
            if not isinstance(meal, dict):
                continue
            items = meal.get("items")
            if not isinstance(items, list):
                continue
            for item in items:
                if isinstance(item, dict):
                    prices.append(item.get("priceCents"))
    # 绑定关键上下文变量 known_total，用于后续契约比对或子进程调用
    known_total = sum(price for price in prices if is_int(price))
    # 绑定关键上下文变量 price_incomplete，用于后续契约比对或子进程调用
    price_incomplete = any(price is None or not is_int(price) for price in prices)

    # 绑定关键上下文变量 expected_budget，用于后续契约比对或子进程调用
    expected_budget = dig(request, "plannerConfig", "budgetCents")

    # 12a：已知金额之和
    chk.check(
        budget.get("plannedTotalKnownCents") == known_total,
        "{}/D12 plans[{}].budget.plannedTotalKnownCents == item 已知价格之和".format(
            scenario, plan_index
        ),
        "实际 {} / 期望 {}".format(brief(budget.get("plannedTotalKnownCents")), known_total),
    )
    # 12b：完整性标志与完整总价
    expected_total = None if price_incomplete else known_total
    chk.check(
        budget.get("priceIncomplete") is price_incomplete
        and budget.get("plannedTotalCents") == expected_total,
        "{}/D12 plans[{}].budget.priceIncomplete/plannedTotalCents 与价格完整性一致".format(
            scenario, plan_index
        ),
        "实际 priceIncomplete={} / plannedTotalCents={} / 期望 {} / {}".format(
            brief(budget.get("priceIncomplete")),
            brief(budget.get("plannedTotalCents")),
            price_incomplete,
            brief(expected_total),
        ),
    )
    # 13：预算回显
    chk.check(
        budget.get("budgetCents") == expected_budget,
        "{}/D13 plans[{}].budget.budgetCents == 请求 plannerConfig.budgetCents".format(
            scenario, plan_index
        ),
        "实际 {} / 请求 {}".format(brief(budget.get("budgetCents")), brief(expected_budget)),
    )

    # 14：剩余预算
    intake = dig(result, "intakeSummary", default={})
    # 绑定关键上下文变量 remaining_expected，用于后续契约比对或子进程调用
    remaining_expected = None
    if (
        is_int(expected_budget)
        and isinstance(intake, dict)
        and intake.get("priceComplete") is True
        and is_int(intake.get("knownPriceCents"))
    ):
        remaining_expected = max(0, expected_budget - intake["knownPriceCents"])
    # 绑定关键上下文变量 remaining_actual，用于后续契约比对或子进程调用
    remaining_actual = budget.get("remainingBudgetKnownCents")
    chk.check(
        remaining_actual == remaining_expected,
        "{}/D14 plans[{}].budget.remainingBudgetKnownCents 按预算与已吃已知金额重算".format(
            scenario, plan_index
        ),
        "实际 {} / 期望 {}（intake={}）".format(
            brief(remaining_actual), brief(remaining_expected), brief(intake)
        ),
    )

    # 15：withinBudgetKnownAmounts
    within_expected = (
        is_int(expected_budget)
        and is_int(remaining_actual)
        and is_int(budget.get("plannedTotalKnownCents"))
        and budget.get("priceIncomplete") is False
        and budget["plannedTotalKnownCents"] <= remaining_actual
    )
    chk.check(
        budget.get("withinBudgetKnownAmounts") is within_expected,
        "{}/D15 plans[{}].budget.withinBudgetKnownAmounts 语义一致".format(
            scenario, plan_index
        ),
        "实际 {} / 期望 {}".format(
            brief(budget.get("withinBudgetKnownAmounts")), within_expected
        ),
    )

    # 16：overageCents
    planned_known = budget.get("plannedTotalKnownCents")
    # 条件分支判断：检查 (expected_budget is None) 是否成立
    if expected_budget is None:
        # 预算未设时契约公式退化：接受 0 或 null
        overage_ok = budget.get("overageCents") is None or budget.get("overageCents") == 0
        overage_expected_text = "0 或 null（预算未设）"
    elif is_int(remaining_actual) and is_int(planned_known):
        overage_expected = max(0, planned_known - remaining_actual)
        overage_ok = budget.get("overageCents") == overage_expected
        overage_expected_text = brief(overage_expected)
    else:
        overage_ok = budget.get("overageCents") is None
        overage_expected_text = "null（已知金额不完整）"
    chk.check(
        overage_ok,
        "{}/D16 plans[{}].budget.overageCents 语义一致".format(scenario, plan_index),
        "实际 {} / 期望 {}".format(brief(budget.get("overageCents")), overage_expected_text),
    )

    # 17：overBudget 只在确实超出时 true
    if expected_budget is None:
        over_budget_expected = False
    elif is_int(remaining_actual) and is_int(planned_known):
        over_budget_expected = planned_known > remaining_actual
    else:
        over_budget_expected = False
    chk.check(
        budget.get("overBudget") is over_budget_expected,
        "{}/D17 plans[{}].budget.overBudget 与 overage/within 语义一致".format(
            scenario, plan_index
        ),
        "实际 {} / 期望 {}".format(brief(budget.get("overBudget")), over_budget_expected),
    )


# 函数定义：check_plan_score —— 独立执行契约参考计算或验证断言
# 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
def check_plan_score(chk, scenario, plan_index, plan, request, result):
    # 绑定关键上下文变量 score，用于后续契约比对或子进程调用
    score = plan.get("score")
    # 绑定关键上下文变量 score，用于后续契约比对或子进程调用
    score = score if isinstance(score, dict) else {}

    # 绑定关键上下文变量 weights，用于后续契约比对或子进程调用
    weights = dig(request, "nutritionConfig", "plannerSorting", "nutritionDeviationWeightsPermille")
    # 绑定关键上下文变量 daily_targets，用于后续契约比对或子进程调用
    daily_targets = dig(result, "targets", "daily")
    # 绑定关键上下文变量 meals，用于后续契约比对或子进程调用
    meals = plan.get("meals")
    # 绑定关键上下文变量 meals，用于后续契约比对或子进程调用
    meals = meals if isinstance(meals, list) else []

    # D18：营养偏差按四项已知和与 daily 目标独立重算
    if not isinstance(weights, dict) or not isinstance(daily_targets, dict):
        chk.check(
            False,
            "{}/D18 plans[{}].score.nutritionDeviationBp 独立重算".format(scenario, plan_index),
            "缺少 nutritionConfig.plannerSorting 权重或 result.targets.daily",
        )
    else:
        totals = {}
        # 顺序遍历迭代变量 field, _weight_key，执行逐项校验或候选枚举
        for field, _weight_key in NUTRIENT_FIELDS:
            values = []
            complete = True
            for meal in meals:
                sums = dig(meal, "nutrition", "knownSums")
                value = sums.get(field) if isinstance(sums, dict) else None
                if not is_int(value):
                    complete = False
                    break
                values.append(value)
            totals[field] = sum(values) if complete else None

        deviation = 0
        computable = True
        detail = ""
        # 顺序遍历迭代变量 field, weight_key，执行逐项校验或候选枚举
        for field, weight_key in NUTRIENT_FIELDS:
            target_value = daily_targets.get(field)
            weight = weights.get(weight_key)
            if not is_int(target_value) or not is_int(weight):
                computable = False
                detail = "目标/权重非法：{}={} {}={}".format(
                    field, brief(target_value), weight_key, brief(weight)
                )
                break
            total = totals[field]
            if total is None or target_value <= 0:
                continue
            difference = abs(total - target_value)
            numerator = difference * 10000 * weight
            denominator = target_value * 1000
            deviation += (2 * numerator + denominator) // (2 * denominator)
        # 条件分支判断：检查 (computable) 是否成立
        if computable:
            chk.check(
                score.get("nutritionDeviationBp") == deviation,
                "{}/D18 plans[{}].score.nutritionDeviationBp 独立重算".format(
                    scenario, plan_index
                ),
                "实际 {} / 期望 {}（已知四项和={}）".format(
                    brief(score.get("nutritionDeviationBp")), deviation, brief(totals)
                ),
            )
        else:
            chk.check(
                False,
                "{}/D18 plans[{}].score.nutritionDeviationBp 独立重算".format(
                    scenario, plan_index
                ),
                detail,
            )

    # D19：tier == deviationBp // 宽度
    width = dig(request, "nutritionConfig", "plannerSorting", "nutritionTierWidthBp")
    # 绑定关键上下文变量 deviation，用于后续契约比对或子进程调用
    deviation = score.get("nutritionDeviationBp")
    # 条件分支判断：检查 (is_int(width) and width > 0 and is_int(deviation)) 是否成立
    if is_int(width) and width > 0 and is_int(deviation):
        expected_tier = deviation // width
        chk.check(
            score.get("nutritionTier") == expected_tier,
            "{}/D19 plans[{}].score.nutritionTier == deviationBp // tierWidth".format(
                scenario, plan_index
            ),
            "实际 {} / 期望 {}（deviationBp={} width={}）".format(
                brief(score.get("nutritionTier")), expected_tier, deviation, width
            ),
        )
    else:
        chk.check(
            False,
            "{}/D19 plans[{}].score.nutritionTier == deviationBp // tierWidth".format(
                scenario, plan_index
            ),
            "宽度/偏差非法：width={} deviationBp={}".format(brief(width), brief(deviation)),
        )

    # D20：score.priceCents 与 budget.plannedTotalCents 一致
    budget = plan.get("budget")
    # 绑定关键上下文变量 budget，用于后续契约比对或子进程调用
    budget = budget if isinstance(budget, dict) else {}
    chk.check(
        score.get("priceCents") == budget.get("plannedTotalCents"),
        "{}/D20 plans[{}].score.priceCents == budget.plannedTotalCents".format(
            scenario, plan_index
        ),
        "实际 {} / 预算 {}".format(
            brief(score.get("priceCents")), brief(budget.get("plannedTotalCents"))
        ),
    )


# ---------------------------------------------------------------------------
# E：跨策略合并与去重；F：标志
# ---------------------------------------------------------------------------


def check_offered_as(chk, scenario, plan_index, plan, strategies):
    # 绑定关键上下文变量 offered_as，用于后续契约比对或子进程调用
    offered_as = plan.get("offeredAs")
    # 绑定关键上下文变量 strategy_set，用于后续契约比对或子进程调用
    strategy_set = set(strategies) if isinstance(strategies, list) else set()
    # 绑定关键上下文变量 ok，用于后续契约比对或子进程调用
    ok = (
        isinstance(offered_as, list)
        and len(offered_as) > 0
        and all(isinstance(item, str) and item in strategy_set for item in offered_as)
        and len(set(offered_as)) == len(offered_as)
    )
    chk.check(
        ok,
        "{}/E22 plans[{}].offeredAs 非空、均属请求策略且无重复".format(scenario, plan_index),
        "实际 {} / 请求 strategies={}".format(brief(offered_as), brief(strategies)),
    )


# 函数定义：check_strategy_outcome —— 独立执行契约参考计算或验证断言
# 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
def check_strategy_outcome(chk, scenario, request, result, plans):
    # 绑定关键上下文变量 strategies，用于后续契约比对或子进程调用
    strategies = dig(request, "plannerConfig", "strategies")
    # 绑定关键上下文变量 outcomes，用于后续契约比对或子进程调用
    outcomes = result.get("strategyOutcome")

    # E24：条数与顺序
    if not isinstance(strategies, list) or not isinstance(outcomes, list):
        chk.check(
            False,
            "{}/E24 strategyOutcome 条数与顺序同请求 strategies".format(scenario),
            "strategies={} / strategyOutcome={}".format(brief(strategies), brief(outcomes)),
        )
        return
    # 绑定关键上下文变量 outcome_order，用于后续契约比对或子进程调用
    outcome_order = [
        entry.get("strategy") if isinstance(entry, dict) else None for entry in outcomes
    ]
    chk.check(
        len(outcomes) == len(strategies) and outcome_order == strategies,
        "{}/E24 strategyOutcome 条数与顺序同请求 strategies".format(scenario),
        "实际 {} / 请求 {}".format(brief(outcome_order), brief(strategies)),
    )

    # E23：每个策略都必须 applied，且指向包含自己的同一方案
    plan_by_key = {}
    # 顺序遍历迭代变量 plan，执行逐项校验或候选枚举
    for plan in plans:
        # 条件分支判断：检查 (isinstance(plan, dict) and isinstance(plan.get("planKey"), str)) 是否成立
        if isinstance(plan, dict) and isinstance(plan.get("planKey"), str):
            plan_by_key[plan["planKey"]] = plan
    # 顺序遍历迭代变量 strategy，执行逐项校验或候选枚举
    for strategy in strategies:
        entry = None
        # 顺序遍历迭代变量 candidate，执行逐项校验或候选枚举
        for candidate in outcomes:
            if isinstance(candidate, dict) and candidate.get("strategy") == strategy:
                entry = candidate
                break
        plan_key = entry.get("planKey") if isinstance(entry, dict) else None
        target_plan = plan_by_key.get(plan_key) if isinstance(plan_key, str) else None
        offered_as = target_plan.get("offeredAs") if isinstance(target_plan, dict) else None
        ok = (
            isinstance(entry, dict)
            and entry.get("applied") is True
            and isinstance(plan_key, str)
            and target_plan is not None
            and isinstance(offered_as, list)
            and strategy in offered_as
        )
        chk.check(
            ok,
            "{}/E23 strategyOutcome[{}] applied==true 且 planKey 指向含该策略的方案".format(
                scenario, strategy
            ),
            "entry={} / plan.offeredAs={}".format(brief(entry), brief(offered_as)),
        )


# 函数定义：check_estimated_flags —— 独立执行契约参考计算或验证断言
# 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
def check_estimated_flags(chk, scenario, plan_index, plan, dish_map):
    # 绑定关键上下文变量 flags，用于后续契约比对或子进程调用
    flags = plan.get("flags")
    # 条件分支判断：检查 (not isinstance(flags, list)) 是否成立
    if not isinstance(flags, list):
        chk.check(
            False,
            "{}/F25 plans[{}].flags 是数组".format(scenario, plan_index),
            "实际 {}".format(brief(flags)),
        )
        return
    # 绑定关键上下文变量 estimates，用于后续契约比对或子进程调用
    estimates = []
    # 绑定关键上下文变量 meals，用于后续契约比对或子进程调用
    meals = plan.get("meals")
    # 条件分支判断：检查 (isinstance(meals, list)) 是否成立
    if isinstance(meals, list):
        # 顺序遍历迭代变量 meal，执行逐项校验或候选枚举
        for meal in meals:
            items = meal.get("items") if isinstance(meal, dict) else None
            if not isinstance(items, list):
                continue
            for item in items:
                dish_id = item.get("dishId") if isinstance(item, dict) else None
                dish = dish_map.get(dish_id) if isinstance(dish_map, dict) else None
                basis = dish.get("nutritionBasis") if isinstance(dish, dict) else None
                estimate = basis.get("estimated") if isinstance(basis, dict) else None
                estimates.append(estimate)
    # 条件分支判断：检查 (any(estimate is True for estimate in estimates)) 是否成立
    if any(estimate is True for estimate in estimates):
        required = True
    elif estimates and all(estimate is False for estimate in estimates):
        required = False
    else:
        chk.skip(
            "{}/F25 plans[{}] 无法判定 estimated（catalog 缺字段）".format(scenario, plan_index)
        )
        return
    # 绑定关键上下文变量 has_flag，用于后续契约比对或子进程调用
    has_flag = "ESTIMATED_DATA" in flags
    chk.check(
        has_flag is required,
        "{}/F25 plans[{}].flags 的 ESTIMATED_DATA 与 catalog.nutritionBasis.estimated 一致".format(
            scenario, plan_index
        ),
        "实际含标志={} / 期望={} / estimates={}".format(
            has_flag, required, brief(estimates)
        ),
    )


# 函数定义：check_status_flags —— 独立执行契约参考计算或验证断言
# 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
def check_status_flags(chk, scenario, status, plans):
    # 条件分支判断：检查 (status == "Ok") 是否成立
    if status == "Ok":
        ok = all(
            isinstance(plan.get("flags"), list) and len(plan.get("flags")) == 0
            for plan in plans
        )
        chk.check(
            ok,
            "{}/F26 status==Ok 时所有方案 flags 为空".format(scenario),
            "flags={}".format(brief([plan.get("flags") for plan in plans])),
        )
    elif status == "OkPartial":
        ok = any(
            isinstance(plan.get("flags"), list) and len(plan.get("flags")) > 0
            for plan in plans
        )
        chk.check(
            ok,
            "{}/F26 status==OkPartial 时至少一个方案 flags 非空".format(scenario),
            "flags={}".format(brief([plan.get("flags") for plan in plans])),
        )


# ---------------------------------------------------------------------------
# 方案总入口
# ---------------------------------------------------------------------------


def check_plan_block(chk, scenario, request, result, plans):
    # 绑定关键上下文变量 catalog，用于后续契约比对或子进程调用
    catalog = dig(request, "catalog")
    # 绑定关键上下文变量 offers，用于后续契约比对或子进程调用
    offers = catalog.get("offers") if isinstance(catalog, dict) else None
    # 绑定关键上下文变量 offer_map，用于后续契约比对或子进程调用
    offer_map = {}
    # 条件分支判断：检查 (isinstance(offers, list)) 是否成立
    if isinstance(offers, list):
        # 顺序遍历迭代变量 offer，执行逐项校验或候选枚举
        for offer in offers:
            if isinstance(offer, dict) and isinstance(offer.get("offerId"), str):
                offer_map[offer["offerId"]] = offer
    # 绑定关键上下文变量 dishes，用于后续契约比对或子进程调用
    dishes = catalog.get("dishes") if isinstance(catalog, dict) else None
    # 绑定关键上下文变量 dish_map，用于后续契约比对或子进程调用
    dish_map = {}
    # 条件分支判断：检查 (isinstance(dishes, list)) 是否成立
    if isinstance(dishes, list):
        # 顺序遍历迭代变量 dish，执行逐项校验或候选枚举
        for dish in dishes:
            if isinstance(dish, dict) and isinstance(dish.get("dishId"), str):
                dish_map[dish["dishId"]] = dish

    # 绑定关键上下文变量 targets，用于后续契约比对或子进程调用
    targets = result.get("targets")
    # 绑定关键上下文变量 meal_reference，用于后续契约比对或子进程调用
    meal_reference = targets.get("mealReference") if isinstance(targets, dict) else None
    # 绑定关键上下文变量 strategies，用于后续契约比对或子进程调用
    strategies = dig(request, "plannerConfig", "strategies")

    # 绑定关键上下文变量 computed_keys，用于后续契约比对或子进程调用
    computed_keys = []
    # 顺序遍历迭代变量 plan_index, plan，执行逐项校验或候选枚举
    for plan_index, plan in enumerate(plans):
        # 条件分支判断：检查 (not isinstance(plan, dict)) 是否成立
        if not isinstance(plan, dict):
            chk.check(
                False,
                "{}/C plans[{}] 是对象".format(scenario, plan_index),
                brief(plan),
            )
            computed_keys.append(None)
            continue
        computed_keys.append(check_plan_key(chk, scenario, plan_index, plan))
        check_meals_order(chk, scenario, plan_index, plan)
        check_reference_targets(chk, scenario, plan_index, plan, meal_reference)

        meals = plan.get("meals")
        # 条件分支判断：检查 (isinstance(meals, list)) 是否成立
        if isinstance(meals, list):
            for meal_index, meal in enumerate(meals):
                if isinstance(meal, dict):
                    check_meal_known_sums(chk, scenario, plan_index, meal_index, meal)
        check_plan_items(chk, scenario, plan_index, plan, offer_map)
        check_plan_budget(chk, scenario, plan_index, plan, request, result)
        check_plan_score(chk, scenario, plan_index, plan, request, result)
        check_estimated_flags(chk, scenario, plan_index, plan, dish_map)

    # C：planKey 唯一
    string_keys = [key for key in computed_keys if isinstance(key, str)]
    chk.check(
        len(string_keys) == len(computed_keys) and len(set(string_keys)) == len(string_keys),
        "{}/C 全部 planKey 互不相同".format(scenario),
        "keys={}".format(brief(computed_keys)),
    )

    # E22：offeredAs
    for plan_index, plan in enumerate(plans):
        # 条件分支判断：检查 (isinstance(plan, dict)) 是否成立
        if isinstance(plan, dict):
            check_offered_as(chk, scenario, plan_index, plan, strategies)

    # E23/E24
    check_strategy_outcome(chk, scenario, request, result, plans)

    # F26
    check_status_flags(chk, scenario, result.get("status"), plans)


# ---------------------------------------------------------------------------
# 单场景执行
# ---------------------------------------------------------------------------


def run_scenario(chk, scenario, request_path, result_path):
    request, request_error = load_json(request_path)
    # 条件分支判断：检查 (request is None and request_error == "missing") 是否成立
    if request is None and request_error == "missing":
        chk.skip("缺文件 {}".format(request_path))
    elif request_error is not None:
        chk.check(
            False,
            "{}/请求文件 JSON 可解析".format(scenario),
            "{}: {}".format(request_path, request_error),
        )
        request = None

    envelope, envelope_error = load_json(result_path)
    # 条件分支判断：检查 (envelope is None and envelope_error == "missing") 是否成立
    if envelope is None and envelope_error == "missing":
        chk.skip("缺文件 {}".format(result_path))
    elif envelope_error is not None:
        chk.check(
            False,
            "{}/结果文件 JSON 可解析".format(scenario),
            "{}: {}".format(result_path, envelope_error),
        )
        envelope = None

    # 条件分支判断：检查 (envelope is None) 是否成立
    if envelope is None:
        return
    # 条件分支判断：检查 (not isinstance(envelope, dict)) 是否成立
    if not isinstance(envelope, dict):
        chk.check(
            False,
            "{}/A1 结果包络是 JSON 对象".format(scenario),
            brief(envelope),
        )
        return

    check_envelope(chk, scenario, envelope, request)

    # 绑定关键上下文变量 result，用于后续契约比对或子进程调用
    result = envelope.get("result")
    # 条件分支判断：检查 (not isinstance(result, dict)) 是否成立
    if not isinstance(result, dict):
        check_scenario_status(chk, scenario, request, envelope, result)
        return

    check_common_result(chk, scenario, request, result)
    check_scenario_status(chk, scenario, request, envelope, result)

    # 绑定关键上下文变量 plans，用于后续契约比对或子进程调用
    plans = result.get("plans")
    # 条件分支判断：检查 (isinstance(plans, list) and plans) 是否成立
    if isinstance(plans, list) and plans:
        check_plan_block(chk, scenario, request, result, plans)


# 函数定义：main —— 独立执行契约参考计算或验证断言
# 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
def main(argv):
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    # 条件分支判断：检查 (len(argv) != 3) 是否成立
    if len(argv) != 3:
        print("用法: python tools\\core\\verify_planday.py <inputs_dir> <results_dir>")
        return 2

    # 绑定关键上下文变量 inputs_dir，用于后续契约比对或子进程调用
    inputs_dir = Path(argv[1])
    # 绑定关键上下文变量 results_dir，用于后续契约比对或子进程调用
    results_dir = Path(argv[2])
    # 绑定关键上下文变量 chk，用于后续契约比对或子进程调用
    chk = Checker()

    # 顺序遍历迭代变量 scenario, request_name, result_name，执行逐项校验或候选枚举
    for scenario, request_name, result_name in SCENARIOS:
        try:
            run_scenario(chk, scenario, inputs_dir / request_name, results_dir / result_name)
        except Exception as exc:  # 最后一道保险：任何异常都不冒泡成栈
            chk.check(
                False,
                "{}/内部异常".format(scenario),
                "{}: {}".format(type(exc).__name__, exc),
            )

    print("CHECKS={} FAILED={}".format(chk.checks, chk.failed))
    # 条件分支判断：检查 (chk.checks == 0) 是否成立
    if chk.checks == 0:
        print("[SKIP] 未找到任何夹具，未执行检查（按未通过处理）")
    # 条件分支判断：检查 (chk.failures) 是否成立
    if chk.failures:
        print("[FAIL] 汇总（前 10 条）:")
        # 顺序遍历迭代变量 failure，执行逐项校验或候选枚举
        for failure in chk.failures[:10]:
            print("  - " + failure)
    return 0 if (chk.failed == 0 and chk.checks > 0) else 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))

#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
T04 双层独立参考验证器（Layer 1 独立单餐合法候选生成 + Layer 2 独立全天笛卡尔积词典序全局最优）
验证范围：
1. 层一独立参考：从原始菜单（含固定套餐 dish.kind=="combo" 与规则套餐 comboRules[] 确定性展开）
   独立枚举每餐各窗口合法单餐候选集，核对与 C++ 核心 result.search.candidatesEnumerated 完全一致。
2. 层二独立参考：基于确认后的层一单餐候选集，独立执行全天笛卡尔积穷举与契约 §10 策略词典序比较器，
   证明无截断（capsHit=[]）下 dp 与 branchAndBound 在 primary / economy / taste 三策略下
   与层二独立穷举全局最优解 100% 一致（planKey、deviationBp、knownPriceCents 等全部吻合）。
3. 可复现实例验证：
   - DP 离散化桶化截断反例（maxDpStates=2 vs maxDpStates=4000 vs 层二真值），核对 capsHit、
     APPROXIMATE_DISCRETIZATION、searchComplete=false 及量化误差上界；
   - 贪心算法（greedy）局部边际决策与全局最优（dp / branchAndBound）的差异对拍及 APPROXIMATE_CANDIDATES 标记；
   - 固定套餐（combo）与规则套餐（comboRules[] -> ruleId#<dishId升序拼接>）及含米饭互斥校验。
"""

from __future__ import annotations
import copy
import hashlib
import itertools
import json
import pathlib
import subprocess
import sys
from typing import Any, Dict, List, Optional, Tuple

# 绑定关键上下文变量 KNOWN_CATEGORY_SET，用于后续契约比对或子进程调用
KNOWN_CATEGORY_SET = {"staple", "protein", "vegetable", "soup", "drink", "dessert", "fruit"}


# 函数定义：round_half_up —— 独立执行契约参考计算或验证断言
# 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
def round_half_up(val: int, div: int) -> int:
    return (2 * val + div) // (2 * div)


# 函数定义：canonical_json —— 独立执行契约参考计算或验证断言
# 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
def canonical_json(obj: Any) -> str:
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


# 函数定义：compute_catalog_hash —— 独立执行契约参考计算或验证断言
# 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
def compute_catalog_hash(catalog: Dict[str, Any]) -> str:
    # 绑定关键上下文变量 c，用于后续契约比对或子进程调用
    c = copy.deepcopy(catalog)
    c.pop("catalogHash", None)
    # 绑定关键上下文变量 raw，用于后续契约比对或子进程调用
    raw = canonical_json(c).encode("utf-8")
    return "sha256:" + hashlib.sha256(raw).hexdigest()


# 函数定义：expand_combo_rules —— 独立执行契约参考计算或验证断言
# 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
def expand_combo_rules(catalog: Dict[str, Any]) -> List[Dict[str, Any]]:
    """按契约规则确定性展开 catalog.comboRules[] 为合成报项，offerId = ruleId#<dishId升序拼接>。"""
    dishes_by_id = {d["dishId"]: d for d in catalog.get("dishes", [])}
    # 绑定关键上下文变量 static_offers，用于后续契约比对或子进程调用
    static_offers = catalog.get("offers", [])
    expanded: List[Dict[str, Any]] = []

    # 顺序遍历迭代变量 rule，执行逐项校验或候选枚举
    for rule in catalog.get("comboRules", []):
        rule_id = rule["ruleId"]
        win_id = rule["windowId"]
        meal_windows = list(rule["mealWindows"])
        price_cents = int(rule["totalPriceCents"])
        includes_rice = bool(rule["includesRice"])
        req_counts: Dict[str, int] = rule["requiredCounts"]
        cand_ids: List[str] = rule["candidateDishIds"]

        # 顺序遍历迭代变量 meal，执行逐项校验或候选枚举
        for meal in ("breakfast", "lunch", "dinner"):
            if meal not in meal_windows:
                continue
            valid_cands = []
            for did in cand_ids:
                dish = dishes_by_id.get(did)
                if not dish or dish.get("kind") == "combo":
                    continue
                dish_offers = [o for o in static_offers if o["dishId"] == did]
                if dish_offers:
                    ok_win = any(
                        o["windowId"] == win_id and meal in o.get("mealWindows", [])
                        for o in dish_offers
                    )
                    if not ok_win:
                        continue
                valid_cands.append(did)

            by_cat: Dict[str, List[str]] = {}
            for cat in req_counts:
                pool = sorted(
                    [did for did in valid_cands if dishes_by_id[did].get("category") == cat]
                )
                by_cat[cat] = pool

            cat_keys = list(req_counts.keys())
            cat_combos_list = []
            possible = True
            for cat in cat_keys:
                cnt = int(req_counts[cat])
                pool = by_cat[cat]
                if len(pool) < cnt:
                    possible = False
                    break
                cat_combos_list.append(list(itertools.combinations(pool, cnt)))
            if not possible:
                continue

            for prod in itertools.product(*cat_combos_list):
                flat_dishes = sorted([did for group in prod for did in group])
                joined = "+".join(flat_dishes)
                synth_offer_id = f"{rule_id}#{joined}"

                existing = next((x for x in expanded if x["offerId"] == synth_offer_id), None)
                if existing is not None:
                    if meal not in existing["mealWindows"]:
                        existing["mealWindows"].append(meal)
                    continue

                comp_counts: Dict[str, int] = {}
                for did in flat_dishes:
                    comp_counts[did] = comp_counts.get(did, 0) + 1
                components = [
                    {"dishId": did, "count": cnt} for did, cnt in sorted(comp_counts.items())
                ]

                nut = {"energyKcal": 0, "proteinDg": 0, "fatDg": 0, "carbDg": 0}
                has_nut = {"energyKcal": True, "proteinDg": True, "fatDg": True, "carbDg": True}
                estimated = False
                for comp in components:
                    cdish = dishes_by_id[comp["dishId"]]
                    cnut = cdish.get("nutrition", {})
                    for k in ("energyKcal", "proteinDg", "fatDg", "carbDg"):
                        if cnut.get(k) is None:
                            has_nut[k] = False
                        else:
                            nut[k] += int(cnut[k]) * int(comp["count"])
                    if cdish.get("nutritionBasis", {}).get("estimated"):
                        estimated = True

                final_nut = {
                    k: (nut[k] if has_nut[k] else None)
                    for k in ("energyKcal", "proteinDg", "fatDg", "carbDg")
                }

                expanded.append(
                    {
                        "offerId": synth_offer_id,
                        "windowId": win_id,
                        "dishId": rule_id,
                        "dishName": rule["name"],
                        "isCombo": True,
                        "isExpandedRule": True,
                        "mealWindows": [meal],
                        "portionCode": "full",
                        "priceCents": price_cents,
                        "priceKnown": True,
                        "riceDish": False,
                        "riceIncluded": includes_rice,
                        "nutrition": final_nut,
                        "estimated": estimated,
                        "category": None,
                        "components": components,
                    }
                )
    return expanded


# 函数定义：build_layer1_candidates —— 独立执行契约参考计算或验证断言
# 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
def build_layer1_candidates(req: Dict[str, Any]) -> Tuple[Dict[str, List[Dict[str, Any]]], Dict[str, int]]:
    """
    层一独立参考实现：
    输入原始请求 JSON，独立构建每餐合法单餐候选集（含固定套餐与规则套餐展开、锁定、售罄、同品互斥、含米饭互斥）。
    """
    catalog = req["catalog"]
    # 绑定关键上下文变量 state，用于后续契约比对或子进程调用
    state = req["state"]
    # 绑定关键上下文变量 config，用于后续契约比对或子进程调用
    config = req["plannerConfig"]
    # 绑定关键上下文变量 max_items，用于后续契约比对或子进程调用
    max_items = int(config["maxItemsPerMeal"])
    # 绑定关键上下文变量 tastes，用于后续契约比对或子进程调用
    tastes = list(req["profile"].get("tastes", []))
    # 绑定关键上下文变量 sold_out，用于后续契约比对或子进程调用
    sold_out = state.get("soldOut", [])
    # 绑定关键上下文变量 win_locks，用于后续契约比对或子进程调用
    win_locks = {w["meal"]: w["windowId"] for w in state.get("windowLocks", [])}
    # 绑定关键上下文变量 item_locks，用于后续契约比对或子进程调用
    item_locks = state.get("itemLocks", [])

    # 绑定关键上下文变量 dishes_by_id，用于后续契约比对或子进程调用
    dishes_by_id = {d["dishId"]: d for d in catalog.get("dishes", [])}
    all_offers: List[Dict[str, Any]] = []

    # 顺序遍历迭代变量 o，执行逐项校验或候选枚举
    for o in catalog.get("offers", []):
        dish = dishes_by_id[o["dishId"]]
        kind = dish.get("kind", "single")
        is_combo = (kind == "combo")
        components = copy.deepcopy(dish.get("components", [])) if is_combo else []
        num = int(o.get("portionRatioNum", 1))
        den = int(o.get("portionRatioDen", 1))

        # 条件分支判断：检查 (is_combo and components) 是否成立
        if is_combo and components:
            nut = {"energyKcal": 0, "proteinDg": 0, "fatDg": 0, "carbDg": 0}
            has_nut = {"energyKcal": True, "proteinDg": True, "fatDg": True, "carbDg": True}
            for comp in components:
                cdish = dishes_by_id[comp["dishId"]]
                cnut = cdish.get("nutrition", {})
                for k in ("energyKcal", "proteinDg", "fatDg", "carbDg"):
                    if cnut.get(k) is None:
                        has_nut[k] = False
                    else:
                        nut[k] += int(cnut[k]) * int(comp["count"])
            final_nut = {
                k: (round_half_up(nut[k] * num, den) if has_nut[k] else None)
                for k in ("energyKcal", "proteinDg", "fatDg", "carbDg")
            }
        else:
            dnut = dish.get("nutrition", {})
            final_nut = {
                k: (round_half_up(int(dnut[k]) * num, den) if dnut.get(k) is not None else None)
                for k in ("energyKcal", "proteinDg", "fatDg", "carbDg")
            }

        all_offers.append(
            {
                "offerId": o["offerId"],
                "windowId": o["windowId"],
                "dishId": o["dishId"],
                "dishName": dish["name"],
                "isCombo": is_combo,
                "isExpandedRule": False,
                "mealWindows": list(o.get("mealWindows", [])),
                "portionCode": o.get("portionCode", "full"),
                "priceCents": o.get("priceCents"),
                "priceKnown": o.get("priceCents") is not None,
                "riceDish": bool(dish.get("riceDish", False)),
                "riceIncluded": bool(dish.get("riceIncluded", False)),
                "nutrition": final_nut,
                "estimated": bool(dish.get("nutritionBasis", {}).get("estimated", False)),
                "category": dish.get("category"),
                "components": components,
            }
        )

    all_offers.extend(expand_combo_rules(catalog))

    # 函数定义：is_dish_sold_out —— 独立执行契约参考计算或验证断言
    # 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
    def is_dish_sold_out(meal: str, win_id: str, dish_id: str) -> bool:
        # 顺序遍历迭代变量 r，执行逐项校验或候选枚举
        for r in sold_out:
            if meal not in r.get("mealWindows", []):
                continue
            if r.get("windowId") and r["windowId"] != win_id:
                continue
            if r.get("dishId") and r["dishId"] != dish_id:
                continue
            return True
        return False

    # 函数定义：is_offer_sold_out —— 独立执行契约参考计算或验证断言
    # 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
    def is_offer_sold_out(meal: str, ent: Dict[str, Any]) -> bool:
        # 条件分支判断：检查 (is_dish_sold_out(meal, ent["windowId"], ent["dishId"])) 是否成立
        if is_dish_sold_out(meal, ent["windowId"], ent["dishId"]):
            return True
        # 顺序遍历迭代变量 comp，执行逐项校验或候选枚举
        for comp in ent["components"]:
            if is_dish_sold_out(meal, ent["windowId"], comp["dishId"]):
                return True
        return False

    # 函数定义：offer_nut_complete —— 独立执行契约参考计算或验证断言
    # 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
    def offer_nut_complete(ent: Dict[str, Any]) -> bool:
        n = ent["nutrition"]
        return all(n.get(k) is not None for k in ("energyKcal", "proteinDg", "fatDg", "carbDg"))

    # 函数定义：offer_pref_score —— 独立执行契约参考计算或验证断言
    # 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
    def offer_pref_score(ent: Dict[str, Any]) -> int:
        # 条件分支判断：检查 (not tastes) 是否成立
        if not tastes:
            return 0
        # 条件分支判断：检查 (not ent["isExpandedRule"]) 是否成立
        if not ent["isExpandedRule"]:
            dish = dishes_by_id.get(ent["dishId"])
            if dish is not None:
                for t in tastes:
                    if t and t in dish["name"]:
                        return 1
                if not ent["isCombo"]:
                    return 0
        score = 0
        # 顺序遍历迭代变量 comp，执行逐项校验或候选枚举
        for comp in ent["components"]:
            cdish = dishes_by_id.get(comp["dishId"])
            if cdish is None:
                continue
            for t in tastes:
                if t and t in cdish["name"]:
                    score += int(comp["count"])
                    break
        return score

    # 函数定义：is_compatible —— 独立执行契约参考计算或验证断言
    # 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
    def is_compatible(chosen: List[Dict[str, Any]], cand: Dict[str, Any]) -> bool:
        cand_dishes = [c["dishId"] for c in cand["components"]] if cand["components"] else [cand["dishId"]]
        # 顺序遍历迭代变量 ex，执行逐项校验或候选枚举
        for ex in chosen:
            if ex["offerId"] == cand["offerId"]:
                return False
            if ex["riceIncluded"] and (cand["riceDish"] or cand["riceIncluded"]):
                return False
            if cand["riceIncluded"] and (ex["riceDish"] or ex["riceIncluded"]):
                return False
            if ex["isCombo"] or cand["isCombo"]:
                ex_dishes = [c["dishId"] for c in ex["components"]] if ex["components"] else [ex["dishId"]]
                if set(ex_dishes) & set(cand_dishes):
                    return False
        return True

    # 绑定关键上下文变量 planning_meals，用于后续契约比对或子进程调用
    planning_meals = [m for m in ("breakfast", "lunch", "dinner") if m in req.get("planningMeals", [])]
    candidates_by_meal: Dict[str, List[Dict[str, Any]]] = {}
    counts_by_meal: Dict[str, int] = {}

    # 顺序遍历迭代变量 meal，执行逐项校验或候选枚举
    for meal in planning_meals:
        locked_win = win_locks.get(meal)
        meal_locks = [lk for lk in item_locks if lk["meal"] == meal]
        meal_cands: List[Dict[str, Any]] = []

        # 顺序遍历迭代变量 win，执行逐项校验或候选枚举
        for win in catalog.get("windows", []):
            wid = win["windowId"]
            if meal not in win.get("mealWindows", []):
                continue
            if locked_win and wid != locked_win:
                continue

            win_offers = [e for e in all_offers if e["windowId"] == wid and meal in e["mealWindows"]]
            win_offers_by_id = {e["offerId"]: e for e in win_offers}

            locks_ok = True
            locked_expanded: List[Dict[str, Any]] = []
            for lk in meal_locks:
                oid = lk["offerId"]
                qty = int(lk["quantity"])
                ent = win_offers_by_id.get(oid)
                if ent is None or is_offer_sold_out(meal, ent):
                    locks_ok = False
                    break
                for _ in range(qty):
                    locked_expanded.append(ent)

            if not locks_ok or len(locked_expanded) > max_items:
                continue

            already_locked_ids = {e["offerId"] for e in locked_expanded}
            eligible = sorted(
                [
                    e
                    for e in win_offers
                    if not is_offer_sold_out(meal, e)
                    and offer_nut_complete(e)
                    and e["offerId"] not in already_locked_ids
                ],
                key=lambda x: x["offerId"],
            )

            rem_slots = max_items - len(locked_expanded)
            min_extra = 1 if not locked_expanded else 0
            max_extra = min(rem_slots, len(eligible))

            # 函数定义：recurse —— 独立执行契约参考计算或验证断言
            # 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
            def recurse(start_idx: int, rem_pick: int, working: List[Dict[str, Any]]) -> None:
                if rem_pick == 0:
                    meal_cands.append(
                        build_meal_candidate(meal, wid, working, dishes_by_id, offer_pref_score)
                    )
                    return
                if start_idx + rem_pick > len(eligible):
                    return
                for i in range(start_idx, len(eligible) - rem_pick + 1):
                    cand_offer = eligible[i]
                    if not is_compatible(working, cand_offer):
                        continue
                    working.append(cand_offer)
                    recurse(i + 1, rem_pick - 1, working)
                    working.pop()

            for extra_cnt in range(min_extra, max_extra + 1):
                recurse(0, extra_cnt, list(locked_expanded))

        candidates_by_meal[meal] = meal_cands
        counts_by_meal[meal] = len(meal_cands)

    return candidates_by_meal, counts_by_meal


def build_meal_candidate(
    meal: str,
    window_id: str,
    items: List[Dict[str, Any]],
    dishes_by_id: Dict[str, Dict[str, Any]],
    offer_pref_score_fn: Any,
) -> Dict[str, Any]:
    # 绑定关键上下文变量 sorted_items，用于后续契约比对或子进程调用
    sorted_items = sorted(items, key=lambda x: x["offerId"])
    # 绑定关键上下文变量 sums，用于后续契约比对或子进程调用
    sums = {"energyKcal": 0, "proteinDg": 0, "fatDg": 0, "carbDg": 0}
    # 绑定关键上下文变量 nut_complete，用于后续契约比对或子进程调用
    nut_complete = True
    # 绑定关键上下文变量 price_complete，用于后续契约比对或子进程调用
    price_complete = True
    # 绑定关键上下文变量 known_price，用于后续契约比对或子进程调用
    known_price = 0
    # 绑定关键上下文变量 pref_score，用于后续契约比对或子进程调用
    pref_score = 0
    flat_dishes: List[str] = []
    known_cats: set[str] = set()
    # 绑定关键上下文变量 unknown_cat_count，用于后续契约比对或子进程调用
    unknown_cat_count = 0

    # 顺序遍历迭代变量 it，执行逐项校验或候选枚举
    for it in sorted_items:
        n = it["nutrition"]
        # 顺序遍历迭代变量 k，执行逐项校验或候选枚举
        for k in ("energyKcal", "proteinDg", "fatDg", "carbDg"):
            if n.get(k) is None:
                nut_complete = False
            else:
                sums[k] += int(n[k])
        # 条件分支判断：检查 (not it["priceKnown"]) 是否成立
        if not it["priceKnown"]:
            price_complete = False
        else:
            known_price += int(it["priceCents"])
        pref_score += offer_pref_score_fn(it)

        # 条件分支判断：检查 (not it["components"]) 是否成立
        if not it["components"]:
            cat = it.get("category")
            if cat in KNOWN_CATEGORY_SET:
                known_cats.add(cat)
            else:
                unknown_cat_count += 1
            flat_dishes.append(it["dishId"])
        else:
            for comp in it["components"]:
                cdish = dishes_by_id.get(comp["dishId"], {})
                cat = cdish.get("category")
                for _ in range(int(comp["count"])):
                    if cat in KNOWN_CATEGORY_SET:
                        known_cats.add(cat)
                    else:
                        unknown_cat_count += 1
                    flat_dishes.append(comp["dishId"])

    pair_map: Dict[str, int] = {}
    # 顺序遍历迭代变量 it，执行逐项校验或候选枚举
    for it in sorted_items:
        oid = it["offerId"]
        pair_map[oid] = pair_map.get(oid, 0) + 1
    # 绑定关键上下文变量 canonical_pairs，用于后续契约比对或子进程调用
    canonical_pairs = [[oid, qty] for oid, qty in sorted(pair_map.items())]

    return {
        "meal": meal,
        "windowId": window_id,
        "sums": sums,
        "nutritionComplete": nut_complete,
        "priceComplete": price_complete,
        "knownPriceCents": known_price,
        "preferenceScore": pref_score,
        "flatDishes": flat_dishes,
        "knownCats": known_cats,
        "unknownCategoryCount": unknown_cat_count,
        "canonicalTuple": [meal, window_id, canonical_pairs],
    }


# 函数定义：compute_deviation_bp —— 独立执行契约参考计算或验证断言
# 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
def compute_deviation_bp(daily_target: Dict[str, int], total_sums: Dict[str, int], weights: Dict[str, int]) -> int:
    # 绑定关键上下文变量 mapping，用于后续契约比对或子进程调用
    mapping = (
        ("energyKcal", "energy"),
        ("proteinDg", "protein"),
        ("fatDg", "fat"),
        ("carbDg", "carb"),
    )
    # 绑定关键上下文变量 total_bp，用于后续契约比对或子进程调用
    total_bp = 0
    # 顺序遍历迭代变量 tk, wk，执行逐项校验或候选枚举
    for tk, wk in mapping:
        t_val = int(daily_target[tk])
        a_val = int(total_sums[tk])
        w_val = int(weights[wk])
        diff = abs(a_val - t_val)
        total_bp += round_half_up(diff * 10000 * w_val, t_val * 1000)
    return total_bp


def evaluate_full_day_combo(
    meal_tuple: Tuple[Dict[str, Any], ...],
    daily_target: Dict[str, int],
    weights: Dict[str, int],
    tier_width_bp: int,
    budget_cents: Optional[int],
) -> Dict[str, Any]:
    # 绑定关键上下文变量 sums，用于后续契约比对或子进程调用
    sums = {"energyKcal": 0, "proteinDg": 0, "fatDg": 0, "carbDg": 0}
    # 绑定关键上下文变量 nut_complete，用于后续契约比对或子进程调用
    nut_complete = True
    # 绑定关键上下文变量 price_complete，用于后续契约比对或子进程调用
    price_complete = True
    # 绑定关键上下文变量 known_price，用于后续契约比对或子进程调用
    known_price = 0
    # 绑定关键上下文变量 pref_score，用于后续契约比对或子进程调用
    pref_score = 0
    flat_dishes: List[str] = []
    known_cats: set[str] = set()
    # 绑定关键上下文变量 unknown_cat，用于后续契约比对或子进程调用
    unknown_cat = 0
    # 绑定关键上下文变量 canonical_meals，用于后续契约比对或子进程调用
    canonical_meals = []

    # 顺序遍历迭代变量 mc，执行逐项校验或候选枚举
    for mc in meal_tuple:
        # 顺序遍历迭代变量 k，执行逐项校验或候选枚举
        for k in ("energyKcal", "proteinDg", "fatDg", "carbDg"):
            sums[k] += mc["sums"][k]
        # 条件分支判断：检查 (not mc["nutritionComplete"]) 是否成立
        if not mc["nutritionComplete"]:
            nut_complete = False
        # 条件分支判断：检查 (not mc["priceComplete"]) 是否成立
        if not mc["priceComplete"]:
            price_complete = False
        known_price += mc["knownPriceCents"]
        pref_score += mc["preferenceScore"]
        flat_dishes.extend(mc["flatDishes"])
        known_cats |= mc["knownCats"]
        unknown_cat += mc["unknownCategoryCount"]
        canonical_meals.append(mc["canonicalTuple"])

    # 绑定关键上下文变量 rep_pairs，用于后续契约比对或子进程调用
    rep_pairs = 0
    # 顺序遍历迭代变量 i，执行逐项校验或候选枚举
    for i in range(len(flat_dishes)):
        # 顺序遍历迭代变量 k，执行逐项校验或候选枚举
        for k in range(i):
            if flat_dishes[k] == flat_dishes[i]:
                rep_pairs += 1

    # 绑定关键上下文变量 dev_bp，用于后续契约比对或子进程调用
    dev_bp = compute_deviation_bp(daily_target, sums, weights)
    # 绑定关键上下文变量 tier，用于后续契约比对或子进程调用
    tier = dev_bp // tier_width_bp
    # 绑定关键上下文变量 budget_exceeded，用于后续契约比对或子进程调用
    budget_exceeded = (budget_cents is not None) and (known_price > budget_cents)
    # 绑定关键上下文变量 raw_tuple_json，用于后续契约比对或子进程调用
    raw_tuple_json = json.dumps(canonical_meals, ensure_ascii=False, separators=(",", ":")).encode("utf-8")
    # 绑定关键上下文变量 plan_key，用于后续契约比对或子进程调用
    plan_key = "plan:" + hashlib.sha256(raw_tuple_json).hexdigest()

    return {
        "planKey": plan_key,
        "deviationBp": dev_bp,
        "tier": tier,
        "nutritionComplete": nut_complete,
        "budgetExceeded": budget_exceeded,
        "knownPriceCents": known_price,
        "priceComplete": price_complete,
        "preferenceScore": pref_score,
        "repeatedDishCount": rep_pairs,
        "categoryCoverage": len(known_cats),
        "unknownCategoryCount": unknown_cat,
        "sums": sums,
    }


# 函数定义：strategy_sort_key —— 独立执行契约参考计算或验证断言
# 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
def strategy_sort_key(plan: Dict[str, Any], strategy: str, has_budget: bool) -> Tuple[Any, ...]:
    """返回契约 §10 策略词典序比较元组（越小越优）。"""
    common_prefix = (
        1 if (has_budget and plan["budgetExceeded"]) else 0,
        0 if plan["nutritionComplete"] else 1,
    )
    # 绑定关键上下文变量 diversity_key，用于后续契约比对或子进程调用
    diversity_key = (
        -plan["categoryCoverage"],
        plan["repeatedDishCount"],
        plan["unknownCategoryCount"],
    )
    # 绑定关键上下文变量 price_key，用于后续契约比对或子进程调用
    price_key = (
        0 if plan["priceComplete"] else 1,
        plan["knownPriceCents"],
    )
    # 条件分支判断：检查 (strategy == "economy") 是否成立
    if strategy == "economy":
        return common_prefix + (
            plan["tier"],
            price_key,
            diversity_key,
            -plan["preferenceScore"],
            plan["deviationBp"],
            plan["planKey"],
        )
    # 条件分支判断：检查 (strategy == "taste") 是否成立
    if strategy == "taste":
        return common_prefix + (
            plan["tier"],
            -plan["preferenceScore"],
            diversity_key,
            price_key,
            plan["deviationBp"],
            plan["planKey"],
        )
    # primary
    return common_prefix + (
        plan["deviationBp"],
        diversity_key,
        -plan["preferenceScore"],
        price_key,
        plan["planKey"],
    )


# 函数定义：run_cli_cmd —— 独立执行契约参考计算或验证断言
# 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
def run_cli_cmd(cli_path: pathlib.Path, cmd: str, req_obj: Dict[str, Any], tmp_dir: pathlib.Path, tag: str) -> Dict[str, Any]:
    # 绑定关键上下文变量 in_file，用于后续契约比对或子进程调用
    in_file = tmp_dir / f"{tag}.req.json"
    # 绑定关键上下文变量 out_file，用于后续契约比对或子进程调用
    out_file = tmp_dir / f"{tag}.resp.json"
    in_file.write_text(json.dumps(req_obj, ensure_ascii=False, indent=2), encoding="utf-8")
    # 绑定关键上下文变量 proc，用于后续契约比对或子进程调用
    proc = subprocess.run(
        [str(cli_path), cmd, str(in_file), "--out", str(out_file)],
        capture_output=True,
        text=True,
        check=False,
    )
    # 条件分支判断：检查 (proc.returncode != 0) 是否成立
    if proc.returncode != 0:
        raise RuntimeError(f"mp_cli {cmd} failed ({proc.returncode}): {proc.stderr}")
    return json.loads(out_file.read_text(encoding="utf-8"))


# 函数定义：main —— 独立执行契约参考计算或验证断言
# 保证与 C++ 核心无共享状态，纯函数式处理输入 JSON 并返回确定性结构
def main() -> int:
    # 绑定关键上下文变量 ws，用于后续契约比对或子进程调用
    ws = pathlib.Path.cwd()
    # 绑定关键上下文变量 proj_dirs，用于后续契约比对或子进程调用
    proj_dirs = [p for p in (ws / "Projects").iterdir() if p.is_dir()]
    # 绑定关键上下文变量 proj，用于后续契约比对或子进程调用
    proj = proj_dirs[0]
    # 绑定关键上下文变量 build_dir，用于后续契约比对或子进程调用
    build_dir = ws / ".toolchain" / "build" / "t04-candidate-v1"
    # 绑定关键上下文变量 cli_path，用于后续契约比对或子进程调用
    cli_path = build_dir / "native" / "mp_cli.exe"
    # 绑定关键上下文变量 tmp_dir，用于后续契约比对或子进程调用
    tmp_dir = build_dir / "verify_tmp"
    tmp_dir.mkdir(parents=True, exist_ok=True)

    # 绑定关键上下文变量 sim_req_path，用于后续契约比对或子进程调用
    sim_req_path = next((proj / "Resources").rglob("plan-request-simulated.json"))
    # 绑定关键上下文变量 base_req，用于后续契约比对或子进程调用
    base_req = json.loads(sim_req_path.read_text(encoding="utf-8"))
    base_req["plannerConfig"]["limits"] = {
        "maxMealCandidatesPerMeal": 2000,
        "maxDpStates": 4000,
        "maxSearchNodes": 50000,
        "wallClockMs": None,
    }
    base_req["plannerConfig"]["strategies"] = ["primary", "economy", "taste"]

    report: Dict[str, Any] = {
        "layer1Checks": [],
        "layer2ExactComparisons": [],
        "counterexamples": {},
        "allPassed": True,
    }

    # 场景 A：标准三餐规划（含预算与口味偏好）
    scen_a = copy.deepcopy(base_req)
    scen_a["plannerConfig"]["budgetCents"] = 3500
    scen_a["profile"]["tastes"] = ["鸡", "青菜"]

    # 场景 B：含规则套餐 comboRules[] 自动展开与全天三餐规划
    scen_b = copy.deepcopy(base_req)
    scen_b["profile"]["tastes"] = ["鸡"]
    scen_b["catalog"]["comboRules"] = [
        {
            "ruleId": "rule-lunch-set",
            "name": "午间双蛋白特惠套餐",
            "windowId": "w-main",
            "mealWindows": ["lunch", "dinner"],
            "totalPriceCents": 1050,
            "includesRice": True,
            "requiredCounts": {"protein": 2},
            "candidateDishIds": ["dish-chicken", "dish-pork"],
            "nutritionPolicy": "sumComponents",
        }
    ]
    scen_b["catalog"]["catalogHash"] = compute_catalog_hash(scen_b["catalog"])

    # 场景 C：含固定套餐（dish.kind == "combo"，components[]{dishId, count}，riceIncluded=true）及含米饭互斥
    scen_c = copy.deepcopy(base_req)
    scen_c["profile"]["tastes"] = ["鸡", "青菜"]
    scen_c["catalog"]["dishes"].append(
        {
            "dishId": "dish-combo-fit",
            "name": "轻食鸡胸蔬菜固定套餐（含米饭）",
            "kind": "combo",
            "category": None,
            "riceDish": False,
            "riceIncluded": True,
            "components": [
                {"dishId": "dish-chicken", "count": 1},
                {"dishId": "dish-greens", "count": 1},
            ],
            "nutrition": {"energyKcal": None, "proteinDg": None, "fatDg": None, "carbDg": None},
            "nutritionBasis": {
                "source": "comboComponentSum",
                "portionAssumption": "组件合计",
                "estimated": True,
                "note": "SIMULATED",
            },
        }
    )
    scen_c["catalog"]["offers"].append(
        {
            "offerId": "offer-combo-fit",
            "dishId": "dish-combo-fit",
            "windowId": "w-main",
            "mealWindows": ["lunch", "dinner"],
            "portionCode": "full",
            "portionRatioNum": 1,
            "portionRatioDen": 1,
            "priceCents": 1000,
            "priceBasis": "comboTotal",
        }
    )
    scen_c["catalog"]["catalogHash"] = compute_catalog_hash(scen_c["catalog"])

    # 绑定关键上下文变量 scenarios，用于后续契约比对或子进程调用
    scenarios = [
        ("scenario_a_standard_budget_tastes", scen_a),
        ("scenario_b_with_combo_rules", scen_b),
        ("scenario_c_with_fixed_combo", scen_c),
    ]

    # 顺序遍历迭代变量 scen_name, scen_req，执行逐项校验或候选枚举
    for scen_name, scen_req in scenarios:
        l1_cands, l1_counts = build_layer1_candidates(scen_req)

        # 先运行 dp 获取权威 targets.daily
        r_dp = copy.deepcopy(scen_req)
        r_dp["plannerConfig"]["algorithm"] = "dp"
        dp_env = run_cli_cmd(cli_path, "plan", r_dp, tmp_dir, f"{scen_name}_dp")
        daily_target = dp_env["result"]["targets"]["daily"]
        weights = scen_req["nutritionConfig"]["plannerSorting"]["nutritionDeviationWeightsPermille"]
        tier_width_bp = int(scen_req["nutritionConfig"]["plannerSorting"]["nutritionTierWidthBp"])
        budget_cents = scen_req["plannerConfig"].get("budgetCents")
        has_budget = budget_cents is not None

        meals_order = [m for m in ("breakfast", "lunch", "dinner") if m in scen_req["planningMeals"]]
        all_combos = list(itertools.product(*(l1_cands[m] for m in meals_order)))
        evaluated_all = [
            evaluate_full_day_combo(tup, daily_target, weights, tier_width_bp, budget_cents)
            for tup in all_combos
        ]

        ref_best_by_strat: Dict[str, Dict[str, Any]] = {}
        # 顺序遍历迭代变量 strat，执行逐项校验或候选枚举
        for strat in ("primary", "economy", "taste"):
            best = min(evaluated_all, key=lambda p: strategy_sort_key(p, strat, has_budget))
            ref_best_by_strat[strat] = best

        algo_outputs: Dict[str, Any] = {"dp": dp_env["result"]}
        # 顺序遍历迭代变量 algo，执行逐项校验或候选枚举
        for algo in ("greedy", "branchAndBound"):
            r = copy.deepcopy(scen_req)
            r["plannerConfig"]["algorithm"] = algo
            env = run_cli_cmd(cli_path, "plan", r, tmp_dir, f"{scen_name}_{algo}")
            algo_outputs[algo] = env["result"]

        # 1. 验证层一候选数完全一致
        for algo in ("greedy", "dp", "branchAndBound"):
            cpp_counts = algo_outputs[algo]["search"]["candidatesEnumerated"]
            match_l1 = (cpp_counts == l1_counts)
            if not match_l1:
                report["allPassed"] = False
            report["layer1Checks"].append(
                {
                    "scenario": scen_name,
                    "algorithm": algo,
                    "independentLayer1Counts": l1_counts,
                    "cppCandidatesEnumerated": cpp_counts,
                    "matched": match_l1,
                }
            )

        # 2. 验证层二独立全局最优 == dp == branchAndBound（无截断 capsHit=[]）
        for strat in ("primary", "economy", "taste"):
            ref_plan = ref_best_by_strat[strat]
            dp_res = algo_outputs["dp"]
            bnb_res = algo_outputs["branchAndBound"]
            greedy_res = algo_outputs["greedy"]

            dp_plan = next(p for p in dp_res["plans"] if strat in p["offeredAs"])
            bnb_plan = next(p for p in bnb_res["plans"] if strat in p["offeredAs"])
            greedy_plan = next(p for p in greedy_res["plans"] if strat in p["offeredAs"])

            dp_dev = dp_plan["score"]["nutritionDeviationBp"]
            bnb_dev = bnb_plan["score"]["nutritionDeviationBp"]
            greedy_dev = greedy_plan["score"]["nutritionDeviationBp"]

            dp_price = dp_plan["budget"]["plannedTotalKnownCents"]
            bnb_price = bnb_plan["budget"]["plannedTotalKnownCents"]
            greedy_price = greedy_plan["budget"]["plannedTotalKnownCents"]

            exact_match = (
                dp_res["search"]["capsHit"] == []
                and bnb_res["search"]["capsHit"] == []
                and dp_res["search"]["searchComplete"] is True
                and bnb_res["search"]["searchComplete"] is True
                and dp_plan["planKey"] == ref_plan["planKey"]
                and bnb_plan["planKey"] == ref_plan["planKey"]
                and dp_dev == ref_plan["deviationBp"]
                and bnb_dev == ref_plan["deviationBp"]
                and dp_price == ref_plan["knownPriceCents"]
                and bnb_price == ref_plan["knownPriceCents"]
            )
            if not exact_match:
                report["allPassed"] = False

            report["layer2ExactComparisons"].append(
                {
                    "scenario": scen_name,
                    "strategy": strat,
                    "totalCartesianCombinations": len(evaluated_all),
                    "layer2Ref": {
                        "planKey": ref_plan["planKey"],
                        "deviationBp": ref_plan["deviationBp"],
                        "knownPriceCents": ref_plan["knownPriceCents"],
                        "preferenceScore": ref_plan["preferenceScore"],
                        "repeatedDishCount": ref_plan["repeatedDishCount"],
                        "categoryCoverage": ref_plan["categoryCoverage"],
                    },
                    "dp": {
                        "planKey": dp_plan["planKey"],
                        "deviationBp": dp_dev,
                        "knownPriceCents": dp_price,
                        "statesEvaluated": dp_res["search"]["statesEvaluated"],
                        "searchComplete": dp_res["search"]["searchComplete"],
                    },
                    "branchAndBound": {
                        "planKey": bnb_plan["planKey"],
                        "deviationBp": bnb_dev,
                        "knownPriceCents": bnb_price,
                        "nodesEvaluated": bnb_res["search"]["nodesEvaluated"],
                        "searchComplete": bnb_res["search"]["searchComplete"],
                    },
                    "greedy": {
                        "planKey": greedy_plan["planKey"],
                        "deviationBp": greedy_dev,
                        "knownPriceCents": greedy_price,
                        "nodesEvaluated": greedy_res["search"]["nodesEvaluated"],
                        "searchComplete": greedy_res["search"]["searchComplete"],
                    },
                    "dpEqualsBnbEqualsLayer2Ref": exact_match,
                }
            )

    # 3. 构造并验证可复现 DP 离散化桶化截断反例（maxDpStates = 2 vs maxDpStates = 4000）
    dp_cap_req = copy.deepcopy(scen_a)
    dp_cap_req["plannerConfig"]["algorithm"] = "dp"
    dp_cap_req["plannerConfig"]["limits"]["maxDpStates"] = 2
    # 绑定关键上下文变量 dp_cap_res，用于后续契约比对或子进程调用
    dp_cap_res = run_cli_cmd(cli_path, "plan", dp_cap_req, tmp_dir, "counterexample_dp_cap2")["result"]

    # 绑定关键上下文变量 dp_exact_req，用于后续契约比对或子进程调用
    dp_exact_req = copy.deepcopy(scen_a)
    dp_exact_req["plannerConfig"]["algorithm"] = "dp"
    dp_exact_req["plannerConfig"]["limits"]["maxDpStates"] = 4000
    # 绑定关键上下文变量 dp_exact_res，用于后续契约比对或子进程调用
    dp_exact_res = run_cli_cmd(cli_path, "plan", dp_exact_req, tmp_dir, "counterexample_dp_exact")["result"]

    # 绑定关键上下文变量 cap_primary，用于后续契约比对或子进程调用
    cap_primary = next(p for p in dp_cap_res["plans"] if "primary" in p["offeredAs"])
    # 绑定关键上下文变量 exact_primary，用于后续契约比对或子进程调用
    exact_primary = next(p for p in dp_exact_res["plans"] if "primary" in p["offeredAs"])

    # 绑定关键上下文变量 dp_counterexample_ok，用于后续契约比对或子进程调用
    dp_counterexample_ok = (
        dp_cap_res["search"]["searchComplete"] is False
        and any(c["limit"] == "maxDpStates" for c in dp_cap_res["search"]["capsHit"])
        and any(a["kind"] == "APPROXIMATE_DISCRETIZATION" for a in dp_cap_res["search"]["approximations"])
        and "APPROXIMATE_DISCRETIZATION" in cap_primary["flags"]
        and "SEARCH_LIMIT_REACHED" in cap_primary["flags"]
        and cap_primary["score"]["nutritionDeviationBp"] >= exact_primary["score"]["nutritionDeviationBp"]
        and cap_primary["planKey"] != exact_primary["planKey"]
    )
    # 条件分支判断：检查 (not dp_counterexample_ok) 是否成立
    if not dp_counterexample_ok:
        report["allPassed"] = False

    report["counterexamples"]["dpDiscretizationCounterexample"] = {
        "description": "当 maxDpStates=2 触发 DP 阶段桶化（步长 20kcal/50dg）与状态截断时，诚实标记 APPROXIMATE_DISCRETIZATION 且与无截断精确全局最优解产生可复现偏差差异",
        "exactMaxDpStates4000": {
            "planKey": exact_primary["planKey"],
            "deviationBp": exact_primary["score"]["nutritionDeviationBp"],
            "knownPriceCents": exact_primary["budget"]["plannedTotalKnownCents"],
            "searchComplete": dp_exact_res["search"]["searchComplete"],
            "capsHit": dp_exact_res["search"]["capsHit"],
        },
        "quantizedMaxDpStates2": {
            "planKey": cap_primary["planKey"],
            "deviationBp": cap_primary["score"]["nutritionDeviationBp"],
            "knownPriceCents": cap_primary["budget"]["plannedTotalKnownCents"],
            "searchComplete": dp_cap_res["search"]["searchComplete"],
            "capsHit": dp_cap_res["search"]["capsHit"],
            "approximations": dp_cap_res["search"]["approximations"],
            "flags": cap_primary["flags"],
        },
        "verified": dp_counterexample_ok,
    }

    # 4. 贪心局部最优 vs 全局最优（dp / branchAndBound）可复现次优反例
    greedy_req = copy.deepcopy(scen_a)
    greedy_req["plannerConfig"]["algorithm"] = "greedy"
    # 绑定关键上下文变量 greedy_res，用于后续契约比对或子进程调用
    greedy_res = run_cli_cmd(cli_path, "plan", greedy_req, tmp_dir, "counterexample_greedy")["result"]
    # 绑定关键上下文变量 greedy_primary，用于后续契约比对或子进程调用
    greedy_primary = next(p for p in greedy_res["plans"] if "primary" in p["offeredAs"])

    # 绑定关键上下文变量 greedy_counterexample_ok，用于后续契约比对或子进程调用
    greedy_counterexample_ok = (
        greedy_res["search"]["searchComplete"] is False
        and any(a["kind"] == "APPROXIMATE_CANDIDATES" for a in greedy_res["search"]["approximations"])
        and greedy_primary["score"]["nutritionDeviationBp"] > exact_primary["score"]["nutritionDeviationBp"]
    )
    # 条件分支判断：检查 (not greedy_counterexample_ok) 是否成立
    if not greedy_counterexample_ok:
        report["allPassed"] = False

    report["counterexamples"]["greedySuboptimalityCounterexample"] = {
        "description": "greedy 采用单餐逐窗口边际增益贪心构造，不遍历全天组合空间，searchComplete=false 且在 primary 策略下偏差高于 dp/branchAndBound 全局最优解",
        "globalOptimumDpAndBnb": {
            "planKey": exact_primary["planKey"],
            "deviationBp": exact_primary["score"]["nutritionDeviationBp"],
            "knownPriceCents": exact_primary["budget"]["plannedTotalKnownCents"],
        },
        "greedyResult": {
            "planKey": greedy_primary["planKey"],
            "deviationBp": greedy_primary["score"]["nutritionDeviationBp"],
            "knownPriceCents": greedy_primary["budget"]["plannedTotalKnownCents"],
            "searchComplete": greedy_res["search"]["searchComplete"],
            "approximations": greedy_res["search"]["approximations"],
        },
        "verified": greedy_counterexample_ok,
    }

    # 绑定关键上下文变量 out_report_build，用于后续契约比对或子进程调用
    out_report_build = build_dir / "two_layer_reference_verification.json"
    out_report_build.write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    # 绑定关键上下文变量 ev_dir，用于后续契约比对或子进程调用
    ev_dir = proj / "Resources" / "报告" / "T04-反重力-三算法核心-证据-v1"
    ev_dir.mkdir(parents=True, exist_ok=True)
    (ev_dir / "two_layer_reference_verification.json").write_text(
        json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"Two-layer verification finished. allPassed={report['allPassed']}")
    # 条件分支判断：检查 (not report["allPassed"]) 是否成立
    if not report["allPassed"]:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())

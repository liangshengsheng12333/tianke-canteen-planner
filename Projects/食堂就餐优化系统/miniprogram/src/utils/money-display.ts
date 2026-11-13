/**
 * utils/money-display.ts — 金额与“未知实付”展示文案的唯一实现（T05U05）。
 *
 * 口径来自 P01 定稿 §8 与 U05 任务卡第 9 条：
 *  - 未知价格绝不显示 ￥0.00，也不再用“（不完整）”冒充真实花费；
 *  - 单项未知：计划位写“价格待补”，已付位写“实付未填”；
 *  - 汇总有部分已知金额：`已知实付 ￥X（含未填项）`；
 *  - 没有可确认的已知金额且仍有未知项：`实付待补全`；
 *  - 真实已知 0 元仍显示 ￥0.00（0 是有效值，不是未知）。
 *
 * 本文件只做展示字符串，不参与金额计算，不读写记录或持久化格式；
 * 页面与只读视图映射共用它，避免今日/记录/预算各写一套文案。
 */

/** 分 → 元展示（调用方保证 cents 是已知金额）。 */
export function yuan(cents: number): string {
  return `￥${(cents / 100).toFixed(2)}`;
}

/** 单项价格未知时的占位文案：计划位与已付位分开表达，避免把“还没填”误读成“已花 0 元”。 */
export const PRICE_PENDING = '价格待补';
export const PAID_PENDING = '实付未填';

/** 计划/菜单项单价展示；未知不按 0。 */
export function priceLabel(known: boolean, cents: number | null | undefined): string {
  return known && cents !== null && cents !== undefined ? yuan(cents) : PRICE_PENDING;
}

/** 已记录项的实付单价展示；未知不按 0。 */
export function paidItemLabel(known: boolean, cents: number | null | undefined): string {
  return known && cents !== null && cents !== undefined ? yuan(cents) : PAID_PENDING;
}

/** 已付汇总：区分“部分已知”“全部未知”“真实 0 元”，不冒充完整金额。 */
export function paidSumLabel(knownCents: number, incomplete: boolean): string {
  if (!incomplete) {
    return yuan(knownCents);
  }
  return knownCents > 0 ? `已知实付 ${yuan(knownCents)}（含未填项）` : '实付待补全';
}

/** 计划汇总：同样只给已知小计；含未填项时不写成完整总价。 */
export function plannedSumLabel(knownCents: number, incomplete: boolean): string {
  if (!incomplete) {
    return yuan(knownCents);
  }
  return knownCents > 0 ? `已知 ${yuan(knownCents)}（含未填项）` : '计划金额待补';
}
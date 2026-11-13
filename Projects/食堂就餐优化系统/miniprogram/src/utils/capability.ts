/**
 * capability.ts — 调用侧当前受支持的业务请求子集检查。
 *
 * 当前只联调 algorithm=greedy / dp / branchAndBound 且 comboRules=[]；白名单与 domain/types.SUPPORTED_ALGORITHMS 同一份，
 * 避免调用侧与规划层两处枚举漂移。非空套餐规则仍不发送，由后续卡放行；
 * 本限制不缩减最终三算法与套餐范围。
 */

import { SUPPORTED_ALGORITHMS, isSupportedAlgorithm } from '../domain/types';

/** 受支持返回 null；否则返回可读的拒绝原因，页面原样展示。 */
export function checkPlanCapability(request: any): string | null {
  const algorithm = request && request.plannerConfig && request.plannerConfig.algorithm;
  if (!isSupportedAlgorithm(algorithm)) {
    return `当前只支持 plannerConfig.algorithm=${SUPPORTED_ALGORITHMS.map((value) => `"${value}"`).join(' / ')}，收到 ${JSON.stringify(algorithm)}`;
  }
  const comboRules = request.catalog && request.catalog.comboRules;
  if (!Array.isArray(comboRules)) {
    return 'catalog.comboRules 缺失或不是数组，无法确认是否为空';
  }
  if (comboRules.length > 0) {
    return `当前只支持 catalog.comboRules=[]，收到 ${comboRules.length} 条套餐规则`;
  }
  return null;
}
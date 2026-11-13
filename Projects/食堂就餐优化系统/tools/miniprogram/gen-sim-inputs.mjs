// gen-sim-inputs.mjs — 把 DSH v2 证据里的 4 类 PlanRequest 夹具生成为小程序可 import 的 TS 模块。
// 仅作模拟数据与联调演示；所有数据均为模拟数据，营养值为估算占位，不是真实菜单。
// 运行：node tools/miniprogram/gen-sim-inputs.mjs
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const inputsDir = path.join(
  projectRoot,
  'Resources', '报告', 'T02-DSH-接入前定点修正-证据-v2', 'inputs',
);
const target = path.join(projectRoot, 'miniprogram', 'src', 'mock', 'simulated-inputs.ts');

const EXPECTED_HASHES = {
  success: {
    file: 'plan-request-success.json',
    sha256: '8550B22BC3E9B3F87A135FB962ED54AE01D7F431B37472DCEF0AF57BFDE5D617',
  },
  targetUnavailable: {
    file: 'plan-request-target-unavailable.json',
    sha256: '07FF8CBD530A3B14E9B9AAAEB39AE81CA0C3C8698BDAAA36D1EB50613CC15C7F',
  },
  invalid: {
    file: 'plan-request-invalid.json',
    sha256: '23078623F54B16A36ED5DBAA7E9F967C76A0C6DB8E21ACAA6E1049C37E3C6178',
  },
  resourceLimited: {
    file: 'plan-request-resource-limited.json',
    sha256: 'B65794E90FD3B3B964F487A56ACA9B5E68F7CF84728B4F9FB41A54BDECF9B5D1',
  },
};

const fixtureData = {};

for (const [key, meta] of Object.entries(EXPECTED_HASHES)) {
  const filePath = path.join(inputsDir, meta.file);
  const bytes = fs.readFileSync(filePath);
  const actualHash = crypto.createHash('sha256').update(bytes).digest('hex').toUpperCase();
  if (actualHash !== meta.sha256) {
    throw new Error(`夹具 ${meta.file} 哈希不匹配：期望 ${meta.sha256}，实际 ${actualHash}`);
  }
  fixtureData[key] = {
    file: meta.file,
    sha256: actualHash,
    data: JSON.parse(bytes.toString('utf8')),
  };
  console.log(`verified ${meta.file} (${actualHash})`);
}

// T06a：统一核心只接受冻结契约四字段 limits（旧 maxCandidates/maxNodes 会直接 INVALID_INPUT）。
// 各夹具的业务场景保持不变：success/targetUnavailable/invalid 用与应用一致的确定性限额；
// resourceLimited 仍以极小的搜索节点预算触发 ResourceLimited（旧 maxNodes=3 → maxSearchNodes=3）。
const CANONICAL_LIMITS = {
  maxMealCandidatesPerMeal: 64,
  maxDpStates: 20000,
  maxSearchNodes: 200000,
  wallClockMs: null,
};
for (const key of ['success', 'targetUnavailable', 'invalid']) {
  fixtureData[key].data.plannerConfig.limits = { ...CANONICAL_LIMITS };
}
fixtureData.resourceLimited.data.plannerConfig.limits = { ...CANONICAL_LIMITS, maxSearchNodes: 3 };
fixtureData.resourceLimited.data._note =
  'SIMULATED fixture for T02 v2 targeted fixes（T06a 已适配冻结契约四字段 limits）。Not real menu or nutrition acceptance. Scenario: a legal but tiny plannerConfig.limits.maxSearchNodes=3 exhausts the candidate-evaluation budget, so the core must report ResourceLimited (search limit reached) and must NOT claim the problem has no solution.';

const text = `// 本文件由 tools/miniprogram/gen-sim-inputs.mjs 自动生成，请勿手工修改。
// 来源：Resources/报告/T02-DSH-接入前定点修正-证据-v2/inputs/
// 模拟数据（SIMULATED）：不是真实菜单，营养值为估算占位；仅用于阶段 B 业务接入联调验证。
// T06a 适配：request 内旧 plannerConfig.limits（maxCandidates/maxNodes）统一改为冻结契约四字段
// {maxMealCandidatesPerMeal,maxDpStates,maxSearchNodes,wallClockMs}；T02 源文件与 sha256 保持原样。

export interface FixtureCase {
  key: string;
  name: string;
  description: string;
  file: string;
  /** T02 源夹具文件身份（源文件未改；request 内 limits 已由 T06a 适配为契约四字段）。 */
  sha256: string;
  request: any;
}

export const FIXTURE_CASES: Record<string, FixtureCase> = {
  success: {
    key: 'success',
    name: '成功方案 (OkPartial)',
    description: '常规贪心规划成功；因模拟数据为估算值故带 ESTIMATED_DATA 标志且状态为 OkPartial',
    file: ${JSON.stringify(fixtureData.success.file)},
    sha256: ${JSON.stringify(fixtureData.success.sha256)},
    request: ${JSON.stringify(fixtureData.success.data, null, 2)},
  },
  targetUnavailable: {
    key: 'targetUnavailable',
    name: '目标不可用 (TargetUnavailable)',
    description: 'BMI 过轻且未设手动目标，自动目标停用，返回 TargetUnavailable 且 plans 为空',
    file: ${JSON.stringify(fixtureData.targetUnavailable.file)},
    sha256: ${JSON.stringify(fixtureData.targetUnavailable.sha256)},
    request: ${JSON.stringify(fixtureData.targetUnavailable.data, null, 2)},
  },
  invalid: {
    key: 'invalid',
    name: '非法输入 (INVALID_INPUT)',
    description: 'maxItemsPerMeal=99 超出限制，契约错误包络返回 INVALID_INPUT',
    file: ${JSON.stringify(fixtureData.invalid.file)},
    sha256: ${JSON.stringify(fixtureData.invalid.sha256)},
    request: ${JSON.stringify(fixtureData.invalid.data, null, 2)},
  },
  resourceLimited: {
    key: 'resourceLimited',
    name: '资源受限 (ResourceLimited)',
    description: '设置合法限额 limits.maxSearchNodes=3，搜索预算真实耗尽，返回 ResourceLimited',
    file: ${JSON.stringify(fixtureData.resourceLimited.file)},
    sha256: ${JSON.stringify(fixtureData.resourceLimited.sha256)},
    request: ${JSON.stringify(fixtureData.resourceLimited.data, null, 2)},
  },
};

// 默认模拟请求（成功用例）
export const PLAN_REQUEST_SIMULATED: any = FIXTURE_CASES.success.request;
`;

fs.writeFileSync(target, text, 'utf8');
console.log(`written -> ${target}`);

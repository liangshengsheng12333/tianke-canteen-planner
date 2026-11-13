// test-t05-modules.mjs — T05 阶段 1：领域工具模块纯函数测试。
//
// 覆盖：
//   1. sha256.ts 的 FIPS 180-4 已知向量、与 node:crypto 逐字节比对、`sha256:<hex>` 前缀格式；
//   2. canonical-json.ts 的规范化口径（UTF-8 字节序键排序、数组保序、紧凑、转义规则、整数约束）；
//   3. nutrition-config.ts 快照与 T01 v1.2 冻结文件一致，且复算摘要 == sha256:c93d2d91…；
//   4. simulated-menu.ts 的 catalogHash 复算 == sha256:40f2bd13…，且与 T02 v2 夹具 catalog 深等；
//   5. capability.ts 的受支持能力门（只放行 greedy + comboRules=[]）；
//   6. Node 扩展名补全钩子（register-ts.mjs）确实能让源码内部无扩展名相对导入可解析。
//
// 边界：本文件只做纯 Node 计算，不加载 WASM、不写任何文件；真实 WASM 证据在
// verify-t05-integration.mjs 与 measure-t05.mjs，不用本文件冒充。
//
// 运行（项目根）：
//   node --import ./tools/miniprogram/register-ts.mjs --test tools/miniprogram/test-t05-modules.mjs
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';

const toolsDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(toolsDir, '..', '..');
const srcDir = path.join(projectRoot, 'miniprogram', 'src');
const importTs = (...segments) => import(pathToFileURL(path.join(srcDir, ...segments)).href);

const { sha256Hex, sha256Prefixed, utf8ToBytes } = await importTs('utils', 'sha256.ts');
const { canonicalJson, canonicalSha256 } = await importTs('utils', 'canonical-json.ts');
const { NUTRITION_CONFIG_SNAPSHOT, NUTRITION_CONFIG_HASH, buildNutritionConfigRequest } = await importTs(
  'config',
  'nutrition-config.ts',
);
const { SIMULATED_CATALOG } = await importTs('config', 'simulated-menu.ts');
const { checkPlanCapability } = await importTs('utils', 'capability.ts');
const { FIXTURE_CASES } = await importTs('mock', 'simulated-inputs.ts');

const enc = new TextEncoder();
const nodeSha = (bytes) => crypto.createHash('sha256').update(Buffer.from(bytes)).digest('hex');
const stripHash = (object) => {
  const copy = JSON.parse(JSON.stringify(object));
  delete copy.hash;
  return copy;
};

// ---------------------------------------------------------------------------
// 1. SHA-256
// ---------------------------------------------------------------------------

test('sha256：FIPS 180-4 已知向量（空、abc、hello、448 位整块边界、中文）', () => {
  const vectors = [
    ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
    ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
    ['hello', '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824'],
    [
      'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
      '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
    ],
    ['天科食客', null],
  ];
  for (const [text, expected] of vectors) {
    const actual = sha256Hex(utf8ToBytes(text));
    const reference = expected ?? nodeSha(enc.encode(text));
    assert.equal(actual, reference, `SHA-256 向量不一致：${JSON.stringify(text)}`);
    assert.match(actual, /^[0-9a-f]{64}$/, `SHA-256 必须是 64 位小写十六进制：${actual}`);
  }
});

test('sha256：与 node:crypto 对补齐 64 字节边界的确定性随机字节完全一致（含 0x00/0xff）', () => {
  let state = 0x9e3779b9;
  const nextByte = () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state & 0xff;
  };
  const lengths = [0, 1, 2, 3, 55, 56, 57, 63, 64, 65, 127, 128, 129, 1000, 10000];
  for (const length of lengths) {
    const bytes = Uint8Array.from({ length }, nextByte);
    if (length >= 2) {
      bytes[0] = 0x00;
      bytes[length - 1] = 0xff;
    }
    assert.equal(sha256Hex(bytes), nodeSha(bytes), `长度 ${length} 字节的 SHA-256 与 node:crypto 不一致`);
  }
  assert.equal(
    sha256Hex(enc.encode('a'.repeat(1000000))),
    'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
    '一百万字节 "a" 的 SHA-256 已知向量不一致',
  );
});

test('sha256Prefixed：格式固定为 sha256:<64 位小写 hex>，内容等于标准 SHA-256', () => {
  for (const text of ['', 'abc', '模拟菜单（非真实菜单）😀', '{"a":1}']) {
    const actual = sha256Prefixed(text);
    assert.equal(actual, 'sha256:' + nodeSha(enc.encode(text)), `sha256Prefixed 内容错误：${text}`);
    assert.match(actual, /^sha256:[0-9a-f]{64}$/, `sha256Prefixed 格式错误：${actual}`);
  }
});

test('utf8ToBytes：与标准 TextEncoder 逐字节一致，孤立代理项替换为 U+FFFD', () => {
  const cases = ['', 'abc', '模拟食堂（非真实菜单）', 'a😀b', 'x\ud800y', '\udfff', '\u0000\u007f\u0080\u07ff\u0800\uffff'];
  for (const text of cases) {
    assert.deepEqual([...utf8ToBytes(text)], [...enc.encode(text)], `UTF-8 编码与 TextEncoder 不一致：${JSON.stringify(text)}`);
  }
});

// ---------------------------------------------------------------------------
// 2. canonicalJson
// ---------------------------------------------------------------------------

test('canonicalJson：对象键递归按 UTF-8 字节序排序、数组保序、无空白、无末尾换行', () => {
  const actual = canonicalJson({ b: 1, a: { z: 1, y: [2, 3] }, 'é': 1, '中': 2 });
  assert.equal(actual, '{"a":{"y":[2,3],"z":1},"b":1,"é":1,"中":2}', '键排序/紧凑输出不符合 T01 §0.3 口径');
  assert.equal(actual, JSON.stringify(JSON.parse(actual)), '规范输出应能被 JSON.parse 原样回读且无空白');
});

test('canonicalJson：字符串只转义 "、\\ 与 <0x20 控制字节（\\u00xx 小写），中文/emoji 原样', () => {
  const text = '"\\\u0000\u0001\u0009\u000a\u001f/中😀';
  const actual = canonicalJson(text);
  assert.equal(actual, '"\\"\\\\\\u0000\\u0001\\u0009\\u000a\\u001f/中😀"', '字符串转义口径与 C++ SerializeString 不一致');
  assert.ok(!actual.includes('\\/'), '不应转义斜杠');
  assert.equal(JSON.parse(actual), text, '转义后必须能还原原文');
});

test('canonicalJson：undefined 在对象中省略、在数组中按 JSON 语义变 null；布尔/null 正确', () => {
  assert.equal(canonicalJson({ a: undefined, b: [undefined, 1] }), '{"b":[null,1]}', 'undefined 处理与 JSON 语义不一致');
  assert.equal(canonicalJson({ a: null, b: true, c: false }), '{"a":null,"b":true,"c":false}', '布尔与 null 序列化错误');
});

test('canonicalJson：只接受安全整数；-0 归一为 0；非安全整数/小数/NaN/Infinity 抛可定位错误', () => {
  assert.equal(canonicalJson(-0), '0', '-0 必须归一为 0');
  assert.equal(canonicalJson({ v: -123456789 }), '{"v":-123456789}', '负安全整数应原样输出');
  for (const bad of [1.5, NaN, Infinity, -Infinity, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => canonicalJson({ v: bad }), /只接受安全整数/, `应拒绝非安全整数：${String(bad)}`);
  }
});

test('canonicalJson：skipRootKey 只排除根上的键，嵌套同名键保留', () => {
  assert.equal(
    canonicalJson({ hash: 'x', nested: { hash: 'y' } }, 'hash'),
    '{"nested":{"hash":"y"}}',
    'skipRootKey 必须只作用于根对象',
  );
  assert.equal(canonicalSha256({ hash: 'x', v: 1 }, 'hash'), canonicalSha256({ v: 1 }), '排除根 hash 后摘要应与无 hash 对象一致');
});

// ---------------------------------------------------------------------------
// 3. 营养配置快照
// ---------------------------------------------------------------------------

const nutritionCandidatePath = path.join(projectRoot, 'Resources', '契约', 'T01-v1.2-candidate', 'nutrition-v1-candidate.json');

test('nutritionConfig：快照与 T01 v1.2 冻结文件 snapshot 逐字段深等，冻结 hash 常量正确', () => {
  const candidate = JSON.parse(fs.readFileSync(nutritionCandidatePath, 'utf8'));
  assert.equal(
    candidate.hash,
    'sha256:c93d2d91b13e54466e89d7d41ec50b1d93b6566cdee699af0cb81154a72dd288',
    'T01 冻结文件根 hash 与预期不同，先核对文件身份',
  );
  assert.equal(NUTRITION_CONFIG_HASH, candidate.hash, 'NUTRITION_CONFIG_HASH 常量必须等于冻结文件根 hash');
  assert.deepEqual(NUTRITION_CONFIG_SNAPSHOT, candidate.snapshot, 'nutrition-config.ts 快照副本偏离冻结文件 snapshot（禁止手工修改）');
});

test('nutritionConfig：复算快照摘要 == sha256:c93d2d91…（排除根 hash 与不含 hash 两种口径一致）', () => {
  const expected = 'sha256:c93d2d91b13e54466e89d7d41ec50b1d93b6566cdee699af0cb81154a72dd288';
  assert.equal(canonicalSha256(NUTRITION_CONFIG_SNAPSHOT), expected, '对快照对象复算的摘要与冻结 hash 不一致');
  assert.equal(canonicalSha256(buildNutritionConfigRequest(), 'hash'), expected, '请求形态（快照 + 根 hash）排除 hash 后摘要不一致');
});

test('nutritionConfig：buildNutritionConfigRequest 携带根 hash、返回独立副本且不改模块常量', () => {
  const request = buildNutritionConfigRequest();
  assert.equal(request.hash, NUTRITION_CONFIG_HASH, '请求必须携带冻结的 nutritionConfig.hash');
  assert.deepEqual(stripHash(request), NUTRITION_CONFIG_SNAPSHOT, '请求去掉根 hash 后必须等于冻结快照');
  request.parameters.mealSharePermille.breakfast = 1;
  request.population.ageMinYears = 999;
  assert.equal(NUTRITION_CONFIG_SNAPSHOT.parameters.mealSharePermille.breakfast, 300, '修改请求副本不得改到模块常量');
  assert.equal(NUTRITION_CONFIG_SNAPSHOT.population.ageMinYears, 18, '修改请求副本不得改到模块常量');
  const again = buildNutritionConfigRequest();
  assert.equal(again.parameters.mealSharePermille.breakfast, 300, '每次调用都应返回全新副本');
  assert.notEqual(again, request, 'buildNutritionConfigRequest 不应返回同一个对象');
});

// ---------------------------------------------------------------------------
// 4. 模拟菜单
// ---------------------------------------------------------------------------

test('simulated-menu：catalogHash 复算一致（排除根 catalogHash），并与 T02 v2 夹具 catalog 深等', () => {
  const expected = 'sha256:40f2bd13ef5b91317e4cfcbbd868c82e208cb1347773a60e238bfea5c6cfba76';
  assert.equal(SIMULATED_CATALOG.catalogHash, expected, 'SIMULATED_CATALOG.catalogHash 常量与预期不同');
  assert.equal(canonicalSha256(SIMULATED_CATALOG, 'catalogHash'), expected, '按 T01 §0.3 复算模拟菜单 catalogHash 不一致');
  const fixtureCatalog = FIXTURE_CASES.success.request.catalog;
  assert.deepEqual(SIMULATED_CATALOG, fixtureCatalog, '模拟菜单必须逐字段等于 T02 v2 已接受夹具的 catalog');
});

test('simulated-menu：醒目标注模拟来源，禁止冒充真实价格/菜品', () => {
  assert.match(SIMULATED_CATALOG.canteen.name, /非真实菜单/, '模拟菜单 canteen.name 必须明确标注“非真实菜单”');
  assert.equal(SIMULATED_CATALOG.canteen.canteenId, 'canteen-sim', '模拟菜单 canteenId 应表明模拟身份');
  assert.match(SIMULATED_CATALOG.menuVersion, /simulated/, '模拟菜单 menuVersion 应包含 simulated 标识');
  assert.ok(SIMULATED_CATALOG.dishes.length > 0, '模拟菜单不能没有菜品');
  for (const dish of SIMULATED_CATALOG.dishes) {
    assert.equal(dish.nutritionBasis.estimated, true, `菜品 ${dish.dishId} 的营养必须标记为估算`);
    assert.equal(dish.nutritionBasis.note, 'SIMULATED', `菜品 ${dish.dishId} 的 nutritionBasis.note 必须为 SIMULATED`);
  }
});

// ---------------------------------------------------------------------------
// 5. 能力门
// ---------------------------------------------------------------------------

test('capability：greedy / dp / branchAndBound + comboRules=[] 放行，未知算法/非空套餐规则/缺字段被拒', () => {
  assert.equal(checkPlanCapability(FIXTURE_CASES.success.request), null, 'greedy + 空 comboRules 的合法请求不应被能力门拒绝');

  const dpRequest = structuredClone(FIXTURE_CASES.success.request);
  dpRequest.plannerConfig.algorithm = 'dp';
  assert.equal(checkPlanCapability(dpRequest), null, 'dp 属当前受支持子集，不应被能力门拒绝');

  const bnbRequest = structuredClone(FIXTURE_CASES.success.request);
  bnbRequest.plannerConfig.algorithm = 'branchAndBound';
  assert.equal(checkPlanCapability(bnbRequest), null, 'branchAndBound 属当前受支持子集，不应被能力门拒绝');

  for (const algorithm of ['dynamicProgramming', 'greedy2', undefined]) {
    const request = structuredClone(FIXTURE_CASES.success.request);
    request.plannerConfig.algorithm = algorithm;
    const reason = checkPlanCapability(request);
    assert.ok(
      typeof reason === 'string' && reason.includes('greedy') && reason.includes('dp') && reason.includes('branchAndBound'),
      `algorithm=${String(algorithm)} 必须被拒并说明只支持 greedy / dp / branchAndBound`,
    );
  }

  const combo = structuredClone(FIXTURE_CASES.success.request);
  combo.catalog.comboRules = [{ ruleId: 'rule-1' }];
  assert.match(checkPlanCapability(combo), /comboRules=\[\].*1 条套餐规则/, '非空 comboRules 必须被拒并给出条数');

  const missing = structuredClone(FIXTURE_CASES.success.request);
  delete missing.catalog.comboRules;
  assert.match(checkPlanCapability(missing), /缺失或不是数组/, 'comboRules 缺失必须被拒');

  assert.match(checkPlanCapability(null), /只支持/, 'null 请求必须被拒并给出可见原因');
});

// ---------------------------------------------------------------------------
// 6. 夹具交叉核对（请求里携带的哈希必须等于冻结值）
// ---------------------------------------------------------------------------

test('T02 v2 夹具：请求内 nutritionConfig.hash 与 catalog.catalogHash 等于冻结值', () => {
  for (const key of ['success', 'targetUnavailable', 'invalid', 'resourceLimited']) {
    const request = FIXTURE_CASES[key].request;
    assert.equal(request.nutritionConfig.hash, NUTRITION_CONFIG_HASH, `夹具 ${key} 的 nutritionConfig.hash 与冻结值不一致`);
    assert.equal(
      request.catalog.catalogHash,
      SIMULATED_CATALOG.catalogHash,
      `夹具 ${key} 的 catalog.catalogHash 与模拟菜单不一致`,
    );
  }
});

// ---------------------------------------------------------------------------
// 7. 扩展名补全钩子自检
// ---------------------------------------------------------------------------

test('register-ts 钩子：源码内部无扩展名相对导入可在 Node 24 直接解析', async () => {
  const appState = await importTs('domain', 'app-state.ts');
  assert.equal(appState.STORAGE_KEY, 'tiankeshike:state:v1', 'app-state.ts 的存储键应可直接读取');
  assert.equal(typeof appState.loadState, 'function', 'app-state.ts 的 loadState 应可导入');
});

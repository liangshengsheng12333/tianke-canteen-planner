// test-core-bridge.mjs — core-bridge.ts / capability.ts 的调用侧单元测试。
//
// 重要边界：这里的 "core" 是 JS 模拟导出（用真实 WebAssembly.Memory 做线性内存、JS 实现的
// 计数分配器），用来验证调用侧的生命周期逻辑：释放次数/顺序、内存增长后刷新视图、零指针、
// trap 与结果块格式错误的处理。它不是 C++ 核心，也不是 WXWebAssembly，
// 不能作为 T02 的 WASM 执行证据、微信兼容证据或业务结果。
//
// 运行：node tools/miniprogram/test-core-bridge.mjs
import assert from 'node:assert/strict';
import test from 'node:test';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';

const miniprogram = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', 'miniprogram', 'src');
const importTs = (...segments) => import(pathToFileURL(path.join(miniprogram, ...segments)).href);
const bridge = await importTs('utils', 'core-bridge.ts');
const { checkPlanCapability } = await importTs('utils', 'capability.ts');
const { PLAN_REQUEST_SIMULATED } = await importTs('mock', 'simulated-inputs.ts');

const { callApi, loadCore, probeAbi, utf8Decode, utf8Encode, REQUIRED_EXPORTS } = bridge;
const PAGE = 65536;
const encoder = new TextEncoder();

// 构造模拟导出。options:
//   growInAlloc / growInEntry：在 mp_alloc 或入口调用内让线性内存增长（旧 ArrayBuffer 随之失效）
//   allocZeroAt：第 n 次 mp_alloc 返回 0（从 1 计数）
//   entryZero / entryThrows：入口返回 0 / 抛出 trap 类异常
//   response：入口返回的 JSON 文本；corruptBlock：'reserved' | 'noNul' | 'length' 破坏结果块
function makeMock(options = {}) {
  const memory = new WebAssembly.Memory({ initial: 1 });
  const calls = [];
  let next = 1024;
  let allocCount = 0;
  const staticVersionPtr = 16;
  new Uint8Array(memory.buffer).set(encoder.encode('1.0\0'), staticVersionPtr);

  const alloc = (len) => {
    allocCount += 1;
    if (options.allocZeroAt === allocCount) {
      calls.push(['alloc', len, 0]);
      return 0;
    }
    if (options.growInAlloc) {
      memory.grow(1);
    }
    const ptr = next;
    next += (len + 16) & ~7;
    calls.push(['alloc', len, ptr]);
    return ptr;
  };
  const free = (ptr) => calls.push(['free', ptr]);

  const entry = (name) => (ptr, len) => {
    calls.push([name, ptr, len]);
    if (options.entryThrows) {
      throw new WebAssembly.RuntimeError('unreachable');
    }
    if (options.entryZero) {
      return 0;
    }
    if (options.growInEntry) {
      memory.grow(1);
    }
    const payload = encoder.encode(options.response ?? '{"ok":false}');
    const block = next;
    next += (payload.length + 16) & ~7;
    const view = new DataView(memory.buffer);
    view.setUint32(block, options.corruptBlock === 'length' ? 0x7fffffff : payload.length, true);
    view.setUint32(block + 4, options.corruptBlock === 'reserved' ? 7 : 0, true);
    new Uint8Array(memory.buffer).set(payload, block + 8);
    new Uint8Array(memory.buffer)[block + 8 + payload.length] = options.corruptBlock === 'noNul' ? 0x41 : 0;
    calls.push(['block', block]);
    return block;
  };

  const exports = {
    memory,
    mp_api_version: () => 1,
    mp_contract_version: () => staticVersionPtr,
    mp_alloc: alloc,
    mp_free: free,
    mp_plan: entry('plan'),
    mp_nutrition_target: entry('nutrition-target'),
    mp_validate_menu: entry('validate-menu'),
    mp_offer_nutrition: entry('offer-nutrition'),
  };
  return { core: { exports }, calls, memory, staticVersionPtr };
}

const frees = (calls) => calls.filter((c) => c[0] === 'free').map((c) => c[1]);
const countOf = (list, value) => list.filter((x) => x === value).length;

test('utf8Encode 与标准 TextEncoder 逐字节一致（含中文、emoji、孤立代理项）', () => {
  for (const text of ['', 'abc', '模拟食堂（非真实菜单）', 'a😀b', 'x\ud800y', '\u0000\u007f\u0080\u07ff\u0800\uffff']) {
    assert.deepEqual([...utf8Encode(text)], [...encoder.encode(text)], JSON.stringify(text));
  }
});

test('utf8Decode 往返一致，且对非法字节抛错而不是替换', () => {
  const text = '模拟食堂 😀 greedy ' + 'é'.repeat(5000);
  assert.equal(utf8Decode(encoder.encode(text)), text);
  for (const bad of [[0xc0, 0x80], [0xe4, 0xb8], [0xed, 0xa0, 0x80], [0xff], [0xe4, 0x41, 0x41], [0xf4, 0x90, 0x80, 0x80]]) {
    assert.throws(() => utf8Decode(Uint8Array.from(bad)), /非法 UTF-8/, bad.map((b) => b.toString(16)).join(' '));
  }
});

test('callApi 成功：写入字节正确，输出与输入各释放一次，先释放输出再释放输入', () => {
  const { core, calls } = makeMock({ response: '{"ok":true,"名称":"模拟😀"}' });
  const request = '{"text":"模拟食堂"}';
  const text = callApi(core, 'plan', request);
  assert.equal(text, '{"ok":true,"名称":"模拟😀"}');

  const alloc = calls.find((c) => c[0] === 'alloc');
  const entry = calls.find((c) => c[0] === 'plan');
  const block = calls.find((c) => c[0] === 'block')[1];
  assert.equal(entry[1], alloc[2]);
  assert.equal(entry[2], encoder.encode(request).length);
  assert.deepEqual(frees(calls), [block, alloc[2]]);
});

test('callApi 按命令选择入口', () => {
  for (const [command, name] of [['plan', 'plan'], ['nutrition-target', 'nutrition-target'], ['validate-menu', 'validate-menu']]) {
    const { core, calls } = makeMock();
    callApi(core, command, '{}');
    assert.ok(calls.some((c) => c[0] === name), command);
  }
  assert.throws(() => callApi(makeMock().core, 'bogus', '{}'), /未知命令/);
});

test('mp_alloc 内线性内存增长：写入落在新的 buffer 上', () => {
  const { core, calls, memory } = makeMock({ growInAlloc: true, response: '{"ok":true}' });
  const before = memory.buffer.byteLength;
  assert.equal(callApi(core, 'plan', '{"a":1}'), '{"ok":true}');
  assert.equal(memory.buffer.byteLength, before + PAGE);
  assert.equal(countOf(frees(calls), calls.find((c) => c[0] === 'alloc')[2]), 1);
});

test('入口调用内线性内存增长：结果块从新的 buffer 读取', () => {
  const { core, calls } = makeMock({ growInEntry: true, response: '{"ok":true}' });
  assert.equal(callApi(core, 'plan', '{"a":1}'), '{"ok":true}');
  assert.equal(frees(calls).length, 2);
});

test('输入分配返回 0：报真实分配失败，且没有可释放的指针', () => {
  const { core, calls } = makeMock({ allocZeroAt: 1 });
  assert.throws(() => callApi(core, 'plan', '{}'), /mp_alloc 返回 0/);
  assert.deepEqual(frees(calls), []);
});

test('入口返回 0：报错，输入仍只释放一次', () => {
  const { core, calls } = makeMock({ entryZero: true });
  assert.throws(() => callApi(core, 'plan', '{}'), /mp_plan 返回 0/);
  assert.deepEqual(frees(calls), [calls.find((c) => c[0] === 'alloc')[2]]);
});

test('入口 trap：原样抛出，输入仍只释放一次', () => {
  const { core, calls } = makeMock({ entryThrows: true });
  assert.throws(() => callApi(core, 'plan', '{}'), WebAssembly.RuntimeError);
  assert.deepEqual(frees(calls), [calls.find((c) => c[0] === 'alloc')[2]]);
});

test('结果块格式错误：抛出具体原因，结果块与输入各释放一次', () => {
  for (const [corrupt, pattern] of [['reserved', /保留字段/], ['noNul', /NUL/], ['length', /越过线性内存/]]) {
    const { core, calls } = makeMock({ corruptBlock: corrupt });
    assert.throws(() => callApi(core, 'plan', '{}'), pattern, corrupt);
    const block = calls.find((c) => c[0] === 'block')[1];
    const input = calls.find((c) => c[0] === 'alloc')[2];
    assert.deepEqual(frees(calls), [block, input], corrupt);
  }
});

test('loadCore：空 import 对象实例化；缺导出时列出名称', async () => {
  const { core } = makeMock();
  let seen;
  const loaded = await loadCore(async (p, imports) => {
    seen = [p, imports];
    return { instance: { exports: core.exports } };
  }, '/x.wasm');
  assert.deepEqual(seen, ['/x.wasm', {}]);
  assert.equal(loaded.exports, core.exports);

  const partial = { ...core.exports };
  delete partial.mp_free;
  delete partial.mp_offer_nutrition;
  delete partial.memory;
  await assert.rejects(
    loadCore(async () => ({ instance: { exports: partial } }), '/x.wasm'),
    /缺少必需导出：mp_free, mp_offer_nutrition, memory/,
  );
  await assert.rejects(loadCore(async () => { throw new Error('找不到文件'); }, '/x.wasm'), /找不到文件/);
  assert.equal(REQUIRED_EXPORTS.length, 8);
});

test('probeAbi：读取静态版本串且不释放它；探针分配释放一次；结果块探针走 validate-menu', () => {
  const { core, calls, staticVersionPtr } = makeMock({ response: '{"ok":false}' });
  const probe = probeAbi(core);
  assert.equal(probe.apiVersion, 1);
  assert.equal(probe.contractVersion, '1.0');
  assert.equal(probe.allocWriteReadOk, true);
  assert.equal(probe.resultBlockProbeText, '{"ok":false}');
  assert.ok(!frees(calls).includes(staticVersionPtr));
  assert.equal(countOf(frees(calls), probe.allocPtr), 1);
  const probeCall = calls.find((c) => c[0] === 'validate-menu');
  assert.equal(probeCall[2], 2); // '{}'
  // 3 次分配（探针、请求输入）+ 1 个结果块，全部释放，各一次
  const released = frees(calls);
  assert.equal(new Set(released).size, released.length);
  assert.equal(released.length, 3);
});

test('checkPlanCapability：受支持子集（greedy / dp / branchAndBound）通过，其他算法给出可见原因', () => {
  assert.equal(checkPlanCapability(PLAN_REQUEST_SIMULATED), null);

  const dpVariant = structuredClone(PLAN_REQUEST_SIMULATED);
  dpVariant.plannerConfig.algorithm = 'dp';
  assert.equal(checkPlanCapability(dpVariant), null, 'dp 属当前受支持子集，不应被能力门拒绝');

  const bnbVariant = structuredClone(PLAN_REQUEST_SIMULATED);
  bnbVariant.plannerConfig.algorithm = 'branchAndBound';
  assert.equal(checkPlanCapability(bnbVariant), null, 'branchAndBound 属当前受支持子集，不应被能力门拒绝');

  const unknown = structuredClone(PLAN_REQUEST_SIMULATED);
  unknown.plannerConfig.algorithm = 'dynamicProgramming';
  assert.match(checkPlanCapability(unknown), /algorithm="greedy" \/ "dp" \/ "branchAndBound".*dynamicProgramming/);

  const combo = structuredClone(PLAN_REQUEST_SIMULATED);
  combo.catalog.comboRules = [{ ruleId: 'r1' }];
  assert.match(checkPlanCapability(combo), /comboRules=\[\].*1 条/);

  const noCombo = structuredClone(PLAN_REQUEST_SIMULATED);
  delete noCombo.catalog.comboRules;
  assert.match(checkPlanCapability(noCombo), /缺失或不是数组/);

  assert.match(checkPlanCapability({}), /algorithm="greedy" \/ "dp" \/ "branchAndBound"/);
  assert.match(checkPlanCapability(null), /algorithm="greedy" \/ "dp" \/ "branchAndBound"/);
});

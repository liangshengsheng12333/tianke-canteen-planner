import json
import pathlib
import subprocess
import time

project = pathlib.Path(r'D:\项目\cpp\Projects\食堂就餐优化系统')
source = project / 'Resources/报告/T04A14-内部Sol-全天DP有界搜索-证据-v1'
out = pathlib.Path(__file__).parent
request = source / 'raw_io/compact_states32.req.json'
wasm_output = out / 'dp32-wasm.resp.json'
native_output = out / 'dp32-native.resp.json'
commands = [
    ['node', str(source / 'wasm-worker.mjs'),
     str(project / 'miniprogram/src/assets/wasm/mp_core.wasm'), str(request), str(wasm_output)],
    [str(project / 'Resources/报告/T04A11-反重力-统一核心原生与WASM构建-证据-v1/native/mp_cli.exe'),
     'plan', str(request), '--out', str(native_output)],
]
rows = []
for command in commands:
    start = time.perf_counter()
    result = subprocess.run(command, capture_output=True, text=True, encoding='utf-8', timeout=25)
    rows.append({'command': command, 'exitCode': result.returncode,
                 'wallMs': (time.perf_counter() - start) * 1000,
                 'stdout': result.stdout, 'stderr': result.stderr})
    if result.returncode != 0:
        raise RuntimeError(rows[-1])

wasm = json.loads(wasm_output.read_text(encoding='utf-8-sig'))
native = json.loads(native_output.read_text(encoding='utf-8-sig'))
previous = json.loads((source / 'raw_io/compact_states32.resp.json').read_text(encoding='utf-8-sig'))
assert native == wasm == previous
search = wasm['result']['search']
assert search['candidatesEnumerated'] == {'breakfast': 46, 'lunch': 186, 'dinner': 186}
assert not search['searchComplete']
record = {'passed': True, 'method': 'P01 independent bounded DP32 cold-call rerun, not benchmark',
          'sameAsDelivery': True, 'nativeWasmEqual': True, 'search': search, 'runs': rows}
(out / 'bounded-rerun.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
measurement = json.loads(rows[0]['stdout'])
print(json.dumps({'passed': True, 'nativeWasmEqual': True, 'sameAsDelivery': True,
                  'wasmCoreMs': measurement['coreMs'],
                  'peakLinearMemoryBytes': measurement['peakLinearMemoryBytes']}))

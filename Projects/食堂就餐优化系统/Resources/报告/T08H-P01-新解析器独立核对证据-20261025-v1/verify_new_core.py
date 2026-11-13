import hashlib
import json
import pathlib
import subprocess
import time

project = pathlib.Path(r'D:\项目\cpp\Projects\食堂就餐优化系统')
out = pathlib.Path(__file__).parent
a14 = project / 'Resources/报告/T04A14-内部Sol-全天DP有界搜索-证据-v1'
candidate = project / 'Resources/报告/T04A15-ZCode-解析器内存修复-证据-v1/candidate'
wasm = candidate / 'build/wasm/mp_core.wasm'
assert len(wasm.read_bytes()) == 107936
assert hashlib.sha256(wasm.read_bytes()).hexdigest() == '304fed667624ea93b4a77314cfcc74d09ac57b2a2f3a1d6a4ebf8ce79da370e8'
request = a14 / 'raw_io/compact_states32.req.json'
wasm_result = out / 'dp32-new-wasm.resp.json'
native_result = out / 'dp32-new-native.resp.json'
commands = [
    [str(candidate / 'build/native/mp_test_json_string.exe')],
    [str(candidate / 'build/native/mp_test_json.exe')],
    ['node', str(a14 / 'wasm-worker.mjs'), str(wasm), str(request), str(wasm_result)],
    [str(candidate / 'build/native/mp_cli.exe'), 'plan', str(request), '--out', str(native_result)],
]
runs = []
for command in commands:
    start = time.perf_counter()
    run = subprocess.run(command, cwd=project, capture_output=True, timeout=25)
    row = {'command': command, 'exitCode': run.returncode,
           'wallMs': (time.perf_counter() - start) * 1000,
           'stdout': run.stdout.decode('utf-8', errors='replace'),
           'stderr': run.stderr.decode('utf-8', errors='replace')}
    runs.append(row)
    assert run.returncode == 0, row

assert 'ALL PASS' in runs[0]['stdout']
assert 'ALL PASS' in runs[1]['stdout']
new_wasm = json.loads(wasm_result.read_text(encoding='utf-8-sig'))
new_native = json.loads(native_result.read_text(encoding='utf-8-sig'))
old = json.loads((a14 / 'raw_io/compact_states32.resp.json').read_text(encoding='utf-8-sig'))
assert new_wasm == new_native == old
measurement = json.loads(runs[2]['stdout'])
record = {'passed': True, 'method': 'P01 independent parser regressions and one DP32 new-core cold-call pair',
          'notPerformanceAcceptance': True, 'sameAsOldCore': True,
          'nativeWasmEqual': True, 'wasmMeasurement': measurement, 'runs': runs}
(out / 'verification.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'passed': True, 'nativeWasmEqual': True, 'sameAsOldCore': True,
                  'wasmCoreMs': measurement['coreMs'],
                  'peakLinearMemoryBytes': measurement['peakLinearMemoryBytes'],
                  'parserSummary': runs[0]['stdout'].strip().splitlines()[-1],
                  'jsonSummary': runs[1]['stdout'].strip().splitlines()[-1]}))

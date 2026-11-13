import hashlib
import json
import pathlib
import subprocess
import time

project = pathlib.Path(r'D:\项目\cpp\Projects\食堂就餐优化系统')
out = pathlib.Path(__file__).parent
a14 = project / 'Resources/报告/T04A14-内部Sol-全天DP有界搜索-证据-v1'
a16 = project / 'Resources/报告/T04A16-内部Sol-搜索资源整改-证据-v1'
a17 = project / 'Resources/报告/T04A17-ZCode-内存候选构建验证-证据-v1'
wasm = a17 / 'build/wasm/mp_core.wasm'
native = a17 / 'build/native/mp_cli.exe'
assert len(wasm.read_bytes()) == 109086
assert hashlib.sha256(wasm.read_bytes()).hexdigest() == '14abef2e1f5107d32b8be0613cbc543af2998cd41cbf529c608dd36c5570815d'
runs = []
measurements = []
for nodes in [1000, 200000]:
    name = 'candidate_native_nodes' + str(nodes)
    request = a16 / ('raw_io/' + name + '.req.json')
    response = out / ('wasm-' + str(nodes) + '.resp.json')
    command = ['node', str(a14 / 'wasm-worker.mjs'), str(wasm), str(request), str(response)]
    start = time.perf_counter()
    run = subprocess.run(command, cwd=project, capture_output=True, text=True, encoding='utf-8', timeout=25)
    assert run.returncode == 0, run.stderr
    measured = json.loads(run.stdout)
    expected = json.loads((a16 / ('raw_io/' + name + '.resp.json')).read_text(encoding='utf-8-sig'))
    actual = json.loads(response.read_text(encoding='utf-8-sig'))
    assert actual == expected
    measurements.append({'nodes': nodes, 'coreMs': measured['coreMs'],
                         'linearMemoryBytes': measured['peakLinearMemoryBytes']})
    runs.append({'command': command, 'exitCode': run.returncode,
                 'wallMs': (time.perf_counter() - start) * 1000,
                 'stdout': run.stdout, 'stderr': run.stderr})

request = a16 / 'raw_io/candidate_native_nodes200000.req.json'
native_response = out / 'native-200000.resp.json'
command = [str(native), 'plan', str(request), '--out', str(native_response)]
run = subprocess.run(command, cwd=project, capture_output=True, text=True, encoding='utf-8', timeout=25)
assert run.returncode == 0, run.stderr
assert json.loads(native_response.read_text(encoding='utf-8-sig')) == json.loads((out / 'wasm-200000.resp.json').read_text(encoding='utf-8-sig'))
runs.append({'command': command, 'exitCode': run.returncode, 'stdout': run.stdout, 'stderr': run.stderr})
assert measurements[0]['linearMemoryBytes'] == measurements[1]['linearMemoryBytes'] == 2490368
record = {'passed': True, 'nativeWasmEqualAt200000Nodes': True,
          'memoryEqualAt1000And200000Nodes': True, 'samples': measurements,
          'notPerformanceAcceptance': True, 'runs': runs}
(out / 'verification.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({key: record[key] for key in ['passed', 'nativeWasmEqualAt200000Nodes', 'samples']}))

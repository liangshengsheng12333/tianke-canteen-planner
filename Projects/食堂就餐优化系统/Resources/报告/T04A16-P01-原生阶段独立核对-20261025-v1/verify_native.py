import hashlib
import json
import pathlib
import subprocess
import time

project = pathlib.Path(r'D:\项目\cpp\Projects\食堂就餐优化系统')
source = project / 'Resources/报告/T04A16-内部Sol-搜索资源整改-证据-v1'
out = pathlib.Path(__file__).parent
native = source / 'candidate/build/native'
exe = native / 'mp_cli.exe'
assert hashlib.sha256(exe.read_bytes()).hexdigest() == 'b1cabd9b20109ab0be14b633213c272cd60c36ed09576ecca6f720f2f1010acc'
request = source / 'raw_io/candidate_native_nodes1000.req.json'
response = out / 'candidate-native-nodes1000.resp.json'
commands = [[str(native / name)] for name in
            ['mp_test_sha256.exe', 'mp_test_json.exe', 'mp_test_core.exe']]
commands.append([str(exe), 'plan', str(request), '--out', str(response)])
runs = []
for command in commands:
    started = time.perf_counter()
    run = subprocess.run(command, cwd=project, capture_output=True, timeout=25)
    row = {'command': command, 'exitCode': run.returncode,
           'wallMs': (time.perf_counter() - started) * 1000,
           'stdout': run.stdout.decode('utf-8', errors='replace'),
           'stderr': run.stderr.decode('utf-8', errors='replace')}
    runs.append(row)
    assert run.returncode == 0, row
for row in runs[:3]:
    assert 'ALL PASS' in row['stdout'], row
actual = json.loads(response.read_text(encoding='utf-8-sig'))
recorded = json.loads((source / 'raw_io/candidate_native_nodes1000.resp.json').read_text(encoding='utf-8-sig'))
reference = json.loads((source / 'raw_io/reference_native_nodes1000.resp.json').read_text(encoding='utf-8-sig'))
assert actual == recorded
assert {k: v for k, v in actual.items() if k != 'requestId'} == {
    k: v for k, v in reference.items() if k != 'requestId'}
assert not actual['result']['search']['searchComplete']
record = {'passed': True, 'nativeBaselineEquivalentAt1000Nodes': True,
          'newWasmVerified': False, 'runs': runs,
          'note': 'P01 reran native regressions and one bounded real-menu case; no new WASM was available.'}
(out / 'verification.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({'passed': True, 'nativeBaselineEquivalentAt1000Nodes': True,
                  'newWasmVerified': False, 'summaries': [r['stdout'].strip().splitlines()[-1] for r in runs[:3]]}))

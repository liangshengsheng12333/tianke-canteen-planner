import hashlib
import json
import os
import pathlib
import subprocess

project = pathlib.Path(r'D:\项目\cpp\Projects\食堂就餐优化系统')
source = project / 'Resources/报告/T04A18-内部Sol-真实求解时限-证据-v1'
out = pathlib.Path(__file__).parent
wasm = source / 'candidate/build/wasm/mp_core.wasm'
controlled = source / 'candidate/build/native/mp_clock_cli.exe'
assert len(wasm.read_bytes()) == 111521
assert hashlib.sha256(wasm.read_bytes()).hexdigest() == '8a817926bde039b74672fa17974323574aebdb2b41fd8d9815b0e11bff3a4ad8'
runs = []
cases = []

def execute(name, request_path, mode, cutoff=1000000000, native=False):
    response_path = out / (name + '.resp.json')
    env = os.environ.copy()
    if native:
        command = [str(controlled), 'plan', str(request_path), '--out', str(response_path)]
        env['A18_CLOCK_MODE'] = mode
        env['A18_CLOCK_AFTER'] = str(cutoff)
    else:
        command = ['node', str(source / 'worker.mjs'), str(wasm), str(request_path),
                   str(response_path), mode, str(cutoff)]
    run = subprocess.run(command, cwd=project, env=env, capture_output=True,
                         text=True, encoding='utf-8', timeout=25)
    assert run.returncode == 0, (name, run.stdout, run.stderr)
    response = json.loads(response_path.read_text(encoding='utf-8-sig'))
    measurement = None if native else json.loads(run.stdout)
    runs.append({'name': name, 'command': command, 'exitCode': run.returncode,
                 'stdout': run.stdout, 'stderr': run.stderr, 'measurement': measurement})
    return response, measurement

for algorithm, first in [('greedy', 86), ('dp', 70), ('branchandbound', 77)]:
    for has_plan in [False, True]:
        kind = 'with' if has_plan else 'without'
        request_path = source / ('raw_io/timeout_' + kind + '_plan_' + algorithm + '_wasm.req.json')
        cutoff = first if has_plan else first - 1
        prefix = algorithm + '-' + kind
        a, _ = execute(prefix + '-native', request_path, 'step', cutoff, native=True)
        b, measured = execute(prefix + '-wasm', request_path, 'step', cutoff)
        assert a == b
        result = b['result']
        assert not result['search']['searchComplete']
        assert any(c['limit'] == 'wallClockMs' for c in result['search']['capsHit'])
        if has_plan:
            assert result['plans']
            assert all(len(p['meals']) == 3 and 'APPROXIMATE_TIMEOUT' in p['flags']
                       and 'SEARCH_LIMIT_REACHED' in p['flags'] for p in result['plans'])
        else:
            assert result['status'] == 'ResourceLimited' and result['plans'] == []
        cases.append({'algorithm': algorithm, 'completePlanRetained': has_plan,
                      'nativeWasmEqual': True, 'clockReads': measured['clockReads']})

null_request = source / 'raw_io/null_greedy_wasm.req.json'
null_response, null_measurement = execute('null-clock-forbidden', null_request, 'forbidden')
assert null_measurement['clockReads'] == 0
assert null_response == json.loads((source / 'raw_io/null_greedy_wasm.resp.json').read_text(encoding='utf-8-sig'))

real_request = json.loads((source / 'base.req.json').read_text(encoding='utf-8-sig'))
real_request['requestId'] = 'p01-a18-realclock'
real_request['plannerConfig']['algorithm'] = 'dp'
real_request['plannerConfig']['limits']['wallClockMs'] = 1
real_path = out / 'real-clock.req.json'
real_path.write_text(json.dumps(real_request, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
real, real_measurement = execute('real-one-ms', real_path, 'real')
assert any(c['limit'] == 'wallClockMs' for c in real['result']['search']['capsHit'])
assert real_measurement['clockReads'] > 0 and real_measurement['solvePolledMs'] >= 1
bad, _ = execute('backwards-clock', real_path, 'backwards')
assert not bad['ok'] and bad['error']['code'] == 'INTERNAL_ERROR'
assert bad['error']['fieldPath'] == '$.plannerConfig.limits.wallClockMs'
native_real_path = out / 'real-native.resp.json'
native_real_command = [str(source / 'candidate/build/native/mp_cli.exe'), 'plan', str(real_path), '--out', str(native_real_path)]
native_real_run = subprocess.run(native_real_command, cwd=project, capture_output=True,
                                 text=True, encoding='utf-8', timeout=25)
assert native_real_run.returncode == 0
native_real = json.loads(native_real_path.read_text(encoding='utf-8-sig'))
assert any(c['limit'] == 'wallClockMs' for c in native_real['result']['search']['capsHit'])
runs.append({'name': 'real-native-one-ms', 'command': native_real_command,
             'exitCode': native_real_run.returncode, 'stdout': native_real_run.stdout,
             'stderr': native_real_run.stderr})

record = {'passed': True, 'controlledNativeWasmCases': cases,
          'nullClockReads': null_measurement['clockReads'],
          'realSolvePolledMs': real_measurement['solvePolledMs'],
          'realCoreMs': real_measurement['coreMs'],
          'realClockCapsHit': real['result']['search']['capsHit'],
          'badClockVisibleError': True, 'realNativeClockTriggered': True,
          'notWeChatVerification': True, 'runs': runs}
(out / 'verification.json').write_text(json.dumps(record, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({key: record[key] for key in ['passed', 'nullClockReads', 'realSolvePolledMs',
                                            'realCoreMs', 'badClockVisibleError']}))

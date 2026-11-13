import hashlib
import json
import pathlib
import re

project = pathlib.Path(r'D:\项目\cpp\Projects\食堂就餐优化系统')
source = project / 'Resources/报告/T04A14-内部Sol-全天DP有界搜索-证据-v1'
raw = source / 'raw_io'
checks = []

def check(name, condition, detail=None):
    checks.append({'name': name, 'pass': bool(condition), 'detail': detail})
    if not condition:
        raise AssertionError(name)

request_bytes = (raw / 'compact_states32.req.json').read_bytes()
tokens = list(re.finditer(rb'"(?:\\.|[^"\\])*"', request_bytes))
reserved = sum(len(request_bytes) - token.start() for token in tokens)
check('parser allocation proof from input bytes',
      (len(request_bytes), len(tokens), reserved) == (98312, 3618, 158133908),
      {'requestBytes': len(request_bytes), 'tokens': len(tokens), 'reservedBytes': reserved})
json_source = (project / 'core/src/json.cpp').read_text(encoding='utf-8-sig')
check('actual source uses remaining document capacity',
      re.search(r'maxBytes\s*=\s*length\s*-\s*pos', json_source) is not None and
      'arena->Alloc(maxBytes + 1, 1)' in json_source)

names = ['compact_states32', 'ignored_wall_complete', 'budget600',
         'lunch_window_lock', 'soldout_first_chuanxiang', 'lunch_item_lock']
responses = {}
for name in names:
    wasm = (raw / (name + '.resp.json')).read_bytes()
    native = (raw / (name + '.native.resp.json')).read_bytes()
    check(name + ' native/WASM bytes', native.rstrip() == wasm.rstrip())
    responses[name] = json.loads(wasm)

dp = responses['compact_states32']['result']
check('all three meals and full candidate coverage',
      dp['search']['candidatesEnumerated'] == {'breakfast': 46, 'lunch': 186, 'dinner': 186})
check('approximation is explicit', not dp['search']['searchComplete'] and
      all('APPROXIMATE_DISCRETIZATION' in p['flags'] and 'SEARCH_LIMIT_REACHED' in p['flags']
          for p in dp['plans']))
budget = responses['budget600']['result']
check('600-cent witness remains within budget', bool(budget['plans']) and
      all(p['budget']['plannedTotalCents'] <= 600 and not p['budget']['overBudget']
          for p in budget['plans']))

key_count = 0
for path in raw.glob('*.resp.json'):
    envelope = json.loads(path.read_text(encoding='utf-8-sig'))
    for plan in (envelope.get('result') or {}).get('plans', []):
        rows = []
        for meal in sorted(plan['meals'], key=lambda m: ['breakfast', 'lunch', 'dinner'].index(m['meal'])):
            quantities = {}
            for item in meal['items']:
                quantities[item['offerId']] = quantities.get(item['offerId'], 0) + item['quantity']
            rows.append([meal['meal'], meal['windowId'], [[key, quantities[key]] for key in sorted(quantities)]])
        expected = 'plan:' + hashlib.sha256(json.dumps(rows, ensure_ascii=False,
                                                      separators=(',', ':')).encode()).hexdigest()
        check('canonical planKey ' + str(key_count), expected == plan['planKey'])
        key_count += 1

output = {'checks': len(checks), 'allPassed': all(x['pass'] for x in checks),
          'planKeyArtifacts': key_count, 'nativeWasmPairs': len(names),
          'note': 'Existing delivery artifacts independently recomputed; no performance rerun.',
          'items': checks}
out_path = pathlib.Path(__file__).with_name('verification.json')
out_path.write_text(json.dumps(output, ensure_ascii=False, indent=2), encoding='utf-8')
print(json.dumps({k: output[k] for k in ['checks', 'allPassed', 'planKeyArtifacts', 'nativeWasmPairs']}))

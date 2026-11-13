import { connect } from './client.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';

const store = 'Resources/工具/todokit/验证任务.json';
const evidence = { package: '@j0hanz/todokit-mcp@2.1.0', checks: [], responses: [] };
let client = await connect(store);
async function call(name, args) {
  const r = await client.callTool({name, arguments: args});
  evidence.responses.push({name, response: r});
  return r;
}
try {
  const tools = await client.listTools();
  assert.equal(tools.tools.length, 6);
  evidence.tools = tools.tools.map(t => t.name);
  evidence.checks.push('MCP initialize and tools/list');
  const before = await fs.access('D:/项目/cpp/' + store).then(() => true, () => false);
  assert.equal(before, false, 'verification store must be new');
  await call('add_todos', { items: [
    { description: '验证新增和重启保留', priority: 'high', category: 'testing' },
    { description: '保留第二项验证完成后持久化', priority: 'low', category: 'testing' },
  ] });
  const data = JSON.parse(await fs.readFile('D:/项目/cpp/' + store, 'utf8'));
  evidence.storageShape = Object.keys(data);
  const todos = Array.isArray(data) ? data : data.todos;
  assert.equal(todos.length, 2);
  const id = todos[0].id;
  await call('update_todo', { id, description: '验证更新已成功' });
  await call('complete_todo', { id });
  await client.close();
  client = await connect(store);
  const listed = await call('list_todos', { status: 'all' });
  const text = JSON.stringify(listed);
  assert.match(text, /验证更新已成功/);
  assert.match(text, /completed/);
  evidence.checks.push('create, update, complete, close, restart, read persisted tasks');
  const bad = await call('add_todo', { description: '', priority: 'high', category: 'testing' });
  assert.equal(bad.isError, true);
  evidence.checks.push('invalid empty description rejected');
  evidence.passed = true;
} finally {
  await client.close();
  await fs.writeFile(new URL('./验证结果.json', import.meta.url), JSON.stringify(evidence, null, 2));
}
console.log(JSON.stringify({ passed: evidence.passed, tools: evidence.tools, checks: evidence.checks }, null, 2));

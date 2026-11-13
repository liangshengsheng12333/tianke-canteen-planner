import { connect } from './client.mjs';
import fs from 'node:fs/promises';
const store = 'Resources/工具/todokit/任务数据.json';
const client = await connect(store);
try {
  const exists = await fs.access('D:/项目/cpp/' + store).then(() => true, () => false);
  if (!exists) {
    await client.callTool({ name: 'add_todos', arguments: { items: [
      {description:'安装本地待办MCP，验证读写与持久化并接入Codex', priority:'high', category:'work'},
      {description:'按AGENTS、MEMORY、Resources和Projects规则整理目录并验证原件哈希', priority:'high', category:'docs'},
      {description:'完成P01、P09真实窗口只读报到和P00到P01交接', priority:'high', category:'work'},
      {description:'准备反重力、DSH完整初始化包，等待用户手动转交和外部报到确认', priority:'medium', category:'docs'},
    ] } });
  }
  const data = JSON.parse(await fs.readFile('D:/项目/cpp/' + store, 'utf8'));
  const todos = Array.isArray(data) ? data : data.todos;
  const index = Number(process.argv[2] ?? 0);
  await client.callTool({ name:'complete_todo', arguments:{id:todos[index].id} });
  console.log(JSON.stringify(await client.callTool({name:'list_todos',arguments:{status:'all'}}),null,2));
} finally { await client.close(); }

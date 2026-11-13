import { connect } from './client.mjs';
const descriptions = [
  'S20-1 核对最新规则与资源，明确P01定位并形成今日简要计划',
  'S20-2 用户确认今日计划并核实反重力与DSH接入现状',
  'S20-3 补齐外部报到并逐份准备核对T01协作提示词，用户手动转交',
  'S20-4 统一冻结T01契约归属与配置，P09独立核验，P02查收证据',
  'S20-5 满足前置后推进T02原生到WASM到小程序真机最小链路',
  'S20-6 日终汇总分层结果与障碍并同步MEMORY及待办',
];
const client = await connect('Resources/工具/todokit/任务数据.json');
try {
  const checked = async (name, args) => {
    const r = await client.callTool({name, arguments: args});
    if (r.isError || r.structuredContent?.ok === false) throw new Error(JSON.stringify(r));
    return r.structuredContent.result;
  };
  let result = await checked('list_todos', {status:'all'});
  const missing = descriptions.filter(d => !result.items.some(t => t.description === d));
  if (missing.length) await checked('add_todos', {items:missing.map(description => ({description, priority:'high', category:'work'}))});
  result = await checked('list_todos', {status:'all'});
  const first = result.items.find(t => t.description === descriptions[0]);
  if (!first.completed) await checked('complete_todo', {id:first.id});
  result = await checked('list_todos', {status:'all'});
  console.log(JSON.stringify(result.items.filter(t=>descriptions.includes(t.description)).map(t=>({id:t.id,description:t.description,completed:t.completed})),null,2));
} finally { await client.close(); }

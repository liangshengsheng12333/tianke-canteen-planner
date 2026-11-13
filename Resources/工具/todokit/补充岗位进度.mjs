import {connect} from './client.mjs';
const client=await connect('Resources/工具/todokit/任务数据.json');
const descriptions=[
 'R20-1 补齐P02与P04岗位规范和初始化任务卡',
 'R20-2 创建P02与P04真实窗口并核实只读报到',
 'R20-3 登记身份与报到证据并补交P01',
];
try {
 let r=await client.callTool({name:'list_todos',arguments:{status:'all'}});
 let items=r.structuredContent.result.items;
 const missing=descriptions.filter(d=>!items.some(t=>t.description===d));
 if(missing.length) await client.callTool({name:'add_todos',arguments:{items:missing.map(description=>({description,priority:'high',category:'docs'}))}});
 r=await client.callTool({name:'list_todos',arguments:{status:'all'}});
 items=r.structuredContent.result.items;
 const number=Number(process.argv[2]);
 if(number>0) await client.callTool({name:'complete_todo',arguments:{id:items.find(t=>t.description===descriptions[number-1]).id}});
 r=await client.callTool({name:'list_todos',arguments:{status:'all'}});
 console.log(JSON.stringify(r.structuredContent.result.items.filter(t=>t.description.startsWith('R20-')).map(t=>({description:t.description,completed:t.completed})),null,2));
} finally {await client.close();}

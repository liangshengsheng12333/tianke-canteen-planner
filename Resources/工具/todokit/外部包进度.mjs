import {connect} from './client.mjs';
import fs from 'node:fs/promises';
const store='Resources/工具/todokit/任务数据.json';
const client=await connect(store);
try {
 const data=JSON.parse(await fs.readFile('D:/项目/cpp/'+store,'utf8'));
 const todos=Array.isArray(data)?data:data.todos;
 const combined=todos.find(t=>t.description.startsWith('准备反重力、DSH完整初始化包'));
 if(combined) {
  await client.callTool({name:'update_todo',arguments:{id:combined.id,description:'等待用户手动转交反重力、DSH初始化包并带回外部报到确认'}});
  const added=await client.callTool({name:'add_todo',arguments:{description:'准备反重力、DSH完整只读初始化包及反馈模板',priority:'medium',category:'docs'}});
  const r=added.structuredContent??JSON.parse(added.content.find(c=>c.type==='text').text);
  const id=r.result?.id??r.result?.item?.id;
  if(!id) throw Error('missing added todo ID');
  await client.callTool({name:'complete_todo',arguments:{id}});
 }
 const result=await client.callTool({name:'list_todos',arguments:{status:'all'}});
 console.log(JSON.stringify(result.structuredContent??result,null,2));
} finally {await client.close();}

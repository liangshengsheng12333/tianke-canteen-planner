import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root='D:/项目/cpp';
const project=path.join(root,'Projects/食堂就餐优化系统');
const res=path.join(project,'Resources');
const skill='C:/Users/link/.codex/plugins/cache/liangsheng-share/liangsheng/2.0.0/skills/liangsheng-workflow';
const read=p=>fs.readFile(p,'utf8');
const manifest=[];
for(const [role,model,tasks,scope] of [
 ['反重力','Gemini 3.8 Flash日常；Gemini 4复杂问题；原生档位未指定',['T01','T02','T03','T05','T08','T10'],'小程序页面、交互、本地数据、菜单整理、WASM调用侧、真机协作。DSH唯一实现正式营养计算，UI消费结果。'],
 ['DSH','DeepSeek V4.1 Flash；原生档位未指定',['T01','T02','T04','T07'],'C++17核心、三种手写算法、营养公式/目标唯一实现、原生CLI、WASM导出侧、正确性/性能实验。不得覆盖小程序页面。'],
]) {
 const sections=[];
 sections.push(`# ${role}｜完整初始化包\n\n包版本：2026-10-20-init-v1。由用户手动转交，本文生成不代表已送达。\n\n你是${role}外部Agent，初始化阶段只读报到。用户本轮仅要初始化，业务内容以后再说；无论日期变化都不自动开工。请先核对平台、实际模型/档位、原生执行状态、准确目录和可访问范围；不要求平台使用Codex的Default名称。请求配置为${model}，实际不同则如实报告，不静默换模型，不新增付费。身份使用本平台可核实会话标识，未知写未知，不捏造Codex threadId。\n\n应用根D:\\项目\\cpp；实际项目资料根D:\\项目\\cpp\\Projects\\食堂就餐优化系统。不能向旧工作流路径新建内容。若同文件夹可读，实际读取项目AGENTS、MEMORY四文件、主PRD和下附相关任务卡，并报告读取路径/版本/主PRD哈希。读不到本地资料则下附正文可作初始化输入，注明“包内材料，未核实本地可访问”，不能据此声称读写权限通过。链接/技能路径不可达不代表对应规则缺失，下附完整必要规则。\n\n未来职责：${scope}本次不实施，不写业务提示词、不编码、不安装业务依赖、不核算营养、不跑业务实验、不改MEMORY或他人文件、不对外发送。只在本平台回复报到，用户手动带回P00；没有授权直接联系P01。P00/P01登记接收前不能声称整体初始化完成。\n\n报到反馈模板：\n- 平台与会话身份（来源/未知）；实际模型、档位、额度（可核实则写，不可核实未知）\n- 实际原生模式、可访问目录/只读范围、已读绝对路径或包内来源\n- PRD v0.2与包版本/哈希；职责边界和任务依赖理解\n- 本次实际做了什么、未做业务；缺失资料/冲突\n- 是否仅待命；请用户将完整反馈原文交回P00\n\n接回：P00核对包版本和原始反馈，登记证据类型。用户口头“外部初始化完成”只能记用户确认，不能冒称平台实跑验证。后续只有真实P01收到用户开工并满足G3后才派发业务任务。\n\n以下为初始化时的来源正文快照；后续实时变化统一以项目MEMORY为准。`);
 const inputs=[
  ['用户根规则',path.join(root,'AGENTS.md')],
  ['项目协作规范',path.join(project,'AGENTS.md')],
  ['当前项目索引',path.join(project,'MEMORY/MEMORY.md')],
  ['已做决定',path.join(project,'MEMORY/决策点.md')],
  ['当前事实快照',path.join(project,'MEMORY/事实.md')],
  ['当前未完成项',path.join(project,'MEMORY/待办.md')],
  ['课设原文提取（58段，原DOCX哈希见迁移记录）',path.join(res,'历史资料/课设要求-文本摘录.txt')],
  ['批准计划原文',path.join(res,'历史资料/原工作流/批准计划.md')],
  ['当前产品规格',path.join(res,'主PRD.md')],
  ['全员规则正文（外部身份按本包平台解释）',path.join(skill,'references/全员共用提示词前缀.md')],
  ['动态选技能正文（网页顾问本项目未启用）',path.join(skill,'references/动态驱动.md')],
  ['代码简洁约定正文（供以后获批任务使用）',path.join(skill,'references/代码简洁约定.md')],
 ];
 const taskFiles=await fs.readdir(path.join(res,'任务卡'));
 for(const task of tasks) {const name=taskFiles.find(n=>n.startsWith(task+'-')); inputs.push([task+'任务规格（本次不执行）',path.join(res,'任务卡',name)]);}
 for(const [title,p] of inputs) {
  const body=await read(p);
  sections.push(`\n\n---\n\n## ${title}\n\n来源绝对路径：${p.replaceAll('/','\\')}\n\n${body}`);
 }
 const content=sections.join('\n');
 const file=path.join(res,'初始化包',role+'-只读初始化包.md');
 await fs.writeFile(file,content,'utf8');
 manifest.push({role,file,sha256:createHash('sha256').update(content).digest('hex').toUpperCase(),bytes:Buffer.byteLength(content),status:'prepared_not_sent',requestedModel:model});
}
await fs.writeFile(path.join(res,'初始化包/包清单.json'),JSON.stringify({version:'2026-10-20-init-v1',packages:manifest},null,2));
console.log(JSON.stringify(manifest,null,2));

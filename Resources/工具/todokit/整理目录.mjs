import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root = 'D:/项目/cpp';
const project = path.join(root, 'Projects/食堂就餐优化系统');
const archive = path.join(project, 'Resources/历史资料');
const hash = async p => createHash('sha256').update(await fs.readFile(p)).digest('hex').toUpperCase();
const safe = p => { const resolved = path.resolve(p); if (!resolved.toLowerCase().startsWith(path.resolve(root).toLowerCase() + path.sep)) throw Error('outside workspace: '+p); return resolved; };
const exists = p => fs.access(p).then(()=>true,()=>false);
async function write(p,text) { safe(p); await fs.mkdir(path.dirname(p),{recursive:true}); await fs.writeFile(p,text,'utf8'); }
async function files(dir) { const out=[]; for (const e of await fs.readdir(dir,{withFileTypes:true})) { const p=path.join(dir,e.name); if(e.isDirectory()) out.push(...await files(p)); else out.push(p); } return out; }
if (await exists(project)) throw Error('project already exists; do not overwrite');
const old = path.join(root,'工作流');
const sourceFiles = await files(old);
const docx = path.join(root,'面向对象程序设计C++-期末编程汇报题-20261009.docx');
const manifest=[];
for (const p of [...sourceFiles,docx]) {
  const target = p===docx ? path.join(archive,path.basename(p)) : path.join(archive,'原工作流',path.relative(old,p));
  manifest.push({old:p,new:target,sha256:await hash(p)});
}
await write(path.join(root,'Resources/目录整理方案.md'),`# 初始化目录整理方案\n\n2026-10-20 Asia/Shanghai。用户已要求“严格按照新要求整理文件夹”，并多次指示继续。\n\n问题：原工作流混合规则、实时状态和参考资料。成功标准：根目录及项目分别具有AGENTS、MEMORY四文件、Resources；Projects内单独项目；原件哈希不变，活动链接可读。范围仅初始化文件和已授权待办工具，不写业务。\n\n映射：原工作流整体移至Projects/食堂就餐优化系统/Resources/历史资料/原工作流；课设DOCX移至同层历史资料；主PRD与任务卡生成活动参考副本；工作规则合入项目AGENTS；状态、决策、未完成项拆入MEMORY四文件。根Resources保留工具和本整理方案。\n\n可逆性：只移动原件并生成新文件；无删除、无覆盖原件、无对外发送或费用。恢复时先保存新内容，再按迁移清单将原件移回；旧路径会停止使用，所有新入口须同步更新。应用登记根和默认cwd仍为D:\\项目\\cpp，项目资料根为其下Projects/食堂就餐优化系统。\n\n待解决：P01/P09只读报到及外部用户转交确认。\n`);
await fs.mkdir(archive,{recursive:true});
safe(old); safe(path.join(archive,'原工作流'));
await fs.rename(old,path.join(archive,'原工作流'));
safe(docx); safe(path.join(archive,path.basename(docx)));
await fs.rename(docx,path.join(archive,path.basename(docx)));
for(const m of manifest) { if(await hash(m.new)!==m.sha256) throw Error('hash mismatch '+m.new); }
await write(path.join(root,'Resources/目录迁移清单.json'),JSON.stringify({date:'2026-10-20',verified:manifest.length,files:manifest},null,2));
const oldArchive = path.join(archive,'原工作流');
const rootRules = await fs.readFile('C:/Users/link/.codex/AGENTS.md','utf8');
await write(path.join(root,'AGENTS.md'),rootRules);
let conventions = await fs.readFile(path.join(oldArchive,'执行与记录约定.md'),'utf8');
conventions = conventions.replace(/^# .*\r?\n/,'').replace(/^版本.*\r?\n/m,'')
 .replace(/3\. 本版是文档整改；[^\r\n]*/,'3. 实时身份、送达、进度与候选统一从本项目MEMORY读取；历史资料仅作来源，不能覆盖当前记录。')
 .replaceAll('D:\\项目\\cpp\\工作流\\报告',project.replaceAll('/','\\')+'\\Resources\\报告')
 .replaceAll('D:\\项目\\cpp\\工作流',project.replaceAll('/','\\'))
 .replaceAll('总表','MEMORY索引').replaceAll('执行与记录约定','项目AGENTS');
await write(path.join(project,'AGENTS.md'),`# 食堂就餐优化系统｜项目协作规则\n\n继承根目录AGENTS.md。本文件只记录项目特有岗位与工作流程；实时事实、授权状态、实际配置、决策和待办见MEMORY四文件。\n\n## 路径与记录入口\n\n应用登记工作区与聊天默认cwd为D:\\项目\\cpp。读取及未来业务文件前定位本项目根D:\\项目\\cpp\\Projects\\食堂就餐优化系统，不能在旧工作流路径新建文件。只在获准任务范围写入；首次报到在聊天回复，P00记录，避免并发覆盖MEMORY。\n\n主PRD和任务卡在Resources；规则在本文件；进度/身份/候选在MEMORY；报告、模板与历史材料在Resources。角色卡是规范入口，岗位规则以下文为准。业务任务完成后即时清理待办，并同步索引。\n\n## 岗位职责\n\n- P00：整理初始化资料，核查/创建真实员工窗口，核实只读实读报到，准备外部初始化包，向真实P01交接。不能冒充员工报到或外部接入。\n- P01：开工授权后统一接口、调度、集成、事实/决策/待办维护和交付。负责T01契约与归属、T06集成和T10素材，协调其他任务。不得用自身报告替代P09独立验收。报到不重建PRD、不派业务。\n- P09：只验不修，开工后独立核对营养来源与算例、算法、唯一候选A01—A12和证据。缺输入/真机不判通过，发现交P01；报到不开始业务总审。\n- 反重力：开工后负责小程序页面、交互、本地存储、真实菜单、调用侧WASM接入与真机协作；不另写正式营养计算，不覆盖DSH文件。\n- DSH：开工后负责C++17三算法、营养公式与目标唯一实现、原生CLI、WASM导出侧、独立参照与性能实验；不改小程序页面。\n\n## 报到与交接\n\n员工实际实读本项目AGENTS、MEMORY四文件、主PRD、本人角色卡和相关任务卡及指定技能正文，核实版本与目录，回复职责、已读清单、实际模式/配置或未知、缺失项和待命。仅创建窗口或收到材料不算已读。新身份由创建者工具回执补发，不能从cwd或标题推断。不得擅自发消息给其他聊天。\n\n${conventions.trim()}\n`);
const res = path.join(project,'Resources');
for (const d of ['任务卡','角色卡','报告','初始化包']) await fs.mkdir(path.join(res,d),{recursive:true});
let prd=await fs.readFile(path.join(oldArchive,'主PRD.md'),'utf8');
prd=prd.replace(/^版本：[^\r\n]*/m,'版本：v0.2。2026-10-20仅整理归属与路径，产品需求未改。阶段、身份与确认状态见[项目索引](../MEMORY/MEMORY.md)。')
 .replace(/## 7\. 岗位、模型、费用与连接[\s\S]*?(?=## 8\.)/,'## 7. 岗位、模型、费用与连接\n\n岗位工作规则见[项目AGENTS](../AGENTS.md)；已选模型/预算/连接安排见[决策点](../MEMORY/决策点.md)，真实身份及可核实实际配置见[事实](../MEMORY/事实.md)。本节不维护第二份实时状态。\n\n')
 .replace(/## 10\. 缺失输入与阶段确认[\s\S]*?(?=## 11\.)/,'## 10. 缺失输入与阶段确认\n\n当前缺失输入、责任与阻塞见[待办](../MEMORY/待办.md)；用户确认及阶段决定见[决策点](../MEMORY/决策点.md)，最新状态见[项目索引](../MEMORY/MEMORY.md)。\n\n')
 .replaceAll('(执行与记录约定.md)','(../AGENTS.md)').replaceAll('(主PRD-v0.2-续行确认记录.md)','(历史资料/原工作流/主PRD-v0.2-续行确认记录.md)')
 .replaceAll('(报告/PRD-v0.2-修订复核.md)','(历史资料/原工作流/报告/PRD-v0.2-修订复核.md)')
 .replaceAll('10/19，完成文档后待确认','10/19初稿；当前确认状态见MEMORY')
 .replaceAll('当前均未派发业务任务','实时派发状态见MEMORY，任务卡本身不构成业务指令');
await write(path.join(res,'主PRD.md'),prd);
for (const p of await files(path.join(oldArchive,'任务卡'))) {
 let t=await fs.readFile(p,'utf8');
 t=t.replaceAll('(../总表.md)','(../../MEMORY/MEMORY.md)').replaceAll('(../执行与记录约定.md)','(../../AGENTS.md)')
  .replaceAll('D:\\项目\\cpp\\工作流\\报告',project.replaceAll('/','\\')+'\\Resources\\报告')
  .replaceAll('D:\\项目\\cpp\\工作流',res.replaceAll('/','\\'))
  .replaceAll('状态、实际身份/模型及送达情况以[总表]','状态、实际身份/模型及送达情况以[MEMORY索引]')
  .replaceAll('当前仍未派发、未开始，无业务候选。','本卡不维护第二份实时状态。');
 if(path.basename(p).startsWith('T00')) t='# T00｜初始化文档（历史任务入口）\n\n原卡及当时验收语句保留在[历史资料](../历史资料/原工作流/任务卡/T00-初始化文档.md)。当前初始化范围与状态见[项目MEMORY](../../MEMORY/MEMORY.md)；历史“待确认”不覆盖现有决定。\n';
 await write(path.join(res,'任务卡',path.basename(p)),t);
}
for (const name of ['P00-初始化','P01-总指挥','P09-独立验收','反重力-小程序','DSH-C++算法']) {
 await write(path.join(res,'角色卡',name+'.md'),`# ${name}｜角色入口\n\n岗位职责、权限和工作流程统一见[项目AGENTS](../../AGENTS.md)。身份、请求与实际模型、报到进度见[事实](../../MEMORY/事实.md)；工作状态见[索引](../../MEMORY/MEMORY.md)。原v0.2角色卡作为[历史参考](../历史资料/原工作流/角色卡/${name}.md)保留，不作为当前状态源。\n`);
}
const missing=await fs.readFile(path.join(oldArchive,'待补资料清单.md'),'utf8');
const missingTable=missing.slice(missing.indexOf('| 编号'),missing.indexOf('本轮需要的阶段决定')).trim();
await write(path.join(project,'MEMORY/待办.md'),`# 待办\n\n更新：2026-10-20 Asia/Shanghai。只保留未完成事项，解决后清除并同步索引。\n\n## 初始化剩余\n\n- P01/P09真实聊天只读实读报到，P00交接并核实P01接收。\n- 反重力与DSH完整初始化包交用户手动转交，取得外部报到/用户确认。\n\n## 后续业务输入（本轮不启动）\n\n${missingTable.replace(/\| M08[^\r\n]*\r?\n/,'')}\n\n外部实际模型、额度与平台身份仍待用户/外部报到核实。业务开工尚待用户在真实P01明确下令。\n`);
await write(path.join(project,'MEMORY/决策点.md'),`# 决策点\n\n- 已批准食堂就餐优化系统：微信原生小程序TS/WXML/WXSS+C++17共享核心、原生CLI与WASM；三种手写算法及独立穷举参照。产品规格见Resources/主PRD.md，课设原文归档，硬要求不缩减。\n- 用户“根据新修改的内容继续吧”：采用v0.2进入员工只读初始化；不是逐条重新签署，也不是业务开工。历史解释原件保留。\n- 用户“严格按照新要求整理文件夹”：使用根AGENTS/MEMORY/Resources及Projects下项目同结构，原工作流原件归档并保留哈希。实时总表/缺项归入MEMORY，不继续维护旧入口。\n- 用户“今天的任务就是先做好初始化 后续的内容明天再说”，之后多次“继续”：本轮完成工具与目录初始化、员工只读报到、外部包和交接；跨日不自动开工。\n- 用户对TodoWrite“给你权限 自己去安装”“去安装啊 自己搜索去”：授权安装待办工具。选本地持久化Todokit 2.1.0提供对应能力，非声称安装Claude原生TodoWrite；不用付费服务，不改业务依赖。官方npm连接失败后使用npmmirror镜像，固定版本，安装时禁用脚本。\n- 模型请求：P00/P01沿用户默认，不覆盖；P09 gpt-6-luna/high；反重力Gemini 3.8 Flash日常、Gemini 4复杂；DSH DeepSeek V4.1 Flash。原生档位未指定。实际配置另见事实，不以请求冒充。无新增现金授权，不接付费模型API；网页顾问不启用，不设P11。\n- 未知营养：用户已采用建议规则，有来源/份量的估算可参选；关键营养仍未知只手选/锁定/记录，总量标不完整，不当零。细则见PRD3.1。预算、跨日与锁定等既定行为见PRD，T01后续冻结字段与算例。\n- PPT由用户后续用反重力制作；2026-10-28汇报。使用红米K90 Pro Max真机，不要求iPhone；现场运行条件待补。\n`);
await write(path.join(project,'MEMORY/事实.md'),`# 事实\n\n更新：2026-10-20 Asia/Shanghai。\n\n## 路径、版本与当前阶段\n\n- 应用登记工作区/聊天默认cwd：D:\\项目\\cpp；项目内容根：D:\\项目\\cpp\\Projects\\食堂就餐优化系统。projectId：2d1d0d85-feb4-469d-bd90-b9d1bc7e0775，hostId：local，非Git。\n- 当前产品PRD v0.2，目录整理没有修改产品需求。原件Resources/历史资料/原工作流，迁移逐项哈希证据在根Resources/目录迁移清单.json，共${manifest.length}个原文件已核对。\n- 员工只读初始化进行中；无业务候选、代码、构建、算法/真机测试、独立总审或发布。待办工具安装不等于业务工具链安装。\n- 指定技能安装根：C:\\Users\\link\\.codex\\plugins\\cache\\liangsheng-share\\liangsheng\\2.0.0\\skills。工作流主技能SHA256：430082D89F0DF6746618224534F94E26A7CEC87EECF9098E8FEE559A57B95238。\n\n## 岗位登记\n\n| 岗位 | 真实身份/host | 请求配置 | 可核实实际配置 | 报到状态 |\n|---|---|---|---|---|\n| P00 | 01a154c3-21d1-7ed2-8317-ba8f83b0b312/local，创建者工具回执 | 用户默认未覆盖 | 未知 | 实读v0.2，执行初始化，当前Default |\n| P01 | 待创建 | 默认未覆盖 | 未知 | 未创建/未报到 |\n| P09 | 待创建 | gpt-6-luna/high | 未知 | 未创建/未报到 |\n| 反重力 | 外部身份未知 | 见决策点 | 未知 | 未转交/未报到 |\n| DSH | 外部身份未知 | 见决策点 | 未知 | 未转交/未报到 |\n\n## 待办工具\n\n- @j0hanz/todokit-mcp 2.1.0，Node24.19.0，pnpm11.25.0；安装根D:\\项目\\cpp\\Resources\\工具\\todokit。依赖固定主包、锁文件已保存，禁用安装脚本。\n- 实际MCP暴露6项工具：add_todo、add_todos、list_todos、update_todo、complete_todo、delete_todo。协议握手、读写、修改、完成、重启持久化、拒绝空描述验证通过；原始结果见根Resources/工具/todokit/验证结果.json。\n- Codex用户配置注册todowrite_cpp，codex mcp get成功解析为enabled=true。备份C:\\Users\\link\\.codex\\config.toml.before-todowrite-20261020.bak。当前会话工具列表尚未热加载，实际通过本地MCP客户端调用；不冒称原生TodoWrite。\n- 本轮进度JSON在根Resources/工具/todokit/任务数据.json，项目未完成事项以本MEMORY/待办.md为准。\n`);
await write(path.join(project,'MEMORY/MEMORY.md'),`# 食堂就餐优化系统｜索引与摘要\n\n更新：2026-10-20 Asia/Shanghai。阶段：员工只读初始化进行中，业务未开工，外部未确认，整体初始化尚未完成。\n\n- [事实](事实.md)：准确路径、v0.2、真实窗口和模型证据、待办工具安装结果。\n- [决策点](决策点.md)：v0.2续行、严格目录分类、本轮只初始化、模型/费用/产品已定项。\n- [待办](待办.md)：P01/P09报到与交接、外部接入和后续业务输入。\n- [项目规则](../AGENTS.md)、[主PRD](../Resources/主PRD.md)、[任务卡](../Resources/任务卡/)、[历史资料](../Resources/历史资料/)。\n\n应用登记根仍为D:\\项目\\cpp；项目根为D:\\项目\\cpp\\Projects\\食堂就餐优化系统。根Resources/目录迁移清单.json保存原件哈希；旧工作流不再作为活动入口。\n`);
await write(path.join(root,'MEMORY/MEMORY.md'),`# 工作区索引\n\n更新：2026-10-20 Asia/Shanghai。\n\n- [事实](事实.md)：项目位置与本地待办MCP配置。\n- [决策点](决策点.md)：严格分类与本轮范围。\n- [待办](待办.md)：唯一活动项目未完事项入口。\n- 活动项目：[食堂就餐优化系统](../Projects/食堂就餐优化系统/MEMORY/MEMORY.md)。\n`);
await write(path.join(root,'MEMORY/事实.md'),'# 工作区事实\n\n- 工作区D:\\项目\\cpp，应用项目登记不变；活动项目Projects/食堂就餐优化系统。\n- Resources/工具/todokit为已安装的本地待办工具，配置名todowrite_cpp，验证通过；原始结果及安装状态见项目事实。\n- 根AGENTS沿用用户新规则；全工作区当前无业务代码或Git仓库。\n');
await write(path.join(root,'MEMORY/决策点.md'),'# 工作区决策\n\n- 2026-10-20按用户“严格按照新要求整理文件夹”采用Projects内项目、AGENTS/MEMORY/Resources分类，旧资料保真归档。\n- 本轮仅初始化；用户明确业务内容以后再说，跨日不自动启动。工具安装已获用户直接授权。细项以项目决策点为准。\n');
await write(path.join(root,'MEMORY/待办.md'),'# 工作区待办\n\n- 食堂就餐优化系统的初始化未完事项与后续业务输入，统一见[项目待办](../Projects/食堂就餐优化系统/MEMORY/待办.md)。\n');
console.log(JSON.stringify({project,originalsVerified:manifest.length,rootEntries:await fs.readdir(root)},null,2));

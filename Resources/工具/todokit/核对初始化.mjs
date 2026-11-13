import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
const root='D:/项目/cpp';
const project=path.join(root,'Projects/食堂就餐优化系统');
const manifest=JSON.parse(await fs.readFile(path.join(root,'Resources/目录迁移清单.json'),'utf8'));
const failures=[];
for(const m of manifest.files) {
 const h=createHash('sha256').update(await fs.readFile(m.new)).digest('hex').toUpperCase();
 if(h!==m.sha256) failures.push('original hash changed '+m.new);
}
async function walk(dir) { const out=[];for(const e of await fs.readdir(dir,{withFileTypes:true})){const p=path.join(dir,e.name);if(e.isDirectory())out.push(...await walk(p));else if(p.endsWith('.md'))out.push(p);}return out;}
const active=[path.join(root,'AGENTS.md'),...await walk(path.join(root,'MEMORY')),path.join(project,'AGENTS.md'),...await walk(path.join(project,'MEMORY')),path.join(project,'Resources/主PRD.md'),...await walk(path.join(project,'Resources/角色卡')),...await walk(path.join(project,'Resources/任务卡'))];
for(const p of active) {
 const text=await fs.readFile(p,'utf8');
 if(/[\u200B-\u200F\u202A-\u202E\u2060\uFEFF]/u.test(text))failures.push('invisible Unicode '+p);
 for(const m of text.matchAll(/\]\(([^)]+)\)/g)) {
  const link=m[1].replace(/^<|>$/g,'').split('#')[0];
  if(!link || /^https?:\/\//.test(link))continue;
  const target=path.resolve(path.dirname(p),decodeURIComponent(link));
  if(!(await fs.access(target).then(()=>true,()=>false))) failures.push(`broken link ${p} -> ${link}`);
 }
}
for(const dir of [path.join(root,'MEMORY'),path.join(project,'MEMORY')]) {
 const names=(await fs.readdir(dir)).sort();
 if(JSON.stringify(names)!==JSON.stringify(['MEMORY.md','事实.md','决策点.md','待办.md'].sort()))failures.push('wrong MEMORY contents '+dir);
}
const report={originalsVerified:manifest.files.length,activeMarkdownChecked:active.length,failures,passed:failures.length===0};
await fs.writeFile(path.join(root,'Resources/目录核对结果.json'),JSON.stringify(report,null,2));
console.log(JSON.stringify(report,null,2));
if(failures.length)process.exitCode=1;

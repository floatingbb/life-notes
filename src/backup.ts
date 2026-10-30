import {readJson} from './api-read';
import {sendDiary} from './diary-request';
export async function readJournal(includeTrash=false,onProgress:(s:string)=>void=()=>{}){
 let result:any=null;const posts:any[]=[];
 for(const view of includeTrash?['active','trash']:['active']){
  let cursor='',seen=new Set<string>();do{const q=new URLSearchParams();if(view==='trash')q.set('view','trash');if(cursor)q.set('cursor',cursor);const d=await readJson('/api/diary?'+q);result=result||d;posts.push(...d.posts);onProgress(`已读取 ${posts.length} 则记录…`);cursor=d.nextCursor||'';if(cursor&&seen.has(cursor))throw Error('翻页读取失败，请重新导出');seen.add(cursor)}while(cursor);
 }
 return {...result,posts:[...new Map(posts.map(p=>[p.id,p])).values()]};
}
export function inspectBackup(value:any){
 if(value?.application!=='日子之间'||!Array.isArray(value.posts)||!Array.isArray(value.members)||value.posts.length>20000)throw Error('请选择「日子之间」导出的 JSON 备份');
 if(!value.me)throw Error('这是旧版备份，缺少账号标识。请先用新版重新导出 JSON，再导入。旧文件仍可供查看。');
 const own=value.posts.filter((p:any)=>p.author===value.me);if(!own.length)throw Error('这份备份没有可恢复的本人记录');
 for(const p of own){if(typeof p.id!=='string'||typeof p.body!=='string'||p.body.length>5000||!Number.isFinite(Date.parse(p.created))||!Array.isArray(p.images)||p.images.length>3||!Array.isArray(p.comments||[]))throw Error('备份里的记录格式不正确');for(const image of [...p.images,...(p.comments||[]).map((c:any)=>c.image).filter(Boolean)])if(typeof image!=='string'||image.length>205000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image))throw Error('备份有一张照片无效，请使用包含照片的 JSON 备份');for(const c of p.comments||[])if(typeof c.body!=='string'||c.body.length>1000||!Number.isFinite(Date.parse(c.created)))throw Error('备份里的留言格式不正确')}
 return {backup:value,own,total:own.length,hidden:own.filter((p:any)=>p.deleted).length,skipped:value.posts.length-own.length};
}
export async function copyDraftImages(images:string[]){
 const result=[];for(const image of images){if(image.startsWith('data:')){result.push(image);continue}if(!/^\/api\/photo\/[A-Za-z0-9_-]+\/[0-2]$/.test(image))throw Error('草稿照片引用不正确');const r=await fetch(image,{cache:'no-store'});if(!r.ok)throw Error('原照片已更新或删除，请先移除草稿中无法读取的照片');const blob=await r.blob();result.push(await new Promise<string>((resolve,reject)=>{const f=new FileReader();f.onload=()=>resolve(String(f.result));f.onerror=()=>reject(Error('照片读取失败'));f.readAsDataURL(blob)}))}return result;
}
async function digest(s:string){const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s));return Array.from(new Uint8Array(bytes),b=>b.toString(16).padStart(2,'0')).join('')}
export async function restoreBackup(plan:ReturnType<typeof inspectBackup>,progress:(s:string)=>void){
 const {backup,own}=plan;let done=0;
 for(const p of own){progress(`正在恢复第 ${done+1}/${own.length} 则记录…`);const source=await digest(JSON.stringify([backup.me,p]));const saved=await sendDiary({action:'importPost',source,body:p.body,images:p.images,created:p.created,mode:p.mode,hidden:!!p.deleted,originalScope:p.scope,originalAuthor:backup.members.find((m:any)=>m.id===p.author)?.name||'本人'});
 for(const [i,c]of (p.comments||[]).entries())await sendDiary({action:'importComment',id:saved.id,source:await digest(source+':'+i),body:c.body,image:c.image||'',created:c.created,name:backup.members.find((m:any)=>m.id===c.author)?.displayName||backup.members.find((m:any)=>m.id===c.author)?.name||c.importedName||'家人'});
 done++;
 }
 return done;
}

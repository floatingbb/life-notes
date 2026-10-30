import {memoryCandidates,visibleTo} from './journal-query.mjs';
import {journalMonth} from './journal-date.mjs';
// A stable keyset cursor keeps pagination independent of newly inserted records.
export function decodeCursor(cursor){if(!cursor)return null;try{const p=JSON.parse(Buffer.from(cursor,'base64url').toString());if(!/^\d{4}-\d\d-\d\dT[\d:.]+Z$/.test(p.created)||!/^[A-Za-z0-9_-]{1,80}$/.test(p.id))throw Error();return p}catch{throw Object.assign(Error('翻页位置已失效，请刷新后重试'),{status:400})}}
export async function pagePosts(store,me,trash,options={}){
 const {cursor,limit=30,filter='all'}=options;const after=decodeCursor(cursor),size=Math.max(1,Math.min(30,limit));let posts;
 if(options.entry){const p=await store.get('posts/'+options.entry);return {posts:p&&visibleTo(p,me.id)?[p]:[],nextCursor:null}}
 if(store.pagePosts)posts=await store.pagePosts(me.id,trash,after,size+1,filter,false,options);
 else posts=(options.memory?await memoryCandidates(store,me.id,options):await store.list('posts/')).filter(p=>(trash?!!p.deleted&&p.author===me.id:!p.deleted&&(p.author===me.id||p.scope==='family'||p.scope==='selected'&&p.recipients.includes(me.id)))&&(!options.memory||!options.month||options.month==='all'||journalMonth(p.created)===options.month)&&(trash||filter!=='mine'||p.author===me.id)&&(trash||filter!=='family'||p.author!==me.id)).sort((a,b)=>b.created.localeCompare(a.created)||b.id.localeCompare(a.id)).filter(p=>!after||p.created<after.created||p.created===after.created&&p.id<after.id).slice(0,size+1);
 const more=posts.length>size;posts=posts.slice(0,size);const last=posts.at(-1);return {posts,nextCursor:more?Buffer.from(JSON.stringify({created:last.created,id:last.id})).toString('base64url'):null};
}
// Production uses an atomic conditional UPDATE / INSERT in PostgreSQL.
// The fallback is for the in-memory adapter used by the regression suite.
export async function compareWrite(store,key,previous,next){
 if(store.compareWrite)return store.compareWrite(key,previous,next);
 const current=await store.get(key);if(JSON.stringify(current)!==JSON.stringify(previous))return false;await store.set(key,next);return true;
}

import {journalMonth} from './journal-date.mjs';
export const visibleTo=(p,id)=>!p.deleted&&(p.author===id||p.scope==='family'||p.scope==='selected'&&(p.recipients||[]).includes(id));
export function memoryOptions(q){
 const month=q.get('month')||'all',search=(q.get('search')||'').trim(),author=q.get('author')||'';
 if(month!=='all'&&!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)||search.length>80||author&&!/^[A-Za-z0-9_-]{1,80}$/.test(author))throw Object.assign(Error('筛选条件不正确'),{status:400});
 return {memory:true,month,search,author,favorites:q.get('favorites')==='1',includeMonths:!q.get('cursor')};
}
export async function memoryCandidates(store,id,options={}){
 const [posts,favorites]=await Promise.all([store.list('posts/'),store.list('favorites/'+id+'/')]);const saved=new Set(favorites.filter(f=>f.active).map(f=>f.entry));
 return posts.filter(p=>visibleTo(p,id)&&(!options.author||p.author===options.author)&&(!options.search||p.body.toLocaleLowerCase().includes(options.search.toLocaleLowerCase()))&&(!options.favorites||saved.has(p.id)));
}
export async function allMonths(store,id,options){if(store.memoryMonths)return store.memoryMonths(id,options);return [...new Set((await memoryCandidates(store,id,options)).map(p=>journalMonth(p.created)))].sort().reverse()}
export async function activityData(store,id,since,until){
 if(store.activity)return store.activity(id,since,until);
 const [posts,comments,state]=await Promise.all([store.list('posts/'),store.list('comments/'),store.get?store.get('activity/'+id):null]),allowed=posts.filter(p=>visibleTo(p,id));
 const fresh=allowed.filter(p=>p.author!==id&&(p.sharedAt||p.created)>since&&(p.sharedAt||p.created)<=until).map(p=>({kind:'post',entry:p.id,author:p.author,created:p.sharedAt||p.created}));
 const participated=new Map();for(const c of comments)if(c.author===id&&(!participated.has(c.entry)||c.created<participated.get(c.entry)))participated.set(c.entry,c.created);
 const own=new Set(allowed.filter(p=>p.author===id).map(p=>p.id)),visible=new Set(allowed.map(p=>p.id));
 const replies=comments.filter(c=>c.author!==id&&c.created>since&&c.created<=until&&visible.has(c.entry)&&(own.has(c.entry)||participated.has(c.entry)&&participated.get(c.entry)<=c.created)).map(c=>({kind:'reply',entry:c.entry,author:c.author,created:c.created,id:c.id,subject:own.has(c.entry)?'own':'participated'}));
 const unread=e=>e.created>(state?.entrySeen?.[e.entry]||since),newPosts=fresh.filter(unread),newReplies=replies.filter(unread);
 return {newPosts:newPosts.length,newReplies:newReplies.length,items:[...newPosts,...newReplies].sort((a,b)=>b.created.localeCompare(a.created)).slice(0,30)};
}

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
 const [posts,comments]=await Promise.all([store.list('posts/'),store.list('comments/')]),allowed=posts.filter(p=>visibleTo(p,id));
 const fresh=allowed.filter(p=>p.author!==id&&(p.sharedAt||p.created)>since&&(p.sharedAt||p.created)<=until).map(p=>({kind:'post',entry:p.id,author:p.author,created:p.sharedAt||p.created}));
 const replies=comments.filter(c=>c.author!==id&&c.created>since&&c.created<=until&&allowed.some(p=>p.id===c.entry&&p.author===id)).map(c=>({kind:'reply',entry:c.entry,author:c.author,created:c.created,id:c.id}));
 return {newPosts:fresh.length,newReplies:replies.length,items:[...fresh,...replies].sort((a,b)=>b.created.localeCompare(a.created)).slice(0,30)};
}

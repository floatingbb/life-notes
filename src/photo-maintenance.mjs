import {purgeUnusedPhotos} from './photo-cleanup.mjs';
export function createPhotoMaintenance(store,bucket){
const assert=(r,op)=>{if(r.error)throw Error(op+'_'+(r.error.code||'FAILED'));return r.data};
return async function cleanPhotos(cursor){
 if(typeof cursor!=='string'||cursor.length>2000)throw Error('PHOTO_CURSOR');
 const result=assert(await bucket.list('',{limit:30,...(cursor?{cursor}:{}),sortBy:{column:'name',order:'asc'}}),'PHOTO_LIST');
 const files=Array.isArray(result)?result:result?.objects||result?.data||[];
 const old=files.filter(f=>/^[a-f0-9]{64}\.jpg$/.test(f.name)&&Number.isFinite(Date.parse(f.updated_at||f.created_at||f.last_modified||''))&&Date.parse(f.updated_at||f.created_at||f.last_modified)<Date.now()-86400000).map(f=>f.name);
 const [posts,comments]=await Promise.all([store.list('posts/'),store.list('comments/')]);const used=new Set([...posts.flatMap(p=>p.images||[]),...comments.map(c=>c.image).filter(Boolean)]);
 const unused=old.filter(k=>!used.has(k));if(unused.length)assert(await bucket.remove(unused),'PHOTO_DELETE');
 const jobs=await store.stalePhotoJobs();
 // Uploaded objects younger than a day may belong to a still-running save.
 for(const row of jobs){await purgeUnusedPhotos(row.value.images,{listPosts:async()=>posts,listComments:async()=>comments,removePhotos:async keys=>{assert(await bucket.remove(keys),'PHOTO_DELETE')}});await store.removeMany([row.key])}
 return {ok:true,scanned:files.length,removed:unused.length,nextCursor:result.hasNext?result.nextCursor||result.nextCursorKey:null};
 };
}

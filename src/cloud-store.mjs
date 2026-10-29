export function createRecordStore(db){
const assert=(r,op)=>{if(r.error)throw Error(op+'_'+(r.error.code||'FAILED'));return r.data};
return {
 async stalePhotoJobs(){const r=assert(await db.from('our_days_records').select('key,value').or('key.like.photoJobs/%,key.like.uploads/%').lt('value->>created',new Date(Date.now()-86400000).toISOString()).order('key').limit(5),'DB_JOBS');return r||[]},
 async compareWrite(key,previous,value){
  if(!previous){const r=await db.from('our_days_records').insert({key,value});if(r.error?.code==='23505')return false;assert(r,'DB_INSERT');return true}
  const rows=assert(await db.from('our_days_records').update({value}).eq('key',key).eq('value',JSON.stringify(previous)).select('key'),'DB_COMPARE');return rows?.length===1;
 },
 async pagePosts(id,trash,after,limit,filter,probe=false){
  const rules=[trash?'value->>deleted.not.is.null':'value->>deleted.is.null'];
  if(trash||filter==='mine')rules.push('value->>author.eq.'+id);
  else {rules.push('or(value->>author.eq.'+id+',value->>scope.eq.family,and(value->>scope.eq.selected,value->recipients.cs.["'+id+'"]))');if(filter==='family')rules.push('value->>author.neq.'+id)}
  if(after)rules.push('or(value->>created.lt.'+after.created+',and(value->>created.eq.'+after.created+',value->>id.lt.'+after.id+'))');
  let query=db.from('our_days_records').select('value').like('key','posts/%');if(probe)query=query.eq('key','__no_matching_records__');return (assert(await query.or('and('+rules.join(',')+')').order('value->>created',{ascending:false}).order('value->>id',{ascending:false}).limit(limit),'DB_PAGE')||[]).map(r=>r.value);
 },
 async related(prefix,ids){if(!ids.length)return [];let all=[];for(let start=0;;start+=1000){const rows=assert(await db.from('our_days_records').select('value').like('key',prefix+'%').in('value->>entry',ids).order('key').range(start,start+999),'DB_RELATED')||[];all.push(...rows.map(r=>r.value));if(rows.length<1000)return all}},
 async removeMany(keys){if(keys.length)assert(await db.from('our_days_records').delete().in('key',keys),'DB_DELETE')},
 async setMany(rows){assert(await db.from('our_days_records').upsert(rows.map(([key,value])=>({key,value})),{onConflict:'key'}),'DB_WRITE')},
 async get(key){const data=assert(await db.from('our_days_records').select('value').eq('key',key).limit(1),'DB_GET');return data?.[0]?.value||null},
 async set(key,value){assert(await db.from('our_days_records').upsert({key,value},{onConflict:'key'}),'DB_WRITE')},
 async list(prefix){let all=[];for(let start=0;;start+=1000){const data=assert(await db.from('our_days_records').select('value').like('key',prefix+'%').order('key').range(start,start+999),'DB_LIST')||[];all.push(...data.map(d=>d.value));if(data.length<1000)break}return all}
};
}

import {createHash} from 'node:crypto';
import {compareWrite} from './record-pages.mjs';
const hash=s=>createHash('sha256').update(s).digest('hex');
const jpg=s=>typeof s==='string'&&s.length<=205000&&/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(s);
const problem=(message,status=400)=>{throw Object.assign(Error(message),{status})};
export async function importBackup(store,config,me,b){
 if(!/^[a-f0-9]{64}$/.test(b.source||''))problem('备份记录标识不正确');
 const recordId=hash(me.id+'\0backup\0'+b.source);
 if(b.action==='importPost'){
  if(typeof b.body!=='string'||b.body.length>5000||!Array.isArray(b.images)||b.images.length>3||b.images.some(s=>!jpg(s))||!Number.isFinite(Date.parse(b.created))||(!b.body.trim()&&!b.images.length))problem('备份记录内容不正确');
  const old=await store.get('posts/'+recordId);if(old)return {ok:true,id:old.id,existing:true};
  const p={id:recordId,author:me.id,body:b.body,images:config.persistImages?await config.persistImages(b.images,null):b.images,scope:'self',recipients:[],mode:['hug','comment','advice'].includes(b.mode)?b.mode:'hug',created:new Date(b.created).toISOString(),deleted:b.hidden?new Date().toISOString():null,revision:1,importSource:b.source};
  const inserted=await compareWrite(store,'posts/'+recordId,null,p);return {ok:true,id:recordId,existing:!inserted};
 }
 const p=await store.get('posts/'+b.id);if(!p||p.author!==me.id||!p.importSource)problem('只能恢复到本人从备份导入的记录',403);
 if(typeof b.body!=='string'||b.body.length>1000||(!b.body.trim()&&!b.image)||(b.image&&!jpg(b.image))||!Number.isFinite(Date.parse(b.created))||typeof b.name!=='string'||b.name.length>24)problem('备份留言格式不正确');
 const key='comments/'+recordId;if(await store.get(key))return {ok:true};
 const image=b.image?(config.persistImages?(await config.persistImages([b.image],null))[0]:b.image):'';
 await compareWrite(store,key,null,{id:recordId,entry:p.id,author:me.id,body:b.body,...(image?{image}:{}),importedName:b.name,created:new Date(b.created).toISOString()});return {ok:true};
}

import {memoryOptions,allMonths,activityData} from './journal-query.mjs';
import {importBackup} from './restore.mjs';
import {pagePosts,compareWrite} from './record-pages.mjs';
import {createHash,createHmac,randomBytes,timingSafeEqual,randomUUID,createCipheriv,createDecipheriv} from 'node:crypto';
const hash=s=>createHash('sha256').update(s).digest('hex');
const eq=(a,b)=>{const x=Buffer.from(String(a)),y=Buffer.from(String(b));return x.length===y.length&&timingSafeEqual(x,y)};
const json=(data,status=200,headers={})=>Response.json(data,{status,headers:{'Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer',...headers}});
const cleanMember=m=>({id:m.id,name:m.name,...(m.avatar?{avatar:m.avatar}:{})});
const validId=s=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(s);
const canSee=(p,id)=>p.author===id||p.scope==='family'||(p.scope==='selected'&&p.recipients.includes(id));
export function createApp(store,config){
 const {ownerPassword,sessionSecret,secure=true}=config;
 const configReady=typeof ownerPassword==='string'&&ownerPassword.length>=12&&typeof sessionSecret==='string'&&sessionSecret.length>=32;
 const sign=s=>createHmac('sha256',sessionSecret).update(s).digest('base64url');
 const cookieName=secure?'__Host-ourdays':'ourdays_local';
 const cookie=(v,age=2592000)=>`${cookieName}=${v}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${age}${secure?'; Secure':''}`;
 const ownerVersion=()=>hash(ownerPassword).slice(0,24);
 const linkKey=createHash('sha256').update('our-days-invite-links\0'+sessionSecret).digest();
 function seal(code,m){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',linkKey,iv);cipher.setAAD(Buffer.from(m.id+'\0'+m.revision));const bytes=Buffer.concat([cipher.update(code,'utf8'),cipher.final()]);return {memberId:m.id,revision:m.revision,iv:iv.toString('base64url'),tag:cipher.getAuthTag().toString('base64url'),data:bytes.toString('base64url')}}
 function unseal(value,m){if(!value||value.memberId!==m.id||value.revision!==m.revision)return null;const decipher=createDecipheriv('aes-256-gcm',linkKey,Buffer.from(value.iv,'base64url'));decipher.setAAD(Buffer.from(m.id+'\0'+m.revision));decipher.setAuthTag(Buffer.from(value.tag,'base64url'));return Buffer.concat([decipher.update(Buffer.from(value.data,'base64url')),decipher.final()]).toString('utf8')}
 async function commit(rows){if(store.setMany)return store.setMany(rows);await Promise.all(rows.map(([key,value])=>store.set(key,value)))}
 
 async function removeKeys(keys){if(store.removeMany)return store.removeMany(keys);for(const key of keys)await store.remove(key)}
 async function fixedLabel(m){if(m&&!m.accessLabel){m={...m,accessLabel:m.name};await store.set('members/'+m.id,m)}return m}
 async function owner(){let m=await store.get('members/owner');if(!m){m={id:'owner',name:'我',active:true,revision:ownerVersion()};await store.set('members/owner',m)}return {...await fixedLabel(m),revision:ownerVersion()}}
 async function member(id){return id==='owner'?owner():fixedLabel(await store.get('members/'+id))}
 function issue(m){const payload=Buffer.from(JSON.stringify({id:m.id,rev:m.revision,exp:Date.now()+2592000000})).toString('base64url');return payload+'.'+sign(payload)}
 async function authenticate(req){try{const value=(req.headers.get('cookie')||'').split(';').map(v=>v.trim()).find(v=>v.startsWith(cookieName+'='))?.slice(cookieName.length+1);if(!value)return null;const [p,s,...rest]=value.split('.');if(rest.length||!s||!eq(s,sign(p)))return null;const token=JSON.parse(Buffer.from(p,'base64url'));if(!validId(token.id)||token.exp<Date.now())return null;const m=await member(token.id);if(!m||!m.active||m.revision!==token.rev)return null;return m}catch{return null}}
 async function list(prefix){return store.list(prefix)}
 async function rateLimit(req,failed=false){const ip=req.headers.get('eo-connecting-ip')||req.headers.get('x-real-ip')||'local';const key='limits/'+hash(ip).slice(0,32),now=Date.now(),old=await store.get(key);let r=old&&old.until>now?old:{count:0,until:now+600000};if(r.count>=25)return false;if(failed){r.count++;await store.set(key,r)}return true}
 async function body(req){const reader=req.body?.getReader();if(!reader)return {};let total=0,chunks=[];while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>750000){await reader.cancel();throw Object.assign(Error('内容太大，请减少照片'),{status:413})}chunks.push(value)}return JSON.parse(Buffer.concat(chunks).toString('utf8'))}
 async function snapshot(me,trash=false,options={}){const page=await pagePosts(store,me,trash,options);const all=page.posts,ids=all.map(p=>p.id);const [raw,comments,hugs,remarks,favorites]=await Promise.all([list('members/'),store.related?store.related('comments/',ids):list('comments/'),store.related?store.related('hugs/',ids):list('hugs/'),list('remarks/'+me.id+'/'),store.related?store.related('favorites/'+me.id+'/',ids):list('favorites/'+me.id+'/')]);const ms=await Promise.all(raw.map(fixedLabel));const pending=trash?await Promise.all((await list('purges/')).filter(j=>j.author===me.id).map(async j=>await store.get('posts/'+j.id)?null:{id:j.id,created:j.created})):[];const members=ms.filter(m=>m.active).map(m=>{const remark=m.id===me.id?'':remarks.find(r=>r.targetId===m.id)?.remark||'';return {...cleanMember(m),remark,displayName:remark||m.name}});return {me:me.id,members,nextCursor:page.nextCursor,...(options.memory&&options.includeMonths?{months:await allMonths(store,me.id,options)}:{}),...(trash?{pendingPurges:pending.filter(Boolean)}:{}),posts:all.filter(p=>trash?!!p.deleted&&p.author===me.id:!p.deleted&&canSee(p,me.id)).sort((a,b)=>String(trash?b.deleted:b.created).localeCompare(String(trash?a.deleted:a.created))).map(p=>{const {requestHash,requestId,...entry}=p;return {...entry,favorite:favorites.some(f=>f.entry===p.id&&f.active),images:config.photoUrl?p.images.map((x,i)=>config.photoUrl(p,i)):p.images,comments:comments.filter(c=>c.entry===p.id).sort((a,b)=>a.created.localeCompare(b.created)).map(c=>({...c,...(c.image&&config.commentPhotoUrl?{image:config.commentPhotoUrl(p,c)}:{})})),hugged:hugs.some(h=>h.entry===p.id&&h.author===me.id&&h.active),embraced:hugs.some(h=>h.entry===p.id&&h.active)}})}}

 return async function handle(req){try{
 if(!configReady)return json({error:'管理员尚未完成网站设置，请配置管理员密码和会话密钥。'},503);
 const path=new URL(req.url).pathname;
 if(!['GET','POST'].includes(req.method))return json({error:'不支持的操作'},405);
 if(req.method==='POST'&&req.headers.get('origin')!==new URL(req.url).origin)return json({error:'请求来源不匹配'},403);
 if(path==='/api/access'){
 const me=await authenticate(req);
 if(req.method==='GET')return json({authenticated:!!me,admin:me?.id==='owner',name:me?.name});
 const b=await body(req);
 if(b.action==='logout')return json({ok:true},200,{'Set-Cookie':cookie('',0)});
 if(b.action==='login'){
 if(!await rateLimit(req))return json({error:'尝试次数较多，请十分钟后再试。'},429);
 let m=null;if(b.type==='owner'&&(config.verifyOwner?await config.verifyOwner(String(b.password||'')):eq(hash(String(b.password||'')),hash(ownerPassword))))m=await owner();
 if(b.type==='family'&&typeof b.code==='string'&&/^[A-Za-z0-9_-]{43}$/.test(b.code)){const access=await store.get('access/'+hash(b.code));if(access){const found=await member(access.id);if(found?.active&&access.revision===found.revision)m=found}}
 if(!m){await rateLimit(req,true);return json({error:'密码或通行码不正确，或家人链接已撤销。'},401)}
 return json({ok:true,admin:m.id==='owner'},200,{'Set-Cookie':cookie(issue(m))});
 }
 if(!me)return json({error:'请先登录'},401);
 if(b.action==='invite'){
 if(me.id!=='owner')return json({error:'只有管理员可以邀请家人'},403);
 const name=String(b.name||'').trim().slice(0,24);if(!name)return json({error:'请填写家人的称呼'},400);
 if((await list('members/')).filter(m=>m.active).length>=30)return json({error:'此版本最多支持30位家人'},400);
 const code=randomBytes(32).toString('base64url'),m={id:randomUUID(),name,accessLabel:name,active:true,revision:randomBytes(12).toString('hex')};
 await commit([['members/'+m.id,m],['access/'+hash(code),{id:m.id,revision:m.revision}],['links/'+m.id,seal(code,m)]]);
 return json({ok:true,code,member:cleanMember(m)});
 }
 if(b.action==='listMembers'){if(me.id!=='owner')return json({error:'仅管理员可操作'},403);const [raw,links]=await Promise.all([list('members/'),list('links/')]);const members=await Promise.all(raw.map(fixedLabel));return json({members:members.filter(m=>m.active).map(m=>({...cleanMember(m),accessLabel:m.accessLabel,active:m.active,hasSavedLink:!!m.active&&links.some(v=>v.memberId===m.id&&v.revision===m.revision)}))})}
 if(['getInvite','saveInvite','regenerateInvite'].includes(b.action)){
 if(me.id!=='owner'||!validId(b.id)||b.id==='owner')return json({error:'只有管理员可以管理家人的链接'},403);
 const m=await member(b.id);if(!m||!m.active)return json({error:'该成员已撤销访问或不存在'},404);
 if(b.action==='getInvite'){const value=await store.get('links/'+m.id);const code=unseal(value,m);if(!code)return json({error:'旧版没有保存原链接，请补存原链接或重新生成。'},404);return json({ok:true,code})}
 if(b.action==='saveInvite'){if(typeof b.code!=='string'||! /^[A-Za-z0-9_-]{43}$/.test(b.code))return json({error:'请粘贴有效的专属链接'},400);const a=await store.get('access/'+hash(b.code));if(!a||a.id!==m.id||a.revision!==m.revision)return json({error:'这个链接不属于该成员，或已经失效。'},400);await store.set('links/'+m.id,seal(b.code,m));return json({ok:true})}
 if(b.confirm!==true)return json({error:'请确认重新生成：旧链接和该成员当前登录会失效。'},400);
 const code=randomBytes(32).toString('base64url'),updated={...m,revision:randomBytes(12).toString('hex')};await commit([['members/'+m.id,updated],['access/'+hash(code),{id:m.id,revision:updated.revision}],['links/'+m.id,seal(code,updated)]]);return json({ok:true,code});
 }
 
 if(b.action==='revoke'){if(me.id!=='owner'||b.id==='owner'||!validId(b.id))return json({error:'不能执行此操作'},403);const m=await member(b.id);if(!m)return json({error:'成员不存在'},404);await store.set('members/'+m.id,{...m,active:false,revision:randomBytes(12).toString('hex')});return json({ok:true})}
 return json({error:'不支持的操作'},400);
 }
 if(path.startsWith('/api/photo/')&&req.method==='GET'&&config.readPhoto){const me=await authenticate(req);if(!me)return json({error:'请先登录'},401);const parts=path.split('/'),id=parts[3];if(!validId(id))return json({error:'照片不存在'},404);const p=await store.get('posts/'+id);if(!p||(p.deleted?p.author!==me.id:!canSee(p,me.id)))return json({error:'照片不可访问'},404);let key;if(parts.length===6&&parts[4]==='comments'&&validId(parts[5])){const c=await store.get('comments/'+parts[5]);if(c?.entry===p.id)key=c.image}else if(parts.length===5){const index=Number(parts[4]);if(Number.isInteger(index)&&index>=0&&index<=2)key=p.images[index]}if(!key)return json({error:'照片不存在'},404);const bytes=await config.readPhoto(key);return new Response(bytes,{headers:{'Content-Type':'image/jpeg','Cache-Control':'no-store, private','X-Content-Type-Options':'nosniff'}});}
 if(path!=='/api/diary')return json({error:'页面不存在'},404);
 const me=await authenticate(req);if(!me){if(req.method==='GET'&&new URL(req.url).searchParams.get('bootstrap')==='1')return json({authenticated:false});return json({error:'请先登录'},401)}
 if(req.method==='GET'){
 const q=new URL(req.url).searchParams;
 if(q.get('view')==='activity'){const checkedAt=new Date().toISOString(),key='activity/'+me.id;let seen=await store.get(key);if(!seen){await compareWrite(store,key,null,{seenAt:checkedAt});seen=await store.get(key)}return json({...await activityData(store,me.id,seen?.seenAt||checkedAt,checkedAt),checkedAt})}
 const options={cursor:q.get('cursor'),filter:q.get('filter'),limit:30,...(q.get('entry')&&validId(q.get('entry'))?{entry:q.get('entry')}:{}),...(q.get('view')==='memory'?memoryOptions(q):{})};
 const readAt=new Date().toISOString(),result=await snapshot(me,q.get('view')==='trash',options);return json({...result,...(options.entry?{readAt}:{}),...(q.get('bootstrap')==='1'?{authenticated:true,admin:me.id==='owner',name:me.name}:{})})
 }
 const b=await body(req),id=me.id;
 if(b.action==='activitySeen'){if(typeof b.until!=='string'||!Number.isFinite(Date.parse(b.until))||Date.parse(b.until)>Date.now())return json({error:'提示时间不正确'},400);const until=new Date(b.until).toISOString(),key='activity/'+id;const entry=b.entry;if(entry!==undefined){if(!validId(entry))return json({error:'记录编号不正确'},400);const p=await store.get('posts/'+entry);if(!p||p.deleted||!canSee(p,id))return json({error:'这条记录不可访问'},404)}for(let i=0;i<5;i++){const old=await store.get(key),seenAt=old?.seenAt||until;let next;if(entry){const previous=old?.entrySeen?.[entry]||seenAt;if(previous>=until)return json({ok:true,...await activityData(store,id,seenAt,new Date().toISOString()),checkedAt:new Date().toISOString()});next={...old,seenAt,entrySeen:{...old?.entrySeen,[entry]:until}}}else{const latest=seenAt>until?seenAt:until;next={...old,seenAt:latest,entrySeen:Object.fromEntries(Object.entries(old?.entrySeen||{}).filter(([,at])=>at>latest))}}if(await compareWrite(store,key,old,next)){const checkedAt=new Date().toISOString();return json({ok:true,...await activityData(store,id,next.seenAt,checkedAt),checkedAt})}}return json({error:'提示状态暂未同步，请稍后重试'},503)}

 if(['importPost','importComment'].includes(b.action))return json(await importBackup(store,config,me,b));
 if(b.action==='cleanPhotos'){if(id!=='owner')return json({error:'仅管理员可清理云端照片'},403);if(!config.cleanPhotos)return json({error:'此部署暂不支持清理'},503);return json(await config.cleanPhotos(b.cursor||''))}

 if(b.action==='remark'){if(!validId(b.id)||b.id===id)return json({error:'请选择另一位家人设置备注'},400);const target=await member(b.id);if(!target?.active)return json({error:'这位家人已移除或不存在'},404);if(typeof b.remark!=='string'||b.remark.trim().length>24)return json({error:'备注请填写24字以内'},400);await store.set('remarks/'+id+'/'+target.id,{targetId:target.id,remark:b.remark.trim()});return json({ok:true})}
 if(b.action==='profile'){const name=b.name===undefined?me.name:String(b.name||'').trim().slice(0,24);if(!name)return json({error:'请填写称呼'},400);let avatar=me.avatar||'';if(b.avatar!==undefined){if(typeof b.avatar!=='string'||b.avatar.length>22000||(b.avatar!==''&&!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(b.avatar)))return json({error:'头像格式不支持，请选择照片后重试'},400);if(b.avatar){const bytes=Buffer.from(b.avatar.split(',')[1],'base64');if(bytes.length>16000||bytes[0]!==255||bytes[1]!==216||bytes[2]!==255||bytes.at(-2)!==255||bytes.at(-1)!==217)return json({error:'头像文件无效或过大，请换张照片'},400)}avatar=b.avatar}await store.set('members/'+id,{...me,name,avatar});return json({ok:true})}
 if(b.action==='save'){
 const requestId=validId(b.requestId)?b.requestId:null;const requestHash=hash(JSON.stringify([b.body,b.images,b.scope,b.recipients,b.mode,b.revision]));let previous=null;if(b.id){if(!validId(b.id))return json({error:'记录编号不正确'},400);previous=await store.get('posts/'+b.id);if(!previous||previous.deleted||previous.author!==id)return json({error:'只能修改自己的记录'},403)}
 if(previous?.requestId===requestId&&requestId&&previous.requestHash===requestHash)return json({ok:true,id:previous.id,revision:previous.revision});
 if(previous&&(Number(b.revision)||0)!==(previous.revision||0))return json({error:'这条记录已在另一台设备更新。你的草稿已保留，请先查看最新记录，再决定怎样修改。',conflict:true},409);
 const newId=previous?.id||(requestId?hash(id+'\0'+requestId):randomUUID());
 if(!previous&&requestId){const existing=await store.get('posts/'+newId);if(existing){if(existing.requestHash===requestHash&&!existing.deleted)return json({ok:true,id:existing.id,revision:existing.revision});return json({error:'这次保存已完成或内容已改变，请刷新记录后再试。',conflict:true},409)}}
 const text=String(b.body||'').trim(),images=Array.isArray(b.images)?b.images:[];
 if(text.length>5000||images.length>3||images.some(x=>typeof x!=='string'||(!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(x)&&!(config.photoUrl&&previous&&previous.images.some((_,i)=>config.photoUrl(previous,i)===x)))))return json({error:'内容或照片格式不支持'},400);
 if(!text&&!images.length)return json({error:'留下一句话或一张照片吧'},400);
 if(!['self','family','selected'].includes(b.scope)||!['hug','comment','advice'].includes(b.mode))return json({error:'请选择分享范围和回应方式'},400);
 const recipients=Array.isArray(b.recipients)?[...new Set(b.recipients.filter(validId))].slice(0,30):[];
 if(b.scope==='selected'&&!recipients.length)return json({error:'请选择家人'},400);
 const members=await list('members/');if(recipients.some(r=>!members.some(m=>m.id===r&&m.active)))return json({error:'家人尚未加入或已撤销访问'},400);
 const jobKey='photoJobs/'+randomUUID();if(previous?.images.length)await store.set(jobKey,{images:previous.images,created:new Date().toISOString()});
 const p={id:newId,author:id,body:text,images:config.persistImages?await config.persistImages(images,previous):images,scope:b.scope,recipients,mode:b.mode,...(b.scope!=='self'&&(!previous||previous.scope!==b.scope||JSON.stringify(previous.recipients)!==JSON.stringify(recipients))?{sharedAt:new Date().toISOString()}:previous?.sharedAt?{sharedAt:previous.sharedAt}:{}),created:previous?.created||new Date().toISOString(),deleted:null,revision:(previous?.revision||0)+1,...(requestId?{requestId,requestHash}:{})};
 if(!await compareWrite(store,'posts/'+p.id,previous,p)){const current=await store.get('posts/'+p.id);if(requestId&&current?.requestHash===requestHash&&!current.deleted)return json({ok:true,id:current.id,revision:current.revision});return json({error:'另一台设备刚刚修改了这条记录。草稿已保留，请查看最新记录后重试。',conflict:true},409)}
 let pendingCleanup=false;if(previous?.images.length){try{if(config.purgePhotos)await config.purgePhotos(previous.images);await removeKeys([jobKey])}catch{pendingCleanup=true}}
 return json({ok:true,id:p.id,revision:p.revision,pendingCleanup});
 }
 if(!validId(b.id))return json({error:'这条记录不可访问'},404);
 if(b.action==='purge'){
 const [p,old]=await Promise.all([store.get('posts/'+b.id),store.get('purges/'+b.id)]);if(!p&&!old)return json({error:'这条记录已不存在'},404);if((p||old).author!==id)return json({error:'只能彻底删除自己的记录'},403);if(p&&!p.deleted)return json({error:'请先收起记录，再到回收站彻底删除'},409);if(b.confirm!==true)return json({error:'请确认彻底删除，删除后无法在网站恢复'},400);
 const [comments,hugs]=p?await Promise.all([list('comments/'),list('hugs/')]):[[],[]];const linked=comments.filter(x=>x.entry===b.id);const job=old||{id:p.id,author:id,images:[...p.images,...linked.map(x=>x.image).filter(Boolean)],created:new Date().toISOString()};if(!old)await store.set('purges/'+b.id,job);
 if(p)await removeKeys(['posts/'+p.id,...linked.map(x=>'comments/'+x.id),...hugs.filter(x=>x.entry===p.id).map(x=>'hugs/'+x.entry+'_'+x.author)]);
 try{if(config.purgePhotos)await config.purgePhotos(job.images);await removeKeys(['purges/'+b.id])}catch{return json({error:'日记已删除，但云端照片清理尚未完成。请在回收站点击「重试清理」。',pendingCleanup:true},503)}
 return json({ok:true});
 }
 const p=await store.get('posts/'+b.id);if(!p||!canSee(p,id))return json({error:'这条记录不可访问'},404);
 if(b.action==='delete'||b.action==='restore'){if(p.author!==id)return json({error:'只能操作自己的记录'},403);if(b.action==='restore'&&await store.get('purges/'+p.id))await removeKeys(['purges/'+p.id]);if(!await compareWrite(store,'posts/'+p.id,p,{...p,revision:(p.revision||0)+1,deleted:b.action==='delete'?new Date().toISOString():null}))return json({error:'记录刚刚发生变化，请刷新后再操作'},409);return json({ok:true})}
 if(p.deleted)return json({error:'这条记录已收起'},404);
 if(b.action==='favorite'){if(typeof b.active!=='boolean')return json({error:'请选择收藏状态'},400);await store.set('favorites/'+id+'/'+p.id,{entry:p.id,active:b.active,created:new Date().toISOString()});return json({ok:true,patch:{id:p.id,favorite:b.active}})}
 if(b.action==='hug'){const key='hugs/'+p.id+'_'+id,old=await store.get(key);const active=!old?.active;await store.set(key,{entry:p.id,author:id,active});const hugs=store.related?await store.related('hugs/',[p.id]):await list('hugs/');return json({ok:true,patch:{id:p.id,hugged:active,embraced:hugs.some(h=>h.entry===p.id&&h.active)}})}
 if(b.action==='comment'){if(p.mode==='hug')return json({error:'这条记录只收拥抱'},403);const text=String(b.body||'').trim(),image=b.image||'';if(text.length>1000||(!text&&!image))return json({error:'请留下一句话或一张照片，文字不超过1000字'},400);if(typeof image!=='string'||image.length>205000||(image&&!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(image)))return json({error:'留言图片格式不支持，请重新选择一张照片'},400);const stored=image?(config.persistImages?(await config.persistImages([image],null))[0]:image):'';const c={id:randomUUID(),entry:p.id,author:id,body:text,...(stored?{image:stored}:{}),created:new Date().toISOString()};await store.set('comments/'+c.id,c);return json({ok:true,entry:p.id,comment:{...c,...(c.image&&config.commentPhotoUrl?{image:config.commentPhotoUrl(p,c)}:{})}})}

 return json({error:'不支持的操作'},400);
 }catch(e){return json({error:e.status?e.message:'暂时未能完成操作，请保留当前输入，稍后重试。'},e.status||503)}}
}

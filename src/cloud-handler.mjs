import cloudbase from '@cloudbase/js-sdk';
import {createHash,randomBytes,scryptSync,timingSafeEqual} from 'node:crypto';
import {createApp} from './core.mjs';
import {cloudConfig} from './cloud-config.mjs';
import {purgeUnusedPhotos} from './photo-cleanup.mjs';
const deployment=cloudConfig(process.env);
const app=cloudbase.init({env:deployment.envId,region:deployment.region,timeout:2400});
const db=app.rdb(),bucket=app.storage.from(deployment.photoBucket);
const assert=(r,op)=>{if(r.error)throw Error(op+'_'+(r.error.code||'FAILED'));return r.data};
const store={
 async removeMany(keys){if(keys.length)assert(await db.from('our_days_records').delete().in('key',keys),'DB_DELETE')},
 async setMany(rows){assert(await db.from('our_days_records').upsert(rows.map(([key,value])=>({key,value})),{onConflict:'key'}),'DB_WRITE')},
 async get(key){const data=assert(await db.from('our_days_records').select('value').eq('key',key).limit(1),'DB_GET');return data?.[0]?.value||null},
 async set(key,value){assert(await db.from('our_days_records').upsert({key,value},{onConflict:'key'}),'DB_WRITE')},
 async list(prefix){let all=[];for(let start=0;;start+=1000){const data=assert(await db.from('our_days_records').select('value').like('key',prefix+'%').order('key').range(start,start+999),'DB_LIST')||[];all.push(...data.map(d=>d.value));if(data.length<1000)break}return all}
};
const json=(v,s=200,h={})=>Response.json(v,{status:s,headers:{'Cache-Control':'no-store, private',...h}});
function same(a,b){const x=Buffer.from(a),y=Buffer.from(b);return x.length===y.length&&timingSafeEqual(x,y)}
export async function handle(request){
 const path=new URL(request.url).pathname;
 if(path==='/api/health')return json({application:'our-days',status:'online'});
 const owner=await store.get('settings/owner');
 if(!owner){
 if(path==='/api/access'&&request.method==='GET')return json({authenticated:false,needsSetup:true});
 if(path==='/api/access'&&request.method==='POST'){
 if(request.headers.get('origin')!==new URL(request.url).origin)return json({error:'请求来源不匹配'},403);
 const raw=await request.text();if(raw.length>5000)return json({error:'请求太大'},413);const b=JSON.parse(raw);
 if(b.action!=='setup'||!process.env.BOOTSTRAP_TOKEN||!same(String(b.token||''),process.env.BOOTSTRAP_TOKEN))return json({error:'请使用创建者收到的初始化链接。'},403);
 if(typeof b.password!=='string'||b.password.length<12||b.password.length>200)return json({error:'管理员密码请设置为12到200位。'},400);
 const salt=randomBytes(16).toString('hex'),hash=scryptSync(b.password,salt,32).toString('hex');
 // A unique key makes the initial setup atomic: a second request cannot replace it.
 const r=await db.from('our_days_records').insert({key:'settings/owner',value:{salt,hash}});if(r.error)return json({error:'初始化已完成或暂未成功，请刷新后登录。'},409);
 return handle(new Request(request.url,{method:'POST',headers:request.headers,body:JSON.stringify({action:'login',type:'owner',password:b.password})}));
 }
 return json({error:'网站尚未完成初始化。'},401);
 }
 const config={ownerPassword:owner.hash,sessionSecret:process.env.SESSION_SECRET,secure:true,
 verifyOwner:async password=>same(scryptSync(password,owner.salt,32).toString('hex'),owner.hash),
 photoUrl:(p,i)=>'/api/photo/'+p.id+'/'+i,
 commentPhotoUrl:(p,c)=>'/api/photo/'+p.id+'/comments/'+c.id,
 async persistImages(images,previous){return Promise.all(images.map(async image=>{if(!image.startsWith('data:')){const index=previous.images.findIndex((_,i)=>'/api/photo/'+previous.id+'/'+i===image);if(index<0)throw Error('PHOTO_REFERENCE');return previous.images[index]}
 const bytes=Buffer.from(image.split(',')[1],'base64');if(bytes.length>160000)throw Error('PHOTO_TOO_LARGE');const key=createHash('sha256').update(randomBytes(16)).update(bytes).digest('hex')+'.jpg';const r=await bucket.upload(key,bytes,{contentType:'image/jpeg',upsert:true});assert(r,'PHOTO_UPLOAD');return key}))},
 async purgePhotos(keys){await purgeUnusedPhotos(keys,{listPosts:()=>store.list('posts/'),listComments:()=>store.list('comments/'),removePhotos:async unused=>{assert(await bucket.remove(unused),'PHOTO_DELETE')}})},
 async readPhoto(key){if(!/^[a-f0-9]{64}\.jpg$/.test(key))throw Error('PHOTO_KEY');const result=await bucket.download(key);const blob=assert(result,'PHOTO_DOWNLOAD');return Buffer.from(await blob.arrayBuffer())}
 };
 return createApp(store,config)(request);
}
export async function main(event){
 try{
 const rawHeaders=event.headers||{},headers=new Headers();for(const [k,v] of Object.entries(rawHeaders))if(v!=null)headers.set(k,String(v));
 const host=headers.get('x-forwarded-host')||headers.get('host');if(!host)return {statusCode:400,headers:{'Content-Type':'application/json'},body:'{"error":"HTTP access required"}'};
 let pathname=event.path||event.rawPath||'/';if(!pathname.startsWith('/'))pathname='/'+pathname;
 if(new URL('https://'+host).origin!==deployment.siteOrigin)return {statusCode:400,headers:{'Content-Type':'application/json'},body:'{"error":"Site address does not match the administrator configuration."}'};
 const url=new URL(pathname,deployment.siteOrigin);for(const [k,v] of Object.entries(event.queryStringParameters||{}))if(v!=null)url.searchParams.set(k,String(v));
 const method=event.httpMethod||event.requestContext?.http?.method||'GET';
 const request=new Request(url,{method,headers,...(!['GET','HEAD'].includes(method)?{body:event.isBase64Encoded?Buffer.from(event.body||'','base64'):typeof event.body==='string'?event.body:JSON.stringify(event.body||{})}:{})});
 const response=await handle(request);const contentType=response.headers.get('content-type')||'';const binary=contentType.startsWith('image/');
 return {statusCode:response.status,headers:Object.fromEntries(response.headers),isBase64Encoded:binary,body:binary?Buffer.from(await response.arrayBuffer()).toString('base64'):await response.text()};
 }catch(e){console.error('our-days handler failure:',e.message);return {statusCode:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'},body:JSON.stringify({error:'暂时没有连接成功，请稍后再试。',code:String(e.message).slice(0,80)})}}
}

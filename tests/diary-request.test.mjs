import {readFileSync} from 'node:fs';
import {build} from 'esbuild';
import assert from 'node:assert/strict';
import {createApp} from '../src/core.mjs';
const built=await build({entryPoints:['src/diary-request.ts'],bundle:true,write:false,platform:'node',format:'esm'}),js=built.outputFiles[0].text;
const {diaryRequest,sendDiary}=await import('data:text/javascript;base64,'+Buffer.from(js).toString('base64'));
const images=['data:image/jpeg;base64,'+'a'.repeat(190000),'data:image/jpeg;base64,'+'b'.repeat(190000)],payload={action:'save',body:'全家都能看到的日子 ❤️',images,scope:'family',recipients:[],mode:'comment'};
const options=diaryRequest(payload);assert.equal(options.headers['Content-Type'],'application/octet-stream');assert.ok(options.body instanceof Blob);assert.ok(options.body.size>100000);assert.deepEqual(JSON.parse(await options.body.text()),payload);
const plain=diaryRequest({action:'hug',id:'entry'});assert.equal(plain.headers['Content-Type'],'application/json');assert.equal(typeof plain.body,'string');
// Test the exact binary request against the application parser without cloud credentials.
const records=new Map(),store={async get(k){return records.get(k)||null},async set(k,v){records.set(k,structuredClone(v))},async list(prefix){return [...records].filter(([k])=>k.startsWith(prefix)).map(([,v])=>v)}};
let savedImages;const app=createApp(store,{ownerPassword:'test-owner-password-12345',sessionSecret:'test-session-secret-longer-than-32-bytes',photoUrl:(p,i)=>'/api/photo/'+p.id+'/'+i,async persistImages(values){savedImages=values;return ['first.jpg','second.jpg']}});
const origin='https://days.test';const login=await app(new Request(origin+'/api/access',{method:'POST',headers:{origin,'content-type':'application/json'},body:JSON.stringify({action:'login',type:'owner',password:'test-owner-password-12345'})})),cookie=login.headers.get('set-cookie').split(';')[0];
const saved=await app(new Request(origin+'/api/diary',{...options,headers:{...options.headers,origin,cookie}}));assert.equal(saved.status,200);assert.deepEqual(savedImages,images);const post=[...records].find(([k])=>k.startsWith('posts/'))[1];assert.equal(post.scope,'family');assert.equal(post.mode,'comment');assert.equal(post.body,payload.body);
const originalFetch=globalThis.fetch;try{let called;
globalThis.fetch=async(url,init)=>{called=init;return Response.json({ok:true})};assert.equal((await sendDiary(payload)).ok,true);assert.equal(called.headers['Content-Type'],'application/octet-stream');
for(const [status,body,pattern]of [[413,{code:'EXCEED_MAX_PAYLOAD_SIZE'},/内容过大/],[429,{},/访问限制/],[401,{},/登录已过期/],[504,{},/内容还在/],[403,{error:'没有权限'},/没有权限/]]){globalThis.fetch=async()=>Response.json(body,{status});await assert.rejects(()=>sendDiary(payload),pattern)}
globalThis.fetch=async()=>{throw Error('Load failed')};await assert.rejects(()=>sendDiary(payload),/网络连接中断/);
globalThis.fetch=async()=>new Response('<html>bad gateway</html>',{status:502});await assert.rejects(()=>sendDiary(payload),/服务器暂时没有正常回应/);
}finally{globalThis.fetch=originalFetch}
assert.ok(!readFileSync('src/diary.tsx','utf8').includes('默认先留给自己'));
console.log('PASS: large two-photo binary request preserves all data and sharing scope; authenticated application save; platform, login, rate-limit, network and invalid-response errors; obsolete hint removed.');

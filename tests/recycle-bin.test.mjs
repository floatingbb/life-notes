import {createApp} from '../src/core.mjs';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const values=new Map(),store={async get(k){return structuredClone(values.get(k)||null)},async set(k,v){values.set(k,structuredClone(v))},async list(prefix){return [...values].filter(([k])=>k.startsWith(prefix)).map(([,v])=>structuredClone(v))}};
const password=randomBytes(24).toString('hex'),config={ownerPassword:password,sessionSecret:randomBytes(32).toString('hex'),photoUrl:(p,i)=>'/api/photo/'+p.id+'/'+i,async readPhoto(){return new Uint8Array([255,216,255,217])}};let handler=createApp(store,config);
async function req(route='diary',body=null,cookie=''){return handler(new Request('https://days.test/api/'+route,{method:body?'POST':'GET',headers:{origin:'https://days.test',cookie,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}))}
const cookie=r=>r.headers.get('set-cookie').split(';')[0],owner=cookie(await req('access',{action:'login',type:'owner',password}));
const invite=await(await req('access',{action:'invite',name:'妈妈'},owner)).json(),family=cookie(await req('access',{action:'login',type:'family',code:invite.code}));
async function snapshot(c,trash=false){const r=await req(trash?'diary?view=trash':'diary',null,c);assert.equal(r.status,200);return r.json()}
async function save(c,scope,body){const r=await req('diary',{action:'save',body,images:['data:image/jpeg;base64,/9j/2Q=='],scope,recipients:scope==='selected'?[invite.member.id]:[],mode:'comment'},c);assert.equal(r.status,200);return(await snapshot(c)).posts.find(p=>p.body===body)}
const self=await save(owner,'self','仅自己的回忆'),shared=await save(owner,'family','分享的回忆'),selected=await save(owner,'selected','指定家人的回忆'),momPost=await save(family,'family','妈妈的回忆');
await req('diary',{action:'comment',id:shared.id,body:'好好保存。'},family);await req('diary',{action:'hug',id:shared.id},family);
for(const p of [self,shared,selected])assert.equal((await req('diary',{action:'delete',id:p.id},owner)).status,200);
await req('diary',{action:'delete',id:momPost.id},family);
assert.equal((await snapshot(owner)).posts.length,0);assert.equal((await snapshot(family)).posts.length,0);
assert.equal((await req('diary?view=trash')).status,401);
handler=createApp(store,config); // A refresh/redeploy does not lose access to earlier soft-deleted records.
const ownTrash=await snapshot(owner,true),familyTrash=await snapshot(family,true);assert.equal(ownTrash.posts.length,3);assert.equal(familyTrash.posts.length,1);assert.ok(ownTrash.posts.every(p=>p.author==='owner'));assert.equal(familyTrash.posts[0].id,momPost.id);
assert.equal(ownTrash.posts.find(p=>p.id===shared.id).comments[0].body,'好好保存。');assert.ok(ownTrash.posts.find(p=>p.id===shared.id).embraced);
assert.equal((await req('photo/'+shared.id+'/0',null,owner)).status,200);assert.equal((await req('photo/'+shared.id+'/0',null,family)).status,404);assert.equal((await req('photo/'+momPost.id+'/0',null,owner)).status,404,'Administrator cannot read another member hidden photo');
assert.equal((await req('diary',{action:'restore',id:shared.id},family)).status,403);assert.equal((await req('diary',{action:'restore',id:momPost.id},owner)).status,403);
assert.equal((await req('diary',{action:'comment',id:shared.id,body:'hidden'},family)).status,404);assert.equal((await req('diary',{action:'hug',id:shared.id},family)).status,404);
for(const p of [self,shared,selected])assert.equal((await req('diary',{action:'restore',id:p.id},owner)).status,200);
assert.equal((await snapshot(owner,true)).posts.length,0);assert.equal((await snapshot(family,true)).posts.length,1);
const restored=await snapshot(owner);assert.equal(restored.posts.length,3);for(const p of [self,shared,selected])assert.equal(restored.posts.find(r=>r.id===p.id).scope,p.scope);
assert.equal((await snapshot(family)).posts.length,2);assert.equal((await req('photo/'+shared.id+'/0',null,family)).status,200);assert.equal(restored.posts.find(p=>p.id===shared.id).comments[0].body,'好好保存。');
console.log('PASS: owner-only recycle bin, prior hidden records after refresh, private photos, blocked cross-member restore/comment/hug, preserved scope/photos/comments/hugs, and removal from bin after restore.');

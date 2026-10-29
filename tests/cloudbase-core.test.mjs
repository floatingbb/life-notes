import {createApp} from '../src/core.mjs';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const values=new Map(),store={async get(k){return structuredClone(values.get(k)||null)},async set(k,v){values.set(k,structuredClone(v))},async list(prefix){return [...values].filter(([k])=>k.startsWith(prefix)).map(([,v])=>structuredClone(v))}};
const password=randomBytes(24).toString('hex'),handler=createApp(store,{ownerPassword:password,sessionSecret:randomBytes(32).toString('hex'),secure:true});
async function request(route,body,cookie='',origin='https://days.test'){return handler(new Request('https://days.test/api/'+route,{method:body?'POST':'GET',headers:{origin,cookie,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}))}
function cookies(r){return r.headers.get('set-cookie').split(';')[0]}
assert.equal((await request('diary')).status,401);
assert.equal((await request('access',{action:'login',type:'owner',password:'nope'})).status,401);
let r=await request('access',{action:'login',type:'owner',password});assert.equal(r.status,200);assert.match(r.headers.get('set-cookie'),/HttpOnly/);assert.match(r.headers.get('set-cookie'),/Secure/);const owner=cookies(r);
assert.equal((await request('access',{action:'invite',name:'bad'},owner,'https://evil.test')).status,403);
async function invite(name){const r=await request('access',{action:'invite',name},owner);assert.equal(r.status,200);return r.json()}
const bob=await invite('妈妈'),carol=await invite('爷爷');assert.equal(bob.code.length,43);
async function family(code){const r=await request('access',{action:'login',type:'family',code});assert.equal(r.status,200);return cookies(r)}
const b=await family(bob.code),c=await family(carol.code);
assert.equal((await request('access',{action:'invite',name:'bad'},b)).status,403);
const note=(scope,recipients=[])=>({action:'save',body:scope,images:[],scope,recipients,mode:'hug'});
for(const p of [note('self'),note('selected',[bob.member.id]),note('family')])assert.equal((await request('diary',p,owner)).status,200);
async function snapshot(cookie){const r=await request('diary',null,cookie);assert.equal(r.status,200);return r.json()}
const a=await snapshot(owner);assert.equal(a.posts.length,3);assert.equal((await snapshot(b)).posts.length,2);assert.equal((await snapshot(c)).posts.length,1);const secret=a.posts.find(p=>p.scope==='self'),selected=a.posts.find(p=>p.scope==='selected'),shared=a.posts.find(p=>p.scope==='family');
assert.equal((await request('diary',{action:'hug',id:secret.id},b)).status,404);
assert.equal((await request('diary',{...note('family'),id:selected.id},b)).status,403);
assert.equal((await request('diary',{action:'delete',id:shared.id},b)).status,403);
assert.equal((await request('diary',{action:'comment',id:shared.id,body:'not allowed'},b)).status,403);
await request('diary',{action:'hug',id:shared.id},b);assert.equal((await snapshot(owner)).posts.find(p=>p.id===shared.id).embraced,true);
await request('diary',{...note('family'),id:shared.id,revision:shared.revision,mode:'comment'},owner);assert.equal((await request('diary',{action:'comment',id:shared.id,body:'今天做了好吃的'},b)).status,200);
assert.equal((await snapshot(c)).posts[0].comments[0].body,'今天做了好吃的');
await request('diary',{action:'delete',id:shared.id},owner);assert.equal((await snapshot(c)).posts.length,0);await request('diary',{action:'restore',id:shared.id},owner);assert.equal((await snapshot(c)).posts.length,1);
assert.equal((await request('diary',{...note('self'),images:['data:image/svg+xml,bad']},owner)).status,400);
assert.equal((await request('diary',{...note('selected',['../../access'])},owner)).status,400);
await request('access',{action:'revoke',id:bob.member.id},owner);assert.equal((await request('diary',null,b)).status,401);assert.equal((await request('access',{action:'login',type:'family',code:bob.code})).status,401);
const session=await request('access',null,owner);const text=await session.text();assert.ok(!text.includes(password));assert.ok(!JSON.stringify(await snapshot(owner)).includes(bob.code));
const tampered=owner.slice(0,-3)+'xxx';assert.equal((await request('diary',null,tampered)).status,401);
const logout=await request('access',{action:'logout'},c);assert.match(logout.headers.get('set-cookie'),/Max-Age=0/);
console.log('PASS: independent owner login, private invite links, signed sessions, revocation, visibility, ownership, comment controls, undo, invalid images, traversal, origin checks, secret exclusion.');

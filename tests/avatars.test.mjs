import {createApp} from '../src/core.mjs';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const avatar='data:image/jpeg;base64,/9j/2Q==';
const values=new Map(),store={async get(k){return structuredClone(values.get(k)||null)},async set(k,v){values.set(k,structuredClone(v))},async list(p){return [...values].filter(([k])=>k.startsWith(p)).map(([,v])=>structuredClone(v))}};
const password=randomBytes(24).toString('hex'),handler=createApp(store,{ownerPassword:password,sessionSecret:randomBytes(32).toString('hex'),secure:true});
async function req(body,cookie='',route='access'){return handler(new Request('https://days.test/api/'+route,{method:body?'POST':'GET',headers:{origin:'https://days.test',cookie,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}))}
const cookie=r=>r.headers.get('set-cookie').split(';')[0],owner=cookie(await req({action:'login',type:'owner',password}));
const invited=await (await req({action:'invite',name:'妈妈'},owner)).json();const login={action:'login',type:'family',code:invited.code},phone=cookie(await req(login)),desktop=cookie(await req(login));
assert.equal((await req({action:'profile',avatar},'', 'diary')).status,401);
assert.equal((await req({action:'profile',avatar,id:'owner'},phone,'diary')).status,200);
let snapshot=await (await req(null,desktop,'diary')).json();assert.equal(snapshot.members.find(m=>m.id===invited.member.id).avatar,avatar);assert.ok(!snapshot.members.find(m=>m.id==='owner').avatar);
assert.equal(snapshot.members.find(m=>m.id===invited.member.id).name,'妈妈');
assert.equal((await (await req({action:'getInvite',id:invited.member.id},owner)).json()).code,invited.code,'Avatar change preserves saved link');
assert.equal((await req(login)).status,200,'Existing link remains usable');
assert.equal((await req({action:'profile',name:'妈妈的新称呼'},desktop,'diary')).status,200);snapshot=await (await req(null,phone,'diary')).json();assert.equal(snapshot.members.find(m=>m.id===invited.member.id).avatar,avatar,'Name update preserves avatar');
for(const invalid of ['data:image/svg+xml,<svg/>','https://other.test/p.jpg','data:image/jpeg;base64,'+'A'.repeat(22001),'data:image/jpeg;base64,YmFk',{}])assert.equal((await req({action:'profile',avatar:invalid},phone,'diary')).status,400);
assert.equal((await req({action:'profile',avatar:''},phone,'diary')).status,200);snapshot=await (await req(null,desktop,'diary')).json();assert.ok(!snapshot.members.find(m=>m.id===invited.member.id).avatar);
console.log('PASS: self-only avatar updates, cross-device visibility, unchanged invite/session identity, name/avatar preservation, format/size validation, and default avatar restore.');

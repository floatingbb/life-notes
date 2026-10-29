import {createApp} from '../src/core.mjs';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
const values=new Map(),store={async get(k){return structuredClone(values.get(k)||null)},async set(k,v){values.set(k,structuredClone(v))},async list(p){return [...values].filter(([k])=>k.startsWith(p)).map(([,v])=>structuredClone(v))}};
const password=randomBytes(24).toString('hex'),config={ownerPassword:password,sessionSecret:randomBytes(32).toString('hex'),secure:true};let handler=createApp(store,config);
async function req(body,cookie='',route='access'){return handler(new Request('https://days.test/api/'+route,{method:body?'POST':'GET',headers:{origin:'https://days.test',cookie,'content-type':'application/json'},...(body?{body:JSON.stringify(body)}:{})}))}
const cookie=r=>r.headers.get('set-cookie').split(';')[0],owner=cookie(await req({action:'login',type:'owner',password}));
async function invite(name){const r=await req({action:'invite',name},owner);assert.equal(r.status,200);return r.json()}
const mom=await invite('妈妈'),dad=await invite('爸爸'),id=mom.member.id;
const login=code=>req({action:'login',type:'family',code}),m=cookie(await login(mom.code)),d=cookie(await login(dad.code)),m2=cookie(await login(mom.code));
async function snap(c){const r=await req(null,c,'diary');assert.equal(r.status,200);return r.json()}
async function member(c,id){return (await snap(c)).members.find(x=>x.id===id)}
async function accessMembers(){return (await (await req({action:'listMembers'},owner)).json()).members}
assert.equal((await member(m,id)).name,'妈妈');assert.equal((await accessMembers()).find(x=>x.id===id).accessLabel,'妈妈');
assert.equal((await req({action:'profile',name:'测试名字甲',accessLabel:'被篡改的标签'},m,'diary')).status,200);
assert.equal((await member(d,id)).name,'测试名字甲');assert.equal((await member(d,id)).displayName,'测试名字甲');assert.equal((await accessMembers()).find(x=>x.id===id).accessLabel,'妈妈');
assert.ok(!(await member(d,id)).accessLabel,'Management label stays administrator-only');
assert.equal((await req({action:'remark',id:dad.member.id,remark:'测试备注甲',viewer:'owner'},m,'diary')).status,200);
assert.equal((await member(m2,dad.member.id)).displayName,'测试备注甲','Private remark syncs across same member devices');
assert.equal((await member(owner,dad.member.id)).displayName,'爸爸');assert.equal((await member(d,dad.member.id)).displayName,'爸爸');
assert.equal((await req({action:'remark',id:mom.member.id,remark:'我的妈妈'},owner,'diary')).status,200);
assert.equal((await member(owner,id)).displayName,'我的妈妈');assert.equal((await member(d,id)).displayName,'测试名字甲');assert.equal((await accessMembers()).find(x=>x.id===id).accessLabel,'妈妈');
assert.equal((await req({action:'profile',name:'测试名字乙'},d,'diary')).status,200);
assert.equal((await member(m,dad.member.id)).displayName,'测试备注甲');assert.equal((await member(owner,dad.member.id)).displayName,'测试名字乙');
assert.equal((await req({action:'remark',id:dad.member.id,remark:'   '},m,'diary')).status,200);assert.equal((await member(m,dad.member.id)).displayName,'测试名字乙');
for(const payload of [{id:'../owner',remark:'bad'},{id:mom.member.id,remark:'self'},{id:dad.member.id,remark:'长'.repeat(25)},{id:dad.member.id,remark:{}}])assert.equal((await req({action:'remark',...payload},m,'diary')).status,400);
assert.equal((await req({action:'remark',id:dad.member.id,remark:'bad'},'','diary')).status,401);
assert.equal((await req({action:'remark',id:'missing',remark:'bad'},m,'diary')).status,404);
// Legacy member obtains its fixed label before the first new profile edit.
const legacy=values.get('members/'+dad.member.id);delete legacy.accessLabel;legacy.name='原来标签';values.set('members/'+dad.member.id,legacy);
assert.equal((await req({action:'profile',name:'新的名字'},d,'diary')).status,200);assert.equal((await accessMembers()).find(x=>x.id===dad.member.id).accessLabel,'原来标签');
handler=createApp(store,config);assert.equal((await member(owner,id)).displayName,'我的妈妈');assert.equal((await accessMembers()).find(x=>x.id===id).accessLabel,'妈妈');
assert.equal((await (await req({action:'getInvite',id},owner)).json()).code,mom.code);assert.equal((await login(mom.code)).status,200);
await req({action:'revoke',id:dad.member.id},owner);assert.equal((await req({action:'remark',id:dad.member.id,remark:'bad'},m,'diary')).status,404);
console.log('PASS: fixed labels, initial names, public self-renaming, viewer-private remarks and cross-device sync, clear-to-current-name, legacy migration, admin-only labels, unchanged invites, and validation.');

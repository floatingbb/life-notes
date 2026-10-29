import assert from 'node:assert/strict';
import {randomBytes} from 'node:crypto';
import {build} from 'esbuild';
import {createApp} from '../src/core.mjs';
const records=new Map(),store={get:async k=>structuredClone(records.get(k)||null),set:async(k,v)=>records.set(k,structuredClone(v)),list:async prefix=>[...records].filter(([k])=>k.startsWith(prefix)).map(([,v])=>structuredClone(v))};
const password=randomBytes(20).toString('hex'),app=createApp(store,{ownerPassword:password,sessionSecret:randomBytes(32).toString('hex')});
const req=(route,body,cookie='')=>app(new Request('https://days.test/api/'+route,{method:body?'POST':'GET',headers:{cookie,origin:'https://days.test'},...(body?{body:JSON.stringify(body)}:{})}));
const cookie=r=>r.headers.get('set-cookie').split(';')[0];
const guest=await req('diary?bootstrap=1');assert.equal(guest.status,200);assert.deepEqual(await guest.json(),{authenticated:false});assert.equal((await req('diary')).status,401);
const owner=cookie(await req('access',{action:'login',type:'owner',password}));const invite=await(await req('access',{action:'invite',name:'示例亲友'},owner)).json();const family=cookie(await req('access',{action:'login',type:'family',code:invite.code}));
for(const scope of ['self','family'])await req('diary',{action:'save',body:'synthetic '+scope,images:[],scope,recipients:[],mode:'hug'},owner);
const own=await(await req('diary?bootstrap=1',null,owner)).json();assert.equal(own.authenticated,true);assert.equal(own.admin,true);assert.equal(own.posts.length,2);assert.ok(own.members.find(m=>m.id===own.me));
const shared=await(await req('diary?bootstrap=1',null,family)).json();assert.equal(shared.authenticated,true);assert.equal(shared.admin,false);assert.equal(shared.posts.length,1);assert.equal(shared.posts[0].scope,'family');assert.ok(!JSON.stringify(shared).includes(password));assert.ok(!JSON.stringify(shared).includes(invite.code));
await req('access',{action:'revoke',id:invite.member.id},owner);assert.deepEqual(await(await req('diary?bootstrap=1',null,family)).json(),{authenticated:false});
const built=await build({entryPoints:['src/main.tsx'],bundle:true,write:false,outfile:'tmp/opening-test/app.js',format:'esm',jsx:'automatic',minify:true,target:'es2020',external:['/export-tools.js?v=opening-1'],define:{'process.env.NODE_ENV':'"production"'},metafile:true});const script=built.outputFiles.find(f=>!f.path.endsWith('.css'));assert.ok(script.contents.byteLength<350000,'Opening bundle must stay below 350KB');assert.ok(!Object.keys(built.metafile.inputs).some(p=>p.includes('/pdf-lib/')),'PDF generation must not be downloaded to open a diary');
console.log('PASS: one-request authenticated opening, guest/revoked/private-note permissions, and a small opening bundle without eagerly loaded PDF dependencies.');


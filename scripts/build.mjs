import {build} from 'esbuild';
import {readFile,mkdir,copyFile} from 'node:fs/promises';
import path from 'node:path';
await mkdir('dist/public',{recursive:true});
for(const file of ['index.html','favicon.svg'])await copyFile('public/'+file,'dist/public/'+file);
await build({entryPoints:['src/main.tsx'],bundle:true,outfile:'dist/public/app.js',external:['/export-tools.js?v=opening-1'],jsx:'automatic',minify:true,target:['es2020'],define:{'process.env.NODE_ENV':'"production"'},legalComments:'eof'});
await build({entryPoints:['src/export.ts'],bundle:true,format:'esm',outfile:'dist/public/export-tools.js',minify:true,target:['es2020'],legalComments:'eof'});
await build({entryPoints:['src/cloud-handler.mjs'],bundle:true,platform:'node',format:'cjs',target:'node20',minify:true,outfile:'dist/cloudfunctions/our-days-api/index.js',legalComments:'eof',plugins:[{name:'include-cloudbase-signing',setup(b){b.onLoad({filter:/index\.node\.(esm|cjs)\.js$/},async args=>{const text=await readFile(args.path,'utf8');if(!text.includes('signature-nodejs'))return;const changed=text.replace(/\(0,[\w$.]+\)\(\["@cloudbase","\/","signature-nodejs"\],"(?:[^"\\]|\\.)*"\)/g,'__signer');if(changed===text)throw Error('CloudBase signing import changed; inspect SDK before deployment.');return {contents:'import * as __signer from "@cloudbase/signature-nodejs";\n'+changed,loader:'js',resolveDir:path.dirname(args.path)}})}}]});
console.log('Built dist/public and dist/cloudfunctions. No cloud deployment was performed.');

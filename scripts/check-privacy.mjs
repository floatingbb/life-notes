import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
const root=process.cwd(),skip=new Set(['.git','node_modules','dist','tmp','.data','coverage']);
const rootFiles=new Set(['README.md','LICENSE','SECURITY.md','package.json','package-lock.json','.gitignore','.gitattributes','.env.example','PUBLICATION_MANIFEST.json']);
const findings=[];
async function walk(directory,prefix=''){
 for(const entry of await readdir(directory,{withFileTypes:true})){
  const rel=prefix+entry.name;if(entry.isDirectory()){if(!skip.has(entry.name))await walk(path.join(directory,entry.name),rel+'/');continue}
  if(entry.isSymbolicLink()){findings.push(rel+': symlinks are not part of the publication allowlist');continue}
  if(!rootFiles.has(rel)&&! /^(src\/[\w-]+\.(?:mjs|tsx?|css)|tests\/[\w.-]+\.mjs|scripts\/[\w.-]+\.mjs|docs\/[\w.-]+\.md|public\/(?:index\.html|favicon\.svg)|cloudbase\/migrations\/\d+_[\w-]+\.sql|\.github\/workflows\/check\.yml)$/.test(rel)){findings.push(rel+': unexpected file; review before publishing');continue}
  const text=await readFile(path.join(directory,entry.name),'utf8');
  const checks=[['private-key',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],['cloud-key',/AKIA[0-9A-Z]{16}|AKID[A-Za-z0-9]{20,}/],['credential-token',/gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,}|eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}/],['live-invite',/#(?:join|setup)=[A-Za-z0-9_-]{40,}/],['personal-local-path',/[A-Z]:[\\/](?:Users|GPT)[^\n"']*/],['bound-live-environment',/env\s*:\s*['"][a-z0-9]+-[a-z0-9]+-[a-z0-9]{10,}['"]/]];
  for(const [label,pattern]of checks)if(pattern.test(text))findings.push(rel+': '+label);
  if(rel==='.env.example')for(const line of text.split(/\r?\n/)){if(/^(?:CLOUDBASE_APIKEY|SESSION_SECRET|BOOTSTRAP_TOKEN)=.+/.test(line))findings.push(rel+': example credentials must be empty')}
 }
}
await walk(root);if(findings.length){console.error(findings.join('\n'));process.exitCode=1}else console.log('PASS: source-only allowlist, empty example secrets, no private keys, live invitation tokens, personal local paths, or bound live environment.');

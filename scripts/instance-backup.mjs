// Maintenance tool: run only with the operator's own server-side environment file.
// It never reads Codex, browser, OS keychains, or other applications' credentials.
import cloudbase from '@cloudbase/js-sdk';
import {readFile,writeFile} from 'node:fs/promises';
import {cloudConfig} from '../src/cloud-config.mjs';
import {collectArchive,encryptArchive,decryptArchive,restoreArchive} from '../src/instance-archive.mjs';
const [action,file,confirmation]=process.argv.slice(2);
if(!['backup','restore'].includes(action)||!file)throw Error('Usage: node --env-file=.env.private scripts/instance-backup.mjs backup|restore FILE [--new-empty-environment]');
const password=process.env.BACKUP_PASSWORD;if(!password||password.length<12)throw Error('Set BACKUP_PASSWORD (12+ characters) in your private environment file');
const config=cloudConfig(process.env),app=cloudbase.init({env:config.envId,region:config.region,timeout:15000}),db=app.rdb(),bucket=app.storage.from(config.photoBucket);
const check=r=>{if(r.error)throw Error('Cloud operation failed: '+(r.error.code||'UNKNOWN'));return r.data};
const adapter={
 async rows(){const all=[];for(let n=0;;n+=500){const rows=check(await db.from('our_days_records').select('key,value').order('key').range(n,n+499))||[];all.push(...rows);if(rows.length<500)return all}},
 async get(key){return (check(await db.from('our_days_records').select('value').eq('key',key).limit(1))||[])[0]?.value||null},
 async insert(key,value){const r=await db.from('our_days_records').insert({key,value});if(r.error?.code==='23505')return false;check(r);return true},
 async readPhoto(key){const blob=check(await bucket.download(key));return Buffer.from(await blob.arrayBuffer())},
 async uploadPhoto(key,bytes){check(await bucket.upload(key,bytes,{contentType:'image/jpeg',upsert:true}))},
 async finishRestore(fingerprint){check(await db.from('our_days_records').update({value:{fingerprint,status:'complete'}}).eq('key','settings/restore'))}
};
if(action==='backup'){
 const archive=await collectArchive(adapter,process.env.SESSION_SECRET);await writeFile(file,encryptArchive(archive,password),{flag:'wx',mode:0o600});console.log('Encrypted instance backup created. Keep its password separately. No credentials were printed.');
}else{
 if(confirmation!=='--new-empty-environment')throw Error('Restore requires --new-empty-environment; never use your live environment');
 const archive=decryptArchive(await readFile(file,'utf8'),password);
 // This file is excluded from Git. Never display or upload it.
 const secretLine='SESSION_SECRET='+archive.sessionSecret+'\n';try{await writeFile('.env.restore',secretLine,{flag:'wx',mode:0o600})}catch(e){if(e.code!=='EEXIST'||await readFile('.env.restore','utf8')!==secretLine)throw Error('An unrelated .env.restore already exists; move it somewhere safe before restoring')}
 const result=await restoreArchive(adapter,archive);console.log('Restored '+result.records+' records and '+result.photos+' photos. Configure the function with the saved .env.restore session secret, then deploy. No credentials were printed.');
}

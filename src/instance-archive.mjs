import {createCipheriv,createDecipheriv,createHash,randomBytes,scryptSync} from 'node:crypto';
const digest=b=>createHash('sha256').update(b).digest('hex');
const canonical=v=>JSON.stringify(normalize(v));
function normalize(v){if(Array.isArray(v))return v.map(normalize);if(v&&typeof v==='object')return Object.fromEntries(Object.keys(v).sort().map(k=>[k,normalize(v[k])]));return v}
const allowed=/^(?:settings\/owner|activity\/[A-Za-z0-9_-]+|favorites\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+|members\/[A-Za-z0-9_-]+|access\/[a-f0-9]{64}|links\/[A-Za-z0-9_-]+|remarks\/[A-Za-z0-9_-]+\/[A-Za-z0-9_-]+|posts\/[A-Za-z0-9_-]+|comments\/[A-Za-z0-9_-]+|hugs\/[A-Za-z0-9_-]+)$/;
export function validateArchive(archive){
 if(archive?.format!=='our-days-instance-v1'||typeof archive.sessionSecret!=='string'||archive.sessionSecret.length<32||!Array.isArray(archive.rows)||!Array.isArray(archive.photos))throw Error('Invalid instance backup');
 const keys=new Set();for(const row of archive.rows){if(!row||!allowed.test(row.key)||keys.has(row.key)||!row.value||typeof row.value!=='object')throw Error('Invalid or duplicate record in instance backup');keys.add(row.key)}
 if(!keys.has('settings/owner'))throw Error('The backup has no administrator account');
 const media=new Set();for(const p of archive.photos){if(!/^[a-f0-9]{64}\.jpg$/.test(p.key)||media.has(p.key)||typeof p.data!=='string')throw Error('Invalid photo in instance backup');const b=Buffer.from(p.data,'base64');if(b.length>160000||digest(b)!==p.sha256)throw Error('Photo checksum failed');media.add(p.key)}
 for(const {key,value} of archive.rows){const refs=key.startsWith('posts/')?value.images||[]:key.startsWith('comments/')&&value.image?[value.image]:[];if(refs.some(k=>!media.has(k)))throw Error('A referenced photo is missing from the backup')}
 return archive;
}
export async function collectArchive(adapter,sessionSecret){
 const rows=(await adapter.rows()).filter(r=>allowed.test(r.key)),refs=[...new Set(rows.flatMap(r=>r.key.startsWith('posts/')?r.value.images||[]:r.key.startsWith('comments/')&&r.value.image?[r.value.image]:[]))];const photos=[];
 for(const key of refs){const bytes=Buffer.from(await adapter.readPhoto(key));photos.push({key,data:bytes.toString('base64'),sha256:digest(bytes)})}
 const after=(await adapter.rows()).filter(r=>allowed.test(r.key));if(canonical([...rows].sort((a,b)=>a.key.localeCompare(b.key)))!==canonical(after.sort((a,b)=>a.key.localeCompare(b.key))))throw Error('Data changed during backup; wait until nobody is editing and retry');
 return validateArchive({format:'our-days-instance-v1',created:new Date().toISOString(),sessionSecret,rows,photos});
}
export function encryptArchive(archive,password){
 if(typeof password!=='string'||password.length<12)throw Error('Use a backup password of at least 12 characters');validateArchive(archive);
 const salt=randomBytes(16),iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',scryptSync(password,salt,32),iv);cipher.setAAD(Buffer.from('our-days-encrypted-v1'));
 const ciphertext=Buffer.concat([cipher.update(JSON.stringify(archive),'utf8'),cipher.final()]);return JSON.stringify({format:'our-days-encrypted-v1',salt:salt.toString('base64'),iv:iv.toString('base64'),tag:cipher.getAuthTag().toString('base64'),data:ciphertext.toString('base64')});
}
export function decryptArchive(file,password){
 try{const box=JSON.parse(file);if(box.format!=='our-days-encrypted-v1')throw Error();const salt=Buffer.from(box.salt,'base64'),iv=Buffer.from(box.iv,'base64'),tag=Buffer.from(box.tag,'base64');if(salt.length!==16||iv.length!==12||tag.length!==16)throw Error();const cipher=createDecipheriv('aes-256-gcm',scryptSync(password,salt,32),iv);cipher.setAAD(Buffer.from(box.format));cipher.setAuthTag(tag);return validateArchive(JSON.parse(Buffer.concat([cipher.update(Buffer.from(box.data,'base64')),cipher.final()]).toString('utf8')))}catch{throw Error('Backup password is incorrect, or the encrypted backup is damaged')}
}
export async function restoreArchive(adapter,archive){
 validateArchive(archive);const fingerprint=digest(canonical(archive)),marker=await adapter.get('settings/restore');
 if(marker?.fingerprint!==fingerprint){if((await adapter.rows()).length)throw Error('Restore requires a NEW empty environment; existing records will never be overwritten');if(!await adapter.insert('settings/restore',{fingerprint,status:'restoring'}))throw Error('Another restore is already running')}
 // Existing data on a resumed restore must be identical to the selected archive.
 const expected=new Map(archive.rows.map(r=>[r.key,r.value]));for(const row of await adapter.rows()){if(row.key==='settings/restore')continue;if(!expected.has(row.key)||canonical(row.value)!==canonical(expected.get(row.key)))throw Error('Target changed after restore began; refusing to overwrite it')}
 for(const p of archive.photos)await adapter.uploadPhoto(p.key,Buffer.from(p.data,'base64'));
 // Write owner credentials last. Deploy/enable the public function only after this completes.
 for(const row of archive.rows.filter(r=>r.key!=='settings/owner')){const old=await adapter.get(row.key);if(!old&&!await adapter.insert(row.key,row.value))throw Error('A concurrent write interrupted restoration')}
 const owner=archive.rows.find(r=>r.key==='settings/owner');if(!await adapter.get(owner.key)&&!await adapter.insert(owner.key,owner.value))throw Error('An administrator account already exists');
 await adapter.finishRestore(fingerprint);return {records:archive.rows.length,photos:archive.photos.length};
}

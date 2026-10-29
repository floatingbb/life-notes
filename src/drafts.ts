export function freshDraft(){return {id:'',revision:0,requestId:crypto.randomUUID(),body:'',images:[] as string[],scope:'self',recipients:[] as string[],mode:'hug'}}
const key=(id:string)=>'our-days-draft-v2:'+id;
export function readDraft(id:string){
 try{const d=JSON.parse(localStorage.getItem(key(id))||'null');if(!d)return null;if(typeof d.body!=='string'||d.body.length>5000||!Array.isArray(d.images)||d.images.length>3||d.images.some((s:any)=>typeof s!=='string'||s.length>205000||!(/^(data:image\/jpeg;base64,[A-Za-z0-9+/=]+|\/api\/photo\/[A-Za-z0-9_-]+\/[0-2])$/.test(s)))||!['self','family','selected'].includes(d.scope)||!['hug','comment','advice'].includes(d.mode)||!Array.isArray(d.recipients)||!d.recipients.every((s:any)=>typeof s==='string'&&/^[A-Za-z0-9_-]{1,80}$/.test(s)))return null;return {...freshDraft(),...d}}
 catch{return null}
}
export function writeDraft(id:string,d:any){try{if(!d.body&&!d.images.length&&!d.id)localStorage.removeItem(key(id));else localStorage.setItem(key(id),JSON.stringify(d));return true}catch{return false}}
export function clearDraft(id:string){try{localStorage.removeItem(key(id))}catch{}}

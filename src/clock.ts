export {FAMILY_ZONES} from './site-config';
export function clockFace(now:Date,zone:string){
 const parts=new Intl.DateTimeFormat('en-GB',{timeZone:zone,hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(now);
 const hour=Number(parts.find(p=>p.type==='hour')!.value),minute=parts.find(p=>p.type==='minute')!.value;
 return {time:String(hour).padStart(2,'0')+':'+minute,date:new Intl.DateTimeFormat('zh-CN',{timeZone:zone,month:'numeric',day:'numeric',weekday:'short'}).format(now),daytime:hour>=6&&hour<18};
}

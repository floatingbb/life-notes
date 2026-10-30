import {apiError} from './api-read';
export function diaryRequest(payload:any){
 const text=JSON.stringify(payload);
 // CloudBase caps text requests at 100 KB, but binary requests allow 6 MB.
 // Keep the same JSON document and send photo-bearing saves as binary data.
 const binary=['save','importPost','importComment'].includes(payload.action)||(payload.action==='comment'&&!!payload.image);
 return {method:'POST',headers:{'Content-Type':binary?'application/octet-stream':'application/json'},body:binary?new Blob([text],{type:'application/octet-stream'}):text};
}
export async function sendDiary(payload:any){
 let r:Response;try{r=await fetch('/api/diary',diaryRequest(payload))}catch{throw Error('网络连接中断，内容还在页面里，请稍后再试。')}
 let d:any;try{d=await r.json()}catch{throw Error('服务器暂时没有正常回应，内容还在页面里，请稍后再试。')}
 if(!r.ok)throw apiError(r.status,d);
 return d;
}

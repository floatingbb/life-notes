export function diaryRequest(payload:any){
 const text=JSON.stringify(payload);
 // CloudBase caps text requests at 100 KB, but binary requests allow 6 MB.
 // Keep the same JSON document and send photo-bearing saves as binary data.
 const binary=payload.action==='save'||(payload.action==='comment'&&!!payload.image);
 return {method:'POST',headers:{'Content-Type':binary?'application/octet-stream':'application/json'},body:binary?new Blob([text],{type:'application/octet-stream'}):text};
}
export async function sendDiary(payload:any){
 let r:Response;try{r=await fetch('/api/diary',diaryRequest(payload))}catch{throw Error('网络连接中断，内容还在页面里，请稍后再试。')}
 let d:any;try{d=await r.json()}catch{throw Error('服务器暂时没有正常回应，内容还在页面里，请稍后再试。')}
 if(!r.ok){if(d.error)throw Error(d.error);if(r.status===413||d.code==='EXCEED_MAX_PAYLOAD_SIZE')throw Error('这次提交的内容过大，请减少照片后重试。');if(r.status===401)throw Error('登录已过期，请先保留文字，再重新打开你的登录链接。');if(r.status===429)throw Error('操作有些频繁，请稍等片刻再试。');throw Error('保存暂时未完成，内容还在页面里，请稍后再试。')}
 return d;
}

export type ReadProgress={phase:'loading'|'slow'|'retry'|'done',attempt:number};
export function readProgressText(p:ReadProgress){return p.phase==='retry'?`连接暂时不稳定，正在第 ${p.attempt} 次尝试…`:p.phase==='slow'?'读取比平时慢一些，请稍候；当前内容和输入会保留。':p.phase==='done'?'':'正在读取日记…'}
type Wait=(ms:number)=>Promise<void>;
export function apiError(status:number,data:any={}){
 const rate=status===429||status===514||data?.code==='EXCEED_RATELIMIT';
 const message=rate?(typeof data?.error==='string'&&data.error.includes('十分钟')?data.error:'网站的访问限制暂时拦住了请求，请稍等几秒再试。当前输入会保留。'):status===401?(typeof data?.error==='string'?data.error:'登录已过期，请保留文字后重新打开你的专属链接。'):status===413||data?.code==='EXCEED_MAX_PAYLOAD_SIZE'?'这次提交的内容过大，请减少照片后重试。':typeof data?.error==='string'?data.error:'服务器暂时没有正常回应，内容还在页面里，请稍后重试。';
 return Object.assign(Error(message),{status,conflict:!!data?.conflict,code:rate?'EXCEED_RATELIMIT':data?.code});
}
export function createApiReader(options:{fetch?:typeof fetch,wait?:Wait,timeoutMs?:number}={}){
 const listeners=new Map<string,Set<(p:ReadProgress)=>void>>();const emit=(url:string,p:ReadProgress)=>{for(const fn of listeners.get(url)||[])fn(p)};
 const pending=new Map<string,Promise<any>>(),wait=options.wait||((ms:number)=>new Promise<void>(resolve=>setTimeout(resolve,ms)));
 async function run(url:string){
  for(let attempt=0;attempt<3;attempt++){
   emit(url,{phase:attempt?'retry':'loading',attempt:attempt+1});const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),options.timeoutMs||12000),slow=setTimeout(()=>emit(url,{phase:'slow',attempt:attempt+1}),3500);let response:Response;
   try{response=await (options.fetch||fetch)(url,{cache:'no-store',signal:controller.signal})}catch{clearTimeout(timer);clearTimeout(slow);if(attempt<2){await wait(800*(attempt+1));continue}throw Error('连接等待较久或网络中断，请保留当前输入后重试。')}
   let data:any;try{data=await response.json()}catch{clearTimeout(timer);clearTimeout(slow);if(attempt<2&&response.status!==401&&response.status!==403){await wait(800*(attempt+1));continue}throw apiError(response.status)}finally{clearTimeout(timer)}
   if(response.ok)return data;
   if(attempt<2&&[429,502,503,504,514].includes(response.status)){const retry=Number(response.headers.get('Retry-After'));await wait(Number.isFinite(retry)&&retry>0?Math.min(5000,retry*1000):1000*(attempt+1));continue}
   throw apiError(response.status,data);
  }
 }
 return function readJson(url:string,onProgress?:(p:ReadProgress)=>void){if(onProgress){if(!listeners.has(url))listeners.set(url,new Set());listeners.get(url)!.add(onProgress)}const existing=pending.get(url);if(existing)return existing;const task=run(url).finally(()=>{emit(url,{phase:'done',attempt:0});pending.delete(url);listeners.delete(url)});pending.set(url,task);return task};
}
// Only coalesce requests while they are in flight. Never store private diary data.
export const readJson=createApiReader();

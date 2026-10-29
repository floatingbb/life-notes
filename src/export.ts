import {PDFDocument} from 'pdf-lib';

type Entry={id:string,author:string,body:string,images:string[],scope:string,created:string,comments?:{author:string,body:string,created:string,image?:string}[]};
type Journal={members:{id:string,name:string,displayName?:string}[],posts:Entry[]};
type Progress=(message:string)=>void;
const W=1240,H=1754,M=94,BOTTOM=H-110;
const ink='#343e34',muted='#737d6c',green='#61735a';
const date=(s:string)=>new Intl.DateTimeFormat('zh-CN',{timeZone:'Asia/Shanghai',year:'numeric',month:'long',day:'numeric',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).format(new Date(s));

export function downloadFile(blob:Blob,name:string){
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
}
async function photoData(src:string){
 if(/^data:image\/jpeg;base64,/.test(src))return src;
 const url=new URL(src,location.origin);if(url.origin!==location.origin||!url.pathname.startsWith('/api/photo/'))throw Error('照片地址不正确，请刷新网页后重试');
 const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw Error('照片读取失败，请确认仍有查看权限后重试');
 const blob=await r.blob();return new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(String(reader.result));reader.onerror=()=>reject(Error('照片读取失败'));reader.readAsDataURL(blob)});
}
export async function createJsonBackup(data:Journal,onProgress:Progress=()=>{}){
 const posts=[];for(const [i,p]of data.posts.entries()){onProgress(`正在整理第 ${i+1}/${data.posts.length} 则日记…`);const images=[];for(const src of p.images)images.push(await photoData(src));const comments=[];for(const c of p.comments||[])comments.push({...c,...(c.image?{image:await photoData(c.image)}:{})});posts.push({...p,images,...(p.comments?{comments}:{})})}
 return new Blob([JSON.stringify({application:'日子之间',exported:new Date().toISOString(),members:data.members,posts},null,2)],{type:'application/json'});
}

// The browser supplies its installed Chinese font. Each A4 page is rendered
// separately, so no external font service or private diary upload is needed.
export async function createJournalPdf(data:Journal,onProgress:Progress=()=>{},runtime?:{canvas:()=>any,image:(src:string)=>Promise<any>,yield?:()=>Promise<void>}){
 const pdf=await PDFDocument.create();pdf.setTitle('日子之间 · 家庭相册');pdf.setAuthor('日子之间');pdf.setSubject('当前账号可见的日记与照片');pdf.setCreator('日子之间');
 const makeCanvas=runtime?.canvas||(()=>document.createElement('canvas'));
 const loadImage=runtime?.image||(async(src:string)=>{const image=new Image();image.src=await photoData(src);await image.decode();return image});
 const pause=runtime?.yield||(()=>new Promise<void>(resolve=>setTimeout(resolve,0)));
 const who=(id:string)=>{const m=data.members.find(m=>m.id===id);return m?.displayName||m?.name||'家人'};
 let canvas:any,ctx:any,y=0,page=0;
 function font(size:number,bold=false){ctx.font=`${bold?'600 ':''}${size}px "Microsoft YaHei", "PingFang SC", "Noto Sans CJK SC", "Segoe UI Emoji", "Apple Color Emoji", "Noto Color Emoji", sans-serif`}
 function newPage(){canvas=makeCanvas();canvas.width=W;canvas.height=H;ctx=canvas.getContext('2d');if(!ctx)throw Error('当前浏览器无法生成 PDF，请使用手机系统浏览器重试');ctx.fillStyle='#fffefa';ctx.fillRect(0,0,W,H);ctx.textBaseline='top';ctx.fillStyle=green;font(24,true);ctx.fillText('日子之间',M,49);ctx.fillStyle=muted;font(18);ctx.textAlign='right';ctx.fillText('家庭相册 · 日期按中国时间',W-M,53);ctx.textAlign='left';ctx.strokeStyle='#e6e7dc';ctx.beginPath();ctx.moveTo(M,91);ctx.lineTo(W-M,91);ctx.stroke();y=125;page++}
 async function finishPage(){ctx.fillStyle=muted;font(18);ctx.textAlign='center';ctx.fillText(String(page),W/2,H-67);ctx.textAlign='left';const jpg=canvas.toDataURL('image/jpeg',.91);const image=await pdf.embedJpg(jpg);const p=pdf.addPage([595.28,841.89]);p.drawImage(image,{x:0,y:0,width:595.28,height:841.89});canvas.width=1;canvas.height=1;await pause()}
 async function room(height:number){if(y+height>BOTTOM){await finishPage();newPage()}}
 async function text(value:string,size=26,color=ink,bold=false){
  const lineHeight=Math.ceil(size*1.7),maxWidth=W-2*M;
  // Break at grapheme boundaries, preserving paragraphs and long unspaced text.
  const Segmenter=(Intl as any).Segmenter,segmenter=Segmenter?new Segmenter('zh-CN',{granularity:'grapheme'}):null;
  for(const paragraph of String(value).replace(/\r\n?/g,'\n').split('\n')){
   const chars=segmenter?Array.from(segmenter.segment(paragraph),(s:any)=>s.segment):Array.from(paragraph);let line='';
   for(const char of chars){font(size,bold);if(line&&ctx.measureText(line+char).width>maxWidth){await room(lineHeight);font(size,bold);ctx.fillStyle=color;ctx.fillText(line,M,y);y+=lineHeight;line=char}else line+=char}
   await room(lineHeight);font(size,bold);ctx.fillStyle=color;ctx.fillText(line,M,y);y+=lineHeight;
  }
 }
 async function picture(src:string){const image=await loadImage(src),iw=image.naturalWidth||image.width,ih=image.naturalHeight||image.height;if(!iw||!ih)throw Error('有一张照片读取失败，请重试');const scale=Math.min((W-2*M)/iw,650/ih),width=iw*scale,height=ih*scale;await room(height+22);ctx.drawImage(image,M+(W-2*M-width)/2,y,width,height);y+=height+22;await pause()}
 newPage();await text('把小日子，留在这里。',40,green,true);await text(`共 ${data.posts.length} 则记录 · 慢慢看，不用急着回复。`,22,muted);y+=26;
 const posts=[...data.posts].sort((a,b)=>a.created.localeCompare(b.created));
 if(!posts.length)await text('还没有日记，下一次导出时再相遇。');
 for(const [i,p]of posts.entries()){
  onProgress(`正在排版第 ${i+1}/${posts.length} 则日记…`);await room(185);
  ctx.strokeStyle='#dce2d2';ctx.beginPath();ctx.moveTo(M,y);ctx.lineTo(W-M,y);ctx.stroke();y+=24;
  await text(who(p.author),29,green,true);await text(`${date(p.created)} · ${p.scope==='self'?'仅自己':p.scope==='selected'?'指定家人可见':'全家可见'}`,21,muted);y+=12;
  if(p.body)await text(p.body);
  for(const src of p.images)await picture(src);
  if(p.comments?.length){await text('家人留下的话',22,muted,true);for(const c of p.comments){await text(`${who(c.author)}：${c.body}`,23);if(c.image)await picture(c.image)}}
  y+=30;await pause();
 }
 await finishPage();onProgress('正在保存 PDF…');const bytes=await pdf.save();return new Blob([bytes as BlobPart],{type:'application/pdf'});
}

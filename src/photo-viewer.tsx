import RetryImage from './retry-image';
import {useEffect,useRef,useState} from 'react';
import {X,ChevronLeft,ChevronRight} from 'lucide-react';
import {swipeDirection,slideIndex} from './gallery';
export default function PhotoViewer({images,initialIndex,onClose}:{images:string[],initialIndex:number,onClose:()=>void}){
 const [index,setIndex]=useState(slideIndex(initialIndex,0,images.length));
 const start=useRef<{id:number,x:number,y:number,image:boolean}|null>(null),ignoreClick=useRef(false),dialog=useRef<HTMLDivElement>(null);
 function move(delta:number){setIndex(i=>slideIndex(i,delta,images.length))}
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null,overflow=document.body.style.overflow;document.body.style.overflow='hidden';dialog.current?.focus();return()=>{document.body.style.overflow=overflow;previous?.focus()}},[]);
 return <div className="photo-viewer" role="dialog" aria-modal="true" aria-label="照片相册" ref={dialog} tabIndex={-1} onKeyDown={e=>{
  if(e.key==='Escape'){e.preventDefault();onClose()}
  else if(e.key==='ArrowLeft'){e.preventDefault();move(-1)}
  else if(e.key==='ArrowRight'){e.preventDefault();move(1)}
  else if(e.key==='Tab'){
   const nodes=Array.from(dialog.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)')||[]),first=nodes[0],last=nodes[nodes.length-1];
   if(e.shiftKey&&(document.activeElement===first||document.activeElement===dialog.current)){e.preventDefault();last?.focus()}
   else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus()}
  }
 }}>
  <button className="viewer-close" aria-label="关闭照片相册" onClick={onClose}><X size={26}/></button>
  <p className="viewer-counter" role="status" aria-live="polite">{index+1} / {images.length}</p>
  <div className="viewer-image-area" onClick={e=>{if(ignoreClick.current){ignoreClick.current=false;return}if(e.target===e.currentTarget)onClose()}} onPointerDown={e=>{
   if(!e.isPrimary){start.current=null;return}
   ignoreClick.current=false;start.current={id:e.pointerId,x:e.clientX,y:e.clientY,image:(e.target as HTMLElement).tagName==='IMG'};e.currentTarget.setPointerCapture(e.pointerId);
  }} onPointerUp={e=>{
   const s=start.current;start.current=null;
   if(s?.id===e.pointerId){const dx=e.clientX-s.x,dy=e.clientY-s.y;ignoreClick.current=s.image||Math.abs(dx)>12||Math.abs(dy)>12;const direction=swipeDirection(dx,dy);if(direction)move(direction)}
  }} onPointerCancel={()=>{start.current=null;ignoreClick.current=true}}>
   <RetryImage key={images[index]} src={images[index]} loading="eager" alt={'生活照片，第'+(index+1)+'张，共'+images.length+'张'}/>
  </div>
  {images.length>1&&<>
   <button className="viewer-prev" disabled={index===0} aria-label="上一张照片" onClick={()=>move(-1)}><ChevronLeft size={30}/></button>
   <button className="viewer-next" disabled={index===images.length-1} aria-label="下一张照片" onClick={()=>move(1)}><ChevronRight size={30}/></button>
   <p className="viewer-tip">左右滑动看照片 · 电脑可用方向键</p>
  </>}
 </div>;
}

import {useState} from 'react';
type Props={src:string,alt:string,onOpen?:()=>void,className?:string,loading?:'lazy'|'eager',version?:number};
export function versionedImage(src:string,version=0){return src.startsWith('/api/photo/')&&version?src+(src.includes('?')?'&':'?')+'revision='+version:src}
export default function RetryImage(props:Props){const src=versionedImage(props.src,props.version);return <ImageAttempt key={src} {...props} src={src}/>}
function ImageAttempt({src,alt,onOpen,className='',loading='lazy'}:Props){
 const [state,setState]=useState('loading'),[retry,setRetry]=useState(0);
 const actual=retry&&!src.startsWith('data:')?src+(src.includes('?')?'&':'?')+'_imageRetry='+retry:src;
 const picture=<img key={actual} src={actual} alt={alt} loading={loading} onLoad={()=>setState('ready')} onError={()=>setState('error')} draggable={false}/>;
 return <span className={'retry-image '+className+' is-'+state}>
  {onOpen?<button type="button" className="image-open" aria-label="查看大图" disabled={state!=='ready'} onClick={onOpen}>{picture}</button>:picture}
  {state==='loading'&&<span className="image-status" role="status">图片加载中…</span>}
  {state==='error'&&<span className="image-failure"><span>这张图片暂时没加载出来</span><button type="button" className="image-retry" onClick={e=>{e.stopPropagation();setState('loading');setRetry(Date.now())}}>重新加载这张</button></span>}
 </span>;
}

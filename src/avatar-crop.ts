export const CROP_STAGE=320,CROP_DIAMETER=256;
export function cropGeometry(width:number,height:number,zoom:number,offset:{x:number,y:number}){
 if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0)throw Error('照片尺寸无效');
 const scale=CROP_DIAMETER/Math.min(width,height)*Math.max(1,Math.min(4,zoom));
 const x=Math.max(-(width*scale-CROP_DIAMETER)/2,Math.min((width*scale-CROP_DIAMETER)/2,offset.x));
 const y=Math.max(-(height*scale-CROP_DIAMETER)/2,Math.min((height*scale-CROP_DIAMETER)/2,offset.y));
 const edge=CROP_DIAMETER/scale;
 return {scale,x,y,width:width*scale,height:height*scale,sx:Math.max(0,width/2-(CROP_DIAMETER/2+x)/scale),sy:Math.max(0,height/2-(CROP_DIAMETER/2+y)/scale),edge};
}

export async function toDiaryImage(file:File){
 if(!file.type.startsWith('image/'))throw Error('请选择照片');
 if(file.size>25000000)throw Error('请选择25MB以内的照片');
 const url=URL.createObjectURL(file);
 try{
  const image=new Image();image.src=url;try{await image.decode()}catch{throw Error('这张照片暂不支持，请使用 JPG 或 PNG')}
  const scale=Math.min(1,1200/Math.max(image.naturalWidth,image.naturalHeight)),canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(image.naturalWidth*scale));canvas.height=Math.max(1,Math.round(image.naturalHeight*scale));const ctx=canvas.getContext('2d');if(!ctx)throw Error('浏览器暂时无法处理照片');ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
  let quality=.8,result=canvas.toDataURL('image/jpeg',quality);while(result.length>205000&&quality>.2){quality-=.1;result=canvas.toDataURL('image/jpeg',quality)}if(result.length>205000)throw Error('照片细节较多，请裁剪后再试');return result;
 }finally{URL.revokeObjectURL(url)}
}

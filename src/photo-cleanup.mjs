export async function purgeUnusedPhotos(keys,{listPosts,listComments=async()=>[],removePhotos}){
 const unique=[...new Set(keys)];
 if(unique.some(k=>typeof k!=='string'||! /^[a-f0-9]{64}\.jpg$/.test(k)))throw Error('PHOTO_KEY');
 if(!unique.length)return;
 const [remaining,comments]=await Promise.all([listPosts(),listComments()]),used=new Set([...remaining.flatMap(p=>p.images||[]),...comments.map(c=>c.image).filter(Boolean)]);
 const unused=unique.filter(k=>!used.has(k));
 if(unused.length)await removePhotos(unused);
}

export function cloudConfig(env){
 const envId=String(env.CLOUDBASE_ENV_ID||'').trim(),region=String(env.CLOUDBASE_REGION||'').trim(),photoBucket=String(env.PHOTO_BUCKET||'our-days-photos').trim();
 if(!envId||/YOUR_|PLACEHOLDER|example/i.test(envId))throw Error('Set CLOUDBASE_ENV_ID to your own NEW CloudBase environment.');
 if(!/^ap-[a-z]+(?:-[a-z]+)*$/.test(region))throw Error('Set CLOUDBASE_REGION to the matching deployment region.');
 if(!/^[a-z0-9][a-z0-9-]{1,62}$/.test(photoBucket))throw Error('Invalid PHOTO_BUCKET.');
 if(!env.CLOUDBASE_APIKEY||env.CLOUDBASE_APIKEY.length<32)throw Error('Set a server-only CLOUDBASE_APIKEY for your own environment.');
 if(!env.SESSION_SECRET||env.SESSION_SECRET.length<32)throw Error('Generate a new SESSION_SECRET of at least 32 characters.');
 return {envId,region,photoBucket};
}

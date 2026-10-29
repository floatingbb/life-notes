export function parseSetupToken(input:string):string {
  const text=input.trim();
  if(/^[a-f0-9]{64}$/.test(text))return text;
  try{
    const url=new URL(text,'https://our-days.invalid/');
    const token=new URLSearchParams(url.hash.slice(1)).get('setup')||'';
    return /^[a-f0-9]{64}$/.test(token)?token:'';
  }catch{return '';}
}

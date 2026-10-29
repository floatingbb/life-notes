export function parseInviteCode(input:string){
 const s=input.trim();if(/^[A-Za-z0-9_-]{43}$/.test(s))return s;
 try{const u=new URL(s,'https://our-days.invalid/'),code=new URLSearchParams(u.hash.slice(1)).get('join')||'';return /^[A-Za-z0-9_-]{43}$/.test(code)?code:''}catch{return ''}
}

export function swipeDirection(dx:number,dy:number){return Math.abs(dx)>=40&&Math.abs(dx)>Math.abs(dy)*1.2?(dx<0?1:-1):0}
export function slideIndex(index:number,delta:number,count:number){return Math.max(0,Math.min(Math.max(0,count-1),index+delta))}

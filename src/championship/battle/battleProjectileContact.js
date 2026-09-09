import {battleNativeBoxContact} from './battleActionApplication.js';

/** ARM9 02066C90, including collinear/degenerate and signed32 products. */
export function battleNativeSegmentContact(a,b,c,d){
 const sub=(x,y)=>(x-y)|0,m=Math.imul;
 const rx=sub(d[0],a[0]),ry=sub(c[1],a[1]),sy=sub(d[1],a[1]),sx=sub(c[0],a[0]);
 const det=sub(m(sx,sy),m(ry,rx)),bx=sub(b[0],a[0]),by=sub(b[1],a[1]);
 if(det!==0){
  const u=sub(m(sy,bx),m(rx,by)),v=sub(m(sx,by),m(ry,bx));
  if(det<0?(u>0||v>0):(u<0||v<0))return false;
  return Math.trunc(((u+v)|0)/det)>=1;
 }
 const dot=(x,y,z,w)=>(m(x,y)+m(z,w))|0;
 return dot(ry,sy,sx,rx)<=0||dot(sub(c[1],b[1]),sub(d[1],b[1]),sub(c[0],b[0]),sub(d[0],b[0]))<=0
  ||dot(sub(a[1],c[1]),sub(b[1],c[1]),sub(a[0],c[0]),sub(b[0],c[0]))<=0;
}

/** OVL19 0211BA40. Rotation is applied after the existing cell flip/scale.
 * Native rotated contact tests edges only; target Z is absent in that branch. */
export function battleNativeProjectileContact(a,p,sin,cos,b,q){
 if(!a||!b)return false;
 if(sin===0&&cos===4096)return battleNativeBoxContact(a,p,b,q);
 const corners=[[a.lowX,a.lowY],[a.lowX,a.highY],[a.highX,a.highY],[a.highX,a.lowY]];
 const polygon=corners.map(([x,y])=>[((p[0]+Math.imul(x,cos)-Math.imul(y,sin))|0)>>12,
  ((p[1]+Math.imul(x,sin)+Math.imul(y,cos)-p[2])|0)>>12]);
 // Integer halfword bounds times4096 are exact float32 here. ±0.5 rounds
 // back to the same signed integer before the world addition and ASR.
 const pos=(v,bound)=>((v+(bound<<12))|0)>>12;
 const lx=pos(q[0],b.lowX)+3,ly=pos(q[1],b.lowY)+6,hx=pos(q[0],b.highX)-3,hy=pos(q[1],b.highY)-3;
 const target=[[lx,ly],[lx,hy],[hx,hy],[hx,ly]];
 return polygon.some((v,i)=>target.some((w,j)=>battleNativeSegmentContact(v,polygon[(i+1)%4],w,target[(j+1)%4])));
}

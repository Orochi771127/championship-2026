export function actorLocalQuad(node){
  const s=node.characterSprite,t=s.texture,r=t.trim??{x:0,y:0,width:t.orig.width,height:t.orig.height};
  const x0=(r.x-s.anchor.x*t.orig.width)*s.scale.x+s.x,y0=(r.y-s.anchor.y*t.orig.height)*s.scale.y+s.y;
  const x1=x0+r.width*s.scale.x,y1=y0+r.height*s.scale.y;
  return [[x0,y0],[x0,y1],[x1,y1],[x1,y0]].map(([x,y])=>[x*node.scale.x,y*node.scale.y]);
}
export function actorWorldBounds(wild,node,padding=0){
  const q=actorLocalQuad(node),xs=q.map(v=>wild.worldX+v[0]),ys=q.map(v=>wild.worldY-(wild.worldZ??0)+v[1]);
  return {left:Math.min(...xs)-padding,right:Math.max(...xs)+padding,top:Math.min(...ys)-padding,bottom:Math.max(...ys)+padding};
}

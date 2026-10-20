// Owner-approved product adaptation, 2026-10-21. Navigation is derived once
// from the existing ground. It never changes an owned obstacle or occluder.
import {productGridCell, productPlacementCells} from './productRanchGrid.js';
// Existing authored large/small theme pairs (shared-edges-polish-20261019).
// Unlisted fields match only their own definition; appearance is not inferred.
const THEMES=[[1,27],[4,30],[6,31],[9,32],[8,33],[17,29],[28,15]];
const theme=id=>THEMES.findIndex(pair=>pair.some(n=>id===`championship:2026:cage:${n}`));
export const sameRanchTerrain=(a,b)=>a===b||(theme(a)>=0&&theme(a)===theme(b));
const HEX = [[0,24],[48,0],[96,24],[96,88],[48,112],[0,88]];
const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
const key = p => `${p[0]},${p[1]}`;
const edgeKey = (a,b) => [key(a),key(b)].sort().join('|');
const point = (i,w) => [(i%w)*8+4,Math.floor(i/w)*8+4];
function distanceToEdge(p,a,b) {
  const dx=b[0]-a[0],dy=b[1]-a[1];
  const t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy)));
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
}
function inside(p,polygon) {
  let sign=0;
  for(let i=0;i<polygon.length;i++){
    const a=polygon[i],b=polygon[(i+1)%polygon.length],cross=(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);
    if(Math.abs(cross)<.001)continue;
    if(sign&&Math.sign(cross)!==sign)return false;sign=Math.sign(cross);
  }
  return true;
}
/** Shared segments from native footprint identity; never wrap the board edge. */
export function ranchSharedBoundaries(placements) {
  const edges=new Map(),result=[];
  for(const p of placements)for(const slot of productPlacementCells(p)??[]){
    const c=productGridCell(slot),polygon=HEX.map(([x,y])=>[c.x+x,c.y-24+y]);
    for(let i=0;i<6;i++){
      const a=polygon[i],b=polygon[(i+1)%6],k=edgeKey(a,b),other=edges.get(k);
      if(!other){edges.set(k,{p,a,b,polygon,slot});continue;}
      if(other.p.ownerIndex===p.ownerIndex)continue;
      const same=sameRanchTerrain(p.moduleId,other.p.moduleId);
      const h=p.groundHeight??0,oh=other.p.groundHeight??0;
      result.push({id:k,a,b,left:other.p.ownerIndex,right:p.ownerIndex,
        polygons:[other.polygon,polygon],compatible:same&&Number.isFinite(h)&&h===oh,
        reason:!same?'DIFFERENT_TYPE':h!==oh?'DIFFERENT_HEIGHT':null});
    }
  }
  return result;
}
function neighbors(i,width,height) {
  const x=i%width,y=Math.floor(i/width);
  return DIRS.flatMap(([dx,dy])=>x+dx>=0&&x+dx<width&&y+dy>=0&&y+dy<height?[(y+dy)*width+x+dx]:[]);
}
function search(start,goals,ground,allowed) {
  const {width,height}=ground,size=width*height,prev=new Int32Array(size).fill(-1),queue=new Int32Array(size);
  let head=0,tail=1;queue[0]=start;prev[start]=start;
  while(head<tail){
    const i=queue[head++];
    if(goals.has(i)){
      const route=[i];while(route.at(-1)!==start)route.push(prev[route.at(-1)]);
      return route.reverse();
    }
    for(const j of neighbors(i,width,height))if(prev[j]===-1&&allowed(j)){prev[j]=i;queue[tail++]=j;}
  }
  return null;
}
export function connectRanchGround(ground) {
  const {width,height,owners,terrain,clearance}=ground;
  const boundaries=ranchSharedBoundaries(ground.placements),connections=[],corridorOwner=new Int16Array(terrain.length).fill(-1);
  for(const edge of boundaries){
    if(!edge.compatible)continue;
    const mid=[(edge.a[0]+edge.b[0])/2,(edge.a[1]+edge.b[1])/2];
    // Keep the ends of a hex joint closed. The entrance is a visible, bounded
    // passage, not permission to walk through every point on a shared border.
    const inPortal=i=>distanceToEdge(point(i,width),edge.a,edge.b)<=28
      &&Math.hypot(point(i,width)[0]-mid[0],point(i,width)[1]-mid[1])<=40
      &&edge.polygons.some(poly=>inside(point(i,width),poly));
    const candidates=owner=>{
      const result=[];for(let i=0;i<owners.length;i++)if(owners[i]===owner&&terrain[i]!==1&&inPortal(i))result.push(i);
      return result.sort((a,b)=>Math.hypot(...point(a,width).map((v,n)=>v-mid[n]))-Math.hypot(...point(b,width).map((v,n)=>v-mid[n])));
    };
    const left=candidates(edge.left),right=candidates(edge.right),goals=new Set(right);
    const allowed=i=>inPortal(i)&&(owners[i]===-1||owners[i]===edge.left||owners[i]===edge.right)
      &&(terrain[i]!==1||owners[i]===-1);
    let route=null;
    for(const start of left.slice(0,12)){
      route=search(start,goals,ground,allowed);if(route)break;
    }
    if(!route){edge.reason='NO_SAFE_EXIT';continue;}
    const cells=new Set(route);
    // Up to 24 native pixels wide. Widen only into eligible seam void, never
    // into an owned wall/tree/water obstacle. Existing floor stays byte-identical.
    for(const i of route)for(const j of neighbors(i,width,height))if(allowed(j))cells.add(j);
    for(const i of cells)if(owners[i]===-1){
      terrain[i]=0;clearance[i]=Math.max(clearance[i],2);corridorOwner[i]=edge.left;
    }
    edge.reason='CONNECTED';
    connections.push(Object.freeze({id:edge.id,left:edge.left,right:edge.right,a:edge.a,b:edge.b,
      route:Object.freeze(route.map(i=>Object.freeze(point(i,width)))),cells:Object.freeze([...cells])}));
  }
  // Components are computed only after a layout rebuild, not on every frame.
  const component=new Int32Array(terrain.length).fill(-1),components=[];
  for(let start=0;start<terrain.length;start++){
    if(terrain[start]===1||component[start]!==-1)continue;
    const id=components.length,cells=[start];component[start]=id;
    for(let n=0;n<cells.length;n++)for(const j of neighbors(cells[n],width,height))
      if(terrain[j]!==1&&component[j]===-1){component[j]=id;cells.push(j);}
    components.push(cells);
  }
  const byOwner=new Map(ground.placements.map(p=>[p.ownerIndex,p]));
  const cellAt=p=>{const x=Math.floor(p[0]/8),y=Math.floor(p[1]/8);return x>=0&&x<width&&y>=0&&y<height?y*width+x:-1;};
  const graph=new Map(ground.placements.map(p=>[p.ownerIndex,new Set([p.ownerIndex])]));
  for(const c of connections){graph.get(c.left).add(c.right);graph.get(c.right).add(c.left);}
  function connectedOwners(owner){
    const found=new Set([owner]),queue=[owner];
    for(const i of queue)for(const j of graph.get(i)??[])if(!found.has(j)){found.add(j);queue.push(j);}
    return found;
  }
  const navigation=Object.freeze({
    connections:Object.freeze(connections),boundaries:Object.freeze(boundaries),component,
    connectedOwners:owner=>[...connectedOwners(owner)],
    plan(startPosition,targetOwner,ordinal=0){
      const start=cellAt(startPosition);if(start<0||component[start]<0)return null;
      const home=owners[start]>=0?owners[start]:corridorOwner[start];
      if(!connectedOwners(home).has(targetOwner))return null;
      const goals=components[component[start]].filter(i=>owners[i]===targetOwner&&clearance[i]>1);
      if(!goals.length)return null;
      const goal=goals[(Math.abs(ordinal)*31)%goals.length];
      const permitted=connectedOwners(home);
      const path=search(start,new Set([goal]),ground,i=>terrain[i]!==1
        &&permitted.has(owners[i]>=0?owners[i]:corridorOwner[i]));
      return path?.slice(1).map(i=>point(i,width))??null;
    },
    ownerAt:p=>{const i=cellAt(p);return i<0?null:byOwner.get(owners[i]>=0?owners[i]:corridorOwner[i])??null;}
  });
  return {...ground,navigation};
}

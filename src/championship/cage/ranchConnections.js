// Hex cage world navigation (Owner direction 2026-10-26; first passages 2026-10-21).
// Two placements are neighbours only when they share a complete hex edge;
// touching at a corner never connects. When their ecology allows passage
// (ranchEcology.js) the whole shared edge opens: the seam void between the two
// cages becomes floor wherever both floors reach it, so partners walk straight
// across the old border. Owned obstacles (rocks, trees, water, walls) are never
// changed, and the corner tips stay closed so a joint cannot leak into a third
// cage. Connected regions are recomputed whenever the layout is rebuilt.
import {productGridCell, productPlacementCells} from './productRanchGrid.js';
import {ranchAllowsPassage, ranchMergesAppearance, ranchEcologyType} from './ranchEcology.js';

/** Kept for existing callers: same ecology may pass. */
export const sameRanchTerrain=(a,b)=>ranchAllowsPassage(a,b);
const HEX = [[0,24],[48,0],[96,24],[96,88],[48,112],[0,88]];
const DIRS = [[1,0],[-1,0],[0,1],[0,-1]];
// Native px. The seam band reaches this far into each cage, and this much of
// each end of the edge stays closed (the corner a third cell may touch).
export const RANCH_SEAM_REACH = 28;
export const RANCH_SEAM_CORNER_GUARD = 10;
const key = p => `${p[0]},${p[1]}`;
const edgeKey = (a,b) => [key(a),key(b)].sort().join('|');
const point = (i,w) => [(i%w)*8+4,Math.floor(i/w)*8+4];
function edgeFrame(p,a,b) {
  const dx=b[0]-a[0],dy=b[1]-a[1],length=Math.hypot(dx,dy);
  const along=((p[0]-a[0])*dx+(p[1]-a[1])*dy)/length;
  const t=Math.max(0,Math.min(length,along));
  return {along,length,distance:Math.hypot(p[0]-a[0]-t*dx/length,p[1]-a[1]-t*dy/length)};
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
/** Hex outline of one lattice slot in native px. */
export function ranchSlotPolygon(slot) {
  const c=productGridCell(slot);
  return HEX.map(([x,y])=>[c.x+x,c.y-24+y]);
}
/**
 * Every hex edge shared by two different placements. `merged` drives the
 * seam art, `compatible` drives passage; they are separate on purpose.
 */
export function ranchSharedBoundaries(placements) {
  const edges=new Map(),result=[];
  for(const p of placements)for(const slot of productPlacementCells(p)??[]){
    const polygon=ranchSlotPolygon(slot);
    for(let i=0;i<6;i++){
      const a=polygon[i],b=polygon[(i+1)%6],k=edgeKey(a,b),other=edges.get(k);
      if(!other){edges.set(k,{p,a,b,polygon,slot});continue;}
      if(other.p.ownerIndex===p.ownerIndex)continue;
      const passable=ranchAllowsPassage(p.moduleId,other.p.moduleId);
      const merged=ranchMergesAppearance(p.moduleId,other.p.moduleId);
      const h=p.groundHeight??0,oh=other.p.groundHeight??0;
      const level=Number.isFinite(h)&&h===oh;
      result.push({id:k,a,b,left:other.p.ownerIndex,right:p.ownerIndex,slots:[other.slot,slot],
        polygons:[other.polygon,polygon],ecology:passable?ranchEcologyType(p.moduleId):null,
        merged:merged&&level,compatible:passable&&level,
        reason:!passable?'DIFFERENT_TYPE':!level?'DIFFERENT_HEIGHT':null});
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
function flood(starts,ground,allowed) {
  const seen=new Set(starts),queue=[...starts];
  for(let n=0;n<queue.length;n++)for(const j of neighbors(queue[n],ground.width,ground.height))
    if(!seen.has(j)&&allowed(j)){seen.add(j);queue.push(j);}
  return seen;
}
/** Placements grouped into connected regions (ownerIndex lists). */
export function ranchRegions(placements,connections) {
  const parent=new Map(placements.map(p=>[p.ownerIndex,p.ownerIndex]));
  const find=i=>{while(parent.get(i)!==i){parent.set(i,parent.get(parent.get(i)));i=parent.get(i);}return i;};
  for(const c of connections){const a=find(c.left),b=find(c.right);if(a!==b)parent.set(a,b);}
  const groups=new Map();
  for(const p of placements){const r=find(p.ownerIndex);groups.set(r,[...(groups.get(r)??[]),p.ownerIndex]);}
  return [...groups.values()].map(owners=>owners.sort((a,b)=>a-b)).sort((a,b)=>a[0]-b[0]);
}
// Real model obstacles can leave a walkable border pocket with no access to
// the cage interior. Only standing cells that reach their cage's interior count.
function interiorReach({width,height,owners,terrain,clearance}) {
  const reachesInterior=new Uint8Array(terrain.length),interiorQueue=[];
  for(let i=0;i<terrain.length;i++)if(owners[i]>=0&&terrain[i]!==1&&clearance[i]>1){reachesInterior[i]=1;interiorQueue.push(i);}
  for(let n=0;n<interiorQueue.length;n++){
    const i=interiorQueue[n];
    for(const j of neighbors(i,width,height))if(!reachesInterior[j]&&owners[j]===owners[i]&&terrain[j]!==1){reachesInterior[j]=1;interiorQueue.push(j);}
  }
  return reachesInterior;
}
export function connectRanchGround(ground) {
  const {width,height,owners,terrain,clearance}=ground;
  const boundaries=ranchSharedBoundaries(ground.placements),connections=[],corridorOwner=new Int16Array(terrain.length).fill(-1);
  // A seam opens only between standing cells that reach each cage's interior.
  const reachesInterior=interiorReach(ground);
  for(const edge of boundaries){
    if(!edge.compatible)continue;
    const mid=[(edge.a[0]+edge.b[0])/2,(edge.a[1]+edge.b[1])/2];
    // The band along the whole edge, minus the two corner tips.
    const inBand=i=>{
      const p=point(i,width),f=edgeFrame(p,edge.a,edge.b);
      return f.distance<=RANCH_SEAM_REACH&&f.along>=RANCH_SEAM_CORNER_GUARD&&f.along<=f.length-RANCH_SEAM_CORNER_GUARD
        &&edge.polygons.some(poly=>inside(p,poly));
    };
    const allowed=i=>inBand(i)&&(owners[i]===-1||owners[i]===edge.left||owners[i]===edge.right)
      &&(terrain[i]!==1||owners[i]===-1);
    const sideCells=owner=>{const result=[];for(let i=0;i<owners.length;i++)if(owners[i]===owner&&terrain[i]!==1&&reachesInterior[i]&&inBand(i))result.push(i);return result;};
    const left=sideCells(edge.left),right=sideCells(edge.right);
    const fromLeft=flood(left,ground,allowed),fromRight=flood(right,ground,allowed);
    if(!left.length||!right.length||!right.some(i=>fromLeft.has(i))){edge.reason='NO_SAFE_EXIT';continue;}
    // Open every seam cell both floors reach: the full joint, not one path.
    const opened=[];
    for(const i of fromLeft)if(owners[i]===-1&&fromRight.has(i)){
      terrain[i]=0;clearance[i]=Math.max(clearance[i],2);
      corridorOwner[i]=inside(point(i,width),edge.polygons[0])?edge.left:edge.right;opened.push(i);
    }
    const near=c=>Math.hypot(point(c,width)[0]-mid[0],point(c,width)[1]-mid[1]);
    const start=[...left].sort((a,b)=>near(a)-near(b))[0];
    const route=search(start,new Set(right),ground,i=>allowed(i)&&terrain[i]!==1)??[start];
    edge.reason='CONNECTED';
    connections.push(Object.freeze({id:edge.id,left:edge.left,right:edge.right,a:edge.a,b:edge.b,ecology:edge.ecology,
      route:Object.freeze(route.map(i=>Object.freeze(point(i,width)))),cells:Object.freeze(opened)}));
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
  const regions=ranchRegions(ground.placements,connections);
  const regionByOwner=new Map(regions.flatMap((owners,id)=>owners.map(o=>[o,id])));
  const connectedOwners=owner=>regions[regionByOwner.get(owner)]??[owner];
  const navigation=Object.freeze({
    connections:Object.freeze(connections),boundaries:Object.freeze(boundaries),component,
    regions:Object.freeze(regions.map(r=>Object.freeze(r))),regionOf:owner=>regionByOwner.get(owner)??null,
    connectedOwners:owner=>[...connectedOwners(owner)],
    plan(startPosition,targetOwner,ordinal=0){
      const start=cellAt(startPosition);if(start<0||component[start]<0)return null;
      const home=owners[start]>=0?owners[start]:corridorOwner[start];
      const permitted=new Set(connectedOwners(home));
      if(!permitted.has(targetOwner))return null;
      // Only cells this actor can really reach: same walkable component.
      const goals=components[component[start]].filter(i=>owners[i]===targetOwner&&clearance[i]>1);
      if(!goals.length)return null;
      const goal=goals[(Math.abs(ordinal)*31)%goals.length];
      const path=search(start,new Set([goal]),ground,i=>terrain[i]!==1
        &&permitted.has(owners[i]>=0?owners[i]:corridorOwner[i]));
      return path?.slice(1).map(i=>point(i,width))??null;
    },
    ownerAt:p=>{const i=cellAt(p);return i<0?null:byOwner.get(owners[i]>=0?owners[i]:corridorOwner[i])??null;}
  });
  return {...ground,navigation};
}

/**
 * Safe exits (Owner 2026-10-27, for the editor's marks): every outer hex edge
 * of every placement whose own floor reaches it, by the seam rule above (the
 * band along the edge minus its corner tips, interior-reaching standing cells
 * only). A passage opens exactly where two compatible cages both have one.
 * Returns edge id (as ranchSharedBoundaries) -> owners whose floor reaches it.
 */
export function ranchSafeExits(ground) {
  const {width,owners,terrain}=ground,reachesInterior=interiorReach(ground);
  const edgesByOwner=new Map();
  for(const p of ground.placements){
    const cells=productPlacementCells(p)??[];
    const list=[];
    for(const slot of cells){
      const polygon=ranchSlotPolygon(slot);
      for(let i=0;i<6;i++){
        const a=polygon[i],b=polygon[(i+1)%6],id=edgeKey(a,b);
        list.push({id,a,b,polygon});
      }
    }
    // An edge two of the placement's own cells share is inside it, not an exit.
    const count=new Map();for(const e of list)count.set(e.id,(count.get(e.id)??0)+1);
    edgesByOwner.set(p.ownerIndex,list.filter(e=>count.get(e.id)===1));
  }
  const exits=new Map();
  for(let i=0;i<owners.length;i++){
    const owner=owners[i];
    if(owner<0||terrain[i]===1||!reachesInterior[i])continue;
    const p=point(i,width);
    for(const e of edgesByOwner.get(owner)??[]){
      if(exits.get(e.id)?.has(owner))continue;
      const f=edgeFrame(p,e.a,e.b);
      if(f.distance<=RANCH_SEAM_REACH&&f.along>=RANCH_SEAM_CORNER_GUARD&&f.along<=f.length-RANCH_SEAM_CORNER_GUARD&&inside(p,e.polygon))
        exits.set(e.id,new Set([...(exits.get(e.id)??[]),owner]));
    }
  }
  return {exits,edgesByOwner};
}

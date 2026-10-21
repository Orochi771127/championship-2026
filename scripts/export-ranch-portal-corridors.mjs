import fs from 'node:fs';
import {listCageDefinitions} from '../src/championship/cage/cageCatalog.js';
import {PRODUCT_RANCH_GRID,validateProductRanch,productFieldTileOrigin} from '../src/championship/cage/productRanchGrid.js';
import {ORIGINAL_CAGE_DEFINITION_SHAPES} from '../src/championship/cage/ranchSlotGeometry.js';
import {sameRanchTerrain} from '../src/championship/cage/ranchConnections.js';
import {composeProductRanchGround} from '../src/championship/raising/nativeRaisingRanchRing.js';
import {getOriginalCageVisualBinding} from '../src/championship/presentation/originalCageVisualBindings.js';
import source from '../src/data/championship/catalogs/raising-ground.r1.json' with {type:'json'};
const defs=listCageDefinitions(),slots=Array.from({length:100},(_,i)=>i),out={};
for(const d of [6,7,31]) {
 const waiting={moduleId:defs[35].moduleId,slotIndex:0,instanceId:'cage:waiting'};
 const a={moduleId:defs[d].moduleId,slotIndex:54,instanceId:'cage:a'};
 const origin=productFieldTileOrigin(54,ORIGINAL_CAGE_DEFINITION_SHAPES[d]);
 const points=new Map();let edges=0;
 for(let other=0;other<35;other++)if(sameRanchTerrain(a.moduleId,defs[other].moduleId))for(const slotIndex of slots){
  const placements=[waiting,a,{moduleId:defs[other].moduleId,slotIndex,instanceId:'cage:b'}];
  if(!validateProductRanch(placements,slots))continue;
  const ground=composeProductRanchGround({layoutVersion:PRODUCT_RANCH_GRID,placements,unlockedSlots:slots});
  for(const c of ground.navigation.connections.filter(c=>c.left===1&&c.right===2)){
   edges++;
   for(const i of c.cells){const p=[(i%ground.width)*8+4-origin.tileX*8,Math.floor(i/ground.width)*8+4-origin.tileY*8];points.set(p.join(','),p);}
  }
 }
 if(!edges)throw Error('NO_PORTALS:'+d);
 // An opening must reach the interior, not stop in a narrow pocket behind
 // a continuous rock row. Reserve paths to an existing native safe hub.
 const f=source.fields.find(f=>f.definitionIndex===d),cells=f.runs.flatMap(([n,...v])=>Array.from({length:n},()=>v));
 const valid=i=>i>=0&&i<cells.length&&cells[i][0]&&cells[i][1]!==1;
 const hubs=cells.map((c,i)=>({i,c})).filter(({c})=>c[0]&&c[1]!==1&&c[2]>1)
   .sort((a,b)=>b.c[2]-a.c[2]||Math.abs(a.i%f.width-f.width/2)-Math.abs(b.i%f.width-f.width/2));
 const visited=new Map(),queue=[];
 for(const {i:hub} of hubs){
   if(visited.has(hub))continue;
   queue.length=0;queue.push(hub);visited.set(hub,-1);
   for(let n=0;n<queue.length;n++){
     const i=queue[n];
     for(const j of [i-f.width,i+f.width,...(i%f.width?[i-1]:[]),...(i%f.width<f.width-1?[i+1]:[])])
       if(valid(j)&&!visited.has(j)){visited.set(j,i);queue.push(j);}
   }
 }
 for(const [x,y] of [...points.values()]){
   const sx=Math.floor(x/8),sy=Math.floor(y/8);if(sx<0||sx>=f.width||sy<0||sy>=f.height)continue;
   let i=sy*f.width+sx;if(!visited.has(i))continue;
   while(i!==-1){const p=[i%f.width*8+4,Math.floor(i/f.width)*8+4];points.set(p.join(','),p);i=visited.get(i);}
 }
 out[getOriginalCageVisualBinding(d).fieldId]={definitionIndex:d,edges,points:[...points.values()]};
}
fs.writeFileSync(process.argv[2],JSON.stringify(out,null,2));
console.log(Object.fromEntries(Object.entries(out).map(([k,v])=>[k,{edges:v.edges,points:v.points.length}])));

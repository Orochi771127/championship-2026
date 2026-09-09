// Gameplay geometry only. No render assets or research payloads. The source
// contains the numeric fields consumed by ARM9 ranch copy/query/spawn calls.
import source from "../../data/championship/catalogs/raising-ground.r1.json" with {type:"json"};
import {originalRanchFieldTileOrigin,ORIGINAL_CAGE_DEFINITION_SHAPES} from "../cage/ranchSlotGeometry.js";
import {getCageDefinitionByModuleId} from "../cage/cageCatalog.js";
import {nativePlacementMask,validateNativeRanch,NATIVE_RANCH_LAYOUT} from "../cage/nativeRanchLayout.js";

const fields=source.fields.map(field=>{
  const cells=field.runs.flatMap(([count,...v])=>Array.from({length:count},()=>v));
  const clearance=field.clearanceRuns.flatMap(([count,v])=>Array(count).fill(v));
  if(cells.length!==field.width*field.height || clearance.length!==cells.length)throw new Error("INVALID_RAISING_GROUND_SOURCE");
  return {...field,cells,clearance};
});
export const nativeRaisingHeadings=source.headings;
export function nativeCageOrigin(definitionIndex,slotIndex) {
  const p=originalRanchFieldTileOrigin(slotIndex,ORIGINAL_CAGE_DEFINITION_SHAPES[definitionIndex]);
  return [p.tileX*8, p.tileY*8-(slotIndex%2===0?24:0),0]; // 020502D8
}
export function createNativeRaisingGround(frame) {
  if(frame?.layoutVersion!==NATIVE_RANCH_LAYOUT)return null;
  if(![14,16,18,20].includes(frame.unlockedCount)||!validateNativeRanch(frame.placements,frame.unlockedCount))throw new Error("INVALID_RAISING_NATIVE_RANCH");
  const width=frame.unlockedCount*6,height=24,size=width*height;
  const terrain=new Uint8Array(size).fill(1),clearance=new Uint8Array(size),owners=new Int16Array(size).fill(-1);
  const placements=frame.placements.map(p=>({...p,definitionIndex:getCageDefinitionByModuleId(p.moduleId).cageDefinitionIndex}));
  const occupied=placements.reduce((n,p)=>n|nativePlacementMask(p,frame.unlockedCount),0);
  const steps=[...placements,...Array.from({length:frame.unlockedCount},(_,slotIndex)=>slotIndex)
    .filter(slot=>!(occupied&(1<<slot))).map(slotIndex=>({definitionIndex:36,slotIndex}))];
  for(const p of steps) {
    const f=fields[p.definitionIndex],row=p.slotIndex%2,col=Math.floor(p.slotIndex/2);
    const x=p.definitionIndex===36 ? col*12+row*6 : originalRanchFieldTileOrigin(p.slotIndex,ORIGINAL_CAGE_DEFINITION_SHAPES[p.definitionIndex]).tileX;
    const y=row*8,crop=row===0?3:0;
    for(let sy=crop;sy<f.height;sy++)for(let sx=0;sx<f.width;sx++) {
      const i=(y+sy-crop)*width+((x+sx)%width),[owner,type,distance]=f.cells[sy*f.width+sx];
      if(i>=size)throw new Error("RAISING_NATIVE_GROUND_BOUNDS");
      if(owner){owners[i]=p.definitionIndex;terrain[i]=type;}
      if(distance)clearance[i]=distance;
    }
  }
  const map=new Map(placements.map(p=>[p.definitionIndex,p]));
  const read=(values,x,y,fallback)=>x<0||y<0||x>=width||y>=height ? fallback : values[y*width+x];
  const wrap=(n,size)=>((n%size)+size)%size;
  return Object.freeze({width,height,pixelWidth:width*8,placements,terrain,clearance,owners,
    // Raising sets terrain query mode 1 (0207C9E8), wrapping both indices;
    // the separate clearance query 0207CC24 remains bounded.
    readTerrain:(x,y)=>terrain[wrap(y,height)*width+wrap(x,width)],readClearance:(x,y)=>read(clearance,x,y,0),
    cageAt(x,y){if(!Number.isFinite(x)||!Number.isFinite(y)||y<0||y>=192)return null;
      const tx=Math.trunc((((Math.trunc(x)%(width*8))+width*8)%(width*8))/8),ty=Math.trunc(y/8);
      return map.get(read(owners,tx,ty,-1))??null;},
    placement:definition=>map.get(definition)??null,
    origin:definition=>{const p=map.get(definition);return p?nativeCageOrigin(definition,p.slotIndex):null;}
  });
}

// Complete 020500BC source-clearance sampler. Rejected candidates consume the
// second channel-1 draw too. The guard only protects malformed external RNG.
export function nativeRaisingSpawnPosition(ground,definition,rng) {
  const p=ground.placement(definition),f=fields[definition];
  if(!p||!f||typeof rng?.next!=="function")throw new TypeError("NATIVE_RAISING_SPAWN_CONTEXT_REQUIRED");
  const origin=originalRanchFieldTileOrigin(p.slotIndex,ORIGINAL_CAGE_DEFINITION_SHAPES[definition]);
  const max=f.width*f.height-1;
  let threshold=[0,15,23,27,29,30,31,32,33,34].includes(definition)?1:2,rejections=0;
  for(let guard=0;guard<100000;guard++) {
    const index=Math.trunc(max*rng.next(1)/102);
    if(f.clearance[index]>threshold && (p.slotIndex%2!==0 || index>f.width*3))
      return [(index%f.width+origin.tileX)*8*4096+16384,(Math.floor(index/f.width)+origin.tileY)*8*4096+16384,0];
    rng.next(1);if(++rejections>max){rejections=0;if(threshold>0)threshold--;}
  }
  throw new Error("NATIVE_RAISING_SPAWN_RNG_EXHAUSTED");
}

// Complete 02112408 search order, including the RNG-based fallback row after
// the first 30 tiles. It returns tile coordinates, not their centre.
export function findNativeRaisingOpenTile(ground,x,y,{centralBand=false,rng,poolSlot=0}={}) {
  let radius=0,extra=0,limit=30;
  const allowed=(tx,ty)=>ground.readTerrain(tx,ty)!==1&&(!centralBand||(ty>=3&&ty<=18));
  for(let guard=0;guard<100000;guard++) {
    const down=y+radius,up=y-radius,left=x-radius;
    const candidates=[[x+radius,y],[left,y],
      ...(down<ground.height?[[x,down]]:[]),...(up>0?[[x,up]]:[]),
      ...(down<ground.height?[[x+radius+extra,down]]:[]),...(up>0?[[x+radius+extra,up]]:[]),
      ...(left>0&&down<ground.height?[[left-extra,down]]:[]),...(left>0&&up>0?[[left-extra,up]]:[])];
    for(const [tx,ty] of candidates)if(allowed(tx,ty))return {x:tx,y:ty,distance:radius};
    if(++radius>limit) {
      if(typeof rng?.next!=="function")throw new TypeError("RAISING_OPEN_TILE_RNG_REQUIRED");
      radius=1;limit=ground.width;extra=1;y=Math.trunc(32766*rng.next(0x26+poolSlot)/102)%15+3;
    }
  }
  throw new Error("RAISING_OPEN_TILE_SEARCH_EXHAUSTED");
}

export function nativeRaisingEntryPosition(ground,definition,rng,poolSlot) {
  const position=nativeRaisingSpawnPosition(ground,definition,rng);
  const x=Math.trunc((position[0]>>12)/8),y=Math.trunc((position[1]>>12)/8);
  if(ground.readTerrain(x,y)!==1)return position;
  const tile=findNativeRaisingOpenTile(ground,x,y,{centralBand:true,rng,poolSlot});
  return tile.distance>0?[tile.x*32768,tile.y*32768,position[2]]:position;
}

// Exhaustive bounded layout audit: every movable definition in its fixed direction,
// every same-type / explicit large-small partner and legal adjacent placement.
import fs from 'node:fs';
import path from 'node:path';
import {listCageDefinitions} from '../src/championship/cage/cageCatalog.js';
import {PRODUCT_RANCH_GRID,productGridSlot,productPlacementCells,validateProductRanch,productFieldTileOrigin} from '../src/championship/cage/productRanchGrid.js';
import {ORIGINAL_CAGE_DEFINITION_SHAPES} from '../src/championship/cage/ranchSlotGeometry.js';
import {ranchSharedBoundaries,sameRanchTerrain} from '../src/championship/cage/ranchConnections.js';
import {composeProductRanchGround} from '../src/championship/raising/nativeRaisingRanchRing.js';
import {applyRaisingGroundReview} from '../src/championship/raising/raisingGroundReview.js';
import {getOriginalCageVisualBinding} from '../src/championship/presentation/originalCageVisualBindings.js';
import {cageName} from '../src/championship/text/zhHant.js';
import review from '../src/data/championship/catalogs/raising-ground.review-20261019.json' with {type:'json'};
import source from '../src/data/championship/catalogs/raising-ground.r1.json' with {type:'json'};
import sports from '../src/data/championship/catalogs/ranch-sports-art.r1.json' with {type:'json'};
applyRaisingGroundReview(review);
const defs=listCageDefinitions(),unlockedSlots=Array.from({length:100},(_,i)=>i);
const waiting={moduleId:defs[35].moduleId,slotIndex:0,instanceId:'cage:waiting',ownerIndex:0};
const output=path.resolve(process.argv[2]??'artifacts/ranch-audit');
fs.mkdirSync(output,{recursive:true});
const records=[],failures=[];let combinations=0,open=0,closed=0;
const fields=new Map([...source.fields,...review.fields].map(f=>[f.definitionIndex,{...f,cells:f.runs.flatMap(([n,...v])=>Array.from({length:n},()=>v))}]));
for(let d=0;d<35;d++){
  const rotation=0;
  const a={moduleId:defs[d].moduleId,slotIndex:productGridSlot(5,4),rotation,instanceId:'cage:a',ownerIndex:1};
  const own=productPlacementCells(a),origin=productFieldTileOrigin(a.slotIndex,ORIGINAL_CAGE_DEFINITION_SHAPES[d]);
  const isolated=composeProductRanchGround({layoutVersion:PRODUCT_RANCH_GRID,placements:[waiting,a],unlockedSlots});
  const field=fields.get(d);let walkable=0,blocked=0,escaped=0,obstacleMismatches=0;
  for(let i=0;i<isolated.owners.length;i++)if(isolated.owners[i]===1){
    const x=(i%isolated.width)*8+4-origin.tileX*8,y=Math.floor(i/isolated.width)*8+4-origin.tileY*8;
    if(isolated.terrain[i]===1)blocked++;else walkable++;
    const tx=Math.floor(x/8),ty=Math.floor(y/8);
    if(field.cells[ty*field.width+tx]?.[1]===1&&isolated.terrain[i]!==1)obstacleMismatches++;
  }
  if(!walkable||escaped||obstacleMismatches)failures.push({d,rotation,walkable,escaped,obstacleMismatches});
  const record={definition:d,name:cageName(d,defs[d].displayName),fieldId:getOriginalCageVisualBinding(d).fieldId,
    rotation,cells:own.length,walkable,blocked,escaped,obstacleMismatches,adjacentLayouts:0,connectedLayouts:0,
    openEdges:0,closedEdges:0,examples:[],closedExamples:[]};
  for(let other=0;other<35;other++)if(sameRanchTerrain(defs[d].moduleId,defs[other].moduleId))
    for(let slotIndex=0;slotIndex<100;slotIndex++){
      const r2=0;
      const b={moduleId:defs[other].moduleId,slotIndex,rotation:r2,instanceId:'cage:b',ownerIndex:2};
      const placements=[waiting,a,b];
      if(!validateProductRanch(placements))continue;
      const edges=ranchSharedBoundaries(placements).filter(e=>e.left===1&&e.right===2);
      if(!edges.length)continue;
      const ground=composeProductRanchGround({layoutVersion:PRODUCT_RANCH_GRID,placements,unlockedSlots});
      const pairs=ground.navigation.boundaries.filter(e=>e.left===1&&e.right===2);
      const paths=ground.navigation.connections.filter(e=>e.left===1&&e.right===2);
      record.adjacentLayouts++;combinations++;
      record.openEdges+=paths.length;record.closedEdges+=pairs.length-paths.length;open+=paths.length;closed+=pairs.length-paths.length;
      if(paths.length){
        record.connectedLayouts++;
        if(record.examples.length<3)record.examples.push({other,rotation:r2,slotIndex,route:paths[0].route});
        for(const c of paths)for(const [x,y] of c.route)if(ground.readTerrain(Math.floor(x/8),Math.floor(y/8))===1)
          failures.push({d,rotation,other,r2,slotIndex,error:'PATH_THROUGH_OBSTACLE'});
      }else if(record.closedExamples.length<3)record.closedExamples.push({other,rotation:r2,slotIndex,reason:pairs.map(p=>p.reason)});
    }
  records.push(record);
}
const report={schemaVersion:1,status:failures.length?'FAIL':'GEOMETRY_AND_NAVIGATION_CHECKED',
  scope:'Controlled data audit, not visual acceptance or physical-device QA',
  selectedSports:sports.fields.map(f=>({fieldId:f.fieldId,sha256:f.frames[0].sha256})),
  movableDefinitions:35,orientations:35,combinations,openEdges:open,closedEdges:closed,
  fixed:{definition:35,rotationEnabled:false,reason:'FIXED_WAITING_ROOM'},
  noConnection:records.filter(r=>!r.connectedLayouts).map(({definition,rotation,name})=>({definition,rotation,name})),
  failures,records};
fs.writeFileSync(path.join(output,'all-cages.json'),JSON.stringify(report,null,2));
const cols=['definition','name','fieldId','rotation','cells','walkable','blocked','escaped','obstacleMismatches','adjacentLayouts','connectedLayouts','openEdges','closedEdges'];
fs.writeFileSync(path.join(output,'all-cages.csv'),'\uFEFF'+[cols.join(','),...records.map(r=>cols.map(k=>JSON.stringify(r[k])).join(','))].join('\n'));
console.log(JSON.stringify({...report,records:undefined,selectedSports:undefined},null,2));
if(failures.length)process.exitCode=1;

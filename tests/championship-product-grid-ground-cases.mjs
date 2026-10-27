import test from 'node:test';
import assert from 'node:assert/strict';
import {createRanchRaisingGround,ranchRaisingSpawnPosition,findRanchRaisingOpenTile} from '../src/championship/raising/nativeRaisingRanchRing.js';
import {productGridCell,productFieldTileOrigin,PRODUCT_RANCH_GRID,productPlacementCells,validateProductRanch,
  PRODUCT_RANCH_WORLD_WIDTH,PRODUCT_RANCH_WORLD_HEIGHT,PRODUCT_RANCH_SLOT_COUNT,legacyGrid100SlotToWorld as W} from '../src/championship/cage/productRanchGrid.js';
// Hex cage world (2026-10-26): a 10×10 layout lands 8 rows / 7 columns into the world.
const OFFSET_PX=[7*96,8*88];
import {listCageDefinitions} from '../src/championship/cage/cageCatalog.js';
import {WAITING_ROOM_MODULE} from '../src/championship/cage/nativeRanchLayout.js';
import {ORIGINAL_CAGE_DEFINITION_SHAPES} from '../src/championship/cage/ranchSlotGeometry.js';
import {nativeCarryPosition,stepNativeRaisingFlight} from '../src/championship/raising/nativeRaisingCarry.js';
import modelGround from '../src/data/championship/catalogs/ranch-three-ground.r1.json' with {type:'json'};
const waiting={moduleId:WAITING_ROOM_MODULE,slotIndex:W(0)};
const frame=(placements=[waiting],rows=[0,1,2,3,4,5,6,7,8,9])=>({layoutVersion:PRODUCT_RANCH_GRID,unlockedCount:20,placements,gridAccess:{version:1,legacyUnlockedSlots:Array.from({length:20},(_,i)=>i),purchasedRows:[],testUnlockedRows:rows}});
test('all legal facility anchors share terrain/art origin and spawn on their owning facility',()=>{
 let count=0;
 for(const d of listCageDefinitions())for(let slotIndex=0;slotIndex<PRODUCT_RANCH_SLOT_COUNT;slotIndex+=11){
  if(d.moduleId===WAITING_ROOM_MODULE)continue;
  const p={moduleId:d.moduleId,slotIndex};if(!validateProductRanch([waiting,p]))continue;
  const g=createRanchRaisingGround(frame([waiting,p]));
  assert.equal(g.pixelWidth,PRODUCT_RANCH_WORLD_WIDTH);assert.equal(g.pixelHeight,PRODUCT_RANCH_WORLD_HEIGHT);
  const o=productFieldTileOrigin(slotIndex,ORIGINAL_CAGE_DEFINITION_SHAPES[d.cageDefinitionIndex]);
  assert.deepEqual(g.origin(d.cageDefinitionIndex),[o.tileX*8,o.tileY*8,0]);
  const spawn=ranchRaisingSpawnPosition(g,d.cageDefinitionIndex,{next:()=>51});
  assert.equal(g.cageAt(spawn[0]/4096,spawn[1]/4096)?.definitionIndex,d.cageDefinitionIndex);
  assert.notEqual(g.readTerrain(Math.floor(spawn[0]/32768),Math.floor(spawn[1]/32768)),1);count++;
 }
 assert.ok(count>1000);
});
test('locked lower rows are not walkable; explicit test-row grant changes only access',()=>{
 const closed=createRanchRaisingGround(frame([waiting],[])),open=createRanchRaisingGround(frame());
 for(let slot=40;slot<50;slot++){
  const c=productGridCell(slot),x=(c.x+48)/8,y=(c.y+32)/8;
  assert.equal(closed.readTerrain(x,y),1);
 }
 assert.deepEqual(closed.placements,open.placements);
 assert.equal(closed.readTerrain(1,-1),1);assert.equal(open.readTerrain(1,110),1);
});
test('carry and landing retain lower-row coordinates instead of native150/160 clamps',()=>{
 const d=listCageDefinitions().find(d=>d.cageDefinitionIndex===0),g=createRanchRaisingGround(frame([waiting,{moduleId:d.moduleId,slotIndex:W(45)}]));
 const p=ranchRaisingSpawnPosition(g,0,{next:()=>51});
 assert.ok(p[1]/4096>300);
 assert.ok(nativeCarryPosition({x:p[0]/4096,y:360},30,g)[1]/4096>300);
 const result=stepNativeRaisingFlight({positionQ12:p,velocityQ12:[0,0,0]},g,{rng:{next:()=>51}});
 assert.ok(result.positionQ12[1]/4096>300);
 const nearest=findRanchRaisingOpenTile(g,Math.floor(p[0]/32768),Math.floor(p[1]/32768),{centralBand:true});assert.ok(nearest.y>30);
});
test('the world does not wrap: no horizontal copies, one owner, no placements created',()=>{
 const g=createRanchRaisingGround(frame()),p=ranchRaisingSpawnPosition(g,35,{next:()=>51});
 for(let lap=-4;lap<=4;lap++)assert.equal(g.cageAt(p[0]/4096+960*lap,p[1]/4096)?.definitionIndex,lap===0?35:undefined);
 assert.equal(g.placements.length,1);
});

test('native terrain outside owner-approved model contacts and facility-local saved coordinates are preserved',async()=>{
 const {createNativeRaisingGround}=await import('../src/championship/raising/nativeRaisingGround.js');
 const {NATIVE_RANCH_LAYOUT,originalStartingRanch}=await import('../src/championship/cage/nativeRanchLayout.js');
 const placements=originalStartingRanch().placements;
 const native=createNativeRaisingGround({layoutVersion:NATIVE_RANCH_LAYOUT,unlockedCount:20,placements});
 const product=createRanchRaisingGround(frame(placements.map(p=>({...p,slotIndex:W(p.slotIndex)})),[]));
 const tx=OFFSET_PX[0]/8,ty=OFFSET_PX[1]/8,at=i=>(Math.floor(i/native.width)+ty)*product.width+i%native.width+tx;
 // Owner 2026-10-21 expanded this adaptation to actual 3D cage models.
 // The original native layout remains intact; product cage contacts follow
 // the exported model catalogue, without changing local saved coordinates.
 const sports=new Set([1,27,...modelGround.fields.map(f=>f.definitionIndex)]);
 for(let i=0;i<native.terrain.length;i++){
  const x=i%native.width*8,y=Math.floor(i/native.width)*8;
  if(sports.has(native.cageAt(x,y)?.definitionIndex)||sports.has(product.cageAt(x+OFFSET_PX[0],y+OFFSET_PX[1])?.definitionIndex))continue;
  // The native board had unlocked empty lids; the hex world has void there.
  if(!native.cageAt(x,y))continue;
  assert.equal(product.terrain[at(i)],native.terrain[i],`unrelated cell ${i}`);
 }
 const unchanged=placements.filter(p=>!sports.has(listCageDefinitions().find(d=>d.moduleId===p.moduleId).cageDefinitionIndex));
 const unchangedProduct=createRanchRaisingGround(frame(unchanged.map(p=>({...p,slotIndex:W(p.slotIndex)})),[]));
 const unchangedNative=createNativeRaisingGround({layoutVersion:NATIVE_RANCH_LAYOUT,unlockedCount:20,placements:unchanged});
 for(let i=0;i<unchangedNative.terrain.length;i++)if(unchangedNative.cageAt(i%unchangedNative.width*8,Math.floor(i/unchangedNative.width)*8))
  assert.equal(unchangedProduct.terrain[at(i)],unchangedNative.terrain[i]);
 for(const p of product.placements)assert.deepEqual(product.origin(p.definitionIndex),native.origin(p.definitionIndex).map((v,i)=>v+(OFFSET_PX[i]??0)));
 const d=listCageDefinitions().find(d=>d.cageDefinitionIndex===0);
 const lower=createRanchRaisingGround(frame([waiting,{moduleId:d.moduleId,slotIndex:W(45)}]));
 const local=[32*4096,56*4096,0],origin=lower.origin(0);
 const restored=local.map((n,i)=>n+origin[i]*4096);
 assert.deepEqual(restored.map((n,i)=>n-origin[i]*4096),local);
 assert.equal(lower.cageAt(restored[0]/4096,restored[1]/4096)?.definitionIndex,0);
});

test('total-open count does not unlock native rank-gated columns',()=>{
 const f=frame([waiting],[2]);f.unlockedCount=24;f.mainUnlockedCount=14;f.gridAccess.legacyUnlockedSlots=Array.from({length:14},(_,i)=>i);
 const g=createRanchRaisingGround(f);
 for(const slot of [14,15,16,17,18,19,40,49]){const c=productGridCell(slot);assert.equal(g.readTerrain((c.x+48)/8,(c.y+32)/8),1);}
});

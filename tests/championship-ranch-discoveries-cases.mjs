import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {settleRanchDiscoveries,normalizeRanchDiscoveries,removeCollectedDiscoveries,RANCH_DISCOVERY_INTERVAL_MS as INTERVAL} from '../src/championship/raising/ranchDiscoveries.js';
import {ranchSharedBoundaries,connectRanchGround} from '../src/championship/cage/ranchConnections.js';
import {composeProductRanchGround} from '../src/championship/raising/nativeRaisingRanchRing.js';
import {PRODUCT_RANCH_GRID,productGridSlot,productPlacementCells} from '../src/championship/cage/productRanchGrid.js';
import {listCageDefinitions} from '../src/championship/cage/cageCatalog.js';
import {beginRanchExplorationWalk,advanceRanchExplorationWalk} from '../src/championship/raising/ranchExplorationWalk.js';
import {stepNativeRaisingMovement,nativeRaisingMovementArrived} from '../src/championship/raising/nativeRaisingMovement.js';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {FRIENDS_PLAYTEST_POLICY} from '../src/championship/app/friendsPlaytestPolicy.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY,deserializeChampionshipModernSave} from '../src/championship/app/championshipStandaloneSave.js';
const defs=listCageDefinitions(),moduleOf=i=>defs[i].moduleId;
const read=f=>JSON.parse(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'));
const participant=[{id:'partner:one',cageId:'cage:one'}],epoch=Date.parse('2026-10-21T00:00:00Z');
function ground(entries=[[0,10],[0,12],[0,11]]){
  return composeProductRanchGround({layoutVersion:PRODUCT_RANCH_GRID,unlockedSlots:Array.from({length:100},(_,i)=>i),
    placements:[[35,0],...entries].map(([definition,slotIndex],i)=>({moduleId:moduleOf(definition),slotIndex,instanceId:`cage:test:${i}`}))});
}
test('six actual hex sides, same type/height, and no opposite-board edge connection',()=>{
  const center={moduleId:moduleOf(0),slotIndex:productGridSlot(4,4),ownerIndex:0};
  const cells=[[4,3],[4,5],[3,3],[3,4],[5,3],[5,4]];
  const placements=[center,...cells.map(([r,c],i)=>({moduleId:moduleOf(0),slotIndex:productGridSlot(r,c),ownerIndex:i+1}))];
  const edges=ranchSharedBoundaries(placements).filter(e=>e.left===0||e.right===0);
  assert.equal(edges.length,6);assert.ok(edges.every(e=>e.compatible));
  placements[1].groundHeight=1;assert.ok(ranchSharedBoundaries(placements).some(e=>e.reason==='DIFFERENT_HEIGHT'));
  placements[2].moduleId=moduleOf(15);assert.ok(ranchSharedBoundaries(placements).some(e=>e.reason==='DIFFERENT_TYPE'));
  assert.equal(ranchSharedBoundaries([{...center,slotIndex:productGridSlot(4,0)},{...center,ownerIndex:1,slotIndex:productGridSlot(4,9)}]).length,0);
});
test('real meadow copies gain safe horizontal/diagonal passages and reachable paths',()=>{
  const g=ground();assert.equal(g.navigation.connections.length,2);
  assert.equal(g.navigation.boundaries.filter(e=>e.reason==='NO_SAFE_EXIT').length,1);
  const route=g.navigation.plan([540,20],2,3);assert.ok(route?.length);
  for(const [x,y] of route)assert.notEqual(g.readTerrain(Math.floor(x/8),Math.floor(y/8)),1);
  assert.equal(g.navigation.plan([540,20],0),null,'waiting room is not a same-type neighbour');
  assert.equal(ground([[0,10],[0,16]]).navigation.connections.length,0,'separated copies never connect');
});
test('connection construction never erases an owned wall or crosses an unrelated owner',()=>{
  const original=ground(),terrain=new Uint8Array(original.terrain),clearance=new Uint8Array(original.clearance),owners=new Int16Array(original.owners);
  // Seal both endpoint rows with owned obstacles.
  for(let y=0;y<9;y++)for(let x=68;x<=73;x++){const i=y*original.width+x;owners[i]=1;terrain[i]=1;}
  const before=new Uint8Array(terrain),g=connectRanchGround({...original,terrain,clearance,owners});
  for(let i=0;i<before.length;i++)if(owners[i]>=0)assert.equal(g.terrain[i],before[i],`owned cell ${i}`);
  assert.ok(g.navigation.boundaries.some(b=>b.reason==='NO_SAFE_EXIT'));
});
test('a resident walks a real crossing through the original movement step and retains home',()=>{
  const g=ground([[0,10],[0,12]]);
  const actor={speciesIndex:34,cageDefinitionIndex:0,cageInstanceId:'cage:test:1',poolSlot:0,
    state:2,mode:0,ticks:0,threshold:0,angleQ12:0,desiredAngleQ12:0,slow:0,
    foodSlot:null,positionQ12:[540*4096,20*4096,0],destinationQ12:[540*4096,20*4096,0]};
  assert.equal(beginRanchExplorationWalk(actor,g),true);
  const positions=[];let done=false;
  for(let i=0;i<1800;i++){
    Object.assign(actor,stepNativeRaisingMovement({...actor,fast:0,hasFood:false},g));
    positions.push(actor.positionQ12.map(v=>v/4096));
    assert.notEqual(g.readTerrain(Math.floor(actor.positionQ12[0]/32768),Math.floor(actor.positionQ12[1]/32768)),1);
    if(!advanceRanchExplorationWalk(actor,g)&&nativeRaisingMovementArrived(actor)){done=true;break;}
  }
  assert.equal(done,true);assert.ok(positions.some(p=>p[0]>584));
  assert.equal(g.navigation.ownerAt(positions.at(-1)).ownerIndex,2);
  assert.equal(actor.cageInstanceId,'cage:test:1');
  assert.equal(beginRanchExplorationWalk(actor,g),true);actor.foodSlot=1;
  assert.equal(advanceRanchExplorationWalk(actor,g),false);assert.equal(actor.explorationRoute,undefined);
});
test('100 occupied hex capacity builds once; repeated reads do not search or mutate',()=>{
  const placements=[{moduleId:moduleOf(35),slotIndex:0,instanceId:'cage:waiting'}];
  const used=new Set(productPlacementCells(placements[0]));
  for(let slot=0;slot<100;slot++)if(!used.has(slot))placements.push({moduleId:moduleOf(0),slotIndex:slot,instanceId:`cage:land:${slot}`});
  const start=performance.now(),g=composeProductRanchGround({layoutVersion:PRODUCT_RANCH_GRID,placements,unlockedSlots:Array.from({length:100},(_,i)=>i)});
  assert.ok(performance.now()-start<3000);assert.ok(g.navigation.connections.length>100);
  const before=Buffer.from(g.terrain);for(let i=0;i<100;i++)g.navigation.ownerAt([500,400]);
  assert.deepEqual(Buffer.from(g.terrain),before);
});
test('same online/offline rate; one or sixteen partners; 24-hour cap; no expiry',()=>{
  const one=settleRanchDiscoveries(null,epoch,participant);
  const many=settleRanchDiscoveries(null,epoch,Array.from({length:16},(_,i)=>({id:`partner:${i}`,cageId:`cage:${i}`})));
  const offline=settleRanchDiscoveries(one,epoch+INTERVAL*12,participant);
  let online=one;for(let i=1;i<=24;i++)online=settleRanchDiscoveries(online,epoch+i*INTERVAL/2,participant);
  assert.deepEqual(online.pending,offline.pending);assert.equal(offline.pending.length,12);
  assert.equal(settleRanchDiscoveries(many,epoch+INTERVAL*12,many.participants).pending.length,12);
  const later=settleRanchDiscoveries(offline,epoch+INTERVAL*240,participant);
  assert.deepEqual(later.pending,offline.pending);assert.equal(later.carryMs,0);
  const collected=removeCollectedDiscoveries(later,later.pending.map(p=>p.id));
  assert.equal(settleRanchDiscoveries(collected,epoch+INTERVAL*240,participant).pending.length,0,'no banked overflow');
});
test('clock rollback, no participants, partial claims and malformed saves',()=>{
  const initial=settleRanchDiscoveries(null,epoch,participant),full=settleRanchDiscoveries(initial,epoch+INTERVAL*6,participant);
  assert.equal(full.pending.at(-1).kind,'rare');
  const rollback=settleRanchDiscoveries(full,epoch,participant);assert.deepEqual(rollback.pending,full.pending);assert.equal(rollback.lastAt,full.lastAt);
  const partial=removeCollectedDiscoveries(full,[2,3]);assert.equal(partial.pending.length,4);assert.equal(partial.collected,2);
  assert.deepEqual(normalizeRanchDiscoveries(JSON.parse(JSON.stringify(partial))),partial);
  assert.throws(()=>normalizeRanchDiscoveries({...full,pending:[full.pending[0],full.pending[0]]}));
  assert.throws(()=>normalizeRanchDiscoveries({...full,carryMs:-1}));
  assert.equal(settleRanchDiscoveries(settleRanchDiscoveries(null,epoch,[]),epoch+INTERVAL*24,[]).pending.length,0);
});
async function appHarness({full=false}={}){
  let time=epoch,blocked=false;
  const seed=read('qa/championship-full-qa-save.json');
  seed.shop.bits=full?9999999:1000;
  for(const i of [0,1,2])seed.shop.quantities[i]=full?99:0;
  const data=new Map([[CHAMPIONSHIP_MODERN_SAVE_KEY,JSON.stringify(seed)]]);
  const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>{if(blocked)throw Error('QA_QUOTA');data.set(k,String(v));},removeItem:k=>data.delete(k)};
  const create=()=>createChampionshipStandaloneApp({storage,locks:null,now:()=>new Date(time).toISOString(),playtestPolicy:FRIENDS_PLAYTEST_POLICY,
    catalog:read('src/data/championship/catalogs/creature-species.r1.json'),cages:read('docs/contracts/championship/raising-home-presentation.v1.json').cages});
  const app=create();await app.continueGame();
  return {app,create,data,time:n=>{time=n;},block:v=>{blocked=v;}};
}
test('real app accrues, atomically claims into existing inventory, reloads without duplication',async()=>{
  const h=await appHarness();let a=h.app;
  try{
    assert.ok(a.getRanchExplorationFrame().active);a.save();h.time(epoch+INTERVAL*6);a.refreshRanchDiscoveries();
    assert.equal(a.getRanchExplorationFrame().pending.length,6);
    const before=a.getShopFrame().bits,result=a.collectRanchDiscoveries();
    assert.equal(result.ok,true);assert.equal(result.collected,6);assert.equal(a.getShopFrame().bits,before+40);
    assert.equal(a.collectRanchDiscoveries().reason,'EMPTY');
    const saved=deserializeChampionshipModernSave(h.data.get(CHAMPIONSHIP_MODERN_SAVE_KEY));
    assert.equal(saved.shop.quantities[0],4);assert.equal(saved.shop.quantities[1],1);assert.equal(saved.shop.quantities[2],1);
    await a.dispose();a=h.create();await a.continueGame();assert.equal(a.getRanchExplorationFrame().pending.length,0);
    assert.equal(a.getShopFrame().bits,before+40);
  }finally{await a.dispose();}
});
test('failed durable claim preserves wallet, inventory and pending; retry is exactly once',async()=>{
  const h=await appHarness(),a=h.app;
  try{
    h.time(epoch+INTERVAL*2);a.refreshRanchDiscoveries();const before=JSON.stringify(a.getShopFrame());
    h.block(true);assert.equal(a.collectRanchDiscoveries().reason,'SAVE_FAILED');
    assert.equal(JSON.stringify(a.getShopFrame()),before);assert.equal(a.getRanchExplorationFrame().pending.length,2);
    h.block(false);assert.equal(a.collectRanchDiscoveries().ok,true);assert.equal(a.collectRanchDiscoveries().reason,'EMPTY');
  }finally{await a.dispose();}
});
test('full inventory and wallet preserve all discoveries through reload',async()=>{
  const h=await appHarness({full:true});let a=h.app;
  try{
    h.time(epoch+INTERVAL*6);a.refreshRanchDiscoveries();
    const before=JSON.stringify(a.getShopFrame());
    assert.equal(a.collectRanchDiscoveries().reason,'INVENTORY_FULL');
    assert.equal(JSON.stringify(a.getShopFrame()),before);
    assert.equal(a.getRanchExplorationFrame().pending.length,6);
    a.save();await a.dispose();a=h.create();await a.continueGame();
    assert.equal(a.getRanchExplorationFrame().pending.length,6);
    assert.equal(a.collectRanchDiscoveries().reason,'INVENTORY_FULL');
  }finally{await a.dispose();}
});

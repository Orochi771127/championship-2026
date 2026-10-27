import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {FRIENDS_PLAYTEST_POLICY,normalizeFriendsPlaytestState} from '../src/championship/app/friendsPlaytestPolicy.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY,deserializeChampionshipModernSave,serializeChampionshipModernSave} from '../src/championship/app/championshipStandaloneSave.js';
import {createShopRuntime} from '../src/championship/shop/shopRuntime.js';
import {createCageEditRuntime} from '../src/championship/cage/cageEditRuntime.js';
import {listCageDefinitions} from '../src/championship/cage/cageCatalog.js';
import {PRODUCT_RANCH_GRID,LEGACY_PRODUCT_RANCH_GRID,productGridCell,productGridSlot,productPlacementCells,validateProductRanch,
  productRanchProblem,legacyGrid100Cell,legacyGrid100Slot,legacyGrid100SlotToWorld as W} from '../src/championship/cage/productRanchGrid.js';
import {createRanchRaisingGround,ranchRaisingSpawnPosition} from '../src/championship/raising/nativeRaisingRanchRing.js';
import {findNativeRaisingFood,createNativeRaisingFood,reconcileNativeFoodReservations} from '../src/championship/raising/nativeRaisingFood.js';
import {cageEditorArtCells} from '../src/championship/presentation/cageUiArt.js';
const read=f=>JSON.parse(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'));
const defs=listCageDefinitions(),moduleOf=i=>defs[i].moduleId;
function harness({legacy=false}={}){
  const data=new Map();let blocked=false;
  const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>{if(blocked)throw Error('QA_QUOTA');data.set(k,String(v));},removeItem:k=>data.delete(k)};
  const create=(extra={})=>createChampionshipStandaloneApp({storage,locks:null,playtestPolicy:legacy?null:FRIENDS_PLAYTEST_POLICY,
    catalog:read('src/data/championship/catalogs/creature-species.r1.json'),cages:read('docs/contracts/championship/raising-home-presentation.v1.json').cages,...extra});
  return {data,create,block:v=>blocked=v};
}
function fullEditor(){
  const shop=createShopRuntime({bits:8000000,allowRepeatedCages:true,allItemsVisible:true});
  shop.buy(defs[0].shopRecordIndex,4);
  const editor=createCageEditRuntime({initializeOriginal:true,publicTestGrid:true});
  for(let row=2;row<10;row++)editor.applyTestRowPurchase(row,shop.toSave(),0);
  return {editor,shop};
}
// Hex cage world (2026-10-26): the 10×10 board is legacy geometry; saves migrate into the world.
test('100 total cells, 10 per row; original first50 IDs/positions retained, slot100 rejected',()=>{
  const seen=new Set();for(let i=0;i<100;i++){const c=legacyGrid100Cell(i);assert.equal(legacyGrid100Slot(c.row,c.column),i);seen.add(`${c.row},${c.column}`);}
  assert.equal(seen.size,100);assert.equal(legacyGrid100Slot(10,0),null);assert.throws(()=>legacyGrid100Cell(100));
  assert.deepEqual(legacyGrid100Cell(49),{slotIndex:49,row:4,column:9,x:864,y:352});
  assert.deepEqual(legacyGrid100Cell(99),{slotIndex:99,row:9,column:9,x:912,y:792});
  assert.throws(()=>productGridCell(576));
});
test('new public save has funds,20 open cells; buy8 rows once to100 with unchanged row price',async()=>{
  const h=harness(),a=h.create();try{
    await a.newGame();assert.equal(a.getShopFrame().bits,8000000);assert.equal(a.getCageEditFrame().testDiamonds,20000);
    a.openCageEdit();assert.equal(a.getCageEditFrame().unlockedCount,20);assert.equal(a.getCageEditFrame().productGrid.cellCap,100);
    for(let row=2;row<10;row++){assert.equal(a.buyRanchTestRow(row).ok,true);assert.equal(a.buyRanchTestRow(row).ok,false);}
    assert.equal(a.getCageEditFrame().unlockedCount,100);assert.equal(a.getCageEditFrame().testDiamonds,12000);
    assert.equal(a.buyRanchTestRow(10).ok,false);assert.equal(a.getShopFrame().bits,8000000);
  }finally{await a.dispose();}
});
test('repeated cage purchases add exact stock and debit original unit price; reload retains both',async()=>{
  const h=harness();let a=h.create();try{
    await a.newGame();a.openShop();const row=a.getShopFrame().listings.find(r=>r.category==='CAGES'&&r.unitPriceBits>0&&r.owned===0);
    assert.equal(a.buyShopItem(row.shopRecordIndex,2).ok,true);assert.equal(a.buyShopItem(row.shopRecordIndex).ok,true);
    assert.equal(a.getShopFrame().bits,8000000-row.unitPriceBits*3);assert.equal(a.getShopFrame().listings.find(r=>r.shopRecordIndex===row.shopRecordIndex).owned,3);
    const saved=JSON.parse(h.data.get(CHAMPIONSHIP_MODERN_SAVE_KEY));assert.equal(saved.schemaVersion,7);assert.equal(saved.shop.cageQuantities[row.shopRecordIndex],3);
    await a.dispose();a=h.create();await a.continueGame();assert.equal(a.getShopFrame().bits,saved.shop.bits);assert.equal(a.getShopFrame().listings.find(r=>r.shopRecordIndex===row.shopRecordIndex).owned,3);
  }finally{await a.dispose();}
});
test('insufficient funds, invalid quantity and maximum stock do not deduct',()=>{
  const poor=createShopRuntime({allowRepeatedCages:true,allItemsVisible:true,bits:1});
  const row=poor.getFrame().listings.find(r=>r.category==='CAGES'&&r.unitPriceBits>1);
  const before=poor.toSave();assert.equal(poor.buy(row.shopRecordIndex).reason,'INSUFFICIENT_FUNDS');assert.deepEqual(poor.toSave(),before);
  assert.equal(poor.buy(row.shopRecordIndex,0).reason,'INVALID_QUANTITY');
  const rich=createShopRuntime({allowRepeatedCages:true,allItemsVisible:true,bits:8000000});
  const free=defs[0].shopRecordIndex;assert.equal(rich.buy(free,99).ok,true);const snapshot=rich.toSave();
  assert.equal(rich.buy(free).reason,'MAX_OWNED');assert.deepEqual(rich.toSave(),snapshot);
});
test('durable purchase failure rolls back funds,stock and retry; no hidden later purchase',async()=>{
  const h=harness(),a=h.create();try{
    await a.newGame();a.save();a.openShop();const row=a.getShopFrame().listings.find(r=>r.category==='CAGES'&&r.unitPriceBits>0);
    const before=JSON.stringify({bits:a.getShopFrame().bits,listings:a.getShopFrame().listings}),stored=h.data.get(CHAMPIONSHIP_MODERN_SAVE_KEY);h.block(true);
    assert.equal(a.buyShopItem(row.shopRecordIndex,2).reason,'SAVE_FAILED');assert.equal(JSON.stringify({bits:a.getShopFrame().bits,listings:a.getShopFrame().listings}),before);
    h.block(false);a.savePort.retry();assert.equal(h.data.get(CHAMPIONSHIP_MODERN_SAVE_KEY),stored);
    assert.equal(a.buyShopItem(row.shopRecordIndex,2).ok,true);
  }finally{await a.dispose();}
});
test('copies have distinct placement IDs; overlap, locked land,unowned extra copy rejected',()=>{
  const {editor:e,shop}=fullEditor(),stock=shop.toSave();e.selectModule(moduleOf(0),stock,0);
  let f=e.placeAt(W(10),stock,0);assert.equal(f.lastVerdict.reason,'PLACED');e.selectModule(moduleOf(0),stock,0);f=e.placeAt(W(99),stock,0);assert.equal(f.lastVerdict.reason,'PLACED');
  const copies=f.placements.filter(p=>p.moduleId===moduleOf(0));assert.equal(copies.length,3);assert.equal(new Set(copies.map(p=>p.instanceId)).size,3);
  e.selectModule(moduleOf(0),stock,0);assert.equal(e.placeAt(W(10),stock,0).lastVerdict.reason,'OCCUPIED');
  assert.equal(e.placeAt(576,stock,0).lastVerdict.reason,'OUT_OF_BOUNDS');
  const locked=createCageEditRuntime({initializeOriginal:true,publicTestGrid:true});locked.selectModule(moduleOf(0),stock,0);
  // Land is a cell capacity: a layout that would exceed it is refused for land, never for position.
  assert.equal(productRanchProblem([...locked.toSave().placements,{moduleId:moduleOf(0),slotIndex:W(99),instanceId:'cage:instance:extra'}],9),'LAND_CAPACITY');
  const original=locked.getFrame(stock,0).placements.find(p=>p.moduleId===moduleOf(15));locked.selectModule(moduleOf(15),stock,0);assert.equal(locked.placeAt(10,stock,0).lastVerdict.reason,'ALREADY_PLACED');assert.ok(original);
});
test('moving selected copy retains ID; withdrawing frees one stock; revert and reload do not duplicate',()=>{
  const {editor:e,shop}=fullEditor(),stock=shop.toSave();e.selectModule(moduleOf(0),stock,0);e.placeAt(W(10),stock,0);e.confirm(stock,0);
  const copy=e.getFrame(stock,0).placements.find(p=>p.slotIndex===W(10));e.removePlacement(copy.instanceId,stock,0);
  assert.equal(e.placeAt(W(0),stock,0).lastVerdict.reason,'OCCUPIED');
  assert.equal(e.placeAt(576,stock,0).lastVerdict.reason,'OUT_OF_BOUNDS');
  const moved=e.placeAt(W(12),stock,0);
  assert.equal(moved.placements.find(p=>p.slotIndex===W(12)).instanceId,copy.instanceId);e.confirm(stock,0);
  // The hex world also moves a placed copy directly, keeping its id.
  assert.equal(e.movePlacement(copy.instanceId,W(14),stock,0).lastVerdict.reason,'MOVED');
  assert.equal(e.getFrame(stock,0).placements.find(p=>p.instanceId===copy.instanceId).slotIndex,W(14));
  assert.equal(e.movePlacement(copy.instanceId,W(0),stock,0).lastVerdict.reason,'OCCUPIED');
  assert.equal(e.getFrame(stock,0).placements.find(p=>p.instanceId===copy.instanceId).slotIndex,W(14),'a refused move keeps the layout');
  assert.equal(e.movePlacement(e.getFrame(stock,0).placements.find(p=>p.moduleId===moduleOf(35)).instanceId,W(30),stock,0).lastVerdict.reason,'FIXED_WAITING_ROOM');
  e.movePlacement(copy.instanceId,W(12),stock,0);e.confirm(stock,0);
  e.removePlacement(copy.instanceId,stock,0);e.confirm(stock,0);assert.equal(e.getFrame(stock,0).tray.find(p=>p.moduleId===moduleOf(0)).availableCount,4);
  const restored=createCageEditRuntime({snapshot:e.toSave(),publicTestGrid:true});assert.deepEqual(restored.toSave(),e.toSave());
  const kept=e.getFrame(stock,0).placements.find(p=>p.moduleId===moduleOf(0));e.removePlacement(kept.instanceId,stock,0);e.revert(stock,0);e.selectModule(moduleOf(0),stock,0);
  assert.equal(e.placeAt(W(12),stock,0).lastVerdict.reason,'PLACED');assert.equal(validateProductRanch(e.getFrame(stock,0).placements),true);
});
test('two copies own distinct terrain/spawn and editor image bounds',()=>{
  const {editor:e,shop}=fullEditor(),stock=shop.toSave();e.selectModule(moduleOf(0),stock,0);e.placeAt(W(10),stock,0);e.confirm(stock,0);
  const frame=e.getFrame(stock,0),ground=createRanchRaisingGround({...e.toSave(),unlockedCount:20});const copies=ground.placements.filter(p=>p.definitionIndex===0);
  assert.equal(copies.length,2);for(const p of copies){const position=ranchRaisingSpawnPosition(ground,p.instanceId,{next:()=>50});assert.equal(ground.cageAt(position[0]/4096,position[1]/4096).instanceId,p.instanceId);}
  assert.notDeepEqual(ground.origin(copies[0].instanceId),ground.origin(copies[1].instanceId));
  const art=cageEditorArtCells(frame.slots,undefined,{productGrid:true});const cells=frame.slots.filter(s=>s.moduleId===moduleOf(0));for(const c of cells){const v=art.find(a=>a.slotIndex===c.slotIndex);assert.ok(v.imageWidth<=48);}
});
test('food search and reservation never mix same-template instances',()=>{
  const profile={fields:{'138':0,'008':0}},food=createNativeRaisingFood({slot:0,cageDefinitionIndex:0,cageInstanceId:'cage:other',positionQ12:[100,100,0]});
  assert.equal(findNativeRaisingFood(profile,[0,0,0],[food],0,10,'cage:mine'),null);
  assert.ok(findNativeRaisingFood(profile,[0,0,0],[food],0,10,'cage:other'));
  food.occupants[0]=0;reconcileNativeFoodReservations([{poolSlot:0,state:2,foodSlot:0,station:0,cageDefinitionIndex:0,cageInstanceId:'cage:mine'}],[food]);assert.equal(food.occupants[0],null);
});
test('legacy50 save keeps wallet,rights,positions and one copy each; stable migration no new grants',async()=>{
  const h=harness();let a=h.create();try{
    await a.newGame();a.openCageEdit();a.buyRanchTestRow(2);a.save();const prior=JSON.parse(h.data.get(CHAMPIONSHIP_MODERN_SAVE_KEY));
    prior.schemaVersion=5;delete prior.shop.cageQuantities;prior.shop.bits=1234;prior.flags.friendsPlaytest.diamonds=3210;
    prior.cageEdit.layoutVersion=LEGACY_PRODUCT_RANCH_GRID;delete prior.cageEdit.nextInstanceSequence;
    // Build the legacy fixture on the old board: world slot → 10×10 slot (inverse of the migration offset).
    const toLegacy=s=>{const c=productGridCell(s);return legacyGrid100Slot(c.row-8,c.column-7);};
    prior.cageEdit.placements=prior.cageEdit.placements.map(({instanceId,...p})=>({...p,slotIndex:toLegacy(p.slotIndex)}));
    const expected=structuredClone(prior);h.data.set(CHAMPIONSHIP_MODERN_SAVE_KEY,JSON.stringify(prior));await a.dispose();a=h.create();await a.continueGame();
    assert.equal(a.getShopFrame().bits,1234);assert.equal(a.getCageEditFrame().testDiamonds,3210);assert.equal(a.getCageEditFrame().layoutVersion,PRODUCT_RANCH_GRID);
    assert.equal(a.getCageEditFrame().unlockedCount,30);assert.deepEqual(a.getCageEditFrame().placements.map(({instanceId,displayName,trainingSummary,capacity,channels,...p})=>p),expected.cageEdit.placements.map(p=>({...p,slotIndex:W(p.slotIndex)})));
    a.save();const first=JSON.parse(h.data.get(CHAMPIONSHIP_MODERN_SAVE_KEY));await a.dispose();a=h.create();await a.continueGame();a.save();const second=JSON.parse(h.data.get(CHAMPIONSHIP_MODERN_SAVE_KEY));
    assert.deepEqual(second.cageEdit,first.cageEdit);assert.deepEqual(second.shop,first.shop);assert.equal(second.flags.friendsPlaytest.diamonds,3210);
  }finally{await a.dispose();}
});
test('v7 roundtrip retains copies; missing ID/colliding ID/stock corruption are refused',()=>{
  const source=deserializeChampionshipModernSave(JSON.stringify(read('qa/championship-full-qa-save.json'))),{editor:e,shop}=fullEditor(),stock=shop.toSave();
  e.selectModule(moduleOf(0),stock,0);e.placeAt(W(10),stock,0);e.confirm(stock,0);
  const save={...source,schemaVersion:7,shop:stock,cageEdit:e.toSave()};const restored=deserializeChampionshipModernSave(serializeChampionshipModernSave(save));assert.deepEqual(restored.cageEdit,e.toSave());
  const bad=structuredClone(save);bad.cageEdit.placements.at(-1).instanceId=bad.cageEdit.placements[0].instanceId;assert.throws(()=>serializeChampionshipModernSave(bad));
  const no=structuredClone(save);delete no.cageEdit.placements.at(-1).instanceId;assert.throws(()=>serializeChampionshipModernSave(no));
  const insufficient=structuredClone(save);insufficient.shop.cageQuantities[83]=1;assert.throws(()=>serializeChampionshipModernSave(insufficient),/CAGE_INSTANCE_STOCK_MISMATCH/);
  const malformed=structuredClone(save);malformed.shop.cageQuantities[83]=101;assert.throws(()=>serializeChampionshipModernSave(malformed));
});
test('app moves one resident between copies, persists owner; a home cage is kept until its resident moves',async()=>{
  const h=harness();let a=h.create();try{
    await a.newGame();a.openShop();a.buyShopItem(defs[0].shopRecordIndex,2);a.leaveScreen();a.openCageEdit();
    for(const slot of [W(10),W(12)]){a.selectCageModule(moduleOf(0));assert.equal(a.placeCageAt(slot).lastVerdict.reason,'PLACED');}
    a.confirmCageEdit();const frame=a.getCageEditFrame(),ground=createRanchRaisingGround(frame),copies=frame.placements.filter(p=>[W(10),W(12)].includes(p.slotIndex));a.leaveScreen();
    const id=a.getRaisingInstances()[0].instanceId;
    for(const copy of copies){const p=ranchRaisingSpawnPosition(ground,copy.instanceId,{next:()=>51});assert.equal(a.moveRaisingResidentToGround(id,{x:p[0]/4096,y:p[1]/4096}),true);assert.equal(a.getRaisingActorFrame(id).cageInstanceId,copy.instanceId);}
    a.save();await a.dispose();a=h.create();await a.continueGame();assert.equal(a.getRaisingActorFrame(id).cageInstanceId,copies[1].instanceId);
    // Owner 2026-10-26 v1: removing a partner's home is refused, the layout stays, nobody falls off the map.
    a.openCageEdit();assert.equal(a.removeCagePlacement(copies[1].instanceId).lastVerdict.reason,'RESIDENTS_PRESENT');
    assert.ok(a.getCageEditFrame().placements.some(p=>p.instanceId===copies[1].instanceId));a.leaveScreen();
    const back=ranchRaisingSpawnPosition(createRanchRaisingGround(a.getCageEditFrame()),copies[0].instanceId,{next:()=>51});
    assert.equal(a.moveRaisingResidentToGround(id,{x:back[0]/4096,y:back[1]/4096}),true);
    a.openCageEdit();assert.equal(a.removeCagePlacement(copies[1].instanceId).lastVerdict.reason,'REMOVED');a.confirmCageEdit();
    assert.equal(a.getRaisingActorFrame(id).cageInstanceId,copies[0].instanceId);
    assert.ok(a.getCageEditFrame().placements.some(p=>p.instanceId===copies[0].instanceId));
  }finally{await a.dispose();}
});
test('maximum100-cell placement and16-profile save stays within unchanged64KiB budget',()=>{
  const source=deserializeChampionshipModernSave(JSON.stringify(read('qa/championship-full-qa-save.json'))),{editor:e,shop}=fullEditor();
  shop.buy(defs[0].shopRecordIndex,95);const stock=shop.toSave();
  for(const p of e.getFrame(stock,0).placements)if(p.moduleId!==moduleOf(35))e.removePlacement(p.instanceId,stock,0);
  for(let slot=0;e.getFrame(stock,0).occupiedCount<100;slot++)if(!e.getFrame(stock,0).slots[slot].moduleId){e.selectModule(moduleOf(0),stock,0);assert.equal(e.placeAt(slot,stock,0).lastVerdict.reason,'PLACED');}
  e.selectModule(moduleOf(0),stock,0);assert.equal(e.placeAt(150,stock,0).lastVerdict.reason,'CELL_CAP','the 101st cell is refused');
  e.confirm(stock,0);assert.equal(e.getFrame(stock,0).occupiedCount,100);
  const next=structuredClone(source),base=next.raising.collection[0];
  while(next.raising.collection.length<15){const entry=structuredClone(base);entry.instanceId=`qa:capacity:${next.raising.collection.length}`;next.raising.collection.push(entry);next.raising.assignments[entry.instanceId]=next.raising.assignments[base.instanceId];}
  next.instanceIdentity={nextSequence:100};next.schemaVersion=7;next.shop=stock;next.cageEdit=e.toSave();
  const serialized=serializeChampionshipModernSave(next);assert.ok(Buffer.byteLength(serialized)<=64*1024);assert.equal(deserializeChampionshipModernSave(serialized).raising.collection.length,15);
});

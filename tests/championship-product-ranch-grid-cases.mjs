import fs from 'node:fs';
import { deserializeChampionshipModernSave, serializeChampionshipModernSave } from '../src/championship/app/championshipStandaloneSave.js';
import assert from 'node:assert/strict';
import test from 'node:test';
import { PRODUCT_RANCH_GRID, productGridCell, productGridSlot, productPlacementCells, productFieldTileOrigin,
  validateProductRanch, normalizeProductRanchAccess, migrateProductRanch, legacyGrid100Cell, legacyGrid100Slot,
  legacyGrid100PlacementCells, legacyGrid100SlotToWorld as W } from '../src/championship/cage/productRanchGrid.js';
import { createCageEditRuntime } from '../src/championship/cage/cageEditRuntime.js';
import { originalStartingRanch, nativePlacementMask } from '../src/championship/cage/nativeRanchLayout.js';
import { annexPlacementCells, validateExpandedRanch } from '../src/championship/cage/ranchExpansion.js';
import { listCageDefinitions } from '../src/championship/cage/cageCatalog.js';
import { ORIGINAL_CAGE_DEFINITION_SHAPES, ORIGINAL_CAGE_SHAPE_MASKS } from '../src/championship/cage/ranchSlotGeometry.js';
const defs=listCageDefinitions(), owned=defs.map(d=>d.shopRecordIndex).filter(Number.isInteger);
const moduleOf=i=>defs[i].moduleId;
const expansion={version:1,decks:2,grant:'PROTOTYPE_NON_PAID'};
const snapshot=()=>({...originalStartingRanch(),layoutVersion:'NATIVE_DECKS_V1',expansion});
const editor=()=>createCageEditRuntime({snapshot:snapshot(),publicTestGrid:true,initialTamerRank:9});

// Hex cage world (2026-10-26): the 10×10 board below is the legacy geometry that
// old saves migrate from; the world lattice keeps every footprint's shape.
test('100 unique stable IDs round-trip and exact screenshot cells are adjacent',()=>{
 const seen=new Set();
 for(let slot=0;slot<100;slot++){const c=legacyGrid100Cell(slot);assert.equal(legacyGrid100Slot(c.row,c.column),slot);seen.add(`${c.row},${c.column}`);}
 assert.equal(seen.size,100);assert.equal(legacyGrid100Slot(10,0),null);assert.equal(legacyGrid100Slot(0,10),null);
 assert.deepEqual(legacyGrid100PlacementCells({moduleId:moduleOf(22),slotIndex:11}),[11,32]);
 assert.deepEqual(legacyGrid100Cell(49),{slotIndex:49,row:4,column:9,x:864,y:352});
 // The same footprint in the world, shifted by whole rows/columns.
 assert.deepEqual(productPlacementCells({moduleId:moduleOf(22),slotIndex:W(11)}),[W(11),W(32)]);
 for(let slot=0;slot<576;slot++){const c=productGridCell(slot);assert.equal(productGridSlot(c.row,c.column),slot);}
 assert.equal(productGridSlot(24,0),null);assert.equal(productGridSlot(0,24),null);
});

test('every old valid native and annex shape retains identical occupied slot IDs',()=>{
 for(const d of defs) for(let slot=0;slot<20;slot++) {
  const entry={moduleId:d.moduleId,slotIndex:slot}, mask=nativePlacementMask(entry,20);
  if(mask!==null) assert.deepEqual(legacyGrid100PlacementCells(entry),Array.from({length:20},(_,i)=>i).filter(i=>mask&(1<<i)));
  const annex={...entry,slotIndex:20+slot}, cells=annexPlacementCells(annex,expansion);
  if(cells.length) assert.deepEqual(legacyGrid100PlacementCells(annex),cells);
 }
});

test('all36 definitions at all world anchors follow bounded odd-row geometry, no32bit alias',()=>{
 for(const d of defs) for(let slot=0;slot<576;slot++) {
  const a=productGridCell(slot), shape=ORIGINAL_CAGE_SHAPE_MASKS[ORIGINAL_CAGE_DEFINITION_SHAPES[d.cageDefinitionIndex]];
  const expected=[];let out=false;
  for(let b=0;b<8;b++)if(shape&(1<<b)){
   const id=productGridSlot(a.row+b%2,a.column+Math.floor(b/2)+(a.row%2&&b%2?1:0));
   if(id===null)out=true;else expected.push(id);
  }
  assert.deepEqual(productPlacementCells({moduleId:d.moduleId,slotIndex:slot}),out?null:expected);
 }
 assert.deepEqual(productPlacementCells({moduleId:moduleOf(15),slotIndex:W(49)}),[W(49)]);
 assert.equal(productPlacementCells({moduleId:moduleOf(22),slotIndex:575}),null,'the world edge bounds a footprint (no wrap)');
 assert.deepEqual(productFieldTileOrigin(W(11),2),{tileX:150,tileY:96,cropTopTiles:0});
 assert.deepEqual(productFieldTileOrigin(0,0),{tileX:0,tileY:-3,cropTopTiles:3});
});

test('screenshot gas placement succeeds across former boundary, then overlap is rejected',()=>{
 const e=editor();assert.equal(e.getFrame(owned,9).unlockedCount,40);
 e.selectModule(moduleOf(22),owned,9);const f=e.placeAt(W(11),owned,9);assert.equal(f.lastVerdict.reason,'PLACED');
 assert.deepEqual(f.slots.filter(s=>s.moduleId===moduleOf(22)).map(s=>s.slotIndex),[W(11),W(32)]);
 e.selectModule(moduleOf(23),owned,9);assert.equal(e.placeAt(W(32),owned,9).lastVerdict.reason,'OCCUPIED');
 e.confirm(owned,9);const save=JSON.parse(JSON.stringify(e.toSave()));
 const reload=createCageEditRuntime({snapshot:save,publicTestGrid:true,initialTamerRank:9});
 assert.deepEqual(reload.toSave(),save);assert.equal(reload.getFrame(owned,9).slots[W(32)].moduleId,moduleOf(22));
});

test('row purchase grant is explicit and persistent, never permanent purchase or all50 override',()=>{
 const e=editor();let f=e.getFrame(owned,9);assert.equal(f.slots.length,576);assert.equal(f.unlockedCount,40);
 // Land is a cell capacity in the hex world: fill it, then a row purchase adds ten cells anywhere.
 let refused=null,anchor=2*24+1;
 for(const d of defs){
  if(d.cageDefinitionIndex===35||e.toSave().placements.some(p=>p.moduleId===d.moduleId))continue;
  e.selectModule(d.moduleId,owned,9);const verdict=e.placeAt(anchor,owned,9).lastVerdict.reason;
  if(verdict==='LAND_CAPACITY'){refused=d.moduleId;break;}
  assert.equal(verdict,'PLACED');anchor+=6;if(anchor%24>18)anchor+=24*2-anchor%24+1;
 }
 assert.ok(refused,'land runs out before the world cap');assert.equal(e.getFrame(owned,9).productGrid.usedCells<=40,true);
 f=e.applyTestRowPurchase(4,owned,9);assert.equal(f.unlockedCount,50);assert.deepEqual(e.toSave().gridAccess.purchasedRows,[]);
 assert.deepEqual(e.toSave().gridAccess.testUnlockedRows,[4]);
 assert.equal(e.applyTestRowPurchase(10,owned,9).lastVerdict.ok,false);assert.equal(e.getFrame(owned,9).unlockedCount,50);
 e.selectModule(refused,owned,9);assert.equal(e.placeAt(anchor,owned,9).lastVerdict.reason,'PLACED');e.confirm(owned,9);
 const reload=createCageEditRuntime({snapshot:e.toSave(),publicTestGrid:true,initialTamerRank:0});
 assert.equal(reload.getFrame(owned,0).unlockedCount,50);assert.ok(reload.toSave().placements.some(p=>p.moduleId===refused&&p.slotIndex===anchor));
});

test('new rank0 has20 base cells, base rows cannot be purchased, fixed entrance remains fixed',()=>{
 const e=createCageEditRuntime({initializeOriginal:true,publicTestGrid:true});
 assert.equal(e.getFrame(owned,0).unlockedCount,20);
 assert.equal(e.applyTestRowPurchase(0,owned,0).lastVerdict.reason,'TEST_ROW_PURCHASE_UNAVAILABLE');
 assert.equal(e.applyTestRowPurchase(1,owned,0).lastVerdict.reason,'TEST_ROW_PURCHASE_UNAVAILABLE');
 assert.equal(e.removePlacement(moduleOf(35),owned,0).lastVerdict.reason,'FIXED_WAITING_ROOM');
 assert.deepEqual(e.toSave().gridAccess.purchasedRows,[]);
});

test('legacy10 annex keeps5x2 anchors and grandfather-opens complete rows without purchase',()=>{
 const legacy={...snapshot(),expansion:{...expansion,decks:1},placements:[...originalStartingRanch().placements,{moduleId:moduleOf(22),slotIndex:20}]};
 assert.equal(validateExpandedRanch(legacy.placements,14,legacy.expansion),true);
 const migrated=migrateProductRanch(legacy,14);
 assert.deepEqual(migrated.placements.map(({instanceId,...p})=>p),legacy.placements.map(p=>({...p,slotIndex:W(p.slotIndex)})));assert.equal(migrated.gridAccess.legacyUnlockedSlots.length,40);
 assert.deepEqual(migrated.gridAccess.purchasedRows,[]);assert.deepEqual(migrated.gridAccess.testUnlockedRows,[]);
 assert.deepEqual(legacyGrid100PlacementCells(legacy.placements.at(-1)),[20,21]);
 assert.deepEqual(productPlacementCells(migrated.placements.at(-1)),[W(20),W(21)]);
 assert.equal(validateProductRanch(migrated.placements),true);
});

test('malformed entitlement, overlap and out-of-range data rejected; old native mode unchanged',()=>{
 assert.throws(()=>normalizeProductRanchAccess({version:1,legacyUnlockedSlots:[0],purchasedRows:[],testUnlockedRows:[10]}));
 const e=editor();assert.equal(validateProductRanch([...e.toSave().placements,{moduleId:moduleOf(22),slotIndex:W(0)}]),false);
 assert.equal(validateProductRanch([...e.toSave().placements,{moduleId:moduleOf(22),slotIndex:576}]),false);
 const native=createCageEditRuntime({initializeOriginal:true});assert.equal(native.getFrame(owned,0).slots.length,20);
 native.selectModule(moduleOf(22),owned,0);assert.equal(native.placeAt(11,owned,0).lastVerdict.reason,'FOOTPRINT_BLOCKED');
});

test('purchase grant does not confirm or discard an active placement draft',()=>{
 const e=editor();e.selectModule(moduleOf(22),owned,9);e.placeAt(W(11),owned,9);
 const before=e.toSave().placements;assert.equal(e.getFrame(owned,9).dirty,true);
 e.applyTestRowPurchase(4,owned,9);
 assert.deepEqual(e.toSave().placements,before);assert.equal(e.getFrame(owned,9).dirty,true);
 assert.equal(e.getFrame(owned,9).slots[W(32)].moduleId,moduleOf(22));
});


test('full save envelope round-trips test rows without changing wallet or purchased entitlement',()=>{
 const source=deserializeChampionshipModernSave(fs.readFileSync(new URL('../qa/championship-full-qa-save.json',import.meta.url),'utf8'));
 const e=createCageEditRuntime({snapshot:source.cageEdit,publicTestGrid:true,initialTamerRank:source.progression.tamerRank});
 e.applyTestRowPurchase(4,source.shop.cageOwned,source.progression.tamerRank);
 const updated={...source,schemaVersion:7,cageEdit:e.toSave()};
 const restored=deserializeChampionshipModernSave(serializeChampionshipModernSave(updated));
 assert.equal(restored.shop.bits,source.shop.bits);assert.deepEqual(restored.shop.cageOwned,source.shop.cageOwned);
 assert.deepEqual(restored.cageEdit,updated.cageEdit);assert.deepEqual(restored.cageEdit.gridAccess.purchasedRows,[]);
 assert.ok(restored.cageEdit.gridAccess.testUnlockedRows.includes(4));
 assert.equal(Object.hasOwn(restored.cageEdit,'testAccessOverride'),false);
});


test('rank increases grandfather newly open native cells; later rank change does not relock them',()=>{
 const e=createCageEditRuntime({initializeOriginal:true,publicTestGrid:true});
 assert.equal(e.getFrame(owned,0).unlockedCount,20);assert.equal(e.getFrame(owned,9).unlockedCount,20);
 e.selectModule(moduleOf(23),owned,9);assert.equal(e.placeAt(W(19),owned,9).lastVerdict.reason,'PLACED');e.confirm(owned,9);
 const reload=createCageEditRuntime({snapshot:e.toSave(),publicTestGrid:true,initialTamerRank:0});
 assert.equal(reload.getFrame(owned,0).slots[W(19)].unlocked,true);assert.equal(reload.getFrame(owned,0).unlockedCount,20);
});

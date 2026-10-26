import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PRODUCT_RANCH_GRID,LEGACY_PRODUCT_RANCH_GRID100,productPlacementCells,validateProductRanch,restoreFixedRanchPlacements,
  legacyGrid100PlacementCells,validateLegacyGrid100,legacyGrid100SlotToWorld as W} from '../src/championship/cage/productRanchGrid.js';
// Rotated copies only ever existed in 10×10 GRID100 saves; since the hex cage world
// (2026-10-26) they are fixed on the old board, then laid into the world.
const inWorld=p=>({...p,slotIndex:W(p.slotIndex)});
import {composeProductRanchGround} from '../src/championship/raising/nativeRaisingRanchRing.js';
import {listCageDefinitions} from '../src/championship/cage/cageCatalog.js';
import {createCageEditRuntime} from '../src/championship/cage/cageEditRuntime.js';
import {ranchPositionAfterLayout} from '../src/championship/raising/ranchLayoutPositions.js';
import {deserializeChampionshipModernSave,serializeChampionshipModernSave} from '../src/championship/app/championshipStandaloneSave.js';
const defs=listCageDefinitions(),moduleOf=i=>defs[i].moduleId;
const waiting={moduleId:moduleOf(35),slotIndex:0,instanceId:'cage:waiting'};
const facility={moduleId:moduleOf(1),slotIndex:54,instanceId:'cage:test',rotation:1};
// Legacy CM02 rotated one step occupies 54,64,65; fixed shape is 54,65,55.
const all=Array.from({length:100},(_,i)=>i);
const access={version:1,legacyUnlockedSlots:all.slice(0,40),purchasedRows:[],testUnlockedRows:[4,5,6,7,8,9],legacyGrants:[]};
const seed=()=>{
 const save=JSON.parse(fs.readFileSync(new URL('../qa/championship-full-qa-save.json',import.meta.url),'utf8'));
 save.schemaVersion=7;save.cageEdit={layoutVersion:LEGACY_PRODUCT_RANCH_GRID100,gridAccess:structuredClone(access),placements:[{...waiting},{...facility}],nextInstanceSequence:2};
 return save;
};
test('legacy rotation becomes fixed in place, with stock, identity and ordinary saves preserved',()=>{
 const input=seed(),output=deserializeChampionshipModernSave(JSON.stringify(input));
 assert.deepEqual(output.cageEdit.placements,[inWorld(waiting),inWorld({moduleId:moduleOf(1),slotIndex:54,instanceId:'cage:test'})]);
 assert.equal(output.cageEdit.layoutVersion,PRODUCT_RANCH_GRID);
 assert.deepEqual(output.shop,input.shop);assert.deepEqual(input.cageEdit.placements[1],facility);
 const reload=deserializeChampionshipModernSave(serializeChampionshipModernSave(output));
 assert.deepEqual(reload.cageEdit,output.cageEdit);
 const original=JSON.parse(fs.readFileSync(new URL('../qa/championship-full-qa-save.json',import.meta.url),'utf8'));
 assert.deepEqual(deserializeChampionshipModernSave(JSON.stringify(original)).cageEdit,original.cageEdit);
});
test('conflict moves only the formerly rotated facility to unlocked vacant land',()=>{
 const obstacle={moduleId:moduleOf(0),slotIndex:55,instanceId:'cage:obstacle'};
 const output=restoreFixedRanchPlacements([waiting,facility,obstacle],all);
 assert.deepEqual(output[0],waiting);assert.deepEqual(output[2],obstacle);
 assert.notEqual(output[1].slotIndex,54);assert.equal(output[1].instanceId,facility.instanceId);
 assert.ok(validateLegacyGrid100(output,all));assert.equal(output[1].rotation,undefined);
 assert.deepEqual(restoreFixedRanchPlacements([waiting,facility,obstacle],all),output);
});
test('no free fixed footprint returns the copy to the tray without granting stock or land',()=>{
 const available=[...legacyGrid100PlacementCells(waiting),54,64,65];
 assert.deepEqual(restoreFixedRanchPlacements([waiting,facility],available),[waiting]);
 const input=seed(),used=new Set([...legacyGrid100PlacementCells(waiting),54,64,65]);
 input.cageEdit.placements.push(...all.filter(i=>!used.has(i)).map(slotIndex=>({moduleId:moduleOf(0),slotIndex,instanceId:`cage:fill:${slotIndex}`})));
 input.shop.cageQuantities=Object.fromEntries(input.shop.cageOwned.map(i=>[i,i===defs[0].shopRecordIndex?93:1]));
 input.raising.nativeHome.foods=[{slot:0,cageDefinitionIndex:1,cageInstanceId:'cage:test',localPositionQ12:[0,0,0],protein:false,remaining:4,freshness:100}];
 const id=input.creature.creatureId;
 input.raising.nativeHome.cageAssignments={[id]:'cage:test'};
 const output=deserializeChampionshipModernSave(JSON.stringify(input));
 assert.equal(output.cageEdit.placements.some(p=>p.instanceId==='cage:test'),false);
 assert.deepEqual(output.shop,input.shop);assert.deepEqual(output.cageEdit.gridAccess,access);
 assert.equal(output.raising.nativeHome.cageAssignments[id],waiting.instanceId);
 assert.equal(output.raising.nativeHome.foods[0].cageInstanceId,waiting.instanceId);
 assert.equal(output.raising.nativeHome.foods[0].remaining,4);
 const ground=composeProductRanchGround({...output.cageEdit,unlockedSlots:all}),food=output.raising.nativeHome.foods[0],o=ground.origin(waiting.instanceId);
 assert.notEqual(ground.readTerrain(Math.floor((o[0]+food.localPositionQ12[0]/4096)/8),Math.floor((o[1]+food.localPositionQ12[1]/4096)/8)),1);
});
test('malformed, overlapping, locked-land and waiting-room rotations remain rejected',()=>{
 for(const rotation of [-1,6,1.2,'1']){const s=seed();s.cageEdit.placements[1].rotation=rotation;assert.throws(()=>deserializeChampionshipModernSave(JSON.stringify(s)),/INVALID_CAGE_ROTATION/);}
 assert.throws(()=>restoreFixedRanchPlacements([{...waiting,rotation:1}],all));
 assert.throws(()=>restoreFixedRanchPlacements([waiting,facility,{...facility,instanceId:'cage:duplicate'}],all));
 assert.throws(()=>restoreFixedRanchPlacements([waiting,facility],legacyGrid100PlacementCells(waiting)));
 assert.equal(productPlacementCells(facility),null,'runtime rejects a nonzero direction');
});
test('editor offers fixed placement, withdrawal, relocation and confirmation without a rotation API',()=>{
 const s=deserializeChampionshipModernSave(JSON.stringify(seed()));
 const editor=createCageEditRuntime({snapshot:s.cageEdit});
 assert.equal(editor.rotatePlacement,undefined);assert.equal(editor.getFrame(s.shop,9).rotationEnabled,false);
 editor.removePlacement('cage:test',s.shop,9);assert.equal(editor.placeAt(74,s.shop,9).lastVerdict.ok,true);
 assert.equal(editor.confirm(s.shop,9).lastVerdict.ok,true);
 assert.equal(editor.toSave().placements.find(p=>p.instanceId==='cage:test').slotIndex,74);
 assert.ok(editor.toSave().placements.every(p=>!('rotation' in p)));
});
test('all 35 fixed cage types retain safe ground and safe occupant relocation',()=>{
 for(let d=0;d<35;d++){
  const make=slotIndex=>composeProductRanchGround({layoutVersion:PRODUCT_RANCH_GRID,unlockedSlots:all,placements:[waiting,{moduleId:moduleOf(d),slotIndex,instanceId:'cage:test'}]});
  const old=make(54),next=make(74),i=old.owners.findIndex((owner,i)=>owner===1&&old.terrain[i]!==1&&old.clearance[i]>1);
  assert.ok(i>=0,`walkable cage ${d}`);
  const p=ranchPositionAfterLayout(old,next,[(i%old.width*8+4)*4096,(Math.floor(i/old.width)*8+4)*4096,0],'cage:test');
  assert.equal(next.cageAt(p[0]/4096,p[1]/4096)?.instanceId,'cage:test');
  assert.notEqual(next.readTerrain(Math.floor(p[0]/32768),Math.floor(p[1]/32768)),1);
 }
});

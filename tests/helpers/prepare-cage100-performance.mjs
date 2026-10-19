// Controlled QA data only. Writes fixtures outside the product save authority.
import fs from 'node:fs';
import {deserializeChampionshipModernSave,serializeChampionshipModernSave} from '../../src/championship/app/championshipStandaloneSave.js';
import {deserializeRaisingHomeSaveR2,restoreRaisingHomeSnapshotR2,serializeRaisingHomeSaveR2} from '../../src/championship/raising/raisingHomePersistenceR2.js';
import {PRODUCT_RANCH_GRID,productGridCell,productPlacementCells} from '../../src/championship/cage/productRanchGrid.js';
import {listCageDefinitions} from '../../src/championship/cage/cageCatalog.js';
const output=new URL('../../.tmp/browser-qa/cage100/performance-fixtures/',import.meta.url);fs.mkdirSync(output,{recursive:true});
const baseline=deserializeChampionshipModernSave(fs.readFileSync(new URL('../../qa/championship-full-qa-save.json',import.meta.url),'utf8'));
const defs=listCageDefinitions(),waiting={moduleId:defs[35].moduleId,slotIndex:0,instanceId:'cage:perf:waiting'};
const occupied=new Set(productPlacementCells(waiting)),cases=[];
for(const requested of [25,50,75,100])for(const phase of ['static-map','animated-map','animated-with16']){
 const cells=Math.ceil(requested/10)*10,actorCount=phase==='animated-with16'?16:0;
 const save=structuredClone(baseline),placements=[waiting];
 for(let slot=0;slot<100;slot++)if(productGridCell(slot).row<cells/10&&!occupied.has(slot)){
  const definition=phase!=='static-map'&&slot%4===0?33:0;
  placements.push({moduleId:defs[definition].moduleId,slotIndex:slot,instanceId:`cage:perf:${slot}`});
 }
 const home=structuredClone(restoreRaisingHomeSnapshotR2(deserializeRaisingHomeSaveR2(save.raisingHome).document,{sessionId:save.sessionId}));
 if(actorCount===0){home.residents=[];home.selectedResidentId=null;save.raising.collection=[];save.raising.assignments={};}
 else{
  const originals=structuredClone(save.raising.collection);save.raising.collection=[];
  for(let i=0;i<15;i++){const entry=structuredClone(originals[i%originals.length]);entry.instanceId=`qa:perf:partner:${i}`;save.raising.collection.push(entry);save.raising.assignments[entry.instanceId]=Object.values(baseline.raising.assignments)[0];}
 }
 const ids=actorCount?[save.creature.creatureId,...save.raising.collection.map(e=>e.instanceId)]:[];
 const cageAssignments={};ids.forEach((id,i)=>{cageAssignments[id]=placements[i%placements.length].instanceId;});
 if(actorCount)for(const [i,entry]of save.raising.collection.entries()){
  const p=placements[(i+1)%placements.length];entry.nativeProfile.fields['014']=defs.find(d=>d.moduleId===p.moduleId).cageDefinitionIndex;
  entry.nativeProfile.fields['1c0']=0;entry.nativeProfile.fields['1c4']=0;
 }
 save.raising.nativeHome={version:1,poolSlots:Object.fromEntries(ids.map((id,i)=>[id,i])),cageAssignments,foods:[],waste:[],evolutionBranches:[]};
 if(save.progression.nativeMessages){Object.assign(save.progression.nativeMessages,{queue:[],activeId:null,morningPending:false,entryChecked:true});}
 save.raisingHome=serializeRaisingHomeSaveR2(home,{revision:save.progression.revision}).serialized;
 save.schemaVersion=7;save.instanceIdentity={nextSequence:1000};save.shop.bits=8000000;
 save.shop.cageQuantities=Object.fromEntries(save.shop.cageOwned.map(record=>[record,100]));
 save.cageEdit={layoutVersion:PRODUCT_RANCH_GRID,nextInstanceSequence:101,placements,gridAccess:{version:1,legacyUnlockedSlots:Array.from({length:20},(_,i)=>i),purchasedRows:[],testUnlockedRows:Array.from({length:cells/10-2},(_,i)=>i+2),legacyGrants:['NATIVE_RANK_CELLS_TEST_OPEN_V1']}};
 save.flags.friendsPlaytest={version:2,grants:['friends-playtest:coins:v1'],diamonds:20000-(cells-20)/10*1000,purchases:save.cageEdit.gridAccess.testUnlockedRows};
 const text=serializeChampionshipModernSave(save),name=`requested-${requested}-${phase}.json`;fs.writeFileSync(new URL(name,output),text);
 cases.push({requestedCells:requested,cells,phase,actorCount,moduleCount:placements.length,animatedModuleCount:placements.filter(p=>p.moduleId===defs[33].moduleId).length,saveBytes:Buffer.byteLength(text),fixture:name});
}
fs.writeFileSync(new URL('cases.json',output),JSON.stringify({qaOnly:true,rounding:'25→30,75→80 because ordinary land purchases are10-cell rows',staticPhase:'static CM01 modules; animated phases replace every fourth eligible module with approved two-phase CM39; no runtime animation-off switch is exposed',cases},null,2));
console.log(JSON.stringify({qaOnly:true,cases:cases.length,minimumSaveBytes:Math.min(...cases.map(c=>c.saveBytes)),maximumSaveBytes:Math.max(...cases.map(c=>c.saveBytes))}));

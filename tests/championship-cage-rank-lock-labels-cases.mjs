import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { TAMER_RANK_SLOT_TABLE, listCageDefinitions } from '../src/championship/cage/cageCatalog.js';
import { createCageEditRuntime } from '../src/championship/cage/cageEditRuntime.js';
import { prototypeRanchExpansion } from '../src/championship/cage/ranchExpansion.js';
import { uiText, setLabel, retranslate } from '../src/championship/text/uiText.js';
import { LOCALES, setLocale } from '../src/championship/text/locale.js';
const sourceText=fs.readFileSync(new URL('../src/championship/app/vs4Screens.js',import.meta.url),'utf8');
// Execute the real cell-rendering block with a small DOM harness. Art pixels
// are outside this label-only change; slot frames and translations are real.
const renderSource=sourceText.slice(sourceText.indexOf('    for (const slot of cage.slots) {'),sourceText.indexOf('    facilities.replaceChildren();',sourceText.indexOf('    for (const slot of cage.slots) {')));
const owned=listCageDefinitions().map(d=>d.shopRecordIndex).filter(Number.isInteger);
function render(rank,decks=0){
 let runtime=createCageEditRuntime({initializeOriginal:true});
 if(decks)runtime=createCageEditRuntime({snapshot:{...runtime.toSave(),layoutVersion:'NATIVE_DECKS_V1',expansion:{...prototypeRanchExpansion(),decks}}});
 const before=runtime.toSave();const cage=runtime.getFrame(owned,rank);const cells=[];const actions=[];
 const element=()=>({dataset:{},style:{},attributes:{},setAttribute(k,v){this.attributes[k]=v;},addEventListener(k,fn){this[k+'Handler']=fn;},click(){if(!this.disabled)this.clickHandler?.();}});
 const append=cell=>cells.push(cell);
 vm.runInNewContext(renderSource,{cage,TAMER_RANK_SLOT_TABLE,element,uiText,setLabel,board:{append},annexBoard:{append},
  cellArt:new Map(cage.slots.map(s=>[s.slotIndex,{x:s.column*48,y:s.row*44,image:null}])),
  cageUiName:(id,name)=>name??'',cageUiSummary:()=>'',source:{intents:{removeCagePlacement:id=>actions.push(['remove',id]),placeCageAt:n=>actions.push(['place',n])}}});
 assert.deepEqual(runtime.toSave(),before,'rendering cannot change the save or grant');
 return {cells,cage,actions};
}
test('rank 0/2/4/6/9 main locks show the exact authoritative threshold and never an error cross',()=>{
 setLocale('zh-Hant');
 for(const rank of [0,2,4,6,9]){
  const {cells,cage,actions}=render(rank);
  assert.equal(cells.length,20);assert.equal(cage.unlockedCount,TAMER_RANK_SLOT_TABLE[rank]);
  for(const cell of cells){const slot=Number(cell.dataset.slotIndex);const locked=slot>=TAMER_RANK_SLOT_TABLE[rank];
   assert.equal(cell.disabled,locked||cage.slots[slot].fixed);
   if(locked){const required=TAMER_RANK_SLOT_TABLE.findIndex(count=>slot<count);assert.equal(cell.textContent,'🔒');assert.equal(cell.dataset.requiredRank,String(required));
    assert.equal(cell.attributes.title,uiText('CAGE_SLOT_RANK_LOCKED',{n:slot+1,rank:required}));assert.equal(cell.attributes['aria-label'],cell.attributes.title);cell.click();}
   else assert.equal(cell.dataset.requiredRank,undefined);
   assert.notEqual(cell.textContent,'×');
  }
  assert.deepEqual(actions,[]);
 }
});
test('all five locales expose complete translated tooltip and accessible label with slot/rank values',()=>{
 const labels=[];
 for(const locale of LOCALES){setLocale(locale);const {cells}=render(0);const cell=cells[14];const label=cell.attributes['aria-label'];
  assert.equal(label,uiText('CAGE_SLOT_RANK_LOCKED',{n:15,rank:2}));assert.equal(label,cell.attributes.title);
  assert.match(label,/15/);assert.match(label,/2/);assert.doesNotMatch(label,/CAGE_SLOT_RANK_LOCKED|\{(?:n|rank)\}/);labels.push(label);
 }
 assert.equal(new Set(labels).size,5);setLocale('zh-Hant');
});
test('remembered title and aria labels retranslate without changing lock state or rank',()=>{
 setLocale('zh-Hant');const {cells}=render(0);setLocale('en');retranslate({querySelectorAll:()=>cells});
 assert.equal(cells[14].attributes.title,'Slot 15 is locked. Unlocks at tamer rank 2.');assert.equal(cells[14].disabled,true);assert.equal(cells[14].textContent,'🔒');setLocale('zh-Hant');
});
test('no grant, old ten-cell annex and full QA twenty-cell annex retain their boundaries at every tested rank',()=>{
 for(const rank of [0,2,4,6,9])for(const decks of [0,1,2]){
  const {cells,cage,actions}=render(rank,decks);const annex=cells.filter(c=>Number(c.dataset.slotIndex)>=20);
  assert.equal(annex.length,decks*10);assert.equal(cage.expansion?.annexSlotCount??0,decks*10);
  for(const cell of annex){assert.equal(cell.disabled,false);assert.equal(cell.textContent,'+');assert.equal(cell.dataset.requiredRank,undefined);assert.notEqual(cell.attributes.title,uiText('CAGE_SLOT_RANK_LOCKED'));}
  if(annex.length){annex.at(-1).click();assert.deepEqual(actions,[['place',19+decks*10]]);}
 }
});

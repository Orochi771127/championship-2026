import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import { createQaRanchExpansionText, applyQaRanchExpansion } from '../src/championship/app/qaRanchExpansion.js';
import { CHAMPIONSHIP_MODERN_SAVE_KEY as KEY, serializeChampionshipModernSave, deserializeChampionshipModernSave } from '../src/championship/app/championshipStandaloneSave.js';
import { createCageEditRuntime } from '../src/championship/cage/cageEditRuntime.js';
const fixture = JSON.parse(fs.readFileSync(new URL('../qa/championship-full-qa-save.json', import.meta.url), 'utf8'));
const original = structuredClone(fixture);
original.cageEdit.layoutVersion = 'NATIVE_ANCHORS_V1';
delete original.cageEdit.expansion;
const text = JSON.stringify(original);
const memory = (value = text) => { const data = new Map([[KEY,value]]); return { getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v) }; };

test('QA upgrade preserves all unrelated progress and placements; idempotent', () => {
  const result = createQaRanchExpansionText(text);
  const save = JSON.parse(result);
  assert.deepEqual(save.cageEdit.expansion, {version:1,decks:1,grant:'PROTOTYPE_NON_PAID'});
  assert.deepEqual(save.cageEdit.placements,original.cageEdit.placements);
  save.cageEdit = original.cageEdit;
  assert.deepEqual(save,original);
  assert.equal(createQaRanchExpansionText(result),result);
});

test('all ten actual runtime slots accept placement, removal/move and committed save reload', () => {
  let save = JSON.parse(createQaRanchExpansionText(text));
  let runtime = createCageEditRuntime({snapshot:save.cageEdit});
  const args = [save.shop.cageOwned,save.progression.tamerRank];
  const module = 'championship:2026:cage:15'; // Existing one-cell cage, supports both rows.
  assert.equal(runtime.getFrame(...args).slots.filter(s=>s.slotIndex>=20&&s.unlocked).length,10);
  for (let slot = 20; slot <= 29; slot++) {
    runtime.removePlacement(module,...args);
    runtime.selectModule(module,...args);
    assert.equal(runtime.placeAt(slot,...args).lastVerdict.reason,'PLACED',`slot ${slot}`);
    runtime.confirm(...args);
    save = deserializeChampionshipModernSave(serializeChampionshipModernSave({...save,cageEdit:runtime.toSave()}));
    runtime = createCageEditRuntime({snapshot:save.cageEdit});
    assert.equal(runtime.getFrame(...args).slots.find(s=>s.slotIndex===slot).moduleId,module);
  }
  runtime.removePlacement(module,...args);runtime.selectModule(module,...args);
  assert.equal(runtime.placeAt(30,...args).lastVerdict.reason,'OUT_OF_BOUNDS');
});

test('normal save stays locked unless explicit QA action is invoked', () => {
  const storage = memory();
  const runtime = createCageEditRuntime({snapshot:original.cageEdit});
  const args = [original.shop.cageOwned,original.progression.tamerRank];
  runtime.removePlacement('championship:2026:cage:15',...args);
  runtime.selectModule('championship:2026:cage:15',...args);
  assert.equal(runtime.placeAt(20,...args).lastVerdict.reason,'OUT_OF_BOUNDS');
  assert.equal(storage.getItem(KEY),text);
});

test('validated backup precedes write; repeated action does not back up or write', async () => {
  const storage=memory();let backups=0;
  assert.deepEqual(await applyQaRanchExpansion(storage, async before=>{assert.equal(before,text);assert.equal(storage.getItem(KEY),text);backups++;}),{changed:true});
  assert.deepEqual(await applyQaRanchExpansion(storage,()=>{throw Error('should not back up');}),{changed:false});
  assert.equal(backups,1);
});

test('invalid/missing/legacy-layout saves, failed backup, quota error, concurrent change cannot overwrite progress',async()=>{
  for(const value of [null,'bad json',JSON.stringify({...original,cageEdit:{placements:[]}})]){
    const s=memory(value);await assert.rejects(applyQaRanchExpansion(s,()=>assert.fail('backup before validation')));assert.equal(s.getItem(KEY),value);
  }
  const s=memory();await assert.rejects(applyQaRanchExpansion(s,()=>{throw Error('backup failed');}));assert.equal(s.getItem(KEY),text);
  const quota={getItem:()=>text,setItem:()=>{throw Error('QuotaExceededError');}};
  await assert.rejects(applyQaRanchExpansion(quota,()=>{}),/QuotaExceededError/);assert.equal(quota.getItem(KEY),text);
  const race=memory();await assert.rejects(applyQaRanchExpansion(race,()=>race.setItem(KEY,'newer progress')),/其他分頁/);assert.equal(race.getItem(KEY),'newer progress');
  const silent={getItem:()=>text,setItem:()=>{}};await assert.rejects(applyQaRanchExpansion(silent,()=>{}),/無法確認/);
});

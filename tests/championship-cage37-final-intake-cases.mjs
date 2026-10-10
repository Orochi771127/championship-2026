import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import manifest from '../assets/production/cage/final-intake-20261008/manifest.json' with {type:'json'};
import previous from '../assets/production/cage/original-opus-v1/manifest.json' with {type:'json'};
import {validateRuntimeMapArtBundle} from '../src/championship/presentation/runtimeMapArtBundle.js';
import {createRaisingCageArtPlan} from '../src/championship/presentation/raisingCageArtPlan.js';
import {listCageDefinitions} from '../src/championship/cage/cageCatalog.js';
import {validateNativeRanch,NATIVE_RANCH_LAYOUT,WAITING_ROOM_MODULE} from '../src/championship/cage/nativeRanchLayout.js';
import {isShippingArtEntry} from '../scripts/lib/public-art-boundary.mjs';
test('37 final cage fields and 41 delivered frames keep verified geometry, roles and time',()=>{
 assert.equal(validateRuntimeMapArtBundle(manifest).fields.length,37);
 assert.equal(manifest.fields.reduce((n,f)=>n+f.frames.length,0),41);
 for(const f of manifest.fields){
  const old=previous.fields.find(p=>p.fieldId===f.fieldId);
  for(const k of ['worldWidthPx','worldHeightPx','nativeWidthPx','nativeHeightPx','visualRole','gameplayBinding','gateMapping','collisionBinding'])assert.deepEqual(f[k],old[k],f.fieldId+':'+k);
  assert.equal(f.frames.length,old.frames.length);
  for(const [i,fr] of f.frames.entries()){
   assert.equal(createHash('sha256').update(readFileSync(fr.src)).digest('hex'),fr.sha256);
   assert.equal(fr.durationMs,old.frames[i].durationMs);
  }
 }
 assert.equal(manifest.fields.find(f=>f.fieldId==='field_cm03_01').frames[0].sha256,'b757e18558a44b0f2ebd3052ae9de508258cff9b4670fe3b8215fb55bf6d70df');
 assert.equal(manifest.fields.find(f=>f.fieldId==='field_cm24_01').frames[0].sha256,'601b05420d77f23fdc1dea75323ed350a85f11bb28068b77212c922989dd6146');
});
test('every valid cage anchor preserves upper-row crop, world origin, wrap, lids and resident viewport',()=>{
 let count=0;
 for(const unlockedCount of [14,16,18,20])for(const d of listCageDefinitions())for(let slot=0;slot<unlockedCount;slot++){
  const placements=[{moduleId:WAITING_ROOM_MODULE,slotIndex:0}];
  if(d.moduleId!==WAITING_ROOM_MODULE)placements.push({moduleId:d.moduleId,slotIndex:slot});else if(slot!==0)continue;
  if(!validateNativeRanch(placements,unlockedCount))continue;
  const opts={placements,layoutVersion:NATIVE_RANCH_LAYOUT,unlockedCount};
  assert.deepEqual(createRaisingCageArtPlan({...opts,manifest}),createRaisingCageArtPlan({...opts,manifest:previous}));
  count++;
 }
 assert.ok(count>500,'broad valid native anchor coverage');
});
test('local art approval and static completion do not imply object clock or publishing acceptance',()=>{
 assert.equal(manifest.localOnly,true);assert.equal(manifest.runtimeAccepted,false);
 assert.equal(manifest.publicReleasePermitted,false);assert.equal(manifest.shippingReady,false);
 assert.equal(isShippingArtEntry({...manifest,manifestPath:'assets/production/cage/final-intake-20261008/manifest.json'}),false);
 for(const f of manifest.fields)assert.match(f.intake.objectCellClock,/UNKNOWN_REQUIRES_TRACE/);
 const main=readFileSync('src/championship/app/main.js','utf8');
 assert.match(main,/\? "assets\/production\/cage\/final-intake-20261008\/manifest.json"\s*:\s*"assets\/production\/cage\/original-opus-v1\/manifest.json"/);
});

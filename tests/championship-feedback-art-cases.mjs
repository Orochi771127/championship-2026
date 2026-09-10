import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createNativeCharacterAnimationTimeline} from '../src/championship/presentation/characterAnimationTimeline.js';
import {huntFeedbackCell,huntFeedbackBinding,huntTrapLayers,loadRegisteredHuntFeedbackArt} from '../src/championship/presentation/huntFeedbackArt.js';
import {loadRegisteredCharacterHudArt,validateCharacterHudArt,CHARACTER_HUD_ART_ID,CHARACTER_HUD_ART_MANIFEST} from '../src/championship/presentation/characterHudArt.js';

test('Hunt feedback clock matches the verified native timeline for every catalog tool duration',()=>{
  const catalog=JSON.parse(readFileSync(new URL('../src/data/championship/catalogs/hunt-tools.r1.json',import.meta.url)));
  for(const banks of Object.values(catalog.controllerAnimations))for(const bank of banks)for(const row of bank){
    const sequence={id:0,playbackMode:row.mode,loopStartFrame:row.loop,frames:row.ticks.map((ticks,cell)=>({ticks,cell,texture:String(cell)}))};
    const native=createNativeCharacterAnimationTimeline(sequence);
    for(let age=0;age<200;age++){assert.equal(huntFeedbackCell(sequence,age),native.getSnapshot().cell);native.advanceNative(4096);}
  }
});

test('Hunt feedback selects the existing shot selector and original burst sequence without inventing a trap binding',()=>{
  assert.deepEqual(huntFeedbackBinding({kind:'SHOT_IMPACT',status:2,remaining:7}),{kind:'SHOT',item:2,sequence:0,remaining:7});
  assert.deepEqual(huntFeedbackBinding({kind:'TOOL_BURST',sourceKind:'MINE',itemIndex:1,sequence:4,remaining:12}),{kind:'MINE',item:1,sequence:4,remaining:12});
  assert.equal(huntFeedbackBinding({kind:'CAPTURE_TRAP',triggered:true}),null);
  assert.equal(huntFeedbackBinding({kind:'WIRE'}),null);
});

test('New reference art loaders refuse all public hosts before reading a manifest',async()=>{
  for(const load of [loadRegisteredHuntFeedbackArt,loadRegisteredCharacterHudArt])for(const baseUrl of ['https://game.example/championship.html','https://127.0.0.1.example/']){
    assert.equal(await load({baseUrl,fetchImpl:()=>assert.fail('public asset read')}),null);
  }
});

test('Trap secondary animation switches at the original 31-update boundary and prison retains four parts',()=>{
  const trap={kind:'CAPTURE_TRAP',itemIndex:0,triggered:true,x:20,y:40,visualTicks:30};
  assert.deepEqual(huntTrapLayers(trap).slice(1).map(o=>o.visualBinding),[{sequence:2,elapsed:30}]);
  assert.deepEqual(huntTrapLayers({...trap,visualTicks:31}).slice(1).map(o=>o.visualBinding),[{sequence:4,elapsed:0}]);
  assert.deepEqual(huntTrapLayers({...trap,itemIndex:1}).slice(1).map(o=>o.visualBinding.sequence),[2,3,7]);
  assert.equal(huntTrapLayers({...trap,triggered:false}).length,1);
});

test('Raising HUD rejects Main art, changed native scale and shipping promotion',()=>{
  const entry={assetId:CHARACTER_HUD_ART_ID,manifestPath:CHARACTER_HUD_ART_MANIFEST,runtimeEligible:true,localOnly:true,runtimeScope:'LOOPBACK_RESEARCH_ONLY',publicReleasePermitted:false,shippingReady:false,rightsStatus:'ROM_COPYRIGHTED_REFERENCE'};
  const manifest={schemaVersion:1,...entry,binding:'OVL18_SELECTED_DB_SUB_SEQUENCE_0_FIRST_FRAME_STATIC',portraits:[{speciesId:'species-021',entityId:'m102_koromon',src:CHARACTER_HUD_ART_MANIFEST.replace('manifest.json','m102_koromon.png'),sourceBank:'m102_koromon_db_sub',sequenceId:0,nativeScale:2,width:20,height:20,sha256:'a'.repeat(64)}]};
  const index={entries:[entry]};assert.equal(validateCharacterHudArt(manifest,index).portraits.length,1);
  for(const patch of [{sourceBank:'m102_koromon_main'},{nativeScale:4},{sequenceId:1}]){
    const copy=structuredClone(manifest);Object.assign(copy.portraits[0],patch);assert.throws(()=>validateCharacterHudArt(copy,index));
  }
  assert.throws(()=>validateCharacterHudArt({...manifest,shippingReady:true},index));
});

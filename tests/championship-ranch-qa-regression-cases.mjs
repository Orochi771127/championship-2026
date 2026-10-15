import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {listCageDefinitions} from '../src/championship/cage/cageCatalog.js';
import {createCageEditRuntime} from '../src/championship/cage/cageEditRuntime.js';
import {createRanchCageArtPlan} from '../src/championship/presentation/raisingRanchArtPlan.js';
import {loadRuntimeMapArtTileSet,validateRuntimeMapArtBundle} from '../src/championship/presentation/runtimeMapArtBundle.js';
import {prototypeRanchExpansion} from '../src/championship/cage/ranchExpansion.js';
import {createRanchRaisingGround} from '../src/championship/raising/nativeRaisingRanchRing.js';
const manifest=validateRuntimeMapArtBundle(JSON.parse(fs.readFileSync(new URL('../assets/production/cage/final-intake-20261008/manifest.json',import.meta.url))));
class Container{constructor(o={}){Object.assign(this,o);this.children=[];this.position={set:(x,y)=>{this.x=x;this.y=y;}};this.scale={set(){}};}addChild(...c){this.children.push(...c);return c[0];}destroy(){this.destroyed=true;}}
class Sprite extends Container{constructor(texture){super();this.texture=texture;} }
class AnimatedSprite extends Sprite{constructor({textures}){super(textures[0]);this.textures=textures;}gotoAndStop(n){this.texture=this.textures[n];}stop(){}}
class Graphics extends Container{rect(){return this;}fill(){return this;}}
class Texture{constructor(o){Object.assign(this,o);}destroy(){}}
class Rectangle{constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}}
const PIXI={Container,Sprite,AnimatedSprite,Graphics,Texture,Rectangle,Assets:{async load(src){const f=manifest.fields.find(f=>f.frames.some(a=>a.src===src));if(!f)throw Error(src);return{source:{},frame:{x:0,y:0,width:f.worldWidthPx,height:f.worldHeightPx}};},async unload(){}}};

const definitions=listCageDefinitions();const owned=definitions.map(d=>d.shopRecordIndex).filter(Number.isInteger);
function makeRuntime(decks=0){
 const runtime=createCageEditRuntime({initializeOriginal:true});
 if(!decks)return runtime;
 const snapshot={...runtime.toSave(),layoutVersion:'NATIVE_DECKS_V1',expansion:{...prototypeRanchExpansion(),decks}};
 return createCageEditRuntime({snapshot});
}
async function load(frame){const plan=createRanchCageArtPlan({manifest,...frame});return loadRuntimeMapArtTileSet({PIXI,manifest,...plan,presentationMode:plan.mode});}
test('all owned facility masks load at every valid main, legacy annex and full QA annex anchor',async()=>{
 let checked=0;
 for(const decks of [0,1,2])for(const def of definitions.filter(d=>!d.alwaysOwned))for(let slot=0;slot<20+decks*10;slot++){
  const runtime=makeRuntime(decks);
  for(const p of runtime.getFrame(owned,9).placements)if(p.moduleId!=='championship:2026:cage:waiting-room')runtime.removePlacement(p.moduleId,owned,9);
  runtime.selectModule(def.moduleId,owned,9);if(runtime.placeAt(slot,owned,9).lastVerdict.reason!=='PLACED')continue;
  const frame=runtime.getFrame(owned,9);const art=await load(frame);assert.ok(art.tileCount>0);checked++;
  if(decks){const ground=createRanchRaisingGround(frame);assert.equal(ground.width,(20+decks*10)*6);assert.equal(art.field.fold.annexWidthPx,decks*10*48*4);}
 }
 assert.ok(checked>1500,`checked ${checked} legal facility placements`);
 console.log(`validated ${checked} legal facility placements across main/10-slot/20-slot annex`);
});
test('full QA layout plus garden at anchor 10 and volcano in a free upper bay loads without resetting layout',async()=>{
 const fixture=JSON.parse(fs.readFileSync(new URL('../qa/championship-full-qa-save.json',import.meta.url)));
 const runtime=createCageEditRuntime({snapshot:fixture.cageEdit});
 runtime.selectModule('championship:2026:cage:17',owned,9);assert.equal(runtime.placeAt(10,owned,9).lastVerdict.reason,'PLACED');
 // Keep the known failing mask and add a second valid facility, as in the report.
 runtime.selectModule('championship:2026:cage:3',owned,9);assert.equal(runtime.placeAt(14,owned,9).lastVerdict.reason,'PLACED');
 runtime.confirm(owned,9);const before=runtime.toSave();await load(runtime.getFrame(owned,9));assert.deepEqual(runtime.toSave(),before);
});
test('loader rejects duplicate facilities, duplicate lids and malformed structural role identities',async()=>{
 const facility={fieldId:'field_cm01_01',x:0,y:0,slotIndex:4,moduleId:'championship:2026:cage:0',cageDefinitionIndex:0};
 const lid={fieldId:'field_cm29_01',x:0,y:0,slotIndex:4,moduleId:null,cageDefinitionIndex:null,structuralRole:'LID'};
 const run=placements=>loadRuntimeMapArtTileSet({PIXI,manifest,placements,presentationMode:'NATIVE_RANCH'});
 await run([facility,lid]);
 await assert.rejects(run([facility,{...facility}]),/TILE_SET_DUPLICATE_SLOT/);
 await assert.rejects(run([lid,{...lid}]),/TILE_SET_DUPLICATE_SLOT/);
 for(const bad of [{...lid,moduleId:facility.moduleId},{...lid,cageDefinitionIndex:0},{...lid,structuralRole:'FAKE'},{...lid,fieldId:facility.fieldId}])await assert.rejects(run([bad]),/TILE_SET_STRUCTURAL_ROLE_INVALID/);
 await assert.rejects(loadRuntimeMapArtTileSet({PIXI,manifest,placements:[lid],presentationMode:'EXPLICIT_TILE_SET'}),/TILE_SET_STRUCTURAL_ROLE_INVALID/);
});

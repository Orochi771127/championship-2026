import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { originalStartingRanch, validateNativeRanch, nativePlacementMask, NATIVE_RANCH_LAYOUT, WAITING_ROOM_MODULE } from '../src/championship/cage/nativeRanchLayout.js';
import { createCageEditRuntime } from '../src/championship/cage/cageEditRuntime.js';
import { getCageDefinition } from '../src/championship/cage/cageCatalog.js';
import { createRaisingCageArtPlan } from '../src/championship/presentation/raisingCageArtPlan.js';
import { loadRuntimeMapArtTileSet } from '../src/championship/presentation/runtimeMapArtBundle.js';
import { raisingFieldViewport } from '../src/championship/presentation/intRh2/raisingFieldViewport.js';
import { getRaisingNativePixelScale } from '../src/championship/presentation/intRh2/raisingNativeSizing.js';
import { createChampionshipStandaloneApp } from '../src/championship/app/championshipStandaloneApp.js';
import { CHAMPIONSHIP_MODERN_SAVE_KEY } from '../src/championship/app/championshipStandaloneSave.js';
const json = path=>JSON.parse(fs.readFileSync(path,'utf8'));
const manifest=json('assets/production/cage/licensed-runtime-v1/manifest.json');
const owned=[0,1,15].map(id=>getCageDefinition(id).shopRecordIndex);
const moduleId=n=>`championship:2026:cage:${n}`;
const plan=()=>createRaisingCageArtPlan({manifest,...originalStartingRanch()});

test('new ranch seeds match original setter records, fixed room and nine occupied cells',()=>{
  const initial=originalStartingRanch();
  assert.deepEqual(initial.placements.map(p=>[p.moduleId,p.slotIndex]),[
    [WAITING_ROOM_MODULE,0],[moduleId(0),8],[moduleId(1),4],[moduleId(15),7]]);
  assert.ok(validateNativeRanch(initial.placements,14));
  const editor=createCageEditRuntime({initializeOriginal:true});
  const frame=editor.getFrame(owned,0);
  assert.equal(frame.layoutVersion,NATIVE_RANCH_LAYOUT);
  assert.equal(frame.occupiedCount,9);
  assert.deepEqual(frame.slots.filter(s=>s.fixed).map(s=>s.slotIndex),[0,1,2,3]);
  assert.equal(editor.removePlacement(WAITING_ROOM_MODULE,owned,0).lastVerdict.reason,'FIXED_WAITING_ROOM');
  assert.deepEqual(editor.toSave(),initial);
});

test('multi-cell placement rejects covered cells, lower-row crossings and rank bounds without changing a draft',()=>{
  const editor=createCageEditRuntime({initializeOriginal:true});
  editor.removePlacement(moduleId(1),owned,0);
  editor.selectModule(moduleId(1),owned,0);
  for(const slot of [0,2,5,6,12]) {
    const frame=editor.placeAt(slot,owned,0);
    assert.equal(frame.lastVerdict.reason,'FOOTPRINT_BLOCKED');
    assert.equal(frame.placements.length,3);
  }
  assert.equal(editor.placeAt(10,owned,0).lastVerdict.reason,'PLACED');
  assert.equal(nativePlacementMask({moduleId:moduleId(1),slotIndex:10},14),7<<10);
});

test('normal initial art plan joins Waiting Room and three facilities with original origins and upper-row crop',()=>{
  const actual=plan();
  assert.equal(actual.mode,'NATIVE_RANCH');
  assert.deepEqual(actual.placements.map(p=>[p.fieldId,p.x,p.y,p.sourceRect.y]),[
    ['field_cm28_01',0,0,96],['field_cm01_01',1536,0,96],
    ['field_cm02_01',768,0,96],['field_cm16_01',1344,256,0]]);
  assert.deepEqual(actual.residentViewport,{x:0,y:0,width:960,height:704});
  assert.equal(actual.placementEvidence,'NATIVE_ORIGINS_AND_CROP_WITH_FLATTENED_ART');
  assert.ok(Object.isFrozen(actual.placements[0].sourceRect));
});

test('last lower cell wraps its right source strip to the left at the same row',()=>{
  const initial=originalStartingRanch();
  initial.placements.find(p=>p.moduleId===moduleId(0)).slotIndex=13;
  const actual=createRaisingCageArtPlan({manifest,...initial});
  const fragments=actual.placements.filter(p=>p.cageDefinitionIndex===0);
  assert.equal(fragments.length,2);
  assert.deepEqual(fragments.map(p=>[p.x,p.y,p.sourceRect.x,p.sourceRect.width]),[[2496,256,0,192],[0,256,192,192]]);
});

test('portrait ranch camera preserves native pixel scale and clamps both pan edges',()=>{
  const field={presentationMode:'NATIVE_RANCH',worldWidthPx:1920,worldHeightPx:704,nativePixelWorldScale:4};
  const screen={width:384,height:500};
  const left=raisingFieldViewport(field,screen,12,-100);
  const right=raisingFieldViewport(field,screen,12,100000);
  assert.equal(left.x,12);
  assert.equal(right.x+right.width,372);
  assert.equal(left.scale*4,getRaisingNativePixelScale(field,screen));
  assert.equal(left.scale,right.scale);
});

function pixiFixture() {
  const resources={loads:[],unloads:[],crops:[],destroyed:[]};
  class Node {
    constructor(texture){this.texture=texture;this.children=[];this.position={set:(x,y)=>{this.x=x;this.y=y;}};}
    addChild(n){this.children.push(n);n.parent=this;}
    removeChild(n){this.children=this.children.filter(c=>c!==n);n.parent=null;}
    destroy(){this.destroyed=true;}
    gotoAndStop(){}
  }
  const PIXI={Container:Node,Sprite:Node,AnimatedSprite:Node,
    Rectangle:class {constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}},
    Texture:class {constructor(options){Object.assign(this,options);resources.crops.push(this);}destroy(source){resources.destroyed.push(source);}},
    Assets:{async load(src){resources.loads.push(src);const field=manifest.fields.find(f=>f.frames.some(frame=>frame.src===src));
      return {source:{},frame:{x:0,y:0,width:field.worldWidthPx,height:field.worldHeightPx}};},
      async unload(src){resources.unloads.push(src);}}};
  return {PIXI,resources};
}
test('existing texture authority loads four cropped fields and releases crop views without destroying shared sources',async()=>{
  const {PIXI,resources}=pixiFixture();const request=plan();
  const bundle=await loadRuntimeMapArtTileSet({PIXI,manifest,placements:request.placements,
    presentationMode:request.mode,placementEvidence:request.placementEvidence,residentViewport:request.residentViewport});
  assert.equal(bundle.field.worldWidthPx,1920);assert.equal(bundle.field.worldHeightPx,704);
  assert.equal(resources.loads.length,4);assert.equal(resources.crops[0].frame.y,96);
  assert.deepEqual(bundle.field.residentViewport,request.residentViewport);
  await bundle.dispose();await bundle.dispose();
  assert.equal(resources.unloads.length,4);assert.deepEqual(resources.destroyed,[false,false,false,false]);
});

test('a later invalid crop rolls back all acquired textures',async()=>{
  const {PIXI,resources}=pixiFixture();const request=structuredClone(plan());request.placements[1].sourceRect.height=99999;
  await assert.rejects(loadRuntimeMapArtTileSet({PIXI,manifest,placements:request.placements}),/SOURCE_RECT_INVALID/);
  assert.deepEqual(resources.unloads,resources.loads);
  assert.deepEqual(resources.destroyed,[false]);
});

test('old saved placements keep their exact anchors and legacy renderer; new saves persist native configuration',async()=>{
  const data=new Map();const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const options={storage,catalog:json('src/data/championship/catalogs/creature-species.r1.json'),
    cages:json('docs/contracts/championship/raising-home-presentation.v1.json').cages};
  let app=createChampionshipStandaloneApp(options);await app.newGame();app.save();
  const native=jsonString(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY));
  assert.deepEqual(native.cageEdit,originalStartingRanch());await app.dispose();
  app=createChampionshipStandaloneApp(options);await app.continueGame();
  assert.equal(app.getCageEditFrame().layoutVersion,NATIVE_RANCH_LAYOUT);await app.dispose();
  const old={placements:[{moduleId:moduleId(0),slotIndex:0},{moduleId:WAITING_ROOM_MODULE,slotIndex:3}]};
  native.cageEdit=old;storage.setItem(CHAMPIONSHIP_MODERN_SAVE_KEY,JSON.stringify(native));
  app=createChampionshipStandaloneApp(options);await app.continueGame();
  assert.equal(app.getCageEditFrame().layoutVersion,null);app.save();
  assert.deepEqual(jsonString(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)).cageEdit,old);
  assert.equal(createRaisingCageArtPlan({manifest,...old}).mode,'PLAYER_PLACEMENTS');await app.dispose();
});
function jsonString(value){return JSON.parse(value);}

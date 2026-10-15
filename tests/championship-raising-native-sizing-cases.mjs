import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CHARACTER_NATIVE_SIZING } from "../src/data/championship/characterNativeSizing.js";
import { BATTLE_CHARACTER_GEOMETRY } from "../src/data/championship/battleCharacterGeometry.js";
import { getCharacterStaticNativeSizing } from "../src/championship/presentation/licensedCharacterRoster.js";
import {spawnSync} from 'node:child_process';
import {ACTIVE_ALTERNATE_FORM_ASSETS, rekeyAlternateDonorRuntime, bindAlternateFormManifest} from '../src/championship/presentation/alternateFormAssetContracts.js';

// The shipping imports above are intentionally unhooked. Only a separate child
// process disables the alternate assets to retain the original native oracles.
const nativeReferenceFlag = '--asset-disabled-native-reference';
const isNativeReference = process.argv.includes(nativeReferenceFlag);
const assetDisabledBootstrap = `
  import {registerHooks} from 'node:module';
  registerHooks({load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);
    if (!url.endsWith('/alternate-form-assets.r1.json')) return loaded;
    const catalog = JSON.parse(String(loaded.source));
    for (const config of catalog.characters) {
      config.runtimeReady = false;
      config.qa = {...config.qa, normalPath: 'PENDING'};
    }
    return {...loaded, source: JSON.stringify(catalog)};
  }});
`;
function runNativeReference(code) {
  const env = {...process.env};
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', assetDisabledBootstrap + code], {
    cwd: new URL('..', import.meta.url), env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, 'Native reference child must finish without a signal.');
  assert.equal(result.status, 0, `Asset-disabled native reference failed:\n${result.stderr}\n${result.stdout}`);
  return result.stdout;
}
function readNativeSnapshot(modulePath, expression) {
  const moduleUrl = new URL(modulePath, import.meta.url).href;
  return JSON.parse(runNativeReference(`const native = await import(${JSON.stringify(moduleUrl)}); console.log(JSON.stringify(${expression}));`));
}
const expectedAlternateBindings = [
  [211, 'm528_metaletemon', 'm528_metaletemon'],
  [222, 'm540_imperialdramon_fm', 'm506_griffomon'],
  [229, 'oc_crownbrass_mandrill', 'm528_metaletemon'],
  [230, 'oc_celestyrant_battle_r10', 'm540_imperialdramon_fm'],
];
function assertProductionAssets() {
  assert.deepEqual(ACTIVE_ALTERNATE_FORM_ASSETS.map(c => [c.speciesIndex, c.entityId, c.motionDonorEntityId])
    .sort((a, b) => a[0] - b[0]), expectedAlternateBindings);
  for (const config of ACTIVE_ALTERNATE_FORM_ASSETS) {
    assert.equal(config.runtimeReady, true);
    assert.equal(config.qa.normalPath, 'PASS');
  }
}

if (isNativeReference) {
  const { getRaisingNativePixelScale, getRaisingNativeActorGeometry, raisingOriginalBodyScale, raisingOriginalBodyOffset, getRaisingEggContactShadow } = await import("../src/championship/presentation/intRh2/raisingNativeSizing.js");
  const { mountRaisingFieldPixiPresentation } = await import("../src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js");
  test('native reference explicitly disables alternate assets without changing the original oracle', () => {
    assert.equal(ACTIVE_ALTERNATE_FORM_ASSETS.length, 0);
  });
const read = (name) => JSON.parse(fs.readFileSync(new URL(`../${name}`, import.meta.url), "utf8"));
const base = "assets/production/internal-faithful-baseline/characters-v1/";
const manifest = read(base + "manifest.json");
function fixture(id = "e000_digitama", resolution = 1) {
  const record = manifest.records.find((item) => item.entityId === id);
  const runtime = read(base + record.runtime);
  const sizing = getCharacterStaticNativeSizing(record, runtime);
  const data = read(base + `${id}/main-atlas-00.json`).frames[sizing.texture];
  return { record, runtime, sizing, sprite: { anchor: runtime.artProfile.anchor,
    texture: { source: { resolution },
      orig: { width: data.sourceSize.w / resolution, height: data.sourceSize.h / resolution },
      trim: { x: data.spriteSourceSize.x / resolution, y: data.spriteSourceSize.y / resolution,
        width: data.spriteSourceSize.w / resolution, height: data.spriteSourceSize.h / resolution } } } };
}
const cm01 = { worldWidthPx: 384, worldHeightPx: 448, nativePixelWorldScale: 4 };

test('all eight original eggs fit native idle bounds with one transform for idle/hatch, resolution and flip',()=>{
  const selection=read('src/data/championship/accepted-original-character-selection.r1.json');
  const sizing={packedPixelsPerNativePixel:4,evidence:'COMPLETED_ORIGINAL_DENSITY4_LOCAL_PLAY'};
  for(let index=0;index<8;index++){
    const id=`e00${index}_digitama`,config=selection.characters.find(c=>c.entityId===id);
    const runtime=read(selection.root+config.folder+'/runtime.review.json');
    const idle=runtime.reviewGeometry.frames[`${id}/main/cell_000`];
    const target=BATTLE_CHARACTER_GEOMETRY[id].frames[`${id}/main/cell_000`].nativeBounds;
    assert.deepEqual(target,[-7,-17,7,1]);
    const [x0,y0,x1,y1]=idle.nativeBounds;
    const factor=Math.min((target[2]-target[0])/(x1-x0),(target[3]-target[1])/(y1-y0));
    assert.equal(raisingOriginalBodyScale(id,sizing),factor);
    const offset=raisingOriginalBodyOffset(id,sizing),savedOffset=structuredClone(offset);
    const originalRuntime=JSON.stringify(runtime);
    for(const frame of Object.values(runtime.reviewGeometry.frames).filter(f=>!f.blank)){
      for(const resolution of [1,2])for(const nativeScale of [.5,2,4])for(const flipX of [false,true]){
        const sprite={anchor:{x:frame.origin[0]/frame.sourceSize[0],y:frame.origin[1]/frame.sourceSize[1]},
          texture:{source:{resolution},orig:{width:frame.sourceSize[0]/resolution,height:frame.sourceSize[1]/resolution}}};
        const actual=getRaisingNativeActorGeometry(sprite,sizing,nativeScale,{frameGeometry:frame,displayScale:factor,displayOffset:offset,flipX});
        const [a,b,c,d]=frame.nativeBounds,sign=flipX?-1:1;
        assert.ok(Math.abs(actual.visible.width-(c-a)*factor)<1e-9);
        assert.ok(Math.abs(actual.visible.height-(d-b)*factor)<1e-9);
        assert.ok(Math.abs(actual.visible.x+actual.visible.width/2-sign*((a+c)/2*factor+offset.x))<1e-9);
        assert.ok(Math.abs(actual.visible.y+actual.visible.height-(d*factor+offset.y))<1e-9,'fixed anchor retains hatch motion');
        assert.equal(actual.spriteScale,resolution/4*factor);
        assert.ok(actual.hitArea.width*nativeScale>=44-1e-9);
        assert.ok(actual.hitArea.height*nativeScale>=44-1e-9);
        if(frame===idle){
          assert.ok(actual.visible.width<=14+1e-9&&actual.visible.height<=18+1e-9);
          assert.ok(Math.abs(actual.visible.x+actual.visible.width/2)<1e-9);
          assert.ok(Math.abs(actual.visible.y+actual.visible.height-1)<1e-9);
          for(const css of [{x:1,y:1},{x:.5625,y:.5625},{x:.5,y:.75}]){
            const fitted=getRaisingNativeActorGeometry(sprite,sizing,nativeScale,{frameGeometry:frame,displayScale:factor,displayOffset:offset,flipX,hitAreaCssScale:css});
            assert.deepEqual(fitted.visible,actual.visible,'CSS hit padding never changes the drawn body/shadow bounds');
            assert.deepEqual(fitted.offset,actual.offset);
            assert.equal(fitted.spriteScale,actual.spriteScale);
            assert.ok(fitted.hitArea.width*nativeScale*css.x>=44-1e-9,'44 real CSS px after horizontal canvas transform');
            assert.ok(fitted.hitArea.height*nativeScale*css.y>=44-1e-9,'44 real CSS px after vertical canvas transform');
          }
        }
      }
    }
    assert.deepEqual(offset,savedOffset,'flipping never mutates the reusable offset');
    assert.equal(JSON.stringify(runtime),originalRuntime,'source pixels, anchors and animation metadata remain untouched');
    const nativeSizing={...sizing,evidence:'VERIFIED_STATIC_MAIN_FIRST_SOURCE_FRAME'};
    assert.equal(raisingOriginalBodyScale(id,nativeSizing),1);
    assert.equal(raisingOriginalBodyOffset(id,nativeSizing),null);
  }
});
test('three oversized original ranch bodies use one fixed factor across every pose without moving its ground or center',()=>{
  const selection=read('src/data/championship/accepted-original-character-selection.r1.json');
  for(const [id,factor] of [['m518_blackwargreymon',.6444],['m529_metalgarurumon_va',.3648],['m541_dukemon',.5948],['m503_warglaymon',1],['m509_shinegraymon',1]]){
    const config=selection.characters.find(c=>c.entityId===id),runtime=read(selection.root+config.folder+'/runtime.review.json');
    const sizing={packedPixelsPerNativePixel:4,evidence:'COMPLETED_ORIGINAL_DENSITY4_LOCAL_PLAY'};
    assert.equal(raisingOriginalBodyScale(id,sizing),factor);assert.equal(raisingOriginalBodyScale(id,{...sizing,evidence:'VERIFIED_STATIC_MAIN_FIRST_SOURCE_FRAME'}),1);
    for(const frame of Object.values(runtime.reviewGeometry.frames).filter(f=>!f.blank)){
      const sprite={anchor:{x:frame.origin[0]/frame.sourceSize[0],y:frame.origin[1]/frame.sourceSize[1]},texture:{source:{resolution:1},orig:{width:frame.sourceSize[0],height:frame.sourceSize[1]}}};
      for(const flipX of [false,true]){
        const g=getRaisingNativeActorGeometry(sprite,sizing,2,{frameGeometry:frame,displayScale:factor,flipX});
        const [x0,y0,x1,y1]=frame.nativeBounds;
        assert.ok(Math.abs(g.visible.width-(x1-x0)*factor)<1e-9);assert.ok(Math.abs(g.visible.height-(y1-y0)*factor)<1e-9);
        assert.ok(Math.abs(g.visible.y+g.visible.height-y1)<1e-9,'opaque bottom stays on the same ground line');
        assert.ok(Math.abs(g.visible.x+g.visible.width/2-(flipX?-1:1)*(x0+x1)/2)<1e-9,'horizontal center stays fixed');
        assert.equal(g.spriteScale,factor/4);assert.ok(g.hitArea.width*2>=44-1e-9);
      }
    }
  }
});
test('untrimmed original egg uses verified per-cell alpha bounds for its floor shadow and touch area',()=>{
  const runtime=read('assets/production/characters/accepted-20261010/e001_digitama-dot-intake-r01/runtime.review.json');
  for(const frame of Object.values(runtime.reviewGeometry.frames).filter(f=>!f.blank)){
    const sprite={anchor:{x:frame.origin[0]/frame.sourceSize[0],y:frame.origin[1]/frame.sourceSize[1]},texture:{source:{resolution:1},orig:{width:frame.sourceSize[0],height:frame.sourceSize[1]},trim:null}};
    const before=structuredClone(sprite);
    for(const flipX of [false,true]){
      const actual=getRaisingNativeActorGeometry(sprite,{packedPixelsPerNativePixel:4},2,{frameGeometry:frame,flipX});
      const [x0,y0,x1,y1]=frame.nativeBounds;
      assert.equal(actual.visible.width,x1-x0);assert.equal(actual.visible.height,y1-y0);
      assert.equal(actual.visible.y+actual.visible.height,y1,'floor uses opaque bottom, independent of jump Z');
      assert.equal(actual.visible.x,flipX?-x1:x0);
      assert.equal(actual.spriteScale,.25);assert.ok(actual.hitArea.width*2>=44);
    }
    assert.deepEqual(sprite,before,'sizing does not mutate the authored origin or texture');
  }
});
test("all 224 current static identities bind verified sizing; stale hashes and other frames/sides refuse", () => {
  assert.equal(Object.keys(CHARACTER_NATIVE_SIZING).length, 224);
  for (const record of manifest.records) assert.ok(fixture(record.entityId).sizing, record.entityId);
  const { record, runtime } = fixture();
  assert.equal(getCharacterStaticNativeSizing(record, runtime, "sub"), null);
  const stale = structuredClone(record);
  stale.files.find((item) => item.path === record.runtime).sha256 = "0".repeat(64);
  assert.equal(getCharacterStaticNativeSizing(stale, runtime), null);
  const changed = structuredClone(runtime);
  changed.sides.main.animations[0].frames[0].texture = "other-frame";
  assert.equal(getCharacterStaticNativeSizing(record, changed), null);
});
test("native visible geometry reverses actual 12x/8x/4x packaging, not canvas padding", () => {
  for (const [id, width, height] of [["e000_digitama",14,18], ["m201_agumon",16,18],
    ["m222_tentomon",24,23], ["m226_hagurumon",19,16], ["m431_whamon",73,34]]) {
    const { sprite, sizing } = fixture(id);
    const actual = getRaisingNativeActorGeometry(sprite, sizing, 1);
    assert.equal(actual.visible.width, width, id);
    assert.equal(actual.visible.height, height, id);
  }
});
test("egg/cage ratio survives viewport and composite size; hit area stays at least 44 CSS pixels", () => {
  const { sprite, sizing } = fixture();
  for (const view of [{width:390,height:620}, {width:320,height:400}, {width:1440,height:900}]) {
    for (const field of [cm01, {...cm01, worldWidthPx:1536, worldHeightPx:896}]) {
      const scale = getRaisingNativePixelScale(field, view);
      const result = getRaisingNativeActorGeometry(sprite, sizing, scale);
      assert.ok(Math.abs(result.visible.width * scale / (384 * scale / 4) - 14/96) < 1e-12);
      assert.ok(result.hitArea.width * scale >= 44 - 1e-9);
      assert.ok(result.hitArea.height * scale >= 44 - 1e-9);
    }
  }
});
test("atlas resolution changes do not change native size; unsupported metadata remains unknown", () => {
  for (const resolution of [0.5,1,2,3]) {
    const { sprite, sizing } = fixture("e000_digitama", resolution);
    assert.equal(getRaisingNativeActorGeometry(sprite,sizing,2).visible.width,14);
  }
  assert.equal(getRaisingNativePixelScale({}, {width:390,height:844}),null);
  assert.equal(getRaisingNativeActorGeometry(fixture().sprite,null,1),null);
  const {record,runtime} = fixture("m201_agumon");
  assert.equal(getCharacterStaticNativeSizing(record,runtime,"main",{sourcePixelScaleBySide:{main:2}}).packedPixelsPerNativePixel,2);
});

// Exercise the real scene integration, including resize, flip, pointer intent,
// legacy fallback isolation and disposal, without introducing a second renderer.
class Node {
  constructor(options={}) { Object.assign(this,options); this.children=[]; this.events={};
    this.position={set:(x,y)=>{this.x=x;this.y=y;}};
    this.scale={x:1,y:1,set:(x,y=x)=>{this.scale.x=x;this.scale.y=y;}}; }
  addChild(...children){for(const child of children){child.parent=this;this.children.push(child);}return children[0];}
  addChildAt(child,index){child.parent=this;this.children.splice(index,0,child);}
  removeChild(child){this.children=this.children.filter(item=>item!==child);child.parent=null;}
  on(name,fn){this.events[name]=fn;} off(name){delete this.events[name];}
  destroy(){this.destroyed=true;}
  clear(){return this;} ellipse(...args){this.lastEllipse=args;return this;} fill(){return this;} stroke(){return this;}
  circle(){return this;} poly(){return this;} rect(){return this;} roundRect(){return this;}
  moveTo(){return this;} lineTo(){return this;} star(){return this;}
}
test("real Raising scene shares native scale on resize/flip and keeps padded taps functional", async()=>{
  const {sprite,sizing}=fixture(); Object.assign(sprite,{scale:new Node().scale});
  const scene=new Node(); let onResize; let selected=null; let disposed=false; let relocated=null;
  const frame={revision:1,cages:[{cageId:"a",name:"A",region:{x:0,y:0,w:1,h:.5}},
    {cageId:"b",name:"B",region:{x:0,y:.5,w:1,h:.5}}],
    residents:[{creatureId:"egg",speciesId:"species-000",displayName:"Egg",cageId:"a",lane:{x:.5,y:.5},facing:"left"}]};
  const stage={PIXI:{Assets:{},Container:Node,Graphics:Node,Text:Node,ColorMatrixFilter:Node,Rectangle:class{constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}}},
    app:{screen:{width:390,height:620},stage:new Node(),canvas:{addEventListener(){},removeEventListener(){}},ticker:{add(){},remove(){}}},
    createSceneRoot:()=>scene, markScene:()=>()=>{},attach(){},onContextLost:()=>()=>{},
    onResize(fn){onResize=fn;return()=>{};}};
  const fieldArt={field:cm01,displayObject:new Node(),update(){},dispose(){},getDiagnostics(){return{};}};
  const port=await mountRaisingFieldPixiPresentation({stage,fieldArt,reducedMotion:true,
    source:{getFrame:()=>frame,subscribe:()=>()=>{},intents:{selectCreature:id=>selected=id,relocateCreature(id,cage){relocated={id,cage};}}},
    characterBundle:{createActor:()=>({sprite,nativeSizing:sizing,controller:null}),dispose(){disposed=true;},getDiagnostics(){return{};}}});
  const root=scene.children.find(item=>item.label==="actors").children[0];
  assert.ok(scene.children.find(item=>item.label==="terrain").children.every(item=>item.visible===false),
    "legacy region outlines are hidden when real cage artwork is loaded");
  assert.deepEqual(root.children[0].lastEllipse,[0,1,14*.42,14*.13],
    'native baseline egg retains its pre-existing shadow; only accepted original eggs opt in');
  assert.equal(sprite.scale.x,1/12);
  assert.equal(root.scale.x,-getRaisingNativePixelScale(cm01,stage.app.screen));
  assert.equal(root.x,195,"lane projection is preserved");
  // The scene's fit and resident positions use the same letterboxed world.
  const expectedHeight = cm01.worldHeightPx * getRaisingNativePixelScale(cm01,stage.app.screen) / cm01.nativePixelWorldScale;
  assert.ok(Math.abs(root.y - ((620-expectedHeight)/2 + expectedHeight*.25)) < 1e-8);
  stage.app.screen.width=320; onResize();
  assert.equal(root.scale.y,getRaisingNativePixelScale(cm01,stage.app.screen));
  assert.ok(root.hitArea.width*root.scale.y>=44);
  root.events.pointerdown({stopPropagation(){},pointerId:1,global:{x:root.x,y:root.y}});
  assert.equal(selected,"egg");
  stage.app.stage.events.globalpointermove({pointerId:1,global:{x:160,y:610}});
  stage.app.stage.events.pointerup({pointerId:1,global:{x:160,y:610}});
  assert.equal(relocated,null,"empty margin below the fitted cage is not a drop target");
  root.events.pointerdown({stopPropagation(){},pointerId:1,global:{x:root.x,y:root.y}});
  const destination={x:160,y:465};
  stage.app.stage.events.globalpointermove({pointerId:1,global:destination});
  stage.app.stage.events.pointerup({pointerId:1,global:destination});
  assert.deepEqual(relocated,{id:"egg",cage:"b"},"hiding artwork guides does not alter the existing relocation intent");
  assert.equal(port.getDiagnostics().nativeSizing[0].status,"SHARED_NATIVE_PIXEL_SCALE");
  port.dispose(); assert.equal(disposed,true);
});

test('accepted egg contact rests on solid shell, not glow; floor footprint stays fixed across hatch/lift',()=>{
  const sizing={packedPixelsPerNativePixel:4,evidence:'COMPLETED_ORIGINAL_DENSITY4_LOCAL_PLAY'};
  // Half-opacity cell_000 pixel bounds: independently checked against unchanged WebP bytes.
  const opaque=[[-23,-44.5,23.25,0],[-22.75,-46,22.5,1],[-22.75,-46,22.25,0],[-19.75,-51.75,20,.25],
    [-23.5,-53.5,23.25,-.5],[-27,-53.75,30.25,0],[-18.75,-54.75,27,.5],[-23.75,-62.5,30.75,.75]];
  for(let i=0;i<8;i++){
    const id=`e00${i}_digitama`,scale=raisingOriginalBodyScale(id,sizing),offset=raisingOriginalBodyOffset(id,sizing);
    const runtime=read(`assets/production/characters/accepted-20261010/${id}-dot-intake-r01/runtime.review.json`);
    const [x0,,x1,y1]=opaque[i],rest=getRaisingEggContactShadow(id,sizing);
    assert.equal(rest.y,y1*scale+offset.y,'shadow center meets the opaque rest bottom');
    assert.ok(rest.y<1,'glow tail never determines contact');
    assert.equal(rest.x,(x0+x1)/2*scale+offset.x);
    assert.equal(rest.radiusX,(x1-x0)*scale*.42);
    for(const flipX of [false,true]){
      const contact=getRaisingEggContactShadow(id,sizing,flipX);
      assert.equal(contact.x,rest.x*(flipX?-1:1));assert.equal(contact.y,rest.y);
      for(const frame of Object.values(runtime.reviewGeometry.frames).filter(f=>!f.blank)){
        const sprite={anchor:{x:frame.origin[0]/frame.sourceSize[0],y:frame.origin[1]/frame.sourceSize[1]},
          texture:{source:{resolution:1},orig:{width:frame.sourceSize[0],height:frame.sourceSize[1]}}};
        const geometry=getRaisingNativeActorGeometry(sprite,sizing,2,{frameGeometry:frame,displayScale:scale,displayOffset:offset,flipX});
        for(const lift of [0,4,16]){
          assert.equal(geometry.offset.y-lift,offset.y-lift,'native lift is not normalized away');
          assert.deepEqual(getRaisingEggContactShadow(id,sizing,flipX),contact,'hatch frame never drags the floor shadow');
        }
      }
    }
    assert.equal(getRaisingEggContactShadow(id,{...sizing,evidence:'VERIFIED_STATIC_MAIN_FIRST_SOURCE_FRAME'}),null);
  }
  assert.equal(getRaisingEggContactShadow('m201_agumon',sizing),null);
  assert.equal(getRaisingEggContactShadow('e008_digitama',sizing),null);
  assert.equal(getRaisingEggContactShadow('e007_digitama',null),null);
});

test('real Raising scene binds egg contact only to shadow and preserves lift, flip and resize',async()=>{
  const entityId='e007_digitama',runtime=read(`assets/production/characters/accepted-20261010/${entityId}-dot-intake-r01/runtime.review.json`);
  const sizing={packedPixelsPerNativePixel:4,evidence:'COMPLETED_ORIGINAL_DENSITY4_LOCAL_PLAY'};
  const sprite=new Node();sprite.anchor={x:0.5,y:320/352,set(x,y){this.x=x;this.y=y;}};
  sprite.texture={source:{resolution:1},orig:{width:384,height:352}};
  let cell=0,onResize,tick;
  const presenter={apply(){return this.getSnapshot();},getSnapshot:()=>({geometry:runtime.reviewGeometry.frames[`${entityId}/main/cell_${String(cell).padStart(3,'0')}`]})};
  const native={speciesIndex:7,flipBits:0,positionQ12:[0,0,0],state:0};
  const frame={revision:1,cages:[],residents:[{creatureId:'egg',speciesId:'championship:creature:species-007',displayName:'Egg',lane:{x:.5,y:.5},facing:'left'}]};
  const scene=new Node(),stage={PIXI:{Assets:{},Container:Node,Graphics:Node,Text:Node,ColorMatrixFilter:Node,Rectangle:class{constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}}},
    app:{screen:{width:390,height:620},stage:new Node(),canvas:{addEventListener(){},removeEventListener(){},getBoundingClientRect:()=>({width:390,height:620})},ticker:{add(fn){tick=fn;},remove(){}}},
    createSceneRoot:()=>scene,markScene:()=>()=>{},attach(){},onContextLost:()=>()=>{},onResize(fn){onResize=fn;return()=>{};}};
  const fieldArt={field:cm01,displayObject:new Node(),update(){},dispose(){},getDiagnostics(){return{};}};
  const port=await mountRaisingFieldPixiPresentation({stage,fieldArt,reducedMotion:true,
    source:{getFrame:()=>frame,getActorFrame:()=>native,subscribe:()=>()=>{},intents:{selectCreature(){},relocateCreature(){}}},
    characterBundle:{createActor:()=>({sprite,entityId,nativeSizing:sizing,nativeFramePresenter:presenter}),dispose(){},getDiagnostics(){return{};}}});
  const root=scene.children.find(n=>n.label==='actors').children[0],shadow=root.children[0],selection=root.children[1];
  for(const flip of [0,1])for(const pose of [0,1,4,7,10,12])for(const lift of [0,4,16]){
    cell=pose;native.flipBits=flip;native.positionQ12[2]=lift*4096;tick({deltaMS:0});
    const contact=getRaisingEggContactShadow(entityId,sizing,Boolean(flip));
    assert.deepEqual(shadow.lastEllipse,[contact.x,contact.y,contact.radiusX,contact.radiusY]);
    assert.equal(sprite.y,raisingOriginalBodyOffset(entityId,sizing).y-lift);
    assert.equal(Math.sign(sprite.scale.x),flip?-1:1);
    assert.notDeepEqual(selection.lastEllipse,shadow.lastEllipse,'selection geometry remains independent');
  }
  stage.app.screen.width=320;onResize();
  assert.equal(root.scale.y,getRaisingNativePixelScale(cm01,stage.app.screen));
  assert.ok(root.hitArea.width*root.scale.y>=44);
  port.dispose();
});

} else {
  test('asset-disabled child preserves every original local-reference case', () => {
    runNativeReference(`process.argv.push(${JSON.stringify(nativeReferenceFlag)}); await import(${JSON.stringify(import.meta.url)});`);
  });

  test('production generated static sizing binds 226 identities and accepts all four real active contracts', () => {
    assertProductionAssets();
    const native = readNativeSnapshot('../src/data/championship/characterNativeSizing.js', 'native.CHARACTER_NATIVE_SIZING');
    assert.equal(Object.keys(native).length, 224);
    assert.equal(Object.keys(CHARACTER_NATIVE_SIZING).length, 226);
    const replacements = new Set(ACTIVE_ALTERNATE_FORM_ASSETS.map(c => c.entityId));
    for (const [id, sizing] of Object.entries(native)) {
      if (!replacements.has(id)) assert.deepEqual(CHARACTER_NATIVE_SIZING[id], sizing, id);
    }
    // These record/runtime metadata fixtures come from the generated native
    // evidence. Full on-disk source hashes and atlas sizes remain tested above
    // in the isolated original local-reference suite, not manufactured here.
    const donorIds = [...new Set(ACTIVE_ALTERNATE_FORM_ASSETS.map(c => c.motionDonorEntityId))];
    const manifest = {records: donorIds.map(entityId => ({entityId, runtime: entityId + '/runtime.json',
      files: native[entityId].files.map(([path, sha256]) => ({path, sha256}))})), speciesBindings: []};
    const before = structuredClone(manifest);
    const bound = bindAlternateFormManifest(manifest);
    assert.deepEqual(manifest, before);
    assert.equal(bound.speciesBindings.length, 4);
    for (const config of ACTIVE_ALTERNATE_FORM_ASSETS) {
      const source = native[config.motionDonorEntityId];
      const expectedTexture = config.entityId + source.texture.slice(config.motionDonorEntityId.length);
      assert.deepEqual(CHARACTER_NATIVE_SIZING[config.entityId], {...source, texture: expectedTexture}, config.entityId);
      const donorRuntime = {entityId: config.motionDonorEntityId,
        sides: {main: {animations: [{id: 0, frames: [{texture: source.texture, cell: 0, ticks: 1}]}]}, sub: {animations: []}}};
      const runtime = rekeyAlternateDonorRuntime(donorRuntime, config);
      const record = bound.records.find(r => r.entityId === config.entityId);
      const actual = getCharacterStaticNativeSizing(record, runtime);
      assert.deepEqual(actual, {texture: expectedTexture, packedPixelsPerNativePixel: source.packedPixelsPerNativePixel,
        evidence: 'VERIFIED_STATIC_MAIN_FIRST_SOURCE_FRAME'});
      assert.equal(getCharacterStaticNativeSizing(record, runtime, 'main', {
        sourcePixelScaleBySide: {main: config.density},
      }).packedPixelsPerNativePixel, 4);
      assert.equal(getCharacterStaticNativeSizing(record, runtime, 'sub'), null);
      const stale = structuredClone(record);
      stale.files[0].sha256 = '0'.repeat(64);
      assert.equal(getCharacterStaticNativeSizing(stale, runtime), null);
      const changed = structuredClone(runtime);
      changed.sides.main.animations[0].frames[0].texture = 'other-frame';
      assert.equal(getCharacterStaticNativeSizing(record, changed), null);
    }
    assert.notDeepEqual(CHARACTER_NATIVE_SIZING.m540_imperialdramon_fm.files, CHARACTER_NATIVE_SIZING.oc_celestyrant_battle_r10.files);
  });
}

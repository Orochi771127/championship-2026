import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { CHARACTER_NATIVE_SIZING } from "../src/data/championship/characterNativeSizing.js";
import { getCharacterStaticNativeSizing } from "../src/championship/presentation/licensedCharacterRoster.js";
import { getRaisingNativePixelScale, getRaisingNativeActorGeometry, raisingOriginalBodyScale } from "../src/championship/presentation/intRh2/raisingNativeSizing.js";
import { mountRaisingFieldPixiPresentation } from "../src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js";
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
  clear(){return this;} ellipse(){return this;} fill(){return this;} stroke(){return this;}
  circle(){return this;} poly(){return this;} rect(){return this;} roundRect(){return this;}
  moveTo(){return this;} lineTo(){return this;} star(){return this;}
}
test("real Raising scene shares native scale on resize/flip and keeps padded taps functional", async()=>{
  const {sprite,sizing}=fixture(); Object.assign(sprite,{scale:new Node().scale});
  const scene=new Node(); let onResize; let selected=null; let disposed=false; let relocated=null;
  const frame={revision:1,cages:[{cageId:"a",name:"A",region:{x:0,y:0,w:1,h:.5}},
    {cageId:"b",name:"B",region:{x:0,y:.5,w:1,h:.5}}],
    residents:[{creatureId:"egg",speciesId:"species-000",displayName:"Egg",cageId:"a",lane:{x:.5,y:.5},facing:"left"}]};
  const stage={PIXI:{Container:Node,Graphics:Node,Text:Node,ColorMatrixFilter:Node,Rectangle:class{constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}}},
    app:{screen:{width:390,height:620},stage:new Node(),ticker:{add(){},remove(){}}},
    createSceneRoot:()=>scene, markScene:()=>()=>{},attach(){},onContextLost:()=>()=>{},
    onResize(fn){onResize=fn;return()=>{};}};
  const fieldArt={field:cm01,displayObject:new Node(),update(){},dispose(){},getDiagnostics(){return{};}};
  const port=await mountRaisingFieldPixiPresentation({stage,fieldArt,reducedMotion:true,
    source:{getFrame:()=>frame,subscribe:()=>()=>{},intents:{selectCreature:id=>selected=id,relocateCreature(id,cage){relocated={id,cage};}}},
    characterBundle:{createActor:()=>({sprite,nativeSizing:sizing,controller:null}),dispose(){disposed=true;},getDiagnostics(){return{};}}});
  const root=scene.children.find(item=>item.label==="actors").children[0];
  assert.ok(scene.children.find(item=>item.label==="terrain").children.every(item=>item.visible===false),
    "legacy region outlines are hidden when real cage artwork is loaded");
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

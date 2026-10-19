import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PRODUCT_RANCH_GRID,productPlacementCells,validateProductRanch,productGridCell} from '../src/championship/cage/productRanchGrid.js';
import {WAITING_ROOM_MODULE} from '../src/championship/cage/nativeRanchLayout.js';
import {listCageDefinitions} from '../src/championship/cage/cageCatalog.js';
import {createRanchCageArtPlan} from '../src/championship/presentation/raisingRanchArtPlan.js';
import {loadRuntimeMapArtTileSet} from '../src/championship/presentation/runtimeMapArtBundle.js';
import {centerRaisingNativeY,raisingFieldViewport,raisingNativeToScreen,raisingScreenToNative,raisingNativeScreenPixels} from '../src/championship/presentation/intRh2/raisingFieldViewport.js';
const manifest=JSON.parse(fs.readFileSync('assets/production/cage/licensed-runtime-v1/manifest.json','utf8'));
const waiting={moduleId:WAITING_ROOM_MODULE,slotIndex:0};
class Container {constructor(){this.children=[];this.x=0;this.y=0;this.position={set:(x,y)=>{this.x=x;this.y=y;}};}addChild(...cs){for(const c of cs){c.parent?.removeChild(c);this.children.push(c);c.parent=this;}}removeChild(c){this.children=this.children.filter(x=>x!==c);c.parent=null;}destroy(){this.destroyed=true;}}
class Sprite extends Container{constructor(texture){super();this.texture=texture;}}
class Rectangle {constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}}
class Texture {constructor(args){Object.assign(this,args);}destroy(){}}
const loads=[],unloads=[];
const PIXI={Container,Sprite,AnimatedSprite:Sprite,Rectangle,Texture,Assets:{load:async src=>{loads.push(src);return{source:{},frame:{x:0,y:0,width:1000,height:1000}};},unload:async src=>unloads.push(src)}};
test('all100 cells share one960×880 plane and preserve stable anchors',async()=>{
  const plan=createRanchCageArtPlan({manifest,layoutVersion:PRODUCT_RANCH_GRID,placements:[waiting]});
  assert.equal(plan.wrapWidthPx,3840);assert.equal(plan.fold,undefined);assert.equal(plan.productGrid.rows,10);
  const occupied=new Set(productPlacementCells(waiting));
  const lids=plan.placements.filter(p=>p.structuralRole==='LID'&&p.slotIndex!==undefined);
  assert.equal(lids.length,100-occupied.size);
  for(const lid of lids){const cell=productGridCell(lid.slotIndex);assert.equal(lid.x,cell.x*4);assert.equal(lid.y,(cell.y-24)*4);}
  const art=await loadRuntimeMapArtTileSet({PIXI,manifest,...plan,presentationMode:plan.mode});
  assert.equal(art.field.worldWidthPx,3840);assert.equal(art.field.worldHeightPx,3520);assert.equal(art.field.wrapWidthPx,3840);
  assert.equal(art.field.fold,undefined);assert.equal(art.tileCount,plan.placements.length);
  assert.equal(loads.length,new Set(loads).size);
  await art.dispose();assert.equal(unloads.length,loads.length);
});
test('every legal facility anchor composes with matching shared shape geometry',()=>{
  let count=0;
  for(const definition of listCageDefinitions())if(definition.moduleId!==WAITING_ROOM_MODULE)for(let slotIndex=0;slotIndex<100;slotIndex++){
    const p={moduleId:definition.moduleId,slotIndex};if(!validateProductRanch([waiting,p]))continue;
    const plan=createRanchCageArtPlan({manifest,layoutVersion:PRODUCT_RANCH_GRID,placements:[waiting,p]});
    const tile=plan.placements.find(t=>t.moduleId===p.moduleId&&t.slotIndex===slotIndex);
    assert.ok(tile);assert.ok(tile.y>=-96);assert.equal(tile.sourceRect.y,0);assert.ok(tile.y+tile.sourceRect.height<=3520);
    assert.ok(tile.x+tile.sourceRect.width<=3840);count++;
  }
  assert.ok(count>800);console.log('validated grid50 art anchors',count);
});
test('native scale stays stable and pointer/actor projection wraps continuously across every row',()=>{
  const field={presentationMode:'NATIVE_RANCH',nativePixelWorldScale:4,worldWidthPx:3840,worldHeightPx:1760,wrapWidthPx:3840,
    productGrid:{columns:10,rows:5,worldWidthNative:960,worldHeightNative:440,sizingHeightNative:192}};
  for(const view of [{width:390,height:675},{width:900,height:500,referenceViewport:{width:390,height:675}}]){
    assert.equal(raisingNativeScreenPixels(field,view),2);
    const fit=raisingFieldViewport(field,view);assert.ok(fit.scrollMaxY>0);
    for(let row=0;row<5;row++)for(const turns of [-100,-2,-1,0,1,2,100]){
      const camera=turns*3840+3800,point=raisingNativeToScreen([30*4096,(32+88*row)*4096,0],field,view,camera);
      const reverse=raisingScreenToNative(point,field,view,camera);assert.ok(Math.abs(reverse.x-30)<1e-8);assert.ok(Math.abs(reverse.y-(32+88*row))<1e-8);
      const after=raisingNativeToScreen([30*4096,(32+88*row)*4096,0],field,view,camera+1);
      assert.ok(Math.abs(after.x-point.x+fit.scale)<1e-8);
    }
  }
});

test('locked access is explicit and never inferred from visible cells',()=>{
  const plan=createRanchCageArtPlan({manifest,layoutVersion:PRODUCT_RANCH_GRID,placements:[waiting],unlockedSlots:Array.from({length:14},(_,i)=>i)});
  assert.equal(plan.productGrid.lockedSlots.length,86);assert.ok(plan.productGrid.lockedSlots.includes(49));
  assert.equal(plan.placements.some(p=>p.slotIndex===49),true);
  const open=createRanchCageArtPlan({manifest,layoutVersion:PRODUCT_RANCH_GRID,placements:[waiting],unlockedSlots:Array.from({length:100},(_,i)=>i)});
  assert.deepEqual(open.productGrid.lockedSlots,[]);assert.equal(open.wrapWidthPx,plan.wrapWidthPx);
});

test('tutorial decline refocus preserves the visible egg and repeated focus is idempotent across all rows',()=>{
  const field={presentationMode:'NATIVE_RANCH',nativePixelWorldScale:4,worldWidthPx:3840,worldHeightPx:1760,wrapWidthPx:3840,
    productGrid:{sizingHeightNative:192}};
  // Actual failure trace: nativeY96, footY329 before decline, existing scroll529.
  // Resetting to the delta moved the loaded egg above the viewport.
  for(const height of [658,675,844])for(const nativeY of [32,96,96.125,208,296,384])for(const initial of [0,93,93.25,529,740]){
    let scrollY=initial;
    for(let focus=0;focus<3;focus++){
      const next=centerRaisingNativeY(field,{width:390,height,scrollY},nativeY);
      const fit=raisingFieldViewport(field,{width:390,height,scrollY:next});
      const point=raisingNativeToScreen([128*4096,nativeY*4096,0],field,{width:390,height,scrollY:next});
      assert.ok(point.y>40&&point.y<height-12,`row remains visible: ${nativeY}/${height}/${initial}`);
      assert.ok(next>=0&&next<=fit.scrollMaxY);
      if(focus>0)assert.ok(Math.abs(next-scrollY)<1e-8,'tutorial completion/refocus cannot subtract existing scroll again');
      scrollY=next;
    }
  }
});


test('top contour survives runtime loading and wrap copies without moving ground or resident bounds',async()=>{
  const plan=createRanchCageArtPlan({manifest,layoutVersion:PRODUCT_RANCH_GRID,placements:[waiting]});
  const tops=plan.placements.filter(p=>p.y<0);
  assert.ok(tops.length>0);
  for(const tile of tops){assert.equal(tile.y,-96);assert.equal(tile.sourceRect.y,0);
    assert.equal(tile.sourceRect.height,manifest.fields.find(f=>f.fieldId===tile.fieldId).worldHeightPx);}
  const art=await loadRuntimeMapArtTileSet({PIXI,manifest,...plan,presentationMode:plan.mode});
  assert.equal(art.displayObject.children.filter(c=>c.y===-96).length,tops.length*3);
  assert.equal(art.field.worldHeightPx,3520);
  assert.equal(plan.residentViewport.y,0);
  for(const view of [{width:390,height:675},{width:1280,height:720}]){
    const fit=raisingFieldViewport(art.field,{...view,scrollY:Infinity});
    const head=raisingFieldViewport(art.field,{...view,scrollY:fit.scrollMaxY});
    assert.ok(head.y-24*art.field.nativePixelWorldScale*head.scale>=0,'restored top is reachable inside existing headroom');
  }
  await art.dispose();
  const invalid={...plan,placements:plan.placements.map((p,i)=>i===0?{...p,y:-97}:p),presentationMode:plan.mode};
  await assert.rejects(loadRuntimeMapArtTileSet({PIXI,manifest,...invalid}),/TILE_SET_INTEGER_POSITION_REQUIRED/);
  await assert.rejects(loadRuntimeMapArtTileSet({PIXI,manifest,...plan,productGrid:null,presentationMode:plan.mode}),/TILE_SET_INTEGER_POSITION_REQUIRED/);
});

// Source-canvas padding never changes logical geometry or legacy sourceRect.
import {loadRuntimeMapArtField,validateRuntimeMapArtBundle} from '../src/championship/presentation/runtimeMapArtBundle.js';
const paddedManifest=JSON.parse(fs.readFileSync('assets/production/cage/final-intake-20261008/manifest.json','utf8'));
const water=paddedManifest.fields.find(f=>f.fieldId==='field_cm39_01');
function paddingPixi({badSize=false}={}) {
  class Animation extends Sprite {constructor({textures}){super(textures[0]);this.textures=textures;}gotoAndStop(i){this.texture=this.textures[i];this.frameIndex=i;}}
  const frames=new Map(paddedManifest.fields.flatMap(f=>f.frames.map(frame=>[frame.src,{width:frame.rasterWidthPx??f.worldWidthPx,height:frame.rasterHeightPx??f.worldHeightPx}])));
  return {...PIXI,AnimatedSprite:Animation,Assets:{load:async src=>({source:{},frame:{x:0,y:0,...frames.get(src),...(badSize?{width:1}:{})}}),unload:async()=>{}}};
}
test('padded field keeps nominal footprint and original anchors at fixed density',async()=>{
  for(const f of paddedManifest.fields.filter(f=>f.visualPaddingNative)){
    const art=await loadRuntimeMapArtField({PIXI:paddingPixi(),manifest:paddedManifest,fieldId:f.fieldId});
    assert.equal(art.field.worldWidthPx,f.worldWidthPx);assert.equal(art.field.worldHeightPx,f.worldHeightPx);
    assert.equal(art.field.nativeWidthPx,f.nativeWidthPx);assert.equal(art.field.nativeHeightPx,f.nativeHeightPx);
    assert.equal(art.displayObject.width,f.worldWidthPx+64);assert.equal(art.displayObject.height,f.worldHeightPx+64);
    for(const [x,y] of [[0,0],[f.worldWidthPx,0],[0,f.worldHeightPx],[f.worldWidthPx,f.worldHeightPx],[123,87]]){
      assert.equal(art.displayObject.x+x+32,x);assert.equal(art.displayObject.y+y+32,y);
    }
    assert.deepEqual(art.visualOffset,{x:-32,y:-32});await art.dispose();
  }
});
test('every sourceRect split partitions padded raster once with no gap or duplicate pixels',async()=>{
  for(const axis of ['x','y'])for(const split of [1,48,192,383]){
    const width=water.worldWidthPx,height=water.worldHeightPx;
    const rects=axis==='x'?[{x:0,y:0,width:split,height},{x:split,y:0,width:width-split,height}]:[{x:0,y:0,width,height:split},{x:0,y:split,width,height:height-split}];
    const arts=await Promise.all(rects.map(sourceRect=>loadRuntimeMapArtField({PIXI:paddingPixi(),manifest:paddedManifest,fieldId:water.fieldId,sourceRect})));
    const a=arts[0].displayObject.texture.frame,b=arts[1].displayObject.texture.frame;
    if(axis==='x'){assert.equal(a.x,0);assert.equal(a.x+a.width,b.x);assert.equal(b.x+b.width,width+64);assert.equal(a.height,height+64);}
    else {assert.equal(a.y,0);assert.equal(a.y+a.height,b.y);assert.equal(b.y+b.height,height+64);assert.equal(a.width,width+64);}
    await Promise.all(arts.map(a=>a.dispose()));
  }
});
test('interior crops exclude outer padding and preserve existing source-to-world mapping',async()=>{
  const sourceRect={x:44,y:60,width:100,height:200};
  const art=await loadRuntimeMapArtField({PIXI:paddingPixi(),manifest:paddedManifest,fieldId:water.fieldId,sourceRect});
  assert.deepEqual({...art.displayObject.texture.frame},{x:76,y:92,width:100,height:200});
  assert.equal(art.displayObject.width,100);assert.equal(art.displayObject.height,200);
  assert.equal(art.displayObject.x,0);assert.equal(art.displayObject.y,0);await art.dispose();
});
test('padded wrap split uses unchanged ground placements and synchronized phase copies',async()=>{
  const w=3840,split=192,y=-96;
  const placements=[{fieldId:water.fieldId,x:w-split,y,sourceRect:{x:0,y:0,width:split,height:448}},
    {fieldId:water.fieldId,x:0,y,sourceRect:{x:split,y:0,width:192,height:448}}];
  const productGrid={columns:10,rows:5,worldWidthNative:960,worldHeightNative:440,sizingHeightNative:192,lockedSlots:[]};
  const art=await loadRuntimeMapArtTileSet({PIXI:paddingPixi(),manifest:paddedManifest,placements,wrapWidthPx:w,presentationMode:'NATIVE_RANCH',productGrid,placementEvidence:'PADDING_TEST'});
  assert.equal(art.field.worldWidthPx,w);assert.equal(art.field.worldHeightPx,1760);
  const [a,b]=art.displayObject.children;assert.equal(a.x,w-split-32);assert.equal(a.x+a.width,w);assert.equal(b.x,0);assert.equal(b.width,224);
  assert.equal(a.y,-128);assert.equal(b.y,-128);
  const before=art.displayObject.children.map(c=>c.texture);
  art.update(water.frames[0].durationMs+1);
  assert.ok(art.displayObject.children.every((c,i)=>c.texture!==before[i]));
  for(const c of art.displayObject.children){assert.equal(c.y,-128);assert.ok(c.width===224);}
  assert.equal(art.field.placements[0].y,-96);await art.dispose();
});
test('optional padding rejects unbounded values, wrong families, phase dimensions and decoded sizes',async()=>{
  for(const patch of [{left:-1},{left:9},{top:NaN},{right:.5},{extra:1}]){
    const m=structuredClone(paddedManifest);Object.assign(m.fields.find(f=>f.fieldId===water.fieldId).visualPaddingNative,patch);
    assert.throws(()=>validateRuntimeMapArtBundle(m),/VISUAL_PADDING_INVALID/);
  }
  const family=structuredClone(paddedManifest);family.family='HUNT';assert.throws(()=>validateRuntimeMapArtBundle(family),/VISUAL_PADDING_INVALID/);
  const size=structuredClone(paddedManifest);size.fields.find(f=>f.fieldId===water.fieldId).frames[1].rasterHeightPx++;
  assert.throws(()=>validateRuntimeMapArtBundle(size),/PADDED_FRAME_SIZE_INVALID/);
  await assert.rejects(loadRuntimeMapArtField({PIXI:paddingPixi({badSize:true}),manifest:paddedManifest,fieldId:water.fieldId}),/PADDED_TEXTURE_SIZE_INVALID/);
});
test('padded art leaves all legal Grid50 plans and resident bounds identical to nominal plans',()=>{
  const nominal=structuredClone(paddedManifest);for(const f of nominal.fields){delete f.visualPaddingNative;delete f.rasterPixelsPerNative;}
  let count=0;
  for(const definition of listCageDefinitions())if(definition.moduleId!==WAITING_ROOM_MODULE)for(let slotIndex=0;slotIndex<100;slotIndex++){
    const p={moduleId:definition.moduleId,slotIndex};if(!validateProductRanch([waiting,p]))continue;
    const args={layoutVersion:PRODUCT_RANCH_GRID,placements:[waiting,p]};
    assert.deepEqual(createRanchCageArtPlan({manifest:paddedManifest,...args}),createRanchCageArtPlan({manifest:nominal,...args}));count++;
  }
  assert.equal(count,2793);
});
test('new files preserve phase timings and have provenance-linked verified hashes',()=>{
  const evidence=JSON.parse(fs.readFileSync('assets/production/cage/source-bounds-r1-20261015/provenance.json','utf8'));
  assert.equal(evidence.frames.length,4);
  for(const e of evidence.frames){assert.equal(e.previousFrame.durationMs,e.candidateFrame.durationMs);assert.equal(e.previousFrame.durationRawTicks,e.candidateFrame.durationRawTicks);assert.notEqual(e.previousFrame.src,e.candidateFrame.src);}
});

test('unpadded fields retain legacy crop dimensions and zero origin exactly',async()=>{
  for(const f of paddedManifest.fields.filter(f=>!f.visualPaddingNative)){
    const sourceRect={x:1,y:2,width:f.worldWidthPx-2,height:f.worldHeightPx-4};
    const art=await loadRuntimeMapArtField({PIXI:paddingPixi(),manifest:paddedManifest,fieldId:f.fieldId,sourceRect});
    assert.equal(art.displayObject.x,0);assert.equal(art.displayObject.y,0);assert.equal(art.visualOffset,undefined);
    assert.deepEqual({...art.displayObject.texture.frame},sourceRect);
    assert.equal(art.field.worldWidthPx,sourceRect.width);assert.equal(art.displayObject.width,sourceRect.width);
    assert.equal(art.field.worldHeightPx,sourceRect.height);assert.equal(art.displayObject.height,sourceRect.height);
    await art.dispose();
  }
});

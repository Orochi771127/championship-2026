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
test('all50 cells share one960×440 plane and preserve stable anchors',async()=>{
  const plan=createRanchCageArtPlan({manifest,layoutVersion:PRODUCT_RANCH_GRID,placements:[waiting]});
  assert.equal(plan.wrapWidthPx,3840);assert.equal(plan.fold,undefined);assert.equal(plan.productGrid.rows,5);
  const occupied=new Set(productPlacementCells(waiting));
  const lids=plan.placements.filter(p=>p.structuralRole==='LID'&&p.slotIndex!==undefined);
  assert.equal(lids.length,50-occupied.size);
  for(const lid of lids){const cell=productGridCell(lid.slotIndex);assert.equal(lid.x,cell.x*4);assert.equal(lid.y,Math.max(0,cell.y-24)*4);}
  const art=await loadRuntimeMapArtTileSet({PIXI,manifest,...plan,presentationMode:plan.mode});
  assert.equal(art.field.worldWidthPx,3840);assert.equal(art.field.worldHeightPx,1760);assert.equal(art.field.wrapWidthPx,3840);
  assert.equal(art.field.fold,undefined);assert.equal(art.tileCount,plan.placements.length);
  assert.equal(loads.length,new Set(loads).size);
  await art.dispose();assert.equal(unloads.length,loads.length);
});
test('every legal facility anchor composes with matching shared shape geometry',()=>{
  let count=0;
  for(const definition of listCageDefinitions())if(definition.moduleId!==WAITING_ROOM_MODULE)for(let slotIndex=0;slotIndex<50;slotIndex++){
    const p={moduleId:definition.moduleId,slotIndex};if(!validateProductRanch([waiting,p]))continue;
    const plan=createRanchCageArtPlan({manifest,layoutVersion:PRODUCT_RANCH_GRID,placements:[waiting,p]});
    const tile=plan.placements.find(t=>t.moduleId===p.moduleId&&t.slotIndex===slotIndex);
    assert.ok(tile);assert.ok(tile.y>=0);assert.ok(tile.y+tile.sourceRect.height<=1760);
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
  assert.equal(plan.productGrid.lockedSlots.length,36);assert.ok(plan.productGrid.lockedSlots.includes(49));
  assert.equal(plan.placements.some(p=>p.slotIndex===49),true);
  const open=createRanchCageArtPlan({manifest,layoutVersion:PRODUCT_RANCH_GRID,placements:[waiting],unlockedSlots:Array.from({length:50},(_,i)=>i)});
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

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const path=process.env.VIEWPORT_SOURCE||new URL('../src/championship/presentation/intRh2/raisingFieldViewport.js',import.meta.url);
const m=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(path)).toString('base64'));
const {raisingFieldViewport:fit,raisingNativeToScreen:screen,raisingScreenToNative:native,zoomRaisingCamera,resizeRaisingCamera}=m;
const small={presentationMode:'NATIVE_RANCH',nativePixelWorldScale:4,worldWidthPx:3840,worldHeightPx:384,wrapWidthPx:3840};
const large={...small,worldHeightPx:3520,productGrid:{sizingHeightNative:192}};
for(const zoom of [1,.7])for(const field of [small,large])test(`vertical pan ${field===small?'fitting':'large'} map at ${zoom}`,()=>{
 const view={width:390,height:675,zoom};const a=fit(field,view);
 const origin=field===small?0:a.scrollMaxY/2;
 const base=fit(field,{...view,scrollY:origin});
 const up=fit(field,{...view,scrollY:origin-30}),down=fit(field,{...view,scrollY:origin+30});
 assert.ok(up.y<base.y);assert.ok(down.y>base.y);
 assert.equal(up.x,base.x);assert.equal(down.scale,base.scale);
 const min=fit(field,{...view,scrollY:-1e8}),max=fit(field,{...view,scrollY:1e8});
 assert.equal(min.scrollY,min.scrollMinY??0);assert.equal(max.scrollY,max.scrollMaxY);
 const visible=Math.min(a.height,48*4*a.scale);
 assert.ok(min.y+a.height>=12+visible-1);assert.ok(max.y<=675-12-visible+1);
 for(const scrollY of [min.scrollY,max.scrollY,origin]){
  const v={...view,scrollY};const p=screen([100*4096,50*4096],field,v,100);
  const q=native(p,field,v,100);assert.ok(Math.abs(q.x-100)<1e-8&&Math.abs(q.y-50)<1e-8);
 }
 if(field===small){
  const oldY=Math.round(((675-12)-84*4*a.scale-a.height)/2+84*4*a.scale);
  assert.equal(a.y,oldY,'initial framing unchanged');
  const camera={cameraX:100,cameraY:up.scrollY};
  const r=resizeRaisingCamera(field,view,view,camera);assert.equal(r.cameraY,camera.cameraY);
  const z=zoomRaisingCamera(field,view,zoom,{x:195,y:337},camera);assert.equal(z.cameraY,camera.cameraY);
 }
});
const {default:vm}=await import('node:vm');
const presenter=fs.readFileSync(process.env.PRESENTER_SOURCE||new URL('../src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js',import.meta.url),'utf8');
function extract(name){const start=presenter.indexOf(`  function ${name}(`);const tail=presenter.slice(start);return tail.slice(0,tail.search(/\n  (?:async )?function /));}
function inputHarness(field,zoom,cameraY){
 const state={fieldArt:{field},view:{width:390,height:675,zoom},app:{screen:{width:390,height:675}},cameraX:500,cameraY,
 cameraDrag:{pointerId:1,startX:195,startY:337,origin:500,originY:cameraY,moved:false},drag:null,pointerPreview:null,cleanFeedback:null,
 DRAG_THRESHOLD_PX:6,raisingFieldViewport:fit,wrapRaisingCamera:m.wrapRaisingCamera,clamp:(v,a,b)=>Math.max(a,Math.min(b,v)),
 source:{intents:{panTutorial:()=>{}}},tutorialCameraOffset:0,sync:()=>{},latestFrame:{},backdrop:{},};
 vm.createContext(state);vm.runInContext(extract('moveDrag')+'\n'+extract('finishDrag'),state);return state;
}
for(const field of [small,large])for(const zoom of [1,.7])test(`actual presenter eight directions ${field===small?'fit':'large'} ${zoom}`,()=>{
 const bounds=fit(field,{width:390,height:675,zoom});const y=field===small?0:bounds.scrollMaxY/2;
 for(const [dx,dy] of [[30,0],[-30,0],[0,30],[0,-30],[30,30],[-30,30],[30,-30],[-30,-30]]){
  const h=inputHarness(field,zoom,y);h.moveDrag({pointerId:1,global:{x:195+dx,y:337+dy},pointerType:'touch'});
  assert.equal(Math.sign(h.cameraX-500),(-Math.sign(dx)||0));assert.equal(Math.sign(h.cameraY-y),Math.sign(dy));
  h.finishDrag({type:'pointercancel',pointerId:1});assert.equal(h.cameraDrag,null);assert.equal(h.pointerPreview,null);
  const before=[h.cameraX,h.cameraY];h.moveDrag({pointerId:1,global:{x:900,y:900}});assert.deepEqual([h.cameraX,h.cameraY],before);
 }
 const h=inputHarness(field,zoom,bounds.scrollMaxY);h.moveDrag({pointerId:1,global:{x:225,y:367}});
 assert.equal(h.cameraY,bounds.scrollMaxY);assert.ok(h.cameraX<500,'vertical edge must not lock horizontal axis');
 const other=inputHarness(field,zoom,y);other.moveDrag({pointerId:2,global:{x:400,y:400}});assert.equal(other.cameraY,y);
});
test('actual resident startup preserves zero fitting-board offset including folded and product-grid layouts',()=>{
 for(const zoom of [1,.7])for(const extra of [{},{productGrid:{sizingHeightNative:96}},{fold:{bandOffsetPx:100}},{expansionPreview:{bandOffsetPx:100}}]){
  for(const nativeY of [0,50,96]){
   const field={...small,...extra};const h=inputHarness(field,zoom,0);
   Object.assign(h,{cameraStarted:false,responsiveLayout:true,centerRaisingNativeY:m.centerRaisingNativeY,
    bandWorldX:(_,x)=>x*4,scrollMinY:()=>fit(field,h.view).scrollMinY??0,scrollMaxY:()=>fit(field,h.view).scrollMaxY});
   h.source.getActorFrame=()=>({positionQ12:[100*4096,nativeY*4096]});
   vm.runInContext(extract('startCameraOnResident'),h);h.startCameraOnResident({residents:[{creatureId:'a'}]});
   assert.equal(h.cameraY,0,JSON.stringify({zoom,extra,nativeY}));
  }
 }
});

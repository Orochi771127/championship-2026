import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const base=new URL('../src/championship/presentation/intRh2/',import.meta.url);
const viewportPath=process.env.CARRY_VIEWPORT_SOURCE||new URL('raisingFieldViewport.js',base);
const presenterPath=process.env.CARRY_PRESENTER_SOURCE||new URL('createRaisingFieldPixiPresentation.js',base);
const m=await import('data:text/javascript;base64,'+Buffer.from(fs.readFileSync(viewportPath)).toString('base64'));
const source=fs.readFileSync(presenterPath,'utf8');
const start=source.indexOf("    if(drag?.carried&&fieldArt?.field?.presentationMode==='NATIVE_RANCH'){");
const end=source.indexOf('    fieldArt?.update',start);
assert.ok(start>0&&end>start,'execute the actual existing ticker branch');
const edgeSource=source.slice(start,end);
function func(name){const at=source.indexOf(`  function ${name}(`),tail=source.slice(at);assert.ok(at>0);return tail.slice(0,tail.search(/\n  (?:async )?function /));}
const field={presentationMode:'NATIVE_RANCH',nativePixelWorldScale:4,worldWidthPx:3840,worldHeightPx:3520,productGrid:{sizingHeightNative:192},wrapWidthPx:3840};
function harness({zoom=1,point={x:195,y:675},wrap=true}={}){
 const c={cameraX:1000,cameraY:400,fieldArt:{field:{...field,wrapWidthPx:wrap?3840:null}},view:{width:390,height:675,zoom},
 app:{screen:{width:390,height:675},canvas:{getBoundingClientRect:()=>({left:10,top:20,width:390,height:675})}},
 drag:{carried:true,nativeHand:true,pointerId:1,creatureId:'a',lastPoint:point,moved:true,entry:{root:{}}},cameraDrag:null,
 pointerPreview:null,cleanFeedback:null,latestFrame:{},backdrop:{},source:{intents:{},getFrame:()=>({})},
 raisingFieldViewport:m.raisingFieldViewport,raisingEdgeScroll:m.raisingEdgeScroll,raisingCarryEdgeScroll:m.raisingCarryEdgeScroll,
 wrapRaisingCamera:m.wrapRaisingCamera,clamp:(v,min,max)=>Math.max(min,Math.min(max,v)),layoutFieldArt:()=>{},sync:()=>{},
 responsiveLayout:true,raisingReference:null,toolPreview:null,calls:[],drops:[],listeners:new Map(),document:{elementFromPoint:()=>c.app.canvas}};
 Object.defineProperty(c.view,'scrollY',{get:()=>c.cameraY,enumerable:true});
 c.screenToNativeGround=p=>m.raisingScreenToNative(p,c.fieldArt.field,c.view,c.cameraX);
 c.source.intents.updateHand=(id,p)=>{c.calls.push({...p});c.held={...p};};
 c.source.intents.updateCarry=()=>{};
 c.source.intents.endHand=(id,options)=>{c.drops.push({position:c.held,options});};
 c.app.canvas.addEventListener=(type,fn)=>c.listeners.set(type,fn);
 vm.createContext(c);vm.runInContext('function tickEdge(deltaMS){const ticker={deltaMS};'+edgeSource+'}\n'+func('finishDrag'),c);
 const hooks=source.slice(source.indexOf('  const cancelNativePointer='),source.indexOf('  app.ticker.add(updateAnimations)'));
 vm.runInContext(hooks,c);
 const cancel=source.slice(source.indexOf('  function cancelInput('),source.indexOf('  const cancelHiddenInput='));vm.runInContext(cancel,c);
 return c;
}
const close=(a,b)=>assert.ok(Math.abs(a-b)<1e-7,`${a} != ${b}`);
for(const zoom of [1,.7])test(`actual carried ticker scrolls all eight directions at ${zoom}`,()=>{
 for(const [x,y,dx,dy] of [[0,337,-1,0],[390,337,1,0],[195,0,0,1],[195,675,0,-1],[0,0,-1,1],[390,0,1,1],[0,675,-1,-1],[390,675,1,-1]]){
  const c=harness({zoom,point:{x,y}});c.tickEdge(1000/60);
  assert.equal(Math.sign(c.cameraX-1000),dx);assert.equal(Math.sign(c.cameraY-400),dy);
  assert.equal(c.calls.length,1);
  const p=c.held,screen=m.raisingNativeToScreen([p.x*4096,p.y*4096],c.fieldArt.field,c.view,c.cameraX);
  close(screen.x,x);close(screen.y,y);
 }
});
test('stationary lower-edge pointer keeps scrolling and release uses the updated world target',()=>{
 for(const zoom of [1,.7]){
  const c=harness({zoom});const initial=c.screenToNativeGround(c.drag.lastPoint);
  for(let i=0;i<60;i++)c.tickEdge(1000/60);
  close(c.cameraY,400-216);assert.equal(c.calls.length,60);
  const expected=c.screenToNativeGround(c.drag.lastPoint);assert.ok(expected.y>initial.y);
  assert.equal(Math.floor(c.held.y/8),Math.floor(expected.y/8),'same native ground tile after camera scroll');
  c.finishDrag({type:'pointerup',pointerId:1});assert.equal(c.drag,null);
  close(c.drops[0].position.y,expected.y);assert.equal(c.drops[0].options.cancelled,false);
  const after=[c.cameraX,c.cameraY];c.tickEdge(50);assert.deepEqual([c.cameraX,c.cameraY],after);
 }
});
test('both bounds stop only the blocked axis and wrapped horizontal behavior is retained',()=>{
 const c=harness({point:{x:390,y:675},wrap:false});c.cameraY=0;c.tickEdge(50);
 assert.equal(c.cameraY,0);assert.ok(c.cameraX>1000);
 c.cameraX=3840-(390-24)/m.raisingFieldViewport(c.fieldArt.field,c.view).scale;c.cameraY=400;
 const x=c.cameraX;c.tickEdge(50);close(c.cameraX,x);assert.ok(c.cameraY<400);
 const wrap=harness({point:{x:390,y:337}});wrap.cameraX=3839;wrap.tickEdge(50);assert.ok(wrap.cameraX<100);
 const top=harness({point:{x:195,y:0}});top.cameraY=m.raisingFieldViewport(field,top.view).scrollMaxY;
 const y=top.cameraY;top.tickEdge(50);assert.equal(top.cameraY,y);assert.equal(top.calls.length,0);
});
test('UI, outside/null pointer, non-carried actor, and pointer cancellation do not auto-scroll',()=>{
 for(const point of [null,{x:195,y:676},{x:195,y:-1},{x:-1,y:300},{x:391,y:300},{x:195,y:337}]){
  const c=harness({point});c.tickEdge(50);assert.deepEqual([c.cameraX,c.cameraY],[1000,400]);
 }
 const ui=harness();ui.document.elementFromPoint=()=>({tagName:'BUTTON'});ui.tickEdge(50);assert.equal(ui.cameraY,400);
 const idle=harness();idle.drag.carried=false;idle.tickEdge(50);assert.equal(idle.cameraY,400);
 const cancel=harness();cancel.tickEdge(16);cancel.finishDrag({type:'pointercancel',pointerId:1});
 const y=cancel.cameraY;cancel.tickEdge(50);assert.equal(cancel.cameraY,y);assert.equal(cancel.drops[0].options.cancelled,true);
 for(const event of ['lostpointercapture','pointerleave']){
  assert.ok(source.includes(`addEventListener('${event}',`));assert.ok(source.includes(`removeEventListener('${event}',`));
 }
 assert.ok(source.includes("if(drag?.pointerId===event.pointerId)drag.lastPoint=null"));
});
test('edge vector speed is refresh-rate independent, corner bounded and long-tick capped',()=>{
 assert.equal(typeof m.raisingCarryEdgeScroll,'function');
 for(const hz of [30,60,120])for(const point of [{x:195,y:675},{x:390,y:675}]){
  let x=0,y=0;for(let i=0;i<hz;i++){const d=m.raisingCarryEdgeScroll(point,{width:390,height:675},1000/hz);x+=d.x;y+=d.y;}
  close(Math.hypot(x,y),216);
 }
 const d=m.raisingCarryEdgeScroll({x:390,y:675},{width:390,height:675},10000);close(Math.hypot(d.x,d.y),10.8);
 for(const dt of [-1,0,NaN])assert.deepEqual(m.raisingCarryEdgeScroll({x:390,y:675},{width:390,height:675},dt),{x:0,y:0});
});

test('actual canvas leave/lost-capture handlers and screen cancellation stop the existing ticker',()=>{
 const leave=harness();assert.equal(typeof leave.listeners.get('pointerleave'),'function');
 leave.listeners.get('pointerleave')({pointerId:2});assert.notEqual(leave.drag.lastPoint,null);
 leave.listeners.get('pointerleave')({pointerId:1});assert.equal(leave.drag.lastPoint,null);
 leave.tickEdge(50);assert.equal(leave.cameraY,400);
 const lost=harness();assert.equal(typeof lost.listeners.get('lostpointercapture'),'function');
 lost.tickEdge(16);lost.listeners.get('lostpointercapture')({pointerId:1});
 const y=lost.cameraY;lost.tickEdge(50);assert.equal(lost.cameraY,y);assert.equal(lost.drag,null);
 assert.equal(lost.drops[0].options.cancelled,true);
 const screen=harness();screen.tickEdge(16);screen.cancelInput();const stopped=screen.cameraY;
 screen.tickEdge(50);assert.equal(screen.cameraY,stopped);assert.equal(screen.drag,null);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {raisingFieldViewport,zoomRaisingCamera,resizeRaisingCamera,raisingNativeToScreen,
  raisingScreenToNative,raisingEdgeScroll} from '../src/championship/presentation/intRh2/raisingFieldViewport.js';
import {pinchZoomLevel,bindRaisingZoomInput} from '../src/championship/presentation/intRh2/raisingZoomInput.js';
const field={presentationMode:'NATIVE_RANCH',worldWidthPx:3840,worldHeightPx:3616,
  nativePixelWorldScale:4,wrapWidthPx:3840,productGrid:{sizingHeightNative:192}};
const referenceViewport={width:390,height:675};
test('two levels retain cursor focus, drop coordinates, native scale and bounds in all three layouts',()=>{
  for(const [width,height]of [[390,844],[844,390],[1280,720]]){
    const view={width,height,referenceViewport,zoom:1},camera={cameraX:1800,cameraY:0};
    camera.cameraY=raisingFieldViewport(field,view).scrollMaxY/2;
    const point={x:width*.6,y:height*.55},before=raisingScreenToNative(point,field,{...view,scrollY:camera.cameraY},camera.cameraX);
    const next=zoomRaisingCamera(field,view,.7,point,camera),zoomed={...view,zoom:.7,scrollY:next.cameraY};
    const after=raisingScreenToNative(point,field,zoomed,next.cameraX);
    assert.ok(Math.abs(before.x-after.x)<1e-6);
    assert.ok(Math.abs(before.y-after.y)<1,'pixel-snapped Y is within one native pixel');
    const fit=raisingFieldViewport(field,zoomed,12,next.cameraX);
    assert.equal(fit.scale/raisingFieldViewport(field,view).scale,.7);
    assert.ok(next.cameraY>=0&&next.cameraY<=fit.scrollMaxY);
    for(const pos of [[0,100],[500,300],[959,880]]){
      const screen=raisingNativeToScreen(pos.map(n=>n*4096),field,zoomed,next.cameraX);
      const back=raisingScreenToNative(screen,field,zoomed,next.cameraX);
      assert.ok(Math.abs(back.x-pos[0])<1e-6&&Math.abs(back.y-pos[1])<1e-6);
    }
    const resized=resizeRaisingCamera(field,zoomed,{...zoomed,width:height,height:width},next);
    assert.ok(Number.isFinite(resized.cameraX)&&resized.cameraY>=0);
  }
});
test('pinch jitter does not change size; intentional 18 percent changes it once',()=>{
  for(const ratio of [.83,.99,1,1.1,1.17])assert.equal(pinchZoomLevel(1,ratio),1);
  assert.equal(pinchZoomLevel(1,.8),.7);
  assert.equal(pinchZoomLevel(.7,1.2),1);
});
test('carried edge scrolling advances equally at 30/60/120 Hz and is 20 percent faster',()=>{
  for(const hz of [30,60,120]){
    let total=0;for(let i=0;i<hz;i++)total+=raisingEdgeScroll({x:390,y:100},{width:390,height:675},1000/hz);
    assert.ok(Math.abs(total-216)<1e-8);
  }
  assert.equal(raisingEdgeScroll({x:390,y:100},{width:390,height:675},-1),0);
});
test('pinch owns both fingers through release, wheel burst is bounded and disposal removes listeners',()=>{
  class Surface extends EventTarget {
    getBoundingClientRect(){return {left:0,top:0};}
    clientHeight=600;
  }
  const canvas=new Surface(),win=new Surface(),changes=[];
  let level=1,cancelled=0;
  const input=bindRaisingZoomInput({canvas,window:win,getLevel:()=>level,setLevel:n=>{level=n;changes.push(n);},
    cancelGesture:()=>cancelled++,enabled:()=>true});
  const fire=(target,type,props)=>{const e=new Event(type,{cancelable:true});Object.assign(e,props);target.dispatchEvent(e);return e;};
  const p=(id,x)=>({pointerType:'touch',pointerId:id,clientX:x,clientY:100});
  fire(canvas,'pointerdown',p(1,100));fire(canvas,'pointerdown',p(2,300));
  assert.equal(cancelled,1);assert.equal(input.isActive(),true);
  fire(win,'pointermove',p(2,250));assert.deepEqual(changes,[.7]);
  fire(win,'pointermove',p(2,400));assert.deepEqual(changes,[.7],'one switch per gesture');
  assert.equal(fire(win,'pointerup',p(1,100)).defaultPrevented,true);
  assert.equal(fire(win,'pointerup',p(2,400)).defaultPrevented,true);
  assert.equal(input.isActive(),false);
  assert.equal(fire(canvas,'wheel',{deltaY:-120,ctrlKey:true}).defaultPrevented,false);
  fire(canvas,'wheel',{deltaY:-120,deltaMode:0});assert.equal(level,1);
  input.dispose();fire(canvas,'wheel',{deltaY:120,deltaMode:0});assert.equal(level,1);
  assert.equal(cancelled,2);
});

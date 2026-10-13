import test from 'node:test';
import assert from 'node:assert/strict';
import { isDesktopRaisingLayout, mountPortraitFrame } from '../src/championship/app/portraitFrame.js';
import { raisingFieldViewport, raisingNativeScreenPixels, desktopRaisingViewportWidth, raisingNativeToScreen, raisingScreenToNative } from '../src/championship/presentation/intRh2/raisingFieldViewport.js';

test('desktop Raising alone leaves the portrait frame, based on available dimensions',()=>{
 for(const activeScreen of ['TITLE','SHOP','DATABASE','BATTLE','HUNT_FIELD'])assert.equal(isDesktopRaisingLayout({width:1920,height:1080,activeScreen}),false);
 for(const [width,height] of [[1024,600],[1366,768],[1920,1080]])assert.equal(isDesktopRaisingLayout({width,height,activeScreen:'RAISING_HOME'}),true);
 for(const [width,height] of [[390,844],[1023,768],[1366,599]])assert.equal(isDesktopRaisingLayout({width,height,activeScreen:'RAISING_HOME'}),false);
 assert.equal(isDesktopRaisingLayout({width:1366,height:768,activeScreen:'RAISING_HOME',hidden:true}),false);
});

test('navigation, resize, and disposal release layout attributes and the screen observer',()=>{
 const attrs=new Set(),styles=new Map(),root={dataset:{activeScreen:'TITLE'},hidden:true};let observed,disconnected=false;
 const body={toggleAttribute(k,v){v?attrs.add(k):attrs.delete(k)},removeAttribute:k=>attrs.delete(k),style:{setProperty:(k,v)=>styles.set(k,v),removeProperty:k=>styles.delete(k)}};
 const win=Object.assign(new EventTarget(),{innerWidth:1366,innerHeight:768,MutationObserver:class{constructor(fn){observed=fn}observe(){}disconnect(){disconnected=true}}});
 const doc=Object.assign(new EventTarget(),{body,activeElement:null,getElementById:()=>root});
 const controller=mountPortraitFrame({window:win,document:doc});
 assert.ok(attrs.has('data-portrait-frame'));
 root.hidden=false;root.dataset.activeScreen='RAISING_HOME';observed();
 assert.ok(attrs.has('data-desktop-raising'));assert.ok(!attrs.has('data-portrait-frame'));assert.equal(styles.size,0);
 win.innerWidth=390;win.innerHeight=844;win.dispatchEvent(new Event('resize'));
 assert.equal(attrs.size,0);
 win.innerWidth=1920;win.innerHeight=1080;win.dispatchEvent(new Event('resize'));
 assert.ok(attrs.has('data-desktop-raising'));
 root.dataset.activeScreen='SHOP';observed();assert.ok(attrs.has('data-portrait-frame'));
 controller.dispose();controller.dispose();assert.equal(attrs.size,0);assert.equal(styles.size,0);assert.equal(disconnected,true);
});

test('desktop widens the same native zoom, caps one ring and round-trips all pointer coordinates',()=>{
 const field={worldWidthPx:2688,worldHeightPx:768,nativePixelWorldScale:4,presentationMode:'NATIVE_RANCH',wrapWidthPx:2688};
 const phone={width:390,height:675},phoneScale=raisingNativeScreenPixels(field,phone);
 const cap=desktopRaisingViewportWidth(field);assert.equal(cap,1368);
 for(const [width,height] of [[1024,400],[1366,638],[1920,950]]){
  const view={width:Math.min(width,cap),height,desktopRaising:true};
  assert.equal(raisingNativeScreenPixels(field,view),phoneScale);
  const fit=raisingFieldViewport(field,view,12,321);
  assert.equal(fit.scale*field.nativePixelWorldScale,phoneScale);
  assert.ok((view.width-24)/phoneScale>(phone.width-24)/phoneScale);
  for(const camera of [0,321,field.wrapWidthPx-1])for(const point of [{x:20,y:40},{x:400,y:96},{x:660,y:-7}]){
   const screen=raisingNativeToScreen([point.x*4096,point.y*4096],field,view,camera),native=raisingScreenToNative(screen,field,view,camera);
   assert.ok(Math.abs(native.x-point.x)<1e-8);assert.ok(Math.abs(native.y-point.y)<1e-8);
  }
 }
 assert.equal(desktopRaisingViewportWidth({worldWidthPx:400}),null,'legacy geometry keeps its existing fit');
});

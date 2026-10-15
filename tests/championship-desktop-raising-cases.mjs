import test from 'node:test';
import assert from 'node:assert/strict';
import { isDesktopRaisingLayout, isDesktopBrowseLayout, isDesktopMenuLayout, isCompactLandscapeMenuLayout, mountPortraitFrame } from '../src/championship/app/portraitFrame.js';
import { raisingFieldViewport, raisingNativeScreenPixels, desktopRaisingViewportWidth, raisingNativeToScreen, raisingScreenToNative } from '../src/championship/presentation/intRh2/raisingFieldViewport.js';

test('desktop Raising alone leaves the portrait frame, based on available dimensions',()=>{
 for(const activeScreen of ['TITLE','SHOP','DATABASE','BATTLE','HUNT_FIELD'])assert.equal(isDesktopRaisingLayout({width:1920,height:1080,activeScreen}),false);
 for(const [width,height] of [[720,390],[844,390],[932,430],[1024,600],[1366,480],[1366,768],[1920,1080]])assert.equal(isDesktopRaisingLayout({width,height,activeScreen:'RAISING_HOME'}),true);
 for(const [width,height] of [[390,844],[719,390],[844,319],[800,700]])assert.equal(isDesktopRaisingLayout({width,height,activeScreen:'RAISING_HOME'}),false);
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
 root.dataset.activeScreen='SHOP';observed();assert.ok(attrs.has('data-desktop-browse'));assert.ok(!attrs.has('data-portrait-frame'));assert.ok(!attrs.has('data-desktop-raising'));
 root.dataset.activeScreen='DATABASE';observed();assert.ok(attrs.has('data-desktop-browse'));
 win.innerHeight=480;win.dispatchEvent(new Event('resize'));assert.ok(attrs.has('data-desktop-browse'));
 root.dataset.activeScreen='BATTLE';observed();assert.ok(attrs.has('data-portrait-frame'));assert.ok(!attrs.has('data-desktop-browse'));
 controller.dispose();controller.dispose();assert.equal(attrs.size,0);assert.equal(styles.size,0);assert.equal(disconnected,true);
});

test('browse viewport is bounded to visible Shop/Database, including short desktops',()=>{
 for(const activeScreen of ['SHOP','DATABASE']) {
  for(const [width,height] of [[1024,420],[1366,480],[1366,768],[1024,1366]])assert.equal(isDesktopBrowseLayout({width,height,activeScreen}),true);
  for(const [width,height] of [[390,844],[1023,768],[1366,419]])assert.equal(isDesktopBrowseLayout({width,height,activeScreen}),false);
  assert.equal(isDesktopBrowseLayout({width:1366,height:768,activeScreen,hidden:true}),false);
 }
 for(const activeScreen of ['RAISING_HOME','TITLE','BATTLE','HUNT_FIELD','GATE_SELECT'])assert.equal(isDesktopBrowseLayout({width:1366,height:768,activeScreen}),false);
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

function battleMenuFixture(options={}) {
 const attrs=new Set(),styles=new Map(),root={dataset:{activeScreen:'BATTLE_SELECT'},hidden:false};let notify,disconnected=false;
 const body={toggleAttribute(k,v){v?attrs.add(k):attrs.delete(k)},removeAttribute:k=>attrs.delete(k),style:{setProperty:(k,v)=>styles.set(k,v),removeProperty:k=>styles.delete(k)}};
 const win=Object.assign(new EventTarget(),{innerWidth:1366,innerHeight:768,MutationObserver:class{constructor(fn){notify=fn}observe(){}disconnect(){disconnected=true}}});
 const doc=Object.assign(new EventTarget(),{body,activeElement:null,getElementById:()=>root});
 const controller=mountPortraitFrame({window:win,document:doc,...options});
 return {attrs,styles,root,win,controller,notify:()=>notify(),disconnected:()=>disconnected,
  resize(width,height){win.innerWidth=width;win.innerHeight=height;win.dispatchEvent(new Event('resize'));}};
}
test('candidate DOM battle menu reaches existing desktop grid independently of classic battle FX',()=>{
 for(const responsiveBattle of [false,true]){
  const f=battleMenuFixture({responsiveMenus:true,responsiveBattle});
  for(const [width,height] of [[1366,768],[1920,1080],[1366,480],[1024,420]]){
   f.resize(width,height);assert.equal(f.attrs.has('data-portrait-frame'),false,`${width}x${height}`);assert.equal(f.styles.size,0);
  }
  for(const [width,height,framed] of [[390,844,false],[844,390,false],[1023,420,false],[1024,419,false],[719,320,true],[844,319,true]]){
   f.resize(width,height);assert.equal(f.attrs.has('data-portrait-frame'),framed,`${width}x${height}`);
   assert.equal(f.styles.size,framed?4:isCompactLandscapeMenuLayout({width,height,activeScreen:'BATTLE_SELECT'})?2:0);
  }
  f.controller.dispose();
 }
});
test('default-off battle selection preserves frame across desktop and mobile sizes',()=>{
 for(const responsiveBattle of [false,true]){
  const f=battleMenuFixture({responsiveBattle});
  for(const [width,height] of [[1366,768],[1920,1080],[1366,480],[1024,420],[390,844],[844,390]]){
   f.resize(width,height);assert.equal(f.attrs.has('data-portrait-frame'),width>height);assert.equal(f.styles.size,width>height?4:0);
  }
  f.controller.dispose();
 }
});
test('candidate battle menu is visible-route bounded and clears frame styles on entry and disposal',()=>{
 const f=battleMenuFixture({responsiveMenus:true});
 f.root.hidden=true;f.notify();assert.ok(f.attrs.has('data-portrait-frame'));assert.equal(f.styles.size,4);
 f.root.hidden=false;f.notify();assert.equal(f.attrs.has('data-portrait-frame'),false);assert.equal(f.styles.size,0);
 for(const screen of ['TITLE','BATTLE_FIELD','BATTLE_RESULT','UNKNOWN','SETTINGS']){
  f.root.dataset.activeScreen=screen;f.notify();assert.ok(f.attrs.has('data-portrait-frame'),screen);assert.equal(f.styles.size,4);
  f.root.dataset.activeScreen='BATTLE_SELECT';f.notify();assert.equal(f.attrs.has('data-portrait-frame'),false);assert.equal(f.styles.size,0);
 }
 f.controller.dispose();f.controller.dispose();assert.equal(f.attrs.size,0);assert.equal(f.styles.size,0);assert.ok(f.disconnected());
 f.resize(844,390);f.notify();f.controller.refresh();assert.equal(f.attrs.size,0);assert.equal(f.styles.size,0);
});
test('app wires DOM menus directly to the layout opt-in, not the battle FX gate',async()=>{
 const {readFile}=await import('node:fs/promises');
 const source=await readFile(new URL('../src/championship/app/main.js',import.meta.url),'utf8');
 assert.match(source,/const RESPONSIVE_LAYOUT_CANDIDATE = [^\n]*get\('responsiveLayout'\) === 'candidate'/);
 assert.match(source,/mountPortraitFrame\(\{[^}]*responsiveMenus:RESPONSIVE_LAYOUT_CANDIDATE/);
});

const desktopMenus=['BATTLE_SELECT','CHAMPIONSHIP','DIGIMON_LIST','SCHEDULE','TAMER_INFO','HELP','GATE_SELECT','HUNT_LOADOUT','HUNT_RESULT','MEDALS'];
test('desktop DOM menu allowlist is explicit, finite, visible, and desktop-bounded',()=>{
 for(const activeScreen of desktopMenus){
  for(const [width,height] of [[1024,420],[1366,480],[1366,768],[1920,1080],[1024,1366]]){
   assert.equal(isDesktopMenuLayout({width,height,activeScreen}),true,activeScreen);
   assert.equal(isDesktopMenuLayout({width,height,activeScreen,hidden:true}),false,activeScreen);
  }
  for(const [width,height] of [[390,844],[844,390],[932,430],[1023,768],[1024,419],[NaN,768],[1366,Infinity]])
   assert.equal(isDesktopMenuLayout({width,height,activeScreen}),false,`${activeScreen} ${width}x${height}`);
 }
 for(const activeScreen of ['RAISING_HOME','SHOP','DATABASE','TITLE','BATTLE_FIELD','BATTLE_RESULT','HUNT_FIELD','CAGE_EDIT','SETTINGS','UNKNOWN',undefined])
  assert.equal(isDesktopMenuLayout({width:1366,height:768,activeScreen}),false,String(activeScreen));
});
test('all candidate desktop DOM menus enter and leave cleanly; classic FX is independent',()=>{
 for(const responsiveBattle of [false,true]){
  const f=battleMenuFixture({responsiveMenus:true,responsiveBattle});
  for(const screen of desktopMenus){
   f.root.dataset.activeScreen=screen;f.root.hidden=false;f.notify();
   for(const [width,height] of [[1024,420],[1366,480],[1366,768],[1920,1080]]){
    f.resize(width,height);assert.ok(f.attrs.has('data-desktop-menu'),screen);
    assert.equal(f.attrs.has('data-portrait-frame'),false,screen);assert.equal(f.styles.size,0);
   }
   f.root.hidden=true;f.notify();assert.equal(f.attrs.has('data-desktop-menu'),false);assert.ok(f.attrs.has('data-portrait-frame'));
   f.root.hidden=false;f.notify();assert.ok(f.attrs.has('data-desktop-menu'));assert.equal(f.styles.size,0);
   for(const [width,height] of [[390,844],[844,390],[932,430],[1023,420],[1024,419]]){
    f.resize(width,height);assert.equal(f.attrs.has('data-desktop-menu'),false,screen);
    const compact=isCompactLandscapeMenuLayout({width,height,activeScreen:screen});
    assert.equal(f.attrs.has('data-landscape-menu'),compact,screen);
    assert.equal(f.attrs.has('data-portrait-frame'),width>height&&!compact,screen);assert.equal(f.styles.size,compact?2:width>height?4:0);
   }
   f.resize(1366,768);f.root.dataset.activeScreen='UNKNOWN';f.notify();
   assert.equal(f.attrs.has('data-desktop-menu'),false);assert.ok(f.attrs.has('data-portrait-frame'));
  }
  f.controller.dispose();assert.equal(f.attrs.size,0);assert.equal(f.styles.size,0);
 }
});
test('all added desktop menus remain unchanged with the candidate disabled',()=>{
 const f=battleMenuFixture();
 for(const screen of desktopMenus){
  f.root.dataset.activeScreen=screen;f.notify();
  for(const [width,height] of [[1366,768],[1024,420],[390,844],[844,390]]){
   f.resize(width,height);assert.equal(f.attrs.has('data-desktop-menu'),false);
   assert.equal(f.attrs.has('data-portrait-frame'),width>height,screen);
  }
 }
 f.controller.dispose();
});
test('short desktop Gate scrolling is candidate-only and uses an actually loaded stylesheet',async()=>{
 const {readFile}=await import('node:fs/promises');
 const css=await readFile(new URL('../src/championship/app/vs2Styles.css',import.meta.url),'utf8');
 const html=await readFile(new URL('../championship.html',import.meta.url),'utf8');
 const candidate=css.slice(css.indexOf('/* Candidate desktop DOM menus:'));
 assert.match(html,/<link rel="stylesheet" href="\.\/src\/championship\/app\/vs2Styles\.css/);
 assert.match(candidate,/@media \(min-width: 1024px\) and \(min-height: 420px\)/);
 assert.match(candidate,/body\[data-desktop-menu\].*\[data-screen="GATE_SELECT"\].*\.cm-vs2-body--gate \{ overflow-y: auto; overflow-x: hidden; \}/);
 assert.match(candidate,/\.cm-vs2-gate3d:not\(\[data-view="fallback"\]\) \{ flex: 1 0 auto; min-height: 336px; \}/);
 assert.match(candidate,/\.cm-vs2-gate-fallback \{ flex: 0 0 auto; overflow: visible; \}/);
 assert.doesNotMatch(candidate,/HUNT_FIELD|CAGE_EDIT|BATTLE_FIELD/);
});

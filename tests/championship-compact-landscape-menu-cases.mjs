import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isCompactLandscapeMenuLayout,mountPortraitFrame} from '../src/championship/app/portraitFrame.js';
import {makeView} from './helpers/dex-conditions-ui-fixture.mjs';
const screens=['SHOP','DATABASE','BATTLE_SELECT','CHAMPIONSHIP','DIGIMON_LIST','SCHEDULE','TAMER_INFO','HELP','GATE_SELECT','HUNT_LOADOUT','HUNT_RESULT','MEDALS'];
const sizes=[[720,320],[844,390],[932,430],[1023,420],[1024,419],[1366,320]];
function fixture({width=844,height=390,screen='DATABASE',enabled=true,visual=true}={}) {
 const attrs=new Set(),styles=new Map(),root={dataset:{activeScreen:screen},hidden:false};let notify=()=>{};
 const body={style:{setProperty:(k,v)=>styles.set(k,v),removeProperty:k=>styles.delete(k)},toggleAttribute(k,v){v?attrs.add(k):attrs.delete(k);},removeAttribute:k=>attrs.delete(k)};
 const window=Object.assign(new EventTarget(),{innerWidth:width,innerHeight:height,MutationObserver:class{constructor(fn){notify=fn;}observe(){}disconnect(){}}});
 if(visual)window.visualViewport=Object.assign(new EventTarget(),{width,height,offsetTop:0,offsetLeft:0,scale:1});
 const document=Object.assign(new EventTarget(),{body,activeElement:null,getElementById:()=>root});
 const controller=mountPortraitFrame({window,document,responsiveMenus:enabled});
 return {attrs,styles,root,window,document,controller,notify:()=>notify(),
  resize(w,h){Object.assign(window,{innerWidth:w,innerHeight:h});if(window.visualViewport)Object.assign(window.visualViewport,{width:w,height:h});window.dispatchEvent(new Event('resize'));},
  focus(){document.activeElement={tagName:'INPUT',type:'text',value:'Unsubmitted',scrollIntoView(){this.reveals=(this.reveals??0)+1;}};document.dispatchEvent(new Event('focusin'));},
  blur(){document.activeElement=null;document.dispatchEvent(new Event('focusout'));}};
}
test('compact DOM gate covers only exact visible allowlist and finite bounded landscape dimensions',()=>{
 for(const activeScreen of screens)for(const [width,height] of sizes){
  assert.ok(isCompactLandscapeMenuLayout({width,height,activeScreen}),`${activeScreen} ${width}x${height}`);
  assert.equal(isCompactLandscapeMenuLayout({width,height,activeScreen,hidden:true}),false);
 }
 for(const [width,height] of [[568,320],[719,320],[844,319],[390,844],[720,561],[1366,480],[1024,420],[NaN,390],[844,Infinity]])
  assert.equal(isCompactLandscapeMenuLayout({width,height,activeScreen:'SHOP'}),false,`${width}x${height}`);
 for(const activeScreen of ['TITLE','LOGIN','CAGE_EDIT','HUNT_FIELD','RAISING_HOME','BATTLE_FIELD','BATTLE_RESULT','SETTINGS','UNKNOWN',undefined])
  assert.equal(isCompactLandscapeMenuLayout({width:844,height:390,activeScreen}),false,String(activeScreen));
});
test('all twelve compact menus keep native layout through navigation and fully clear on portrait, hidden root and disposal',()=>{
 const f=fixture();
 for(const screen of screens){
  f.root.dataset.activeScreen=screen;f.notify();
  for(const [w,h] of sizes){f.resize(w,h);assert.ok(f.attrs.has('data-landscape-menu'));assert.equal(f.attrs.has('data-portrait-frame'),false);assert.equal(f.styles.size,2);}
  f.root.hidden=true;f.notify();assert.equal(f.attrs.has('data-landscape-menu'),false);assert.ok(f.attrs.has('data-portrait-frame'));assert.equal(f.styles.size,4);
  f.root.hidden=false;f.notify();f.resize(390,844);assert.equal(f.attrs.size,0);assert.equal(f.styles.size,0);
  f.resize(844,390);
 }
 f.root.dataset.activeScreen='TITLE';f.notify();assert.ok(f.attrs.has('data-portrait-frame'));assert.equal(f.styles.size,4);
 f.controller.dispose();f.controller.dispose();f.resize(932,430);f.notify();assert.equal(f.styles.size,0);assert.equal(f.attrs.size,0);assert.equal(f.controller.isBrowseWide('DATABASE'),false);
});
test('candidate default OFF preserves short landscape frame for every menu and desktop browse stays unchanged',()=>{
 for(const screen of screens){const f=fixture({screen,enabled:false});assert.ok(f.attrs.has('data-portrait-frame'));assert.equal(f.attrs.has('data-landscape-menu'),false);assert.equal(f.styles.size,4);f.controller.dispose();}
 for(const screen of ['SHOP','DATABASE']){const f=fixture({screen,width:1366,height:480,enabled:false});assert.ok(f.attrs.has('data-desktop-browse'));assert.equal(f.attrs.has('data-portrait-frame'),false);assert.equal(f.styles.size,0);f.controller.dispose();}
});
test('compact keyboard shrink uses baseline eligibility, visible viewport bounds and stable browse decision',()=>{
 const f=fixture();f.focus();const input=f.document.activeElement;f.resize(844,210);
 assert.ok(f.attrs.has('data-landscape-menu'));assert.ok(f.attrs.has('data-desktop-browse'));assert.ok(f.controller.isBrowseWide('DATABASE'));
 assert.equal(f.styles.get('--cm-menu-viewport-height'),'210px');assert.equal(f.document.activeElement,input);assert.equal(input.value,'Unsubmitted');
 Object.assign(f.window.visualViewport,{height:180,offsetTop:25});f.window.visualViewport.dispatchEvent(new Event('resize'));
 assert.equal(f.styles.get('--cm-menu-viewport-height'),'180px');assert.equal(f.styles.get('--cm-menu-viewport-top'),'25px');
 const reveals=input.reveals;f.window.visualViewport.dispatchEvent(new Event('scroll'));assert.equal(input.reveals,reveals);
 f.blur();assert.ok(f.attrs.has('data-landscape-menu'),'focusout precedes keyboard close');f.resize(844,390);assert.ok(f.attrs.has('data-landscape-menu'));f.controller.dispose();
});
test('portrait keyboard cannot enable compact menu and genuine rotation releases its orientation guard',()=>{
 const f=fixture({width:844,height:1100});f.focus();f.resize(844,390);assert.equal(f.attrs.has('data-landscape-menu'),false);assert.equal(f.attrs.has('data-portrait-frame'),false);
 f.resize(932,430);assert.ok(f.attrs.has('data-landscape-menu'));f.resize(430,932);assert.equal(f.attrs.has('data-landscape-menu'),false);assert.equal(f.styles.size,0);f.controller.dispose();
});
test('compact visible viewport ignores pinch scaling and works without visualViewport',()=>{
 for(const visual of [true,false]){
  const f=fixture({visual});if(visual){Object.assign(f.window.visualViewport,{height:195,width:422,offsetTop:24,scale:2});f.window.visualViewport.dispatchEvent(new Event('resize'));}
  assert.equal(f.styles.get('--cm-menu-viewport-height'),'390px');assert.equal(f.styles.get('--cm-menu-viewport-top'),'0px');f.controller.dispose();
 }
});
test('database controlled DOM keeps live list, condition disclosure, draft nickname and scroll across compact/portrait resize',()=>{
 const wideLayout=({width,height})=>isCompactLandscapeMenuLayout({width,height,activeScreen:'DATABASE'});
 const f=makeView({width:844,height:390,wideLayout}),q=s=>f.root.querySelector(s);
 const catalog=q('.cm-vs2-database__catalog'),list=q('.cm-vs2-shop__list'),detail=q('.cm-vs2-database__detail'),input=q('input'),toggle=q('.cm-dex-conditions__toggle');
 assert.equal(catalog.hidden,false);assert.equal(list.hidden,false);toggle.click();input.value='Not saved';input.focus();list.scrollTop=92;detail.scrollTop=118;
 for(const [width,height] of [[932,430],[390,844],[720,320]]){
  f.resize(width,height);assert.equal(q('input'),input);assert.equal(input.value,'Not saved');assert.equal(f.document.activeElement,input);assert.equal(q('.cm-dex-conditions__toggle'),toggle);assert.equal(toggle.getAttribute('aria-expanded'),'true');assert.equal(list.scrollTop,92);assert.equal(detail.scrollTop,118);assert.equal(catalog.hidden,width<720);
 }
 assert.deepEqual(f.calls.rename,[]);f.assertUnchanged();f.dispose();assert.equal(f.listeners.get('resize').size,0);
});
test('database default resolver remains portrait and main injects the frame-owned layout without another flag parser',()=>{
 const f=makeView({width:844,height:390});assert.equal(f.root.querySelector('.cm-vs2-database__catalog').hidden,true);f.dispose();
 const main=readFileSync(new URL('../src/championship/app/main.js',import.meta.url),'utf8');
 assert.match(main,/createDatabaseView\(\{ root, source: expeditionSource, isWideLayout: \(\) => portraitFrame\.isBrowseWide\('DATABASE'\) \}\)/);
});
test('loaded candidate stylesheet gives bounded scrolling and reachable controls, without overriding hidden state or playable scenes',()=>{
 const css=readFileSync(new URL('../src/championship/app/vs2Styles.css',import.meta.url),'utf8');
 const candidate=css.slice(css.indexOf('/* Candidate compact landscape DOM menus'));
 const html=readFileSync(new URL('../championship.html',import.meta.url),'utf8');
 assert.match(html,/<link rel="stylesheet" href="\.\/src\/championship\/app\/vs2Styles\.css/);
 assert.match(candidate,/#cm-root \{\s*top: calc\(var\(--cm-menu-viewport-top, 0px\) \+ var\(--cm-screen-top\)\)/);
 assert.match(candidate,/--cm-screen-height: max\(0px, calc\(var\(--cm-menu-viewport-height, 100dvh\) - var\(--cm-screen-top\) - var\(--cm-screen-bottom\)\)\)/);
 assert.match(candidate,/grid-template-rows: auto minmax\(88px, 1fr\) auto/);
 assert.match(candidate,/\.cm-vs2-footer \{ position: sticky; bottom: 0/);
 assert.match(candidate,/\.cm-vs2-shop__detail \{ align-self: stretch; overflow-y: auto/);
 assert.match(candidate,/\.cm-vs5-shell \{ grid-template-rows: auto auto auto auto; align-content: start; overflow-y: auto/);
 assert.match(candidate,/\.cm-vs2-body > \* \{ flex-shrink: 0/);
 assert.match(candidate,/\.cm-medals__grid \{ grid-template-columns: repeat\(auto-fill, minmax\(120px, 1fr\)\)/);
 assert.match(candidate,/\.cm-sheet__panel \{ max-height: calc\(var\(--cm-menu-viewport-height/);
 assert.equal([...candidate.matchAll(/display:/g)].length,1,'only the always-present header copy changes display');
 assert.match(candidate,/\.cm-vs2-header__copy \{ display: grid/);
 assert.doesNotMatch(candidate,/HUNT_FIELD|BATTLE_FIELD|BATTLE_RESULT|CAGE_EDIT/,'no playable geometry overrides');
});

test('desktop menu keyboard keeps its original wide layout instead of switching to a portrait frame',()=>{
 const f=fixture({width:1366,height:480,screen:'BATTLE_SELECT'});f.focus();f.resize(1366,280);
 assert.ok(f.attrs.has('data-desktop-menu'));assert.equal(f.attrs.has('data-landscape-menu'),false);assert.equal(f.attrs.has('data-portrait-frame'),false);f.controller.dispose();
});

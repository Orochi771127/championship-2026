// Controlled logic/source checks; browser acceptance is reported separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isLandscapeEntryLayout,mountPortraitFrame} from '../src/championship/app/portraitFrame.js';
const source=p=>readFileSync(new URL(`../src/championship/app/${p}`,import.meta.url),'utf8');
function fixture(width=1366,height=768,enabled=true) {
 const attrs=new Set(),styles=new Map(),observed=new Set();let notify;
 const root={dataset:{activeScreen:'RAISING_HOME'},hidden:true},title={hidden:false};
 const body={style:{setProperty:(k,v)=>styles.set(k,v),removeProperty:k=>styles.delete(k)},toggleAttribute(k,v){v?attrs.add(k):attrs.delete(k);},removeAttribute:k=>attrs.delete(k)};
 const orientation=Object.assign(new EventTarget(),{type:width>height?'landscape-primary':'portrait-primary'});
 const window=Object.assign(new EventTarget(),{innerWidth:width,innerHeight:height,screen:{width,height,orientation},MutationObserver:class{constructor(fn){notify=fn;}observe(n){observed.add(n);}disconnect(){observed.clear();}}});
 window.visualViewport=Object.assign(new EventTarget(),{width,height,offsetTop:0,offsetLeft:0,scale:1});
 const document=Object.assign(new EventTarget(),{body,activeElement:null,getElementById:id=>id==='cm-root'?root:id==='cm-title'?title:null});
 const controller=mountPortraitFrame({window,document,responsiveRaising:enabled,responsiveMenus:enabled,responsiveEntry:enabled});
 return {attrs,styles,observed,root,title,window,document,controller,notify:()=>notify(),
 resize(w,h){window.innerWidth=w;window.innerHeight=h;Object.assign(window.visualViewport,{width:w,height:h});window.dispatchEvent(new Event('resize'));},
 focus(){document.activeElement={tagName:'INPUT',type:'text',value:'Draft',scrollIntoView(){this.reveals=(this.reveals??0)+1;}};document.dispatchEvent(new Event('focusin'));},
 blur(){document.activeElement=null;document.dispatchEvent(new Event('focusout'));}};
}
test('public responsive defaults on; only explicit legacy rolls back without bypassing scene gates',()=>{
 const main=source('main.js'),declaration=main.match(/^const RESPONSIVE_LAYOUT_CANDIDATE = .+;$/m)?.[0];assert.ok(declaration);
 const resolve=new Function('globalThis',`${declaration}\nreturn RESPONSIVE_LAYOUT_CANDIDATE;`);
 for(const search of ['', '?responsiveLayout=candidate','?lang=ja'])assert.equal(resolve({location:{search}}),true);
 assert.equal(resolve({location:{search:'?responsiveLayout=legacy'}}),false);
 assert.match(main,/RESPONSIVE_BATTLE_CANDIDATE = RESPONSIVE_LAYOUT_CANDIDATE && BATTLE_DYNAMIC_FX/);
 assert.match(main,/responsiveMenus:RESPONSIVE_LAYOUT_CANDIDATE, responsiveEntry:RESPONSIVE_LAYOUT_CANDIDATE/);
 assert.match(main,/enabled: RESPONSIVE_LAYOUT_CANDIDATE/);
});
test('entry threshold excludes portrait tablets and the legacy 568px fallback',()=>{
 for(const [width,height] of [[720,320],[844,390],[932,430],[1366,480],[1366,768]])assert.ok(isLandscapeEntryLayout({width,height}));
 for(const [width,height] of [[568,320],[719,390],[844,319],[390,844],[1024,1366],[720,561],[NaN,390],[844,Infinity]])assert.equal(isLandscapeEntryLayout({width,height}),false);
 assert.equal(isLandscapeEntryLayout({width:1366,height:768,hidden:true}),false);
});
test('entry visibility and route transitions clean up without remounting title controls',()=>{
 const f=fixture();assert.ok(f.attrs.has('data-landscape-entry'));assert.ok(!f.attrs.has('data-portrait-frame'));assert.ok(f.observed.has(f.title));
 f.title.hidden=true;f.root.hidden=false;f.notify();assert.ok(!f.attrs.has('data-landscape-entry'));assert.ok(f.attrs.has('data-responsive-raising'));
 f.root.hidden=true;f.title.hidden=false;f.notify();assert.ok(f.attrs.has('data-landscape-entry'));
 f.resize(390,844);assert.equal(f.attrs.size,0);f.resize(844,390);assert.ok(f.attrs.has('data-landscape-entry'));
 f.controller.dispose();f.controller.refresh();f.notify();assert.equal(f.attrs.size,0);assert.equal(f.styles.size,0);assert.equal(f.observed.size,0);
 const legacy=fixture(1366,768,false);assert.ok(legacy.attrs.has('data-portrait-frame'));assert.ok(!legacy.observed.has(legacy.title));legacy.controller.dispose();
});
test('keyboard viewport budget preserves draft and layout; pan and pinch are not counteracted',()=>{
 const f=fixture(844,390);f.focus();const input=f.document.activeElement;f.resize(844,210);assert.ok(f.attrs.has('data-landscape-entry'));
 Object.assign(f.window.visualViewport,{height:180,offsetTop:24});f.window.visualViewport.dispatchEvent(new Event('resize'));
 assert.equal(f.styles.get('--cm-visible-viewport-height'),'180px');assert.equal(f.styles.get('--cm-visible-viewport-top'),'24px');assert.equal(input.value,'Draft');
 const reveals=input.reveals;f.window.visualViewport.dispatchEvent(new Event('scroll'));assert.equal(input.reveals,reveals);
 Object.assign(f.window.visualViewport,{scale:2,width:422,height:105});f.window.visualViewport.dispatchEvent(new Event('resize'));assert.ok(!f.styles.has('--cm-visible-viewport-height'));f.controller.dispose();assert.equal(f.styles.size,0);
});
test('verified rotation after keyboard resize/blur never reframes the shortened portrait viewport',()=>{
 const f=fixture(844,1100);f.focus();f.resize(844,390);assert.ok(!f.attrs.has('data-landscape-entry'));assert.ok(!f.attrs.has('data-portrait-frame'));
 f.resize(932,430);Object.assign(f.window.screen,{width:932,height:430});f.window.screen.orientation.type='landscape-primary';f.window.screen.orientation.dispatchEvent(new Event('change'));assert.ok(f.attrs.has('data-landscape-entry'));
 f.resize(932,210);f.resize(430,210);f.blur();Object.assign(f.window.screen,{width:430,height:932});f.window.screen.orientation.type='portrait-primary';f.window.screen.orientation.dispatchEvent(new Event('change'));
 assert.ok(!f.attrs.has('data-landscape-entry'));assert.ok(!f.attrs.has('data-portrait-frame'));f.resize(430,932);assert.equal(f.attrs.size,0);f.controller.dispose();
});
test('all nine Hunt result composition rules reach desktop without applying compact viewport policy',()=>{
 const rules=source('vs2Styles.css').match(/body:is\(\[data-landscape-menu\], \[data-desktop-menu\]\)[^{]*\{[^}]*\}/g)??[];
 assert.equal(rules.length,9);assert.ok(rules.every(s=>s.includes('.cm-vs2-result__')&&!s.includes('--cm-menu-viewport')));
 assert.match(rules[0],/grid-template-areas: "portrait species" "portrait name" "portrait note" "roster roster" "release release"/);
 assert.ok(rules.some(s=>s.includes('grid-area: release')));
});
test('entry has real columns, safe overflow, contain film, and story reflow without timeline geometry changes',()=>{
 const css=source('opening.css'),wide=css.slice(css.indexOf('/* Public landscape entry:'));
 assert.match(wide,/grid-template-columns: minmax\(0, 1.1fr\) minmax\(280px, .9fr\)/);
 assert.match(wide,/justify-content: safe center/);assert.match(wide,/\.cm-title__film-video \{ object-fit: contain; \}/);
 assert.match(wide,/\.cm-opening-story__arena--2 \{ grid-column: 4; grid-row: 1; \}/);
 assert.match(wide,/\.cm-opening-story__text \{[^}]*overflow-y: auto;[^}]*pointer-events: auto;/);
 assert.doesNotMatch(wide,/\.cm-opening-story__card\s*\{[^}]*(?:top:|height:|transform:)/);
 assert.match(css,/\.cm-opening-story__card \{[^}]*top: 50%;[^}]*height: 50%;/);
});

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
test('Hunt result composition reaches desktop without inheriting compact viewport policy',()=>{
 // Gate/Hunt can add their own shared responsive rules. Test the result page's
 // required layout semantics, not a global count of all body:is selectors.
 const shared=source('vs2Styles.css').match(/body:is\(\[data-landscape-menu\], \[data-desktop-menu\]\)[^{]*\{[^}]*\}/g)??[];
 const rules=shared.filter(rule=>rule.includes('.cm-vs2-result__'));
 const ruleFor=selector=>{
  const rule=rules.findLast(rule=>rule.slice(0,rule.indexOf('{')).trim().endsWith(selector));
  assert.ok(rule,`Missing shared Hunt result rule: ${selector}`);
  assert.ok(rule.includes(':not([data-portrait-frame])'));
  assert.ok(!rule.includes('--cm-menu-viewport'));
  return rule;
 };
 assert.match(ruleFor('.cm-vs2-root[data-screen="HUNT_RESULT"] .cm-vs2-result__body'),/grid-template-areas: "portrait species" "portrait name" "portrait note" "roster roster" "release release"/);
 for(const [selector,area] of [['.cm-vs2-result__portrait-card','portrait'],['.cm-vs2-result__species','species'],['.cm-vs2-result__name','name'],['.cm-vs2-result__body > .cm-vs2-result__note','note'],['.cm-vs2-result__roster','roster'],['.cm-vs2-result__release','release']])
  assert.ok(ruleFor(selector).includes(`grid-area: ${area}`),selector);
 assert.match(ruleFor('.cm-vs2-result__body > .cm-vs2-evidence'),/grid-column: 1 \/ -1/);
 assert.match(ruleFor('.cm-vs2-result__body > *'),/min-width: 0; max-width: 100%; overflow-wrap: anywhere/);
});
test('entry is one full-bleed city scene with bounded controls, contain film, and unchanged story trajectory',()=>{
 const css=source('opening.css'),wide=css.slice(css.indexOf('/* Public landscape entry:'));
 assert.match(wide,/grid-template: none; gap: 0; padding: 0/);
 assert.match(wide,/width: 100%; height: 100%; max-height: none;[\s\S]*?background-size: cover/);
 assert.match(wide,/--cm-entry-action-width: min\(32vw, 340px\)/);
 assert.match(wide,/\.cm-title__partner \{[^}]*object-fit: contain/);
 assert.match(wide,/justify-content: flex-start/);assert.match(wide,/\.cm-title__film-video \{ object-fit: contain; \}/);
 assert.match(wide,/\.cm-opening-story__arena--2 \{ grid-column: 4; grid-row: 1; \}/);
 assert.match(wide,/\.cm-opening-story__text \{[^}]*overflow-y: auto;[^}]*pointer-events: auto;/);
 assert.doesNotMatch(wide,/\.cm-opening-story__card\s*\{[^}]*(?:top:|height:|transform:)/);
 assert.match(css,/\.cm-opening-story__card \{[^}]*top: 50%;[^}]*height: 50%;/);
});

test('landscape partners are smaller, separated and staggered on the city ground without touching controls',()=>{
 const css=source('opening.css');
 const rule=name=>{
  const selector=`body[data-landscape-entry] #cm-title > .cm-title__panel .cm-title__partner--${name}`;
  const start=css.indexOf(selector);assert.ok(start>=0);
  const block=css.slice(start,css.indexOf('}',start));
  return Object.fromEntries([...block.matchAll(/(width|height|left|right|bottom):\s*(-?[\d.]+)%/g)].map(m=>[m[1],Number(m[2])/100]));
 };
 const blaze=rule('blaze'),cloud=rule('cloud');
 assert.deepEqual(blaze,{width:.44,height:.65,left:.03,bottom:.28});
 assert.deepEqual(cloud,{width:.46,height:.70,right:.01,bottom:-.01});
 assert.ok(blaze.width<.64*.75);assert.ok(cloud.width<.60*.8);
 // Numeric box/contain-fit contract only, not screenshot or ground-contact QA.
 for(const [width,height] of [[720,320],[844,390],[1180,757],[1366,768]]){
  const compact=height<=480,left=compact?.44:.42,right=.02,bottom=compact?.05:.06,groupHeight=height*(compact?.78:.76),groupWidth=width*(1-left-right);
  const box=(p,aspect)=>{
   const w=groupWidth*p.width,h=groupHeight*p.height;
   const imageHeight=Math.min(h,w/aspect),imageWidth=imageHeight*aspect;
   const x=width*left+(p.left!==undefined?groupWidth*p.left:groupWidth*(1-p.right-p.width));
   const foot=height*(1-bottom)-groupHeight*p.bottom;
   return {left:x,right:x+w,top:foot-imageHeight,bottom:foot,imageWidth,imageHeight};
  };
  const b=box(blaze,1353/1162),c=box(cloud,1);
  assert.ok(b.right<c.left,`${width}x${height}: distinct silhouettes`);
  assert.ok(b.bottom<c.bottom,`${width}x${height}: blaze farther back`);
  assert.ok(b.top>=0&&c.top>=0&&b.bottom<=height&&c.bottom<=height,'complete contained art fits viewport');
  assert.ok(b.left>=width*.43&&c.left>=width*.70,'neither partner enters the left operation region');
 }
});

// Controlled logic/source checks; browser acceptance is reported separately.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isLandscapeEntryLayout,mountPortraitFrame} from '../src/championship/app/portraitFrame.js';
const source=p=>readFileSync(new URL(`../src/championship/app/${p}`,import.meta.url),'utf8');
test('standalone viewport authority survives all game routes, rotation, keyboard and disposal',()=>{
 const f=fixture(393,852);f.window.navigator={standalone:true};
 f.title.hidden=true;f.root.hidden=false;
 for(const screen of ['RAISING_HOME','SHOP','DATABASE','CAGE_EDIT','GATE_SELECT','HUNT_LOADOUT','HUNT_FIELD','HUNT_RESULT','BATTLE_SELECT','BATTLE_FIELD','BATTLE_RESULT','CHAMPIONSHIP','DIGIMON_LIST','SCHEDULE','TAMER_INFO','HELP','MEDALS']){
  f.root.dataset.activeScreen=screen;f.notify();assert.ok(f.attrs.has('data-web-app'));
  assert.equal(f.styles.get('--cm-app-viewport-height'),'852px',screen);
  f.resize(852,393);assert.equal(f.styles.get('--cm-app-viewport-height'),'393px',screen);
  f.resize(393,852);
 }
 f.focus();Object.assign(f.window.visualViewport,{height:420,offsetTop:18});f.window.visualViewport.dispatchEvent(new Event('resize'));
 assert.equal(f.styles.get('--cm-app-viewport-height'),'420px');
 assert.equal(f.document.activeElement.value,'Draft');
 f.controller.dispose();assert.equal(f.styles.size,0);assert.equal(f.attrs.size,0);
});
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

test('landscape partners anchor real feet to the unchanged background cover coordinates',()=>{
 const css=source('opening.css');
 const wide=css.slice(css.indexOf('/* Public landscape entry:'));
 const stageStart=wide.indexOf('body[data-landscape-entry] #cm-title > .cm-title__panel .cm-title__partners {');
 const stage=wide.slice(stageStart,wide.indexOf('}',stageStart));
 assert.match(wide,/background-size: cover; background-position: center 58%/);
 assert.match(stage,/--cm-ground-scale: max\(calc\(100cqw \/ 941\), calc\(var\(--cm-title-height\) \/ 1672\)\)/);
 assert.match(stage,/top: calc\(\(var\(--cm-title-height\) - var\(--cm-ground-scale\) \* 1672\) \* \.58\)/);
 assert.match(stage,/width: calc\(var\(--cm-ground-scale\) \* 941\)/);
 assert.match(stage,/height: calc\(var\(--cm-ground-scale\) \* 1672\)/);
 assert.match(stage,/transform: translateX\(-50%\)/);
 const readAnchors=block=>Object.fromEntries([...block.matchAll(/--cm-(blaze|cloud)-(x|y|size):\s*(\d+)/g)].map(m=>[`${m[1]}-${m[2]}`,Number(m[3])]));
 const standard=readAnchors(stage);
 assert.deepEqual(standard,{'blaze-x':450,'blaze-y':1024,'blaze-size':118,'cloud-x':575,'cloud-y':1117,'cloud-size':220});
 const compact=readAnchors(wide.slice(wide.indexOf('@media (min-aspect-ratio: 5/2)'),wide.indexOf('@media (min-aspect-ratio: 10/3)')));
 const shallowStart=wide.indexOf('@media (min-aspect-ratio: 10/3)');
 const shallow=readAnchors(wide.slice(shallowStart,wide.indexOf('}',shallowStart)));
 const ultraStart=wide.indexOf('@media (min-aspect-ratio: 9/2)');
 const ultra=readAnchors(wide.slice(ultraStart,wide.indexOf('}',ultraStart)));
 assert.match(wide,/cm-title__partner \{[^}]*height: auto; object-fit: contain;[^}]*filter: none;[^}]*animation-name: cm-title-grounded-arrive;/);
 assert.match(wide,/@keyframes cm-title-grounded-arrive \{ from \{ opacity: 0; \} to \{ opacity: 1; \} \}/);
 for(const [name,assetWidth,footX,footY] of [['blaze',1353,820,1130],['cloud',1254,515,1093]]){
  const start=wide.indexOf(`.cm-title__partner--${name} {`),block=wide.slice(start,wide.indexOf('}',start));
  assert.ok(block.includes(`var(--cm-${name}-x) - ${footX} * var(--cm-${name}-size) / ${assetWidth}`));
  assert.ok(block.includes(`var(--cm-${name}-y) - ${footY} * var(--cm-${name}-size) / ${assetWidth}`));
  assert.ok(wide.includes(`.cm-title__partner--${name}[data-title-image-state="ready"][data-title-image-visible="true"]`),'contact shadow follows existing image lifetime');
 }
 // Cover projection / transparent-padding contract only. Ground contact still
 // requires an actual screenshot review against the source bridge pixels.
 for(const [width,height] of [[720,320],[844,390],[1180,757],[1366,768],[1366,480],[1280,420],[1366,320],[1920,480],[1920,320]]){
  const anchors=width/height>=9/2?ultra:width/height>=10/3?shallow:width/height>=5/2?compact:standard;
  const scale=Math.max(width/941,height/1672),ox=(width-941*scale)/2,oy=(height-1672*scale)*.58;
  const project=(name,assetW,assetH,fx,fy)=>{
   const size=anchors[`${name}-size`],footX=anchors[`${name}-x`],footY=anchors[`${name}-y`];
   const x=ox+(footX-fx*size/assetW)*scale,y=oy+(footY-fy*size/assetW)*scale;
   const w=size*scale,h=w*assetH/assetW;
   return {x,y,w,h,footX:ox+footX*scale,footY:oy+footY*scale};
  };
  const b=project('blaze',1353,1162,820,1130),c=project('cloud',1254,1254,515,1093);
  for(const p of [b,c]){
   assert.ok(p.x>=0&&p.y>=0&&p.x+p.w<=width+.1&&p.y+p.h<=height+.1,`${width}x${height}: complete image box remains on screen`);
   assert.ok(p.footY<=height-12,`${width}x${height}: feet clear the viewport bottom`);
  }
  assert.ok(b.w<c.w*.65,'far companion has smaller perspective scale');
  assert.ok(b.footX<c.footX&&b.footY<c.footY,'far entry companion precedes foreground bridge companion');
 }
});

// Controlled DOM + canonical runtime checks. These do not measure browser layout.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {isCageLandscapeLayout, mountPortraitFrame} from '../src/championship/app/portraitFrame.js';
import {createCageEditView} from '../src/championship/app/vs4Screens.js';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {createGateHuntPresentationSource} from '../src/championship/app/gateHuntPresentationSource.js';
import {createControlledDocument} from './helpers/controlled-database-dom.mjs';

const catalog=JSON.parse(readFileSync('src/data/championship/catalogs/creature-species.r1.json','utf8'));
const {cages}=JSON.parse(readFileSync('docs/contracts/championship/raising-home-presentation.v1.json','utf8'));
const wideSizes=[[720,320],[844,390],[932,430],[1024,420],[1366,480],[1366,768],[1920,1080]];
const legacySizes=[[568,320],[719,320],[720,319],[720,561],[390,844],[820,1180],[1024,1366]];

function layoutFixture({candidate=true,width=844,height=390,root,doc}={}) {
 const attrs=new Set(),styles=new Map();let notify,disconnected=false;
 root??={dataset:{activeScreen:'CAGE_EDIT'},hidden:false};
 const body=doc?.body??{toggleAttribute(k,on){on?attrs.add(k):attrs.delete(k)},removeAttribute:k=>attrs.delete(k),style:{setProperty:(k,v)=>styles.set(k,v),removeProperty:k=>styles.delete(k)}};
 const win=Object.assign(new EventTarget(),{innerWidth:width,innerHeight:height,MutationObserver:class{constructor(fn){notify=fn}observe(){}disconnect(){disconnected=true}}});
 doc??=Object.assign(new EventTarget(),{body,activeElement:null,getElementById:()=>root});
 const controller=mountPortraitFrame({window:win,document:doc,responsiveMenus:candidate});
 return {root,body,doc,win,controller,attrs,styles,notify:()=>notify(),disconnected:()=>disconnected,
  resize(width,height){win.innerWidth=width;win.innerHeight=height;win.dispatchEvent(new Event('resize'));}};
}

test('Cage landscape has its own finite/visible/landscape gate and preserves narrow/portrait fallbacks',()=>{
 for(const [width,height] of wideSizes)assert.equal(isCageLandscapeLayout({width,height,activeScreen:'CAGE_EDIT'}),true,`${width}x${height}`);
 for(const [width,height] of [...legacySizes,[NaN,390],[844,Infinity],[720,560.1]])assert.equal(isCageLandscapeLayout({width,height,activeScreen:'CAGE_EDIT'}),false,`${width}x${height}`);
 assert.equal(isCageLandscapeLayout({width:720,height:560,activeScreen:'CAGE_EDIT'}),true,'160px column separation boundary');
 for(const activeScreen of ['TITLE','MEDALS','HUNT_FIELD','BATTLE_FIELD','RAISING_HOME',undefined])assert.equal(isCageLandscapeLayout({width:1366,height:768,activeScreen}),false);
 assert.equal(isCageLandscapeLayout({width:1366,height:768,activeScreen:'CAGE_EDIT',hidden:true}),false);
});

test('Cage candidate enters/exits without stale attributes or scaling; default remains off',()=>{
 for(const candidate of [true,false]){
  const f=layoutFixture({candidate});
  for(const [width,height] of [...wideSizes,...legacySizes,...wideSizes]){
   f.resize(width,height);
   const wide=candidate&&isCageLandscapeLayout({width,height,activeScreen:'CAGE_EDIT'});
   assert.equal(f.attrs.has('data-cage-landscape'),wide);
   assert.equal(f.attrs.has('data-portrait-frame'),!wide&&width>height);
   assert.equal(f.styles.size,!wide&&width>height?4:0);
  }
  f.root.hidden=true;f.notify();assert.equal(f.attrs.has('data-cage-landscape'),false);assert.ok(f.attrs.has('data-portrait-frame'));
  f.root.hidden=false;f.root.dataset.activeScreen='TITLE';f.notify();assert.equal(f.attrs.has('data-cage-landscape'),false);
  f.controller.dispose();f.controller.dispose();assert.equal(f.attrs.size,0);assert.equal(f.styles.size,0);assert.ok(f.disconnected());
  f.resize(844,390);f.notify();f.controller.refresh();assert.equal(f.attrs.size,0);
 }
});

async function editorFixture(t,{choice='stay'}={}) {
 const previous=globalThis.document;
 const doc=createControlledDocument();
 const events=new EventTarget();doc.addEventListener=events.addEventListener.bind(events);doc.removeEventListener=events.removeEventListener.bind(events);
 globalThis.document=doc;
 const store=new Map();const storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,String(v)),removeItem:k=>store.delete(k)};
 const app=createChampionshipStandaloneApp({storage,catalog,cages});
 await app.newGame();app.openCageEdit();
 const source=createGateHuntPresentationSource(app);
 const root=doc.createElement('main');root.id='cm-root';root.dataset.activeScreen='CAGE_EDIT';doc.body.append(root);
 let asks=0;
 const view=createCageEditView({root,source,askToLeave:async()=>{asks++;return choice;}});
 const layout=layoutFixture({root,doc});
 t.after(async()=>{layout.controller.dispose();view.dispose();await app.dispose();globalThis.document=previous;});
 return {app,source,root,view,layout,store,asks:()=>asks,paint(){view.render(source.getFrame());}};
}

function cells(root){return root.querySelectorAll('.cm-vs2-cage-slot').map(n=>({slot:n.dataset.slotIndex,deck:n.dataset.deck,left:n.style.left,top:n.style.top,width:n.style.width}));}
function boardNodes(root){return ['.cm-cage-board-panel','.cm-cage-inventory-panel','.cm-vs2-cage-board','.cm-cage-annex-board','.cm-cage-board-scroll'].map(selector=>root.querySelector(selector));}
function verifyResizeKeepsDraft(f){
 const before=JSON.stringify(f.source.getFrame().cageEdit),save=JSON.stringify([...f.store]),geometry=cells(f.root),nodes=boardNodes(f.root);
 for(const [width,height] of [...wideSizes,...legacySizes,...wideSizes]){
  f.layout.resize(width,height);
  assert.equal(JSON.stringify(f.source.getFrame().cageEdit),before,'resize never mutates selected module / draft / dirty / verdict');
  assert.equal(JSON.stringify([...f.store]),save,'resize never writes save');
  assert.deepEqual(cells(f.root),geometry,'per-cell inline coordinates stay native');
  assert.deepEqual(boardNodes(f.root),nodes,'resize never remounts boards or scroll panes');
 }
}

test('controlled resize preserves editor nodes, selected facility, draft, preview annex and untouched scroll properties',async t=>{
 const f=await editorFixture(t);
 const boardPanel=f.root.querySelector('.cm-cage-board-panel'),inventoryPanel=f.root.querySelector('.cm-cage-inventory-panel');
 assert.deepEqual(boardPanel.children.map(n=>n.className),['cm-cage-board-hint','cm-cage-board-scroll','cm-cage-expansion']);
 assert.deepEqual(inventoryPanel.children.map(n=>n.className),['cm-cage-facilities','cm-vs2-cage-tray']);
 assert.equal(f.root.querySelector('.cm-cage-annex-board').dataset.preview,'true');
 assert.equal(f.root.querySelectorAll('.cm-cage-annex-bay').length,20);
 const initial=JSON.stringify(f.source.getFrame().cageEdit.placements);
 f.root.querySelector('.cm-vs2-cage-slot[data-slot-index="8"]').click();f.paint();
 assert.equal(f.source.getFrame().cageEdit.dirty,true);
 assert.notEqual(JSON.stringify(f.source.getFrame().cageEdit.placements),initial);
 const tray=f.root.querySelector('.cm-vs2-cage-tray__item');tray.click();f.paint();
 assert.equal(f.root.querySelector('.cm-vs2-cage-tray__item').getAttribute('aria-pressed'),'true');
 boardPanel.scrollTop=46;inventoryPanel.scrollTop=84;
 verifyResizeKeepsDraft(f);
 assert.equal(boardPanel.scrollTop,46);assert.equal(inventoryPanel.scrollTop,84);
 f.root.querySelector('.cm-vs2-cage-slot[data-slot-index="10"]').click();f.paint();
 assert.equal(f.source.getFrame().cageEdit.lastVerdict.reason,'PLACED');
 assert.equal(f.source.getFrame().cageEdit.placements.find(p=>p.moduleId==='championship:2026:cage:0').slotIndex,10,'native button still sends the original slot index');
 verifyResizeKeepsDraft(f);
 f.root.querySelector('.cm-vs2-action--primary').click();f.paint();
 assert.equal(f.source.getFrame().cageEdit.dirty,false);
});

test('granted annex keeps its distinct deck targets and coordinates through candidate resize',async t=>{
 const f=await editorFixture(t);
 f.source.intents.grantRanchExpansion();f.paint();
 const annex=f.root.querySelector('.cm-cage-annex-board');
 assert.equal(annex.dataset.preview,'false');
 assert.equal(annex.querySelectorAll('.cm-vs2-cage-slot').length,10);
 assert.ok(annex.querySelectorAll('.cm-vs2-cage-slot').every(n=>n.dataset.deck==='1'));
 f.source.intents.removeCagePlacement('championship:2026:cage:0');f.source.intents.selectCageModule('championship:2026:cage:0');f.paint();
 verifyResizeKeepsDraft(f);
 f.root.querySelector('.cm-vs2-cage-slot[data-slot-index="20"]').click();f.paint();
 assert.equal(f.source.getFrame().cageEdit.lastVerdict.reason,'PLACED');
 assert.equal(f.source.getFrame().cageEdit.placements.find(p=>p.moduleId==='championship:2026:cage:0').slotIndex,20);
 verifyResizeKeepsDraft(f);
});

for(const choice of ['stay','discard','apply'])test(`dirty Cage ${choice} path is unchanged after landscape/portrait rotations`,async t=>{
 const f=await editorFixture(t,{choice});
 f.source.intents.removeCagePlacement('championship:2026:cage:0');f.source.intents.selectCageModule('championship:2026:cage:0');f.source.intents.placeCageAt(10);f.paint();
 verifyResizeKeepsDraft(f);
 const back=f.root.querySelector('.cm-vs2-footer').children[0];back.click();back.click();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(f.asks(),1,'repeated Back cannot duplicate pending confirmation');
 if(choice==='stay')assert.equal(f.source.getFrame().cageEdit.dirty,true);
 else {
  assert.equal(f.source.getFrame().screen,'RAISING_HOME');
  f.source.intents.openCageEdit();
  assert.equal(f.source.getFrame().cageEdit.placements.find(p=>p.moduleId==='championship:2026:cage:0').slotIndex,choice==='apply'?10:8);
 }
});

function cageLandscapeSection(css) {
 const startMarker='/* Candidate Cage landscape:',endMarker='/* Desktop DOM menus:';
 const start=css.indexOf(startMarker),end=css.indexOf(endMarker,start+startMarker.length);
 assert.ok(start>=0&&end>start,'Cage section must have explicit ordered boundaries');
 assert.equal(css.lastIndexOf(startMarker),start,'Cage start marker must be unique');
 assert.equal(css.lastIndexOf(endMarker),end,'Cage end marker must be unique');
 return css.slice(start,end);
}
function assertCageGeometryPreserved(candidate) {
 assert.doesNotMatch(candidate.replace(/\/\*[\s\S]*?\*\//g,''),/transform:|zoom:|\.cm-vs2-cage-slot\s*\{|\.cm-cage-annex-board\s*\{|\.cm-vs2-cage-board\s*\{/,'no geometry override or scaling');
}

test('candidate reflow is in a loaded stylesheet, keeps board geometry and gives both panes bounded scrolling',()=>{
 const css=readFileSync('src/championship/app/vs2Styles.css','utf8');
 const html=readFileSync('championship.html','utf8');
 const candidate=cageLandscapeSection(css);
 assert.match(html,/<link rel="stylesheet" href="\.\/src\/championship\/app\/vs2Styles\.css/);
 assert.match(css,/\.cm-vs2-cage-board \{[^}]*width: 508px; height: 102px;/);
 assert.match(css,/\.cm-cage-annex-board \{[^}]*width: 270px; height: 102px;[^}]*margin: -14px 0 0;/);
 assert.match(css,/\.cm-vs2-cage-slot \{[^}]*width: 48px;[^}]*height: 56px;/);
 assert.match(css,/\.cm-cage-annex-board, \.cm-cage-annex-label\) \{ margin-left: max\(0px, calc\(\(100% - 508px\) \/ 2\)\);/);
 assert.match(candidate,/\.cm-cage-board-panel, \.cm-cage-inventory-panel \{ display: contents; \}/);
 assert.match(candidate,/grid-template-areas: "board inventory" "status status"/);
 assert.match(candidate,/grid-template-rows: minmax\(0, 1fr\) auto/);
 assert.match(candidate,/overflow: auto;[\s\S]*overscroll-behavior: contain/);
 assert.match(candidate,/\.cm-cage-board-scroll \{ margin-inline: 0; padding: var\(--sp-2\); touch-action: pan-x pan-y; \}/);
 assert.match(candidate,/\.cm-vs2-shop__status:empty \{ display: none; \}/);
 assertCageGeometryPreserved(candidate);
});

test('Cage boundary fails closed and excludes unrelated Database centering only',()=>{
 const css=readFileSync('src/championship/app/vs2Styles.css','utf8');
 for(const marker of ['/* Candidate Cage landscape:','/* Desktop DOM menus:'])
  assert.throws(()=>cageLandscapeSection(css.replace(marker,'/* renamed boundary:')),/explicit ordered boundaries/);
 assert.throws(()=>cageLandscapeSection(css+'\n/* Desktop DOM menus: duplicate */'),/must be unique/);
 const unrelated='\n.cm-vs2-root[data-screen="DATABASE"] .cm-dex-hero__image { transform: translateX(-14%); }';
 assert.equal(cageLandscapeSection(css+unrelated),cageLandscapeSection(css));
 assertCageGeometryPreserved(cageLandscapeSection(css+unrelated));
});
for(const bad of [
 '.cm-cage-board-panel { transform: translateX(1px); }',
 '.cm-cage-board-panel { zoom: .9; }',
 '.cm-vs2-cage-slot { width: 47px; }',
 '.cm-cage-annex-board { height: 101px; }',
 '.cm-vs2-cage-board { width: 507px; }'
])test(`Cage candidate still rejects actual geometry regression: ${bad}`,()=>{
 const css=readFileSync('src/championship/app/vs2Styles.css','utf8');
 const injected=css.replace('/* Desktop DOM menus:',bad+'\n/* Desktop DOM menus:');
 assert.throws(()=>assertCageGeometryPreserved(cageLandscapeSection(injected)),/no geometry override or scaling/);
});

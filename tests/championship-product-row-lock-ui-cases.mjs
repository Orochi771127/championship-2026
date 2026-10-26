import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createCageEditRuntime} from '../src/championship/cage/cageEditRuntime.js';
import {PRODUCT_RANCH_SLOT_COUNT} from '../src/championship/cage/productRanchGrid.js';
import {listCageDefinitions} from '../src/championship/cage/cageCatalog.js';
import {originalStartingRanch} from '../src/championship/cage/nativeRanchLayout.js';
import {createHexWorldBoard} from '../src/championship/app/hexWorldEditor.js';
import {uiText} from '../src/championship/text/uiText.js';
import {LOCALES,setLocale} from '../src/championship/text/locale.js';
// Hex cage world (2026-10-26): land is a capacity, not a positional lock. The editor
// shows every lattice position as open and offers one purchase control for the next
// land row; buying land never moves a position or a placement.
const editorSource=readFileSync(new URL('../src/championship/app/hexWorldEditor.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/championship/app/vs2Styles.css',import.meta.url),'utf8');
const owned=listCageDefinitions().map(d=>d.shopRecordIndex).filter(Number.isInteger);
const fresh=()=>createCageEditRuntime({initializeOriginal:true,publicTestGrid:true});
const legacy=()=>createCageEditRuntime({publicTestGrid:true,initialTamerRank:9,snapshot:{...originalStartingRanch(),layoutVersion:'NATIVE_DECKS_V1',expansion:{version:1,decks:2,grant:'PROTOTYPE_NON_PAID'}}});
const event={stopPropagation(){},preventDefault(){}};
function fakeDocument(){
 const make=tag=>({tag,className:'',textContent:'',dataset:{},style:{},attributes:{},children:[],hidden:false,disabled:false,handlers:{},
  setAttribute(k,v){this.attributes[k]=String(v);},getAttribute(k){return this.attributes[k];},
  append(...items){for(const item of items)this.children.push(...(item.fragment?item.children:[item]));},
  replaceChildren(...items){this.children=[];this.append(...items);},
  addEventListener(k,fn){this.handlers[k]=fn;},click(){if(!this.disabled)this.handlers.click?.(event);},remove(){},
  querySelectorAll(){return walk(this).filter(n=>n!==this&&n.dataset.preview!==undefined);},
  getBoundingClientRect:()=>({left:0,top:0,width:800,height:600})});
 return {createElement:make,createDocumentFragment:()=>Object.assign(make('#fragment'),{fragment:true})};
}
const walk=node=>[node,...node.children.flatMap(walk)];
// The real hex editor is painted with real runtime frames and localized labels.
function render(runtime,diamonds=10000){
 const before=runtime.toSave(),cage={...runtime.getFrame(owned,9),testDiamonds:diamonds},actions=[];
 const intents={buyRanchTestRow:row=>actions.push(['buy',row]),removeCagePlacement:id=>actions.push(['remove',id]),
  placeCageAt:slot=>actions.push(['place',slot]),moveCagePlacement:(id,slot)=>actions.push(['move',id,slot])};
 const board=createHexWorldBoard({source:{intents},openLandPurchase:row=>actions.push(['open',row]),doc:fakeDocument()});
 board.paint(cage);
 assert.deepEqual(runtime.toSave(),before,'presentation must not mutate the canonical save');
 const nodes=walk(board.element);
 return{cage,actions,nodes,cells:nodes.filter(n=>n.dataset.slotIndex!==undefined),locks:nodes.filter(n=>n.dataset.lockedTestRow!==undefined)};
}
const coordinates=view=>view.cells.map(c=>[c.dataset.slotIndex,c.style.left,c.style.top]);

test('new 20-cell ranch shows one land control for the next row, never per-cell locks',()=>{
 const view=render(fresh());
 assert.equal(view.cells.length,PRODUCT_RANCH_SLOT_COUNT);assert.equal(view.cage.landCapacity,20);
 assert.ok(view.cells.every(c=>c.dataset.unlocked==='true'&&!c.disabled&&c.textContent!=='🔒'));
 assert.equal(view.locks.length,1);const [lock]=view.locks;
 assert.equal(lock.dataset.lockedTestRow,'2');assert.equal(lock.tag,'button');assert.equal(lock.attributes['aria-haspopup'],'dialog');
 assert.equal(lock.textContent,uiText('開放土地 +{n} 格',{n:10}));
 assert.ok(view.nodes.some(n=>n.textContent===uiText('可用土地 {n} 格',{n:20})));
});

test('old 40-cell QA ranch migrates to 40 cells of land and offers row 5 for 1000 diamonds',()=>{
 const view=render(legacy());
 assert.equal(view.cage.landCapacity,40);
 assert.equal(view.locks.length,1);assert.equal(view.locks[0].dataset.lockedTestRow,'4');
 assert.equal(view.locks[0].attributes['aria-label'],uiText('CAGE_TEST_BUY_ROW',{row:5,count:10,price:1000}));
});

test('only the land control opens confirmation; the editor never buys directly',()=>{
 const view=render(fresh());
 for(const cell of view.cells.filter(n=>n.dataset.filled==='false'))cell.click();
 assert.equal(view.actions.some(([kind])=>kind==='buy'||kind==='open'),false);
 view.locks[0].click();
 assert.deepEqual(view.actions.filter(([kind])=>kind==='open'),[['open',2]]);
 assert.equal((editorSource.match(/buyRanchTestRow/g)??[]).length,0);
});

test('purchases only grow land capacity without moving any position or placement',()=>{
 const runtime=fresh(),before=render(runtime),anchors=coordinates(before),placements=runtime.toSave().placements;
 for(const row of [2,3,4,5,6,7,8,9]){
  runtime.applyTestRowPurchase(row,owned,9);
  const after=render(runtime,10000-(row-1)*1000);
  assert.deepEqual(coordinates(after),anchors);assert.deepEqual(runtime.toSave().placements,placements);
  assert.equal(after.cage.landCapacity,10*(row+1));
  assert.deepEqual(after.locks.map(n=>n.dataset.lockedTestRow),row<9?[String(row+1)]:[]);
 }
 const restored=createCageEditRuntime({snapshot:runtime.toSave(),publicTestGrid:true,initialTamerRank:9});
 assert.equal(render(restored,7000).locks.length,0);assert.deepEqual(coordinates(render(restored)),anchors);
});

test('a refused purchase leaves the land control available for an authorized retry',()=>{
 const runtime=fresh(),first=render(runtime,0);first.locks[0].click();
 const after=render(runtime,0);assert.deepEqual(coordinates(after),coordinates(first));
 assert.equal(after.locks.length,1);assert.equal(after.cage.landCapacity,20);
});

test('land control uses the existing complete price, count and test-currency copy in every locale',()=>{
 try{for(const locale of LOCALES){setLocale(locale);const [lock]=render(fresh()).locks;
  assert.equal(lock.attributes['aria-label'],uiText('CAGE_TEST_BUY_ROW',{row:3,count:10,price:1000}));
  assert.match(lock.attributes['aria-label'].replace(/[^0-9]/g,''),/1000/);assert.doesNotMatch(lock.attributes['aria-label'],/CAGE_TEST_BUY_ROW|\{(?:row|count|price)\}/);
 }}finally{setLocale('zh-Hant');}
});

test('row treatment keeps a 44px target and focus ring, and no line',()=>{
 assert.match(css,/\.cm-vs2-cage-board\[data-product-grid="true"\] \.cm-cage-row-lock\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px/s);
 assert.match(css,/\.cm-hexworld__buy-land\s*\{[^}]*min-width:\s*44px;[^}]*min-height:\s*44px/s);
 assert.match(css,/\.cm-cage-row-lock:focus-visible/);assert.match(css,/\.cm-vs2-action:focus-visible/);
 assert.doesNotMatch(css,/\.cm-cage-row-lock::before/);
 assert.doesNotMatch(css,/\.cm-cage-row-purchase/);
});

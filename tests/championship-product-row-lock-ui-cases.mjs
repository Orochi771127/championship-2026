import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createCageEditRuntime} from '../src/championship/cage/cageEditRuntime.js';
import {PRODUCT_RANCH_GRID,productGridCell} from '../src/championship/cage/productRanchGrid.js';
import {TAMER_RANK_SLOT_TABLE,listCageDefinitions} from '../src/championship/cage/cageCatalog.js';
import {originalStartingRanch} from '../src/championship/cage/nativeRanchLayout.js';
import {uiText,setLabel,setText} from '../src/championship/text/uiText.js';
import {LOCALES,setLocale} from '../src/championship/text/locale.js';
const sourceText=readFileSync(new URL('../src/championship/app/vs4Screens.js',import.meta.url),'utf8');
const css=readFileSync(new URL('../src/championship/app/vs2Styles.css',import.meta.url),'utf8');
const start=sourceText.indexOf('    board.replaceChildren();');
const renderSource=sourceText.slice(start,sourceText.indexOf('    facilities.replaceChildren();',start));
const owned=listCageDefinitions().map(d=>d.shopRecordIndex).filter(Number.isInteger);
const fresh=()=>createCageEditRuntime({initializeOriginal:true,publicTestGrid:true});
const legacy=()=>createCageEditRuntime({publicTestGrid:true,initialTamerRank:9,snapshot:{...originalStartingRanch(),layoutVersion:'NATIVE_DECKS_V1',expansion:{version:1,decks:2,grant:'PROTOTYPE_NON_PAID'}}});
function node(tag='div',className='',text=''){
 return {tag,className,textContent:text,dataset:{},style:{},attributes:{},children:[],disabled:false,
  setAttribute(k,v){this.attributes[k]=v;},getAttribute(k){return this.attributes[k];},
  append(...items){this.children.push(...items);},replaceChildren(...items){this.children=items;},
  addEventListener(k,fn){this[k+'Handler']=fn;},click(){if(!this.disabled)this.clickHandler?.();}};
}
// The real screen renderer is executed with real runtime frames and localized
// labels. The art stub supplies the existing product editor's half-scale
// coordinates, not a second placement model or a state-writing test hook.
function render(runtime,diamonds=10000){
 const before=runtime.toSave(),cage={...runtime.getFrame(owned,9),testDiamonds:diamonds};
 const board=node(),annexBoard=node(),expansionControls=node(),actions=[];
 const art=cage.slots.map(slot=>{const p=productGridCell(slot.slotIndex);return{slotIndex:slot.slotIndex,x:4+p.x/2,y:p.y/2,image:null};});
 vm.runInNewContext(renderSource,{cage,board,annexBoard,expansionControls,annexLabel:node(),boardScroll:node(),boardHint:node(),
  PRODUCT_RANCH_GRID,NATIVE_RANCH_LAYOUT:'NATIVE_ANCHORS_V1',TAMER_RANK_SLOT_TABLE,element:node,uiText,setLabel,setText,
  rowPurchase:{open:row=>actions.push(['open',row])},cageEditorArtCells:()=>art,mode:'PLAYER',ranchExpansionPrototypeVisible:()=>false,
  cageUiName:(id,name)=>name??'',cageUiSummary:()=>'',source:{intents:{buyRanchTestRow:row=>actions.push(['buy',row]),removeCagePlacement:id=>actions.push(['remove',id]),placeCageAt:id=>actions.push(['place',id])}}});
 assert.deepEqual(runtime.toSave(),before,'presentation must not mutate the canonical save');
 return{cage,board,actions,cells:board.children.filter(n=>n.dataset.slotIndex!==undefined),locks:board.children.filter(n=>n.dataset.lockedTestRow!==undefined),ctas:expansionControls.children.filter(n=>n.dataset.buyTestRow!==undefined)};
}
function coordinates(view){return view.cells.map(c=>[c.dataset.slotIndex,c.style.left,c.style.top]);}

test('new 20-cell ranch has eight clickable icons with no lower purchase block, never 30 per-cell locks',()=>{
 const view=render(fresh());
 assert.equal(view.cells.length,100);assert.equal(view.locks.length,8);assert.equal(view.ctas.length,0);
 assert.deepEqual(view.locks.map(n=>n.dataset.lockedTestRow),['2','3','4','5','6','7','8','9']);
 for(const lock of view.locks){assert.equal(lock.children.length,1);assert.equal(lock.children[0].textContent,'🔒');assert.equal(lock.attributes['aria-haspopup'],'dialog');assert.equal(lock.tag,'button');}
 assert.deepEqual(view.locks.map(n=>[n.style.left,n.style.top]),Array.from({length:8},(_,i)=>[i%2?'246px':'222px',`${94+i*44}px`]));
 for(const cell of view.cells.filter(n=>n.dataset.unlocked==='false')){assert.equal(cell.disabled,true);assert.equal(cell.textContent,'');}
 assert.equal(view.cells.filter(n=>n.textContent==='🔒').length,0);
});

test('old 40-cell QA ranch has six remaining row icons and one 1000-diamond accessible lock',()=>{
 const view=render(legacy());
 assert.equal(view.cells.filter(c=>c.dataset.unlocked==='true').length,40);
 assert.equal(view.locks.length,6);assert.equal(view.locks[0].dataset.lockedTestRow,'4');assert.equal(view.ctas.length,0);
 assert.equal(view.locks[0].dataset.lockedTestRow,'4');assert.equal(view.locks[0].attributes['aria-label'],uiText('CAGE_TEST_BUY_ROW',{row:5,count:10,price:1000}));
});

test('only the row lock opens confirmation; no direct purchase intent in render',()=>{
 const view=render(fresh());
 for(const cell of view.cells.filter(n=>n.dataset.unlocked==='false')){cell.click();cell.clickHandler?.();}
 assert.deepEqual(view.actions,[]);
 for(const lock of view.locks)lock.click();
 assert.deepEqual(view.actions,Array.from({length:8},(_,i)=>['open',i+2]));
 assert.equal((renderSource.match(/buyRanchTestRow/g)??[]).length,0);
});

test('purchases remove only their row indicator without moving any slot or placement',()=>{
 const runtime=fresh(),before=render(runtime),anchors=coordinates(before),placements=runtime.toSave().placements;
 for(const row of [2,3,4,5,6,7,8,9]){
  runtime.applyTestRowPurchase(row,owned,9);
  const after=render(runtime,10000-(row-1)*1000);
  assert.deepEqual(coordinates(after),anchors);assert.deepEqual(runtime.toSave().placements,placements);
  assert.equal(after.locks.length,9-row);assert.equal(after.ctas.length,0);
  assert.equal(after.cells.filter(c=>c.dataset.unlocked==='true').length,10*(row+1));
  assert.equal(after.locks.some(n=>n.dataset.lockedTestRow===String(row)),false);
 }
 const restored=createCageEditRuntime({snapshot:runtime.toSave(),publicTestGrid:true,initialTamerRank:9});
 assert.equal(render(restored,7000).locks.length,0);assert.deepEqual(coordinates(render(restored)),anchors);
});

test('a refused purchase leaves its row indicator and CTA available for an authorized retry',()=>{
 const runtime=fresh(),first=render(runtime,0);first.locks[0].click();
 const after=render(runtime,0);assert.deepEqual(coordinates(after),coordinates(first));
 assert.equal(after.locks.length,8);assert.equal(after.ctas.length,0);assert.equal(after.cage.unlockedCount,20);
});

test('row CTA uses the existing complete price, count and test-currency copy in every locale',()=>{
 try{for(const locale of LOCALES){setLocale(locale);const view=render(fresh());for(let i=0;i<8;i++){
  assert.equal(view.locks[i].attributes['aria-label'],uiText('CAGE_TEST_BUY_ROW',{row:i+3,count:10,price:1000}));
  assert.match(view.locks[i].attributes['aria-label'].replace(/[^0-9]/g,''),/1000/);assert.doesNotMatch(view.locks[i].attributes['aria-label'],/CAGE_TEST_BUY_ROW|\{(?:row|count|price)\}/);
 }}}finally{setLocale('zh-Hant');}
});

test('row treatment is product-scoped with a 44px target, focus ring and no line',()=>{
 assert.match(css,/\.cm-vs2-cage-board\[data-product-grid="true"\] \.cm-cage-row-lock\s*\{[^}]*width:\s*44px;[^}]*height:\s*44px/s);
 assert.match(css,/\.cm-cage-row-lock:focus-visible/);
 assert.doesNotMatch(css,/\.cm-cage-row-lock::before/);
 assert.doesNotMatch(css,/\.cm-cage-row-purchase/);
});

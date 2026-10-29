import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {ControlledEvent, createControlledDocument, simulateButtonKeyActivation} from './helpers/controlled-database-dom.mjs';

// Controlled DOM only: real, unmodified view/function bodies; synthetic catalog,
// projection and art transport. No browser gestures, layout or device claim.
const screenUrl = new URL('../src/championship/app/vs4Screens.js', import.meta.url);
const sourceText = readFileSync(screenUrl, 'utf8');
function makeFixture({locked = false, viewable = false, selected = null, wide = false, rows = null} = {}) {
  const entries = rows ?? [10, 8, 20, 99].map((speciesIndex, i) => ({speciesIndex,
    speciesId:`species-${speciesIndex}`, displayCode:`TEST${i}`, displayName:`SECRET-${speciesIndex}`,
    numberingStageIndex:i === 3 ? 4 : 3, kind:'REGULAR', state:locked && i === 1 ? 'UNDISCOVERED' : 'REGISTERED',
    viewable, source:'HISTORY', instances:[], evolutionRoutes:[]}));
  const inputSnapshot = JSON.stringify(entries);
  const document = createControlledDocument();
  const root = document.createElement('main'); document.body.append(root);
  let selection = '';
  document.getSelection = () => ({toString:() => selection});
  // Existing fixture has no Document event target. Forward to its root node.
  document.addEventListener = (...args) => document.documentElement.addEventListener(...args);
  document.removeEventListener = (...args) => document.documentElement.removeEventListener(...args);
  const calls = {select:[], art:[], hero:[], story:[], leave:0, rename:0};
  const pending = [];
  let frame, view;
  const project = id => ({screen:'DATABASE', database:{entries, registeredCount:entries.filter(e=>e.state==='REGISTERED').length,
    slotCount:entries.length, selected:entries.find(e=>e.speciesIndex===id) ?? null}});
  frame = project(selected);
  const source = {getFrame:() => frame, intents:{
    selectDatabaseSpecies(id) { calls.select.push(id); frame = project(id); view?.render(frame); },
    leaveScreen() { calls.leave++; }, renameDatabaseInstance() { calls.rename++; }
  }};
  const deny = () => { throw new Error('Forbidden save/network/timer'); };
  const context = vm.createContext({document, console, URLSearchParams, AbortController, Promise,
    innerWidth:390, innerHeight:844, location:{search:''},
    addEventListener(){}, removeEventListener(){},
    fetch:deny, setTimeout:deny, setInterval:deny, localStorage:new Proxy({}, {get:deny}),
    databaseDisplayRows:(book, stage) => book.entries.filter(e => stage === null || (stage === 'ART' ? e.kind === 'ILLUSTRATION' : e.numberingStageIndex === stage)),
    getDatabaseDisplayEntry:id => entries.find(e=>e.speciesIndex===id) ?? null,
    databaseHeroPortrait(id) { calls.hero.push(id); return {src:`hero-${id}.webp`, width:100, height:120}; },
    databaseHeroSilhouette:()=>null,
    databaseStory(id) { calls.story.push(id); return `story-${id}`; },
    databaseStoryHeading:()=>'Story', databaseVerifiedData:()=>null, databaseVerifiedHeading:()=>'Data',
    databaseIllustrationText:key=>key, speciesName:(id,name)=>name ?? `name-${id}`, generationName:id=>`stage-${id}`,
    setLabel(){}, setText(){}, uiText:(text)=>String(text), isDesktopBrowseLayout:()=>wide,
    originalDatabaseIcon:()=>null, openingEggChoices:()=>entries.filter(e=>e.kind==='EGG').map(e=>({...e,formalName:`egg-${e.speciesIndex}`,src:'egg.webp'})),
    openingEggText:()=>({nameNote:''}),
    loadAcceptedDatabasePortrait(id,{signal}) { calls.art.push(id); return new Promise((resolve,reject)=>pending.push({id,signal,resolve,reject})); },
    PRODUCT_GIVEN_NAME_MAX_LENGTH:24, VS2_UI_AUTHORITY:'FIXTURE', VS2_PRESENTATION_MODES:{PLAYER:'PLAYER',DEVELOPER:'DEVELOPER'},
    RANCH_EXPANSION_DECK_SLOTS:5, NATIVE_RANCH_LAYOUT:{}, PRODUCT_RANCH_GRID:{}, prefersReducedMotion:()=>true,
    cageUiImage:()=>null, cageUiLidImage:()=>null, shopCageUiImage:()=>null, cageEditorArtCells:()=>[],
    cageUiName:()=>'', shopCageUiName:()=>'', cageUiSummary:()=>'', ranchBoardCell:()=>({}), openRanchExpansionPreview(){},
    shopGoodsPresentation:()=>null, getHuntCatalogItem:()=>null, showChoiceDialog(){}, shopDescriptionText:()=>'', shopItemName:()=>''
  });
  const executable = sourceText.replace(/^import\s[\s\S]*?;\s*/gm,'').replace(/\bexport\s+(?=(?:async\s+)?function\b|const\b|let\b|class\b)/g,'');
  new vm.Script(`${executable}\nglobalThis.makeDatabase=createDatabaseView;`,{filename:screenUrl.pathname}).runInContext(context);
  view = context.makeDatabase({root,source,isWideLayout:()=>wide});
  const q = selector => root.querySelector(selector);
  const detail = q('.cm-vs2-database__detail'), list = q('.cm-vs2-shop__list');
  let clock = 1000;
  const touch = (x=200,y=100,id=1) => ({clientX:x,clientY:y,identifier:id});
  function dispatch(type,{target=detail,touches=[],changedTouches=[],timeStamp=clock++,cancelable=true,...rest}={}) {
    const event = new ControlledEvent(type,{target,touches,changedTouches,timeStamp,cancelable,...rest});
    target.dispatchEvent(event); return event;
  }
  function swipe(dx=-80,dy=0,{target=detail,startX=200,startY=100,id=1}={}) {
    const start = touch(startX,startY,id), finish = touch(startX+dx,startY+dy,id);
    dispatch('touchstart',{target,touches:[start]});
    const move = dispatch('touchmove',{target,touches:[finish]});
    dispatch('touchend',{target,changedTouches:[finish]});
    return move;
  }
  return {root,document,view,source,calls,pending,detail,list,q,touch,dispatch,swipe,entries,
    current:()=>frame.database.selected?.speciesIndex ?? null,
    open(id) { q(`[data-species-index="${id}"]`).click(); },
    stage(value) { const select=q('select');select.value=String(value);select.dispatchEvent(new ControlledEvent('change')); },
    selectText(value) { selection=value;document.documentElement.dispatchEvent(new ControlledEvent('selectionchange')); },
    checkUnchanged() { assert.equal(JSON.stringify(entries),inputSnapshot);assert.equal(calls.rename,0);assert.equal(calls.leave,0); },
    dispose() { view.dispose(); }
  };
}

test('left/right use visible catalog order and existing intent; exactly one selection per gesture', () => {
  const f=makeFixture();f.open(10);f.swipe();assert.equal(f.current(),8);
  f.swipe();assert.equal(f.current(),20);f.swipe(80);assert.equal(f.current(),8);
  f.dispatch('touchend',{changedTouches:[f.touch(280)]});
  assert.deepEqual(f.calls.select,[10,8,20,8]);f.checkUnchanged();f.dispose();
});

for (const [dx,dy,expected] of [[-55,0,10],[-56,0,8],[55,0,10],[0,80,10],[-60,40,10],[-80,25,10],[-80,24,8]]) {
  test(`distance and axis gate (${dx}, ${dy})`,()=>{
    const f=makeFixture();f.open(10);f.swipe(dx,dy);assert.equal(f.current(),expected);f.dispose();
  });
}

test('vertical or diagonal start cannot become a swipe; direction reversal cancels',()=>{
  for (const first of [f=>f.touch(200,115),f=>f.touch(214,110),f=>f.touch(220,100)]) {
    const f=makeFixture();f.open(10);
    f.dispatch('touchstart',{touches:[f.touch()]});
    f.dispatch('touchmove',{touches:[first(f)]});
    f.dispatch('touchmove',{touches:[f.touch(120)]});
    f.dispatch('touchend',{changedTouches:[f.touch(120)]});
    assert.equal(f.current(),10);f.dispose();
  }
});

test('first/last boundaries stop; filter retains order; single-row filter stops',()=>{
  const f=makeFixture();f.stage(3);f.open(10);f.swipe(80);assert.deepEqual(f.calls.select,[10]);
  f.swipe();f.swipe();assert.equal(f.current(),20);f.swipe();assert.equal(f.current(),20);
  assert.deepEqual(f.calls.select,[10,8,20]);assert.equal(f.q('select').value,'3');
  f.stage(4);f.open(99);const before=f.calls.select.length;f.swipe();f.swipe(80);
  assert.equal(f.calls.select.length,before);assert.equal(f.current(),99);f.dispose();
});

test('original list scroll, filter, focused item and simulated button keyboard contract survive return',()=>{
  for (const wide of [false,true]) {
    const f=makeFixture({wide});f.stage(3);f.list.scrollTop=321;
    const opener=f.q('[data-species-index="10"]');opener.focus();simulateButtonKeyActivation(opener,'Enter');
    const listNodes=[...f.list.children];f.detail.scrollTop=90;f.swipe();
    assert.equal(f.detail.scrollTop,0);assert.equal(f.list.scrollTop,321);assert.deepEqual(f.list.children,listNodes);
    assert.equal(f.document.activeElement,f.detail.querySelector('h2'));
    f.root.dispatchEvent(new ControlledEvent('keydown',{key:'Escape'}));
    assert.equal(f.current(),null);assert.equal(f.list.scrollTop,321);assert.equal(f.q('select').value,'3');
    assert.equal(f.document.activeElement,opener);f.checkUnchanged();f.dispose();
  }
});

test('rapid consecutive swipes read current state without queues or duplicate intents',()=>{
  const f=makeFixture();f.open(10);
  for (let i=0;i<8;i++) {f.swipe();f.swipe(80);}
  assert.deepEqual(f.calls.select,[10,...Array.from({length:8},()=>[8,10]).flat()]);
  assert.equal(f.current(),10);f.checkUnchanged();f.dispose();
});

test('locked identity remains redacted; explicit viewable uses the same existing reveal rule',()=>{
  for (const viewable of [false,true]) {
    const f=makeFixture({locked:true,viewable});f.open(10);f.swipe();assert.equal(f.current(),8);
    assert.equal(f.detail.textContent.includes('SECRET-8'),viewable);
    assert.equal(f.detail.textContent.includes('story-8'),viewable);
    assert.equal(f.calls.hero.includes(8),viewable);assert.equal(f.calls.art.includes(8),viewable);
    assert.equal(f.calls.story.includes(8),viewable);f.checkUnchanged();f.dispose();
  }
});

test('egg and illustration rows use existing view-local egg and species selection paths',()=>{
  const rows=[{speciesIndex:0,kind:'EGG',numberingStageIndex:0,displayCode:'E0',state:'NOT_TRACKED'},
    {speciesIndex:1,kind:'EGG',numberingStageIndex:0,displayCode:'E1',state:'NOT_TRACKED'},
    {speciesIndex:301,kind:'ILLUSTRATION',numberingStageIndex:3,displayCode:'I1',viewable:true}];
  const f=makeFixture({rows});f.open(0);assert.ok(f.detail.textContent.includes('egg-0'));
  f.swipe();assert.ok(f.detail.textContent.includes('egg-1'));f.swipe();assert.equal(f.current(),301);
  f.swipe(80);assert.ok(f.detail.textContent.includes('egg-1'));assert.deepEqual(f.calls.select,[null,null,301,null]);f.dispose();
});

test('touchcancel and pointercancel abort with no late completion',()=>{
  for (const type of ['touchcancel','pointercancel']) {
    const f=makeFixture();f.open(10);f.dispatch('touchstart',{touches:[f.touch()]});
    f.dispatch('touchmove',{touches:[f.touch(120)]});f.dispatch(type);
    f.dispatch('touchend',{changedTouches:[f.touch(120)]});assert.equal(f.current(),10);f.dispose();
  }
});

test('multitouch/pinch, including a second contact outside the detail, cancels until a fresh gesture',()=>{
  const f=makeFixture();f.open(10);
  f.dispatch('touchstart',{touches:[f.touch()]});
  f.dispatch('touchstart',{target:f.document.body,touches:[f.touch(),f.touch(280,100,2)]});
  f.dispatch('touchmove',{touches:[f.touch(120)]});f.dispatch('touchend',{changedTouches:[f.touch(120)]});
  assert.equal(f.current(),10);
  f.dispatch('touchstart',{touches:[f.touch(),f.touch(280,100,2)]});
  f.dispatch('touchmove',{touches:[f.touch(120),f.touch(300,100,2)]});
  f.dispatch('touchend',{changedTouches:[f.touch(120),f.touch(300,100,2)]});assert.equal(f.current(),10);
  f.swipe();assert.equal(f.current(),8);f.dispose();
});

test('finger identifier changes, remaining contacts, long press and uncancelable scrolling abort',()=>{
  for (const mode of ['id','remaining','long','uncancelable','scroll','defaultPrevented','endOnly']) {
    const f=makeFixture();f.open(10);f.dispatch('touchstart',{touches:[f.touch()],timeStamp:1000});
    if (mode==='scroll') f.detail.scrollTop=5;
    if (mode!=='endOnly') f.dispatch('touchmove',{touches:[f.touch(120,100,mode==='id'?2:1)],
      timeStamp:mode==='long'?1801:1050,cancelable:mode!=='uncancelable',defaultPrevented:mode==='defaultPrevented'});
    f.dispatch('touchend',{touches:mode==='remaining'?[f.touch(300,100,2)]:[],changedTouches:[f.touch(120)],timeStamp:1100});
    assert.equal(f.current(),10,mode);f.dispose();
  }
});

test('selection before or during touch, contextmenu and image drag cancel navigation',()=>{
  for (const mode of ['before','during','contextmenu','dragstart']) {
    const f=makeFixture();f.open(10);if(mode==='before')f.selectText('selected');
    f.dispatch('touchstart',{touches:[f.touch()]});
    if(mode==='during') {f.selectText('selected');f.selectText('');}
    if(mode==='contextmenu'||mode==='dragstart')f.dispatch(mode);
    f.dispatch('touchmove',{touches:[f.touch(120)]});f.dispatch('touchend',{changedTouches:[f.touch(120)]});
    assert.equal(f.current(),10);f.dispose();
  }
});

test('controls, links, editable and draggable ancestors retain their touch defaults',()=>{
  for (const [tag,attribute,value] of [['button'],['a'],['input'],['select'],['textarea'],['label'],['summary'],
    ['div','contenteditable','true'],['div','draggable','true'],['div','role','button'],['div','role','slider'],['div','data-no-dex-swipe','']]) {
    const f=makeFixture();f.open(10);const control=f.document.createElement(tag),child=f.document.createElement('span');
    if(attribute)control.setAttribute(attribute,value);control.append(child);f.detail.append(control);
    const move=f.swipe(-80,0,{target:child});assert.equal(move.defaultPrevented,false,tag);assert.equal(f.current(),10,tag);f.dispose();
  }
});

test('ordinary loaded hero image and its container both allow left/right swipe selection',()=>{
  for (const selector of ['.cm-dex-hero__image','.cm-dex-hero']) {
    const f=makeFixture();f.open(10);
    const image=f.q('.cm-dex-hero__image');image.naturalWidth=100;image.naturalHeight=120;image.onload();
    assert.equal(image.hidden,false);assert.equal(f.q('.cm-dex-hero').dataset.art,'ready');
    assert.equal(f.swipe(-80,0,{target:f.q(selector)}).defaultPrevented,true);assert.equal(f.current(),8);
    const nextImage=f.q('.cm-dex-hero__image');nextImage.naturalWidth=100;nextImage.naturalHeight=120;nextImage.onload();
    f.swipe(80,0,{target:f.q(selector)});assert.equal(f.current(),10);
    assert.deepEqual(f.calls.select,[10,8,10]);f.checkUnchanged();f.dispose();
  }
});

test('images inside interactive controls and explicitly draggable images cannot trigger selection',()=>{
  for (const [tag,attribute,value] of [['button'],['a'],['div','role','button'],['div','role','link'],
    ['div','data-no-dex-swipe',''],['img','draggable','true']]) {
    const f=makeFixture();f.open(10);const image=f.q('.cm-dex-hero__image');
    const control=tag==='img'?image:f.document.createElement(tag);
    if(attribute)control.setAttribute(attribute,value);
    if(control!==image){control.append(image);f.detail.append(control);}
    const move=f.swipe(-80,0,{target:image});assert.equal(move.defaultPrevented,false);
    assert.deepEqual(f.calls.select,[10]);f.checkUnchanged();f.dispose();
  }
});

test('vertical/diagonal movement or pinch starting on the ordinary hero image never navigates',()=>{
  for (const mode of ['vertical','diagonal','pinch']) {
    const f=makeFixture();f.open(10);const target=f.q('.cm-dex-hero__image');
    if(mode==='pinch') {
      f.dispatch('touchstart',{target,touches:[f.touch()]});
      f.dispatch('touchstart',{target,touches:[f.touch(),f.touch(280,100,2)]});
      const move=f.dispatch('touchmove',{target,touches:[f.touch(120),f.touch(310,100,2)]});
      assert.equal(move.defaultPrevented,false);
      f.dispatch('touchend',{target,changedTouches:[f.touch(120),f.touch(310,100,2)]});
    } else {
      const move=f.swipe(mode==='vertical'?0:-60,mode==='vertical'?80:40,{target});
      assert.equal(move.defaultPrevented,false);
    }
    assert.deepEqual(f.calls.select,[10]);f.checkUnchanged();f.dispose();
  }
});

test('native image dragstart cancels an otherwise eligible portrait swipe',()=>{
  const f=makeFixture();f.open(10);const target=f.q('.cm-dex-hero__image');
  f.dispatch('touchstart',{target,touches:[f.touch()]});
  f.dispatch('touchmove',{target,touches:[f.touch(180)]});
  const drag=f.dispatch('dragstart',{target});assert.equal(drag.defaultPrevented,false);
  f.dispatch('touchmove',{target,touches:[f.touch(120)]});
  f.dispatch('touchend',{target,changedTouches:[f.touch(120)]});
  assert.deepEqual(f.calls.select,[10]);f.checkUnchanged();f.dispose();
});

test('viewport edges, vertical scroll, mouse and pen keep native behavior; only clear horizontal movement prevents default',()=>{
  const f=makeFixture();f.open(10);
  for (const startX of [10,24,366,380]) {const e=f.swipe(startX<100?80:-80,0,{startX});assert.equal(e.defaultPrevented,false);}
  assert.equal(f.swipe(0,80).defaultPrevented,false);assert.equal(f.swipe(-60,40).defaultPrevented,false);
  for (const pointerType of ['mouse','pen']) {
    for (const type of ['pointerdown','pointermove','pointerup']) f.dispatch(type,{pointerType,clientX:type==='pointerdown'?200:100});
  }
  assert.equal(f.current(),10);assert.equal(f.swipe().defaultPrevented,true);assert.equal(f.current(),8);f.dispose();
});

test('external detail selection/return during a gesture cannot switch a later character',()=>{
  for (const id of [20,null]) {
    const f=makeFixture();f.open(10);f.dispatch('touchstart',{touches:[f.touch()]});
    f.dispatch('touchmove',{touches:[f.touch(120)]});f.source.intents.selectDatabaseSpecies(id);
    f.dispatch('touchend',{changedTouches:[f.touch(120)]});assert.equal(f.current(),id);f.dispose();
  }
});

test('changing the filter mid-gesture cancels even when the selected detail is unchanged',()=>{
  const f=makeFixture();f.open(10);f.dispatch('touchstart',{touches:[f.touch()]});
  f.dispatch('touchmove',{touches:[f.touch(120)]});f.stage(3);
  f.dispatch('touchend',{changedTouches:[f.touch(120)]});assert.equal(f.current(),10);f.dispose();
});

test('late hero callbacks and accepted portrait promises cannot repaint the new detail; errors stay local',async()=>{
  const f=makeFixture();f.open(10);
  const oldHero=f.q('.cm-dex-hero__image'),oldHolder=f.q('.cm-dex-hero'),oldLoad=oldHero.onload,oldError=oldHero.onerror;
  const oldPending=f.pending[0];assert.equal(oldPending.id,10);
  f.swipe();f.swipe();assert.equal(f.current(),20);
  assert.equal(oldPending.signal.aborted,true);assert.equal(oldHero.onload,null);assert.equal(oldHero.onerror,null);assert.equal(oldHero.src,undefined);
  oldHero.naturalWidth=100;oldHero.naturalHeight=120;oldLoad();oldError();assert.equal(oldHolder.dataset.art,'loading');
  oldPending.resolve({src:'stale-10.webp'});f.pending[1].reject(new Error('late transport failure'));
  const currentPending=f.pending[2];currentPending.resolve({src:'current-20.webp'});
  await Promise.resolve();await Promise.resolve();
  const portrait=f.q('.cm-dex-portrait__image');assert.equal(portrait.src,'current-20.webp');
  portrait.onerror();assert.equal(f.q('.cm-dex-portrait').dataset.art,'missing');assert.equal(f.current(),20);
  const hero=f.q('.cm-dex-hero__image');hero.onerror();assert.equal(f.q('.cm-dex-hero').dataset.art,'missing');
  assert.deepEqual(f.calls.art,[10,8,20]);f.checkUnchanged();f.dispose();
});

test('disposed view releases gesture listeners and rejects pending portrait completion',async()=>{
  const f=makeFixture();f.open(10);f.dispatch('touchstart',{touches:[f.touch()]});
  const pending=f.pending[0];f.dispose();assert.equal(pending.signal.aborted,true);
  f.dispatch('touchmove',{touches:[f.touch(120)]});f.dispatch('touchend',{changedTouches:[f.touch(120)]});
  pending.resolve({src:'late.webp'});await Promise.resolve();
  assert.deepEqual(f.calls.select,[10]);assert.equal(f.root.childElementCount,0);
  for(const listeners of f.detail.listeners.values())assert.equal(listeners.size,0);
  for(const listeners of f.document.documentElement.listeners.values())assert.equal(listeners.size,0);
});

import { createTransientHint, consumeRaisingHintDuration, TOOL_HINT_MS } from '../src/championship/app/transientHint.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {getLocale} from '../src/championship/text/locale.js';
import {getProductExtension} from '../src/championship/contracts/productSpeciesExtensions.js';
import {speciesName} from '../src/championship/text/zhHant.js';
import {productFormText} from '../src/championship/text/productFormText.js';
import {createChampionshipPixiStage} from '../src/championship/presentation/championshipPixiStage.js';
import {raisingNativeScreenPixels, raisingNativeToScreen, raisingScreenToNative} from '../src/championship/presentation/intRh2/raisingFieldViewport.js';
const read = path => fs.readFileSync(new URL(`../src/championship/${path}`, import.meta.url), 'utf8');

// Source contracts are deliberately separate from browser/CSS geometry QA.
test('responsive field has no sidebar or host width cap; portrait/native sizes are not restyled', () => {
  const css = read('app/intRh2Styles.css');
  const responsive = css.slice(css.indexOf('/* Owner 2026-10-15: the habitat'));
  assert.match(responsive, /body\[data-responsive-raising\]\[data-desktop-raising\] \.int-rh2-root \.int-rh2-field-frame \{\s*left: var\(--safe-left\); right: var\(--safe-right\); min-height: 0;/);
  assert.match(responsive, /\.int-rh2-field-host \{\s*width: 100%; max-width: none;/);
  assert.doesNotMatch(responsive, /--cm-raising-aside|--cm-ranch-unique-width/);
  assert.match(css, /body\[data-desktop-raising\] \.int-rh2-field-host \{\s*max-width: var\(--cm-ranch-unique-width, 100%\);/);
  assert.match(css, /\.int-rh2-companion__toggle \{ display: none; \}/);
  assert.match(responsive, /\.int-rh2-companion__toggle \{ display: grid; \}/);
  assert.doesNotMatch(responsive, /\.int-rh2-field-host[^}]*transform|\.int-rh2-field-host[^}]*scale\(/);
});

test('floating controls retain input holes and legacy shared-bar rules; Raising overlay overrides are tested separately', () => {
  const css = read('app/intRh2Styles.css');
  const responsive = css.slice(css.indexOf('/* Owner 2026-10-15: the habitat'));
  assert.match(responsive, /\.int-rh2-companion\[data-open="false"\] \{[^}]*top: 8px; bottom: auto;[^}]*max-height: calc\(100% - 16px\);[^}]*pointer-events: none;/s);
  assert.match(responsive, /\.int-rh2-companion button,[\s\S]*?\.int-rh2-vitals \{ pointer-events: auto; \}/);
  assert.match(responsive, /\.int-rh2-hint \{[^}]*pointer-events: none;/);
  assert.match(responsive, /\.cm-tutorial-guidance \{[^}]*left: calc\(8px \+ var\(--safe-left\)\); right: auto;/);
  assert.match(responsive, /\.int-rh2-mail-icon \{[^}]*left: calc\(8px \+ var\(--safe-left\)\); right: auto; top: auto; bottom: 8px;/);
  assert.match(responsive, /\.int-rh2-companion\[data-expanded="false"\] > \.int-rh2-vitals \{ display: none; \}/);
  assert.doesNotMatch(responsive, /\.int-rh2-companion\[data-expanded="false"\][^}]*__(?:copy|nav|close)[^}]*display: none/);
  assert.doesNotMatch(responsive, /z-index:/, 'no promotion above existing toolbar/dialog/lifecycle layers');
  const shared = read('app/styles.css');
  assert.match(shared, /body\[data-status-bar="on"\] #cm-root \{ top: var\(--cm-screen-top\); \}/);
  assert.match(shared, /body\[data-toolbar="on"\] #cm-root \{ bottom: var\(--cm-screen-bottom\); \}/);
});

class Element extends EventTarget {
  constructor(tag, doc) { super(); this.tagName=tag; this.ownerDocument=doc; this.children=[]; this.dataset={}; this.attributes={}; this.hidden=false; this.className=''; this.style={setProperty(){},removeProperty(){}}; this.clientWidth=1180; this.clientHeight=600; this.offsetHeight=112; this.classList={toggle(){},add(){},remove(){}}; }
  append(...nodes) { for(const n of nodes){n.parentNode=this; this.children.push(n);} }
  appendChild(n) { this.append(n); }
  replaceChildren(...nodes) { this.children=[]; this.append(...nodes); }
  setAttribute(k,v) { this.attributes[k]=String(v); }
  getAttribute(k) { return this.attributes[k]??null; }
  removeAttribute(k) { delete this.attributes[k]; }
  focus() { this.ownerDocument.activeElement=this; }
  showModal() { this.open=true; }
  close() { this.open=false; this.dispatchEvent(new Event('close')); }
  remove() { if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this); }
  getBoundingClientRect() { return {width:this.clientWidth,height:this.clientHeight}; }
}
const find=(root,cls)=>root.children.flatMap(n=>[...(n.className?.split(' ').includes(cls)?[n]:[]),...find(n,cls)]);
async function fixture() {
  const document={createElement:tag=>new Element(tag,document)};
  const context=vm.createContext({originalCageLocationArt:()=>null,createTransientHint, consumeRaisingHintDuration, TOOL_HINT_MS,document,Date,console,setTimeout,clearTimeout,productFormText,getLocale,getProductExtension,
    setText:(node,text)=>node.textContent=text,setLabel:(node,key,text)=>node.setAttribute(key,text),uiText:s=>String(s),retranslate:()=>{},
    isNativeRanchLayout:()=>true,assembledHudArt:()=>null,prefersReducedMotion:()=>false,speciesName,raisingMessageText:()=>'',raisingMessageSender:()=>'',downloadSaveBackup:()=>({key:'ok'})});
  vm.runInContext(read('app/raisingHomeP1RView.js').replace(/^import .*;$/gm,'').replace(/export async function /,'async function ')+'\nthis.mount=createRaisingHomeP1RView;',context);
  const root=new Element('div',document),calls=[];
  let frame={revision:1,residents:[{creatureId:'a',displayName:'Partner A',speciesId:'a',stats:{currentHp:8,maxHp:10,maxTp:4},displayCapacityG:3},{creatureId:'b',displayName:'Partner B',speciesId:'b',stats:{currentHp:9,maxHp:10,maxTp:4},displayCapacityG:4}],selection:{creatureId:'a'},ranch:{layoutVersion:1},save:{phase:'CLEAN'}};
  let listener,host,disposed=false,mounts=0;
  const source={getFrame:()=>frame,subscribe:fn=>{listener=fn;return()=>listener=null;},intents:{selectEvolutionChoice:(id,target)=>calls.push(['evolution',id,target]),selectCreature:id=>calls.push(['select',id]),relocateCreature:()=>{},careForCreature:()=>{},requestSave:()=>{}}};
  const view=await context.mount({root,source,mountField:async({host:fieldHost})=>{host=fieldHost;mounts++;return {render:()=>{},dispose:()=>disposed=true,focusResident:id=>calls.push(['focus',id])};}});
  return {root,document,view,calls,get host(){return host;},get mounts(){return mounts;},get disposed(){return disposed;},get listener(){return listener;},render(changes={}){frame={...frame,...changes,revision:frame.revision+1};listener(frame);}};
}

test('collapse/expand preserves selection, dimensions and one field; details/nav/deselect remain operable', async () => {
  const f=await fixture(),card=find(f.root,'int-rh2-companion')[0],toggle=find(f.root,'int-rh2-companion__toggle')[0],copy=find(f.root,'int-rh2-companion__copy')[0];
  assert.equal(card.dataset.expanded,'false'); assert.equal(toggle.getAttribute('aria-expanded'),'false');
  assert.equal(toggle.getAttribute('aria-controls'),find(f.root,'int-rh2-vitals')[0].id);
  const initial=[f.host.clientWidth,f.host.clientHeight];
  for(const expanded of [true,false,true]){
    toggle.dispatchEvent(new Event('click'));
    assert.equal(card.dataset.expanded,String(expanded)); assert.equal(toggle.getAttribute('aria-expanded'),String(expanded));
    f.render(); assert.equal(card.dataset.expanded,String(expanded),'ordinary frame cannot reset disclosure');
    assert.equal(card.dataset.open,'true'); assert.deepEqual([f.host.clientWidth,f.host.clientHeight],initial); assert.equal(f.mounts,1); assert.deepEqual(f.calls,[]);
  }
  copy.dispatchEvent(new Event('click')); assert.equal(f.root.dataset.detail,'open');
  find(f.root,'int-rh2-detail__close')[0].dispatchEvent(new Event('click')); assert.equal(f.document.activeElement,copy);
  find(f.root,'int-rh2-companion__nav').find(n=>n.dataset.direction==='next').dispatchEvent(new Event('click'));
  assert.deepEqual(f.calls.splice(0),[['select','b'],['focus','b']]);
  find(f.root,'int-rh2-companion__close')[0].dispatchEvent(new Event('click')); assert.deepEqual(f.calls,[['select',null]]);
  f.render({selection:{creatureId:null}}); assert.equal(card.dataset.open,'false'); assert.equal(card.inert,true);
  f.view.dispose(); assert.equal(f.disposed,true); assert.equal(f.listener,null); assert.equal(f.root.children.length,0);
});

test('calendar/mail interruption still closes details and suspends field, then resumes the same host', async () => {
  const f=await fixture(),copy=find(f.root,'int-rh2-companion__copy')[0];
  for(const lifecycle of [
    {confirmation:true},
    {day:{phase:'calendar',frames:0,calendar:{season:0,dayOfSeason:1,days:[]}}},
    {mailbox:{queue:[{id:'mail',system:true,sender:0,textId:0}],activeId:'mail',activeFrames:61}}
  ]) {
    copy.dispatchEvent(new Event('click'));
    f.render({lifecycle}); assert.equal(f.host.inert,true); assert.equal(f.root.dataset.detail,undefined); assert.equal(f.root.dataset.lifecycle,'active');
    if(lifecycle.day) assert.equal(find(f.root,'int-rh2-calendar')[0].hidden,false);
    if(lifecycle.mailbox) assert.equal(find(f.root,'int-rh2-letter')[0].hidden,false);
    f.render({lifecycle:null}); assert.equal(f.host.inert,false); assert.equal(f.root.dataset.lifecycle,'idle'); assert.equal(f.mounts,1);
  }
  f.view.dispose();
});

test('single-stage synthetic host accepts full viewport bounds without bar deductions (not browser geometry)', async () => {
  const document={},host=new Element('div',document);
  class Container { constructor(){this.children=[];} addChild(n){this.children.push(n);} }
  class Rectangle { constructor(x,y,width,height){Object.assign(this,{x,y,width,height});} }
  class Application {
    constructor(){this.stage=new Container();this.canvas=new Element('canvas',document);this.screen={width:0,height:0};this.ticker={started:true};this.renderer={resolution:1,resize:(w,h)=>Object.assign(this.screen,{width:w,height:h})};}
    async init(o){Object.assign(this.screen,{width:o.width,height:o.height});}
    destroy(){} start(){} stop(){}
  }
  const PIXI={Application,Container,Rectangle,Assets:{},Graphics:class{},AnimatedSprite:class{},Sprite:class{},Spritesheet:class{}};
  const stage=await createChampionshipPixiStage({PIXI,canvasHost:host});
  const canvas=stage.app.canvas,seen=[];stage.onResize(()=>seen.push({...stage.screen}));
  const field={worldWidthPx:2688,worldHeightPx:768,nativePixelWorldScale:4,presentationMode:'NATIVE_RANCH',wrapWidthPx:2688};
  const phonePixels=raisingNativeScreenPixels(field,{width:390,height:675});
  for(const [width,height,status,toolbar] of [[720,320,48,76],[844,390,60,92],[1180,757,56,76],[1920,1080,56,76]]){
    host.clientWidth=width;host.clientHeight=height;stage.attach(host);
    assert.deepEqual({...stage.screen},{width,height}); assert.equal(stage.app.canvas,canvas);
    const viewport={width,height,desktopRaising:true};
    assert.equal(raisingNativeScreenPixels(field,viewport),phonePixels,'native art scale does not follow wider CSS host');
    for(const camera of [0,321,2687])for(const [x,y] of [[20,40],[400,96],[660,-7]]){
      const screen=raisingNativeToScreen([x*4096,y*4096],field,viewport,camera),native=raisingScreenToNative(screen,field,viewport,camera);
      assert.ok(Math.abs(native.x-x)<1e-8);assert.ok(Math.abs(native.y-y)<1e-8);
    }
  }
  assert.equal(seen.length,4);stage.destroy();
});



test('evolution choices use distinct flow buttons, preserve focus and dispatch each exact identity',async()=>{
 const f=await fixture();
 const lifecycle={evolution:{choicePending:true,instanceId:'a',choices:[211,229]}};
 f.render({lifecycle});
 const dialog=find(f.root,'int-rh2-evolution-choice')[0];
 assert.equal(dialog.getAttribute('role'),'dialog');
 assert.equal(dialog.getAttribute('aria-modal'),'true');
 assert.equal(dialog.getAttribute('aria-label'),productFormText('choose'));
 const buttons=find(dialog,'int-rh2-evolution-choice__option');
 assert.equal(buttons.length,2);
 assert.deepEqual(buttons.map(b=>b.dataset.speciesIndex),['211','229']);
 assert.ok(buttons.every(b=>b.textContent&&b.type==='button'));
 assert.notEqual(buttons[0].textContent,buttons[1].textContent);
 assert.equal(find(dialog,'int-rh2-calendar').length,0);
 assert.equal(f.document.activeElement,buttons[0]);
 buttons[1].focus();f.render({lifecycle});assert.equal(f.document.activeElement,buttons[1]);
 const tab=new Event('keydown',{cancelable:true});Object.defineProperty(tab,'key',{value:'Tab'});
 dialog.dispatchEvent(tab);assert.equal(tab.defaultPrevented,true);assert.equal(f.document.activeElement,buttons[0]);
 for(const b of buttons)b.dispatchEvent(new Event('click'));
 assert.deepEqual(f.calls.filter(c=>c[0]==='evolution'),[['evolution','a',211],['evolution','a',229]]);
 f.view.dispose();
});

test('evolution choice stylesheet guarantees normal grid flow and narrow-screen stacking without changing calendar',()=>{
 const css=read('app/intRh2Styles.css');
 const option=css.match(/\.int-rh2-evolution-choice__option \{([^}]+)\}/)[1];
 assert.match(option,/position:\s*static/);assert.match(option,/inset:\s*auto/);
 assert.match(option,/min-width:\s*0/);assert.match(option,/white-space:\s*normal/);
 assert.match(css,/\.int-rh2-evolution-choice__title \{[^}]*grid-column: 1 \/ -1/s);
 assert.match(css,/@media \(max-width: 480px\) \{\s*\.int-rh2-evolution-choice \{ grid-template-columns: minmax\(0, 1fr\);/);
 assert.match(css,/\.int-rh2-evolution-choice__option:focus-visible/);
 assert.match(css,/\.int-rh2-calendar \{\s*position: absolute;\s*inset: 0;/);
});

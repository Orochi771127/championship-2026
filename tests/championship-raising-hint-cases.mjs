import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { createTransientHint, HINT_FADE_MS, TOOL_HINT_MS, RAISING_HINT_SEEN_KEY } from '../src/championship/app/transientHint.js';

function timers() {
  let now=0,next=0;const jobs=new Map(),all=[];
  return {setTimer(fn,ms){const id=++next;jobs.set(id,{fn,at:now+ms});all.push(fn);return id;},clearTimer(id){jobs.delete(id);},
    tick(ms){const end=now+ms;for(;;){const due=[...jobs].filter(([,v])=>v.at<=end).sort((a,b)=>a[1].at-b[1].at)[0];if(!due)break;now=due[1].at;jobs.delete(due[0]);due[1].fn();}now=end;},
    get pending(){return jobs.size;},get last(){return all.at(-1);}};
}
class Element extends EventTarget {
  constructor(tag,doc){super();this.tagName=tag;this.ownerDocument=doc;this.children=[];this.dataset={};this.attributes={};this.hidden=false;this.className='';this.style={setProperty(){},removeProperty(){}};this.clientWidth=390;this.clientHeight=844;this.offsetHeight=64;this.classList={toggle(){},add(){},remove(){}};}
  append(...nodes){for(const n of nodes){n.parentNode=this;this.children.push(n);}}
  appendChild(n){this.append(n);}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  setAttribute(k,v){this.attributes[k]=String(v);}
  getAttribute(k){return this.attributes[k]??null;}
  hasAttribute(k){return k in this.attributes;}
  removeAttribute(k){delete this.attributes[k];}
  focus(){this.ownerDocument.activeElement=this;}
  showModal(){this.open=true;}
  close(){this.open=false;this.dispatchEvent(new Event('close'));}
  remove(){if(this.parentNode)this.parentNode.children=this.parentNode.children.filter(n=>n!==this);}
  contains(n){return n===this||this.children.some(c=>c.contains(n));}
  getBoundingClientRect(){return {width:this.clientWidth,height:this.clientHeight};}
  matches(s){if(s.startsWith('.'))return this.className.split(' ').includes(s.slice(1));const m=s.match(/^\[data-([\w-]+)(?:="([^"]*)")?\]$/);if(!m)return false;const key=m[1].replace(/-([a-z])/g,(_,x)=>x.toUpperCase());return key in this.dataset&&(m[2]===undefined||this.dataset[key]===m[2]);}
  querySelectorAll(s){return this.children.flatMap(c=>[...(c.matches(s)?[c]:[]),...c.querySelectorAll(s)]);}
  querySelector(s){return this.querySelectorAll(s)[0]??null;}
}
function doc(){const d=new EventTarget();d.createElement=tag=>new Element(tag,d);d.body=d.createElement('body');d.documentElement={dataset:{motion:'full'}};d.defaultView=new EventTarget();return d;}
for(const duration of [5000,3000,2000])test(`hint holds ${duration}ms, fades for 300ms, then removes its input/focus surface`,()=>{
  const clock=timers(),node=new Element('p',doc()),hint=createTransientHint(node,clock);
  hint.show(duration);clock.tick(duration-1);assert.equal(node.dataset.hintPhase,'visible');assert.equal(node.hidden,false);
  clock.tick(1);assert.equal(node.dataset.hintPhase,'fading');assert.equal(node.inert,true);assert.equal(node.hidden,false);
  clock.tick(HINT_FADE_MS-1);assert.equal(node.hidden,false);clock.tick(1);assert.equal(node.hidden,true);assert.equal(clock.pending,0);hint.dispose();
});
test('a replaced hint invalidates old hold and fade callbacks; disposal cannot resurrect it',()=>{
  const clock=timers(),node=new Element('p',doc()),hint=createTransientHint(node,clock);
  hint.show(2000);const oldHold=clock.last;clock.tick(2000);const oldFade=clock.last;
  hint.show(2000);oldHold();oldFade();assert.equal(node.dataset.hintPhase,'visible');clock.tick(1999);assert.equal(node.hidden,false);
  hint.dispose();oldHold();oldFade();hint.show(5000);clock.tick(10000);assert.equal(node.hidden,true);assert.equal(clock.pending,0);
});
test('resolved reduced motion keeps reading duration but removes the fade',()=>{
  const clock=timers(),node=new Element('p',doc()),hint=createTransientHint(node,{...clock,reducedMotion:()=>true});
  hint.show(TOOL_HINT_MS);clock.tick(1999);assert.equal(node.hidden,false);clock.tick(1);assert.equal(node.hidden,true);assert.equal(clock.pending,0);
});
test('first-use persistence is a separate UI preference; no gameplay key is read or changed',async()=>{
  const original=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),values=new Map([['canonical-save','unchanged']]),reads=[],writes=[];
  try{
    Object.defineProperty(globalThis,'localStorage',{configurable:true,value:{getItem(k){reads.push(k);return values.get(k)??null;},setItem(k,v){writes.push(k);values.set(k,v);}}});
    const first=await import('../src/championship/app/transientHint.js?preference-first');
    assert.equal(first.consumeRaisingHintDuration(),5000);assert.equal(first.consumeRaisingHintDuration(),3000);
    const reload=await import('../src/championship/app/transientHint.js?preference-reload');assert.equal(reload.consumeRaisingHintDuration(),3000);
    assert.deepEqual(new Set([...reads,...writes]),new Set([RAISING_HINT_SEEN_KEY]));assert.equal(values.get('canonical-save'),'unchanged');
    Object.defineProperty(globalThis,'localStorage',{configurable:true,get(){throw Error('storage denied');}});
    const denied=await import('../src/championship/app/transientHint.js?preference-denied');assert.equal(denied.consumeRaisingHintDuration(),5000);assert.equal(denied.consumeRaisingHintDuration(),3000);
  }finally{if(original)Object.defineProperty(globalThis,'localStorage',original);else delete globalThis.localStorage;}
});
const read=name=>fs.readFileSync(new URL(`../src/championship/app/${name}`,import.meta.url),'utf8');
function context(document,clock,extras={}){
  return vm.createContext({document,Date,console,setTimeout:clock.setTimer,clearTimeout:clock.clearTimer,
    createTransientHint:(n,o={})=>createTransientHint(n,{...clock,...o}),TOOL_HINT_MS,
    uiText:s=>String(s),setText:(n,t)=>n.textContent=t,setLabel:(n,k,t)=>n.setAttribute(k,t),retranslate:()=>{},
    isOriginalUiIntakeLocal:()=>false,isOriginalRuntimeLocation:()=>false,originalToolbarArt:()=>null,originalDatabaseIcon:()=>null,
    isNativeRanchLayout:()=>true,assembledHudArt:()=>null,prefersReducedMotion:()=>false,productFormText:()=>'',getLocale:()=>'',speciesName:()=>'',raisingMessageText:()=>'',raisingMessageSender:()=>'',...extras});
}
function toolbarFixture(){
  const document=doc(),clock=timers(),calls=[],observers=[],styles=new Map();let inventory;
  document.body.style={setProperty:(k,v)=>styles.set(k,v),removeProperty:k=>styles.delete(k)};
  const c=context(document,clock,{ResizeObserver:class{constructor(fn){this.fn=fn;observers.push(this);}observe(){}disconnect(){this.disconnected=true;}}});vm.runInContext(read('championshipToolbar.js').replace(/^import .*;$/gm,'').replace(/export /g,'')+'\nthis.mount=createChampionshipToolbar;',c);
  const toolbar=c.mount({root:document.body,onMenuEntry(){},onToolChange:id=>calls.push(id),getFoodStock:()=>({feed:50}),subscribeInventory:f=>{inventory=f;return()=>inventory=null;}});toolbar.setMode(1);calls.length=0;
  const button=id=>toolbar.element.querySelector(`[data-tool-id="${id}"]`),hint=toolbar.element.querySelector('.cm-toolbar__tool-hint'),done=toolbar.element.querySelector('.cm-toolbar__tool-done');
  return {document,clock,calls,toolbar,button,hint,done,observers,styles,inventory:()=>inventory?.()};
}
test('tool fade does not cancel selection/action; selected toolbar button remains a labeled keyboard/touch exit',()=>{
  const f=toolbarFixture();f.button('clean').dispatchEvent(new Event('click'));assert.equal(f.toolbar.getSelectedTool(),'clean');assert.match(f.button('clean').getAttribute('aria-label'),/完成/);
  f.done.focus();f.clock.tick(2000);assert.equal(f.document.activeElement,f.button('clean'));assert.equal(f.hint.inert,true);
  f.clock.tick(300);assert.equal(f.hint.hidden,true);assert.equal(f.toolbar.getSelectedTool(),'clean');assert.equal(f.document.body.dataset.tool,'clean');assert.deepEqual(f.calls,['clean']);
  f.button('clean').dispatchEvent(new Event('click'));assert.equal(f.toolbar.getSelectedTool(),null);assert.deepEqual(f.calls,['clean',null]);assert.equal(f.document.body.dataset.tool,undefined);f.toolbar.dispose();
});
test('tool relabel, stock refresh, same mode and repeated renders never reset or resurrect its 2s deadline',()=>{
  const f=toolbarFixture();f.button('clean').dispatchEvent(new Event('click'));f.clock.tick(1500);f.toolbar.relabel();f.toolbar.setMode(1);f.inventory();f.clock.tick(500);assert.equal(f.hint.dataset.hintPhase,'fading');
  f.clock.tick(300);f.toolbar.relabel();f.inventory();f.toolbar.setMode(1);assert.equal(f.hint.hidden,true);assert.equal(f.clock.pending,0);f.toolbar.dispose();
});
test('rapid clean/feed selection, repeated toggle, navigation and return own independent hint deadlines',()=>{
  const f=toolbarFixture();f.button('clean').dispatchEvent(new Event('click'));f.clock.tick(1999);f.button('feed').dispatchEvent(new Event('click'));f.clock.tick(301);assert.equal(f.hint.dataset.hintPhase,'visible');assert.equal(f.toolbar.getSelectedTool(),'feed');
  f.button('feed').dispatchEvent(new Event('click'));assert.equal(f.hint.hidden,true);assert.equal(f.clock.pending,0);f.button('feed').dispatchEvent(new Event('click'));f.clock.tick(2000);assert.equal(f.hint.dataset.hintPhase,'fading');
  f.toolbar.setMode(null);assert.equal(f.hint.hidden,true);assert.equal(f.clock.pending,0);f.toolbar.setMode(1);assert.equal(f.hint.hidden,true);f.button('clean').dispatchEvent(new Event('click'));assert.equal(f.hint.dataset.hintPhase,'visible');
  const oldButton=f.button('clean'), beforeDispose=f.calls.length;f.toolbar.dispose();oldButton.dispatchEvent(new Event('click'));f.clock.tick(10000);assert.equal(f.clock.pending,0);assert.equal(f.document.body.dataset.tool,undefined);assert.equal(f.calls.length,beforeDispose,'detached previous toolbar cannot dispatch actions');
});
test('tutorial lock is not weakened by fading or by the persistent tool toggle',()=>{
  const f=toolbarFixture();f.toolbar.setTutorialTool('hand',{key:'stroke'});f.clock.tick(2300);assert.equal(f.hint.hidden,true);assert.equal(f.done.hidden,true);assert.equal(f.toolbar.getSelectedTool(),'hand');assert.doesNotMatch(f.button('hand').getAttribute('aria-label'),/完成/);
  f.button('hand').dispatchEvent(new Event('click'));assert.equal(f.toolbar.getSelectedTool(),'hand');f.toolbar.dispose();
});
async function raisingFixture({duration=5000,ready=true}={}){
  const document=doc(),clock=timers(),root=document.createElement('div');let frame={revision:1,residents:[],selection:{creatureId:null},ranch:{layoutVersion:1},save:{phase:'CLEAN'}},listener,host,consumes=0,observer;
  const c=context(document,clock,{consumeRaisingHintDuration:()=>{consumes++;return duration;},MutationObserver:class{constructor(fn){this.fn=fn;observer=this;}observe(){}disconnect(){this.disconnected=true;}}});
  vm.runInContext(read('raisingHomeP1RView.js').replace(/^import .*;$/gm,'').replace('export async function','async function')+'\nthis.mount=createRaisingHomeP1RView;',c);
  const source={getFrame:()=>frame,subscribe:fn=>{listener=fn;return()=>listener=null;},intents:{selectCreature(){},relocateCreature(){},careForCreature(){},requestSave(){}}};
  const view=await c.mount({root,source,firstRunHint:true,mountField:async({host:h})=>{host=h;h.setAttribute('aria-busy',String(!ready));return {get isPlayable(){return ready;},render(){},dispose(){}};}});
  return {document,clock,root,view,get hint(){return root.querySelector('.int-rh2-hint');},get consumes(){return consumes;},get observer(){return observer;},get listener(){return listener;},ready(){ready=true;host.setAttribute('aria-busy','false');observer.fn();},render(changes={}){frame={...frame,...changes,revision:frame.revision+1};listener?.(frame);}};
}
for(const duration of [5000,3000])test(`Raising entry holds ${duration}ms once, not on every frame or relabel`,async()=>{
  const f=await raisingFixture({duration});assert.equal(f.consumes,1);f.clock.tick(duration-1);f.render();f.view.relabel();assert.equal(f.consumes,1);assert.equal(f.hint.dataset.hintPhase,'visible');f.clock.tick(1);assert.equal(f.hint.dataset.hintPhase,'fading');f.clock.tick(300);f.render();f.view.relabel();assert.equal(f.hint.hidden,true);assert.equal(f.consumes,1);f.view.dispose();
});
test('loading does not spend the first-use hold; interrupted/new entries dispose observers and timers',async()=>{
  const f=await raisingFixture({ready:false});f.clock.tick(20000);f.render();assert.equal(f.hint.hidden,true);assert.equal(f.consumes,0);
  f.document.body.setAttribute('data-tutorial-guide','');f.ready();assert.equal(f.consumes,0);f.document.body.removeAttribute('data-tutorial-guide');f.observer.fn();assert.equal(f.consumes,1);f.clock.tick(4999);assert.equal(f.hint.dataset.hintPhase,'visible');
  f.view.dispose();assert.equal(f.observer.disconnected,true);assert.equal(f.listener,null);assert.equal(f.clock.pending,0);f.observer.fn();f.clock.tick(5000);assert.equal(f.root.children.length,0);
  const next=await raisingFixture({duration:3000});assert.equal(next.hint.dataset.hintPhase,'visible');next.clock.tick(3000);assert.equal(next.hint.dataset.hintPhase,'fading');next.view.dispose();
});
test('selection dismisses generic guidance without changing gameplay, and deselection does not restart it',async()=>{
  const f=await raisingFixture();f.render({residents:[{creatureId:'a'}],selection:{creatureId:'a'}});assert.equal(f.hint.hidden,true);assert.equal(f.clock.pending,0);f.render({selection:{creatureId:null}});assert.equal(f.hint.hidden,true);assert.equal(f.consumes,1);f.view.dispose();
});

// Source contract complements the real-browser rectangle assertions.
test('simultaneous general/tool hints reserve two measured lanes, not suppression or a fixed language height',()=>{
  const css=read('intRh2Styles.css'),toolbar=read('championshipToolbar.js');
  assert.doesNotMatch(css,/body\[data-tool\] \.int-rh2-hint \{ display: none/);
  assert.match(css,/--cm-tool-hint-clearance, 0px/);
  assert.match(toolbar,/new ResizeObserver\(syncToolHintClearance\)/);
  assert.match(toolbar,/hintResizeObserver\?\.disconnect\(\)/);
  assert.match(toolbar,/removeProperty\("--cm-tool-hint-clearance"\)/);
});

test('Done restores focus to the deselected but still usable rail button',()=>{
  const f=toolbarFixture();f.button('clean').dispatchEvent(new Event('click'));f.done.focus();f.done.dispatchEvent(new Event('click'));
  assert.equal(f.toolbar.getSelectedTool(),null);assert.equal(f.document.activeElement,f.button('clean'));assert.equal(f.hint.hidden,true);f.toolbar.dispose();
});

test('disposed hint resize callbacks cannot rewrite spacing for a later screen',()=>{
  const f=toolbarFixture();f.button('clean').dispatchEvent(new Event('click'));assert.ok(f.styles.has('--cm-tool-hint-clearance'));
  f.toolbar.dispose();assert.equal(f.styles.size,0);assert.ok(f.observers.every(o=>o.disconnected));
  for(const observer of f.observers)observer.fn();assert.equal(f.styles.size,0);
});

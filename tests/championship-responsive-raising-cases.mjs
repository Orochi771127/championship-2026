import { createTransientHint, consumeRaisingHintDuration, TOOL_HINT_MS } from '../src/championship/app/transientHint.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import {mountPortraitFrame,isDesktopRaisingLayout} from '../src/championship/app/portraitFrame.js';

// DOM substitute: checks owner state/listener lifecycle, not CSS rendering.
class Target extends EventTarget {
  listeners=new Map();
  addEventListener(t,f,o){super.addEventListener(t,f,o);this.listeners.set(f,t);}
  removeEventListener(t,f,o){super.removeEventListener(t,f,o);this.listeners.delete(f);}
}
function layoutFixture(){
 const attrs=new Set(),styles=new Map(),root={dataset:{activeScreen:'RAISING_HOME'},hidden:false};
 const body={toggleAttribute:(k,v)=>v?attrs.add(k):attrs.delete(k),removeAttribute:k=>attrs.delete(k),style:{setProperty:(k,v)=>styles.set(k,v),removeProperty:k=>styles.delete(k)}};
 let mutate,disconnected=false;
 const window=Object.assign(new Target(),{innerWidth:390,innerHeight:844,visualViewport:new Target(),MutationObserver:class{constructor(f){mutate=f}observe(){}disconnect(){disconnected=true}}});
 const document=Object.assign(new Target(),{body,activeElement:null,getElementById:()=>root});
 const controller=mountPortraitFrame({window,document,responsiveRaising:true});
 return {attrs,styles,root,window,document,controller,mutate:()=>mutate(),disconnected:()=>disconnected,
 resize(w,h){window.innerWidth=w;window.innerHeight=h;window.dispatchEvent(new Event('resize'));}};
}
test('idle/loading/selected/tutorial share the same eligibility, and only batch A is enabled',()=>{
 const f=layoutFixture();
 for(const phase of ['idle','loading','selected','tutorial']) {
  f.root.dataset.phase=phase;
  for(const [w,h,wide] of [[390,844,false],[568,320,true],[667,375,true],[844,390,true],[390,844,false],[932,430,true],[1366,480,true],[1366,768,true],[320,568,false]]) {
   f.resize(w,h); assert.equal(f.attrs.has('data-desktop-raising'),wide,`${phase} ${w}x${h}`);
  }
 }
 f.resize(844,390);
 for(const screen of ['BATTLE','BATTLE_SELECT','HUNT_FIELD','HUNT_RESULT','GATE_SELECT','CAGE_EDIT','TITLE']) {
  f.root.dataset.activeScreen=screen;f.mutate();assert.equal(f.attrs.has('data-desktop-raising'),false);assert.ok(f.attrs.has('data-portrait-frame'));
 }
 f.root.dataset.activeScreen='RAISING_HOME';f.mutate();assert.ok(f.attrs.has('data-desktop-raising'));
 f.root.hidden=true;f.mutate();assert.ok(!f.attrs.has('data-desktop-raising'));
 f.root.hidden=false;f.mutate();assert.ok(f.attrs.has('data-desktop-raising'));
 f.controller.dispose(); assert.equal(f.window.listeners.size,0);assert.equal(f.window.visualViewport.listeners.size,0);assert.equal(f.document.listeners.size,0);assert.ok(f.disconnected());
 f.resize(1366,768);f.mutate();assert.equal(f.attrs.size,0);assert.equal(f.styles.size,0);
});
test('keyboard does not manufacture a layout change; actual width rotation does',()=>{
 const f=layoutFixture();f.document.activeElement={tagName:'INPUT',type:'text'};f.document.dispatchEvent(new Event('focusin'));
 f.resize(390,280);assert.equal(f.attrs.size,0);
 f.resize(844,390);assert.ok(f.attrs.has('data-desktop-raising'));
 f.resize(844,220);assert.ok(f.attrs.has('data-desktop-raising'));
 f.resize(390,844);assert.equal(f.attrs.size,0);f.controller.dispose();
 for(const width of [NaN,Infinity,0,-1])assert.equal(isDesktopRaisingLayout({width,height:480,activeScreen:'RAISING_HOME'}),false);
});
class Element extends Target {
 constructor(tag,doc){super();this.tagName=tag;this.ownerDocument=doc;this.children=[];this.dataset={};this.attributes={};this.style={setProperty(){},removeProperty(){}};this.hidden=false;this.offsetHeight=0;}
 append(...nodes){for(const n of nodes){n.parent=this;this.children.push(n);}}
 replaceChildren(...nodes){this.children=[];this.append(...nodes);}
 remove(){if(this.parent)this.parent.children=this.parent.children.filter(x=>x!==this);}
 setAttribute(k,v){this.attributes[k]=v;}
 removeAttribute(k){delete this.attributes[k];}
 matches(s){if(s.startsWith('.'))return this.className===s.slice(1);const m=s.match(/^\[data-([\w-]+)(?:="([^"]*)")?\]$/);if(!m)return false;const key=m[1].replace(/-([a-z])/g,(_,x)=>x.toUpperCase());return key in this.dataset&&(m[2]===undefined||this.dataset[key]===m[2]);}
 querySelectorAll(s){return this.children.flatMap(c=>[...(c.matches(s)?[c]:[]),...c.querySelectorAll(s)]);}
 querySelector(s){return this.querySelectorAll(s)[0]??null;}
}
test('same toolbar owner retains measured rail budget and tears down observer/listeners',()=>{
 const document=new Target();document.createElement=t=>new Element(t,document);document.defaultView=new Target();document.body=new Element('body',document);
 const values=new Map();document.body.style={setProperty:(k,v)=>values.set(k,v),removeProperty:k=>values.delete(k)};
 const observers=[];
 class RO{constructor(fn){this.fn=fn;observers.push(this)}observe(node){this.node=node}disconnect(){this.closed=true}}
 const source=fs.readFileSync(new URL('../src/championship/app/championshipToolbar.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace(/export /g,'');
 const context=vm.createContext({createTransientHint, consumeRaisingHintDuration, TOOL_HINT_MS,document,ResizeObserver:RO,globalThis:{},uiText:s=>s,originalToolbarArt:()=>null,originalDatabaseIcon:()=>null,isOriginalRuntimeLocation:()=>false,isOriginalUiIntakeLocal:()=>false});
 vm.runInContext(source+'\nthis.createToolbar=createChampionshipToolbar;',context);
 const toolbar=context.createToolbar({responsiveLayout:true,root:document.body,onMenuEntry:()=>{}});const bar=toolbar.element;assert.equal(observers[0].node,bar);
 bar.offsetHeight=60;toolbar.setMode(1);assert.equal(values.get('--cm-toolbar-height'),'60px');
 const hand=bar.querySelector('[data-tool-id="hand"]');hand.dispatchEvent(new Event('click'));assert.equal(toolbar.getSelectedTool(),'hand');
 const hint=bar.querySelector('.cm-toolbar__tool-hint');assert.equal(hint.hidden,false);
 observers[0].fn();assert.equal(values.get('--cm-toolbar-height'),'60px','absolute hint does not change the supplied bar box');
 // Synthetic owner notification only: enlarged rail (not hint) changes its measured budget.
 bar.offsetHeight=112;observers[0].fn();assert.equal(values.get('--cm-toolbar-height'),'112px');assert.equal(toolbar.getSelectedTool(),'hand');
 toolbar.setTutorialTool('hand',{key:'camera'});bar.offsetHeight=140;observers[0].fn();assert.equal(toolbar.getSelectedTool(),'hand');assert.equal(values.get('--cm-toolbar-height'),'140px');
 toolbar.setMode(null);assert.equal(values.get('--cm-toolbar-height'),'0px');
 toolbar.dispose();toolbar.dispose();assert.ok(observers[0].closed);assert.equal(document.listeners.size,0);assert.equal(values.size,0);assert.equal(document.body.children.length,0);
});
test('wide CSS floats card/tutorial and active hint over the full field; source contract only',()=>{
 const css=fs.readFileSync(new URL('../src/championship/app/intRh2Styles.css',import.meta.url),'utf8');
 assert.match(css,/--cm-raising-card: clamp\(256px, 28vw, 340px\)/);
 assert.match(css,/left: var\(--safe-left\); right: var\(--safe-right\); min-height: 0/);
 assert.match(css,/width: 100%; max-width: none/);
 assert.match(css,/max-height: calc\(var\(--cm-screen-height\) - 16px\)/);
 assert.match(css.slice(css.indexOf('/* Raising-only overlay composition:')),/position: absolute; left: 50%; right: auto; bottom: calc\(100% \+ 8px\)/);
 assert.match(css,/tool-hint\[hidden\],[\s\S]*menu\[hidden\] \{ display: none; \}/);
 assert.match(css,/\.int-rh2-detail[\s\S]*grid-template-rows: auto minmax\(0, 1fr\) auto/);
});

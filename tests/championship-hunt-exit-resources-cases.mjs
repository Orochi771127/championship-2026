import test from 'node:test';
import assert from 'node:assert/strict';
import {createHuntFieldView} from '../src/championship/app/vs2Screens.js';

class Element {
  constructor(tag) {
    this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.listeners={};
    this.className='';this.style={setProperty(){},removeProperty(){}};
    this.classList={add:name=>{this.className+=' '+name;}};
  }
  append(...nodes){this.children.push(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(k,v){this.attributes[k]=String(v);}
  getAttribute(k){return this.attributes[k]??null;}
  removeAttribute(k){delete this.attributes[k];}
  addEventListener(k,fn){this.listeners[k]=fn;}
  remove(){}
}
const descendants=root=>[root,...root.children.flatMap(descendants)];

test('a return refused during capture keeps the live asset scope; accepted return cancels it',async t=>{
  const previous=globalThis.document;
  globalThis.document={createElement:tag=>new Element(tag)};
  t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});
  const root=new Element('main');
  let screen='HUNT_FIELD',canExit=false,signal,disposals=0;
  const source={getFrame:()=>({screen,huntField:{hud:{exitAvailable:true},toolbar:{slots:[],mode:{value:2},assetFamily:{value:'HUNT'}}}}),
    intents:{exitHunt(){if(canExit)screen='HUNT_RESULT';return source.getFrame();}}};
  const view=await createHuntFieldView({root,source,mountField:async options=>{
    signal=options.signal;
    return {render(){},dispose(){disposals++;}};
  }});
  const exit=descendants(root).find(n=>n.className.includes('cm-vs2-hud__exit'));
  exit.listeners.click();
  assert.equal(screen,'HUNT_FIELD');
  assert.equal(signal.aborted,false,'refused exit must not dispose textures used by capture animation');
  canExit=true;exit.listeners.click();
  assert.equal(screen,'HUNT_RESULT');assert.equal(signal.aborted,true);
  view.dispose();assert.equal(disposals,1);
});

test('accepted return during loading releases the mount queue and disposes a late scene once',async t=>{
  const previous=globalThis.document;
  globalThis.document={createElement:tag=>new Element(tag)};
  t.after(()=>{if(previous===undefined)delete globalThis.document;else globalThis.document=previous;});
  const root=new Element('main');let screen='HUNT_FIELD',signal,resolve,disposals=0;
  const source={getFrame:()=>({screen,huntField:{hud:{exitAvailable:true},toolbar:{slots:[],mode:{value:2},assetFamily:{value:'HUNT'}}}}),
    intents:{exitHunt(){screen='RAISING_HOME';}}};
  const mounting=createHuntFieldView({root,source,mountField:options=>{
    signal=options.signal;return new Promise(r=>{resolve=r;});
  }});
  await Promise.resolve();
  descendants(root).find(n=>n.className.includes('cm-vs2-hud__exit')).listeners.click();
  assert.equal(signal.aborted,true);assert.equal(screen,'RAISING_HOME');
  const view=await mounting;assert.equal(view.isPlayable,false);
  resolve({render(){},dispose(){disposals++;}});await new Promise(r=>setImmediate(r));
  assert.equal(disposals,1);view.dispose();assert.equal(disposals,1);
});

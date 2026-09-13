import test from 'node:test';
import assert from 'node:assert/strict';
import {mountPortraitFrame} from '../src/championship/app/portraitFrame.js';

function fixture(width=393,height=700,{visual=true}={}){
  const properties=new Map(),attributes=new Set();
  const body={style:{setProperty:(k,v)=>properties.set(k,v),removeProperty:k=>properties.delete(k)},
    toggleAttribute:(k,on)=>on?attributes.add(k):attributes.delete(k),removeAttribute:k=>attributes.delete(k)};
  const window=Object.assign(new EventTarget(),{innerWidth:width,innerHeight:height});
  if(visual)window.visualViewport=Object.assign(new EventTarget(),{width,height,offsetLeft:0,offsetTop:0,scale:1});
  const document=Object.assign(new EventTarget(),{body,activeElement:null});
  const controller=mountPortraitFrame({window,document});
  return {window,document,properties,attributes,controller,
    resize(w,h){Object.assign(window,{innerWidth:w,innerHeight:h});if(window.visualViewport)Object.assign(window.visualViewport,{width:w,height:h});window.dispatchEvent(new Event('resize'));},
    focus(){document.activeElement={tagName:'INPUT',type:'text'};document.dispatchEvent(new Event('focusin'));},
    blur(){document.activeElement=null;document.dispatchEvent(new Event('focusout'));}};
}
const scale=f=>Number(f.properties.get('--cm-frame-scale'));

test('landscape frame fits within the viewport at 9:16 and portrait restores its original layout',()=>{
  const f=fixture();assert.equal(f.attributes.size,0);assert.equal(f.properties.size,0);
  for(const [w,h] of [[568,320],[667,375],[844,393],[1024,768],[1920,1080]]){
    f.resize(w,h);const s=scale(f),frameHeight=parseFloat(f.properties.get('--cm-viewport-height'));
    assert.ok(390*s<=w+1e-8&&frameHeight*s<=h+1e-8);
    assert.ok(Math.abs(390/frameHeight-9/16)<1e-8);
    assert.equal(parseFloat(f.properties.get('--cm-frame-center-x')),w/2);
    assert.equal(parseFloat(f.properties.get('--cm-frame-center-y')),h/2);
  }
  f.resize(393,700);assert.equal(f.properties.size,0);assert.equal(f.attributes.size,0);
  f.controller.dispose();
});

test('typing and keyboard dismissal cannot turn a portrait phone into landscape',()=>{
  const f=fixture();f.focus();f.resize(393,280);
  assert.equal(f.attributes.size,0);
  f.blur();assert.equal(f.attributes.size,0,'focusout precedes keyboard resize');
  f.resize(393,700);assert.equal(f.attributes.size,0);
  f.resize(844,393);assert.equal(f.attributes.size,1);
  f.controller.dispose();
});

test('real rotation during editing switches orientation and can return to portrait',()=>{
  const f=fixture();f.focus();f.resize(393,280);f.resize(844,393);
  assert.equal(f.attributes.size,1);
  f.resize(393,700);assert.equal(f.attributes.size,0);
  f.resize(393,280);assert.equal(f.attributes.size,0);
  f.controller.dispose();
});

test('browser chrome and visible viewport offset keep all four edges on screen',()=>{
  const f=fixture(844,393),v=f.window.visualViewport;
  Object.assign(v,{width:820,height:270,offsetLeft:12,offsetTop:30});v.dispatchEvent(new Event('resize'));
  assert.equal(scale(f),270/(390*16/9));
  assert.equal(parseFloat(f.properties.get('--cm-frame-center-x')),422);
  assert.equal(parseFloat(f.properties.get('--cm-frame-center-y')),165);
  v.offsetTop=70;v.dispatchEvent(new Event('scroll'));
  assert.equal(parseFloat(f.properties.get('--cm-frame-center-y')),205);
  f.controller.dispose();
});

test('pinch zoom does not trigger an inverse fit to the smaller visual viewport',()=>{
  const f=fixture(844,393),original=scale(f),v=f.window.visualViewport;
  Object.assign(v,{width:422,height:196.5,scale:2});v.dispatchEvent(new Event('resize'));
  assert.equal(scale(f),original);
  f.controller.dispose();
});

test('a focused name field is revealed after keyboard resize, without fighting visual viewport panning',()=>{
  const f=fixture();f.focus();const calls=[];
  f.document.activeElement.scrollIntoView=options=>calls.push(options);
  f.resize(393,280);assert.deepEqual(calls,[{block:'nearest',inline:'nearest'}]);
  f.window.visualViewport.dispatchEvent(new Event('scroll'));assert.equal(calls.length,1);
  f.blur();f.resize(393,700);assert.equal(calls.length,1);
  f.controller.dispose();
});

test('missing visualViewport is supported and disposal removes every layout observer',()=>{
  for(const visual of [true,false]){
    const f=fixture(844,393,{visual});assert.ok(scale(f)>0);
    f.controller.dispose();f.controller.dispose();f.resize(900,400);f.focus();
    f.window.visualViewport?.dispatchEvent(new Event('scroll'));
    assert.equal(f.properties.size,0);assert.equal(f.attributes.size,0);
  }
});

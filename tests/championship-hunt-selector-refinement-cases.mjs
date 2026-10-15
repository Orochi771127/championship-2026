import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import * as THREE from '../node_modules/three/build/three.module.js';
import { GATE_WORLD_REGIONS, GATE_WORLD_RADIUS, gateWorldPoint, sampleGateWorld } from '../src/championship/presentation/vs2/gateWorldLayout.js';
const rendererSource = fs.readFileSync(new URL('../src/championship/presentation/vs2/createGateSelectThreePresentation.js', import.meta.url), 'utf8');
const screens = fs.readFileSync(new URL('../src/championship/app/vs2Screens.js', import.meta.url), 'utf8');
const css = fs.readFileSync(new URL('../src/championship/app/vs2Styles.css', import.meta.url), 'utf8');
const geometrySource = rendererSource.slice(rendererSource.indexOf('export function createGateWorldGeometry'), rendererSource.indexOf('function disposeObject')).replaceAll('export function', 'function');
const geometry = new Function('THREE', 'GATE_WORLD_REGIONS', 'gateWorldPoint', 'sampleGateWorld', `${geometrySource}; return { createGateWorldGeometry, createGateLandmarkGeometry };`)(THREE, GATE_WORLD_REGIONS, gateWorldPoint, sampleGateWorld);

test('all sixteen immutable biome anchors and inland neighbourhoods remain on their own land', () => {
  assert.equal(GATE_WORLD_REGIONS.length, 16);
  assert.equal(new Set(GATE_WORLD_REGIONS.map(r => r.biomeId)).size, 16);
  for (const region of GATE_WORLD_REGIONS) {
    for (const [x,y] of [[0,0],[-.08,0],[.08,0],[0,.08],[0,-.08]]) {
      const sample = sampleGateWorld(gateWorldPoint(region,x,y));
      assert.equal(sample.biomeId, region.biomeId, `${region.biomeId} inland anchor`);
      assert.ok(sample.radius > GATE_WORLD_RADIUS);
      assert.ok(sample.coastDistance > .5);
    }
  }
});

test('all authored landmark placement neighbourhoods stay inside their biome', () => {
  const offsets=[[-.14,.1],[.15,-.12],[-.14,.12],[.14,.13],[.13,-.14],[-.13,-.12],[-.13,-.2],[-.16,.12],[.16,.14],[-.12,-.16],[.19,-.1],[-.25,-.02],[.25,.02],[.02,.24],[-.02,-.25],[.16,-.12],[-.16,.13],[.16,.13],[.1,-.16],[-.16,.11],[.14,-.15],[.17,.12],[.16,.02],[-.15,.12],[.15,-.15],[-.14,.12],[.15,-.14]];
  for(const region of GATE_WORLD_REGIONS) for(const [x,y] of offsets) {
    assert.equal(sampleGateWorld(gateWorldPoint(region,x,y)).biomeId,region.biomeId,`${region.biomeId} landmark neighbourhood ${x},${y}`);
  }
});

test('continuous geography stays finite at poles, longitude seam and dense world samples', () => {
  for (let lat=-90;lat<=90;lat+=3) for(let lon=-180;lon<=180;lon+=3) {
    const l=lon*Math.PI/180,a=lat*Math.PI/180;
    const sample=sampleGateWorld([Math.sin(l)*Math.cos(a),Math.sin(a),Math.cos(l)*Math.cos(a)]);
    assert.ok(Number.isFinite(sample.radius));
    assert.ok(sample.radius>=GATE_WORLD_RADIUS && sample.radius<GATE_WORLD_RADIUS+.06);
    assert.ok(Number.isInteger(sample.color) && sample.color>=0 && sample.color<=0xffffff);
  }
  for(let lat=-85;lat<=85;lat+=5) {
    const a=lat*Math.PI/180;
    assert.deepEqual(sampleGateWorld([0,Math.sin(a),-Math.cos(a)]),sampleGateWorld([-0,Math.sin(a),-Math.cos(a)]));
  }
});

test('terrain tiers share biome surface and preserve lower saver mesh cost', () => {
  const full=geometry.createGateWorldGeometry(), saver=geometry.createGateWorldGeometry({detail:false});
  assert.ok(full.attributes.position.count>saver.attributes.position.count);
  assert.equal(saver.attributes.position.count,97*65);
  for(const mesh of [full,saver]) {
    for(const name of ['position','normal','color']) assert.ok([...mesh.attributes[name].array].every(Number.isFinite));
    mesh.dispose();
  }
  assert.match(rendererSource,/detail: quality\.threeAntialias/);
  assert.match(rendererSource,/cappedPixelRatio\(quality\.threePixelRatioCap\)/);
  assert.doesNotMatch(rendererSource,/requestAnimationFrame|setInterval/);
});

test('smaller static landmarks are valid merged geometry, without a new render loop', () => {
  const landmarks=geometry.createGateLandmarkGeometry();
  assert.ok(landmarks.attributes.position.count>0);
  const p=landmarks.attributes.position;
  for(let i=0;i<p.count;i++) {
    const radius=Math.hypot(p.getX(i),p.getY(i),p.getZ(i));
    assert.ok(Number.isFinite(radius) && radius>2 && radius<2.55);
  }
  landmarks.dispose();
});

class Node {
  constructor(tag){this.tagName=tag;this.children=[];this.dataset={};this.attributes={};this.events={};this.style={setProperty(){}};this.textContent='';this.hidden=false;this.className='';this.classList={add:(...names)=>{this.className += ' '+names.join(' ');}};}
  append(...nodes){for(const n of nodes){n.parentNode=this;this.children.push(n);}}
  replaceChildren(...nodes){this.children=[];this.append(...nodes);}
  setAttribute(k,v){this.attributes[k]=v;}
  getAttribute(k){return this.attributes[k]??null;}
  removeAttribute(k){delete this.attributes[k];}
  addEventListener(k,f){this.events[k]=f;}
  find(cls){return this.className.split(' ').includes(cls)?this:this.children.map(n=>n.find(cls)).find(Boolean);}
}
function harness(){
  const context={document:{createElement:tag=>new Node(tag)},URLSearchParams,console:{warn(){}},uiText:(s,values={})=>String(s).replace(/\{(\w+)\}/g,(_,k)=>values[k]??''),assembledHudArt:()=>null};
  vm.createContext(context);
  vm.runInContext(screens.replace(/^import .*;\n/gm,'').replaceAll('export ','')+'; globalThis.createView=createGateSelectView;',context);
  const gates=GATE_WORLD_REGIONS.map((r,i)=>({biomeId:r.biomeId,gateId:r.biomeId,displayName:r.biomeId,ordinal:i+1,selected:i===0,state:'LOCKED',entranceFeeBits:300,codeString:'TEST'}));
  const frame={screen:'GATE_SELECT',gateSelect:{gates,selection:{gateId:gates[0].gateId},walletBits:0,canConfirm:false,admission:{reason:'GATE_LOCKED',unlockKind:1,unlockParameter:2}}};
  const intents={selectGate(){},leaveScreen(){},confirmGate(){}};
  return {context,frame,source:{getFrame:()=>frame,intents},root:new Node('root')};
}

test('hint is inside globe, admission is inline, sixteen fallback options survive toggles', async()=>{
  const h=harness();let mounts=0,disposals=0;
  const view=await h.context.createView({...h,mountWorld:async()=>{mounts++;return{render(){},dispose(){disposals++;}};}});
  const host=h.root.find('cm-vs2-gate3d__host'),hint=h.root.find('cm-vs2-gate3d__hint'),status=h.root.find('cm-vs2-gate-admission');
  assert.equal(hint.parentNode,host);
  assert.equal(status.parentNode,h.root.find('cm-vs2-preview__copy'));
  assert.match(status.textContent,/2/);
  assert.equal(h.root.find('cm-vs2-gates').children.length,16);
  const toggle=h.root.find('cm-vs2-gate3d__toggle');
  toggle.events.click();await new Promise(r=>setImmediate(r));assert.equal(host.hidden,true);assert.equal(hint.hidden,true);
  toggle.events.click();await new Promise(r=>setImmediate(r));assert.equal(host.hidden,false);assert.equal(hint.hidden,false);assert.equal(mounts,1);
  h.frame.gateSelect.admission=null;h.frame.gateSelect.canConfirm=true;view.render(h.frame);assert.equal(status.hidden,true);
  view.dispose();assert.equal(disposals,1);assert.equal(h.root.children.length,0);
});

test('WebGL failure retains the full accessible sixteen-region fallback',async()=>{
  const h=harness();const view=await h.context.createView({...h,mountWorld:async()=>{throw new Error('TEST_NO_WEBGL');}});
  assert.equal(view.inspect().presentation,'LOW_CAPABILITY_FALLBACK');
  assert.equal(h.root.find('cm-vs2-gates').children.length,16);
  assert.equal(h.root.find('cm-vs2-gate3d__hint').hidden,true);
  view.dispose();
});

test('layout uses one body scroll owner with shrinkable globe and non-intercepting overlay',()=>{
  assert.match(css,/\.cm-vs2-gate3d__host \{[^}]*flex: 1 1 0; min-height: 168px/);
  assert.match(css,/\.cm-vs2-gate3d__hint \{[^}]*position: absolute;[^}]*pointer-events: none;/);
  assert.match(css,/\.cm-vs2-gate-fallback \{[^}]*overflow: visible;/);
  assert.doesNotMatch(css,/cm-vs2-gate3d[^\n]*min-height: (280|336|360)px/);
});

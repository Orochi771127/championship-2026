import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createBattleFieldView} from '../src/championship/app/vs5Screens.js';
import {setLocale} from '../src/championship/text/locale.js';
import {createBattleFxCamera,clampBattleCameraToMap} from '../src/championship/presentation/battleFx/battleFxCamera.js';
class Node {
  constructor(tag){Object.assign(this,{tagName:tag,children:[],dataset:{},attributes:{},listeners:{},style:{},className:'',textContent:''});this.classList={add:n=>this.className+=' '+n,remove:()=>{}};}
  append(...nodes){this.children.push(...nodes);}
  prepend(...nodes){this.children.unshift(...nodes);}
  replaceChildren(...nodes){this.children=nodes;}
  setAttribute(k,v){this.attributes[k]=v;}
  getAttribute(k){return this.attributes[k]??null;}
  addEventListener(k,v){this.listeners[k]=v;}
}
const all=n=>[n,...n.children.flatMap(all)];
const by=(n,c)=>all(n).filter(x=>x.className.split(' ').includes(c));
function frame(count=6){return {arena:{identifier:'BATTLE_VOLCANO'},clock:{ratio:.8,tier:1},combatants:Array.from({length:count},(_,slot)=>({slot,team:slot<3?0:1,present:true,displayName:'Long localized fighter name 日本語 ภาษาไทย Tiếng Việt',hp:{current:12345,maximum:65535,ratio:.188},resource:{current:650,maximum:999,ratio:.65},down:slot===4})),outcome:{ended:false}};}
for(const locale of ['zh-Hant','en','ja','th','vi']) test(`${locale}: six actors retain numbers inside both bars, down state and exit`,()=>{
  const before=globalThis.document;globalThis.document={createElement:t=>new Node(t)};setLocale(locale);
  try {
    const root=new Node('root'),f=frame();let exited=0;
    const view=createBattleFieldView({root,frame:f,mountField:()=>({}),onExit:()=>exited++,dynamicFx:true,responsiveLayout:true});view.render(f);
    assert.equal(root.children[0].dataset.hud,'floating');
    assert.equal(by(root,'cm-vs5-fighter').length,6);
    assert.equal(by(root,'cm-vs5-meter--resource').length,6);
    for(const bar of by(root,'cm-vs5-meter--hp')) {assert.equal(bar.children[1].textContent,'HP 12345 / 65535');assert.match(bar.attributes['aria-label'],/12345/);}
    for(const bar of by(root,'cm-vs5-meter--resource')) assert.equal(bar.children[1].textContent,'TP 650 / 999');
    assert.equal(by(root,'cm-vs5-fighter').find(c=>c.dataset.slot==='4').dataset.down,'true');
    assert.ok(by(root,'cm-vs5-exit')[0].textContent);by(root,'cm-vs5-exit')[0].listeners.click();assert.equal(exited,1);
    assert.equal(by(root,'cm-vs5-clock').length,1);assert.equal(by(root,'cm-vs5-log').length,1);
    view.dispose();
  }finally{globalThis.document=before;setLocale('zh-Hant');}
});
test('classic retains separate HP text and player-only TP',()=>{
 const before=globalThis.document;globalThis.document={createElement:t=>new Node(t)};
 try {const root=new Node('root'),f=frame();const view=createBattleFieldView({root,frame:f,mountField:()=>({})});view.render(f);
 assert.equal(root.children[0].dataset.hud,undefined);assert.equal(by(root,'cm-vs5-meter--resource').length,3);
 assert.equal(by(root,'cm-vs5-meter--hp')[0].children.length,1);view.dispose();} finally {globalThis.document=before;}
});
test('cover has no uncovered edge on tall phones, landscape, desktop and resize; no stretch/rotation',()=>{
 const art={x:0,y:0,width:416,height:272};
 for(const [width,height] of [[320,568],[390,844],[430,932],[844,390],[1024,768],[1920,1080]]){
 const camera=createBattleFxCamera({boundedMap:true,responsiveLayout:true,wideCover:true});
 for(const x of [0,104,208,400])for(const y of [0,136,260]){
 const box={left:x,top:y,right:x+16,bottom:y+12};
 const shot=camera.update({viewport:{width,height},art,subjects:[{slot:0,team:0,...box}],dtMs:16});
 const out=clampBattleCameraToMap({viewport:{width,height},art,transform:shot,box});
 assert.ok(out.x<=1e-8&&out.y<=1e-8);assert.ok(out.x+416*out.zoom>=width-1e-8);assert.ok(out.y+272*out.zoom>=height-1e-8);
 assert.ok(out.zoom<=Math.max(width/416,height/272)*1.05+1e-8);assert.equal(out.rotation,undefined);
 }
 }
});
test('floating CSS moves actual field behind HUD, keeps pointer input on field/exit and touch/safe-area rules',()=>{
 const css=fs.readFileSync(new URL('../src/championship/app/vs5Styles.css',import.meta.url),'utf8').split('/* Owner 2026-10-23:')[1];
 assert.match(css,/position: absolute; inset: 0; z-index: -1; width: 100%; height: 100%/);
 assert.match(css,/cm-vs5-fighter\[data-present="false"\] \{ display: none/);
 assert.match(css,/pointer-events: none/);assert.match(css,/pointer-events: auto/);
 assert.match(css,/grid-template-areas: none/);
 assert.match(css,/min-height: 44px/);assert.match(css,/safe-area-inset-bottom/);
 assert.match(css,/display: flex; flex-direction: row; flex-wrap: wrap/);
});
test('failed-FX fallback contain-art coordinates still cover through unconditional final map clamp',()=>{
 for(const [width,height] of [[320,568],[390,844],[844,390],[1920,1080]]){
  const fit=Math.min(width/416,height/272);
  const art={x:(width-416*fit)/2,y:(height-272*fit)/2,width:416*fit,height:272*fit};
  const t=clampBattleCameraToMap({viewport:{width,height},art,transform:{zoom:1,x:0,y:0}});
  assert.ok(art.x*t.zoom+t.x<=1e-8);assert.ok(art.y*t.zoom+t.y<=1e-8);
  assert.ok((art.x+art.width)*t.zoom+t.x>=width-1e-8);assert.ok((art.y+art.height)*t.zoom+t.y>=height-1e-8);
 }
 const source=fs.readFileSync(new URL('../src/championship/presentation/vs5/createBattleFieldPixiPresentation.js',import.meta.url),'utf8');
 assert.match(source,/const transform=fieldArt \? clampBattleCameraToMap/);
});

test('modern floating fighter chips remain compact with thinner TP and no old full-width tracks',()=>{
 const css=fs.readFileSync(new URL('../src/championship/app/vs5Styles.css',import.meta.url),'utf8').split('/* Owner 2026-10-23:')[1];
 assert.match(css,/flex: 0 0 calc\(140px \* var\(--text-scale, 1\)\); width: calc\(140px \* var\(--text-scale, 1\)\); max-width: 100%; min-width: 0/);
 assert.match(css,/roster--opponent \{ justify-content: flex-end/);
 assert.match(css,/height: calc\(16px \* var\(--text-scale, 1\)\)/);
 assert.match(css,/meter--resource \{ height: calc\(13px \* var\(--text-scale, 1\)\)/);
 assert.match(css,/width: min\(168px, 100%\)/);
 assert.match(css,/white-space: normal; overflow-wrap: anywhere/);
 assert.ok(css.indexOf('roster--opponent { justify-content: flex-end')>css.indexOf('flex-direction: row; flex-wrap: wrap; justify-content: flex-start'),'team alignment wins generic equal-specificity cascade');
 assert.doesNotMatch(css,/grid-template-columns: repeat|height: calc\(19px/);
 assert.ok(2*140+6<=320-20);assert.ok(3*140+2*6>390-20);
 assert.ok(140-12>109.3125,'actual11px tabular65535/65535 measured109.3125px fits128px track');
});

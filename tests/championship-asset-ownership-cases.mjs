import test from 'node:test';
import assert from 'node:assert/strict';
import { createPixiAssetScope } from '../src/championship/presentation/pixiCharacterRuntimeBundle.js';

test('an initial failed runtime has no bundle disposer but can retry in the same live scope',async()=>{
  let loads=0,unloads=0;
  const PIXI={Assets:{async load(){if(++loads===1)throw Error('TEMPORARY_DECODE_FAILURE');return {ok:true};},async unload(){unloads++;}}};
  const scope=createPixiAssetScope(PIXI,'https://example.test/');
  await assert.rejects(scope.Assets.load('hatch/runtime.json'),/TEMPORARY_DECODE_FAILURE/);
  assert.deepEqual(await scope.Assets.load('hatch/runtime.json'),{ok:true});
  assert.equal(loads,2);await scope.Assets.unload('hatch/runtime.json');assert.equal(unloads,1);
});

const deferred = () => { let resolve; const promise = new Promise(r => resolve = r); return { promise, resolve }; };
const base = 'https://game.invalid/championship.html';

test('an aborted late texture closes its decoded bitmap once after the final source unload',async()=>{
  const pending=deferred(),controller=new AbortController();let closed=0,unloaded=0;
  const bitmap={close(){closed++;}},source={destroyed:false,resource:bitmap};
  const PIXI={Assets:{load:()=>pending.promise,async unload(){unloaded++;source.destroyed=true;source.resource=null;}}};
  const scope=createPixiAssetScope(PIXI,base,{signal:controller.signal}),loaded=scope.Assets.load('late.webp');
  controller.abort();pending.resolve({source});await loaded;await new Promise(resolve=>setImmediate(resolve));
  assert.equal(unloaded,1);assert.equal(closed,1);await scope.Assets.unload('late.webp');assert.equal(closed,1);
});

test('aborting a scope releases its late pixels and blocks subsequent loads', async () => {
  const download = deferred(), controller = new AbortController(); let unloads = 0;
  const PIXI = { Assets: { load: () => download.promise, unload: () => unloads++ } };
  const scope = createPixiAssetScope(PIXI, base, { signal: controller.signal });
  const pending = scope.Assets.load('late.png'); controller.abort();
  await assert.rejects(scope.Assets.load('next.png'), { name: 'AbortError' });
  download.resolve({ alive: true }); await pending; await new Promise(r => setImmediate(r));
  assert.equal(unloads, 1);
  await scope.Assets.unload('late.png'); assert.equal(unloads, 1);
});

test('aborting one scope cannot unload a shared texture still used by another scene', async () => {
  const download = deferred(), controller = new AbortController(); let unloads = 0;
  const PIXI = { Assets: { load: () => download.promise, unload: () => unloads++ } };
  const old = createPixiAssetScope(PIXI, base, { signal: controller.signal });
  const live = createPixiAssetScope(PIXI, base);
  const a = old.Assets.load('shared.png'), b = live.Assets.load('shared.png');
  controller.abort(); download.resolve({ alive: true });
  assert.equal(await a, await b); assert.equal(unloads, 0);
  await live.Assets.unload('shared.png'); assert.equal(unloads, 1);
});

test('an abandoned download cannot unload the replacement scene texture', async () => {
  const download = deferred(), calls = [];
  const PIXI = { Assets: { load: src => { calls.push(['load', src]); return download.promise; },
    unload: src => calls.push(['unload', src]) } };
  const old = createPixiAssetScope(PIXI, base), next = createPixiAssetScope(PIXI, base);
  const pending = old.Assets.load('hero.png');
  const replacement = next.Assets.load('https://game.invalid/hero.png');
  await old.Assets.unload('hero.png');
  download.resolve({ alive: true });
  assert.equal(await pending, await replacement);
  assert.deepEqual(calls, [['load', 'https://game.invalid/hero.png']]);
  await next.Assets.unload('hero.png');
  await next.Assets.unload('hero.png');
  assert.equal(calls.filter(([op]) => op === 'unload').length, 1);
});

test('reentry during final disposal waits for fresh pixels instead of returning a destroyed cache value', async () => {
  const disposal = deferred(); let loads = 0;
  const PIXI = { Assets: { load: () => ({ generation: ++loads }), unload: () => disposal.promise } };
  const old = createPixiAssetScope(PIXI, base), next = createPixiAssetScope(PIXI, base);
  assert.equal((await old.Assets.load('map.png')).generation, 1);
  const releasing = old.Assets.unload('map.png');
  const pending = next.Assets.load('map.png');
  await Promise.resolve(); assert.equal(loads, 1);
  disposal.resolve(); await releasing;
  assert.equal((await pending).generation, 2);
  await next.Assets.unload('map.png');
});

test('a failed download releases ownership and a later entry can retry', async () => {
  let attempts = 0, unloads = 0;
  const PIXI = { Assets: { load: async () => { if (++attempts === 1) throw new Error('offline'); return 'ready'; },
    unload: () => unloads++ } };
  const old = createPixiAssetScope(PIXI, base);
  await assert.rejects(old.Assets.load('map.png'), /offline/);
  const next = createPixiAssetScope(PIXI, base);
  assert.equal(await next.Assets.load('map.png'), 'ready');
  await old.Assets.unload('map.png');
  await next.Assets.unload('map.png');
  assert.equal(unloads, 1);
});

test('one bundle owns a repeated URL once and preserves an explicit parser', async () => {
  const calls = [];
  const PIXI = { Assets: { load: descriptor => { calls.push(descriptor); return {}; }, unload: src => calls.push(src) } };
  const scope = createPixiAssetScope(PIXI, base);
  assert.equal(await scope.Assets.load({ src: 'atlas.json', parser: 'json' }), await scope.Assets.load('atlas.json'));
  await scope.Assets.unload('atlas.json');
  assert.deepEqual(calls, [{ src: 'https://game.invalid/atlas.json', parser: 'json' }, 'https://game.invalid/atlas.json']);
});


// Exercise actual scene readiness through the existing elapsed driver. The
// lightweight Pixi nodes replace drawing only, never the scene or clock logic.
class ReadinessNode {
  constructor(options={}) { Object.assign(this,options); this.children=[]; this.events={};
    this.position={set:(x,y)=>{this.x=x;this.y=y;}};
    this.scale={x:1,y:1,set:(x,y=x)=>{this.scale.x=x;this.scale.y=y;}}; }
  addChild(...children){for(const child of children){child.parent=this;this.children.push(child);}return children[0];}
  addChildAt(child,index){child.parent=this;this.children.splice(index,0,child);}
  removeChild(child){this.children=this.children.filter(item=>item!==child);child.parent=null;}
  on(name,fn){this.events[name]=fn;} off(name){delete this.events[name];}
  destroy(){this.destroyed=true;}
  clear(){return this;} ellipse(){return this;} fill(){return this;} stroke(){return this;}
  circle(){return this;} poly(){return this;} rect(){return this;} roundRect(){return this;}
  moveTo(){return this;} lineTo(){return this;} star(){return this;}
}

test('resident replacement, failed art and retry suspend the existing clock without catch-up or another ticker',async()=>{
  const {mountRaisingFieldPixiPresentation}=await import('../src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js');
  const {createChampionshipClockDriver}=await import('../src/championship/app/championshipClockDriver.js');
  const listeners=new Set(),ticker={add:fn=>listeners.add(fn),remove:fn=>listeners.delete(fn)};
  const stage={PIXI:{Assets:{async load(){throw Error('OPTIONAL_ART_UNAVAILABLE');},async unload(){}},Container:ReadinessNode,Graphics:ReadinessNode,Text:ReadinessNode,ColorMatrixFilter:ReadinessNode,
    Rectangle:class{constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}}},
    app:{screen:{width:390,height:620},stage:new ReadinessNode(),canvas:new EventTarget(),ticker},
    createSceneRoot:()=>new ReadinessNode(),markScene:()=>()=>{},attach(){},onContextLost:()=>()=>{},onResize:()=>()=>{}};
  let frame={revision:1,cages:[{cageId:'a',name:'A',region:{x:0,y:0,w:1,h:1}}],
    residents:[{creatureId:'owned',speciesId:'species-017',displayName:'Owned',cageId:'a',lane:{x:.5,y:.5},facing:'left'}]};
  let publish;const source={getFrame:()=>frame,subscribe:fn=>{publish=fn;return()=>{};},intents:{selectCreature(){},relocateCreature(){}}};
  const available=new Set(['species-017']);let pending=deferred();
  const bundle={createActor:({speciesId})=>available.has(speciesId)?{sprite:new ReadinessNode()}:null,
    ensureSpecies:()=>pending.promise,dispose(){},getDiagnostics(){return{};}};
  const port=await mountRaisingFieldPixiPresentation({stage,source,characterBundle:bundle,reducedMotion:true});
  assert.equal(port.isPlayable,true);assert.equal(listeners.size,1,'one scene animation callback');
  const session={};let now=0,advanced=0;
  const app={getSession:()=>session,getClockRunState:()=>({running:true}),subscribeScreen:()=>()=>{},advanceNaturalClock:({frames})=>advanced+=frames};
  const clock=createChampionshipClockDriver({app,ticker,now:()=>now,isSceneReady:()=>port.isPlayable});clock.setActive(true);
  const clockTick=[...listeners].at(-1),tick=t=>{now=t;clockTick();};tick(0);tick(20);assert.equal(advanced,1);
  frame={...frame,revision:2,residents:[{...frame.residents[0],speciesId:'species-001'}]};publish(frame);
  assert.equal(port.isPlayable,false,'same resident ID now needs its owned egg pixels');
  for(let t=40;t<=4000;t+=20)tick(t);assert.equal(advanced,1);
  pending.resolve(false);await new Promise(r=>setImmediate(r));assert.equal(port.getDiagnostics().residentAssets[0].state,'error');
  assert.equal(port.isPlayable,false);tick(4020);assert.equal(advanced,1);
  pending=deferred();assert.equal(port.retryResidentAssets(),true);assert.equal(port.isPlayable,false);
  available.add('species-001');pending.resolve(true);await new Promise(r=>setImmediate(r));assert.equal(port.isPlayable,true);
  tick(9000);assert.equal(advanced,1,'ready starts a fresh elapsed baseline');tick(9020);assert.equal(advanced,2);
  assert.equal(listeners.size,2,'same one scene callback and one clock callback after retry');
  frame={...frame,revision:3,residents:[{...frame.residents[0],speciesId:'species-022'}]};pending=deferred();publish(frame);assert.equal(port.isPlayable,false);
  port.dispose();assert.equal(port.isPlayable,false);available.add('species-022');pending.resolve(true);await new Promise(r=>setImmediate(r));
  assert.equal(port.isPlayable,false,'late completion cannot revive a disposed scene');assert.equal(listeners.size,1);
  clock.dispose();assert.equal(listeners.size,0);
});

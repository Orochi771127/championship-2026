import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const base=new URL('../',import.meta.url),source=readFileSync(new URL('src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js',base),'utf8');
const helpers=source.slice(source.indexOf('  function evolutionLoadFailed('),source.indexOf('  function drawEvolution('));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b});return {promise,resolve,reject};};
const settle=()=>new Promise(r=>setImmediate(r));
function fixture(){
 const states=[],failures=[],visuals=[],requests=[];
 const controls={species:async()=>true,sequence:async()=>true,ready:false};
 const entry={root:{destroyed:false,children:[],addChildAt(s){this.children.push(s)}},evolutionActive:true,assetState:'ready'};
 const context={disposed:false,reportResidentAssets(){states.push(entry.evolutionAssetState)},onFallback(x){failures.push(x)},fieldArt:{field:{}},view:{},
 getRaisingNativeActorGeometry:()=>null,getRaisingNativePixelScale:()=>1,
 characterBundle:{ensureSpecies:id=>controls.species(id),createActor({speciesId}){
  const sprite={destroyed:false,scale:{set(){}},destroy(){this.destroyed=true}};
  const nativeFramePresenter={isFrameReady:()=>controls.ready,ensureFrame:frame=>{requests.push(frame.sequenceId);return controls.sequence(frame)}};
  const visual={sprite,nativeFramePresenter,entityId:speciesId};visuals.push(visual);return visual;
 }}};
 vm.runInNewContext(helpers+';Object.assign(globalThis,{loadEvolutionTarget,evolutionFrameReady,evolutionLoadFailed});',context);
 const event=(target=8,sequence=39)=>({target,targetFrame:{sequenceId:sequence,frameIndex:0}});
 return {context,entry,controls,states,failures,visuals,requests,event,load:(e=event())=>context.loadEvolutionTarget(entry,e)};
}
test('delayed sequence39 gates loading, attaches only after requested frame resolves',async()=>{
 const f=fixture(),d=deferred();f.controls.sequence=()=>d.promise;f.load();await settle();
 assert.equal(f.entry.evolutionAssetState,'loading');assert.deepEqual(f.requests,[39]);assert.equal(f.entry.root.children.length,0);
 d.resolve(true);await settle();assert.equal(f.entry.evolutionAssetState,'ready');assert.equal(f.entry.root.children.length,1);
});
test('ensureSpecies rejection surfaces error and explicit reload retries',async()=>{
 const f=fixture();f.controls.species=async()=>{throw Error('species unavailable')};f.load();await settle();
 assert.equal(f.entry.evolutionAssetState,'error');assert.equal(f.failures.length,1);assert.equal(f.visuals.length,0);
 f.controls.species=async()=>true;f.load();await settle();assert.equal(f.entry.evolutionAssetState,'ready');
});
test('sequence rejection destroys unattached visual; explicit reload retries',async()=>{
 const f=fixture();f.controls.sequence=async()=>{throw Error('page unavailable')};f.load();await settle();
 assert.equal(f.entry.evolutionAssetState,'error');assert.equal(f.visuals[0].sprite.destroyed,true);assert.match(f.failures[0],/page unavailable/);
 f.controls.sequence=async()=>true;f.load();await settle();assert.equal(f.entry.evolutionAssetState,'ready');
});
test('missing species result is recoverable, not ready',async()=>{
 const f=fixture();f.controls.species=async()=>false;f.load();await settle();assert.equal(f.entry.evolutionAssetState,'error');assert.match(f.failures[0],/RESIDENT_ART_UNAVAILABLE/);
});
test('disposal while target sequence pending destroys unattached sprite without publication',async()=>{
 const f=fixture(),d=deferred();f.controls.sequence=()=>d.promise;f.load();await settle();f.context.disposed=true;
 const n=f.states.length;d.resolve(true);await settle();assert.equal(f.visuals[0].sprite.destroyed,true);assert.equal(f.entry.root.children.length,0);assert.equal(f.states.length,n);
});
test('target supersession ignores pending old visual and preserves latest target',async()=>{
 const f=fixture(),d=deferred();let count=0;f.controls.sequence=()=>++count===1?d.promise:Promise.resolve(true);
 f.load();await settle();f.load(f.event(9));await settle();assert.equal(f.entry.evolutionTarget,9);assert.equal(f.entry.root.children.length,1);
 d.resolve(true);await settle();assert.equal(f.visuals[0].sprite.destroyed,true);assert.equal(f.entry.root.children.length,1);assert.equal(f.entry.evolutionTarget,9);
});
test('egg targets0/7 request sequence0 instead of39',async()=>{
 for(const target of [0,7]){const f=fixture();f.load(f.event(target,0));await settle();assert.deepEqual(f.requests,[0]);assert.equal(f.entry.evolutionAssetState,'ready');}
});
test('later missing sequence guarded, one request, explicit retry after reject',async()=>{
 const f=fixture();f.load();await settle();const d=deferred();f.controls.sequence=()=>d.promise;
 const frame={sequenceId:17};assert.equal(f.context.evolutionFrameReady(f.entry,frame),false);await settle();
 assert.equal(f.context.evolutionFrameReady(f.entry,frame),false);assert.deepEqual(f.requests,[39,17]);
 d.reject(Error('later page unavailable'));await settle();assert.equal(f.entry.evolutionAssetState,'error');
 f.controls.sequence=async()=>{f.controls.ready=true};assert.equal(f.context.evolutionFrameReady(f.entry,frame,{retry:true}),false);await settle();
 assert.equal(f.entry.evolutionAssetState,'ready');assert.equal(f.context.evolutionFrameReady(f.entry,frame),true);
});
test('resident source readiness implementation unchanged and candidate gates evolution loading/error',()=>{
 const old=readFileSync(new URL('tests/fixtures/evolution-texture-baseline-source-ready.txt',base),'utf8');
 const extract=s=>s.slice(s.indexOf('  function residentFrameReady('),s.indexOf('  // The canvas CSS rect'));
 assert.equal(extract(source),old);assert.match(source,/entry\.assetState === 'ready' && !\['loading','error'\]\.includes\(entry\.evolutionAssetState\)/);
});
test('recovery mount is root sibling outside inert field host, layered above lifecycle',()=>{
 const view=readFileSync(new URL('src/championship/app/raisingHomeP1RView.js',base),'utf8'),main=readFileSync(new URL('src/championship/app/main.js',base),'utf8'),css=readFileSync(new URL('src/championship/app/intRh2Styles.css',base),'utf8');
 assert.match(view,/mountField\(\{ host: fieldHost, recoveryHost: root/);assert.match(main,/\(recoveryHost\?\?host\)\.append\(status\)/);
 assert.match(css,/\.int-rh2-root > \.int-rh2-resident-assets--recovery \{ z-index:calc\(var\(--z-lifecycle\) \+ 1\)/);
});
test('actual scene isPlayable getter blocks source and target loading/error then resumes ready',()=>{
 const start=source.indexOf('    get isPlayable() {'),end=source.indexOf('    // The P1R DOM shell',start);
 const entry={speciesId:'species8',assetState:'ready'},context={disposed:false,lifetime:{signal:{aborted:false}},source:{getFrame:()=>({residents:[{creatureId:'id',speciesId:'species8'}]})},actors:new Map([['id',entry]])};
 vm.runInNewContext('globalThis.scene={'+source.slice(start,end)+'};',context);
 for(const state of ['loading','error']){entry.evolutionAssetState=state;assert.equal(context.scene.isPlayable,false);}
 entry.evolutionAssetState='ready';assert.equal(context.scene.isPlayable,true);
 entry.assetState='loading';assert.equal(context.scene.isPlayable,false);entry.assetState='ready';context.disposed=true;assert.equal(context.scene.isPlayable,false);
});
test('actual drawEvolution skips apply during delayed target preload then applies after ready',async()=>{
 const f=fixture(),d=deferred();f.controls.sequence=()=>d.promise;
 Object.assign(f.context,{source:{getLifecycleFrame:()=>({evolution:{instanceId:'resident'}})},evolutionCamera:{id:'resident',start:0,target:0},cameraX:0,
 layoutFieldArt(){},app:{screen:{height:844,width:390}},raisingNativeToScreen:()=>({x:100,y:100}),silhouette:{}});
 f.entry.root.position={set(){}};f.entry.root.scale={set(){}};f.entry.nativeScale=null;f.entry.sprite={};
 const draw=source.slice(source.indexOf('  function drawEvolution('),source.indexOf('  function drawTreatment('));
 vm.runInNewContext(draw+';globalThis.draw=drawEvolution;',f.context);
 const native={positionQ12:[0,0,0],evolution:{...f.event(),phase:0,elapsed:0,reveal:false}};
 assert.doesNotThrow(()=>f.context.draw(f.entry,native));await settle();assert.equal(f.entry.evolutionAssetState,'loading');
 assert.doesNotThrow(()=>f.context.draw(f.entry,native));let applies=0;f.visuals[0].nativeFramePresenter.apply=()=>{applies++};
 f.controls.ready=true;d.resolve(true);await settle();assert.doesNotThrow(()=>f.context.draw(f.entry,native));assert.equal(applies,1);
});
test('superseding an attached old target destroys and clears it immediately',async()=>{
 const f=fixture();f.load();await settle();const old=f.entry.evolutionSprite,d=deferred();f.controls.species=()=>d.promise;
 f.load(f.event(9));assert.equal(old.destroyed,true);assert.equal(f.entry.evolutionSprite,null);assert.equal(f.entry.evolutionPresenter,null);
 d.resolve(true);await settle();assert.equal(f.entry.evolutionAssetState,'ready');
});
test('externally ready shared sequence clears previous target error and pending gate',async()=>{
 const f=fixture();f.load();await settle();f.controls.sequence=async()=>{throw Error('temporary failure')};
 const frame={sequenceId:17};assert.equal(f.context.evolutionFrameReady(f.entry,frame),false);await settle();
 assert.equal(f.entry.evolutionAssetState,'error');assert.equal(f.entry.evolutionPendingFrame,frame);
 f.controls.ready=true;assert.equal(f.context.evolutionFrameReady(f.entry,frame),true);
 assert.equal(f.entry.evolutionAssetState,'ready');assert.equal(f.entry.evolutionAssetError,null);assert.equal(f.entry.evolutionPendingFrame,null);
});

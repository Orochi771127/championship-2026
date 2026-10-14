import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Execute actual actor function bodies with dependency stubs. This is not a
// runtime/Pixi or ROM parity check; it isolates the new cancellation branch.
function moduleFixture(){
 const source=fs.readFileSync(new URL('../src/championship/raising/nativeRaisingActor.js',import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace(/export /g,'');
 let rngCalls=0;
 const context=vm.createContext({structuredClone,
  BATTLE_SPECIES_ENTITIES:{8:'fixture'},
  BATTLE_CHARACTER_PROFILES:{fixture:{cells:[[0,0,20,77]],sequences:[0,1,5,11,15].map(id=>({id,frames:[{cell:0}]}))}},
  createNativeCharacterAnimationTimeline:()=>({getSnapshot:()=>({cell:0,active:false})}),
  normalizeNativeIndividualProfile:p=>p,
  nativeCarryPosition:p=>[p.x*4096,p.y*4096,77*4096],
  nativeReleaseVelocity:()=>[0,4096,0],
 });
 for(const dependency of ['nativeRaisingHand.js','nativeRaisingActivity.js']){
  const realSource=fs.readFileSync(new URL('../src/championship/raising/'+dependency,import.meta.url),'utf8').replace(/^import .*;$/gm,'').replace(/export /g,'');
  vm.runInContext(realSource,context);
 }
 vm.runInContext(source+'\nthis.api={beginNativeRaisingCarry,cancelNativeRaisingCarry,releaseNativeRaisingCarry,nativeRaisingHandAdmission,stepNativeActivityReaction};',context);
 return {api:context.api,rng:{next(){rngCalls++;throw Error('unexpected RNG')}},rngCalls:()=>rngCalls};
}
function actor(){return {speciesIndex:8,poolSlot:0,state:1,slow:0,positionQ12:[20*4096,40*4096,0],destinationQ12:[24*4096,40*4096,0],cageDefinitionIndex:35,idleCounter:17,foodSlot:null,station:-1,nativeFrame:123,growthFields:{'40c':2,'428':999},sequenceId:0,animator:{getSnapshot:()=>({cell:0})}};}
test('resize cancellation restores original actor ground/cage, never pointer/drop, preserves time and profile',()=>{
 const f=moduleFixture(),a=actor(),ground=[...a.positionQ12],profile={fields:{'19c':4,'01c':12,'18c':40}};
 const p=f.api.beginNativeRaisingCarry(a,profile,{x:300,y:150},{foods:[],rng:f.rng});
 assert.equal(a.state,6);assert.equal(a.detached,true);assert.notDeepEqual([...a.positionQ12],ground);
 a.positionQ12=[1000*4096,100*4096,77*4096];a.nativeFrame+=90;a.growthFields['428']=909;p.fields['18c']=43;
 const saved=JSON.stringify(p);assert.equal(f.api.cancelNativeRaisingCarry(a),true);
 assert.deepEqual([...a.positionQ12],ground);assert.deepEqual([...a.destinationQ12],ground);assert.equal(a.cageDefinitionIndex,35);assert.equal(a.detached,false);assert.equal(a.state,1);assert.equal(a.sequenceId,0);
 assert.equal(a.nativeFrame,213);assert.equal(a.growthFields['428'],909);assert.equal(a.growthFields['40c'],2);assert.equal(a.idleCounter,17);assert.equal(JSON.stringify(p),saved);assert.equal(f.rngCalls(),0);
 assert.equal(a.carryOrigin,null);assert.equal(a.carryPointer,null);assert.deepEqual([...a.velocityQ12],[0,0,0]);assert.equal(f.api.cancelNativeRaisingCarry(a),false);
});
test('ordinary release retains its existing flight/stress branch; resize cannot act on an already released actor',()=>{
 const f=moduleFixture(),a=actor();const p=f.api.beginNativeRaisingCarry(a,{fields:{'19c':4,'01c':12}},{x:90,y:100},{foods:[],rng:f.rng});
 const released=f.api.releaseNativeRaisingCarry(a,p);assert.equal(a.state,7);assert.equal(released.fields['01c'],13);assert.equal(a.carryOrigin,null);assert.equal(f.api.cancelNativeRaisingCarry(a),false);
});
test('standalone binds rollback only to resize; tutorial retains its checkpoint authority (source contract)',()=>{
 const source=fs.readFileSync(new URL('../src/championship/app/championshipStandaloneApp.js',import.meta.url),'utf8');
 assert.match(source,/cancelled&&reason==='viewport-resize'&&raisingHand.mode===3/);
 assert.match(source,/if\(actor&&cancelNativeRaisingCarry\(actor\)\)\{\s*raisingHand=null;publishRaising\(\);return true/);
 assert.match(source,/if\(cancelled\)\{actor.tutorialViewRevision=[\s\S]*tutorialRaisingPosition\(actor,recovery\?280:150/);
});
test('cancel a re-catch in flight resumes its pre-gesture trajectory rather than floating idle',()=>{
 const f=moduleFixture(),a=actor();a.state=7;a.detached=true;a.positionQ12=[120*4096,60*4096,30*4096];a.destinationQ12=[180*4096,80*4096,0];a.velocityQ12=[200,300,400];a.flightPhase=2;a.badThrow=false;a.flipBits=1;a.sequenceId=5;a.previousCageDefinition=35;a.carryCameraX=37;
 const origin={p:[...a.positionQ12],d:[...a.destinationQ12],v:[...a.velocityQ12]};
 f.api.beginNativeRaisingCarry(a,{fields:{'19c':0,'01c':12}},{x:500,y:180},{foods:[],rng:f.rng});assert.equal(a.state,6);a.carryCameraX=999;
 assert.equal(f.api.cancelNativeRaisingCarry(a),true);assert.equal(a.state,7);assert.equal(a.detached,true);assert.equal(a.flightPhase,2);assert.equal(a.sequenceId,5);assert.equal(a.badThrow,false);assert.equal(a.carryCameraX,37);
 assert.deepEqual([...a.positionQ12],origin.p);assert.deepEqual([...a.destinationQ12],origin.d);assert.deepEqual([...a.velocityQ12],origin.v);assert.equal(f.rngCalls(),0);
});
test('stale cancellation cannot overwrite a removed/replaced, evolved or non-carried actor',()=>{
 const f=moduleFixture();
 for(const mutation of [a=>{a.state=27},a=>{a.speciesIndex=9},a=>{a.carryOrigin=null}]){
  const a=actor();f.api.beginNativeRaisingCarry(a,{fields:{'19c':0,'01c':12}},{x:80,y:90},{foods:[],rng:f.rng});mutation(a);
  const before=JSON.stringify(a);assert.equal(f.api.cancelNativeRaisingCarry(a),false);assert.equal(JSON.stringify(a),before);
 }
});
test('actual hand admission and hop step: cancelling a state13 grab settles onto the same ground XY',()=>{
 const f=moduleFixture(),a=actor();a.state=13;a.activity={elapsed:31,phase:1,velocity:0x5000};a.flipBits=1;
 const ground={readTerrain:()=>0};
 assert.equal(f.api.nativeRaisingHandAdmission(a,0x80),true);
 f.api.stepNativeActivityReaction(a,ground,()=>{});assert.ok(a.positionQ12[2]>0);
 const xy=[...a.positionQ12].slice(0,2);
 f.api.beginNativeRaisingCarry(a,{fields:{'19c':0,'01c':12}},{x:600,y:140},{foods:[],rng:f.rng});
 assert.equal(f.api.cancelNativeRaisingCarry(a),true);assert.equal(a.state,1);assert.equal(a.activity,null);
 assert.deepEqual([...a.positionQ12],[...xy,0]);assert.deepEqual([...a.destinationQ12],[...xy,0]);assert.equal(f.rngCalls(),0);
});

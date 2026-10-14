import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Exercise the shipped mount owner without a browser, network or art fixture.
const main=readFileSync(new URL('../src/championship/app/main.js',import.meta.url),'utf8').replaceAll('\r\n','\n');
const binding=main.slice(main.indexOf('    mountField({ host,onReady,onError,progress=null }) {'),main.indexOf('    onExit: tutorial?undefined:'));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const flush=async()=>{for(let i=0;i<80;i++)await Promise.resolve();};

function fixture(loads={}){
  const events=[],warnings=[],resources={};
  for(const name of ['field','roster','effects','vfx','scene','audio'])resources[name]={released:0,
    dispose(){this.released++;},getDiagnostics:()=>({failures:[]})};
  const load=name=>loads[name]?loads[name](resources[name]):Promise.resolve(resources[name]);
  let sceneInputs=null;
  resources.scene.dispose=function(){
    this.released++;
    for(const resource of Object.values(sceneInputs??{}))resource.dispose();
  };
  const context=vm.createContext({AbortController,BATTLE_DYNAMIC_FX:false,RESPONSIVE_BATTLE_CANDIDATE:false,
    activeRuntime:{localTeamIndex:()=>0,markOpeningReady(){events.push('opening-ready');}},
    location:{href:'https://localhost/championship.html'},root:{dataset:{}},
    source:{getFrame:()=>({combatants:[]})},view:{render(){}},console:{warn(...args){warnings.push(args);}},
    settings:{audio:{output:()=>({})}},observeBattleFirstRender:()=>()=>{},recoveryDiagnostics:{record(){}},
    ensurePixiStage:async()=>({app:{renderer:{}}}),
    loadOptionalBattleFieldArt:()=>load('field'),loadOptionalCharacterReview:()=>load('roster'),
    loadRegisteredBattleEffectArt:()=>load('effects'),loadOptionalOriginalVfxReview:async(_stage,art)=>art,
    loadOptionalBattleVfxOverlay:()=>load('vfx'),
    mountBattleFieldPixiPresentation:async({fieldArt,characterRoster,effectArt})=>{
      events.push('mount');sceneInputs={fieldArt,characterRoster,effectArt};return load('scene');
    },mountBattleAudioPresentation:()=>{events.push('audio');return load('audio');}});
  const mount=vm.runInContext('({'+binding+'}).mountField',context);
  const owner=mount({host:{},onReady(){events.push('ready');},onError(){events.push('error');}});
  return {owner,resources,events,warnings,context};
}

for(const pending of ['field','roster','effects']){
  test(`exit releases completed art without waiting for pending ${pending}`,async()=>{
    const gate=deferred(),f=fixture({[pending]:()=>gate.promise});await flush();
    assert.deepEqual(f.events,[]);
    f.owner.dispose();f.owner.dispose();await flush();
    for(const name of ['field','roster','effects'])assert.equal(f.resources[name].released,name===pending?0:1,name);
    // Pending never needs to resolve for the preceding disposal to complete.
    gate.resolve(f.resources[pending]);await flush();
    for(const name of ['field','roster','effects'])assert.equal(f.resources[name].released,1,name);
    assert.deepEqual(f.events,[]);
  });
}

test('exit during required VFX releases all core art; a late VFX success releases exactly once',async()=>{
  const gate=deferred(),f=fixture({vfx:()=>gate.promise});await flush();f.owner.dispose();await flush();
  for(const name of ['field','roster','effects'])assert.equal(f.resources[name].released,1,name);
  assert.equal(f.resources.vfx.released,0);gate.resolve(f.resources.vfx);await flush();
  for(const name of ['field','roster','effects','vfx'])assert.equal(f.resources[name].released,1,name);
  assert.deepEqual(f.events,[]);
});

test('late core and VFX rejection after exit cannot remount or show an obsolete error',async()=>{
  for(const name of ['field','vfx']){
    const gate=deferred(),f=fixture({[name]:()=>gate.promise});await flush();f.owner.dispose();await flush();
    gate.reject(Error('ABANDONED_LOAD'));await flush();assert.deepEqual(f.events,[]);
    assert.equal(f.resources.effects.released,1);assert.equal(f.context.root.dataset.fieldFallback,undefined);
  }
});

test('a rejected core peer releases completed art even while another core peer never settles',async()=>{
  const failed=deferred(),pending=deferred(),f=fixture({field:()=>failed.promise,roster:()=>pending.promise});await flush();
  failed.reject(Error('CORE_FAILED'));await flush();assert.equal(f.resources.effects.released,1);
  assert.deepEqual(f.events,[],'preserve the existing all-settled error/readiness gate');
  pending.resolve(f.resources.roster);await flush();assert.equal(f.resources.roster.released,1);
  assert.deepEqual(f.events,['error']);f.owner.dispose();await flush();assert.equal(f.resources.effects.released,1);
});

test('missing core art releases early and a later successful peer cannot retain resources',async()=>{
  const gate=deferred(),f=fixture({field:async()=>null,roster:()=>gate.promise});await flush();
  assert.equal(f.resources.effects.released,1);gate.resolve(f.resources.roster);await flush();
  assert.equal(f.resources.roster.released,1);assert.deepEqual(f.events,['error']);f.owner.dispose();await flush();
  assert.equal(f.resources.roster.released,1);
});

test('ordinary successful mount transfers inputs to scene and releases each once',async()=>{
  const f=fixture();await flush();assert.deepEqual(f.events,['mount','ready','opening-ready','audio']);
  for(const resource of Object.values(f.resources))assert.equal(resource.released,0);
  f.owner.dispose();f.owner.dispose();await flush();
  for(const [name,resource] of Object.entries(f.resources))assert.equal(resource.released,1,name);
});

test('scene construction failure returns input ownership to caller exactly once',async()=>{
  const f=fixture({scene:async()=>{throw Error('SCENE_FAILED');}});await flush();
  assert.deepEqual(f.events,['mount','error']);
  for(const name of ['field','roster','effects','vfx'])assert.equal(f.resources[name].released,1,name);
  assert.equal(f.resources.scene.released,0);f.owner.dispose();await flush();
  for(const name of ['field','roster','effects','vfx'])assert.equal(f.resources[name].released,1,name);
});

test('exit during scene construction protects borrowed inputs, then releases the late owning scene',async()=>{
  const gate=deferred(),f=fixture({scene:()=>gate.promise});await flush();assert.deepEqual(f.events,['mount']);
  f.owner.dispose();await flush();
  for(const name of ['field','roster','effects'])assert.equal(f.resources[name].released,0,name);
  assert.equal(f.resources.vfx.released,1);gate.resolve(f.resources.scene);await flush();
  for(const name of ['field','roster','effects','vfx','scene'])assert.equal(f.resources[name].released,1,name);
  assert.deepEqual(f.events,['mount']);
});

test('a scene rejection after exit releases borrowed inputs without an obsolete error',async()=>{
  const gate=deferred(),f=fixture({scene:()=>gate.promise});await flush();f.owner.dispose();await flush();
  gate.reject(Error('LATE_SCENE_FAILED'));await flush();
  for(const name of ['field','roster','effects','vfx'])assert.equal(f.resources[name].released,1,name);
  assert.deepEqual(f.events,['mount']);
});

test('a failed disposer cannot block the other owned resources from releasing',async()=>{
  const gate=deferred(),f=fixture({vfx:()=>gate.promise});await flush();
  f.resources.field.dispose=function(){this.released++;throw Error('DISPOSE_FAILED');};
  f.owner.dispose();await flush();
  for(const name of ['field','roster','effects'])assert.equal(f.resources[name].released,1,name);
  assert.equal(f.warnings.length,1);gate.reject(Error('LATE_VFX_FAILED'));await flush();assert.deepEqual(f.events,[]);
});

import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const base = new URL('../', import.meta.url);
const source = readFileSync(new URL('tests/fixtures/evolution-texture-baseline-draw.txt',base),'utf8');
const drawSource = source;
assert.ok(drawSource.includes('entry.evolutionPresenter?.apply(e.targetFrame)'));
const presenterCode=readFileSync(new URL('src/championship/presentation/nativeHuntCharacterAction.js',base),'utf8');
const {createNativeHuntCharacterFramePresenter}=await import(new URL('src/championship/presentation/nativeHuntCharacterAction.js',base));
function setup({target=8,sequence=39,loaded39=false}={}) {
  const idle={key:'idle'},evolving={key:'evolving'}, textures=new Map([['fixture/main/idle',idle]]);
  if(loaded39)textures.set('fixture/main/evolving',evolving);
  const sprite={texture:idle,visible:false,scale:{set(){}},position:{set(){}}};
  const presenter=createNativeHuntCharacterFramePresenter({sprite,entityId:'fixture',textureResolver:key=>textures.get(key),
    animations:[{id:0,playbackMode:2,frames:[{texture:'fixture/main/idle',cell:0}]},{id:39,playbackMode:2,frames:[{texture:'fixture/main/evolving',cell:39}]}]});
  let checks=0,ensures=0;
  const wrapped={...presenter,isFrameReady(){checks++;return textures.has(sequence===39?'fixture/main/evolving':'fixture/main/idle');},ensureFrame(){ensures++;textures.set('fixture/main/evolving',evolving);return Promise.resolve(true);}};
  const root={x:100,y:100,position:{set(){}},scale:{set(){}}};
  const entry={root,nativeScale:null,sprite:{visible:true},evolutionSprite:sprite,evolutionPresenter:wrapped,evolutionTarget:target};
  const native={positionQ12:[409600,409600,0],evolution:{target,phase:0,elapsed:0,reveal:false,targetFrame:{contract:'HUNT_CHARACTER_PRESENTATION.v1',sequenceId:sequence,frameIndex:0,flipBits:0}}};
  const context={source:{getLifecycleFrame:()=>({evolution:{instanceId:'resident'}})},evolutionCamera:{id:'resident',start:0,target:0},cameraX:0,
    layoutFieldArt(){},fieldArt:{field:{}},view:{},app:{screen:{height:844,width:390}},raisingNativeToScreen:()=>({x:100,y:100}),silhouette:{},entry,native};
  vm.runInNewContext(drawSource+';globalThis.draw=drawEvolution;',context);
  return {draw:()=>context.draw(entry,native),counts:()=>({checks,ensures}),sprite,evolving};
}
test('baseline target>=8 missing sequence39 throws exact reported error before requesting streamed frame, even while invisible',()=>{
  const f=setup();
  assert.throws(f.draw,{name:'RangeError',message:'NATIVE_CHARACTER_TEXTURE_MISSING:fixture:39:0:fixture/main/evolving'});
  assert.deepEqual(f.counts(),{checks:0,ensures:0});
  assert.equal(f.sprite.visible,false);
});
test('baseline succeeds when sequence39 page happened to be resident',()=>{
  const f=setup({loaded39:true});assert.doesNotThrow(f.draw);assert.equal(f.sprite.texture,f.evolving);
});
test('baseline egg target0 uses resident sequence0 and does not throw',()=>{
  const f=setup({target:0,sequence:0});assert.doesNotThrow(f.draw);assert.deepEqual(f.counts(),{checks:0,ensures:0});
});
test('baseline egg target7 uses resident sequence0 and does not throw',()=>{
  const f=setup({target:7,sequence:0});assert.doesNotThrow(f.draw);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BATTLE_CHARACTER_PROFILES,BATTLE_SPECIES_ENTITIES} from '../src/data/championship/battleCharacterProfiles.js';
import {BATTLE_CHARACTER_GEOMETRY} from '../src/data/championship/battleCharacterGeometry.js';
import {createBattleCharacterAnimator,projectBattleCharacterRequest} from '../src/championship/presentation/battleCharacterAction.js';
import {battleSpecialPreludeInputs,sampleBattleSpecialPrelude} from '../src/championship/battle/battleSpecialPrelude.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const base='assets/production/internal-faithful-baseline/characters-v1/';

test('all 228 species bindings resolve their own registered identities, including the four source aliases',()=>{
  const manifest=read(base+'manifest.json');
  assert.equal(BATTLE_SPECIES_ENTITIES.length,228);
  assert.equal(new Set(BATTLE_SPECIES_ENTITIES).size,224);
  for(let i=0;i<228;i++){
    assert.equal(manifest.speciesBindings[i].speciesId,`species-${String(i).padStart(3,'0')}`);
    assert.equal(manifest.speciesBindings[i].entityId,BATTLE_SPECIES_ENTITIES[i]);
    assert.ok(BATTLE_CHARACTER_GEOMETRY[BATTLE_SPECIES_ENTITIES[i]]);
  }
});

test('all 8656 raw Main sequences resolve every production frame and preserve original completion or loop behavior',()=>{
  let total=0;
  for(const [entity,profile] of Object.entries(BATTLE_CHARACTER_PROFILES)){
    const runtime=read(base+entity+'/runtime.json'),animations=runtime.sides.main.animations;
    assert.equal(animations.length,entity.startsWith('e')?2:40);
    for(const raw of animations){
      total++;
      const meta=profile.sequences.find(a=>a.id===raw.id);
      assert.deepEqual(meta.frames,raw.frames.map(({cell,ticks})=>({cell,ticks})));
      const sprite={texture:'identity',anchor:{x:.5,y:1}};
      const player=createBattleCharacterAnimator({sprite,animations,geometry:BATTLE_CHARACTER_GEOMETRY[entity],textureResolver:key=>key});
      let frame=0;
      for(let i=0;i<raw.frames.length;i++){
        const actual=player.apply({battleFrame:frame,sequenceId:raw.id,nativeRequest:true});
        assert.equal(actual.cell,raw.frames[i].cell,`${entity}/${raw.id}/${i}`);
        assert.equal(actual.frameIndex,i);
        assert.ok(actual.geometry);
        frame+=raw.frames[i].ticks;
      }
      const final=player.apply({battleFrame:frame,sequenceId:raw.id,nativeRequest:true});
      assert.equal(final.active,raw.playbackMode===1?0:1,`${entity}/${raw.id}`);
      assert.equal(final.frameIndex,raw.playbackMode===1?raw.frames.length-1:raw.loopStartFrame??0);
      assert.deepEqual(player.apply({battleFrame:frame,sequenceId:raw.id,nativeRequest:true}),final);
    }
  }
  assert.equal(total,8656);
});

test('every one of 325 special-prelude records takes its own species pose and restoration timing',()=>{
  const moves=read('src/data/championship/catalogs/battle-moves.r1.json').records;
  let count=0;const species=new Set();
  for(const move of moves){
    const input=battleSpecialPreludeInputs(move.speciesId,move);
    if(move.pointer1C!==0x02120900){assert.equal(input,null);continue;}
    count++;species.add(move.speciesId);assert.ok(input,`move ${move.recordIndex}`);
    const runtime=read(base+BATTLE_SPECIES_ENTITIES[move.speciesId]+'/runtime.json');
    const pose=runtime.sides.main.animations.find(a=>a.id===33);
    assert.equal(input.poseTicks,pose.frames.reduce((n,f)=>n+f.ticks,0));
    const restore=runtime.sides.main.animations.find(a=>a.id===move.field10+7);
    assert.equal(input.returnTicks,restore.frames[0].ticks);
    const end=sampleBattleSpecialPrelude(input,0).endFrame;
    assert.equal(sampleBattleSpecialPrelude(input,end-1).active,true);
    assert.equal(sampleBattleSpecialPrelude(input,end).active,false);
  }
  assert.equal(count,325);assert.ok(species.size>100);
});

test('real notifications take precedence over the temporary committed-move presentation',()=>{
  const committedAction={move:{field10:0}};
  assert.equal(projectBattleCharacterRequest({currentHp:100,committedAction,field17C:15,field84:3}).sequenceId,37);
  assert.equal(projectBattleCharacterRequest({currentHp:100,committedAction,field17C:15,field84:12,statusCode:12}).sequenceId,36);
  assert.equal(projectBattleCharacterRequest({currentHp:100,committedAction,field17C:20,battleEnding:0}).sequenceId,33);
  assert.equal(projectBattleCharacterRequest({currentHp:100,committedAction,field17C:15}).sequenceId,null);
});

test('an action first rendered several simulation frames late uses its actual sampled start frame',()=>{
  const entity='m313_gargomon',animations=read(base+entity+'/runtime.json').sides.main.animations;
  const make=()=>createBattleCharacterAnimator({sprite:{texture:'identity'},animations,geometry:BATTLE_CHARACTER_GEOMETRY[entity],textureResolver:x=>x});
  const continuous=make(),late=make();
  continuous.apply({battleFrame:10,sequenceId:7,sequenceStartFrame:10});
  const expected=continuous.apply({battleFrame:17,sequenceId:7,sequenceStartFrame:10});
  assert.deepEqual(late.apply({battleFrame:17,sequenceId:7,sequenceStartFrame:10}),expected);
});

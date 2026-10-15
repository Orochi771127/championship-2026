import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {BATTLE_CHARACTER_PROFILES,BATTLE_SPECIES_ENTITIES,BATTLE_SPECIES_MOVEMENT} from '../src/data/championship/battleCharacterProfiles.js';
import {BATTLE_CHARACTER_GEOMETRY} from '../src/data/championship/battleCharacterGeometry.js';
import {createBattleCharacterAnimator,projectBattleCharacterRequest} from '../src/championship/presentation/battleCharacterAction.js';
import {battleSpecialPreludeInputs,sampleBattleSpecialPrelude} from '../src/championship/battle/battleSpecialPrelude.js';
import {spawnSync} from 'node:child_process';
import {ACTIVE_ALTERNATE_FORM_ASSETS, rekeyAlternateDonorRuntime, bindAlternateFormManifest} from '../src/championship/presentation/alternateFormAssetContracts.js';
import {createHash} from 'node:crypto';

// The shipping imports above are intentionally unhooked. Only a separate child
// process disables the alternate assets to retain the original native oracles.
const nativeReferenceFlag = '--asset-disabled-native-reference';
const isNativeReference = process.argv.includes(nativeReferenceFlag);
const assetDisabledBootstrap = `
  import {registerHooks} from 'node:module';
  registerHooks({load(url, context, nextLoad) {
    const loaded = nextLoad(url, context);
    if (!url.endsWith('/alternate-form-assets.r1.json')) return loaded;
    const catalog = JSON.parse(String(loaded.source));
    for (const config of catalog.characters) {
      config.runtimeReady = false;
      config.qa = {...config.qa, normalPath: 'PENDING'};
    }
    return {...loaded, source: JSON.stringify(catalog)};
  }});
`;
function runNativeReference(code) {
  const env = {...process.env};
  delete env.NODE_TEST_CONTEXT;
  const result = spawnSync(process.execPath, ['--input-type=module', '--eval', assetDisabledBootstrap + code], {
    cwd: new URL('..', import.meta.url), env, encoding: 'utf8', maxBuffer: 32 * 1024 * 1024,
  });
  assert.ifError(result.error);
  assert.equal(result.signal, null, 'Native reference child must finish without a signal.');
  assert.equal(result.status, 0, `Asset-disabled native reference failed:\n${result.stderr}\n${result.stdout}`);
  return result.stdout;
}
function readNativeSnapshot(modulePath, expression) {
  const moduleUrl = new URL(modulePath, import.meta.url).href;
  return JSON.parse(runNativeReference(`const native = await import(${JSON.stringify(moduleUrl)}); console.log(JSON.stringify(${expression}));`));
}
const expectedAlternateBindings = [
  [211, 'm528_metaletemon', 'm528_metaletemon'],
  [222, 'm540_imperialdramon_fm', 'm506_griffomon'],
  [229, 'oc_crownbrass_mandrill', 'm528_metaletemon'],
  [230, 'oc_celestyrant_battle_r10', 'm540_imperialdramon_fm'],
];
function assertProductionAssets() {
  assert.deepEqual(ACTIVE_ALTERNATE_FORM_ASSETS.map(c => [c.speciesIndex, c.entityId, c.motionDonorEntityId])
    .sort((a, b) => a[0] - b[0]), expectedAlternateBindings);
  for (const config of ACTIVE_ALTERNATE_FORM_ASSETS) {
    assert.equal(config.runtimeReady, true);
    assert.equal(config.qa.normalPath, 'PASS');
  }
}

if (isNativeReference) {
  test('native reference explicitly disables alternate assets without changing the original oracle', () => {
    assert.equal(ACTIVE_ALTERNATE_FORM_ASSETS.length, 0);
  });
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

} else {
  test('asset-disabled child preserves every original local-reference case', () => {
    runNativeReference(`process.argv.push(${JSON.stringify(nativeReferenceFlag)}); await import(${JSON.stringify(import.meta.url)});`);
  });

  test('production generated bindings retain native 0..227 and activate exactly four alternate adapters', () => {
    assertProductionAssets();
    const native = readNativeSnapshot('../src/data/championship/battleCharacterProfiles.js', `({
      entities: native.BATTLE_SPECIES_ENTITIES, movement: native.BATTLE_SPECIES_MOVEMENT,
      profiles: native.BATTLE_CHARACTER_PROFILES
    })`);
    assert.equal(native.entities.length, 228);
    assert.equal(Object.keys(native.profiles).length, 224);
    assert.equal(Object.values(native.profiles).reduce((n, p) => n + p.sequences.length, 0), 8656);
    assert.equal(BATTLE_SPECIES_ENTITIES.length, 231);
    assert.equal(BATTLE_SPECIES_ENTITIES[228], null);
    assert.equal(new Set(BATTLE_SPECIES_ENTITIES.filter(id => id !== null)).size, 226);
    assert.equal(Object.keys(BATTLE_CHARACTER_PROFILES).length, 226);
    assert.equal(Object.keys(BATTLE_CHARACTER_GEOMETRY).length, 226);
    assert.deepEqual(BATTLE_SPECIES_ENTITIES.slice(0, 228), native.entities);
    assert.deepEqual(BATTLE_SPECIES_MOVEMENT.slice(0, 228), native.movement);
    assert.equal(BATTLE_SPECIES_MOVEMENT[228], null);
    for (const config of ACTIVE_ALTERNATE_FORM_ASSETS) {
      assert.equal(BATTLE_SPECIES_ENTITIES[config.speciesIndex], config.entityId);
      assert.deepEqual(BATTLE_CHARACTER_PROFILES[config.entityId], native.profiles[config.motionDonorEntityId], config.entityId);
    }
    assert.notEqual(BATTLE_SPECIES_ENTITIES[229], BATTLE_SPECIES_ENTITIES[211]);
    assert.notEqual(BATTLE_SPECIES_ENTITIES[230], BATTLE_SPECIES_ENTITIES[222]);
    assert.equal(Object.keys(BATTLE_CHARACTER_PROFILES.m540_imperialdramon_fm.cells).length, 61);
    assert.equal(Object.keys(BATTLE_CHARACTER_PROFILES.oc_celestyrant_battle_r10.cells).length, 63);
    assert.deepEqual(BATTLE_SPECIES_MOVEMENT[229], native.movement[211]);
    assert.deepEqual(BATTLE_SPECIES_MOVEMENT[230], native.movement[222]);
    const replacements = new Set(ACTIVE_ALTERNATE_FORM_ASSETS.map(c => c.entityId));
    for (const [id, profile] of Object.entries(native.profiles)) {
      if (!replacements.has(id)) assert.deepEqual(BATTLE_CHARACTER_PROFILES[id], profile, id);
    }
  });

  test('production raw donor runtimes rekey all 160 Main sequences without changing motion or completion', () => {
    assertProductionAssets();
    const base = 'assets/production/internal-faithful-baseline/characters-v1/';
    let total = 0;
    for (const config of ACTIVE_ALTERNATE_FORM_ASSETS) {
      // Read the real native donor, never an imaginary native folder for an OC.
      const donorPath = new URL('../' + base + config.motionDonorEntityId + '/runtime.json', import.meta.url);
      const bytes = fs.readFileSync(donorPath);
      assert.equal(createHash('sha256').update(bytes).digest('hex'), config.baselineRuntimeSha256);
      const donor = JSON.parse(bytes), before = structuredClone(donor);
      const runtime = rekeyAlternateDonorRuntime(donor, config);
      assert.deepEqual(donor, before);
      assert.equal(runtime.entityId, config.entityId);
      assert.equal(runtime.sides.main.animations.length, 40);
      const profile = BATTLE_CHARACTER_PROFILES[config.entityId];
      for (const raw of runtime.sides.main.animations) {
        total++;
        const original = donor.sides.main.animations.find(a => a.id === raw.id);
        assert.deepEqual(raw, {...original, frames: original.frames.map(frame => ({
          ...frame, texture: config.entityId + frame.texture.slice(config.motionDonorEntityId.length),
        }))});
        assert.deepEqual(profile.sequences.find(a => a.id === raw.id).frames, raw.frames.map(({cell, ticks}) => ({cell, ticks})));
        const player = createBattleCharacterAnimator({sprite: {texture: 'identity'}, animations: runtime.sides.main.animations,
          geometry: BATTLE_CHARACTER_GEOMETRY[config.entityId], textureResolver: key => key});
        let frame = 0;
        for (let i = 0; i < raw.frames.length; i++) {
          const actual = player.apply({battleFrame: frame, sequenceId: raw.id, nativeRequest: true});
          assert.equal(actual.frameIndex, i);
          assert.equal(actual.cell, raw.frames[i].cell);
          assert.equal(actual.texture, raw.frames[i].texture);
          assert.ok(actual.geometry);
          frame += raw.frames[i].ticks;
        }
        const final = player.apply({battleFrame: frame, sequenceId: raw.id, nativeRequest: true});
        assert.equal(final.active, raw.playbackMode === 1 ? 0 : 1);
        assert.equal(final.frameIndex, raw.playbackMode === 1 ? raw.frames.length - 1 : raw.loopStartFrame ?? 0);
        assert.deepEqual(player.apply({battleFrame: frame, sequenceId: raw.id, nativeRequest: true}), final);
      }
    }
    assert.equal(total, 160);
  });
}

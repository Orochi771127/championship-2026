import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import path from 'node:path';
import {resolveBattleCharacterRequest,projectBattleCharacterRequest,createBattleCharacterAnimator} from '../src/championship/presentation/battleCharacterAction.js';
import {BATTLE_CHARACTER_GEOMETRY} from '../src/data/championship/battleCharacterGeometry.js';
import {loadLicensedCharacterRoster,LICENSED_CHARACTER_MANIFEST} from '../src/championship/presentation/licensedCharacterRoster.js';
import {spawnSync} from 'node:child_process';
import {ACTIVE_ALTERNATE_FORM_ASSETS, rekeyAlternateDonorRuntime, bindAlternateFormManifest} from '../src/championship/presentation/alternateFormAssetContracts.js';

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
const cpu=read('docs/research/BATTLE_CHARACTER_REQUESTS_CPU_2026-09-07.json');
const base='assets/production/internal-faithful-baseline/characters-v1/';
const entity='m313_gargomon';
const animations=read(base+entity+'/runtime.json').sides.main.animations;
function animator(options={}) {
  const sprite={texture:'identity',anchor:{x:.5,y:1}};
  return {sprite,player:createBattleCharacterAnimator({sprite,animations,geometry:BATTLE_CHARACTER_GEOMETRY[entity],textureResolver:key=>key,...options})};
}

test('117 original OVL19 handler cases match the raw sequence selector; unknown notifications stay unknown',()=>{
  assert.equal(cpu.requests.length,117);
  for(const sample of cpu.requests)assert.equal(resolveBattleCharacterRequest(sample),sample.sequenceId);
  for(const notification of [13,14,15,16,17,20,22,23,24,25,26,-1,'8'])
    assert.equal(resolveBattleCharacterRequest({notification,currentHp:100}),null);
  assert.equal(resolveBattleCharacterRequest({notification:0}),null);
});

test('232 original CPU entry branches choose reactions by hit variant, status and end-of-battle flag',()=>{
  assert.equal(cpu.reactionEntries.length,232);
  for(const sample of cpu.reactionEntries)assert.equal(resolveBattleCharacterRequest(sample),sample.sequenceId,JSON.stringify(sample));
});

test('all 49 original ARM9 SetIfChanged cases retain or reset elapsed time correctly',()=>{
  assert.equal(cpu.equalRequests.length,49);
  for(const sample of cpu.equalRequests){
    const {player}=animator();
    player.apply({battleFrame:0,sequenceId:sample.current});
    const before=player.apply({battleFrame:1,sequenceId:sample.current});
    const after=player.apply({battleFrame:1,sequenceId:sample.requested});
    assert.equal(after.elapsedQ12,sample.restart?0:before.elapsedQ12,JSON.stringify(sample));
    assert.equal(after.sequenceId,sample.requested);
  }
});

test('the four dispatch families select 7-10 and a down actor selects 15 without changing gameplay',()=>{
  for(let family=0;family<4;family++){
    const actor={currentHp:100,committedAction:{move:{field10:family}}};
    const before=structuredClone(actor),request=projectBattleCharacterRequest(actor);
    assert.equal(request.sequenceId,family+7);
    assert.match(request.timingEvidence,/TIMING_PARTIAL/);
    assert.deepEqual(actor,before);
  }
  assert.equal(projectBattleCharacterRequest({currentHp:0,committedAction:{move:{field10:0}}}).sequenceId,15);
  assert.equal(projectBattleCharacterRequest({currentHp:100}).sequenceId,0);
  assert.equal(projectBattleCharacterRequest({currentHp:100,committedAction:{move:{field10:8}}}).sequenceId,null);
});

test('native attack frames advance once per battle frame, stop at the end, and redraw never restarts them',()=>{
  const {player,sprite}=animator();
  const initial=player.apply({battleFrame:0,sequenceId:7});
  assert.equal(initial.frameIndex,0);
  const next=player.apply({battleFrame:6,sequenceId:7});
  assert.equal(next.frameIndex,1);
  assert.notEqual(next.texture,initial.texture);
  assert.equal(sprite.texture,next.texture);
  assert.deepEqual(player.apply({battleFrame:6,sequenceId:7}),next);
  const ended=player.apply({battleFrame:80,sequenceId:7});
  assert.equal(ended.active,0);
  assert.equal(ended.frameIndex,6);
  assert.deepEqual(player.apply({battleFrame:100,sequenceId:7}),ended);
  assert.throws(()=>player.apply({battleFrame:99,sequenceId:7}),/MONOTONIC/);
});

test('native force-and-seek starts attack frame 2 then restarts the same sequence at recovery frame 3 once',()=>{
  const {player}=animator();
  const attack={sequenceId:7,nativeRequest:true,sequenceInitialFrame:2,sequenceRequestId:1,sequenceStartFrame:0};
  assert.equal(player.apply({...attack,battleFrame:0}).frameIndex,2);
  assert.equal(player.apply({...attack,battleFrame:6}).frameIndex,4);
  const recovery={...attack,sequenceInitialFrame:3,sequenceRequestId:2,sequenceStartFrame:6};
  assert.equal(player.apply({...recovery,battleFrame:6}).elapsedQ12,0);
  const next=player.apply({...recovery,battleFrame:7});
  assert.equal(next.elapsedQ12,4096);
  assert.deepEqual(player.apply({...recovery,battleFrame:7}),next);
  assert.equal(player.apply({...recovery,sequenceInitialFrame:65535,sequenceRequestId:3,sequenceStartFrame:7,battleFrame:7}).frameIndex,0);
});

test('reduced motion keeps the action identity; unsupported raw slots restore the original texture and anchor',()=>{
  const {player,sprite}=animator({reducedMotion:true});
  player.apply({battleFrame:0,sequenceId:7});
  const result=player.apply({battleFrame:30,sequenceId:7});
  assert.equal(result.frameIndex,0);
  assert.equal(result.sequenceId,7);
  sprite.anchor.x=.13;sprite.anchor.y=.21;
  assert.equal(player.apply({battleFrame:31,sequenceId:33}),null);
  assert.equal(sprite.texture,'identity');
  assert.deepEqual(sprite.anchor,{x:.5,y:1});
});

test('native actor snapshots freeze visual frames through exclusive/global pauses and late mounts',()=>{
  const {player}=animator(),sample=player.apply({battleFrame:0,sequenceId:7});
  const frozen=player.apply({battleFrame:120,sequenceId:7,nativeRequest:true,nativeSample:sample});
  assert.equal(frozen.frameIndex,sample.frameIndex);assert.equal(frozen.elapsedQ12,sample.elapsedQ12);
  const {player:late}=animator();
  assert.equal(late.apply({battleFrame:500,sequenceId:7,nativeRequest:true,nativeSample:sample}).frameIndex,sample.frameIndex);
  assert.throws(()=>late.apply({battleFrame:501,sequenceId:7,nativeRequest:true,nativeSample:{...sample,cell:9999}}),/SAMPLE_MISMATCH/);
});

test('all 13246 production Main cells retain verified per-frame packing, trim origin and current file hashes',()=>{
  let cells=0;const scales=new Set();
  for(const [id,geometry] of Object.entries(BATTLE_CHARACTER_GEOMETRY)){
    for(const [name,hash] of geometry.files)
      assert.equal(createHash('sha256').update(fs.readFileSync(base+name)).digest('hex'),hash);
    const runtime=read(base+id+'/runtime.json');
    const atlases=runtime.sides.main.atlases.map(a=>read(base+id+'/'+a.data));
    for(const [texture,g] of Object.entries(geometry.frames)){
      cells++;if(g.blank)continue;
      scales.add(g.scale);
      const packed=atlases.map(a=>a.frames[texture]).find(Boolean);
      assert.deepEqual([packed.sourceSize.w,packed.sourceSize.h],g.sourceSize);
      const rect=packed.spriteSourceSize;
      assert.deepEqual([(rect.x-g.origin[0])/g.scale,(rect.y-g.origin[1])/g.scale,
        (rect.x+rect.w-g.origin[0])/g.scale,(rect.y+rect.h-g.origin[1])/g.scale],g.nativeBounds);
    }
    for(const sequence of runtime.sides.main.animations)
      for(const frame of sequence.frames)assert.ok(geometry.frames[frame.texture]);
  }
  assert.equal(cells,13246);
  assert.equal(Object.keys(BATTLE_CHARACTER_GEOMETRY).length,224);
  assert.ok(scales.size>1,'using one atlas scale for all frames would be incorrect');
});

test('battle animation is scoped to audited entities and rejects stale geometry hashes',async()=>{
  const manifest=read(LICENSED_CHARACTER_MANIFEST),productionIndex=read('assets/production/ART_PRODUCTION_INDEX.json');
  const captured=[];
  const loadBundle=async()=>({createActor:request=>{captured.push(request);return {sprite:{}};},dispose(){}});
  const options={PIXI:{},speciesIds:['species-081','species-000'],manifest,productionIndex,
    manifestUrl:pathToFileURL(path.resolve(LICENSED_CHARACTER_MANIFEST)).href,loadBundle};
  const roster=await loadLicensedCharacterRoster(options);
  roster.createActor({speciesId:'species-081',presentation:'battle'});
  assert.ok(captured.at(-1).battleGeometry);
  assert.equal(captured.at(-1).reducedMotion,false);
  roster.createActor({speciesId:'species-081'});
  assert.equal(captured.at(-1).battleGeometry,null);
  roster.createActor({speciesId:'species-000',presentation:'battle'});
  assert.ok(captured.at(-1).battleGeometry,'eggs retain their own source sequences, never a regular creature pose');
  await roster.dispose();
  const broken=structuredClone(manifest);
  broken.records.find(r=>r.entityId===entity).files[0].sha256='0'.repeat(64);
  const stale=await loadLicensedCharacterRoster({...options,manifest:broken});
  stale.createActor({speciesId:'species-081',presentation:'battle'});
  assert.equal(captured.at(-1).battleGeometry,null);
  await stale.dispose();
});

} else {
  test('asset-disabled child preserves every original local-reference case', () => {
    runNativeReference(`process.argv.push(${JSON.stringify(nativeReferenceFlag)}); await import(${JSON.stringify(import.meta.url)});`);
  });

  test('production generated geometry binds 226 identities and preserves immutable donor snapshots', () => {
    assertProductionAssets();
    const native = readNativeSnapshot('../src/data/championship/battleCharacterGeometry.js', 'native.BATTLE_CHARACTER_GEOMETRY');
    assert.equal(Object.keys(native).length, 224);
    assert.equal(Object.values(native).reduce((n, g) => n + Object.keys(g.frames).length, 0), 13246);
    assert.equal(Object.keys(BATTLE_CHARACTER_GEOMETRY).length, 226);
    const replacements = new Set(ACTIVE_ALTERNATE_FORM_ASSETS.map(c => c.entityId));
    for (const [id, geometry] of Object.entries(native)) {
      if (!replacements.has(id)) assert.deepEqual(BATTLE_CHARACTER_GEOMETRY[id], geometry, id);
    }
    for (const config of ACTIVE_ALTERNATE_FORM_ASSETS) {
      const source = native[config.motionDonorEntityId];
      const actual = BATTLE_CHARACTER_GEOMETRY[config.entityId];
      const expectedFrames = Object.fromEntries(Object.entries(source.frames).map(([key, value]) => {
        assert.ok(key.startsWith(config.motionDonorEntityId + '/main/'));
        return [config.entityId + key.slice(config.motionDonorEntityId.length), value];
      }));
      assert.deepEqual(actual, {...source, frames: expectedFrames}, config.entityId);
      assert.deepEqual(actual.files, source.files, 'Native evidence hashes remain donor evidence, not invented OC paths.');
      assert.deepEqual(Object.keys(actual.frames).sort(), Object.keys(config.frameOrigins).filter(key => key.includes('/main/')).sort());
    }
    assert.equal(Object.keys(BATTLE_CHARACTER_GEOMETRY.m540_imperialdramon_fm.frames).length, 61);
    assert.equal(Object.keys(BATTLE_CHARACTER_GEOMETRY.oc_celestyrant_battle_r10.frames).length, 63);
    assert.notDeepEqual(BATTLE_CHARACTER_GEOMETRY.m540_imperialdramon_fm.files, BATTLE_CHARACTER_GEOMETRY.oc_celestyrant_battle_r10.files);
  });
}

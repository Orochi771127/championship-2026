// UNIFIED_MOVES_20261118: one move list for the auto battle and the Data Arena, and
// three.js move pieces for the moves that had no piece of their own (U3).
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import sig from '../src/data/championship/move-vfx-signatures.r1.json' with {type: 'json'};
import {MOVE_VFX_CHOREOGRAPHY, moveVfxChoreography} from '../src/championship/presentation/vfx/moveVfxChoreography.js';
import {MOVE_VFX_3D_PIECE_GROUP, MOVE_VFX_3D_PIECE_GROUPS, MOVE_VFX_3D_FALLBACK} from '../src/championship/presentation/vfx/moveVfxPieceSprites3dIndex.js';
import {MOVE_VFX_PIECE_SPRITES} from '../src/championship/presentation/vfx/moveVfxPieceSprites.js';
import {loadMoveVfx3dPieces, bakedPieceLook} from '../src/championship/presentation/vfx/moveVfxSetPieces.js';
import {MOVE_PIECE_3D} from '../scripts/vfx/move-piece-3d-specs.mjs';

const choreographed = new Set(Object.keys(MOVE_VFX_CHOREOGRAPHY).map(k => (/^\d+$/.test(k) ? Number(k) : k)));

test('every attacking move has a contact piece of its own: species, originals and the Data Arena moves', () => {
  const missing = sig.moves.filter(([key, tier]) => tier !== 3 && !choreographed.has(key)).map(([key]) => key);
  assert.deepEqual(missing, []);
  for (const [key, tier] of sig.moves) if (tier !== 3) assert.ok(moveVfxChoreography(key)?.contact?.piece, `${key} has no contact piece`);
});

test('every three.js piece a move plays is baked, grouped, and falls back to a shared piece while loading', () => {
  const used = new Set();
  for (const entry of Object.values(MOVE_VFX_CHOREOGRAPHY)) for (const phase of [entry.contact, entry.release]) if (phase?.piece?.startsWith('3d-')) used.add(phase.piece);
  assert.ok(used.size >= 60, `${used.size} three.js pieces in use`);
  for (const name of used) {
    assert.ok(MOVE_PIECE_3D[name], `${name} has no bake spec`);
    assert.ok(MOVE_VFX_3D_PIECE_GROUP[name], `${name} is in no group`);
    assert.ok(MOVE_VFX_PIECE_SPRITES[MOVE_VFX_3D_FALLBACK[name]], `${name} falls back to a missing piece`);
  }
  for (const name of Object.keys(MOVE_PIECE_3D)) assert.ok(MOVE_VFX_3D_PIECE_GROUP[name], `${name} not baked`);
});

test('every ultimate (species, originals, Data Arena) plays a three.js piece no other ultimate plays', () => {
  const ultimates = sig.moves.filter(([key, tier]) => tier === 2).map(([key]) => key);
  assert.ok(ultimates.length >= 220, `${ultimates.length} ultimates`);
  const seen = new Map();
  for (const key of ultimates) {
    const piece = moveVfxChoreography(key).contact.piece;
    assert.ok(piece.startsWith('3d-'), `${key} plays ${piece}`);
    assert.ok(!seen.has(piece), `${key} and ${seen.get(piece)} share ${piece}`);
    seen.set(piece, key);
  }
});

test('group modules load on demand and carry the MIT notices of 00GameDevs and three.js', async () => {
  for (const [group, load] of Object.entries(MOVE_VFX_3D_PIECE_GROUPS)) {
    const mod = await load();
    for (const [name, g] of Object.entries(MOVE_VFX_3D_PIECE_GROUP)) if (g === group) assert.ok(mod.MOVE_VFX_PIECE_SPRITES[name], `${name} not in ${group}`);
    const text = fs.readFileSync(new URL(`../src/championship/presentation/vfx/moveVfxPieceSprites3d.${group}.js`, import.meta.url), 'utf8');
    assert.match(text, /00GameDevs \(@00vchannel\)/);
    assert.match(text, /three\.js authors/);
    assert.match(text, /THE SOFTWARE IS PROVIDED "AS IS"/);
  }
  const name = Object.keys(MOVE_VFX_3D_PIECE_GROUP)[0];
  assert.equal(await loadMoveVfx3dPieces([name, 'rush', null]), true);
  assert.ok(bakedPieceLook(name)?.frames?.length > 0);
});

test('a ground or contact anchor sits inside its piece (the bake reads the origin after the camera is placed)', async () => {
  for (const [name, group] of Object.entries(MOVE_VFX_3D_PIECE_GROUP)) {
    const look = (await MOVE_VFX_3D_PIECE_GROUPS[group]()).MOVE_VFX_PIECE_SPRITES[name];
    assert.ok(look.ox >= -look.w * 0.1 && look.ox <= look.w * 1.1, `${name} ox ${look.ox} of ${look.w}`);
    assert.ok(look.oy >= -look.h * 0.25 && look.oy <= look.h * 1.25, `${name} oy ${look.oy} of ${look.h}`);
  }
});

test('every species skill lands a three.js piece no other skill of its element plays, and never an ultimate\'s look', async () => {
  const {MOVE_PIECE_3D} = await import('../scripts/vfx/move-piece-3d-specs.mjs');
  const skills = sig.moves.filter(([key, tier]) => tier === 1 && Number.isSafeInteger(key) && key < 596);
  assert.ok(skills.length >= 150, `${skills.length} skills`);
  const seen = new Map();
  for (const [key, , , palette] of skills) {
    const piece = moveVfxChoreography(key)?.contact?.piece;
    assert.equal(piece, `3d-s-${key}`, `${key} plays ${piece}`);
    const spec = MOVE_PIECE_3D[piece], look = `${palette}|${spec.fx}#${spec.variant}`;
    assert.ok(spec.variant >= 6, `${piece} uses a skill variant`);
    assert.ok(!seen.has(look), `${key} and ${seen.get(look)} look alike`);
    seen.set(look, key);
  }
});

test('every species basic move lands a three.js piece no other basic of its element plays, from the basics\' own variants', async () => {
  const {MOVE_PIECE_3D} = await import('../scripts/vfx/move-piece-3d-specs.mjs');
  const basics = sig.moves.filter(([key, tier]) => tier === 0 && Number.isSafeInteger(key) && key < 596);
  assert.ok(basics.length >= 200, `${basics.length} basics`);
  const seen = new Map();
  for (const [key, , , palette] of basics) {
    const piece = moveVfxChoreography(key)?.contact?.piece;
    assert.equal(piece, `3d-b-${key}`, `${key} plays ${piece}`);
    const spec = MOVE_PIECE_3D[piece], look = `${palette}|${spec.fx}#${spec.variant}`;
    assert.ok(spec.variant >= 12, `${piece} uses a basic variant`);
    assert.ok(!seen.has(look), `${key} and ${seen.get(look)} look alike`);
    seen.set(look, key);
  }
});

test('every move has its own icon, shipped as a 64 px WebP with a manifest (U2)', async () => {
  const manifest = JSON.parse(fs.readFileSync(new URL('../assets/production/ui/move-icons-r1/manifest.json', import.meta.url), 'utf8'));
  const {moveIconSrc, moveIconKey} = await import('../src/championship/app/moveIcons.js');
  assert.equal(manifest.rightsStatus, 'ORIGINAL_GENERATED');
  const files = new Set(manifest.files.map(f => f.path));
  for (const [key] of sig.moves) assert.ok(files.has(moveIconSrc(key)), `${key} has no icon`);
  assert.equal(moveIconKey('own-195'), 195);
  assert.equal(moveIconSrc('own-195'), moveIconSrc(195));
  assert.equal(moveIconSrc('whiteout'), 'assets/production/ui/move-icons-r1/move_whiteout_64.webp');
  for (const f of manifest.files) assert.ok(fs.existsSync(new URL(`../${f.path}`, import.meta.url)), f.path);
});

test('the 49 Data Arena moves are auto-battle records that animate with a donor and play as their arena move (U1-2)', async () => {
  const {listProductArenaMoveRecords, arenaMoveRecordIndex, arenaMoveIdOfRecord, PRODUCT_ARENA_MOVE_FIRST_RECORD} = await import('../src/championship/contracts/productArenaMoves.js');
  const {getBattleCatalogRecord} = await import('../src/championship/battle/battleCatalogs.js');
  const {battleMoveName} = await import('../src/championship/text/battleMoveNames.js');
  const {RELAY_POOL_MOVE_ELEMENT} = await import('../src/championship/modes/dataArena/dataArenaRelayKits.js');
  const {moveVfxSignature} = await import('../src/championship/presentation/vfx/moveVfxSignatures.js');
  const {moveIconSrc} = await import('../src/championship/app/moveIcons.js');
  const records = listProductArenaMoveRecords();
  assert.equal(records.length, Object.keys(RELAY_POOL_MOVE_ELEMENT).length);
  assert.equal(PRODUCT_ARENA_MOVE_FIRST_RECORD, 623);
  for (const r of records) {
    const id = arenaMoveIdOfRecord(r.recordIndex);
    assert.equal(arenaMoveRecordIndex(id), r.recordIndex);
    assert.equal(getBattleCatalogRecord('moves', r.recordIndex), r);
    assert.equal(r.kind, 1);
    assert.ok([1, 2].includes(r.field0C), `${id} files into a native bucket`);
    assert.ok(r.power >= 150 && r.power <= 420 && r.actionCost >= 8 && r.actionCost <= 40, id);
    assert.ok(Number.isInteger(r.productDonorRecord) && r.productDonorRecord > 30 && r.productDonorRecord < 596, id);
    assert.ok(battleMoveName(r.recordIndex), `${id} has a name`);
    assert.deepEqual(moveVfxChoreography(r.recordIndex), moveVfxChoreography(id));
    assert.equal(moveVfxSignature(r.recordIndex), moveVfxSignature(id));
    assert.equal(moveIconSrc(r.recordIndex), moveIconSrc(id));
  }
});

test('a learned arena move joins a partner\'s moves only when it carries one; a native combatant is unchanged (U1-3)', async () => {
  const {listMoveRecordsForCombatant} = await import('../src/championship/battle/battleCatalogs.js');
  const {buildMoveBuckets} = await import('../src/championship/battle/battleMoveBuckets.js');
  const {combatantFieldsFor} = await import('../src/championship/app/battleRosterSource.js');
  const native = listMoveRecordsForCombatant({speciesId: 87, source12C: 0, source130: 0}).map(r => r.recordIndex);
  const learned = listMoveRecordsForCombatant({speciesId: 87, source12C: 0, source130: 0, arenaMoveRecord: 632}).map(r => r.recordIndex);
  assert.deepEqual(learned, [...native, 632]);
  assert.deepEqual(listMoveRecordsForCombatant({speciesId: 87, source12C: 0, source130: 0, arenaMoveRecord: 9999}).map(r => r.recordIndex), native);
  assert.ok(Object.values(buildMoveBuckets(listMoveRecordsForCombatant({speciesId: 87, source12C: 0, source130: 0, arenaMoveRecord: 632})).buckets).flat().some(e => e.actionId === 632));
  const creature = {currentHp: 10, maxHp: 10, metricBase: 1, metricLimit: 1, source12C: 0, source130: 0, speciesId: 87};
  assert.equal('arenaMoveRecord' in combatantFieldsFor(creature, 0), false);
  assert.equal(combatantFieldsFor({...creature, arenaMoveRecord: 632}, 0).arenaMoveRecord, 632);
});

test('a partner learns one arena move in its sync record; a bad id is refused and null forgets it (U1-3)', async () => {
  const {createSyncLevelState, recordLearnedArenaMove, learnedArenaMoveOf, normalizeSyncLevels} = await import('../src/championship/contracts/productSyncLevel.js');
  let state = recordLearnedArenaMove(createSyncLevelState(), 'p1', 'whiteout');
  assert.equal(learnedArenaMoveOf(state, 'p1'), 'whiteout');
  assert.equal(learnedArenaMoveOf(recordLearnedArenaMove(state, 'p1', 'nonsense'), 'p1'), 'whiteout');
  assert.equal(learnedArenaMoveOf(normalizeSyncLevels({...state, partners: {p1: {level: 1, exp: 0, rebirths: 0, arenaMove: 'nonsense'}}}), 'p1'), null);
  state = recordLearnedArenaMove(state, 'p1', null);
  assert.equal(learnedArenaMoveOf(state, 'p1'), null);
  assert.equal('arenaMove' in normalizeSyncLevels(state).partners.p1, false);
});

test('a whole battle runs with learned arena moves, and the AI casts one (U1-3)', async () => {
  const {createBattleRuntime} = await import('../src/championship/app/battleRuntime.js');
  const {createNativeHuntIndividual} = await import('../src/championship/hunt/capture/nativeHuntIndividual.js');
  const {nativeHuntSpeciesByIndex} = await import('../src/championship/hunt/capture/nativeHuntSources.js');
  const {nativeIndividualProfile} = await import('../src/championship/raising/nativeIndividualProfile.js');
  const individual = (id, species, seed, arenaMoveRecord = null) => {
    const profile = structuredClone(nativeIndividualProfile(createNativeHuntIndividual({species: nativeHuntSpeciesByIndex(species), rng: {next: () => seed}})));
    // a fresh capture has 10 TP; a seasoned partner can afford a special
    profile.fields['054'] = 999; profile.fields['05c'] = 999;
    return {instanceId: id, nativeProfile: profile, ...(arenaMoveRecord ? {arenaMoveRecord} : {})};
  };
  let cast = 0, ended = false;
  for (const seed of [3, 7, 11]) {
    const runtime = createBattleRuntime({mode: 5, battleType: 0, seed, aiPolicy: 'IMPROVED_V1',
      playerIndividuals: [159, 148, 61].map((s, i) => individual('A' + i, s, seed + i, [635, 645, 646][i])),
      opponentIndividuals: [124, 149, 186].map((s, i) => individual('B' + i, s, seed * 7 + i))});
    runtime.choosePracticeBattle({arenaIndex: 2});
    const source = runtime.startMatch();
    const seen = new Set();
    for (let t = 0; t < 12000 && !source.getView().outcome.ended; t++) {
      source.tick();
      for (const l of source.getView().nativeLifecycle?.active ?? []) if (l.moveId >= 623 && !seen.has(l)) { seen.add(l); cast++; }
    }
    ended ||= source.getView().outcome.ended;
    runtime.dispose();
  }
  assert.ok(ended, 'a battle reaches its end');
  assert.ok(cast > 0, 'a learned arena move is cast');
});

test('the arena move records are current with their generator', async () => {
  const {execFileSync} = await import('node:child_process');
  const out = execFileSync(process.execPath, ['scripts/build-product-arena-moves.mjs', '--check'], {cwd: new URL('..', import.meta.url), encoding: 'utf8'});
  assert.match(out, /current/);
});

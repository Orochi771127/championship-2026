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

// Move VFX signatures: one look per move (OWNER_APPROVED_ADAPTATION 2026-11-08,
// docs/coordination/OWNER_DIRECTION.md UNIQUE_PIXEL_MOVE_VFX_20261108).
//
// Owner: 「總之我要每一招都獨特」. The kit draws a move from its archetype in its
// element palette; before this table 587 species moves shared about 200 looks.
// This script gives every move a signature -- volley and path (or combo and
// swing), size, trail, closing burst and a sigil seed -- so that:
//   - no two moves share the whole look;
//   - two moves of one archetype and palette differ in at least two choices;
//   - no two sigil glyphs match.
// Choices lean on the tier: a basic attack stays small and single, a signature
// move is large, fires a volley and ends on a pillar, star or bloom.
//
// Reads only existing presentation data (move records, approved names, the
// unified VFX resolver, the kit recipes, the Data Arena pool) and never changes
// a move value.
//
// Usage: node scripts/build-move-vfx-signatures.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import moves from '../src/data/championship/catalogs/battle-moves.r1.json' with {type: 'json'};
import {listProductOriginalMoveRecords} from '../src/championship/contracts/productOriginalSpecies.js';
import {BATTLE_MOVE_NAMES} from '../src/championship/text/battleMoveNames.js';
import {battleFxMoveBanks} from '../src/championship/presentation/battleFx/battleFxRecipes.js';
import {resolveMoveVfx, elementVfx} from '../src/championship/presentation/vfx/unifiedMoveVfxResolver.js';
import {moveVfxRecipe, DATA_ARENA_POOL_ARCHETYPE} from '../src/championship/presentation/vfx/moveVfxRecipes.js';
import {moveVfxArchetypeIsMelee} from '../src/championship/presentation/vfx/moveVfxKit.js';
import {moveVfxSigilCells} from '../src/championship/presentation/vfx/moveVfxKitTextures.js';
import {RELAY_ELEMENT_KITS, RELAY_POOL_MOVE_ELEMENT} from '../src/championship/modes/dataArena/dataArenaRelayKits.js';
import {dataArenaMoveElement, dataArenaMoveStyle} from '../src/championship/presentation/dataArena/dataArenaElementFx.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = 'src/data/championship/move-vfx-signatures.r1.json';

// Kept in step with moveVfxSignatures.js (the test compares them).
const DIMS = {
  volley: [1, 2, 3, 5], path: ['straight', 'arc', 'wave', 'spiral'], combo: [1, 2, 3], swing: ['down', 'up', 'cross'],
  scale: [0.85, 1, 1.2], trail: ['none', 'sparkle', 'ring', 'afterimage', 'ember', 'rune'], burst: ['ring', 'cross', 'star', 'pillar', 'shatter', 'bloom']
};
const TIERS = ['basic', 'skill', 'ultimate', 'support'];
const MELEE = ['strike', 'claw', 'slash', 'pierce', 'bite'];
const ARENA_PALETTE = {fire: 'FIRE', frost: 'ICE', light: 'SUN', water: 'WATER', earth: 'EARTH', storm: 'THUNDER', nature: 'WOOD', shadow: 'MOON'};

// Preferred values per tier, as indices into DIMS; the search widens to every value only if these run out.
const PREFER = {
  basic: {count: [0, 1], way: [0, 2, 1, 3], scale: [0, 1], trail: [0, 1, 3, 4, 2, 5], burst: [0, 1, 4, 2, 5, 3]},
  skill: {count: [1, 0, 2], way: [1, 2, 3, 0], scale: [1, 0, 2], trail: [1, 2, 3, 4, 5, 0], burst: [1, 2, 4, 5, 0, 3]},
  ultimate: {count: [2, 3, 1], way: [3, 1, 2, 0], scale: [2, 1], trail: [5, 2, 3, 4, 1, 0], burst: [3, 2, 5, 4, 1, 0]},
  support: {count: [0], way: [0], scale: [1], trail: [5, 1, 2], burst: [5, 0, 2]}
};

function fnv(text) {
  let h = 0x811c9dc5;
  for (const ch of String(text)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
  return h >>> 0;
}
const rotate = (list, n) => list.map((_, i) => list[(i + n) % list.length]);

/** Every move the table covers: [key, name, tier, archetype, palette]. */
function listMoves() {
  const records = [...moves.records, ...listProductOriginalMoveRecords()];
  const bySpecies = new Map();
  for (const move of records) {
    if (!bySpecies.has(move.speciesId)) bySpecies.set(move.speciesId, []);
    bySpecies.get(move.speciesId).push(move);
  }
  const rows = [];
  for (const move of records) {
    if (move.recordIndex === 0) continue;
    const name = BATTLE_MOVE_NAMES[move.recordIndex]?.[0] ?? '';
    const vfx = resolveMoveVfx(move, {speciesMoves: bySpecies.get(move.speciesId)});
    if (move.kind >= 2 || move.recordIndex <= 30) { rows.push([move.recordIndex, name, 'support', 'support', vfx.paletteKey]); continue; }
    const families = battleFxMoveBanks(move).map(b => b.family).filter(Boolean);
    const {archetype} = moveVfxRecipe({style: vfx.style, element: vfx.element, name, families});
    rows.push([move.recordIndex, name, vfx.tier === 'ultimate' ? 'ultimate' : vfx.tier === 'basic' ? 'basic' : 'skill', archetype, vfx.paletteKey]);
  }
  const ultimates = new Set(Object.values(RELAY_ELEMENT_KITS).map(kit => kit.ultimate));
  for (const id of Object.keys(RELAY_POOL_MOVE_ELEMENT).sort()) {
    const element = dataArenaMoveElement(id);
    const arena = Object.entries(ARENA_PALETTE).find(([, e]) => e === element)?.[0] ?? null;
    const archetype = DATA_ARENA_POOL_ARCHETYPE[id] ?? moveVfxRecipe({style: dataArenaMoveStyle(id, arena) ?? 'strike', element}).archetype;
    rows.push([id, id, ultimates.has(id) ? 'ultimate' : 'skill', archetype, elementVfx(element).paletteKey]);
  }
  return rows;
}

export function buildMoveVfxSignatures() {
  const taken = new Set(), groups = new Map(), glyphs = new Set(), out = [];
  for (const [key, name, tier, archetype, palette] of listMoves()) {
    const melee = MELEE.includes(archetype) || moveVfxArchetypeIsMelee(archetype);
    const counts = melee ? DIMS.combo : DIMS.volley, ways = melee ? DIMS.swing : DIMS.path;
    const h = fnv(`${key}|${name}`), prefer = PREFER[tier];
    const all = (n) => Array.from({length: n}, (_, i) => i);
    const group = `${archetype}|${palette}`;
    if (!groups.has(group)) groups.set(group, []);
    const peers = groups.get(group);
    const pick = (widen) => {
      const opt = (list, n, salt) => rotate(widen ? [...new Set([...list, ...all(n)])] : list.filter(i => i < n), (h >>> salt) % 7);
      for (const count of opt(prefer.count, counts.length, 0)) for (const way of opt(prefer.way, ways.length, 3))
        for (const scale of opt(prefer.scale, 3, 6)) for (const trail of opt(prefer.trail, 6, 9)) for (const burst of opt(prefer.burst, 6, 12)) {
          const look = [count, way, scale, trail, burst];
          if (taken.has(`${group}|${look}`)) continue;
          // Two moves of one archetype and palette differ in at least two choices.
          if (peers.some(other => other.filter((v, i) => v !== look[i]).length < 2)) continue;
          return look;
        }
      return null;
    };
    const look = pick(false) ?? pick(true);
    if (!look) throw new Error(`MOVE_VFX_SIGNATURE_EXHAUSTED: ${key} ${group}`);
    taken.add(`${group}|${look}`); peers.push(look);
    // A sigil seed whose glyph no earlier move has.
    let sigil = h, glyph;
    for (;; sigil = (sigil + 0x9e3779b9) >>> 0) { glyph = Buffer.from(moveVfxSigilCells(sigil).cells).toString('base64'); if (!glyphs.has(glyph)) break; }
    glyphs.add(glyph);
    const [count, way, scale, trail, burst] = look;
    out.push([key, TIERS.indexOf(tier), archetype, palette, counts[count], way, scale, trail, burst, sigil]);
  }
  return {
    schemaVersion: 1,
    kind: 'MOVE_VFX_SIGNATURES',
    authority: 'OWNER_APPROVED_ADAPTATION_20261108',
    generator: 'scripts/build-move-vfx-signatures.mjs',
    note: 'Presentation only: a signature never changes a move value. Row = [move record or Data Arena pool id, tier basic|skill|ultimate|support, archetype, palette, volley (combo for a blow), path (swing for a blow) index, scale index, trail index, burst index, sigil seed].',
    melee: MELEE,
    moves: out
  };
}

export function serializeMoveVfxSignatures(table) {
  const head = JSON.stringify({...table, moves: undefined}, null, 2).replace(/\n}$/, '');
  const rows = table.moves.map(row => `    ${JSON.stringify(row)}`).join(',\n');
  return `${head},\n  "moves": [\n${rows}\n  ]\n}\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const text = serializeMoveVfxSignatures(buildMoveVfxSignatures());
  const target = path.join(root, OUT);
  if (process.argv.includes('--check')) {
    const current = fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '';
    if (current !== text) { console.error('MOVE_VFX_SIGNATURES_STALE: run node scripts/build-move-vfx-signatures.mjs'); process.exit(1); }
    console.log(`${OUT} is current`);
  } else {
    fs.writeFileSync(target, text);
    console.log(`wrote ${OUT}`);
  }
}

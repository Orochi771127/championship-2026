// RELAY element and own-move kits per partner (OWNER_APPROVED_ADAPTATION
// 2026-10-28, docs/coordination/OWNER_DIRECTION.md ARENA_RELAY_KITS_20261028).
//
// Owner: 「幫他們配招要配適合的屬性還有招式，就像不可能草系會發飛彈」. The first
// roster guessed elements from body and attribute; for 105 of 192 partners
// that disagreed with every coloured move they own (a flower fairy was water,
// a flame bird frost). This derives the element from the partner's own moves:
//
//   - A move votes only with an evidence colour: its effect bank or approved
//     name. A colour that changes when the roster element changes is the
//     classifier's fallback and does not vote.
//   - A special move (action cost > 0) weighs 2 + tier, a basic move 1.
//   - Metal, neutral and psychic decide only when no coloured move exists.
//   - No evidence at all keeps the roster element.
//
// It then writes three files that must agree:
//   data-arena-relay-roster.v1.json  element column (body, stage unchanged)
//   move-vfx-themes.r1.json          regenerated from the new roster
//   data-arena-relay-kits.v1.json    basic move record + up to 3 own specials
//
// Usage: node scripts/build-data-arena-relay-kits.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import moves from '../src/data/championship/catalogs/battle-moves.r1.json' with {type: 'json'};
import species from '../src/data/championship/catalogs/creature-species.r1.json' with {type: 'json'};
import roster from '../src/data/championship/data-arena-relay-roster.v1.json' with {type: 'json'};
import extensions from '../src/data/championship/product-species-extensions.r1.json' with {type: 'json'};
import {DATA_ARENA_PARTNERS, DATA_ARENA_KITS} from '../src/championship/modes/dataArena/dataArenaConfig.js';
import {RELAY_PALETTE_ELEMENT, RELAY_NEUTRAL_PALETTES} from '../src/championship/modes/dataArena/dataArenaRelayElements.js';
import {classifyMove, buildMoveVfxThemes, serializeMoveVfxThemes} from './build-move-vfx-themes.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = {
  roster: 'src/data/championship/data-arena-relay-roster.v1.json',
  themes: 'src/data/championship/move-vfx-themes.r1.json',
  kits: 'src/data/championship/data-arena-relay-kits.v1.json'
};

const speciesByIndex = new Map(species.records.map(r => [r.recordIndex, r]));
const movesBySpecies = new Map();
for (const move of moves.records) {
  if (move.recordIndex <= 30 || ![0, 1].includes(move.kind)) continue;
  if (!movesBySpecies.has(move.speciesId)) movesBySpecies.set(move.speciesId, []);
  movesBySpecies.get(move.speciesId).push(move);
}

// Product extensions reuse their base species' moves. 224..227 own no move
// record; each shares its look (lookupKey) with a ROM partner that lends its
// moves (224 -> 34, 225 -> 195, 226 -> 96, 227 -> 97).
function moveOwner(speciesIndex) {
  const extension = extensions.entries.find(e => e.speciesIndex === speciesIndex);
  if (extension) return extension.baseSpeciesIndex;
  if (movesBySpecies.has(speciesIndex)) return speciesIndex;
  const look = speciesByIndex.get(speciesIndex)?.lookupKey;
  const twin = look ? species.records.find(r => r.recordIndex !== speciesIndex && r.lookupKey === look && movesBySpecies.has(r.recordIndex)) : null;
  return twin?.recordIndex ?? null;
}

function evidencePalette(move, owner) {
  const record = speciesByIndex.get(owner), list = movesBySpecies.get(owner);
  const a = classifyMove(move, record, {element: 'fire'}, list).element;
  const b = classifyMove(move, record, {element: 'frost'}, list).element;
  return a === b ? a : null;
}

// The three Tournament partners keep the kits designed for them
// (DATA_ARENA_SLICE 2026-10-15), so they keep those kits' element: 雪晶龍's
// breath plays a fire bank but its kit is ice.
const KIT_ULTIMATE_ELEMENT = {coreNova: 'fire', whiteout: 'frost', dawnLance: 'light'};
const TOURNAMENT_ELEMENT = new Map(DATA_ARENA_PARTNERS.map(p => [Number(p.speciesId.slice(-3)), KIT_ULTIMATE_ELEMENT[DATA_ARENA_KITS[p.id].ultimate]]));

export function deriveRelayElement(entry) {
  if (TOURNAMENT_ELEMENT.has(entry.speciesIndex)) return TOURNAMENT_ELEMENT.get(entry.speciesIndex);
  const owner = moveOwner(entry.speciesIndex);
  const votes = new Map(), neutral = new Map();
  for (const move of movesBySpecies.get(owner) ?? []) {
    const palette = evidencePalette(move, owner);
    if (!palette) continue;
    const tier = classifyMove(move, speciesByIndex.get(owner), entry, movesBySpecies.get(owner)).tier;
    const weight = move.actionCost > 0 ? 2 + tier : 1;
    const bucket = RELAY_NEUTRAL_PALETTES.includes(palette) ? neutral : votes;
    const element = RELAY_PALETTE_ELEMENT[palette] ?? 'physical';
    bucket.set(element, (bucket.get(element) ?? 0) + weight);
  }
  const ranked = [...(votes.size ? votes : neutral)].sort((x, y) => y[1] - x[1]);
  if (!ranked.length) return entry.element;
  // A tie keeps the current element when it is among the leaders.
  const leaders = ranked.filter(([, w]) => w === ranked[0][1]).map(([e]) => e);
  return leaders.includes(entry.element) ? entry.element : leaders[0];
}

export function buildDataArenaRelayKits() {
  const nextRoster = roster.entries.map(entry => ({...entry, element: deriveRelayElement(entry)}));
  const themes = buildMoveVfxThemes(nextRoster);
  const theme = new Map(themes.moves.map(([record, style, palette, tier]) => [record, {style, palette, tier}]));
  const rows = nextRoster.map(entry => {
    const owned = movesBySpecies.get(moveOwner(entry.speciesIndex)) ?? [];
    const basic = owned.find(m => m.actionCost === 0) ?? null;
    // Up to three specials: highest tier, then power; one per style+colour.
    const seen = new Set(), specials = [];
    for (const move of [...owned].filter(m => m.actionCost > 0)
      .sort((a, b) => theme.get(b.recordIndex).tier - theme.get(a.recordIndex).tier || b.power - a.power || a.recordIndex - b.recordIndex)) {
      const t = theme.get(move.recordIndex), key = `${t.style}:${t.palette}`;
      if (seen.has(key) || specials.length >= 3) continue;
      seen.add(key); specials.push(move);
    }
    specials.sort((a, b) => a.recordIndex - b.recordIndex);
    return [entry.speciesIndex, basic?.recordIndex ?? null, specials.map(m => {
      const t = theme.get(m.recordIndex);
      return [m.recordIndex, t.style, t.palette, t.tier];
    })];
  });
  const kits = {
    schemaVersion: 1,
    kind: 'ORIGINAL_RELAY_KITS',
    authority: 'OWNER_APPROVED_ADAPTATION_20261028',
    generator: 'scripts/build-data-arena-relay-kits.mjs',
    note: 'Row = [species index, basic move record or null, own special moves [record, VFX style, element palette, tier 1..4]]. Moves are records the partner already owns; the arena mechanic comes from the style.',
    species: rows
  };
  return {roster: {...roster, entries: nextRoster}, themes, kits};
}

function serializeKits(table) {
  const head = JSON.stringify({...table, species: undefined}, null, 2).replace(/\n}$/, '');
  return `${head},\n  "species": [\n${table.species.map(row => `    ${JSON.stringify(row)}`).join(',\n')}\n  ]\n}\n`;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const built = buildDataArenaRelayKits();
  const texts = {
    roster: `${JSON.stringify(built.roster, null, 2)}\n`,
    themes: serializeMoveVfxThemes(built.themes),
    kits: serializeKits(built.kits)
  };
  const stale = Object.keys(OUT).filter(key => {
    const target = path.join(root, OUT[key]);
    return (fs.existsSync(target) ? fs.readFileSync(target, 'utf8') : '') !== texts[key];
  });
  if (process.argv.includes('--check')) {
    if (stale.length) { console.error(`DATA_ARENA_RELAY_KITS_STALE: ${stale.map(k => OUT[k]).join(', ')}; run node scripts/build-data-arena-relay-kits.mjs`); process.exit(1); }
    console.log('relay roster, move themes and relay kits are current');
  } else {
    for (const key of stale) fs.writeFileSync(path.join(root, OUT[key]), texts[key]);
    const changed = built.roster.entries.filter((e, i) => e.element !== roster.entries[i].element).length;
    console.log(`wrote ${stale.map(k => OUT[k]).join(', ') || 'nothing (current)'}; ${changed} element changes`);
  }
}

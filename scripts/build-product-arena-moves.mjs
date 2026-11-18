// The Data Arena's own moves as auto-battle move records (UNIFIED_MOVES_20261118 U1-2).
//
// Owner 2026-11-18: one move list for both battle modes; the 49 Data Arena moves get
// auto-battle numbers and become learnable. Like the playable originals' moves
// (productOriginalSpecies.js), each record borrows a donor native move's timing and
// effect banks (so the battle animates it) and states its own kind, power, cost,
// element and status. Ids continue after the originals' moves.
//
// Numbers: a skill's power follows its arena damage (120 + 8 x damage, 150..360) and its
// cost the arena energy; a pool ultimate is 420 power at 40 TP, like the strongest native
// signatures. The element is the pool's; a freezing move inflicts the native freeze
// (status 3) -- only a frost move, the one arena effect the native attacks already carry.
//
// Usage: node scripts/build-product-arena-moves.mjs [--check]
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import moves from '../src/data/championship/catalogs/battle-moves.r1.json' with {type: 'json'};
import sig from '../src/data/championship/move-vfx-signatures.r1.json' with {type: 'json'};
import {listProductOriginalMoveRecords} from '../src/championship/contracts/productOriginalSpecies.js';
import {DATA_ARENA_MOVES} from '../src/championship/modes/dataArena/dataArenaConfig.js';
import {RELAY_POOL_MOVE_ELEMENT, RELAY_ELEMENT_KITS} from '../src/championship/modes/dataArena/dataArenaRelayKits.js';
import {DATA_ARENA_TEXT} from '../src/championship/text/dataArenaText.js';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = 'src/data/championship/product-arena-moves.v1.json';
const SELECTOR = {fire: 1, water: 2, light: 3, shadow: 4, storm: 5};

// relay extras live in dataArenaRelay.js (guards, dashes); read their numbers from the module
const {relayMove} = await import('../src/championship/modes/dataArena/dataArenaRelay.js');
const signature = new Map(sig.moves.map(row => [row[0], {tier: row[1], archetype: row[2], palette: row[3]}]));
const ultimates = new Set(Object.values(RELAY_ELEMENT_KITS).map(kit => kit.ultimate));
const natives = moves.records.filter(r => r.recordIndex > 30 && r.kind === 1);
const firstId = Math.max(...listProductOriginalMoveRecords().map(r => r.recordIndex)) + 1;

function donorFor(id) {
  const s = signature.get(id);
  const score = r => { const t = signature.get(r.recordIndex); return (t?.archetype === s.archetype ? 2 : 0) + (t?.palette === s.palette ? 1 : 0); };
  // best match, then the one whose own tier matches (ultimate vs skill), then the lowest record
  return [...natives].sort((a, b) => score(b) - score(a)
    || ((signature.get(b.recordIndex)?.tier === s.tier) - (signature.get(a.recordIndex)?.tier === s.tier)) || a.recordIndex - b.recordIndex)[0];
}

const ids = Object.keys(RELAY_POOL_MOVE_ELEMENT).sort();
const entries = ids.map((id, i) => {
  const rule = relayMove(id, ultimates.has(id)) ?? DATA_ARENA_MOVES[id];
  const ultimate = ultimates.has(id), donor = donorFor(id), element = RELAY_POOL_MOVE_ELEMENT[id];
  const damage = rule.damage ?? 0;
  return {
    id, recordIndex: firstId + i, donorMoveRecord: donor.recordIndex, ultimate,
    field0C: donor.field0C, power: ultimate ? 420 : Math.max(150, Math.min(360, Math.round((120 + 8 * damage) / 10) * 10)),
    actionCost: ultimate ? 40 : Math.max(8, Math.min(30, Math.round(rule.energy ?? 20))),
    elementSelect: SELECTOR[element] ?? 0, statusCode: element === 'frost' && (rule.effect === 'ROOT' || rule.freezeWater) ? 3 : 0,
    names: [DATA_ARENA_TEXT['zh-Hant'][`move.${id}`], DATA_ARENA_TEXT.en[`move.${id}`]].map(t => String(t ?? id).split(/\s*[｜|]\s*/)[0])
  };
});
const doc = {
  schemaVersion: 1, kind: 'PRODUCT_ARENA_MOVE_RECORDS', authority: 'OWNER_APPROVED_ADAPTATION_20261118',
  generator: 'scripts/build-product-arena-moves.mjs',
  note: 'The Data Arena moves as auto-battle records: a donor native move\'s timing and effect banks, the move\'s own kind 1, power, cost, element and status. Learnable one per partner (local play only).',
  firstRecordIndex: firstId, entries
};
const text = `${JSON.stringify(doc, null, 2)}\n`;
const target = path.join(root, OUT);
if (process.argv.includes('--check')) {
  if (!fs.existsSync(target) || fs.readFileSync(target, 'utf8') !== text) { console.error(`PRODUCT_ARENA_MOVES_STALE: run node ${doc.generator}`); process.exit(1); }
  console.log('product arena moves are current');
} else {
  fs.writeFileSync(target, text);
  console.log(`${OUT}: ${entries.length} records from ${firstId}`);
}

// Owner 2026-11-25 「我每一張地圖其實都要擴大」: hm10, hm11, hm13 and hm14 grow to 180x180
// like the other eleven maps. Also repairs the old-edge escape cells that hm15-hm18 kept.
//
// node scripts/build-hunt-expansion-four-20261125.mjs <hunt-runtime-handoff-20261023 dir> [--check]
//
// Sources: the reviewed expansion candidates delivered with the v6/v7/v9 runtime packs.
// Rules (the same ones the shipped expansions follow, measured 2026-11-25):
//  - the original 128x128 grid stays at the origin; terrain inside it is unchanged;
//  - an old east/south edge cell (x=127 or y=127) that let a creature escape off the
//    map, where the ground continues past it, becomes ordinary steering
//    {targetQ12:[0,-4096,0], blendQ12:205} (hm09/hm02 did this; hm14-hm18 had not);
//  - a night field equals the original night grid, except the converted edge cells,
//    which take the day conversion; the appended tiles are the day ones;
//  - caves are the interior escape-anchor pairs; the mouth is the last row south of
//    the anchors still enclosed by corridor walls (reproduces hm09's delivered caves);
//  - 2026-11-26: tiles under the props added to the hm10/hm13 extension areas
//    (scripts/data/hunt-extension-prop-blocks-20261126.json) become terrain 1, so
//    creatures walk around containers and rocks instead of through them.
import fs from 'node:fs';
import path from 'node:path';
import { createNativeHuntEnvironment, NATIVE_HUNT_EXPANSION_ADAPTATION } from '../src/championship/hunt/capture/nativeHuntSceneSources.js';

const [handoff, ...flags] = process.argv.slice(2);
if (!handoff) throw Error('usage: node scripts/build-hunt-expansion-four-20261125.mjs <handoff dir> [--check]');
const CHECK = flags.includes('--check');
const CATALOG = 'src/data/championship/catalogs/hunt-art-expansions-20261023.json';
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const src = read('src/data/championship/catalogs/hunt-scene.r1.json');
const catalog = read(CATALOG);
const key = c => JSON.stringify(c);
const PROP_BLOCKS = read('scripts/data/hunt-extension-prop-blocks-20261126.json').fields;
const NEUTRAL = key({ targetQ12: [0, -4096, 0], blendQ12: 0, escapeAnchor: false, escapeBoundary: false });
const CONVERTED = Object.freeze({ targetQ12: [0, -4096, 0], blendQ12: 205, escapeAnchor: false, escapeBoundary: false });
const CANDIDATES = {
  field_hm10_01: 'HM10/v7/supplement/hm10-expansion-v1-candidate.json',
  field_hm11_01: 'HM11/v7/supplement/hm11-expansion-v7-candidate.json',
  field_hm13_01: 'HM13/v6/contents/hunt-production-20261021/hm13/runtime-candidate/hm13-expansion-v1-candidate.json',
  field_hm14_01: 'HM14/v9/contents/HM14_SOURCE_ADAPTED_V9/runtime-candidate/frozen-hm14-v9/hm14-expanded-layout.json'
};

function decode(data) {
  const env = createNativeHuntEnvironment({ ...data, adaptation: NATIVE_HUNT_EXPANSION_ADAPTATION });
  const terrain = [], cells = [];
  for (let y = 0; y < data.height; y++) for (let x = 0; x < data.width; x++) {
    terrain.push(env.readTerrain(x, y));
    // Store the raw palette cell (not the runtime-normalised one).
    cells.push(null);
  }
  // Raw cells from the runs, so the delivered palette entries round-trip exactly.
  let i = 0;
  for (const [count, value] of data.directionRuns) for (let n = 0; n < count; n++) cells[i++] = data.directionPalette[value];
  return { width: data.width, height: data.height, terrain, cells };
}
function rawOriginal(fieldId) {
  const d = src.environments[fieldId];
  return decode({ ...d, base: { widthTiles: 128, heightTiles: 128, originTile: [0, 0] } });
}
function encode(grid, extra) {
  const runs = (values) => { const out = []; for (const v of values) { const last = out.at(-1); if (last && last[1] === v) last[0]++; else out.push([1, v]); } return out; };
  const palette = [], index = new Map();
  const ids = grid.cells.map(c => { const k = key(c); if (!index.has(k)) { index.set(k, palette.length); palette.push(c); } return index.get(k); });
  return { width: grid.width, height: grid.height, wrap: false, base: { widthTiles: 128, heightTiles: 128, originTile: [0, 0] },
    terrainRuns: runs(grid.terrain), directionRuns: runs(ids), directionPalette: palette, ...extra,
    adaptation: NATIVE_HUNT_EXPANSION_ADAPTATION };
}
const at = (g, x, y) => y * g.width + x;
const blocked = (g, x, y) => x < 0 || y < 0 || x >= g.width || y >= g.height || g.terrain[at(g, x, y)] === 1;

/** Convert old-edge escape cells whose ground continues into the appended tiles. */
function convertOldEdge(g) {
  let n = 0;
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    if (!(x === 127 || y === 127)) continue;
    const c = g.cells[at(g, x, y)];
    if (!(c?.escapeBoundary || c?.escapeAnchor) || blocked(g, x, y)) continue;
    const beyond = [x === 127 ? [x + 1, y] : null, y === 127 ? [x, y + 1] : null].filter(Boolean);
    if (!beyond.some(([bx, by]) => !blocked(g, bx, by))) continue;
    g.cells[at(g, x, y)] = CONVERTED; n++;
  }
  return n;
}
/** Night = original night core except converted cells; appended tiles from the day grid. */
function nightFrom(dayGrid, dayFieldId, nightFieldId) {
  const od = rawOriginal(dayFieldId), on = rawOriginal(nightFieldId);
  const g = { ...dayGrid, terrain: [...dayGrid.terrain], cells: [...dayGrid.cells] };
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) {
    if (od.terrain[y * 128 + x] !== on.terrain[y * 128 + x]) throw Error(`NIGHT_TERRAIN_DIFFERS ${nightFieldId} ${x},${y}`);
    const converted = key(dayGrid.cells[at(dayGrid, x, y)]) !== key(od.cells[y * 128 + x]);
    if (!converted) g.cells[at(g, x, y)] = on.cells[y * 128 + x];
  }
  return g;
}
/** Interior escape-anchor pairs -> caves. */
function caves(g, idPrefix) {
  const out = [];
  for (let y = 1; y < 127; y++) for (let x = 1; x < 126; x++) {
    const a = g.cells[at(g, x, y)], b = g.cells[at(g, x + 1, y)];
    if (!a?.escapeAnchor || !b?.escapeAnchor || g.cells[at(g, x - 1, y)]?.escapeAnchor) continue;
    let my = y + 1;
    while (my < g.height - 1 && blocked(g, x - 1, my) && blocked(g, x + 2, my)) my++;
    out.push({ id: `${idPrefix}-${out.length + 1}`, anchorTiles: [[x, y], [x + 1, y]], mouthTile: [x, my - 1] });
  }
  return out;
}

/** Extension tiles under added props become terrain 1 (open ground or ice, neutral steering only). */
function blockProps(g, fieldId) {
  const tiles = PROP_BLOCKS[fieldId] ?? [];
  for (const [x, y] of tiles) {
    if (x < 128 && y < 128) throw Error(`PROP_BLOCK_IN_CORE ${fieldId} ${x},${y}`);
    const i = at(g, x, y);
    if (![0, 3].includes(g.terrain[i]) || key(g.cells[i]) !== NEUTRAL) throw Error(`PROP_BLOCK_NOT_OPEN ${fieldId} ${x},${y}`);
    g.terrain[i] = 1;
  }
  return tiles.length;
}

// Self-check: the cave rule reproduces hm09's delivered caves.
{
  const hm09 = decode(catalog.environments.field_hm09_01);
  const mine = caves(hm09, 'x').map(c => key([c.anchorTiles, c.mouthTile])).sort();
  const theirs = catalog.environments.field_hm09_01.caveGroups[0].caves.map(c => key([c.anchorTiles, c.mouthTile])).sort();
  if (key(mine) !== key(theirs)) throw Error(`CAVE_RULE_MISMATCH hm09 ${key(mine)} vs ${key(theirs)}`);
}

const report = {};
const next = { ...catalog.environments };
for (const [fieldId, rel] of Object.entries(CANDIDATES)) {
  const data = read(path.join(handoff, rel)).environments[fieldId];
  const g = decode(data);
  const orig = rawOriginal(fieldId);
  for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++)
    if (g.terrain[at(g, x, y)] !== orig.terrain[y * 128 + x]) throw Error(`CORE_TERRAIN_CHANGED ${fieldId} ${x},${y}`);
  const converted = convertOldEdge(g);
  const propBlocks = blockProps(g, fieldId);
  const map = fieldId.slice(6, 10);
  const caveGroups = data.caveGroups ?? (caves(g, `${map}-cave`).length ? [{ id: `${map}-original-caves`, caves: caves(g, `${map}-cave`) }] : undefined);
  next[fieldId] = encode(g, caveGroups ? { caveGroups } : {});
  report[fieldId] = { source: rel, converted, propBlocks, caves: caveGroups?.[0]?.caves.length ?? 0 };
  const night = fieldId.replace('_01', '_02');
  const gate = src.gates.find(row => src.fields[row.dayIndex].fieldId === fieldId);
  if (src.fields[gate.nightIndex].fieldId === night) {
    next[night] = encode(nightFrom(g, fieldId, night), caveGroups ? { caveGroups } : {});
    report[night] = { source: `night rule from ${fieldId}`, caves: caveGroups?.[0]?.caves.length ?? 0 };
  }
}
for (const fieldId of ['field_hm15_01', 'field_hm15_02', 'field_hm16_01', 'field_hm16_02', 'field_hm17_01', 'field_hm17_02', 'field_hm18_01', 'field_hm18_02']) {
  const data = catalog.environments[fieldId], g = decode(data);
  const converted = convertOldEdge(g);
  const { width, height, wrap, base, terrainRuns, directionRuns, directionPalette, adaptation, ...extra } = data;
  next[fieldId] = encode(g, extra);
  report[fieldId] = { repair: 'old-edge escape cells', converted };
}
// Every environment must still load through the runtime constructor.
for (const [fieldId, data] of Object.entries(next)) createNativeHuntEnvironment(data);
const sorted = Object.fromEntries(Object.keys(next).sort().map(k => [k, next[k]]));
const text = JSON.stringify({ ...catalog, environments: sorted });
if (CHECK) {
  if (text !== fs.readFileSync(CATALOG, 'utf8').trimEnd()) throw Error('HUNT_EXPANSION_CATALOG_STALE');
} else fs.writeFileSync(CATALOG, text + '\n');
console.log(JSON.stringify(report, null, 1));

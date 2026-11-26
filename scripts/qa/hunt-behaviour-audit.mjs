// Hunt behaviour audit (2026-11-26). Run from the repository root:
//   node scripts/qa/hunt-behaviour-audit.mjs [Biome,Biome...]      (OUT=<file> for the JSON)
// Every gate at a day hour and a night hour: 90 s of game time with the tamer walking at the
// nearest wild every 3 s. Counts wild samples that stand on a blocked tile, that leave the
// world (and through which edge), and that stay still for 2 s while flagged as moving.
// Exit code 1 when a wild stands on a blocked tile or leaves through the appended east/south edge.
import fs from 'node:fs';
import { createChampionshipStandaloneApp } from '../../src/championship/app/championshipStandaloneApp.js';
import { CHAMPIONSHIP_MODERN_SAVE_KEY } from '../../src/championship/app/championshipStandaloneSave.js';
import { resolveNativeHuntSceneSources } from '../../src/championship/hunt/capture/nativeHuntSceneSources.js';

const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const catalog = read('src/data/championship/catalogs/creature-species.r1.json');
const { cages } = read('docs/contracts/championship/raising-home-presentation.v1.json');
const seed = fs.readFileSync('qa/championship-full-qa-save.json', 'utf8');
const store = () => { const m = new Map([[CHAMPIONSHIP_MODERN_SAVE_KEY, seed]]); return { getItem: k => m.get(k) ?? null, setItem: (k, v) => m.set(k, v), removeItem: k => m.delete(k) }; };
const BIOMES = ['Canyon', 'Crag', 'Damp', 'Desert', 'Factory', 'Forest', 'Grass', 'Ice', 'Jungle', 'Mine', 'Oasis', 'Ruins', 'Savanna', 'Seaside', 'Sewer', 'Volcano'];
const ONLY = process.argv[2] ? process.argv[2].split(',') : BIOMES;
const results = [];
for (const biomeId of ONLY) {
  const hours = {};
  for (let h = 2; h < 24; h++) {
    try { const s = resolveNativeHuntSceneSources({ biomeId, hour: h, season: 0 }); hours[s.variant.night ? 'night' : 'day'] ??= h; } catch { /* hours outside the native table */ }
  }
  for (const [phase, hour] of Object.entries(hours)) {
    const row = { biomeId, phase, hour };
    try {
      const iso = new Date(2026, 10, 26, hour, 20, 50).toISOString();
      const app = createChampionshipStandaloneApp({ storage: store(), locks: null, catalog, cages, clockPolicy: 'REALTIME_V1', now: () => iso, rngClock: () => ({ hour, minute: 20, second: 50 }) });
      await app.continueGame();
      const gate = app.getGates().find(g => g.biomeId === biomeId);
      app.openGate(); app.selectGate(gate.gateId); app.confirmGate();
      await app.beginHunt();
      const rt = app.getHuntRuntime();
      const world = rt.world ?? app.getHuntWorld?.();
      row.fieldId = rt.getNativeEntryState?.()?.fieldId ?? rt.world?.artFieldId ?? null;
      const T = world.tileSizePx, W = 180 * T, H = 180 * T;
      row.worldPx = [W, H];
      const last = new Map(), still = new Map();
      const stats = { samples: 0, outside: 0, blocked: 0, frozen: 0, states: {}, moved: 0, maxWilds: 0, escaped: 0, wildsStart: rt.getWildCreatures().length };
      let ms = 0;
      for (let step = 0; step < 90_000 / 16; step++) {
        rt.tick(16); ms += 16;
        if (ms % 3008 === 0) {
          const p = rt.getPlayer(), ws = rt.getWildCreatures();
          const near = ws.map(w => [w, Math.hypot(w.worldX - p.worldX, w.worldY - p.worldY)]).sort((a, b) => a[1] - b[1])[0];
          if (near) rt.moveTo(near[0].worldX, near[0].worldY);
        }
        if (step % 6) continue;
        const ws = rt.getWildCreatures();
        stats.maxWilds = Math.max(stats.maxWilds, ws.length);
        for (const w of ws) {
          stats.samples++;
          stats.states[w.state] = (stats.states[w.state] ?? 0) + 1;
          if (w.worldX < 0 || w.worldY < 0 || w.worldX > W || w.worldY > H) { stats.outside++; const side = w.worldX < 0 ? 'W' : w.worldX > W ? 'E' : w.worldY < 0 ? 'N' : 'S'; stats.sides = stats.sides ?? {}; stats.sides[side] = (stats.sides[side] ?? 0) + 1; }
          else if (world.isBlockedTile(Math.floor(w.worldX / T), Math.floor(w.worldY / T))) { stats.blocked++; (row.blockedAt ??= []).length < 6 && row.blockedAt.push([w.wildId, Math.floor(w.worldX / T), Math.floor(w.worldY / T), w.state]); }
          const prev = last.get(w.wildId);
          if (prev && (prev[0] !== w.worldX || prev[1] !== w.worldY)) { stats.moved++; still.set(w.wildId, 0); }
          else if (w.moving) { const n = (still.get(w.wildId) ?? 0) + 1; still.set(w.wildId, n); if (n === 20) { stats.frozen++; (row.frozenAt ??= []).length < 6 && row.frozenAt.push([w.wildId, Math.floor(w.worldX / T), Math.floor(w.worldY / T), w.state]); } }
          last.set(w.wildId, [w.worldX, w.worldY]);
        }
      }
      stats.wildsEnd = rt.getWildCreatures().length;
      row.stats = stats;
    } catch (e) { row.error = String(e?.stack ?? e).split('\n').slice(0, 3).join(' | '); }
    results.push(row);
    console.error(biomeId, phase, row.fieldId, row.error ? 'ERROR ' + row.error.slice(0, 160) : JSON.stringify({ wilds: row.stats.wildsStart + '->' + row.stats.wildsEnd, outside: row.stats.outside, blocked: row.stats.blocked, frozen: row.stats.frozen, states: row.stats.states }));
  }
}
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(results, null, 1));
const bad = results.filter(r => r.error || r.stats.blocked > 0 || (r.stats.sides?.E ?? 0) + (r.stats.sides?.S ?? 0) > 0);
console.log(JSON.stringify({ sessions: results.length, samples: results.reduce((n, r) => n + (r.stats?.samples ?? 0), 0),
  blocked: results.reduce((n, r) => n + (r.stats?.blocked ?? 0), 0), frozen: results.reduce((n, r) => n + (r.stats?.frozen ?? 0), 0),
  exitsNorthWest: results.reduce((n, r) => n + (r.stats?.sides?.N ?? 0) + (r.stats?.sides?.W ?? 0), 0),
  exitsEastSouth: results.reduce((n, r) => n + (r.stats?.sides?.E ?? 0) + (r.stats?.sides?.S ?? 0), 0), failed: bad.map(r => r.biomeId + '/' + r.phase) }));
process.exit(bad.length ? 1 : 0);

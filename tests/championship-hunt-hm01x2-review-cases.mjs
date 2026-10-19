// HM01 whole-map rebuild review (Owner 2026-10-19, local): one 180x180 map with
// about twice the explorable area. The original functional layout keeps its
// coordinates (old -> new is the identity): both caves and their escape anchors,
// the lake, the ridges and the edges that still are edges.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createChampionshipStandaloneApp } from "../src/championship/app/championshipStandaloneApp.js";
import { resolveNativeHuntEnvironment, NATIVE_HUNT_EXPANSION_ADAPTATION } from "../src/championship/hunt/capture/nativeHuntSceneSources.js";

const read = p => JSON.parse(fs.readFileSync(p, "utf8"));
const expansion = read("src/data/championship/catalogs/hunt-hm01x2.review-20261019.json");
const manifest = read("assets/production/hunt/hm01x2-review-20261019/manifest.json");
const catalog = read("src/data/championship/catalogs/creature-species.r1.json");
const { cages } = read("docs/contracts/championship/raising-home-presentation.v1.json");
const store = () => { const map = new Map(); return { getItem: k => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: k => map.delete(k) }; };
const N = 180;
// Original cells the rebuild may open: two cuts through the old south forest
// belt, and the old edge row/column that are interior now.
const opened = (x, y) => (x >= 18 && x <= 27 && y >= 118) || (x >= 76 && x <= 81 && y >= 126) || y === 127 || x === 127;

function explorable(env) {
  let open = 0;
  for (let y = 0; y < env.height; y++) for (let x = 0; x < env.width; x++) if (!env.isBlocked(x, y)) open++;
  return open;
}
function components(env) {
  const seen = new Uint8Array(env.width * env.height), sizes = [];
  for (let s = 0; s < seen.length; s++) {
    const sx = s % env.width, sy = Math.floor(s / env.width);
    if (seen[s] || env.isBlocked(sx, sy)) continue;
    let n = 0; const q = [s]; seen[s] = 1;
    while (q.length) {
      const i = q.pop(), x = i % env.width, y = Math.floor(i / env.width); n++;
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nx = x + dx, ny = y + dy, j = ny * env.width + nx;
        if (nx >= 0 && ny >= 0 && nx < env.width && ny < env.height && !seen[j] && !env.isBlocked(nx, ny)) { seen[j] = 1; q.push(j); }
      }
    }
    sizes.push(n);
  }
  return sizes.sort((a, b) => b - a);
}

test("HM01x2 keeps the original functional layout at its coordinates and doubles the explorable area", () => {
  assert.equal(expansion.adaptation, NATIVE_HUNT_EXPANSION_ADAPTATION);
  for (const fieldId of ["field_hm01_01", "field_hm01_02"]) {
    const base = resolveNativeHuntEnvironment(fieldId), env = resolveNativeHuntEnvironment(fieldId, { expansion });
    assert.equal(env.width, N); assert.equal(env.height, N);
    for (let y = 0; y < 128; y++) for (let x = 0; x < 128; x++) if (!opened(x, y)) assert.equal(env.readTerrain(x, y), base.readTerrain(x, y), `${fieldId} ${x},${y}`);
    // both original caves keep their escape anchors; the new plateau cave adds one pair
    for (const [x, y] of [[35, 4], [36, 4], [79, 59], [80, 59], [79, 156], [80, 156]]) {
      assert.equal(env.readDirectionCell(x, y).escapeAnchor, true, `${fieldId} anchor ${x},${y}`);
      assert.equal(env.isBlocked(x, y), false);
    }
    // edges: the new outer edge carries the exits; old edge cells that now continue do not
    let newExits = 0;
    for (let i = 0; i < N; i++) for (const [x, y] of [[N - 1, i], [i, N - 1]]) {
      const cell = env.readDirectionCell(x, y);
      if (cell.escapeBoundary) { newExits++; assert.equal(env.isBlocked(x, y), false); }
    }
    assert.ok(newExits >= 20, `${fieldId} new exits ${newExits}`);
    for (let i = 0; i < 128; i++) {
      if (!env.isBlocked(128, i)) assert.equal(env.readDirectionCell(127, i).escapeBoundary, false, `${fieldId} old east edge ${i}`);
      if (!env.isBlocked(i, 128)) assert.equal(env.readDirectionCell(i, 127).escapeBoundary, false, `${fieldId} old south edge ${i}`);
    }
    const ratio = explorable(env) / explorable(base);
    assert.ok(ratio > 1.9 && ratio < 2.1, `${fieldId} explorable ratio ${ratio}`);
    // the new ground is one connected meadow: only the original's own sealed pockets remain apart
    const sizes = components(env), baseSizes = components(base);
    assert.deepEqual(sizes.slice(1), baseSizes.slice(1).filter(n => n !== 442));
  }
});

test("the review art covers the 180x180 world with phase-coupled occluders and cave back-caps", () => {
  assert.equal(manifest.fieldCount, 2);
  for (const field of manifest.fields) {
    assert.equal(field.worldWidthPx, N * 16); assert.equal(field.worldHeightPx, N * 16);
    assert.equal(field.frames.length, 2);
    assert.equal(field.depthOccluders.animationFrames.length, 2);
    for (const f of field.frames) assert.ok(fs.existsSync(f.src));
    const pieces = read(field.depthOccluders.pieces.src).pieces;
    assert.equal(pieces.length, field.depthOccluders.pieceCount);
    const caps = pieces.filter(p => p[8] === 1 && p[2] === 200);
    assert.ok(caps.some(p => p[0] === 476 && p[1] === 0 && p[6] === 80));
    assert.ok(caps.some(p => p[0] === 1180 && p[1] === 844 && p[6] === 960));
    assert.ok(caps.some(p => p[0] === 1180 && p[1] === 2396 && p[6] === 2512));
  }
});

test("a normal Grass hunt with the review loader enters the rebuilt world and spawns reach the new ground", async () => {
  const appFor = (huntExpansionLoader, hour) => createChampionshipStandaloneApp({ storage: store(), locks: null, catalog, cages,
    rngClock: () => ({ hour, minute: 20, second: 50 }), huntExpansionLoader });
  let inNew = 0, total = 0;
  for (const hour of [9, 13, 16]) {
    const app = appFor(async () => expansion, hour);
    await app.newGame();
    app.openGate(); app.selectGate(app.getGates().find(g => g.biomeId === "Grass").gateId); app.confirmGate();
    await app.beginHunt();
    assert.equal(app.getHuntEntryError(), null);
    const world = app.getHuntRuntime().world;
    assert.equal(world.widthTiles, N); assert.equal(world.worldWidthPx, N * 16); assert.equal(world.definition.dimensions.heightTiles, N);
    for (const w of world.wildCreatures) {
      assert.ok(w.worldX >= 0 && w.worldX < N * 16 && w.worldY >= 0 && w.worldY < N * 16);
      assert.equal(world.isBlockedTile(Math.floor(w.worldX / 16), Math.floor(w.worldY / 16)), false);
      total++; if (w.worldX >= 128 * 16 || w.worldY >= 128 * 16) inNew++;
    }
    app.getHuntRuntime().tick(1000);
  }
  assert.ok(total > 0 && inNew > 0, `spawns in the new ground ${inNew}/${total}`);
});

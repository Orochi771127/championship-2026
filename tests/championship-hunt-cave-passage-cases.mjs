// Shared cave passages (Owner 2026-10-19, rebuilt review maps only): a creature
// that escapes into a cave is hidden for a while and walks out of another valid
// cave of the same group as the same individual; one creature per mouth at a time.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { resolveNativeHuntEnvironment } from "../src/championship/hunt/capture/nativeHuntSceneSources.js";
import { beginNativeHuntEscape, stepNativeHuntPassage, endNativeHuntPassage, CAVE_PASSAGE_TICKS, validateCaveGroups }
  from "../src/championship/hunt/capture/nativeHuntCavePassage.js";
import { queryNativeHuntActors } from "../src/championship/hunt/capture/nativeWildSpatial.js";

const Q = 4096;
const expansion = JSON.parse(fs.readFileSync("src/data/championship/catalogs/hunt-hm01x2.review-20261019.json", "utf8"));
const env = () => resolveNativeHuntEnvironment("field_hm01_01", { expansion });
const atTile = (x, y) => [(x * 8 + 4) * Q, (y * 8 + 4) * Q, 0];
const actor = (id, x, y) => ({ wildId: id, positionQ12: atTile(x, y), actorActive: 1, hidden: false, individual: { fields: { "050": 77 } },
  bounds: { rect: [-10, -20, 10, 5] } });
const channel = seq => { let i = 0; return () => seq[i++ % seq.length]; };
const tile = a => a.positionQ12.slice(0, 2).map(n => Math.trunc((n >> 12) / 8));
const run = (a, e) => { const seen = []; for (let k = 0; k < 400; k++) { seen.push({ phase: a.passage?.phase, hidden: a.hidden, alpha: a.passageAlpha, tile: tile(a) });
  if (stepNativeHuntPassage(a, e)) return seen; } throw Error("passage never ended"); };

test("the rebuilt HM01 carries one group of three caves; original fields carry none", () => {
  const e = env();
  assert.equal(e.caveGroups.length, 1);
  assert.deepEqual(e.caveGroups[0].caves.map(c => c.anchorTiles[0]), [[35, 4], [79, 59], [79, 156]]);
  for (const c of e.caveGroups[0].caves) for (const t of c.anchorTiles) assert.equal(e.readDirectionCell(...t).escapeAnchor, true);
  assert.equal(resolveNativeHuntEnvironment("field_hm01_01").caveGroups, undefined);
  assert.throws(() => validateCaveGroups([{ id: "g", caves: [{ id: "c", anchorTiles: [[1, 1]], mouthTile: [1, 4] }] }], 128, 128));
});

test("entering a cave hides the same individual and brings it out of another cave of its group", () => {
  const e = env(), a = actor("w1", 35, 4), hp = a.individual;
  const start = beginNativeHuntEscape(a, e, channel([5, 9]));
  assert.equal(start.kind, "PASSAGE");
  assert.notEqual(start.to, "hm01-cave-north");
  const seen = run(a, e);
  const phases = [...new Set(seen.map(s => s.phase))];
  assert.deepEqual(phases, ["ENTER", "HIDDEN", "EXIT"]);
  assert.ok(seen.filter(s => s.phase === "HIDDEN").length >= CAVE_PASSAGE_TICKS.hidden);
  assert.ok(seen.filter(s => s.phase === "HIDDEN").every(s => s.hidden && s.alpha === 0));
  // fades: out while entering, in while leaving
  const enter = seen.filter(s => s.phase === "ENTER"), exit = seen.filter(s => s.phase === "EXIT");
  assert.ok(enter.at(-1).alpha < enter[0].alpha && exit.at(-1).alpha > exit[0].alpha);
  // ends just outside the target cave mouth, on open ground, visible, same object and record
  const cave = e.caveGroups[0].caves.find(c => c.id === start.to);
  const [x, y] = tile(a);
  assert.equal(y, cave.mouthTile[1]); assert.ok(x === cave.anchorTiles[0][0] || x === cave.anchorTiles[1][0]);
  for (const s of exit) assert.equal(e.isBlocked(...s.tile), false);
  assert.equal(a.passage, null); assert.equal(a.hidden, false); assert.equal(a.passageAlpha, 1);
  assert.equal(a.individual, hp); assert.equal(a.wildId, "w1");
});

test("a creature in a passage cannot be targeted, and two never come out of one mouth together", () => {
  const e = env(), a = actor("a", 35, 4), b = actor("b", 79, 59);
  beginNativeHuntEscape(a, e, channel([0, 0]));
  assert.equal(queryNativeHuntActors([a], a.positionQ12, [-30, -30, 30, 30]).length, 0);
  // b's draws pick the cave a is heading for whenever both see the same candidates
  beginNativeHuntEscape(b, e, channel([0, 0]));
  const exiting = new Map();
  for (let k = 0; k < 600 && (a.passage || b.passage); k++) {
    for (const w of [a, b]) if (w.passage) stepNativeHuntPassage(w, e);
    const out = [a, b].filter(w => w.passage?.phase === "EXIT").map(w => w.passage.to);
    assert.equal(new Set(out).size, out.length, "two creatures share one mouth");
    for (const w of [a, b]) if (w.passage?.phase === "EXIT") exiting.set(w.wildId, w.passage.to);
  }
  assert.equal(a.passage, null); assert.equal(b.passage, null);
  assert.equal(exiting.size, 2);
});

test("a capture or reset during a passage releases the mouth and leaves the creature visible", () => {
  const e = env(), a = actor("a", 35, 4);
  beginNativeHuntEscape(a, e, channel([1, 1]));
  for (let k = 0; k < CAVE_PASSAGE_TICKS.enter + CAVE_PASSAGE_TICKS.hidden + 3; k++) stepNativeHuntPassage(a, e);
  assert.equal(a.passage.phase, "EXIT");
  const to = a.passage.to;
  endNativeHuntPassage(a, e);
  assert.equal(a.passage, null); assert.equal(a.hidden, false);
  const b = actor("b", 79, 156);
  // the released mouth is usable again at once
  for (let s = 0; s < 6 && !(b.passage?.to === to); s++) { endNativeHuntPassage(b, e); beginNativeHuntEscape(b, e, channel([s, 0])); }
  assert.equal(b.passage.to, to);
});

test("an open-ground tile that is not an escape cell starts nothing and draws nothing", () => {
  const e = env(), a = actor("a", 60, 90);
  let draws = 0;
  assert.equal(beginNativeHuntEscape(a, e, () => { draws++; return 0; }), null);
  assert.equal(draws, 0);
});

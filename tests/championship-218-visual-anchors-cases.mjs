// Offline visual anchors for every Dex partner (Owner 2026-10-29): the table
// written by scripts/calibrate-218-visual-anchors.mjs must cover all 218
// partners, describe single bodies (never a page strip), aim from the upper
// body and frame a drawn head -- and the runtime must read it.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

import { listDatabaseSlots } from "../src/championship/database/databaseCatalog.js";
import { MONSTER_VISUAL_ANCHOR_IDS, MONSTER_VISUAL_ANCHORS_SUMMARY, monsterVisualAnchor } from "../src/championship/data/monsterVisualAnchors218.js";
import { SHOWCASE_ACTIONS, createSpriteMotion, loadShowcaseMotion } from "../src/championship/presentation/juicy/spriteMotionPlayer.js";
import { juicyPortrait } from "../src/championship/presentation/juicy/juicyArt.js";
import { skillCutInFaceFrame } from "../src/championship/presentation/juicy/skillCutIn.js";

const slots = listDatabaseSlots();
const localFetch = async url => {
  const text = fs.readFileSync(decodeURIComponent(new URL(url).pathname.slice(1)), "utf8");
  return { ok: true, status: 200, text: async () => text, json: async () => JSON.parse(text) };
};
const BASE = "http://127.0.0.1:8811/championship.html";

test("218/218 Dex partners have anchors, with no gap and no stray id", () => {
  assert.ok((MONSTER_VISUAL_ANCHORS_SUMMARY.art.reviewed ?? 0) + (MONSTER_VISUAL_ANCHORS_SUMMARY.art["reviewed-right"] ?? 0) >= 100, "the reviewed artwork is calibrated");
  assert.equal(slots.length, 218);
  assert.deepEqual([...MONSTER_VISUAL_ANCHOR_IDS].sort(), slots.map(slot => slot.speciesId).sort());
  assert.equal(MONSTER_VISUAL_ANCHORS_SUMMARY.species, 218);
  assert.equal(MONSTER_VISUAL_ANCHORS_SUMMARY.withMotion, 218);
  assert.equal(MONSTER_VISUAL_ANCHORS_SUMMARY.withHead, 218);
  assert.deepEqual(MONSTER_VISUAL_ANCHORS_SUMMARY.motionErrors, []);
  for (const slot of slots) {
    const anchor = monsterVisualAnchor(slot.speciesIndex);
    assert.ok(anchor?.motion && anchor.cutinHeadFrame, slot.speciesId);
    assert.equal(monsterVisualAnchor(slot.speciesId), anchor);
    assert.equal(monsterVisualAnchor(`championship:creature:${slot.speciesId}`), anchor);
  }
  assert.equal(monsterVisualAnchor("species-999"), null);
});

test("every action of every partner is one body: a trimmed cell, never a page strip", () => {
  for (const id of MONSTER_VISUAL_ANCHOR_IDS) {
    const { motion } = monsterVisualAnchor(id);
    // species-222 ships only its cheer sequence; the player falls back to the first one present.
    assert.ok(Object.values(motion.actions).some(Boolean), `${id}: at least one action`);
    for (const [action, spec] of Object.entries(motion.actions)) {
      if (!spec) continue;
      const aspect = spec.frameWidth / spec.frameHeight;
      assert.ok(spec.frameCount >= 1, `${id} ${action}`);
      assert.ok(aspect > 0.25 && aspect < 3, `${id} ${action}: a single body, never a 4:1 strip (aspect ${aspect.toFixed(2)})`);
      // Most pages hold many bodies (so only the cell may show); a few reviewed pages hold just one.
      assert.ok(spec.cellsPerPage >= 1, `${id} ${action}: the cell fits on its page`);
    }
  }
});

test("the muzzle sits ahead in the upper body and the feet stand on the origin", () => {
  const stances = { grounded: 0, "tail-below": 0, hovering: 0 };
  for (const id of MONSTER_VISUAL_ANCHOR_IDS) {
    const { motion } = monsterVisualAnchor(id);
    const muzzle = motion.muzzleSocket, foot = motion.footAnchor, b = motion.bounds;
    assert.ok(muzzle, `${id}: a muzzle`);
    // heightRatio is measured on the release cell itself (a lunge stands lower than the idle).
    assert.ok(muzzle.heightRatio >= 0.5 && muzzle.heightRatio <= 0.92, `${id}: upper body, never the belly or the feet (${muzzle.heightRatio})`);
    assert.ok(muzzle.y < 0, `${id}: above the feet`);
    assert.ok(muzzle.x >= b.left && muzzle.x <= b.right && muzzle.y >= b.top && muzzle.y <= 0, `${id}: inside the drawn bounds`);
    assert.deepEqual([foot.x, foot.y], [0, 0], `${id}: the geometry's foot origin is the ground`);
    stances[foot.stance]++;
    if (foot.stance === "grounded") assert.ok(Math.abs(foot.lowestPixel) <= 8, `${id}: grounded feet meet the origin`);
  }
  assert.equal(stances.grounded + stances["tail-below"] + stances.hovering, 218);
  assert.ok(stances.grounded > 109, "most partners stand with their feet on the origin");
  assert.deepEqual(stances, MONSTER_VISUAL_ANCHORS_SUMMARY.stances);
});

test("every cut-in head frame focuses on drawn pixels and fits the strip", () => {
  const faces = new Map(JSON.parse(fs.readFileSync("src/data/championship/database-hero-faces.v1.json", "utf8")).entries.map(row => [row.speciesIndex, row]));
  for (const slot of slots) {
    const head = monsterVisualAnchor(slot.speciesIndex).cutinHeadFrame;
    assert.ok(head.headFocusX > 0 && head.headFocusX < 1 && head.headFocusY > 0 && head.headFocusY < 1, slot.speciesId);
    assert.ok(head.headSafeScale > 0.15 && head.headSafeScale <= 0.62, `${slot.speciesId}: a whole head, not an eye or the whole body`);
    assert.ok(head.opaqueInHead >= 0.25, `${slot.speciesId}: the head square is on the drawing`);
    const portrait = juicyPortrait(slot.speciesIndex);
    const frame = skillCutInFaceFrame(portrait);
    assert.equal(frame.source, "face", `${slot.speciesId}: the strip uses the calibrated head`);
    const measured = faces.get(slot.speciesIndex).face;
    assert.ok(Math.abs(portrait.face[0] - measured[0]) <= 1 && Math.abs(portrait.face[1] - measured[1]) <= 1, `${slot.speciesId}: table and measurement agree`);
  }
  assert.ok(MONSTER_VISUAL_ANCHORS_SUMMARY.headsOnBody >= 210);
});

test("the runtime reads the table: one cell per frame and the calibrated muzzle", async () => {
  const rightFacing = MONSTER_VISUAL_ANCHOR_IDS.filter(id => monsterVisualAnchor(id).motion.art === "reviewed-right").slice(0, 3);
  const sample = ["species-021", "species-034", "species-022", "species-054", "species-222", ...rightFacing, ...MONSTER_VISUAL_ANCHOR_IDS.filter((_, i) => i % 23 === 0)];
  for (const id of new Set(sample)) {
    const motion = await loadShowcaseMotion(id, { baseUrl: BASE, fetchImpl: localFetch });
    const anchor = monsterVisualAnchor(id).motion;
    assert.deepEqual({ ...motion.muzzle }, { x: anchor.muzzleSocket.x, y: anchor.muzzleSocket.y }, `${id}: muzzle from the table`);
    // The new reviewed artwork (#114) is what both the table and the player use.
    assert.equal(Boolean(motion.reviewed), anchor.art !== "atlas", `${id}: art source`);
    assert.equal(Boolean(motion.facesRight), anchor.art === "reviewed-right", `${id}: drawn facing`);
    for (const action of SHOWCASE_ACTIONS) {
      const frames = motion.sequences.get(action.sequence), spec = anchor.actions[action.id];
      if (!spec) { assert.ok(!frames, `${id} ${action.id}`); continue; }
      assert.equal(frames.length, spec.frameCount, `${id} ${action.id}: frame count`);
      assert.equal(Math.max(...frames.map(f => f.w)), spec.frameWidth, `${id} ${action.id}: cell width`);
    }
    const doc = { createElement: () => ({ style: { setProperty(k, v) { this[k] = v; } }, dataset: {}, className: "", append() {}, remove() {} }) };
    const sprite = createSpriteMotion({ doc, motion, scale: 1 });
    sprite.play(0);
    assert.ok(parseFloat(sprite.element.style.width) <= motion.frameWidth + 1, `${id}: the element is the drawn bounds`);
  }
});

test("the calibrator and its accessor are part of the repository", () => {
  const script = fs.readFileSync("scripts/calibrate-218-visual-anchors.mjs", "utf8");
  assert.match(script, /listDatabaseSlots\(\)/, "it walks every Dex slot");
  assert.match(script, /createImageBitmap/, "it scans real pixels (alpha) in headless Chromium");
  assert.match(script, /--check/);
  const table = fs.readFileSync("src/championship/data/monsterVisualAnchors218.js", "utf8");
  assert.match(table, /^\/\/ GENERATED by scripts\/calibrate-218-visual-anchors\.mjs/);
  assert.ok(Buffer.byteLength(table) < 64 * 1024, "a compact runtime table");
});

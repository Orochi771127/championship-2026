// MOVE_VFX_QUALITY_20261110: pixel motes on every live move effect and hit, and the hold that follows the blow.
import test from "node:test";
import assert from "node:assert/strict";
import { ELEMENT_VFX } from "../src/championship/presentation/vfx/unifiedMoveVfxResolver.js";
import { BATTLE_FX_JUICY } from "../src/championship/presentation/battleFx/battleFxLayer.js";
import {
  PIXEL_MOTE_CAP, PIXEL_MOTE_RECIPES, PIXEL_MOTE_WEIGHT, createPixelMotes, paintPixelMote, pixelMoteCrowding, pixelMoteElement, pixelMoteRandom
} from "../src/championship/presentation/vfx/pixelMotes.js";

function fakePixi() {
  const point = () => ({ x: 0, y: 0, set(x, y = x) { this.x = x; this.y = y; } });
  class Container {
    constructor() { Object.assign(this, { children: [], parent: null, visible: true, alpha: 1, rotation: 0, position: point(), scale: point(), anchor: point(), destroyed: false }); }
    addChild(node) { node.parent = this; this.children.push(node); return node; }
    removeChild(node) { this.children = this.children.filter(c => c !== node); node.parent = null; }
    destroy() { this.destroyed = true; this.parent?.removeChild(this); }
  }
  class Sprite extends Container { constructor(texture) { super(); this.texture = texture; } }
  const made = [];
  return { Container, Sprite, made, Texture: { from: canvas => { const t = { canvas, source: { scaleMode: "linear" }, destroyed: false, destroy() { this.destroyed = true; } }; made.push(t); return t; } } };
}
const doc = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) };

test("every effect element has its own motes, shapes in its palette with a dark outline key", () => {
  for (const element of Object.keys(ELEMENT_VFX)) assert.ok(PIXEL_MOTE_RECIPES[element], element);
  assert.equal(pixelMoteElement("NOPE"), "NEUTRAL");
  const fire = paintPixelMote(PIXEL_MOTE_RECIPES.FIRE.shapes[0], PIXEL_MOTE_RECIPES.FIRE.palette);
  assert.equal(fire.w, 3); assert.equal(fire.h, 3);
  const corner = [...fire.data.slice(0, 4)];
  assert.ok(corner[3] === 255 && corner[0] < 80, "an 'o' texel is a dark outline");
  for (const [element, r] of Object.entries(PIXEL_MOTE_RECIPES)) {
    assert.ok(r.every > 0 && r.burst > 0 && r.life[0] < r.life[1], element);
    for (const rows of r.shapes) assert.ok(rows.every(row => /^[oemc.]+$/.test(row)), `${element} shape keys`);
  }
});

test("the simulation is seeded: the same burst lands the same way twice", () => {
  const run = () => {
    const PIXI = fakePixi(), layer = new PIXI.Container();
    const motes = createPixelMotes({ PIXI, layer, doc, seed: 42 });
    motes.burst({ element: "EARTH", x: 50, y: 40, groundY: 60, unit: 4, heavy: true, dir: 1 });
    for (let i = 0; i < 10; i++) motes.update(33);
    const out = layer.children.filter(s => s.visible).map(s => `${s.position.x},${s.position.y}`).join(";");
    motes.dispose();
    return out;
  };
  assert.equal(run(), run());
  const r = pixelMoteRandom(1);
  assert.ok([r(), r(), r()].every(v => v >= 0 && v < 1));
});

test("motes trail a live effect at the recipe cadence and stop when it ends", () => {
  const PIXI = fakePixi(), layer = new PIXI.Container();
  const motes = createPixelMotes({ PIXI, layer, doc });
  const every = PIXEL_MOTE_RECIPES.WATER.every;
  for (let t = 0; t < every * 16; t += 10) { motes.trail("shot", { element: "WATER", x: 0, y: 0, groundY: 30, unit: 4 }); motes.update(10); }
  const emitted = motes.getDiagnostics().emitted;
  assert.ok(emitted >= 9 && emitted <= 11, `about one mote per ${every * 1.6} ms (${emitted})`);
  motes.update(1000);
  assert.equal(motes.getDiagnostics().trails, 0, "a trail no longer fed is forgotten");
  motes.dispose();
});

test("a hit throws motes by its weight: light 3, medium 6, heavy the recipe, a signature 1.3x", () => {
  const PIXI = fakePixi(), layer = new PIXI.Container();
  const motes = createPixelMotes({ PIXI, layer, doc, quality: "high" });
  const counts = ["light", "medium", "heavy", "ultimate"].map(weight => { const n = motes.burst({ element: "FIRE", x: 0, y: 0, unit: 4, weight }); motes.update(5000); return n; });
  assert.deepEqual(counts, [PIXEL_MOTE_WEIGHT.light, PIXEL_MOTE_WEIGHT.medium, PIXEL_MOTE_RECIPES.FIRE.burst, Math.round(PIXEL_MOTE_RECIPES.FIRE.burst * 1.3)]);
  motes.dispose();
});

test("a crowded field takes fewer motes, and trails yield once it is half full", () => {
  assert.equal(pixelMoteCrowding(10, 0, 80), 10);
  assert.equal(pixelMoteCrowding(10, 40, 80), 10);
  assert.equal(pixelMoteCrowding(10, 60, 80), 5);
  assert.equal(pixelMoteCrowding(10, 80, 80), 0);
  const PIXI = fakePixi(), layer = new PIXI.Container();
  const motes = createPixelMotes({ PIXI, layer, doc, quality: "saver" });
  for (let i = 0; i < 6; i++) motes.burst({ element: "METAL", x: 0, y: 0, unit: 4, weight: "heavy" });
  const before = motes.getDiagnostics().emitted;
  for (let t = 0; t < 400; t += 10) { motes.trail("shot", { element: "METAL", x: 0, y: 0, unit: 4 }); motes.update(1); }
  assert.equal(motes.getDiagnostics().emitted, before, "no trail motes over a crowded field");
  motes.dispose();
});

test("bursts scale with weight, respect the tier cap, and hold on a zero delta", () => {
  const PIXI = fakePixi(), layer = new PIXI.Container();
  const motes = createPixelMotes({ PIXI, layer, doc, quality: "saver" });
  motes.burst({ element: "FIRE", x: 0, y: 0, unit: 4 });
  const light = motes.getDiagnostics().emitted;
  motes.burst({ element: "FIRE", x: 0, y: 0, unit: 4, heavy: true });
  assert.ok(motes.getDiagnostics().emitted - light > light, "a heavy hit throws more");
  for (let i = 0; i < 20; i++) motes.burst({ element: "METAL", x: 0, y: 0, unit: 4, heavy: true });
  const d = motes.getDiagnostics();
  assert.ok(d.live <= PIXEL_MOTE_CAP.saver && d.live > PIXEL_MOTE_CAP.saver / 2, `crowding settles below the cap (${d.live})`);
  const before = layer.children.filter(s => s.visible).map(s => s.position.x).join();
  motes.update(0);
  assert.equal(layer.children.filter(s => s.visible).map(s => s.position.x).join(), before, "a hit-stop holds them");
  motes.update(5000);
  assert.equal(motes.getDiagnostics().live, 0);
  motes.dispose();
  assert.equal(layer.children.length, 0);
  assert.ok(PIXI.made.every(t => t.destroyed));
});

test("reduced motion: no trails, a third of a burst, nothing thrown along the blow", () => {
  const PIXI = fakePixi(), layer = new PIXI.Container();
  const motes = createPixelMotes({ PIXI, layer, doc, reducedMotion: true });
  motes.trail("shot", { element: "FIRE", x: 0, y: 0, unit: 4 });
  assert.equal(motes.getDiagnostics().emitted, 0);
  motes.burst({ element: "ICE", x: 0, y: 0, unit: 4, weight: "heavy" });
  assert.equal(motes.getDiagnostics().emitted, Math.round(PIXEL_MOTE_RECIPES.ICE.burst / 3));
  motes.dispose();
});

test("a canvas that cannot paint draws no motes instead of failing", () => {
  const PIXI = fakePixi(), layer = new PIXI.Container();
  const motes = createPixelMotes({ PIXI, layer, doc: { createElement: () => ({ getContext: () => ({}) }) } });
  motes.burst({ element: "FIRE", x: 0, y: 0, unit: 4 });
  motes.trail("x", { element: "FIRE", x: 0, y: 0, unit: 4 });
  motes.update(16);
  assert.equal(layer.children.length, 0);
  motes.dispose();
});

test("the hold follows the blow: light never, medium 45, heavy 65, critical or signature 95 ms", () => {
  assert.deepEqual({ ...BATTLE_FX_JUICY.hitStopByTier }, { light: 0, medium: 45, heavy: 65, ultimate: 95 });
  assert.equal(BATTLE_FX_JUICY.hitStopMs, BATTLE_FX_JUICY.hitStopByTier.heavy);
});

test("the 3D overlay leaves the two hit-spark families to the pixel hit bursts, nothing else", async () => {
  const fs = await import("node:fs");
  const overlay = fs.readFileSync("src/championship/presentation/vs5/createBattleVfxThreeOverlay.js", "utf8");
  assert.match(overlay, /HIT_SPARK_TYPES = new Set\(\[0, 1\]\)/);
  assert.match(overlay, /pixelHitsOwnSparks = \(\) => false/, "off unless the scene says its pixel bursts own the contact");
  const { BATTLE_IMPACT_FAMILIES } = await import("../src/championship/battle/battleImpactEffects.js");
  assert.deepEqual([0, 1].map(t => BATTLE_IMPACT_FAMILIES[t].systemId), ["battle-hitspark_small", "battle-hitspark_big"]);
  const layer = fs.readFileSync("src/championship/presentation/battleFx/battleFxLayer.js", "utf8");
  assert.match(layer, /ownsHitSparks: \(\) => Boolean\(pixelHits\)/);
  const main = fs.readFileSync("src/championship/app/main.js", "utf8");
  assert.match(main, /scene\?\.pixelHitsOwnSparks\?\.\(\)/);
});

// BESPOKE_MOVE_VFX_PROGRAM_20261111: per-move choreography and its set pieces.
import { MOVE_VFX_CHOREOGRAPHY, moveVfxChoreography } from "../src/championship/presentation/vfx/moveVfxChoreography.js";
import { MOVE_VFX_SET_PIECES, createMoveVfxSetPieces, paintSetPieceSprite } from "../src/championship/presentation/vfx/moveVfxSetPieces.js";
import battleMoves from "../src/data/championship/catalogs/battle-moves.r1.json" with { type: "json" };

test("every choreographed move exists and names only known set pieces", () => {
  const records = new Set(battleMoves.records.map(m => m.recordIndex));
  for (const [key, c] of Object.entries(MOVE_VFX_CHOREOGRAPHY)) {
    assert.ok(records.has(Number(key)), `record ${key}`);
    for (const phase of ["release", "contact"]) if (c[phase]) assert.ok(MOVE_VFX_SET_PIECES.includes(c[phase].piece), `${key} ${phase}`);
    if (c.hitStopMs !== undefined) assert.ok(c.hitStopMs >= 0 && c.hitStopMs <= 120, `${key} hit-stop stays short`);
    if (c.shake) assert.ok(["light", "medium", "heavy"].includes(c.shake));
  }
  assert.equal(moveVfxChoreography("own-195"), moveVfxChoreography(195), "a partner's own Data Arena move reads its record");
  assert.equal(moveVfxChoreography(999999), null);
  // batch 1: the main team's nine moves, each with its own moment
  for (const id of [193, 194, 195, 213, 214, 215, 216, 226, 227]) assert.ok(MOVE_VFX_CHOREOGRAPHY[id]?.contact, `record ${id}`);
});

test("set pieces paint in the move's palette, play once on the owner's delta and recycle", () => {
  const palette = { core: 0xfff4c2, main: 0xff8a1c, edge: 0xd8360f };
  const jaw = paintSetPieceSprite("jaw_top", palette);
  assert.ok(jaw && jaw.w >= 44 && jaw.h >= 20, "the jaw is drawn");
  const colours = new Set(); for (let i = 0; i < jaw.data.length; i += 4) if (jaw.data[i + 3]) colours.add(jaw.data.slice(i, i + 3).join());
  assert.ok(colours.has("255,138,28"), "main tone is the palette's main");
  assert.ok(colours.has("255,255,255"), "fangs stay white");
  const PIXI = fakePixi(), layer = new PIXI.Container();
  const pieces = createMoveVfxSetPieces({ PIXI, layer, doc });
  for (const piece of MOVE_VFX_SET_PIECES) assert.equal(pieces.play(piece, { x: 0, y: 0, palette, size: 120 }), true, piece);
  assert.equal(pieces.play("nope", { x: 0, y: 0, palette }), false);
  const before = pieces.getDiagnostics().live;
  pieces.update(0);
  assert.equal(pieces.getDiagnostics().live, before, "a hit-stop holds them");
  pieces.update(2000);
  assert.equal(pieces.getDiagnostics().live, 0);
  assert.ok(layer.children.every(s => !s.visible), "finished pieces go back to the pool");
  pieces.dispose();
  assert.equal(layer.children.length, 0);
});

test("every signature move has its own choreography, and every drawing it names exists", async () => {
  const { moveVfxSignature } = await import("../src/championship/presentation/vfx/moveVfxSignatures.js");
  const { MOVE_VFX_PIECE_DRAWINGS } = await import("../src/championship/presentation/vfx/moveVfxSetPieces.js");
  const { DRAWN_VFX_SPRITES } = await import("../src/championship/presentation/vfx/drawnVfxSprites.js");
  const missing = battleMoves.records.filter(m => moveVfxSignature(m.recordIndex)?.tier === "ultimate" && !MOVE_VFX_CHOREOGRAPHY[m.recordIndex]).map(m => m.recordIndex);
  assert.deepEqual(missing, []);
  for (const [key, c] of Object.entries(MOVE_VFX_CHOREOGRAPHY)) for (const phase of ["release", "contact"]) {
    const sprite = c[phase]?.sprite;
    if (sprite) { assert.ok(MOVE_VFX_PIECE_DRAWINGS.includes(sprite), `${key} ${sprite}`); assert.ok(DRAWN_VFX_SPRITES[sprite], `${key} ${sprite} drawn`); }
  }
});

test("every move has a cast: blows by record, support moves by the effect they apply", async () => {
  const { moveVfxSignature } = await import("../src/championship/presentation/vfx/moveVfxSignatures.js");
  const { moveVfxSupportChoreography } = await import("../src/championship/presentation/vfx/moveVfxChoreography.js");
  const { MOVE_VFX_SUPPORT_PIECES, createMoveVfxSetPieces } = await import("../src/championship/presentation/vfx/moveVfxSetPieces.js");
  const { BATTLE_FX_PALETTES } = await import("../src/championship/presentation/battleFx/battleFxPalettes.js");
  const blows = battleMoves.records.filter(m => moveVfxSignature(m.recordIndex) && moveVfxSignature(m.recordIndex).tier !== "support");
  assert.deepEqual(blows.filter(m => !MOVE_VFX_CHOREOGRAPHY[m.recordIndex]).map(m => m.recordIndex), []);
  // Every support record that applies an effect (kind 2) has its own piece in a known palette.
  for (const m of battleMoves.records.filter(r => r.kind === 2 && r.statusCode !== 0)) {
    const s = moveVfxSupportChoreography(m.statusCode);
    assert.ok(s && MOVE_VFX_SUPPORT_PIECES.includes(s.piece), `support ${m.recordIndex}`);
    assert.ok(BATTLE_FX_PALETTES[s.palette], `support ${m.recordIndex} palette`);
  }
  assert.equal(moveVfxSupportChoreography(0), null);
  // Each support piece plays and recycles.
  const point = () => ({ x: 0, y: 0, set(x, y = x) { this.x = x; this.y = y; } });
  class Sprite { constructor(t) { Object.assign(this, { texture: t, position: point(), scale: point(), anchor: point(), visible: true, alpha: 1, rotation: 0, parent: null }); } destroy() {} }
  const layer = { children: [], addChild(s) { this.children.push(s); }, removeChild() {} };
  const doc = { createElement: () => ({ width: 0, height: 0, getContext: () => ({ createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4) }), putImageData() {} }) }) };
  const pieces = createMoveVfxSetPieces({ PIXI: { Sprite, Texture: { from: () => ({ source: {}, destroy() {} }) } }, layer, doc });
  for (const piece of MOVE_VFX_SUPPORT_PIECES) assert.equal(pieces.play(piece, { x: 0, y: 0, palette: BATTLE_FX_PALETTES.nature, size: 70 }), true, piece);
  pieces.update(2000);
  assert.equal(pieces.getDiagnostics().live, 0);
});

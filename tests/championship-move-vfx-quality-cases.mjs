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
  class Texture { constructor({ source, frame } = {}) { Object.assign(this, { source, frame, destroyed: false }); } destroy() { this.destroyed = true; } }
  Texture.from = canvas => { const t = { canvas, source: { scaleMode: "linear" }, destroyed: false, destroy() { this.destroyed = true; } }; made.push(t); return t; };
  class Rectangle { constructor(x, y, w, h) { Object.assign(this, { x, y, width: w, height: h }); } }
  return { Container, Sprite, made, Texture, Rectangle };
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
import { MOVE_VFX_SET_PIECES, createMoveVfxSetPieces, recolourPiecePalette, loadMoveVfxPieceSprites } from "../src/championship/presentation/vfx/moveVfxSetPieces.js";
import { MOVE_VFX_PIECE_SPRITES } from "../src/championship/presentation/vfx/moveVfxPieceSprites.js";
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

test("set pieces are baked energy effects recoloured to the move, played once on the owner's delta and recycled", async () => {
  const palette = { core: 0xfff4c2, main: 0xff8a1c, edge: 0xd8360f };
  // Refinement pass 1 (Owner: 「很像卡通」「很廉價」): baked energy, no dark outline, no drawn object.
  const fist = MOVE_VFX_PIECE_SPRITES.fist;
  assert.ok(fist && fist.frames.length > 3 && fist.palette.length > 3, "the fist is a baked burst");
  const tinted = recolourPiecePalette([[255, 255, 255, 1], [128, 128, 128, 1], [200, 120, 40, 1], [20, 20, 20, 1]], palette);
  assert.ok(tinted[0].slice(0, 3).every(v => v >= 230), "white-hot stays near white");
  assert.deepEqual(tinted[2].slice(0, 3), [255, 138, 28], "a mid tone takes the move's main");
  assert.ok(recolourPiecePalette([[200, 0, 0, 1]], { ...palette, flat: true })[0].slice(0, 3).every(v => v === 255), "the impact frame is flat white");
  assert.ok(await loadMoveVfxPieceSprites(), "the sheets load on demand");
  const PIXI = fakePixi(), layer = new PIXI.Container();
  const pieces = createMoveVfxSetPieces({ PIXI, layer, doc, sprites: MOVE_VFX_PIECE_SPRITES });
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
  const missing = battleMoves.records.filter(m => moveVfxSignature(m.recordIndex)?.tier === "ultimate" && !MOVE_VFX_CHOREOGRAPHY[m.recordIndex]).map(m => m.recordIndex);
  assert.deepEqual(missing, []);
  for (const [key, c] of Object.entries(MOVE_VFX_CHOREOGRAPHY)) for (const phase of ["release", "contact"]) {
    const sprite = c[phase]?.sprite;
    if (sprite) assert.ok(MOVE_VFX_PIECE_DRAWINGS.includes(sprite), `${key} ${sprite}`);
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
  const PIXI = fakePixi(), pieces = createMoveVfxSetPieces({ PIXI, layer: new PIXI.Container(), doc, sprites: MOVE_VFX_PIECE_SPRITES });
  for (const piece of MOVE_VFX_SUPPORT_PIECES) assert.equal(pieces.play(piece, { x: 0, y: 0, palette: BATTLE_FX_PALETTES.nature, size: 70 }), true, piece);
  pieces.update(2000);
  assert.equal(pieces.getDiagnostics().live, 0);
});

test("refinement pass 2: floor circles, cover chips and breaks, and heavy-hit ground marks in the Data Arena", async () => {
  const fs = await import("node:fs");
  const { MOVE_VFX_PIECE_SPRITES } = await import("../src/championship/presentation/vfx/moveVfxPieceSprites.js");
  for (const name of ["sigil-cast", "sigil-rune", "prop-chip", "prop-dust"]) assert.ok(MOVE_VFX_PIECE_SPRITES[name]?.frames.length > 3, name);
  const { paintBakedPieceFrames } = await import("../src/championship/presentation/vfx/moveVfxSetPieces.js");
  const painted = paintBakedPieceFrames("sigil-cast", { core: 0xffffff, main: 0x66ccff, edge: 0x2266aa }, { doc });
  assert.ok(painted && painted.frames.length === MOVE_VFX_PIECE_SPRITES["sigil-cast"].frames.length, "the kit can paint a baked circle");
  const kit = fs.readFileSync("src/championship/presentation/vfx/moveVfxKit.js", "utf8");
  assert.match(kit, /sigilglow:/, "a baked circle carries its light layer");
  const fx = fs.readFileSync("src/championship/presentation/dataArena/dataArenaElementFx.js", "utf8");
  assert.match(fx, /if \(kit && heavy\) layer\.decal\(/, "a heavy hit marks the floor in the kit path too");
  assert.match(fx, /prop\(\{x, y, material/, "the element layer bursts cover");
  const scene = fs.readFileSync("src/championship/presentation/dataArena/dataArenaPixiScene.js", "utf8");
  assert.equal((scene.match(/elementFx\.prop\(/g) ?? []).length, 3, "relay cover and timber hits and breaks reach it");
});

test("refinement pass 3: flying shots carry baked heads and the arena's ground zones a baked sigil", async () => {
  const fs = await import("node:fs");
  const { MOVE_VFX_PIECE_SPRITES } = await import("../src/championship/presentation/vfx/moveVfxPieceSprites.js");
  for (const name of ["shot-fire", "shot-water", "shot-arcane", "shot-void", "shot-laser", "shot-plasma", "shot-ice", "shot-rocket", "shot-disc"]) {
    assert.ok(MOVE_VFX_PIECE_SPRITES[name]?.loop && MOVE_VFX_PIECE_SPRITES[name].frames.length > 3, `${name} loops`);
  }
  assert.ok(MOVE_VFX_PIECE_SPRITES["zone-sigil"]?.frames.length > 3);
  const kit = fs.readFileSync("src/championship/presentation/vfx/moveVfxKit.js", "utf8");
  assert.match(kit, /BAKED_HEAD = Object\.freeze\(\{fire: \['shot-fire'/, "the fire shot flies a fireball");
  assert.match(kit, /q\.rotation = q\.baked \? \(q\.upright \? 0 : p\.angle\)/, "a baked head points along its flight unless it stands upright");
  const scene = fs.readFileSync("src/championship/presentation/dataArena/dataArenaPixiScene.js", "utf8");
  assert.match(scene, /if \(!zoneSigil\(zone, color, p\) && pts\.length === 12\)/, "the drawn hexagram is only the fallback");
});

test("refinement pass 4: the kit's impacts land baked hits and a baked head drops the drawn trail", async () => {
  const fs = await import("node:fs");
  const kit = fs.readFileSync("src/championship/presentation/vfx/moveVfxKit.js", "utf8");
  assert.match(kit, /if \(bakedImpact\(\{x, y, groundY, angle, paletteKey, archetype, R\}\)\) return;/);
  const table = kit.match(/const BAKED_IMPACT = Object\.freeze\(\{([\s\S]*?)\}\);/)[1];
  const { MOVE_VFX_PIECE_SPRITES } = await import("../src/championship/presentation/vfx/moveVfxPieceSprites.js");
  for (const [, look] of table.matchAll(/\['([a-z-]+)', [0-9.]+/g)) assert.ok(MOVE_VFX_PIECE_SPRITES[look], `${look} is baked`);
  for (const archetype of ["fire", "water", "claw", "slash", "missile", "bite"]) assert.ok(table.includes(" " + archetype + ": [") || table.startsWith(archetype + ": ["), archetype);
  assert.match(kit, /if \(p\.head\?\.baked\) p\.acc = 0;/);
});

test("refinement pass 5: more baked heads, and the Dex preview lands each move's own baked piece", async () => {
  const fs = await import("node:fs");
  const { MOVE_VFX_PIECE_SPRITES } = await import("../src/championship/presentation/vfx/moveVfxPieceSprites.js");
  for (const name of ["shot-leaf", "shot-tornado", "shot-arrow", "shot-xp", "shot-heart", "shot-star", "shot-fish", "shot-wisp"]) assert.ok(MOVE_VFX_PIECE_SPRITES[name]?.loop, name);
  const kit = fs.readFileSync("src/championship/presentation/vfx/moveVfxKit.js", "utf8");
  assert.match(kit, /tornado: \['shot-tornado', 2\.2, true\]/, "a tornado stands upright");
  const { showcasePieceLook } = await import("../src/championship/presentation/juicy/codexShowcaseTheater.js");
  assert.equal(showcasePieceLook({ piece: "flurry", sprite: "feather_sm" }), "flurry-feather");
  assert.equal(showcasePieceLook({ piece: "jaws-horn" }), "jaws");
  for (const c of Object.values((await import("../src/championship/presentation/vfx/moveVfxChoreography.js")).MOVE_VFX_CHOREOGRAPHY)) {
    if (c.contact) assert.ok(MOVE_VFX_PIECE_SPRITES[showcasePieceLook(c.contact)], `${c.contact.piece} has a baked look for the Dex`);
  }
});

test("refinement pass 6: a move's own contact piece is not stacked under a second burst of the same kind", async () => {
  const fs = await import("node:fs");
  const kit = fs.readFileSync("src/championship/presentation/vfx/moveVfxKit.js", "utf8");
  assert.match(kit, /planted = false, piece = false\}\) \{/);
  assert.match(kit, /if \(piece\) return;\n    if \(bakedImpact\(/, "the kit keeps only its flare and motif when the move's piece plays");
  const arena = fs.readFileSync("src/championship/presentation/dataArena/dataArenaElementFx.js", "utf8");
  assert.match(arena, /piece: ownPiece === true/);
  const battle = fs.readFileSync("src/championship/presentation/battleFx/battleFxLayer.js", "utf8");
  assert.match(battle, /piece: Boolean\(owner && moveVfxChoreography\(owner\.moveId\)\?\.contact\)/);
  const bake = fs.readFileSync("scripts/vfx/bake-move-piece-vfx.mjs", "utf8");
  assert.match(bake, /core: \{fx: 'explosions\/plasma-explosion'/, "fire lands a plasma burst, not red balls");
});

test("refinement pass 7: the impact frame is two frames of flash, smaller than the move's own piece", async () => {
  const fs = await import("node:fs");
  const { MOVE_VFX_PIECE_SPRITES } = await import("../src/championship/presentation/vfx/moveVfxPieceSprites.js");
  assert.ok(MOVE_VFX_PIECE_SPRITES["impact-frame"].frames.length <= 2, "the flash alone, before any ring forms");
  for (const file of ["src/championship/presentation/battleFx/battleFxLayer.js", "src/championship/presentation/dataArena/dataArenaElementFx.js"]) {
    assert.match(fs.readFileSync(file, "utf8"), /scale \?\? 1\) \* 0\.7\}\);/, `${file} plays it at 0.7 of the contact`);
  }
});

test("refinement pass 8: the hyper aura and the hit ground marks are baked pixelfx, not vector strokes", async () => {
  const fs = await import("node:fs");
  const { MOVE_VFX_PIECE_SPRITES } = await import("../src/championship/presentation/vfx/moveVfxPieceSprites.js");
  for (const name of ["mark-ripple", "mark-frost", "mark-roots", "hyper-ring"]) assert.ok(MOVE_VFX_PIECE_SPRITES[name]?.frames.length > 3, name);
  assert.ok(MOVE_VFX_PIECE_SPRITES["hyper-ring"].loop, "the aura loops for the whole prelude");
  const { ELEMENT_DECAL_BAKED, ELEMENT_DECAL_AS_CRATER } = await import("../src/championship/presentation/vfx/elementVfxLayer.js");
  for (const kind of ["puddle", "frost", "roots", "swirl", "sunburst", "shade"]) assert.ok(MOVE_VFX_PIECE_SPRITES[ELEMENT_DECAL_BAKED[kind]], `${kind} leaves a baked mark`);
  assert.equal(ELEMENT_DECAL_AS_CRATER.static, "scorch", "a thunder mark scorches the floor");
  const layer = fs.readFileSync("src/championship/presentation/battleFx/battleFxLayer.js", "utf8");
  assert.match(layer, /if \(aura\) \{[\s\S]*?return;\n    \}/, "a baked aura replaces the vector ring and streaks");
});

test("refinement pass 9: the kit's wind-up, release and close, and the battle layer's rings, play baked pieces", async () => {
  const fs = await import("node:fs");
  const kit = fs.readFileSync("src/championship/presentation/vfx/moveVfxKit.js", "utf8");
  assert.match(kit, /name: 'pfxhit:muzzle-spiral'/, "the wind-up gathers as a spell charge");
  assert.match(kit, /name: 'pfxhit:muzzle', paletteKey, x, y, px: size \* 3\.2/, "the release flashes as a muzzle");
  assert.match(kit, /name: 'pfxhit:quake', paletteKey, x, y: groundY, px: size \* 6/, "the close shocks as a ground slam");
  assert.match(kit, /if \(signature && !\(piece && bakedPieceLook\('impact-frame'\)\)\) burstMotif/, "no motif rings over a move's own piece");
  const layer = fs.readFileSync("src/championship/presentation/battleFx/battleFxLayer.js", "utf8");
  assert.match(layer, /function spawnRing\([^)]*\) \{\n    if \(piecesBaked\(\)\) return;/, "the drawn rings stand down");
  assert.match(layer, /function pillar\([^)]*\) \{\n    if \(piecesBaked\(\)\) return;/, "the drawn light pillar stands down");
  assert.match(layer, /setPieces\.play\('prop-dust'/, "a fall bursts as a dirt explosion");
});

test("refinement pass 10: the Data Arena's event rings are baked energy rings and a fire hit is a ring of fire", async () => {
  const fs = await import("node:fs");
  const { MOVE_VFX_PIECE_SPRITES } = await import("../src/championship/presentation/vfx/moveVfxPieceSprites.js");
  for (const name of ["ring-burst", "ring-pop"]) assert.ok(MOVE_VFX_PIECE_SPRITES[name]?.anchor === "centre", name);
  const scene = fs.readFileSync("src/championship/presentation/dataArena/dataArenaPixiScene.js", "utf8");
  assert.match(scene, /function ring\(x, y, radius, tint, life = 0\.4, alpha = 0\.9\) \{\n[^\n]*\n    if \(typeof elementFx\?\.eventRing === 'function' && elementFx\.eventRing/, "every scene ring goes through the baked ring first");
  const { PIXEL_HIT_BURST_SPRITES } = await import("../src/championship/presentation/vfx/pixelHitBurstSprites.js");
  assert.equal(PIXEL_HIT_BURST_SPRITES.FIRE.source, "fire/fire-ring");
});

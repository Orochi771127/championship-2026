// UNIQUE_PIXEL_MOVE_VFX_20261108: every move its own look, in one pixel style.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import moves from "../src/data/championship/catalogs/battle-moves.r1.json" with { type: "json" };
import table from "../src/data/championship/move-vfx-signatures.r1.json" with { type: "json" };
import { listProductOriginalMoveRecords } from "../src/championship/contracts/productOriginalSpecies.js";
import { RELAY_POOL_MOVE_ELEMENT } from "../src/championship/modes/dataArena/dataArenaRelayKits.js";
import { MOVE_VFX_SIGNATURE_DIMS, MOVE_VFX_SIGNATURE_COUNT, moveVfxSignature } from "../src/championship/presentation/vfx/moveVfxSignatures.js";
import { MOVE_VFX_ARCHETYPES, createMoveVfxKit } from "../src/championship/presentation/vfx/moveVfxKit.js";
import { MOVE_VFX_SHEETS, bakeMoveVfxIntensity, createNoiseField, moveVfxSigilCells, paintMoveVfxSheet } from "../src/championship/presentation/vfx/moveVfxKitTextures.js";
import { moveVfxRecipe } from "../src/championship/presentation/vfx/moveVfxRecipes.js";
import { BATTLE_FX_PALETTES } from "../src/championship/presentation/battleFx/battleFxPalettes.js";

function fakePixi() {
  const point = () => ({ x: 0, y: 0, set(x, y = x) { this.x = x; this.y = y; } });
  class Container {
    constructor() { Object.assign(this, { children: [], parent: null, visible: true, alpha: 1, rotation: 0, position: point(), scale: point(), anchor: point(), destroyed: false }); }
    addChild(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } return nodes[0]; }
    removeChild(node) { this.children = this.children.filter(child => child !== node); }
    destroy() { this.destroyed = true; this.parent?.removeChild(this); }
  }
  class Sprite extends Container { constructor(texture) { super(); this.texture = texture; } }
  return { Container, Sprite, Texture: { from: canvas => ({ canvas, source: { scaleMode: "linear" }, destroyed: false, destroy() { this.destroyed = true; } }) } };
}
const doc = { createElement: () => { const canvas = { width: 0, height: 0, getContext: () => ({ createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), putImageData(image) { canvas.image = image; } }) }; return canvas; } };

test("the signature table is current with its generator", () => {
  const run = spawnSync(process.execPath, ["scripts/build-move-vfx-signatures.mjs", "--check"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);
});

test("every move has a signature: species, original-character, support and Data Arena pool moves", () => {
  const records = [...moves.records, ...listProductOriginalMoveRecords()].filter(m => m.recordIndex > 0);
  for (const move of records) assert.ok(moveVfxSignature(move.recordIndex), `record ${move.recordIndex}`);
  for (const id of Object.keys(RELAY_POOL_MOVE_ELEMENT)) assert.ok(moveVfxSignature(id), id);
  assert.equal(MOVE_VFX_SIGNATURE_COUNT, records.length + Object.keys(RELAY_POOL_MOVE_ELEMENT).length);
  // A partner's own Data Arena move reads the record's signature.
  assert.equal(moveVfxSignature("own-100"), moveVfxSignature(100));
});

test("no two moves look alike", () => {
  const all = table.moves.map(([key]) => moveVfxSignature(key));
  const look = s => [s.archetype, s.paletteKey, s.volley, s.path, s.combo, s.swing, s.scale, s.trail, s.burst];
  const whole = new Set(all.map(s => JSON.stringify(look(s))));
  assert.equal(whole.size, all.length, "every move's whole look is its own");
  // Two moves of one archetype and palette differ in at least two visible choices.
  const groups = new Map();
  for (const s of all) { const k = `${s.archetype}|${s.paletteKey}`; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(look(s).slice(2)); }
  for (const [group, looks] of groups) for (let i = 0; i < looks.length; i++) for (let j = i + 1; j < looks.length; j++)
    assert.ok(looks[i].filter((v, n) => v !== looks[j][n]).length >= 2, `${group} #${i} vs #${j}`);
  // And every sigil glyph is drawn only once.
  const glyphs = new Set(all.map(s => Buffer.from(moveVfxSigilCells(s.sigil).cells).toString("base64")));
  assert.equal(glyphs.size, all.length);
});

test("signatures stay inside the kit's vocabulary and lean on the tier", () => {
  const D = MOVE_VFX_SIGNATURE_DIMS;
  for (const [key] of table.moves) {
    const s = moveVfxSignature(key);
    if (s.tier !== "support") assert.ok(MOVE_VFX_ARCHETYPES.includes(s.archetype), `${key} ${s.archetype}`);
    assert.ok(BATTLE_FX_PALETTES[s.paletteKey], `${key} ${s.paletteKey}`);
    for (const dim of ["scale", "trail", "burst"]) assert.ok(D[dim].includes(s[dim]), `${key} ${dim}`);
    if (s.melee) assert.ok(D.combo.includes(s.combo) && D.swing.includes(s.swing), `${key} blow`);
    else assert.ok(D.volley.includes(s.volley) && D.path.includes(s.path), `${key} shot`);
  }
  const ultimates = table.moves.map(([key]) => moveVfxSignature(key)).filter(s => s.tier === "ultimate");
  const basics = table.moves.map(([key]) => moveVfxSignature(key)).filter(s => s.tier === "basic");
  const mean = (list, f) => list.reduce((sum, s) => sum + f(s), 0) / list.length;
  assert.ok(mean(ultimates, s => s.scale) > mean(basics, s => s.scale), "signature moves are larger than basic attacks");
  assert.ok(mean(ultimates, s => s.melee ? s.combo : s.volley) > mean(basics, s => s.melee ? s.combo : s.volley), "and throw more");
});

test("names pick the new thrown things, and blows keep their own archetype", () => {
  const cases = [["星彩手裏劍", "shuriken"], ["月鐮冥月", "crescent"], ["泡泡彈", "bubble"], ["夜詠咒歌", "note"], ["羽刃風暴", "feather"],
    ["櫻花吹雪", "petal"], ["雪晶吐息", "snowflake"], ["螺旋鑽擊", "drill"], ["星光彈", "star"]];
  for (const [name, archetype] of cases) assert.equal(moveVfxRecipe({ style: "holy", element: "SUN", name }).archetype, archetype, name);
  assert.equal(moveVfxRecipe({ style: "strike", element: "SUN", name: "鈴芽頭槌" }).archetype, "strike", "a headbutt stays a blow");
});

test("the pixel finish: flat tones, full alpha, a dark outline, nearest sampling", () => {
  const noise = createNoiseField(64, 3);
  for (const name of MOVE_VFX_SHEETS) {
    const one = bakeMoveVfxIntensity(name, noise, { scale: 0.5 });
    assert.ok(one.frames.some(frame => frame.some(v => v > 128)), `${name} has a bright area`);
  }
  const palette = BATTLE_FX_PALETTES.fire;
  const painted = paintMoveVfxSheet({ name: "t", frames: [Uint8Array.of(0, 255, 0, 120)], width: 4, height: 1, loop: false, smoke: false, soft: false }, palette, { doc, pixel: true });
  const px = painted.frames[0].image.data;
  assert.equal(px[7], 255, "the core texel is opaque");
  assert.equal(px[3], 255, "its empty neighbour is the outline");
  assert.ok(px[0] < ((palette.edge >> 16) & 255), "the outline is darker than the edge tone");
  const alphas = new Set();
  for (let i = 3; i < px.length; i += 4) alphas.add(px[i]);
  assert.deepEqual([...alphas].sort(), [255], "bodies have no soft alpha");

  const PIXI = fakePixi(), front = new PIXI.Container(), ground = new PIXI.Container();
  const kit = createMoveVfxKit({ PIXI, front, ground, doc, quality: "saver" });
  const signature = moveVfxSignature(table.moves.find(row => row[1] === 2 && !table.melee.includes(row[2]) && row[4] >= 3)[0]);
  const shot = { x: 0, y: 0, alive: true };
  kit.charge({ x: 0, y: 0, paletteKey: "fire", signature });
  kit.projectile({ follow: () => shot.alive ? shot : null, paletteKey: "fire", archetype: signature.archetype, signature });
  for (let i = 0; i < 20; i++) { shot.x += 8; kit.update(16); }
  const d = kit.getDiagnostics();
  assert.equal(d.escorts, signature.volley - 1, "a volley flies as many heads as it says");
  assert.ok(d.sigils >= 1, "a signature move shows its sigil");
  const sprites = front.children.flatMap(layer => layer.children);
  assert.ok(sprites.length && sprites.every(sprite => sprite.texture.source.scaleMode === "nearest"), "every texture samples nearest");
  shot.alive = false;
  kit.signature({ x: 0, y: 0, paletteKey: "fire", archetype: signature.archetype, signature });
  for (let i = 0; i < 400; i++) kit.update(16);
  assert.equal(kit.getDiagnostics().live, 0, "every part ends");
  kit.dispose();
});

test("AI battle: reference-atlas cells retire and the kit draws over the same live actor", async () => {
  const { createBattleEffectSprites, battleEffectCellIsOriginal } = await import("../src/championship/presentation/battleEffectSprites.js");
  const PIXI = fakePixi(), parent = new PIXI.Container();
  const cell = original => ({ texture: {}, origin: [4, 4], frame: [0, 0, 8, 8], pixelsPerNativePixel: 1, blank: false, ...(original ? { artSource: "ORIGINAL_SHARED_REVIEW" } : {}) });
  const art = { assetId: "t", getCell: (bankId) => cell(bankId === 81) };
  const actor = (id, bankId) => ({ id, bankId, cell: 0, point: [0, 0, 0], scaleX: 4096, scaleY: 4096, flip: 0, sin: 0, cos: 4096, alpha: 31, tint: 0x7fff });
  const rect = { x: 0, y: 0 };
  const retiring = createBattleEffectSprites({ PIXI, parent, art, retireRom: true });
  retiring.update([actor(1, 81), actor(2, 39)], rect, 4);
  assert.equal(retiring.getDiagnostics().active, 1, "only the original cell is drawn");
  assert.deepEqual(retiring.getDiagnostics().retiredCells, ["39:0"]);
  const keeping = createBattleEffectSprites({ PIXI, parent: new PIXI.Container(), art });
  keeping.update([actor(1, 81), actor(2, 39)], rect, 4);
  assert.equal(keeping.getDiagnostics().active, 2, "without retireRom nothing changes");
  assert.equal(battleEffectCellIsOriginal({ artSource: "ORIGINAL_SHARED_TEXT" }), true);

  const scene = fs.readFileSync("src/championship/presentation/vs5/createBattleFieldPixiPresentation.js", "utf8");
  assert.match(scene, /retireRom:Boolean\(fxLayer\)/, "cells retire only where the kit is there to draw them");
  const layer = fs.readFileSync("src/championship/presentation/battleFx/battleFxLayer.js", "utf8");
  assert.match(layer, /if \(!entry\.standIn && romCell\(actor\)\)/, "a retired cell gets a stand-in on its own actor");
  assert.match(layer, /if \(!form\) continue;/, "every form gets a stand-in, smoke and pop-ups included");
  assert.match(layer, /kit\.puff\(/); assert.match(layer, /kit\.glint\(/);
  assert.match(layer, /kit\.projectile\(\{follow, paletteKey, archetype, size, signature, headless: true\}\)/, "an original shot gets the move's trail");
  assert.match(layer, /kit\.sigil\(\{/, "a skill opens its sigil");
  assert.match(layer, /kit\.burst\(\{/, "a hit closes on the move's burst");
});

test("a thrown object stays that object: the mushroom move plants a mushroom that bursts into spores", () => {
  // The original effect family names the thing; it wins over the name rules, never for a blow.
  const cases = [["kinoko00", "mushroom"], ["cherrybomb00", "bomb"], ["smileybomb00", "bomb"], ["banana00", "banana"], ["fish00", "fish"],
    ["cogwheel00", "gear"], ["bone00", "bone"], ["hart00", "heart"], ["tyusyaki00", "syringe"], ["delumonegg00", "egg"], ["blacksmoke03", "mist"]];
  for (const [family, archetype] of cases) assert.equal(moveVfxRecipe({ style: "holy", element: "SUN", name: "星光", families: [family] }).archetype, archetype, family);
  assert.equal(moveVfxRecipe({ style: "strike", element: "SUN", name: "", families: ["kinoko00"] }).archetype, "strike");
  const spore = moveVfxSignature(126);
  assert.equal(spore.archetype, "mushroom", "孢子彈 throws a mushroom");
  for (const id of [74, 105, 124, 140, 276, 341, 408]) assert.equal(moveVfxSignature(id).archetype, "mist", `fog move ${id}`);
  for (const id of [346, 382, 385, 404]) assert.equal(moveVfxSignature(id).archetype, "bomb", `bomb move ${id}`);

  const PIXI = fakePixi(), front = new PIXI.Container(), ground = new PIXI.Container();
  const kit = createMoveVfxKit({ PIXI, front, ground, doc, quality: "saver" });
  const spot = { x: 0, y: 0, alive: true };
  kit.projectile({ follow: () => spot.alive ? spot : null, paletteKey: "nature", archetype: "mushroom", signature: spore, planted: true });
  for (let i = 0; i < 10; i++) kit.update(16);
  assert.equal(kit.getDiagnostics().escorts, 0, "a planted mushroom stands alone");
  spot.alive = false;
  kit.impact({ x: 0, y: 0, paletteKey: "nature", archetype: "mushroom", signature: spore });
  const before = kit.getDiagnostics().parts;
  for (let i = 0; i < 50; i++) kit.update(16);
  assert.ok(kit.getDiagnostics().parts > before + 5, "an unplanted mushroom pops up, then bursts into a cloud");
  for (const archetype of ["bomb", "banana", "fish", "gear", "bone", "heart", "syringe", "egg", "mist"]) kit.impact({ x: 0, y: 0, paletteKey: "fire", archetype });
  for (let i = 0; i < 500; i++) kit.update(16);
  assert.equal(kit.getDiagnostics().live, 0);
  kit.dispose();

  const layer = fs.readFileSync("src/championship/presentation/battleFx/battleFxLayer.js", "utf8");
  assert.match(layer, /entry\.stage = entry\.cells\.find\(c => c\.bankId === actor\.bankId && c\.sequence === actor\.sequenceId\)/, "the AI battle draws each stage of the original effect");
  assert.match(layer, /planted: stage === 'body' && moveVfxArchetypeIsPlanted\(archetype\)/);
});

test("remade cells: every brief names real sequences and drawings, and a reference cell comes back remade", async () => {
  const profiles = (await import("../src/data/championship/battleEffectProfiles.json", { with: { type: "json" } })).default;
  const { REMADE_EFFECT_BRIEFS, BRIEF_PALETTES } = await import("../src/championship/presentation/vfx/remadeEffectBriefs.js");
  const { DRAWN_VFX_SPRITES } = await import("../src/championship/presentation/vfx/drawnVfxSprites.js");
  const { createRemadeEffectArt, remadeCellLook, REMADE_CELL_SOURCE, REMADE_CELL_SCALE } = await import("../src/championship/presentation/vfx/remadeEffectCells.js");
  const families = new Map(profiles.banks.map((b, i) => [b.name.replace(/^e003_/, ""), i + 1]));
  for (const [family, brief] of Object.entries(REMADE_EFFECT_BRIEFS)) {
    const bankId = families.get(family);
    assert.ok(bankId, `${family} is an effect family`);
    assert.ok(brief.sequences.length <= profiles.banks[bankId - 1].sequences.length, `${family} has no extra sequences`);
    for (const [sequence, s] of profiles.banks[bankId - 1].sequences.entries()) for (const { cell } of s.frames) {
      const look = remadeCellLook(bankId, cell, { frame: [0, 0, 16, 16], origin: [8, 8], blank: false });
      assert.ok(look, `${family} ${sequence}:${cell}`);
      for (const layer of look.layers) if (layer.drawn) assert.ok(DRAWN_VFX_SPRITES[layer.drawn], `${family} draws ${layer.drawn}`);
    }
  }
  for (const [name, s] of Object.entries(DRAWN_VFX_SPRITES)) assert.ok(s.rows.length === s.h && s.rows.every(r => r.length === s.w), `${name} grid`);
  assert.ok(BRIEF_PALETTES.VIOLET && BRIEF_PALETTES.BLAST);
  const mushroom = remadeCellLook(families.get("kinoko00"), 3, { frame: [0, 0, 16, 16], origin: [7, 15], blank: false });
  assert.equal(mushroom.layers[0].drawn, "mushroom_tall", "孢子彈's springing frame is the drawn tall mushroom");

  const PIXI = fakePixi();
  const reference = { frame: [0, 0, 16, 16], origin: [7, 8], pixelsPerNativePixel: 1, blank: false, texture: {} };
  const base = { assetId: "t", getCell: (bankId, cell) => bankId === 20 ? { ...reference, cell } : { ...reference, artSource: "ORIGINAL_SHARED_REVIEW" }, dispose: () => "base" };
  const art = createRemadeEffectArt({ PIXI, base, doc });
  const remade = art.getCell(20, 6);
  assert.equal(remade.artSource, REMADE_CELL_SOURCE);
  assert.equal(remade.pixelsPerNativePixel, REMADE_CELL_SCALE);
  // A drawing larger than the cell widens it evenly; the native origin moves with the padding.
  const pad = (remade.frame[2] - 16 * REMADE_CELL_SCALE) / 2;
  assert.equal(remade.frame[3] - 16 * REMADE_CELL_SCALE, pad * 2, "padded evenly");
  assert.deepEqual(remade.origin, [7 * REMADE_CELL_SCALE + pad, 8 * REMADE_CELL_SCALE + pad], "the native origin is kept, so the pool places it where the old cell stood");
  assert.equal(art.getCell(1, 0).artSource, "ORIGINAL_SHARED_REVIEW", "an original cell passes through");
  assert.equal(art.getCell(20, 6), remade, "cached");
  art.releaseRemade();
});

test("the Dex preview plays the remade cells for a sequence only the reference atlas has", () => {
  const source = fs.readFileSync("src/championship/presentation/juicy/showcaseBankCells.js", "utf8");
  assert.match(source, /const source = covers\(shared\) \? shared : remake \? REMADE : base;/, "the Owner's remade atlas first, then the remade cells");
  assert.match(source, /paintRemadedCell\(bankId, ref\.cell, ref, \{doc\}\)/, "the same painter as the battle");
  assert.match(source, /holder\.dataset\.art = source === REMADE \? 'remade'/);
});

test("hit feel: short screen-sized filters on the camera, off on saver and reduced motion", async () => {
  const { createBattleHitFeel } = await import("../src/championship/presentation/battleFx/battleHitFeel.js");
  class Rectangle { constructor(x, y, w, h) { Object.assign(this, { x, y, width: w, height: h }); } }
  const made = [];
  const Filter = { from: ({ gl, resources }) => { const f = { gl, resources: { hitFeel: { uniforms: Object.fromEntries(Object.entries(resources.hitFeel).map(([k, v]) => [k, v.value])) } }, destroy() { this.destroyed = true; } }; made.push(f); return f; } };
  const target = { filters: null, filterArea: null };
  const feel = createBattleHitFeel({ PIXI: { Filter, Rectangle }, target, screen: () => ({ width: 390, height: 844 }) });
  assert.equal(made.length, 3);
  assert.ok(made.every(f => f.gl.preferredFragmentPrecision === "highp"), "both shader stages share a precision");
  feel.shock(100, 200); feel.split(); feel.rush(50, 60);
  feel.update(16);
  assert.equal(target.filters.length, 3);
  assert.deepEqual([target.filterArea.width, target.filterArea.height], [390, 844], "the filter area is the screen, never the map");
  for (let i = 0; i < 30; i++) feel.update(16);
  assert.equal(target.filters, null, "every filter comes off when its run ends");
  assert.equal(feel.getDiagnostics().shocks, 1);
  feel.dispose();
  assert.equal(createBattleHitFeel({ PIXI: { Filter, Rectangle }, target, screen: () => ({}), quality: "saver" }), null);
  assert.equal(createBattleHitFeel({ PIXI: { Filter, Rectangle }, target, screen: () => ({}), reducedMotion: true }), null);
  const layer = fs.readFileSync("src/championship/presentation/battleFx/battleFxLayer.js", "utf8");
  assert.match(layer, /hitFeel\?\.shock\(/); assert.match(layer, /if \(critical\) hitFeel\?\.split\(\);/); assert.match(layer, /hitFeel\?\.rush\(/);
});

test("the kit's sigil, burst and headless trail", () => {
  const PIXI = fakePixi(), front = new PIXI.Container(), ground = new PIXI.Container();
  const kit = createMoveVfxKit({ PIXI, front, ground, doc, quality: "saver" });
  const signature = moveVfxSignature(table.moves.find(row => row[1] === 2)[0]);
  kit.sigil({ x: 0, y: 0, paletteKey: signature.paletteKey, signature });
  kit.burst({ x: 0, y: 0, paletteKey: signature.paletteKey, signature, heavy: true });
  kit.puff({ x: 0, y: 0, paletteKey: "dark" });
  kit.glint({ x: 0, y: 0, paletteKey: "light" });
  const shot = { x: 0, y: 0, alive: true };
  kit.projectile({ follow: () => shot.alive ? shot : null, paletteKey: "fire", archetype: "fire", signature: { ...signature, trail: "sparkle" }, headless: true });
  const before = kit.getDiagnostics();
  for (let i = 0; i < 10; i++) { shot.x += 10; kit.update(16); }
  assert.equal(before.escorts, 0, "a headless trail flies no heads");
  assert.ok(kit.getDiagnostics().sigils >= 2, "the sigil and the signature's ground sigil");
  shot.alive = false;
  for (let i = 0; i < 400; i++) kit.update(16);
  assert.equal(kit.getDiagnostics().live, 0);
  // A canvas that cannot paint pixels gets no kit at all.
  assert.equal(createMoveVfxKit({ PIXI, front, ground, doc: { createElement: () => ({ getContext: () => ({}) }) } }), null);
  kit.dispose();
});

test("Data Arena hands every phase its move's signature", () => {
  const fx = fs.readFileSync("src/championship/presentation/dataArena/dataArenaElementFx.js", "utf8");
  for (const call of ["charge", "launch", "melee", "projectile", "impact", "signature"])
    assert.match(fx, new RegExp(`kit\\.${call}\\(\\{[^}]*signature: v\\.signature`), call);
});

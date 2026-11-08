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

test("Data Arena hands every phase its move's signature", () => {
  const fx = fs.readFileSync("src/championship/presentation/dataArena/dataArenaElementFx.js", "utf8");
  for (const call of ["charge", "launch", "melee", "projectile", "impact", "signature"])
    assert.match(fx, new RegExp(`kit\\.${call}\\(\\{[^}]*signature: v\\.signature`), call);
});

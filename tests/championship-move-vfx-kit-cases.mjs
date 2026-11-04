// MOVE_VFX_KIT_20261105: one baked style for every move, shots turned to their
// heading, and no long lines from arcs that never moved to their start.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import table from "../src/data/championship/move-vfx-themes.r1.json" with { type: "json" };
import { MOVE_VFX_ARCHETYPES, createMoveVfxKit, moveVfxArchetype, moveVfxArchetypeIsMelee } from "../src/championship/presentation/vfx/moveVfxKit.js";
import { MOVE_VFX_SHEETS, bakeMoveVfxIntensity, createNoiseField, paintMoveVfxSheet } from "../src/championship/presentation/vfx/moveVfxKitTextures.js";
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
  return { Container, Sprite, Texture: { from: canvas => ({ canvas, destroyed: false, destroy() { this.destroyed = true; } }) } };
}
const doc = { createElement: () => { const canvas = { width: 0, height: 0, getContext: () => ({ createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), putImageData(image) { canvas.image = image; } }) }; return canvas; } };

test("every approved VFX style plays one of the kit's archetypes", () => {
  for (const style of table.styles) assert.ok(MOVE_VFX_ARCHETYPES.includes(moveVfxArchetype(style)), style);
  assert.equal(moveVfxArchetype("fireball"), "fire");
  assert.equal(moveVfxArchetype("unknown"), "strike");
  assert.ok(["strike", "claw", "slash", "pierce"].every(moveVfxArchetypeIsMelee));
  assert.equal(moveVfxArchetypeIsMelee("water"), false);
});

test("sheets bake the same pixels every time, are never empty, and colour through the palette", () => {
  const a = createNoiseField(64, 7), b = createNoiseField(64, 7);
  for (const name of MOVE_VFX_SHEETS) {
    const one = bakeMoveVfxIntensity(name, a), two = bakeMoveVfxIntensity(name, b);
    assert.deepEqual(one.frames, two.frames, `${name} is deterministic`);
    assert.ok(one.frames.some(frame => frame.some(v => v > 128)), `${name} has a bright area`);
    const painted = paintMoveVfxSheet(one, BATTLE_FX_PALETTES.fire, { doc });
    assert.equal(painted.frames.length, one.frames.length);
  }
  // The hottest intensity is the palette's core colour.
  const glow = paintMoveVfxSheet({ name: "t", frames: [Uint8Array.of(255, 0)], width: 2, height: 1, loop: false, smoke: false, soft: false }, BATTLE_FX_PALETTES.water, { doc });
  const px = glow.frames[0].image.data;
  assert.deepEqual([...px.slice(0, 3)], [0xe8, 0xfb, 0xff]);
  assert.equal(px[7], 0, "zero intensity is transparent");
});

test("a shot turns to its heading, mirrors instead of flying upside down, and ends with its owner", () => {
  const PIXI = fakePixi(), front = new PIXI.Container(), ground = new PIXI.Container();
  const kit = createMoveVfxKit({ PIXI, front, ground, doc, quality: "saver", resolution: 0.5 });
  const shot = { x: 0, y: 0, alive: true };
  kit.projectile({ follow: () => shot.alive ? shot : null, paletteKey: "fire", archetype: "fire", size: 20 });
  const light = front.children.find(c => c.label === "move-vfx-light");
  const head = () => light.children[1];
  shot.x = -10; shot.y = -10; kit.update(16);
  assert.ok(Math.abs(head().rotation - Math.atan2(-10, -10)) < 1e-9, "up-left shot points up-left");
  assert.ok(head().scale.y < 0, "a leftward shot is mirrored top to bottom");
  shot.x = 10; shot.y = -20; kit.update(16);
  assert.ok(head().scale.y > 0);
  shot.alive = false; kit.update(16);
  assert.equal(kit.getDiagnostics().flying, 0);
  kit.impact({ x: 0, y: 0, paletteKey: "fire", archetype: "fire", heavy: true });
  kit.wash({ rect: { x: 0, y: 0, width: 400, height: 800 }, paletteKey: "light" });
  for (let i = 0; i < 400; i++) kit.update(16);
  assert.equal(kit.getDiagnostics().live, 0, "every part ends");
  kit.dispose();
  assert.ok(light.destroyed);
});

test("Data Arena draws its arcs from their own start point and lets the kit own its shots", () => {
  const scene = fs.readFileSync("src/championship/presentation/dataArena/dataArenaPixiScene.js", "utf8");
  assert.doesNotMatch(scene, /\b(?:g|zoneGfx)\.arc\(/, "a bare Graphics.arc joins the previous point or the world origin");
  assert.match(scene, /const arcPath = \(gfx, x, y, r, a0, a1\) => gfx\.moveTo\(/);
  assert.doesNotMatch(scene, /tethers/, "no caster-to-shot line");
  assert.match(scene, /entry\.sprite\.visible = visible && !entry\.kitDrawn/);
  const fx = fs.readFileSync("src/championship/presentation/dataArena/dataArenaElementFx.js", "utf8");
  assert.match(fx, /if \(kit\) kit\.wash\(/, "the kit replaces the line-art storm");
});

test("recipes give vines, roots, trees, missiles and the rest to the moves that name them", async () => {
  const { moveVfxRecipe, DATA_ARENA_POOL_ARCHETYPE } = await import("../src/championship/presentation/vfx/moveVfxRecipes.js");
  const { RELAY_POOL_MOVE_ELEMENT } = await import("../src/championship/modes/dataArena/dataArenaRelayKits.js");
  assert.equal(moveVfxRecipe({ style: "vine", element: "WOOD", name: "苔藤鞭" }).archetype, "vine");
  assert.equal(moveVfxRecipe({ style: "strike", element: "WOOD", name: "樹根撞" }).archetype, "roots");
  assert.equal(moveVfxRecipe({ style: "strike", element: "WOOD", name: "樹王撞" }).archetype, "tree");
  assert.equal(moveVfxRecipe({ style: "missile", element: "METAL", name: "赤鋼轟爆" }).source, "STYLE", "a plain missile style stays a missile");
  assert.equal(moveVfxRecipe({ style: "missile", element: "METAL", name: "赤鋼轟爆" }).archetype, "missile");
  assert.equal(moveVfxRecipe({ style: "water", element: "WATER", name: "潮鬃水砲" }).archetype, "water", "水砲 is water, not a cannon");
  assert.equal(moveVfxRecipe({ style: "shell", element: "METAL", name: "鋼城砲擊" }).archetype, "cannon");
  assert.equal(moveVfxRecipe({ style: "fireball", element: "FIRE", name: "x", families: ["magmaball01"] }).archetype, "meteor");
  assert.equal(moveVfxRecipe({ style: "dark", element: "MOON", name: "幽豆咬" }).archetype, "orb", "a ranged move never bites");
  assert.equal(moveVfxRecipe({ style: "strike", element: "MOON", name: "幽豆咬" }).archetype, "bite");
  for (const [id, archetype] of Object.entries(DATA_ARENA_POOL_ARCHETYPE)) {
    assert.ok(id in RELAY_POOL_MOVE_ELEMENT, id);
    assert.ok(MOVE_VFX_ARCHETYPES.includes(archetype), `${id} -> ${archetype}`);
  }
  for (const id of Object.keys(RELAY_POOL_MOVE_ELEMENT)) if (!/Guard|Shield$/.test(id)) assert.ok(id in DATA_ARENA_POOL_ARCHETYPE, `pool move ${id} has an effect`);
});

test("every archetype draws a shot and a hit without errors and ends", () => {
  const PIXI = fakePixi(), front = new PIXI.Container();
  const kit = createMoveVfxKit({ PIXI, front, doc, quality: "saver", resolution: 0.5 });
  for (const archetype of MOVE_VFX_ARCHETYPES) {
    const shot = { x: 0, y: 0, alive: true };
    kit.projectile({ follow: () => shot.alive ? shot : null, paletteKey: "nature", archetype, size: 20 });
    for (let i = 0; i < 5; i++) { shot.x += 8; shot.y -= 3; kit.update(16); }
    shot.alive = false;
    kit.impact({ x: 10, y: 10, paletteKey: "nature", archetype, heavy: true });
    kit.melee({ x: 0, y: 0, angle: 1, paletteKey: "nature", archetype });
  }
  for (let i = 0; i < 500; i++) kit.update(16);
  const d = kit.getDiagnostics();
  assert.equal(d.live, 0); assert.equal(d.flying, 0);
  kit.dispose();
});

test("the AI battle keeps its cells and draws its dressing in stepped pixel bands, with no beam line", async () => {
  const { pixelateCanvas } = await import("../src/championship/presentation/vfx/pixelateCanvas.js");
  const data = new Uint8ClampedArray([255, 255, 255, 250, 255, 255, 255, 120, 255, 255, 255, 10, 255, 0, 0, 255]);
  const canvas = { width: 4, height: 1, getContext: () => ({ getImageData: () => ({ data }), putImageData() {} }) };
  pixelateCanvas(canvas, { block: 1, levels: 4 });
  assert.deepEqual([data[3], data[7], data[11]], [255, 128, 0], "alpha steps to quarters and faint pixels drop out");
  const layer = fs.readFileSync("src/championship/presentation/battleFx/battleFxLayer.js", "utf8");
  assert.match(layer, /createElementVfxLayer\(\{[^}]*pixel: true\}\)/);
  assert.doesNotMatch(layer, /travelling wave/, "no drawn line joins a beam to its caster");
  const element = fs.readFileSync("src/championship/presentation/vfx/elementVfxLayer.js", "utf8");
  assert.match(element, /STORMS\[pixel \? 'wash' : kind\]/, "pixel storms are a banded wash, never line art");
});

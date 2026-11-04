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

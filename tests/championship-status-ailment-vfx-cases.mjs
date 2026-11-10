// STATUS_AILMENT_VFX_20261110: every negative status the battle can set has a look.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { spawnSync } from "node:child_process";
import moves from "../src/data/championship/catalogs/battle-moves.r1.json" with { type: "json" };
import { mapActionStatusToRuntimeCode, BATTLE_STATUS_DURATION_BY_RUNTIME_CODE } from "../src/championship/battle/battleStatus.js";
import { STATUS_AILMENT_KEYS, STATUS_AILMENT_SPRITES, STATUS_AILMENT_STAND_IN } from "../src/championship/presentation/vfx/statusAilmentSprites.js";
import {
  STATUS_AILMENT_BY_RUNTIME_CODE, STATUS_AILMENT_LOOKS, createBattleStatusAilmentFx, decodeStatusAilmentFrame,
  STATUS_AILMENT_TEXEL_NATIVE, multiplyTint, scale2xRgba, statusAilmentLook, statusAilmentPlacement
} from "../src/championship/presentation/battleFx/battleStatusAilmentFx.js";

const GENERATED = "src/championship/presentation/vfx/statusAilmentSprites.js";

function fakePixi() {
  const point = () => ({ x: 0, y: 0, set(x, y = x) { this.x = x; this.y = y; }, copyFrom(p) { this.x = p.x; this.y = p.y; } });
  class Container {
    constructor() { Object.assign(this, { children: [], parent: null, visible: true, alpha: 1, rotation: 0, zIndex: 0, position: point(), scale: point(), anchor: point(), destroyed: false }); }
    addChild(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } return nodes[0]; }
    removeChild(node) { this.children = this.children.filter(child => child !== node); node.parent = null; }
    destroy() { this.destroyed = true; this.parent?.removeChild(this); }
  }
  class Sprite extends Container { constructor(texture) { super(); this.texture = texture; } }
  class Rectangle { constructor(x, y, width, height) { Object.assign(this, { x, y, width, height }); } }
  const made = [];
  class Texture {
    constructor({ source, frame }) { Object.assign(this, { source, frame, destroyed: false }); made.push(this); }
    destroy() { this.destroyed = true; }
    static from(canvas) { const t = new Texture({ source: { canvas, scaleMode: "linear" }, frame: new Rectangle(0, 0, canvas.width, canvas.height) }); return t; }
  }
  return { Container, Sprite, Rectangle, Texture, made };
}
const doc = { createElement: () => { const canvas = { width: 0, height: 0, puts: 0, getContext: () => ({ createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }), putImageData() { canvas.puts++; } }) }; return canvas; } };

test("the generated module lists every baked look and carries the MIT notice", () => {
  const run = spawnSync(process.execPath, ["scripts/vfx/bake-status-ailment-vfx.mjs", "--check"], { encoding: "utf8" });
  assert.equal(run.status, 0, run.stderr || run.stdout);
  const text = fs.readFileSync(GENERATED, "utf8");
  assert.match(text, /^\/\*! Status-ailment loops/);
  assert.match(text, /MIT License/);
  assert.match(text, /Copyright \(c\) 2026 Patch/);
  assert.match(text, /Copyright \(c\) 2026 Hugo Duprez/);
  assert.equal(text.includes("\r"), false, "LF only: the publication hashes are over LF bytes");
});

test("every runtime status code 1..14 wears a look; 0 wears none", () => {
  assert.equal(BATTLE_STATUS_DURATION_BY_RUNTIME_CODE.length, 15);
  assert.equal(statusAilmentLook(0), null);
  assert.equal(statusAilmentLook(15), null);
  for (let code = 1; code <= 14; code++) {
    const look = statusAilmentLook(code);
    assert.ok(look && STATUS_AILMENT_LOOKS[look], `code ${code}`);
    assert.ok(STATUS_AILMENT_BY_RUNTIME_CODE[code].basis.length > 10, `code ${code} records its basis`);
    if (STATUS_AILMENT_LOOKS[look].align) assert.ok(STATUS_AILMENT_SPRITES[look], `${look} has frames`);
  }
});

test("every status a move can apply shows, and the move-applied codes look distinct", () => {
  const applied = new Set();
  for (const move of moves.records) if (move.statusCode >= 1 && move.statusCode <= 13) applied.add(mapActionStatusToRuntimeCode(move.statusCode));
  assert.ok(applied.size >= 9);
  const looks = [...applied].map(statusAilmentLook);
  assert.equal(new Set(looks).size, looks.length, `distinct looks: ${looks.join(", ")}`);
});

test("frames decode to their box, keys stay in the palette, loops share one size", () => {
  for (const [name, look] of Object.entries(STATUS_AILMENT_SPRITES)) {
    assert.ok(look.frames.length >= 12 && look.fps === 12, name);
    assert.ok(look.palette.length <= STATUS_AILMENT_KEYS.length, name);
    assert.ok(look.ox >= 0 && look.ox <= look.w && look.oy >= 0, `${name} origin`);
    let lit = 0;
    for (let i = 0; i < look.frames.length; i++) {
      const rows = look.frames[i].split("/");
      assert.equal(rows.length, look.h, `${name} frame ${i} rows`);
      for (const row of rows) {
        let width = 0;
        for (const [, key, count] of row.matchAll(/([^0-9])(\d*)/g)) {
          if (key !== ".") assert.ok(STATUS_AILMENT_KEYS.indexOf(key) < look.palette.length, `${name} key ${key}`);
          width += count ? Number(count) : 1;
        }
        assert.equal(width, look.w, `${name} frame ${i} width`);
      }
      const data = decodeStatusAilmentFrame(look, i);
      assert.equal(data.length, look.w * look.h * 4);
      for (let j = 3; j < data.length; j += 4) if (data[j]) lit++;
    }
    assert.ok(lit > look.frames.length * 8, `${name} draws something`);
  }
});

test("placement keeps the arena's grain and fits big bodies with Scale2x frames", () => {
  const unit = 4, base = unit * STATUS_AILMENT_TEXEL_NATIVE;
  // a small body: the stand-in at the plain grain
  const small = statusAilmentPlacement("sleep", { x: 100, y: 200, top: 160, width: 50, height: 40, unit });
  assert.equal(small.detail, 1);
  assert.ok(small.scale >= base * 0.8 && small.scale <= base * 1.25);
  // a big body: doubled frames, the same grain, a stand-in up to 2.5x the base
  const big = statusAilmentPlacement("poisoned", { x: 100, y: 200, top: 40, width: 200, height: 160, unit });
  assert.equal(big.detail, 2);
  assert.ok(big.scale <= base * 1.25 + 1e-9, "a drawn texel never coarser than 1.25x the grain");
  assert.equal(big.y, 200, "feet looks stand on the ground");
  const head = statusAilmentPlacement("sleep", { x: 100, y: 200, top: 40, width: 200, height: 160, unit });
  assert.equal(head.y, 40 + STATUS_AILMENT_STAND_IN.h * head.scale * head.detail, "head looks sit on the body's top");
  assert.ok(statusAilmentPlacement("sleep", { x: 0, y: 0, top: 0, width: 1, height: 1 }).scale > 0);
  assert.equal(multiplyTint(0xffffff, 0x80c040), 0x80c040);
  assert.equal(multiplyTint(0x000000, 0x80c040), 0);
});

test("Scale2x doubles a frame and rounds a clean diagonal", () => {
  const w = 2, h = 2, px = new Uint8ClampedArray(w * h * 4);
  px.set([255, 0, 0, 255], 0); px.set([255, 0, 0, 255], 12); // a red diagonal
  const out = scale2xRgba(px, w, h), at = (x, y) => out.slice((y * 4 + x) * 4, (y * 4 + x) * 4 + 4).join(",");
  assert.equal(out.length, w * h * 16);
  assert.equal(at(0, 0), "255,0,0,255");
  assert.equal(at(3, 3), "255,0,0,255");
  assert.equal(at(1, 2), "255,0,0,255", "the inner corner fills along the diagonal");
});

test("the layer shows, swaps, loops and retires overlays without leaking", () => {
  const PIXI = fakePixi(), layer = new PIXI.Container();
  const fx = createBattleStatusAilmentFx({ PIXI, layer, doc });
  const box = { x: 50, y: 120, top: 60, width: 60, height: 60, zIndex: 120 };
  assert.equal(fx.place(0, 7, box), "poisoned");
  assert.equal(layer.children.length, 1);
  const first = layer.children[0].texture;
  fx.update(1000 / 12 + 1);
  fx.place(0, 7, box);
  assert.notEqual(layer.children[0].texture, first, "the loop advances on the scene's delta");
  assert.ok(layer.children[0].zIndex > box.zIndex, "draws in front of its fighter");
  assert.equal(layer.children[0].source?.scaleMode ?? layer.children[0].texture.source.scaleMode, "nearest");
  const body = fx.body(0);
  assert.equal(body.tint, STATUS_AILMENT_LOOKS.poisoned.tint);
  assert.ok(body.glowAlpha > 0);
  // a new status replaces the old overlay
  assert.equal(fx.place(0, 9, box), "sleep");
  assert.equal(layer.children.length, 1);
  assert.equal(layer.children[0].label, "battle status sleep");
  // petrified: stone is the body, no overlay
  assert.equal(fx.place(1, 12, box), "petrified");
  assert.equal(layer.children.length, 1);
  assert.equal(fx.body(1).tint, STATUS_AILMENT_LOOKS.petrified.tint);
  // a blank frame hides the loop and keeps it
  fx.hide(0); assert.equal(layer.children[0].visible, false); assert.equal(fx.body(0).look, "sleep");
  // code 0 clears; retireExcept drops slots not drawn
  assert.equal(fx.place(0, 0, box), null);
  assert.equal(layer.children.length, 0);
  fx.place(2, 14, box); fx.place(3, 2, box);
  fx.retireExcept(new Set([3]));
  assert.deepEqual(fx.getDiagnostics().slots.map(s => s.slot), [3]);
  fx.dispose();
  assert.equal(layer.children.length, 0);
  assert.ok(PIXI.made.every(t => t.destroyed), "every texture is destroyed on dispose");
});

test("one canvas per look, baked once, however many fighters wear it", () => {
  const PIXI = fakePixi(), layer = new PIXI.Container(), made = [];
  const counting = { createElement: () => { const c = doc.createElement(); made.push(c); return c; } };
  const fx = createBattleStatusAilmentFx({ PIXI, layer, doc: counting });
  const box = slot => ({ x: slot * 40, y: 100, top: 50, width: 40, height: 50, unit: 4 });
  for (let slot = 0; slot < 4; slot++) fx.place(slot, 10, box(slot));
  assert.equal(made.length, 1);
  const { detail } = statusAilmentPlacement("electrified", box(0));
  assert.equal(made[0].width, STATUS_AILMENT_SPRITES.electrified.w * detail * STATUS_AILMENT_SPRITES.electrified.frames.length);
  // a big body asks for the Scale2x frames: one more canvas, once
  fx.place(4, 10, { x: 0, y: 300, top: 100, width: 220, height: 200, unit: 4 });
  fx.place(5, 10, { x: 90, y: 300, top: 100, width: 220, height: 200, unit: 4 });
  assert.equal(made.length, detail === 1 ? 2 : 1);
  fx.dispose();
});

test("reduced motion holds one frame and a steady glow; saver drops the glow", () => {
  const PIXI = fakePixi(), layer = new PIXI.Container();
  const calm = createBattleStatusAilmentFx({ PIXI, layer, doc, reducedMotion: true });
  const box = { x: 0, y: 100, top: 40, width: 60, height: 60 };
  calm.place(0, 14, box); const held = layer.children[0].texture;
  const a = calm.body(0).glowAlpha;
  for (let i = 0; i < 10; i++) { calm.update(97); calm.place(0, 14, box); }
  assert.equal(layer.children[0].texture, held);
  assert.equal(calm.body(0).glowAlpha, a);
  calm.dispose();
  const saver = createBattleStatusAilmentFx({ PIXI, layer, doc, quality: "saver" });
  saver.place(0, 14, box);
  assert.equal(saver.body(0).glow, null);
  assert.equal(saver.body(0).tint, STATUS_AILMENT_LOOKS.burning.tint);
  saver.dispose();
});

// Second part: pixel move-hit bursts in the AI battle and the Data Arena.
import { PIXEL_HIT_BURST_SPRITES } from "../src/championship/presentation/vfx/pixelHitBurstSprites.js";
import { PIXEL_HIT_BURST_CAP, createPixelHitBursts, pixelHitBurstFor, pixelHitBurstScale } from "../src/championship/presentation/vfx/pixelHitBursts.js";
import { ELEMENT_VFX } from "../src/championship/presentation/vfx/unifiedMoveVfxResolver.js";

test("every effect element has its own pixel hit burst, a one-shot with an anchor", () => {
  const elements = Object.keys(ELEMENT_VFX);
  for (const element of elements) assert.ok(PIXEL_HIT_BURST_SPRITES[element], element);
  const sources = elements.map(e => PIXEL_HIT_BURST_SPRITES[e].source);
  assert.equal(new Set(sources).size, sources.length, "no two elements share a burst");
  for (const [element, look] of Object.entries(PIXEL_HIT_BURST_SPRITES)) {
    assert.equal(look.loop, false, element);
    assert.ok(["ground", "contact"].includes(look.anchor), element);
    assert.ok(look.frames.length >= 5 && look.frames.length <= 24, `${element} keeps only its burst`);
    const last = decodeStatusAilmentFrame(look, look.frames.length - 1);
    assert.ok(last.some((v, j) => j % 4 === 3 && v), `${element} ends on a drawn frame`);
  }
  assert.equal(pixelHitBurstFor("NOT_AN_ELEMENT"), "NEUTRAL");
});

test("burst size follows the body within the grain bounds", () => {
  assert.ok(pixelHitBurstScale({ size: 200, unit: 4 }) > pixelHitBurstScale({ size: 80, unit: 4 }));
  assert.equal(pixelHitBurstScale({ size: 1, unit: 4 }), 0.8);
  assert.equal(pixelHitBurstScale({ size: 9999, unit: 4 }), 2);
  assert.ok(pixelHitBurstScale({ size: 200, unit: 4, heavy: true }) > pixelHitBurstScale({ size: 200, unit: 4 }));
});

test("bursts play once on the owner's delta, stand on their anchor, cap and recycle", () => {
  const PIXI = fakePixi(), layer = new PIXI.Container();
  const hits = createPixelHitBursts({ PIXI, layer, doc, quality: "saver" });
  assert.equal(hits.spawn({ element: "WATER", x: 10, y: 50, groundY: 90, size: 80, unit: 4 }), "WATER");
  assert.equal(layer.children[0].position.y, 90, "a ground burst stands on the feet line");
  hits.spawn({ element: "THUNDER", x: 10, y: 50, groundY: 90, size: 80, unit: 4, flip: true });
  assert.equal(layer.children[1].position.y, 50, "a contact burst sits on the hit point");
  assert.ok(layer.children[1].scale.x < 0, "flipped along the blow");
  for (let i = 0; i < 6; i++) hits.spawn({ element: "FIRE", x: 0, y: 0, size: 80, unit: 4 });
  let d = hits.getDiagnostics();
  assert.equal(d.live, PIXEL_HIT_BURST_CAP.saver);
  assert.ok(d.dropped >= 4);
  hits.update(0);
  assert.equal(hits.getDiagnostics().live, PIXEL_HIT_BURST_CAP.saver, "a zero delta (hit-stop) holds them");
  hits.update(5000);
  d = hits.getDiagnostics();
  assert.equal(d.live, 0);
  assert.ok(layer.children.every(s => s.visible === false), "finished bursts go back to the pool hidden");
  const pooled = layer.children.length;
  hits.spawn({ element: "MOON", x: 0, y: 0, size: 80, unit: 4 });
  assert.equal(layer.children.length, pooled, "a new burst reuses a pooled sprite");
  hits.dispose();
  assert.equal(layer.children.length, 0);
  assert.ok(PIXI.made.every(t => t.destroyed));
});

test("reduced motion shows a burst's strong frame briefly instead of the bloom", () => {
  const PIXI = fakePixi(), layer = new PIXI.Container();
  const hits = createPixelHitBursts({ PIXI, layer, doc, reducedMotion: true });
  hits.spawn({ element: "FIRE", x: 0, y: 0, size: 80, unit: 4 });
  hits.update(100);
  assert.equal(hits.getDiagnostics().live, 1);
  hits.update(100);
  assert.equal(hits.getDiagnostics().live, 0);
  hits.dispose();
});

test("a canvas that cannot paint pixels draws nothing instead of failing the hit", () => {
  const PIXI = fakePixi(), layer = new PIXI.Container();
  const blind = { createElement: () => ({ width: 0, height: 0, getContext: () => ({}) }) };
  const hits = createPixelHitBursts({ PIXI, layer, doc: blind });
  assert.equal(hits.spawn({ element: "FIRE", x: 0, y: 0, size: 80, unit: 4 }), null);
  hits.update(16); hits.dispose();
  const status = createBattleStatusAilmentFx({ PIXI, layer, doc: blind });
  assert.equal(status.place(0, 7, { x: 0, y: 0, top: 0, width: 40, height: 40, unit: 4 }), "poisoned");
  assert.equal(layer.children.length, 0);
  assert.equal(status.body(0).look, "poisoned", "the body still takes its tint");
  status.dispose();
});

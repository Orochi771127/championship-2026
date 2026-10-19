// Single-pass masked ambient layers: shader on WebGL, the original sprite-mask
// path everywhere else, same tiling/offset semantics as a TilingSprite.
import test from "node:test";
import assert from "node:assert/strict";
import { maskedTiling } from "../src/championship/presentation/battleFieldAmbient.js";

function fakePixi() {
  class Node { constructor(o = {}) { Object.assign(this, o); this.position = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } }; this.children = []; }
    addChild(...c) { this.children.push(...c); } }
  class TilingSprite extends Node { constructor(o) { super(o); this.tilePosition = { x: 0, y: 0, set(x, y) { this.x = x; this.y = y; } };
    this.tileScale = { set: (x, y) => { this.tileScaleXY = [x, y]; } }; } }
  class UniformGroup { constructor(u) { this.uniforms = Object.fromEntries(Object.entries(u).map(([k, v]) => [k, v.value])); this.updates = 0; } update() { this.updates++; } }
  return { RendererType: { WEBGL: 1, WEBGPU: 2 }, Container: Node, Sprite: Node, TilingSprite, Mesh: Node, Geometry: Node,
    GlProgram: Node, Shader: Node, UniformGroup };
}
const tex = (w, h) => ({ width: w, height: h, source: {} });
const rect = { x: 10, y: 20, width: 800, height: 400 };

test("WebGL builds one shader mesh whose offset matches TilingSprite tilePosition", () => {
  const PIXI = fakePixi();
  const tile = tex(256, 128);
  const layer = maskedTiling(PIXI, { type: 1 }, { tile, mask: tex(400, 200), rect, tileScale: [2, 1], tint: 0xff8000, alpha: 0.5, label: "lava" });
  assert.equal(layer.technique, "MESH_SHADER");
  assert.equal(tile.source.addressMode, "repeat");
  assert.deepEqual([layer.displayObject.position.x, layer.displayObject.position.y], [10, 20]);
  assert.equal(layer.displayObject.blendMode, "normal");
  const u = layer.displayObject.shader.resources.ambientTiling.uniforms;
  assert.deepEqual([...u.uRepeat], [800 / 512, 400 / 128]);
  assert.deepEqual([...u.uTint].map(v => +v.toFixed(3)), [1, 0.502, 0]);
  layer.tilePosition.set(128, -64);
  assert.deepEqual([...u.uOffset], [-0.25, 0.5]);
  layer.alpha = 0.3; assert.equal(layer.displayObject.alpha, 0.3);
});

test("a non-WebGL renderer keeps the original sprite-mask TilingSprite path", () => {
  const PIXI = fakePixi();
  for (const renderer of [null, { type: 2 }]) {
    const layer = maskedTiling(PIXI, renderer, { tile: tex(64, 64), mask: tex(10, 10), rect, tileScale: 1.6, alpha: 0.4, label: "sea" });
    assert.equal(layer.technique, "SPRITE_MASK");
    const [mask, tiling] = layer.displayObject.children;
    assert.equal(layer.displayObject.mask, mask);
    assert.deepEqual(tiling.tileScaleXY, [1.6, 1.6]);
    assert.equal(tiling.blendMode, "add");
    layer.tilePosition.set(5, 6); assert.deepEqual([tiling.tilePosition.x, tiling.tilePosition.y], [5, 6]);
  }
});

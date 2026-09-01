import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

import {
  buildCharacterAnimationTraversal,
  createCharacterAnimationTimeline
} from "../src/championship/presentation/characterAnimationTimeline.js";
import { createPixiCharacterAnimationController } from "../src/championship/presentation/pixiCharacterAnimationController.js";
import { loadPixiCharacterRuntimeBundle } from "../src/championship/presentation/pixiCharacterRuntimeBundle.js";

const idle = Object.freeze({
  id: 0,
  name: "action_00",
  playback: "forward_then_backward_once",
  frames: Object.freeze([
    Object.freeze({ texture: "m201/main/cell_000", cell: 0, ticks: 31 }),
    Object.freeze({ texture: "m201/main/cell_001", cell: 1, ticks: 22 })
  ])
});

test("character timeline preserves the original per-frame NANR ticks", () => {
  const timeline = createCharacterAnimationTimeline(idle);
  assert.equal(timeline.getSnapshot().cell, 0);

  timeline.advance(30 * 1000 / 60);
  assert.equal(timeline.getSnapshot().cell, 0);

  timeline.advance(1 * 1000 / 60);
  assert.equal(timeline.getSnapshot().cell, 1);

  timeline.advance(22 * 1000 / 60);
  assert.equal(timeline.getSnapshot().cell, 0);
  assert.equal(timeline.getSnapshot().cycle, 1);
});

test("mode 2 traverses forward and backward without duplicating turn points", () => {
  const animation = {
    playback: "forward_then_backward_once",
    frames: [0, 1, 2, 3].map((cell) => ({ texture: `cell-${cell}`, cell, ticks: 1 }))
  };
  assert.deepEqual(buildCharacterAnimationTraversal(animation), [0, 1, 2, 3, 2, 1]);

  const timeline = createCharacterAnimationTimeline(animation);
  const visited = [timeline.getSnapshot().cell];
  for (let index = 0; index < 6; index += 1) {
    timeline.advance(1000 / 60);
    visited.push(timeline.getSnapshot().cell);
  }
  assert.deepEqual(visited, [0, 1, 2, 3, 2, 1, 0]);
});

test("mode 1 loops forward and supports large ticker deltas", () => {
  const timeline = createCharacterAnimationTimeline({
    playback: "forward_loop",
    frames: [
      { texture: "a", cell: 4, ticks: 2 },
      { texture: "b", cell: 5, ticks: 3 },
      { texture: "c", cell: 6, ticks: 5 }
    ]
  });

  timeline.advance(12 * 1000 / 60);
  assert.equal(timeline.getSnapshot().cell, 5);
  assert.equal(timeline.getSnapshot().elapsedTicks, 0);
  assert.equal(timeline.getSnapshot().cycle, 1);
});

test("reduced-motion holds the first source cell and reset is deterministic", () => {
  const timeline = createCharacterAnimationTimeline(idle, { reducedMotion: true });
  timeline.advance(10_000);
  assert.equal(timeline.getSnapshot().cell, 0);
  assert.equal(timeline.getSnapshot().paused, true);
  assert.deepEqual(timeline.reset(), timeline.getSnapshot());
});

test("invalid timing data is rejected instead of silently normalizing it", () => {
  assert.throws(
    () => createCharacterAnimationTimeline({ playback: "forward_loop", frames: [{ texture: "x", ticks: 0 }] }),
    /finite positive number/
  );
  assert.throws(
    () => createCharacterAnimationTimeline({ playback: "made-up", frames: [{ texture: "x", ticks: 1 }] }),
    /Unsupported character playback mode/
  );
});

test("Pixi controller consumes the owning ticker and never creates another one", () => {
  const sprite = { texture: null };
  const textures = new Map([
    ["m201/main/cell_000", { key: "cell-0" }],
    ["m201/main/cell_001", { key: "cell-1" }]
  ]);
  const controller = createPixiCharacterAnimationController({
    sprite,
    animations: [idle],
    textureResolver: (key) => textures.get(key)
  });

  assert.deepEqual(sprite.texture, { key: "cell-0" });
  controller.update({ deltaMS: 31 * 1000 / 60 });
  assert.deepEqual(sprite.texture, { key: "cell-1" });
  assert.equal(controller.getSnapshot().cell, 1);
  assert.throws(() => controller.update({ deltaTime: 1 }), /ticker with deltaMS/);
});

test("Pixi controller selects animations by stable raw ID or semantic alias", () => {
  const walk = {
    id: 2,
    name: "action_02",
    semanticAlias: "walk",
    playback: "forward_then_backward_once",
    frames: [{ texture: "walk-0", cell: 4, ticks: 15 }]
  };
  const sprite = { texture: null };
  const controller = createPixiCharacterAnimationController({
    sprite,
    animations: [idle, walk],
    textureResolver: (key) => ({ key })
  });

  assert.equal(controller.setAnimation("walk").cell, 4);
  assert.deepEqual(sprite.texture, { key: "walk-0" });
  assert.equal(controller.setAnimation(0).cell, 0);
});

test("Pixi runtime bundle loads all review atlases and releases them without owning a ticker", async () => {
  const reviewRoot = path.join(process.cwd(), "assets/production/internal-character-review/m201-remix-v1");
  const runtime = JSON.parse(fs.readFileSync(path.join(reviewRoot, "runtime.review.json"), "utf8"));
  const runtimeUrl = "http://championship.test/assets/production/internal-character-review/m201-remix-v1/runtime.review.json";
  const unloaded = [];

  class FakeSpritesheet {
    constructor({ data }) {
      this.data = data;
      this.textures = {};
      this.destroyed = false;
    }
    async parse() {
      for (const key of Object.keys(this.data.frames)) this.textures[key] = { key };
    }
    destroy() { this.destroyed = true; }
  }
  class FakeSprite {
    constructor({ texture }) {
      this.texture = texture;
      this.anchor = { set: (x, y) => { this.anchorValue = { x, y }; } };
    }
  }
  const PIXI = {
    Assets: {
      async load(url) {
        if (url === runtimeUrl) return runtime;
        if (url.endsWith(".json")) {
          return JSON.parse(fs.readFileSync(path.join(reviewRoot, path.basename(new URL(url).pathname)), "utf8"));
        }
        if (url.endsWith(".png")) return { url };
        throw new Error(`Unexpected asset URL: ${url}`);
      },
      async unload(url) { unloaded.push(url); }
    },
    Spritesheet: FakeSpritesheet,
    Sprite: FakeSprite
  };

  const bundle = await loadPixiCharacterRuntimeBundle({ PIXI, runtimeUrl });
  assert.deepEqual(bundle.getDiagnostics(), {
    entityId: "m201_agumon",
    textureCount: 83,
    sheetCount: 2,
    reviewOnly: true,
    runtimeEligible: false,
    ticker: "SCENE_OWNED_APPLICATION_TICKER_REQUIRED"
  });
  const actor = bundle.createActor({ animation: "idle" });
  assert.equal(actor.sprite.texture.key, "m201_agumon/main/cell_000");
  assert.deepEqual(actor.sprite.anchorValue, runtime.artProfile.anchor);
  actor.controller.update({ deltaMS: 31 * 1000 / 60 });
  assert.equal(actor.sprite.texture.key, "m201_agumon/main/cell_001");
  await bundle.dispose();
  assert.equal(unloaded.length, 5);
  assert.throws(() => bundle.createActor(), /DISPOSED/);
});

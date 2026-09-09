import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createNativeCharacterAnimationTimeline } from "../src/championship/presentation/characterAnimationTimeline.js";
import { resolveNativeHuntCharacterSequence, createNativeHuntCharacterFramePresenter,
  NATIVE_HUNT_CHARACTER_FRAME_CONTRACT } from "../src/championship/presentation/nativeHuntCharacterAction.js";

const read = (path) => JSON.parse(fs.readFileSync(path, "utf8"));
const cpu = read("docs/research/CHARACTER_ANIMATION_CPU_CHECK_2026-09-06.json");
const live = read("docs/research/HUNT_CHARACTER_ANIMATION_TRACE_2026-09-06.json");
const runtime = read("assets/production/internal-faithful-baseline/characters-v1/m003_nyokimon/runtime.json");
const animations = runtime.sides.main.animations;

test("all 640 OVL0 request/binding/status selectors match original CPU results", () => {
  assert.equal(cpu.selectors.length, 640);
  for (const value of cpu.selectors) assert.equal(resolveNativeHuntCharacterSequence(value), value.sequenceId);
  assert.throws(() => resolveNativeHuntCharacterSequence({ request: "walk" }), /STATE_REQUIRED/);
});

test("native raw modes match 9288 CPU updates, including stop, loop start and discarded overshoot", () => {
  let count = 0;
  for (const value of cpu.players) {
    const timeline = createNativeCharacterAnimationTimeline({ playbackMode: value.mode,
      loopStartFrame: value.loopStartFrame,
      frames: value.durations.map((ticks, cell) => ({ texture: `cell-${cell}`, cell, ticks })) });
    for (const expected of value.samples) {
      const actual = timeline.advanceNative(value.deltaQ12);
      const { tick, ...state } = expected;
      assert.deepEqual({ frameIndex: actual.frameIndex, elapsedQ12: actual.elapsedQ12, active: actual.active },
        state, `mode ${value.mode}, durations ${value.durations}, loop ${value.loopStartFrame}, delta ${value.deltaQ12}, tick ${tick}`);
      count++;
    }
  }
  assert.equal(count, 9288);
});

test("same-species original stylus capture matches every animator call and all 476 rendered frames", () => {
  let timeline = null, count = 0;
  const byId = new Map(animations.map((animation) => [animation.id, animation]));
  const compare = (expected, message) => {
    const actual = timeline.getSnapshot();
    for (const key of ["sequenceId", "frameIndex", "cell", "elapsedQ12", "active", "playMode"]) {
      assert.equal(actual[key], expected[key], `${message}: ${key}`);
    }
  };
  for (const frame of live.frames) {
    for (const call of live.calls.filter((call) => call.tick === frame.tick)) {
      if (!call.before) continue;
      timeline ??= createNativeCharacterAnimationTimeline(byId.get(call.before.sequenceId), { initialSnapshot: call.before });
      compare(call.before, `before ${call.pc} tick ${frame.tick}`);
      if (call.pc === "0x2047904") timeline = createNativeCharacterAnimationTimeline(byId.get(call.r1));
      if (call.pc === "0x2047a08") timeline.advanceNative(call.r1, call.before.speedQ12);
    }
    compare(frame.animation, `end tick ${frame.tick}`);
    count++;
  }
  assert.equal(count, 476);
  assert.equal(live.card.speciesIndex, 10);
  assert.equal(live.card.currentHp, 210);
});

test("frame projection uses raw source textures and native flips, never archive aliases or GPU time", () => {
  const sprite = { texture: { key: "identity" } };
  const presenter = createNativeHuntCharacterFramePresenter({ sprite, animations,
    entityId: "m003_nyokimon", textureResolver: (key) => ({ key }) });
  for (const sample of live.frames) {
    const result = presenter.apply({ ...sample.animation, contract: NATIVE_HUNT_CHARACTER_FRAME_CONTRACT });
    assert.equal(result.cell, sample.animation.cell);
    assert.equal(sprite.texture.key, `m003_nyokimon/main/cell_${String(result.cell).padStart(3, "0")}`);
    assert.equal(result.flipX, Boolean(sample.animation.flipBits & 1));
    assert.deepEqual(presenter.apply({ ...sample.animation, contract: NATIVE_HUNT_CHARACTER_FRAME_CONTRACT }), result);
  }
  assert.equal(presenter.update, undefined);
  presenter.apply(null);
  assert.deepEqual(sprite.texture, { key: "identity" });
  assert.throws(() => presenter.apply({ sequenceId: 15, frameIndex: 0, flipBits: 0 }), /UNVERIFIED/);
  assert.throws(() => presenter.apply({ contract: NATIVE_HUNT_CHARACTER_FRAME_CONTRACT,
    sequenceId: 15, frameIndex: 100, flipBits: 0 }), /UNVERIFIED/);
});

test("every integrated character retains native frame identity and reduced-motion action transitions", () => {
  const root='assets/production/internal-faithful-baseline/characters-v1';
  let count=0;
  for (const entityId of fs.readdirSync(root).filter(id=>fs.existsSync(`${root}/${id}/runtime.json`))) {
    const own=read(`${root}/${entityId}/runtime.json`).sides.main.animations;
    const sprite = { texture: "identity" };
    const presenter = createNativeHuntCharacterFramePresenter({ sprite, animations:own, entityId,
      reducedMotion: true, textureResolver: (key) => key });
    for(const animation of own.filter(a=>[1,2].includes(a.playbackMode))){
      const result = presenter.apply({ contract: NATIVE_HUNT_CHARACTER_FRAME_CONTRACT,
        sequenceId: animation.id, frameIndex: animation.frames.length-1, flipBits: 1 });
      assert.equal(result.frameIndex,0);assert.equal(result.sequenceId,animation.id);
      assert.equal(sprite.texture,animation.frames[0].texture);assert.equal(result.cell,animation.frames[0].cell);
    }
    count++;
  }
  assert.equal(count,224);
});

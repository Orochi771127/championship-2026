import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import { createChannelRng, restoreChannelRng } from "../src/championship/battle/battleRngChannel.js";
import { rollNativeHuntRange, repairNativeHuntSpawnTile, initializeNativeHuntPosition } from "../src/championship/hunt/capture/nativeHuntSpawn.js";

const live = JSON.parse(fs.readFileSync("docs/research/HUNT_ENTRY_ENVIRONMENT_REPLAY_2026-09-06.json", "utf8"));
const cpu = JSON.parse(fs.readFileSync("docs/research/HUNT_SPAWN_CPU_CHECK_2026-09-06.json", "utf8"));

test("normal original entry and later updates reproduce every actual RNG return and final cursor", () => {
  const rng = restoreChannelRng(live.rngBefore);
  assert.equal(live.rngCalls.length, 10584);
  for (const call of live.rngCalls) {
    assert.equal(rng.cursorOf(call.channel), call.cursorBefore);
    assert.equal(rng.seedOf(call.channel), call.seed);
    assert.equal(rng.next(call.channel), call.actualValue, `native tick ${call.tick} caller ${call.caller}`);
  }
  assert.deepEqual(rng.snapshot(), live.rngAfter);
});

test("RNG snapshots continue consumed state and do not alias callers or assume a master seed", () => {
  const rng = createChannelRng(20);
  for (let i = 0; i < 117; i++) rng.next(i % 3);
  const snapshot = rng.snapshot(), restored = restoreChannelRng(snapshot);
  snapshot.seeds[0] = 0; snapshot.cursors[1] = 0;
  assert.equal(restored.masterSeed, null);
  for (let i = 0; i < 309; i++) assert.equal(restored.next(i % 3), rng.next(i % 3));
  assert.deepEqual(restored.snapshot(), rng.snapshot());
  assert.throws(() => restoreChannelRng({ seeds: [20], cursors: [0] }), /COMPLETE_CHANNEL_STATE_REQUIRED/);
  const invalid = rng.snapshot(); invalid.cursors[0] = -1;
  assert.throws(() => restoreChannelRng(invalid), /COMPLETE_CHANNEL_STATE_REQUIRED/);
});

test("range sampling preserves native channel selection and all 103 possible branch results", () => {
  assert.equal(cpu.rangeCases.length, 1030);
  for (const c of cpu.rangeCases) {
    const channels = [];
    const rng = { next(channel) { channels.push(channel); return c.draws[channels.length - 1]; } };
    assert.equal(rollNativeHuntRange(rng, c.range), c.value);
    assert.deepEqual(channels, c.channels);
  }
});

test("spawn repair matches actual ARM probe query order, boundary exclusions and failure", () => {
  assert.equal(cpu.repairCases.length, 11);
  for (const c of cpu.repairCases) {
    const queries = [];
    const result = repairNativeHuntSpawnTile(c.before, {
      width: c.width, height: c.height,
      isBlocked(x, y) { queries.push([x, y]); return !c.openTiles.some(([ox, oy]) => ox === x && oy === y); },
    });
    assert.deepEqual(result, { radius: c.radius, tile: c.after });
    assert.deepEqual(queries, c.queries);
  }
});

test("all 15 normal-entry initial positions derive from continuing RNG and original terrain queries", () => {
  const rng = restoreChannelRng(live.rngBefore);
  const starts = live.initialization.filter((e) => e.kind === "range-rng" && e.caller === 0x0210B9DC);
  const repairs = live.initialization.filter((e) => e.kind === "spawn-terrain-repair");
  const actors = live.initialization.filter((e) => e.kind === "actor-initialization" && e.pc === "0x210bc3c");
  assert.equal(starts.length, 15); assert.equal(repairs.length, 15); assert.equal(actors.length, 15);
  let cursor = 0;
  for (let i = 0; i < starts.length; i++) {
    while (cursor < starts[i].rngStart) { const c = live.rngCalls[cursor++]; assert.equal(rng.next(c.channel), c.actualValue); }
    let query = 0;
    const result = initializeNativeHuntPosition({ rng, widthPixels: 1024, heightPixels: 1024,
      terrain: { width: 128, height: 128, isBlocked(x, y) {
        const expected = repairs[i].queries[query++];
        assert.deepEqual([x, y], expected.tile, `wild ${i} terrain query ${query}`);
        return expected.blocked;
      } },
    });
    cursor += 10;
    assert.equal(query, repairs[i].queries.length);
    assert.deepEqual(result.positionQ12.slice(0, 2), actors[i].wild.positionQ12, `wild ${i}`);
    assert.deepEqual(result.repair, { radius: repairs[i].radius, tile: repairs[i].after });
    assert.deepEqual(rng.snapshot().cursors,
      (() => { const expected = restoreChannelRng(live.rngBefore); for (const c of live.rngCalls.slice(0, cursor)) expected.next(c.channel); return expected.snapshot().cursors; })());
  }
});

test("spawn requires actual RNG and terrain ports without introducing a fallback encounter", () => {
  assert.throws(() => initializeNativeHuntPosition(), /WIDTH_PIXELS_REQUIRED/);
  assert.throws(() => initializeNativeHuntPosition({ widthPixels: 1024, heightPixels: 1024 }), /MATCHING_TERRAIN_REQUIRED/);
  assert.throws(() => rollNativeHuntRange(null, 1024), /RNG_REQUIRED/);
});

import assert from "node:assert/strict";
import test from "node:test";
import { createLoadWatchdog } from "../src/championship/app/loadWatchdog.js";
import { createAssetPrefetcher, withPrefetchedTextures } from "../src/championship/app/assetPrefetch.js";

function fakeClock() {
  let time = 0;
  let timers = [];
  return {
    now: () => time,
    setTimer: (fn, ms) => { const timer = { at: time + ms, fn }; timers.push(timer); return timer; },
    clearTimer: (timer) => { timers = timers.filter((t) => t !== timer); },
    advance(ms) {
      const end = time + ms;
      for (;;) {
        const next = timers.filter((t) => t.at <= end).sort((a, b) => a.at - b.at)[0];
        if (!next) break;
        timers = timers.filter((t) => t !== next);
        time = next.at;
        next.fn();
      }
      time = end;
    }
  };
}

test("a load with no progress for the stall window is given up as stalled", () => {
  const clock = fakeClock();
  const verdicts = [];
  createLoadWatchdog({ ...clock, stallMs: 30000, maxMs: 240000, onExpire: (reason) => verdicts.push(reason) });
  clock.advance(29999);
  assert.deepEqual(verdicts, []);
  clock.advance(1);
  assert.deepEqual(verdicts, ["STALLED"]);
});

test("progress keeps a slow load alive past the old fixed 30 s deadline", () => {
  const clock = fakeClock();
  const verdicts = [];
  const watchdog = createLoadWatchdog({ ...clock, stallMs: 30000, maxMs: 240000, onExpire: (reason) => verdicts.push(reason) });
  for (let second = 0; second < 90; second += 5) { clock.advance(5000); watchdog.activity(); }
  assert.deepEqual(verdicts, [], "bytes every five seconds for 90 s is slow, not stalled");
  assert.equal(watchdog.state(), "WAITING");
  clock.advance(30000);
  assert.deepEqual(verdicts, ["STALLED"], "then 30 s of silence is");
});

test("the outer limit ends a load that trickles forever", () => {
  const clock = fakeClock();
  const verdicts = [];
  const watchdog = createLoadWatchdog({ ...clock, stallMs: 30000, maxMs: 60000, onExpire: (reason) => verdicts.push(reason) });
  for (let second = 0; second < 70; second += 10) { clock.advance(10000); watchdog.activity(); }
  assert.deepEqual(verdicts, ["TOO_LONG"]);
});

test("a finished or abandoned load reaches no verdict", () => {
  const clock = fakeClock();
  const verdicts = [];
  const watchdog = createLoadWatchdog({ ...clock, onExpire: (reason) => verdicts.push(reason) });
  clock.advance(1000);
  watchdog.stop();
  clock.advance(600000);
  assert.deepEqual(verdicts, []);
  assert.equal(watchdog.state(), "STOPPED");
});

function streamedResponse(chunks, { status = 200, length = chunks.reduce((n, c) => n + c.length, 0), signal = null } = {}) {
  let index = 0;
  const body = new ReadableStream({
    pull(controller) {
      if (signal?.aborted) { controller.error(new DOMException("aborted", "AbortError")); return; }
      if (index >= chunks.length) { controller.close(); return; }
      controller.enqueue(chunks[index]);
      index += 1;
    }
  });
  return new Response(body, { status, headers: { "content-length": String(length), "content-type": "image/png" } });
}

test("streamed downloads report bytes, keep them for the texture loader and share one request", async () => {
  const calls = [];
  const chunks = [new Uint8Array([1, 2, 3]), new Uint8Array([4, 5]), new Uint8Array([6])];
  const prefetcher = createAssetPrefetcher({ fetchImpl: async (url, options) => { calls.push(url); return streamedResponse(chunks, { signal: options.signal }); } });
  const seen = [];
  const stop = prefetcher.subscribe(() => seen.push(prefetcher.progress(["https://x/a.png"])));
  const [first, second] = await Promise.all([
    prefetcher.fetchAll(["https://x/a.png"]),
    prefetcher.fetchAll(["https://x/a.png", "https://x/a.png"])
  ]);
  stop();
  assert.deepEqual(calls, ["https://x/a.png"], "one request serves both callers");
  assert.equal(first.complete, true);
  assert.equal(second.loaded, 6);
  assert.equal(second.total, 6);
  assert.ok(seen.some((p) => p.loaded > 0 && p.loaded < 6), "progress was reported part-way");
  const blob = prefetcher.blobOf("https://x/a.png");
  assert.deepEqual([...new Uint8Array(await blob.arrayBuffer())], [1, 2, 3, 4, 5, 6]);
  prefetcher.forget(["https://x/a.png"]);
  assert.equal(prefetcher.blobOf("https://x/a.png"), null, "forgotten bytes can be collected");
});

test("a failed download is reported, not thrown, and a later request tries again", async () => {
  let attempt = 0;
  const prefetcher = createAssetPrefetcher({ fetchImpl: async () => {
    attempt += 1;
    return attempt === 1 ? new Response("down", { status: 503 }) : streamedResponse([new Uint8Array([9])]);
  } });
  const failed = await prefetcher.fetchAll(["https://x/b.png"]);
  assert.equal(failed.failed, 1);
  assert.equal(failed.complete, false);
  const retried = await prefetcher.fetchAll(["https://x/b.png"]);
  assert.equal(retried.complete, true);
  assert.equal(attempt, 2);
});

test("leaving before the download ends stops it when nobody else is waiting", async () => {
  let aborted = false;
  const prefetcher = createAssetPrefetcher({ fetchImpl: (url, { signal }) => new Promise((resolve, reject) => {
    signal.addEventListener("abort", () => { aborted = true; reject(new DOMException("aborted", "AbortError")); });
  }) });
  const leave = new AbortController();
  const pending = prefetcher.fetchAll(["https://x/c.png"], { signal: leave.signal });
  leave.abort();
  const result = await pending;
  assert.equal(aborted, true);
  assert.equal(result.complete, false);
  assert.equal(prefetcher.blobOf("https://x/c.png"), null);
});

test("prefetched URLs load as blobs through the same texture parser, others pass through", async () => {
  const loads = [];
  const unloads = [];
  const PIXI = { Texture: class {}, Assets: { load: async (value) => { loads.push(value); return { value }; }, unload: async (value) => { unloads.push(value); } } };
  const blob = new Blob([new Uint8Array([1])], { type: "image/png" });
  const wrapped = withPrefetchedTextures(PIXI, (url) => (url === "https://game/a/frame-00.png" ? blob : null), "https://game/");
  await wrapped.Assets.load("a/frame-00.png");
  await wrapped.Assets.load("a/frame-01.png");
  assert.equal(loads[0].parser, "texture");
  assert.match(loads[0].src, /^blob:/);
  assert.equal(loads[1], "a/frame-01.png");
  await wrapped.Assets.unload("a/frame-00.png");
  await wrapped.Assets.unload("a/frame-01.png");
  assert.deepEqual(unloads, [{ src: loads[0].src }, "a/frame-01.png"]);
  assert.equal(wrapped.Texture, PIXI.Texture, "everything else on PIXI is unchanged");
});

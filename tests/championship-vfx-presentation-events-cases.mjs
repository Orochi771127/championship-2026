import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import {
  CHAMPIONSHIP_PRESENTATION_EVENTS,
  createChampionshipPresentationEventBus
} from "../src/championship/presentation/events/championshipPresentationEvents.js";
import {
  createBattleWeatherVfxPresentation,
  FAITHFUL_VFX_EVENT_BINDINGS
} from "../src/championship/presentation/vfx/battleWeatherVfxPresentation.js";

function fakeRuntime() {
  const active = new Map();
  const calls = [];
  return {
    calls,
    async load(systemId, options) {
      calls.push(["load", systemId, options]);
      let elapsed = 0;
      let disposed = false;
      const object3d = { position: { set: (x, y, z) => { object3d.position.value = [x, y, z]; } }, userData: {} };
      const instance = {
        systemId,
        channel: options.channel,
        object3d,
        update(deltaMs) { elapsed += deltaMs; },
        getDiagnostics: () => ({ finished: !options.loop && elapsed >= 100, disposed }),
        async dispose() { disposed = true; active.delete(options.channel); }
      };
      active.set(options.channel, instance);
      return instance;
    },
    getActive: (channel) => active.get(channel) ?? null,
    async unload(channel) {
      calls.push(["unload", channel]);
      await active.get(channel)?.dispose();
    },
    async unloadAll() {
      calls.push(["unloadAll"]);
      await Promise.all([...active.values()].map((instance) => instance.dispose()));
    }
  };
}

test("presentation event bus is ephemeral, ordered and isolates subscribers", () => {
  const failures = [];
  const bus = createChampionshipPresentationEventBus({ onSubscriberError: (error) => failures.push(error.message) });
  const seen = [];
  bus.subscribe(() => { throw new Error("observer failed"); });
  bus.subscribe((event) => seen.push(event));
  const event = bus.publish(CHAMPIONSHIP_PRESENTATION_EVENTS.BATTLE_BIG_HIT_CONFIRMED, {
    anchorId: "target-2",
    position: { x: 1, y: 2, z: 3 }
  });
  assert.equal(event.sequence, 1);
  assert.deepEqual(event.payload.position, { x: 1, y: 2, z: 3 });
  assert.equal(seen.length, 1);
  assert.deepEqual(failures, ["observer failed"]);
  assert.deepEqual(bus.getDiagnostics(), { sequence: 1, subscriberCount: 2, ticker: "NONE", saveAuthority: "NONE" });
});

test("four faithful systems bind to separate battle, common and weather timings", async () => {
  const events = createChampionshipPresentationEventBus();
  const runtime = fakeRuntime();
  const mounted = [];
  const unmounted = [];
  const controller = createBattleWeatherVfxPresentation({
    events,
    runtime,
    onMount: ({ channel, binding }) => mounted.push([channel, binding.systemId]),
    onUnmount: ({ channel, binding }) => unmounted.push([channel, binding.systemId])
  });

  events.publish(CHAMPIONSHIP_PRESENTATION_EVENTS.BATTLE_BIG_HIT_CONFIRMED, { anchorId: "target" });
  events.publish(CHAMPIONSHIP_PRESENTATION_EVENTS.WEATHER_RAIN_CHANGED, { active: true });
  events.publish(CHAMPIONSHIP_PRESENTATION_EVENTS.COMMON_SPARK_REQUESTED, { anchorId: "field-marker" });
  await controller.settle();
  assert.deepEqual(mounted, [["battle", "hitspark_big"], ["weather", "rain"], ["common", "spark"]]);
  assert.deepEqual(controller.getDiagnostics().active.map(({ channel, systemId }) => [channel, systemId]), [
    ["battle", "hitspark_big"], ["weather", "rain"], ["common", "spark"]
  ]);

  events.publish(CHAMPIONSHIP_PRESENTATION_EVENTS.BATTLE_HYPER_STARTED, {
    anchorId: "actor",
    position: { x: 4, y: 5, z: 6 }
  });
  await controller.settle();
  assert.deepEqual(unmounted, [["battle", "hitspark_big"]]);
  assert.equal(runtime.getActive("battle").systemId, "hypereffect");
  assert.deepEqual(runtime.getActive("battle").object3d.position.value, [4, 5, 6]);

  events.publish(CHAMPIONSHIP_PRESENTATION_EVENTS.WEATHER_RAIN_CHANGED, { active: false });
  await controller.settle();
  assert.equal(runtime.getActive("weather"), null);
  assert.equal(runtime.getActive("battle").systemId, "hypereffect");
  assert.equal(controller.getDiagnostics().ticker, "CALLER_OWNED");
  assert.equal(controller.getDiagnostics().saveAuthority, "NONE");
  await controller.dispose();
});

test("one-shot effects finish only when the caller advances delta time", async () => {
  const events = createChampionshipPresentationEventBus();
  const runtime = fakeRuntime();
  const controller = createBattleWeatherVfxPresentation({ events, runtime });
  events.publish(CHAMPIONSHIP_PRESENTATION_EVENTS.COMMON_SPARK_REQUESTED, { anchorId: "spark-origin" });
  await controller.settle();
  assert.equal(runtime.getActive("common").systemId, "spark");
  controller.update(99);
  await controller.settle();
  assert.equal(runtime.getActive("common").systemId, "spark");
  controller.update(1);
  await controller.settle();
  assert.equal(runtime.getActive("common"), null);
  await controller.dispose();
});

test("event contract records evidence boundaries instead of inventing callers", () => {
  const contract = JSON.parse(fs.readFileSync(path.join(process.cwd(), "docs/contracts/championship/CHAMPIONSHIP_BATTLE_WEATHER_VFX_EVENTS.v1.json"), "utf8"));
  assert.equal(contract.events.length, 4);
  assert.match(FAITHFUL_VFX_EVENT_BINDINGS[CHAMPIONSHIP_PRESENTATION_EVENTS.COMMON_SPARK_REQUESTED].evidence, /CALLER_OPEN/);
  assert.match(FAITHFUL_VFX_EVENT_BINDINGS[CHAMPIONSHIP_PRESENTATION_EVENTS.WEATHER_RAIN_CHANGED].evidence, /CALLER_OPEN/);
  assert.equal(contract.scope, "PRESENTATION_ONLY_NO_SIMULATION_OR_SAVE_AUTHORITY");
  assert.ok(contract.hardConstraints.some((value) => value.includes("never serialized")));
});

const assert = require("node:assert/strict");
const { chromium } = require("playwright");

const BASE_URL = process.env.CHAMPIONSHIP_QA_URL || "http://127.0.0.1:8732/championship.html";
const CHROME = process.env.CHAMPIONSHIP_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  try {
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(BASE_URL, { waitUntil: "networkidle" });
    const results = await page.evaluate(async () => {
      const module = await import("/src/championship/presentation/vfx/faithfulVfxRuntimeBundle.js");
      const eventModule = await import("/src/championship/presentation/events/championshipPresentationEvents.js");
      const bridgeModule = await import("/src/championship/presentation/vfx/battleWeatherVfxPresentation.js");
      const manifest = await module.loadFaithfulVfxRuntimeManifest();
      const runtime = module.createFaithfulVfxRuntime({ manifest });
      const diagnostics = [];
      for (const systemId of runtime.listSystems()) {
        const instance = await runtime.load(systemId, { loop: true });
        instance.update(100);
        let nodes = 0;
        let materials = 0;
        instance.object3d.traverse((object) => {
          nodes += 1;
          materials += Array.isArray(object.material) ? object.material.length : Number(Boolean(object.material));
        });
        diagnostics.push({ ...instance.getDiagnostics(), nodes, materials });
      }
      await runtime.unload();
      const events = eventModule.createChampionshipPresentationEventBus();
      const mounts = [];
      const controller = bridgeModule.createBattleWeatherVfxPresentation({
        events,
        runtime,
        onMount({ channel, binding, instance }) {
          mounts.push({ channel, systemId: binding.systemId, nodes: (() => {
            let count = 0;
            instance.object3d.traverse(() => { count += 1; });
            return count;
          })() });
        }
      });
      events.publish(eventModule.CHAMPIONSHIP_PRESENTATION_EVENTS.WEATHER_RAIN_CHANGED, { active: true });
      events.publish(eventModule.CHAMPIONSHIP_PRESENTATION_EVENTS.BATTLE_BIG_HIT_CONFIRMED, { anchorId: "target-1" });
      events.publish(eventModule.CHAMPIONSHIP_PRESENTATION_EVENTS.COMMON_SPARK_REQUESTED, { anchorId: "field-origin" });
      await controller.settle();
      const concurrent = runtime.listActive();
      events.publish(eventModule.CHAMPIONSHIP_PRESENTATION_EVENTS.BATTLE_HYPER_STARTED, { anchorId: "actor-1" });
      await controller.settle();
      const battleAfterHyper = runtime.getActive("battle")?.systemId ?? null;
      events.publish(eventModule.CHAMPIONSHIP_PRESENTATION_EVENTS.WEATHER_RAIN_CHANGED, { active: false });
      await controller.settle();
      const weatherAfterStop = runtime.getActive("weather");
      const controllerDiagnostics = controller.getDiagnostics();
      await controller.dispose();
      return {
        assetId: runtime.assetId,
        diagnostics,
        activeAfterUnload: runtime.getActive(),
        eventIntegration: { mounts, concurrent, battleAfterHyper, weatherAfterStop, controllerDiagnostics }
      };
    });
    assert.equal(results.assetId, "art:vfx:faithful-original:internal-v1");
    assert.equal(results.activeAfterUnload, null);
    assert.deepEqual(results.diagnostics.map((entry) => entry.systemId), ["hitspark_big", "hypereffect", "spark", "rain"]);
    assert.ok(results.diagnostics.every((entry) => entry.nodes >= 2));
    assert.ok(results.diagnostics.every((entry) => entry.materials >= 1));
    assert.ok(results.diagnostics.every((entry) => entry.periodSeconds > 0));
    assert.equal(results.diagnostics.find((entry) => entry.systemId === "hypereffect").sidecarCount, 1);
    assert.equal(results.diagnostics.find((entry) => entry.systemId === "spark").sidecarCount, 1);
    assert.equal(results.diagnostics.find((entry) => entry.systemId === "spark").propertyAnimationChannels, 4);
    assert.equal(results.diagnostics.find((entry) => entry.systemId === "rain").propertyAnimationChannels, 1);
    assert.deepEqual(results.eventIntegration.concurrent, [
      { channel: "weather", systemId: "rain" },
      { channel: "battle", systemId: "hitspark_big" },
      { channel: "common", systemId: "spark" }
    ]);
    assert.equal(results.eventIntegration.battleAfterHyper, "hypereffect");
    assert.equal(results.eventIntegration.weatherAfterStop, null);
    assert.equal(results.eventIntegration.controllerDiagnostics.ticker, "CALLER_OWNED");
    assert.equal(results.eventIntegration.controllerDiagnostics.saveAuthority, "NONE");
    assert.ok(results.eventIntegration.mounts.every((entry) => entry.nodes >= 2));
    assert.deepEqual(errors, []);
    console.log(`CHAMPIONSHIP_FAITHFUL_VFX_BROWSER_PASS systems=${results.diagnostics.length} events=${results.eventIntegration.mounts.length} concurrent=3 ticker=CALLER_OWNED gateEarth=UNMOUNTED`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(`CHAMPIONSHIP_FAITHFUL_VFX_BROWSER_FAIL: ${error.stack || error.message}`);
  process.exit(1);
});

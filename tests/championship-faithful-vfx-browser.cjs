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
      return { assetId: runtime.assetId, diagnostics, activeAfterUnload: runtime.getActive() };
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
    assert.deepEqual(errors, []);
    console.log(`CHAMPIONSHIP_FAITHFUL_VFX_BROWSER_PASS systems=${results.diagnostics.length} ticker=CALLER_OWNED gateEarth=UNMOUNTED`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(`CHAMPIONSHIP_FAITHFUL_VFX_BROWSER_FAIL: ${error.stack || error.message}`);
  process.exit(1);
});

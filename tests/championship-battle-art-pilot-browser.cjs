const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const BASE_URL = process.env.CHAMPIONSHIP_BATTLE_ART_QA_URL || "http://127.0.0.1:8732/battle-art-review.html";
const CHROME = process.env.CHAMPIONSHIP_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT = require("./browser-qa-output.cjs")("art/battle/bm00-bm01-r1");
const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 393, height: 852 },
  { width: 412, height: 915 },
  { width: 430, height: 932 }
];

fs.mkdirSync(OUTPUT, { recursive: true });

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const results = [];
  try {
    for (const viewport of VIEWPORTS) {
      const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
      const page = await context.newPage();
      const problems = [];
      page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
      page.on("console", (message) => {
        if (message.type() === "error") problems.push(`console: ${message.text()}`);
      });

      await page.goto(BASE_URL, { waitUntil: "networkidle" });
      await page.waitForFunction(() => globalThis.__BATTLE_ART_REVIEW_READY__ === true, null, { timeout: 20000 });
      await page.waitForTimeout(300);
      const diagnostics = await page.evaluate(() => {
        const canvas = document.querySelector(".cm-battle-art-review-canvas");
        const rect = canvas?.getBoundingClientRect();
        return {
          documentWidth: document.documentElement.scrollWidth,
          documentHeight: document.documentElement.scrollHeight,
          canvasCount: document.querySelectorAll("canvas").length,
          canvasRect: rect ? { x: rect.x, y: rect.y, width: rect.width, height: rect.height } : null,
          runtime: globalThis.__BATTLE_ART_REVIEW__.getDiagnostics()
        };
      });

      assert.equal(diagnostics.documentWidth, viewport.width, `${viewport.width} horizontal overflow`);
      assert.equal(diagnostics.documentHeight, viewport.height, `${viewport.width} vertical overflow`);
      assert.equal(diagnostics.canvasCount, 1, `${viewport.width} must use one Pixi canvas`);
      assert.deepEqual(diagnostics.canvasRect, { x: 0, y: 0, width: viewport.width, height: viewport.height });
      assert.equal(diagnostics.runtime.stage.applicationCount, 1);
      assert.equal(diagnostics.runtime.stage.sceneCount, 1);
      assert.equal(diagnostics.runtime.review.layerCount, 2);
      assert.match(diagnostics.runtime.review.layerOrder[0], /^arena_background/);
      assert.match(diagnostics.runtime.review.layerOrder[1], /^canonical_shared_layer/);
      assert.equal(diagnostics.runtime.review.gameplayMounted, false);
      assert.equal(diagnostics.runtime.review.uiMounted, false);
      assert.equal(diagnostics.runtime.review.collisionMounted, false);
      assert.ok(diagnostics.runtime.review.viewport.renderedWidth <= viewport.width + 0.001);
      assert.ok(diagnostics.runtime.review.viewport.renderedHeight <= viewport.height + 0.001);
      assert.deepEqual(problems, []);

      const screenshot = `battle-art-${viewport.width}x${viewport.height}.png`;
      await page.screenshot({ path: path.join(OUTPUT, screenshot), fullPage: true });
      results.push({ viewport, screenshot, diagnostics, problems });
      await context.close();
    }
  } finally {
    await browser.close();
  }

  const report = {
    schemaVersion: 1,
    assetId: "art:battle:bm00-bm01-r1:original-review",
    renderer: "CHAMPIONSHIP_SINGLE_PIXI_STAGE",
    status: "PASS_INTERNAL_REVIEW_ONLY_NOT_RUNTIME_OR_SHIPPING_PROMOTED",
    results
  };
  fs.writeFileSync(path.join(OUTPUT, "browser-qa.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify(report, null, 2));
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

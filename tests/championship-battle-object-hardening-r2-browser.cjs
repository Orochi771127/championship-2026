const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const ORIGIN = process.env.CHAMPIONSHIP_BATTLE_ART_QA_ORIGIN || "http://127.0.0.1:8732";
const CHROME = process.env.CHAMPIONSHIP_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT = path.resolve("docs/reports/art/battle/hardening-r2");
const VIEWPORTS = [
  { width: 360, height: 800 }, { width: 390, height: 844 }, { width: 393, height: 852 },
  { width: 412, height: 915 }, { width: 430, height: 932 }
];
const ARENAS = [
  { key: "bm04", fieldId: "field_bm04_01", roles: ["animated_terrain_bed", "arena_terrain", "field_objects", "canonical_shared_layer"], frames: 2, advanceMs: 400 },
  { key: "bm08", fieldId: "field_bm08_01", roles: ["arena_background", "field_objects", "canonical_shared_layer"], frames: 1 },
  { key: "bm11", fieldId: "field_bm11_01", roles: ["arena_background", "field_objects", "canonical_shared_layer"], frames: 2, advanceMs: 110 }
];
const ALL_KEYS = Array.from({ length: 11 }, (_, index) => `bm${String(index + 1).padStart(2, "0")}`);

fs.mkdirSync(OUTPUT, { recursive: true });

async function reviewDiagnostics(page) {
  return page.evaluate(() => {
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
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const results = [];
  const galleryResults = [];
  try {
    for (const arena of ARENAS) {
      for (const viewport of VIEWPORTS) {
        const context = await browser.newContext({ viewport, deviceScaleFactor: 1 });
        const page = await context.newPage();
        const problems = [];
        page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
        page.on("console", (message) => { if (message.type() === "error") problems.push(`console: ${message.text()}`); });
        await page.goto(`${ORIGIN}/battle-art-review.html?arena=${arena.key}&paused=1`, { waitUntil: "networkidle" });
        await page.waitForFunction(() => globalThis.__BATTLE_ART_REVIEW_READY__ === true, null, { timeout: 20000 });
        for (let frameIndex = 0; frameIndex < arena.frames; frameIndex += 1) {
          if (frameIndex > 0) await page.evaluate((delta) => globalThis.__BATTLE_ART_REVIEW__.advance(delta), arena.advanceMs);
          await page.waitForTimeout(80);
          const diagnostics = await reviewDiagnostics(page);
          assert.equal(diagnostics.documentWidth, viewport.width);
          assert.equal(diagnostics.documentHeight, viewport.height);
          assert.equal(diagnostics.canvasCount, 1);
          assert.deepEqual(diagnostics.canvasRect, { x: 0, y: 0, width: viewport.width, height: viewport.height });
          assert.equal(diagnostics.runtime.stage.applicationCount, 1);
          assert.equal(diagnostics.runtime.stage.sceneCount, 1);
          assert.equal(diagnostics.runtime.review.fieldId, arena.fieldId);
          assert.deepEqual(diagnostics.runtime.review.layerOrder.map((item) => item.split(" ")[0]), arena.roles);
          assert.equal(diagnostics.runtime.review.animation?.frameIndex ?? 0, frameIndex);
          assert.equal(diagnostics.runtime.review.gameplayMounted, false);
          assert.equal(diagnostics.runtime.review.uiMounted, false);
          assert.equal(diagnostics.runtime.review.collisionMounted, false);
          assert.ok(diagnostics.runtime.review.viewport.renderedWidth <= viewport.width + 0.001);
          assert.ok(diagnostics.runtime.review.viewport.renderedHeight <= viewport.height + 0.001);
          assert.deepEqual(problems, []);
          const screenshot = `battle-${arena.key}-frame-${frameIndex}-${viewport.width}x${viewport.height}.png`;
          await page.screenshot({ path: path.join(OUTPUT, screenshot), fullPage: true });
          results.push({ arena: arena.key, fieldId: arena.fieldId, frameIndex, viewport, screenshot, diagnostics, problems: [...problems] });
        }
        await context.close();
      }
    }

    const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
    const page = await context.newPage();
    const problems = [];
    page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
    page.on("console", (message) => { if (message.type() === "error") problems.push(`console: ${message.text()}`); });
    await page.goto(`${ORIGIN}/battle-art-gallery.html?arena=bm01`, { waitUntil: "networkidle" });
    await page.waitForFunction(() => globalThis.__BATTLE_ART_GALLERY_READY__ === true, null, { timeout: 20000 });
    for (const key of ALL_KEYS) {
      await page.evaluate((nextKey) => globalThis.__BATTLE_ART_GALLERY__.select(nextKey), key);
      const diagnostics = await page.evaluate(() => ({
        canvasCount: document.querySelectorAll("canvas").length,
        selected: document.getElementById("arena").value,
        runtime: globalThis.__BATTLE_ART_GALLERY__.getDiagnostics()
      }));
      assert.equal(diagnostics.canvasCount, 1);
      assert.equal(diagnostics.selected, key);
      assert.equal(diagnostics.runtime.arenaCount, 11);
      assert.equal(diagnostics.runtime.stage.applicationCount, 1);
      assert.equal(diagnostics.runtime.stage.sceneCount, 1);
      assert.equal(diagnostics.runtime.review.gameplayMounted, false);
      assert.deepEqual(problems, []);
      galleryResults.push({ key, fieldId: diagnostics.runtime.review.fieldId, canvasCount: diagnostics.canvasCount, problems: [...problems] });
    }
    await page.screenshot({ path: path.join(OUTPUT, "battle-11-arena-gallery-390x844.png"), fullPage: true });
    await context.close();
  } finally {
    await browser.close();
  }
  const report = {
    schemaVersion: 1,
    assetId: "art:battle:object-hardening-r2:original-review",
    renderer: "CHAMPIONSHIP_SINGLE_PIXI_STAGE_CALLER_OWNED_TICKER",
    status: "PASS_INTERNAL_REVIEW_ONLY_NOT_OWNER_APPROVED_OR_PROMOTED",
    resultSummary: "25 frame/viewport checks and 11 unified-gallery arena switches passed",
    results,
    galleryResults
  };
  fs.writeFileSync(path.join(OUTPUT, "browser-qa.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(JSON.stringify({ ...report, results: `${results.length} checks`, galleryResults: `${galleryResults.length} switches` }, null, 2));
})().catch((error) => { console.error(error); process.exitCode = 1; });

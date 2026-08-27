const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const BASE_URL = process.env.CHAMPIONSHIP_QA_URL || "http://127.0.0.1:8732/championship.html";
const CHROME = process.env.CHAMPIONSHIP_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT = path.resolve("docs/reports/vs1");
const SCREENSHOTS = path.join(OUTPUT, "screenshots");
const VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 390, height: 844 },
  { width: 375, height: 812 },
  { width: 412, height: 915 },
  { width: 430, height: 932 }
];

fs.mkdirSync(SCREENSHOTS, { recursive: true });

function percentile(values, amount) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * amount))];
}

async function framePacing(page) {
  return page.evaluate(async () => {
    const stamps = [];
    await new Promise((resolve) => {
      const tick = (time) => {
        stamps.push(time);
        if (stamps.length >= 121) resolve();
        else requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
    const deltas = stamps.slice(1).map((time, index) => time - stamps[index]);
    return { deltas, durationMs: stamps.at(-1) - stamps[0] };
  });
}

async function inspectLayout(page, viewport) {
  return page.evaluate(({ width, height }) => {
    const shell = document.querySelector(".int-rh2-shell").getBoundingClientRect();
    const host = document.querySelector(".int-rh2-field-host").getBoundingClientRect();
    const canvas = document.querySelector(".cm-raising-pixi-canvas").getBoundingClientRect();
    const interactive = [...document.querySelectorAll("button:not(:disabled)")].map((button) => {
      const rect = button.getBoundingClientRect();
      return { id: button.id || button.className, width: rect.width, height: rect.height, top: rect.top, bottom: rect.bottom };
    });
    return {
      viewport: { width, height },
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      shell: { width: shell.width, height: shell.height, top: shell.top, bottom: shell.bottom },
      fieldHost: { width: host.width, height: host.height },
      canvas: { width: canvas.width, height: canvas.height },
      canvasCount: document.querySelectorAll("canvas").length,
      toolbarSlots: document.querySelectorAll(".int-rh2-raw-slot").length,
      toolbarEnabled: document.querySelectorAll(".int-rh2-raw-slot:not(:disabled)").length,
      uiAuthority: document.querySelector("#cm-root")?.dataset.uiAuthority,
      rendererSplit: document.querySelector(".int-rh2-shell")?.dataset.rendererSplit,
      threeElements: document.querySelectorAll("[data-renderer*='THREE'], canvas.three").length,
      interactive
    };
  }, viewport);
}

async function openRaising(context, { continueGame = false } = {}) {
  const page = await context.newPage();
  const pageErrors = [];
  const failedRequests = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  page.on("requestfailed", (request) => failedRequests.push(`${request.url()} :: ${request.failure()?.errorText}`));
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.click(continueGame ? "#cm-continue" : "#cm-new-game");
  await page.waitForSelector(".cm-raising-pixi-canvas", { timeout: 20000 });
  await page.waitForTimeout(2500);
  return { page, pageErrors, failedRequests };
}

async function runViewport(browser, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 1, reducedMotion: "no-preference" });
  const { page, pageErrors, failedRequests } = await openRaising(context);
  const layout = await inspectLayout(page, viewport);
  assert.equal(layout.documentWidth, viewport.width, `${viewport.width}x${viewport.height} horizontal overflow`);
  assert.ok(layout.documentHeight <= viewport.height, `${viewport.width}x${viewport.height} vertical overflow`);
  assert.equal(layout.canvasCount, 1, "exactly one field canvas");
  assert.equal(layout.toolbarSlots, 8, "eight toolbar shells");
  assert.equal(layout.toolbarEnabled, 0, "unknown toolbar slots stay disabled");
  assert.equal(layout.uiAuthority, "P1R_DOM");
  assert.equal(layout.rendererSplit, "DOM_UI_PIXI_FIELD");
  assert.equal(layout.threeElements, 0, "Three is absent");
  assert.ok(Math.abs(layout.fieldHost.width - layout.canvas.width) <= 1, "canvas width matches field host");
  assert.ok(Math.abs(layout.fieldHost.height - layout.canvas.height) <= 1, "canvas height matches field host");
  for (const control of layout.interactive) {
    assert.ok(control.height >= 44, `${control.id} has a 44px touch height`);
    assert.ok(control.top >= 0 && control.bottom <= viewport.height, `${control.id} is inside the viewport`);
  }

  const pacing = await framePacing(page);
  const fps = (pacing.deltas.length * 1000) / pacing.durationMs;
  const result = {
    viewport: `${viewport.width}x${viewport.height}`,
    layout,
    framePacing: {
      sampledFrames: pacing.deltas.length,
      averageFps: Number(fps.toFixed(2)),
      medianFrameMs: Number(percentile(pacing.deltas, 0.5).toFixed(2)),
      p95FrameMs: Number(percentile(pacing.deltas, 0.95).toFixed(2))
    },
    pageErrors,
    failedRequests,
    screenshot: `screenshots/raising-home-${viewport.width}x${viewport.height}.png`
  };
  assert.deepEqual(pageErrors, [], `${result.viewport} page errors`);
  assert.deepEqual(failedRequests, [], `${result.viewport} failed requests`);
  await page.screenshot({ path: path.join(OUTPUT, result.screenshot), fullPage: true });
  await context.close();
  return result;
}

async function runSaveReload(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  const first = await openRaising(context);
  const page = first.page;
  const host = await page.locator(".int-rh2-field-host").boundingBox();
  assert.ok(host, "field host exists");

  const actor = { x: host.x + host.width * 0.5, y: host.y + host.height * (0.18 + 0.27 * 0.72) };
  const target = { x: host.x + host.width * 0.5, y: host.y + host.height * (0.55 + 0.27 * 0.72) };
  await page.mouse.click(actor.x, actor.y);
  await page.waitForFunction(() => document.querySelector(".int-rh2-companion__name")?.textContent !== "SELECT A RESIDENT");
  const selectedName = await page.locator(".int-rh2-companion__name").textContent();
  await page.click(".int-rh2-care-button");
  await page.mouse.move(actor.x, actor.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 14 });
  await page.mouse.up();
  await page.click(".int-rh2-system-button");
  await page.waitForFunction(() => document.querySelector(".int-rh2-system-button")?.dataset.phase === "SAVED");

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("championshipModernSave:v1")));
  assert.ok(saved, "save payload exists");
  const savedText = JSON.stringify(saved);
  assert.match(savedText, /quiet-hollow/, "relocated cage persisted");
  assert.match(savedText, /careCount/, "care interaction flag persisted");
  await page.screenshot({ path: path.join(SCREENSHOTS, "raising-home-390x844-before-reload.png"), fullPage: true });
  await page.close();

  const restored = await openRaising(context, { continueGame: true });
  const restoredPage = restored.page;
  const restoredHost = await restoredPage.locator(".int-rh2-field-host").boundingBox();
  const restoredActor = {
    x: restoredHost.x + restoredHost.width * 0.5,
    y: restoredHost.y + restoredHost.height * (0.55 + 0.27 * 0.72)
  };
  await restoredPage.mouse.click(restoredActor.x, restoredActor.y);
  await restoredPage.waitForFunction(() => document.querySelector(".int-rh2-companion__location")?.textContent.includes("Quiet Hollow"));
  const restoredName = await restoredPage.locator(".int-rh2-companion__name").textContent();
  assert.equal(restoredName, selectedName, "same resident restored after real page reload");
  await restoredPage.screenshot({ path: path.join(SCREENSHOTS, "raising-home-390x844-restored.png"), fullPage: true });

  const result = {
    viewport: "390x844",
    selectedResident: selectedName,
    relocatedTo: "Quiet Hollow",
    careFlagPersisted: true,
    savePayloadPresent: true,
    restoredAfterPageReload: true,
    transientSelectionRestored: false,
    pageErrors: [...first.pageErrors, ...restored.pageErrors],
    failedRequests: [...first.failedRequests, ...restored.failedRequests]
  };
  assert.deepEqual(result.pageErrors, []);
  assert.deepEqual(result.failedRequests, []);
  await context.close();
  return result;
}

async function runPixiFallback(browser) {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
  await context.route("**/node_modules/pixi.js/dist/pixi.mjs", (route) => route.abort("failed"));
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.click("#cm-new-game");
  await page.waitForSelector(".int-rh2-field-fallback");
  assert.equal(await page.locator("canvas").count(), 0, "failed Pixi bootstrap creates no partial canvas");
  assert.equal(await page.locator(".int-rh2-system-button").isEnabled(), true, "save remains available in field fallback");
  assert.equal(await page.locator(".int-rh2-raw-slot").count(), 8, "toolbar evidence remains visible in fallback");
  assert.equal(await page.locator(".int-rh2-raw-slot:not(:disabled)").count(), 0, "unknown toolbar remains disabled");
  assert.deepEqual(errors, [], "Pixi load failure is bounded and does not become a page error");
  await page.screenshot({ path: path.join(SCREENSHOTS, "raising-home-390x844-pixi-fallback.png"), fullPage: true });
  await context.close();
  return { viewport: "390x844", partialCanvasCount: 0, saveAvailable: true, toolbarSlots: 8, pageErrors: errors, outcome: "PASS" };
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  try {
    const viewports = [];
    for (const viewport of VIEWPORTS) viewports.push(await runViewport(browser, viewport));
    const saveReload = await runSaveReload(browser);
    const pixiFallback = await runPixiFallback(browser);
    const report = {
      schemaVersion: 1,
      batch: "CHAMPIONSHIP_2026_VS1_INT_RH2",
      generatedAt: new Date().toISOString(),
      rendererPolicy: { dom: "P1R screen UI", pixi: "one field-scoped Application", three: "not used" },
      viewports,
      saveReload,
      pixiFallback,
      outcome: "PASS"
    };
    fs.writeFileSync(path.join(OUTPUT, "INT_RH2_BROWSER_QA.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`INT_RH2_BROWSER_QA_PASS viewports=${viewports.length} saveReload=true`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

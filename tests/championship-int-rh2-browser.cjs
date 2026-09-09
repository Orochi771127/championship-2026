const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { startGame, login, playOpening } = require("./championship-browser-opening.cjs");

const BASE_URL = process.env.CHAMPIONSHIP_QA_URL || "http://127.0.0.1:8732/championship.html";
const CHROME = process.env.CHAMPIONSHIP_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT = path.resolve("docs/reports/vs1");
const SCREENSHOTS = path.join(OUTPUT, "screenshots");
const RESPONSIVE_CONTRACT_PATH = path.resolve("docs/contracts/championship/INT_RH2_RUNTIME_PRESENTATION_CONTRACT.json");
const RESPONSIVE_CONTRACT = JSON.parse(fs.readFileSync(RESPONSIVE_CONTRACT_PATH, "utf8")).responsiveTargets;

function viewportName({ width, height }) {
  return `${width}x${height}`;
}

function parseViewport(value) {
  const match = /^(\d+)x(\d+)$/.exec(value);
  assert.ok(match, `invalid responsive contract viewport: ${value}`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

const REQUIRED_VIEWPORTS = RESPONSIVE_CONTRACT.mustPass.map(parseViewport);
const SUPPLEMENTAL_VIEWPORTS = [parseViewport("375x812")];
const VIEWPORTS = [...REQUIRED_VIEWPORTS, ...SUPPLEMENTAL_VIEWPORTS];

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
    // Product controls only, and only the ones actually on screen. Two kinds of
    // button are not player controls and must not be measured as if they were:
    // the ones inside a closed dialog (day-end confirm, lifecycle, mail letter),
    // which are display:none until their moment, and PixiJS's own accessibility
    // hook, a 1px body-level button parked at -1000,-1000. The shared toolbar is
    // mounted at body level, so it needs its own scope alongside the UI root.
    const interactive = [...document.querySelectorAll("#cm-root button:not(:disabled), .cm-toolbar button:not(:disabled)")]
      .filter((button) => button.checkVisibility())
      .map((button) => {
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
      // The 8-slot shell moved out of the P1R view on 2026-09-03: it is now the
      // shared body-level toolbar, which is where ui/toolbar.nxr belongs.
      toolbarSlots: document.querySelectorAll(".cm-toolbar__cell").length,
      toolbarEnabled: document.querySelectorAll(".cm-toolbar__cell:not(:disabled)").length,
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
  await startGame(page, { continueGame });
  await page.waitForSelector(".cm-raising-pixi-canvas", { timeout: 30000 });
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
  // The contract's slot count is still 8 and still ROM_VERIFIED; what changed is
  // that Raising tools are traced now, so the cells are reachable at Home. Hunt
  // is the context that blanks and disables them, and its own suite covers that.
  assert.equal(layout.toolbarEnabled, 8, "Raising Home reaches every toolbar slot");
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

  // The resident starts at the centre of the ranch ground. The old normalised
  // pair was authored for the CM-authored 24x14 field and pointed at bare floor
  // once the native ranch replaced it.
  const actor = { x: host.x + host.width * 0.5, y: host.y + host.height * 0.5 };
  const target = { x: host.x + host.width * 0.5, y: host.y + host.height * 0.58 };
  // Compared against the placeholder this run actually rendered rather than an
  // English literal, so the gate does not re-break every time the copy is
  // translated. The screen is Traditional Chinese now.
  const placeholderName = await page.locator(".int-rh2-companion__name").textContent();
  await page.mouse.click(actor.x, actor.y);
  await page.waitForFunction((placeholder) => document.querySelector(".int-rh2-companion__name")?.textContent !== placeholder, placeholderName);
  const selectedName = await page.locator(".int-rh2-companion__name").textContent();
  // No care click. The care affordance was withdrawn on 2026-09-03 because the
  // original tool semantics are UNKNOWN_REQUIRES_TRACE in OVL18, so nothing in
  // the UI reaches careForCreature today. The intent and its persistence are
  // still covered by the unit suite; asserting a button here only asserted that
  // a removed control was still present.
  const groundPosition = (target_) => target_.evaluate(() => {
    const stored = localStorage.getItem("championshipModernSave:v1");
    if (!stored) return null;
    const fields = JSON.parse(stored).creature.nativeProfile.fields;
    return { x: fields["1c0"], y: fields["1c4"], cageDefinition: fields["014"] };
  });
  const commit = async (target_) => {
    await target_.locator(".int-rh2-system-button").first().click();
    await target_.waitForFunction(() => document.querySelector(".int-rh2-system-button")?.dataset.phase === "SAVED");
  };
  await commit(page);
  const before = await groundPosition(page);

  // Relocation is a ground placement now, not a drop into a product cage: under
  // NATIVE_ANCHORS_V1 the field routes a completed drag to relocateToGround, and
  // only while the hand tool is held. The drag therefore moves the resident
  // inside the ranch and leaves its cage assignment alone.
  await page.locator(".cm-toolbar__cell").first().click();
  await page.mouse.move(actor.x, actor.y);
  await page.mouse.down();
  await page.mouse.move(target.x, target.y, { steps: 14 });
  await page.mouse.up();
  await commit(page);

  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem("championshipModernSave:v1")));
  assert.ok(saved, "save payload exists");
  const after = await groundPosition(page);
  assert.notDeepEqual(after, before, "the hand-tool drag moved the resident on the ranch ground");
  assert.equal(after.cageDefinition, before.cageDefinition, "a ground move is not a cage change");
  await page.screenshot({ path: path.join(SCREENSHOTS, "raising-home-390x844-before-reload.png"), fullPage: true });
  await page.close();

  const restored = await openRaising(context, { continueGame: true });
  const restoredPage = restored.page;
  assert.deepEqual(await groundPosition(restoredPage), after, "the relocated ground position survives a real page reload");
  const restoredHost = await restoredPage.locator(".int-rh2-field-host").boundingBox();
  // Where the drag left it, not where it started: the restored position is the
  // thing under test, so the gate has to reach for the resident there.
  const restoredActor = { x: restoredHost.x + restoredHost.width * 0.5, y: restoredHost.y + restoredHost.height * 0.58 };
  const restoredPlaceholder = await restoredPage.locator(".int-rh2-companion__name").textContent();
  await restoredPage.mouse.click(restoredActor.x, restoredActor.y);
  await restoredPage.waitForFunction((placeholder) => document.querySelector(".int-rh2-companion__name")?.textContent !== placeholder, restoredPlaceholder);
  const restoredName = await restoredPage.locator(".int-rh2-companion__name").textContent();
  assert.equal(restoredName, selectedName, "same resident restored after real page reload");
  await restoredPage.screenshot({ path: path.join(SCREENSHOTS, "raising-home-390x844-restored.png"), fullPage: true });

  const result = {
    viewport: "390x844",
    selectedResident: selectedName,
    relocatedOnGround: { from: before, to: after },
    careAffordance: "WITHDRAWN_PENDING_OVL18_TRACE",
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
  await login(page);
  // The opening is DOM-only, so it still runs when the field cannot.
  await playOpening(page);
  await page.waitForSelector(".int-rh2-field-fallback");
  assert.equal(await page.locator("canvas").count(), 0, "failed Pixi bootstrap creates no partial canvas");
  assert.equal(await page.locator(".int-rh2-system-button").first().isEnabled(), true, "save remains available in field fallback");
  // The toolbar is mounted by the application, not by the field, so a failed
  // Pixi bootstrap must not take it down with the canvas.
  assert.equal(await page.locator(".cm-toolbar__cell").count(), 8, "toolbar survives the field fallback");
  assert.equal(await page.locator(".cm-toolbar__cell:not(:disabled)").count(), 8, "toolbar stays reachable in fallback");
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
    const passedViewportNames = new Set(viewports.map(({ viewport }) => viewport));
    const missingRequiredViewports = REQUIRED_VIEWPORTS
      .map(viewportName)
      .filter((viewport) => !passedViewportNames.has(viewport));
    assert.deepEqual(missingRequiredViewports, [], "all responsive contract viewports passed");
    const saveReload = await runSaveReload(browser);
    const pixiFallback = await runPixiFallback(browser);
    const report = {
      schemaVersion: 1,
      batch: "CHAMPIONSHIP_2026_VS1_INT_RH2",
      generatedAt: new Date().toISOString(),
      rendererPolicy: { dom: "P1R screen UI", pixi: "one field-scoped Application", three: "not used" },
      responsiveContract: {
        source: path.relative(process.cwd(), RESPONSIVE_CONTRACT_PATH).replaceAll("\\", "/"),
        requiredViewports: REQUIRED_VIEWPORTS.map(viewportName),
        supplementalViewports: SUPPLEMENTAL_VIEWPORTS.map(viewportName),
        missingRequiredViewports
      },
      viewports,
      saveReload,
      pixiFallback,
      outcome: "PASS"
    };
    fs.writeFileSync(path.join(OUTPUT, "INT_RH2_BROWSER_QA.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(`INT_RH2_BROWSER_QA_PASS viewports=${viewports.length} required=${REQUIRED_VIEWPORTS.length} saveReload=true`);
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

// VS3 browser gate -- enclosure gesture to Hunt Result, no Capture button.
//
// Walks New Game -> list-selected Canyon -> Hunt field, draws a closed loop
// around the first wild, and asserts Hunt Result copy. Original capture odds
// stay untraced; this proves the translated field gesture is reachable.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { openFreshGame, openHunt, captureOneWild, leaveHuntField, RAISING_HOME } = require("./championship-browser-opening.cjs");

const BASE_URL = process.env.CHAMPIONSHIP_QA_URL || "http://127.0.0.1:8732/championship.html";
const CHROME = process.env.CHAMPIONSHIP_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT = path.resolve("docs/reports/vs3");
const SCREENSHOTS = path.join(OUTPUT, "screenshots");
const VIEWPORT = { width: 390, height: 844 };

fs.mkdirSync(SCREENSHOTS, { recursive: true });

(async () => {
  const { listChampionshipGates } = await import("../src/championship/gate/gateCatalog.js");
  const { createHuntWorld } = await import("../src/championship/hunt/huntWorld.js");

  // The gate a fresh tamer can actually walk into: rank 0 and 0 Bits only pass
  // the fee-free, initially-available row of the ROM's gate table. Taking the
  // first row instead charged 450 Bits and needed rank 3, so the confirm button
  // was correctly disabled and the capture flow never started.
  const entryGate = listChampionshipGates().find((gate) => gate.entranceFeeBits === 0 && gate.unlockKind === 0);
  assert.ok(entryGate, "the catalog must offer one fee-free initial gate");
  // The gate's spawn table is no longer what fills the field -- the native
  // controller owns the wilds -- so it is kept only to assert the gate is a
  // populated one before the browser is even launched.
  const world = createHuntWorld(entryGate);
  assert.ok(world.wildCreatures[0], `${entryGate.gateId} must spawn a wild creature`);

  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const problems = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") problems.push(`console: ${message.text()}`); });

  try {
    // Developer Mode publishes the live actor positions this gate has to aim at:
    // the native controller owns the wilds and moves them every frame, so
    // nothing outside the running field can work out where they are.
    const join = BASE_URL.includes("?") ? "&" : "?";
    await openFreshGame(page, `${BASE_URL}${join}gateMode=fallback&presentation=developer`);
    await page.waitForSelector(RAISING_HOME, { timeout: 20000 });
    const residentCountBefore = await page.locator("[data-resident-count]").getAttribute("data-resident-count");
    await openHunt(page);
    await page.locator(`.cm-vs2-gates [data-gate-id="${entryGate.gateId}"]`).click();
    await page.locator(".cm-vs2-footer .cm-vs2-action--primary").click();
    await page.waitForSelector("[data-screen='HUNT_LOADOUT']", { timeout: 15000 });
    // The rope tool is disabled until one is equipped, and the rope is what
    // binds a target: an empty loadout can reach the field but cannot capture.
    await page.locator('[data-equipment-class="ROPE"] [data-item-id]').first().click();
    await page.locator(".cm-vs2-footer .cm-vs2-action--primary").click();
    await page.waitForSelector("[data-screen='HUNT_FIELD']", { timeout: 20000 });
    const canvas = page.locator(".cm-vs2-field__canvas canvas");
    await canvas.waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(200);

    // The field hint is the tool system's now, and it is Traditional Chinese:
    // the default movement/grab line, replaced per tool once one is selected.
    // "Draw a circle" survives as the ROPE tool's own hint, not the default.
    const hint = await page.locator(".cm-vs2-field__hint").innerText();
    assert.match(hint, /拖曳地面移動視野/);
    assert.doesNotMatch(await page.locator("#cm-root").innerText(), /\bCAPTURE\b/);

    const canvasBox = await canvas.boundingBox();
    assert.ok(canvasBox && canvasBox.height > 200, "Hunt field canvas is too small");

    await page.screenshot({ path: path.join(SCREENSHOTS, "vs3-hunt-field-before-loop-390x844.png") });

    // The capture is the native four-stage gesture now, not a single loop drawn
    // on open ground: pan a wandering target back into the camera, bind it with
    // a small fast rope loop, hold the rope taut until it goes down, then take
    // it by hand. championship-browser-opening.cjs carries the gestures and why
    // each one is shaped the way it is. Binding is chancy because the target
    // keeps moving, so the helper retries whole attempts.
    const capturedWildId = await captureOneWild(page, canvasBox, { attempts: 40 });
    await page.screenshot({ path: path.join(SCREENSHOTS, "vs3-hunt-after-loop-390x844.png") });
    assert.ok(capturedWildId, `no wild reached the memory card. canvas=${Math.round(canvasBox.width)}x${Math.round(canvasBox.height)}`);

    const leftField = await leaveHuntField(page);
    assert.equal(leftField, "HUNT_RESULT", "a wild on the card must open Hunt Result on the way out");
    const resultText = await page.locator("#cm-root").innerText();
    assert.doesNotMatch(resultText, /CAPTURE/);
    assert.equal(await page.locator("[data-cm-name-edit]").count(), 1);
    await page.locator("[data-cm-name-edit]").fill("Ember");
    await page.screenshot({ path: path.join(SCREENSHOTS, "vs3-hunt-result-390x844.png") });

    const residentsBefore = Number(residentCountBefore);
    await page.locator(".cm-vs2-action--primary").click();
    await page.waitForSelector(RAISING_HOME, { timeout: 15000 });
    await page.waitForSelector("[data-resident-count]", { timeout: 15000 });
    const residentCount = await page.locator("[data-resident-count]").getAttribute("data-resident-count");
    assert.equal(Number(residentCount), residentsBefore + 1, "enclosed instance must appear at Raising Home");
    await page.screenshot({ path: path.join(SCREENSHOTS, "vs3-returned-home-390x844.png") });

    assert.deepEqual(problems, [], "console or page errors");
    const report = {
      gate: "CHAMPIONSHIP_VS3_ENCLOSURE_BROWSER_QA",
      date: new Date().toISOString(),
      baseUrl: BASE_URL,
      viewport: `${VIEWPORT.width}x${VIEWPORT.height}`,
      selectedGateId: entryGate.gateId,
      capturedWildId,
      captureButtonPresent: false,
      verdict: "PASS"
    };
    fs.writeFileSync(path.join(OUTPUT, "VS3_BROWSER_QA.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log("CHAMPIONSHIP_VS3_ENCLOSURE_BROWSER_QA_PASS");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(`CHAMPIONSHIP_VS3_ENCLOSURE_BROWSER_QA_FAIL: ${error.stack || error.message}`);
  process.exit(1);
});

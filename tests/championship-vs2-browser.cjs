// VS2 browser gate.
//
// Walks the authorized VS2 flow in real Chromium at every contract viewport:
// Raising Home -> Gate Select -> Hunt Loadout -> Hunt Field -> explore -> exit ->
// Raising Home. It proves the things a unit test cannot: that one Pixi
// Application survives three screen changes, that the field actually paints, and
// that no viewport scrolls sideways.
//
// Kept separate from the INT-RH2 gate so the VS1 presentation lane and the VS2
// runtime lane can fail independently.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const BASE_URL = process.env.CHAMPIONSHIP_QA_URL || "http://127.0.0.1:8732/championship.html";
const CHROME = process.env.CHAMPIONSHIP_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT = path.resolve("docs/reports/vs2");
const SCREENSHOTS = path.join(OUTPUT, "screenshots");
const CONTRACT_PATH = path.resolve("docs/contracts/championship/VS2_GATE_HUNT_RUNTIME_PRESENTATION_CONTRACT.json");
const CONTRACT = JSON.parse(fs.readFileSync(CONTRACT_PATH, "utf8"));

function parseViewport(value) {
  const match = /^(\d+)x(\d+)$/.exec(value);
  assert.ok(match, `invalid contract viewport: ${value}`);
  return { width: Number(match[1]), height: Number(match[2]) };
}

const VIEWPORTS = CONTRACT.responsiveTargets.mustPass.map(parseViewport);

fs.mkdirSync(SCREENSHOTS, { recursive: true });

function name({ width, height }) {
  return `${width}x${height}`;
}

async function walk(browser, viewport, { capture }) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const problems = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") problems.push(`console: ${message.text()}`); });

  const shot = async (step) => {
    if (capture) await page.screenshot({ path: path.join(SCREENSHOTS, `vs2-${step}-${name(viewport)}.png`) });
  };

  await page.goto(BASE_URL, { waitUntil: "networkidle" });
  await page.evaluate(() => window.localStorage.clear());
  await page.reload({ waitUntil: "networkidle" });

  await page.click("#cm-new-game");
  await page.waitForSelector("#cm-root.int-rh2-root", { timeout: 20000 });
  await page.waitForSelector(".cm-vs2-entry", { timeout: 20000 });
  await page.waitForTimeout(500);
  await shot("1-raising");

  // --- Gate Select ---------------------------------------------------------
  await page.click(".cm-vs2-entry");
  await page.waitForSelector("[data-screen='GATE_SELECT']", { timeout: 15000 });
  const gates = await page.locator(".cm-vs2-gate").count();
  assert.equal(gates, 16, `${name(viewport)}: gate count`);
  const confirm = page.locator(".cm-vs2-actions .cm-button--primary");
  assert.equal(await confirm.isDisabled(), true, `${name(viewport)}: confirm must start gated`);
  await page.locator(".cm-vs2-gate").nth(2).click();
  assert.equal(await confirm.isDisabled(), false, `${name(viewport)}: confirm must enable on selection`);
  await shot("2-gates");

  // --- Hunt Loadout --------------------------------------------------------
  await confirm.click();
  await page.waitForSelector("[data-screen='HUNT_LOADOUT']", { timeout: 15000 });
  const begin = page.locator(".cm-vs2-actions .cm-button--primary");
  assert.equal(await begin.isDisabled(), true, `${name(viewport)}: begin must start gated`);
  assert.ok(await page.locator(".cm-vs2-member").count() >= 1, `${name(viewport)}: party is empty`);
  await page.locator(".cm-vs2-member").first().click();
  assert.equal(await begin.isDisabled(), false, `${name(viewport)}: begin must enable on companion`);
  await shot("3-loadout");

  // --- Hunt Field ----------------------------------------------------------
  await begin.click();
  await page.waitForSelector("[data-screen='HUNT_FIELD']", { timeout: 20000 });
  await page.waitForTimeout(900);

  const canvases = await page.locator("canvas").count();
  assert.equal(canvases, 1, `${name(viewport)}: exactly one Pixi canvas must exist`);
  const fallback = await page.evaluate(() => document.getElementById("cm-root").dataset.fieldFallback ?? "none");
  assert.equal(fallback, "none", `${name(viewport)}: the field fell back instead of rendering`);

  const slots = await page.locator(".cm-vs2-slot").count();
  const disabled = await page.locator(".cm-vs2-slot[disabled]").count();
  assert.equal(slots, 8, `${name(viewport)}: ROM-verified slot count`);
  assert.equal(disabled, 8, `${name(viewport)}: every slot must stay disabled`);
  await shot("4-field");

  // --- Explore -------------------------------------------------------------
  const canvasBox = await page.locator(".cm-vs2-field__canvas").boundingBox();
  assert.ok(canvasBox.height > 200, `${name(viewport)}: the field has no room to render`);
  await page.mouse.click(canvasBox.x + canvasBox.width * 0.75, canvasBox.y + canvasBox.height * 0.7);
  await page.waitForTimeout(1600);
  await shot("5-explored");

  const overflow = await page.evaluate(() =>
    document.documentElement.scrollWidth > document.documentElement.clientWidth + 1);
  assert.equal(overflow, false, `${name(viewport)}: the page scrolls horizontally`);

  // --- Return --------------------------------------------------------------
  await page.locator(".cm-vs2-hud__exit").click();
  await page.waitForSelector(".cm-vs2-entry", { timeout: 15000 });
  await page.waitForTimeout(600);
  const canvasesAfter = await page.locator("canvas").count();
  assert.equal(canvasesAfter, 1, `${name(viewport)}: the stage was rebuilt instead of re-attached`);
  await shot("6-returned");

  // The Raising slice is intact on return: the save key is still the only one.
  const keys = await page.evaluate(() => Object.keys(window.localStorage));
  assert.deepEqual(keys.filter((key) => key !== "championshipModernSave:v1"), [],
    `${name(viewport)}: a second storage key appeared`);

  assert.deepEqual(problems, [], `${name(viewport)}: console or page errors`);
  await context.close();
  return { viewport: name(viewport), gates, slots, canvases };
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const results = [];
  try {
    for (const viewport of VIEWPORTS) {
      // Screenshots at the contract reference viewport only. The other four are
      // asserted just as hard; capturing all five would add a megabyte of
      // near-identical evidence to every run.
      results.push(await walk(browser, viewport, { capture: name(viewport) === CONTRACT.responsiveTargets.reference }));
    }
  } finally {
    await browser.close();
  }

  const report = {
    gate: "CHAMPIONSHIP_VS2_BROWSER_QA",
    date: new Date().toISOString(),
    baseUrl: BASE_URL,
    contract: `${CONTRACT.contractId}/${CONTRACT.version}`,
    requiredViewports: CONTRACT.responsiveTargets.mustPass,
    results,
    invariants: {
      pixiApplicationsPerScreen: 1,
      stageRebuiltOnScreenChange: false,
      toolbarSlots: 8,
      toolbarSlotsBound: 0,
      storageKeys: ["championshipModernSave:v1"]
    },
    verdict: "PASS"
  };
  fs.writeFileSync(path.join(OUTPUT, "VS2_BROWSER_QA.json"), `${JSON.stringify(report, null, 2)}\n`);
  console.log(`CHAMPIONSHIP_VS2_BROWSER_QA_PASS viewports=${results.length} required=${VIEWPORTS.length}`);
})().catch((error) => {
  console.error(`CHAMPIONSHIP_VS2_BROWSER_QA_FAIL: ${error.message}`);
  process.exit(1);
});

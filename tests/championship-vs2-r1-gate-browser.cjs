// VS2-R1 Owner evidence gate for the bounded Three.js Gate presentation.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { openFreshGame, openHunt, selectEnterableGate, RAISING_HOME, GATE_CONFIRM } = require("./championship-browser-opening.cjs");

const BASE_URL = process.env.CHAMPIONSHIP_QA_URL || "http://127.0.0.1:8732/championship.html";
const CHROME = process.env.CHAMPIONSHIP_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT = path.resolve("docs/reports/vs2-r1");
const SCREENSHOTS = path.join(OUTPUT, "screenshots");
const VIEWPORTS = [{ width: 390, height: 844 }, { width: 393, height: 852 }];
fs.mkdirSync(SCREENSHOTS, { recursive: true });

function viewportName(viewport) { return `${viewport.width}x${viewport.height}`; }

async function openGate(page, url = BASE_URL) {
  await openFreshGame(page, url);
  await page.waitForSelector(RAISING_HOME, { timeout: 20000 });
  await openHunt(page);
}

async function inspectGate(page, viewport) {
  return page.evaluate(({ width, height }) => {
    const root = document.getElementById("cm-root");
    const shell = root.querySelector(".cm-vs2-shell").getBoundingClientRect();
    const host = root.querySelector(".cm-vs2-gate3d__host").getBoundingClientRect();
    const visibleNodes = [...root.querySelectorAll(".cm-vs2-gate3d__node-hit")]
      .filter((node) => !node.hidden && node.getBoundingClientRect().width >= 44).length;
    return {
      viewport: `${width}x${height}`,
      screen: root.dataset.screen,
      presentationMode: root.dataset.presentationMode,
      gatePresentation: root.dataset.gatePresentation,
      uiAuthority: root.dataset.uiAuthority,
      rendererCount: root.querySelectorAll("canvas[data-renderer='THREE_BOUNDED_GATE_SELECT']").length,
      fallbackCards: root.querySelectorAll(".cm-vs2-gate").length,
      visibleNodes,
      shell: { width: Math.round(shell.width), height: Math.round(shell.height) },
      worldViewport: { width: Math.round(host.width), height: Math.round(host.height) },
      overflowX: document.documentElement.scrollWidth > document.documentElement.clientWidth + 1,
      forbiddenPlayerEvidence: /ROM VERIFIED|RAW_SLOT|UNKNOWN_REQUIRES_TRACE|PRODUCT_AUTHORED_TECHNICAL_PLACEHOLDER/i.test(root.innerText)
    };
  }, viewport);
}

async function runWorldFlow(browser, viewport) {
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const problems = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") problems.push(`console: ${message.text()}`); });
  await openGate(page);

  const name = viewportName(viewport);
  const before = await inspectGate(page, viewport);
  assert.equal(before.screen, "GATE_SELECT");
  assert.equal(before.presentationMode, "PLAYER_MODE");
  assert.equal(before.gatePresentation, "THREE_BOUNDED_WORLD_MODE");
  assert.equal(before.uiAuthority, "CHAMPIONSHIP_MODERN_UI_SYSTEM_P1R");
  assert.equal(before.rendererCount, 1);
  assert.equal(before.fallbackCards, 16);
  assert.ok(before.visibleNodes >= 1);
  assert.ok(before.worldViewport.height >= 260, `${name}: world camera viewport collapsed`);
  assert.equal(before.overflowX, false);
  assert.equal(before.forbiddenPlayerEvidence, false);
  await page.screenshot({ path: path.join(SCREENSHOTS, `gate-world-${name}.png`) });

  const canvas = page.locator(".cm-vs2-gate3d__canvas");
  const box = await canvas.boundingBox();
  await page.mouse.move(box.x + (box.width * 0.72), box.y + (box.height * 0.48));
  await page.mouse.down();
  await page.mouse.move(box.x + (box.width * 0.28), box.y + (box.height * 0.38), { steps: 12 });
  await page.mouse.up();
  await page.waitForTimeout(120);
  if (name === "390x844") await page.screenshot({ path: path.join(SCREENSHOTS, "gate-world-rotated-390x844.png") });

  const selectedGateId = await selectEnterableGate(page);
  assert.equal(await page.locator(GATE_CONFIRM).isDisabled(), false);
  assert.equal(await page.locator(`.cm-vs2-gate3d__node-hit[data-gate-id='${selectedGateId}']`).getAttribute("data-selected"), "true");
  await page.screenshot({ path: path.join(SCREENSHOTS, `gate-destination-selected-${name}.png`) });

  await page.locator(".cm-vs2-footer .cm-vs2-action--primary").click();
  await page.waitForSelector("[data-screen='HUNT_LOADOUT']", { timeout: 15000 });
  assert.equal(await page.locator("canvas[data-renderer='THREE_BOUNDED_GATE_SELECT']").count(), 0,
    `${name}: bounded Gate renderer survived screen disposal`);
  // VS2-R2 replaced the companion party with the recovered loadout structure:
  // five equipment classes and four plugin positions.
  assert.equal(await page.locator("[data-equipment-class]").count(), 5,
    `${name}: transition did not reach the Hunt Loadout structure`);
  assert.equal(await page.locator("[data-plugin-position]").count(), 4,
    `${name}: the four recovered plugin positions are missing`);
  await page.screenshot({ path: path.join(SCREENSHOTS, `gate-to-loadout-${name}.png`) });

  const keys = await page.evaluate(() => Object.keys(localStorage));
  assert.deepEqual(keys.filter((key) => key !== "championshipModernSave:v1"), []);
  assert.deepEqual(problems, []);
  await context.close();
  return { ...before, selectedGateId, threeRendererAfterTransition: 0, storageKeys: keys, verdict: "PASS" };
}

async function runFallback(browser) {
  const viewport = VIEWPORTS[0];
  const context = await browser.newContext({ viewport, deviceScaleFactor: 2 });
  const page = await context.newPage();
  const join = BASE_URL.includes("?") ? "&" : "?";
  await openGate(page, `${BASE_URL}${join}gateMode=fallback`);
  assert.equal(await page.locator("#cm-root").getAttribute("data-gate-presentation"), "ACCESSIBILITY_FALLBACK");
  assert.equal(await page.locator("canvas[data-renderer='THREE_BOUNDED_GATE_SELECT']").count(), 0,
    "low-graphics fallback mounted Three.js");
  assert.equal(await page.locator(".cm-vs2-gate").count(), 16);
  assert.equal(await page.locator(".cm-vs2-gate-fallback").isVisible(), true);
  await page.screenshot({ path: path.join(SCREENSHOTS, "gate-2d-fallback-390x844.png") });
  // Same admission rule as the world flow: a fixed card index lands on whatever
  // gate happens to sit there, and most are rank- or fee-locked for a new tamer.
  await selectEnterableGate(page, { selector: ".cm-vs2-gate" });
  assert.equal(await page.locator(GATE_CONFIRM).isDisabled(), false);
  await context.close();
  return { viewport: "390x844", rendererCount: 0, destinations: 16, selectionIntentBound: true, verdict: "PASS" };
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  try {
    const worldFlows = [];
    for (const viewport of VIEWPORTS) worldFlows.push(await runWorldFlow(browser, viewport));
    const fallback = await runFallback(browser);
    const report = {
      gate: "VS2_R1_GATE_3D_BROWSER_QA",
      date: new Date().toISOString(),
      checkpoint: "419f8ee",
      viewports: VIEWPORTS.map(viewportName),
      worldFlows,
      fallback,
      claims: {
        originalRotationParity: false,
        interactionParameters: "PRODUCT_AUTHORED_TECHNICAL_PLACEHOLDER",
        exactOriginalCamera: "NOT_CLAIMED",
        exactOriginalDisplayOrder: "NOT_CLAIMED"
      },
      verdict: "PASS"
    };
    fs.writeFileSync(path.join(OUTPUT, "VS2_R1_GATE_3D_BROWSER_QA.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log("VS2_R1_GATE_3D_BROWSER_QA_PASS viewports=2 fallback=PASS");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(`VS2_R1_GATE_3D_BROWSER_QA_FAIL: ${error.stack || error.message}`);
  process.exit(1);
});

// VS3 browser gate -- enclosure gesture to Hunt Result, no Capture button.
//
// Walks New Game -> list-selected Canyon -> Hunt field, draws a closed loop
// around the first wild, and asserts Hunt Result copy. Original capture odds
// stay untraced; this proves the translated field gesture is reachable.

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");

const BASE_URL = process.env.CHAMPIONSHIP_QA_URL || "http://127.0.0.1:8732/championship.html";
const CHROME = process.env.CHAMPIONSHIP_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT = path.resolve("docs/reports/vs3");
const SCREENSHOTS = path.join(OUTPUT, "screenshots");
const VIEWPORT = { width: 390, height: 844 };

fs.mkdirSync(SCREENSHOTS, { recursive: true });

(async () => {
  const { listChampionshipGates } = await import("../src/championship/gate/gateCatalog.js");
  const { createHuntWorld } = await import("../src/championship/hunt/huntWorld.js");

  const canyon = listChampionshipGates()[0];
  const world = createHuntWorld(canyon);
  const wild = world.wildCreatures[0];
  assert.ok(wild, "Canyon must spawn a wild creature");

  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const problems = [];
  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => { if (message.type() === "error") problems.push(`console: ${message.text()}`); });

  try {
    await page.goto(`${BASE_URL}${BASE_URL.includes("?") ? "&" : "?"}gateMode=fallback`, { waitUntil: "networkidle" });
    await page.evaluate(() => window.localStorage.clear());
    await page.reload({ waitUntil: "networkidle" });

    await page.click("#cm-new-game");
    await page.waitForSelector(".cm-vs2-entry", { timeout: 20000 });
    await page.click(".cm-vs2-entry");
    await page.waitForSelector("[data-screen='GATE_SELECT']", { timeout: 15000 });
    await page.locator(`.cm-vs2-gates [data-gate-id="${canyon.gateId}"]`).click();
    await page.locator(".cm-vs2-footer .cm-vs2-action--primary").click();
    await page.waitForSelector("[data-screen='HUNT_LOADOUT']", { timeout: 15000 });
    await page.locator(".cm-vs2-footer .cm-vs2-action--primary").click();
    await page.waitForSelector("[data-screen='HUNT_FIELD']", { timeout: 20000 });
    const canvas = page.locator(".cm-vs2-field__canvas canvas");
    await canvas.waitFor({ state: "visible", timeout: 10000 });
    await page.waitForTimeout(200);

    const hint = await page.locator(".cm-vs2-field__hint").innerText();
    assert.match(hint, /DRAW A CIRCLE/i);
    assert.doesNotMatch(await page.locator("#cm-root").innerText(), /\bCAPTURE\b/);

    const canvasBox = await canvas.boundingBox();
    assert.ok(canvasBox && canvasBox.height > 200, "Hunt field canvas is too small");

    async function drawAround(screenX, screenY, radius = 36) {
      await page.evaluate(({ sx, sy, radius: r }) => {
        const canvas = document.querySelector(".cm-vs2-field__canvas canvas");
        if (!canvas) throw new Error("Hunt canvas missing");
        const rect = canvas.getBoundingClientRect();
        const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
        const fire = (type, x, y) => {
          const clientX = rect.left + clamp(x, 4, rect.width - 4);
          const clientY = rect.top + clamp(y, 4, rect.height - 4);
          canvas.dispatchEvent(new PointerEvent(type, {
            bubbles: true,
            cancelable: true,
            composed: true,
            pointerId: 1,
            pointerType: "mouse",
            isPrimary: true,
            clientX,
            clientY,
            screenX: clientX,
            screenY: clientY,
            buttons: type === "pointerup" ? 0 : 1,
            button: 0
          }));
        };
        const path = [
          [sx, sy],
          [sx + r, sy],
          [sx + r, sy + r],
          [sx - r, sy + r],
          [sx - r, sy - r],
          [sx + r, sy - r],
          [sx + 2, sy + 2]
        ];
        fire("pointerdown", path[0][0], path[0][1]);
        for (let index = 1; index < path.length; index += 1) {
          fire("pointermove", path[index][0], path[index][1]);
        }
        fire("pointerup", path[path.length - 1][0], path[path.length - 1][1]);
      }, { sx: screenX, sy: screenY, radius });
    }

    await page.screenshot({ path: path.join(SCREENSHOTS, "vs3-hunt-field-before-loop-390x844.png") });

    let enclosed = false;
    for (const candidate of world.wildCreatures) {
      const screenX = canvasBox.width / 2 + (candidate.worldX - world.spawn.x);
      const screenY = canvasBox.height / 2 + (candidate.worldY - world.spawn.y);
      if (screenX < 28 || screenY < 28 || screenX > canvasBox.width - 28 || screenY > canvasBox.height - 28) continue;
      await drawAround(screenX, screenY);
      try {
        await page.waitForSelector("[data-screen='HUNT_RESULT']", { timeout: 1500 });
        enclosed = true;
        break;
      } catch {
        // This candidate was off the body or the loop did not close; try the next visible wild.
      }
    }
    await page.screenshot({ path: path.join(SCREENSHOTS, "vs3-hunt-after-loop-390x844.png") });
    assert.equal(enclosed, true, `enclosure did not open Hunt Result. canvas=${Math.round(canvasBox.width)}x${Math.round(canvasBox.height)}`);
    const resultText = await page.locator("#cm-root").innerText();
    assert.match(resultText, /HUNT RESULT/);
    assert.match(resultText, /BROUGHT HOME/);
    assert.doesNotMatch(resultText, /\bCAPTURE\b/);
    assert.equal(await page.locator("[data-cm-name-edit]").count(), 1);
    await page.locator("[data-cm-name-edit]").fill("Ember");
    await page.screenshot({ path: path.join(SCREENSHOTS, "vs3-hunt-result-390x844.png") });

    await page.locator(".cm-vs2-action--primary").click();
    await page.waitForSelector(".cm-vs2-entry", { timeout: 15000 });
    await page.waitForSelector("[data-resident-count]", { timeout: 15000 });
    const residentCount = await page.locator("[data-resident-count]").getAttribute("data-resident-count");
    assert.equal(residentCount, "4", "enclosed instance must appear at Raising Home");
    await page.screenshot({ path: path.join(SCREENSHOTS, "vs3-returned-home-390x844.png") });

    assert.deepEqual(problems, [], "console or page errors");
    const report = {
      gate: "CHAMPIONSHIP_VS3_ENCLOSURE_BROWSER_QA",
      date: new Date().toISOString(),
      baseUrl: BASE_URL,
      viewport: `${VIEWPORT.width}x${VIEWPORT.height}`,
      selectedGateId: canyon.gateId,
      wildSpeciesId: wild.speciesId,
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

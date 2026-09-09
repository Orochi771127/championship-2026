const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const { openFreshGame, openHunt, selectEnterableGate, RAISING_HOME } = require("./championship-browser-opening.cjs");

const RAW_BASE_URL = process.env.CHAMPIONSHIP_QA_URL || "http://127.0.0.1:8732/championship.html";
const BASE_URL = `${RAW_BASE_URL}${RAW_BASE_URL.includes("?") ? "&" : "?"}characterArtReview=m201`;
const CHROME = process.env.CHAMPIONSHIP_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";
const OUTPUT = path.resolve("docs/reports/characters/m201-remix-v1");
const VIEWPORT = { width: 390, height: 844 };

fs.mkdirSync(OUTPUT, { recursive: true });

function inspectViewport(page, screen) {
  return page.evaluate((screenName) => {
    const root = document.getElementById("cm-root");
    const canvas = document.querySelector("canvas");
    const rect = canvas?.getBoundingClientRect();
    return {
      screen: screenName,
      documentWidth: document.documentElement.scrollWidth,
      documentHeight: document.documentElement.scrollHeight,
      canvasCount: document.querySelectorAll("canvas").length,
      canvasRect: rect ? { width: rect.width, height: rect.height, left: rect.left, top: rect.top } : null,
      fieldFallback: root?.dataset.fieldFallback ?? "none"
    };
  }, screen);
}

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  const context = await browser.newContext({ viewport: VIEWPORT, deviceScaleFactor: 1 });
  const page = await context.newPage();
  const problems = [];
  const reviewResponses = new Set();

  page.on("pageerror", (error) => problems.push(`pageerror: ${error.message}`));
  page.on("console", (message) => {
    if (message.type() === "error" || /CHARACTER_REVIEW_FALLBACK/.test(message.text())) {
      problems.push(`console: ${message.text()}`);
    }
  });
  page.on("response", (response) => {
    if (response.url().includes("/assets/production/internal-character-review/m201-remix-v1/")) {
      reviewResponses.add(new URL(response.url()).pathname.split("/").at(-1));
    }
  });

  try {
    await openFreshGame(page, BASE_URL);
    await page.waitForSelector(".cm-raising-pixi-canvas", { timeout: 20000 });
    await page.waitForTimeout(1200);

    const raising = await inspectViewport(page, "RAISING_HOME");
    assert.equal(raising.documentWidth, VIEWPORT.width, "Raising horizontal overflow");
    assert.ok(raising.documentHeight <= VIEWPORT.height, "Raising vertical overflow");
    assert.equal(raising.canvasCount, 1, "Raising owns exactly one Pixi canvas");
    assert.equal(raising.fieldFallback, "none", "M201 art fell back in Raising");
    assert.ok(raising.canvasRect.width > 0 && raising.canvasRect.height > 0, "Raising canvas is visible");
    await page.screenshot({ path: path.join(OUTPUT, "m201-raising-390x844.png"), fullPage: true });

    await openHunt(page);
    await page.waitForFunction(() => document.getElementById("cm-root")?.dataset.gatePresentation === "THREE_BOUNDED_WORLD_MODE");
    await selectEnterableGate(page);
    await page.locator(".cm-vs2-footer .cm-vs2-action--primary").click();
    await page.waitForSelector("[data-screen='HUNT_LOADOUT']", { timeout: 15000 });
    await page.locator(".cm-vs2-footer .cm-vs2-action--primary").click();
    await page.waitForSelector("[data-screen='HUNT_FIELD']", { timeout: 20000 });
    await page.waitForTimeout(1200);

    const hunt = await inspectViewport(page, "HUNT_FIELD");
    assert.equal(hunt.documentWidth, VIEWPORT.width, "Hunt horizontal overflow");
    assert.ok(hunt.documentHeight <= VIEWPORT.height, "Hunt vertical overflow");
    assert.equal(hunt.canvasCount, 1, "Hunt owns exactly one Pixi canvas");
    assert.equal(hunt.fieldFallback, "none", "M201 art fell back in Hunt");
    assert.ok(hunt.canvasRect.width > 0 && hunt.canvasRect.height > 200, "Hunt canvas is visible");
    await page.screenshot({ path: path.join(OUTPUT, "m201-hunt-390x844.png"), fullPage: true });

    for (const required of ["runtime.review.json", "main-review-atlas-00.json", "main-review-atlas-00.png"]) {
      assert.equal(reviewResponses.has(required), true, `${required} did not load in Chromium`);
    }
    assert.deepEqual(problems, []);

    const report = {
      schemaVersion: 1,
      viewport: "390x844",
      query: "characterArtReview=m201",
      raising,
      hunt,
      loadedReviewAssets: [...reviewResponses].sort(),
      pageProblems: problems,
      state: "PASS_INTERNAL_REVIEW_ONLY"
    };
    fs.writeFileSync(path.join(OUTPUT, "browser-qa.json"), `${JSON.stringify(report, null, 2)}\n`);
    console.log(JSON.stringify(report, null, 2));
  } finally {
    await context.close();
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

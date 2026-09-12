const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

const CHROME = process.env.CHAMPIONSHIP_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    // The page names its startup modules with <link rel="modulepreload"> so the
    // browser fetches them in one wave instead of discovering them import by
    // import; on the deployed site that is worth about 500ms of the wait before
    // LOGIN. The preload scanner acts on those links while the head is still
    // parsing, long before the guard below can refuse a file:// launch, and
    // every one of those fetches then fails the file:// cross-origin rule.
    //
    // That noise is the browser prefetching, not the page misbehaving: the game
    // never starts, so it never asks for any of it. What this gate is for is
    // that the guard refuses cleanly, so ignore exactly those failures and keep
    // asserting on everything else. Thrown errors stay unfiltered.
    const PRELOAD_NOISE = /blocked by CORS policy|net::ERR_FAILED/;
    const thrown = [];
    const errors = [];
    page.on("pageerror", (error) => thrown.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error" && !PRELOAD_NOISE.test(message.text())) errors.push(message.text());
    });
    await page.goto(pathToFileURL(path.resolve("championship.html")).href);
    assert.equal(await page.locator("#cm-new-game").isDisabled(), true);
    assert.equal(await page.locator("#cm-continue").isDisabled(), true);
    assert.match(await page.locator("#cm-title-note").textContent(), /START_CHAMPIONSHIP\.cmd/);
    assert.equal(await page.locator("html").getAttribute("data-launch-blocked"), "FILE_PROTOCOL");
    assert.deepEqual(thrown, []);
    assert.deepEqual(errors, []);
    console.log("CHAMPIONSHIP_FILE_LAUNCH_GUARD_PASS fileProtocolBlocked=true guidanceVisible=true");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(`CHAMPIONSHIP_FILE_LAUNCH_GUARD_FAIL: ${error.stack || error.message}`);
  process.exit(1);
});

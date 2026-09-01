const assert = require("node:assert/strict");
const path = require("node:path");
const { pathToFileURL } = require("node:url");
const { chromium } = require("playwright");

const CHROME = process.env.CHAMPIONSHIP_CHROME || "C:/Program Files/Google/Chrome/Application/chrome.exe";

(async () => {
  const browser = await chromium.launch({ headless: true, executablePath: CHROME });
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    page.on("console", (message) => {
      if (message.type() === "error") errors.push(message.text());
    });
    await page.goto(pathToFileURL(path.resolve("championship.html")).href);
    assert.equal(await page.locator("#cm-new-game").isDisabled(), true);
    assert.equal(await page.locator("#cm-continue").isDisabled(), true);
    assert.match(await page.locator("#cm-title-note").textContent(), /START_CHAMPIONSHIP\.cmd/);
    assert.equal(await page.locator("html").getAttribute("data-launch-blocked"), "FILE_PROTOCOL");
    assert.deepEqual(errors, []);
    console.log("CHAMPIONSHIP_FILE_LAUNCH_GUARD_PASS fileProtocolBlocked=true guidanceVisible=true");
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(`CHAMPIONSHIP_FILE_LAUNCH_GUARD_FAIL: ${error.stack || error.message}`);
  process.exit(1);
});

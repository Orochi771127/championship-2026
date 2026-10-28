// Dex holo showcase (Owner direction 2026-10-28), controlled browser gate.
// Phone portrait 390x844. Ten rounds of motion viewer, special preview and
// evolution preview, then: no new WebGL context, one reused sandbox, no
// showcase animation or overlay left behind, no storage write, no pageerror.
// Run against an isolated QA origin (CHAMPIONSHIP_QA_ORIGIN), never the
// Owner's own save origin.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { chromium } = require("playwright");
const output = require("./browser-qa-output.cjs")("codex-showcase");
fs.mkdirSync(output, { recursive: true });
const base = process.env.CHAMPIONSHIP_QA_ORIGIN || "http://127.0.0.1:8732";
const rounds = Number(process.env.SHOWCASE_ROUNDS || 10);

// Counts every WebGL context the page creates, before any page script runs.
function countContexts() {
  globalThis.__showcaseGl = { created: 0 };
  const original = HTMLCanvasElement.prototype.getContext;
  HTMLCanvasElement.prototype.getContext = function (kind, ...rest) {
    const context = original.call(this, kind, ...rest);
    if (context && /webgl/i.test(String(kind)) && !this.__showcaseCounted) { this.__showcaseCounted = true; globalThis.__showcaseGl.created++; }
    return context;
  };
}

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  page.setDefaultTimeout(90000);
  const errors = [];
  page.on("pageerror", error => errors.push(error.message));
  await page.addInitScript(countContexts);
  try {
    await page.goto(base + "/tests/fixtures/championship-owned-party.html");
    await page.locator("#prepare").click();
    await page.locator("#status").filter({ hasText: "受控存檔已準備" }).waitFor();
    await page.goto(base + "/championship.html");
    await page.locator("#cm-login").waitFor();
    if (await page.locator("#cm-film-skip").isVisible().catch(() => false)) await page.locator("#cm-film-skip").click();
    await page.waitForFunction(() => document.querySelector("#cm-login")?.disabled === false);
    await page.locator("#cm-login").click();
    await page.locator("#cm-continue").click();
    await page.locator('[data-screen="RAISING_HOME"]').waitFor();
    assert.notEqual(await page.evaluate(() => document.documentElement.dataset.theme), "classic", "the showcase belongs to the arcade themes");
    await page.locator('[data-entry-id="database"]').click();
    await page.locator('[data-screen="DATABASE"]').waitFor();
    await page.waitForFunction(() => document.querySelectorAll(".cm-vs2-database__row").length > 0);
    const registered = await page.evaluate(() => document.querySelector('.cm-vs2-database__row[data-state="REGISTERED"]')?.dataset.speciesIndex);
    assert.ok(registered, "the fixture registers a partner");
    await page.locator(`.cm-vs2-database__row[data-species-index="${registered}"]`).click();
    await page.locator(".cm-showcase-toggle").waitFor();
    const special = page.locator("[data-showcase=special]");
    const evolution = page.locator("[data-showcase=evolution]").first();
    assert.equal(await special.count(), 1, "能力與招式 has the special preview");
    assert.ok(await page.locator("[data-showcase=evolution]").count() >= 1, "each evolution route has a preview");
    await page.screenshot({ path: path.join(output, "detail.png") });

    const glBefore = await page.evaluate(() => globalThis.__showcaseGl.created);
    const storage = () => page.evaluate(() => JSON.stringify(Object.keys(localStorage).sort().map(key => [key, localStorage.getItem(key)])));
    const storageBefore = await storage();

    // Motion viewer: real atlas frames, a turn and every action.
    await page.locator(".cm-showcase-toggle__option[data-view=motion]").click();
    await page.locator(".cm-showcase-motion__controls:not([hidden])").waitFor({ timeout: 30000 });
    const facing = await page.locator(".cm-sprite").getAttribute("data-facing");
    await page.locator(".cm-showcase-motion__turn").click();
    assert.notEqual(await page.locator(".cm-sprite").getAttribute("data-facing"), facing, "turn flips the facing");
    for (const action of ["walk", "attack", "cheer", "stand"]) {
      await page.locator(`.cm-showcase-motion__action[data-action=${action}]`).click();
      assert.equal(await page.locator(`.cm-showcase-motion__action[data-action=${action}]`).getAttribute("aria-pressed"), "true");
    }
    await page.screenshot({ path: path.join(output, "motion.png") });

    // Special: wind-up, cut-in strip, contact and the number, then replay.
    await special.click();
    await page.locator(".cm-showcase .cm-cutin").waitFor({ timeout: 5000 });
    await page.screenshot({ path: path.join(output, "special-cutin.png") });
    await page.locator(".cm-showcase__damage").waitFor({ timeout: 5000 });
    await page.locator(".cm-showcase__replay:not([hidden])").waitFor({ timeout: 5000 });
    await page.locator(".cm-showcase__close").click();
    assert.equal(await page.locator(".cm-showcase").isHidden(), true);

    // Evolution: the shared runner in preview mode; tap settles, tap leaves.
    await evolution.click();
    await page.locator(".cm-showcase .cm-morph").waitFor({ timeout: 5000 });
    await page.waitForTimeout(1200);
    await page.screenshot({ path: path.join(output, "evolution.png") });
    await page.locator(".cm-morph").click();
    await page.locator(".cm-morph").click();
    await page.locator(".cm-showcase__replay:not([hidden])").waitFor({ timeout: 5000 });
    await page.locator(".cm-showcase__close").click();

    for (let round = 0; round < rounds; round++) {
      await page.locator(".cm-showcase-toggle__option[data-view=portrait]").click();
      await page.locator(".cm-showcase-toggle__option[data-view=motion]").click();
      await page.locator(".cm-showcase-motion__turn").click();
      await page.locator(".cm-showcase-motion__action[data-action=attack]").click();
      await special.click();
      await page.waitForTimeout(500 + (round % 3) * 300);
      await page.locator(".cm-showcase__close").click();
      await evolution.click();
      await page.waitForTimeout(400 + (round % 4) * 250);
      await page.locator(".cm-showcase__close").click();
    }
    await page.locator(".cm-showcase-toggle__option[data-view=portrait]").click();
    const settled = await page.evaluate(() => ({
      gl: globalThis.__showcaseGl.created,
      sandboxes: document.querySelectorAll(".cm-showcase").length,
      overlays: document.querySelectorAll(".cm-showcase .cm-morph, .cm-showcase .cm-cutin, .cm-showcase__fx > *").length,
      running: document.getAnimations().filter(a => a.playState === "running" && a.effect?.target?.closest?.(".cm-showcase, .cm-showcase-motion")).length
    }));
    assert.equal(settled.gl, glBefore, "previews never create a WebGL context");
    assert.equal(settled.sandboxes, 1, "one sandbox node, reused");
    assert.equal(settled.overlays, 0, "closing leaves no runner, strip or effect node");
    assert.equal(settled.running, 0, "no showcase animation keeps running behind the portrait");
    assert.equal(await storage(), storageBefore, "previews write nothing to the save or settings");

    // Encrypted signal: a viewable but unregistered partner.
    await page.locator(".cm-vs2-database__close").click();
    const lockedIndex = await page.evaluate(() => [...document.querySelectorAll(".cm-vs2-database__row")]
      .find(row => row.dataset.state === "UNDISCOVERED" && Number(row.dataset.speciesIndex) >= 30)?.dataset.speciesIndex);
    let locked = null;
    if (lockedIndex) {
      await page.locator(`.cm-vs2-database__row[data-species-index="${lockedIndex}"]`).click();
      const button = page.locator("[data-showcase=special][data-encrypted=true]");
      if (await button.count()) {
        assert.equal(await page.locator(".cm-showcase-toggle").count(), 0, "motion is for registered partners");
        await button.click();
        await page.locator(".cm-showcase__note:not([hidden])").waitFor({ timeout: 6000 });
        locked = await page.evaluate(() => ({ note: document.querySelector(".cm-showcase__note").textContent,
          colourArt: document.querySelectorAll(".cm-showcase__stage img").length }));
        assert.match(locked.note, /🔒/);
        assert.equal(locked.colourArt, 0, "an encrypted preview shows no colour art");
        await page.screenshot({ path: path.join(output, "encrypted.png") });
        await page.locator(".cm-showcase__close").click();
      }
    }

    // Leaving the Dex releases the sandbox with the screen.
    await page.locator(".cm-vs2-database__close").click().catch(() => {});
    await page.locator(".cm-vs2-footer .cm-vs2-action").click();
    await page.locator('[data-screen="RAISING_HOME"]').waitFor();
    assert.equal(await page.locator(".cm-showcase").count(), 0, "the sandbox leaves with the Dex");
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(output, "result.json"), JSON.stringify({ passed: true, rounds, glBefore, settled, locked, errors }, null, 2));
    console.log("CHAMPIONSHIP_CODEX_SHOWCASE_BROWSER_PASS");
  } catch (error) {
    await page.screenshot({ path: path.join(output, "failure.png") }).catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

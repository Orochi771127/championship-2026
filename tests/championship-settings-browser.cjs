// Settings gate (settings round, 2026-09-29).
//
// Normal flow only: the title's settings button, or Continue and the toolbar's
// System menu. The existing QA-save installer prepares legal progress; nothing
// here writes game state. Preferences are changed through the settings screen
// itself, except for the storage-failure case, which blocks writes to check
// what the player is told. Run against an isolated origin (CHAMPIONSHIP_QA_ORIGIN),
// never the player's own.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { login } = require('./championship-browser-opening.cjs');

// The gate installs the QA save, which replaces the save on that origin, so it
// never falls back to a default: name an isolated origin, and the player's own
// 8732 origin is refused outright.
const origin = process.env.CHAMPIONSHIP_QA_ORIGIN;
if (!origin || /:8732(\/|$)/.test(origin)) {
  console.error('Set CHAMPIONSHIP_QA_ORIGIN to an isolated origin, e.g. http://127.0.0.1:8761. The player\'s 8732 origin is refused.');
  process.exit(2);
}
const output = require('./browser-qa-output.cjs')('settings');
const SAVE_KEY = 'championshipModernSave:v1';
const PREFS_KEY = 'championshipModernSave:preferences:v1';
fs.mkdirSync(output, { recursive: true });
const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), origin, physicalDeviceAccepted: false, checks: {} };

function watch(page) {
  const problems = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  // A failed load is reported by the response listener with its URL; the
  // console line carries no URL, so it is not counted twice.
  page.on('console', (message) => { if (message.type() === 'error' && !/Failed to load resource/.test(message.text())) problems.push(`console: ${message.text()}`); });
  page.on('response', (response) => { if (response.status() >= 400 && !/favicon\.ico$/.test(response.url())) problems.push(`${response.status()} ${response.url()}`); });
  return problems;
}
async function installQaSave(page) {
  await page.goto(`${origin}/full-qa-save.html`, { waitUntil: 'networkidle' });
  await page.getByText('QA 存檔已驗證，可以安裝。', { exact: true }).waitFor();
  await Promise.all([page.waitForURL(/\/championship\.html$/), page.locator('#install').click()]);
}
// Home is ready when its mount has finished, not when its canvas first shows:
// on a slow link (the live site, 2026-10-04) the screen attribute followed the
// canvas by a second or more.
async function home(page) {
  await page.locator('.cm-raising-pixi-canvas').waitFor({ timeout: 45000 });
  await page.waitForFunction(() => document.getElementById('cm-root')?.dataset.activeScreen === 'RAISING_HOME', null, { timeout: 45000 });
}
const html = (page) => page.evaluate(() => ({ ...document.documentElement.dataset, lang: document.documentElement.lang }));
const stored = (page, key) => page.evaluate((k) => localStorage.getItem(k), key);
const pick = (page, id, value) => page.locator(`input[name="cm-setting-${id}"][value="${value}"]`).check({ force: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    // ---- 1. Title: open, theme and language apply at once, persist, and boot before paint ----
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
      const page = await context.newPage();
      const problems = watch(page);
      await installQaSave(page);
      const saveBefore = await stored(page, SAVE_KEY);
      assert.ok(saveBefore, 'the QA save is installed');
      assert.equal(await stored(page, PREFS_KEY), null, 'no preferences are written by just opening the game');
      await page.click('#cm-title-settings');
      const dialog = page.locator('dialog.cm-settings');
      await dialog.waitFor();
      assert.equal(await dialog.getAttribute('data-view'), 'list', 'a phone starts on the category list');
      await page.locator('.cm-settings__category[data-category="appearance"]').click();
      await pick(page, 'theme', 'warm');
      assert.equal((await html(page)).theme, 'warm', 'the theme applies without a reload');
      assert.equal(await page.evaluate(() => getComputedStyle(document.body).backgroundColor !== ''), true);
      await pick(page, 'textScale', '130');
      assert.equal((await html(page)).textScale, '130');
      // Escape steps back to the list, twice in a row still steps (never closes by accident).
      await page.keyboard.press('Escape');
      assert.equal(await dialog.getAttribute('data-view'), 'list');
      await page.locator('.cm-settings__category[data-category="language"]').click();
      await pick(page, 'locale', 'en');
      assert.equal((await html(page)).lang, 'en');
      assert.equal(await page.locator('#cm-settings-title').innerText(), 'Language', 'the panel itself switched language');
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      assert.equal(await dialog.count(), 0, 'Escape from the list closes the panel');
      assert.equal(await page.locator('#cm-login').isVisible(), true, 'the title is exactly where it was');
      await page.waitForTimeout(500);
      const prefs = JSON.parse(await stored(page, PREFS_KEY));
      assert.deepEqual(prefs.account, { theme: 'warm', locale: 'en' });
      assert.deepEqual(prefs.device, { textScale: 130 });
      assert.equal(await stored(page, SAVE_KEY), saveBefore, 'the game save is untouched by settings');
      // A reload applies the saved theme before the first paint: the boot
      // script has set the attributes by the time the first stylesheet parses.
      await page.reload({ waitUntil: 'domcontentloaded' });
      const early = await page.evaluate(() => ({ theme: document.documentElement.dataset.theme, lang: document.documentElement.lang, scale: document.documentElement.dataset.textScale }));
      assert.deepEqual(early, { theme: 'warm', lang: 'en', scale: '130' });
      await page.screenshot({ path: path.join(output, 'title-warm-en.png') });
      assert.deepEqual(problems, []);
      report.checks.titlePersistence = { prefs, early };
      await context.close();
    }

    // ---- 2. In game: the System menu entry, back button, relabel in place, reset keeps progress ----
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
      const page = await context.newPage();
      const problems = watch(page);
      await installQaSave(page);
      await login(page);
      await page.click('#cm-continue');
      await home(page);
      const canvasBefore = await page.evaluate(() => { window.__qaCanvas = document.querySelector('.cm-raising-pixi-canvas'); return true; });
      assert.ok(canvasBefore);
      await page.locator('button[data-menu-id="SYSTEM"]').click();
      await page.locator('[data-entry-id="settings"]').click();
      const dialog = page.locator('dialog.cm-settings');
      await dialog.waitFor();
      // The dialog is modal: the habitat underneath cannot be touched.
      assert.equal(await page.evaluate(() => document.querySelector('#cm-root').matches(':not(:modal)') && !!document.querySelector('dialog.cm-settings:modal')), true);
      await page.locator('.cm-settings__category[data-category="language"]').click();
      await pick(page, 'locale', 'en');
      // The browser/Android back button steps back, then closes.
      await page.goBack().catch(() => {});
      await page.waitForTimeout(300);
      assert.equal(await dialog.getAttribute('data-view'), 'list', 'back from a category returns to the list');
      await page.goBack().catch(() => {});
      await page.waitForTimeout(300);
      assert.equal(await dialog.count(), 0, 'back from the list closes the panel');
      assert.match(page.url(), /championship\.html$/, 'and never leaves the game');
      const relabel = await page.evaluate(() => ({
        sameCanvas: document.querySelector('.cm-raising-pixi-canvas') === window.__qaCanvas,
        screen: document.getElementById('cm-root').dataset.activeScreen,
        toolbar: [...document.querySelectorAll('.cm-toolbar__cell-label')].map((n) => n.textContent),
        day: document.querySelector('.cm-status-bar__day').textContent
      }));
      assert.equal(relabel.sameCanvas, true, 'the language switch relabels in place: the habitat was not remounted');
      assert.equal(relabel.screen, 'RAISING_HOME');
      assert.deepEqual(relabel.toolbar, ['Hand', 'Feed', 'Protein', 'Clean', 'Salve', 'Meds', 'Manage', 'Menu']);
      assert.match(relabel.day, /^Day/);
      // The shop's screen-reader labels follow the language too (2026-10-04
      // acceptance: they stayed in Chinese).
      await page.locator('button[data-menu-id="SYSTEM"]').click();
      await page.locator('[data-entry-id="shop"]').click();
      await page.waitForFunction(() => document.getElementById('cm-root')?.dataset.activeScreen === 'SHOP');
      const shopLabels = await page.evaluate(() => ['.cm-vs2-shop__tabs', '.cm-vs2-shop__arrow--previous', '.cm-vs2-shop__list', '.cm-vs2-shop__arrow--next']
        .map((selector) => document.querySelector(selector)?.getAttribute('aria-label')));
      assert.deepEqual(shopLabels, ['Item categories', 'Previous item', 'Items', 'Next item']);
      await page.getByRole('button', { name: 'Back to ranch', exact: true }).click();
      await home(page);
      const saveBefore = await stored(page, SAVE_KEY);
      await page.locator('button[data-menu-id="SYSTEM"]').click();
      await page.locator('[data-entry-id="settings"]').click();
      await dialog.waitFor();
      await page.locator('.cm-settings__category[data-category="data"]').click();
      await page.locator('.cm-settings__action--danger').click();
      await page.locator('dialog.cm-dialog [data-action="reset"]').click();
      await page.waitForTimeout(600);
      assert.equal((await html(page)).lang, 'zh-Hant', 'reset brings the default language back');
      const afterReset = await stored(page, SAVE_KEY);
      assert.equal(JSON.parse(afterReset).progression.revision >= JSON.parse(saveBefore).progression.revision, true, 'progress is never rolled back by a reset');
      assert.equal(JSON.parse(afterReset).shop.bits, JSON.parse(saveBefore).shop.bits, 'and the wallet is the same');
      await page.screenshot({ path: path.join(output, 'reset-data.png') });
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      assert.deepEqual(problems, []);
      report.checks.inGame = relabel;
      await context.close();
    }

    // ---- 3. Storage refuses writes: the panel says so and offers a retry ----
    {
      const context = await browser.newContext({ viewport: { width: 1024, height: 1366 } });
      await context.addInitScript(() => {
        const real = Storage.prototype.setItem;
        Storage.prototype.setItem = function setItem(key, value) {
          if (key === 'championshipModernSave:preferences:v1' && !window.__qaAllowPrefs) throw new DOMException('QuotaExceededError', 'QuotaExceededError');
          return real.call(this, key, value);
        };
      });
      const page = await context.newPage();
      const problems = watch(page);
      await installQaSave(page);
      await page.click('#cm-title-settings');
      await page.locator('dialog.cm-settings').waitFor();
      assert.equal(await page.locator('dialog.cm-settings').getAttribute('data-view'), 'detail', 'a tablet opens on a category beside the list');
      assert.equal(await page.locator('.cm-settings__nav').isVisible(), true);
      await pick(page, 'theme', 'clear');
      assert.equal((await html(page)).theme, 'clear', 'the choice applies even if it cannot be kept');
      await page.waitForTimeout(500);
      await page.locator('.cm-settings__category[data-category="data"]').click();
      const line = page.locator('.cm-settings__text[data-phase="SAVE_FAILED"]');
      await line.waitFor();
      await page.screenshot({ path: path.join(output, 'storage-failed.png') });
      await page.evaluate(() => { window.__qaAllowPrefs = true; });
      await page.locator('.cm-settings__action', { hasText: '再試一次' }).click();
      await page.locator('.cm-settings__text[data-phase="SAVED"]').waitFor();
      assert.equal(JSON.parse(await stored(page, PREFS_KEY)).account.theme, 'clear', 'the retry wrote the settings');
      assert.deepEqual(problems, []);
      report.checks.storageFailure = 'reported and retried';
      await context.close();
    }

    // ---- 4. A volume slider follows a full drag (2026-10-04 acceptance: the
    //         page was rebuilt under the finger and only the first step held) ----
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
      const page = await context.newPage();
      const problems = watch(page);
      await page.goto(`${origin}/championship.html`, { waitUntil: 'domcontentloaded' });
      await page.click('#cm-title-settings');
      await page.locator('.cm-settings__category[data-category="sound"]').click();
      const slider = page.locator('input[type="range"][name="cm-setting-masterVolume"], .cm-setting[data-setting="masterVolume"] input[type="range"]').first();
      await slider.waitFor();
      await page.evaluate(() => { window.__qaSlider = document.querySelector('.cm-setting[data-setting="masterVolume"] input[type="range"]'); });
      const box = await slider.boundingBox();
      const y = box.y + box.height / 2;
      await page.mouse.move(box.x + box.width - 2, y);
      await page.mouse.down();
      for (let step = 1; step <= 12; step += 1) await page.mouse.move(box.x + box.width - 2 - (box.width * 0.8 * step) / 12, y);
      await page.mouse.up();
      await page.waitForTimeout(500);
      const after = await page.evaluate(() => ({ same: document.querySelector('.cm-setting[data-setting="masterVolume"] input[type="range"]') === window.__qaSlider, value: Number(window.__qaSlider.value) }));
      assert.equal(after.same, true, 'the slider under the pointer is never replaced while it moves');
      assert.ok(after.value <= 35, `the drag reached its end (value ${after.value})`);
      assert.equal(JSON.parse(await stored(page, PREFS_KEY)).device.masterVolume, after.value, 'and the dragged value is the one kept');
      assert.deepEqual(problems, []);
      report.checks.sliderDrag = after;
      await context.close();
    }

    // ---- 5. Retro blue & gold: the earlier skin dresses the game only while
    //         it is the chosen theme (Owner 2026-10-04) ----
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
      const page = await context.newPage();
      const problems = watch(page);
      await installQaSave(page);
      await login(page);
      await page.click('#cm-continue');
      await home(page);
      const ribbon = () => page.evaluate(() => getComputedStyle(document.querySelector('.cm-status-bar')).backgroundImage);
      const plain = await ribbon();
      await page.locator('button[data-menu-id="SYSTEM"]').click();
      await page.locator('[data-entry-id="settings"]').click();
      await page.locator('.cm-settings__category[data-category="appearance"]').click();
      await pick(page, 'theme', 'classic');
      assert.equal((await html(page)).theme, 'classic');
      const dressed = await ribbon();
      assert.match(dressed, /^linear-gradient\(rgb\(255, 246, 168\) 0%/, 'the status bar becomes the gold ribbon');
      assert.notEqual(dressed, plain);
      assert.equal(await page.locator('.cm-setting[data-setting="theme"] input[value="classic"]').evaluate((input) => input.closest('label').textContent.includes('復古藍金')), true, 'it is offered under its own name');
      await pick(page, 'theme', 'night');
      assert.equal(await ribbon(), plain, 'and leaves nothing behind when another theme is chosen');
      await page.keyboard.press('Escape');
      await page.keyboard.press('Escape');
      assert.deepEqual(problems, []);
      report.checks.retroTheme = { plain, dressed: dressed.slice(0, 60) };
      await context.close();
    }
    report.verdict = 'PASS';
  } catch (error) {
    report.verdict = 'FAIL';
    report.error = error.stack;
    throw error;
  } finally {
    fs.writeFileSync(path.join(output, 'settings-report.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });

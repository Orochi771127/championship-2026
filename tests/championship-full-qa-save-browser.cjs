const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const output = require('./browser-qa-output.cjs')('full-qa-save');
const origin = process.env.CHAMPIONSHIP_QA_ORIGIN || 'http://127.0.0.1:8732';
const saveKey = 'championshipModernSave:v1';

fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    acceptDownloads: true
  });
  const page = await context.newPage();
  page.setDefaultTimeout(90000);
  const pageErrors = [];
  page.on('pageerror', (error) => pageErrors.push(error.message));

  try {
    await page.goto(`${origin}/full-qa-save.html`, { waitUntil: 'networkidle' });
    await page.getByText('QA 存檔已驗證，可以安裝。', { exact: true }).waitFor();
    assert.equal(await page.locator('#install').isEnabled(), true);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);

    const previous = JSON.stringify({ browserQaPreviousSave: true });
    await page.evaluate(([key, value]) => localStorage.setItem(key, value), [saveKey, previous]);
    const downloadPromise = page.waitForEvent('download');
    const navigationPromise = page.waitForURL(/\/championship\.html$/);
    await page.locator('#install').click();
    const backup = await downloadPromise;
    const backupPath = path.join(output, 'previous-save-backup.json');
    await backup.saveAs(backupPath);
    assert.equal(fs.readFileSync(backupPath, 'utf8'), previous);
    assert.match(backup.suggestedFilename(), /^championship-backup-\d+\.json$/);
    await navigationPromise;

    const installed = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), saveKey);
    assert.equal(installed.schemaVersion, 5);
    assert.equal(installed.shop.bits, 9999999);
    assert.equal(installed.raising.collection.length, 5);
    assert.equal(installed.progression.battleBadges.length, 62);
    assert.equal(installed.progression.registeredSpecies.length, 216);

    await page.locator('#cm-login').click();
    await page.locator('#cm-continue').click();
    await page.locator('[data-screen="RAISING_HOME"]').waitFor();
    const afterContinue = await page.evaluate((key) => JSON.parse(localStorage.getItem(key)), saveKey);
    assert.equal(afterContinue.raising.collection.length, 5, 'continue must preserve the installed collection');
    await page.locator('button[data-menu-id="MANAGEMENT"]').click();
    await page.locator('[data-entry-id="digimon"]').click();
    await page.locator('[data-screen="DIGIMON_LIST"]').waitFor();
    await page.locator('.cm-digimon-list').waitFor();
    const names = await page.locator('.cm-digimon-item__name').allTextContents();
    const ultimateNames = ['戰鬥暴龍獸', '閃光暴龍獸', '黑暗戰鬥暴龍獸', '鋼鐵加魯魯獸', '公爵獸'];
    assert.ok(ultimateNames.every((name) => names.includes(name)));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    await page.screenshot({ path: path.join(output, 'mobile-roster.png'), fullPage: true });
    assert.deepEqual(pageErrors, []);

    const result = {
      passed: true,
      viewport: '390x844',
      origin,
      backupDownloaded: true,
      schemaVersion: installed.schemaVersion,
      bits: installed.shop.bits,
      residents: names,
      badges: installed.progression.battleBadges.length,
      registeredSpecies: installed.progression.registeredSpecies.length,
      pageErrors
    };
    fs.writeFileSync(path.join(output, 'result.json'), `${JSON.stringify(result, null, 2)}\n`);
    console.log('CHAMPIONSHIP_FULL_QA_SAVE_BROWSER_PASS');
  } catch (error) {
    await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

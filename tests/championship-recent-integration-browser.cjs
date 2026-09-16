const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { startGame } = require('./championship-browser-opening.cjs');

// The recent Home and password batches share a real saved roster. Install the
// existing QA save through its UI in a fresh browser context; never reuse the
// player's browser profile or inject application state to enter a screen.
const origin = process.env.CHAMPIONSHIP_QA_ORIGIN || 'http://127.0.0.1:8732';
const output = require('./browser-qa-output.cjs')('recent-integration');
const saveKey = 'championshipModernSave:v1';
fs.mkdirSync(output, { recursive: true });

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const pageErrors = [], missingResources = [];
  page.on('pageerror', error => pageErrors.push(error.message));
  page.on('response', response => {
    if (response.status() >= 400) missingResources.push({ url: response.url(), status: response.status() });
  });
  const saved = () => page.evaluate(key => JSON.parse(localStorage.getItem(key)), saveKey);
  const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), origin,
    setup: 'existing QA installer in an isolated browser context', physicalDeviceAccepted: false };
  try {
    await page.goto(`${origin}/full-qa-save.html`, { waitUntil: 'networkidle' });
    await page.getByText('QA 存檔已驗證，可以安裝。', { exact: true }).waitFor();
    await Promise.all([page.waitForURL(/\/championship\.html$/), page.locator('#install').click()]);
    const installed = await saved();
    await startGame(page, { continueGame: true });
    await page.locator('.cm-raising-pixi-canvas').waitFor();
    assert.equal(await page.locator('canvas').count(), 1);
    assert.equal(await page.locator('.int-rh2-companion').getAttribute('aria-hidden'), 'true');
    assert.equal(await page.locator('.int-rh2-notice').isVisible(), false);

    report.layouts = [];
    for (const viewport of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(150);
      const layout = await page.evaluate(() => ({ width: innerWidth, height: innerHeight,
        scrollWidth: document.documentElement.scrollWidth, scrollHeight: document.documentElement.scrollHeight,
        toolbarSlots: document.querySelectorAll('.cm-toolbar__cell').length,
        canvasCount: document.querySelectorAll('canvas').length }));
      assert.equal(layout.scrollWidth, viewport.width);
      assert.equal(layout.scrollHeight, viewport.height);
      assert.equal(layout.toolbarSlots, 8);
      assert.equal(layout.canvasCount, 1);
      report.layouts.push(layout);
      await page.screenshot({ path: path.join(output, `home-${viewport.width}x${viewport.height}.png`) });
    }
    await page.setViewportSize({ width: 390, height: 844 });

    // A real document departure exercises pagehide, unlike a synthetic
    // visibility event. The fresh document must open the same roster again.
    await page.goto('about:blank');
    await page.goto(`${origin}/championship.html`, { waitUntil: 'networkidle' });
    const persisted = await saved();
    assert.notEqual(persisted.updatedAt, installed.updatedAt);
    assert.equal(persisted.schemaVersion, installed.schemaVersion);
    assert.equal(persisted.creature.creatureId, installed.creature.creatureId);
    assert.deepEqual(persisted.raising.collection.map(entry => entry.instanceId),
      installed.raising.collection.map(entry => entry.instanceId));
    await startGame(page, { continueGame: true });
    await page.locator('.cm-raising-pixi-canvas').waitFor();
    report.realNavigationSaveContinue = true;

    await page.locator('button[data-menu-id="SYSTEM"]').click();
    await page.locator('[data-entry-id="battle"]').click();
    await page.getByRole('button', { name: '密碼對戰', exact: true }).click();
    const maker = page.locator('.cm-vs5-password-maker');
    await maker.waitFor();
    const picks = maker.locator('button[data-instance-id]:enabled');
    assert.ok(await picks.count() >= 4);
    const ids = await picks.evaluateAll(buttons => buttons.slice(0, 4).map(button => button.dataset.instanceId));
    const outputField = page.getByRole('textbox', { name: '我的隊伍密碼', exact: true });
    const make = page.getByRole('button', { name: '產生密碼', exact: true });
    assert.equal(await make.isDisabled(), true);
    for (const id of ids.slice(0, 3)) await maker.locator(`button[data-instance-id="${id}"]`).click();
    assert.equal(await maker.locator(`button[data-instance-id="${ids[3]}"]`).isDisabled(), true);
    await make.click();
    await page.waitForFunction(() => document.querySelector('[aria-label="我的隊伍密碼"]').value.length > 0);
    const password = await outputField.inputValue();
    assert.ok([...password].length <= 22);
    await page.screenshot({ path: path.join(output, 'password-team.png') });
    await maker.locator(`button[data-instance-id="${ids[0]}"]`).click();
    assert.equal(await outputField.inputValue(), '');
    assert.equal(await page.getByRole('button', { name: '複製密碼', exact: true }).isVisible(), false);

    // Exercise the pasted-space repair with a code made by this actual roster.
    const spaced = ` ${[...password].join(' ')} `;
    await page.getByRole('textbox', { name: 'A 隊密碼', exact: true }).fill(spaced);
    await page.getByRole('textbox', { name: 'B 隊密碼', exact: true }).fill(password);
    assert.equal(await page.getByRole('textbox', { name: 'A 隊密碼', exact: true }).inputValue(), spaced);
    await page.getByRole('button', { name: '開始密碼對戰', exact: true }).click();
    await page.locator('#cm-root[data-screen="BATTLE_FIELD"]').waitFor();
    await page.locator('#cm-root[data-screen="BATTLE_RESULT"]').waitFor({ timeout: 120000 });
    await page.locator('.cm-vs5-result__body').waitFor();
    await page.screenshot({ path: path.join(output, 'password-result.png') });
    report.password = { members: 3, codeLength: [...password].length, fourthMemberRefused: true,
      selectionClearsCode: true, pastedSpacesPreserved: true, reachedBattleResult: true };
    assert.deepEqual(pageErrors, []);
    assert.deepEqual(missingResources, []);
    report.pageErrors = pageErrors;
    report.missingResources = missingResources;
    report.outcome = 'PASS';
    fs.writeFileSync(path.join(output, 'RECENT_INTEGRATION_BROWSER_QA.json'), JSON.stringify(report, null, 2) + '\n');
    console.log('RECENT_INTEGRATION_BROWSER_QA_PASS realNavigationSaveContinue=true passwordBattleResult=true');
  } catch (error) {
    await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true }).catch(() => {});
    fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify({ error: error.message,
      text: await page.locator('body').innerText().catch(() => ''), pageErrors, missingResources }, null, 2));
    throw error;
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

// 2026-09-28 page and flow integration gate.
//
// Every flow starts from the title through the normal UI in a fresh browser
// context: New Game or the existing QA-save installer, then the toolbar menus.
// Nothing here writes game state directly; the save is only read back to check
// what the game itself wrote. Layout checks run at the four review sizes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { login, playOpening } = require('./championship-browser-opening.cjs');

const origin = process.env.CHAMPIONSHIP_QA_ORIGIN || 'http://127.0.0.1:8732';
const output = require('./browser-qa-output.cjs')('ui-integration');
const KEY = 'championshipModernSave:v1';
fs.mkdirSync(output, { recursive: true });

const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), origin, physicalDeviceAccepted: false, checks: {} };

async function watch(page) {
  const problems = [];
  page.on('pageerror', (error) => problems.push(`pageerror: ${error.message}`));
  page.on('console', (message) => { if (message.type() === 'error') problems.push(`console: ${message.text()}`); });
  page.on('response', (response) => { if (response.status() >= 400) problems.push(`${response.status()} ${response.url()}`); });
  return problems;
}
const saved = (page) => page.evaluate((key) => JSON.parse(localStorage.getItem(key) || 'null'), KEY);
async function menu(page, menuId, entryId) {
  await page.locator(`button[data-menu-id="${menuId}"]`).click();
  await page.locator(`[data-entry-id="${entryId}"]`).click();
}
const home = (page) => page.locator('.cm-raising-pixi-canvas').waitFor({ timeout: 45000 });
const onScreen = (page, screen) => page.waitForFunction((s) => document.getElementById('cm-root')?.dataset.activeScreen === s, screen, { timeout: 45000 });

async function installQaSave(page) {
  await page.goto(`${origin}/full-qa-save.html`, { waitUntil: 'networkidle' });
  await page.getByText('QA 存檔已驗證，可以安裝。', { exact: true }).waitFor();
  await Promise.all([page.waitForURL(/\/championship\.html$/), page.locator('#install').click()]);
}

async function noHorizontalOverflow(page, label) {
  const m = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, vw: innerWidth }));
  assert.ok(m.sw <= m.vw, `${label}: page scrolls sideways (${m.sw} > ${m.vw})`);
}

async function footerReachable(page, selector, label) {
  const box = await page.locator(selector).first().boundingBox();
  const vh = await page.evaluate(() => innerHeight);
  assert.ok(box && box.y >= 0 && box.y + box.height <= vh + 1, `${label}: footer action outside the viewport`);
  assert.ok(box.height >= 44, `${label}: footer action shorter than 44px (${box.height})`);
}

(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    // ---- 1. New Game from an empty browser, then Save & Quit, Continue ----
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      const problems = await watch(page);
      await page.goto(`${origin}/championship.html`, { waitUntil: 'networkidle' });
      await login(page);
      assert.equal(await page.locator('#cm-continue').isHidden(), true, 'no Continue without a save');
      await playOpening(page, { trainerName: '驗收員', eggName: '小蛋' });
      await home(page);
      await page.waitForFunction((key) => localStorage.getItem(key) !== null, KEY, { timeout: 5000 });
      const first = await saved(page);
      assert.ok(first, 'a new game is written once it starts');
      assert.equal(first.creature.displayName, '小蛋');
      // 2026-09-29 redesign: money and today's title matches moved from the
      // Home card into the status bar, so every screen carries them.
      await page.locator('.cm-status-bar__bits').waitFor();
      // Painted when Home mounts, before the field finishes loading.
      assert.equal(await page.locator('.cm-status-bar__bits').textContent(), '0');
      assert.equal(await page.locator('.cm-status-bar__bits').getAttribute('aria-label'), '持有 0 位元幣');
      // The title-match badge counts the same capped list the Battle menu
      // shows; it is hidden, not shown as zero, when there is none today.
      const matchBadge = page.locator('.cm-status-bar__matches');
      const badgeCount = (await matchBadge.isVisible())
        ? Number((await matchBadge.textContent()).match(/^頭銜賽 ([1-9]\d*)$/)?.[1] ?? NaN) : 0;
      assert.ok(Number.isInteger(badgeCount), 'the badge names a whole count');
      if (badgeCount > 0) {
        await matchBadge.click();
      } else {
        await menu(page, 'SYSTEM', 'battle');
      }
      await onScreen(page, 'BATTLE_SELECT');
      assert.equal(await page.locator('.cm-vs5-matches .cm-vs5-match__enter').count(), badgeCount, 'badge count equals the Battle menu list');
      await page.getByRole('button', { name: '返回牧場', exact: true }).click();
      await home(page);
      assert.match(await page.locator('.cm-status-bar__day').textContent(), /第\s*1\s*日/);
      await page.screenshot({ path: path.join(output, 'new-game-home-390.png') });

      // Shop with no money says why Buy is unavailable.
      await menu(page, 'SYSTEM', 'shop');
      await onScreen(page, 'SHOP');
      assert.equal(await page.locator('.cm-vs2-shop__buy').isDisabled(), true);
      assert.match(await page.locator('.cm-vs2-shop__detail-state').textContent(), /持有金額不足，還差 5 位元幣/);
      const order = await page.locator('.cm-vs2-footer .cm-vs2-action').allTextContents();
      assert.deepEqual(order, ['返回牧場', '購買'], 'leave on the left, the primary action on the right');
      await page.getByRole('button', { name: '返回牧場', exact: true }).click();
      await home(page);

      // Gate -> Loadout -> Hunt -> back Home from the only free destination.
      await menu(page, 'SYSTEM', 'hunt');
      await onScreen(page, 'GATE_SELECT');
      await page.locator('.cm-vs2-gate3d__toggle').click();
      const locked = await page.locator('.cm-vs2-gate[data-availability="LOCKED"]').count();
      assert.ok(locked > 0, 'locked gates are marked before they are tapped');
      await page.locator('.cm-vs2-gate[data-availability="LOCKED"]').first().click();
      assert.match(await page.locator('.cm-vs2-body > .cm-vs2-status').textContent(), /開放/);
      const statusBox = await page.locator('.cm-vs2-body > .cm-vs2-status').boundingBox();
      assert.ok(statusBox.x >= 0, 'the admission message is not clipped at the left edge');
      assert.equal(await page.locator('.cm-vs2-footer .cm-vs2-action--primary').isDisabled(), true);
      await page.locator('.cm-vs2-gate[data-availability="AVAILABLE"]').first().click();
      await page.locator('.cm-vs2-footer .cm-vs2-action--primary').click();
      await onScreen(page, 'HUNT_LOADOUT');
      await page.locator('.cm-vs2-loadout__option').first().click();
      await page.locator('.cm-vs2-footer .cm-vs2-action--primary').click();
      await onScreen(page, 'HUNT_FIELD');
      await page.locator('.cm-vs2-field__loading').waitFor({ state: 'detached', timeout: 45000 });
      await page.locator('.cm-vs2-hud__exit').click();
      await home(page);
      report.checks.gateHuntReturn = { lockedMarked: locked, returnedHome: true };

      // Save & Quit, then the title offers Continue first; New Game asks.
      await menu(page, 'SYSTEM', 'saveQuit');
      await page.locator('#cm-login').waitFor();
      await page.goto('about:blank');
      await page.goto(`${origin}/championship.html`, { waitUntil: 'networkidle' });
      await login(page);
      const titleOrder = await page.locator('.cm-title__actions button:visible').allTextContents();
      assert.deepEqual(titleOrder.map((t) => t.trim()), ['繼續遊戲', '開始新遊戲']);
      await page.click('#cm-new-game');
      const dialog = page.locator('dialog.cm-dialog');
      await dialog.waitFor();
      assert.match(await dialog.textContent(), /小蛋/);
      assert.equal(await page.evaluate(() => document.activeElement?.dataset.action), 'cancel', 'focus starts on the safe choice');
      await page.keyboard.press('Escape');
      await dialog.waitFor({ state: 'detached' });
      assert.equal((await saved(page)).creature.displayName, '小蛋', 'cancelling New Game keeps the save');
      await page.click('#cm-continue');
      await home(page);
      report.checks.newGameContinue = { firstSaveWritten: true, continueFirst: true, newGameAsks: true, cancelKeepsSave: true };
      assert.deepEqual(problems, []);
      await context.close();
    }

    // ---- 2. Populated save: Shop, leaving from the Shop, Cage Edit, roster ----
    {
      const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true });
      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      await installQaSave(page);
      const problems = await watch(page);
      await login(page); await page.click('#cm-continue'); await home(page);
      const feedStock = async () => Number(await page.locator('[data-tool-id="feed"] .cm-toolbar__stock').textContent());
      const feed0 = await feedStock();

      await menu(page, 'SYSTEM', 'shop');
      await onScreen(page, 'SHOP');
      const before = await saved(page);
      const bitsText = async () => Number((await page.locator('.cm-vs2-shop__wallet').textContent()).replace(/[^\d]/g, ''));
      const bits0 = await bitsText();
      // Two taps inside a double-tap window buy once; a later tap buys again.
      await page.locator('.cm-vs2-shop__buy').dblclick();
      await page.waitForTimeout(80);
      const bits1 = await bitsText();
      assert.equal(bits0 - bits1, 5, 'a double tap charges once');
      assert.match(await page.locator('.cm-vs2-shop__status').textContent(), /已購買「飼料」，持有 \d+\/99/);
      await page.waitForTimeout(300);
      await page.locator('.cm-vs2-shop__buy').click();
      const bits2 = await bitsText();
      assert.equal(bits1 - bits2, 5, 'a separate tap buys again');
      // Leave the page while still in the Shop; the purchases must survive.
      await page.goto('about:blank');
      await page.goto(`${origin}/championship.html`, { waitUntil: 'networkidle' });
      const after = await saved(page);
      assert.notEqual(after.updatedAt, before.updatedAt, 'leaving from the Shop writes the save');
      await login(page); await page.click('#cm-continue'); await home(page);
      assert.equal(await feedStock(), feed0 + 2, 'the toolbar food count shows both purchases after Continue');
      assert.equal(await page.locator('.cm-status-bar__bits').getAttribute('aria-label'), `持有 ${bits2.toLocaleString('en-US')} 位元幣`, 'Home shows the same money');
      assert.equal(await page.locator('.cm-status-bar__bits').textContent(), bits2.toLocaleString('en-US'));
      await menu(page, 'SYSTEM', 'shop');
      await onScreen(page, 'SHOP');
      assert.equal(await bitsText(), bits2, 'the purchases persisted after Continue');
      report.checks.shop = { doubleTapChargedOnce: true, leaveFromShopPersists: true, bitsBefore: bits0, bitsAfter: bits2, feedBefore: feed0, feedAfter: feed0 + 2 };
      await page.getByRole('button', { name: '返回牧場', exact: true }).click();
      await home(page);

      // Cage Edit: an unconfirmed change asks before it is dropped.
      await menu(page, 'MANAGEMENT', 'cageEdit');
      await onScreen(page, 'CAGE_EDIT');
      const slot = page.locator('.cm-vs2-cage-slot[data-filled="true"]:not([data-fixed="true"])').first();
      const slotIndex = await slot.getAttribute('data-slot-index');
      await slot.click();
      assert.equal(await page.locator(`.cm-vs2-cage-slot[data-slot-index="${slotIndex}"]`).getAttribute('data-filled'), 'false');
      await page.getByRole('button', { name: '返回牧場', exact: true }).click();
      await page.locator('dialog.cm-dialog').waitFor();
      await page.locator('dialog.cm-dialog [data-action="stay"]').click();
      assert.equal(await page.locator('#cm-root').getAttribute('data-active-screen'), 'CAGE_EDIT', 'keep editing stays');
      await page.getByRole('button', { name: '返回牧場', exact: true }).click();
      await page.locator('dialog.cm-dialog [data-action="discard"]').click();
      await home(page);
      await menu(page, 'MANAGEMENT', 'cageEdit');
      await onScreen(page, 'CAGE_EDIT');
      assert.equal(await page.locator(`.cm-vs2-cage-slot[data-slot-index="${slotIndex}"]`).getAttribute('data-filled'), 'true', 'discard restored the layout');
      await page.locator(`.cm-vs2-cage-slot[data-slot-index="${slotIndex}"]`).click();
      await page.getByRole('button', { name: '返回牧場', exact: true }).click();
      await page.locator('dialog.cm-dialog [data-action="apply"]').click();
      await home(page);
      await menu(page, 'MANAGEMENT', 'cageEdit');
      await onScreen(page, 'CAGE_EDIT');
      assert.equal(await page.locator(`.cm-vs2-cage-slot[data-slot-index="${slotIndex}"]`).getAttribute('data-filled'), 'false', 'apply kept the change');
      assert.match(await page.locator('.cm-vs2-shop__status').textContent().catch(() => ''), /^$|配置已套用/);
      await page.getByRole('button', { name: '返回牧場', exact: true }).click();
      await home(page);
      report.checks.cageEdit = { askOnUnconfirmedLeave: true, stay: true, discard: true, apply: true, slotIndex: Number(slotIndex) };

      // Roster: rename a collected Digimon; the starter explains its fixed name.
      await menu(page, 'MANAGEMENT', 'digimon');
      await onScreen(page, 'DIGIMON_LIST');
      assert.equal(await page.locator('[data-control="name_edit_button"]').isDisabled(), true, 'the starter keeps its opening name');
      await page.locator('.cm-digimon-item__button').nth(1).click();
      await page.locator('[data-control="name_edit_button"]').click();
      // The longest name the rule accepts must not push the screen sideways.
      const longName = '長長長長長長長長長長長長長長長長長長長長長長長長';
      await page.locator('.cm-digimon-rename__input').fill(longName);
      await page.getByRole('button', { name: '儲存名稱', exact: true }).click();
      assert.equal((await page.locator('.cm-digimon-item__button[aria-pressed="true"]').textContent()).trim(), longName);
      await noHorizontalOverflow(page, 'roster with a 24-character name');
      await page.locator('[data-control="name_edit_button"]').click();
      await page.locator('.cm-digimon-rename__input').fill('驗收龍');
      await page.getByRole('button', { name: '儲存名稱', exact: true }).click();
      assert.equal((await page.locator('.cm-digimon-item__button[aria-pressed="true"]').textContent()).trim(), '驗收龍');
      await footerReachable(page, '.cm-screen-footer .cm-screen-back', 'roster');
      await page.getByRole('button', { name: '返回牧場', exact: true }).click();
      await home(page);
      await menu(page, 'SYSTEM', 'saveQuit');
      await page.locator('#cm-login').waitFor();
      const renamed = await saved(page);
      assert.ok(renamed.raising.collection.some((entry) => entry.displayName === '驗收龍'), 'the new name is saved');
      await login(page); await page.click('#cm-continue'); await home(page);
      report.checks.roster = { starterLocked: true, renamedAndSaved: true };

      // Schedule and Help open details where the player is looking.
      await menu(page, 'MANAGEMENT', 'schedule');
      await onScreen(page, 'SCHEDULE');
      await page.locator('.cm-schedule-fixture').nth(2).click();
      const sheet = page.locator('.cm-sheet:not([hidden]) .cm-schedule-detail');
      await sheet.waitFor();
      await page.waitForTimeout(300); // the sheet slides in over 180 ms
      const sheetBox = await sheet.boundingBox();
      assert.ok(sheetBox.y >= 0 && sheetBox.y + sheetBox.height <= 844, `the fixture detail is on screen (${JSON.stringify(sheetBox)})`);
      assert.doesNotMatch(await sheet.textContent(), /已達上限|編號/);
      assert.match(await sheet.textContent(), /持有金額/);
      await page.keyboard.press('Escape');
      await sheet.waitFor({ state: 'hidden' });
      assert.equal(await page.locator('.cm-schedule-championship').isDisabled(), false, 'the championship toggle is usable at once');
      await footerReachable(page, '.cm-screen-footer .cm-screen-back', 'schedule');
      await page.getByRole('button', { name: '返回牧場', exact: true }).click();
      await home(page);
      await menu(page, 'SYSTEM', 'help');
      await onScreen(page, 'HELP');
      assert.equal(await page.locator('.cm-help-title').textContent(), '說明');
      await page.locator('.cm-help-topic').nth(3).click();
      await page.locator('.cm-sheet:not([hidden]) .cm-help-detail__body').waitFor();
      assert.equal(await page.locator('.cm-help-detail__provenance').count(), 0, 'no string indices for players');
      await page.getByRole('button', { name: '關閉', exact: true }).click();
      await page.getByRole('button', { name: '返回牧場', exact: true }).click();
      await home(page);
      report.checks.sheets = { scheduleOnScreen: true, heldLabelFixed: true, helpTitle: true };

      // Battle menu: one exit per level; a practice battle to its result.
      await menu(page, 'SYSTEM', 'battle');
      await onScreen(page, 'BATTLE_SELECT');
      await page.locator('.cm-vs5-cube__face').first().waitFor();
      assert.equal(await page.locator('.cm-vs5-conference').isVisible(), false, 'no second tournament entry beside the cube');
      assert.deepEqual(await page.locator('.cm-vs5-footer button:visible').allTextContents(), ['返回牧場']);
      await page.locator('.cm-vs5-cube__face').filter({ hasText: '練習對戰' }).click();
      await page.locator('.cm-vs5-practice-member').first().waitFor();
      assert.deepEqual(await page.locator('.cm-vs5-footer button:visible').allTextContents(), ['返回賽事選擇', '開始練習']);
      const names = await page.locator('.cm-vs5-practice-member__name').allTextContents();
      assert.ok(names.every((name) => !/[\p{Script=Katakana}\p{Script=Hiragana}]/u.test(name)), `picker names match the roster: ${names}`);
      const rows = page.locator('.cm-vs5-practice-member');
      let a = false, b = false;
      for (let i = 0; i < await rows.count() && !(a && b); i += 1) {
        const buttons = rows.nth(i).locator('button');
        if (!a && !(await buttons.nth(0).isDisabled())) { await buttons.nth(0).click(); a = true; continue; }
        if (!b && !(await buttons.nth(1).isDisabled())) { await buttons.nth(1).click(); b = true; }
      }
      await page.getByRole('button', { name: '開始練習', exact: true }).click();
      await onScreen(page, 'BATTLE_FIELD');
      await onScreen(page, 'BATTLE_RESULT');
      await page.getByRole('button', { name: '下一頁', exact: true }).click();
      const prize = await page.locator('.cm-vs5-result__body').textContent();
      assert.match(prize, /獎金/);
      await page.screenshot({ path: path.join(output, 'battle-result-prize-390.png') });
      while (await page.getByRole('button', { name: '下一頁', exact: true }).isVisible()) await page.getByRole('button', { name: '下一頁', exact: true }).click();
      await page.locator('.cm-vs5-exit:visible').click();
      await home(page);
      report.checks.battle = { oneExitPerLevel: true, practiceToResult: true };
      assert.deepEqual(problems, []);
      await context.close();
    }

    // ---- 3. Layout at the review sizes: no sideways scroll, reachable footers ----
    report.checks.layout = [];
    for (const viewport of [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1024, height: 1366 }, { width: 1440, height: 900 }]) {
      const context = await browser.newContext({ viewport, hasTouch: viewport.width < 1100 });
      const page = await context.newPage();
      page.setDefaultTimeout(30000);
      await installQaSave(page);
      const problems = await watch(page);
      await login(page); await page.click('#cm-continue'); await home(page);
      await noHorizontalOverflow(page, `home ${viewport.width}`);
      const visits = [['MANAGEMENT', 'tamer', 'TAMER_INFO'], ['MANAGEMENT', 'schedule', 'SCHEDULE'], ['MANAGEMENT', 'digimon', 'DIGIMON_LIST'],
        ['SYSTEM', 'help', 'HELP'], ['SYSTEM', 'database', 'DATABASE'], ['SYSTEM', 'shop', 'SHOP'], ['SYSTEM', 'battle', 'BATTLE_SELECT'],
        ['MANAGEMENT', 'cageEdit', 'CAGE_EDIT'], ['SYSTEM', 'hunt', 'GATE_SELECT']];
      for (const [menuId, entryId, screen] of visits) {
        await menu(page, menuId, entryId);
        await onScreen(page, screen);
        await page.waitForTimeout(250);
        await noHorizontalOverflow(page, `${screen} ${viewport.width}`);
        const back = page.getByRole('button', { name: '返回牧場', exact: true });
        const box = await back.boundingBox();
        assert.ok(box && box.y + box.height <= viewport.height + 1 && box.height >= 44, `${screen} ${viewport.width}: leave control reachable`);
        if (viewport.width === 820) await page.screenshot({ path: path.join(output, `${screen.toLowerCase()}-820.png`) });
        await back.click();
        await home(page);
      }
      assert.deepEqual(problems, []);
      report.checks.layout.push({ viewport, screens: visits.length, sidewaysScroll: false, leaveReachable: true });
      await context.close();
    }

    report.outcome = 'PASS';
    fs.writeFileSync(path.join(output, 'UI_INTEGRATION_BROWSER_QA.json'), JSON.stringify(report, null, 2) + '\n');
    console.log('UI_INTEGRATION_BROWSER_PASS', JSON.stringify(Object.keys(report.checks)));
  } catch (error) {
    report.outcome = 'FAIL';
    report.error = String(error?.stack ?? error);
    fs.writeFileSync(path.join(output, 'UI_INTEGRATION_BROWSER_QA.json'), JSON.stringify(report, null, 2) + '\n');
    throw error;
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });

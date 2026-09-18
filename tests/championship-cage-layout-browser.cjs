// Same screen instances, real input and canonical save. --baseline records the
// prior narrow layout using the identical journey, before the CSS is changed.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { chromium } = require('playwright');
const { startGame } = require('./championship-browser-opening.cjs');
const baseline = process.argv.includes('--baseline');
const base = process.env.CHAMPIONSHIP_QA_URL || 'http://127.0.0.1:8734/championship.html';
const output = require('./browser-qa-output.cjs')('cage-layout');
const sizes = [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1024, height: 1366 }];
const journey = [...sizes, sizes[1], sizes[0], sizes[2], sizes[0]];
const key = 'championshipModernSave:v1';
const host = '.int-rh2-field-host';
const hash = text => crypto.createHash('sha256').update(text).digest('hex');

async function actor(page) {
  const rows = await page.locator(host).evaluate(n => JSON.parse(n.dataset.residentScreenPositions || '[]'));
  const box = await page.locator(host).boundingBox();
  assert.ok(rows.length, 'live resident projected by the existing presenter');
  return { ...rows[0], x: box.x + rows[0].x, y: box.y + rows[0].y };
}
async function waitState(page, allowed, timeout = 15000) {
  await page.waitForFunction(({ host, allowed }) => allowed.includes(JSON.parse(document.querySelector(host)?.dataset.residentScreenPositions || '[]')[0]?.state), { host, allowed }, { timeout });
}
async function proveToolbarMenuKeepsTimeRunning(page, menuId) {
  const button = page.locator(`button[data-menu-id="${menuId}"]`);
  const clock = page.locator('.cm-status-bar__time');
  const before = await clock.textContent();
  await button.click();
  await page.locator(`.cm-toolbar__menu[data-menu-id="${menuId}"]`).waitFor();
  await page.waitForFunction(value => document.querySelector('.cm-status-bar__time')?.textContent !== value, before, { timeout: 5000 });
  const after = await clock.textContent();
  assert.notEqual(after, before, `${menuId} toolbar overlay must not pause the game clock`);
  assert.equal(await page.locator(`.cm-toolbar__menu[data-menu-id="${menuId}"]`).isVisible(), true);
  await button.click();
  return { menuId, before, after };
}
async function press(page, allowed, afterDown = async () => {}) {
  for (let attempt = 0; attempt < 12; attempt++) {
    const a = await actor(page);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await afterDown(a);
    try { await waitState(page, allowed, 900); return a; }
    catch { await page.mouse.up(); await page.waitForTimeout(90); }
  }
  throw Error(`Native hand failed to reach ${allowed}`);
}
async function measure(page) {
  return page.evaluate(() => {
    const rect = s => { const n = document.querySelector(s); if (!n) return null; const r = n.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height }; };
    return {
      viewport: { width: innerWidth, height: innerHeight }, document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
      shell: rect('.int-rh2-shell, .cm-vs2-shell'), host: rect('.int-rh2-field-host'), canvas: rect('.cm-raising-pixi-canvas'),
      companion: rect('.int-rh2-companion'), vitals: rect('.int-rh2-vitals'), board: rect('.cm-vs2-cage-board'),
      boardScroll: rect('.cm-cage-board-scroll'), facilities: rect('.cm-cage-facilities'), tray: rect('.cm-vs2-cage-tray'),
      hp: rect('[data-stat="hp"].int-rh2-vitals__label'), tp: rect('[data-stat="tp"].int-rh2-vitals__label'),
      toolbar: rect('.cm-toolbar'), canvasCount: document.querySelectorAll('canvas').length,
      toolbarDirection: document.querySelector('.cm-toolbar__cell') ? getComputedStyle(document.querySelector('.cm-toolbar__cell')).flexDirection : null,
      controls: [...document.querySelectorAll('#cm-root button, .cm-toolbar button')].filter(b => b.checkVisibility()).map(b => {
        const r = b.getBoundingClientRect(); return { name: b.getAttribute('aria-label') || b.textContent, x: r.x, y: r.y, width: r.width, height: r.height };
      }),
      slots: [...document.querySelectorAll('.cm-vs2-cage-slot')].map(n => ({ slot: n.dataset.slotIndex, left: n.style.left, top: n.style.top, filled: n.dataset.filled })),
      rendererAuthority: document.querySelector('.int-rh2-field-host')?.dataset.rendererAuthority,
      rendererSplit: document.querySelector('.int-rh2-shell')?.dataset.rendererSplit
    };
  });
}
function bounds(m) {
  assert.equal(m.document.width, m.viewport.width, 'no document horizontal overflow');
  assert.equal(m.document.height, m.viewport.height, 'no document vertical overflow');
  assert.ok(m.canvasCount <= 1, 'no second canvas');
  if (m.host) {
    assert.equal(m.canvasCount, 1);
    assert.equal(m.rendererAuthority, 'PIXI_SINGLE_FIELD');
    assert.equal(m.rendererSplit, 'DOM_UI_PIXI_FIELD');
    for (const k of ['x', 'y', 'width', 'height']) assert.ok(Math.abs(m.host[k] - m.canvas[k]) <= 1, `host/canvas ${k}`);
    for (const c of m.controls) {
      assert.ok(c.height >= 44, c.name);
      assert.ok(c.x >= 0 && c.y >= 0 && c.x + c.width <= m.viewport.width + 1 && c.y + c.height <= m.viewport.height + 1, c.name);
    }
    if (m.viewport.width === 390) assert.equal(m.host.width, 370, 'compact field retained');
    if (!baseline && m.viewport.width >= 600) {
      assert.ok(m.host.width >= m.viewport.width - 40, 'wide field uses available space');
      assert.ok(Math.abs(m.hp.y - m.tp.y) < 1, 'existing vitals reflow into pairs');
      assert.ok(m.tp.x > m.hp.x + 100, 'readouts use separate columns');
      assert.equal(m.toolbarDirection, 'row', 'existing toolbar icons/labels use a row');
    }
  } else {
    assert.equal(m.board.width, 508, 'board geometry not stretched');
    assert.equal(m.board.height, 102);
    if (!baseline && m.viewport.width >= 600) {
      assert.ok(m.boardScroll.width >= m.board.width, 'whole board is visible');
      assert.ok(m.tray.x >= m.facilities.x + m.facilities.width, 'existing lists reflow beside each other');
    }
  }
}

(async () => {
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: sizes[0], deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [], responses = [], report = { baseline, viewportJourneys: [], interactions: [], physicalDeviceAccepted: false };
  page.on('pageerror', e => errors.push(e.message));
  page.on('response', r => { if (r.status() >= 400) responses.push({ url: r.url(), status: r.status() }); });
  const stored = () => page.evaluate(key => localStorage.getItem(key), key);
  try {
    await page.goto(`${base}${base.includes('?') ? '&' : '?'}presentation=developer`, { waitUntil: 'networkidle' });
    await startGame(page);
    await page.locator(`${host}[data-resident-screen-positions]`).waitFor();
    report.toolbarClock = [];
    report.toolbarClock.push(await proveToolbarMenuKeepsTimeRunning(page, 'MANAGEMENT'));
    report.toolbarClock.push(await proveToolbarMenuKeepsTimeRunning(page, 'SYSTEM'));
    await page.locator('[data-tool-id="hand"]').click();
    for (let i = 0; i < 3; i++) { const a = await actor(page); await page.mouse.click(a.x, a.y); await page.waitForTimeout(70); }
    await page.waitForFunction(host => JSON.parse(document.querySelector(host)?.dataset.residentScreenPositions || '[]')[0]?.speciesIndex >= 8, host);
    await waitState(page, [1, 2, 3, 5, 17]);
    // The adult walks immediately after hatching. Re-sample its live hit
    // point if a click misses, as the existing Home hand gate does.
    const selected = await actor(page);
    for (let attempt = 0; attempt < 12; attempt++) {
      const point = await actor(page); await page.mouse.click(point.x, point.y);
      await page.waitForTimeout(100);
      if (await page.locator('.int-rh2-companion').getAttribute('data-open') === 'true') break;
    }
    await page.waitForSelector('.int-rh2-companion[data-open="true"]');
    const name = await page.locator('.int-rh2-companion__name').textContent();
    const canvas = await page.locator('.cm-raising-pixi-canvas').elementHandle();
    const shell = await page.locator('.int-rh2-shell').elementHandle();
    const companion = await page.locator('.int-rh2-companion').elementHandle();
    // Use the existing Home gate's page-hidden save seam before comparing
    // bytes, so an unchanged null entry cannot pass as preserved progress.
    await page.evaluate(() => {
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
      document.dispatchEvent(new Event('visibilitychange'));
    });
    await page.waitForFunction(key => localStorage.getItem(key) !== null, key);
    await page.evaluate(() => { delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); });
    const saveBeforeResize = await stored();
    assert.ok(saveBeforeResize);
    report.resizeSaveHash = hash(saveBeforeResize);
    for (const [i, viewport] of journey.entries()) {
      await page.setViewportSize(viewport); await page.waitForTimeout(250);
      assert.equal(await canvas.evaluate(n => n === document.querySelector('.cm-raising-pixi-canvas')), true);
      assert.equal(await shell.evaluate(n => n === document.querySelector('.int-rh2-shell')), true);
      assert.equal(await companion.evaluate(n => n === document.querySelector('.int-rh2-companion')), true);
      assert.equal(await page.locator('.int-rh2-companion__name').textContent(), name);
      assert.equal(await page.locator('.int-rh2-companion').getAttribute('data-open'), 'true');
      assert.equal((await actor(page)).creatureId, selected.creatureId);
      assert.equal(await stored(), saveBeforeResize, 'resize does not write saved progress');
      const measurement = await measure(page); bounds(measurement);
      if (i < 3) await page.screenshot({ path: path.join(output, `raising-${viewport.width}x${viewport.height}.png`) });
      report.viewportJourneys.push({ screen: 'RAISING_HOME', measurement, sameCanvas: true, sameShell: true, sameCompanion: true });
    }
    for (const viewport of sizes) {
      await page.setViewportSize(viewport); await page.waitForTimeout(200);
      const hand = page.locator('[data-tool-id="hand"]');
      if (await hand.getAttribute('aria-pressed') !== 'true') await hand.click();
      // Stroke admission needs >3 native pixels; at the board-context scale a
      // 12px gesture clears that threshold without becoming a long drag.
      let a = await press(page, [8], origin => page.mouse.move(origin.x + 12, origin.y));
      await page.mouse.move(a.x + 18, a.y); await page.mouse.up();
      await waitState(page, [1, 2, 3, 9]);
      a = await press(page, [6]);
      await page.mouse.move(a.x + 24, a.y + 24, { steps: 12 }); await page.mouse.up();
      await waitState(page, [1, 2, 3, 4, 9, 11, 13, 16, 17, 18]);
      const feed = page.locator('[data-tool-id="feed"]');
      const stock = Number(await feed.locator('.cm-toolbar__stock').textContent());
      await feed.click();
      // Existing food or the field edge can refuse a placement. Try nearby
      // ground while the resident moves; require exactly one accepted action.
      let foodPoint = null;
      for (const [dx, dy] of [[0, 16], [-28, 8], [28, 8], [0, -16], [-40, -16]]) {
        a = await actor(page); foodPoint = { x: a.x + dx, y: a.y + dy };
        await page.mouse.click(foodPoint.x, foodPoint.y);
        await page.waitForTimeout(120);
        if (Number(await feed.locator('.cm-toolbar__stock').textContent()) !== stock) break;
      }
      await page.waitForTimeout(100);
      assert.equal(Number(await feed.locator('.cm-toolbar__stock').textContent()), stock - 1, 'one click consumes one food, no duplicate handler');
      await page.locator('[data-tool-id="clean"]').click();
      await page.mouse.click(foodPoint.x, foodPoint.y);
      report.interactions.push({ viewport, stroke: true, carryAndRelease: true, foodStockBefore: stock, foodStockAfter: stock - 1 });
    }
    await page.locator('button[data-menu-id="MANAGEMENT"]').click();
    await page.locator('[data-entry-id="cageEdit"]').click();
    await page.locator('.cm-vs2-cage-board').waitFor();
    // Remove the initial cm01_01 facility, then carry its selected tray item
    // through every resize. Its slot/pixel geometry stays identical.
    await page.locator('.cm-vs2-cage-slot[data-slot-index="8"]').click();
    const item = page.locator('.cm-vs2-cage-tray__item').first();
    if (await item.getAttribute('data-selected') !== 'true') await item.click();
    const itemName = await item.getAttribute('aria-label');
    const cageShell = await page.locator('.cm-vs2-cage-edit').elementHandle();
    const cageBefore = await measure(page);
    for (const [i, viewport] of journey.entries()) {
      await page.setViewportSize(viewport); await page.waitForTimeout(200);
      assert.equal(await cageShell.evaluate(n => n === document.querySelector('.cm-vs2-cage-edit')), true);
      assert.equal(await page.locator('.cm-vs2-cage-tray__item[data-selected="true"]').getAttribute('aria-label'), itemName);
      const measurement = await measure(page); bounds(measurement);
      assert.deepEqual(measurement.slots, cageBefore.slots, 'resize preserves occupancy and board coordinates');
      if (i < 3) await page.screenshot({ path: path.join(output, `cage-${viewport.width}x${viewport.height}.png`) });
      report.viewportJourneys.push({ screen: 'CAGE_EDIT', measurement, sameShell: true, sameSelectedCage: true });
    }
    // A real remove -> select -> place action at each width, ending at a
    // different valid slot so Save/Continue can prove the placement persisted.
    let slot = 8;
    for (const viewport of sizes) {
      await page.setViewportSize(viewport);
      const target = page.locator(`.cm-vs2-cage-slot[data-slot-index="${slot}"]`);
      await target.scrollIntoViewIfNeeded(); await target.click();
      assert.equal(await target.getAttribute('data-filled'), 'true');
      await target.click();
      assert.equal(await target.getAttribute('data-filled'), 'false');
      const selectedItem = page.locator('.cm-vs2-cage-tray__item').first();
      if (await selectedItem.getAttribute('data-selected') !== 'true') await selectedItem.click();
      report.interactions.push({ viewport, cagePlaceAndRemove: true });
    }
    await page.locator('.cm-vs2-cage-slot[data-slot-index="10"]').click();
    assert.equal(await page.locator('.cm-vs2-cage-slot[data-slot-index="10"]').getAttribute('data-filled'), 'true');
    await page.locator('.cm-vs2-action--primary').click();
    await page.getByRole('button', { name: '返回育成基地', exact: true }).click();
    await page.locator('.cm-raising-pixi-canvas').waitFor();
    await page.locator('button[data-menu-id="SYSTEM"]').click();
    await page.locator('[data-entry-id="saveQuit"]').click();
    await page.waitForFunction(key => localStorage.getItem(key) !== null, key);
    await page.locator('#cm-login').waitFor();
    await page.goto('about:blank');
    await page.goto(`${base}?presentation=developer`, { waitUntil: 'networkidle' });
    const savedText = await stored(); const saved = JSON.parse(savedText);
    await startGame(page, { continueGame: true });
    await page.locator(`${host}[data-resident-screen-positions]`).waitFor();
    assert.equal((await actor(page)).speciesIndex, saved.creature.nativeProfile.fields['000']);
    await page.locator('button[data-menu-id="MANAGEMENT"]').click(); await page.locator('[data-entry-id="cageEdit"]').click();
    assert.equal(await page.locator('.cm-vs2-cage-slot[data-slot-index="10"]').getAttribute('data-filled'), 'true');
    assert.equal(await page.locator('.cm-vs2-cage-slot[data-slot-index="8"]').getAttribute('data-filled'), 'false');
    report.saveContinue = { explicitSaveAndQuit: true, realPageDeparture: true, canonicalSaveHash: hash(savedText), cageMovedFrom: 8, cageMovedTo: 10, residentRestored: true };
    await page.getByRole('button', { name: '返回育成基地', exact: true }).click();
    report.otherScreens = [];
    for (const viewport of sizes) {
      await page.setViewportSize(viewport);
      for (const [entry, screen, back] of [['shop', 'SHOP', '返回牧場'], ['database', 'DATABASE', '返回育成基地']]) {
        await page.locator('button[data-menu-id="SYSTEM"]').click();
        await page.locator(`[data-entry-id="${entry}"]`).click();
        await page.locator(`.cm-vs2-root[data-screen="${screen}"]`).waitFor();
        const m = await measure(page);
        assert.equal(m.shell.width, Math.min(viewport.width, 430), 'other screens retain their existing shell');
        assert.equal(m.document.width, viewport.width); assert.equal(m.document.height, viewport.height);
        await page.screenshot({ path: path.join(output, `${entry}-${viewport.width}x${viewport.height}.png`) });
        report.otherScreens.push({ screen, viewport, shellWidth: m.shell.width, noOverflow: true });
        await page.getByRole('button', { name: back, exact: true }).click();
        await page.locator('.cm-raising-pixi-canvas').waitFor();
      }
    }
    assert.deepEqual(errors, []); assert.deepEqual(responses, []);
    report.status = 'PASS'; report.errors = errors; report.missingResources = responses;
    fs.writeFileSync(path.join(output, 'browser-qa.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(`CAGE_LAYOUT_BROWSER_PASS journeys=${report.viewportJourneys.length} interactions=${report.interactions.length} baseline=${baseline}`);
  } catch (error) {
    await page.screenshot({ path: path.join(output, 'failure.png') });
    fs.writeFileSync(path.join(output, 'failure.json'), JSON.stringify({ error: String(error), errors, responses, text: await page.locator('body').innerText(), report }, null, 2));
    throw error;
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });

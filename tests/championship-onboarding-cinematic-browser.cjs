// Owner 2026-10-28 onboarding gate: New Game → cinematic prologue → tamer
// licence → elemental incubator → hatching pod → Raising Home with the
// tactical tutorial guide visible, on an iPhone-sized portrait viewport with
// emulated safe-area insets (47 px status bar, 34 px home indicator).
//
// It clears the page's storage, so it refuses the Owner's 8732 origin; run it
// against an isolated server: CHAMPIONSHIP_QA_URL=http://127.0.0.1:<port>/championship.html
const assert = require('node:assert/strict');
const { chromium, devices } = require('playwright');
const { login } = require('./championship-browser-opening.cjs');

const url = process.env.CHAMPIONSHIP_QA_URL;
if (!url) throw new Error('Set CHAMPIONSHIP_QA_URL to an isolated QA server');
if (new URL(url).port === '8732') throw new Error('Refusing the Owner save origin 8732');
const INSET = { top: 47, bottom: 34 };

(async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ ...devices['iPhone 13'], viewport: { width: 390, height: 844 } });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const cdp = await context.newCDPSession(page);
  await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: INSET.top, topMax: INSET.top, bottom: INSET.bottom, bottomMax: INSET.bottom, left: 0, leftMax: 0, right: 0, rightMax: 0 } });
  const box = selector => page.locator(selector).first().evaluate(node => { const r = node.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; });
  try {
    await page.goto(url, { waitUntil: 'networkidle' });
    await page.evaluate(() => localStorage.clear());
    await page.reload({ waitUntil: 'networkidle' });
    await login(page);
    await page.click('#cm-new-game');

    // 1. One-screen cinematic stage inside the safe area; no page scroll.
    const story = page.locator('.cm-opening-story.cm-cutscene');
    await story.waitFor();
    const text = page.locator('[data-story-action="text"]');
    // The read-text-first key exists only while the first panels decode.
    if (await text.isVisible().catch(() => false)) await text.click({ timeout: 2000 }).catch(() => {});
    await page.waitForFunction(() => document.querySelector('.cm-cutscene')?.dataset.beat === '0');
    assert.equal(await page.locator('.cm-cutscene__panel').count(), 3, 'the arena beat shows three comic panels');
    const skip = await box('.cm-cutscene__skip'), dialogue = await box('.cm-cutscene__dialogue'), stage = await box('.cm-cutscene');
    assert.ok(skip.top >= INSET.top, `skip capsule below the status bar (${skip.top})`);
    assert.ok(skip.right <= 390 && skip.left > 195, 'skip capsule on the right');
    assert.ok(dialogue.bottom <= 844 - INSET.bottom + 1, `subtitles above the home indicator (${dialogue.bottom})`);
    assert.ok(stage.height <= 844 + 1 && await page.evaluate(() => document.scrollingElement.scrollHeight <= innerHeight + 1), 'no page scroll');
    // A tap after the line is revealed advances one beat; a tap while the next
    // line is still typing reveals it whole without advancing.
    const state = () => page.evaluate(() => { const s = document.querySelector('.cm-cutscene').dataset; return { beat: Number(s.beat), typing: s.typing }; });
    await page.waitForFunction(() => document.querySelector('.cm-cutscene')?.dataset.typing === 'false');
    const before = await state();
    await story.click({ position: { x: 195, y: 420 } });
    assert.deepEqual(await state(), { beat: before.beat + 1, typing: 'true' });
    await story.click({ position: { x: 195, y: 420 } });
    assert.deepEqual(await state(), { beat: before.beat + 1, typing: 'false' });
    await page.click('.cm-cutscene__skip');
    await page.locator('.cm-opening__envelope').waitFor();

    // 2. Mail, then the licence terminal with guest pass and random name.
    await page.click('.cm-opening__envelope');
    await page.click('.cm-opening__letter button');
    await page.locator('.cm-license [data-guest-mode="true"]').waitFor();
    await page.click('[data-random-name="trainer"]');
    const suggested = await page.inputValue('#cm-opening-name');
    assert.ok(suggested.length >= 1 && suggested.length <= 5, `random tamer name ${suggested}`);
    await page.fill('#cm-opening-name', '星野');
    await page.click('.cm-opening__name button[type=submit]');
    await page.locator('.cm-opening__choices button').first().click();
    await page.click('.cm-opening__envelope');
    await page.click('.cm-opening__letter button');
    await page.locator('.cm-opening__gift[data-mystery="true"]').waitFor();
    await page.click('.cm-opening__letter button');

    // 3. Incubator: eight eggs with element tags; the chosen card locks.
    assert.equal(await page.locator('.cm-opening__egg-option').count(), 8);
    assert.equal(await page.locator('.cm-egg-card__element').count(), 8);
    await page.locator('input[name="starterEgg"][value="1"]').check();
    const chosen = page.locator('.cm-opening__egg-option:has(input:checked)');
    assert.equal(await chosen.getAttribute('data-element'), 'fire');
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.cm-opening__egg-option:has(input:checked) .cm-egg-card__badge')).opacity === '1');
    await page.click('[data-egg-confirm]');

    // 4. Hatching pod shows the egg actually chosen and a visible name slot.
    const podEgg = page.locator('.cm-pod .cm-pod__egg');
    await podEgg.waitFor();
    assert.match(await podEgg.getAttribute('src'), /e001_digitama/);
    assert.equal(await page.locator('.cm-pod').getAttribute('data-element'), 'fire');
    const slot = await box('.cm-pod .cm-name-slot');
    assert.ok(slot.height >= 56 && slot.width >= 280, `name slot is a real input (${slot.width}x${slot.height})`);
    await page.click('[data-random-name="egg"]');
    assert.ok((await page.inputValue('#cm-opening-name')).length >= 1);
    await page.fill('#cm-opening-name', '小焰');
    await page.click('.cm-opening__name button[type=submit]');

    // 5. Raising Home: no opening layer left, the guide invitation on top.
    await page.waitForFunction(() => document.getElementById('cm-root')?.dataset.activeScreen === 'RAISING_HOME'
      && document.querySelector('.int-rh2-field-host')?.dataset.loadState === 'ready', null, { timeout: 120000 });
    const invite = page.locator('dialog.cm-dialog[data-variant="tutorial-guide"][open]');
    await invite.waitFor();
    assert.equal(await page.evaluate(() => { const o = document.getElementById('cm-opening'); return o.hidden && o.childElementCount === 0 && document.getElementById('cm-title').hidden; }), true, 'opening layer removed');
    await invite.locator('[data-action="accept"]').click();
    await page.locator('dialog.cm-dialog[data-variant="tutorial-guide"][open] .cm-guide-step').filter({ hasText: 'STEP 1 / 10' }).waitFor();
    // The demonstration egg is on screen, not in the void above the view.
    const residents = await page.evaluate(() => JSON.parse(document.querySelector('.int-rh2-field-host').dataset.residentScreenPositions || '[]'));
    assert.ok(residents[0] && residents[0].x > 0 && residents[0].x < 390 && residents[0].y > 0 && residents[0].y < 844, JSON.stringify(residents[0]));
    for (let i = 0; i < 3; i++) await page.locator('dialog.cm-dialog[open] [data-action="next"]').click();
    // The egg hatches on its own after 180 frames, which ends the step; read
    // the spotlight in the same task that sees the hatch step, not after it.
    const spot = await (await page.waitForFunction(() => {
      const light = document.querySelector('.cm-guide-spotlight'), banner = document.querySelector('.cm-tutorial-guidance');
      if (!light || light.hidden || banner?.dataset.stage !== 'raising-hatch') return null;
      const r = light.querySelector('.cm-guide-spotlight__frame').getBoundingClientRect();
      return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, step: banner.querySelector('.cm-guide-step')?.textContent };
    })).jsonValue();
    assert.ok(spot.top > 0 && spot.bottom < 844 && spot.left >= 0 && spot.right <= 390, `spotlight on screen ${JSON.stringify(spot)}`);
    assert.match(spot.step, /STEP 1 \/ 10/);
    assert.deepEqual(errors, []);
    console.log('ONBOARDING_CINEMATIC_PASS');
  } finally {
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });

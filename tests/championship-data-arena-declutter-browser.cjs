// Data Arena squad dock + declutter gate (OWNER_APPROVED_ADAPTATION 2026-11-02).
//
// Phone portrait through the normal menu with the full QA save: no native
// <select>, no keyboard/mouse names on touch, the head clears a 47px notch,
// the last summary card clears the action bar, the roster drawer lists only
// raised / registered partners (locked ones as silhouettes on request), the
// skill chips swap slots, and in battle the rival bar sits in the top strip
// while combat text never draws a box over the field (y 140..580).
// The ?arenaQa=1 telemetry probe is presentation only; it never steps the match.
//
//   CHAMPIONSHIP_QA_ORIGIN=http://127.0.0.1:8761 node tests/championship-data-arena-declutter-browser.cjs
const { chromium } = require('playwright');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const origin = process.env.CHAMPIONSHIP_QA_ORIGIN || 'http://127.0.0.1:8732';
const output = path.resolve(process.env.CHAMPIONSHIP_QA_OUTPUT_ROOT || '.tmp/data-arena-declutter-browser');
fs.mkdirSync(output, { recursive: true });
const report = { origin, checks: [], errors: [], samples: [], physicalDeviceAccepted: false };
const check = (name, value, detail = null) => { report.checks.push({ name, pass: !!value, detail }); assert.ok(value, `${name} ${detail ? JSON.stringify(detail) : ''}`); };
const FIELD = { top: 140, bottom: 580 };

// Every painted box (background, border or shadow) that is not a control, the HUD frame or the field itself.
const boxesInField = (field) => [...document.querySelectorAll('.da-root *')].filter((node) => {
  if (node.closest('.da-touch, .da-field, .da-hud__top, .da-boss, .da-hud__bottom, .da-vignette, .da-tactical, .da-overlay')) return false;
  const rect = node.getBoundingClientRect();
  if (rect.width < 2 || rect.height < 2 || rect.bottom <= field.top || rect.top >= field.bottom) return false;
  const style = getComputedStyle(node);
  if (style.visibility === 'hidden' || style.display === 'none' || Number(style.opacity) === 0) return false;
  const painted = (style.backgroundColor !== 'rgba(0, 0, 0, 0)' && style.backgroundColor !== 'transparent') || style.backgroundImage !== 'none' || parseFloat(style.borderTopWidth) > 0;
  return painted;
}).map((node) => ({ cls: String(node.className), text: node.textContent.slice(0, 30), top: Math.round(node.getBoundingClientRect().top) }));

(async () => {
  const browser = await chromium.launch({ headless: true, channel: 'chrome', args: process.env.CHAMPIONSHIP_QA_SOFTWARE_GL === '1' ? ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] : [] });
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (error) => report.errors.push(error.stack));
  page.on('console', (message) => { if (message.type() === 'error') report.errors.push(message.text()); });
  const rawSave = JSON.parse(fs.readFileSync(path.join(__dirname, '../qa/championship-full-qa-save.json'), 'utf8'));
  if (Array.isArray(rawSave.progression?.registeredSpecies)) {
    rawSave.progression.registeredSpecies = rawSave.progression.registeredSpecies.filter((n) => n !== 107 && n !== 108);
  }
  const save = JSON.stringify(rawSave);
  await context.addInitScript(({ origin, save }) => { if (location.origin === origin && !localStorage.getItem('declutterQaSeeded')) { localStorage.setItem('championshipModernSave:v1', save); localStorage.setItem('declutterQaSeeded', '1'); } }, { origin, save });
  const shot = async (name) => { await page.screenshot({ path: path.join(output, `${name}.png`) }); };
  try {
    const cdp = await context.newCDPSession(page);
    await page.goto(origin + '/championship.html?arenaQa=1&arenaSeed=19');
    await page.waitForFunction(() => document.querySelector('#cm-login')?.disabled === false, null, { timeout: 60000 });
    await page.locator('#cm-opening-film video').evaluateAll((videos) => videos.forEach((video) => { video.playbackRate = 8; }));
    await page.click('#cm-login'); await page.click('#cm-continue');
    await page.waitForSelector('#cm-root[data-active-screen="RAISING_HOME"]');
    await page.click('button[data-menu-id="SYSTEM"]'); await page.click('[data-entry-id="battle"]');
    await page.click('#cm-data-arena');
    await page.waitForSelector('.da-panel--select');
    // A notch like an iPhone's (47 / 34 px) for the select screen's head and action bar.
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 47, bottom: 34, left: 0, right: 0 } }).catch(() => null);
    await page.click('.da-mode[data-mode="RELAY"]');
    await page.waitForSelector('.da-seat[data-seat="reserve"]');
    await page.waitForTimeout(300);
    const select = await page.evaluate(() => {
      const rect = (node) => { const r = node.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, height: r.height }; };
      const modes = [...document.querySelectorAll('.da-mode')].map(rect);
      return { selects: document.querySelectorAll('.da-root select').length, text: document.querySelector('.da-panel--select').innerText,
        modes, title: rect(document.querySelector('.da-panel--select .da-title')), head: rect(document.querySelector('.da-panel__head')),
        seats: [...document.querySelectorAll('.da-seat')].map((node) => node.dataset.seat), entries: [...document.querySelectorAll('.da-seat .da-entry')].map((node) => node.dataset.entry),
        keys: [...document.querySelectorAll('.da-skill__key')].map((node) => node.textContent), resonance: Boolean(document.querySelector('.da-dock .cm-resonance-strip')),
        scroll: document.querySelector('.da-root').scrollWidth };
    });
    check('no native select on the select screen', select.selects === 0, select.selects);
    check('touch shows no mouse or keyboard names', !/LMB|RMB|Q·3|E·4/.test(select.text));
    check('touch kit chips name the wheel discs', select.keys.includes('技 1') && select.keys.includes('終極技'), select.keys);
    check('three mode cartridges share one row', select.modes.every((m) => Math.abs(m.top - select.modes[0].top) < 1) && select.modes[0].height < 110, select.modes);
    check('the head clears a 47px notch', select.title.top >= 47 && select.head.top <= 0.5, select.title);
    check('relay shows seat 1, seat 2 and seat 3 with entry tags', select.seats.join() === 'first,reserve,third' && select.entries.length === 3, select);
    check('the dock carries the pair resonance strip', select.resonance);
    check('no horizontal page scroll', select.scroll === 390, select.scroll);
    await shot('01-select-relay-dock');
    // Scrolled to the end, the summary clears the fixed action bar and the head stays on top.
    const end = await page.evaluate(async () => {
      const body = document.querySelector('.da-panel--select .da-panel__body');
      body.scrollTop = body.scrollHeight; await new Promise((resolve) => setTimeout(resolve, 120));
      const last = document.querySelector('.da-summary').getBoundingClientRect(), bar = document.querySelector('.da-panel--select .da-actions').getBoundingClientRect();
      const head = document.querySelector('.da-panel__head').getBoundingClientRect();
      const topmost = document.elementFromPoint(195, head.bottom - 4);
      return { last: last.bottom, bar: bar.top, headOnTop: Boolean(topmost?.closest('.da-panel__head')), barBottom: bar.bottom, innerHeight };
    });
    check('the last summary card clears the action bar', end.last <= end.bar + 0.5, end);
    check('scrolled content never covers the head', end.headOnTop, end);
    await shot('01b-select-relay-bottom');
    await page.evaluate(() => { document.querySelector('.da-panel--select .da-panel__body').scrollTop = 0; });

    // Roster drawer: unlocked by default; the whole Dex shows locked species as silhouettes.
    await page.click('.da-seat[data-seat="reserve"] .da-seat__change');
    await page.waitForSelector('.da-drawer:not([hidden]) .da-roster');
    const unlocked = await page.$$eval('.da-roster', (cells) => cells.map((cell) => cell.dataset.entry));
    check('the drawer lists only partners that may enter by default', unlocked.length > 0 && unlocked.every((entry) => entry !== 'LOCKED'), unlocked.length);
    await page.locator('.da-drawer .da-segment').first().locator('.da-chip-btn').nth(1).click();
    const all = await page.$$eval('.da-roster', (cells) => cells.map((cell) => ({ entry: cell.dataset.entry, filter: getComputedStyle(cell.querySelector('img') ?? cell).filter })));
    const locked = all.filter((cell) => cell.entry === 'LOCKED');
    check('the whole-Dex view adds locked silhouettes', locked.length > 0 && locked.every((cell) => /brightness\(0\)/.test(cell.filter)), { locked: locked.length, total: all.length });
    await page.evaluate(() => { const grid = document.querySelector('.da-drawer__grid'); grid.scrollTop = grid.scrollHeight; });
    await page.waitForTimeout(250);
    await shot('02-roster-drawer');
    await page.locator('.da-roster[data-entry="LOCKED"]').last().click();
    check('a locked partner explains how to unlock and cannot be picked', await page.locator('.da-drawer:not([hidden]) .da-hint:not([hidden])').count() === 1);
    const before = await page.$eval('.da-seat[data-seat="reserve"]', (node) => node.dataset.partner);
    const pick = await page.$$eval('.da-roster:not([data-entry="LOCKED"]):not([data-seat])', (cells) => cells[3]?.dataset.partner);
    await page.click(`.da-roster[data-partner="${pick}"]`);
    check('picking in the drawer fills the reserve seat and closes it', await page.$eval('.da-seat[data-seat="reserve"]', (node) => node.dataset.partner) === pick && pick !== before
      && await page.locator('.da-drawer:not([hidden])').count() === 0, { before, pick });

    // Skill chips replace the loadout selects.
    await page.click('.da-seat[data-seat="first"] .da-skill[data-slot="0"]');
    await page.waitForSelector('.da-seat[data-seat="first"] .da-chips__choices');
    await page.evaluate(() => document.querySelector('.da-seat[data-seat="first"] .da-chips__choices').scrollIntoView({ block: 'center' }));
    await page.waitForTimeout(150);
    await shot('03-skill-chips');
    const slotBefore = await page.$eval('.da-seat[data-seat="first"] .da-skill[data-slot="0"] .da-skill__name', (node) => node.textContent);
    await page.locator('.da-seat[data-seat="first"] .da-skill--choice[aria-selected="false"]').first().click();
    const slotAfter = await page.$eval('.da-seat[data-seat="first"] .da-skill[data-slot="0"] .da-skill__name', (node) => node.textContent);
    check('a skill chip swaps the slot move', slotAfter !== slotBefore, { slotBefore, slotAfter });
    check('still no native select after the drawer and chips', await page.locator('.da-root select').count() === 0);

    // Battle (no notch emulation, so the field band is the brief's y 140..580).
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: 0, bottom: 0, left: 0, right: 0 } }).catch(() => null);
    await page.click('.da-panel--select .da-btn--primary'); await page.click('.da-panel--brief .da-btn--primary');
    await page.waitForFunction(() => window.__dataArenaQA?.state() === 'PLAY', null, { timeout: 60000 });
    await page.waitForFunction(() => __dataArenaQA.snapshot().time > 2.6 && __dataArenaQA.snapshot().rivals[0]?.hp > 0, null, { timeout: 60000 });
    const hud = await page.evaluate(() => {
      const rect = (node) => { const r = node.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, height: r.height, width: r.width }; };
      return { boss: rect(document.querySelector('.da-boss')), top: rect(document.querySelector('.da-hud__top')), tactical: rect(document.querySelector('.da-tactical')),
        mini: document.querySelectorAll('.da-relay-team .da-mini').length, resonanceInBar: Boolean(document.querySelector('.da-hud__top .da-hud__resonance')) || !document.querySelector('.da-hud__resonance') };
    });
    check('top bar and rival strip end within 105px', hud.boss.bottom <= 105 && hud.top.bottom <= hud.boss.top, hud);
    check('the rival strip is a slim 26px bar', Math.round(hud.boss.height) === 26, hud.boss);
    check('the tactical line sits above the field band', hud.tactical.bottom <= FIELD.top, hud.tactical);
    check('seat 1 / 2 / 3 mini tags and resonance live in the top bar', hud.mini === 3 && hud.resonanceInBar, hud);
    await shot('04-battle-clear-field');

    // Worst-case burst through the probe, then natural play with the attack held.
    await page.evaluate((source) => { window.__fieldBoxes = (0, eval)(`(${source})`); }, boxesInField.toString());
    check('the telemetry probe runs', await page.evaluate(() => __dataArenaQA.telemetryProbe()));
    const burst = await page.evaluate((field) => {
      const boxes = window.__fieldBoxes(field);
      const lines = [...document.querySelectorAll('.da-tactical__line:not(.is-leaving)')].map((node) => node.textContent);
      const flags = [...document.querySelectorAll('.da-flag.is-showing')].map((node) => { const r = node.getBoundingClientRect(); return { text: node.textContent, top: r.top, bottom: r.bottom }; });
      return { boxes, lines, flags };
    }, FIELD);
    await shot('05-telemetry-burst');
    report.samples.push({ kind: 'probe', ...burst });
    check('no boxed text inside the field band after the burst', burst.boxes.length === 0, burst.boxes);
    check('one tactical line, merged to ×2', burst.lines.length === 1 && /×2/.test(burst.lines[0]), burst.lines);
    check('the cooldown cut flags the three skill buttons', burst.flags.filter((flag) => /-2s/.test(flag.text)).length === 3 && burst.flags.every((flag) => flag.bottom > FIELD.bottom), burst.flags);
    const basic = await page.locator('.da-tbtn--basic').boundingBox();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: basic.x + basic.width / 2, y: basic.y + basic.height / 2, id: 2 }] });
    for (let i = 0; i < 40; i++) {
      await page.waitForTimeout(200);
      const sample = await page.evaluate((field) => ({ boxes: window.__fieldBoxes(field), lines: document.querySelectorAll('.da-tactical__line:not(.is-leaving)').length,
        state: window.__dataArenaQA.state() }), FIELD);
      report.samples.push(sample);
      check(`play sample ${i}: no boxed text in the field band, at most one tactical line`, sample.boxes.length === 0 && sample.lines <= 1, sample);
      if (sample.state !== 'PLAY') break;
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await shot('06-battle-after-play');
    check('no page errors', report.errors.length === 0, report.errors);
  } finally {
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }
  console.log(`DATA_ARENA_DECLUTTER_BROWSER_PASS ${report.checks.length} checks -> ${output}`);
})().catch((error) => { console.error(error); process.exitCode = 1; });

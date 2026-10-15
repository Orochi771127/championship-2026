// Data Arena real-browser acceptance gate (OWNER_APPROVED_ADAPTATION 2026-10-15).
//
// Drives the normal title entry with real keyboard, mouse and touch input in an
// isolated browser context. The page's ?arenaQa=1 hook is READ-ONLY: the QA
// autopilot decides from observation and Playwright performs the input; no
// arena state is written and no phase is skipped. Screenshots, a JSON log and
// performance diagnostics land in .tmp/browser-qa/data-arena (or
// CHAMPIONSHIP_QA_OUTPUT_ROOT). Headless Chromium renders WebGL in software
// (SwiftShader): frame numbers are NOT physical-device or GPU evidence.
//
//   npm run serve   (another terminal)
//   npm run test:browser:data-arena
//   CHROME=/path/to/chrome  ARENA_SEED=7  ARENA_SKIP_FULL=1  (optional)
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const output = require('./browser-qa-output.cjs')('data-arena');
const botSource = fs.readFileSync(path.join(__dirname, 'championship-data-arena-qa-bot.cjs'), 'utf8');

const origin = process.env.CHAMPIONSHIP_QA_ORIGIN || 'http://127.0.0.1:8732';
const seed = Number(process.env.ARENA_SEED || 7);
const partnerIndex = Number(process.env.ARENA_PARTNER || 0);
const SAVE_KEY = 'championshipModernSave:v1';
const ARENA_KEY = 'championshipModernSave:dataArena:v1';
fs.mkdirSync(output, { recursive: true });

const report = { schemaVersion: 1, generatedAt: new Date().toISOString(), origin, seed, partnerIndex, renderer: null, softwareRendering: null,
  physicalDeviceAccepted: false, checks: [], screenshots: [], errors: [], runs: [] };
const check = (name, ok, detail = null) => { report.checks.push({ name, ok: Boolean(ok), detail }); assert.ok(ok, `${name} ${detail ? JSON.stringify(detail) : ''}`); };

function watch(page, label) {
  page.on('pageerror', (error) => report.errors.push({ label, kind: 'pageerror', text: error.message }));
  page.on('console', (message) => {
    if (message.type() !== 'error') return;
    report.errors.push({ label, kind: 'console', text: message.text() });
  });
  page.on('response', (response) => { if (response.status() >= 400) report.errors.push({ label, kind: 'http', status: response.status(), url: response.url() }); });
  page.on('requestfailed', (request) => {
    const failure = request.failure()?.errorText ?? '';
    if (!/ERR_ABORTED/.test(failure)) report.errors.push({ label, kind: 'requestfailed', url: request.url(), failure });
  });
}
async function shot(page, name) {
  const file = path.join(output, `${name}.png`);
  await page.screenshot({ path: file });
  report.screenshots.push(path.basename(file));
}
const qa = (page, expression) => page.evaluate(expression);
/** LOGIN as a player does (the shared helper's networkidle wait is unreliable while title media streams). */
async function login(page) {
  await page.waitForFunction(() => document.querySelector('#cm-login')?.disabled === false, null, { timeout: 60000 });
  await page.locator('#cm-opening-film video').evaluateAll((videos) => { for (const video of videos) video.playbackRate = 8; });
  await page.waitForFunction(() => { const film = document.querySelector('#cm-opening-film'); return !film || film.hidden; }, null, { timeout: 55000 });
  await page.click('#cm-login');
  await page.waitForSelector('#cm-data-arena', { state: 'visible' });
}
async function waitState(page, state, timeout = 30000) {
  await page.waitForFunction((s) => window.__dataArenaQA?.state() === s, state, { timeout });
}

async function openArena(page) {
  await page.click('#cm-data-arena');
  await page.waitForSelector('.da-panel--select');
  await waitState(page, 'SELECT');
}
async function startFromSelect(page, partnerIndex = 0) {
  await page.locator('.da-partner').nth(partnerIndex).click();
  await page.click('.da-panel--select .da-btn--primary');
  await page.waitForSelector('.da-panel--brief');
  await page.click('.da-panel--brief .da-btn--primary');
  await waitState(page, 'PLAY', 45000);
}

/** One autopilot match through real input; returns the result snapshot. */
async function autopilotMatch(page, { prefix, maxSeconds = 520, shotsOn = true }) {
  await page.evaluate((source) => {
    if (window.__dataArenaBot) return;
    const module = { exports: {} };
    new Function('module', 'exports', source)(module, module.exports);
    window.__dataArenaBot = { decide: module.exports.decide, mem: {} };
  }, botSource);
  const held = new Set();
  let firing = false;
  const seen = {};
  const started = Date.now();
  const pref = ['focusLens', 'refractor', 'heatSink', 'guardianFin', 'swiftStep', 'phaseDash', 'surgePlus', 'perfectTiming', 'patch'];
  let decisions = 0, levelUps = 0;
  for (;;) {
    if ((Date.now() - started) / 1000 > maxSeconds) throw new Error(`${prefix}: match exceeded ${maxSeconds}s`);
    const view = await page.evaluate(() => {
      const q = window.__dataArenaQA, state = q.state();
      const snap = q.snapshot();
      if (state !== 'PLAY' || !snap) return { state, snap };
      const entities = q.entities();
      const obs = { snap, enemies: entities.enemies, projectiles: entities.projectiles, telegraphs: q.telegraphs(), surface: entities.surfaceUnderPlayer };
      const decision = window.__dataArenaBot.decide(obs, window.__dataArenaBot.mem);
      return { state, snap, decision, aim: q.worldToScreen(decision.aimX, decision.aimY) };
    });
    const { state, snap } = view;
    if (state === 'RESULT') {
      for (const code of held) await page.keyboard.up(code);
      if (firing) await page.mouse.up();
      await page.waitForSelector('.da-panel--result', { timeout: 10000 });
      if (shotsOn) await shot(page, `${prefix}-result`);
      return { snap, decisions, levelUps, seconds: (Date.now() - started) / 1000 };
    }
    if (state === 'LEVEL') {
      for (const code of held) await page.keyboard.up(code);
      held.clear();
      if (firing) { await page.mouse.up(); firing = false; }
      const ids = await page.$$eval('.da-card', (cards) => cards.map((card) => card.dataset.upgrade));
      if (shotsOn && !seen.level) { seen.level = true; await shot(page, `${prefix}-levelup`); }
      const pick = pref.find((id) => ids.includes(id)) ?? ids[0];
      const timeBefore = snap.time;
      await page.waitForTimeout(300);
      const frozen = await qa(page, () => window.__dataArenaQA.snapshot().time);
      check(`${prefix}: level-up pauses the match`, frozen === timeBefore, { timeBefore, frozen });
      await page.click(`.da-card[data-upgrade="${pick}"]`);
      levelUps++;
      continue;
    }
    if (state !== 'PLAY' || !view.decision) { await page.waitForTimeout(100); continue; }
    decisions++;
    const d = view.decision;
    const want = new Set();
    if (d.moveX > 0.3) want.add('KeyD'); if (d.moveX < -0.3) want.add('KeyA');
    if (d.moveY > 0.3) want.add('KeyS'); if (d.moveY < -0.3) want.add('KeyW');
    for (const code of held) if (!want.has(code)) { await page.keyboard.up(code); held.delete(code); }
    for (const code of want) if (!held.has(code)) { await page.keyboard.down(code); held.add(code); }
    // A player's pointer stays inside the window: clamp off-screen aim points.
    const viewport = page.viewportSize();
    if (view.aim) await page.mouse.move(Math.min(viewport.width - 4, Math.max(4, view.aim.x)), Math.min(viewport.height - 4, Math.max(4, view.aim.y)));
    if (d.fire && !firing) { await page.mouse.down(); firing = true; }
    if (!d.fire && firing) { await page.mouse.up(); firing = false; }
    if (d.dash) await page.keyboard.press('Space');
    if (d.surge) await page.keyboard.press('KeyQ');
    if (d.ride) await page.keyboard.press('KeyE');
    if (shotsOn) {
      const p = snap.player;
      const moment = (key, condition) => { if (condition && !seen[key]) { seen[key] = true; return true; } return false; };
      if (moment('combat', snap.time > 20 && snap.laser.firing && snap.enemies >= 3)) await shot(page, `${prefix}-combat`);
      if (moment('fire', snap.burning >= 6)) await shot(page, `${prefix}-fire`);
      if (moment('surge', snap.stats.coresOut >= 1)) await shot(page, `${prefix}-extinguish`);
      if (moment('ride', p.state === 'RIDING' && snap.mate.swimming)) await shot(page, `${prefix}-ride`);
      if (moment('ice', snap.ice >= 3)) await shot(page, `${prefix}-ice`);
      if (moment('scan', snap.phase === 'SCAN' && snap.time > 152)) await shot(page, `${prefix}-scan`);
      if (moment('boss', snap.boss && snap.boss.state === 'FIGHT')) await shot(page, `${prefix}-guardian`);
    }
  }
}

(async () => {
  const executablePath = process.env.CHROME || (fs.existsSync('/opt/pw-browsers/chromium-1194/chrome-linux/chrome') ? '/opt/pw-browsers/chromium-1194/chrome-linux/chrome' : undefined);
  const browser = await chromium.launch({ headless: true, executablePath, args: ['--enable-unsafe-swiftshader', '--use-angle=swiftshader', '--autoplay-policy=no-user-gesture-required'] });
  try {
    // ------------------------------------------------------------ desktop 1280x720
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    page.setDefaultTimeout(30000);
    watch(page, 'desktop');
    await page.goto(`${origin}/championship.html?arenaQa=1&arenaSeed=${seed}`, { waitUntil: 'domcontentloaded' });
    // A pre-existing raising save must survive every arena action untouched.
    await page.evaluate((key) => localStorage.setItem(key, JSON.stringify({ sentinel: 'raising-save-must-not-change' })), SAVE_KEY);
    const saveBefore = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
    await login(page);
    check('title menu shows the Data Arena entry', await page.locator('#cm-data-arena').isVisible());
    await shot(page, 'desktop-00-title-entry');
    await openArena(page);
    await shot(page, 'desktop-01-select');
    report.renderer = await page.evaluate(() => {
      const gl = document.createElement('canvas').getContext('webgl');
      const info = gl?.getExtension('WEBGL_debug_renderer_info');
      return info ? gl.getParameter(info.UNMASKED_RENDERER_WEBGL) : gl?.getParameter(gl.RENDERER) ?? null;
    });
    report.softwareRendering = /swiftshader|llvmpipe|software/i.test(report.renderer ?? '');
    await page.locator('.da-partner').nth(partnerIndex).click();
    await page.click('.da-panel--select .da-btn--primary');
    await page.waitForSelector('.da-panel--brief');
    await shot(page, 'desktop-02-briefing');
    await page.click('.da-panel--brief .da-btn--primary');
    await waitState(page, 'PLAY', 45000);
    await page.waitForTimeout(1200);
    await shot(page, 'desktop-03-start');
    let diag = await qa(page, () => window.__dataArenaQA.diagnostics());
    check('one shared Pixi Application, one arena ticker callback', diag.stage.applicationCount === 1 && diag.tickerListeners >= 1, diag);
    check('existing creature art loaded for player, mate and guardian', diag.bundles.length === 3 && diag.scene.hasCreatureArt, diag.bundles);
    check('arena fills the desktop viewport', diag.stage.viewport.width === 1280 && diag.stage.viewport.height === 720, diag.stage.viewport);
    const baseTicker = diag.tickerListeners;

    // Mouse aim + sustained laser: heat rises while held, falls after release.
    await page.mouse.move(980, 360);
    const fireStart = await qa(page, () => window.__dataArenaQA.snapshot().time);
    await page.mouse.down();
    await page.waitForTimeout(900);
    const heating = await qa(page, () => ({ ...window.__dataArenaQA.snapshot().laser, gameSeconds: window.__dataArenaQA.snapshot().time }));
    heating.gameSeconds -= fireStart;
    await page.mouse.up();
    await page.waitForTimeout(900);
    const cooled = await qa(page, () => window.__dataArenaQA.snapshot().laser);
    // Judged against game time: a starved software-rendered frame rate slows the game, not the rule.
    check('holding the mouse fires a sustained, heating beam', heating.firing && heating.heat >= heating.gameSeconds * 25, heating);
    check('releasing cools the beam', !cooled.firing && cooled.heat < heating.heat, cooled);
    // Dash on Space.
    const beforeDash = await qa(page, () => window.__dataArenaQA.snapshot().player.dashCharges);
    await page.keyboard.press('Space');
    await page.waitForTimeout(120);
    const afterDash = await qa(page, () => window.__dataArenaQA.snapshot().player);
    check('Space dashes (charge spent)', afterDash.dashCharges < beforeDash || afterDash.state === 'DASH', { beforeDash, afterDash });

    // Background / foreground. Headless Chromium never occludes a tab, so the
    // page's visibility is emulated and the browser's own visibilitychange event
    // is dispatched (recorded as emulated in the report).
    const setHidden = (value) => page.evaluate((hiddenNow) => {
      Object.defineProperty(document, 'hidden', { configurable: true, get: () => hiddenNow });
      Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => (hiddenNow ? 'hidden' : 'visible') });
      document.dispatchEvent(new Event('visibilitychange'));
    }, value);
    await setHidden(true);
    await page.waitForTimeout(600);
    const hidden = await qa(page, () => ({ state: window.__dataArenaQA.state(), time: window.__dataArenaQA.snapshot().time }));
    await page.waitForTimeout(800);
    const hiddenLater = await qa(page, () => window.__dataArenaQA.snapshot().time);
    await setHidden(false);
    await page.evaluate(() => { delete document.hidden; delete document.visibilityState; });
    report.backgroundTest = 'EMULATED_VISIBILITYCHANGE_HEADLESS';
    check('backgrounding pauses the match and stops game time', hidden.state === 'PAUSE' && hiddenLater === hidden.time, { hidden, hiddenLater });
    await shot(page, 'desktop-04-paused-after-background');
    // Low quality from the pause menu remounts the scene at resolution 1.
    await page.locator('.da-panel--pause .da-toggle').nth(1).click();
    diag = await qa(page, () => window.__dataArenaQA.diagnostics());
    check('low quality applies (scene + pixel ratio cap)', diag.scene.quality === 'low' && diag.stage.resolution === 1, { quality: diag.scene.quality, resolution: diag.stage.resolution });
    await page.locator('.da-panel--pause .da-toggle').nth(1).click();
    await page.click('.da-panel--pause .da-btn--primary');
    await waitState(page, 'PLAY');
    // Resize mid-match.
    await page.setViewportSize({ width: 900, height: 640 });
    await page.waitForFunction(() => window.__dataArenaQA.diagnostics().stage.viewport.width === 900, null, { timeout: 5000 }).catch(() => {});
    diag = await qa(page, () => window.__dataArenaQA.diagnostics());
    check('resize reaches the shared stage', diag.stage.viewport.width === 900 && diag.stage.viewport.height === 640, diag.stage.viewport);
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.waitForFunction(() => window.__dataArenaQA.diagnostics().stage.viewport.width === 1280, null, { timeout: 5000 }).catch(() => {});

    // Full match with the autopilot (restart from the pause menu so it starts at 0:00).
    if (!process.env.ARENA_SKIP_FULL) {
      await page.keyboard.press('Escape');
      await waitState(page, 'PAUSE');
      await page.locator('.da-panel--pause .da-btn', { hasText: /重新開始|Restart/ }).click();
      await waitState(page, 'PLAY', 45000);
      const full = await autopilotMatch(page, { prefix: 'desktop-full' });
      report.runs.push({ kind: 'full', outcome: full.snap.result.outcome, timeSeconds: full.snap.result.timeSeconds, score: full.snap.result.score,
        level: full.snap.result.level, levelUps: full.levelUps, decisions: full.decisions, wallSeconds: full.seconds, stats: full.snap.result.stats,
        upgrades: full.snap.result.upgrades });
      check('a full match reaches a result', ['VICTORY', 'DEFEAT', 'TIMEOUT'].includes(full.snap.result.outcome), full.snap.result.outcome);
      check('at least three level-up choices in a full match', full.levelUps >= 3, full.levelUps);
      diag = await qa(page, () => window.__dataArenaQA.diagnostics());
      report.performance = { desktopHigh: { arenaUpdateMs: diag.arenaUpdateMs, frameMsMedian: diag.scene.frameMsMedian, frameMsP95: diag.scene.frameMsP95,
        particlePeak: diag.scene.particlePeak, viewport: diag.stage.viewport, resolution: diag.stage.resolution } };
    }

    // Five consecutive restarts: no extra ticker callbacks, bundles reused.
    for (let i = 0; i < 5; i++) {
      const state = await qa(page, () => window.__dataArenaQA.state());
      if (state === 'RESULT') await page.click('.da-panel--result .da-btn--primary');
      else {
        if (state === 'PLAY') { await page.keyboard.press('Escape'); await waitState(page, 'PAUSE'); }
        await page.locator('.da-panel--pause .da-btn', { hasText: /重新開始|Restart/ }).click();
      }
      await waitState(page, 'PLAY', 45000);
      await page.keyboard.down('KeyD'); await page.mouse.move(1000, 300); await page.mouse.down();
      await page.waitForTimeout(700);
      await page.mouse.up(); await page.keyboard.up('KeyD');
      diag = await qa(page, () => window.__dataArenaQA.diagnostics());
      check(`restart ${i + 1}: ticker callbacks stay at ${baseTicker}`, diag.tickerListeners === baseTicker, diag.tickerListeners);
    }
    report.runs.push({ kind: 'restarts', count: 5 });

    // Exit to title, then re-enter and leave again.
    await page.keyboard.press('Escape');
    await waitState(page, 'PAUSE');
    await page.locator('.da-panel--pause .da-btn', { hasText: /離開競技場|Leave the arena/ }).click();
    await page.waitForFunction(() => !document.querySelector('.da-root') && !document.getElementById('cm-title').hidden);
    check('exit returns to the title and removes the arena', await page.locator('#cm-data-arena').isVisible());
    diag = await page.evaluate(() => ({ qa: typeof window.__dataArenaQA, canvases: document.querySelectorAll('canvas').length }));
    check('exit releases the QA hook and leaves no arena canvas in the page', diag.qa === 'undefined' && diag.canvases === 0, diag);
    await openArena(page);
    await startFromSelect(page, 2);
    await page.waitForTimeout(1500);
    await shot(page, 'desktop-05-reenter-frost');
    await page.keyboard.press('Escape');
    await waitState(page, 'PAUSE');
    await page.locator('.da-panel--pause .da-btn', { hasText: /離開競技場|Leave the arena/ }).click();
    await page.waitForFunction(() => !document.querySelector('.da-root'));
    const saveAfter = await page.evaluate((key) => localStorage.getItem(key), SAVE_KEY);
    const arenaRecord = await page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), ARENA_KEY);
    check('the raising save is byte-identical after arena play', saveAfter === saveBefore);
    check('arena records live under their own key', arenaRecord?.schema === 'dataArena.v1', arenaRecord && { runs: arenaRecord.runs, wins: arenaRecord.wins, best: arenaRecord.bestScore });
    await context.close();

    // ------------------------------------------------------------ phone 390x844 touch
    const phone = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true, deviceScaleFactor: 3 });
    const mobile = await phone.newPage();
    watch(mobile, 'phone');
    await mobile.goto(`${origin}/championship.html?arenaQa=1&arenaSeed=${seed + 1}`, { waitUntil: 'domcontentloaded' });
    await login(mobile);
    await mobile.tap('#cm-data-arena');
    await mobile.waitForSelector('.da-panel--select');
    await shot(mobile, 'phone-01-select');
    await mobile.tap('.da-panel--select .da-btn--primary');
    await mobile.waitForSelector('.da-panel--brief');
    await shot(mobile, 'phone-02-briefing');
    await mobile.tap('.da-panel--brief .da-btn--primary');
    await waitState(mobile, 'PLAY', 45000);
    await mobile.waitForTimeout(1000);
    const cdp = await phone.newCDPSession(mobile);
    const touchPoint = (id, x, y) => ({ x, y, id, radiusX: 4, radiusY: 4, force: 1 });
    const start = await qa(mobile, () => window.__dataArenaQA.snapshot().player);
    // Left stick: hold and drag to move; right stick: drag to aim and fire.
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint(1, 90, 640)] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touchPoint(1, 90, 590)] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [touchPoint(1, 90, 590), touchPoint(2, 300, 520)] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [touchPoint(1, 90, 590), touchPoint(2, 345, 480)] });
    await mobile.waitForTimeout(900);
    const moving = await qa(mobile, () => window.__dataArenaQA.snapshot());
    await shot(mobile, 'phone-03-twin-stick');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    check('left touch stick moves the partner', moving.player.y < start.y - 20, { from: start.y, to: moving.player.y });
    check('right touch stick aims and holds the beam', moving.laser.firing || moving.laser.heat > 5, moving.laser);
    const charges = (await qa(mobile, () => window.__dataArenaQA.snapshot().player)).dashCharges;
    await mobile.tap('.da-tbtn--dash');
    await mobile.waitForTimeout(100);
    const dashed = await qa(mobile, () => window.__dataArenaQA.snapshot().player);
    check('touch dash button dashes', dashed.dashCharges < charges || dashed.state === 'DASH', { charges, dashed: dashed.dashCharges });
    const layout = await mobile.evaluate(() => ({ scrollX, scrollY, scale: visualViewport?.scale ?? 1, width: innerWidth, height: innerHeight,
      docWidth: document.documentElement.scrollWidth, buttons: [...document.querySelectorAll('.da-tbtn, .da-hud__pause')].map((b) => { const r = b.getBoundingClientRect(); return [Math.round(r.width), Math.round(r.height), Math.round(r.right), Math.round(r.bottom)]; }) }));
    check('touch play never scrolls or zooms the page', layout.scrollX === 0 && layout.scrollY === 0 && layout.scale === 1 && layout.docWidth <= layout.width, layout);
    check('touch controls are at least 44 CSS px and on screen', layout.buttons.every(([w, h, r, b]) => w >= 44 && h >= 44 && r <= layout.width && b <= layout.height), layout.buttons);
    await mobile.waitForTimeout(3000);
    await shot(mobile, 'phone-04-combat');
    diag = await qa(mobile, () => window.__dataArenaQA.diagnostics());
    report.performance = { ...(report.performance ?? {}), phoneEmulated: { quality: diag.scene.quality, resolution: diag.stage.resolution, arenaUpdateMs: diag.arenaUpdateMs,
      frameMsMedian: diag.scene.frameMsMedian, note: 'Chromium mobile emulation with software WebGL; not a physical-device measurement.' } };
    check('phone defaults to low quality', diag.scene.quality === 'low', diag.scene.quality);
    await mobile.tap('.da-hud__pause');
    await waitState(mobile, 'PAUSE');
    await shot(mobile, 'phone-05-pause');
    await mobile.tap('.da-panel--pause .da-btn--quiet');
    await mobile.waitForFunction(() => !document.querySelector('.da-root'));
    await phone.close();

    const unexpected = report.errors.filter((entry) => !/favicon/.test(entry.url ?? ''));
    report.unexpectedErrors = unexpected;
    check('no page errors, console errors, failed requests or HTTP errors', unexpected.length === 0, unexpected.slice(0, 5));
    report.passed = true;
  } catch (error) {
    report.passed = false;
    report.failure = error.message;
    throw error;
  } finally {
    fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2) + '\n');
    await browser.close();
  }
  console.log(JSON.stringify({ passed: report.passed, checks: report.checks.length, runs: report.runs, performance: report.performance, renderer: report.renderer }, null, 1));
})().catch((error) => { console.error(error); process.exit(1); });

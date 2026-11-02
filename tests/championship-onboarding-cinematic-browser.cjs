// New Game onboarding gate (Owner 2026-11-02 Ai-chan layered v3; the 2026-10-28
// licence / incubator / pod / tactical guide flow it leads into is unchanged).
//
// Story: approved 16:9 background video, Ai-chan's transparent picture, DOM text
// and Hexagon Cradles music as four separate layers; the reader's own keys
// (tap, previous, play-from-start, skip) and the cat / catgirl choice; reading
// resumes after a reload; reduced motion, a hidden page, a background that
// cannot load and an orientation change; the choice persists, appears in the
// tutorial guide and in Settings; music continues from the story into the
// tutorial without restarting and follows mute and volume.
//
// Everything is driven through the player's own controls. Storage is read only
// to confirm what the game wrote, and cleared only at the start of a scenario.
// It refuses the Owner's 8732 origin; run it against an isolated server:
//   CHAMPIONSHIP_QA_URL=http://127.0.0.1:<port>/championship.html
// CHAMPIONSHIP_QA_SHOTS=<dir> keeps the screenshots it takes.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { chromium, devices } = require('playwright');
const { login, playStory } = require('./championship-browser-opening.cjs');

const url = process.env.CHAMPIONSHIP_QA_URL;
if (!url) throw new Error('Set CHAMPIONSHIP_QA_URL to an isolated QA server');
if (new URL(url).port === '8732') throw new Error('Refusing the Owner save origin 8732');
const SHOTS = process.env.CHAMPIONSHIP_QA_SHOTS || null;
if (SHOTS) fs.mkdirSync(SHOTS, { recursive: true });
const INSET = { top: 47, bottom: 34 };
const PREFERENCES_KEY = 'championshipModernSave:preferences:v1';
const report = { scenarios: {}, consoleErrors: [], baselineIssues: [] };
// Present at the base commit and untouched here: the eight-egg chooser's pictures point at
// local-reference files that are not in Git (src/championship/app/openingEggChoices.js).
// They are reported, not hidden, and they do not fail this gate.
const BASELINE_MISSING = /^http 404: \/assets\/production\/internal-character-review\/e00[0-7]_digitama-dot-intake-r01\/hud-r01\/main-cell_000\.png$/;
function collect(label, errors, allowed = null) {
  for (const error of errors) {
    if (BASELINE_MISSING.test(error)) { if (!report.baselineIssues.includes(error)) report.baselineIssues.push(error); }
    else if (!allowed?.test(error)) report.consoleErrors.push(label + ' ' + error);
  }
}

async function open(browser, { viewport, mobile = false, reducedMotion = 'no-preference', insets = null, block = null } = {}) {
  const context = await browser.newContext({ ...(mobile ? devices['iPhone 13'] : {}), viewport, reducedMotion });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [];
  page.on('pageerror', error => errors.push('pageerror: ' + error.message));
  // A failed request is reported with its URL, so a missing file is named, not just counted.
  page.on('console', message => { if (message.type() === 'error' && !/^Failed to load resource/.test(message.text())) errors.push('console: ' + message.text()); });
  page.on('response', response => { if (response.status() >= 400) errors.push(`http ${response.status()}: ${new URL(response.url()).pathname}`); });
  page.on('requestfailed', request => { const failure = request.failure()?.errorText ?? ''; if (!/ERR_ABORTED/.test(failure)) errors.push(`requestfailed ${failure}: ${new URL(request.url()).pathname}`); });
  if (insets) {
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top: insets.top, topMax: insets.top, bottom: insets.bottom, bottomMax: insets.bottom, left: 0, leftMax: 0, right: 0, rightMax: 0 } });
  }
  if (block) await page.route(block, route => route.abort('failed'));
  await page.goto(url, { waitUntil: 'networkidle' });
  await page.evaluate(() => localStorage.clear());
  await page.reload({ waitUntil: 'networkidle' });
  return { context, page, errors };
}
const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, `${name}.png`) }); };
const story = page => page.evaluate(() => {
  const root = document.querySelector('.cm-opening-story'), video = root?.querySelector('video'), guide = root?.querySelector('.cm-ai-chan');
  return root ? { id: root.dataset.beatId, kind: root.dataset.beatKind, typing: root.dataset.typing, busy: root.getAttribute('aria-busy'),
    guide: root.dataset.guide, form: guide?.dataset.appearance ?? null, backdrop: root.dataset.backdrop, hold: root.dataset.backdropHold,
    status: root.querySelector('.cm-opening-story__status')?.hidden ? null : root.querySelector('.cm-opening-story__status')?.textContent,
    time: video?.currentTime ?? null, paused: video?.paused ?? null, muted: video?.muted ?? null, src: video?.getAttribute('src') ?? null } : null;
});
const music = page => page.evaluate(() => JSON.parse(document.documentElement.dataset.musicState || 'null'));
const prefs = page => page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), PREFERENCES_KEY);
const tapStory = async page => { const size = page.viewportSize(); await page.locator('.cm-opening-story').click({ position: { x: size.width / 2, y: size.height * 0.42 }, force: true }); };
async function waitBeat(page, id) { await page.waitForFunction(id => { const r = document.querySelector('.cm-opening-story'); return r?.dataset.beatId === id && r.getAttribute('aria-busy') === 'false'; }, id); }
async function waitTyped(page) { await page.waitForFunction(() => document.querySelector('.cm-opening-story')?.dataset.typing === 'false'); }
async function readTo(page, id, limit = 60) {
  for (let i = 0; i < limit; i++) {
    const s = await story(page);
    if (s?.id === id) return;
    if (s?.busy === 'false') await tapStory(page);
    await page.waitForTimeout(110);
  }
  throw new Error('did not reach ' + id);
}
/** The reader's own return key: back to the title, keeping the page bookmark and the chosen form. */
async function returnToTitle(page, expectBookmark) {
  const key = page.locator('[data-story-action="title"]');
  const b = await key.boundingBox(), size = page.viewportSize();
  assert.ok(b && b.width >= 44 && b.height >= 44 && b.x >= 0 && b.x + b.width <= size.width && b.y >= 0 && b.y + b.height <= size.height, `return key is a visible 44px target ${JSON.stringify(b)}`);
  assert.equal(await key.getAttribute('aria-label'), await key.locator('.cm-cutscene__tool-label').textContent(), 'return key has its localized name');
  const before = await story(page);
  await key.click();
  await page.waitForFunction(() => document.getElementById('cm-opening').hidden && !document.querySelector('.cm-opening-story') && !document.querySelector('.cm-opening-story__video'));
  await page.locator('#cm-new-game').waitFor({ state: 'visible' });
  // No game was started and the bookmark is the page that was open (the click did not advance it).
  assert.equal(await page.evaluate(() => document.getElementById('cm-title').hidden), false);
  await page.waitForFunction(([key, id]) => JSON.parse(localStorage.getItem(key) || '{}').device?.openingStoryResume === id, [PREFERENCES_KEY, expectBookmark]);
  assert.equal(before.id, expectBookmark);
}
async function newGame(page) {
  await page.click('#cm-new-game');
  const replace = page.locator('dialog.cm-dialog [data-action="new"]');
  if (await replace.isVisible().catch(() => false)) await replace.click();
  await page.locator('.cm-opening-story').waitFor();
  // Never wait out a slow background: the text is readable at once.
  await page.waitForFunction(() => document.querySelector('.cm-opening-story')?.getAttribute('aria-busy') === 'false', null, { timeout: 15000 });
}
/** Envelope → letter → licence → mail → incubator → pod, through the forms' own controls. */
async function finishOpening(page, { trainerName = '星野', eggName = '小焰', egg = 1 } = {}) {
  await page.click('.cm-opening__envelope');
  await page.click('.cm-opening__letter button');
  await page.fill('#cm-opening-name', trainerName);
  await page.click('.cm-opening__name button[type=submit]');
  await page.locator('.cm-opening__choices button').first().click();
  await page.click('.cm-opening__envelope');
  await page.click('.cm-opening__letter button');
  await page.click('.cm-opening__letter button');
  if (await page.locator('.cm-opening__egg-choice').count()) {
    await page.locator(`input[name="starterEgg"][value="${egg}"]`).check();
    await page.click('[data-egg-confirm]');
  }
  await page.fill('#cm-opening-name', eggName);
  await page.click('.cm-opening__name button[type=submit]');
  await page.waitForFunction(() => document.getElementById('cm-root')?.dataset.activeScreen === 'RAISING_HOME'
    && ['ready', 'error'].includes(document.querySelector('.int-rh2-field-host')?.dataset.loadState), null, { timeout: 120000 });
}
const box = (page, selector) => page.locator(selector).first().evaluate(node => { const r = node.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right, width: r.width, height: r.height }; });

async function portraitStoryAndTutorial(browser) {
  // 390x844 with a notch and a home indicator: the full New Game path into the tutorial.
  const { context, page, errors } = await open(browser, { viewport: { width: 390, height: 844 }, mobile: true, insets: INSET });
  const out = {};
  try {
    await login(page);
    await newGame(page);
    await waitBeat(page, 'world-1');
    let s = await story(page);
    assert.equal(s.src, 'assets/production/opening/ai-chan-layered-v3-20261103/background.mp4');
    assert.equal(s.muted, true, 'the background video never carries sound');
    assert.equal(s.guide, 'hidden', 'Ai-chan is not part of the opening scenes');
    assert.equal(await page.locator('.cm-cutscene__panel').count(), 0, 'no comic panels; the video is the backdrop');
    const skip = await box(page, '.cm-cutscene__skip'), dialogue = await box(page, '.cm-cutscene__dialogue');
    assert.ok(skip.top >= INSET.top, `skip below the status bar (${skip.top})`);
    assert.ok(dialogue.bottom <= 844 - INSET.bottom + 1, `text above the home indicator (${dialogue.bottom})`);
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollHeight <= innerHeight + 1), 'no page scroll');
    for (const selector of ['.cm-cutscene__skip', '[data-story-action="previous"]', '[data-story-action="replay"]']) {
      const b = await box(page, selector); assert.ok(b.width >= 44 && b.height >= 44, `${selector} is a 44px target`);
    }
    // Text and video are separate layers: the video is behind the dialogue and its own object-fit fills the phone.
    const layers = await page.evaluate(() => { const v = document.querySelector('.cm-opening-story__video'); return { fit: getComputedStyle(v).objectFit, z: getComputedStyle(document.querySelector('.cm-opening-story__backdrop')).zIndex }; });
    assert.deepEqual(layers, { fit: 'cover', z: '0' }, 'portrait frames the same 16:9 video centre');
    await waitTyped(page);
    await page.waitForTimeout(1200);
    s = await story(page);
    assert.ok(s.time > 0.3 && s.time <= 4, `world-1 plays its own segment (${s.time})`);
    assert.equal((await music(page)).cue, 'hexagon_cradles');
    await shot(page, 'portrait-01-world');
    // Tap semantics: a revealed page advances; a typing page completes first.
    await tapStory(page);
    s = await story(page); assert.deepEqual([s.id, s.typing], ['world-2', 'true']);
    await tapStory(page);
    s = await story(page); assert.deepEqual([s.id, s.typing], ['world-2', 'false']);
    // Previous page, then read on to the rift; the background follows the page.
    await page.click('[data-story-action="previous"]');
    await waitBeat(page, 'world-1');
    await readTo(page, 'rift-1');
    await page.waitForTimeout(600);
    s = await story(page); assert.ok(s.time >= 17 && s.time < 20.5, `rift page shows the rift scene (${s.time})`);
    const musicBefore = await music(page);
    // Interruption: reload in the middle of the story, then New Game again.
    await page.waitForTimeout(400);
    await page.reload({ waitUntil: 'networkidle' });
    assert.equal((await prefs(page))?.device?.openingStoryResume, 'rift-1', 'the bookmark was written before the reload');
    await login(page);
    await newGame(page);
    await waitBeat(page, 'rift-1');
    s = await story(page);
    assert.ok(s.status, 'the resume is announced');
    await page.waitForTimeout(800);
    s = await story(page);
    assert.ok(s.time >= 17 && s.time < 20.5, `resumed at the rift scene (${s.time})`);
    await shot(page, 'portrait-02-resumed-rift');
    out.resume = { page: s.id, videoTime: s.time, status: s.status };
    // Play from start really starts over; it is not the same as resuming.
    await page.click('[data-story-action="replay"]');
    await waitBeat(page, 'world-1');
    s = await story(page); assert.ok(s.time < 4, `replay restarts the background (${s.time})`); assert.equal(s.status, null);
    // Skip still meets Ai-chan while no form is chosen: greeting, then the choice.
    await page.click('.cm-cutscene__skip');
    await waitBeat(page, 'ai-greeting');
    await waitTyped(page);
    await page.waitForTimeout(500);
    s = await story(page);
    assert.deepEqual([s.guide, s.form], ['visible', 'cat']);
    assert.ok(s.time >= 38 && s.time < 50, `Ai-chan appears in the 38-50 s window (${s.time})`);
    await shot(page, 'portrait-03-greeting-cat');
    await tapStory(page); await waitTyped(page); s = await story(page); assert.equal(s.id, 'ai-surprise');
    await page.click('.cm-cutscene__skip');
    await waitBeat(page, 'ai-choose');
    await waitTyped(page);
    s = await story(page); assert.equal(s.form, 'catgirl', 'she changes form before asking');
    // The cat's paws and the catgirl's legs stay outside the half-body window.
    const crop = await page.evaluate(() => { const w = document.querySelector('.cm-opening-story__guide .cm-ai-chan').getBoundingClientRect(); return { w: w.width, h: w.height }; });
    assert.ok(Math.abs(crop.h / crop.w - 0.815) < 0.01, JSON.stringify(crop));
    await shot(page, 'portrait-04-choose');
    for (const b of await page.locator('[data-story-choice]').all()) { const r = await b.boundingBox(); assert.ok(r.height >= 44); }
    // Return to the title on the choice page itself, then New Game resumes at the same choice.
    await returnToTitle(page, 'ai-choose');
    await shot(page, 'portrait-04b-returned-title');
    assert.equal(await page.evaluate(key => JSON.parse(localStorage.getItem(key) || '{}').account?.guideAppearance ?? '', PREFERENCES_KEY), '', 'returning never picks a form');
    await newGame(page);
    await waitBeat(page, 'ai-choose');
    await waitTyped(page);
    assert.ok((await story(page)).status, 'the resume is announced after a return to title');
    out.returnToTitle = { from: 'ai-choose', resumedAt: (await story(page)).id };
    await page.click('[data-story-choice="catgirl"]');
    await waitBeat(page, 'ai-ready');
    s = await story(page); assert.equal(s.form, 'catgirl');
    // The preference store writes shortly after a change (and at once on page hide).
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) || '{}').account?.guideAppearance === 'catgirl', PREFERENCES_KEY);
    await waitTyped(page);
    await shot(page, 'portrait-05-ready-catgirl');
    // With a form chosen, skip ends the story.
    await page.click('.cm-cutscene__skip');
    await page.locator('.cm-opening__envelope').waitFor();
    const storyMusic = await music(page);
    assert.equal(storyMusic.cue, 'hexagon_cradles');
    await finishOpening(page);
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) || '{}').device?.openingStoryResume === undefined, PREFERENCES_KEY);
    const invite = page.locator('dialog.cm-dialog[data-variant="tutorial-guide"][open]');
    await invite.waitFor();
    const tutorialMusic = await music(page);
    assert.equal(tutorialMusic.cue, 'hexagon_cradles', 'the tutorial keeps the story music');
    assert.equal(tutorialMusic.starts, storyMusic.starts, 'story → tutorial does not restart the music');
    assert.ok(tutorialMusic.voices <= 1, 'never two copies playing');
    const head = await page.evaluate(() => { const d = document.querySelector('dialog.cm-dialog[data-variant="tutorial-guide"][open]'); return { name: d.querySelector('.cm-guide-name')?.textContent, form: d.querySelector('.cm-guide-head .cm-ai-chan')?.dataset.appearance, label: d.querySelector('.cm-guide-head .cm-ai-chan')?.getAttribute('aria-label') }; });
    assert.deepEqual([head.name, head.form], ['愛醬', 'catgirl']);
    await shot(page, 'portrait-06-tutorial-invite-catgirl');
    await invite.locator('[data-action="accept"]').click();
    await page.locator('dialog.cm-dialog[data-variant="tutorial-guide"][open] .cm-guide-step').filter({ hasText: 'STEP 1 / 10' }).waitFor();
    const strip = await page.evaluate(() => ({ form: document.querySelector('.cm-tutorial-guidance .cm-ai-chan')?.dataset.appearance, lesson: document.querySelector('.cm-tutorial-guidance .cm-guide-lesson-name')?.textContent }));
    assert.equal(strip.form, 'catgirl'); assert.match(strip.lesson, /^愛醬 · /);
    await shot(page, 'portrait-07-tutorial-step1');
    // Tutorial interruption: reload and Continue resumes the tutorial, with the same guide and music.
    await page.waitForTimeout(800);
    await page.reload({ waitUntil: 'networkidle' });
    await login(page);
    await page.waitForFunction(() => document.querySelector('#cm-continue')?.disabled === false);
    await page.click('#cm-continue');
    await page.waitForFunction(() => document.getElementById('cm-root')?.dataset.activeScreen === 'RAISING_HOME' && document.querySelector('.cm-tutorial-guidance:not([hidden])'), null, { timeout: 120000 });
    const resumed = await page.evaluate(() => ({ form: document.querySelector('.cm-tutorial-guidance .cm-ai-chan')?.dataset.appearance, stage: document.querySelector('.cm-tutorial-guidance')?.dataset.stage }));
    assert.equal(resumed.form, 'catgirl'); assert.ok(resumed.stage && resumed.stage !== 'invitation', JSON.stringify(resumed));
    await page.waitForFunction(() => JSON.parse(document.documentElement.dataset.musicState || '{}').cue === 'hexagon_cradles');
    out.tutorialResume = resumed;
    await shot(page, 'portrait-08-tutorial-resumed');
    // Mute stops the music; restoring the volume brings it back at the new level.
    out.music = { story: storyMusic.cue, tutorial: tutorialMusic.cue, startsAcrossHandOver: [storyMusic.starts, tutorialMusic.starts] };
    report.scenarios.portrait = out;
  } finally {
    collect('portrait', errors);
    await context.close();
  }
}

async function landscapeAndRotation(browser) {
  // 844x390: the whole 16:9 picture, Ai-chan beside the text; then a rotation mid-scene.
  const { context, page, errors } = await open(browser, { viewport: { width: 844, height: 390 }, mobile: true });
  const out = {};
  try {
    await login(page);
    await newGame(page);
    await waitBeat(page, 'world-1');
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.cm-opening-story__video')).objectFit), 'contain', 'landscape keeps the whole 16:9 frame');
    await waitTyped(page);
    await shot(page, 'landscape-01-world');
    await page.click('.cm-cutscene__skip');
    await waitBeat(page, 'ai-greeting');
    await waitTyped(page);
    await page.waitForTimeout(400);
    const g = await box(page, '.cm-opening-story__guide'), d = await box(page, '.cm-cutscene__dialogue');
    assert.ok(g.right <= d.left + 2, `Ai-chan stands beside the text (${g.right} / ${d.left})`);
    assert.ok(await page.evaluate(() => document.scrollingElement.scrollHeight <= innerHeight + 1 && document.scrollingElement.scrollWidth <= innerWidth + 1), 'no scroll');
    await shot(page, 'landscape-02-greeting');
    const before = await story(page);
    // Rotate to portrait and back: the same video element keeps its place.
    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(500);
    const turned = await story(page);
    assert.equal(turned.id, before.id); assert.ok(turned.time >= before.time - 0.05 && turned.time < 50, `rotation keeps the background position (${before.time} → ${turned.time})`);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.cm-opening-story__video')).objectFit), 'cover');
    const pg = await box(page, '.cm-opening-story__guide'), pd = await box(page, '.cm-cutscene__dialogue');
    assert.ok(pg.bottom <= pd.top + 2, `portrait: Ai-chan above the text (${pg.bottom} / ${pd.top})`);
    await shot(page, 'rotate-portrait-greeting');
    await page.setViewportSize({ width: 844, height: 390 });
    await page.waitForTimeout(300);
    await page.click('.cm-cutscene__skip');
    await waitBeat(page, 'ai-choose');
    await waitTyped(page);
    await shot(page, 'landscape-03-choose');
    await page.click('[data-story-choice="cat"]');
    await waitBeat(page, 'ai-ready');
    assert.equal((await story(page)).form, 'cat');
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) || '{}').account?.guideAppearance === 'cat', PREFERENCES_KEY);
    await waitTyped(page);
    await shot(page, 'landscape-04-ready-cat');
    // Landscape return key: the chosen form and the page both survive the trip to the title.
    await returnToTitle(page, 'ai-ready');
    await newGame(page);
    await waitBeat(page, 'ai-ready');
    assert.equal((await story(page)).form, 'cat', 'the stored form is kept across a return to title');
    out.returnToTitle = { from: 'ai-ready', form: 'cat' };
    // Read to the end page by page; nothing advances on its own.
    const reading = await playStory(page, { story: 'read', guideAppearance: 'cat' });
    assert.ok(reading.pages.includes('invitation-2'), reading.pages.join(','));
    out.pagesRead = reading.pages.length;
    report.scenarios.landscape = out;
  } finally {
    collect('landscape', errors);
    await context.close();
  }
}

async function desktopReducedMotionHiddenAndSettings(browser) {
  const { context, page, errors } = await open(browser, { viewport: { width: 1366, height: 768 }, reducedMotion: 'reduce' });
  const out = {};
  try {
    await login(page);
    // Settings → Appearance: the guide's form can be chosen before (or without) the story.
    await page.click('#cm-title-settings');
    await page.locator('dialog.cm-settings[open], .cm-settings[open]').first().waitFor();
    await page.locator('[data-category="appearance"]').first().click();
    const setting = page.locator('[data-setting="guideAppearance"]');
    await setting.waitFor();
    assert.equal(await setting.locator('input:checked').getAttribute('value'), 'cat', 'not chosen yet reads as the cat');
    assert.equal(await setting.locator('.cm-ai-chan').count(), 2, 'both forms are previewed');
    await setting.scrollIntoViewIfNeeded();
    await page.evaluate(() => Promise.all([...document.querySelectorAll('[data-setting="guideAppearance"] .cm-ai-chan img')].map(img => img.decode())));
    await page.waitForTimeout(400);
    // Each preview really shows its form: the shown picture is loaded, opaque and covers the frame's centre.
    const previews = await page.evaluate(() => [...document.querySelectorAll('[data-setting="guideAppearance"] .cm-ai-chan')].map(root => {
      const frame = root.getBoundingClientRect(), img = root.querySelector(`img[data-form="${root.dataset.appearance}"]`), pic = img.getBoundingClientRect();
      const cx = frame.left + frame.width / 2, cy = frame.top + frame.height / 2;
      return { form: root.dataset.appearance, size: [Math.round(frame.width), Math.round(frame.height)], loaded: img.naturalWidth > 0, opacity: getComputedStyle(img).opacity,
        visible: getComputedStyle(img).display !== 'none', covers: pic.left <= cx && pic.right >= cx && pic.top <= cy && pic.bottom >= cy };
    }));
    assert.deepEqual(previews.map(p => p.form), ['cat', 'catgirl']);
    for (const p of previews) assert.ok(p.size[0] >= 40 && p.size[1] >= 40 && p.loaded && p.visible && p.opacity === '1' && p.covers, JSON.stringify(p));
    out.settingsPreviews = previews;
    await shot(page, 'desktop-01-settings-appearance');
    await setting.locator('input[value="catgirl"]').check({ force: true });
    await page.locator('.cm-settings__close').first().click();
    await page.waitForFunction(key => JSON.parse(localStorage.getItem(key) || '{}').account?.guideAppearance === 'catgirl', PREFERENCES_KEY);
    await newGame(page);
    await waitBeat(page, 'world-1');
    await waitTyped(page);
    await page.waitForTimeout(800);
    let s = await story(page);
    // Reduced motion: the background holds a still of the page's own scene and never plays.
    assert.equal(s.paused, true); assert.ok(s.time >= 0 && s.time <= 4, `still from world-1 (${s.time})`);
    assert.equal(await page.evaluate(() => getComputedStyle(document.querySelector('.cm-opening-story__video')).objectFit), 'contain');
    await shot(page, 'desktop-02-reduced-motion-world');
    // The form was already chosen in Settings, so skip ends the story at once.
    await page.click('.cm-cutscene__skip');
    await page.locator('.cm-opening__envelope').waitFor();
    out.reducedMotion = { paused: s.paused, time: s.time };
    report.scenarios.desktopReduced = out;
  } finally {
    collect('desktop-reduced', errors);
    await context.close();
  }
}

async function desktopHiddenAndMusic(browser) {
  const { context, page, errors } = await open(browser, { viewport: { width: 1366, height: 768 } });
  const out = {};
  const sound = async change => {
    await page.click('#cm-title-settings');
    await page.locator('[data-category="sound"]').first().click();
    await page.locator('[data-setting="muted"]').waitFor();
    await change();
    await page.locator('.cm-settings__close').first().click();
  };
  try {
    await login(page);
    // Saved mute: the story music is selected but nothing plays.
    await sound(() => page.locator('[data-setting="muted"] input').check({ force: true }));
    await newGame(page);
    await waitBeat(page, 'world-1');
    await page.waitForTimeout(800);
    let m = await music(page);
    assert.deepEqual([m.cue, m.voices], ['hexagon_cradles', 0], 'muted: the cue is chosen, nothing plays');
    // Back to the title (the reading position is kept), unmute and halve the music volume.
    await page.waitForTimeout(300);
    await page.reload({ waitUntil: 'networkidle' });
    await login(page);
    await sound(async () => {
      await page.locator('[data-setting="muted"] input').uncheck({ force: true });
      await page.locator('[data-setting="musicVolume"] input[type=range]').fill('50');
    });
    await page.waitForFunction(key => { const p = JSON.parse(localStorage.getItem(key) || '{}'); return p.device?.musicVolume === 50 && p.device?.muted === undefined; }, PREFERENCES_KEY);
    await newGame(page);
    await waitBeat(page, 'world-1');
    await page.waitForFunction(() => { const m = JSON.parse(document.documentElement.dataset.musicState || '{}'); return m.cue === 'hexagon_cradles' && m.voices === 1; }, null, { timeout: 15000 });
    out.muteVolume = { muted: 'no voices', unmuted: 'one voice at musicVolume 50' };
    await waitTyped(page);
    await page.waitForTimeout(600);
    let s = await story(page);
    assert.equal(s.paused, false, 'the background plays its page');
    // A hidden page pauses the background and the music; showing it again resumes both.
    await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, get: () => true }); Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(300);
    s = await story(page); const hiddenMusic = await music(page);
    assert.equal(s.paused, true); assert.equal(hiddenMusic.voices, 0);
    const hiddenAt = s.time;
    await page.evaluate(() => { delete document.hidden; delete document.visibilityState; document.dispatchEvent(new Event('visibilitychange')); });
    await page.waitForTimeout(700);
    s = await story(page);
    assert.ok(s.paused === false || s.hold === 'true', 'resumes unless it already reached its hold frame');
    assert.ok(s.time >= hiddenAt, 'continues, never restarts');
    await page.waitForFunction(() => JSON.parse(document.documentElement.dataset.musicState).voices === 1);
    out.hidden = { pausedAt: hiddenAt, resumedAt: s.time };
    // A background page holds its last frame once its segment has played.
    await page.waitForFunction(() => document.querySelector('.cm-opening-story')?.dataset.backdropHold === 'true', null, { timeout: 8000 });
    s = await story(page); assert.equal(s.paused, true); assert.ok(s.time < 4 && s.time > 3.5, `holds before the next scene (${s.time})`);
    out.hold = s.time;
    await page.click('.cm-cutscene__skip');
    await waitBeat(page, 'ai-greeting');
    await waitTyped(page);
    await shot(page, 'desktop-03-greeting-cat');
    report.scenarios.desktopHidden = out;
  } finally {
    collect('desktop-hidden', errors);
    await context.close();
  }
}

async function englishStory(browser) {
  // The whole story follows the language chosen on the title (product-authored translation).
  const { context, page, errors } = await open(browser, { viewport: { width: 1366, height: 768 } });
  const out = {};
  try {
    await login(page);
    await page.click('#cm-title-settings');
    await page.locator('[data-category="language"]').first().click();
    await page.locator('input[name="cm-setting-locale"][value="en"]').check({ force: true });
    await page.locator('.cm-settings__close').first().click();
    await newGame(page);
    await waitBeat(page, 'world-1');
    await waitTyped(page);
    const first = await page.locator('.cm-cutscene__line').getAttribute('aria-label');
    assert.match(first, /^Every day, countless voices/);
    await page.click('.cm-cutscene__skip');
    await waitBeat(page, 'ai-greeting');
    await waitTyped(page);
    assert.equal(await page.locator('.cm-cutscene__speaker').textContent(), 'Ai-chan');
    assert.match(await page.locator('.cm-cutscene__line').getAttribute('aria-label'), /I'm Ai-chan/);
    await page.click('.cm-cutscene__skip');
    await waitBeat(page, 'ai-choose');
    await waitTyped(page);
    assert.match(await page.locator('[data-story-choice="cat"]').textContent(), /kitten/i);
    await shot(page, 'english-01-choose');
    const run = await playStory(page, { story: 'read', guideAppearance: 'cat' });
    out.pages = run.pages.length; out.first = first.slice(0, 40);
    report.scenarios.english = out;
  } finally {
    collect('english', errors);
    await context.close();
  }
}

async function failedBackdropAndPortrait(browser) {
  // The background video and Ai-chan's pictures fail to load: the story stays readable and finishes.
  const { context, page, errors } = await open(browser, { viewport: { width: 390, height: 844 }, mobile: true,
    block: /ai-chan-layered-v3-20261103\/(background\.mp4|cat_idle\.webp|catgirl_idle\.webp)/ });
  const out = {};
  try {
    await login(page);
    await newGame(page);
    await waitBeat(page, 'world-1');
    await page.waitForFunction(() => document.querySelector('.cm-opening-story')?.dataset.backdrop === 'failed', null, { timeout: 15000 });
    const s = await story(page);
    assert.ok(s.status && s.status.length > 4, 'a readable status line explains the missing background');
    assert.ok((await page.locator('.cm-cutscene__line').getAttribute('aria-label')).length > 20, 'the page text is there');
    await shot(page, 'failed-01-world');
    await page.click('.cm-cutscene__skip');
    await waitBeat(page, 'ai-greeting');
    await page.waitForFunction(() => document.querySelector('.cm-opening-story__guide .cm-ai-chan')?.dataset.failed === 'true');
    await shot(page, 'failed-02-greeting-fallback');
    const run = await playStory(page, { story: 'skip', guideAppearance: 'catgirl' });
    assert.equal(run.choice, 'catgirl');
    await page.locator('.cm-opening__envelope').waitFor();
    out.status = s.status;
    report.scenarios.failedMedia = out;
  } finally {
    // The blocked requests themselves are expected console noise in this scenario.
    collect('failed-media', errors, /ai-chan-layered-v3-20261103\/(background\.mp4|cat_idle\.webp|catgirl_idle\.webp)/);
    await context.close();
  }
}

(async () => {
  const browser = await chromium.launch();
  try {
    await portraitStoryAndTutorial(browser);
    await landscapeAndRotation(browser);
    await desktopReducedMotionHiddenAndSettings(browser);
    await desktopHiddenAndMusic(browser);
    await englishStory(browser);
    await failedBackdropAndPortrait(browser);
    if (SHOTS) fs.writeFileSync(path.join(SHOTS, 'report.json'), JSON.stringify(report, null, 2));
    assert.deepEqual(report.consoleErrors, []);
    console.log(JSON.stringify(report, null, 2));
    console.log('ONBOARDING_CINEMATIC_PASS');
  } finally {
    if (SHOTS) fs.writeFileSync(path.join(SHOTS, 'report.json'), JSON.stringify(report, null, 2));
    await browser.close();
  }
})().catch(error => { console.error(error); process.exit(1); });

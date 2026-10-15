// GitHub-hosted evidence, not a public review menu or gameplay fixture.
// Fresh ephemeral context; normal onboarding and UI navigation only. Never installs
// a save, changes registration, invokes app intents, or writes browser storage.
// The only evaluated mutations are reversible inline CSS on the mounted hero holder.
// An automated capture pass leaves visual/anatomy/alpha acceptance PENDING.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const { pathToFileURL } = require('node:url');
const PUBLIC_BASE = 'https://orochi771127.github.io/championship-2026/';
const HERO = '.cm-vs2-root[data-screen="DATABASE"] .cm-dex-hero';
const EXPECTED = Object.freeze({
  117: Object.freeze({ speciesIndex: 117, speciesId: 'species-117', displayCode: 'MA58',
    src: 'assets/production/database-handpainted-r1-20261015/species-117.8f7d027cdbf6d3e6.png',
    sha256: '8f7d027cdbf6d3e6d57dbe2f9cb091e42687c01170d1f3ef58ba0413e504a681' }),
  55: Object.freeze({ speciesIndex: 55, speciesId: 'species-055', displayCode: 'GR29',
    src: 'assets/production/database-handpainted-r1-20261015/species-055.32e6689b5e9669c2.png',
    sha256: '32e6689b5e9669c26fb0d29f3201ace2d5d619309381ab628d57f5eabc5d693e' })
});
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function assertAsset(entry, bytes, expected) {
  for (const key of ['speciesIndex', 'speciesId', 'displayCode', 'src', 'sha256']) assert.equal(entry[key], expected[key], `Hero ${key} binding drift`);
  assert.equal(entry.width, 1254); assert.equal(entry.height, 1254);
  assert.equal(sha256(bytes), expected.sha256, 'Selected hero bytes drift');
  assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16), 1254); assert.equal(bytes.readUInt32BE(20), 1254);
}
function sizePlan(size, padding) {
  assert.ok([128, 256].includes(size));
  assert.deepEqual(padding, [24, 24, 24, 24], 'Existing normal 24px stage padding changed');
  return { size, width: size + padding[1] + padding[3], height: size + padding[0] + padding[2] };
}
function assertMeasured(snapshot, species, size = null) {
  const expected = EXPECTED[species];
  assert.equal(snapshot.speciesIndex, species); assert.equal(snapshot.displayCode, expected.displayCode);
  assert.equal(snapshot.rowState, 'UNDISCOVERED', 'Fresh review must not manufacture registration');
  assert.equal(snapshot.src, new URL(expected.src, PUBLIC_BASE).href);
  assert.equal(snapshot.art, 'ready'); assert.equal(snapshot.complete, true); assert.equal(snapshot.hidden, false);
  assert.deepEqual(snapshot.natural, [1254, 1254]); assert.equal(snapshot.objectFit, 'contain');
  assert.deepEqual(snapshot.padding, [24, 24, 24, 24]);
  if (species === 117) assert.equal(snapshot.title, '曙刃天駒');
  assert.equal(snapshot.documentOverflow, false, 'Document-level horizontal overflow');
  assert.ok(snapshot.imageRect.width > 0 && snapshot.imageRect.height > 0);
  if (size !== null) {
    const plan = sizePlan(size, snapshot.padding);
    for (const dim of ['width', 'height']) {
      assert.ok(Math.abs(snapshot.imageRect[dim] - size) <= 0.75, `Actual image ${dim} is not ${size} CSS px`);
      assert.ok(Math.abs(snapshot.holderRect[dim] - plan[dim]) <= 0.75, `Actual holder ${dim} differs from preserved-padding plan`);
    }
  }
}
// DOM observation only. No application/session objects or private APIs are read.
function mountedSnapshot() {
  const root = document.querySelector('.cm-vs2-root[data-screen="DATABASE"]');
  const row = root?.querySelector('.cm-vs2-database__row[data-selected="true"]');
  const detail = root?.querySelector('.cm-vs2-database__detail');
  const holder = detail?.querySelector('.cm-dex-hero');
  const image = holder?.querySelector('.cm-dex-hero__image');
  if (!row || !holder || !image) throw Error('NORMAL_DEX_NOT_VIEWABLE: no mounted normal hero; no unlock fallback is permitted');
  const hs = getComputedStyle(holder), is = getComputedStyle(image);
  const rect = el => { const r = el.getBoundingClientRect(); return { x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom }; };
  return { speciesIndex: Number(row.dataset.speciesIndex), displayCode: row.dataset.displayCode, rowState: row.dataset.state,
    title: detail.querySelector('h2')?.textContent, src: image.currentSrc || image.src, art: holder.dataset.art,
    complete: image.complete, hidden: image.hidden, natural: [image.naturalWidth, image.naturalHeight],
    holderRect: rect(holder), imageRect: rect(image), padding: [hs.paddingTop, hs.paddingRight, hs.paddingBottom, hs.paddingLeft].map(Number.parseFloat),
    holderStyle: holder.getAttribute('style'), cssHolderSize: [hs.width, hs.height], cssImageSize: [is.width, is.height],
    boxSizing: hs.boxSizing, objectFit: is.objectFit, imageRendering: is.imageRendering, imageOpacity: is.opacity, imageFilter: is.filter,
    background: hs.backgroundColor, theme: document.documentElement.dataset.theme ?? null,
    viewport: { width: innerWidth, height: innerHeight, dpr: devicePixelRatio },
    documentOverflow: document.documentElement.scrollWidth > innerWidth };
}
async function checkPolicy(repo) {
  const policyPath = path.join(repo, 'src/championship/app/friendsPlaytestPolicy.js');
  const { FRIENDS_PLAYTEST_POLICY: policy } = await import(pathToFileURL(policyPath).href);
  assert.equal(policy.enabled, true, 'Existing friends playtest is disabled; do not override it');
  assert.equal(policy.fullDexView, true, 'Normal full-Dex view is unavailable; do not force registration');
  const files = ['src/championship/app/friendsPlaytestPolicy.js', 'src/championship/app/main.js',
    'src/championship/app/championshipStandaloneApp.js', 'src/championship/database/databaseRuntime.js',
    'src/championship/app/vs4Screens.js', 'src/championship/app/vs2Styles.css'];
  const main = fs.readFileSync(path.join(repo, files[1]), 'utf8');
  const standalone = fs.readFileSync(path.join(repo, files[2]), 'utf8');
  const runtime = fs.readFileSync(path.join(repo, files[3]), 'utf8');
  assert.match(main, /playtestPolicy:\s*FRIENDS_PLAYTEST_POLICY/);
  assert.match(standalone, /fullView:\s*playtestPolicy\?\.enabled\s*===\s*true\s*&&\s*playtestPolicy\.fullDexView/);
  assert.match(runtime, /fullView\s*\?\s*\{\s*viewable:\s*true\s*\}/);
  return { enabled: policy.enabled, fullDexView: policy.fullDexView,
    sourceHashes: files.map(file => ({ file, sha256: sha256(fs.readFileSync(path.join(repo, file))) })) };
}
async function main() {
  const { chromium } = require('playwright');
  const { resolveAsset, serveBuild } = require('./alternate-form-browser-support.cjs');
  const root = path.resolve(process.env.CHAMPIONSHIP_QA_ARTIFACT || 'dist/github-playtest');
  const output = require('./browser-qa-output.cjs')('dex-portrait');
  fs.mkdirSync(output, { recursive: true });
  const evidence = { status: 'RUNNING', visualReview: 'PENDING_ROOT_SCREENSHOT_REVIEW',
    commit: process.env.GITHUB_SHA || null, candidateHeadCommit: process.env.DEX_QA_HEAD_SHA || null, baseCommit: process.env.DEX_QA_BASE_SHA || null,
    scope: 'Normal fresh public-playtest UI, mounted Dex 117/055, holder-only isolated size/backdrop overrides.',
    exclusions: ['No visual/anatomy/alpha PASS from automation', 'No runtime-action replacement', 'No physical-device acceptance', 'No public deployment claim'],
    captures: [], assetChecks: [], console: [], pageErrors: [], networkErrors: [], cleanupErrors: [] };
  const write = () => fs.writeFileSync(path.join(output, 'result.json'), JSON.stringify(evidence, null, 2) + '\n');
  let server, browser, context, page;
  const imageResponses = new Map();
  const imageJobs = [];
  async function shot(name) { if (page) await page.screenshot({ path: path.join(output, name + '.png'), fullPage: true }); }
  try {
    evidence.policy = await checkPolicy(process.cwd());
    const buildBytes = fs.readFileSync(path.join(root, 'pages-build.json'));
    const build = JSON.parse(buildBytes);
    assert.equal(build.target, 'GITHUB_PAGES_OWNER_PLAYTEST'); assert.equal(build.publicPlaytest?.ownerApproved, true);
    evidence.build = { buildId: build.buildId, target: build.target, manifestSha256: sha256(buildBytes) };
    assert.ok(resolveAsset(root, '/championship.html'));
    const catalog = JSON.parse(fs.readFileSync(path.join(root, 'src/data/championship/database-hero-portraits.r1.json')));
    assert.equal(catalog.entries.length, 51, 'This controlled candidate adds exactly one hero to the 50-entry baseline');
    assert.equal(new Set(catalog.entries.map(entry => entry.speciesIndex)).size, 51, 'No duplicate hero identities');
    for (const expected of Object.values(EXPECTED)) {
      const entry = catalog.entries.find(e => e.speciesIndex === expected.speciesIndex);
      assert.ok(entry, `Normal production registry missing ${expected.speciesId}`);
      const asset = resolveAsset(root, '/' + expected.src); assert.ok(asset, 'Selected PNG absent from approved build');
      const bytes = fs.readFileSync(asset); assertAsset(entry, bytes, expected);
      evidence.assetChecks.push({ speciesIndex: expected.speciesIndex, source: 'EXACT_BUILT_ARTIFACT', sha256: sha256(bytes), bytes: bytes.length });
    }
    server = await serveBuild(root);
    browser = await chromium.launch({ channel: 'chromium', headless: true, chromiumSandbox: true });
    evidence.browserVersion = browser.version(); evidence.launch = { channel: 'chromium', headless: true, chromiumSandbox: true, customArgs: [] };
    context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, deviceScaleFactor: 1, locale: 'zh-TW', serviceWorkers: 'block' });
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    // Existing repository exact-build routing pattern: no live/public provider is
    // contacted. Public-location code sees its approved URL and receives only the
    // byte-identical locally built files; no response body or runtime code is edited.
    await context.route('**/*', async route => {
      const url = route.request().url();
      if (url.startsWith(server.origin + '/')) return route.continue();
      if (url.startsWith(PUBLIC_BASE) && ['GET', 'HEAD'].includes(route.request().method())) {
        const parsed = new URL(url), relative = parsed.pathname.slice(new URL(PUBLIC_BASE).pathname.length);
        if (resolveAsset(root, '/' + relative)) {
          const response = await route.fetch({ url: server.origin + '/' + relative + parsed.search, maxRedirects: 0 });
          return route.fulfill({ response });
        }
      }
      evidence.networkErrors.push({ url, error: 'NON_BUILD_REQUEST_BLOCKED' });
      return route.abort();
    });
    page = await context.newPage(); page.setDefaultTimeout(90000);
    page.on('pageerror', error => evidence.pageErrors.push(error.message));
    page.on('console', message => evidence.console.push({ type: message.type(), text: message.text() }));
    page.on('requestfailed', request => { const error = request.failure()?.errorText; if (error !== 'net::ERR_ABORTED') evidence.networkErrors.push({ url: request.url(), error }); });
    page.on('response', response => {
      if (response.status() >= 400) evidence.networkErrors.push({ url: response.url(), status: response.status() });
      const expected = Object.values(EXPECTED).find(e => response.url() === new URL(e.src, PUBLIC_BASE).href);
      if (expected) imageJobs.push((async () => {
        const bytes = await response.body();
        const observed = { speciesIndex: expected.speciesIndex, source: 'BROWSER_IMAGE_RESPONSE', url: response.url(), status: response.status(), sha256: sha256(bytes), bytes: bytes.length };
        assert.equal(response.status(), 200); assert.equal(observed.sha256, expected.sha256);
        imageResponses.set(expected.speciesIndex, observed);
      })().catch(error => evidence.networkErrors.push({ url: response.url(), error: String(error) })));
    });
    await page.goto(PUBLIC_BASE + 'championship.html', { waitUntil: 'domcontentloaded' });
    await page.locator('#cm-login').waitFor({ state: 'visible' });
    await page.waitForFunction(() => document.querySelector('#cm-login')?.disabled === false);
    if (await page.locator('#cm-film-skip').isVisible()) {
      await page.locator('#cm-film-skip').click(); await page.locator('#cm-opening-film').waitFor({ state: 'hidden' });
      await page.waitForTimeout(400); // Existing real input guard; clocks are never changed.
    }
    await page.locator('#cm-login').click(); await page.locator('#cm-new-game').waitFor({ state: 'visible' });
    assert.equal(await page.locator('#cm-continue').isEnabled(), false, 'Ephemeral profile must start without a user save');
    await page.locator('#cm-new-game').click();
    const story = page.locator('.cm-opening-story'), deadline = Date.now() + 120000;
    while (await story.count()) {
      if (Date.now() > deadline) throw Error('NORMAL_ONBOARDING_BLOCKED: opening comic timeout');
      const text = page.locator('[data-story-action="text"]'); if (await text.isVisible()) await text.click();
      if (await story.isVisible()) await story.click({ position: { x: 10, y: 10 } });
      await page.waitForTimeout(1200);
    }
    await page.locator('.cm-opening__envelope').click(); await page.locator('.cm-opening__letter button').click();
    await page.locator('#cm-opening-name').fill('圖鑑測試'); await page.locator('.cm-opening__name button[type="submit"]').click();
    await page.locator('.cm-opening__choices button').first().click();
    await page.locator('.cm-opening__envelope').click(); await page.locator('.cm-opening__letter button').click(); await page.locator('.cm-opening__letter button').click();
    if (await page.locator('[data-egg-confirm]').isVisible()) await page.locator('[data-egg-confirm]').click();
    await page.locator('#cm-opening-name').fill('小夥伴'); await page.locator('.cm-opening__name button[type="submit"]').click();
    await page.locator('#cm-root[data-active-screen="RAISING_HOME"]').waitFor();
    const decline = page.locator('dialog[open] [data-action="decline"]');
    await decline.waitFor({ state: 'visible', timeout: 15000 }); await decline.click(); await decline.waitFor({ state: 'hidden' });
    await page.locator('button.cm-toolbar__cell[data-menu-id="SYSTEM"]').waitFor({ state: 'visible' });
    const registration = () => page.evaluate(() => {
      const saved = JSON.parse(localStorage.getItem('championshipModernSave:v1'));
      return { registeredSpecies: saved?.progression?.registeredSpecies ?? [], starter: saved?.creature?.speciesId ?? null };
    }); // Read-only observation of this disposable profile, never an imported save.
    evidence.registrationBefore = await registration();
    assert.ok(!evidence.registrationBefore.registeredSpecies.includes(117) && !evidence.registrationBefore.registeredSpecies.includes(55));
    await page.locator('button.cm-toolbar__cell[data-menu-id="SYSTEM"]').click();
    await page.locator('.cm-toolbar__menu:not([hidden]) button[data-entry-id="database"]').click();
    await page.locator('#cm-root[data-active-screen="DATABASE"]').waitFor();
    await page.locator('.cm-vs2-database__stage').selectOption('');
    const listReturn = page.locator('.cm-vs2-root[data-screen="DATABASE"] .cm-vs2-footer button');
    async function openSpecies(species) {
      const detail = page.locator('.cm-vs2-database__detail');
      if (await detail.isVisible()) { await listReturn.click(); await detail.waitFor({ state: 'hidden' }); }
      const row = page.locator(`.cm-vs2-database__row[data-species-index="${species}"][data-display-code="${EXPECTED[species].displayCode}"]`);
      await row.waitFor({ state: 'visible' }); await row.scrollIntoViewIfNeeded(); await row.click();
      await page.locator(HERO + '[data-art="ready"] .cm-dex-hero__image').waitFor({ state: 'visible', timeout: 30000 });
      await page.waitForFunction(() => { const image = document.querySelector('.cm-dex-hero__image'); return image?.complete && image.naturalWidth === 1254 && image.naturalHeight === 1254; });
      const snapshot = await page.evaluate(mountedSnapshot); assertMeasured(snapshot, species);
      return snapshot;
    }
    async function capture(name, species, size = null, backdrop = 'native') {
      await page.locator(HERO).scrollIntoViewIfNeeded();
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))));
      const snapshot = await page.evaluate(mountedSnapshot); assertMeasured(snapshot, species, size);
      assert.ok(snapshot.imageRect.x >= -1 && snapshot.imageRect.y >= -1 && snapshot.imageRect.right <= snapshot.viewport.width + 1 && snapshot.imageRect.bottom <= snapshot.viewport.height + 1, 'Whole image box must be visible after normal scrolling');
      await shot(name); await page.locator(HERO).screenshot({ path: path.join(output, name + '-hero.png') });
      evidence.captures.push({ name, sizeTarget: size === null ? 'NORMAL_UNMODIFIED' : 'IMAGE_CONTENT_BOX', requestedSize: size, backdrop, ...snapshot,
        screenshot: name + '.png', heroScreenshot: name + '-hero.png' }); write();
      return snapshot;
    }
    for (const species of [117, 55]) {
      await openSpecies(species);
      const normal = await capture(`${species}-desktop-normal`, species);
      const holder = await page.locator(HERO).elementHandle();
      const original = await holder.getAttribute('style');
      try {
        for (const size of [128, 256]) for (const backdrop of ['light', 'dark']) {
          const plan = sizePlan(size, normal.padding);
          await holder.evaluate((element, { plan, backdrop, original }) => {
            if (original === null) element.removeAttribute('style'); else element.setAttribute('style', original);
            for (const [key, value] of Object.entries({ width: `${plan.width}px`, height: `${plan.height}px`, 'max-width': 'none', 'max-height': 'none', 'min-width': '0px', 'min-height': '0px', 'flex-shrink': '0', background: backdrop === 'light' ? '#f2f4f7' : '#101820' })) element.style.setProperty(key, value, 'important');
          }, { plan, backdrop, original });
          const resized = await capture(`${species}-${size}-${backdrop}`, species, size, backdrop);
          assert.equal(resized.imageRendering, normal.imageRendering); assert.equal(resized.imageOpacity, normal.imageOpacity); assert.equal(resized.imageFilter, normal.imageFilter);
        }
      } finally {
        await holder.evaluate((element, original) => { if (original === null) element.removeAttribute('style'); else element.setAttribute('style', original); }, original);
        assert.equal(await holder.getAttribute('style'), original, 'Restore the exact pre-test style attribute');
        await holder.dispose();
      }
      const restored = await capture(`${species}-desktop-restored`, species);
      assert.equal(restored.holderStyle, normal.holderStyle);
      assert.deepEqual(restored.cssHolderSize, normal.cssHolderSize);
    }
    // Normal re-entry and responsive rendering, still using the same session/UI.
    await openSpecies(117); await capture('117-desktop-reentry', 117);
    await page.setViewportSize({ width: 390, height: 844 });
    for (const species of [117, 55, 117]) { await openSpecies(species); await capture(`${species}-mobile-normal-${evidence.captures.length}`, species); }
    evidence.registrationAfter = await registration();
    assert.deepEqual(evidence.registrationAfter, evidence.registrationBefore, 'Read-only Dex browsing must not register or replace creatures');
    await Promise.all(imageJobs);
    for (const species of [117, 55]) { assert.ok(imageResponses.has(species), `No actual browser image response captured for ${species}`); evidence.assetChecks.push(imageResponses.get(species)); }
    assert.deepEqual(evidence.pageErrors, []); assert.deepEqual(evidence.networkErrors, []);
    evidence.status = 'CAPTURE_PASS_VISUAL_REVIEW_PENDING';
  } catch (error) {
    evidence.status = 'FAIL'; evidence.failure = error.stack || String(error);
    await shot('failure').catch(() => {});
    if (page) evidence.failureDom = await page.locator('#cm-root').innerText().catch(() => null);
    process.exitCode = 1;
  } finally {
    if (context) {
      await context.tracing.stop({ path: path.join(output, 'dex-portrait-trace.zip') }).catch(error => evidence.cleanupErrors.push(String(error)));
      await context.close().catch(error => evidence.cleanupErrors.push(String(error)));
    }
    if (browser) await browser.close().catch(error => evidence.cleanupErrors.push(String(error)));
    if (server) await server.close().catch(error => evidence.cleanupErrors.push(String(error)));
    if (evidence.cleanupErrors.length) { evidence.status = 'FAIL'; process.exitCode = 1; }
    evidence.finishedAt = new Date().toISOString(); write();
  }
  console.log(JSON.stringify({ status: evidence.status, visualReview: evidence.visualReview, captures: evidence.captures.length, output }));
}
function selfTest() {
  assert.deepEqual(sizePlan(128, [24, 24, 24, 24]), { size: 128, width: 176, height: 176 });
  assert.deepEqual(sizePlan(256, [24, 24, 24, 24]), { size: 256, width: 304, height: 304 });
  assert.throws(() => sizePlan(80, [24, 24, 24, 24])); assert.throws(() => sizePlan(128, [0, 0, 0, 0]));
  const valid = { speciesIndex: 117, displayCode: 'MA58', rowState: 'UNDISCOVERED', title: '曙刃天駒', src: new URL(EXPECTED[117].src, PUBLIC_BASE).href,
    art: 'ready', complete: true, hidden: false, natural: [1254, 1254], objectFit: 'contain', padding: [24, 24, 24, 24], documentOverflow: false,
    imageRect: { width: 128, height: 128 }, holderRect: { width: 176, height: 176 } };
  assertMeasured(valid, 117, 128);
  for (const changed of [{ rowState: 'REGISTERED' }, { src: 'wrong.png' }, { objectFit: 'cover' }, { imageRect: { width: 80, height: 80 } }]) assert.throws(() => assertMeasured({ ...valid, ...changed }, 117, 128));
  console.log('DEX_PORTRAIT_SELF_TEST_PASS: sizing, identity, registration, contain and measured geometry guards; no browser launched.');
}
module.exports = { EXPECTED, sizePlan, assertAsset, assertMeasured, mountedSnapshot, checkPolicy };
if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest();
  else main().catch(error => { console.error(error); process.exitCode = 1; });
}

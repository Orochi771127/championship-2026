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
const EXPECTED_REGISTRY_COUNT = 95;
const MATRIX_TARGETS = Object.freeze([117,55,40,189,63,70,71,72,9,10,35,62,36]);
const EXPECTED_MASTERS = Object.freeze({
  36: Object.freeze({"speciesIndex": 36, "speciesId": "species-036", "displayCode": "GR04", "src": "assets/production/database-handpainted-r1-20261015/species-036.1a921cc1752c9c9c.png", "width": 1415, "height": 1111, "sha256": "1a921cc1752c9c9c99b2085a51ccf6a3efe77cb849b77b0e006062a90334aa5d", "styleBatch": "HANDPAINTED_R1_20261015", "name": "雷鬃獾"}),
  35: Object.freeze({"speciesIndex": 35, "speciesId": "species-035", "displayCode": "GR02", "src": "assets/production/database-handpainted-r1-20261015/species-035.291db6a498c8bdbd.png", "width": 1536, "height": 1024, "sha256": "291db6a498c8bdbd5e5b2196c8f9a629ec44a1ba55674e103dc596e6827fe6d4", "styleBatch": "HANDPAINTED_R1_20261015", "name": "岩甲穿獸"}),
  62: Object.freeze({"speciesIndex": 62, "speciesId": "species-062", "displayCode": "GR38", "src": "assets/production/database-handpainted-r1-20261015/species-062.ad0745c733532dc2.png", "width": 1254, "height": 1254, "sha256": "ad0745c733532dc288c5143194e9020e35cd071e74347e7a3851911db136e52d", "styleBatch": "HANDPAINTED_R1_20261015", "name": "光綾狐"}),

  189: Object.freeze({"speciesIndex": 189, "speciesId": "species-189", "displayCode": "UL06", "src": "assets/production/database-handpainted-r1-20261015/species-189.8c9cac7746647500.png", "width": 1324, "height": 1188, "sha256": "8c9cac7746647500066880fbd869e188d1f3c83fb1ea3069c5e1d3ba8798ee64", "styleBatch": "HANDPAINTED_R1_20261015", "name": "日冕戰暴龍"}),
  9: Object.freeze({"speciesIndex":9,"speciesId":"species-009","displayCode":"B102","src":"assets/production/database-portraits-b1-20261014/B102.eb7c0e50feb53dc2.png","width":1323,"height":1189,"sha256":"eb7c0e50feb53dc2eb16a12f0457de8911318011aea08526fea2a184472a7f72","name":"鐵鈴芽"}),
  10: Object.freeze({"speciesIndex":10,"speciesId":"species-010","displayCode":"B103","src":"assets/production/database-portraits-b1-20261014/B103.db66d79eb40c3768.png","width":1312,"height":1199,"sha256":"db66d79eb40c3768b2addfa247c82d7ca2d749f5ba52d9c96778a5787cc53824","name":"星芽獸"}),

  40: Object.freeze({"speciesIndex":40,"speciesId":"species-040","displayCode":"GR08","src":"assets/production/database-handpainted-r1-20261015/species-040.a5d0d48e737f81e0.png","sha256":"a5d0d48e737f81e0c955286a94923fe3b70d6483813ee233aedb80a8d89bc3ae","width":1254,"height":1254,"name":"霜裘龍"}),
  63: Object.freeze({"speciesIndex":63,"speciesId":"species-063","displayCode":"GR24","src":"assets/production/database-handpainted-r1-20261015/species-063.e403a93ec4f2d7ec.png","sha256":"e403a93ec4f2d7ec24273c2f2f3d861feeec11848d55450989230b2c93283f8a","width":1254,"height":1254,"name":"翠冠龍"}),
  70: Object.freeze({"speciesIndex": 70, "speciesId": "species-070", "displayCode": "GR32", "src": "assets/production/database-handpainted-r1-20261015/species-070.2dc33277d80cdfb4.png", "sha256": "2dc33277d80cdfb4577bee1d369adb59545b4ccc735a4f90fff342087a1ba738", "name": "星角龍"}),
  71: Object.freeze({"speciesIndex": 71, "speciesId": "species-071", "displayCode": "GR12", "src": "assets/production/database-handpainted-r1-20261015/species-071.cd9ee93854a452cc.png", "sha256": "cd9ee93854a452cc2b5a253ee35d5d57651d5474292ae8af7422331f0379e913", "name": "裂焰龍"}),
  72: Object.freeze({"speciesIndex": 72, "speciesId": "species-072", "displayCode": "MA04", "src": "assets/production/database-handpainted-r1-20261015/species-072.4ca0e10b98584a76.png", "sha256": "4ca0e10b98584a76aec0c283b6c5628d34122bd7d60aa63411c7cc2156bfca43", "name": "晶鏈甲龍"}),
  222: Object.freeze({"speciesIndex": 222, "speciesId": "species-222", "displayCode": "UL02", "src": "assets/production/database-handpainted-r1-20261015/species-222.png", "sha256": "4d1dae7fb4470338818dd8a4213ee77dba8cc59234bbcfe4f29f8cabda13a7c3"}),
  230: Object.freeze({"speciesIndex": 230, "speciesId": "species-230", "displayCode": "UL03", "src": "assets/production/database-handpainted-r1-20261015/species-230.png", "sha256": "09ebff7fb323886eae495e557158cdd204a04dc2d18aa686ad0060ac250e2e39"}),
  211: Object.freeze({"speciesIndex": 211, "speciesId": "species-211", "displayCode": "UL33", "src": "assets/production/database-handpainted-r1-20261015/species-211.png", "sha256": "20c03ae43a26d960c9a947a9ff8dc03fe8d5cbeed4ba528e39e2f36dd5865634"}),
  229: Object.freeze({"speciesIndex": 229, "speciesId": "species-229", "displayCode": "UL34", "src": "assets/production/database-handpainted-r1-20261015/species-229.png", "sha256": "f1e1a23e891b9345f4b759e910c5f67efd8a844a2de53e14183a1a2fe3310424"}),
  117: Object.freeze({ speciesIndex: 117, speciesId: 'species-117', displayCode: 'MA58',
    src: 'assets/production/database-handpainted-r1-20261015/species-117.8f7d027cdbf6d3e6.png',
    sha256: '8f7d027cdbf6d3e6d57dbe2f9cb091e42687c01170d1f3ef58ba0413e504a681' }),
  55: Object.freeze({ speciesIndex: 55, speciesId: 'species-055', displayCode: 'GR29',
    src: 'assets/production/database-handpainted-r1-20261015/species-055.32e6689b5e9669c2.png',
    sha256: '32e6689b5e9669c26fb0d29f3201ace2d5d619309381ab628d57f5eabc5d693e' })
});
const publicHeroes = require('../src/data/championship/database-hero-portraits.public.v1.json');
const displayRecipe = require('../docs/contracts/championship/DATABASE_HERO_DISPLAY_RENDITIONS.v1.json');
const EXPECTED = Object.freeze(Object.fromEntries(Object.entries(EXPECTED_MASTERS).map(([id,master])=>{
  const display=publicHeroes.entries.find(row=>row.speciesIndex===Number(id));
  assert.ok(display,`Missing public display rendition ${id}`);
  return [id,Object.freeze({...master,...display})];
})));
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
function assertOriginalApprovalLineage() {
  const authoring=require('../src/data/championship/database-hero-portraits.r1.json');
  assert.equal(authoring.entries.length,96,'Original authoring registry remains intact');
  for(const master of Object.values(EXPECTED_MASTERS)) {
    const original=authoring.entries.find(row=>row.speciesIndex===master.speciesIndex);
    assert.ok(original);assertAsset(original,fs.readFileSync(master.src),master);
    const derived=displayRecipe.rows.find(row=>row.speciesIndex===master.speciesIndex);
    for(const key of ['src','sha256','width','height'])assert.equal(derived.source[key],original[key]);
    assert.equal(derived.display.rgbaExactlyMatchesResizedSource,true);
    assert.equal(EXPECTED[master.speciesIndex].sha256,derived.display.sha256);
  }
}
function assertAsset(entry, bytes, expected) {
  for (const key of ['speciesIndex', 'speciesId', 'displayCode', 'src', 'sha256']) assert.equal(entry[key], expected[key], `Hero ${key} binding drift`);
  assert.equal(entry.width, expected.width ?? 1254); assert.equal(entry.height, expected.height ?? 1254);
  assert.equal(sha256(bytes), expected.sha256, 'Selected hero bytes drift');
  if(expected.src.endsWith('.png')) {
    assert.equal(bytes.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert.equal(bytes.readUInt32BE(16), expected.width ?? 1254); assert.equal(bytes.readUInt32BE(20), expected.height ?? 1254);
  } else {
    assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');
    assert.ok(bytes.includes(Buffer.from('VP8L')),'Approved display images use lossless WebP');
  }
}
function assertRegistry(sourceBytes, builtBytes) {
  assert.equal(sha256(builtBytes), sha256(sourceBytes), 'Built hero registry must equal this exact candidate source');
  const catalog = JSON.parse(builtBytes);
  assert.ok(Array.isArray(catalog.entries));
  assert.equal(new Set(catalog.entries.map(entry => entry.speciesIndex)).size, catalog.entries.length, 'No duplicate hero identities');
  for (const id of Object.keys(EXPECTED).map(Number)) assert.ok(catalog.entries.some(entry => entry.speciesIndex === id), `Missing selected hero ${id}`);
  return catalog;
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
  assert.deepEqual(snapshot.natural, [expected.width ?? 1254, expected.height ?? 1254]); assert.equal(snapshot.objectFit, 'contain');
  assert.deepEqual(snapshot.padding, [24, 24, 24, 24]);
  if (species === 117) assert.equal(snapshot.title, '曙刃天駒');
  if (expected.name) assert.equal(snapshot.title,expected.name,'Exact species name binding');
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
// The comic can advance itself between visibility inspection and an optional tap.
// Accept that race only when its removal AND the ordinary next envelope are observed.
async function clickOptionalComicControl(page, control, options = {}) {
  if (!await control.isVisible()) return;
  try {
    await control.click({ ...options, timeout: 1000 });
  } catch (error) {
    if (error.name !== 'TimeoutError'
      || await page.locator('.cm-opening-story').count() !== 0
      || !await page.locator('.cm-opening__envelope').isVisible()) throw error;
  }
}
async function main() {
  const { chromium } = require('playwright');
  const { resolveAsset, serveBuild } = require('./alternate-form-browser-support.cjs');
  const root = path.resolve(process.env.CHAMPIONSHIP_QA_ARTIFACT || 'dist/github-playtest');
  const output = require('./browser-qa-output.cjs')('dex-portrait');
  fs.mkdirSync(output, { recursive: true });
  const evidence = { status: 'RUNNING', visualReview: 'PENDING_ROOT_SCREENSHOT_REVIEW',
    commit: process.env.GITHUB_SHA || null, candidateHeadCommit: process.env.DEX_QA_HEAD_SHA || null, baseCommit: process.env.DEX_QA_BASE_SHA || null,
    scope: 'Normal fresh public-playtest UI: approved Dex040/189 with preserved063/070 with unchanged117/055/071/072 comparisons at normal desktop/mobile and128/256 light/dark contain; four existing promoted forms retain normal hero/source/target preview coverage. Only mounted matrix-holder size/backdrop CSS is temporarily overridden.',
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
    if(process.env.GITHUB_SHA)assert.equal(build.commit,process.env.GITHUB_SHA,'Built checkout must match tested commit');
    evidence.build = { buildId: build.buildId, commit:build.commit, inputSha256:build.inputSha256, target: build.target, manifestSha256: sha256(buildBytes) };
    assert.ok(resolveAsset(root, '/championship.html'));
    assertOriginalApprovalLineage();
    const registryPath = 'src/data/championship/database-hero-portraits.public.v1.json';
    const catalog = assertRegistry(fs.readFileSync(path.join(process.cwd(), registryPath)), fs.readFileSync(path.join(root, registryPath)));
    assert.equal(catalog.entries.length,EXPECTED_REGISTRY_COUNT,'59 existing plus36 approved portraits; MA15 is held');
    evidence.registry = { count: catalog.entries.length, sourceAndBuildSha256: sha256(fs.readFileSync(path.join(root, registryPath))) };
    const productPath='src/data/championship/product-species-extensions.r1.json',assetPath='src/data/championship/alternate-form-assets.r1.json',bindingPath='src/data/championship/public-alternate-form-bindings.v1.json';
    evidence.productionCatalogs=[];
    for(const file of [productPath,bindingPath]){
      const sourceBytes=fs.readFileSync(path.join(process.cwd(),file)),builtBytes=fs.readFileSync(path.join(root,file));
      assert.equal(sha256(sourceBytes),sha256(builtBytes));evidence.productionCatalogs.push({file,sha256:sha256(builtBytes)});
    }
    for(const entry of JSON.parse(fs.readFileSync(path.join(root,productPath))).entries)for(const gate of ['runtimeReady','evolutionReady','networkReady'])assert.equal(entry[gate],true);
    assert.equal(resolveAsset(root,'/'+assetPath),null,'Authoring metadata must stay outside the public artifact');
    const promotedAssets=JSON.parse(fs.readFileSync(path.join(process.cwd(),assetPath))).characters;
    const publicBindings=JSON.parse(fs.readFileSync(path.join(root,bindingPath))).characters;
    assert.deepEqual(promotedAssets.map(e=>e.speciesIndex).sort((a,b)=>a-b),[211,222,229,230]);
    for(const entry of promotedAssets){assert.equal(entry.runtimeReady,true);assert.equal(entry.qa.normalPath,'PASS');}
    assert.equal(publicBindings.length,4);
    for(const entry of promotedAssets){const binding=publicBindings.find(row=>row.speciesIndex===entry.speciesIndex);assert.ok(binding);for(const key of ['speciesId','speciesIndex','entityId','motionDonorEntityId'])assert.equal(binding[key],entry[key]);}
    for (const expected of Object.values(EXPECTED)) {
      const entry = catalog.entries.find(e => e.speciesIndex === expected.speciesIndex);
      assert.ok(entry, `Normal production registry missing ${expected.speciesId}`);
      const asset = resolveAsset(root, '/' + expected.src); assert.ok(asset, 'Selected display image absent from approved build');
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
        if(relative.startsWith('qa/alternate-form-')||relative==='alternate-form-qa.html'){evidence.networkErrors.push({url,error:'NORMAL_ENTRY_MUST_NOT_LOAD_ALTERNATE_QA'});return route.abort();}
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
      await clickOptionalComicControl(page, page.locator('[data-story-action="text"]'));
      await clickOptionalComicControl(page, story, { position: { x: 10, y: 10 } });
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
    assert.deepEqual(evidence.registrationBefore.registeredSpecies,[],'Normal new game must not manufacture any registration');
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
      await page.waitForFunction(([width,height]) => { const image = document.querySelector('.cm-dex-hero__image'); return image?.complete && image.naturalWidth === width && image.naturalHeight === height; }, [EXPECTED[species].width ?? 1254, EXPECTED[species].height ?? 1254]);
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
    async function measureListCards(viewport) {
      const detail=page.locator('.cm-vs2-database__detail');
      if(await detail.isVisible()){await listReturn.click();await detail.waitFor({state:'hidden'});}
      await page.locator('.cm-vs2-database__catalog').waitFor({state:'visible'});
      const measured=await page.locator('.cm-vs2-database__row--thumb').evaluateAll(rows=>rows.map(row=>{
        const box=row.getBoundingClientRect();
        return {id:Number(row.dataset.speciesIndex),visible:box.width>0&&box.height>0,
          inside:[...row.querySelectorAll('img,strong,.cm-vs2-shop__meta')].every(child=>{const r=child.getBoundingClientRect();return r.left>=box.left-.75&&r.right<=box.right+.75&&r.top>=box.top-.75&&r.bottom<=box.bottom+.75;}),
          lazy:row.querySelector('img').loading==='lazy'};
      }));
      assert.equal(measured.length,95);assert.ok(measured.every(row=>row.visible&&row.inside&&row.lazy),'All list thumbnail/name/code bounds remain inside their cards');
      assert.equal(await page.locator('[data-species-index="82"] .cm-dex-list-thumb').count(),0,'MA15 remains held');
      (evidence.listCardChecks??=[]).push({viewport,checked:measured.length,status:'PASS'});
    }
    await measureListCards({width:1440,height:1000});
    for (const species of MATRIX_TARGETS) {
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
    for(const species of MATRIX_TARGETS){await openSpecies(species);await capture(`${species}-desktop-reentry`,species);}
    await page.setViewportSize({ width: 390, height: 844 });
    await measureListCards({width:390,height:844});
    for (const species of [...MATRIX_TARGETS,70]) { await openSpecies(species); await capture(`${species}-mobile-normal-${evidence.captures.length}`, species); }
    await page.setViewportSize({width:360,height:800});await measureListCards({width:360,height:800});
    // Production entry only: ordinary rows and route nodes, no fixture/catalog swap.
    evidence.promotedCaptures=[];
    async function capturePreview(holder,species,kind,viewport){
      const img=holder.locator('img');await img.waitFor({state:'visible',timeout:30000});await holder.scrollIntoViewIfNeeded();await img.evaluate(image=>image.decode());
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      const actual=await holder.evaluate(n=>{const image=n.querySelector('img'),r=image.getBoundingClientRect();return {art:n.dataset.art,revealed:n.dataset.revealed,src:image.currentSrc||image.src,complete:image.complete,hidden:image.hidden,natural:[image.naturalWidth,image.naturalHeight],objectFit:getComputedStyle(image).objectFit,imageRect:{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom}};});
      assert.equal(actual.art,'ready');assert.equal(actual.revealed,'true');assert.equal(actual.complete,true);assert.equal(actual.hidden,false);assert.equal(actual.objectFit,'contain');assert.deepEqual(actual.natural,[EXPECTED[species].width,EXPECTED[species].height]);assert.equal(actual.src,new URL(EXPECTED[species].src,PUBLIC_BASE).href);
      assert.ok(actual.imageRect.width>0&&actual.imageRect.height>0);assert.ok(actual.imageRect.x>=-1&&actual.imageRect.right<=viewport.width+1&&actual.imageRect.y>=-1&&actual.imageRect.bottom<=viewport.height+1);
      const name=`production-${species}-${kind}-${viewport.width}`;await shot(name);await holder.screenshot({path:path.join(output,name+'-image.png')});evidence.promotedCaptures.push({speciesIndex:species,displayCode:EXPECTED[species].displayCode,kind,viewport,screenshot:name+'.png',imageScreenshot:name+'-image.png',...actual});write();
    }
    for(const viewport of [{width:844,height:390},{width:390,height:844}]){
      await page.setViewportSize(viewport);
      for(const species of [222,230,211,229]){
        await openSpecies(species);await capture(`production-${species}-hero-${viewport.width}`,species);
        await capturePreview(page.locator('.cm-vs2-database__detail .cm-dex-routes__source .cm-dex-portrait'),species,'source-preview',viewport);
      }
      for(const [source,targets] of [[139,[211,229]],[144,[222,230]]]){
        const detail=page.locator('.cm-vs2-database__detail');if(await detail.isVisible()){await listReturn.click();await detail.waitFor({state:'hidden'});}
        const row=page.locator(`.cm-vs2-database__row[data-species-index="${source}"]`);await row.scrollIntoViewIfNeeded();await row.click();await detail.waitFor({state:'visible'});
        for(const species of targets){const target=detail.locator(`.cm-dex-routes__target[aria-label^="${EXPECTED[species].displayCode} · "]`);assert.equal(await target.count(),1);assert.equal(await target.getAttribute('data-revealed'),'true');await capturePreview(target.locator('.cm-dex-portrait'),species,'evolution-choice-preview',viewport);}
      }
    }
    evidence.normalProductionFormCoverage='HERO_SOURCE_TARGET_4_FORMS_2_VIEWPORTS';
    evidence.registrationAfter = await registration();
    assert.deepEqual(evidence.registrationAfter, evidence.registrationBefore, 'Read-only Dex browsing must not register or replace creatures');
    await Promise.all(imageJobs);
    for (const species of Object.keys(EXPECTED).map(Number)) { assert.ok(imageResponses.has(species), `No actual browser image response captured for ${species}`); evidence.assetChecks.push(imageResponses.get(species)); }
    assert.deepEqual(evidence.pageErrors, []); assert.deepEqual(evidence.networkErrors, []);
    evidence.comparisonGroups=['desktop-normal','128-light','128-dark','256-light','256-dark','desktop-restored','desktop-reentry'].map(condition=>({condition,referenceSpecies:117,candidateSpecies:[40,189,63,70,71,72,9,10],visualAcceptance:'PENDING_ROOT_ACTUAL_IMAGE_REVIEW',captures:[40,189,63,70,71,72,9,10,117].map(species=>{const c=evidence.captures.find(x=>x.name===`${species}-${condition}`);assert.ok(c);return {speciesIndex:species,image:c.heroScreenshot,fullPresentation:c.screenshot};})}));
    evidence.visualChecklist=['Approved040/189 with preserved063/070, baby009/010 and071/072 against117 accepted style','Full appendages and normal mobile fit','Cyan edge fringe on light/dark','Exact CSS restoration','Promoted own hero, origin and revealed target identity'];
    // Nine matrix heroes × eight conditions, one mobile re-entry, eight production hero captures.
    assert.equal(evidence.captures.length,113);assert.equal(evidence.promotedCaptures.length,16);
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
async function selfTestOptionalComicClick() {
  const timeout = Object.assign(new Error('obsolete comic control'), { name: 'TimeoutError' });
  const testCase = ({ visible = true, error = null, storyCount = 0, envelopeVisible = true } = {}) => {
    const calls = [];
    const control = { isVisible: async () => visible, click: async options => { calls.push(options); if (error) throw error; } };
    const page = { locator: selector => selector === '.cm-opening-story'
      ? { count: async () => storyCount } : { isVisible: async () => envelopeVisible } };
    return { page, control, calls };
  };
  const normal = testCase();
  await clickOptionalComicControl(normal.page, normal.control, { position: { x: 10, y: 10 } });
  assert.deepEqual(normal.calls, [{ position: { x: 10, y: 10 }, timeout: 1000 }]);
  const absent = testCase({ visible: false });
  await clickOptionalComicControl(absent.page, absent.control); assert.equal(absent.calls.length, 0);
  const advanced = testCase({ error: timeout });
  await clickOptionalComicControl(advanced.page, advanced.control); assert.equal(advanced.calls.length, 1);
  for (const options of [{ storyCount: 1 }, { envelopeVisible: false }, { storyCount: 1, envelopeVisible: false }]) {
    const blocked = testCase({ error: timeout, ...options });
    await assert.rejects(() => clickOptionalComicControl(blocked.page, blocked.control), error => error === timeout);
  }
  const otherError = new Error('browser or selector failed');
  const broken = testCase({ error: otherError });
  await assert.rejects(() => clickOptionalComicControl(broken.page, broken.control), error => error === otherError);
}
async function selfTest() {
  assertOriginalApprovalLineage();
  await selfTestOptionalComicClick();
  new (require('node:vm').Script)('('+mountedSnapshot.toString()+')');
  assert.deepEqual(sizePlan(128, [24, 24, 24, 24]), { size: 128, width: 176, height: 176 });
  assert.deepEqual(sizePlan(256, [24, 24, 24, 24]), { size: 256, width: 304, height: 304 });
  assert.throws(() => sizePlan(80, [24, 24, 24, 24])); assert.throws(() => sizePlan(128, [0, 0, 0, 0]));
  const valid = { speciesIndex: 117, displayCode: 'MA58', rowState: 'UNDISCOVERED', title: '曙刃天駒', src: new URL(EXPECTED[117].src, PUBLIC_BASE).href,
    art: 'ready', complete: true, hidden: false, natural: [EXPECTED[117].width, EXPECTED[117].height], objectFit: 'contain', padding: [24, 24, 24, 24], documentOverflow: false,
    imageRect: { width: 128, height: 128 }, holderRect: { width: 176, height: 176 } };
  assertMeasured(valid, 117, 128);
  for (const changed of [{ rowState: 'REGISTERED' }, { src: 'wrong.png' }, { objectFit: 'cover' }, { imageRect: { width: 80, height: 80 } }]) assert.throws(() => assertMeasured({ ...valid, ...changed }, 117, 128));
  for (const species of [9,10,40,189,63,70,35,62,36]) {
    const expected=EXPECTED[species];
    const snapshot={...valid,speciesIndex:species,displayCode:expected.displayCode,title:expected.name,natural:[expected.width ?? 1254,expected.height ?? 1254],src:new URL(expected.src,PUBLIC_BASE).href};
    assertMeasured(snapshot,species,128);
    assertMeasured({...snapshot,imageRect:{width:256,height:256},holderRect:{width:304,height:304}},species,256);
    for(const changed of [{natural:[1,1]},{src:new URL('assets/production/database-handpainted-r1-20261015/species-'+String(species).padStart(3,'0')+'.png',PUBLIC_BASE).href},{objectFit:'cover'},{padding:[0,0,0,0]},{hidden:true},{complete:false},{documentOverflow:true}]) assert.throws(()=>assertMeasured({...snapshot,...changed},species,128));
    if([9,10,189,35,36].includes(species))assert.throws(()=>assertMeasured({...snapshot,natural:[1254,1254]},species,128));
  }
  // Approved canonical name cleanup: bind independently to the requested names.
  // Keep strict title equality; reject stale names rather than weakening the assertion.
  for (const [species, name, staleName] of [
    [40, '霜裘龍', '霜裘幼龍'], [63, '翠冠龍', '翠冠幼龍'],
    [70, '星角龍', '星角幼龍'], [71, '裂焰龍', '裂焰幼龍']
  ]) {
    const expected = EXPECTED[species];
    assert.equal(expected.name, name);
    const snapshot = {...valid, speciesIndex:species, displayCode:expected.displayCode,
      title:name, natural:[expected.width ?? 1254, expected.height ?? 1254],
      src:new URL(expected.src, PUBLIC_BASE).href};
    assertMeasured(snapshot, species, 128);
    assert.throws(() => assertMeasured({...snapshot, title:staleName}, species, 128), /Exact species name binding/);
  }
  for(const species of [9,10]){
    const expected=EXPECTED[species],bytes=fs.readFileSync(expected.src);
    assertAsset(expected,bytes,expected);
    for(const key of ['speciesIndex','speciesId','displayCode','src','sha256','width','height']){
      assert.throws(()=>assertAsset({...expected,[key]:typeof expected[key]==='number'?expected[key]+1:'wrong'},bytes,expected));
    }
    const damaged=Buffer.from(bytes);damaged[damaged.length-1]^=1;assert.throws(()=>assertAsset(expected,damaged,expected));
    const oldSrc=`assets/production/database-portraits-b1-20261014/${expected.displayCode}.webp`;
    assert.throws(()=>assertAsset({...expected,src:oldSrc},bytes,expected));
  }
  assert.equal(publicHeroes.entries.length,EXPECTED_REGISTRY_COUNT,'Public registry count must match browser preflight');
  assert.equal(MATRIX_TARGETS.length,13);assert.equal(MATRIX_TARGETS.length*8+1+8,113);
  const sourceRegistry = Buffer.from(JSON.stringify({entries:Object.keys(EXPECTED).map(speciesIndex=>({speciesIndex:Number(speciesIndex)}))}));
  assert.equal(assertRegistry(sourceRegistry,sourceRegistry).entries.length,17);
  assert.throws(()=>assertRegistry(sourceRegistry,Buffer.from('{}')));
  for(const species of [9,10]){const missingBaby=Buffer.from(JSON.stringify({entries:JSON.parse(sourceRegistry).entries.filter(e=>e.speciesIndex!==species)}));assert.throws(()=>assertRegistry(missingBaby,missingBaby));}
  const duplicated=Buffer.from(JSON.stringify({entries:[{speciesIndex:117},{speciesIndex:55},{speciesIndex:117}]}));
  assert.throws(()=>assertRegistry(duplicated,duplicated));
  const missing=Buffer.from(JSON.stringify({entries:[{speciesIndex:55}]}));assert.throws(()=>assertRegistry(missing,missing));
  console.log('DEX_PORTRAIT_SELF_TEST_PASS: sizing, identity, registration, contain, measured geometry and bounded onboarding-race guards; no browser launched.');
}
module.exports = { EXPECTED, assertRegistry, sizePlan, assertAsset, assertMeasured, mountedSnapshot, checkPolicy, clickOptionalComicControl, selfTestOptionalComicClick };
if (require.main === module) {
  if (process.argv.includes('--self-test')) selfTest().catch(error => { console.error(error); process.exitCode = 1; });
  else main().catch(error => { console.error(error); process.exitCode = 1; });
}

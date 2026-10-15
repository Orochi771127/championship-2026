// Candidate QA adapted from the parent's reviewed assertion script.
// Browser output remains provisional until its saved image regions are reviewed.
import assert from 'node:assert/strict';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { chromium } from 'playwright';
import { databaseVerifiedData } from '../src/championship/database/databaseStories.js';
import { speciesName } from '../src/championship/text/zhHant.js';

const candidateRoot = path.resolve('.');
const sourceMode = process.env.DEX_QA_SOURCE_MODE === '1';
const artifactRoot = path.resolve(process.env.DEX_QA_ARTIFACT_ROOT || (sourceMode ? '.' : 'dist/internal-review'));
const qaOutputDir = path.resolve(process.env.DEX_QA_OUTPUT_DIR || 'qa/dex-review-revised-output');
const qaScreenshotsDir = path.join(qaOutputDir, 'screenshots');

fs.mkdirSync(qaScreenshotsDir, { recursive: true });
const reportPath = path.join(qaOutputDir, 'dex-browser-review.json');

const manifestPath = path.join(artifactRoot, 'internal-build.json');
const manifest = sourceMode ? null : JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
let sourceFingerprint = null;
if (sourceMode) {
  assert.equal(artifactRoot,candidateRoot,'Source mode must serve this isolated candidate');
  const sourceFiles=['src/data/championship/database-original-profiles.r1.json','src/championship/database/databaseStories.js','src/championship/app/vs4Screens.js','src/championship/app/vs2Styles.css','scripts/browser-dex-qa.mjs'];
  sourceFingerprint=createHash('sha256').update(JSON.stringify(sourceFiles.map(file=>({file,sha256:createHash('sha256').update(fs.readFileSync(path.join(candidateRoot,file))).digest('hex')})))).digest('hex');
  console.log('Isolated source candidate fingerprint:',sourceFingerprint);
} else {
  console.log('Build ID under test:',manifest.buildId);
  assert.equal(manifest.publicReleasePermitted,false,'Only internal review builds are allowed');
  assert.equal(manifest.loopbackOnly,true,'Internal build must be loopback-only');
}
const heroManifest = JSON.parse(fs.readFileSync(path.join(candidateRoot, 'src/data/championship/database-hero-portraits.r1.json'), 'utf8'));
const profiles = JSON.parse(fs.readFileSync(path.join(candidateRoot, 'src/data/championship/database-original-profiles.r1.json'), 'utf8'));
const b101Hero = heroManifest.entries.find(e => e.speciesIndex === 8);
const b101Profile = profiles.entries.find(e => e.speciesIndex === 8);
assert.ok(b101Hero && b101Profile, 'B101 source expectations must exist');
assert.equal(b101Hero.displayCode, 'B101');
const builtHeroBytes = fs.readFileSync(path.join(artifactRoot, b101Hero.src));
assert.equal(createHash('sha256').update(builtHeroBytes).digest('hex'), b101Hero.sha256, 'Served B101 bytes must match hero identity');
const storyHeadings = {'zh-Hant':'角色故事',en:'Profile',ja:'プロフィール',th:'เรื่องราว',vi:'Câu chuyện'};
const dataHeadings = {'zh-Hant':'能力與招式',en:'Traits & Moves',ja:'能力と技',th:'ความสามารถและท่าต่อสู้',vi:'Năng lực & Kỹ năng'};

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.mp4': 'video/mp4',
  '.woff2': 'font/woff2'
};

const server = http.createServer((req, res) => {
  let rel;
  try {
    rel = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname).replace(/^\/+/, '');
  } catch {
    res.writeHead(400).end();
    return;
  }
  const target = path.resolve(artifactRoot, rel || 'championship.html');
  if (!target.startsWith(artifactRoot + path.sep)) {
    res.writeHead(403).end();
    return;
  }
  fs.readFile(target, (err, buf) => {
    res.writeHead(err ? 404 : 200, {
      'Content-Type': mime[path.extname(target)] || 'application/octet-stream',
      'Cache-Control': 'no-store'
    }).end(err ? 'Not found' : buf);
  });
});

await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
const port = server.address().port;
assert.ok(![8732,58360].includes(port),'Protected services are not test origins');
console.log(`Internal review server listening at http://127.0.0.1:${port}`);

// Prepare test save with selective registered species
const baseSave = JSON.parse(fs.readFileSync('qa/championship-full-qa-save.json', 'utf8'));
// Register B101-B112 (8..19), B201 (20), GR01 (34), MA04 (72), AW01 (136), UL03 (187)
// Other species like 21, 35, 73, 188 are UNDISCOVERED
const registeredSample = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 34, 72, 136, 187, 222];
baseSave.progression.registeredSpecies = registeredSample;
const testSaveJson = JSON.stringify(baseSave);

let browser = await chromium.launch({
  executablePath: process.env.DEX_QA_CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe',
  headless: true
});

const results = {
  buildId: manifest?.buildId ?? null,
  sourceFingerprint,
  evidenceKind:sourceMode?'ISOLATED_SOURCE_CANDIDATE':'INTERNAL_REVIEW_BUILD',
  timestamp: new Date().toISOString(),
  localesTested: [],
  screenshots: [],
  assertions: [],
  imageReadiness: [],
  lifecycle: [],
  failures: [],
  status: 'RUNNING',
  visualAcceptance: 'NOT_PERFORMED_BY_SCRIPT',
  capabilitySemanticsAccepted: false,
  pageErrors: []
};

async function saveScreenshot(page, filename, description) {
  const localPath = path.join(qaScreenshotsDir, filename);
  await page.screenshot({ path: localPath, fullPage: false, timeout: 10000 });
  const bytes = fs.readFileSync(localPath);
  const sha256 = createHash('sha256').update(bytes).digest('hex');
  results.screenshots.push({ filename, description, sha256, sizeBytes: bytes.length, capturedAt: new Date().toISOString() });
  console.log(`Saved screenshot: ${filename} (sha256: ${sha256.slice(0, 12)}...)`);
}

// This is a decode/layout gate, not proof of screen pixels. A locator screenshot
// is saved for independent visual review; no product readiness flag is changed.
async function requireDecodedHero(page, expected, locale, label) {
  const selector = '.cm-dex-hero[data-art="ready"] img';
  await page.waitForSelector(selector, {state:'visible', timeout:10000});
  const handle = await page.$(selector);
  assert.ok(handle, `${label}: stable hero node is required`);
  try {
    await handle.scrollIntoViewIfNeeded();
    const observation = await handle.evaluate(async (img, expected) => {
      const startedAt = performance.now();
      if (typeof img.decode !== 'function') throw new Error('Image decode API unavailable');
      const bounded=async(promise,label,ms=10000)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error(label+' timeout')),ms);})]);}finally{clearTimeout(timer);}};
      await bounded(img.decode(),'hero decode');
      if (document.fonts?.ready) await bounded(document.fonts.ready,'font settlement');
      await bounded(new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))),'paint opportunity');
      const holder = img.closest('.cm-dex-hero');
      const detail = img.closest('.cm-vs2-database__detail');
      if (!img.isConnected || document.querySelector('.cm-dex-hero img') !== img || !holder || !detail) {
        throw new Error('Hero replaced or detached while decoding');
      }
      const rect = el => {const r=el.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};
      const imageRect=rect(img), holderRect=rect(holder), detailRect=rect(detail);
      const styles=[];let el=img;
      while(el){const c=getComputedStyle(el);styles.push({tag:el.tagName,className:el.className,hidden:el.hidden===true,display:c.display,visibility:c.visibility,opacity:c.opacity});el=el.parentElement;}
      const visual=window.visualViewport;
      const viewport={x:visual?.offsetLeft??0,y:visual?.offsetTop??0,right:(visual?.offsetLeft??0)+(visual?.width??innerWidth),bottom:(visual?.offsetTop??0)+(visual?.height??innerHeight)};
      const clip={x:Math.max(detailRect.x,viewport.x),y:Math.max(detailRect.y,viewport.y),right:Math.min(detailRect.right,viewport.right),bottom:Math.min(detailRect.bottom,viewport.bottom)};
      const inside=(r,c)=>r.x>=c.x-1&&r.y>=c.y-1&&r.right<=c.right+1&&r.bottom<=c.bottom+1;
      const center=document.elementFromPoint(imageRect.x+imageRect.width/2,imageRect.y+imageRect.height/2);
      return {startedAt,observedAt:performance.now(),locale:document.documentElement.lang,ready:holder.dataset.art==='ready',hidden:img.hidden,
        connected:img.isConnected,complete:img.complete,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight,
        currentSrc:img.currentSrc,expectedSrc:new URL(expected.src,location.href).href,
        selectedSpecies:document.querySelector('.cm-vs2-database__row[data-selected="true"]')?.dataset.speciesIndex,
        imageRect,holderRect,detailRect,viewport,styles,
        styleVisible:styles.every(s=>!s.hidden&&s.display!=='none'&&s.visibility!=='hidden'&&s.visibility!=='collapse'&&Number(s.opacity)>0),
        fullyInVisibleClip:inside(imageRect,clip),centerUnoccluded:center===img||holder.contains(center),
        detailScrollTop:detail.scrollTop,bodyFlags:{desktopBrowse:document.body.hasAttribute('data-desktop-browse'),portraitFrame:document.body.hasAttribute('data-portrait-frame')}};
    }, expected);
    results.imageReadiness.push({label,...observation});
    assert.equal(observation.locale,locale,`${label}: actual locale`);
    assert.equal(observation.selectedSpecies,String(expected.speciesIndex),`${label}: selected stable species`);
    assert.equal(observation.currentSrc,observation.expectedSrc,`${label}: hero source`);
    assert.equal(observation.complete,true,`${label}: image complete`);
    assert.equal(observation.naturalWidth,expected.width,`${label}: natural width`);
    assert.equal(observation.naturalHeight,expected.height,`${label}: natural height`);
    for(const key of ['ready','connected','styleVisible','fullyInVisibleClip','centerUnoccluded']) assert.equal(observation[key],true,`${label}: ${key}`);
    assert.equal(observation.hidden,false,`${label}: hidden`);
    assert.ok(observation.imageRect.width>0&&observation.imageRect.height>0,`${label}: nonzero image box`);
    const filename=`${label}-hero-region.png`,target=path.join(qaScreenshotsDir,filename);
    await handle.screenshot({path:target,timeout:10000});
    const bytes=fs.readFileSync(target);
    results.screenshots.push({filename,description:'Decoded hero region; still requires visual review',sha256:createHash('sha256').update(bytes).digest('hex'),sizeBytes:bytes.length,capturedAt:new Date().toISOString()});
    return observation;
  } finally {await handle.dispose();}
}

try {
  const locales = ['zh-Hant', 'en', 'ja', 'th', 'vi'];

  for (const locale of locales) {
    console.log(`\n--- Testing Locale: ${locale} ---`);
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    page.on('pageerror',error=>results.pageErrors.push(String(error)));

    await page.addInitScript(({ saveText, loc }) => {
      localStorage.setItem('championshipModernSave:v1', saveText);
      localStorage.setItem('championshipModernSave:preferences:v1', JSON.stringify({
        schemaVersion: 1,
        kind: 'CHAMPIONSHIP_PREFERENCES',
        device: { reducedMotion: 'on' },
        account: { locale: loc }
      }));
    }, { saveText: testSaveJson, loc: locale });

    await page.goto(`http://127.0.0.1:${port}/championship.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle');

    // Login & continue to Raising Home
    await page.locator('#cm-login').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('#cm-login').click({ timeout:20000 });
    await page.locator('#cm-continue').waitFor({ state: 'visible', timeout: 15000 });
    await page.locator('#cm-continue').click({ timeout:20000 });

    // Wait for screen to become RAISING_HOME
    await page.waitForFunction(() => document.querySelector('[data-screen]')?.dataset.screen === 'RAISING_HOME', {}, { timeout: 15000 });

    // Open System menu
    await page.locator('button[data-menu-id="SYSTEM"]').click();
    await page.locator('.cm-toolbar__entry[data-entry-id="database"]').waitFor({ state: 'visible', timeout: 5000 });
    await page.locator('.cm-toolbar__entry[data-entry-id="database"]').click();

    // Wait for Database view
    await page.waitForSelector('.cm-vs2-database__row', { timeout: 10000 });

    // Select Species 8 (B101 星滴靈)
    await page.locator('button.cm-vs2-database__row[data-species-index="8"]').click();
    await page.waitForSelector('.cm-dex-profile', { timeout: 5000 });

    // Wait for hero art to load
    await requireDecodedHero(page, b101Hero, locale, `b101-${locale}`);

    // Validate DOM content
    const detailData = await page.evaluate(() => {
      const hero = document.querySelector('.cm-dex-hero');
      const profile = document.querySelector('.cm-dex-profile');
      const dataSec = document.querySelector('.cm-dex-data');
      return {
        locale: document.documentElement.lang,
        heroReady: hero?.dataset.art === 'ready',
        heroVisible: hero && !hero.querySelector('img').hidden,
        storyHeading: profile?.querySelector('.cm-dex-profile__heading')?.textContent,
        storyText: profile?.querySelector('.cm-dex-profile__text')?.textContent,
        dataHeading: dataSec?.querySelector('.cm-dex-profile__heading')?.textContent,
        traitTags: [...(dataSec?.querySelectorAll('.cm-dex-trait-tag') ?? [])].map(t => t.textContent),
        moveCards: [...(dataSec?.querySelectorAll('.cm-dex-move-card') ?? [])].map(m => m.textContent.trim())
      };
    });

    assert.equal(detailData.heroReady,true,`${locale}: hero ready`);
    assert.equal(detailData.heroVisible,true,`${locale}: hero unhidden`);
    assert.equal(detailData.locale,locale,`${locale}: document locale`);
    assert.equal(detailData.storyHeading,storyHeadings[locale],`${locale}: exact story heading`);
    assert.equal(detailData.storyText,b101Profile.textByLocale[locale],`${locale}: exact B101 prose`);
    assert.equal(detailData.dataHeading,dataHeadings[locale],`${locale}: exact data heading`);
    const traits=databaseVerifiedData(8,locale);
    assert.equal(Object.hasOwn(traits,'baseHp'),false);
    assert.equal(Object.hasOwn(traits,'baseTp'),false);
    assert.deepEqual(detailData.traitTags,[`${traits.labels.attribute}: ${traits.attributeName}`,`${traits.labels.family}: ${traits.familyName}`],`${locale}: species traits only; individual stats omitted`);
    assert.equal(detailData.moveCards.length,0,`${locale}: B101 has no native species moves`);
    results.assertions.push({
      test: `Species 8 B101 hero and profile in ${locale}`,
      enforced: true,
      heroVisible: detailData.heroVisible,
      heroReady: detailData.heroReady,
      storyLength: detailData.storyText?.length,
      traitCount: detailData.traitTags.length,
      moveCount: detailData.moveCards.length
    });

    console.log(`[${locale}] Heading: ${detailData.storyHeading}, Story len: ${detailData.storyText.length}, Traits: ${detailData.traitTags.length}, Moves: ${detailData.moveCards.length}`);

    await saveScreenshot(page, `dex-01-registered-b101-${locale}.png`, `Registered B101 星滴靈 with hero portrait, original story and trait cards (semantic acceptance separate) in ${locale}`);
    results.localesTested.push(locale);

    // A corrected nonhero profile is checked against the accepted source in all
    // five locales, in addition to the unchanged first-batch illustration.
    await page.locator('.cm-vs2-footer button').click();
    await page.locator('button.cm-vs2-database__row[data-species-index="222"]').click();
    const corrected=profiles.entries.find(entry=>entry.speciesIndex===222);
    await page.waitForFunction(text=>document.querySelector('.cm-dex-profile__text')?.textContent===text,corrected.textByLocale[locale]);
    assert.equal(await page.locator('.cm-dex-hero').count(),0);
    assert.equal(await page.locator('.cm-dex-trait-tag').count(),2);
    assert.equal(await page.locator('.cm-vs2-database__detail-title').textContent(),speciesName(222));
    results.assertions.push({test:`Corrected UL02 exact prose in ${locale}`,enforced:true,storyExact:true,heroAbsent:true,traitCount:2});
    await page.locator('.cm-dex-profile').scrollIntoViewIfNeeded();
    await saveScreenshot(page,`dex-corrected-ul02-${locale}.png`,`Corrected UL02 prose and native traits in ${locale}`);

    // Re-enter through actual Home menu controls; each round also replaces a
    // decoded hero with masked content, another approved hero and a nonhero.
    for(let round=1;round<=2;round++) {
      await page.locator('.cm-vs2-footer button').click();
      await page.locator('.cm-vs2-footer button').click();
      await page.waitForFunction(()=>document.querySelector('[data-screen]')?.dataset.screen==='RAISING_HOME');
      assert.equal(await page.locator('.cm-vs2-database').count(),0,'Closed Dex view disposed');
      await page.locator('button[data-menu-id="SYSTEM"]').click();
      await page.locator('.cm-toolbar__entry[data-entry-id="database"]').click();
      await page.waitForSelector('.cm-vs2-database__row');
      for(const index of [8,21,9,222]) {
        await page.locator(`button.cm-vs2-database__row[data-species-index="${index}"]`).click();
        assert.equal(await page.locator('.cm-vs2-database').count(),1,'Exactly one live Dex view');
        assert.equal(await page.locator('html').getAttribute('lang'),locale);
        if(index===21) {
          for(const selector of ['.cm-dex-hero','.cm-dex-profile','.cm-dex-data','.cm-dex-routes']) assert.equal(await page.locator(selector).count(),0,`Reopen ${locale}/${round}: unknown ${selector} absent`);
          assert.ok(!(await page.locator('.cm-vs2-database__detail').textContent()).includes(speciesName(21)));
        } else {
          assert.equal(await page.locator('.cm-dex-profile__text').textContent(),profiles.entries.find(entry=>entry.speciesIndex===index).textByLocale[locale]);
          assert.equal(await page.locator('.cm-vs2-database__detail-title').textContent(),speciesName(index));
          assert.equal(await page.locator('.cm-dex-trait-tag').count(),2);
          const expected=heroManifest.entries.find(entry=>entry.speciesIndex===index);
          if(expected) await requireDecodedHero(page,expected,locale,`reopen-${locale}-${round}-species-${index}`);
          else assert.equal(await page.locator('.cm-dex-hero').count(),0);
        }
        results.lifecycle.push({locale,round,speciesIndex:index,enforced:true,state:index===21?'MASKED':index===222?'NONHERO_EXACT_PROSE':'DECODED_HERO_EXACT_PROSE'});
        if(index!==222) await page.locator('.cm-vs2-footer button').click();
      }
    }

    await page.close();
  }

  // Keep the additional navigation phase independent of prior page resources.
  await browser.close();
  browser=await chromium.launch({executablePath:process.env.DEX_QA_CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});

  // Next: In zh-Hant, test additional regular species (Baby 2, Growth, Ultimate, Undiscovered, Desktop)
  console.log('\n--- Testing Additional Characters & Undiscovered Masking ---');
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on('pageerror',error=>results.pageErrors.push(String(error)));

  await page.addInitScript(({ saveText }) => {
    localStorage.setItem('championshipModernSave:v1', saveText);
    localStorage.setItem('championshipModernSave:preferences:v1', JSON.stringify({
      schemaVersion: 1,
      kind: 'CHAMPIONSHIP_PREFERENCES',
      device: { reducedMotion: 'on' },
      account: { locale: 'zh-Hant' }
    }));
  }, { saveText: testSaveJson });

  await page.goto(`http://127.0.0.1:${port}/championship.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForLoadState('networkidle');
  await page.locator('#cm-login').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#cm-login').click({ timeout:20000 });
  await page.locator('#cm-continue').waitFor({ state: 'visible', timeout: 15000 });
  await page.locator('#cm-continue').click({ timeout:20000 });
  await page.waitForFunction(() => document.querySelector('[data-screen]')?.dataset.screen === 'RAISING_HOME', {}, { timeout: 15000 });

  await page.locator('button[data-menu-id="SYSTEM"]').click();
  await page.locator('.cm-toolbar__entry[data-entry-id="database"]').click();
  await page.waitForSelector('.cm-vs2-database__row', { timeout: 10000 });

  // 1. Select Species 20 (B201 鐵鈴芽 - Baby 2, registered, NO hero portrait)
  await page.locator('button.cm-vs2-database__row[data-species-index="20"]').click();
  await page.waitForSelector('.cm-dex-profile', { timeout: 5000 });
  assert.equal(await page.locator('.cm-dex-profile__text').textContent(),profiles.entries.find(e=>e.speciesIndex===20).textByLocale['zh-Hant']);
  const b201Check = await page.evaluate(() => {
    return {
      heroAbsent: document.querySelector('.cm-dex-hero') === null,
      hasStory: Boolean(document.querySelector('.cm-dex-profile__text')?.textContent),
      hasData: Boolean(document.querySelector('.cm-dex-data'))
    };
  });
  assert.deepEqual(b201Check,{heroAbsent:true,hasStory:true,hasData:true});
  results.assertions.push({ test: 'Species 20 B201 has story and data but no hero portrait', enforced:true, ...b201Check });
  console.log('Species 20 (B201 Baby 2): hero absent =', b201Check.heroAbsent, ', has story =', b201Check.hasStory);
  await saveScreenshot(page, 'dex-02-registered-b201-baby2-no-hero.png', 'Registered B201 鐵鈴芽 (Baby 2): current candidate story and data without hero portrait');

  // Go back to list
  await page.locator('.cm-vs2-footer button').click();
  await page.waitForSelector('.cm-vs2-database__row', { timeout: 5000 });

  // 2. Select Species 34 (GR01 鎧焰蜥 - Growth, registered)
  await page.locator('button.cm-vs2-database__row[data-species-index="34"]').click();
  await page.waitForSelector('.cm-dex-profile', { timeout: 5000 });
  assert.equal(await page.locator('.cm-dex-profile__text').textContent(),profiles.entries.find(e=>e.speciesIndex===34).textByLocale['zh-Hant']);
  const moveMetadata=await page.locator('.cm-dex-move-card__meta').allTextContents();
  assert.deepEqual(moveMetadata.map(text=>text.match(/(\d+) TP$/)?.[1]),['0','6','10']);
  await saveScreenshot(page, 'dex-03-registered-gr01-original-growth.png', 'Registered GR01 鎧焰蜥 (Growth): original story, species trait and move cards (values not asserted here)');

  // Go back to list
  await page.locator('.cm-vs2-footer button').click();
  await page.waitForSelector('.cm-vs2-database__row', { timeout: 5000 });

  // 3. Select Species 187 (UL03 霜灣戰牙 - Ultimate, registered)
  await page.locator('button.cm-vs2-database__row[data-species-index="187"]').click();
  await page.waitForSelector('.cm-dex-profile', { timeout: 5000 });
  assert.equal(await page.locator('.cm-dex-profile__text').textContent(),profiles.entries.find(e=>e.speciesIndex===187).textByLocale['zh-Hant']);
  await saveScreenshot(page, 'dex-04-registered-ul03-original-ultimate.png', 'Registered UL03 霜灣戰牙 (Ultimate): original story, species trait and move cards (values not asserted here)');

  // Go back to list
  await page.locator('.cm-vs2-footer button').click();
  await page.waitForSelector('.cm-vs2-database__row', { timeout: 5000 });

  // 4. Select Species 21 (B202 焰角丸 - UNDISCOVERED)
  await page.locator('button.cm-vs2-database__row[data-species-index="21"]').click();
  await page.waitForTimeout(500);
  const undiscoveredCheck = await page.evaluate(() => {
    return {
      hasHero: document.querySelector('.cm-dex-hero') !== null,
      hasProfile: document.querySelector('.cm-dex-profile') !== null,
      hasData: document.querySelector('.cm-dex-data') !== null,
      hasRoutes: document.querySelector('.cm-dex-routes') !== null
    };
  });
  assert.deepEqual(undiscoveredCheck,{hasHero:false,hasProfile:false,hasData:false,hasRoutes:false});
  assert.ok(!(await page.locator('.cm-vs2-database__detail').textContent()).includes(speciesName(21)),'Unregistered proper name stays absent');
  results.assertions.push({ test: 'Species 21 Undiscovered strictly masked', enforced:true, ...undiscoveredCheck });
  console.log('Species 21 (Undiscovered): hero/profile/data/routes all null =',
    !undiscoveredCheck.hasHero && !undiscoveredCheck.hasProfile && !undiscoveredCheck.hasData && !undiscoveredCheck.hasRoutes);
  await saveScreenshot(page, 'dex-05-undiscovered-strictly-masked.png', 'Undiscovered Species 21: strictly masked, zero story, stats, hero or route leaks');

  // Go back to list before switching to desktop
  await page.locator('.cm-vs2-footer button').click();
  await page.waitForSelector('.cm-vs2-database__row', { timeout: 5000 });

  // 5. Desktop wide layout (1280x800)
  console.log('\n--- Testing Desktop Wide Browse Layout (1280x800) ---');
  await page.setViewportSize({ width: 1280, height: 800 });
  await page.waitForTimeout(500);

  // Select Species 8 again to view side-by-side
  await page.locator('button.cm-vs2-database__row[data-species-index="8"]').click();
  await requireDecodedHero(page, b101Hero, 'zh-Hant', 'b101-desktop');

  const layoutCheck = await page.evaluate(() => {
    const list = document.querySelector('.cm-vs2-shop__list');
    const detail = document.querySelector('.cm-vs2-database__detail');
    return {
      bothVisible: Boolean(list && !list.hidden && detail && !detail.hidden && list.getBoundingClientRect().width>0 && detail.getBoundingClientRect().width>0),
      separateColumns: Boolean(list && detail && list.getBoundingClientRect().right<=detail.getBoundingClientRect().left+1),
      scrollWidth: document.body.scrollWidth,
      clientWidth: document.body.clientWidth,
      noHorizontalOverflow: document.body.scrollWidth <= document.body.clientWidth
    };
  });
  assert.equal(layoutCheck.bothVisible,true);
  assert.equal(layoutCheck.separateColumns,true);
  assert.equal(layoutCheck.noHorizontalOverflow,true);
  results.assertions.push({ test: 'Desktop 1280x800 side-by-side layout with no horizontal overflow', enforced:true, ...layoutCheck });
  console.log('Desktop layout: both visible =', layoutCheck.bothVisible, ', no horizontal overflow =', layoutCheck.noHorizontalOverflow);
  await saveScreenshot(page, 'dex-06-desktop-wide-browse-layout.png', 'Desktop 1280x800 wide layout: side-by-side list and detail with no horizontal overflow');

  await page.close();

  // Save QA results JSON
  assert.deepEqual(results.pageErrors,[],'No uncaught browser errors');
  results.capabilitySemanticsAccepted=true;
  results.capabilityDisplayContract='Attribute/family tags only; individual HP/TP omitted; move actionCost remains TP';
  results.status='AUTOMATED_CHECKS_PASSED_VISUAL_ACCEPTANCE_PENDING';
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
  console.log('\nQA report written to:', reportPath);
  console.log('Enforced automated checks and repeated reopen/navigation passed; independent screenshot review is still required.');
} catch (error) {
  results.status='FAILED';results.failures.push({message:String(error?.message??error)});
  fs.writeFileSync(reportPath,JSON.stringify(results,null,2));
  console.error('Browser QA failed:', error);
  process.exitCode = 1;
} finally {
  await browser.close();
  server.close();
}

// Isolated browser verification for tutorial Hunt feedback art failure and in-place retry recovery.
// Runs on an ephemeral HTTP server on 127.0.0.1:0 (never touches 8732 or live player data).
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const root = path.resolve('.');
const output = path.resolve('.tmp/browser-qa/tutorial-recovery');
fs.mkdirSync(output, { recursive: true });

const KEY = 'championshipModernSave:v1';
const PREFS_KEY = 'championshipModernSave:preferences:v1';

const mime = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.mjs': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.mp4': 'video/mp4',
  '.webp': 'image/webp',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.wasm': 'application/wasm'
};

const server = http.createServer((req, res) => {
  const relative = decodeURIComponent(new URL(req.url, 'http://local').pathname).replace(/^\/championship-2026\//, '/');
  const filePath = path.resolve(root, '.' + relative);
  if (!filePath.startsWith(root + path.sep) || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    res.writeHead(404);
    res.end();
    return;
  }
  const size = fs.statSync(filePath).size;
  const range = /^bytes=(\d+)-(\d*)/.exec(req.headers.range || '');
  const headers = {
    'Content-Type': mime[path.extname(filePath)] || 'application/octet-stream',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'no-cache'
  };
  let start = 0, end = size - 1;
  if (range) {
    start = Number(range[1]);
    end = Math.min(Number(range[2] || end), end);
    headers['Content-Range'] = `bytes ${start}-${end}/${size}`;
  }
  headers['Content-Length'] = end - start + 1;
  res.writeHead(range ? 206 : 200, headers);
  const stream = fs.createReadStream(filePath, { start, end });
  stream.pipe(res);
  res.on('close', () => stream.destroy());
});

async function generateTutorialHuntSave() {
  const { createChampionshipStandaloneApp } = await import('../src/championship/app/championshipStandaloneApp.js');
  const catalog = JSON.parse(fs.readFileSync('src/data/championship/catalogs/creature-species.r1.json', 'utf8'));
  const cages = JSON.parse(fs.readFileSync('docs/contracts/championship/raising-home-presentation.v1.json', 'utf8')).cages;
  const data = new Map();
  const storage = { getItem: k => data.get(k) ?? null, setItem: (k, v) => data.set(k, v), removeItem: k => data.delete(k) };
  let app = createChampionshipStandaloneApp({ storage, locks: null, catalog, cages, rngClock: () => ({ hour: 1, minute: 2, second: 3 }) });
  await app.newGame({ trainerName: 'QA', eggName: 'Egg' });
  app.save();
  const save = JSON.parse(storage.getItem(KEY));
  save.progression.nativeOpening = {
    version: 2,
    trainerName: 'QA',
    tutorialStep: null,
    checkpoint: { version: 1, stage: 'hunt-first-rope', message: 0 }
  };
  await app.dispose();
  return JSON.stringify(save);
}

(async () => {
  const verificationReport = {
    testName: 'tutorial-hunt-recovery-retry-in-place',
    timestamp: new Date().toISOString(),
    steps: [],
    success: false,
    environment: {
      type: 'Playwright Chromium mobile emulation',
      viewport: { width: 390, height: 844 },
      origin: null
    },
    unverifiedItems: {
      redirectOrCrashToTitle: 'PENDING_INVESTIGATION (跳回首頁仍待查，本測試專注驗收狩獵載入失敗的原地重試恢復與教學鎖定維護)',
      physicalIPhoneVerification: 'PENDING_PHYSICAL_DEVICE (本測試為 Headless Chromium 手機模擬，非實體 iPhone 硬體驗收)',
      subjectiveAudioParity: 'PENDING_HUMAN_LISTENING (靜音環境執行，視聽體驗待人工驗收)'
    }
  };

  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  const origin = `http://127.0.0.1:${port}`;
  verificationReport.environment.origin = origin;
  console.log(`Ephemeral test server running at ${origin}`);

  const initialSave = await generateTutorialHuntSave();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 3,
    hasTouch: true
  });

  const page = await context.newPage();
  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(err.message));

  try {
    // 1. Seed tutorial save and silent audio preferences into localStorage
    await context.addInitScript(({ saveKey, saveVal, prefsKey }) => {
      localStorage.setItem(saveKey, saveVal);
      localStorage.setItem(prefsKey, JSON.stringify({ bgmVolume: 0, sfxVolume: 0, reducedMotion: 'on' }));
    }, { saveKey: KEY, saveVal: initialSave, prefsKey: PREFS_KEY });

    // 2. Route interception: simulate network failure for hunt feedback manifest
    const feedbackManifestUrlPattern = '**/hunt-feedback-v1/manifest.json';
    let interceptActive = true;
    await page.route(feedbackManifestUrlPattern, route => {
      if (interceptActive) {
        console.log('[Mock Network] Intercepting hunt feedback manifest -> 503 Service Unavailable');
        return route.fulfill({ status: 503, contentType: 'text/plain', body: 'Controlled simulation of hunt feedback failure' });
      }
      return route.continue();
    });

    // 3. Open game
    await page.goto(`${origin}/championship.html`, { waitUntil: 'domcontentloaded' });
    verificationReport.steps.push({ name: 'navigate_championship_html', status: 'OK' });

    // With reducedMotion: 'on', opening film does not auto-play. Click Login directly.
    await page.waitForFunction(() => document.querySelector('#cm-login')?.disabled === false, null, { timeout: 10000 });
    await page.click('#cm-login');

    // Click Continue (繼續遊戲) to resume tutorial hunt
    await page.waitForFunction(() => document.querySelector('#cm-continue')?.disabled === false, null, { timeout: 10000 });
    await page.click('#cm-continue');
    verificationReport.steps.push({ name: 'continue_into_tutorial_hunt', status: 'OK' });

    // 4. Wait for HUNT_FIELD screen to mount
    await page.waitForSelector('#cm-root[data-screen="HUNT_FIELD"]', { timeout: 15000 });
    await page.waitForSelector('.cm-vs2-field__canvas', { timeout: 15000 });

    // 5. Verification: Fallback Notice is present and exit is DISABLED
    await page.waitForSelector('.cm-hunt-feedback-fallback-notice', { timeout: 10000 });
    const isFieldFallback = await page.evaluate(() => document.getElementById('cm-root')?.dataset.fieldFallback);
    assert.equal(isFieldFallback, 'true', 'root dataset.fieldFallback must be "true" on feedback asset failure');

    const noticeText = await page.locator('.cm-hunt-feedback-fallback-notice').textContent();
    assert.match(noticeText, /道具外觀素材未就緒，已切換為簡易圖形/, 'notice explains fallback graphics clearly');
    assert.equal(/返回牧場/.test(noticeText), false, 'misleading instruction to return to ranch is removed');

    const retryButton = page.locator('.cm-hunt-feedback-retry-button');
    assert.equal(await retryButton.isVisible(), true, 'retry button is visible in banner');
    assert.equal(await retryButton.isEnabled(), true, 'retry button is enabled');
    assert.match(await retryButton.textContent(), /重試載入/, 'retry button label matches copy');

    // Verify exit button is disabled (tutorial lock)
    const exitButton = page.locator('.cm-vs2-hud__exit');
    assert.equal(await exitButton.count(), 1, 'exit button exists');
    assert.equal(await exitButton.isDisabled(), true, 'exit button remains strictly disabled during tutorial');

    // Verify storage save before retry
    const storageBeforeRetry = await page.evaluate(k => localStorage.getItem(k), KEY);
    const parsedBefore = JSON.parse(storageBeforeRetry);
    assert.equal(parsedBefore.progression.nativeOpening.checkpoint.stage, 'hunt-first-rope');
    assert.equal(parsedBefore.progression.nativeOpening.checkpoint.message, 0);

    const shot1 = path.join(output, '01-fallback-notice-with-retry.png');
    await page.screenshot({ path: shot1 });
    verificationReport.steps.push({
      name: 'verify_fallback_notice_and_retry_button',
      status: 'OK',
      noticeText,
      screenshot: shot1
    });

    // 6. Restore network availability and Click Retry
    interceptActive = false;
    console.log('[Mock Network] Restoring hunt feedback availability; clicking retry button...');
    await retryButton.click();

    // 7. Verify in-place recovery: banner disappears and fieldFallback clears
    await page.waitForFunction(() => !document.querySelector('.cm-hunt-feedback-fallback-notice'), null, { timeout: 10000 });
    const isFieldFallbackAfter = await page.evaluate(() => document.getElementById('cm-root')?.dataset.fieldFallback);
    assert.equal(isFieldFallbackAfter, undefined, 'root dataset.fieldFallback is cleared after successful retry');

    // 8. Verify save and tutorial progress remain unchanged
    const storageAfterRetry = await page.evaluate(k => localStorage.getItem(k), KEY);
    assert.equal(storageAfterRetry, storageBeforeRetry, 'storage save is byte-for-byte identical across failure and in-place recovery');
    const parsedAfter = JSON.parse(storageAfterRetry);
    assert.equal(parsedAfter.progression.nativeOpening.checkpoint.stage, 'hunt-first-rope', 'tutorial checkpoint stage is identical');
    assert.equal(parsedAfter.progression.nativeOpening.checkpoint.message, 0, 'tutorial checkpoint message is identical');
    assert.equal(parsedAfter.progression.nativeOpening.trainerName, 'QA');

    const shot2 = path.join(output, '02-recovered-in-place.png');
    await page.screenshot({ path: shot2 });
    verificationReport.steps.push({
      name: 'verify_in_place_recovery_after_retry',
      status: 'OK',
      screenshot: shot2
    });

    verificationReport.success = true;
    console.log('✅ ALL E2E IN-PLACE RETRY & PROGRESS RETENTION CHECKS PASSED');
  } catch (err) {
    const errShot = path.join(output, 'failure.png');
    await page.screenshot({ path: errShot }).catch(() => {});
    verificationReport.error = err.message;
    verificationReport.stack = err.stack;
    verificationReport.failureScreenshot = errShot;
    console.error('❌ Test failed:', err);
    throw err;
  } finally {
    fs.writeFileSync(path.join(output, 'TUTORIAL_RECOVERY_VERIFICATION_RESULT.json'), JSON.stringify(verificationReport, null, 2), 'utf8');
    await context.close();
    await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})();

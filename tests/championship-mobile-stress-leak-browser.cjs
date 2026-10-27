// Mobile & iOS Standalone PWA ("Add to Home Screen") High-Pressure Stress & Leak Harness
//
// Emulates an iPhone Pro Max (390x844, DPR=3, touch, navigator.standalone=true)
// and runs 12 consecutive cross-page loops across:
//   Title -> Raising Home -> Cage Edit -> Gate Select (3D) -> Hunt Loadout ->
//   Hunt Field (cycling maps) -> Raising Home -> Battle Select (3D) ->
//   Battle Field (skill casts + 3D VFX) / Data Arena (skill casts) ->
//   Shop -> Database -> Background/Foreground lifecycle
// plus WebGL context loss/restore, History popstate guard, and Standalone
// crash/reload auto-resume verification.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { spawn } = require('node:child_process');
const { chromium } = require('playwright');
const { startGame, openHunt, selectEnterableGate, leaveHuntField, RAISING_HOME, GATE_CONFIRM } = require('./championship-browser-opening.cjs');

const OUTPUT = require('./browser-qa-output.cjs')('mobile-stress-leak');
const SAVE_KEY = 'championshipModernSave:v1';
const LOOPS = Number(process.env.STRESS_LOOPS || 10);
const BASELINE_ONLY = process.env.STRESS_BASELINE_ONLY === '1';
const qaSave = fs.readFileSync(path.join(__dirname, '../qa/championship-full-qa-save.json'), 'utf8');

fs.mkdirSync(OUTPUT, { recursive: true });

function checkPort(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const req = http.get(`http://${host}:${port}/championship.html`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1000, () => { req.destroy(); resolve(false); });
  });
}

async function ensureServer() {
  const defaultPort = Number(process.env.CHAMPIONSHIP_PORT || 8738);
  if (await checkPort(defaultPort)) {
    return { origin: `http://127.0.0.1:${defaultPort}`, close: async () => {} };
  }
  const child = spawn(process.execPath, [path.join(__dirname, '../scripts/serve.mjs')], {
    cwd: path.join(__dirname, '..'),
    env: { ...process.env, CHAMPIONSHIP_PORT: String(defaultPort), CHAMPIONSHIP_HOST: '127.0.0.1' },
    stdio: ['ignore', 'pipe', 'pipe']
  });
  for (let i = 0; i < 40; i += 1) {
    if (await checkPort(defaultPort)) {
      return {
        origin: `http://127.0.0.1:${defaultPort}`,
        close: async () => { child.kill(); }
      };
    }
    await new Promise((r) => setTimeout(r, 150));
  }
  child.kill();
  throw new Error(`Failed to start local server on port ${defaultPort}`);
}

(async () => {
  const server = await ensureServer();
  const baseUrl = `${server.origin}/championship.html`;
  const browser = await chromium.launch({
    headless: true,
    executablePath: process.env.CHAMPIONSHIP_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'
  });

  const consoleErrors = [];
  const pageErrors = [];
  const unhandledRejections = [];
  const contextLostEvents = [];
  const unexpectedTitleDrops = [];
  const loopMetrics = [];

  try {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
    });

    // Inject iOS Standalone PWA environment & WebGL GPU resource tracker
    await context.addInitScript(() => {
      try {
        Object.defineProperty(window.navigator, 'standalone', {
          get: () => true,
          configurable: true
        });
      } catch {}

      const tracker = {
        totalContextsCreated: 0,
        activeContexts: 0,
        peakActiveContexts: 0,
        liveTextures: 0,
        peakTextures: 0,
        liveBuffers: 0,
        peakBuffers: 0,
        liveFramebuffers: 0,
        peakFramebuffers: 0,
        livePrograms: 0,
        peakPrograms: 0,
        contextLosses: 0,
        contextRestores: 0,
        maxPixelRatioSeen: 0
      };
      window.__gpuTracker = tracker;

      const origGetContext = HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext = function (type, attrs) {
        const ctx = origGetContext.call(this, type, attrs);
        if ((type === 'webgl' || type === 'webgl2' || type === 'experimental-webgl') && ctx && !ctx.__tracked) {
          ctx.__tracked = true;
          let contextAlive = true;
          tracker.totalContextsCreated += 1;
          tracker.activeContexts += 1;
          if (tracker.activeContexts > tracker.peakActiveContexts) {
            tracker.peakActiveContexts = tracker.activeContexts;
          }

          const ctxResources = {
            liveTextures: new Set(),
            liveBuffers: new Set(),
            liveFramebuffers: new Set(),
            livePrograms: new Set()
          };

          const markLost = () => {
            if (contextAlive) {
              contextAlive = false;
              tracker.activeContexts = Math.max(0, tracker.activeContexts - 1);
              for (const key of ['liveTextures', 'liveBuffers', 'liveFramebuffers', 'livePrograms']) {
                tracker[key] = Math.max(0, tracker[key] - ctxResources[key].size);
                ctxResources[key].clear();
              }
            }
          };
          this.addEventListener('webglcontextlost', () => {
            tracker.contextLosses += 1;
            markLost();
          });
          this.addEventListener('webglcontextrestored', () => {
            tracker.contextRestores += 1;
            if (!contextAlive) {
              contextAlive = true;
              tracker.activeContexts += 1;
            }
          });

          const origGetExtension = ctx.getExtension.bind(ctx);
          ctx.getExtension = function (name) {
            const ext = origGetExtension(name);
            if (name === 'WEBGL_lose_context' && ext && !ext.__tracked) {
              ext.__tracked = true;
              const origLose = ext.loseContext.bind(ext);
              ext.loseContext = function () {
                markLost();
                return origLose();
              };
            }
            return ext;
          };

          const wrapCreateDelete = (createName, deleteName, liveKey, peakKey) => {
            if (typeof ctx[createName] !== 'function' || typeof ctx[deleteName] !== 'function') return;
            const origCreate = ctx[createName].bind(ctx);
            const origDelete = ctx[deleteName].bind(ctx);
            const liveSet = ctxResources[liveKey];
            ctx[createName] = function (...args) {
              const obj = origCreate(...args);
              if (obj && typeof obj === 'object' && contextAlive) {
                liveSet.add(obj);
                tracker[liveKey] += 1;
                if (tracker[liveKey] > tracker[peakKey]) tracker[peakKey] = tracker[liveKey];
              }
              return obj;
            };
            ctx[deleteName] = function (obj, ...args) {
              if (obj && liveSet.has(obj)) {
                liveSet.delete(obj);
                tracker[liveKey] = Math.max(0, tracker[liveKey] - 1);
              }
              return origDelete(obj, ...args);
            };
          };

          wrapCreateDelete('createTexture', 'deleteTexture', 'liveTextures', 'peakTextures');
          wrapCreateDelete('createBuffer', 'deleteBuffer', 'liveBuffers', 'peakBuffers');
          wrapCreateDelete('createFramebuffer', 'deleteFramebuffer', 'liveFramebuffers', 'peakFramebuffers');
          wrapCreateDelete('createProgram', 'deleteProgram', 'livePrograms', 'peakPrograms');
        }
        return ctx;
      };

      window.addEventListener('unhandledrejection', (e) => {
        window.__unhandledRejections = window.__unhandledRejections || [];
        window.__unhandledRejections.push(String(e.reason?.message || e.reason || 'unhandledrejection'));
      });
    });

    const page = await context.newPage();
    page.setDefaultTimeout(45000);
    page.on('pageerror', (err) => pageErrors.push(err.stack || err.message || String(err)));
    page.on('console', (msg) => {
      if (msg.type() === 'error') consoleErrors.push(msg.text());
    });

    await page.goto(baseUrl, { waitUntil: 'domcontentloaded' });
    await page.evaluate(([key, val]) => {
      localStorage.clear();
      sessionStorage.clear();
      localStorage.setItem(key, val);
    }, [SAVE_KEY, qaSave]);
    await page.reload({ waitUntil: 'domcontentloaded' });

    await startGame(page, { continueGame: true });
    await page.waitForSelector('#cm-root[data-active-screen="RAISING_HOME"]');
    await page.waitForSelector('.cm-raising-pixi-canvas');
    await page.waitForTimeout(400);

    const checkNotDroppedToTitle = async (stepLabel) => {
      const state = await page.evaluate(() => ({
        titleHidden: document.getElementById('cm-title')?.hidden,
        rootHidden: document.getElementById('cm-root')?.hidden,
        dataArenaOpen: Boolean(document.querySelector('.da-root:not([hidden])')),
        activeScreen: document.getElementById('cm-root')?.dataset.activeScreen,
        screen: document.getElementById('cm-root')?.dataset.screen
      }));
      if (!state.titleHidden || (state.rootHidden && !state.dataArenaOpen)) {
        unexpectedTitleDrops.push({ stepLabel, state });
        throw new Error(`Unexpected jump to Title during ${stepLabel}: ${JSON.stringify(state)}`);
      }
      return state;
    };

    const sampleMemory = async (loopIndex, phaseLabel) => {
      return page.evaluate(({ loopIndex, phaseLabel }) => {
        const heap = performance.memory ? {
          usedJSHeapSize: performance.memory.usedJSHeapSize,
          totalJSHeapSize: performance.memory.totalJSHeapSize
        } : null;
        const canvases = [...document.querySelectorAll('canvas')].map((c) => ({
          className: c.className,
          renderer: c.dataset.renderer || null,
          width: c.width,
          height: c.height,
          clientWidth: c.clientWidth,
          clientHeight: c.clientHeight,
          effectiveDpr: c.clientWidth > 0 ? +(c.width / c.clientWidth).toFixed(2) : null
        }));
        const maxDpr = canvases.reduce((m, c) => Math.max(m, c.effectiveDpr || 0), 0);
        if (window.__gpuTracker && maxDpr > window.__gpuTracker.maxPixelRatioSeen) {
          window.__gpuTracker.maxPixelRatioSeen = maxDpr;
        }
        return {
          loopIndex,
          phaseLabel,
          activeScreen: document.getElementById('cm-root')?.dataset.activeScreen,
          canvasCount: canvases.length,
          maxCanvasDpr: maxDpr,
          gpu: window.__gpuTracker ? { ...window.__gpuTracker } : null,
          heap,
          rejections: (window.__unhandledRejections || []).length
        };
      }, { loopIndex, phaseLabel });
    };

    for (let loop = 1; loop <= LOOPS; loop += 1) {
      // 1. Raising Home -> Cage Edit -> Raising Home
      await checkNotDroppedToTitle(`loop-${loop}-start-ranch`);
      await page.locator('button[data-menu-id="MANAGEMENT"]').click();
      await page.locator('[data-entry-id="cageEdit"]').click();
      await page.waitForSelector('#cm-root[data-active-screen="CAGE_EDIT"]');
      await page.waitForTimeout(150);
      await checkNotDroppedToTitle(`loop-${loop}-cage-edit`);
      await page.locator('#cm-root[data-active-screen="CAGE_EDIT"] .cm-vs2-footer button').first().click();
      await page.waitForSelector('#cm-root[data-active-screen="RAISING_HOME"]');
      await page.waitForTimeout(150);

      // 2. Raising Home -> Gate Select (3D) -> Hunt Loadout -> Hunt Field -> Raising Home
      await openHunt(page, { timeout: 25000 });
      await checkNotDroppedToTitle(`loop-${loop}-gate-select`);
      // Pick among enterable gates, rotating by loop index to exercise different Hunt maps
      const nodes = page.locator('.cm-vs2-gate3d__node-hit:not([hidden])');
      const nodeCount = await nodes.count();
      const enterableIndices = [];
      for (let i = 0; i < nodeCount; i += 1) {
        await nodes.nth(i).click();
        if (!(await page.locator(GATE_CONFIRM).isDisabled())) {
          enterableIndices.push(i);
        }
      }
      assert.ok(enterableIndices.length > 0, `loop ${loop}: must have enterable gates`);
      const chosenIdx = enterableIndices[(loop - 1) % enterableIndices.length];
      await nodes.nth(chosenIdx).click();
      await page.locator(GATE_CONFIRM).click();
      await page.waitForSelector('[data-screen="HUNT_LOADOUT"]', { timeout: 20000 });
      await checkNotDroppedToTitle(`loop-${loop}-hunt-loadout`);

      await page.locator('.cm-vs2-footer .cm-vs2-action--primary').click();
      await page.waitForSelector('[data-screen="HUNT_FIELD"]', { timeout: 25000 });
      await page.waitForTimeout(350);
      await checkNotDroppedToTitle(`loop-${loop}-hunt-field`);

      // Pan / interact in Hunt Field
      const fieldBox = await page.locator('.cm-vs2-field__canvas').boundingBox();
      if (fieldBox && fieldBox.width > 50 && fieldBox.height > 50) {
        await page.mouse.click(fieldBox.x + fieldBox.width * 0.65, fieldBox.y + fieldBox.height * 0.65);
        await page.waitForTimeout(200);
      }

      const huntSample = await sampleMemory(loop, 'HUNT_FIELD');
      await leaveHuntField(page);
      if ((await page.locator('#cm-root').getAttribute('data-screen')) === 'HUNT_RESULT') {
        await page.locator('.cm-vs2-footer .cm-vs2-action--primary').click();
      }
      await page.waitForSelector('#cm-root[data-active-screen="RAISING_HOME"]', { timeout: 20000 });
      await page.waitForTimeout(200);

      // 3. Battle Select (3D Cube) -> Free Battle (with 3D VFX & skill casts) or Data Arena (with skill casts)
      await page.locator('button[data-menu-id="SYSTEM"]').click();
      await page.locator('[data-entry-id="battle"]').click();
      await page.waitForSelector('#cm-root[data-active-screen="BATTLE_SELECT"]', { timeout: 20000 });
      await checkNotDroppedToTitle(`loop-${loop}-battle-select`);

      if (loop % 2 === 1) {
        // Odd loops: Free Battle (VS5_BATTLE_FIELD) -> exercises 3D Battle VFX overlay + Highlight Burst + Pixi Battle FX + Character Animator
        const freeBattleBtn = page.locator('.cm-vs5-cube__face[data-face-id="FREE_BATTLE"]');
        if (await freeBattleBtn.count()) {
          await freeBattleBtn.click();
          await page.waitForTimeout(150);
        }
        const matchBtn = page.locator('.cm-vs5-match__enter:not(:disabled)').first();
        if (await matchBtn.count()) {
          await matchBtn.click();
          await page.waitForSelector('.cm-vs5-party button[data-instance-id]', { timeout: 10000 });
        }
        const partyBtns = page.locator('.cm-vs5-party button[data-instance-id]:not(:disabled)');
        const primaryActionBtn = page.locator('.cm-vs5-footer .cm-vs5-action--primary');
        for (let p = 0; p < 3; p += 1) {
          if ((await partyBtns.count()) === 0) break;
          const isReady = await primaryActionBtn.isEnabled().catch(() => false);
          if (isReady && p > 0) break;
          await partyBtns.first().click();
          await page.waitForTimeout(60);
        }
        const startBattleBtn = page.locator('.cm-vs5-footer .cm-vs5-action--primary:not(:disabled)');
        if (await startBattleBtn.count()) {
          await startBattleBtn.click();
          await page.waitForSelector('#cm-root[data-active-screen="BATTLE_FIELD"], #cm-root[data-screen="BATTLE_FIELD"]', { timeout: 25000 });
          // Wait for battle scene & VFX overlay to finish mounting and run combat frames + skill casts
          await page.waitForTimeout(2500);
          await checkNotDroppedToTitle(`loop-${loop}-battle-field`);
          const battleSample = await sampleMemory(loop, 'BATTLE_FIELD');
          loopMetrics.push(battleSample);
          // Exit battle back to Raising Home
          const exitBattleBtn = page.locator('.cm-vs5-exit');
          if (await exitBattleBtn.isVisible().catch(() => false)) {
            await exitBattleBtn.click();
            const confirmLeave = page.locator('dialog.cm-dialog [data-action="leave"]');
            if (await confirmLeave.isVisible({ timeout: 3000 }).catch(() => false)) {
              await confirmLeave.click();
            }
          }
          if ((await page.locator('#cm-root').getAttribute('data-active-screen')) === 'BATTLE_RESULT') {
            await page.locator('.cm-vs5-footer .cm-vs5-action--primary, .cm-vs5-exit').last().click();
          }
          await page.waitForSelector('#cm-root[data-active-screen="RAISING_HOME"]', { timeout: 25000 });
        } else {
          await page.locator('.cm-vs5-exit').first().click();
          await page.waitForSelector('#cm-root[data-active-screen="RAISING_HOME"]', { timeout: 20000 });
        }
      } else {
        // Even loops: Data Arena -> exercises Data Arena Pixi scene + skill casts (Digit2, KeyQ, KeyE, KeyR, Space)
        await page.click('#cm-data-arena');
        await page.waitForSelector('.da-panel--select', { timeout: 15000 });
        await page.locator('.da-partner').nth((loop / 2) % 3).click();
        await page.click('.da-panel--select .da-btn--primary');
        const briefBtn = page.locator('.da-panel--brief .da-btn--primary');
        if (await briefBtn.isVisible().catch(() => false)) {
          await briefBtn.click();
        }
        await page.waitForSelector('.da-root[data-state="PLAY"]', { timeout: 30000 });
        // Cast all skills and dash rapidly!
        await page.keyboard.press('Digit2');
        await page.waitForTimeout(120);
        await page.keyboard.press('KeyQ');
        await page.waitForTimeout(120);
        await page.keyboard.press('KeyE');
        await page.waitForTimeout(120);
        await page.keyboard.press('KeyR');
        await page.waitForTimeout(120);
        await page.keyboard.press('Space');
        await page.waitForTimeout(250);
        await checkNotDroppedToTitle(`loop-${loop}-data-arena-skills`);
        const arenaSample = await sampleMemory(loop, 'DATA_ARENA');
        loopMetrics.push(arenaSample);
        // Pause and exit Data Arena
        await page.click('.da-hud__pause');
        await page.waitForSelector('.da-panel--pause', { timeout: 10000 });
        await page.locator('.da-panel--pause .da-btn--quiet').click();
        await page.waitForSelector('#cm-root[data-active-screen="BATTLE_SELECT"]', { timeout: 20000 });
        await page.locator('.cm-vs5-exit').first().click();
        await page.waitForSelector('#cm-root[data-active-screen="RAISING_HOME"]', { timeout: 20000 });
      }

      // 4. Shop & Database quick switch
      await page.locator('button[data-menu-id="SYSTEM"]').click();
      await page.locator('[data-entry-id="shop"]').click();
      await page.waitForSelector('#cm-root[data-active-screen="SHOP"]', { timeout: 15000 });
      await checkNotDroppedToTitle(`loop-${loop}-shop`);
      await page.locator('#cm-root[data-active-screen="SHOP"] .cm-vs2-footer button').first().click();
      await page.waitForSelector('#cm-root[data-active-screen="RAISING_HOME"]', { timeout: 15000 });

      await page.locator('button[data-menu-id="SYSTEM"]').click();
      await page.locator('[data-entry-id="database"]').click();
      await page.waitForSelector('#cm-root[data-active-screen="DATABASE"]', { timeout: 15000 });
      await checkNotDroppedToTitle(`loop-${loop}-database`);
      await page.locator('#cm-root[data-active-screen="DATABASE"] .cm-vs2-footer button, #cm-root[data-active-screen="DATABASE"] .cm-screen-back').first().click();
      await page.waitForSelector('#cm-root[data-active-screen="RAISING_HOME"]', { timeout: 15000 });

      // 5. Background / Foreground lifecycle resilience on every 3rd loop
      if (loop % 3 === 0) {
        await page.evaluate(() => {
          Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' });
          Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
          document.dispatchEvent(new Event('visibilitychange'));
        });
        await page.waitForTimeout(150);
        await page.evaluate(() => {
          delete document.visibilityState;
          delete document.hidden;
          document.dispatchEvent(new Event('visibilitychange'));
          window.dispatchEvent(new PageTransitionEvent('pageshow', { persisted: true }));
          window.dispatchEvent(new Event('focus'));
        });
        await page.waitForTimeout(150);
        await checkNotDroppedToTitle(`loop-${loop}-visibility-resume`);
      }

      await page.waitForTimeout(200);
      const ranchSample = await sampleMemory(loop, 'RAISING_HOME_SETTLED');
      ranchSample.huntTextures = huntSample.gpu?.liveTextures ?? null;
      loopMetrics.push(ranchSample);
      console.log(`Loop ${loop}/${LOOPS} settled:`, JSON.stringify({
        activeContexts: ranchSample.gpu?.activeContexts,
        liveTextures: ranchSample.gpu?.liveTextures,
        liveBuffers: ranchSample.gpu?.liveBuffers,
        maxCanvasDpr: ranchSample.maxCanvasDpr,
        heapMB: ranchSample.heap ? +(ranchSample.heap.usedJSHeapSize / (1024 * 1024)).toFixed(1) : null
      }));
    }

    const settledRanchSamples = loopMetrics.filter((m) => m.phaseLabel === 'RAISING_HOME_SETTLED');
    const firstLoop = settledRanchSamples[0];
    const lastLoop = settledRanchSamples[settledRanchSamples.length - 1];

    // Optional post-fix verifications (skipped only when running baseline capture)
    let standaloneAutoResumeVerified = false;
    let historyPopstateGuardVerified = false;
    let cssGestureLockVerified = false;

    if (!BASELINE_ONLY) {
      // Verify CSS gesture lock on body and canvas
      const cssCheck = await page.evaluate(() => {
        const bodyStyle = getComputedStyle(document.body);
        const canvas = document.querySelector('canvas');
        const canvasStyle = canvas ? getComputedStyle(canvas) : null;
        const viewportMeta = document.querySelector('meta[name="viewport"]')?.content || '';
        const appleCapable = document.querySelector('meta[name="apple-mobile-web-app-capable"]')?.content || '';
        const mobileCapable = document.querySelector('meta[name="mobile-web-app-capable"]')?.content || '';
        return {
          overscrollBehaviorY: bodyStyle.overscrollBehaviorY,
          userSelect: bodyStyle.userSelect || bodyStyle.webkitUserSelect,
          canvasTouchAction: canvasStyle?.touchAction,
          viewportFitCover: viewportMeta.includes('viewport-fit=cover'),
          appleCapable: appleCapable === 'yes',
          mobileCapable: mobileCapable === 'yes'
        };
      });
      assert.equal(cssCheck.viewportFitCover, true, 'viewport meta must include viewport-fit=cover');
      assert.equal(cssCheck.appleCapable, true, 'apple-mobile-web-app-capable must be yes');
      assert.equal(cssCheck.mobileCapable, true, 'mobile-web-app-capable must be yes');
      assert.ok(['none', 'contain'].includes(cssCheck.overscrollBehaviorY), `overscroll-behavior-y must be locked, got ${cssCheck.overscrollBehaviorY}`);
      assert.equal(cssCheck.userSelect, 'none', `user-select must be none, got ${cssCheck.userSelect}`);
      assert.equal(cssCheck.canvasTouchAction, 'none', `canvas touch-action must be none, got ${cssCheck.canvasTouchAction}`);
      cssGestureLockVerified = true;

      // Verify History popstate guard while inside SHOP
      await page.locator('button[data-menu-id="SYSTEM"]').click();
      await page.locator('[data-entry-id="shop"]').click();
      await page.waitForSelector('#cm-root[data-active-screen="SHOP"]');
      await page.evaluate(() => window.history.back());
      await page.waitForSelector('#cm-root[data-active-screen="RAISING_HOME"]', { timeout: 10000 });
      await checkNotDroppedToTitle('popstate-guard-from-shop');
      historyPopstateGuardVerified = true;

      // Verify iOS Standalone Silent Crash / Reload Active Session Auto-Resume:
      // Case A: Mid-Hunt (HUNT_FIELD) Jetsam kill where sessionStorage is wiped by iOS OS!
      await openHunt(page, { timeout: 20000 });
      await page.waitForSelector('#cm-root[data-active-screen="GATE_SELECT"]');
      const enterableNode = page.locator('.cm-vs2-gate3d__node-hit:not([hidden])').first();
      await enterableNode.click();
      await page.locator(GATE_CONFIRM).click();
      await page.waitForSelector('[data-screen="HUNT_LOADOUT"]', { timeout: 20000 });
      await page.locator('.cm-vs2-footer .cm-vs2-action--primary').click();
      await page.waitForSelector('[data-screen="HUNT_FIELD"]', { timeout: 25000 });
      // Verify localStorage holds the HUNT_FIELD checkpoint, then wipe sessionStorage to simulate iOS Jetsam process termination
      const huntCheckpointSaved = await page.evaluate(() => {
        const raw = window.localStorage.getItem('championshipSessionCheckpoint:v1');
        window.sessionStorage.clear();
        return raw ? JSON.parse(raw) : null;
      });
      assert.equal(huntCheckpointSaved?.screen, 'HUNT_FIELD', 'localStorage checkpoint must record HUNT_FIELD');
      assert.ok(huntCheckpointSaved?.substate?.gateId, 'localStorage checkpoint must record active gateId');
      await page.reload({ waitUntil: 'domcontentloaded' });
      // Auto-resume must recover from localStorage and land safely on HUNT_LOADOUT, never Title!
      await page.waitForSelector('#cm-root[data-active-screen="HUNT_LOADOUT"]', { timeout: 25000 });
      const resumedHuntScreen = await page.locator('#cm-root').getAttribute('data-active-screen');
      assert.equal(resumedHuntScreen, 'HUNT_LOADOUT', `Expected mid-hunt Jetsam reload to safely land on HUNT_LOADOUT, got ${resumedHuntScreen}`);
      await checkNotDroppedToTitle('standalone-jetsam-reload-mid-hunt-resume');

      // Case B: Mid-Battle (BATTLE_FIELD) Jetsam kill where sessionStorage is wiped by iOS OS!
      await page.locator('.cm-vs2-footer button').first().click();
      await page.waitForSelector('#cm-root[data-active-screen="GATE_SELECT"]', { timeout: 15000 });
      await page.locator('.cm-vs2-footer button').first().click();
      await page.waitForSelector('#cm-root[data-active-screen="RAISING_HOME"]', { timeout: 15000 });
      await page.locator('button[data-menu-id="SYSTEM"]').click();
      await page.locator('[data-entry-id="battle"]').click();
      await page.waitForSelector('#cm-root[data-active-screen="BATTLE_SELECT"]', { timeout: 20000 });
      const fbBtn = page.locator('.cm-vs5-cube__face[data-face-id="FREE_BATTLE"]');
      if (await fbBtn.count()) {
        await fbBtn.click();
        await page.waitForTimeout(150);
      }
      const mBtn = page.locator('.cm-vs5-match__enter:not(:disabled)').first();
      if (await mBtn.count()) {
        await mBtn.click();
        await page.waitForSelector('.cm-vs5-party button[data-instance-id]', { timeout: 10000 });
      }
      const pBtns = page.locator('.cm-vs5-party button[data-instance-id]:not(:disabled)');
      const pActBtn = page.locator('.cm-vs5-footer .cm-vs5-action--primary');
      for (let p = 0; p < 3; p += 1) {
        if ((await pBtns.count()) === 0) break;
        if ((await pActBtn.isEnabled().catch(() => false)) && p > 0) break;
        await pBtns.first().click();
        await page.waitForTimeout(60);
      }
      await page.locator('.cm-vs5-footer .cm-vs5-action--primary:not(:disabled)').click();
      await page.waitForSelector('#cm-root[data-active-screen="BATTLE_FIELD"]', { timeout: 25000 });
      const battleCheckpointSaved = await page.evaluate(() => {
        const raw = window.localStorage.getItem('championshipSessionCheckpoint:v1');
        window.sessionStorage.clear();
        return raw ? JSON.parse(raw) : null;
      });
      assert.equal(battleCheckpointSaved?.screen, 'BATTLE_FIELD', 'localStorage checkpoint must record BATTLE_FIELD');
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#cm-root[data-active-screen="BATTLE_SELECT"]', { timeout: 25000 });
      const resumedBattleScreen = await page.locator('#cm-root').getAttribute('data-active-screen');
      assert.equal(resumedBattleScreen, 'BATTLE_SELECT', `Expected mid-battle Jetsam reload to safely land on BATTLE_SELECT, got ${resumedBattleScreen}`);
      await checkNotDroppedToTitle('standalone-jetsam-reload-mid-battle-resume');
      standaloneAutoResumeVerified = true;
    }

    const report = {
      status: 'COMPLETED',
      loops: LOOPS,
      firstLoop,
      lastLoop,
      contextGrowth: (lastLoop?.gpu?.activeContexts ?? 0) - (firstLoop?.gpu?.activeContexts ?? 0),
      textureGrowth: (lastLoop?.gpu?.liveTextures ?? 0) - (firstLoop?.gpu?.liveTextures ?? 0),
      bufferGrowth: (lastLoop?.gpu?.liveBuffers ?? 0) - (firstLoop?.gpu?.liveBuffers ?? 0),
      maxCanvasDpr: lastLoop?.gpu?.maxPixelRatioSeen ?? 0,
      pageErrors,
      consoleErrors,
      unhandledRejections,
      unexpectedTitleDrops,
      standaloneAutoResumeVerified,
      historyPopstateGuardVerified,
      cssGestureLockVerified,
      loopMetrics
    };

    fs.writeFileSync(path.join(OUTPUT, 'stress-leak-report.json'), JSON.stringify(report, null, 2) + '\n');
    console.log('STRESS_SUMMARY:', JSON.stringify({
      loops: LOOPS,
      firstLoopContexts: firstLoop?.gpu?.activeContexts,
      lastLoopContexts: lastLoop?.gpu?.activeContexts,
      peakActiveContexts: lastLoop?.gpu?.peakActiveContexts,
      firstLoopTextures: firstLoop?.gpu?.liveTextures,
      lastLoopTextures: lastLoop?.gpu?.liveTextures,
      maxCanvasDpr: report.maxCanvasDpr,
      pageErrors: pageErrors.length,
      consoleErrors: consoleErrors.length,
      unexpectedTitleDrops: unexpectedTitleDrops.length,
      standaloneAutoResumeVerified,
      historyPopstateGuardVerified,
      cssGestureLockVerified
    }, null, 2));

    if (!BASELINE_ONLY) {
      assert.equal(pageErrors.length, 0, `Expected 0 pageErrors, got: ${JSON.stringify(pageErrors)}`);
      assert.equal(unexpectedTitleDrops.length, 0, `Expected 0 unexpectedTitleDrops, got: ${JSON.stringify(unexpectedTitleDrops)}`);
      assert.ok(report.maxCanvasDpr <= 1.76, `Expected mobile/iOS canvas DPR <= 1.75, got ${report.maxCanvasDpr}`);
      assert.ok(lastLoop.gpu.activeContexts <= 3, `Expected active WebGL contexts <= 3 after ${LOOPS} loops, got ${lastLoop.gpu.activeContexts}`);
      assert.ok(report.contextGrowth <= 0, `Expected 0 WebGL context growth across ${LOOPS} loops, got +${report.contextGrowth}`);
    }

    await context.close();
  } finally {
    await browser.close();
    await server.close();
  }
})().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});

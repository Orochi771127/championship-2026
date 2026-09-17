// Local visual QA for one complete Cage candidate. The production manifest is
// left untouched; Playwright substitutes only field_cm01_01's frame response.
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { startGame } = require('./championship-browser-opening.cjs');

const root = path.resolve(__dirname, '..');
const base = process.env.CHAMPIONSHIP_QA_URL || 'http://127.0.0.1:8734/championship.html';
const candidate = path.resolve(root, process.env.CHAMPIONSHIP_CAGE_CANDIDATE_FRAME
  || 'docs/art/production/original-character-cage-r1/cage-field-cm01-breeze-meadow-v1/previews/composite-hd4x.png');
const output = path.resolve(root, process.env.CHAMPIONSHIP_CAGE_CANDIDATE_OUTPUT || '.tmp/browser-qa/cage-art-candidate');
const framePattern = '**/assets/production/cage/licensed-runtime-v1/fields/field_cm01_01/frame-00.png';
const sizes = [{ width: 390, height: 844 }, { width: 820, height: 1180 }, { width: 1024, height: 1366 }];
const host = '.int-rh2-field-host';
const hash = body => crypto.createHash('sha256').update(body).digest('hex');

async function residents(page) {
  return page.locator(host).evaluate(node => JSON.parse(node.dataset.residentScreenPositions || '[]'));
}

async function actor(page) {
  const rows = await residents(page);
  const box = await page.locator(host).boundingBox();
  assert.ok(rows.length && box, 'live resident and field host are required');
  return { ...rows[0], pageX: box.x + rows[0].x, pageY: box.y + rows[0].y, hostBox: box };
}

async function waitState(page, allowed, timeout = 15000) {
  await page.waitForFunction(({ selector, states }) => {
    const row = JSON.parse(document.querySelector(selector)?.dataset.residentScreenPositions || '[]')[0];
    return states.includes(row?.state);
  }, { selector: host, states: allowed }, { timeout });
}

async function press(page, allowed) {
  for (let attempt = 0; attempt < 12; attempt += 1) {
    const current = await actor(page);
    await page.mouse.move(current.pageX, current.pageY);
    await page.mouse.down();
    try { await waitState(page, allowed, 900); return current; }
    catch { await page.mouse.up(); await page.waitForTimeout(90); }
  }
  throw Error(`Native hand failed to reach ${allowed}`);
}

async function centreVisibleActor(page) {
  let gestures = 0;
  for (; gestures < 12; gestures += 1) {
    const current = await actor(page);
    const margin = Math.min(90, current.hostBox.width * 0.22);
    if (current.x >= margin && current.x <= current.hostBox.width - margin) break;
    const left = current.hostBox.x + current.hostBox.width * 0.25;
    const right = current.hostBox.x + current.hostBox.width * 0.75;
    const y = current.hostBox.y + current.hostBox.height * 0.25;
    await page.mouse.move(current.x > current.hostBox.width / 2 ? right : left, y);
    await page.mouse.down();
    await page.mouse.move(current.x > current.hostBox.width / 2 ? left : right, y, { steps: 12 });
    await page.mouse.up();
    await page.waitForTimeout(120);
  }
  const current = await actor(page);
  assert.ok(current.x >= 0 && current.x <= current.hostBox.width, 'camera swipe reveals the normally relocated actor');
  return gestures;
}

(async () => {
  assert.ok(fs.existsSync(candidate), `candidate frame missing: ${candidate}`);
  const candidateBytes = fs.readFileSync(candidate);
  fs.mkdirSync(output, { recursive: true });
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  const context = await browser.newContext({ viewport: sizes[0], deviceScaleFactor: 1 });
  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  const errors = [], missingResources = [], screenshots = [];
  let candidateRequests = 0;
  page.on('pageerror', error => errors.push(error.message));
  page.on('response', response => { if (response.status() >= 400) missingResources.push({ url: response.url(), status: response.status() }); });
  await page.route(framePattern, async route => {
    candidateRequests += 1;
    await route.fulfill({ status: 200, contentType: 'image/png', body: candidateBytes });
  });
  try {
    const url = new URL(base);
    url.searchParams.set('presentation', 'developer');
    await page.goto(url.href, { waitUntil: 'networkidle' });
    await startGame(page);
    await page.locator(`${host}[data-resident-screen-positions]`).waitFor();
    await page.locator('[data-tool-id="hand"]').click();
    for (let i = 0; i < 3; i++) {
      const rows = await residents(page); const box = await page.locator(host).boundingBox();
      assert.ok(rows.length && box);
      await page.mouse.click(box.x + rows[0].x, box.y + rows[0].y);
      await page.waitForTimeout(100);
    }
    await page.waitForFunction(selector => JSON.parse(document.querySelector(selector)?.dataset.residentScreenPositions || '[]')[0]?.speciesIndex >= 8, host);
    await waitState(page, [1, 2, 3, 5, 17]);
    // At the wide viewport cm01 is visible at the upper-right of the existing
    // native ranch. Use the normal hold/carry/release gesture to land the live
    // resident on its open grass; no save, runtime coordinate or renderer hook
    // is used to manufacture the contact evidence.
    await page.setViewportSize(sizes[2]);
    await page.waitForTimeout(250);
    const held = await press(page, [6]);
    const candidateDrop = {
      x: held.hostBox.x + held.hostBox.width * 0.77,
      y: held.hostBox.y + held.hostBox.height * 0.48
    };
    await page.mouse.move(candidateDrop.x, candidateDrop.y, { steps: 24 });
    await page.mouse.up();
    await waitState(page, [1, 2, 3, 4, 9, 11, 13, 16, 17, 18], 30000);
    await page.waitForTimeout(400);
    const grounded = await actor(page);
    assert.ok(Math.hypot(grounded.pageX - candidateDrop.x, grounded.pageY - candidateDrop.y) < 180,
      'normal flight lands near the visible cm01 drop point');
    const grounding = {
      method: 'NORMAL_HAND_HOLD_CARRY_RELEASE',
      viewport: sizes[2],
      requestedScreenPoint: candidateDrop,
      landedResident: { x: grounded.x, y: grounded.y, state: grounded.state, nativeFrame: grounded.nativeFrame }
    };
    for (const viewport of sizes) {
      await page.setViewportSize(viewport);
      await page.waitForTimeout(350);
      const cameraPanGestures = await centreVisibleActor(page);
      const measurement = await page.locator(host).evaluate(node => {
        const hostRect = node.getBoundingClientRect();
        const canvas = node.querySelector('canvas')?.getBoundingClientRect();
        return {
          host: { x: hostRect.x, y: hostRect.y, width: hostRect.width, height: hostRect.height },
          canvas: canvas ? { x: canvas.x, y: canvas.y, width: canvas.width, height: canvas.height } : null,
          residents: JSON.parse(node.dataset.residentScreenPositions || '[]'),
          canvasCount: document.querySelectorAll('canvas').length,
          document: { width: document.documentElement.scrollWidth, height: document.documentElement.scrollHeight },
          viewport: { width: innerWidth, height: innerHeight },
          fallback: document.querySelector('#cm-root')?.dataset.fieldFallback || null
        };
      });
      assert.equal(measurement.canvasCount, 1);
      assert.equal(measurement.fallback, null);
      assert.equal(measurement.document.width, viewport.width);
      assert.equal(measurement.document.height, viewport.height);
      assert.ok(measurement.residents.length, 'representative actor remains in the candidate field');
      assert.ok(measurement.residents[0].x >= 0 && measurement.residents[0].x <= measurement.host.width);
      assert.ok(measurement.residents[0].y >= 0 && measurement.residents[0].y <= measurement.host.height);
      const filename = `raising-candidate-${viewport.width}x${viewport.height}.png`;
      await page.screenshot({ path: path.join(output, filename), fullPage: true });
      screenshots.push({ viewport, filename, cameraPanGestures, measurement });
    }
    assert.ok(candidateRequests >= 1, 'candidate frame was consumed by the existing Cage loader');
    assert.deepEqual(errors, []);
    assert.deepEqual(missingResources, []);
    const report = {
      status: 'PASS_WITH_FOREGROUND_OCCLUSION_UNKNOWN',
      fieldId: 'field_cm01_01',
      productionManifestModified: false,
      candidateFrame: path.relative(root, candidate).replaceAll('\\', '/'),
      candidateSha256: hash(candidateBytes),
      candidateRequests,
      grounding,
      screenshots,
      errors,
      missingResources,
      checks: {
        sameApplicationAndRenderer: true,
        normalGameActorPresent: true,
        actorWithinFieldBounds: true,
        actorFootContactOnCandidate: 'PASS_NORMAL_HAND_CARRY_RELEASE_VISIBLE_IN_SCREENSHOTS',
        threeViewportScreenshots: true,
        physicalDeviceAccepted: false,
        foregroundActorObjectOrdering: 'UNKNOWN_REQUIRES_TRACE'
      }
    };
    fs.writeFileSync(path.join(output, 'browser-qa.json'), JSON.stringify(report, null, 2) + '\n');
    console.log(`CAGE_ART_CANDIDATE_BROWSER_PASS screenshots=${screenshots.length} requests=${candidateRequests} occlusion=UNKNOWN_REQUIRES_TRACE`);
  } catch (error) {
    await page.screenshot({ path: path.join(output, 'failure.png'), fullPage: true });
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });

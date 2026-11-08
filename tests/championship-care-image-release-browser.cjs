#!/usr/bin/env node
'use strict';
// Real-browser regression: care images are never inserted into the document,
// and Chromium keeps such an <img> alive for the life of the page once its src
// attribute is removed (found by the 2026-11-08 system sweep heap snapshots).
// Runs the production careImageTextureScope through load, abort and failure
// paths, forces GC, and requires the DOM node count to return to baseline.
// A control loop with the old removeAttribute('src') release shows whether this
// browser still has the retention, so a pass is not silently vacuous.
const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const MODULE = '/src/championship/presentation/intRh2/careImageTextureScope.js';
const PNG = fs.readFileSync(path.join(ROOT, 'assets/production/cage/licensed-runtime-v1/fields/field_cm34_01/frame-00.png'));
const CYCLES = 20;
const EXECUTABLE = process.env.CHAMPIONSHIP_CHROMIUM || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);

function serve() {
  const server = http.createServer((request, response) => {
    const url = new URL(request.url, 'http://127.0.0.1');
    if (url.pathname === MODULE) {
      response.writeHead(200, { 'content-type': 'text/javascript' });
      response.end(fs.readFileSync(path.join(ROOT, MODULE)));
    } else if (url.pathname === '/care.png') {
      response.writeHead(200, { 'content-type': 'image/png', 'access-control-allow-origin': '*' });
      response.end(PNG);
    } else if (url.pathname === '/missing.png') {
      response.writeHead(404, { 'access-control-allow-origin': '*' });
      response.end();
    } else {
      response.writeHead(200, { 'content-type': 'text/html' });
      response.end('<!doctype html><meta name="viewport" content="width=device-width"><body></body>');
    }
  });
  return new Promise(resolve => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function main() {
  const server = await serve();
  const base = `http://127.0.0.1:${server.address().port}`;
  let browser = null;
  try {
    browser = await chromium.launch({ executablePath: EXECUTABLE, headless: true });
    const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2.625, isMobile: true, hasTouch: true });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(String(error)));
    await page.goto(`${base}/`);
    const cdp = await context.newCDPSession(page);
    const nodes = async () => {
      for (let i = 0; i < 3; i += 1) await cdp.send('HeapProfiler.collectGarbage');
      return (await cdp.send('Memory.getDOMCounters')).nodes;
    };

    const baseline = await nodes();
    const exercised = await page.evaluate(async ({ moduleUrl, cycles }) => {
      const { createCareImageTextureScope } = await import(moduleUrl);
      let textures = 0, destroyed = 0, aborted = 0, failed = 0;
      const PIXI = { Texture: { from() { textures += 1; return { destroy() { destroyed += 1; } }; } } };
      for (let cycle = 0; cycle < cycles; cycle += 1) {
        const scope = createCareImageTextureScope(PIXI);
        await Promise.all([0, 1, 2, 3].map(k => scope.load(`/care.png?c=${cycle}&k=${k}`)));
        await scope.load(`/missing.png?c=${cycle}`).catch(() => { failed += 1; });
        const controller = new AbortController();
        const cancelled = createCareImageTextureScope(PIXI, { signal: controller.signal });
        const pending = cancelled.load(`/care.png?pending=${cycle}`).catch(error => { if (error?.name === 'AbortError') aborted += 1; });
        controller.abort();
        await pending;
        scope.dispose();
      }
      return { textures, destroyed, aborted, failed };
    }, { moduleUrl: `${base}${MODULE}`, cycles: CYCLES });
    await page.waitForTimeout(300);
    const afterScope = await nodes();

    const control = await page.evaluate(async ({ cycles }) => {
      for (let cycle = 0; cycle < cycles; cycle += 1) {
        const image = new Image();
        image.crossOrigin = 'anonymous';
        image.decoding = 'async';
        image.src = `/care.png?control=${cycle}`;
        await image.decode();
        image.removeAttribute('src');
      }
    }, { cycles: CYCLES });
    void control;
    await page.waitForTimeout(300);
    const afterControl = await nodes();

    const scopeDelta = afterScope - baseline;
    const controlDelta = afterControl - afterScope;
    console.log(JSON.stringify({ browser: browser.version(), cycles: CYCLES, ...exercised, baseline, afterScope, scopeDelta, controlDelta }));
    assert.deepEqual(errors, []);
    assert.equal(exercised.textures, CYCLES * 4);
    assert.equal(exercised.destroyed, CYCLES * 4);
    assert.equal(exercised.failed, CYCLES);
    assert.equal(exercised.aborted, CYCLES);
    assert.ok(scopeDelta <= 6, `care images stayed alive after dispose: ${scopeDelta} DOM nodes over ${CYCLES * 6} images`);
    if (controlDelta < CYCLES) console.log('CONTROL_NOT_REPRODUCED: this browser no longer retains detached images after removeAttribute(src)');
    console.log('CARE_IMAGE_RELEASE_BROWSER_OK');
  } finally {
    await browser?.close();
    server.close();
  }
}

main().catch(error => { console.error(error); process.exitCode = 1; });

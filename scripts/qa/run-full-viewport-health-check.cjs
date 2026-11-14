#!/usr/bin/env node
// Full-game viewport health check (Owner brief 2026-11-01).
//
// Walks the game through its own buttons in six viewports and measures every
// screen it reaches against five gates: (1) no HUD or button overlap, (2) no
// clipped badges, labels or list ends, (3) landscape keeps the stage at least
// 55 % visible, (4) every screen is reachable and closes cleanly, (5) no
// horizontal overflow and primary buttons at least 40 px.
//
//   node scripts/qa/run-full-viewport-health-check.cjs \
//     --origin http://127.0.0.1:8761 [--slices 1,2] [--viewports portrait-pro,landscape-pro]
//     [--out .tmp/viewport-health] [--evidence docs/reports/<dir>/screens] [--story-origin <url>] [--gpu]
//
// Headless Chromium paints WebGL on the CPU (SwiftShader). At 1920x1080 the 3D ranch then
// renders so slowly that Playwright's "stable for two frames" wait times out on menu keys
// that are in fact shown and tappable. --gpu renders on the machine's graphics card.
//
// It never touches the Owner's save: port 8732 is refused, and every viewport
// runs in its own fresh browser context. Saves come from the normal New Game
// opening or from the repository's QA fixture (qa/championship-full-qa-save.json),
// written into the isolated origin before the game loads. Only that fixture is
// edited (pending ranch discoveries, so the journal button appears); no game
// state is injected after load and no QA hook drives the flows.
//
// Exit code 0 only when every state in every selected viewport has no findings.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const { VIEWPORTS, evaluateState, summarize } = require('./viewport-health-rules.cjs');
const { healthProbe, intervalCounterInit } = require('./viewport-health-probe.cjs');
const { SLICES: BASE_SLICES, Unreachable } = require('./viewport-health-slices.cjs');
const { EXTRA_SLICES } = require('./viewport-health-slices-extra.cjs');
const SLICES = Object.freeze({ ...BASE_SLICES, ...EXTRA_SLICES });

const repo = path.resolve(__dirname, '..', '..');

// Console messages that come from the loopback QA environment, not from the build players get:
// loopback loads the local review hunt-map manifests (src/championship/app/main.js
// ORIGINAL_HUNT_ART_MANIFEST_URL), the approved public URL loads the polished ones.
const ENVIRONMENT_CONSOLE = [/Hunt field art\/world mismatch/];

function parseArgs(argv) {
  const args = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i];
    if (!key.startsWith('--')) continue;
    const next = argv[i + 1];
    if (next === undefined || next.startsWith('--')) args[key.slice(2)] = true;
    else { args[key.slice(2)] = next; i += 1; }
  }
  return args;
}

/** One viewport, one slice: a fresh context plus the helpers a slice needs. */
class Run {
  constructor({ browser, viewport, slice, origin, out, evidence, evidenceStates, results, log, storyOrigin }) {
    Object.assign(this, { browser, viewport, slice, origin, out, evidence, evidenceStates, results, log, storyOrigin });
    this.errors = [];
    this.intervalBaseline = null;
  }

  async open() {
    const { width, height, kind } = this.viewport;
    const phone = kind !== 'desktop';
    this.context = await this.browser.newContext({
      viewport: { width, height }, deviceScaleFactor: 1, isMobile: phone, hasTouch: phone, locale: 'zh-TW',
      acceptDownloads: false
    });
    await this.context.addInitScript(intervalCounterInit);
    this.page = await this.context.newPage();
    if (this.viewport.safeArea) {
      // Real notch / home-indicator insets, so env(safe-area-inset-*) resolves as on the device.
      const { top, right, bottom, left } = this.viewport.safeArea;
      const cdp = await this.context.newCDPSession(this.page);
      await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top, topMax: top, right, rightMax: right, bottom, bottomMax: bottom, left, leftMax: left } });
    }
    this.page.setDefaultTimeout(15000);
    this.page.on('pageerror', error => this.errors.push(String(error?.message ?? error)));
    this.page.on('console', message => { if (message.type() === 'error') this.errors.push(message.text()); });
  }

  async close() { await this.context?.close().catch(() => {}); }

  /** Probe the current screen, evaluate it and keep a screenshot. */
  async check(state, spec = {}) {
    // The title parade walks behind the opening forms; it is title decoration, outside this audit.
    spec = { ...spec, exclude: [...(spec.exclude ?? []), '.cm-title__walker'] };
    fs.mkdirSync(path.join(this.out, this.viewport.id), { recursive: true });
    await this.settle(spec.settleMs ?? 450);
    if (this.remark && JSON.stringify(spec).includes('[data-vh-exit]')) await this.remark().catch(() => {});
    let raw;
    try { raw = await this.page.evaluate(healthProbe, { ...spec, lists: [] }); }
    catch (error) { raw = { error: String(error.message ?? error).split('\n')[0] }; }
    if (spec.lists?.length && raw && !raw.error) {
      // A list is judged at its end: scroll it (and every scrolling ancestor) to the bottom,
      // measure, then put every scroller back where the player left it.
      const saved = await this.page.evaluate(lists => {
        const scrolls = el => el.scrollHeight > el.clientHeight + 1 && /auto|scroll/.test(getComputedStyle(el).overflowY);
        const touched = new Map();
        const push = el => { if (!touched.has(el)) touched.set(el, el.scrollTop); el.scrollTop = el.scrollHeight; };
        for (const list of lists) {
          for (const container of document.querySelectorAll(list.container)) {
            const items = container.querySelectorAll(list.item);
            const last = items[items.length - 1];
            for (let node = last ?? container; node && node !== document.documentElement; node = node.parentElement) if (scrolls(node)) push(node);
            for (const node of container.querySelectorAll('*')) if (scrolls(node)) push(node);
          }
        }
        window.__vhScrolled = touched;
        return touched.size;
      }, spec.lists).catch(() => 0);
      await this.settle(450);
      try { raw.lists = (await this.page.evaluate(healthProbe, { lists: spec.lists })).lists; }
      catch (error) { raw.lists = []; }
      if (saved) {
        await this.page.screenshot({ path: path.join(this.out, this.viewport.id, `s${this.slice}-${state}--list-end.jpg`), type: 'jpeg', quality: 72 }).catch(() => {});
        await this.page.evaluate(() => { for (const [el, top] of window.__vhScrolled ?? []) el.scrollTop = top; delete window.__vhScrolled; }).catch(() => {});
      }
    }
    const findings = evaluateState(raw, { viewport: this.viewport, spec });
    const shot = path.join(this.out, this.viewport.id, `s${this.slice}-${state}.jpg`);
    fs.mkdirSync(path.dirname(shot), { recursive: true });
    await this.page.screenshot({ path: shot, type: 'jpeg', quality: 72 }).catch(() => {});
    if (this.evidence && this.evidenceStates.has(`${this.slice}:${state}`) && this.viewport.evidence) {
      const file = path.join(this.evidence, `${state}--${this.viewport.id}.png`);
      fs.mkdirSync(path.dirname(file), { recursive: true });
      await this.page.screenshot({ path: file }).catch(() => {});
    }
    const record = { viewport: this.viewport.id, slice: this.slice, state, screen: raw?.screen ?? null, stage: raw?.stage?.ratio ?? null,
      areas: raw?.areas ?? [], groupCounts: Object.fromEntries(Object.entries(raw?.groups ?? {}).map(([name, list]) => [name, list.length])),
      findings, screenshot: path.relative(this.out, shot).replaceAll('\\', '/'), dialogs: raw?.dialogs ?? [] };
    this.results.push(record);
    this.log(`  ${findings.length ? '✗' : '✓'} ${this.viewport.id} s${this.slice} ${state}${findings.length ? ` (${findings.length})` : ''}`);
    for (const item of findings.slice(0, 6)) this.log(`      [G${item.gate} ${item.code}] ${item.detail}`);
    return findings;
  }

  /** A finding that is not a geometry measurement: an entry that could not be reached. */
  fail(state, gate, code, detail) {
    const shot = path.join(this.out, this.viewport.id, `s${this.slice}-${state}--${code.toLowerCase()}.jpg`);
    fs.mkdirSync(path.dirname(shot), { recursive: true });
    if (this.page && !this.page.isClosed()) this.page.screenshot({ path: shot, type: 'jpeg', quality: 72 }).catch(() => {});
    this.results.push({ viewport: this.viewport.id, slice: this.slice, state, screen: null, stage: null,
      findings: [{ gate, code, detail }], screenshot: path.relative(this.out, shot).split(path.sep).join('/'), dialogs: [] });
    this.log(`  ✗ ${this.viewport.id} s${this.slice} ${state} [G${gate} ${code}] ${detail}`);
  }

  async settle(ms) {
    await this.page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))).catch(() => {});
    if (ms) await this.page.waitForTimeout(ms);
  }

  /** Tap a real control the way a player would; unreachable controls are findings. */
  async tap(selector, { state, what, timeout = 12000, force = false } = {}) {
    if (this.remark && selector.includes('[data-vh-exit]')) await this.remark().catch(() => {});
    const target = this.page.locator(selector).first();
    try {
      await target.waitFor({ state: 'visible', timeout });
    } catch {
      this.fail(state ?? 'navigation', 4, 'UNREACHABLE', `${what ?? selector}：找不到可見的入口（${selector}）`);
      throw new Unreachable(selector);
    }
    try {
      await target.click({ timeout, force });
    } catch (error) {
      const reason = String(error.message).split('\n').find(line => /intercepts|outside of the viewport|not stable|not enabled/.test(line)) ?? String(error.message).split('\n')[0];
      this.fail(state ?? 'navigation', 4, 'UNREACHABLE', `${what ?? selector}：無法點擊（${reason.trim().slice(0, 140)}）`);
      throw new Unreachable(selector);
    }
  }

  async screen() { return this.page.evaluate(() => document.getElementById('cm-root')?.dataset.activeScreen ?? null); }

  async waitScreen(id, timeout = 30000) {
    await this.page.waitForFunction(screen => document.getElementById('cm-root')?.dataset.activeScreen === screen, id, { timeout });
  }

  async waitHome(timeout = 90000) {
    await this.page.waitForFunction(() => document.getElementById('cm-root')?.dataset.activeScreen === 'RAISING_HOME'
      && ['ready', 'error'].includes(document.querySelector('.int-rh2-field-host')?.dataset.loadState), null, { timeout });
  }

  async intervals() { return this.page.evaluate(() => Number(window.__vhIntervalCount ?? 0)); }

  /** Run one named step; an unreachable control or a crash is recorded and the slice moves on. */
  async step(name, fn) {
    try { await fn(); return true; }
    catch (error) {
      if (!(error instanceof Unreachable)) {
        this.fail(name, 4, 'STEP_FAILED', String(error.message ?? error).split('\n')[0].slice(0, 200));
        const shot = path.join(this.out, this.viewport.id, `s${this.slice}-${name}-failed.jpg`);
        fs.mkdirSync(path.dirname(shot), { recursive: true });
        await this.page.screenshot({ path: shot, type: 'jpeg', quality: 72 }).catch(() => {});
      }
      return false;
    }
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const origin = String(args.origin ?? process.env.CHAMPIONSHIP_QA_ORIGIN ?? 'http://127.0.0.1:8761').replace(/\/$/, '');
  if (new URL(origin).port === '8732') throw new Error('Port 8732 holds the Owner\'s save; run the health check on an isolated QA origin.');
  const out = path.resolve(args.out ?? path.join(repo, '.tmp', 'viewport-health'));
  const evidence = args.evidence ? path.resolve(args.evidence) : null;
  const wanted = args.viewports ? String(args.viewports).split(',') : null;
  const viewports = VIEWPORTS.filter(v => !wanted || wanted.includes(v.id) || wanted.includes(`${v.width}x${v.height}`))
    .map(v => ({ ...v, evidence: ['desktop-laptop', 'portrait-pro', 'landscape-pro'].includes(v.id) }));
  const sliceIds = args.slices ? String(args.slices).split(',').map(Number) : [1, 2, 3, 4, 5, 6];
  const evidenceStates = new Set(String(args['evidence-states'] ?? '').split(',').filter(Boolean));
  for (const slice of sliceIds) for (const state of SLICES[slice]?.evidence ?? []) evidenceStates.add(`${slice}:${state}`);
  fs.mkdirSync(out, { recursive: true });
  const results = [];
  const lines = [];
  const log = line => { lines.push(line); console.log(line); };
  const browser = await chromium.launch({ headless: args.headed ? false : true,
    args: args.gpu ? ['--enable-gpu', '--ignore-gpu-blocklist', ...(process.platform === 'win32' ? ['--use-angle=d3d11'] : [])] : [] });
  const started = Date.now();
  try {
    for (const viewport of viewports) {
      for (const slice of sliceIds) {
        const definition = SLICES[slice];
        if (!definition) throw new Error(`Unknown slice ${slice}`);
        log(`▶ ${viewport.label} — Slice ${slice}：${definition.title}`);
        const run = new Run({ browser, viewport, slice, origin, out, evidence, evidenceStates, results, log, storyOrigin: args['story-origin'] ? String(args['story-origin']).replace(/\/$/, '') : null });
        await run.open();
        try { await definition.run(run, { repo }); }
        catch (error) { run.fail('slice', 4, 'STEP_FAILED', String(error.message ?? error).split('\n')[0].slice(0, 200)); }
        const all = [...new Set(run.errors)];
        const environment = all.filter(text => ENVIRONMENT_CONSOLE.some(pattern => pattern.test(text)));
        const errors = all.filter(text => !environment.includes(text) && !/favicon|ERR_ABORTED/i.test(text));
        if (environment.length) results.push({ viewport: viewport.id, slice, state: 'console-environment', screen: null, findings: [], info: environment.slice(0, 3), screenshot: null, dialogs: [] });
        if (errors.length) run.fail('console', 4, 'CONSOLE_ERROR', errors.slice(0, 3).join(' | ').slice(0, 300));
        await run.close();
      }
    }
  } finally { await browser.close(); }
  const summary = summarize(results);
  const report = { generatedAt: new Date().toISOString(), origin, durationMs: Date.now() - started,
    viewports: viewports.map(v => v.id), slices: sliceIds, summary, results };
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 2) + '\n');
  fs.writeFileSync(path.join(out, 'report.txt'), lines.join('\n') + '\n');
  log(`\n${summary.pass ? 'PASS' : 'FAIL'}: ${summary.states} states, ${summary.findings} findings `
    + `(G1 ${summary.byGate[1]} / G2 ${summary.byGate[2]} / G3 ${summary.byGate[3]} / G4 ${summary.byGate[4]} / G5 ${summary.byGate[5]}) → ${path.join(out, 'report.json')}`);
  process.exitCode = summary.pass ? 0 : 1;
}

if (require.main === module) main().catch(error => { console.error(error); process.exitCode = 2; });

module.exports = { Run, parseArgs };

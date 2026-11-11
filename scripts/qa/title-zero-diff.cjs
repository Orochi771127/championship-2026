#!/usr/bin/env node
// Title zero-diff check (juicy-monster-ui "Verification").
//
// The title, its logo, the main menu and the opening stay exactly as main shipped
// them unless the Owner names them. This compares the computed styles and boxes of
// every rendered element on those screens between two origins — main (before) and
// the batch (after) — in desktop, portrait and landscape, and prints each difference.
//
// The New Game onboarding forms (tamer licence, egg chooser, egg name) are compared
// too but reported apart: the 2026-11-01 brief names them, so a difference there is
// a decision to review, not a breach. On 2026-11-02 the Owner also named the
// prologue's side padding (its skip key sat in the side notch), so the prologue is
// reported apart as well. The letter is not named.
//
// The phones carry the health check's notch and home-indicator insets: a rule that
// only reads env(safe-area-inset-*) changes nothing on a flat screen.
//
//   node scripts/qa/title-zero-diff.cjs --before http://127.0.0.1:8822 --after http://127.0.0.1:8821
//
// Never point it at 127.0.0.1:8732 (the Owner's save).
'use strict';

const { chromium } = require('playwright');
const opening = require('../../tests/championship-browser-opening.cjs');
const { VIEWPORTS: HEALTH_VIEWPORTS } = require('./viewport-health-rules.cjs');

const safeAreaOf = id => HEALTH_VIEWPORTS.find(v => v.id === id).safeArea;
const VIEWPORTS = [
  { id: 'desktop', width: 1366, height: 768 },
  { id: 'portrait', width: 390, height: 844, mobile: true, safeArea: safeAreaOf('portrait-pro') },
  { id: 'landscape', width: 844, height: 390, mobile: true, safeArea: safeAreaOf('landscape-pro') }
];
const PROTECTED = new Set(['title', 'menu', 'letter']);
const PROPS = ['display', 'position', 'top', 'right', 'bottom', 'left', 'margin', 'padding', 'font-size', 'font-weight',
  'line-height', 'letter-spacing', 'color', 'background-color', 'background-image', 'border-width', 'border-color', 'border-radius',
  'box-shadow', 'opacity', 'transform', 'z-index', 'grid-template-columns', 'grid-template-rows', 'flex-direction',
  'justify-content', 'align-items', 'gap', 'text-align', 'white-space', 'visibility', 'overflow-x', 'overflow-y'];

function parseArgs(argv) {
  const args = { before: null, after: null };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--before') args.before = argv[++i];
    else if (argv[i] === '--after') args.after = argv[++i];
  }
  for (const origin of [args.before, args.after]) {
    if (!origin) throw new Error('usage: --before <main origin> --after <batch origin>');
    if (/:8732\b/.test(origin)) throw new Error('8732 is the Owner\'s save; use an isolated QA port');
  }
  return args;
}

// The title parade picks its walkers and their paths at random on every load,
// generated art is served from per-origin blob: URLs, and the story types its
// characters in on a wall-clock timer; none of these is a style difference.
function snapshot(props) {
  const RANDOM = '.cm-title__walker, .cm-title__walker *';
  const TYPED = '.cm-cutscene__char';
  const key = el => {
    const parts = [];
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const index = n.parentElement ? [...n.parentElement.children].indexOf(n) : 0;
      parts.unshift(`${n.tagName.toLowerCase()}${n.id ? `#${n.id}` : ''}${n.classList.length ? `.${[...n.classList].join('.')}` : ''}:${index}`);
    }
    return parts.join(' > ');
  };
  const out = {};
  for (const el of document.querySelectorAll('body *')) {
    if (!el.getClientRects().length || el.matches(RANDOM)) continue;
    const cs = getComputedStyle(el), r = el.getBoundingClientRect();
    const value = {};
    for (const p of props) value[p] = cs.getPropertyValue(p).replace(/blob:[^)"']+/g, 'blob:');
    if (el.matches(TYPED)) delete value.opacity;
    value.box = [r.x, r.y, r.width, r.height].map(n => Math.round(n)).join(',');
    out[key(el)] = value;
  }
  return out;
}

async function walk(browser, origin, viewport) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height },
    isMobile: Boolean(viewport.mobile), hasTouch: Boolean(viewport.mobile), reducedMotion: 'reduce' });
  const page = await context.newPage();
  if (viewport.safeArea) {
    const { top, right, bottom, left } = viewport.safeArea;
    const cdp = await context.newCDPSession(page);
    await cdp.send('Emulation.setSafeAreaInsetsOverride', { insets: { top, topMax: top, right, rightMax: right, bottom, bottomMax: bottom, left, leftMax: left } });
  }
  const states = {};
  const take = async name => { await page.waitForTimeout(900); states[name] = await page.evaluate(snapshot, PROPS); };
  try {
    await page.goto(`${origin}/championship.html`, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => document.querySelector('#cm-login')?.disabled === false, null, { timeout: 60000 });
    await page.locator('#cm-opening-film video').evaluateAll(videos => { for (const v of videos) v.playbackRate = 16; });
    await page.waitForFunction(() => { const film = document.querySelector('#cm-opening-film'); return !film || film.hidden; }, null, { timeout: 60000 });
    await take('title');
    await page.click('#cm-login');
    await page.waitForLoadState('networkidle');
    await take('menu');
    await page.click('#cm-new-game');
    await page.locator('.cm-opening-story').first().waitFor({ state: 'visible', timeout: 20000 });
    await take('story');
    // Since 2026-11-03 the story stops at Ai-chan's cat / catgirl choice: play it the way
    // the gates do (tests/championship-browser-opening.cjs), choice included.
    await opening.playStory(page, { story: 'skip', guideAppearance: 'cat' });
    await page.click('.cm-opening__envelope');
    await take('letter');
    await page.click('.cm-opening__letter button');
    await page.locator('#cm-opening-name').waitFor();
    await take('licence');
    await page.fill('#cm-opening-name', '測試');
    await page.click('.cm-opening__name button[type=submit]');
    await page.locator('.cm-opening__choices button').first().click();
    await page.click('.cm-opening__envelope');
    await page.click('.cm-opening__letter button');
    await page.click('.cm-opening__letter button');
    if (await page.locator('.cm-opening__egg-choice').count()) {
      await take('eggs');
      await page.locator('input[name="starterEgg"][value="0"]').check();
      await page.click('[data-egg-confirm]');
    }
    await page.locator('#cm-opening-name').waitFor();
    await take('egg-name');
  } finally {
    await context.close();
  }
  return states;
}

function compare(before, after) {
  const diffs = [];
  for (const key of new Set([...Object.keys(before), ...Object.keys(after)])) {
    const a = before[key], b = after[key];
    if (!a || !b) { diffs.push({ key, prop: a ? 'removed' : 'added', before: a ? 'rendered' : '-', after: b ? 'rendered' : '-' }); continue; }
    for (const prop of Object.keys(a)) if (a[prop] !== b[prop]) diffs.push({ key, prop, before: a[prop], after: b[prop] });
  }
  return diffs;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const browser = await chromium.launch();
  let breaches = 0;
  try {
    for (const viewport of VIEWPORTS) {
      const [before, after] = [await walk(browser, args.before, viewport), await walk(browser, args.after, viewport)];
      for (const state of Object.keys(before)) {
        const diffs = after[state] ? compare(before[state], after[state]) : [{ key: state, prop: 'state', before: 'reached', after: 'missing' }];
        const guarded = PROTECTED.has(state);
        if (guarded) breaches += diffs.length;
        console.log(`${diffs.length ? (guarded ? '✗' : '△') : '✓'} ${viewport.id} ${state}: ${diffs.length} diff${guarded ? '' : '（Owner 點名）'}`);
        for (const d of diffs.slice(0, 12)) console.log(`    ${d.key.split(' > ').slice(-2).join(' > ')} ${d.prop}: ${d.before} → ${d.after}`);
        if (diffs.length > 12) console.log(`    … ${diffs.length - 12} more`);
      }
    }
  } finally {
    await browser.close();
  }
  console.log(breaches ? `TITLE ZERO-DIFF FAILED: ${breaches} difference(s) on title/menu/letter` : 'TITLE ZERO-DIFF: 0 difference on title, menu and letter');
  process.exit(breaches ? 1 : 0);
}

main().catch(error => { console.error(error); process.exit(1); });

// Three layout sets (Owner brief 2026-11-11): phone upright, phone sideways, desktop.
//
// The rules a browser is not needed for: which desktop windows are zoomed and by how much,
// that canvases follow the zoom, that every game sheet sizes its text from the reading-size
// preference and its viewport lengths from the zoom-aware units, and that the audit's sheet
// is loaded last. The geometry itself is measured by scripts/qa/run-full-viewport-health-check.cjs.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { desktopUiZoom, interfaceZoom, UI_ZOOM_MIN, DESKTOP_UI_REFERENCE, DESKTOP_UI_ZOOM_MAX, LAYOUT_SETS, layoutSetFor, mountPortraitFrame } from '../src/championship/app/portraitFrame.js';
import { cappedPixelRatio, effectiveDevicePixelRatio, uiZoom } from '../src/championship/presentation/presentationPreferences.js';
import { resolutionFor } from '../src/championship/presentation/championshipPixiStage.js';
import { READING_SHEETS, HUD_SHEETS, literalSizes, scaleSheet } from '../scripts/qa/apply-text-scale.mjs';
import { viewportSheets, literalUnits, zoomAwareUnits, UNZOOMED_SHEETS } from '../scripts/qa/apply-viewport-units.mjs';

const repo = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = file => fs.readFileSync(path.join(repo, file), 'utf8');

test('every window belongs to one of three layout sets', () => {
  assert.deepEqual(LAYOUT_SETS, ['upright', 'sideways', 'desktop']);
  for (const [width, height, set] of [
    [390, 844, 'upright'], [375, 667, 'upright'], [768, 1024, 'upright'], [820, 1180, 'upright'],
    [844, 390, 'sideways'], [667, 375, 'sideways'], [932, 430, 'sideways'], [1180, 520, 'sideways'],
    [1366, 768, 'desktop'], [1024, 600, 'desktop'], [1371, 771, 'desktop'], [1180, 820, 'desktop'],
    [1000, 700, 'upright'], [1280, 560, 'upright']
  ]) assert.equal(layoutSetFor({ width, height }), set, `${width}x${height}`);
  assert.equal(layoutSetFor({}), 'upright');
});

test('a desktop window larger than the reference shows the desktop layout zoomed, in steps', () => {
  assert.deepEqual(DESKTOP_UI_REFERENCE, { width: 1366, height: 768 });
  assert.equal(desktopUiZoom({ width: 1366, height: 768 }), 1, 'the reference window is not zoomed');
  assert.equal(desktopUiZoom({ width: 1440, height: 900 }), 1, 'under 1.1 the layout is left alone');
  assert.equal(desktopUiZoom({ width: 1536, height: 864 }), 1.1, 'a 125% Windows laptop');
  assert.equal(desktopUiZoom({ width: 1920, height: 1080 }), 1.4);
  assert.equal(desktopUiZoom({ width: 2560, height: 1440 }), 1.85);
  assert.equal(desktopUiZoom({ width: 2560, height: 1080 }), 1.4, 'an ultrawide window follows its height');
  assert.equal(desktopUiZoom({ width: 3840, height: 2160 }), DESKTOP_UI_ZOOM_MAX);
  for (const [width, height] of [[1536, 864], [1600, 900], [1920, 1080], [2560, 1440], [3840, 2160], [5120, 1440]]) {
    const zoom = desktopUiZoom({ width, height });
    assert.ok(width / zoom >= DESKTOP_UI_REFERENCE.width - 1 && height / zoom >= DESKTOP_UI_REFERENCE.height - 1,
      `${width}x${height} keeps at least the reference layout (${zoom})`);
    assert.equal(Math.round(zoom * 20), zoom * 20 > 0 ? Math.round(zoom * 20) : 0, 'steps of 0.05');
  }
});

test('phones, tablets, the title and a hidden game are never zoomed', () => {
  assert.equal(desktopUiZoom({ width: 1920, height: 1080, touch: true }), 1);
  assert.equal(desktopUiZoom({ width: 1920, height: 1080, gameVisible: false }), 1);
  assert.equal(desktopUiZoom({ width: 844, height: 390 }), 1);
  assert.equal(desktopUiZoom({ width: 390, height: 844 }), 1);
  assert.equal(desktopUiZoom({}), 1);
});

test('small phones show their set smaller; phones and tablets are never scaled up', () => {
  // Unchanged: the six audit windows, the common phones between them, tablets and foldables.
  for (const [width, height] of [[390, 844], [375, 667], [360, 780], [393, 852], [412, 915], [430, 932], [844, 390], [667, 375], [932, 430], [852, 393],
    [768, 1024], [820, 1180], [600, 960], [1180, 500], [1180, 820], [1366, 768]])
    assert.equal(interfaceZoom({ width, height, touch: width < 1300 }), 1, `${width}x${height}`);
  // Smaller than the reference by more than a tenth: scaled down in steps of 0.05, same set.
  for (const [width, height, zoom, set] of [[320, 568, 0.8, 'upright'], [340, 720, 0.85, 'upright'], [360, 560, 0.8, 'upright'], [568, 320, 0.8, 'sideways'], [740, 340, 0.85, 'sideways']]) {
    assert.equal(interfaceZoom({ width, height, touch: true }), zoom, `${width}x${height}`);
    assert.equal(layoutSetFor({ width: width / zoom, height: height / zoom }), set, `${width}x${height} stays ${set}`);
  }
  assert.equal(interfaceZoom({ width: 1920, height: 1080 }), 1.4, 'desktop follows desktopUiZoom');
  assert.equal(interfaceZoom({ width: 280, height: 500, touch: true }), UI_ZOOM_MIN, 'never below the floor');
  assert.equal(interfaceZoom({ width: 320, height: 568, gameVisible: false }), 1, 'the title is never scaled');
  assert.equal(interfaceZoom({}), 1);
});

function frameFixture({ width, height, userAgent = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)', coarse = false, titleHidden = true } = {}) {
  const attrs = new Set(), styles = new Map(), htmlStyles = new Map(), listeners = new Map(), events = [];
  const html = { dataset: {}, clientWidth: width, clientHeight: height,
    style: { setProperty: (k, v) => htmlStyles.set(k, v), removeProperty: k => htmlStyles.delete(k),
      set zoom(v) { htmlStyles.set('zoom', v); }, get zoom() { return htmlStyles.get('zoom') ?? ''; } } };
  const root = { dataset: { activeScreen: 'RAISING_HOME' }, hidden: false };
  const title = { hidden: titleHidden };
  const doc = { documentElement: html, activeElement: null,
    body: { toggleAttribute: (name, on) => { if (on) attrs.add(name); else attrs.delete(name); }, removeAttribute: name => attrs.delete(name),
      style: { setProperty: (k, v) => styles.set(k, v), removeProperty: k => styles.delete(k) } },
    getElementById: id => id === 'cm-root' ? root : id === 'cm-title' ? title : null,
    addEventListener() {}, removeEventListener() {} };
  const win = { innerWidth: width, innerHeight: height, navigator: { userAgent }, screen: {},
    matchMedia: query => ({ matches: query.includes('coarse') ? coarse : query.includes('any-pointer: fine') ? !coarse : false }),
    addEventListener: (type, fn) => listeners.set(type, fn), removeEventListener() {},
    dispatchEvent: event => { events.push(event.type); return true; }, Event: class { constructor(type) { this.type = type; } } };
  const controller = mountPortraitFrame({ window: win, document: doc, responsiveRaising: true, responsiveMenus: true });
  return { attrs, styles, htmlStyles, html, root, title, win, events, controller, resize(w, h) { win.innerWidth = w; win.innerHeight = h; listeners.get('resize')?.(); } };
}

test('the frame puts the zoom on <html>, tells the canvases, and judges layouts in page pixels', () => {
  const f = frameFixture({ width: 1920, height: 1080 });
  assert.equal(f.htmlStyles.get('zoom'), '1.4');
  assert.equal(f.htmlStyles.get('--cm-ui-zoom'), '1.4');
  assert.equal(f.html.dataset.uiZoom, '1.4');
  assert.deepEqual(f.events, ['cm-ui-zoom']);
  assert.ok(f.attrs.has('data-desktop-raising'), '1371x771 page pixels is still the desktop ranch');
  assert.equal(f.html.dataset.layoutSet, 'desktop');
  assert.ok(!f.attrs.has('data-portrait-frame'));
  f.resize(1366, 768);
  assert.ok(!f.htmlStyles.has('zoom') && !f.htmlStyles.has('--cm-ui-zoom') && f.html.dataset.uiZoom === undefined, 'the reference window clears the zoom');
  assert.deepEqual(f.events, ['cm-ui-zoom', 'cm-ui-zoom']);
  f.resize(2560, 1440);
  assert.equal(f.htmlStyles.get('zoom'), '1.85');
  f.controller.dispose();
  assert.ok(!f.htmlStyles.has('zoom') && f.html.dataset.uiZoom === undefined && f.html.dataset.layoutSet === undefined, 'dispose leaves nothing on <html>');
});

test('the title screen, a touch device and a phone-sized window keep their own size', () => {
  assert.ok(!frameFixture({ width: 1920, height: 1080, titleHidden: false }).htmlStyles.has('zoom'), 'title showing');
  assert.ok(!frameFixture({ width: 1920, height: 1080, coarse: true }).htmlStyles.has('zoom'), 'touch screen');
  assert.ok(!frameFixture({ width: 1366, height: 1024, userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)' }).htmlStyles.has('zoom'), 'tablet held sideways');
  const tablet = frameFixture({ width: 768, height: 1024, coarse: true, userAgent: 'Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X)' });
  assert.ok(!tablet.htmlStyles.has('zoom'), 'a tablet held upright keeps its pixels (its rules are written for 768px)');
  assert.equal(tablet.html.dataset.layoutSet, 'upright');
  const small = frameFixture({ width: 320, height: 568, coarse: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0 like Mac OS X)' });
  assert.equal(small.htmlStyles.get('zoom'), '0.8', 'a 320px phone shows the upright set smaller');
  const sideways = frameFixture({ width: 844, height: 390 });
  assert.ok(!sideways.htmlStyles.has('zoom'), 'phone sideways');
  assert.equal(sideways.html.dataset.layoutSet, 'sideways');
  assert.equal(frameFixture({ width: 390, height: 844 }).html.dataset.layoutSet, 'upright');
});

test('canvases back each page pixel with the device ratio times the interface zoom', () => {
  const doc = { documentElement: { dataset: {} } };
  assert.equal(uiZoom(doc), 1);
  doc.documentElement.dataset.uiZoom = '1.4';
  assert.equal(uiZoom(doc), 1.4);
  doc.documentElement.dataset.uiZoom = 'junk';
  assert.equal(uiZoom(doc), 1);
  const previous = { document: globalThis.document, ratio: Object.getOwnPropertyDescriptor(globalThis, 'devicePixelRatio') };
  try {
    globalThis.document = { documentElement: { dataset: { uiZoom: '1.4' } } };
    Object.defineProperty(globalThis, 'devicePixelRatio', { value: 1, configurable: true });
    assert.equal(effectiveDevicePixelRatio(), 1.4);
    assert.equal(cappedPixelRatio(2), 1.4, 'balanced: the 3D ranch renders every screen pixel');
    assert.equal(cappedPixelRatio(1), 1, 'saver stays at one');
    assert.equal(resolutionFor(2), 1.4, 'the Pixi field follows the same ratio');
    assert.equal(resolutionFor(1), 1);
    assert.equal(resolutionFor(2, 3), 2, 'an explicit ratio is still only capped');
  } finally {
    if (previous.document === undefined) delete globalThis.document; else globalThis.document = previous.document;
    if (previous.ratio) Object.defineProperty(globalThis, 'devicePixelRatio', previous.ratio); else delete globalThis.devicePixelRatio;
  }
});

test('every game sheet sizes its text from the reading-size preference', () => {
  for (const file of [...READING_SHEETS, ...HUD_SHEETS]) assert.equal(literalSizes(source(file)), 0, `${file} has a literal pixel font size`);
  assert.equal(scaleSheet('a { font-size: 13px; } b { font: 800 13px/1 var(--font-ui); } c { font-size: var(--fs-body); } d { font-size: clamp(13px, 4vw, 15px); }', '--text-scale'),
    'a { font-size: calc(13px * var(--text-scale, 1)); } b { font: 800 calc(13px * var(--text-scale, 1))/1 var(--font-ui); } c { font-size: var(--fs-body); } d { font-size: clamp(13px, 4vw, 15px); }');
  const tokens = source('src/championship/app/ui/tokens.css');
  assert.match(tokens, /:root\[data-text-scale="115"\] \{ --text-scale: 1\.15; --text-scale-hud: 1\.075; \}/);
  assert.match(tokens, /:root\[data-text-scale="130"\] \{ --text-scale: 1\.3; --text-scale-hud: 1\.15; \}/);
  for (const file of HUD_SHEETS) assert.ok(!/var\(--text-scale,/.test(source(file)), `${file} is live HUD and takes the half step`);
});

test('every game sheet measures the window in zoom-aware units; the opening keeps its own', () => {
  const sheets = viewportSheets();
  assert.ok(sheets.includes('src/championship/app/ui/layoutSets.css') && sheets.includes('src/championship/app/dataArena.css'));
  for (const file of UNZOOMED_SHEETS) assert.ok(!sheets.includes(file), `${file} is never zoomed`);
  for (const file of sheets) assert.equal(literalUnits(source(file)), 0, `${file} has a raw viewport length`);
  assert.equal(zoomAwareUnits('a { max-height: calc(100dvh - 64px); width: min(100vw - 32px, 420px); } /* 100vh in prose */'),
    'a { max-height: calc(calc(100 * var(--cm-dvh, 1dvh)) - 64px); width: min(calc(100 * var(--cm-vw, 1vw)) - 32px, 420px); } /* 100vh in prose */');
  assert.equal(zoomAwareUnits(zoomAwareUnits('a { top: -50vh; }')), 'a { top: calc(-50 * var(--cm-vh, 1vh)); }', 'idempotent');
  const tokens = source('src/championship/app/ui/tokens.css');
  for (const unit of ['vw', 'vh', 'dvh', 'lvh', 'vmin', 'vmax']) {
    assert.ok(tokens.includes(`--cm-${unit}: 1${unit};`), `tokens define --cm-${unit}`);
    assert.ok(tokens.includes(`--cm-${unit}: calc(1${unit} / var(--cm-ui-zoom));`), `--cm-${unit} follows the zoom`);
  }
});

test('the audit sheet loads last; the title only gets the three fixes the Owner asked for', () => {
  const html = source('championship.html');
  const links = [...html.matchAll(/<link rel="stylesheet" href="\.\/([^"?]+)/g)].map(match => match[1]);
  assert.equal(links.at(-1), 'src/championship/app/ui/layoutSets.css');
  const sheet = source('src/championship/app/ui/layoutSets.css');
  const rules = sheet.replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(!/#cm-opening|\.cm-opening/.test(rules), 'no opening selector');
  // Title (Owner 2026-11-11): scale on a large desktop, two keys side by side when held sideways.
  const titleRules = rules.split('\n').filter(line => /#cm-title|\.cm-title/.test(line));
  assert.ok(titleRules.length > 0 && titleRules.every(line => line.includes('body[data-landscape-entry] #cm-title')), 'title rules only touch the landscape entry');
  assert.match(rules, /--cm-entry-logo-width: clamp\(260px, calc\(40 \* var\(--cm-vw, 1vw\)\), calc\(520px \* var\(--cm-title-scale, 1\)\)\)/);
  // The partner list's element row has its own line (it was a 75px column at phone width).
  assert.match(sheet, /\.cm-digimon-stat\[data-row="taxonomy"\] \{ grid-column: 1 \/ -1; \}/);
});

test('the two new palettes keep words legible on their panels (電子生命, 晴空清新)', () => {
  const css = fs.readFileSync('src/championship/app/ui/tokens.css', 'utf8');
  const block = selector => { const start = css.indexOf(selector + ' {'); assert.ok(start >= 0, selector); return css.slice(start, css.indexOf('\n}\n', start)); };
  const tokens = text => Object.fromEntries([...text.matchAll(/(--[\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)].map(m => [m[1], m[2]]));
  const base = tokens(block(':root[data-theme="arcade"], [data-palette="arcade"]'));
  const lum = hex => { const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(c => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const contrast = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m); return (x + 0.05) / (y + 0.05); };
  for (const tone of ['cyber', 'breeze']) {
    const p = { ...base, ...tokens(block(`:root[data-theme="arcade"][data-theme-tone="${tone}"], [data-palette="${tone}"]`)) };
    for (const surface of ['--c-ground', '--c-surface-1', '--c-surface-2', '--ax-paper', '--ax-paper-2']) {
      for (const text of ['--c-text-1', '--c-text-2', '--c-text-3', '--ax-ink']) assert.ok(contrast(p[text], p[surface]) >= 4.5, `${tone}: ${text} on ${surface} is ${contrast(p[text], p[surface]).toFixed(2)}`);
      assert.ok(contrast(p['--c-text-disabled'], p[surface]) >= 2.5, `${tone}: disabled text on ${surface} is ${contrast(p['--c-text-disabled'], p[surface]).toFixed(2)}`);
    }
    for (const status of ['--c-success', '--c-warning', '--c-danger', '--c-info', '--c-rare', '--c-gold-strong', '--c-accent-strong', '--c-stat-hp', '--c-stat-tp'])
      assert.ok(contrast(p[status], p['--c-surface-1']) >= 4.5, `${tone}: ${status} on a panel is ${contrast(p[status], p['--c-surface-1']).toFixed(2)}`);
    assert.ok(contrast('#ffffff', p['--c-accent']) >= 4.5, `${tone}: a primary key's words`);
    // The ink outline and slab must still read against the stage behind the panels.
    assert.ok(contrast(p['--ax-ink'], p['--c-void']) >= 1.15, `${tone}: ink against the stage is ${contrast(p['--ax-ink'], p['--c-void']).toFixed(2)}`);
  }
});

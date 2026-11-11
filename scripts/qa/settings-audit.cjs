#!/usr/bin/env node
// Settings implementation audit (Owner brief 2026-11-11).
//
// Changes every display preference through the Settings panel's own controls and measures
// what the page does: which text grows with 字體大小, what 精簡 hides, what each 畫質 tier
// gives the 3D ranch (backing-store pixels, antialias, blur tokens), and whether the largest
// text size breaks a layout (clipped or overflowing labels, horizontal page scroll).
//
//   node scripts/qa/settings-audit.cjs --origin http://127.0.0.1:8951 [--out .tmp/settings-audit] [--gpu]
//
// Port 8732 (the Owner's save) is refused; each viewport runs in a fresh browser context.
'use strict';
const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');
const opening = require('../../tests/championship-browser-opening.cjs');

const repo = path.resolve(__dirname, '..', '..');
const SAVE_KEY = 'championshipModernSave:v1';
const args = Object.fromEntries(process.argv.slice(2).reduce((acc, value, index, all) => {
  if (value.startsWith('--')) acc.push([value.slice(2), all[index + 1] && !all[index + 1].startsWith('--') ? all[index + 1] : true]);
  return acc;
}, []));
const origin = String(args.origin ?? '');
if (!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin) || /:8732$/.test(origin)) { console.error('use an isolated loopback --origin (never 8732)'); process.exit(2); }
const out = path.resolve(repo, String(args.out ?? '.tmp/settings-audit'));
const VIEWPORTS = [
  { id: 'portrait', width: 390, height: 844, phone: true },
  { id: 'landscape', width: 844, height: 390, phone: true },
  { id: 'desktop', width: 1366, height: 768, phone: false }
];
const only = args.viewports ? String(args.viewports).split(',') : null;

// Screens visited for the text-size and density measurements: [name, open(page), close(page)].
const quick = id => `.cm-toolbar__quick-entry[data-quick-id="${id}"]`;
const waitScreen = (page, id) => page.waitForFunction(s => document.getElementById('cm-root')?.dataset.activeScreen === s, id, { timeout: 30000 });
const menuEntry = async (page, menu, entry) => {
  await page.click(`button.cm-toolbar__cell[data-menu-id="${menu}"]`);
  const target = page.locator(`.cm-toolbar__menu[data-menu-id="${menu}"] [data-entry-id="${entry}"]`);
  await target.scrollIntoViewIfNeeded();
  await target.click();
};
const exitPage = async page => {
  const back = page.locator('.cm-vs2-footer .cm-vs2-action:not(.cm-vs2-action--primary), .cm-screen-footer .cm-screen-back, .cm-vs5-exit').first();
  await back.click();
  await waitScreen(page, 'RAISING_HOME');
};
const SCREENS = [
  ['ranch', async () => {}, async () => {}],
  ['menu-system', async page => { await page.click('button.cm-toolbar__cell[data-menu-id="SYSTEM"]'); }, async page => { await page.click('button.cm-toolbar__cell[data-menu-id="SYSTEM"]', { force: true }); }],
  ['shop', async page => { await page.click(quick('shop')); await waitScreen(page, 'SHOP'); }, exitPage],
  ['dex', async page => { await page.click(quick('database')); await waitScreen(page, 'DATABASE'); }, exitPage],
  ['battle-select', async page => { await page.click(quick('battle')); await waitScreen(page, 'BATTLE_SELECT'); }, exitPage],
  ['hunt-gates', async page => { await page.click(quick('hunt')); await waitScreen(page, 'GATE_SELECT'); }, exitPage],
  ['roster', async page => { await menuEntry(page, 'MANAGEMENT', 'digimon'); await waitScreen(page, 'DIGIMON_LIST'); }, exitPage],
  ['tamer', async page => { await menuEntry(page, 'MANAGEMENT', 'tamer'); await waitScreen(page, 'TAMER_INFO'); }, exitPage],
  ['schedule', async page => { await menuEntry(page, 'MANAGEMENT', 'schedule'); await waitScreen(page, 'SCHEDULE'); }, exitPage],
  ['help', async page => { await menuEntry(page, 'SYSTEM', 'help'); await waitScreen(page, 'HELP'); }, exitPage]
];

/** In-page: every visible text run with its font size, plus clipped / overflowing labels. */
function measureText() {
  const seen = [];
  const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  const visible = el => {
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility !== 'visible' || Number(cs.opacity) < 0.05) return false;
    }
    const r = el.getBoundingClientRect();
    return r.width > 1 && r.height > 1 && r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;
  };
  const key = el => {
    const parts = [];
    for (let n = el; n && n.nodeType === 1 && parts.length < 4; n = n.parentElement) parts.unshift(`${n.tagName.toLowerCase()}${typeof n.className === 'string' && n.className ? '.' + n.className.trim().split(/\s+/)[0] : ''}`);
    return parts.join('>');
  };
  const clipped = [];
  for (let node = walker.nextNode(); node; node = walker.nextNode()) {
    const text = node.nodeValue.replace(/\s+/g, ' ').trim();
    const el = node.parentElement;
    if (!text || !el || !visible(el)) continue;
    const cs = getComputedStyle(el);
    seen.push({ key: key(el), text: text.slice(0, 16), size: parseFloat(cs.fontSize) });
    // A label that no longer fits its own box.
    if ((el.scrollWidth > el.clientWidth + 1 && /hidden|clip/.test(cs.overflowX)) || (el.scrollHeight > el.clientHeight + 2 && /hidden|clip/.test(cs.overflowY) && el.clientHeight > 0))
      clipped.push({ key: key(el), text: text.slice(0, 16), box: [el.clientWidth, el.clientHeight], need: [el.scrollWidth, el.scrollHeight] });
  }
  // Buttons whose content sticks out of the button.
  const spill = [];
  for (const button of document.querySelectorAll('button, [role="button"], .cm-vs2-action')) {
    if (!visible(button)) continue;
    const b = button.getBoundingClientRect();
    for (const child of button.querySelectorAll('*')) {
      if (!child.firstChild || child.firstChild.nodeType !== 3 || !visible(child)) continue;
      const r = child.getBoundingClientRect();
      if (r.left < b.left - 2 || r.right > b.right + 2 || r.top < b.top - 2 || r.bottom > b.bottom + 2) { spill.push({ key: key(child), text: child.textContent.trim().slice(0, 16) }); break; }
    }
  }
  return { texts: seen, clipped, spill, pageOverflowX: document.documentElement.scrollWidth - innerWidth, hints: document.querySelectorAll('.int-rh2-hint, .cm-toolbar__entry-hint, .cm-screen-lede, .cm-vs2-subtitle').length };
}

/** In-page: what the renderers are doing right now. */
function measureQuality() {
  const canvases = [...document.querySelectorAll('canvas')].filter(c => c.getClientRects().length && c.clientWidth > 40).map(c => ({
    kind: c.className || c.id || [...c.attributes].map(a => a.name).filter(n => n.startsWith('data-')).join(',') || 'canvas',
    css: [c.clientWidth, c.clientHeight], backing: [c.width, c.height], ratio: Math.round(c.width / Math.max(1, c.clientWidth) * 100) / 100,
    antialias: (() => { try { const gl = c.getContext('webgl2') || c.getContext('webgl'); return gl ? gl.getContextAttributes()?.antialias ?? null : null; } catch { return null; } })()
  }));
  const cs = getComputedStyle(document.documentElement);
  return { tier: document.documentElement.dataset.quality, canvases, blur: cs.getPropertyValue('--blur-glass').trim(), backdrop: cs.getPropertyValue('--backdrop-glass').trim(),
    shadowCard: cs.getPropertyValue('--shadow-card').trim().slice(0, 40), particles: document.querySelectorAll('.cm-ambience__particles').length ? getComputedStyle(document.querySelector('.cm-ambience__particles')).display : 'absent' };
}

async function setPreference(page, category, name, value) {
  await page.click('button.cm-toolbar__cell[data-menu-id="SYSTEM"]');
  const entry = page.locator('.cm-toolbar__menu[data-menu-id="SYSTEM"] [data-entry-id="settings"]');
  await entry.scrollIntoViewIfNeeded();
  await entry.click();
  await page.locator('dialog.cm-settings[open]').waitFor({ state: 'visible' });
  const key = page.locator(`.cm-settings__nav [data-category="${category}"]`);
  if (!(await key.isVisible().catch(() => false))) await page.locator('.cm-settings__back').first().click().catch(() => {});
  await key.click();
  const radio = page.locator(`input[name="cm-setting-${name}"][value="${value}"]`);
  await radio.scrollIntoViewIfNeeded();
  await radio.check({ force: true });
  await page.waitForTimeout(350);
  const panel = await page.evaluate(measureText);
  await page.locator('.cm-settings__close').first().click();
  await page.waitForFunction(() => !document.querySelector('dialog[open]'));
  await page.waitForTimeout(400);
  return panel;
}

async function boot(browser, viewport) {
  const context = await browser.newContext({ viewport: { width: viewport.width, height: viewport.height }, deviceScaleFactor: viewport.phone ? 3 : 1, isMobile: viewport.phone, hasTouch: viewport.phone, locale: 'zh-TW' });
  const page = await context.newPage();
  page.setDefaultTimeout(20000);
  await page.goto(`${origin}/qa/championship-full-qa-save.json`);
  await page.evaluate(async key => { localStorage.clear(); localStorage.setItem(key, (await (await fetch('/qa/championship-full-qa-save.json', { cache: 'no-store' })).text()).trim()); }, SAVE_KEY);
  await page.goto(`${origin}/championship.html`, { waitUntil: 'networkidle' });
  await opening.login(page);
  await page.click('#cm-continue');
  await page.waitForFunction(() => document.getElementById('cm-root')?.dataset.activeScreen === 'RAISING_HOME' && ['ready', 'error'].includes(document.querySelector('.int-rh2-field-host')?.dataset.loadState), null, { timeout: 90000 });
  await page.waitForTimeout(1200);
  return { context, page };
}

async function sweep(page, viewport, label) {
  const result = {};
  for (const [name, open, close] of SCREENS) {
    try {
      await open(page);
      await page.waitForTimeout(900);
      result[name] = await page.evaluate(measureText);
      fs.mkdirSync(path.join(out, viewport.id), { recursive: true });
      await page.screenshot({ path: path.join(out, viewport.id, `${label}-${name}.jpg`), type: 'jpeg', quality: 70 });
      await close(page);
      await page.waitForTimeout(500);
    } catch (error) {
      result[name] = { error: String(error.message ?? error).split('\n')[0] };
      await page.keyboard.press('Escape').catch(() => {});
      if (await page.evaluate(() => document.getElementById('cm-root')?.dataset.activeScreen) !== 'RAISING_HOME') await exitPage(page).catch(() => {});
    }
  }
  return result;
}

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ args: args.gpu ? ['--enable-gpu', '--use-angle=d3d11', '--ignore-gpu-blocklist'] : [] });
  const report = { origin, at: new Date().toISOString(), viewports: {} };
  for (const viewport of VIEWPORTS.filter(v => !only || only.includes(v.id))) {
    console.log(`▶ ${viewport.id} ${viewport.width}×${viewport.height}`);
    const { context, page } = await boot(browser, viewport);
    const entry = report.viewports[viewport.id] = { textScale: {}, hudDensity: {}, quality: {}, settingsPanel: {} };
    try {
      // 1. Text size: 100 → 115 → 130.
      const base = await sweep(page, viewport, 'text100');
      entry.textScale[100] = base;
      for (const scale of [115, 130]) {
        entry.settingsPanel[`text${scale}`] = await setPreference(page, 'appearance', 'textScale', scale);
        entry.textScale[scale] = await sweep(page, viewport, `text${scale}`);
      }
      await setPreference(page, 'appearance', 'textScale', 100);
      // 2. Information density.
      await setPreference(page, 'appearance', 'hudDensity', 'compact');
      entry.hudDensity.compact = await sweep(page, viewport, 'compact');
      await setPreference(page, 'appearance', 'hudDensity', 'standard');
      // 3. Quality tiers: applied live, then after a reload (renderers read some values once).
      for (const tier of ['saver', 'balanced', 'high']) {
        await setPreference(page, 'quality', 'quality', tier);
        const live = await page.evaluate(measureQuality);
        await page.reload({ waitUntil: 'networkidle' });
        await opening.login(page);
        await page.click('#cm-continue');
        await page.waitForFunction(() => document.getElementById('cm-root')?.dataset.activeScreen === 'RAISING_HOME' && ['ready', 'error'].includes(document.querySelector('.int-rh2-field-host')?.dataset.loadState), null, { timeout: 90000 });
        await page.waitForTimeout(2500);
        const reloaded = await page.evaluate(measureQuality);
        await page.screenshot({ path: path.join(out, viewport.id, `quality-${tier}-ranch.png`) });
        entry.quality[tier] = { live, reloaded };
        console.log(`  quality ${tier}: live ${JSON.stringify(live.canvases.map(c => [c.kind.slice(0, 18), c.ratio, c.antialias]))} → reload ${JSON.stringify(reloaded.canvases.map(c => [c.kind.slice(0, 18), c.ratio, c.antialias]))} blur ${reloaded.blur}`);
      }
    } catch (error) {
      entry.error = String(error.stack ?? error);
      console.log(`  ✗ ${entry.error.split('\n')[0]}`);
      await page.screenshot({ path: path.join(out, `${viewport.id}-error.jpg`), type: 'jpeg', quality: 70 }).catch(() => {});
    }
    // Summaries.
    for (const scale of [115, 130]) {
      for (const [name, at] of Object.entries(entry.textScale[scale] ?? {})) {
        const before = entry.textScale[100]?.[name];
        if (!before?.texts || !at?.texts) { console.log(`  text ${scale}% ${name}: ${at?.error ?? before?.error ?? 'missing'}`); continue; }
        const baseSize = new Map();
        for (const t of before.texts) if (!baseSize.has(`${t.key}|${t.text}`)) baseSize.set(`${t.key}|${t.text}`, t.size);
        let grown = 0, same = 0; const stuck = new Map();
        for (const t of at.texts) {
          const was = baseSize.get(`${t.key}|${t.text}`);
          if (was === undefined) continue;
          if (t.size > was * 1.05) grown += 1; else { same += 1; stuck.set(t.key, (stuck.get(t.key) ?? 0) + 1); }
        }
        at.summary = { grown, same, share: Math.round(grown / Math.max(1, grown + same) * 100), stuck: [...stuck.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12) };
        console.log(`  text ${scale}% ${name}: ${at.summary.share}% of text grew (${grown}/${grown + same}); clipped ${at.clipped.length} (was ${before.clipped.length}), spill ${at.spill.length} (was ${before.spill.length}), overflowX ${at.pageOverflowX}`);
      }
    }
    for (const [name, at] of Object.entries(entry.hudDensity.compact ?? {})) {
      const before = entry.textScale[100]?.[name];
      if (at?.texts && before?.texts) console.log(`  compact ${name}: text runs ${before.texts.length} → ${at.texts.length}, hints ${before.hints} → ${at.hints}`);
    }
    await context.close();
  }
  await browser.close();
  fs.writeFileSync(path.join(out, 'report.json'), JSON.stringify(report, null, 1));
  console.log(`report: ${path.join(out, 'report.json')}`);
})();

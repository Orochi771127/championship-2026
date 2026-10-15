// Source/cascade contracts only. Real CSS geometry, hit testing, text zoom,
// safe-area emulation and scene transitions require browser acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read = name => readFileSync(new URL(`../src/championship/app/${name}`, import.meta.url), 'utf8');
const css = read('intRh2Styles.css');
const overlay = css.slice(css.indexOf('/* Raising-only overlay composition:'));
const gate = ':has(#cm-root[data-active-screen="RAISING_HOME"]:not([hidden]))';
const rules = [...overlay.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{}]+)\{([^{}]*)\}/g)]
  .flatMap(([, selectors, body]) => selectors.trim().split(/,\s*(?=body)/).map(selector => ({selector:selector.trim(), body})));
const block = suffix => {
  const found = rules.filter(r => r.selector === `body${gate} ${suffix}`);
  assert.ok(found.length, `missing gated rule: ${suffix}`);
  return found.map(r=>r.body).join('\n');
};

test('every overlay override is visible-Raising gated; full canvas beats shared root and safe-area frame reservations', () => {
  assert.ok(rules.length >= 20);
  assert.ok(rules.every(r => r.selector.startsWith('body') && r.selector.includes(gate)), 'hidden/title/other scenes cannot inherit overlay rules');
  assert.match(block('#cm-root'), /top: 0; bottom: 0;/);
  assert.match(block('.int-rh2-field-frame'), /left: 0; right: 0;/);
  assert.doesNotMatch(overlay, /--cm-screen-(?:height|top|bottom)\s*:|--cm-(?:status-bar|toolbar)-height\s*:/, 'retain measured UI budgets without consuming canvas');
  assert.doesNotMatch(overlay, /!important|z-index:|display:\s*(?:block|flex|grid)/, 'do not override lifecycle visibility or layer owners');
  const shared=read('styles.css');
  assert.match(shared,/body\[data-status-bar="on"\] #cm-root \{ top: var\(--cm-screen-top\); \}/);
  assert.match(shared,/body\[data-toolbar="on"\] #cm-root \{ bottom: var\(--cm-screen-bottom\); \}/);
  // :has() contributes its #cm-root ID, so each overlay beats old attribute-only
  // card/hint selectors; the canvas selector has two IDs vs the shared rule's one.
  assert.ok(rules.every(r=>r.selector.includes('#cm-root')));
});

test('hint is compact, absolute and pointer-transparent; actual controls and menus remain interactive', () => {
  const hint=block('.cm-toolbar[data-mode="1"] .cm-toolbar__tool-hint');
  assert.match(hint,/position: absolute/);assert.match(hint,/width: max-content/);
  assert.match(hint,/max-width: min\(560px, calc\(100% - 12px\)\)/);
  assert.match(hint,/pointer-events: none/);assert.match(hint,/animation: none/);
  for(const selector of ['.cm-status-bar','.cm-toolbar[data-mode="1"]','.cm-toolbar__rail'])assert.match(block(selector),/pointer-events: none/);
  for(const selector of ['.cm-status-bar button','.cm-toolbar button','.cm-toolbar__menu','.cm-toolbar__tool-done'])assert.match(block(selector),/pointer-events: auto/);
  assert.match(block('.cm-toolbar__tool-text'),/white-space: normal; overflow-wrap: anywhere/);
  assert.ok(rules.some(r=>r.selector.startsWith('body[data-desktop-raising]')&&r.selector.endsWith('.cm-toolbar__tool-hint')&&r.body.includes('--cm-raising-card')));
});

test('safe-area is for floating controls, not canvas; short-screen menu is scrollable at every width', () => {
  const dock=block('.cm-toolbar[data-mode="1"]');
  assert.match(dock,/left: calc\(50% \+ \(var\(--safe-left\) - var\(--safe-right\)\) \/ 2\)/);
  assert.match(dock,/bottom: var\(--cm-raising-dock-gap\)/);
  const menu=block('.cm-toolbar[data-mode="1"] .cm-toolbar__menu');
  assert.match(menu,/max-height: max\(44px, calc\(var\(--cm-viewport-height, 100dvh\)/);
  assert.match(menu,/--cm-status-bar-height/);assert.match(menu,/--cm-toolbar-height/);
  assert.match(menu,/--cm-raising-dock-gap/);assert.match(menu,/overflow-y: auto; overscroll-behavior: contain/);
  for(const selector of ['.int-rh2-mail-icon','.int-rh2-notice','.int-rh2-companion','.cm-tutorial-guidance'])assert.match(block(selector),/--cm-raising-dock-gap/);
});

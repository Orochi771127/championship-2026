// Controlled DOM and CSS-value checks for the shop audit fixes. These do not
// claim native Tab order, screen-reader output, or rendered viewport acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createShopView} from '../src/championship/app/vs4Screens.js';
import {createShopRuntime} from '../src/championship/shop/shopRuntime.js';
import {getLocale, setLocale, LOCALES} from '../src/championship/text/locale.js';
import {ControlledEvent, createControlledDocument} from './helpers/controlled-database-dom.mjs';

function shopFixture(t, {locale = 'zh-Hant', bits = 100_000} = {}) {
  const previousDocument = globalThis.document, previousLocale = getLocale();
  const document = createControlledDocument(locale), root = document.createElement('main');
  document.body.append(root);
  globalThis.document = document;
  setLocale(locale);
  // The shared fixture models bubbling only. Capture listeners on this root
  // are run first so the sheet's Escape contract is tested in the right phase.
  const capture = new Map(), add = root.addEventListener.bind(root), remove = root.removeEventListener.bind(root);
  root.addEventListener = (type, listener, options) => {
    if (options === true || options?.capture) {
      if (!capture.has(type)) capture.set(type, new Set());
      capture.get(type).add(listener);
    } else add(type, listener);
  };
  root.removeEventListener = (type, listener, options) => {
    if (options === true || options?.capture) capture.get(type)?.delete(listener);
    else remove(type, listener);
  };
  const runtime = createShopRuntime({bits, allItemsVisible: true});
  const calls = {leave: 0, buy: []};
  const source = {getFrame: () => ({screen: 'SHOP', shop: runtime.getFrame()}), intents: {
    leaveScreen() { calls.leave++; },
    buyShopItem(...args) { calls.buy.push(args); }
  }};
  const view = createShopView({root, source});
  t.after(() => {
    view.dispose();
    setLocale(previousLocale);
    if (previousDocument === undefined) delete globalThis.document;
    else globalThis.document = previousDocument;
  });
  return {document, root, view, source, calls, capture,
    q: selector => root.querySelector(selector),
    key(target, key) {
      const event = new ControlledEvent('keydown', {key, target});
      for (const listener of capture.get('keydown') ?? []) listener(event);
      if (!event.propagationStopped) target.dispatchEvent(event);
      return event;
    }
  };
}

for (const locale of LOCALES) test(`shop detail has the current product's accessible name in ${locale}`, t => {
  const f = shopFixture(t, {locale});
  f.q('.cm-vs2-shop__row').click();
  const detail = f.q('.cm-vs2-shop__detail'), heading = f.q('.cm-vs2-shop__detail-name');
  assert.equal(detail.getAttribute('role'), 'dialog');
  assert.notEqual(detail.getAttribute('aria-modal'), 'true', 'the header and footer remain available');
  assert.ok(heading.textContent.trim());
  assert.ok(f.document.getElementById(detail.getAttribute('aria-labelledby')) === heading, 'the visible heading names the detail');
  const firstName = heading.textContent;
  f.q('.cm-vs2-shop__close').click();
  f.root.querySelectorAll('.cm-vs2-shop__row')[1].click();
  assert.notEqual(heading.textContent, firstName);
  assert.equal(f.document.getElementById(detail.getAttribute('aria-labelledby')).textContent, heading.textContent);
});

test('shop detail preserves visible focus, nonmodal navigation, and Escape before screen back', t => {
  const f = shopFixture(t);
  f.q('.cm-vs2-shop__row').click();
  const buy = f.q('.cm-vs2-shop__buy'), sheet = f.q('.cm-vs2-shop__sheet');
  assert.ok(f.document.activeElement === buy, 'the visible Buy action receives focus');
  buy.click();
  assert.deepEqual(f.calls.buy, [[f.view.inspect().selectedShopRecordIndex, 1]], 'purchase intent stays unchanged');
  // Purchases repaint the list; closing must focus its current card, not a
  // removed opener. This exercises the presenter's real repaint path.
  const oldCard = f.q('[data-selected="true"]');
  f.view.render(f.source.getFrame());
  assert.equal(oldCard.isConnected, false);
  const escape = f.key(buy, 'Escape');
  assert.equal(escape.defaultPrevented, true);
  assert.equal(sheet.hidden, true);
  assert.equal(f.calls.leave, 0);
  assert.ok(f.document.activeElement === f.q('[data-selected="true"]'), 'closing returns focus to the live selected card');
  f.key(f.document.activeElement, 'Escape');
  assert.equal(f.calls.leave, 1);

  f.q('.cm-vs2-shop__row').click();
  assert.equal(f.key(buy, 'Tab').defaultPrevented, false, 'nonmodal sheet does not trap Tab');
  const back = f.q('.cm-vs2-footer').querySelector('button');
  for (let node = back; node; node = node.parentElement) {
    assert.equal(Boolean(node.inert), false);
    assert.equal(node.hidden, false);
  }
  back.focus();
  assert.ok(f.document.activeElement === back, 'background navigation can receive focus');
  assert.equal(sheet.hidden, false);
  back.click();
  assert.equal(f.calls.leave, 2);
  f.view.dispose();
  assert.equal(f.capture.get('keydown').size, 0);
});

test('an unaffordable product focuses the visible close action', t => {
  const f = shopFixture(t, {bits: 0});
  f.q('.cm-vs2-shop__row').click();
  assert.equal(f.q('.cm-vs2-shop__buy').disabled, true);
  assert.ok(f.document.activeElement === f.q('.cm-vs2-shop__close'), 'Close receives focus when Buy is disabled');
});

test('a hunt family never sends initial focus to its hidden shared Buy button', t => {
  const f = shopFixture(t);
  f.q('[data-category="HUNT_ITEMS"]').click();
  f.q('.cm-shop-family').click();
  const buy = f.q('.cm-vs2-shop__buy');
  assert.equal(buy.hidden, true);
  assert.equal(buy.disabled, false, 'exercise the hidden-but-enabled branch');
  assert.ok(f.document.activeElement === f.q('.cm-vs2-shop__close'), 'Close receives focus when Buy is hidden');
});

// Resolve the relevant authored declarations and palette values numerically.
// This is deliberately not a browser cascade/layout implementation: the browser
// gate must still check every loaded sheet, clipping, and the final painted UI.
function cssRules(source, media = []) {
  const css = source.replace(/\/\*[\s\S]*?\*\//g, ''), result = [];
  let offset = 0;
  while (offset < css.length) {
    const open = css.indexOf('{', offset);
    if (open < 0) break;
    let end = open + 1, depth = 1;
    while (depth && end < css.length) {
      if (css[end] === '{') depth++;
      else if (css[end] === '}') depth--;
      end++;
    }
    const selector = css.slice(offset, open).trim(), body = css.slice(open + 1, end - 1);
    if (selector.startsWith('@media')) result.push(...cssRules(body, [...media, selector.slice(6).trim()]));
    else if (!selector.startsWith('@')) {
      const values = {};
      for (const declaration of body.split(';')) {
        const colon = declaration.indexOf(':');
        if (colon > 0) values[declaration.slice(0, colon).trim()] = declaration.slice(colon + 1).trim();
      }
      result.push({selector, media, values});
    }
    offset = end;
  }
  return result;
}
const tokenRules = cssRules(readFileSync(new URL('../src/championship/app/ui/tokens.css', import.meta.url), 'utf8'));
const layoutRules = cssRules(readFileSync(new URL('../src/championship/app/ui/screenLayout.css', import.meta.url), 'utf8'));
const themes = ['night', 'arcade', 'arena', 'clear', 'warm', 'classic'];
function variables(theme, scale) {
  return Object.assign({}, ...tokenRules.filter(rule => !rule.media.length && rule.selector.split(',').some(selector =>
    [':root', `:root[data-theme="${theme}"]`, `:root[data-text-scale="${scale}"]`].includes(selector.trim())
  )).map(rule => rule.values));
}
function resolve(value, vars) {
  assert.equal(typeof value, 'string');
  for (let i = 0; i < 10 && value.includes('var('); i++) {
    value = value.replace(/var\((--[\w-]+)(?:,\s*([^()]*))?\)/g, (_, name, fallback) => {
      assert.ok(vars[name] ?? fallback, `missing ${name}`);
      return vars[name] ?? fallback;
    });
  }
  assert.equal(value.includes('var('), false, 'all referenced tokens resolve');
  return value;
}
function mediaMatches(condition, {width, height}) {
  return condition.split(/\s+and\s+/).every(part => {
    const dimension = /^\((min|max)-(width|height):\s*(\d+)px\)$/.exec(part);
    if (dimension) {
      const actual = dimension[2] === 'width' ? width : height, bound = Number(dimension[3]);
      return dimension[1] === 'max' ? actual <= bound : actual >= bound;
    }
    if (part === '(orientation: landscape)') return width > height;
    throw new Error(`Unsupported shop media condition: ${part}`);
  });
}
function effectStyle({theme, selected = false, width = 390, height = 844, child = false}) {
  const target = child ? '.cm-vs2-shop__effect > span' : '.cm-vs2-shop__effect';
  return Object.assign({}, ...layoutRules.filter(rule => rule.selector.split(',').some(part => {
      const selector = part.trim();
      return selector.endsWith(target) && (!selector.includes('data-theme=') || selector.includes(`data-theme="${theme}"`)) &&
        (!selector.includes('aria-selected="true"') || selected);
    }) && rule.media.every(condition => mediaMatches(condition, {width, height}))).map(rule => rule.values));
}
function rgba(value) {
  if (/^#[\da-f]{3}$/i.test(value)) value = '#' + [...value.slice(1)].map(c => c + c).join('');
  if (/^#[\da-f]{6}$/i.test(value)) return [1, 3, 5].map(i => parseInt(value.slice(i, i + 2), 16)).concat(1);
  const match = /^rgba?\(([^)]+)\)$/.exec(value);
  assert.ok(match, `unsupported color ${value}`);
  const channels = match[1].split(',').map(Number);
  return channels.length === 3 ? [...channels, 1] : channels;
}
const composite = (foreground, background) => foreground.slice(0, 3).map((channel, i) =>
  channel * foreground[3] + background[i] * (1 - foreground[3])).concat(1);
function contrast(a, b) {
  const luminance = color => color.slice(0, 3).map(c => c / 255).map(c => c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4)
    .reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0);
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + .05) / (dark + .05);
}

test('shop effect text clears 4.5:1 on each palette, including tinted selected-card backgrounds', () => {
  for (const theme of themes) for (const selected of [false, true]) {
    const vars = variables(theme, 100), style = effectStyle({theme, selected});
    const text = rgba(resolve(style.color, vars)), fill = rgba(resolve(style.background, vars));
    // Selected rows are translucent; cover both the ground and raised surfaces
    // they can sit on rather than treating the tint as an opaque RGB value.
    for (const surface of ['--c-ground', '--c-surface-1', '--c-surface-2']) {
      const base = rgba(resolve(vars[surface], vars));
      const card = selected ? composite(rgba(resolve(vars['--c-accent-soft'], vars)), base) : rgba(vars['--c-surface-1']);
      const background = composite(fill, card), ratio = contrast(text, background);
      assert.ok(ratio >= 4.5, `${theme}/${selected ? 'selected' : 'unselected'}/${surface}: ${ratio.toFixed(2)}:1`);
    }
  }
});

test('shop effect follows 100/115/130 reading sizes in portrait, short landscape, and desktop rules', () => {
  const pixels = value => {
    const match = /^(\d+(?:\.\d+)?)px(?:\s*\*\s*(\d+(?:\.\d+)?))?$/.exec(value.replace(/^calc\((.*)\)$/, '$1').trim());
    assert.ok(match, `unsupported resolved font size ${value}`);
    return Number(match[1]) * Number(match[2] ?? 1);
  };
  for (const theme of themes) for (const [width, height] of [[390, 844], [844, 390], [1366, 768]]) {
    const style = effectStyle({theme, width, height});
    const sizes = [100, 115, 130].map(scale => pixels(resolve(style['font-size'], variables(theme, scale))));
    for (const [i, multiplier] of [1, 1.15, 1.3].entries()) {
      assert.ok(Math.abs(sizes[i] / sizes[0] - multiplier) < .0001, `${theme}/${width}x${height}: ${sizes}`);
    }
    const child = effectStyle({theme, width, height, child: true});
    assert.notEqual(child['white-space'], 'nowrap', 'larger/translated effect segments may wrap');
    assert.ok(['anywhere', 'break-word'].includes(child['overflow-wrap']), 'a long segment has an emergency break');
  }
});

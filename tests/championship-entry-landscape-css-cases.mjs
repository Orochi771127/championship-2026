// Source-level layout contracts only. Browser geometry, native touch, software
// keyboards and visual acceptance must still be checked on the integrated build.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const root = new URL('../', import.meta.url);
const opening = fs.readFileSync(new URL('src/championship/app/opening.css', root), 'utf8');
const shared = fs.readFileSync(new URL('src/championship/app/styles.css', root), 'utf8');
const escape = value => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
function block(source, selector) {
  const match = new RegExp(`${escape(selector)}\\s*\\{`).exec(source);
  assert.ok(match, `Missing CSS block: ${selector}`);
  const start = match.index + match[0].length;
  let depth = 1, end = start;
  for (; end < source.length && depth; end += 1) {
    if (source[end] === '{') depth += 1;
    if (source[end] === '}') depth -= 1;
  }
  assert.equal(depth, 0, `Unclosed CSS block: ${selector}`);
  return source.slice(start, end - 1);
}
function property(source, name, expected) {
  const match = new RegExp(`(?:^|;)\\s*${escape(name)}\\s*:\\s*([^;]+)`).exec(source);
  assert.ok(match, `Missing CSS property: ${name}`);
  assert.equal(match[1].trim().replace(/\s+/g, ' '), expected);
}

test('opening uses a shrinkable track and bounded independently scrollable cards', () => {
  property(block(opening, '#cm-opening'), 'grid-template-rows', 'minmax(0, 1fr)');
  const cards = block(opening, '.cm-opening__letter,\n.cm-opening__name,\n.cm-opening__egg-choice');
  for (const [name, value] of [['min-height', '0'], ['max-height', '100%'], ['overflow-y', 'auto'], ['overscroll-behavior', 'contain']]) property(cards, name, value);
  assert.match(opening, /\.cm-opening__egg-choice \{ width:min\(100%,380px\); max-height:100%; overflow:auto;/);
  property(block(opening, '.cm-opening__name input'), 'min-height', '56px');
});

test('existing title art bounds, device-size controls and horizontal actions remain', () => {
  property(block(opening, 'body[data-portrait-frame] #cm-title'), 'transform', 'translate(-50%,-50%) scale(calc(1 / var(--cm-frame-scale)))');
  property(block(opening, 'body[data-portrait-frame] #cm-title .cm-title__panel'), 'width', '390px');
  property(block(opening, 'body[data-portrait-frame] #cm-title .cm-title__controls'), 'width', '100%');
  property(block(opening, 'body[data-portrait-frame] #cm-title .cm-title__actions'), 'grid-template-columns', 'repeat(2,minmax(0,1fr))');
  property(block(opening, '#cm-title .cm-title__settings'), 'min-height', '44px');
  // The unbrowsed film/story reflow stays deferred; retain the released composition.
  property(block(opening, 'body[data-portrait-frame] #cm-title .cm-title__film'), 'width', '390px');
  property(block(opening, '#cm-title .cm-title__film-video'), 'object-fit', 'cover');
  property(block(opening, '.cm-opening-story__card'), 'height', '50%');
  property(block(opening, '.cm-opening-story__card'), 'pointer-events', 'none');
  assert.doesNotMatch(opening, /@media \(orientation: landscape\) and \(max-height: 600px\)/);
});

test('all ordinary confirmations scroll within the viewport-height budget, retaining actions and expansion override', () => {
  const dialog = block(shared, 'dialog.cm-dialog');
  property(dialog, 'max-height', 'calc(100dvh - 32px)');
  property(dialog, 'overflow-y', 'auto');
  property(dialog, 'overscroll-behavior', 'contain');
  property(block(shared, '.cm-dialog__action'), 'min-height', 'var(--control)');
  property(block(shared, '.cm-dialog__actions[data-count="3"]'), 'grid-template-columns', 'minmax(0, 1fr)');
  property(block(shared, 'dialog.cm-dialog[data-variant="expansion"] .cm-dialog__panel'), 'overflow-y', 'auto');
});

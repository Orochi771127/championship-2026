// Owner 2026-11-18: 「搖桿可以做得比較時尚直接一點不要那麼多花紋」. The Data Arena sticks are one thin ring and
// one flat thumb: no spokes, no inner rings, no gradients.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';

const css = readFileSync(new URL('../src/championship/app/dataArena.css', import.meta.url), 'utf8');
const lastRule = selector => {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const all = [...css.matchAll(new RegExp(`(?:^|\\n)${escaped} \\{([^}]*)\\}`, 'g'))];
  assert.ok(all.length > 0, selector);
  return all[all.length - 1][1];
};

test('the movement hint, the stick and its thumb carry no pattern', () => {
  for (const selector of ['.da-root[data-mode="RELAY"] .da-move-hint', '.da-stick', '.da-stick__knob', '.da-stick--aim .da-stick__knob']) {
    const body = lastRule(selector);
    assert.doesNotMatch(body, /gradient/, `${selector} is a flat fill`);
    assert.doesNotMatch(body, /dashed/, selector);
  }
  assert.match(lastRule('.da-stick'), /border:1\.5px solid/);
  assert.match(lastRule('.da-stick__knob'), /border:0;/);
});

test('the stick keeps its size and place: only the look changed', () => {
  assert.match(css, /\.da-stick \{ position: absolute; left: 0; top: 0; width: 112px; height: 112px; border-radius: 50%;/);
  assert.match(css, /\.da-root\[data-mode="RELAY"\] \.da-move-hint \{ display:grid; place-items:center; position:absolute;[^}]*width:104px; height:104px;/);
});

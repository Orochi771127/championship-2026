// Partners outside the Database are drawn as their own action animation
// (Owner 2026-11-12: 「圖鑑插畫就請讓他出現在圖鑑就好 ... 其他都可以用成角色的動作動畫」).
import assert from 'node:assert/strict';
import test from 'node:test';

import {ACTION_PORTRAIT_SEQUENCES, actionPortraitFit, createActionPortrait, setActionPortrait, clearActionPortrait}
  from '../src/championship/presentation/juicy/actionPortrait.js';

function fakeDocument() {
  const make = tag => {
    const node = {tagName: tag, className: '', children: [], dataset: {}, parentNode: null, attributes: {},
      style: {props: {}, setProperty(k, v) { this.props[k] = v; }},
      setAttribute(k, v) { this.attributes[k] = String(v); },
      append(...kids) { for (const kid of kids) { kid.parentNode = this; this.children.push(kid); } },
      replaceChildren(...kids) { for (const kid of this.children) kid.parentNode = null; this.children = []; this.append(...kids); },
      remove() { if (this.parentNode) { this.parentNode.children = this.parentNode.children.filter(c => c !== this); this.parentNode = null; } },
      get ownerDocument() { return doc; }};
    return node;
  };
  const doc = {createElement: make};
  return doc;
}

test('the sequences are the audited showcase ones: idle, walk, attack, cheer', () => {
  assert.deepEqual({...ACTION_PORTRAIT_SEQUENCES}, {idle: 0, walk: 2, attack: 7, cheer: 33});
});

test('a body fits its box standing on the floor, and a close-up keeps the head under the top edge', () => {
  const motion = {density: 4, bounds: {left: -40, right: 40, top: -160, bottom: 0}};
  const whole = actionPortraitFit(motion, {width: 80, height: 80});
  assert.ok(whole.scale > 0);
  assert.ok(-motion.bounds.top * whole.scale <= 80 * 0.94 + 1e-6, 'the whole body fits above the floor');
  assert.equal(whole.footY, 80 * 0.06);
  const close = actionPortraitFit(motion, {width: 80, height: 80, crop: 1.9});
  assert.ok(close.scale > whole.scale, 'a close-up is bigger');
  const headTop = 80 - close.footY - (-motion.bounds.top) * close.scale; // distance from the top edge
  assert.ok(Math.abs(headTop - 80 * 0.04) < 1e-6, `head ${headTop} px under the top edge`);
  assert.ok(close.footY < 0, 'the feet fall below the box');
});

test('a species with no motion here leaves the box empty, never an illustration', async () => {
  const doc = fakeDocument();
  const portrait = createActionPortrait({doc, species: 'species-054', baseUrl: 'https://example.invalid/'});
  assert.equal(portrait.element.dataset.state, 'none');
  assert.equal(await portrait.ready, false);
  assert.equal(portrait.element.children.length, 0);
  assert.equal(portrait.speciesId, 'species-054');
  assert.equal(createActionPortrait({doc, species: 'championship:creature:species-012', baseUrl: 'https://example.invalid/'}).speciesId, 'species-012');
  assert.equal(createActionPortrait({doc, species: 21, baseUrl: 'https://example.invalid/'}).speciesId, 'species-021');
});

test('one portrait per slot: the same species keeps the running one, another replaces it, none clears it', () => {
  const doc = fakeDocument(), slot = doc.createElement('span');
  const first = setActionPortrait(slot, 'species-054', {baseUrl: 'https://example.invalid/'});
  assert.equal(slot.children[0], first.element);
  assert.equal(setActionPortrait(slot, 'championship:creature:species-054', {baseUrl: 'https://example.invalid/'}), first, 'kept');
  const second = setActionPortrait(slot, 'species-021', {baseUrl: 'https://example.invalid/'});
  assert.notEqual(second, first);
  assert.deepEqual(slot.children, [second.element]);
  assert.equal(setActionPortrait(slot, null), null);
  assert.equal(slot.dataset.portrait, 'none');
  clearActionPortrait(slot);
});

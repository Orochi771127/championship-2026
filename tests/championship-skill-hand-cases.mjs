// ROADMAP_R4_20261118 (Owner 2026-11-18: 「做成一個技能卡片三張手牌在手中的樣子，然後玩家可以把它往上提以後丟出去的樣子」):
// the hand on the battle screen. A fake document drives it here; the real drag and throw are checked in a browser.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {mountBattleSkillHand, SKILL_CARD_THROW_PX, SKILL_CARD_ART_BASE} from '../src/championship/app/battleSkillHand.js';

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

class Node {
  constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.listeners = {}; this.style = {props: {}, setProperty(k, v) { this.props[k] = v; }, removeProperty(k) { delete this.props[k]; }}; this.textContent = ''; this.hidden = false; this.parent = null; }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] ?? null; }
  addEventListener(type, run) { this.listeners[type] = run; }
  querySelector(selector) { const cls = selector.slice(1); return this.all().find(node => (node.className ?? '').split(' ').includes(cls)) ?? null; }
  all() { return this.children.flatMap(child => [child, ...child.all()]); }
}
const doc = {createElement: tag => new Node(tag), defaultView: null};

function harness(states) {
  let view = {on: true, frame: 0, nextFrame: 180, allowed: 0, used: 0, cards: states.map(([id, state]) => ({id, line: id.split('.')[0], kind: 'X', state}))};
  const plays = [];
  const host = new Node('main');
  // as the runtime does: an accepted card reads PLAYED from then on
  const accept = id => { view = {...view, used: view.used + 1, cards: view.cards.map(card => (card.id === id ? {...card, state: 'PLAYED'} : card))}; return {ok: true, id}; };
  const hand = mountBattleSkillHand({host, doc, snapshot: () => view, play: id => { plays.push(id); return id === 'basic.cheer' ? accept(id) : {ok: false, reason: 'NOT_READY'}; },
    subscribe: () => () => {}});
  const cards = () => hand.element.all().filter(node => node.className === 'cm-skill-card');
  return {hand, host, cards, plays, set(next) { view = {...view, ...next}; hand.render(true); }};
}

test('three cards in the hand, each drawn with its line, its art and its name; the effect only when lifted', () => {
  const {hand, host, cards} = harness([['basic.cheer', 'WAIT'], ['hunter.snare', 'WAIT'], ['trader.bounty', 'WAIT']]);
  assert.equal(host.children[0], hand.element);
  assert.deepEqual(cards().map(card => [card.dataset.card, card.dataset.line, card.dataset.state]),
    [['basic.cheer', 'basic', 'WAIT'], ['hunter.snare', 'hunter', 'WAIT'], ['trader.bounty', 'trader', 'WAIT']]);
  assert.deepEqual(cards().map(card => card.style.props['--fan']), ['-1', '0', '1'], 'fanned around the middle');
  const art = cards()[0].all().find(node => node.tagName === 'img');
  assert.equal(art.src, `${SKILL_CARD_ART_BASE}basic.cheer_128.webp`);
  assert.equal(cards()[0].querySelector('.cm-skill-card__wait').textContent, '3 秒');
  assert.match(cards()[0].attributes['aria-label'], /^加油聲援，全隊 TP \+20%，3 秒$/);
  assert.equal(cards()[0].attributes['aria-disabled'], 'true');
});

test('a tap lifts a ready card, a second tap throws it; a waiting card refuses and says so', () => {
  const h = harness([['basic.cheer', 'READY'], ['hunter.snare', 'READY']]);
  h.set({frame: 200, allowed: 1, nextFrame: 180});
  const cheer = () => h.cards().find(card => card.dataset.card === 'basic.cheer');
  cheer().listeners.click();
  assert.equal(cheer().dataset.lifted, 'true');
  assert.deepEqual(h.plays, []);
  const thrown = cheer();
  thrown.listeners.click();
  assert.deepEqual(h.plays, ['basic.cheer']);
  assert.equal(thrown.dataset.state, 'THROWN');
  assert.equal(cheer(), undefined, 'gone from the hand (here at once: this document has no running animation to wait for)');
  assert.equal(h.hand.element.querySelector('.cm-skill-hand__toast').textContent, '加油聲援！');
  // a refusal shakes and names why
  const snare = h.cards().find(card => card.dataset.card === 'hunter.snare');
  snare.listeners.click(); snare.listeners.click();
  assert.deepEqual(h.plays, ['basic.cheer', 'hunter.snare']);
  assert.equal(snare.dataset.shake, 'true');
  assert.equal(h.hand.element.querySelector('.cm-skill-hand__toast').textContent, '還沒好');
});

test('a drag up past the line throws; a short drag does not, and its release is not a tap', () => {
  const h = harness([['basic.cheer', 'READY']]);
  h.set({frame: 200, allowed: 1});
  const card = h.cards()[0];
  card.listeners.pointerdown({clientY: 800, pointerId: 1});
  card.listeners.pointermove({clientY: 780});
  assert.equal(card.dataset.armed, 'false');
  card.listeners.pointerup(); card.listeners.click();
  assert.deepEqual(h.plays, [], 'a short drag throws nothing');
  card.listeners.pointerdown({clientY: 800, pointerId: 1});
  card.listeners.pointermove({clientY: 800 - SKILL_CARD_THROW_PX - 4});
  assert.equal(card.dataset.armed, 'true');
  card.listeners.pointerup(); card.listeners.click();
  assert.deepEqual(h.plays, ['basic.cheer']);
  assert.equal(SKILL_CARD_THROW_PX, 56);
});

test('no hand, an ended battle or a disposed screen shows nothing', () => {
  assert.equal(mountBattleSkillHand({host: new Node('main'), doc, snapshot: () => null, play: () => ({ok: false})}), null);
  assert.equal(mountBattleSkillHand({host: new Node('main'), doc, snapshot: () => ({on: false, cards: []}), play: () => ({ok: false})}), null);
  let view = {on: true, frame: 0, nextFrame: 180, allowed: 0, used: 0, cards: [{id: 'basic.cheer', line: 'basic', kind: 'X', state: 'WAIT'}]};
  const host = new Node('main');
  const hand = mountBattleSkillHand({host, doc, snapshot: () => view, play: () => ({ok: false}), subscribe: () => () => {}});
  view = null; hand.render(true);
  assert.equal(hand.element.hidden, true);
  hand.dispose();
  assert.deepEqual(host.children, []);
});

test('the screen wiring: mounted with the battle, gone with it, one ticker, art and styles in place', () => {
  const main = source('src/championship/app/main.js'), hand = source('src/championship/app/battleSkillHand.js'), css = source('src/championship/app/styles.css');
  assert.match(main, /const skillHand = tutorial \? null : mountBattleSkillHand\(\{ host: root, snapshot: \(\) => activeRuntime\.getSkillCards\?\.\(\) \?\? null,/);
  assert.match(main, /^import \{ mountBattleSkillHand \} from "\.\/battleSkillHand\.js";$/m);
  assert.match(main, /dispose\(\)\{if\(viewDisposed\)return;viewDisposed=true;skillHand\?\.dispose\(\);/);
  assert.doesNotMatch(hand, /requestAnimationFrame|<canvas|getContext/);
  assert.match(hand, /globalThis\.setTimeout\?\.\(\(\) => \{ key\.remove\(\); keys\.delete\(card\.id\); \}, 760\);/, 'a thrown card leaves even when its animation never reports');
  for (const rule of ['.cm-skill-card {', '.cm-skill-card[data-lifted="true"] {', '.cm-skill-card[data-armed="true"] {', '.cm-skill-card[data-state="WAIT"] .cm-skill-card__ring { opacity: 1; }',
    'touch-action: none;', ':root[data-motion="reduced"] .cm-skill-card { transition: none; animation: none; }']) assert.ok(css.includes(rule), rule);
  const ready = /@keyframes cm-skill-ready \{[^@]*\}/.exec(css)[0];
  assert.doesNotMatch(ready, /transform/, 'a card the finger is on never moves by itself');
});

test('every card has its face: Codex art recorded with its hash, rights and inputs, and published', async () => {
  const {createHash} = await import('node:crypto');
  const {SKILL_CARD_IDS} = await import('../src/championship/contracts/productTamerSkillCards.js');
  const manifest = JSON.parse(source('assets/production/ui/skill-cards-r1/manifest.json'));
  assert.deepEqual(manifest.files.map(file => file.key), [...SKILL_CARD_IDS]);
  assert.equal(manifest.rightsStatus, 'ORIGINAL_GENERATED');
  assert.match(manifest.provenance, /no ROM frame, research-library file or third-party character was an input/);
  const allow = JSON.parse(source('docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json'));
  for (const file of manifest.files) {
    assert.equal(file.path, `${SKILL_CARD_ART_BASE}${file.key}_128.webp`);
    assert.equal(createHash('sha256').update(readFileSync(new URL(`../${file.path}`, import.meta.url))).digest('hex'), file.sha256, file.path);
    assert.equal(allow.files.find(row => row.path === file.path)?.sha256, file.sha256);
  }
  assert.ok(!allow.files.some(row => /skill-cards-r1\/(manifest\.json|briefs\/)/.test(row.path)));
  const index = JSON.parse(source('assets/production/ART_PRODUCTION_INDEX.json')).entries.find(entry => entry.assetId === 'art:ui:skill-cards:r1');
  assert.deepEqual([index.count, index.rightsStatus, index.runtimeEligible, index.shippingReady], [20, 'ORIGINAL_GENERATED', true, false]);
});

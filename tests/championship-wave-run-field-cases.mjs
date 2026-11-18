// WAVE_RUN_20261118: the wave field over the battle screen, driven by a fake document. A tap picks a drop through the
// one authority (once), a drag never picks, more piles than fit merge without changing value, the challenge's leave
// warns about drops on the ground on the key itself, and the story goes on by itself only when nothing is left.
// The real taps, coordinates and timing are checked in a browser.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {mountWaveRunField, placeWaveDrop, WAVE_DROP_DRAG_PX, WAVE_DROP_EDGE_PX, WAVE_STORY_AUTO_NEXT_MS, WAVE_RUN_ART} from '../src/championship/app/waveRunField.js';
import {createWaveRun, recordWaveResult, collectWaveDrop, markWaveDropsSettled, waveLoot, waveFoes, WAVE_RUN_RULES} from '../src/championship/contracts/productWaveRun.js';
import {WAVE_RUN_COPY} from '../src/championship/text/waveRunText.js';

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

class Node {
  constructor(tag) { this.tagName = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.listeners = {}; this.style = {}; this.hidden = false; this.disabled = false; this.textContent = ''; }
  append(...nodes) { for (const node of nodes) { node.parent = this; this.children.push(node); } }
  replaceChildren(...nodes) { this.children = []; this.append(...nodes); }
  get childElementCount() { return this.children.length; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); this.parent = null; }
  setAttribute(k, v) { this.attributes[k] = String(v); }
  getAttribute(k) { return this.attributes[k] ?? null; }
  addEventListener(type, run) { this.listeners[type] = run; }
  animate() { return {onfinish: null}; }
  getBoundingClientRect() { return {left: 0, top: 0, width: 390, height: 760}; }
  all() { return this.children.flatMap(child => [child, ...child.all()]); }
  querySelectorAll(selector) { return this.all().filter(node => node.tagName === selector); }
  find(cls) { return this.all().find(node => (node.className ?? '').split(' ').includes(cls)) ?? null; }
  findAll(cls) { return this.all().filter(node => (node.className ?? '').split(' ').includes(cls)); }
}
const doc = {createElement: tag => new Node(tag), body: new Node('body')};
function fakeTimers() {
  let now = 0, id = 0; const queue = new Map();
  return {setTimeout(fn, ms) { queue.set(++id, {at: now + ms, fn}); return id; }, clearTimeout(t) { queue.delete(t); },
    run(ms) { now += ms; for (const [key, entry] of [...queue].sort((a, b) => a[1].at - b[1].at)) if (entry.at <= now && queue.has(key)) { queue.delete(key); entry.fn(); } }};
}
const press = (node, {x = 100, y = 100, dx = 0, dy = 0} = {}) => {
  const event = {clientX: x, clientY: y, pointerId: 1, stopPropagation() { this.stopped = true; }, preventDefault() {}};
  node.listeners.pointerdown(event);
  const up = {...event, clientX: x + dx, clientY: y + dy, stopped: false, stopPropagation() { this.stopped = true; }};
  node.listeners.pointerup(up);
  return {down: event, up};
};

/** A wave field over a run held here, collecting through the same rules the app uses. */
function harness(run, {magnet = false} = {}) {
  let state = run; const collected = [], choices = [];
  const frame = () => state ? {run: state, foes: waveFoes(state), next: state.status === 'REST' ? waveFoes(state) : null, picked: waveLoot(state, 'PICKED'),
    settled: waveLoot(state, 'SETTLED'), rules: WAVE_RUN_RULES, magnet, team: [{name: '小紅', ratio: 0.5, down: false}]} : null;
  const collect = id => { collected.push(id); const got = collectWaveDrop(state, id); if (got.ok) state = got.run; return got.ok ? {ok: true} : {ok: false, reason: got.reason}; };
  const host = new Node('main'), timers = fakeTimers();
  const field = mountWaveRunField({host, doc, timers, frame, collect, choose: choice => choices.push(choice), canvasRect: () => ({left: 0, top: 0, width: 390, height: 760}),
    project: stand => ({x: stand.x * 390, y: stand.y * 760, viewport: {width: 390, height: 760}})});
  return {field, host, timers, collected, choices, get run() { return state; }, set run(next) { state = next; }};
}
const foeView = () => ({combatants: [{slot: 0, team: 0, present: true, stand: {x: 0.2, y: 0.7}}, {slot: 3, team: 1, present: true, down: true, stand: {x: 0.8, y: 0.6}}]});

test('a won wave lays its drops where the foe fell; a tap picks once, a drag never picks and never reaches the field', () => {
  const run = recordWaveResult(createWaveRun({mode: 'CHALLENGE', party: ['a'], seed: 4, runId: 'r'}), {attemptId: 'b1', won: true}).run;
  const h = harness(run);
  h.field.settled(foeView());
  const drops = h.field.root.findAll('cm-wave-drop');
  assert.equal(drops.length, run.drops.length);
  const first = drops[0];
  // near the beaten foe's stand (312, 456), inside the reachable band
  const left = parseFloat(first.style.left), top = parseFloat(first.style.top);
  assert.ok(Math.abs(left - 312) <= 50 && Math.abs(top - 456) <= 40, `${left},${top}`);
  const dragged = press(first, {dx: WAVE_DROP_DRAG_PX + 6});
  assert.deepEqual(h.collected, [], 'a drag is not a pick');
  assert.ok(dragged.down.stopped && dragged.up.stopped, 'the press never reaches the field');
  press(first);
  assert.deepEqual(h.collected, [first.dataset.dropId]);
  assert.equal(h.run.drops.find(d => d.id === first.dataset.dropId).state, 'PICKED');
  // the same coin again (a double tap, or the magnet racing the tap) is refused by the authority
  press(first);
  assert.equal(h.collected.length, 2);
  assert.equal(h.run.drops.filter(d => d.state === 'PICKED').length, 1);
});

test('the challenge rest: what was won, who stands, what comes next, and the two keys; leaving with drops on the ground warns on the key', () => {
  const run = recordWaveResult(createWaveRun({mode: 'CHALLENGE', party: ['a'], seed: 4, runId: 'r'}), {attemptId: 'b1', won: true}).run;
  const h = harness(run);
  h.field.settled(foeView());
  const dock = h.field.root.find('cm-wave-run__dock');
  assert.equal(dock.hidden, false);
  assert.ok(dock.find('cm-wave-rest__threat').find('cm-wave-rest__pips'), 'the next threat shows as foe pips');
  assert.equal(dock.findAll('cm-wave-rest__partner').length, 1);
  const leave = dock.find('cm-wave-run__key--leave');
  leave.listeners.click({stopPropagation() {}});
  assert.deepEqual(h.choices, [], 'the first press only warns');
  assert.equal(leave.dataset.armed, 'true');
  assert.match(leave.find('cm-wave-run__key-label').textContent, /還有 \d+ 個沒撿/);
  leave.listeners.click({stopPropagation() {}});
  assert.deepEqual(h.choices, ['LEAVE']);
  // never a timer that goes on by itself in the challenge
  h.timers.run(60000);
  assert.deepEqual(h.choices, ['LEAVE']);
});

test('more piles than the screen shows merge into a heap that picks them all, value unchanged', () => {
  let run = createWaveRun({mode: 'CHALLENGE', party: ['a'], seed: 9, runId: 'm'});
  run = recordWaveResult(run, {attemptId: 'b1', won: true}).run;
  const many = Array.from({length: WAVE_RUN_RULES.dropsShownMax + 5}, (_, i) => ({...run.drops[0], id: `m:0:0:x${i}`, kind: 'BITS', amount: 2}));
  run = {...run, drops: many};
  const h = harness(run);
  h.field.settled(foeView());
  const shown = h.field.root.findAll('cm-wave-drop');
  assert.equal(shown.length, WAVE_RUN_RULES.dropsShownMax);
  const heap = shown.at(-1);
  assert.equal(heap.find('cm-wave-drop__amount').textContent, String(6 * 2), 'the heap shows the sum of what it holds');
  press(heap);
  assert.equal(waveLoot(h.run).bits, 12, 'one tap picks the six piles it holds, no more, no less');
});

test('story: one forward key, no leave; it goes on by itself only once nothing is left; the magnet empties the field', () => {
  const story = recordWaveResult(createWaveRun({mode: 'STORY', party: ['a'], seed: 2, runId: 's', bossPresets: [456]}), {attemptId: 'b1', won: true}).run;
  const h = harness(story);
  h.field.settled(foeView());
  const dock = h.field.root.find('cm-wave-run__dock');
  assert.equal(dock.find('cm-wave-run__key--leave'), null, 'the story never offers to leave');
  assert.ok(dock.find('cm-wave-run__key--next'));
  h.timers.run(WAVE_STORY_AUTO_NEXT_MS * 4);
  assert.deepEqual(h.choices, [], 'drops on the ground hold the story until picked or skipped');
  for (const drop of h.field.root.findAll('cm-wave-drop')) press(drop);
  h.timers.run(WAVE_STORY_AUTO_NEXT_MS + 1);
  assert.deepEqual(h.choices, ['NEXT']);
  // the magnet: every drop picked through the same authority, one by one
  const m = harness(story, {magnet: true});
  m.field.settled(foeView());
  m.timers.run(5000);
  assert.equal(m.run.drops.filter(d => d.state === 'GROUND').length, 0);
  assert.deepEqual(m.collected, story.drops.map(d => d.id));
});

test('edge drops stay reachable; copy is five locales; the art is the registered bundle; the field is wired in the battle screen', () => {
  const corner = placeWaveDrop({x: 0.99, y: 0.99}, {x: 389, y: 759}, {width: 390, height: 760});
  assert.ok(corner.x <= 390 - WAVE_DROP_EDGE_PX && corner.y <= 760 - WAVE_DROP_EDGE_PX - 96);
  const low = placeWaveDrop({x: 0, y: 0}, {x: 0, y: 0}, {width: 360, height: 640});
  assert.ok(low.x >= WAVE_DROP_EDGE_PX && low.y >= WAVE_DROP_EDGE_PX);
  // four piles of one foe never cover each other, wherever it fell
  for (const anchor of [{x: 0, y: 0}, {x: 389, y: 500}, {x: 0, y: 759}, {x: 195, y: 380}]) {
    const piles = [0, 1, 2, 3].map(k => placeWaveDrop({id: `r:0:0:${k}`, x: 0.4, y: 0.6}, anchor, {width: 390, height: 760}));
    for (let i = 0; i < piles.length; i++) for (let j = i + 1; j < piles.length; j++)
      assert.ok(Math.hypot(piles[i].x - piles[j].x, piles[i].y - piles[j].y) >= 52, JSON.stringify(anchor));
  }
  const keys = Object.keys(WAVE_RUN_COPY['zh-Hant']);
  for (const locale of ['en', 'ja', 'th', 'vi']) assert.deepEqual(Object.keys(WAVE_RUN_COPY[locale]), keys);
  assert.ok(Object.values(WAVE_RUN_COPY['zh-Hant']).every(line => line.length <= 24), 'short in-game copy');
  const manifest = JSON.parse(source('assets/production/ui/wave-run-r1/manifest.json'));
  for (const path of Object.values(WAVE_RUN_ART)) assert.ok(manifest.files.some(file => file.path === path), path);
  const main = source('src/championship/app/main.js');
  assert.match(main, /waveField\.settled\(observed\)/);
  assert.match(main, /runBattle: request => runWaveRun\(\{ mode: 'STORY'/);
  assert.match(main, /prepared\.setFoeBoostPercent\?\.\(party\.foeBoostPercent\)/);
  assert.match(source('src/championship/app/journeyScreen.js'), /entries\.push\(\["CHALLENGE", host\.wave\.text\("mode\.challenge"\)\]\)/);
});

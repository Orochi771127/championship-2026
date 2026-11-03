// Battle polish (Owner 2026-11-03): the AI battle camera keeps every standing
// fighter in the safe window between the floating HUD rows, overlapping
// fighters are drawn apart, the hyper ring wraps its caster in depth, the
// record keeps moving after a knockout, and the pre-battle picks have no
// native <select>. Presentation only; no simulation value is read back.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';
import {battleFxFrameShot, battleFxSafeCover, battleFxSafeWindow, clampBattleCameraToMap, createBattleFxCamera}
  from '../src/championship/presentation/battleFx/battleFxCamera.js';
import {BATTLE_FX_JUICY, battleHyperWrapStreaks} from '../src/championship/presentation/battleFx/battleFxLayer.js';
import {battleSeparationOffsets} from '../src/championship/presentation/vs5/createBattleFieldPixiPresentation.js';
import {BATTLE_FEED_HIT_INTERVAL_MS, createBattleFxLookups} from '../src/championship/app/battleFxLookups.js';
import {ELEMENT_GROUND_CELLS} from '../src/championship/presentation/vfx/elementVfxLayer.js';

// A phone held upright: 390 x 750 field, opponent cards over the top 176 px,
// player cards and the record over the bottom 150 px. The arena is 3:2.
const viewport = {width: 390, height: 750};
const insets = {top: 176, bottom: 150};
const art = {x: 0, y: 0, width: 960, height: 640};
const body = (slot, x, groundY, team = slot < 3 ? 0 : 1, extra = {}) =>
  ({slot, team, x, groundY, left: x - 22, right: x + 22, top: groundY - 70, bottom: groundY, down: false, engaged: false, ...extra});
const onScreen = (transform, b) => ({top: transform.y + b.top * transform.zoom, bottom: transform.y + b.bottom * transform.zoom,
  left: transform.x + b.left * transform.zoom, right: transform.x + b.right * transform.zoom});

test('the safe window lies between the HUD rows and the art only has to cover it', () => {
  const safe = battleFxSafeWindow(viewport, insets);
  assert.equal(safe.top, 176);
  assert.equal(safe.height, 750 - 176 - 150);
  assert.ok(Math.abs(safe.centerY / viewport.height - 0.53) < 0.03, 'the shot centre sits a little below the screen middle');
  const full = Math.max(viewport.width / art.width, viewport.height / art.height);
  assert.ok(battleFxSafeCover(viewport, art, insets) < full, 'a HUD-aware shot may pull back past full cover');
  assert.ok(battleFxSafeCover(viewport, art, insets) * art.width >= viewport.width, 'the picture still spans the width');
  // An inset can never take more than 45 % of the field.
  assert.equal(battleFxSafeWindow(viewport, {top: 900, bottom: 0}).top, viewport.height * 0.45);
});

test('fighters at the top edge of the arena are framed below the opponent cards, not under them', () => {
  // Six fighters near the arena's north edge -- the shot that hid them behind the cards.
  const group = [body(0, 380, 92), body(1, 430, 100), body(2, 480, 96), body(3, 410, 84), body(4, 460, 88), body(5, 520, 94)];
  const box = {left: Math.min(...group.map(b => b.left)), right: Math.max(...group.map(b => b.right)),
    top: Math.min(...group.map(b => b.top)), bottom: Math.max(...group.map(b => b.bottom))};
  const shot = battleFxFrameShot({viewport, art, box, boundedMap: true, insets, maxZoomFactor: 1.05});
  const transform = clampBattleCameraToMap({viewport, art, box,
    transform: {zoom: shot.zoom, x: viewport.width / 2 - shot.zoom * shot.cx, y: viewport.height / 2 - shot.zoom * shot.cy}, insets});
  for (const b of group) {
    const at = onScreen(transform, b);
    assert.ok(at.top >= insets.top - 0.5, `slot ${b.slot} top ${at.top} must clear the opponent cards (${insets.top})`);
    assert.ok(at.bottom <= viewport.height - insets.bottom + 0.5, `slot ${b.slot} must clear the player cards`);
  }
  // Without insets the same group sits under the top HUD: the original bug.
  const blind = clampBattleCameraToMap({viewport, art, box, transform: {zoom: Math.max(viewport.width / art.width, viewport.height / art.height), x: 0, y: 0}});
  assert.ok(onScreen(blind, group[3]).top < insets.top, 'the old full-cover shot could not lift them');
});

test('the director keeps every standing fighter in the window through a focus, a hit and a knockout', () => {
  const director = createBattleFxCamera({boundedMap: true, wideCover: true});
  const subjects = [body(0, 200, 300), body(1, 300, 330), body(2, 360, 420), body(3, 520, 360), body(4, 640, 300), body(5, 700, 410)];
  let worst = Infinity;
  const step = (ms, list = subjects) => {
    for (let t = 0; t < ms; t += 16) {
      const transform = director.update({dtMs: 16, viewport, art, subjects: list, insets});
      for (const b of list.filter(s => !s.down)) {
        const at = onScreen(transform, b);
        worst = Math.min(worst, at.top - insets.top, viewport.height - insets.bottom - at.bottom);
      }
    }
  };
  step(600);
  director.sequence([{slots: [0, 3], durationMs: 900, boost: 0.14}]);
  step(900);
  director.impact('medium', 1);
  step(300);
  const downed = subjects.map(s => s.slot === 4 ? {...s, down: true} : s);
  director.sequence([{slots: [4], durationMs: 1200, boost: 0.3, includeDown: true}, {slots: null, durationMs: 900, boost: -0.08}]);
  director.slowMo(BATTLE_FX_JUICY.slowMoMs);
  assert.equal(director.timeScale(), 0.35, 'a knockout slows playback');
  step(1200, downed);
  assert.equal(director.timeScale(), 1, 'and returns to normal speed');
  assert.ok(worst >= -1, `a standing fighter left the safe window by ${-worst}px`);
});

test('a hit pushes the shot in about 8 % with a kick along the blow, then settles', () => {
  const director = createBattleFxCamera({boundedMap: true, wideCover: false});
  const subjects = [body(0, 400, 330), body(3, 480, 330)];
  for (let i = 0; i < 40; i++) director.update({dtMs: 16, viewport, art, subjects, insets});
  assert.equal(director.impact('medium', 1), true);
  const state = director.getState();
  assert.ok(state.punch >= 0.079 && state.punch <= 0.14, `punch ${state.punch}`);
  for (let i = 0; i < 20; i++) director.update({dtMs: 16, viewport, art, subjects, insets});
  assert.ok(director.getState().punch < 0.02, 'the push settles within about 300 ms');
});

test('overlapping fighters are drawn apart sideways, by at most the shift cap, and never moved when apart', () => {
  const pile = [{slot: 0, team: 0, x: 100, y: 200}, {slot: 1, team: 0, x: 101, y: 200}, {slot: 3, team: 1, x: 102, y: 201},
    {slot: 4, team: 1, x: 100, y: 199}, {slot: 2, team: 0, x: 300, y: 260}];
  const offsets = battleSeparationOffsets(pile, 26, 12);
  const drawn = pile.map(p => p.x + offsets.get(p.slot)).slice(0, 4).sort((a, b) => a - b);
  for (let i = 1; i < drawn.length; i++) assert.ok(drawn[i] - drawn[i - 1] > 4, `bodies still stacked: ${drawn.join(', ')}`);
  for (const value of offsets.values()) assert.ok(Math.abs(value) <= 12, 'native sparks must still land on the drawn body');
  assert.equal(offsets.get(2), 0, 'a fighter clear of the pile keeps its own position');
});

test('the hyper ring splits its streaks behind and in front of the caster', () => {
  const streaks = battleHyperWrapStreaks({count: 18, phase: 0.3});
  assert.equal(streaks.length, 18);
  const back = streaks.filter(s => s.back), front = streaks.filter(s => !s.back);
  assert.ok(back.length >= 8 && front.length >= 8, 'both halves carry streaks');
  for (const s of back) assert.ok(Math.sin(s.angle) < 0, 'far half (up the screen) draws behind the body');
  const layer = fs.readFileSync(new URL('../src/championship/presentation/battleFx/battleFxLayer.js', import.meta.url), 'utf8');
  assert.match(layer, /worldBack\.addChild\(scorchLayer, groundGfx, hyperBack, ghostLayer\)/, 'the far half lives under the actors');
  assert.match(layer, /worldFront\.addChild\(hyperFront,/, 'the near half lives over the actors');
  const overlay = fs.readFileSync(new URL('../src/championship/presentation/vs5/createBattleVfxThreeOverlay.js', import.meta.url), 'utf8');
  assert.match(overlay, /!placement\.hyperWrap/, 'the flat 3D copy stays off while the ring is wrapped');
  assert.match(overlay, /IMPACT_MAX_MS = 1500/, 'no impact sprite outlives 1.5 s on screen');
});

test('the four-beat hit feel: 120 ms wind-up, 65 ms hit-stop, 14-30 px knockback over 200 ms', () => {
  assert.equal(BATTLE_FX_JUICY.windupMs, 120);
  assert.equal(BATTLE_FX_JUICY.hitStopMs, 65);
  assert.deepEqual({...BATTLE_FX_JUICY.knockPx}, {light: 14, medium: 22, heavy: 30});
  assert.equal(BATTLE_FX_JUICY.knockMs, 200);
  // Every element mark also plays real atlas cells on the floor.
  for (const kind of ['roots', 'crack', 'scorch', 'frost', 'puddle', 'static', 'swirl', 'sunburst', 'shade'])
    assert.ok(ELEMENT_GROUND_CELLS[kind]?.length, kind);
  assert.deepEqual(ELEMENT_GROUND_CELLS.roots[0], [53, 2], 'wood leaves toge00 jade spikes');
  // Every frame of every ground sequence ships in the 292-cell web atlas; a missing cell draws nothing.
  const atlas = JSON.parse(fs.readFileSync(new URL('../assets/production/vfx/original-shared-review-292-r1/manifest.json', import.meta.url), 'utf8'));
  const profiles = JSON.parse(fs.readFileSync(new URL('../src/data/championship/battleEffectProfiles.json', import.meta.url), 'utf8'));
  const shipped = new Set();
  (function walk(node) { if (Array.isArray(node)) node.forEach(walk); else if (node && typeof node === 'object') {
    if (Number.isInteger(node.bankId) && Number.isInteger(node.cell)) shipped.add(`${node.bankId}:${node.cell}`); Object.values(node).forEach(walk); } })(atlas);
  for (const [kind, pairs] of Object.entries(ELEMENT_GROUND_CELLS)) for (const [bankId, sequence] of pairs)
    for (const frame of profiles.banks[bankId - 1].sequences[sequence].frames)
      assert.ok(shipped.has(`${bankId}:${frame.cell}`), `${kind}: bank ${bankId} cell ${frame.cell} is not in the web atlas`);
});

test('the record keeps moving after a knockout: ordinary hits feed it, throttled', () => {
  let clock = 0;
  const lines = [];
  const view = {combatants: [{slot: 0, team: 0, displayName: '泥螺仔'}, {slot: 3, team: 1, displayName: '粉紅鳥'}, {slot: 4, team: 1, displayName: '講理蟲'}]};
  const lookups = createBattleFxLookups({getView: () => ({combatants: [view.combatants[0], null, null, view.combatants[1], view.combatants[2]]}),
    onFeed: line => lines.push(line), now: () => clock});
  lookups.onEvent({type: 'KO', slot: 3, teamDown: false});
  assert.match(lines.at(-1), /粉紅鳥/);
  clock += 400; lookups.onEvent({type: 'HIT', slot: 4, attackerSlot: 0, damage: 40});
  assert.equal(lines.length, 1, 'a fresh knockout line is not covered at once');
  clock += 1000; lookups.onEvent({type: 'HIT', slot: 4, attackerSlot: 0, damage: 41});
  assert.equal(lines.length, 2);
  assert.match(lines.at(-1), /泥螺仔.*講理蟲.*41/);
  clock += BATTLE_FEED_HIT_INTERVAL_MS / 2; lookups.onEvent({type: 'HIT', slot: 4, attackerSlot: 0, damage: 5});
  assert.equal(lines.length, 2, 'ordinary hits are throttled');
  clock += BATTLE_FEED_HIT_INTERVAL_MS; lookups.onEvent({type: 'HEAL', slot: 4, amount: 12});
  assert.match(lines.at(-1), /講理蟲.*12/);
});

test('the pre-battle screen builds no native <select>; plans and arenas are pressable chips', () => {
  const screens = fs.readFileSync(new URL('../src/championship/app/vs5Screens.js', import.meta.url), 'utf8');
  assert.doesNotMatch(screens, /element\(\s*['"]select['"]/, 'no select element is created');
  assert.doesNotMatch(screens, /element\(\s*['"]option['"]/, 'no option element is created');
  assert.match(screens, /cm-vs5-tactic__option/);
  assert.match(screens, /cm-vs5-arena-chip/);
});

// Calm battle shot (Owner 2026-11-11, two phone recordings of the auto battle):
// 「畫面都會一直跳動」, 「角色打到一半會突然站在原地不動」, 「結算畫面看不到角色」.
//
// What these cases pin:
//   1. the hit-feel filter covers the screen through the camera (the field no
//      longer goes black for the length of a heavy hit or a signature release);
//   2. an ordinary framing holds, the framed box travels instead of jumping,
//      an ordinary attack does not re-aim the shot, and hits answer gently;
//   3. the original prelude zoom keeps its curve at a share of its depth;
//   4. the original's long knockout freeze plays its frames faster, a hit-stop
//      keeps its length, and the battle itself is not changed by either;
//   5. the improved AI lets go of a finished attack pose that keeps aborting
//      its launch (a twelve-second stand-still in a headless battle);
//   6. the result podium stands every partner, also where the HUD hands back an
//      illustration instead of an animation cell;
//   7. the fallen label no longer adds a row to the HUD cards.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {BATTLE_FX_FRAMING_HOLD_MS, BATTLE_FX_IMPACT_GAP_MS, BATTLE_FX_INSET_RELEASE_MS, BATTLE_FX_LONG_PAUSE_FRAMES, BATTLE_FX_LONG_PAUSE_PACE,
  battleFxFreezePace, createBattleFxCamera, createBattleFxSteadyInsets} from '../src/championship/presentation/battleFx/battleFxCamera.js';
import {createBattleHitFeel} from '../src/championship/presentation/battleFx/battleHitFeel.js';
import {BATTLE_PRELUDE_ZOOM_SHARE, battleFocusViewport} from '../src/championship/presentation/battleFocusViewport.js';
import {BATTLE_AI_POSE_ABORTS, stepBattleAiLaunchPose} from '../src/championship/battle/battleAiAdaptation.js';
import {mountBattleResultCharacters} from '../src/championship/presentation/battleResultCharacters.js';
import {createBattleRuntime} from '../src/championship/app/battleRuntime.js';
import {createNativeHuntIndividual} from '../src/championship/hunt/capture/nativeHuntIndividual.js';
import {nativeHuntSpeciesByIndex} from '../src/championship/hunt/capture/nativeHuntSources.js';
import {nativeIndividualProfile} from '../src/championship/raising/nativeIndividualProfile.js';

const read = path => fs.readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

// ---------------------------------------------------------------- 1. the filter covers the screen
test('the hit-feel filter covers exactly the screen through a zoomed, panned camera', () => {
  class Rectangle { constructor(x, y, width, height) { Object.assign(this, {x, y, width, height}); } }
  const Filter = {from: ({resources}) => ({resources: {hitFeel: {uniforms: Object.fromEntries(Object.entries(resources.hitFeel).map(([k, v]) => [k, v.value]))}}, destroy() {}})};
  const target = {filters: null, filterArea: null};
  const feel = createBattleHitFeel({PIXI: {Filter, Rectangle}, target, screen: () => ({width: 390, height: 844})});
  // Pixi maps a filter area through its container's transform: screen = local * zoom + (x, y).
  const onScreen = (area, camera) => ({x: area.x * camera.zoom + camera.x, y: area.y * camera.zoom + camera.y, width: area.width * camera.zoom, height: area.height * camera.zoom});
  for (const camera of [{zoom: 0.42, x: -310, y: 96}, {zoom: 1.8, x: -900, y: -420}, {zoom: 1, x: 0, y: 0}]) {
    feel.shock(120, 300);
    feel.update(16);
    feel.frame(camera);
    const placed = onScreen(target.filterArea, camera);
    for (const [key, want] of Object.entries({x: 0, y: 0, width: 390, height: 844})) assert.ok(Math.abs(placed[key] - want) < 1e-6, `${key} ${placed[key]} at zoom ${camera.zoom}`);
    assert.deepEqual(Object.values(feel.getDiagnostics().screenArea).map(Math.round), [0, 0, 390, 844]);
  }
  // The plain screen rectangle is what slid away: at zoom 0.42 it would have covered 164 px of a 390 px screen.
  assert.ok(390 * 0.42 - 310 < 0, 'the old area lay wholly off the screen for this camera');
  feel.update(1000);
  assert.equal(target.filters, null);
  assert.equal(target.filterArea, null);
  feel.dispose();
  assert.match(read('src/championship/presentation/vs5/createBattleFieldPixiPresentation.js'), /hitFeel\?\.frame\(\{zoom:transform\.zoom,x:transform\.x,y:transform\.y\}\)/);
});

// ---------------------------------------------------------------- 2. the calm shot
const viewport = {width: 390, height: 750};
const insets = {top: 176, bottom: 150};
const art = {x: 0, y: 0, width: 960, height: 640};
const body = (slot, x, groundY, extra = {}) =>
  ({slot, team: slot < 3 ? 0 : 1, x, groundY, left: x - 22, right: x + 22, top: groundY - 70, bottom: groundY, down: false, engaged: false, ...extra});
const run = (director, subjects, ms, step = 16) => {
  let last = null, biggest = 0;
  for (let t = 0; t < ms; t += step) {
    const next = director.update({dtMs: step, viewport, art, subjects, insets});
    if (last) biggest = Math.max(biggest, Math.hypot((next.centerX - last.centerX) * next.zoom, (next.centerY - last.centerY) * next.zoom));
    last = next;
  }
  return {last, biggest};
};

test('a framing lasts its hold before another may replace it, and the shot travels there instead of jumping', () => {
  const director = createBattleFxCamera({boundedMap: true, wideCover: true});
  // Two fights far apart: the group cannot share the frame, so the shot follows the engaged pair.
  const left = [body(0, 120, 330), body(3, 190, 330)], right = [body(1, 780, 360), body(4, 850, 360)];
  const fights = which => [...left.map(b => ({...b, engaged: which === 'left'})), ...right.map(b => ({...b, engaged: which === 'right'}))];
  const settled = run(director, fights('left'), 2000);
  assert.deepEqual(settled.last.framedSlots, [0, 3], 'the engaged pair is framed');
  assert.ok(run(director, fights('left'), 320).biggest < 1, 'a settled shot stands still');
  // The other pair engages. This framing has had its hold, so the shot goes there, and it travels:
  // no frame moves the picture by more than a brisk pan.
  const moved = run(director, fights('right'), 480);
  assert.deepEqual(moved.last.framedSlots, [1, 4], 'the new engagement is framed');
  assert.ok(moved.biggest > 4 && moved.biggest < 26, `the shot travels to the new framing (largest step ${moved.biggest.toFixed(1)} px)`);
  const first = director.update({dtMs: 16, viewport, art, subjects: fights('right'), insets});
  assert.ok(first.zoom > 0, 'and keeps drawing');
  // The first pair engages again at once. The new framing has not had its hold: it stays.
  const held = run(director, fights('left'), BATTLE_FX_FRAMING_HOLD_MS - 480 - 16 - 160);
  assert.deepEqual(held.last.framedSlots, [1, 4], 'a framing is not replaced inside its hold');
  const back = run(director, fights('left'), 480);
  assert.deepEqual(back.last.framedSlots, [0, 3], 'after the hold the shot follows the fight again');
  run(director, fights('left'), 2400);
  assert.equal(director.getState().framing.moving, false, 'the box has arrived');
});

test('a fighter that goes down ends the hold at once', () => {
  const director = createBattleFxCamera({boundedMap: true, wideCover: true});
  const subjects = [body(0, 120, 330, {engaged: true}), body(3, 190, 330, {engaged: true}), body(1, 780, 360), body(4, 850, 360)];
  run(director, subjects, 1500);
  const after = subjects.map(b => b.slot === 3 ? {...b, down: true} : b);
  const next = director.update({dtMs: 16, viewport, art, subjects: after, insets});
  assert.ok(!next.framedSlots.includes(3), `the fallen fighter leaves the framing: ${next.framedSlots}`);
});

test('the framed box grows at once and shrinks slowly, so an attack cell cannot pump the zoom', () => {
  const director = createBattleFxCamera({boundedMap: true, wideCover: true});
  const calm = [body(0, 430, 330), body(3, 520, 330)];
  run(director, calm, 1500);
  const zoomBefore = director.getState().zoom;
  // One attack frame draws a wide cell: the box contains it in the same frame.
  const wide = [{...calm[0], framingBounds: {left: 330, right: 452, top: 230, bottom: 330}}, calm[1]];
  const grown = director.update({dtMs: 16, viewport, art, subjects: wide, insets});
  assert.ok(grown.framingBox.left <= 330 + 1e-6, `the box grew at once: ${grown.framingBox.left}`);
  // Back to the standing cell: one frame later the box has barely shrunk.
  const shrunk = director.update({dtMs: 16, viewport, art, subjects: calm, insets});
  assert.ok(shrunk.framingBox.left < 345, `the box shrinks slowly: ${shrunk.framingBox.left}`);
  // A cell that flickers wide and narrow every other frame leaves the zoom nearly still.
  let low = Infinity, high = 0;
  for (let i = 0; i < 60; i++) {
    director.update({dtMs: 16, viewport, art, subjects: i % 2 ? wide : calm, insets});
    const z = director.getState().zoom; low = Math.min(low, z); high = Math.max(high, z);
  }
  assert.ok(high / low < 1.06, `zoom range under a flickering cell ${low.toFixed(3)}..${high.toFixed(3)} (was ${zoomBefore.toFixed(3)})`);
});

test('a banner that makes a HUD row taller for a moment does not move the safe window twice', () => {
  const steady = createBattleFxSteadyInsets(), screen = {width: 390, height: 750};
  const play = (raw, ms) => { let last = null; for (let t = 0; t < ms; t += 16) last = steady(raw, 16, screen); return last; };
  assert.deepEqual(steady({top: 161, bottom: 143}, 16, screen), {top: 161, bottom: 143}, 'the first measure is taken as it is');
  // The signature banner: the record row grows by 32 px. The window follows within about half a second, not in one frame.
  const first = steady({top: 161, bottom: 175}, 16, screen);
  assert.ok(first.bottom > 143 && first.bottom < 150, `one frame later ${first.bottom}`);
  assert.equal(play({top: 161, bottom: 175}, 700).bottom, 175);
  // The banner leaves. For the release time nothing moves; a second banner inside it changes nothing at all.
  assert.equal(play({top: 161, bottom: 143}, BATTLE_FX_INSET_RELEASE_MS - 200).bottom, 175);
  assert.equal(play({top: 161, bottom: 175}, 1500).bottom, 175);
  assert.equal(play({top: 161, bottom: 143}, BATTLE_FX_INSET_RELEASE_MS - 200).bottom, 175, 'the release time starts again');
  // A row that stays smaller is believed after the release time, and eased.
  const easing = play({top: 161, bottom: 143}, 400);
  assert.ok(easing.bottom < 175 && easing.bottom > 143, `easing back ${easing.bottom}`);
  assert.equal(play({top: 161, bottom: 143}, 3000).bottom, 143);
  // A new viewport starts afresh; no HUD means no insets; reduced motion follows the page as before.
  assert.deepEqual(steady({top: 120, bottom: 100}, 16, {width: 844, height: 390}), {top: 120, bottom: 100});
  assert.equal(steady(null, 16, screen), null);
  const plain = createBattleFxSteadyInsets({reducedMotion: true});
  plain({top: 161, bottom: 143}, 16, screen);
  assert.deepEqual(plain({top: 161, bottom: 175}, 16, screen), {top: 161, bottom: 175});
  assert.match(read('src/championship/presentation/vs5/createBattleFieldPixiPresentation.js'), /steadyInsets\(readInsets\(\), dtMs, rect\)/);
});

test('an ordinary attack does not re-aim the shot; a signature move and a knockout still stage one', () => {
  const layer = read('src/championship/presentation/battleFx/battleFxLayer.js');
  assert.doesNotMatch(layer, /durationMs: 900, boost: 0\.14/, 'the per-attack re-aim is gone');
  assert.match(layer, /director\?\.sequence\(\[\{slots: \[event\.slot\], durationMs: 650, boost: 0\.26\}/, 'a signature move pushes in gently');
  assert.match(layer, /durationMs: 900, boost: 0\.26, includeDown: true\}/, 'a knockout is held for 0.9 s');
  assert.ok(BATTLE_FX_IMPACT_GAP_MS >= 360, 'hits answer at most about three times a second');
});

test('a stand-in hit stage reads its owning move from the entry, so the frame is always drawn through', () => {
  const layer = read('src/championship/presentation/battleFx/battleFxLayer.js');
  // `owner` exists only inside the block that creates the entry; the hit stage threw a ReferenceError
  // there (BATTLE_REDRAW_FAULT): the rest of that frame, camera included, was not drawn.
  assert.doesNotMatch(layer, /piece: Boolean\(owner && /);
  assert.match(layer, /moveId: owner\?\.moveId \?\? null/);
  assert.match(layer, /piece: Boolean\(entry\.moveId !== null && moveVfxChoreography\(entry\.moveId\)\?\.contact\)/);
});

// ---------------------------------------------------------------- 3. the prelude zoom
test('the prelude zoom keeps its curve at a share of its depth; reduced motion stays level', () => {
  const at = (zoomQ12, extra = {}) => battleFocusViewport({width: 390, height: 750, anchorX: 200, anchorY: 400, zoomQ12, ...extra}).zoom;
  assert.equal(at(8192), 2, 'the function itself still gives the original factor');
  assert.ok(Math.abs(at(8192, {share: BATTLE_PRELUDE_ZOOM_SHARE}) - 1.45) < 1e-9);
  assert.equal(at(4096, {share: BATTLE_PRELUDE_ZOOM_SHARE}), 1);
  // The same curve: half way in is half way in.
  assert.ok(Math.abs((at(6144, {share: BATTLE_PRELUDE_ZOOM_SHARE}) - 1) / (at(8192, {share: BATTLE_PRELUDE_ZOOM_SHARE}) - 1) - 0.5) < 1e-9);
  assert.equal(at(8192, {share: BATTLE_PRELUDE_ZOOM_SHARE, reducedMotion: true}), 1);
  const scene = read('src/championship/presentation/vs5/createBattleFieldPixiPresentation.js');
  assert.match(scene, /\(focus\.zoomQ12\?\?4096\)\/4096-1\)\*BATTLE_PRELUDE_ZOOM_SHARE/, 'the scene takes the share');
  assert.match(scene, /battleFxApproach\(dtMs,90\)/, 'and follows the curve instead of copying its first-frame leap');
});

// ---------------------------------------------------------------- 4. the long freeze
test('only the long knockout freeze plays faster; a hit-stop keeps its length', () => {
  const view = pause => ({nativeLifecycle: {timing: {pause, slowdown: 0}}});
  assert.equal(battleFxFreezePace(view(60)), BATTLE_FX_LONG_PAUSE_PACE);
  assert.equal(battleFxFreezePace(view(48)), BATTLE_FX_LONG_PAUSE_PACE);
  for (const pause of [0, 2, 4, 8, 10, BATTLE_FX_LONG_PAUSE_FRAMES]) assert.equal(battleFxFreezePace(view(pause)), 1, `pause ${pause}`);
  assert.equal(battleFxFreezePace(view(60), true), 1, 'reduced motion keeps the original pacing');
  assert.equal(battleFxFreezePace(null), 1);
  assert.equal(battleFxFreezePace({}), 1);
  // A 60-frame freeze: 48 frames at three a frame, the last 12 one a frame -> 28 drawn frames, under half a second.
  let pause = 60, drawn = 0, pending = 0;
  while (pause > 0) { pending += battleFxFreezePace(view(pause)); while (pending >= 1 && pause > 0) { pending -= 1; pause -= 1; } drawn++; }
  assert.ok(drawn <= 30 && drawn >= 26, `a 60-frame freeze takes ${drawn} drawn frames`);
  const scene = read('src/championship/presentation/vs5/createBattleFieldPixiPresentation.js');
  assert.match(scene, /battleFxFreezePace\(current,reducedMotion\)/, 'the scene paces its own ticks; it never writes the battle');
});

// ---------------------------------------------------------------- 5. the improved AI
const noRng = {next() { throw new Error('the adaptation must not draw a random number'); }};
const launchHost = (overrides = {}) => {
  const notes = [];
  return {notes, c: {state: 15, stateCounter: 0, field17C: 9, field180: 0, field154: 0, statusCode: 0, ...overrides.c},
    h: {rng: noRng, notify: n => notes.push(n), finished: () => overrides.finished ?? 1}};
};

test('a finished attack pose that keeps aborting its launch is let go after a few aborts', () => {
  const memo = {idleSince: null, kicks: 0, poseAborts: 0};
  for (let i = 1; i < BATTLE_AI_POSE_ABORTS; i++) {
    const {c, h, notes} = launchHost();
    assert.equal(stepBattleAiLaunchPose(c, h, memo), null);
    assert.deepEqual(notes, []);
  }
  const {c, h, notes} = launchHost();
  assert.equal(stepBattleAiLaunchPose(c, h, memo), 'POSE_RELEASED');
  assert.deepEqual(notes, [1], 'the original standing notification');
  assert.equal(memo.poseAborts, 0);
});

test('the pose is the original\'s while it plays, under a status, in the script VM, off the entry frame, or when the launch does not abort on it', () => {
  for (const blocked of [{finished: 0}, {c: {statusCode: 6}}, {c: {field154: 1}}, {c: {stateCounter: 1}}, {c: {state: 16, field17C: 12}}, {c: {state: 4}}]) {
    const memo = {poseAborts: BATTLE_AI_POSE_ABORTS - 1};
    const {c, h, notes} = launchHost(blocked);
    assert.equal(stepBattleAiLaunchPose(c, h, memo), null, JSON.stringify(blocked));
    assert.deepEqual(notes, []);
  }
  // A launch that would go ahead (standing), or one that aborts on +0x180, clears the count.
  for (const clear of [{c: {field17C: 1}}, {c: {field180: -255}}]) {
    const memo = {poseAborts: 5};
    const {c, h, notes} = launchHost(clear);
    assert.equal(stepBattleAiLaunchPose(c, h, memo), null);
    assert.equal(memo.poseAborts, 0, JSON.stringify(clear));
    assert.deepEqual(notes, []);
  }
});

function individual(id, species, personality, rngSeed) {
  const profile = structuredClone(nativeIndividualProfile(createNativeHuntIndividual({species: nativeHuntSpeciesByIndex(species), rng: {next: () => rngSeed}})));
  profile.fields['018'] = personality;
  return {instanceId: id, nativeProfile: profile};
}
/** Longest run of battle frames a living, unsuspended fighter holds an attack pose with nothing in flight and no movement. */
function longestHeldPose(aiPolicy, seed = 1) {
  const a = [159, 148, 61], b = [124, 149, 186];
  const runtime = createBattleRuntime({mode: 5, battleType: 0, seed, aiPolicy,
    playerIndividuals: a.map((s, i) => individual('A' + i, s, (seed + i) % 8, seed + i)),
    opponentIndividuals: b.map((s, i) => individual('B' + i, s, (seed * 3 + i) % 8, seed * 7 + i))});
  runtime.choosePracticeBattle({arenaIndex: 2});
  const source = runtime.startMatch();
  const last = [], held = Array(6).fill(0);
  let clock = -1, longest = 0, releases = 0;
  for (let t = 0; t < 20000 && !source.getView().outcome.ended; t++) {
    source.tick();
    const view = source.getView();
    releases = Math.max(releases, view.nativeLifecycle.normalFlow.history.filter(e => e.type === 'AI_ADAPTATION' && e.action === 'POSE_RELEASED').length);
    if (view.clock.frames === clock) continue;
    clock = view.clock.frames;
    const flow = view.nativeLifecycle.normalFlow.slots, reactions = view.nativeLifecycle.reactions.combatants;
    view.combatants.forEach((c, i) => {
      if (!c?.present || !flow[i]) return;
      const p = flow[i].point, moved = last[i] ? Math.hypot(p[0] - last[i][0], p[1] - last[i][1]) : 1;
      last[i] = p;
      const stuck = c.hp.current > 0 && !reactions[i].suspended && [8, 9, 10, 11].includes(reactions[i].notification)
        && !flow[i].launches.some(x => x !== null) && moved < 1024;
      held[i] = stuck ? held[i] + 1 : 0;
      longest = Math.max(longest, held[i]);
    });
  }
  runtime.dispose();
  return {longest, releases};
}

test('the improved AI lets go of the seed-1 pose stall; the original policy is never adapted', () => {
  const original = longestHeldPose('ORIGINAL'), improved = longestHeldPose('IMPROVED_V1');
  assert.equal(original.releases, 0, 'the original policy never adapts');
  // Before the release this battle held one pose for 543 battle frames (twelve seconds on screen).
  assert.ok(improved.longest < 120, `improved longest held pose ${improved.longest} battle frames`);
  assert.ok(improved.releases > 0, 'the improved policy released a pose');
});

// ---------------------------------------------------------------- 6. the result podium
const cell = src => ({src, width: 4, height: 4, origin: [2, 4]});
const texture = () => ({source: {}, orig: {width: 4, height: 4}});
function stageFixture() {
  const roots = [], sprites = [], loads = [], ticks = new Set();
  const vector = () => ({x: 0, y: 0, set(x, y = x) { this.x = x; this.y = y; }});
  const stage = {PIXI: {Sprite: class { constructor() { this.anchor = vector(); this.position = vector(); this.scale = vector(); sprites.push(this); } },
      Assets: {load: async src => { loads.push(src); return texture(); }, unload: async () => {}}},
    app: {screen: {width: 390, height: 700}, ticker: {add: fn => ticks.add(fn), remove: fn => ticks.delete(fn)}},
    createSceneRoot() { const root = {addChild() {}, destroy() { this.destroyed = true; }}; roots.push(root); return root; },
    onResize: () => () => {}};
  return {stage, roots, sprites, loads, ticks};
}

test('the podium stands a partner whose HUD frame is an illustration (public build), and the rest of the party with it', async () => {
  // What the public HUD hands back since the card portraits became illustrations: no foot origin, never loaded here.
  const illustration = {src: 'assets/production/database-display-web/ember.display.webp', sha256: 'x', width: 864, height: 691};
  // Fixture species (none has a reviewed set, so the HUD route is the one that draws them).
  const cells = {'fixture-ember': [cell('ember-0'), cell('ember-1')], 'fixture-flower': [cell('flower-0')]};
  const hudArt = {getBattleCells: id => cells[id] ?? [], getBattleFrame: id => id === 'fixture-ember' ? illustration : cells[id][0]};
  const s = stageFixture();
  const mounted = await mountBattleResultCharacters({stage: s.stage, hudArt, participants: [{speciesId: 'fixture-flower'}, {speciesId: 'fixture-flower'}, {speciesId: 'fixture-ember'}], won: true});
  assert.equal(s.roots.length, 1, 'the scene is mounted');
  assert.equal(s.roots[0].destroyed, undefined, 'and it is not torn down again');
  assert.equal(s.sprites.length, 3, 'all three partners stand');
  for (const sprite of s.sprites) assert.ok(sprite.texture, 'every body has a loaded picture');
  assert.ok(!s.loads.includes(illustration.src), 'the illustration is not a stage body');
  for (const tick of s.ticks) tick({deltaMS: 400}); // later frames keep working
  mounted.dispose();
});

test('the public HUD offers the animation cell itself beside the card portrait', () => {
  const source = read('src/championship/presentation/publicCharacterHudArt.js');
  assert.match(source, /getBattleCell\(id,sequenceId,elapsed\)\{const bank=get\(id\)\?\.battle,sequence=/);
  assert.match(read('src/championship/presentation/battleResultCharacters.js'), /hudArt\.getBattleCell\?hudArt\.getBattleCell\(/);
});

// ---------------------------------------------------------------- 6b. time stopped is shown
// Owner 2026-11-12: 「全場凍結，那應該有凍結特效啊。這樣看起來才不會是站著不動」.
test('a held fighter is marked as held: who is frozen in a signature move and in a knockout freeze', async () => {
  const {BATTLE_FX_STASIS, battleFxStasisOf, battleFxStasisTint} = await import('../src/championship/presentation/battleFx/battleFxLayer.js');
  const fighter = (slot, extra = {}) => ({slot, present: true, down: false, engaged: false, hp: {current: 100}, ...extra});
  const view = ({pause = 0, prelude = null, combatants}) => ({nativeLifecycle: {timing: {pause, slowdown: 0}}, specialPrelude: prelude, combatants});
  // The battle runs, or only a hit-stop holds it: nobody is marked.
  assert.equal(battleFxStasisOf(view({combatants: [fighter(0), fighter(3)]})), null);
  assert.equal(battleFxStasisOf(view({pause: BATTLE_FX_STASIS.pauseFrames, combatants: [fighter(0), fighter(3)]})), null, 'a hit-stop is not a time stop');
  // A signature move: the caster and whoever it has engaged move; the rest are held. A fallen fighter is never marked.
  const signature = battleFxStasisOf(view({prelude: {slot: 1, active: true}, combatants: [fighter(0), fighter(1, {engaged: true}), fighter(2, {down: true, hp: {current: 0}}), fighter(3, {engaged: true}), fighter(4), fighter(5)]}));
  assert.deepEqual(signature, {kind: 'signature', slots: [0, 4, 5]});
  // The original's long pause at a knockout: everyone still standing is held.
  const knockout = battleFxStasisOf(view({pause: 48, combatants: [fighter(0), fighter(1), fighter(3, {down: true, hp: {current: 0}}), fighter(4)]}));
  assert.deepEqual(knockout, {kind: 'knockout', slots: [0, 1, 4]});
  assert.equal(battleFxStasisOf(null), null);
  // The cold tint: none at 0, the stasis colour at 1, and it only ever cools (red falls the most).
  assert.equal(battleFxStasisTint(0), 0xffffff);
  assert.equal(battleFxStasisTint(1), BATTLE_FX_STASIS.tint);
  const half = battleFxStasisTint(0.5);
  assert.ok((half >> 16 & 255) < (half >> 8 & 255) && (half >> 8 & 255) < (half & 255), 'cold: red below green below blue');
  const layer = read('src/championship/presentation/battleFx/battleFxLayer.js'), scene = read('src/championship/presentation/vs5/createBattleFieldPixiPresentation.js');
  assert.match(layer, /updateStasis\(view, ctx, dtMs\);/, 'the layer draws the ring and motes every frame');
  assert.match(layer, /drawStasisEdge\(viewport\);/, 'and cools the edges of the screen');
  assert.match(layer, /stasisFor: slot => stasis\.level > 0 && stasis\.slots\.has\(slot\) \? stasis\.level : 0/);
  assert.match(scene, /sprite\.tint = multiplyTint\(sprite\.tint, battleFxStasisTint\(chill\)\)/, 'the scene tints the held body');
  assert.match(scene, /Math\.max\(litBrightness,164\)/, 'and keeps it readable');
});

// ---------------------------------------------------------------- 7. the fallen label
test('the fallen label sits in the card\'s TP row and adds no row of its own', () => {
  const css = read('src/championship/app/vs5Styles.css');
  const rule = /\.cm-vs5-shell\[data-hud="floating"\] \.cm-vs5-fighter\[data-down="true"\]::after \{([^}]*)\}/.exec(css)?.[1] ?? '';
  assert.match(rule, /grid-area: tp;/);
  assert.doesNotMatch(rule, /grid-column: 1;/);
});

// ---------------------------------------------------------------- batch three: readability
test('the record names a side only when both sides field the same name', async () => {
  const {createBattleFxLookups} = await import('../src/championship/app/battleFxLookups.js');
  // The view's combatants are indexed by slot.
  const view = {combatants: [
    {slot: 0, team: 0, present: true, displayName: '阿花仔'}, {slot: 1, team: 0, present: true, displayName: '小火芯'}, null,
    {slot: 3, team: 1, present: true, displayName: '阿花仔'}, {slot: 4, team: 1, present: true, displayName: '咬衣豆'}, null]};
  const fed = [];
  const lookups = createBattleFxLookups({getView: () => view, localTeam: () => 0, onFeed: line => fed.push(line), now: (() => { let t = 0; return () => (t += 5000); })()});
  lookups.onEvent({type: 'HIT', slot: 3, attackerSlot: 0, damage: 37});
  lookups.onEvent({type: 'HIT', slot: 4, attackerSlot: 1, damage: 18});
  lookups.onEvent({type: 'KO', slot: 3});
  assert.match(fed[0], /^我方・阿花仔攻擊對手・阿花仔/);
  assert.match(fed[1], /^小火芯攻擊咬衣豆/, 'unique names stay as they are');
  assert.ok(fed.some(line => /^對手・阿花仔倒下了/.test(line)));
});

test('whole-screen light is held back when signature moves and knockouts follow each other', async () => {
  const {BATTLE_FX_COMFORT} = await import('../src/championship/presentation/battleFx/battleFxLayer.js');
  assert.ok(BATTLE_FX_COMFORT.stormGapMs >= 2000 && BATTLE_FX_COMFORT.flashGapMs >= 1200);
  const layer = read('src/championship/presentation/battleFx/battleFxLayer.js');
  assert.match(layer, /if \(stormFree\) element\?\.storm\(/, 'a second backdrop inside the gap is skipped');
  assert.match(layer, /elapsed - lastStrongFlashAt >= BATTLE_FX_COMFORT\.flashGapMs \? 0\.45 : 0\.12/, 'a second knockout only flickers');
  assert.match(layer, /n\.node\.position\.set\(clamp\(n\.x, halfW, Math\.max\(halfW, viewport\.width - halfW\)\)/, 'numbers keep their whole width on screen');
  assert.match(layer, /\(ctx\.insets\?\.top \?\? 0\) \+ halfH/, 'and stay off the card rows');
});

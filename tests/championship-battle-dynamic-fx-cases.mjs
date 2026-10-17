// Dynamic battle presentation (OWNER_APPROVED_ADAPTATION 2026-10-12).
//
// The layer is presentation only. These cases pin what it decides from data
// (tier, form, colour, names), how its tracker reads the published view, how
// the camera frames a fight, and -- most important -- that reading views for
// the presentation never changes a battle's result.

import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
  BATTLE_FX_FORMS, BATTLE_FX_PALETTES, battleFxMoveBanks, battleFxMoveTier, describeBattleFxMove
} from '../src/championship/presentation/battleFx/battleFxRecipes.js';
import {createBattleFxEventTracker} from '../src/championship/presentation/battleFx/battleFxEvents.js';
import {battleFxFrameShot, battleFxUnionBox, createBattleFxCamera} from '../src/championship/presentation/battleFx/battleFxCamera.js';
import {
  battleFxHitPoint, battleFxHitTier, battleFxProject, battleFxRandom, createBattleFxLayer, mixColor
} from '../src/championship/presentation/battleFx/battleFxLayer.js';
import {battleFxApprovedMoveName, createBattleFxLookups} from '../src/championship/app/battleFxLookups.js';
import {BATTLE_MOVE_NAMES, battleMoveName} from '../src/championship/text/battleMoveNames.js';
import {SPECIES_NAMES_ZH} from '../src/championship/text/catalogs.zhHant.js';
import {getBattleCatalogRecord, listBattleCatalogRecords, listMoveRecordsForSpecies} from '../src/championship/battle/battleCatalogs.js';
import {createBattleRuntime} from '../src/championship/app/battleRuntime.js';

const SCHEDULE = Object.freeze({entryMode: 0, scheduleSlotA: 2, scheduleSlotB: 3, progressCounter: 0});

test('every fighting species has exactly one signature ultimate among its own kind-1 moves', () => {
  const moves = listBattleCatalogRecords('moves').filter(m => m.recordIndex > 30);
  const bySpecies = new Map();
  for (const move of moves) bySpecies.set(move.speciesId, [...(bySpecies.get(move.speciesId) ?? []), move]);
  let fighters = 0;
  for (const [, list] of bySpecies) {
    const skills = list.filter(m => m.kind === 1);
    if (!skills.length) continue;
    fighters++;
    const ultimates = skills.filter(m => battleFxMoveTier(m, list) === 'ultimate');
    assert.equal(ultimates.length, 1, `species ${list[0].speciesId}`);
    const strongest = Math.max(...skills.map(m => m.power));
    assert.equal(ultimates[0].power, strongest, 'the signature move is the strongest skill');
  }
  assert.equal(fighters, 204);
  assert.equal(battleFxMoveTier(getBattleCatalogRecord('moves', 59), listMoveRecordsForSpecies(34)), 'basic');
  assert.equal(battleFxMoveTier(getBattleCatalogRecord('moves', 5)), 'support', 'a special skill is a support look');
});

test('every move resolves to a known form and palette from existing bank names and its element', () => {
  for (const move of listBattleCatalogRecords('moves')) {
    const look = describeBattleFxMove(move, listMoveRecordsForSpecies(move.speciesId));
    assert.ok(Object.hasOwn(BATTLE_FX_PALETTES, look.palette), `${move.recordIndex} palette ${look.palette}`);
    assert.ok(BATTLE_FX_FORMS.includes(look.form) && look.form !== 'common', `${move.recordIndex} form ${look.form}`);
    for (const bank of battleFxMoveBanks(move)) assert.ok(look.bankIds.includes(bank.bankId));
  }
  // 鎧焰蜥 (species 34): basic strike, fire shot, fire beam signature.
  const agumon = listMoveRecordsForSpecies(34);
  assert.deepEqual(agumon.map(m => {const l = describeBattleFxMove(m, agumon); return [m.recordIndex, l.tier, l.form, l.palette];}),
    [[59, 'basic', 'melee', 'neutral'], [60, 'skill', 'projectile', 'fire'], [61, 'ultimate', 'beam', 'fire']]);
});

test('only approved move names are shown; local acceptance shows stable skill IDs (Owner 2026-10-12)', async () => {
  const {setLocale} = await import('../src/championship/text/locale.js');
  setLocale('zh-Hant');
  // The 30 learnable special skills keep their existing approved names.
  assert.equal(battleFxApprovedMoveName(1), '挑釁');
  assert.equal(battleFxApprovedMoveName(5), '全體治癒 α');
  // Species moves use the approved table; records without a name show none.
  assert.equal(battleFxApprovedMoveName(61), '烈鎧焰砲');
  assert.equal(battleFxApprovedMoveName(0), null);
  assert.equal(battleFxApprovedMoveName(9999), null);
  const view = {combatants: [{displayName: '鎧焰蜥'}]};
  const lines = [];
  const player = createBattleFxLookups({getView: () => view, onFeed: line => lines.push(line)});
  assert.equal(player.moveNameOf(61), '烈鎧焰砲');
  player.onEvent({type: 'LAUNCH', slot: 0, moveId: 61});
  player.onEvent({type: 'LAUNCH', slot: 0, moveId: 60});
  player.onEvent({type: 'LAUNCH', slot: 0, moveId: 59});
  assert.deepEqual(lines, ['鎧焰蜥發動絕招「烈鎧焰砲」！', '鎧焰蜥使出「焰鱗彈」！'], 'a basic attack writes no line');
  const review = createBattleFxLookups({getView: () => view, showIds: true});
  assert.equal(review.moveNameOf(61), '烈鎧焰砲 #61');
  assert.equal(review.moveNameOf(5), '全體治癒 α #5');
  setLocale('en');
  const english = battleFxApprovedMoveName(1);
  assert.ok(typeof english === 'string' && english.length > 0 && english !== '挑釁', 'the approved name follows the game language');
  setLocale('zh-Hant');
});

test('every species move has one unique approved name in each shipped language (Owner 2026-10-12)', async () => {
  const {setLocale} = await import('../src/championship/text/locale.js');
  const speciesMoves = listBattleCatalogRecords('moves').filter(move => move.recordIndex > 30);
  assert.equal(speciesMoves.length, 565);
  assert.deepEqual(Object.keys(BATTLE_MOVE_NAMES).map(Number).sort((a, b) => a - b), speciesMoves.map(move => move.recordIndex));
  for (const [column, locale] of ['zh-Hant', 'en', 'ja', 'th', 'vi'].entries()) {
    const names = Object.values(BATTLE_MOVE_NAMES).map(entry => entry[column]);
    assert.ok(names.every(name => typeof name === 'string' && name.trim() === name && name.length > 0), locale);
    assert.equal(new Set(names.map(name => name.toLowerCase())).size, names.length, `${locale} names are unique`);
    setLocale(locale);
    assert.equal(battleMoveName(595), BATTLE_MOVE_NAMES[595][column]);
  }
  setLocale('zh-Hant');
  // A name is display text only; English stays short enough for the callout.
  assert.ok(Object.values(BATTLE_MOVE_NAMES).every(entry => entry[1].length <= 18));
});

test('in-game species names are original (Owner 2026-10-12 rename)', () => {
  assert.equal(SPECIES_NAMES_ZH[181], '地嘯暴龍');
  assert.equal(SPECIES_NAMES_ZH[211], '黃銅王猿');
  assert.equal(SPECIES_NAMES_ZH[222], '天穹帝龍');
  for (const retired of ['地龍獸', '鋼鐵猿猴獸', '帝皇龍甲獸']) assert.ok(!Object.values(SPECIES_NAMES_ZH).includes(retired), retired);
});

test('every new battle word has a translation in each shipped language', () => {
  const words = ['絕招！', '技能', '對戰開始！', '會心一擊！', '重擊！', '命中！', '回復', '倒下！',
    '{name}發動絕招「{move}」！', '{name}使出「{move}」！', '{name}發動絕招！', '{name}使出技能！', '{name}倒下了！'];
  for (const locale of ['en', 'ja', 'th', 'vi']) {
    const source = fs.readFileSync(new URL(`../src/championship/text/uiText.${locale}.js`, import.meta.url), 'utf8');
    for (const word of words) assert.ok(source.includes(`${JSON.stringify(word)}:`), `${locale} ${word}`);
  }
});

function fakeView({frame, hps, down = [], active = [], history = [], ended = false, flash = false}) {
  return {animationFrame: frame, clock: {frames: frame},
    combatants: hps.map((hp, slot) => hp === null ? {slot, present: false} : {slot, team: slot < 3 ? 0 : 1, present: true,
      down: down.includes(slot), hp: {current: hp, maximum: 1000, ratio: hp / 1000}}),
    nativeLifecycle: {active, reactions: {history}, flash: {active: flash}},
    outcome: {ended, verdict: ended ? 'TEAM_ZERO_AHEAD' : 'RUNNING', winningTeam: ended ? 0 : null}};
}

test('the tracker turns successive views into launch, hit, status, knockout and end events once each', () => {
  const tracker = createBattleFxEventTracker();
  const types = events => events.map(e => e.type);
  assert.deepEqual(types(tracker.consume(fakeView({frame: 1, hps: [1000, null, null, 1000, null, null]}))), ['START']);
  const launch = {object: 0x11000000, moveId: 61, ownerSlot: 0, phase: 'RUN'};
  let events = tracker.consume(fakeView({frame: 2, hps: [1000, null, null, 1000, null, null], active: [launch]}));
  assert.deepEqual(events.map(e => [e.type, e.slot, e.moveId]), [['LAUNCH', 0, 61]]);
  assert.deepEqual(tracker.consume(fakeView({frame: 3, hps: [1000, null, null, 1000, null, null], active: [launch]})), [], 'a live launch fires once');
  events = tracker.consume(fakeView({frame: 4, hps: [1000, null, null, 760, null, null], active: [launch], flash: true,
    history: [{frame: 4, slot: 3, type: 'STATUS_APPLIED', code: 3}]}));
  assert.deepEqual(types(events), ['STATUS', 'HIT', 'FLASH']);
  const hit = events.find(e => e.type === 'HIT');
  assert.deepEqual([hit.slot, hit.damage, hit.attackerSlot, hit.moveId], [3, 240, 0, 61]);
  assert.equal(hit.ratio, 0.24);
  // The same history entry is not reported again on the next view.
  assert.deepEqual(types(tracker.consume(fakeView({frame: 5, hps: [1000, null, null, 760, null, null],
    history: [{frame: 4, slot: 3, type: 'STATUS_APPLIED', code: 3}]}))), []);
  events = tracker.consume(fakeView({frame: 6, hps: [1000, null, null, 0, null, null], down: [3], ended: true}));
  assert.deepEqual(types(events), ['HIT', 'KO', 'END']);
  assert.equal(events.find(e => e.type === 'KO').teamDown, true);
});

test('the camera fills the field with the arena and looks past an edge only as far as the fighters need', () => {
  const viewport = {width: 390, height: 360}, art = {x: 0, y: 52, width: 390, height: 255};
  const cover = Math.max(390 / 390, 360 / 255);
  const wide = battleFxFrameShot({viewport, art, box: {left: 100, top: 120, right: 300, bottom: 220}});
  assert.ok(wide.zoom >= cover - 1e-9 && wide.zoom <= wide.maxZoom);
  const half = viewport.width / (2 * wide.zoom);
  assert.ok(wide.cx - half >= art.x - 1e-9 && wide.cx + half <= art.x + art.width + 1e-9, 'no side letterbox');
  // A body past the far edge pulls the view up, but only as far as it needs.
  const tall = battleFxFrameShot({viewport, art, box: {left: 150, top: 20, right: 260, bottom: 160}});
  const halfH = viewport.height / (2 * tall.zoom), viewTop = tall.cy - halfH;
  assert.ok(viewTop < art.y, 'it looks past the edge');
  assert.ok(viewTop >= 20 - (140 * 0.12 + 28) - 1e-6, 'no further than the body and its overhead room');
  assert.ok(tall.over.top > 0 && tall.over.top <= halfH + 1e-9);
  assert.deepEqual([wide.over.left, wide.over.right], [0, 0], "a centred group never looks past the sides");
  assert.equal(battleFxUnionBox([]), null);
});

test('camera punch and shake decay, and reduced motion keeps a steady shot', () => {
  const viewport = {width: 390, height: 360}, art = {x: 0, y: 52, width: 390, height: 255};
  const subjects = [{slot: 0, left: 120, right: 170, top: 120, bottom: 200}, {slot: 3, left: 230, right: 280, top: 130, bottom: 200}];
  const camera = createBattleFxCamera();
  const first = camera.update({dtMs: 0, viewport, art, subjects});
  camera.punch(0.07); camera.shake(0.5);
  const hit = camera.update({dtMs: 16, viewport, art, subjects});
  assert.ok(hit.zoom > first.zoom && hit.trauma > 0);
  let later = hit;
  for (let i = 0; i < 120; i++) later = camera.update({dtMs: 16, viewport, art, subjects});
  assert.ok(later.punch < 0.001 && later.trauma === 0);
  const calm = createBattleFxCamera({reducedMotion: true});
  calm.update({dtMs: 0, viewport, art, subjects});
  calm.punch(0.1); calm.shake(1); calm.focus([0], 1000, 0.3);
  const steady = calm.update({dtMs: 16, viewport, art, subjects});
  assert.equal(steady.punch, 0); assert.equal(steady.trauma, 0); assert.deepEqual(steady.focused, []);
});

test('field marks anchor to the native ground and the real contact point (Owner 2026-10-12)', () => {
  const art = {x: 10, y: 20, width: 416, height: 272};
  // A projectile 12 native px above ground at (100, 150): drawn up, grounded below.
  const p = battleFxProject([100 * 4096, 150 * 4096, 12 * 4096], art, 1);
  assert.deepEqual([p.x, p.y, p.groundY, p.heightNative], [110, 158, 170, 12]);
  const target = {x: 200, groundY: 190, top: 130, height: 60, width: 40, facing: -1};
  // A native impact near the target wins, even with a projectile ending there.
  assert.deepEqual(battleFxHitPoint({target, impacts: [{x: 205, y: 160}, {x: 400, y: 100}], endings: [{x: 198, y: 150}]}),
    {x: 205, y: 160, groundY: 190, source: 'NATIVE_IMPACT'});
  // Without an impact, the projectile's last position is the contact point.
  assert.deepEqual(battleFxHitPoint({target, endings: [{x: 190, y: 150}, {x: 20, y: 150}]}),
    {x: 190, y: 150, groundY: 190, source: 'PROJECTILE_END'});
  // A melee hit with neither lands on the attacker's side of the body; ground is the target's.
  const side = battleFxHitPoint({target, attacker: {x: 120}});
  assert.equal(side.source, 'BODY_SIDE');
  assert.ok(side.x < target.x && side.groundY === 190);
});

test('the camera opens wide, pushes in for a launch, pulls out after, and follows a live shot', () => {
  const viewport = {width: 390, height: 360}, art = {x: 0, y: 52, width: 390, height: 255};
  const subjects = [{slot: 0, left: 150, right: 175, top: 150, bottom: 185}, {slot: 3, left: 230, right: 255, top: 150, bottom: 185}];
  const camera = createBattleFxCamera();
  const opening = camera.update({dtMs: 16, viewport, art, subjects});
  const cover = Math.max(390 / 390, 360 / 255);
  assert.ok(Math.abs(opening.zoom - cover) < 0.05, 'the first frame is the wide shot');
  let shot = opening;
  for (let i = 0; i < 90; i++) shot = camera.update({dtMs: 16, viewport, art, subjects});
  const settled = shot.zoom;
  assert.ok(settled > opening.zoom + 0.2, 'then it pushes in on the fighters');
  camera.sequence([{slots: [0], durationMs: 600, boost: 0.38}, {slots: [0, 3], durationMs: 900, boost: -0.05}]);
  for (let i = 0; i < 30; i++) shot = camera.update({dtMs: 16, viewport, art, subjects});
  const pushed = shot.zoom;
  assert.ok(pushed > settled, 'a signature launch pushes in on the attacker');
  for (let i = 0; i < 50; i++) shot = camera.update({dtMs: 16, viewport, art, subjects});
  assert.ok(shot.zoom < pushed, 'and then pulls out to show the path');
  // A live projectile far to the side widens the frame toward it.
  const calm = createBattleFxCamera();
  let a = null, b = null;
  for (let i = 0; i < 80; i++) a = calm.update({dtMs: 16, viewport, art, subjects});
  for (let i = 0; i < 80; i++) b = calm.update({dtMs: 16, viewport, art, subjects, points: [{x: 40, y: 120}]});
  assert.ok(b.centerX < a.centerX && b.zoom <= a.zoom, 'the shot follows the projectile');
});

test('layer helpers: hit tiers, colour mix, seeded noise, and no layer without a 2D canvas', () => {
  assert.equal(battleFxHitTier({ratio: 0.02}), 'light');
  assert.equal(battleFxHitTier({ratio: 0.08}), 'medium');
  assert.equal(battleFxHitTier({ratio: 0.2}), 'heavy');
  assert.equal(battleFxHitTier({ratio: 0.01, ultimate: true}), 'heavy');
  assert.equal(mixColor(0x000000, 0xffffff, 0.5), 0x808080);
  const a = battleFxRandom(7), b = battleFxRandom(7);
  assert.deepEqual([a(), a(), a()], [b(), b(), b()]);
  assert.equal(createBattleFxLayer({PIXI: {}, worldBack: null, worldFront: null, screen: null}), null,
    'Node has no canvas; the scene then keeps the classic view');
});

test('reading every view for the presentation never changes the battle', () => {
  const run = withFx => {
    const runtime = createBattleRuntime({schedule: SCHEDULE});
    runtime.chooseMatch(runtime.listMatches()[0].recordIndex);
    const source = runtime.startMatch();
    const tracker = createBattleFxEventTracker();
    const lookups = createBattleFxLookups({getView: () => source.getView()});
    const hp = [], events = [];
    for (let i = 0; i < 4000 && !source.getView().outcome.ended; i++) {
      source.tick();
      const view = source.getView();
      if (withFx) for (const event of tracker.consume(view)) {
        events.push(event.type);
        if (event.type === 'LAUNCH') lookups.describeMove(event.slot, event.moveId);
      }
      hp.push(view.combatants.map(c => c.hp?.current ?? null).join(','));
    }
    const outcome = source.getView().outcome;
    runtime.dispose();
    return {hp, outcome: JSON.stringify(outcome), events};
  };
  const plain = run(false), dressed = run(true);
  assert.deepEqual(dressed.hp, plain.hp);
  assert.equal(dressed.outcome, plain.outcome);
  for (const type of ['START', 'LAUNCH', 'HIT', 'KO', 'END']) assert.ok(dressed.events.includes(type), type);
});

test('the approved public playtest URL plays the selected remade shared effects only (Owner 2026-10-12)', async () => {
  const {ORIGINAL_SHARED_LOCAL_MANIFEST, originalSharedVfxManifestFor, originalSharedVfxPublicSelected, originalSharedVfxReviewRequested} =
    await import('../src/championship/presentation/originalSharedVfxReview.js');
  const policy = JSON.parse(fs.readFileSync('src/data/championship/public-playtest.r1.json', 'utf8'));
  const selection = policy.acceptedOriginalSharedVfx;
  assert.equal(selection.manifestPath, ORIGINAL_SHARED_LOCAL_MANIFEST);
  const inputs = JSON.parse(fs.readFileSync('docs/contracts/championship/WEB_BUILD_INPUTS.v1.json', 'utf8'));
  for (const file of selection.files) {
    if(file.endsWith('.json'))assert.ok(!inputs.files.includes(file),file);else assert.ok(inputs.files.includes(file),file);
    assert.ok(fs.existsSync(file), file);
  }
  const manifest = JSON.parse(fs.readFileSync(ORIGINAL_SHARED_LOCAL_MANIFEST, 'utf8'));
  assert.ok(!manifest.banks.some(bank => bank.bankId === 110), 'the withdrawn bank 110 stays out');
  assert.deepEqual([manifest.image.src, ...Object.values(manifest.localizedText.sets).map(set => set.image.src)].sort(),
    selection.files.filter(file => file.endsWith('.png')).sort());
  const publicUrl = 'https://orochi771127.github.io/championship-2026/championship.html';
  assert.equal(originalSharedVfxPublicSelected(publicUrl), true);
  assert.equal(originalSharedVfxReviewRequested(publicUrl + '?vfxOriginal=shared-v1'), true);
  assert.equal(originalSharedVfxReviewRequested(publicUrl), false, 'the app opts in; ?vfxOriginal=off stays off');
  // Review revisions are loopback choices; the public URL always plays the selection.
  assert.equal(originalSharedVfxManifestFor(publicUrl + '?vfxOriginal=shared-v1&vfxRevision=157-baseline'), ORIGINAL_SHARED_LOCAL_MANIFEST);
  for (const url of ['https://orochi771127.github.io/other/?vfxOriginal=shared-v1', 'https://example.org/championship-2026/?vfxOriginal=shared-v1'])
    assert.equal(originalSharedVfxReviewRequested(url), false, url);
});

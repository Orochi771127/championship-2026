// HUNT_INSTINCT_VFX_20261110: a special wild partner's footprint glows in its tier's colour (Owner: not fancy),
// and the Hunt dock's hand tool reads 捕獲移動 (Owner: friends did not know what 手 did).
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync, existsSync} from 'node:fs';
import {HUNT_INSTINCT_GLOW, HUNT_ACTOR_SHADOW} from '../src/championship/presentation/vs2/huntThree/actorShadows.mjs';

const read = path => readFileSync(path, 'utf8');

test('instinct glow: the footprint shadow takes the tier colour, nothing fancier', () => {
  assert.deepEqual(Object.keys(HUNT_INSTINCT_GLOW), ['ELITE', 'ANCESTOR'], 'a normal partner keeps the black shadow');
  assert.notEqual(HUNT_INSTINCT_GLOW.ELITE.color, HUNT_INSTINCT_GLOW.ANCESTOR.color);
  assert.ok(HUNT_INSTINCT_GLOW.ELITE.opacity > HUNT_ACTOR_SHADOW.contactOpacity, 'the glow reads at a glance');
  const three = read('src/championship/presentation/vs2/huntThree/createHuntThreeMap.mjs');
  assert.match(three, /const glow=HUNT_INSTINCT_GLOW\[wild\.instinct\]/);
  assert.match(three, /shadow\.material\.color\.setHex\(glow\?glow\.color:0x02070a\)/);
  assert.match(three, /hide\(node\.instinctAura\)/, 'the 2D fallback mark is hidden over the 3D scene');
  assert.ok(!existsSync(new URL('../src/championship/presentation/vs2/huntThree/instinctAura.mjs', import.meta.url)), 'no outline, sigil or sparks');
  const pixi = read('src/championship/presentation/vs2/createHuntFieldPixiPresentation.js');
  assert.doesNotMatch(pixi, /2654435761/, 'the per-90 ms random arc seed is gone');
  assert.match(pixi, /const INSTINCT_GLOW = \{ ELITE: 0xff2a10, ANCESTOR: 0x9a5cff \}/);
});

test('the hand tool is labelled 捕獲移動 in every language', () => {
  assert.match(read('src/championship/hunt/capture/nativeHuntFieldControls.js'), /\{id:"HAND",label:"捕獲移動",enabled:true\}/);
  for (const [file, text] of [['en', 'Grab & Move'], ['ja', '捕獲移動'], ['th', 'จับ/ย้าย'], ['vi', 'Bắt & dời']]) {
    const source = read(`src/championship/text/uiText.${file}.js`);
    assert.ok(source.includes(`"捕獲移動": "${text}"`), file);
  }
});

test('grounding: the footprint lies behind the nearest foot, sized from the drawing, mirrored with the partner', async () => {
  const {huntActorFootprint, HUNT_FOOTPRINT_FRONT} = await import('../src/championship/presentation/vs2/huntThree/actorFootprint.mjs');
  const s = Math.sin(52 * Math.PI / 180), quad = [[-46, -68], [-46, 0], [46, 0], [46, -68]];
  const fp = huntActorFootprint({speciesId: 'species-129', sequenceId: 0, quad, elevationSin: s});
  assert.ok(fp.y < 0, 'centre behind the feet');
  assert.ok(Math.abs(fp.y + (1 - HUNT_FOOTPRINT_FRONT) * fp.radiusY) < 1e-9);
  assert.ok(fp.radiusX > 30 && fp.radiusX <= 0.46 * 92 + 1e-9, 'sized from the 92-unit drawing');
  const mirrored = huntActorFootprint({speciesId: 'species-129', sequenceId: 0, quad: quad.map(([x, y]) => [-x, y]), elevationSin: s});
  assert.ok(Math.abs(mirrored.x + fp.x) < 1e-9, 'a partner facing the other way mirrors its footprint');
  const hop = huntActorFootprint({speciesId: 'species-129', sequenceId: 0, quad, elevationSin: s, worldZ: 34});
  assert.ok(hop.radiusX < fp.radiusX && hop.alpha < 1, 'a hop shrinks and lightens the shadow');
  const three = read('src/championship/presentation/vs2/huntThree/createHuntThreeMap.mjs');
  assert.match(three, /huntActorFootprint\(/);
  assert.match(three, /if\(next\.selectedWildId!==wild\.wildId\)hide\(node\.ring\)/, 'idle 2D ring hidden over the 3D scene');
});

test('rarity: at most one elite and one ancestral partner a hunt; the premium radars guarantee them', async () => {
  const {settleWildInstincts, instinctNoise, WILD_INSTINCT_LIMITS} = await import('../src/championship/contracts/productAwakeningOverdrive.js');
  const {GACHA_CHIPS, gachaChipEffectLines} = await import('../src/championship/gacha/cyberGacha.js');
  assert.deepEqual({...WILD_INSTINCT_LIMITS}, {ELITE: 1, ANCESTOR: 1});
  // Every noise in the special band: still only one of each.
  const crowd = settleWildInstincts([0.99, 0.991, 0.995, 0.998, 0.999, 0.5]);
  assert.equal(crowd.filter(id => id === 'ELITE').length, 1);
  assert.equal(crowd.filter(id => id === 'ANCESTOR').length, 1);
  // Over many 12-partner hunts: an elite in roughly 1 hunt in 6, an ancestral one in roughly 1 in 30.
  let elite = 0, ancestor = 0, eliteRadar = 0, ancestorRadar = 0;
  for (let h = 0; h < 4000; h++) {
    const noises = Array.from({length: 12}, (_, i) => instinctNoise(77, h, i));
    const plain = settleWildInstincts(noises);
    elite += plain.includes('ELITE'); ancestor += plain.includes('ANCESTOR');
    const e = settleWildInstincts(noises, {eliteCall: true}), a = settleWildInstincts(noises, {ancestorCall: true});
    assert.ok(e.includes('ELITE') && e.filter(id => id === 'ELITE').length <= 2, 'the elite radar guarantees 1, at most 2');
    assert.equal(a.filter(id => id === 'ANCESTOR').length, 1, 'the ancestral radar guarantees exactly 1');
    eliteRadar += e.filter(id => id === 'ELITE').length; ancestorRadar += a.includes('ANCESTOR');
    assert.deepEqual(settleWildInstincts(noises), plain, 'same noises, same hunt');
  }
  assert.ok(elite / 4000 > 0.11 && elite / 4000 < 0.23, `elite hunts ${elite / 4000}`);
  assert.ok(ancestor / 4000 > 0.015 && ancestor / 4000 < 0.06, `ancestral hunts ${ancestor / 4000}`);
  // The radars are premium-only (SR / SSR) and reuse the 龍族 / 星靈族 radar rows' art.
  const eliteChip = GACHA_CHIPS.find(c => c.id === 'chip:elite-radar'), ancestorChip = GACHA_CHIPS.find(c => c.id === 'chip:ancestor-radar');
  assert.deepEqual([eliteChip.rarity, eliteChip.shopRecordIndex, eliteChip.kind], ['SR', 74, 'HUNT']);
  assert.deepEqual([ancestorChip.rarity, ancestorChip.shopRecordIndex, ancestorChip.kind], ['SSR', 78, 'HUNT']);
  assert.equal(gachaChipEffectLines(eliteChip).length, 1); assert.equal(gachaChipEffectLines(ancestorChip).length, 1);
  for (const lang of ['en', 'ja', 'th', 'vi']) {
    const text = read(`src/championship/text/uiText.${lang}.js`);
    for (const key of ['歷戰菁英雷達', '祖靈血脈雷達', '本場必定出現 1 隻歷戰菁英，最多 2 隻', '本場必定出現 1 隻祖靈']) assert.ok(text.includes(`"${key}":`), `${lang} ${key}`);
  }
});

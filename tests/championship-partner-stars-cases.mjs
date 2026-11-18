// ROADMAP_R3_20261118 (Owner 2026-11-18: 「同一隻合成的時候有機會提升一顆星的等級，最高是五星」, left to Claude):
// stars are a METER filled by fusing the partner's own kind, never a chance and never in the gachapon; every star
// lifts the Sync Level cap by ten. Plan: docs/planning/TAMER_PROGRESSION_ROADMAP_2026-11-18_ZH_TW.md, batch R3.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {STAR_MAX, STAR_LEVEL_STEP, STAR_POINTS_NEEDED, STAR_FODDER_POINTS, STAR_CARRIED_SHARE, starLevelCap, starForLevel,
  starPointsNeeded, starFodderPoints, starTotalPoints, grantStarPoints, normalizeSyncLevels, syncOf, grantSyncExp,
  fuseSyncPartners, reconcileSyncRebirth, syncExpRequired, SYNC_LEVEL_MAX, EVOLUTION_LEVEL_GATES} from '../src/championship/contracts/productSyncLevel.js';
import {GACHA_MACHINES} from '../src/championship/gacha/cyberGacha.js';
import {CEREMONY_TIMING} from '../src/championship/presentation/ceremony/ceremonyRunner.js';
import {STAR_EMBLEM_BASE, starEmblemSrc} from '../src/championship/presentation/starEmblemArt.js';
import {uiText} from '../src/championship/text/uiText.js';
import {syncText} from '../src/championship/text/syncLevelText.js';
import {setLocale} from '../src/championship/text/locale.js';

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const state = partners => ({version: 1, partners, crystals: 0});

test('five stars, ten levels a star, and a meter that asks for more each time', () => {
  assert.deepEqual([STAR_MAX, STAR_LEVEL_STEP, STAR_CARRIED_SHARE], [5, 10, 0.5]);
  assert.deepEqual({...STAR_POINTS_NEEDED}, {1: 6, 2: 10, 3: 16, 4: 24});
  assert.deepEqual([1, 2, 3, 4, 5, 9, 0, undefined].map(starLevelCap), [10, 20, 30, 40, 50, 50, 10, 10]);
  assert.equal(starLevelCap(STAR_MAX), SYNC_LEVEL_MAX);
  assert.deepEqual([1, 10, 11, 20, 21, 49, 50].map(starForLevel), [1, 1, 2, 2, 3, 5, 5]);
  assert.deepEqual([1, 2, 3, 4, 5].map(starPointsNeeded), [6, 10, 16, 24, 0]);
  // one star is enough for the evolution gates of R2 (Lv.3 and Lv.10)
  assert.ok(Object.values(EVOLUTION_LEVEL_GATES).every(lv => lv <= starLevelCap(1)));
  // fodder points: its own species by grade, a lower stage of the line 1, anything else nothing
  assert.deepEqual(['S', 'A', 'B', 'C', null].map(grade => starFodderPoints({line: 1, grade})), [4, 3, 2, 2, 2]);
  assert.equal(starFodderPoints({line: 1, grade: {grade: 'S', q: [90, 90, 90, 90, 90, 90]}}), 4);
  assert.deepEqual([0.6, 0.9].map(line => starFodderPoints({line, grade: 'S'})), [1, 1]);
  assert.deepEqual([starFodderPoints({line: 0}), starFodderPoints()], [0, 0]);
  assert.equal(STAR_FODDER_POINTS.LOWER_STAGE, 1);
  // the whole road with ungraded catches of its own species: 3 + 5 + 8 + 12 = 28
  assert.equal(Object.values(STAR_POINTS_NEEDED).reduce((sum, need) => sum + need, 0) / starFodderPoints({line: 1}), 28);
  assert.deepEqual([starTotalPoints(1, 0), starTotalPoints(2, 3), starTotalPoints(5, 0)], [0, 9, 56]);
});

test('the meter fills, a full meter is one more star, the rest carries on, and five stars take nothing', () => {
  const first = grantStarPoints(null, 'p', 5);
  assert.deepEqual(first.gain, {instanceId: 'p', points: 5, before: {star: 1, points: 0, need: 6}, after: {star: 1, points: 5, need: 6}, gained: 0});
  assert.deepEqual(first.state.partners.p, {level: 1, exp: 0, rebirths: 0, starPoints: 5});
  const second = grantStarPoints(first.state, 'p', 3);
  assert.deepEqual([second.gain.after, second.gain.gained], [{star: 2, points: 2, need: 10}, 1]);
  assert.deepEqual(second.state.partners.p, {level: 1, exp: 0, rebirths: 0, star: 2, starPoints: 2});
  const leap = grantStarPoints(null, 'q', 6 + 10 + 16 + 5);
  assert.deepEqual([leap.gain.after, leap.gain.gained], [{star: 4, points: 5, need: 24}, 3], 'several stars in one pour');
  const top = grantStarPoints(null, 'r', 999);
  assert.deepEqual([top.gain.after, top.state.partners.r], [{star: 5, points: 0, need: 0}, {level: 1, exp: 0, rebirths: 0, star: 5}]);
  const more = grantStarPoints(top.state, 'r', 10);
  assert.deepEqual([more.gain.gained, more.state.partners.r], [0, {level: 1, exp: 0, rebirths: 0, star: 5}]);
  assert.equal(grantStarPoints(null, 'p', 0).gain.gained, 0);
  // the grade and the learned move of the record are kept
  const kept = grantStarPoints(state({p: {level: 4, exp: 9, rebirths: 2, grade: {grade: 'S', q: [90, 90, 90, 90, 90, 90]}}}), 'p', 6).state.partners.p;
  assert.deepEqual(kept, {level: 4, exp: 9, rebirths: 2, grade: {grade: 'S', q: [90, 90, 90, 90, 90, 90]}, star: 2});
});

test('a partner levels up to its stars\' cap, and what it cannot take becomes crystals', () => {
  let need = 0; for (let lv = 1; lv < 10; lv++) need += syncExpRequired(lv);
  const capped = grantSyncExp(null, 'p', need + 500);
  assert.deepEqual(capped.state.partners.p, {level: 10, exp: 0, rebirths: 0});
  assert.deepEqual([capped.gain.overflow, capped.state.crystals, capped.gain.cap, capped.gain.capped], [500, 500, 10, true]);
  assert.deepEqual(syncOf(capped.state, 'p'), {level: 10, exp: 0, next: syncExpRequired(10), star: 1, starPoints: 0, starNeed: 6, cap: 10, capped: true});
  const again = grantSyncExp(capped.state, 'p', 40);
  assert.deepEqual([again.gain.after.level, again.gain.overflow, again.state.crystals], [10, 40, 540]);
  // one more star opens ten more levels
  const starred = grantStarPoints(capped.state, 'p', 6).state;
  const on = grantSyncExp(starred, 'p', syncExpRequired(10) + 3);
  assert.deepEqual(on.state.partners.p, {level: 11, exp: 3, rebirths: 0, star: 2});
  assert.deepEqual([on.gain.overflow, on.gain.capped, syncOf(on.state, 'p').cap], [0, false, 20]);
  // five stars: Lv.50 as before, and only there the level reads as the top
  const top = grantSyncExp(state({p: {level: 49, exp: 0, star: 5}}), 'p', syncExpRequired(49) + 9);
  assert.deepEqual([top.state.partners.p.level, top.gain.overflow, top.gain.capped, syncOf(top.state, 'p').next], [50, 9, false, 0]);
});

test('a save from before stars keeps every level: it reads with the stars that level needs', () => {
  const old = normalizeSyncLevels(state({a: {level: 1, exp: 5}, b: {level: 10, exp: 30}, c: {level: 11, exp: 0}, d: {level: 37, exp: 100, rebirths: 1}, e: {level: 50, exp: 0}}));
  assert.deepEqual(old.partners, {a: {level: 1, exp: 5, rebirths: 0}, b: {level: 10, exp: 0, rebirths: 0}, c: {level: 11, exp: 0, rebirths: 0, star: 2},
    d: {level: 37, exp: 100, rebirths: 1, star: 4}, e: {level: 50, exp: 0, rebirths: 0, star: 5}});
  // a broken star or meter is put right; a star is never lowered under what the level needs
  const odd = normalizeSyncLevels(state({a: {level: 25, exp: 0, star: 1, starPoints: 999}, b: {level: 3, exp: 0, star: 99}, c: {level: 3, exp: 0, star: 2, starPoints: -4}}));
  assert.deepEqual(odd.partners, {a: {level: 25, exp: 0, rebirths: 0, star: 3, starPoints: 15}, b: {level: 3, exp: 0, rebirths: 0, star: 5}, c: {level: 3, exp: 0, rebirths: 0, star: 2}});
  assert.deepEqual(normalizeSyncLevels(normalizeSyncLevels(old)), old, 'reading twice changes nothing');
  // a rebirth keeps the stars and the meter
  const reborn = reconcileSyncRebirth(state({p: {level: 40, exp: 0, star: 4, starPoints: 7}}), 'p', 1).partners.p;
  assert.deepEqual(reborn, {level: 12, exp: 0, rebirths: 1, star: 4, starPoints: 7});
});

test('fusion fills the meter with every fodder before it pays EXP, and a starred fodder hands over half its points', () => {
  // three ungraded catches of its own species: 6 points, one star, and the cap is already Lv.20 for their EXP
  const base = state({base: {level: 10, exp: 0, rebirths: 0}});
  const fused = fuseSyncPartners(base, 'base', [{line: 1}, {line: 1}, {line: 1}]);
  assert.deepEqual([fused.starPoints, fused.summary.stars.gained], [6, 1]);
  assert.deepEqual(fused.summary.stars, {points: 6, gained: 1, before: {star: 1, points: 0, need: 6}, after: {star: 2, points: 0, need: 10}});
  assert.equal(fused.summary.after.star, 2);
  assert.ok(fused.summary.after.level > 10 || fused.summary.after.exp > 0, 'their EXP is taken above the old cap');
  assert.deepEqual([fused.overflow, fused.gains.map(gain => gain.overflow)], [0, [0, 0, 0]], 'the star is counted first, so no fodder is wasted at the old cap');
  // the order the fodder are picked in changes nothing: S first or last, the same star and the same EXP
  const order = fodders => fuseSyncPartners(base, 'base', fodders).summary;
  assert.deepEqual(order([{line: 1, grade: 'S'}, {line: 1}]).after, order([{line: 1}, {line: 1, grade: 'S'}]).after);
  // a lower stage of the line fills a little; a mix
  const mixed = fuseSyncPartners(state({}), 'base', [{line: 0.6, grade: 'S'}, {line: 1, grade: 'A'}]);
  assert.deepEqual([mixed.starPoints, mixed.summary.stars.after], [4, {star: 1, points: 4, need: 6}]);
  // a starred fodder: its own points (2) plus half of what it gathered (star 3 with 4 = 6 + 10 + 4 = 20 -> 10)
  const rich = state({base: {level: 1, exp: 0}, old: {level: 5, exp: 0, star: 3, starPoints: 4}});
  const handed = fuseSyncPartners(rich, 'base', [{instanceId: 'old', line: 1}]);
  assert.deepEqual([handed.starPoints, handed.summary.stars.after], [12, {star: 2, points: 6, need: 10}]);
  assert.equal(handed.state.partners.old, undefined);
  // a starred fodder of a lower stage hands over nothing of its own
  const lower = fuseSyncPartners(rich, 'base', [{instanceId: 'old', line: 0.6}]);
  assert.equal(lower.starPoints, 1);
  // five stars take no points and the input is never changed
  const top = fuseSyncPartners(state({base: {level: 50, exp: 0, star: 5}}), 'base', [{line: 1, grade: 'S'}]);
  assert.deepEqual([top.summary.stars.gained, top.summary.stars.after], [0, {star: 5, points: 0, need: 0}]);
  assert.deepEqual(rich.partners.old, {level: 5, exp: 0, star: 3, starPoints: 4});
});

test('stars are played for: no gachapon machine sells them, and the screens show them in five languages', async () => {
  assert.doesNotMatch(JSON.stringify(GACHA_MACHINES), /star/i);
  assert.doesNotMatch(source('src/championship/gacha/cyberGacha.js'), /starPoints|grantStarPoints|STAR_/);
  const roster = source('src/championship/app/digimonListScreen.js');
  // Owner 2026-11-18: shown as game art and motion, never as a sentence. The strip is drawn (emblems, a level
  // gauge, a meter); the words are only its accessible name. A star gained is a ceremony with the partner cheering.
  assert.match(roster, /const starLine = element\("div", "cm-digimon-star", "", false\);/);
  assert.match(roster, /starLine\.replaceChildren\(starPips\(\{ star: sync\.star, gained, size: 20 \}\),\s+starLevelGauge\(\{ level: sync\.level, cap: sync\.cap, capped: sync\.capped \}\), meterGroup\(sync\.starPoints, sync\.starNeed\)\);/);
  assert.match(roster, /starLine\.setAttribute\("aria-label", starText\(sync\)\);/);
  assert.doesNotMatch(roster, /starLine\.textContent/);
  assert.match(roster, /fusionViz\.replaceChildren\(starPips\(\{ star: stars\.before\.star, ghost: stars\.gained, size: 20 \}\),/);
  assert.match(roster, /starCeremony = playCeremony\(\{ host: stage, kind: "star-up", cue: "medal", label,/);
  assert.match(roster, /requestArcadeFx\(starLine, leveled \? "levelup" : "sparkle"\);/);
  const art = source('src/championship/presentation/starEmblemArt.js');
  for (const name of ['starEmblem', 'starPips', 'starMeter', 'starLevelGauge']) assert.match(art, new RegExp(`export function ${name}\\(`));
  assert.doesNotMatch(art, /[★☆⭐]/u, 'sticker art or drawn paths, no font glyph or emoji');
  assert.match(art, /image\.addEventListener\?\.\('error', \(\) => \{ try \{ image\.replaceWith\(drawnStarEmblem\(\{on, size\}\)\); \}/, 'an image that fails falls back to the drawn star');
  // The emblem art: Codex's stickers, recorded with their rights and inputs, each file present with its hash.
  const {createHash} = await import('node:crypto');
  const manifest = JSON.parse(source('assets/production/ui/tamer-emblems-r1/manifest.json'));
  assert.deepEqual([manifest.id, manifest.rightsStatus, manifest.files.slice(0, 3).map(file => file.key)], ['art:ui:tamer-emblems:r1', 'ORIGINAL_GENERATED', ['star-on', 'star-off', 'star-burst']]);
  assert.match(manifest.provenance, /no ROM frame, research-library file or third-party character was an input/);
  for (const file of manifest.files.slice(0, 3)) {
    assert.equal(createHash('sha256').update(readFileSync(new URL(`../${file.path}`, import.meta.url))).digest('hex'), file.sha256, file.path);
    assert.equal(file.path, `${STAR_EMBLEM_BASE}${file.key}_96.webp`);
  }
  assert.equal(starEmblemSrc('on'), 'assets/production/ui/tamer-emblems-r1/star-on_96.webp');
  const index = JSON.parse(source('assets/production/ART_PRODUCTION_INDEX.json')).entries.find(entry => entry.assetId === 'art:ui:tamer-emblems:r1');
  assert.deepEqual([index.rightsStatus, index.runtimeEligible, index.shippingReady, index.humanApproved], ['ORIGINAL_GENERATED', true, false, false]);
  assert.equal(index.manifestSha256, createHash('sha256').update(readFileSync(new URL('../assets/production/ui/tamer-emblems-r1/manifest.json', import.meta.url))).digest('hex'));
  const allow = source('docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json');
  for (const file of manifest.files) assert.ok(allow.includes(file.path), `${file.path} is published`);
  assert.ok(!allow.includes('tamer-emblems-r1/manifest.json'), 'the provenance record is not published');
  assert.doesNotMatch(art, /https?:/, 'no URL literal');
  const scenes = source('src/championship/presentation/ceremony/ceremonyScenes.js');
  assert.match(scenes, /export function buildStarUp\(stage, env, \{ kicker, title, meta, species = null, star = 1, gained = 1, hint \}\)/);
  assert.match(scenes, /row\.append\(starPips\(\{ doc, star, gained, size: 34, burst: true \}\)\);/);
  assert.deepEqual(CEREMONY_TIMING['star-up'], {tier: 'moment', full: 2600, saver: 1700});
  // The art's own styles are in styles.css (they may loop a glow); ceremony.css keeps only the star-up moment.
  const css = source('src/championship/app/styles.css') + source('src/championship/app/ui/ceremony.css');
  assert.doesNotMatch(source('src/championship/app/ui/ceremony.css'), /infinite/);
  for (const rule of ['.cm-star__body {', '@keyframes cm-star-stamp', '.cm-star-meter__fill {', '.cm-star-gauge[data-capped="true"] {', '.cm-ceremony[data-kind="star-up"] {',
    '.cm-digimon-starstage {', ':root[data-motion="reduced"] :is(.cm-stars__cell, .cm-star-meter__ahead, .cm-star-gauge) { animation: none; }']) assert.ok(css.includes(rule), rule);
  assert.match(source('src/championship/app/raisingHomeP1RView.js'), /starsChip\.replaceChildren\(starEmblem\(\{ on: true, size: 16 \}\), count\);/);
  assert.match(source('src/championship/app/championshipStandaloneApp.js'), /star:syncOf\(syncLevels,id\)\.star,/);
  assert.match(roster, /fusionStarText\(preview\.stars\),/);
  assert.match(roster, /warning\.kind === "STAR" \? uiText\("FUSION_LOSE_STAR", \{ star: warning\.star \}\)/);
  assert.match(source('src/championship/app/main.js'), /sync: \(instanceId\) => app\.getSyncLevel\(instanceId\),/);
  assert.match(source('src/championship/app/vs3Screens.js'), /uiText\("FUSION_STAR_UP", \{ before: preview\.stars\.before\.star, after: preview\.stars\.after\.star \}\)/);
  assert.match(source('src/championship/app/ui/syncGainPanel.js'), /if \(gain\.capped\) main\.append\(element\("p", "cm-sync-row__overflow cm-sync-row__capped", syncText\("capped", \{ level: gain\.cap \}\)\)\);/);
  assert.match(source('src/championship/app/championshipStandaloneApp.js'), /if\(star>1\)warnings\.push\(Object\.freeze\(\{kind:'STAR',star\}\)\);/);
  try {
    for (const locale of ['zh-Hant', 'en', 'ja', 'th', 'vi']) {
      setLocale(locale);
      assert.match(uiText('STAR_LINE', {star: 2, level: 14, cap: 20}), /★2.*14.*20/, locale);
      assert.match(uiText('STAR_METER', {points: 4, need: 10}), /4\/10/, locale);
      assert.match(uiText('FUSION_STAR_UP', {before: 1, after: 2}), /★1 → ★2/, locale);
      assert.match(uiText('FUSION_LOSE_STAR', {star: 3}), /★3/, locale);
      for (const key of ['STAR_FULL', 'FUSION_CAPPED', 'STAR_UP_KICKER']) { assert.notEqual(uiText(key), key, `${locale} ${key}`); assert.ok(uiText(key).length > 0); }
      assert.match(syncText('capped', {level: 10}, locale), /10/, locale);
      assert.match(uiText('STAR_UP_META', {star: 2, cap: 20}), /★2.*20/, locale);
    }
    setLocale('zh-Hant');
    for (const line of [uiText('STAR_LINE', {star: 5, level: 50, cap: 50}), uiText('STAR_METER', {points: 23, need: 24}), uiText('FUSION_CAPPED'), syncText('capped', {level: 40}, 'zh-Hant')])
      assert.ok([...line].length <= 24, `${line} is ${[...line].length} characters`);
  } finally { setLocale('zh-Hant'); }
});

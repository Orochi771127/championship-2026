// BATTLE_STYLE_V1 (2026-11-16): partner styles, move classes, special-skill and status glyphs.
import test from 'node:test';
import assert from 'node:assert/strict';
import {existsSync, readFileSync} from 'node:fs';
import {battleStyleOf, battleStyleOfProfile, isSpecialSkillId, moveClassOf, SPECIAL_SKILL_GLYPHS, speciesSkillCount} from '../src/championship/contracts/productBattleStyle.js';
import {BATTLE_STYLE_COPY, battleStyleText, specialSkillEffect} from '../src/championship/text/battleStyleText.js';
import {STATUS_GLYPHS, STYLE_GLYPHS, battleGlyphSrc} from '../src/championship/app/battleGlyphs.js';
import {createBattleRecordTap, summariseBattleRecord} from '../src/championship/app/battleTacticRecord.js';
import {tacticRecordLines} from '../src/championship/text/tacticRecordText.js';
import {nativeHuntSpeciesByIndex} from '../src/championship/hunt/capture/nativeHuntSources.js';
import {createNativeHuntIndividual} from '../src/championship/hunt/capture/nativeHuntIndividual.js';
import {nativeIndividualProfile} from '../src/championship/raising/nativeIndividualProfile.js';
import {STATUS_AILMENT_BY_RUNTIME_CODE} from '../src/championship/presentation/battleFx/battleStatusAilmentFx.js';
import {LOCALES, setLocale} from '../src/championship/text/locale.js';
import {createBattleFieldView} from '../src/championship/app/vs5Screens.js';

const root = new URL('../', import.meta.url);
const source = p => readFileSync(new URL(p, root), 'utf8');

test('styles over every species x personality pair: 194 attack, 266 skill, 179 support', () => {
  const tally = {ATTACK: 0, SKILL: 0, SUPPORT: 0};
  for (let s = 0; s < 260; s++) {
    let species; try { species = nativeHuntSpeciesByIndex(s); } catch { continue; }
    for (const pair of species.aiPairs ?? []) {
      const style = battleStyleOf({speciesId: s, specialSkills: pair.filter(isSpecialSkillId)});
      if (style) tally[style]++;
    }
  }
  assert.deepEqual(tally, {ATTACK: 194, SKILL: 266, SUPPORT: 179}, 'the two egg species (six pairs, generation 0) have no style');
});

test('the rule: heal or revival makes a supporter; otherwise two SP moves make a skill user', () => {
  assert.equal(speciesSkillCount(61), 1);
  assert.equal(battleStyleOf({speciesId: 0, specialSkills: []}), null, 'an egg has no style');
  assert.equal(battleStyleOf({speciesId: 61, specialSkills: []}), 'ATTACK');
  assert.equal(battleStyleOf({speciesId: 61, specialSkills: [2]}), 'SUPPORT', '治癒 α');
  assert.equal(battleStyleOf({speciesId: 61, specialSkills: [29]}), 'SUPPORT', '復活 β');
  assert.equal(battleStyleOf({speciesId: 61, specialSkills: [12, 14]}), 'ATTACK', 'a guard or haste alone is not support');
  assert.ok(speciesSkillCount(41) >= 2);
  assert.equal(battleStyleOf({speciesId: 'species-041', specialSkills: []}), 'SKILL');
  // A caught individual: the style follows its own special skills.
  const profile = nativeIndividualProfile(createNativeHuntIndividual({species: nativeHuntSpeciesByIndex(37), rng: {next: () => 11}, traitOverride: 6}));
  assert.equal(profile.fields['12c'], 2);
  assert.equal(battleStyleOfProfile(profile), 'SUPPORT');
});

test('move classes come from the record kind', () => {
  assert.equal(moveClassOf(78), 'ATTACK');
  assert.equal(moveClassOf(79), 'SKILL');
  assert.equal(moveClassOf(2), 'SUPPORT');
  assert.equal(moveClassOf(28), 'SUPPORT');
  assert.equal(moveClassOf(-1), null);
});

test('every special skill and every status code has a glyph and copy in five locales', () => {
  for (let id = 1; id <= 30; id++) assert.ok(SPECIAL_SKILL_GLYPHS[id]?.glyph, `skill ${id}`);
  for (const code of Object.keys(STATUS_AILMENT_BY_RUNTIME_CODE)) assert.ok(STATUS_GLYPHS[code], `status ${code}`);
  const keys = Object.keys(BATTLE_STYLE_COPY['zh-Hant']);
  for (const locale of LOCALES) for (const key of keys) assert.ok(key in BATTLE_STYLE_COPY[locale], `${locale}:${key}`);
  assert.equal(specialSkillEffect('skill_heal', 'ALL', 'zh-Hant'), '我方全體回復 HP');
  assert.equal(battleStyleText('status.status_poisoned', {}, 'zh-Hant'), '中毒');
  for (const locale of LOCALES) for (const key of keys.filter(k => k.startsWith('status.') || k.startsWith('short.')))
    assert.ok(BATTLE_STYLE_COPY[locale][key].length <= 14, `${locale}:${key} is short`);
});

test('every glyph the code names is a shipped 64 px file listed in the manifest', () => {
  const manifest = JSON.parse(source('assets/production/ui/battle-glyphs-r1/manifest.json'));
  assert.equal(manifest.rightsStatus, 'ORIGINAL_GENERATED');
  const listed = new Set(manifest.files.map(f => f.path));
  const keys = new Set([...Object.values(STYLE_GLYPHS), ...Object.values(STATUS_GLYPHS), ...Object.values(SPECIAL_SKILL_GLYPHS).map(g => g.glyph)]);
  for (const key of keys) {
    const path = battleGlyphSrc(key);
    assert.ok(existsSync(new URL(path, root)), path);
    assert.ok(listed.has(path), `${path} in manifest`);
  }
  const index = JSON.parse(source('assets/production/ART_PRODUCTION_INDEX.json'));
  assert.ok(index.entries.some(e => e.assetId === 'art:ui:battle-glyphs:r1' && e.rightsStatus === 'ORIGINAL_GENERATED'));
});

test('the record counts each status that lands on the other team once per landing', () => {
  const tap = createBattleRecordTap({localTeamIndex: 0});
  const fighter = (slot, code, hp = 100) => ({slot, team: slot < 3 ? 0 : 1, present: true, speciesId: 'species-061', displayName: 'X',
    hp: {current: hp, maximum: 100}, resource: {current: 10, maximum: 10}, status: {code, remaining: code ? 10 : 0}});
  const view = (frame, codes) => ({clock: {frames: frame}, combatants: [fighter(0, 0), fighter(3, codes[0]), fighter(4, codes[1])],
    nativeLifecycle: {normalFlow: {history: []}}, outcome: {ended: false}});
  for (const [frame, codes] of [[1, [0, 0]], [2, [7, 0]], [3, [7, 0]], [4, [0, 10]], [5, [7, 10]], [6, [7, 10]]]) tap.observe(view(frame, codes));
  const record = summariseBattleRecord({tap, view: {outcome: {ended: true, winningTeam: 0}}, diagnostics: {slots: [{tactic: 0, decisions: 1, action: 1, move: 0, targeted: 0}]}});
  assert.deepEqual(record.foeStatuses, [{key: 'status_poisoned', count: 2}, {key: 'status_electrified', count: 1}]);
  const lines = tacticRecordLines(record, {nameOf: () => 'X', moveName: String, locale: 'zh-Hant'});
  assert.equal(lines.at(-1), '對手：中毒 ×2　麻痺 ×1');
});

test('wiring: roster, battle select, Journey, battle plates and the Dex show the glyphs', () => {
  assert.match(source('src/championship/app/digimonListScreen.js'), /group\.dataset\.row = "style"/);
  assert.match(source('src/championship/app/main.js'), /styleChip:battleStyleChip\(entry\?\.battleStyle\)/);
  assert.match(source('src/championship/app/vs5Screens.js'), /if\(look\?\.styleChip\)meta\.append\(look\.styleChip\);/);
  assert.match(source('src/championship/app/vs5Screens.js'), /cm-vs5-fighter__status/);
  assert.match(source('src/championship/app/journeyScreen.js'), /look\.styleChip \? \[look\.styleChip\]/);
  assert.match(source('src/championship/app/vs4Screens.js'), /typeSpan\.dataset\.class = m\.kind === 1 \? 'SKILL' : 'ATTACK';/);
  assert.match(source('src/championship/app/vs2Styles.css'), /cm-dex-move-card__type\[data-class="SKILL"\]::before \{ background-image: url\("\.\.\/\.\.\/\.\.\/assets\/production\/ui\/battle-glyphs-r1\/style_skill_64\.webp"\)/);
  assert.match(source('src/championship/app/championshipStandaloneApp.js'), /battleStyle:battleStyleOfProfile\(nativeProfile\)/);
});

// A minimal DOM, as championship-battle-floating-hud-cases.mjs uses for the battle plates.
class FakeNode {
  constructor(tag) { Object.assign(this, {tagName: tag, children: [], dataset: {}, attributes: {}, listeners: {}, style: {}, className: '', _text: ''});
    this.classList = {add: n => { this.className += ' ' + n; }, remove: () => {}}; }
  get textContent() { return this._text + this.children.map(n => n.textContent).join(''); }
  set textContent(value) { this._text = String(value); this.children = []; }
  append(...nodes) { this.children.push(...nodes.map(n => typeof n === 'string' ? Object.assign(new FakeNode('#text'), {_text: n}) : n)); }
  prepend(...nodes) { this.children.unshift(...nodes); }
  replaceChildren(...nodes) { this._text = ''; this.children = nodes; }
  setAttribute(k, v) { this.attributes[k] = v; }
  getAttribute(k) { return this.attributes[k] ?? null; }
  addEventListener(k, v) { this.listeners[k] = v; }
  remove() {}
}
const tree = n => [n, ...n.children.flatMap(tree)];
const byClass = (n, c) => tree(n).filter(x => String(x.className).split(' ').includes(c));

test('a battle plate shows the fighter status as a glyph and a short name, and hides it when it clears', () => {
  const before = globalThis.document;
  globalThis.document = {createElement: t => new FakeNode(t), createTextNode: t => Object.assign(new FakeNode('#text'), {_text: t})};
  setLocale('zh-Hant');
  try {
    const fighter = (slot, code) => ({slot, team: slot < 3 ? 0 : 1, present: true, displayName: 'X', hp: {current: 50, maximum: 100, ratio: .5},
      resource: {current: 5, maximum: 10, ratio: .5}, down: false, status: {code, remaining: code ? 100 : 0}});
    const frame = codes => ({arena: {identifier: 'BATTLE_VOLCANO'}, clock: {ratio: .8, tier: 1}, outcome: {ended: false},
      combatants: codes.map((code, slot) => fighter(slot, code))});
    const root = new FakeNode('root');
    const view = createBattleFieldView({root, frame: frame([0, 0, 0, 7, 0, 0]), mountField: () => ({}), dynamicFx: true, responsiveLayout: true});
    view.render(frame([0, 0, 0, 7, 0, 0]));
    const plate = slot => byClass(root, 'cm-vs5-fighter').find(c => c.dataset.slot === String(slot));
    const chip = slot => byClass(plate(slot), 'cm-vs5-fighter__status')[0];
    assert.equal(chip(3).hidden, false);
    assert.equal(chip(3).dataset.status, 'status_poisoned');
    assert.equal(chip(3).textContent, '中毒');
    assert.equal(byClass(chip(3), 'cm-glyph')[0].src, 'assets/production/ui/battle-glyphs-r1/status_poisoned_64.webp');
    assert.equal(chip(0).hidden, true);
    view.render(frame([10, 0, 0, 0, 0, 0]));
    assert.equal(chip(3).hidden, true, 'cleared');
    assert.equal(chip(0).dataset.status, 'status_electrified');
    view.dispose();
  } finally { globalThis.document = before; }
});

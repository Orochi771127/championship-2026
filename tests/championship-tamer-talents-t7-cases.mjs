// TAMER_TALENTS_T7_20261118: the hunter talent 省彈 (10 % a rank that a shot costs no ammunition).
// Plan: docs/planning/TAMER_TALENT_TREE_AND_SUPPLEMENTS_PLAN_2026-11-17_ZH_TW.md section 4.1.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {TALENT_NODES, TALENT_TIER_GATE, TALENT_WIRED_KEYS, talentOpen, talentChance, talentValue, learnTalent, talentRefusal}
  from '../src/championship/contracts/productTamerTalents.js';
import {TAMER_TALENT_COPY, talentEffectText} from '../src/championship/text/tamerTalentText.js';
import {getHuntCatalogItem} from '../src/championship/hunt/loadout/huntEquipmentCatalog.js';

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const node = TALENT_NODES.find(entry => entry.key === 'ammoSavePercent');

test('省彈 is open, in the hunter line\'s third tier, with copy in five languages', () => {
  assert.equal(node.id, 'hunter.thrift'); assert.equal(node.tier, 3);
  assert.ok(TALENT_WIRED_KEYS.has('ammoSavePercent') && talentOpen(node.id));
  for (const locale of Object.keys(TAMER_TALENT_COPY)) assert.ok(talentEffectText(node, 1, locale).length > 0, locale);
  assert.equal(talentEffectText(node, 3, 'zh-Hant'), '射擊 30% 不耗彈');
  // The hunter line reaches the tier with its open nodes: 6 points in tier one, 9 in tier two.
  const open = tier => TALENT_NODES.filter(entry => entry.line === 'hunter' && entry.tier === tier && talentOpen(entry.id));
  const points = tier => open(tier).reduce((sum, entry) => sum + entry.max * entry.cost, 0);
  assert.ok(points(1) >= TALENT_TIER_GATE[2] && points(1) + points(2) >= TALENT_TIER_GATE[3]);
  let state = null;
  for (const entry of [...open(1), ...open(2)]) for (let rank = 0; rank < entry.max; rank++) state = learnTalent(state, entry.id, 76);
  assert.equal(talentRefusal(state, 'hunter.thrift', 76), null);
  state = learnTalent(learnTalent(state, 'hunter.thrift', 76), 'hunter.thrift', 76);
  assert.equal(talentValue(state, 'ammoSavePercent'), 20);
});

test('a talent that is a chance: the roll must fall under the share, and there is none without the talent or a roll', () => {
  assert.equal(talentChance(30, 0.299), true);
  assert.equal(talentChance(30, 0.3), false);
  assert.equal(talentChance(30, 0), true);
  assert.equal(talentChance(0, 0), false);
  assert.equal(talentChance(-10, 0), false);
  assert.equal(talentChance(30, NaN), false);
  assert.equal(talentChance(30, -0.1), false);
  assert.equal(talentChance(30, undefined), false);
  assert.equal(talentChance(500, 0.999), true, 'never more than certain');
});

test('only a shot can be free: the hunt\'s own consume callback checks the class, a held round and the replay', () => {
  assert.equal(getHuntCatalogItem('championship:2026:hunt-item:shot-i').equipmentClass, 'SHOT');
  assert.equal(getHuntCatalogItem('championship:2026:hunt-item:rope-i').equipmentClass, 'ROPE', 'a rope is never free');
  const app = source('src/championship/app/championshipStandaloneApp.js');
  assert.match(app, /if\(n===1&&huntCaptureReplay===null&&getHuntCatalogItem\(id\)\?\.equipmentClass==='SHOT'\)\{/);
  assert.match(app, /if\(held>0&&talentChance\(talent\('ammoSavePercent'\),productRoll\(0x64\)\)\)return Object\.freeze\(\{ok:true,itemId:id,quantity:0,owned:held,saved:true\}\);/);
  // The tutorial hunt has its own callback and never reads the talent.
  const tutorial = app.slice(app.indexOf('const world=createHuntWorld(TUTORIAL_GATE,entry);'), app.indexOf('return {runtime,loadout:entry.loadout};'));
  assert.ok(tutorial.length > 0 && !tutorial.includes('ammoSavePercent'));
});

// ROADMAP_R4_20261118 (Owner 2026-11-18): the tamer's 20 skill cards. Three in the hand in an auto battle, drawn from
// the cards the tamer owns (four basic, sixteen by the talent lines); the player throws them. Rules, battle effects and
// settlement here; the hand on screen in tests/championship-skill-hand-cases.mjs.
import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {SKILL_CARDS, SKILL_CARD_IDS, SKILL_CARD_LINE_GATES, SKILL_CARD_FIRST_FRAMES, SKILL_CARD_STEP_FRAMES, skillCardGate, ownedSkillCards,
  skillCardHandSize, drawSkillHand, skillCardsAllowedAt, getSkillCard} from '../src/championship/contracts/productTamerSkillCards.js';
import {createBattleSkillCards} from '../src/championship/battle/battleSkillCards.js';
import {TALENT_NODES} from '../src/championship/contracts/productTamerTalents.js';
import {skillCardText} from '../src/championship/text/skillCardText.js';

const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');
const teamOf = slot => Math.floor(slot / 3);
const fighter = (extra = {}) => ({currentHp: 1000, maxHp: 1000, metricLimit: 100, metricBase: 100, field28: 40, statusCode: 0, ...extra});
const field = () => [fighter({currentHp: 600}), fighter({currentHp: 300}), null, fighter({currentHp: 900}), fighter({currentHp: 200}), fighter()];
/** A talent state with `spent` points in one line (ranks spread over its open nodes). */
function spentIn(line, spent) {
  const nodes = {}; let left = spent;
  for (const node of TALENT_NODES.filter(entry => entry.line === line)) { if (left <= 0) break; const ranks = Math.min(node.max, left); nodes[node.id] = ranks; left -= ranks * node.cost; }
  return {version: 1, level: 50, exp: 0, nodes, keystones: {}, respecs: 0};
}

test('twenty cards: four basic and four for each talent line, given at 3, 9, 15 and 22 points spent', () => {
  assert.equal(SKILL_CARDS.length, 20);
  assert.deepEqual(['basic', 'hunter', 'breeder', 'commander', 'trader'].map(line => SKILL_CARDS.filter(card => card.line === line).length), [4, 4, 4, 4, 4]);
  assert.deepEqual([...SKILL_CARD_LINE_GATES], [3, 9, 15, 22]);
  assert.deepEqual(SKILL_CARD_IDS.map(skillCardGate), [0, 0, 0, 0, 3, 9, 15, 22, 3, 9, 15, 22, 3, 9, 15, 22, 3, 9, 15, 22]);
  assert.deepEqual(ownedSkillCards(null), ['basic.cheer', 'basic.firstAid', 'basic.focus', 'basic.cover']);
  assert.deepEqual(ownedSkillCards(spentIn('breeder', 9)).filter(id => !id.startsWith('basic.')), ['breeder.nutrient', 'breeder.calm']);
  assert.deepEqual(ownedSkillCards(spentIn('trader', 2)).length, 4, 'two points open nothing');
  for (const card of SKILL_CARDS) for (const locale of ['zh-Hant', 'en', 'ja', 'th', 'vi']) {
    for (const part of ['name', 'effect']) assert.notEqual(skillCardText(`${card.id}.${part}`, null, locale), `${card.id}.${part}`, `${locale} ${card.id} ${part}`);
    assert.ok([...skillCardText(`${card.id}.effect`, null, 'zh-Hant')].length <= 16, card.id);
  }
});

test('the hand: three in Free and Practice, by title rank in titles and tournaments, none in password and link', () => {
  assert.deepEqual([2, 5].map(mode => skillCardHandSize(mode, 0)), [3, 3]);
  assert.deepEqual([0, 2, 3, 5, 6, 9].map(rank => skillCardHandSize(1, rank)), [1, 1, 2, 2, 3, 3]);
  assert.equal(skillCardHandSize(0, 4), 2);
  assert.deepEqual([3, 4, 6, -1].map(mode => skillCardHandSize(mode, 9)), [0, 0, 0, 0]);
  const rolls = [0.5, 0.99, 0];
  const hand = drawSkillHand(SKILL_CARD_IDS, 3, () => rolls.shift());
  assert.equal(new Set(hand).size, 3);
  assert.deepEqual(drawSkillHand(['basic.cheer', 'basic.cheer', 'nope'], 3, () => 0), ['basic.cheer'], 'no duplicates, no unknown cards');
  assert.deepEqual(drawSkillHand([], 3), []);
  // pacing: nothing for 3 s, then one card, one more every 6 s (a free battle can end in 13 s)
  assert.deepEqual([SKILL_CARD_FIRST_FRAMES, SKILL_CARD_STEP_FRAMES], [180, 360]);
  assert.deepEqual([0, 179, 180, 539, 540, 899, 900, 99999].map(frame => skillCardsAllowedAt(frame, 3)), [0, 0, 1, 1, 2, 2, 3, 3]);
  assert.equal(skillCardsAllowedAt(99999, 1), 1);
});

test('a thrown card waits its turn, is played once, and lands on the next step', () => {
  const cards = createBattleSkillCards({hand: ['basic.cheer', 'basic.firstAid', 'breeder.nutrient'], team: 0, teamOf});
  const slots = field();
  assert.deepEqual(cards.request('basic.cheer', 100), {ok: false, reason: 'NOT_READY'});
  assert.deepEqual(cards.request('hunter.snare', 700), {ok: false, reason: 'NOT_IN_HAND'});
  assert.equal(cards.snapshot(200).cards.filter(card => card.state === 'READY').length, 3);
  assert.deepEqual(cards.request('basic.cheer', 200), {ok: true, id: 'basic.cheer'});
  assert.deepEqual(cards.request('basic.cheer', 200), {ok: false, reason: 'ALREADY_PLAYED'});
  assert.deepEqual(cards.request('basic.firstAid', 200), {ok: false, reason: 'NOT_READY'}, 'the second waits until 9 s');
  assert.equal(slots[0].metricLimit, 100, 'nothing before the step');
  const step = cards.step(201, slots);
  assert.deepEqual(step.landed, ['basic.cheer']);
  assert.deepEqual(slots.map(c => c?.metricLimit ?? null), [120, 120, null, 100, 100, 100], 'the local team only');
  const view = cards.snapshot(201);
  assert.deepEqual([view.used, view.allowed, view.nextFrame, view.cards.map(card => card.state)], [1, 1, 540, ['PLAYED', 'WAIT', 'WAIT']]);
  assert.equal(cards.request('basic.firstAid', 900).ok, true);
  cards.step(901, slots);
  assert.deepEqual(slots.map(c => c?.currentHp ?? null), [600, 450, null, 900, 200, 1000], 'first aid heals the local partner lowest in HP');
  assert.equal(cards.request('breeder.nutrient', 1300).ok, true);
  assert.equal(cards.step(1301, slots).changed, true);
  assert.deepEqual(slots.map(c => c?.currentHp ?? null), [700, 550, null, 900, 200, 1000]);
  assert.deepEqual(cards.snapshot(1301).nextFrame, null);
});

test('every effect touches only what it names, and only for its side', () => {
  const play = (id, slots = field(), frame = 700) => { const cards = createBattleSkillCards({hand: [id], team: 0, teamOf}); assert.equal(cards.request(id, frame).ok, true, id); cards.step(frame + 1, slots); return {cards, slots}; };
  // timing: delays and haste write the decision cooldown
  assert.deepEqual(play('hunter.stunShot').slots.map(c => c?.field28 ?? null), [40, 40, null, 40, 160, 40], 'the foe closest to falling waits 2 s');
  assert.deepEqual(play('hunter.snare').slots.map(c => c?.field28 ?? null), [40, 40, null, 100, 100, 100]);
  assert.deepEqual(play('commander.link').slots.map(c => c?.field28 ?? null), [20, 20, null, 40, 40, 40]);
  assert.deepEqual(play('hunter.smoke').slots.map(c => c?.metricLimit ?? null), [100, 100, null, 70, 70, 70]);
  const status = field(); status[0].statusCode = 3; status[3].statusCode = 3;
  assert.deepEqual(play('breeder.calm', status).slots.map(c => c?.statusCode ?? null), [0, 0, null, 3, 0, 0]);
  // damage: +15 % dealt, -20 % taken, a marked foe +15 %, the next signature +25 % once
  const charge = play('commander.charge').cards;
  assert.deepEqual([charge.scaleDamage({attackerSlot: 0, defenderSlot: 3, damage: 100}), charge.scaleDamage({attackerSlot: 3, defenderSlot: 0, damage: 100})], [115, 100]);
  const cover = play('basic.cover').cards;
  assert.deepEqual([cover.scaleDamage({attackerSlot: 3, defenderSlot: 0, damage: 100}), cover.scaleDamage({attackerSlot: 0, defenderSlot: 3, damage: 100})], [80, 100]);
  const mark = play('hunter.weakMark').cards;
  assert.deepEqual([mark.scaleDamage({attackerSlot: 0, defenderSlot: 4, damage: 100}), mark.scaleDamage({attackerSlot: 0, defenderSlot: 3, damage: 100})], [115, 100]);
  const focus = play('basic.focus').cards;
  assert.deepEqual([focus.scaleDamage({attackerSlot: 0, defenderSlot: 3, damage: 100}), focus.scaleDamage({attackerSlot: 0, defenderSlot: 3, damage: 100, signature: true}),
    focus.scaleDamage({attackerSlot: 0, defenderSlot: 3, damage: 100, signature: true})], [100, 125, 100]);
  const crit = play('commander.critDrill').cards;
  assert.deepEqual([crit.critBonus(0), crit.critBonus(3)], [15, 0], 'never a negative bonus');
  const guts = play('breeder.guts').cards;
  assert.equal(guts.scaleDamage({attackerSlot: 3, defenderSlot: 1, damage: 500, defenderHp: 300}), 299);
  assert.equal(guts.scaleDamage({attackerSlot: 3, defenderSlot: 1, damage: 500, defenderHp: 299}), 500, 'once');
  // timed effects end
  const later = createBattleSkillCards({hand: ['commander.charge'], team: 0, teamOf});
  later.request('commander.charge', 700); later.step(701, field());
  later.step(701 + 8 * 60, field());
  assert.equal(later.scaleDamage({attackerSlot: 0, defenderSlot: 3, damage: 100}), 100, 'after 8 s');
  // regeneration: +2 % every 2 s for 10 s
  const regen = createBattleSkillCards({hand: ['breeder.vitality'], team: 0, teamOf}), slots = field();
  regen.request('breeder.vitality', 700); regen.step(700, slots);
  for (let frame = 701; frame <= 700 + 12 * 60; frame += 1) regen.step(frame, slots);
  assert.deepEqual(slots.map(c => c?.currentHp ?? null), [700, 400, null, 900, 200, 1000], 'five ticks of 20 HP on the local team');
  // the burst gauge card is paid by the runtime's burst module
  const awaken = createBattleSkillCards({hand: ['commander.awaken'], team: 0, teamOf});
  awaken.request('commander.awaken', 700);
  assert.equal(awaken.step(701, field()).burstGaugePercent, 25);
  // no hand: nothing at all
  const off = createBattleSkillCards();
  assert.deepEqual([off.on, off.request('basic.cheer', 900).reason, off.scaleDamage({attackerSlot: 0, defenderSlot: 3, damage: 100}), off.critBonus(0)], [false, 'NO_HAND', 100, 0]);
});

test('reward cards change nothing in the fight and are read by the settlement of a won match', () => {
  const cards = createBattleSkillCards({hand: ['trader.bounty', 'trader.sync', 'trader.probe'], team: 0, teamOf});
  const slots = field(), before = JSON.stringify(slots);
  cards.request('trader.bounty', 700); cards.step(701, slots);
  cards.request('trader.probe', 900); cards.step(901, slots);
  assert.equal(JSON.stringify(slots), before);
  assert.deepEqual(cards.rewards(), {bitsPercent: 20, syncPercent: 0, crystals: 30, ticketPercent: 0, played: ['trader.bounty', 'trader.probe']});
  assert.equal(getSkillCard('trader.lucky').amount, 30);
  const app = source('src/championship/app/championshipStandaloneApp.js');
  assert.match(app, /const cards=syncKind\?result\.skillCards:null,cardBits=cards\?\.bitsPercent>0\?Math\.floor\(purse\*cards\.bitsPercent\/100\):0;/);
  assert.match(app, /if\(cards\?\.crystals>0\)addSyncCrystals\(cards\.crystals\);/);
  assert.match(app, /if\(cards\?\.ticketPercent>0&&gachaRandom\(\)\*100<cards\.ticketPercent\)\{const grant=grantGachaTickets\(cyberGacha,1\);cyberGacha=grant\.state;\}/);
  assert.match(app, /cardPercent:result\.skillCards\?\.syncPercent\?\?0\}\);/);
  assert.match(app, /const syncBonus=talent\('syncExpPercent',battleTalents\(kind\)\)\+\(won\?Math\.max\(0,cardPercent\|0\):0\);/);
});

test('the runtime: opt-in per battle, effects after the native step, and the app draws no hand where it must not', () => {
  const runtime = source('src/championship/app/battleRuntime.js');
  assert.match(runtime, /let skillCards=createBattleSkillCards\(\);/);
  assert.match(runtime, /skillCards=createBattleSkillCards\(\{hand:Array\.isArray\(options\.skillCards\)\?options\.skillCards:\[\],team:localTeamIndex,teamOf:battleTeamOfSlot\}\);/);
  assert.match(runtime, /critBonus: taxonomy\.critBonus\(slot\) \+ skillCards\.critBonus\(slot\)/);
  assert.match(runtime, /const cardStep=skillCards\.step\(liveSession\.frame,liveSession\.slots\);/);
  assert.match(runtime, /if\(cardStep\.burstGaugePercent\)burst\.boostTeam\(localTeamIndex,cardStep\.burstGaugePercent\);/);
  assert.match(runtime, /getSkillCards\(\) \{ return session&&!session\.ended\?skillCards\.snapshot\(session\.frame\):null; \},/);
  assert.match(runtime, /\.\.\.\(skillCards\.on\?\{skillCards:skillCards\.rewards\(\)\}:\{\}\),/, 'no hand: the settlement is unchanged');
  const app = source('src/championship/app/championshipStandaloneApp.js');
  assert.match(app, /getBattleSkillHand\(mode\)\{\s+if\(!session\|\|tutorialBaseline\)return null;/);
  assert.match(source('src/championship/app/main.js'), /skillCards: app\?\.getBattleSkillHand\?\.\(options\.mode\) \?\? null, \.\.\.options \}\);/);
  assert.match(source('src/championship/battle/battleBurst.js'), /boostTeam\(team, percent\) \{/);
});

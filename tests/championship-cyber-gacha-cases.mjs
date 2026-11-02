import assert from 'node:assert/strict';
import test from 'node:test';
import {existsSync, readFileSync} from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY, createChampionshipModernSave} from '../src/championship/app/championshipStandaloneSave.js';
import {createFullQaSaveText} from '../scripts/lib/championshipFullQaSave.mjs';
import {GACHA_CHIPS, GACHA_METALS, GACHA_GOODS, GACHA_PITY_MAX, GACHA_WELCOME_TICKETS, normalizeCyberGacha, grantGachaWelcome,
  pullCyberGacha, claimGachaPity, autoFillSynthesizer, synthesizeGachaMetal, settleGachaBattleWin, spendGachaItem,
  takeArmedHuntChips, claimGachaReward, applyGachaBoost} from '../src/championship/gacha/cyberGacha.js';
import {getShopRecord} from '../src/championship/shop/shopCatalog.js';
import {CYBER_GACHA_ART} from '../src/championship/app/cyberGachaView.js';
import {GACHA_BITS_BAGS, GACHA_BITS_MACHINE_RATES, GACHA_PERSONALITY_COUNT, GACHA_PERSONALITY_CHOICES, gachaChipEffectLines,
  gachaChipTiming, disarmGachaItem} from '../src/championship/gacha/cyberGacha.js';
import {enhanceSummary} from '../src/championship/app/cyberGachaView.js';

// Cyber Gachapon, OWNER_APPROVED_ADAPTATION 2026-10-29: the Shop's third tab.

const read = path => JSON.parse(readFileSync(new URL(`../${path}`, import.meta.url), 'utf8'));
const seq = values => { let i = 0; return () => values[i++ % values.length]; };

test('eighteen plugin rows come back as stackable chips; metals and goods carry real art', () => {
  assert.equal(GACHA_CHIPS.length, 18);
  assert.deepEqual(GACHA_CHIPS.map(c => c.shopRecordIndex).sort((a, b) => a - b), Array.from({length: 18}, (_, i) => 53 + i));
  for (const chip of GACHA_CHIPS) assert.equal(getShopRecord(chip.shopRecordIndex).category, 'PLUGINS');
  assert.equal(GACHA_METALS.length, 12);
  for (const entry of [...GACHA_METALS, ...GACHA_GOODS]) {
    assert.match(entry.art, /\.webp$/);
    assert.ok(existsSync(new URL(`../${entry.art}`, import.meta.url)), entry.art);
  }
  for (const goods of GACHA_GOODS) assert.equal(getShopRecord(goods.shopRecordIndex).maxOwned, 99, goods.id);
  const art = [CYBER_GACHA_ART.machine, CYBER_GACHA_ART.crank, CYBER_GACHA_ART.ticket, CYBER_GACHA_ART.furnace,
    ...Object.values(CYBER_GACHA_ART.capsule).flatMap(c => [c.top, c.bottom])];
  for (const path of art) assert.ok(existsSync(new URL(`../${path}`, import.meta.url)), path);
});

test('the welcome grant is ten tickets once; the normalizer refuses unknown keys and ids', () => {
  const first = grantGachaWelcome(null);
  assert.equal(first.granted, GACHA_WELCOME_TICKETS);
  assert.equal(grantGachaWelcome(first.state).granted, 0);
  assert.throws(() => normalizeCyberGacha({version: 1, catalogKind: 'x'}), /UNKNOWN_CYBER_GACHA_KEY/);
  assert.throws(() => normalizeCyberGacha({version: 1, chips: {'chip:nope': 1}}), /UNKNOWN_GACHA_ITEM/);
  assert.throws(() => normalizeCyberGacha({version: 1, bloodlines: {'a': 'gold'}}), /INVALID_BLOODLINE/);
});

test('tickets are spent before diamonds and a ten-pull always holds an SR+ metal or an Ω chip', () => {
  const state = grantGachaWelcome(null).state;
  // All-R rolls: the tenth prize is replaced by the guarantee.
  const ten = pullCyberGacha(state, {machine: 'PREMIUM', count: 10, diamonds: 20000, random: seq([0.01])});
  assert.equal(ten.ok, true);
  assert.deepEqual(ten.charge, {tickets: 10, diamonds: 0, bits: 0});
  assert.equal(ten.state.tickets, 0);
  assert.equal(ten.prizes[9].guaranteed, true);
  assert.ok(ten.prizes[9].kind === 'METAL' || ten.prizes[9].id.includes('omega'));
  assert.equal(ten.state.pity, 10);
  const paid = pullCyberGacha(ten.state, {machine: 'PREMIUM', count: 1, diamonds: 300, random: Math.random});
  assert.deepEqual(paid.charge, {tickets: 0, diamonds: 300, bits: 0});
  assert.equal(pullCyberGacha(ten.state, {machine: 'PREMIUM', count: 10, diamonds: 2699, random: Math.random}).reason, 'INSUFFICIENT_FUNDS');
  assert.equal(pullCyberGacha(ten.state, {machine: 'PREMIUM', count: 1, diamonds: null, random: Math.random}).reason, 'NO_TICKETS');
});

test('the Bits machine charges 50,000 / 450,000 and pays shop goods', () => {
  const state = grantGachaWelcome(null).state;
  assert.equal(pullCyberGacha(state, {machine: 'BITS', count: 10, bits: 449_999, random: Math.random}).reason, 'INSUFFICIENT_FUNDS');
  const pull = pullCyberGacha(state, {machine: 'BITS', count: 10, bits: 450_000, random: seq([0.2, 0.5, 0.5])});
  assert.equal(pull.charge.bits, 450_000);
  assert.ok(pull.prizes.every(p => p.kind === 'GOODS' && Number.isSafeInteger(p.shopRecordIndex) && p.quantity > 0));
});

test('pity fills to 50 and opens one SSR/UR metal of the player\'s choice', () => {
  let state = grantGachaWelcome(null).state;
  assert.equal(claimGachaPity(state, 'metal:emma').reason, 'PITY_NOT_READY');
  state = normalizeCyberGacha({...state, pity: GACHA_PITY_MAX});
  assert.equal(claimGachaPity(state, 'metal:emma-shard').reason, 'NOT_SELECTABLE');
  const claim = claimGachaPity(state, 'metal:chrono-alloy');
  assert.equal(claim.ok, true);
  assert.equal(claim.state.pity, 0);
  assert.equal(claim.state.metals['metal:chrono-alloy'], 1);
});

test('the one-tap fill keeps one of each chip and never takes locked chips', () => {
  const state = normalizeCyberGacha({version: 1, chips: {'chip:hp': 4, 'chip:attack': 2, 'chip:speed': 1, 'chip:personality': 9, 'chip:core-omega': 9, 'chip:gravity': 2}});
  const fill = autoFillSynthesizer(state);
  assert.equal(fill.length, 5);
  assert.ok(!fill.includes('chip:speed') && !fill.includes('chip:personality') && !fill.includes('chip:core-omega'));
  assert.equal(fill.filter(id => id === 'chip:hp').length, 3);
  const smelt = synthesizeGachaMetal(state, fill, {random: seq([0.99, 0.1])});
  assert.equal(smelt.ok, true);
  assert.equal(smelt.prize.kind, 'METAL');
  assert.equal(smelt.state.chips['chip:hp'], 1);
  assert.equal(Object.values(smelt.state.metals).reduce((a, b) => a + b, 0), 1);
  assert.deepEqual(autoFillSynthesizer(normalizeCyberGacha({version: 1, chips: {'chip:hp': 2}})), []);
});

test('beacons multiply one win; hunt cartridges arm once; once-only rewards', () => {
  let state = normalizeCyberGacha({version: 1, chips: {'chip:bounty-gamma': 1, 'chip:chrono': 1}});
  state = spendGachaItem(state, 'chip:bounty-gamma').state;
  assert.equal(state.armed.bounty, 'chip:bounty-gamma');
  const win = settleGachaBattleWin(state, {bits: 1000, random: seq([0])});
  assert.equal(win.bonusBits, 2000);
  assert.equal(win.tickets, 1 + 3);
  assert.equal(win.state.armed.bounty, undefined);
  state = spendGachaItem(win.state, 'chip:chrono').state;
  const hunt = takeArmedHuntChips(state);
  assert.deepEqual(hunt.chips, ['chip:chrono']);
  assert.equal(hunt.state.armed.hunt, undefined);
  const story = claimGachaReward(hunt.state, 'story:chapter-1', 4);
  assert.equal(story.granted, 4);
  assert.equal(claimGachaReward(story.state, 'story:chapter-1', 4).granted, 0);
});

test('boosts write bounded persistent words and refill HP/TP', () => {
  const profile = {fields: {'058': 900, '050': 10, '05c': 80, '054': 0, '060': 995, '064': 50, '068': 50, '06c': 50, '020': 95, '010': 98, '018': 8}};
  const next = applyGachaBoost(profile, {all: 12, hp: 120, bond: 20, capacity: 2, personality: 1});
  assert.equal(next.fields['060'], 999);
  assert.equal(next.fields['058'], 1020);
  assert.equal(next.fields['050'], 1020);
  assert.equal(next.fields['020'], 100);
  assert.equal(next.fields['010'], 99);
  assert.equal(next.fields['018'], 0);
  assert.equal(profile.fields['060'], 995, 'input is not mutated');
});

function harness(random) {
  const data = new Map(), storage = {getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value), removeItem: key => data.delete(key)};
  const cages = read('docs/contracts/championship/raising-home-presentation.v1.json').cages;
  const make = (policy = null) => createChampionshipStandaloneApp({storage, locks: null, cages, playtestPolicy: policy,
    catalog: read('src/data/championship/catalogs/creature-species.r1.json'), gachaRandom: random,
    rngClock: () => ({hour: 13, minute: 20, second: 50}), now: () => '2026-10-29T00:00:00.000Z'});
  return {data, cages, make};
}

test('the app saves each pull, metal use and bloodline before showing it, and reloads them', async () => {
  const {data, cages, make} = harness(seq([0.01, 0.3, 0.6, 0.9]));
  const first = make();
  await first.newGame();
  first.save();
  const text = createFullQaSaveText(JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)), {cageIds: cages.map(e => e.cageId)});
  await first.dispose();
  data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, text);
  const app = make();
  await app.continueGame();
  try {
    assert.equal(app.getCyberGachaFrame().tickets, GACHA_WELCOME_TICKETS, 'an existing save gets the welcome tickets once');
    app.openShop();
    const pull = app.gachaPull('PREMIUM', 10);
    assert.equal(pull.ok, true, pull.reason);
    assert.equal(pull.prizes.length, 10);
    let saved = JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY));
    assert.equal(saved.progression.cyberGacha.tickets, 0);
    assert.equal(saved.progression.cyberGacha.welcome, true);
    assert.equal(saved.progression.cyberGacha.pity, 10);
    assert.equal(app.gachaPull('PREMIUM', 1).reason, 'NO_TICKETS', 'no playtest diamonds in this harness');

    const metal = app.getCyberGachaFrame().metals.find(m => m.owned > 0 && ['SSR', 'UR'].includes(m.rarity))
      ?? (() => { throw new Error('the guarantee should leave an SSR+ metal with these rolls'); })();
    const partner = app.getCyberGachaFrame().partners[0];
    const used = app.gachaUseItem(metal.id, partner.instanceId, {mode: 'ENHANCE'});
    assert.equal(used.ok, true, used.reason);
    assert.ok(used.after.attack > used.before.attack);
    assert.equal(app.getPartnerBloodline(partner.instanceId).family, metal.family);
    saved = JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY));
    assert.equal(saved.progression.cyberGacha.bloodlines[partner.instanceId], metal.family);
    assert.doesNotThrow(() => createChampionshipModernSave({...saved, raisingHomeSerialized: saved.raisingHome}));
  } finally { await app.dispose(); }

  const again = make();
  await again.continueGame();
  try {
    const frame = again.getCyberGachaFrame();
    assert.equal(frame.tickets, 0, 'the welcome grant is not repeated after it was saved');
    assert.ok(frame.partners.some(p => p.bloodline));
  } finally { await again.dispose(); }
});

// ---- Second pass (Owner 2026-10-29): no system emoji, one-tap physics machine,
// ten cards for ten pulls, warm filtered sounds, arcade armour keys. ----
const EMOJI = /\p{Extended_Pictographic}/u;
const source = path => readFileSync(new URL(`../${path}`, import.meta.url), 'utf8');

test('the gacha has no system emoji: views, icons, styles, item names, drops and every locale', async () => {
  for (const path of ['src/championship/app/cyberGachaView.js', 'src/championship/app/cyberGachaIcons.js',
    'src/championship/app/cyberGachaPhysics.js', 'src/championship/app/cyberGacha.css', 'src/championship/gacha/cyberGacha.js']) {
    const hits = source(path).split('\n').filter(line => EMOJI.test(line));
    assert.deepEqual(hits, [], path);
  }
  for (const entry of [...GACHA_CHIPS, ...GACHA_METALS, ...GACHA_GOODS]) assert.doesNotMatch(entry.name, EMOJI, entry.id);
  // The shop tab, the toolbar badge, the story reward and the battle / Data Arena drop lines.
  for (const [path, pattern] of [['src/championship/app/vs4Screens.js', /轉蛋|gacha/i], ['src/championship/app/main.js', /gacha|轉蛋/i],
    ['src/championship/app/vs5Screens.js', /gacha|轉蛋|賞金信標/i], ['src/championship/app/dataArenaScreen.js', /gacha/i]]) {
    const hits = source(path).split('\n').filter(line => pattern.test(line) && EMOJI.test(line));
    assert.deepEqual(hits, [], path);
  }
  for (const locale of ['en', 'ja', 'th', 'vi']) {
    const TEXT = (await import(`../src/championship/text/uiText.${locale}.js`))[`TEXT_${locale.toUpperCase()}`];
    const keys = ['轉蛋', '轉蛋機', '合成爐', '晶片背包', '王牌超頻＆進化金屬', '位元幣日常補給', '自動填入低階晶片', '開始熔煉合成',
      '十連狂轉結果', '確定收下', '再轉十次', '再抽一次', '數碼轉蛋券 ×{n}', '賞金信標加成 +{bits} 位元幣', '轉蛋券 +{n}', '保底',
      ...GACHA_CHIPS.map(chip => chip.name)];
    for (const key of keys) {
      assert.equal(typeof TEXT[key], 'string', `${locale}: ${key}`);
      assert.doesNotMatch(TEXT[key], EMOJI, `${locale}: ${key}`);
    }
    for (const key of Object.keys(TEXT)) if (/轉蛋|熔煉|晶片|把手/.test(key)) assert.doesNotMatch(key, EMOJI, `${locale} key ${key}`);
  }
});

test('a ten-pull deals ten cards in pull order, duplicates included', async () => {
  const {gachaRevealCards} = await import('../src/championship/app/cyberGachaView.js');
  const state = normalizeCyberGacha({version: 1, tickets: 10});
  const result = pullCyberGacha(state, {machine: 'PREMIUM', count: 10, random: seq([0.5, 0.01, 0.5, 0.01, 0.5, 0.01, 0.5, 0.01])});
  assert.equal(result.ok, true);
  assert.equal(result.prizes.length, 10);
  const cards = gachaRevealCards(result);
  assert.equal(cards.length, 10, 'never merged into fewer cards');
  assert.deepEqual(cards.map(card => card.index), [...Array(10).keys()]);
  assert.deepEqual(cards.map(card => card.id), result.prizes.map(prize => prize.id));
  const repeated = gachaRevealCards({prizes: Array.from({length: 10}, () => ({kind: 'METAL', id: 'metal:beta-shard', rarity: 'R', quantity: 1}))});
  assert.equal(repeated.length, 10, 'ten of the same metal are still ten cards');
  assert.equal(gachaRevealCards(null).length, 0);
});

test('the dome physics keeps sixteen capsules inside the glass, tumbles them and settles them again', async () => {
  const {GACHA_DOME, GACHA_CAPSULE_RADIUS: r, settleCapsules, simulateTumble, crankTurn} = await import('../src/championship/app/cyberGachaPhysics.js');
  const random = seq([0.13, 0.71, 0.42, 0.97, 0.05, 0.58, 0.33, 0.86, 0.21, 0.64]);
  const inside = ball => Math.hypot(ball.x - GACHA_DOME.cx, ball.y - GACHA_DOME.cy) <= GACHA_DOME.r - r + 1e-3
    && ball.y <= GACHA_DOME.floor - r + 1e-3 && ball.y >= GACHA_DOME.cap + r - 1e-3;
  const pile = settleCapsules(16, {random});
  assert.equal(pile.length, 16);
  assert.ok(pile.every(inside), 'the resting pile sits inside the dome');
  for (let i = 0; i < 16; i += 1) for (let j = i + 1; j < 16; j += 1) {
    assert.ok(Math.hypot(pile[i].x - pile[j].x, pile[i].y - pile[j].y) > 2 * r - 0.02, 'capsules do not sink into each other');
  }
  const tumble = simulateTumble(pile, {random});
  assert.equal(tumble.frames.length, Math.round(1.3 * 60) + 1, 'one frame per 1/60 s for 1.3 s');
  assert.ok(tumble.sinkIndex >= 0, 'one capsule sinks through the chute');
  for (const frame of tumble.frames) for (const [index, ball] of frame.entries()) if (ball.o > 0 && index !== tumble.sinkIndex) assert.ok(inside(ball));
  const highest = Math.min(...tumble.frames.flat().map(ball => ball.y));
  assert.ok(highest < Math.min(...pile.map(ball => ball.y)) - 0.05, 'the air jet throws the pile up into the dome');
  assert.ok(tumble.final.every(inside), 'and it settles back inside');
  const turn = crankTurn({degrees: 720, ms: 650});
  assert.equal(turn.frames.at(-1), 720);
  assert.equal(turn.ticks.length, 16, 'a ratchet click for every 45°');
  assert.deepEqual([...turn.ticks].sort((a, b) => a - b), turn.ticks);
});

test('every gacha sound is filtered: no raw square or saw, ratchet clicks land on the crank', async () => {
  const {ArcadeSound, ARCADE_CUES} = await import('../src/championship/app/ui/arcadeFx.js');
  const made = [];
  const param = () => ({value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}});
  const node = kind => {
    const entry = {kind, type: '', targets: [], frequency: param(), gain: param(), Q: param(),
      connect(target) { entry.targets.push(target); return target; }, start() {}, stop() {}};
    made.push(entry);
    return entry;
  };
  const context = {state: 'running', currentTime: 0, sampleRate: 8000, createOscillator: () => node('osc'), createGain: () => node('gain'),
    createBiquadFilter: () => node('filter'), createBufferSource: () => node('noise'),
    createBuffer: (channels, length) => { const data = new Float32Array(length); return {getChannelData: () => data}; }};
  const sound = new ArcadeSound(() => ({context, destination: {}}));
  const cues = ['gachaRatchet', 'gachaTumble', 'gachaDrop', 'gachaRattle', 'gachaCrack', 'gachaReveal', 'gachaCard', 'gachaSmelt', 'gachaSlot', 'gachaUse'];
  for (const cue of cues) {
    assert.equal(typeof ARCADE_CUES[cue], 'function', cue);
    made.length = 0;
    assert.equal(sound.play(cue, cue === 'gachaReveal' || cue === 'gachaCard' ? 'UR' : undefined), true, cue);
    const voices = made.filter(entry => entry.kind === 'osc' || entry.kind === 'noise');
    assert.ok(voices.length > 0, cue);
    for (const voice of voices) {
      assert.equal(voice.targets[0]?.kind, 'filter', `${cue}: every voice runs through a filter`);
      if (voice.kind === 'osc') assert.ok(['sine', 'triangle'].includes(voice.type), `${cue}: ${voice.type}`);
    }
  }
  const fx = source('src/championship/app/ui/arcadeFx.js');
  assert.match(fx, /case "gacha-crank": for \(const ms of event\.detail\?\.ticks/);
  assert.match(fx, /\[523\.25, 659\.25, 783\.99, 987\.77, 1046\.5\]/, 'the reveal is the C major-seventh arpeggio');
});

test('arcade armour keys, a whole tab badge and plates that read on any skin', () => {
  const css = source('src/championship/app/cyberGacha.css');
  assert.match(css, /\.cm-gacha-key \{[^}]*border: 3px solid var\(--g-ink\)[^}]*box-shadow: inset 0 3px 0 var\(--gk-hl\), 0 5px 0 var\(--g-ink\)/s);
  assert.match(css, /\.cm-gacha-key:active:not\(:disabled\) \{ transform: translateY\(3px\)/);
  assert.match(css, /transition: transform 40ms ease-out/);
  assert.match(css, /\.cm-gacha-key \{[^}]*white-space: nowrap/s, 'key labels never wrap into an orphan glyph');
  assert.match(css, /\.cm-vs2-shop__tab\[data-gacha-tickets\] \{ overflow: visible/);
  assert.match(css, /\.cm-vs2-shop__tabs\[data-gacha\] \{ padding-top: 10px; overflow: visible/);
  assert.match(css, /\.cm-gacha__plate \{[^}]*background: var\(--g-slate\); color: #dbeeff/s);
  assert.match(css, /\.cm-gacha__reveal \{[^}]*background: radial-gradient\(circle at 50% 35%, #1e2942 0%, #0b0e17 100%\)/s);
  assert.match(css, /padding-bottom: 88px/, 'lists scroll clear of the footer');
  const view = source('src/championship/app/cyberGachaView.js');
  assert.doesNotMatch(view, /requestAnimationFrame\(|getContext\(|new Application/, 'DOM and Web Animations only');
  assert.match(view, /duration: 420, delay, easing: "cubic-bezier\(\.34,1\.56,\.64,1\)"/);
  assert.match(view, /const delay = 55 \* index;/);
  assert.doesNotMatch(view, /crank-stage|順時針轉一整圈/, 'the drag-the-handle stage is gone: one tap turns the crank');
});

// ---- Third pass (Owner 2026-11-02): every effect spelled out from its own
// numbers, cartridges and beacons loaded before play and taken back out, coin
// prizes, the reshape chip's own pick, the Ω beacon's shard and the rare lure's
// partner. ----

test('every chip spells out its effect from its own numbers, in every locale', async () => {
  const lines = id => gachaChipEffectLines(GACHA_CHIPS.find(chip => chip.id === id));
  for (const chip of GACHA_CHIPS) assert.ok(gachaChipEffectLines(chip).length > 0, chip.id);
  assert.deepEqual(lines('chip:attack').map(line => [line.text, line.params?.n]), [['攻擊 +{n}', 8], ['HP／TP 回滿', undefined]]);
  assert.deepEqual(lines('chip:core-beta')[0], {text: '攻擊・防禦・智力・速度 +{n}', params: {n: 12}});
  assert.ok(lines('chip:core-beta').some(line => line.text === '最大 TP +{n}' && line.params.n === 24));
  assert.deepEqual(lines('chip:chrono'), [{text: '狩獵限時 +{n} 小時', params: {n: 2}}]);
  assert.deepEqual(lines('chip:gravity'), [{text: '野生拍檔移動速度 -{n}%', params: {n: 50}}]);
  assert.deepEqual(lines('chip:bounty-omega').map(line => [line.text, line.params.n]),
    [['位元幣獎金 ×{n}', 5], ['轉蛋券 +{n}', 5], ['隨機金屬碎片 ×{n}', 1]]);
  const keys = new Set([...GACHA_CHIPS.flatMap(chip => [...gachaChipEffectLines(chip).map(line => line.text), gachaChipTiming(chip)]),
    ...GACHA_BITS_BAGS.map(bag => bag.name), '附贈 {item} ×{n}', '補給已滿的部分換成 {bits} 位元幣', '已取回',
    '性格：{name}', '選擇新的性格', '請先選擇新的性格。', '拍檔已經是這個性格了。', '這個晶片沒有裝填。', '最大 HP', '最大 TP',
    '轉蛋卡匣', '誘餌引來：{name}', '賞金信標', '下一場勝利生效', '賞金信標掉落：{item}',
    '培育補給與狩獵道具 45%・R 晶片 27%・位元幣袋 20%・基礎進化金屬 7%・轉蛋券 1%']);
  for (const locale of ['en', 'ja', 'th', 'vi']) {
    const TEXT = (await import(`../src/championship/text/uiText.${locale}.js`))[`TEXT_${locale.toUpperCase()}`];
    for (const key of keys) {
      assert.equal(typeof TEXT[key], 'string', `${locale}: ${key}`);
      assert.doesNotMatch(TEXT[key], EMOJI, `${locale}: ${key}`);
      for (const param of key.match(/\{\w+\}/g) ?? []) assert.ok(TEXT[key].includes(param), `${locale}: ${key} keeps ${param}`);
    }
  }
});

test('the Bits machine pays coin bags and a ticket; its metal share stays R 6% and SR 1%', () => {
  const rate = slot => GACHA_BITS_MACHINE_RATES.find(([id]) => id === slot)[1];
  assert.ok(Math.abs(GACHA_BITS_MACHINE_RATES.reduce((sum, [, weight]) => sum + weight, 0) - 1) < 1e-9);
  assert.equal(rate('METAL_R'), 0.06);
  assert.equal(rate('METAL_SR'), 0.01);
  assert.equal(GACHA_BITS_BAGS.reduce((sum, bag) => sum + rate(bag.id), 0).toFixed(3), '0.200');
  const state = normalizeCyberGacha({version: 1});
  const pull = roll => pullCyberGacha(state, {machine: 'BITS', count: 1, bits: 50_000, random: seq([roll, 0.5])});
  assert.deepEqual(pull(0.8).prizes[0], {kind: 'BITS', id: 'bits:pouch', rarity: 'R', quantity: 1, bits: 30_000});
  assert.equal(pull(0.87).prizes[0].bits, 60_000);
  assert.equal(pull(0.97).prizes[0].bits, 150_000);
  assert.equal(pull(0.999).prizes[0].bits, 500_000);
  const ticket = pull(0.99);
  assert.equal(ticket.prizes[0].kind, 'TICKETS');
  assert.equal(ticket.state.tickets, 1, 'the ticket prize lands in the save');
  assert.equal(pull(0.93).prizes[0].kind, 'METAL');
  assert.equal(pull(0.2).prizes[0].kind, 'GOODS');
});

test('an R chip from the premium machine brings feed x5 or protein x1, alternating by pull position', () => {
  const ten = pullCyberGacha(normalizeCyberGacha({version: 1, tickets: 10}), {machine: 'PREMIUM', count: 10, random: seq([0.55])});
  const chips = ten.prizes.slice(0, 9);
  assert.ok(chips.every(prize => prize.kind === 'CHIP' && prize.rarity === 'R'));
  assert.deepEqual(chips.map(prize => [prize.bonus.id, prize.bonus.quantity, prize.bonus.shopRecordIndex]),
    Array.from({length: 9}, (_, i) => (i % 2 ? ['goods:protein', 1, 1] : ['goods:feed', 5, 0])));
  assert.equal(ten.prizes[9].guaranteed, true);
  assert.equal(ten.prizes[9].bonus, undefined);
});

test('the reshape chip writes the picked personality; loaded cartridges and beacons come back out', () => {
  const profile = {fields: {'058': 100, '050': 10, '05c': 40, '054': 0, '060': 50, '064': 50, '068': 50, '06c': 50, '020': 50, '010': 20, '018': 3}};
  assert.deepEqual([GACHA_PERSONALITY_COUNT, GACHA_PERSONALITY_CHOICES], [9, 8], 'the ninth (？？？) has no battle table and is never offered');
  assert.equal(applyGachaBoost(profile, {personality: 1, personalityIndex: 7}).fields['018'], 7);
  assert.equal(applyGachaBoost(profile, {personality: 1, personalityIndex: 8}).fields['018'], 7, 'a pick never lands on ？？？');
  assert.equal(applyGachaBoost(profile, {personality: 1}).fields['018'], 4, 'without a pick it still steps to the next one');
  let state = normalizeCyberGacha({version: 1, chips: {'chip:gravity': 1, 'chip:bounty-beta': 2}});
  state = spendGachaItem(spendGachaItem(state, 'chip:gravity').state, 'chip:bounty-beta').state;
  assert.deepEqual([state.chips['chip:gravity'], state.armed.hunt, state.armed.bounty], [undefined, ['chip:gravity'], 'chip:bounty-beta']);
  const hunt = disarmGachaItem(state, 'chip:gravity');
  assert.equal(hunt.ok, true);
  assert.deepEqual([hunt.state.chips['chip:gravity'], hunt.state.armed.hunt], [1, undefined]);
  const bounty = disarmGachaItem(hunt.state, 'chip:bounty-beta');
  assert.deepEqual([bounty.state.chips['chip:bounty-beta'], bounty.state.armed.bounty], [2, undefined]);
  assert.equal(disarmGachaItem(bounty.state, 'chip:bounty-beta').reason, 'NOT_ARMED');
  assert.equal(disarmGachaItem(bounty.state, 'chip:hp').reason, 'NOT_ARMED');
});

test('the Ω beacon also drops one random metal shard into the bag', () => {
  const state = spendGachaItem(normalizeCyberGacha({version: 1, chips: {'chip:bounty-omega': 1}}), 'chip:bounty-omega').state;
  const win = settleGachaBattleWin(state, {bits: 1000, random: seq([0, 0.5])});
  assert.equal(win.bonusBits, 4000);
  assert.equal(win.tickets, 1 + 5);
  assert.deepEqual(win.metals, ['metal:chrono-metal-shard']);
  assert.equal(win.state.metals['metal:chrono-metal-shard'], 1);
  assert.deepEqual(settleGachaBattleWin(normalizeCyberGacha({version: 1}), {bits: 1000, random: seq([0])}).metals, []);
});

test('the rare lure calls the field rarest candidate into a prepared entry, after the untouched native actors', async () => {
  const {prepareNativeHuntEntry, appendNativeRareLureActor} = await import('../src/championship/hunt/capture/nativeHuntEntryTransaction.js');
  const {resolveNativeHuntPoolSources} = await import('../src/championship/hunt/capture/nativeHuntSources.js');
  const app = harness(Math.random).make();
  await app.newGame();
  try {
    app.openGate(); app.selectGate(app.getGates().find(gate => gate.biomeId === 'Grass').gateId); app.confirmGate();
    const entry = prepareNativeHuntEntry({biomeId: app.getConfirmedGate().biomeId, clock: app.getCalendar(),
      rngSnapshot: app.getGameplayRngState(), persistentState: app.getHuntPersistentState()});
    const before = structuredClone(entry.encounter.actors);
    const lured = appendNativeRareLureActor(entry);
    assert.equal(lured.encounter.actors.length, before.length + 1);
    assert.deepEqual(lured.encounter.actors.slice(0, -1), before, 'the native actors are untouched');
    const added = lured.encounter.actors.at(-1);
    assert.equal(added.speciesIndex, lured.rareLure.speciesIndex);
    assert.equal(added.individual.fields['000'], added.speciesIndex);
    assert.equal(added.individual.fields['004'], before.length);
    // The lure reads the table the entry itself drew from, never a second lookup.
    const {candidateInput} = resolveNativeHuntPoolSources({...entry.scene, modifiers: entry.persistentState.modifiers});
    assert.deepEqual(entry.candidates, candidateInput.entries);
    const rows = entry.candidates.filter(row => row.weight > 0);
    assert.equal(rows.find(row => row.speciesIndex === added.speciesIndex).weight, Math.min(...rows.map(row => row.weight)));
    assert.equal(appendNativeRareLureActor({...entry, candidates: []}).encounter, entry.encounter, 'no table, no extra partner');
  } finally { await app.dispose(); }
});

async function qaApp(chips, random = Math.random) {
  const {data, cages, make} = harness(random);
  const first = make();
  await first.newGame();
  first.save();
  const save = JSON.parse(createFullQaSaveText(JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY)), {cageIds: cages.map(e => e.cageId)}));
  await first.dispose();
  save.progression.cyberGacha = {version: 1, welcome: true, chips};
  data.set(CHAMPIONSHIP_MODERN_SAVE_KEY, JSON.stringify(save));
  const app = make();
  await app.continueGame();
  return {app, saved: () => JSON.parse(data.get(CHAMPIONSHIP_MODERN_SAVE_KEY))};
}

test('the app loads and takes back cartridges, reshapes a personality and pays coin bags, saving each step', async () => {
  const {app, saved} = await qaApp({'chip:gravity': 1, 'chip:personality': 1, 'chip:bounty-alpha': 1}, seq([0.8]));
  try {
    const slots = kind => app.getGachaTacticalSlots(kind).map(slot => [slot.id, slot.owned, slot.armed]);
    assert.deepEqual(slots('HUNT'), [['chip:gravity', 1, false]]);
    assert.deepEqual(slots('BOUNTY'), [['chip:bounty-alpha', 1, false]]);
    assert.equal(app.gachaUseItem('chip:gravity').kind, 'ARMED');
    assert.deepEqual(slots('HUNT'), [['chip:gravity', 0, true]], 'a loaded cartridge stays listed');
    assert.deepEqual(saved().progression.cyberGacha.armed, {hunt: ['chip:gravity']});
    assert.equal(app.gachaDisarmItem('chip:gravity').kind, 'DISARMED');
    assert.equal(saved().progression.cyberGacha.chips['chip:gravity'], 1);
    assert.equal(saved().progression.cyberGacha.armed.hunt, undefined);
    assert.equal(app.gachaDisarmItem('chip:gravity').reason, 'NOT_ARMED');

    const partner = app.getCyberGachaFrame().partners[0];
    const from = partner.stats.personalityIndex, to = (from + 4) % GACHA_PERSONALITY_CHOICES;
    assert.equal(app.gachaReshapePersonality(partner.instanceId, GACHA_PERSONALITY_CHOICES).reason, 'CHOOSE_PERSONALITY');
    assert.equal(app.gachaReshapePersonality(partner.instanceId, from).reason, 'SAME_PERSONALITY');
    const reshaped = app.gachaReshapePersonality(partner.instanceId, to);
    assert.equal(reshaped.ok, true, reshaped.reason);
    assert.deepEqual([reshaped.before.personalityIndex, reshaped.after.personalityIndex], [from, to]);
    assert.match(enhanceSummary(reshaped), /^性格：/, 'the toast names the new personality');
    assert.equal(enhanceSummary({kind: 'ENHANCE', before: {attack: 1, defense: 1, wisdom: 1, speed: 1, maxHp: 10, maxTp: 4},
      after: {attack: 13, defense: 13, wisdom: 13, speed: 13, maxHp: 130, maxTp: 28}}), '全能力 +12・最大 HP +120', 'two parts at most');
    assert.equal(app.getCyberGachaFrame().partners[0].stats.personalityIndex, to);
    assert.equal(app.getCyberGachaFrame().chips.find(chip => chip.id === 'chip:personality').owned, 0);
    assert.equal(saved().progression.cyberGacha.chips['chip:personality'], undefined);

    app.openShop();
    const bits = app.getCyberGachaFrame().bits;
    const pull = app.gachaPull('BITS', 10);
    assert.equal(pull.ok, true, pull.reason);
    assert.ok(pull.prizes.every(prize => prize.kind === 'BITS' && prize.bits === 30_000 && prize.name === '位元幣小錢袋'));
    assert.equal(app.getCyberGachaFrame().bits, bits - 450_000 + 300_000);
    assert.equal(saved().shop.bits, bits - 150_000, 'the charge and the coins are one saved transaction');
  } finally { await app.dispose(); }
});

test('a loaded rare lure adds that partner to the live hunt, and the field knows its name', async () => {
  const {app} = await qaApp({'chip:rare-bait': 1});
  try {
    assert.equal(app.gachaUseItem('chip:rare-bait').kind, 'ARMED');
    app.openGate(); app.selectGate(app.getGates().find(gate => gate.biomeId === 'Grass').gateId); app.confirmGate();
    await app.beginHunt();
    assert.equal(app.getHuntEntryError(), null);
    const actors = app.getHuntRuntime().getNativeEntryState().encounter.actors;
    const added = actors.at(-1);
    assert.equal(added.individual.fields['004'], actors.length - 1);
    assert.equal(app.getHuntRareLure().speciesId, `species-${String(added.speciesIndex).padStart(3, '0')}`);
    assert.equal(app.getHuntRuntime().getWildCreatures().length, actors.length);
    assert.deepEqual(app.getHuntGachaBoosts(), ['chip:rare-bait']);
    assert.deepEqual(app.getGachaTacticalSlots('HUNT'), [], 'the cartridge was used up by this hunt');
  } finally { await app.dispose(); }
});

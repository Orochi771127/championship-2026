// RELAY kits fit each partner (Owner 2026-10-28 「配適合的屬性還有招式，就像不可能
// 草系會發飛彈」): a partner's element follows its own coloured moves, its kit
// opens with moves it already owns, and every other choice comes from its own
// element's pool. Generated files stay in sync with the generator.
import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

import kits from '../src/data/championship/data-arena-relay-kits.v1.json' with { type: 'json' };
import moves from '../src/data/championship/catalogs/battle-moves.r1.json' with { type: 'json' };
import { RELAY_ROSTER } from '../src/championship/modes/dataArena/dataArenaRelayRoster.js';
import { RELAY_LOADOUTS, RELAY_ACTION_PROFILES, relayKit, relayMove, relayEffectStyle } from '../src/championship/modes/dataArena/dataArenaRelay.js';
import { RELAY_EFFECT_TEXTURES } from '../src/championship/presentation/dataArena/dataArenaRelayEffects.js';
import themes from '../src/data/championship/move-vfx-themes.r1.json' with { type: 'json' };
import { ORIGINAL_FORM_STYLE, RELAY_ELEMENT_KITS, RELAY_POOL_MOVE_ELEMENT, RELAY_STYLE_RULES, relayOwnMoveInfo, relayOwnMoves } from '../src/championship/modes/dataArena/dataArenaRelayKits.js';
import { isPb324MoveId, pb324Move, pb324CanonicalElement } from '../src/championship/modes/dataArena/dataArenaPb324Catalog.js';
import { DATA_ARENA_PARTNERS } from '../src/championship/modes/dataArena/dataArenaConfig.js';
import { createDataArenaSimulation } from '../src/championship/modes/dataArena/dataArenaSimulation.js';

const run = (sim, seconds, input = {}) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) sim.step(input); };
const tournamentSpecies = new Set(DATA_ARENA_PARTNERS.map(p => p.speciesId));
const rosterPartners = RELAY_ROSTER.filter(p => !tournamentSpecies.has(p.speciesId));
const kitRow = new Map(kits.species.map(row => [row[0], row]));
const owner = new Map(moves.records.map(m => [m.recordIndex, m.speciesId]));

test('generated roster, move themes and kits are current', () => {
  const result = spawnSync(process.execPath, ['scripts/build-data-arena-relay-kits.mjs', '--check'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr || result.stdout);
});

test('every pool holds only its own element or element-neutral body moves', () => {
  for (const [element, pool] of Object.entries(RELAY_ELEMENT_KITS)) {
    assert.equal(pool.moves.length, 5, element);
    for (const id of pool.moves) assert.ok([element, 'neutral'].includes(RELAY_POOL_MOVE_ELEMENT[id]), `${element} pool carries ${id}`);
    assert.equal(RELAY_POOL_MOVE_ELEMENT[pool.ultimate], element);
    assert.ok(relayMove(pool.ultimate, true));
  }
});

// Owner 2026-11-26 (「原作對應每一隻的招式加回去」): a partner opens with its own
// original moves; only the slots left are filled from its element's PB-324 pool.
test('each roster partner opens with its own original moves, then its own element PB-324 pool', () => {
  assert.equal(kits.species.length, RELAY_ROSTER.length);
  let withOwn = 0;
  for (const partner of rosterPartners) {
    const options = RELAY_LOADOUTS[partner.id], own = relayOwnMoves(partner.speciesIndex);
    const expectedEl = pb324CanonicalElement(partner.element, partner.speciesIndex);
    assert.deepEqual(options.slice(0, own.skills.length), own.skills, `${partner.id} lists its own moves first`);
    assert.ok(options.length >= 12, `${partner.id} has a full skill pool (${options.length})`);
    for (const id of options.slice(own.skills.length)) {
      assert.ok(isPb324MoveId(id), `${partner.id} move ${id} is PB-324`);
      assert.equal(pb324Move(id).element, expectedEl, `${partner.id} (${expectedEl}) never receives off-element move ${id}`);
    }
    const kit = relayKit(partner.id);
    assert.equal(kit.moves.length, 3, `${partner.id} equips 3 skills`);
    assert.deepEqual(kit.moves.slice(0, Math.min(3, own.skills.length)), own.skills.slice(0, 3), `${partner.id} equips its own moves first`);
    for (const id of kit.moves.filter(id => !relayOwnMoveInfo(id))) assert.equal(pb324Move(id).element, expectedEl);
    if (own.ultimate) assert.equal(kit.ultimate, own.ultimate, `${partner.id} keeps its own ultimate`);
    else { assert.ok(isPb324MoveId(kit.ultimate)); assert.equal(pb324Move(kit.ultimate).element, expectedEl); }
    const ult = relayMove(kit.ultimate, true);
    assert.ok(ult?.type && ult.damage !== 0, `${partner.id} ultimate ${kit.ultimate} resolves`);
    if (relayOwnMoveInfo(kit.ultimate)) assert.equal(ult.type, relayMove(kit.ultimate).type, `${partner.id} own ultimate keeps its own shape`);
    if (own.skills.length || own.ultimate) withOwn++;
  }
  assert.ok(withOwn >= rosterPartners.length - 5, `${withOwn}/${rosterPartners.length} partners carry own moves`);
});

test('plant partners never fire ordnance and no pool lends a missile to another element', () => {
  for (const partner of rosterPartners.filter(p => p.element === 'nature'))
    for (const id of RELAY_LOADOUTS[partner.id]) assert.ok(!['missile', 'gatling'].includes(relayOwnMoveInfo(id)?.style), `${partner.id} ${id}`);
  for (const [element, pool] of Object.entries(RELAY_ELEMENT_KITS)) if (element !== 'physical') assert.ok(!pool.moves.includes('impactShot'), element);
});

test('element follows the partner\'s own coloured moves; Tournament partners keep their kits', () => {
  const element = index => RELAY_ROSTER.find(p => p.speciesIndex === index).element;
  // 花刺皇后 thorns, 曦炎巨鳥 flame, 地嘯暴龍 earth, 綻光花風妖精 flower cannons, 菌冠菇獸 spores.
  assert.equal(element(106), 'nature'); assert.equal(element(110), 'fire'); assert.equal(element(181), 'earth');
  assert.equal(element(175), 'nature'); assert.equal(element(60), 'nature');
  assert.equal(element(34), 'fire'); assert.equal(element(61), 'frost'); assert.equal(element(64), 'light');
  assert.ok(RELAY_LOADOUTS['frost-drake'].length >= 12 && RELAY_LOADOUTS['frost-drake'].every(id => pb324Move(id)?.element === 'ICE'));
});

test('own moves take their mechanic from the style and side effects from the colour, never from stage', () => {
  const byStyle = new Map();
  for (const row of kits.species) for (const [record, style, palette, , ultimate] of row[2]) {
    if (ultimate === 1) continue; // an own ultimate fights with its pool ultimate's numbers (tested above)
    const rule = relayMove(`own-${record}`), plain = RELAY_STYLE_RULES[ORIGINAL_FORM_STYLE[record] ?? style];
    assert.equal(rule.type, plain.type, `own-${record}`);
    assert.equal(rule.damage, plain.damage, `own-${record} damage must not scale with stage`);
    if (palette === 'fire' && ['BOLT', 'SPREAD'].includes(rule.type)) assert.equal(rule.onTerrain, 'IGNITE');
    if (palette === 'ice' && ['BOLT', 'SPREAD'].includes(rule.type)) assert.equal(rule.onTerrain, 'FREEZE');
    if (!['fire', 'ice'].includes(palette)) assert.equal(rule.onTerrain, undefined, `own-${record}`);
    byStyle.set(style, (byStyle.get(style) ?? 0) + 1);
    assert.ok(relayEffectStyle(`own-${record}`).tint > 0);
  }
  assert.ok(byStyle.size >= 18, `only ${byStyle.size} styles in use`);
});

test('stage two looks: every kit move draws as an approved style with a real texture; basics follow the caster', () => {
  // throw / lob: the original body effect's thrown weapon or bomb (ORIGINAL_MOVES_ARENA_20261126).
  const styles = new Set([...themes.styles, 'throw', 'lob']);
  for (const partner of RELAY_ROSTER) {
    const ids = [RELAY_ACTION_PROFILES[partner.id].basic, ...RELAY_LOADOUTS[partner.id], relayKit(partner.id).ultimate];
    for (const id of ids) {
      const look = relayEffectStyle(id, partner.element);
      assert.ok(styles.has(look.style), `${partner.id} ${id} style ${look.style}`);
      assert.ok(RELAY_EFFECT_TEXTURES.includes(look.texture), `${partner.id} ${id} texture ${look.texture}`);
    }
    // A fire jaw breathes fire and a plant one seeds; only frost partners breathe frost.
    const basic = relayEffectStyle(RELAY_ACTION_PROFILES[partner.id].basic, partner.element);
    if (['relayBreath', 'relayShot', 'relayRay'].includes(RELAY_ACTION_PROFILES[partner.id].basic) && partner.element !== 'frost') assert.notEqual(basic.style, 'ice', partner.id);
  }
  // Name wins where the original bank contradicts it (Owner 2026-10-28).
  const theme = new Map(themes.moves.map(row => [row[0], row]));
  assert.deepEqual(theme.get(128).slice(1, 3), ['ice', 'ice']);
  assert.deepEqual(theme.get(558).slice(1, 3), ['beam', 'ice']);
  assert.deepEqual(theme.get(585).slice(1, 3), ['holy', 'fire']);
});

test('a partner casts each of its own moves in a real relay match', () => {
  for (const index of [106, 138, 175, 211]) {
    const partner = RELAY_ROSTER.find(p => p.speciesIndex === index);
    for (const id of RELAY_LOADOUTS[partner.id].filter(m => relayOwnMoveInfo(m))) {
      const sim = createDataArenaSimulation({ mode: 'RELAY', partnerId: partner.id, relayLoadouts: { [partner.id]: [id] }, seed: 23 });
      run(sim, 2.1); sim.drainEvents(); sim.step({ cast: 0, autoAim: true }); run(sim, 0.8);
      assert.ok(sim.drainEvents().some(e => e.type === 'CAST_RELEASE' && e.moveId === id), `${partner.id} ${id}`);
    }
  }
});

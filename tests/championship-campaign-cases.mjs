import assert from 'node:assert/strict';
import test from 'node:test';
import {
  CAMPAIGN_ZONES, CAMPAIGN_STAGES, CAMPAIGN_DAILY_SWEEPS, campaignRivals, campaignStars, campaignRewards, normalizeCampaign,
  recordCampaignStage, sweepCampaignStage, sweepsLeft, stageOpen, starsOf, zoneStars, totalStars
} from '../src/championship/contracts/productCampaign.js';
import { RELAY_MAP_IDS } from '../src/championship/modes/dataArena/dataArenaRelayMaps.js';
import { DATA_ARENA_KITS } from '../src/championship/modes/dataArena/dataArenaConfig.js';
import { journeyProgress, normalizeJourney } from '../src/championship/contracts/productJourney.js';
import { createDataArenaSimulation } from '../src/championship/modes/dataArena/dataArenaSimulation.js';
import { DATA_ARENA_UPGRADES } from '../src/championship/modes/dataArena/dataArenaUpgrades.js';

test('six zones on six existing relay fields, each with its brief bosses', () => {
  assert.equal(CAMPAIGN_ZONES.length, 6);
  assert.equal(new Set(CAMPAIGN_ZONES.map(z => z.field)).size, 6);
  for (const zone of CAMPAIGN_ZONES) assert.ok(RELAY_MAP_IDS.includes(zone.field), zone.field);
  assert.deepEqual(CAMPAIGN_ZONES.map(z => [z.midBoss, z.boss]), [[106, 145], [47, 166], [113, 96], [73, 183], [181, 180], [173, 222]]);
});

test('every stage fights two guards then its lead, with kits the relay AI drives, harder further in', () => {
  let previous = 0;
  for (const zone of CAMPAIGN_ZONES) for (let stage = 1; stage <= CAMPAIGN_STAGES; stage++) {
    const rivals = campaignRivals(zone.zone, stage);
    assert.equal(rivals.length, 3);
    assert.ok(rivals.every(r => DATA_ARENA_KITS[r.kit] && /^species-\d{3}$/.test(r.speciesId) && r.hp > 0));
    assert.equal(new Set(rivals.map(r => r.id)).size, 3);
    if (stage === 3) assert.equal(rivals[2].speciesId, `species-${String(zone.midBoss).padStart(3, '0')}`);
    if (stage === 6) assert.equal(rivals[2].speciesId, `species-${String(zone.boss).padStart(3, '0')}`);
    assert.equal(rivals[2].champion, stage === 3 || stage === 6);
    assert.ok(rivals[0].hp >= previous * 0.9, `zone ${zone.zone} stage ${stage} does not get easier`);
    previous = rivals[0].hp;
    assert.deepEqual(campaignRivals(zone.zone, stage), rivals);
  }
});

test('stars: clear, within 90 seconds, nobody knocked out', () => {
  assert.equal(campaignStars({ outcome: 'DEFEAT', timeSeconds: 20, fainted: 0 }), 0);
  assert.equal(campaignStars({ outcome: 'VICTORY', timeSeconds: 120, fainted: 1 }), 1);
  assert.equal(campaignStars({ outcome: 'VICTORY', timeSeconds: 90, fainted: 1 }), 2);
  assert.equal(campaignStars({ outcome: 'VICTORY', timeSeconds: 120, fainted: 0 }), 2);
  assert.equal(campaignStars({ outcome: 'VICTORY', timeSeconds: 60, fainted: 0 }), 3);
});

test('stages open in order across zones; stars only rise; the first clear pays once', () => {
  let campaign = normalizeCampaign(null);
  assert.equal(stageOpen(campaign, 1, 1), true);
  assert.equal(stageOpen(campaign, 1, 2), false);
  assert.equal(stageOpen(campaign, 2, 1), false);
  assert.equal(recordCampaignStage(campaign, 1, 2, 3).firstClear, null, 'a locked stage records nothing');
  let step = recordCampaignStage(campaign, 1, 1, 1);
  assert.deepEqual({ ...step.firstClear }, { ...campaignRewards(1, 1) });
  campaign = step.campaign;
  step = recordCampaignStage(campaign, 1, 1, 3);
  assert.equal(step.firstClear, null, 'a better replay does not pay the first-clear prize again');
  assert.equal(starsOf(step.campaign, 1, 1), 3);
  assert.equal(starsOf(recordCampaignStage(step.campaign, 1, 1, 1).campaign, 1, 1), 3, 'stars never drop');
  assert.equal(stageOpen(step.campaign, 1, 2), true);
});

test('a zone chest opens once at 18 stars, and the next zone opens after its boss', () => {
  let campaign = normalizeCampaign(null), chests = 0;
  for (let stage = 1; stage <= 6; stage++) {
    const step = recordCampaignStage(campaign, 1, stage, 3);
    campaign = step.campaign; if (step.chest) chests++;
  }
  assert.equal(zoneStars(campaign, 1), 18);
  assert.equal(chests, 1);
  assert.deepEqual(campaign.chests, [1]);
  assert.equal(recordCampaignStage(campaign, 1, 6, 3).chest, null);
  assert.equal(stageOpen(campaign, 2, 1), true);
  assert.equal(totalStars(campaign), 18);
  // Half the stars add to the patrol pod's progress.
  assert.equal(journeyProgress(normalizeJourney({ version: 1, tower: { best: 4 }, campaign })), 4 + 9);
});

test('three-star stages sweep for crystals, ten a day', () => {
  let campaign = recordCampaignStage(null, 1, 1, 2).campaign;
  assert.equal(sweepCampaignStage(campaign, 1, 1, '2026-11-10'), null, 'needs three stars');
  campaign = recordCampaignStage(campaign, 1, 1, 3).campaign;
  for (let i = 0; i < CAMPAIGN_DAILY_SWEEPS; i++) {
    const sweep = sweepCampaignStage(campaign, 1, 1, '2026-11-10');
    assert.equal(sweep.crystals, campaignRewards(1, 1).sweepCrystals);
    campaign = sweep.campaign;
  }
  assert.equal(sweepCampaignStage(campaign, 1, 1, '2026-11-10'), null);
  assert.equal(sweepsLeft(campaign, '2026-11-10'), 0);
  assert.equal(sweepsLeft(campaign, '2026-11-11'), CAMPAIGN_DAILY_SWEEPS);
  assert.ok(sweepCampaignStage(campaign, 1, 1, '2026-11-11'));
});

test('a zone stage relay fights its own rivals, offers relay buffs between waves and reports knockouts', () => {
  const rivals = campaignRivals(2, 6);
  const sim = createDataArenaSimulation({ mode: 'RELAY', partnerId: 'corona-cub', seed: 7, relayArenaId: CAMPAIGN_ZONES[1].field, relayRivals: rivals, relayBuffPicks: true });
  const run = (seconds) => { for (let i = 0; i < Math.ceil(seconds * 60); i++) sim.step({}); };
  run(2.2);
  const state = sim.getState();
  assert.deepEqual(state.relay.rivals.map(r => r.speciesId), rivals.map(r => r.speciesId));
  assert.equal(state.relay.rivals[2].maxHp, Math.round(rivals[2].hp * 0.55), 'the relay scales the stage HP like its own rivals');
  const relayOnly = new Set(['skillAmp', 'coolingChip', 'swiftStep', 'phaseDash', 'patch', ...DATA_ARENA_UPGRADES.filter(u => u.modes?.includes('RELAY')).map(u => u.id)]);
  for (let wave = 0; wave < 2; wave++) {
    state.rivals[0].hp = 0;
    run(1.4);
    assert.equal(state.mode, 'LEVEL_UP', `wave ${wave + 1} ends in a buff pick`);
    assert.equal(state.offer.length, 3);
    assert.ok(state.offer.every(id => relayOnly.has(id)), state.offer.join());
    assert.equal(sim.choose(state.offer[0]), true);
    assert.equal(state.mode, 'PLAY');
    assert.equal(state.relay.enemyIndex, wave + 1);
  }
  state.rivals[0].hp = 0;
  run(4);
  assert.equal(state.result.outcome, 'VICTORY');
  assert.equal(state.result.relayFainted, 0);
  assert.equal(campaignStars({ outcome: state.result.outcome, timeSeconds: state.result.timeSeconds, fainted: state.result.relayFainted }), 3);
});

test('without a zone stage the relay keeps its own rivals and never pauses for buffs', () => {
  const sim = createDataArenaSimulation({ mode: 'RELAY', partnerId: 'corona-cub', seed: 7 });
  for (let i = 0; i < 140; i++) sim.step({});
  const state = sim.getState();
  assert.deepEqual(state.relay.rivals.map(r => r.definitionId), ['tide', 'flame', 'storm']);
  state.rivals[0].hp = 0;
  for (let i = 0; i < 90; i++) sim.step({});
  assert.equal(state.mode, 'PLAY');
  assert.equal(state.relay.enemyIndex, 1);
});

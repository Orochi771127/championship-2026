import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateNativeFreeBattleMenu,listNativeFreeBattleMatches,freeBattlePreset,freeBattlePayout} from '../src/championship/battle/nativeFreeBattle.js';
import {settleOwnedBattleIndividual} from '../src/championship/battle/battleParty.js';
const cpu=JSON.parse(readFileSync(new URL('../docs/research/FREE_BATTLE_CPU_2026-09-14.json',import.meta.url),'utf8'));
test('all 108 original Free Battle individual settlements preserve the distinct one-point gain',()=>{
  const results=JSON.parse(readFileSync(new URL('../docs/research/BATTLE_FREE_PARTY_RESULT_CPU_2026-09-14.json',import.meta.url),'utf8')).results;
  for(const v of results)assert.deepEqual(settleOwnedBattleIndividual({fields:v.input.fields,narrowFields:{'044':4,'046':22}},
    {...v.input,currentHp:v.input.fields['050'],metricLimit:v.input.fields['054']}),v.output);
});
test('all 48 original daily Free Battle draws preserve order, duplicates, filtering and shared channel consumption',()=>{
  for(const v of cpu.vectors){
    let cursor=0;const actual=generateNativeFreeBattleMenu({season:v.season,nextChannel:channel=>{assert.equal(channel,0);return v.randomValues[cursor++];}});
    assert.deepEqual(actual,{singles:v.singles,teams:v.teams},`season ${v.season}, seed ${v.seed}`);
    assert.equal(cursor,v.randomValues.length);
    const matches=listNativeFreeBattleMatches(actual);assert.equal(matches.length,v.singles.length+v.teams.length);
    for(const match of matches){assert.equal(match.slots,match.presetIndices.length);assert.equal(match.entryFee,0);
      assert.equal(match.payout,freeBattlePayout(match.presetIndices));for(const id of match.presetIndices)assert.ok(freeBattlePreset(id).field00<228);}
  }
});

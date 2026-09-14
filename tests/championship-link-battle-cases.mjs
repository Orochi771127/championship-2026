import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {createNativeHuntIndividual} from '../src/championship/hunt/capture/nativeHuntIndividual.js';
import {nativeHuntSpeciesByIndex} from '../src/championship/hunt/capture/nativeHuntSources.js';
import {nativeIndividualProfile} from '../src/championship/raising/nativeIndividualProfile.js';
import {createNativeLinkInvite,readNativeLinkInvite,createNativeLinkReply,readNativeLinkReply,
  createNativeLinkBattleRng,NATIVE_LINK_ARENAS,NATIVE_LINK_BATTLE_MASTER_SEED} from '../src/championship/battle/nativeLinkBattle.js';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {createBattleRuntime} from '../src/championship/app/battleRuntime.js';

const individual=(species,index)=>({instanceId:`owned-${index}`,nativeProfile:nativeIndividualProfile(
  createNativeHuntIndividual({species:nativeHuntSpeciesByIndex(species),rng:{next:channel=>(index*17+channel)%103},nameOverride:`獸${index}`}))});

test('Link invite and reply preserve original individual fields and host arena',()=>{
  const host=[individual(34,1),individual(72,2)],guest=[individual(85,3)];
  const invite=createNativeLinkInvite({individuals:host,arenaIndex:7});
  assert.equal(readNativeLinkInvite(invite.code).hostIndividuals.length,2);
  const reply=createNativeLinkReply({inviteCode:invite.code,individuals:guest});
  const session=readNativeLinkReply(invite.code,reply.code);
  assert.equal(session.arenaIndex,7);
  assert.deepEqual(session.hostIndividuals.map(entry=>entry.nativeProfile),host.map(entry=>entry.nativeProfile));
  assert.deepEqual(session.guestIndividuals.map(entry=>entry.nativeProfile),guest.map(entry=>entry.nativeProfile));
  assert.equal(new Set([...session.hostIndividuals,...session.guestIndividuals].map(entry=>entry.instanceId)).size,3);
});

test('Link codes reject corruption, wrong replies and invalid team or arena',()=>{
  const host=[individual(34,1)],guest=[individual(72,2)];
  const one=createNativeLinkInvite({individuals:host,arenaIndex:0}),two=createNativeLinkInvite({individuals:host,arenaIndex:1});
  const reply=createNativeLinkReply({inviteCode:one.code,individuals:guest});
  assert.throws(()=>readNativeLinkInvite(`${one.code.slice(0,-1)}A`),/LINK_BATTLE_CODE_CHECKSUM/);
  assert.throws(()=>readNativeLinkReply(two.code,reply.code),/LINK_BATTLE_REPLY_FOR_DIFFERENT_INVITE/);
  assert.throws(()=>createNativeLinkInvite({individuals:[],arenaIndex:0}),/LINK_BATTLE_TEAM_SIZE/);
  assert.throws(()=>createNativeLinkInvite({individuals:host,arenaIndex:6}),/LINK_BATTLE_ARENA/);
});

test('Link battle uses the original fixed master seed and seven arenas',()=>{
  assert.deepEqual(NATIVE_LINK_ARENAS,[0,1,2,3,4,5,7]);assert.equal(NATIVE_LINK_BATTLE_MASTER_SEED,0x14);
  assert.deepEqual(createNativeLinkBattleRng().snapshot(),createNativeLinkBattleRng().snapshot());
});

const read=path=>JSON.parse(readFileSync(new URL(`../${path}`,import.meta.url),'utf8'));
async function ownedApp(index){
  const data=new Map(),storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
  const app=createChampionshipStandaloneApp({storage,catalog:read('src/data/championship/catalogs/creature-species.r1.json'),
    cages:read('docs/contracts/championship/raising-home-presentation.v1.json').cages,rngClock:()=>({hour:13,minute:20,second:50})});
  await app.newGame();app.save();const key=[...data.keys()][0],save=JSON.parse(data.get(key)),profile=individual(index===0?34:72,index+4).nativeProfile;
  save.creature.nativeProfile=profile;save.creature.speciesId=`species-${String(profile.fields['000']).padStart(3,'0')}`;
  data.set(key,JSON.stringify(save));await app.continueGame();app.openBattle();return app;
}

test('two apps exchange Link teams, run one canonical battle and persist no Link result',async()=>{
  const host=await ownedApp(0),guest=await ownedApp(1);let hostRuntime,guestRuntime;
  try{
    const hostId=host.getRaisingInstances()[0].instanceId,guestId=guest.getRaisingInstances()[0].instanceId;
    const hostProfile=structuredClone(host.getCreature().nativeProfile),guestProfile=structuredClone(guest.getCreature().nativeProfile);
    const hostRecord=structuredClone(host.getTitleProgress().record),guestRecord=structuredClone(guest.getTitleProgress().record);
    const invitation=await host.createLinkBattleInvite([hostId]);assert.equal(invitation.ok,true,invitation.message);
    const guestPrepared=await guest.prepareLinkBattle({role:'GUEST',inviteCode:invitation.inviteCode,instanceIds:[guestId]});
    assert.equal(guestPrepared.ok,true,guestPrepared.message);assert.equal(guestPrepared.localTeamIndex,1);
    const hostPrepared=await host.prepareLinkBattle({role:'HOST',inviteCode:invitation.inviteCode,replyCode:guestPrepared.replyCode});
    assert.equal(hostPrepared.ok,true,hostPrepared.message);assert.equal(hostPrepared.localTeamIndex,0);
    assert.deepEqual(hostPrepared.parties.map(team=>team.map(entry=>entry.nativeProfile)),guestPrepared.parties.map(team=>team.map(entry=>entry.nativeProfile)));
    hostRuntime=createBattleRuntime({mode:3,battleType:0,playerIndividuals:hostPrepared.parties[0],opponentIndividuals:hostPrepared.parties[1],localTeamIndex:0,rng:hostPrepared.rngPreparation.rng});
    guestRuntime=createBattleRuntime({mode:3,battleType:0,playerIndividuals:guestPrepared.parties[0],opponentIndividuals:guestPrepared.parties[1],localTeamIndex:1,rng:guestPrepared.rngPreparation.rng});
    for(const [runtime,prepared] of [[hostRuntime,hostPrepared],[guestRuntime,guestPrepared]]){runtime.chooseLinkBattle({arenaIndex:prepared.arenaIndex});runtime.startMatch();}
    const hostEntry=host.enterLinkBattle({linkKey:hostPrepared.linkKey,rngPreparation:hostPrepared.rngPreparation});assert.equal(hostEntry.ok,true,hostEntry.reason);
    const guestEntry=guest.enterLinkBattle({linkKey:guestPrepared.linkKey,rngPreparation:guestPrepared.rngPreparation});assert.equal(guestEntry.ok,true,guestEntry.reason);
    const hostSource=hostRuntime.startMatch(),guestSource=guestRuntime.startMatch();
    for(let tick=0;tick<30000&&!hostSource.getView().outcome.ended;tick++){hostSource.tick();guestSource.tick();}
    assert.deepEqual(hostSource.getView().outcome,guestSource.getView().outcome,'both devices simulate the same canonical host-first battle');
    assert.equal(hostRuntime.outcome().winningTeam,1-guestRuntime.outcome().winningTeam);
    const hostResult=hostRuntime.getSettlementResult(),guestResult=guestRuntime.getSettlementResult();
    assert.equal(hostResult.individualResults,undefined);assert.equal(guestResult.individualResults,undefined);
    assert.notEqual(hostResult.outcomeEntries[0],guestResult.outcomeEntries[0]);
    assert.equal(host.finishMatch({...hostResult,attemptId:hostEntry.attempt.attemptId}).ok,true);
    assert.equal(guest.finishMatch({...guestResult,attemptId:guestEntry.attempt.attemptId}).ok,true);
    assert.deepEqual(host.getCreature().nativeProfile,hostProfile);assert.deepEqual(guest.getCreature().nativeProfile,guestProfile);
    assert.deepEqual(host.getTitleProgress().record,hostRecord);assert.deepEqual(guest.getTitleProgress().record,guestRecord);
  }finally{hostRuntime?.dispose();guestRuntime?.dispose();await host.dispose();await guest.dispose();}
});

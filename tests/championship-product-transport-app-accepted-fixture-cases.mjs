// Approved synthetic QA save/catalog only. Separate in-memory storage per app;
// no real localStorage/sessionStorage, source readiness edits or live saves.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {registerHooks} from 'node:module';
registerHooks({load(url,context,next){
 const result=next(url,context);
 for(const [suffix,file] of [['/product-species-extensions.r1.json','alternate-form-product-catalog.json'],['/alternate-form-assets.r1.json','alternate-form-asset-catalog.json']]){
  if(url.endsWith(suffix))return {...result,source:fs.readFileSync(new URL(`../qa/${file}`,import.meta.url))};
 }
 return result;
}});
const {createChampionshipStandaloneApp}=await import('../src/championship/app/championshipStandaloneApp.js');
const {CHAMPIONSHIP_MODERN_SAVE_KEY}=await import('../src/championship/app/championshipStandaloneSave.js');
const {createBattleRuntime}=await import('../src/championship/app/battleRuntime.js');
const read=path=>JSON.parse(fs.readFileSync(new URL(`../${path}`,import.meta.url),'utf8'));
async function ownedApp(species){
 const data=new Map([[CHAMPIONSHIP_MODERN_SAVE_KEY,fs.readFileSync(new URL('../qa/alternate-form-save.json',import.meta.url),'utf8')]]);
 const storage={getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value),removeItem:key=>data.delete(key)};
 const app=createChampionshipStandaloneApp({storage,locks:null,catalog:read('src/data/championship/catalogs/creature-species.r1.json'),
  cages:read('docs/contracts/championship/raising-home-presentation.v1.json').cages,rngClock:()=>({hour:13,minute:20,second:50})});
 await app.continueGame();app.openBattle();
 const id=app.getRaisingInstances().find(entry=>entry.speciesId===`species-${species}`)?.instanceId;assert.ok(id);
 return {app,id,data};
}
test('two actual apps exchange229/230 v2 Link codes, finish the same battle and preserve owned profiles/records',async()=>{
 const host=await ownedApp(229),guest=await ownedApp(230);let hostRuntime,guestRuntime;
 try{
  const hostBefore=structuredClone((await host.app.prepareBattleParty(null,[host.id])).individuals[0].nativeProfile);
  const guestBefore=structuredClone((await guest.app.prepareBattleParty(null,[guest.id])).individuals[0].nativeProfile);
  const hostRecord=structuredClone(host.app.getTitleProgress().record),guestRecord=structuredClone(guest.app.getTitleProgress().record);
  const invite=await host.app.createLinkBattleInvite([host.id]);assert.equal(invite.ok,true,invite.reason);assert.match(invite.inviteCode,/^CM26-LINK-2\./);
  const gp=await guest.app.prepareLinkBattle({role:'GUEST',inviteCode:invite.inviteCode,instanceIds:[guest.id]});assert.equal(gp.ok,true,gp.reason);
  const hp=await host.app.prepareLinkBattle({role:'HOST',inviteCode:invite.inviteCode,replyCode:gp.replyCode});assert.equal(hp.ok,true,hp.reason);
  assert.deepEqual(hp.parties.map(p=>p.map(e=>e.nativeProfile.fields['000'])),[[229],[230]]);
  assert.deepEqual(hp.parties.map(p=>p.map(e=>e.nativeProfile)),gp.parties.map(p=>p.map(e=>e.nativeProfile)));
  hostRuntime=createBattleRuntime({mode:3,battleType:0,playerIndividuals:hp.parties[0],opponentIndividuals:hp.parties[1],localTeamIndex:0,rng:hp.rngPreparation.rng});
  guestRuntime=createBattleRuntime({mode:3,battleType:0,playerIndividuals:gp.parties[0],opponentIndividuals:gp.parties[1],localTeamIndex:1,rng:gp.rngPreparation.rng});
  for(const [runtime,prepared] of [[hostRuntime,hp],[guestRuntime,gp]]){runtime.chooseLinkBattle({arenaIndex:prepared.arenaIndex});runtime.startMatch();}
  const he=host.app.enterLinkBattle({linkKey:hp.linkKey,rngPreparation:hp.rngPreparation}),ge=guest.app.enterLinkBattle({linkKey:gp.linkKey,rngPreparation:gp.rngPreparation});
  assert.equal(he.ok,true,he.reason);assert.equal(ge.ok,true,ge.reason);
  const hs=hostRuntime.startMatch(),gs=guestRuntime.startMatch();
  for(let frame=0;frame<30000&&!hs.getView().outcome.ended;frame++){hs.tick();gs.tick();}
  assert.equal(hs.getView().outcome.ended,true);assert.deepEqual(hs.getView().outcome,gs.getView().outcome);
  const hr=hostRuntime.getSettlementResult(),gr=guestRuntime.getSettlementResult();
  assert.equal(hr.individualResults,undefined);assert.equal(gr.individualResults,undefined);
  assert.equal(host.app.finishMatch({...hr,attemptId:he.attempt.attemptId}).ok,true);
  assert.equal(guest.app.finishMatch({...gr,attemptId:ge.attempt.attemptId}).ok,true);
  assert.deepEqual((await host.app.prepareBattleParty(null,[host.id])).individuals[0].nativeProfile,hostBefore);
  assert.deepEqual((await guest.app.prepareBattleParty(null,[guest.id])).individuals[0].nativeProfile,guestBefore);
  assert.deepEqual(host.app.getTitleProgress().record,hostRecord);assert.deepEqual(guest.app.getTitleProgress().record,guestRecord);
 }finally{hostRuntime?.dispose();guestRuntime?.dispose();await host.app.dispose();await guest.app.dispose();}
});
test('actual native host v1 rejects extension guest; explicit v2 opt-in admits the same guest',async()=>{
 const host=await ownedApp(211),guest=await ownedApp(230);
 try{
  const old=await host.app.createLinkBattleInvite([host.id]);assert.match(old.inviteCode,/^CM26-LINK-1\./);
  const denied=await guest.app.prepareLinkBattle({role:'GUEST',inviteCode:old.inviteCode,instanceIds:[guest.id]});
  assert.equal(denied.ok,false);assert.equal(denied.reason,'LINK_BATTLE_V2_INVITE_REQUIRED');
  const invite=await host.app.createLinkBattleInvite([host.id],{transportVersion:2});assert.match(invite.inviteCode,/^CM26-LINK-2\./);
  const ready=await guest.app.prepareLinkBattle({role:'GUEST',inviteCode:invite.inviteCode,instanceIds:[guest.id]});assert.equal(ready.ok,true,ready.reason);
  assert.deepEqual(ready.parties.map(p=>p.map(e=>e.nativeProfile.fields['000'])),[[211],[230]]);
 }finally{await host.app.dispose();await guest.app.dispose();}
});
test('actual app generates and prepares both new password forms without changing save or owned identity',async()=>{
 const owner=await ownedApp(229);
 try{
  const id230=owner.app.getRaisingInstances().find(entry=>entry.speciesId==='species-230').instanceId;
  const before=[...owner.data.entries()];
  const a=await owner.app.createTeamPassword([owner.id]),b=await owner.app.createTeamPassword([id230]);
  assert.equal(a.ok,true,a.reason);assert.equal(b.ok,true,b.reason);assert.match(a.password,/^CM26-PASSWORD-2\./);assert.match(b.password,/^CM26-PASSWORD-2\./);
  const prepared=await owner.app.preparePasswordBattle([a.password,b.password]);assert.equal(prepared.ok,true,prepared.reason);
  assert.deepEqual(prepared.parties.map(p=>p.map(e=>e.nativeProfile.fields['000'])),[[229],[230]]);
  assert.deepEqual([...owner.data.entries()],before);
 }finally{await owner.app.dispose();}
});

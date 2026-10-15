// TEST-ONLY accepted catalog fixture. This hook changes JSON in this isolated
// Node test process, never any release catalog, asset flag or production file.
// It proves codec behavior after acceptance, NOT asset/rendering acceptance.
import assert from 'node:assert/strict';
import test from 'node:test';
import {registerHooks} from 'node:module';
registerHooks({load(url,context,next){
  const result=next(url,context);
  if(url.endsWith('/src/data/championship/product-species-extensions.r1.json')){
    const value=JSON.parse(result.source.toString());
    value.entries=value.entries.map(entry=>({...entry,runtimeReady:true,evolutionReady:true,networkReady:true}));
    return {...result,source:JSON.stringify(value)};
  }
  return result;
}});
const password=await import('../src/championship/battle/nativePasswordBattle.js');
const link=await import('../src/championship/battle/nativeLinkBattle.js');
const {getProductExtension}=await import('../src/championship/contracts/productSpeciesExtensions.js');
const compact=speciesIndex=>({speciesIndex,personalityIndex:4,levelTens:1,hpSteps:2,tpSteps:3,
  level84:1,level88:1,level8C:1,level90:1,level94:3,level98:3,level9C:3,levelA0:3,levelA4:3});
function inheritedProfile(index){
  const base=getProductExtension(index).baseSpeciesIndex;
  const code=password.encodeNativePasswordTeam({teamField:1,members:[{extra:1,compact:compact(base)},null,null]});
  const native=structuredClone(password.decodeNativePasswordTeam(code).members[0].nativeProfile);
  native.fields['000']=index;return native;
}
test('accepted fixture only: both product forms roundtrip through public password APIs with original identity',()=>{
  const profiles=[inheritedProfile(229),null,inheritedProfile(230)],before=JSON.stringify(profiles);
  const code=password.encodeChampionshipPasswordTeamFromProfiles(profiles),decoded=password.decodeChampionshipPasswordTeam(code);
  assert.equal(decoded.version,2);assert.equal(decoded.presenceMask,5);
  assert.deepEqual(decoded.members.map(m=>m?.nativeProfile.fields['000']??null),[229,null,230]);
  assert.deepEqual(decoded.members.map(m=>m?.battleCreature.speciesId??null),[229,null,230]);
  assert.equal(password.encodeChampionshipPasswordTeam(decoded),code);
  for(const slot of [0,2])assert.deepEqual(decoded.members[slot].nativeProfile,profiles[slot]);
  assert.equal(password.championshipPasswordTeamAdmission(decoded).ok,true);
  assert.equal(JSON.stringify(profiles),before);
  assert.throws(()=>password.encodeNativePasswordTeamFromProfiles(profiles),/V2_REQUIRED/);
});
test('accepted fixture only: v2 decode keeps native placeholder stats and requested instance IDs',()=>{
  const profiles=[inheritedProfile(229),inheritedProfile(230)],code=password.encodeChampionshipPasswordTeamFromProfiles(profiles);
  let value=0;const placeholders=password.createNativePasswordPlaceholders({next:channel=>(value=(value+channel+17)%103)});
  const decoded=password.decodeChampionshipPasswordTeam(code,{placeholders,instancePrefix:'fixture'});
  for(const member of decoded.members.filter(Boolean)){
    assert.equal(member.nativeProfile.fields['060'],placeholders[member.slot].fields['060']);
    assert.equal(member.instanceId,`fixture:${member.slot}`);
    assert.equal(member.nativeProfile.fields['000'],profiles[member.slot].fields['000']);
  }
});
test('accepted fixture only: both full product profiles survive v2 invite/reply without base casts',()=>{
  const host=[{instanceId:'original-host',nativeProfile:inheritedProfile(229)}],guest=[{instanceId:'original-guest',nativeProfile:inheritedProfile(230)}];
  host[0].nativeProfile.fields['140']=230;guest[0].nativeProfile.fields['140']=229;
  const invite=link.createChampionshipLinkInvite({individuals:host,arenaIndex:7});
  const reply=link.createChampionshipLinkReply({inviteCode:invite.code,individuals:guest});
  const session=link.readChampionshipLinkReply(invite.code,reply.code);
  assert.equal(invite.version,2);assert.equal(reply.version,2);
  assert.deepEqual(session.hostIndividuals[0].nativeProfile,host[0].nativeProfile);
  assert.deepEqual(session.guestIndividuals[0].nativeProfile,guest[0].nativeProfile);
  assert.deepEqual([session.hostIndividuals[0].nativeProfile.fields['000'],session.guestIndividuals[0].nativeProfile.fields['000']],[229,230]);
  assert.throws(()=>link.createNativeLinkInvite({individuals:host,arenaIndex:7}),/V2_REQUIRED/);
  const nativeInvite=link.createNativeLinkInvite({individuals:[{nativeProfile:{...inheritedProfile(229),fields:{...inheritedProfile(229).fields,'000':211}}}],arenaIndex:7});
  assert.throws(()=>link.createChampionshipLinkReply({inviteCode:nativeInvite.code,individuals:guest}),/V2_INVITE_REQUIRED/);
});

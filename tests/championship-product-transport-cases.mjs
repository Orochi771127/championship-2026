import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {nativeIndividualProfile,NATIVE_INDIVIDUAL_WORDS} from '../src/championship/raising/nativeIndividualProfile.js';
import {getProductExtension} from '../src/championship/contracts/productSpeciesExtensions.js';
import * as password from '../src/championship/battle/nativePasswordBattle.js';
import * as link from '../src/championship/battle/nativeLinkBattle.js';
import {PRODUCT_BATTLE_CATALOG,PRODUCT_PASSWORD_PREFIX,PRODUCT_LINK_PREFIX,PRODUCT_BATTLE_CODE_MAX_LENGTH,
  productTransportHeader,encodeProductBattleEnvelope,decodeProductBattleEnvelope,requireReadyTransportSpecies}
  from '../src/championship/contracts/productBattleTransport.js';
import {encodeProductPasswordData,decodeProductPasswordData} from '../src/championship/contracts/productPasswordTransport.js';
const read=name=>JSON.parse(readFileSync(new URL(`./fixtures/${name}`,import.meta.url),'utf8'));
const cpu=read('PASSWORD_BATTLE_CODEC_CPU_2026-09-14.json'),pack=read('PASSWORD_TEAM_PACK_CPU_2026-09-15.json');
const profile=(species,name='獸')=>nativeIndividualProfile({fields:{...Object.fromEntries(NATIVE_INDIVIDUAL_WORDS.map(key=>[key,0])),
  '000':species,'018':4,'050':100,'058':100,'054':12,'05c':12},narrowFields:{'03c':0,'03d':0,'044':10,'046':0,'194':0},name});
const individual=(species,name)=>({instanceId:`source:${species}`,nativeProfile:profile(species,name)});
const compact=speciesIndex=>({speciesIndex,personalityIndex:4,levelTens:1,hpSteps:2,tpSteps:3,
  level84:1,level88:1,level8C:1,level90:1,level94:3,level98:3,level9C:3,levelA0:3,levelA4:3});
const team={teamField:1,members:[{extra:1,compact:compact(229)},null,{extra:1,compact:compact(230)}]};
function uncheckedEnvelope(prefix,payload){
  const body=Buffer.from(JSON.stringify(payload));let hash=0x811c9dc5;
  for(const byte of body){hash^=byte;hash=Math.imul(hash,0x01000193)>>>0;}
  return `${prefix}${hash.toString(16).padStart(8,'0')}.${body.toString('base64url')}`;
}
function mutateCode(code,mutate){
  const p=JSON.parse(Buffer.from(code.split('.')[2],'base64url'));mutate(p);
  return uncheckedEnvelope(`${code.split('.')[0]}.`,p);
}

test('all 61 ROM profile packing goldens remain byte-identical through native and compatibility APIs',()=>{
  assert.equal(pack.vectorCount,61);
  for(const vector of pack.vectors){
    const profiles=vector.members.map(member=>member?{fields:member.fields,narrowFields:{'044':member.narrow044}}:null);
    const options={extras:vector.members.map(member=>member?.extra),teamField:vector.teamField};
    assert.equal(password.encodeNativePasswordTeamFromProfiles(profiles,options),vector.password,vector.kind);
    assert.equal(password.encodeChampionshipPasswordTeamFromProfiles(profiles,options),vector.password,vector.kind);
  }
});
test('all original decoder goldens keep radix228, 22-character alphabet and unchanged re-encoding',()=>{
  assert.equal(password.NATIVE_PASSWORD_MAX_LENGTH,22);assert.equal(password.NATIVE_PASSWORD_ALPHABET.length,257);
  for(const vector of cpu.vectors){
    const native=password.decodeNativePasswordTeam(vector.password),compat=password.decodeChampionshipPasswordTeam(vector.password);
    assert.deepEqual(compat,native);assert.equal(password.encodeNativePasswordTeam(native),vector.password);
    assert.equal(password.encodeChampionshipPasswordTeam(native),vector.password);
    for(let slot=0;slot<3;slot++){
      const expected=vector.decoded.members[slot],actual=native.members[slot];
      if(!expected){assert.equal(actual,null);continue;}
      assert.equal(actual.nativeProfile.fields['000'],expected.speciesIndex);
      assert.equal(actual.nativeProfile.fields['058'],expected.maxHp);
      assert.equal(actual.nativeProfile.fields['05c'],expected.maxTp);
    }
  }
});
test('v2 password structural roundtrip retains both new identities, holes, extras and compact numbers',()=>{
  const before=JSON.stringify(team),code=encodeProductPasswordData(team),decoded=decodeProductPasswordData(code);
  assert.ok(code.startsWith(PRODUCT_PASSWORD_PREFIX));assert.equal(decoded.version,2);assert.equal(decoded.catalogRevision,1);
  assert.deepEqual(decoded.members,team.members);assert.equal(decoded.teamField,1);assert.equal(JSON.stringify(team),before);
  assert.equal(encodeProductPasswordData({teamField:decoded.teamField,members:decoded.members}),code);
  assert.throws(()=>password.decodeNativePasswordTeam(code),/PASSWORD_BATTLE_LENGTH/);
  assert.equal(password.normalizeChampionshipPassword(` \n${code} `),code);
});
test('v1 explicitly refuses extensions even after persistent profile validation accepts them',()=>{
  for(const id of [229,230]){
    const p=profile(id);assert.equal(p.fields['000'],id);
    assert.throws(()=>password.encodeNativePasswordTeamFromProfiles([p]),/V2_REQUIRED/);
    assert.throws(()=>password.encodeNativePasswordTeam({teamField:1,members:[{extra:1,compact:compact(id)},null,null]}),/INVALID_SPECIESINDEX/);
    assert.throws(()=>link.createNativeLinkInvite({individuals:[{nativeProfile:p}],arenaIndex:0}),/V2_REQUIRED/);
    const invite=link.createNativeLinkInvite({individuals:[individual(34)],arenaIndex:0});
    const forged=mutateCode(invite.code,payload=>{payload.host[0][0][0]=id;});
    assert.throws(()=>link.readNativeLinkInvite(forged),/V2_REQUIRED/);
  }
});
test('production entry points preserve accepted new forms without casting to211/222',()=>{
  for(const id of [229,230]){
    const e=getProductExtension(id);assert.equal(e.runtimeReady,true);assert.equal(e.networkReady,true);
    assert.doesNotThrow(()=>requireReadyTransportSpecies(id));
    assert.equal(password.championshipPasswordProfileAdmission(profile(id)).ok,true);
    const code=password.encodeChampionshipPasswordTeamFromProfiles([profile(id)]);
    assert.equal(password.decodeChampionshipPasswordTeam(code).members[0].nativeProfile.fields['000'],id);
    const invite=link.createChampionshipLinkInvite({individuals:[individual(id)],arenaIndex:0});
    assert.equal(invite.version,2);assert.equal(link.readChampionshipLinkInvite(invite.code).hostIndividuals[0].nativeProfile.fields['000'],id);
  }
  assert.deepEqual(password.decodeChampionshipPasswordTeam(password.encodeChampionshipPasswordTeam(team)).members.map(x=>x?.nativeProfile.fields['000']??null),[229,null,230]);
});
test('v2 password rejects sentinel, unknown identities, extra fields, nonintegers, overflow and empties',()=>{
  for(const id of [228,231,-1,'229',229.5,NaN]){
    const t=structuredClone(team);t.members[0].compact.speciesIndex=id;
    assert.throws(()=>encodeProductPasswordData(t),/UNKNOWN_SPECIES/);
  }
  for(const [field,value] of [['personalityIndex',8],['hpSteps',256],['level84',4],['level94',7],['tpSteps',1.5]]){
    const t=structuredClone(team);t.members[0].compact[field]=value;
    assert.throws(()=>encodeProductPasswordData(t),/INVALID_/);
  }
  const t=structuredClone(team);t.members[0].compact.baseSpeciesIndex=211;
  assert.throws(()=>encodeProductPasswordData(t),/MEMBER_SHAPE/);
  assert.throws(()=>encodeProductPasswordData({teamField:1,members:[null,null,null]}),/EMPTY_TEAM/);
  assert.throws(()=>encodeProductPasswordData({teamField:1,members:new Array(3)}),/MEMBER_SHAPE/);
  const code=encodeProductPasswordData(team);
  assert.throws(()=>decodeProductPasswordData(mutateCode(code,p=>p.members[0].compact.speciesIndex=228)),/UNKNOWN_SPECIES/);
});
test('v2 bounds input and rejects checksum, future versions, catalog revision and identity mismatch before admission',()=>{
  const code=encodeProductPasswordData(team);
  assert.throws(()=>decodeProductPasswordData(`${code.slice(0,-2)}AA`),/CODE_CHECKSUM|CODE_NONCANONICAL/);
  assert.throws(()=>decodeProductPasswordData(code.replace('PASSWORD-2','PASSWORD-3')),/UNSUPPORTED_VERSION/);
  assert.throws(()=>decodeProductPasswordData(mutateCode(code,p=>p.version=3)),/UNSUPPORTED_VERSION/);
  for(const mutate of [p=>p.catalogRevision=2,p=>p.catalog.revision=2,p=>p.catalog.extensions[0].baseSpeciesIndex=222,
    p=>p.catalog.extensions[0].entityId='wrong',p=>p.catalog.extensions.reverse()]){
    assert.throws(()=>decodeProductPasswordData(mutateCode(code,mutate)),/CATALOG_MISMATCH/);
  }
  assert.throws(()=>decodeProductPasswordData(mutateCode(code,p=>p.extra=true)),/PAYLOAD_SHAPE/);
  assert.throws(()=>decodeProductPasswordData('x'.repeat(PRODUCT_BATTLE_CODE_MAX_LENGTH+1)),/CODE_LENGTH/);
  assert.throws(()=>decodeProductPasswordData(null),/CODE_REQUIRED/);
});
test('native link fixture bytes and wrappers remain compatible',()=>{
  const golden=read('native-link-v1-golden.json'),host=[{nativeProfile:golden.host}],guest=[{nativeProfile:golden.guest}];
  assert.equal(link.createNativeLinkInvite({individuals:host,arenaIndex:7}).code,golden.invite);
  assert.equal(link.createNativeLinkReply({inviteCode:golden.invite,individuals:guest}).code,golden.reply);
  assert.deepEqual(link.createChampionshipLinkInvite({individuals:host,arenaIndex:7}),link.createNativeLinkInvite({individuals:host,arenaIndex:7}));
  assert.deepEqual(link.readChampionshipLinkInvite(golden.invite),link.readNativeLinkInvite(golden.invite));
  assert.deepEqual(link.readChampionshipLinkReply(golden.invite,golden.reply),link.readNativeLinkReply(golden.invite,golden.reply));
});
test('v2 host and guest agree on version, identity manifest, arena and exact full profiles',()=>{
  const host=[individual(211,'王猿')],guest=[individual(222,'帝龍')],before=JSON.stringify([host,guest]);
  const invite=link.createChampionshipLinkInvite({individuals:host,arenaIndex:7,transportVersion:2});
  const reply=link.createChampionshipLinkReply({inviteCode:invite.code,individuals:guest});
  const session=link.readChampionshipLinkReply(invite.code,reply.code);
  assert.equal(invite.version,2);assert.equal(reply.version,2);assert.equal(session.catalogRevision,1);
  assert.deepEqual(session.catalog,PRODUCT_BATTLE_CATALOG);assert.equal(session.arenaIndex,7);
  assert.deepEqual(session.hostIndividuals.map(e=>e.nativeProfile),host.map(e=>e.nativeProfile));
  assert.deepEqual(session.guestIndividuals.map(e=>e.nativeProfile),guest.map(e=>e.nativeProfile));
  assert.notEqual(session.hostIndividuals[0].instanceId,session.guestIndividuals[0].instanceId);
  assert.equal(JSON.stringify([host,guest]),before);assert.equal(Object.isFrozen(session.guestIndividuals[0].nativeProfile.fields),true);
  assert.throws(()=>link.readNativeLinkInvite(invite.code),/CODE_FORMAT/);
  const acceptedReply=link.createChampionshipLinkReply({inviteCode:invite.code,individuals:[individual(229)]});assert.equal(link.readChampionshipLinkReply(invite.code,acceptedReply.code).guestIndividuals[0].nativeProfile.fields['000'],229);
});
test('v2 link structural payload and production runtime preserve229/230',()=>{
  const narrow=['03c','03d','044','046','194'];
  const wire=p=>[NATIVE_INDIVIDUAL_WORDS.map(k=>p.fields[k]),narrow.map(k=>p.narrowFields[k]),p.name];
  const payload={...productTransportHeader('INVITE'),arenaIndex:0,host:[wire(profile(229)),wire(profile(230))]};
  const code=encodeProductBattleEnvelope(PRODUCT_LINK_PREFIX,payload),decoded=decodeProductBattleEnvelope(PRODUCT_LINK_PREFIX,code);
  assert.deepEqual(decoded.payload.host,payload.host);assert.deepEqual(decoded.payload.host.map(p=>p[0][0]),[229,230]);
  assert.deepEqual(link.readChampionshipLinkInvite(code).hostIndividuals.map(e=>e.nativeProfile.fields['000']),[229,230]);
});
test('v1/v2 mix, wrong invite, catalog mismatch and malformed link profiles fail closed',()=>{
  const host=[individual(34)],guest=[individual(72)],old=link.createNativeLinkInvite({individuals:host,arenaIndex:0});
  const oldReply=link.createNativeLinkReply({inviteCode:old.code,individuals:guest});
  const invite=link.createChampionshipLinkInvite({individuals:host,arenaIndex:0,transportVersion:2});
  const reply=link.createChampionshipLinkReply({inviteCode:invite.code,individuals:guest});
  const other=link.createChampionshipLinkInvite({individuals:host,arenaIndex:1,transportVersion:2});
  assert.throws(()=>link.readChampionshipLinkReply(old.code,reply.code),/VERSION_MISMATCH/);
  assert.throws(()=>link.readChampionshipLinkReply(invite.code,oldReply.code),/VERSION_MISMATCH/);
  assert.throws(()=>link.readChampionshipLinkReply(other.code,reply.code),/REPLY_FOR_DIFFERENT_INVITE/);
  assert.throws(()=>link.createChampionshipLinkReply({inviteCode:old.code,individuals:[individual(230)]}),/V2_INVITE_REQUIRED/);
  assert.throws(()=>link.readChampionshipLinkReply(invite.code,mutateCode(reply.code,p=>p.catalogRevision=2)),/CATALOG_MISMATCH/);
  assert.throws(()=>link.readChampionshipLinkInvite(mutateCode(invite.code,p=>p.host[0][0][0]=228)),/UNKNOWN_SPECIES/);
  assert.throws(()=>link.readChampionshipLinkInvite(mutateCode(invite.code,p=>p.host[0][0].pop())),/PROFILE_SHAPE/);
  assert.throws(()=>link.readChampionshipLinkInvite(mutateCode(invite.code,p=>p.host[0][0][1]=-1)),/INVALID_NATIVE_INDIVIDUAL_WORD/);
  assert.throws(()=>link.readChampionshipLinkInvite(mutateCode(invite.code,p=>p.arenaIndex=6)),/ARENA/);
  assert.throws(()=>link.readChampionshipLinkInvite(mutateCode(invite.code,p=>p.version=1)),/UNSUPPORTED_VERSION/);
  assert.throws(()=>link.createChampionshipLinkInvite({individuals:host,arenaIndex:0,transportVersion:3}),/UNSUPPORTED_VERSION/);
});

test('extension ancestry alone cannot leak into v1 full link profiles; v2 preserves it without enabling the ancestor',()=>{
  const native=structuredClone(profile(211));native.fields['140']=229;native.fields['16c']=230;
  const individuals=[{nativeProfile:native}];
  assert.throws(()=>link.createNativeLinkInvite({individuals,arenaIndex:0}),/V2_REQUIRED/);
  const invite=link.createChampionshipLinkInvite({individuals,arenaIndex:0});assert.equal(invite.version,2);
  assert.deepEqual(link.readChampionshipLinkInvite(invite.code).hostIndividuals[0].nativeProfile,native);
  const old=link.createNativeLinkInvite({individuals:[individual(211)],arenaIndex:0});
  assert.throws(()=>link.createChampionshipLinkReply({inviteCode:old.code,individuals}),/V2_INVITE_REQUIRED/);
  const forged=mutateCode(old.code,p=>p.host[0][0][NATIVE_INDIVIDUAL_WORDS.indexOf('140')]=229);
  assert.throws(()=>link.readNativeLinkInvite(forged),/V2_REQUIRED/);
});

test('short native keyboard input is never mistaken for a prefixed product envelope',()=>{
  for(const typed of ['CM26-','CM26-PASSWORD-2.'])assert.equal(password.normalizeChampionshipPassword(typed),password.normalizeNativePassword(typed));
});

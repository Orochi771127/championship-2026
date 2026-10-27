// Owner 2026-10-28: the cinematic prologue's chapter, the onboarding copy, the
// tutorial lesson counter and the guest / friends / story ports.
import test from 'node:test';
import assert from 'node:assert/strict';
import {createAuthAndCloudSyncPort,createSocialFriendPort,createStoryCampaignPort,validateStoryChapter,isStoryChapterUnlocked,
  tamerIdCode,isTamerIdCode,normalizeFriendDefenseTeam,STORY_CAMERA_EFFECTS} from '../src/championship/app/futureSystemsPort.js';
import {CHAMPIONSHIP_GUEST_IDENTITY_KEY,createChampionshipGuestIdentityPort} from '../src/championship/app/ChampionshipPersistentSavePort.js';
import {onboardingText,ONBOARDING_TEXT_LOCALES} from '../src/championship/text/onboardingText.js';
import {TUTORIAL_GUIDE_LESSONS,tutorialGuideLesson} from '../src/championship/app/interactiveTutorialPreview.js';
import {TUTORIAL_RAISING_STEPS} from '../src/championship/app/interactiveTutorialRaisingSteps.js';
import {TUTORIAL_HUNT_STEPS} from '../src/championship/app/interactiveTutorialHuntSteps.js';
import {TUTORIAL_BATTLE_STEPS} from '../src/championship/app/interactiveTutorialBattleSteps.js';
import {openingPrologueChapter} from '../src/championship/app/openingStoryPresentation.js';
import {OPENING_STORY_CARDS} from '../src/championship/app/nativeOpeningStory.js';
import {OPENING_EGG_CHOICES,OPENING_EGG_ELEMENTS,openingEggChoices} from '../src/championship/app/openingEggChoices.js';

const memoryStore=()=>{let text=null;return {writes:0,read(){return {text,error:null};},write(next){this.writes++;text=next;return {ok:true,error:null};}};};
const chapter=(beats,extra={})=>({schemaVersion:1,chapterId:'chapter-1',beats,...extra});

test('the prologue is a valid story chapter: four beats, original text and order, original holds as auto-advance',()=>{
  const prologue=openingPrologueChapter();
  assert.equal(prologue.chapterId,'prologue-opening');assert.equal(prologue.unlockCondition.kind,'newGame');
  assert.equal(prologue.beats.length,4);
  assert.deepEqual(prologue.beats.map(beat=>beat.illustration.length),[3,1,1,0]);
  assert.deepEqual(prologue.beats.map(beat=>beat.autoAdvanceMs),OPENING_STORY_CARDS.map(card=>Math.round(card.frames*1000/60)));
  assert.match(prologue.beats[0].text,/每四年/);assert.match(prologue.beats[3].text,/郵件/);
  assert.ok(prologue.beats.flatMap(beat=>beat.illustration).every(art=>art.src.startsWith('assets/production/opening/')));
  assert.deepEqual(validateStoryChapter(prologue),prologue);
});

test('story chapters reject malformed scripts and remote art; unlocks and the loader follow the schema',async()=>{
  assert.throws(()=>validateStoryChapter(chapter([])),/STORY_BEATS/);
  assert.throws(()=>validateStoryChapter(chapter([{text:'a'}],{schemaVersion:2})),/STORY_SCHEMA_VERSION/);
  assert.throws(()=>validateStoryChapter(chapter([{text:'a',illustration:'https://example.com/a.webp'}])),/STORY_ILLUSTRATION_SRC/);
  assert.throws(()=>validateStoryChapter(chapter([{text:'a',illustration:'//cdn/a.webp'}])),/STORY_ILLUSTRATION_SRC/);
  assert.throws(()=>validateStoryChapter(chapter([{text:'a',cameraEffect:'spin'}])),/STORY_CAMERA_EFFECT/);
  assert.throws(()=>validateStoryChapter(chapter([{text:'a',choices:[{id:'go',label:'Go',next:0}]},{text:'b'}])),/STORY_CHOICE_TARGET/);
  assert.throws(()=>validateStoryChapter(chapter([{text:'a'}],{unlockCondition:{kind:'tamerRank'}})),/STORY_UNLOCK_RANK/);
  const valid=validateStoryChapter(chapter([{speaker:'Guide',text:'a',illustration:['assets/production/x.webp'],choices:[{id:'go',label:'Go',next:1}]},{text:'b',autoAdvanceMs:900}],
    {unlockCondition:{kind:'tamerRank',min:2}}));
  assert.equal(valid.beats[0].cameraEffect,'kenBurns');assert.ok(STORY_CAMERA_EFFECTS.includes(valid.beats[0].cameraEffect));
  assert.equal(isStoryChapterUnlocked(valid,{tamerRank:1}),false);assert.equal(isStoryChapterUnlocked(valid,{tamerRank:2}),true);
  const fetched=[];
  const port=createStoryCampaignPort({chapters:[openingPrologueChapter()],fetchJson:async url=>{fetched.push(url);return chapter([{text:'c'}],{chapterId:'chapter-2',unlockCondition:{kind:'chapterCleared',chapterId:'prologue-opening'}});}});
  await assert.rejects(port.loadChapter('https://example.com/c.json'),/STORY_CHAPTER_URL_MUST_BE_RELATIVE/);
  assert.equal((await port.loadChapter('assets/story/chapter-2.json')).chapterId,'chapter-2');assert.deepEqual(fetched,['assets/story/chapter-2.json']);
  assert.deepEqual(port.listChapters({newGame:true}).map(c=>[c.chapterId,c.unlocked]),[['prologue-opening',true],['chapter-2',false]]);
  assert.deepEqual(port.listChapters({clearedChapters:['prologue-opening']}).map(c=>c.unlocked),[false,true]);
});

test('a guest identity is issued once, persisted beside the save, and survives a failing store',async()=>{
  const store=memoryStore(),bytes=[1,2,3,4,5,6,7,8];
  const first=createAuthAndCloudSyncPort({identityStore:store,randomBytes:n=>new Uint8Array(bytes.slice(0,n)),now:()=> '2026-10-28T00:00:00Z'}).getSessionIdentity();
  assert.deepEqual({...first},{mode:'GUEST',guestId:'guest-0102030405060708',createdAt:'2026-10-28T00:00:00Z',provider:null,linked:false,persisted:true});
  const again=createAuthAndCloudSyncPort({identityStore:store,randomBytes:()=>{throw Error('must reuse');}}).getSessionIdentity();
  assert.equal(again.guestId,first.guestId);assert.equal(store.writes,1);
  const broken=createAuthAndCloudSyncPort({identityStore:{read:()=>({text:'{bad',error:null}),write:()=>({ok:false,error:'QUOTA'})}}).getSessionIdentity();
  assert.match(broken.guestId,/^guest-[0-9a-f]{16}$/);assert.equal(broken.persisted,false);
  const local=createAuthAndCloudSyncPort({identityStore:memoryStore()});
  assert.deepEqual(await local.bindAccount('google'),{ok:false,reason:'ACCOUNT_BINDING_UNAVAILABLE',provider:'google'});
  assert.deepEqual(await local.mergeGuestSaveToCloud({revision:1}),{ok:false,reason:'CLOUD_SYNC_UNAVAILABLE'});
  await assert.rejects(local.bindAccount(''),/ACCOUNT_PROVIDER_REQUIRED/);
  const calls=[],cloud=createAuthAndCloudSyncPort({identityStore:memoryStore(),cloudAdapter:{
    bindAccount:async request=>{calls.push(['bind',request.provider,request.identity.mode]);return {ok:true};},
    mergeGuestSave:async request=>{calls.push(['merge',request.save.revision]);return {ok:true};}}});
  await cloud.bindAccount('apple');await cloud.mergeGuestSaveToCloud({revision:7});
  assert.deepEqual(calls,[['bind','apple','GUEST'],['merge',7]]);
});

test('the guest identity side-port uses the guarded product boundary and its own key',()=>{
  const data=new Map(),storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
  const port=createChampionshipGuestIdentityPort({storage});
  assert.equal(port.storageKey,CHAMPIONSHIP_GUEST_IDENTITY_KEY);assert.notEqual(CHAMPIONSHIP_GUEST_IDENTITY_KEY,'championshipModernSave:v1');
  assert.deepEqual({...port.write('{"version":1}')},{ok:true,error:null});assert.equal(port.read().text,'{"version":1}');
  assert.deepEqual([...data.keys()],[CHAMPIONSHIP_GUEST_IDENTITY_KEY]);
});

test('tamer card codes are readable, stable per guest and tamer, and friends need an account',async()=>{
  const code=tamerIdCode({guestId:'guest-0102030405060708',trainerName:'星野'});
  assert.ok(isTamerIdCode(code),code);assert.equal(code,tamerIdCode({guestId:'guest-0102030405060708',trainerName:'星野'}));
  assert.notEqual(code,tamerIdCode({guestId:'guest-0102030405060708',trainerName:'雷翔'}));
  assert.equal(isTamerIdCode('TM-IIII-OOOO'),false);assert.equal(isTamerIdCode('tm-1234-5678'),false);
  const auth=createAuthAndCloudSyncPort({identityStore:memoryStore()}),social=createSocialFriendPort({auth,now:()=> '2026-10-28T00:00:00Z'});
  const card=social.getTamerCard({trainerName:'星野'});assert.equal(card.mode,'GUEST');assert.ok(isTamerIdCode(card.code));
  assert.deepEqual(await social.listFriends(),[]);
  assert.deepEqual(await social.addFriend('nope'),{ok:false,reason:'INVALID_TAMER_CODE'});
  assert.deepEqual(await social.addFriend(code),{ok:false,reason:'FRIENDS_REQUIRE_ACCOUNT'});
  const request=social.createMirrorMatchRequest({friendCode:code,defenseTeam:[{speciesIndex:17,nickname:'小焰'},{speciesIndex:40,generation:2}]});
  assert.equal(request.kind,'AI_MIRROR_FRIENDLY');assert.deepEqual(request.team.map(m=>[m.speciesIndex,m.nickname,m.generation]),[[17,'小焰',null],[40,null,2]]);
  assert.throws(()=>normalizeFriendDefenseTeam([]),/DEFENSE_TEAM_SIZE/);assert.throws(()=>normalizeFriendDefenseTeam([{},{},{},{}]),/DEFENSE_TEAM_SIZE/);
});

test('onboarding copy is complete in all five languages, and every suggested name passes the opening name rule',()=>{
  assert.deepEqual([...ONBOARDING_TEXT_LOCALES].sort(),['en','ja','th','vi','zh-Hant']);
  const keys=Object.keys(onboardingText('zh-Hant')).sort();
  for(const locale of ONBOARDING_TEXT_LOCALES){
    const copy=onboardingText(locale);
    assert.deepEqual(Object.keys(copy).sort(),keys,locale);
    assert.equal(copy.lessons.length,TUTORIAL_GUIDE_LESSONS.length,locale);
    assert.deepEqual(Object.keys(copy.elements).sort(),OPENING_EGG_ELEMENTS.map(e=>e.key).sort(),locale);
    for(const name of [...copy.tamerNames,...copy.partnerNames]){
      assert.ok(name.length>=1&&name.length<=5&&!/[\p{Cc}\p{Cf}]/u.test(name),`${locale}: ${name}`);
    }
  }
  assert.equal(onboardingText('unsupported'),onboardingText('zh-Hant'));
});

test('every tutorial stage maps to a lesson, in play order, for the STEP counter',()=>{
  const stages=[...Object.keys(TUTORIAL_RAISING_STEPS),...Object.keys(TUTORIAL_HUNT_STEPS),...Object.keys(TUTORIAL_BATTLE_STEPS)];
  for(const stage of stages)assert.ok(tutorialGuideLesson(stage),stage);
  const raising=Object.keys(TUTORIAL_RAISING_STEPS).map(stage=>tutorialGuideLesson(stage).index);
  assert.deepEqual(raising,[...raising].sort((a,b)=>a-b));assert.equal(raising[0],0);
  assert.equal(tutorialGuideLesson('gate-intro').index,8);assert.equal(tutorialGuideLesson('battle-start').index,9);
  assert.equal(tutorialGuideLesson('raising-after-battle').index,9);assert.equal(tutorialGuideLesson('invitation'),null);
});

test('each starter egg carries its element tag on local and public selections',()=>{
  assert.deepEqual(OPENING_EGG_CHOICES.map(egg=>egg.element.key),['star','fire','water','forest','thunder','moon','crystal','holy']);
  assert.deepEqual(openingEggChoices('https://orochi771127.github.io/championship-2026/').map(egg=>egg.element.key),OPENING_EGG_CHOICES.map(egg=>egg.element.key));
  assert.ok(OPENING_EGG_ELEMENTS.every(element=>/^#[0-9a-f]{6}$/.test(element.color)));
});

// Partner life (Owner 2026-10-28): moods from the original fields, habitat fit
// from the original cage table, stroll finds paid atomically into the Shop
// inventory with a saved log, greetings that hold two partners face to face.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {PARTNER_LIFE_RULES,partnerHabitatFit,partnerMood,partnerAffectionHearts,partnerTypeBits,partnerPeerRelation,
  strollFindWeights,rollStrollFind,strollIntervalFrames,emptyStrollLog,normalizeStrollLog,appendStrollEntry,strollLogForDay,
  canStrollFind,canGreet,canTapAffection,recordTap,strollLogName} from '../src/championship/raising/ranchPartnerLife.js';
import {normalizeNativeRaisingHome} from '../src/championship/raising/nativeRaisingHomeState.js';
import {createNativeRaisingActor,initializeNativeRaisingActor,stepNativeRaisingActor,holdNativeRaisingActorForGreeting} from '../src/championship/raising/nativeRaisingActor.js';
import {nativeIndividualProfile} from '../src/championship/raising/nativeIndividualProfile.js';
import {createNativeHuntIndividual} from '../src/championship/hunt/capture/nativeHuntIndividual.js';
import {nativeHuntSpeciesByIndex} from '../src/championship/hunt/capture/nativeHuntSources.js';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {FRIENDS_PLAYTEST_POLICY} from '../src/championship/app/friendsPlaytestPolicy.js';
import {CHAMPIONSHIP_MODERN_SAVE_KEY,deserializeChampionshipModernSave} from '../src/championship/app/championshipStandaloneSave.js';

const read=f=>JSON.parse(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'));
const activity=read('src/data/championship/catalogs/raising-activity.r1.json');
const speciesWithBits=bits=>{for(let i=8;i<228;i++){try{if(partnerTypeBits(i)===bits)return i;}catch{}}return null;};
const VOLCANO=6,INFIRMARY=15;
const entry=(over={})=>({kind:'find',reward:'feed',quantity:1,partnerId:'championship:2026:instance:0001',partnerName:'焰角丸',
  cage:1,season:0,day:2,minute:1174,...over});

test('habitat fit reads the original cage like/dislike masks, infirmary care and litter',()=>{
  const [,,liked,disliked]=activity.cage[VOLCANO];
  assert.equal(liked,16);assert.equal(disliked,32);
  const likes=speciesWithBits(16),dislikes=speciesWithBits(32),neutral=speciesWithBits(1);
  assert.ok(likes&&dislikes&&neutral,'catalog has fire, water and plain types');
  assert.equal(partnerHabitatFit({speciesIndex:likes,cageDefinitionIndex:VOLCANO}),'cozy');
  assert.equal(partnerHabitatFit({speciesIndex:dislikes,cageDefinitionIndex:VOLCANO}),'poor');
  assert.equal(partnerHabitatFit({speciesIndex:neutral,cageDefinitionIndex:VOLCANO}),'neutral');
  assert.equal(partnerHabitatFit({speciesIndex:likes,cageDefinitionIndex:VOLCANO,dirty:true}),'neutral','litter costs one step');
  assert.equal(partnerHabitatFit({speciesIndex:neutral,cageDefinitionIndex:INFIRMARY,hpRatio:.4}),'cozy','a hurt partner rests well');
  assert.equal(partnerHabitatFit({speciesIndex:neutral,cageDefinitionIndex:null}),'neutral');
});

test('mood follows the original wound, illness, stress, hunger, sleep, stroke and affection fields',()=>{
  const base={'134':0,'138':0,'00c':0,'178':100,'13c':0,'020':40,'050':50,'058':100};
  const mood=(fields={},extra={})=>partnerMood({fields:{...base,...fields},growth:{},...extra});
  assert.equal(mood({'134':1}),'unwell');assert.equal(mood({'138':1}),'unwell');
  assert.equal(mood({},{growth:{'404':1}}),'unwell');
  assert.equal(mood({},{growth:{'418':1}}),'hungry');
  assert.equal(mood({},{state:4}),'sleepy');assert.equal(mood({'00c':85}),'sleepy');assert.equal(mood({'13c':1}),'sleepy');
  assert.equal(mood({},{statusMusic:1}),'happy');
  assert.equal(mood({'020':85}),'love');
  assert.equal(mood({},{habitat:'cozy'}),'happy');assert.equal(mood({},{habitat:'poor'}),'unwell');
  assert.equal(mood({'050':95}),'energetic');assert.equal(mood(),'calm');
  assert.deepEqual([0,9,10,50,89,90,100].map(n=>partnerAffectionHearts({'020':n})),[0,0,1,3,4,5,5]);
});

test('stroll finds weigh the cage ecology; greetings double the find',()=>{
  const infirmary=strollFindWeights(INFIRMARY),gym=strollFindWeights(4),forest=strollFindWeights(10);
  assert.ok(infirmary.medicine>infirmary.protein&&infirmary.woundMedicine>infirmary.protein);
  assert.ok(gym.protein>=gym.feed);assert.ok(forest.feed>gym.feed);
  assert.deepEqual(rollStrollFind(0,10),{kind:'feed',quantity:1});
  assert.deepEqual(rollStrollFind(.9999,10),{kind:'bits',quantity:1});
  assert.equal(rollStrollFind(.5,10,{greeting:true}).quantity,2);
  const [low,high]=PARTNER_LIFE_RULES.findIntervalFrames;
  assert.equal(strollIntervalFrames(0),low);assert.ok(strollIntervalFrames(.9999)<high);
  assert.equal(partnerPeerRelation({speciesIndex:20,typeBits:16},{speciesIndex:20,typeBits:16}),'friendly');
  assert.equal(partnerPeerRelation({speciesIndex:20,typeBits:16,attribute:3},{speciesIndex:21,typeBits:1,attribute:4}),'rival');
});

test('stroll log validates, caps at 40, resets daily counters and keeps cooldowns',()=>{
  let log=emptyStrollLog();const at=Date.parse('2026-10-28T10:00:00Z');
  for(let i=0;i<45;i++)log=appendStrollEntry(log,entry(),{dayKey:'0:2',at:at+i});
  assert.equal(log.entries.length,PARTNER_LIFE_RULES.logCap);assert.equal(log.sequence,45);assert.equal(log.entries[0].id,6);
  assert.equal(log.day.finds,45);assert.equal(canStrollFind(log,'0:2'),false);assert.equal(canStrollFind(log,'0:3'),true);
  assert.equal(strollLogForDay(log,'0:3').day.finds,0);
  assert.deepEqual(normalizeStrollLog(JSON.parse(JSON.stringify(log))),log);
  assert.throws(()=>normalizeStrollLog({...log,entries:[...log.entries,log.entries[0]]}),/INVALID_STROLL_LOG/);
  assert.throws(()=>normalizeStrollLog({...log,entries:[{...log.entries[0],reward:'cake'}]}),/INVALID_STROLL_LOG/);
  const a='championship:2026:instance:0001',b='championship:2026:instance:0002';
  let greet=appendStrollEntry(emptyStrollLog(),entry({kind:'greeting',quantity:2,partnerB:b,partnerBName:'腐泥滑怪',relation:'friendly'}),{dayKey:'0:2',at});
  assert.equal(canGreet(greet,'0:2',b,a,at+1000),false,'same pair waits');
  assert.equal(canGreet(greet,'0:2',a,b,at+PARTNER_LIFE_RULES.pairCooldownMs),true);
  const tapped=recordTap(emptyStrollLog(),a,at,'0:2');
  assert.equal(canTapAffection(tapped,a,at+1000),false);assert.equal(canTapAffection(tapped,a,at+PARTNER_LIFE_RULES.tapCooldownMs),true);
  assert.equal(strollLogName('  石淮升　'),'石淮升');assert.equal(strollLogName(''),'拍檔');
  const home=normalizeNativeRaisingHome({version:1,poolSlots:{},foods:[],strollLog:greet});
  assert.deepEqual(normalizeNativeRaisingHome(JSON.parse(JSON.stringify(home))).strollLog,greet);
});

test('a greeting holds an idle partner in place, facing its peer, then the original idle resumes',()=>{
  let seed=0x51a7;const rng={next:()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed%103;}};
  const ground={pixelWidth:672,readTerrain:()=>0,readClearance:()=>4};
  let profile=nativeIndividualProfile(createNativeHuntIndividual({species:nativeHuntSpeciesByIndex(8),rng}));
  const actor=createNativeRaisingActor(profile,0);initializeNativeRaisingActor(actor,profile,[100*4096,100*4096,0],35,rng);
  actor.state=1;actor.foodSlot=null;
  assert.equal(holdNativeRaisingActorForGreeting(actor,[140*4096,100*4096,0],PARTNER_LIFE_RULES.greetingFrames),true);
  assert.equal(actor.flipBits,1,'peer on the right: mirrored like the original face-off');
  assert.equal(holdNativeRaisingActorForGreeting(actor,[140*4096,100*4096,0],10),false,'no second hold');
  const start=[...actor.positionQ12];
  for(let i=0;i<PARTNER_LIFE_RULES.greetingFrames;i++){
    profile=stepNativeRaisingActor(actor,profile,{ageDelta:0,rng,feeding:{ground,foods:[],signals:new Map(),actors:[actor]}}).profile;
    assert.deepEqual(actor.positionQ12,start,`held at frame ${i}`);
  }
  assert.equal(actor.greetingHold,0);
  const moved=new Set();
  for(let i=0;i<900;i++){profile=stepNativeRaisingActor(actor,profile,{ageDelta:0,rng,feeding:{ground,foods:[],signals:new Map(),actors:[actor]}}).profile;moved.add(actor.positionQ12.join());}
  assert.ok(moved.size>5,'roams again after the greeting');
  const eating={...actor,state:2,foodSlot:3,mode:0,greetingHold:0};
  assert.equal(holdNativeRaisingActorForGreeting(eating,[0,0,0],10),false,'a partner bound for food is left alone');
});

async function appHarness({partnerLife=true,full=false}={}){
  let blocked=false;
  const seed=read('qa/championship-full-qa-save.json');
  for(const i of [0,1,2,3])seed.shop.quantities[i]=full?99:46;
  const data=new Map([[CHAMPIONSHIP_MODERN_SAVE_KEY,JSON.stringify(seed)]]);
  const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>{if(blocked)throw Error('QA_QUOTA');data.set(k,String(v));},removeItem:k=>data.delete(k)};
  const create=()=>createChampionshipStandaloneApp({storage,locks:null,playtestPolicy:FRIENDS_PLAYTEST_POLICY,partnerLife,
    catalog:read('src/data/championship/catalogs/creature-species.r1.json'),cages:read('docs/contracts/championship/raising-home-presentation.v1.json').cages});
  const app=create();await app.continueGame();
  const partner=app.getRaisingInstances().map(i=>i.instanceId).find(id=>(app.getRaisingActorFrame(id)?.speciesIndex??0)>=8);
  return {app,create,data,partner,block:v=>{blocked=v;}};
}
const owned=(app,record)=>app.getShopFrame().listings.find(r=>r.shopRecordIndex===record).owned;

test('a stroll find pays +1 into the Shop inventory and the saved log in one write, and survives reload',async()=>{
  const h=await appHarness();let a=h.app;
  try{
    assert.ok(h.partner,'the QA save has an adult partner on the ranch');
    const events=[];const stop=a.subscribePartnerLife(e=>events.push(e));
    const shopSeen=[];const unsubscribe=a.subscribeShop(frame=>shopSeen.push(frame));
    for(const [reward,record] of [['feed',0],['protein',1],['medicine',2],['woundMedicine',3]]){
      const before=owned(a,record),result=a.grantStrollDiscoveryReward({partnerId:h.partner,reward});
      assert.equal(result.ok,true,reward);assert.equal(result.owned,before+1);assert.equal(owned(a,record),before+1);
      assert.equal(result.tool,reward);
    }
    assert.equal(shopSeen.length,4,'the toolbar observers hear every find');
    assert.deepEqual(events.map(e=>e.kind),['find','find','find','find']);
    const saved=deserializeChampionshipModernSave(h.data.get(CHAMPIONSHIP_MODERN_SAVE_KEY));
    assert.deepEqual(saved.shop.quantities.slice(0,4),[47,47,47,47]);
    assert.equal(saved.raising.nativeHome.strollLog.entries.length,4);
    assert.deepEqual(saved.raising.nativeHome.strollLog.entries.map(e=>e.reward),['feed','protein','medicine','woundMedicine']);
    stop();unsubscribe();await a.dispose();a=h.create();await a.continueGame();
    assert.deepEqual([0,1,2,3].map(i=>owned(a,i)),[47,47,47,47]);
    assert.equal(a.getPartnerLifeFrame().log.entries.length,4);
  }finally{await a.dispose();}
});

test('a failed save keeps both the inventory and the log untouched; a full slot pays nothing',async()=>{
  const h=await appHarness();const a=h.app;
  try{
    const before=JSON.stringify(a.getShopFrame());
    h.block(true);assert.equal(a.grantStrollDiscoveryReward({partnerId:h.partner,reward:'feed'}).reason,'SAVE_FAILED');
    assert.equal(JSON.stringify(a.getShopFrame()),before);assert.equal(a.getPartnerLifeFrame().log,null);
    h.block(false);assert.equal(a.grantStrollDiscoveryReward({partnerId:h.partner,reward:'feed',quantity:2}).owned,48);
    assert.equal(a.getPartnerLifeFrame().log.entries.at(-1).quantity,2);
  }finally{await a.dispose();}
  const full=await appHarness({full:true});
  try{assert.equal(full.app.grantStrollDiscoveryReward({partnerId:full.partner,reward:'feed'}).reason,'INVENTORY_FULL');}
  finally{await full.app.dispose();}
});

test('a tap reads the mood and adds one affection per cooldown; harnesses without partner life are untouched',async()=>{
  const h=await appHarness();const a=h.app;
  try{
    const first=a.touchRaisingPartner(h.partner),second=a.touchRaisingPartner(h.partner);
    assert.ok(first&&first.mood&&first.emoji);
    assert.equal(first.gained,first.affection>=100&&first.gained===0?0:1);
    assert.equal(second.gained,0,'cooldown');
    assert.ok(a.getPartnerReading(h.partner).hearts>=0);
  }finally{await a.dispose();}
  const off=await appHarness({partnerLife:false});
  try{
    assert.equal(off.app.isPartnerLifeEnabled(),false);assert.equal(off.app.touchRaisingPartner(off.partner),null);
    assert.equal(off.app.getPartnerLifeFrame(),null);
    assert.equal(off.app.grantStrollDiscoveryReward({partnerId:off.partner,reward:'feed'}).reason,'UNAVAILABLE');
  }finally{await off.app.dispose();}
});

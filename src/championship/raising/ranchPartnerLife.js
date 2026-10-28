// Partner life on the ranch (OWNER_APPROVED_ADAPTATION, Owner 2026-10-28).
// Mood, habitat fit and affection READ the original individual fields and the
// original cage like/dislike table (raising-activity.r1.json); they add no
// second hunger, affection or timer. Stroll finds and greetings are product
// rewards, paid through the existing Shop inventory and logged in one optional
// child of the canonical Raising save (`strollLog`).
import data from '../../data/championship/catalogs/raising-activity.r1.json' with {type:'json'};
import {productBaseSpeciesIndex} from '../contracts/productSpeciesData.js';
import {ranchEcologyType} from '../cage/ranchEcology.js';

const deepFreeze=o=>{for(const v of Object.values(o))if(v&&typeof v==='object')deepFreeze(v);return Object.freeze(o);};

/** Emote and label per mood; the order is the priority of the reading. */
export const PARTNER_MOODS=deepFreeze({
  unwell:{emoji:'💢',label:'環境不適'},
  hungry:{emoji:'🍖',label:'肚子餓了'},
  sleepy:{emoji:'💤',label:'疲勞想睡'},
  happy:{emoji:'🎵',label:'心情愉悅'},
  love:{emoji:'❤️',label:'親密撒嬌'},
  energetic:{emoji:'✨',label:'精神百倍'},
  calm:{emoji:'🙂',label:'心情平穩'}
});
export const PARTNER_HABITATS=deepFreeze({
  cozy:{emoji:'🏡',label:'適居愉悅'},
  neutral:{emoji:'🏠',label:'普通'},
  poor:{emoji:'🥀',label:'不太適應'}
});

/** Shop records behind the four Training tools (see main.js getFoodStock). */
export const STROLL_REWARDS=deepFreeze({
  feed:{record:0,tool:'feed',label:'食物'},
  protein:{record:1,tool:'protein',label:'蛋白質'},
  medicine:{record:2,tool:'medicine',label:'藥品'},
  woundMedicine:{record:3,tool:'woundMedicine',label:'傷藥'},
  bits:{bits:30,tool:null,label:'位元幣'}
});
export const STROLL_KINDS=Object.freeze(Object.keys(STROLL_REWARDS));

export const PARTNER_LIFE_RULES=deepFreeze({
  // Native frames (60 a second) a partner must stroll before it may find something.
  findIntervalFrames:[5400,10800],
  findChance:{cozy:.85,neutral:.6,poor:.3},
  // Per in-game day across the ranch, so the economy keeps its shape.
  dailyFinds:8,dailyGreetings:4,
  greetingFrames:90,
  // Ranch-wide quiet frames before (and between) greetings: partners who
  // start out side by side in one cage do not all greet at once.
  greetingGapFrames:1800,
  // Real time between two greetings of the same pair, and between affection taps.
  pairCooldownMs:5*60*1000,tapCooldownMs:10*60*1000,tapAffection:1,
  logCap:40,nameMax:12
});

const fieldOf=(fields,key)=>Number(fields?.[key]??0)|0;

/** Original type bits (field18) of a species; 0 when the species has none. */
export function partnerTypeBits(speciesIndex){
  try{return data.species[productBaseSpeciesIndex(speciesIndex)]?.field18??0;}catch{return 0;}
}

/**
 * Habitat fit from the original cage table: column 2 is the type mask a cage
 * pleases (reaction 9), column 3 the mask it displeases (reaction 22). A hurt
 * partner is at home in an infirmary; litter makes any cage one step worse.
 */
export function partnerHabitatFit({speciesIndex,cageDefinitionIndex,dirty=false,hpRatio=1}={}){
  const row=Number.isInteger(cageDefinitionIndex)?data.cage[cageDefinitionIndex]:null;
  const bits=partnerTypeBits(speciesIndex);
  let fit='neutral';
  if(row&&bits&row[3])fit='poor';
  else if(row&&bits&row[2])fit='cozy';
  if(hpRatio<.6&&ranchEcologyType(cageDefinitionIndex)==='infirmary')fit='cozy';
  if(dirty)fit=fit==='cozy'?'neutral':'poor';
  return fit;
}

/** 0–5 hearts from the original affection (field 020, 0–100). */
export function partnerAffectionHearts(fields){
  return Math.max(0,Math.min(5,Math.round(fieldOf(fields,'020')/20)));
}

/**
 * One mood from the original state: wound/illness (134/138) and stress
 * (growth 404) first, then hunger (growth 418), sleepiness (state 4, the 13c
 * exhaustion flag or 00c near its 178 threshold), the stroke's music, affection.
 */
export function partnerMood({fields,growth={},state=1,statusMusic=0,habitat='neutral'}={}){
  if(fieldOf(fields,'134')||fieldOf(fields,'138')||growth['404'])return 'unwell';
  if(growth['418'])return 'hungry';
  const sleepAt=fieldOf(fields,'178');
  if(state===4||fieldOf(fields,'13c')||(sleepAt>0&&fieldOf(fields,'00c')>=sleepAt*.8))return 'sleepy';
  if(statusMusic)return 'happy';
  if(fieldOf(fields,'020')>=80)return 'love';
  if(habitat==='cozy')return 'happy';
  if(habitat==='poor')return 'unwell';
  const hp=fieldOf(fields,'050'),max=fieldOf(fields,'058');
  return max>0&&hp>=max*.9?'energetic':'calm';
}

/** Chance that one stroll interval ends with a find. */
export function strollFindChance(habitat,mood){
  let chance=PARTNER_LIFE_RULES.findChance[habitat]??PARTNER_LIFE_RULES.findChance.neutral;
  if(mood==='unwell'||mood==='sleepy')chance*=.5;
  else if(mood==='happy'||mood==='love')chance=Math.min(.95,chance*1.1);
  return chance;
}

/** What a cage tends to turn up: its ecology tilts the weights. */
export function strollFindWeights(cageDefinitionIndex){
  const weights={feed:5,protein:2,medicine:1.5,woundMedicine:1.5,bits:1};
  switch(ranchEcologyType(cageDefinitionIndex)){
    case 'infirmary':weights.medicine=4;weights.woundMedicine=4;weights.feed=2;break;
    case 'gym':case 'sports':weights.protein=5;break;
    case 'forest':case 'garden':case 'grassland':weights.feed=8;weights.medicine=2.5;break;
    case 'beach':case 'volcano':case 'desert':case 'snowfield':case 'mountain':weights.bits=2.5;weights.woundMedicine=2;break;
    default:break;
  }
  return Object.freeze(weights);
}

/** Pick a reward kind with a [0,1) draw; quantity doubles for a greeting. */
export function rollStrollFind(draw,cageDefinitionIndex,{greeting=false}={}){
  const weights=strollFindWeights(cageDefinitionIndex),total=Object.values(weights).reduce((a,b)=>a+b,0);
  let at=Math.max(0,Math.min(.999999,draw))*total,kind=STROLL_KINDS[0];
  for(const key of STROLL_KINDS){if(at<weights[key]){kind=key;break;}at-=weights[key];}
  return Object.freeze({kind,quantity:greeting?2:1});
}

/** Next stroll interval in native frames from a [0,1) draw. */
export function strollIntervalFrames(draw){
  const [low,high]=PARTNER_LIFE_RULES.findIntervalFrames;
  return low+Math.floor(Math.max(0,Math.min(.999999,draw))*(high-low));
}

/**
 * Greeting tone after the original peer reading (OVL18 idle selector): the
 * same species, type bits or attribute greet as friends (🎵); opposed type
 * pairs or two Vaccine/Data attributes square up as rivals (⚡). The original
 * generation order only decides who walks over, so it is left out here.
 */
export function partnerPeerRelation(a,b){
  if(a.speciesIndex===b.speciesIndex)return 'friendly';
  if(a.typeBits===b.typeBits||(a.attribute===b.attribute&&a.attribute!==undefined))return 'friendly';
  const opposed={1:16,16:1,8:32,32:8,2:4,4:2,128:64,64:128}[a.typeBits]===b.typeBits;
  if(opposed||([1,2].includes(a.attribute)&&[1,2].includes(b.attribute)))return 'rival';
  return 'friendly';
}

export function strollDayKey(calendar){
  return calendar&&Number.isInteger(calendar.season)&&Number.isInteger(calendar.day)?`${calendar.season}:${calendar.day}`:'0:0';
}

const integer=(n,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
const idOk=id=>typeof id==='string'&&/^[a-z0-9:_-]{3,96}$/i.test(id);
const nameOk=n=>typeof n==='string'&&n.length>0&&n.length<=PARTNER_LIFE_RULES.nameMax&&!/[\p{Cc}\p{Cf}]/u.test(n);

export function emptyStrollLog(){
  return deepFreeze({version:1,sequence:0,entries:[],day:{key:'0:0',finds:0,greetings:0},taps:{},pairs:{}});
}

export function normalizeStrollLog(raw){
  if(raw==null)return null;
  const fail=()=>{throw new TypeError('INVALID_STROLL_LOG');};
  if(raw.version!==1||!integer(raw.sequence,1000000000)||!Array.isArray(raw.entries)||raw.entries.length>PARTNER_LIFE_RULES.logCap
    ||!raw.day||typeof raw.day.key!=='string'||!/^\d{1,2}:\d{1,4}$/.test(raw.day.key)||!integer(raw.day.finds,1000)||!integer(raw.day.greetings,1000)
    ||!raw.taps||typeof raw.taps!=='object'||Array.isArray(raw.taps)||!raw.pairs||typeof raw.pairs!=='object'||Array.isArray(raw.pairs))fail();
  let previous=0;
  const entries=raw.entries.map(e=>{
    if(!integer(e.id,raw.sequence)||e.id<=previous||!integer(e.at)||!['find','greeting'].includes(e.kind)||!STROLL_KINDS.includes(e.reward)
      ||!integer(e.quantity,2)||e.quantity<1||!idOk(e.partnerId)||!nameOk(e.partnerName)
      ||(e.cage!==null&&!integer(e.cage,63))||!integer(e.season,3)||!integer(e.day,999)||!integer(e.minute,1439))fail();
    if(e.kind==='greeting'&&(!idOk(e.partnerB)||!nameOk(e.partnerBName)||!['friendly','rival'].includes(e.relation)))fail();
    previous=e.id;
    return Object.freeze({id:e.id,at:e.at,kind:e.kind,reward:e.reward,quantity:e.quantity,partnerId:e.partnerId,partnerName:e.partnerName,
      cage:e.cage,season:e.season,day:e.day,minute:e.minute,
      ...(e.kind==='greeting'?{partnerB:e.partnerB,partnerBName:e.partnerBName,relation:e.relation}:{})});
  });
  const stamps=(map,keyOk)=>{if(Object.keys(map).length>64)fail();
    return Object.freeze(Object.fromEntries(Object.entries(map).map(([k,v])=>{if(!keyOk(k)||!integer(v))fail();return [k,v];})));};
  return Object.freeze({version:1,sequence:raw.sequence,entries:Object.freeze(entries),
    day:Object.freeze({key:raw.day.key,finds:raw.day.finds,greetings:raw.day.greetings}),
    taps:stamps(raw.taps,idOk),pairs:stamps(raw.pairs,k=>k.split('|').length===2&&k.split('|').every(idOk))});
}

/** Today's counters, reset when the in-game day changes. */
export function strollLogForDay(log,dayKey){
  const state=log??emptyStrollLog();
  return state.day.key===dayKey?state:normalizeStrollLog({...state,day:{key:dayKey,finds:0,greetings:0}});
}

export function strollPairKey(a,b){return a<b?`${a}|${b}`:`${b}|${a}`;}

/** Append one find or greeting; the oldest entries fall off past the cap. */
export function appendStrollEntry(log,entry,{dayKey,at}){
  const state=strollLogForDay(log,dayKey),id=state.sequence+1;
  const entries=[...state.entries,{...entry,id,at}].slice(-PARTNER_LIFE_RULES.logCap);
  const day={...state.day,[entry.kind==='greeting'?'greetings':'finds']:state.day[entry.kind==='greeting'?'greetings':'finds']+1};
  const pairs=entry.kind==='greeting'?Object.fromEntries([...Object.entries(state.pairs),[strollPairKey(entry.partnerId,entry.partnerB),at]].slice(-64)):state.pairs;
  return normalizeStrollLog({...state,sequence:id,entries,day,pairs});
}

export function canStrollFind(log,dayKey){return strollLogForDay(log,dayKey).day.finds<PARTNER_LIFE_RULES.dailyFinds;}
export function canGreet(log,dayKey,a,b,at){
  const state=strollLogForDay(log,dayKey),last=state.pairs[strollPairKey(a,b)];
  return state.day.greetings<PARTNER_LIFE_RULES.dailyGreetings&&(last===undefined||at-last>=PARTNER_LIFE_RULES.pairCooldownMs);
}
export function canTapAffection(log,partnerId,at){
  const last=log?.taps?.[partnerId];
  return last===undefined||at-last>=PARTNER_LIFE_RULES.tapCooldownMs;
}
export function recordTap(log,partnerId,at,dayKey){
  const state=strollLogForDay(log,dayKey);
  return normalizeStrollLog({...state,taps:Object.fromEntries([...Object.entries(state.taps).filter(([k])=>k!==partnerId),[partnerId,at]].slice(-64))});
}

/** Short display name for the log (the save keeps it if the partner leaves). */
export function strollLogName(name,fallback='拍檔'){
  const text=typeof name==='string'?name.replace(/[\p{Cc}\p{Cf}]/gu,'').trim():'';
  return [...(text||fallback)].slice(0,PARTNER_LIFE_RULES.nameMax).join('');
}

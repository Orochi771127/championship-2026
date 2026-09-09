// Original individual qualification and the ordinary title-match party seam.
// Source: ARM9 02092204/02092380/02092244; OVL10 0210FF08, 02112D40;
// OVL19 0210E598..0210E798. Research CPU receipts live outside runtime.
import conditions from '../../data/championship/battlePartyConditions.json' with {type:'json'};
import {getBattleCatalogRecord} from './battleCatalogs.js';
import {getMatchRecord} from './battleMatchSelection.js';
import {BATTLE_CREATURE_STAT_MAP} from './battleCreatureBuild.js';
import {deepFreeze} from '../contracts/championshipContracts.js';

export function battlePartyCondition(index) {
  if(index===-1)return {slots:3,family:0,generation:7,attribute:0,field10:-1,field14:0,minimum03c:0,minimum010:0,individual018:-1,species014:0};
  const r=getBattleCatalogRecord('eligibility',index);
  return {slots:r.field00,family:r.field04,generation:r.field08,attribute:r.field0C,field10:r.field10,
    field14:r.field24,minimum03c:r.field14,minimum010:r.field15,individual018:r.field18,species014:r.field1C};
}

export function nativeBattleQualification(profile, condition) {
  const f=profile?.fields, n=profile?.narrowFields;
  const s=conditions.species[f?.['000']];
  if(!s||!n)return false;
  if(condition.family!==0 && (condition.family&s.fields['18'])===0)return false;
  if(condition.generation!==7 && condition.generation!==s.fields['0c'])return false;
  if(condition.attribute!==0 && condition.attribute!==s.fields['10'])return false;
  if(condition.minimum03c!==0 && condition.minimum03c>n['03c'])return false;
  if(condition.minimum010!==0 && condition.minimum010>(f['010']|0))return false;
  if(condition.individual018!==-1 && condition.individual018!==(f['018']|0))return false;
  if(condition.species014!==0 && condition.species014!==s.fields['14'])return false;
  return condition.field14===0||condition.field14===s.field68||s.field68===3;
}

export function battlePartyAdmission(profile,recordIndex) {
  if(!profile)return {ok:false,reason:'PROFILE_UNAVAILABLE',message:'這隻數碼獸的個體資料尚未完整。'};
  const f=profile.fields,s=conditions.species[f['000']];
  if(!s||s.fields['0c']<=1)return {ok:false,reason:'TOO_YOUNG',message:'這隻數碼獸還太幼小，暫時無法參賽。'};
  if(['134','138','13c'].some(k=>f[k]!==0))return {ok:false,reason:'CONDITION_UNFIT',message:'這隻數碼獸目前的身體狀況無法參賽。'};
  if(!nativeBattleQualification(profile,battlePartyCondition(getMatchRecord(recordIndex).field0C)))
    return {ok:false,reason:'MATCH_CONDITION',message:'這隻數碼獸不符合本場比賽的參賽條件。'};
  return {ok:true};
}

export function buildOwnedBattleCreature({instanceId,nativeProfile}) {
  const f=nativeProfile?.fields;
  if(typeof instanceId!=='string'||!f)throw new Error('BATTLE_PARTY_INDIVIDUAL_REQUIRED');
  const read=k=>{if(!Number.isInteger(f[k]))throw new Error(`BATTLE_PARTY_MISSING_FIELD_${k}`);return f[k];};
  const creature={instanceId,nativeProfile:structuredClone(nativeProfile),evidence:'ROM_VERIFIED_INDIVIDUAL_FIELDS',
    speciesId:read('000'),currentHp:read('050'),maxHp:read('058'),metricBase:read('05c'),metricLimit:read('054'),
    source12C:read('12c'),source130:read('130'),stats:{},levels:{}};
  for(const entry of BATTLE_CREATURE_STAT_MAP){
    creature.stats[`field${entry.value.toString(16).toUpperCase().padStart(2,'0')}`]=read(entry.value.toString(16).padStart(3,'0'));
    if(entry.level!==null)creature.levels[entry.preset]=read(entry.level.toString(16).padStart(3,'0'));
  }
  return deepFreeze(creature);
}

export function settleOwnedBattleIndividual(profile,{currentHp,metricLimit,verdict,mode,event=-1,cursor=1,totalRounds=1}) {
  if(![0,1].includes(mode)||![3,4,5].includes(verdict)||!Number.isInteger(currentHp)||!Number.isInteger(metricLimit))
    throw new Error('BATTLE_PARTY_UNTRACED_RESULT_CONTEXT');
  const next=structuredClone(profile),f=next.fields;
  f['050']=currentHp;f['054']=metricLimit;f['014']=35;
  if((f['024']|0)<999)f['024']=(f['024']+1)>>>0;
  if((f['050']|0)<=0){f['050']=1;f['040']=Math.min(100,(f['040']|0)+10);}
  if(event>=0 && cursor<totalRounds && verdict===4){
    // Original rounds before multiplying by three, so 101 restores 30, not 30.3.
    f['050']=Math.min(f['058'],f['050']+Math.trunc((f['058']|0)/10)*3);
    f['054']=Math.min(f['05c'],f['054']+Math.trunc((f['05c']|0)/10)*3);
  }
  next.narrowFields['044']=0;next.narrowFields['046']=0;
  if(verdict===4){
    if((f['028']|0)<999)f['028']=(f['028']+1)>>>0;
    const gain=mode===1||event===0?3:event===1?10:0;
    f['020']=Math.min(100,(f['020']|0)+gain);
  }else f['040']=Math.min(100,(f['040']|0)+10);
  return deepFreeze(next);
}

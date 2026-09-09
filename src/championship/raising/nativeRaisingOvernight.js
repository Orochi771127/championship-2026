// ARM9 02084CA0. Two ordered passes per Cage, then remaining-food aging.
// This is a child transaction of the existing Raising/save authority.
import data from '../../data/championship/catalogs/raising-lifecycle.r1.json' with {type:'json'};
import {normalizeNativeIndividualProfile} from './nativeIndividualProfile.js';
import {nativeHuntSpeciesByIndex} from '../hunt/capture/nativeHuntSources.js';
import {applyNativeRaisingCondition,NATIVE_FOOD_BITE_BY_GENERATION} from './nativeRaisingCare.js';

const add=(f,k,n)=>f[k]=(f[k]+n)>>>0;
const clamp=n=>Math.max(0,Math.min(100,n|0));
export function nativePeerAffinity(a,b) {
  if(a.fields['000']===b.fields['000'])return 3;
  const x=data.species[a.fields['000']].family,y=data.species[b.fields['000']].family;
  if(x===y)return 2;
  if(data.personalityAversion[a.fields['018']]===b.fields['018']||({1:16,16:1,8:32,32:8,2:4,4:2,128:64,64:128}[x]===y))return 0;
  return 1;
}
export function nativeCageConditionEffects(definition,season=0,level=1) {
  const row=data.cages[definition];if(!row)throw new TypeError('NATIVE_CAGE_CONDITION_REQUIRED');
  return row.commands.filter(c=>c[0]===6).map(([,interval,kind,base])=>({interval,kind,
    delta:(base+(season===1?data.conditionModifiers.summer[kind]:season===3?data.conditionModifiers.winter[kind]:0))
      *(level===2?data.conditionModifiers.level2[kind]:level===3?data.conditionModifiers.level3[kind]:1)}));
}
export function settleNativeRaisingCage(profiles,{definition,minutes,night,wasteCount,foods,spawnWaste,rng,effects=nativeCageConditionEffects(definition)}) {
  if(!Number.isInteger(minutes)||minutes<0||minutes>1440||typeof night!=='boolean'||!Number.isInteger(wasteCount)||wasteCount<0)
    throw new TypeError('NATIVE_OVERNIGHT_CONTEXT_REQUIRED');
  const next=profiles.map(p=>structuredClone(normalizeNativeIndividualProfile(p))),nextFoods=foods.map(f=>({...f}));
  if(minutes===0)return {profiles:next.map(p=>normalizeNativeIndividualProfile(p)),foods:nextFoods};
  let sick=0;
  // Original first pass deliberately skips eggs and records with age <= 0.
  for(const p of next) {
    const f=p.fields,s=nativeHuntSpeciesByIndex(f['000']),generation=s.generation;
    if((f['18c']|0)<=0||generation===0)continue;
    if(definition!==24&&definition!==25) {
      if(((f['174']+minutes)>>>0)>=240){f['174']=240;add(f,'170',minutes-240);
        f['008']=Math.max(0,(f['008']-Math.trunc(f['170']/120))|0);f['170']=((f['170']|0)%120)>>>0;}
      if(night&&(f['008']|0)<3)f['008']=3;
    }
    if(f['138']!==0)sick++;
    add(f,'190',minutes);
    const threshold=data.wasteThresholds[generation];
    if(f['190']>threshold) {
      if(definition===24||definition===25)f['190']=0;
      else if(spawnWaste(f['000']))f['190']=0;
      else f['190']=((f['190']|0)%threshold)>>>0;
    }
  }
  for(let ordinal=0;ordinal<next.length;ordinal++) {
    let p=next[ordinal],f=p.fields;const n=p.narrowFields,s=nativeHuntSpeciesByIndex(f['000']);
    if((f['18c']|0)<=0)continue;
    if(!night&&s.generation!==0) {
      while((f['008']|0)<s.field1c) {
        const food=nextFoods.find(food=>food.present);if(!food)break;
        const amount=Math.min(food.remaining,NATIVE_FOOD_BITE_BY_GENERATION[s.generation]);
        food.remaining-=amount;if(food.remaining===0||food.freshness<=0){food.remaining=0;food.present=false;}
        f['174']=0;f['170']=0;add(f,'00c',1);
        if(food.protein){n['046']=(n['046']+amount)&65535;if(n['046']>=16){f['040']=Math.min(100,(f['040']+(n['046']>>>4))|0)>>>0;n['046']-=16;}}
        if(food.freshness<=0)f['01c']=Math.min(100,(f['01c']+50)|0)>>>0;
        n['194']=(n['194']+amount)&65535;
        if(n['194']>=4){add(f,'008',1);f['050']=Math.min(f['058']|0,(f['050']+Math.trunc((f['058']|0)/100))|0)>>>0;n['194']-=4;
          if((f['008']|0)>=s.field1c){f['008']=s.field1c;f['01c']=Math.max(0,(f['01c']-10)|0);f['00c']=(Math.trunc((f['178']|0)/10)*8)>>>0;}}
      }
      if(wasteCount>0)f['01c']=Math.min(100,(f['01c']+wasteCount)|0)>>>0;
    }
    if(f['13c'])add(f,'188',minutes);else if(f['138']||f['134'])add(f,'180',minutes);
    if(f['138']===0&&sick>0&&s.generation!==0){add(f,'1b0',minutes);
      if(f['1b0']>240){if(rng.next(0x36+ordinal)%100<20*(sick+Math.trunc((f['1b0']|0)/60)*4-1)){f['01c']=100;f['138']=1;}
        f['1b0']=(((f['1b0']|0)%60)*4)>>>0;}}
    if(next.length>1){add(f,'1ac',minutes);if(f['018']===7)f['1a8']=Math.max(0,(f['1a8']-minutes)|0);
      if(f['1ac']>720){const multiplier=Math.trunc((f['1ac']|0)/60)*12;f['1ac']=(((f['1ac']|0)%60)*12)>>>0;
        let score=0;for(let j=1;j<next.length;j++){score+=nativePeerAffinity(p,next[(ordinal+j)%next.length]);f['020']=clamp(f['020']+score*multiplier);}}}
    else {if(f['018']===7)add(f,'1a8',minutes);f['1ac']=Math.max(0,(f['1ac']-minutes)|0);}
    if([15,18,28].includes(definition))for(const e of effects)for(let j=0;j<Math.trunc(Math.trunc(minutes/2)/e.interval);j++){
      p=structuredClone(applyNativeRaisingCondition(p,{...e,satietyMaximum:s.field1c}));f=p.fields;}
    add(f,'19c',minutes);add(f,'18c',minutes);next[ordinal]=p;
  }
  if(!night)for(const food of nextFoods)if(food.present&&food.freshness>0)food.freshness=Math.max(0,food.freshness-Math.trunc(minutes/2));
  return {profiles:next.map(p=>normalizeNativeIndividualProfile(p)),foods:nextFoods};
}

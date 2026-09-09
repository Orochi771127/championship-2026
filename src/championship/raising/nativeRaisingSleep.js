// OVL18 02118240 / 021182B4. Numeric Main sequence 13 belongs to the actor.
import rules from '../../data/championship/catalogs/raising-lifecycle.r1.json' with {type:'json'};
import {nativeHuntSpeciesByIndex} from '../hunt/capture/nativeHuntSources.js';
import {normalizeNativeIndividualProfile} from './nativeIndividualProfile.js';
const draw=(rng,poolSlot,max)=>Math.trunc((max-1)*rng.next(0x26+poolSlot)/102);
export function enterNativeRaisingSleep(profile,poolSlot,rng,{fromTreatment=false}={}) {
  const p=structuredClone(normalizeNativeIndividualProfile(profile)),s=rules.species[p.fields['000']];
  if(!fromTreatment){p.fields['178']=s.sleepMin+draw(rng,poolSlot,s.sleepMax-s.sleepMin);p.fields['17c']=0;}
  return normalizeNativeIndividualProfile(p);
}
export function exitNativeRaisingSleep(profile,poolSlot,rng) {
  const p=structuredClone(normalizeNativeIndividualProfile(profile)),f=p.fields,s=rules.species[f['000']],species=nativeHuntSpeciesByIndex(f['000']);
  if((f['17c']|0)<s.sleepMin){f['00c']=(Math.trunc((f['178']|0)/10)*8)>>>0;if((f['040']|0)<100)f['040']++;f['01c']=Math.min(100,(f['01c']+3)|0)>>>0;}
  else f['00c']=0;
  f['178']=species.field20+draw(rng,poolSlot,species.field22-species.field20);
  return normalizeNativeIndividualProfile(p);
}

// OVL18 0211CA00: next-morning state 25, distinct from ordinary sleep exit.
export function enterNativeRaisingMorning(profile,poolSlot,rng) {
  const p=structuredClone(normalizeNativeIndividualProfile(profile)),f=p.fields,s=nativeHuntSpeciesByIndex(f['000']);
  const waitFrames=rng.next(0)%100;
  f['050']=Math.min(f['058']|0,(f['050']+Math.trunc((f['058']|0)/30))|0)>>>0;f['00c']=0;
  f['178']=s.field20+draw(rng,poolSlot,s.field22-s.field20);
  return {profile:normalizeNativeIndividualProfile(p),waitFrames};
}

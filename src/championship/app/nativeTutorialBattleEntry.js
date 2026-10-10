// OVL10 demo species; reuse ARM9 02062100 builder and the existing Battle core.
// Cloned baseline RNG provides stable web resume, not exact native RNG history.
import {createNativeHuntIndividual} from '../hunt/capture/nativeHuntIndividual.js';
import {nativeHuntSpeciesByIndex} from '../hunt/capture/nativeHuntSources.js';
import {nativeIndividualProfile} from '../raising/nativeIndividualProfile.js';
import {restoreChannelRng} from '../battle/battleRngChannel.js';
import {createBattleRuntime} from './battleRuntime.js';
export function prepareNativeTutorialBattleEntry(snapshot){
 const rng=restoreChannelRng(snapshot);
 const individuals=[189,212,207].map((index,slot)=>{
   const individual=createNativeHuntIndividual({species:nativeHuntSpeciesByIndex(index),rng,traitOverride:-1});
   individual.fields['004']=slot;
   return Object.freeze({instanceId:`tutorial:battle:${slot}`,speciesId:`species-${index}`,nativeProfile:nativeIndividualProfile(individual)});
 });
 const runtime=createBattleRuntime({schedule:{entryMode:4},mode:1,battleType:0,playerIndividuals:individuals,rng});
 runtime.chooseMatch(61);
 return {runtime,individuals};
}

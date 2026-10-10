// ARM9 0206178C calls the existing 02062100 constructor with species 0, then
// copies the record and writes only 140=14, 1c0=128, 1c4=120 before Home insert.
import { createNativeHuntIndividual } from "../hunt/capture/nativeHuntIndividual.js";
import { nativeHuntSpeciesByIndex } from "../hunt/capture/nativeHuntSources.js";
import { nativeIndividualProfile } from "./nativeIndividualProfile.js";

// Owner-approved eight-egg selection: other eggs use their existing native
// constructor and ancestry. Only the original species0 starter forces 140=14.
export function createNativeRaisingStarter(rng,eggSpeciesIndex=0) {
  if(!Number.isInteger(eggSpeciesIndex)||eggSpeciesIndex<0||eggSpeciesIndex>7)throw new TypeError('INVALID_STARTER_EGG_SELECTION');
  const individual = createNativeHuntIndividual({ species:nativeHuntSpeciesByIndex(eggSpeciesIndex), rng });
  return nativeIndividualProfile({ ...individual, fields:{ ...individual.fields, ...(eggSpeciesIndex===0?{"140":14}:{}), "1c0":128, "1c4":120 } }, `species-${String(eggSpeciesIndex).padStart(3,'0')}`);
}

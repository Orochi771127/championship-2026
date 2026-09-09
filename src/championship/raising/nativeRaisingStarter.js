// ARM9 0206178C calls the existing 02062100 constructor with species 0, then
// copies the record and writes only 140=14, 1c0=128, 1c4=120 before Home insert.
import { createNativeHuntIndividual } from "../hunt/capture/nativeHuntIndividual.js";
import { nativeHuntSpeciesByIndex } from "../hunt/capture/nativeHuntSources.js";
import { nativeIndividualProfile } from "./nativeIndividualProfile.js";

export function createNativeRaisingStarter(rng) {
  const individual = createNativeHuntIndividual({ species:nativeHuntSpeciesByIndex(0), rng });
  return nativeIndividualProfile({ ...individual, fields:{ ...individual.fields, "140":14, "1c0":128, "1c4":120 } }, "species-000");
}

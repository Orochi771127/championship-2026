// OVL18 0210E380: Cage capacity and forty physical records. Stored position
// is relative to the Cage; the scene/body position is in native Q12 space.
import rules from '../../data/championship/catalogs/raising-lifecycle.r1.json' with {type:'json'};
export function allocateNativeRaisingWaste(waste,{speciesIndex,cageDefinitionIndex,positionQ12}) {
  const row=rules.cages[cageDefinitionIndex];
  if(!row||!rules.species[speciesIndex]||!Array.isArray(positionQ12)||positionQ12.length!==3||!positionQ12.every(Number.isInteger))throw new TypeError('NATIVE_WASTE_CONTEXT_REQUIRED');
  if(waste.filter(w=>w.present&&w.cageDefinitionIndex===cageDefinitionIndex).length>=row.capacity)return null;
  const used=new Set(waste.filter(w=>w.present).map(w=>w.slot)),slot=Array.from({length:40},(_,i)=>i).find(i=>!used.has(i));
  return slot===undefined?null:{slot,speciesIndex,cageDefinitionIndex,positionQ12:[positionQ12[0],positionQ12[1]-4096,0],present:true};
}

// Explicit product extensions. Native records remain immutable.
// Display serials never serve as persistent species identity.
import catalog from '../../data/championship/product-species-extensions.r1.json' with {type:'json'};
const clone=value=>structuredClone(value);
const byIndex=new Map(catalog.entries.map(entry=>[entry.speciesIndex,Object.freeze({...entry})]));
if(byIndex.size!==catalog.entries.length || catalog.entries.some(entry=>
  !Number.isInteger(entry.speciesIndex)||entry.speciesIndex<=228||
  entry.speciesId!==`species-${entry.speciesIndex}`||!Number.isInteger(entry.baseSpeciesIndex)||entry.baseSpeciesIndex<8||entry.baseSpeciesIndex>=228)) {
  throw new Error('PRODUCT_EXTENSION_CATALOG_INVALID');
}
export const PRODUCT_ABSENT_SPECIES_INDEX=228;
export function getProductExtension(index){return byIndex.get(index)??null;}
export function listProductExtensions(){return [...byIndex.values()];}
export function isKnownProductSpecies(index,nativeRecords){
  return Number.isInteger(index)&&index!==228&&index>=0&&
    (Boolean(nativeRecords[index]?.recordIndex===index)||byIndex.has(index));
}
export function requirePlayableProductExtension(index){
  const entry=getProductExtension(index);
  if(!entry)throw new Error('PRODUCT_EXTENSION_UNKNOWN');
  if(!entry.runtimeReady||!entry.evolutionReady)throw new Error('PRODUCT_EXTENSION_NOT_READY');
  return entry;
}
export function resolveProductSpeciesDefinition(index,nativeRecords,{allowUnready=false}={}){
  if(index===228)throw new Error('PRODUCT_SPECIES_SENTINEL_NOT_ENTITY');
  if(nativeRecords[index]?.recordIndex===index)return clone(nativeRecords[index]);
  const entry=getProductExtension(index);
  if(!entry)throw new Error('PRODUCT_SPECIES_UNKNOWN');
  if(!allowUnready)requirePlayableProductExtension(index);
  const base=nativeRecords[entry.baseSpeciesIndex];
  if(!base)throw new Error('PRODUCT_SPECIES_BASE_MISSING');
  // Explicit inherited numeric schema, with a distinct identity, never a
  // silent downgrade of the stored species ID to the donor/base ID.
  return {...clone(base),...clone(entry.speciesOverrides??{}),recordIndex:index,lookupKey:entry.entityId,
    identifier:entry.entityId.toUpperCase(),sourceEvidence:'PRODUCT_INHERITED_BASE_CANDIDATE',
    productBaseSpeciesIndex:entry.baseSpeciesIndex};
}
export function planUltimateDisplayOrder(existingEntries){
  const old=existingEntries.filter(x=>x.numberingStageIndex===6).sort((a,b)=>a.serial-b.serial);
  const bySpecies=new Map(old.map(x=>[x.speciesIndex,x]));
  if(!bySpecies.has(211)||!bySpecies.has(222))throw new Error('PRODUCT_DISPLAY_BASE_MISSING');
  const fixed=new Map([[2,clone(bySpecies.get(222))],[33,clone(bySpecies.get(211))],
    ...catalog.entries.filter(e=>e.generationIndex===6).map(e=>[e.displaySerial,{speciesIndex:e.speciesIndex,speciesId:e.speciesId,
      numberingStageIndex:6,contentStatus:'PLANNED_DISABLED'}])]);
  const rest=old.filter(x=>![211,222].includes(x.speciesIndex));
  let cursor=0;
  return Array.from({length:old.length+catalog.entries.filter(e=>e.generationIndex===6).length},(_,i)=>{
    const serial=i+1,entry=fixed.get(serial)??clone(rest[cursor++]);
    return {...entry,serial,displayCode:`UL${String(serial).padStart(2,'0')}`};
  });
}

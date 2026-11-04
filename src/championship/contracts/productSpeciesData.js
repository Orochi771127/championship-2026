import nativeSpecies from '../../data/championship/catalogs/creature-species.r1.json' with {type:'json'};
import nativeHunt from '../../data/championship/catalogs/hunt-entry.r1.json' with {type:'json'};
import nativeLifecycle from '../../data/championship/catalogs/raising-lifecycle.r1.json' with {type:'json'};
import illustrations from '../../data/championship/database-illustrations.r1.json' with {type:'json'};
import {getProductExtension,listProductExtensions,resolveProductSpeciesDefinition,requirePlayableProductExtension} from './productSpeciesExtensions.js';
import {getProductOriginal,isPlayableProductOriginal,productOriginalBehaviorDonor,productOriginalSpeciesRecord,withReadyProductOriginals} from './productOriginalSpecies.js';
// Original identities answer species lookups as data; only playable ones (runtimeReady and evolutionReady,
// Owner 2026-11-03) are known species that registration, raising, battle and saves carry. Their base index
// is their behavior donor: the native species whose traced per-species rows they read.
export function isKnownSpeciesIndex(index){return Number.isInteger(index)&&index>=0&&index!==228&&(index<228||getProductExtension(index)!==null||isPlayableProductOriginal(index));}
export function productBaseSpeciesIndex(index){if(!isKnownSpeciesIndex(index))throw new TypeError('PRODUCT_SPECIES_UNKNOWN');return getProductExtension(index)?.baseSpeciesIndex??productOriginalBehaviorDonor(index)??index;}
/** A species stored in a save that a build without product species cannot read: an extension or a playable original. */
export function isProductSpeciesIndex(index){return getProductExtension(index)!==null||isPlayableProductOriginal(index);}
export function productSpeciesRecord(index){return getProductOriginal(index)?productOriginalSpeciesRecord(index):resolveProductSpeciesDefinition(index,nativeSpecies.records,{allowUnready:true});}
export function productHuntSpecies(index){
 const base=nativeHunt.species[productBaseSpeciesIndex(index)];
 if(!isPlayableProductOriginal(index))return getProductExtension(index)?Object.freeze({...base,speciesIndex:index}):base;
 // An original keeps the donor's AI and movement but its own stage, attribute, name, stat rungs (shifted by the
 // curve difference) and ancestors (every species whose evolution branches reach it).
 const own=productOriginalSpeciesRecord(index),shift=own.statCurveIndex-nativeSpecies.records[base.speciesIndex].statCurveIndex;
 const ancestors=PRODUCT_RAISING_LIFECYCLE_RULES.rules.flatMap((list,i)=>list?.some(r=>r.target===index)?[i+8]:[]);
 return Object.freeze({...base,speciesIndex:index,generation:own.generationIndex,attribute:own.attributeIndex,baseName:illustrations.entries.find(e=>e.speciesIndex===index).displayName,
   rungs:Object.freeze(base.rungs.map(r=>Math.max(0,Math.min(26,r+shift)))),ancestors:Object.freeze(ancestors)});
}
export function productLifecycleSpecies(index){return PRODUCT_RAISING_LIFECYCLE_RULES.species[index]??nativeLifecycle.species[productBaseSpeciesIndex(index)];}
// Owner 2026-11-04: at launch a partner may evolve to 成熟期 from rank 1 (藍階); the original opens it at
// rank 2 (紅階). Capacity per rank is unchanged.
export const PRODUCT_RANK_GROWTH=Object.freeze(nativeLifecycle.ranks.map((rank,index)=>index===1?Object.freeze({...rank,generation:nativeLifecycle.ranks[2].generation}):rank));
export const PRODUCT_RAISING_LIFECYCLE_RULES=Object.freeze(withReadyProductOriginals({...nativeLifecycle,ranks:PRODUCT_RANK_GROWTH,species:Object.freeze(Object.assign({},nativeLifecycle.species,Object.fromEntries(listProductExtensions().map(e=>[e.speciesIndex,nativeLifecycle.species[e.baseSpeciesIndex]]))))}));
export function productEvolutionOptions(target){const extra=listProductExtensions().filter(e=>e.baseSpeciesIndex===target&&e.runtimeReady&&e.evolutionReady);return Object.freeze([target,...extra.map(e=>e.speciesIndex)]);}
export function requiresProductSaveVersion(value){
 if(!value||typeof value!=='object')return false;
 if(isProductSpeciesIndex(value.speciesIndex))return true;
 if(typeof value.speciesId==='string'&&isProductSpeciesIndex(Number(value.speciesId.replace(/^championship:creature:/,'').replace(/^species-/,''))))return true;
 if(value.fields&&[value.fields['000'],...Object.entries(value.fields).filter(([k])=>/^1[45][048c]$|^16[048c]$/.test(k)).map(([,v])=>v)].some(x=>isProductSpeciesIndex(x)))return true;
 if(Array.isArray(value.registeredSpecies)&&value.registeredSpecies.some(x=>isProductSpeciesIndex(x)))return true;
 if(value.productEvolutionBranches?.length)return true;
 if(typeof value.raisingHome==='string'){try{if(requiresProductSaveVersion(JSON.parse(value.raisingHome)))return true;}catch{/* save parser owns invalid JSON errors */}}
 return Object.values(value).some(v=>typeof v==='object'&&requiresProductSaveVersion(v));
}

export function assertPlayableProductSaveData(value){
 if(!value||typeof value!=='object')return;
 const check=index=>{if(getProductExtension(index))requirePlayableProductExtension(index);else if(getProductOriginal(index)&&!isPlayableProductOriginal(index))throw new Error('PRODUCT_ORIGINAL_NOT_READY');};
 check(value.speciesIndex);
 if(typeof value.speciesId==='string')check(Number(value.speciesId.replace(/^championship:creature:/,'').replace(/^species-/,'')));
 if(value.fields)for(const [key,index] of Object.entries(value.fields))if(key==='000'||/^1[45][048c]$|^16[048c]$/.test(key))check(index);
 if(typeof value.raisingHome==='string'){let nested;try{nested=JSON.parse(value.raisingHome);}catch{}if(nested)assertPlayableProductSaveData(nested);}
 for(const child of Object.values(value))if(typeof child==='object')assertPlayableProductSaveData(child);
}

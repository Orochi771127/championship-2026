import nativeSpecies from '../../data/championship/catalogs/creature-species.r1.json' with {type:'json'};
import nativeHunt from '../../data/championship/catalogs/hunt-entry.r1.json' with {type:'json'};
import nativeLifecycle from '../../data/championship/catalogs/raising-lifecycle.r1.json' with {type:'json'};
import {getProductExtension,listProductExtensions,resolveProductSpeciesDefinition,requirePlayableProductExtension} from './productSpeciesExtensions.js';
export function isKnownSpeciesIndex(index){return Number.isInteger(index)&&index>=0&&index!==228&&(index<228||getProductExtension(index)!==null);}
export function productBaseSpeciesIndex(index){if(!isKnownSpeciesIndex(index))throw new TypeError('PRODUCT_SPECIES_UNKNOWN');return getProductExtension(index)?.baseSpeciesIndex??index;}
export function productSpeciesRecord(index){return resolveProductSpeciesDefinition(index,nativeSpecies.records,{allowUnready:true});}
export function productHuntSpecies(index){const base=nativeHunt.species[productBaseSpeciesIndex(index)];return getProductExtension(index)?Object.freeze({...base,...structuredClone(getProductExtension(index).huntOverrides??{}),speciesIndex:index}):base;}
export function productLifecycleSpecies(index){return nativeLifecycle.species[productBaseSpeciesIndex(index)];}
export const PRODUCT_RAISING_LIFECYCLE_RULES=Object.freeze({...nativeLifecycle,rules:Object.freeze(Object.assign({},nativeLifecycle.rules,Object.fromEntries(listProductExtensions().filter(e=>e.generationIndex<6).map(e=>[e.speciesIndex-8,nativeLifecycle.rules[e.baseSpeciesIndex-8]])))),species:Object.freeze(Object.assign({},nativeLifecycle.species,Object.fromEntries(listProductExtensions().map(e=>[e.speciesIndex,nativeLifecycle.species[e.baseSpeciesIndex]]))))});
export function productEvolutionOptions(target){const extra=listProductExtensions().filter(e=>e.baseSpeciesIndex===target&&e.runtimeReady&&e.evolutionReady);return Object.freeze([target,...extra.map(e=>e.speciesIndex)]);}
export function requiresProductSaveVersion(value){
 if(!value||typeof value!=='object')return false;
 if(getProductExtension(value.speciesIndex))return true;
 if(typeof value.speciesId==='string'&&getProductExtension(Number(value.speciesId.replace(/^championship:creature:/,'').replace(/^species-/,''))))return true;
 if(value.fields&&[value.fields['000'],...Object.entries(value.fields).filter(([k])=>/^1[45][048c]$|^16[048c]$/.test(k)).map(([,v])=>v)].some(x=>getProductExtension(x)))return true;
 if(Array.isArray(value.registeredSpecies)&&value.registeredSpecies.some(x=>getProductExtension(x)))return true;
 if(value.productEvolutionBranches?.length)return true;
 if(typeof value.raisingHome==='string'){try{if(requiresProductSaveVersion(JSON.parse(value.raisingHome)))return true;}catch{/* save parser owns invalid JSON errors */}}
 return Object.values(value).some(v=>typeof v==='object'&&requiresProductSaveVersion(v));
}

export function assertPlayableProductSaveData(value){
 if(!value||typeof value!=='object')return;
 const check=index=>{if(getProductExtension(index))requirePlayableProductExtension(index);};
 check(value.speciesIndex);
 if(typeof value.speciesId==='string')check(Number(value.speciesId.replace(/^championship:creature:/,'').replace(/^species-/,'')));
 if(value.fields)for(const [key,index] of Object.entries(value.fields))if(key==='000'||/^1[45][048c]$|^16[048c]$/.test(key))check(index);
 if(typeof value.raisingHome==='string'){let nested;try{nested=JSON.parse(value.raisingHome);}catch{}if(nested)assertPlayableProductSaveData(nested);}
 for(const child of Object.values(value))if(typeof child==='object')assertPlayableProductSaveData(child);
}

import { AWAKENED_FORM_NAMES, AWAKENED_SECOND_TIER_NAMES } from "../../text/growthStageTerms.js";
import tools from '../../../data/championship/catalogs/hunt-tools.r1.json' with {type:'json'};
import { speciesTaxonomy } from '../../contracts/speciesTaxonomy.js';

// Owner 2026-11-10 (OWNER_APPROVED_ADAPTATION, productHuntRadarMatches): the three alignment radars find the factions that replaced the ROM
// attributes -- 16 Black Iron (was data/free), 32 Lumen (vaccine), 64 Rift (virus). The ten former free partners carry
// their faction in the taxonomy catalog; a species missing from it keeps the native alignment test.
const RADAR_FACTION_BY_ALIGNMENT={1:'LUMEN',2:'RIFT',3:'IRON'};
function radarFaction(speciesIndex,s){return speciesTaxonomy(speciesIndex)?.faction??RADAR_FACTION_BY_ALIGNMENT[s.alignment]??null;}

// 02125ED8..02125F78: OR four fitted masks; 02127884: native radar predicate.
export function nativeHuntRadarMask(indices=[]){
  return indices.reduce((mask,index)=>{
    if(!Number.isInteger(index)||index<0||index>=15)throw Error('NATIVE_RADAR_INDEX_REQUIRED');
    return mask|tools.pluginMasks.radar[index];
  },0);
}
export function nativeHuntRadarMatches(speciesIndex,mask){
  const s=tools.species[speciesIndex];if(!s)throw Error('NATIVE_RADAR_SPECIES_REQUIRED');
  if((mask&1)&&s.generation>=1&&s.generation<=2)return true;
  if((mask&2)&&s.generation===3)return true;
  if((mask&4)&&s.generation===4)return true;
  if((mask&8)&&s.generation===5)return true;
  if((mask&16)&&s.alignment>=3&&s.alignment<=4)return true;
  if((mask&32)&&s.alignment===1)return true;
  if((mask&64)&&s.alignment===2)return true;
  return !!(mask&(s.family<<7));
}
/** The product radar: the native predicate, with the three alignment bits reading the taxonomy factions. */
export function productHuntRadarMatches(speciesIndex,mask){
  const s=tools.species[speciesIndex];if(!s)throw Error('NATIVE_RADAR_SPECIES_REQUIRED');
  if(mask&(16|32|64)){const f=radarFaction(speciesIndex,s);
    if(((mask&16)&&f==='IRON')||((mask&32)&&f==='LUMEN')||((mask&64)&&f==='RIFT'))return true;}
  return nativeHuntRadarMatches(speciesIndex,mask&~(16|32|64));
}

// Product localization of text-bank 1BB..1D8. The field identities and selectors
// are original; words are the presentation layer's Traditional Chinese copy.
const generations=['培育蛋','幼年期 I','幼年期 II','成長期','成熟期',AWAKENED_FORM_NAMES['zh-Hant'],AWAKENED_SECOND_TIER_NAMES['zh-Hant']];
const families=['—','獸族','機巧族','森羅族','羽翼族','龍族','海淵族','星靈族','幽冥族'];
const factions={LUMEN:'心輝',IRON:'黑鐵',RIFT:'裂隙'};
const personalities=['坦率','任性','急躁','悠閒','熱血','冷靜','大膽','膽小','???'];
export function nativeHuntAnalyzedFields(target,fields=[]){
  const s=tools.species[target.speciesIndex];if(!s)return {};
  // 02127244 picks the lowest set family bit, including the zero-family case.
  const family=s.family===0?0:32-Math.clz32((~s.family&(s.family-1))>>>0)+1;
  return {
    generation:fields.includes('GENERATION')?generations[s.generation]??'???':'???',
    family:fields.includes('FAMILY')?families[family]??'???':'???',
    alignment:fields.includes('ALIGNMENT')?(s.generation<3?'無':factions[radarFaction(target.speciesIndex,s)]??'???'):'???',
    hp:fields.includes('HP')&&Number.isFinite(target.maxHp)?String(target.maxHp):'???',
    personality:fields.includes('PERSONALITY')?personalities[target.personalityIndex]??'???':'???',
    capacity:fields.includes('CAPACITY')?`${s.displayCapacityG} G`:'???'
  };
}

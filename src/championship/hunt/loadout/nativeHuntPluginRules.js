import tools from '../../../data/championship/catalogs/hunt-tools.r1.json' with {type:'json'};

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

// Product localization of text-bank 1BB..1D8. The field identities and selectors
// are original; words are the presentation layer's Traditional Chinese copy.
const generations=['數碼蛋','幼年期 I','幼年期 II','成長期','成熟期','完全體','究極體'];
const families=['—','獸','機械','昆蟲／植物','鳥','龍','水','聖','暗黑'];
const alignments=['無','疫苗','病毒','資料','自由'];
const personalities=['坦率','任性','急躁','悠閒','熱血','冷靜','大膽','膽小','???'];
export function nativeHuntAnalyzedFields(target,fields=[]){
  const s=tools.species[target.speciesIndex];if(!s)return {};
  // 02127244 picks the lowest set family bit, including the zero-family case.
  const family=s.family===0?0:32-Math.clz32((~s.family&(s.family-1))>>>0)+1;
  return {
    generation:fields.includes('GENERATION')?generations[s.generation]??'???':'???',
    family:fields.includes('FAMILY')?families[family]??'???':'???',
    alignment:fields.includes('ALIGNMENT')?alignments[s.alignment]??'???':'???',
    hp:fields.includes('HP')&&Number.isFinite(target.maxHp)?String(target.maxHp):'???',
    personality:fields.includes('PERSONALITY')?personalities[target.personalityIndex]??'???':'???',
    capacity:fields.includes('CAPACITY')?`${s.displayCapacityG} G`:'???'
  };
}

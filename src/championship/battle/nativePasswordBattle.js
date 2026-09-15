// Original Password Battle team codec.
// ARM9 02094DB8..02095988; CPU receipt: PASSWORD_BATTLE_CODEC_CPU_2026-09-14.
// The characters are functional input symbols from the verified codec, not a
// copied visual asset.  The constructor concatenates four banks, then sorts
// their 257 unique UTF-16 code units before mixed-radix conversion.
import passwordSpecies from '../../data/championship/catalogs/password-battle-species.r1.json' with {type:'json'};
import {deepFreeze} from '../contracts/championshipContracts.js';
import {nativeIndividualProfile,NATIVE_INDIVIDUAL_WORDS} from '../raising/nativeIndividualProfile.js';
import {creatureStatValue} from './battleCreatureBuild.js';
import {buildOwnedBattleCreature} from './battleParty.js';
import {createNativeHuntIndividual} from '../hunt/capture/nativeHuntIndividual.js';
import {nativeHuntSpeciesByIndex} from '../hunt/capture/nativeHuntSources.js';

const SOURCE_ALPHABET=
  '！＃＄％＆）＊＋－．／０１２３４５６７８９：＞？＠ＡＢＣＤＥＦＧＨＪＫＬＭＮＰＱＲＳＴＵＶＷＸＹＺ＿ａｂｄｅｆｈｉｊｍｎｒｔｙ'+
  'ぁあぃいぅうぇえぉおかがきぎくぐけげこごさざじすずせぜそぞただちぢっつづてでとどなにぬねのはばぱひびぴふぶぷべぺほぼぽまみむめもゃやゅゆょよらりるれわをん'+
  'ァアィイゥウェエォオカガキギクグケゲコゴサザシジスズセゼソゾタダチヂッツヅテデトドナニヌネノハバパヒビピフブプホボポマミムメモャヤュユョヨラルロワヲン'+
  '三四五六七九月火水木金土日氷雷光闇空石人王神心技体進型系白黒赤青黄緑完全究極団家族真';
export const NATIVE_PASSWORD_ALPHABET=Object.freeze([...SOURCE_ALPHABET].sort((a,b)=>a.charCodeAt(0)-b.charCodeAt(0)));
export const NATIVE_PASSWORD_MAX_LENGTH=22;
const ALPHABET_INDEX=new Map(NATIVE_PASSWORD_ALPHABET.map((character,index)=>[character,index]));
const CANONICAL='－－ニニ＋り．：１１１００べぺカくく３ＵＵＶＶヒＷＸＺＰＳＫＣ９９ハ';
const ALTERNATES='ー一二＝十リ，；｜ｌＩＯｏベペ力＜（ろしｕレｖ化ｗｘｚｐｓｋｃｑｇ八';
const NORMALIZATION=new Map([...ALTERNATES].map((character,index)=>[character,CANONICAL[index]]));
const COMPACT_FIELDS=Object.freeze([
  ['speciesIndex',228],['personalityIndex',8],['levelTens',5],['hpSteps',256],['tpSteps',128],
  ['level84',4],['level88',4],['level8C',4],['level90',4],
  ['level94',7],['level98',7],['level9C',7],['levelA0',7],['levelA4',7]
]);
const hex=n=>n.toString(16).padStart(3,'0');
const integer=(value,min,max,label)=>{
  if(!Number.isInteger(value)||value<min||value>max)throw new Error(`PASSWORD_BATTLE_INVALID_${label}`);
  return value;
};

function checksum(value){
  let current=0;
  for(let index=0;index<NATIVE_PASSWORD_MAX_LENGTH;index++){
    const byte=Number((value>>BigInt(index*8))&255n);
    current=(byte-current-1)&255;
  }
  return current;
}

function normalizedCharacters(password){
  if(typeof password!=='string')throw new Error('PASSWORD_BATTLE_PASSWORD_REQUIRED');
  // Web input adaptation, not codec behaviour: phone keyboards type half-width
  // letters, digits and symbols, and copied codes carry spaces. The codec's
  // symbols are the full-width forms (U+FF01..U+FF5E) and none is whitespace.
  const characters=[...password.replace(/\s+/gu,'')].map(character=>{
    const code=character.charCodeAt(0);
    const wide=code>=0x21&&code<=0x7e?String.fromCharCode(code+0xfee0):character;
    return NORMALIZATION.get(wide)??wide;
  });
  if(characters.length<1||characters.length>NATIVE_PASSWORD_MAX_LENGTH)throw new Error('PASSWORD_BATTLE_LENGTH');
  while(characters.length<NATIVE_PASSWORD_MAX_LENGTH)characters.push(NATIVE_PASSWORD_ALPHABET[0]);
  return characters;
}

function pop(state,base){
  const radix=BigInt(base),value=Number(state.value%radix);state.value/=radix;return value;
}

function nativeProfileFromCompact(compact,placeholder=null){
  const species=passwordSpecies.records[compact.speciesIndex];
  if(!species)throw new Error('PASSWORD_BATTLE_UNKNOWN_SPECIES');
  const base=species.fields;
  const seed=placeholder?structuredClone(placeholder):{
    fields:Object.fromEntries(NATIVE_INDIVIDUAL_WORDS.map(key=>[key,0])),
    narrowFields:{'03c':0,'03d':0,'044':0,'046':0,'194':0},name:''
  };
  const fields=seed.fields;
  if(!placeholder){
    fields['004']=0xffffffff;
    for(let offset=0x140;offset<0x170;offset+=4)fields[hex(offset)]=228;
    fields['1b8']=0xffffffff;
  }
  fields['000']=compact.speciesIndex;
  fields['018']=compact.personalityIndex;
  const hp=creatureStatValue(base['30'],0)+compact.hpSteps*10;
  const tp=creatureStatValue(base['32'],1)+compact.tpSteps;
  fields['050']=fields['058']=hp;
  fields['054']=fields['05c']=tp;
  const directLevels=[
    [0x84,0x34,'level84'],[0x88,0x36,'level88'],[0x8c,0x38,'level8C'],[0x90,0x39,'level90']
  ];
  const centeredLevels=[
    [0x94,0x3c,'level94'],[0x98,0x3d,'level98'],[0x9c,0x3e,'level9C'],[0xa0,0x3f,'levelA0'],[0xa4,0x40,'levelA4']
  ];
  for(const [offset,source,key] of directLevels)fields[hex(offset)]=base[source.toString(16)]+compact[key];
  for(const [offset,source,key] of centeredLevels)fields[hex(offset)]=base[source.toString(16)]+compact[key]-3;
  const sourcePair=compact.personalityIndex===base['48']?[base['50'],base['54']]
    :compact.personalityIndex===base['4c']?[base['58'],base['5c']]:[base['60'],base['64']];
  fields['12c']=sourcePair[0];fields['130']=sourcePair[1];
  seed.narrowFields['044']=compact.levelTens*10;
  for(const [key,value] of Object.entries(fields))if(!Number.isInteger(value)||value<0||value>0xffffffff)
    throw new Error(`PASSWORD_BATTLE_REBUILT_FIELD_${key}_${value}`);
  return nativeIndividualProfile(seed);
}

export function normalizeNativePassword(password){
  const characters=normalizedCharacters(password);
  // Match the encoder's display form: high zero digits are omitted, but at
  // least the lowest digit remains visible.
  while(characters.length>1&&characters.at(-1)===NATIVE_PASSWORD_ALPHABET[0])characters.pop();
  return characters.join('');
}

export function createNativePasswordPlaceholders(rng){
  if(!rng||typeof rng.next!=='function')throw new Error('PASSWORD_BATTLE_RNG_REQUIRED');
  // OVL9 021782D4..02178358 constructs three species-34 records before the
  // decoder overwrites the compact fields. Unwritten combat stats deliberately
  // remain those constructor values, including their original RNG draws.
  return deepFreeze(Array.from({length:3},()=>nativeIndividualProfile(createNativeHuntIndividual({
    species:nativeHuntSpeciesByIndex(34),rng,traitOverride:-1,nameOverride:''
  }))));
}

export function decodeNativePasswordTeam(password,{placeholders=null,instancePrefix='password'}={}){
  if(placeholders!==null&&(!Array.isArray(placeholders)||placeholders.length!==3))throw new Error('PASSWORD_BATTLE_PLACEHOLDERS_REQUIRED');
  if(typeof instancePrefix!=='string'||!instancePrefix)throw new Error('PASSWORD_BATTLE_INSTANCE_PREFIX_REQUIRED');
  const characters=normalizedCharacters(password);
  let value=0n;
  for(let index=NATIVE_PASSWORD_MAX_LENGTH-1;index>=0;index--){
    const digit=ALPHABET_INDEX.get(characters[index]);
    if(digit===undefined)throw new Error('PASSWORD_BATTLE_CHARACTER');
    value=value*257n+BigInt(digit);
  }
  const suppliedChecksum=Number(value&255n);value>>=8n;
  if(checksum(value)!==suppliedChecksum)throw new Error('PASSWORD_BATTLE_CHECKSUM');
  const state={value},presenceMask=pop(state,8),members=new Array(3).fill(null);
  for(let slot=0;slot<3;slot++){
    if((presenceMask&(1<<slot))===0)continue;
    const compact={};
    for(let index=COMPACT_FIELDS.length-1;index>=0;index--){
      const [key,base]=COMPACT_FIELDS[index];compact[key]=pop(state,base);
    }
    const extra=pop(state,4),nativeProfile=nativeProfileFromCompact(compact,placeholders?.[slot]??null);
    const instanceId=`${instancePrefix}:${slot}`;
    members[slot]=deepFreeze({slot,extra,compact:deepFreeze(compact),instanceId,nativeProfile,
      battleCreature:buildOwnedBattleCreature({instanceId,nativeProfile})});
  }
  const teamField=pop(state,5);
  return deepFreeze({evidence:'ROM_VERIFIED_PASSWORD_CODEC',password:normalizeNativePassword(password),presenceMask,teamField,
    members,ignoredHighPayload:state.value.toString()});
}

function speciesAdmissible(speciesIndex){
  return Number.isInteger(speciesIndex)&&speciesIndex>=0&&speciesIndex<224&&nativeHuntSpeciesByIndex(speciesIndex).generation>=2;
}

export function nativePasswordTeamAdmission(team){
  if(!team||!Array.isArray(team.members)||team.members.length!==3)throw new Error('PASSWORD_BATTLE_TEAM_REQUIRED');
  const members=team.members.filter(Boolean);
  if(!members.length)return deepFreeze({ok:false,reason:'EMPTY_TEAM',message:'密碼中沒有可參戰的數碼獸。'});
  for(const member of members){
    if(!speciesAdmissible(member.nativeProfile.fields['000']))
      return deepFreeze({ok:false,reason:'INELIGIBLE_SPECIES',message:'密碼中含有目前不能參戰的數碼獸。'});
  }
  return deepFreeze({ok:true,members:members.length});
}

// A code for an individual this game's own Password Battle would refuse is
// never offered: the same species rule as nativePasswordTeamAdmission.
export function nativePasswordProfileAdmission(profile){
  if(!profile?.fields)return deepFreeze({ok:false,reason:'PROFILE_UNAVAILABLE',message:'這隻數碼獸的個體資料尚未完整。'});
  if(!speciesAdmissible(profile.fields['000']))
    return deepFreeze({ok:false,reason:'INELIGIBLE_SPECIES',message:'這隻數碼獸還不能密碼化。'});
  return deepFreeze({ok:true});
}

// ARM9 02092468 initializes the 0x44-byte team: every member +0x24 word and
// the +0x40 byte start at 1. This game has no strategy editor that changes them.
export const NATIVE_PASSWORD_TEAM_DEFAULTS=Object.freeze({extra:1,teamField:1});

// ARM9 0209338C PROFILE_PACK: the compact record one individual contributes.
// Deltas below the species base become 0. Nothing clamps above: the range
// checks call 020431C8, which is empty in this build, and 020955C8 pushes the
// stored integer unchanged. Receipt: PASSWORD_TEAM_PACK_CPU_2026-09-15.json.
export function nativePasswordCompactFromProfile(profile){
  const f=profile?.fields,levelByte=profile?.narrowFields?.['044'];
  if(!f||!Number.isInteger(levelByte))throw new Error('PASSWORD_BATTLE_PROFILE_REQUIRED');
  const species=passwordSpecies.records[f['000']];
  if(!species)throw new Error('PASSWORD_BATTLE_UNKNOWN_SPECIES');
  // <=0 also turns Math.trunc's -0 into a plain 0.
  const b=species.fields,floor0=value=>value<=0?0:value;
  return deepFreeze({
    speciesIndex:f['000'],personalityIndex:f['018'],levelTens:Math.trunc(levelByte/10),
    hpSteps:floor0(Math.trunc(((f['058']-creatureStatValue(b['30'],0))|0)/10)),
    tpSteps:floor0((f['05c']-creatureStatValue(b['32'],1))|0),
    level84:floor0((f['084']-b['34'])|0),level88:floor0((f['088']-b['36'])|0),
    level8C:floor0((f['08c']-b['38'])|0),level90:floor0((f['090']-b['39'])|0),
    level94:floor0((f['094']+3-b['3c'])|0),level98:floor0((f['098']+3-b['3d'])|0),
    level9C:floor0((f['09c']+3-b['3e'])|0),levelA0:floor0((f['0a0']+3-b['3f'])|0),
    levelA4:floor0((f['0a4']+3-b['40'])|0)
  });
}

const PASSWORD_BUFFER=(1n<<BigInt(NATIVE_PASSWORD_MAX_LENGTH*8))-1n;
// ARM9 020950B8: team byte, then members from slot 2 down (extra word, then the
// compact record), then the presence mask and the checksum byte. 020955C8
// multiplies and adds inside the 22-byte buffer allocated at 020956B8.
function packNativePassword(teamField,members){
  const push=(value,radix,stored)=>(((value*BigInt(radix))&PASSWORD_BUFFER)+BigInt(stored))&PASSWORD_BUFFER;
  let presenceMask=0,value=BigInt(teamField)&PASSWORD_BUFFER;
  for(let slot=2;slot>=0;slot--){
    const member=members[slot];if(!member)continue;
    presenceMask|=1<<slot;
    value=push(value,4,member.extra);
    for(const [key,base] of COMPACT_FIELDS)value=push(value,base,member.compact[key]);
  }
  value=push(value,8,presenceMask);
  value=push(value,256,checksum(value));
  const output=[];
  for(let index=0;index<NATIVE_PASSWORD_MAX_LENGTH;index++){
    output.push(NATIVE_PASSWORD_ALPHABET[Number(value%257n)]);value/=257n;
  }
  while(output.length>1&&output.at(-1)===NATIVE_PASSWORD_ALPHABET[0])output.pop();
  return output.join('');
}

export function encodeNativePasswordTeam(team){
  if(!team||!Array.isArray(team.members)||team.members.length!==3)throw new Error('PASSWORD_BATTLE_TEAM_REQUIRED');
  const teamField=integer(team.teamField,0,4,'TEAM_FIELD');
  const members=team.members.map(member=>member?{
    extra:integer(member.extra,0,3,'EXTRA'),
    compact:Object.fromEntries(COMPACT_FIELDS.map(([key,base])=>[key,integer(member.compact?.[key],0,base-1,key.toUpperCase())]))
  }:null);
  return packNativePassword(teamField,members);
}

// The team panel's code (ARM9 020511A4 -> 020950B8) for up to three current
// individuals in slot order; a null slot is an empty member. Extras and the team
// byte default to the original fresh team and are stored words, not reduced.
export function encodeNativePasswordTeamFromProfiles(profiles,{extras=[],teamField=NATIVE_PASSWORD_TEAM_DEFAULTS.teamField}={}){
  if(!Array.isArray(profiles)||profiles.length<1||profiles.length>3||!profiles.some(Boolean))throw new Error('PASSWORD_BATTLE_TEAM_SIZE');
  const word=(value,label)=>{if(!Number.isInteger(value)||value<0||value>0xffffffff)throw new Error(`PASSWORD_BATTLE_INVALID_${label}`);return value;};
  const members=[0,1,2].map(slot=>profiles[slot]
    ?{extra:word(extras[slot]??NATIVE_PASSWORD_TEAM_DEFAULTS.extra,'EXTRA'),compact:nativePasswordCompactFromProfile(profiles[slot])}:null);
  return packNativePassword(word(teamField,'TEAM_FIELD')&0xff,members);
}

if(NATIVE_PASSWORD_ALPHABET.length!==257||new Set(NATIVE_PASSWORD_ALPHABET).size!==257
  ||passwordSpecies.recordCount!==228||CANONICAL.length!==ALTERNATES.length)throw new Error('PASSWORD_BATTLE_CATALOG_INVALID');

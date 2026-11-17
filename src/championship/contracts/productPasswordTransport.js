// Pure compact-data codec: successful decoding is NOT permission to render or
// battle. The public Championship password API applies the readiness gate.
import {deepFreeze} from './championshipContracts.js';
import {PRODUCT_PASSWORD_PREFIX,productTransportHeader,encodeProductBattleEnvelope,decodeProductBattleEnvelope,
  productTransportError,productTransportInteger,exactTransportKeys,requireKnownTransportSpecies} from './productBattleTransport.js';
const FIELDS=Object.freeze({personalityIndex:7,levelTens:4,hpSteps:255,tpSteps:127,
  level84:3,level88:3,level8C:3,level90:3,level94:6,level98:6,level9C:6,levelA0:6,levelA4:6});
const KEYS=Object.freeze(['speciesIndex',...Object.keys(FIELDS)]);
// SKILL_IMPRINT_SCROLL 2026-11-17: a member may also carry its own two special skills (0 = none, 1..30), present
// only when they differ from the pair the password rebuilds from species and personality.
const SKILL_KEYS=Object.freeze([...KEYS,'skills']);
const SKILL_MAX=30;
function validateTeam(team){
  if(!exactTransportKeys(team,['teamField','members'])||!Array.isArray(team.members)||team.members.length!==3)
    throw productTransportError('PASSWORD_TEAM_SHAPE');
  const teamField=productTransportInteger(team.teamField,0,4,'TEAM_FIELD');
  const members=Array.from(team.members,member=>{
    if(member===null)return null;
    if(!exactTransportKeys(member,['extra','compact'])
      ||!(exactTransportKeys(member.compact,KEYS)||exactTransportKeys(member.compact,SKILL_KEYS)))throw productTransportError('PASSWORD_MEMBER_SHAPE');
    const compact={speciesIndex:requireKnownTransportSpecies(member.compact.speciesIndex)};
    for(const [key,max] of Object.entries(FIELDS))compact[key]=productTransportInteger(member.compact[key],0,max,key.toUpperCase());
    if(Object.hasOwn(member.compact,'skills')){
      const skills=member.compact.skills;
      if(!Array.isArray(skills)||skills.length!==2)throw productTransportError('PASSWORD_MEMBER_SHAPE');
      compact.skills=skills.map(skill=>productTransportInteger(skill,0,SKILL_MAX,'SKILL'));
    }
    return {extra:productTransportInteger(member.extra,0,3,'EXTRA'),compact};
  });
  if(!members.some(Boolean))throw productTransportError('EMPTY_TEAM');
  return deepFreeze({teamField,members});
}
export function encodeProductPasswordData(team){
  const normalized=validateTeam(team);
  return encodeProductBattleEnvelope(PRODUCT_PASSWORD_PREFIX,{...productTransportHeader('PASSWORD_TEAM'),...normalized});
}
export function decodeProductPasswordData(code){
  const decoded=decodeProductBattleEnvelope(PRODUCT_PASSWORD_PREFIX,code),p=decoded.payload;
  if(!exactTransportKeys(p,['version','catalogRevision','catalog','kind','teamField','members'])||p.kind!=='PASSWORD_TEAM')
    throw productTransportError('PASSWORD_PAYLOAD_SHAPE');
  const team=validateTeam({teamField:p.teamField,members:p.members});
  return deepFreeze({...team,password:decoded.code,version:2,catalogRevision:p.catalogRevision});
}

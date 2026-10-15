import {battleTransportText} from '../text/battleTransportText.js';
// Link Battle's gameplay packet boundary is original evidence; the printable
// invite/reply envelope is the web transport chosen for Championship 2026.
// OVL9 sends one 0x44-byte team followed by up to three 0x1C8-byte individuals,
// has the host select the arena, then seeds the shared battle RNG with 0x14.
import {deepFreeze} from '../contracts/championshipContracts.js';
import {nativeIndividualProfile,NATIVE_INDIVIDUAL_WORDS} from '../raising/nativeIndividualProfile.js';
import {createChannelRng,BATTLE_RNG_TRACED_MASTER_SEED} from './battleRngChannel.js';
import {getProductExtension} from '../contracts/productSpeciesExtensions.js';
import {PRODUCT_LINK_PREFIX,PRODUCT_BATTLE_CATALOG,PRODUCT_BATTLE_CATALOG_REVISION,PRODUCT_BATTLE_TRANSPORT_EVIDENCE,
  productTransportHeader,encodeProductBattleEnvelope,decodeProductBattleEnvelope,exactTransportKeys,requireReadyTransportSpecies} from '../contracts/productBattleTransport.js';

export const NATIVE_LINK_ARENAS=Object.freeze([0,1,2,3,4,5,7]);
export const NATIVE_LINK_BATTLE_MASTER_SEED=BATTLE_RNG_TRACED_MASTER_SEED;
export const LINK_PACKET_EVIDENCE='ROM_VERIFIED_TEAM_0X44_INDIVIDUAL_0X1C8';
export const LINK_TRANSPORT_EVIDENCE='OWNER_AUTHORIZED_WEB_ADAPTATION_MANUAL_CODE';
const WORDS=NATIVE_INDIVIDUAL_WORDS;
const NARROW=Object.freeze(['03c','03d','044','046','194']);
const ANCESTRY=Object.freeze(Array.from({length:12},(_,index)=>(0x140+index*4).toString(16)));
const hasProductAncestry=fields=>ANCESTRY.some(key=>getProductExtension(fields?.[key]));
const PREFIX='CM26-LINK-1.';
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});

function linkError(message){return new Error(`LINK_BATTLE_${message}`);}
function checksum(bytes){
  let value=0x811c9dc5;
  for(const byte of bytes){value^=byte;value=Math.imul(value,0x01000193)>>>0;}
  return value.toString(16).padStart(8,'0');
}
function base64Url(bytes){
  let binary='';for(let start=0;start<bytes.length;start+=0x4000)binary+=String.fromCharCode(...bytes.subarray(start,start+0x4000));
  return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
function fromBase64Url(text){
  if(typeof text!=='string'||text.length<1||text.length>50000||!/^[A-Za-z0-9_-]+$/.test(text))throw linkError('CODE_FORMAT');
  const padded=text.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-text.length%4)%4);
  let binary;try{binary=atob(padded);}catch{throw linkError('CODE_FORMAT');}
  return Uint8Array.from(binary,character=>character.charCodeAt(0));
}
function encodeEnvelope(payload){
  const body=encoder.encode(JSON.stringify(payload));
  return `${PREFIX}${checksum(body)}.${base64Url(body)}`;
}
function decodeEnvelope(code){
  if(typeof code!=='string')throw linkError('CODE_REQUIRED');
  const normalized=code.trim(),parts=normalized.split('.');
  if(parts.length!==3||`${parts[0]}.`!==PREFIX||!/^[0-9a-f]{8}$/.test(parts[1]))throw linkError('CODE_FORMAT');
  const body=fromBase64Url(parts[2]);if(checksum(body)!==parts[1])throw linkError('CODE_CHECKSUM');
  try{return {payload:JSON.parse(decoder.decode(body)),id:parts[1],code:normalized};}
  catch(error){if(error?.message?.startsWith('LINK_BATTLE_'))throw error;throw linkError('CODE_PAYLOAD');}
}
function assertTransportSpecies(index,version){
  if(version===2)return requireReadyTransportSpecies(index);
  if(getProductExtension(index))throw linkError('V2_REQUIRED');
  if(!Number.isInteger(index)||index<0||index>227)throw linkError('PROFILE_SPECIES');
}
function compactProfile(profile,version=1){
  assertTransportSpecies(profile?.fields?.['000'],version);
  if(version===1&&hasProductAncestry(profile?.fields))throw linkError('V2_REQUIRED');
  const value=nativeIndividualProfile(profile);
  return [WORDS.map(key=>value.fields[key]),NARROW.map(key=>value.narrowFields[key]),value.name];
}
function expandProfile(value,version=1){
  if(!Array.isArray(value)||value.length!==3||!Array.isArray(value[0])||value[0].length!==WORDS.length
    ||!Array.isArray(value[1])||value[1].length!==NARROW.length||typeof value[2]!=='string')throw linkError('PROFILE_SHAPE');
  assertTransportSpecies(value[0][WORDS.indexOf('000')],version);
  if(version===1&&ANCESTRY.some(key=>getProductExtension(value[0][WORDS.indexOf(key)])))throw linkError('V2_REQUIRED');
  return nativeIndividualProfile({fields:Object.fromEntries(WORDS.map((key,index)=>[key,value[0][index]])),
    narrowFields:Object.fromEntries(NARROW.map((key,index)=>[key,value[1][index]])),name:value[2]});
}
function compactTeam(individuals,version=1){
  if(!Array.isArray(individuals)||individuals.length<1||individuals.length>3)throw linkError('TEAM_SIZE');
  return Array.from(individuals,entry=>compactProfile(entry?.nativeProfile,version));
}
function expandTeam(values,prefix,version=1){
  if(!Array.isArray(values)||values.length<1||values.length>3)throw linkError('TEAM_SIZE');
  return deepFreeze(Array.from(values,(value,index)=>deepFreeze({instanceId:`${prefix}:${index}`,nativeProfile:expandProfile(value,version)})));
}
function assertPayload(value,kind){
  if(!value||typeof value!=='object'||Array.isArray(value)||value.version!==1||value.kind!==kind)throw linkError('CODE_KIND');
}

export function createNativeLinkInvite({individuals,arenaIndex}={}){
  if(!NATIVE_LINK_ARENAS.includes(arenaIndex))throw linkError('ARENA');
  const payload={version:1,kind:'INVITE',arenaIndex,host:compactTeam(individuals)};
  const code=encodeEnvelope(payload),id=code.split('.')[1];
  return deepFreeze({evidence:LINK_PACKET_EVIDENCE,transport:LINK_TRANSPORT_EVIDENCE,id,code,arenaIndex});
}

export function readNativeLinkInvite(code){
  const decoded=decodeEnvelope(code);assertPayload(decoded.payload,'INVITE');
  const {arenaIndex,host}=decoded.payload;if(!NATIVE_LINK_ARENAS.includes(arenaIndex))throw linkError('ARENA');
  return deepFreeze({id:decoded.id,code:decoded.code,arenaIndex,hostIndividuals:expandTeam(host,'link-host')});
}

export function createNativeLinkReply({inviteCode,individuals}={}){
  const invite=readNativeLinkInvite(inviteCode);
  const payload={version:1,kind:'REPLY',inviteId:invite.id,guest:compactTeam(individuals)};
  return deepFreeze({evidence:LINK_PACKET_EVIDENCE,transport:LINK_TRANSPORT_EVIDENCE,
    inviteId:invite.id,code:encodeEnvelope(payload),arenaIndex:invite.arenaIndex,hostIndividuals:invite.hostIndividuals});
}

export function readNativeLinkReply(inviteCode,replyCode){
  const invite=readNativeLinkInvite(inviteCode),decoded=decodeEnvelope(replyCode);assertPayload(decoded.payload,'REPLY');
  if(decoded.payload.inviteId!==invite.id)throw linkError('REPLY_FOR_DIFFERENT_INVITE');
  return deepFreeze({inviteId:invite.id,arenaIndex:invite.arenaIndex,hostIndividuals:invite.hostIndividuals,
    guestIndividuals:expandTeam(decoded.payload.guest,'link-guest')});
}

export function createNativeLinkBattleRng(){return createChannelRng(NATIVE_LINK_BATTLE_MASTER_SEED);}


// Compatibility wrappers. Native-only peers still exchange the unchanged v1
// bytes. A host may explicitly choose version 2 before inviting a v2 guest.
// The exact catalog manifest is the negotiated capability set; a mismatched
// reply is rejected before profiles are admitted or battle state is changed.
const hasProductSpecies=individuals=>Array.isArray(individuals)&&individuals.some(entry=>getProductExtension(entry?.nativeProfile?.fields?.['000'])||hasProductAncestry(entry?.nativeProfile?.fields));
function assertProductLinkPayload(value,kind){
  const tail=kind==='INVITE'?['arenaIndex','host']:['inviteId','guest'];
  if(!exactTransportKeys(value,['version','catalogRevision','catalog','kind',...tail])||value.kind!==kind)throw linkError('CODE_KIND');
}
export function createChampionshipLinkInvite({individuals,arenaIndex,transportVersion=hasProductSpecies(individuals)?2:1}={}){
  if(transportVersion===1)return createNativeLinkInvite({individuals,arenaIndex});
  if(transportVersion!==2)throw linkError('UNSUPPORTED_VERSION');
  if(!NATIVE_LINK_ARENAS.includes(arenaIndex))throw linkError('ARENA');
  const payload={...productTransportHeader('INVITE'),arenaIndex,host:compactTeam(individuals,2)};
  const code=encodeProductBattleEnvelope(PRODUCT_LINK_PREFIX,payload),id=code.split('.')[1];
  return deepFreeze({evidence:LINK_PACKET_EVIDENCE,transport:PRODUCT_BATTLE_TRANSPORT_EVIDENCE,
    version:2,catalogRevision:PRODUCT_BATTLE_CATALOG_REVISION,catalog:PRODUCT_BATTLE_CATALOG,id,code,arenaIndex});
}
export function readChampionshipLinkInvite(code){
  if(typeof code!=='string'||code.trim().startsWith(PREFIX))return readNativeLinkInvite(code);
  const decoded=decodeProductBattleEnvelope(PRODUCT_LINK_PREFIX,code);assertProductLinkPayload(decoded.payload,'INVITE');
  const {arenaIndex,host}=decoded.payload;if(!NATIVE_LINK_ARENAS.includes(arenaIndex))throw linkError('ARENA');
  return deepFreeze({id:decoded.id,code:decoded.code,version:2,catalogRevision:PRODUCT_BATTLE_CATALOG_REVISION,
    catalog:PRODUCT_BATTLE_CATALOG,arenaIndex,hostIndividuals:expandTeam(host,'link-host',2)});
}
export function createChampionshipLinkReply({inviteCode,individuals}={}){
  const invite=readChampionshipLinkInvite(inviteCode);
  if(invite.version!==2){
    if(hasProductSpecies(individuals))throw linkError('V2_INVITE_REQUIRED');
    return createNativeLinkReply({inviteCode,individuals});
  }
  const payload={...productTransportHeader('REPLY'),inviteId:invite.id,guest:compactTeam(individuals,2)};
  return deepFreeze({evidence:LINK_PACKET_EVIDENCE,transport:PRODUCT_BATTLE_TRANSPORT_EVIDENCE,
    version:2,catalogRevision:PRODUCT_BATTLE_CATALOG_REVISION,catalog:PRODUCT_BATTLE_CATALOG,
    inviteId:invite.id,code:encodeProductBattleEnvelope(PRODUCT_LINK_PREFIX,payload),arenaIndex:invite.arenaIndex,hostIndividuals:invite.hostIndividuals});
}
export function readChampionshipLinkReply(inviteCode,replyCode){
  const invite=readChampionshipLinkInvite(inviteCode);
  if(invite.version!==2){
    if(typeof replyCode==='string'&&!replyCode.trim().startsWith(PREFIX))throw linkError('VERSION_MISMATCH');
    return readNativeLinkReply(inviteCode,replyCode);
  }
  if(typeof replyCode==='string'&&!replyCode.trim().startsWith(PRODUCT_LINK_PREFIX))throw linkError('VERSION_MISMATCH');
  const decoded=decodeProductBattleEnvelope(PRODUCT_LINK_PREFIX,replyCode);assertProductLinkPayload(decoded.payload,'REPLY');
  if(decoded.payload.inviteId!==invite.id)throw linkError('REPLY_FOR_DIFFERENT_INVITE');
  return deepFreeze({inviteId:invite.id,version:2,catalogRevision:PRODUCT_BATTLE_CATALOG_REVISION,
    catalog:PRODUCT_BATTLE_CATALOG,arenaIndex:invite.arenaIndex,hostIndividuals:invite.hostIndividuals,
    guestIndividuals:expandTeam(decoded.payload.guest,'link-guest',2)});
}
export const CHAMPIONSHIP_LINK_V2_NOTICE=Object.freeze({prefix:PRODUCT_LINK_PREFIX,version:2,catalogRevision:PRODUCT_BATTLE_CATALOG_REVISION,
  get message(){return battleTransportText('LINK_V2_NOTICE');}});

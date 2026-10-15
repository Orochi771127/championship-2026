// Product-authored web transport, not an extension of the ROM wire format.
// This layer only validates/carries data. Runtime admission is a separate gate.
import catalog from '../../data/championship/product-species-extensions.r1.json' with {type:'json'};
import {getProductExtension} from './productSpeciesExtensions.js';
import {deepFreeze} from './championshipContracts.js';

export const PRODUCT_BATTLE_TRANSPORT_VERSION=2;
export const PRODUCT_BATTLE_CATALOG_REVISION=catalog.revision;
export const PRODUCT_BATTLE_CATALOG_ID='CHAMPIONSHIP_2026_PRODUCT_SPECIES';
export const PRODUCT_PASSWORD_PREFIX='CM26-PASSWORD-2.';
export const PRODUCT_LINK_PREFIX='CM26-LINK-2.';
export const PRODUCT_BATTLE_CODE_MAX_LENGTH=50000;
export const PRODUCT_BATTLE_TRANSPORT_EVIDENCE='PRODUCT_AUTHORED_VERSIONED_WEB_TRANSPORT';
export const PRODUCT_BATTLE_CATALOG=deepFreeze({id:PRODUCT_BATTLE_CATALOG_ID,revision:PRODUCT_BATTLE_CATALOG_REVISION,
  extensions:catalog.entries.map(({speciesIndex,speciesId,entityId,baseSpeciesIndex})=>({speciesIndex,speciesId,entityId,baseSpeciesIndex}))});
const encoder=new TextEncoder(),decoder=new TextDecoder('utf-8',{fatal:true});
export const productTransportError=reason=>new Error(`PRODUCT_BATTLE_TRANSPORT_${reason}`);
export const exactTransportKeys=(value,keys)=>value!==null&&typeof value==='object'&&!Array.isArray(value)
  &&Object.keys(value).length===keys.length&&keys.every(key=>Object.hasOwn(value,key));
export function productTransportInteger(value,min,max,label){
  if(!Number.isSafeInteger(value)||value<min||value>max)throw productTransportError(`INVALID_${label}`);
  return value;
}
export function requireKnownTransportSpecies(index){
  if(!Number.isInteger(index)||index<0||index===228||(index>227&&!getProductExtension(index)))
    throw productTransportError('UNKNOWN_SPECIES');
  return index;
}
export function requireReadyTransportSpecies(index){
  requireKnownTransportSpecies(index);
  const extension=getProductExtension(index);
  if(extension&&(!extension.runtimeReady||!extension.networkReady))throw productTransportError('SPECIES_NOT_READY');
  return index;
}
export function transportCatalogMatches(value){
  if(!exactTransportKeys(value,['id','revision','extensions'])||value.id!==PRODUCT_BATTLE_CATALOG_ID
    ||value.revision!==PRODUCT_BATTLE_CATALOG_REVISION||!Array.isArray(value.extensions)
    ||value.extensions.length!==PRODUCT_BATTLE_CATALOG.extensions.length)return false;
  return value.extensions.every((entry,index)=>exactTransportKeys(entry,['speciesIndex','speciesId','entityId','baseSpeciesIndex'])
    &&Object.entries(PRODUCT_BATTLE_CATALOG.extensions[index]).every(([key,expected])=>entry[key]===expected));
}
// FNV-1a detects accidental transcription damage only. Codes are not signed,
// encrypted, secret, or proof of legitimate stats and must never imply trust.
function checksum(bytes){
  let value=0x811c9dc5;
  for(const byte of bytes){value^=byte;value=Math.imul(value,0x01000193)>>>0;}
  return value.toString(16).padStart(8,'0');
}
function base64Url(bytes){
  let binary='';for(let start=0;start<bytes.length;start+=0x4000)binary+=String.fromCharCode(...bytes.subarray(start,start+0x4000));
  return btoa(binary).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
}
function fromBase64Url(value){
  if(typeof value!=='string'||!value.length||value.length%4===1||!/^[A-Za-z0-9_-]+$/.test(value))throw productTransportError('CODE_FORMAT');
  let binary;try{binary=atob(value.replaceAll('-','+').replaceAll('_','/')+'='.repeat((4-value.length%4)%4));}
  catch{throw productTransportError('CODE_FORMAT');}
  const bytes=Uint8Array.from(binary,character=>character.charCodeAt(0));
  if(base64Url(bytes)!==value)throw productTransportError('CODE_NONCANONICAL');
  return bytes;
}
function assertHeader(payload){
  if(!payload||typeof payload!=='object'||Array.isArray(payload)||payload.version!==PRODUCT_BATTLE_TRANSPORT_VERSION)
    throw productTransportError('UNSUPPORTED_VERSION');
  if(payload.catalogRevision!==PRODUCT_BATTLE_CATALOG_REVISION||!transportCatalogMatches(payload.catalog))
    throw productTransportError('CATALOG_MISMATCH');
}
export function productTransportHeader(kind){
  return {version:PRODUCT_BATTLE_TRANSPORT_VERSION,catalogRevision:PRODUCT_BATTLE_CATALOG_REVISION,
    catalog:PRODUCT_BATTLE_CATALOG,kind};
}
export function encodeProductBattleEnvelope(prefix,payload){
  if(![PRODUCT_PASSWORD_PREFIX,PRODUCT_LINK_PREFIX].includes(prefix))throw productTransportError('UNSUPPORTED_VERSION');
  assertHeader(payload);
  const bytes=encoder.encode(JSON.stringify(payload)),code=`${prefix}${checksum(bytes)}.${base64Url(bytes)}`;
  if(code.length>PRODUCT_BATTLE_CODE_MAX_LENGTH)throw productTransportError('CODE_LENGTH');
  return code;
}
export function decodeProductBattleEnvelope(prefix,code){
  if(![PRODUCT_PASSWORD_PREFIX,PRODUCT_LINK_PREFIX].includes(prefix))throw productTransportError('UNSUPPORTED_VERSION');
  if(typeof code!=='string')throw productTransportError('CODE_REQUIRED');
  const normalized=code.trim();
  if(normalized.length>PRODUCT_BATTLE_CODE_MAX_LENGTH)throw productTransportError('CODE_LENGTH');
  const parts=normalized.split('.');
  if(parts.length!==3||`${parts[0]}.`!==prefix)throw productTransportError('UNSUPPORTED_VERSION');
  if(!/^[0-9a-f]{8}$/.test(parts[1]))throw productTransportError('CODE_FORMAT');
  const bytes=fromBase64Url(parts[2]);
  if(checksum(bytes)!==parts[1])throw productTransportError('CODE_CHECKSUM');
  let payload;try{payload=JSON.parse(decoder.decode(bytes));}catch{throw productTransportError('CODE_PAYLOAD');}
  assertHeader(payload);
  return deepFreeze({payload,id:parts[1],code:normalized});
}

// Durable, bounded projection of the fields ARM9 02062100 actually writes.
// ARM9 02061BB4 copies these fields from the captured record into Home; no
// constructor is rerun and no species-base values replace individual stats.
import { deepFreeze } from "../contracts/championshipContracts.js";

const hex = n => n.toString(16).padStart(3, "0");
export const NATIVE_INDIVIDUAL_WORDS = Object.freeze([
  ...Array.from({length:11}, (_,i) => i*4), 0x38, 0x40, 0x48, 0x4c,
  ...Array.from({length:81}, (_,i) => 0x50+i*4),
  ...Array.from({length:12}, (_,i) => 0x198+i*4)
].map(hex));
const NARROW = Object.freeze({"03c":255,"03d":255,"044":255,"046":65535,"194":65535});
const exact = (v, keys) => v && typeof v === "object" && !Array.isArray(v)
  && Object.keys(v).length === keys.length && keys.every(k => Object.hasOwn(v,k));

export function normalizeNativeIndividualProfile(value, speciesId = null) {
  if (!exact(value, ["version","fields","narrowFields","name"]) || value.version !== 1
    || !exact(value.fields, NATIVE_INDIVIDUAL_WORDS) || !exact(value.narrowFields, Object.keys(NARROW))
    || typeof value.name !== "string" || value.name.length > 5 || value.name.includes("\0")) {
    throw new TypeError("INVALID_NATIVE_INDIVIDUAL_PROFILE");
  }
  for (const n of Object.values(value.fields)) if (!Number.isSafeInteger(n) || n < 0 || n > 0xffffffff) throw new TypeError("INVALID_NATIVE_INDIVIDUAL_WORD");
  for (const [k,max] of Object.entries(NARROW)) if (!Number.isInteger(value.narrowFields[k]) || value.narrowFields[k] < 0 || value.narrowFields[k] > max) throw new TypeError("INVALID_NATIVE_INDIVIDUAL_NARROW_FIELD");
  const f = value.fields;
  if (f["000"] > 227 || f["018"] > 8 || f["058"] < 1 || f["058"] > 32767 || f["050"] > f["058"]
    || f["054"] > f["05c"] || f["05c"] > 32767) throw new TypeError("INVALID_NATIVE_INDIVIDUAL_VITALS");
  if (speciesId !== null && speciesId.replace(/^championship:creature:/, "") !== `species-${String(f["000"]).padStart(3,"0")}`) throw new TypeError("NATIVE_INDIVIDUAL_SPECIES_MISMATCH");
  return deepFreeze({version:1, fields:{...f}, narrowFields:{...value.narrowFields}, name:value.name});
}

export function nativeIndividualProfile(individual, speciesId = null) {
  return normalizeNativeIndividualProfile({version:1, ...individual}, speciesId);
}

export function projectNativeIndividualStats(profile) {
  const {fields:f,narrowFields:n} = normalizeNativeIndividualProfile(profile);
  // ARM9 02088480: unlike the trainer percentage this keeps the Q12 fraction
  // through the original float conversion. A zero battle count displays 0.0.
  const denominator=f['024']<<12;
  const ratio=denominator>0?Number(((BigInt(f['028']<<12)<<32n)/BigInt(denominator)+0x80000n)>>20n):0;
  const winPercent=Math.fround((ratio*100)>>>0)/4096;
  const resistances=[
    {id:'HEAT',value:f['070']|0},
    {id:'COLD',value:f['074']|0},
    {id:'THUNDER',value:f['080']|0},
    {id:'LIGHT',value:f['078']|0},
    {id:'DARK',value:f['07c']|0}
  ];
  return deepFreeze({evidence:"ROM_VERIFIED_INDIVIDUAL_FIELDS",currentHp:f["050"],maxHp:f["058"],currentTp:f["054"],maxTp:f["05c"],
    // ARM9 02088480 -> digimon_list_sub nodes 2..6, 9 and 14.
    // These are persistent individual values, never species base-stat guesses.
    capacityG:f['010'],attack:f['060'],defense:f['064'],wisdom:f['068'],speed:f['06c'],
    battleCount:f['024'],winPercent,rebirthCount:(n['03c']<<24)>>24,
    speciesIndex:f["000"],personalityIndex:f["018"],source12C:f["12c"],source130:f["130"],
    // ARM9 0208890C reads these five signed words in this exact order when it
    // paints the 78-pixel resistance graph. Cage program kinds 11..15 and the
    // verified cage descriptions identify the channels.
    resistances,
    resistanceGraph:resistanceGraphFromValues(resistances),
    stats:Object.fromEntries([0x54,0x60,0x64,0x68,0x6c,0x70,0x74,0x78,0x7c,0x80].map(off=>[`field${off.toString(16).toUpperCase()}`,f[hex(off)]]))});
}

/** ARM9 0208890C's five runs across the original 78-pixel graph. */
function resistanceGraphFromValues(resistances) {
  const values=resistances.map(entry=>entry.value);
  const total=values.reduce((sum,value)=>sum+value,0);
  if(total===0)return values.map((_,index)=>({id:resistances[index].id,pixels:index===4?78:0}));
  const pixels=values.map(value=>Math.round(value*78/total));
  pixels[4]+=78-pixels.reduce((sum,value)=>sum+value,0);
  return pixels.map((value,index)=>({id:resistances[index].id,pixels:Math.max(0,value)}));
}

export function nativeResistanceGraph(profile) {
  return projectNativeIndividualStats(profile).resistanceGraph;
}

export function assertRaisingNativeProfiles(raising) {
  for (const entry of raising?.collection ?? []) {
    if (Object.hasOwn(entry,"nativeProfile")) normalizeNativeIndividualProfile(entry.nativeProfile, entry.speciesId);
  }
}

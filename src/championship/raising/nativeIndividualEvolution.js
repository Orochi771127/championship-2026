// ARM9 02062DA8: merge a newly constructed form into the same Home record.
// Target eligibility and animation completion are caller responsibilities.
import { normalizeNativeIndividualProfile } from "./nativeIndividualProfile.js";
import { createNativeHuntIndividual } from "../hunt/capture/nativeHuntIndividual.js";
import { nativeHuntSpeciesByIndex } from "../hunt/capture/nativeHuntSources.js";

const hex=n=>n.toString(16).padStart(3,"0");
const rebirthBonus = Object.freeze([5,5,5,5,5,5,8,8,8,8,10,10,10,10,10,12,12,12,15,20]);
const statOffsets = Object.freeze([0x58,0x5c,0x60,0x64,0x68,0x6c,0x70,0x74,0x78,0x7c,0x80]);
const div=(a,b)=>b===0 ? 0 : Math.trunc((a|0)/(b|0));

export function mergeNativeIndividualForm(previous, constructed, previousGeneration) {
  const old=normalizeNativeIndividualProfile(previous), next=structuredClone(normalizeNativeIndividualProfile(constructed));
  if(!Number.isInteger(previousGeneration)||previousGeneration<0||previousGeneration>6)throw new TypeError("INVALID_PREVIOUS_GENERATION");
  const f=next.fields, o=old.fields, cycles=old.narrowFields["03c"];
  for(const key of ["004","014","018","01c","020","024","028"])f[key]=o[key];
  f["01c"]=Math.min(50,f["01c"]|0)>>>0;
  next.narrowFields["03c"]=cycles;
  const bonus=cycles===0 ? 0 : cycles<20 ? rebirthBonus[cycles] : cycles<99 ? 25 : cycles>=100 ? 50 : 99;
  for(const [i,offset] of statOffsets.entries()) {
    const key=hex(offset), hi=hex(0xa8+i*8), lo=hex(0xac+i*8);
    const span=(f[hi]-f[lo])|0;
    let added=0;
    if(cycles!==0) added=i===0 ? Math.imul(bonus,div(span,100)) : div(Math.imul(bonus,div(Math.imul(span,10),100)),10);
    const oldSpan=(o[hi]-o[lo])|0;
    const quarter=div(div(Math.imul((o[key]-o[lo])|0,100),oldSpan),4);
    let inherited=div(Math.imul(oldSpan,quarter),100);
    if(i===0)inherited=inherited<10 ? 10 : Math.imul(div(inherited,10),10);
    f[key]=Math.max(f[lo]|0,Math.min(f[hi]|0,(f[key]+added+inherited)|0))>>>0;
  }
  f["050"]=f["058"];f["054"]=f["05c"];
  for(let at=0x140;at<=0x16c;at+=4)f[hex(at)]=o[hex(at)];
  if(previousGeneration>=1) {
    const at=0x140+(previousGeneration-1)*4;
    f[hex(at+0x18)]=o[hex(at)];f[hex(at)]=o["000"];
  }
  return normalizeNativeIndividualProfile(next);
}

export function constructNativeIndividualForm(previous, targetSpeciesIndex, rng) {
  const old=normalizeNativeIndividualProfile(previous);
  const constructed=createNativeHuntIndividual({species:nativeHuntSpeciesByIndex(targetSpeciesIndex),rng,
    traitOverride:old.fields["018"],nameOverride:old.name});
  return mergeNativeIndividualForm(old,{version:1,...constructed},nativeHuntSpeciesByIndex(old.fields["000"]).generation);
}

export function selectNativeHatchSpecies(profile, rng, poolSlot) {
  const {fields:f}=normalizeNativeIndividualProfile(profile);
  if(!Number.isInteger(poolSlot)||poolSlot<0||poolSlot>15)throw new TypeError("INVALID_RAISING_POOL_SLOT");
  if(f["140"]!==228) {
    if(f["158"]===228)return f["140"];
    return Math.trunc(32766*rng.next(0x26+poolSlot)/102)%2===0 ? f["158"] : f["140"];
  }
  return Math.trunc(32766*rng.next(0x26+poolSlot)/102)%20+8;
}

// OVL18 02113C2C / 0211459C: the writers used by the native Cage program.
// This is a child of the existing individual profile and gameplay RNG.
import {NATIVE_RAISING_LIFECYCLE_RULES as rules} from './nativeRaisingLifecycle.js';
import {normalizeNativeIndividualProfile} from './nativeIndividualProfile.js';
import {nativeHuntSpeciesByIndex} from '../hunt/capture/nativeHuntSources.js';
const key=n=>n.toString(16).padStart(3,'0'),clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n|0))>>>0;
export function applyNativeTrainingCommand(profile,{kind,delta,season,level=0,filter=-1},rng) {
  if(!Number.isInteger(kind)||kind<0||kind>27)throw new TypeError('INVALID_NATIVE_TRAINING_COMMAND');
  const p=structuredClone(profile),f=p.fields,m=rules.trainingModifiers;
  if(season===1){delta+=m.summer[kind];if(kind<22&&delta===0)delta=-1;}
  else if(season===3)delta+=m.winter[kind];
  if(level===1||level===2)delta=Math.imul(delta,m[`level${level}`][kind]);
  const spread=m.spread[kind],noise=Math.trunc((2*spread-1)*rng.next(0x96+kind)/102)-spread;
  if(noise&&(kind>=22||(delta+noise)!==0))delta=(delta+noise)|0;
  let outcome='APPLIED';
  if(kind<11){const k=key(0x100+kind*4);f[k]=(f[k]+delta)>>>0;}
  else if(kind<22){
    const offset=[0x70,0x74,0x80,0x7c,0x78,0x58,0x5c,0x60,0x64,0x68,0x6c][kind-11];
    const k=key(offset),upper=f[key(0xa8+(offset-0x58)*2)]|0,lower=f[key(0xac+(offset-0x58)*2)]|0;
    if(delta>0&&(f[k]|0)>=upper)outcome='MAX';
    else if(delta<0&&(f[k]|0)<=lower)outcome='MIN';
    else{if(kind===16)delta=Math.trunc((delta+(delta<0?-5:5))/10)*10;f[k]=(f[k]+delta)>>>0;}
    if(kind>=16){f[k]=clamp(f[k],lower,upper);if(kind===16)f['050']=Math.min(f['050'],f[k]);if(kind===17)f['054']=f[k];}
  } else if(['134','138','13c'].some(k=>f[k]===1)||(filter!==-1&&filter!==kind-22))outcome='BLOCKED';
  else if(kind===22){const s=nativeHuntSpeciesByIndex(f['000']);
    if(s.generation===1||s.generation===2)f['008']=clamp(f['008']+delta,0,s.field1c);
    else if(s.generation>=3&&s.generation<=5){const k=f['174']<240?'174':'170',maximum=k==='174'?240:120;f[k]=Math.min(maximum,f[k]+Math.trunc(Math.abs(delta)*120/(s.generation-1)));}
  } else {const k=['050','01c','020','024','040'][kind-23],lo=kind===23?1:0,hi=kind===23?f['058']:kind===26?999:100;f[k]=clamp(f[k]+delta,lo,hi);}
  return {profile:normalizeNativeIndividualProfile(p),kind,delta,outcome};
}
export function applyNativeCageEntryConditions(profile,{definition,season,level=0},rng){
  let p=profile;for(const [kind,delta] of rules.cages[definition].commands)if(kind!==6)p=applyNativeTrainingCommand(p,{kind:22+kind,delta,season,level},rng).profile;
  return p;
}
export function enterNativeRaisingTraining(profile,{definition,season,level=0,stressed=false},rng){
  let roll=rng.next(definition+3)%100,program=null;
  for(const candidate of rules.cages[definition].programs){if(roll<candidate.weight){program=candidate;break;}roll-=candidate.weight;}
  if(!program)return {profile,commands:null};
  let p=profile;const commands=[];
  for(const [kind,delta] of program.commands){const result=applyNativeTrainingCommand(p,{kind,delta,season,level},rng);p=result.profile;commands.push({kind,delta:result.delta,outcome:result.outcome});}
  p=applyNativeCageEntryConditions(p,{definition,season,level},rng);
  if(commands.length){p=structuredClone(p);if((p.fields['008']|0)<=0)p.fields['040']=Math.min(100,p.fields['040']+3);if(stressed)p.fields['040']=Math.min(100,p.fields['040']+3);p=normalizeNativeIndividualProfile(p);}
  return {profile:p,commands};
}
export function createNativeTrainingTimeline(commands){
  return {commands,phase:commands===null?2:commands.length?0:1,emitted:0,
    lanes:[{stage:0,enabled:true},{stage:0,enabled:false}]};
}
// 02119B50: two alternating stat labels rise for six frames, hold for 51,
// then lose two alpha units each frame. The other lane starts at alpha <= 8.
export function stepNativeTrainingTimeline(t){
  if(t.phase!==0)return true;
  for(const [index,lane] of t.lanes.entries()){
    if(lane.stage===0){Object.assign(lane,{stage:1,velocity:0x3000,alpha:31,wait:0,rise:0});}
    else if(lane.stage===1&&lane.enabled){lane.enabled=false;lane.command=t.commands[t.emitted++];lane.ordinal=t.emitted;lane.stage=2;}
    else if(lane.stage===2){lane.rise+=lane.velocity;lane.velocity-=0x800;if(lane.velocity<=0)lane.stage=3;}
    else if(lane.stage===3){if(++lane.wait>50){lane.wait=0;lane.stage=4;}}
    else if(lane.stage===4){lane.alpha-=2;if(lane.alpha<=1){lane.stage=0;if(lane.ordinal>=t.commands.length)t.phase++;}
      if(lane.alpha<=8&&t.emitted<t.commands.length){const other=t.lanes[1-index];if(other.stage===1)other.enabled=true;}}
  }
  return false;
}

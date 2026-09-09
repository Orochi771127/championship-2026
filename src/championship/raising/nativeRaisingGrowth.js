// OVL18 02114A10. The scene supplies verified environment/actor state; this
// writer does not choose movement, sleep, training, evolution or social AI.
import {normalizeNativeIndividualProfile} from "./nativeIndividualProfile.js";
import {applyNativeRaisingCondition} from "./nativeRaisingCare.js";
import {nativePeerAffinity} from './nativeRaisingOvernight.js';

const signed=n=>n|0;
const add=(fields,key,delta)=>fields[key]=(fields[key]+delta)>>>0;
const subtract=(fields,key,delta)=>fields[key]=Math.max(0,(fields[key]-delta)|0)>>>0;

/** Residents use the native Cage list order, including its head. */
export function applyNativeRaisingGrowth(profile, actorFields, input, rng) {
  if((input.peerCount!==0 && (!Array.isArray(input.residents)||input.residents.length!==input.peerCount)) || !Number.isInteger(input.ageDelta) || input.ageDelta<0 || input.ageDelta>2
      || !Number.isInteger(input.baseUnit) || input.baseUnit<1)
    throw new TypeError("VERIFIED_RAISING_GROWTH_CONTEXT_REQUIRED");
  let p=structuredClone(normalizeNativeIndividualProfile(profile));
  let f=p.fields;const a={...actorFields}, events=[];
  const {state,ageDelta:d,baseUnit:unit,generation,mode,minute,ranchSize,effects}=input;
  if(state!==5 && signed(f["008"])>0) {
    const elapsed=mode===2 && f["018"]===4 && (minute&1)===0 ? (d||1)*10 : d;
    if(f["174"]<unit*4)f["174"]=Math.min(unit*4,(f["174"]+elapsed)>>>0);
    else {add(f,"170",elapsed);if(f["170"]>=unit*2){f["170"]=0;add(f,"008",-1);}}
  }
  if(a["418"]===1 && f["13c"]===0 && state!==4)add(f,"184",d);
  add(f,state===4?"17c":"00c",d);
  if(f["13c"]===1)add(f,"188",d);
  else if(f["138"]===1 || f["134"]===1)add(f,"180",d);
  add(f,"18c",d);add(f,"190",d);
  if(state!==6) {
    add(f,"19c",d);
    if(a["408"]!==0)add(f,"1a0",d);else subtract(f,"1a0",d);
    if(signed(a["410"])>0)add(f,"1a4",d);else subtract(f,"1a4",d);
    if(signed(a["40c"])<=1) {
      if(f["018"]===7)add(f,"1a8",d);
      subtract(f,"1ac",d);
    } else {
      add(f,"1ac",d);
      if(f["138"]===0 && f["1ac"]%unit===0)a["414"]=(input.residents??[]).filter(p=>p.fields['138']!==0).length;
      if(f["1ac"]>unit*12){f["1ac"]=0;let score=0;
        // 02114D8C walks from head.next until head, even for a non-head actor.
        for(const peer of (input.residents??[]).slice(1)){score+=nativePeerAffinity(p,peer);f['020']=Math.max(0,Math.min(100,(f['020']+score)|0));}}
      if(f["018"]===7)subtract(f,"1a8",d);
    }
    if(generation===5 || generation===6) {
      if(ranchSize<=2)add(f,"1b4",d);else subtract(f,"1b4",d);
    }
  }
  if(signed(a["414"])>0) {
    if(f["138"]===0) {
      add(f,"1b0",d);
      if(f["1b0"]>unit*4) {
        f["1b0"]=0;
        if(rng.next(a["470"])%100 < a["414"]*20)f["01c"]=100;
      }
    }
  } else subtract(f,"1b0",d);
  let phase=input.phase??0;
  if(a["430"]===1) {
    add(f,"198",d);
    if(f["198"]>Math.floor(unit/12)) {
      f["198"]=0;f["020"]=Math.min(100,Math.max(0,signed(f["020"]+1)))>>>0;
      if(signed(f["01c"])>0)add(f,"01c",-1);
      if(state===8 && phase===0)phase=1;
    }
  }
  if(effects.length && a["45c"]!==f["19c"]) {
    for(const e of effects) {
      if(!Number.isInteger(e.interval)||e.interval<=0)throw new TypeError("INVALID_RAISING_CONDITION_INTERVAL");
      if(signed(f["19c"])%e.interval===0) {
        p=structuredClone(applyNativeRaisingCondition(p,{kind:e.kind,delta:e.delta,satietyMaximum:input.satietyMaximum}));f=p.fields;
      }
    }
    a["45c"]=f["19c"];
  }
  if(signed(f["050"])<signed(f["058"])) {
    add(a,"460",d);
    if(a["460"]>Math.floor(unit/6)) {
      a["460"]=0;f["050"]=Math.min(signed(f["058"]),signed(f["050"])+Math.trunc(signed(f["058"])/100))>>>0;
    }
  }
  a["404"]=Number(signed(f["01c"])>=90);
  if(f["138"]===0 && signed(f["01c"])>=100) {
    f["138"]=1;events.push({kind:"audio",id:0x300});
    f["020"]=Math.max(0,Math.min(100,signed(f["020"])-5))>>>0;
    p.narrowFields["03d"]=Math.min(7,(p.narrowFields["03d"]+2)&255);
  }
  if(a['408']===0){if(input.dirtyAdded)a['408']=1;}
  else if(input.dirtyRemoved)a['408']=0;
  else if(f['1a0']%Math.floor(unit/2)===0&&(input.wasteCount??0)+(input.rottenFoodCount??0)===0)a['408']=0;
  if(signed(f["008"])<=2 && generation!==0 && state!==4) {
    if(a["418"]===0)events.push({kind:"audio",id:0x603});
    a["418"]=1;
  } else if(a["418"]!==0) {a["418"]=0;f["184"]=0;}
  if(f["180"]<unit*20 && f["184"]<unit*20 && signed(f["050"])>Math.trunc(signed(f["058"])/10)) {
    f["13c"]=0;f["188"]=0;
  }
  if(a["41c"]===0 && a["428"]>unit*48 && f["18c"]>a["428"]-unit*48)a["41c"]=1;
  return {profile:normalizeNativeIndividualProfile(p),actorFields:a,phase,events};
}

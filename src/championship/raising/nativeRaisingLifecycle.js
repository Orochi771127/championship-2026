// OVL18 02112734: ordered original evolution predicates and caller results.
import rules from '../../data/championship/catalogs/raising-lifecycle.r1.json' with {type:'json'};
import curve from '../../data/championship/catalogs/creature-stat-curve.r1.json' with {type:'json'};
import {nativeHuntSpeciesByIndex} from '../hunt/capture/nativeHuntSources.js';
import {normalizeNativeIndividualProfile} from './nativeIndividualProfile.js';

export const NATIVE_RAISING_LIFECYCLE_RULES=rules;
const key=n=>n.toString(16).padStart(3,'0');
const counts=[0x104,0x108,0x100,0x10c,0x110,0x114,0x118,0x124,0x120,0x128,0x11c];
const rows=curve.records??curve.rows;
const signed=n=>n|0;

export function nativeEvolutionRequirements(rule) {
  const t=rule.thresholds,target=nativeHuntSpeciesByIndex(rule.target);
  return {counts:counts.map((offset,i)=>({field:key(offset),minimum:t[i]})),
    stats:target.rungs.map((rung,i)=>({field:key(0x58+i*4),minimum:Math.trunc(rows[rung][i===0?0:Math.min(i,6)]*t[11+i]/100)})),
    battles:t[22],winPercent:t[23],cycles:t[24],careCount:t[25],lifetimeOnly:rule.kind===1};
}
function passes(profile,rule,lifetime) {
  const f=profile.fields,n=profile.narrowFields,t=rule.thresholds;
  if(rule.kind===1)return lifetime && (t[24]===0||t[24]<=n['03c']) && (t[25]===0||t[25]<=n['03d']);
  const req=nativeEvolutionRequirements(rule);
  if(req.counts.some(({field,minimum})=>minimum!==0&&minimum>signed(f[field])))return false;
  if(req.stats.some(({field,minimum},i)=>t[11+i]!==0&&minimum>signed(f[field])))return false;
  if(t[22]!==0&&t[22]>signed(f['024']))return false;
  // Original Q12 division/rounding precedes the integer percentage comparison.
  let percentage=0;
  if((f['024']<<12)>0){const q=Number((BigInt(f['028']<<12)<<12n)/BigInt(f['024']<<12));percentage=Number((BigInt(q)*409600n+2048n)>>12n)>>12;}
  return (t[23]===0||t[23]<=percentage)&&(t[24]===0||t[24]<=n['03c'])&&(t[25]===0||t[25]>=n['03d']);
}

export function evaluateNativeEvolution(profile,{rank,roster,lifetime=false,lifeThreshold=null},rng) {
  const p=structuredClone(normalizeNativeIndividualProfile(profile)),f=p.fields,species=nativeHuntSpeciesByIndex(f['000']);
  if(!Number.isInteger(rank)||!rules.ranks[rank]||!Array.isArray(roster))throw new TypeError('NATIVE_EVOLUTION_CONTEXT_REQUIRED');
  const actor={'1e8':0,'1f0':0,'1f4':0,'428':lifeThreshold??rules.species[f['000']].life,'454':0,'464':0};
  const result=code=>({profile:normalizeNativeIndividualProfile(p),code,actor,target:code===1?actor['1e8']:null});
  const list=rules.rules[f['000']-8];
  if(species.generation===0||species.generation===6||!list?.length)return result(0);
  const extend=()=>{f['04c']=1;actor['428']=rules.extendedLife[species.generation];return result(2);};
  const ancestry=()=>species.generation>=1&&species.generation<=5
    ?[f[key(0x140+species.generation*4)],f[key(0x158+species.generation*4)]]:[228,228];
  const select=(target,index,last)=>{actor['1e8']=target;actor['1f4']=index;actor['1f0']=Number(last);return result(1);};
  const inherit=target=>{if(!list.some(r=>r.target===target))actor['464']=1;return target;};
  for(const [index,rule] of list.entries()) {
    if(!passes(p,rule,lifetime)){actor['454']=1;continue;}
    // Physical roster order includes this individual once at index zero.
    const capacity=roster.slice(1).reduce((sum,s)=>sum+rules.species[s].capacity,0)+rules.species[rule.target].capacity;
    if(rules.ranks[rank].generation<=species.generation) {
      if(f['04c']!==0)return result(3);
      if(lifetime&&signed(f['020'])<50)return result(0);
      return extend();
    }
    if(capacity>rules.ranks[rank].capacity)return {...result(lifetime?0:2),capacityBlocked:true};
    let target=rule.target;
    if(lifetime){const [first,second]=ancestry();
      if(first!==228&&second!==228){const roll=rng.next(0xc6)%3;if(roll===0)target=inherit(second);else if(roll===1)target=inherit(first);}
      else if(first!==228&&rng.next(0xc6)%2===0)target=inherit(first);
    }
    return select(target,index,index===list.length-1);
  }
  if(lifetime){const [first]=ancestry();if(first!==228)return select(inherit(first),0,true);
    if(f['04c']===0&&signed(f['020'])>=50)return extend();}
  return result(0);
}

// OVL18 021164E4: same-record rebirth or disappearance after life expires.
export function evaluateNativeRebirth(profile,force=false) {
  const p=structuredClone(normalizeNativeIndividualProfile(profile)),generation=nativeHuntSpeciesByIndex(p.fields['000']).generation;
  if(generation===5||generation===6||signed(p.fields['024'])>=10||force){const cycles=p.narrowFields['03c'];
    p.narrowFields['03c']=Math.min(100,cycles+1);return {profile:normalizeNativeIndividualProfile(p),target:Math.min(7,cycles+1)};}
  return {profile:p,target:-1};
}

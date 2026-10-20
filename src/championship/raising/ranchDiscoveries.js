// One optional child of the canonical Raising save. No second wallet or timer.
export const RANCH_DISCOVERY_INTERVAL_MS=2*60*60*1000;
export const RANCH_DISCOVERY_CAP=12;
export const RANCH_DISCOVERY_REWARDS=Object.freeze({
  food:Object.freeze({record:0,quantity:2}),herb:Object.freeze({record:2,quantity:1}),
  bits:Object.freeze({bits:20}),rare:Object.freeze({record:1,quantity:1})
});
const CYCLE=['food','bits','herb','food','bits','rare'];
const idOk=id=>typeof id==='string'&&/^[a-z0-9:_-]{3,96}$/i.test(id);
const integer=(n,max=Number.MAX_SAFE_INTEGER)=>Number.isSafeInteger(n)&&n>=0&&n<=max;
export function normalizeRanchDiscoveries(raw){
  if(raw==null)return null;
  const fail=()=>{throw new TypeError('INVALID_RANCH_DISCOVERIES');};
  if(raw.version!==1||!integer(raw.lastAt)||!integer(raw.carryMs,RANCH_DISCOVERY_INTERVAL_MS-1)
    ||!integer(raw.sequence,1000000000)||!integer(raw.collected,1000000000)||raw.collected>raw.sequence
    ||!Array.isArray(raw.participants)||raw.participants.length>16||!Array.isArray(raw.pending)||raw.pending.length>RANCH_DISCOVERY_CAP)fail();
  const participants=raw.participants.map(p=>{if(!idOk(p.id)||!idOk(p.cageId))fail();return Object.freeze({id:p.id,cageId:p.cageId});});
  if(new Set(participants.map(p=>p.id)).size!==participants.length)fail();
  const ids=new Set();
  const pending=raw.pending.map(p=>{
    if(!integer(p.id,raw.sequence)||p.id===0||ids.has(p.id)||p.kind!==CYCLE[(p.id-1)%CYCLE.length]
      ||!idOk(p.partnerId)||!idOk(p.cageId))fail();
    ids.add(p.id);return Object.freeze({id:p.id,kind:p.kind,partnerId:p.partnerId,cageId:p.cageId});
  });
  if(raw.collected+pending.length!==raw.sequence)fail();
  return Object.freeze({version:1,lastAt:raw.lastAt,carryMs:raw.carryMs,sequence:raw.sequence,collected:raw.collected,
    participants:Object.freeze(participants),pending:Object.freeze(pending)});
}
export function settleRanchDiscoveries(raw,nowMs,participants){
  if(!integer(nowMs))throw new TypeError('INVALID_RANCH_DISCOVERY_CLOCK');
  const state=normalizeRanchDiscoveries(raw)??normalizeRanchDiscoveries({
    version:1,lastAt:nowMs,carryMs:0,sequence:0,collected:0,pending:[],participants:[]});
  // A backwards system clock cannot replay time. Keep its high-water mark.
  const elapsed=Math.max(0,nowMs-state.lastAt),next={...state,lastAt:Math.max(state.lastAt,nowMs),participants,pending:[...state.pending]};
  if(state.participants.length&&state.pending.length<RANCH_DISCOVERY_CAP){
    const budget=Math.min(RANCH_DISCOVERY_INTERVAL_MS*RANCH_DISCOVERY_CAP,elapsed+state.carryMs);
    const count=Math.min(RANCH_DISCOVERY_CAP-next.pending.length,Math.floor(budget/RANCH_DISCOVERY_INTERVAL_MS),1000000000-state.sequence);
    for(let n=0;n<count;n++){
      const id=++next.sequence,p=state.participants[(id-1)%state.participants.length];
      next.pending.push({id,kind:CYCLE[(id-1)%CYCLE.length],partnerId:p.id,cageId:p.cageId});
    }
    next.carryMs=next.pending.length===RANCH_DISCOVERY_CAP?0:budget%RANCH_DISCOVERY_INTERVAL_MS;
  }else if(!state.participants.length||state.pending.length===RANCH_DISCOVERY_CAP)next.carryMs=0;
  return normalizeRanchDiscoveries(next);
}
export function removeCollectedDiscoveries(state,ids){
  const set=new Set(ids),pending=state.pending.filter(p=>!set.has(p.id));
  return normalizeRanchDiscoveries({...state,pending,collected:state.collected+state.pending.length-pending.length});
}

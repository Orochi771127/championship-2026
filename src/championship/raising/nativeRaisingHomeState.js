// Optional child of the existing v5 Raising save. Physical pool slots remain
// stable after release. Food coordinates are Q12 relative to their Cage origin.
// 0204FC8C inserts a new head immediately before the oldest linked member.
// After reconstruction in pool order, traversal is newest, oldest ... previous.
export function nativeRaisingRebuiltListOrder(insertionOrder){
  return insertionOrder.length>1?[insertionOrder.at(-1),...insertionOrder.slice(0,-1)]:[...insertionOrder];
}

export function normalizeNativeRaisingHome(input) {
  if(input===undefined||input===null)return null;
  const fail=()=>{throw new TypeError("INVALID_NATIVE_RAISING_HOME_SAVE");};
  if(input.version!==1||!input.poolSlots||typeof input.poolSlots!=="object"||Array.isArray(input.poolSlots)
      ||!Array.isArray(input.foods)||input.foods.length>16
      ||(input.waste!==undefined&&(!Array.isArray(input.waste)||input.waste.length>40)))fail();
  const poolSlots={},used=new Set(),foodSlots=new Set();
  for(const [id,slot] of Object.entries(input.poolSlots)) {
    if(!/^[a-z0-9:_-]{3,96}$/i.test(id)||!Number.isInteger(slot)||slot<0||slot>15||used.has(slot))fail();
    used.add(slot);poolSlots[id]=slot;
  }
  const foods=input.foods.map(f=>{
    const kind=f?.kind??(f?.protein?1:0);
    if(!f||!Number.isInteger(f.slot)||f.slot<0||f.slot>15||foodSlots.has(f.slot)
      ||!Number.isInteger(kind)||kind<0||kind>3||(f.slot>=10&&kind<2)||f.protein!==(kind===1)
      ||!Number.isInteger(f.cageDefinitionIndex)||f.cageDefinitionIndex<0||f.cageDefinitionIndex>35
      ||!Array.isArray(f.localPositionQ12)||f.localPositionQ12.length!==3
      ||f.localPositionQ12.some(n=>!Number.isInteger(n)||n< -0x1000000||n>0x1000000)||f.localPositionQ12[2]!==0
      ||typeof f.protein!=="boolean"||!Number.isInteger(f.remaining)||f.remaining<1||f.remaining>(kind===2?32:16)
      ||!Number.isInteger(f.freshness)||f.freshness<0||f.freshness>1440)fail();
    foodSlots.add(f.slot);
    return Object.freeze({slot:f.slot,cageDefinitionIndex:f.cageDefinitionIndex,localPositionQ12:Object.freeze([...f.localPositionQ12]),
      protein:f.protein,...(f.kind!==undefined?{kind}:{}),remaining:f.remaining,freshness:f.freshness});
  });
  const wasteSlots=new Set(),waste=(input.waste??[]).map(w=>{
    if(!w||!Number.isInteger(w.slot)||w.slot<0||w.slot>=40||wasteSlots.has(w.slot)
      ||!Number.isInteger(w.speciesIndex)||w.speciesIndex<0||w.speciesIndex>=228
      ||!Number.isInteger(w.cageDefinitionIndex)||w.cageDefinitionIndex<0||w.cageDefinitionIndex>35
      ||!Array.isArray(w.localPositionQ12)||w.localPositionQ12.length!==3||w.localPositionQ12[2]!==0
      ||w.localPositionQ12.some(n=>!Number.isInteger(n)||Math.abs(n)>0x1000000))fail();
    wasteSlots.add(w.slot);return Object.freeze({slot:w.slot,speciesIndex:w.speciesIndex,cageDefinitionIndex:w.cageDefinitionIndex,localPositionQ12:Object.freeze([...w.localPositionQ12])});
  });
  const branches=input.evolutionBranches??[];
  // ARM9 root+BC keeps unprocessed daylight minutes across the day-end save.
  // Consume this child field only when Home is reconstructed after the calendar
  // (or when Continue loads that save), before entering the morning actors.
  const pending=input.pendingOvernightMinutes;
  if(pending!==undefined&&(!Number.isInteger(pending)||pending<0||pending>1320))fail();
  if(!Array.isArray(branches)||branches.length>895||branches.some(n=>!Number.isInteger(n)||n<0||n>=895)||new Set(branches).size!==branches.length)fail();
  return Object.freeze({version:1,poolSlots:Object.freeze(poolSlots),foods:Object.freeze(foods),
    ...(input.waste!==undefined?{waste:Object.freeze(waste)}:{}),...(input.evolutionBranches!==undefined?{evolutionBranches:Object.freeze([...branches].sort((a,b)=>a-b))}:{}),
    ...(pending!==undefined?{pendingOvernightMinutes:pending}:{})});
}

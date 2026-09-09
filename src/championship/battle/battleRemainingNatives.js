// OVL19 0211CDFC..0211EF90. Completes the existing VM native registry.
// Engine delegates remain explicit. A translated body is not a loaded effect
// bank, camera, or a claim that a normal encounter has reached every branch.
const GLOBAL=0x02131c40;
const fail=address=>{throw new Error(`BATTLE_NATIVE_NEEDS_OBJECT_GRAPH: 0x${address.toString(16)}`);};
const world=(h,address)=>h.readU32(GLOBAL,0)||fail(address);
const r=(h,p,o)=>h.readU32(p,o)|0;
const w=(h,p,o,v)=>h.writeU32(p,o,v|0);
const mulFx=(a,b)=>Number(BigInt.asIntN(32,(BigInt(a|0)*BigInt(b|0)+2048n)>>12n));
const vector=(h,angle,length,address)=>{
  const result=h.call(0x02066a40,angle,length);
  if(!Array.isArray(result)||result.length!==3||!result.every(Number.isSafeInteger))fail(address);
  return [...result];
};
const setVector=(h,p,offset,v)=>v.forEach((n,i)=>w(h,p,offset+i*4,n));
const clearVector=(h,p,offset)=>setVector(h,p,offset,[0,0,0]);
// ARM9 0204819C (unit step), 020482AC, 02048300/31C/330/34C.
const moveOne=(h,p)=>{
  for(let i=0;i<3;i++){
    const delta=r(h,p,0x48+i*4);
    if(delta)w(h,p,0x3c+i*4,r(h,p,0x3c+i*4)+delta);
  }
  for(let i=0;i<3;i++){
    const delta=r(h,p,0x3c+i*4);
    if(delta)w(h,p,0x24+i*4,r(h,p,0x24+i*4)+delta);
  }
};
const pose=(h,p,family,start)=>{if((family>>>0)<=3)h.call(0x020479a4,p,family+7,start);};
const tint=(h,p,value,level)=>{
  h.call(0x020472cc,p,value&65535);h.call(0x020472cc,p+0xd8,value&65535);
  h.call(0x020472ec,p,(level|(level<<5)|(level<<10))&65535);
};

// Shared instruction-identical tail of E5A0 (ground) and EA68 (air) scripts.
// The supplied host owns the actor graph and delegates original angle/vector
// helpers. These functions do not choose targets, deal damage or own a clock.
function stagedAttack(a,h,air){
  const address=air?0x0211ea68:0x0211e5a0,caller=a[0],action=a[1];
  const owner=r(h,action,0xe4),target=r(h,action,0xe8),actor=r(h,owner,4);
  if(!actor||!target||!r(h,caller,0x2c))fail(address);
  let state=r(h,action,8);
  const targetActor=r(h,target,4);
  if(!targetActor)fail(address);
  const angle=()=>h.call(0x020669d8,actor+0x24,targetActor+0x24);
  const sync=(includeZ)=>{
    moveOne(h,actor);
    const position=r(h,caller,0x2c);
    for(let i=0;i<(includeZ?3:2);i++)w(h,position,i*4,r(h,actor,0x24+i*4));
  };
  if(air && state<3){
    if(state===0){w(h,actor,0x38,-819);w(h,actor,0x44,0);w(h,actor,0x50,4506);w(h,action,8,1);}
    else if(state===1){
      moveOne(h,actor);
      if(r(h,actor,0x38))w(h,actor,0x50,r(h,actor,0x50)+r(h,actor,0x38));
      w(h,r(h,caller,0x2c),8,r(h,actor,0x2c));
      if(r(h,actor,0x44)<4096){w(h,action,12,0);w(h,action,8,2);clearVector(h,actor,0x48);}
    }else if(r(h,action,12)>=18){w(h,action,8,3);return 4096;}
    else w(h,action,12,r(h,action,12)+1);
    return 0;
  }
  const start=air?3:0,fade=air?4:1,wait=air?5:2,attack=air?6:3,finish=air?7:4;
  if(state===start){
    w(h,action,12,air?6:12);
    const direction=angle(),v=vector(h,direction,air?24576:1024,address);
    w(h,action,0x14,direction+0x3244);
    if(air){v[2]=-24576;setVector(h,actor,0x3c,v);clearVector(h,actor,0x48);}
    else {clearVector(h,actor,0x3c);setVector(h,actor,0x48,v);}
    w(h,actor,0x1ac,0);w(h,action,8,state+1);state=fade;
  }
  if(state===fade){
    const countdown=r(h,action,12);
    if(countdown>0){
      const remaining=countdown-1,brightness=Math.trunc(((remaining*127)|0)/(air?6:12));
      w(h,action,12,remaining);tint(h,actor,brightness>>2,brightness>>(air?2:3));
    }else{
      w(h,action,8,state+1);w(h,action,12,10);
      const v=vector(h,r(h,action,0x14),65536,address);
      w(h,actor,0x24,r(h,targetActor,0x24)+v[0]);w(h,actor,0x28,r(h,targetActor,0x28)+v[1]);
      if(air)w(h,actor,0x2c,0);
      clearVector(h,actor,0x3c);if(!air)clearVector(h,actor,0x48);
    }
    sync(air);return 0;
  }
  if(state===wait){const n=r(h,action,12);if(n>0)w(h,action,12,n-1);else w(h,action,8,state+1);return 0;}
  if(state===attack){
    w(h,action,12,4);w(h,action,0x14,angle());w(h,action,0x18,81920);
    pose(h,actor,r(h,r(h,action,0x20),0x10),2);
    w(h,action,8,state+1);return air?8192:4096;
  }
  if(state===finish){
    const n=r(h,action,12);
    if(n>0){if(n===1)w(h,actor,0x1ac,1);w(h,action,12,n-1);
      const brightness=(127-Math.trunc((((n-1)*127)|0)/4))>>2;tint(h,actor,brightness,brightness);}
    setVector(h,actor,0x3c,vector(h,r(h,action,0x14),r(h,action,0x18),address));sync(false);
    const speed=mulFx(r(h,action,0x18),0xb33);w(h,action,0x18,speed);
    w(h,actor,0x440,1);w(h,actor,0x43c,15);
    if(speed<=2048){
      w(h,actor,0x440,0);clearVector(h,actor,0x3c);
      pose(h,actor,r(h,r(h,action,0x20),0x10),3);w(h,action,8,state+1);return air?0x3e7000:8192;
    }
    return air?8192:4096;
  }
  return 0;
}

export const BATTLE_REMAINING_NATIVES=[
  {address:0x0211cdfc,argumentCount:2,requires:['readU16'],run:(a,h)=>{
    const index=((a[1]>>12)>>>0)%11;
    h.call(0x020472ec,a[0],h.readU16(0x02131bdc,index*2));return 0;
  }},
  {address:0x0211d06c,argumentCount:0,run:(a,h)=>{const p=world(h,0x0211d06c);if(!h.call(0x02111808,p))h.call(0x021117c4,p,0,12);return 0;}},
  {address:0x0211d0a4,argumentCount:0,run:(a,h)=>{const p=world(h,0x0211d0a4);if(h.call(0x02111808,p))h.call(0x021117e8,p);return 0;}},
  {address:0x0211d0d4,argumentCount:2,run:(a,h)=>{const p=world(h,0x0211d0d4);if(h.call(0x02111808,p))h.call(0x020460e4,p+0x1f050,a[0],a[1]);return 0;}},
  {address:0x0211d134,argumentCount:1,run:(a,h)=>{
    const p=world(h,0x0211d134);w(h,p,0x47480,a[0]);
    if(h.call(0x02111808,p)&&!h.call(0x02111834,p)&&!r(h,p,0x1f12c))w(h,p,0x481ec,a[0]);return 0;
  }},
  {address:0x0211d604,argumentCount:3,run:(a,h)=>{if(a[0])setVector(h,a[0],0x3c,[a[1],a[2],r(h,a[0],0x44)]);return 0;}},
  {address:0x0211d668,argumentCount:3,run:(a,h)=>{if(a[0])setVector(h,a[0],0x48,[a[1],a[2],r(h,a[0],0x44)]);return 0;}},
  {address:0x0211d6cc,argumentCount:2,run:(a,h)=>{if(a[0])h.call(0x020472cc,a[0],(a[1]<<4)>>>16);return 0;}},
  {address:0x0211df68,argumentCount:4,run:(a,h)=>{
    const action=a[0];let slot=0;for(;slot<24;slot++)if(!r(h,action,0x24+slot*4))break;if(slot===24)return 0;
    const vm=h.vmAddress??fail(0x0211df68);
    const p=world(h,0x0211df68),owner=r(h,action,0xe4),effect=a[1]>>12;
    const height=r(h,r(h,owner,0x2c),8),actor=h.call(0x0211b264,p,effect,1);
    if(!actor)return 0;
    w(h,actor,0x24,a[2]);w(h,actor,0x28,a[3]);w(h,actor,0x2c,height);
    h.call(0x02047904,actor,(effect&255)-1);h.writeU8(actor,0x5b,1);
    w(h,action,0x24+slot*4,actor);w(h,action,0x84+slot*4,vm);
    if(r(h,owner,0x94)===action){
      const base=p+0x1f218,difference=(actor-(base+0x394))|0;
      const high=Number((BigInt(0x4d4873ed)*BigInt(difference))>>32n)|0;
      const index=(difference>>>31)+(high>>6);w(h,base,0x19e54+index*4,3);
    }
    return actor;
  }},
  {address:0x0211e088,argumentCount:1,run:(a,h)=>{
    if(!a[0])return 0;const vm=h.vmAddress??fail(0x0211e088);
    for(let i=0;i<4;i++)if(a[0]+0x2a0+i*0x1b4===vm)return r(h,a[0],0x970+i*4);return 0;
  }},
  {address:0x0211e1f4,argumentCount:1,run:(a,h)=>{
    const p=world(h,0x0211e1f4),value=r(h,0x04000000,0);
    w(h,0x04000000,0,a[0]?value|0x200:value&~0x200);h.call(0x0207f810,p+0x5f9c,a[0]?1:0);return 0;
  }},
  {address:0x0211e338,argumentCount:2,run:(a,h)=>h.call(0x02003098,a[0],a[1])<<12},
  {address:0x0211e3a0,argumentCount:2,run:(a,h)=>{
    const p=world(h,0x0211e3a0),count=h.readU32(p,0x47884)>>>0;
    if(count<16){w(h,p,0x47888+count*12,a[0]);w(h,p,0x4788c+count*12,a[1]);w(h,p,0x47890+count*12,0);w(h,p,0x47884,count+1);}return 0;
  }},
  {address:0x0211e430,argumentCount:1,run:(a,h)=>{
    const action=a[0];if(r(h,r(h,action,0x20),0x1c)!==0x02120900)return 0;
    const p=world(h,0x0211e430),owner=r(h,action,0xe4);
    const edge=h.call(0x02047d98,r(h,owner,4)),height=r(h,r(h,owner,0x2c),8);
    h.call(0x0211afa4,p+0x1f218,action,owner,[0,height,(-131072-height-(edge<<12))|0]);return 0;
  }},
  {address:0x0211e4cc,argumentCount:2,requires:['readU16'],run:(a,h)=>{
    let index=a[1]>>12;if(index===-1)index=r(h,r(h,a[0],0x20),0x60);
    if(index)h.call(0x0203ea30,h.readU16(0x0212ffb8,index*2),127,0);return 0;
  }},
  {address:0x0211e5a0,argumentCount:2,run:(a,h)=>stagedAttack(a,h,false)},
  {address:0x0211e9fc,argumentCount:2,run:(a,h)=>{
    const actor=r(h,r(h,a[1],0xe4),4);if(!actor)fail(0x0211e9fc);
    w(h,actor,0x1ac,1);w(h,actor,0x440,0);h.call(0x020472ec,actor,32767);h.call(0x020472cc,actor,31);
    clearVector(h,actor,0x3c);clearVector(h,actor,0x48);return 1;
  }},
  {address:0x0211ea68,argumentCount:2,run:(a,h)=>stagedAttack(a,h,true)}
];

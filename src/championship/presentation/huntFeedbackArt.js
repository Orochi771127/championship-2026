import {isLocalBattleEffectPreview} from './battleEffectArt.js';
import {nativeAnimationCellAt} from './characterAnimationTimeline.js';
export const HUNT_FEEDBACK_ART_ID='art:vfx:hunt-feedback:local-reference:v1';
export const HUNT_FEEDBACK_ART_MANIFEST='assets/production/internal-faithful-baseline/hunt-feedback-v1/manifest.json';

// OVL0 02122388 shot sequence 0; 02121CF0 / 02125108 bomb/mine 0,
// 02121504 / 02124ABC priming 1; native burst slots already publish 2/3/4.
// An elapsed value is a read of the owner's native updates, never a render clock.
export function huntFeedbackBinding(object){
  if(object.kind==='SHOT_IMPACT')return {kind:'SHOT',item:object.status,sequence:0,remaining:object.remaining};
  if(object.kind==='TOOL_BURST')return {kind:object.sourceKind,item:object.itemIndex,sequence:object.sequence,remaining:object.remaining};
  if(['BOMB','MINE'].includes(object.kind))return {kind:object.kind,item:object.itemIndex,sequence:object.state===4?1:0,elapsed:object.visualTicks??0};
  if(object.kind==='MEAT')return {kind:'MEAT',item:object.itemIndex,sequence:3-object.tier,elapsed:0}; // 02113540..598 quarter thresholds
  if(object.kind==='DECOY')return {kind:'DECOY',item:object.itemIndex,sequence:object.sequence,elapsed:object.visualTicks}; // 02127DD8, 02128198, 021280F0
  if(object.kind==='LIGHT')return {kind:'LIGHT',item:object.itemIndex,sequence:0,elapsed:object.visualTicks}; // 0212432C
  if(object.kind==='CAPTURE_TRAP'&&Number.isInteger(object.itemIndex))return {kind:object.kind,item:object.itemIndex,sequence:object.triggered?1:0,elapsed:object.visualTicks}; // 02125AE4 / 02125B88
  return null;
}

export const huntFeedbackCell=nativeAnimationCellAt;

// OVL0 02125B60 creates the primary and secondary trap sequences together.
// All children have equal y/z offsets (021259FC..A78), so their ground-screen
// anchors coincide. Only the normal trap's secondary changes 2 -> 4 at finish.
export function huntTrapLayers(object){
  if(object.kind!=='CAPTURE_TRAP'||!object.triggered)return [object];
  const age=object.visualTicks??0;
  const secondary=object.itemIndex===0
    ?[{sequence:age>=31?4:2,elapsed:age>=31?age-31:age}]
    :[{sequence:2,elapsed:age},{sequence:3,elapsed:age},{sequence:7,elapsed:age}];
  return [object,...secondary.map(binding=>({...object,visualBinding:binding}))];
}

export function validateHuntFeedbackArt(manifest,index){
  const entry=index?.entries?.find(e=>e.assetId===HUNT_FEEDBACK_ART_ID);
  if(manifest?.schemaVersion!==1||manifest.assetId!==HUNT_FEEDBACK_ART_ID||!entry
    ||[entry,manifest].some(e=>e.manifestPath!==HUNT_FEEDBACK_ART_MANIFEST||e.runtimeEligible!==true||e.localOnly!==true
      ||e.runtimeScope!=='LOOPBACK_RESEARCH_ONLY'||e.publicReleasePermitted!==false||e.shippingReady!==false
      ||e.rightsStatus!=='ROM_COPYRIGHTED_REFERENCE'))throw new Error('HUNT_FEEDBACK_NOT_REGISTERED');
  if(!Array.isArray(manifest.banks)||manifest.banks.length!==19)throw new Error('HUNT_FEEDBACK_BANKS_INVALID');
  const keys=new Set();
  for(const bank of manifest.banks){
    const key=`${bank.kind}:${bank.itemIndex}`;
    if(keys.has(key)||!/^e002_hunt_[a-z0-9_]+$/.test(bank.bank)||!Number.isInteger(bank.itemIndex))throw new Error('HUNT_FEEDBACK_BANK_INVALID');
    keys.add(key);const cells=new Set();
    for(const c of bank.cells){
      if(!Number.isInteger(c.cell)||c.cell<0||cells.has(c.cell)||c.src!==HUNT_FEEDBACK_ART_MANIFEST.replace('manifest.json',`${bank.bank}/cell-${String(c.cell).padStart(3,'0')}.png`)
        ||![c.width,c.height].every(n=>Number.isInteger(n)&&n>0)||!Array.isArray(c.origin)||c.origin.length!==2
        ||!c.origin.every(Number.isInteger)||!/^[a-f0-9]{64}$/.test(c.sha256))throw new Error('HUNT_FEEDBACK_CELL_INVALID');
      cells.add(c.cell);
    }
    for(const s of bank.sequences)if(![1,2].includes(s.playbackMode)||!s.frames.length||s.frames.some(f=>!cells.has(f.cell)||!Number.isInteger(f.ticks)||f.ticks<=0))throw new Error('HUNT_FEEDBACK_TIMELINE_INVALID');
  }
  return structuredClone(manifest);
}

export async function loadRegisteredHuntFeedbackArt({PIXI,baseUrl,fetchImpl=globalThis.fetch}){
  if(!isLocalBattleEffectPreview(baseUrl))return null;
  const indexResponse=await fetchImpl(new URL('assets/production/ART_PRODUCTION_INDEX.json',baseUrl));
  if(!indexResponse.ok)throw new Error('HUNT_FEEDBACK_INDEX_UNAVAILABLE');
  const index=await indexResponse.json();if(!index.entries?.some(e=>e.assetId===HUNT_FEEDBACK_ART_ID&&e.runtimeEligible))return null;
  const response=await fetchImpl(new URL(HUNT_FEEDBACK_ART_MANIFEST,baseUrl));if(!response.ok)throw new Error('HUNT_FEEDBACK_MANIFEST_UNAVAILABLE');
  const manifest=validateHuntFeedbackArt(await response.json(),index),banks=new Map(),loaded=[];
  try{
    for(const bank of manifest.banks){
      const cells=new Map();
      for(const c of bank.cells){const texture=await PIXI.Assets.load(c.src);loaded.push(c.src);
        if(texture.width!==c.width||texture.height!==c.height)throw new Error('HUNT_FEEDBACK_DIMENSIONS');
        texture.source.scaleMode='nearest';cells.set(c.cell,{...c,texture});}
      banks.set(`${bank.kind}:${bank.itemIndex}`,{...bank,cells});
    }
  }catch(error){await Promise.allSettled(loaded.map(src=>PIXI.Assets.unload(src)));throw error;}
  let disposal;
  return {getFrame(object){
    const initial=huntFeedbackBinding(object);if(!initial)return null;
    const b=object.visualBinding?{...initial,...object.visualBinding}:initial;
    const bank=banks.get(`${b.kind}:${b.item}`),sequence=bank?.sequences.find(s=>s.id===b.sequence);if(!sequence)return null;
    const elapsed=b.remaining===undefined?b.elapsed:sequence.frames.reduce((sum,f)=>sum+f.ticks,0)-b.remaining;
    return bank.cells.get(huntFeedbackCell(sequence,elapsed))??null;
  },dispose(){return disposal??=Promise.allSettled(loaded.map(src=>PIXI.Assets.unload(src)));}};
}

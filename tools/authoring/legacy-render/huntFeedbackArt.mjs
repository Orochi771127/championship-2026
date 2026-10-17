import {isLocalBattleEffectPreview} from '../../../src/championship/presentation/battleEffectArt.js';
import {nativeAnimationCellAt} from '../../../src/championship/presentation/characterAnimationTimeline.js';
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

// Ordinary meat (MEAT item 0) shows the original care meat instead of the old
// reference cells. Hunt sequence 3-tier equals the care pose (tier 3 -> meat-0
// ... tier 0 -> meat-3), so only cells 0..3 change; timelines, consumption and
// every other meat kind keep their existing bank. The original raster has
// density 4, so its logical size/anchor must equal the native cell and the
// sprite is drawn at HUNT_NATIVE_SCALE/density: the same 64x48 world size.
export const ORIGINAL_HUNT_MEAT_ART_ID='art:original-ui:dot-intake:20261007:care';
export const ORIGINAL_HUNT_MEAT_MANIFEST='assets/production/original-ui-intake-20261007/care/manifest.json';
const HUNT_NATIVE_SCALE=2;
export function originalHuntMeatCells(manifest,nativeBank){
  const density=manifest?.scale;
  if(manifest?.schemaVersion!==1||manifest.assetId!==ORIGINAL_HUNT_MEAT_ART_ID||density!==4
    ||manifest.publicReleasePermitted!==false||manifest.shippingReady!==false||!Array.isArray(manifest.cells))throw new Error('HUNT_ORIGINAL_MEAT_MANIFEST_INVALID');
  return [0,1,2,3].map(pose=>{
    const matches=manifest.cells.filter(c=>c.role==='meat'&&c.pose===pose),c=matches[0];
    const native=nativeBank?.cells?.find(n=>n.cell===pose);
    if(matches.length!==1||!native||c.sequenceId!==pose
      ||c.src!==`assets/production/original-ui-intake-20261007/items/care19/meat-${pose}.png`
      ||c.nativeWidth!==native.width||c.nativeHeight!==native.height
      ||c.nativeAnchorX!==native.origin[0]||c.nativeAnchorY!==native.origin[1]
      ||!/^[a-f0-9]{64}$/.test(c.sha256))throw new Error('HUNT_ORIGINAL_MEAT_CELL_INVALID');
    return {cell:pose,src:c.src,width:c.nativeWidth,height:c.nativeHeight,origin:[c.nativeAnchorX,c.nativeAnchorY],sha256:c.sha256,
      rasterWidth:c.nativeWidth*density,rasterHeight:c.nativeHeight*density,displayScale:HUNT_NATIVE_SCALE/density,art:'ORIGINAL_CARE_MEAT'};
  });
}

export async function loadRegisteredHuntFeedbackArt({PIXI,baseUrl,fetchImpl=globalThis.fetch,kinds=null}){
  if(!isLocalBattleEffectPreview(baseUrl))return null;
  const indexResponse=await fetchImpl(new URL('assets/production/ART_PRODUCTION_INDEX.json',baseUrl));
  if(!indexResponse.ok)throw new Error('HUNT_FEEDBACK_INDEX_UNAVAILABLE');
  const index=await indexResponse.json();if(!index.entries?.some(e=>e.assetId===HUNT_FEEDBACK_ART_ID&&e.runtimeEligible))return null;
  const response=await fetchImpl(new URL(HUNT_FEEDBACK_ART_MANIFEST,baseUrl));if(!response.ok)throw new Error('HUNT_FEEDBACK_MANIFEST_UNAVAILABLE');
  const manifest=validateHuntFeedbackArt(await response.json(),index),banks=new Map(),loaded=[];
  // Every cell of every bank is independent, so awaiting one at a time made the
  // Hunt field wait for one round trip per cell. Load them all together and
  // assemble the banks from what arrives; failure still unloads everything that
  // loaded and rethrows the first problem, as before.
  // The carried loadout is fixed for this expedition. A rope-only trip cannot
  // emit mines, bombs or food; downloading all their animation cells delayed
  // the first visible map. Keep every item/sequence of each carried kind.
  const selectedBanks=kinds===null?manifest.banks:manifest.banks.filter(bank=>kinds.includes(bank.kind));
  const meatIndex=selectedBanks.findIndex(bank=>bank.kind==='MEAT'&&bank.itemIndex===0);
  if(meatIndex>=0){
    // No fallback to the old reference cells: a failed original meat rejects
    // this load exactly like any other missing cell.
    const meatResponse=await fetchImpl(new URL(ORIGINAL_HUNT_MEAT_MANIFEST,baseUrl));
    if(!meatResponse.ok)throw new Error('HUNT_ORIGINAL_MEAT_MANIFEST_UNAVAILABLE');
    const bank=selectedBanks[meatIndex],original=originalHuntMeatCells(await meatResponse.json(),bank);
    selectedBanks[meatIndex]={...bank,cells:[...original,...bank.cells.filter(c=>c.cell>3)]};
  }
  const pending=selectedBanks.flatMap(bank=>bank.cells.map(c=>({bank,c})));
  const results=await Promise.allSettled(pending.map(async e=>({...e,texture:await PIXI.Assets.load(e.c.src)})));
  for(const r of results)if(r.status==='fulfilled')loaded.push(r.value.c.src);
  try{
    const failed=results.find(r=>r.status==='rejected');
    if(failed)throw failed.reason;
    for(const bank of selectedBanks)banks.set(`${bank.kind}:${bank.itemIndex}`,{...bank,cells:new Map()});
    for(const {bank,c,texture} of results.map(r=>r.value)){
      if(texture.width!==(c.rasterWidth??c.width)||texture.height!==(c.rasterHeight??c.height))throw new Error('HUNT_FEEDBACK_DIMENSIONS');
      texture.source.scaleMode='nearest';
      banks.get(`${bank.kind}:${bank.itemIndex}`).cells.set(c.cell,{...c,texture});}
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

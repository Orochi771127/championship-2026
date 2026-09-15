// Selected complete cells for the Owner's art review. Loopback previews and,
// by the Owner's 2026-09-15 decision, the one Owner-approved playtest URL draw
// them. They remain unlicensed source references, not rights-verified art.
import manifest from '../../../assets/production/internal-faithful-baseline/assembled-ui-v1/manifest.json' with {type:'json'};
import index from '../../../assets/production/ART_PRODUCTION_INDEX.json' with {type:'json'};
import {nativeAnimationCellAt} from './characterAnimationTimeline.js';
import {isLocalBattleEffectPreview} from './battleEffectArt.js';

export const ASSEMBLED_UI_ART_ID = 'art:ui:assembled:local-reference:v1';
export function isAssembledUiPreview(baseUrl = globalThis.location?.href) {
  // Same destinations as the other source-reference bundles: loopback, or the
  // exact origin and base path in public-playtest.r1.json.
  return isLocalBattleEffectPreview(baseUrl);
}
export function validateAssembledUiArt(data, productionIndex) {
  const entry = productionIndex?.entries?.find(e => e.assetId === ASSEMBLED_UI_ART_ID);
  const prefix = 'assets/production/internal-faithful-baseline/assembled-ui-v1/';
  if (data?.schemaVersion !== 1 || data.assetId !== ASSEMBLED_UI_ART_ID || !entry
    || [data, entry].some(e => e.manifestPath !== prefix+'manifest.json' || e.runtimeEligible !== true
      || e.localOnly !== true || e.runtimeScope !== 'LOOPBACK_RESEARCH_ONLY' || e.shippingReady !== false
      || e.publicReleasePermitted !== false || e.rightsStatus !== 'ROM_COPYRIGHTED_REFERENCE'
      || e.gameplayBinding !== 'EXTERNAL_EXISTING_RUNTIME')) throw Error('ASSEMBLED_UI_NOT_REGISTERED');
  const keys = new Set();
  for (const c of data.cells ?? []) {
    if (keys.has(c.key) || !c.src.startsWith(prefix) || !/^[a-zA-Z0-9_-]+\.png$/.test(c.src.slice(prefix.length))
      || !/^[a-f0-9]{64}$/.test(c.sha256) || ![c.width,c.height].every(n=>Number.isInteger(n)&&n>0)
      || !Array.isArray(c.origin) || c.origin.length!==2 || !c.origin.every(Number.isInteger)) throw Error('ASSEMBLED_UI_CELL_INVALID');
    keys.add(c.key);
  }
  if (data.goods?.length !== 114 || data.cages?.length !== 36
    || [...data.goods, ...data.cages, ...Object.values(data.hud??{})].some(b=>!keys.has(b.cellKey))) throw Error('ASSEMBLED_UI_BINDING_INVALID');
  for(const animation of Object.values(data.animations??{})) {
    if(![1,2,3,4].includes(animation.playbackMode)||!Array.isArray(animation.frames)||!animation.frames.length
      || !Number.isInteger(animation.loopStartFrame)||animation.loopStartFrame<0||animation.loopStartFrame>=animation.frames.length
      || animation.frames.some(f=>!keys.has(f.cellKey)||!Number.isInteger(f.ticks)||f.ticks<1)) throw Error('ASSEMBLED_UI_ANIMATION_INVALID');
  }
  return data;
}
const checked = validateAssembledUiArt(manifest, index);
const cells = new Map(checked.cells.map(c=>[c.key, c]));
export function assembledShopArt(shopRecordIndex, baseUrl) {
  if (!isAssembledUiPreview(baseUrl)) return null;
  const binding = checked.goods.find(g=>g.shopRecordIndex === shopRecordIndex);
  return binding ? {...cells.get(binding.cellKey), ...binding} : null;
}
export function assembledCageArt(definition, baseUrl) {
  if (!isAssembledUiPreview(baseUrl)) return null;
  const binding = checked.cages.find(c=>c.definition === definition);
  return binding ? {...cells.get(binding.cellKey), ...binding} : null;
}
export function assembledHudArt(key, baseUrl) {
  if (!isAssembledUiPreview(baseUrl)) return null;
  const binding = checked.hud?.[key];
  return binding ? {...cells.get(binding.cellKey), ...binding} : null;
}

export function assembledAnimationArt(key, ticks, baseUrl) {
  if (!isAssembledUiPreview(baseUrl)) return null;
  const sequence = checked.animations?.[key];
  if (!sequence) return null;
  const cellKey = nativeAnimationCellAt({...sequence,frames:sequence.frames.map(f=>({...f,cell:f.cellKey}))},ticks);
  return cells.get(cellKey) ?? null;
}

// OVL18 0211B3A8 advances the green child only in phase 3, and the blue
// burst only in phases 5..7. 0211DF10 advances by one native tick before draw.
export function evolutionArtClock(e) {
  if (!e || !Number.isInteger(e.phase) || !Number.isInteger(e.elapsed) || e.phase<0 || e.phase>7 || e.elapsed<0) return null;
  return {ring:e.target>=0&&e.phase>=2&&e.phase<7,
    ringAlpha:e.phase===2?Math.min(1,Math.max(0,(e.totalFrames??35+e.elapsed)-35)*8/31):1,
    burstAlpha:e.phase===5?0:e.phase===6?Math.min(1,e.elapsed*8/31):e.phase===7?Math.max(0,1-Math.max(0,e.elapsed-15)*3/31):0,
    greenTicks:e.phase===3?e.elapsed+1:null,
    burstTicks:e.phase===5?e.elapsed+1:e.phase===6?9+e.elapsed:e.phase===7?69+e.elapsed:null};
}

export async function loadAssembledEvolutionArt(PIXI, baseUrl) {
  if (!isAssembledUiPreview(baseUrl)) return null;
  const selected = checked.cells.filter(c=>c.sourceFamily==='common/e001_evolution_all'||c.sourceFamily==='common/e001_ikusei');
  const results=await Promise.allSettled(selected.map(async c=>({c,texture:await PIXI.Assets.load(c.src)})));
  const loaded=results.filter(r=>r.status==='fulfilled').map(r=>r.value);
  const unload=()=>Promise.allSettled(loaded.map(({c})=>PIXI.Assets.unload(c.src)));
  const failed=results.find(r=>r.status==='rejected');
  if(failed){await unload();throw failed.reason;}
  try {
    for(const {c,texture} of loaded) {
      if(texture.width!==c.width||texture.height!==c.height) throw Error('ASSEMBLED_EVOLUTION_DIMENSIONS');
      texture.source.scaleMode='nearest';
    }
  } catch(error) {await unload();throw error;}
  const textures=new Map(loaded.map(({c,texture})=>[c.key,{...c,texture}]));
  return {get:key=>textures.get(checked.hud[key]?.cellKey)??null,
    frame:(key,ticks)=>textures.get(assembledAnimationArt(key,ticks,baseUrl)?.key)??null,
    dispose:unload};
}

// Separate corner/edge cells are intentional. Layout belongs to the DOM and
// scales to the approved portrait frame; source Japanese text is not flattened.
export function appendMemoryCardFrame(host) {
  if (!assembledHudArt('memory-tl')) return;
  host.classList.add('cm-memory-card-frame');
  for (const side of ['tl','top','tr','left','right','bl','bottom','br']) {
    const art = assembledHudArt(`memory-${side}`);
    const piece = document.createElement('span');
    piece.className = `cm-memory-card-frame__piece cm-memory-card-frame__piece--${side}`;
    piece.setAttribute('aria-hidden','true');
    piece.style.backgroundImage = `url("${new URL('../../../'+art.src,import.meta.url).href}")`;
    host.append(piece);
  }
}

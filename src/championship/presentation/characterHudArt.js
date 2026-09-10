import {isLocalBattleEffectPreview} from './battleEffectArt.js';
import {nativeAnimationCellAt} from './characterAnimationTimeline.js';
export const CHARACTER_HUD_ART_ID='art:characters:hud:local-reference:v1';
export const CHARACTER_HUD_ART_MANIFEST='assets/production/internal-faithful-baseline/character-hud-v1/manifest.json';

export function validateCharacterHudArt(manifest,index){
  const entry=index?.entries?.find(e=>e.assetId===CHARACTER_HUD_ART_ID);
  if(manifest?.schemaVersion!==1||manifest.assetId!==CHARACTER_HUD_ART_ID||!entry
    ||manifest.binding!=='OVL18_SELECTED_DB_SUB_SEQUENCE_0_FIRST_FRAME_STATIC'
    ||[entry,manifest].some(e=>e.manifestPath!==CHARACTER_HUD_ART_MANIFEST||e.runtimeEligible!==true||e.localOnly!==true
      ||e.runtimeScope!=='LOOPBACK_RESEARCH_ONLY'||e.publicReleasePermitted!==false||e.shippingReady!==false
      ||e.rightsStatus!=='ROM_COPYRIGHTED_REFERENCE'))throw new Error('CHARACTER_HUD_NOT_REGISTERED');
  if(!Array.isArray(manifest.portraits)||!manifest.portraits.length)throw new Error('CHARACTER_HUD_PORTRAITS_REQUIRED');
  const ids=new Set();
  for(const p of manifest.portraits){
    if(!/^species-\d{3}$/.test(p.speciesId)||ids.has(p.speciesId)||!/^([em]\d{3}_[a-z0-9_]+)$/.test(p.entityId)
      ||p.src!==CHARACTER_HUD_ART_MANIFEST.replace('manifest.json',p.entityId+'.png')
      ||p.sourceBank!==p.entityId+'_db_sub'||p.sequenceId!==0||p.nativeScale!==2
      ||![p.width,p.height].every(n=>Number.isInteger(n)&&n>0)||!/^[a-f0-9]{64}$/.test(p.sha256))throw new Error('CHARACTER_HUD_PORTRAIT_INVALID');
    ids.add(p.speciesId);
  }
  for(const bank of manifest.battle??[]){
    if(!ids.has(bank.speciesId)||!/^([em]\d{3}_[a-z0-9_]+)$/.test(bank.entityId)||bank.sourceBank!==bank.entityId+'_sub')throw new Error('CHARACTER_HUD_BATTLE_BANK_INVALID');
    for(const c of bank.cells)if(c.src!==CHARACTER_HUD_ART_MANIFEST.replace('manifest.json',`battle/${bank.entityId}/cell-${String(c.cell).padStart(3,'0')}.png`)
      ||![c.width,c.height].every(n=>Number.isInteger(n)&&n>0)||!c.origin?.every(Number.isInteger)||c.origin.length!==2
      ||!/^[a-f0-9]{64}$/.test(c.sha256))throw new Error('CHARACTER_HUD_BATTLE_CELL_INVALID');
    for(const s of bank.sequences)if(![0,5,9].includes(s.id)||![1,2].includes(s.playbackMode)||!s.frames?.length
      ||s.frames.some(f=>!Number.isInteger(f.ticks)||f.ticks<=0||!bank.cells.some(c=>c.cell===f.cell)))throw new Error('CHARACTER_HUD_BATTLE_SEQUENCE_INVALID');
  }
  const medalIds=new Set();
  for(const m of manifest.medals??[]){
    if(!Number.isInteger(m.titleId)||m.titleId<0||m.titleId>=61||medalIds.has(m.titleId)
      ||m.src!==CHARACTER_HUD_ART_MANIFEST.replace('manifest.json',`medals/item_badge${String(m.titleId+1).padStart(3,'0')}.png`)
      ||![m.width,m.height].every(n=>Number.isInteger(n)&&n>0)||!/^[a-f0-9]{64}$/.test(m.sha256))throw new Error('CHARACTER_HUD_MEDAL_INVALID');
    medalIds.add(m.titleId);
  }
  const cageIds=new Set();
  for(const c of manifest.ranch??[]){
    if(!Number.isInteger(c.definition)||c.definition<0||c.definition>36||cageIds.has(c.definition)
      ||c.src!==CHARACTER_HUD_ART_MANIFEST.replace('manifest.json',`ranch/cage-${String(c.definition).padStart(2,'0')}.png`)
      ||![c.width,c.height].every(n=>Number.isInteger(n)&&n>0)||c.origin?.length!==2||!c.origin.every(Number.isInteger)
      ||!/^[a-f0-9]{64}$/.test(c.sha256))throw new Error('CHARACTER_HUD_RANCH_INVALID');
    cageIds.add(c.definition);
  }
  return structuredClone(manifest);
}
export async function loadRegisteredCharacterHudArt({baseUrl,fetchImpl=globalThis.fetch}){
  if(!isLocalBattleEffectPreview(baseUrl))return null;
  const indexResponse=await fetchImpl(new URL('assets/production/ART_PRODUCTION_INDEX.json',baseUrl));
  if(!indexResponse.ok)throw new Error('CHARACTER_HUD_INDEX_UNAVAILABLE');
  const index=await indexResponse.json();
  if(!index.entries?.some(e=>e.assetId===CHARACTER_HUD_ART_ID&&e.runtimeEligible))return null;
  const response=await fetchImpl(new URL(CHARACTER_HUD_ART_MANIFEST,baseUrl));
  if(!response.ok)throw new Error('CHARACTER_HUD_MANIFEST_UNAVAILABLE');
  const manifest=validateCharacterHudArt(await response.json(),index),portraits=new Map(manifest.portraits.map(p=>[p.speciesId,p]));
  const battle=new Map((manifest.battle??[]).map(b=>[b.speciesId,{sequences:b.sequences,cells:new Map(b.cells.map(c=>[c.cell,c]))}]));
  const canonical=id=>id?.replace(/^championship:creature:/,'');
  return Object.freeze({getPortrait(speciesId){return portraits.get(canonical(speciesId))??null;},
    getMedal(titleId){return manifest.medals?.find(m=>m.titleId===titleId)??null;},
    getCageThumbnail(definition){return manifest.ranch?.find(c=>c.definition===definition)??null;},
    getBattleCells(speciesId,sequenceId){const bank=battle.get(canonical(speciesId)),sequence=bank?.sequences.find(s=>s.id===sequenceId);
      return sequence?[...new Set(sequence.frames.map(f=>f.cell))].map(id=>bank.cells.get(id)):[];},
    getBattleFrame(speciesId,sequenceId,elapsed){const bank=battle.get(canonical(speciesId)),sequence=bank?.sequences.find(s=>s.id===sequenceId);
      return bank?.cells.get(nativeAnimationCellAt(sequence,elapsed))??null;}});
}

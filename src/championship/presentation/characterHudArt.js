import {originalMedalArt} from './completedOriginalUi20261007.js';
import {isLocalBattleEffectPreview} from './battleEffectArt.js';
import {nativeAnimationCellAt} from './characterAnimationTimeline.js';
import {readHudManifest} from './hudManifestCache.js';
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
export async function loadRegisteredCharacterHudArt({baseUrl,fetchImpl=globalThis.fetch,speciesIds=null}){
  if(!isLocalBattleEffectPreview(baseUrl))return null;
  const index=await readHudManifest(new URL('assets/production/ART_PRODUCTION_INDEX.json',baseUrl),fetchImpl);
  if(!index.entries?.some(e=>e.assetId===CHARACTER_HUD_ART_ID&&e.runtimeEligible))return null;
  const manifest=validateCharacterHudArt(await readHudManifest(new URL(CHARACTER_HUD_ART_MANIFEST,baseUrl),fetchImpl),index),portraits=new Map(manifest.portraits.map(p=>[p.speciesId,p]));
  const battle=new Map((manifest.battle??[]).map(b=>[b.speciesId,{sequences:b.sequences,cells:new Map(b.cells.map(c=>[c.cell,c]))}]));
  const {applyCompletedOriginalHudArt,completedOriginalHudSpecies,originalHudSourceSpecies}=await import('./completedOriginalCharacters.js');
  const canonical=id=>id?.replace(/^championship:creature:/,'');
  const known=new Set(completedOriginalHudSpecies(baseUrl)),settled=new Set(),pending=new Map(),listeners=new Set();
  async function ensureSpecies(ids){
    const wanted=[...new Set(ids.map(originalHudSourceSpecies))].filter(id=>known.has(id)&&!settled.has(id));
    const missing=wanted.filter(id=>!pending.has(id));
    if(missing.length){
      const load=applyCompletedOriginalHudArt({baseUrl,fetchImpl,portraits,battle,speciesIds:missing})
        .then(()=>{for(const id of missing){settled.add(id);pending.delete(id);}for(const listener of [...listeners])listener();});
      for(const id of missing)pending.set(id,load);
    }
    await Promise.all(wanted.map(id=>pending.get(id)));
  }
  await ensureSpecies(speciesIds===null?[...known]:speciesIds);
  if(new URL(baseUrl).searchParams.get('characterArtReview')==='m001'){
    const {applyM001HudReview}=await import('./m001CharacterHudReview.js');
    await applyM001HudReview({baseUrl,fetchImpl,portraits,battle});
  }
  if(['m002','m003','m004','m005','m006','m007','m008','m009','m010','m011','m012','m101','m102','m103','m104','m105'].includes(new URL(baseUrl).searchParams.get('characterArtReview'))){
    const {applyCandidateCharacterHudReview}=await import('./candidateCharacterHudReview.js');
    await applyCandidateCharacterHudReview({baseUrl,fetchImpl,portraits,battle});
  }
  const ready=id=>{id=originalHudSourceSpecies(id);if(!known.has(id)||settled.has(id))return true;void ensureSpecies([id]);return false;};
  return Object.freeze({ensureSpecies,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
    getPortrait(speciesId){return ready(speciesId)?portraits.get(canonical(speciesId))??null:null;},
    getMedal(titleId){return originalMedalArt(titleId,baseUrl)??manifest.medals?.find(m=>m.titleId===titleId)??null;},
    getCageThumbnail(definition){return manifest.ranch?.find(c=>c.definition===definition)??null;},
    getBattleCells(speciesId,sequenceId){if(!ready(speciesId))return [];const bank=battle.get(canonical(speciesId)),sequence=bank?.sequences.find(s=>s.id===sequenceId);
      return sequence?[...new Set(sequence.frames.map(f=>f.cell))].map(id=>bank.cells.get(id)):[];},
    getBattleFrame(speciesId,sequenceId,elapsed){if(!ready(speciesId))return null;const bank=battle.get(canonical(speciesId)),sequence=bank?.sequences.find(s=>s.id===sequenceId);
      return bank?.cells.get(nativeAnimationCellAt(sequence,elapsed))??null;}});
}

import {publicHudCharacterConfig as publicCharacterConfig} from './publicCharacterCatalog.js';
import {originalMedalArt} from './completedOriginalUi20261007.js';
import {originalCageLocationArt} from './originalCageLocationArt.js';
import {nativeAnimationCellAt} from './characterAnimationTimeline.js';
import {readPublicHudManifest} from './publicHudManifestCache.js';
import {newArtPortrait,newArtPortraitLike} from './newArtPortrait.js';

const canonical=id=>id?.replace(/^championship:creature:/,'');
export async function loadPublicCharacterHudArt({baseUrl,fetchImpl=globalThis.fetch,speciesIds=[]}){
 const records=new Map(),pending=new Map(),listeners=new Set(),waiting=[];let active=0;
 async function inMetadataSlot(work){
  if(active>=6)await new Promise(resolve=>waiting.push(resolve));else active++;
  try{return await work();}finally{const next=waiting.shift();if(next)next();else active--;}
 }
 async function ensureSpecies(ids){
  const configs=[...new Map(ids.map(publicCharacterConfig).filter(Boolean).map(c=>[c.entityId,c])).values()];
  await Promise.all(configs.map(config=>{
   if(records.has(config.entityId))return;
   if(pending.has(config.entityId))return pending.get(config.entityId);
   const task=inMetadataSlot(async()=>{
    const data=await readPublicHudManifest(new URL(config.hudPath,baseUrl),config.hudSha256,fetchImpl);
    if(data.schemaVersion!==1||data.entityId!==config.entityId||!data.portrait||!data.battle?.cells||!data.battle?.sequences)throw Error('PUBLIC_HUD_SCHEMA');
    for(const cell of [data.portrait,...data.battle.cells])if(!cell.src?.startsWith('assets/production/characters/')||cell.src.includes('..')||!/^[a-f0-9]{64}$/.test(cell.sha256))throw Error('PUBLIC_HUD_CELL');
    records.set(config.entityId,{portrait:data.portrait,battle:{sequences:data.battle.sequences,cells:new Map(data.battle.cells.map(c=>[c.cell,c]))}});
    for(const listener of [...listeners])listener();
   }).finally(()=>pending.delete(config.entityId));pending.set(config.entityId,task);return task;
  }));
 }
 await ensureSpecies(speciesIds??[]);
 const get=id=>{const config=publicCharacterConfig(canonical(id));if(!config)return null;const record=records.get(config.entityId);if(!record)void ensureSpecies([id]).catch(()=>{});return record;};
 return Object.freeze({ensureSpecies,subscribe(listener){listeners.add(listener);return()=>listeners.delete(listener);},
  // The record (HUD manifest) still gates readiness and sizing; the picture is the current design.
  getPortrait:id=>newArtPortraitLike(canonical(id),get(id)?.portrait??null),
  getMedal:id=>originalMedalArt(id,baseUrl),getCageThumbnail(id){const src=originalCageLocationArt(id,baseUrl);return src?{src}:null;},
  getBattleCells(id,sequenceId){const bank=get(id)?.battle,sequence=bank?.sequences.find(s=>s.id===sequenceId);return sequence?[...new Set(sequence.frames.map(f=>f.cell))].map(cell=>bank.cells.get(cell)):[];},
  getBattleFrame(id,sequenceId,elapsed){const bank=get(id)?.battle,art=bank?newArtPortrait(canonical(id)):null;if(art)return art;const sequence=bank?.sequences.find(s=>s.id===sequenceId);return bank?.cells.get(nativeAnimationCellAt(sequence,elapsed))??null;}});
}

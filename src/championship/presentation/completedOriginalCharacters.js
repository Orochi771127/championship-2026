import acceptedSelection from '../../data/championship/accepted-original-character-selection.r1.json' with {type:'json'};
import {isApprovedOriginalPublicLocation,isOriginalRuntimeLocation} from './originalRuntimeLocation.js';
import {loadLicensedCharacterRoster} from './licensedCharacterRoster.js';
import {loadPixiCharacterRuntimeBundle} from './pixiCharacterRuntimeBundle.js';

import {COMPLETED_ORIGINAL_CHARACTERS} from './completedOriginalCharacterCatalog.js';
const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'
  ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;

/** Existing runtime schema is the one density/motion authority for loading and QA. */
export function validateCompletedOriginalRuntime(runtime,config,baseline){
  if(runtime?.schemaVersion!==1||runtime.renderer!=='PIXIJS_V8_SPRITESHEET')
    throw Error('COMPLETED_ORIGINAL_RUNTIME_SCHEMA');
  const profile=runtime.artProfile,origin=config.origin;
  if(runtime.sourceBankSha256!==config.sourceBankSha256)throw Error('COMPLETED_ORIGINAL_BANK_DRIFT');
  if(runtime.entityId!==config.entityId||profile?.reviewOnly!==true||profile.runtimeEligible!==false
    ||profile.publicReleasePermitted!==false||profile.scale!==config.density
    ||JSON.stringify(profile.logicalCanvas)!==JSON.stringify(config.logicalCanvas)
    ||profile.anchor?.x!==origin[0]/config.logicalCanvas[0]||profile.anchor?.y!==origin[1]/config.logicalCanvas[1])
    throw Error('CANDIDATE_REVIEW_PROFILE_DRIFT');
  for(const side of ['main','sub']){
    const animations=runtime.sides?.[side]?.animations,original=baseline?.sides?.[side]?.animations;
    if(!Array.isArray(animations)||!Array.isArray(original)
      ||JSON.stringify(canonical(animations))!==JSON.stringify(canonical(original)))
      throw Error('CANDIDATE_REVIEW_MOTION_DRIFT');
    for(const animation of animations)for(const frame of animation.frames){
      const geometry=runtime.reviewGeometry?.frames?.[frame.texture];
      if(!geometry||geometry.scale!==config.density||JSON.stringify(geometry.origin)!==JSON.stringify(config.frameOrigins[frame.texture])
        ||JSON.stringify(geometry.sourceSize)!==JSON.stringify(config.rasterCanvas))throw Error('CANDIDATE_REVIEW_ORIGIN_DRIFT');
    }
  }
}

/** Reuse the reviewed density-four adapter in the existing normal local roster. */
export async function loadCompletedOriginalCharacters(options,href){
  if(!isOriginalRuntimeLocation(href))return loadLicensedCharacterRoster(options);
  const publicSelection=isApprovedOriginalPublicLocation(href);
  const configs=publicSelection?acceptedSelection.characters:COMPLETED_ORIGINAL_CHARACTERS;
  const assetRoot=publicSelection?acceptedSelection.root:"assets/production/internal-character-review/";
  const byEntity=new Map(configs.map(c=>[c.entityId,c]));
  const reviewed=new Set();
  const replacementFailures=[];
  const roster=await loadLicensedCharacterRoster({...options,loadBundle:async args=>{
    const config=byEntity.get(new URL(args.runtimeUrl).pathname.split('/').at(-2));
    if(!config)
      return loadPixiCharacterRuntimeBundle(args);
  const runtimeUrl=new URL(`${assetRoot}${config.folder}/runtime.review.json`,href).href;
    let bundle;
    try {
    bundle=await loadPixiCharacterRuntimeBundle({...args,runtimeUrl,
      cachePrefix:`${config.entityId}-completed-original-local:`});
      const runtime=bundle.runtime;
      const response=await fetch(args.runtimeUrl);
      if(!response.ok)throw Error('CANDIDATE_BASELINE_MOTION_UNAVAILABLE');
      const baseline=await response.json();
      validateCompletedOriginalRuntime(runtime,config,baseline);
      reviewed.add(config.entityId);
      return {...bundle,createActor(actorOptions){return bundle.createActor({...actorOptions,
        nativeGeometry:actorOptions.nativeFramePresentation?runtime.reviewGeometry:null,
        battleGeometry:actorOptions.battleGeometry?runtime.reviewGeometry:null});}};
    }catch(error){
      await bundle?.dispose();
      replacementFailures.push({entityId:config.entityId,reason:error.message});
      return loadPixiCharacterRuntimeBundle(args);
    }
  }});
  return Object.freeze({...roster,
    createActor(options){
      const actor=roster.createActor(options);
      const config=byEntity.get(actor?.entityId);
      if(!config||!reviewed.has(actor.entityId))return actor;
      return Object.freeze({...actor,nativeSizing:actor.nativeSizing?Object.freeze({...actor.nativeSizing,
        packedPixelsPerNativePixel:config.density,evidence:'COMPLETED_ORIGINAL_DENSITY4_LOCAL_PLAY'}):null});
    },
    getDiagnostics(){return {...roster.getDiagnostics(),completedOriginalArt:{scope:publicSelection?"OWNER_HASH_SELECTED_PLAYTEST":"NORMAL_LOOPBACK_PLAY",configured:configs.length,loaded:[...reviewed],failures:replacementFailures,publicReleasePermitted:publicSelection,shippingReady:false}};}
  });
}

export async function applyCompletedOriginalHudArt({baseUrl,fetchImpl,portraits,battle}){
  if(!isOriginalRuntimeLocation(baseUrl))return;
  const configs=isApprovedOriginalPublicLocation(baseUrl)?acceptedSelection.characters:COMPLETED_ORIGINAL_CHARACTERS;
  // Bound network work while retaining catalog order for validation and aliases.
  // Serial 222-manifest round trips delayed the first raising screen on cold CDN loads.
  const loaded=new Array(configs.length);let next=0;
  await Promise.all(Array.from({length:Math.min(6,configs.length)},async()=>{
    while(next<configs.length){
      const i=next++,config=configs[i];
      try{loaded[i]={manifest:await fetchCompletedHudManifest({baseUrl,fetchImpl},config)};}
      catch(error){loaded[i]={error};}
    }
  }));
  for(const [i,config] of configs.entries()){
    try{
      if(loaded[i].error)throw loaded[i].error;
      applyCompletedHudCharacter({baseUrl,portraits,battle},config,loaded[i].manifest);
    }catch(error){console.warn('CHAMPIONSHIP_COMPLETED_ORIGINAL_HUD_FALLBACK',config.entityId,error.message);}
  }
}
function completedHudPrefix(baseUrl,config){
  const assetRoot=isApprovedOriginalPublicLocation(baseUrl)?acceptedSelection.root:"assets/production/internal-character-review/";
  return `${assetRoot}${config.folder}/hud-r01/`;
}
async function fetchCompletedHudManifest({baseUrl,fetchImpl},config){
  const url=new URL(completedHudPrefix(baseUrl,config)+'manifest.json',baseUrl);
  let response=await fetchImpl(url);
  if([429,500,502,503,504].includes(response.status)){
    await new Promise(resolve=>setTimeout(resolve,200));
    response=await fetchImpl(url);
  }
  if(!response.ok)throw Error('CANDIDATE_HUD_REVIEW_UNAVAILABLE');
  return response.json();
}
function applyCompletedHudCharacter({baseUrl,portraits,battle},config,manifest){
  const prefix=completedHudPrefix(baseUrl,config);
  if(manifest.sourceBankSha256!==config.sourceBankSha256||manifest.entityId!==config.entityId||manifest.reviewOnly!==true||manifest.runtimeEligible!==false
    ||manifest.publicReleasePermitted!==false||manifest.portrait?.speciesId!==config.speciesId
    ||manifest.battle?.speciesId!==config.speciesId||manifest.portrait.nativeScale!==2
    ||manifest.portrait.derivation!=='ORIGINAL_CANDIDATE_MAIN_CELL_000_VISIBLE_RGBA')
    throw Error('CANDIDATE_HUD_REVIEW_INVALID');
  const baseline=battle.get(config.speciesId);
  if(!baseline||JSON.stringify(manifest.battle.sequences.map(sequence=>[sequence.id,sequence.playbackMode,
      sequence.loopStartFrame,sequence.frames.map(frame=>[frame.cell,frame.ticks])]))
    !==JSON.stringify(baseline.sequences.map(sequence=>[sequence.id,sequence.playbackMode,
      sequence.loopStartFrame,sequence.frames.map(frame=>[frame.cell,frame.ticks])])))
    throw Error('CANDIDATE_HUD_TIMING_DRIFT');
  for(const cell of [manifest.portrait,...manifest.battle.cells])if(!cell.src.startsWith(prefix)||cell.src.includes('..')
    ||!cell.origin?.every(Number.isFinite)||cell.origin.length!==2
    ||![cell.width,cell.height].every(value=>Number.isFinite(value)&&value>0&&value<=Math.max(...config.logicalCanvas))
    ||!/^[a-f0-9]{64}$/.test(cell.sha256))throw Error('CANDIDATE_HUD_CELL_INVALID');
  for(const cell of [manifest.portrait,...manifest.battle.cells])if(cell.rasterScale!==4||cell.rasterWidth!==cell.width*4||cell.rasterHeight!==cell.height*4)throw Error('HD_HUD_DENSITY_DRIFT');
  for(const cell of [manifest.portrait,...manifest.battle.cells])if(cell.width>config.logicalCanvas[0]||cell.height>config.logicalCanvas[1])throw Error('HD_HUD_STORAGE_DRIFT');
  if(!baseline.sequences.every(sequence=>sequence.frames.every(frame=>manifest.battle.cells.some(cell=>cell.cell===frame.cell))))
    throw Error('CANDIDATE_HUD_CELL_MISSING');
  portraits.set(config.speciesId,manifest.portrait);
  battle.set(config.speciesId,{sequences:manifest.battle.sequences,
    cells:new Map(manifest.battle.cells.map(cell=>[cell.cell,cell]))});
  const ALIAS_SPECIES = {
    'species-034': 'species-224',
    'species-195': 'species-225',
    'species-226': 'species-096',
    'species-227': 'species-097'
  };
  const aliasId = ALIAS_SPECIES[config.speciesId];
  if (aliasId) {
    portraits.set(aliasId, manifest.portrait);
    battle.set(aliasId, {
      sequences: manifest.battle.sequences,
      cells: new Map(manifest.battle.cells.map(cell => [cell.cell, cell]))
    });
  }
}

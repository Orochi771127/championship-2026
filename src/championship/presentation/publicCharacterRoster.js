import {getPublicReviewedRaisingContactArt} from './vs2/huntContactShadow.js';
import {PUBLIC_CHARACTER_DATA as catalog,PUBLIC_CHARACTER_CATALOG} from './publicCharacterCatalog.js';
export {publicCharacterConfig,publicCharacterConfigs} from './publicCharacterCatalog.js';
import {loadCharacterRosterCore} from './characterRosterCore.js';
import {loadPixiCharacterRuntimeBundle} from './pixiCharacterRuntimeBundle.js';
import {PUBLIC_CHARACTER_RENDER_KIND,canonicalRenderValue} from './publicCharacterRenderContract.js';
import {attachReviewedCharacterAnimation,reviewedSpeciesForEntity,reviewedReplacesOriginal} from './reviewedCharacterLoader.js';
import {isOriginalLoopbackLocation} from './originalRuntimeLocation.js';
import {stageBodyScale,scaleNativeGeometry} from './stageBodySize.js';

const configs=new Map(catalog.characters.map(c=>[c.entityId,c]));
const hash=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value))),b=>b.toString(16).padStart(2,'0')).join('');

export async function validatePublicCharacterRender(runtime,config){
 if(runtime?.kind!==PUBLIC_CHARACTER_RENDER_KIND||runtime.entityId!==config.entityId||runtime.renderer!=='PIXIJS_V8_SPRITESHEET'
   ||runtime.artProfile?.scale!==config.density||runtime.artProfile.filter!=='nearest'
   ||JSON.stringify(runtime.artProfile.logicalCanvas)!==JSON.stringify(config.logicalCanvas)
   ||runtime.artProfile.anchor?.x!==config.origin[0]/config.logicalCanvas[0]
   ||runtime.artProfile.anchor?.y!==config.origin[1]/config.logicalCanvas[1])throw Error('PUBLIC_CHARACTER_PROFILE');
 const motion=Object.fromEntries(['main','sub'].map(side=>[side,runtime.sides?.[side]?.animations]));
 if(await hash(JSON.stringify(canonicalRenderValue(motion)))!==config.motionSha256)throw Error('PUBLIC_CHARACTER_NATIVE_MOTION');
 if(await hash(JSON.stringify(canonicalRenderValue(runtime.geometry)))!==config.geometrySha256)throw Error('PUBLIC_CHARACTER_NATIVE_GEOMETRY');
}

// The existing scene roster still owns the queue, cancellation, decoded
// sources and actor presentation. No private registration is synthesized.
export async function loadPublicCharacterRoster({PIXI,speciesIds,sides=['main'],signal=null,initialSequences=null,battleAtlas=false,
 fetchImpl=(...args)=>globalThis.fetch(...args)},baseUrl){
 if(catalog.schemaVersion!==1||catalog.assetId!=='art:public:characters:v1'||(!isOriginalLoopbackLocation(baseUrl)&&(sides.length!==1||sides[0]!=='main')))throw Error('PUBLIC_CHARACTER_CATALOG_SCHEMA');
 const manifestUrl=new URL(PUBLIC_CHARACTER_CATALOG,baseUrl).href;
 const records=catalog.characters.map(c=>({entityId:c.entityId,runtime:'../../../'+c.runtimePath}));
 const fromUrl=new Map(records.map(record=>[new URL(record.runtime,manifestUrl).href,configs.get(record.entityId)]));
 const manifest={assetId:catalog.assetId,records,speciesBindings:catalog.speciesBindings};
 const loaded=new Set(),loadedRuntimeHashes=new Map();
 const roster=await loadCharacterRosterCore({PIXI,speciesIds,sides,signal,initialSequences,manifest,manifestUrl,manifestPath:PUBLIC_CHARACTER_CATALOG,
  validateRecordRuntime:(record,entityId)=>record?.entityId===entityId&&record.runtime==='../../../'+configs.get(entityId)?.runtimePath,
  nativeSizingResolver:record=>configs.get(record.entityId)?.nativeSizing??null,
  geometryResolver:({entityId,runtime,side})=>side==='main'&&configs.get(entityId)?.battleGeometry?runtime.geometry:null,
  loadBundle:async args=>{
   const config=fromUrl.get(args.runtimeUrl);if(!config)throw Error('PUBLIC_CHARACTER_IDENTITY');
   const packed=battleAtlas&&config.battleRuntimePath;
   const file=packed?config.battleRuntimePath:config.runtimePath,expected=packed?config.battleRuntimeSha256:config.runtimeSha256;
   const runtimeUrl=new URL(file,baseUrl).href,response=await fetchImpl(runtimeUrl,{signal});
   if(!response.ok)throw Error('PUBLIC_CHARACTER_HTTP_'+response.status);
   const text=await response.text();if(await hash(text)!==expected)throw Error('PUBLIC_CHARACTER_RUNTIME_HASH');
   const runtime=JSON.parse(text);await validatePublicCharacterRender(runtime,config);
   const reviewedSpecies=reviewedSpeciesForEntity(config,catalog.speciesBindings,baseUrl);
   // A replaced original keeps only its timing/geometry; its atlas pages are never fetched.
   const baseline=await loadPixiCharacterRuntimeBundle({...args,runtimeUrl,runtimeDocument:runtime,fetchImpl,cachePrefix:'public:'+config.entityId+':'+expected+':',
    pixels:!reviewedReplacesOriginal(reviewedSpecies,baseUrl)});
   const bundle=await attachReviewedCharacterAnimation({bundle:baseline,PIXI,speciesId:reviewedSpecies,baseUrl,signal,usage:'general',fetchImpl});
   loaded.add(config.entityId);loadedRuntimeHashes.set(config.entityId,expected);
   // Stage body size (stageBodySize.js): reviewed art carries it in its display scale; drawn
   // original art takes it through its cell geometry.
   const geometry=reviewedReplacesOriginal(reviewedSpecies,baseUrl)?runtime.geometry:scaleNativeGeometry(runtime.geometry,stageBodyScale(config.speciesId));
   return {...bundle,createActor:options=>bundle.createActor({...options,
    nativeGeometry:options.nativeFramePresentation?geometry:null,
    battleGeometry:options.battleGeometry?geometry:null})};
  }});
 return Object.freeze({...roster,
  createActor(options){
   const actor=roster.createActor(options);
   if(!actor||options?.presentation!=='raising'||!loaded.has(actor.entityId))return actor;
   const config=configs.get(actor.entityId);
   if(loadedRuntimeHashes.get(actor.entityId)!==config?.runtimeSha256)return actor;
   const contactShadowArt=getPublicReviewedRaisingContactArt(config,options?.side??'main');
   return contactShadowArt?Object.freeze({...actor,contactShadowArt}):actor;
  },
  getDiagnostics:()=>({...roster.getDiagnostics(),publicCharacters:{configured:configs.size,loaded:[...loaded],privateIndexRequested:false}})});
}

import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
import {publicRuntimeIndex,PUBLIC_RUNTIME_INDEX_PATH,PUBLIC_RUNTIME_ALLOWLIST_PATH} from './lib/public-runtime-boundary.mjs';
import {selectedShopCageProjection} from './lib/public-shop-cage-projection.mjs';
import {projectPublicRenderSources,PUBLIC_RENDER_FIELDS,PUBLIC_RENDER_RECIPE} from './lib/public-render-projection.mjs';
import {selectedMapProjections,MAP_RECIPE,PUBLIC_MAP_FIELDS} from './lib/public-map-projection.mjs';
import {projectPublicMetadata,METADATA_RECIPE} from './lib/public-metadata-projection.mjs';
import {publicCleanMedia,CLEAN_MEDIA_RECIPE} from './lib/public-clean-media.mjs';
import {publicProgramData,PROGRAM_RECIPE} from './lib/public-program-data.mjs';
import {compileBrowserBundle} from './lib/browser-bundle.mjs';
import {openingFilmPublicationFiles} from './lib/opening-film-publication.mjs';
import {publicCharacterRequiredFiles} from './lib/public-character-boundary.mjs';
import {independentBattleFiles} from './lib/public-battle-page-policy.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const write=(file,value)=>{fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),JSON.stringify(value,null,2)+'\n');};
const inputPath='docs/contracts/championship/WEB_BUILD_INPUTS.v1.json',input=read(inputPath),allow=read(PUBLIC_RUNTIME_ALLOWLIST_PATH);
const index=read('assets/production/ART_PRODUCTION_INDEX.json'),heroes=read('src/data/championship/database-hero-portraits.public.v1.json');
const render=projectPublicRenderSources({root,input,index}),shop=selectedShopCageProjection({root,input,index});
const maps=selectedMapProjections({root,input});
const metadata=projectPublicMetadata({root,input});
const cleanMedia=publicCleanMedia({root}),cleanMap=new Map(cleanMedia.map(row=>[row.sourcePath,row]));
const allCleanMedia=read(CLEAN_MEDIA_RECIPE).files,inactiveClean=new Set(allCleanMedia.filter(row=>!cleanMap.has(row.sourcePath)).map(row=>row.path));
const program=publicProgramData({root});
input.importMap['pixi.js']='./assets/production/public-runtime/vendor-pixi.mjs';
const selectedOriginal=new Map([...shop.files,...render.media,...maps.files,...metadata.media]);
const activeHeroes=new Set(heroes.entries.map(row=>row.src));
const excluded=[];
const buildOnly=new Set(['assets/production/ART_PRODUCTION_INDEX.json','src/data/championship/public-playtest.r1.json',
 'src/data/championship/database-hero-portraits.r1.json','src/data/championship/qa-database-hero-portraits.r1.json',
 'src/championship/presentation/licensedCharacterRoster.js','src/championship/presentation/characterHudArt.js','src/championship/presentation/assembledUiArt.js',
 ...read(PUBLIC_RENDER_RECIPE).sources.map(row=>row.path)]);
read(MAP_RECIPE).sources.forEach(row=>buildOnly.add(row.path));
buildOnly.add('assets/production/hunt/licensed-runtime-v1/manifest.json');
read(METADATA_RECIPE).sources.forEach(row=>buildOnly.add(row.path));
buildOnly.add('assets/production/cage/licensed-runtime-v1/manifest.json');
buildOnly.add('assets/production/medal-name-corrections-20261014/manifest.json');
buildOnly.add('node_modules/pixi.js/dist/pixi.mjs');
allCleanMedia.forEach(row=>buildOnly.add(row.sourcePath));
// Explicit loopback art-review tools are absent from the normal browser bundle.
// Keep their source in Git, outside the public program entry/closure.
for(const name of ['candidateCharacterArtReview.js','candidateCharacterHudReview.js','m001CharacterArtReview.js','m001CharacterHudReview.js'])buildOnly.add('src/championship/presentation/'+name);
allow.files=allow.files.filter(row=>{
 const remove=buildOnly.has(row.path)||inactiveClean.has(row.path)||row.path.startsWith('assets/production/database-heroes-20261017/')&&!activeHeroes.has(row.path)
  ||row.path==='assets/production/opening-film-ns33-r1/opening-720p-74e171ba.mp4';
 if(remove)excluded.push(row.path);return !remove;
});
allow.assets=allow.assets.filter(row=>!row.id.endsWith(':database-hero')&&!inactiveClean.has(row.src));
allow.assets.push(...heroes.entries.map(row=>({id:`${row.speciesId}:database-hero`,src:row.src,sha256:row.sha256,width:row.width,height:row.height})));
const rows=new Map(allow.files.map(row=>[row.path,row]));
// Restore the original approved bytes by enabling the player and rerunning this recipe.
for(const file of rows.keys())if(file.startsWith('assets/production/opening-film-ns33-r1/')){rows.delete(file);excluded.push(file);}
for(const row of openingFilmPublicationFiles())rows.set(row.path,{...row});
const refreshed=['src/data/championship/database-hero-portraits.public.v1.json','src/championship/presentation/publicRenderDescriptors.js',
 'championship.html','src/data/championship/public-character-catalog.v1.json','src/championship/presentation/publicAlternateFormBindings.js',
 'src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js',
 ...['battleCharacterGeometry.js','battleCharacterProfiles.js','characterNativeSizing.js'].map(name=>'src/data/championship/'+name),
 'src/championship/presentation/dataArena/dataArenaRoster.js','src/championship/app/dataArenaScreen.js','src/championship/presentation/evolutionGlyphArt.js',
 'src/championship/presentation/publicMetadata.js','src/championship/presentation/cageForeground.js',
 'src/championship/presentation/acceptedDatabasePortraits.js',
 'src/championship/presentation/publicCharacterHudArt.js','src/championship/presentation/publicHudManifestCache.js',
 'src/championship/app/championshipStatusBar.js','src/championship/app/openingFilm.js','src/data/championship/public-ui-selection.v1.json',
 'src/championship/presentation/vfx/licensedVfxRuntimeBundle.js',
 ...['dataArenaEnvironment.js','dataArenaInteractionArt.js','dataArenaTournamentArt.js'].map(name=>'src/championship/presentation/dataArena/'+name),
 'src/championship/presentation/publicMapRequests.js','src/championship/presentation/runtimeMapArtBundle.js',
 'src/championship/presentation/cageUiArt.js','src/championship/presentation/huntMobileReadouts.js',
 'src/championship/presentation/finalHuntArt20261008.js','src/championship/app/main.js',
 'src/championship/app/vs4Screens.js','src/championship/database/databaseDisplayCatalog.js',
 'src/championship/database/databaseIllustrations.js','src/championship/database/databaseStories.js',
 'src/championship/presentation/databaseHeroPortraits.js','src/data/championship/database-illustrations.r1.json',
 ...['battleEffectArt.js','raisingFeedbackArt.js','huntFeedbackArt.js','battleAudioPresentation.js','originalSharedVfxReview.js'].map(name=>'src/championship/presentation/'+name)];
for(const file of refreshed){
 const previous=rows.get(file);rows.set(file,{...previous,path:file,sha256:sha(fs.readFileSync(path.join(root,file)))});
}
for(const descriptor of render.descriptors){
 if(!fs.readFileSync(path.join(root,descriptor.path)).equals(descriptor.bytes))throw Error('PUBLIC_RENDER_EXPORT_REQUIRED:'+descriptor.role);
 rows.set(descriptor.path,{path:descriptor.path,sha256:descriptor.sha256,jsonFields:PUBLIC_RENDER_FIELDS});
 allow.assets=allow.assets.filter(row=>row.id!==descriptor.id);allow.assets.push({id:descriptor.id,src:descriptor.path,sha256:descriptor.sha256});
}
for(const [file,hash] of render.media){
 const existing=rows.get(file);if(existing&&existing.sha256!==hash)throw Error('PUBLIC_RENDER_MEDIA_APPROVAL_CONFLICT:'+file);
 rows.set(file,{path:file,sha256:hash});
}
for(const descriptor of maps.descriptors){
 if(!fs.readFileSync(path.join(root,descriptor.path)).equals(descriptor.bytes))throw Error('PUBLIC_MAP_EXPORT_REQUIRED:'+descriptor.role);
 rows.set(descriptor.path,{path:descriptor.path,sha256:descriptor.sha256,jsonFields:PUBLIC_MAP_FIELDS});
 allow.assets=allow.assets.filter(row=>row.id!==descriptor.id);allow.assets.push({id:descriptor.id,src:descriptor.path,sha256:descriptor.sha256});
}
for(const [file,hash] of maps.files){
 const existing=rows.get(file),derived=metadata.descriptors.find(row=>row.path===file&&row.sha256===hash);
 if(existing&&existing.sha256!==hash&&!derived)throw Error('PUBLIC_MAP_MEDIA_APPROVAL_CONFLICT:'+file);
 // Geometry files retain their previously selected closed schema.
 rows.set(file,derived?{path:file,sha256:hash,jsonFields:derived.jsonFields}:existing??{path:file,sha256:hash});
}
for(const descriptor of metadata.descriptors){
 if(!fs.readFileSync(path.join(root,descriptor.path)).equals(descriptor.bytes))throw Error('PUBLIC_METADATA_EXPORT_REQUIRED:'+descriptor.role);
 rows.set(descriptor.path,{path:descriptor.path,sha256:descriptor.sha256,jsonFields:descriptor.jsonFields});
 allow.assets=allow.assets.filter(row=>row.id!==descriptor.id);allow.assets.push({id:descriptor.id,src:descriptor.path,sha256:descriptor.sha256});
}
for(const row of cleanMedia)rows.set(row.path,{path:row.path,sha256:row.sha256});
for(const row of program)rows.set(row.path,{path:row.path,sha256:row.sha256,jsonFields:row.jsonFields});
for(const row of independentBattleFiles(root)){
 if(sha(fs.readFileSync(path.join(root,row.path)))!==row.sha256)throw Error('INDEPENDENT_BATTLE_RESTORE_HASH:'+row.path);
 rows.set(row.path,row);
}
const characterFiles=publicCharacterRequiredFiles(root);
for(const file of rows.keys())if(/^assets\/production\/characters\/(?:accepted-20261010|alternate-forms-20261015|battle-packed-20261013)\//.test(file)&&!characterFiles.has(file)){
 rows.delete(file);excluded.push(file);
}
// Esbuild records every literal static/dynamic import in the normal program.
// Rendering JSON requested at runtime stays explicitly selected separately.
// Authoring/test entry modules and unused contract documents stay in Git.
const normal=compileBrowserBundle(root,{...input,files:[...rows.keys()]}).metadata;
const normalInputs=new Set(normal.inputFiles.map(row=>row.path));
for(const file of rows.keys())if((/^src\/.+\.(?:m?js|json)$/.test(file)||/^docs\/contracts\//.test(file))&&!normalInputs.has(file)){
 rows.delete(file);excluded.push(file);
}
rows.delete('assets/production/evolution-glyphs-v1/manifest.json');
allow.assets=allow.assets.map(row=>{const clean=cleanMap.get(row.src);return clean?{...row,src:clean.path,sha256:clean.sha256}:row;});
allow.files=[...rows.values()].sort((a,b)=>a.path.localeCompare(b.path,'en'));
const materializationPath='docs/contracts/championship/RUNTIME_DERIVED_MATERIALIZATION.v1.json';
if(fs.existsSync(path.join(root,materializationPath))){
 const materialization=read(materializationPath),allPinned=new Map([...materialization.files,...(materialization.inactiveFiles??[])].map(row=>[row.path,row]));
 materialization.files=[];materialization.inactiveFiles=[];
 for(const row of allPinned.values()){
  const selected=rows.get(row.path);
  if(selected&&selected.sha256!==row.sha256)throw Error('MATERIALIZATION_REVIEW_REQUIRED:'+row.path);
  (selected?materialization.files:materialization.inactiveFiles).push(row);
 }
 write(materializationPath,materialization);
}
allow.assets.sort((a,b)=>a.id.localeCompare(b.id,'en'));
const runtime=publicRuntimeIndex(allow,index,selectedOriginal);write(PUBLIC_RUNTIME_INDEX_PATH,runtime);
allow.files.find(row=>row.path===PUBLIC_RUNTIME_INDEX_PATH).sha256=sha(fs.readFileSync(path.join(root,PUBLIC_RUNTIME_INDEX_PATH)));
write(PUBLIC_RUNTIME_ALLOWLIST_PATH,allow);
input.schemaVersion=2;
input.authoring={indexPath:'assets/production/ART_PRODUCTION_INDEX.json',policyPath:'src/data/championship/public-playtest.r1.json',renderRecipePath:PUBLIC_RENDER_RECIPE};
input.authoring.metadataRecipePath=METADATA_RECIPE;
input.authoring.programRecipePath=PROGRAM_RECIPE;
input.files=allow.files.map(row=>row.path);
input.moduleEntries=normal.inputFiles.map(row=>row.path).filter(file=>/\.(?:m?js)$/.test(file));
input.publicPlaytest.files=allow.files.map(({path,sha256})=>({path,sha256}));
write(inputPath,input);
console.log(JSON.stringify({schemaVersion:2,publicInputFiles:input.files.length,publicAssets:runtime.assets.length,heroEntries:heroes.entries.length,
 excludedFromPublication:excluded,authoringIndexRetained:true,originalsDeleted:0,renderedMediaPins:render.media.size}));

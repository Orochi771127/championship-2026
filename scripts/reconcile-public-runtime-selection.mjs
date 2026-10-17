import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
import {publicRuntimeIndex,PUBLIC_RUNTIME_INDEX_PATH,PUBLIC_RUNTIME_ALLOWLIST_PATH} from './lib/public-runtime-boundary.mjs';
import {selectedShopCageProjection} from './lib/public-shop-cage-projection.mjs';
import {projectPublicRenderSources,PUBLIC_RENDER_FIELDS,PUBLIC_RENDER_RECIPE} from './lib/public-render-projection.mjs';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const write=(file,value)=>{fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),JSON.stringify(value,null,2)+'\n');};
const inputPath='docs/contracts/championship/WEB_BUILD_INPUTS.v1.json',input=read(inputPath),allow=read(PUBLIC_RUNTIME_ALLOWLIST_PATH);
const index=read('assets/production/ART_PRODUCTION_INDEX.json'),heroes=read('src/data/championship/database-hero-portraits.public.v1.json');
const render=projectPublicRenderSources({root,input,index}),shop=selectedShopCageProjection({root,input,index});
const selectedOriginal=new Map([...shop.files,...render.media]);
const activeHeroes=new Set(heroes.entries.map(row=>row.src));
const excluded=[];
const buildOnly=new Set(['assets/production/ART_PRODUCTION_INDEX.json','src/data/championship/public-playtest.r1.json',
 'src/data/championship/database-hero-portraits.r1.json','src/data/championship/qa-database-hero-portraits.r1.json',
 'src/championship/presentation/licensedCharacterRoster.js','src/championship/presentation/characterHudArt.js','src/championship/presentation/assembledUiArt.js',
 ...read(PUBLIC_RENDER_RECIPE).sources.map(row=>row.path)]);
allow.files=allow.files.filter(row=>{
 const remove=buildOnly.has(row.path)||row.path.startsWith('assets/production/database-heroes-20261017/')&&!activeHeroes.has(row.path)
  ||row.path==='assets/production/opening-film-ns33-r1/opening-720p-74e171ba.mp4';
 if(remove)excluded.push(row.path);return !remove;
});
allow.assets=allow.assets.filter(row=>!row.id.endsWith(':database-hero'));
allow.assets.push(...heroes.entries.map(row=>({id:`${row.speciesId}:database-hero`,src:row.src,sha256:row.sha256,width:row.width,height:row.height})));
const rows=new Map(allow.files.map(row=>[row.path,row]));
const refreshed=['src/data/championship/database-hero-portraits.public.v1.json','src/championship/presentation/publicRenderDescriptors.js',
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
allow.files=[...rows.values()].sort((a,b)=>a.path.localeCompare(b.path,'en'));
allow.assets.sort((a,b)=>a.id.localeCompare(b.id,'en'));
const runtime=publicRuntimeIndex(allow,index,selectedOriginal);write(PUBLIC_RUNTIME_INDEX_PATH,runtime);
allow.files.find(row=>row.path===PUBLIC_RUNTIME_INDEX_PATH).sha256=sha(fs.readFileSync(path.join(root,PUBLIC_RUNTIME_INDEX_PATH)));
write(PUBLIC_RUNTIME_ALLOWLIST_PATH,allow);
input.schemaVersion=2;
input.authoring={indexPath:'assets/production/ART_PRODUCTION_INDEX.json',policyPath:'src/data/championship/public-playtest.r1.json',renderRecipePath:PUBLIC_RENDER_RECIPE};
input.files=allow.files.map(row=>row.path);
const available=new Set(input.files);input.moduleEntries=input.moduleEntries.filter(file=>available.has(file));
input.publicPlaytest.files=allow.files.map(({path,sha256})=>({path,sha256}));
write(inputPath,input);
console.log(JSON.stringify({schemaVersion:2,publicInputFiles:input.files.length,publicAssets:runtime.assets.length,heroEntries:heroes.entries.length,
 excludedFromPublication:excluded,authoringIndexRetained:true,originalsDeleted:0,renderedMediaPins:render.media.size}));

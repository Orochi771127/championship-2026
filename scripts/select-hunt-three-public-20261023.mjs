// Owner-authorized existing hunt art batch. Run after packaging reviewed assets.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {MAPS} from '../src/championship/presentation/vs2/huntThree/manifestBindings.mjs';
import {selectedMapProjections,MAP_RECIPE,PUBLIC_MAP_FIELDS} from './lib/public-map-projection.mjs';
import {assertPublicBytes} from './lib/public-runtime-boundary.mjs';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const write=(p,d)=>fs.writeFileSync(p,JSON.stringify(d,null,2)+'\n');
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const inputPath='docs/contracts/championship/WEB_BUILD_INPUTS.v1.json',allowPath='docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json';
const input=read(inputPath),allow=read(allowPath),recipe=read(MAP_RECIPE);
const rows=new Map(allow.files.map(row=>[row.path,row]));
for(const file of rows.keys())if(file.startsWith('node_modules/three/examples/jsm/libs/draco/gltf/'))rows.delete(file);
const fields=new Set(Object.entries(MAPS).filter(([key])=>!['hm01','hm08'].includes(key)).flatMap(([,m])=>m.fields));
const fallback='assets/production/hunt/three-fallback-20261023/manifest.json';
// Read the previous pinned projections before selecting changed authoring inputs.
const oldMaps={files:new Map()};
for(const source of recipe.sources){
  const file=`assets/production/public-runtime/${source.role}.map.v1.json`;
  if(rows.get(file)?.sha256!==hash(file))throw Error('PREVIOUS_MAP_PROJECTION_DRIFT:'+file);
  const visit=value=>{if(Array.isArray(value))value.forEach(visit);else if(value&&typeof value==='object'){
    if(value.src&&value.sha256)oldMaps.files.set(value.src,value.sha256);Object.values(value).forEach(visit);
  }};visit(read(file));
}
const accepted=recipe.sources.find(row=>row.role==='hunt-accepted');
accepted.excludeFields=[...new Set([...(accepted.excludeFields??[]),...fields])].sort();
recipe.sources=recipe.sources.filter(row=>row.role!=='hunt-three-fallback');
recipe.sources.push({role:'hunt-three-fallback',path:fallback,sha256:hash(fallback)});
const selection=[
  'src/championship/app/main.js','src/championship/presentation/vs2/createHuntFieldPixiPresentation.js',
  'src/championship/presentation/publicMapRequests.js','src/championship/presentation/huntMobileReadouts.js','src/data/championship/catalogs/hunt-art-expansions-20261023.json',
  ...fs.readdirSync('src/championship/presentation/vs2/huntThree').filter(n=>n.endsWith('.mjs')).map(n=>'src/championship/presentation/vs2/huntThree/'+n),
  ...Object.values(MAPS).flatMap(m=>fs.readdirSync(m.directory).map(n=>m.directory+n)),
  ...fs.readdirSync(path.dirname(fallback)).filter(n=>n!==path.basename(fallback)).map(n=>path.dirname(fallback)+'/'+n),
  'node_modules/three/examples/jsm/libs/draco/draco_wasm_wrapper.js',
  'node_modules/three/examples/jsm/libs/draco/draco_decoder.wasm',
];
function select(file){
  const bytes=fs.readFileSync(file),row={path:file,sha256:hash(file)};
  if(file.endsWith('.json')){
    const keys=new Set();const visit=v=>{if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){keys.add(k);visit(x);}};
    visit(JSON.parse(bytes));row.jsonFields=[...keys].sort();
  }
  assertPublicBytes(file,bytes,row);rows.set(file,row);
}
selection.forEach(select);
const mediaPins=new Map(recipe.mediaPins.map(row=>[row.path,row.sha256]));
for(const field of read(fallback).fields)for(const frame of field.frames)mediaPins.set(frame.src,frame.sha256);
recipe.mediaPins=[...mediaPins].map(([path,sha256])=>({path,sha256}));write(MAP_RECIPE,recipe);
input.publicPlaytest.files=[...rows.values()].map(({path,sha256})=>({path,sha256}));
const maps=selectedMapProjections({root:process.cwd(),input});
for(const [file]of oldMaps.files)if(!maps.files.has(file)&&/^assets\/production\/hunt\//.test(file))rows.delete(file);
for(const descriptor of maps.descriptors){
  fs.writeFileSync(descriptor.path,descriptor.bytes);
  rows.set(descriptor.path,{path:descriptor.path,sha256:descriptor.sha256,jsonFields:PUBLIC_MAP_FIELDS});
  allow.assets=allow.assets.filter(row=>row.id!==descriptor.id);
  allow.assets.push({id:descriptor.id,src:descriptor.path,sha256:descriptor.sha256});
}
allow.assets=allow.assets.filter(row=>rows.has(row.src));
allow.files=[...rows.values()].sort((a,b)=>a.path.localeCompare(b.path,'en'));
input.files=allow.files.map(row=>row.path);
input.moduleEntries=[...new Set([...input.moduleEntries,...selection.filter(p=>p.startsWith('src/')&&p.endsWith('.mjs'))])].sort();
input.publicPlaytest.files=allow.files.map(({path,sha256})=>({path,sha256}));
input.publicPlaytest.selectionId='HUNT_EXISTING_3D_ART_20261023';
write(allowPath,allow);write(inputPath,input);
const policyPath='src/data/championship/public-playtest.r1.json',policy=read(policyPath);
policy.huntExisting3D20261023={status:'OWNER_AUTHORIZED_PUBLIC_PLAYTEST',maps:Object.keys(MAPS),worldDimensions:Object.fromEntries(Object.entries(MAPS).map(([key,m])=>[key,[m.worldSize,m.worldSize]])),functionalAcceptance:'OWNER_TESTS',physicalDeviceAccepted:false,commercialReleaseAccepted:false};
write(policyPath,policy);
console.log(JSON.stringify({maps:Object.keys(MAPS),selectedFiles:selection.length,replacedFallbackFields:fields.size}));

// Exact public-playtest selection for the Owner-authorized fixed-camera ranch.
// Models are selected and hash checked here; Draco/WebP variants fit within
// the existing Pages payload and stay on the same origin as the game.
import fs from 'node:fs';
import crypto from 'node:crypto';

const read=path=>JSON.parse(fs.readFileSync(path,'utf8'));
const write=(path,value)=>fs.writeFileSync(path,JSON.stringify(value,null,2)+'\n');
const hash=path=>crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex');
const inputPath='docs/contracts/championship/WEB_BUILD_INPUTS.v1.json';
const allowPath='docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json';
const policyPath='src/data/championship/public-playtest.r1.json';
const input=read(inputPath),allow=read(allowPath),policy=read(policyPath);
const manifestPath='assets/production/cage/three-20261021/manifest.json';
const manifest=read(manifestPath);
if(manifest.fields.length!==37||manifest.fields.some(row=>Object.keys(row).sort().join(',')!=='bytes,fieldId,sha256,url'
  ||!/^[a-f0-9]{64}$/.test(row.sha256)||row.bytes!==fs.statSync(row.url).size||row.sha256!==hash(row.url)))
  throw Error('RANCH_3D_MODEL_SELECTION_NOT_CLOSED');
const selected=[
  'championship.html',
  'src/championship/app/championshipStandaloneApp.js',
  'src/championship/app/main.js',
  'src/championship/cage/ranchConnections.js',
  'src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js',
  'src/championship/presentation/ranchPassages.js',
  'src/championship/presentation/ranchThreeCoordinates.js',
  'src/championship/presentation/ranchThreeScene.js',
  'src/championship/raising/nativeRaisingRanchRing.js',
  'src/championship/raising/ranchConveyor.js',
  'src/data/championship/catalogs/ranch-conveyor.r1.json',
  'src/data/championship/catalogs/ranch-three-ground.r1.json',
  'node_modules/three/examples/jsm/loaders/DRACOLoader.js',
  'node_modules/three/examples/jsm/libs/draco/draco_wasm_wrapper.js',
  'node_modules/three/examples/jsm/libs/draco/draco_decoder.wasm',
  manifestPath,
  'assets/production/cage/three-20261021/walk-surfaces.json',
  ...manifest.fields.map(row=>row.url),
];
const rows=new Map(allow.files.map(row=>[row.path,row]));
for(const path of selected){
  if(!fs.statSync(path).isFile())throw Error('RANCH_3D_SELECTED_NON_FILE:'+path);
  const row={...(rows.get(path)??{}),path,sha256:hash(path)};
  if(path.endsWith('.json')){
    const keys=new Set();
    const visit=value=>{if(Array.isArray(value))value.forEach(visit);
      else if(value&&typeof value==='object')for(const [key,child] of Object.entries(value)){keys.add(key);visit(child);}};
    visit(read(path));row.jsonFields=[...keys].sort();
    if(row.jsonFields.some(key=>/^source/i.test(key)||/^[A-Za-z]:/.test(key)))throw Error('RANCH_3D_PRIVATE_JSON_FIELD:'+path);
  }
  rows.set(path,row);
}
allow.files=[...rows.values()].sort((a,b)=>a.path.localeCompare(b.path,'en'));
input.files=allow.files.map(row=>row.path);
for(const path of ['src/championship/presentation/ranchThreeCoordinates.js',
  'src/championship/presentation/ranchThreeScene.js','src/championship/raising/ranchConveyor.js',
  'node_modules/three/examples/jsm/loaders/DRACOLoader.js'])
  if(!input.moduleEntries.includes(path))input.moduleEntries.push(path);
input.moduleEntries.sort((a,b)=>a.localeCompare(b,'en'));
input.publicPlaytest.files=allow.files.map(({path,sha256})=>({path,sha256}));
input.publicPlaytest.selectionId='RANCH_TRUE_3D_PUBLIC_20261021';
input.publicPlaytest.ownerInstruction='請自我審查沒問題後commit 跟push；還有部署';
policy.ranchTrue3D20261021={
  selectionId:'RANCH_TRUE_3D_PUBLIC_20261021',status:'OWNER_AUTHORIZED_PUBLIC_PLAYTEST',
  authorizationRecordedOn:'2026-10-21',
  scope:'Fixed-camera true 3D ranch with existing 2D actors, invisible navigation passages and rideable factory conveyor; exact 37 first-party Draco/WebP GLB hashes selected and served on the existing Pages origin.',
  modelSource:'assets/production/cage/three-20261021/',
  physicalDeviceAccepted:false,commercialArtAccepted:false,commercialReleaseAccepted:false,
};
write(allowPath,allow);write(inputPath,input);write(policyPath,policy);
console.log(JSON.stringify({selected: selected.length,modelCount:manifest.fields.length,approvalFiles:allow.files.length}));

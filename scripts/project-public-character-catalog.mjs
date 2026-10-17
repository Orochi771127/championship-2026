import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mergeAlternateFormConfigs,bindAlternateFormManifest} from '../src/championship/presentation/alternateFormAssetContracts.js';
import {getCharacterStaticNativeSizing} from '../src/championship/presentation/licensedCharacterRoster.js';
import {BATTLE_CHARACTER_GEOMETRY} from '../src/data/championship/battleCharacterGeometry.js';
import {canonicalRenderValue} from '../src/championship/presentation/publicCharacterRenderContract.js';
import {publicCharacterRenderProjection} from './lib/public-ranch-render-projection.mjs';
import {assertPublicBytes} from './lib/public-runtime-boundary.mjs';

const root=process.cwd(),read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const digest=value=>sha(JSON.stringify(canonicalRenderValue(value)));
const fields=value=>{const result=new Set();function visit(v){if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){result.add(k);visit(x);}}visit(value);return [...result].sort();};
const write=(file,value)=>{const bytes=Buffer.from(JSON.stringify(value)+'\n');assertPublicBytes(file,bytes,{jsonFields:fields(value)});fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});fs.writeFileSync(path.join(root,file),bytes);return sha(bytes);};
const selected=read('src/data/championship/accepted-original-character-selection.r1.json');
const configs=mergeAlternateFormConfigs(selected.characters);
const manifest=bindAlternateFormManifest(read('assets/production/internal-faithful-baseline/characters-v1/manifest.json'));
const streamed=read('src/data/championship/ranch-render-selection.v1.json').characters;
const packed=read('assets/production/characters/battle-packed-20261013/manifest.json');
const approved=new Map(read('docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json').files.map(r=>[r.path,r.sha256]));
const checkedRead=file=>{
 const bytes=fs.readFileSync(path.join(root,file)),selectedHash=approved.get(file);
 if(selectedHash){if(sha(bytes)!==selectedHash)throw Error('PUBLIC_CHARACTER_SOURCE_HASH: '+file);}
 else{
  // Source-only role descriptors may be removed from the artifact. They must
  // still match their existing Git source exactly; this does not grant them
  // public eligibility or copy their review/provenance fields.
  if(!file.startsWith('assets/production/characters/'))throw Error('PUBLIC_CHARACTER_SOURCE_PATH');
  const record=execFileSync('git',['ls-files','-s','--',file],{encoding:'utf8',windowsHide:true}).trim();
  const expected=/^100644 ([a-f0-9]{40}) 0\t/.exec(record)?.[1];
  const actual=createHash('sha1').update(Buffer.concat([Buffer.from('blob '+bytes.length+'\0'),bytes])).digest('hex');
  if(!expected||actual!==expected)throw Error('PUBLIC_CHARACTER_GIT_SOURCE_HASH: '+file);
 }
 return JSON.parse(bytes);
};
const cellFields=['cell','sequenceId','speciesId','entityId','src','width','height','origin','sha256','nativeScale','rasterScale','rasterWidth','rasterHeight'];
const cell=source=>Object.fromEntries(cellFields.filter(key=>source[key]!==undefined).map(key=>[key,source[key]]));
const motion=runtime=>Object.fromEntries(['main','sub'].map(side=>[side,runtime.sides[side].animations]));
const characters=[];
for(const config of configs){
 let runtimePath,runtimeSha256,runtime;
 const stream=streamed.find(c=>c.entityId===config.entityId&&c.runtimePath.startsWith((config.assetRoot??selected.root)+config.folder+'/'));
 if(stream){runtimePath=stream.runtimePath;runtimeSha256=stream.runtimeSha256;runtime=checkedRead(runtimePath);}
 else{
  const sourcePath=(config.assetRoot??selected.root)+config.folder+'/runtime.review.json',source=checkedRead(sourcePath);
  if(config.runtimeSha256&&config.runtimeSha256!==approved.get(sourcePath)||source.sourceBankSha256!==config.sourceBankSha256||source.entityId!==config.entityId)throw Error('PUBLIC_CHARACTER_ALTERNATE_SOURCE');
  runtime=publicCharacterRenderProjection(source);runtimePath=sourcePath.replace('runtime.review.json','runtime.render.json');runtimeSha256=write(runtimePath,runtime);
 }
 if(runtime.artProfile.scale!==config.density||JSON.stringify(runtime.artProfile.logicalCanvas)!==JSON.stringify(config.logicalCanvas))throw Error('PUBLIC_CHARACTER_PROFILE');
 for(const side of ['main','sub'])for(const animation of runtime.sides[side].animations)for(const frame of animation.frames){
  const g=runtime.geometry.frames[frame.texture];if(g.scale!==config.density||JSON.stringify(g.origin)!==JSON.stringify(config.frameOrigins[frame.texture])||JSON.stringify(g.sourceSize)!==JSON.stringify(config.rasterCanvas))throw Error('PUBLIC_CHARACTER_GEOMETRY');
 }
 const record=manifest.records.find(r=>r.entityId===config.entityId),sizing=getCharacterStaticNativeSizing(record,runtime);
 const nativeSizing=sizing?{...sizing,packedPixelsPerNativePixel:config.density,evidence:'COMPLETED_ORIGINAL_DENSITY4_LOCAL_PLAY'}:null;
 const geometry=BATTLE_CHARACTER_GEOMETRY[config.entityId];
 const battleGeometry=Boolean(geometry?.files.every(([name,hash])=>record.files.find(f=>f.path===name)?.sha256.toLowerCase()===hash));
 const hudSourcePath=(config.assetRoot??selected.root)+config.folder+'/hud-r01/manifest.json',sourceHud=checkedRead(hudSourcePath);
 if(sourceHud.entityId!==config.entityId||sourceHud.sourceBankSha256!==config.sourceBankSha256)throw Error('PUBLIC_CHARACTER_HUD_SOURCE');
 const usedSubCells=new Set(sourceHud.battle.sequences.flatMap(sequence=>sequence.frames.map(frame=>frame.cell)));
 const hud={schemaVersion:1,entityId:config.entityId,portrait:cell(sourceHud.portrait),battle:{cells:sourceHud.battle.cells.filter(sourceCell=>usedSubCells.has(sourceCell.cell)).map(cell),sequences:sourceHud.battle.sequences.map(s=>({id:s.id,playbackMode:s.playbackMode,...(s.loopStartFrame===undefined?{}:{loopStartFrame:s.loopStartFrame}),frames:s.frames.map(f=>({cell:f.cell,ticks:f.ticks}))}))}};
 const hudPath=hudSourcePath.replace('manifest.json','hud.render.json'),hudSha256=write(hudPath,hud);
 const row={entityId:config.entityId,speciesId:config.speciesId,runtimePath,runtimeSha256,hudPath,hudSha256,
  motionSha256:digest(motion(runtime)),geometrySha256:digest(runtime.geometry),density:config.density,logicalCanvas:config.logicalCanvas,origin:config.origin,nativeSizing,battleGeometry};
 const pack=!config.assetRoot&&packed.characters.find(c=>c.entity===config.entityId);
 if(pack){
  const sourcePath=packed.root+config.entityId+'/runtime.review.json',source=checkedRead(sourcePath),projection=publicCharacterRenderProjection(source);
  if(digest(motion(projection))!==row.motionSha256||digest(projection.geometry)!==row.geometrySha256)throw Error('PUBLIC_PACKED_NATIVE_CONTRACT');
  row.battleRuntimePath=sourcePath.replace('runtime.review.json','runtime.render.json');row.battleRuntimeSha256=write(row.battleRuntimePath,projection);
 }
 characters.push(row);
}
const known=new Set(characters.map(c=>c.entityId));
write('src/data/championship/public-character-catalog.v1.json',{schemaVersion:1,assetId:'art:public:characters:v1',characters,
 speciesBindings:manifest.speciesBindings.filter(b=>known.has(b.entityId)).map(b=>({speciesId:b.speciesId,entityId:b.entityId}))});
console.log(JSON.stringify({characters:characters.length,streamed:characters.filter(c=>c.runtimePath.includes('/ranch-streaming-v1/')).length,compactBattle:characters.filter(c=>c.battleRuntimePath).length,privateRegistrationFlagsCopied:false}));

import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {validateAlternateFormAsset} from '../../src/championship/presentation/alternateFormAssetContracts.js';
export const PROGRAM_RECIPE='docs/contracts/championship/PUBLIC_PROGRAM_SOURCES.v1.json';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const pick=(row,fields)=>Object.fromEntries(fields.filter(key=>row[key]!==undefined).map(key=>[key,row[key]]));
export function publicProgramData({root,write=false}){
 const recipe=JSON.parse(fs.readFileSync(path.join(root,PROGRAM_RECIPE),'utf8')),descriptors=[];
 if(recipe.schemaVersion!==1)throw Error('PUBLIC_PROGRAM_RECIPE');
 for(const row of recipe.sources){
  const bytes=fs.readFileSync(path.join(root,row.path));if(sha(bytes)!==row.sha256)throw Error('PUBLIC_PROGRAM_SOURCE_CHANGED_REVIEW_REQUIRED:'+row.path);
  if(row.kind==='VENDOR_DOCUMENTATION'){
   // Only remove upstream documentation example lines; executable bytes and
   // license comments stay untouched. The original distribution is retained.
   const out=Buffer.from(bytes.toString('utf8').split('\n').map(line=>/^\s*\*/.test(line)&&/C:(?:\/|\\)+Users(?:\/|\\)+User/.test(line)?'   *':line).join('\n'));
   const target=path.join(root,row.output);if(write){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,out);}
   else if(!fs.readFileSync(target).equals(out))throw Error('PUBLIC_PROGRAM_EXPORT_REQUIRED:'+row.output);
   descriptors.push({path:row.output,sha256:sha(out),bytes:out});continue;
  }
  const source=JSON.parse(bytes);let value;
  if(row.kind==='NATIVE_GAMEPLAY'||row.kind==='PRESENTATION_CONTRACT'){descriptors.push({...row,bytes});continue;}
  if(row.kind==='GLYPHS')value={selectedSize:source.selectedSize,assets:source.assets.map(asset=>pick(asset,['id','src','width','height','anchor','sha256']))};
  else if(row.kind==='CARE_CELLS')value={schemaVersion:1,cells:source.cells.map(cell=>pick(cell,['src','sha256','role','pose','nativeWidth','nativeHeight','nativeAnchorX','nativeAnchorY']))};
  else if(row.kind==='ALTERNATE_BINDINGS')value={schemaVersion:1,characters:source.characters.map(validateAlternateFormAsset).filter(c=>c.runtimeReady===true).map(c=>pick(c,['speciesId','speciesIndex','entityId','motionDonorEntityId']))};
  else throw Error('PUBLIC_PROGRAM_KIND');
  const out=Buffer.from(JSON.stringify(value)+'\n'),target=path.join(root,row.output);
  if(write){fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,out);}
  else if(!fs.readFileSync(target).equals(out))throw Error('PUBLIC_PROGRAM_EXPORT_REQUIRED:'+row.output);
  descriptors.push({path:row.output,sha256:sha(out),jsonFields:row.jsonFields,bytes:out});
 }
 return descriptors;
}

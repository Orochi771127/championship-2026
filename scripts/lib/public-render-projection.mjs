import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {validateBattleEffectArt} from '../../tools/authoring/legacy-render/battleEffectArt.mjs';
import {validateRaisingFeedbackArt} from '../../tools/authoring/legacy-render/raisingFeedbackArt.mjs';
import {validateHuntFeedbackArt,originalHuntMeatCells} from '../../tools/authoring/legacy-render/huntFeedbackArt.mjs';
import {validateBattleAudio} from '../../tools/authoring/legacy-render/battleAudioPresentation.mjs';
import {validateOriginalSharedVfx} from '../../tools/authoring/legacy-render/originalSharedVfxReview.mjs';
import {PUBLIC_RENDER_KINDS,publicRenderId,validatePublicRenderDescriptor} from '../../src/championship/presentation/publicRenderDescriptors.js';

export const PUBLIC_RENDER_RECIPE='docs/contracts/championship/PUBLIC_RENDER_SOURCES.v1.json';
export const PUBLIC_RENDER_FIELDS=['schemaVersion','kind','assetId','image','cells','banks','sounds','timing','blend','pixelsPerNativePixel','localizedText','schema','bankId','sequences','selection','source','sets','zh-Hant','ja','en','family','itemIndex','id','playbackMode','loopStartFrame','frames','cell','ticks','durationTicks','totalTicks','src','sha256','width','height','scaleMode','origin','frame','blank','rgbaSha256','rasterWidth','rasterHeight','displayScale','art','soundId','channels','sampleRate','sampleFrames','loop'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const take=(value,fields)=>Object.fromEntries(fields.filter(field=>Object.hasOwn(value,field)).map(field=>[field,value[field]]));
const image=value=>take(value,['src','sha256','width','height','scaleMode']);
const cell=value=>take(value,['bankId','cell','src','sha256','width','height','origin','frame','pixelsPerNativePixel','blank','rgbaSha256','rasterWidth','rasterHeight','displayScale','art']);
const sequence=value=>({...take(value,['id','playbackMode','loopStartFrame','durationTicks','totalTicks']),frames:value.frames.map(frame=>take(frame,['cell','ticks']))});
const validators={'battle-effects':validateBattleEffectArt,'raising-feedback':validateRaisingFeedbackArt,'hunt-feedback':validateHuntFeedbackArt,'battle-audio':validateBattleAudio};

// Projection is field-by-field, never a renamed/cloned authority entry. Source
// review/provenance/ROM hashes and production flags cannot enter the output.
export function projectPublicRenderSources({root,input,index}){
 const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
 const recipe=read(PUBLIC_RENDER_RECIPE),policy=read('src/data/championship/public-playtest.r1.json');
 if(recipe.schemaVersion!==1||recipe.policyId!==policy.id||policy.status!=='OWNER_AUTHORIZED_PUBLIC_PLAYTEST'
  ||policy.origin!=='https://orochi771127.github.io'||policy.basePath!=='/championship-2026/')throw Error('PUBLIC_RENDER_SOURCE_POLICY');
 const approved=new Map(input.publicPlaytest.files.map(row=>[row.path,row.sha256]));
 const sources=new Map();
 for(const item of recipe.sources){
  const bytes=fs.readFileSync(path.join(root,item.path));
  if(sha(bytes)!==item.sha256)throw Error('PUBLIC_RENDER_SOURCE_CHANGED_REVIEW_REQUIRED:'+item.role);
  sources.set(item.role,JSON.parse(bytes));
 }
 const descriptors=[],media=new Map();
 const mediaImage=value=>{
  if(approved.get(value.src)!==value.sha256||!/^[a-f0-9]{64}$/.test(value.sha256))throw Error('PUBLIC_RENDER_MEDIA_NOT_HASH_SELECTED:'+value.src);
  media.set(value.src,value.sha256);
 };
 for(const role of Object.keys(PUBLIC_RENDER_KINDS)){
  const source=sources.get(role);if(!source)throw Error('PUBLIC_RENDER_SOURCE_REQUIRED:'+role);
  if(role==='shared-vfx'){
   const approval=policy.acceptedOriginalSharedVfx;
   const selected=recipe.sources.find(row=>row.role===role);
   if(approval?.status!=='OWNER_AUTHORIZED_PUBLIC_PLAYTEST'||approval.selectionId!=='ACCEPTED_ORIGINAL_SHARED_VFX_20261012'
    ||approval.manifestPath!==selected.path)throw Error('PUBLIC_RENDER_SHARED_SELECTION');
   validateOriginalSharedVfx(source,index,{manifestPath:selected.path});
  }else validators[role](source,index);
  const value={schemaVersion:1,kind:PUBLIC_RENDER_KINDS[role],assetId:publicRenderId(role)};
  if(role==='battle-effects'){
   value.image=image(source.image);value.cells=source.cells.map(cell);mediaImage(value.image);
  }else if(role==='raising-feedback'){
   value.cells=source.cells.filter(row=>row.cell<=36||row.cell>=144&&row.cell<=154).map(cell);
   value.cells.forEach(mediaImage);
  }else if(role==='hunt-feedback'){
   value.banks=source.banks.map(bank=>{
    const originals=bank.kind==='MEAT'&&bank.itemIndex===0?originalHuntMeatCells(sources.get('care-meat'),bank):[];
    const selected=originals.length?[...originals,...bank.cells.filter(row=>row.cell>3)]:bank.cells;
    const result={kind:bank.kind,itemIndex:bank.itemIndex,cells:selected.map(cell),sequences:bank.sequences.map(sequence)};
    result.cells.forEach(mediaImage);return result;
   });
  }else if(role==='battle-audio'){
   value.sounds=source.sounds.map(sound=>take(sound,['soundId','src','sha256','channels','sampleRate','sampleFrames','loop']));
   value.sounds.forEach(mediaImage);
  }else{
   Object.assign(value,take(source,['timing','blend','pixelsPerNativePixel']));
   value.image=image(source.image);value.cells=source.cells.map(cell);
   value.banks=source.banks.map(bank=>take(bank,['bankId','family','sequences','cells']));
   const text=source.localizedText;
   value.localizedText={...take(text,['schema','bankId','sequences','cells','timing']),selection:{source:'GAME_SETTING_LOCALE'},
    sets:Object.fromEntries(['zh-Hant','ja','en'].map(name=>[name,{image:image(text.sets[name].image),cells:text.sets[name].cells.map(cell)}]))};
   mediaImage(value.image);Object.values(value.localizedText.sets).forEach(set=>mediaImage(set.image));
  }
  validatePublicRenderDescriptor(value,role);
  const file=`assets/production/public-runtime/${role}.render.v1.json`,bytes=Buffer.from(JSON.stringify(value,null,2)+'\n');
  descriptors.push({role,id:publicRenderId(role),path:file,sha256:sha(bytes),bytes,value});
 }
 return {descriptors,media};
}

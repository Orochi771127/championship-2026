import {publicRuntimeAsset} from './publicRuntimeAssets.js';

export const PUBLIC_RENDER_KINDS=Object.freeze({
 'battle-effects':'BATTLE_EFFECT_RENDER_V1',
 'raising-feedback':'RAISING_FEEDBACK_RENDER_V1',
 'hunt-feedback':'HUNT_FEEDBACK_RENDER_V1',
 'battle-audio':'BATTLE_AUDIO_RENDER_V1',
 'shared-vfx':'SHARED_VFX_RENDER_V1'
});
export const publicRenderId=role=>`art:public:${role}:v1`;
const exact=(value,fields)=>value&&typeof value==='object'&&!Array.isArray(value)
 &&Object.keys(value).every(key=>fields.includes(key));
const cellFields=['bankId','cell','src','sha256','width','height','origin','frame','pixelsPerNativePixel','blank','rgbaSha256','rasterWidth','rasterHeight','displayScale','art'];
const imageFields=['src','sha256','width','height','scaleMode'];
const safePath=value=>typeof value==='string'&&/^assets\/production\/[A-Za-z0-9_./-]+$/.test(value)
 &&!value.split('/').some(part=>part==='..'||part==='.')&&!/ART_PRODUCTION_INDEX|RIGHTS_EVIDENCE_REGISTRY/.test(value);
const hash=value=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const positive=value=>Number.isInteger(value)&&value>0;
const pair=value=>Array.isArray(value)&&value.length===2&&value.every(Number.isInteger);
const fail=reason=>{throw Error('PUBLIC_RENDER_DESCRIPTOR_'+reason);};

function image(value){
 if(!exact(value,imageFields)||!safePath(value.src)||!hash(value.sha256)
  ||!positive(value.width)||!positive(value.height)||value.scaleMode!=='nearest')fail('IMAGE');
}
function cell(value,atlas){
 if(!exact(value,cellFields)||!Number.isInteger(value.cell)||value.cell<0||!pair(value.origin))fail('CELL');
 if(value.src!==undefined&&(!safePath(value.src)||!hash(value.sha256)||!positive(value.width)||!positive(value.height)))fail('CELL_IMAGE');
 if(value.frame!==undefined){
  const [x,y,w,h]=value.frame;
  if(!Array.isArray(value.frame)||value.frame.length!==4||![x,y,w,h].every(Number.isInteger)
   ||x<0||y<0||!positive(w)||!positive(h)||x+w>atlas.width||y+h>atlas.height||typeof value.blank!=='boolean')fail('FRAME');
 }
}
function sequence(value){
 if(!exact(value,['id','playbackMode','loopStartFrame','frames','durationTicks','totalTicks'])
  ||!Number.isInteger(value.id)||![1,2,3,4].includes(value.playbackMode)||!Array.isArray(value.frames)||!value.frames.length)fail('SEQUENCE');
 for(const frame of value.frames)if(!exact(frame,['cell','ticks'])||!Number.isInteger(frame.cell)||!positive(frame.ticks))fail('SEQUENCE_FRAME');
}

// This validates rendering values, not production/review/rights flags. The
// exact descriptor bytes are separately bound to the public selection hash.
export function validatePublicRenderDescriptor(value,role){
 const kind=PUBLIC_RENDER_KINDS[role];
 const roots={
  'battle-effects':['schemaVersion','kind','assetId','image','cells'],
  'raising-feedback':['schemaVersion','kind','assetId','cells'],
  'hunt-feedback':['schemaVersion','kind','assetId','banks'],
  'battle-audio':['schemaVersion','kind','assetId','sounds'],
  'shared-vfx':['schemaVersion','kind','assetId','timing','blend','pixelsPerNativePixel','image','cells','banks','localizedText']
 };
 if(!kind||!exact(value,roots[role])||value.schemaVersion!==1||value.kind!==kind||value.assetId!==publicRenderId(role))fail('SCHEMA');
 if(value.image)image(value.image);
 if(value.cells){
  const seen=new Set();
  for(const row of value.cells){cell(row,value.image);const key=`${row.bankId??0}:${row.cell}`;if(seen.has(key))fail('DUPLICATE_CELL');seen.add(key);}
 }
 if(value.banks)for(const bank of value.banks){
  if(role==='shared-vfx'){
   if(!exact(bank,['bankId','family','sequences','cells'])||!Number.isInteger(bank.bankId)
    ||!Array.isArray(bank.cells)||!Array.isArray(bank.sequences))fail('BANK');
  }else{
   if(!exact(bank,['kind','itemIndex','cells','sequences'])||typeof bank.kind!=='string'||!Number.isInteger(bank.itemIndex)
    ||!Array.isArray(bank.cells)||!Array.isArray(bank.sequences))fail('BANK');
   for(const row of bank.cells)cell(row);
   const ids=new Set(bank.cells.map(row=>row.cell));
   for(const row of bank.sequences){sequence(row);if(row.frames.some(frame=>!ids.has(frame.cell)))fail('UNBOUND_SEQUENCE');}
  }
 }
 if(value.sounds){
  if(value.sounds.length!==54)fail('SOUND_COUNT');
  const seen=new Set();for(const sound of value.sounds){
   if(!exact(sound,['soundId','src','sha256','channels','sampleRate','sampleFrames','loop'])
    ||!Number.isInteger(sound.soundId)||seen.has(sound.soundId)||!safePath(sound.src)||!hash(sound.sha256)
    ||sound.channels!==1||!positive(sound.sampleFrames)||!Number.isInteger(sound.sampleRate)
    ||sound.sampleRate<8000||sound.sampleRate>48000||sound.loop!==false)fail('SOUND');seen.add(sound.soundId);
  }
 }
 if(value.localizedText){
  const text=value.localizedText;if(!exact(text,['schema','bankId','sequences','cells','selection','timing','sets'])||!Array.isArray(text.cells)
   ||!exact(text.selection,['source'])||text.selection.source!=='GAME_SETTING_LOCALE'
   ||!exact(text.sets,['zh-Hant','ja','en'])||Object.keys(text.sets).length!==3)fail('TEXT');
  for(const name of ['zh-Hant','ja','en']){
   const set=text.sets[name];if(!exact(set,['image','cells']))fail('TEXT_SET');image(set.image);
   for(const row of set.cells)cell(row,set.image);
  }
 }
 return value;
}

export async function loadPublicRenderDescriptor(role,{baseUrl,fetchImpl=globalThis.fetch,signal}={}){
 const selected=publicRuntimeAsset(publicRenderId(role));
 if(!selected)throw Error('PUBLIC_RENDER_SELECTION_MISSING:'+role);
 const response=await fetchImpl(new URL(selected.src,baseUrl),{signal});
 if(!response.ok)throw Error('PUBLIC_RENDER_HTTP_'+response.status+':'+role);
 const text=await response.text();
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text));
 const actual=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
 if(actual!==selected.sha256)throw Error('PUBLIC_RENDER_HASH:'+role);
 return validatePublicRenderDescriptor(JSON.parse(text),role);
}

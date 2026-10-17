import fs from 'node:fs';import path from 'node:path';import {createHash} from 'node:crypto';
import {BATTLE_PAGE_ENTITIES,readBattlePagePolicy,applyBattlePagePolicy} from './public-battle-page-policy.mjs';
export const PUBLIC_CHARACTER_CATALOG='src/data/championship/public-character-catalog.v1.json';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function publicCharacterRequiredFiles(root){
 const catalog=JSON.parse(fs.readFileSync(path.join(root,PUBLIC_CHARACTER_CATALOG),'utf8')),files=new Set();
 const add=file=>{if(!file.startsWith('assets/production/characters/')||file.includes('..')||file.includes('\\'))throw Error('PUBLIC_CHARACTER_REQUIRED_PATH');files.add(file);};
 for(const character of catalog.characters){
  for(const file of [character.runtimePath,...(character.battleRuntimePath?[character.battleRuntimePath]:[])]){
   add(file);const runtime=JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
   for(const atlas of runtime.sides.main.atlases)for(const key of ['data','image'])add(path.posix.normalize(path.posix.join(path.posix.dirname(file),atlas[key])));
  }
  add(character.hudPath);const hud=JSON.parse(fs.readFileSync(path.join(root,character.hudPath),'utf8'));
  for(const cell of [hud.portrait,...hud.battle.cells])add(cell.src);
 }
 return files;
}
export function assertPublicCharacterSelection({root,files,allowlist,assertBytes}){
 if(!files.includes(PUBLIC_CHARACTER_CATALOG))return {required:false};
 const selected=new Map(allowlist.files.map(row=>[row.path,row])),available=new Set(files);
 const catalog=JSON.parse(fs.readFileSync(path.join(root,PUBLIC_CHARACTER_CATALOG),'utf8'));
 if(catalog.schemaVersion!==1||catalog.assetId!=='art:public:characters:v1'||!Array.isArray(catalog.characters))throw Error('PUBLIC_CHARACTER_SELECTION_SCHEMA');
 if(catalog.characters.some(row=>BATTLE_PAGE_ENTITIES.includes(row.entityId))
  &&JSON.stringify(applyBattlePagePolicy(root,catalog,readBattlePagePolicy(root)))!==JSON.stringify(catalog))throw Error('PUBLIC_BATTLE_PAGE_SELECTION_REQUIRED');
 const requireFile=(file,hash)=>{const row=selected.get(file);if(!available.has(file)||row?.sha256!==hash||!file.startsWith('assets/production/characters/')||file.includes('..')||file.includes('\\'))throw Error('PUBLIC_CHARACTER_DYNAMIC_FILE: '+file);return row;};
 const descriptor=(file,hash)=>{const row=requireFile(file,hash),bytes=fs.readFileSync(path.join(root,file));if(sha(bytes)!==hash)throw Error('PUBLIC_CHARACTER_DYNAMIC_HASH: '+file);assertBytes(file,bytes,{jsonFields:row.jsonFields});return JSON.parse(bytes);};
 const ids=new Set();let hudCells=0;
 for(const character of catalog.characters){
  if(ids.has(character.entityId))throw Error('PUBLIC_CHARACTER_DUPLICATE');ids.add(character.entityId);
  for(const [file,hash]of [[character.runtimePath,character.runtimeSha256],...(character.battleRuntimePath?[[character.battleRuntimePath,character.battleRuntimeSha256]]:[])]){
   const runtime=descriptor(file,hash);
   if(runtime.kind!=='CHARACTER_RENDER_V1'||runtime.entityId!==character.entityId||runtime.sides?.sub?.atlases?.length!==0)throw Error('PUBLIC_CHARACTER_RENDER_IDENTITY');
   for(const atlas of runtime.sides.main.atlases)for(const field of ['data','image']){
    if(typeof atlas[field]!=='string'||atlas[field].startsWith('/')||atlas[field].includes('\\')||atlas[field].includes('://'))throw Error('PUBLIC_CHARACTER_ATLAS_PATH');
    const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),atlas[field]));
    if(!available.has(target)||!selected.has(target)||!target.startsWith('assets/production/characters/'))throw Error('PUBLIC_CHARACTER_ATLAS_NOT_SELECTED: '+target);
   }
  }
  const hud=descriptor(character.hudPath,character.hudSha256);
  if(hud.entityId!==character.entityId)throw Error('PUBLIC_CHARACTER_HUD_IDENTITY');
  const needed=new Set(hud.battle.sequences.flatMap(sequence=>sequence.frames.map(frame=>frame.cell)));
  for(const cell of [hud.portrait,...hud.battle.cells]){requireFile(cell.src,cell.sha256);hudCells++;}
  if(hud.battle.cells.some(cell=>!needed.has(cell.cell))||[...needed].some(id=>!hud.battle.cells.some(cell=>cell.cell===id)))throw Error('PUBLIC_CHARACTER_HUD_ROLE_CLOSURE');
 }
 for(const binding of catalog.speciesBindings)if(!ids.has(binding.entityId)||!/^species-\d{3}$/.test(binding.speciesId))throw Error('PUBLIC_CHARACTER_BINDING');
 return {required:true,characters:ids.size,hudCells};
}

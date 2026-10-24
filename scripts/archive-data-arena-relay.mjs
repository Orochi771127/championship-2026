// Development-only provenance export. Never imported by the web runtime.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {RELAY_ROSTER} from '../src/championship/modes/dataArena/dataArenaRelayRoster.js';
import {RELAY_ACTION_PROFILES,RELAY_LOADOUTS,relayKit,relayMove,relaySequence,relayEffectStyle} from '../src/championship/modes/dataArena/dataArenaRelay.js';
import {DATA_ARENA_TEXT} from '../src/championship/text/dataArenaText.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const destination=process.argv[2];
if(!destination||!path.isAbsolute(destination))throw new Error('Supply an absolute private archive directory');
const write=(relative,data)=>{const target=path.join(destination,relative);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,JSON.stringify(data,null,2)+'\n');};
const candidate={weapon:'gallade',cannon:'blastoise',fist:'machop',wing:'charizard',quadruped:'shinx',jaw:'charmander',tail:'raichu',core:'magnemite',body:'snorlax'};
const behaviour={BOLT:'moving projectile',SPREAD:'multiple directed projectiles',LANCE:'piercing projectile adaptation',WAVE:'broad moving area',LUNGE:'contact / body advance',NOVA:'radial pulse',ZONE:'delayed area adaptation',BARRIER:'temporary protection',BLINK:'product mobility adaptation'};
const privateRows=JSON.parse(fs.readFileSync(path.join(destination,'characters/roster-action-mapping.private.json'),'utf8'));
const moves=new Map();
for(const p of RELAY_ROSTER){
 const privateRow=privateRows.find(r=>r.speciesIndex===p.speciesIndex),kit=relayKit(p.id),profile=RELAY_ACTION_PROFILES[p.id];
 privateRow.sourceReferenceCandidate=candidate[p.body];
 privateRow.sourceReferenceStatus=['charmander','charizard','shinx'].includes(candidate[p.body])?'REFERENCE_CLIPS_PLAYED_CHARACTER_MATCH_PROVISIONAL':'CANDIDATE_ONLY_NOT_YET_PLAYED';
 const ids=[profile.basic,...RELAY_LOADOUTS[p.id],kit.ultimate];
 const mapping=ids.map(id=>{
  const ultimate=id===kit.ultimate,rule=relayMove(id,ultimate);
  const row={moveId:id,name:DATA_ARENA_TEXT['zh-Hant']['move.'+id],kind:rule.type,sourceBehaviour:behaviour[rule.type],
   sequenceId:relaySequence(p.id,id),releaseSlot:profile.releaseSlot,slotPolicy:'KEEP_ALL_TICKS_ANCHORS_OFFSETS_AND_HIT_FRAME',
   tp:rule.energy??0,cooldown:rule.cooldown,windup:rule.windup,recovery:rule.recovery,effect:relayEffectStyle(id),
   completion:'PLAYABLE_ORIGINAL_PROCEDURAL_EFFECT_AND_SYNTH_SOUND_ART_PROVISIONAL'};
  moves.set(id,{...row,rule});return row;
 });
 write(`characters/${p.speciesId}/mapping.json`,{...p,privateResearch:privateRow,action:profile,moves:mapping,
  runtimeArt:'EXISTING_APPROVED_PUBLIC_CATALOG_NOT_SOURCE_CHARACTERS',newDirectionalArt:'PENDING_DOT_DELIVERY_AND_APPROVAL'});
}
write('characters/roster-action-mapping.private.json',privateRows);
for(const [id,data] of moves)write(`skills/${id}/mapping.json`,data);
const originals=['src/championship/presentation/dataArena/dataArenaRelayEffects.js','src/championship/presentation/dataArena/dataArenaAudio.js','src/championship/modes/dataArena/dataArenaRelay.js','src/championship/modes/dataArena/dataArenaRelayRoster.js','src/data/championship/data-arena-relay-roster.v1.json','src/data/championship/data-arena-relay-maps.v1.json'];
const manifest=[];
for(const file of originals){const data=fs.readFileSync(path.join(root,file)),to=path.join(destination,'originals',file);fs.mkdirSync(path.dirname(to),{recursive:true});fs.writeFileSync(to,data);manifest.push({path:file,sha256:createHash('sha256').update(data).digest('hex')});}
write('originals/manifest.json',{purpose:'OUR_AUTHORING_SOURCES_NOT_THIRD_PARTY_CODE',files:manifest});
write('skills/behaviour-matrix.json',[...moves.values()]);
console.log(JSON.stringify({destination,characters:RELAY_ROSTER.length,skills:moves.size,originalFiles:manifest.length}));

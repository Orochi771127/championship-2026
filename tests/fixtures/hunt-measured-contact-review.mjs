import * as PIXI from 'https://cdn.jsdelivr.net/npm/pixi.js@8.19.0/dist/pixi.mjs';
import {createChampionshipPixiStage} from '../../src/championship/presentation/championshipPixiStage.js';
import {mountHuntFieldPixiPresentation} from '../../src/championship/presentation/vs2/createHuntFieldPixiPresentation.js';
import {loadCompletedOriginalCharacters} from '../../src/championship/presentation/completedOriginalCharacters.js';
import {LICENSED_CHARACTER_MANIFEST} from '../../src/championship/presentation/licensedCharacterRoster.js';
import {NATIVE_HUNT_CHARACTER_FRAME_CONTRACT} from '../../src/championship/presentation/nativeHuntCharacterAction.js';
import {huntContactShadow} from '../../src/championship/presentation/vs2/huntContactShadow.js';
const url=p=>new URL('../../'+p,import.meta.url).href;
const read=async p=>{const r=await fetch(url(p));if(!r.ok)throw Error('REVIEW_INPUT_MISSING:'+p);return r.json();};
const selected=await read('src/data/championship/accepted-original-character-selection.r1.json');
const ids=['species-023','species-013','species-036'];
const configs=ids.map(id=>selected.characters.find(c=>c.speciesId===id));
const expected=['32b9dbbf2141a8e3fc50ced49cef1f5550ad6c11beb0059ebee67ac15545f4c0','25eccc707afdcc757837b0fb8aa178b2e37bc0eba16c6c3741e1e4e68af8f480','d125d563dc1199d1dbd93224a8c2b59c43322ccbbcb8ba6788b8fdc95b81b5ed'];
const hashes=await Promise.all(configs.map(async(c,i)=>{const bytes=await (await fetch(url(selected.root+c.folder+'/main.webp'))).arrayBuffer();const sha=[...new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))].map(b=>b.toString(16).padStart(2,'0')).join('');if(sha!==expected[i])throw Error('APPROVED_ATLAS_DRIFT:'+c.entityId);return sha;}));
// Exercise the real validated completed-original adapter on loopback. Its
// internal-review root is an asset-location alias to the exact selected bytes.
// Neither product config nor source art is edited to make this alias.
const rewrite=value=>typeof value==='string'?value.replace('/assets/production/internal-character-review/','/assets/production/characters/accepted-20261010/'):value&&typeof value==='object'&&'src' in value?{...value,src:rewrite(value.src)}:value;
const scopedPixi={...PIXI,Assets:{load:value=>PIXI.Assets.load(rewrite(value)),unload:value=>PIXI.Assets.unload(rewrite(value))}};
const roster=await loadCompletedOriginalCharacters({PIXI:scopedPixi,speciesIds:ids,manifest:await read(LICENSED_CHARACTER_MANIFEST),productionIndex:await read('assets/production/ART_PRODUCTION_INDEX.json'),manifestUrl:url(LICENSED_CHARACTER_MANIFEST)},url('championship.html'));
if(roster.getDiagnostics().completedOriginalArt.loaded.length!==3)throw Error('REVIEW_ROSTER_LOAD_FAILED:'+JSON.stringify(roster.getDiagnostics()));
const runtimes=await Promise.all(configs.map(c=>read(selected.root+c.folder+'/runtime.review.json')));
const shared=await createChampionshipPixiStage({PIXI,canvasHost:document.querySelector('#field'),resolutionCap:1,antialias:false});
shared.app.stop();const baselineTicker=shared.app.ticker.count;let root;
const stage={...shared,createSceneRoot(label){root=shared.createSceneRoot(label);return root;}};
let settings={mode:'measured',pose:'reference',height:0,flipY:false};
const wilds=Array.from({length:6},(_,i)=>({wildId:'contact-'+i,speciesId:ids[i%3],worldX:50+(i%3)*100,worldY:i<3?80:160,worldZ:0,facing:i<3?'right':'left'}));
const view={gateId:'isolated-contact',worldWidthPx:2048,worldHeightPx:2048,transform:{scale:3},camera:{left:0,top:0},visibleChunks:[],objects:[],player:{worldX:0,worldY:0,facing:'right'},wildCreatures:wilds,selectedWildId:null};
function rawFrame(i){const reference=[[0,0],[13,0],[0,1]],kind={idle0:[0,0],idle1:[0,1],walk0:[2,0],walk1:[2,1],air:[4,0]};const [sequenceId,frameIndex]=kind[settings.pose]??reference[i%3];return {contract:NATIVE_HUNT_CHARACTER_FRAME_CONTRACT,sequenceId,frameIndex,flipBits:(i<3?0:1)|(settings.flipY?2:0)};}
wilds.forEach((w,i)=>{w.nativeAnimation=rawFrame(i);});
const scene=await mountHuntFieldPixiPresentation({stage,source:{field:{tick(){},getView:()=>view},intents:{panCamera(){},selectWildAt(){},abortEnclosureStroke(){}}},characterBundle:roster});
const descendants=n=>[n,...(n.children??[]).flatMap(descendants)];
const actors=descendants(root).filter(n=>n.label==='wild creature');
function diagnostics(){return {pixi:PIXI.VERSION,settings:{...settings},atlasHashes:hashes,roster:roster.getDiagnostics(),frames:actors.map((n,i)=>{const frame=n.nativeFramePresenter.getSnapshot();return {entityId:configs[i%3].entityId,speciesId:wilds[i].speciesId,worldX:wilds[i].worldX,worldY:wilds[i].worldY,worldZ:wilds[i].worldZ,bodyY:n.y,bodyFlipY:n.scale.y,frame,atlasFrame:{...n.characterSprite.texture.frame},art:n.contactShadowArt,anchor:{x:n.characterSprite.anchor.x,y:n.characterSprite.anchor.y},nativeScale:n.characterSprite.scale.x,shadowY:n.contactShadow.y,shadowFlipY:n.contactShadow.scale.y,contact:huntContactShadow(wilds[i].speciesId,frame,wilds[i].worldZ,n.contactShadowArt)};})};}
function render(next={}){
 Object.assign(settings,next);wilds.forEach((w,i)=>{w.worldZ=settings.height;w.nativeAnimation=rawFrame(i);});scene.render();
 if(settings.mode==='generic')for(const n of actors){n.contactShadow.clear().ellipse(0,4,11,4).fill({color:0x02070a,alpha:.48});n.contactShadowKey=null;}
 shared.app.renderer.render(shared.app.stage);document.querySelector('#status').textContent=JSON.stringify(diagnostics(),null,2);
 return diagnostics();
}
for(const id of ['mode','pose','height'])document.querySelector('#'+id).addEventListener('change',e=>render({[id]:id==='height'?Number(e.target.value):e.target.value}));
render();
window.contactReview={render,diagnostics,async dispose(){scene.dispose();await roster.dispose();const result={ticker:shared.app.ticker.count,baselineTicker,sceneCount:shared.app.stage.children.length,rootDestroyed:root.destroyed};shared.destroy();return result;}};
window.contactReviewReady=true;

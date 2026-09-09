import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {validateBattleEffectArt, loadBattleEffectArt, loadRegisteredBattleEffectArt, isLocalBattleEffectPreview} from '../src/championship/presentation/battleEffectArt.js';
import {projectBattleEffectSprite, createBattleEffectSprites} from '../src/championship/presentation/battleEffectSprites.js';
import manifest from '../assets/production/internal-faithful-baseline/battle-effects-v1/manifest.json' with {type:'json'};
import retired from '../assets/production/vfx/original-battle-2d-v1/manifest.json' with {type:'json'};
import index from '../assets/production/ART_PRODUCTION_INDEX.json' with {type:'json'};
import profiles from '../src/data/championship/battleEffectProfiles.json' with {type:'json'};

function fakePixi({width=manifest.image.width}={}) {
  const loads=[], unloads=[], textures=[], sprites=[];
  const vector=()=>({set(x,y){this.x=x;this.y=y;}});
  return {loads,unloads,textures,sprites,
    Assets:{async load(path){loads.push(path);return {source:{},width,height:manifest.image.height};},async unload(path){unloads.push(path);}},
    Rectangle:class {constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}},
    Texture:class {constructor(options){Object.assign(this,options);textures.push(this);}destroy(source){this.destroyed=true;this.destroySource=source;}},
    Sprite:class {constructor(texture){this.texture=texture;this.anchor=vector();this.position=vector();this.scale=vector();sprites.push(this);}destroy(){this.destroyed=true;}}
  };
}
function parent(){return {children:[],addChild(s){this.children.push(s);},removeChild(s){this.children.splice(this.children.indexOf(s),1);}};}
const effect=(extra={})=>({id:1,actor:123,bankId:19,sequenceId:0,cell:0,active:1,point:[100*4096,80*4096,5*4096],
  sin:0,cos:4096,scaleX:4096,scaleY:4096,flip:0,alpha:31,tint:32767,...extra});
const rect={x:10,y:20,width:208,height:136};
const baseUrl='http://127.0.0.1:8738/championship.html';
const nativeCell=manifest.cells.find(c=>c.bankId===19&&c.cell===0);
const loadArt=PIXI=>loadBattleEffectArt({PIXI,manifest,productionIndex:index,baseUrl});

test('original atlas registers exact bytes and numeric cells, with no embedded gameplay timing',()=>{
  assert.equal(validateBattleEffectArt(manifest,index).cells.length,1231);
  const image=fs.readFileSync(new URL('../'+manifest.image.src,import.meta.url));
  assert.equal(createHash('sha256').update(image).digest('hex'),manifest.image.sha256);
  assert.equal(image.readUInt32BE(16),manifest.image.width);
  assert.equal(image.readUInt32BE(20),manifest.image.height);
  for(const cell of manifest.cells){
    const box=profiles.banks.find(b=>b.id===cell.bankId).boxes[cell.cell];
    assert.deepEqual(cell.origin,[(-box[2])|0,(-box[3])|0]);
    assert.deepEqual(cell.frame.slice(2),[box[0]-box[2],box[1]-box[3]]);
    assert.equal(cell.pixelsPerNativePixel,1);
    assert.equal(cell.ticks,undefined);assert.equal(cell.collision,undefined);
  }
  assert.equal(manifest.humanApproved,false);assert.equal(manifest.shippingReady,false);
  assert.equal(manifest.provenance.sourcePolicy,'OWNER_SUPPLIED_ORIGINAL_PNG_NO_IMAGE_GENERATION');
  assert.equal(manifest.image.scaleMode,'nearest');
  const keys=new Set(manifest.cells.map(c=>`${c.bankId}:${c.cell}`));
  for(const bank of profiles.banks)for(const seq of bank.sequences)for(const f of seq.frames)assert.ok(keys.has(`${bank.id}:${f.cell}`));
});

test('local permission, valid paths, native sizing and source hashes are required before loading',()=>{
  const edits=[m=>m.runtimeEligible=false,m=>m.rightsStatus='ROM_DECODED',m=>m.image.src='assets/production/../research/a.png',
    m=>m.image.src='https://outside/a.png',m=>m.cells.push(m.cells[0]),m=>m.cells[0].frame=[1250,0,32,32],
    m=>m.cells[0].pixelsPerNativePixel=20,m=>m.cells[0].origin=[NaN,0],m=>m.localOnly=false,
    m=>m.publicReleasePermitted=true,m=>m.shippingReady=true,m=>m.runtimeScope='ANYWHERE'];
  for(const edit of edits){const m=structuredClone(manifest);edit(m);assert.throws(()=>validateBattleEffectArt(m,index));}
  assert.throws(()=>validateBattleEffectArt(manifest,{entries:[]}));
});

test('one texture source serves all cells and unloads once after disposal',async()=>{
  const PIXI=fakePixi();const art=await loadArt(PIXI);
  assert.equal(PIXI.loads.length,1);assert.equal(PIXI.textures.length,1231);
  assert.equal(new Set(PIXI.textures.map(t=>t.source)).size,1);
  assert.equal(art.getCell(19,0).texture.frame.width,16);assert.ok(art.getCell(1,142));
  assert.equal(art.getCell(1,999),null);
  const a=art.dispose(),b=art.dispose();assert.equal(a,b);await a;
  assert.equal(PIXI.unloads.length,1);assert.ok(PIXI.textures.every(t=>t.destroyed&&t.destroySource===false));
  assert.equal(art.getCell(19,0),null);
});

test('an image with incorrect dimensions releases its source and cannot mount',async()=>{
  const PIXI=fakePixi({width:1025});
  await assert.rejects(loadArt(PIXI),/DIMENSIONS/);
  assert.equal(PIXI.unloads.length,1);
});

test('registered loader follows index before manifest; an absent entry makes no image request',async()=>{
  const PIXI=fakePixi(),requests=[];
  const fetchImpl=async url=>{requests.push(url.href);return {ok:true,json:async()=>requests.length===1?index:manifest};};
  const art=await loadRegisteredBattleEffectArt({PIXI,baseUrl:'http://localhost/game/championship.html',fetchImpl});
  assert.deepEqual(requests,['http://localhost/game/assets/production/ART_PRODUCTION_INDEX.json',
    'http://localhost/game/assets/production/internal-faithful-baseline/battle-effects-v1/manifest.json']);
  await art.dispose();requests.length=0;
  assert.equal(await loadRegisteredBattleEffectArt({PIXI,baseUrl:'http://localhost/',fetchImpl:async url=>{
    requests.push(url);return {ok:true,json:async()=>({entries:[]})};}}),null);
  assert.equal(requests.length,1);
});

test('native Q12 position, lift, rotation, both flip bits, scale, alpha and RGB555 share the arena transform',()=>{
  const e=effect({sin:4096,cos:0,flip:3,scaleX:8192,scaleY:2048,alpha:15,tint:31});
  const p=projectBattleEffectSprite(e,nativeCell,rect,.5,2048);
  assert.equal(p.x,60);assert.equal(p.y,57.5);assert.equal(p.depth,60);
  assert.equal(p.rotation,Math.PI/2);assert.equal(p.scaleX,-1);assert.equal(p.scaleY,-.25);
  assert.equal(p.alpha,15/31);assert.equal(p.tint,0x800000);
  assert.equal(p.anchorX,7/16);assert.equal(p.anchorY,7/16);
});

test('a cell transition reuses its sprite, a reused pool address gets a new identity, and release removes it',async()=>{
  const PIXI=fakePixi(),art=await loadArt(PIXI),layer=parent();
  const renderer=createBattleEffectSprites({PIXI,parent:layer,art});
  renderer.update([effect()],rect,.5);const first=layer.children[0];
  renderer.update([effect({cell:2,sequenceId:2,active:0})],rect,.5);
  assert.equal(layer.children[0],first);assert.equal(first.texture,art.getCell(19,2).texture);
  assert.equal(renderer.getDiagnostics().active,1,'once animation completion is not VM ownership release');
  renderer.update([effect({id:2,actor:123})],rect,.5);
  assert.equal(first.destroyed,true);assert.equal(layer.children.length,1);
  renderer.update([],rect,.5);
  assert.equal(layer.children.length,0);assert.equal(renderer.getDiagnostics().created,2);
  assert.equal(renderer.getDiagnostics().released,2);renderer.dispose();await art.dispose();
});

test('missing cells remove stale artwork and remain explicit; repeated redraw cannot advance animation',async()=>{
  const PIXI=fakePixi(),art=await loadArt(PIXI),layer=parent();
  const renderer=createBattleEffectSprites({PIXI,parent:layer,art}),sample=Object.freeze(effect());
  for(let i=0;i<20;i++)renderer.update([sample],rect,.5);
  assert.equal(PIXI.sprites.length,1);assert.equal(renderer.getDiagnostics().sprites[0].cell,0);
  renderer.update([effect({bankId:1,cell:999})],rect,.5);
  assert.equal(layer.children.length,0);assert.deepEqual(renderer.getDiagnostics().missingCells,['1:999']);
  renderer.update([sample],rect,.5);renderer.dispose();renderer.dispose();renderer.update([sample],rect,.5);
  assert.equal(layer.children.length,0);assert.equal(renderer.getDiagnostics().created,2);
  assert.equal(PIXI.unloads.length,0,'layer does not own the shared atlas');await art.dispose();
});

test('public/file/untrusted origins never fetch reference pixels or fall back to generated art',async()=>{
  const PIXI=fakePixi();let requests=0;
  for(const url of ['https://example.test/','file:///R:/game.html','http://localhost.example.test/','http://192.168.1.20/',undefined]){
    assert.equal(isLocalBattleEffectPreview(url),false);
    assert.equal(await loadRegisteredBattleEffectArt({PIXI,baseUrl:url,fetchImpl:async()=>{requests++;}}),null);
    await assert.rejects(loadBattleEffectArt({PIXI,manifest,productionIndex:index,baseUrl:url}),/LOCAL_PREVIEW_ONLY/);
  }
  for(const url of ['http://127.0.0.1/','http://localhost/','http://[::1]/'])assert.equal(isLocalBattleEffectPreview(url),true);
  assert.equal(requests,0);assert.equal(PIXI.loads.length,0);
  assert.equal(retired.runtimeEligible,false);assert.throws(()=>validateBattleEffectArt(retired,index));
});

test('native off-canvas origins remain unchanged and original empty cells stay invisible',async()=>{
  const PIXI=fakePixi(),art=await loadArt(PIXI),layer=parent(),renderer=createBattleEffectSprites({PIXI,parent:layer,art});
  const cell=art.getCell(1,0);
  assert.equal(cell.origin[1],14);assert.equal(cell.frame[3],8);
  renderer.update([effect({bankId:1,cell:0})],rect,.5);
  assert.equal(layer.children[0].anchor.y,14/8);
  const blank=manifest.cells.find(c=>c.blank);
  renderer.update([effect({bankId:blank.bankId,cell:blank.cell})],rect,.5);
  assert.equal(renderer.getDiagnostics().active,1);assert.equal(renderer.getDiagnostics().visible,0);
  assert.deepEqual(renderer.getDiagnostics().missingCells,[]);
  renderer.dispose();await art.dispose();
});

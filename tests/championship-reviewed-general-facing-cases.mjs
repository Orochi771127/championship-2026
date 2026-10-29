// General-mode facing of the reviewed character art (in-game re-review 2026-10-29).
// The ranch draws a General frame as stored while a partner moves left and
// mirrored while it moves right, so every General frame must face left once
// selection generalMirror / generalMirrorFrames are applied.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {reviewedNumericClip} from '../src/championship/presentation/reviewedCharacterAnimation.js';
import {attachReviewedCharacterAnimation} from '../src/championship/presentation/reviewedCharacterLoader.js';
import {loadReviewedDomFrames} from '../src/championship/presentation/reviewedSelection.js';
const root=path.resolve(import.meta.dirname,'..');
const selection=JSON.parse(fs.readFileSync(path.join(root,'src/data/championship/reviewed-animation-selection.v1.json'),'utf8'));
const read=code=>JSON.parse(fs.readFileSync(path.join(root,(e=>e.authoringPath??e.path)(selection.characters.find(c=>c.displayCode===code))),'utf8'));
function dimensions(bytes){
 if(bytes.subarray(1,4).toString()==='PNG')return [bytes.readUInt32BE(16),bytes.readUInt32BE(20)];
 let offset=12;
 while(offset+8<bytes.length){const kind=bytes.toString('ascii',offset,offset+4),length=bytes.readUInt32LE(offset+4),p=offset+8;
  if(kind==='VP8X')return [1+bytes.readUIntLE(p+4,3),1+bytes.readUIntLE(p+7,3)];
  if(kind==='VP8L'){const bits=bytes.readUInt32LE(p+1);return [(bits&16383)+1,((bits>>>14)&16383)+1];}
  offset=p+length+(length%2);
 }
 throw Error('UNKNOWN_IMAGE_DIMENSIONS');
}
function mockPixi(){
 const cached=new Map(),loads=[],unloads=[];
 class Rectangle{constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}}
 class Texture{constructor(options){Object.assign(this,options);}destroy(){this.destroyed=true;}}
 return {PIXI:{Rectangle,Texture,Assets:{async load(url){loads.push(url);const file=path.join(root,new URL(url).pathname);const [pixelWidth,pixelHeight]=dimensions(fs.readFileSync(file));
  const texture={source:{pixelWidth,pixelHeight,resolution:1}};cached.set(url,texture);return texture;},
  async unload(url){unloads.push(url);cached.get(url).source.destroyed=true;cached.delete(url);}}},loads,unloads};
}
const fileFetch=async url=>{const bytes=fs.readFileSync(path.join(root,new URL(url).pathname));return {ok:true,text:async()=>bytes.toString(),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};};
function baseline(){let disposals=0;return {get disposals(){return disposals;},runtime:{sides:{main:{animations:[{id:0,frames:[{ticks:60}]}]},sub:{animations:[]}}},
 getDiagnostics:()=>({}),async dispose(){disposals++;},createActor(){return {sprite:{texture:{},anchor:{set(x,y){this.x=x;this.y=y;}}},controller:{setAnimation(){},getSnapshot:()=>null},nativeFramePresenter:{apply:()=>({fallback:true})}};}};}

test('generalMirrorFrames: single frames drawn facing opposite to their set are mirrored relative to it, in Pixi and DOM; Arena unchanged',async()=>{
 // In-game re-review 2026-10-29: these frames face the other way from the rest of their set.
 // Clip-by-clip re-check the same day: GR38 blink/exhale (MA_02/03) added; BD_06/07 and MB_10 already
 // faced like their clips; MA50/MA63 sleep cells were right as stored; MA53 pleased cell_13 added.
 assert.deepEqual(Object.fromEntries(selection.characters.filter(c=>c.generalMirrorFrames).map(c=>[c.displayCode,c.generalMirrorFrames.length])),
  {GR05:2,GR38:8,MA03:1,MA20:2,MA43:1,MA53:1,MA54:1,MA64:4,AW28:1,AW27:2});
 for(const entry of selection.characters.filter(c=>c.generalMirrorFrames)){const d=read(entry.displayCode);
  for(const id of entry.generalMirrorFrames)assert.ok(d.frames[id],entry.displayCode+' '+id);}
 // [code, Main sequence whose first frame is listed, Main sequence whose first frame is not]
 for(const [code,listed,plain] of [['GR05',7,2],['MA64',3,2],['MA20',15,2],['GR38',0,2]]){
  const entry=selection.characters.find(c=>c.displayCode===code),d=read(code);
  const mock=mockPixi(),bundle=await attachReviewedCharacterAnimation({bundle:baseline(),PIXI:mock.PIXI,speciesId:entry.speciesId,usage:'general',
   baseUrl:'http://127.0.0.1:8768/championship.html',fetchImpl:fileFetch});
  const actor=bundle.createActor({animation:0});
  for(const [seq,own] of [[listed,true],[plain,false]]){
   const s=actor.controller.setAnimation(seq),f=d.frames[s.assetId];
   assert.equal(entry.generalMirrorFrames.includes(s.assetId),own,code+' seq'+seq);
   const flip=(entry.generalMirror===true)!==own,off=(s.offset??[0,0])[0];
   assert.equal(actor.sprite.texture.rotate,flip?12:undefined,code+' seq'+seq);
   assert.equal(actor.sprite.anchor.x,(flip?f.sourceSize[0]-f.origin[0]+off:f.origin[0]-off)/f.sourceSize[0],code+' seq'+seq);
  }
  await bundle.dispose();
  const arena=await attachReviewedCharacterAnimation({bundle:baseline(),PIXI:mockPixi().PIXI,speciesId:entry.speciesId,usage:'arena',
   baseUrl:'http://127.0.0.1:8768/championship.html',fetchImpl:fileFetch});
  assert.equal(arena.createActor({animation:0}).sprite.texture.rotate,undefined,code+' arena');await arena.dispose();
 }
 const gr05=selection.characters.find(c=>c.displayCode==='GR05'),pub=JSON.parse(fs.readFileSync(path.join(root,gr05.path),'utf8'));
 const dom=await loadReviewedDomFrames(gr05.speciesId,{href:'http://127.0.0.1:8768/championship.html',fetchImpl:fileFetch,sequences:[7,2]});
 for(const [seq,frames] of dom.sequences)for(const [i,frame] of frames.entries()){
  const step=reviewedNumericClip(read('GR05'),'main',seq).clip.frames[i],f=pub.frames.find(x=>x.id===step.assetId),t=f.trim??[0,0,...f.sourceSize];
  const mirror=gr05.generalMirrorFrames.includes(step.assetId);assert.equal(frame.mirror,mirror,step.assetId);
  assert.equal(frame.place[0],(mirror?f.origin[0]-t[0]-f.frame[2]:t[0]-f.origin[0])+(step.offset??[0,0])[0],step.assetId);
 }
 assert.ok(dom.sequences.get(7).some(f=>f.mirror)&&dom.sequences.get(2).every(f=>!f.mirror));
});

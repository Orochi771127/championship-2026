// Ranch (Owner 2026-11-04): a carried partner struggles. The native carry sequence (main 11) loops every 11 ticks
// while most reviewed carry pairs run 320 ms; reading only the native position showed the second drawing 12 % of
// the time, so the body looked pinned. Looping native sequences run their reviewed clip on its own looping clock;
// a one-shot longer than its native sequence is compressed into it.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {attachReviewedCharacterAnimation} from '../src/championship/presentation/reviewedCharacterLoader.js';
import {reviewedNumericClip} from '../src/championship/presentation/reviewedCharacterAnimation.js';
const root=path.resolve(import.meta.dirname,'..');
const readJson=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const selection=readJson('src/data/championship/reviewed-animation-selection.v1.json');
const fileFetch=async url=>{const bytes=fs.readFileSync(path.join(root,new URL(url).pathname));
 return {ok:true,json:async()=>JSON.parse(bytes.toString()),text:async()=>bytes.toString(),arrayBuffer:async()=>bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength)};};
const PIXI={Rectangle:class{constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}},Texture:class{constructor(o){Object.assign(this,o);}destroy(){}},
 Assets:{async load(){return {source:{pixelWidth:4096,pixelHeight:4096,resolution:1}};},async unload(){}}};
const doc=entry=>{const d=readJson(entry.path);return {...d,frames:Object.fromEntries(d.frames.map(({id,...f})=>[id,f]))};};
// The native presenter steps one sequence; frames arrive as the native timeline would deliver them (one per tick).
async function play(code,sequence,ticks,presentation='raising'){
 const entry=selection.characters.find(c=>c.displayCode===code);
 const baseline={runtime:{sides:{main:{animations:[{id:0,playbackMode:2,frames:[{ticks:60}]},sequence]},sub:{animations:[]}}},getDiagnostics:()=>({}),async dispose(){},
  createActor(){return {sprite:{texture:{},anchor:{set(x,y){this.x=x;this.y=y;}}},controller:{setAnimation(){},getSnapshot:()=>null},nativeFramePresenter:{apply:()=>({fallback:true})}};}};
 const bundle=await attachReviewedCharacterAnimation({bundle:baseline,PIXI,speciesId:entry.speciesId,usage:'general',baseUrl:'http://127.0.0.1:8773/championship.html',fetchImpl:fileFetch});
 const actor=bundle.createActor({animation:0,presentation}),loop=sequence.frames.reduce((n,f)=>n+f.ticks,0),seen=[];
 for(let t=0;t<ticks;t++){
  let at=sequence.playbackMode===2?t%loop:Math.min(t,loop-1),frameIndex=0;
  while(at>=sequence.frames[frameIndex].ticks){at-=sequence.frames[frameIndex].ticks;frameIndex++;}
  seen.push(actor.nativeFramePresenter.apply({sequenceId:sequence.id,frameIndex,elapsedQ12:at*4096,active:true}).assetId);
 }
 await bundle.dispose();return seen;
}

test('a carried partner keeps alternating its reviewed struggle pair while held (native main 11 loops at 5/6 ticks)',async()=>{
 const carry={id:11,playbackMode:2,frames:[{ticks:5},{ticks:6}]};
 for(const code of ['MA21','GR02','GR39']){
  const pair=new Set(reviewedNumericClip(doc(selection.characters.find(c=>c.displayCode===code)),'main',11).clip.frames.map(f=>f.assetId));
  const seen=await play(code,carry,600),share=[...pair].map(id=>seen.filter(s=>s===id).length/seen.length);
  assert.ok(pair.size>=2,code);
  for(const s of share)assert.ok(s>0.3,`${code} shows each struggle drawing for a fair share of the hold (${share.map(x=>x.toFixed(2))})`);
 }
});

test('a one-shot reaction longer than its native sequence still reaches its last drawing',async()=>{
 const entry=selection.characters.find(c=>c.displayCode==='GR23'),clip=reviewedNumericClip(doc(entry),'main',8).clip;
 const last=clip.frames.at(-1).assetId,native={id:8,playbackMode:1,frames:[{ticks:5},{ticks:6}]};
 assert.ok(clip.frames.reduce((n,f)=>n+f.durationMs,0)*60/1000>11,'the reviewed reaction is longer than this native one-shot');
 const seen=await play('GR23',native,11);
 assert.equal(seen.at(-1),last);
});

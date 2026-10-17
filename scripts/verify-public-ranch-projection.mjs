import fs from 'node:fs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {assertPublicRanchStreaming} from './lib/public-ranch-streaming-boundary.mjs';
import {assertPublicBytes} from './lib/public-runtime-boundary.mjs';
import {validateCompletedOriginalRuntime} from '../src/championship/presentation/completedOriginalCharacters.js';

// Local receipt audit: requires the exact private descriptors retained in the
// authorized handoff. It neither uploads them nor copies their review fields.
const read=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
const raw=read('src/data/championship/ranch-streaming-selection.r1.json');
const selected=read('src/data/championship/ranch-render-selection.v1.json');
const configs=read('src/data/championship/accepted-original-character-selection.r1.json');
const allowlist=read('docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json');
let mainCells=0,mainFrameReferences=0,subFrameReferences=0,descriptorBytes=0;
const files=[];
for(const row of selected.characters){
 const original=raw.characters.find(c=>c.entityId===row.entityId),sourceBytes=fs.readFileSync(original.runtimePath);
 assert.equal(hash(sourceBytes),original.runtimeSha256);
 const source=JSON.parse(sourceBytes),bytes=fs.readFileSync(row.runtimePath),runtime=JSON.parse(bytes);
 assert.equal(hash(bytes),row.runtimeSha256);descriptorBytes+=bytes.length;
 const config=configs.characters.find(c=>c.entityId===row.entityId);
 validateCompletedOriginalRuntime(runtime,config,source,{publicRender:true});
 assert.equal(runtime.entityId,source.entityId);assert.deepEqual(runtime.artProfile.anchor,source.artProfile.anchor);
 assert.deepEqual(runtime.sides.sub.atlases,[]);
 mainCells+=new Set(runtime.sides.main.animations.flatMap(sequence=>sequence.frames.map(frame=>frame.texture))).size;
 for(const side of ['main','sub'])for(const [i,sequence]of runtime.sides[side].animations.entries()){
  const originalSequence=source.sides[side].animations[i];
  assert.equal(sequence.id,originalSequence.id);assert.equal(sequence.playbackMode,originalSequence.playbackMode);
  assert.equal(sequence.loopStartFrame,originalSequence.loopStartFrame);
  assert.deepEqual(sequence.frames.map(f=>[f.texture,f.cell,f.ticks]),originalSequence.frames.map(f=>[f.texture,f.cell,f.ticks]));
  if(side==='main')mainFrameReferences+=sequence.frames.length;else subFrameReferences+=sequence.frames.length;
  for(const frame of sequence.frames){
   const geometry=runtime.geometry.frames[frame.texture],expected=source.reviewGeometry.frames[frame.texture];
   for(const key of ['blank','scale','origin','sourceSize','nativeBounds'])assert.deepEqual(geometry[key],expected[key]);
  }
 }
 files.push({path:row.runtimePath,sha256:row.runtimeSha256,bytes:bytes.length});
}
const gate=assertPublicRanchStreaming({root:process.cwd(),files:allowlist.files.map(r=>r.path),allowlist,assertBytes:assertPublicBytes});
assert.equal(gate.characters,222);assert.equal(mainCells,13128);
const result={status:'PASS',scope:'LOCAL_PRIVATE_HANDOFF_TO_MINIMAL_PUBLIC_RENDER_PROJECTION_NOT_FULL_ARTIFACT',characters:222,mainCells,mainFrameReferences,subFrameReferences,descriptorBytes,
 sourceDescriptorsUnchanged:222,sourceReviewFieldsCopied:false,rawReviewDescriptorsSelected:false,globalPreloadRegistryExpanded:false,files};
if(process.argv[2])fs.writeFileSync(process.argv[2],JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({...result,files:undefined}));

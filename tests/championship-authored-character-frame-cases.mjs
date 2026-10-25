import test from 'node:test';
import assert from 'node:assert/strict';
import {sampleAuthoredCharacterFrame as sample} from '../src/championship/presentation/authoredCharacterFrame.js';
const sequence={id:2,frames:[{cell:4,ticks:12},{cell:5,ticks:12}]};
const authored={2:{frames:['contactA','liftA','contactB','liftB'].map(texture=>({texture,durationMs:100}))}};
test('four authored poses follow two native slots without changing native timing',()=>{
 const before=JSON.stringify(sequence);
 assert.equal(sample(sequence,{frameIndex:0,elapsedQ12:0,active:1},authored).texture,'contactA');
 assert.equal(sample(sequence,{frameIndex:0,elapsedQ12:6*4096,active:1},authored).texture,'liftA');
 assert.equal(sample(sequence,{frameIndex:1,elapsedQ12:0,active:1},authored).texture,'contactB');
 assert.equal(sample(sequence,{frameIndex:1,elapsedQ12:6*4096,active:1},authored).texture,'liftB');
 assert.equal(JSON.stringify(sequence),before);
});
test('unmapped sequences retain old art and invalid native samples are not invented',()=>{
 assert.equal(sample(sequence,{frameIndex:0},null),null);
 assert.equal(sample({...sequence,id:7},{frameIndex:0},authored),null);
 assert.equal(sample(sequence,{frameIndex:9},authored),null);
});
test('completed one-shot holds last authored frame; reduced motion holds first',()=>{
 assert.equal(sample(sequence,{frameIndex:1,elapsedQ12:0,active:0},authored).texture,'liftB');
 assert.equal(sample(sequence,{frameIndex:1,elapsedQ12:0,active:0},authored,true).texture,'contactA');
});

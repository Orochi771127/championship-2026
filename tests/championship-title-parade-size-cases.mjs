// Title parade and loading walker (Owner 2026-10-29): partners walk at their in-game
// size, never enlarged, and face the way they move.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {paradeNativeScreenPixels,drawParadeFrame} from '../src/championship/app/titleParade.js';
const root=path.resolve(import.meta.dirname,'..');

test('the parade uses the ranch scale: 3 CSS px per native px on a tall phone, 2 on desktop and short screens',()=>{
 // Measured in the ranch developer readout (nativeScreenPixels) 2026-10-29: 390x844 -> 3, 1280x720 -> 2.
 for(const [width,height,expected] of [[390,844,3],[430,932,3],[375,667,2],[1280,720,2],[1920,1080,2]])
  assert.equal(paradeNativeScreenPixels({innerWidth:width,innerHeight:height}),expected,width+'x'+height);
});

test('a frame marked mirror is drawn flipped into its place; others are drawn as stored',()=>{
 const calls=[];const ctx={clearRect(){},save(){calls.push('save');},restore(){calls.push('restore');},translate(x,y){calls.push(['translate',x,y]);},
  scale(x,y){calls.push(['scale',x,y]);},drawImage(...a){calls.push(['draw',...a.slice(5)]);}};
 const canvas={width:100,height:80},image={};
 drawParadeFrame(ctx,canvas,{image,rect:{x:1,y:2,w:30,h:40},place:{x:10,y:5}});
 assert.deepEqual(calls.splice(0),[['draw',10,5,30,40]]);
 drawParadeFrame(ctx,canvas,{image,rect:{x:1,y:2,w:30,h:40},place:{x:10,y:5},mirror:true});
 assert.deepEqual(calls,['save',['translate',40,5],['scale',-1,1],['draw',0,0,30,40],'restore']);
});

test('parade and loading walker size and face reviewed art the same way',()=>{
 const parade=fs.readFileSync(path.join(root,'src/championship/app/titleParade.js'),'utf8');
 const walker=fs.readFileSync(path.join(root,'src/championship/app/ui/loadingWalker.js'),'utf8');
 assert.match(parade,/canvas\.style\.height = `\$\{Math\.round\(height \* paradeNativeScreenPixels\(view\) \/ art\.density\)\}px`/);
 // The loading walker once mirrored only on its own direction, so right-facing reviewed sets ran backwards.
 assert.match(walker,/\(dir > 0\) !== Boolean\(art\.facesRight\)/);
 assert.match(walker,/drawParadeFrame\(ctx, canvas, art\.frames\[index\]\)/);
});

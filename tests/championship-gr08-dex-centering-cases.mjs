import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
const base=process.env.GR08_TEST_BASE ? pathToFileURL(resolve(process.env.GR08_TEST_BASE)+'/') : new URL('../',import.meta.url);
const {makeView}=await import(new URL('tests/helpers/dex-conditions-ui-fixture.mjs',base));
const screenUrl=new URL('../src/championship/app/vs4Screens.js',import.meta.url);
const css=readFileSync(new URL('../src/championship/app/vs2Styles.css',import.meta.url),'utf8');
const entries=JSON.parse(readFileSync(new URL('src/data/championship/database-hero-portraits.public.v1.json',base))).entries;
const silhouettes=JSON.parse(readFileSync(new URL('src/data/championship/database-hero-silhouettes.v1.json',base))).entries;
const {beforeWebRendition}=await import('./helpers/dex-web-renditions.cjs');
test('GR08 uses the selected display bytes (web rendition of the approved one) and dimensions',()=>{
 const row=entries.find(e=>e.speciesIndex===40);
 assert.equal(row.speciesId,'species-040');assert.equal(row.displayCode,'GR08');
 assert.deepEqual([row.width,row.height],[864,864]);
 assert.equal(beforeWebRendition(row).sha256,'8e094df53a21ebf95f8f4f476637676db3f9428287685b3bf73017afecbdbda1');
 assert.equal(createHash('sha256').update(readFileSync(new URL(row.src,base))).digest('hex'),row.sha256);
});
test('Dex detail exposes correct identity; navigation preserves image and state',()=>{
 const f=makeView({selectedSpeciesIndex:40,registeredSpecies:[39,40,41],screenUrl});
 try{for(const id of [40,39,41,40]){
  f.select(id);const hero=f.root.querySelector('.cm-dex-hero'),img=f.root.querySelector('.cm-dex-hero__image'),row=entries.find(e=>e.speciesIndex===id);
  assert.equal(hero.dataset.speciesId,row.speciesId);assert.equal(img.src,row.src);
  assert.deepEqual([img.width,img.height],[row.width,row.height]);f.assertUnchanged();
  const box=silhouettes.find(e=>e.sha256===row.sha256).box;assert.equal(hero.dataset.fit,'silhouette');
  assert.deepEqual(['--bx','--by','--bw','--bh','--iw','--ih'].map(name=>Number(img.style[name])),[...box,row.width,row.height]);
 }}finally{f.dispose();}
});
test('every Dex hero fits its drawn silhouette: GR08 centred, all inside the frame on the floor, sizes even',()=>{
 // The GR08-only shift is subsumed: its silhouette (alpha >32 spans x287..821) is centred like every other.
 assert.doesNotMatch(css,/species-040/);
 // The scaled canvas reaches past the stage; clipping keeps its transparent margin off neighbouring controls.
 assert.match(css,/\.cm-dex-hero\[data-fit="silhouette"\] \{ position: relative; container-type: size; overflow: clip; \}/);
 const rule=css.match(/\.cm-dex-hero\[data-fit="silhouette"\] > \.cm-dex-hero__image \{([^}]+)\}/)[1];
 assert.match(rule,/--dex-fit: min\(\(100cqw \+ 32px\) \/ var\(--bw\), \(100cqh \+ 24px - var\(--dex-floor, 24px\)\) \/ var\(--bh\)\)/);
 assert.match(rule,/left: calc\(24px \+ 50cqw - var\(--dex-fit\) \* \(var\(--bx\) \+ var\(--bw\) \/ 2\)\)/);
 assert.match(rule,/top: calc\(48px \+ 100cqh - var\(--dex-floor, 24px\) - var\(--dex-fit\) \* \(var\(--by\) \+ var\(--bh\)\)\)/);
 assert.deepEqual(silhouettes.find(e=>e.speciesIndex===40).box.filter((v,i)=>i%2===0).map((v,i)=>i?v+287:v),[287,821]);
 assert.deepEqual(silhouettes.map(e=>e.sha256).sort(),entries.map(e=>e.sha256).sort(),'every published hero is measured');
 // The CSS geometry in stage pixels (24 px padding): phone column, square, desktop and a short landscape stage.
 const place=(box,[w,h],floor)=>{const s=Math.min((w-16)/box[2],(h-24-floor)/box[3]),left=w/2-s*(box[0]+box[2]/2),top=h-floor-s*(box[1]+box[3]);
  return {x0:left+s*box[0],x1:left+s*(box[0]+box[2]),y0:top+s*box[1],y1:top+s*(box[1]+box[3])};};
 for(const size of [[158,210],[272,272],[320,320],[272,160]])for(const floor of [24,48]){
  const heights=[];
  for(const {box} of silhouettes){const p=place(box,size,floor);
   assert.ok(p.x0>=8-1e-9&&p.x1<=size[0]-8+1e-9&&p.y0>=24-1e-9);assert.ok(Math.abs(p.y1-(size[1]-floor))<1e-9);heights.push(p.y1-p.y0);}
  const gr08=place(silhouettes.find(e=>e.speciesIndex===40).box,size,floor);assert.ok(Math.abs((gr08.x0+gr08.x1)/2-size[0]/2)<1e-9);
  heights.sort((a,b)=>a-b);assert.ok(heights[0]/heights.at(-1)>=0.5,`${size}: ${heights[0]} / ${heights.at(-1)}`);
 }
 // Owner report 2026-10-29: MA44 (wide canvas) drew at half the height of MA46 (tall canvas) on the phone stage.
 const ma=id=>{const e=entries.find(row=>row.speciesIndex===id),p=place(silhouettes.find(row=>row.sha256===e.sha256).box,[158,210],24);return p.y1-p.y0;};
 assert.ok(ma(105)/ma(106)>0.9);
});

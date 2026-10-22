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
test('GR08 uses unchanged selected display bytes and dimensions',()=>{
 const row=entries.find(e=>e.speciesIndex===40);
 assert.equal(row.speciesId,'species-040');assert.equal(row.displayCode,'GR08');
 assert.deepEqual([row.width,row.height],[864,864]);
 assert.equal(row.sha256,'8e094df53a21ebf95f8f4f476637676db3f9428287685b3bf73017afecbdbda1');
 assert.equal(createHash('sha256').update(readFileSync(new URL(row.src,base))).digest('hex'),row.sha256);
});
test('Dex detail exposes correct identity; navigation preserves image and state',()=>{
 const f=makeView({selectedSpeciesIndex:40,registeredSpecies:[39,40,41],screenUrl});
 try{for(const id of [40,39,41,40]){
  f.select(id);const hero=f.root.querySelector('.cm-dex-hero'),img=f.root.querySelector('.cm-dex-hero__image'),row=entries.find(e=>e.speciesIndex===id);
  assert.equal(hero.dataset.speciesId,row.speciesId);assert.equal(img.src,row.src);
  assert.deepEqual([img.width,img.height],[row.width,row.height]);f.assertUnchanged();
 }}finally{f.dispose();}
});
test('correction is Dex hero species-040 only, relative to contained image width',()=>{
 assert.match(css,/\.cm-dex-hero\[data-species-id="species-040"\]:not\(\[hidden\]\) \{ display: flex; align-items: center; justify-content: center; \}/);
 const rule=css.match(/\.cm-dex-hero\[data-species-id="species-040"\] > \.cm-dex-hero__image \{([^}]+)\}/)[1];
 assert.match(rule,/width: auto; height: auto; max-width: 100%; max-height: 100%/);
 const percentage=Number(rule.match(/translateX\((-?[\d.]+)%\)/)[1]);
 // Same contain scale before/after, including narrow and short landscape boxes.
 for(const [w,h] of [[272,272],[242,272],[272,115.8],[272,86.4],[192,272]]){
  const side=Math.min(w,h),scale=side/864,dx=side*percentage/100;
  assert.ok(Math.abs(((287+821)/2-432)*scale+dx)<1e-8);
  assert.ok(w/2+(287-432)*scale+dx>=0);
  assert.ok(w/2+(821-432)*scale+dx<=w);
 }
 assert.doesNotMatch(rule,/scale\(|translateY|zoom:/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {APPROVED_GAME_TITLES,getActiveGameTitle,getTitleHeadingHtml} from '../src/championship/text/brandTerms.js';
const root=new URL('../',import.meta.url),read=p=>fs.readFileSync(new URL(p,root),'utf8');
const html=read('championship.html'),css=read('src/championship/app/opening.css');
test('five decorative deferred logos share exact 2:1 dimensions and existing accessible h1',()=>{
 const region=html.match(/<div class="cm-title__logo">([\s\S]*?)<\/div>/)[1],images=[...region.matchAll(/<img[^>]+>/g)].map(m=>m[0]);
 assert.equal(images.length,5);assert.equal((region.match(/<h1/g)||[]).length,1);
 for(const locale of Object.keys(APPROVED_GAME_TITLES)){
  const image=images.find(s=>s.includes(`data-title-locale="${locale}"`));assert.ok(image);assert.match(image,/width="1774" height="887"/);assert.match(image,/alt="" aria-hidden="true"/);assert.doesNotMatch(image,/(?<![\w-])src=/);assert.match(image,/data-title-src=/);
  assert.equal(getActiveGameTitle(locale),APPROVED_GAME_TITLES[locale]);assert.equal(getTitleHeadingHtml(locale).replace('<br><span>',locale==='zh-Hant'||locale==='ja'?'：':': ').replace('</span>',''),APPROVED_GAME_TITLES[locale]);
 }
 assert.equal(getActiveGameTitle('unsupported'),APPROVED_GAME_TITLES['zh-Hant']);
 assert.match(images[0],/title-morning-r1\/logo-zh-Hant.webp/);
});
test('all languages reserve equal space, contain pixels and show h1 unless current image is ready',()=>{
 assert.match(css,/#cm-title > \.cm-title__panel \.cm-title__logo \{ aspect-ratio:2; \}/);
 assert.match(css,/#cm-title > \.cm-title__panel \.cm-title__logo-art \{ display:none; height:100%; object-fit:contain; \}/);
 assert.match(css,/\.cm-title__logo:has\(\.cm-title__logo-art\[data-title-image-visible="true"\]\[data-title-image-state="ready"\]\) \.cm-title__name/);
 assert.match(css,/top:max\(10%,calc\(env\(safe-area-inset-top,0px\) \+ 52px\)\); left:8%; width:84%/);
 assert.match(css,/\.cm-title__partners \{ position:absolute; left:10%; bottom:23%; width:80%; height:25%/);
 assert.match(css,/\.cm-title__entry \{ position:absolute; top:80%/);
 assert.match(css,/:root:lang\(zh\) #cm-title \.cm-title__film \.cm-title__logo-art\[data-title-locale="zh-Hant"\] \{ display:block; \}/);
});
test('manifest ships only four selected PNGs with exact byte hashes, retaining Thai r2',()=>{
 const manifest=JSON.parse(read('assets/production/title-multilingual-r1/manifest.json'));
 assert.deepEqual(manifest.files.map(e=>e.locale).sort(),['en','ja','th','vi']);
 for(const row of manifest.files){const bytes=fs.readFileSync(new URL(row.path,root));assert.equal(bytes.length,row.bytes);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),row.sha256);assert.equal(row.width/row.height,2);}
 assert.equal(manifest.files.find(e=>e.locale==='th').sourceRevision,'logo-th-r2.png');
});

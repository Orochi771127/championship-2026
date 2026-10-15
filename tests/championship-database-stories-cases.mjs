import {databaseHeroPortrait} from '../src/championship/presentation/databaseHeroPortraits.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {DATABASE_ORIGINAL_PROFILES as catalog,databaseStory,databaseStoryHeading,databaseVerifiedData,databaseVerifiedHeading} from '../src/championship/database/databaseStories.js';
import {getDatabaseDisplayEntry} from '../src/championship/database/databaseDisplayCatalog.js';
import {setLocale} from '../src/championship/text/locale.js';
import {makeView} from './helpers/dex-conditions-ui-fixture.mjs';
const locales=['zh-Hant','en','ja','th','vi'];
test('216 immutable original profiles join exact display identities with five complete locales',()=>{
 assert.equal(catalog.entries.length,216);assert.ok(Object.isFrozen(catalog));
 assert.equal(new Set(catalog.entries.map(e=>e.speciesIndex)).size,216);
 for(const e of catalog.entries){
  const id=getDatabaseDisplayEntry(e.speciesIndex);
  assert.equal(e.speciesId,id.speciesId);
  assert.equal(e.displayCode,id.displayCode);
  assert.ok(id.numberingStageIndex>=1&&id.numberingStageIndex<=6);
  assert.ok(Object.isFrozen(e.textByLocale));
  assert.deepEqual(Object.keys(e.textByLocale),locales);
  for(const l of locales){
   assert.ok(databaseStory(e.speciesIndex,l).length>25);
   assert.ok(databaseStoryHeading(l));
  }
 }
 assert.equal(catalog.entries[5].speciesIndex,19);
});
test('unknown species and unsupported locales do not borrow or reveal other stories',()=>{
 for(const id of [0,7,224,225,226,227,-1,null,'8',8.5,NaN])assert.equal(databaseStory(id,'en'),null);
 for(const l of ['fr','zh','__proto__','constructor'])assert.equal(databaseStory(8,l),null);
});
test('registered details render exact locale prose as text without changing state',()=>{
 try {for(const locale of locales){const f=makeView({locale});const section=f.root.querySelector('.cm-dex-profile');assert.ok(section);assert.equal(section.getAttribute('aria-label'),databaseStoryHeading(locale));assert.equal(section.querySelector('p').textContent,databaseStory(8,locale));assert.ok(f.root.querySelector('.cm-dex-routes'));f.assertUnchanged();f.dispose();}} finally {setLocale('zh-Hant');}
});
test('undiscovered species emit no profile or data section',()=>{
 for(const spec of [{selectedSpeciesIndex:8,registeredSpecies:[],collection:[]},{selectedSpeciesIndex:20,registeredSpecies:[],collection:[]}]){const f=makeView(spec);assert.equal(f.root.querySelector('.cm-dex-profile'),null);assert.equal(f.root.querySelector('.cm-dex-data'),null);f.assertUnchanged();f.dispose();}
});
test('locale repaint changes prose, and navigation removes previous character story',()=>{
 const f=makeView({registeredSpecies:[8]});try{const original=f.root.querySelector('.cm-dex-profile');setLocale('ja');f.document.documentElement.lang='ja';f.view.render(f.frame());assert.notEqual(f.root.querySelector('.cm-dex-profile'),original);assert.equal(f.root.querySelector('.cm-dex-profile__text').textContent,databaseStory(8,'ja'));f.select(20);assert.equal(f.root.querySelector('.cm-dex-profile'),null);f.select(null);assert.equal(f.root.querySelector('.cm-dex-profile'),null);f.assertUnchanged();}finally{f.dispose();setLocale('zh-Hant');}
});
test('all twelve hero identities preserve registration privacy in every locale (120 combinations)',()=>{
 try {for(const e of catalog.entries.slice(0,12))for(const locale of locales)for(const registered of [true,false]){
  const f=makeView({locale,selectedSpeciesIndex:e.speciesIndex,registeredSpecies:registered?[e.speciesIndex]:[],collection:[]});
  const prose=f.root.querySelector('.cm-dex-profile__text');
  const dataSec=f.root.querySelector('.cm-dex-data');
  if(registered){assert.equal(prose?.textContent,e.textByLocale[locale]);assert.ok(f.root.querySelector('.cm-dex-hero'));assert.ok(dataSec);}else {assert.equal(prose,null);assert.equal(f.root.querySelector('.cm-dex-hero'),null);assert.equal(dataSec,null);}
  f.assertUnchanged();f.dispose();
 }}finally{setLocale('zh-Hant');}
});
test('representative roster identities across stages preserve registration privacy',()=>{
 const sampleSpecies=[20,34,72,136,187];
 try {for(const sp of sampleSpecies){const entry=catalog.entries.find(e=>e.speciesIndex===sp);for(const locale of locales)for(const registered of [true,false]){
  const f=makeView({locale,selectedSpeciesIndex:sp,registeredSpecies:registered?[sp]:[],collection:[]});
  const prose=f.root.querySelector('.cm-dex-profile__text');
  const dataSec=f.root.querySelector('.cm-dex-data');
  if(registered){assert.equal(prose?.textContent,entry.textByLocale[locale]);assert.equal(Boolean(f.root.querySelector('.cm-dex-hero')),Boolean(databaseHeroPortrait(sp)));assert.ok(dataSec);}else {assert.equal(prose,null);assert.equal(f.root.querySelector('.cm-dex-hero'),null);assert.equal(dataSec,null);}
  f.assertUnchanged();f.dispose();
 }}}finally{setLocale('zh-Hant');}
});
test('verified species traits omit individual stat estimates across locales',()=>{
 for(const locale of locales){
  assert.ok(databaseVerifiedHeading(locale));
  const data=databaseVerifiedData(8,locale);
  assert.ok(data);
  assert.equal(data.speciesIndex,8);
  assert.ok(data.attributeName);
  assert.ok(data.familyName);
  assert.equal(Object.hasOwn(data,'baseHp'),false);
  assert.equal(Object.hasOwn(data,'baseTp'),false);
  assert.ok(Array.isArray(data.moves));
  assert.ok(data.labels.attribute);
 }
 assert.equal(databaseVerifiedData(0,'en'),null);
 assert.equal(databaseVerifiedData(224,'en'),null);
 assert.equal(databaseVerifiedData(8,'fr'),null);
 assert.equal(databaseVerifiedHeading('fr'),null);
});

test('registered trait panels keep attribute, family and exact move TP costs without partner stat tags',()=>{
 try {for(const locale of locales)for(const sp of [8,34]){
  const data=databaseVerifiedData(sp,locale);
  const f=makeView({locale,selectedSpeciesIndex:sp,registeredSpecies:[sp],collection:[]});
  const traits=f.root.querySelectorAll('.cm-dex-trait-tag');
  assert.deepEqual(Array.from(traits,t=>t.textContent),[
   `${data.labels.attribute}: ${data.attributeName}`,
   `${data.labels.family}: ${data.familyName}`
  ]);
  const cards=f.root.querySelectorAll('.cm-dex-move-card__meta');
  if(sp===8)assert.equal(cards.length,0);
  else {
   assert.deepEqual(data.moves.map(m=>[m.recordIndex,m.power,m.actionCost,m.kind]),[
    [59,100,0,0],[60,300,6,1],[61,400,10,1]
   ]);
   assert.deepEqual(Array.from(cards,t=>t.textContent),[
    `${data.labels.power} 100 · ${data.labels.cost} 0 TP`,
    `${data.labels.power} 300 · ${data.labels.cost} 6 TP`,
    `${data.labels.power} 400 · ${data.labels.cost} 10 TP`
   ]);
  }
  f.assertUnchanged();f.dispose();
 }}finally{setLocale('zh-Hant');}
});
test('unsupported heading lookup cannot return inherited object properties',()=>{
 for(const locale of ['fr','constructor','__proto__','toString'])assert.equal(databaseStoryHeading(locale),null);
});

test('54 hero assets join stable IDs and selected file hashes, with no animation/HUD replacement',async()=>{
 const {DATABASE_HERO_PORTRAITS:art,databaseHeroPortrait:get}=await import('../src/championship/presentation/databaseHeroPortraits.js');
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');assert.equal(art.entries.length,54);
 for(const e of art.entries){const id=getDatabaseDisplayEntry(e.speciesIndex);assert.equal(e.speciesId,id.speciesId);assert.equal(e.displayCode,id.displayCode);assert.ok(Object.isFrozen(e));assert.match(e.src,/^assets\/production\/(?:database-portraits-b1-20261014\/B1\d{2}\.webp|database-handpainted-r1-20261015\/species-(?:034|035|037|038|039|040|041|042|043|044|045|046|047|048|049|211|215|222)\.png|database-handpainted-r1-20261015\/species-046\.ed04f491cd22524e\.png|database-handpainted-r1-20261015\/species-042\.d5dcc1491759eea7\.png|database-handpainted-r1-20261015\/species-041\.679bfc5abc699a5e\.png|database-handpainted-r1-20261015\/species-049\.376bd37739caf2ad\.png|database-handpainted-r1-20261015\/species-035\.be1631a7ffea0de4\.png|database-handpainted-r1-20261015\/species-039\.a22eae194967e17d\.png|database-handpainted-r1-20261015\/species-045\.5252dd103f05bc11\.png|database-handpainted-r1-20261015\/species-053\.a07a52ab7f1501c4\.png|database-handpainted-r1-20261015\/species-054\.653364ea2b2dbdd5\.png|database-handpainted-r1-20261015\/species-055\.32e6689b5e9669c2\.png|database-handpainted-r1-20261015\/species-057\.001820f22618bab0\.png|database-handpainted-r1-20261015\/species-050\.4da662245939ae14\.png|database-handpainted-r1-20261015\/species-051\.4005fcb499a215ca\.png|database-handpainted-r1-20261015\/species-052\.e2a1ae73e1e1baab\.png|database-handpainted-r1-20261015\/species-056\.f7c3f093351f4965\.png|database-handpainted-r1-20261015\/species-058\.85ac0a27d7121cef\.png|database-handpainted-r1-20261015\/species-059\.d808c556efd2a029\.png|database-handpainted-r1-20261015\/species-060\.7a8efa91b909b615\.png|database-handpainted-r1-20261015\/species-061\.df2dcf13586b2025\.png|database-handpainted-r1-20261015\/species-062\.25391107e04095f4\.png|database-handpainted-r1-20261015\/species-063\.a2403ae4b27f60e1\.png|database-handpainted-r1-20261015\/species-064\.1fd9b11486ee01a1\.png|database-handpainted-r1-20261015\/species-065\.297304ab3fa37f43\.png|database-handpainted-r1-20261015\/species-066\.18cfe71dbf919d32\.png|database-handpainted-r1-20261015\/species-067\.d3b4711e2fef8428\.png|database-handpainted-r1-20261015\/species-068\.fd96778e08b01ee7\.png|database-handpainted-r1-20261015\/species-069\.cf92eaf941781156\.png|database-handpainted-r1-20261015\/species-117\.8f7d027cdbf6d3e6\.png|database-handpainted-r1-20261015\/species-070\.8b5455d530173b0f\.png|database-handpainted-r1-20261015\/species-071\.cd9ee93854a452cc\.png|database-handpainted-r1-20261015\/species-072\.4ca0e10b98584a76\.png)$/);assert.equal(createHash('sha256').update(fs.readFileSync(e.src)).digest('hex'),e.sha256);assert.ok(e.width>0&&e.height>0);}
 for(const id of [0,20,195,'8',NaN])assert.equal(get(id),null);
});

test('hero appears only after matching decoded dimensions and has cancellation-safe handlers',async()=>{
 const {databaseHeroPortrait:get}=await import('../src/championship/presentation/databaseHeroPortraits.js');
 const f=makeView(),holder=f.root.querySelector('.cm-dex-hero'),image=holder.querySelector('img'),art=get(8);
 assert.equal(holder.dataset.art,'loading');assert.ok(image.hidden);assert.notEqual(holder.hidden,true);assert.equal(image.src,art.src);
 image.naturalWidth=1;image.naturalHeight=1;image.onload();assert.ok(image.hidden);assert.equal(holder.dataset.art,'missing');
 image.naturalWidth=art.width;image.naturalHeight=art.height;image.onload();assert.equal(image.hidden,false);assert.equal(holder.dataset.art,'ready');
 image.onerror();assert.ok(image.hidden);assert.equal(holder.dataset.art,'missing');
 const late=image.onload;f.select(20);assert.equal(image.onload,null);assert.equal(image.onerror,null);late();assert.ok(image.hidden);assert.equal(f.root.querySelector('.cm-dex-hero'),null);f.assertUnchanged();f.dispose();
 const unknown=makeView({registeredSpecies:[],collection:[]});assert.equal(unknown.root.querySelector('.cm-dex-hero'),null);unknown.dispose();
});

test('hero navigation, locale repaint and disposal invalidate earlier decode callbacks',()=>{
 const f=makeView({registeredSpecies:[8,9],collection:[]});
 try {
  const first=f.root.querySelector('.cm-dex-hero__image'),late=first.onload;
  f.select(9);assert.equal(first.onload,null);late();
  const second=f.root.querySelector('.cm-dex-hero__image');assert.notEqual(first,second);assert.match(second.src,/B102\.webp$/);
  setLocale('ja');f.document.documentElement.lang='ja';f.view.render(f.frame());assert.equal(second.onload,null);
  const third=f.root.querySelector('.cm-dex-hero__image'),afterDispose=third.onload;
  f.dispose();assert.equal(third.onload,null);assert.equal(third.onerror,null);afterDispose();assert.ok(third.hidden);f.assertUnchanged();
 } finally {setLocale('zh-Hant');}
});

test('four hand-painted heroes preserve exact identity and discovery privacy across five locales',()=>{
 try {for(const sp of [34,37,48,215])for(const locale of locales)for(const registered of [true,false]){
  const f=makeView({locale,selectedSpeciesIndex:sp,registeredSpecies:registered?[sp]:[],collection:[]});
  try {const holder=f.root.querySelector('.cm-dex-hero'),art=databaseHeroPortrait(sp);
   if(!registered){assert.equal(holder,null);assert.equal(f.root.querySelector('.cm-dex-profile'),null);}
   else {assert.ok(holder);const img=holder.querySelector('img');assert.equal(img.src,art.src);assert.equal(art.width,1254);assert.equal(art.height,1254);assert.ok(img.hidden);img.naturalWidth=1254;img.naturalHeight=1254;img.onload();assert.equal(img.hidden,false);assert.equal(holder.dataset.art,'ready');}
   f.assertUnchanged();
  }finally{f.dispose();}
 }}finally{setLocale('zh-Hant');}
});

test('second batch hand-painted heroes preserve exact identity and discovery privacy across five locales',()=>{
 try {for(const sp of [35, 38, 39, 40])for(const locale of locales)for(const registered of [true,false]){
  const f=makeView({locale,selectedSpeciesIndex:sp,registeredSpecies:registered?[sp]:[],collection:[]});
  try {const holder=f.root.querySelector('.cm-dex-hero'),art=databaseHeroPortrait(sp),identity=getDatabaseDisplayEntry(sp);
   assert.equal(art.speciesId,identity.speciesId);assert.equal(art.displayCode,identity.displayCode);
   if(!registered){assert.equal(holder,null);assert.equal(f.root.querySelector('.cm-dex-profile'),null);assert.equal(f.root.querySelector('.cm-dex-data'),null);}
   else {assert.ok(holder);const img=holder.querySelector('img');assert.equal(img.src,art.src);assert.equal(art.width,1254);assert.equal(art.height,1254);assert.ok(img.hidden);assert.equal(f.root.querySelector('.cm-dex-profile__text').textContent,databaseStory(sp,locale));assert.ok(f.root.querySelector('.cm-dex-data'));img.naturalWidth=1254;img.naturalHeight=1254;img.onload();assert.equal(img.hidden,false);assert.equal(holder.dataset.art,'ready');}
   f.assertUnchanged();
  }finally{f.dispose();}
 }}finally{setLocale('zh-Hant');}
});


test('owner-confirmed ultimate hand-painted heroes preserve exact identity and discovery privacy across five locales',()=>{
 try {for(const sp of [211, 222])for(const locale of locales)for(const registered of [true,false]){
  const f=makeView({locale,selectedSpeciesIndex:sp,registeredSpecies:registered?[sp]:[],collection:[]});
  try {const holder=f.root.querySelector('.cm-dex-hero'),art=databaseHeroPortrait(sp),identity=getDatabaseDisplayEntry(sp);
   assert.equal(art.speciesId,identity.speciesId);assert.equal(art.displayCode,identity.displayCode);
   if(!registered){assert.equal(holder,null);assert.equal(f.root.querySelector('.cm-dex-profile'),null);assert.equal(f.root.querySelector('.cm-dex-data'),null);}
   else {assert.ok(holder);const img=holder.querySelector('img');assert.equal(img.src,art.src);assert.equal(art.width,1254);assert.equal(art.height,1254);assert.ok(img.hidden);assert.equal(f.root.querySelector('.cm-dex-profile__text').textContent,databaseStory(sp,locale));assert.ok(f.root.querySelector('.cm-dex-data'));img.naturalWidth=1254;img.naturalHeight=1254;img.onload();assert.equal(img.hidden,false);assert.equal(holder.dataset.art,'ready');}
   f.assertUnchanged();
  }finally{f.dispose();}
 }}finally{setLocale('zh-Hant');}
});

test('confirmed ultimate heroes are present with exact PNG bytes and selected source versions',async()=>{
 const {DATABASE_HERO_PORTRAITS:art}=await import('../src/championship/presentation/databaseHeroPortraits.js');
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');
 const manifest=JSON.parse(fs.readFileSync('assets/production/database-handpainted-r1-20261015/manifest.json','utf8'));
 assert.equal(art.entries.length,54);assert.equal(manifest.count,42);
 for(const [sp,version,form] of [[211,'v1','OWNER_CONFIRMED_BRASS_CROWN_MANDRILL'],[222,'v2','R10_QUADRUPED_LEFT_PANEL']]){
  const entry=databaseHeroPortrait(sp),metadata=manifest.entries.find(e=>e.speciesIndex===sp);assert.ok(entry);assert.equal(metadata.selectedGenerationVersion,version);assert.equal(metadata.selectedSourceForm,form);assert.equal(createHash('sha256').update(fs.readFileSync(entry.src)).digest('hex'),entry.sha256);assert.equal(metadata.sha256,entry.sha256);assert.equal(metadata.review.rootReview,'PASSED');
 }
});


test('batch six existing rookie heroes preserve exact identity and discovery privacy across five locales',()=>{
 try {for(const sp of [41, 42, 43, 44])for(const locale of locales)for(const registered of [true,false]){
  const f=makeView({locale,selectedSpeciesIndex:sp,registeredSpecies:registered?[sp]:[],collection:[]});
  try {const holder=f.root.querySelector('.cm-dex-hero'),art=databaseHeroPortrait(sp),identity=getDatabaseDisplayEntry(sp);
   assert.equal(art.speciesId,identity.speciesId);assert.equal(art.displayCode,identity.displayCode);
   if(!registered){assert.equal(holder,null);assert.equal(f.root.querySelector('.cm-dex-profile'),null);assert.equal(f.root.querySelector('.cm-dex-data'),null);}
   else {assert.ok(holder);const img=holder.querySelector('img');assert.equal(img.src,art.src);assert.equal(art.width,1254);assert.equal(art.height,1254);assert.ok(img.hidden);assert.equal(f.root.querySelector('.cm-dex-profile__text').textContent,databaseStory(sp,locale));assert.ok(f.root.querySelector('.cm-dex-data'));img.naturalWidth=1254;img.naturalHeight=1254;img.onload();assert.equal(img.hidden,false);assert.equal(holder.dataset.art,'ready');}
   f.assertUnchanged();
  }finally{f.dispose();}
 }}finally{setLocale('zh-Hant');}
});

test('batch six PNG hashes and accepted versions join existing stable identities',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');
 const manifest=JSON.parse(fs.readFileSync('assets/production/database-handpainted-r1-20261015/manifest.json','utf8'));
 for(const [sp,version] of [[41,'refined-handpainted-v2'],[42,'refined-handpainted-v2'],[43,'v1'],[44,'v1']]){
  const entry=databaseHeroPortrait(sp),metadata=manifest.entries.find(e=>e.speciesIndex===sp);assert.ok(entry);assert.equal(metadata.selectedGenerationVersion,version);assert.equal(createHash('sha256').update(fs.readFileSync(entry.src)).digest('hex'),entry.sha256);assert.equal(metadata.sha256,entry.sha256);assert.equal(metadata.review.rootReview,'PASSED');
 }
 assert.equal(databaseHeroPortrait(229),null);assert.equal(databaseHeroPortrait(230),null);
});

test('batch seven existing rookie heroes preserve exact identity and discovery privacy across five locales',()=>{
 try {for(const sp of [45, 46, 47, 49])for(const locale of locales)for(const registered of [true,false]){
  const f=makeView({locale,selectedSpeciesIndex:sp,registeredSpecies:registered?[sp]:[],collection:[]});
  try {const holder=f.root.querySelector('.cm-dex-hero'),art=databaseHeroPortrait(sp),identity=getDatabaseDisplayEntry(sp);
   assert.equal(art.speciesId,identity.speciesId);assert.equal(art.displayCode,identity.displayCode);
   if(!registered){assert.equal(holder,null);assert.equal(f.root.querySelector('.cm-dex-profile'),null);assert.equal(f.root.querySelector('.cm-dex-data'),null);}
   else {assert.ok(holder);const img=holder.querySelector('img');assert.equal(img.src,art.src);assert.equal(art.width,1254);assert.equal(art.height,1254);assert.ok(img.hidden);assert.equal(f.root.querySelector('.cm-dex-profile__text').textContent,databaseStory(sp,locale));assert.ok(f.root.querySelector('.cm-dex-data'));img.naturalWidth=1254;img.naturalHeight=1254;img.onload();assert.equal(img.hidden,false);assert.equal(holder.dataset.art,'ready');}
   f.assertUnchanged();
  }finally{f.dispose();}
 }}finally{setLocale('zh-Hant');}
});

test('batch seven PNG hashes and accepted versions join existing stable identities',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');
 const manifest=JSON.parse(fs.readFileSync('assets/production/database-handpainted-r1-20261015/manifest.json','utf8'));
 for(const [sp,version] of [[45,'refined-handpainted-v2'],[46,'refined-handpainted-v2'],[47,'v1'],[49,'refined-handpainted-v2']]){
  const entry=databaseHeroPortrait(sp),metadata=manifest.entries.find(e=>e.speciesIndex===sp);assert.ok(entry);assert.equal(metadata.selectedGenerationVersion,version);assert.equal(createHash('sha256').update(fs.readFileSync(entry.src)).digest('hex'),entry.sha256);assert.equal(metadata.sha256,entry.sha256);assert.equal(metadata.review.rootReview,'PASSED');
 }
 assert.equal(databaseHeroPortrait(229),null);assert.equal(databaseHeroPortrait(230),null);
});


test('046 refined portrait uses immutable content-addressed PNG without widening registry scope',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');
 const art=databaseHeroPortrait(46),qa=JSON.parse(fs.readFileSync('src/data/championship/qa-database-hero-portraits.r1.json','utf8'));
 assert.equal(art.src,'assets/production/database-handpainted-r1-20261015/species-046.ed04f491cd22524e.png');assert.equal(art.sha256,'ed04f491cd22524e5afd9ed106318c64f3def1f789f9acde7bcf66629b555362');
 assert.equal(createHash('sha256').update(fs.readFileSync(art.src)).digest('hex'),art.sha256);
 assert.deepEqual(qa.entries.find(e=>e.speciesIndex===46),art);assert.equal(qa.entries.length,56);
 assert.equal(databaseHeroPortrait(42).sha256,'d5dcc1491759eea7e2f02aeb4ae819997df7a67c9a50c019f3666c6da625feb4');
 assert.equal(databaseHeroPortrait(229),null);assert.equal(databaseHeroPortrait(230),null);
});

test('042 refined image joins QA and immutable filename with unchanged identity',()=>{
 const art=databaseHeroPortrait(42);assert.equal(art.src,'assets/production/database-handpainted-r1-20261015/species-042.d5dcc1491759eea7.png');assert.equal(art.sha256,'d5dcc1491759eea7e2f02aeb4ae819997df7a67c9a50c019f3666c6da625feb4');assert.equal(art.speciesId,'species-042');assert.equal(art.displayCode,'GR10');
});

test('041 refined hero preserves042/046 cache keys and stable identity',()=>{
 const a=databaseHeroPortrait(41);assert.equal(a.src,'assets/production/database-handpainted-r1-20261015/species-041.679bfc5abc699a5e.png');assert.equal(a.sha256,'679bfc5abc699a5e8795443ed2cf1117087fdf8138fbcbbe5d651731b09e4a29');assert.equal(a.speciesId,'species-041');assert.equal(a.displayCode,'GR09');
 assert.equal(databaseHeroPortrait(42).src,'assets/production/database-handpainted-r1-20261015/species-042.d5dcc1491759eea7.png');
 assert.equal(databaseHeroPortrait(46).src,'assets/production/database-handpainted-r1-20261015/species-046.ed04f491cd22524e.png');
});

test('049 refined hero has immutable cache key without replacing other identities',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');const a=databaseHeroPortrait(49);
 assert.equal(a.speciesId,'species-049');assert.equal(a.displayCode,'GR22');assert.equal(a.src,'assets/production/database-handpainted-r1-20261015/species-049.376bd37739caf2ad.png');assert.equal(a.sha256,'376bd37739caf2ad58093c5701e313efc6ebac1f3a7ae1de363a97ee89907b55');
 assert.equal(createHash('sha256').update(fs.readFileSync(a.src)).digest('hex'),a.sha256);
 const qa=JSON.parse(fs.readFileSync('src/data/championship/qa-database-hero-portraits.r1.json','utf8'));assert.deepEqual(qa.entries.find(e=>e.speciesIndex===49),a);
 assert.equal(databaseHeroPortrait(47).src,'assets/production/database-handpainted-r1-20261015/species-047.png');assert.equal(databaseHeroPortrait(67).speciesId,'species-067');
});

test('refined035039045 preserve exact versioned PNG identity and QA registry agreement',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');const expected={"35": {"src": "assets/production/database-handpainted-r1-20261015/species-035.be1631a7ffea0de4.png", "sha256": "be1631a7ffea0de43921ed7eb3e1196be6705fe026439abe9b90e14b564965c7"}, "39": {"src": "assets/production/database-handpainted-r1-20261015/species-039.a22eae194967e17d.png", "sha256": "a22eae194967e17d6aca6cac06ca249ef0fd223a0687c10923e33d78e3d710ec"}, "45": {"src": "assets/production/database-handpainted-r1-20261015/species-045.5252dd103f05bc11.png", "sha256": "5252dd103f05bc111158a75d193c3dc0793051614190f42645b99bb4f00f2453"}};
 const qa=JSON.parse(fs.readFileSync('src/data/championship/qa-database-hero-portraits.r1.json','utf8'));
 const manifest=JSON.parse(fs.readFileSync('assets/production/database-handpainted-r1-20261015/manifest.json','utf8'));
 for(const [sp,want] of Object.entries(expected)){const e=databaseHeroPortrait(Number(sp));assert.equal(e.src,want.src);assert.equal(e.sha256,want.sha256);assert.equal(createHash('sha256').update(fs.readFileSync(e.src)).digest('hex'),e.sha256);assert.deepEqual(qa.entries.find(q=>q.speciesIndex===Number(sp)),e);assert.equal(manifest.entries.find(q=>q.speciesIndex===Number(sp)).selectedGenerationVersion,'refined-handpainted-v2');}
 assert.equal(qa.entries.length,56);assert.equal(manifest.count,42);assert.equal(databaseHeroPortrait(67).speciesId,'species-067');
});

test('new053054055057 heroes preserve exact identity and discovery privacy across five locales',()=>{
 try {for(const sp of [53, 54, 55, 57])for(const locale of locales)for(const registered of [true,false]){
  const f=makeView({locale,selectedSpeciesIndex:sp,registeredSpecies:registered?[sp]:[],collection:[]});
  try {const holder=f.root.querySelector('.cm-dex-hero'),art=databaseHeroPortrait(sp),identity=getDatabaseDisplayEntry(sp);
   assert.equal(art.speciesId,identity.speciesId);assert.equal(art.displayCode,identity.displayCode);
   if(!registered){assert.equal(holder,null);assert.equal(f.root.querySelector('.cm-dex-profile'),null);assert.equal(f.root.querySelector('.cm-dex-data'),null);}
   else {assert.ok(holder);const img=holder.querySelector('img');assert.equal(img.src,art.src);assert.equal(art.width,1254);assert.equal(art.height,1254);assert.ok(img.hidden);assert.equal(f.root.querySelector('.cm-dex-profile__text').textContent,databaseStory(sp,locale));assert.ok(f.root.querySelector('.cm-dex-data'));img.naturalWidth=1254;img.naturalHeight=1254;img.onload();assert.equal(img.hidden,false);assert.equal(holder.dataset.art,'ready');}
   f.assertUnchanged();
  }finally{f.dispose();}
 }}finally{setLocale('zh-Hant');}
});


test('new four portraits preserve exact source identity hashes and aggregate bundle counts',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');const expected={"53": {"speciesIndex": 53, "speciesId": "species-053", "displayCode": "GR27", "src": "assets/production/database-handpainted-r1-20261015/species-053.a07a52ab7f1501c4.png", "width": 1254, "height": 1254, "sha256": "a07a52ab7f1501c40b283d43af35a2f0b07294c42541dd89c72e8dbbca366716", "styleBatch": "HANDPAINTED_R1_20261015"}, "54": {"speciesIndex": 54, "speciesId": "species-054", "displayCode": "GR28", "src": "assets/production/database-handpainted-r1-20261015/species-054.653364ea2b2dbdd5.png", "width": 1254, "height": 1254, "sha256": "653364ea2b2dbdd50e3edd100da021ab1cafe2208fe1d61103bca445177fda41", "styleBatch": "HANDPAINTED_R1_20261015"}, "55": {"speciesIndex": 55, "speciesId": "species-055", "displayCode": "GR29", "src": "assets/production/database-handpainted-r1-20261015/species-055.32e6689b5e9669c2.png", "width": 1254, "height": 1254, "sha256": "32e6689b5e9669c26fb0d29f3201ace2d5d619309381ab628d57f5eabc5d693e", "styleBatch": "HANDPAINTED_R1_20261015"}, "57": {"speciesIndex": 57, "speciesId": "species-057", "displayCode": "GR31", "src": "assets/production/database-handpainted-r1-20261015/species-057.001820f22618bab0.png", "width": 1254, "height": 1254, "sha256": "001820f22618bab0360081efbc760ef15bc99969c39c5bb4c67a47c86b234295", "styleBatch": "HANDPAINTED_R1_20261015"}},sourceExpected={"53": {"entityId": "m227_patamon", "sha256": "cdfff373ba4da42f0613d4697b9b2497c6166655a3b26f1c761ff9c017b3dace", "version": "v1"}, "54": {"entityId": "m228_palmon", "sha256": "fc6352be976133caaccba24f17695e8f2f9d0e7d4617f095fe6a4f81ad8b4304", "version": "refined-handpainted-v2"}, "55": {"entityId": "m229_picodevimon", "sha256": "75dd64319017670b23fbc6687378f84bbf0f3074e29e4adab93e3e1ece31eb47", "version": "v2"}, "57": {"entityId": "m231_falcomon", "sha256": "283d2bdfdfaec25a538140e48f1431d5ed2c47f1f362aa128e4b565d34fb1fd4", "version": "v1"}};
 const manifest=JSON.parse(fs.readFileSync('assets/production/database-handpainted-r1-20261015/manifest.json','utf8'));
 const index=JSON.parse(fs.readFileSync('assets/production/ART_PRODUCTION_INDEX.json','utf8'));
 const bundles=Object.values(index).filter(Array.isArray).flat().filter(e=>e?.assetId==='art:database:handpainted:r1');assert.equal(bundles.length,1);assert.equal(bundles[0].count,42);assert.equal(bundles[0].maturity,'42_SOURCE_GUIDED_HANDPAINTED_TRANSPARENT_HEROES');assert.equal(bundles[0].shippingReady,false);
 assert.equal(manifest.entries.length,42);assert.equal(manifest.count,42);
 for(const [sp,want] of Object.entries(expected)){const e=databaseHeroPortrait(Number(sp));assert.deepEqual(e,want);const b=fs.readFileSync(e.src);assert.equal(createHash('sha256').update(b).digest('hex'),e.sha256);assert.equal(b.readUInt32BE(16),1254);assert.equal(b.readUInt32BE(20),1254);const m=manifest.entries.find(m=>m.speciesIndex===Number(sp));assert.equal(m.sha256,e.sha256);assert.equal(m.sourceEntityId,sourceExpected[sp].entityId);assert.equal(m.sourceReferenceSha256,sourceExpected[sp].sha256);assert.equal(m.selectedGenerationVersion,sourceExpected[sp].version);}
 assert.equal(databaseHeroPortrait(229),null);assert.equal(databaseHeroPortrait(230),null);assert.equal(databaseHeroPortrait(67).speciesId,'species-067');
});

test('new050051052056 heroes preserve exact identity and discovery privacy across five locales',()=>{
 try {for(const sp of [50, 51, 52, 56])for(const locale of locales)for(const registered of [true,false]){
  const f=makeView({locale,selectedSpeciesIndex:sp,registeredSpecies:registered?[sp]:[],collection:[]});
  try {const holder=f.root.querySelector('.cm-dex-hero'),art=databaseHeroPortrait(sp),identity=getDatabaseDisplayEntry(sp);
   assert.equal(art.speciesId,identity.speciesId);assert.equal(art.displayCode,identity.displayCode);
   if(!registered){assert.equal(holder,null);assert.equal(f.root.querySelector('.cm-dex-profile'),null);assert.equal(f.root.querySelector('.cm-dex-data'),null);}
   else {assert.ok(holder);const img=holder.querySelector('img');assert.equal(img.src,art.src);assert.equal(art.width,1254);assert.equal(art.height,1254);assert.ok(img.hidden);assert.equal(f.root.querySelector('.cm-dex-profile__text').textContent,databaseStory(sp,locale));assert.ok(f.root.querySelector('.cm-dex-data'));img.naturalWidth=1254;img.naturalHeight=1254;img.onload();assert.equal(img.hidden,false);assert.equal(holder.dataset.art,'ready');}
   f.assertUnchanged();
  }finally{f.dispose();}
 }}finally{setLocale('zh-Hant');}
});


test('next four portraits preserve exact source identity hashes and aggregate bundle counts',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');const expected={"50": {"speciesIndex": 50, "speciesId": "species-050", "displayCode": "GR23", "src": "assets/production/database-handpainted-r1-20261015/species-050.4da662245939ae14.png", "width": 1254, "height": 1254, "sha256": "4da662245939ae142d013e9a0a5cea1642438791d94cf1991f68c96e7a7a1b58", "styleBatch": "HANDPAINTED_R1_20261015"}, "51": {"speciesIndex": 51, "speciesId": "species-051", "displayCode": "GR25", "src": "assets/production/database-handpainted-r1-20261015/species-051.4005fcb499a215ca.png", "width": 1254, "height": 1254, "sha256": "4005fcb499a215cae40c0fdd7803bae6091a5a290e33f0bafbad260b70856a24", "styleBatch": "HANDPAINTED_R1_20261015"}, "52": {"speciesIndex": 52, "speciesId": "species-052", "displayCode": "GR26", "src": "assets/production/database-handpainted-r1-20261015/species-052.e2a1ae73e1e1baab.png", "width": 1254, "height": 1254, "sha256": "e2a1ae73e1e1baabf7e131067ba16d1d68f5d63eff48d8689cd5c7d4b2ac4a05", "styleBatch": "HANDPAINTED_R1_20261015"}, "56": {"speciesIndex": 56, "speciesId": "species-056", "displayCode": "GR30", "src": "assets/production/database-handpainted-r1-20261015/species-056.f7c3f093351f4965.png", "width": 1254, "height": 1254, "sha256": "f7c3f093351f49656d23822132c807f06908aad40bfd8c3e8607429424ca7eb5", "styleBatch": "HANDPAINTED_R1_20261015"}},sourceExpected={"50": {"entityId": "m223_toyagumon", "sha256": "802f93e3d0ead75e752fe20e8456c0794eb7928b021066c7cde41fb7832491b1", "version": "v1"}, "51": {"entityId": "m225_bakumon", "sha256": "4c1aa0f7247c622c31195b3e3ff5c03143b8d88f0ce729faceb7f78634576779", "version": "refined-handpainted-v2"}, "52": {"entityId": "m226_hagurumon", "sha256": "d203c58f616c5be7549ed55e4d703b695c92a5cb758bbc5196811738bb689153", "version": "v1"}, "56": {"entityId": "m230_piyomon", "sha256": "67301ec25c237751fb2df64da058d1334c53b91499a1cfef607e264c4560ebec", "version": "v1"}};
 const manifest=JSON.parse(fs.readFileSync('assets/production/database-handpainted-r1-20261015/manifest.json','utf8'));
 const index=JSON.parse(fs.readFileSync('assets/production/ART_PRODUCTION_INDEX.json','utf8'));
 const bundles=Object.values(index).filter(Array.isArray).flat().filter(e=>e?.assetId==='art:database:handpainted:r1');assert.equal(bundles.length,1);assert.equal(bundles[0].count,42);assert.equal(bundles[0].maturity,'42_SOURCE_GUIDED_HANDPAINTED_TRANSPARENT_HEROES');assert.equal(bundles[0].shippingReady,false);
 assert.equal(manifest.entries.length,42);assert.equal(manifest.count,42);
 for(const [sp,want] of Object.entries(expected)){const e=databaseHeroPortrait(Number(sp));assert.deepEqual(e,want);const b=fs.readFileSync(e.src);assert.equal(createHash('sha256').update(b).digest('hex'),e.sha256);assert.equal(b.readUInt32BE(16),1254);assert.equal(b.readUInt32BE(20),1254);const m=manifest.entries.find(m=>m.speciesIndex===Number(sp));assert.equal(m.sha256,e.sha256);assert.equal(m.sourceEntityId,sourceExpected[sp].entityId);assert.equal(m.sourceReferenceSha256,sourceExpected[sp].sha256);assert.equal(m.selectedGenerationVersion,sourceExpected[sp].version);}
 assert.equal(databaseHeroPortrait(229),null);assert.equal(databaseHeroPortrait(230),null);assert.equal(databaseHeroPortrait(67).speciesId,'species-067');
});

test('new058059060061 heroes preserve exact identity and discovery privacy across five locales',()=>{
 try {for(const sp of [58, 59, 60, 61])for(const locale of locales)for(const registered of [true,false]){
  const f=makeView({locale,selectedSpeciesIndex:sp,registeredSpecies:registered?[sp]:[],collection:[]});
  try {const holder=f.root.querySelector('.cm-dex-hero'),art=databaseHeroPortrait(sp),identity=getDatabaseDisplayEntry(sp);
   assert.equal(art.speciesId,identity.speciesId);assert.equal(art.displayCode,identity.displayCode);
   if(!registered){assert.equal(holder,null);assert.equal(f.root.querySelector('.cm-dex-profile'),null);assert.equal(f.root.querySelector('.cm-dex-data'),null);}
   else {assert.ok(holder);const img=holder.querySelector('img');assert.equal(img.src,art.src);assert.equal(art.width,1254);assert.equal(art.height,1254);assert.ok(img.hidden);assert.equal(f.root.querySelector('.cm-dex-profile__text').textContent,databaseStory(sp,locale));assert.ok(f.root.querySelector('.cm-dex-data'));img.naturalWidth=1254;img.naturalHeight=1254;img.onload();assert.equal(img.hidden,false);assert.equal(holder.dataset.art,'ready');}
   f.assertUnchanged();
  }finally{f.dispose();}
 }}finally{setLocale('zh-Hant');}
});


test('058059060061 portraits preserve exact source identity hashes and aggregate bundle counts',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');const expected={"58": {"speciesIndex": 58, "speciesId": "species-058", "displayCode": "GR33", "src": "assets/production/database-handpainted-r1-20261015/species-058.85ac0a27d7121cef.png", "width": 1254, "height": 1254, "sha256": "85ac0a27d7121cef246ba2c911ab452b6bcb97b3284a09edd1ae6cbfcd07d1fc", "styleBatch": "HANDPAINTED_R1_20261015"}, "59": {"speciesIndex": 59, "speciesId": "species-059", "displayCode": "GR34", "src": "assets/production/database-handpainted-r1-20261015/species-059.d808c556efd2a029.png", "width": 1254, "height": 1254, "sha256": "d808c556efd2a0291a3d38973783951c41199bdb779bbff913511afbbefff9d6", "styleBatch": "HANDPAINTED_R1_20261015"}, "60": {"speciesIndex": 60, "speciesId": "species-060", "displayCode": "GR35", "src": "assets/production/database-handpainted-r1-20261015/species-060.7a8efa91b909b615.png", "width": 1254, "height": 1254, "sha256": "7a8efa91b909b615bab9af95cce073d6184a5df830db6c98932c6827d1a1f523", "styleBatch": "HANDPAINTED_R1_20261015"}, "61": {"speciesIndex": 61, "speciesId": "species-061", "displayCode": "GR36", "src": "assets/production/database-handpainted-r1-20261015/species-061.df2dcf13586b2025.png", "width": 1254, "height": 1254, "sha256": "df2dcf13586b20252a75c6b333034bc38f345fdb15fe099f0b826eb60410e112", "styleBatch": "HANDPAINTED_R1_20261015"}},sourceExpected={"58": {"entityId": "m232_plotmon", "sha256": "aa9a60d4cdf5a89d036c6e89f9eba7eb629cf1a2d9661cc79259a3b945919219", "version": "v1"}, "59": {"entityId": "m233_floramon", "sha256": "c82fbd69f60cc9f7245f30a7d34527f191ff92dc6f0436faf18f334761bbc992", "version": "refined-handpainted-v2"}, "60": {"entityId": "m235_mushmon", "sha256": "f4bb09cbbac08483edb09652cd664a07e297257d9b21d7e3ecd58566757f7a07", "version": "v1"}, "61": {"entityId": "m236_yukiagumon", "sha256": "541aed1932ddfec7bec30b1148368b60800ad01443d4d620736ed31381de0926", "version": "v1"}};
 const manifest=JSON.parse(fs.readFileSync('assets/production/database-handpainted-r1-20261015/manifest.json','utf8'));
 const index=JSON.parse(fs.readFileSync('assets/production/ART_PRODUCTION_INDEX.json','utf8'));
 const bundles=Object.values(index).filter(Array.isArray).flat().filter(e=>e?.assetId==='art:database:handpainted:r1');assert.equal(bundles.length,1);assert.equal(bundles[0].count,42);assert.equal(bundles[0].maturity,'42_SOURCE_GUIDED_HANDPAINTED_TRANSPARENT_HEROES');assert.equal(bundles[0].shippingReady,false);
 assert.equal(manifest.entries.length,42);assert.equal(manifest.count,42);
 for(const [sp,want] of Object.entries(expected)){const e=databaseHeroPortrait(Number(sp));assert.deepEqual(e,want);const b=fs.readFileSync(e.src);assert.equal(createHash('sha256').update(b).digest('hex'),e.sha256);assert.equal(b.readUInt32BE(16),1254);assert.equal(b.readUInt32BE(20),1254);const m=manifest.entries.find(m=>m.speciesIndex===Number(sp));assert.equal(m.sha256,e.sha256);assert.equal(m.sourceEntityId,sourceExpected[sp].entityId);assert.equal(m.sourceReferenceSha256,sourceExpected[sp].sha256);assert.equal(m.selectedGenerationVersion,sourceExpected[sp].version);}
 assert.equal(databaseHeroPortrait(229),null);assert.equal(databaseHeroPortrait(230),null);assert.equal(databaseHeroPortrait(67).speciesId,'species-067');
});

test('new062063064065 heroes preserve exact identity and discovery privacy across five locales',()=>{
 try {for(const sp of [62, 63, 64, 65])for(const locale of locales)for(const registered of [true,false]){
  const f=makeView({locale,selectedSpeciesIndex:sp,registeredSpecies:registered?[sp]:[],collection:[]});
  try {const holder=f.root.querySelector('.cm-dex-hero'),art=databaseHeroPortrait(sp),identity=getDatabaseDisplayEntry(sp);
   assert.equal(art.speciesId,identity.speciesId);assert.equal(art.displayCode,identity.displayCode);
   if(!registered){assert.equal(holder,null);assert.equal(f.root.querySelector('.cm-dex-profile'),null);assert.equal(f.root.querySelector('.cm-dex-data'),null);}
   else {assert.ok(holder);const img=holder.querySelector('img');assert.equal(img.src,art.src);assert.equal(art.width,1254);assert.equal(art.height,1254);assert.ok(img.hidden);assert.equal(f.root.querySelector('.cm-dex-profile__text').textContent,databaseStory(sp,locale));assert.ok(f.root.querySelector('.cm-dex-data'));img.naturalWidth=1254;img.naturalHeight=1254;img.onload();assert.equal(img.hidden,false);assert.equal(holder.dataset.art,'ready');}
   f.assertUnchanged();
  }finally{f.dispose();}
 }}finally{setLocale('zh-Hant');}
});


test('062063064065 portraits preserve exact source identity hashes and aggregate bundle counts',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');const expected={"62": {"speciesIndex": 62, "speciesId": "species-062", "displayCode": "GR38", "src": "assets/production/database-handpainted-r1-20261015/species-062.25391107e04095f4.png", "width": 1254, "height": 1254, "sha256": "25391107e04095f4bd706ffc106e6f90d10911d0baca637db3ed2114c9a2ef91", "styleBatch": "HANDPAINTED_R1_20261015"}, "63": {"speciesIndex": 63, "speciesId": "species-063", "displayCode": "GR24", "src": "assets/production/database-handpainted-r1-20261015/species-063.a2403ae4b27f60e1.png", "width": 1254, "height": 1254, "sha256": "a2403ae4b27f60e19dab4e955f4f1dc43a85b7bce7583d0760f0759fada6f8a0", "styleBatch": "HANDPAINTED_R1_20261015"}, "64": {"speciesIndex": 64, "speciesId": "species-064", "displayCode": "GR18", "src": "assets/production/database-handpainted-r1-20261015/species-064.1fd9b11486ee01a1.png", "width": 1254, "height": 1254, "sha256": "1fd9b11486ee01a10e912aff8c0b571f8112a3c6cf9e6ee050d2807897f122b9", "styleBatch": "HANDPAINTED_R1_20261015"}, "65": {"speciesIndex": 65, "speciesId": "species-065", "displayCode": "GR37", "src": "assets/production/database-handpainted-r1-20261015/species-065.297304ab3fa37f43.png", "width": 1254, "height": 1254, "sha256": "297304ab3fa37f43d5f3d07c3b4b7469d83f6d720506c11a4d651da0d7726755", "styleBatch": "HANDPAINTED_R1_20261015"}},sourceExpected={"62": {"entityId": "m237_renamon", "sha256": "75e3101f148ff42f91bfef21b4dc521dbfdc284de74ed2d73ec61b1b3df8397e", "version": "v1"}, "63": {"entityId": "m224_dracomon", "sha256": "8597bfb7d91b9654356a06971b7ac33fe84cb7e34cbbd6ac794800f7ddb256b6", "version": "v1"}, "64": {"entityId": "m238_coronamon", "sha256": "c59b62c8a22970f3da9f77d2aca7277ad1e1bedf57b582501bc8745dc056dcb9", "version": "v1"}, "65": {"entityId": "m239_lunamon", "sha256": "9cfd6b0ce8ef32d1badb51c5542b293c494b986bc6716c30123a12e5e8985517", "version": "v1"}};
 const manifest=JSON.parse(fs.readFileSync('assets/production/database-handpainted-r1-20261015/manifest.json','utf8'));
 const index=JSON.parse(fs.readFileSync('assets/production/ART_PRODUCTION_INDEX.json','utf8'));
 const bundles=Object.values(index).filter(Array.isArray).flat().filter(e=>e?.assetId==='art:database:handpainted:r1');assert.equal(bundles.length,1);assert.equal(bundles[0].count,42);assert.equal(bundles[0].maturity,'42_SOURCE_GUIDED_HANDPAINTED_TRANSPARENT_HEROES');assert.equal(bundles[0].shippingReady,false);
 assert.equal(manifest.entries.length,42);assert.equal(manifest.count,42);
 for(const [sp,want] of Object.entries(expected)){const e=databaseHeroPortrait(Number(sp));assert.deepEqual(e,want);const b=fs.readFileSync(e.src);assert.equal(createHash('sha256').update(b).digest('hex'),e.sha256);assert.equal(b.readUInt32BE(16),1254);assert.equal(b.readUInt32BE(20),1254);const m=manifest.entries.find(m=>m.speciesIndex===Number(sp));assert.equal(m.sha256,e.sha256);assert.equal(m.sourceEntityId,sourceExpected[sp].entityId);assert.equal(m.sourceReferenceSha256,sourceExpected[sp].sha256);assert.equal(m.selectedGenerationVersion,sourceExpected[sp].version);}
 assert.equal(databaseHeroPortrait(229),null);assert.equal(databaseHeroPortrait(230),null);assert.equal(databaseHeroPortrait(67).speciesId,'species-067');
});

test('new066067068069 heroes preserve exact identity and discovery privacy across five locales',()=>{
 try {for(const sp of [66, 67, 68, 69])for(const locale of locales)for(const registered of [true,false]){
  const f=makeView({locale,selectedSpeciesIndex:sp,registeredSpecies:registered?[sp]:[],collection:[]});
  try {const holder=f.root.querySelector('.cm-dex-hero'),art=databaseHeroPortrait(sp),identity=getDatabaseDisplayEntry(sp);
   assert.equal(art.speciesId,identity.speciesId);assert.equal(art.displayCode,identity.displayCode);
   if(!registered){assert.equal(holder,null);assert.equal(f.root.querySelector('.cm-dex-profile'),null);assert.equal(f.root.querySelector('.cm-dex-data'),null);}
   else {assert.ok(holder);const img=holder.querySelector('img');assert.equal(img.src,art.src);assert.equal(art.width,1254);assert.equal(art.height,1254);assert.ok(img.hidden);assert.equal(f.root.querySelector('.cm-dex-profile__text').textContent,databaseStory(sp,locale));assert.ok(f.root.querySelector('.cm-dex-data'));img.naturalWidth=1254;img.naturalHeight=1254;img.onload();assert.equal(img.hidden,false);assert.equal(holder.dataset.art,'ready');}
   f.assertUnchanged();
  }finally{f.dispose();}
 }}finally{setLocale('zh-Hant');}
});


test('066067068069 portraits preserve exact source identity hashes and aggregate bundle counts',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');const expected={"66": {"speciesIndex": 66, "speciesId": "species-066", "displayCode": "GR14", "src": "assets/production/database-handpainted-r1-20261015/species-066.18cfe71dbf919d32.png", "width": 1254, "height": 1254, "sha256": "18cfe71dbf919d323616ec17d05ac6f59edaffac5f5e97548434463bda694e9a", "styleBatch": "HANDPAINTED_R1_20261015"}, "67": {"speciesIndex": 67, "speciesId": "species-067", "displayCode": "GR19", "src": "assets/production/database-handpainted-r1-20261015/species-067.d3b4711e2fef8428.png", "width": 1254, "height": 1254, "sha256": "d3b4711e2fef84288d8f8005760a2c0e9222f5167f3eb37e9ac845cc226d7b41", "styleBatch": "HANDPAINTED_R1_20261015"}, "68": {"speciesIndex": 68, "speciesId": "species-068", "displayCode": "GR03", "src": "assets/production/database-handpainted-r1-20261015/species-068.fd96778e08b01ee7.png", "width": 1254, "height": 1254, "sha256": "fd96778e08b01ee77a8a594ce29485bf0330369885b6b593cb4a8297836da20b", "styleBatch": "HANDPAINTED_R1_20261015"}, "69": {"speciesIndex": 69, "speciesId": "species-069", "displayCode": "GR20", "src": "assets/production/database-handpainted-r1-20261015/species-069.cf92eaf941781156.png", "width": 1254, "height": 1254, "sha256": "cf92eaf9417811567ba46df948bd14fa7ee0f297d3a4662508771ec23a114e5a", "styleBatch": "HANDPAINTED_R1_20261015"}},sourceExpected={"66": {"entityId": "m240_kuroagumon", "sha256": "1d2de42d296a0b49e3c563795cbbb3f248d280d9256ca18c7aa74ccb6b37e853", "version": "v1"}, "67": {"entityId": "m241_psychemon", "sha256": "d928019a84bb07226f866e5a84cf7c850c01b52e537566517125f2d94326469c", "version": "v1"}, "68": {"entityId": "m242_alraumon", "sha256": "e9843b50385e903a588ca9e50189bc81c16b66c4fcaeedbe53d0a302d34bad15", "version": "v2"}, "69": {"entityId": "m243_tsukaimon", "sha256": "921d9f085642ea9e020219a4d7e39b593fcd31aa0f68ed4c050f4cbb6b55d8ec", "version": "v1"}};
 const manifest=JSON.parse(fs.readFileSync('assets/production/database-handpainted-r1-20261015/manifest.json','utf8'));
 const index=JSON.parse(fs.readFileSync('assets/production/ART_PRODUCTION_INDEX.json','utf8'));
 const bundles=Object.values(index).filter(Array.isArray).flat().filter(e=>e?.assetId==='art:database:handpainted:r1');assert.equal(bundles.length,1);assert.equal(bundles[0].count,42);assert.equal(bundles[0].maturity,'42_SOURCE_GUIDED_HANDPAINTED_TRANSPARENT_HEROES');assert.equal(bundles[0].shippingReady,false);
 assert.equal(manifest.entries.length,42);assert.equal(manifest.count,42);
 for(const [sp,want] of Object.entries(expected)){const e=databaseHeroPortrait(Number(sp));assert.deepEqual(e,want);const b=fs.readFileSync(e.src);assert.equal(createHash('sha256').update(b).digest('hex'),e.sha256);assert.equal(b.readUInt32BE(16),1254);assert.equal(b.readUInt32BE(20),1254);const m=manifest.entries.find(m=>m.speciesIndex===Number(sp));assert.equal(m.sha256,e.sha256);assert.equal(m.sourceEntityId,sourceExpected[sp].entityId);assert.equal(m.sourceReferenceSha256,sourceExpected[sp].sha256);assert.equal(m.selectedGenerationVersion,sourceExpected[sp].version);}
 assert.equal(databaseHeroPortrait(229),null);assert.equal(databaseHeroPortrait(230),null);assert.equal(databaseHeroPortrait(67).speciesId,'species-067');
});

test('117 simplified pilot hero preserve exact identity and discovery privacy across five locales',()=>{
 try {for(const sp of [117])for(const locale of locales)for(const registered of [true,false]){
  const f=makeView({locale,selectedSpeciesIndex:sp,registeredSpecies:registered?[sp]:[],collection:[]});
  try {const holder=f.root.querySelector('.cm-dex-hero'),art=databaseHeroPortrait(sp),identity=getDatabaseDisplayEntry(sp);
   assert.equal(art.speciesId,identity.speciesId);assert.equal(art.displayCode,identity.displayCode);
   if(!registered){assert.equal(holder,null);assert.equal(f.root.querySelector('.cm-dex-profile'),null);assert.equal(f.root.querySelector('.cm-dex-data'),null);}
   else {assert.ok(holder);const img=holder.querySelector('img');assert.equal(img.src,art.src);assert.equal(art.width,1254);assert.equal(art.height,1254);assert.ok(img.hidden);assert.equal(f.root.querySelector('.cm-dex-profile__text').textContent,databaseStory(sp,locale));assert.ok(f.root.querySelector('.cm-dex-data'));img.naturalWidth=1254;img.naturalHeight=1254;img.onload();assert.equal(img.hidden,false);assert.equal(holder.dataset.art,'ready');}
   f.assertUnchanged();
  }finally{f.dispose();}
 }}finally{setLocale('zh-Hant');}
});


test('117 simplified pilot is exact source-guided PNG and preserves all existing identities',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');const expected={"speciesIndex": 117, "speciesId": "species-117", "displayCode": "MA58", "src": "assets/production/database-handpainted-r1-20261015/species-117.8f7d027cdbf6d3e6.png", "width": 1254, "height": 1254, "sha256": "8f7d027cdbf6d3e6d57dbe2f9cb091e42687c01170d1f3ef58ba0413e504a681", "styleBatch": "HANDPAINTED_R1_20261015"};
 const manifest=JSON.parse(fs.readFileSync('assets/production/database-handpainted-r1-20261015/manifest.json','utf8'));
 const index=JSON.parse(fs.readFileSync('assets/production/ART_PRODUCTION_INDEX.json','utf8'));
 const bundles=Object.values(index).filter(Array.isArray).flat().filter(e=>e?.assetId==='art:database:handpainted:r1');assert.equal(bundles.length,1);assert.equal(bundles[0].count,42);assert.equal(bundles[0].maturity,'42_SOURCE_GUIDED_HANDPAINTED_TRANSPARENT_HEROES');assert.equal(bundles[0].shippingReady,false);
 assert.equal(manifest.count,42);assert.equal(manifest.entries.length,42);
 const e=databaseHeroPortrait(117);assert.deepEqual(e,expected);const b=fs.readFileSync(e.src);assert.equal(createHash('sha256').update(b).digest('hex'),e.sha256);assert.equal(b.readUInt32BE(16),1254);assert.equal(b.readUInt32BE(20),1254);assert.equal(b[25],6);
 const m=manifest.entries.find(x=>x.speciesIndex===117);assert.equal(m.sha256,e.sha256);assert.equal(m.sourceEntityId,'m357_unimon');assert.equal(m.sourceReferenceSha256,'8372366d49ae17a40a39326b0e84a1f3a474b5d67c9b639a799e0ebcaaf3ce50');assert.equal(m.selectedGenerationVersion,'simplified-v2');assert.equal(m.review.rootReview,'SCOPED_HOSTED_VISUAL_PASS');assert.equal(m.review.runtimeBrowser,'PASS_NORMAL_DEX_128_256_LIGHT_DARK_RESPONSIVE');assert.equal(m.review.hostedEvidence.candidateHead,'52978fc360df8abb22c0e29dbb7961b27e9cd8f6');assert.equal(m.review.hostedEvidence.artifactId,11983920742);assert.equal(m.review.hostedEvidence.testedImageSha256,e.sha256);assert.match(m.review.comparisonCaveat,/does not validate the whole roster/);assert.match(m.review.rootReviewScope,/not an all-roster, action-art or three-view acceptance/);
 assert.equal(databaseHeroPortrait(229),null);assert.equal(databaseHeroPortrait(230),null);for(const sp of [73,74,75,76,77])assert.equal(databaseHeroPortrait(sp),null);
 assert.equal(getDatabaseDisplayEntry(117).displayCode,'MA58');assert.equal(databaseHeroPortrait(55).speciesId,'species-055');
});

test('070071072 hosted candidates preserve exact identity and discovery privacy across five locales',()=>{
 try {for(const sp of [70,71,72])for(const locale of locales)for(const registered of [true,false]){
  const f=makeView({locale,selectedSpeciesIndex:sp,registeredSpecies:registered?[sp]:[],collection:[]});
  try {const holder=f.root.querySelector('.cm-dex-hero'),art=databaseHeroPortrait(sp),identity=getDatabaseDisplayEntry(sp);
   assert.equal(art.speciesId,identity.speciesId);assert.equal(art.displayCode,identity.displayCode);
   if(!registered){assert.equal(holder,null);assert.equal(f.root.querySelector('.cm-dex-profile'),null);assert.equal(f.root.querySelector('.cm-dex-data'),null);}
   else {assert.ok(holder);const img=holder.querySelector('img');assert.equal(img.src,art.src);assert.equal(art.width,1254);assert.equal(art.height,1254);assert.ok(img.hidden);assert.equal(f.root.querySelector('.cm-dex-profile__text').textContent,databaseStory(sp,locale));assert.ok(f.root.querySelector('.cm-dex-data'));img.naturalWidth=1254;img.naturalHeight=1254;img.onload();assert.equal(img.hidden,false);assert.equal(holder.dataset.art,'ready');}
   f.assertUnchanged();
  }finally{f.dispose();}
 }}finally{setLocale('zh-Hant');}
});



test('070071072 scoped heroes preserve all51 baseline entries and exact hosted visual approval',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');
 const hash=b=>createHash('sha256').update(b).digest('hex');
 const registry=JSON.parse(fs.readFileSync('src/data/championship/database-hero-portraits.r1.json','utf8'));
 const manifest=JSON.parse(fs.readFileSync('assets/production/database-handpainted-r1-20261015/manifest.json','utf8'));
 const expected=[{"speciesIndex": 70, "speciesId": "species-070", "displayCode": "GR32", "src": "assets/production/database-handpainted-r1-20261015/species-070.8b5455d530173b0f.png", "width": 1254, "height": 1254, "sha256": "8b5455d530173b0fe41963b58637e98143f90e68a5961d9997517f2148520eba", "styleBatch": "HANDPAINTED_R1_20261015"}, {"speciesIndex": 71, "speciesId": "species-071", "displayCode": "GR12", "src": "assets/production/database-handpainted-r1-20261015/species-071.cd9ee93854a452cc.png", "width": 1254, "height": 1254, "sha256": "cd9ee93854a452cc2b5a253ee35d5d57651d5474292ae8af7422331f0379e913", "styleBatch": "HANDPAINTED_R1_20261015"}, {"speciesIndex": 72, "speciesId": "species-072", "displayCode": "MA04", "src": "assets/production/database-handpainted-r1-20261015/species-072.4ca0e10b98584a76.png", "width": 1254, "height": 1254, "sha256": "4ca0e10b98584a76aec0c283b6c5628d34122bd7d60aa63411c7cc2156bfca43", "styleBatch": "HANDPAINTED_R1_20261015"}], sources={"70": {"entity": "m244_vmon", "source": "312cedec215aac952303f51805380bc2daf6641d56fa26f6918f2cac1b8f6494", "prompt": "1c26155ffaf10dbadda78dc380ea6053d5e654de53ef4603d61f4da025ce9ff7", "version": "refined-v1"}, "71": {"entity": "m255_guilmon", "source": "02749ee1c31367c0344ca76edf72c51e81742a0d3637e7c343b278ec73d50e2f", "prompt": "c523f648187a01bcc616ac0ef71308c2e191aab74aa2d919f2e79fdc149e6504", "version": "refined-v1"}, "72": {"entity": "m301_ankylomon", "source": "cc71a01d0adaf456552b7a04f1371cff442e151375d1aabbeeb2446f27f3d898", "prompt": "ee4cc541afb63792259972a4bb19e28ad65cbfc5d771544c8fd01e28d987e179", "version": "simplified-v3"}};
 assert.equal(registry.entries.length,54);assert.equal(manifest.count,42);assert.equal(manifest.entries.length,42);
 assert.equal(hash(JSON.stringify(registry.entries.slice(0,51))),'cd019b2e72704990f65e5ad20d13cddb81345ec2bada7f98bbce42f7bb4e81af');
 assert.deepEqual(registry.entries.slice(51),expected);
 for(const e of expected){assert.deepEqual(databaseHeroPortrait(e.speciesIndex),e);const raw=fs.readFileSync(e.src);assert.equal(hash(raw),e.sha256);assert.equal(raw.readUInt32BE(16),1254);assert.equal(raw.readUInt32BE(20),1254);assert.equal(raw[25],6);
  const m=manifest.entries.find(x=>x.speciesIndex===e.speciesIndex),s=sources[e.speciesIndex];assert.equal(m.sourceEntityId,s.entity);assert.equal(m.sourceReferenceSha256,s.source);assert.equal(m.promptSha256,s.prompt);assert.equal(m.selectedGenerationVersion,s.version);
  assert.equal(m.review.rootReview,'SCOPED_HOSTED_VISUAL_PASS');assert.equal(m.review.runtimeBrowser,'PASS_NORMAL_DEX_128_256_LIGHT_DARK_RESPONSIVE');assert.match(m.review.runtimeContainPadding,/24px/);assert.equal(m.review.hostedEvidence.candidateHead,'344010354799c2a6da0c794d7b74de768c6e7cc1');assert.equal(m.review.hostedEvidence.artifactId,11991000289);assert.equal(m.review.hostedEvidence.testedImageSha256,e.sha256);assert.equal(m.review.hostedEvidence.capturePairCount,33);assert.equal(m.review.hostedEvidence.friendsStatus,'PASS');assert.match(m.review.rootReviewScope,/Not an all-roster/);assert.match(m.review.nativeMarginCaveat,/margin/i);
 }
 for(const sp of [73,74,75,76,77,229,230])assert.equal(databaseHeroPortrait(sp),null);
 assert.equal(databaseHeroPortrait(117).sha256,'8f7d027cdbf6d3e6d57dbe2f9cb091e42687c01170d1f3ef58ba0413e504a681');
});

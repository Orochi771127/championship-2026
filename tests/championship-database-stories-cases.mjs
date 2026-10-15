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

test('30 hero assets join stable IDs and selected file hashes, with no animation/HUD replacement',async()=>{
 const {DATABASE_HERO_PORTRAITS:art,databaseHeroPortrait:get}=await import('../src/championship/presentation/databaseHeroPortraits.js');
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');assert.equal(art.entries.length,30);
 for(const e of art.entries){const id=getDatabaseDisplayEntry(e.speciesIndex);assert.equal(e.speciesId,id.speciesId);assert.equal(e.displayCode,id.displayCode);assert.ok(Object.isFrozen(e));assert.match(e.src,/^assets\/production\/(?:database-portraits-b1-20261014\/B1\d{2}\.webp|database-handpainted-r1-20261015\/species-(?:034|035|037|038|039|040|041|042|043|044|045|046|047|048|049|211|215|222)\.png|database-handpainted-r1-20261015\/species-046\.ed04f491cd22524e\.png|database-handpainted-r1-20261015\/species-042\.d5dcc1491759eea7\.png|database-handpainted-r1-20261015\/species-041\.679bfc5abc699a5e\.png|database-handpainted-r1-20261015\/species-049\.376bd37739caf2ad\.png)$/);assert.equal(createHash('sha256').update(fs.readFileSync(e.src)).digest('hex'),e.sha256);assert.ok(e.width>0&&e.height>0);}
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
 assert.equal(art.entries.length,30);assert.equal(manifest.count,18);
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
 for(const [sp,version] of [[45,'v1'],[46,'refined-handpainted-v2'],[47,'v1'],[49,'refined-handpainted-v2']]){
  const entry=databaseHeroPortrait(sp),metadata=manifest.entries.find(e=>e.speciesIndex===sp);assert.ok(entry);assert.equal(metadata.selectedGenerationVersion,version);assert.equal(createHash('sha256').update(fs.readFileSync(entry.src)).digest('hex'),entry.sha256);assert.equal(metadata.sha256,entry.sha256);assert.equal(metadata.review.rootReview,'PASSED');
 }
 assert.equal(databaseHeroPortrait(229),null);assert.equal(databaseHeroPortrait(230),null);
});


test('046 refined portrait uses immutable content-addressed PNG without widening registry scope',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');
 const art=databaseHeroPortrait(46),qa=JSON.parse(fs.readFileSync('src/data/championship/qa-database-hero-portraits.r1.json','utf8'));
 assert.equal(art.src,'assets/production/database-handpainted-r1-20261015/species-046.ed04f491cd22524e.png');assert.equal(art.sha256,'ed04f491cd22524e5afd9ed106318c64f3def1f789f9acde7bcf66629b555362');
 assert.equal(createHash('sha256').update(fs.readFileSync(art.src)).digest('hex'),art.sha256);
 assert.deepEqual(qa.entries.find(e=>e.speciesIndex===46),art);assert.equal(qa.entries.length,32);
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
 assert.equal(databaseHeroPortrait(47).src,'assets/production/database-handpainted-r1-20261015/species-047.png');assert.equal(databaseHeroPortrait(67),null);
});

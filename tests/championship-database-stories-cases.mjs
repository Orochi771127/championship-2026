import approvedMasters from '../src/data/championship/database-hero-portraits.r1.json' with {type:'json'};
const approvedHeroPortrait=id=>approvedMasters.entries.find(e=>e.speciesIndex===id)??null;

// Approval/version tests below retain their original master-byte assertions.
// UI assertions use databaseHeroPortrait's selected display rendition instead.
import {databaseHeroPortrait} from '../src/championship/presentation/databaseHeroPortraits.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import {DATABASE_ORIGINAL_PROFILES as catalog,databaseStory,databaseStoryHeading,databaseVerifiedData,databaseVerifiedHeading} from '../src/championship/database/databaseStories.js';
import nativeDisplay from '../src/data/championship/database-display.r1.json' with {type:'json'};
import {getProductExtension} from '../src/championship/contracts/productSpeciesExtensions.js';
// Archived metadata is not persistent identity or the live display sequence.
const originalOrProductIdentity=index=>[121,125].includes(index)?getDatabaseDisplayEntry(index):nativeDisplay.entries.find(e=>e.speciesIndex===index)??(getProductExtension(index)?{speciesId:getProductExtension(index).speciesId,displayCode:'UL'+String(getProductExtension(index).displaySerial).padStart(2,'0')}:null);
import {getDatabaseDisplayEntry} from '../src/championship/database/databaseDisplayCatalog.js';
import {setLocale} from '../src/championship/text/locale.js';
import {makeView} from './helpers/dex-conditions-ui-fixture.mjs';
const locales=['zh-Hant','en','ja','th','vi'];
// Runtime portraits have a closed display schema; style/QA bookkeeping stays in the original catalogs.
const critical=({styleBatch,...value})=>value;
import publicHeroes from '../src/data/championship/database-hero-portraits.public.v1.json' with {type:'json'};
import replacement215 from '../docs/art/production/characters/approved-dex-215-20261018/manifest.json' with {type:'json'};
// Preserve historical approvals by comparing their superseded rows; latest bindings have independent tests.
const historicalPublicRows=entries=>entries.map(e=>replacement215.supersededEntries.find(old=>old.speciesIndex===e.speciesIndex)??e);
import previousHeroRows from './fixtures/authoring-heroes-a0944833.json' with {type:'json'};
const historicalEntries=(file,entries)=>previousHeroRows[file]?previousHeroRows[file].map(old=>entries.find(row=>row.speciesIndex===old.speciesIndex)):entries;
import previousLionProfiles from './fixtures/database-lion-profiles-before-20261017.json' with {type:'json'};
import unarmedStoryBefore from './fixtures/dex-unarmed-stories-before-20261018.json' with {type:'json'};
const historicalLionProfile=entry=>unarmedStoryBefore.entries.find(old=>old.speciesIndex===entry.speciesIndex)??previousLionProfiles.find(old=>old.speciesIndex===entry.speciesIndex)??entry;

test('077 and078 keep approved unarmed identities and avoid unverified wing counts in five locales',()=>{
 const forbidden={
  'zh-Hant':/法杖|權杖|棍棒|狼牙棒|六翼|六隻翅膀/,
  en:/\bstaff\b|\bscepter\b|\bsceptre\b|\bclub\b|six[- ]wing/i,
  ja:/杖|棍棒|六枚|六翼/,
  th:/คทา|กระบอง|หกปีก|ปีกทั้งหก/,
  vi:/quyền trượng|gậy|chùy|sáu cánh/i
 };
 for(const id of [77,78]){
  const old=unarmedStoryBefore.entries.find(e=>e.speciesIndex===id);
  const current=catalog.entries.find(e=>e.speciesIndex===id);
  assert.deepEqual({...current,textByLocale:old.textByLocale},old);
  assert.ok(databaseHeroPortrait(id)?.thumbnail);
  for(const locale of locales){
   const prose=databaseStory(id,locale);
   assert.notEqual(prose,old.textByLocale[locale]);
   assert.doesNotMatch(prose,forbidden[locale]);
   const f=makeView({locale,selectedSpeciesIndex:id,registeredSpecies:[id],collection:[]});
   try{assert.equal(f.root.querySelector('.cm-dex-profile__text').textContent,prose);f.assertUnchanged();}finally{f.dispose();}
  }
 }
 setLocale('zh-Hant');
});
test('216 immutable original profiles join exact display identities with five complete locales',()=>{
 assert.equal(catalog.entries.length,216);assert.ok(Object.isFrozen(catalog));
 assert.equal(new Set(catalog.entries.map(e=>e.speciesIndex)).size,216);
 for(const e of catalog.entries){
  const id=originalOrProductIdentity(e.speciesIndex);
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

test('110 selected display-size hero assets join stable IDs and selected file hashes, with no animation/HUD replacement',async()=>{
 const {DATABASE_HERO_PORTRAITS:art,databaseHeroPortrait:get}=await import('../src/championship/presentation/databaseHeroPortraits.js');
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');assert.equal(art.entries.length,110);
 for(const e of art.entries){const id=[189,206,207,208,209,210,212,213,214,215,216,217,218,219,220,221,223].includes(e.speciesIndex)?getDatabaseDisplayEntry(e.speciesIndex):originalOrProductIdentity(e.speciesIndex);assert.equal(e.speciesId,id.speciesId);assert.equal(e.displayCode,id.displayCode);assert.ok(Object.isFrozen(e));assert.match(e.src,/^assets\/production\/database-display-20261018\/species-\d{3}\.display\.[a-f0-9]{16}\.webp$/);assert.equal(createHash('sha256').update(fs.readFileSync(e.src)).digest('hex'),e.sha256);assert.ok(e.width>0&&e.height>0);}
 for(const id of [0,20,195,'8',NaN])assert.equal(get(id),null);
});

test('registered list cards use only lazy small thumbnails, with display art selected on opening detail',()=>{
 const f=makeView({selectedSpeciesIndex:null,registeredSpecies:[28],collection:[]});
 try{
  const row=f.root.querySelector('[data-species-index="28"]'),small=row.querySelector('.cm-dex-list-thumb');
  assert.equal(small.src,databaseHeroPortrait(28).thumbnail.src);assert.equal(small.getAttribute('loading'),'lazy');assert.equal(small.width,32);
  assert.equal(f.root.querySelector('[data-species-index="29"]').querySelector('.cm-dex-list-thumb'),null);
  assert.equal(f.root.querySelector('.cm-dex-hero'),null);
  f.select(28);assert.equal(f.root.querySelector('.cm-dex-hero__image').src,databaseHeroPortrait(28).src);f.assertUnchanged();
 }finally{f.dispose();}
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
  const second=f.root.querySelector('.cm-dex-hero__image');assert.notEqual(first,second);assert.equal(second.src,databaseHeroPortrait(9).src);
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
   else {assert.ok(holder);const img=holder.querySelector('img');assert.equal(img.src,art.src);assert.equal(approvedHeroPortrait(sp).width,1254);assert.equal(approvedHeroPortrait(sp).height,1254);assert.ok(img.hidden);img.naturalWidth=art.width;img.naturalHeight=art.height;img.onload();assert.equal(img.hidden,false);assert.equal(holder.dataset.art,'ready');}
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
   else {assert.ok(holder);const img=holder.querySelector('img');assert.equal(img.src,art.src);assert.equal(approvedHeroPortrait(sp).width,sp===35?1536:1254);assert.equal(approvedHeroPortrait(sp).height,sp===35?1024:1254);assert.ok(img.hidden);assert.equal(f.root.querySelector('.cm-dex-profile__text').textContent,databaseStory(sp,locale));assert.ok(f.root.querySelector('.cm-dex-data'));img.naturalWidth=art.width;img.naturalHeight=art.height;img.onload();assert.equal(img.hidden,false);assert.equal(holder.dataset.art,'ready');}
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
   else {assert.ok(holder);const img=holder.querySelector('img');assert.equal(img.src,art.src);assert.equal(approvedHeroPortrait(sp).width,1254);assert.equal(approvedHeroPortrait(sp).height,1254);assert.ok(img.hidden);assert.equal(f.root.querySelector('.cm-dex-profile__text').textContent,databaseStory(sp,locale));assert.ok(f.root.querySelector('.cm-dex-data'));img.naturalWidth=art.width;img.naturalHeight=art.height;img.onload();assert.equal(img.hidden,false);assert.equal(holder.dataset.art,'ready');}
   f.assertUnchanged();
  }finally{f.dispose();}
 }}finally{setLocale('zh-Hant');}
});

test('confirmed ultimate heroes are present with exact PNG bytes and selected source versions',async()=>{
 const {DATABASE_HERO_PORTRAITS:art}=await import('../src/championship/presentation/databaseHeroPortraits.js');
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');
 const manifest=JSON.parse(fs.readFileSync('assets/production/database-handpainted-r1-20261015/manifest.json','utf8'));
 assert.equal(art.entries.length,110);assert.equal(manifest.count,44);
 for(const [sp,version,form] of [[211,'v1','OWNER_CONFIRMED_BRASS_CROWN_MANDRILL'],[222,'v2','R10_QUADRUPED_LEFT_PANEL']]){
  const entry=approvedHeroPortrait(sp),metadata=manifest.entries.find(e=>e.speciesIndex===sp);assert.ok(entry);assert.equal(metadata.selectedGenerationVersion,version);assert.equal(metadata.selectedSourceForm,form);assert.equal(createHash('sha256').update(fs.readFileSync(entry.src)).digest('hex'),entry.sha256);assert.equal(metadata.sha256,entry.sha256);assert.equal(metadata.review.rootReview,'PASSED');
 }
});


test('batch six existing rookie heroes preserve exact identity and discovery privacy across five locales',()=>{
 try {for(const sp of [41, 42, 43, 44])for(const locale of locales)for(const registered of [true,false]){
  const f=makeView({locale,selectedSpeciesIndex:sp,registeredSpecies:registered?[sp]:[],collection:[]});
  try {const holder=f.root.querySelector('.cm-dex-hero'),art=databaseHeroPortrait(sp),identity=getDatabaseDisplayEntry(sp);
   assert.equal(art.speciesId,identity.speciesId);assert.equal(art.displayCode,identity.displayCode);
   if(!registered){assert.equal(holder,null);assert.equal(f.root.querySelector('.cm-dex-profile'),null);assert.equal(f.root.querySelector('.cm-dex-data'),null);}
   else {assert.ok(holder);const img=holder.querySelector('img');assert.equal(img.src,art.src);assert.equal(approvedHeroPortrait(sp).width,1254);assert.equal(approvedHeroPortrait(sp).height,1254);assert.ok(img.hidden);assert.equal(f.root.querySelector('.cm-dex-profile__text').textContent,databaseStory(sp,locale));assert.ok(f.root.querySelector('.cm-dex-data'));img.naturalWidth=art.width;img.naturalHeight=art.height;img.onload();assert.equal(img.hidden,false);assert.equal(holder.dataset.art,'ready');}
   f.assertUnchanged();
  }finally{f.dispose();}
 }}finally{setLocale('zh-Hant');}
});

test('batch six PNG hashes and accepted versions join existing stable identities',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');
 const manifest=JSON.parse(fs.readFileSync('assets/production/database-handpainted-r1-20261015/manifest.json','utf8'));
 for(const [sp,version] of [[41,'refined-handpainted-v2'],[42,'refined-handpainted-v2'],[43,'v1'],[44,'v1']]){
  const entry=approvedHeroPortrait(sp),metadata=manifest.entries.find(e=>e.speciesIndex===sp);assert.ok(entry);assert.equal(metadata.selectedGenerationVersion,version);assert.equal(createHash('sha256').update(fs.readFileSync(entry.src)).digest('hex'),entry.sha256);assert.equal(metadata.sha256,entry.sha256);assert.equal(metadata.review.rootReview,'PASSED');
 }
 for(const id of [229,230]){assert.equal(approvedHeroPortrait(id).speciesIndex,id);assert.equal(getProductExtension(id).runtimeReady,true);assert.equal(getProductExtension(id).evolutionReady,true);assert.equal(getDatabaseDisplayEntry(id).speciesId,`species-${id}`);assert.equal(getDatabaseDisplayEntry(id).displayCode,id===229?'UL34':'UL03');}
});

test('batch seven existing rookie heroes preserve exact identity and discovery privacy across five locales',()=>{
 try {for(const sp of [45, 46, 47, 49])for(const locale of locales)for(const registered of [true,false]){
  const f=makeView({locale,selectedSpeciesIndex:sp,registeredSpecies:registered?[sp]:[],collection:[]});
  try {const holder=f.root.querySelector('.cm-dex-hero'),art=databaseHeroPortrait(sp),identity=getDatabaseDisplayEntry(sp);
   assert.equal(art.speciesId,identity.speciesId);assert.equal(art.displayCode,identity.displayCode);
   if(!registered){assert.equal(holder,null);assert.equal(f.root.querySelector('.cm-dex-profile'),null);assert.equal(f.root.querySelector('.cm-dex-data'),null);}
   else {assert.ok(holder);const img=holder.querySelector('img');assert.equal(img.src,art.src);assert.equal(approvedHeroPortrait(sp).width,1254);assert.equal(approvedHeroPortrait(sp).height,1254);assert.ok(img.hidden);assert.equal(f.root.querySelector('.cm-dex-profile__text').textContent,databaseStory(sp,locale));assert.ok(f.root.querySelector('.cm-dex-data'));img.naturalWidth=art.width;img.naturalHeight=art.height;img.onload();assert.equal(img.hidden,false);assert.equal(holder.dataset.art,'ready');}
   f.assertUnchanged();
  }finally{f.dispose();}
 }}finally{setLocale('zh-Hant');}
});

test('batch seven PNG hashes and accepted versions join existing stable identities',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');
 const manifest=JSON.parse(fs.readFileSync('assets/production/database-handpainted-r1-20261015/manifest.json','utf8'));
 for(const [sp,version] of [[45,'refined-handpainted-v2'],[46,'refined-handpainted-v2'],[47,'v1'],[49,'refined-handpainted-v2']]){
  const entry=approvedHeroPortrait(sp),metadata=manifest.entries.find(e=>e.speciesIndex===sp);assert.ok(entry);assert.equal(metadata.selectedGenerationVersion,version);assert.equal(createHash('sha256').update(fs.readFileSync(entry.src)).digest('hex'),entry.sha256);assert.equal(metadata.sha256,entry.sha256);assert.equal(metadata.review.rootReview,'PASSED');
 }
 for(const id of [229,230]){assert.equal(approvedHeroPortrait(id).speciesIndex,id);assert.equal(getProductExtension(id).runtimeReady,true);assert.equal(getProductExtension(id).evolutionReady,true);assert.equal(getDatabaseDisplayEntry(id).speciesId,`species-${id}`);assert.equal(getDatabaseDisplayEntry(id).displayCode,id===229?'UL34':'UL03');}
});


test('046 refined portrait uses immutable content-addressed PNG without widening registry scope',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');
 const art=approvedHeroPortrait(46),qa=JSON.parse(fs.readFileSync('src/data/championship/qa-database-hero-portraits.r1.json','utf8'));
 assert.equal(art.src,'assets/production/database-handpainted-r1-20261015/species-046.ed04f491cd22524e.png');assert.equal(art.sha256,'ed04f491cd22524e5afd9ed106318c64f3def1f789f9acde7bcf66629b555362');
 assert.equal(createHash('sha256').update(fs.readFileSync(art.src)).digest('hex'),art.sha256);
 assert.deepEqual(critical(qa.entries.find(e=>e.speciesIndex===46)),critical(art));assert.equal(qa.entries.length,95);
 assert.equal(approvedHeroPortrait(42).sha256,'d5dcc1491759eea7e2f02aeb4ae819997df7a67c9a50c019f3666c6da625feb4');
 for(const id of [229,230]){assert.equal(approvedHeroPortrait(id).speciesIndex,id);assert.equal(getProductExtension(id).runtimeReady,true);assert.equal(getProductExtension(id).evolutionReady,true);assert.equal(getDatabaseDisplayEntry(id).speciesId,`species-${id}`);assert.equal(getDatabaseDisplayEntry(id).displayCode,id===229?'UL34':'UL03');}
});

test('042 refined image joins QA and immutable filename with unchanged identity',()=>{
 const art=approvedHeroPortrait(42);assert.equal(art.src,'assets/production/database-handpainted-r1-20261015/species-042.d5dcc1491759eea7.png');assert.equal(art.sha256,'d5dcc1491759eea7e2f02aeb4ae819997df7a67c9a50c019f3666c6da625feb4');assert.equal(art.speciesId,'species-042');assert.equal(art.displayCode,'GR10');
});

test('041 refined hero preserves042/046 cache keys and stable identity',()=>{
 const a=approvedHeroPortrait(41);assert.equal(a.src,'assets/production/database-handpainted-r1-20261015/species-041.679bfc5abc699a5e.png');assert.equal(a.sha256,'679bfc5abc699a5e8795443ed2cf1117087fdf8138fbcbbe5d651731b09e4a29');assert.equal(a.speciesId,'species-041');assert.equal(a.displayCode,'GR09');
 assert.equal(approvedHeroPortrait(42).src,'assets/production/database-handpainted-r1-20261015/species-042.d5dcc1491759eea7.png');
 assert.equal(approvedHeroPortrait(46).src,'assets/production/database-handpainted-r1-20261015/species-046.ed04f491cd22524e.png');
});

test('049 refined hero has immutable cache key without replacing other identities',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');const a=approvedHeroPortrait(49);
 assert.equal(a.speciesId,'species-049');assert.equal(a.displayCode,'GR22');assert.equal(a.src,'assets/production/database-handpainted-r1-20261015/species-049.376bd37739caf2ad.png');assert.equal(a.sha256,'376bd37739caf2ad58093c5701e313efc6ebac1f3a7ae1de363a97ee89907b55');
 assert.equal(createHash('sha256').update(fs.readFileSync(a.src)).digest('hex'),a.sha256);
 const qa=JSON.parse(fs.readFileSync('src/data/championship/qa-database-hero-portraits.r1.json','utf8'));assert.deepEqual(critical(qa.entries.find(e=>e.speciesIndex===49)),critical(a));
 assert.equal(approvedHeroPortrait(47).src,'assets/production/database-handpainted-r1-20261015/species-047.png');assert.equal(approvedHeroPortrait(67).speciesId,'species-067');
});

test('refined035039045 preserve exact versioned PNG identity and QA registry agreement',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');const expected={"35": {"src": "assets/production/database-handpainted-r1-20261015/species-035.291db6a498c8bdbd.png", "sha256": "291db6a498c8bdbd5e5b2196c8f9a629ec44a1ba55674e103dc596e6827fe6d4"}, "39": {"src": "assets/production/database-handpainted-r1-20261015/species-039.a22eae194967e17d.png", "sha256": "a22eae194967e17d6aca6cac06ca249ef0fd223a0687c10923e33d78e3d710ec"}, "45": {"src": "assets/production/database-handpainted-r1-20261015/species-045.5252dd103f05bc11.png", "sha256": "5252dd103f05bc111158a75d193c3dc0793051614190f42645b99bb4f00f2453"}};
 const qa=JSON.parse(fs.readFileSync('src/data/championship/qa-database-hero-portraits.r1.json','utf8'));
 const manifest=JSON.parse(fs.readFileSync('assets/production/database-handpainted-r1-20261015/manifest.json','utf8'));
 for(const [sp,want] of Object.entries(expected)){const e=approvedHeroPortrait(Number(sp));assert.equal(e.src,want.src);assert.equal(e.sha256,want.sha256);assert.equal(createHash('sha256').update(fs.readFileSync(e.src)).digest('hex'),e.sha256);assert.deepEqual(critical(qa.entries.find(q=>q.speciesIndex===Number(sp))),critical(e));assert.equal(manifest.entries.find(q=>q.speciesIndex===Number(sp)).selectedGenerationVersion,Number(sp)===35?'owner-clean-handpaint-v1':'refined-handpainted-v2');}
 assert.equal(qa.entries.length,95);assert.equal(manifest.count,44);assert.equal(approvedHeroPortrait(67).speciesId,'species-067');
});

test('new053054055057 heroes preserve exact identity and discovery privacy across five locales',()=>{
 try {for(const sp of [53, 54, 55, 57])for(const locale of locales)for(const registered of [true,false]){
  const f=makeView({locale,selectedSpeciesIndex:sp,registeredSpecies:registered?[sp]:[],collection:[]});
  try {const holder=f.root.querySelector('.cm-dex-hero'),art=databaseHeroPortrait(sp),identity=getDatabaseDisplayEntry(sp);
   assert.equal(art.speciesId,identity.speciesId);assert.equal(art.displayCode,identity.displayCode);
   if(!registered){assert.equal(holder,null);assert.equal(f.root.querySelector('.cm-dex-profile'),null);assert.equal(f.root.querySelector('.cm-dex-data'),null);}
   else {assert.ok(holder);const img=holder.querySelector('img');assert.equal(img.src,art.src);assert.equal(approvedHeroPortrait(sp).width,1254);assert.equal(approvedHeroPortrait(sp).height,1254);assert.ok(img.hidden);assert.equal(f.root.querySelector('.cm-dex-profile__text').textContent,databaseStory(sp,locale));assert.ok(f.root.querySelector('.cm-dex-data'));img.naturalWidth=art.width;img.naturalHeight=art.height;img.onload();assert.equal(img.hidden,false);assert.equal(holder.dataset.art,'ready');}
   f.assertUnchanged();
  }finally{f.dispose();}
 }}finally{setLocale('zh-Hant');}
});


test('new four portraits preserve exact source identity hashes and aggregate bundle counts',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');const expected={"53": {"speciesIndex": 53, "speciesId": "species-053", "displayCode": "GR27", "src": "assets/production/database-handpainted-r1-20261015/species-053.a07a52ab7f1501c4.png", "width": 1254, "height": 1254, "sha256": "a07a52ab7f1501c40b283d43af35a2f0b07294c42541dd89c72e8dbbca366716", "styleBatch": "HANDPAINTED_R1_20261015"}, "54": {"speciesIndex": 54, "speciesId": "species-054", "displayCode": "GR28", "src": "assets/production/database-handpainted-r1-20261015/species-054.653364ea2b2dbdd5.png", "width": 1254, "height": 1254, "sha256": "653364ea2b2dbdd50e3edd100da021ab1cafe2208fe1d61103bca445177fda41", "styleBatch": "HANDPAINTED_R1_20261015"}, "55": {"speciesIndex": 55, "speciesId": "species-055", "displayCode": "GR29", "src": "assets/production/database-handpainted-r1-20261015/species-055.32e6689b5e9669c2.png", "width": 1254, "height": 1254, "sha256": "32e6689b5e9669c26fb0d29f3201ace2d5d619309381ab628d57f5eabc5d693e", "styleBatch": "HANDPAINTED_R1_20261015"}, "57": {"speciesIndex": 57, "speciesId": "species-057", "displayCode": "GR31", "src": "assets/production/database-handpainted-r1-20261015/species-057.001820f22618bab0.png", "width": 1254, "height": 1254, "sha256": "001820f22618bab0360081efbc760ef15bc99969c39c5bb4c67a47c86b234295", "styleBatch": "HANDPAINTED_R1_20261015"}},sourceExpected={"53": {"entityId": "m227_patamon", "sha256": "cdfff373ba4da42f0613d4697b9b2497c6166655a3b26f1c761ff9c017b3dace", "version": "v1"}, "54": {"entityId": "m228_palmon", "sha256": "fc6352be976133caaccba24f17695e8f2f9d0e7d4617f095fe6a4f81ad8b4304", "version": "refined-handpainted-v2"}, "55": {"entityId": "m229_picodevimon", "sha256": "75dd64319017670b23fbc6687378f84bbf0f3074e29e4adab93e3e1ece31eb47", "version": "v2"}, "57": {"entityId": "m231_falcomon", "sha256": "283d2bdfdfaec25a538140e48f1431d5ed2c47f1f362aa128e4b565d34fb1fd4", "version": "v1"}};
 const manifest=JSON.parse(fs.readFileSync('assets/production/database-handpainted-r1-20261015/manifest.json','utf8'));
 const index=JSON.parse(fs.readFileSync('assets/production/ART_PRODUCTION_INDEX.json','utf8'));
 const bundles=Object.values(index).filter(Array.isArray).flat().filter(e=>e?.assetId==='art:database:handpainted:r1');assert.equal(bundles.length,1);assert.equal(bundles[0].count,44);assert.equal(bundles[0].maturity,'44_SOURCE_GUIDED_HANDPAINTED_TRANSPARENT_HEROES');assert.equal(bundles[0].shippingReady,false);
 assert.equal(manifest.entries.length,44);assert.equal(manifest.count,44);
 for(const [sp,want] of Object.entries(expected)){const e=approvedHeroPortrait(Number(sp));assert.deepEqual(critical(e),critical(want));const b=fs.readFileSync(e.src);assert.equal(createHash('sha256').update(b).digest('hex'),e.sha256);assert.equal(b.readUInt32BE(16),1254);assert.equal(b.readUInt32BE(20),1254);const m=manifest.entries.find(m=>m.speciesIndex===Number(sp));assert.equal(m.sha256,e.sha256);assert.equal(m.sourceEntityId,sourceExpected[sp].entityId);assert.equal(m.sourceReferenceSha256,sourceExpected[sp].sha256);assert.equal(m.selectedGenerationVersion,sourceExpected[sp].version);}
 for(const id of [229,230]){assert.equal(approvedHeroPortrait(id).speciesIndex,id);assert.equal(getProductExtension(id).runtimeReady,true);assert.equal(getProductExtension(id).evolutionReady,true);assert.equal(getDatabaseDisplayEntry(id).speciesId,`species-${id}`);assert.equal(getDatabaseDisplayEntry(id).displayCode,id===229?'UL34':'UL03');}assert.equal(approvedHeroPortrait(67).speciesId,'species-067');
});

test('new050051052056 heroes preserve exact identity and discovery privacy across five locales',()=>{
 try {for(const sp of [50, 51, 52, 56])for(const locale of locales)for(const registered of [true,false]){
  const f=makeView({locale,selectedSpeciesIndex:sp,registeredSpecies:registered?[sp]:[],collection:[]});
  try {const holder=f.root.querySelector('.cm-dex-hero'),art=databaseHeroPortrait(sp),identity=getDatabaseDisplayEntry(sp);
   assert.equal(art.speciesId,identity.speciesId);assert.equal(art.displayCode,identity.displayCode);
   if(!registered){assert.equal(holder,null);assert.equal(f.root.querySelector('.cm-dex-profile'),null);assert.equal(f.root.querySelector('.cm-dex-data'),null);}
   else {assert.ok(holder);const img=holder.querySelector('img');assert.equal(img.src,art.src);assert.equal(approvedHeroPortrait(sp).width,1254);assert.equal(approvedHeroPortrait(sp).height,1254);assert.ok(img.hidden);assert.equal(f.root.querySelector('.cm-dex-profile__text').textContent,databaseStory(sp,locale));assert.ok(f.root.querySelector('.cm-dex-data'));img.naturalWidth=art.width;img.naturalHeight=art.height;img.onload();assert.equal(img.hidden,false);assert.equal(holder.dataset.art,'ready');}
   f.assertUnchanged();
  }finally{f.dispose();}
 }}finally{setLocale('zh-Hant');}
});


test('next four portraits preserve exact source identity hashes and aggregate bundle counts',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');const expected={"50": {"speciesIndex": 50, "speciesId": "species-050", "displayCode": "GR23", "src": "assets/production/database-handpainted-r1-20261015/species-050.4da662245939ae14.png", "width": 1254, "height": 1254, "sha256": "4da662245939ae142d013e9a0a5cea1642438791d94cf1991f68c96e7a7a1b58", "styleBatch": "HANDPAINTED_R1_20261015"}, "51": {"speciesIndex": 51, "speciesId": "species-051", "displayCode": "GR25", "src": "assets/production/database-handpainted-r1-20261015/species-051.4005fcb499a215ca.png", "width": 1254, "height": 1254, "sha256": "4005fcb499a215cae40c0fdd7803bae6091a5a290e33f0bafbad260b70856a24", "styleBatch": "HANDPAINTED_R1_20261015"}, "52": {"speciesIndex": 52, "speciesId": "species-052", "displayCode": "GR26", "src": "assets/production/database-handpainted-r1-20261015/species-052.e2a1ae73e1e1baab.png", "width": 1254, "height": 1254, "sha256": "e2a1ae73e1e1baabf7e131067ba16d1d68f5d63eff48d8689cd5c7d4b2ac4a05", "styleBatch": "HANDPAINTED_R1_20261015"}, "56": {"speciesIndex": 56, "speciesId": "species-056", "displayCode": "GR30", "src": "assets/production/database-handpainted-r1-20261015/species-056.f7c3f093351f4965.png", "width": 1254, "height": 1254, "sha256": "f7c3f093351f49656d23822132c807f06908aad40bfd8c3e8607429424ca7eb5", "styleBatch": "HANDPAINTED_R1_20261015"}},sourceExpected={"50": {"entityId": "m223_toyagumon", "sha256": "802f93e3d0ead75e752fe20e8456c0794eb7928b021066c7cde41fb7832491b1", "version": "v1"}, "51": {"entityId": "m225_bakumon", "sha256": "4c1aa0f7247c622c31195b3e3ff5c03143b8d88f0ce729faceb7f78634576779", "version": "refined-handpainted-v2"}, "52": {"entityId": "m226_hagurumon", "sha256": "d203c58f616c5be7549ed55e4d703b695c92a5cb758bbc5196811738bb689153", "version": "v1"}, "56": {"entityId": "m230_piyomon", "sha256": "67301ec25c237751fb2df64da058d1334c53b91499a1cfef607e264c4560ebec", "version": "v1"}};
 const manifest=JSON.parse(fs.readFileSync('assets/production/database-handpainted-r1-20261015/manifest.json','utf8'));
 const index=JSON.parse(fs.readFileSync('assets/production/ART_PRODUCTION_INDEX.json','utf8'));
 const bundles=Object.values(index).filter(Array.isArray).flat().filter(e=>e?.assetId==='art:database:handpainted:r1');assert.equal(bundles.length,1);assert.equal(bundles[0].count,44);assert.equal(bundles[0].maturity,'44_SOURCE_GUIDED_HANDPAINTED_TRANSPARENT_HEROES');assert.equal(bundles[0].shippingReady,false);
 assert.equal(manifest.entries.length,44);assert.equal(manifest.count,44);
 for(const [sp,want] of Object.entries(expected)){const e=approvedHeroPortrait(Number(sp));assert.deepEqual(critical(e),critical(want));const b=fs.readFileSync(e.src);assert.equal(createHash('sha256').update(b).digest('hex'),e.sha256);assert.equal(b.readUInt32BE(16),1254);assert.equal(b.readUInt32BE(20),1254);const m=manifest.entries.find(m=>m.speciesIndex===Number(sp));assert.equal(m.sha256,e.sha256);assert.equal(m.sourceEntityId,sourceExpected[sp].entityId);assert.equal(m.sourceReferenceSha256,sourceExpected[sp].sha256);assert.equal(m.selectedGenerationVersion,sourceExpected[sp].version);}
 for(const id of [229,230]){assert.equal(approvedHeroPortrait(id).speciesIndex,id);assert.equal(getProductExtension(id).runtimeReady,true);assert.equal(getProductExtension(id).evolutionReady,true);assert.equal(getDatabaseDisplayEntry(id).speciesId,`species-${id}`);assert.equal(getDatabaseDisplayEntry(id).displayCode,id===229?'UL34':'UL03');}assert.equal(approvedHeroPortrait(67).speciesId,'species-067');
});

test('new058059060061 heroes preserve exact identity and discovery privacy across five locales',()=>{
 try {for(const sp of [58, 59, 60, 61])for(const locale of locales)for(const registered of [true,false]){
  const f=makeView({locale,selectedSpeciesIndex:sp,registeredSpecies:registered?[sp]:[],collection:[]});
  try {const holder=f.root.querySelector('.cm-dex-hero'),art=databaseHeroPortrait(sp),identity=getDatabaseDisplayEntry(sp);
   assert.equal(art.speciesId,identity.speciesId);assert.equal(art.displayCode,identity.displayCode);
   if(!registered){assert.equal(holder,null);assert.equal(f.root.querySelector('.cm-dex-profile'),null);assert.equal(f.root.querySelector('.cm-dex-data'),null);}
   else {assert.ok(holder);const img=holder.querySelector('img');assert.equal(img.src,art.src);assert.equal(approvedHeroPortrait(sp).width,1254);assert.equal(approvedHeroPortrait(sp).height,1254);assert.ok(img.hidden);assert.equal(f.root.querySelector('.cm-dex-profile__text').textContent,databaseStory(sp,locale));assert.ok(f.root.querySelector('.cm-dex-data'));img.naturalWidth=art.width;img.naturalHeight=art.height;img.onload();assert.equal(img.hidden,false);assert.equal(holder.dataset.art,'ready');}
   f.assertUnchanged();
  }finally{f.dispose();}
 }}finally{setLocale('zh-Hant');}
});


test('058059060061 portraits preserve exact source identity hashes and aggregate bundle counts',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');const expected={"58": {"speciesIndex": 58, "speciesId": "species-058", "displayCode": "GR33", "src": "assets/production/database-handpainted-r1-20261015/species-058.85ac0a27d7121cef.png", "width": 1254, "height": 1254, "sha256": "85ac0a27d7121cef246ba2c911ab452b6bcb97b3284a09edd1ae6cbfcd07d1fc", "styleBatch": "HANDPAINTED_R1_20261015"}, "59": {"speciesIndex": 59, "speciesId": "species-059", "displayCode": "GR34", "src": "assets/production/database-handpainted-r1-20261015/species-059.d808c556efd2a029.png", "width": 1254, "height": 1254, "sha256": "d808c556efd2a0291a3d38973783951c41199bdb779bbff913511afbbefff9d6", "styleBatch": "HANDPAINTED_R1_20261015"}, "60": {"speciesIndex": 60, "speciesId": "species-060", "displayCode": "GR35", "src": "assets/production/database-handpainted-r1-20261015/species-060.7a8efa91b909b615.png", "width": 1254, "height": 1254, "sha256": "7a8efa91b909b615bab9af95cce073d6184a5df830db6c98932c6827d1a1f523", "styleBatch": "HANDPAINTED_R1_20261015"}, "61": {"speciesIndex": 61, "speciesId": "species-061", "displayCode": "GR36", "src": "assets/production/database-handpainted-r1-20261015/species-061.df2dcf13586b2025.png", "width": 1254, "height": 1254, "sha256": "df2dcf13586b20252a75c6b333034bc38f345fdb15fe099f0b826eb60410e112", "styleBatch": "HANDPAINTED_R1_20261015"}},sourceExpected={"58": {"entityId": "m232_plotmon", "sha256": "aa9a60d4cdf5a89d036c6e89f9eba7eb629cf1a2d9661cc79259a3b945919219", "version": "v1"}, "59": {"entityId": "m233_floramon", "sha256": "c82fbd69f60cc9f7245f30a7d34527f191ff92dc6f0436faf18f334761bbc992", "version": "refined-handpainted-v2"}, "60": {"entityId": "m235_mushmon", "sha256": "f4bb09cbbac08483edb09652cd664a07e297257d9b21d7e3ecd58566757f7a07", "version": "v1"}, "61": {"entityId": "m236_yukiagumon", "sha256": "541aed1932ddfec7bec30b1148368b60800ad01443d4d620736ed31381de0926", "version": "v1"}};
 const manifest=JSON.parse(fs.readFileSync('assets/production/database-handpainted-r1-20261015/manifest.json','utf8'));
 const index=JSON.parse(fs.readFileSync('assets/production/ART_PRODUCTION_INDEX.json','utf8'));
 const bundles=Object.values(index).filter(Array.isArray).flat().filter(e=>e?.assetId==='art:database:handpainted:r1');assert.equal(bundles.length,1);assert.equal(bundles[0].count,44);assert.equal(bundles[0].maturity,'44_SOURCE_GUIDED_HANDPAINTED_TRANSPARENT_HEROES');assert.equal(bundles[0].shippingReady,false);
 assert.equal(manifest.entries.length,44);assert.equal(manifest.count,44);
 for(const [sp,want] of Object.entries(expected)){const e=approvedHeroPortrait(Number(sp));assert.deepEqual(critical(e),critical(want));const b=fs.readFileSync(e.src);assert.equal(createHash('sha256').update(b).digest('hex'),e.sha256);assert.equal(b.readUInt32BE(16),1254);assert.equal(b.readUInt32BE(20),1254);const m=manifest.entries.find(m=>m.speciesIndex===Number(sp));assert.equal(m.sha256,e.sha256);assert.equal(m.sourceEntityId,sourceExpected[sp].entityId);assert.equal(m.sourceReferenceSha256,sourceExpected[sp].sha256);assert.equal(m.selectedGenerationVersion,sourceExpected[sp].version);}
 for(const id of [229,230]){assert.equal(approvedHeroPortrait(id).speciesIndex,id);assert.equal(getProductExtension(id).runtimeReady,true);assert.equal(getProductExtension(id).evolutionReady,true);assert.equal(getDatabaseDisplayEntry(id).speciesId,`species-${id}`);assert.equal(getDatabaseDisplayEntry(id).displayCode,id===229?'UL34':'UL03');}assert.equal(approvedHeroPortrait(67).speciesId,'species-067');
});

test('new062063064065 heroes preserve exact identity and discovery privacy across five locales',()=>{
 try {for(const sp of [62, 63, 64, 65])for(const locale of locales)for(const registered of [true,false]){
  const f=makeView({locale,selectedSpeciesIndex:sp,registeredSpecies:registered?[sp]:[],collection:[]});
  try {const holder=f.root.querySelector('.cm-dex-hero'),art=databaseHeroPortrait(sp),identity=getDatabaseDisplayEntry(sp);
   assert.equal(art.speciesId,identity.speciesId);assert.equal(art.displayCode,identity.displayCode);
   if(!registered){assert.equal(holder,null);assert.equal(f.root.querySelector('.cm-dex-profile'),null);assert.equal(f.root.querySelector('.cm-dex-data'),null);}
   else {assert.ok(holder);const img=holder.querySelector('img');assert.equal(img.src,art.src);assert.equal(approvedHeroPortrait(sp).width,1254);assert.equal(approvedHeroPortrait(sp).height,1254);assert.ok(img.hidden);assert.equal(f.root.querySelector('.cm-dex-profile__text').textContent,databaseStory(sp,locale));assert.ok(f.root.querySelector('.cm-dex-data'));img.naturalWidth=art.width;img.naturalHeight=art.height;img.onload();assert.equal(img.hidden,false);assert.equal(holder.dataset.art,'ready');}
   f.assertUnchanged();
  }finally{f.dispose();}
 }}finally{setLocale('zh-Hant');}
});


test('062063064065 portraits preserve exact source identity hashes and aggregate bundle counts',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');const expected={"62": {"speciesIndex": 62, "speciesId": "species-062", "displayCode": "GR38", "src": "assets/production/database-handpainted-r1-20261015/species-062.ad0745c733532dc2.png", "width": 1254, "height": 1254, "sha256": "ad0745c733532dc288c5143194e9020e35cd071e74347e7a3851911db136e52d", "styleBatch": "HANDPAINTED_R1_20261015"}, "63": {"speciesIndex": 63, "speciesId": "species-063", "displayCode": "GR24", "src": "assets/production/database-handpainted-r1-20261015/species-063.e403a93ec4f2d7ec.png", "width": 1254, "height": 1254, "sha256": "e403a93ec4f2d7ec24273c2f2f3d861feeec11848d55450989230b2c93283f8a", "styleBatch": "HANDPAINTED_R1_20261015"}, "64": {"speciesIndex": 64, "speciesId": "species-064", "displayCode": "GR18", "src": "assets/production/database-handpainted-r1-20261015/species-064.1fd9b11486ee01a1.png", "width": 1254, "height": 1254, "sha256": "1fd9b11486ee01a10e912aff8c0b571f8112a3c6cf9e6ee050d2807897f122b9", "styleBatch": "HANDPAINTED_R1_20261015"}, "65": {"speciesIndex": 65, "speciesId": "species-065", "displayCode": "GR37", "src": "assets/production/database-handpainted-r1-20261015/species-065.297304ab3fa37f43.png", "width": 1254, "height": 1254, "sha256": "297304ab3fa37f43d5f3d07c3b4b7469d83f6d720506c11a4d651da0d7726755", "styleBatch": "HANDPAINTED_R1_20261015"}},sourceExpected={"62": {"entityId": "m237_renamon", "sha256": "75e3101f148ff42f91bfef21b4dc521dbfdc284de74ed2d73ec61b1b3df8397e", "version": "owner-biped-handpaint-v1"}, "63": {"entityId": "m224_dracomon", "sha256": "8597bfb7d91b9654356a06971b7ac33fe84cb7e34cbbd6ac794800f7ddb256b6", "version": "owner-recolor-v2"}, "64": {"entityId": "m238_coronamon", "sha256": "c59b62c8a22970f3da9f77d2aca7277ad1e1bedf57b582501bc8745dc056dcb9", "version": "v1"}, "65": {"entityId": "m239_lunamon", "sha256": "9cfd6b0ce8ef32d1badb51c5542b293c494b986bc6716c30123a12e5e8985517", "version": "v1"}};
 const manifest=JSON.parse(fs.readFileSync('assets/production/database-handpainted-r1-20261015/manifest.json','utf8'));
 const index=JSON.parse(fs.readFileSync('assets/production/ART_PRODUCTION_INDEX.json','utf8'));
 const bundles=Object.values(index).filter(Array.isArray).flat().filter(e=>e?.assetId==='art:database:handpainted:r1');assert.equal(bundles.length,1);assert.equal(bundles[0].count,44);assert.equal(bundles[0].maturity,'44_SOURCE_GUIDED_HANDPAINTED_TRANSPARENT_HEROES');assert.equal(bundles[0].shippingReady,false);
 assert.equal(manifest.entries.length,44);assert.equal(manifest.count,44);
 for(const [sp,want] of Object.entries(expected)){const e=approvedHeroPortrait(Number(sp));assert.deepEqual(critical(e),critical(want));const b=fs.readFileSync(e.src);assert.equal(createHash('sha256').update(b).digest('hex'),e.sha256);assert.equal(b.readUInt32BE(16),1254);assert.equal(b.readUInt32BE(20),1254);const m=manifest.entries.find(m=>m.speciesIndex===Number(sp));assert.equal(m.sha256,e.sha256);assert.equal(m.sourceEntityId,sourceExpected[sp].entityId);assert.equal(m.sourceReferenceSha256,sourceExpected[sp].sha256);assert.equal(m.selectedGenerationVersion,sourceExpected[sp].version);}
 for(const id of [229,230]){assert.equal(approvedHeroPortrait(id).speciesIndex,id);assert.equal(getProductExtension(id).runtimeReady,true);assert.equal(getProductExtension(id).evolutionReady,true);assert.equal(getDatabaseDisplayEntry(id).speciesId,`species-${id}`);assert.equal(getDatabaseDisplayEntry(id).displayCode,id===229?'UL34':'UL03');}assert.equal(approvedHeroPortrait(67).speciesId,'species-067');
});

test('new066067068069 heroes preserve exact identity and discovery privacy across five locales',()=>{
 try {for(const sp of [66, 67, 68, 69])for(const locale of locales)for(const registered of [true,false]){
  const f=makeView({locale,selectedSpeciesIndex:sp,registeredSpecies:registered?[sp]:[],collection:[]});
  try {const holder=f.root.querySelector('.cm-dex-hero'),art=databaseHeroPortrait(sp),identity=getDatabaseDisplayEntry(sp);
   assert.equal(art.speciesId,identity.speciesId);assert.equal(art.displayCode,identity.displayCode);
   if(!registered){assert.equal(holder,null);assert.equal(f.root.querySelector('.cm-dex-profile'),null);assert.equal(f.root.querySelector('.cm-dex-data'),null);}
   else {assert.ok(holder);const img=holder.querySelector('img');assert.equal(img.src,art.src);assert.equal(approvedHeroPortrait(sp).width,1254);assert.equal(approvedHeroPortrait(sp).height,1254);assert.ok(img.hidden);assert.equal(f.root.querySelector('.cm-dex-profile__text').textContent,databaseStory(sp,locale));assert.ok(f.root.querySelector('.cm-dex-data'));img.naturalWidth=art.width;img.naturalHeight=art.height;img.onload();assert.equal(img.hidden,false);assert.equal(holder.dataset.art,'ready');}
   f.assertUnchanged();
  }finally{f.dispose();}
 }}finally{setLocale('zh-Hant');}
});


test('066067068069 portraits preserve exact source identity hashes and aggregate bundle counts',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');const expected={"66": {"speciesIndex": 66, "speciesId": "species-066", "displayCode": "GR14", "src": "assets/production/database-handpainted-r1-20261015/species-066.18cfe71dbf919d32.png", "width": 1254, "height": 1254, "sha256": "18cfe71dbf919d323616ec17d05ac6f59edaffac5f5e97548434463bda694e9a", "styleBatch": "HANDPAINTED_R1_20261015"}, "67": {"speciesIndex": 67, "speciesId": "species-067", "displayCode": "GR19", "src": "assets/production/database-handpainted-r1-20261015/species-067.d3b4711e2fef8428.png", "width": 1254, "height": 1254, "sha256": "d3b4711e2fef84288d8f8005760a2c0e9222f5167f3eb37e9ac845cc226d7b41", "styleBatch": "HANDPAINTED_R1_20261015"}, "68": {"speciesIndex": 68, "speciesId": "species-068", "displayCode": "GR03", "src": "assets/production/database-handpainted-r1-20261015/species-068.fd96778e08b01ee7.png", "width": 1254, "height": 1254, "sha256": "fd96778e08b01ee77a8a594ce29485bf0330369885b6b593cb4a8297836da20b", "styleBatch": "HANDPAINTED_R1_20261015"}, "69": {"speciesIndex": 69, "speciesId": "species-069", "displayCode": "GR20", "src": "assets/production/database-handpainted-r1-20261015/species-069.cf92eaf941781156.png", "width": 1254, "height": 1254, "sha256": "cf92eaf9417811567ba46df948bd14fa7ee0f297d3a4662508771ec23a114e5a", "styleBatch": "HANDPAINTED_R1_20261015"}},sourceExpected={"66": {"entityId": "m240_kuroagumon", "sha256": "1d2de42d296a0b49e3c563795cbbb3f248d280d9256ca18c7aa74ccb6b37e853", "version": "v1"}, "67": {"entityId": "m241_psychemon", "sha256": "d928019a84bb07226f866e5a84cf7c850c01b52e537566517125f2d94326469c", "version": "v1"}, "68": {"entityId": "m242_alraumon", "sha256": "e9843b50385e903a588ca9e50189bc81c16b66c4fcaeedbe53d0a302d34bad15", "version": "v2"}, "69": {"entityId": "m243_tsukaimon", "sha256": "921d9f085642ea9e020219a4d7e39b593fcd31aa0f68ed4c050f4cbb6b55d8ec", "version": "v1"}};
 const manifest=JSON.parse(fs.readFileSync('assets/production/database-handpainted-r1-20261015/manifest.json','utf8'));
 const index=JSON.parse(fs.readFileSync('assets/production/ART_PRODUCTION_INDEX.json','utf8'));
 const bundles=Object.values(index).filter(Array.isArray).flat().filter(e=>e?.assetId==='art:database:handpainted:r1');assert.equal(bundles.length,1);assert.equal(bundles[0].count,44);assert.equal(bundles[0].maturity,'44_SOURCE_GUIDED_HANDPAINTED_TRANSPARENT_HEROES');assert.equal(bundles[0].shippingReady,false);
 assert.equal(manifest.entries.length,44);assert.equal(manifest.count,44);
 for(const [sp,want] of Object.entries(expected)){const e=approvedHeroPortrait(Number(sp));assert.deepEqual(critical(e),critical(want));const b=fs.readFileSync(e.src);assert.equal(createHash('sha256').update(b).digest('hex'),e.sha256);assert.equal(b.readUInt32BE(16),1254);assert.equal(b.readUInt32BE(20),1254);const m=manifest.entries.find(m=>m.speciesIndex===Number(sp));assert.equal(m.sha256,e.sha256);assert.equal(m.sourceEntityId,sourceExpected[sp].entityId);assert.equal(m.sourceReferenceSha256,sourceExpected[sp].sha256);assert.equal(m.selectedGenerationVersion,sourceExpected[sp].version);}
 for(const id of [229,230]){assert.equal(approvedHeroPortrait(id).speciesIndex,id);assert.equal(getProductExtension(id).runtimeReady,true);assert.equal(getProductExtension(id).evolutionReady,true);assert.equal(getDatabaseDisplayEntry(id).speciesId,`species-${id}`);assert.equal(getDatabaseDisplayEntry(id).displayCode,id===229?'UL34':'UL03');}assert.equal(approvedHeroPortrait(67).speciesId,'species-067');
});

test('117 simplified pilot hero preserve exact identity and discovery privacy across five locales',()=>{
 try {for(const sp of [117])for(const locale of locales)for(const registered of [true,false]){
  const f=makeView({locale,selectedSpeciesIndex:sp,registeredSpecies:registered?[sp]:[],collection:[]});
  try {const holder=f.root.querySelector('.cm-dex-hero'),art=databaseHeroPortrait(sp),identity=getDatabaseDisplayEntry(sp);
   assert.equal(art.speciesId,identity.speciesId);assert.equal(art.displayCode,identity.displayCode);
   if(!registered){assert.equal(holder,null);assert.equal(f.root.querySelector('.cm-dex-profile'),null);assert.equal(f.root.querySelector('.cm-dex-data'),null);}
   else {assert.ok(holder);const img=holder.querySelector('img');assert.equal(img.src,art.src);assert.equal(approvedHeroPortrait(sp).width,1254);assert.equal(approvedHeroPortrait(sp).height,1254);assert.ok(img.hidden);assert.equal(f.root.querySelector('.cm-dex-profile__text').textContent,databaseStory(sp,locale));assert.ok(f.root.querySelector('.cm-dex-data'));img.naturalWidth=art.width;img.naturalHeight=art.height;img.onload();assert.equal(img.hidden,false);assert.equal(holder.dataset.art,'ready');}
   f.assertUnchanged();
  }finally{f.dispose();}
 }}finally{setLocale('zh-Hant');}
});


test('117 simplified pilot is exact source-guided PNG and preserves all existing identities',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');const expected={"speciesIndex": 117, "speciesId": "species-117", "displayCode": "MA58", "src": "assets/production/database-handpainted-r1-20261015/species-117.8f7d027cdbf6d3e6.png", "width": 1254, "height": 1254, "sha256": "8f7d027cdbf6d3e6d57dbe2f9cb091e42687c01170d1f3ef58ba0413e504a681", "styleBatch": "HANDPAINTED_R1_20261015"};
 const manifest=JSON.parse(fs.readFileSync('assets/production/database-handpainted-r1-20261015/manifest.json','utf8'));
 const index=JSON.parse(fs.readFileSync('assets/production/ART_PRODUCTION_INDEX.json','utf8'));
 const bundles=Object.values(index).filter(Array.isArray).flat().filter(e=>e?.assetId==='art:database:handpainted:r1');assert.equal(bundles.length,1);assert.equal(bundles[0].count,44);assert.equal(bundles[0].maturity,'44_SOURCE_GUIDED_HANDPAINTED_TRANSPARENT_HEROES');assert.equal(bundles[0].shippingReady,false);
 assert.equal(manifest.count,44);assert.equal(manifest.entries.length,44);
 const e=approvedHeroPortrait(117);assert.deepEqual(critical(e),critical(expected));const b=fs.readFileSync(e.src);assert.equal(createHash('sha256').update(b).digest('hex'),e.sha256);assert.equal(b.readUInt32BE(16),1254);assert.equal(b.readUInt32BE(20),1254);assert.equal(b[25],6);
 const m=manifest.entries.find(x=>x.speciesIndex===117);assert.equal(m.sha256,e.sha256);assert.equal(m.sourceEntityId,'m357_unimon');assert.equal(m.sourceReferenceSha256,'8372366d49ae17a40a39326b0e84a1f3a474b5d67c9b639a799e0ebcaaf3ce50');assert.equal(m.selectedGenerationVersion,'simplified-v2');assert.equal(m.review.rootReview,'SCOPED_HOSTED_VISUAL_PASS');assert.equal(m.review.runtimeBrowser,'PASS_NORMAL_DEX_128_256_LIGHT_DARK_RESPONSIVE');assert.equal(m.review.hostedEvidence.candidateHead,'52978fc360df8abb22c0e29dbb7961b27e9cd8f6');assert.equal(m.review.hostedEvidence.artifactId,11983920742);assert.equal(m.review.hostedEvidence.testedImageSha256,e.sha256);assert.match(m.review.comparisonCaveat,/does not validate the whole roster/);assert.match(m.review.rootReviewScope,/not an all-roster, action-art or three-view acceptance/);
 for(const id of [229,230]){assert.equal(approvedHeroPortrait(id).speciesIndex,id);assert.equal(getProductExtension(id).runtimeReady,true);assert.equal(getProductExtension(id).evolutionReady,true);assert.equal(getDatabaseDisplayEntry(id).speciesId,`species-${id}`);assert.equal(getDatabaseDisplayEntry(id).displayCode,id===229?'UL34':'UL03');}for(const sp of [74])assert.equal(databaseHeroPortrait(sp),null);for(const sp of [73,75,76,77,78])assert.equal(databaseHeroPortrait(sp).speciesIndex,sp);
 assert.equal(getDatabaseDisplayEntry(117).displayCode,'MA58');assert.equal(approvedHeroPortrait(55).speciesId,'species-055');
});


test('promoted forms expose their own five-language stories without extending the raw 216-profile oracle',()=>{
  assert.equal(catalog.entries.length,216);assert.ok(!catalog.entries.some(e=>e.speciesIndex===229||e.speciesIndex===230));
  try{for(const id of [229,230])for(const locale of locales)for(const registered of [false,true]){
    assert.ok(databaseStory(id,locale)?.length>25);
    const f=makeView({locale,selectedSpeciesIndex:id,registeredSpecies:registered?[id]:[],collection:[]});
    if(registered){
      assert.equal(f.root.querySelector('.cm-dex-profile__text')?.textContent,databaseStory(id,locale));
      assert.ok(f.root.querySelector('.cm-dex-hero'));assert.ok(f.root.querySelector('.cm-dex-data'));
    }else{assert.equal(f.root.querySelector('.cm-dex-profile'),null);assert.equal(f.root.querySelector('.cm-dex-hero'),null);assert.equal(f.root.querySelector('.cm-dex-data'),null);}
    f.assertUnchanged();f.dispose();
  }}finally{setLocale('zh-Hant');}
});

test('070 redesigned and071072 hosted candidates preserve exact identity and discovery privacy across five locales',()=>{
 try {for(const sp of [70,71,72])for(const locale of locales)for(const registered of [true,false]){
  const f=makeView({locale,selectedSpeciesIndex:sp,registeredSpecies:registered?[sp]:[],collection:[]});
  try {const holder=f.root.querySelector('.cm-dex-hero'),art=databaseHeroPortrait(sp),identity=getDatabaseDisplayEntry(sp);
   assert.equal(art.speciesId,identity.speciesId);assert.equal(art.displayCode,identity.displayCode);
   if(!registered){assert.equal(holder,null);assert.equal(f.root.querySelector('.cm-dex-profile'),null);assert.equal(f.root.querySelector('.cm-dex-data'),null);}
   else {assert.ok(holder);const img=holder.querySelector('img');assert.equal(img.src,art.src);assert.equal(approvedHeroPortrait(sp).width,1254);assert.equal(approvedHeroPortrait(sp).height,1254);assert.ok(img.hidden);assert.equal(f.root.querySelector('.cm-dex-profile__text').textContent,databaseStory(sp,locale));assert.ok(f.root.querySelector('.cm-dex-data'));img.naturalWidth=art.width;img.naturalHeight=art.height;img.onload();assert.equal(img.hidden,false);assert.equal(holder.dataset.art,'ready');}
   f.assertUnchanged();
  }finally{f.dispose();}
 }}finally{setLocale('zh-Hant');}
});



test('070 redesign preserves unaffected baseline entries and071072 exact hosted approval',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');
 const hash=b=>createHash('sha256').update(b).digest('hex');
 const registry=JSON.parse(fs.readFileSync('src/data/championship/database-hero-portraits.r1.json','utf8'));
 const manifest=JSON.parse(fs.readFileSync('assets/production/database-handpainted-r1-20261015/manifest.json','utf8'));
 const expected=[{"speciesIndex": 70, "speciesId": "species-070", "displayCode": "GR32", "src": "assets/production/database-handpainted-r1-20261015/species-070.2dc33277d80cdfb4.png", "width": 1254, "height": 1254, "sha256": "2dc33277d80cdfb4577bee1d369adb59545b4ccc735a4f90fff342087a1ba738", "styleBatch": "HANDPAINTED_R1_20261015"}, {"speciesIndex": 71, "speciesId": "species-071", "displayCode": "GR12", "src": "assets/production/database-handpainted-r1-20261015/species-071.cd9ee93854a452cc.png", "width": 1254, "height": 1254, "sha256": "cd9ee93854a452cc2b5a253ee35d5d57651d5474292ae8af7422331f0379e913", "styleBatch": "HANDPAINTED_R1_20261015"}, {"speciesIndex": 72, "speciesId": "species-072", "displayCode": "MA04", "src": "assets/production/database-handpainted-r1-20261015/species-072.4ca0e10b98584a76.png", "width": 1254, "height": 1254, "sha256": "4ca0e10b98584a76aec0c283b6c5628d34122bd7d60aa63411c7cc2156bfca43", "styleBatch": "HANDPAINTED_R1_20261015"}], sources={"70": {"entity": "m244_vmon", "source": "312cedec215aac952303f51805380bc2daf6641d56fa26f6918f2cac1b8f6494", "version": "owner-articulated-arms-v3"}, "71": {"entity": "m255_guilmon", "source": "02749ee1c31367c0344ca76edf72c51e81742a0d3637e7c343b278ec73d50e2f", "prompt": "c523f648187a01bcc616ac0ef71308c2e191aab74aa2d919f2e79fdc149e6504", "version": "refined-v1"}, "72": {"entity": "m301_ankylomon", "source": "cc71a01d0adaf456552b7a04f1371cff442e151375d1aabbeeb2446f27f3d898", "prompt": "ee4cc541afb63792259972a4bb19e28ad65cbfc5d771544c8fd01e28d987e179", "version": "simplified-v3"}};
 assert.equal(historicalEntries('src/data/championship/database-hero-portraits.r1.json',registry.entries).length,58);assert.equal(manifest.count,44);assert.equal(manifest.entries.length,44);
 const mainEntries=historicalEntries('src/data/championship/database-hero-portraits.r1.json',registry.entries).filter(e=>![36,189,229,230].includes(e.speciesIndex));
 assert.equal(mainEntries.length,54);
 assert.deepEqual(historicalEntries('src/data/championship/database-hero-portraits.r1.json',registry.entries).filter(e=>[229,230].includes(e.speciesIndex)).map(e=>e.speciesIndex).sort((a,b)=>a-b),[229,230]);
 // Historical oracle: restore only the explicitly replaced baby entries before checking its original hash.
 const oldBabies=[{"speciesIndex":9,"speciesId":"species-009","displayCode":"B102","src":"assets/production/database-portraits-b1-20261014/B102.webp","width":1323,"height":1189,"sha256":"03d2bb77ae83d1da119b7d0d4af040851bcb9f887ef939e1ac0fd3426d4252e7"},{"speciesIndex":10,"speciesId":"species-010","displayCode":"B103","src":"assets/production/database-portraits-b1-20261014/B103.webp","width":1312,"height":1199,"sha256":"2f1d8ae53c8e32ab2052cd528294949f6c36d905ec54f17914f824a0645a7059"}];
 // Baseline hash is from immutable main 4803f6c, excluding only redesigned040/063.
 const unchanged49=mainEntries.slice(0,51).filter(e=>![40,63].includes(e.speciesIndex));assert.equal(unchanged49.length,49);
 assert.equal(hash(JSON.stringify(unchanged49.map(e=>approved035062PreviousEntries['src/data/championship/database-hero-portraits.r1.json'].find(old=>old.speciesIndex===e.speciesIndex)??e).map(e=>oldBabies.find(b=>b.speciesIndex===e.speciesIndex)??e))),'ccc555c386f93e1d6763d0bc4363d0e6bb0036f2fd19f77d5982d0d9a261c469');
 assert.deepEqual(mainEntries.slice(51),expected);
 for(const e of expected){assert.deepEqual(critical(approvedHeroPortrait(e.speciesIndex)),critical(e));const raw=fs.readFileSync(e.src);assert.equal(hash(raw),e.sha256);assert.equal(raw.readUInt32BE(16),1254);assert.equal(raw.readUInt32BE(20),1254);assert.equal(raw[25],6);
  const m=manifest.entries.find(x=>x.speciesIndex===e.speciesIndex),s=sources[e.speciesIndex];assert.equal(m.sourceEntityId,s.entity);assert.equal(m.sourceReferenceSha256,s.source);assert.equal(m.selectedGenerationVersion,s.version);
  if(e.speciesIndex===70){assert.equal(m.promptSha256,undefined);assert.equal(m.review.rootReview,'STATIC_FULL_REVIEW_PASS');assert.equal(m.review.runtimeBrowser,'PENDING');assert.equal(m.review.hostedEvidence,undefined);continue;}
  assert.equal(m.promptSha256,s.prompt);
  assert.equal(m.review.rootReview,'SCOPED_HOSTED_VISUAL_PASS');assert.equal(m.review.runtimeBrowser,'PASS_NORMAL_DEX_128_256_LIGHT_DARK_RESPONSIVE');assert.match(m.review.runtimeContainPadding,/24px/);assert.equal(m.review.hostedEvidence.candidateHead,'344010354799c2a6da0c794d7b74de768c6e7cc1');assert.equal(m.review.hostedEvidence.artifactId,11991000289);assert.equal(m.review.hostedEvidence.testedImageSha256,e.sha256);assert.equal(m.review.hostedEvidence.capturePairCount,33);assert.equal(m.review.hostedEvidence.friendsStatus,'PASS');assert.match(m.review.rootReviewScope,/Not an all-roster/);assert.match(m.review.nativeMarginCaveat,/margin/i);
 }
 for(const sp of [74])assert.equal(databaseHeroPortrait(sp),null);for(const sp of [73,75,76,77,78])assert.equal(databaseHeroPortrait(sp).speciesIndex,sp);
 for(const id of [229,230]){assert.equal(approvedHeroPortrait(id).speciesId,`species-${id}`);assert.equal(getProductExtension(id).runtimeReady,true);assert.equal(getDatabaseDisplayEntry(id).displayCode,id===229?'UL34':'UL03');}
 assert.equal(approvedHeroPortrait(117).sha256,'8f7d027cdbf6d3e6d57dbe2f9cb091e42687c01170d1f3ef58ba0413e504a681');
});


test('owner redesign exact PNGs and pending runtime approval cannot reuse prior hosted evidence',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');
 const hash=b=>createHash('sha256').update(b).digest('hex');
 const manifest=JSON.parse(fs.readFileSync('assets/production/database-handpainted-r1-20261015/manifest.json','utf8'));
 const qa=JSON.parse(fs.readFileSync('src/data/championship/qa-database-hero-portraits.r1.json','utf8'));
 const expected=[{"speciesIndex":40,"speciesId":"species-040","displayCode":"GR08","src":"assets/production/database-handpainted-r1-20261015/species-040.a5d0d48e737f81e0.png","width":1254,"height":1254,"sha256":"a5d0d48e737f81e0c955286a94923fe3b70d6483813ee233aedb80a8d89bc3ae","styleBatch":"HANDPAINTED_R1_20261015"},{"speciesIndex":63,"speciesId":"species-063","displayCode":"GR24","src":"assets/production/database-handpainted-r1-20261015/species-063.e403a93ec4f2d7ec.png","width":1254,"height":1254,"sha256":"e403a93ec4f2d7ec24273c2f2f3d861feeec11848d55450989230b2c93283f8a","styleBatch":"HANDPAINTED_R1_20261015"},{"speciesIndex":70,"speciesId":"species-070","displayCode":"GR32","src":"assets/production/database-handpainted-r1-20261015/species-070.2dc33277d80cdfb4.png","width":1254,"height":1254,"sha256":"2dc33277d80cdfb4577bee1d369adb59545b4ccc735a4f90fff342087a1ba738","styleBatch":"HANDPAINTED_R1_20261015"}];
 const versions={40:'owner-bobtail-v3',63:'owner-recolor-v2',70:'owner-articulated-arms-v3'};
 for(const e of expected){
  assert.deepEqual(critical(approvedHeroPortrait(e.speciesIndex)),critical(e));assert.deepEqual(qa.entries.find(x=>x.speciesIndex===e.speciesIndex),e);
  const raw=fs.readFileSync(e.src);assert.equal(hash(raw),e.sha256);assert.equal(raw.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(raw.readUInt32BE(16),e.width);assert.equal(raw.readUInt32BE(20),e.height);assert.equal(raw[25],6);
  const m=manifest.entries.find(x=>x.speciesIndex===e.speciesIndex);
  for(const key of Object.keys(e))assert.deepEqual(m[key],e[key]);
  assert.equal(m.bytes,raw.length);assert.equal(m.selectedGenerationVersion,versions[e.speciesIndex]);assert.equal(m.designRevision,'OWNER_APPROVED_IDENTITY_REVISION_20261016');
  assert.equal(m.review.rootReview,e.speciesIndex===70?'STATIC_FULL_REVIEW_PASS':'STATIC_FULL_AND_128_256_REVIEW_PASS');assert.equal(m.review.runtimeBrowser,'PENDING');assert.equal(m.review.actualAlpha,true);assert.equal(m.review.hostedEvidence,undefined);assert.match(m.review.scope,/Portrait only/);
 }
});

test('redesign leaves every unaffected registry manifest and story entry byte-equivalent in JSON',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');
 // Independent baselines computed from immutable main4803f6c, not the candidate.
 const baselines=[{"path":"src/data/championship/database-hero-portraits.r1.json","exclude":[40,63,70,189],"count":53,"sha256":"e9250d66c1f30fc6972940cb12d70043504fde8373e28f595c7e74a2fb79d05f"},{"path":"src/data/championship/qa-database-hero-portraits.r1.json","exclude":[40,63,70,189],"count":53,"sha256":"901a83186a4adb64beae3aab585f437e023ec0e7758926d6c7d599fee0695b07"},{"path":"assets/production/database-handpainted-r1-20261015/manifest.json","exclude":[40,63,70,189],"count":39,"sha256":"75740553a97bbe7eb15934ed0c6ebf61b893971838d7d90ee7da2ae649b32c8a"},{"path":"src/data/championship/database-original-profiles.r1.json","exclude":[63,92,189],"count":213,"sha256":"9a3883df0624252eeaa4d26166aeb8baf05adbf6f6d2088a04d66926be269169"}];
 const restoredHistoricalEntries={"src/data/championship/database-hero-portraits.r1.json":[{"speciesIndex":9,"speciesId":"species-009","displayCode":"B102","src":"assets/production/database-portraits-b1-20261014/B102.webp","width":1323,"height":1189,"sha256":"03d2bb77ae83d1da119b7d0d4af040851bcb9f887ef939e1ac0fd3426d4252e7"},{"speciesIndex":10,"speciesId":"species-010","displayCode":"B103","src":"assets/production/database-portraits-b1-20261014/B103.webp","width":1312,"height":1199,"sha256":"2f1d8ae53c8e32ab2052cd528294949f6c36d905ec54f17914f824a0645a7059"}],"src/data/championship/qa-database-hero-portraits.r1.json":[{"speciesIndex":9,"speciesId":"species-009","displayCode":"B102","src":"assets/production/database-portraits-b1-20261014/B102.webp","width":1323,"height":1189,"sha256":"03d2bb77ae83d1da119b7d0d4af040851bcb9f887ef939e1ac0fd3426d4252e7"},{"speciesIndex":10,"speciesId":"species-010","displayCode":"B103","src":"assets/production/database-portraits-b1-20261014/B103.webp","width":1312,"height":1199,"sha256":"2f1d8ae53c8e32ab2052cd528294949f6c36d905ec54f17914f824a0645a7059"}],"src/data/championship/database-original-profiles.r1.json":[{"speciesIndex":92,"speciesId":"species-092","displayCode":"MA27","textByLocale":{"zh-Hant":"半人半馬的荒原守衛者，右手配備著厚重的鋼鐵重砲。牠立誓守護廣袤土地上的生靈，踏著沉穩的蹄聲巡視邊境，不容任何掠奪者踏破這片土地的寧靜。","en":"A centaur guardian of open plains, mounting a heavy steel cannon upon its right arm. Pledging to protect all innocent life across the wilderness, its thunderous hooves patrol the frontier, suffering no raider to shatter the peace.","ja":"半人半馬の姿をした荒野の守護者で、右腕には重厚な鉄の長砲を備えている。広大な大地に生きる命を守る誓いを立て、規則正しい蹄の音を響かせて国境を見回り、侵略者の蛮行を決して許さない。","th":"ผู้พิทักษ์แห่งทุ่งรกร้างครึ่งคนครึ่งม้า แขนขวาติดตั้งปืนใหญ่เหล็กกล้าหนาหนัก สาบานว่าจะปกป้องสรรพชีวิตบนผืนดินกว้างใหญ่ ย่างก้าวด้วยเสียงเกือกม้าอันมั่นคงเพื่อตรวจตราชายแดน ไม่ยอมให้ผู้บุกรุกมาทำลายความสงบสุขของดินแดนนี้","vi":"Người gác hoang nguyên nửa người nửa ngựa, cánh tay phải trang bị khẩu trọng pháo sắt thép uy lực. Nó thề bảo vệ vạn vật sinh linh trên thảo nguyên bao la, cất bước móng guốc vững chãi tuần tra biên giới, quyết không dung thứ cho bất kỳ kẻ cướp bóc nào giày xéo sự yên bình."}}]};
 for(const b of baselines){const entries=historicalEntries(b.path,JSON.parse(fs.readFileSync(b.path,'utf8')).entries).map(e=>b.path.endsWith('database-original-profiles.r1.json')?historicalLionProfile(e):e).map(e=>approved035062PreviousEntries[b.path]?.find(old=>old.speciesIndex===e.speciesIndex)??e).map(e=>restoredHistoricalEntries[b.path]?.find(old=>old.speciesIndex===e.speciesIndex)??e).filter(e=>!b.exclude.includes(e.speciesIndex)&&(e.speciesIndex!==36||b.path.endsWith("database-original-profiles.r1.json")));assert.equal(entries.length,b.count);assert.equal(createHash('sha256').update(JSON.stringify(entries)).digest('hex'),b.sha256,b.path);}
 const expected={"zh-Hant":"流淌著古老純血血脈的翠綠幼龍，對自身的驕傲與榮耀有著極高要求。牠每天都在林野間刻苦磨礪尖牙與利爪，渴望與心意相通的夥伴並肩踏上登峰之路。","en":"An emerald-green drake bearing ancient draconic blood, holding its sense of honor to the highest standard. It sharpens its claws and fangs with fierce dedication each day, eager to walk the arduous path to the summit beside a trusted partner.","ja":"古の血統を受け継ぐ翠緑の幼竜で、自らの誇りと誇り高さに対して極めてストイック。日々爪と牙を研ぎ澄ませる鍛錬を怠らず、心を通わせた仲間とともに高みを目指す旅路を待ち望んでいる。","th":"มังกรน้อยสีเขียวมรกตผู้สืบสายเลือดโบราณอันบริสุทธิ์ มีความภาคภูมิใจในเกียรติของตนเองเป็นอย่างยิ่ง ฝึกฝนกรงเล็บและเขี้ยวอย่างไม่ย่อท้อในป่าทุกวัน มุ่งหวังที่จะเคียงบ่าเคียงไหล่กับคู่หูที่รู้ใจก้าวสู่จุดสูงสุด","vi":"Chú rồng con màu xanh lục bảo mang huyết mạch cổ xưa thuần khiết, đặt yêu cầu rất cao về lòng kiêu hãnh và danh dự của bản thân. Mỗi ngày nó đều miệt mài mài giũa móng vuốt và răng nanh, khát khao cùng người bạn đồng điệu kề vai chinh phục đỉnh cao."};
 for(const locale of locales)assert.equal(databaseStory(63,locale),expected[locale]);
 const {speciesName}=await import('../src/championship/text/zhHant.js');
 try{setLocale('zh-Hant');assert.equal(speciesName(63),'翠冠龍');}finally{setLocale('zh-Hant');}
});

// Independent baseline is projected PR41 head 95c392ed74d1c338825931b570fef32e1ae5c690, not a released-main claim.
const BABY_EXPECTED=[{"speciesIndex":9,"speciesId":"species-009","displayCode":"B102","src":"assets/production/database-portraits-b1-20261014/B102.eb7c0e50feb53dc2.png","width":1323,"height":1189,"sha256":"eb7c0e50feb53dc2eb16a12f0457de8911318011aea08526fea2a184472a7f72"},{"speciesIndex":10,"speciesId":"species-010","displayCode":"B103","src":"assets/production/database-portraits-b1-20261014/B103.db66d79eb40c3768.png","width":1312,"height":1199,"sha256":"db66d79eb40c3768b2addfa247c82d7ca2d749f5ba52d9c96778a5787cc53824"}];
test('009010 exact baby PNGs preserve original identity and native dimensions in both registries',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');
 const qa=JSON.parse(fs.readFileSync('src/data/championship/qa-database-hero-portraits.r1.json','utf8'));
 for(const expected of BABY_EXPECTED){
  assert.deepEqual(approvedHeroPortrait(expected.speciesIndex),expected);
  assert.deepEqual(qa.entries.find(e=>e.speciesIndex===expected.speciesIndex),expected);
  const bytes=fs.readFileSync(expected.src);
  assert.equal(createHash('sha256').update(bytes).digest('hex'),expected.sha256);
  assert.equal(bytes.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(bytes.readUInt32BE(16),expected.width);assert.equal(bytes.readUInt32BE(20),expected.height);assert.equal(bytes[25],6);
 }
 const {speciesName}=await import('../src/championship/text/zhHant.js');
 try{setLocale('zh-Hant');assert.equal(speciesName(9),'鐵鈴芽');assert.equal(speciesName(10),'星芽獸');}finally{setLocale('zh-Hant');}
});
test('009010 native-size decode, wrong dimensions and five-language privacy never mutate save state',()=>{
 try{for(const expected of BABY_EXPECTED)for(const locale of locales)for(const registered of [true,false]){
  const sp=expected.speciesIndex,f=makeView({locale,selectedSpeciesIndex:sp,registeredSpecies:registered?[sp]:[],collection:[]});
  try{
   const holder=f.root.querySelector('.cm-dex-hero');
   if(!registered){assert.equal(holder,null);assert.equal(f.root.querySelector('.cm-dex-profile'),null);assert.equal(f.root.querySelector('.cm-dex-data'),null);}
   else{
    assert.equal(f.root.querySelector('.cm-dex-profile__text').textContent,databaseStory(sp,locale));
    const img=holder.querySelector('img'),display=databaseHeroPortrait(sp);assert.equal(img.src,display.src);assert.ok(img.hidden);
    for(const [w,h] of [[1254,1254],[display.height,display.width],[display.width-1,display.height]]){
     img.naturalWidth=w;img.naturalHeight=h;img.onload();assert.ok(img.hidden);assert.equal(holder.dataset.art,'missing');
    }
    img.naturalWidth=display.width;img.naturalHeight=display.height;img.onload();assert.equal(img.hidden,false);assert.equal(holder.dataset.art,'ready');
   }
   f.assertUnchanged();
  }finally{f.dispose();}
 }}finally{setLocale('zh-Hant');}
});
test('baby style and092 story leave every unrelated projected-base entry immutable',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');
 const baselines=[{"path":"src/data/championship/database-hero-portraits.r1.json","exclude":[9,10,40,189],"count":53,"sha256":"15be53ee339cc672564695524e4dda307462fc58fdf365b592bbd75d5aa835e6"},{"path":"src/data/championship/qa-database-hero-portraits.r1.json","exclude":[9,10,40,189],"count":53,"sha256":"ec9b21cf4823fdb8796b4200e47136b36f0e69119cab66e0f23026a0f0523b49"},{"path":"src/data/championship/database-original-profiles.r1.json","exclude":[92,189],"count":214,"sha256":"4e7117c0305f7c23ea73618b1abae27f783f28e99d5bc10a9d773ec9176c5b1f"}];
 for(const b of baselines){const entries=historicalEntries(b.path,JSON.parse(fs.readFileSync(b.path,'utf8')).entries).map(e=>b.path.endsWith('database-original-profiles.r1.json')?historicalLionProfile(e):e).map(e=>approved035062PreviousEntries[b.path]?.find(old=>old.speciesIndex===e.speciesIndex)??e).filter(e=>!b.exclude.includes(e.speciesIndex)&&(e.speciesIndex!==36||b.path.endsWith("database-original-profiles.r1.json")));assert.equal(entries.length,b.count);assert.equal(createHash('sha256').update(JSON.stringify(entries)).digest('hex'),b.sha256,b.path);}
});
test('MA27 four-legged horned guardian renders exact corrected prose in all five locales',()=>{
 const expected={"zh-Hant":"行走於草原與古老遺跡之間的有角守護獸，潔白的鬃毛隨風輕揚，金色角冠映著晨光。牠會循著風中的細微聲響尋找迷途的生命，以穩健的四足帶領牠們走向安全的道路。當草浪間泛起青綠色的光，人們便知道，曠原角騎仍在守望這片土地。","en":"A horned guardian that walks among grasslands and ancient ruins, its white mane stirring in the breeze and its golden antlers catching the morning light. Listening for faint sounds carried by the wind, it seeks out lost creatures and leads them to safety on four steady legs. A green shimmer across the grass is a sign that the guardian still watches over the land.","ja":"草原と古い遺跡の間を歩む、角を持つ守護獣。白いたてがみが風に揺れ、金色の角に朝の光が映る。風が運ぶかすかな音を頼りに迷った命を探し、安定した四本の脚で安全な道へと導く。草の波に青緑の光が差すとき、この大地を見守り続けていることがわかる。","th":"อสูรผู้พิทักษ์มีเขาที่เดินอยู่ระหว่างทุ่งหญ้าและซากโบราณ แผงคอสีขาวพลิ้วตามลม ส่วนเขาสีทองรับแสงยามเช้า มันฟังเสียงแผ่วเบาที่ลมพัดมาเพื่อตามหาชีวิตที่หลงทาง แล้วใช้ขาทั้งสี่ที่มั่นคงนำพวกเขาไปตามเส้นทางปลอดภัย เมื่อแสงสีเขียวอมฟ้าระยิบอยู่เหนือทุ่งหญ้า ผู้คนก็รู้ว่ามันยังคงเฝ้าดูแลผืนดินแห่งนี้","vi":"Linh thú hộ vệ có sừng bước đi giữa đồng cỏ và phế tích cổ, bờm trắng khẽ bay trong gió, đôi sừng vàng đón ánh ban mai. Lắng nghe những âm thanh nhỏ theo gió, nó tìm các sinh linh lạc đường rồi dẫn chúng đến nơi an toàn bằng bốn chân vững chãi. Khi ánh xanh biếc lướt qua sóng cỏ, người ta biết nó vẫn đang trông nom vùng đất này."};
 try{for(const locale of locales){assert.equal(databaseStory(92,locale),expected[locale]);for(const registered of [true,false]){
  const f=makeView({locale,selectedSpeciesIndex:92,registeredSpecies:registered?[92]:[],collection:[]});
  try{assert.equal(f.root.querySelector('.cm-dex-profile__text')?.textContent??null,registered?expected[locale]:null);f.assertUnchanged();}finally{f.dispose();}
 }}}finally{setLocale('zh-Hant');}
});

test('owner-approved040189 exact identity raw bytes and privacy in every locale',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto'); const expected=[{"speciesIndex": 40, "speciesId": "species-040", "displayCode": "GR08", "src": "assets/production/database-handpainted-r1-20261015/species-040.a5d0d48e737f81e0.png", "width": 1254, "height": 1254, "sha256": "a5d0d48e737f81e0c955286a94923fe3b70d6483813ee233aedb80a8d89bc3ae", "styleBatch": "HANDPAINTED_R1_20261015"}, {"speciesIndex": 189, "speciesId": "species-189", "displayCode": "UL06", "src": "assets/production/database-handpainted-r1-20261015/species-189.8c9cac7746647500.png", "width": 1324, "height": 1188, "sha256": "8c9cac7746647500066880fbd869e188d1f3c83fb1ea3069c5e1d3ba8798ee64", "styleBatch": "HANDPAINTED_R1_20261015"}];
 try{for(const e of expected){assert.deepEqual(critical(approvedHeroPortrait(e.speciesIndex)),critical(e));assert.equal(getDatabaseDisplayEntry(e.speciesIndex).displayCode,e.displayCode);const b=fs.readFileSync(e.src);assert.equal(createHash('sha256').update(b).digest('hex'),e.sha256);assert.equal(b.readUInt32BE(16),e.width);assert.equal(b.readUInt32BE(20),e.height);assert.equal(b[25],6);for(const locale of locales)for(const registered of [true,false]){const f=makeView({locale,selectedSpeciesIndex:e.speciesIndex,registeredSpecies:registered?[e.speciesIndex]:[],collection:[]});try{const holder=f.root.querySelector('.cm-dex-hero');if(registered){assert.ok(holder);assert.equal(holder.querySelector('img').src,databaseHeroPortrait(e.speciesIndex).src);}else{assert.equal(holder,null);assert.equal(f.root.querySelector('.cm-dex-profile'),null);}f.assertUnchanged();}finally{f.dispose();}}}}finally{setLocale('zh-Hant');}
});

test('040189 preserve every other 8c7b5ad registry and provenance entry including063070',async()=>{const fs=await import('node:fs'),{createHash}=await import('node:crypto');for(const b of [{"path": "src/data/championship/database-hero-portraits.r1.json", "exclude": [40, 189], "count": 55, "sha256": "de48b6ebd9dfe0f4766634a7e6a313d65e8d1781a583656a2f3624e0dfe885d9"}, {"path": "src/data/championship/qa-database-hero-portraits.r1.json", "exclude": [40, 189], "count": 55, "sha256": "d3318abbdcf07da40d6836ff3d35a129723e231fcc543eea337e3602353bc27b"}, {"path": "assets/production/database-handpainted-r1-20261015/manifest.json", "exclude": [40, 189], "count": 41, "sha256": "0846b1fb82a679a0e9fe6c21a63024d7bcba4111b405ceeb7e839b3f7bbc2242"}]){const e=historicalEntries(b.path,JSON.parse(fs.readFileSync(b.path,'utf8')).entries).map(e=>b.path.endsWith('database-original-profiles.r1.json')?historicalLionProfile(e):e).map(e=>approved035062PreviousEntries[b.path]?.find(old=>old.speciesIndex===e.speciesIndex)??e).filter(e=>!b.exclude.includes(e.speciesIndex)&&(e.speciesIndex!==36||b.path.endsWith("database-original-profiles.r1.json")));assert.equal(e.length,b.count);assert.equal(createHash('sha256').update(JSON.stringify(e)).digest('hex'),b.sha256,b.path);}});

test('189 approved articulated wings align five first sentences while217 other stories remain exact',async()=>{
 const {createHash}=await import('node:crypto');const expected={"zh-Hant": "身披赤紅與深灰戰甲的龍戰士，金色護邊勾勒著甲片，背部可活動的裝甲翼銘刻著自己立下的信條。牠將熱切的守護心意凝聚於雙臂的鋼爪，每當夥伴陷入困境，便迎向風雨為大家開路。", "en": "This dragon warrior wears crimson and charcoal armor outlined with gold trim, with its personal creed engraved on the articulated armored wings upon its back. It channels its fervent wish to protect into the steel claws on both arms, braving the storm to clear a path whenever its companions are in trouble.", "ja": "赤紅と濃い灰色の戦甲をまとった竜の戦士で、装甲の縁は金色に彩られ、背中の可動式の装甲翼には自ら定めた信条が刻まれている。両腕の鋼の爪に熱い守護の思いを込め、仲間が困難に陥るたび、嵐に立ち向かって皆の道を切り開く。", "th": "นักรบมังกรผู้สวมเกราะสีแดงเข้มและเทาถ่าน แผ่นเกราะมีขอบสีทอง และปีกหุ้มเกราะที่ขยับได้บนหลังสลักหลักยึดมั่นซึ่งตนตั้งไว้ มันฝากความมุ่งมั่นอันแรงกล้าที่จะปกป้องไว้ในกรงเล็บเหล็กบนแขนทั้งสอง และเมื่อเพื่อนเผชิญความยากลำบากก็จะฝ่าลมฝนเพื่อเปิดทางให้ทุกคน", "vi": "Chiến binh rồng khoác chiến giáp đỏ thẫm và xám than với viền vàng, đôi cánh bọc giáp có khớp cử động sau lưng khắc tín điều do chính mình đặt ra. Nó gửi gắm lòng thiết tha muốn bảo vệ vào những vuốt thép trên hai cánh tay, sẵn sàng đương đầu với phong ba để mở đường cho mọi người mỗi khi đồng bạn lâm vào khó khăn."}, tails={"zh-Hant": "牠將熱切的守護心意凝聚於雙臂的鋼爪，每當夥伴陷入困境，便迎向風雨為大家開路。", "en": " It channels its fervent wish to protect into the steel claws on both arms, braving the storm to clear a path whenever its companions are in trouble.", "ja": "両腕の鋼の爪に熱い守護の思いを込め、仲間が困難に陥るたび、嵐に立ち向かって皆の道を切り開く。", "th": " มันฝากความมุ่งมั่นอันแรงกล้าที่จะปกป้องไว้ในกรงเล็บเหล็กบนแขนทั้งสอง และเมื่อเพื่อนเผชิญความยากลำบากก็จะฝ่าลมฝนเพื่อเปิดทางให้ทุกคน", "vi": " Nó gửi gắm lòng thiết tha muốn bảo vệ vào những vuốt thép trên hai cánh tay, sẵn sàng đương đầu với phong ba để mở đường cho mọi người mỗi khi đồng bạn lâm vào khó khăn."}, baselines=[{"speciesIndex": 8, "sha256": "34b7c8e2826a257411b4aeafd1ca535d0f8d2b1681db3d06ea26392acc0c24d3"}, {"speciesIndex": 9, "sha256": "0530e88a4df5e476a7c943d1fee0065dcf896b2ce4483e98c6affcbeba934c52"}, {"speciesIndex": 10, "sha256": "921e84cbc21ffb72d93be61d78953bed247d6c05abb25c64bab738e6d9753583"}, {"speciesIndex": 11, "sha256": "ca03cf52b23d57e008be6ee03618a7eb0a3e4828880c41324b852a43cafd6f30"}, {"speciesIndex": 12, "sha256": "3ec41d3d12b4c5b4aacd0b55ce62346ff4b681217720f1ac09f411cde442115c"}, {"speciesIndex": 19, "sha256": "830a6958f3bac99483874e94a4897f7a7dd640a13e96c4f287487d0ec76f2654"}, {"speciesIndex": 13, "sha256": "5778c14a40b6ad532bfee43b29e19c47d036eee7e8b2c47c9c82f20a5b38f2e4"}, {"speciesIndex": 14, "sha256": "be386c153f8ff1eca9b7ff583ceefedc90ac283eea72aa63c8c1222dbe43d3dc"}, {"speciesIndex": 15, "sha256": "fd5da371dac6d7da77844b9e2cdcdf76007edab958a47483aea3c8fc210b21e9"}, {"speciesIndex": 16, "sha256": "fc47d7b4a400308aa99eac9306cebb178239f22bf4d26b2a622d8702d7431f22"}, {"speciesIndex": 17, "sha256": "e46c9a5d3471b13bb4cb9245182601af4020012a57a9a1e4e1b8424c5497abf7"}, {"speciesIndex": 18, "sha256": "ca2e1d5bdfd9bfe85ef9002a88816ec85e4ac08aeeb224dc4b93aac84f8c8ceb"}, {"speciesIndex": 20, "sha256": "87eae0d1ba34a2d93dd0384989878f4f68ae129e9f1c2689fde3d2538855644e"}, {"speciesIndex": 21, "sha256": "ba5fb92c844a20e316ac2dbdcda29df3ec7eea46bbccc25d2db45608a6ad4569"}, {"speciesIndex": 32, "sha256": "0cc5a1e3987a63f9f1ca5034fc762c95c27746314a4e6886f21921a13de5dd29"}, {"speciesIndex": 22, "sha256": "1604ea05127cb6ab7eee3d23c7769a50249a337a4c6e132105b86ff8dfd748d4"}, {"speciesIndex": 23, "sha256": "b40665e67370b8ebe1606b9f753583ef62e8523ff5e275690494f021aef08fc7"}, {"speciesIndex": 24, "sha256": "95337950b112b30bc23896326abdfeb5ef28a24cdbd69045a9adf433bbc6837c"}, {"speciesIndex": 25, "sha256": "b8f87e7f2710b4a8d17d0a0bdcbdc9ec1501db0a9681534d71536c88b91cce17"}, {"speciesIndex": 26, "sha256": "39e2abedeb78cb86ab279ee5188b194638132b8308314a05ab874ce72bac6a63"}, {"speciesIndex": 27, "sha256": "46a8758c3484034729ac8f7fcd2220c38992cdcabdc55bcf1b65a9ddd960ec2a"}, {"speciesIndex": 28, "sha256": "584ff41f8d9cf94b58bcaac67605f5c7b2270aa6535172b3af76752be594404f"}, {"speciesIndex": 29, "sha256": "44fec5e85b5e1bf0cba22c09c4459b0608a16601879467121a333756f8ed6b0c"}, {"speciesIndex": 31, "sha256": "33329cd1c74e358f5a85c5a7597b7f2cf7ae3da0b6131ab182b06ff94f90a4ba"}, {"speciesIndex": 33, "sha256": "26e3f691c68d69a904fd957f5182ee08aad1bae1aebd24387c6e739117e9e4c3"}, {"speciesIndex": 30, "sha256": "c08ba4f1359eafb4221ffd3a684de68aa42e9cbba7edae0c6904577b02586e3f"}, {"speciesIndex": 34, "sha256": "9ce74f187916de9a9075716ce2166e49df8dc9ffb066ab1a4fd661202d26dcac"}, {"speciesIndex": 35, "sha256": "4bdd9842b29ce1cf8592cb3b16b7ee1d65b75b5774d9258efdc2ba35a2dfe590"}, {"speciesIndex": 68, "sha256": "397d3ee95490c2f16821847837d2e7d0d456916afd0fecd4689420fd1c2577b5"}, {"speciesIndex": 36, "sha256": "b21712e108f5d2d4258520b1aad49e324df065c197d2bd903897da4ac49719e1"}, {"speciesIndex": 37, "sha256": "635c5cbefa9f43e65f66611db6c6ba33a9c25a61c1f07f38298cbbee459e2ea5"}, {"speciesIndex": 38, "sha256": "00cd94a917430488d45c25dd1fb2da1768317e6e3f522e1a304fd2dca1b481fc"}, {"speciesIndex": 39, "sha256": "a44a2e4c0eaefc01dbe8a1ddcf5c4c5b13611fad811a95c45165813888c18f9c"}, {"speciesIndex": 40, "sha256": "07db015727fb7922539d7f95bc9085ad8c9e3d186b30641435e139e95e42e537"}, {"speciesIndex": 41, "sha256": "0af55b5530bbb2d9e3bf81b0a346df3d1ccc594998d3ebe9299c7194c1960101"}, {"speciesIndex": 42, "sha256": "5e53150806efbd07e60565018b7f4350b4fa49354e7688f7cc79a3634eca26be"}, {"speciesIndex": 43, "sha256": "bf88251ea45c6c8c52d41e19605ac08097bb856c690b151c735d3bc1d92aa2ff"}, {"speciesIndex": 71, "sha256": "c1d5f5edb97f3365452c9198fb50d06bf8deedf42e026475bf37b7ad6dc68225"}, {"speciesIndex": 44, "sha256": "52dc9f589abbe537f7340d74d5a32febfcfcc58f42ee1ae70d0f2ad30f9ae066"}, {"speciesIndex": 66, "sha256": "de7843cd63253f4122e0f9fd6f4a3d4a17ed699f55573b6d6a80119d52d0f527"}, {"speciesIndex": 45, "sha256": "8c9dd80410cd63ea275ceef402cdc8c9fe0b41c73f9dc3183792d8e4efefb669"}, {"speciesIndex": 46, "sha256": "8f9d626b9c1d652b9b83eacf2f4de8a24d16b02c25f1aeebf1c85576968895c8"}, {"speciesIndex": 47, "sha256": "c0ee2385481f2bd6210f3118f34681835639a0a3afaaa197421900766ce4ee1e"}, {"speciesIndex": 64, "sha256": "f3ec17a727d82d61eee2b5ecb6f2aaa506b73982a9c2efb366b0bae7d37691bb"}, {"speciesIndex": 67, "sha256": "82713f3f22a5375b7d053929baa3f84b81541bd8f9bd7b24211adee451cef3ee"}, {"speciesIndex": 69, "sha256": "99bacb5e759fdddb5f5db09516265bfec79144899dff1ee9bf7df2fb0fa7b781"}, {"speciesIndex": 48, "sha256": "06e48558c529ad153f38bc40dd2b2eb57628914ce1063c4dbfe6a64e036a2b9e"}, {"speciesIndex": 49, "sha256": "6025ee05e1ea6f5c78802277df82100f11a5b03c21d3ecdf660722738c631822"}, {"speciesIndex": 50, "sha256": "9316bad6e989f916a0f624d76ccb488b8a84d13768b635dc22ea4a27e855beed"}, {"speciesIndex": 63, "sha256": "dfb77b2b45b7874decabe2e5a42e2c3df40c3803c40fbe0c1f8e127c5d98831b"}, {"speciesIndex": 51, "sha256": "f102a47fac205a709eca7edea0c11410f40b132031562ae671896f89b0acbe82"}, {"speciesIndex": 52, "sha256": "04e3c6dddf79d86e0c592412a8e99d903ca2447e700ebb754f08fc783680d22e"}, {"speciesIndex": 53, "sha256": "bf032e3cd84f6a0366436b540840306e8bb07031c3645e3e3bbc7f1fe9231bf6"}, {"speciesIndex": 54, "sha256": "d6942c5f88c23851559bcadda1e040dc305a75c9d41b03196c9cd5becb0036cf"}, {"speciesIndex": 55, "sha256": "2b6dbc8849ae5e0f7adbf3ba75bbb3430f1328cd9c104c9337840cffd7c840ae"}, {"speciesIndex": 56, "sha256": "e5d5918a9c059bd7bf45b320ee9c6239c93149c462af8f90402b256dd5d45145"}, {"speciesIndex": 57, "sha256": "bfb5a09419143268226ee2c4ad4b13ae063ec9fd05ee137d24632965ba41542d"}, {"speciesIndex": 70, "sha256": "0c015760b4f8f6c2b64408d2e3075b0915cc9dedfc410dd09d21446bb5fc548d"}, {"speciesIndex": 58, "sha256": "1a46554e3955a7c671db4338ca79dcc02d386f77c6026c61390f172498497319"}, {"speciesIndex": 59, "sha256": "c3c523304ff2c16e24e1404e82cbb6ad3bcd2de9da85c5df9ad5c3ac8f1a1d1a"}, {"speciesIndex": 60, "sha256": "b46adf34eb3c70468236faff19ce35be67c8c705bf657d57aed29d0176567786"}, {"speciesIndex": 61, "sha256": "e946490f1cc48f70d7ecdbb827617ce413b924167a04e575dd5e39d166b3b698"}, {"speciesIndex": 65, "sha256": "be8c9b12f11da245d941ad954c5d6836f8e0b012e556e3f664e0a664bc798817"}, {"speciesIndex": 62, "sha256": "5f40810fe99228a83822d9b44f530653f0b7a5e98849c1f4d7a55cee185deb0b"}, {"speciesIndex": 127, "sha256": "5bad54373e58021dd24db949f629c9ea70e78b11e26c6906390fd410c8eb27a6"}, {"speciesIndex": 133, "sha256": "717e3392fd28cc013a502e6740f6304e5f544d2b8659c5aa2586f714d882959d"}, {"speciesIndex": 131, "sha256": "5f22358cd53062fe328c25c04d1c3b7839c8525a844c5cc5b632bb880e5cd631"}, {"speciesIndex": 72, "sha256": "8e1a805373cd921372f5dc807d8336506a1d46267406d8df2cb8e585b7d73b09"}, {"speciesIndex": 73, "sha256": "c9eb2be656f49b77d526acbfd17fc800600b6708b99c8e7590f4d111622bbae0"}, {"speciesIndex": 74, "sha256": "9ce81293226909649df5239356f0e45b7b3f4870fe4062c0f148a86a4e14e866"}, {"speciesIndex": 75, "sha256": "be9f6ab7a205ba976bc98113f53c5b997612f48d99304b2829eca97d76fe9baa"}, {"speciesIndex": 76, "sha256": "122888826874a7a15f2e1686c41e6526bbb6dc584f52cda1716eb375aea2d84a"}, {"speciesIndex": 77, "sha256": "7c27ced1f01ba914fd25a49cd7aab3e4243ca2263a1e4e234332636fb31068eb"}, {"speciesIndex": 78, "sha256": "6ea2ebae27279df7c6c394088eac415b36cc745a3b9d20d7caf6d7d43aa1ac06"}, {"speciesIndex": 79, "sha256": "d8ec64dfa50ca1f8401bdefa86ed1d55ada9aa827fd7f1381c9d6d4bfa955a9f"}, {"speciesIndex": 80, "sha256": "ee1db30e2fb88ac1a0735eab1edb2c8084c6bbeb10eddae03caa124770244ceb"}, {"speciesIndex": 84, "sha256": "0728f2ecce2a589a79ee844efdad5801953aac6b08230c21f7420542aeabf2b0"}, {"speciesIndex": 81, "sha256": "a0b897cbf1c7b0d1d09e469e4e46b366fc1dea0ab47bb2982c0e824afc855c53"}, {"speciesIndex": 82, "sha256": "02a2f8cb002f8b0ed01ea8723784686d8f92d8e3bf19b9c7a100c22ac12643a3"}, {"speciesIndex": 83, "sha256": "96f33d2aacf229676b8e2fe0a5bea0db2e4884db06c7c2768407d2fe729ed5e2"}, {"speciesIndex": 85, "sha256": "3c8b6d1c01b6597c53fc7a305072033a68314d1185f31f5a021c7093acd3c444"}, {"speciesIndex": 86, "sha256": "cb6bb56752078f4b111fa2602bfa0430f0ce177122da576dc20eb57a5f8b49e4"}, {"speciesIndex": 135, "sha256": "9fa5015869ee16d314e5728b8083a1bb406d8c40bc76b4915ac1d6f52438494c"}, {"speciesIndex": 128, "sha256": "ed1784127b706967aaf6f923afd8acd76908d8eb8d6041e42fb454b50d013e87"}, {"speciesIndex": 87, "sha256": "efe7a3e6b93946c7f84ca79d6c373dc7bcec12fb3795f598850b38af2cf71b58"}, {"speciesIndex": 88, "sha256": "ed04f1463980d7afd68736002a8de55d3a8bcecdc2403600d7af8579d7d235b8"}, {"speciesIndex": 89, "sha256": "271679c074abde9b087a732515f08b959b18e7ac3aa2dbeee359780c2bebaa58"}, {"speciesIndex": 90, "sha256": "962a3e613dbbd7b8c6a6cc93a60e8b40d1d1f86fa75e7b5895f4444b625cb007"}, {"speciesIndex": 91, "sha256": "57be306e02081208ab76d3a0fb376767e4d2242553d193bee28bb749d1c85a74"}, {"speciesIndex": 129, "sha256": "0a5f1a3e7f286e435cefad4c8fcfde383755ce5c822b8e2da15fbe9f4b866330"}, {"speciesIndex": 92, "sha256": "a8a80cf34fec03d98f55dcffcaa0fa0cd5cd79d1b27146b94fb7b4ad2731088a"}, {"speciesIndex": 123, "sha256": "54126cfedd00cff0e09207f58acc3f133fa2134427a265e0c9e1ee9df3b894ff"}, {"speciesIndex": 124, "sha256": "2bc3638902368b5019ef0808cf888191c3cecc1875a96f5494c2b74c52905c70"}, {"speciesIndex": 93, "sha256": "4ba3827ced8dd764ca29aa1706e254ba0d506381612c6bc1b6d9e360f5a845d0"}, {"speciesIndex": 94, "sha256": "c44175ee335b014cf038557224f57f030ef177eceee22fb56b0c840a059143a5"}, {"speciesIndex": 95, "sha256": "85b2d227fc0dbea1d1e00d5fb6119b11942f696d4b9cbb8beb9d273d89623dcd"}, {"speciesIndex": 97, "sha256": "f5ce3174b89a86c8f2c2917fe9639066a9bb7e6ad33ecd0935ff88005ea8823f"}, {"speciesIndex": 96, "sha256": "04f02fc74f4b5fcc2b385a33539d3b00d9604313d0a77525cb222735be47a753"}, {"speciesIndex": 98, "sha256": "1eaf202faae054520d65278a4d1bb99b539837f597e8959adea9e57c3c7c4f74"}, {"speciesIndex": 99, "sha256": "08677a85683c8154366e4936d0c2775f91bde6c31ffccc4d63569e12e1b9e547"}, {"speciesIndex": 132, "sha256": "c541a3d46215e5a765786e788410335ffbef079f11d9e5135f7cfcbb6bf66dda"}, {"speciesIndex": 130, "sha256": "1a3a070401d9f7d1bdef0ef62e72d43472cdecd11a2637516725d848a4499bb5"}, {"speciesIndex": 101, "sha256": "a66d96c2c7ed3cbc220401201d0bdfed6da13f085aa5c6328c4ccd23dda8cab4"}, {"speciesIndex": 100, "sha256": "19f05b1635e9ee911fcc338304c42a74e84655de2ca0f8ce040c8042b510843b"}, {"speciesIndex": 102, "sha256": "e9603655051729b9d3df8ce840e2c100e9af454ac048cfd7700384095ae42c6d"}, {"speciesIndex": 103, "sha256": "90561da84428cb27b86e79c6f7e3f2d616e4360c43686304bec5067ebeb31780"}, {"speciesIndex": 104, "sha256": "9db067759daf5b9ba50be1297cedd3e899f66fb29675eda9159ac67409f06e6e"}, {"speciesIndex": 105, "sha256": "8a4752c2dd6a08cb6befd3832bcf270cbc360b0d30c91983daa27f6e4bec4231"}, {"speciesIndex": 107, "sha256": "dc663ec56ab7def65198aef59258370604f42fde5a068e4f72eb9cf0519d5726"}, {"speciesIndex": 106, "sha256": "84f19825fe729c5ccf1ee1513704b03e5c73bd1c53a4ce97608158ced39efe71"}, {"speciesIndex": 108, "sha256": "83546a3597c5d751a23f521547b019661291bf9550568394d7c9d49e1d616d98"}, {"speciesIndex": 110, "sha256": "282ddc989d2016b59e2014d0ad8ea69d473f93bc60d5de2df1f179dc7c9b1560"}, {"speciesIndex": 109, "sha256": "b2949002e686ecc952339033fee40082533044b10c2a234529c12b28ffbcf39d"}, {"speciesIndex": 125, "sha256": "14948ec9d93bdacc6ba53bc4458a0ca8db1e2b8b1832d7c8850c9fdfe600c379"}, {"speciesIndex": 134, "sha256": "a18c663771f5727581fcc1966b0887554b110943b3ba0fbaa8138dc23acb45d5"}, {"speciesIndex": 111, "sha256": "bb3975f6f0031072e092383081c474cfa340eff59d657fd8f85a0a92b79c4da9"}, {"speciesIndex": 112, "sha256": "4e70e172cec7a74c47a2ebe5e5a8927bf037d377bf4c47ba377d48c13d020bb3"}, {"speciesIndex": 113, "sha256": "65ce60465dbfb77287f96b11445a09cbd73d8157c2d682a9c5ec56f185694d78"}, {"speciesIndex": 114, "sha256": "930581e8c46166384fcfeb66d7a3077f5551ce2fa2321765b6d81f1089fffe20"}, {"speciesIndex": 115, "sha256": "9b9f8b0d29a28478ec9edfef739ca02a722db0c14671a9d0b2271ce508939be3"}, {"speciesIndex": 116, "sha256": "05288bab5cb0d889a204bac5343a59af096bd48b44012c21ea841071bc2b4d73"}, {"speciesIndex": 117, "sha256": "e454f4dcda3d97a105761debaae4cf4a3b598b5987b3d0a65dfcf594f03ac42c"}, {"speciesIndex": 118, "sha256": "aec928bc392f820b2f2df18322d590ed80233e262bcc008b28a27059ac97514e"}, {"speciesIndex": 119, "sha256": "0f72f4fa36fdaee58c8c4a34db8e80c9751757a9208bd999a92ca958ccff15af"}, {"speciesIndex": 120, "sha256": "556e10c7ab9f8b060ce45b62f9382aec2a185f902ac98a1736107428e9fed0d5"}, {"speciesIndex": 121, "sha256": "3cab04ff90246e5e7811f21bea3c5a8ed17d927468722514a1459eb8222912ef"}, {"speciesIndex": 126, "sha256": "23ce88c5f5028872fcffd902e20cad3a597b22129652b4bd0f61cbafae120fdc"}, {"speciesIndex": 122, "sha256": "0fb327e243c4d6737599e1c239172e92c29a530b5d2a5529416552b3457f1e52"}, {"speciesIndex": 136, "sha256": "509f6220396431cf22e6c672d5defbc3893c9a1a99f57a6ff3507bcd9dc63389"}, {"speciesIndex": 137, "sha256": "714592ebcdd8ae0e83ee383f2cbdf5bc60b8a90625ed24322534a0925d3b6527"}, {"speciesIndex": 138, "sha256": "83d6633b67f051a155dc3e6250c6334be53ddb77cb1a153645806fc0389cfdeb"}, {"speciesIndex": 180, "sha256": "680cde1cbc26471019603420dcb96ae2313cb60b6fb1330988c0553d0b831657"}, {"speciesIndex": 139, "sha256": "7cb04f58dabddc0707e1388111b7ae6221a1047415b51eb23f9646ce21083335"}, {"speciesIndex": 140, "sha256": "85757b557081fe2cc71fc83ffe8768abedd9952232fb507455734f38952d5b98"}, {"speciesIndex": 141, "sha256": "be0e7842ca2210d4373a67c118bdc0abd654ff5983f401103a5da26419eab5b7"}, {"speciesIndex": 143, "sha256": "056b22c6a629009117d6310de3a80d56edd6046926163490a36fae7a6491826b"}, {"speciesIndex": 142, "sha256": "5a097fab915494714f39f9105b303b137ba5bc6f64e852d85b8c9da1e5e3fbb0"}, {"speciesIndex": 181, "sha256": "306f15535d0bf39b13250010cedce0dd7c85016d6cc11d271adf25b4eb3a411d"}, {"speciesIndex": 183, "sha256": "98882168c9e60a1ff6dc0430c03a8187e8c162b58e5519d8035497aecd313117"}, {"speciesIndex": 144, "sha256": "037e2c20e6f0703443928817a9a39046a8ca1c8e735c199c9a1f08d8cee127bc"}, {"speciesIndex": 145, "sha256": "45efcac1082c422b1d9225e9d52d6a0cda4ecbd2a808e90d26127296814f51d2"}, {"speciesIndex": 146, "sha256": "77e12872d4859ed1ee148cc2babaf91c803f055963096c4a015281b68281a6c8"}, {"speciesIndex": 147, "sha256": "ab30dcff3c619b1a19bcc39e94b4ebac65ae0d7f60232dfebd463b92a7bfd66e"}, {"speciesIndex": 184, "sha256": "314892237dfe02492d2025237d6dccbc80a0c0484e8e312c5da1cbaa29cf8bd5"}, {"speciesIndex": 148, "sha256": "7bbdec4927fe59b38d8784b818359c764527f2c1be12f965dc1eac155610d437"}, {"speciesIndex": 149, "sha256": "3e96a5303bb6f6ff71a045e3eff5709cc55bce1388451cec18fa1a46a3838f1a"}, {"speciesIndex": 150, "sha256": "31b7e80098fa7ffe2ad220e86f5cbb7255e080e489a9dfdd0d02a52eeea5e5ec"}, {"speciesIndex": 151, "sha256": "c4ba2ba197cd1e5cd6213bb895585b636f10bb8d4d964fe20ddd42da458144eb"}, {"speciesIndex": 152, "sha256": "f77b6b6753d75a7b8792bc9e708a30856893329945c3c3fc428a275378f64b22"}, {"speciesIndex": 153, "sha256": "b2966af7651470d7dce40bf464e640ec2f710a870bcecf4ed20c8e7b2b072c05"}, {"speciesIndex": 154, "sha256": "35c0631ab8115d2cc3458db204f0d5a80a621e01a056fba6a7ad1d93b3e3c279"}, {"speciesIndex": 155, "sha256": "cd4fa1aeb7830d0cb0523f3b98e1fb69d10d3e35fc8f4d97b6c201cf668f78c7"}, {"speciesIndex": 156, "sha256": "2edb2388e99b140125de36c0de64e81076dbeb81c71076f64b9fe86cbab43a03"}, {"speciesIndex": 157, "sha256": "d1e0f1f2995cba41026295001ca379ec8b220fd1ec2751c8ce06cb23b8d4c718"}, {"speciesIndex": 158, "sha256": "01add26d56c8bc8537a152c9eaf83fc2b13f292bede8b19970596b7c46f6672b"}, {"speciesIndex": 159, "sha256": "1eea65352abd1915ec8362fc617e21733cf8c475e5fdec24f169123ec554a389"}, {"speciesIndex": 185, "sha256": "35a8a0b8a805d3e8004fded9d9bd7ddb7e3f908fb986092cd92177239bb267d6"}, {"speciesIndex": 186, "sha256": "a6d184ddce8b3f7a6ea0be891ecf3b3ea87601202b0d88128f3d726e27686bfb"}, {"speciesIndex": 182, "sha256": "fe7b739487383ec1c38ec72db5c0398f7d7fdeffc4d06e68cd2ff2358ad5960b"}, {"speciesIndex": 160, "sha256": "c8cb0504db0975e90d7931192aceee6e356d4b06fa1e9361ecf881e5d5d7f8bf"}, {"speciesIndex": 162, "sha256": "10588b68e7d153d7849603254029b49d740551681552fd890b23274414ae7b17"}, {"speciesIndex": 161, "sha256": "c3076627b3f3148e4d577369569610c50f72753c451d3a56f98ac950cbc7deae"}, {"speciesIndex": 163, "sha256": "5011c9976e437147c7161b4523387eb6a331b270c02758104918da8e8a547167"}, {"speciesIndex": 164, "sha256": "1a2cd61e424bfa121c11fb21d130278a07f8b7b106d27a41d225719255b7204d"}, {"speciesIndex": 165, "sha256": "5579c900bedd7a78f0afeaf5db71eb91175d5750f7c2ddbbb0cb6ed9dc44b6e1"}, {"speciesIndex": 166, "sha256": "60530e8a7fff235becc15b6ae1194ad7a70811536eadca1d793de680dc5bbfa9"}, {"speciesIndex": 167, "sha256": "ac3eee7cdef25d6954571fd98e3361b26c6f9d6acdc1607e9f130b9aab02226c"}, {"speciesIndex": 168, "sha256": "0dd4aaf71e8b9fb9414e2c5a3a31a41a0cb38e5f490dadc53d080f7314a08d99"}, {"speciesIndex": 169, "sha256": "2174224106401f3b7f8069ce96c8c5b544875e0ca5c112424e33afe8ec9e2c63"}, {"speciesIndex": 170, "sha256": "b971ae6a053859a5692e5535b0fc51691d8b64105abb0c1a17c69db4c26cb652"}, {"speciesIndex": 171, "sha256": "eaca85803697a94a4569c312fc28bbc957dce4e6929de450a0240cadf0df3a84"}, {"speciesIndex": 172, "sha256": "18551e16624052c9e630da005793787824961171b4997aafe673d850d17f06ed"}, {"speciesIndex": 173, "sha256": "e54b00cbc2f4fb035f7be431f352a9ecb8186ba43754aa8dabea80c5c3fdd2e4"}, {"speciesIndex": 174, "sha256": "c64478e3b04dc661db4f57fa67129eedda75a6390f2c0705e80effd0e2d93b10"}, {"speciesIndex": 175, "sha256": "9bff1ed06d4661b86370c7671fc2c55c046fa6f8269cfe0dbc85f879102039df"}, {"speciesIndex": 176, "sha256": "33f212dd0c7d718e183aa497cd429a6fff0da15438107a34a3a08e8220130501"}, {"speciesIndex": 178, "sha256": "9dcb58904684109f9195b8cd1f6c6c366ebc6ac8fceecdedc10c03fe4f70f515"}, {"speciesIndex": 179, "sha256": "fd61e129f695b625603ee965be6bc691d343c24e6d65e142611c463f4effd4ca"}, {"speciesIndex": 177, "sha256": "208eab55d2e0f80b859523aa6f2e7606d95f982aa4ea04e5fc0e79042d1c603c"}, {"speciesIndex": 220, "sha256": "1c107efb249f7da9d96378c27ea97f8ea203ba07d072fd21d8c66aa8ed7aa51c"}, {"speciesIndex": 222, "sha256": "c65d2bea054125e14a8ec5345e925edeee28a7d7b6e272040e289c2d543ea913"}, {"speciesIndex": 187, "sha256": "722df0f6968c9f3eaeff96ed9d995bce94726f0ccf81dcdc88a9accca88f432c"}, {"speciesIndex": 188, "sha256": "a243bb66013e7f73e1abc155235c8d24f5aea964fb9e2f975894e1d6c42071ec"}, {"speciesIndex": 190, "sha256": "37285f90c3f3704e3748f414ec7abcc6fed154d83ec245dde599911c2d22e285"}, {"speciesIndex": 191, "sha256": "b5c47ab736d604cdb3dee1915bf115c8500f35facbfbfb0d2e9f0d1ac80c8f65"}, {"speciesIndex": 192, "sha256": "d942c413294d21161db64594725fe15842b94b409c7f709855041c5b628e2210"}, {"speciesIndex": 193, "sha256": "7286e9531d2957352c6d6dbc6e5bf9c4b7d116f6e58eee271d37ab065a995939"}, {"speciesIndex": 194, "sha256": "ca5949c0a08a8df914fb1e5598204e370a455532e27afb1cbcddfca771a908fa"}, {"speciesIndex": 195, "sha256": "effa397e69dbb205117657b6afa7559234135bed627f341f45b2ba0279120de8"}, {"speciesIndex": 216, "sha256": "dbd4e9088043326e731a7c4460bdc999fa65aaf790e667c01b5e23f6306ed9d2"}, {"speciesIndex": 196, "sha256": "b78a6ed1d3ca2bab15a9048ef8b7959d01649071fb48766889c67032267df3ef"}, {"speciesIndex": 218, "sha256": "fc4390bee7440e083a220ad597f706e61c00a5fa351b4fa4b4af1ece7839f371"}, {"speciesIndex": 197, "sha256": "1d9f4de88c2d2cc72b6c6edef2b7c23eba1f63de16ccf3be6d68d6d5ed46d25d"}, {"speciesIndex": 221, "sha256": "7a792f3b5986d3accdc6fcd1f9344623a95f6a2a7871afcf8bdb29474a1dc723"}, {"speciesIndex": 223, "sha256": "87a95048e6186efb21d983fd6d0a19c6f19ab113d3751ffdc0bd40d3c972e5cc"}, {"speciesIndex": 198, "sha256": "8119675cb4240a3bd95d41e4864fd10b01af32fc128d1397058786fb37f6630a"}, {"speciesIndex": 199, "sha256": "89cb13f4388e675d3a3b4da97e811a5ec924cb3b3ef334be65c1d3085f595e7f"}, {"speciesIndex": 200, "sha256": "ab8c566ea799c7263decf49117e1054bdb8c806bd53e31b4673ba64790cd5588"}, {"speciesIndex": 217, "sha256": "31e3a58799f32e2c1c1e2f436d03900a880a4e17408e31f10b9e7fd085915808"}, {"speciesIndex": 201, "sha256": "f3de5f78272e02fe87e81de046899ef88f35921b79ab3e55a9c21194994c2c8c"}, {"speciesIndex": 202, "sha256": "8c025b87e4077fe49d167fb264d7ffb13ae8ffff24eb81ecaa437b7056dc6b88"}, {"speciesIndex": 203, "sha256": "0d4be2046d121ae1e2e3e25baa7605fdf22acde1f103cf4bf9ac745b0a546da3"}, {"speciesIndex": 204, "sha256": "b622dce2625bc42ab9b3a6d092170647f400d035ebb50679e28cf954562a3380"}, {"speciesIndex": 205, "sha256": "4a487f777f64aadaabfe924057935441d573fc92b0839c8bcb306799af188e56"}, {"speciesIndex": 219, "sha256": "c28f3d451043316c8dd173be5fca540c93bf999634f73895986b289846ce3504"}, {"speciesIndex": 206, "sha256": "133f292f8541e5d7ff96a4ca5aaa69f507eb3c2b90914fe20aa0a985d94b2d67"}, {"speciesIndex": 207, "sha256": "d00cc7d96259705e6bd2fd3c35c876dfb546c4eb11e5a673d92b874e2917830c"}, {"speciesIndex": 208, "sha256": "a3ba9ef2c9336df976e18971bcca4da2cf5087b08fe44284f85d838420a2b617"}, {"speciesIndex": 209, "sha256": "14e361c9331905aae778c58eaae9b7b00cdc78a71eb41841129c5e3232f8c02a"}, {"speciesIndex": 210, "sha256": "faba036d43819a4c618548959e7a8098ba689300441d90df9dbdad2d5219e145"}, {"speciesIndex": 211, "sha256": "5ac0d63d49f20951aeed0723bb37b9bdfe13b63ee6dfab4362f454d9499c1dbc"}, {"speciesIndex": 212, "sha256": "51de4116dc16264c9da0be0d258145f69995b9eac19b7c85e1b87712da2cf6ff"}, {"speciesIndex": 213, "sha256": "823004f57896d90ce7c845bd5cf9917ffc52c33db4a9cec65114e4adbe8050c1"}, {"speciesIndex": 214, "sha256": "5517b25ca2e7286ca65ca69b7e3d213c8f7fad28b13b6114adcf60617e57eaf1"}, {"speciesIndex": 215, "sha256": "0d2be53d59b95c2342a329c87f509e5d3323cbf2f3f5da28702da0790670d8fb"}, {"speciesIndex": 229, "sha256": "564c3875a8370f8a3a73761375b8e12c34421074cdf2c72c35b5fb6aee54b697"}, {"speciesIndex": 230, "sha256": "5e8b83e90ae22e689d971399826c0fad8998a6a31867de85d5ff0b165a562932"}];
 assert.equal(baselines.length,217);for(const b of baselines){const old=unarmedStoryBefore.entries.find(e=>e.speciesIndex===b.speciesIndex)??previousLionProfiles.find(e=>e.speciesIndex===b.speciesIndex);const text=Object.fromEntries(locales.map(l=>[l,old?.textByLocale[l]??databaseStory(b.speciesIndex,l)]));assert.equal(createHash('sha256').update(JSON.stringify(text)).digest('hex'),b.sha256,`Unaffected story ${b.speciesIndex}`);}
 const wings={'zh-Hant':'可活動的裝甲翼',en:'articulated armored wings',ja:'可動式の装甲翼',th:'ปีกหุ้มเกราะที่ขยับได้',vi:'cánh bọc giáp có khớp cử động'};
 const shields={'zh-Hant':'大盾',en:'shield',ja:'大盾',th:'โล่',vi:'khiên'};
 for(const locale of locales){const text=databaseStory(189,locale);assert.equal(text,expected[locale]);assert.ok(text.endsWith(tails[locale]));assert.ok(text.includes(wings[locale]));assert.ok(!text.includes(shields[locale]));}
});

// Frozen e96d400a historical projection; current identities are checked independently below.
const approved035062PreviousEntries={"src/data/championship/database-hero-portraits.r1.json":[{"speciesIndex":35,"speciesId":"species-035","displayCode":"GR02","src":"assets/production/database-handpainted-r1-20261015/species-035.be1631a7ffea0de4.png","width":1254,"height":1254,"sha256":"be1631a7ffea0de43921ed7eb3e1196be6705fe026439abe9b90e14b564965c7","styleBatch":"HANDPAINTED_R1_20261015"},{"speciesIndex":62,"speciesId":"species-062","displayCode":"GR38","src":"assets/production/database-handpainted-r1-20261015/species-062.25391107e04095f4.png","width":1254,"height":1254,"sha256":"25391107e04095f4bd706ffc106e6f90d10911d0baca637db3ed2114c9a2ef91","styleBatch":"HANDPAINTED_R1_20261015"}],"src/data/championship/qa-database-hero-portraits.r1.json":[{"speciesIndex":35,"speciesId":"species-035","displayCode":"GR02","src":"assets/production/database-handpainted-r1-20261015/species-035.be1631a7ffea0de4.png","width":1254,"height":1254,"sha256":"be1631a7ffea0de43921ed7eb3e1196be6705fe026439abe9b90e14b564965c7","styleBatch":"HANDPAINTED_R1_20261015"},{"speciesIndex":62,"speciesId":"species-062","displayCode":"GR38","src":"assets/production/database-handpainted-r1-20261015/species-062.25391107e04095f4.png","width":1254,"height":1254,"sha256":"25391107e04095f4bd706ffc106e6f90d10911d0baca637db3ed2114c9a2ef91","styleBatch":"HANDPAINTED_R1_20261015"}],"assets/production/database-handpainted-r1-20261015/manifest.json":[{"speciesIndex":35,"speciesId":"species-035","displayCode":"GR02","src":"assets/production/database-handpainted-r1-20261015/species-035.be1631a7ffea0de4.png","width":1254,"height":1254,"sha256":"be1631a7ffea0de43921ed7eb3e1196be6705fe026439abe9b90e14b564965c7","styleBatch":"HANDPAINTED_R1_20261015","bytes":1967753,"sourceEntityId":"m202_armadimon","sourceReferenceSha256":"70aacd1ebea365c4a7fdcc0627e85eaeb4dcaaa5d8f71e7456b9cd58f0fef8f9","generation":"Built-in image generation using owner original character reference","artDirection":"Refined hand-painted rendering preserving source identity and unmodified transparent PNG","review":{"artistViewedReferenceAndOutput":true,"rootReview":"PASSED","actualAlpha":true,"runtimeContainPadding":"Existing 24px padding and object-fit contain; original PNG canvas unchanged","runtimeBrowser":"PENDING","visualApprovalEvidence":"Actual source/output visual review passed 2026-10-15; new live image fit pending"},"selectedGenerationVersion":"refined-handpainted-v2"},{"speciesIndex":62,"speciesId":"species-062","displayCode":"GR38","src":"assets/production/database-handpainted-r1-20261015/species-062.25391107e04095f4.png","width":1254,"height":1254,"sha256":"25391107e04095f4bd706ffc106e6f90d10911d0baca637db3ed2114c9a2ef91","styleBatch":"HANDPAINTED_R1_20261015","bytes":1834147,"sourceEntityId":"m237_renamon","sourceReferenceSha256":"75e3101f148ff42f91bfef21b4dc521dbfdc284de74ed2d73ec61b1b3df8397e","sourceBindingEvidence":"OWNER_CONFIRMED_EXISTING_SPECIES_ID","selectedSourceForm":"EXACT_SOURCE_INDEX_ENTITY_FILENAME","selectedGenerationVersion":"v1","generation":"Built-in image generation using owner original character reference","artDirection":"Source-guided hand-painted linework, layered color, transparent background","review":{"artistViewedReferenceAndOutput":true,"rootReview":"PASSED","actualAlpha":true,"runtimeContainPadding":"Existing24px padding and object-fit contain; original PNG canvas unchanged","runtimeBrowser":"PENDING","compositingCaveat":"Pale blue/gold fringe and fine low-alpha residue remain. Veil fabric is painted softly; no claim that every fabric pixel is physically translucent. Requested native9%margin not achieved.","presentationRequirement":{"objectFit":"contain","cropAllowed":false,"coverAllowed":false,"containerPaddingRequired":true,"existingContainerPaddingPx":24,"nativePadding6PercentAchieved":false,"note":"Protect ears, veils, wings, crowns, solar arc, paws, tails and ribbons with padded contain. No PNG crop."}}}]};

test('owner-approved035062 exact identity raw bytes and privacy in every locale',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto'); const expected=[{"speciesIndex": 35, "speciesId": "species-035", "displayCode": "GR02", "src": "assets/production/database-handpainted-r1-20261015/species-035.291db6a498c8bdbd.png", "width": 1536, "height": 1024, "sha256": "291db6a498c8bdbd5e5b2196c8f9a629ec44a1ba55674e103dc596e6827fe6d4", "styleBatch": "HANDPAINTED_R1_20261015"}, {"speciesIndex": 62, "speciesId": "species-062", "displayCode": "GR38", "src": "assets/production/database-handpainted-r1-20261015/species-062.ad0745c733532dc2.png", "width": 1254, "height": 1254, "sha256": "ad0745c733532dc288c5143194e9020e35cd071e74347e7a3851911db136e52d", "styleBatch": "HANDPAINTED_R1_20261015"}];
 try{for(const e of expected){assert.deepEqual(critical(approvedHeroPortrait(e.speciesIndex)),critical(e));assert.equal(getDatabaseDisplayEntry(e.speciesIndex).displayCode,e.displayCode);const b=fs.readFileSync(e.src);assert.equal(createHash('sha256').update(b).digest('hex'),e.sha256);assert.equal(b.readUInt32BE(16),e.width);assert.equal(b.readUInt32BE(20),e.height);assert.equal(b[25],6);for(const locale of locales)for(const registered of [true,false]){const f=makeView({locale,selectedSpeciesIndex:e.speciesIndex,registeredSpecies:registered?[e.speciesIndex]:[],collection:[]});try{const holder=f.root.querySelector('.cm-dex-hero');if(registered){assert.ok(holder);assert.equal(holder.querySelector('img').src,databaseHeroPortrait(e.speciesIndex).src);}else{assert.equal(holder,null);assert.equal(f.root.querySelector('.cm-dex-profile'),null);}f.assertUnchanged();}finally{f.dispose();}}}}finally{setLocale('zh-Hant');}
});

test('035062 preserve every other e96d400a portrait and provenance entry',async()=>{const fs=await import('node:fs'),{createHash}=await import('node:crypto');for(const b of [{"path": "src/data/championship/database-hero-portraits.r1.json", "exclude": [35, 62], "count": 55, "sha256": "40f25dcc4240359d34203fefae5eb9ed5a0ab55430dfa211a08d425e2f9c45b9"}, {"path": "src/data/championship/qa-database-hero-portraits.r1.json", "exclude": [35, 62], "count": 55, "sha256": "6dbb19841d22bc135658229e7c4cf4bc6600a0622750d280113cea93e5cfda94"}, {"path": "assets/production/database-handpainted-r1-20261015/manifest.json", "exclude": [35, 62], "count": 41, "sha256": "06ae9e4102de4fb81181cbdec6232eca3a11255f95bf0f83608823de2029e489"}]){const e=historicalEntries(b.path,JSON.parse(fs.readFileSync(b.path,'utf8')).entries).filter(e=>!b.exclude.includes(e.speciesIndex)&&(e.speciesIndex!==36||b.path.endsWith("database-original-profiles.r1.json")));assert.equal(e.length,b.count);assert.equal(createHash('sha256').update(JSON.stringify(e)).digest('hex'),b.sha256,b.path);}});

test('candidate036 exact identity raw bytes and privacy in every locale',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto'); const expected=[{"speciesIndex": 36, "speciesId": "species-036", "displayCode": "GR04", "src": "assets/production/database-handpainted-r1-20261015/species-036.1a921cc1752c9c9c.png", "width": 1415, "height": 1111, "sha256": "1a921cc1752c9c9c99b2085a51ccf6a3efe77cb849b77b0e006062a90334aa5d", "styleBatch": "HANDPAINTED_R1_20261015"}];
 try{for(const e of expected){assert.deepEqual(critical(approvedHeroPortrait(e.speciesIndex)),critical(e));assert.equal(getDatabaseDisplayEntry(e.speciesIndex).displayCode,e.displayCode);const b=fs.readFileSync(e.src);assert.equal(createHash('sha256').update(b).digest('hex'),e.sha256);assert.equal(b.readUInt32BE(16),e.width);assert.equal(b.readUInt32BE(20),e.height);assert.equal(b[25],6);for(const locale of locales)for(const registered of [true,false]){const f=makeView({locale,selectedSpeciesIndex:e.speciesIndex,registeredSpecies:registered?[e.speciesIndex]:[],collection:[]});try{const holder=f.root.querySelector('.cm-dex-hero');if(registered){assert.ok(holder);assert.equal(holder.querySelector('img').src,databaseHeroPortrait(e.speciesIndex).src);}else{assert.equal(holder,null);assert.equal(f.root.querySelector('.cm-dex-profile'),null);}f.assertUnchanged();}finally{f.dispose();}}}}finally{setLocale('zh-Hant');}
});

test('036 preserves all d1d698 prior portrait and provenance entries',async()=>{const fs=await import('node:fs'),{createHash}=await import('node:crypto');for(const b of [{"path": "src/data/championship/database-hero-portraits.r1.json", "count": 57, "sha256": "5d849e21114d2c49d1a59e53b2433ab8ced6dbbd51bcd65a1496beee7de4c597"}, {"path": "src/data/championship/qa-database-hero-portraits.r1.json", "count": 57, "sha256": "9476e5bf002f66560d6f2f24363bafebadc5e6d29b6438172b7f184671025793"}, {"path": "assets/production/database-handpainted-r1-20261015/manifest.json", "count": 43, "sha256": "f9c98af34fa6f4c1d401345e29ee8e61bdd32d8782de662b0367b1c2c6ceb264"}]){const entries=historicalEntries(b.path,JSON.parse(fs.readFileSync(b.path,'utf8')).entries).filter(e=>e.speciesIndex!==36);assert.equal(entries.length,b.count);assert.equal(createHash('sha256').update(JSON.stringify(entries)).digest('hex'),b.sha256,b.path);}});

test('036 production QA provenance exact binding and candidate status',async()=>{const fs=await import('node:fs');const expected={"speciesIndex": 36, "speciesId": "species-036", "displayCode": "GR04", "src": "assets/production/database-handpainted-r1-20261015/species-036.1a921cc1752c9c9c.png", "width": 1415, "height": 1111, "sha256": "1a921cc1752c9c9c99b2085a51ccf6a3efe77cb849b77b0e006062a90334aa5d", "styleBatch": "HANDPAINTED_R1_20261015"};for(const p of ["src/data/championship/database-hero-portraits.r1.json", "src/data/championship/qa-database-hero-portraits.r1.json"]){const j=JSON.parse(fs.readFileSync(p,'utf8'));assert.equal(j.entries.length,p.includes('qa-')?95:96);assert.equal(j.entries.filter(e=>e.speciesIndex===36).length,1);assert.deepEqual(j.entries.find(e=>e.speciesIndex===36),expected);}const m=JSON.parse(fs.readFileSync('assets/production/database-handpainted-r1-20261015/manifest.json','utf8'));assert.equal(m.count,44);assert.equal(m.entries.length,44);assert.deepEqual(m.entries.find(e=>e.speciesIndex===36),{"speciesIndex": 36, "speciesId": "species-036", "displayCode": "GR04", "src": "assets/production/database-handpainted-r1-20261015/species-036.1a921cc1752c9c9c.png", "width": 1415, "height": 1111, "sha256": "1a921cc1752c9c9c99b2085a51ccf6a3efe77cb849b77b0e006062a90334aa5d", "styleBatch": "HANDPAINTED_R1_20261015", "bytes": 2029665, "generation": "Hand-painted redesign candidate refined to preserve fine thunder-fur spikes; unchanged native PNG bytes", "selectedGenerationVersion": "bold-handpaint-v2", "designRevision": "THUNDER_FUR_MAIN_PORTRAIT_CANDIDATE_20261016", "sourceReferenceSha256": "bdd38a45671fd9b7e467f69996fb83a5feab66a734027784f7a2af4217e769f6", "sourceBindingEvidence": "Existing species-036 / GR04 display identity; v2 refinement of v1 candidate", "promptSha256": "ffe8d493eeeefe3d07659a83ad7c81e5def8bc7041c5ad973f944f919e9a5384", "artDirection": "Gold, aubergine-charcoal, ivory and burnt-orange palette; fine mane, ear and tail tips retained", "review": {"rootReview": "STATIC_CANDIDATE_REVIEWED_RELEASE_PENDING", "actualAlpha": true, "ownerSpecificImageApproval": false, "runtimeBrowser": "PENDING", "actionsUpdated": false, "scope": "MAIN PORTRAIT ONLY. No action atlas, story, stats or other character palette changes.", "runtimeContainPadding": "Preserve native PNG and existing 24px padded contain; no crop, repaint or resampling."}});});

test('approved207208209210212213214216217 bind exact owner hero bytes, preserve previous95 and keep locked detail private',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');
 const ledger=JSON.parse(fs.readFileSync('docs/art/production/characters/approved-dex-20261018/manifest.json','utf8'));
 const ids=[207,208,209,210,212,213,214,216,217],codes=['UL30','UL31','UL32','UL35','UL36','UL37','UL38','UL13','UL22'];
 assert.deepEqual(ledger.entries.map(e=>e.speciesIndex),ids);
 const prior=publicHeroes.entries.filter(e=>!ids.includes(e.speciesIndex)&&![206,218,219,220,221,223].includes(e.speciesIndex));assert.equal(prior.length,95);
 assert.equal(createHash('sha256').update(JSON.stringify(historicalPublicRows(prior))).digest('hex'),ledger.previousPublicHeroes.sha256);
 try{for(const [i,id] of ids.entries()){
  const art=databaseHeroPortrait(id),record=ledger.entries[i];assert.equal(art.displayCode,codes[i]);assert.equal(getDatabaseDisplayEntry(id).displayCode,codes[i]);
  assert.equal(art.speciesId,`species-${id}`);assert.equal(art.src,record.display.src);assert.equal(art.sha256,record.display.sha256);
  for(const media of [art,art.thumbnail]){const bytes=fs.readFileSync(media.src);assert.equal(createHash('sha256').update(bytes).digest('hex'),media.sha256);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');}
  assert.ok(Math.max(art.thumbnail.width,art.thumbnail.height)<=128);assert.ok(record.display.bytes<=160000);
  for(const locale of locales)for(const registered of [true,false]){
   const f=makeView({locale,selectedSpeciesIndex:id,registeredSpecies:registered?[id]:[],collection:[]});
   try{const holder=f.root.querySelector('.cm-dex-hero');
    if(!registered)assert.equal(holder,null);
    else{const img=holder.querySelector('img');assert.equal(img.src,art.src);img.naturalWidth=art.width;img.naturalHeight=art.height;img.onload();assert.equal(holder.dataset.art,'ready');assert.equal(img.hidden,false);}
    f.assertUnchanged();
   }finally{f.dispose();}
  }
 }}finally{setLocale('zh-Hant');}
});

test('approved218219220221 bind exact owner hero bytes, preserve previous104 and keep locked detail private',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');
 const ledger=JSON.parse(fs.readFileSync('docs/art/production/characters/approved-dex-218-221-20261018/manifest.json','utf8'));
 const ids=[218,219,220,221],codes=['UL15','UL28','UL01','UL17'];
 assert.deepEqual(ledger.entries.map(e=>e.speciesIndex),ids);
 const prior=publicHeroes.entries.filter(e=>!ids.includes(e.speciesIndex)&&![206,223].includes(e.speciesIndex));assert.equal(prior.length,104);
 assert.equal(createHash('sha256').update(JSON.stringify(historicalPublicRows(prior))).digest('hex'),ledger.previousPublicHeroes.sha256);
 try{for(const [i,id] of ids.entries()){
  const art=databaseHeroPortrait(id),record=ledger.entries[i];assert.equal(art.displayCode,codes[i]);assert.equal(getDatabaseDisplayEntry(id).displayCode,codes[i]);
  assert.equal(art.speciesId,`species-${id}`);assert.equal(art.src,record.display.src);assert.equal(art.sha256,record.display.sha256);
  for(const media of [art,art.thumbnail]){const bytes=fs.readFileSync(media.src);assert.equal(createHash('sha256').update(bytes).digest('hex'),media.sha256);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');}
  assert.ok(Math.max(art.thumbnail.width,art.thumbnail.height)<=128);assert.ok(record.display.bytes<=180000);
  for(const locale of locales)for(const registered of [true,false]){
   const f=makeView({locale,selectedSpeciesIndex:id,registeredSpecies:registered?[id]:[],collection:[]});
   try{const holder=f.root.querySelector('.cm-dex-hero');
    if(!registered)assert.equal(holder,null);
    else{const img=holder.querySelector('img');assert.equal(img.src,art.src);img.naturalWidth=art.width;img.naturalHeight=art.height;img.onload();assert.equal(holder.dataset.art,'ready');assert.equal(img.hidden,false);}
    f.assertUnchanged();
   }finally{f.dispose();}
  }
 }}finally{setLocale('zh-Hant');}
});

test('approved223DarkEyes bind exact owner hero bytes, preserve previous108 and keep locked detail private',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');
 const ledger=JSON.parse(fs.readFileSync('docs/art/production/characters/approved-dex-223-20261018/manifest.json','utf8'));
 const ids=[223],codes=['UL18'];
 assert.deepEqual(ledger.entries.map(e=>e.speciesIndex),ids);
 const prior=publicHeroes.entries.filter(e=>!ids.includes(e.speciesIndex)&&e.speciesIndex!==206);assert.equal(prior.length,108);
 assert.equal(createHash('sha256').update(JSON.stringify(historicalPublicRows(prior))).digest('hex'),ledger.previousPublicHeroes.sha256);
 try{for(const [i,id] of ids.entries()){
  const art=databaseHeroPortrait(id),record=ledger.entries[i];assert.equal(art.displayCode,codes[i]);assert.equal(getDatabaseDisplayEntry(id).displayCode,codes[i]);
  assert.equal(art.speciesId,`species-${id}`);assert.equal(art.src,record.display.src);assert.equal(art.sha256,record.display.sha256);
  for(const media of [art,art.thumbnail]){const bytes=fs.readFileSync(media.src);assert.equal(createHash('sha256').update(bytes).digest('hex'),media.sha256);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');}
  assert.ok(Math.max(art.thumbnail.width,art.thumbnail.height)<=128);assert.ok(record.display.bytes<=180000);
  for(const locale of locales)for(const registered of [true,false]){
   const f=makeView({locale,selectedSpeciesIndex:id,registeredSpecies:registered?[id]:[],collection:[]});
   try{const holder=f.root.querySelector('.cm-dex-hero');
    if(!registered)assert.equal(holder,null);
    else{const img=holder.querySelector('img');assert.equal(img.src,art.src);img.naturalWidth=art.width;img.naturalHeight=art.height;img.onload();assert.equal(holder.dataset.art,'ready');assert.equal(img.hidden,false);}
    f.assertUnchanged();
   }finally{f.dispose();}
  }
 }}finally{setLocale('zh-Hant');}
});

test('approved206Simplified bind exact owner hero bytes, preserve previous109 and keep locked detail private',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');
 const ledger=JSON.parse(fs.readFileSync('docs/art/production/characters/approved-dex-206-20261018/manifest.json','utf8'));
 const ids=[206],codes=['UL29'];
 assert.deepEqual(ledger.entries.map(e=>e.speciesIndex),ids);
 const prior=publicHeroes.entries.filter(e=>!ids.includes(e.speciesIndex));assert.equal(prior.length,109);
 assert.equal(createHash('sha256').update(JSON.stringify(historicalPublicRows(prior))).digest('hex'),ledger.previousPublicHeroes.sha256);
 try{for(const [i,id] of ids.entries()){
  const art=databaseHeroPortrait(id),record=ledger.entries[i];assert.equal(art.displayCode,codes[i]);assert.equal(getDatabaseDisplayEntry(id).displayCode,codes[i]);
  assert.equal(art.speciesId,`species-${id}`);assert.equal(art.src,record.display.src);assert.equal(art.sha256,record.display.sha256);
  for(const media of [art,art.thumbnail]){const bytes=fs.readFileSync(media.src);assert.equal(createHash('sha256').update(bytes).digest('hex'),media.sha256);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');}
  assert.ok(Math.max(art.thumbnail.width,art.thumbnail.height)<=128);assert.ok(record.display.bytes<=180000);
  for(const locale of locales)for(const registered of [true,false]){
   const f=makeView({locale,selectedSpeciesIndex:id,registeredSpecies:registered?[id]:[],collection:[]});
   try{const holder=f.root.querySelector('.cm-dex-hero');
    if(!registered)assert.equal(holder,null);
    else{const img=holder.querySelector('img');assert.equal(img.src,art.src);img.naturalWidth=art.width;img.naturalHeight=art.height;img.onload();assert.equal(holder.dataset.art,'ready');assert.equal(img.hidden,false);}
    f.assertUnchanged();
   }finally{f.dispose();}
  }
 }}finally{setLocale('zh-Hant');}
});

test('approvedPalm215 bind exact owner hero bytes, retain superseded originals and keep locked detail private',async()=>{
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');
 const ledger=JSON.parse(fs.readFileSync('docs/art/production/characters/approved-dex-215-20261018/manifest.json','utf8'));
 const ids=[215],codes=["UL39"];
 assert.deepEqual(ledger.entries.map(e=>e.speciesIndex),ids);
 try{for(const [i,id] of ids.entries()){
  const art=databaseHeroPortrait(id),record=ledger.entries[i];assert.equal(art.displayCode,codes[i]);assert.equal(getDatabaseDisplayEntry(id).displayCode,codes[i]);
  assert.equal(art.speciesId,`species-${id}`);assert.equal(art.src,record.display.src);assert.equal(art.sha256,record.display.sha256);
  for(const media of [art,art.thumbnail]){const bytes=fs.readFileSync(media.src);assert.equal(createHash('sha256').update(bytes).digest('hex'),media.sha256);assert.equal(bytes.toString('ascii',0,4),'RIFF');assert.equal(bytes.toString('ascii',8,12),'WEBP');}
  assert.ok(Math.max(art.thumbnail.width,art.thumbnail.height)<=128);assert.ok(record.display.bytes<=260000);
  for(const locale of locales)for(const registered of [true,false]){
   const f=makeView({locale,selectedSpeciesIndex:id,registeredSpecies:registered?[id]:[],collection:[]});
   try{const holder=f.root.querySelector('.cm-dex-hero');
    if(!registered)assert.equal(holder,null);
    else{const img=holder.querySelector('img');assert.equal(img.src,art.src);img.naturalWidth=art.width;img.naturalHeight=art.height;img.onload();assert.equal(holder.dataset.art,'ready');assert.equal(img.hidden,false);}
    f.assertUnchanged();
   }finally{f.dispose();}
  }
 }}finally{setLocale('zh-Hant');}
});

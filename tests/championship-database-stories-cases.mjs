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
  if(registered){assert.equal(prose?.textContent,entry.textByLocale[locale]);assert.equal(f.root.querySelector('.cm-dex-hero'),null);assert.ok(dataSec);}else {assert.equal(prose,null);assert.equal(f.root.querySelector('.cm-dex-hero'),null);assert.equal(dataSec,null);}
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

test('twelve hero assets join stable IDs and selected file hashes, with no animation/HUD replacement',async()=>{
 const {DATABASE_HERO_PORTRAITS:art,databaseHeroPortrait:get}=await import('../src/championship/presentation/databaseHeroPortraits.js');
 const fs=await import('node:fs'),{createHash}=await import('node:crypto');assert.equal(art.entries.length,12);
 for(const e of art.entries){const id=getDatabaseDisplayEntry(e.speciesIndex);assert.equal(e.speciesId,id.speciesId);assert.equal(e.displayCode,id.displayCode);assert.ok(Object.isFrozen(e));assert.match(e.src,/^assets\/production\/database-portraits-b1-20261014\/B1\d{2}\.webp$/);assert.equal(createHash('sha256').update(fs.readFileSync(e.src)).digest('hex'),e.sha256);assert.ok(e.width>0&&e.height>0);}
 for(const id of [0,20,195,222,'8',NaN])assert.equal(get(id),null);
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

// Controlled content/DOM fixture, not browser, GPU, or production acceptance.
import test from 'node:test';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
registerHooks({load(url,context,next){const r=next(url,context);
 if(url.endsWith('/product-species-extensions.r1.json')){const d=JSON.parse(r.source.toString());d.entries.forEach(e=>{e.runtimeReady=e.evolutionReady=e.networkReady=true;});return {...r,source:JSON.stringify(d)};}
 return r;
}});
const {makeView}=await import('./helpers/dex-conditions-ui-fixture.mjs');
const {databaseHeroPortrait}=await import('../src/championship/presentation/databaseHeroPortraits.js');
const {databaseStory}=await import('../src/championship/database/databaseStories.js');
const {getDatabaseDisplayEntry}=await import('../src/championship/database/databaseDisplayCatalog.js');
const {getLocale,setLocale}=await import('../src/championship/text/locale.js');
const {speciesName}=await import('../src/championship/text/zhHant.js');
test('accepted fixture: four distinct forms keep stable identities and owner display order',()=>{
 const rows=[[222,'UL02'],[230,'UL03'],[211,'UL33'],[229,'UL34']];
 assert.equal(new Set(rows.map(([id])=>databaseHeroPortrait(id).sha256)).size,4);
 for(const [id,code] of rows){assert.equal(getDatabaseDisplayEntry(id).displayCode,code);assert.equal(databaseHeroPortrait(id).speciesIndex,id);}
});
test('accepted fixture: new form stories and heroes honor discovery privacy in all five locales',()=>{
 const old=getLocale();try{for(const locale of ['zh-Hant','en','ja','th','vi'])for(const id of [229,230])for(const registered of [false,true]){
  const f=makeView({locale,selectedSpeciesIndex:id,registeredSpecies:registered?[id]:[],collection:[]});
  try{const hero=f.root.querySelector('.cm-dex-hero'),prose=f.root.querySelector('.cm-dex-profile__text');
   if(registered){assert.ok(hero);assert.equal(prose.textContent,databaseStory(id,locale));assert.ok(speciesName(id).length>3);const image=hero.querySelector('img'),art=databaseHeroPortrait(id);assert.equal(image.src,art.src);assert.equal(image.hidden,true);image.naturalWidth=art.width;image.naturalHeight=art.height;image.onload();assert.equal(image.hidden,false);}
   else{assert.equal(hero,null);assert.equal(prose,null);assert.equal(f.root.querySelector('.cm-dex-data'),null);}
   f.assertUnchanged();
  }finally{f.dispose();}
 }}finally{setLocale(old);}
});
test('accepted fixture: new story content rejects unsupported locales and absent sentinel',()=>{
 for(const id of [229,230])for(const locale of ['fr','constructor','__proto__'])assert.equal(databaseStory(id,locale),null);
 for(const locale of ['zh-Hant','en','ja','th','vi'])assert.equal(databaseStory(228,locale),null);
});

test('accepted fixture: hidden evolution portraits never request art or register image callbacks',()=>{
 const f=makeView({selectedSpeciesIndex:139,registeredSpecies:[139],evolutionBranches:[],collection:[]});
 try{const portraits=f.root.querySelectorAll('.cm-dex-portrait');let hidden=0;for(const portrait of portraits)if(portrait.dataset.revealed==='false'){hidden++;assert.equal(portrait.dataset.art,'hidden');const image=portrait.querySelector('img');assert.equal(image.hidden,true);assert.ok(!image.src);assert.ok(!image.onload);}
  assert.ok(hidden>0);assert.equal(f.calls.art.some(x=>x.speciesIndex===229),false);assert.ok(f.calls.art.every(x=>x.speciesIndex===139));f.assertUnchanged();
 }finally{f.dispose();setLocale('zh-Hant');}
});

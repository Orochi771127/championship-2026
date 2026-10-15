import test from 'node:test';import fs from 'node:fs';import {registerHooks} from 'node:module';import {runInNewContext} from 'node:vm';import assert from 'node:assert/strict';
const base=new URL('../',import.meta.url),html=fs.readFileSync(new URL('alternate-form-qa.html',base),'utf8');
const map=JSON.parse(html.match(/<script type="importmap">([^<]+)<\/script>/)[1]).imports;
const redirects=new Map(Object.entries(map).map(([k,v])=>[new URL(k,base).href,new URL(v,base).href]));
registerHooks({resolve(s,c,next){let u;try{u=new URL(s,c.parentURL).href}catch{}return next(redirects.get(u)??s,c)}});
test('actual QA HTML import map and page adapter bootstrap the real v6 Continue path without main storage',async()=>{
globalThis.location={pathname:'/championship-2026/alternate-form-qa.html'};
const data=new Map();const storage={getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v),removeItem:k=>data.delete(k)};
const page=html.match(/<script>\s*\/\/ QA page-owned storage[\s\S]*?<\/script>/)[0].replace(/^<script>|<\/script>$/g,'');
const win={sessionStorage:storage};runInNewContext(page,{window:win});globalThis.__alternateFormQaStorage=win.__alternateFormQaStorage;
const {createChampionshipStandaloneApp}=await import(new URL('src/championship/app/championshipStandaloneApp.js',base));
const read=p=>JSON.parse(fs.readFileSync(new URL(p,base)));
const app=createChampionshipStandaloneApp({catalog:read('src/data/championship/catalogs/creature-species.r1.json'),cages:read('docs/contracts/championship/raising-home-presentation.v1.json').cages,storage:{getItem(){throw Error('MAIN_READ')},setItem(){throw Error('MAIN_WRITE')}}});
assert.equal(app.inspectSave().error,null);assert.equal(app.inspectSave().save.schemaVersion,6);assert.equal(app.canContinue().loadable,true);await app.continueGame();assert.deepEqual(app.getRaisingInstances().map(x=>x.speciesId),['species-000','species-211','species-222','species-229','species-230','species-139','species-144']);assert.equal(app.save().phase,'SAVED');assert.ok([...data.keys()].every(k=>k.startsWith('championshipAlternateFormsQA:r1:')));await app.dispose();delete globalThis.location;delete globalThis.__alternateFormQaStorage;
});

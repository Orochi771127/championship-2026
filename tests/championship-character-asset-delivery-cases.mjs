import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import * as esbuild from 'esbuild';
import {createCharacterAssetResolver,characterAssetSrc,characterAssetUrl,validateCharacterAssetDelivery} from '../src/championship/presentation/characterAssetDelivery.js';
import {compileBrowserBundle} from '../scripts/lib/browser-bundle.mjs';

const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const version='63776034296faa32f3498f94396c0e825403a340';
const assetBaseUrl=`https://orochi771127.github.io/cyber-partner-runtime-assets/v/${version}/`;
const game='https://orochi771127.github.io/championship-2026/index.html?screen=ranch';
const delivery={schemaVersion:1,assetPrefix:'assets/production/characters/',assetBaseUrl};
const file='assets/production/characters/accepted-20261010/example/runtime.render.json';

test('source imports and ordinary builds retain full local URLs with no activation',()=>{
 assert.equal(characterAssetSrc(file,game),file);
 assert.equal(characterAssetUrl(file,game),new URL(file,game).href);
 assert.equal(createCharacterAssetResolver(null)(file,game),file);
});

test('pinned delivery maps the approved game path and preserves relative atlas URLs',()=>{
 const resolve=createCharacterAssetResolver(delivery),runtime=resolve(file,game);
 assert.equal(runtime,assetBaseUrl+file);
 assert.equal(resolve(new URL(file,game).href,game),runtime);
 assert.equal(resolve(runtime,game),runtime);
 assert.equal(new URL('main-0123456789abcdef.json',runtime).href,assetBaseUrl+file.replace('runtime.render.json','main-0123456789abcdef.json'));
 assert.equal(new URL('web-atlas-v2/'+'a'.repeat(64)+'.webp',runtime).href,assetBaseUrl+file.replace('runtime.render.json','web-atlas-v2/'+'a'.repeat(64)+'.webp'));
});

test('local handoff QA, foreign pages, portraits and unrelated assets keep their existing transport',()=>{
 const resolve=createCharacterAssetResolver(delivery);
 for(const page of ['http://127.0.0.1:8761/?animHandoff=1','http://localhost:8762/championship-2026/','https://example.com/championship-2026/','https://orochi771127.github.io/championship-20260/'])
  assert.equal(resolve(file,page),file);
 for(const value of ['assets/production/internal-character-review/private.png','assets/production/database-display-web-20261029/portrait.webp','src/data/championship/animation-handoff.qa-20261101.json','https://example.com/'+file])
  assert.equal(resolve(value,game),value);
});

test('delivery refuses mutable destinations and character path normalization tricks',()=>{
 for(const url of ['https://example.com/v/'+version+'/','https://orochi771127.github.io/cyber-partner-runtime-assets/main/','https://orochi771127.github.io/cyber-partner-runtime-assets/v/'+version+'/?token=secret','http://orochi771127.github.io/cyber-partner-runtime-assets/v/'+version+'/'])
  assert.throws(()=>validateCharacterAssetDelivery({...delivery,assetBaseUrl:url}),/DELIVERY_URL/);
 const resolve=createCharacterAssetResolver(delivery);
 for(const value of [file+'/../other.png',file.replace('example/','../'),file.replace('example/','%2e%2e/'),file.replace('example/','example\\'),file+'?redirect=elsewhere',file+'#changed'])
  assert.throws(()=>resolve(value,game),/SOURCE_PATH/);
 assert.throws(()=>validateCharacterAssetDelivery({...delivery,unselected:true}),/DELIVERY_SCHEMA/);
});

test('only the explicitly configured browser bundle receives the delivery constant',async t=>{
 const base=path.join(repo,'.tmp');fs.mkdirSync(base,{recursive:true});const root=fs.mkdtempSync(path.join(base,'asset-delivery-bundle-'));
 t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const helper='src/championship/presentation/characterAssetDelivery.js',entry='src/championship/app/main.js';
 for(const file of [helper,entry])fs.mkdirSync(path.dirname(path.join(root,file)),{recursive:true});
 fs.copyFileSync(path.join(repo,helper),path.join(root,helper));
 fs.writeFileSync(path.join(root,entry),`import {characterAssetUrl} from '../presentation/characterAssetDelivery.js'; export const url=characterAssetUrl(${JSON.stringify(file)},${JSON.stringify(game)});`);
 const input={files:[entry,helper],importMap:{},browserBundle:{version:1,entry,outputDirectory:'src/championship/app/_bundled',toolVersion:esbuild.version}};
 for(const [config,expected]of [[null,new URL(file,game).href],[delivery,assetBaseUrl+file]]){
  const bundle=compileBrowserBundle(root,{...input,characterAssetDelivery:config});
  const output=bundle.files.find(row=>row.path===bundle.metadata.entry);
  const loaded=await import('data:text/javascript;base64,'+output.bytes.toString('base64'));
  assert.equal(loaded.url,expected);
 }
});

test('every public character loading boundary uses the pinned transport without changing the game base',()=>{
 // Fresh module graph exercises the same constant esbuild injects, including
 // all real consumers, without mutating the default graph of other tests.
 const script=String.raw`
  import assert from 'node:assert/strict';import fs from 'node:fs';
  globalThis.__CM_CHARACTER_DELIVERY__=JSON.parse(process.env.TEST_CHARACTER_DELIVERY);
  const base='https://orochi771127.github.io/championship-2026/',external=globalThis.__CM_CHARACTER_DELIVERY__.assetBaseUrl;
  const calls=[],fail=async value=>{calls.push(String(value));return new Response('',{status:404});};
  const {publicCharacterConfigs}=await import('./src/championship/presentation/publicCharacterCatalog.js');
  const config=publicCharacterConfigs()[0],expected=external+config.runtimePath;
  const {loadPublicCharacterRoster}=await import('./src/championship/presentation/publicCharacterRoster.js');
  const roster=await loadPublicCharacterRoster({PIXI:{},speciesIds:[config.speciesId],fetchImpl:fail},base);
  assert.equal(calls.at(-1),expected);assert.match(roster.getDiagnostics().failures[0].reason,/HTTP_404/);await roster.dispose();
  const {dataArenaArtRecord}=await import('./src/championship/presentation/dataArena/dataArenaRoster.js');
  const art=dataArenaArtRecord(config.speciesId,base);assert.equal(art.runtimeUrl,expected);assert.equal(art.baseUrl,base);
  const {loadShowcaseMotion}=await import('./src/championship/presentation/juicy/spriteMotionPlayer.js');
  await assert.rejects(loadShowcaseMotion(config.speciesId,{baseUrl:base,fetchImpl:fail}),/HTTP_404/);assert.equal(calls.at(-1),expected);
  const {loadParadeWalker}=await import('./src/championship/app/titleParade.js');
  assert.equal(await loadParadeWalker(config.speciesId,{href:base,fetchImpl:fail}),null);assert.equal(calls.at(-1),expected);
  const {createRanchTitlePreloader}=await import('./src/championship/app/ranchTitlePreload.js');
  const preloader=createRanchTitlePreloader({baseUrl:base,characters:[config],reviewedSpecies:new Set(),fetchImpl:fail,
   createPrefetcher:()=>({subscribe(){},forget(){},progress(){return{};},blobOf(){return null;},fetchAll:async()=>{}})});
  await preloader.start({creature:{creatureId:'test',speciesId:config.speciesId},raising:{assignments:{test:1},collection:[]}});assert.equal(calls.at(-1),expected);preloader.stop();
  const selection=JSON.parse(fs.readFileSync('src/data/championship/reviewed-animation-selection.v1.json','utf8')).characters.find(row=>row.playableIdentity!==false);
  const {attachReviewedCharacterAnimation}=await import('./src/championship/presentation/reviewedCharacterLoader.js');
  await assert.rejects(attachReviewedCharacterAnimation({bundle:{dispose:async()=>{}},PIXI:{},speciesId:selection.speciesId,baseUrl:base,fetchImpl:fail}),/HTTP_404/);
  assert.equal(calls.at(-1),external+selection.path);
  const {loadReviewedDomFrames}=await import('./src/championship/presentation/reviewedSelection.js');
  await assert.rejects(loadReviewedDomFrames(selection.speciesId,{href:base,fetchImpl:fail,sequences:[0]}),/HTTP_404/);assert.equal(calls.at(-1),external+selection.path);
  const fetchLocal=async value=>{const url=String(value);assert.ok(url.startsWith(external));calls.push(url);return new Response(fs.readFileSync(url.slice(external.length)));};
  const {loadPublicCharacterHudArt}=await import('./src/championship/presentation/publicCharacterHudArt.js');
  const hud=await loadPublicCharacterHudArt({baseUrl:base,fetchImpl:fetchLocal,speciesIds:[config.speciesId]});assert.equal(calls.at(-1),external+config.hudPath);
  const document=JSON.parse(fs.readFileSync(config.hudPath,'utf8'));
  for(const sequence of document.battle.sequences)for(const cell of hud.getBattleCells(config.speciesId,sequence.id))assert.ok(cell.src.startsWith(external));
  const {loadAcceptedDatabasePortrait}=await import('./src/championship/presentation/acceptedDatabasePortraits.js');
  const portrait=await loadAcceptedDatabasePortrait(Number(config.speciesId.slice(-3)),{baseUrl:base,fetchImpl:fetchLocal});assert.ok(portrait.src.startsWith(external));
  const {openingEggChoices}=await import('./src/championship/app/openingEggChoices.js');
  assert.equal(openingEggChoices(base).length,8);assert.ok(openingEggChoices(base).every(egg=>egg.src.startsWith(external)));
  assert.ok(openingEggChoices('http://127.0.0.1:8761/?animHandoff=1').every(egg=>!egg.src.startsWith(external)));
  console.log('CHARACTER_DELIVERY_BOUNDARIES_PASS');
 `;
 const result=spawnSync(process.execPath,['--input-type=module'],{cwd:repo,input:script,encoding:'utf8',env:{...process.env,TEST_CHARACTER_DELIVERY:JSON.stringify(delivery)}});
 assert.equal(result.status,0,result.stderr||result.stdout);assert.match(result.stdout,/CHARACTER_DELIVERY_BOUNDARIES_PASS/);
});

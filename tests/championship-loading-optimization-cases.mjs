import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {compileBrowserBundle,bundledBrowserHtml} from '../scripts/lib/browser-bundle.mjs';
import {readHudManifest} from '../src/championship/presentation/hudManifestCache.js';
import {loadRegisteredCharacterHudArt} from '../src/championship/presentation/characterHudArt.js';
import {TOOLBAR_PRODUCT_ENTRIES,toolbarProductEntryAvailable} from '../src/championship/app/championshipToolbar.js';

const root=fileURLToPath(new URL('../',import.meta.url));
const publicUrl='https://orochi771127.github.io/championship-2026/championship.html';
const recipe={version:1,entry:'src/championship/app/main.js',outputDirectory:'src/championship/app/_bundled',toolVersion:'0.28.2'};

test('bundled static and lazy modules share state and preserve source-relative asset URLs',async t=>{
  const temp=fs.mkdtempSync(path.join(os.tmpdir(),'championship-bundle-test-'));
  t.after(()=>{const absolute=fs.realpathSync(temp);assert.ok(absolute.startsWith(fs.realpathSync(os.tmpdir())+path.sep));fs.rmSync(absolute,{recursive:true});});
  const sources={
    'src/championship/app/main.js':`import {step} from './shared.js';export {step};export const asset=new URL('./image.png',import.meta.url).href;export async function later(){return(await import('./later.js')).value();}`,
    'src/championship/app/shared.js':`let count=0;export function step(){return ++count;}`,
    'src/championship/app/later.js':`import {step} from './shared.js';export function value(){return step();}`
  };
  fs.writeFileSync(path.join(temp,'package.json'),'{'+'"type":"module"}');
  for(const [file,source] of Object.entries(sources)){fs.mkdirSync(path.dirname(path.join(temp,file)),{recursive:true});fs.writeFileSync(path.join(temp,file),source);}
  const bundle=compileBrowserBundle(temp,{files:Object.keys(sources),browserBundle:recipe});
  for(const file of bundle.files){fs.mkdirSync(path.dirname(path.join(temp,file.path)),{recursive:true});fs.writeFileSync(path.join(temp,file.path),file.bytes);}
  const module=await import(pathToFileURL(path.join(temp,bundle.metadata.entry)));
  assert.equal(module.step(),1);assert.equal(await module.later(),2);assert.equal(module.step(),3);
  assert.equal(module.asset,pathToFileURL(path.join(temp,'src/championship/app/image.png')).href);
  assert.deepEqual(bundle.metadata.inputFiles.map(f=>f.path).sort(),Object.keys(sources).sort());
  assert.throws(()=>compileBrowserBundle(temp,{files:[recipe.entry],browserBundle:recipe}),/UNAPPROVED_INPUT/);
});

test('public entry uses only its static bundle preloads and a content-addressed script',()=>{
  const source=`<head>    <!-- modulepreload: generated -->\nold\n    <!-- /modulepreload --></head><script>const src='./src/championship/app/main.js?v=settings-2';</script>`;
  const metadata={entry:'src/championship/app/_bundled/main-ABC.js',startupModules:['src/championship/app/_bundled/main-ABC.js','src/championship/app/_bundled/chunk-DEF.js']};
  const html=bundledBrowserHtml(source,metadata);
  assert.ok(html.includes('href="./src/championship/app/_bundled/chunk-DEF.js"'));
  assert.ok(html.includes("src='./src/championship/app/_bundled/main-ABC.js'"));
  assert.ok(!html.includes('old'));assert.throws(()=>bundledBrowserHtml('<html/>',metadata),/HTML_ENTRY_MISMATCH/);
});

test('metadata reads deduplicate in flight and retry a rejected request',async()=>{
  let calls=0,resolve;const fetchImpl=()=>{calls++;return new Promise(r=>{resolve=r;});};
  const a=readHudManifest('https://example.test/a.json',fetchImpl),b=readHudManifest('https://example.test/a.json',fetchImpl);
  await Promise.resolve();assert.equal(calls,1);resolve({ok:true,json:async()=>({value:7})});
  assert.deepEqual(await a,{value:7});assert.strictEqual(await a,await b);
  let retries=0;const failing=async()=>++retries===1?{ok:false,status:503}:{ok:true,json:async()=>({ready:true})};
  await assert.rejects(readHudManifest('https://example.test/b.json',failing),/503/);
  assert.deepEqual(await readHudManifest('https://example.test/b.json',failing),{ready:true});assert.equal(retries,2);
});

test('a ranch loads only requested original HUDs and can fill a later species without another full catalog read',async()=>{
  const calls=[];const fetchImpl=async url=>{const file=new URL(url).pathname.replace(/^\/championship-2026\//,'');calls.push(file);return {ok:true,json:async()=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'))};};
  const art=await loadRegisteredCharacterHudArt({baseUrl:publicUrl,fetchImpl,speciesIds:['championship:creature:species-000']});
  assert.equal(calls.filter(x=>x.endsWith('/hud-r01/manifest.json')).length,1);
  assert.match(art.getPortrait('species-000').src,/accepted-20261010/);
  let updates=0;const stop=art.subscribe(()=>updates++);
  assert.equal(art.getPortrait('species-001'),null);
  await art.ensureSpecies(['species-001']);
  assert.match(art.getPortrait('species-001').src,/accepted-20261010/);assert.equal(updates,1);stop();
  const count=calls.length;
  const second=await loadRegisteredCharacterHudArt({baseUrl:publicUrl,fetchImpl,speciesIds:['species-000','species-001']});
  assert.equal(calls.length,count);assert.deepEqual(second.getPortrait('species-001'),art.getPortrait('species-001'));
  assert.equal(calls.filter(x=>x.endsWith('/hud-r01/manifest.json')).length,2);
  await art.ensureSpecies(['species-224']);
  assert.match(art.getPortrait('species-224').src,/accepted-20261010/);
  assert.deepEqual(art.getPortrait('species-224'),art.getPortrait('species-034'));
  assert.equal(calls.filter(x=>x.endsWith('/hud-r01/manifest.json')).length,3);
});

test('only the medals entry gains approved public-origin access; local experiments stay local',()=>{
  const medals=TOOLBAR_PRODUCT_ENTRIES.SYSTEM.find(e=>e.id==='medals');
  assert.equal(toolbarProductEntryAvailable(medals,publicUrl),true);
  assert.equal(toolbarProductEntryAvailable(medals,'http://127.0.0.1:8766/championship.html'),true);
  for(const url of ['https://orochi771127.github.io/another-game/','https://orochi771127.github.io.evil.test/championship-2026/','https://game.example/','file:///championship.html'])
    assert.equal(toolbarProductEntryAvailable(medals,url),false,url);
  assert.equal(toolbarProductEntryAvailable({id:'local-experiment',localOnly:true},publicUrl),false);
  assert.equal(toolbarProductEntryAvailable({id:'settings'},publicUrl),true);
});

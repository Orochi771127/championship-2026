import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import support from './friends-installer-fixture-support.cjs';

test('private installer preserves original UI and seed through exactly three in-memory routes',async()=>{
 const repo=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
 const html=fs.readFileSync(path.join(repo,'full-qa-save.html'),'utf8');
 const seedText=fs.readFileSync(path.join(repo,'qa/championship-full-qa-save.json'),'utf8');
 const fixtures=await support.createInstallerFixtures(repo);
 assert.deepEqual(fixtures.seed,JSON.parse(seedText));
 assert.equal(fixtures.route('/qa/championship-full-qa-save.json').body,seedText);
 assert.equal(fixtures.route('/qa/championship-full-qa-save.json').contentType,'application/json');
 assert.equal(fixtures.route('/full-qa-save.html').body,html.replace(/<script type="module">[\s\S]*?<\/script>/,'<script type="module" src="./__friends-fixtures/installer.js"></script>'));
 const module=fixtures.route('/__friends-fixtures/installer.js');
 assert.equal(module.contentType,'text/javascript');
 assert.ok(module.body.length>0);
 // Each original UI operation remains bundled, including backup/expansion.
 for(const marker of ['qa-expansion-backup','championshipModernSave:v1','./championship.html','./qa/championship-full-qa-save.json'])assert.ok(module.body.includes(marker),marker);
 for(const pathname of ['/championship.html','/pages-build.json','/src/championship/app/championshipStandaloneSave.js','/src/championship/app/qaRanchExpansion.js','/qa/other.json','/full-qa-save.html/extra','/../full-qa-save.html','/%66ull-qa-save.html','/constructor','/__proto__'])assert.equal(fixtures.route(pathname),undefined,pathname);
 assert.equal(fs.readFileSync(path.join(repo,'full-qa-save.html'),'utf8'),html);
 assert.equal(fs.readFileSync(path.join(repo,'qa/championship-full-qa-save.json'),'utf8'),seedText);
});

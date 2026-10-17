import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const root=fileURLToPath(new URL('../',import.meta.url));
const read=file=>JSON.parse(fs.readFileSync(path.join(root,file),'utf8'));
const input=read('docs/contracts/championship/WEB_BUILD_INPUTS.v1.json');
const selected=new Set(read('docs/contracts/championship/PUBLIC_RUNTIME_ALLOWLIST.v1.json').files.map(row=>row.path));
const legacy=[
  'src/championship/app/alternateFormQaCharacters.js',
  'src/championship/presentation/characterHudArt.js',
  'src/championship/presentation/completedOriginalCharacters.js'
];

test('public character entries use the public adapters while legacy QA sources remain local inputs',()=>{
  for(const file of legacy){
    assert.equal(selected.has(file),false,file);
    assert.ok(!input.files.includes(file),'Authoring source is outside public build inputs: '+file);
    assert.ok(fs.existsSync(path.join(root,file)),'Keep the local source bytes: '+file);
    assert.ok(!input.publicPlaytest.files.some(row=>row.path===file),file);
  }
  for(const file of ['publicCharacterRoster.js','publicCharacterHudArt.js']){
    const name='src/championship/presentation/'+file;
    assert.ok(selected.has(name)&&input.moduleEntries.includes(name),name);
  }
  const main=fs.readFileSync(path.join(root,'src/championship/app/main.js'),'utf8');
  assert.match(main,/import\(['"]\.\.\/presentation\/publicCharacterRoster\.js['"]\)/);
  assert.match(main,/from ['"]\.\.\/presentation\/publicCharacterHudArt\.js['"]/);
});

test('no selected JavaScript source retains a literal import URL to the three private character adapters',()=>{
  const blocked=new Set(legacy);
  // Check both static and dynamic literal module URLs, including query-suffixed
  // QA imports. Nonliteral URLs are not a claim of complete browser coverage.
  for(const file of selected){
    if(!file.endsWith('.js')||!file.startsWith('src/'))continue;
    const source=fs.readFileSync(path.join(root,file),'utf8');
    for(const match of source.matchAll(/['"](\.{1,2}\/[^'"\r\n]+\.js(?:[?#][^'"\r\n]*)?)['"]/g)){
      const target=path.posix.normalize(path.posix.join(path.posix.dirname(file),match[1].split(/[?#]/)[0]));
      assert.equal(blocked.has(target),false,file+' -> '+target);
    }
  }
});

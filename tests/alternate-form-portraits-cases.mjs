import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
test('production96 and QA95 preserve preceding heroes, original24 QA order and isolated metadata',()=>{
 const native=read('src/data/championship/database-hero-portraits.r1.json'),qa=read('src/data/championship/qa-database-hero-portraits.r1.json');
 assert.equal(native.entries.length,96);assert.equal(qa.entries.length,95);assert.equal(new Set(native.entries.map(e=>e.speciesIndex)).size,96);assert.equal(new Set(qa.entries.map(e=>e.speciesIndex)).size,95);
 const previous=read('tests/fixtures/authoring-heroes-a0944833.json')['src/data/championship/qa-database-hero-portraits.r1.json'];
 assert.deepEqual(qa.entries.slice(0,58),previous,'original QA ordering and metadata stay exact');
 const withoutQa=e=>{const {qaOnly,...critical}=e;return critical;};
 for(const entry of qa.entries)assert.deepEqual(withoutQa(entry),native.entries.find(row=>row.speciesIndex===entry.speciesIndex));
 assert.equal(qa.entries.some(entry=>entry.speciesIndex===125),false,'new MA62 public role does not rewrite the isolated QA catalog');
 const extra=qa.entries.filter(e=>e.qaOnly);assert.deepEqual(extra.map(e=>e.speciesIndex),[229,230]);
 for(const e of extra){const bytes=fs.readFileSync(new URL('../'+e.src,import.meta.url));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),e.sha256);assert.equal(bytes.readUInt32BE(16),1254);assert.equal(bytes.readUInt32BE(20),1254);}
 const html=fs.readFileSync(new URL('../alternate-form-qa.html',import.meta.url),'utf8');assert.ok(html.includes('qa-database-hero-portraits.r1.json'));
});

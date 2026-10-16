import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url)));
test('production57 preserves merged55 heroes; QA57 retains original24 order and isolated QA metadata',()=>{
 const native=read('src/data/championship/database-hero-portraits.r1.json'),qa=read('src/data/championship/qa-database-hero-portraits.r1.json');
 assert.equal(native.entries.length,57);assert.equal(qa.entries.length,57);assert.equal(new Set(native.entries.map(e=>e.speciesIndex)).size,57);assert.equal(new Set(qa.entries.map(e=>e.speciesIndex)).size,57);
 const base=native.entries.filter(e=>![229,230].includes(e.speciesIndex));assert.equal(base.length,55);
 assert.deepEqual(qa.entries.slice(0,22),base.slice(0,22));assert.deepEqual(qa.entries.slice(22,24).map(e=>e.speciesIndex),[229,230]);assert.deepEqual(qa.entries.slice(24),base.slice(22));
 const withoutQa=e=>{const {qaOnly,...critical}=e;return critical;};
 for(const entry of native.entries){assert.equal(entry.qaOnly,undefined);assert.deepEqual(withoutQa(qa.entries.find(e=>e.speciesIndex===entry.speciesIndex)),entry);}
 const extra=qa.entries.filter(e=>e.qaOnly);assert.deepEqual(extra.map(e=>e.speciesIndex),[229,230]);
 for(const e of extra){const bytes=fs.readFileSync(new URL('../'+e.src,import.meta.url));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),e.sha256);assert.equal(bytes.readUInt32BE(16),1254);assert.equal(bytes.readUInt32BE(20),1254);}
 const html=fs.readFileSync(new URL('../alternate-form-qa.html',import.meta.url),'utf8');assert.ok(html.includes('qa-database-hero-portraits.r1.json'));
});

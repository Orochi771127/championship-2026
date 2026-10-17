import test from 'node:test';
import assert from 'node:assert/strict';
import {assertPagesPayloadSize,PAGES_SITE_BYTE_LIMIT} from '../scripts/lib/pages-payload-size.mjs';
test('publication counts all actual output bytes, rather than transfer compression or only new assets',()=>{
 assert.equal(assertPagesPayloadSize([{path:'one',bytes:12},{path:'two',bytes:8}],20),20);
 assert.throws(()=>assertPagesPayloadSize([{path:'one',bytes:12},{path:'two',bytes:9}],20),/PUBLIC_PAGES_SITE_SIZE/);
 assert.equal(PAGES_SITE_BYTE_LIMIT,1_000_000_000);
 assert.throws(()=>assertPagesPayloadSize([{path:'old-site',bytes:1_367_200_749},{path:'new-pages',bytes:440_467_249}]),/PUBLIC_PAGES_SITE_SIZE/);
});
test('invalid output sizes cannot turn a quota failure into a passing receipt',()=>{
 for(const bytes of [-1,NaN,Infinity,'10'])assert.throws(()=>assertPagesPayloadSize([{path:'invalid',bytes}]),/PUBLIC_PAGES_FILE_SIZE_INVALID/);
});

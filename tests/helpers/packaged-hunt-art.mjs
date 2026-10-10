import fs from 'node:fs';import assert from 'node:assert/strict';import {createHash} from 'node:crypto';
export const huntPackaging=JSON.parse(fs.readFileSync('tests/fixtures/packaged-hunt-integrity-20261010.json','utf8'));
const selected=new Map(huntPackaging.files.map(r=>[r.target,r]));
export function sourceAsset(asset){const r=selected.get(asset.src);assert.ok(r,asset.src);assert.equal(asset.sha256.toLowerCase(),r.sha256);const bytes=fs.readFileSync(asset.src);assert.equal(bytes.length,r.bytes);assert.equal(createHash('sha256').update(bytes).digest('hex'),r.sha256);if(asset.src.endsWith('.json')&&!asset.src.endsWith('manifest.json'))assert.equal(r.geometryByteExact,true);else if(!asset.src.endsWith('.json'))assert.equal(r.allRgbaExact,true);return r;}
export const sourceHash=asset=>sourceAsset(asset).sourceSha256;

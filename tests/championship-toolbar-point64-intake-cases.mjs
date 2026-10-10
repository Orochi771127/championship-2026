import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {originalToolbarArt} from '../src/championship/presentation/completedOriginalUi20261007.js';
import {isShippingArtEntry} from '../scripts/lib/public-art-boundary.mjs';
const folder='assets/production/original-ui-intake-20261007/toolbar-point64-r1-20261009';
const manifest=JSON.parse(readFileSync(new URL('../'+folder+'/manifest.json',import.meta.url)));
const local='http://127.0.0.1:8766/championship.html';
const sha=data=>createHash('sha256').update(data).digest('hex');

test('three local toolbar candidates retain delivered bytes, full raster and origin',()=>{
 const delivered={
  hand:'1adcd5b6d3acfe9599ad702bd1a2959c772ce5d8a271baacbdc7f5175fc6717a',
  manage:'5d58bcbe356bba4cdeddd663deb3e97b861273d105c4fa0a010397567855d686',
  system:'a11dd5c9b8b5ddee9c81e4c7f1ecbcc83d6dd9a3b74f14957cf9e74d1b0a6030'
 };
 assert.deepEqual(manifest.assets.map(a=>a.role).sort(),Object.keys(delivered).sort());
 for(const [role,expected] of Object.entries(delivered)){
  const art=originalToolbarArt(role,local);
  assert.equal(art.src,folder+'/'+role+'-rest.png');
  const bytes=readFileSync(new URL('../'+art.src,import.meta.url));
  assert.equal(sha(bytes),expected);assert.equal(art.sha256,expected);
  assert.deepEqual([bytes.readUInt32BE(16),bytes.readUInt32BE(20)],[64,64]);
  assert.deepEqual(art.nativeSize,[16,16]);assert.deepEqual(art.origin,[8,8]);
  assert.equal(art.density,4);assert.deepEqual(art.rasterAnchor,[32,32]);
 }
});

test('all eight original toolbar roles remain loopback only and unknown roles stay null',()=>{
 const roles=['hand','feed','protein','clean','woundMedicine','medicine','manage','system'];
 for(const origin of ['http://localhost:8766','http://127.0.0.1:8766','https://[::1]:8766']){
  for(const role of roles)assert.ok(originalToolbarArt(role,origin),role);
 }
 for(const origin of ['https://example.com','https://localhost.example.com','https://127.0.0.1.example.com','file:///R:/championship.html','not a url']){
  for(const role of roles)assert.equal(originalToolbarArt(role,origin),null,role+' '+origin);
 }
 assert.equal(originalToolbarArt('unknown',local),null);
});

test('existing five toolbar originals keep their delivered hashes and paths',()=>{
 const unchanged={
  feed:['care19','30738d75577c5ac56d769a5b50998664ca9dcc347d9210363a81dfe90f20b527'],
  protein:['care19','b573a786ded64c0d2d2e97dfde8f47efa58ae2da664f613fa1b430ceab18d63f'],
  clean:['care19','a341bf6204686b95767e9f2534561f107fdc4acb84595d11fc1ab4a716e38109'],
  woundMedicine:['shop2','5e4afac03259ab5f70c36facec6b3cb1654aded52ba94de793c71e86997d9fab'],
  medicine:['shop2','6da84423031d1c26a8de930a48cef739df9b64f609a2e976f1929ca79027fad7']
 };
 for(const [role,[group,expected]] of Object.entries(unchanged)){
  const art=originalToolbarArt(role,local);
  assert.equal(art.src,'assets/production/original-ui-intake-20261007/items/'+group+'/'+role+'-rest.png');
  assert.equal(sha(readFileSync(new URL('../'+art.src,import.meta.url))),expected);
 }
});

test('scoped Owner visual approval does not promote local art to full runtime acceptance or public shipping',()=>{
 assert.equal(manifest.humanApproved,true);
 assert.equal(manifest.humanApprovalScope,'HAND_MANAGE_SYSTEM_VISUAL_ONLY');
 assert.equal(manifest.ownerVisualApproval.approved,true);
 assert.equal(manifest.ownerVisualApproval.ownerMessageId,'Sentinel_751ba88b201c8191ab2994fbbbb84eed');
 assert.equal(manifest.ownerVisualApproval.approvedAt,'2026-10-09T13:47:00Z');
 assert.equal(manifest.ownerVisualApproval.previewLibraryId,'libfile_73041eca66b081919f5ec831b0dc1e49');
 assert.deepEqual(manifest.ownerVisualApproval.assetSha256,Object.fromEntries(manifest.assets.map(a=>[a.role,a.sha256])));
 assert.equal(manifest.runtimeAccepted,false);
 assert.equal(manifest.publicReleasePermitted,false);assert.equal(manifest.shippingReady,false);
 assert.equal(manifest.runtimeScope,'LOOPBACK_ONLY');
 assert.equal(isShippingArtEntry({...manifest,manifestPath:folder+'/manifest.json'}),false);
});

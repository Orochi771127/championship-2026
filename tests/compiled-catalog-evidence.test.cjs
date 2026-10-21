const test = require('node:test');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {assertCompiledCatalog} = require('./compiled-catalog-evidence.cjs');
const file = 'src/data/championship/database-hero-portraits.public.v1.json';
const bytes = Buffer.from('{"entries":[]}');
const row = {path: file, sha256: createHash('sha256').update(bytes).digest('hex')};
test('accepts exact bytes only from the exact compiler input', () => {
  assert.equal(assertCompiledCatalog(file, bytes, [row]), bytes);
});
test('rejects a catalog not present in compilation', () => {
  assert.throws(() => assertCompiledCatalog(file, bytes, []), /exact compiler input/);
  assert.throws(() => assertCompiledCatalog(file, bytes, [{...row, path: 'different.json'}]), /exact compiler input/);
});
test('rejects duplicate compiler input identity', () => {
  assert.throws(() => assertCompiledCatalog(file, bytes, [row, row]), /exact compiler input/);
});
test('rejects changed source bytes even when valid JSON', () => {
  assert.throws(() => assertCompiledCatalog(file, Buffer.from('{"entries":[1]}'), [row]), /source drift/);
});
test('rejects a mismatched compiler source hash', () => {
  assert.throws(() => assertCompiledCatalog(file, bytes, [{...row, sha256: '0'.repeat(64)}]), /source drift/);
});

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const {compiledCatalogEvidence} = require('./compiled-catalog-evidence.cjs');
// Isolated dependency-contract fixture: these are NOT production build results.
function fixture(t, {invalidArtifact = false, changedBundle = false} = {}) {
  const repo = fs.mkdtempSync(path.join(os.tmpdir(), 'compiled-catalog-contract-'));
  t.after(() => fs.rmSync(repo, {recursive: true, force: true}));
  const put = (file, value) => { const p = path.join(repo, file); fs.mkdirSync(path.dirname(p), {recursive: true}); fs.writeFileSync(p, value); };
  put(file, bytes);
  put('index.json', '{}');
  put('scripts/lib/web-build-artifact.mjs', `export const PLAYTEST_TARGET='GITHUB_PAGES_OWNER_PLAYTEST'; export function validateWebArtifact({target}) { if(target!==PLAYTEST_TARGET)throw Error('wrong target'); ${invalidArtifact ? "throw Error('PUBLIC_BUNDLE_CHANGED');" : "return {buildId:'fixture-only'};"} }`);
  put('scripts/lib/web-build-plan.mjs', "export const ART_INDEX_PATH='index.json'; export function readBuildInputs(){return {files:[]};}");
  put('scripts/lib/public-runtime-boundary.mjs', 'export function publicArtifactPlan(){return {files:[],moduleEntries:[]};}');
  put('scripts/lib/browser-bundle.mjs', `export function compileBrowserBundle(){return {files:[{path:'assets/app.js',bytes:Buffer.from('exact compiled output')}],metadata:{inputFiles:${JSON.stringify([row])}}};}`);
  put('dist/test/assets/app.js', changedBundle ? 'changed output' : 'exact compiled output');
  return {repo, artifactRoot: path.join(repo, 'dist/test')};
}
test('reader records exact input provenance after artifact and bundle checks', async t => {
  const f = fixture(t);
  const evidence = await compiledCatalogEvidence(f.artifactRoot, f.repo);
  assert.equal(evidence.build.buildId, 'fixture-only');
  assert.deepEqual(evidence.read(file), bytes);
  assert.deepEqual(evidence.records, [{file, sha256: row.sha256, provenance:'EXACT_VALIDATED_COMPILER_INPUT'}]);
});
test('reader propagates artifact-validator failure rather than falling back', async t => {
  const f = fixture(t, {invalidArtifact:true});
  await assert.rejects(compiledCatalogEvidence(f.artifactRoot, f.repo), /PUBLIC_BUNDLE_CHANGED/);
});
test('reader rejects mismatch between actual built bytes and recompiled output', async t => {
  const f = fixture(t, {changedBundle:true});
  await assert.rejects(compiledCatalogEvidence(f.artifactRoot, f.repo), /Built compiler output drift/);
});
test('reader rejects source mutation after validation and out-of-scope paths', async t => {
  const f = fixture(t);
  const evidence = await compiledCatalogEvidence(f.artifactRoot, f.repo);
  fs.writeFileSync(path.join(f.repo, file), '{"entries":[2]}');
  assert.throws(() => evidence.read(file), /source drift/);
  assert.throws(() => evidence.read('src/data/championship/../private.json'), /explicit runtime JSON/);
});

const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {createHash} = require('node:crypto');
const {pathToFileURL} = require('node:url');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');

// A source catalog is evidence only after the entire published artifact has been
// validated against a fresh deterministic compilation of this exact checkout.
// Do not republish omitted JSON or fall back to unverified repository bytes.
function assertCompiledCatalog(file, bytes, inputFiles) {
  const matches = inputFiles.filter(row => row.path === file);
  assert.equal(matches.length, 1, `Catalog must be an exact compiler input: ${file}`);
  assert.equal(matches[0].sha256, sha256(bytes), `Compiled catalog source drift: ${file}`);
  return bytes;
}
async function compiledCatalogEvidence(artifactRoot, repo = process.cwd()) {
  const load = file => import(pathToFileURL(path.join(repo, 'scripts/lib', file)).href);
  const {validateWebArtifact, PLAYTEST_TARGET} = await load('web-build-artifact.mjs');
  const build = validateWebArtifact({root: repo, output: artifactRoot, target: PLAYTEST_TARGET});
  const {readBuildInputs, ART_INDEX_PATH} = await load('web-build-plan.mjs');
  const {publicArtifactPlan} = await load('public-runtime-boundary.mjs');
  const {compileBrowserBundle} = await load('browser-bundle.mjs');
  const input = readBuildInputs(repo);
  const plan = publicArtifactPlan({root: repo, input,
    index: JSON.parse(fs.readFileSync(path.join(repo, ART_INDEX_PATH), 'utf8'))});
  const bundle = compileBrowserBundle(repo, {...input, files: plan.files, moduleEntries: plan.moduleEntries});
  assert.ok(bundle, 'Compiled catalog evidence requires a browser bundle');
  // Bind this compilation as well as the validator's compilation to actual bytes.
  for (const file of bundle.files) {
    assert.equal(sha256(fs.readFileSync(path.join(artifactRoot, file.path))), sha256(file.bytes),
      `Built compiler output drift: ${file.path}`);
  }
  const records = [];
  function read(file) {
    assert.ok(file.startsWith('src/data/championship/') && file.endsWith('.json')
      && !file.split('/').includes('..'), 'Only explicit runtime JSON catalogs');
    const bytes = assertCompiledCatalog(file, fs.readFileSync(path.join(repo, file)), bundle.metadata.inputFiles);
    records.push({file, sha256: sha256(bytes), provenance: 'EXACT_VALIDATED_COMPILER_INPUT'});
    return bytes;
  }
  return {build, read, records};
}
module.exports = {compiledCatalogEvidence, assertCompiledCatalog};

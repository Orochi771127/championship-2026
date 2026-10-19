import test from 'node:test';
import assert from 'node:assert/strict';
import {encodePublicBuildManifest,decodeBuildManifest} from '../scripts/lib/build-manifest-codec.mjs';
const manifest={schemaVersion:2,buildId:'test-build',commit:'test-commit',fileCount:301,
  files:Array.from({length:300},(_,i)=>({path:`assets/production/characters/accepted-example/long-directory-${i%3}/frame-${i}.webp`,sha256:i.toString(16).padStart(64,'0'),bytes:1000+i}))};
test('directory-table receipt roundtrips every full path, SHA256 and byte count without changing runtime bytes',()=>{
 const wire=encodePublicBuildManifest(manifest),decoded=decodeBuildManifest(JSON.parse(JSON.stringify(wire)));
 assert.equal(wire.schemaVersion,3);assert.equal(wire.files,undefined);
 assert.deepEqual(decoded,{...manifest,schemaVersion:3});
 assert.ok(JSON.stringify(wire).length<JSON.stringify(manifest).length*.8);
 assert.deepEqual(decodeBuildManifest(manifest),manifest,'legacy schema2 remains readable');
});
test('ambiguous tables, traversal, invalid indices, SHA and byte counts fail closed',()=>{
 for(const mutate of[
  w=>w.files=[],w=>w.fileTable.columns.reverse(),w=>w.fileTable.rows[0][0]=999,
  w=>w.fileTable.directories[0]='../',w=>w.fileTable.rows[0][1]='../escape.webp',
  w=>w.fileTable.rows[0][2]='bad',w=>w.fileTable.rows[0][3]=-1,
  w=>w.fileTable.directories.push(w.fileTable.directories[0])
 ]){const wire=encodePublicBuildManifest(manifest);mutate(wire);assert.throws(()=>decodeBuildManifest(wire),/BUILD_FILE_TABLE_INVALID/);}
});

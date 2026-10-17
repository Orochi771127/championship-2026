import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {assertPublicRanchStreaming,RANCH_STREAMING_SELECTION} from '../scripts/lib/public-ranch-streaming-boundary.mjs';
import {assertPublicBytes} from '../scripts/lib/public-runtime-boundary.mjs';
const hash=b=>createHash('sha256').update(b).digest('hex');
function fixture(t,descriptor){
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'championship-ranch-boundary-'));
 t.after(()=>{const resolved=fs.realpathSync(root);assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));assert.ok(path.basename(resolved).startsWith('championship-ranch-boundary-'));fs.rmSync(resolved,{recursive:true});});
 const file='assets/production/characters/ranch-test/runtime.json',bytes=Buffer.from(JSON.stringify(descriptor));
 const write=(name,data)=>{fs.mkdirSync(path.dirname(path.join(root,name)),{recursive:true});fs.writeFileSync(path.join(root,name),data);};
 const selection={schemaVersion:1,characters:[{entityId:'test-entity',runtimePath:file,runtimeSha256:hash(bytes)}]};
 write(file,bytes);write(RANCH_STREAMING_SELECTION,JSON.stringify(selection));
 return {root,file,write,selection,files:[RANCH_STREAMING_SELECTION,file],allowlist:{files:[{path:file,sha256:hash(bytes),jsonFields:Object.keys(descriptor)}]},assertBytes:assertPublicBytes};
}
test('a public module graph cannot silently omit a dynamically requested resident descriptor',t=>{
 const f=fixture(t,{schemaVersion:1,width:32,height:32});
 assert.throws(()=>assertPublicRanchStreaming({...f,files:[RANCH_STREAMING_SELECTION]}),/PUBLIC_RANCH_RUNTIME_NOT_SELECTED/);
 assert.deepEqual(assertPublicRanchStreaming(f),{required:true,characters:1});
});
test('adding exact descriptor hashes cannot legalize nested private review data',t=>{
 const f=fixture(t,{schemaVersion:1,ownerReplyId:'owner-private-message'});
 assert.throws(()=>assertPublicRanchStreaming(f),/PUBLIC_PAYLOAD_PRIVATE_KEY/);
});
test('runtime descriptor bytes must match their reviewed selection before any artifact can pass',t=>{
 const f=fixture(t,{schemaVersion:1,width:32,height:32});f.write(f.file,'{"schemaVersion":1,"width":64,"height":32}');
 assert.throws(()=>assertPublicRanchStreaming(f),/PUBLIC_RANCH_RUNTIME_HASH/);
});

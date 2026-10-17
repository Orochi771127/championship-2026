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
 const selection={schemaVersion:1,characters:[{entityId:'test-entity',runtimePath:file,runtimeSha256:hash(bytes),sourceRuntimeSha256:'source-runtime',sourceImageSha256:'source-image'}]};
 write(file,bytes);write(RANCH_STREAMING_SELECTION,JSON.stringify(selection));
 return {root,file,write,selection,files:[RANCH_STREAMING_SELECTION,file],allowlist:{files:[{path:file,sha256:hash(bytes),jsonFields:Object.keys(descriptor)}]},assertBytes:assertPublicBytes};
}
const render=()=>({schemaVersion:1,kind:'CHARACTER_RENDER_V1',entityId:'test-entity',
 streaming:{side:'main',sourceRuntimeSha256:'source-runtime',sourceImageSha256:'source-image',pages:[]},
 sides:{main:{atlases:[]},sub:{atlases:[]}}});
const fields=v=>{const keys=new Set();function visit(v){if(Array.isArray(v))v.forEach(visit);else if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){keys.add(k);visit(x);}}visit(v);return [...keys];};
function publicFixture(t,value=render()){
 const f=fixture(t,value);f.allowlist.files[0].jsonFields=fields(value);return f;
}
test('a public module graph cannot silently omit a dynamically requested resident descriptor',t=>{
 const f=publicFixture(t);
 assert.throws(()=>assertPublicRanchStreaming({...f,files:[RANCH_STREAMING_SELECTION]}),/PUBLIC_RANCH_RUNTIME_NOT_SELECTED/);
 assert.deepEqual(assertPublicRanchStreaming(f),{required:true,characters:1});
});
test('adding exact descriptor hashes cannot legalize nested private review data',t=>{
 const f=publicFixture(t,{...render(),ownerReplyId:'owner-private-message'});
 assert.throws(()=>assertPublicRanchStreaming(f),/PUBLIC_PAYLOAD_PRIVATE_KEY/);
});
test('runtime descriptor bytes must match their reviewed selection before any artifact can pass',t=>{
 const f=publicFixture(t);f.write(f.file,'{"schemaVersion":1,"width":64,"height":32}');
 assert.throws(()=>assertPublicRanchStreaming(f),/PUBLIC_RANCH_RUNTIME_HASH/);
});

test('dynamic atlas pages must be selected with their exact image and metadata hashes',t=>{
 const value=render(),page={data:'main-0000000000000000.json',image:'main-0000000000000000.webp',dataSha256:'data-hash',imageSha256:'image-hash'};
 value.streaming.pages.push(page);value.sides.main.atlases.push({data:page.data,image:page.image});
 const f=publicFixture(t,value);
 assert.throws(()=>assertPublicRanchStreaming(f),/PUBLIC_RANCH_PAGE_NOT_SELECTED/);
 for(const field of ['data','image']){
  const file=path.posix.join(path.posix.dirname(f.file),page[field]);f.files.push(file);
  f.allowlist.files.push({path:file,sha256:page[field+'Sha256']});
 }
 assert.deepEqual(assertPublicRanchStreaming(f),{required:true,characters:1});
 f.allowlist.files.at(-1).sha256='wrong';assert.throws(()=>assertPublicRanchStreaming(f),/PUBLIC_RANCH_PAGE_NOT_SELECTED/);
});

test('public ranch descriptors cannot silently reference the old Sub atlas or another source',t=>{
 const value=render();value.sides.sub.atlases.push({image:'../../main.webp'});
 assert.throws(()=>assertPublicRanchStreaming(publicFixture(t,value)),/PUBLIC_RANCH_RENDER_SCHEMA/);
 const drift=render();drift.streaming.sourceImageSha256='other-image';
 assert.throws(()=>assertPublicRanchStreaming(publicFixture(t,drift)),/PUBLIC_RANCH_RENDER_SCHEMA/);
});

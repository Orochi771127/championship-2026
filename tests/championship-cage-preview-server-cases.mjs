import assert from 'node:assert/strict';
import {spawn,spawnSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import test from 'node:test';

const root=path.resolve(import.meta.dirname,'..');
const pack='docs/art/production/original-character-cage-r1/cage-base3d-v1/daylight-v2/fields/field_cm02_01';
const frame='/assets/production/cage/licensed-runtime-v1/fields/field_cm02_01/frame-00.png';
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');

async function server(t,args=[]){
  const child=spawn(process.execPath,['scripts/serve.mjs',...args],{cwd:root,
    env:{...process.env,CHAMPIONSHIP_HOST:'127.0.0.1',CHAMPIONSHIP_PORT:'0'},windowsHide:true});
  t.after(()=>child.kill());
  return await new Promise((resolve,reject)=>{
    let output=''; const timeout=setTimeout(()=>{child.kill();reject(Error('server readiness timeout'));},10000);
    child.stdout.on('data',chunk=>{
      output+=chunk; const match=output.match(/http:\/\/127\.0\.0\.1:(\d+)\//);
      if(match){clearTimeout(timeout);resolve(`http://127.0.0.1:${match[1]}`);}
    });
    child.once('error',error=>{clearTimeout(timeout);reject(error);});
    child.once('exit',code=>{clearTimeout(timeout);if(!output.includes('Championship 2026:'))reject(Error(`startup failed ${code}`));});
  });
}

test('default server serves the untouched production frame',async t=>{
  const base=await server(t); const response=await fetch(base+frame);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('X-Championship-Cage-Preview'),null);
  assert.equal(sha(Buffer.from(await response.arrayBuffer())),sha(fs.readFileSync(path.join(root,frame.slice(1)))));
});

test('explicit local preview substitutes exactly one field and preserves production files',async t=>{
  const manifest=path.join(root,'assets/production/cage/licensed-runtime-v1/manifest.json');
  const before=sha(fs.readFileSync(manifest));
  const base=await server(t,['--cage-preview',pack]);
  const response=await fetch(base+frame);
  assert.equal(response.status,200);
  assert.equal(response.headers.get('X-Championship-Cage-Preview'),'field_cm02_01');
  assert.equal(sha(Buffer.from(await response.arrayBuffer())),sha(fs.readFileSync(path.join(root,pack,'previews/composite-hd4x.png'))));
  const waiting='/assets/production/cage/licensed-runtime-v1/fields/field_cm28_01/frame-00.png';
  const other=await fetch(base+waiting);
  assert.equal(other.headers.get('X-Championship-Cage-Preview'),null);
  assert.equal(sha(Buffer.from(await other.arrayBuffer())),sha(fs.readFileSync(path.join(root,waiting.slice(1)))));
  assert.equal(sha(fs.readFileSync(manifest)),before);
});

test('preview response refuses a non-loopback Host header',async t=>{
  const base=await server(t,['--cage-preview',pack]);
  const status=await new Promise((resolve,reject)=>{
    http.get(base+frame,{headers:{Host:'public.example'}},response=>{
      response.resume(); resolve(response.statusCode);
    }).on('error',reject);
  });
  assert.equal(status,403);
});

test('multiple independent candidates are served without combining assets',async t=>{
  const basePack='docs/art/production/original-character-cage-r1/cage-base3d-v1/seam-v3/fields/';
  const ids=['field_cm28_01','field_cm02_01','field_cm01_01','field_cm16_01'];
  const base=await server(t,ids.flatMap(id=>['--cage-preview',basePack+id]));
  for(const id of ids){
    const response=await fetch(`${base}/assets/production/cage/licensed-runtime-v1/fields/${id}/frame-00.png`);
    assert.equal(response.headers.get('X-Championship-Cage-Preview'),id);
    assert.equal(sha(Buffer.from(await response.arrayBuffer())),sha(fs.readFileSync(path.join(root,basePack,id,'previews/composite-hd4x.png'))));
  }
  const lid=await fetch(`${base}/assets/production/cage/licensed-runtime-v1/fields/field_cm29_01/frame-00.png`);
  assert.equal(lid.headers.get('X-Championship-Cage-Preview'),null);
});

test('duplicate field and missing pack argument fail closed',()=>{
  for(const [args,error] of [[['--cage-preview',pack,'--cage-preview',pack],'DUPLICATE_FIELD'],[['--cage-preview'],'PACK_REQUIRED']]){
    const result=spawnSync(process.execPath,['scripts/serve.mjs',...args],{cwd:root,
      env:{...process.env,CHAMPIONSHIP_HOST:'127.0.0.1',CHAMPIONSHIP_PORT:'0'},windowsHide:true,encoding:'utf8',timeout:10000});
    assert.notEqual(result.status,0);assert.match(result.stderr,new RegExp(error));
  }
});

test('stage 2 original candidates map to four separate runtime URLs without changing other fields',async t=>{
  const basePack='docs/art/production/original-character-cage-r1/cage-base3d-v1/seam-v3/fields/';
  const ids=['field_cm05_01','field_cm30_01','field_cm31_01','field_cm34_01'];
  const base=await server(t,ids.flatMap(id=>['--cage-preview',basePack+id]));
  for(const id of ids){
    const response=await fetch(`${base}/assets/production/cage/licensed-runtime-v1/fields/${id}/frame-00.png`);
    assert.equal(response.status,200);
    assert.equal(response.headers.get('X-Championship-Cage-Preview'),id);
    assert.equal(sha(Buffer.from(await response.arrayBuffer())),sha(fs.readFileSync(path.join(root,basePack,id,'previews/composite-hd4x.png'))));
  }
  const untouched=await fetch(base+frame);
  assert.equal(untouched.headers.get('X-Championship-Cage-Preview'),null);
  assert.equal(sha(Buffer.from(await untouched.arrayBuffer())),sha(fs.readFileSync(path.join(root,frame.slice(1)))));
});

test('structural lid candidate is served only by explicit local opt-in',async t=>{
  const lidPack='docs/art/production/original-character-cage-r1/cage-base3d-v1/seam-v3/fields/field_cm29_01';
  const base=await server(t,['--cage-preview',lidPack]);
  const response=await fetch(`${base}/assets/production/cage/licensed-runtime-v1/fields/field_cm29_01/frame-00.png`);
  assert.equal(response.headers.get('X-Championship-Cage-Preview'),'field_cm29_01');
  assert.equal(sha(Buffer.from(await response.arrayBuffer())),sha(fs.readFileSync(path.join(root,lidPack,'previews/composite-hd4x.png'))));
  assert.equal((await fetch(base+frame)).headers.get('X-Championship-Cage-Preview'),null);
});

test('athletics dojo and flipped-cell ring stay three separate preview frames',async t=>{
  const basePack='docs/art/production/original-character-cage-r1/cage-base3d-v1/seam-v3/fields/';
  const ids=['field_cm03_01','field_cm04_01','field_cm27_01'];
  const base=await server(t,ids.flatMap(id=>['--cage-preview',basePack+id]));
  for(const id of ids){
    const response=await fetch(`${base}/assets/production/cage/licensed-runtime-v1/fields/${id}/frame-00.png`);
    assert.equal(response.status,200);
    assert.equal(response.headers.get('X-Championship-Cage-Preview'),id);
    assert.equal(sha(Buffer.from(await response.arrayBuffer())),sha(fs.readFileSync(path.join(root,basePack,id,'previews/composite-hd4x.png'))));
  }
});

test('seven natural cages retain individual local preview URLs including zero-object fields',async t=>{
  const basePack='docs/art/production/original-character-cage-r1/cage-base3d-v1/seam-v3/fields/';
  const ids=['field_cm10_01','field_cm11_01','field_cm12_01','field_cm20_01','field_cm35_01','field_cm37_01','field_cm40_01'];
  const base=await server(t,ids.flatMap(id=>['--cage-preview',basePack+id]));
  for(const id of ids){
    const response=await fetch(`${base}/assets/production/cage/licensed-runtime-v1/fields/${id}/frame-00.png`);
    assert.equal(response.status,200);
    assert.equal(response.headers.get('X-Championship-Cage-Preview'),id);
    assert.equal(sha(Buffer.from(await response.arrayBuffer())),sha(fs.readFileSync(path.join(root,basePack,id,'previews/composite-hd4x.png'))));
  }
  assert.equal((await fetch(base+frame)).headers.get('X-Championship-Cage-Preview'),null);
});

test('preview cannot listen publicly or point outside the original workpack',()=>{
  for(const [host,selected,error] of [['0.0.0.0',pack,'REQUIRES_LOCAL'],['127.0.0.1','scripts','OUTSIDE_ORIGINAL']]){
    const result=spawnSync(process.execPath,['scripts/serve.mjs','--cage-preview',selected],{
      cwd:root,env:{...process.env,CHAMPIONSHIP_HOST:host,CHAMPIONSHIP_PORT:'0'},windowsHide:true,encoding:'utf8',timeout:10000});
    assert.notEqual(result.status,0); assert.match(result.stderr,new RegExp(error));
  }
});

test('surface animation serves both original frame URLs with distinct candidate pixels',async t=>{
  const basePack='docs/art/production/original-character-cage-r1/cage-base3d-v1/seam-v3/fields/';
  const ids=['field_cm07_01','field_cm39_01','field_cm09_01','field_cm21_01'];
  const base=await server(t,ids.flatMap(id=>['--cage-preview',basePack+id]));
  for(const id of ids){
    const hashes=[];
    for(let index=0;index<2;index++){
      const name=`frame-${String(index).padStart(2,'0')}.png`;
      const response=await fetch(`${base}/assets/production/cage/licensed-runtime-v1/fields/${id}/${name}`);
      assert.equal(response.status,200);assert.equal(response.headers.get('X-Championship-Cage-Preview'),id);
      hashes.push(sha(Buffer.from(await response.arrayBuffer())));
      assert.equal(hashes[index],sha(fs.readFileSync(path.join(root,basePack,id,'previews',name))));
    }
    assert.notEqual(hashes[0],hashes[1]);
  }
  assert.equal((await fetch(base+frame)).headers.get('X-Championship-Cage-Preview'),null);
});

test('animation preview refuses incomplete, mistimed and stale frame proofs',t=>{
  const artRoot=path.join(root,'docs/art/production/original-character-cage-r1');
  const source=path.join(artRoot,'cage-base3d-v1/seam-v3/fields/field_cm39_01');
  const temporary=fs.mkdtempSync(path.join(artRoot,'animation-test-'));
  t.after(()=>{
    assert.equal(path.dirname(temporary),artRoot);
    assert.ok(path.basename(temporary).startsWith('animation-test-'));
    fs.rmSync(temporary,{recursive:true});
  });
  fs.mkdirSync(path.join(temporary,'previews'));
  fs.copyFileSync(path.join(source,'modular-manifest.json'),path.join(temporary,'modular-manifest.json'));
  for(const name of ['composite-hd4x.png','frame-00.png','frame-01.png'])
    fs.copyFileSync(path.join(source,'previews',name),path.join(temporary,'previews',name));
  const original=JSON.parse(fs.readFileSync(path.join(source,'previews/modular-proof.json'),'utf8'));
  for(const [change,error] of [
    [p=>p.animationFrames.pop(),'ANIMATION_INCOMPLETE'],
    [p=>p.animationFrames[1].durationMs=100,'TIMING_DRIFT'],
    [p=>p.animationFrames[1].sha256='0'.repeat(64),'HASH_OR_PROOF_DRIFT']]){
    const proof=structuredClone(original);change(proof);
    fs.writeFileSync(path.join(temporary,'previews/modular-proof.json'),JSON.stringify(proof));
    const result=spawnSync(process.execPath,['scripts/serve.mjs','--cage-preview',temporary],{
      cwd:root,env:{...process.env,CHAMPIONSHIP_HOST:'127.0.0.1',CHAMPIONSHIP_PORT:'0'},
      windowsHide:true,encoding:'utf8',timeout:10000});
    assert.notEqual(result.status,0);assert.match(result.stderr,new RegExp(error));
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {once} from 'node:events';
import {isPrivateRepositoryPath,publicArtIndex} from '../scripts/lib/public-art-boundary.mjs';
import index from '../assets/production/ART_PRODUCTION_INDEX.json' with {type:'json'};
import manifest from '../assets/production/internal-faithful-baseline/battle-effects-v1/manifest.json' with {type:'json'};
import audio from '../assets/production/internal-faithful-baseline/battle-audio-v1/manifest.json' with {type:'json'};

test('public build excludes original local cells and retired generated cells even if tracked',()=>{
  const paths=[manifest.image.src,'assets/production/internal-faithful-baseline/battle-effects-v1/manifest.json',
    'assets/production/vfx/original-battle-2d-v1/effects.png',...audio.sounds.map(s=>s.src)];
  for(const path of paths){assert.equal(isPrivateRepositoryPath(path),true);assert.equal(isPrivateRepositoryPath(path.replaceAll('/','\\')),true);}
  assert.equal(isPrivateRepositoryPath('src/championship/presentation/battleEffectArt.js'),false);
  const publicIndex=publicArtIndex(index);
  for(const id of [audio.assetId,'art:vfx:battle-effects:local-reference:v1','art:vfx:original-battle-2d:v1'])assert.equal(publicIndex.entries.some(e=>e.assetId===id),false);
  assert.equal(publicIndex.summary.registeredRuntimeBundles,publicIndex.entries.length);
  assert.ok(index.entries.some(e=>e.assetId===manifest.assetId),'source index is unchanged');
  const probe=structuredClone(index);probe.entries.find(e=>e.assetId===manifest.assetId).publicReleasePermitted=true;
  assert.equal(publicArtIndex(probe).entries.some(e=>e.assetId===manifest.assetId),false,'local flag remains an independent boundary');
});

test('loopback server serves the registered original atlas and refuses a foreign Host',async t=>{
  const server=spawn(process.execPath,['scripts/serve.mjs'],{cwd:new URL('..',import.meta.url),windowsHide:true,
    env:{...process.env,CHAMPIONSHIP_PORT:'0',CHAMPIONSHIP_HOST:'127.0.0.1'},stdio:['ignore','pipe','pipe']});
  t.after(async()=>{if(server.exitCode===null){const done=once(server,'exit');server.kill();await done;}});
  const port=await new Promise((resolve,reject)=>{
    let output='';const timer=setTimeout(()=>reject(Error('TEST_SERVER_START_TIMEOUT')),10000);
    server.on('error',e=>{clearTimeout(timer);reject(e);});
    server.stdout.on('data',chunk=>{output+=chunk;const match=/127\.0\.0\.1:(\d+)\//.exec(output);if(match){clearTimeout(timer);resolve(Number(match[1]));}});
    server.on('exit',()=>{clearTimeout(timer);reject(Error('TEST_SERVER_EARLY_EXIT'));});
  });
  const get=(path,host)=>new Promise((resolve,reject)=>{
    const req=http.get({hostname:'127.0.0.1',port,path,headers:{Host:host}},res=>{
      const chunks=[];res.on('data',c=>chunks.push(c));res.on('end',()=>resolve({status:res.statusCode,body:Buffer.concat(chunks)}));
    });req.on('error',reject);
  });
  const local=await get('/'+manifest.image.src,`127.0.0.1:${port}`);
  assert.equal(local.status,200);assert.equal(local.body.toString('hex',0,8),'89504e470d0a1a0a');
  const foreign=await get('/'+manifest.image.src,'example.test');assert.equal(foreign.status,403);
  const wave=await get('/'+audio.sounds[0].src,`127.0.0.1:${port}`);assert.equal(wave.status,200);assert.equal(wave.body.toString('ascii',0,4),'RIFF');
  assert.equal((await get('/'+audio.sounds[0].src,'example.test')).status,403);
  assert.equal((await get('/championship.html','example.test')).status,200,'guard is scoped to the new private effect bundle');
});

import test from'node:test';import assert from'node:assert/strict';import fs from'node:fs';import{createHash}from'node:crypto';
import{DATA_ARENA_MAP,DATA_ARENA_DUEL_MAP}from'../src/championship/modes/dataArena/dataArenaConfig.js';
import{dataArenaPropSpecs}from'../src/championship/modes/dataArena/dataArenaProps.js';
import{loadDataArenaEnvironment}from'../src/championship/presentation/dataArena/dataArenaEnvironment.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const harbor=read('assets/production/data-arena/harbor-blender-r6/manifest.json'),tournament=read('assets/production/data-arena/tournament-detail-r3/manifest.json');
test('test release pins both complete scene manifests to their unchanged executable layouts',()=>{
 assert.equal(harbor.id,'data-arena:harbor:blender:r6');assert.equal(tournament.id,'data-arena:tournament:detail:r3');assert.deepEqual(JSON.parse(harbor.layoutSignature),DATA_ARENA_MAP);assert.deepEqual(JSON.parse(tournament.layoutSignature),DATA_ARENA_DUEL_MAP);
 for(const m of[harbor,tournament]){assert.equal(m.humanApproved,false);assert.equal(m.shippingReady,false);assert.equal(m.externalAssets?.length??0,0);assert.equal(m.weights?.length??0,0);}
 for(const[m,map]of[[harbor,DATA_ARENA_MAP],[tournament,DATA_ARENA_DUEL_MAP]])assert.deepEqual(m.dynamicProps.map(p=>p.id).sort(),dataArenaPropSpecs(map).map(p=>p.id).sort());
 assert.equal(harbor.shoreDecor,undefined);assert.equal(harbor.peripheralRevision,undefined);assert.equal(tournament.peripheralRevision,undefined);
});
test('every selected map texture matches its preserved source bytes and budgets',()=>{
 for(const m of[harbor,tournament,read('assets/production/data-arena/interactions-v1/manifest.json')])for(const f of m.files){const p=f.src??f.path,b=fs.readFileSync(p);assert.equal(createHash('sha256').update(b).digest('hex').toLowerCase(),f.sha256.toLowerCase(),p);}
 assert.ok(harbor.decodedBytes.high<80*1024**2&&harbor.decodedBytes.low<18*1024**2);assert.ok(tournament.decodedBytes.high<32*1024**2&&tournament.decodedBytes.low<8*1024**2);
});
for(const[mode,map,m]of[['HARBOR',DATA_ARENA_MAP,harbor],['TOURNAMENT',DATA_ARENA_DUEL_MAP,tournament]])for(const tier of['high','low'])test(mode+' '+tier+' selects its default art without a review query and releases only its own resources',async()=>{
 const held=new Set(),seen=[];let active=0,peak=0;const PIXI={Assets:{async load(v){const p=typeof v==='string'?v:v.src;held.add(p);seen.push(p);if(p.endsWith('manifest.json'))return m;active++;peak=Math.max(peak,active);await new Promise(r=>setTimeout(r,1));active--;return{};},async unload(p){held.delete(p);}}};
 const env=await loadDataArenaEnvironment({PIXI,map,quality:tier,href:'https://example.invalid/championship-2026/championship.html'});assert.equal(env.manifest.id,m.id);assert.ok(peak<=4);assert.ok(seen.every(p=>p.endsWith('.json')||p.endsWith('-'+tier+'.webp')));assert.ok(seen.every(p=>!p.includes(mode==='HARBOR'?'tournament-':'harbor-')));await env.dispose();assert.equal(held.size,0);
});
test('an active harbor prop failing to decode releases successful partial loads',async()=>{
 const held=new Set(),fail=harbor.dynamicProps[0].states.INTACT.textures.high.src;const PIXI={Assets:{async load(v){const p=typeof v==='string'?v:v.src;if(p.endsWith('/'+fail))throw Error('test decode failure');held.add(p);return p.endsWith('manifest.json')?harbor:{};},async unload(p){held.delete(p);}}};
 await assert.rejects(loadDataArenaEnvironment({PIXI,map:DATA_ARENA_MAP,quality:'high',href:'https://example.invalid/championship.html'}),/test decode failure/);assert.equal(held.size,0);
});

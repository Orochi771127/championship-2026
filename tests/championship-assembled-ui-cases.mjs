import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import manifest from '../assets/production/internal-faithful-baseline/assembled-ui-v1/manifest.json' with {type:'json'};
import index from '../assets/production/ART_PRODUCTION_INDEX.json' with {type:'json'};
import shop from '../src/data/championship/catalogs/shop.r1.json' with {type:'json'};
import {assembledShopArt, assembledCageArt, assembledHudArt, assembledAnimationArt, evolutionArtClock,
  validateAssembledUiArt, loadAssembledEvolutionArt} from '../src/championship/presentation/assembledUiArt.js';
import {listChampionshipGates} from '../src/championship/gate/gateCatalog.js';
import {shopGoodsPresentation} from '../src/championship/presentation/shopGoodsUiArt.js';
import {cageEditorArtCells} from '../src/championship/presentation/cageUiArt.js';
import {createCageEditRuntime} from '../src/championship/cage/cageEditRuntime.js';
import {listCageDefinitions} from '../src/championship/cage/cageCatalog.js';
const local='http://127.0.0.1:8732/championship.html';

test('all Shop images join native identities; cage order is not Shop order',()=>{
  for(const r of shop.records.filter(r=>r.category!=='TRAINING_GOODS')) {
    const c=assembledShopArt(r.shopRecordIndex,local);
    assert.equal(c.category,r.category); assert.equal(c.itemIndex,r.itemIndex);
    assert.equal(c.subcategory,r.subcategory);
    if(r.category==='CAGES') assert.equal(c.sourceCell,r.itemIndex);
    else assert.equal(shopGoodsPresentation(r.shopRecordIndex,local).src,c.src);
  }
  assert.equal(assembledShopArt(112,local).sourceCell,15);
  assert.equal(assembledShopArt(16,local).sourceCell,12);
  assert.equal(assembledShopArt(50,local).sourceCell,46);
  assert.equal(assembledShopArt(82,local).sourceCell,29);
  assert.equal(assembledShopArt(0,local),null);
});
test('complete cells retain PNG dimensions and exact selected source bytes',()=>{
  for(const c of manifest.cells) {
    const png=fs.readFileSync(c.src);
    assert.equal(createHash('sha256').update(png).digest('hex'),c.sha256);
    assert.equal(png.readUInt32BE(16),c.width); assert.equal(png.readUInt32BE(20),c.height);
  }
  assert.equal(assembledCageArt(5,local).width,96); // NCER includes 8px unused padding
});
test('new source cells stay in local review; invalid registration and paths fail closed',()=>{
  for(const url of ['https://orochi771127.github.io/championship-2026/','https://example.com/','file:///tmp/test',undefined])
    assert.equal(assembledShopArt(4,url),null);
  for(const alter of [m=>m.localOnly=false,m=>m.cells[0].src+='?x',m=>m.cells[0].origin=[NaN,0],m=>m.goods.pop()]) {
    const m=structuredClone(manifest);alter(m);assert.throws(()=>validateAssembledUiArt(m,index),/ASSEMBLED_UI/);
  }
});
test('dedicated editor thumbnails retain one shared origin across multi-slot cages',()=>{
  const editor=createCageEditRuntime({initializeOriginal:true});
  const f=editor.getFrame(listCageDefinitions().filter(d=>[0,1,15].includes(d.cageDefinitionIndex)).map(d=>d.shopRecordIndex),0);
  const before=JSON.stringify(f.slots),cells=cageEditorArtCells(f.slots,local);
  for(const d of listCageDefinitions()) {
    const peers=f.slots.filter(s=>s.moduleId===d.moduleId).map(s=>cells[s.slotIndex]);
    if(!peers.length) continue;
    const image=assembledCageArt(d.cageDefinitionIndex,local);
    for(const p of peers) {
      assert.ok(Math.abs(p.imageWidth/p.imageHeight-image.width/image.height)<1e-9);
      assert.ok(Math.abs((p.x+p.imageX)-(peers[0].x+peers[0].imageX))<1e-9);
      assert.ok(Math.abs((p.y+p.imageY)-(peers[0].y+peers[0].imageY))<1e-9);
    }
  }
  assert.equal(JSON.stringify(f.slots),before);
});

test('gate icons use ROM table identity, independently of world-node ordering',()=>{
  const gates=listChampionshipGates();
  const grass=gates.find(g=>g.biomeId==='Grass');
  assert.equal(grass.ordinal,7);assert.equal(grass.romRecordIndex,0);
  for(const gate of gates) assert.equal(assembledHudArt(`gate-${gate.romRecordIndex}`,local).sourceCell,gate.romRecordIndex);
});
test('evolution draws advance native sequences only in the original draw phases',()=>{
  assert.equal(evolutionArtClock({target:8,phase:2,elapsed:9}).burstTicks,null);
  assert.equal(evolutionArtClock({target:8,phase:3,elapsed:0}).greenTicks,1);
  assert.equal(evolutionArtClock({target:8,phase:4,elapsed:0}).greenTicks,null);
  assert.equal(evolutionArtClock({target:8,phase:5,elapsed:0}).burstTicks,1);
  assert.equal(evolutionArtClock({target:8,phase:6,elapsed:0}).burstTicks,9);
  assert.equal(evolutionArtClock({target:8,phase:7,elapsed:0}).burstTicks,69);
  assert.equal(evolutionArtClock({target:8,phase:7,elapsed:0}).ring,false);
  assert.equal(evolutionArtClock({target:8,phase:2,elapsed:0,totalFrames:35}).ringAlpha,0);
  assert.equal(evolutionArtClock({target:8,phase:5,elapsed:7}).burstAlpha,0);
  assert.equal(evolutionArtClock({target:8,phase:6,elapsed:4}).burstAlpha,1);
  assert.equal(evolutionArtClock({target:8,phase:7,elapsed:26}).burstAlpha,0);
  assert.equal(assembledAnimationArt('evolution-green',2,local).sourceCell,115);
  assert.equal(assembledAnimationArt('evolution-green',3,local).sourceCell,116);
  assert.equal(assembledAnimationArt('evolution-burst',6,local).sourceCell,0);
  assert.equal(assembledAnimationArt('evolution-burst',7,local).sourceCell,1);
});
test('failed optional evolution image load unloads all settled successes',async()=>{
  const selected=manifest.cells.filter(c=>c.sourceFamily==='common/e001_evolution_all'||c.sourceFamily==='common/e001_ikusei');
  const unloaded=[];
  const PIXI={Assets:{load:async src=>{const c=selected.find(c=>c.src===src);if(c===selected[2])throw Error('NETWORK');
    return {width:c.width,height:c.height,source:{}};},unload:async src=>unloaded.push(src)}};
  await assert.rejects(loadAssembledEvolutionArt(PIXI,local),/NETWORK/);
  assert.equal(unloaded.length,selected.length-1);
  assert.equal(new Set(unloaded).size,unloaded.length);
});

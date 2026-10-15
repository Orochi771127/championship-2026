import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createHash} from 'node:crypto';
import {projectDatabaseEvolutionRoutes} from '../src/championship/database/databaseEvolutionRoutes.js';
import {projectDatabase} from '../src/championship/database/databaseRuntime.js';
import {getDatabaseDisplayEntry} from '../src/championship/database/databaseDisplayCatalog.js';
import {acceptedDatabasePortraitConfig,validateAcceptedDatabasePortrait,loadAcceptedDatabasePortrait} from '../src/championship/presentation/acceptedDatabasePortraits.js';
import {databaseHeroPortrait} from '../src/championship/presentation/databaseHeroPortraits.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
const lifecycle=read('src/data/championship/catalogs/raising-lifecycle.r1.json'),registeredSpecies=Array.from({length:216},(_,i)=>i+8);

test('all 477 native candidate identities retain exact source/branch history offsets and live display identities',()=>{
  const before=JSON.stringify(lifecycle);let count=0;
  assert.equal(lifecycle.rules.length,179);assert.equal(lifecycle.rules.filter(r=>r.length).length,178);
  for(let source=8;source<=186;source++){
    const rules=lifecycle.rules[source-8],flags=rules.map((_,i)=>(source-8)*5+i);
    const routes=projectDatabaseEvolutionRoutes(source,{sourceRegistered:true,registeredSpecies,evolutionBranches:flags}).filter(route=>!route.productRouteId);
    assert.equal(routes.length,rules.length);assert.ok(routes.length<=5);
    routes.forEach((route,index)=>{
      count++;assert.equal(route.sourceSpeciesIndex,source);assert.equal(route.branchIndex,index);assert.equal(route.targetSpeciesIndex,rules[index].target);
      assert.equal(route.legacyBranchOffset,(source-8)*5+index);assert.equal(route.historyState,'RECORDED');assert.equal(route.revealed,true);assert.ok(getDatabaseDisplayEntry(route.targetSpeciesIndex));
    });
  }
  assert.equal(count,477);assert.equal(JSON.stringify(lifecycle),before);
});

test('registration never fills a branch; empty history or [5] cannot reveal source8 to20 offset0',()=>{
  for(const flags of [[],[5]]){
    const routes=projectDatabaseEvolutionRoutes(8,{sourceRegistered:true,registeredSpecies:[8,20],evolutionBranches:flags});
    assert.equal(routes[0].targetSpeciesIndex,20);assert.equal(routes[0].legacyBranchOffset,0);assert.equal(routes[0].targetRegistered,true);
    assert.equal(routes[0].historyState,'NOT_RECORDED');assert.equal(routes[0].revealed,false);
  }
  const routes=projectDatabaseEvolutionRoutes(8,{sourceRegistered:true,registeredSpecies:[8],evolutionBranches:[0]});
  assert.equal(routes[0].historyState,'RECORDED');assert.equal(routes[0].targetRegistered,false);assert.equal(routes[0].revealed,false);
});

test('same target from different sources has independent histories; malformed flags stay conservative and unchanged',()=>{
  const edges=lifecycle.rules.flatMap((rules,i)=>rules.map((r,j)=>({source:i+8,target:r.target,offset:i*5+j})));
  const pair=edges.find(a=>edges.some(b=>a.source!==b.source&&a.target===b.target)),other=edges.find(b=>pair.source!==b.source&&pair.target===b.target);
  const first=projectDatabaseEvolutionRoutes(pair.source,{sourceRegistered:true,registeredSpecies,evolutionBranches:[pair.offset]}).find(r=>r.targetSpeciesIndex===pair.target);
  const second=projectDatabaseEvolutionRoutes(other.source,{sourceRegistered:true,registeredSpecies,evolutionBranches:[pair.offset]}).find(r=>r.targetSpeciesIndex===other.target);
  assert.equal(first.historyState,'RECORDED');assert.equal(second.historyState,'NOT_RECORDED');assert.equal(second.revealed,false);
  for(const flags of [null,['0'],[0.5,-1,9999],[0,760]]){
    const before=JSON.stringify(flags),routes=projectDatabaseEvolutionRoutes(8,{sourceRegistered:true,registeredSpecies,evolutionBranches:flags});
    assert.equal(routes[1].historyState,'UNKNOWN');assert.equal(routes[1].revealed,false);assert.equal(JSON.stringify(flags),before);
  }
});

test('unknown source, eggs, empty group and final stages expose no invented branches',()=>{
  assert.deepEqual(projectDatabaseEvolutionRoutes(8,{registeredSpecies,evolutionBranches:[0]}),[]);
  for(const index of [0,7,160,187,211,222,228,229,230])assert.deepEqual(projectDatabaseEvolutionRoutes(index,{sourceRegistered:true,registeredSpecies,evolutionBranches:[0]}),[]);
  const book=projectDatabase({registeredSpecies:[8,20],selectedSpeciesIndex:8});
  assert.equal(book.selected.instanceCount,0);assert.equal(book.selected.state,'REGISTERED');assert.equal(book.selected.evolutionRoutes[0].historyState,'NOT_RECORDED');
  assert.equal(book.slotCount,218);
});

test('all 214 available ordinary portraits are accepted originals with selected byte hashes; aliases preserve96/97 and gaps stay null',()=>{
  let available=0;
  for(let i=8;i<224;i++){
    const config=acceptedDatabasePortraitConfig(i);if(!config){assert.ok([211,222].includes(i));continue;}
    const manifest=read(`assets/production/characters/accepted-20261010/${config.folder}/hud-r01/manifest.json`);
    const portrait=validateAcceptedDatabasePortrait(manifest,config);assert.ok(portrait.src.startsWith('assets/production/characters/accepted-20261010/'));
    assert.equal(createHash('sha256').update(fs.readFileSync(portrait.src)).digest('hex'),portrait.sha256);available++;
  }
  assert.equal(available,214);assert.equal(acceptedDatabasePortraitConfig(96).speciesId,'species-226');assert.equal(acceptedDatabasePortraitConfig(97).speciesId,'species-227');
  assert.equal(acceptedDatabasePortraitConfig(211),null);assert.equal(acceptedDatabasePortraitConfig(222),null);
});

test('research, foreign paths, identities or provenance cannot become a Database portrait',async()=>{
  const config=acceptedDatabasePortraitConfig(8),manifest=read(`assets/production/characters/accepted-20261010/${config.folder}/hud-r01/manifest.json`);
  for(const mutate of [m=>{m.portrait.src='assets/production/internal-faithful-baseline/x.png';},m=>{m.localPackagingProvenance.publicationStatus='RESEARCH_ONLY';},m=>{m.portrait.speciesId='species-211';}]){const m=structuredClone(manifest);mutate(m);assert.throws(()=>validateAcceptedDatabasePortrait(m,config),/DATABASE_ACCEPTED_PORTRAIT_REQUIRED/);}
  let calls=0;
  for(const id of [211,222,229,230]){
    const options={fetchImpl:()=>{calls++;throw Error('STATIC_PREVIEW_MUST_NOT_FETCH_MANIFEST');},baseUrl:'https://qa.test/'};
    const preview=await loadAcceptedDatabasePortrait(id,options),hero=databaseHeroPortrait(id);
    assert.equal(preview.speciesIndex,id);assert.equal(preview.speciesId,`species-${id}`);
    assert.equal(preview.src,new URL(hero.src,options.baseUrl).href);assert.equal(preview.sha256,hero.sha256);
    assert.equal(preview.derivation,'SELECTED_PUBLIC_DATABASE_ILLUSTRATION_PREVIEW');
    assert.equal(await loadAcceptedDatabasePortrait(id,{...options,revealed:false}),null);
  }
  assert.equal(calls,0);
});


test('production appends exactly three product routes without borrowing the 477 native history offsets',()=>{
  const registered=[...registeredSpecies,229,230],snapshot=JSON.stringify(lifecycle),extras=[];let nativeCount=0;
  for(let source=8;source<=186;source++){
    const flags=(lifecycle.rules[source-8]??[]).map((_,i)=>(source-8)*5+i);
    const routes=projectDatabaseEvolutionRoutes(source,{sourceRegistered:true,registeredSpecies:registered,evolutionBranches:flags});
    nativeCount+=routes.filter(r=>!r.productRouteId).length;
    for(const route of routes.filter(r=>r.productRouteId)){
      extras.push([source,route.targetSpeciesIndex,route.productRouteId]);
      assert.equal(route.legacyBranchOffset,null);assert.equal(route.historyState,'NOT_RECORDED');assert.equal(route.revealed,false);
      assert.equal(route.targetRegistered,true);assert.equal(route.targetSpeciesId,`species-${route.targetSpeciesIndex}`);
      assert.equal(routes.find(r=>!r.productRouteId&&r.branchIndex===route.branchIndex).historyState,'RECORDED');
    }
  }
  assert.equal(nativeCount,477);assert.deepEqual(extras,[[139,229,'139:211:229'],[143,229,'143:211:229'],[144,230,'144:222:230']]);
  for(const [source,target,productRouteId] of extras){
    const options={sourceRegistered:true,registeredSpecies:registered,evolutionBranches:[],productEvolutionBranches:[productRouteId]},before=JSON.stringify(options);
    const routes=projectDatabaseEvolutionRoutes(source,options),route=routes.find(r=>r.productRouteId===productRouteId);
    assert.equal(route.targetSpeciesIndex,target);assert.equal(route.historyState,'RECORDED');assert.equal(route.revealed,true);
    assert.ok(routes.filter(r=>!r.productRouteId).every(r=>r.historyState==='NOT_RECORDED'&&!r.revealed));
    for(const [otherSource,,otherId] of extras.filter(e=>e[2]!==productRouteId)){
      const other=projectDatabaseEvolutionRoutes(otherSource,options).find(r=>r.productRouteId===otherId);
      assert.equal(other.historyState,'NOT_RECORDED');assert.equal(other.revealed,false);
    }
    assert.equal(JSON.stringify(options),before);
  }
  assert.equal(JSON.stringify(lifecycle),snapshot);
});

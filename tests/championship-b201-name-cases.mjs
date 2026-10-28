import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {speciesName,speciesNameForId,raisingDisplayName} from '../src/championship/text/zhHant.js';
import {SPECIES_NAMES_ZH,SPECIAL_SPECIES_NAMES_ZH} from '../src/championship/text/catalogs.zhHant.js';
import {LOCALES,setLocale} from '../src/championship/text/locale.js';
import {getDatabaseDisplayEntry} from '../src/championship/database/databaseDisplayCatalog.js';
import {projectDatabaseEvolutionRoutes} from '../src/championship/database/databaseEvolutionRoutes.js';

test('explicit display catalog maps B201 to species020 and B102 to species009',()=>{
  const catalog=JSON.parse(fs.readFileSync('src/data/championship/database-display.r1.json','utf8'));
  for(const [code,index,id,name] of [['B201',20,'species-020','天線豆'],['B102',9,'species-009','叮噹豆']]){
    const entry=catalog.entries.find(row=>row.displayCode===code);
    assert.equal(entry.speciesIndex,index);assert.equal(entry.speciesId,id);
    assert.equal(getDatabaseDisplayEntry(index).displayCode,code);assert.equal(speciesName(index),name);
    assert.equal(SPECIAL_SPECIES_NAMES_ZH[index],undefined);
  }
});

test('approved proper names propagate in all five locales without invented translations',()=>{
  try {for(const locale of LOCALES){setLocale(locale);
    assert.equal(speciesName(20),'天線豆');assert.equal(speciesNameForId('species-020'),'天線豆');
    assert.equal(speciesNameForId('championship:creature:species-020'),'天線豆');
    assert.equal(speciesName(9),'叮噹豆');
  }}finally{setLocale('zh-Hant');}
  assert.equal(Object.entries(SPECIES_NAMES_ZH).filter(([,name])=>name==='叮噹豆').length,1);
});

test('recorded evolution target keeps stable identity and resolves the new canonical name',()=>{
  const save={registeredSpecies:[8,9,20],evolutionBranches:[0],sourceRegistered:true};
  const before=JSON.stringify(save);
  const route=projectDatabaseEvolutionRoutes(8,save).find(row=>row.targetSpeciesIndex===20);
  assert.equal(route.targetSpeciesId,'species-020');assert.equal(route.revealed,true);
  assert.equal(getDatabaseDisplayEntry(route.targetSpeciesIndex).displayCode,'B201');
  assert.equal(speciesName(route.targetSpeciesIndex),'天線豆');assert.equal(JSON.stringify(save),before);
});

test('player names, including the old canonical spelling, are never rewritten',()=>{
  for(const displayName of ['叮噹豆','我的鋼鈴','B201','天線豆']){
    const instance={speciesId:'species-020',displayName,source:{kind:'CAPTURE'}};
    const before=JSON.stringify(instance);assert.equal(raisingDisplayName(instance),displayName);
    assert.equal(JSON.stringify(instance),before);
  }
  assert.equal(raisingDisplayName({speciesId:'species-020'}),'天線豆');
  assert.equal(raisingDisplayName({speciesId:'species-009'}),'叮噹豆');
});

test('Dex list/details, evolution preview and raising confirmation use canonical identity lookup',()=>{
  const dex=fs.readFileSync('src/championship/app/vs4Screens.js','utf8');
  assert.match(dex,/speciesName\(row\.speciesIndex, row\.displayName\)/);
  assert.match(dex,/speciesName\(selected\.speciesIndex, selected\.displayName\)/);
  assert.match(dex,/speciesName\(route\.targetSpeciesIndex\)/);
  const raising=fs.readFileSync('src/championship/app/raisingHomeP1RView.js','utf8');
  assert.match(raising,/speciesName\(pendingEvolution\.target\)/);
});

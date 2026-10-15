import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {makeView} from './helpers/dex-conditions-ui-fixture.mjs';
import {projectDatabase} from '../src/championship/database/databaseRuntime.js';
import {setLocale} from '../src/championship/text/locale.js';
const css=readFileSync(new URL('../src/championship/app/vs2Styles.css',import.meta.url),'utf8');
const scope='.cm-vs2-root[data-screen="DATABASE"] ';
function rule(s){const at=css.lastIndexOf(scope+s+' {');assert.ok(at>=0);return css.slice(at,css.indexOf('}',at)+1);}
test('database route overflow is local and card width cannot collapse to a single glyph',()=>{
 assert.match(rule('.cm-dex-routes'),/grid-column:\s*1\s*\/\s*-1/);
 assert.match(rule('.cm-dex-routes'),/max-width:\s*100%/);
 assert.match(rule('.cm-dex-routes'),/overflow-x:\s*auto/);
 assert.match(rule('.cm-dex-routes'),/overscroll-behavior-x:\s*contain/);
 assert.match(rule('.cm-dex-routes__graph'),/min-width:\s*calc\(96px \+ 20px \+ 16rem\)/);
 for(const selector of ['.cm-dex-routes__targets','.cm-dex-routes__target'])assert.match(rule(selector),/min-width:\s*16rem/);
 assert.match(rule('.cm-dex-routes__target'),/box-sizing:\s*border-box/);
 // Explicit source-level width budget, not a browser-layout assertion:
 // 16rem card - 64px portrait - 8px gap - 16px padding - 2px border.
 for(const scale of [1,1.15,1.3]){
  const textWidth=16*16-64-8-16-2;
  assert.ok(textWidth/(12*scale)>=10, `130% label retains at least 10 full-width glyphs`);
  assert.ok(textWidth/(11*scale)>=10, `130% status retains at least 10 full-width glyphs`);
 }
 assert.doesNotMatch(rule('.cm-dex-routes'),/touch-action:\s*(?:none|pan-x)\s*;/);
 assert.doesNotMatch(rule('.cm-dex-routes'),/overscroll-behavior-y:\s*(?:contain|none)/);
});
test('B202 and representative neighbours retain matching revealed or masked route cards in five locales',()=>{
 try {for(const species of [20,21,34])for(const locale of ['zh-Hant','en','ja','th','vi'])for(const revealed of [false,true]){
  const registeredSpecies=revealed?Array.from({length:216},(_,i)=>i+8):[species];
  const evolutionBranches=revealed?Array.from({length:1080},(_,i)=>i):[];
  const f=makeView({locale,selectedSpeciesIndex:species,registeredSpecies,evolutionBranches,collection:[]});
  try {const graph=f.root.querySelector('.cm-dex-routes__graph');assert.ok(graph);
   const routes=f.frame().database.selected.evolutionRoutes;
   const cards=f.root.querySelectorAll('.cm-dex-routes__target');assert.equal(cards.length,routes.length);
   cards.forEach((card,i)=>{assert.ok(card.querySelector('.cm-dex-portrait'));assert.ok(card.querySelector('.cm-dex-routes__copy'));assert.equal(card.dataset.branchOffset,String(routes[i].legacyBranchOffset));assert.equal(card.disabled,!routes[i].revealed);assert.equal(card.dataset.revealed,String(routes[i].revealed));if(!revealed)assert.equal(card.querySelector('.cm-dex-routes__name').textContent,'????');});
   f.assertUnchanged();
  }finally{f.dispose();}
 }}finally{setLocale('zh-Hant');}
});
test('all 216 registered entries preserve every candidate and condition control without state writes',()=>{
 try {for(let species=8;species<224;species++){
  const f=makeView({selectedSpeciesIndex:species,registeredSpecies:Array.from({length:216},(_,i)=>i+8),evolutionBranches:Array.from({length:1080},(_,i)=>i),collection:[]});
  try{const routes=f.frame().database.selected.evolutionRoutes;const cards=f.root.querySelectorAll('.cm-dex-routes__target');assert.equal(cards.length,routes.length);assert.equal(f.root.querySelectorAll('.cm-dex-routes__branch').length,routes.length);cards.forEach((card,i)=>assert.equal(card.dataset.branchOffset,String(routes[i].legacyBranchOffset)));for(const toggle of f.root.querySelectorAll('.cm-dex-conditions__toggle'))assert.equal(toggle.getAttribute('aria-expanded'),'false');f.assertUnchanged();}finally{f.dispose();}
 }}finally{setLocale('zh-Hant');}
});

test('starter-only status cannot create named implicit columns in the database detail grid',()=>{
 assert.match(rule('.cm-vs2-database__detail'),/grid-template-columns:\s*minmax\(0, 1fr\)/);
 assert.match(rule('.cm-vs2-database__detail > .cm-vs2-shop__status'),/grid-area:\s*auto/);
 // The shared Shop rule still exists: scope the correction to direct Database children.
 assert.match(css,/body:not\(\[data-portrait-frame\]\) \.cm-vs2-shop__status \{ grid-area: status;/);
 for(const starter of [null,'species-021']){
  const f=makeView({selectedSpeciesIndex:21,registeredSpecies:[21],collection:[],projection:input=>projectDatabase({...input,starterSpeciesId:starter})});
  try{assert.equal(f.frame().database.selected.source,starter?'STARTER':'HISTORY');assert.equal(f.root.querySelectorAll('.cm-vs2-database__detail .cm-vs2-shop__status').length,starter?1:0);assert.ok(f.root.querySelector('.cm-dex-routes'));f.assertUnchanged();}finally{f.dispose();}
 }
});

test('database detail retains intrinsic content row heights around horizontal route scrolling',()=>{
 const selector='.cm-vs2-root[data-screen="DATABASE"] .cm-vs2-database__detail';
 const rules=[...css.replace(/\/\*[\s\S]*?\*\//g,'').matchAll(/([^{}]+)\{([^{}]*)\}/g)].filter(([,head])=>head.trim().split(',').some(s=>s.trim()===selector));
 const declarations=rules.map(([,head,body])=>body).join('\n');
 const values=[...declarations.matchAll(/grid-auto-rows:\s*([^;]+);/g)].map(m=>m[1].trim());
 assert.equal(values.at(-1),'max-content');
 assert.doesNotMatch(declarations,/overflow-y:\s*hidden/);
 // Overflow-x:auto makes the route's computed overflow-y:auto too, so an
 // auto track can use a zero automatic minimum. Intrinsic max-content rows
 // preserve prose, metadata, and every route branch for the detail scroller.
});

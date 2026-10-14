// Test-only isolated catalog fixture. A Node loader replaces one JSON rule;
// the actual projectDatabase, native requirement helper, condition helper,
// complete screen body and uiText modules execute unchanged in that process.
// No synthetic row, operator or condition-model implementation is injected.
import {register} from 'node:module';
import {isMainThread} from 'node:worker_threads';
import {readFileSync} from 'node:fs';
let config;
export function initialize(data){config=data;}
export async function load(url,context,nextLoad){
  if(url===config.catalogUrl)return {format:'json',source:JSON.stringify(config.catalog),shortCircuit:true};
  return nextLoad(url,context);
}
if(isMainThread){
  const catalogUrl=new URL('../../src/data/championship/catalogs/raising-lifecycle.r1.json',import.meta.url).href;
  const catalog=JSON.parse(readFileSync(new URL(catalogUrl),'utf8'));
  const thresholds=Array(26).fill(20);thresholds[11]=37;thresholds[22]=2;thresholds[23]=70;thresholds[24]=1;thresholds[25]=3;
  catalog.rules[0][0]={target:20,kind:0,thresholds};
  register(import.meta.url,{data:{catalogUrl,catalog}});
  const {makeView}=await import('./dex-conditions-ui-fixture.mjs');
  const {nativeEvolutionRequirements}=await import('../../src/championship/raising/nativeRaisingLifecycle.js');
  const results=[];
  for(const locale of ['zh-Hant','en','ja','th','vi']){
    const fixture=makeView({locale});const toggle=fixture.root.querySelector('.cm-dex-conditions__toggle');toggle.click();
    const panel=fixture.document.getElementById(toggle.getAttribute('aria-controls'));
    const model=fixture.frame().database.selected.evolutionRoutes[0].conditions;
    results.push({locale,label:toggle.textContent,aria:toggle.getAttribute('aria-label'),
      rows:panel.querySelectorAll('.cm-dex-conditions__row').map(row=>({label:row.querySelector('dt').textContent,value:row.querySelector('dd').textContent})),
      notices:panel.querySelectorAll('.cm-dex-conditions__notice').map(node=>node.textContent),model});
    fixture.assertUnchanged();fixture.dispose();
  }
  process.stdout.write(JSON.stringify({results,thresholds,requirements:nativeEvolutionRequirements(catalog.rules[0][0])}));
}

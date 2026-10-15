import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// Execute the actual view module/choosePassword wiring. Only display-copy imports
// are stubbed because the partial export lacks their complete dependency graph.
// This minimal DOM verifies lifecycle logic, not rendered/native-browser behavior.
let source=readFileSync(new URL('../src/championship/app/vs5Screens.js',import.meta.url),'utf8');
source=source.replace('"./codeClipboard.js"',JSON.stringify(new URL('../src/championship/app/codeClipboard.js',import.meta.url).href));
source=source.replace("'../text/battleTransportText.js'",JSON.stringify(new URL('../src/championship/text/battleTransportText.js',import.meta.url).href));
source=source.replace(/^import .*from ["']\.\.\/text\/.*;$/gm,'');
source=`const uiText=(key,params={})=>Object.entries(params).reduce((s,[k,v])=>s.replace('{'+k+'}',v),key);
const titleEventText=(_a,_b,fallback)=>fallback,raisingDisplayName=e=>e.displayName,speciesName=id=>id,tutorialBattleText=()=>({});\n`+source;
const {createBattleSelectView}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
class Element extends EventTarget {
 constructor(tag){super();this.tagName=tag.toUpperCase();this.children=[];this.parent=null;this.dataset={};this.attrs={};this.value='';this.hidden=false;this.disabled=false;this.readOnly=false;this.className='';this.classList={add:(name)=>this.className+=' '+name};}
 get isConnected(){return this.connected===true||Boolean(this.parent?.isConnected);}
 append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
 replaceChildren(...nodes){for(const node of this.children)node.parent=null;this.children=[];this.append(...nodes);}
 setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k];}removeAttribute(k){delete this.attrs[k];}
 focus(){}select(){}
 click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}
}
const tick=()=>new Promise(r=>setImmediate(r));
function all(root){return [root,...root.children.flatMap(all)];}
async function setup({createPassword=async()=>({ok:true,password:'NEW-CODE'}),onEnter=async()=>({ok:false,message:'refused'})}={}){
 globalThis.document={createElement:tag=>new Element(tag)};
 let finish;Object.defineProperty(globalThis,'navigator',{value:{clipboard:{readText:()=>new Promise(r=>finish=r)}},configurable:true});
 const root=new Element('div');root.connected=true;let selectMode;
 const view=createBattleSelectView({root,matches:[],menuCopy:{menu:'menu',kicker:'kicker',chooseMatch:'choose',availableMatches:'matches',noMatch:'none'},onEnter,
  mountCube:options=>{selectMode=options.onSelect;return {dispose(){}};},
  getPasswordSelection:async()=>({maxLength:22,candidates:[{instanceId:'one',displayName:'one',admission:{ok:true}},{instanceId:'two',displayName:'two',admission:{ok:true}}],createPassword})});
 selectMode('PASSWORD_BATTLE');await tick();
 const find=predicate=>all(root).find(predicate);
 return {root,view,find,fields:all(root).filter(n=>n.tagName==='INPUT'&&!n.readOnly),pastes:all(root).filter(n=>n.dataset.action==='paste-password'),finish:value=>finish(value),pick:id=>find(n=>n.dataset.instanceId===id).click(),make:()=>find(n=>n.dataset.action==='create-password').click(),start:()=>find(n=>n.textContent==='開始密碼對戰').click()};
}
test('actual PASSWORD flow discards pending A/B paste after selected team changes with field unchanged',async()=>{
 for(const slot of [0,1]){const f=await setup();f.pastes[slot].click();f.pick('one');assert.equal(f.fields[slot].value,'');f.finish('LATE-CODE');await tick();assert.equal(f.fields[slot].value,'');f.view.dispose();}
});
test('actual PASSWORD flow discards pending paste across generation start even when generation fails',async()=>{
 const f=await setup({createPassword:async()=>({ok:false})});f.pick('one');f.pastes[1].click();f.make();await tick();f.finish('LATE-CODE');await tick();assert.equal(f.fields[1].value,'');f.view.dispose();
});
test('actual PASSWORD flow discards paste begun during generation when generation completes',async()=>{
 let generated;const f=await setup({createPassword:()=>new Promise(r=>generated=r)});f.pick('one');f.make();f.pastes[1].click();generated({ok:true,password:'TEAM-CODE'});await tick();f.finish('LATE-CODE');await tick();assert.equal(f.fields[0].value,'TEAM-CODE');assert.equal(f.fields[1].value,'');f.view.dispose();
});
test('actual PASSWORD flow discards pending paste after battle start returns without navigation',async()=>{
 const f=await setup();for(const field of f.fields){field.value='VALID-CODE';field.dispatchEvent(new Event('input'));}
 f.pastes[1].click();f.start();await tick();f.finish('LATE-CODE');await tick();assert.equal(f.fields[1].value,'VALID-CODE');f.view.dispose();
});
test('actual PASSWORD paste updates confirm validation and preserves manual input',async()=>{
 const f=await setup();f.pastes[0].click();f.finish('A-CODE');await tick();assert.equal(f.fields[0].value,'A-CODE');
 const start=f.find(n=>n.textContent==='開始密碼對戰');assert.equal(start.disabled,true);
 f.fields[1].value='MANUAL-B';f.fields[1].dispatchEvent(new Event('input'));assert.equal(start.disabled,false);f.view.dispose();
});

test('actual PASSWORD flow preserves newer pasted or manually edited A when pending generation finishes',async()=>{
 for(const method of ['paste','manual']){
  let generated;const f=await setup({createPassword:()=>new Promise(r=>generated=r)});f.pick('one');f.make();
  if(method==='paste'){f.pastes[0].click();f.finish('NEWER-A');await tick();}
  else{f.fields[0].value='NEWER-A';f.fields[0].dispatchEvent(new Event('input'));}
  generated({ok:true,password:'OLD-GENERATION'});await tick();assert.equal(f.fields[0].value,'NEWER-A');
  assert.equal(f.find(n=>n.tagName==='INPUT'&&n.readOnly).value,'');f.view.dispose();
 }
});

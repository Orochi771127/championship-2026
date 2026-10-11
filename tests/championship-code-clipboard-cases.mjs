import test from 'node:test';
import assert from 'node:assert/strict';
import {bindCodePaste} from '../src/championship/app/codeClipboard.js';
class Node extends EventTarget {
  value='';disabled=false;readOnly=false;isConnected=true;hidden=true;attrs={};focusCalls=0;
  setAttribute(k,v){this.attrs[k]=v;} removeAttribute(k){delete this.attrs[k];} focus(){this.focusCalls++;}
}
const tick=()=>new Promise(resolve=>setImmediate(resolve));
function setup(readText){
  Object.defineProperty(globalThis,'navigator',{value:{clipboard:readText?{readText}:undefined},configurable:true});
  const field=new Node(),button=new Node(),status=new Node();let valid=true,revision=0;
  bindCodePaste({field,button,status,text:key=>key,isCurrent:()=>valid,getRevision:()=>revision});
  return {field,button,status,click:()=>button.dispatchEvent(new Event('click')),edit:value=>{field.value=value;field.dispatchEvent(new Event('input'));},invalidate:()=>revision++,close:()=>valid=false};
}
test('mount/focus/input never reads; one click avoids application trimming and emits bubbling input',async()=>{
 let reads=0,inputs=0,bubbled=false;const f=setup(async()=>{reads++;return ' ABC-DEF ';});
 f.field.addEventListener('input',e=>{inputs++;bubbled=e.bubbles;});
 f.field.focus();assert.equal(reads,0);f.click();assert.equal(reads,1);await tick();
 assert.equal(f.field.value,' ABC-DEF ');assert.equal(inputs,1);assert.equal(bubbled,true);
 assert.equal(f.status.textContent,'CODE_PASTED');assert.equal(f.button.attrs['aria-busy'],undefined);
});
test('denied or unavailable clipboard retains value and gives manual paste fallback',async()=>{
 for(const read of [undefined,async()=>{throw new Error('NotAllowedError');}]){
  const f=setup(read);f.field.value='original';f.click();await tick();assert.equal(f.field.value,'original');
  assert.equal(f.field.focusCalls,1);assert.equal(f.status.textContent,'CODE_PASTE_MANUAL');
 }
});
test('empty clipboard never clears a code',async()=>{
 const f=setup(async()=>'');f.field.value='keep';f.click();await tick();assert.equal(f.field.value,'keep');assert.equal(f.status.textContent,'CODE_PASTE_EMPTY');
});
test('disabled and readonly controls never read',async()=>{
 for(const target of ['button','field']){let reads=0;const f=setup(async()=>{reads++;return 'x';});f[target].disabled=true;f.click();await tick();assert.equal(reads,0);}
 let reads=0;const f=setup(async()=>{reads++;return 'x';});f.field.readOnly=true;f.click();await tick();assert.equal(reads,0);
});
test('delayed paste cannot overwrite newer typing, programmatic code, role/team revision, or closed screen',async()=>{
 for(const change of [f=>f.edit('new'),f=>f.edit('old'),f=>{f.field.value='generated';},f=>f.invalidate(),f=>f.close(),f=>{f.field.isConnected=false;},f=>{f.field.disabled=true;}]){
  let resolve;const f=setup(()=>new Promise(r=>resolve=r));f.field.value='old';f.click();change(f);const expected=f.field.value;resolve('late');await tick();assert.equal(f.field.value,expected);assert.notEqual(f.status.textContent,'CODE_PASTED');
 }
});
test('repeat clicks while pending issue only one read; later explicit click can retry',async()=>{
 let reads=0,resolve;const f=setup(()=>{reads++;return new Promise(r=>resolve=r);});
 f.click();f.click();f.click();assert.equal(reads,1);resolve('one');await tick();f.click();assert.equal(reads,2);resolve('two');await tick();assert.equal(f.field.value,'two');
});
test('late denied permission does not steal focus after screen closes',async()=>{
 let reject;const f=setup(()=>new Promise((_,r)=>reject=r));f.click();f.close();reject(new Error('denied'));await tick();assert.equal(f.field.focusCalls,0);
});

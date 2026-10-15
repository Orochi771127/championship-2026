import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
// Actual UI module, minimal DOM lifecycle tests. Display-copy functions alone
// are substituted; this does not claim pixel/browser rendering acceptance.
let source=readFileSync(new URL('../src/championship/app/vs5Screens.js',import.meta.url),'utf8');
source=source.replace('"./codeClipboard.js"',JSON.stringify(new URL('../src/championship/app/codeClipboard.js',import.meta.url).href));
source=source.replace("'../text/battleTransportText.js'",JSON.stringify(new URL('../src/championship/text/battleTransportText.js',import.meta.url).href));
source=source.replace(/^import .*from ["']\.\.\/text\/.*;$/gm,'');
source=`const uiText=(key,params={})=>Object.entries(params).reduce((s,[k,v])=>s.replace('{'+k+'}',v),key);
const titleEventText=(_a,_b,fallback)=>fallback,raisingDisplayName=e=>e.displayName,speciesName=id=>id,tutorialBattleText=()=>({});\n`+source;
const {createBattleSelectView,battleTransportErrorMessage}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
class Element extends EventTarget {
 constructor(tag){super();this.tagName=tag.toUpperCase();this.children=[];this.parent=null;this.dataset={};this.attrs={};this.value='';this.hidden=false;this.disabled=false;this.readOnly=false;this.className='';this.classList={add:name=>this.className+=' '+name};}
 get isConnected(){return this.connected===true||Boolean(this.parent?.isConnected);}
 append(...nodes){for(const node of nodes){node.parent=this;this.children.push(node);}}
 replaceChildren(...nodes){for(const node of this.children)node.parent=null;this.children=[];this.append(...nodes);}
 setAttribute(k,v){this.attrs[k]=v;}getAttribute(k){return this.attrs[k];}removeAttribute(k){delete this.attrs[k];}
 focus(){}select(){}click(){if(!this.disabled)this.dispatchEvent(new Event('click'));}
}
const tick=()=>new Promise(r=>setImmediate(r));
const all=root=>[root,...root.children.flatMap(all)];
const v2password='CM26-PASSWORD-2.12345678.'+'A'.repeat(1800),v2link='CM26-LINK-2.12345678.'+'A'.repeat(1800);
async function setup(mode,{createInvite=async()=>({ok:true,inviteCode:v2link,arenaIndex:0}),onEnter=async()=>({ok:false,message:'refused'})}={}){
 globalThis.document={createElement:tag=>new Element(tag)};let paste;
 Object.defineProperty(globalThis,'navigator',{value:{clipboard:{readText:async()=>paste}},configurable:true});
 const root=new Element('div');root.connected=true;let selectMode;
 const candidates=[{instanceId:'one',displayName:'one',admission:{ok:true}}];
 const view=createBattleSelectView({root,matches:[],menuCopy:{menu:'menu',kicker:'kicker',chooseMatch:'choose',availableMatches:'matches',noMatch:'none'},onEnter,
  mountCube:options=>{selectMode=options.onSelect;return {dispose(){}};},
  getPasswordSelection:async()=>({maxLength:50000,candidates,createPassword:async()=>({ok:true,password:v2password})}),
  getLinkSelection:async()=>({maxLength:50000,candidates,createInvite,prepareGuest:async()=>({ok:false}),prepareHost:async()=>({ok:false})})});
 selectMode(mode);await tick();
 return {root,view,find:predicate=>all(root).find(predicate),all:()=>all(root),paste:value=>paste=value};
}
test('main forwards bounded long-code input and explicit v2 host selection in the existing modes',()=>{
 const main=readFileSync(new URL('../src/championship/app/main.js',import.meta.url),'utf8');
 assert.match(main,/getPasswordSelection:async\(\)=>\(\{maxLength:PRODUCT_BATTLE_CODE_MAX_LENGTH/);
 assert.match(main,/createInvite:\(instanceIds,options\)=>app.createLinkBattleInvite\(instanceIds,options\)/);
});
test('password UI permits full v2 paste/generation and labels new-build requirement without truncation',async()=>{
 const f=await setup('PASSWORD_BATTLE');
 try{
  const fields=f.all().filter(n=>n.tagName==='INPUT'&&!n.readOnly);assert.equal(fields.length,2);
  for(const input of fields)assert.ok(input.maxLength>=v2password.length);
  f.paste(v2password);f.find(n=>n.dataset.action==='paste-password').click();await tick();
  assert.equal(fields[0].value,v2password);assert.equal(f.find(n=>n.dataset.codeVersionNotice==='password').hidden,false);
  assert.match(f.find(n=>n.dataset.codeVersionNotice==='password').textContent,/舊版無法使用/);
  f.find(n=>n.dataset.instanceId==='one').click();f.find(n=>n.dataset.action==='create-password').click();await tick();
  assert.equal(f.find(n=>n.tagName==='INPUT'&&n.readOnly).value,v2password);assert.equal(fields[0].value,v2password);
  fields[0].value='OLD';fields[0].dispatchEvent(new Event('input'));assert.equal(f.find(n=>n.dataset.codeVersionNotice==='password').hidden,true);
 }finally{f.view.dispose();}
});
test('link host can explicitly choose v2 for a native team; changing the choice invalidates the prior invite',async()=>{
 const calls=[],f=await setup('LINK_BATTLE',{createInvite:async(ids,options)=>{calls.push({ids,options});return {ok:true,inviteCode:v2link,arenaIndex:0};}});
 try{
  const option=f.find(n=>n.dataset.action==='link-version-2');assert.ok(option);assert.equal(option.checked,false);
  f.find(n=>n.dataset.instanceId==='one').click();option.checked=true;option.dispatchEvent(new Event('change'));
  f.find(n=>n.dataset.action==='create-code').click();await tick();
  assert.deepEqual(calls,[{ids:['one'],options:{transportVersion:2}}]);
  const invitation=f.all().find(n=>n.tagName==='TEXTAREA'&&n.readOnly);assert.equal(invitation.value,v2link);
  assert.ok(invitation.maxLength>=v2link.length);assert.equal(f.find(n=>n.dataset.codeVersionNotice==='link').hidden,false);
  option.checked=false;option.dispatchEvent(new Event('change'));assert.equal(invitation.value,'');
  assert.equal(f.find(n=>n.dataset.codeVersionNotice==='link').hidden,true);
  f.find(n=>n.dataset.action==='create-code').click();await tick();assert.deepEqual(calls[1].options,{});
 }finally{f.view.dispose();}
});
test('unsupported version, catalog and readiness reasons receive specific user-facing explanations',async()=>{
 for(const [reason,needle] of [['PRODUCT_BATTLE_TRANSPORT_CATALOG_MISMATCH',/角色目錄版本不一致/],['PRODUCT_BATTLE_TRANSPORT_SPECIES_NOT_READY',/尚未完成/],['LINK_BATTLE_V2_INVITE_REQUIRED',/主機勾選第 2 版/]]){
  assert.match(battleTransportErrorMessage(reason,'generic'),needle);
 }
 const f=await setup('PASSWORD_BATTLE',{onEnter:async()=>({ok:false,reason:'PRODUCT_BATTLE_TRANSPORT_CATALOG_MISMATCH',message:'generic'})});
 try{
  for(const input of f.all().filter(n=>n.tagName==='INPUT'&&!n.readOnly)){input.value=v2password;input.dispatchEvent(new Event('input'));}
  f.find(n=>n.textContent==='開始密碼對戰').click();await tick();
  assert.match(f.find(n=>n.dataset.reason==='PRODUCT_BATTLE_TRANSPORT_CATALOG_MISMATCH').textContent,/角色目錄版本不一致/);
 }finally{f.view.dispose();}
});

test('password and link screens render all new notices, labels and errors in each current locale',async()=>{
 const {LOCALES,setLocale,getLocale}=await import('../src/championship/text/locale.js');
 const {BATTLE_TRANSPORT_COPY}=await import('../src/championship/text/battleTransportText.js');
 const previous=getLocale();
 try{for(const locale of LOCALES){
  setLocale(locale);const copy=BATTLE_TRANSPORT_COPY[locale];
  const p=await setup('PASSWORD_BATTLE');
  try{
   assert.ok(p.find(n=>n.textContent===copy.PASSWORD_INPUT_HINT),locale);
   const input=p.find(n=>n.tagName==='INPUT'&&!n.readOnly);input.value=v2password;input.dispatchEvent(new Event('input'));
   assert.equal(p.find(n=>n.dataset.codeVersionNotice==='password').textContent,copy.PASSWORD_V2_NOTICE);
  }finally{p.view.dispose();}
  const l=await setup('LINK_BATTLE');
  try{
   assert.ok(l.find(n=>n.textContent===copy.LINK_VERSION_HINT),locale);
   assert.equal(l.find(n=>n.dataset.action==='link-version-2').getAttribute('aria-label'),copy.CREATE_V2_INVITE);
   assert.ok(l.find(n=>n.textContent===copy.CREATE_V2_INVITE_LABEL),locale);
   l.find(n=>n.dataset.instanceId==='one').click();l.find(n=>n.dataset.action==='create-code').click();await tick();
   assert.equal(l.find(n=>n.dataset.codeVersionNotice==='link').textContent,copy.LINK_V2_NOTICE);
  }finally{l.view.dispose();}
  for(const [reason,key] of [
   ['PRODUCT_SPECIES_NOT_READY','SPECIES_NOT_READY'],['PRODUCT_BATTLE_TRANSPORT_CATALOG_MISMATCH','CATALOG_MISMATCH'],
   ['LINK_BATTLE_V2_INVITE_REQUIRED','V2_INVITE_REQUIRED'],['PASSWORD_BATTLE_V2_REQUIRED','V2_REQUIRED'],
   ['LINK_BATTLE_VERSION_MISMATCH','VERSION_MISMATCH'],['PRODUCT_BATTLE_TRANSPORT_UNSUPPORTED_VERSION','VERSION_MISMATCH'],
   ['PRODUCT_BATTLE_TRANSPORT_INVALID_TEAM_FIELD','VALUES_UNSUPPORTED'],['PRODUCT_BATTLE_TRANSPORT_CODE_CHECKSUM','INVALID_CODE']
  ])assert.equal(battleTransportErrorMessage(reason,'fallback'),copy[key],`${locale}:${reason}`);
 }}finally{setLocale(previous);}
});

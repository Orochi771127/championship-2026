import test from 'node:test';
import assert from 'node:assert/strict';
import {createTitleImageLifecycle} from '../src/championship/presentation/titleImageLifecycle.js';
const flush=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
test('deferred TITLE pixels remain unrequested during the film and restore immediately on skip',()=>{
 const src='assets/production/title-morning-r1/cloud.webp',attrs=new Map();
 const image={dataset:{titleSrc:src},complete:true,getAttribute:k=>attrs.get(k)??null,
   setAttribute:(k,v)=>attrs.set(k,v),removeAttribute:k=>attrs.delete(k)};
 const title={hidden:false,querySelectorAll:()=>[image]};
 const sync=createTitleImageLifecycle(title);
 sync(true);assert.equal(attrs.has('src'),false);
 sync(false);assert.equal(attrs.get('src'),src);
 image.complete=false;sync(true);assert.equal(attrs.has('src'),false);
 sync(false);assert.equal(attrs.get('src'),src);sync.dispose();
});
function harness(images=[],locale='zh-Hant'){
 const timers=new Map();let nextTimer=0;
 const calls=[],created=[],revoked=[],decodes=[],panel={style:{backgroundImage:''},dataset:{backgroundSrc:'assets/production/title-morning-r1/arena.webp'}};
 const canvas=new Map();
 const title={hidden:false,ownerDocument:{baseURI:'https://example.test/game/',documentElement:{lang:locale,style:{setProperty:(k,v)=>canvas.set(k,v),removeProperty:k=>canvas.delete(k)}}},querySelectorAll:()=>images,querySelector:()=>panel};
 const sync=createTitleImageLifecycle(title,{setTimer:fn=>{const id=++nextTimer;timers.set(id,fn);return id;},clearTimer:id=>timers.delete(id),fetchImpl:(url,options)=>{const d=deferred();calls.push({url,options,...d});return d.promise;},
  urls:{createObjectURL:blob=>{const url='blob:qa-'+created.length;created.push({url,blob});return url;},revokeObjectURL:url=>revoked.push(url)},
  createImage:()=>{const d=deferred(),image={src:'',decode:()=>d.promise,removeAttribute(){this.src='';}};decodes.push({image,...d});return image;}});
 return {calls,created,revoked,decodes,panel,title,sync,timers,canvas,expire:()=>{for(const fn of [...timers.values()])fn();}};
}
test('title exclusively owns one background request and aborts it when paused',async()=>{
 const h=harness();h.sync(false);h.sync(false);assert.equal(h.calls.length,1);assert.equal(h.calls[0].url,'https://example.test/game/assets/production/title-morning-r1/arena.webp');
 h.sync(true);assert.equal(h.calls[0].options.signal.aborted,true);assert.equal(h.panel.style.backgroundImage,'none');h.sync(true);assert.equal(h.calls.length,1);
 h.sync(false);h.sync(false);assert.equal(h.calls.length,2);h.sync.dispose();assert.equal(h.calls[1].options.signal.aborted,true);
});
function titleImage(name){
 const attrs=new Map();return {dataset:{titleSrc:`assets/production/title-morning-r1/${name}.webp`},complete:false,naturalWidth:0,
  getAttribute:key=>attrs.get(key)??null,setAttribute:(key,value)=>attrs.set(key,value),removeAttribute:key=>attrs.delete(key)};
}
async function complete(h,index){h.calls[index].resolve({ok:true,blob:async()=>({index})});await flush();h.decodes.at(-1).resolve();await flush();}
test('installed page canvas shares the owned background Blob and clears before leaving/revocation',async()=>{
 const h=harness();h.sync(false);await complete(h,0);
 assert.equal(h.canvas.get('--cm-title-backdrop'),h.panel.style.backgroundImage);assert.equal(h.calls.length,1);
 h.sync(true);assert.ok(h.canvas.has('--cm-title-backdrop'),'ready art stays while music buffer pauses');
 h.title.hidden=true;h.sync(true);assert.equal(h.canvas.has('--cm-title-backdrop'),false);assert.deepEqual(h.revoked,['blob:qa-0']);
 h.title.hidden=false;h.sync(false);h.decodes.at(-1).resolve();await flush();
 assert.equal(h.canvas.get('--cm-title-backdrop'),h.panel.style.backgroundImage);assert.equal(h.calls.length,1);
 h.sync.dispose();assert.equal(h.canvas.has('--cm-title-backdrop'),false);assert.equal(h.revoked.length,2);
});
test('film warmup owns exactly four TITLE assets with one pending request at a time',async()=>{
 const images=['logo','blaze','cloud'].map(titleImage),h=harness(images);h.sync(true);
 for(let i=0;i<4;i++){
  assert.equal(h.sync.warmNext(),true);
  for(let j=0;j<10;j++)assert.equal(h.sync.warmNext(),false);
  assert.equal(h.calls.length,i+1);assert.equal(h.calls[i].options.priority,'low');await complete(h,i);
 }
 assert.equal(h.sync.warmNext(),false);assert.equal(h.calls.length,4);h.sync(false);
 assert.ok(images.every(image=>image.getAttribute('src').startsWith('blob:')));
 h.sync.dispose();assert.equal(h.revoked.length,4);assert.equal(new Set(h.revoked).size,4);
});
test('skip reuses an unfinished warm image; leaving aborts it and ignores late bytes',async()=>{
 const image=titleImage('logo'),h=harness([image]);h.sync(true);h.sync.warmNext();await complete(h,0);h.sync.warmNext();
 const body=deferred();h.calls[1].resolve({ok:true,blob:()=>body.promise});await flush();h.sync(false);h.sync(false);
 assert.equal(h.calls.length,2);assert.equal(image.getAttribute('src'),null);
 h.title.hidden=true;h.sync(true);assert.equal(h.calls[1].options.signal.aborted,true);
 body.resolve({late:true});await flush();assert.equal(h.created.length,1);assert.equal(h.revoked.length,1);h.sync.dispose();
});
test('warm image timeout can retry once without redownloading the decoded background',async()=>{
 const image=titleImage('logo'),h=harness([image]);h.sync(true);h.sync.warmNext();await complete(h,0);h.sync.warmNext();h.expire();
 assert.equal(h.panel.dataset.titleBackgroundState,'error');assert.equal(h.calls[1].options.signal.aborted,true);
 assert.equal(h.sync.warmNext(),false);assert.equal(h.sync.retry(),true);assert.equal(h.sync.retry(),false);
 h.sync(false);assert.equal(h.calls.length,3);assert.ok(h.calls[2].url.endsWith('/logo.webp'));await complete(h,2);
 assert.equal(h.panel.dataset.titleBackgroundState,'ready');h.sync.dispose();assert.equal(h.revoked.length,2);
});
test('skip keeps progress visible until normal images load; image errors expose a bounded retry',async()=>{
 const image=titleImage('logo'),listeners=new Map();image.addEventListener=(key,fn)=>listeners.set(key,fn);image.removeEventListener=key=>listeners.delete(key);
 const h=harness([image]);h.sync(true);h.sync.warmNext();await complete(h,0);
 assert.equal(h.panel.dataset.titleBackgroundState,'loading');h.sync(false);await complete(h,1);listeners.get('error')();assert.equal(h.panel.dataset.titleBackgroundState,'error');
 assert.equal(h.sync.retry(),true);assert.equal(h.calls.length,3);await complete(h,2);assert.equal(h.panel.dataset.titleBackgroundState,'ready');
 h.sync.dispose();assert.equal(listeners.size,0);
});
test('backgrounding cancels warm work and cached TITLE images return without HTTP',async()=>{
 const image=titleImage('logo'),h=harness([image]);h.sync(true);h.sync.warmNext();h.sync.suspend();
 assert.equal(h.calls[0].options.signal.aborted,true);h.sync(true);h.sync.warmNext();await complete(h,1);
 h.sync(true);h.sync.warmNext();await complete(h,2);
 h.title.hidden=true;h.sync(true);assert.equal(image.getAttribute('src'),null);
 h.title.hidden=false;h.sync(true);assert.equal(h.calls.length,3);assert.equal(h.created.length,4);
 for(const decode of h.decodes.slice(2))decode.resolve();await flush();assert.ok(image.getAttribute('src').startsWith('blob:'));
 h.sync.dispose();assert.equal(h.revoked.length,4);
});
test('normal TITLE image failure survives later background completion; paused downloads abort',async()=>{
 const image=titleImage('logo'),h=harness([image]);h.sync(false);
 assert.equal(h.calls.length,2);assert.ok(h.calls[0].url.endsWith('/logo.webp'));h.calls[0].resolve({ok:false});await flush();
 await complete(h,1);assert.equal(h.panel.dataset.titleBackgroundState,'error');assert.equal(h.sync.retry(),true);assert.equal(h.calls.length,3);
 h.sync(true);assert.equal(h.calls[2].options.signal.aborted,true);h.sync(false);assert.equal(h.calls.length,4);await complete(h,3);assert.equal(h.panel.dataset.titleBackgroundState,'ready');h.sync.dispose();
});


test('late body completion cannot replace a returned title generation',async()=>{
 const h=harness(),oldBody=deferred(),freshBlob={bytes:'same-original'};h.sync(false);
 h.calls[0].resolve({ok:true,blob:()=>oldBody.promise});await flush();h.sync(true);h.sync(false);
 oldBody.resolve({bytes:'stale'});await flush();assert.equal(h.created.length,0);
 h.calls[1].resolve({ok:true,blob:async()=>freshBlob});await flush();h.decodes[0].resolve();await flush();
 assert.equal(h.panel.dataset.titleBackgroundState,'ready');assert.equal(h.created[0].blob,freshBlob);assert.match(h.panel.style.backgroundImage,/blob:qa-0/);h.sync.dispose();
});

test('decode finishing after pause is ignored and its URL is revoked exactly once',async()=>{
 const h=harness();h.sync(false);h.calls[0].resolve({ok:true,blob:async()=>({})});await flush();
 assert.equal(h.created.length,1);h.sync(true);assert.deepEqual(h.revoked,['blob:qa-0']);
 h.decodes[0].resolve();await flush();assert.equal(h.panel.style.backgroundImage,'none');assert.equal(h.sync.inspect().hasCachedBlob,false);
 h.sync.dispose();assert.deepEqual(h.revoked,['blob:qa-0']);
});

test('a completed original Blob returns without another HTTP request and dispose releases it',async()=>{
 const h=harness(),blob={original:true};h.sync(false);h.calls[0].resolve({ok:true,blob:async()=>blob});await flush();h.decodes[0].resolve();await flush();
 assert.equal(h.sync.inspect().hasCachedBlob,true);h.title.hidden=true;h.sync(true);assert.deepEqual(h.revoked,['blob:qa-0']);h.title.hidden=false;h.sync(false);h.sync(false);
 assert.equal(h.calls.length,1);assert.equal(h.created[1].blob,blob);h.decodes[1].resolve();await flush();assert.match(h.panel.style.backgroundImage,/blob:qa-1/);
 h.sync.dispose();h.sync.dispose();h.sync(false);assert.deepEqual(h.revoked,['blob:qa-0','blob:qa-1']);assert.equal(h.sync.inspect().hasCachedBlob,false);assert.equal(h.sync.inspect().disposed,true);assert.equal(h.calls.length,1);
});

test('a failed response keeps the base colour and cannot become a status-driven retry loop',async()=>{
 const h=harness();h.sync(false);h.calls[0].resolve({ok:false});await flush();assert.equal(h.panel.dataset.titleBackgroundState,'error');
 for(let i=0;i<10;i++)h.sync(false);assert.equal(h.calls.length,1);assert.equal(h.created.length,0);
 h.sync(true);h.sync(false);assert.equal(h.calls.length,1,'music state alone cannot retry a failure');
 h.title.hidden=true;h.sync(true);h.title.hidden=false;h.sync(false);assert.equal(h.calls.length,2);h.sync.dispose();h.calls[1].resolve({ok:true,blob:async()=>({})});await flush();assert.equal(h.created.length,0);
});

test('a decode failure revokes its object URL and does not cache corrupt image bytes',async()=>{
 const h=harness();h.sync(false);h.calls[0].resolve({ok:true,blob:async()=>({})});await flush();h.decodes[0].reject(Error('decode'));await flush();
 assert.equal(h.panel.dataset.titleBackgroundState,'error');assert.equal(h.sync.inspect().hasCachedBlob,false);assert.deepEqual(h.revoked,['blob:qa-0']);h.sync.dispose();assert.deepEqual(h.revoked,['blob:qa-0']);
});


test('music buffering retains already decoded title art but hiding it still revokes while paused',async()=>{
 const h=harness();h.sync(false);h.calls[0].resolve({ok:true,blob:async()=>({})});await flush();h.decodes[0].resolve();await flush();
 const ready=h.panel.style.backgroundImage;h.sync(true);h.sync(true);assert.equal(h.panel.style.backgroundImage,ready);assert.deepEqual(h.revoked,[]);
 h.title.hidden=true;h.sync(true);assert.equal(h.panel.style.backgroundImage,'none');assert.deepEqual(h.revoked,['blob:qa-0']);
 h.sync(false);assert.equal(h.calls.length,1);assert.equal(h.created.length,1,'hidden title cannot restart from a stale resume callback');h.sync.dispose();
});


test('return during music buffering restores the cached original without starting network work',async()=>{
 const h=harness();h.sync(false);h.calls[0].resolve({ok:true,blob:async()=>({})});await flush();h.decodes[0].resolve();await flush();
 h.title.hidden=true;h.sync(true);h.title.hidden=false;h.sync(true);assert.equal(h.calls.length,1);assert.equal(h.created.length,2);
 h.decodes[1].resolve();await flush();assert.equal(h.panel.dataset.titleBackgroundState,'ready');assert.equal(h.sync.inspect().paused,true);
 h.sync.dispose();assert.deepEqual(h.revoked,['blob:qa-0','blob:qa-1']);
});


test('HTTP 200 with an unfinished body expires, aborts, and rejects late bytes',async()=>{
 const h=harness(),body=deferred();h.sync(false);h.calls[0].resolve({ok:true,blob:()=>body.promise});await flush();
 h.expire();assert.equal(h.panel.dataset.titleBackgroundState,'error');assert.equal(h.calls[0].options.signal.aborted,true);assert.equal(h.timers.size,0);
 for(let i=0;i<10;i++)h.sync(false);assert.equal(h.calls.length,1);
 body.resolve({late:true});await flush();assert.equal(h.created.length,0);assert.equal(h.sync.inspect().hasCachedBlob,false);h.sync.dispose();
});
test('manual retry starts exactly once and slow successful completion clears the deadline',async()=>{
 const h=harness();h.sync(false);h.expire();assert.equal(h.sync.retry(),true);assert.equal(h.sync.retry(),false);assert.equal(h.calls.length,2);
 const body=deferred();h.calls[1].resolve({ok:true,blob:()=>body.promise});await flush();assert.equal(h.timers.size,1);
 body.resolve({original:true});await flush();h.decodes[0].resolve();await flush();assert.equal(h.panel.dataset.titleBackgroundState,'ready');assert.equal(h.timers.size,0);
 h.expire();assert.equal(h.panel.dataset.titleBackgroundState,'ready');assert.equal(h.sync.retry(),false);h.sync.dispose();assert.deepEqual(h.revoked,['blob:qa-0']);
});
test('a decode timeout revokes once and a late decode cannot restore a released URL',async()=>{
 const h=harness();h.sync(false);h.calls[0].resolve({ok:true,blob:async()=>({})});await flush();h.expire();
 assert.deepEqual(h.revoked,['blob:qa-0']);assert.equal(h.panel.dataset.titleBackgroundState,'error');h.decodes[0].resolve();await flush();assert.equal(h.sync.inspect().hasCachedBlob,false);
 h.sync.dispose();assert.deepEqual(h.revoked,['blob:qa-0']);assert.equal(h.timers.size,0);
});
test('leaving or disposal clears pending deadlines and cannot be manually restarted',()=>{
 const h=harness();h.sync(false);h.title.hidden=true;h.sync(true);assert.equal(h.timers.size,0);assert.equal(h.sync.retry(),false);
 h.title.hidden=false;h.sync(false);assert.equal(h.timers.size,1);h.sync.dispose();assert.equal(h.timers.size,0);assert.equal(h.sync.retry(),false);
});


test('a retry tap during initial music buffering queues one attempt until resume',async()=>{
 const h=harness();h.sync(false);h.expire();h.sync(true);assert.equal(h.panel.dataset.titleBackgroundState,'error');
 assert.equal(h.sync.retry(),true);assert.equal(h.sync.retry(),false);h.sync(true);assert.equal(h.calls.length,1);assert.equal(h.timers.size,0);
 h.sync(false);h.sync(false);assert.equal(h.calls.length,2);assert.equal(h.timers.size,1);h.sync.dispose();assert.equal(h.timers.size,0);
});

test('five-language visibility only requests the Chinese logo for Chinese, including film warmup',async()=>{
 for(const locale of ['zh-Hant','en','ja','th','vi']){
  const logo=titleImage('logo');logo.dataset.titleLocale='zh-Hant';
  const h=harness([logo,titleImage('blaze'),titleImage('cloud')],locale);h.sync(true);
  const count=locale==='zh-Hant'?4:3;
  for(let i=0;i<count;i++){assert.equal(h.sync.warmNext(),true);await complete(h,i);}
  assert.equal(h.sync.warmNext(),false);assert.equal(h.calls.some(c=>c.url.endsWith('/logo.webp')),locale==='zh-Hant');
  h.sync(false);assert.equal(h.panel.dataset.titleBackgroundState,'ready');
  assert.equal(logo.dataset.titleImageState,locale==='zh-Hant'?'ready':undefined);h.sync.dispose();
 }
});

test('en to Chinese to en cancels only a pending logo; stale body cannot attach and completed cache survives switches',async()=>{
 const logo=titleImage('logo');logo.dataset.titleLocale='zh-Hant';const h=harness([logo],'en');h.sync(false);await complete(h,0);
 assert.equal(h.calls.length,1);h.title.ownerDocument.documentElement.lang='zh-Hant';h.sync(false);assert.equal(h.calls.length,2);
 const body=deferred();h.calls[1].resolve({ok:true,blob:()=>body.promise});await flush();
 h.title.ownerDocument.documentElement.lang='en';h.sync(false);assert.equal(h.calls[1].options.signal.aborted,true);assert.equal(h.panel.dataset.titleBackgroundState,'ready');
 body.resolve({stale:true});await flush();assert.equal(logo.getAttribute('src'),null);
 h.title.ownerDocument.documentElement.lang='zh-Hant';h.sync(false);await complete(h,2);assert.equal(logo.dataset.titleImageState,'ready');
 const url=logo.getAttribute('src');for(let i=0;i<4;i++){h.title.ownerDocument.documentElement.lang='en';h.sync(false);h.title.ownerDocument.documentElement.lang='zh-Hant';h.sync(false);}
 assert.equal(h.calls.length,3);assert.equal(logo.getAttribute('src'),url);
 h.title.hidden=true;h.sync(true);h.title.hidden=false;h.sync(false);for(const decode of h.decodes.slice(2))decode.resolve();await flush();
 assert.equal(h.calls.length,3);assert.equal(logo.dataset.titleImageState,'ready');h.sync.dispose();assert.equal(new Set(h.revoked).size,h.revoked.length);
});

test('logo errors and deliberate retry track the visible language without hiding a background error',async()=>{
 const logo=titleImage('logo');logo.dataset.titleLocale='zh-Hant';const h=harness([logo]);h.sync(false);h.calls[0].resolve({ok:false});await flush();await complete(h,1);
 assert.equal(logo.dataset.titleImageState,'error');assert.equal(h.panel.dataset.titleBackgroundState,'error');
 h.title.ownerDocument.documentElement.lang='en';h.sync(false);assert.equal(h.panel.dataset.titleBackgroundState,'ready');assert.equal(h.sync.retry(),false);
 h.title.ownerDocument.documentElement.lang='zh-Hant';h.sync(false);assert.equal(h.panel.dataset.titleBackgroundState,'error');
 assert.equal(h.sync.retry(),true);assert.equal(h.sync.retry(),false);await complete(h,2);assert.equal(logo.dataset.titleImageState,'ready');h.sync.dispose();
 const failed=harness([logo],'en');failed.sync(false);failed.calls[0].resolve({ok:false});await flush();
 failed.title.ownerDocument.documentElement.lang='zh-Hant';failed.sync(false);assert.equal(failed.panel.dataset.titleBackgroundState,'error');failed.sync.dispose();
});

test('attached logo decode must finish before ready; timeout or language change never reveals a released URL',async()=>{
 const logo=titleImage('logo');logo.dataset.titleLocale='zh-Hant';const attached=deferred();logo.decode=()=>attached.promise;
 const h=harness([logo]);h.sync(false);h.calls[0].resolve({ok:true,blob:async()=>({})});await flush();h.decodes[0].resolve();await flush();
 assert.equal(logo.dataset.titleImageState,'loading');assert.ok(logo.getAttribute('src').startsWith('blob:'));
 logo.complete=true;logo.naturalWidth=1774;await complete(h,1);
 assert.equal(h.panel.dataset.titleBackgroundState,'loading','DOM load is not attached decode readiness');
 h.title.ownerDocument.documentElement.lang='en';h.sync(false);assert.equal(logo.getAttribute('src'),null);attached.resolve();await flush();
 assert.equal(logo.dataset.titleImageState,'idle');assert.equal(h.revoked.length,1);h.sync.dispose();
});

function localizedLogos(){return ['zh-Hant','en','ja','th','vi'].map(locale=>{const image=titleImage(`logo-${locale}`);image.dataset.titleLocale=locale;const listeners=new Map();image.listeners=listeners;image.addEventListener=(key,fn)=>listeners.set(key,fn);image.removeEventListener=(key,fn)=>{if(listeners.get(key)===fn)listeners.delete(key);};return image;});}
for(const locale of ['zh-Hant','en','ja','th','vi'])test(`multilingual ${locale} warmup fetches only active logo and skip reuses it`,async()=>{
 const logos=localizedLogos(),h=harness([...logos,titleImage('blaze'),titleImage('cloud')],locale);h.sync(true);
 for(let i=0;i<4;i++){assert.equal(h.sync.warmNext(),true);await complete(h,i);}
 assert.equal(h.sync.warmNext(),false);h.sync(false);
 assert.equal(h.calls.filter(c=>c.url.includes('/logo-')).length,1);
 assert.ok(h.calls.some(c=>c.url.endsWith(`/logo-${locale}.webp`)));
 assert.equal(h.panel.dataset.titleBackgroundState,'ready');
 for(const logo of logos){assert.equal(logo.dataset.titleImageVisible,String(logo.dataset.titleLocale===locale));if(logo.dataset.titleLocale!==locale)assert.equal(logo.getAttribute('src'),null);}
 h.sync.dispose();assert.ok(logos.every(x=>x.listeners.size===0));
});
test('rapid locale toggles cancel requests and invalidate captured late load/error listeners',async()=>{
 const logos=localizedLogos(),h=harness(logos,'en'),en=logos[1];h.sync(false);
 const oldLoad=en.listeners.get('load'),oldError=en.listeners.get('error');
 h.calls[0].resolve({ok:true,blob:async()=>({old:true})});await flush();const oldDecode=h.decodes.at(-1);
 for(const locale of ['ja','th','vi','en']){h.title.ownerDocument.documentElement.lang=locale;h.sync(false);}
 assert.ok(h.calls[0].options.signal.aborted);assert.ok(h.calls.slice(2,-1).every(c=>c.options.signal.aborted));
 oldLoad();oldError();oldDecode.resolve();await flush();assert.equal(en.dataset.titleImageState,'loading');assert.equal(en.getAttribute('src'),null);
 await complete(h,h.calls.length-1);await complete(h,1);assert.equal(h.panel.dataset.titleBackgroundState,'ready');
 oldError();oldLoad();assert.equal(en.dataset.titleImageState,'ready');assert.equal(h.panel.dataset.titleBackgroundState,'ready');h.sync.dispose();
});
test('completed locale cache detaches old listeners and reuses bytes with fresh callbacks',async()=>{
 const logos=localizedLogos(),en=logos[1],h=harness(logos,'en');h.sync(false);await complete(h,0);await complete(h,1);
 const oldError=en.listeners.get('error'),oldLoad=en.listeners.get('load');
 h.title.ownerDocument.documentElement.lang='ja';h.sync(false);assert.equal(en.listeners.size,0);
 h.title.ownerDocument.documentElement.lang='en';h.sync(false);const count=h.calls.length;
 assert.notEqual(en.listeners.get('error'),oldError);oldError();oldLoad();assert.equal(en.dataset.titleImageState,'ready');assert.equal(h.panel.dataset.titleBackgroundState,'ready');assert.equal(h.calls.length,count);h.sync.dispose();
});
test('active foreign missing image has a bounded retry and does not fetch Chinese as a substitute',async()=>{
 const logos=localizedLogos(),h=harness(logos,'th');h.sync(false);h.calls[0].resolve({ok:false});await flush();await complete(h,1);
 assert.equal(logos[3].dataset.titleImageState,'error');assert.equal(h.sync.retry(),true);assert.equal(h.sync.retry(),false);await complete(h,2);
 assert.equal(logos[3].dataset.titleImageState,'ready');assert.equal(h.panel.dataset.titleBackgroundState,'ready');assert.ok(!h.calls.some(c=>c.url.includes('zh-Hant')));h.sync.dispose();
});
test('attract replay pauses only unfinished assets; hidden TITLE aborts and stale events cannot revive it',async()=>{
 const logos=localizedLogos(),h=harness(logos,'vi');h.sync(false);const late=logos[4].listeners.get('error');
 h.sync(true);assert.ok(h.calls[0].options.signal.aborted);assert.ok(h.calls[1].options.signal.aborted);late();assert.equal(logos[4].dataset.titleImageState,'idle');
 h.sync(false);h.title.hidden=true;h.sync(true);assert.ok(h.calls.slice(2).every(c=>c.options.signal.aborted));late();assert.equal(logos[4].dataset.titleImageVisible,'false');h.sync.dispose();
});

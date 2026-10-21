// CI only: never retry the denied local browser/socket route.
if(process.env.GITHUB_ACTIONS!=='true')throw new Error('HM02_BROWSER_REQUIRES_AUTHORIZED_GITHUB_CI');
import fs from 'node:fs';import path from 'node:path';import http from 'node:http';import assert from 'node:assert/strict';import {chromium} from 'playwright';
const root=process.cwd(),testRoot=path.join(root,'tests/hm02-three-review'),out=path.join(root,'artifacts/hm02-three-review');fs.mkdirSync(out,{recursive:true});
const mime={'.mjs':'text/javascript','.js':'text/javascript','.json':'application/json','.html':'text/html','.glb':'model/gltf-binary','.png':'image/png','.webp':'image/webp'};
const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),p=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!p.startsWith(root+path.sep)){res.writeHead(403).end();return;}if(!fs.existsSync(p)||!fs.statSync(p).isFile()){res.writeHead(404).end();return;}res.setHeader('Content-Type',mime[path.extname(p)]??'application/octet-stream');res.end(fs.readFileSync(p));});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const origin=`http://127.0.0.1:${server.address().port}`;
let browser;const results=[],errors=[];
try{
 browser=await chromium.launch({headless:true,args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const context=await browser.newContext({viewport:{width:390,height:844}}); // ephemeral; no storageState/save fixtures
 await context.addInitScript(()=>{window.__hmContexts=new Set();const original=HTMLCanvasElement.prototype.getContext;HTMLCanvasElement.prototype.getContext=function(kind,...args){const c=original.call(this,kind,...args);if(c&&['webgl','webgl2','experimental-webgl'].includes(kind))window.__hmContexts.add(c);return c;};});
 await context.route('**/*',async route=>{const u=new URL(route.request().url());if(u.origin!==origin){await route.abort();return;}let file;if(u.pathname==='/hm02-review.html')file=path.join(testRoot,'ci/harness.html');
  const prefix='/src/championship/presentation/vs2/';if(u.pathname.startsWith(prefix)){const name=u.pathname.slice(prefix.length);if(!name.includes('/'))file=path.join(testRoot,name);}
  if(u.pathname.startsWith('/assets/hm02-three-v2/'))file=path.join(testRoot,'assets',path.basename(u.pathname));
  if(file&&fs.existsSync(file)){await route.fulfill({path:file,contentType:mime[path.extname(file)]??'application/octet-stream'});return;}
  await route.continue();
 });
 const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
 await page.goto(`${origin}/hm02-review.html?hm02ThreeReview=1`);await page.waitForFunction(()=>window.hm02?.ready,{timeout:30000});
 const call=(method,...args)=>page.evaluate(([method,args])=>window.hm02[method](...args),[method,args]);
 const yellow=p=>p[0]>220&&p[1]>220&&p[2]<35;
 let r=await call('mount');assert(r.active,'pilot must activate');assert(yellow(r.pixels.lower),'native-origin lower body must not be ground-clipped');assert.equal(r.canvasCount,1);assert.equal(r.contexts,1);assert(r.pixels.ui[1]>220&&r.pixels.ui[2]>220,'Pixi UI remains');results.push({case:'lower-body-native-origin',...r});await page.screenshot({path:path.join(out,'native-origin.png')});
 r=await call('mount',{mode:'pillar'});assert(r.active);assert(!yellow(r.pixels.lower),'near foreground pillar must occlude actor');results.push({case:'foreground-pillar',...r});await page.screenshot({path:path.join(out,'foreground-pillar.png')});
 r=await call('mount',{z:24});assert(r.active);results.push({case:'nativeZ-jump',...r});await page.screenshot({path:path.join(out,'native-z.png')});
 r=await call('mount',{mode:'badShader'});assert(!r.active,'shader failure must fail closed');assert(r.fallbacks.some(x=>x.includes('SHADER')));assert(r.pixels.fallback[0]>220&&r.pixels.fallback[2]>220,'same-frame native fallback restored');results.push({case:'injected-shader-failure',...r});
 r=await call('mount',{realLoader:true,x:575,y:240});assert(!r.active,'v2 cave region intentionally falls back');results.push({case:'v2-cave-fallback-not-3d-acceptance',...r});
 r=await call('mount',{realLoader:true,fieldId:'field_hm01_01'});assert(!r.active);results.push({case:'HM01-excluded',...r});
 for(let i=0;i<10;i++){r=await call('mount');assert(r.active);await call('dispose');const state=await call('get');assert.equal(state.listenerCount,0);assert(!state.active);results.push({case:`reentry-${i+1}`,state});}
 r=await call('mount');await call('resize',844,390,2);results.push({case:'resize-DPR2',result:await call('draw')});await page.screenshot({path:path.join(out,'landscape-dpr2.png')});
 await call('loseContext');await page.waitForFunction(()=>!window.hm02.get().active);await call('restoreContext');await page.waitForFunction(()=>{const c=document.querySelector('canvas');return c&&!c.getContext('webgl2').isContextLost();});results.push({case:'context-loss-restoration-fallback',result:await call('draw')});
 assert.deepEqual(errors,[]);await context.close();
 fs.writeFileSync(path.join(out,'report.json'),JSON.stringify({status:'PASS',scope:'ISOLATED_SYNTHETIC_GPU_NOT_GAMEPLAY_OR_MOBILE',assets:'frozen-v2',results,errors,fullMainMountGameplay:'PENDING',realMobile:'PENDING'},null,2));
}catch(error){fs.writeFileSync(path.join(out,'failure.json'),JSON.stringify({message:error.message,stack:error.stack,results,errors},null,2));throw error;}
finally{await browser?.close();await new Promise(r=>server.close(r));}

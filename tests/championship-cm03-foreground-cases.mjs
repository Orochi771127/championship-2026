import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {cageForegroundPlan,cm03ForegroundEligible,cm24ForegroundEligible,withCageForeground} from '../src/championship/presentation/cageForeground.js';
import {loadRuntimeMapArtTileSet} from '../src/championship/presentation/runtimeMapArtBundle.js';
import {composeRanchArtPlan} from '../src/championship/presentation/raisingRanchArtPlan.js';
import {originalStartingRanch} from '../src/championship/cage/nativeRanchLayout.js';
import {prototypeRanchExpansion,RANCH_DECKS_LAYOUT} from '../src/championship/cage/ranchExpansion.js';
import {listCageDefinitions} from '../src/championship/cage/cageCatalog.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const data=read('assets/production/cage/cm03-r18-foreground-20261009/manifest.json');
const manifest=read('assets/production/cage/final-intake-20261008/manifest.json');
const placements=[{fieldId:'field_cm03_01',x:400,y:0,slotIndex:2,sourceRect:{x:0,y:96,width:1152,height:704}}];
test('foreground admits only authorized locations and the exact accepted final CM03 source',()=>{
 assert.equal(cm03ForegroundEligible(manifest,placements,{hostname:'127.0.0.1'}),true);
 for(const hostname of ['example.com','127.0.0.1.evil',''])assert.equal(cm03ForegroundEligible(manifest,placements,{hostname}),false);
 const other=structuredClone(manifest);other.fields.find(f=>f.fieldId==='field_cm03_01').frames[0].sha256='changed';
 assert.equal(cm03ForegroundEligible(other,placements,{hostname:'localhost'}),false);
 assert.equal(cm03ForegroundEligible(manifest,[{fieldId:'field_cm24_01'}],{hostname:'localhost'}),false);
});
test('CM03 mask hashes, dimensions and source final pixels remain traceable',()=>{
 assert.equal(data.objects.length,14);
 for(const o of data.objects){const bytes=fs.readFileSync(new URL('../'+o.src,import.meta.url));assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),o.sha256);assert.equal(bytes.readUInt32BE(16),o.width);assert.equal(bytes.readUInt32BE(20),o.height);}
 const bytes=fs.readFileSync(new URL('../'+data.sourceComposite.src,import.meta.url));
 assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),data.sourceComposite.sha256);
});
test('upper crop, partial fragments and wrap copies share the base world coordinates and ground depth',()=>{
 const plan=cageForegroundPlan(data,placements,{wrapWidthPx:2688});assert.equal(plan.length,42);
 const o=data.objects[0],copies=plan.filter(p=>p.id===o.id);assert.deepEqual(copies.map(p=>p.x),[-2688,0,2688].map(v=>400+o.x+v));
 assert.equal(copies[0].y,o.y-96);assert.equal(copies[0].depth,o.depthNative-24);
 const fragment={fieldId:data.fieldId,x:100,y:25,fragmentOfSlot:2,sourceRect:{x:o.x+5,y:o.y+7,width:10,height:12}};
 const [piece]=cageForegroundPlan(data,[fragment]);assert.equal(piece.x,100);assert.equal(piece.y,25);assert.equal(piece.slotIndex,2);assert.deepEqual(piece.crop,{x:5,y:7,width:10,height:12});
 assert.equal(piece.depth,(25-o.y-7)/4+o.depthNative);assert.deepEqual(cageForegroundPlan(data,[{fieldId:'field_cm24_01'}]),[]);
});
test('mismatched scale and out-of-frame metadata cannot install masks',()=>{
 assert.throws(()=>cageForegroundPlan(data,placements,{unit:2}),/SOURCE_MISMATCH/);
 const bad=structuredClone(data);bad.objects[0].width=9999;assert.throws(()=>cageForegroundPlan(bad,placements),/PIECE_INVALID/);
});
function harness(){
 const groups=[],sprites=[],masks=[];let baseDisposed=0;
 class Container{constructor(o){Object.assign(this,o);this.children=[];this.position={set:(x,y)=>{this.x=x;this.y=y;}};this.scale={set:v=>this.scaleValue=v};groups.push(this);}addChild(...children){this.children.push(...children);for(const c of children)c.parent=this;}destroy(){this.destroyed=true;for(const c of this.children)c.destroy();}}
 class Sprite{constructor(texture){this.texture=texture;sprites.push(this);}destroy(){this.destroyed=true;}}
 class Graphics{constructor(){this.rects=[];masks.push(this);}rect(...r){this.rects.push(r);return this;}fill(){return this;}destroy(){this.destroyed=true;}}
 const texture={source:{scaleMode:'nearest'}},base={label:'runtime map art field_cm03_01',x:400,y:0,texture,width:1152,height:704};
 const PIXI={Container,Sprite,Graphics,Assets:{load:()=>{throw Error('extra asset load');},unload:()=>{throw Error('extra asset unload');}}};
 const art={displayObject:{children:[base]},field:{nativePixelWorldScale:4,wrapWidthPx:2688},getDiagnostics:()=>({base:true}),dispose:async()=>{baseDisposed++;}};
 return {PIXI,art,groups,sprites,masks,texture,baseDisposed:()=>baseDisposed};
}
const options=h=>({...h,manifest,placements,location:{hostname:'localhost'},baseHref:'http://localhost/championship.html',fetchImpl:async()=>({ok:true,json:async()=>data})});
test('shared base quads and stencil masks preserve UVs and add zero decoded texture bytes',async()=>{
 const h=harness(),result=await withCageForeground(options(h));const layer={addChild:s=>{s.parent=layer;},removeChild:s=>{s.parent=null;}};
 result.foreground.attach(layer);result.foreground.syncViewport({x:12,y:30,scale:.75});const d=result.getDiagnostics().foreground;assert.equal(d.spriteCount,42);assert.equal(d.timer,'NONE');assert.equal(d.additionalDecodedTextureBytes,0);assert.equal(d.maskRectangleCount,663);
 const first=cageForegroundPlan(data,placements,{wrapWidthPx:2688})[0];assert.equal(h.groups[0].x,12+first.tileX*.75);assert.equal(h.groups[0].y,30+first.tileY*.75);assert.equal(h.groups[0].zIndex,first.depth);
 assert.equal(h.sprites[0].texture,h.texture);assert.equal(h.sprites[0].width,1152);assert.equal(h.sprites[0].height,704);assert.deepEqual(h.masks[0].rects,first.maskRects);
 h.groups[0].destroy();await result.dispose();await result.dispose();assert.equal(h.baseDisposed(),1);assert.ok(h.groups.every(s=>s.destroyed));assert.ok(h.sprites.every(s=>s.destroyed));assert.ok(h.masks.every(s=>s.destroyed));
});
test('missing base refuses mismatched transforms; unrelated public art never fetches',async()=>{
 const h=harness();h.art.displayObject.children=[];await assert.rejects(withCageForeground(options(h)),/BASE_TILE_MISSING/);
 const h2=harness();assert.equal(await withCageForeground({...options(h2),location:{hostname:'example.com'},fetchImpl:()=>{throw Error('unexpected fetch');}}),h2.art);assert.equal(h2.groups.length,0);
});

const cm24=read('assets/production/cage/cm24-final-foreground-20261010/manifest.json');
const cm24Upper={fieldId:'field_cm24_01',x:400,y:0,slotIndex:2,sourceRect:{x:0,y:96,width:384,height:352}};
const cm24Lower={fieldId:'field_cm24_01',x:400,y:352,slotIndex:9,sourceRect:{x:0,y:0,width:384,height:448}};

test('CM24 binds only exact final composite/master and the approved site or loopback',()=>{
 const approved='https://orochi771127.github.io/championship-2026/championship.html';
 assert.equal(cm24ForegroundEligible(manifest,[cm24Upper],new URL(approved)),true);
 assert.equal(cm03ForegroundEligible(manifest,placements,new URL(approved)),true);
 for(const url of ['https://orochi771127.github.io/championship-2026-evil/','https://orochi771127.github.io/other/','https://orochi771127.github.io.evil.test/championship-2026/','http://orochi771127.github.io/championship-2026/'])
  assert.equal(cm24ForegroundEligible(manifest,[cm24Upper],new URL(url)),false);
 const bad=structuredClone(cm24);bad.masterSha256='f87c685eecf54215d259371eec47529e9d926bfd5a552c6f32d800a20ceef2c9';
 assert.throws(()=>cageForegroundPlan(bad,[cm24Upper]),/SOURCE_MISMATCH/);
 const old=structuredClone(manifest);old.fields.find(f=>f.fieldId==='field_cm24_01').frames[0].sha256='old';
 assert.equal(cm24ForegroundEligible(old,[cm24Upper],{hostname:'localhost'}),false);
});
test('CM24 nine masks retain full uncropped 384x448 canvas and exact geometry-derived alpha unions',()=>{
 assert.equal(cm24.objects.length,9);assert.equal(cm24.pixelScale,4);assert.equal(cm24.offsetsAppliedAgain,false);
 assert.equal(cm24.masterSha256,'dd731a1d27cec5cc19ecf67682e20a26bc3fd86c873f5e9e3c3b39b87ea28670');
 assert.equal(cm24.sourceComposite.sha256,'601b05420d77f23fdc1dea75323ed350a85f11bb28068b77212c922989dd6146');
 const bytes=fs.readFileSync(cm24.sourceComposite.src);assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),cm24.sourceComposite.sha256);
 let pixels=0;
 for(const o of cm24.objects){
  const png=fs.readFileSync(o.src);assert.equal(crypto.createHash('sha256').update(png).digest('hex'),o.sha256);
  assert.equal(png.readUInt32BE(16),384);assert.equal(png.readUInt32BE(20),448);
  assert.deepEqual(o.fullCanvasRasterSize,[384,448]);assert.deepEqual(o.fullCanvasOriginRaster,[0,0]);
  assert.ok(Math.abs(o.groundContactNative[1]-o.depthNative)<.000001);
  assert.deepEqual(o.groundContactRaster,o.groundContactNative.map(v=>v*4));
  assert.ok(o.selectors.every(s=>s.startsWith('temple-')));assert.ok(!o.selectors.some(s=>/floor|surface|foundation|rim|fascia|joint/.test(s)));
  const coverage=new Uint8Array(o.width*o.height);
  for(const[x,y,w,h]of o.maskRects)for(let py=y;py<y+h;py++)for(let px=x;px<x+w;px++){assert.equal(coverage[py*o.width+px],0);coverage[py*o.width+px]=1;}
  assert.equal(coverage.reduce((a,b)=>a+b,0),o.opaquePixelCount);pixels+=o.opaquePixelCount;
 }
 assert.equal(pixels,24530);
});
test('CM24 applies the 96px crop only to upper-row placement and preserves lower/wrap depth',()=>{
 for(const p of [cm24Upper,cm24Lower]){
  const plan=cageForegroundPlan(cm24,[p],{wrapWidthPx:2688});assert.equal(plan.length,27);
  for(const o of cm24.objects){
   const parts=plan.filter(q=>q.id===o.id);assert.deepEqual(parts.map(q=>q.repeat),[-2688,0,2688]);
   for(const q of parts){assert.equal(q.depth,(p.y-p.sourceRect.y)/4+o.depthNative);assert.equal(q.fieldId,'field_cm24_01');
    for(const[x,y,w,h]of q.maskRects){assert.ok(x>=0&&y>=0&&x+w<=384&&y+h<=p.sourceRect.height);}
   }
  }
 }
 const cropped=structuredClone(cm24);cropped.height=352;assert.throws(()=>cageForegroundPlan(cropped,[cm24Lower]),/SOURCE_MISMATCH/);
});
test('CM03 and CM24 share one foreground owner, base textures and disposal without extra loads',async()=>{
 const h=harness(),texture24={source:{scaleMode:'nearest'}};
 h.art.displayObject.children.push({label:'runtime map art field_cm24_01',x:cm24Lower.x,y:cm24Lower.y,texture:texture24,width:384,height:448});
 const mixed=[...placements,cm24Lower];
 const result=await withCageForeground({...options(h),placements:mixed,fetchImpl:async url=>({ok:true,json:async()=>String(url).includes('cm24-final')?cm24:data})});
 const layer={addChild:s=>{s.parent=layer;},removeChild:s=>{s.parent=null;}};result.foreground.attach(layer);result.foreground.syncViewport({x:12,y:30,scale:.75});
 const d=result.getDiagnostics().foreground;assert.deepEqual(d.fieldIds,['field_cm03_01','field_cm24_01']);assert.equal(d.objectCount,23);assert.equal(d.spriteCount,69);assert.equal(d.additionalDecodedTextureBytes,0);
 assert.equal(h.sprites.filter(s=>s.texture===texture24).length,27);assert.equal(h.sprites.filter(s=>s.texture===h.texture).length,42);
 await result.dispose();await result.dispose();assert.equal(h.baseDisposed(),1);assert.ok(h.groups.every(g=>g.destroyed));
});

// Use the production compositor and loader together: the earlier foreground
// doubles had only flat children and could not reveal folded band failures.
function foldedPixi(){
 const loaded=[],unloaded=[],textures=[],objects=[];
 class Container{
  constructor(options={}){Object.assign(this,options);this.children=[];this.x=0;this.y=0;
   this.position={set:(x,y)=>{this.x=x;this.y=y;}};this.scale={set:v=>{this.scaleValue=v;}};objects.push(this);}
  addChild(...children){for(const c of children){c.parent?.removeChild(c);this.children.push(c);c.parent=this;}}
  removeChild(c){this.children=this.children.filter(x=>x!==c);c.parent=null;}
  destroy(options={}){assert.ok(!this.destroyed,'display object disposed twice');this.destroyed=true;this.destroyOptions=options;
   if(options.children)for(const c of [...this.children])if(!c.destroyed)c.destroy(options);}
 }
 class Sprite extends Container{constructor(texture){super();this.texture=texture;}}
 class AnimatedSprite extends Sprite{constructor({textures}){super(textures[0]);}gotoAndStop(){}}
 class Graphics extends Container{constructor(){super();this.rects=[];}rect(...r){this.rects.push(r);return this;}fill(){return this;}}
 class Rectangle{constructor(x,y,width,height){Object.assign(this,{x,y,width,height});}}
 class Texture{constructor(args){Object.assign(this,args);textures.push(this);}destroy(source){assert.equal(source,false);assert.ok(!this.destroyed);this.destroyed=true;}}
 const fields=new Map(manifest.fields.flatMap(f=>f.frames.map(frame=>[frame.src,f])));
 const PIXI={Container,Sprite,AnimatedSprite,Graphics,Rectangle,Texture,Assets:{
  async load(src){loaded.push(src);const f=fields.get(src);assert.ok(f);return {source:{},frame:{x:0,y:0,width:f.worldWidthPx,height:f.worldHeightPx}};},
  async unload(src){unloaded.push(src);}
 }};
 return {PIXI,loaded,unloaded,textures,objects};
}
function annexArtPlan(entries){
 const definitions=listCageDefinitions();
 return composeRanchArtPlan({manifest,layoutVersion:RANCH_DECKS_LAYOUT,expansion:prototypeRanchExpansion(),unlockedCount:20,
  placements:[originalStartingRanch().placements.find(p=>p.moduleId.includes('waiting-room')),
   ...entries.map(([index,slotIndex])=>({moduleId:definitions[index].moduleId,slotIndex}))]});
}
async function foldedResult(entries){
 const h=foldedPixi(),plan=annexArtPlan(entries);
 const art=await loadRuntimeMapArtTileSet({PIXI:h.PIXI,manifest,placements:plan.placements,residentViewport:plan.residentViewport,
  wrapWidthPx:plan.wrapWidthPx,fold:plan.fold,presentationMode:plan.mode});
 const count=h.loaded.length;
 const result=await withCageForeground({PIXI:h.PIXI,art,manifest,placements:plan.placements,location:{hostname:'localhost'},baseHref:'http://localhost/',
  fetchImpl:async url=>({ok:true,json:async()=>String(url).includes('cm24-final')?cm24:data})});
 assert.equal(h.loaded.length,count,'foreground borrows loaded base textures');
 const layer=new h.PIXI.Container();result.foreground.attach(layer);
 return {...h,art,plan,result,layer};
}

test('real folded tile sets retain CM03 and CM24 foreground in both bands, caps and lower rows',async()=>{
 for(const entries of [[[2,4],[23,10]],[[2,20],[23,26]],[[2,4],[23,27]],[[2,20],[23,11]]]){
  const h=await foldedResult(entries),fields=h.result.getDiagnostics().foreground.fieldIds;
  assert.deepEqual(fields,['field_cm03_01','field_cm24_01']);
  assert.ok(h.layer.children.length>0);
  const descendants=o=>[o,...(o.children??[]).flatMap(descendants)];
  const baseTextures=new Set(descendants(h.art.displayObject).filter(o=>o.label?.startsWith('runtime map art field_')).map(o=>o.texture));
  for(const root of h.layer.children)assert.ok(baseTextures.has(root.children[0].texture),'exact base quad/UV source');
  assert.equal(h.result.getDiagnostics().foreground.additionalDecodedTextureBytes,0);
  await h.result.dispose();await h.result.dispose();
  assert.equal(new Set(h.loaded).size,h.loaded.length,'caps share loads');
  assert.deepEqual([...h.unloaded].sort(),[...h.loaded].sort());assert.ok(h.textures.every(t=>t.destroyed));
  assert.equal(h.layer.children.length,0);
 }
});

test('fold stencils match both owner clips, cap pixels stay in band one, and depth follows actor screen Y',async()=>{
 const h=await foldedResult([[2,20],[23,26]]),unit=4,fold=h.art.field.fold;
 const parts=[...cageForegroundPlan(data,h.plan.placements,{unit,fold,worldHeightPx:h.art.field.worldHeightPx}),
  ...cageForegroundPlan(cm24,h.plan.placements,{unit,fold,worldHeightPx:h.art.field.worldHeightPx})];
 assert.equal(h.layer.children.length,parts.length);
 assert.ok(h.plan.placements.some(p=>p.foldCap),'the real compositor supplies upper caps');
 // Both accepted foreground masks are transparent in the top 96px. Keep the
 // base cap artwork, but do not manufacture opaque foreground there.
 assert.equal(parts.filter(p=>p.foldCap).length,0);
 for(const fit of [{x:12,y:168,scale:.5},{x:-113,y:-71,scale:.75}]){
  h.result.foreground.syncViewport(fit);
  for(const[p,root]of parts.map((p,i)=>[p,h.layer.children[i]])){
   if(p.foldCap)assert.equal(p.foldBand,1);
   assert.equal(root.x,fit.x+p.tileX*fit.scale);assert.equal(root.y,fit.y+p.tileY*fit.scale);
   assert.equal(root.zIndex,Math.round(fit.y+p.depthWorldPx*fit.scale));
   // A foot at the object's original ground depth ties its projected depth;
   // behind/in-front feet remain ordered under scrolling and fractional scale.
   assert.ok(Math.round(fit.y+(p.depthWorldPx-4)*fit.scale)<root.zIndex);
   assert.ok(Math.round(fit.y+(p.depthWorldPx+4)*fit.scale)>root.zIndex);
   for(const[x,y,w,hgt]of p.maskRects){
    const wx=p.sourceTileX+x,wy=p.sourceTileY+y;
    assert.ok(wx>=(p.foldBand?fold.splitPx:0)&&wx+w<=(p.foldBand?fold.ringPx:fold.splitPx));
    assert.ok(wy>=(p.foldBand?-fold.capPx:0)&&wy+hgt<=h.art.field.worldHeightPx);
   }
  }
 }
 await h.result.dispose();
});

test('a foreground spanning a fold seam is partitioned without missing or duplicate mask pixels',()=>{
 // Choose a seam through the real CM03 stencil so clipping is independently
 // exercised even when valid facility footprints stay within one deck.
 const placement={...placements[0],x:0},plain=cageForegroundPlan(data,[placement]);
 const fold={splitPx:512,ringPx:1536,bandOffsetPx:704,capPx:96};
 const parts=cageForegroundPlan(data,[placement],{fold,worldHeightPx:800});
 const pixels=list=>{const set=new Set();for(const p of list)for(const[x,y,w,h]of p.maskRects)
  for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++){
   const k=p.id+':'+(p.sourceTileX+xx)+':'+(p.sourceTileY+yy);assert.ok(!set.has(k),'duplicate mask pixel');set.add(k);
  }return set;};
 assert.ok(parts.some(p=>p.foldBand===0)&&parts.some(p=>p.foldBand===1));
 assert.deepEqual(pixels(parts),pixels(plain));
 assert.throws(()=>cageForegroundPlan(data,[placement],{fold:{...fold,splitPx:-1},worldHeightPx:800}),/FOLD_INVALID/);
});

test('partial folded allocation failure releases overlays without destroying owner textures',async()=>{
 const h=foldedPixi(),plan=annexArtPlan([[2,20],[23,26]]);
 const art=await loadRuntimeMapArtTileSet({PIXI:h.PIXI,manifest,placements:plan.placements,residentViewport:plan.residentViewport,
  wrapWidthPx:plan.wrapWidthPx,fold:plan.fold,presentationMode:plan.mode});
 const hide=o=>{if(o.label==='runtime map art field_cm24_01')o.label='missing';for(const c of o.children??[])hide(c);};hide(art.displayObject);
 await assert.rejects(withCageForeground({PIXI:h.PIXI,art,manifest,placements:plan.placements,location:{hostname:'localhost'},baseHref:'http://localhost/',
  fetchImpl:async url=>({ok:true,json:async()=>String(url).includes('cm24-final')?cm24:data})}),/BASE_TILE_MISSING/);
 assert.ok(h.objects.filter(o=>o.label?.startsWith('cage foreground ')).every(o=>o.destroyed));
 assert.equal(h.unloaded.length,0);assert.ok(h.textures.every(t=>!t.destroyed),'only the art owner can release textures');
 await art.dispose();assert.deepEqual([...h.unloaded].sort(),[...h.loaded].sort());
});

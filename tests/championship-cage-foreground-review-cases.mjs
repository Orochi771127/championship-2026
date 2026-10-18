// Generated cage occluders (local review 2026-10-19): one exact-pixel atlas
// per cage, plain sprites at ground-contact depth bands, local index only.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {withCageForeground,cageForegroundPlan} from '../src/championship/presentation/cageForeground.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const index=read('assets/production/cage/foreground-review-20261019/index.json');
const manifest=read('assets/production/public-runtime/cage-final.map.v1.json');

test('every indexed cage binds its exact runtime frame, master hash and atlas bytes',()=>{
 assert.equal(index.publicReleasePermitted,false);
 assert.ok(index.fields.length>=30);
 for(const f of index.fields){
  assert.ok(!['field_cm02_01','field_cm03_01','field_cm24_01'].includes(f.fieldId),'curated cages keep their own sets');
  const data=read(f.manifest),frame=manifest.fields.find(x=>x.fieldId===f.fieldId).frames[0];
  assert.equal(data.sourceComposite.sha256,frame.sha256,f.fieldId);assert.equal(f.sourceHash,frame.sha256);
  assert.equal(data.masterSha256,f.masterHash);
  const bytes=fs.readFileSync(new URL('../'+data.atlas.src,import.meta.url));
  assert.equal(crypto.createHash('sha256').update(bytes).digest('hex'),data.atlas.sha256,f.fieldId);
  for(const o of data.objects){
   assert.ok(o.atlasX>=0&&o.atlasY>=0&&o.atlasX+o.width<=data.atlas.width&&o.atlasY+o.height<=data.atlas.height,o.id);
   assert.ok(o.x>=0&&o.y>=0&&o.x+o.width<=data.width&&o.y+o.height<=data.height,o.id);
   assert.ok(o.depthNative>0&&o.depthNative<=data.height/4+8,o.id);
  }
 }
});

test('atlas pieces become plain sprites at depth with the atlas sub-frame; no stencil',async()=>{
 const f=index.fields.find(x=>x.fieldId==='field_cm26_01'),data=read(f.manifest);
 const sprites=[],graphics=[],loads=[],unloads=[];
 class Container{constructor(o){Object.assign(this,o);this.children=[];this.position={set:(x,y)=>{this.x=x;this.y=y;}};this.scale={set:v=>{}};}addChild(...c){this.children.push(...c);}destroy(){this.destroyed=true;}}
 class Sprite{constructor(t){this.texture=t;sprites.push(this);}destroy(){}}
 class Graphics{constructor(){graphics.push(this);}rect(){return this;}fill(){return this;}destroy(){}}
 class Rectangle{constructor(x,y,w,h){Object.assign(this,{x,y,width:w,height:h});}}
 class Texture{constructor({source,frame}){this.source=source;this.frame=frame;}}
 const atlas={width:data.atlas.width,height:data.atlas.height,source:{atlas:true}};
 const PIXI={Container,Sprite,Graphics,Rectangle,Texture,Assets:{load:async src=>{loads.push(src);return atlas;},unload:async src=>{unloads.push(src);}}};
 const placements=[{fieldId:'field_cm26_01',x:120,y:40}];
 const art={displayObject:{children:[]},field:{nativePixelWorldScale:4,wrapWidthPx:null},getDiagnostics:()=>({}),dispose:async()=>{}};
 const fetchImpl=async url=>{const p=new URL(url).pathname.slice(1);return {ok:fs.existsSync(new URL('../'+p,import.meta.url)),json:async()=>read(p)};};
 const result=await withCageForeground({PIXI,art,manifest,placements,location:{hostname:'127.0.0.1'},baseHref:'http://127.0.0.1/championship.html',fetchImpl});
 assert.equal(graphics.length,0);assert.deepEqual(loads,[data.atlas.src]);
 const d=result.getDiagnostics().foreground;assert.equal(d.atlasCount,1);assert.equal(d.additionalDecodedTextureBytes,data.atlas.width*data.atlas.height*4);
 assert.equal(d.spriteCount,data.objects.length);
 const plan=cageForegroundPlan(data,placements,{config:{fieldId:'field_cm26_01',stencilOnly:true,prefix:'x/',width:data.width,height:data.height,sourceHash:f.sourceHash,masterHash:f.masterHash}});
 const o=data.objects[0];assert.equal(sprites[0].texture.frame.x,o.atlasX);assert.equal(sprites[0].texture.frame.y,o.atlasY);
 assert.equal(plan[0].depth,40/4+o.depthNative);
 await result.dispose();assert.deepEqual(unloads,[data.atlas.src]);
 const remote=await withCageForeground({PIXI,art,manifest,placements,location:{hostname:'example.com'},fetchImpl:async()=>{throw Error('no fetch');}});
 assert.equal(remote,art);
});

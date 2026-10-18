// CM02 athletics goal net (local review 2026-10-19): stencil pieces over the
// padded runtime frame, depth from the goal footprint's front edge.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {cageForegroundPlan,withCageForeground} from '../src/championship/presentation/cageForeground.js';
const read=p=>JSON.parse(fs.readFileSync(new URL('../'+p,import.meta.url),'utf8'));
const data=read('assets/production/cage/cm02-goal-foreground-20261019/manifest.json');
const manifest=read('assets/production/public-runtime/cage-final.map.v1.json');
const placements=[{fieldId:'field_cm02_01',x:200,y:40,slotIndex:4}];

test('CM02 goal net binds the exact padded runtime frame and reviewed master',()=>{
 const field=manifest.fields.find(f=>f.fieldId==='field_cm02_01');
 assert.equal(field.frames[0].sha256,data.sourceComposite.sha256);
 assert.equal(data.masterSha256,'469b1a6f6d261938e19dba0f335dffcfdc245f4903bb26a4de4e766c3aa0ebe2');
 assert.equal(data.publicReleasePermitted,false);
 const changed=structuredClone(data);changed.masterSha256='0'.repeat(64);
 assert.throws(()=>cageForegroundPlan(changed,placements),/SOURCE_MISMATCH/);
});

test('mouth frame sits at the mouth; net strips follow the footprint front edge',()=>{
 const plan=cageForegroundPlan(data,placements);
 assert.equal(plan.length,data.objects.length);
 const mouth=plan.find(p=>p.id==='cm02-goal-mouth-frame');
 assert.ok(Math.abs(mouth.depth-(40/4+162))<0.01);
 const strips=data.objects.filter(o=>o.id.startsWith('cm02-goal-net-'));
 for(const o of strips){assert.ok(o.depthNative>=161.99&&o.depthNative<=189.01,o.id);
  for(const [x,y,w,h] of o.maskRects)assert.ok(x>=0&&y>=0&&x+w<=o.width&&y+h<=o.height,o.id);}
 const deepest=Math.max(...strips.map(o=>o.depthNative));
 assert.ok(deepest>188&&deepest<189.01,'strips between the rear posts take the rear edge');
 assert.equal(strips.reduce((n,o)=>n+o.opaquePixelCount,0)+data.objects[0].opaquePixelCount>15000,true);
});

test('padded tile: the stencil sprite is offset to the quad that starts before the placement',async()=>{
 const sprites=[];
 class Container{constructor(o){Object.assign(this,o);this.children=[];this.position={set:(x,y)=>{this.x=x;this.y=y;}};this.scale={set:v=>this.scaleValue=v};}
  addChild(...c){this.children.push(...c);}destroy(){this.destroyed=true;}}
 class Sprite{constructor(texture){this.texture=texture;this.x=0;this.y=0;sprites.push(this);}destroy(){}}
 class Graphics{constructor(){this.rects=[];}rect(...r){this.rects.push(r);return this;}fill(){return this;}destroy(){}}
 const base={label:'runtime map art field_cm02_01',x:200-32,y:40-32,texture:{source:{}},width:832,height:864};
 const art={displayObject:{children:[base]},field:{nativePixelWorldScale:4,wrapWidthPx:null},getDiagnostics:()=>({}),dispose:async()=>{}};
 const fetchImpl=async url=>({ok:String(url).endsWith('cm02-goal-foreground-20261019/manifest.json'),json:async()=>structuredClone(data)});
 const result=await withCageForeground({PIXI:{Container,Sprite,Graphics},art,manifest,placements,location:{hostname:'127.0.0.1'},
  baseHref:'http://127.0.0.1/championship.html',fetchImpl});
 assert.equal(result.getDiagnostics().foreground.spriteCount,data.objects.length);
 assert.ok(sprites.every(s=>s.x===-32&&s.y===-32&&s.width===832&&s.height===864));
 await result.dispose();
 const remote=await withCageForeground({PIXI:{Container,Sprite,Graphics},art,manifest,placements,location:{hostname:'example.com'},fetchImpl:async()=>{throw Error('no fetch');}});
 assert.equal(remote,art,'only the local runtime location loads the review net');
});

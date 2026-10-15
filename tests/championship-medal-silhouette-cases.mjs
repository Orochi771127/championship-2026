import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {inflateSync} from 'node:zlib';
import {traceMedalSilhouette,readMedalSilhouette,MEDAL_SILHOUETTE_LIMITS as LIMITS} from '../src/championship/presentation/medals/medalSilhouette.js';
import {originalMedalArt} from '../src/championship/presentation/completedOriginalUi20261007.js';
import {MEDAL_PRESENTATION_PROFILES} from '../src/championship/presentation/medals/medalPresentationProfiles.js';
import {createMedalGeometry} from '../src/championship/presentation/medals/medalGeometry.js';
const root=new URL('../',import.meta.url);
function pixels(width,height,predicate){const data=new Uint8ClampedArray(width*height*4);for(let y=0;y<height;y++)for(let x=0;x<width;x++)data[(y*width+x)*4+3]=predicate(x,y)?255:0;return {width,height,data};}
function png(path){const b=readFileSync(new URL(path,root)),width=b.readUInt32BE(16),height=b.readUInt32BE(20);assert.equal(b[24],8);assert.equal(b[25],6);assert.equal(b[28],0);const chunks=[];for(let p=8;p<b.length;){const n=b.readUInt32BE(p);if(b.toString('ascii',p+4,p+8)==='IDAT')chunks.push(b.subarray(p+8,p+8+n));p+=n+12;}const packed=inflateSync(Buffer.concat(chunks)),stride=width*4,data=new Uint8Array(width*height*4);const paeth=(a,b,c)=>{const p=a+b-c,pa=Math.abs(p-a),pb=Math.abs(p-b),pc=Math.abs(p-c);return pa<=pb&&pa<=pc?a:pb<=pc?b:c;};for(let y=0;y<height;y++)for(let x=0;x<stride;x++){const i=y*stride+x,type=packed[y*(stride+1)],a=x>=4?data[i-4]:0,b=y?data[i-stride]:0,c=y&&x>=4?data[i-stride-4]:0;data[i]=(packed[y*(stride+1)+x+1]+[0,a,b,Math.floor((a+b)/2),paeth(a,b,c)][type])&255;}return {width,height,data};}
const contains=(points,x,y)=>{let inside=false;for(let i=0,j=points.length-1;i<points.length;j=i++){const a=points[i],b=points[j];if((a[1]>y)!==(b[1]>y)&&x<(b[0]-a[0])*(y-a[1])/(b[1]-a[1])+a[0])inside=!inside;}return inside;};
function covered(s,x,y){const longest=Math.max(s.width,s.height),wx=(x/s.width-.5)*s.width/longest*2.28,wy=(.5-y/s.height)*s.height/longest*2.28;return s.shapes.some(shape=>contains(shape.outer,wx,wy)&&!shape.holes.some(h=>contains(h,wx,wy)));}
const bounds=s=>{const points=s.shapes.flatMap(shape=>shape.outer);return [Math.min(...points.map(p=>p[0])),Math.min(...points.map(p=>p[1])),Math.max(...points.map(p=>p[0])),Math.max(...points.map(p=>p[1]))];};

test('rectangle aspect and original source padding are preserved, not circularized or tight-cropped',()=>{
 const s=traceMedalSilhouette(pixels(80,40,(x,y)=>x>=8&&x<72&&y>=4&&y<36));assert.equal(s.ok,true);assert.equal(s.shapes[0].outer.length,4);assert.deepEqual(bounds(s).map(x=>+x.toFixed(4)),[-.912,-.456,.912,.456]);
});
test('round artwork naturally retains a round perimeter',()=>{
 const s=traceMedalSilhouette(pixels(128,128,(x,y)=>(x-63.5)**2+(y-63.5)**2<50**2));assert.equal(s.ok,true);const radii=s.shapes[0].outer.map(p=>Math.hypot(...p));assert.ok(Math.max(...radii)-Math.min(...radii)<.025);assert.ok(s.shapes[0].outer.length>32);
});
test('concavity, holes, disconnected ornaments, and thin strings survive without a convex hull',()=>{
 const s=traceMedalSilhouette(pixels(100,100,(x,y)=>
   (x>=10&&x<40&&y>=10&&y<90&&!(x>=20&&x<30&&y>=20&&y<40))||
   (x>=10&&x<85&&y>=70&&y<90)||
   (x===50&&y>=5&&y<90)||
   (x>=80&&x<86&&y>=10&&y<16)));
 assert.equal(s.ok,true);assert.equal(s.stats.holes,1);assert.equal(s.stats.components,2);assert.equal(covered(s,25,30),false);assert.equal(covered(s,60,40),false);assert.equal(covered(s,50.5,8),true);assert.equal(covered(s,82,12),true);
});
test('diagonally touching islands stay separate and nesting preserves an island inside a hole',()=>{
 const s=traceMedalSilhouette(pixels(40,40,(x,y)=>(x>=2&&x<7&&y>=2&&y<7)||(x>=7&&x<12&&y>=7&&y<12)||(x>=15&&x<38&&y>=2&&y<38&&!(x>=19&&x<34&&y>=6&&y<34))||(x>=23&&x<30&&y>=14&&y<26)));
 assert.equal(s.ok,true);assert.equal(s.stats.components,4);assert.equal(s.stats.holes,1);assert.equal(covered(s,20,12),false);assert.equal(covered(s,26,20),true);
});
test('isolated sub-four-pixel alpha dust is filtered without removing small meaningful pieces',()=>{
 const s=traceMedalSilhouette(pixels(64,64,(x,y)=>(x>=20&&x<44&&y>=20&&y<44)||(x>=4&&x<6&&y>=4&&y<6)||(x===60&&y===60)));
 assert.equal(s.ok,true);assert.equal(s.stats.components,2);assert.equal(s.stats.removedPixels,1);assert.equal(covered(s,4.5,4.5),true);assert.equal(covered(s,60.5,60.5),false);
});
test('empty, invalid, oversized and overly fragmented alpha fail closed instead of inventing a coin',()=>{
 for(const input of [undefined,{},pixels(16,16,()=>false),{width:1025,height:1,data:new Uint8Array(4100)},pixels(256,256,(x,y)=>x%4<2&&y%4<2)]){const s=traceMedalSilhouette(input);assert.equal(s.ok,false);assert.deepEqual(s.shapes,[]);}
});
test('alpha reads are one bounded canvas operation and unreadable/tainted images use static fallback',()=>{
 let draws=0,reads=0;const canvas={getContext:()=>({drawImage(){draws++;},getImageData(){reads++;return pixels(8,4,()=>true);}})},doc={createElement:()=>canvas};
 assert.equal(readMedalSilhouette({naturalWidth:8,naturalHeight:4},doc).ok,true);assert.equal(draws,1);assert.equal(reads,1);assert.equal(canvas.width,1);assert.equal(canvas.height,1);
 for(const getContext of [()=>null,()=>{throw Error('SecurityError');},()=>({drawImage(){throw Error('SecurityError');}})])assert.equal(readMedalSilhouette({width:8,height:4},{createElement:()=>({getContext})}).ok,false);
 assert.equal(readMedalSilhouette({width:2048,height:2048},doc).ok,false);assert.equal(draws,1);
});
test('all24 actual512px generated PNG silhouettes stay bounded, preserve key opaque pixels and build finite real meshes',()=>{
 const manifest=JSON.parse(readFileSync(new URL('assets/production/medal-name-corrections-20261014/manifest.json',root))),entries=manifest.medals.filter(row=>row.detailSrc);assert.equal(entries.length,24);
 for(const entry of entries){const input=png(entry.detailSrc),s=traceMedalSilhouette(input);assert.equal(s.ok,true,`${entry.titleId}: ${s.reason}`);assert.ok(s.stats.vertices<=LIMITS.maxVertices);assert.ok(s.stats.components<=LIMITS.maxLoops);assert.ok(s.sampleWidth<=LIMITS.sampleSide&&s.sampleHeight<=LIMITS.sampleSide);
   let total=0,matched=0;for(let y=4;y<input.height-4;y+=4)for(let x=4;x<input.width-4;x+=4){if(input.data[(y*input.width+x)*4+3]<245)continue;total++;if(covered(s,x+.5,y+.5))matched++;}assert.ok(matched/total>.97,`${entry.titleId} opaque coverage ${matched}/${total}`);
   const m=createMedalGeometry({silhouette:s,presentationProfile:{shape:'free',material:'gold'}}),base=m.group.getObjectByName('metal_base'),position=base.geometry.getAttribute('position');assert.ok(position.count<100000);assert.ok([...position.array].every(Number.isFinite));assert.equal(m.group.children.length,2);m.dispose();
 }
});


test('all61 source-alpha medals preserve actual128/512px contours and triangulate holes without losing cap area',()=>{
 const free=MEDAL_PRESENTATION_PROFILES.filter(p=>p.shape==='free');assert.equal(free.length,61);
 const polygonArea=points=>Math.abs(points.reduce((sum,a,i)=>{const b=points[(i+1)%points.length];return sum+a[0]*b[1]-b[0]*a[1];},0)/2);
 for(const profile of free){const art=originalMedalArt(profile.titleId,'http://127.0.0.1:8766/championship.html'),input=png(art.detailSrc??art.src),s=traceMedalSilhouette(input);assert.equal(s.ok,true,`${profile.titleId}: ${s.reason}`);
   const m=createMedalGeometry({silhouette:s,presentationProfile:profile}),g=m.group.getObjectByName('metal_base').geometry,p=g.getAttribute('position'),n=g.getAttribute('normal');let capArea=0;
   for(const attribute of Object.values(g.attributes))assert.ok(attribute.array.every(Number.isFinite));
   let opaque=0,matched=0;for(let y=1;y<input.height-1;y+=2)for(let x=1;x<input.width-1;x+=2){if(input.data[(y*input.width+x)*4+3]<245)continue;opaque++;if(covered(s,x+.5,y+.5))matched++;}
   assert.ok(matched/opaque>.99,`${profile.titleId} opaque coverage ${matched}/${opaque}`);
   for(let i=0;i<p.count;i+=3)if(n.getZ(i)>.99&&n.getZ(i+1)>.99&&n.getZ(i+2)>.99)capArea+=Math.abs((p.getX(i+1)-p.getX(i))*(p.getY(i+2)-p.getY(i))-(p.getX(i+2)-p.getX(i))*(p.getY(i+1)-p.getY(i)))/2;
   const silhouetteArea=s.shapes.reduce((sum,shape)=>sum+polygonArea(shape.outer)-shape.holes.reduce((area,hole)=>area+polygonArea(hole),0),0);
   assert.ok(Math.abs(capArea-silhouetteArea)/silhouetteArea<.01,`${profile.titleId} cap area ${capArea} versus silhouette ${silhouetteArea}`);assert.ok(p.count<100000);m.dispose();
 }
});

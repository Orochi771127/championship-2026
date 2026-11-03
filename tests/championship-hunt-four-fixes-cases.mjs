// Hunt four fixes (Owner 2026-11-03): no ??? target card, a bound partner is
// pulled from anywhere and never freezes, HD-2D two-layer shadows, and no
// partner slides on one drawing while it walks, runs or struggles.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {HUNT_EQUIPMENT_ITEMS,HUNT_MEMORY_CARDS} from '../src/championship/hunt/loadout/huntEquipmentCatalog.js';
import {HUNT_FIELD_WATCHDOG} from '../src/championship/hunt/capture/nativeHuntFieldControls.js';
import {createHuntActorMotion,stepHuntActorMotion,HUNT_ACTOR_MOTION} from '../src/championship/presentation/vs2/huntActorMotion.js';
import {huntContactEnvelope,huntSoftContactVertices,huntCastShadowReach,huntCastShadowVertices,HUNT_ACTOR_SHADOW} from '../src/championship/presentation/vs2/huntThree/actorShadows.mjs';
import {reviewedNumericClip,reviewedHuntMotionClip,reviewedClipDrawings} from '../src/championship/presentation/reviewedCharacterAnimation.js';
import {auditHuntMotionBindings} from '../scripts/qa/hunt-motion-binding-audit.mjs';

const catalog=JSON.parse(fs.readFileSync('src/data/championship/catalogs/creature-species.r1.json','utf8'));
const cages=JSON.parse(fs.readFileSync('docs/contracts/championship/raising-home-presentation.v1.json','utf8')).cages;
const FRAME=1000*560190/33513982;
const ROPE=HUNT_EQUIPMENT_ITEMS.find(i=>i.equipmentClass==='ROPE');

async function huntWithRope(){
  const saved=new Map(),storage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
  const app=createChampionshipStandaloneApp({storage,catalog,cages,rngClock:()=>({hour:13,minute:20,second:50}),
    huntStartingInventory:[{itemId:ROPE.itemId,quantity:1},{itemId:HUNT_MEMORY_CARDS[0].itemId,quantity:1}]});
  await app.newGame();app.openGate();app.selectGate(app.getGates().find(g=>g.biomeId==='Grass').gateId);app.confirmGate();
  app.selectHuntEquipment('ROPE',ROPE.itemId);await app.beginHunt();
  const runtime=app.getHuntRuntime();assert.equal(runtime.selectTool('ROPE'),true);
  return {app,runtime};
}
const tick=(runtime,n=1)=>{for(let i=0;i<n;i++)runtime.tick(FRAME);};
const wild=(runtime,id)=>runtime.getWildCreatures().find(w=>w.wildId===id);
// Draw a closed loop round a partner, one sample per native tick, as a finger would.
function lasso(runtime,target){
  const cx=target.worldX,cy=target.worldY-20,r=70;
  runtime.toolPointerDown(cx+r,cy);tick(runtime);
  for(let i=1;i<=40;i++){const a=i/36*Math.PI*2;runtime.toolPointerMove(cx+Math.cos(a)*r,cy+Math.sin(a)*r);tick(runtime);}
  runtime.toolPointerUp(cx+r,cy);tick(runtime,30);
}
async function boundPartner(){
  const hunt=await huntWithRope();
  for(const candidate of hunt.runtime.getWildCreatures()){
    const now=wild(hunt.runtime,candidate.wildId);if(!now)continue;
    lasso(hunt.runtime,now);
    if(wild(hunt.runtime,candidate.wildId)?.bound)return {...hunt,wildId:candidate.wildId};
  }
  await hunt.app.dispose();
  throw new Error('no partner could be lassoed in the fixture');
}

test('the hunt screen builds no ??? target card and no tap-to-inspect capsule',()=>{
  const screen=fs.readFileSync('src/championship/app/vs2Screens.js','utf8');
  assert.equal(/element\(\s*["']section["']\s*,\s*["']cm-vs2-target["']/.test(screen),false);
  assert.equal(screen.includes("'輕觸夥伴查看'"),false,'no capsule text is rendered');
  assert.equal(screen.includes('hud.target'),false,'no target readout is painted');
  for(const file of ['src/championship/app/huntMobile.css','src/championship/app/vs2Styles.css','src/championship/app/nativeUiSkin.css','src/championship/app/ui/screenLayout.css'])
    assert.equal(fs.readFileSync(file,'utf8').includes('cm-vs2-target'),false,file);
});

test('a bound partner is pulled from anywhere on the field until it is down and ready for the hand',async()=>{
  const {app,runtime,wildId}=await boundPartner();
  try{
    const start=wild(runtime,wildId);assert.equal(start.bound,true);
    let pulls=0;
    while(wild(runtime,wildId)?.currentHp>0&&pulls<20){
      const now=wild(runtime,wildId);if(!now)break;
      if(!now.bound){lasso(runtime,now);continue;}
      // Far from the partner's body: 300 world px to the side of it.
      const fx=now.worldX+300,fy=now.worldY+120;
      assert.equal(runtime.toolPointerDown(fx,fy),true);
      assert.equal(runtime.getToolState().rope?.wildId,wildId,'the press took hold of the bound partner');
      for(let i=0;i<60&&runtime.getToolState().rope;i++){runtime.toolPointerMove(fx+80,fy+60);tick(runtime);}
      runtime.toolPointerUp(fx+80,fy+60);tick(runtime,20);pulls++;
    }
    for(let i=0;i<600&&wild(runtime,wildId)?.state!=='HAND_READY';i++)tick(runtime);
    const end=wild(runtime,wildId);
    assert.ok(end.currentHp<start.currentHp,'pulling from afar wears the partner down');
    assert.equal(end.state,'HAND_READY',`downed after ${pulls} pulls`);
  }finally{await app.dispose();}
});

test('a bound partner nobody pulls slips its loop after 3 seconds and runs on',async()=>{
  const {app,runtime,wildId}=await boundPartner();
  try{
    assert.equal(wild(runtime,wildId).bound,true);
    tick(runtime,HUNT_FIELD_WATCHDOG.boundIdleTicks+2);
    const after=wild(runtime,wildId);
    assert.equal(after.bound,false,'the loop slips');
    assert.ok([after.worldX,after.worldY,after.currentHp].every(Number.isFinite));
    assert.ok(after.nativeAnimation?.contract,'it keeps a live animation frame');
  }finally{await app.dispose();}
});

test('non-finite pointer input is ignored and every partner stays finite and keeps moving',async()=>{
  const {app,runtime}=await huntWithRope();
  try{
    assert.equal(runtime.toolPointerDown(NaN,10),false);
    const first=runtime.getWildCreatures().map(w=>[w.wildId,w.worldX,w.worldY]);
    tick(runtime,600);
    const moved=runtime.getWildCreatures().filter(w=>{const was=first.find(f=>f[0]===w.wildId);return was&&(was[1]!==w.worldX||was[2]!==w.worldY);});
    for(const w of runtime.getWildCreatures())assert.ok([w.worldX,w.worldY,w.worldZ].every(Number.isFinite));
    assert.ok(moved.length>0,'ten seconds in, partners have moved');
  }finally{await app.dispose();}
});

test('a partner moving on one unchanged drawing hops; one changing drawings does not',()=>{
  const still=createHuntActorMotion(),animated=createHuntActorMotion();
  let hopped=0,animatedHops=0;
  for(let i=0;i<120;i++){
    const t=i*16.7,x=100+i*0.8;
    if(stepHuntActorMotion(still,{now:t,dt:16.7,worldX:x,worldY:50,textureKey:'one',aiState:2}).hop)hopped++;
    if(stepHuntActorMotion(animated,{now:t,dt:16.7,worldX:x,worldY:50,textureKey:`f${Math.floor(t/150)}`,aiState:2}).hop)animatedHops++;
  }
  assert.ok(hopped>60,'the one-drawing walker hops');assert.equal(animatedHops,0);
  const stopped=createHuntActorMotion();
  for(let i=0;i<60;i++)assert.equal(stepHuntActorMotion(stopped,{now:i*16.7,dt:16.7,worldX:5,worldY:5,textureKey:'one',aiState:1}).hop,false);
});

test('bound partners shake, runners lean and kick dust, reduced motion stays still',()=>{
  const bound=createHuntActorMotion(),runner=createHuntActorMotion(),calm=createHuntActorMotion();
  const shifts=new Set();let dust=0,lean=0;
  for(let i=0;i<60;i++){
    const t=i*16.7;
    const b=stepHuntActorMotion(bound,{now:t,dt:16.7,worldX:10,worldY:10,textureKey:'a',aiState:8,bound:true});
    shifts.add(Math.sign(Math.round(b.offsetX*10)));assert.equal(b.mood,'struggle');
    const r=stepHuntActorMotion(runner,{now:t,dt:16.7,worldX:10+i*2,worldY:10,textureKey:`f${i>>3}`,aiState:3});
    if(r.dust)dust++;lean=r.lean;
    const c=stepHuntActorMotion(calm,{now:t,dt:16.7,worldX:10+i*2,worldY:10,textureKey:'one',aiState:3,reducedMotion:true});
    assert.deepEqual([c.offsetX,c.offsetY,c.lean,c.hop],[0,0,0,false]);
  }
  assert.ok(shifts.has(1)&&shifts.has(-1),'the struggle shakes both ways');
  const downed=stepHuntActorMotion(createHuntActorMotion(),{now:0,dt:16.7,worldX:1,worldY:1,textureKey:'a',aiState:11,bound:true,handReady:true});
  assert.equal(downed.mood,'stunned','a partner ready for the hand shows stars, not sweat');assert.equal(downed.offsetX,0);
  assert.ok(dust>=5,'a runner kicks up dust');assert.ok(lean>HUNT_ACTOR_MOTION.lean*0.8,'and leans into the run');
});

test('the contact shadow is one feathered ellipse: dark centre, clear rim',()=>{
  const envelope=huntContactEnvelope([{x:-7,y:0.5,radiusX:5,radiusY:2},{x:6.5,y:1.5,radiusX:5,radiusY:2}]);
  assert.ok(envelope.radiusX>12&&envelope.radiusX<20);
  const soft=huntSoftContactVertices(envelope,(x,y)=>[x,0,y]);
  const alphas=soft.colors.filter((_,i)=>i%4===3);
  assert.equal(Math.max(...alphas),1);assert.equal(Math.min(...alphas),0);
  assert.equal(soft.positions.length/3,alphas.length);
  assert.ok(HUNT_ACTOR_SHADOW.contactOpacity<=0.45);
});

test('the cast silhouette follows the sun and grows with height above the ground',()=>{
  const sun={position:{x:-30,y:65,z:40},target:{position:{x:0,y:0,z:0}}};
  const reach=huntCastShadowReach(sun);
  assert.ok(reach[0]>0&&reach[1]<0,'light from -x/+z falls toward +x/-z');
  // A card facing the camera along +x, foot at (1, 2, 3); the sun runs nearly along it.
  const card=[[0,4,3],[0,2,3],[2,2,3],[2,4,3]],shadow=huntCastShadowVertices(card,[1,2,3],2,reach);
  const at=i=>shadow.slice(i*3,i*3+3);
  assert.ok(at(1).every(Number.isFinite)&&Math.abs(at(1)[1]-2.0002)<1e-9,'the feet stay on the ground');
  const across=[at(2)[0]-at(1)[0],at(2)[2]-at(1)[2]];
  assert.ok(Math.abs(across[0]*reach[0]+across[1]*reach[1])<1e-9,'the shadow turns its width across the light');
  assert.ok(Math.abs(Math.hypot(...across)-2)<1e-9,'and keeps the partner width');
  const lift=[at(0)[0]-at(1)[0],at(0)[2]-at(1)[2]];
  assert.ok(Math.abs(lift[0]-2*reach[0])<1e-9&&Math.abs(lift[1]-2*reach[1])<1e-9,'the head end lies along the sun by its height');
  const low=huntCastShadowReach({position:{x:100,y:1,z:0},target:{position:{x:0,y:0,z:0}}});
  assert.ok(Math.hypot(...low)<=HUNT_ACTOR_SHADOW.castMaxReach+1e-9,'a low sun cannot stretch a partner across the map');
});

test('a one-drawing reviewed weak walk plays the same character\'s animated walk in Hunt',()=>{
  const selection=JSON.parse(fs.readFileSync('src/data/championship/reviewed-animation-selection.v1.json','utf8'));
  const ma=selection.characters.find(c=>c.displayCode==='MA04');
  const document=JSON.parse(fs.readFileSync(ma.path,'utf8'));
  assert.equal(reviewedClipDrawings(reviewedNumericClip(document,'main',12).clip),1);
  const hunt=reviewedHuntMotionClip(document,'main',12);
  assert.ok(reviewedClipDrawings(hunt.clip)>1);assert.equal(hunt.clip.loop,true);
  assert.equal(reviewedHuntMotionClip(document,'main',0).clip,reviewedNumericClip(document,'main',0).clip,'idle keeps its own clip');
});

test('all 232 partners: every walk, run and struggle in Hunt is animated or covered by the hop/shake layer',()=>{
  const report=auditHuntMotionBindings();
  assert.equal(report.summary.partners,232);
  for(const row of report.rows){
    if(row.status==='NO_HUNT_BODY')continue;
    for(const sequence of row.sequences){
      assert.equal(sequence.missing,undefined,`${row.displayCode} ${sequence.id}`);
      assert.ok(['ANIMATED','HOP','SHAKE'].includes(sequence.result),`${row.displayCode} ${sequence.id}`);
      if(sequence.result==='SHAKE')assert.ok([20,21].includes(sequence.id));
    }
  }
  assert.ok(report.summary.afterAnimated>=report.summary.huntBodies/2);
});

test('expanded hunt maps steer on every tile, so an escaping partner never freezes the field',async()=>{
  const {createNativeHuntEnvironment}=await import('../src/championship/hunt/capture/nativeHuntSceneSources.js');
  const {steerNativeHuntDirectionCell}=await import('../src/championship/hunt/capture/nativeHuntMovement.js');
  const expansions=JSON.parse(fs.readFileSync('src/data/championship/catalogs/hunt-art-expansions-20261023.json','utf8')).environments;
  let maps=0;
  for(const [fieldId,data] of Object.entries(expansions)){
    const environment=createNativeHuntEnvironment(data);maps++;
    for(let y=0;y<environment.height;y++)for(let x=0;x<environment.width;x++){
      const cell=environment.readDirectionCell(x,y);
      assert.ok([0x1000,0x59a,0xcd].includes(cell.blendQ12),`${fieldId} ${x},${y}`);
      steerNativeHuntDirectionCell([0,4096,0],cell);
    }
  }
  assert.equal(maps,21);
});

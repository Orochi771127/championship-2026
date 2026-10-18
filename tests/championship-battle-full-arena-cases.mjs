import test from 'node:test';
import assert from 'node:assert/strict';
import {createBattleFxCamera,clampBattleCameraToMap} from '../src/championship/presentation/battleFx/battleFxCamera.js';

const art={x:0,y:0,width:1664,height:1088};
const subject={slot:0,down:false,left:1100,top:250,right:1420,bottom:800};
const project=(p,x,y)=>({x:x*p.zoom+p.x,y:y*p.zoom+p.y});
function inside(p,viewport,box){
  const a=project(p,box.left,box.top),b=project(p,box.right,box.bottom);
  assert.ok(a.x>=-1e-8&&a.y>=-1e-8&&b.x<=viewport.width+1e-8&&b.y<=viewport.height+1e-8,JSON.stringify({p,a,b,viewport}));
}
test('full arena retains every map edge through repeated rotation, focus, impacts and prelude-sized subjects',()=>{
  const camera=createBattleFxCamera({responsiveLayout:true,fullArena:true});
  const subjects=[subject,{slot:3,down:false,left:-40,top:-90,right:320,bottom:300}];
  for(const viewport of [{width:390,height:251},{width:641,height:338},{width:1086,height:716},{width:320,height:205},{width:400,height:268},{width:390,height:251},{width:641,height:338}]){
    camera.sequence([{slots:[0],boost:.7,durationMs:1000}]);camera.punch(.14);camera.shake(1);camera.impact('heavy');
    const p=camera.update({dtMs:0,viewport,art,subjects,points:[{x:1750,y:1000}]});
    inside(p,viewport,{left:0,top:0,right:1664,bottom:1088});
    for(const body of subjects)inside(p,viewport,body);
    inside(p,viewport,{left:1738,top:988,right:1762,bottom:1012});
    assert.equal(p.punch,0);assert.equal(p.trauma,0);
    assert.deepEqual(camera.getState().stages,[]);
    // One uniform scale and a reversible coordinate transform for pointers/VFX.
    const local={x:800,y:600},screen=project(p,local.x,local.y);
    assert.ok(Math.abs((screen.x-p.x)/p.zoom-local.x)<1e-8);
    assert.ok(Math.abs((screen.y-p.y)/p.zoom-local.y)<1e-8);
  }
});
test('empty full arena uses the largest possible contain scale and plain remaining space',()=>{
  const camera=createBattleFxCamera({fullArena:true});
  for(const viewport of [{width:390,height:251},{width:641,height:338},{width:1086,height:716}]){
    const p=camera.update({dtMs:16,viewport,art,subjects:[]});
    assert.equal(p.zoom,Math.min(viewport.width/art.width,viewport.height/art.height));
    inside(p,viewport,{left:0,top:0,right:1664,bottom:1088});
    const left=project(p,0,0),right=project(p,1664,1088);
    assert.ok(Math.abs(left.x-(viewport.width-right.x))<1e-8);
    assert.ok(Math.abs(left.y-(viewport.height-right.y))<1e-8);
  }
});

test('bounded dynamic camera covers every interpolated frame during edge engagements, impacts and rotation',()=>{
  const camera=createBattleFxCamera({responsiveLayout:true,boundedMap:true});
  const zooms=[],art={x:0,y:0,width:1664,height:1088};
  let steps=0,impactSeen=false;
  for(const viewport of [{width:390,height:472},{width:641,height:338},{width:1086,height:716},{width:320,height:304},{width:400,height:268},{width:390,height:472}]){
    for(let i=0;i<160;i++){
      const cx=150+1360*i/159,cy=200+650*i/159;
      const subjects=[{slot:0,team:0,engaged:true,down:false,left:cx-70,right:cx+10,top:cy-140,bottom:cy},
        {slot:3,team:1,engaged:true,down:false,left:cx+20,right:cx+100,top:cy-130,bottom:cy}];
      if(i===0)camera.focus([0,3],650,.4);
      if(i%19===0)camera.impact('heavy');
      const p=camera.update({dtMs:[0,8,16.7,33][i%4],viewport,art,subjects});
      const a=project(p,0,0),b=project(p,1664,1088);
      assert.ok(a.x<=1e-7&&a.y<=1e-7&&b.x>=viewport.width-1e-7&&b.y>=viewport.height-1e-7,JSON.stringify({p,a,b,viewport,i}));
      for(const subject of subjects)inside(p,viewport,subject);
      zooms.push(p.zoom);impactSeen ||= p.punch>0;steps++;
    }
  }
  assert.equal(steps,960);assert.ok(impactSeen);assert.ok(Math.max(...zooms)>Math.min(...zooms)*1.1);
});
test('composed native zoom clamps to the true map and reprojects its anchor',()=>{
  const viewport={width:390,height:472},art={x:0,y:0,width:1664,height:1088},anchor={x:1600,y:1040};
  for(const transform of [{zoom:.01,x:500,y:600},{zoom:2,x:10000,y:-10000},{zoom:.7,x:-1300,y:80}]){
    const p=clampBattleCameraToMap({viewport,art,transform,anchor});
    const a=project(p,0,0),b=project(p,1664,1088);
    assert.ok(a.x<=1e-8&&a.y<=1e-8&&b.x>=390-1e-8&&b.y>=472-1e-8);
    assert.equal(p.anchorX,anchor.x*p.zoom+p.x);assert.equal(p.anchorY,anchor.y*p.zoom+p.y);
  }
});
test('scattered squads retain real positions while the active opposing pair gets priority',()=>{
  const camera=createBattleFxCamera({responsiveLayout:true,boundedMap:true}),viewport={width:390,height:472};
  const subjects=[
    {slot:0,team:0,engaged:true,left:700,right:780,top:400,bottom:550},
    {slot:3,team:1,engaged:true,left:800,right:880,top:410,bottom:550},
    {slot:1,team:0,left:0,right:70,top:0,bottom:130},
    {slot:4,team:1,left:1590,right:1660,top:950,bottom:1080}
  ];
  const before=JSON.stringify(subjects),p=camera.update({dtMs:16,viewport,art,subjects});
  assert.deepEqual(p.framedSlots,[0,3]);assert.equal(JSON.stringify(subjects),before);
  inside(p,viewport,subjects[0]);inside(p,viewport,subjects[1]);
});

test('wide animated cells remain framed even when native rest-body geometry is narrow',()=>{
  const viewport={width:390,height:472},camera=createBattleFxCamera({responsiveLayout:true,boundedMap:true});
  const visual={left:950,right:1500,top:300,bottom:720};
  const subjects=[{slot:0,team:0,engaged:true,left:1180,right:1220,top:600,bottom:720,framingBounds:visual},
    {slot:3,team:1,engaged:true,left:1100,right:1150,top:600,bottom:720}];
  camera.focus([0,3],1000,.4);
  for(let i=0;i<60;i++){const p=camera.update({dtMs:16.7,viewport,art,subjects});inside(p,viewport,visual);}
});

test('near-capacity subjects lose padding before feasible bodies are cropped',()=>{
  const viewport={width:390,height:472},box={left:418.54296875,right:1313.94921875,top:370,bottom:595};
  const p=clampBattleCameraToMap({viewport,art,box,transform:{zoom:472/1088,x:-166.58,y:0}});
  inside(p,viewport,box);
});

test('a pair too far apart at cover follows the active combatant instead of empty midpoint',()=>{
  const camera=createBattleFxCamera({responsiveLayout:true,boundedMap:true}),viewport={width:390,height:472};
  const subjects=[{slot:0,team:0,engaged:true,left:50,right:150,top:100,bottom:250},
    {slot:3,team:1,left:1500,right:1600,top:850,bottom:1000}];
  const p=camera.update({dtMs:16,viewport,art,subjects});
  assert.deepEqual(p.framedSlots,[0]);inside(p,viewport,subjects[0]);
});

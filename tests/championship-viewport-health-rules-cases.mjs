import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';

// The browser run (scripts/qa/run-full-viewport-health-check.cjs) only measures; every
// pass/fail decision lives in the pure rules module, so the thresholds are pinned here.
const require=createRequire(import.meta.url);
const {VIEWPORTS,GATES,THRESHOLDS,area,intersect,overlaps,uncoveredRatio,evaluateState,summarize}=require('../scripts/qa/viewport-health-rules.cjs');
const {SLICES}=require('../scripts/qa/viewport-health-slices.cjs');

const rect=(left,top,width,height)=>({left,top,right:left+width,bottom:top+height});
const landscape=VIEWPORTS.find(v=>v.id==='landscape-pro');
const portrait=VIEWPORTS.find(v=>v.id==='portrait-pro');
function raw(extra={}){
 return {viewport:{width:844,height:390},document:{scrollWidth:844,bodyScrollWidth:844},interactive:[],groups:{},primary:[],mustSee:[],lists:[],...extra};
}
function item(uid,box,extra={}){
 return {uid,chain:[],label:uid,selector:`#${uid}`,visible:box,fullyInViewport:true,viewportFraction:1,hiddenFraction:1,coverSamples:0,...extra};
}
const codes=findings=>findings.map(f=>f.code);

test('the six brief viewports keep their exact sizes, kinds and notch insets',()=>{
 assert.deepEqual(VIEWPORTS.map(v=>[v.id,v.width,v.height,v.kind]),[
  ['desktop-fhd',1920,1080,'desktop'],['desktop-laptop',1366,768,'desktop'],
  ['portrait-pro',390,844,'portrait'],['portrait-se',375,667,'portrait'],
  ['landscape-pro',844,390,'landscape'],['landscape-se',667,375,'landscape']]);
 assert.deepEqual({...portrait.safeArea},{top:47,right:0,bottom:34,left:0});
 assert.deepEqual({...landscape.safeArea},{top:0,right:47,bottom:21,left:47});
 assert.deepEqual(GATES,{OVERLAP:1,CLIPPING:2,ADAPTIVE:3,WIRING:4,TOUCH:5});
 assert.equal(THRESHOLDS.minTargetPx,40);
 assert.equal(THRESHOLDS.landscapeStageRatio,0.55);
 assert.ok(Object.isFrozen(VIEWPORTS)&&Object.isFrozen(THRESHOLDS));
});

test('the five slices run in the brief order and name their evidence states',()=>{
 assert.deepEqual(Object.keys(SLICES),['1','2','3','4','5']);
 for(const slice of Object.values(SLICES)){
  assert.equal(typeof slice.run,'function');
  assert.ok(slice.title.length>4);
  assert.ok(slice.evidence.length>=3,slice.title);
 }
});

test('geometry helpers ignore hairline contact and measure uncovered stage area',()=>{
 assert.equal(intersect(rect(0,0,10,10),rect(10,0,10,10)),null);
 assert.deepEqual(intersect(rect(0,0,10,10),rect(5,5,10,10)),{left:5,top:5,right:10,bottom:10});
 assert.equal(area(null),0);
 assert.equal(overlaps(rect(0,0,40,40),rect(38,0,40,40)),false,'a 2 px seam is contact, not a collision');
 assert.equal(overlaps(rect(0,0,40,40),rect(36,0,40,40)),true);
 assert.equal(overlaps(rect(0,0,40,40),rect(0,37,3,3)),false,'a 3×3 nick stays under the area floor');
 assert.equal(uncoveredRatio(rect(0,0,60,60),[rect(0,0,60,60)]),0);
 assert.equal(uncoveredRatio(rect(0,0,60,60),[]),1);
 assert.equal(uncoveredRatio(rect(0,0,60,60),[rect(0,0,30,60)]),0.5);
 assert.equal(uncoveredRatio(rect(0,0,0,0),[]),0);
});

test('a missing measurement is a wiring failure, never a silent pass',()=>{
 assert.deepEqual(codes(evaluateState(null,{viewport:landscape})),['PROBE_FAILED']);
 assert.deepEqual(codes(evaluateState({error:'navigation'},{viewport:landscape})),['PROBE_FAILED']);
});

test('gate 5 flags horizontal page overflow beyond one pixel',()=>{
 assert.deepEqual(codes(evaluateState(raw({document:{scrollWidth:845,bodyScrollWidth:844}}),{viewport:landscape})),[]);
 const wide=evaluateState(raw({document:{scrollWidth:844,bodyScrollWidth:900,widest:'.cm-row'}}),{viewport:landscape});
 assert.deepEqual(codes(wide),['OVERFLOW_X']);
 assert.equal(wide[0].gate,GATES.TOUCH);
});

test('gate 1 reports colliding controls but not nesting, scroll-under content or tessellated cells',()=>{
 const a=item('a',rect(0,0,80,40)),b=item('b',rect(60,0,80,40));
 assert.deepEqual(codes(evaluateState(raw({interactive:[a,b]}),{viewport:landscape})),['OVERLAP']);
 const child=item('c',rect(10,0,40,40),{chain:['a']});
 assert.deepEqual(codes(evaluateState(raw({interactive:[a,child]}),{viewport:landscape})),[]);
 assert.deepEqual(codes(evaluateState(raw({interactive:[a,b],scrollUnderPairs:['b|a']}),{viewport:landscape})),[]);
 const hexA=item('h1',rect(0,0,60,52),{family:'hex'}),hexB=item('h2',rect(45,0,60,52),{family:'hex'});
 assert.deepEqual(codes(evaluateState(raw({interactive:[hexA,hexB]}),{viewport:landscape})),[],'a quarter-shared bounding box is the honeycomb');
 const hexC=item('h3',rect(10,0,60,52),{family:'hex'});
 assert.deepEqual(codes(evaluateState(raw({interactive:[hexA,hexC]}),{viewport:landscape})),['OVERLAP']);
 const ignored=item('b',rect(60,0,80,40),{matches:['.cm-hunt-rope-swap']});
 assert.deepEqual(codes(evaluateState(raw({interactive:[a,ignored]}),{viewport:landscape,spec:{ignore:['.cm-hunt-rope-swap']}})),[]);
});

test('gate 1 needs three hit samples on a fully shown control before calling it covered',()=>{
 const covered=item('k',rect(0,0,60,40),{coveredBy:['.toast'],coverSamples:3});
 assert.deepEqual(codes(evaluateState(raw({interactive:[covered]}),{viewport:landscape})),['COVERED']);
 assert.deepEqual(codes(evaluateState(raw({interactive:[{...covered,coverSamples:2}]}),{viewport:landscape})),[]);
 assert.deepEqual(codes(evaluateState(raw({interactive:[{...covered,byScroll:'.list'}]}),{viewport:landscape})),[]);
 assert.deepEqual(codes(evaluateState(raw({interactive:[{...covered,fullyInViewport:false}]}),{viewport:landscape})),[]);
});

test('gate 2 separates container clipping, screen edges, wrapped keys and cut short labels',()=>{
 const clipped=item('c',rect(0,0,60,40),{byHidden:'.panel',hiddenFraction:0.85});
 assert.deepEqual(codes(evaluateState(raw({interactive:[clipped]}),{viewport:landscape})),['CLIPPED']);
 assert.deepEqual(codes(evaluateState(raw({interactive:[{...clipped,hiddenFraction:0.9}]}),{viewport:landscape})),[]);
 const edge=item('e',rect(820,0,60,40),{viewportFraction:0.4});
 assert.deepEqual(codes(evaluateState(raw({interactive:[edge]}),{viewport:landscape})),['OFFSCREEN']);
 assert.deepEqual(codes(evaluateState(raw({interactive:[{...edge,byScroll:'.rail'}]}),{viewport:landscape})),[],'a scrolled-away row is reachable by scrolling');
 assert.deepEqual(codes(evaluateState(raw({interactive:[{...edge,viewportFraction:0}]}),{viewport:landscape})),[]);
 const wrap=item('w',rect(0,0,40,40),{shortLabel:true,lines:2,text:'好友'});
 assert.deepEqual(codes(evaluateState(raw({interactive:[wrap]}),{viewport:landscape})),['LABEL_WRAP']);
 const cut=item('t',rect(0,0,40,40),{truncated:'返回牧…'});
 assert.deepEqual(codes(evaluateState(raw({interactive:[cut]}),{viewport:landscape})),['TEXT_TRUNCATED']);
 const longName=item('n',rect(0,0,40,40),{truncated:'很長很長的拍檔名字被截斷了…'});
 assert.deepEqual(codes(evaluateState(raw({interactive:[longName]}),{viewport:landscape})),[],'a long name may end in an ellipsis');
});

test('gate 5 keeps controls out of the notch and home-indicator insets unless they scroll',()=>{
 const notch=item('n',rect(10,100,44,44),{insetIntrusion:'左側'});
 assert.deepEqual(codes(evaluateState(raw({interactive:[notch]}),{viewport:landscape})),['SAFE_AREA']);
 assert.deepEqual(codes(evaluateState(raw({interactive:[{...notch,scroller:true}]}),{viewport:landscape})),[]);
 assert.deepEqual(codes(evaluateState(raw({interactive:[{...notch,byScroll:'.list'}]}),{viewport:landscape})),[]);
});

test('text overlap and badge cuts honour the ignore list and the 95 % badge floor',()=>{
 const hit={a:'名字',b:'等級',selector:'.cm-card .name',other:'.cm-card .level'};
 assert.deepEqual(codes(evaluateState(raw({textOverlaps:[hit]}),{viewport:landscape})),['TEXT_OVERLAP']);
 assert.deepEqual(codes(evaluateState(raw({textOverlaps:[hit]}),{viewport:landscape,spec:{ignore:['.cm-card']}})),[]);
 const badge={label:'NEW',selector:'.badge',fraction:0.94,clipper:'.tab'};
 assert.deepEqual(codes(evaluateState(raw({badges:[badge]}),{viewport:landscape})),['BADGE_CUT']);
 assert.deepEqual(codes(evaluateState(raw({badges:[{...badge,fraction:0.95}]}),{viewport:landscape})),[]);
});

test('HUD groups may only overlap where the spec allows that pair, in either order',()=>{
 const groups={status:[item('s',rect(0,0,200,40))],card:[item('c',rect(100,20,200,200))]};
 const found=evaluateState(raw({groups}),{viewport:landscape});
 assert.deepEqual(codes(found),['HUD_OVERLAP']);
 assert.equal(found[0].gate,GATES.OVERLAP);
 assert.deepEqual(codes(evaluateState(raw({groups}),{viewport:landscape,spec:{allowOverlap:[['card','status']]}})),[]);
});

test('primary buttons need 40 px on both axes',()=>{
 const primary=[{label:'確定',selector:'.ok',width:40,height:40},{label:'⇄',selector:'.swap',width:33,height:24},{label:'返回',selector:'.back',width:120,height:39}];
 const found=evaluateState(raw({primary}),{viewport:landscape});
 assert.deepEqual(found.map(f=>f.a),['.swap','.back']);
 assert.ok(found.every(f=>f.code==='TARGET_SMALL'&&f.gate===GATES.TOUCH));
});

test('required entries and exits must exist, be on screen and take the tap',()=>{
 const mustSee=[{selector:'.exit',role:'exit',found:false},{selector:'.entry',found:true,inViewport:false,label:'入口'},
  {selector:'.close',role:'exit',found:true,inViewport:true,coveredBy:'.scrim',label:'關閉'},{selector:'.ok',found:true,inViewport:true,label:'好'}];
 assert.deepEqual(codes(evaluateState(raw({mustSee}),{viewport:landscape})),['NO_EXIT','UNREACHABLE','NO_EXIT']);
});

test('the last row of a scrolling list clears the fixed footer within one pixel',()=>{
 const list={found:true,container:'.list',item:'.row',last:{bottom:601},limit:600,limitBy:'.cm-screen-footer'};
 assert.deepEqual(codes(evaluateState(raw({lists:[list]}),{viewport:portrait})),[]);
 assert.deepEqual(codes(evaluateState(raw({lists:[{...list,last:{bottom:602}}]}),{viewport:portrait})),['LIST_CUT']);
 assert.deepEqual(codes(evaluateState(raw({lists:[{found:false,container:'.list'}]}),{viewport:portrait})),['LIST_MISSING']);
 assert.deepEqual(codes(evaluateState(raw({lists:[{found:true,container:'.list',last:null}]}),{viewport:portrait})),[]);
});

test('gate 3 holds the landscape stage at 55 % and lets a spec raise or lower it',()=>{
 const stage={ratio:0.5};
 assert.deepEqual(codes(evaluateState(raw({stage}),{viewport:landscape})),['STAGE_SMALL']);
 assert.deepEqual(codes(evaluateState(raw({stage}),{viewport:portrait})),[],'portrait screens stack their HUD');
 assert.deepEqual(codes(evaluateState(raw({stage}),{viewport:landscape,spec:{stageMin:0.45}})),[]);
 assert.deepEqual(codes(evaluateState(raw({stage:{ratio:0.56}}),{viewport:landscape})),[]);
});

test('working surfaces keep their room and dialogue boxes stay short',()=>{
 const board={found:true,selector:'.board',ratio:0.3,minRatio:0.25,heightRatio:0.6,minHeightRatio:0,height:180,minHeightPx:200};
 assert.deepEqual(codes(evaluateState(raw({areas:[board]}),{viewport:landscape})),['AREA_SMALL']);
 assert.deepEqual(codes(evaluateState(raw({areas:[{...board,height:200}]}),{viewport:landscape})),[]);
 const dialogue={found:true,selector:'.vn',ratio:0.4,minRatio:0,heightRatio:0.5,minHeightRatio:0,maxHeightRatio:0.45};
 assert.deepEqual(codes(evaluateState(raw({areas:[dialogue]}),{viewport:landscape})),['AREA_TOO_TALL']);
 assert.deepEqual(codes(evaluateState(raw({areas:[{found:false,selector:'.gone'}]}),{viewport:landscape})),['AREA_MISSING']);
});

test('showcases and charts sit inside the screen within 5 % of the centre line',()=>{
 const centred=[{found:true,selector:'.chart',inside:true,offset:0.05},{found:true,selector:'.frame',inside:true,offset:0.06},{found:true,selector:'.sheet',inside:false,offset:0}];
 assert.deepEqual(evaluateState(raw({centered:centred}),{viewport:landscape}).map(f=>f.a),['.frame','.sheet']);
});

test('closing an overlay leaves no scrim, dialog, wrong screen or new interval',()=>{
 const residue={overlays:['.cm-scrim'],dialogs:1};
 const found=evaluateState(raw({residue,screen:'SHOP',intervals:5}),{viewport:landscape,spec:{expectScreen:'RAISING_HOME',intervalBaseline:4}});
 assert.deepEqual(codes(found),['RESIDUE','RESIDUE','WRONG_RETURN','ORPHAN_TIMER']);
 assert.ok(found.every(f=>f.gate===GATES.WIRING));
 const clean=evaluateState(raw({residue:{overlays:[],dialogs:1},screen:'RAISING_HOME',intervals:9}),{viewport:landscape,spec:{allowDialogs:1,expectScreen:'RAISING_HOME',intervalBaseline:null}});
 assert.deepEqual(codes(clean),[],'a null baseline skips the timer count');
});

test('identical findings collapse and the summary counts per gate and slice',()=>{
 const twin=item('a',rect(0,0,80,40)),again=item('b',rect(60,0,80,40));
 const doubled=evaluateState(raw({interactive:[twin,again,{...again,uid:'b2'}]}),{viewport:landscape});
 assert.equal(doubled.filter(f=>f.detail==='a ⟂ b').length,1,'the same label pair is reported once');
 const results=[{slice:1,findings:[{gate:1},{gate:5}]},{slice:1,findings:[]},{slice:2,findings:[{gate:2}]}];
 assert.deepEqual(summarize(results),{states:3,findings:3,byGate:{1:1,2:1,3:0,4:0,5:1},bySlice:{1:{states:2,findings:2},2:{states:1,findings:1}},pass:false});
 assert.equal(summarize([{slice:3,findings:[]}]).pass,true);
});

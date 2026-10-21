import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
const base=new URL('../',import.meta.url);
const source=readFileSync(new URL('src/championship/presentation/intRh2/createRaisingFieldPixiPresentation.js',base),'utf8');
const start=source.indexOf('    get isPlayable() {'),end=source.indexOf('    // The P1R DOM shell',start);
const clockSource=readFileSync(new URL('src/championship/app/championshipClockDriver.js',base),'utf8');
const {createChampionshipClockDriver}=await import('data:text/javascript;base64,'+Buffer.from(clockSource).toString('base64'));
function fixture(){
 let frame={sequenceId:0,evolution:null},sourceReady=true,targetReady=true;
 const entry={speciesId:'species8',assetState:'ready',nativeFramePresenter:{isFrameReady:()=>sourceReady}};
 const context={disposed:false,lifetime:{signal:{aborted:false}},source:{getFrame:()=>({residents:[{creatureId:'id',speciesId:'species8'}]}),getActorFrame:()=>frame},actors:new Map([['id',entry]])};
 vm.runInNewContext('globalThis.scene={'+source.slice(start,end)+'};',context);
 const evolve=()=>frame.evolution={target:9,phase:0,totalFrames:0,targetFrame:{sequenceId:39,frameIndex:0}};
 const ready=()=>Object.assign(entry,{evolutionTarget:9,evolutionSprite:{},evolutionAssetState:'ready',evolutionPresenter:{isFrameReady:()=>targetReady}});
 return {entry,context,evolve,ready,frame:()=>frame,setSourceReady:x=>sourceReady=x,setTargetReady:x=>targetReady=x};
}
test('before any draw a newly current target blocks even though cached asset state remains ready',()=>{
 const f=fixture();assert.equal(f.context.scene.isPlayable,true);f.evolve();assert.equal(f.entry.evolutionAssetState,undefined);assert.equal(f.context.scene.isPlayable,false);
 f.ready();assert.equal(f.context.scene.isPlayable,true);
});
test('superseded target and current missing target sequence block without mutating state or scheduling load',()=>{
 const f=fixture();f.evolve();f.ready();f.entry.evolutionTarget=8;assert.equal(f.context.scene.isPlayable,false);
 f.entry.evolutionTarget=9;f.setTargetReady(false);assert.equal(f.context.scene.isPlayable,false);assert.equal(f.entry.evolutionAssetState,'ready');
 f.setTargetReady(true);assert.equal(f.context.scene.isPlayable,true);
});
test('choice pending remains operable; disappearance needs no target; normal actors and source frame readiness preserved',()=>{
 const f=fixture(),e=f.evolve();e.choicePending=true;e.targetFrame=null;assert.equal(f.context.scene.isPlayable,true);
 e.choicePending=false;e.target=-1;assert.equal(f.context.scene.isPlayable,true);
 f.setSourceReady(false);assert.equal(f.context.scene.isPlayable,false);f.setSourceReady(true);assert.equal(f.context.scene.isPlayable,true);
});
test('actual clock driver holds phase0 through slow first tick before draw and resumes without catch-up',()=>{
 const f=fixture();let now=0,tick;const session={};let advanced=0;
 const app={getSession:()=>session,getScreen:()=> 'RAISING_HOME',subscribeScreen:()=>()=>{},getClockRunState:()=>({running:!f.frame().evolution}),hasRaisingPresentation:()=>!!f.frame().evolution,
 advanceNaturalClock(){},advanceRaisingPresentation({frames}){advanced+=frames;f.frame().evolution.totalFrames+=frames;}};
 const driver=createChampionshipClockDriver({app,ticker:{add(fn){tick=fn},remove(){}},now:()=>now,isSceneReady:()=>f.context.scene.isPlayable});driver.setActive(true);tick();
 f.evolve();now=1060;tick();assert.equal(advanced,0);assert.equal(f.frame().evolution.totalFrames,0);
 now=1500;tick();assert.equal(advanced,0);f.ready();now=1600;tick();assert.equal(advanced,0);
 now=1617;tick();assert.equal(advanced,1);driver.dispose();
});
test('actual natural-clock batch stops on first newly started evolution before later substeps',()=>{
 const appSource=readFileSync(new URL('src/championship/app/championshipStandaloneApp.js',base),'utf8');
 const a=appSource.indexOf('    advanceNaturalClock({ frames } = {}) {'),b=appSource.indexOf('    getSelectedCreatureId()',a);
 let evolving=false,nativeSteps=0;const snapshot={clockMinutes:480,clockUnits:0,clockSubunits:0};
 const context={now:()=>0,discoveryCheckAt:0,NATIVE_CLOCK_CADENCE:{trainingDivisor:200,elapsedUnitsPerFrame:16},DAY_END_MINUTES:1320,
 requireSession:()=>({getRaisingHomeSnapshot:()=>snapshot}),advanceNativeRaising(){nativeSteps++;evolving=true;},nativeMessages:{morningPending:false,entryChecked:true,queue:[],activeId:null},ageNativeRaisingMessages:x=>x};
 vm.runInNewContext('globalThis.app={'+appSource.slice(a,b)+'};',context);
 Object.assign(context.app,{getClockRunState:()=>({running:true}),advanceClock:()=>({accepted:true}),getCalendar:()=>snapshot,deliverRaisingFeast(){},hasRaisingPresentation:()=>evolving});
 context.app.advanceNaturalClock({frames:63});assert.equal(nativeSteps,1);assert.equal(evolving,true);
});

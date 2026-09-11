import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {createChampionshipClockDriver} from '../src/championship/app/championshipClockDriver.js';
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
async function start(minute=420){
  const entries=new Map(),storage={getItem:k=>entries.get(k)??null,setItem:(k,v)=>entries.set(k,v),removeItem:k=>entries.delete(k)};
  const app=createChampionshipStandaloneApp({catalog:read('src/data/championship/catalogs/creature-species.r1.json'),
    storage,
    cages:read('docs/contracts/championship/raising-home-presentation.v1.json').cages,
    rngClock:()=>({hour:13,minute:20,second:50})});
  await app.newGame();app.advanceClock({units:(minute-420)*400+137,divisor:400});
  app.openGate();app.selectGate(app.getGates().find(g=>g.biomeId==='Grass').gateId);app.confirmGate();await app.beginHunt();
  assert.equal(app.getScreen(),'HUNT_FIELD');return app;
}
test('normal Hunt follows original live clock receipt and clears the scene remainder',async()=>{
  const original=read('reports/hunt-core-two-stage-2026-09-08/clock-original-input.json').samples;
  assert.equal(original[0].sessionMode,6);
  const app=await start();try{
    assert.equal(app.getSnapshot().clockUnits,0);
    assert.equal(app.getClockRunState().reason,'NORMAL_HUNT');
    for(const sample of original.slice(1)){
      app.advanceNaturalClock({frames:25});
      assert.equal(app.getSnapshot().clockMinutes-420,sample.clock[1]-original[0].clock[1]);
    }
    app.advanceNaturalClock({frames:1});assert.equal(app.getSnapshot().clockUnits,16);
    app.exitHunt();assert.equal(app.getSnapshot().clockUnits,0);
    assert.equal(app.getHuntTimeState(),null);
  }finally{await app.dispose();}
});
test('eight-hour and late-evening deadlines stop precisely and leave an empty expedition',async()=>{
  const cases=read('reports/hunt-core-two-stage-2026-09-08/controls-cpu.json').huntDeadlineMinutes;
  assert.equal(cases.length,288);
  for(const [minute,deadline] of cases)assert.equal(deadline,Math.min(minute+480,1320));
  for(const [minute,deadline] of [[420,900],[840,1320],[1318,1320]]){
    const app=await start(minute);try{
      assert.equal(app.getHuntTimeState().deadlineMinute,deadline);
      const frames=(deadline-minute)*25;
      for(let n=0;n<frames-1;){const step=Math.min(120,frames-1-n);app.advanceNaturalClock({frames:step});n+=step;}
      assert.equal(app.getScreen(),'HUNT_FIELD');assert.equal(app.getHuntTimeState().remainingMinutes,1);
      app.advanceNaturalClock({frames:120});
      assert.equal(app.getScreen(),'RAISING_HOME');assert.equal(app.getSnapshot().clockMinutes,deadline);
      assert.equal(app.getSnapshot().clockUnits,0);assert.equal(app.getHuntRuntime(),null);
    }finally{await app.dispose();}
  }
});
test('repeated tool selections cannot pause the shared Hunt clock',async()=>{
  const app=await start();let now=0,listener;
  const driver=createChampionshipClockDriver({app,ticker:{add:f=>listener=f,remove:()=>{}},now:()=>now});
  try{
    driver.setActive(true);listener();
    for(let n=1;n<=60;n++){app.getHuntRuntime().selectTool('HAND');now=n*1000/60;listener();}
    assert.equal(app.getSnapshot().clockMinutes,422);
  }finally{driver.dispose();await app.dispose();}
});

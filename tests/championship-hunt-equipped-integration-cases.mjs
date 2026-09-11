import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {createChampionshipStandaloneApp} from '../src/championship/app/championshipStandaloneApp.js';
import {HUNT_EQUIPMENT_ITEMS,HUNT_MEMORY_CARDS} from '../src/championship/hunt/loadout/huntEquipmentCatalog.js';
const catalog=JSON.parse(fs.readFileSync('src/data/championship/catalogs/creature-species.r1.json','utf8'));
const cages=JSON.parse(fs.readFileSync('docs/contracts/championship/raising-home-presentation.v1.json','utf8')).cages;
const frame=1000*560190/33513982;

// Controlled owned inventory only. All actors, positions, vitals, RNG advances,
// input handling and AI remain the normal application path. No outcome injection.
test('all 34 consumables reach normal generated actors, consume stock and leave valid AI frames',async()=>{
  let checked=0;
  for(const item of HUNT_EQUIPMENT_ITEMS.filter(i=>i.countable)){
    const saved=new Map(),storage={getItem:k=>saved.get(k)??null,setItem:(k,v)=>saved.set(k,v),removeItem:k=>saved.delete(k)};
    const app=createChampionshipStandaloneApp({storage,catalog,cages,rngClock:()=>({hour:13,minute:20,second:50}),
      huntStartingInventory:[{itemId:item.itemId,quantity:2},{itemId:HUNT_MEMORY_CARDS[0].itemId,quantity:1}]});
    try{
      await app.newGame();app.openGate();app.selectGate(app.getGates().find(g=>g.biomeId==='Grass').gateId);app.confirmGate();
      app.selectHuntEquipment(item.equipmentClass,item.itemId);await app.beginHunt();
      const before=app.getHuntLoadout().getSelectedEquipment().find(e=>e.itemId===item.itemId).quantity;
      const runtime=app.getHuntRuntime();assert.ok(runtime,item.itemId);
      assert.equal(runtime.selectTool(item.equipmentClass),true,item.itemId);runtime.tick(frame);
      const tool=runtime.getToolState().tools.find(t=>t.id===item.equipmentClass);
      assert.equal(tool.enabled,true,item.itemId);assert.equal(tool.unavailableReason,null,item.itemId);
      const target=runtime.getWildCreatures()[0];let x=target.worldX,y=target.worldY;
      if(item.nativeSubcategory==='WIRE'){
        let found=false;
        for(let tx=4;tx<runtime.world.widthTiles-9&&!found;tx++)for(let ty=4;ty<runtime.world.heightTiles-4&&!found;ty++){
          x=tx*runtime.world.tileSizePx;y=ty*runtime.world.tileSizePx;
          const clear=Array.from({length:9},(_,i)=>!runtime.world.isBlockedTile(tx+i,ty)).every(Boolean);
          if(clear&&runtime.getWildCreatures().every(a=>Math.hypot(a.worldX-x,a.worldY-y)>200))found=true;
        }
        assert.ok(found,'fixture has clear original terrain for the wire');
        runtime.toolPointerDown(x,y);runtime.tick(frame);runtime.toolPointerMove(x+110,y);runtime.tick(frame);runtime.toolPointerUp(x+110,y);
      }else{
        runtime.toolPointerDown(x,y);runtime.tick(frame);runtime.toolPointerUp(x,y);
        if(item.nativeSubcategory==='SHOT'&&item.nativeItemIndex>=8){
          assert.equal(runtime.getToolState().objects.filter(o=>o.kind==='SHOT_IMPACT').length,7,item.itemId);
          runtime.tick(frame);
          assert.equal(runtime.getWildCreatures().find(a=>a.wildId===target.wildId)?.aiState,9,
            `${item.itemId}: normal event delivery enters the original shot reaction`);
        }
        if(item.nativeSubcategory==='DECOY'){
          runtime.tick(frame);runtime.toolPointerDown(x+100,y);runtime.tick(frame);runtime.toolPointerUp(x+100,y);
        }
      }
      for(let i=0;i<420;i++)runtime.tick(frame);
      const selected=app.getHuntLoadout().getSelectedEquipment().find(e=>e.itemId===item.itemId);
      assert.equal(selected.quantity,before-1,`${item.itemId}: exactly one activation`);
      for(const a of runtime.getWildCreatures()){
        assert.ok([a.worldX,a.worldY,a.worldZ,a.currentHp,a.maxHp].every(Number.isFinite),item.itemId);
        assert.ok(a.nativeAnimation?.contract,item.itemId);
      }
      runtime.selectTool('HAND');app.exitHunt();assert.equal(app.getHuntRuntime(),null);checked++;
    }finally{await app.dispose();}
  }
  assert.equal(checked,34);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {createNativeHuntConsumables,nativeHuntScatterPoints} from '../src/championship/hunt/capture/nativeHuntConsumables.js';
import {nativeShotSpeciesResponse} from '../src/championship/hunt/capture/nativeHuntToolRules.js';
import source from '../src/data/championship/catalogs/hunt-tools.r1.json' with {type:'json'};
import {HUNT_EQUIPMENT_ITEMS} from '../src/championship/hunt/loadout/huntEquipmentCatalog.js';
const Q=4096,p=(x=150,y=150)=>[x*Q,y*Q,0];
function fixture(kind,index=0,quantity=20,{night=false,terrain=0}={}){
  const item=HUNT_EQUIPMENT_ITEMS.find(i=>i.nativeSubcategory===kind&&i.nativeItemIndex===index);
  assert.ok(item);let left=quantity,spent=0;const notices=[],requests=[];
  const host={actors:[],environment:{readTerrain:()=>terrain},nextChannel:()=>50,wildRandom:()=>0,
    camera:[0,0],night,emit:n=>notices.push(n),usedG:()=>0,maxCardG:32,stopRope:()=>{},
    scatterResponse:a=>nativeShotSpeciesResponse(a.speciesIndex)};
  const selected=()=>({...item,quantity:left});
  const tools=createNativeHuntConsumables(host,{equipped:c=>c===item.equipmentClass?selected():null,
    request:(a,r)=>requests.push(r),consumeItem:(_,n)=>{if(left<n)return {ok:false,reason:'EMPTY'};left-=n;spent+=n;return {ok:true};}});
  return {host,tools,selected,notices,requests,left:()=>left,spent:()=>spent};
}
test('all 34 consumables use their original equipment class and spend once on activation',()=>{
  let count=0;
  for(const item of HUNT_EQUIPMENT_ITEMS.filter(i=>i.countable)){
    const f=fixture(item.nativeSubcategory,item.nativeItemIndex);
    assert.equal(f.tools.canUse(item.equipmentClass),true,item.itemId);
    assert.equal(f.tools.use(f.selected(),p()),true,item.itemId);
    if(item.nativeSubcategory==='DECOY'){
      assert.equal(f.spent(),0);f.tools.use(f.selected(),p(180));
    }else if(item.nativeSubcategory==='WIRE'){
      f.tools.tick({kind:'WIRE',q12:p(),released:false},'WIRE');
      f.tools.tick({kind:'WIRE',q12:p(210,180),released:true},'WIRE');
      f.tools.tick(null,'WIRE');
    }
    assert.equal(f.spent(),1,item.itemId);assert.equal(f.left(),19,item.itemId);count++;
  }
  assert.equal(count,34);
});
test('a host missing the explicit scatter response policy cannot emit arbitrary response bytes',()=>{
  for(let i=8;i<12;i++){const f=fixture('SHOT',i);delete f.host.scatterResponse;
    assert.equal(f.tools.canUse('SHOT'),false);assert.equal(f.tools.use(f.selected(),p()),false);assert.equal(f.spent(),0);}
});

test('approved scatter response matches ordinary Shot for all 228 species and preserves seven event payloads',()=>{
  assert.equal(source.species.length,228);
  for(let index=8;index<12;index++){
    for(const species of source.species){
      const f=fixture('SHOT',index,1),calls=[];
      const actor={speciesIndex:species.speciesIndex,actorActive:1,hidden:false,positionQ12:p(),bounds:{rect:[-20,-20,20,20]},events:[]};
      const ordinary=fixture('SHOT',index<10?index-8:index-4,1);
      ordinary.host.actors.push(actor);ordinary.tools.use(ordinary.selected(),p());
      const expected=actor.events.pop();assert.equal(expected.response,Math.max(1,species.effectiveness[1]));
      f.host.actors.push(actor);
      f.host.nextChannel=channel=>{calls.push(channel);return 50;};
      assert.equal(f.tools.use(f.selected(),p()),true);assert.equal(f.spent(),1);
      assert.deepEqual(actor.events,Array.from({length:7},()=>expected));
      assert.deepEqual(calls,Array.from({length:7},()=>[0xb2,0xb3]).flat());
      assert.equal(f.tools.getObjects().length,7);
      for(let i=0;i<90;i++)f.tools.tick(null,'HAND');
      assert.deepEqual(f.tools.getObjects(),[]);assert.equal(f.tools.use(f.selected(),p()),false);assert.equal(actor.events.length,7);
    }
  }
});

test('scatter keeps centre-first offsets and RNG order for seven, partial and full primary pools',()=>{
  for(const slots of [0,3,7,10]){
    const calls=[];
    const points=nativeHuntScatterPoints(p(),slots,channel=>{calls.push(channel);return channel===0xb2?0:31;});
    const count=Math.min(7,slots);
    assert.deepEqual(points,count?[p(),...Array.from({length:count-1},()=>p(134,165))]:[]);
    assert.deepEqual(calls,Array.from({length:count},()=>[0xb2,0xb3]).flat());
  }
});

test('all four held scatter shots retain 60 cooldown updates, one shell per volley and eight-tick primary cleanup',()=>{
  for(let index=8;index<12;index++){
    const f=fixture('SHOT',index,2),pointer={kind:'SHOT',q12:p(),released:false,fresh:true};
    f.tools.tick(pointer,'SHOT');assert.equal(f.spent(),1);assert.equal(f.tools.getObjects().length,7);
    for(let tick=1;tick<=60;tick++){
      f.tools.tick(pointer,'SHOT');assert.equal(f.spent(),1);
      assert.equal(f.tools.getObjects().length,tick<8?7:0);
    }
    f.tools.tick(pointer,'SHOT');assert.equal(f.spent(),2);assert.equal(f.tools.getObjects().length,7);
    for(let tick=0;tick<130;tick++)f.tools.tick(pointer,'SHOT');
    assert.equal(f.spent(),2);assert.deepEqual(f.tools.getObjects(),[]);
  }
});
test('food and hazard pools reject an eleventh active object without spending inventory',()=>{
  for(const kind of ['MEAT','BOMB','MINE']){
    const f=fixture(kind);for(let i=0;i<10;i++)assert.equal(f.tools.use(f.selected(),p(50+i*20)),true);
    assert.equal(f.tools.use(f.selected(),p()),false);assert.equal(f.spent(),10);
    assert.equal(f.tools.getObjects().filter(o=>o.kind===kind).length,10);
  }
});
test('cancelled or too-short wires never commit or consume; valid wires expire and free their slots',()=>{
  const f=fixture('WIRE');
  f.tools.use(f.selected(),p());f.tools.tick({kind:'WIRE',q12:p(),released:false},'WIRE');f.tools.cancel();
  f.tools.tick(null,'HAND');assert.equal(f.spent(),0);assert.deepEqual(f.tools.getObjects(),[]);
  f.tools.use(f.selected(),p());f.tools.tick({kind:'WIRE',q12:p(),released:false},'WIRE');
  f.tools.tick({kind:'WIRE',q12:p(170,150),released:true},'WIRE');f.tools.tick(null,'WIRE');
  assert.equal(f.spent(),0);
  f.tools.use(f.selected(),p());f.tools.tick({kind:'WIRE',q12:p(),released:false},'WIRE');
  f.tools.tick({kind:'WIRE',q12:p(210,180),released:true},'WIRE');f.tools.tick(null,'WIRE');
  assert.equal(f.spent(),1);for(let i=0;i<600;i++)f.tools.tick(null,'HAND');
  assert.equal(f.tools.getObjects().length,1);f.tools.tick(null,'HAND');assert.deepEqual(f.tools.getObjects(),[]);
});
test('held shots obey the original cooldown, empty ammo cannot generate a hit, and feedback clears',()=>{
  for(let i=0;i<12;i++){
    const f=fixture('SHOT',i,2),pointer={kind:'SHOT',q12:p(),released:false,fresh:true};
    f.tools.tick(pointer,'SHOT');assert.equal(f.spent(),1);
    for(let frame=0;frame<120;frame++)f.tools.tick(pointer,'SHOT');
    assert.equal(f.spent(),2);assert.equal(f.left(),0);
    for(let frame=0;frame<60;frame++)f.tools.tick(null,'HAND');
    assert.deepEqual(f.tools.getObjects(),[]);
  }
});
test('moving decoy reserves a preview, launches on the second tap, and cannot launch without stock',()=>{
  const f=fixture('DECOY',0,1);f.tools.use(f.selected(),p());assert.equal(f.spent(),0);
  for(let i=0;i<180;i++)f.tools.tick(null,'HAND');assert.equal(f.spent(),0);
  f.tools.tick(null,'HAND');assert.equal(f.spent(),1);
  assert.equal(f.tools.use(f.selected(),p()),false);assert.equal(f.spent(),1);
});
test('night light emits attraction only at night and expires without duplicate consumption',()=>{
  for(const night of [false,true]){
    const f=fixture('LIGHT',0,2,{night});const actor={actorActive:true,events:[]};f.host.actors.push(actor);
    f.tools.use(f.selected(),p());assert.equal(f.tools.use(f.selected(),p(250)),false);
    for(let i=0;i<40;i++)f.tools.tick(null,'HAND');assert.equal(actor.events.some(e=>e.code===0x38),night);
    for(let i=40;i<4860;i++)f.tools.tick(null,'HAND');assert.deepEqual(f.tools.getObjects(),[]);
    assert.equal(f.spent(),1);assert.equal(f.tools.use(f.selected(),p()),true);
  }
});
test('capture trap reserves one target and rejects collection when card capacity is full',()=>{
  const f=fixture('CAPTURE_TRAP');f.tools.use(f.selected(),p());assert.equal(f.tools.use(f.selected(),p()),false);
  const a={wildId:'a',speciesIndex:10,positionQ12:p(),aiState:16,bounds:{rect:[-10,-20,10,5]}};
  f.tools.queryControllers(a,p());assert.equal(a.enteredCaptureTrap,true);f.tools.enterToolState(a,16);
  f.tools.toolDecision(a,[]);assert.equal(a.trapReady,true);
  const other={wildId:'b',speciesIndex:10,positionQ12:p(),bounds:a.bounds};assert.equal(f.tools.queryControllers(other,p()).secondaryBlocked,true);
  f.host.maxCardG=0;assert.equal(f.tools.toolDecision(a,[{code:0x16}]),-1);assert.equal(f.notices.at(-1),'OVER_CAPACITY');
  f.host.maxCardG=32;assert.equal(f.tools.toolDecision(a,[{code:0x16}]),12);assert.deepEqual(f.tools.getObjects(),[]);
});
test('each bomb resolves its fuse and all secondary feedback; mines require contact before exploding',()=>{
  for(let index=0;index<4;index++){
    const f=fixture('BOMB',index);const a={actorActive:true,events:[]};f.host.actors.push(a);f.tools.use(f.selected(),p());
    for(let i=0;i<400;i++)f.tools.tick(null,'HAND');
    assert.equal(a.events.filter(e=>e.code===(index===3?0x37:0x35)).length,1);assert.deepEqual(f.tools.getObjects(),[]);assert.equal(f.spent(),1);
  }
  for(let index=0;index<2;index++){
    const f=fixture('MINE',index);const a={actorActive:true,events:[]};f.host.actors.push(a);f.tools.use(f.selected(),p());
    for(let i=0;i<400;i++)f.tools.tick(null,'HAND');assert.equal(a.events.length,0);assert.equal(f.tools.getObjects().length,1);
    assert.equal(f.host.triggerMine(p()),true);assert.equal(f.host.triggerMine(p()),false);
    for(let i=0;i<100;i++)f.tools.tick(null,'HAND');assert.equal(a.events.filter(e=>e.code===0x35).length,1);assert.deepEqual(f.tools.getObjects(),[]);
  }
});

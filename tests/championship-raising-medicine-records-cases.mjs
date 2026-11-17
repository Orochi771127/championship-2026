// Wound medicine (傷藥) and illness medicine (藥品) keep the original item, not
// the record number. Shop records 2/3 hold Training Goods items 3/2; OVL18
// 0210F0B0 (wound, command 7C) debits PlayerData +0x24 = item 3 and 0210F324
// (illness, command 7D) debits +0x22 = item 2 (+0x1E + 2*itemIndex).
import assert from 'node:assert/strict';
import test from 'node:test';
import {RAISING_TOOL_ITEM_INDEX,RAISING_TOOL_SHOP_RECORDS,raisingToolStock,getShopRecord} from '../src/championship/shop/shopCatalog.js';
import {createShopRuntime} from '../src/championship/shop/shopRuntime.js';
import {shopItemName} from '../src/championship/text/zhHant.js';
import {shopGoodsPresentation} from '../src/championship/presentation/shopGoodsUiArt.js';
import {BACKPACK_SUPPLY_TOOLS} from '../src/championship/app/ranchBackpack.js';
import {STROLL_REWARDS} from '../src/championship/raising/ranchPartnerLife.js';
import {GACHA_GOODS,GACHA_SUPPLY_PACKS} from '../src/championship/gacha/cyberGacha.js';

const TOOLS=['feed','protein','woundMedicine','medicine'];

test('each Raising tool resolves the shop record that holds its original Training Goods item',()=>{
  assert.deepEqual({...RAISING_TOOL_ITEM_INDEX},{feed:0,protein:1,medicine:2,woundMedicine:3});
  assert.deepEqual({...RAISING_TOOL_SHOP_RECORDS},{feed:0,protein:1,medicine:3,woundMedicine:2});
  for(const tool of TOOLS){
    const record=getShopRecord(RAISING_TOOL_SHOP_RECORDS[tool]);
    assert.equal(record.category,'TRAINING_GOODS',tool);
    assert.equal(record.itemIndex,RAISING_TOOL_ITEM_INDEX[tool],tool);
    assert.equal(shopGoodsPresentation(record.shopRecordIndex).icon,tool,tool);
  }
  assert.equal(shopItemName(RAISING_TOOL_SHOP_RECORDS.woundMedicine),'傷藥');
  assert.equal(shopItemName(RAISING_TOOL_SHOP_RECORDS.medicine),'藥品');
  // Original prices: wound medicine 20 Bits, illness medicine 200 Bits.
  assert.equal(getShopRecord(RAISING_TOOL_SHOP_RECORDS.woundMedicine).unitPriceBits,20);
  assert.equal(getShopRecord(RAISING_TOOL_SHOP_RECORDS.medicine).unitPriceBits,200);
});

test('wound treatment spends 傷藥 and illness treatment spends 藥品, nothing else',()=>{
  for(const [kind,tool,other] of [[0,'woundMedicine','medicine'],[1,'medicine','woundMedicine']]){
    const shop=createShopRuntime(),before=[...shop.toSave().quantities];
    const result=shop.consumeRaisingMedicine(kind);
    assert.equal(result.ok,true);assert.equal(result.shopRecordIndex,RAISING_TOOL_SHOP_RECORDS[tool]);
    const after=shop.toSave().quantities;
    assert.equal(after[RAISING_TOOL_SHOP_RECORDS[tool]],before[RAISING_TOOL_SHOP_RECORDS[tool]]-1,tool);
    assert.equal(after[RAISING_TOOL_SHOP_RECORDS[other]],before[RAISING_TOOL_SHOP_RECORDS[other]],other);
    assert.deepEqual(after.map((n,i)=>i===RAISING_TOOL_SHOP_RECORDS[tool]?n+1:n),before);
  }
});

test('toolbar badges, bag use, stroll finds and gacha prizes agree on the same records',()=>{
  const listings=[{shopRecordIndex:0,owned:50},{shopRecordIndex:1,owned:10},{shopRecordIndex:2,owned:7},{shopRecordIndex:3,owned:3}];
  assert.deepEqual(raisingToolStock(listings),{feed:50,protein:10,medicine:3,woundMedicine:7});
  for(const tool of TOOLS){
    assert.equal(BACKPACK_SUPPLY_TOOLS[RAISING_TOOL_SHOP_RECORDS[tool]],tool,tool);
    assert.equal(STROLL_REWARDS[tool].record,RAISING_TOOL_SHOP_RECORDS[tool],tool);
    assert.equal(STROLL_REWARDS[tool].tool,tool,tool);
  }
  assert.equal(STROLL_REWARDS.woundMedicine.label,'傷藥');assert.equal(STROLL_REWARDS.medicine.label,'藥品');
  const goods=id=>[...GACHA_GOODS,...GACHA_SUPPLY_PACKS].find(g=>g.id===id).shopRecordIndex;
  assert.equal(goods('goods:wound'),RAISING_TOOL_SHOP_RECORDS.woundMedicine);
  assert.equal(goods('pack:wound'),RAISING_TOOL_SHOP_RECORDS.woundMedicine);
  assert.equal(goods('goods:medicine'),RAISING_TOOL_SHOP_RECORDS.medicine);
  assert.equal(goods('pack:medicine'),RAISING_TOOL_SHOP_RECORDS.medicine);
});

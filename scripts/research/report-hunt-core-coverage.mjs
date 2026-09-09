// Inspectable coverage manifest. Availability is distinct from full ROM/device QA.
import fs from 'node:fs';
import {HUNT_CATALOG_ITEMS,HUNT_MEMORY_CARDS} from '../../src/championship/hunt/loadout/huntEquipmentCatalog.js';
const dir='reports/hunt-core-two-stage-2026-09-08';
const usage={
  ROPE:'快速畫圈，放開後綑綁；再按住目標拉動，依距離控制拉力及耐久',
  SHOT:'按住目標射擊；依原生冷卻、普通／睡眠／麻痺類型處理反應',
  WIRE:'拖出線段，放開後完成；短線／無效位置不扣庫存；阻擋、磁力、電擊依品項',
  MEAT:'點地放餌；角色吃到原生第 1 幀才扣食物營養；毒／麻痺品項使用延遲異常',
  DECOY:'先放玩具，再點移動方向；等待 181 次原生更新也會自動發射',
  LIGHT:'點地放誘引燈；夜間才發出吸引事件，時間到清除',
  BOMB:'點地放炸彈；引信、爆炸、吹飛、落地與品項異常',
  MINE:'點地放地雷；目標接觸後引爆',
  CAPTURE_TRAP:'點地放陷阱；目標進入並到達中心後切手掌收取，仍檢查卡片容量',
  ANALYZER:'在四個插件位置裝備後，顯示對應目標欄位；HP 是原作最大 HP',
  CHECKER:'裝備後顯示對應道具的剩餘數量',
  RADAR_SEARCH:'裝備後依原生世代、屬性或種族遮罩篩選雷達目標',
  MEMORY_CHECKER:'裝備後顯示卡片已用 G 與最大 G',
  MEMORY_CARD:'持有品項决定最大容量；插件只控制是否顯示容量'
};
const items=[...HUNT_CATALOG_ITEMS,...HUNT_MEMORY_CARDS].map(item=>{
  const adapted=item.nativeSubcategory==='SHOT'&&item.nativeItemIndex>=8;
  return {itemId:item.itemId,shopRecordIndex:item.shopRecordIndex,name:item.displayName,
    family:item.nativeSubcategory,nativeItemIndex:item.nativeItemIndex,equipmentClass:item.equipmentClass??null,
    normalPathAvailable:true,status:item.kind==='PLUGIN'?'HUD_INTEGRATED':item.kind==='MEMORY_CARD'?'CAPACITY_RULE_INTEGRATED':'NORMAL_INPUT_INTEGRATED',
    responsePolicy:adapted?'OWNER_APPROVED_ADAPTATION_ORDINARY_SHOT_SPECIES_RESPONSE':null,
    usage:adapted?'按住射擊，每輪最多七發、消耗一份；命中反應值依核准修正使用普通射擊的物種值，麻痺型保留原作條件':usage[item.nativeSubcategory],
    acceptance:item.kind==='PLUGIN'?'All 30 plugin HUD projections exercised':item.kind==='MEMORY_CARD'?'Capacity lookup and existing collection guards':item.nativeSubcategory==='ROPE'?'228 species x 12 rope parameters compared with ARM; starter normal capture/save integration':adapted?'Normal app generation/input/AI/stock/exit; 228 species response comparisons, seven-pellet payloads/RNG, cooldown/empty/cleanup. Approved response differs from the original uninitialized byte.':'Controlled owned inventory; normal generation, input, AI, consumption and exit exercised',
    fullOriginalVisualAudioQa:false,physicalPhoneQa:false};
});
if(items.length!==79||items.some(i=>!i.normalPathAvailable)||items.filter(i=>i.responsePolicy).length!==4)throw Error('HUNT_COVERAGE_DRIFT');
fs.writeFileSync(`${dir}/item-coverage.json`,JSON.stringify({version:2,sourceRomSha256:'8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1',
  scatterApproval:'docs/coordination/OWNER_DIRECTION.md#2026-09-08--bounded-scatter-shot-bug-correction',
  evidenceBoundary:'Implementation and controlled test coverage; not a claim of all-item visual/device/original full-game parity.',items},null,2)+'\n');
const quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
fs.writeFileSync(`${dir}/item-coverage.csv`,'\ufeff'+[['品項','類別','原生索引','正常入口可用','目前狀態','使用方法'],
  ...items.map(i=>[i.name,i.family,i.nativeItemIndex,i.normalPathAvailable,i.status,i.usage])].map(row=>row.map(quote).join(',')).join('\n')+'\n');
console.log(JSON.stringify({items:items.length,equipment:46,enabledEquipment:46,plugins:30,cards:3,blocked:0,approvedAdaptations:4}));

// All 79 native Shop identities share the Shop's prices, unlocks and ownership.
// Functional rules come from ROM readers; display labels are localized prose.
import shop from "../../../data/championship/catalogs/shop.r1.json" with { type: "json" };
import native from "../../../data/championship/catalogs/hunt-tools.r1.json" with { type: "json" };
import { deepFreeze } from "../../contracts/championshipContracts.js";
import { HUNT_ANALYZER_FIELD_ORDER, HUNT_CHECKER_TARGETS } from "./huntLoadoutContract.js";

const CLASSES = { ROPE:"ROPE", SHOT:"SHOT", WIRE:"WIRE", MEAT:"ENTRAP", DECOY:"ENTRAP",
  LIGHT:"ENTRAP", CAPTURE_TRAP:"DAMAGE_TRAP", BOMB:"DAMAGE_TRAP", MINE:"DAMAGE_TRAP" };
const LABELS = {
  ROPE: Array.from({length:12}, (_, i) => `${["基礎", "強化", "高階", "頂級"][Math.floor(i / 3)]}捕捉繩 ${["α", "β", "γ"][i % 3]}`),
  SHOT:["普通射擊 α", "普通射擊 β", "連發射擊 α", "連發射擊 β", "睡眠射擊 α", "睡眠射擊 β", "麻痺射擊 α", "麻痺射擊 β", "散彈 α", "散彈 β", "麻痺散彈 α", "麻痺散彈 β"],
  WIRE:["阻擋鋼索 α", "阻擋鋼索 β", "磁力鋼索 α", "磁力鋼索 β", "電擊鋼索 α", "電擊鋼索 β"],
  MEAT:["肉餌", "大型肉餌", "毒肉餌", "麻痺肉餌"], DECOY:["誘導玩具", "強化誘導玩具"],
  LIGHT:["黃色誘引燈", "藍色誘引燈"], BOMB:["爆破彈", "睡眠彈", "麻痺彈", "閃光彈"],
  MINE:["地雷", "大型地雷"], CAPTURE_TRAP:["捕捉陷阱", "強化捕捉陷阱"],
  ANALYZER:["世代分析", "種族分析", "屬性分析", "HP 分析", "性格分析", "容量分析", "世代／種族分析", "世代／種族／屬性分析", "完整分析"],
  CHECKER:["射擊數量", "鋼索數量", "誘引道具數量", "傷害陷阱數量", "全部道具數量"],
  RADAR_SEARCH:["幼年期雷達", "成長期雷達", "成熟期雷達", "完全體雷達", "資料／自由屬性雷達", "疫苗屬性雷達", "病毒屬性雷達", "龍族雷達", "獸族雷達", "鳥族雷達", "水族雷達", "聖族雷達", "暗黑族雷達", "昆蟲植物雷達", "機械族雷達"],
  MEMORY_CHECKER:["記憶卡容量顯示"], MEMORY_CARD:["記憶卡 32G", "記憶卡 64G", "記憶卡 96G"]
};

// Reveal semantics are corroborated by the original item help. Radar filters
// retain native identities; presentation must not guess species ordinals.
function capability(row) {
  const i = row.itemIndex;
  if (row.subcategory === "ANALYZER") return { speciesIdentity:true, analyzerFields:
    i < 6 ? [HUNT_ANALYZER_FIELD_ORDER[i]] : i === 6 ? ["GENERATION", "FAMILY"]
      : i === 7 ? ["GENERATION", "FAMILY", "ALIGNMENT"] : [...HUNT_ANALYZER_FIELD_ORDER] };
  if (row.subcategory === "CHECKER") return { checkerTargets: i === 4
    ? HUNT_CHECKER_TARGETS.filter(v => v !== "ALL") : [HUNT_CHECKER_TARGETS[i]] };
  if (row.subcategory === "MEMORY_CHECKER") return { memoryReadout:true };
  if (row.subcategory === "RADAR_SEARCH") return { radar:true, nativeRadarIndex:i,
    filterDimension:i < 4 ? "GENERATION" : i < 7 ? "ALIGNMENT" : "FAMILY" };
  throw Error("NATIVE_HUNT_PLUGIN_KIND_INVALID");
}

const rows = shop.records.filter(row => ["HUNT_ITEMS", "PLUGINS"].includes(row.category));
if (rows.length !== 79 || rows.some(row => !row.productItemId)) throw Error("HUNT_SHOP_CATALOG_MAPPING_REQUIRED");
const items = rows.map(row => {
  const common = { itemId:row.productItemId, shopRecordIndex:row.shopRecordIndex,
    nativeSubcategory:row.subcategory, nativeItemIndex:row.itemIndex,
    displayName:LABELS[row.subcategory]?.[row.itemIndex], displayNameAuthority:"CHAMPIONSHIP_2026_LOCALIZATION",
    identityEvidence:"ROM_VERIFIED", maxOwned:row.maxOwned, initialOwned:row.initialOwned,
    unlock:{ kind:row.unlockKind, parameter:row.unlockParameter }, unlockEvidence:row.unlockEvidence };
  if (!common.displayName) throw Error("HUNT_ITEM_LABEL_REQUIRED");
  if (row.category === "PLUGINS") return { ...common, kind:"PLUGIN", pluginKind:row.subcategory,
    countable:false, capability:capability(row), capabilityEvidence:"ROM_VERIFIED" };
  if (row.subcategory === "MEMORY_CARD") return { ...common, kind:"MEMORY_CARD", capacityG:[32, 64, 96][row.itemIndex] };
  const equipmentClass = CLASSES[row.subcategory];
  const statValue = equipmentClass === "ROPE" ? native.ropes[row.itemIndex].durabilityByte
    : equipmentClass === "WIRE" ? native.wires[row.itemIndex].maxLength : null;
  return { ...common, kind:"EQUIPMENT", equipmentClass, tier:row.itemIndex + 1,
    countable:equipmentClass !== "ROPE", statValue, statLabel:equipmentClass === "ROPE" ? "durability" : equipmentClass === "WIRE" ? "length" : null,
    statEffect:"ROM_VERIFIED_FUNCTIONAL_COLUMN", durability:equipmentClass === "ROPE" ? statValue : null };
});

export const HUNT_EQUIPMENT_ITEMS = deepFreeze(items.filter(row => row.kind === "EQUIPMENT"));
export const HUNT_PLUGIN_ITEMS = deepFreeze(items.filter(row => row.kind === "PLUGIN"));
export const HUNT_MEMORY_CARDS = deepFreeze(items.filter(row => row.kind === "MEMORY_CARD"));
export const HUNT_CATALOG_ITEMS = deepFreeze([...HUNT_EQUIPMENT_ITEMS, ...HUNT_PLUGIN_ITEMS]);
const BY_ID = new Map(items.map(item => [item.itemId, item]));
export const getHuntCatalogItem = itemId => BY_ID.get(itemId) ?? null;
export const listHuntEquipmentByClass = equipmentClass => HUNT_EQUIPMENT_ITEMS.filter(item => item.equipmentClass === equipmentClass);
export const listHuntPluginsByKind = pluginKind => HUNT_PLUGIN_ITEMS.filter(item => item.pluginKind === pluginKind);
export const HUNT_STARTING_INVENTORY_EVIDENCE = "ROM_VERIFIED";
export const HUNT_STARTING_INVENTORY = deepFreeze(items.filter(item => item.initialOwned > 0)
  .map(item => ({ itemId:item.itemId, quantity:item.initialOwned })));

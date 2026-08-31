# One-shot transcription: Shop table structure into a product catalog.
# Reads the research CSV; writes src/data only. Runtime never imports research.

import csv
import json
from pathlib import Path

RESEARCH_CSV = Path(r"R:\NEXUS LINK\原作\YDIJ_RAW_RESEARCH_EVIDENCE\SHOP_REVERSE_CATALOG_118.csv")
OUT = Path(__file__).resolve().parents[1] / "src" / "data" / "championship" / "catalogs" / "shop.r1.json"

CATEGORY = {
    "Training Goods": "TRAINING_GOODS",
    "Hunt Items": "HUNT_ITEMS",
    "Plugins": "PLUGINS",
    "Cages": "CAGES",
}
DOMAIN = {
    "InventoryState": "INVENTORY",
    "CageOwnershipState": "CAGE_OWNERSHIP",
}
# Only SKUs that already exist as product Hunt items. Original has 12 ropes;
# the loadout currently carries three product tiers. Unmapped records still
# exist as shop rows and use shopRecordIndex as their inventory key.
PRODUCT_ITEM = {
    (1, 1, 0): "championship:2026:hunt-item:rope-i",
    (1, 2, 0): "championship:2026:hunt-item:shot-i",
    (1, 3, 0): "championship:2026:hunt-item:wire-i",
    (1, 10, 0): "championship:2026:hunt-memory:card-32",
    (1, 10, 1): "championship:2026:hunt-memory:card-64",
    (1, 10, 2): "championship:2026:hunt-memory:card-96",
}


def main():
    records = []
    with RESEARCH_CSV.open(encoding="utf-8-sig", newline="") as handle:
        for row in csv.DictReader(handle):
            category_raw = int(row["category_raw"])
            sub_raw = int(row["subcategory_raw"])
            item_index = int(row["item_index"])
            sub_name = row["subcategory"]
            rec = {
                "shopRecordIndex": int(row["record_index"]),
                "category": CATEGORY[row["category"]],
                "subcategory": sub_name.upper().replace(" ", "_").replace("/", "_"),
                "itemIndex": item_index,
                "unlockKind": row["unlock_kind"],
                "unlockParameter": int(row["unlock_parameter"]),
                "unlockEvidence": row["unlock_semantic_confidence"],
                "initialOwned": int(row["initial_owned"]),
                "maxOwned": int(row["max_owned"]),
                "unitPriceBits": int(row["unit_price_bits"]),
                "purchaseDomain": DOMAIN[row["purchase_commit_domain"]],
                "displayName": f"{sub_name} {item_index}",
            }
            product_id = PRODUCT_ITEM.get((category_raw, sub_raw, item_index))
            if product_id:
                rec["productItemId"] = product_id
            records.append(rec)

    if len(records) != 118:
        raise SystemExit(f"expected 118 records, got {len(records)}")
    counts = {}
    for rec in records:
        counts[rec["category"]] = counts.get(rec["category"], 0) + 1
    if counts != {"TRAINING_GOODS": 4, "HUNT_ITEMS": 49, "PLUGINS": 30, "CAGES": 35}:
        raise SystemExit(counts)

    payload = {
        "schemaVersion": 1,
        "authority": "CHAMPIONSHIP_2026_PRODUCT",
        "catalogKind": "championship:2026:catalog:shop",
        "sourceEvidence": "VERIFIED_BINARY_STRUCTURE",
        "nameEvidence": "PRODUCT_AUTHORED_SLOT_LABEL",
        "recordCount": 118,
        "walletCapBits": 9_999_999,
        "records": records,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2) + "\n", encoding="utf-8")
    print(f"wrote {OUT}")


if __name__ == "__main__":
    main()

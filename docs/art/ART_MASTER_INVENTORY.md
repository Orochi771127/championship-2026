# Championship Art Master Inventory

> Generated deterministically from `ART_ASSET_REGISTRY.json`. This is an Art-A audit, not a runtime manifest or a rights grant.

Total production decision units: **1248** (752 from the original filesystem audit, 496 recovered by reconciling against the ROM binary).

## Domains

| Status | Count |
|---|---:|
| `BATTLE_FIELD` | 12 |
| `CHARACTER` | 448 |
| `CHARACTER_ANIMATION` | 60 |
| `MAP` | 60 |
| `THREE_D` | 6 |
| `UI` | 449 |
| `VFX` | 213 |

## Dispositions

| Status | Count |
|---|---:|
| `REBUILD` | 1248 |

## Shipping states

| Status | Count |
|---|---:|
| `ORIGINAL_REPLACEMENT_REQUIRED` | 1248 |

## ROM reconciliation

Census: `docs/art/ROM_ART_CENSUS.json` (ROM SHA-256 `8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`).

The original audit scanned an extracted research filesystem by file extension and reported every baseline as `MATCH`, because expected and observed were both taken from that same scan. Re-deriving the census from the ROM's FAT/FNT recovered four art tiers it could not see and corrected three baselines. See `ART_ROM_RECONCILIATION.md`.

## Owner gate

**ART-A COMPLETE; STOP AWAITING OWNER APPROVAL**

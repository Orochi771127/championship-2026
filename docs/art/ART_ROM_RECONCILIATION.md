# Art registry ROM reconciliation

Date: 2026-09-01
ROM: `DIGIMONCHAMP` / `YDIJ`, SHA-256 `8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`
Census: [`ROM_ART_CENSUS.json`](ROM_ART_CENSUS.json) — built by `scripts/build-rom-art-census.py`

## Why the audit needed reconciling

The Art-A registry's 752 decision units came from a scan of an *extracted research
filesystem*. That scan recorded its own mode as `filesystem` and its own status as
`PARTIAL`, and it identified art by file extension.

Its `summary.baselines` block reported all 13 baselines as `MATCH` — but `expected`
and `observed` were both taken from that same scan, so the agreement was
self-referential. It demonstrated that the scan was internally consistent; it never
demonstrated parity with the ROM.

Re-deriving the census from the ROM's own FAT/FNT (6,419 FAT entries, 6,397 named
files, 22 ARM9 overlays) found **6,317 art payloads in 1,705 families**, of which
**716 families were absent from the registry**. Those became 496 new decision units.

Registry: **752 audited + 496 ROM-derived = 1,248 units.**

## What the extension-driven scan could not see

| Gap | Units added | ROM files | Why it was missed |
|---|---:|---:|---|
| `/db_digimon` database character tier | 224 | 1,792 | A second complete 8-file contract per entity. The audit's contract note reads "8 gameplay files per entity" and covered `/digimon` only. |
| `/common` 2D sprite effect library | 187 | 748 | All 26 existing VFX units are Nitro **3D** models (`RAW_3D_*`). The 2D cell-animated effect library had no representation at all. |
| Database-tier animation contract | 7 | — | Read from NANR sequence counts; a contract distinct from the gameplay one. |
| UI families across 9 directories | 73 | 118 | Includes the 7 NFTR fonts — the audit had no typography tier of any kind. |
| Hunt biome `HM00` | 1 | 12 | The terrain reference table starts at HM01. |
| Unattributed `/field` art | 3 | 9 | Belongs to neither the battle catalog nor the biome set. |
| Battle field shared common layer | 1 | 8 | Correctly excluded from the 11-field count, but it is authored art needing its own replacement. |
| **Total** | **496** | **2,687** | |

### The database character tier is genuinely separate art

Of the 1,792 `/digimon` ↔ `/db_digimon` file pairs, only **448 are byte-identical** —
exactly the `.nclr` palettes, which the two tiers share. All 1,344 graphics, cell and
animation payloads differ, at roughly a fifth of the size (`e000_digitama_main.ncbr`
is 3,376 bytes; its `_db_main` counterpart is 624).

The two tiers also declare different animation contracts, read from NANR sequence
counts:

| Tier | Regular entities | Egg entities |
|---|---|---|
| Gameplay Main | 40 slots × 216 | 2 slots × 8 |
| Gameplay Sub | 13 slots × 216 | 2 slots × 8 |
| Database Main | 4 slots × 216 | 1 slot × 8 |
| Database Sub | 3 slots × 216 | 1 slot × 8 |

This also independently confirms the existing `mainAnimationSlots: 40` and
`subAnimationSlots: 13` baselines, and the 216 regular / 8 egg split.

## Baseline corrections

| Baseline | Was | Now | Evidence |
|---|---:|---:|---|
| `huntBiomes` | 16 | **17** | `field_hm00_01` is a complete three-layer field — base tilemap, `_anim` (BSA), `_obj` (OPM/NCER) — with 135 KB of tiles, structurally identical to the documented `hm05` and slightly larger. Not a template. |
| `nitro3dFiles` | 58 | **59** | `battle/circle_my.nsbmd.bak` was skipped for its `.bak` extension. |
| `nitro3dUnique` | 57 | **58** | The `.bak` is a distinct model, not a byte copy. The only byte-identical pair in the ROM is `battle_menu/Desktop_Launcher` ↔ `desktop/Desktop_Launcher`. |

Confirmed unchanged against the ROM: `nxrScenes` 96, `entities` 224,
`entityFilesPerContract` 8, `mainAnimationSlots` 40, `subAnimationSlots` 13,
`cageEnvironments` 40, `battleFields` 11.

`battleFields` stays 11 deliberately: `field_bm00_00` is the shared common layer that
10 of the 11 fields reference (`BATTLE_CYBERSPACE` is the exception), not a twelfth
arena. The code-traced catalog with per-field RAM addresses settles this.

`nxrNodes` (1,369) was not re-derived here; it still rests on the NXR node table.

### Two different sixteens — do not conflate them

| Quantity | Value | Status |
|---|---:|---|
| Biome **nodes** in `gate_select/3D_worldMap_model.nsbmd` | 16 | Unchanged, ROM-verified. Not touched by this reconciliation. |
| Hunt **field groups** (`field_hm*`) | 16 → **17** | Corrected here. |
| Native Hunt field **variants** | 29 → **30** | Corrected here. |

The Gate Select contract's 16 is a count of named node pairs in the world-map model
(Canyon, Crag, Damp, Desert, Factory, Forest, Grass, Ice, Jungle, Mine, Oasis, Ruins,
Savanna, Seaside, Sewer, Volcano). The art baseline's 16 was a count of HM field
groups. They are different things that happened to share a number, and only the
second was wrong.

Recovering `HM00` brings the variant count to 30 — which is exactly the figure
`VS2_GATE_HUNT_RUNTIME_PRESENTATION_CONTRACT.json` already recorded ("there are 30 HM
fields on record and 16 biome nodes"). The runtime contract and the ROM agree; it was
the art audit that was one short. That contract's open unknown stands unchanged:
nothing traced maps a gate node to an HM field, and this reconciliation does not
create such a mapping.

## Production semantics this establishes

Facts a rebuild has to honour, all read from the binary:

- **Main-screen character graphics are NCBR (bitmap); sub-screen are NCGR (tiled).**
  Same `RGCN` magic, different storage. They are not interchangeable.
- **Palettes are shared between the gameplay and database tiers.** A palette decision
  propagates to both; they cannot be recoloured independently without divergence.
- **Hunt fields decompose into exactly three layers:** base tilemap, optional `_anim`
  (BSA), optional `_obj` (OPM/NCER cells).
- **Battle fields composite a shared layer.** Replacements must stay consistent with
  `field_bm00_00` or all ten fields drift apart.

## Boundaries this does not cross

The census carries structural metadata only — NitroFS names, sizes, format magics and
counts. No pixels, palettes, tiles, cells or geometry are extracted, so it stays
citable metadata under `research/original-evidence/README.md`.

Every one of the 1,248 units remains `ROM_COPYRIGHTED_REFERENCE` /
`ORIGINAL_REPLACEMENT_REQUIRED` / `REBUILD`. Nothing here promotes anything toward
shipping, and no new art is authorized by this reconciliation.

Semantics that stay gameplay authority and must be traced rather than inferred from
artwork: the `HM00` biome identity, sprite-effect triggers and timing, the database
animation slot meanings, and the consumer of the unattributed `/field` art. Each is
recorded as a blocker on its unit.

## Reproducing

```bash
python scripts/build-rom-art-census.py --rom <path-to-ydij-rom>
```

```bash
python scripts/build-art-registry-correction.py
```

The first reads an owner-supplied ROM (`--rom`, or `CHAMPIONSHIP_YDIJ_ROM`) and
verifies its SHA-256 before emitting the census. The second reconciles the registry
and regenerates every deterministic view. Both accept `--check` to fail instead of
writing, and the correction script is idempotent — it drops and rebuilds its own
contributions, so re-running after a census refresh converges.

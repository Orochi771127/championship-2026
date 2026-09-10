# Championship 2026 — Source to Contract to Replacement Crosswalk

Status: `TASK B COMPLETE / CONFIRMED EDGES PROJECTED BY GENERATOR`

Depends on: `ART_PRODUCTION_MASTER_PLAN_PHASE1.md` Task A result

Scope: all nine production families in the 1,248-unit registry

This document separates binary/research evidence from proposed production architecture. The ROM supplies structural and functional evidence only. It supplies no production pixels, palettes, tiles, cells, textures, or geometry.

Update, 2026-09-01: the previously reported character-ID collision and missing dependency projection are repaired in the generators and locked by tests. The collision discussion below remains as the pre-repair diagnosis that motivated the change.

| Family | Units | Source evidence and formats | Confirmed contract and blockers | Original-replacement deliverable |
|---|---:|---|---|---|
| Character | 448 | `/digimon`: 224 gameplay entities. `/db_digimon`: 224 database entities. Each tier has eight files per entity: Main `NCBR` bitmap graphics plus palette/cells/animation, and Sub `NCGR` tiled graphics plus palette/cells/animation. Of 1,792 tier-paired files, only 448 `.nclr` palettes are byte-identical. | Gameplay and database tiers are related but independent. Main and Sub are not interchangeable. One new palette decision is shared across tiers, but graphics, cells, animation, and scale are not. | Two tier-qualified packages per entity: `gameplay/{main,sub}` and `database/{main,sub}`, linked to one original palette-decision record. Database art must be authored independently, never resized from gameplay art. |
| Character animation | 60 | NANR sequence-count contracts: gameplay Main 40, gameplay Sub 13, database Main 4, database Sub 3. Regular entities: 40/13/4/3; eight eggs: 2/2/1/1. | Preserve raw slot ID, tier, screen role, and contract shape. Slot meaning is trace-blocked and cannot be inferred from poses. | Tier-specific animation manifests and authored frame families. Keep `rawOriginalSlot` distinct from any later `modernSemanticAction`. |
| Hunt | 17 | Seventeen `field_hm*` groups and 30 native variants. Base tilemap, optional `_anim`/BSA animated terrain, optional `_obj`/OPM plus NCER cells. | Three layers are mandatory. HM00 identity/effects are blocked. Sixteen Gate nodes and thirty HM variants have no traced mapping. | Per-variant base, optional animation, and optional object packages with separately bound gameplay data. A 9:16 screen is a camera viewport over the world, not a flattened crop. |
| Battle | 12 | Eleven arena records plus `field_bm00_00`, the shared layer. Layered 2D target; two arena animated layers remain trace-blocked. | Ten arenas consume one canonical shared layer. `field_bm07_01` / `BATTLE_CYBERSPACE` is the sole exception. | One canonical original shared-layer asset plus eleven arena-specific layered packages. Dependent arenas reference the canonical package instead of copying it. |
| Cage | 40 | Forty `field_cm01_01`–`field_cm40_01` records. Technical witnesses show core fields, separate object placement/cells, ATR/COL data, and optional animated terrain. | Structure does not grant semantics. Terrain shape meaning, assembly rules, stat bonuses, and runtime bindings stay blocked. Visual QA silhouettes are not collision masks. | Clean-room `core-field + optional animated terrain + optional objects` visual packages. ATR/COL and gameplay definitions remain external authorities. |
| UI | 449 | 96 NXR scenes / 1,369 nodes, background and sprite families, recovered families in nine directories, and seven NFTR fonts. | Main/Sub are functional roles to recompose. NXR coordinates and 256×192 dual-screen placement are not final layout. Two Battle scene-role records remain trace-blocked. | DOM/CSS interface with optional Pixi decoration; original SVG/raster ornament, frames, icons, 9-slice panels, and seven original/licensed typefaces. Text and interaction semantics stay code-native. |
| VFX | 213 | 187 `/common` 2D cell-animation families covering 748 ROM payloads, plus 26 Nitro 3D effect families using NSBMD and associated tracks where present. | The 187 2D families are visual inventory only; caller, trigger, timing, and gameplay meaning are blocked. A 3D effect never promotes the surrounding scene to 3D. | Original Pixi sprite/particle families or bounded Three effect bundles selected by verified media role, with reduced-flash/motion variants and provenance. Runtime code owns triggers and timing. |
| 3D | 6 | Six non-VFX scene assets: `battle_menu/launcher13`, `battle/world_map`, `battle/world_map2`, `desktop/Desktop_Launcher`, `gate_select/3D_worldMap_model`, and `gate_select/earth`. | Two Gate records require camera/input trace. Sixteen model node pairs do not prove a Hunt mapping. Source geometry cannot become a production mesh. | Clean-room DCC masters and GLB/glTF 2.0 exports with deliberate scale, transform, pivot, topology, UVs, materials, LODs, and collision proxies. Three.js stays bounded. |
| Field unattributed | 3 | `/field/battle_01_01`, `/field/battle_08_01`, and `/field/battle_15_01`; nine ROM files total. | Consumer is unknown. Filenames or appearance cannot assign them to Battle, Hunt, UI, or VFX. | No semantic production yet. Reserve neutral IDs until a trace chooses the correct contract. |

## Character identity correction required before production

The 448 character records currently collapse to 224 unique `productionAssetId` values. Every collision pairs one gameplay record and one database record for the same entity. This is a generator defect, not a valid package alias.

Recommended generator output shape:

```text
production:character:gameplay:<entity-id>
  -> gameplay-main
  -> gameplay-sub

production:character:database:<entity-id>
  -> database-main
  -> database-sub

production:palette-decision:<entity-id>
  -> referenced by both tier packages
```

The production system must retain 448 character records and 224 explicit shared palette decisions. It must not use the current collided ID as a filename, output directory, manifest key, cache key, or approval identity.

## Evidence boundary

Evidence claims in this crosswalk are limited to counts, paths, formats, structural relations, sequence counts, and blockers recorded by the four authoritative files and current technical receipts. Package names, master formats, runtime formats, and manifest edges are Phase 1 recommendations for Task C; they are not claims about untraced ROM behavior.

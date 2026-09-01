# Championship 2026 — art production brief

Issued 2026-09-01, after the Art-A registry was reconciled against the ROM binary.
This supersedes any batch plan drawn against the old 752-unit registry.

## Read these first

| File | What it gives you |
|---|---|
| `docs/art/ART_ROM_RECONCILIATION.md` | Why the old audit was short, what was recovered, corrected baselines |
| `docs/art/ART_ASSET_REGISTRY.json` | 1,248 decision units — the work list |
| `docs/art/ART_PRODUCTION_CROSSWALK.json` | 1,248 production records, batch assignments |
| `docs/art/ROM_ART_CENSUS.json` | ROM ground truth: every art family, its files, sizes, formats |

## Scope split

**Yours:** art masters only — characters, cages, field maps, UI, VFX, fonts.

**Not yours** — do not edit these; if a unit looks wrong, report it rather than patching:

- `docs/art/ART_ASSET_REGISTRY.json`, `ROM_ART_CENSUS.json`, `ART_ROM_RECONCILIATION.md`, `ART_PRODUCTION_CROSSWALK.json`
- `scripts/build-rom-art-census.py`, `scripts/build-art-registry-correction.py`
- `CLAUDE_*`, contracts, runtime traces

The registry and its views are generated. Hand-editing them is overwritten on the next
`npm run art:reconcile:build`.

## What changed: +496 units

The old audit scanned an extracted filesystem by file extension and missed four whole
art tiers. Re-deriving from the ROM's FAT/FNT recovered them.

| Recovered | Units | ROM files |
|---|---:|---:|
| `/db_digimon` database character tier | 224 | 1,792 |
| Database-tier animation contract | 7 | — |
| `/common` 2D sprite effect library | 187 | 748 |
| UI families incl. 7 NFTR fonts (9 directories) | 73 | 118 |
| Hunt biome `HM00` | 1 | 12 |
| Unattributed `/field` art | 3 | 9 |
| Battle field shared layer `field_bm00_00` | 1 | 8 |

Crosswalk families now: character 448, ui 449, vfx 213, character-animation 60,
cage 40, hunt 17, battle 12, 3d 6, field-unattributed 3.

## Production semantics — read from the ROM, not negotiable

These are how the original was actually built. Reproduce the behavior, not the pixels.

1. **Main-screen character graphics are NCBR (bitmap); sub-screen are NCGR (tiled).**
   Same `RGCN` magic, different storage. They are not interchangeable, and a main-screen
   master cannot be reused as a sub-screen one.

2. **Palettes are shared between the gameplay and database character tiers.** The 448
   `.nclr` files are byte-identical across `/digimon` and `/db_digimon`. A palette
   decision propagates to both tiers — you cannot recolour one independently without
   breaking parity with the other.

3. **Hunt fields decompose into exactly three layers:** base tilemap, optional `_anim`
   (BSA), optional `_obj` (OPM/NCER cells). Author to that separation; do not flatten.

4. **Battle fields composite a shared layer.** 10 of the 11 fields reference
   `field_bm00_00`; `BATTLE_CYBERSPACE` (bm07) is the only exception. Replace the shared
   layer once and keep all ten consistent with it, or the arenas drift apart.

5. **Animation contracts differ per tier**, read from NANR sequence counts:

   | Tier | Regular (216 entities) | Eggs (8 entities) |
   |---|---:|---:|
   | Gameplay Main | 40 slots | 2 |
   | Gameplay Sub | 13 slots | 2 |
   | Database Main | 4 slots | 1 |
   | Database Sub | 3 slots | 1 |

## The database tier is a separate deliverable

`/db_digimon` is **not** a resized gameplay sprite. Of 1,792 file pairs, only the 448
palettes are byte-identical; every graphics, cell and animation payload differs, at
roughly a fifth of the size. It has its own 4-Main / 3-Sub animation contract.

Budget it as its own per-entity deliverable: 224 entities × (db Main + db Sub).

## UI: one 9:16 screen

The dual-screen → single portrait 9:16 restructure is the **only** sanctioned structural
deviation from the original.

- Preserve original function, information hierarchy and behavior semantics.
- Never port NXR coordinates literally. The 96 NXR scenes / 1,369 nodes are a functional
  inventory, not a layout to transcribe.
- Main and sub content must be *recomposed* for one screen, not stacked into a tall strip.
- Protect the playfield; touch-first, safe-area aware.

## Do not invent — these need a code trace

Each is recorded as a blocker on its unit. Keep the art neutral until traced:

- `HM00` biome identity and terrain effects
- 2D sprite effect triggers and timing
- Database-tier animation slot meanings
- The consumer of `/field/battle_01_01`, `battle_08_01`, `battle_15_01`
- Any gate-node ↔ HM-field mapping. There are 16 biome nodes in the Gate Select model and
  30 native HM field variants, and **nothing traced connects them**. Do not imply one.
- Cage terrain shapes, assembly rules and stat bonuses

Two unrelated quantities are both "16": the Gate Select model's biome **nodes** (correct,
unchanged) and the old HM **field group** count (was wrong, now 17). Don't conflate them.

## Rights gate

All 1,248 units are `ROM_COPYRIGHTED_REFERENCE` / `ORIGINAL_REPLACEMENT_REQUIRED` /
`REBUILD`. Currently 0 `shippingReady`, 0 `readyForRuntime`.

- Never copy source pixels, palettes, tiles, cells, textures or geometry into a master.
- Runtime-loadable art lives only under `assets/production/`.
- Promotion requires licence evidence **and** human visual approval **and** runtime QA.
  Three separate gates; none implies another.

## Gates before you hand anything back

```bash
npm run art:a0:validate && npm run art:reconcile:validate && npm test
```

Browser gates need `npm run serve` up on 127.0.0.1:8732 first, and use system Chrome via
`executablePath` (`CHAMPIONSHIP_CHROME` overrides), not Playwright's bundled browser.

## Lane hygiene

Claude and you edit this tree concurrently. Stage by path; never `git add -A`. If both
lanes have touched the same file, commit the coherent whole and attribute every
cross-lane edit in the message.

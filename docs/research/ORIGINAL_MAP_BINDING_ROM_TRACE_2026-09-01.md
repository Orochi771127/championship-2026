# Original map binding ROM trace — 2026-09-01

## Evidence boundary

- Source: owner-supplied `YDIJ` Nintendo DS ROM.
- SHA-256: `8AD375BA0BD9B652A25F72DEAD2B47F78DA401E188A8F3E1B7A6F2867EE0C5D1`.
- The ROM remains an external research input. No ROM or extracted payload is
  checked into the repository.
- Reproduction command:

  ```powershell
  node scripts/audit-original-map-bindings.mjs <path-to-YDIJ.nds>
  ```

The audit validates the complete ROM hash before accepting any record. Its
output is metadata only: addresses, identifiers, and field names.

## 16 Gate identities -> original Hunt fields

The ARM9 Hunt record family contains 33 records from `0x020CAA98` through
`0x020CB598`: 16 day/night pairs and one tutorial record.

| Gate identity | Day record -> field | Night record -> field |
|---|---|---|
| Canyon | `HUNT_CANYON` -> `field_hm08_01` | `HUNT_CANYON_NIGHT` -> `field_hm08_02` |
| Crag | `HUNT_CRAG` -> `field_hm14_01` | `HUNT_CRAG_NIGHT` -> `field_hm14_02` |
| Damp | `HUNT_DAMP` -> `field_hm05_01` | `HUNT_DAMP_NIGHT` -> `field_hm05_02` |
| Desert | `HUNT_DESERT` -> `field_hm16_01` | `HUNT_DESERT_NIGHT` -> `field_hm16_02` |
| Factory | `HUNT_FACTORY` -> `field_hm10_01` | `HUNT_FACTORY_NIGHT` -> `field_hm10_01` |
| Forest | `HUNT_FOREST` -> `field_hm03_01` | `HUNT_FOREST_NIGHT` -> `field_hm03_02` |
| Grass | `HUNT_GRASS` -> `field_hm01_01` | `HUNT_GRASS_NIGHT` -> `field_hm01_02` |
| Ice | `HUNT_ICE` -> `field_hm13_01` | `HUNT_ICE_NIGHT` -> `field_hm13_02` |
| Jungle | `HUNT_JUNGLE` -> `field_hm04_01` | `HUNT_JUNGLE_NIGHT` -> `field_hm04_02` |
| Mine | `HUNT_MINE` -> `field_hm09_01` | `HUNT_MINE_NIGHT` -> `field_hm09_01` |
| Oasis | `HUNT_OASIS` -> `field_hm17_01` | `HUNT_OASIS_NIGHT` -> `field_hm17_02` |
| Ruins | `HUNT_RUINS` -> `field_hm18_01` | `HUNT_RUINS_NIGHT` -> `field_hm18_02` |
| Savanna | `HUNT_SAVANNA` -> `field_hm02_01` | `HUNT_SAVANNA_NIGHT` -> `field_hm02_02` |
| Seaside | `HUNT_SEASIDE` -> `field_hm06_01` | `HUNT_SEASIDE_NIGHT` -> `field_hm06_02` |
| Sewer | `HUNT_SEWER` -> `field_hm11_01` | `HUNT_SEWER_NIGHT` -> `field_hm11_01` |
| Volcano | `HUNT_VOLCANO` -> `field_hm15_01` | `HUNT_VOLCANO_NIGHT` -> `field_hm15_02` |

Tutorial is not one of the 16 Gate identities:
`HUNT_TUTORIAL` -> `field_hm00_01`.

This mapping is implemented in
`src/championship/gate/originalHuntFieldBindings.js`. The exact original
day/night selection call remains a separate trace; the runtime therefore
stores both verified alternatives and does not invent a selector.

## 40 CM art fields -> 36 CageDefinitions

Reverified against OVL15's indexed text reader and all 35 shop itemIndex joins
on 2026-09-05. The mapping below is unchanged and correct. The pointer-column
base is not the name-column base; see
[Cage identity trace](CAGE_IDENTITY_BINDING_ROM_TRACE_2026-09-05.md) for the
complete names/effects/fields crosswalk and the rejected shifted-text handoff.

The contiguous ARM9 Cage visual table contains 37 records, 0x28 bytes each,
from `0x020C8CC0` through `0x020C9260`.

- CageDefinition `0..26` -> `field_cm01_01..field_cm27_01`.
- CageDefinition `27..34` -> `field_cm30_01`, `field_cm31_01`,
  `field_cm32_01`, `field_cm34_01`, `field_cm35_01`, `field_cm37_01`,
  `field_cm39_01`, `field_cm40_01`.
- CageDefinition `35` (Waiting Room) -> `field_cm28_01`.
- The 37th table record is `field_cm29_01` (Lid), a structural visual rather
  than a CageDefinition.
- `field_cm33_01`, `field_cm36_01`, and `field_cm38_01` exist in the ROM asset
  set but are not referenced by this Cage visual table. They remain available
  as research assets and must not be assigned to definitions by guesswork.

The runtime-neutral binding is implemented in
`src/championship/presentation/originalCageVisualBindings.js`.

## Water/lava animation timing

The BSAR files provide exact per-frame duration integers. These are preserved:

- Hunt: HM00/01/06 use `20,20`; HM05 uses `40,40`; HM10/11 use
  `13,12,12`; HM15 uses `50,50`; HM17 uses `22,22`.
- Cage: CM07 uses `50,50`; CM09/21/39 use `20,20`.

The original ARM9 update routine at `0x0204ED5C` increments the active frame
counter by one on each field-scene update and compares it directly with the
BSAR duration word. Its live field call sites pass the update flag enabled.
The original unit is therefore one DS video/game update, not milliseconds.

The DS video rate is approximately `59.8260982881 Hz`, derived from
`33,513,982 / 6 / 355 / 263`. Runtime conversion is consequently:

`durationMs = rawTicks * 1000 / 59.8260982881`

| Raw ticks | Runtime duration |
|---:|---:|
| 12 | 200.581 ms |
| 13 | 217.296 ms |
| 20 | 334.302 ms |
| 22 | 367.732 ms |
| 40 | 668.605 ms |
| 50 | 835.756 ms |

`src/championship/presentation/originalMapAnimationTiming.js` owns this
conversion. The web runtime accumulates elapsed time, so a temporarily slow
browser frame does not change the original animation speed.

## Rights / release boundary

The ROM proves how the original data is arranged; it is not proof of permission
to redistribute original-derived pixels. `OWNER_REPORTED_LINK_PENDING` means
the owner has reported that the work is licensed, but the repository does not
yet contain a reference to the written permission. Internal research may
continue. Public/store shipping of the faithful-original pack remains gated on
either linked rights evidence or replacement with independently created art.

# Hunt downloaded batch checkpoint — 2026-10-23

14/14 runtime ZIPs archived and verified against the downloaded handoff index. Each package SHA256, byte count, ZIP CRC and indexed runtime member identity passed. HM16 nested ZIP remains archived without duplicate extraction. No Library helper was called.

Local archive: `R:/Projects/Championship2026/hunt-runtime-handoff-20261023/`.
Intake evidence: `LOCAL_INTAKE_RECEIPT.json` in that archive.
Index SHA256: `6912d69218fb0bea4e9edd2697142925d346fbb0d55a36a761d3fe83c2644185`.

## Visual inspection

Reviewed existing or offline reimport renders of every downloaded map. These are appearance inspections, not gameplay, support, mobile or performance tests. Original source packages remain unchanged. Generated inspection PNGs stay private in the archive's `visual-review/` directory.

| Map | Version | Appearance observation / remaining work |
| --- | --- | --- |
| HM02 | v5 | Acacia savanna, roads and caves coherent in supplied day render. |
| HM03 | v6-review | Reimported dense forest, caves and paths coherent. Correct new package used. |
| HM04 | v5-review | Palm forest, terraces, caves and aircraft wing coherent. Aborted v6 not used. |
| HM05 | v7 | Swamp, cypress and paths present; path breaks near water need localized review before final appearance claim. |
| HM06 | v4 | Harbor, containers, crane and shoreline coherent in supplied day render. |
| HM09 | draco-v7 | Mine corridors, tracks, lamps and crates coherent. Runtime needs dark background outside modeled corridors. |
| HM10 | v7 | Factory base present. Expanded layout absent from this package; supplied drain phase models need binding. Known water join issue remains. |
| HM11 | v7 | Sewer base present. Expanded layout absent from this package; supplied drain phase models need binding. Known narrow water/splash join issue remains. |
| HM13 | v6 | Snow/ice terrain present. Dark water patch needs localized appearance correction or confirmation from source lighting. |
| HM14 | v9 | Rocky terrain present. Original-to-extension ground detail/material transition visibly abrupt; not final. |
| HM15 | v6 | Lava field and cliffs coherent in base render. Existing lava phase texture still needs runtime binding. |
| HM16 | v6 | Desert dunes, caves and shipwreck coherent. Authored fixed projection and ground-height sidecars need adapter binding. |
| HM17 | v4 | Oasis, palms and caves coherent. Existing native animation contract/phase binding remains unresolved. |
| HM18 | v3 | Ruins, tiled path and stone landmarks coherent. Authored projection and sampled height sidecar need adapter binding. |

All downloaded candidates declare 2880 x 2880 world / 180 x 180 tiles. This records authored dimensions, not published completion. HM08 separately remains 2048 x 2048 / 128 x 128 tiles.

## Integration state

Commit a83a9c90 contains the minimal production hook for existing HM01/HM08 assets only. No downloaded candidate has yet been added to the public asset selection. No build, push, merge or deployment has occurred in this task.

The downloaded material GLBs are not the same schema as the baked HM01/HM08 assets. Required remaining integration is a bounded adapter in the existing shared Three interface, exact manifest/public selection, matching expansion layout and 2D fallback. The existing authored branch hardcodes HM02 and 37 tree instances; enabling candidates merely by registering their filenames would not load them correctly. Do not claim actual batch integration from presence of files alone.

The source revision remains based on a104acba (CM07 PR74), with earlier swipe and character/database work preserved. CM74 Pages ordering is cleared. No approval action was denied; remaining work is implementation, plus the two absent HM10/HM11 expansion layouts. No functional tests were run or requested.

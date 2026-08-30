# Hunt HD Remaster V1 — HM00–HM06 Production Receipt

Date: 2026-08-31  
Latest batch: `ART_A4_HUNT_HD_REMASTER_V1_HM03_HM06`

## Outcome

The first thirteen Hunt field variants now have deterministic 2× HD remaster candidates, covering HM00 through HM06. Each output is the complete 2048×2048 world. No portrait crop, red missing-region diagnostic, object relocation, recolouring or gameplay-data change was introduced.

The first five-field pilot validated the safe method; the second bounded batch adds eight variants without changing that locked process. These are licensed-source remake candidates, not a runtime or shipping promotion. Owner visual approval and a linked licence record are still required.

## Original Construction Preserved

The authoritative native composite was assembled using the original verified order:

1. BSAR animated terrain, when present.
2. Void-masked core terrain.
3. OPM → NCER/NCBR object placements.

HD processing is applied only after that exact composition. This guarantees that terrain seams, cave mouths, trees, signs, guardrails and other objects cannot be independently restaged. ATR and ESC raw-class data are referenced unchanged.

## Validation

- 13/30 Hunt variants completed through the second batch.
- Every source field remains 128×128 cells and every remaster frame is 2048×2048 pixels.
- HM00_01, HM01_01, HM01_02, HM05_01, HM05_02, HM06_01 and HM06_02 retain both verified animated-terrain frames and their raw timing records.
- HM02, HM03 and HM04 variants correctly remain single-frame fields because no verified animation layer is present.
- All output frames contain zero solid-red diagnostic pixels.
- All transparent pixels have zero hidden RGB data.
- Source object-placement, ATR and ESC files are hash locked and unchanged.
- The build is deterministic and every generated output is hash locked in `hd-remaster-v1/manifest.json`.

## Camera and Memory Contract

Portrait 9:16 is a viewport over the full world, never an exported map crop. The user can drag/pan within clamped world bounds, matching the verified original inverse-delta camera behavior. Runtime must load or stream only the active field; it must not preload all thirty 2048 RGBA maps.

## Next Batch

Expand the same locked process to the remaining seventeen Hunt variants. No visual redesign or object restaging is permitted during scale-up.

# Hunt HD Remaster V1 — HM00–HM02 Pilot Receipt

Date: 2026-08-31  
Batch: `ART_A4_HUNT_HD_REMASTER_V1_HM00_HM02`

## Outcome

The first five Hunt field variants now have deterministic 2× HD remaster candidates: HM00_01, HM01_01, HM01_02, HM02_01 and HM02_02. Each output is the complete 2048×2048 world. No portrait crop, red missing-region diagnostic, object relocation, recolouring or gameplay-data change was introduced.

This pilot validates the safe scale-up method before the remaining twenty-five variants. It is a licensed-source remake candidate, not a runtime or shipping promotion. Owner visual approval and a linked licence record are still required.

## Original Construction Preserved

The authoritative native composite was assembled using the original verified order:

1. BSAR animated terrain, when present.
2. Void-masked core terrain.
3. OPM → NCER/NCBR object placements.

HD processing is applied only after that exact composition. This guarantees that terrain seams, cave mouths, trees, signs, guardrails and other objects cannot be independently restaged. ATR and ESC raw-class data are referenced unchanged.

## Validation

- 5/30 Hunt variants completed in this pilot.
- Every source field remains 128×128 cells and every remaster frame is 2048×2048 pixels.
- HM00_01, HM01_01 and HM01_02 retain both verified animated-terrain frames and their raw 20-tick timing records.
- HM02_01 and HM02_02 correctly remain single-frame fields because no verified animation layer is present.
- All output frames contain zero solid-red diagnostic pixels.
- All transparent pixels have zero hidden RGB data.
- Source object-placement, ATR and ESC files are hash locked and unchanged.
- The build is deterministic and every generated output is hash locked in `hd-remaster-v1/manifest.json`.

## Camera and Memory Contract

Portrait 9:16 is a viewport over the full world, never an exported map crop. The user can drag/pan within clamped world bounds, matching the verified original inverse-delta camera behavior. Runtime must load or stream only the active field; it must not preload all thirty 2048 RGBA maps.

## Next Batch

After this pilot checkpoint passes full repository QA, expand the same locked process to the next Hunt variants. No visual redesign or object restaging is permitted during scale-up.

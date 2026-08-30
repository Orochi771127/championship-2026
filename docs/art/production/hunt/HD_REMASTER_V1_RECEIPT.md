# Hunt HD Remaster V1 — Complete 30-Variant Production Receipt

Date: 2026-08-31  
Latest batch: `ART_A4_HUNT_HD_REMASTER_V1_HM15_HM18`

## Outcome

All thirty Hunt field variants now have deterministic 2× HD remaster candidates. Each output is the complete 2048×2048 world. No portrait crop, red missing-region diagnostic, object relocation, recolouring or gameplay-data change was introduced.

The five-field pilot validated the safe method; three subsequent bounded batches completed the catalogue without changing the locked process. These are licensed-source remake candidates, not a runtime or shipping promotion. Owner visual approval and a linked licence record are still required.

## Original Construction Preserved

The authoritative native composite was assembled using the original verified order:

1. BSAR animated terrain, when present.
2. Void-masked core terrain.
3. OPM → NCER/NCBR object placements.

HD processing is applied only after that exact composition. This guarantees that terrain seams, cave mouths, trees, signs, guardrails and other objects cannot be independently restaged. ATR and ESC raw-class data are referenced unchanged.

## Validation

- 30/30 Hunt variants completed through four bounded batches.
- Every source field remains 128×128 cells and every remaster frame is 2048×2048 pixels.
- All animation records remain source-driven; HM10_01 and HM11_01 each retain all three verified frames, while the two-frame fields retain both frames and raw timing records.
- HM02, HM03 and HM04 variants correctly remain single-frame fields because no verified animation layer is present.
- All output frames contain no large solid-red diagnostic region. HM15 retains only its original sparse red lava highlights; those legitimate source details are not treated as missing-map sentinels.
- All transparent pixels have zero hidden RGB data.
- Source object-placement, ATR and ESC files are hash locked and unchanged.
- The build is deterministic and every generated output is hash locked in `hd-remaster-v1/manifest.json`.

## Camera and Memory Contract

Portrait 9:16 is a viewport over the full world, never an exported map crop. The user can drag/pan within clamped world bounds, matching the verified original inverse-delta camera behavior. Runtime must load or stream only the active field; it must not preload all thirty 2048 RGBA maps.

## Next Batch

The HD candidate catalogue is complete. Next is Owner visual review, then separately authorized runtime streaming, camera, occlusion and physical-device performance QA; no runtime or shipping promotion is implied by this receipt.

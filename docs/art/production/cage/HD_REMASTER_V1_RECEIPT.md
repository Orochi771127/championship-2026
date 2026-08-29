# Cage HD Remaster V1 — CM01–CM10 Production Receipt

Date: 2026-08-29
Batch: `ART_A3_CAGE_HD_REMASTER_V1_CM01_CM10`

## Outcome

The first ten Cage fields now have deterministic 4× HD remaster candidates. They preserve the verified original composition, palette family, OPMD coordinates and flip flags, OPMD → NANR → NCER first-frame bindings, and the original NBS/COL/ATR grid dimensions. No object was moved, added, removed, or recoloured in this batch.

This is the first genuine remaster-processing batch, not the exact-nearest reference baseline and not a hand-redrawn final master. It remains `NOT_RUNTIME_ELIGIBLE` and `NOT_SHIPPING_READY` until Owner visual approval and linked licence evidence are recorded.

## Method

Each source component is processed independently before reassembly:

1. Core NBS terrain is enhanced at 4×.
2. Every decoded NCER/NCBR object cell is enhanced separately.
3. Original OPMD lower-14 sequence IDs resolve through NANR to NCER first-frame cells.
4. Objects are recomposed at exact source coordinates multiplied by four, retaining source flip flags and anchors.
5. Verified BSAR animated-terrain layers are enhanced separately and retained for CM07 and CM09.

The enhancement profile uses a Scale2x-derived binary silhouette as edge authority with premultiplied-alpha bicubic colour reconstruction. This avoids the transparent-edge colour halo found in the rejected bicubic/Lanczos experiments while avoiding the repeated texture artifacts found in the rejected double-Scale2x experiment. Rejected experiments were temporary files and were not committed.

## Validation

- 10/10 fields generated; CM01 through CM10.
- 71 generated files rebuild byte-identically.
- Every field remains aligned to the original 8-pixel grid at a 32-pixel remaster cell size.
- Every core and object-cell image has zero RGB data under fully transparent pixels.
- Every recorded alpha bound scales exactly by 4×.
- Every OPMD coordinate and flip flag matches the exact reference record.
- CM07 and CM09 each retain two decoded animated-terrain frames and raw timing ticks.
- Contact sheet: `hd-remaster-v1/cage-cm01-cm10-remaster-contact.png`.

## CM27 Owner Directive

CM27 is not part of this batch. Its later genuine remake must remove the Owner-identified Digimon mark at the image centre. The exact-original reference baseline remains unchanged for comparison, and CM27 layout, collision, attribute, placement data, and all unrelated visual positions must remain unchanged. Authority: `CAGE_OWNER_ADAPTATION_DIRECTIVES.json`.

## Next Batch

Continue with CM11–CM20 using the same component-faithful workflow. CM27 removal is scheduled for the CM21–CM30 batch and requires a dedicated before/after visual check proving that only the central mark changed.

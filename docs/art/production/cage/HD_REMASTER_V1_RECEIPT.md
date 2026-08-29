# Cage HD Remaster V1 — CM01–CM30 Production Receipt

Date: 2026-08-29
Latest batch: `ART_A3_CAGE_HD_REMASTER_V1_CM21_CM30`

## Outcome

The first thirty Cage fields now have deterministic 4× HD remaster candidates. They preserve the verified original composition, palette family, OPMD coordinates and flip flags, OPMD → NANR → NCER first-frame bindings, and the original NBS/COL/ATR grid dimensions. No object was moved, added, removed, or recoloured. The only visual-content exception is the Owner-directed removal of CM27's centre Digimon logo.

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

- 30/30 scheduled fields generated; CM01 through CM30.
- 265 generated files rebuild byte-identically.
- Every field remains aligned to the original 8-pixel grid at a 32-pixel remaster cell size.
- Every core and object-cell image has zero RGB data under fully transparent pixels.
- Every recorded alpha bound scales exactly by 4×.
- Every OPMD coordinate and flip flag matches the exact reference record.
- CM07, CM09 and CM21 each retain two decoded animated-terrain frames and raw timing ticks.
- CM12 and CM18 retain their verified non-direct object sequence bindings; no cell was guessed or clamped.
- CM27 retains all 12 original object placements. The centre-logo change affects only the recorded native mask, changes zero pixels outside that mask, and leaves alpha and gameplay data unchanged.
- Contact sheet: `hd-remaster-v1/cage-cm01-cm30-remaster-contact.png`.
- CM27 before/after QA: `hd-remaster-v1/fields/field_cm27_01/owner-adaptation-before-after-qa.png`.

## CM27 Owner Directive

CM27 is complete in this batch. The exact-original reference baseline remains unchanged for comparison. The remake removes the centre logo with a bounded native-space polygon and harmonic inpainting from unchanged surrounding pixels, then restores all original object cells at their verified placements. The first row-sampling experiment produced invalid dark bands and was rejected before commit. The accepted result changes zero native pixels outside the mask, preserves alpha, and does not alter CM27 layout, collision, attribute, placement data, or unrelated visual positions. Authority: `CAGE_OWNER_ADAPTATION_DIRECTIVES.json`.

## Next Batch

Continue with CM31–CM40 using the same component-faithful workflow. This final Cage batch includes CM39's verified animated terrain and completes the requested forty-field HD set before the pipeline moves to genuine Hunt-map HD masters.

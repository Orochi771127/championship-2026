# A1 Cage — Original-Structure Production Contract

Status: `REFERENCE STRUCTURE LOCKED / CLEAN-ROOM ART NOT YET RUNTIME READY`

This packet records the production structure for all forty original `field_cm`
visual fields without importing original pixels or binaries. It replaces the
earlier idea of forcing flattened concept modules into four visual PNG layers.

## Verified original construction

Each CM field is a variable-size tile layout with four independently governed
parts:

1. **Core field:** tile graphics, shared palette and layout cells.
2. **Object bundle:** separate cells plus placement records; absent on CM28 and
   CM29.
3. **ATR:** separate raw attribute classes. Their gameplay meaning is not
   inferred here.
4. **COL:** separate raw collision classes. Their gameplay meaning is not
   inferred here.

The remake therefore authors `core-field` and `objects` as separate visual
packages, and keeps `atr` and `col` as separate data packages. Foreground
occlusion is an object rendering property, not a guessed destructive pixel
split. VFX is also separate and may reuse verified timing/graphs only through
the licensed clean-room conversion pipeline.

## Forty-field schedule

The current twelve-module board is a modular visual-vocabulary pilot and does
not represent CM01–CM12. The production sequence for the actual forty fields is:

| Batch | Fields | Exit gate |
|---|---|---|
| 1 | CM01–CM10 | Core/object separation, dimensions, seams and neutral ATR/COL binding pass |
| 2 | CM11–CM20 | Same gate; CM12 and CM18 use the verified OPMD → NANR → NCER binding |
| 3 | CM21–CM30 | Same gate; CM28/CM29 correctly ship without invented object bundles |
| 4 | CM31–CM40 | Same gate, then complete 40/40 contact-sheet and device review |

`CM40_ORIGINAL_STRUCTURE_CROSSWALK.csv` is the authoritative art-production
crosswalk for those four batches. It deliberately keeps the 40 visual fields,
36 functional Cage definitions and 35 shop records as different counts.

## Evidence and rights boundary

- Original evidence remains read-only under the external evidence root recorded
  by `research/original-evidence/README.md`.
- Only names, counts, dimensions, statuses and structural facts are transcribed.
- No ROM-derived PNG, palette, tile, object cell, layout or binary is included.
- All final visuals require new high-resolution clean-room art using the approved
  original-major-palette direction and changed shapes/content.
- CM12 and CM18 were previously misread as direct OPMD-to-NCER indices. The
  verified format chain is OPMD sequence ID → NANR frame → NCER cell; both are
  now fully resolved without clamping, substitution or guessing.

# Cage CM01–CM40 exact-original HD baseline receipt

Date: 2026-08-29

Status: `40/40 VISUAL BASELINES / 40 FULL COMPOSITIONS / OBJECT SEQUENCE BINDING RESOLVED`

## Owner correction applied

The generated CM01–CM10 production packet and its manually arranged staging
previews were withdrawn. The active Cage direction is now 100% original-faithful:
original composition, palette, field shape, tile order, object cell order,
object source coordinates, collision raw classes, attribute raw classes and
art-format parsing are preserved. The only visual transformation in this batch
is deterministic 4× nearest-neighbour enlargement. A review correction also
restores the four verified native BSAR animated terrain layers that the earlier
static archive did not composite.

## Delivered

- 40 exact raw-layer frame-0 composites rebuilt from the verified format chain.
  CM07, CM09, CM21 and CM39 additionally
  receive their verified animated terrain frame behind the static core/object
  layer.
- 40 4× HD images; downsampling every output by nearest neighbour returns the
  exact native RGBA pixels.
- 40 NBS core-tilemap JSON records, including raw tile values and flip bits.
- 40 raw core renders and 40 static-composite renders rebuilt from the original
  binary components. NBS cells use the verified direct
  14-bit tile index with high two flip flags, rather than the standard DS
  10-bit/palette-bank interpretation.
- 40 COL collision grids and 40 ATR attribute grids with every raw class value
  preserved in row-major order.
- 38 OPM object-placement tables using original NANR sequence IDs and source X/Y;
  CM28 and CM29 correctly contain no native OPM layer.
- 38 complete object-cell banks reconstructed from NCER + linear-transfer NCBR
  + NCLR, with every cell exported separately, plus 38 NANR sequence banks and
  every raw frame duration. OPMD words retain their raw value and verified
  whole-cell flip flags; bit 14 is vertical flip and bit 15 is horizontal flip.
  The lower 14 bits select a NANR sequence, whose frame selects the NCER cell.
- 4 BSAR animated terrain bundles decoded from original 8bpp NCGR/NCLR data:
  8 native animation-layer frames, their raw frame-tile tables and raw durations,
  plus alternate complete native/4× composite frames. CM09 therefore includes
  its original water instead of showing that layer as a transparent hole.
- JavaScript parsers for original COL, ATR, NBS, OPM, NANR and BSAR formats, plus the
  deterministic Python build/import pipeline and four review contact sheets.

CM12 and CM18 are no longer partial. Their apparent cell IDs 2, 8 and 9 were
NANR sequence IDs. Resolving those sequences produces valid NCER cells (CM12
sequence 2 → cell 0; CM18 sequences 8/9 → cell 2), with no guessed binding.
Thirteen older archive composites differed because they used the direct-cell
interpretation; those archive images remain diagnostic evidence only.

## Rights and promotion boundary

The Owner reports that the original source is licensed. A linked licence
evidence record is still required before runtime or shipping promotion. This
packet records `rightsStatus:LICENSED` with
`licenseEvidenceStatus:OWNER_REPORTED_LINK_PENDING`, `runtimeEligible:false`
and `shippingReady:false`; ROM and Nitro binaries are not committed.

## Rebuild

Run `scripts/build-cage-faithful-hd40.py` with the verified O3-B archive root
and read-only raw Training directory. `--verify-determinism` rebuilds all 657
files in a clean temporary directory and compares every SHA-256.

The 4× files are an exact-original enlarged reference baseline, not a claim of
newly redrawn resolution-independent art. Any later hand-redrawn HD pass must
retain these raw reconstructions as the placement, silhouette, collision and
pixel-difference authority.

## Owner-approved remake exception

`field_cm27_01` retains its exact original center mark in this comparison
baseline, but the Owner requires that the Digimon mark at the image center be
removed from the genuine hand-redrawn HD master, runtime presentation and
shipping art. No other CM27 terrain/object position, COL, ATR, NBS or placement
data changes under this visual-only directive. The machine-readable instruction
is `CAGE_OWNER_ADAPTATION_DIRECTIVES.json`.

## Follow-up technical QA

`docs/art/production/technical-qa/cage-hunt-exact-baseline/manifest.json`
confirms 40/40 exact 4× block replication and 40/40 NBS/COL/ATR grid alignment.
One un-tinted CM01–CM40 master contact sheet shows all forty art fields at once;
four additional contact pages expose raw collision classes over the unchanged HD images.
The overlay colours are review-only and do not assign passability or gameplay
meaning. CM12 and CM18 are included in the resolved 40/40 set.

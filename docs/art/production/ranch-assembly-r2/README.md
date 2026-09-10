# Ranch assembly R2A — original geometry foundation

Owner continuation: 「好，請你幫我接著開工」. Verified product root `R:/Projects/Championship2026/championship-2026`, branch `main`, HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`. Existing shared changes were preserved. No commit, push or deployment.

## What changed

The original does not universally assign one cage to one hex cell. OVL15 `0x0210C118` reads a 16-entry mask table, checks all occupied bits, and only then writes the cage's position and anchor. Definition 1 uses mask `0b111`, occupying three bits. The 36 definition-to-shape indices are read from ARM9 `0x020C8CBC + index*40`. This is independent of the recommended Digimon capacity in descriptions.

The native board uses column `floor(anchor/2)` and row `anchor%2`, with sprite origin `x=2+24*column+12*row`, `y=8+22*row`. The lower row moves right by 12 pixels; the old alternating-column vertical stagger was wrong. The rank/cover switch is at OVL15 `0x0210C660..0x0210C71C`, not `0x0210B36C`.

The same saved anchor and shape reach the Training compositor through ARM9 `0x02082150..0x02082190`. Its destination **tile** origin is `x=12*column+6*row+((mask&1)?0:6)`, `y=8*row`. These are not flattened image sprite origins. The following copy loop skips three source tile rows for the upper row and wraps at the right edge; special filler handling has its own path. A new whole-image grid would still be incorrect.

The verified arithmetic now lives in the existing [`ranchSlotGeometry.js`](../../../../src/championship/cage/ranchSlotGeometry.js): corrected `ranchBoardCell`, shape metadata, pure `evaluateOriginalCagePlacement`, and `originalRanchFieldTileOrigin`. The latter explicitly returns a tile coordinate space. The editor's legacy placement evidence is corrected to `PRODUCT_AUTHORED_PENDING_ORIGINAL_FOOTPRINT_MIGRATION`; its existing drafts and saves are preserved. No native mask enforcement or automatic save relocation has been bound yet.

## Evidence and verification

Evidence lookup preceded direct ROM analysis: Championship Evidence MCP `search_evidence(cage_edit)` returned the original semantic-status report, NXR node/asset tables and background inventories. Those remain structural source evidence; the arithmetic claims above come from direct execution of the exact Owner ROM (SHA-256 `8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1`).

- [Native receipt](../../../research/ranch-assembly-2026-09-06/native-geometry-receipt.json): 2,560 full placement-call vectors and 320 field-origin instruction-segment vectors. Records and register inputs are synthetic, with actual ARM9 math helpers executed and no function stubs. This is isolated CPU validation, not a live original gameplay trace.
- [Reproducer](../../../research/ranch-assembly-2026-09-06/replay-ranch-geometry.py): source hash check, instruction-window hashes, successful return/budget checks and deterministic `--check`. ndspy, Capstone and Unicorn were already available; no installation needed.
- [Runtime boundary contract](../../../contracts/championship/CHAMPIONSHIP_RANCH_NATIVE_GEOMETRY.v1.json): supersedes the old one-cell assertion and documents unbound consumers.
- JavaScript comparisons against every native vector, invalid-input guards, and preservation of historical placement records: **33 focused tests PASS**.
- [Full regression log](qa/regression.log): **1,118 / 1,118 PASS**, no skipped or todo tests. `git diff --check` PASS.
- No browser visual change was made or claimed. Browser/mobile/physical-device acceptance was not rerun for this arithmetic slice.

The two `*-inspection.txt` files under the research folder are exploratory linear disassembly, including literal pools and data. They are not function boundaries or gameplay proof. The bounded instruction windows in the receipt are the reviewed evidence.

## Remaining R2 work

1. Reproduce the complete native field tile-copy behavior with source cropping, horizontal wrap, empty-space filling, per-field objects and animation origins. Cross-check at least one mixed-size original scene or live trace; keep the single existing Pixi loader/presenter.
2. Trace fixed Waiting Room cells and empty-space filler through editor initialization and commit. Port drop row normalization, remove/restore and native failure rollback together with shape validation.
3. Define compatibility for legacy single-anchor saves which overlap under native masks. Preserve every original record; no silent removal or invented automatic placement.
4. Bind character grounding and touch conversion to the verified field transform. The old Moonwell/Quiet Hollow interaction regions are still prototype semantics even though their outlines were removed in R1.
5. Run normal Cage Edit → Training → Save → Continue with a mixed-size original-valid composition, then the five phone viewports and separately physical-device QA.

Status: **native board coordinates / shape checks / destination tile origins verified and ported; normal native editor and Training compositor not integrated; actor world mapping unknown; R2 partial; shippingReady false.**

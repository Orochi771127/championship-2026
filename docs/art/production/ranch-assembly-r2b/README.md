# Ranch assembly R2B — native tile-copy composition

Owner continuation: 「請接續 開始開工」. Root `R:/Projects/Championship2026/championship-2026`, branch `main`, HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`. Shared changes preserved; no commit, push, deployment or existing-save modification.

## Implemented

[`ranchTileComposition.js`](../../../../src/championship/cage/ranchTileComposition.js) ports three original ARM9 loops into a pure, ordered composition operation. It accepts explicit source tile IDs, raw attributes and collision bytes from external authorities and returns newly allocated tile, attribute, collision and definition-owner planes. It does not create a renderer, ticker, map registry, gameplay collision interpretation or save authority.

| Part | Native source | Preserved behavior |
|---|---|---|
| Ordinary cage | `0x02082874..0x02082994` | Upper-row three-tile crop; native destination origin; horizontal wrap; separate zero/attribute/metadata write rules |
| Empty-space filler | `0x02082A90..0x02082BA0` | Same row crop/wrap but different zero-tile and low-bit attribute rules |
| Bottom wall | `0x02082BC4..0x02082CC8` | Repeats every 12 columns at row 19; changes nonzero graphics only |

The field is 24 tiles high and 84/96/108/120 tiles wide for 14/16/18/20 unlocked cells. Raw flip bits and 16-bit tile-base addition are preserved. Source crop uses source row indices for metadata too; copying only the image rectangle would not reproduce the data planes.

Waiting Room uses definition 35 (`field_cm28_01`); definition 36 (`field_cm29_01`) is the structural filler. Four actual initialization setter segments also executed: definitions/anchors `(35,0), (0,8), (1,4), (15,7)`. They prove these writes in the original initialization code; they are not a complete live New Game trace, nor authorization to reposition a player's historical configuration.

## Verification

Championship Evidence MCP was queried for `020828` before extending the prior direct ROM trace; no existing hit was returned. The exact SHA-256-checked Owner ROM was then read with ndspy and run in Unicorn. No helper/function stubs were used. The original getters, division routine, attribute and collision readers executed with synthetic context structures and real ROM source arrays.

- [Reproducer](../../../research/ranch-assembly-2026-09-06/replay-ranch-compositor.py) and [receipt](../../../research/ranch-assembly-2026-09-06/native-compositor-receipt.json): **582 cases**, **38 source bundles** (35 shop fields, Waiting Room, filler and bottom wall), source hashes and bounded instruction windows.
- Every JavaScript case matches native SHA-256 of **all four output planes**, not just dimensions. Cases include four ranks, both valid rows, right-edge placements, ordered mixed fields/filler/wall, nonzero initial planes to expose accidental overwrites and native startup values.
- Additional focused tests cover distinct ordinary/filler transparency, source-row cropping, wrap destination, 16-bit arithmetic, wall metadata preservation, ordered updates, independent output allocation and invalid-input refusal.
- [Focused log](qa/focused.log): **38 / 38 PASS**.
- [Full regression log](qa/regression.log): **1,124 / 1,124 PASS**, no skipped/todo cases; `git diff --check` PASS.
- The native generator `--check` reproduces the exact receipt.

Raw NBS/ATR/COL research fixtures remain under `docs/research`. Product code imports none of them. No ROM pixels were generated, copied or edited in this slice.

## Integration boundary and next work

The ordinary/filler/wall **tile-copy arithmetic is now implemented**, rather than still awaiting trace. The normal scene is not yet switched: the production Cage manifest currently exposes precomposited frame PNGs, while the native pipeline separately composes tile layers, objects and animated layers. Feeding this algorithm a flattened field image would lose the raw tile/metadata distinctions it preserves. The wall is also outside the current 40-field runtime manifest.

Next: bind separately eligible materials through the existing production index/loader; close object and animation origin consumers; complete the fixed/filler field-record lifecycle; define compatibility for legacy single-anchor saves; then bind the existing presenter and actor/touch transform. No new player-facing screen or inferred gameplay rule was introduced.

Status: **R2B tile-copy port and native comparisons complete; production material provider, normal renderer, original field-record lifecycle and actor mapping remain partial/unbound.** No browser scene or physical-device QA claimed for this pure algorithm slice. See [contract](../../../contracts/championship/CHAMPIONSHIP_RANCH_TILE_COMPOSITION.v1.json).

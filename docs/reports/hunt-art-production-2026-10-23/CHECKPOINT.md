# Hunt art production hook — preparation checkpoint

Base: `a104acba9196ab4981ad5830b7e2f71548b93da7` (CM07 PR74, retaining Dex/swipe changes).

Owner scope: visually review existing large Hunt art, make necessary local art corrections, reuse the existing Three interface and fixed camera, retain 2D fallback, then publish through the normal build process. Functional testing belongs to the Owner. The stopped functional-test task is not resumed.

## Prepared

- The existing application now selects a finite, hash-pinned Hunt Three binding from the actual field ID at the already-owned Hunt mount. No query switch is needed on the approved public origin or loopback.
- Reused the existing `tests/hunt-three-review/overlay` Hunt Three modules from `hm01-3d-normal-play-20261023`; the shared rendering pass, projection, actor adapter, support logic, clock and fallback algorithm are unchanged. Existing Pixi presentation hooks are applied as small hunks to current main.
- Adapted only the loader/binding and the renderer's admission flag for appearance approval. `appearanceApproved` is an explicit trusted binding after exact manifest hash validation. The original source manifests still say `qaApproved: false`; visual approval is not represented as functional QA.
- Copied only the existing HM01/HM08 web GLB, WebP, manifest and ground-height JSON. No Blender or high-resolution source masters enter this branch.
- HM01 is 2880 square / 180 tiles; HM08 remains 2048 square and is **not** an enlarged-map completion.

## Visual evidence

Directly reviewed existing full-map images under `R:/Projects/Championship2026/hunt-3d-20261022/inspect/`:

- `hm01-glb-full.png`, `final-field_hm01_02-f0.png`: coherent day/night forest, cliffs, caves, lake and tram; no obvious broken surface, blank region or compositing seam at this review scale.
- `hm08-glb-field_hm08_01.png`, `hm08-glb-field_hm08_02.png`: coherent canyon appearance and readable day/night terrain; not enlarged.

This is an appearance review of existing renders, not newly captured runtime or phone evidence. Known night support fallback remains unchanged and is a declared limitation.

## Validation and remaining work

`node --check` passed for 18 added/changed JS modules. `git diff --check` passed. No gameplay, capture, TTL, support, QA-save or regression tests were run.

The other 14 exact packages remain pending transfer: HM02v5, HM03v6-review, HM04v5-review, HM05v7, HM06v4, HM09draco-v7, HM10v7, HM11v7, HM13v6, HM14v9, HM15v6, HM16v6, HM17v4, HM18v3. HM03 needs the correct new v6-review package, not the older Library ID. Package-level appearance review and any needed local art fixes remain pending. No speculative bindings or widened geometry validation were added for missing packages.

**This checkpoint is not release-ready:** exact build-input/public-runtime admission, remaining packages, normal build/required checks and publication are pending. No build approval hashes have been falsely refreshed. CM07 ordering is cleared by root's confirmed Pages run `39949804740` success; there is no remaining CM07 wait.

Local worktree is `R:/Projects/Championship2026/hunt-art-production-20261023`, branch `feat/hunt-art-production-20261023`. Its sparse checkout omits only `docs/art/` after the first full checkout encountered Windows file errors in unrelated character source-cell paths. The product root and other writers were not modified.

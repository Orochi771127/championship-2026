# Ranch assembly R1

Scope: complete projection of existing Cage Edit placements into a loaded Raising scene, without new gameplay or unverified coordinates. [Production plan](../../../planning/RAISING_RANCH_PRODUCTION_PLAN_2026-09-06.md).

Implementation:

- `raisingCageArtPlan.js` resolves every current module and its field, preserves slot/module/definition identity, and returns an immutable plan. Unknown modules, missing fields, duplicate slots/modules and out-of-range slots refuse the plan. Empty-ranch previews and explicit art previews are identified separately from player placements.
- `main.js` uses that projection instead of silently filtering missing bindings; it awaits load inside the existing fallback handler, so asynchronous failures are handled there too.
- `runtimeMapArtBundle.js` validates integer positions before allocation and snapshots placement metadata before any await. Loaded fields and diagnostics preserve placement identity, evidence classification, presentation mode and the verified native pixel scale. Temporary coordinates remain `PRODUCT_AUTHORED`.
- Within one composite, repeated frame URLs load once and unload once after every tile is disposed. A later decoding failure cleans up the already prepared sprites and all requested URLs. Assets remains the texture authority; this does not claim cross-composite shared-URL lifetime redesign.
- Owner noticed two rectangles over the cage art. These were the old Moonwell Pool/Quiet Hollow region outlines. The Raising presenter now clears/hides them whenever cage artwork is loaded; the existing input regions are unchanged. A focused scene test checks hidden outlines and successful selection/relocation intent.

No original pixel files were copied or edited. Existing layout coordinates, actor lane positions, Save format, Cage ownership/effects and renderer authority remain unchanged. Original slot/world join coordinates and live Raising transforms remain `UNKNOWN_REQUIRES_TRACE`.

Validation: **20 focused tests PASS**, **1,112 regression tests PASS**, no skipped/todo tests, and `git diff --check` PASS. Logs: [focused](qa/focused.log), [final regression including outline removal](qa/regression-final.log). This verifies assembly plumbing and preservation of existing behavior; original geometry remains partial. The research receipt is separate from runtime acceptance: [ROM entry receipt](../../../research/ranch-assembly-2026-09-06/rom-entry-receipt.json).

Browser normal path on isolated port 8737: New Game → click the egg → drag into the existing lower prototype region (companion panel reports Quiet Hollow) → MANAGE / Cage Edit → place Cage 0, Cage 1, Cage 15 and Waiting Room in slots 1–4 → Confirm → Back → SYSTEM / Save & Quit → reload → Continue. All four cage visuals and the relocated resident restored. The actor-to-actual-cage mapping remains unverified; this is preservation of the existing drag path, not acceptance of original relocation behavior.

Inspected screenshots at requested 390×844 and 320×568; no warning/error logs were reported. No physical-device QA performed. Screenshots: [single cage without outlines](qa/single-no-prototype-outlines.png), [four cages without outlines](qa/four-cages-no-prototype-outlines.png), [restored small-screen scene](qa/four-cages-restored-320x568.png).

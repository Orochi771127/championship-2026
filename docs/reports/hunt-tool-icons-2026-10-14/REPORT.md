# Hunt equipped-item icons

Separate follow-up to globe commit `a4815b2862d1055dc81cb08431d8d079a4a24f10`, based on main `b01ed619`. No main push or deployment from this task.

The Owner's supplied Hunt screenshot shows enlarged low-resolution glyphs and a cage silhouette for meat. Its pixels were inspected locally (440,767 bytes, SHA-256 `d44dc204cede3efc0b5dfa620ac5c53fdc4df3650607dc59e55b212b0e07b306`). This correction uses existing accepted originals; it adds no art, generation, new controls or gameplay.

## Binding

`nativeHuntFieldControls.getState()` now projects the actual equipped `itemId` and `shopRecordIndex`, including all twelve ropes. The Hunt view resolves art through the same canonical item lookup and `shopGoodsPresentation` used by Shop and Loadout. ENTRAP's meat, toy and light variants therefore retain their own item identity; shot variants show their actual ammunition, rather than a shared slingshot.

The hand uses the approved 64×64 `toolbar-point64-r1-20261009/hand-rest.png`. The examples supplied by the parent retain their exact existing bytes and transparency:

| Item | Shop record | Existing raster |
|---|---:|---|
| rope-i | 4 | hunt49/000, 160×160 |
| shot-i / 普通射擊 α | 16 | hunt49/012, 128×160 |
| meat-00 | 34 | hunt49/030, 160×160 |

Images occupy a contained 34×34 CSS-pixel box, with smooth sampling scoped to this new Hunt icon class. Native aspect ratios and full transparent canvases stay intact. Text/counter refreshes preserve the image node. Modern captions flow below it; classic hexagon plates, selection and disabled treatment retain their existing ownership. Missing or invalid art leaves the real tool label available, without substituting the wrong silhouette. Buttons, tool IDs, labels, quantities, tutorial checks, input handlers, consumption and simulation rules are unchanged.

All referenced originals already belong to `ACCEPTED_ORIGINAL_RUNTIME_20261010` and the exact playtest build selection. Source manifest review flags remain provenance; no location guard or commercial-clearance claim is changed. Only five exact code hashes are refreshed in the build-input contract; no asset byte or membership changes.

## Validation

- **15/15 focused checks PASS**, including every one of the 46 equipment identities, loopback/approved-public art parity, invalid identity fallback, read-only projection with zero RNG/consumption, existing all-34-consumable generated-actor integration and all 164 original UI PNG hashes.
- **46/46 rendered equipment variants PASS**, same source as Shop/Loadout.
- Modern/classic × DPR 2/3: **4/4 PASS**, actual 34px boxes, smooth sampling, contained aspect ratio, selected and exhausted states, captions/counters retained without covering the image.
- Missing-art fallback: **2/2 PASS**, readable label and functional selection in both themes. Actual rendered pixels inspected locally; screenshots remain internal QA.
- Final compiled normal UI: **PASS**, New Game/opening → Ranch → Grass Gate → Loadout → real Hunt field → HAND → Ranch, zero page errors and Hunt controls removed on exit.
- Final public-playtest build/validator: **PASS**, 9,414 files, build ID `c29fb5887496e78f454d06acc663513f68a893b79356eca691441ea4a5ec00a0`.
- Preload and scoped whitespace checks: PASS.
- Aggregate `test:ci`: **1,889 pass / 21 fail out of 1,910**. These are exactly the prior missing-prerequisite cases after the desktop assertion correction, with no new failure. Existing research/contact-sheet images, CPU receipts/CSVs and non-build HUD images are absent from this sparse checkout. The complete integration workspace must rerun full CI before publication; no tests were disabled or reclassified.

Physical-device Safari acceptance remains unverified. Parent coordinates serial integration with the independent medal and Dex work, followed by the existing publication checks.

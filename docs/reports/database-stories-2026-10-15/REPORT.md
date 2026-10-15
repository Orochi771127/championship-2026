# Reviewed Database integration

This candidate extends latest main `302a287085fafac4e95986f006fc330619be5df8` (Hunt PR #3 and shadow PR #4). The complete main tree, shadow source and shadow build/test registrations are preserved; the shared stylesheet receives only the Dex suffix. No candidate main.js, portraitFrame.js, medal, evolution or gameplay changes are imported.

- 216 ordinary species / 1080 nonempty locale strings; corrected profile SHA256 `032d67ada58ba3ee5e05fca4c99a2c896f7e24a6d56a2c6c9936f8adcbc6b6cd`.
- First twelve entries remain exact to their accepted receipt, projection SHA256 `50a6c4e9f186589e2a1e817527b204ad65005a4bf09b937341f6be77d0723ca7`.
- Only B101–B112 hero portraits, verified against their twelve recorded asset hashes. Other species use existing art/neutral fallbacks.
- Attribute/family are species traits. Individual HP/TP badges are omitted; move power/actionCost retains native mapping and TP cost semantics.
- Existing registration guard precedes prose, hero and move sections; save, rules, IDs and writers are unchanged.
- Locale coverage registers only exact Dex dictionaries/profiles; negative missing/blank/stray/cross-file checks remain strict. The compact-menu test extracts actual gated rules instead of counting unrelated appended Dex CSS.

Prior isolated acceptance: 108/108 targeted tests; five fresh-page languages, exact B101 and corrected UL02 prose; ten actual Home/Dex close/reopen cycles and forty registered/unknown/nonhero transitions; 26 decoded nonblank hero regions (B101 captured 16 times, B102 captured 10 times); 41 screenshot hashes and 16 locally inspected images; no uncaught browser errors. Repeated entry exposed a QA-only ambiguous System selector, now restricted to the real button. Raw-source acceptance is separate from final integration CI/build. Screenshots and synthetic saves are not committed.

Final required checks run on the PR head: full `npm run test:ci`, `npm run build:playtest`, `npm run validate:playtest`. CI now executes the latter two after the existing complete deterministic suite; no deploy job is added to PR checks. Public-playtest selection is refreshed only for these 18 runtime files (six modules/data/styles plus twelve portraits), preserving Hunt hashes. Native-speaker review, physical devices, commercial rights and full original parity are not asserted. Merge/publication remains serially coordinated; the shadow batch is separate.

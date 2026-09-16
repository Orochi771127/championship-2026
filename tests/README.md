# Verification

`npm test` runs deterministic runtime, presentation-contract, migration-firewall, and asset-registry checks. `npm run test:browser` performs the VS1 real reload/continue flow and responsive gate. `npm run test:browser:vs2` walks the VS2-P Gate/Hunt/Return flow at every contract viewport, captures 390x844 and 393x852 evidence, and verifies the Player/Developer evidence split. `npm run test:browser:vs2-r1` verifies the bounded Three.js Gate presentation, the 2D fallback and the transition to Hunt Loadout.


Cage authoring proof (single `field_cm01_01`, no new art): `npm run art:cage:proof`, then `npm run test:cage:proof` (Python/Pillow; tested with Pillow 12.3.0) and `node --test tests/championship-cage-authoring-contract-cases.mjs`. Generated templates, comparison images and receipts stay in `.tmp/cage-authoring-proof/field_cm01_01`.

`npm run test:browser:convergence` reuses the real app opening, canonical autosave and existing `cageArt` preview/normal ranch at 390x844, 820x1180, 1024x1366 and back to 390x844. Start the existing server at port 8733 or set `CHAMPIONSHIP_QA_URL`. It intercepts only the pilot production PNG with the byte-identical rebuilt PNG; it does not alter production manifests. Reports go to `.tmp/browser-qa/convergence`. This is browser acceptance, not physical-device or persistent-side-pane acceptance.

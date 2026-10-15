# Three identified character contact corrections

This is a separate measured-contact patch after `ffa5c9e7ac81ca812fd450a577eb90325dcb1ffc`, the accepted height/flip compensation. Asset/source base is `b01ed619375641f5578b2bc65883ebfa32ad8914`. The earlier silhouette prototype is not used, imported, enabled or packaged here. No remote main write or publication was performed.

Parent independently identified the owner screenshots from selected atlas pixels, bounded cell comparisons and facing. This continuation uses that new identity evidence; the blocked Library screenshots were not retried. I independently inspected the exact approved atlas pixels and anatomical support bands locally. The screenshot `worldZ` remains unknown; the controlled renderer checks below cover ground, lift, intermediate height and landing explicitly.

| Reference | Identity / exact delivery | Matched raw source frame | Main atlas SHA-256 |
|---|---|---|---|
| IMG_3984 | species-023 / m104_tunomon / m104_tunomon-early64-raw-v2-r01 | seq0/frame0/cell0, 31 ticks, unmirrored | 32b9dbbf2141a8e3fc50ced49cef1f5550ad6c11beb0059ebee67ac15545f4c0 |
| IMG_3985 | species-013 / m006_punimon / m006_punimon-early64-raw-v2-r01 | seq13/frame0/cell23, 37 ticks, unmirrored | 25eccc707afdcc757837b0fb8aa178b2e37bc0eba16c6c3741e1e4e68af8f480 |
| IMG_3986 | species-036 / m203_elecmon / m203_elecmon-final-growth38-20261007 | seq0/frame1/cell1, 22 ticks, mirrored | d125d563dc1199d1dbd93224a8c2b59c43322ccbbcb8ba6788b8fdc95b81b5ed |

All are under `assets/production/characters/accepted-20261010/`. Original reference IDs are respectively `libfile_6fb414fa01148191a0ba489a47933f9a`, `libfile_1e2e1f6a50d48191ae3c21d48f6a7b79`, and `libfile_c0b4f1c984e48191bc0a248c20adb066`. Parent attribution is provenance, not a claim that this executor reopened the photographs.

## Measured result

The generic footprint was one ellipse at `(0,4)` with radii `(11,4)`. Its side edges do not support off-center paws even when the center touches the lowest body point. The new small ellipses use manually reviewed solid sole/belly bands, excluding tails, ears, horns and flame. The padding is 2 packed pixels horizontally and 1 vertically, rather than deriving size from the sprite canvas or full alpha width. No runtime pixel segmentation or alpha readback was added.

- Tunomon: three visible idle paw groups. Cell0 centers are `(-5.75,-0.5)`, `(1,-0.5)`, `(8.75,-1)` in Hunt world units. Cells0/1 and planted walk cell4 have reviewed support bands. Walk cell5 has all feet above the rest plane (`nativeBounds.bottom=-2`, or 4 Hunt units above `worldY`), so it keeps the idle landing footprint and the visible air gap. No body is moved downward to hide it.
- Punimon: the low round-body support bands in cells0/1/4/5 use one proportional contact ellipse. The exact flattened seq13/cell23 uses the reviewed lower belly band `[75,150,109,153]`, producing center `(-2,0)`, radii `(9.5,1.25)`. It is not named sleep/down/flight: its semantic alias is null, and a flattened image does not prove its gameplay state. Other raw requests reusing a cell do not automatically inherit this pose-specific exception. A lifted pose retains the idle landing footprint.
- Elecmon: four visible claw support bands in cells0/1/4/5. Requested cell1 centers are `(-16.75,-1)`, `(-3,-0.5)`, `(7.25,-2)`, `(20,-1)`. Each radius is measured from a paw band; the raised ring tail and tail-inclusive full width never set the footprint size. Horizontal mirroring carries the four supports with the body.

[pixel-measurements.json](pixel-measurements.json) records exact atlas rectangles, packing geometry, sequence/frame references and manually selected pixel regions. Alpha >=128 is used only offline to measure the reviewed bands. Right/bottom coordinates are exclusive. Twelve support cells were reviewed across these three bodies, plus Tunomon's known airborne walk pose. Other poses remain explicitly unknown and cast the reviewed idle landing footprint without changing body placement. No whole species is declared flying or grounded, and no all-216 visual acceptance is claimed.

## Guard and integration

`completedOriginalCharacters.js` supplies immutable presentation metadata only after the existing runtime/motion/origin validator accepts the loaded delivery. New profiles require the exact entity ID, delivery folder, Main side and source-bank SHA, plus the existing scale, sourceSize, origin and nonblank checks. Missing metadata, another folder, Sub, changed bank/geometry or baseline art uses the accepted generic compensation. The source-bank hash is provenance, not a claim to hash decoded pixels every frame; exact main image bytes are independently pinned by this receipt, Node tests, browser startup SHA checks and the existing hash-selected build policy.

The normal app already calls this adapter in `main.js` when `isOriginalRuntimeLocation` is true. The Hunt renderer receives the metadata on the existing actor and passes it to the existing shadow helper. No new runtime module, application, ticker, animator or asset was introduced. Existing species-034/218 measurements and their padding are unchanged.

Body origins, authored per-cell displacement, worldZ, native requests, AI, collisions, battle, selection and capture semantics are untouched. `nativeHuntCharacterAction.js` and `intRh2/raisingNativeSizing.js` remain byte-identical to b01, including egg rest contact. Their SHA-256 values are `57371822bc1d63ac0a5e22df60216062b37e3669640b742f62f0bf799d4a4227` and `b6930acefb76ceda18742d5f5382e618995607eca544e25463250e07c9e91fae`. No player data, concurrent candidate, Owner8732 or Anti58360 was accessed or changed.

## Executed validation

- 16 focused contact/renderer tests pass, including exact atlas byte hashes, paw centers, flattened support, wrong delivery/side/bank/geometry rejection, both facings, lift/landing, vertical flips, unchanged body anchors and Tunomon's authored air pose.
- 50 affected Node tests pass overall, covering those 16 plus native animation, Raising sizing/egg contact, loader/queue/cancellation, all-224 Main frame projection and feedback regression. [test-receipt.json](test-receipt.json) contains the exact command and exclusion; [node-tests.tap](node-tests.tap) is the executed output. One existing complete-224-art pixel-file audit is excluded because the 503 baseline image inputs were not fetched into this sparse checkout. It is not claimed passing. Full CI/build and normal player entry remain for parent release coordination.
- [browser-validation.json](browser-validation.json) records 288 real Pixi 8.19.0 actor cases through the actual completed-original loader and Hunt renderer. Six actors cover both facings for the three exact art identities, reference/idle0/idle1/walk0/walk1/raw4 poses, vertical flips and heights `0,18,6,0`. Every case preserves body `worldY-worldZ`, anchor and native scale, and leaves each ellipse on its reviewed ground reference.
- The browser uses a loopback-only asset-root alias from the existing internal-review root to the exact selected atlas files. This tests the real validator and metadata wiring without modifying the product manifest, assets or private candidates. It uses the existing Playwright/Chromium installation, one application-owned stage and temporary port 8846. The server exits. Cleanup leaves zero scene roots and restores the one baseline stage ticker listener.
- I viewed generic-versus-measured reference screenshots and the walk/air cases locally. The three reference poses gain support beneath the actual paws/belly; Tunomon's raised walk/body poses remain raised. Browser screenshots stay outside the reports in `contact-browser-inspection`; none is included in the Library handoff. This contact patch makes no FPS, battery or full-device performance claim.

Reproduce pixel measurements with `python scripts/audit-reviewed-contact-pixels.py`. With existing Playwright and Chromium, set `CHAMPIONSHIP_PORT=8846`, run the existing `webapp-testing/scripts/with_server.py` helper with server `node scripts/serve.mjs`, port 8846, and command `python scripts/validate-measured-contact-browser.py`. Exact Node arguments are in the test receipt. No package was installed.

## Remaining acceptance

The photographed actor identities are now supplied by parent evidence, and their exact art cells have independent anatomical review here. The photos' runtime Z/state cannot be inferred from atlas appearance alone. Other poses/bodies, full CI/build, normal game entry and physical-device acceptance remain open. The patch is ready for independent parent review; it does not authorize or perform release. The prior silhouette prototype stays research only.

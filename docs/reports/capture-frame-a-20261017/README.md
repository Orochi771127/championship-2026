# Capture frame A — local integration

The owner-selected original A frame replaces the eight reference slices in the existing Hunt Result view. Its three exact 320×320 SVG masters total 9,184 bytes. Only default is requested initially; multi-catch selection and pending release request the other states when displayed. No preview recording, B frame or unapproved candidate control surfaces are added.

The existing registered HUD portrait source, species IDs, instance IDs, names, selection/release intents, 24-character input bound, memory-card capacity and save/retry logic are preserved. No gameplay, save, character animation, main loading code or Raising presenter is changed. Existing ceremony skip/reduced-motion/background/disposal behavior remains. Explicit frame aperture sizing and bounded row thumbnails prevent portrait overflow, including classic-theme grid rows.

Shared UI authority constants now live in a side-effect-free module. Gate/Hunt retains its existing exports, while the result view no longer imports the whole Gate/Hunt view just for those constants. This removes the result view's indirect static dependency on the old assembled reference index without changing other views or granting the index any public permission.

## Validation

- 41 existing focused Node checks passed: mounted translated views, multi-catch naming, release/errors, public asset boundary, shop projection, Hunt loadout contracts, memory capacity and real domain capture → card → save → continue.
- Installed Chrome 155 controlled production-view checks passed at 390×844, 844×390 and 1366×768 across arena/night/clear/warm/classic: 15 conditions, decoded A frame, visible/contained portrait and thumbnails, no horizontal overflow, native target height at least 44px, no old frame slices.
- Five-language two-catch layout, naming before selection, correct selected portrait ID, release cancel/confirm, protected resident, disabled Home while confirming release, save-failed/roster-full messages and keyboard retry, reduced-motion settling, missing portrait and disposal passed. The fixture invokes the actual production view and its unchanged intent API; it does not claim to exercise a complete normal browser Hunt session or real storage errors.
- Initial frame requests: 1; distinct A assets used across states: 3; private reference/index requests: 0; page errors: 0. See `BROWSER_RESULTS.json`. Portable reproduction: `node tests/championship-capture-frame-a-browser.cjs` with the project's existing Playwright dependency and installed Chrome.
- Runtime source paths/hashes and required module entries are updated in the normal build inputs and closed public allowlist. The original private authority index remains unchanged, SHA-256 `3e7b7694a88c3b7d75e444b1e04bb769923480bfeecb2df19e68005c6b6eb87f`. Existing 39-master history, species116 name, and other character work are untouched.

## Remaining publication gate

`node scripts/build-github-pages.mjs --playtest` still fails closed with `PUBLIC_MODULE_CLOSURE_BLOCKED`: other existing views import `assembledUiArt.js`, which statically imports its private assembled manifest and the authority index. Neither file is added to the public allowlist. Full normal-browser flow, physical iOS testing and final publication remain unverified. No new authority-index upload, permissions change, push, merge, deployment or public-readback claim is made.

The loading workstream exported a newly authorized handoff separately. Do not read its previously denied `repair` checkout, retry that Git command, or change permissions. Its new export is independent intake evidence, not a merge or deployment. The source also reports a Google Drive upload denial for lack of authorization to that different destination; preserve that denial and do not substitute another Drive transfer. Merge only reviewed patch/runtime payloads received through an authorized handoff after this UI checkpoint, with exact hashes and current character compatibility.

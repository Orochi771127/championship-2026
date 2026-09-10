# One-component UI material pilot

**SUPERSEDED PALETTE:** Owner subsequently requested bright UI using the existing art-pack style, avoiding dark surfaces. The dark prompt and CSS proposal below are retained as history only. Use `BRIGHT_REVISION.md` for the active palette and scoped selector guidance. Do not generate or integrate the dark candidate.

Prepared 2026-09-06 against `main`, HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`. Worktree is already dirty; root is sole integrator. This packet changes no runtime file and supplies no generated image. Schema version for packet: 1. Art production index schema: 1.

The selected component is the **existing Raising Home header surface**, `.int-rh2-header` in `src/championship/app/intRh2Styles.css:48`. Its actual DOM mount is `src/championship/app/raisingHomeP1RView.js:108`, reached from normal New Game / Continue. This is an original decorative material candidate for the established P1R graphite/cyan/gold family. It adds no interface element, symbol, character, text, button, effect, navigation or gameplay meaning. Raster generation earns its place only if the subtle surface finish improves the header at phone size; the current coherent CSS/vector controls do not need raster replacement.

Authority read: AGENTS.md, README.md, docs/coordination/OWNER_DIRECTION.md (latest pixel revision), docs/architecture/CHAMPIONSHIP_2026_ARCHITECTURE.md, docs/coordination/CHAMPIONSHIP_RUNTIME_ARCHITECTURE.md, docs/CURRENT_PRODUCT_STATUS.md, both coordination agent statuses, Master Sync, dependency matrix, blocker ledger, CHAMPIONSHIP_PRESENTATION_PACK_CONTRACT.v1.json, INT_RH2_RUNTIME_PRESENTATION_CONTRACT.json via its consumer tests, ART_PRODUCTION_INDEX.json. Historical snapshots do not override newer source and Owner direction. Skills read: championship-art-production (including Multi-Agent V2 and cross-agent sync references) and imagegen. No Nexus or ROM/source pixels were read or supplied as generation inputs.

## Root generation prompt

Use case: stylized-concept
Asset type: one flat opaque decorative UI material texture, used solely behind existing live DOM text in a mobile game's existing Raising Home header.
Primary request: generate a restrained premium dark graphite and blue-slate finely brushed metal surface, softly worn by handling, with a subtle manufactured grain and small low-contrast variations. The reference is an existing UI palette, not an external image.
Composition: full-bleed 1536 x 1024 landscape material swatch, orthographic front view, entirely texture with no identifiable objects. Uniform detailing throughout; a very gentle broad lift toward the top. No focal object. The center must remain quiet behind text.
Color palette: graphite #27343c, dark slate #121c22, deep blue #06141e; tiny muted blue-grey sheen only. The surrounding DOM supplies cyan #65b8c3 and gold #d2ad5d accents, so DO NOT draw cyan/gold stripes in the image.
Material: matte fine brushed metal, fine non-repeating natural grain, subtle sparse shallow handling marks; no glitter, chrome, strong reflection or high-contrast scratches. The widest tonal separation must remain restrained.
Constraints: no text, letters, numbers, logos, watermarks, icons, controls, frame, edge border, bevel geometry, screws, bolts, lights, circuit paths, panels, creatures, landscapes, gradient banding or transparent checkerboard. Opaque RGB surface. Not a screenshot or UI mockup. Not pixel art. No bright white pixels. Nothing implying an interactive object.

Generation uses built-in imagegen; do not claim a specific image model unless the tool reports it. Keep the original generated file and hash in this packet before root promotion. Prefer an opaque PNG initially; runtime compression may use the existing deterministic encoder if available. A simple swatch intentionally avoids alpha cleanup and image-to-code layout ambiguity.

## Root-only CSS proposal, not applied

Replace only the background declaration within the existing `.int-rh2-header` rule after output inspection. Proposed runtime URL is a **proposal**, not an existing file:

```css
background:
  linear-gradient(180deg, rgba(39, 52, 60, 0.42), rgba(20, 31, 38, 0.72) 42%, rgba(8, 22, 31, 0.84)),
  url("../../../assets/production/ui/tooling-pilot-r1/raising-header-material.png") center 28% / cover no-repeat,
  var(--rh2-shell);
```

This candidate uses a top readability scrim and a solid-color load-failure fallback. Root must compare resulting contrast to the baseline: these alpha values are an initial proposal, not verified. Increase scrim opacity if texture distracts or the clock/title loses legibility. Keep all sizing, padding, safe-area handling, grid columns, border, box shadow, z-index, existing gold `::before` / `::after` accents, CSS variables, and JS unchanged. Avoid a new pseudo-element: both header pseudo-elements already have roles. Do not apply to Gate/Hunt headers or all panels. No new ticker, background animation or extra DOM node.

## Verification and minimal normal path

1. Re-read and hash `intRh2Styles.css` and `ART_PRODUCTION_INDEX.json` before root edits because both are shared/dirty. Register the generated original-created asset and a manifest in the unique index before making it runtime-loadable. Record root decision, actual provenance, generation output hash and dimensions, `humanApproved:false`, `shippingReady:false`; never infer approval from existing P1R approval. Index summary counts must match entries.
2. Inspect the actual image for no semantic details, text, unwanted borders or source-media copying. Compare normal Raising Home header before/after at 390x844 and narrow 360x800; remaining contract viewports are 393x852, 412x915 and 430x932. Desktop 1280x800 verifies centering of the existing max-430px shell.
3. Open `http://127.0.0.1:8732/championship.html` in a fresh isolated browser context, choose `#cm-new-game`, follow the current data-loaded continuation if present, wait for `.int-rh2-header`, and verify the image request succeeds and computed background references the registered production URL. Capture both full screen and header crop. No debug route or direct DOM injection counts as integration.
4. Confirm text, clock, header save button and toolbar are legible and operable. Check horizontal/vertical overflow, existing 44px touch target, one Pixi canvas and no new console/network errors. Trigger existing save, reload, Continue and verify normal Raising Home returns with the texture and persistent state. Do not reset the user's real browser save.
5. Focused existing suite: `node --test tests/championship-int-rh2-p1r-contract-cases.mjs tests/championship-int-rh2-runtime-presentation-cases.mjs tests/championship-migration-firewall-cases.mjs`; run normal repository regression and `git diff --check`. These prove architecture/invariants, not visual quality. Browser screenshots and interactions provide separate visual/runtime evidence.
6. Check image load failure: block only the new image request in the isolated test context, confirm the solid/gradient background preserves labels and controls. This is a reversible presentation change, so no implementation-mirroring unit test is requested.

Suggested root QA outputs: `docs/art/production/tooling-pilot-r1/qa/ui-before-390x844.png`, `ui-after-390x844.png`, `ui-after-360x800.png`, `ui-normal-path.json`. Existing `npm run test:browser` writes legacy `docs/reports/vs1/` and includes historical assertions; inspect before running to avoid overwriting unrelated receipts or claiming old flow assumptions.

Current outcome: candidate selected and implementation brief prepared; generation, visual acceptance, index registration, runtime integration and browser QA are pending. If the generated swatch adds noise without improving phone-scale readability, reject it and retain the current header. This outcome would be a useful measured result, not a reason to replace vector icons gratuitously.

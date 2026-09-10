# Continuous mobile UI — 2026-09-06

Owner asked for a mobile port that preserves the original and avoids two visibly separated screens. This bounded pass changes Raising Home, Gate Select, Hunt Loadout and Hunt Field through the existing DOM/Pixi/Three source boundaries.

The field fills the available phone content area, without a framed second screen. Raising status and Hunt target readouts float over their existing scenes. Gate Select shares one bright blue digital background from destination information through the globe to the action buttons. Loadout preserves the five equipment classes and four plugin positions with touch-sized rows. Existing selection, confirm/back, entry and wallet owners remain unchanged.

Gate preview now shows the canonical name/code, actual catalog entry fee, actual Shop wallet and a daytime production field thumbnail. It does not claim to use the original small `field_image_icon` cell. The selected Hunt target publishes a discrete source event; HP stays `???` without an equipped HP Analyzer, and unbound target fields remain unknown. The existing structural globe uses a brighter palette and hides its decorative mesh/rings; original terrain/node coordinates and globe artwork are not claimed.

## Evidence and supplied package

- Actual project: `R:/Projects/Championship2026/championship-2026`, `main`, starting HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`. Shared dirty work preserved.
- Owner photographs in attachment folder `D8EEFCD7-9A04-437F-AAF7-C799E30B5BB3`: world selection, selected-field information, transition reference, and Hunt field/HUD.
- Verified supplied path `R:/Projects/Championship2026/YDIJ_PRIVATE_ROM_ART_PACK`; read `00_METADATA/README_FIRST.md`, `08_FULL_FAMILY_CONVERSION/ui/hunt/world/field_image_icon/family.json`, and `ui/hunt/hunting/hunt_sub_scene/scene-structure.json`. Located world UI families and the HD scene/witness collection. This package is reference, not a runtime path.
- Evidence MCP: `YDIJ_3D_DECODED_REFERENCE_PACK_2026-08-24/GATE_SELECT_DECODED.md:5,7` confirms the existing model-family research pointers.
- Existing Gate 3D and Hunt Loadout contracts, `gate-table.r1.json`, original Hunt field bindings and the production Hunt manifest supply the implemented bindings. No raw package files were copied or converted into runtime.

## Validation

- Focused: **61/61**. Full serial regression: **1,138/1,138**. `qa/focused.log`, `qa/regression.log`.
- Actual browser: New Game → Home → System/Hunt → world-node selection → list/world toggle → Loadout → Begin Hunt → target selection → ground pan → return Home → Save → reload/Continue.
- World and field geometry checked at 320×568, 390×844, 430×932 and 844×390. No horizontal overflow; Gate footer buttons retain 44px height. One canvas on the Hunt field. Short landscape leaves less globe space; portrait is the primary target.
- Target selection in normal Hunt visibly updates unknown readouts; clicking empty ground clears selection, and dragging pans the ground under the DOM overlay. Analyzer HP gating also has a focused test. Full original capture tools are still disabled.
- Screenshots and DOM/geometry records live in `qa/`. Small-screen early screenshots precede the final status-text contrast correction; final 390×844 captures include it.
- No physical-device test, commit, push or deployment. This is UI integration acceptance, not full original-game parity or shipping acceptance.

Still open: original globe art/node transforms, separate original field icons, target portraits, sourced non-HP readouts, radar/countdown, native AI/tools/capture completion, textured Cage Edit and evolution presentation. The original ranch geometry/camera implementation from R4 is retained; this pass changes its DOM framing only.

Contract: `docs/contracts/championship/CHAMPIONSHIP_MOBILE_CONTINUOUS_UI.v1.json`.

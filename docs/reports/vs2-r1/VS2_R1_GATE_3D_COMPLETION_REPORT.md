# VS2-R1 Gate 3D Structural Presentation

Status: `OWNER_APPROVED_STRUCTURAL_BASELINE`

Owner verdict, 2026-08-28: approved as a structural baseline only. This is not final art, not exact Original behavior parity and not shipping-ready.

The Player Mode Gate Select now opens on one bounded, original-created Three.js world. It preserves the verified world-map composition, sixteen biome node pairs, paired day/night scene structure and destination-information hierarchy. The existing 4×4 Gate UI remains functional as the accessibility, low-graphics and Developer fallback.

The canonical biome identities are Canyon, Crag, Damp, Desert, Factory, Forest, Grass, Ice, Jungle, Mine, Oasis, Ruins, Savanna, Seaside, Sewer and Volcano. They are canonical recovered identities, not a claim of exact original player-facing copy or original display order.

## Evidence

- 390×844 world: `screenshots/gate-world-390x844.png`
- 390×844 rotated world: `screenshots/gate-world-rotated-390x844.png`
- 390×844 selected destination: `screenshots/gate-destination-selected-390x844.png`
- 390×844 transition to existing Hunt Loadout: `screenshots/gate-to-loadout-390x844.png`
- 393×852 world: `screenshots/gate-world-393x852.png`
- 393×852 selected destination: `screenshots/gate-destination-selected-393x852.png`
- 390×844 2D fallback: `screenshots/gate-2d-fallback-390x844.png`
- Browser QA: `VS2_R1_GATE_3D_BROWSER_QA.json`
- Runtime/presentation authority: `VS2_R1_GATE_3D_AUTHORITY_AUDIT.json`
- Three.js bounded-scene audit: `VS2_R1_THREE_BOUNDED_SCENE_AUDIT.json`
- Research-to-production provenance: `VS2_R1_RESEARCH_TO_PRODUCTION_PROVENANCE.json`
- Temporary structural-art manifest: `../../../assets/production/gate/vs2-r1/manifest.json`

## Verification

- Deterministic/contract tests: 81/81 pass.
- Full VS2 responsive browser flow: 5/5 required viewports pass (360×800, 390×844, 393×852, 412×915, 430×932).
- VS2-R1 evidence flow: 390×844 and 393×852 pass.
- Gate renderer count during Gate: 1.
- Gate renderer count after transition to Hunt Loadout: 0.
- Low-graphics fallback renderer count: 0.
- No extra storage key, store, router, save authority, gameplay state, Pixi Application, Capture surface or VS3 work was added.

## Non-parity declaration

Camera distance, globe rotation, pointer input, hit testing, node placement and the currently visible day preview are `PRODUCT_AUTHORED_TECHNICAL_PLACEHOLDER`. This batch does not claim original camera, rotation, input, hit-test or day/night switching parity.

The original-created Gate model is `OWNER_APPROVED_STRUCTURAL_BASELINE / STRUCTURAL_PRESENTATION / NOT_SHIPPING_READY / humanApproved=true`. Approval is limited to this structural baseline. A future production pass still owes biome differentiation, surface/material quality, node/world integration, a developed day/night visual system and greater Gate-world richness.

Camera, rotation, input, hit-test, node placement and the day preview remain `PRODUCT_AUTHORED_TECHNICAL_PLACEHOLDER`; Owner approval does not upgrade any of them to `ROM_VERIFIED`.

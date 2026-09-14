# Championship 2026 standalone architecture

Status: `MULTIPLE_INTEGRATED_SLICES_FULL_PARITY_PARTIAL` (2026-09-08)
SSOT: `CHAMPIONSHIP_2026_PRODUCT_SSOT`

Renderer wiring note checked against source on 2026-09-14; other stage-status statements retain their dated acceptance scope.

The standalone browser entry owns a single application session. The DOM owns screen chrome and the eight-slot contextual toolbar; a single PixiJS Application owns playable Raising and Hunt 2D presentation. Three.js is limited to bounded presentation integrations: Gate Select, the Battle menu cube, and the registered Battle VFX overlay are wired from the existing app entry. Each projects existing state; Gate Select retains the 2D accessibility/low-capability fallback. This is a source-wiring inventory, not new scene authorization or a fresh visual/device acceptance claim.

The local mode registry/router and `championshipScreenStack` are bounded to Championship and are the sole navigation authority. Raising and expedition state are produced by the standalone application session. `ChampionshipPersistentSavePort` is the only persistent writer and uses one product key. Live field actors, tools and card presentation are transient. The same save envelope retains original channel RNG, Hunt history/modifiers, captured individual fields, Shop wallet/inventory and observed match wins; it does not serialize a live expedition or native ROM memory.

Current integrated flow and reusable component paths are indexed in `docs/CURRENT_PRODUCT_STATUS.md` and `docs/REUSE_INVENTORY.md`.

## Hard boundaries

- No import, runtime fetch, storage key, adapter, or state bridge may resolve into Nexus Link.
- No product code may import `research/original-evidence/`.
- Runtime images must resolve below `assets/production/`.
- Original verified gameplay is preserved; unknown slots and values remain neutral.
- Normal Capture/Result/Home is integrated alongside Shop/Cage/Database and local Battle slices. Complete raising/growth, own-party battle, progression and visual/device parity remain partial. Current evidence and the two-stage work record supersede historical VS2-only exclusions.

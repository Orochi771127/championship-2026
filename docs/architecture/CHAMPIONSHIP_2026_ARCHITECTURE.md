# Championship 2026 standalone architecture

Status: `VS2_R2_INTEGRATED_BOUNDED_BASELINE`
SSOT: `CHAMPIONSHIP_2026_PRODUCT_SSOT`

The standalone browser entry owns a single application session. The DOM owns screen chrome and the eight-slot contextual toolbar; a single PixiJS Application owns playable Raising and Hunt 2D presentation. Three.js is mounted only for the bounded Gate Select world and projects the same Gate selection state as the 2D accessibility/low-capability fallback.

The local mode registry/router and `championshipScreenStack` are bounded to Championship and are the sole navigation authority. Raising and expedition state are produced by the standalone application session. `ChampionshipPersistentSavePort` is the only persistent writer and uses one product key. VS2 expedition state is session-scoped because original Hunt persistence is not traced; no second router or save authority exists.

Current integrated flow and reusable component paths are indexed in `docs/CURRENT_PRODUCT_STATUS.md` and `docs/REUSE_INVENTORY.md`.

## Hard boundaries

- No import, runtime fetch, storage key, adapter, or state bridge may resolve into Nexus Link.
- No product code may import `research/original-evidence/`.
- Runtime images must resolve below `assets/production/`.
- Original verified gameplay is preserved; unknown slots and values remain neutral.
- VS1, VS2, VS2-R1 and VS2-R2 are integrated bounded baselines. VS3 Capture/Result is not started.

# Championship 2026 standalone architecture

Status: `OWNER_PRODUCT_RESET_IMPLEMENTED`  
SSOT: `CHAMPIONSHIP_2026_PRODUCT_SSOT`

The standalone browser entry owns a single application session. The DOM owns screen chrome and the eight-slot contextual toolbar; a single PixiJS Application owns the playable Raising field and actor presentation. Three.js has no mounted authority in VS1.

The local mode registry/router is bounded to Championship and is the sole mode authority. Raising state is produced by one domain session. `ChampionshipPersistentSavePort` is the only persistent writer and uses one product key. A generic Championship screen-stack module remains unmounted until a later authorized slice needs it; no second global router exists.

## Hard boundaries

- No import, runtime fetch, storage key, adapter, or state bridge may resolve into Nexus Link.
- No product code may import `research/original-evidence/`.
- Runtime images must resolve below `assets/production/`.
- Original verified gameplay is preserved; unknown slots and values remain neutral.
- VS2 is not started by this repository migration.


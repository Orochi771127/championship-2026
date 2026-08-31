# Championship 2026 repository rules

This repository is the standalone product authority for **DIGIMON CHAMPIONSHIP — 2026 MODERN REBUILD**.

- Preserve verified original gameplay. Unknown behavior stays neutral until traced or approved by the Owner.
- `src/` must never import from `research/` or any Nexus Link path.
- Runtime-loadable art belongs only under `assets/production/`.
- ROM, decoded, reconstruction, and reference evidence is research-only and must not enter runtime bundles.
- DOM owns application UI. One PixiJS Application owns playable 2D presentation. Three.js is bounded and currently unmounted.
- Keep exactly one application state authority and one save repository. Do not introduce a second router, store, ticker, or save key.
- VS1 is the accepted baseline. VS2 and later work require separate authorization.
- Do not push, deploy, release, or integrate with Nexus Link without explicit Owner authorization.

Claude Code taking over battle work: **review first**, then continue original arithmetic only. Brief: `docs/coordination/CURSOR_BATTLE_ARITHMETIC_HANDOFF.md`. Serena: `mem:core` and `mem:claude-code/battle-arithmetic-handoff`. Codex owns art/UI. Do not invent hit/miss, TP, Sense→accuracy, or a BATTLE screen. Update `CLAUDE_REBUILD_STATUS.json` only after that review.


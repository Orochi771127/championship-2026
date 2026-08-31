# Championship 2026 — Serena graph root

- Owner: Terence. Standalone product SSOT. `src/` never imports `research/` or Nexus.
- Lanes: Claude Code = runtime reconstruction. Codex Art = art/UI. Cursor session 2026-08-31 wrote battle *arithmetic only* (not wired to app/screens).
- **Claude Code first action:** read `mem:claude-code/battle-arithmetic-handoff` and `docs/coordination/CURSOR_BATTLE_ARITHMETIC_HANDOFF.md`. REVIEW first (re-dump ROM, re-run battle+firewall tests), then continue original arithmetic only.
- Do not invent hit/miss, TP, Sense→accuracy, battle UI, or a second save/router/ticker.
- After review, Claude updates *its own* `CLAUDE_REBUILD_STATUS.json` / `CLAUDE_SYNC_DELTA.json`. Cursor did not overwrite those files.

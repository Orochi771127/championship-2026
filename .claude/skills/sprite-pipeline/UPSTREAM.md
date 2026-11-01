# Upstream

- Source: https://github.com/openai/plugins, `plugins/game-studio`, commit 0722921 (2026-10-08). Licence: MIT (`plugins/game-studio/.codex-plugin/plugin.json`).
- Installed 2026-11-01 by copying, because `npx skills add https://github.com/openai/plugins --skill sprite-pipeline` only discovers the repository-root skills.
- Copied: `skills/sprite-pipeline/SKILL.md`, `skills/sprite-pipeline/agents/openai.yaml`, `scripts/{build_sprite_edit_canvas,normalize_sprite_strip,render_sprite_preview_sheet}.py`, `references/sprite-pipeline.md`.
- Local change: `SKILL.md` paths `../../scripts/` and `../../references/` rewritten to `scripts/` and `references/`. Links to sibling game-studio skills (`../game-studio`, `../game-ui-frontend`) are not installed.
- Note: `normalize_sprite_strip.py` aligns frames by the alpha bounding box's bottom centre. For ROOT HOLD use `scripts/championship-sprite-foundry/root_lock.py`.

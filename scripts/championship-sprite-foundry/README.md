# championship-sprite-foundry

Local, free tools for turning generated character keys into game-ready motion.
Workflow, rules and rights: `.claude/skills/championship-art-production/references/sprite-foundry.md`.

| Tool | Script | Does |
|---|---|---|
| A | `split_sheet.py` | 4×4 A/B sheet or one panel → label bands cut → white-safe matte → `DIR/A.png`, `DIR/B.png` |
| B | `root_lock.py` | ROOT HOLD: B's torso locked onto A's, translation only, independent ECC check < 0.5 px |
| C | `tween_events.py` | A (event 1) + B (event 4) → events 1–6, 48 ticks at 60 fps, GIF/MP4 preview |
| C2 | `hitback_props.py` | one hit frame → knock-back shake + detached prop (crown) arc, per tick |
| E | `export_handoff.py` | registered events + authored ticks → atlas pages + handoff frames/clip JSON (frame fields only) |
| D | `prompt_kit.py` | native pixel frame → base plate, chroma key, measured pose prompt for ChatGPT |
| — | `selftest.py` | synthetic known-answer test of all of the above |

```bash
pip install -r scripts/championship-sprite-foundry/requirements.txt
python scripts/championship-sprite-foundry/selftest.py

python scripts/championship-sprite-foundry/prompt_kit.py --native NATIVE.png --design DESIGN.png --out-dir RUN/prompt --role MA28 --action flight --notes "..."
python scripts/championship-sprite-foundry/split_sheet.py SHEET.png --out-dir RUN/split [--u2net on]
python scripts/championship-sprite-foundry/root_lock.py --split-dir RUN/split --out-dir RUN/lock
python scripts/championship-sprite-foundry/tween_events.py --lock-dir RUN/lock --out-dir RUN/events --mp4
python scripts/championship-sprite-foundry/hitback_props.py --frame HIT.png --out-dir RUN/hit --ticks 7 --extend 11 --mp4
```

Every output is `RESEARCH_ONLY` until registered in
`assets/production/ART_PRODUCTION_INDEX.json`. Keep runs outside
`assets/production/`.

# Creature Production Experiment Pack — 2026-09

Status: `IN_PROGRESS / RESEARCH_ONLY`

This pack validates four product decisions before the original-commercial content scale-up. It must not change parity claims or silently promote reference art into shipping assets.

## Experiments

1. `01-animation-cost-audit/` — determine the minimum visual-pose contract needed to support a 200–500 form roster.
2. `02-habitat-life-sim/` — test whether a small set of reusable behaviours can create distinguishable resident life.
3. `03-original-family-factory/` — define and validate one original three-form family production contract.
4. `04-cage-3d-spike/` — compare direct image-to-3D, modular reconstruction and 2.5D approaches using the repository's clean Cage fields.

## Decision gates

The pack is complete only when it can answer:

- how many *new visual poses* a normal original creature actually needs;
- whether three residents with the same behaviour vocabulary still produce recognisably different lives;
- whether one original family can be produced without character-specific runtime code;
- whether a Cage reference can become a useful 3D/2.5D habitat without creating an unmaintainable asset or collision pipeline.

## Source boundaries

- Existing Championship data and art may be used as `REFERENCE_ONLY` / internal test input according to existing repository rights/evidence rules.
- Product conclusions must be expressed as renderer-neutral contracts and original-content requirements.
- A successful experiment is not release approval.

## Current evidence reused

- M201 tooling already proves an 83-slot character presentation contract (`65 Main + 18 Sub`) and deduplicates visually identical decoded cells before art production.
- Cage runtime manifest exposes 40 clean field images with native dimensions and separate collision authority.
- Current application architecture keeps simulation state outside PixiJS/Three.js presentation.

## Final output

`FINAL_DECISION_REPORT.md` will freeze the selected animation contract, Habitat AI vocabulary, character-factory path and Cage rendering path after the four experiments have measurable results.

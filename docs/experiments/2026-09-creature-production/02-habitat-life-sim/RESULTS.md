# Experiment 02 — Habitat Life Simulation

Status: `PASS_WITH_DESIGN_CORRECTION`

## Question

Can three residents sharing the same small action vocabulary still exhibit recognisably different lives?

## Prototype

Research-only deterministic simulator:

- `scripts/experiments/habitat-life-sim.mjs` — first pass.
- `scripts/experiments/habitat-life-sim-v2.mjs` — corrected pass.

Shared vocabulary: `EAT`, `SLEEP`, `REST`, `PLAY`, `SOCIAL`, `TRAIN`, `WORK`, `OBSERVE`, `WANDER`, `PLAYER_INTERACTION`, `DRINK`, `INSPECT`.

Shared affordances: food, bed, pond, toy, training point, tree and workbench.

Residents:

1. `curious-social`
2. `lazy-affectionate`
3. `independent-diligent`

## Finding 1 — naive Utility AI fails

The first scoring pass allowed one strong preference/personality term to dominate indefinitely. That is a critical product lesson: **personality weights alone do not create life; they can create repetitive robots.**

Observed 600-tick failure mode in the first pass:

- curious/social resident: `INSPECT` 534/600;
- lazy/affectionate resident: `PLAYER_INTERACTION` 556/600;
- independent/diligent resident: `WORK` 600/600.

This is rejected for product use.

## Finding 2 — repetition pressure + need curves works substantially better

V2 adds only generic machinery, not creature-specific scripts:

- quadratic need urgency;
- eight-action recency window;
- repetition penalty;
- extra penalty for repeating the same action three times in a row;
- energy/hunger cost in productive-action scoring.

Observed deterministic 600-tick result:

| Resident | Dominant behaviours | Largest single-action share |
|---|---|---:|
| curious-social | INSPECT 155, PLAY 134, SOCIAL 133, OBSERVE 66, DRINK 56 | 25.8% |
| lazy-affectionate | PLAYER_INTERACTION 190, SLEEP 67, REST 67, TRAIN 66, DRINK 66, WORK 65 | 31.7% |
| independent-diligent | WORK 248, TRAIN 208, SLEEP 62, EAT 27 | 41.3% |

The three residents now use the **same 12-action vocabulary** but produce clearly different behaviour distributions.

## Decision

`ADOPT` the following product principle:

> Habitat life should be driven by shared affordances + needs + personality/preferences + generic anti-repetition pressure. Do not write a bespoke behaviour tree for every creature.

## Important limitation

This experiment proves behaviour-distribution separation, not visual believability. It does not yet model:

- spatial travel cost;
- occupancy/capacity;
- resident-to-resident relationship scoring;
- interruptible actions;
- animation duration;
- day/night schedule;
- memory/event effects;
- actual Pixi/Three presentation.

Those belong in the next integration slice, not in the first mathematical proof.

## Product implication

For a 200–500 form roster, the expensive part should not be unique AI code. Most creatures can share the same action grammar and differentiate through data. Unique behaviours can be premium exceptions.

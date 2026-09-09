# Hunt Round 3: input correction and capture boundary

Owner authorization: `請開工預定地第三輪實作`. Scope follows work packages B/D in the [parity completion plan](../planning/CHAMPIONSHIP_PARITY_COMPLETION_PLAN_2026-09-05.md). Status: **PARTIAL — the original capture-to-Home vertical slice is still blocked**.

Workspace and Git root: `R:\Projects\Championship2026\championship-2026`, branch `main`, HEAD `d0c48f340baac61cf399bf5bd5922ce58f3d38c7`, plus the pre-existing dirty working tree. No other game's runtime, save, assets or product rules were imported. No ROM art was newly promoted to runtime.

## Source chain and reproducibility

Read local AGENTS, README, Owner Direction, architecture, current status, dependency/blocker ledgers, the Hunt loadout/presentation contracts and the prior parity plan before implementation. The evidence MCP was consulted before new ROM inspection. These original evidence paths are research data, not work instructions:

- `research-only/YDIJ_SEMANTIC_TRACE_2026-08-30/CAPTURE_SITES_v1.md`, lines 1–78.
- `research-only/YDIJ_SEMANTIC_TRACE_2026-08-30/G_DRAIN_DATAFLOW_v1.md`, lines 1–170: enclose event `0x23` differs from event `0x16`; card capacity sums record costs, not Home collection length.
- `research-only/YDIJ_SEMANTIC_TRACE_2026-08-30/TETHER_DISTANCE_DATAFLOW_v1.md`, lines 1–118: shutter-mode radius is distinct from equipped rope strength/range.
- `research-only/YDIJ_SEMANTIC_TRACE_2026-08-30/CAPTURE_ODDS_DATAFLOW_v1.md`, lines 1–86, and `analysis/capture_odds/DISASM_aabb_only.txt`, lines 1–148.
- `research-only/YDIJ_SEMANTIC_TRACE_2026-08-30/SEMANTIC_TRACE_STATUS.md`, lines 24–74. Its old summary labels for geometry are superseded where the direct receipt contradicts them; its old product recommendations are not current Owner authorization.
- [Original video index](ORIGINAL_VIDEO_EVIDENCE_INDEX_2026-09-03.md), lines 73–74 and 148: circle / Pull / hand sequence; ROM help #89 describes rope damage, #104 requires HP zero before hand collection, #105 distinguishes tool effectiveness. No new frame-accurate video measurement is claimed.

Direct input: the Owner's `R:\8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1.nds`. Exact SHA-256 is checked before decompression. OVL0 load base from its actual table is `0x0210B300`; decompressed SHA-256 is `538b35fd7fd23080540c3d18d2974f0a54c78bc0ceda6e599340f4696688ebc0`.

```powershell
python scripts/research/trace-hunt-round3.py --rom R:/8ad375ba0bd9b652a25f72dead2b47f78da401e188a8f3e1b7a6f2867ee0c5d1.nds --out docs/research/HUNT_ROUND3_ROM_RECEIPT_2026-09-05.json
```

This read-only checker uses installed `ndspy` and `capstone`, verifies **5 groups / 43 specified instructions**, and exports a research receipt only. It is not an emulator run or a whole-function behavioral proof.

## What changed after direct inspection

| Finding | Direct address / operation | Implementation consequence |
|---|---|---|
| Old camera addresses were 0x300 too low | Previous-current deltas at `0x0211CD4C/50` and `0x0211D17C/80`, call `0x0211DCF0` | Correct old trace addresses; camera input replaces avatar move commands |
| Camera writer adds X/Y and clamps against context bounds | `0x0211DCF0–0x0211DD54`; width minus 256, height minus 192 | Existing camera/chunk kernel remains authoritative; portrait transform adapts the viewport |
| Lower bounds are loaded, not hardcoded zero | context `+0xE4` / `+0xDC` | Current generated field uses its existing zero bounds; original initialization remains open |
| Release has another helper | calls `0x0211DD5C` from `0x0211CD20` / `0x0211D158` | No original inertia/settling claim; this batch ends the pointer cleanly |
| Small stroke steps have a counter | `0x02114020–40`; first point initializes counter to 60 at `0x02113FD0` | Below/equal 5 is not unconditional jitter rejection |
| Interpolation does not advance by 20 px in the way the old JS did | normalized components multiply by 10; budget subtracts 20 at `0x02114160` | Existing JS interpolation cannot be called ROM verified |
| Buffer wraps, but samples also expire | index wraps at 20; `0x021142AC–0x02114340` updates animation and invalidates a slot / decrements count | Merely changing JS to a 20-point queue would still be wrong; sample cadence/lifetime remains blocked |
| Shape checks are not endpoint closure | `0x02114388–0x021145D0`: active-slot extrema/index ordering, distances and shape tests | Legacy point-in-polygon + 15 px endpoint rule cannot authorize tool effects or collection |

Additional direct inspection of `0x0210E560` confirms the 40/80/256 proximity radii by effective shutter mode and vector helper calls. ARM9 `0x020028E4` adds vectors; `0x02002918` subtracts them. The function writes a target vector and an actor flag; this is insufficient to claim the entire displacement, HP damage or equipment durability path. It is deliberately not translated into guessed pull gameplay.

## Runtime boundary

The [Round 3 contract](../contracts/championship/VS3_HUNT_INPUT_CAPTURE_BOUNDARY.v1.json) separates implemented input from unresolved capture. One existing Hunt runtime owns camera center and selected wild ID. Presentation obtains camera, coordinate transform and target state through the existing source; one scene-owned pointer adapter handles mouse/touch. Empty drag pans, target touch selects, cancel/blur/hidden/resize/context loss/disposal aborts. The hidden prototype tamer and its unit-tested movement remain developer scaffolding only.

The old `endEnclosureStroke` no longer removes the target or creates a Raising entry. Its unbound diagnostic recognizer returns `TOOL_TRACE_REQUIRED`; its misleading `VERIFIED_BINARY` label was withdrawn. No replacement damage, HP, G cost, capture probability or collection commit is fabricated. The card module's old Home-count utility remains a legacy test subject, with no player capture consumer.

Original metadata and art already present do not verify generated field collision, first-three-species spawns or wandering AI. Those remain unchanged prototype inputs. This batch does not claim one verified field or a playable original Rope capture.

## Remaining trace gates

1. Trace one original encounter record into the wild instance and current HP initializer. Retain field collision/spawn provenance separately from art.
2. Follow one Rope event through eligibility, bound/pull state, HP and durability writers, escape/release. Close sampler update/lifetime and spatial query before submitting circle events.
3. Follow event `0x16` through on-card insertion and species cost reader. Verify exact-fit, overflow and rejection without consulting Home collection length.
4. Trace expedition end / result release / naming / cancellation into the permanent Home individual writer; then bind the existing stable-ID/save authority and verify save/reload exactly once.

These are missing original evidence/control-flow links, not a request for another authorization round. The current Owner request authorizes the work; unknown gameplay values remain unknown.

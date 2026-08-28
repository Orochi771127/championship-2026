# Championship Owner Direction

Repository authority: `CHAMPIONSHIP_2026_PRODUCT_SSOT` (`.`).  
Migration state: standalone product; historical Nexus integration decisions are preserved below as superseded/frozen context only.

Authority: **OWNER ONLY**  
Last explicit direction: **2026-08-29 — Functional-complete, IP-neutral, modular-Cage product plan and repository consolidation**

Agents may index this file and may transcribe a later explicit Owner directive,
but may not reinterpret or independently change product direction.

## Current product authority — Championship 2026

- One human Owner plus AI will first complete all game systems, modes and the New Game → Championship loop with IP-neutral stable IDs and original-neutral temporary content.
- Final public branding, original creatures, world, art, text and audio are selected after the functional-completion gate; the public product does not ship Digimon names, characters or source media without rights.
- The original Cage/Training mechanic is a required shape-aware spatial assembly system: functional terrain pieces have specific footprints and affect different raising values. Exact untraced shapes, rules and values remain evidence-gated.
- `docs/README.md` is the documentation entrance; `docs/CURRENT_PRODUCT_STATUS.md` indexes current integrated `main`. Earlier coordination snapshots remain provenance and do not override later committed source/tests.

- Target product: `DIGIMON CHAMPIONSHIP — 2026 MODERN REBUILD`.
- Delivery target: standalone, web-first, mobile-first, portrait 9:16,
  touch-first, with desktop-browser compatibility.
- Nexus Link integration is `FROZEN / OUT_OF_CURRENT_PRODUCT_SCOPE`. Historical
  Nexus decisions remain recorded but are superseded for the current product.
- `ROM_VERIFIED` Original Championship gameplay is `DEFAULT_PRESERVE`.
  `PARTIAL` preserves its known structure, `UNKNOWN_REQUIRES_TRACE` remains
  neutral, and only `OWNER_APPROVED_ADAPTATION` may intentionally change
  gameplay.
- Modernization may update renderer, resolution, responsive layout, controls,
  loading, save infrastructure, animation technology, asset resolution, VFX,
  accessibility, mobile UX, performance, and packaging. It must not silently
  redesign auto battle, Hunt tether/circle capture, the contextual toolbar, or
  Raising systems.
- Renderer authority: DOM for UI/menus/panels/toolbar/text; PixiJS for playable
  2D fields/creatures/sprites/VFX; Three.js only for verified or explicitly
  Owner-approved bounded 3D scenes. No React rewrite, second global
  router/store/save/ticker authority, or Nexus-specific gameplay dependency.
- INT-RH2 Raising Home is accepted as the first Championship 2026 playable
  baseline. Its current environment and creature visuals remain temporary.
- Development proceeds by vertical slices: VS1 Raising Home; VS2 Gate Select to
  Hunt exploration and return; VS3 Capture/Result; VS4 Training/Cage/Shop/
  Database; VS5 Battle Setup/Auto Battle/Result; VS6 progression/save
  integration; VS7 production art/animation/VFX/audio/packaging.
- Original decoded art remains `ROM_COPYRIGHTED_REFERENCE / RESEARCH_ONLY` and
  must stay separate from 2026 production assets.
- The current authorization is documentation reconciliation only. Stop after
  updating coordination/integration documentation; it is not a VS2
  implementation GO.

## Coordination authority

- The canonical coordination root is `docs/coordination/championship/` in the
  formal NexusLink repository.
- Chat history is not project-progress truth. Claude Code and Codex Art must
  synchronize through the repository coordination SSOT.
- Owner product decisions override runtime evidence and presentation/art truth.
- `CHAMPIONSHIP_MASTER_SYNC.md` is a human-readable index and status summary;
  it never replaces source reports, manifests, tests, Git state, or evidence.

## Ownership

- Claude Code exclusively owns `CLAUDE_REBUILD_STATUS.json` and
  `CLAUDE_SYNC_DELTA.json`, plus the runtime implementation/reconstruction lane.
- Codex Art exclusively owns `CODEX_ART_STATUS.json` and
  `CODEX_SYNC_DELTA.json`, plus the art/presentation lane.
- Neither agent may overwrite the other agent's status file.
- Codex is the single merge writer for Master Sync, Dependency Matrix, and
  Blocker Ledger. That role is coordination-only and grants no gameplay or
  Owner authority. Shared coordination files may be updated only from verified
  repo evidence and both owned deltas.

Gameplay truth belongs to Claude/runtime evidence. Presentation and art truth
belongs to Codex Art. Unknown gameplay contracts require neutral presentation;
missing art does not authorize Claude to invent visual production authority.

## Required synchronization

Before each bounded batch, record Git status, branch, and HEAD, then read this
direction, both agent status files, the Master Sync, Dependency Matrix, and
Blocker Ledger. When an owned file is absent, record it as not reported; do not
infer its content.

At the end of each bounded batch, the responsible agent updates its own status
with completed/current/blocked/outputs/checkpoint/dependenciesChanged/
recommendedNext. Shared blocker, decision, and dependency files change only
when the underlying fact changes.

Owner/QA-approved bounded work should receive a recoverable local checkpoint.
A commit is not a merge, shipping promotion, or deployment.

## Current synchronization-only gate

SYNC-2 may run only after both local checkpoints, both owned status updates,
both owned deltas, the Claude-owned toolbar contract, and CL-007 hardening are
present. The merge writer must re-read and hash each shared file, merge by
stable record ID, validate a temporary output, atomically replace only when the
base hash is unchanged, and record `syncRevision: 2`.

This round remains `SYNC ONLY`:

- Claude Code updates its own runtime status and runtime architecture.
- Codex Art updates its own art status.
- Shared Master Sync, Dependency Matrix, and Blocker Ledger are then reconciled.
- No new production batch starts in this round.
- Complete the synchronization and **STOP FOR OWNER REVIEW**. Do not start O2,
  O4, P3-P6, a new environment, gameplay phase, or reverse batch.

## Current art direction carried into sync

- O1 Original UI: complete and Owner-approved reference baseline.
- ART-R2R Character Fidelity Pipeline: Owner-approved reference baseline.
- Training/Cage: 40/40 core recovered; 38/40 full composition confidence.
- Hunt: 16/16 biome representative coverage.
- Battle: 11/11 static field coverage; Owner-approved reference baseline;
  BM03/BM04 animation placement/timing remains unknown and non-blocking for the
  static archive.
- ART-R4 VFX/3D representative baseline: complete and Owner-approved reference
  baseline.
- ART-P1R Modern UI: Owner-approved production standard; not shipping-ready.
- ART-P2/P2R Modern Environment: technical/visual proof retained; no automatic
  production-standard or shipping promotion.
- P3-P6 and further modern original production remain frozen.

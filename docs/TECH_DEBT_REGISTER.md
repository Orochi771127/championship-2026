# Championship 2026 — Technical Debt Register

Scoring: `Priority = (Impact + Risk) × (6 - Effort)`, each input 1–5.

| Rank | Debt | Category | Impact | Risk | Effort | Score | Remediation |
|---:|---|---|---:|---:|---:|---:|---|
| 1 | Current implementation and old coordination status disagree | Documentation | 5 | 5 | 2 | 40 | Current-status SSOT + historical banners; update with every slice |
| 2 | No automated CI on the new private GitHub repository | Infrastructure/Test | 4 | 5 | 2 | 36 | `RESOLVED_THIS_PASS`: Node 22 `npm ci` / `npm test` workflow added |
| 3 | Generated browser QA evidence can leave the worktree dirty | Test/Documentation | 3 | 4 | 1 | 35 | Validate then commit a single evidence refresh or write outputs to a staging directory |
| 4 | Final public branding/IP is intentionally undecided while internal names still reference the source | Product/Documentation | 5 | 5 | 3 | 30 | Keep neutral runtime IDs; close final IP gate only after functional completion |
| 5 | No single reusable-component inventory existed | Documentation | 4 | 3 | 2 | 28 | Maintain `REUSE_INVENTORY.md` with tests and boundaries |
| 6 | Cage assembly shapes/effects are required but exact parity data is incomplete | Gameplay/Data | 5 | 4 | 4 | 18 | Implement data contracts and neutral sandbox; replace only with traced values |
| 7 | VS3 Capture/Result is the next missing playable transaction | Gameplay/Test | 5 | 4 | 4 | 18 | Build on the existing Hunt seam and save authority |
| 8 | Current status is manually maintained | Documentation/Infrastructure | 3 | 3 | 3 | 18 | Generate portions from tests, manifests and Git metadata |
| 9 | Untraced Hunt steering nibbles crash the field mid-play | Gameplay/Evidence | 5 | 5 | 3 | 30 | Trace ARM9 direction nibbles 14/15, then replace the guard with the original behaviour |

## Debt 9 — untraced Hunt steering nibbles

Found 2026-09-09 by driving a real capture in Chrome. `steerNativeHuntDirection`
covers direction nibbles 0..11 and throws
`NATIVE_DIRECTION_UNASSIGNED_BRANCH_REQUIRES_TRACE` for anything above, because
the original leaves those stack components unassigned and this build refuses to
fabricate a vector for them. That refusal is right. What is wrong is where it
lands: the throw escapes the field's own ticker as an unhandled page error, so a
wild that steps onto such a tile in movement mode 3 takes the whole Hunt down.

The catalog contains **159,429 of 475,136 tiles — 33.6%**, but this is
NOT a probability of hitting the failure or proof that those tiles are ordinary
walkable escape paths. The 2026-09-09 census found all 150,699 nibble-14 tiles
are blocked terrain, and all 8,730 nibble-15 tiles are escape boundaries.
Normal AI8 checks the boundary before movement; its first update immediately
following a state transition is a distinct case.

New live original evidence reproduces that first-update exception at an edge:
a normal stylus circle on wild index 3 reads attribute 0x8f. ARM9 animation
routine 02047D5C pushes the current actor address and return address 02047944
into the later steering scratch X/Y slots. The original blends and normalizes
those values, then continues to escape handling. See
[the live receipt](research/HUNT_STEERING_EDGE_LIVE_2026-09-09.json) and
[the CPU probe](research/HUNT_STEERING_STACK_CPU_2026-09-09.json).
This establishes one actual producer path; it does not establish a portable
original heap-layout authority for every new encounter. No keep-direction
adaptation has been installed. Owner asked to prioritize original behavior.

A separate verified bug was fixed: AI8 entry 02111310 stores direction Y=1;
the port incorrectly stored 4096 before the first steering blend.

Remediation is a trace, not a patch: read what ARM9 does for nibbles 14/15 and
implement it. Until then the guard must stay — a fallback direction chosen here
would be invented gameplay — so the exposure is a known live crash, not a
styling issue. Anything that only contains the throw still decides what the
creature does instead, which is the same invention by another route and needs
Owner approval.

- documentation hub, current status, reuse inventory and stale-snapshot banners;
- cleanly resolve current browser-QA evidence;
- validate the new GitHub Actions test gate after push.

### Next slice

- VS3 Capture/Result using current Gate/Hunt/Loadout foundations;
- begin versioned Cage board/module/effect data contracts without guessing parity values.

### Later

- automated status generation and link validation;
- public-IP naming migration and final content-pack pipeline;
- physical document relocation only if automated link rewriting makes it low risk.

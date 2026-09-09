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

It is not a rare corner. Every one of the 29 hunt environments has three
untraced direction-palette entries (`unknownDirection` 14 and 15), and they
cover **159,429 of 475,136 tiles — 33.6% of the hunt maps**, from 14.5% of
`field_hm16_01` to 64.1% of `field_hm03_01`.

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

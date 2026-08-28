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

## Remediation phases

### Now

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

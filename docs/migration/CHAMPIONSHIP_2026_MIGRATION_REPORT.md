# Championship 2026 repository separation report

Status: `MIGRATION_COMPLETE — STOP_FOR_OWNER_REVIEW`
Product SSOT: `CHAMPIONSHIP_2026_PRODUCT_SSOT`

## 1. New repo path

`R:\Projects\Championship2026\championship-2026\`

## 2. New branch / head

Branch: `main`. Foundation: `efb397a`. The VS1 checkpoint is the commit containing this report; its full SHA is reported from Git after commit creation.

## 3. Migrated file counts

- One standalone HTML entry.
- 35-file transitive runtime import closure, with two CSS files and one additional presentation contract alongside it.
- Three presentation/evidence contracts total.
- Eleven registered temporary presentation assets, all below `assets/production/`.
- Five focused QA programs plus eight browser screenshots and one machine-readable browser report.
- Ten required coordination SSOT documents, two migration manifests, architecture, provenance, and migration reports.

## 4. Excluded Nexus files

No prior `.git`, application entry, global router/store/save system, gameplay bridge, adapter, unrelated asset tree, or later-slice implementation was migrated. Battle, Hunt, Capture, Shop, Arena, progression, and integration modules are absent from `src/championship/`.

## 5. Excluded research / staging

No ROM/Nitro/decoded payload, reference pixel, reconstruction gallery, generated forensic catalog, reverse tool suite, or reproducible 35 MB staging artifact exists in product history. `research/original-evidence/` contains only its firewall README and provenance policy.

## 6. VS1 QA

`npm test`: `19 / 19 PASS`. Browser QA: five mobile viewports PASS; one canvas; eight neutral toolbar slots; no overflow, page error, failed normal request, or mounted Three.js authority. See `docs/reports/vs1/INT_RH2_COMPLETION_REPORT.md`.

## 7. Save / reload QA

PASS: select → care → relocate → save → close page → fresh page → Continue → restore. Creature identity, care count, and target cage persist; transient selection does not. A malformed save does not block New Game.

## 8. Nexus dependency scan

PASS: runtime/entry/contracts contain no Nexus namespace, import, CDN URL, external repository path, or historical save key. Package dependencies resolve locally after `npm install`.

## 9. Production / research firewall result

PASS: all eleven declared runtime assets resolve below `assets/production/temporary/int-rh2/`; product code imports no `research/` path; product trees contain no prohibited ROM/decoded extension. The Codex manifest records bytes, SHA-256, rights, lifecycle, and non-shipping state.

## 10. New checkpoint SHA

Foundation: `efb397a`. VS1 migration: resolve `git rev-parse HEAD` in this repository; the final handoff reports the immutable full SHA.

## 11. Remaining migration blockers

None for repository separation or VS1. Product blockers intentionally remain outside this migration: temporary visuals are not shipping art, unresolved original semantics remain neutral, and VS2 has no authorization.

No push, deploy, release, Nexus integration, or VS2 work was performed.

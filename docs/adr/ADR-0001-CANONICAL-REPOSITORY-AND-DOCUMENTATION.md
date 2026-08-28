# ADR-0001: Canonical Repository and Documentation Information Architecture

**Status:** Accepted

**Date:** 2026-08-29

**Deciders:** Owner, Codex consolidation pass

## Context

Claude Code and Codex produced working runtime slices, contracts, reports, planning documents and historical synchronization records. The files are valuable, but status drift made earlier documents say VS2 was not started after VS2, VS2-R1 and VS2-R2 were already committed. Moving every historical file would break evidence links and obscure provenance.

## Decision

- `R:\Projects\Championship2026\championship-2026` is the only product Git repository and runtime authority.
- `docs/README.md` is the single documentation entrance.
- `docs/CURRENT_PRODUCT_STATUS.md` indexes current integrated behavior from `main` and tests.
- `docs/REUSE_INVENTORY.md` records reusable implementation assets and their boundaries.
- Planning, contracts, reports, research, coordination and migration remain separate evidence classes.
- Historical coordination files stay at their current paths and receive prominent stale/snapshot notices rather than being copied or silently rewritten.
- The pre-clean migration Git bundle is external recovery material under the workspace `_archive` directory and is never product history or a runtime dependency.

## Options considered

### A. Move and rename every file now

| Dimension | Assessment |
|---|---|
| Immediate visual tidiness | High |
| Broken-link/provenance risk | High |
| Review effort | High |
| Value to runtime | Low |

### B. Index-first consolidation with bounded corrections

| Dimension | Assessment |
|---|---|
| Immediate clarity | High |
| Broken-link/provenance risk | Low |
| Review effort | Medium |
| Value to runtime | High |

### C. Keep independent Claude/Codex status islands

| Dimension | Assessment |
|---|---|
| Immediate effort | Low |
| Future status drift | Very high |
| Solo-owner usability | Low |

## Consequences

- A new contributor can find current truth without reading every synchronization artifact.
- Existing evidence links and historical ownership remain intact.
- New integrated changes must update the current-status and reuse indexes in the same commit.
- Some historical files intentionally retain obsolete statements; their banner and the documentation hub prevent them from masquerading as current truth.
- Large-scale physical relocation can be reconsidered only with an automated link migration and verification tool.

## Action items

1. [x] Create the documentation hub, current status and reuse inventory.
2. [x] Mark pre-VS2 coordination plans as historical snapshots.
3. [x] Reconcile the architecture overview with current `main`.
4. [x] Index the external migration bundle and move it into the workspace archive.
5. [x] Add CI for `npm ci` + `npm test` on pushes and pull requests.
6. [ ] Generate current-status checks from contracts/tests to reduce future manual drift.

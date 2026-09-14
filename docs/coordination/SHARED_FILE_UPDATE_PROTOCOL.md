# Shared-file update protocol

Use this protocol for cross-agent handoff, reliance on another active workstream, or shared coordination updates. Ordinary document edits and read-only audits do not require a synchronization round or status write.

## Authority and ownership

The canonical root is `docs/coordination/` in the formal Championship 2026 repository. Read the affected Owner direction, both agents' owned STATUS/DELTA records, Master Sync, Dependency Matrix and Blocker Ledger when performing this workflow. Missing records mean `NOT_REPORTED`; dated records do not establish current completion.

- Claude owns `CLAUDE_REBUILD_STATUS.json` / `CLAUDE_SYNC_DELTA.json`; Codex Art owns `CODEX_ART_STATUS.json` / `CODEX_SYNC_DELTA.json`. Do not overwrite the other agent's records or reconcile root-level and coordination copies by filename alone.
- Codex is the single merge writer for `CHAMPIONSHIP_MASTER_SYNC.md`, `CHAMPIONSHIP_DEPENDENCY_MATRIX.csv` and `CHAMPIONSHIP_BLOCKER_LEDGER.csv`. This is merge responsibility, not gameplay, art or Owner authority.
- Read source reports, manifests, current contracts, tests and Git state to substantiate updates. A dependency needs a verified applicable contract; unknown behavior remains a neutral or blocked binding.

## Merge protocol

1. Re-read each target and capture its SHA-256, then read both owned STATUS/DELTA inputs.
2. Merge CSV records by stable `contract` or `id`; use documented stable record IDs for Master facts. Duplicate IDs with incompatible ownership or truth are conflicts: reject and quarantine them instead of overwriting.
3. Stable-sort the candidate records. Write a temporary file and validate schema, counts, ownership and evidence before replacement.
4. Immediately before replacement, compare the target SHA-256 with the captured base. On change, use `ABORT_AND_REREAD`, retain the current target and rebuild the candidate from fresh inputs. Never force the write.
5. Atomically replace only the unchanged target; capture the new hash and record the applicable `syncRevision`. Do not reset the revision to an old example value.

Never use blind overwrite, truncate-and-rebuild from memory, or last-writer-wins. These safeguards preserve the CL-007 incident protection.

## Completion

Update only the responsible agent's status when work changes its recorded facts. Shared dependency/blocker records change only when underlying evidence changes; log only real decisions, and keep Master Sync a concise index. Read-only work reports without writing these files.

An applicable active `SYNC ONLY` instruction limits that round to coordination and its Owner review. Historical syncRevision 2/3 instructions do not freeze later authorized product work. Local checkpoints and external publication each require applicable authorization; neither changes rights or acceptance labels.
